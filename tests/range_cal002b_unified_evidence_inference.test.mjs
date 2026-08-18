import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  RANGE_OBSERVATION_STATES,
  createRangeObservation,
  createRfiCalibrationContext,
  createTrainingObservation,
} from '../app/src/personal-strategy/domain.mjs';
import {
  PERSONAL_STRATEGY_DIRECT_HEAD_STATES,
  PERSONAL_STRATEGY_DIRECT_POINT_STATES,
  createPersonalStrategyEvidenceView,
} from '../app/src/personal-strategy/evidence-view.mjs';
import {
  PERSONAL_STRATEGY_ESTIMATE_STATUSES,
  RFI_INFERENCE_MODEL_VERSION,
  RFI_INFERENCE_REASON_CODES,
  createPersonalStrategySnapshot,
  estimatePersonalStrategyHand,
} from '../app/src/personal-strategy/rfi-inference.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { createRangeCalibrationApplication } from '../app/src/application/range-calibration-service.mjs';

const PROFILE_ID = 'profile-002b';
const MODE_ID = 'mode-002b';
const T0 = '2026-08-18T10:00:00.000Z';
const T1 = '2026-08-18T10:01:00.000Z';
const T2 = '2026-08-18T10:02:00.000Z';

function context(overrides = {}) {
  return createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    ...overrides,
  });
}

let id = 0;
function direct(handClass, actionType, overrides = {}) {
  const frequencies = overrides.frequencies ?? null;
  return createRangeObservation({
    id: overrides.id ?? `evidence-${++id}`,
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: overrides.context ?? context(),
    handClass,
    dominantAction: actionType === null ? null : { type: actionType },
    frequencies,
    state: overrides.state ?? RANGE_OBSERVATION_STATES.ACTIVE,
    supersedesObservationId: overrides.supersedesObservationId ?? null,
    createdAt: overrides.createdAt ?? T0,
  });
}

function exact(handClass, fold, raise, overrides = {}) {
  const dominantAction = fold === raise
    ? null
    : { type: raise > fold ? ACTION_TYPES.RAISE : ACTION_TYPES.FOLD };
  return createRangeObservation({
    id: overrides.id ?? `evidence-${++id}`,
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: overrides.context ?? context(),
    handClass,
    dominantAction,
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, probability: fold },
      { action: { type: ACTION_TYPES.RAISE }, probability: raise },
    ],
    supersedesObservationId: overrides.supersedesObservationId ?? null,
    createdAt: overrides.createdAt ?? T0,
  });
}

function view(rangeObservations = [], trainingObservations = [], overrides = {}) {
  return createPersonalStrategyEvidenceView({
    profileId: overrides.profileId ?? PROFILE_ID,
    modeId: overrides.modeId ?? MODE_ID,
    context: overrides.context ?? context(),
    rangeObservations,
    trainingObservations,
  });
}

test('dominant-only, pure exact, and tied exact direct evidence preserve distinct semantics', () => {
  const dominant = direct('K8s', ACTION_TYPES.RAISE);
  const pure = exact('K9s', 0, 1);
  const tied = exact('KTs', 1, 1);
  const evidenceView = view([dominant, pure, tied]);

  const dominantEstimate = estimatePersonalStrategyHand(evidenceView, 'K8s');
  assert.equal(dominantEstimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.deepEqual(dominantEstimate.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(dominantEstimate.exactFrequencies, null);

  const pureEstimate = estimatePersonalStrategyHand(evidenceView, 'K9s');
  assert.equal(pureEstimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.deepEqual(pureEstimate.exactFrequencies, [
    { action: { type: ACTION_TYPES.RAISE }, probability: 1 },
  ]);

  const tiedEstimate = estimatePersonalStrategyHand(evidenceView, 'KTs');
  assert.equal(tiedEstimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.equal(tiedEstimate.dominantAction, null);
  assert.equal(tiedEstimate.exactFrequencies.length, 2);
  assert.ok(tiedEstimate.reasons.includes(RFI_INFERENCE_REASON_CODES.DIRECT_TIED_MIX));
});

test('explicit correction supersedes the prior head while preserving immutable history', () => {
  const original = direct('K8s', ACTION_TYPES.RAISE, { id: 'original' });
  const correction = direct('K8s', ACTION_TYPES.FOLD, {
    id: 'correction',
    supersedesObservationId: original.id,
    createdAt: T1,
  });
  const evidenceView = view([original, correction]);
  const point = evidenceView.points.find((entry) => entry.handClass === 'K8s');
  assert.equal(point.resolution, PERSONAL_STRATEGY_DIRECT_POINT_STATES.DIRECT_DOMINANT);
  assert.deepEqual(point.strategyValue.dominantAction, { type: ACTION_TYPES.FOLD });
  assert.deepEqual(point.activeDirectHeadIds, [correction.id]);
  assert.deepEqual(point.supersededDirectEvidenceIds, [original.id]);
  assert.equal(
    evidenceView.directEvidence.find((entry) => entry.evidenceId === original.id).headState,
    PERSONAL_STRATEGY_DIRECT_HEAD_STATES.SUPERSEDED,
  );
});

test('independent incompatible direct heads remain conflicting and never become a fake mix', () => {
  const raise = direct('K8s', ACTION_TYPES.RAISE, { id: 'independent-raise' });
  const fold = direct('K8s', ACTION_TYPES.FOLD, { id: 'independent-fold', createdAt: T1 });
  const evidenceView = view([raise, fold]);
  const estimate = estimatePersonalStrategyHand(evidenceView, 'K8s');

  assert.equal(estimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.CONFLICTING);
  assert.equal(estimate.dominantAction, null);
  assert.equal(estimate.exactFrequencies, null);
  assert.deepEqual(new Set(estimate.sourceEvidenceIds), new Set([raise.id, fold.id]));
  assert.equal(evidenceView.conflicts.length, 1);
  assert.match(evidenceView.conflicts[0].conflictId, /^personal-strategy-conflict\/v1:/);
});

test('compatible duplicate dominant heads and a higher-authority agreeing exact head project directly', () => {
  const first = direct('A5s', ACTION_TYPES.RAISE, { id: 'raise-a' });
  const second = direct('A5s', ACTION_TYPES.RAISE, { id: 'raise-b', createdAt: T1 });
  const quantitative = exact('A5s', 0.25, 0.75, { id: 'raise-exact', createdAt: T2 });
  const estimate = estimatePersonalStrategyHand(view([first, second, quantitative]), 'A5s');

  assert.equal(estimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.equal(estimate.exactFrequencies.length, 2);
  assert.deepEqual(new Set(estimate.sourceEvidenceIds), new Set([first.id, second.id, quantitative.id]));
});

test('Training evidence is projected with separate provenance and excluded from 002B intent inference', () => {
  const training = createTrainingObservation({
    id: 'training-only',
    profileId: PROFILE_ID,
    modeId: MODE_ID,
    context: context(),
    handClass: 'K8s',
    chosenAction: { type: ACTION_TYPES.RAISE },
    trainingSessionId: 'training-session',
    trainingExerciseId: 'training-exercise',
    createdAt: T0,
  });
  const evidenceView = view([], [training]);
  const estimate = estimatePersonalStrategyHand(evidenceView, 'K8s');

  assert.equal(evidenceView.trainingEvidence.length, 1);
  assert.equal(evidenceView.trainingEvidence[0].authority, 'observed_behavior');
  assert.equal(estimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN);
  assert.equal(estimate.dominantAction, null);
  assert.ok(estimate.reasons.includes(RFI_INFERENCE_REASON_CODES.TRAINING_EXCLUDED));
});

function stableRaiseEvidence() {
  return ['AQs', 'ATs', 'A9s', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs']
    .map((handClass) => direct(handClass, ACTION_TYPES.RAISE));
}

test('consistent multi-relation neighbors produce deterministic ordinal high inference', () => {
  const evidenceView = view(stableRaiseEvidence());
  const first = estimatePersonalStrategyHand(evidenceView, 'AJs');
  const second = estimatePersonalStrategyHand(evidenceView, 'AJs');

  assert.deepEqual(second, first);
  assert.equal(first.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH);
  assert.deepEqual(first.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(first.exactFrequencies, null);
  assert.equal(first.inferenceModelVersion, RFI_INFERENCE_MODEL_VERSION);
  assert.equal(Object.hasOwn(first, 'confidence'), false);
  assert.ok(first.reasons.includes(RFI_INFERENCE_REASON_CODES.MULTIPLE_CONSISTENT_NEIGHBORS));
});

test('three consistent local neighbors produce medium inference without fake frequency precision', () => {
  const evidenceView = view([
    direct('AQs', ACTION_TYPES.RAISE),
    direct('ATs', ACTION_TYPES.RAISE),
    direct('KJs', ACTION_TYPES.RAISE),
  ]);
  const estimate = estimatePersonalStrategyHand(evidenceView, 'AJs');
  assert.equal(estimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_MEDIUM);
  assert.deepEqual(estimate.dominantAction, { type: ACTION_TYPES.RAISE });
  assert.equal(estimate.exactFrequencies, null);
});

test('nearby disagreement, tied boundaries, and insufficient evidence abstain honestly', () => {
  const boundary = view([
    direct('AQs', ACTION_TYPES.RAISE),
    direct('ATs', ACTION_TYPES.FOLD),
    exact('KJs', 1, 1),
    direct('KTs', ACTION_TYPES.RAISE),
  ]);
  const uncertain = estimatePersonalStrategyHand(boundary, 'AJs');
  assert.equal(uncertain.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNCERTAIN);
  assert.equal(uncertain.dominantAction, null);
  assert.equal(uncertain.support.boundaryLikelihood, 'high');

  const unknown = estimatePersonalStrategyHand(view([]), '72o');
  assert.equal(unknown.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.UNKNOWN);
  assert.equal(unknown.dominantAction, null);
});

test('explicit irregular anomalies remain directly known and are never corrected by priors', () => {
  const weird = direct('K9s', ACTION_TYPES.FOLD);
  const evidenceView = view([weird, ...stableRaiseEvidence()]);
  const estimate = estimatePersonalStrategyHand(evidenceView, 'K9s');
  assert.equal(estimate.status, PERSONAL_STRATEGY_ESTIMATE_STATUSES.DIRECTLY_KNOWN);
  assert.deepEqual(estimate.dominantAction, { type: ACTION_TYPES.FOLD });
  assert.deepEqual(estimate.sourceEvidenceIds, [weird.id]);
});

test('inferred output and conflict projections never become evidence or snapshot combo records', () => {
  const evidenceView = view(stableRaiseEvidence());
  const snapshot = createPersonalStrategySnapshot(evidenceView);
  assert.equal(snapshot.estimates.length, 169);
  assert.equal(snapshot.comboOverrides.length, 0);
  assert.equal(snapshot.estimates.some((entry) => entry.provenance === 'inferred'), true);
  assert.equal(evidenceView.directEvidence.length, stableRaiseEvidence().length);
  assert.equal(evidenceView.directEvidence.some((entry) => entry.authority === 'inferred'), false);
  assert.equal(snapshot.evidenceRevision.fingerprint, evidenceView.evidenceFingerprint);
  assert.equal(snapshot.derivation.inferenceAlgorithmVersion, RFI_INFERENCE_MODEL_VERSION);
});

test('profile, mode, and exact context isolate evidence deterministically', () => {
  const matching = stableRaiseEvidence();
  const foreign = [
    direct('A8s', ACTION_TYPES.FOLD, { profileId: 'other-profile' }),
    direct('A7s', ACTION_TYPES.FOLD, { modeId: 'other-mode' }),
    direct('A6s', ACTION_TYPES.FOLD, { context: context({ heroPosition: 'CO' }) }),
  ];
  const evidenceView = view([...foreign, ...matching]);
  assert.equal(evidenceView.summary.activeDirectHeadCount, matching.length);
  assert.equal(estimatePersonalStrategyHand(evidenceView, 'AJs').status,
    PERSONAL_STRATEGY_ESTIMATE_STATUSES.INFERRED_HIGH);
});

function memoryStorage() {
  const values = new Map();
  return Object.freeze({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  });
}

test('application projection APIs are scope-cached and invalidate only the mutated scope', async () => {
  let nextId = 0;
  let minute = 0;
  const application = createRangeCalibrationApplication({
    storage: memoryStorage(),
    database: createMemoryPersonalStrategyDatabase({ name: 'range-cal002b-integration' }),
    idFactory: (prefix) => `${prefix}-${++nextId}`,
    clock: () => new Date(Date.parse(T0) + minute++ * 60_000),
  });
  const bundle = await application.createProfile({
    displayName: '002B profile',
    description: '',
    environment: 'home',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  let state = await application.startOrResumeSession({
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
    context: { environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 },
  });
  const scope = {
    profileId: bundle.profile.id,
    modeId: bundle.modes[0].id,
    context: state.session.contextScope,
  };
  const emptySnapshot = await application.getStrategySnapshot(scope);
  assert.equal(emptySnapshot.summary.unknownCount, 169);
  assert.equal(await application.getStrategySnapshot(scope), emptySnapshot);
  assert.equal(application.getProjectionCacheMetrics().snapshotBuilds, 1);

  state = await application.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE });
  const changedSnapshot = await application.getStrategySnapshot(scope);
  assert.notEqual(changedSnapshot, emptySnapshot);
  assert.equal(changedSnapshot.summary.directlyKnownCount, 1);
  assert.equal(application.getProjectionCacheMetrics().snapshotBuilds, 2);

  const otherScope = { ...scope, modeId: bundle.modes[1].id };
  const otherSnapshot = await application.getStrategySnapshot(otherScope);
  assert.equal(otherSnapshot.summary.directlyKnownCount, 0);
  assert.equal((await application.getEvidenceView(scope)).summary.activeDirectHeadCount, 1);
  assert.equal((await application.getInferenceSupport(scope, state.prompt.handClass)).schemaVersion,
    'personal-strategy-inference-support/v1');
});
