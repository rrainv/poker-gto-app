import test from 'node:test';
import assert from 'node:assert/strict';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
// Uses real Saved objects/repositories and a scheduler that awaits each run.
import { createPlaybookScenarioInput } from '../app/src/application/playbook-state-source.mjs';
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
  wrapRepository = repository => repository,
} = {}) {
  const time = clock();
  const jobs = [];
  const scheduler = {
    schedule(callback, delay) { const job = { callback, delay, cancelled: false }; jobs.push(job); return job; },
    cancel(job) { job.cancelled = true; },
    async step() { while (jobs[0]?.cancelled) jobs.shift(); const job = jobs.shift(); if (!job) return false; time.advance(job.delay); await job.callback(); return true; },
    async drain() { for (let guard = 0; guard < 100; guard++) { if (!await this.step()) return; } throw new Error("Sync did not quiesce"); },
    pending() { return jobs.filter(job => !job.cancelled); },
  };
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
  const syncRepository = wrapRepository(createSyncRepository({ database: syncDatabase }));
  coordinator = createSyncCoordinator({
    repository: syncRepository,
    remoteAdapter: adapter,
    domainAdapter: createSavedStudySyncDomainAdapter({ syncPort: port, clock: time.read }),
    clock: time.read,
    idFactory: (prefix) => `${prefix}-${label}-${++ids}`,
    scheduleTask: (callback, delay) => scheduler.schedule(callback, delay),
    cancelTask: job => scheduler.cancel(job),
  });
  return { application, coordinator, remote: adapter, syncDatabase, syncRepository, time, scheduler };
}

async function saveSpot(deviceHarness, { id = null, title = null } = {}) {
  const input = scenario();
  return deviceHarness.application.saveScenarioDerivedSpot({
    ...input,
    title,
    operation: id ? { id, createdAt: '2026-08-17T12:00:00.000Z' } : null,
  });
}

async function activate(h) {
  await h.coordinator.activate({ identityId: IDENTITY, authenticated: true, sessionValid: true });
  await h.coordinator.enable();
}

for (const count of [0, 1, 24, 25, 26, 49, 50, 51, 76]) test(`executing scheduler uploads all ${count} Saved objects`, async () => {
  const h = device({ label: `upload-${count}`, backend: createFakeRemoteSyncBackend() });
  for (let i = 0; i < count; i++) await saveSpot(h);
  await activate(h);
  await h.scheduler.step();
  if (count > 25) {
    assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.SYNCING);
    assert.equal(h.remote.getCalls().filter(c => c.method === 'push').length, 25);
    assert.equal(h.scheduler.pending().length, 1);
  }
  await h.scheduler.drain();
  const calls = h.remote.getCalls().filter(c => c.method === 'push');
  assert.equal(calls.length, count);
  assert.equal(new Set(calls.map(c => c.operationId)).size, count);
  assert.equal(h.remote.backend.records.size, count);
  assert.equal(h.coordinator.getState().pendingCount, 0);
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
});

for (const count of [0, 1, 499, 500, 501, 999, 1000, 1001]) test(`executing scheduler downloads all ${count} Saved objects`, async () => {
  const h = device({ label: `download-${count}`, backend: createFakeRemoteSyncBackend() });
  const source = device({ label: 'seed', backend: createFakeRemoteSyncBackend() });
  const saved = await saveSpot(source);
  const base = toRemoteSavedStudyObject(saved.object);
  for (let i = 0; i < count; i++) h.remote.seed(IDENTITY, { ...base, id: `remote-${String(i).padStart(5, '0')}` });
  await activate(h);
  await h.scheduler.step();
  if (count >= 500) {
    assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.SYNCING);
    assert.equal((await h.application.listAllForSync()).length, 500);
  }
  await h.scheduler.drain();
  assert.equal((await h.application.listAllForSync()).length, count);
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
  assert.equal(h.remote.getCalls().filter(c => c.method === 'push').length, 0);
});

for (const transition of ['disable', 'guest', 'owner']) test(`pending continuation is fenced after ${transition}`, async () => {
  const h = device({ label: transition, backend: createFakeRemoteSyncBackend() });
  for (let i = 0; i < 26; i++) await saveSpot(h);
  await activate(h); await h.scheduler.step();
  const stale = h.scheduler.pending()[0];
  if (transition === 'disable') await h.coordinator.disable();
  else await h.coordinator.activate(transition === 'guest' ? {} : { identityId: 'another-owner', authenticated: true, sessionValid: true });
  const before = h.remote.getCalls().length;
  await stale.callback(); // Simulates cancellation racing with callback delivery.
  await h.scheduler.drain();
  assert.equal(h.remote.getCalls().length, before);
});

for (const method of ['push', 'pull']) test(`${method} transient failure retries through executing scheduler`, async () => {
  const h = device({ label: `retry-${method}`, backend: createFakeRemoteSyncBackend() });
  for (let i = 0; i < 26; i++) await saveSpot(h);
  await activate(h);
  h.remote.failNext({ method });
  await h.scheduler.step();
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.OFFLINE);
  assert.ok(h.scheduler.pending()[0].delay >= 1000);
  await h.scheduler.drain();
  assert.equal(h.remote.backend.records.size, 26);
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
});

test('permanent failing batch stops; explicit concurrent retry coalesces and continues', async () => {
  const h = device({ label: 'failure', backend: createFakeRemoteSyncBackend() });
  for (let i = 0; i < 51; i++) await saveSpot(h);
  await activate(h); await h.scheduler.step();
  h.remote.failNext({ method: 'push', kind: 'permanent' });
  await h.scheduler.step();
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.ERROR);
  assert.equal(h.scheduler.pending().length, 0);
  await Promise.all([h.coordinator.syncNow(), h.coordinator.syncNow()]);
  await h.scheduler.drain();
  assert.equal(h.remote.backend.records.size, 51);
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
  assert.equal(h.remote.getCalls().filter(c => c.method === 'push').length, 52);
});

test('remote hasMore without cursor progress fails instead of looping', async () => {
  const remote = createFakeRemoteSyncAdapter();
  const h = device({ label: 'cursor', remote: { ...remote, pullChanges: async () => ({ records: [], cursor: null, hasMore: true }) } });
  await activate(h); await h.scheduler.drain();
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.ERROR);
  assert.equal(h.scheduler.pending().length, 0);
});

test('a local edit during final status refresh survives its callback joining the active run', async () => {
  let arm = false, release, reached;
  const paused = new Promise(resolve => { reached = resolve; });
  const h = device({ label: 'late-edit', backend: createFakeRemoteSyncBackend(),
    wrapRepository: repository => ({ ...repository, async summary(...args) {
      if (arm) { arm = false; reached(); await new Promise(resolve => { release = resolve; }); }
      return repository.summary(...args);
    } }),
  });
  await activate(h); await h.scheduler.drain();
  arm = true;
  const active = h.coordinator.syncNow();
  await paused;
  await saveSpot(h);
  const joining = h.scheduler.step();
  release();
  await Promise.all([active, joining]);
  assert.equal(h.scheduler.pending().length, 1, 'a coalesced rerun survives status completion');
  await h.scheduler.drain();
  assert.equal(h.remote.backend.records.size, 1);
  assert.equal(h.coordinator.getState().state, SYNC_UI_STATES.SYNCED);
});

