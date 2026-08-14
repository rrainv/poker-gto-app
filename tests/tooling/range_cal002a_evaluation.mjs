import { performance } from 'node:perf_hooks';

import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
} from '../../shared/poker-domain/index.js';
import {
  RFI_INFERENCE_STATUSES,
  SPARSE_RFI_INFERENCE_MODEL_VERSION,
  createRfiInferenceRequest,
  inferSparseRfiHand,
  rfiHandClassDistance,
} from '../../app/src/personal-strategy/rfi-inference.mjs';
import {
  createRangeObservation,
  createRfiCalibrationContext,
} from '../../app/src/personal-strategy/domain.mjs';
import { SYNTHETIC_RFI_TRUTH_FIXTURES } from '../fixtures/range_cal002a_synthetic_truth.mjs';

export const RANGE_CAL002A_EVALUATION_SCHEMA = 'range-cal002a-holdout-evaluation/v1';
export const RANGE_CAL002A_ANSWER_COUNTS = Object.freeze([10, 20, 30, 40, 50, 75, 100]);
export const RANGE_CAL002A_FIXED_SEEDS = Object.freeze([11, 29, 47, 71, 97]);
export const RANGE_CAL002A_METHODS = Object.freeze({
  PROPOSED: 'sparse-local-neighbors',
  MAJORITY: 'visible-majority',
  NEAREST: 'nearest-observation',
  ABSTAIN: 'abstain-everywhere',
});

export const SYNTHETIC_EVALUATION_PROFILE_ID = 'synthetic-evaluation-profile';
export const SYNTHETIC_EVALUATION_MODE_ID = 'synthetic-evaluation-mode';
export const SYNTHETIC_EVALUATION_CONTEXT = createRfiCalibrationContext({
  gameRulesId: 'range-cal002a-synthetic-evaluation/v1',
  tableSize: 6,
  heroPosition: 'BTN',
  effectiveStackBb: 100,
});

const CREATED_AT = '2026-08-14T15:00:00.000Z';
const HAND_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicVisibleHandClasses({ fixtureId, seed, answerCount }) {
  if (!Number.isInteger(seed)) throw new TypeError('Evaluation seed must be an integer');
  if (!RANGE_CAL002A_ANSWER_COUNTS.includes(answerCount)) {
    throw new RangeError('Evaluation answer count is unsupported');
  }
  return Object.freeze([...PREFLOP_HAND_CLASSES]
    .sort((left, right) => (
      hashText(`${fixtureId}|${seed}|${left}`) - hashText(`${fixtureId}|${seed}|${right}`)
      || HAND_INDEX.get(left) - HAND_INDEX.get(right)
    ))
    .slice(0, answerCount));
}

function observationForTruth(fixture, seed, handClass) {
  const truth = fixture.labels[handClass];
  const tied = truth === null;
  return createRangeObservation({
    id: `synthetic-direct-${fixture.id}-${seed}-${handClass}`,
    profileId: SYNTHETIC_EVALUATION_PROFILE_ID,
    modeId: SYNTHETIC_EVALUATION_MODE_ID,
    context: SYNTHETIC_EVALUATION_CONTEXT,
    handClass,
    dominantAction: tied ? null : { type: truth },
    frequencies: tied ? [
      { action: { type: ACTION_TYPES.FOLD }, probability: 50 },
      { action: { type: ACTION_TYPES.RAISE }, probability: 50 },
    ] : null,
    createdAt: CREATED_AT,
  });
}

export function createLeakageSafeHoldoutSplit({ fixture, seed, answerCount }) {
  if (!fixture?.synthetic || !fixture.labels) throw new TypeError('A synthetic truth fixture is required');
  const visibleHandClasses = deterministicVisibleHandClasses({
    fixtureId: fixture.id,
    seed,
    answerCount,
  });
  const visibleSet = new Set(visibleHandClasses);
  const visibleObservations = visibleHandClasses.map((handClass) => (
    observationForTruth(fixture, seed, handClass)
  ));
  const heldOutHandClasses = PREFLOP_HAND_CLASSES.filter((handClass) => (
    !visibleSet.has(handClass) && fixture.labels[handClass] !== null
  ));
  return deepFreeze({
    fixtureId: fixture.id,
    fixtureVersion: fixture.fixtureVersion,
    seed,
    answerCount,
    visibleHandClasses,
    visibleObservations,
    heldOutHandClasses,
  });
}

function categoricalVisibleObservations(visibleObservations) {
  return visibleObservations.filter((observation) => (
    observation.state === 'active'
    && [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE].includes(observation.dominantAction?.type)
  ));
}

function proposedPrediction(visibleObservations, handClass, inference = inferSparseRfiHand) {
  const request = createRfiInferenceRequest({
    profileId: SYNTHETIC_EVALUATION_PROFILE_ID,
    modeId: SYNTHETIC_EVALUATION_MODE_ID,
    context: SYNTHETIC_EVALUATION_CONTEXT,
    directObservations: visibleObservations,
    requestedHandClass: handClass,
  });
  const result = inference(request);
  return {
    method: RANGE_CAL002A_METHODS.PROPOSED,
    handClass,
    predictedAction: result.status === RFI_INFERENCE_STATUSES.INFERRED
      ? result.dominantAction.type
      : null,
    abstentionReason: result.status === RFI_INFERENCE_STATUSES.ABSTAINED
      ? result.diagnostics.reason
      : null,
    evidenceObservationIds: result.evidenceReferences.map((reference) => reference.observationId),
  };
}

function majorityPrediction(visibleObservations, handClass) {
  const counts = { [ACTION_TYPES.FOLD]: 0, [ACTION_TYPES.RAISE]: 0 };
  for (const observation of categoricalVisibleObservations(visibleObservations)) {
    counts[observation.dominantAction.type] += 1;
  }
  const predictedAction = counts[ACTION_TYPES.FOLD] === counts[ACTION_TYPES.RAISE]
    ? null
    : (counts[ACTION_TYPES.RAISE] > counts[ACTION_TYPES.FOLD]
      ? ACTION_TYPES.RAISE
      : ACTION_TYPES.FOLD);
  return {
    method: RANGE_CAL002A_METHODS.MAJORITY,
    handClass,
    predictedAction,
    abstentionReason: predictedAction === null ? 'visible_majority_tie' : null,
    evidenceObservationIds: [],
  };
}

function nearestPrediction(visibleObservations, handClass) {
  const nearest = categoricalVisibleObservations(visibleObservations)
    .map((observation) => ({
      observation,
      distance: rfiHandClassDistance(observation.handClass, handClass).total,
    }))
    .sort((left, right) => (
      left.distance - right.distance
      || HAND_INDEX.get(left.observation.handClass) - HAND_INDEX.get(right.observation.handClass)
      || left.observation.id.localeCompare(right.observation.id, 'en')
    ))[0] ?? null;
  return {
    method: RANGE_CAL002A_METHODS.NEAREST,
    handClass,
    predictedAction: nearest?.observation.dominantAction.type ?? null,
    abstentionReason: nearest ? null : 'no_categorical_observation',
    evidenceObservationIds: nearest ? [nearest.observation.id] : [],
  };
}

function abstainPrediction(handClass) {
  return {
    method: RANGE_CAL002A_METHODS.ABSTAIN,
    handClass,
    predictedAction: null,
    abstentionReason: 'reference_abstention',
    evidenceObservationIds: [],
  };
}

export function generateHoldoutPredictions({
  visibleObservations,
  heldOutHandClasses,
  inference = inferSparseRfiHand,
} = {}) {
  if (!Array.isArray(visibleObservations) || !Array.isArray(heldOutHandClasses)) {
    throw new TypeError('Visible observations and held-out hand classes are required');
  }
  const predictions = [];
  for (const handClass of heldOutHandClasses) {
    predictions.push(proposedPrediction(visibleObservations, handClass, inference));
    predictions.push(majorityPrediction(visibleObservations, handClass));
    predictions.push(nearestPrediction(visibleObservations, handClass));
    predictions.push(abstainPrediction(handClass));
  }
  return deepFreeze(predictions);
}

function matrixNeighbors(handClass) {
  const index = HAND_INDEX.get(handClass);
  const row = Math.floor(index / 13);
  const column = index % 13;
  return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
    .filter(([neighborRow, neighborColumn]) => (
      neighborRow >= 0 && neighborRow < 13 && neighborColumn >= 0 && neighborColumn < 13
    ))
    .map(([neighborRow, neighborColumn]) => PREFLOP_HAND_CLASSES[neighborRow * 13 + neighborColumn]);
}

export function isSyntheticTruthBoundary(fixture, handClass) {
  const truth = fixture.labels[handClass];
  return matrixNeighbors(handClass).some((neighbor) => fixture.labels[neighbor] !== truth);
}

export function scoreHoldoutPredictions({
  fixture,
  split,
  predictions,
} = {}) {
  const byMethod = new Map(Object.values(RANGE_CAL002A_METHODS).map((method) => [method, []]));
  for (const prediction of predictions) byMethod.get(prediction.method).push(prediction);
  const records = [];
  for (const [method, methodPredictions] of byMethod) {
    const attemptedPredictions = methodPredictions.filter((entry) => entry.predictedAction !== null);
    const correctPredictions = attemptedPredictions.filter(
      (entry) => entry.predictedAction === fixture.labels[entry.handClass],
    );
    const incorrectPredictions = attemptedPredictions.filter(
      (entry) => entry.predictedAction !== fixture.labels[entry.handClass],
    );
    const eligibleHeldOutCells = split.heldOutHandClasses.length;
    const attempted = attemptedPredictions.length;
    const correct = correctPredictions.length;
    const incorrect = incorrectPredictions.length;
    records.push(deepFreeze({
      schemaVersion: RANGE_CAL002A_EVALUATION_SCHEMA,
      fixtureId: fixture.id,
      fixtureVersion: fixture.fixtureVersion,
      inferenceModelVersion: SPARSE_RFI_INFERENCE_MODEL_VERSION,
      seed: split.seed,
      directAnswerCount: split.answerCount,
      directObservationsSupplied: split.visibleObservations.length,
      eligibleHeldOutCells,
      attemptedPredictions: attempted,
      abstentions: eligibleHeldOutCells - attempted,
      coverage: eligibleHeldOutCells === 0 ? 0 : attempted / eligibleHeldOutCells,
      correctAttemptedPredictions: correct,
      incorrectAttemptedPredictions: incorrect,
      attemptedAccuracy: attempted === 0 ? null : correct / attempted,
      totalHeldOutAccuracy: eligibleHeldOutCells === 0 ? 0 : correct / eligibleHeldOutCells,
      errorRate: attempted === 0 ? null : incorrect / attempted,
      incorrectBoundaryPredictions: incorrectPredictions.filter(
        (entry) => isSyntheticTruthBoundary(fixture, entry.handClass),
      ).length,
      method,
    }));
  }
  return deepFreeze(records);
}

export function evaluateFixtureSeedCount({
  fixture,
  seed,
  answerCount,
  inference = inferSparseRfiHand,
} = {}) {
  const split = createLeakageSafeHoldoutSplit({ fixture, seed, answerCount });
  const predictions = generateHoldoutPredictions({
    visibleObservations: split.visibleObservations,
    heldOutHandClasses: split.heldOutHandClasses,
    inference,
  });
  return deepFreeze({
    split,
    predictions,
    records: scoreHoldoutPredictions({ fixture, split, predictions }),
  });
}

export function evaluateRangeCal002aQualityMatrix({
  fixtures = SYNTHETIC_RFI_TRUTH_FIXTURES,
  seeds = RANGE_CAL002A_FIXED_SEEDS,
  answerCounts = RANGE_CAL002A_ANSWER_COUNTS,
  inference = inferSparseRfiHand,
} = {}) {
  const startedAt = performance.now();
  const runs = [];
  for (const fixture of fixtures) {
    for (const answerCount of answerCounts) {
      for (const seed of seeds) {
        runs.push(...evaluateFixtureSeedCount({ fixture, seed, answerCount, inference }).records);
      }
    }
  }
  return deepFreeze({
    schemaVersion: RANGE_CAL002A_EVALUATION_SCHEMA,
    fixtureIds: fixtures.map((fixture) => fixture.id),
    fixtureVersions: [...new Set(fixtures.map((fixture) => fixture.fixtureVersion))],
    seeds: [...seeds],
    answerCounts: [...answerCounts],
    inferenceModelVersion: SPARSE_RFI_INFERENCE_MODEL_VERSION,
    records: runs,
    evaluationRuntimeMs: performance.now() - startedAt,
  });
}

function aggregateGroup(records, dimensions) {
  const directAnswerCount = records[0].directAnswerCount;
  const heldOut = records.reduce((sum, record) => sum + record.eligibleHeldOutCells, 0);
  const attempted = records.reduce((sum, record) => sum + record.attemptedPredictions, 0);
  const correct = records.reduce((sum, record) => sum + record.correctAttemptedPredictions, 0);
  const incorrect = records.reduce((sum, record) => sum + record.incorrectAttemptedPredictions, 0);
  return deepFreeze({
    ...dimensions,
    runs: records.length,
    directAnswerCount,
    directObservationsSupplied: records.reduce(
      (sum, record) => sum + record.directObservationsSupplied,
      0,
    ),
    eligibleHeldOutCells: heldOut,
    attemptedPredictions: attempted,
    abstentions: heldOut - attempted,
    coverage: heldOut === 0 ? 0 : attempted / heldOut,
    correctAttemptedPredictions: correct,
    incorrectAttemptedPredictions: incorrect,
    attemptedAccuracy: attempted === 0 ? null : correct / attempted,
    totalHeldOutAccuracy: heldOut === 0 ? 0 : correct / heldOut,
    errorRate: attempted === 0 ? null : incorrect / attempted,
    incorrectBoundaryPredictions: records.reduce(
      (sum, record) => sum + record.incorrectBoundaryPredictions,
      0,
    ),
  });
}

function grouped(records, keyFor, dimensionsFor) {
  const groups = new Map();
  for (const record of records) {
    const key = keyFor(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()].map((entries) => aggregateGroup(entries, dimensionsFor(entries[0])));
}

export function summarizeQualityMatrix(evaluation) {
  const fixtureSpecific = grouped(
    evaluation.records,
    (record) => `${record.method}|${record.fixtureId}|${record.directAnswerCount}`,
    (record) => ({
      method: record.method,
      fixtureId: record.fixtureId,
      directAnswerCount: record.directAnswerCount,
    }),
  );
  const aggregate = grouped(
    evaluation.records,
    (record) => `${record.method}|${record.directAnswerCount}`,
    (record) => ({ method: record.method, directAnswerCount: record.directAnswerCount }),
  );
  return deepFreeze({ fixtureSpecific, aggregate });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function benchmarkRangeCal002aInference({ repetitions = 101, completeEvaluation = null } = {}) {
  const fixture = SYNTHETIC_RFI_TRUTH_FIXTURES[0];
  const split = createLeakageSafeHoldoutSplit({ fixture, seed: 29, answerCount: 40 });
  const target = split.heldOutHandClasses[0];
  const request = createRfiInferenceRequest({
    profileId: SYNTHETIC_EVALUATION_PROFILE_ID,
    modeId: SYNTHETIC_EVALUATION_MODE_ID,
    context: SYNTHETIC_EVALUATION_CONTEXT,
    directObservations: split.visibleObservations,
    requestedHandClass: target,
  });
  const oneHandSamples = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    inferSparseRfiHand(request);
    oneHandSamples.push(performance.now() - startedAt);
  }
  const allStartedAt = performance.now();
  const unanswered = PREFLOP_HAND_CLASSES.filter(
    (handClass) => !split.visibleHandClasses.includes(handClass),
  );
  for (const handClass of unanswered) {
    inferSparseRfiHand(createRfiInferenceRequest({
      profileId: SYNTHETIC_EVALUATION_PROFILE_ID,
      modeId: SYNTHETIC_EVALUATION_MODE_ID,
      context: SYNTHETIC_EVALUATION_CONTEXT,
      directObservations: split.visibleObservations,
      requestedHandClass: handClass,
    }));
  }
  const allUnansweredMs = performance.now() - allStartedAt;
  const matrix = completeEvaluation ?? evaluateRangeCal002aQualityMatrix();
  return deepFreeze({
    oneRequestedHandMedianMs: median(oneHandSamples),
    oneRequestedHandMinimumMs: Math.min(...oneHandSamples),
    oneRequestedHandMaximumMs: Math.max(...oneHandSamples),
    allUnansweredCellCount: unanswered.length,
    allUnansweredCellsMs: allUnansweredMs,
    completeEvaluationMatrixMs: matrix.evaluationRuntimeMs,
    completeEvaluationRunRecords: matrix.records.length,
  });
}
