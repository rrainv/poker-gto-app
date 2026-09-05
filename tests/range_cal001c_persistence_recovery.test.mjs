import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES } from '../shared/poker-domain/index.js';
import {
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';
import {
  PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION,
  PERSONAL_STRATEGY_DATABASE_VERSION,
  PERSONAL_STRATEGY_OBJECT_STORES,
  PERSONAL_STRATEGY_STORAGE_KEY,
  PersonalStrategyStorageError,
  createCalibrationSession,
  createLocalOwnerRef,
  createMemoryPersonalStrategyDatabase,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  updateCalibrationSession,
} from '../app/src/personal-strategy/index.mjs';

const OWNER = createLocalOwnerRef('range-cal001c-owner');
const OTHER_OWNER = createLocalOwnerRef('range-cal001c-other-owner');
const T0 = '2026-08-14T14:00:00.000Z';
const T1 = '2026-08-14T14:01:00.000Z';
const T2 = '2026-08-14T14:02:00.000Z';
const T3 = '2026-08-14T14:03:00.000Z';

function asLegacyV1(snapshot) {
  const legacy = structuredClone(snapshot);
  legacy.schemaVersion = 'personal-strategy-store/v1';
  delete legacy.qualitativeEvidence;
  for (const profile of legacy.profiles) {
    profile.schemaVersion = 'strategy-profile/v1';
    delete profile.setupVersion; delete profile.setupAssumptions; delete profile.versionHistory;
  }
  for (const mode of legacy.modes) {
    mode.schemaVersion = 'strategy-mode/v1';
    delete mode.approachVersion; delete mode.versionHistory; delete mode.forkProvenance;
  }
  return legacy;
}

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function context(stack = 100) {
  return createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: stack,
  });
}

function bundle(ownerRef = OWNER, suffix = '1') {
  return createStrategyProfileBundle({
    profileId: `profile-${suffix}`,
    ownerRef,
    displayName: `Profile ${suffix}`,
    modes: ['Normal', 'Cautious', 'Pressure'],
    modeIds: [`mode-${suffix}-1`, `mode-${suffix}-2`, `mode-${suffix}-3`],
    createdAt: T0,
  });
}

function repository({ database = createMemoryPersonalStrategyDatabase(), legacyStorage = new MemoryStorage(), ownerRef = OWNER } = {}) {
  return createPersonalStrategyRepository({
    database,
    legacyStorage,
    ownerRef,
    clock: () => T3,
  });
}

async function configured() {
  const database = createMemoryPersonalStrategyDatabase();
  const repo = repository({ database });
  const profileBundle = bundle();
  await repo.saveProfileBundle(profileBundle);
  const session = createCalibrationSession({
    id: 'session-1',
    profileId: profileBundle.profile.id,
    modeId: profileBundle.modes[0].id,
    contextScope: context(),
    startedAt: T0,
  });
  await repo.saveCalibrationSession(session);
  return { database, repo, profileBundle, session };
}

function answer(session, {
  id = 'answer-1',
  handClass = 'AA',
  actionType = ACTION_TYPES.RAISE,
  createdAt = T1,
  supersedesObservationId = null,
} = {}) {
  const observation = createRangeObservation({
    id,
    profileId: session.profileId,
    modeId: session.modeId,
    context: session.contextScope,
    handClass,
    dominantAction: { type: actionType },
    calibrationSessionId: session.id,
    supersedesObservationId,
    createdAt,
  });
  const updatedSession = updateCalibrationSession(session, {
    observationIds: [...session.observationIds, observation.id],
    nextPromptIndex: session.cursor.nextPromptIndex + 1,
  }, createdAt);
  return { observation, session: updatedSession, expectedSessionUpdatedAt: session.updatedAt };
}

test('answer observation and session cursor abort together, then retry commits both', async () => {
  const { database, repo, session } = await configured();
  const command = answer(session);
  const before = await repo.loadSnapshot();
  database.failNextTransaction('before_commit', new Error('injected abort'), 'readwrite');

  await assert.rejects(
    repo.saveCalibrationAnswer(command),
    (error) => error instanceof PersonalStrategyStorageError && error.code === 'transaction_failed',
  );
  assert.deepEqual(await repo.loadSnapshot(), before);

  const committed = await repo.saveCalibrationAnswer(command);
  assert.equal(committed.idempotent, undefined);
  const after = await repo.loadSnapshot();
  assert.equal(after.rangeObservations.length, 1);
  assert.deepEqual(after.calibrationSessions[0].observationIds, ['answer-1']);
  assert.equal(after.calibrationSessions[0].cursor.nextPromptIndex, 1);
});

test('ambiguous post-commit retry is idempotent and cannot duplicate an answer', async () => {
  const { database, repo, session } = await configured();
  const command = answer(session);
  database.failNextTransaction('after_commit', new Error('connection lost after commit'), 'readwrite');

  await assert.rejects(repo.saveCalibrationAnswer(command), { code: 'transaction_failed' });
  const retried = await repo.saveCalibrationAnswer(command);
  assert.equal(retried.idempotent, true);
  const snapshot = await repo.loadSnapshot();
  assert.equal(snapshot.rangeObservations.length, 1);
  assert.deepEqual(snapshot.calibrationSessions[0].observationIds, ['answer-1']);
});

test('close/reopen preserves profiles, sessions, current leaves, and revision history', async () => {
  const { database, repo, session } = await configured();
  const first = answer(session);
  await repo.saveCalibrationAnswer(first);
  const revision = createRangeObservation({
    id: 'answer-2',
    profileId: session.profileId,
    modeId: session.modeId,
    context: session.contextScope,
    handClass: 'AA',
    dominantAction: { type: ACTION_TYPES.FOLD },
    calibrationSessionId: session.id,
    supersedesObservationId: first.observation.id,
    createdAt: T2,
  });
  await repo.saveRangeObservation(revision);
  await repo.close();
  database.reopen();

  const reopened = repository({ database });
  const snapshot = await reopened.loadSnapshot();
  assert.equal(snapshot.profiles.length, 1);
  assert.equal(snapshot.calibrationSessions.length, 1);
  assert.equal(snapshot.rangeObservations.length, 2);
  assert.equal((await reopened.getCurrentRangeObservation({
    profileId: session.profileId,
    modeId: session.modeId,
    context: session.contextScope,
    handClass: 'AA',
  })).id, revision.id);
});

async function legacyFixture() {
  const seed = repository();
  await seed.saveProfileBundle(bundle());
  const snapshot = await seed.loadSnapshot();
  return JSON.stringify(asLegacyV1(snapshot));
}

test('valid Web Storage v1 migration is automatic, verified, idempotent, and retains its source', async () => {
  const serialized = await legacyFixture();
  const legacyStorage = new MemoryStorage({ [PERSONAL_STRATEGY_STORAGE_KEY]: serialized });
  const database = createMemoryPersonalStrategyDatabase();
  const first = repository({ database, legacyStorage });
  assert.equal((await first.loadSnapshot()).profiles.length, 1);
  const status = await first.getMigrationStatus();
  assert.equal(status.status, 'complete');
  assert.equal(status.source, 'web-storage-v1');
  assert.equal(status.sourceRetained, true);
  assert.equal(status.counts.profiles, 1);
  assert.equal(legacyStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), serialized);

  const repeated = repository({ database, legacyStorage });
  assert.equal((await repeated.loadSnapshot()).profiles.length, 1);
  assert.deepEqual(await repeated.getMigrationStatus(), status);
});

test('no legacy data initializes an empty durable database without touching Web Storage', async () => {
  const legacyStorage = new MemoryStorage();
  const repo = repository({ legacyStorage });
  assert.equal((await repo.loadSnapshot()).profiles.length, 0);
  assert.equal((await repo.getMigrationStatus()).source, 'none');
  assert.equal(legacyStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), null);
});

test('creating the Range Calibration application does no database work before activation', async () => {
  const database = createMemoryPersonalStrategyDatabase();
  const storage = new MemoryStorage();
  const application = createRangeCalibrationApplication({
    database,
    storage,
    idFactory: (prefix) => `${prefix}-lazy-test`,
    clock: () => T3,
  });
  assert.equal(database.getMetrics().transactions, 0);
  await application.readWorkspace();
  assert.ok(database.getMetrics().transactions > 0);
});

test('malformed and owner-mismatched legacy data fail closed and remain byte-for-byte intact', async () => {
  const malformed = '{broken-json';
  const malformedStorage = new MemoryStorage({ [PERSONAL_STRATEGY_STORAGE_KEY]: malformed });
  await assert.rejects(repository({ legacyStorage: malformedStorage }).initialize(), { code: 'corrupt_record' });
  assert.equal(malformedStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), malformed);

  const otherSeed = repository({ ownerRef: OTHER_OWNER });
  await otherSeed.saveProfileBundle(bundle(OTHER_OWNER, 'other'));
  const otherSerialized = JSON.stringify(await otherSeed.loadSnapshot());
  const otherStorage = new MemoryStorage({ [PERSONAL_STRATEGY_STORAGE_KEY]: otherSerialized });
  await assert.rejects(repository({ legacyStorage: otherStorage }).initialize(), { code: 'owner_mismatch' });
  assert.equal(otherStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), otherSerialized);
});

test('interrupted migration leaves no partial database, preserves the source, and retries safely', async () => {
  const serialized = await legacyFixture();
  const legacyStorage = new MemoryStorage({ [PERSONAL_STRATEGY_STORAGE_KEY]: serialized });
  const database = createMemoryPersonalStrategyDatabase();
  database.failNextTransaction('before_commit', new Error('power loss'), 'readwrite');
  const repo = repository({ database, legacyStorage });

  await assert.rejects(repo.initialize(), { code: 'migration_failed' });
  assert.equal(legacyStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY), serialized);
  assert.equal((await repo.loadSnapshot()).profiles.length, 1);
  assert.equal((await repo.getMigrationStatus()).sourceRetained, true);
});

test('database open failure is actionable and initialization can be retried', async () => {
  const database = createMemoryPersonalStrategyDatabase();
  database.failNextTransaction('open', new Error('database unavailable'), 'readonly');
  const repo = repository({ database });
  await assert.rejects(repo.initialize(), { code: 'open_failed' });
  assert.equal((await repo.loadSnapshot()).profiles.length, 0);
});

test('future unsupported backend metadata fails closed without resetting records', async () => {
  const database = createMemoryPersonalStrategyDatabase();
  await database.runTransaction([PERSONAL_STRATEGY_OBJECT_STORES.METADATA], 'readwrite', (transaction) => (
    transaction.put(PERSONAL_STRATEGY_OBJECT_STORES.METADATA, {
      key: 'state',
      backendSchemaVersion: `${PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION}-future`,
      databaseVersion: PERSONAL_STRATEGY_DATABASE_VERSION + 1,
      domainSchemaVersion: 'personal-strategy-store/v1',
      revision: 9,
      ownerRef: OWNER,
      updatedAt: T3,
      migration: { status: 'complete' },
    })
  ));
  await assert.rejects(repository({ database }).initialize(), { code: 'unsupported_database_version' });
  const raw = await database.runTransaction(
    [PERSONAL_STRATEGY_OBJECT_STORES.METADATA],
    'readonly',
    (transaction) => transaction.get(PERSONAL_STRATEGY_OBJECT_STORES.METADATA, 'state'),
  );
  assert.equal(raw.revision, 9);
});

test('portable import failure is atomic and export remains backend-independent', async () => {
  const source = repository();
  await source.saveProfileBundle(bundle());
  const portable = await source.exportPortable({ exportedAt: T3 });
  assert.equal('backendSchemaVersion' in portable, false);
  assert.equal('databaseVersion' in portable, false);

  const targetDatabase = createMemoryPersonalStrategyDatabase();
  const target = repository({ database: targetDatabase });
  await target.initialize();
  const before = await target.loadSnapshot();
  targetDatabase.failNextTransaction('before_commit', new Error('quota exceeded'), 'readwrite');
  await assert.rejects(target.importPortable(portable), { code: 'transaction_failed' });
  assert.deepEqual(await target.loadSnapshot(), before);
  await target.importPortable(portable);
  assert.deepEqual((await target.loadSnapshot()).profiles, (await source.loadSnapshot()).profiles);
});
