import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../shared/poker-domain/index.js';
import {
  createRangeObservation,
  createRfiCalibrationContext,
} from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  createPersonalStrategySnapshot,
} from '../app/src/personal-strategy/rfi-inference.mjs';
import {
  RFI_CALIBRATION_INTENTS,
  RFI_CALIBRATION_STOP_REASONS,
  RFI_COLD_START_ANCHORS,
  RFI_QUESTION_REASON_CODES,
  assessCalibrationProgress,
  getNextCalibrationQuestion,
  rankCalibrationCandidates,
  rfiCalibrationStructuralFamily,
} from '../app/src/personal-strategy/rfi-question-selection.mjs';

const PROFILE_ID = 'range-cal002c-profile';
const MODE_ID = 'range-cal002c-mode';
const CONTEXT = createRfiCalibrationContext({
  gameRulesId: 'range-cal002c-tests/v1',
  tableSize: 6,
  heroPosition: 'BTN',
  effectiveStackBb: 100,
});
let nextId = 0;

function direct(handClass, actionType, suffix = '') {
  return createRangeObservation({
    id: `range-cal002c-${++nextId}${suffix}`,
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: CONTEXT,
    handClass,
    dominantAction: { type: actionType },
    createdAt: `2026-08-18T12:${String(nextId % 60).padStart(2, '0')}:00.000Z`,
  });
}

function snapshot(rangeObservations = []) {
  return createPersonalStrategySnapshot(createPersonalStrategyEvidenceView({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: CONTEXT,
    rangeObservations,
  }));
}

test('cold start is deterministic, versioned, structurally diverse, and not a premium-pair walk', () => {
  assert.deepEqual(RFI_COLD_START_ANCHORS.slice(0, 3), ['AA', '72o', '77']);
  const answers = [];
  const selected = [];
  for (let index = 0; index < 7; index += 1) {
    const next = getNextCalibrationQuestion(snapshot(answers), {
      recentQuestionHistory: selected,
    });
    selected.push(next.handClass);
    answers.push(direct(next.handClass, index % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE));
  }
  assert.deepEqual(selected, RFI_COLD_START_ANCHORS.slice(0, 7));
  assert.ok(new Set(selected.map(rfiCalibrationStructuralFamily)).size >= 6);
  assert.notDeepEqual(selected.slice(0, 3), ['AA', 'KK', 'QQ']);
});

test('a suited or pair midpoint between opposing direct neighbors receives boundary priority', () => {
  const suited = rankCalibrationCandidates(snapshot([
    direct('K9s', ACTION_TYPES.RAISE),
    direct('K7s', ACTION_TYPES.FOLD),
  ]));
  const suitedMidpoint = suited.find((entry) => entry.handClass === 'K8s');
  assert.equal(suitedMidpoint.boundaryLikelihood, 'high');
  assert.equal(suitedMidpoint.rank, 1);
  assert.ok(suitedMidpoint.reasonCodes.includes(RFI_QUESTION_REASON_CODES.NEAR_ACTION_BOUNDARY));

  const pairs = rankCalibrationCandidates(snapshot([
    direct('55', ACTION_TYPES.RAISE),
    direct('33', ACTION_TYPES.FOLD),
  ]));
  const pairMidpoint = pairs.find((entry) => entry.handClass === '44');
  assert.equal(pairMidpoint.boundaryLikelihood, 'high');
  assert.equal(pairMidpoint.rank, 1);
  assert.ok(pairMidpoint.reasonCodes.includes(RFI_QUESTION_REASON_CODES.PAIR_BOUNDARY));
});

test('uncertain and sparse candidates outrank stable high inference while exposing transparent components', () => {
  const evidence = [
    direct('AJs', ACTION_TYPES.RAISE),
    direct('ATs', ACTION_TYPES.RAISE),
    direct('KTs', ACTION_TYPES.RAISE),
    direct('K9s', ACTION_TYPES.RAISE),
    direct('Q9s', ACTION_TYPES.RAISE),
    direct('Q8s', ACTION_TYPES.RAISE),
    direct('J8s', ACTION_TYPES.RAISE),
  ];
  const ranked = rankCalibrationCandidates(snapshot(evidence), {
    recentQuestionHistory: evidence.map((entry) => entry.handClass),
  });
  const uncertain = ranked.find((entry) => entry.currentStatus === PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN);
  const high = ranked.find((entry) => entry.currentStatus === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH);
  assert.ok(uncertain);
  assert.ok(high);
  assert.ok(uncertain.rank < high.rank);
  assert.ok(uncertain.components.uncertaintyValue > high.components.uncertaintyValue);
  assert.equal(uncertain.questionValueSemantics, 'deterministic_question_value_not_confidence_or_probability');
});

test('recent repetition is penalized, skipped hands are deferred, and direct hands are excluded', () => {
  const state = snapshot([direct('AA', ACTION_TYPES.RAISE)]);
  const repeatedRegion = rankCalibrationCandidates(state, {
    recentQuestionHistory: ['AKs', 'AQs', 'AJs'],
  });
  const nearby = repeatedRegion.find((entry) => entry.handClass === 'ATs');
  const novel = repeatedRegion.find((entry) => entry.handClass === '72o');
  assert.ok(nearby.components.repetitionPenalty > novel.components.repetitionPenalty);

  const skipped = rankCalibrationCandidates(state, { skippedHandClasses: ['72o'] });
  assert.equal(skipped.some((entry) => entry.handClass === '72o'), false);
  assert.equal(skipped.some((entry) => entry.handClass === 'AA'), false);
});

test('conflicting direct cells require explicit resolution and never loop as ordinary questions', () => {
  const observations = PREFLOP_HAND_CLASSES.flatMap((handClass) => {
    const first = direct(handClass, ACTION_TYPES.RAISE);
    if (handClass !== 'K8s') return [first];
    return [first, direct(handClass, ACTION_TYPES.FOLD, '-conflict')];
  });
  const current = snapshot(observations);
  const ranked = rankCalibrationCandidates(current);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].handClass, 'K8s');
  assert.equal(ranked[0].resolutionNeed, 'explicit_conflict_resolution');
  assert.equal(ranked[0].ordinaryQuestionEligible, false);
  assert.equal(getNextCalibrationQuestion(current, { rankedCandidates: ranked }), null);
  assert.equal(assessCalibrationProgress(current, {
    intent: RFI_CALIBRATION_INTENTS.DEEP,
    rankedCandidates: ranked,
  }).stopReason, RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED);
});

test('ranking is canonical-tie stable and has no random dependency', () => {
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('random selection is forbidden'); };
  try {
    const first = rankCalibrationCandidates(snapshot());
    const second = rankCalibrationCandidates(snapshot());
    assert.deepEqual(first, second);
    for (let index = 1; index < first.length; index += 1) {
      const left = first[index - 1];
      const right = first[index];
      const exactTie = left.priorityTier === right.priorityTier
        && left.questionValueScore === right.questionValueScore
        && left.components.boundaryValue === right.components.boundaryValue
        && left.components.uncertaintyValue === right.components.uncertaintyValue
        && left.components.coverageGainPotential === right.components.coverageGainPotential
        && left.components.noveltyValue === right.components.noveltyValue;
      if (exactTie) assert.ok(left.canonicalIndex < right.canonicalIndex);
    }
  } finally {
    Math.random = originalRandom;
  }
});

test('stopping uses truthful category counts, deterministic budgets, pause, low value, and Ask another override', () => {
  const empty = snapshot();
  const quickBudget = assessCalibrationProgress(empty, {
    intent: RFI_CALIBRATION_INTENTS.QUICK,
    sessionQuestionCount: 5,
  });
  assert.equal(quickBudget.shouldStop, true);
  assert.equal(quickBudget.stopReason, RFI_CALIBRATION_STOP_REASONS.USER_TIME_BUDGET_REACHED);
  assert.deepEqual(quickBudget.attemptedCoverage, { count: 0, total: 169, percent: 0 });
  assert.equal(Object.hasOwn(quickBudget, 'confidence'), false);

  const askAnother = assessCalibrationProgress(empty, {
    intent: RFI_CALIBRATION_INTENTS.QUICK,
    sessionQuestionCount: 5,
    additionalQuestionAllowance: 1,
  });
  assert.equal(askAnother.shouldStop, false);
  const paused = assessCalibrationProgress(empty, {
    intent: RFI_CALIBRATION_INTENTS.STANDARD,
    userPaused: true,
  });
  assert.equal(paused.stopReason, RFI_CALIBRATION_STOP_REASONS.USER_PAUSED);
});

test('stopping distinguishes low value, no candidates, full direct coverage, and conflict resolution', () => {
  const firstFifteen = PREFLOP_HAND_CLASSES.slice(0, 15).map((handClass, index) => (
    direct(handClass, index % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE)
  ));
  const developing = snapshot(firstFifteen);
  const ranked = rankCalibrationCandidates(developing);
  const lowValue = assessCalibrationProgress(developing, {
    intent: RFI_CALIBRATION_INTENTS.STANDARD,
    rankedCandidates: [{ ...ranked[0], questionValueScore: 0 }],
  });
  assert.equal(lowValue.stopReason, RFI_CALIBRATION_STOP_REASONS.LOW_REMAINING_QUESTION_VALUE);
  assert.equal(lowValue.directCount, developing.summary.directlyKnownCount);
  assert.equal(lowValue.inferredHighCount, developing.summary.inferredHighCount);
  assert.equal(lowValue.inferredMediumCount, developing.summary.inferredMediumCount);
  assert.equal(lowValue.uncertainCount, developing.summary.uncertainCount);
  assert.equal(lowValue.unknownCount, developing.summary.unknownCount);

  const noCandidates = assessCalibrationProgress(snapshot(), {
    skippedHandClasses: PREFLOP_HAND_CLASSES,
  });
  assert.equal(noCandidates.stopReason, RFI_CALIBRATION_STOP_REASONS.NO_USEFUL_CANDIDATES);

  const fullEvidence = PREFLOP_HAND_CLASSES.map((handClass) => (
    direct(handClass, ACTION_TYPES.RAISE)
  ));
  const full = assessCalibrationProgress(snapshot(fullEvidence));
  assert.equal(full.stopReason, RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE);

  const lastHand = PREFLOP_HAND_CLASSES.at(-1);
  const conflictEvidence = [
    ...fullEvidence.slice(0, -1),
    direct(lastHand, ACTION_TYPES.RAISE, '-conflict-a'),
    direct(lastHand, ACTION_TYPES.FOLD, '-conflict-b'),
  ];
  const conflict = assessCalibrationProgress(snapshot(conflictEvidence));
  assert.equal(conflict.stopReason, RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED);
  assert.equal(conflict.conflictingCount, 1);
});
