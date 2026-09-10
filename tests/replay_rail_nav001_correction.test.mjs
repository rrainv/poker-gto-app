import test from 'node:test';
import { handSetupPositions } from '../app/src/application/table-presets.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { handSetupRulesDefinition } from '../app/src/application/hand-setup-rules.mjs';

import { ACTION_TYPES, PHASES } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';

const HTML = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const RENDERER = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
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

test('live controls are re-derived after Replay so legal Raise and exact-count board commits cannot stay disabled', () => {
  assert.match(LOGIC, /input\.disabled = false/);
  assert.match(LOGIC, /range\.disabled = false/);
  assert.match(LOGIC, /minimumPreset\.disabled = false/);
  assert.match(LOGIC, /maximumPreset\.disabled = false/);
  assert.match(LOGIC, /syncCanonicalSizedActionCommitState\(\)/);
  assert.match(LOGIC, /handDealBoardButton'\)\.disabled = normalizedDecisionCards\(app\.playbookHandDraft\.board\)\.length !== expected/);
  assert.match(LOGIC, /const expected = Number\(state\?\.pendingChance\?\.cardCount\) \|\| 0/);
});

test('Abort Hand is confirmed, clears only canonical live transients, and returns to setup', () => {
  assert.match(HTML, /id="handResetButton"[^>]*ui-button--danger-secondary[^>]*data-i18n="Abort hand"/);
  assert.match(LOGIC, /Abort this hand\? Unsaved current live progress will be discarded\. Saved hands and spots will not be changed\./);
  assert.match(LOGIC, /callPlaybookStateBridge\('resetHand'\)/);
  assert.match(LOGIC, /resetCanonicalHandDraft\(\)/);
  assert.match(LOGIC, /handSetupDisclosure'\)\?\.setAttribute\('open', ''\)/);
  assert.doesNotMatch(LOGIC.slice(LOGIC.indexOf('function resetCanonicalPlaybookHand('), LOGIC.indexOf('function prepareCanonicalNewHand(')), /savedStudy.*(?:delete|remove|clear)/i);
});

test('player-count validation preserves invalid input and blocks start instead of clamping', () => {
  for (const collectionType of ['none', 'fixed_per_seated_player']) {
    const minimum = handSetupRulesDefinition({ collectionType }).tableSize.minimumSeated;
    for (const raw of ['', '-1', '1', '2.5', '2', '6', '7', '10', '11']) {
      const controller = createCanonicalLiveController({ enabled: true });
      let initializations = 0;
      const controls = new Map(Object.entries({ handTableSize: raw, handCollectionType: collectionType,
        handStackBb: '100', handButtonSeat: '0', handHeroSeat: '0', handAnteType: 'none', handAnteBb: '0',
        handStartButton: '', handTableSizeError: '', handAccountingPreview: '',
      }).map(([id, value]) => [`#${id}`, { value, dataset: {}, attributes: {}, focus() {},
        setAttribute(key, next) { this.attributes[key] = next; } }]));
      const context = vm.createContext({
        $: id => controls.get(id), selectedValue: id => controls.get(id)?.value,
        t: text => text, formatCanonicalBb: amount => `${amount / 1000} bb`, toast() {}, clearToast() {},
        app: { handReview: { source: null } }, resetCanonicalHandDraft() {}, renderCanonicalHandWorkspace() {},
        callPlaybookStateBridge(method, ...args) {
          if (method === 'handSetupRulesDefinition') return handSetupRulesDefinition(...args);
          if (method === 'handSetupPositions') return handSetupPositions(...args);
          if (method === 'getState') return controller.getState();
          if (method === 'initializeHand') { initializations++; return controller.initialize(...args); }
          throw new Error(`Unexpected bridge call: ${method}`);
        },
      });
      vm.runInContext(LOGIC.slice(LOGIC.indexOf('function canonicalHandTableSizeValidation('),
        LOGIC.indexOf('function resetCanonicalHandDraft(')), context);
      vm.runInContext(LOGIC.slice(LOGIC.indexOf('function startCanonicalPlaybookHand('),
        LOGIC.indexOf('function resetCanonicalPlaybookHand(')), context);
      const expectedValid = raw !== '' && Number.isInteger(Number(raw)) && Number(raw) >= minimum && Number(raw) <= 10;
      assert.equal(context.syncHandSeatSelectors().valid, expectedValid, `${collectionType}: ${raw}`);
      assert.equal(controls.get('#handTableSize').value, raw, 'validation preserves what the user entered');
      assert.equal(controls.get('#handStartButton').disabled, !expectedValid);
      assert.equal(controls.get('#handTableSize').attributes['aria-invalid'], String(!expectedValid));
      const result = context.startCanonicalPlaybookHand();
      assert.equal(initializations, expectedValid ? 1 : 0, 'invalid input cannot reach canonical initialization');
      assert.equal(result?.players.length ?? null, expectedValid ? Number(raw) : null);
      assert.equal(controls.get('#handTableSize').value, raw, 'Start must not clamp invalid input either');
    }
  }
  assert.match(HTML, /id="handTableSizeError"[^>]*role="alert"/);
});

test('corrected table, history, Review, localization, bidi, and Daylight contracts are structural', () => {
  assert.doesNotMatch(RENDERER, /table-seat-connector|table-card-cradle/);
  assert.match(RENDERER, /data-card-lane="radial-felt"/);
  assert.match(RENDERER, /cardCenterDistance = Math\.max\([\s\S]*?seatVector\.radialExtent \+ cardRadialExtent \+ cardSeatGap,[\s\S]*?feltEntryDistance \+ 1/);
  assert.match(HTML, /id="handHistoryDisclosure"[^>]*open/);
  assert.match(HTML, /id="handHistorySelectionSummary"/);
  assert.match(CSS, /#handActionHistory:is\([\s\S]*?max-block-size:[\s\S]*?overflow-y: auto/);
  assert.match(CSS, /is-hand-review-open[\s\S]*?grid-template-columns: minmax\(190px, 220px\) minmax\(0, 1fr\) minmax\(250px, 280px\)/);
  assert.match(HTML, /id="handReviewReplayRailMount"/);
  assert.match(TRANSLATIONS, /'Hero': 'Игрок'/);
  assert.match(TRANSLATIONS, /'Hero': 'שחקן'/);
  assert.match(LOGIC, /document\.documentElement\.dir === 'rtl' \? `\\u2066\$\{amount\}\\u2069`/);
  assert.match(CSS, /\[data-theme="daylight"\] #gtoMode\[data-product-destination="hand"\]/);
});
