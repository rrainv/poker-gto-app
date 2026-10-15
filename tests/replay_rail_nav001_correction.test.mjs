import test from 'node:test';
import { handSetupPositions } from '../app/src/application/table-presets.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handSetupRulesDefinition } from '../app/src/application/hand-setup-rules.mjs';

import { ACTION_TYPES, PHASES } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: live controls, Abort, and table-size validation run in the
// booted Hand workspace; markup is parsed and styling resolved through the
// cascade. Renderer and translation sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const RENDERER = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const TRANSLATIONS = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const FLOP = Object.freeze(['2c', '3c', '4c']);
const TURN = Object.freeze(['5s']);
const RIVER = Object.freeze(['6c']);

function controllerWithDeal({ tableSize = 2, stackBb = 10 } = {}) {
  const controller = createCanonicalLiveController({ enabled: true });
  const initial = controller.initialize({
    tableSize,
    gameMode: 'home',
    stackBb,
    stackMode: 'hero',
    heroSeat: 0,
    buttonSeat: 0,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  });
  assert.ok(initial, controller.getDiagnostics().error?.message);
  assert.ok(controller.dealHoleCards(Object.fromEntries(
    initial.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
  )));
  return controller;
}

function passiveRound(controller) {
  while (controller.getState().phase === PHASES.BETTING) {
    const spec = controller.getLegalActions();
    const type = spec.check.available ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL;
    assert.ok(controller.applyAction({ type }), controller.getDiagnostics().error?.message);
  }
  return controller.getState();
}

function finishAllInBetting(controller) {
  while (controller.getState().phase === PHASES.BETTING) {
    const state = controller.getState();
    const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
    assert.ok(actor && actor.currentStackMilliBb > 0 && !actor.folded, 'no all-in or folded fake actor');
    const spec = controller.getLegalActions();
    const type = spec.call.available ? ACTION_TYPES.CALL
      : spec.check.available ? ACTION_TYPES.CHECK
        : ACTION_TYPES.FOLD;
    assert.ok(controller.applyAction({ type }), controller.getDiagnostics().error?.message);
  }
  return controller.getState();
}

function dealRunout(controller, { from = 'flop' } = {}) {
  if (from === 'flop') assert.ok(controller.dealBoardCards(FLOP));
  if (controller.getState().pendingChance?.type === 'deal_turn') assert.ok(controller.dealBoardCards(TURN));
  if (controller.getState().pendingChance?.type === 'deal_river') assert.ok(controller.dealBoardCards(RIVER));
  return controller.getState();
}

test('HU and multiway preflop all-ins expose explicit flop, turn, river, and showdown without a fake actor', () => {
  for (const tableSize of [2, 3]) {
    const controller = controllerWithDeal({ tableSize });
    assert.equal(controller.getLegalActions().allIn.available, true);
    assert.ok(controller.applyAction({ type: ACTION_TYPES.ALL_IN }));
    const waiting = finishAllInBetting(controller);
    assert.equal(waiting.phase, PHASES.CHANCE);
    assert.equal(waiting.pendingChance.type, 'deal_flop');
    const showdown = dealRunout(controller);
    assert.equal(showdown.phase, PHASES.SHOWDOWN);
    assert.equal(showdown.actingPlayerId, null);
    assert.equal(showdown.board.length, 5);
  }
});

test('all-in on the flop and all-in on the turn continue through every remaining explicit chance event', () => {
  const flopController = controllerWithDeal();
  passiveRound(flopController);
  assert.ok(flopController.dealBoardCards(FLOP));
  assert.ok(flopController.applyAction({ type: ACTION_TYPES.ALL_IN }));
  finishAllInBetting(flopController);
  assert.equal(flopController.getState().pendingChance.type, 'deal_turn');
  assert.equal(dealRunout(flopController, { from: 'turn' }).phase, PHASES.SHOWDOWN);

  const turnController = controllerWithDeal();
  passiveRound(turnController);
  assert.ok(turnController.dealBoardCards(FLOP));
  passiveRound(turnController);
  assert.ok(turnController.dealBoardCards(TURN));
  assert.ok(turnController.applyAction({ type: ACTION_TYPES.ALL_IN }));
  finishAllInBetting(turnController);
  assert.equal(turnController.getState().pendingChance.type, 'deal_river');
  assert.ok(turnController.dealBoardCards(RIVER));
  assert.equal(turnController.getState().phase, PHASES.SHOWDOWN);
});

test('one all-in player is skipped while remaining multiway actors complete the betting round', () => {
  const controller = controllerWithDeal({ tableSize: 3 });
  const allInPlayerId = controller.getState().actingPlayerId;
  assert.ok(controller.applyAction({ type: ACTION_TYPES.ALL_IN }));
  assert.equal(controller.getState().phase, PHASES.BETTING);
  assert.notEqual(controller.getState().actingPlayerId, allInPlayerId);
  const waiting = finishAllInBetting(controller);
  assert.equal(waiting.pendingChance.type, 'deal_flop');
  assert.equal(waiting.players.find((player) => player.playerId === allInPlayerId).currentStackMilliBb, 0);
});

test('live controls are re-derived after Replay so legal Raise and exact-count board commits cannot stay disabled', async () => {
  await app.startHand(['As', 'Kd']);
  await app.handAction('call');
  const sizing = ['handActionAmountBb', 'handActionAmountRange', 'handSizingMinPreset', 'handSizingMaxPreset'];
  await app.click('#handReplayPreviousButton');
  await app.settle(200);
  await app.click('#handReplayLiveButton');
  await app.settle(200);
  // Back at the live endpoint, choosing the legal Raise re-enables every
  // sizing control (Replay left them disabled) and re-derives the commit.
  const raise = app.$('[data-canonical-action="raise"]');
  assert.equal(raise.disabled, false);
  await app.click(raise);
  for (const id of sizing) assert.equal(app.byId(id).disabled, false, id);
  assert.equal(app.byId('handCommitSizedAction').disabled, false, 'the minimum raise can be committed');
  app.byId('handActionSizing').hidden = true;
  // Finish preflop; the flop commit is enabled only with exactly three cards.
  for (let round = 0; round < 20 && !app.call('callPlaybookStateBridge', 'getState').pendingChance; round += 1) {
    await app.click(app.$('[data-canonical-action="check"]:not([disabled])') || app.$('[data-canonical-action="call"]:not([disabled])'));
    await app.settle(200);
  }
  assert.equal(app.call('callPlaybookStateBridge', 'getState').pendingChance.cardCount, 3);
  const deal = app.byId('handDealBoardButton');
  assert.equal(deal.disabled, true);
  await app.pickCards('[data-card-set-edit="hand-board-chance"]', ['2c', '3c']);
  assert.equal(deal.disabled, true, 'two cards cannot commit a flop');
  await app.pickCards('[data-card-set-edit="hand-board-chance"]', ['2c', '3c', '4c']);
  assert.equal(deal.disabled, false, 'exactly three cards can');
});

test('Abort Hand is confirmed, clears only canonical live transients, and returns to setup', async () => {
  const reset = markup.getElementById('handResetButton');
  assert.ok(reset.classList.contains('ui-button--danger-secondary'));
  assert.equal(reset.dataset.i18n, 'Abort hand');
  await app.startHand(['As', 'Kd']);
  app.byId('handSetupDisclosure')?.removeAttribute('open');
  const confirm = app.window.confirm;
  const prompts = [];
  app.window.confirm = (message) => { prompts.push(message); return true; };
  const spy = app.spy(['callPlaybookStateBridge', 'resetCanonicalHandDraft', 'callSavedStudyBridge']);
  try {
    await app.click('#handResetButton');
    await app.settle(200);
    assert.deepEqual(prompts, ['Abort this hand? Unsaved current live progress will be discarded. Saved hands and spots will not be changed.']);
    assert.ok(spy.calls.callPlaybookStateBridge.some(([method]) => method === 'resetHand'));
    assert.ok(spy.count('resetCanonicalHandDraft') >= 1);
    // Saved study is never touched.
    assert.ok(spy.calls.callSavedStudyBridge.every(([method]) => !/delete|remove|clear/i.test(method)), JSON.stringify(spy.calls.callSavedStudyBridge.map(([method]) => method)));
  } finally {
    spy.restore();
    app.window.confirm = confirm;
  }
  assert.equal(app.call('callPlaybookStateBridge', 'getState'), null);
  assert.ok(app.byId('handSetupDisclosure').hasAttribute('open'), 'returns to setup');
});

test('player-count validation preserves invalid input and blocks start instead of clamping', async () => {
  await app.navigate('hand');
  assert.equal(app.call('callPlaybookStateBridge', 'getState'), null, 'setup state');
  const tableSize = app.byId('handTableSize');
  const collection = app.byId('handCollectionType');
  const start = app.byId('handStartButton');
  for (const collectionType of ['none', 'fixed_per_seated_player']) {
    if (![...collection.options].some((option) => option.value === collectionType)) continue;
    collection.value = collectionType;
    const minimum = handSetupRulesDefinition({ collectionType }).tableSize.minimumSeated;
    for (const raw of ['', '-1', '1', '2.5', '2', '6', '7', '10', '11']) {
      tableSize.value = raw;
      const expectedValid = raw !== '' && Number.isInteger(Number(raw)) && Number(raw) >= minimum && Number(raw) <= 10;
      assert.equal(app.call('syncHandSeatSelectors').valid, expectedValid, `${collectionType}: ${raw}`);
      assert.equal(tableSize.value, raw, 'validation preserves what the user entered');
      assert.equal(start.disabled, !expectedValid);
      assert.equal(tableSize.getAttribute('aria-invalid'), String(!expectedValid));
      const spy = app.spy(['callPlaybookStateBridge']);
      let result;
      try {
        result = app.call('startCanonicalPlaybookHand');
      } finally {
        spy.restore();
      }
      const initializations = spy.calls.callPlaybookStateBridge.filter(([method]) => method === 'initializeHand').length;
      assert.equal(initializations, expectedValid ? 1 : 0, 'invalid input cannot reach canonical initialization');
      assert.equal(result?.players?.length ?? null, expectedValid ? Number(raw) : null);
      assert.equal(tableSize.value, raw, 'Start must not clamp invalid input either');
      if (expectedValid) {
        app.call('callPlaybookStateBridge', 'resetHand');
        app.call('resetCanonicalHandDraft');
        app.call('renderCanonicalHandWorkspace');
      }
    }
  }
  tableSize.value = '6';
  collection.value = 'none';
  app.call('syncHandSeatSelectors');
  assert.equal(markup.getElementById('handTableSizeError').getAttribute('role'), 'alert');
});

test('corrected table, history, Review, localization, bidi, and Daylight contracts are structural', () => {
  assert.doesNotMatch(RENDERER, /table-seat-connector|table-card-cradle/);
  assert.match(RENDERER, /data-card-lane="radial-felt"/);
  assert.match(RENDERER, /cardCenterDistance = Math\.max\([\s\S]*?seatVector\.radialExtent \+ cardRadialExtent \+ cardSeatGap,[\s\S]*?feltEntryDistance \+ 1/);
  assert.ok(markup.getElementById('handHistoryDisclosure').hasAttribute('open'));
  assert.ok(markup.getElementById('handHistorySelectionSummary'));
  const gto = markup.getElementById('gtoMode');
  gto.dataset.productDestination = 'hand';
  const history = markup.getElementById('handActionHistory');
  for (const variant of ['replay-timeline--compact', 'replay-timeline--review']) {
    history.className = `replay-timeline ${variant}`;
    assert.equal(css.cascaded(history, 'overflow-y'), 'auto', variant);
    assert.ok(css.cascaded(history, 'max-block-size'), variant);
  }
  gto.classList.add('is-hand-review-open');
  const surface = markup.getElementById('handReviewSurface');
  surface.dataset.reviewSource = 'canonical_hand';
  // Superseded: the three-column (decisions / detail / Replay rail) Review
  // grid became a two-column review with the rail beside it (later Hand
  // composition rule).
  assert.equal(css.cascaded(surface, 'grid-template-columns', { width: 1440 }), 'minmax(0, 1fr) minmax(320px, .43fr)');
  assert.ok(markup.getElementById('handReviewReplayRailMount'));
  assert.match(TRANSLATIONS, /'Hero': 'Игрок'/);
  assert.match(TRANSLATIONS, /'Hero': 'הירו'/);
  // Amounts are isolated LTR runs in RTL.
  const html = app.document.documentElement;
  assert.equal(app.call('formatCanonicalBb', 2500), '2.5 bb');
  html.dir = 'rtl';
  try {
    assert.equal(app.call('formatCanonicalBb', 2500), '⁦2.5 bb⁩');
  } finally {
    html.dir = 'ltr';
  }
  // Daylight gives Hand surfaces their own panel treatment.
  const root = markup.documentElement;
  const dock = markup.querySelector('.hand-replay-rail') || markup.querySelector('.hand-review-surface');
  root.dataset.theme = 'daylight';
  const daylight = css.cascaded(dock, 'background');
  root.dataset.theme = 'midnight';
  assert.equal(daylight, 'var(--surface-panel)');
  assert.notEqual(css.cascaded(dock, 'background'), daylight);
});
