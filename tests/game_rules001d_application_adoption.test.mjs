import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  GAME_RULES_SNAPSHOT_SOURCE_KINDS,
  LEDGER_KINDS,
  applyAction,
  applyChance,
  createGameRulesSnapshot,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
} from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import {
  PLAYBOOK_MODES,
  PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
  createPlaybookModeController,
  createPlaybookScenarioFromPokerState,
  createPlaybookScenarioInput,
  createPlaybookScenarioInputFromLegacyCompatibility,
  deriveDecisionContextFromPlaybookScenario,
} from '../app/src/application/playbook-state-source.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import {
  TRAINING_CONFIG_SCHEMA_VERSION,
  TRAINING_CONFIG_V2_SCHEMA_VERSION,
  TRAINING_EXERCISE_V2_SCHEMA_VERSION,
  TRAINING_GENERATION_ERROR_CODES,
  TRAINING_RULES_CAPABILITY_REASON_CODES,
  createTrainingConfig,
  createTrainingConfigFromLegacyCompatibility,
  generateTrainingExercise,
  resolveTrainingRulesCapability,
} from '../app/src/application/training-generator.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import {
  SAVED_SPOT_DERIVATIONS,
  createSavedSpotSnapshot,
  validateSavedSpotSnapshot,
} from '../app/src/saved-study-objects/index.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);

function snapshot(mode = GAME_MODES.HOME, tableSize = mode === GAME_MODES.CLUBGG ? 7 : 2) {
  return createGameRulesSnapshotFromLegacyGameConfiguration({
    mode,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: 'none', amountMilliBb: 0 },
  }, tableSize);
}

function liveConfiguration(overrides = {}) {
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

function dealLiveController(overrides = {}) {
  const controller = createCanonicalLiveController({ enabled: true });
  const initialized = controller.initialize(liveConfiguration(overrides));
  assert.ok(initialized, controller.getDiagnostics().error?.message);
  const cardsByPlayer = Object.fromEntries(
    initialized.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
  );
  assert.ok(controller.dealHoleCards(cardsByPlayer));
  return controller;
}

function legacyScenario(rakeMode = 'off', tableSize = rakeMode === 'fixed' ? 7 : 2) {
  const perPlayer = rakeMode === 'fixed' ? 0.1 : 0;
  return createPlaybookScenarioInput({
    schemaVersion: 'playbook-scenario/v1',
    tableSize,
    heroPosition: tableSize === 2 ? 'BTN' : 'UTG',
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
    rakeMode,
    forcedContributionPerPlayerBb: perPlayer,
    totalForcedContributionBb: Number((perPlayer * tableSize).toFixed(10)),
    anteBb: 0,
    straddleBb: 0,
  });
}

function scenarioV2(mode = GAME_MODES.HOME, tableSize = mode === GAME_MODES.CLUBGG ? 7 : 2) {
  return createPlaybookScenarioInputFromLegacyCompatibility({
    tableSize,
    heroPosition: tableSize === 2 ? 'BTN' : 'UTG',
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
    rakeMode: mode === GAME_MODES.CLUBGG ? 'fixed' : 'off',
    anteBb: 0,
    straddleBb: 0,
  });
}

function strategyProvider() {
  return createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
}

function trainingV2(seed = 0x001d001d, overrides = {}) {
  return createTrainingConfigFromLegacyCompatibility({
    schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
    tableSize: 2,
    stackBb: 100,
    streets: ['preflop'],
    gameMode: GAME_MODES.HOME,
    heroPositions: ['BTN'],
    allowedDecisionTypes: ['preflop_unopened'],
    difficulty: 'hard',
    seed,
    ...overrides,
  });
}

function reconstructTrainingExercise(exercise) {
  let state = initializeHandFromGameRulesSnapshot(
    exercise.generationMetadata.initialConfiguration,
  );
  for (const recorded of exercise.generationMetadata.events) {
    state = recorded.kind === 'chance'
      ? applyChance(state, recorded.event)
      : applyAction(state, recorded.action);
  }
  return state;
}

function equivalentCanonicalContexts(mode, tableSize) {
  const players = Array.from({ length: tableSize }, (_, seat) => ({
    playerId: `seat-${seat}`,
    seat,
    startingStackMilliBb: 100000,
  }));
  const legacyConfiguration = {
    handId: 'legacy-context',
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: 'none', amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players,
  };
  const snapshotConfiguration = {
    handId: 'snapshot-context',
    rulesSnapshot: snapshot(mode, tableSize),
    buttonSeat: 0,
    players,
  };
  let legacyState = initializeHand(legacyConfiguration);
  let snapshotState = initializeHandFromGameRulesSnapshot(snapshotConfiguration);
  const cardsByPlayer = Object.fromEntries(
    players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
  );
  legacyState = applyChance(legacyState, { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer });
  snapshotState = applyChance(snapshotState, { type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer });
  assert.equal(legacyState.actingPlayerId, snapshotState.actingPlayerId);
  return [
    deriveDecisionContextFromPokerState(legacyState, legacyState.actingPlayerId),
    deriveDecisionContextFromPokerState(snapshotState, snapshotState.actingPlayerId),
  ];
}

test('live Home and ClubGG compatibility choices create brand-free poker-state/v2 hands', () => {
  const home = dealLiveController().getState();
  assert.equal(home.schemaVersion, 'poker-state/v2');
  assert.equal(home.rulesSnapshot.definition.collectionPolicy.type, 'none');
  assert.equal(home.deductionTotalMilliBb, 0);
  assert.equal(Object.hasOwn(home.game, 'mode'), false);
  assert.equal(Object.hasOwn(home.game, 'forcedContributionPerPlayerMilliBb'), false);

  for (const tableSize of [7, 9, 10]) {
    const fixed = dealLiveController({
      tableSize,
      gameMode: GAME_MODES.CLUBGG,
      heroPosition: 'UTG',
    }).getState();
    assert.equal(fixed.schemaVersion, 'poker-state/v2');
    assert.equal(fixed.rulesSnapshot.definition.collectionPolicy.type,
      'fixed_per_seated_player');
    assert.equal(fixed.deductionTotalMilliBb, tableSize * 100);
    assert.equal(fixed.potMilliBb, 1500);
    assert.ok(fixed.ledger.slice(0, tableSize)
      .every((entry) => entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION));
  }
});

test('live compatibility validation preserves table limits and rejects unknown choices explicitly', () => {
  const invalidMode = createCanonicalLiveController({ enabled: true });
  assert.equal(invalidMode.initialize(liveConfiguration({ gameMode: 'mystery' })), null);
  assert.match(invalidMode.getDiagnostics().error.message, /Unsupported legacy game mode/);

  const undersizedFixed = createCanonicalLiveController({ enabled: true });
  assert.equal(undersizedFixed.initialize(liveConfiguration({
    tableSize: 6,
    gameMode: GAME_MODES.CLUBGG,
  })), null);
  assert.match(undersizedFixed.getDiagnostics().error.message, /7 through 10/);

  for (const tableSize of [2, 10]) {
    assert.ok(createCanonicalLiveController({ enabled: true }).initialize(
      liveConfiguration({ tableSize }),
    ));
  }
});

test('Scenario v1 reads known accounting exactly and never normalizes an unknown mode to no-rake', () => {
  assert.equal(deriveDecisionContextFromPlaybookScenario(legacyScenario('off')).rakeMode, 'off');
  const fixed = deriveDecisionContextFromPlaybookScenario(legacyScenario('fixed', 7));
  assert.equal(fixed.rakeMode, 'fixed');
  assert.equal(fixed.forcedContributionPerPlayerBb, 0.1);
  assert.equal(fixed.totalForcedContributionBb, 0.7);
  const unknown = { ...legacyScenario(), rakeMode: 'future_percent' };
  assert.throws(() => deriveDecisionContextFromPlaybookScenario(unknown),
    /Unsupported legacy Scenario rakeMode/);
});

test('Scenario v2 requires and validates an immutable snapshot for no-rake and fixed projection', () => {
  const home = scenarioV2();
  assert.equal(home.schemaVersion, PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION);
  assert.equal(Object.isFrozen(home.rulesSnapshot), true);
  assert.equal(deriveDecisionContextFromPlaybookScenario(home).rakeMode, 'off');

  const fixed = scenarioV2(GAME_MODES.CLUBGG, 7);
  const fixedContext = deriveDecisionContextFromPlaybookScenario(fixed);
  assert.deepEqual({
    rakeMode: fixedContext.rakeMode,
    perPlayer: fixedContext.forcedContributionPerPlayerBb,
    total: fixedContext.totalForcedContributionBb,
  }, { rakeMode: 'fixed', perPlayer: 0.1, total: 0.7 });
  assert.equal(Object.hasOwn(fixed, 'rakeMode'), false);

  assert.throws(() => createPlaybookScenarioInput({
    ...home,
    rulesSnapshot: undefined,
  }), /GameRulesSnapshot/);
  assert.throws(() => createPlaybookScenarioInput({
    ...home,
    rulesSnapshot: { ...home.rulesSnapshot, semanticFingerprint: 'mismatch' },
  }), /semanticFingerprint/);
  assert.throws(() => createPlaybookScenarioInput({
    ...home,
    schemaVersion: 'playbook-scenario/v99',
  }), /Unsupported PlaybookScenario version/);
});

test('Scenario v2 projection ignores source metadata and preserves lossy pricing semantics', () => {
  const base = scenarioV2();
  const directRules = createGameRulesSnapshot({
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
    setup: base.rulesSnapshot.setup,
    definition: base.rulesSnapshot.definition,
  });
  const presetRules = createGameRulesSnapshot({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
      presetId: 'example:renamed-preset',
      presetRevision: 91,
    },
    setup: base.rulesSnapshot.setup,
    definition: base.rulesSnapshot.definition,
  });
  const direct = createPlaybookScenarioInput({ ...base, rulesSnapshot: directRules });
  const preset = createPlaybookScenarioInput({ ...base, rulesSnapshot: presetRules });
  const directContext = deriveDecisionContextFromPlaybookScenario(direct);
  const presetContext = deriveDecisionContextFromPlaybookScenario(preset);
  assert.deepEqual(directContext, presetContext);
  assert.equal(directContext.callAmountBb, null);
  assert.equal(directContext.heroStreetContributionBb, null);
});

test('Hand v2 converts to Scenario v2 without fabricating history or losing rules', () => {
  const controller = dealLiveController();
  const handState = controller.getState();
  const scenario = createPlaybookScenarioFromPokerState(
    handState,
    controller.getHeroPlayerId(),
    controller.getProjectionOptions(),
  );
  assert.equal(scenario.schemaVersion, PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION);
  assert.deepEqual(scenario.rulesSnapshot, handState.rulesSnapshot);
  assert.equal(Object.hasOwn(scenario, 'actionHistory'), false);
  const handContext = deriveDecisionContextFromPokerState(
    handState,
    controller.getHeroPlayerId(),
    controller.getProjectionOptions(),
  );
  const scenarioContext = deriveDecisionContextFromPlaybookScenario(scenario);
  assert.equal(scenarioContext.rakeMode, handContext.rakeMode);
  assert.equal(scenarioContext.callAmountBb, null);

  const modes = createPlaybookModeController({ canonicalController: controller });
  assert.equal(modes.resolve({ scenarioInput: scenario }).status, 'available');
  assert.equal(modes.setMode(PLAYBOOK_MODES.HAND, scenario).mode, PLAYBOOK_MODES.HAND);
  modes.setMode(PLAYBOOK_MODES.SCENARIO);
  const reopened = modes.resolve();
  assert.equal(reopened.decisionContext.rakeMode, handContext.rakeMode);
  assert.deepEqual(modes.getLastScenarioInput().rulesSnapshot, handState.rulesSnapshot);
});

test('legacy and snapshot-authoritative DecisionContexts retain provider parity with no fee adjustment', () => {
  const provider = strategyProvider();
  for (const [oldScenario, newScenario] of [
    [legacyScenario('off', 2), scenarioV2(GAME_MODES.HOME, 2)],
    [legacyScenario('fixed', 7), scenarioV2(GAME_MODES.CLUBGG, 7)],
  ]) {
    const oldContext = deriveDecisionContextFromPlaybookScenario(oldScenario);
    const newContext = deriveDecisionContextFromPlaybookScenario(newScenario);
    assert.deepEqual(newContext, oldContext);
    const oldResult = provider.resolve(oldContext);
    const newResult = provider.resolve(newContext);
    assert.deepEqual(newResult, oldResult);
    assert.equal(newResult.details.forcedContributionAdjustmentApplied, false);
  }
});

test('PokerState v1/v2 projection preserves call, facing, and current contribution semantics', () => {
  for (const [mode, tableSize] of [[GAME_MODES.HOME, 2], [GAME_MODES.CLUBGG, 7]]) {
    const [legacyContext, snapshotContext] = equivalentCanonicalContexts(mode, tableSize);
    assert.deepEqual(snapshotContext, legacyContext);
    assert.equal(snapshotContext.facingSizeBb, 0);
    assert.ok(snapshotContext.callAmountBb >= 0);
    assert.ok(snapshotContext.heroStreetContributionBb >= 0);
  }
});

test('Training config v1 remains valid while v2 embeds immutable no-rake rules', () => {
  const v1 = createTrainingConfig({
    schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
    tableSize: 2,
    stackBb: 100,
    streets: ['preflop'],
    gameMode: GAME_MODES.HOME,
    heroPositions: ['BTN'],
    allowedDecisionTypes: ['preflop_unopened'],
    difficulty: 'hard',
    seed: 17,
  });
  assert.equal(v1.schemaVersion, 'training-config/v1');
  const v2 = trainingV2(17);
  assert.equal(v2.schemaVersion, TRAINING_CONFIG_V2_SCHEMA_VERSION);
  assert.equal(v2.rulesSnapshot.definition.collectionPolicy.type, 'none');
  assert.equal(Object.isFrozen(v2.rulesSnapshot), true);
  assert.throws(() => createTrainingConfig({ ...v2, schemaVersion: 'training-config/v99' }),
    /Unsupported TrainingConfig version/);
});

test('Training capability separates canonical support from current generator/reference support', () => {
  const supported = resolveTrainingRulesCapability(snapshot(GAME_MODES.HOME, 2), {
    tableSize: 2,
  });
  assert.deepEqual({
    supported: supported.supported,
    canonical: supported.canonicalHandSupported,
    generator: supported.generatorSupported,
    provider: supported.strategyProviderSupported,
    reason: supported.reasonCode,
  }, { supported: true, canonical: true, generator: true, provider: true, reason: null });

  const fixed = resolveTrainingRulesCapability(snapshot(GAME_MODES.CLUBGG, 7), {
    tableSize: 7,
  });
  assert.deepEqual({
    supported: fixed.supported,
    canonical: fixed.canonicalHandSupported,
    generator: fixed.generatorSupported,
    provider: fixed.strategyProviderSupported,
    reason: fixed.reasonCode,
  }, {
    supported: false,
    canonical: true,
    generator: false,
    provider: false,
    reason: TRAINING_RULES_CAPABILITY_REASON_CODES.FIXED_COLLECTION_UNSUPPORTED,
  });
  const malformed = {
    ...snapshot(GAME_MODES.HOME, 2),
    definition: {
      ...snapshot(GAME_MODES.HOME, 2).definition,
      collectionPolicy: { type: 'future_percent' },
    },
  };
  assert.equal(resolveTrainingRulesCapability(malformed).reasonCode,
    TRAINING_RULES_CAPABILITY_REASON_CODES.INVALID_RULES_SNAPSHOT);
});

test('Training v2 generates poker-state/v2 deterministically with one provider resolution', () => {
  const config = trainingV2();
  let resolutions = 0;
  const provider = strategyProvider();
  const countedProvider = {
    resolve(context) {
      resolutions += 1;
      return provider.resolve(context);
    },
  };
  const first = generateTrainingExercise(config, { strategyProvider: countedProvider });
  assert.equal(first.ok, true, first.error?.message);
  assert.equal(resolutions, 1);
  assert.equal(first.exercise.schemaVersion, TRAINING_EXERCISE_V2_SCHEMA_VERSION);
  assert.equal(first.exercise.pokerState.schemaVersion, 'poker-state/v2');
  assert.equal(Object.hasOwn(first.exercise.generationMetadata.initialConfiguration, 'game'), false);
  assert.ok(first.exercise.generationMetadata.initialConfiguration.rulesSnapshot);
  assert.deepEqual(reconstructTrainingExercise(first.exercise), first.exercise.pokerState);

  const second = generateTrainingExercise(config, { strategyProvider: provider });
  assert.equal(second.ok, true);
  assert.deepEqual(second.exercise, first.exercise);
});

test('fixed and malformed Training rules fail explicitly without Home fallback or provider work', () => {
  const fixedConfig = createTrainingConfig({
    ...trainingV2(23),
    tableSize: 7,
    rulesSnapshot: snapshot(GAME_MODES.CLUBGG, 7),
    heroPositions: ['UTG'],
  });
  let resolutions = 0;
  const result = generateTrainingExercise(fixedConfig, {
    strategyProvider: { resolve() { resolutions += 1; return strategyProvider().resolve(null); } },
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES);
  assert.equal(result.error.details.capability.reasonCode,
    TRAINING_RULES_CAPABILITY_REASON_CODES.FIXED_COLLECTION_UNSUPPORTED);
  assert.equal(resolutions, 0);

  const malformed = {
    ...trainingV2(24),
    rulesSnapshot: { ...snapshot(GAME_MODES.HOME, 2), semanticFingerprint: 'bad' },
  };
  const invalid = generateTrainingExercise(malformed, { strategyProvider: strategyProvider() });
  assert.equal(invalid.error.code, TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES);
  assert.equal(invalid.error.details.capability.reasonCode,
    TRAINING_RULES_CAPABILITY_REASON_CODES.INVALID_RULES_SNAPSHOT);
});

test('Training v2 grading remains the existing StrategyResult probability grading', () => {
  const result = generateTrainingExercise(trainingV2(31), {
    strategyProvider: strategyProvider(),
  });
  assert.equal(result.ok, true);
  const chosen = result.exercise.strategyResult.actions[0].action.type;
  const evaluation = evaluateTrainingAnswer({
    exerciseId: result.exercise.id,
    chosenActionType: chosen,
    strategyResult: result.exercise.strategyResult,
    decisionContext: result.exercise.decisionContext,
  });
  assert.equal(evaluation.schemaVersion, 'training-answer-evaluation/v1');
  assert.equal(evaluation.chosenAction.type, chosen);
});

test('Scenario v2 Saved Spot uses the existing v2 payload and preserves rules on reopen', () => {
  const scenario = scenarioV2(GAME_MODES.CLUBGG, 7);
  const decisionContext = deriveDecisionContextFromPlaybookScenario(scenario);
  const saved = createSavedSpotSnapshot({
    derivation: SAVED_SPOT_DERIVATIONS.SCENARIO,
    decisionContext,
    scenarioInput: scenario,
    rulesSnapshot: scenario.rulesSnapshot,
  });
  assert.equal(saved.schemaVersion, 'saved-spot-snapshot/v2');
  assert.equal(saved.scenarioInput.schemaVersion, 'playbook-scenario/v2');
  assert.deepEqual(saved.scenarioInput.rulesSnapshot, saved.rulesSnapshot);
  const reopened = structuredClone(saved);
  assert.equal(validateSavedSpotSnapshot(reopened), reopened);
  assert.deepEqual(
    deriveDecisionContextFromPlaybookScenario(reopened.scenarioInput),
    decisionContext,
  );
});
