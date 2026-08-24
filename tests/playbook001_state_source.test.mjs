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

test('Scenario mode preserves manual pot, facing, action, cards, and stack mode', () => {
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
    rakeMode: 'off',
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

test('Hand mode rejects straddle and undersized ClubGG configuration', () => {
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
  assert.equal(Object.hasOwn(result.decisionContext, 'legacyRakePercent'), false);
  assert.equal(result.decisionContext.potBb, 1.5);
});

test('Scenario mode keeps canonical pricing facts unavailable instead of copying hand history', () => {
  const hand = resolveHand(controllerWithCards());
  const manual = resolveScenario(projectedScenario(hand.decisionContext));
  assert.equal(manual.decisionContext.facingSizeBb, hand.decisionContext.facingSizeBb);
  assert.equal(manual.decisionContext.callAmountBb, null);
  assert.equal(manual.decisionContext.heroStreetContributionBb, null);
  assert.equal(hand.decisionContext.callAmountBb, 0.5);
  assert.equal(hand.decisionContext.heroStreetContributionBb, 0.5);
});

test('Scenario pricing remains unavailable when a Hand-mode raise has a known call commitment', () => {
  const controller = controllerWithCards({ tableSize: 6, heroPosition: 'BTN' });
  while (controller.getState().actingPlayerId !== controller.getHeroPlayerId()) {
    controller.applyAction({ type: ACTION_TYPES.FOLD });
  }
  const unopened = resolveHand(controller);
  assert.equal(unopened.decisionContext.lastAction, 'unopened');
  assert.equal(resolveScenario(projectedScenario(unopened.decisionContext)).decisionContext.callAmountBb, null);

  controller.applyAction({ type: ACTION_TYPES.RAISE, amountToBb: 2.5 });
  const nextActor = controller.getState().actingPlayerId;
  const nextHero = controller.getState().players.find((player) => player.playerId === nextActor);
  const raisedContext = resolvePlaybookDecisionContext({
    mode: 'hand', canonicalSession: controller, heroPlayerId: nextHero.playerId,
    projectionOptions: controller.getProjectionOptions(),
  });
  assert.equal(raisedContext.decisionContext.lastAction, 'raise');
  const scenarioRaised = resolveScenario(projectedScenario(raisedContext.decisionContext));
  assert.equal(scenarioRaised.decisionContext.facingSizeBb, raisedContext.decisionContext.facingSizeBb);
  assert.equal(scenarioRaised.decisionContext.callAmountBb, null);
  assert.equal(scenarioRaised.decisionContext.heroStreetContributionBb, null);
  assert.ok(raisedContext.decisionContext.callAmountBb > 0);
});

test('3-bet and BB-option contexts preserve nominal facts without fabricating Scenario pricing', () => {
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
  assert.equal(manualThreeBet.decisionContext.facingSizeBb, threeBet.decisionContext.facingSizeBb);
  assert.equal(manualThreeBet.decisionContext.callAmountBb, null);
  assert.ok(threeBet.decisionContext.callAmountBb > 0);

  const limped = controllerWithCards({ tableSize: 3, heroPosition: 'BB' });
  limped.applyAction({ type: ACTION_TYPES.CALL });
  limped.applyAction({ type: ACTION_TYPES.CALL });
  const option = resolveHand(limped);
  assert.equal(option.decisionContext.lastAction, 'check');
  assert.equal(option.decisionContext.facingSizeBb, 0);
  const manualOption = resolveScenario(projectedScenario(option.decisionContext));
  assert.equal(manualOption.decisionContext.callAmountBb, 0);
  assert.equal(manualOption.decisionContext.heroStreetContributionBb, null);
  assert.equal(option.decisionContext.callAmountBb, 0);
});

test('flop first-action live facts and facing-bet pricing authority remain explicit', () => {
  const controller = controllerWithCards({ heroPosition: 'BB' });
  controller.applyAction({ type: ACTION_TYPES.CALL });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.dealBoardCards(['2c', '3d', '4s']);
  const flop = resolveHand(controller);
  assert.equal(flop.decisionContext.street, 'flop');
  const scenarioFlop = legacy.strategyResult(
    resolveScenario(projectedScenario(flop.decisionContext)).decisionContext,
  );
  const handFlop = legacy.strategyResult(flop.decisionContext);
  assert.notDeepEqual(scenarioFlop.actions, handFlop.actions);
  assert.equal(
    scenarioFlop.details.heuristicSample.eq,
    handFlop.details.heuristicSample.eq,
  );
  assert.equal(
    scenarioFlop.details.heuristicSample.opponentCountSource,
    'table_size_approximation',
  );
  assert.equal(
    handFlop.details.heuristicSample.opponentCountSource,
    'decision_context_exact',
  );
  assert.equal(scenarioFlop.details.positionAdjustmentApplied, false);
  assert.equal(handFlop.details.positionAdjustmentApplied, true);
  assert.equal(handFlop.details.effectiveSpr.kind, 'heads_up_exact_effective_spr');

  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.BET, amountToBb: 2 });
  const facingBet = resolveHand(controller);
  assert.equal(facingBet.decisionContext.lastAction, 'bet');
  assert.equal(facingBet.decisionContext.facingSizeBb, 2);
  assert.equal(facingBet.decisionContext.callAmountBb, 2);
  const scenarioFacingBet = resolveScenario(projectedScenario(facingBet.decisionContext));
  assert.equal(scenarioFacingBet.decisionContext.callAmountBb, null);
  const scenarioResult = legacy.strategyResult(scenarioFacingBet.decisionContext);
  assert.equal(scenarioResult.schemaVersion, 'strategy-result/v1');
  assert.equal(scenarioResult.source, 'unavailable');
  assert.deepEqual(scenarioResult.actions, []);
  assert.equal(scenarioResult.contextCoverage.kind, 'unsupported');
  assert.equal(scenarioResult.contextCoverage.basis, 'missing_trusted_decision_economics');

  const handResult = legacy.strategyResult(facingBet.decisionContext);
  assert.equal(handResult.schemaVersion, 'strategy-result/v1');
  assert.equal(handResult.source, 'heuristic_postflop');
  assert.ok(handResult.actions.every((entry) => Number.isFinite(entry.probability)));
});

test('ClubGG Scenario preserves its nominal configuration without copying canonical price facts', () => {
  const hand = resolveHand(controllerWithCards({
    tableSize: 7, gameMode: GAME_MODES.CLUBGG, heroPosition: 'UTG',
  }));
  const manual = resolveScenario(projectedScenario(hand.decisionContext));
  const result = legacy.strategyResult(hand.decisionContext);
  assert.equal(manual.decisionContext.callAmountBb, null);
  assert.equal(manual.decisionContext.heroStreetContributionBb, null);
  assert.equal(hand.decisionContext.callAmountBb, 1);
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
  assert.ok(bridge.applyAction(ACTION_TYPES.CALL));
  const preserved = bridge.getState();
  bridge.setMode('scenario', scenario({ potBb: 25 }));
  bridge.setMode('hand', scenario());
  assert.equal(bridge.getState(), preserved);
  assert.deepEqual(events
    .filter((event) => event.type === 'riverline:playbook-state-change')
    .map((event) => event.detail.operation),
    ['mode', 'initialize_hand', 'deal_hole', 'action', 'mode', 'mode']);
  const experienceTypes = events
    .filter((event) => event.type === 'riverline:experience-event')
    .map((event) => event.detail.event.type);
  assert.ok(experienceTypes.includes('card_dealt'));
  assert.ok(experienceTypes.includes('action_call'));
  assert.ok(experienceTypes.includes('chips_committed'));
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

test('both modes converge on one StrategyProvider and StrategyResult rendering path', () => {
  const updateStart = LOGIC.indexOf("async function updateContext(reason = 'Context updated')");
  const updateEnd = LOGIC.indexOf('// Legacy fast evaluator retained for the existing Outs display only.', updateStart);
  assert.ok(updateEnd > updateStart);
  const update = LOGIC.slice(updateStart, updateEnd);
  assert.equal((update.match(/strategyProvider\.resolve\(decisionContext\)/g) || []).length, 1);
  assert.equal((update.match(/strategyResultToLegacyProfile\(strategyResult\)/g) || []).length, 1);
  assert.doesNotMatch(LOGIC, /scenarioActionProfile|handActionProfile/);
  assert.match(update, /playbookResolution\.decisionContext/);
});

test('product Hand path has one canonical controller and no dev shadow path', () => {
  assert.match(PRODUCT_BOOTSTRAP, /createCanonicalLiveController/);
  assert.doesNotMatch(`${HTML}\n${LOGIC}\n${PRODUCT_BOOTSTRAP}`,
    /canonical-live-bootstrap|canonical-hand-harness|decision-context-shadow|RiverlineCanonicalDev|canonicalDevHarness/);
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
