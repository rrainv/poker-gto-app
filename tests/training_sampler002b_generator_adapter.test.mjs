import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  ACTION_TYPES,
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  PHASES,
  POSITIONS_BY_TABLE_SIZE,
  applyAction,
  applyChance,
  createGameRulesSnapshot,
  initializeHandFromGameRulesSnapshot,
  validatePokerState,
} from '../shared/poker-domain/index.js';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import {
  TRAINING_CONFIG_V2_SCHEMA_VERSION,
  TRAINING_DECISION_TYPES,
  TRAINING_EXERCISE_V2_SCHEMA_VERSION,
  TRAINING_GENERATION_ERROR_CODES,
  TRAINING_SCENARIO_REQUEST_ADAPTER_POLICY_VERSION,
  TRAINING_SCENARIO_REQUEST_TARGET_MAP,
  createTrainingConfigFromScenarioRequest,
  generateTrainingExercise,
  generateTrainingExerciseFromScenarioRequest,
  resolveTrainingRulesCapability,
} from '../app/src/application/training-generator.mjs';
import {
  TRAINING_PLANNER_TARGET_DECISION_TYPES,
  TRAINING_PRACTICE_MODES,
  TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  TRAINING_SESSION_INTENT_SCHEMA_VERSION,
  createTrainingPracticePlannerState,
  createTrainingScenarioRequest,
  createTrainingSessionIntent,
  planTrainingScenario,
  trainingStackBucket,
} from '../app/src/application/training-practice-planner.mjs';
import {
  TRAINING_SESSION_ERROR_CODES,
  createTrainingSessionController,
} from '../app/src/application/training-session-controller.mjs';

function snapshotFromPreset(preset, seatedPlayers) {
  return createGameRulesSnapshot({
    source: {
      kind: 'preset',
      presetId: preset.id,
      presetRevision: preset.revision,
    },
    setup: { seatedPlayers },
    definition: preset.definition,
  });
}

function noRakeSnapshot(seatedPlayers = 6) {
  return snapshotFromPreset(NO_RAKE_CASH_GAME_RULES_PRESET, seatedPlayers);
}

function focusedIntent(focusPreferences = {}, overrides = {}) {
  const rulesSnapshot = overrides.rulesSnapshot ?? noRakeSnapshot();
  return createTrainingSessionIntent({
    schemaVersion: TRAINING_SESSION_INTENT_SCHEMA_VERSION,
    mode: TRAINING_PRACTICE_MODES.FOCUSED,
    sessionSeed: 0x002b002b,
    sessionLength: 100,
    difficulty: 'hard',
    focusPreferences: {
      tableSize: 6,
      heroPosition: 'BTN',
      startingStackBb: 100,
      street: 'preflop',
      targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED,
      ...focusPreferences,
    },
    rulesSnapshot,
    rulesCapability: resolveTrainingRulesCapability(rulesSnapshot),
    plannerPolicyVersion: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
    ...overrides,
  });
}

function planFocused(intent, ordinal = 0) {
  const result = planTrainingScenario(
    intent,
    createTrainingPracticePlannerState(intent),
    ordinal,
  );
  assert.equal(result.ok, true, result.error?.message);
  return result.request;
}

function strategyProvider() {
  return Object.freeze({
    resolve(context) {
      const passiveType = context.facingSizeBb > 0 ? ACTION_TYPES.CALL : ACTION_TYPES.CHECK;
      const aggressiveType = context.street === 'preflop'
        ? ACTION_TYPES.RAISE
        : context.facingSizeBb > 0 ? ACTION_TYPES.RAISE : ACTION_TYPES.BET;
      return {
        schemaVersion: 'strategy-result/v1',
        source: context.street === 'preflop' ? 'heuristic_preflop' : 'heuristic_postflop',
        actions: [
          {
            action: { type: ACTION_TYPES.FOLD, amountBb: null, potFraction: null },
            label: 'Fold', probability: 0.2, evBb: null,
          },
          {
            action: { type: passiveType, amountBb: null, potFraction: null },
            label: passiveType === ACTION_TYPES.CALL ? 'Call' : 'Check',
            probability: 0.35,
            evBb: null,
          },
          {
            action: { type: aggressiveType, amountBb: null, potFraction: null },
            label: aggressiveType === ACTION_TYPES.BET ? 'Bet' : 'Raise',
            probability: 0.45,
            evBb: null,
          },
        ],
        recommendation: {
          action: { type: aggressiveType, amountBb: null, potFraction: null },
          label: aggressiveType === ACTION_TYPES.BET ? 'Bet' : 'Raise',
        },
        explanation: null,
        confidence: null,
        coverage: null,
        modelVersion: null,
        warnings: [],
        details: null,
      };
    },
  });
}

function canonicalStrategyProvider() {
  return createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
}

function generateRequest(request, rulesSnapshot, provider = strategyProvider()) {
  return generateTrainingExerciseFromScenarioRequest(request, {
    rulesSnapshot,
    strategyProvider: provider,
  });
}

function requireRequestExercise(request, rulesSnapshot, provider = strategyProvider()) {
  const result = generateRequest(request, rulesSnapshot, provider);
  assert.equal(result.ok, true, `${result.error?.code}: ${result.error?.message}`);
  return result.exercise;
}

function replayExercise(exercise) {
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

function requestWith(request, overrides) {
  const merged = { ...structuredClone(request), ...overrides };
  if (Object.hasOwn(overrides, 'startingStackBb')
    && !Object.hasOwn(overrides, 'stackBucket')) {
    merged.stackBucket = trainingStackBucket(overrides.startingStackBb);
  }
  return createTrainingScenarioRequest(merged);
}

test('002B maps every request fact to one strict singleton training-config/v2', () => {
  const rulesSnapshot = noRakeSnapshot(6);
  const intent = focusedIntent({
    tableSize: 10,
    heroPosition: 'UTG+2',
    startingStackBb: 37.5,
    street: 'turn',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
  }, { rulesSnapshot, difficulty: 'guided' });
  const request = planFocused(intent);
  const config = createTrainingConfigFromScenarioRequest(request, rulesSnapshot);

  assert.equal(config.schemaVersion, TRAINING_CONFIG_V2_SCHEMA_VERSION);
  assert.deepEqual({
    tableSize: config.tableSize,
    stackBb: config.stackBb,
    streets: config.streets,
    heroPositions: config.heroPositions,
    allowedDecisionTypes: config.allowedDecisionTypes,
    difficulty: config.difficulty,
    seed: config.seed,
  }, {
    tableSize: 10,
    stackBb: 37.5,
    streets: ['turn'],
    heroPositions: ['UTG+2'],
    allowedDecisionTypes: [TRAINING_DECISION_TYPES.POSTFLOP_FACING_BET],
    difficulty: 'guided',
    seed: request.exerciseSeed,
  });
  assert.deepEqual(config.rulesSnapshot.source, rulesSnapshot.source);
  assert.deepEqual(config.rulesSnapshot.definition, rulesSnapshot.definition);
  assert.equal(config.rulesSnapshot.semanticFingerprint, rulesSnapshot.semanticFingerprint);
  assert.equal(config.rulesSnapshot.setup.seatedPlayers, 10);
  assert.equal(Object.isFrozen(config), true);
});

test('002B target vocabulary mapping is exhaustive and exact rather than substitutive', () => {
  assert.deepEqual(
    Object.keys(TRAINING_SCENARIO_REQUEST_TARGET_MAP).sort(),
    Object.values(TRAINING_PLANNER_TARGET_DECISION_TYPES).sort(),
  );
  for (const [requestTarget, generatorTarget] of Object.entries(
    TRAINING_SCENARIO_REQUEST_TARGET_MAP,
  )) {
    assert.equal(generatorTarget, requestTarget);
  }
});

test('002B generates legal exact-position requests for every 2-10 handed seat vocabulary', () => {
  const rulesSnapshot = noRakeSnapshot(6);
  for (let tableSize = 2; tableSize <= 10; tableSize += 1) {
    for (const heroPosition of POSITIONS_BY_TABLE_SIZE[tableSize]) {
      const intent = focusedIntent({
        tableSize,
        heroPosition,
        street: 'flop',
        targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION,
      }, { rulesSnapshot, sessionSeed: tableSize * 100 + heroPosition.length });
      const request = planFocused(intent);
      const exercise = requireRequestExercise(request, rulesSnapshot);
      validatePokerState(exercise.pokerState);
      assert.equal(exercise.schemaVersion, TRAINING_EXERCISE_V2_SCHEMA_VERSION);
      assert.equal(exercise.pokerState.phase, PHASES.BETTING);
      assert.equal(exercise.pokerState.terminal.isTerminal, false);
      assert.equal(exercise.pokerState.actingPlayerId, exercise.heroPlayerId);
      assert.equal(exercise.decisionContext.tableSize, tableSize);
      assert.equal(exercise.decisionContext.heroPosition, heroPosition);
      assert.equal(exercise.pokerState.rulesSnapshot.setup.seatedPlayers, tableSize);
      assert.deepEqual(replayExercise(exercise), exercise.pokerState);
    }
  }
});

test('002B preserves each exact requested street and target in realized metadata', () => {
  const rulesSnapshot = noRakeSnapshot();
  const cases = [
    ['preflop', 'BTN', TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED],
    ['preflop', 'BTN', TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN],
    ['preflop', 'BTN', TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_3BET],
    ['preflop', 'BTN', TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET],
    ['preflop', 'BB', TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION],
    ['flop', 'BTN', TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION],
    ['turn', 'BTN', TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET],
    ['river', 'BTN', TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE],
  ];
  cases.forEach(([street, heroPosition, targetDecisionType], index) => {
    const intent = focusedIntent({ street, heroPosition, targetDecisionType }, {
      rulesSnapshot,
      sessionSeed: 1000 + index,
    });
    const request = planFocused(intent);
    const exercise = requireRequestExercise(request, rulesSnapshot);
    const metadata = exercise.generationMetadata.scenarioRequest;
    assert.equal(exercise.decisionContext.street, street);
    assert.equal(exercise.generationMetadata.targetReason, targetDecisionType);
    assert.equal(metadata.request.targetDecisionType, targetDecisionType);
    assert.equal(metadata.request.street, street);
    assert.equal(metadata.realizedStructure.targetDecisionType, targetDecisionType);
    assert.equal(metadata.realizedStructure.street, street);
  });
});

test('002B retains exact stack, rules, request, ordinal, policies, and named seeds', () => {
  const rulesSnapshot = noRakeSnapshot();
  const intent = focusedIntent({
    tableSize: 9,
    heroPosition: 'HJ',
    startingStackBb: 37.5,
    street: 'turn',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
  }, { rulesSnapshot, sessionSeed: 0 });
  const request = planFocused(intent);
  const exercise = requireRequestExercise(request, rulesSnapshot);
  const metadata = exercise.generationMetadata.scenarioRequest;
  const hero = exercise.pokerState.players.find(
    (player) => player.playerId === exercise.heroPlayerId,
  );

  assert.equal(hero.startingStackMilliBb, 37500);
  assert.equal(exercise.generationMetadata.trainingConfig.stackBb, 37.5);
  assert.deepEqual(metadata.request, request);
  assert.equal(metadata.request.sessionOrdinal, 0);
  assert.equal(metadata.request.sessionIntentFingerprint, request.sessionIntentFingerprint);
  assert.deepEqual(metadata.requestedStructure, metadata.realizedStructure);
  assert.deepEqual(metadata.policyVersions, {
    planner: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
    adapter: TRAINING_SCENARIO_REQUEST_ADAPTER_POLICY_VERSION,
    generator: 'bounded_legal_trajectory_v2',
  });
  assert.deepEqual(
    Object.keys(metadata.construction.namedSeeds).sort(),
    ['cards', 'constructionAttempt', 'seatsButton', 'trajectory'].sort(),
  );
  assert.equal(metadata.construction.attemptCount, 1);
  assert.deepEqual(metadata.construction.retryDiagnostics, []);
  assert.equal(exercise.pokerState.rulesSnapshot.semanticFingerprint,
    rulesSnapshot.semanticFingerprint);
  assert.deepEqual(exercise.pokerState.rulesSnapshot.source, rulesSnapshot.source);
});

test('002B rejects unsupported rules without provider work or a no-rake fallback', () => {
  const noRake = noRakeSnapshot();
  const fixed = snapshotFromPreset(FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET, 7);
  const baseRequest = planFocused(focusedIntent({}, { rulesSnapshot: noRake }));
  const request = requestWith(baseRequest, {
    tableSize: 7,
    heroPosition: 'BTN',
    rulesSemanticFingerprint: fixed.semanticFingerprint,
  });
  let resolutions = 0;
  const result = generateRequest(request, fixed, {
    resolve() {
      resolutions += 1;
      return strategyProvider().resolve({});
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES);
  assert.equal(result.error.details.capability.reasonCode,
    'fixed_collection_training_unsupported');
  assert.equal(result.error.details.request.rulesSemanticFingerprint,
    fixed.semanticFingerprint);
  assert.equal(resolutions, 0);

  const malformed = {
    ...noRake,
    semanticFingerprint: 'malformed-fingerprint',
  };
  const invalid = generateRequest(baseRequest, malformed, {
    resolve() {
      resolutions += 1;
      return null;
    },
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_RULES);
  assert.equal(invalid.error.details.capability.reasonCode, 'invalid_rules_snapshot');
  assert.equal(resolutions, 0);
});

test('002B impossible request fails stably without target, street, or position substitution', () => {
  const rulesSnapshot = noRakeSnapshot();
  const base = planFocused(focusedIntent({}, { rulesSnapshot }));
  const impossible = requestWith(base, {
    tableSize: 2,
    heroPosition: 'BTN',
    startingStackBb: 10,
    stackBucket: 'short',
    street: 'preflop',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET,
    facingCategory: 'four_bet',
    requestedSizingFamily: 'large',
  });
  let resolutions = 0;
  const provider = {
    resolve() {
      resolutions += 1;
      return strategyProvider().resolve({});
    },
  };
  const first = generateRequest(impossible, rulesSnapshot, provider);
  const second = generateRequest(impossible, rulesSnapshot, provider);

  assert.deepEqual(second, first);
  assert.equal(first.ok, false);
  assert.equal(first.error.code, TRAINING_GENERATION_ERROR_CODES.GENERATION_EXHAUSTED);
  assert.equal(first.error.details.attempts, 64);
  assert.equal(first.error.details.retryDiagnostics.length, 64);
  assert.ok(first.error.details.retryDiagnostics.every((diagnostic, index) => (
    diagnostic.attempt === index + 1
      && diagnostic.reason === 'hero_could_not_face_open_before_3bet'
  )));
  assert.equal(new Set(first.error.details.retryDiagnostics.map(
    (diagnostic) => diagnostic.namedSeeds.constructionAttempt,
  )).size, 64);
  assert.equal(new Set(first.error.details.retryDiagnostics.map(
    (diagnostic) => diagnostic.namedSeeds.cards,
  )).size, 64);
  assert.deepEqual(first.error.details.request, impossible);
  assert.equal(first.error.details.request.requestedSizingFamily, 'large');
  assert.deepEqual(first.error.details.requestedStructure, {
    tableSize: 2,
    heroPosition: 'BTN',
    startingStackBb: 10,
    street: 'preflop',
    targetDecisionType: 'preflop_facing_4bet',
    requestedSizingFamily: 'large',
    rulesSemanticFingerprint: rulesSnapshot.semanticFingerprint,
    exerciseSeed: impossible.exerciseSeed,
  });
  assert.equal(resolutions, 0);
});

test('002B same request reproduces exactly and an unrelated failed envelope shifts nothing', () => {
  const rulesSnapshot = noRakeSnapshot();
  const successful = planFocused(focusedIntent({
    tableSize: 8,
    heroPosition: 'CO',
    street: 'river',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
  }, { rulesSnapshot, sessionSeed: 91 }));
  const before = generateRequest(successful, rulesSnapshot);
  assert.equal(before.ok, true);
  assert.deepEqual(generateRequest(successful, rulesSnapshot), before);

  const impossible = requestWith(successful, {
    tableSize: 2,
    heroPosition: 'BTN',
    startingStackBb: 10,
    stackBucket: 'short',
    street: 'preflop',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET,
    facingCategory: 'four_bet',
  });
  assert.equal(generateRequest(impossible, rulesSnapshot).ok, false);
  assert.deepEqual(generateRequest(successful, rulesSnapshot), before);
});

test('002B resolves StrategyProvider exactly once for each successfully served exercise', async () => {
  const rulesSnapshot = noRakeSnapshot();
  const intent = focusedIntent({}, { rulesSnapshot, sessionLength: 3 });
  const provider = strategyProvider();
  let resolutions = 0;
  const counted = {
    resolve(context) {
      resolutions += 1;
      return provider.resolve(context);
    },
  };
  const controller = createTrainingSessionController();
  const initial = controller.startPracticeSession(intent);
  assert.equal(initial.servedCount, 0);

  const first = await controller.generatePlanned({ strategyProvider: counted });
  assert.equal(first.ok, true, first.error?.message);
  assert.equal(resolutions, 1);
  assert.equal(controller.getPracticePlannerState().servedCount, 1);
  assert.equal(controller.getSnapshot().exercise.id, first.exercise.id);
  assert.equal(controller.getPracticePlannerState().servedCount, 1);

  const second = await controller.generatePlanned({ strategyProvider: counted });
  assert.equal(second.ok, true, second.error?.message);
  assert.equal(resolutions, 2);
  assert.equal(controller.getPracticePlannerState().servedCount, 2);
});

test('002B failed, stale, and reset-cancelled work never advances served coverage', async () => {
  const rulesSnapshot = noRakeSnapshot();
  const intent = focusedIntent({}, { rulesSnapshot, sessionLength: 4 });
  const realRequest = planFocused(intent);
  const delivered = generateRequest(realRequest, rulesSnapshot);
  assert.equal(delivered.ok, true);

  const failedController = createTrainingSessionController({
    generateScenarioRequestExercise: () => ({
      ok: false,
      error: {
        schemaVersion: 'training-generation-error/v1',
        code: 'generation_exhausted',
        message: 'fixture failure',
        details: {},
      },
    }),
  });
  failedController.startPracticeSession(intent);
  assert.equal((await failedController.generatePlanned()).ok, false);
  assert.equal(failedController.getPracticePlannerState().servedCount, 0);

  const pending = [];
  const staleController = createTrainingSessionController({
    generateScenarioRequestExercise: () => new Promise((resolve) => pending.push(resolve)),
  });
  staleController.startPracticeSession(intent);
  const first = staleController.generatePlanned();
  const second = staleController.generatePlanned();
  await Promise.resolve();
  pending[0](delivered);
  assert.equal((await first).error.code, TRAINING_SESSION_ERROR_CODES.STALE_GENERATION);
  assert.equal(staleController.getPracticePlannerState().servedCount, 0);
  pending[1](delivered);
  assert.equal((await second).ok, true);
  assert.equal(staleController.getPracticePlannerState().servedCount, 1);

  const resetPending = [];
  const resetController = createTrainingSessionController({
    generateScenarioRequestExercise: () => new Promise(
      (resolve) => resetPending.push(resolve),
    ),
  });
  resetController.startPracticeSession(intent);
  const cancelled = resetController.generatePlanned();
  await Promise.resolve();
  resetController.reset();
  assert.equal(resetController.getPracticePlannerState(), null);
  resetPending[0](delivered);
  assert.equal((await cancelled).error.code, TRAINING_SESSION_ERROR_CODES.STALE_GENERATION);
  assert.equal(resetController.getPracticePlannerState(), null);
});

test('002B direct generation remains deterministic with additive StrategyResult authority metadata', () => {
  const input = {
    schemaVersion: 'training-config/v1',
    tableSize: 8,
    stackBb: 30,
    streets: ['turn'],
    gameMode: 'home',
    heroPositions: ['UTG'],
    allowedDecisionTypes: ['postflop_facing_bet'],
    difficulty: 'hard',
    seed: 60,
  };
  const result = generateTrainingExercise(input, {
    strategyProvider: canonicalStrategyProvider(),
  });
  assert.equal(result.ok, true, result.error?.message);
  assert.equal(result.exercise.schemaVersion, 'training-exercise/v1');
  assert.equal(result.exercise.pokerState.schemaVersion, 'poker-state/v1');
  assert.equal(result.exercise.strategyResult.sourceVersion, 'riverline-postflop-heuristic/v3');
  assert.equal(result.exercise.strategyResult.contextCoverage.kind, 'generalized');
  assert.equal(result.exercise.decisionContext.contractVersion, 'decision-context/v1.1');
  assert.equal(
    result.exercise.decisionContext.gameRules.schemaVersion,
    'decision-context-game-rules/v1',
  );
  assert.equal(
    result.exercise.decisionContext.currentPotBb,
    result.exercise.pokerState.potMilliBb / 1000,
  );
  assert.equal(Object.hasOwn(result.exercise.generationMetadata, 'scenarioRequest'), false);
  assert.equal(
    createHash('sha256').update(JSON.stringify(result)).digest('hex'),
    '952dc2627f387a4a01ba3e8350537c222c9239d09afc12e07d95b77139fe1ee0',
  );
});

test('002B session answer grading remains the existing legal StrategyResult flow', async () => {
  const intent = focusedIntent();
  const controller = createTrainingSessionController();
  controller.startPracticeSession(intent);
  const generated = await controller.generatePlanned({ strategyProvider: strategyProvider() });
  assert.equal(generated.ok, true);
  const exercise = generated.exercise;
  const chosen = exercise.strategyResult.recommendation.action.type;
  assert.ok([
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CHECK,
    ACTION_TYPES.CALL,
    ACTION_TYPES.BET,
    ACTION_TYPES.RAISE,
    ACTION_TYPES.ALL_IN,
  ].includes(chosen));
  const answered = controller.answer(exercise.id, chosen);
  assert.equal(answered.ok, true, answered.error?.message);
  assert.equal(answered.evaluation.schemaVersion, 'training-answer-evaluation/v1');
});
