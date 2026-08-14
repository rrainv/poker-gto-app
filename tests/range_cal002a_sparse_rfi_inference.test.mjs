import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  RANGE_OBSERVATION_STATES,
  createRangeObservation,
  createRfiCalibrationContext,
  createTrainingObservation,
} from '../app/src/personal-strategy/domain.mjs';
import {
  RFI_INFERENCE_ABSTENTION_REASONS,
  RFI_INFERENCE_REQUEST_SCHEMA_VERSION,
  RFI_INFERENCE_STATUSES,
  SPARSE_RFI_INFERENCE_MODEL_VERSION,
  createRfiInferenceRequest,
  inferSparseRfiHand,
  validateRfiInferenceResult,
} from '../app/src/personal-strategy/rfi-inference.mjs';
import { SYNTHETIC_RFI_TRUTH_FIXTURES } from './fixtures/range_cal002a_synthetic_truth.mjs';
import {
  RANGE_CAL002A_ANSWER_COUNTS,
  RANGE_CAL002A_FIXED_SEEDS,
  RANGE_CAL002A_METHODS,
  createLeakageSafeHoldoutSplit,
  evaluateFixtureSeedCount,
  evaluateRangeCal002aQualityMatrix,
  generateHoldoutPredictions,
  scoreHoldoutPredictions,
  summarizeQualityMatrix,
} from './tooling/range_cal002a_evaluation.mjs';

const T0 = '2026-08-14T16:00:00.000Z';
const T1 = '2026-08-14T16:01:00.000Z';
const T2 = '2026-08-14T16:02:00.000Z';
const PROFILE_ID = 'profile-local';
const MODE_ID = 'mode-local';

function context(overrides = {}) {
  return createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    ...overrides,
  });
}

let nextObservationId = 0;
function direct(handClass, actionType, overrides = {}) {
  return createRangeObservation({
    id: `direct-${++nextObservationId}`,
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: context(),
    handClass,
    dominantAction: actionType === null ? null : { type: actionType },
    frequencies: actionType === null ? [
      { action: { type: ACTION_TYPES.FOLD }, probability: 50 },
      { action: { type: ACTION_TYPES.RAISE }, probability: 50 },
    ] : null,
    createdAt: T0,
    ...overrides,
  });
}

function request(requestedHandClass, directObservations, overrides = {}) {
  return createRfiInferenceRequest({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: context(),
    directObservations,
    requestedHandClass,
    ...overrides,
  });
}

function localRaiseEvidence() {
  return [
    direct('AQs', ACTION_TYPES.RAISE),
    direct('ATs', ACTION_TYPES.RAISE),
    direct('A9s', ACTION_TYPES.RAISE),
    direct('KJs', ACTION_TYPES.RAISE),
  ];
}

test('identical sparse RFI inputs produce identical deeply frozen inferred results', () => {
  const inferenceRequest = request('AJs', localRaiseEvidence());
  const first = inferSparseRfiHand(inferenceRequest);
  const second = inferSparseRfiHand(inferenceRequest);

  assert.deepEqual(second, first);
  assert.equal(first.status, RFI_INFERENCE_STATUSES.INFERRED);
  assert.deepEqual(first.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(first.source.modelVersion, SPARSE_RFI_INFERENCE_MODEL_VERSION);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.evidenceReferences));
  assert.ok(Object.isFrozen(first.diagnostics.supportWeights));
  validateRfiInferenceResult(first);
});

test('exact profile, mode, and canonical context isolation excludes closer foreign evidence', () => {
  const local = [
    direct('AQs', ACTION_TYPES.FOLD),
    direct('ATs', ACTION_TYPES.FOLD),
    direct('A9s', ACTION_TYPES.FOLD),
  ];
  const foreign = [
    direct('AJo', ACTION_TYPES.RAISE, { profileId: 'other-profile' }),
    direct('KJs', ACTION_TYPES.RAISE, { modeId: 'other-mode' }),
    direct('AKs', ACTION_TYPES.RAISE, {
      context: context({ heroPosition: 'CO' }),
    }),
    direct('KTs', ACTION_TYPES.RAISE, {
      context: context({ effectiveStackBb: 50 }),
    }),
  ];
  const result = inferSparseRfiHand(request('AJs', [...foreign, ...local]));

  assert.equal(result.status, RFI_INFERENCE_STATUSES.INFERRED);
  assert.equal(result.dominantAction.type, ACTION_TYPES.FOLD);
  assert.deepEqual(
    new Set(result.evidenceReferences.map((reference) => reference.observationId)),
    new Set(local.map((observation) => observation.id)),
  );
  assert.equal(result.diagnostics.matchingScopeLeafCount, local.length);
});

test('a directly answered requested hand always wins over contradictory inference neighbors', () => {
  const exact = direct('AJs', ACTION_TYPES.FOLD);
  const result = inferSparseRfiHand(request('AJs', [exact, ...localRaiseEvidence()]));

  assert.equal(result.status, RFI_INFERENCE_STATUSES.DIRECT);
  assert.deepEqual(result.dominantAction, { type: ACTION_TYPES.FOLD });
  assert.equal(result.source.type, 'direct_calibration');
  assert.deepEqual(result.evidenceReferences.map((reference) => reference.observationId), [exact.id]);
});

test('only current leaves count: superseded answers disappear and a retracted leaf is not active evidence', () => {
  const original = direct('AJs', ACTION_TYPES.RAISE);
  const revision = direct('AJs', ACTION_TYPES.FOLD, {
    id: 'revised-direct',
    supersedesObservationId: original.id,
    createdAt: T1,
  });
  const revisedResult = inferSparseRfiHand(request('AJs', [original, revision, ...localRaiseEvidence()]));
  assert.equal(revisedResult.status, RFI_INFERENCE_STATUSES.DIRECT);
  assert.equal(revisedResult.dominantAction.type, ACTION_TYPES.FOLD);
  assert.deepEqual(revisedResult.evidenceReferences.map((reference) => reference.observationId), [revision.id]);

  const retraction = direct('AJs', null, {
    id: 'retracted-direct',
    state: RANGE_OBSERVATION_STATES.RETRACTED,
    dominantAction: null,
    frequencies: null,
    supersedesObservationId: revision.id,
    createdAt: T2,
  });
  const foldNeighbors = [
    direct('AQs', ACTION_TYPES.FOLD),
    direct('ATs', ACTION_TYPES.FOLD),
    direct('A9s', ACTION_TYPES.FOLD),
  ];
  const retractedResult = inferSparseRfiHand(request(
    'AJs',
    [original, revision, retraction, ...foldNeighbors],
  ));
  assert.equal(retractedResult.status, RFI_INFERENCE_STATUSES.INFERRED);
  assert.equal(retractedResult.dominantAction.type, ACTION_TYPES.FOLD);
  assert.equal(
    retractedResult.evidenceReferences.some((reference) => reference.observationId === original.id),
    false,
  );
});

test('tied direct mixes retain no dominant action and nearby ties act only as boundary evidence', () => {
  const tiedTarget = direct('AJs', null);
  const directResult = inferSparseRfiHand(request('AJs', [tiedTarget, ...localRaiseEvidence()]));
  assert.equal(directResult.status, RFI_INFERENCE_STATUSES.DIRECT);
  assert.equal(directResult.dominantAction, null);
  assert.equal(directResult.diagnostics.reason, 'direct_tied_mix');

  const nearbyTie = direct('ATs', null);
  const inferredResult = inferSparseRfiHand(request('AJs', [
    nearbyTie,
    direct('AQs', ACTION_TYPES.RAISE),
    direct('A9s', ACTION_TYPES.RAISE),
    direct('KJs', ACTION_TYPES.RAISE),
  ]));
  assert.equal(inferredResult.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(
    inferredResult.diagnostics.reason,
    RFI_INFERENCE_ABSTENTION_REASONS.NEARBY_TIED_BOUNDARY,
  );
  assert.equal(inferredResult.dominantAction, null);
  assert.deepEqual(inferredResult.evidenceReferences.map((reference) => reference.observationId), [nearbyTie.id]);
});

test('Training observations cannot enter the direct inference dataset', () => {
  const training = createTrainingObservation({
    id: 'training-evidence',
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: context(),
    handClass: 'AQs',
    chosenAction: { type: ACTION_TYPES.RAISE },
    trainingExerciseId: 'training-exercise',
    createdAt: T0,
  });
  assert.throws(
    () => request('AJs', [training]),
    /Expected range-observation\/v1/,
  );
});

test('evidence references contain stable IDs, observed actions, relationships, and deterministic distance order', () => {
  const observations = localRaiseEvidence().reverse();
  const first = inferSparseRfiHand(request('AJs', observations));
  const second = inferSparseRfiHand(request('AJs', [...observations].reverse()));

  assert.deepEqual(first.evidenceReferences, second.evidenceReferences);
  assert.ok(first.evidenceReferences.length >= 3);
  assert.ok(first.evidenceReferences.every((reference) => (
    observations.some((observation) => observation.id === reference.observationId)
    && reference.relationship === 'neighbor'
    && reference.observedDominantAction.type === ACTION_TYPES.RAISE
    && Number.isFinite(reference.distance.total)
  )));
  assert.deepEqual(
    first.evidenceReferences.map((reference) => reference.distance.total),
    [...first.evidenceReferences].map((reference) => reference.distance.total).sort((a, b) => a - b),
  );
});

test('weak and contradictory nearby evidence cause explicit abstention', () => {
  const insufficient = inferSparseRfiHand(request('AJs', [direct('AQs', ACTION_TYPES.RAISE)]));
  assert.equal(insufficient.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(
    insufficient.diagnostics.reason,
    RFI_INFERENCE_ABSTENTION_REASONS.INSUFFICIENT_NEARBY_EVIDENCE,
  );

  const contradictory = inferSparseRfiHand(request('AJs', [
    direct('AQs', ACTION_TYPES.RAISE),
    direct('ATs', ACTION_TYPES.FOLD),
    direct('A9s', ACTION_TYPES.RAISE),
    direct('KJs', ACTION_TYPES.FOLD),
  ]));
  assert.equal(contradictory.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(
    contradictory.diagnostics.reason,
    RFI_INFERENCE_ABSTENTION_REASONS.CONTRADICTORY_NEARBY_EVIDENCE,
  );

  const wrongScopeOnly = inferSparseRfiHand(request('AJs', [
    direct('AQs', ACTION_TYPES.RAISE, { profileId: 'other-profile' }),
    direct('ATs', ACTION_TYPES.RAISE, { modeId: 'other-mode' }),
  ]));
  assert.equal(wrongScopeOnly.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(
    wrongScopeOnly.diagnostics.reason,
    RFI_INFERENCE_ABSTENTION_REASONS.NO_MATCHING_SCOPE_EVIDENCE,
  );

  const unsupportedDirect = inferSparseRfiHand(request('AJs', [
    direct('AJs', ACTION_TYPES.CALL),
    ...localRaiseEvidence(),
  ]));
  assert.equal(unsupportedDirect.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(
    unsupportedDirect.diagnostics.reason,
    RFI_INFERENCE_ABSTENTION_REASONS.UNSUPPORTED_DIRECT_ACTION,
  );
  assert.equal(unsupportedDirect.evidenceReferences[0].observedDominantAction.type, ACTION_TYPES.CALL);
});

test('inferred results expose neither fabricated action frequencies nor uncalibrated confidence', () => {
  const result = inferSparseRfiHand(request('AJs', localRaiseEvidence()));
  assert.equal(Object.hasOwn(result, 'frequencies'), false);
  assert.equal(Object.hasOwn(result, 'confidence'), false);
  assert.equal(JSON.stringify(result).includes('probability'), false);
  assert.equal(JSON.stringify(result).includes('confidence'), false);
  assert.deepEqual(result.dominantAction, { type: ACTION_TYPES.RAISE });
});

test('invalid request/result schemas and ambiguous direct histories fail at the boundary', () => {
  const valid = request('AJs', localRaiseEvidence());
  assert.throws(
    () => inferSparseRfiHand({ ...valid, schemaVersion: 'rfi-inference-request/v99' }),
    /Expected rfi-inference-request\/v1/,
  );
  assert.throws(
    () => inferSparseRfiHand({ ...valid, modelVersion: 'unknown-model' }),
    /Unsupported RFI inference model/,
  );
  assert.throws(
    () => createRfiInferenceRequest({ ...valid, requestedHandClass: 'AXs' }),
    /Unsupported preflop hand class/,
  );

  const firstRoot = direct('AQs', ACTION_TYPES.RAISE);
  const secondRoot = direct('AQs', ACTION_TYPES.FOLD);
  assert.throws(
    () => inferSparseRfiHand(request('AJs', [firstRoot, secondRoot])),
    /at most one current leaf/,
  );
  assert.equal(valid.schemaVersion, RFI_INFERENCE_REQUEST_SCHEMA_VERSION);
});

test('inference does not mutate supplied observations and factories isolate caller-owned data', () => {
  const observations = localRaiseEvidence().map((observation) => JSON.parse(JSON.stringify(observation)));
  const before = structuredClone(observations);
  const inferenceRequest = createRfiInferenceRequest({
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: context(),
    directObservations: observations,
    requestedHandClass: 'AJs',
  });
  observations[0].dominantAction.type = ACTION_TYPES.FOLD;
  const result = inferSparseRfiHand(inferenceRequest);

  assert.deepEqual(inferenceRequest.directObservations, before);
  assert.equal(result.dominantAction.type, ACTION_TYPES.RAISE);
  assert.ok(Object.isFrozen(inferenceRequest.directObservations[0]));
});

test('holdout prediction generation cannot see fixture identity or hidden labels', () => {
  const fixture = SYNTHETIC_RFI_TRUTH_FIXTURES[0];
  const split = createLeakageSafeHoldoutSplit({ fixture, seed: 11, answerCount: 30 });
  const visibleIds = new Set(split.visibleObservations.map((observation) => observation.id));
  let calls = 0;
  const predictions = generateHoldoutPredictions({
    visibleObservations: split.visibleObservations,
    heldOutHandClasses: split.heldOutHandClasses.slice(0, 5),
    inference(inferenceRequest) {
      calls += 1;
      assert.deepEqual(Object.keys(inferenceRequest).sort(), [
        'context', 'directObservations', 'modeId', 'modelVersion', 'profileId',
        'requestedHandClass', 'schemaVersion',
      ]);
      assert.equal('fixture' in inferenceRequest, false);
      assert.equal('truth' in inferenceRequest, false);
      assert.equal('labels' in inferenceRequest, false);
      assert.ok(inferenceRequest.directObservations.every((entry) => visibleIds.has(entry.id)));
      assert.ok(inferenceRequest.directObservations.every(
        (entry) => !split.heldOutHandClasses.includes(entry.handClass),
      ));
      return inferSparseRfiHand(inferenceRequest);
    },
  });
  assert.equal(calls, 5);
  assert.equal(predictions.length, 20);

  const rescoredFixture = {
    ...fixture,
    labels: { ...fixture.labels },
  };
  const target = split.heldOutHandClasses[0];
  rescoredFixture.labels[target] = fixture.labels[target] === ACTION_TYPES.RAISE
    ? ACTION_TYPES.FOLD
    : ACTION_TYPES.RAISE;
  const beforeScore = structuredClone(predictions);
  scoreHoldoutPredictions({ fixture: rescoredFixture, split: {
    ...split,
    heldOutHandClasses: split.heldOutHandClasses.slice(0, 5),
  }, predictions });
  assert.deepEqual(predictions, beforeScore, 'scoring hidden truth cannot change prior predictions');
});

const qualityEvaluation = evaluateRangeCal002aQualityMatrix();
const qualitySummary = summarizeQualityMatrix(qualityEvaluation);

function aggregate(method, answers) {
  return qualitySummary.aggregate.find((row) => (
    row.method === method && row.directAnswerCount === answers
  ));
}

function fixtureSummary(fixtureId, answers) {
  return qualitySummary.fixtureSpecific.find((row) => (
    row.method === RANGE_CAL002A_METHODS.PROPOSED
    && row.fixtureId === fixtureId
    && row.directAnswerCount === answers
  ));
}

test('quality matrix is complete for all synthetic fixtures, fixed seeds, answer counts, and baselines', () => {
  assert.equal(SYNTHETIC_RFI_TRUTH_FIXTURES.length, 7);
  assert.deepEqual(qualityEvaluation.answerCounts, RANGE_CAL002A_ANSWER_COUNTS);
  assert.deepEqual(qualityEvaluation.seeds, RANGE_CAL002A_FIXED_SEEDS);
  assert.equal(qualityEvaluation.records.length, 7 * 7 * 5 * 4);
  assert.ok(qualityEvaluation.records.every((record) => (
    record.directObservationsSupplied === record.directAnswerCount
    && record.attemptedPredictions + record.abstentions === record.eligibleHeldOutCells
    && record.correctAttemptedPredictions + record.incorrectAttemptedPredictions
      === record.attemptedPredictions
  )));
  assert.ok(SYNTHETIC_RFI_TRUTH_FIXTURES.every((fixture) => fixture.synthetic));
});

test('fixed subsets and quality curves are reproducible rather than one favorable order', () => {
  const fixture = SYNTHETIC_RFI_TRUTH_FIXTURES[0];
  for (const answerCount of RANGE_CAL002A_ANSWER_COUNTS) {
    const first = evaluateFixtureSeedCount({ fixture, seed: 47, answerCount });
    const second = evaluateFixtureSeedCount({ fixture, seed: 47, answerCount });
    assert.deepEqual(second, first);
  }
  const distinctThirtyAnswerSubsets = new Set(RANGE_CAL002A_FIXED_SEEDS.map((seed) => (
    createLeakageSafeHoldoutSplit({ fixture, seed, answerCount: 30 }).visibleHandClasses.join('|')
  )));
  assert.equal(distinctThirtyAnswerSubsets.size, RANGE_CAL002A_FIXED_SEEDS.length);
});

test('smooth fixtures gain useful selective coverage and attempted accuracy from 30 to 50 answers', () => {
  const at30 = fixtureSummary('smooth-baseline', 30);
  const at40 = fixtureSummary('smooth-baseline', 40);
  const at50 = fixtureSummary('smooth-baseline', 50);
  assert.ok(at30.coverage > 0.5 && at30.attemptedAccuracy > 0.9);
  assert.ok(at40.coverage > at30.coverage && at40.attemptedAccuracy > 0.9);
  assert.ok(at50.coverage > at40.coverage && at50.attemptedAccuracy > 0.9);
  assert.ok(at50.totalHeldOutAccuracy > at30.totalHeldOutAccuracy);
});

test('irregular and exploitative fixtures expose the limits instead of being hidden by aggregate scores', () => {
  for (const answers of [30, 40, 50]) {
    const irregular = fixtureSummary('irregular-non-monotonic', answers);
    const gapped = fixtureSummary('exploitative-gapped', answers);
    assert.ok(irregular.coverage < 0.35, 'irregular evidence should trigger substantial abstention');
    assert.ok(irregular.attemptedAccuracy < 0.6, 'the synthetic irregular pattern is not learnable locally');
    assert.ok(gapped.coverage > irregular.coverage);
    assert.ok(gapped.attemptedAccuracy > 0.8);
    assert.ok(gapped.incorrectBoundaryPredictions / gapped.incorrectAttemptedPredictions > 0.8);
  }
});

test('the proposed method improves attempted accuracy over trivial baselines without hiding lower coverage', () => {
  for (const answers of [30, 40, 50]) {
    const proposed = aggregate(RANGE_CAL002A_METHODS.PROPOSED, answers);
    const majority = aggregate(RANGE_CAL002A_METHODS.MAJORITY, answers);
    const nearest = aggregate(RANGE_CAL002A_METHODS.NEAREST, answers);
    const abstain = aggregate(RANGE_CAL002A_METHODS.ABSTAIN, answers);
    assert.ok(proposed.coverage > 0.4);
    assert.ok(proposed.attemptedAccuracy > majority.attemptedAccuracy);
    assert.ok(proposed.attemptedAccuracy > nearest.attemptedAccuracy);
    assert.ok(proposed.coverage < nearest.coverage);
    assert.ok(proposed.totalHeldOutAccuracy < nearest.totalHeldOutAccuracy);
    assert.equal(abstain.coverage, 0);
    assert.equal(abstain.attemptedAccuracy, null);
  }
  assert.ok(
    aggregate(RANGE_CAL002A_METHODS.PROPOSED, 50).coverage
      > aggregate(RANGE_CAL002A_METHODS.PROPOSED, 10).coverage + 0.4,
  );
});

test('inference remains isolated from persistence, StrategyProvider, Training, UI, and startup imports', () => {
  const inferenceSource = fs.readFileSync(
    new URL('../app/src/personal-strategy/rfi-inference.mjs', import.meta.url),
    'utf8',
  );
  for (const path of [
    '../app/src/personal-strategy/index.mjs',
    '../app/src/personal-strategy/repository.mjs',
    '../app/src/application/range-calibration-service.mjs',
    '../app/src/application/range-calibration-workspace.mjs',
    '../app/src/application/range-calibration-bootstrap.mjs',
    '../app/src/application/strategy-provider.mjs',
    '../app/src/application/training-session-controller.mjs',
  ]) {
    const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /rfi-inference|inferSparseRfiHand/, path);
  }
  assert.doesNotMatch(
    inferenceSource,
    /indexeddb|repository|StrategyProvider|StrategyResult|\bTraining\b|\bdocument\.|\bwindow\.|\bfetch\s*\(/i,
  );
  assert.doesNotMatch(inferenceSource, /solver|heuristic/i);
});
