import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

import { ACTION_TYPES, GAME_MODES } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import {
  PLAYBOOK_MODES,
  createPlaybookModeController,
  createPlaybookScenarioInput,
  createPlaybookViewModel,
  handModeCompatibility,
  resolvePlaybookDecisionContext,
} from '../app/src/application/playbook-state-source.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';

const require = createRequire(import.meta.url);
const legacy = require('./qa002_adapters.js');
const LOGIC = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const HTML = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const HARNESS_BOOTSTRAP = fs.readFileSync(
  new URL('../app/src/application/canonical-live-bootstrap.mjs', import.meta.url),
  'utf8',
);
const PRODUCT_BOOTSTRAP = fs.readFileSync(
  new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);

const CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);

function scenario(overrides = {}) {
  return createPlaybookScenarioInput({
    tableSize: 2,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Ad'],
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
    legacyRakePercent: 0,
    legacyRakeValue: 0,
    anteBb: 0,
    straddleBb: 0,
    ...overrides,
  });
}

function configuration(overrides = {}) {
  return {
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroPosition: 'BTN',
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
    buttonSeat: 0,
    ...overrides,
  };
}

function controllerWithCards(overrides = {}) {
  const controller = createCanonicalLiveController({ enabled: true });
  assert.ok(controller.initialize(configuration(overrides)));
  const state = controller.getState();
  const cardsByPlayer = Object.fromEntries(
    state.players.map((player, index) => [player.playerId, CARDS[index]]),
  );
  assert.ok(controller.dealHoleCards(cardsByPlayer));
  return controller;
}

function projectedScenario(context, overrides = {}) {
  return scenario({
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    street: context.street,
    heroCards: context.heroCards,
    board: context.board,
    deadCards: context.deadCards,
    stackBb: context.stackBb,
    stackMode: context.stackMode,
    potBb: context.potBb,
    lastAction: context.lastAction,
    facingSizeBb: context.facingSizeBb,
    rakeMode: context.rakeMode,
    forcedContributionPerPlayerBb: context.forcedContributionPerPlayerBb,
    totalForcedContributionBb: context.totalForcedContributionBb,
    legacyRakePercent: context.legacyRakePercent,
    legacyRakeValue: context.legacyRakePercent,
    ...overrides,
  });
}

function resolveScenario(input) {
  return resolvePlaybookDecisionContext({
    mode: PLAYBOOK_MODES.SCENARIO,
    scenarioInput: input,
    deriveScenarioDecisionContext: legacy.deriveDecisionContext,
  });
}

function resolveHand(controller) {
  return resolvePlaybookDecisionContext({
    mode: PLAYBOOK_MODES.HAND,
    canonicalSession: controller,
    heroPlayerId: controller.getHeroPlayerId(),
    projectionOptions: controller.getProjectionOptions(),
  });
}

test('ScenarioInput is versioned, immutable, DOM-free, and intentionally application-level', () => {
  const cards = ['As', 'Kd'];
  const input = scenario({ heroCards: cards, potBb: 42.75, facingSizeBb: 11.25 });
  cards[0] = '2c';
  assert.equal(input.schemaVersion, 'playbook-scenario/v1');
  assert.deepEqual(input.heroCards, ['As', 'Kd']);
  assert.equal(input.potBb, 42.75);
  assert.equal(input.facingSizeBb, 11.25);
  assert.equal(Object.isFrozen(input), true);
  assert.equal(Object.isFrozen(input.heroCards), true);
  assert.equal('players' in input, false);
  assert.equal('actionHistory' in input, false);
});

test('Scenario mode preserves manual pot, facing, action, cards, stack mode, and legacy inputs', () => {
  const input = scenario({
    tableSize: 10,
    heroPosition: 'LJ',
    heroCards: ['Qc', 'Jc'],
    board: ['2s', '7d', 'Th'],
    deadCards: ['As'],
    stackMode: 'custom',
    potBb: 37.5,
    lastAction: 'raise',
    facingSizeBb: 14,
    rakeMode: 'percent',
    legacyRakeValue: 4.5,
    straddleBb: 2,
  });
  const result = resolveScenario(input);
  assert.equal(result.status, 'available');
  assert.deepEqual({
    tableSize: result.decisionContext.tableSize,
    heroPosition: result.decisionContext.heroPosition,
    heroCards: result.decisionContext.heroCards,
    board: result.decisionContext.board,
    deadCards: result.decisionContext.deadCards,
    stackMode: result.decisionContext.stackMode,
    potBb: result.decisionContext.potBb,
    lastAction: result.decisionContext.lastAction,
    facingSizeBb: result.decisionContext.facingSizeBb,
    legacyRakePercent: result.decisionContext.legacyRakePercent,
  }, {
    tableSize: 10,
    heroPosition: 'LJ',
    heroCards: ['Qc', 'Jc'],
    board: ['2s', '7d', 'Th'],
    deadCards: ['As'],
    stackMode: 'custom',
    potBb: 37.5,
    lastAction: 'raise',
    facingSizeBb: 14,
    legacyRakePercent: 4.5,
  });
  assert.equal(input.straddleBb, 2);
});

test('mode controller defaults to Scenario and changes only through explicit modes', () => {
  const modes = createPlaybookModeController();
  assert.equal(modes.getMode(), 'scenario');
  assert.equal(modes.setMode('hand', scenario()).mode, 'hand');
  assert.equal(modes.getMode(), 'hand');
  assert.equal(modes.setMode('scenario').mode, 'scenario');
  assert.equal(modes.setMode('invented').status, 'error');
  assert.equal(modes.getMode(), 'scenario');
});

test('mode switching preserves the Scenario snapshot and canonical session independently', () => {
  const canonicalController = controllerWithCards();
  const modes = createPlaybookModeController({ canonicalController });
  const manual = scenario({ potBb: 27, lastAction: '3bet', facingSizeBb: 9 });
  modes.resolve({ scenarioInput: manual, deriveScenarioDecisionContext: legacy.deriveDecisionContext });
  const handState = canonicalController.getState();
  modes.setMode('hand', manual);
  modes.resolve({
    scenarioInput: scenario({ potBb: 99, lastAction: 'raise', facingSizeBb: 50 }),
    deriveScenarioDecisionContext: legacy.deriveDecisionContext,
  });
  modes.setMode('scenario');
  assert.deepEqual(modes.getLastScenarioInput(), manual);
  assert.equal(canonicalController.getState(), handState);
});

test('Hand mode rejects percentage, cap, straddle, and undersized ClubGG configuration', () => {
  assert.equal(handModeCompatibility(scenario({ rakeMode: 'percent' })).reason,
    'unsupported_canonical_rake_mode');
  assert.equal(handModeCompatibility(scenario({ rakeMode: 'cap' })).reason,
    'unsupported_canonical_rake_mode');
  assert.equal(handModeCompatibility(scenario({ straddleBb: 2 })).reason,
    'canonical_straddle_unsupported');
  assert.equal(handModeCompatibility(scenario({ rakeMode: 'fixed', tableSize: 6 })).reason,
    'clubgg_requires_7_to_10_players');
});

test('Hand resolver requires a real initialized canonical session and never falls back', () => {
  const result = resolvePlaybookDecisionContext({
    mode: 'hand',
    scenarioInput: scenario({ potBb: 99, heroCards: ['As', 'Ad'] }),
  });
  assert.deepEqual({ status: result.status, reason: result.reason, context: result.decisionContext }, {
    status: 'unavailable',
    reason: 'canonical_session_not_initialized',
    context: null,
  });
});

test('Hand resolver requires betting phase, known hero cards, and hero as current actor', () => {
  const empty = createCanonicalLiveController({ enabled: true });
  empty.initialize(configuration());
  assert.equal(resolveHand(empty).reason, 'canonical_chance_state');

  const otherActor = controllerWithCards({ heroPosition: 'BB' });
  assert.equal(resolveHand(otherActor).reason, 'canonical_hero_not_actor');
});

test('Hand Home context derives position, pot, facing, and cards from PokerState', () => {
  const controller = controllerWithCards();
  const initial = resolveHand(controller);
  assert.equal(initial.status, 'available');
  assert.deepEqual({
    position: initial.decisionContext.heroPosition,
    pot: initial.decisionContext.potBb,
    facing: initial.decisionContext.facingSizeBb,
    cards: initial.decisionContext.heroCards,
    rake: initial.decisionContext.rakeMode,
  }, { position: 'BTN', pot: 1.5, facing: 0, cards: ['As', 'Ad'], rake: 'off' });

  controller.applyAction({ type: ACTION_TYPES.RAISE, amountToBb: 2.5 });
  const bbController = controller;
  assert.equal(bbController.getState().potMilliBb, 3500);
});

test('Hand ClubGG uses canonical 0.1bb per seated player outside the pot', () => {
  const controller = controllerWithCards({
    tableSize: 7,
    gameMode: GAME_MODES.CLUBGG,
    heroPosition: 'UTG',
  });
  const result = resolveHand(controller);
  assert.equal(result.status, 'available');
  assert.equal(result.decisionContext.rakeMode, 'fixed');
  assert.equal(result.decisionContext.forcedContributionPerPlayerBb, 0.1);
  assert.equal(result.decisionContext.totalForcedContributionBb, 0.7);
  assert.equal(result.decisionContext.legacyRakePercent, 0);
  assert.equal(result.decisionContext.potBb, 1.5);
});

test('equivalent HU unopened Scenario and Hand contexts produce identical StrategyResult', () => {
  const hand = resolveHand(controllerWithCards());
  const manual = resolveScenario(projectedScenario(hand.decisionContext));
  assert.deepEqual(manual.decisionContext, hand.decisionContext);
  const scenarioResult = legacy.strategyResult(manual.decisionContext);
  const handResult = legacy.strategyResult(hand.decisionContext);
  assert.deepEqual(scenarioResult, handResult);
  assert.equal(handResult.source, 'heuristic_preflop');
});

test('equivalent six-max unopened and open-raise contexts preserve strategy parity', () => {
  const controller = controllerWithCards({ tableSize: 6, heroPosition: 'BTN' });
  while (controller.getState().actingPlayerId !== controller.getHeroPlayerId()) {
    controller.applyAction({ type: ACTION_TYPES.FOLD });
  }
  const unopened = resolveHand(controller);
  assert.equal(unopened.decisionContext.lastAction, 'unopened');
  assert.deepEqual(
    legacy.strategyResult(resolveScenario(projectedScenario(unopened.decisionContext)).decisionContext),
    legacy.strategyResult(unopened.decisionContext),
  );

  controller.applyAction({ type: ACTION_TYPES.RAISE, amountToBb: 2.5 });
  const nextActor = controller.getState().actingPlayerId;
  const nextHero = controller.getState().players.find((player) => player.playerId === nextActor);
  const raisedContext = resolvePlaybookDecisionContext({
    mode: 'hand', canonicalSession: controller, heroPlayerId: nextHero.playerId,
    projectionOptions: controller.getProjectionOptions(),
  });
  assert.equal(raisedContext.decisionContext.lastAction, 'raise');
  assert.deepEqual(
    legacy.strategyResult(resolveScenario(projectedScenario(raisedContext.decisionContext)).decisionContext),
    legacy.strategyResult(raisedContext.decisionContext),
  );
});

test('equivalent 3-bet and BB-after-limps compatibility contexts preserve parity', () => {
  const raised = controllerWithCards();
  raised.applyAction({ type: ACTION_TYPES.RAISE, amountToBb: 2.5 });
  raised.applyAction({ type: ACTION_TYPES.RAISE, amountToBb: 7.5 });
  const actor = raised.getState().actingPlayerId;
  const threeBet = resolvePlaybookDecisionContext({
    mode: 'hand', canonicalSession: raised, heroPlayerId: actor,
    projectionOptions: raised.getProjectionOptions(),
  });
  assert.equal(threeBet.decisionContext.lastAction, '3bet');
  const manualThreeBet = resolveScenario(projectedScenario(threeBet.decisionContext));
  assert.deepEqual(manualThreeBet.decisionContext, threeBet.decisionContext);
  assert.deepEqual(legacy.strategyResult(manualThreeBet.decisionContext),
    legacy.strategyResult(threeBet.decisionContext));

  const limped = controllerWithCards({ tableSize: 3, heroPosition: 'BB' });
  limped.applyAction({ type: ACTION_TYPES.CALL });
  limped.applyAction({ type: ACTION_TYPES.CALL });
  const option = resolveHand(limped);
  assert.equal(option.decisionContext.lastAction, 'check');
  assert.equal(option.decisionContext.facingSizeBb, 0);
  const manualOption = resolveScenario(projectedScenario(option.decisionContext));
  assert.deepEqual(manualOption.decisionContext, option.decisionContext);
  assert.deepEqual(legacy.strategyResult(manualOption.decisionContext),
    legacy.strategyResult(option.decisionContext));
});

test('equivalent flop-first-action and facing-bet contexts preserve postflop parity', () => {
  const controller = controllerWithCards({ heroPosition: 'BB' });
  controller.applyAction({ type: ACTION_TYPES.CALL });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.dealBoardCards(['2c', '3d', '4s']);
  const flop = resolveHand(controller);
  assert.equal(flop.decisionContext.street, 'flop');
  assert.deepEqual(
    legacy.strategyResult(resolveScenario(projectedScenario(flop.decisionContext)).decisionContext),
    legacy.strategyResult(flop.decisionContext),
  );

  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.BET, amountToBb: 2 });
  const facingBet = resolveHand(controller);
  assert.equal(facingBet.decisionContext.lastAction, 'bet');
  assert.equal(facingBet.decisionContext.facingSizeBb, 2);
  assert.deepEqual(
    legacy.strategyResult(resolveScenario(projectedScenario(facingBet.decisionContext)).decisionContext),
    legacy.strategyResult(facingBet.decisionContext),
  );
});

test('equivalent ClubGG Scenario and Hand context keeps honest heuristic provenance', () => {
  const hand = resolveHand(controllerWithCards({
    tableSize: 7, gameMode: GAME_MODES.CLUBGG, heroPosition: 'UTG',
  }));
  const manual = resolveScenario(projectedScenario(hand.decisionContext));
  const result = legacy.strategyResult(hand.decisionContext);
  assert.deepEqual(manual.decisionContext, hand.decisionContext);
  assert.deepEqual(legacy.strategyResult(manual.decisionContext), result);
  assert.equal(result.source, 'heuristic_preflop');
  assert.doesNotMatch(result.source, /gto|cfr|solver/i);
});

test('Playbook view model exposes mode, availability, context, result, and provenance', () => {
  const current = resolveScenario(scenario());
  const strategyResult = legacy.strategyResult(current.decisionContext);
  const view = createPlaybookViewModel({ resolution: current, strategyResult });
  assert.equal(view.schemaVersion, 'playbook-view-model/v1');
  assert.equal(view.mode, 'scenario');
  assert.equal(view.status, 'available');
  assert.equal(view.decisionContext.schemaVersion, 'decision-context/v1');
  assert.equal(view.strategyResult.schemaVersion, 'strategy-result/v1');
  assert.equal(view.source, strategyResult.source);
  assert.equal(Object.isFrozen(view), true);
});

test('product browser bridge owns a separate persistent canonical controller and publishes changes', () => {
  const events = [];
  const fakeWindow = {
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    dispatchEvent(event) { events.push(event); },
  };
  const bridge = installPlaybookStateSourceBridge(fakeWindow);
  assert.equal(bridge.getMode(), 'scenario');
  assert.equal(bridge.setMode('hand', scenario()).mode, 'hand');
  assert.ok(bridge.initializeHand(configuration()));
  const state = bridge.getState();
  assert.ok(bridge.dealHoleCards(Object.fromEntries(
    state.players.map((player, index) => [player.playerId, CARDS[index]]),
  )));
  const preserved = bridge.getState();
  bridge.setMode('scenario', scenario({ potBb: 25 }));
  bridge.setMode('hand', scenario());
  assert.equal(bridge.getState(), preserved);
  assert.deepEqual(events.map((event) => event.detail.operation),
    ['mode', 'initialize_hand', 'deal_hole', 'mode', 'mode']);
});

test('mode UI defaults to Scenario, is semantic, keyboard-native, and does not persist mode', () => {
  assert.match(HTML, /id="playbookModeControl"[^>]+role="group"[^>]+aria-label=/);
  assert.match(HTML, /id="playbookScenarioMode"[^>]+type="button"[^>]+aria-pressed="true"/);
  assert.match(HTML, /id="playbookHandMode"[^>]+type="button"[^>]+aria-pressed="false"/);
  assert.match(HTML, /id="playbookModeStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.doesNotMatch(`${LOGIC}\n${PRODUCT_BOOTSTRAP}`, /localStorage\.(getItem|setItem)\([^)]*playbookMode/i);
});

test('Hand presentation is one-way, disables scenario facts, and guards direct card edits', () => {
  assert.match(LOGIC, /PLAYBOOK_SCENARIO_CONTROL_IDS[\s\S]+control\.disabled = handMode/);
  assert.match(LOGIC, /data-playbook-canonical-display disabled/);
  assert.match(LOGIC, /isHandMode\(\)[\s\S]+PLAYBOOK_DECISION_CARD_GROUPS\.includes\(group\)/);
  assert.match(LOGIC, /savedPlaybookScenarioPresentation = capturePlaybookScenarioPresentation\(\)/);
  assert.match(LOGIC, /restorePlaybookScenarioPresentation\(savedPlaybookScenarioPresentation\)/);
  assert.doesNotMatch(PRODUCT_BOOTSTRAP, /setHeroHoleCards|setBoardCards|groupCards/);
});

test('both modes converge on one actionProfile and StrategyResult rendering path', () => {
  const updateStart = LOGIC.indexOf("async function updateContext(reason = 'Context updated')");
  const updateEnd = LOGIC.indexOf('// Legacy fast evaluator retained for Playbook heuristics', updateStart);
  assert.ok(updateEnd > updateStart);
  const update = LOGIC.slice(updateStart, updateEnd);
  assert.equal((update.match(/actionProfile\(null, decisionContext\)/g) || []).length, 1);
  assert.equal((update.match(/strategyResultToLegacyProfile\(strategyResult\)/g) || []).length, 1);
  assert.doesNotMatch(LOGIC, /scenarioActionProfile|handActionProfile/);
  assert.match(update, /playbookResolution\.decisionContext/);
});

test('product Hand path is independent of dev harness and shadow remains diagnostic only', () => {
  assert.doesNotMatch(PRODUCT_BOOTSTRAP, /CanonicalDev|shadow|canonicalDevHarness/);
  assert.match(HARNESS_BOOTSTRAP, /CANONICAL_LIVE_DEFAULT_ENABLED/);
  assert.match(HTML, /id="canonicalDevHarness"[^>]+hidden/);
  assert.match(LOGIC, /if \(playbookResolution\.mode === 'scenario'\)[\s\S]+RiverlineCanonicalDev\?\.compare/);
});

test('dependency and scope boundaries remain intact', () => {
  const domainFiles = fs.readdirSync(new URL('../shared/poker-domain/', import.meta.url));
  for (const file of domainFiles) {
    const source = fs.readFileSync(new URL(`../shared/poker-domain/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /app\/src|logic\.js|window\.|document\./, file);
  }
  assert.doesNotMatch(PRODUCT_BOOTSTRAP, /Equity|Training|calculateEquity|trainingMode/);
  assert.doesNotMatch(LOGIC.match(/function syncCanonicalDecisionDisplay[\s\S]*?\n}\n/)?.[0] || '',
    /applyAction|initializeHand|createAction/);
});
