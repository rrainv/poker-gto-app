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
  createLeakageSafeHoldoutSplit,
  generateHoldoutPredictions,
  scoreHoldoutPredictions,
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
  assert.ok(inferredResult.evidenceReferences.some(
    (reference) => reference.observationId === nearbyTie.id,
  ));
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

test('invalid schemas fail while contradictory sync histories are preserved and abstain', () => {
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
  const contradictory = inferSparseRfiHand(request('AQs', [firstRoot, secondRoot]));
  assert.equal(contradictory.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(
    contradictory.diagnostics.reason,
    RFI_INFERENCE_ABSTENTION_REASONS.CONTRADICTORY_DIRECT_EVIDENCE,
  );
  assert.deepEqual(
    new Set(contradictory.evidenceReferences.map((entry) => entry.observationId)),
    new Set([firstRoot.id, secondRoot.id]),
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

test('002A synthetic fixtures remain available only as historical compatibility tooling', () => {
  assert.equal(SYNTHETIC_RFI_TRUTH_FIXTURES.length, 7);
  assert.ok(SYNTHETIC_RFI_TRUTH_FIXTURES.every((fixture) => fixture.synthetic));
  const fixture = SYNTHETIC_RFI_TRUTH_FIXTURES[0];
  const first = createLeakageSafeHoldoutSplit({ fixture, seed: 47, answerCount: 30 });
  const second = createLeakageSafeHoldoutSplit({ fixture, seed: 47, answerCount: 30 });
  assert.deepEqual(second, first);
});

test('002A API is a compatibility adapter and the unified core remains dependency-isolated', () => {
  const inferenceSource = fs.readFileSync(
    new URL('../app/src/personal-strategy/rfi-inference.mjs', import.meta.url),
    'utf8',
  );
  for (const path of [
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
    /indexeddb|repository|StrategyProvider|StrategyResult|\bdocument\.|\bwindow\.|\bfetch\s*\(/i,
  );
  assert.doesNotMatch(inferenceSource, /solver|heuristic/i);
});
