import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACTION_TYPES, GAME_MODES } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { createPlaybookScenarioInput } from '../app/src/application/playbook-state-source.mjs';
import { appStyleSheet, bootApp, indexDocument, precedes } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / logic.js / styles.css assertions are
// behavioural: parsed markup, the cascade, and the Hand flow in the booted app.
const app = await bootApp();
// Imported after boot: the bootstrap module graph self-installs page bridges.
const { installPlaybookStateSourceBridge } = await import('../app/src/application/playbook-mode-bootstrap.mjs');
const css = appStyleSheet();
const PRODUCT_TRANSLATIONS = fs.readFileSync(
  new URL('../app/src/locales/product-translations.js', import.meta.url),
  'utf8',
);

function scenario() {
  return createPlaybookScenarioInput({
    tableSize: 2,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Kd'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    lastActionLabel: 'Unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
}

function fakeWindow() {
  return {
    events: [],
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    dispatchEvent(event) {
      this.events.push(event);
      return true;
    },
  };
}

function createHandBridge(id = 'core-flow-hand', {
  tableSize = 2,
  heroSeat = 0,
  buttonSeat = 0,
} = {}) {
  const controller = createCanonicalLiveController({ enabled: true });
  const browserWindow = fakeWindow();
  const bridge = installPlaybookStateSourceBridge(browserWindow, {
    canonicalController: controller,
    handSourceIdFactory: () => id,
  });
  bridge.setMode('hand', scenario());
  const initial = bridge.initializeHand({
    tableSize,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroSeat,
    buttonSeat,
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  });
  return { bridge, controller, initial, browserWindow };
}

test('setup stays compact while private cards and actions share the table-adjacent Hand rail', async () => {
  const doc = indexDocument();
  const byId = (id) => doc.getElementById(id);
  const rail = doc.querySelector('.side-stack.playbook-context-rail');
  const setup = byId('handSetupDisclosure');
  const privateCards = byId('handDealSection');
  const table = byId('table-wrapper');
  const interaction = byId('handInteractionRail');
  const dock = byId('handStageDock');
  const action = byId('handActionSection');
  // Was: index offsets of the rail, setup, table, interaction rail, dock,
  // private-card and action sections. Protects: setup lives in the context
  // rail; the table follows the rail; the dock (with private cards, then
  // actions) follows the table-adjacent interaction rail.
  assert.equal(rail.tagName, 'ASIDE');
  assert.ok(precedes(rail, setup));
  assert.ok(precedes(rail, table) && !rail.contains(table) && precedes(table, interaction));
  assert.ok(precedes(interaction, dock) && precedes(dock, privateCards) && precedes(privateCards, action));
  assert.ok(dock.contains(privateCards), 'private cards stay inside the stage dock');
  for (const id of ['handSetupDisclosure', 'handDealSection', 'handActionSection']) {
    assert.equal(doc.querySelectorAll(`#${id}`).length, 1, `#${id} is unique`);
  }
  assert.equal(setup.hasAttribute('open'), true);
  assert.equal(byId('handHistoryDisclosure').hasAttribute('open'), true);
  assert.ok(byId('handHistorySelectionSummary'));
  assert.ok(byId('handHistoryDisclosureAction'));
  assert.ok(byId('handHistorySection').classList.contains('hand-replay-rail'));
  assert.equal(byId('handLiveStageHeader').hasAttribute('data-playbook-hand'), true);
  assert.equal(dock.hasAttribute('data-playbook-hand'), true);
  assert.equal(dock.getAttribute('data-tutorial-anchor'), 'hand-action-controls');

  // Was: the canonicalHandStageKey source. Protects: one stage resolver maps
  // canonical phase and pending chance onto the live stage.
  const stageKey = (state) => app.call('canonicalHandStageKey', state, null);
  assert.equal(stageKey(null), 'setup');
  assert.equal(stageKey({ phase: 'terminal' }), 'complete');
  assert.equal(stageKey({ phase: 'chance', pendingChance: { type: 'deal_hole' } }), 'private-cards');
  assert.equal(stageKey({ phase: 'chance', pendingChance: { type: 'deal_flop' } }), 'chance');
  assert.equal(stageKey({ phase: 'betting' }), 'action');

  // Was: `previousStage === 'setup' && stage !== 'setup') setCanonicalTableExpanded(true)`.
  // Protects: leaving setup expands the table.
  await app.navigate('hand');
  if (app.call('callPlaybookStateBridge', 'getState')) {
    app.call('callPlaybookStateBridge', 'resetHand');
    app.call('resetCanonicalHandDraft');
    app.call('renderCanonicalHandWorkspace');
  }
  assert.equal(app.byId('gtoMode').dataset.handStage, 'setup');
  app.call('setCanonicalTableExpanded', false);
  assert.ok(app.byId('table-wrapper').classList.contains('collapsed'));
  await app.click('#handStartButton');
  await app.settle(300);
  assert.equal(app.byId('gtoMode').dataset.handStage, 'private-cards');
  assert.equal(app.byId('table-wrapper').classList.contains('collapsed'), false);

  // Was: `completed.hidden = !terminal` ordered before the dock's visible-main-
  // stage query. Protects: at a terminal Hand the completed actions count as
  // the dock's main stage, so the dock stays shown.
  await app.pickCards('[data-card-set-edit="hand-seat-0"]', ['As', 'Kd']);
  await app.click('#handDealHoleButton');
  await app.settle(300);
  await app.handAction('fold');
  assert.equal(app.byId('gtoMode').dataset.handStage, 'complete');
  assert.equal(app.byId('handCompletedSection').hidden, false);
  assert.equal(app.byId('handActionSection').hidden, true);
  assert.equal(app.byId('handStageDock').hidden, false);
});

test('canonical phase and actor transitions supply the live table stage without a second state authority', () => {
  const { bridge, controller, initial } = createHandBridge('core-flow-progression');
  assert.equal(initial.pendingChance.type, 'deal_hole');
  assert.equal(bridge.createTablePresenceViewModel().status, 'awaiting_private_cards');

  const dealt = bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  assert.equal(dealt.phase, 'betting');
  assert.equal(dealt.actingPlayerId, controller.getHeroPlayerId());
  assert.equal(bridge.createTablePresenceViewModel().status, 'active');
  assert.equal(bridge.getLegalActions().playerId, dealt.actingPlayerId);

  const called = bridge.applyAction(ACTION_TYPES.CALL);
  assert.equal(called.phase, 'betting');
  assert.notEqual(called.actingPlayerId, controller.getHeroPlayerId());
  assert.equal(bridge.getLegalActions().playerId, called.actingPlayerId);

  const chance = bridge.applyAction(ACTION_TYPES.CHECK);
  assert.equal(chance.phase, 'chance');
  assert.equal(chance.pendingChance.type, 'deal_flop');
  assert.equal(bridge.getLegalActions(), null);
  assert.equal(bridge.createTablePresenceViewModel().status, 'awaiting_board');
});

test('three-player Hand action context follows Hero, SB, and BB actors with each stack behind', () => {
  const { bridge, controller } = createHandBridge('actor-relative-three-player', {
    tableSize: 3,
    heroSeat: 0,
    buttonSeat: 0,
  });
  let state = bridge.dealObservedHoleCards({
    [controller.getHeroPlayerId()]: ['As', 'Kd'],
  });
  const contexts = [];
  const capture = () => {
    const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
    contexts.push({
      playerId: actor.playerId,
      position: actor.position,
      stackMilliBb: actor.currentStackMilliBb,
      legalPlayerId: bridge.getLegalActions().playerId,
    });
    // Was: renderCanonicalLegalActions source (actorLabel + Stack, actor stack).
    // Protects: the dock names the acting player and shows that actor's stack.
    app.call('renderCanonicalLegalActions', state, bridge.getLegalActions());
    const pageHeroId = app.call('callPlaybookStateBridge', 'getHeroPlayerId');
    const actorLabel = app.call('canonicalPlayerLabel', actor, pageHeroId);
    rendered.push({
      stackLabel: app.byId('handActionStackLabel').textContent,
      expectedStackLabel: `${actorLabel} · ${app.call('t', 'Stack')}`,
      stack: app.byId('handActionHeroStack').textContent,
      expectedStack: app.call('formatCanonicalBb', actor.currentStackMilliBb),
    });
  };
  const rendered = [];

  capture();
  state = bridge.applyAction(ACTION_TYPES.CALL);
  capture();
  state = bridge.applyAction(ACTION_TYPES.CALL);
  capture();
  state = bridge.applyAction(ACTION_TYPES.CHECK);

  assert.deepEqual(contexts.map(({ position }) => position), ['BTN', 'SB', 'BB']);
  assert.deepEqual(contexts.map(({ stackMilliBb }) => stackMilliBb), [100_000, 99_500, 99_000]);
  assert.equal(contexts[0].playerId, controller.getHeroPlayerId());
  assert.equal(contexts.every(({ playerId, legalPlayerId }) => playerId === legalPlayerId), true);
  assert.equal(state.phase, 'chance');

  for (const entry of rendered) {
    assert.equal(entry.stackLabel, entry.expectedStackLabel);
    assert.equal(entry.stack, entry.expectedStack);
  }
  // The SB and BB stacks differ from Hero's: the dock never shows Hero's stack
  // for another actor.
  assert.notEqual(rendered[1].stack, rendered[0].stack);
  assert.notEqual(rendered[2].stack, rendered[0].stack);
  assert.equal(indexDocument().querySelector('[aria-label="Hero decision context"]'), null);
  app.call('renderCanonicalHandWorkspace');
});

test('action dock renders only canonical legal options and keeps amount-to presets plus custom sizing', async () => {
  const { bridge, controller } = createHandBridge('core-flow-sizing');
  bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  const spec = bridge.getLegalActions();
  assert.equal(spec.call.available, true);
  assert.equal(spec.call.commitMilliBb, 500);
  assert.equal(spec.raise.available, true);
  assert.equal(spec.raise.minToMilliBb, 2_000);
  assert.equal(spec.raise.maxToMilliBb, 99_900);
  const raised = bridge.applyAction(ACTION_TYPES.RAISE, spec.raise.minToMilliBb / 1000);
  assert.equal(raised.currentBetMilliBb, spec.raise.minToMilliBb);
  assert.equal(raised.actionHistory.at(-1).submittedAction.amountToMilliBb, spec.raise.minToMilliBb);

  // Was: renderCanonicalLegalActions / chooseCanonicalSizedAction source and
  // the sizing markup. Protects: legal options render in fold, check, call,
  // bet, raise, all-in order and only when available; Bet/Raise open sizing
  // with spec-only bounds and min/max amount-to presets; committing submits
  // the typed amount-to through the bridge.
  await app.startHand(['As', 'Kd']);
  const pageSpec = app.call('callPlaybookStateBridge', 'getLegalActions');
  const order = ['fold', 'check', 'call', 'bet', 'raise', 'all_in'];
  const specKey = { all_in: 'allIn' };
  const renderedTypes = () => app.$$('#handLegalActions [data-canonical-action]')
    .map((button) => button.dataset.canonicalAction);
  assert.deepEqual(renderedTypes(), order.filter((type) => pageSpec[specKey[type] || type]?.available));

  const pageState = app.call('callPlaybookStateBridge', 'getState');
  const unavailable = { available: false };
  const customSpec = {
    playerId: pageSpec.playerId,
    fold: unavailable,
    check: { available: true },
    call: { available: false, commitMilliBb: 0 },
    bet: { available: true, minToMilliBb: 3_300, maxToMilliBb: 7_700 },
    raise: unavailable,
    allIn: { available: true, amountToMilliBb: 99_000 },
  };
  app.call('renderCanonicalLegalActions', pageState, customSpec);
  assert.deepEqual(renderedTypes(), ['check', 'bet', 'all_in']);
  const sized = app.spy(['chooseCanonicalSizedAction']);
  await app.click('#handLegalActions [data-canonical-action="bet"]');
  assert.equal(sized.count('chooseCanonicalSizedAction'), 1);
  sized.restore();
  // Bounds come from the spec alone (3.3-7.7 has no pot/stack relation).
  assert.equal(app.byId('handActionAmountBb').min, '3.3');
  assert.equal(app.byId('handActionAmountBb').max, '7.7');
  assert.equal(app.byId('handSizingMinPreset').dataset.amountToBb, '3.3');
  assert.equal(app.byId('handSizingMaxPreset').dataset.amountToBb, '7.7');
  app.call('resetCanonicalHandDraft');
  app.call('renderCanonicalHandWorkspace');

  await app.click('#handLegalActions [data-canonical-action="raise"]');
  const min = pageSpec.raise.minToMilliBb / 1000;
  const max = pageSpec.raise.maxToMilliBb / 1000;
  assert.equal(app.byId('handSizingMinPreset').dataset.amountToBb, String(min));
  assert.equal(app.byId('handSizingMaxPreset').dataset.amountToBb, String(max));
  await app.click('#handSizingMaxPreset');
  assert.equal(app.byId('handActionAmountBb').value, String(max));
  await app.click('#handSizingMinPreset');
  assert.equal(app.byId('handActionAmountBb').value, String(min));
  const bridgeCalls = app.spy(['callPlaybookStateBridge']);
  await app.click('#handCommitSizedAction');
  await app.settle(300);
  bridgeCalls.restore();
  assert.deepEqual(
    bridgeCalls.calls.callPlaybookStateBridge.filter(([name]) => name === 'applyAction'),
    [['applyAction', 'raise', min]],
  );
  assert.equal(app.call('callPlaybookStateBridge', 'getState').currentBetMilliBb, pageSpec.raise.minToMilliBb);

  const doc = indexDocument();
  assert.equal(doc.getElementById('handSizingMinPreset').getAttribute('data-hand-sizing-preset'), 'min');
  assert.equal(doc.getElementById('handSizingMaxPreset').getAttribute('data-hand-sizing-preset'), 'max');
  assert.equal(doc.getElementById('handActionAmountBb').getAttribute('type'), 'number');
});

test('leaving, returning, and repeated mode switches preserve the exact canonical Hand and controller', async () => {
  const { bridge, controller } = createHandBridge('core-flow-lifecycle');
  bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  const handBeforeLeave = controller.getState();
  const sourceId = bridge.getCanonicalHandSourceId();
  const journalBeforeLeave = controller.getHeroDecisionJournal();

  for (let index = 0; index < 5; index += 1) {
    bridge.setMode('scenario');
    assert.strictEqual(controller.getState(), handBeforeLeave);
    bridge.setMode('hand', scenario());
    assert.strictEqual(controller.getState(), handBeforeLeave);
    assert.equal(bridge.getCanonicalHandSourceId(), sourceId);
  }

  assert.deepEqual(controller.getHeroDecisionJournal(), journalBeforeLeave);
  // Was: logic.js never names installPlaybookStateSourceBridge, calls
  // renderCanonicalHandWorkspace, and the stage renderer never creates a
  // controller or initializes a Hand. Protects: the page has one bridge,
  // and leaving/returning to Hand re-renders without re-initializing it.
  assert.equal(app.evaluate('typeof installPlaybookStateSourceBridge'), 'undefined');
  await app.startHand(['As', 'Kd']);
  const pageHand = app.call('callPlaybookStateBridge', 'getState');
  const pageSourceId = app.call('callPlaybookStateBridge', 'getCanonicalHandSourceId');
  assert.ok(pageHand && pageSourceId);
  const probe = app.spy(['callPlaybookStateBridge', 'renderCanonicalHandWorkspace']);
  for (let index = 0; index < 3; index += 1) {
    await app.navigate('analyze');
    await app.navigate('hand');
  }
  app.call('renderCanonicalHandStage', pageHand, null, null);
  probe.restore();
  assert.ok(probe.count('renderCanonicalHandWorkspace') > 0, 'returning to Hand re-renders the workspace');
  assert.deepEqual(
    probe.calls.callPlaybookStateBridge.filter(([name]) => name === 'initializeHand' || name === 'resetHand'),
    [],
  );
  assert.ok(app.call('callPlaybookStateBridge', 'getState') === pageHand);
  assert.equal(app.call('callPlaybookStateBridge', 'getCanonicalHandSourceId'), pageSourceId);
});

test('completion exposes Review, Analysis, Replay, and Save through existing bounded handoffs', async () => {
  const { bridge, controller } = createHandBridge('core-flow-complete');
  bridge.dealObservedHoleCards({ [controller.getHeroPlayerId()]: ['As', 'Kd'] });
  const terminal = bridge.applyAction(ACTION_TYPES.FOLD);
  assert.equal(terminal.phase, 'terminal');
  assert.equal(bridge.getCompletedHandResult().handId, 'core-flow-complete');
  assert.equal(bridge.getHeroDecisionJournal().decisions.length, 1);
  assert.equal(bridge.createReplayProjectionViewModel().canPlayback, true);

  // Was: button markup plus logic.js handler source. Protects: the four
  // completion actions are plain buttons and hand off to the existing Replay,
  // Analysis (completed-Hand Hero decision) and canonical Save paths.
  const doc = indexDocument();
  for (const id of [
    'handCompletedReviewButton',
    'handCompletedAnalysisButton',
    'handCompletedReplayButton',
    'handCompletedSaveButton',
  ]) {
    assert.equal(doc.getElementById(id).getAttribute('type'), 'button', `#${id} is type=button`);
  }

  await app.startHand(['As', 'Kd']);
  await app.handAction('fold');
  assert.equal(app.byId('handCompletedSection').hidden, false);

  let canonicalSaveClicks = 0;
  const countSave = () => { canonicalSaveClicks += 1; };
  app.byId('savedStudySaveButton').addEventListener('click', countSave);
  await app.click('#handCompletedSaveButton');
  app.byId('savedStudySaveButton').removeEventListener('click', countSave);
  assert.equal(canonicalSaveClicks, 1);

  const replay = app.spy(['revealCanonicalHandHistory', 'callPlaybookStateBridge']);
  await app.click('#handCompletedReplayButton');
  replay.restore();
  assert.deepEqual(replay.calls.revealCanonicalHandHistory, [[{ replay: true }]]);
  assert.ok(replay.calls.callPlaybookStateBridge.some(([name]) => name === 'startReplayPlayback'));
  app.call('callPlaybookStateBridge', 'cancelReplayPlayback');
  // Replay hides the completion card; leaving Replay restores it.
  assert.equal(app.isShown(app.byId('handCompletedSection')), false, 'Replay replaces the completion card');
  await app.click('#handReplayLiveButton');
  assert.equal(app.isShown(app.byId('handCompletedSection')), true, 'leaving Replay restores the completion card');

  const journal = app.call('callPlaybookStateBridge', 'getHeroDecisionJournal');
  const analysis = app.spy(['scenarioInputFromHeroDecisionRecord', 'updateContext']);
  await app.click('#handCompletedAnalysisButton');
  await app.settle(300);
  analysis.restore();
  assert.equal(analysis.count('scenarioInputFromHeroDecisionRecord'), 1);
  assert.ok(analysis.calls.scenarioInputFromHeroDecisionRecord[0][0] === journal.decisions.at(-1));
  assert.equal(
    analysis.calls.updateContext.find(([, resolution]) => resolution?.reason === 'completed_hand_hero_decision')?.[1]?.status,
    'available',
  );
});

test('desktop hierarchy, localization, RTL, and secondary disclosures remain structural', async () => {
  await app.startHand(['As', 'Kd']);
  const gtoMode = app.byId('gtoMode');
  assert.equal(gtoMode.dataset.handStage, 'action');
  const workspace = app.$('#gtoMode .playbook-workspace');
  const rail = app.$('#gtoMode .playbook-context-rail');
  const decision = app.$('#gtoMode .playbook-decision-workspace');
  const note = app.$('#gtoMode .playbook-hand-head .panel-note');
  assert.ok(note, 'the Hand head has a panel note');

  // Was: the CORE-FLOW-001B block comment and the live-stage workspace rule.
  // Protects: a non-setup Hand stage compacts the Hand head; setup does not.
  assert.equal(css.cascaded(note, 'display', { width: 1920 }), 'none');
  gtoMode.dataset.handStage = 'setup';
  assert.notEqual(css.cascaded(note, 'display', { width: 1920 }), 'none');
  gtoMode.dataset.handStage = 'action';

  // Was: ≤1100px decision workspace order 1, context rail order 2.
  // Protects: on narrow layouts the live decision comes before the rail.
  assert.equal(css.cascaded(decision, 'order', { width: 1100 }), '1');
  assert.equal(css.cascaded(rail, 'order', { width: 1100 }), '2');

  // SOURCE-SHAPE: the private-cards (and reveal) stage override that puts
  // the rail first at ≤1100px is declared but loses the cascade to the more
  // specific generic live-stage rule ([1,4,0] over [1,3,0]); asserting the
  // effective order would lock in that defect (register TEST-HYGIENE-001-F04).
  for (const [selector, order] of [
    ['#gtoMode[data-product-destination="hand"][data-hand-stage="private-cards"] .playbook-context-rail', '1'],
    ['#gtoMode[data-product-destination="hand"][data-hand-stage="private-cards"] .playbook-decision-workspace', '2'],
  ]) {
    assert.equal(css.declared(selector, 'order', { width: 1100 }), order);
  }

  // Was: [dir="rtl"] .hand-live-stage-header / .hand-stage-dock rules.
  // Protects: the current-stage accent edge flips to the inline start in RTL.
  const header = app.byId('handLiveStageHeader');
  const step = app.$('#handStageDock .is-current-hand-step');
  assert.ok(step, 'the dock marks the current Hand step');
  const html = app.document.documentElement;
  const previousDir = html.getAttribute('dir');
  try {
    html.setAttribute('dir', 'ltr');
    assert.match(css.cascaded(header, 'box-shadow'), /^inset 3px 0 0 /);
    html.setAttribute('dir', 'rtl');
    assert.match(css.cascaded(header, 'box-shadow'), /^inset -3px 0 0 /);
    assert.ok(
      css.matchingRules(step).some((rule) => rule.selectors.includes('[dir="rtl"] .hand-stage-dock .is-current-hand-step')),
      'the RTL current-step rule applies in RTL',
    );
  } finally {
    if (previousDir === null) html.removeAttribute('dir');
    else html.setAttribute('dir', previousDir);
  }

  // Was: .hand-disclosure > summary / .hand-inline-disclosure > summary rules.
  // Protects: both disclosure summaries in the page are styled.
  for (const selector of ['.hand-disclosure > summary', '.hand-inline-disclosure > summary']) {
    const summary = app.$(selector);
    assert.ok(summary, `${selector} exists`);
    assert.ok(css.matchingRules(summary).some((rule) => rule.selectors.includes(selector)), `${selector} is styled`);
  }

  for (const key of [
    'Hand setup',
    'Current hand stage',
    'Hand table',
    'Current legal actions',
    'Custom size',
    'Hand complete',
    'End hand',
    'Hero to act',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(PRODUCT_TRANSLATIONS, new RegExp(`Object\\.assign\\(ru,[\\s\\S]*?"${escaped}"`));
    assert.match(PRODUCT_TRANSLATIONS, new RegExp(`Object\\.assign\\(he,[\\s\\S]*?"${escaped}"`));
  }
});
