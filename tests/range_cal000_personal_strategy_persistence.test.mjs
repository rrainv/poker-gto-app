import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  DIRECT_COMPARISON_RELATIONS,
  PERSONAL_STRATEGY_EXPORT_SCHEMA_VERSION,
  PERSONAL_STRATEGY_STORAGE_KEY,
  PersonalStrategyStorageError,
  RANGE_OBSERVATION_STATES,
  createCalibrationSession,
  createLocalOwnerRef,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  createTrainingObservation,
  parsePersonalStrategyExport,
  serializePersonalStrategyExport,
  updateCalibrationSession,
} from '../app/src/personal-strategy/index.mjs';

const T0 = '2026-08-14T09:00:00.000Z';
const T1 = '2026-08-14T09:01:00.000Z';
const T2 = '2026-08-14T09:02:00.000Z';
const OWNER = createLocalOwnerRef('local-owner-1');

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writes = [];
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.writes.push({ key, value });
    this.values.set(key, String(value));
  }
}

function repository(storage, now = T2) {
  return createPersonalStrategyRepository({ storage, ownerRef: OWNER, clock: () => now });
}

function bundle(suffix = '1') {
  return createStrategyProfileBundle({
    profileId: `profile-${suffix}`,
    ownerRef: OWNER,
    displayName: suffix === '1' ? 'Home Game' : 'Club Freeroll',
    modes: suffix === '1'
      ? ['Normal', 'Cautious', 'Pressure']
      : ['Standard', 'Survival', 'Aggressive'],
    modeIds: [`mode-${suffix}-a`, `mode-${suffix}-b`, `mode-${suffix}-c`],
    createdAt: T0,
  });
}

function context(overrides = {}) {
  return createRfiCalibrationContext({
    gameRulesId: 'home/v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
    ...overrides,
  });
}

function direct(overrides = {}) {
  return createRangeObservation({
    id: 'direct-1',
    profileId: 'profile-1',
    modeId: 'mode-1-a',
    context: context(),
    handClass: 'AKs',
    dominantAction: { type: ACTION_TYPES.RAISE },
    createdAt: T1,
    ...overrides,
  });
}

test('repository saves and reloads multiple profiles and custom modes under one namespaced key', () => {
  const storage = new MemoryStorage({ appTheme: 'midnight', language: 'he' });
  const first = repository(storage);
  first.saveProfileBundle(bundle('1'));
  first.saveProfileBundle(bundle('2'));

  const reopened = repository(storage).loadSnapshot();
  assert.equal(reopened.profiles.length, 2);
  assert.equal(reopened.modes.length, 6);
  assert.deepEqual(reopened.profiles.map((profile) => profile.displayName), [
    'Home Game', 'Club Freeroll',
  ]);
  assert.deepEqual(reopened.modes.slice(3).map((mode) => mode.displayName), [
    'Standard', 'Survival', 'Aggressive',
  ]);
  assert.equal(storage.getItem('appTheme'), 'midnight');
  assert.equal(storage.getItem('language'), 'he');
  assert.ok(storage.writes.every((write) => write.key === PERSONAL_STRATEGY_STORAGE_KEY));
});

test('CalibrationSession persists resumable scope, observation IDs, cursor, and state', () => {
  const storage = new MemoryStorage();
  const repo = repository(storage);
  repo.saveProfileBundle(bundle());
  const session = createCalibrationSession({
    id: 'calibration-session-1',
    profileId: 'profile-1',
    modeId: 'mode-1-a',
    contextScope: context(),
    startedAt: T0,
  });
  repo.saveCalibrationSession(session);
  repo.saveRangeObservation(direct({ calibrationSessionId: session.id }));
  repo.saveCalibrationSession(updateCalibrationSession(session, {
    state: 'paused',
    observationIds: ['direct-1'],
    nextPromptIndex: 1,
  }, T2));

  const reopened = repository(storage).loadSnapshot();
  assert.deepEqual(reopened.calibrationSessions[0], {
    ...session,
    updatedAt: T2,
    state: 'paused',
    observationIds: ['direct-1'],
    cursor: { nextPromptIndex: 1 },
  });
});

test('direct answers form one linear revision chain and current lookup honors retraction', () => {
  const storage = new MemoryStorage();
  const repo = repository(storage);
  repo.saveProfileBundle(bundle());
  repo.saveRangeObservation(direct());

  const revision = direct({
    id: 'direct-2',
    dominantAction: { type: ACTION_TYPES.FOLD },
    supersedesObservationId: 'direct-1',
    createdAt: T2,
  });
  repo.saveRangeObservation(revision);
  assert.equal(repo.getCurrentRangeObservation({
    profileId: revision.profileId,
    modeId: revision.modeId,
    context: revision.context,
    handClass: revision.handClass,
  }).id, 'direct-2');
  assert.equal(repo.loadSnapshot().rangeObservations.length, 2);

  assert.throws(
    () => repo.saveRangeObservation(direct({
      id: 'branch', supersedesObservationId: 'direct-1', createdAt: T2,
    })),
    /current direct revision/,
  );

  const retraction = direct({
    id: 'direct-3',
    state: RANGE_OBSERVATION_STATES.RETRACTED,
    dominantAction: null,
    supersedesObservationId: 'direct-2',
    createdAt: T2,
  });
  repo.saveRangeObservation(retraction);
  assert.equal(repo.getCurrentRangeObservation({
    profileId: retraction.profileId,
    modeId: retraction.modeId,
    context: retraction.context,
    handClass: retraction.handClass,
  }), null);
  assert.equal(repo.loadSnapshot().rangeObservations.length, 3);
});

test('Training evidence records deviation separately and never overwrites direct calibration', () => {
  const storage = new MemoryStorage();
  const repo = repository(storage);
  repo.saveProfileBundle(bundle());
  const calibration = direct();
  repo.saveRangeObservation(calibration);
  const training = createTrainingObservation({
    id: 'training-observation-1',
    profileId: calibration.profileId,
    modeId: calibration.modeId,
    context: calibration.context,
    handClass: calibration.handClass,
    chosenAction: { type: ACTION_TYPES.FOLD },
    trainingSessionId: 'training-session-1',
    trainingExerciseId: 'training-exercise-1',
    directCalibrationComparison: {
      observationId: calibration.id,
      relation: DIRECT_COMPARISON_RELATIONS.DEVIATES,
    },
    createdAt: T2,
  });
  repo.saveTrainingObservation(training);

  const snapshot = repo.loadSnapshot();
  assert.equal(snapshot.rangeObservations.length, 1);
  assert.equal(snapshot.trainingObservations.length, 1);
  assert.equal(snapshot.rangeObservations[0].dominantAction.type, ACTION_TYPES.RAISE);
  assert.equal(snapshot.trainingObservations[0].chosenAction.type, ACTION_TYPES.FOLD);
  assert.equal(snapshot.trainingObservations[0].directCalibrationComparison.relation, 'deviates');

  const missingDeviation = createTrainingObservation({
    id: 'training-observation-2',
    profileId: calibration.profileId,
    modeId: calibration.modeId,
    context: calibration.context,
    handClass: calibration.handClass,
    chosenAction: { type: ACTION_TYPES.FOLD },
    trainingSessionId: 'training-session-1',
    trainingExerciseId: 'training-exercise-2',
    directCalibrationComparison: null,
    createdAt: T2,
  });
  assert.throws(
    () => repo.saveTrainingObservation(missingDeviation),
    /must record its current direct-calibration deviation/,
  );
});

test('portable export/import validates versions and rejects collisions atomically', () => {
  const sourceStorage = new MemoryStorage();
  const source = repository(sourceStorage);
  source.saveProfileBundle(bundle());
  source.saveRangeObservation(direct({
    frequencies: [
      { action: { type: ACTION_TYPES.RAISE }, weight: 65 },
      { action: { type: ACTION_TYPES.FOLD }, weight: 35 },
    ],
  }));
  const portable = source.exportPortable({ exportedAt: T2 });
  const encoded = serializePersonalStrategyExport(portable);

  assert.equal(portable.schemaVersion, PERSONAL_STRATEGY_EXPORT_SCHEMA_VERSION);
  assert.deepEqual(parsePersonalStrategyExport(encoded), portable);

  const targetStorage = new MemoryStorage({ appTheme: 'daylight' });
  const target = repository(targetStorage);
  target.importPortable(encoded);
  assert.deepEqual(
    target.loadSnapshot().profiles,
    source.loadSnapshot().profiles,
  );
  assert.deepEqual(
    target.loadSnapshot().rangeObservations,
    source.loadSnapshot().rangeObservations,
  );
  const beforeCollision = targetStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY);
  assert.throws(() => target.importPortable(encoded), /ID collision/);
  assert.equal(targetStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), beforeCollision);
  assert.equal(targetStorage.getItem('appTheme'), 'daylight');

  const unsupported = JSON.parse(encoded);
  unsupported.schemaVersion = 'personal-strategy-export/v99';
  assert.throws(() => target.importPortable(unsupported), /Expected personal-strategy-export\/v1/);
});

test('malformed, invalid, and future records fail closed without overwriting stored bytes', () => {
  for (const [serialized, expectedCode] of [
    ['{not-json', 'corrupt_record'],
    [JSON.stringify({ schemaVersion: 'personal-strategy-store/v99' }), 'unsupported_schema'],
    [JSON.stringify({ schemaVersion: 'personal-strategy-store/v1' }), 'invalid_record'],
  ]) {
    const storage = new MemoryStorage({ [PERSONAL_STRATEGY_STORAGE_KEY]: serialized });
    const before = storage.getItem(PERSONAL_STRATEGY_STORAGE_KEY);
    assert.throws(
      () => repository(storage).loadSnapshot(),
      (error) => error instanceof PersonalStrategyStorageError && error.code === expectedCode,
    );
    assert.equal(storage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), before);
    assert.equal(storage.writes.length, 0);
  }
});

test('synthetic v0 store fixture migrates in memory in deterministic order', () => {
  const seedStorage = new MemoryStorage();
  const seed = repository(seedStorage);
  seed.saveProfileBundle(bundle());
  seed.saveRangeObservation(direct());
  const current = seed.loadSnapshot();
  const legacy = {
    schemaVersion: 'personal-strategy-store/v0',
    revision: current.revision,
    ownerId: current.ownerRef.id,
    updatedAt: current.updatedAt,
    profiles: current.profiles,
    modes: current.modes,
    observations: current.rangeObservations,
    sessions: current.calibrationSessions,
  };
  const storage = new MemoryStorage({
    [PERSONAL_STRATEGY_STORAGE_KEY]: JSON.stringify(legacy),
  });

  const migrated = repository(storage).loadSnapshot();
  assert.equal(migrated.schemaVersion, 'personal-strategy-store/v1');
  assert.deepEqual(migrated.ownerRef, OWNER);
  assert.deepEqual(migrated.rangeObservations, current.rangeObservations);
  assert.deepEqual(migrated.trainingObservations, []);
  assert.equal(storage.writes.length, 0, 'read migration does not mutate durable bytes');
});

test('a failed whole-document write leaves the prior durable snapshot authoritative', () => {
  const storage = new MemoryStorage();
  const repo = repository(storage);
  repo.saveProfileBundle(bundle());
  const before = storage.getItem(PERSONAL_STRATEGY_STORAGE_KEY);
  storage.setItem = () => { throw new Error('quota exceeded'); };

  assert.throws(
    () => repo.saveRangeObservation(direct()),
    (error) => error instanceof PersonalStrategyStorageError && error.code === 'write_failed',
  );
  assert.equal(storage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), before);
});
