import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

import {
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  createGameRulesSnapshot,
} from '../shared/poker-domain/game-rules.js';
import { POSITIONS_BY_TABLE_SIZE } from '../shared/poker-domain/positions.js';
import {
  TRAINING_DECISION_TYPES,
  TRAINING_RULES_CAPABILITY_REASON_CODES,
  resolveTrainingRulesCapability,
} from '../app/src/application/training-generator.mjs';
import {
  TRAINING_PLANNER_HISTORY_LIMITS,
  TRAINING_PLANNER_STACK_ANCHORS_BB,
  TRAINING_PLANNER_TARGET_DECISION_TYPES,
  TRAINING_PRACTICE_MODES,
  TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  TRAINING_PRACTICE_PLANNING_ERROR_CODES,
  TRAINING_SCENARIO_REQUEST_SCHEMA_VERSION,
  TRAINING_SESSION_INTENT_SCHEMA_VERSION,
  calculateTrainingPracticeRecencyPenalty,
  createTrainingPracticePlannerState,
  createTrainingScenarioRequest,
  createTrainingSessionIntent,
  mixTrainingPlannerSeed,
  planTrainingScenario,
  recordServedTrainingScenario,
  restoreTrainingPracticePlannerState,
  trainingScenarioExactFingerprint,
  trainingScenarioStructuralFingerprint,
  trainingSessionIntentFingerprint,
  trainingStackBucket,
  validateTrainingPracticePlannerState,
  validateTrainingScenarioRequest,
  validateTrainingSessionIntent,
} from '../app/src/application/training-practice-planner.mjs';

const ALL_TABLE_FAMILIES = Object.freeze(['heads_up', 'short_handed', 'full_ring']);

function snapshotFromPreset(preset, seatedPlayers = preset.setupDefaults.seatedPlayers, tableSize = null) {
  const definition = tableSize === null
    ? preset.definition
    : { ...structuredClone(preset.definition), tableSize };
  return createGameRulesSnapshot({
    source: {
      kind: 'preset',
      presetId: preset.id,
      presetRevision: preset.revision,
    },
    setup: { seatedPlayers },
    definition,
  });
}

function noRakeSnapshot() {
  return snapshotFromPreset(NO_RAKE_CASH_GAME_RULES_PRESET, 6);
}

function variedIntentInput(overrides = {}) {
  const rulesSnapshot = overrides.rulesSnapshot ?? noRakeSnapshot();
  return {
    schemaVersion: TRAINING_SESSION_INTENT_SCHEMA_VERSION,
    mode: TRAINING_PRACTICE_MODES.VARIED,
    sessionSeed: 0x12345678,
    sessionLength: 100,
    difficulty: 'hard',
    focusPreferences: {
      profile: 'balanced',
      streetEmphasis: null,
      stackPreference: 'balanced',
      allowedTableSizeFamilies: [...ALL_TABLE_FAMILIES],
    },
    rulesSnapshot,
    rulesCapability: resolveTrainingRulesCapability(rulesSnapshot),
    plannerPolicyVersion: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
    ...overrides,
  };
}

function focusedIntentInput(focusPreferences = {}, overrides = {}) {
  const rulesSnapshot = overrides.rulesSnapshot ?? noRakeSnapshot();
  return {
    schemaVersion: TRAINING_SESSION_INTENT_SCHEMA_VERSION,
    mode: TRAINING_PRACTICE_MODES.FOCUSED,
    sessionSeed: 17,
    sessionLength: 100,
    difficulty: 'guided',
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
  };
}

function requirePlan(intent, state, ordinal) {
  const result = planTrainingScenario(intent, state, ordinal);
  assert.equal(result.ok, true, result.error?.message);
  return result.request;
}

function runSequence(intent, count = intent.sessionLength) {
  let state = createTrainingPracticePlannerState(intent);
  const requests = [];
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    const request = requirePlan(intent, state, ordinal);
    requests.push(request);
    state = recordServedTrainingScenario(state, request);
  }
  return { requests, state };
}

function counterMap(state, key) {
  return new Map(state.coverage[key].map((entry) => [entry.key, entry.count]));
}

function firstPreflopPosition(tableSize) {
  if (tableSize <= 3) return 'BTN';
  return POSITIONS_BY_TABLE_SIZE[tableSize].find(
    (position) => !['BTN', 'SB', 'BB'].includes(position),
  );
}

test('TrainingSessionIntent v1 is strict, immutable, and consumes the actual capability seam', () => {
  const mutableInput = structuredClone(variedIntentInput());
  const before = structuredClone(mutableInput);
  const intent = createTrainingSessionIntent(mutableInput);

  assert.deepEqual(mutableInput, before);
  assert.equal(intent.schemaVersion, TRAINING_SESSION_INTENT_SCHEMA_VERSION);
  assert.equal(intent.rulesCapability.schemaVersion, 'training-rules-capability/v1');
  assert.equal(intent.rulesCapability.supported, true);
  assert.equal(Object.isFrozen(intent), true);
  assert.equal(Object.isFrozen(intent.focusPreferences), true);
  assert.equal(Object.isFrozen(intent.rulesSnapshot), true);
  assert.equal(validateTrainingSessionIntent(intent), intent);

  mutableInput.focusPreferences.profile = 'more_preflop';
  mutableInput.focusPreferences.allowedTableSizeFamilies.pop();
  assert.equal(intent.focusPreferences.profile, 'balanced');
  assert.deepEqual(intent.focusPreferences.allowedTableSizeFamilies, ALL_TABLE_FAMILIES);

  assert.throws(
    () => createTrainingSessionIntent({ ...variedIntentInput(), unexpected: true }),
    /must contain exactly/,
  );
  assert.throws(
    () => createTrainingSessionIntent({
      ...variedIntentInput(),
      focusPreferences: {
        ...variedIntentInput().focusPreferences,
        profile: 'every_dimension_knob',
      },
    }),
    /Unsupported Varied profile/,
  );
  assert.throws(
    () => createTrainingSessionIntent({
      ...variedIntentInput(),
      rulesCapability: {
        ...variedIntentInput().rulesCapability,
        supported: true,
        reasonCode: 'contradictory',
      },
    }),
    /inconsistent/,
  );
});

test('planner target envelopes remain exactly compatible with canonical generator target names', () => {
  assert.deepEqual(
    Object.values(TRAINING_PLANNER_TARGET_DECISION_TYPES).sort(),
    Object.values(TRAINING_DECISION_TYPES).sort(),
  );
});

test('TrainingScenarioRequest v1 is strict, immutable, and rejects illegal structural facts', () => {
  const intent = createTrainingSessionIntent(focusedIntentInput());
  const state = createTrainingPracticePlannerState(intent);
  const request = requirePlan(intent, state, 0);

  assert.equal(request.schemaVersion, TRAINING_SCENARIO_REQUEST_SCHEMA_VERSION);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.planning.score), true);
  assert.equal(validateTrainingScenarioRequest(request), request);
  assert.equal('pokerState' in request, false);
  assert.equal('cards' in request, false);
  assert.equal('actions' in request, false);
  assert.equal('potBb' in request, false);
  assert.equal('buttonSeat' in request, false);

  assert.throws(
    () => createTrainingScenarioRequest({ ...structuredClone(request), extra: true }),
    /must contain exactly/,
  );
  assert.throws(
    () => createTrainingScenarioRequest({
      ...structuredClone(request),
      tableSize: 2,
      heroPosition: 'UTG',
    }),
    /does not belong to tableSize/,
  );
  assert.throws(
    () => createTrainingScenarioRequest({
      ...structuredClone(request),
      street: 'river',
    }),
    /does not support street/,
  );
});

test('all canonical table/position pairs from 2 through 10 plan legally in Focused mode', () => {
  for (let tableSize = 2; tableSize <= 10; tableSize += 1) {
    for (const heroPosition of POSITIONS_BY_TABLE_SIZE[tableSize]) {
      const intent = createTrainingSessionIntent(focusedIntentInput({
        tableSize,
        heroPosition,
        street: 'flop',
        targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FIRST_ACTION,
      }));
      const request = requirePlan(intent, createTrainingPracticePlannerState(intent), 0);
      assert.equal(request.tableSize, tableSize);
      assert.equal(request.heroPosition, heroPosition);
      assert.ok(POSITIONS_BY_TABLE_SIZE[tableSize].includes(request.heroPosition));
    }
  }
});

test('stack anchors and bucket boundaries follow the versioned 10-300bb Varied policy', () => {
  assert.deepEqual(TRAINING_PLANNER_STACK_ANCHORS_BB, [
    10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 125, 150, 200, 250, 300,
  ]);
  const cases = [
    [10, 'short'], [20, 'short'],
    [20.1, 'shallow'], [40, 'shallow'],
    [40.1, 'medium'], [80, 'medium'],
    [80.1, 'standard'], [150, 'standard'],
    [150.1, 'deep'], [300, 'deep'],
    [300.1, 'extended_deep'], [500, 'extended_deep'],
  ];
  for (const [stack, expected] of cases) assert.equal(trainingStackBucket(stack), expected);
  assert.throws(() => trainingStackBucket(9.99), /10 through 500/);
  assert.throws(() => trainingStackBucket(501), /10 through 500/);

  const intent = createTrainingSessionIntent(variedIntentInput({ sessionLength: 1000 }));
  const { requests } = runSequence(intent, 1000);
  assert.ok(requests.every((request) => TRAINING_PLANNER_STACK_ANCHORS_BB.includes(
    request.startingStackBb,
  )));
  assert.ok(requests.every((request) => request.startingStackBb <= 300));
});

test('planner seed mixing is deterministic, preserves seed 0, and avalanches adjacent seeds', () => {
  const first = mixTrainingPlannerSeed(0, 0, 'candidate-a', 'test-stream');
  assert.equal(first, mixTrainingPlannerSeed(0, 0, 'candidate-a', 'test-stream'));
  assert.notEqual(first, mixTrainingPlannerSeed(0x9e3779b9, 0, 'candidate-a', 'test-stream'));
  assert.notEqual(first, mixTrainingPlannerSeed(1, 0, 'candidate-a', 'test-stream'));
  assert.notEqual(first, mixTrainingPlannerSeed(0, 1, 'candidate-a', 'test-stream'));
  assert.notEqual(first, mixTrainingPlannerSeed(0, 0, 'candidate-b', 'test-stream'));

  const adjacent = Array.from({ length: 256 }, (_, seed) => (
    mixTrainingPlannerSeed(seed, 7, 'stable-candidate', 'adjacent-seed-test')
  ));
  assert.ok(new Set(adjacent).size >= 250);
});

test('same intent, state, and ordinals reproduce an identical deterministic request sequence', () => {
  const input = variedIntentInput({ sessionSeed: 0, sessionLength: 128 });
  const firstIntent = createTrainingSessionIntent(structuredClone(input));
  const secondIntent = createTrainingSessionIntent(structuredClone(input));
  const first = runSequence(firstIntent);
  const second = runSequence(secondIntent);

  assert.deepEqual(first.requests, second.requests);
  assert.deepEqual(first.state, second.state);
  assert.equal(
    trainingSessionIntentFingerprint(firstIntent),
    trainingSessionIntentFingerprint(secondIntent),
  );

  const state = createTrainingPracticePlannerState(firstIntent);
  assert.deepEqual(
    planTrainingScenario(firstIntent, state, 0),
    planTrainingScenario(firstIntent, state, 0),
  );
});

test('adjacent session seeds produce meaningfully different structural sequences', () => {
  const firstIntent = createTrainingSessionIntent(variedIntentInput({
    sessionSeed: 1000,
    sessionLength: 64,
  }));
  const secondIntent = createTrainingSessionIntent(variedIntentInput({
    sessionSeed: 1001,
    sessionLength: 64,
  }));
  const first = runSequence(firstIntent).requests.map(trainingScenarioExactFingerprint);
  const second = runSequence(secondIntent).requests.map(trainingScenarioExactFingerprint);
  const differentOrdinals = first.filter((fingerprint, index) => fingerprint !== second[index]).length;
  assert.ok(differentOrdinals >= 48, `only ${differentOrdinals}/64 ordinals differed`);
});

test('coverage advances only after served success and updates both justified joint counters', () => {
  const intent = createTrainingSessionIntent(variedIntentInput());
  const state = createTrainingPracticePlannerState(intent);
  const stateBefore = structuredClone(state);
  const request = requirePlan(intent, state, 0);

  assert.deepEqual(state, stateBefore, 'planning alone must not count coverage');
  const next = recordServedTrainingScenario(state, request);
  assert.equal(state.servedCount, 0);
  assert.equal(next.servedCount, 1);
  for (const key of Object.keys(next.coverage)) {
    assert.equal(next.coverage[key].reduce((sum, entry) => sum + entry.count, 0), 1, key);
  }
  assert.equal(
    counterMap(next, 'tableSizeHeroPositions').get(`${request.tableSize}:${request.heroPosition}`),
    1,
  );
  assert.equal(
    counterMap(next, 'streetTargetDecisionTypes').get(
      `${request.street}:${request.targetDecisionType}`,
    ),
    1,
  );
  assert.equal(
    counterMap(next, 'sizingFamilies').get(request.requestedSizingFamily ?? 'none'),
    1,
  );
});

test('sizing-family recency discourages repeating the same family', () => {
  const intent = createTrainingSessionIntent(focusedIntentInput({
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN,
    requestedSizingFamily: 'large',
  }));
  const initial = createTrainingPracticePlannerState(intent);
  const first = requirePlan(intent, initial, 0);
  const served = recordServedTrainingScenario(initial, first, {
    realizedSizingFamily: 'large',
  });
  const base = {
    ...first,
    tableSize: 10,
    heroPosition: 'UTG+2',
    startingStackBb: 250,
    stackBucket: 'deep',
    street: 'river',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE,
    facingCategory: 'raise',
  };
  const repeatedFamily = calculateTrainingPracticeRecencyPenalty(served, {
    ...base,
    requestedSizingFamily: 'large',
  });
  const differentFamily = calculateTrainingPracticeRecencyPenalty(served, {
    ...base,
    requestedSizingFamily: 'medium',
  });
  assert.ok(repeatedFamily > differentFamily);
  assert.equal(repeatedFamily - differentFamily, 60);
});

test('recent structural history and exact fingerprint memory remain bounded', () => {
  const intent = createTrainingSessionIntent(focusedIntentInput({}, { sessionLength: 100 }));
  const { state } = runSequence(intent, 100);
  assert.equal(state.servedCount, 100);
  assert.equal(
    state.recentStructuralRecords.length,
    TRAINING_PLANNER_HISTORY_LIMITS.recentStructuralRecords,
  );
  assert.equal(
    state.recentExactFingerprints.length,
    TRAINING_PLANNER_HISTORY_LIMITS.recentExactFingerprints,
  );
  assert.ok(JSON.stringify(state).length < 50000);
  assert.equal(validateTrainingPracticePlannerState(state), state);
});

test('exact and structural recency receive bounded penalties without becoming illegal', () => {
  const intent = createTrainingSessionIntent(focusedIntentInput({
    tableSize: 6,
    heroPosition: 'BTN',
    startingStackBb: 10,
  }));
  const initial = createTrainingPracticePlannerState(intent);
  const first = requirePlan(intent, initial, 0);
  const served = recordServedTrainingScenario(initial, first);
  const exactPenalty = calculateTrainingPracticeRecencyPenalty(served, first);

  const structurallySimilar = {
    ...first,
    startingStackBb: 15,
    stackBucket: 'short',
  };
  const structuralPenalty = calculateTrainingPracticeRecencyPenalty(served, structurallySimilar);
  const unrelated = {
    ...first,
    tableSize: 10,
    heroPosition: 'UTG+2',
    startingStackBb: 250,
    stackBucket: 'deep',
    street: 'river',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE,
    facingCategory: 'raise',
    requestedSizingFamily: 'large',
  };
  const unrelatedPenalty = calculateTrainingPracticeRecencyPenalty(served, unrelated);

  assert.ok(exactPenalty > structuralPenalty);
  assert.ok(structuralPenalty > unrelatedPenalty);
  assert.equal(unrelatedPenalty, 0);
  assert.ok(Number.isSafeInteger(exactPenalty));
  assert.ok(exactPenalty < 100000);

  const repeated = requirePlan(intent, served, 1);
  assert.equal(trainingScenarioExactFingerprint(repeated), trainingScenarioExactFingerprint(first));
  assert.equal(repeated.planning.score.recencyPenalty, 0, 'Focused constraints override recency');
});

test('unsupported fixed-collection rules fail explicitly without a no-rake substitution', () => {
  const fixedSnapshot = snapshotFromPreset(
    FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
    7,
  );
  const capability = resolveTrainingRulesCapability(fixedSnapshot);
  assert.equal(capability.supported, false);
  assert.equal(
    capability.reasonCode,
    TRAINING_RULES_CAPABILITY_REASON_CODES.FIXED_COLLECTION_UNSUPPORTED,
  );
  const intent = createTrainingSessionIntent(variedIntentInput({
    rulesSnapshot: fixedSnapshot,
    rulesCapability: capability,
  }));
  const state = createTrainingPracticePlannerState(intent);
  const result = planTrainingScenario(intent, state, 0);

  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRAINING_PRACTICE_PLANNING_ERROR_CODES.UNSUPPORTED_RULES);
  assert.equal(result.error.details.capability.reasonCode, capability.reasonCode);
  assert.equal(result.error.details.rulesSemanticFingerprint, fixedSnapshot.semanticFingerprint);
  assert.equal('request' in result, false);
  assert.equal(state.servedCount, 0);
  assert.equal(intent.rulesSnapshot.definition.collectionPolicy.type, 'fixed_per_seated_player');
});

test('Focused mode preserves every exact supported constraint', () => {
  const intent = createTrainingSessionIntent(focusedIntentInput({
    tableSize: 10,
    heroPosition: 'UTG+2',
    startingStackBb: 37.5,
    street: 'turn',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
  }, {
    difficulty: 'easy',
    sessionSeed: 0,
  }));
  const request = requirePlan(intent, createTrainingPracticePlannerState(intent), 0);

  assert.deepEqual({
    tableSize: request.tableSize,
    heroPosition: request.heroPosition,
    startingStackBb: request.startingStackBb,
    street: request.street,
    targetDecisionType: request.targetDecisionType,
    difficulty: request.difficulty,
  }, {
    tableSize: 10,
    heroPosition: 'UTG+2',
    startingStackBb: 37.5,
    street: 'turn',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
    difficulty: 'easy',
  });
  assert.deepEqual(request.planning.reasonCodes, ['focused_exact_constraints']);
  assert.deepEqual(request.planning.relaxations, []);
});

test('Focused impossible combinations fail instead of changing any constraint', () => {
  const impossibleCases = [
    {
      tableSize: 2,
      heroPosition: 'UTG',
    },
    {
      street: 'river',
      targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED,
    },
    {
      tableSize: 4,
      heroPosition: 'CO',
      targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN,
    },
    {
      startingStackBb: 9,
    },
  ];
  for (const focus of impossibleCases) {
    const intent = createTrainingSessionIntent(focusedIntentInput(focus));
    const result = planTrainingScenario(intent, createTrainingPracticePlannerState(intent), 0);
    assert.equal(result.ok, false, JSON.stringify(focus));
    assert.equal(
      result.error.code,
      TRAINING_PRACTICE_PLANNING_ERROR_CODES.IMPOSSIBLE_FOCUSED_REQUEST,
    );
    assert.ok(result.error.details.reasons.length > 0);
    assert.equal('request' in result, false);
  }
});

test('Varied mode excludes known impossible structural pairs and avoids recent exact repeats', () => {
  const intent = createTrainingSessionIntent(variedIntentInput({ sessionLength: 1000 }));
  let state = createTrainingPracticePlannerState(intent);
  for (let ordinal = 0; ordinal < 1000; ordinal += 1) {
    const request = requirePlan(intent, state, ordinal);
    assert.ok(request.planning.excludedStructuralPairCount > 0);
    assert.ok(POSITIONS_BY_TABLE_SIZE[request.tableSize].includes(request.heroPosition));
    assert.equal(
      state.recentExactFingerprints.includes(trainingScenarioExactFingerprint(request)),
      false,
      `recent exact repeat at ordinal ${ordinal}`,
    );
    if (request.targetDecisionType
      === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_BB_OPTION) {
      assert.equal(request.heroPosition, 'BB');
    }
    if (request.targetDecisionType
      === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_UNOPENED) {
      assert.notEqual(request.heroPosition, 'BB');
    }
    if ([
      TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN,
      TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET,
    ].includes(request.targetDecisionType)) {
      assert.notEqual(request.heroPosition, firstPreflopPosition(request.tableSize));
    }
    state = recordServedTrainingScenario(state, request);
  }
  assert.equal(state.relaxationCount, 0);
});

test('Varied mode records controlled recency relaxation when a broad candidate space is exhausted', () => {
  const constrainedSnapshot = snapshotFromPreset(
    NO_RAKE_CASH_GAME_RULES_PRESET,
    2,
    { minimumSeated: 2, maximumSeated: 2 },
  );
  const intent = createTrainingSessionIntent(variedIntentInput({
    sessionSeed: 7,
    sessionLength: 300,
    rulesSnapshot: constrainedSnapshot,
    rulesCapability: resolveTrainingRulesCapability(constrainedSnapshot),
    focusPreferences: {
      profile: 'more_postflop',
      streetEmphasis: 'river',
      stackPreference: 'short',
      allowedTableSizeFamilies: ['heads_up'],
    },
  }));
  const { requests, state } = runSequence(intent, 300);
  const relaxed = requests.filter((request) => request.planning.relaxations.length > 0);
  assert.ok(relaxed.length > 0);
  assert.ok(relaxed.some((request) => (
    request.planning.relaxations.includes('structural_recency_pool_exhausted')
  )));
  assert.equal(state.relaxationCount, relaxed.length);
});

test('planner state serializes, round-trips, and remains deterministic without mutating callers', () => {
  const intentInput = structuredClone(variedIntentInput({ sessionLength: 20 }));
  const intentInputBefore = structuredClone(intentInput);
  const intent = createTrainingSessionIntent(intentInput);
  let state = createTrainingPracticePlannerState(intent);
  for (let ordinal = 0; ordinal < 10; ordinal += 1) {
    const stateBefore = structuredClone(state);
    const request = requirePlan(intent, state, ordinal);
    assert.deepEqual(state, stateBefore);
    state = recordServedTrainingScenario(state, request);
  }
  assert.deepEqual(intentInput, intentInputBefore);

  const restored = restoreTrainingPracticePlannerState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored, state);
  assert.equal(Object.isFrozen(restored), true);
  assert.deepEqual(
    planTrainingScenario(intent, restored, 10),
    planTrainingScenario(intent, state, 10),
  );
});

test('deterministic 10k distribution covers every eligible marginal category without starvation', {
  timeout: 30000,
}, () => {
  const intent = createTrainingSessionIntent(variedIntentInput({
    sessionSeed: 0xdecafbad,
    sessionLength: 10000,
  }));
  let state = createTrainingPracticePlannerState(intent);
  const startedAt = performance.now();
  for (let ordinal = 0; ordinal < 10000; ordinal += 1) {
    const request = requirePlan(intent, state, ordinal);
    state = recordServedTrainingScenario(state, request);
  }
  const elapsedMs = performance.now() - startedAt;

  const expectedCategoryCounts = {
    streets: 4,
    targetDecisionTypes: 8,
    tableSizes: 9,
    heroPositions: 10,
    stackBuckets: 5,
    facingCategories: 7,
    streetTargetDecisionTypes: 14,
  };
  for (const [key, expectedCount] of Object.entries(expectedCategoryCounts)) {
    assert.equal(state.coverage[key].length, expectedCount, key);
    assert.ok(state.coverage[key].every((entry) => entry.count > 0), key);
  }
  assert.equal(state.coverage.tableSizeHeroPositions.length, 54);
  assert.ok(state.coverage.tableSizeHeroPositions.every((entry) => entry.count > 0));
  assert.deepEqual(
    state.coverage.sizingFamilies.map((entry) => entry.key),
    ['all_in', 'large', 'medium', 'minimum', 'none', 'overbet', 'small'],
  );
  assert.equal(state.servedCount, 10000);
  assert.equal(state.recentStructuralRecords.length, 32);
  assert.equal(state.recentExactFingerprints.length, 64);
  assert.ok(JSON.stringify(state).length < 50000);
  assert.ok(elapsedMs < 20000, `10k planning took ${elapsedMs.toFixed(1)}ms`);
});

test('planner module imports no DOM, StrategyProvider, PokerState, or generator authority', () => {
  const source = fs.readFileSync(
    new URL('../app/src/application/training-practice-planner.mjs', import.meta.url),
    'utf8',
  );
  const importLines = source.split(/\r?\n/).filter((line) => line.startsWith('import '));
  assert.equal(importLines.length, 4);
  assert.ok(importLines.slice(0, 3).every((line) => (
    /shared\/poker-domain\/(?:game-rules|positions|schema)\.js/.test(line)
  )));
  assert.match(source, /from '\.\/training-sizing-policy\.mjs'/);
  assert.doesNotMatch(source, /training-generator|strategy-provider|initializeHand|initialize-hand/);
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|querySelector|createElement/);
  assert.doesNotMatch(source, /Math\.random|Date\.now|performance\.now/);
});
