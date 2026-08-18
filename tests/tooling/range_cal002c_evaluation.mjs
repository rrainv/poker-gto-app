import { performance } from 'node:perf_hooks';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../../shared/poker-domain/index.js';
import {
  createRangeObservation,
} from '../../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../../app/src/personal-strategy/evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  createPersonalStrategySnapshot,
} from '../../app/src/personal-strategy/rfi-inference.mjs';
import {
  assessCalibrationProgress,
  getNextCalibrationQuestion,
  rankCalibrationCandidates,
} from '../../app/src/personal-strategy/rfi-question-selection.mjs';
import { RANGE_CAL002B_SYNTHETIC_FIXTURES } from '../fixtures/range_cal002b_synthetic_truth.mjs';
import {
  RANGE_CAL002B_ANSWER_BUDGETS,
  RANGE_CAL002B_CONTEXT,
  RANGE_CAL002B_FIXED_SEEDS,
  RANGE_CAL002B_MODE_ID,
  RANGE_CAL002B_PROFILE_ID,
  is002bTruthBoundary,
} from './range_cal002b_evaluation.mjs';

export const RANGE_CAL002C_EVALUATION_SCHEMA_VERSION = 'range-cal002c-adaptive-comparison/v1';
export const RANGE_CAL002C_SELECTION_METHODS = Object.freeze({
  ADAPTIVE: 'adaptive',
  SEQUENTIAL: 'canonical_sequential',
});

const CREATED_AT = '2026-08-18T14:00:00.000Z';
const ATTEMPTED_STATUSES = new Set([
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM,
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function observationFor(fixture, seed, handClass, suffix = '') {
  const truth = fixture.labels[handClass];
  const mix = fixture.exactMixes[handClass] ?? null;
  const dominantAction = mix
    ? mix.fold === mix.raise
      ? null
      : { type: mix.raise > mix.fold ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD }
    : { type: truth };
  return createRangeObservation({
    id: `002c-${fixture.id}-${seed}-${handClass}${suffix}`,
    profileId: RANGE_CAL002B_PROFILE_ID,
    modeId: RANGE_CAL002B_MODE_ID,
    context: RANGE_CAL002B_CONTEXT,
    handClass,
    dominantAction,
    frequencies: mix ? [
      { action: { type: ACTION_TYPES.FOLD }, probability: mix.fold },
      { action: { type: ACTION_TYPES.RAISE }, probability: mix.raise },
    ] : null,
    createdAt: CREATED_AT,
  });
}

function snapshotFor(rangeObservations) {
  return createPersonalStrategySnapshot(createPersonalStrategyEvidenceView({
    profileId: RANGE_CAL002B_PROFILE_ID,
    modeId: RANGE_CAL002B_MODE_ID,
    context: RANGE_CAL002B_CONTEXT,
    rangeObservations,
  }));
}

function nextHand(snapshot, method, askedHandClasses) {
  if (method === RANGE_CAL002C_SELECTION_METHODS.ADAPTIVE) {
    return getNextCalibrationQuestion(snapshot, {
      recentQuestionHistory: askedHandClasses,
    })?.handClass ?? null;
  }
  if (method === RANGE_CAL002C_SELECTION_METHODS.SEQUENTIAL) {
    const asked = new Set(askedHandClasses);
    return PREFLOP_HAND_CLASSES.find((handClass) => !asked.has(handClass)) ?? null;
  }
  throw new RangeError(`Unsupported RANGE-CAL-002C selection method: ${method}`);
}

function evaluateCheckpoint({
  fixture,
  seed,
  method,
  answerBudget,
  snapshot,
  askedHandClasses,
  evidenceRecordCount,
  becameInferable,
}) {
  const asked = new Set(askedHandClasses);
  const heldOut = snapshot.estimates.filter((entry) => !asked.has(entry.handClass));
  const attempted = heldOut.filter((entry) => ATTEMPTED_STATUSES.has(entry.status));
  const high = attempted.filter((entry) => (
    entry.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH
  ));
  const medium = attempted.filter((entry) => (
    entry.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM
  ));
  const correct = attempted.filter((entry) => (
    entry.dominantAction.type === fixture.labels[entry.handClass]
  ));
  const correctHigh = high.filter((entry) => (
    entry.dominantAction.type === fixture.labels[entry.handClass]
  ));
  const correctMedium = medium.filter((entry) => (
    entry.dominantAction.type === fixture.labels[entry.handClass]
  ));
  const truthBoundaryHands = PREFLOP_HAND_CLASSES.filter((handClass) => (
    is002bTruthBoundary(fixture, handClass)
  ));
  const boundaryDiscoveryCount = askedHandClasses.filter((handClass) => (
    is002bTruthBoundary(fixture, handClass)
  )).length;
  const questionEfficiencyProxy = answerBudget === 0 ? 0
    : (becameInferable.size + boundaryDiscoveryCount * 2) / answerBudget;

  return deepFreeze({
    schemaVersion: RANGE_CAL002C_EVALUATION_SCHEMA_VERSION,
    fixtureId: fixture.id,
    fixtureVersion: fixture.fixtureVersion,
    seed,
    method,
    directAnswerBudget: answerBudget,
    askedHandClasses: [...askedHandClasses],
    directEvidenceRecordCount: evidenceRecordCount,
    heldOutCount: heldOut.length,
    attemptedCount: attempted.length,
    attemptedCoverage: heldOut.length === 0 ? 0 : attempted.length / heldOut.length,
    correctAttemptedCount: correct.length,
    attemptedAccuracy: attempted.length === 0 ? null : correct.length / attempted.length,
    highCount: high.length,
    highAccuracy: high.length === 0 ? null : correctHigh.length / high.length,
    falseHighConfidenceErrors: high.length - correctHigh.length,
    mediumCount: medium.length,
    mediumAccuracy: medium.length === 0 ? null : correctMedium.length / medium.length,
    abstentionCount: heldOut.length - attempted.length,
    abstentionRate: heldOut.length === 0 ? 0 : (heldOut.length - attempted.length) / heldOut.length,
    unknownCount: snapshot.summary.unknownCount,
    uncertainCount: snapshot.summary.uncertainCount,
    conflictingCount: snapshot.summary.conflictingCount,
    truthBoundaryCount: truthBoundaryHands.length,
    boundaryDiscoveryCount,
    boundaryRecovery: truthBoundaryHands.length === 0
      ? 1 : boundaryDiscoveryCount / truthBoundaryHands.length,
    unknownToInferableCount: becameInferable.size,
    questionEfficiencyProxy,
    questionEfficiencySemantics: 'unique_unknown_to_inferable_transitions_plus_twice_direct_truth_boundary_discoveries_per_question',
  });
}

export function evaluateRangeCal002cSequence({
  fixture,
  seed,
  method,
  answerBudgets = RANGE_CAL002B_ANSWER_BUDGETS,
} = {}) {
  if (!fixture?.synthetic) throw new TypeError('A synthetic RANGE-CAL-002B fixture is required');
  if (!Number.isInteger(seed)) throw new TypeError('RANGE-CAL-002C seed must be an integer');
  const requestedBudgets = [...answerBudgets].sort((left, right) => left - right);
  const maximumBudget = requestedBudgets.at(-1) ?? 0;
  let rangeObservations = [];
  let snapshot = snapshotFor(rangeObservations);
  const askedHandClasses = [];
  const becameInferable = new Set();
  const records = [];

  // The contradictory fixture begins with the same independently conflicting
  // direct heads for both methods. This is fixture input, not a selected label,
  // and lets the comparison verify that neither policy turns conflict into an
  // ordinary-question loop.
  if (fixture.conflictingHandClass) {
    const first = observationFor(fixture, seed, fixture.conflictingHandClass);
    const opposite = first.dominantAction?.type === ACTION_TYPES.RAISE
      ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE;
    askedHandClasses.push(fixture.conflictingHandClass);
    rangeObservations = [first, createRangeObservation({
      id: `${first.id}-independent-conflict`,
      profileId: first.profileId,
      modeId: first.modeId,
      context: first.context,
      handClass: first.handClass,
      dominantAction: { type: opposite },
      createdAt: '2026-08-18T14:01:00.000Z',
    })];
    snapshot = snapshotFor(rangeObservations);
  }

  for (let questionNumber = askedHandClasses.length + 1;
    questionNumber <= maximumBudget;
    questionNumber += 1) {
    const beforeByHand = new Map(snapshot.estimates.map((entry) => [entry.handClass, entry.status]));
    const handClass = nextHand(snapshot, method, askedHandClasses);
    if (!handClass) break;
    askedHandClasses.push(handClass);
    const first = observationFor(fixture, seed, handClass);
    rangeObservations = [...rangeObservations, first];
    snapshot = snapshotFor(rangeObservations);
    for (const estimate of snapshot.estimates) {
      if (askedHandClasses.includes(estimate.handClass)) continue;
      if (!ATTEMPTED_STATUSES.has(beforeByHand.get(estimate.handClass))
        && ATTEMPTED_STATUSES.has(estimate.status)) {
        becameInferable.add(estimate.handClass);
      }
    }
    if (requestedBudgets.includes(questionNumber)) {
      records.push(evaluateCheckpoint({
        fixture,
        seed,
        method,
        answerBudget: questionNumber,
        snapshot,
        askedHandClasses,
        evidenceRecordCount: rangeObservations.length,
        becameInferable,
      }));
    }
  }
  return deepFreeze(records);
}

function aggregate(records, dimensions) {
  const heldOut = records.reduce((sum, entry) => sum + entry.heldOutCount, 0);
  const attempted = records.reduce((sum, entry) => sum + entry.attemptedCount, 0);
  const correct = records.reduce((sum, entry) => sum + entry.correctAttemptedCount, 0);
  const high = records.reduce((sum, entry) => sum + entry.highCount, 0);
  const falseHigh = records.reduce((sum, entry) => sum + entry.falseHighConfidenceErrors, 0);
  const medium = records.reduce((sum, entry) => sum + entry.mediumCount, 0);
  const correctMedium = records.reduce((sum, entry) => (
    sum + (entry.mediumAccuracy === null ? 0 : entry.mediumAccuracy * entry.mediumCount)
  ), 0);
  return deepFreeze({
    ...dimensions,
    runs: records.length,
    heldOutCount: heldOut,
    attemptedCount: attempted,
    attemptedCoverage: heldOut === 0 ? 0 : attempted / heldOut,
    attemptedAccuracy: attempted === 0 ? null : correct / attempted,
    highCount: high,
    highAccuracy: high === 0 ? null : (high - falseHigh) / high,
    falseHighConfidenceErrors: falseHigh,
    mediumCount: medium,
    mediumAccuracy: medium === 0 ? null : correctMedium / medium,
    abstentionRate: heldOut === 0 ? 0 : (heldOut - attempted) / heldOut,
    averageUnknownCount: records.reduce((sum, entry) => sum + entry.unknownCount, 0) / records.length,
    averageBoundaryRecovery: records.reduce((sum, entry) => sum + entry.boundaryRecovery, 0) / records.length,
    averageBoundaryDiscoveryCount: records.reduce(
      (sum, entry) => sum + entry.boundaryDiscoveryCount, 0,
    ) / records.length,
    averageUnknownToInferableCount: records.reduce(
      (sum, entry) => sum + entry.unknownToInferableCount, 0,
    ) / records.length,
    averageQuestionEfficiencyProxy: records.reduce(
      (sum, entry) => sum + entry.questionEfficiencyProxy, 0,
    ) / records.length,
  });
}

function grouped(records, keyFor, dimensionsFor) {
  const groups = new Map();
  for (const record of records) {
    const key = keyFor(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()].map((entries) => aggregate(entries, dimensionsFor(entries[0])));
}

export function evaluateRangeCal002cComparison({
  fixtures = RANGE_CAL002B_SYNTHETIC_FIXTURES,
  seeds = RANGE_CAL002B_FIXED_SEEDS,
  answerBudgets = RANGE_CAL002B_ANSWER_BUDGETS,
} = {}) {
  const startedAt = performance.now();
  const records = [];
  for (const fixture of fixtures) {
    for (const method of Object.values(RANGE_CAL002C_SELECTION_METHODS)) {
      const canonicalSeed = seeds[0];
      const deterministicRecords = evaluateRangeCal002cSequence({
        fixture,
        seed: canonicalSeed,
        method,
        answerBudgets,
      });
      for (const seed of seeds) {
        records.push(...deterministicRecords.map((record) => (
          seed === canonicalSeed ? record : deepFreeze({ ...record, seed })
        )));
      }
    }
  }
  return deepFreeze({
    schemaVersion: RANGE_CAL002C_EVALUATION_SCHEMA_VERSION,
    fixtureIds: fixtures.map((fixture) => fixture.id),
    fixtureVersion: fixtures[0]?.fixtureVersion ?? null,
    seeds: [...seeds],
    answerBudgets: [...answerBudgets],
    methods: Object.values(RANGE_CAL002C_SELECTION_METHODS),
    records,
    fixtureBudgetMethod: grouped(
      records,
      (entry) => `${entry.fixtureId}|${entry.directAnswerBudget}|${entry.method}`,
      (entry) => ({
        fixtureId: entry.fixtureId,
        directAnswerBudget: entry.directAnswerBudget,
        method: entry.method,
      }),
    ),
    budgetMethod: grouped(
      records,
      (entry) => `${entry.directAnswerBudget}|${entry.method}`,
      (entry) => ({ directAnswerBudget: entry.directAnswerBudget, method: entry.method }),
    ),
    evaluationRuntimeMs: performance.now() - startedAt,
  });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function benchmarkRangeCal002cSelection({ repetitions = 31 } = {}) {
  const fixture = RANGE_CAL002B_SYNTHETIC_FIXTURES[0];
  const coldSnapshot = snapshotFor([]);
  const coldSamples = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    rankCalibrationCandidates(coldSnapshot);
    coldSamples.push(performance.now() - startedAt);
  }
  const ranked = rankCalibrationCandidates(coldSnapshot);
  const cachedSamples = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    getNextCalibrationQuestion(coldSnapshot, { rankedCandidates: ranked });
    cachedSamples.push(performance.now() - startedAt);
  }
  const answeredSnapshot = snapshotFor([observationFor(fixture, 43, ranked[0].handClass)]);
  const rerankSamples = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    rankCalibrationCandidates(answeredSnapshot, { recentQuestionHistory: [ranked[0].handClass] });
    rerankSamples.push(performance.now() - startedAt);
  }
  const progressSamples = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    assessCalibrationProgress(answeredSnapshot, {
      rankedCandidates: ranked,
      sessionQuestionCount: 1,
    });
    progressSamples.push(performance.now() - startedAt);
  }
  return deepFreeze({
    repetitions,
    coldCandidateRankingMedianMs: median(coldSamples),
    coldCandidateRankingMaximumMs: Math.max(...coldSamples),
    cachedRankingConsumptionMedianMs: median(cachedSamples),
    cachedRankingSemantics: 'state-local ranked-list reuse; no global memoization',
    rerankingAfterAnswerMedianMs: median(rerankSamples),
    rerankingAfterAnswerMaximumMs: Math.max(...rerankSamples),
    progressAssessmentMedianMs: median(progressSamples),
    progressAssessmentMaximumMs: Math.max(...progressSamples),
  });
}
