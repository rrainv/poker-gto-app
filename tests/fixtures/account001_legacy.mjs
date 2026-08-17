import { ACTION_TYPES } from '../../shared/poker-domain/index.js';
import {
  createCalibrationSession,
  createLocalOwnerRef,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  createTrainingObservation,
  updateCalibrationSession,
} from '../../app/src/personal-strategy/index.mjs';
import {
  createSavedStudyAnnotations,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudySource,
} from '../../app/src/saved-study-objects/index.mjs';

export const ACCOUNT001_LEGACY_T0 = '2026-08-17T08:00:00.000Z';
export const ACCOUNT001_LEGACY_T1 = '2026-08-17T08:01:00.000Z';
export const ACCOUNT001_LEGACY_T2 = '2026-08-17T08:02:00.000Z';
export const ACCOUNT001_LEGACY_SAVED_OWNER_ID = 'pre-account-saved-owner';
export const ACCOUNT001_LEGACY_PERSONAL_OWNER_ID = 'pre-account-personal-owner';

export function createPreAccountSavedStudyFixture({
  ownerId = ACCOUNT001_LEGACY_SAVED_OWNER_ID,
  id = 'pre-account-saved-object',
} = {}) {
  return createSavedStudyObject({
    id,
    ownerRef: createSavedStudyOwnerRef(ownerId),
    kind: 'legacy_account_fixture',
    createdAt: ACCOUNT001_LEGACY_T0,
    annotations: createSavedStudyAnnotations({
      title: 'Legacy turn review',
      note: 'Preserve this annotation',
      tags: ['Legacy'],
      reviewState: 'review_later',
      classifications: ['mistake'],
    }),
    source: createSavedStudySource({ surface: 'playbook', sourceId: 'legacy-source' }),
    payload: {
      schemaVersion: 'legacy-account-fixture/v1',
      replayMarker: 'canonical-replay-source-remains-opaque-and-unchanged',
    },
  });
}

export function createPreAccountPersonalStrategyFixture({
  ownerId = ACCOUNT001_LEGACY_PERSONAL_OWNER_ID,
  suffix = 'legacy',
} = {}) {
  const ownerRef = createLocalOwnerRef(ownerId);
  const profileId = `profile-${suffix}`;
  const modeIds = [`mode-${suffix}-1`, `mode-${suffix}-2`, `mode-${suffix}-3`];
  const bundle = createStrategyProfileBundle({
    profileId,
    ownerRef,
    displayName: 'Pre-account Home Game',
    description: 'Existing Personal Strategy data',
    modes: ['Normal', 'Cautious', 'Pressure'],
    modeIds,
    createdAt: ACCOUNT001_LEGACY_T0,
  });
  const context = createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
  });
  const initialSession = createCalibrationSession({
    id: `session-${suffix}`,
    profileId,
    modeId: modeIds[0],
    contextScope: context,
    startedAt: ACCOUNT001_LEGACY_T0,
  });
  const direct = createRangeObservation({
    id: `direct-${suffix}`,
    profileId,
    modeId: modeIds[0],
    context,
    handClass: 'AKs',
    dominantAction: { type: ACTION_TYPES.RAISE },
    calibrationSessionId: initialSession.id,
    createdAt: ACCOUNT001_LEGACY_T1,
  });
  const session = updateCalibrationSession(initialSession, {
    state: 'paused',
    observationIds: [direct.id],
    nextPromptIndex: 1,
  }, ACCOUNT001_LEGACY_T2);
  const training = createTrainingObservation({
    id: `training-${suffix}`,
    profileId,
    modeId: modeIds[0],
    context,
    handClass: 'AKs',
    chosenAction: { type: ACTION_TYPES.FOLD },
    trainingSessionId: `training-session-${suffix}`,
    trainingExerciseId: `training-exercise-${suffix}`,
    directCalibrationComparison: { observationId: direct.id, relation: 'deviates' },
    createdAt: ACCOUNT001_LEGACY_T2,
  });
  return Object.freeze({ ownerRef, bundle, context, initialSession, session, direct, training });
}

