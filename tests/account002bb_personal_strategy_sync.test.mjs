import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createRangeCalibrationApplication,
} from '../app/src/application/range-calibration-service.mjs';
import { createStudySyncAggregate } from '../app/src/application/saved-study-sync-bootstrap.mjs';
import {
  createLocalOwnerRef,
  createMemoryPersonalStrategyDatabase,
  updateStrategyProfile,
} from '../app/src/personal-strategy/index.mjs';
import {
  RFI_INFERENCE_ABSTENTION_REASONS,
  RFI_INFERENCE_STATUSES,
  createRfiInferenceRequest,
  inferSparseRfiHand,
} from '../app/src/personal-strategy/rfi-inference.mjs';
import {
  PERSONAL_STRATEGY_SYNC_DOMAIN,
  SYNC_UI_STATES,
  createFakeRemoteSyncAdapter,
  createFakeRemoteSyncBackend,
  createMemorySyncDatabase,
  createPersonalStrategySyncAdapter,
  createRangeCalibrationSyncAdapter,
  createSyncCoordinator,
  createSyncRepository,
  validateRemotePersonalStrategyEntity,
} from '../app/src/sync/index.mjs';

const IDENTITY = 'account-002bb-identity';
const CONTEXT = Object.freeze({
  environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
});

function clock(start = Date.parse('2026-08-17T14:00:00.000Z')) {
  let value = start;
  return () => new Date(value += 1000);
}

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function device({ label, backend, syncDatabase = null } = {}) {
  const now = clock();
  let ids = 0;
  let coordinator = null;
  const application = createRangeCalibrationApplication({
    storage: storage(),
    database: createMemoryPersonalStrategyDatabase({ name: `personal-${label}` }),
    ownerRef: createLocalOwnerRef(`owner-${label}`),
    clock: now,
    idFactory: (prefix) => `${prefix}-${label}-${++ids}`,
    onLocalMutation: async (mutation) => {
      for (const entity of mutation.entities) await coordinator?.recordLocalMutation(entity);
    },
  });
  const port = Object.freeze({
    ownerRef: async () => application.ownerRef,
    listEntities: () => application.repository.listSyncEntities(),
    getEntityById: (id) => application.repository.getSyncEntityById(id),
    getSummary: () => application.repository.getSyncSummary(),
    applyRemoteEntity: (entity, document) => application.repository.applySyncedEntity(entity, document),
  });
  const remote = createFakeRemoteSyncAdapter({
    backend,
    clock: now,
    validators: { [PERSONAL_STRATEGY_SYNC_DOMAIN]: validateRemotePersonalStrategyEntity },
  });
  const repository = createSyncRepository({
    database: syncDatabase ?? createMemorySyncDatabase({ name: `sync-${label}` }),
    domain: PERSONAL_STRATEGY_SYNC_DOMAIN,
  });
  const personalAdapter = createPersonalStrategySyncAdapter({ syncPort: port });
  const rangeAdapter = createRangeCalibrationSyncAdapter({ syncPort: port });
  assert.equal(rangeAdapter.supports({ schemaVersion: 'calibration-session/v1' }), true);
  coordinator = createSyncCoordinator({
    repository,
    remoteAdapter: remote,
    domainAdapter: personalAdapter,
    clock: now,
    idFactory: (prefix) => `${prefix}-${label}-${++ids}`,
    scheduleTask: () => ({ manual: true }),
    cancelTask: () => {},
  });
  return { application, coordinator, remote, repository, port };
}

async function activate(harness, identityId = IDENTITY) {
  return harness.coordinator.activate({ identityId, authenticated: true, sessionValid: true });
}

async function createProfileAndSession(harness, name = 'Friday Home Game') {
  const bundle = await harness.application.createProfile({
    displayName: name,
    description: 'Private calibration profile',
    environment: 'home',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  const state = await harness.application.startOrResumeSession({
    selectedProfileId: bundle.profile.id,
    activeModeId: bundle.modes[0].id,
    context: CONTEXT,
  });
  return { bundle, state };
}

async function resume(harness, profileId, modeId) {
  return harness.application.startOrResumeSession({
    selectedProfileId: profileId, activeModeId: modeId, context: CONTEXT,
  });
}

test('Personal Strategy opt-in is independent and disabled means zero remote work', async () => {
  const backend = createFakeRemoteSyncBackend();
  const first = device({ label: 'opt-in', backend });
  await activate(first);
  await createProfileAndSession(first);
  await first.coordinator.syncNow();
  assert.equal(first.remote.getCalls().length, 0);
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.DISABLED);

  const summary = await first.port.getSummary();
  assert.deepEqual(summary, { profileCount: 1, directObservationCount: 0, activeSessionCount: 1 });
  await first.coordinator.enable();
  await first.coordinator.syncNow();
  assert.ok(first.remote.getCalls().some((entry) => entry.method === 'push'));
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
});

test('cold device reconstructs stable profile/mode/evidence/session IDs and resumes progress', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'cold-a', backend });
  await activate(a);
  const created = await createProfileAndSession(a);
  const answered = await a.application.answerCalibrationQuestion(created.state, { actionType: 'raise' });
  await a.coordinator.enable();
  await a.coordinator.syncNow();

  const b = device({ label: 'cold-b', backend });
  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();
  const snapshot = await b.application.repository.loadSnapshot();
  assert.equal(snapshot.profiles[0].id, created.bundle.profile.id);
  assert.deepEqual(snapshot.profiles[0].modeIds, created.bundle.profile.modeIds);
  assert.equal(snapshot.rangeObservations[0].id, answered.acceptedObservation.id);
  assert.equal(snapshot.calibrationSessions[0].id, answered.session.id);
  assert.equal(snapshot.calibrationSessions[0].cursor.calibrationIntent, 'standard');
  assert.deepEqual(
    snapshot.calibrationSessions[0].cursor.askedHandClasses,
    answered.session.cursor.askedHandClasses,
  );
  assert.equal(
    snapshot.calibrationSessions[0].cursor.selectionPolicyVersion,
    answered.session.cursor.selectionPolicyVersion,
  );
  const resumed = await resume(b, created.bundle.profile.id, created.bundle.modes[0].id);
  assert.equal(resumed.progress.answered, 1);
  assert.equal(resumed.prompt.handClass, answered.prompt.handClass);
  assert.deepEqual(resumed.session.cursor.askedHandClasses, answered.session.cursor.askedHandClasses);
});

test('offline contradictory direct answers both survive and deterministic inference abstains', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'conflict-a', backend });
  await activate(a);
  const created = await createProfileAndSession(a);
  let aState = await a.application.answerCalibrationQuestion(created.state, { actionType: 'raise' });
  await a.coordinator.enable();
  await a.coordinator.syncNow();

  const b = device({ label: 'conflict-b', backend });
  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();
  let bState = await resume(b, created.bundle.profile.id, created.bundle.modes[0].id);
  const conflictingHand = aState.prompt.handClass;
  aState = await a.application.answerCalibrationQuestion(aState, { actionType: 'raise' });
  bState = await b.application.answerCalibrationQuestion(bState, { actionType: 'fold' });
  const aEvidenceId = aState.acceptedObservation.id;
  const bEvidenceId = bState.acceptedObservation.id;

  await a.coordinator.syncNow();
  await b.coordinator.syncNow();
  await b.coordinator.syncNow();
  await a.coordinator.syncNow();
  await a.coordinator.syncNow();
  const snapshot = await a.application.repository.loadSnapshot();
  const conflicting = snapshot.rangeObservations.filter((entry) => entry.handClass === conflictingHand);
  assert.deepEqual(new Set(conflicting.map((entry) => entry.id)), new Set([aEvidenceId, bEvidenceId]));
  const resumedA = await resume(a, created.bundle.profile.id, created.bundle.modes[0].id);
  const resumedB = await resume(b, created.bundle.profile.id, created.bundle.modes[0].id);
  assert.equal(resumedA.progress.answered, 2);
  assert.equal(resumedA.prompt.handClass, resumedB.prompt.handClass);
  assert.notEqual(resumedA.prompt.handClass, conflictingHand);
  assert.equal(Object.hasOwn(resumedA.session.cursor, 'rankedCandidates'), false);
  assert.equal(Object.hasOwn(resumedA.session.cursor, 'questionValueScore'), false);

  const result = inferSparseRfiHand(createRfiInferenceRequest({
    profileId: created.bundle.profile.id,
    modeId: created.bundle.modes[0].id,
    context: conflicting[0].context,
    directObservations: snapshot.rangeObservations,
    requestedHandClass: conflictingHand,
  }));
  assert.equal(result.status, RFI_INFERENCE_STATUSES.ABSTAINED);
  assert.equal(result.diagnostics.reason, RFI_INFERENCE_ABSTENTION_REASONS.CONTRADICTORY_DIRECT_EVIDENCE);
  assert.deepEqual(new Set(result.evidenceReferences.map((entry) => entry.observationId)), new Set([aEvidenceId, bEvidenceId]));
});

test('same-field profile rename conflict is explicit while IDs remain stable', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'rename-a', backend });
  await activate(a);
  const created = await createProfileAndSession(a, 'Home Friends');
  await a.coordinator.enable();
  await a.coordinator.syncNow();
  const b = device({ label: 'rename-b', backend });
  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();

  await a.application.updateProfileConfiguration(created.bundle.profile.id, {
    displayName: 'Friday Home Game', description: 'Private calibration profile',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  await b.application.updateProfileConfiguration(created.bundle.profile.id, {
    displayName: 'Friends 2026', description: 'Private calibration profile',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  await a.coordinator.syncNow();
  await b.coordinator.syncNow();
  assert.equal(b.coordinator.getState().state, SYNC_UI_STATES.CONFLICT);
  const [conflict] = await b.coordinator.listConflicts();
  assert.equal(conflict.localObject.profile.id, created.bundle.profile.id);
  assert.equal(conflict.localObject.profile.displayName, 'Friends 2026');
  assert.equal(conflict.remoteObject.payload.profile.displayName, 'Friday Home Game');
  await b.coordinator.resolveConflict(created.bundle.profile.id, 'keep_cloud');
  assert.equal((await b.application.repository.loadSnapshot()).profiles[0].displayName, 'Friday Home Game');
});

test('same-field mode rename conflicts explicitly and archived profiles cannot be resurrected by stale edits', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'mode-a', backend });
  await activate(a);
  const created = await createProfileAndSession(a, 'Archive Test');
  await a.coordinator.enable();
  await a.coordinator.syncNow();
  const b = device({ label: 'mode-b', backend });
  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();

  await a.application.updateProfileConfiguration(created.bundle.profile.id, {
    displayName: 'Archive Test', description: 'Private calibration profile',
    modeNames: ['Steady', 'Cautious', 'Pressure'],
  });
  await b.application.updateProfileConfiguration(created.bundle.profile.id, {
    displayName: 'Archive Test', description: 'Private calibration profile',
    modeNames: ['Balanced', 'Cautious', 'Pressure'],
  });
  await a.coordinator.syncNow();
  await b.coordinator.syncNow();
  const [modeConflict] = await b.coordinator.listConflicts();
  assert.equal(modeConflict.localObject.modes[0].displayName, 'Balanced');
  assert.equal(modeConflict.remoteObject.payload.modes[0].displayName, 'Steady');
  await b.coordinator.resolveConflict(created.bundle.profile.id, 'keep_cloud');

  const aSnapshot = await a.application.repository.loadSnapshot();
  const archived = updateStrategyProfile(
    aSnapshot.profiles[0], { state: 'archived' }, '2026-08-18T00:00:00.000Z',
  );
  await a.application.repository.saveProfile(archived);
  const aEntity = await a.application.repository.getSyncEntityById(archived.id);
  await a.coordinator.recordLocalMutation(aEntity);
  await a.coordinator.syncNow();
  await b.application.updateProfileConfiguration(created.bundle.profile.id, {
    displayName: 'Stale active edit', description: 'Private calibration profile',
    modeNames: ['Steady', 'Cautious', 'Pressure'],
  });
  await b.coordinator.syncNow();
  await b.coordinator.syncNow();
  assert.equal((await b.application.repository.loadSnapshot()).profiles[0].state, 'archived');
  assert.equal(
    b.remote.get(IDENTITY, archived.id, PERSONAL_STRATEGY_SYNC_DOMAIN).object.payload.profile.state,
    'archived',
  );
});

test('study sync status aggregates Saved and Personal Strategy pending/conflict/error counts', () => {
  function coordinator(initial) {
    let state = initial;
    const listeners = new Set();
    return {
      getState: () => state,
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      set(next) { state = next; for (const listener of listeners) listener(next); },
      getEnableSummary: async () => ({ itemCount: 0 }),
      enable: async () => {}, disable: async () => {}, syncNow: async () => {},
      listConflicts: async () => [], resolveConflict: async () => {},
    };
  }
  const base = {
    state: SYNC_UI_STATES.SYNCED, enabled: true, decided: true,
    pendingCount: 1, conflictCount: 0, errorCount: 0,
  };
  const saved = coordinator(base);
  const strategy = coordinator({
    ...base, state: SYNC_UI_STATES.CONFLICT,
    pendingCount: 2, conflictCount: 1, errorCount: 0,
  });
  const aggregate = createStudySyncAggregate(saved, strategy, { getSummary: async () => ({}) });
  assert.equal(aggregate.getState().state, SYNC_UI_STATES.CONFLICT);
  assert.equal(aggregate.getState().pendingCount, 3);
  assert.equal(aggregate.getState().conflictCount, 1);
  strategy.set({
    ...base, state: SYNC_UI_STATES.ERROR,
    pendingCount: 0, conflictCount: 0, errorCount: 1,
  });
  assert.equal(aggregate.getState().state, SYNC_UI_STATES.ERROR);
  assert.equal(aggregate.getState().errorCount, 1);
});

test('Guest/account switch cancellation and portable import keep account boundaries and sync internals separate', async () => {
  const backend = createFakeRemoteSyncBackend();
  const source = device({ label: 'export-source', backend });
  const created = await createProfileAndSession(source);
  await source.application.answerCalibrationQuestion(created.state, { actionType: 'raise' });
  const portable = await source.application.exportPortable();
  assert.doesNotMatch(JSON.stringify(portable), /outbox|sync-op|providerSubject|accessToken/i);

  const target = device({ label: 'import-target', backend });
  await activate(target);
  await target.coordinator.enable();
  await target.application.importPortable(portable);
  assert.equal(target.remote.get(IDENTITY, created.bundle.profile.id, PERSONAL_STRATEGY_SYNC_DOMAIN), null);
  await target.coordinator.syncNow();
  assert.equal(
    target.remote.get(IDENTITY, created.bundle.profile.id, PERSONAL_STRATEGY_SYNC_DOMAIN).object.id,
    created.bundle.profile.id,
  );
  const calls = target.remote.getCalls().length;
  await target.coordinator.activate({ identityId: null, authenticated: false, sessionValid: false });
  await target.coordinator.syncNow();
  assert.equal(target.remote.getCalls().length, calls);
  await target.coordinator.activate({ identityId: 'account-b', authenticated: true, sessionValid: true });
  assert.equal((await target.repository.summary('account-b')).syncedCount, 0);
});

test('migration and account UX expose private relational/RLS sync without generic Training history', async () => {
  const [sql, html, bootstrap, translations] = await Promise.all([
    readFile(new URL('../supabase/migrations/202608170003_personal_strategy_sync.sql', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/saved-study-sync-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/account-translations.js', import.meta.url), 'utf8'),
  ]);
  for (const table of [
    'personal_strategy_profiles', 'personal_strategy_modes',
    'personal_strategy_evidence', 'range_calibration_sessions',
  ]) assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  assert.match(sql, /sync_personal_strategy_entity_v1/);
  assert.match(sql, /pull_personal_strategy_entities_v1/);
  assert.match(sql, /owner_auth_user_id uuid not null default auth\.uid\(\)/i);
  assert.match(sql, /riverline_sync_owner_matches/);
  assert.doesNotMatch(sql, /service_role|for delete/i);
  assert.match(html, /id="accountStrategySyncToggle"[^>]+role="switch"/);
  assert.match(html, /Personal Strategy and Range Calibration/);
  assert.match(bootstrap, /createPersonalStrategySyncAdapter/);
  assert.match(bootstrap, /createRangeCalibrationSyncAdapter/);
  assert.match(bootstrap, /riverline:personalstrategychange/);
  assert.match(translations, /[\u0590-\u05ff]/u);
  assert.match(translations, /[\u0400-\u04ff]/u);
  assert.doesNotMatch(sql, /training_history/i);
});
