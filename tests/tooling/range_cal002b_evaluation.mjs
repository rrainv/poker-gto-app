import { performance } from 'node:perf_hooks';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../../shared/poker-domain/index.js';
import {
  createRangeObservation,
  createRfiCalibrationContext,
} from '../../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../../app/src/personal-strategy/evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  RFI_INFERENCE_MODEL_VERSION,
  createPersonalStrategySnapshot,
  estimatePersonalStrategyHand,
} from '../../app/src/personal-strategy/rfi-inference.mjs';
import { createPersonalStrategyProjectionService } from '../../app/src/personal-strategy/projection-service.mjs';
import { RANGE_CAL002B_SYNTHETIC_FIXTURES } from '../fixtures/range_cal002b_synthetic_truth.mjs';

export const RANGE_CAL002B_EVALUATION_SCHEMA_VERSION = 'range-cal002b-holdout-evaluation/v1';
export const RANGE_CAL002B_ANSWER_BUDGETS = Object.freeze([10, 20, 30, 40, 50, 75]);
export const RANGE_CAL002B_FIXED_SEEDS = Object.freeze([17, 43, 89]);
export const RANGE_CAL002B_PROFILE_ID = 'range-cal002b-validation-profile';
export const RANGE_CAL002B_MODE_ID = 'range-cal002b-validation-mode';
export const RANGE_CAL002B_CONTEXT = createRfiCalibrationContext({
  gameRulesId: 'range-cal002b-synthetic-validation/v1',
  tableSize: 6,
  heroPosition: 'BTN',
  effectiveStackBb: 100,
});

const CREATED_AT = '2026-08-18T12:00:00.000Z';
const HAND_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));
const ATTEMPTED_STATUSES = new Set([
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH,
  PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM,
]);

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

export function deterministic002bVisibleHandClasses({ fixture, seed, answerBudget }) {
  if (!fixture?.synthetic) throw new TypeError('A synthetic RANGE-CAL-002B fixture is required');
  if (!Number.isInteger(seed)) throw new TypeError('RANGE-CAL-002B seed must be an integer');
  if (!RANGE_CAL002B_ANSWER_BUDGETS.includes(answerBudget)) {
    throw new RangeError('RANGE-CAL-002B answer budget is unsupported');
  }
  const prioritized = fixture.conflictingHandClass ? [fixture.conflictingHandClass] : [];
  const remaining = PREFLOP_HAND_CLASSES
    .filter((handClass) => !prioritized.includes(handClass))
    .sort((left, right) => (
      hashText(`${fixture.id}|${seed}|${left}`) - hashText(`${fixture.id}|${seed}|${right}`)
      || HAND_INDEX.get(left) - HAND_INDEX.get(right)
    ));
  return Object.freeze([...prioritized, ...remaining].slice(0, answerBudget));
}

function observation(fixture, seed, handClass, suffix = '') {
  const truth = fixture.labels[handClass];
  const mix = fixture.exactMixes[handClass] ?? null;
  const dominantAction = mix
    ? mix.fold === mix.raise
      ? null
      : { type: mix.raise > mix.fold ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD }
    : { type: truth };
  return createRangeObservation({
    id: `002b-${fixture.id}-${seed}-${handClass}${suffix}`,
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

export function createRangeCal002bHoldoutSplit({ fixture, seed, answerBudget }) {
  const visibleHandClasses = deterministic002bVisibleHandClasses({ fixture, seed, answerBudget });
  const visible = new Set(visibleHandClasses);
  const visibleObservations = visibleHandClasses.flatMap((handClass) => {
    const first = observation(fixture, seed, handClass);
    if (handClass !== fixture.conflictingHandClass) return [first];
    const opposite = first.dominantAction?.type === ACTION_TYPES.RAISE
      ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE;
    return [first, createRangeObservation({
      id: `${first.id}-independent-conflict`,
      profileId: first.profileId,
      modeId: first.modeId,
      context: first.context,
      handClass,
      dominantAction: { type: opposite },
      createdAt: '2026-08-18T12:01:00.000Z',
    })];
  });
  return deepFreeze({
    fixtureId: fixture.id,
    fixtureVersion: fixture.fixtureVersion,
    seed,
    answerBudget,
    visibleHandClasses,
    visibleObservations,
    heldOutHandClasses: PREFLOP_HAND_CLASSES.filter((handClass) => !visible.has(handClass)),
  });
}

function matrixNeighbors(handClass) {
  const index = HAND_INDEX.get(handClass);
  const row = Math.floor(index / 13);
  const column = index % 13;
  return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
    .filter(([nextRow, nextColumn]) => (
      nextRow >= 0 && nextRow < 13 && nextColumn >= 0 && nextColumn < 13
    ))
    .map(([nextRow, nextColumn]) => PREFLOP_HAND_CLASSES[nextRow * 13 + nextColumn]);
}

export function is002bTruthBoundary(fixture, handClass) {
  return matrixNeighbors(handClass).some((neighbor) => (
    fixture.labels[neighbor] !== fixture.labels[handClass]
  ));
}

export function evaluateRangeCal002bRun({ fixture, seed, answerBudget } = {}) {
  const split = createRangeCal002bHoldoutSplit({ fixture, seed, answerBudget });
  const evidenceView = createPersonalStrategyEvidenceView({
    profileId: RANGE_CAL002B_PROFILE_ID,
    modeId: RANGE_CAL002B_MODE_ID,
    context: RANGE_CAL002B_CONTEXT,
    rangeObservations: split.visibleObservations,
  });
  const startedAt = performance.now();
  const snapshot = createPersonalStrategySnapshot(evidenceView);
  const runtimeMs = performance.now() - startedAt;
  const heldOutSet = new Set(split.heldOutHandClasses);
  const estimates = snapshot.estimates.filter((entry) => heldOutSet.has(entry.handClass));
  const attempted = estimates.filter((entry) => ATTEMPTED_STATUSES.has(entry.status));
  const high = attempted.filter((entry) => entry.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH);
  const medium = attempted.filter((entry) => entry.status === PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM);
  const correct = attempted.filter((entry) => entry.dominantAction.type === fixture.labels[entry.handClass]);
  const correctHigh = high.filter((entry) => entry.dominantAction.type === fixture.labels[entry.handClass]);
  const correctMedium = medium.filter((entry) => entry.dominantAction.type === fixture.labels[entry.handClass]);
  const reasonCounts = {};
  for (const estimate of estimates) {
    for (const reason of estimate.reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  const boundaryMismatches = estimates.filter((entry) => (
    (entry.support.boundaryLikelihood === 'high') !== is002bTruthBoundary(fixture, entry.handClass)
  )).length;
  return deepFreeze({
    schemaVersion: RANGE_CAL002B_EVALUATION_SCHEMA_VERSION,
    fixtureId: fixture.id,
    fixtureVersion: fixture.fixtureVersion,
    seed,
    directAnswerBudget: answerBudget,
    directCoverage: answerBudget / PREFLOP_HAND_CLASSES.length,
    directEvidenceRecordCount: split.visibleObservations.length,
    heldOutCount: estimates.length,
    attemptedCount: attempted.length,
    attemptedCoverage: estimates.length === 0 ? 0 : attempted.length / estimates.length,
    correctAttemptedCount: correct.length,
    attemptedAccuracy: attempted.length === 0 ? null : correct.length / attempted.length,
    abstentionCount: estimates.length - attempted.length,
    abstentionRate: estimates.length === 0 ? 0 : (estimates.length - attempted.length) / estimates.length,
    highCount: high.length,
    highAccuracy: high.length === 0 ? null : correctHigh.length / high.length,
    falseHighConfidenceErrors: high.length - correctHigh.length,
    mediumCount: medium.length,
    mediumAccuracy: medium.length === 0 ? null : correctMedium.length / medium.length,
    boundaryLocalizationError: estimates.length === 0 ? 0 : boundaryMismatches / estimates.length,
    conflictingCount: snapshot.summary.conflictingCount,
    uncertainCount: snapshot.summary.uncertainCount,
    unknownCount: snapshot.summary.unknownCount,
    reasonCounts,
    runtimeMs,
    predictions: estimates.map((entry) => ({
      handClass: entry.handClass,
      status: entry.status,
      dominantAction: entry.dominantAction?.type ?? null,
    })),
  });
}

function aggregateRuns(records, dimensions) {
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
    abstentionRate: heldOut === 0 ? 0 : (heldOut - attempted) / heldOut,
    highCount: high,
    highAccuracy: high === 0 ? null : (high - falseHigh) / high,
    falseHighConfidenceErrors: falseHigh,
    mediumCount: medium,
    mediumAccuracy: medium === 0 ? null : correctMedium / medium,
    boundaryLocalizationError: records.reduce(
      (sum, entry) => sum + entry.boundaryLocalizationError * entry.heldOutCount,
      0,
    ) / heldOut,
    maximumSnapshotRuntimeMs: Math.max(...records.map((entry) => entry.runtimeMs)),
    averageSnapshotRuntimeMs: records.reduce((sum, entry) => sum + entry.runtimeMs, 0) / records.length,
  });
}

function group(records, keyFor, dimensionsFor) {
  const groups = new Map();
  for (const record of records) {
    const key = keyFor(record);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()].map((entries) => aggregateRuns(entries, dimensionsFor(entries[0])));
}

function stabilityRecords(records, fixtures, seeds, answerBudgets) {
  const byRun = new Map(records.map((record) => [
    `${record.fixtureId}|${record.seed}|${record.directAnswerBudget}`,
    record,
  ]));
  const stability = [];
  for (const fixture of fixtures) {
    for (const seed of seeds) {
      for (let index = 0; index < answerBudgets.length - 1; index += 1) {
        const fromBudget = answerBudgets[index];
        const toBudget = answerBudgets[index + 1];
        const from = byRun.get(`${fixture.id}|${seed}|${fromBudget}`);
        const to = byRun.get(`${fixture.id}|${seed}|${toBudget}`);
        const toByHand = new Map(to.predictions.map((entry) => [entry.handClass, entry]));
        const comparable = from.predictions.filter((entry) => (
          ATTEMPTED_STATUSES.has(entry.status)
          && ATTEMPTED_STATUSES.has(toByHand.get(entry.handClass)?.status)
        ));
        const stable = comparable.filter((entry) => (
          entry.dominantAction === toByHand.get(entry.handClass).dominantAction
        )).length;
        stability.push(deepFreeze({
          fixtureId: fixture.id,
          seed,
          fromBudget,
          toBudget,
          comparableAttemptedCount: comparable.length,
          stablePredictionCount: stable,
          stabilityRate: comparable.length === 0 ? null : stable / comparable.length,
        }));
      }
    }
  }
  return stability;
}

export function evaluateRangeCal002bQualityMatrix({
  fixtures = RANGE_CAL002B_SYNTHETIC_FIXTURES,
  seeds = RANGE_CAL002B_FIXED_SEEDS,
  answerBudgets = RANGE_CAL002B_ANSWER_BUDGETS,
} = {}) {
  const startedAt = performance.now();
  const records = [];
  for (const fixture of fixtures) {
    for (const answerBudget of answerBudgets) {
      for (const seed of seeds) {
        records.push(evaluateRangeCal002bRun({ fixture, seed, answerBudget }));
      }
    }
  }
  const fixtureBudget = group(
    records,
    (entry) => `${entry.fixtureId}|${entry.directAnswerBudget}`,
    (entry) => ({ fixtureId: entry.fixtureId, directAnswerBudget: entry.directAnswerBudget }),
  );
  const budgetAggregate = group(
    records,
    (entry) => String(entry.directAnswerBudget),
    (entry) => ({ directAnswerBudget: entry.directAnswerBudget }),
  );
  return deepFreeze({
    schemaVersion: RANGE_CAL002B_EVALUATION_SCHEMA_VERSION,
    fixtureIds: fixtures.map((entry) => entry.id),
    fixtureVersion: fixtures[0]?.fixtureVersion ?? null,
    seeds: [...seeds],
    answerBudgets: [...answerBudgets],
    inferenceModelVersion: RFI_INFERENCE_MODEL_VERSION,
    records,
    fixtureBudget,
    budgetAggregate,
    stability: stabilityRecords(records, fixtures, seeds, answerBudgets),
    evaluationRuntimeMs: performance.now() - startedAt,
  });
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function benchmarkRangeCal002bProjection({ repetitions = 101 } = {}) {
  const fixture = RANGE_CAL002B_SYNTHETIC_FIXTURES[0];
  const split = createRangeCal002bHoldoutSplit({ fixture, seed: 43, answerBudget: 40 });
  let source = {
    rangeObservations: split.visibleObservations,
    trainingObservations: [],
  };
  const evidenceView = createPersonalStrategyEvidenceView({
    profileId: RANGE_CAL002B_PROFILE_ID,
    modeId: RANGE_CAL002B_MODE_ID,
    context: RANGE_CAL002B_CONTEXT,
    ...source,
  });
  const target = split.heldOutHandClasses[0];
  const samples = [];
  estimatePersonalStrategyHand(evidenceView, target);
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt = performance.now();
    estimatePersonalStrategyHand(evidenceView, target);
    samples.push(performance.now() - startedAt);
  }
  const service = createPersonalStrategyProjectionService({
    repository: {
      async loadEvidenceScope() { return source; },
    },
  });
  const scope = {
    profileId: RANGE_CAL002B_PROFILE_ID,
    modeId: RANGE_CAL002B_MODE_ID,
    context: RANGE_CAL002B_CONTEXT,
  };
  const snapshotStarted = performance.now();
  await service.getStrategySnapshot(scope);
  const snapshotMs = performance.now() - snapshotStarted;
  const cachedStarted = performance.now();
  await service.getStrategySnapshot(scope);
  const repeatedCachedSnapshotMs = performance.now() - cachedStarted;
  const additionalHand = split.heldOutHandClasses[0];
  source = {
    ...source,
    rangeObservations: [...source.rangeObservations, observation(fixture, 43, additionalHand, '-added')],
  };
  service.invalidateScope(scope);
  const invalidatedStarted = performance.now();
  await service.getStrategySnapshot(scope);
  const invalidatedSnapshotMs = performance.now() - invalidatedStarted;
  const snapshotSamples = [snapshotMs];
  const invalidatedSamples = [invalidatedSnapshotMs];
  for (let index = 1; index < 5; index += 1) {
    let isolatedSource = {
      rangeObservations: split.visibleObservations,
      trainingObservations: [],
    };
    const isolatedService = createPersonalStrategyProjectionService({
      repository: {
        async loadEvidenceScope() { return isolatedSource; },
      },
    });
    const isolatedSnapshotStarted = performance.now();
    await isolatedService.getStrategySnapshot(scope);
    snapshotSamples.push(performance.now() - isolatedSnapshotStarted);
    isolatedSource = {
      ...isolatedSource,
      rangeObservations: [
        ...isolatedSource.rangeObservations,
        observation(fixture, 43, additionalHand, `-added-${index}`),
      ],
    };
    isolatedService.invalidateScope(scope);
    const isolatedInvalidatedStarted = performance.now();
    await isolatedService.getStrategySnapshot(scope);
    invalidatedSamples.push(performance.now() - isolatedInvalidatedStarted);
  }
  return deepFreeze({
    oneEstimateMedianMs: median(samples),
    oneEstimateMaximumMs: Math.max(...samples),
    snapshot169Ms: snapshotMs,
    snapshot169RepresentativeMs: Math.min(...snapshotSamples),
    snapshotSampleCount: snapshotSamples.length,
    repeatedCachedSnapshotMs,
    invalidatedSnapshotMs,
    invalidatedSnapshotRepresentativeMs: Math.min(...invalidatedSamples),
    invalidatedSnapshotSampleCount: invalidatedSamples.length,
    cacheMetrics: service.getCacheMetrics(),
  });
}
