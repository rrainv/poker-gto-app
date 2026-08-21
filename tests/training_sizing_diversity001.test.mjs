import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  applyAction,
  applyChance,
  createGameRulesSnapshot,
  getLegalActionSpec,
  initializeHandFromGameRulesSnapshot,
  validatePokerState,
} from '../shared/poker-domain/index.js';
import {
  TRAINING_GENERATION_ERROR_CODES,
  generateTrainingExerciseFromScenarioRequest,
  resolveTrainingRulesCapability,
} from '../app/src/application/training-generator.mjs';
import {
  TRAINING_PLANNER_TARGET_DECISION_TYPES,
  TRAINING_PRACTICE_MODES,
  TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  TRAINING_SESSION_INTENT_SCHEMA_VERSION,
  createTrainingPracticePlannerState,
  createTrainingSessionIntent,
  planTrainingScenario,
} from '../app/src/application/training-practice-planner.mjs';
import { createTrainingSessionController } from '../app/src/application/training-session-controller.mjs';
import {
  TRAINING_POSTFLOP_SIZING_FAMILIES,
  TRAINING_PREFLOP_SIZING_FAMILIES,
  TRAINING_SIZING_FAMILIES,
  TRAINING_SIZING_FAMILY_SCHEMA_VERSION,
  TRAINING_SIZING_POLICY_VERSION,
  realizeCanonicalTrainingSizing,
  trainingSizingFamiliesForStructure,
} from '../app/src/application/training-sizing-policy.mjs';

function rulesSnapshot(seatedPlayers = 6, chipUnitMilliBb = 100) {
  return createGameRulesSnapshot({
    source: {
      kind: 'preset',
      presetId: NO_RAKE_CASH_GAME_RULES_PRESET.id,
      presetRevision: NO_RAKE_CASH_GAME_RULES_PRESET.revision,
    },
    setup: { seatedPlayers },
    definition: {
      ...NO_RAKE_CASH_GAME_RULES_PRESET.definition,
      blinds: {
        ...NO_RAKE_CASH_GAME_RULES_PRESET.definition.blinds,
        chipUnitMilliBb,
      },
    },
  });
}

function strategyProvider(counter = null) {
  return Object.freeze({
    resolve(context) {
      if (counter) counter.count += 1;
      const passive = context.facingSizeBb > 0 ? ACTION_TYPES.CALL : ACTION_TYPES.CHECK;
      const aggressive = context.street === 'preflop'
        ? ACTION_TYPES.RAISE
        : context.facingSizeBb > 0 ? ACTION_TYPES.RAISE : ACTION_TYPES.BET;
      return {
        schemaVersion: 'strategy-result/v1',
        source: context.street === 'preflop' ? 'heuristic_preflop' : 'heuristic_postflop',
        actions: [
          {
            action: { type: passive, amountBb: null, potFraction: null },
            label: passive,
            probability: 0.4,
            evBb: null,
          },
          {
            action: { type: aggressive, amountBb: null, potFraction: null },
            label: aggressive,
            probability: 0.6,
            evBb: null,
          },
        ],
        recommendation: {
          action: { type: aggressive, amountBb: null, potFraction: null },
          label: aggressive,
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

function focusedIntent({
  family = null,
  targetDecisionType = TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN,
  street = 'preflop',
  stackBb = 100,
  tableSize = 6,
  heroPosition = 'BTN',
  seed = 0x51a1c001,
  snapshot = rulesSnapshot(tableSize),
  sessionLength = 10,
} = {}) {
  return createTrainingSessionIntent({
    schemaVersion: TRAINING_SESSION_INTENT_SCHEMA_VERSION,
    mode: TRAINING_PRACTICE_MODES.FOCUSED,
    sessionSeed: seed,
    sessionLength,
    difficulty: 'hard',
    focusPreferences: {
      tableSize,
      heroPosition,
      startingStackBb: stackBb,
      street,
      targetDecisionType,
      requestedSizingFamily: family,
    },
    rulesSnapshot: snapshot,
    rulesCapability: resolveTrainingRulesCapability(snapshot),
    plannerPolicyVersion: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  });
}

function plan(intent, ordinal = 0) {
  const result = planTrainingScenario(
    intent,
    createTrainingPracticePlannerState(intent),
    ordinal,
  );
  assert.equal(result.ok, true, JSON.stringify(result.error));
  return result.request;
}

function generate(request, snapshot, provider = strategyProvider()) {
  const result = generateTrainingExerciseFromScenarioRequest(request, {
    rulesSnapshot: snapshot,
    strategyProvider: provider,
  });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  validatePokerState(result.exercise.pokerState);
  return result.exercise;
}

function sizingMetadata(exercise) {
  return exercise.generationMetadata.scenarioRequest.sizing;
}

function assertCanonicalSizedAction(exercise, family) {
  const sizing = sizingMetadata(exercise);
  assert.equal(sizing.vocabularyVersion, TRAINING_SIZING_FAMILY_SCHEMA_VERSION);
  assert.equal(sizing.policyVersion, TRAINING_SIZING_POLICY_VERSION);
  assert.equal(sizing.requestedSizingFamily, family);
  assert.equal(sizing.realizedSizingFamily, family);
  assert.equal(sizing.realizedLegalAmountToMilliBb % exercise.pokerState.game.chipUnitMilliBb, 0);
  const event = exercise.generationMetadata.events.find((entry) => (
    entry.kind === 'action'
      && entry.action.type === sizing.actionType
      && (entry.action.type === ACTION_TYPES.ALL_IN
        || entry.action.amountToMilliBb === sizing.realizedLegalAmountToMilliBb)
  ));
  assert.ok(event, `${family} action missing from canonical trajectory`);
  if (sizing.actionType === ACTION_TYPES.ALL_IN) {
    assert.equal(event.action.amountToMilliBb, null);
    assert.equal(event.legalActionSpec.allIn.available, true);
    assert.equal(
      event.legalActionSpec.allIn.amountToMilliBb,
      sizing.realizedLegalAmountToMilliBb,
    );
  } else {
    const bounds = event.legalActionSpec[sizing.actionType];
    assert.equal(bounds.available, true);
    assert.ok(sizing.realizedLegalAmountToMilliBb >= bounds.minToMilliBb);
    assert.ok(sizing.realizedLegalAmountToMilliBb <= bounds.maxToMilliBb);
  }
}

test('preflop open and re-raise sizing families realize distinct canonical amount-to actions', () => {
  const snapshot = rulesSnapshot();
  const cases = [
    [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN, {
      minimum: 2000, small: 2200, medium: 2500, large: 3500,
    }],
    [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_3BET, {
      minimum: 3000, small: 4500, medium: 6000, large: 8000,
    }],
    [TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET, {
      minimum: 4000, small: 6800, medium: 9000, large: 12000,
    }],
  ];
  for (const [targetDecisionType, expectedByFamily] of cases) {
    const amounts = [];
    for (const family of TRAINING_PREFLOP_SIZING_FAMILIES.filter((value) => value !== 'all_in')) {
      const request = plan(focusedIntent({ family, targetDecisionType, snapshot }));
      const exercise = generate(request, snapshot);
      assertCanonicalSizedAction(exercise, family);
      assert.equal(sizingMetadata(exercise).realizedLegalAmountToMilliBb, expectedByFamily[family]);
      if (targetDecisionType
        === TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_4BET
        && family === TRAINING_SIZING_FAMILIES.SMALL) {
        assert.equal(sizingMetadata(exercise).rawTargetMilliBb, 6750);
        assert.equal(sizingMetadata(exercise).roundedTargetMilliBb, 6800);
        assert.equal(sizingMetadata(exercise).adjustmentReason, 'rounded_to_chip_unit');
      }
      amounts.push(sizingMetadata(exercise).realizedLegalAmountToMilliBb);
    }
    assert.equal(new Set(amounts).size, amounts.length, targetDecisionType);
  }
});

test('postflop small, medium, large, and overbet families use pot and pot-after-call bases', () => {
  const snapshot = rulesSnapshot();
  const cases = [
    [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET, 'flop', {
      small: 2000, medium: 4000, large: 6000, overbet: 9000,
    }],
    [TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE, 'turn', {
      small: 3600, medium: 6300, large: 9000, overbet: 13000,
    }],
  ];
  for (const [targetDecisionType, street, expectedByFamily] of cases) {
    const amounts = [];
    for (const family of TRAINING_POSTFLOP_SIZING_FAMILIES.filter((value) => value !== 'all_in')) {
      const request = plan(focusedIntent({ family, targetDecisionType, street, snapshot }));
      const exercise = generate(request, snapshot);
      assertCanonicalSizedAction(exercise, family);
      assert.equal(sizingMetadata(exercise).realizedLegalAmountToMilliBb, expectedByFamily[family]);
      amounts.push(sizingMetadata(exercise).realizedLegalAmountToMilliBb);
    }
    assert.equal(new Set(amounts).size, amounts.length, targetDecisionType);
  }
});

test('all-in families use canonical ALL_IN and structural guardrails exclude absurd jams', () => {
  const preflopSnapshot = rulesSnapshot(6);
  const preflopRequest = plan(focusedIntent({
    family: TRAINING_SIZING_FAMILIES.ALL_IN,
    stackBb: 10,
    snapshot: preflopSnapshot,
  }));
  const preflop = generate(preflopRequest, preflopSnapshot);
  assertCanonicalSizedAction(preflop, TRAINING_SIZING_FAMILIES.ALL_IN);
  assert.equal(sizingMetadata(preflop).actionType, ACTION_TYPES.ALL_IN);

  const postflopRequest = plan(focusedIntent({
    family: TRAINING_SIZING_FAMILIES.ALL_IN,
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
    street: 'river',
    stackBb: 10,
    snapshot: preflopSnapshot,
  }));
  const postflop = generate(postflopRequest, preflopSnapshot);
  assertCanonicalSizedAction(postflop, TRAINING_SIZING_FAMILIES.ALL_IN);

  const deep = focusedIntent({
    family: TRAINING_SIZING_FAMILIES.ALL_IN,
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
    street: 'river',
    stackBb: 100,
    snapshot: preflopSnapshot,
  });
  const rejected = planTrainingScenario(deep, createTrainingPracticePlannerState(deep), 0);
  assert.equal(rejected.ok, false);
  assert.ok(rejected.error.details.reasons.includes(
    'sizing_family_not_distinct_or_structurally_eligible',
  ));
});

test('coarse chip units deduplicate collapsed families before planning and diagnostically at realization', () => {
  const snapshot = rulesSnapshot(6, 500);
  const eligible = trainingSizingFamiliesForStructure({
    street: 'preflop',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.PREFLOP_FACING_OPEN,
    startingStackBb: 100,
    tableSize: 6,
    chipUnitMilliBb: 500,
  });
  assert.ok(eligible.includes(TRAINING_SIZING_FAMILIES.MINIMUM));
  assert.equal(eligible.includes(TRAINING_SIZING_FAMILIES.SMALL), false);

  const rejectedIntent = focusedIntent({
    family: TRAINING_SIZING_FAMILIES.SMALL,
    snapshot,
  });
  const rejected = planTrainingScenario(
    rejectedIntent,
    createTrainingPracticePlannerState(rejectedIntent),
    0,
  );
  assert.equal(rejected.ok, false);

  const minimumExercise = generate(plan(focusedIntent({
    family: TRAINING_SIZING_FAMILIES.MINIMUM,
    snapshot,
  })), snapshot);
  let state = initializeHandFromGameRulesSnapshot(
    minimumExercise.generationMetadata.initialConfiguration,
  );
  for (const entry of minimumExercise.generationMetadata.events) {
    if (entry.kind === 'action'
      && entry.action.type === ACTION_TYPES.RAISE
      && entry.action.amountToMilliBb === 2000) break;
    state = entry.kind === 'chance'
      ? applyChance(state, entry.event)
      : applyAction(state, entry.action);
  }
  const realization = realizeCanonicalTrainingSizing({
    state,
    legalActionSpec: getLegalActionSpec(state),
    actionType: ACTION_TYPES.RAISE,
    requestedSizingFamily: TRAINING_SIZING_FAMILIES.SMALL,
    eligibleSizingFamilies: [
      TRAINING_SIZING_FAMILIES.MINIMUM,
      TRAINING_SIZING_FAMILIES.SMALL,
      TRAINING_SIZING_FAMILIES.MEDIUM,
      TRAINING_SIZING_FAMILIES.LARGE,
    ],
  });
  assert.equal(realization.requested.realizedSizingFamily, null);
  assert.equal(realization.requested.deduplicationReason, 'collapsed_to_minimum');
  assert.deepEqual(realization.distinctFamilies, ['minimum', 'medium', 'large']);
});

test('short stacks clamp only to canonical bounds and still respect chip units', () => {
  const snapshot = rulesSnapshot(6);
  const families = trainingSizingFamiliesForStructure({
    street: 'flop',
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
    startingStackBb: 10,
    tableSize: 6,
    chipUnitMilliBb: 100,
  });
  for (const family of families) {
    const request = plan(focusedIntent({
      family,
      targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_BET,
      street: 'flop',
      stackBb: 10,
      snapshot,
    }));
    const exercise = generate(request, snapshot);
    assertCanonicalSizedAction(exercise, family);
    if (family === TRAINING_SIZING_FAMILIES.OVERBET) {
      assert.equal(
        sizingMetadata(exercise).adjustmentReason,
        'clamped_to_canonical_maximum_non_all_in',
      );
    }
  }
});

test('same request is exact, coverage records realized family, and provider resolves once', async () => {
  const snapshot = rulesSnapshot();
  const intent = focusedIntent({
    family: TRAINING_SIZING_FAMILIES.MEDIUM,
    targetDecisionType: TRAINING_PLANNER_TARGET_DECISION_TYPES.POSTFLOP_FACING_RAISE,
    street: 'river',
    snapshot,
    sessionLength: 2,
  });
  const request = plan(intent);
  const first = generateTrainingExerciseFromScenarioRequest(request, {
    rulesSnapshot: snapshot,
    strategyProvider: strategyProvider(),
  });
  const second = generateTrainingExerciseFromScenarioRequest(request, {
    rulesSnapshot: snapshot,
    strategyProvider: strategyProvider(),
  });
  assert.deepEqual(second, first);
  assert.equal(first.exercise.generationMetadata.scenarioRequest.sizing.requestedSizingFamily,
    TRAINING_SIZING_FAMILIES.MEDIUM);

  const counter = { count: 0 };
  const controller = createTrainingSessionController();
  controller.startPracticeSession(intent);
  const served = await controller.generatePlanned({ strategyProvider: strategyProvider(counter) });
  assert.equal(served.ok, true, JSON.stringify(served.error));
  assert.equal(counter.count, 1);
  const coverage = controller.getPracticePlannerState().coverage.sizingFamilies;
  assert.deepEqual(coverage, [{ key: TRAINING_SIZING_FAMILIES.MEDIUM, count: 1 }]);
});

test('unrealizable sizing fails explicitly without substitution', () => {
  const snapshot = rulesSnapshot(6, 500);
  const base = plan(focusedIntent({
    family: TRAINING_SIZING_FAMILIES.MINIMUM,
    snapshot,
  }));
  const forcedCollapsed = {
    ...structuredClone(base),
    requestedSizingFamily: TRAINING_SIZING_FAMILIES.SMALL,
  };
  const result = generateTrainingExerciseFromScenarioRequest(forcedCollapsed, {
    rulesSnapshot: snapshot,
    strategyProvider: strategyProvider(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, TRAINING_GENERATION_ERROR_CODES.UNSUPPORTED_TARGET);
  assert.equal(result.error.details.requestedSizingFamily, TRAINING_SIZING_FAMILIES.SMALL);
  assert.equal(result.error.details.request.requestedSizingFamily, TRAINING_SIZING_FAMILIES.SMALL);
  assert.equal('realizedSizingFamily' in result.error.details, false);
});

test('1k planner-driven distribution smoke realizes every eligible sizing family', {
  timeout: 30000,
}, async (t) => {
  const snapshot = rulesSnapshot();
  const intent = createTrainingSessionIntent({
    schemaVersion: TRAINING_SESSION_INTENT_SCHEMA_VERSION,
    mode: TRAINING_PRACTICE_MODES.VARIED,
    sessionSeed: 0xd1e3517,
    sessionLength: 1000,
    difficulty: 'hard',
    focusPreferences: {
      profile: 'balanced',
      streetEmphasis: null,
      stackPreference: 'balanced',
      allowedTableSizeFamilies: ['heads_up', 'short_handed', 'full_ring'],
    },
    rulesSnapshot: snapshot,
    rulesCapability: resolveTrainingRulesCapability(snapshot),
    plannerPolicyVersion: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  });
  const controller = createTrainingSessionController();
  controller.startPracticeSession(intent);
  const counts = new Map();
  const realizedAmounts = new Map();
  for (let ordinal = 0; ordinal < 1000; ordinal += 1) {
    const result = await controller.generatePlanned({ strategyProvider: strategyProvider() });
    assert.equal(result.ok, true, `ordinal ${ordinal}: ${JSON.stringify(result.error)}`);
    const sizing = sizingMetadata(result.exercise);
    const family = sizing.realizedSizingFamily ?? 'none';
    counts.set(family, (counts.get(family) ?? 0) + 1);
    if (sizing.realizedLegalAmountToMilliBb !== null) {
      if (!realizedAmounts.has(family)) realizedAmounts.set(family, new Set());
      realizedAmounts.get(family).add(sizing.realizedLegalAmountToMilliBb);
    }
  }
  const summary = Object.fromEntries([...counts].sort(([left], [right]) => (
    left.localeCompare(right)
  )));
  assert.deepEqual(Object.keys(summary), [
    'all_in', 'large', 'medium', 'minimum', 'none', 'overbet', 'small',
  ]);
  assert.ok(Object.values(summary).every((count) => count > 0));
  assert.equal(controller.getPracticePlannerState().servedCount, 1000);
  assert.equal(
    [...controller.getPracticePlannerState().coverage.sizingFamilies]
      .reduce((total, entry) => total + entry.count, 0),
    1000,
  );
  t.diagnostic(`sizing distribution ${JSON.stringify(summary)}`);
  t.diagnostic(`distinct realized amounts ${JSON.stringify(Object.fromEntries(
    [...realizedAmounts].map(([family, amounts]) => [family, amounts.size]),
  ))}`);
});
