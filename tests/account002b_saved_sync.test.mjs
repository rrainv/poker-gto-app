import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyChance,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
} from '../shared/poker-domain/index.js';
import { createSavedStudyObjectOpenController } from '../app/src/application/saved-study-object-open-controller.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createPlaybookScenarioInput } from '../app/src/application/playbook-state-source.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
} from '../app/src/saved-study-objects/index.mjs';
import {
  SYNC_UI_STATES,
  createFakeRemoteSyncAdapter,
  createFakeRemoteSyncBackend,
  createMemorySyncDatabase,
  createSavedStudySyncDomainAdapter,
  createSyncCoordinator,
  createSyncRepository,
  toRemoteSavedStudyObject,
} from '../app/src/sync/index.mjs';

const IDENTITY = 'riverline-account-sync-test';

function scenario() {
  const scenarioInput = createPlaybookScenarioInput({
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['As', 'Kh'],
    board: ['Qc', '7d', '2s'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 6.5,
    lastAction: 'check',
    lastActionLabel: 'Checked to Hero',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
  return {
    scenarioInput,
    decisionContext: {
      schemaVersion: 'decision-context/v1',
      tableSize: 6,
      opponentCount: null,
      heroPosition: 'BTN',
      street: 'flop',
      heroCards: ['As', 'Kh'],
      board: ['Qc', '7d', '2s'],
      deadCards: [],
      stackBb: 100,
      stackMode: 'hero',
      potBb: 6.5,
      lastAction: 'check',
      facingSizeBb: 0,
      callAmountBb: 0,
      heroStreetContributionBb: null,
      rakeMode: 'off',
      forcedContributionPerPlayerBb: 0,
      totalForcedContributionBb: 0,
    },
  };
}

function clock(start = Date.parse('2026-08-17T12:00:00.000Z')) {
  let now = start;
  return {
    read: () => new Date(now += 1000),
    advance: (milliseconds) => { now += milliseconds; },
  };
}

function device({
  label,
  backend,
  syncDatabase = createMemorySyncDatabase({ name: `sync-${label}` }),
  remote = null,
} = {}) {
  const time = clock();
  let coordinator = null;
  let ids = 0;
  const application = createSavedStudyObjectApplication({
    database: createMemorySavedStudyDatabase({ name: `saved-${label}` }),
    ownerRef: createSavedStudyOwnerRef(`owner-${label}`),
    clock: time.read,
    idFactory: (prefix) => `${prefix}-${label}-${++ids}`,
    onLocalMutation: (mutation) => coordinator?.recordLocalMutation(mutation.object),
  });
  const port = {
    listAll: () => application.listAllForSync(),
    getById: (id) => application.getById(id),
    applyRemote: (object, options) => application.applySyncedObject(object, options),
    saveObject: (object) => application.applySyncedObject(object),
    activate: () => application.activate(),
  };
  const adapter = remote ?? createFakeRemoteSyncAdapter({ backend, clock: time.read });
  const syncRepository = createSyncRepository({ database: syncDatabase });
  coordinator = createSyncCoordinator({
    repository: syncRepository,
    remoteAdapter: adapter,
    domainAdapter: createSavedStudySyncDomainAdapter({ syncPort: port, clock: time.read }),
    clock: time.read,
    idFactory: (prefix) => `${prefix}-${label}-${++ids}`,
    scheduleTask: () => ({ label: 'not-run-automatically' }),
    cancelTask: () => {},
  });
  return { application, coordinator, remote: adapter, syncDatabase, syncRepository, time };
}

async function saveSpot(deviceHarness, { id = null, title = null } = {}) {
  const input = scenario();
  return deviceHarness.application.saveScenarioDerivedSpot({
    ...input,
    title,
    operation: id ? { id, createdAt: '2026-08-17T12:00:00.000Z' } : null,
  });
}

function savedHandInput() {
  let state = initializeHand({
    handId: 'cloud-cold-replay-hand',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 100_000 },
    ],
  });
  const replay = createReplayProjectionController({
    getLiveState: () => state,
    getHeroPlayerId: () => 'Hero',
  });
  replay.replaceHand({
    state,
    heroPlayerId: 'Hero',
    operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
  });
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: ['As', 'Kh'] },
    hiddenPlayerIds: ['Villain'],
  });
  replay.recordTransition({
    state,
    heroPlayerId: 'Hero',
    operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
  });
  return { pokerState: state, heroPlayerId: 'Hero', replaySource: replay.createCanonicalHandReplaySource() };
}

function savedV2HandInput() {
  const game = {
    mode: GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  };
  let state = initializeHandFromGameRulesSnapshot({
    handId: 'cloud-cold-replay-hand-v2',
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration(game, 2),
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 100_000 },
    ],
  });
  const replay = createReplayProjectionController();
  replay.replaceHand({
    state,
    heroPlayerId: 'Hero',
    operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
  });
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: ['As', 'Kh'] },
    hiddenPlayerIds: ['Villain'],
  });
  replay.recordTransition({
    state,
    heroPlayerId: 'Hero',
    operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
  });
  return {
    pokerState: state,
    heroPlayerId: 'Hero',
    replaySource: replay.createCanonicalHandReplaySource(),
  };
}

async function activate(deviceHarness) {
  return deviceHarness.coordinator.activate({
    identityId: IDENTITY, authenticated: true, sessionValid: true,
  });
}

async function conflictFixture() {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'conflict-a', backend });
  const b = device({ label: 'conflict-b', backend });
  await activate(a);
  const created = await saveSpot(a, { id: 'shared-conflict-spot', title: 'Base' });
  await a.coordinator.enable();
  await a.coordinator.syncNow();
  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();
  const onA = await a.application.updateAnnotations(created.object.id, { note: 'Device A' });
  await a.coordinator.syncNow();
  const onB = await b.application.updateAnnotations(created.object.id, { note: 'Device B' });
  await b.coordinator.syncNow();
  return { a, b, created, onA, onB };
}

test('opt-in disabled performs zero remote work; enabling uploads existing local Saved objects by stable ID', async () => {
  const backend = createFakeRemoteSyncBackend();
  const first = device({ label: 'opt-in', backend });
  await activate(first);
  const saved = await saveSpot(first, { id: 'stable-saved-spot' });
  await first.coordinator.syncNow();
  assert.equal(first.remote.getCalls().length, 0);
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.DISABLED);

  const enabled = await first.coordinator.enable();
  assert.equal(enabled.itemCount, 1);
  await first.coordinator.syncNow();
  assert.equal(first.remote.get(IDENTITY, saved.object.id).object.id, saved.object.id);
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
  const pushes = first.remote.getCalls().filter((call) => call.method === 'push').length;
  await first.coordinator.syncNow();
  assert.equal(first.remote.getCalls().filter((call) => call.method === 'push').length, pushes);
});

test('second device pulls without duplicate creation and remote-only annotation edits reconcile', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'device-a', backend });
  const b = device({ label: 'device-b', backend });
  await activate(a);
  const saved = await saveSpot(a, { id: 'two-device-spot', title: 'Original' });
  await a.coordinator.enable();
  await a.coordinator.syncNow();

  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();
  assert.equal((await b.application.listAllForSync()).length, 1);
  assert.equal((await b.application.getById(saved.object.id)).annotations.title, 'Original');
  const edited = await b.application.updateAnnotations(saved.object.id, { note: 'Edited on B' });
  assert.equal(edited.object.revision, 2);
  await b.coordinator.syncNow();
  await a.coordinator.syncNow();
  assert.equal((await a.application.getById(saved.object.id)).annotations.note, 'Edited on B');
  assert.equal((await a.application.listAllForSync()).length, 1);
});

test('local writes succeed before transient remote failure; durable outbox resumes after coordinator reload', async () => {
  const backend = createFakeRemoteSyncBackend();
  const syncDatabase = createMemorySyncDatabase({ name: 'durable-outbox' });
  const first = device({ label: 'offline', backend, syncDatabase });
  await activate(first);
  await first.coordinator.enable();
  first.remote.failNext({ method: 'push', code: 'network_unavailable', kind: 'transient' });
  const local = await saveSpot(first, { id: 'offline-local-first' });
  assert.equal((await first.application.getById(local.object.id)).id, local.object.id);
  await first.coordinator.syncNow();
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.OFFLINE);
  assert.equal((await first.syncRepository.summary(IDENTITY)).pendingCount, 1);

  const resumedRepository = createSyncRepository({ database: syncDatabase });
  const resumed = createSyncCoordinator({
    repository: resumedRepository,
    remoteAdapter: first.remote,
    domainAdapter: createSavedStudySyncDomainAdapter({
      syncPort: {
        listAll: () => first.application.listAllForSync(),
        getById: (id) => first.application.getById(id),
        applyRemote: (object, options) => first.application.applySyncedObject(object, options),
        saveObject: (object) => first.application.applySyncedObject(object),
        activate: () => first.application.activate(),
      },
      clock: first.time.read,
    }),
    clock: first.time.read,
    scheduleTask: () => 1,
    cancelTask: () => {},
  });
  await resumed.activate({ identityId: IDENTITY, authenticated: true, sessionValid: true });
  await resumed.syncNow();
  assert.equal(first.remote.get(IDENTITY, local.object.id).object.id, local.object.id);
  assert.equal((await resumedRepository.summary(IDENTITY)).pendingCount, 0);
});

test('permanent pull errors remain visible across activation and clear after a successful retry', async () => {
  const backend = createFakeRemoteSyncBackend();
  const first = device({ label: 'persistent-pull-error', backend });
  await activate(first);
  await first.coordinator.enable();
  first.remote.failNext({
    method: 'pull', code: 'remote_schema_or_policy_error', kind: 'permanent',
  });
  await first.coordinator.syncNow();
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.ERROR);
  assert.equal((await first.syncRepository.summary(IDENTITY)).errorCount, 1);

  await activate(first);
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.ERROR);
  await first.coordinator.syncNow();
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
  assert.equal((await first.syncRepository.summary(IDENTITY)).errorCount, 0);
});

test('auth failure pauses, Guest and account switching do no cross-identity remote work', async () => {
  const backend = createFakeRemoteSyncBackend();
  const first = device({ label: 'auth-pause', backend });
  await activate(first);
  await first.coordinator.enable();
  first.remote.failNext({ method: 'push', code: 'session_expired', kind: 'auth' });
  await saveSpot(first, { id: 'auth-paused-spot' });
  await first.coordinator.syncNow();
  assert.equal(first.coordinator.getState().state, SYNC_UI_STATES.AUTH_PAUSED);
  const calls = first.remote.getCalls().length;
  await first.coordinator.activate({ identityId: null, authenticated: false, sessionValid: false });
  await first.coordinator.syncNow();
  assert.equal(first.remote.getCalls().length, calls);
  await first.coordinator.activate({ identityId: 'different-account', authenticated: true, sessionValid: true });
  await first.coordinator.syncNow();
  assert.equal(first.remote.getCalls().length, calls);
});

test('an in-flight pull cannot write into a newly active account identity', async () => {
  const seedBackend = createFakeRemoteSyncBackend();
  const seed = device({ label: 'cancel-seed', backend: seedBackend });
  const saved = await saveSpot(seed, { id: 'stale-async-remote' });
  const remoteRecord = {
    object: toRemoteSavedStudyObject(saved.object),
    serverUpdatedAt: '2026-08-17T12:10:00.000Z',
  };
  let release;
  const delayedRemote = {
    pushOperation: async () => { throw new Error('No push expected'); },
    pullChanges: () => new Promise((resolve) => { release = () => resolve({
      records: [remoteRecord], cursor: {
        serverUpdatedAt: remoteRecord.serverUpdatedAt, objectId: remoteRecord.object.id,
      }, hasMore: false,
    }); }),
  };
  const target = device({ label: 'cancel-target', backend: seedBackend, remote: delayedRemote });
  await activate(target);
  await target.coordinator.enable();
  const pending = target.coordinator.syncNow();
  while (!release) await new Promise((resolve) => setImmediate(resolve));
  await target.coordinator.activate({
    identityId: 'account-b', authenticated: true, sessionValid: true,
  });
  release();
  await pending;
  assert.equal((await target.application.listAllForSync()).length, 0);
});

test('both-changed conflict preserves versions and Keep device advances the remote revision', async () => {
  const { a, b, created } = await conflictFixture();
  assert.equal(b.coordinator.getState().state, SYNC_UI_STATES.CONFLICT);
  const [conflict] = await b.coordinator.listConflicts();
  assert.equal(conflict.localObject.annotations.note, 'Device B');
  assert.equal(conflict.remoteObject.annotations.note, 'Device A');
  await b.coordinator.resolveConflict(created.object.id, 'keep_device');
  await b.coordinator.syncNow();
  const remote = b.remote.get(IDENTITY, created.object.id).object;
  assert.equal(remote.annotations.note, 'Device B');
  assert.equal(remote.revision, 3);
  await a.coordinator.syncNow();
  assert.equal((await a.application.getById(created.object.id)).annotations.note, 'Device B');
});

test('Keep cloud and Keep both are explicit, lossless conflict resolutions', async () => {
  const cloudFixture = await conflictFixture();
  await cloudFixture.b.coordinator.resolveConflict(cloudFixture.created.object.id, 'keep_cloud');
  assert.equal(
    (await cloudFixture.b.application.getById(cloudFixture.created.object.id)).annotations.note,
    'Device A',
  );
  assert.equal((await cloudFixture.b.coordinator.listConflicts()).length, 0);

  const bothFixture = await conflictFixture();
  await bothFixture.b.coordinator.resolveConflict(bothFixture.created.object.id, 'keep_both');
  await bothFixture.b.coordinator.syncNow();
  const objects = await bothFixture.b.application.listAllForSync();
  const copy = objects.find((object) => object.id !== bothFixture.created.object.id);
  assert.equal(objects.length, 2);
  assert.equal(copy.annotations.note, 'Device B');
  assert.equal(copy.source.surface, 'conflict_copy');
  assert.equal(copy.source.parentObjectId, bothFixture.created.object.id);
  assert.equal(bothFixture.b.remote.get(IDENTITY, copy.id).object.id, copy.id);
});

test('archive tombstones propagate and a stale edited client cannot resurrect them', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'archive-a', backend });
  const b = device({ label: 'archive-b', backend });
  await activate(a);
  const saved = await saveSpot(a, { id: 'archive-shared' });
  await a.coordinator.enable();
  await a.coordinator.syncNow();
  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();
  await a.application.archive(saved.object.id);
  await a.coordinator.syncNow();
  await b.application.updateAnnotations(saved.object.id, { note: 'stale offline edit' });
  await b.coordinator.syncNow();
  assert.equal(b.coordinator.getState().state, SYNC_UI_STATES.CONFLICT);
  assert.equal(b.remote.get(IDENTITY, saved.object.id).object.lifecycle.state, 'archived');
  assert.equal((await b.coordinator.listConflicts())[0].remoteObject.lifecycle.state, 'archived');
});

test('cold remote Saved Hand reconstructs the canonical source and opens detached read-only Replay', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'hand-a', backend });
  const b = device({ label: 'hand-b', backend });
  await activate(a);
  const hand = await a.application.saveHand({
    ...savedHandInput(),
    operation: { id: 'cold-cloud-hand', createdAt: '2026-08-17T12:00:00.000Z' },
  });
  await a.coordinator.enable();
  await a.coordinator.syncNow();
  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();
  let openedInput = null;
  const opener = createSavedStudyObjectOpenController({
    application: b.application,
    playbookBridge: {
      openSavedHand(input) {
        openedInput = input;
        return Object.freeze({
          schemaVersion: 'replay-projection/v1',
          viewerContext: { kind: 'saved_hand' },
          readOnly: true,
        });
      },
    },
  });
  const opened = await opener.open(hand.object.id);
  assert.equal(opened.kind, 'hand');
  assert.equal(opened.projection.readOnly, true);
  assert.equal(openedInput.replaySource.schemaVersion, 'canonical-hand-replay-source/v1');
  assert.deepEqual(openedInput.replaySource, hand.object.payload.replaySource);
});

test('v2 Hand and standalone Spot sync opaquely to a fresh device with rules and tombstones intact', async () => {
  const backend = createFakeRemoteSyncBackend();
  const a = device({ label: 'rules-v2-a', backend });
  const b = device({ label: 'rules-v2-b', backend });
  await activate(a);

  const handInput = savedV2HandInput();
  const savedHand = await a.application.saveHand({
    ...handInput,
    operation: { id: 'synced-rules-v2-hand', createdAt: '2026-08-17T12:00:00.000Z' },
  });
  const scenarioInput = scenario();
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  }, 6);
  const savedSpot = await a.application.saveScenarioDerivedSpot({
    ...scenarioInput,
    rulesSnapshot,
    operation: { id: 'synced-rules-v2-spot', createdAt: '2026-08-17T12:00:00.000Z' },
  });

  await a.coordinator.enable();
  await a.coordinator.syncNow();
  assert.equal(
    a.remote.get(IDENTITY, savedHand.object.id).object.payload.schemaVersion,
    'saved-hand-snapshot/v2',
  );
  assert.equal(
    a.remote.get(IDENTITY, savedSpot.object.id).object.payload.schemaVersion,
    'saved-spot-snapshot/v2',
  );

  await activate(b);
  await b.coordinator.enable();
  await b.coordinator.syncNow();
  const coldHand = await b.application.getById(savedHand.object.id);
  const coldSpot = await b.application.getById(savedSpot.object.id);
  assert.deepEqual(coldHand.payload.pokerState.rulesSnapshot, handInput.pokerState.rulesSnapshot);
  assert.deepEqual(coldSpot.payload.rulesSnapshot, rulesSnapshot);
  const coldReplay = createReplayProjectionController();
  const projection = coldReplay.replaceFromCanonicalHandReplaySource(
    coldHand.payload.replaySource,
    { readOnly: true },
  );
  assert.equal(projection.mode, 'saved');
  assert.equal(
    projection.tablePresence.seats.find((seat) => seat.playerId === 'Villain').cardVisibility,
    'hidden',
  );

  await a.application.archive(savedSpot.object.id);
  await a.coordinator.syncNow();
  await b.coordinator.syncNow();
  assert.equal((await b.application.getById(savedSpot.object.id)).lifecycle.state, 'archived');
  assert.equal(b.coordinator.getState().conflictCount, 0);
});

test('import adopts locally, enqueues after commit, and export excludes sync internals', async () => {
  const backend = createFakeRemoteSyncBackend();
  const source = device({ label: 'import-source', backend });
  await activate(source);
  const original = await saveSpot(source, { id: 'imported-and-synced' });
  const portable = await source.application.exportLibrary();
  assert.doesNotMatch(JSON.stringify(portable), /outbox|sync-op|provider|session/i);

  const target = device({ label: 'import-target', backend });
  await activate(target);
  await target.coordinator.enable();
  const imported = await target.application.importLibrary(portable);
  assert.equal(imported.importedCount, 1);
  assert.equal(target.remote.get(IDENTITY, original.object.id), null);
  await target.coordinator.syncNow();
  assert.equal(target.remote.get(IDENTITY, original.object.id).object.id, original.object.id);
});

test('account sync UI is opt-in, localized, status-visible, and keyboard-conflict accessible', async () => {
  const [html, bootstrap, translations, css] = await Promise.all([
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/saved-study-sync-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/account-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="accountSyncEnable"[^>]+data-i18n="Enable sync"/);
  assert.match(html, /id="accountSyncNotNow"/);
  assert.match(html, /id="accountSyncToggle"[^>]+role="switch"/);
  assert.match(html, /id="accountMenuSyncStatus"[^>]+role="status"/);
  assert.match(html, /id="accountSyncNow"/);
  assert.match(html, /id="syncConflictModal"[^>]+role="dialog"[^>]+aria-modal="true"/);
  assert.match(html, /data-choice="keep_device"/);
  assert.match(html, /data-choice="keep_cloud"/);
  assert.match(html, /data-choice="keep_both"/);
  assert.match(bootstrap, /event\.key === 'Escape'/);
  assert.match(bootstrap, /event\.key !== 'Tab'/);
  assert.match(bootstrap, /riverline:identitychange|activateFromAuthentication/);
  for (const key of ['Sync now', 'Synced', 'Offline — will sync later', 'Keep both']) {
    assert.ok(translations.match(new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')).length >= 3);
  }
  assert.match(translations, /[\u0590-\u05ff]/u);
  assert.match(translations, /[\u0400-\u04ff]/u);
  assert.match(css, /\.account-sync-toggle input\[role="switch"\]/);
  assert.match(css, /\.account-sync-status\[data-sync-state="conflict"\]/);
});

test('remote documents exclude local ownership and SQL covers own-row RLS, tombstones, and versioned RPCs', async () => {
  const backend = createFakeRemoteSyncBackend();
  const first = device({ label: 'security', backend });
  await activate(first);
  const saved = await saveSpot(first, { id: 'remote-shape' });
  const remote = toRemoteSavedStudyObject(saved.object);
  assert.equal(Object.hasOwn(remote, 'ownerRef'), false);
  assert.doesNotMatch(JSON.stringify(remote), /token|password|providerSubject/i);

  const sql = await readFile(new URL(
    '../supabase/migrations/202608170002_saved_study_object_sync.sql', import.meta.url,
  ), 'utf8');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /saved_study_select_own/);
  assert.match(sql, /saved_study_insert_own/);
  assert.match(sql, /saved_study_update_own/);
  assert.match(sql, /owner_auth_user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /sync_saved_study_object_v1/);
  assert.match(sql, /pull_saved_study_objects_v1/);
  assert.match(sql, /p_expected_revision is null/i);
  assert.match(sql, /coalesce\(p_object ->> 'kind', ''\) not in \('hand', 'spot'\)/i);
  assert.doesNotMatch(sql, /service_role/i);
  assert.doesNotMatch(sql, /delete policy|for delete/i);
});
