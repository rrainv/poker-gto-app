import { createPersonalStrategySyncPort } from '../app/src/application/personal-strategy-sync-port.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/index.mjs';
import { createRiverlineIdentity, createRiverlineDomainOwnershipBinding } from '../app/src/account-identity/index.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { installSavedStudySyncBridge } from '../app/src/application/saved-study-sync-bootstrap.mjs';
import { createSyncCoordinator } from '../app/src/sync/coordinator.mjs';
import { createSyncRepository } from '../app/src/sync/repository.mjs';
import { createMemorySyncDatabase } from '../app/src/sync/indexeddb-storage.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function scope(identityId) {
  const controller = new AbortController();
  return {
    identityId, identityKind: 'authenticated_account', signal: controller.signal,
    isCurrent: () => !controller.signal.aborted,
    assertCurrent() { if (controller.signal.aborted) throw new Error('scope stale'); },
    revoke: () => controller.abort(),
  };
}
function fixture({ repositoryOverrides = {}, adapterOverrides = {}, remoteOverrides = {} } = {}) {
  const database = createMemorySyncDatabase();
  const repository = createSyncRepository({ database });
  const calls = [];
  const adapter = {
    domain: 'saved_study_objects', listLocalObjects: async () => [], serialize: (value) => value,
    applyRemote: async (value) => calls.push(['apply', value]),
    getLocalObject: async () => null, same: () => false,
    ...adapterOverrides,
  };
  const coordinator = createSyncCoordinator({
    repository: { ...repository, ...repositoryOverrides }, domainAdapter: adapter,
    remoteAdapter: {
      pushOperation: async () => { calls.push(['push']); return { status: 'acknowledged' }; },
      pullChanges: async () => { calls.push(['pull']); return { records: [], cursor: null, hasMore: false }; },
      ...remoteOverrides,
    },
    scheduleTask: () => ({}), cancelTask: () => {},
  });
  return { coordinator, database, repository, calls };
}
const account = (identityId, extra = {}) => ({ identityId, authenticated: true, sessionValid: true, ...extra });

test('Guest synchronously clears account cloud status and delayed preference cannot re-enable it', async () => {
  const pending = deferred();
  const f = fixture({ repositoryOverrides: { getPreference: () => pending.promise } });
  const activation = f.coordinator.activate(account('A'));
  const guest = f.coordinator.activate({});
  assert.equal(f.coordinator.getState().enabled, false);
  pending.resolve({ enabled: true, decided: true });
  await Promise.all([activation, guest]);
  await f.coordinator.syncNow();
  assert.equal(f.coordinator.getState().decided, false);
  assert.equal(f.coordinator.getState().syncedCount, 0);
  assert.deepEqual(f.calls, []);
});

test('late account summaries and conflict reads cannot populate Guest', async () => {
  const pending = deferred();
  const f = fixture({ repositoryOverrides: {
    getPreference: async () => ({ enabled: true, decided: true }),
    summary: () => pending.promise,
  } });
  const activation = f.coordinator.activate(account('A'));
  await Promise.resolve();
  await f.coordinator.activate({});
  pending.resolve({ pendingCount: 8, conflictCount: 4, errorCount: 2, syncedCount: 12 });
  await activation;
  assert.equal(f.coordinator.getState().pendingCount, 0);
  assert.equal(f.coordinator.getState().syncedCount, 0);
  assert.deepEqual(await f.coordinator.listConflicts(), []);
});

test('enable cannot enqueue old account objects after Guest or B activation', async () => {
  const pending = deferred();
  const f = fixture({ adapterOverrides: { listLocalObjects: () => pending.promise } });
  await f.coordinator.activate(account('A'));
  const enabling = f.coordinator.enable();
  await Promise.resolve();
  await Promise.resolve();
  await f.coordinator.activate({});
  await f.coordinator.activate(account('B'));
  pending.resolve([{ id: 'private-A' }]);
  await assert.rejects(enabling, /scope is stale/);
  assert.deepEqual(f.database.snapshot().operations, []);
  assert.equal(f.coordinator.getState().enabled, false);
  assert.equal((await f.repository.getPreference('A')).enabled, true);
  assert.equal((await f.repository.getPreference('B')).enabled, false);
});

test('in-flight pull cannot adopt remote rows or cursor after lifecycle revocation', async () => {
  const pending = deferred();
  const started = deferred();
  const f = fixture({ remoteOverrides: { pullChanges: async () => { started.resolve(); return pending.promise; } } });
  const owner = scope('A');
  await f.repository.setPreference('A', true, '2026-09-05T00:00:00.000Z');
  await f.coordinator.activate(account('A', { lifecycleScope: owner }));
  const running = f.coordinator.syncNow();
  await started.promise;
  owner.revoke();
  await f.coordinator.activate({});
  pending.resolve({ records: [{ object: { id: 'A-only' } }], cursor: { id: 'remote-A' }, hasMore: false });
  await running;
  assert.deepEqual(f.calls, []);
  assert.equal(await f.repository.getCursor('A'), null);
  assert.equal(f.coordinator.getState().enabled, false);
});

test('stale queued mutation cannot create an outbox operation for the next owner', async () => {
  const pending = deferred();
  const f = fixture({ repositoryOverrides: {
    getPreference: async () => ({ enabled: true, decided: true }), getRecord: () => pending.promise,
  } });
  await f.coordinator.activate(account('A'));
  const mutation = f.coordinator.recordLocalMutation({ id: 'A-only' });
  await f.coordinator.activate({});
  await f.coordinator.activate(account('B'));
  pending.resolve(null);
  assert.deepEqual(await mutation, { queued: false });
  assert.deepEqual(f.database.snapshot().operations, []);
});

test('in-flight sidecar transaction aborts without adopting cursor or changing account consent', async () => {
  const database = createMemorySyncDatabase();
  const pending = deferred();
  const started = deferred();
  const delayedDatabase = {
    ...database,
    runTransaction(stores, mode, operation, options) {
      return database.runTransaction(stores, mode, async (transaction) => {
        const result = await operation(transaction);
        started.resolve();
        await pending.promise;
        return result;
      }, options);
    },
  };
  const owner = scope('A');
  const repository = createSyncRepository({ database: delayedDatabase, lifecycleScope: owner });
  const cursor = repository.setCursor('A', { id: 'remote' });
  await started.promise;
  owner.revoke();
  pending.resolve();
  await assert.rejects(cursor, /scope is stale/);
  assert.deepEqual(database.snapshot().cursors, []);
});

test('browser sync bridge revokes both domains immediately on identity transition before auth cleanup', async () => {
  const saved = fixture();
  const strategy = fixture();
  await saved.repository.setPreference('A', true, '2026-09-05T00:00:00.000Z');
  await strategy.repository.setPreference('A', true, '2026-09-05T00:00:00.000Z');
  const identityListeners = new Set();
  const authListeners = new Set();
  let authState = Object.freeze({ status: 'signed_in', profile: { riverlineIdentityId: 'A' } });
  let lifecycleStatus = 'account_active';
  const owner = scope('A');
  const boundScopes = [];
  const browser = new EventTarget();
  browser.document = { readyState: 'loading', addEventListener() {} };
  browser.RiverlineAuthentication = {
    ready: async () => authState, getState: () => authState,
    subscribe(listener) { authListeners.add(listener); },
  };
  browser.RiverlineAccountIdentity = {
    captureLifecycleScope: async () => owner,
    getLifecycleState: () => ({ status: lifecycleStatus }),
    subscribe(listener) { identityListeners.add(listener); },
  };
  browser.RiverlineSavedStudyObjects = {
    subscribeLocalMutations() {},
    createSyncPort(capturedScope) {
      boundScopes.push(capturedScope);
      return { listAll: async () => [], getById: async () => null,
        applyRemote: async () => {}, activate: async () => ({ ownerRef: {} }) };
    },
  };
  const strategyPort = {
    listEntities: async () => [], getEntityById: async () => null,
    applyRemoteEntity: async () => {}, ownerRef: async () => ({}), getSummary: async () => ({}),
  };
  await installSavedStudySyncBridge(browser, {
    config: {}, remoteAdapter: {}, database: saved.database,
    coordinator: saved.coordinator, strategyCoordinator: strategy.coordinator, strategyPort,
  });
  assert.equal(saved.coordinator.getState().enabled, true);
  assert.equal(strategy.coordinator.getState().enabled, true);
  assert.equal(boundScopes.at(-1), owner);
  owner.revoke();
  lifecycleStatus = 'transitioning';
  identityListeners.forEach((listener) => listener({ lifecycle: { status: lifecycleStatus } }));
  assert.equal(authState.status, 'signed_in', 'provider cleanup has not occurred yet');
  assert.equal(saved.coordinator.getState().enabled, false);
  assert.equal(strategy.coordinator.getState().enabled, false);
  authState = Object.freeze({ status: 'guest', profile: null });
  authListeners.forEach((listener) => listener(authState));
  await browser.RiverlineStudySync.syncNow();
  assert.deepEqual(saved.calls, []);
  assert.deepEqual(strategy.calls, []);
  assert.equal((await saved.repository.getPreference('A')).enabled, true);
  assert.equal((await strategy.repository.getPreference('A')).enabled, true);
});

test('Device Guest lifecycle scope cannot authorize remote work even with stale account flags', async () => {
  const f = fixture();
  const guestScope = { ...scope('Guest'), identityKind: 'device_guest' };
  await f.repository.setPreference('Guest', true, '2026-09-05T00:00:00.000Z');
  await f.coordinator.activate(account('Guest', { lifecycleScope: guestScope }));
  await f.coordinator.syncNow();
  assert.equal(f.coordinator.getState().enabled, false);
  assert.equal(f.coordinator.getState().decided, false);
  assert.deepEqual(f.calls, []);
  await assert.rejects(f.coordinator.enable(), /authenticated session/);
});

test('cached Personal Strategy sync port rejects its old lifecycle scope before repository reuse', async () => {
  const owner = scope('A');
  const identity = createRiverlineIdentity({ identityId: 'A', kind: 'authenticated_account',
    displayName: 'A', localDeviceIdentityId: 'device', createdAt: '2026-09-05T00:00:00.000Z' });
  owner.lifecycleGeneration = 1;
  owner.domainOwnerBinding = createRiverlineDomainOwnershipBinding({ identity,
    domain: 'personal_strategy', domainOwnerId: 'A-native', storageScope: 'A-storage',
    provenance: 'identity_initialized', createdAt: '2026-09-05T00:00:00.000Z' });
  let authState = { status: 'signed_in', profile: { riverlineIdentityId: 'A' } };
  let opened = 0;
  const port = createPersonalStrategySyncPort({ lifecycleScope: owner,
    authentication: { ready: async () => authState, getState: () => authState },
    databaseFactory() { opened += 1; return createMemoryPersonalStrategyDatabase(); },
  });
  await port.getSummary();
  assert.equal(opened, 1);
  owner.revoke();
  authState = { status: 'guest', profile: null };
  await assert.rejects(port.getSummary(), /scope stale/);
  authState = { status: 'signed_in', profile: { riverlineIdentityId: 'B' } };
  await assert.rejects(port.listEntities(), /scope stale/);
  await assert.rejects(port.ownerRef(), /scope stale/);
  assert.equal(opened, 1);
});
