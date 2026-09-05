import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { bindSyncUi, createStudySyncAggregate, PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE } from '../app/src/application/saved-study-sync-bootstrap.mjs';
import {
  createLocalOwnerRef, migrateStrategyProfile, migrateStrategyMode,
  createMemoryPersonalStrategyDatabase,
} from '../app/src/personal-strategy/index.mjs';
import { createPersonalStrategySyncPort } from '../app/src/application/personal-strategy-sync-port.mjs';
import { createRiverlineIdentity, createRiverlineDomainOwnershipBinding } from '../app/src/account-identity/index.mjs';
import {
  PERSONAL_STRATEGY_SYNC_DOMAIN, createPersonalStrategySyncAdapter,
  createPersonalStrategyProfileBundle, toRemotePersonalStrategyEntity,
  validateRemotePersonalStrategyEntity, createSyncCoordinator,
  createMemorySyncDatabase, createSyncRepository, createSyncOperation,
} from '../app/src/sync/index.mjs';

const now = '2026-09-05T00:00:00.000Z';
const identityId = 'intelligence-sync-owner';
const ownerRef = createLocalOwnerRef(identityId);
function legacyBundle() {
  const profile = { schemaVersion: 'strategy-profile/v1', id: 'setup', ownerRef,
    displayName: 'Home', description: null, createdAt: now, updatedAt: now,
    gameDomain: 'no_limit_texas_holdem', tags: [], modeIds: ['a', 'b', 'c'], state: 'active' };
  const modes = profile.modeIds.map((id, displayOrder) => ({ schemaVersion: 'strategy-mode/v1',
    id, profileId: profile.id, displayName: id, description: null, createdAt: now,
    updatedAt: now, displayOrder, state: 'active' }));
  return createPersonalStrategyProfileBundle(profile, modes);
}
function migratedBundle() {
  const legacy = legacyBundle();
  return createPersonalStrategyProfileBundle(migrateStrategyProfile(legacy.profile), legacy.modes.map(migrateStrategyMode));
}
const unsupported = (error) => error.code === 'unsupported_schema'
  && error.reason === 'personal_strategy_remote_upgrade_required' && error.kind === 'permanent';
function harness(initial = [], { beforePreflight = async () => {} } = {}) {
  let objects = initial;
  const applied = [];
  const calls = [];
  const adapter = createPersonalStrategySyncAdapter({ syncPort: {
    listEntities: async () => objects,
    getEntityById: async (id) => objects.find((value) => value.id === id),
    ownerRef: async () => ownerRef,
    applyRemoteEntity: async (...args) => applied.push(args),
  } });
  const repository = createSyncRepository({ database: createMemorySyncDatabase(), domain: PERSONAL_STRATEGY_SYNC_DOMAIN });
  const coordinator = createSyncCoordinator({ repository, domainAdapter: { ...adapter,
    async preflight() { await beforePreflight(); return adapter.preflight(); } },
    remoteAdapter: { pushOperation: async () => calls.push('push'), pullChanges: async () => {
      calls.push('pull'); return { records: [], cursor: null, hasMore: false };
    } }, clock: () => new Date(now), scheduleTask: () => 1, cancelTask: () => {} });
  return { adapter, repository, coordinator, applied, calls, migrate: () => { objects = [migratedBundle()]; } };
}
const activate = (h) => h.coordinator.activate({ identityId, authenticated: true, sessionValid: true });

test('remote v1 stays readable without rebranding v2 metadata or qualitative intent as v1', () => {
  const legacy = toRemotePersonalStrategyEntity(legacyBundle());
  assert.equal(validateRemotePersonalStrategyEntity(legacy), legacy);
  assert.equal(legacy.entitySchemaVersion, 'strategy-profile/v1');
  assert.throws(() => toRemotePersonalStrategyEntity(migratedBundle()), unsupported);
  assert.throws(() => toRemotePersonalStrategyEntity({ schemaVersion: 'qualitative-strategy-evidence/v1', id: 'q' }), unsupported);
  const mislabeled = structuredClone(legacy);
  mislabeled.payload.profile = { ...mislabeled.payload.profile, schemaVersion: 'strategy-profile/v2' };
  assert.throws(() => validateRemotePersonalStrategyEntity(mislabeled), unsupported);
});

test('already queued v1 metadata cannot upload after migration; queue and source remain intact', async () => {
  const h = harness([legacyBundle()]);
  const document = toRemotePersonalStrategyEntity(legacyBundle());
  const operation = createSyncOperation({ operationId: 'queued-before-migration', identityId,
    object: document, createdAt: now, domain: PERSONAL_STRATEGY_SYNC_DOMAIN,
    kind: 'upsert_profile_bundle', validateObject: validateRemotePersonalStrategyEntity });
  await h.repository.enqueue(operation);
  await h.repository.setPreference(identityId, true, now);
  const before = await h.repository.listDueOperations(identityId, now, 25, true);
  h.migrate();
  assert.equal((await activate(h)).state, 'error');
  assert.equal((await h.coordinator.syncNow()).state, 'error');
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.applied, []);
  assert.deepEqual(await h.repository.listDueOperations(identityId, now, 25, true), before);
  assert.equal((await h.repository.getRecord(identityId, '__domain__')).lastErrorCode, 'unsupported_schema');
  assert.equal((await h.repository.summary(identityId)).pendingCount, 1);
  h.coordinator.close();
});

test('enable and remote conflict application fail explicitly for migrated local data', async () => {
  const h = harness([migratedBundle()]);
  await activate(h);
  await assert.rejects(h.coordinator.enable(), unsupported);
  assert.equal(h.coordinator.getState().state, 'error');
  await assert.rejects(h.adapter.applyRemote(toRemotePersonalStrategyEntity(legacyBundle())), unsupported);
  await assert.rejects(h.adapter.prepareLocalWinner(legacyBundle(), toRemotePersonalStrategyEntity(legacyBundle())), unsupported);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.applied, []);
  assert.equal((await h.repository.summary(identityId)).pendingCount, 0);
  h.coordinator.close();
});

test('canonical port rejects even an empty migrated store, then rechecks owner revocation', async () => {
  let current = true;
  const identity = createRiverlineIdentity({ identityId, kind: 'authenticated_account',
    displayName: 'Owner', localDeviceIdentityId: 'device', createdAt: now });
  const scope = { identityId, identityKind: 'authenticated_account', lifecycleGeneration: 1,
    isCurrent: () => current, assertCurrent() { if (!current) throw new Error('scope stale'); },
    domainOwnerBinding: createRiverlineDomainOwnershipBinding({ identity, domain: 'personal_strategy',
      domainOwnerId: identityId, storageScope: 'intelligence-sync', provenance: 'identity_initialized', createdAt: now }) };
  const auth = { status: 'signed_in', profile: { riverlineIdentityId: identityId } };
  const port = createPersonalStrategySyncPort({ lifecycleScope: scope,
    authentication: { ready: async () => auth, getState: () => auth },
    databaseFactory: () => createMemoryPersonalStrategyDatabase() });
  await assert.rejects(port.assertCompatible(), unsupported);
  assert.equal((await port.listEntities()).length, 0);
  current = false;
  await assert.rejects(port.assertCompatible(), /scope stale/);
  await port.close();
});

test('revocation while compatibility preflight awaits prevents remote calls and stale status', async () => {
  let wait = false;
  let release;
  let entered;
  const gate = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { entered = resolve; });
  const h = harness([], { beforePreflight: async () => {
    if (wait) { entered(); await gate; }
  } });
  await h.repository.setPreference(identityId, true, now);
  await activate(h);
  wait = true;
  const pending = h.coordinator.syncNow();
  await started;
  await h.coordinator.activate({ identityId: null, authenticated: false, sessionValid: false });
  release();
  await pending;
  assert.deepEqual(h.calls, []);
  assert.equal(h.coordinator.getState().enabled, false);
  assert.equal((await h.repository.summary(identityId)).errorCount, 0);
  h.coordinator.close();
});

test('account summary identifies the remote upgrade requirement through the canonical port', async () => {
  const disabled = { state: 'disabled', enabled: false, decided: false, pendingCount: 0, conflictCount: 0, errorCount: 0 };
  const coordinator = { getState: () => disabled, subscribe() {}, getEnableSummary: async () => ({ itemCount: 0 }) };
  const aggregate = createStudySyncAggregate(coordinator, coordinator, {
    getSummary: async () => ({ profileCount: 2 }),
    assertCompatible: async () => { throw Object.assign(new Error('upgrade'), { code: 'unsupported_schema' }); },
  });
  assert.deepEqual(await aggregate.getStrategyEnableSummary(), { profileCount: 2, cloudSyncCompatible: false });
});

test('account UI explains local-only strategy, blocks incompatible enable, and catches rejected enable', async () => {
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, { hidden: false, dataset: {}, textContent: '', disabled: false,
      listeners: new Map(), classList: { toggle() {}, remove() {} },
      addEventListener(type, listener) { this.listeners.set(type, listener); },
      querySelector: (child) => node(`${selector} ${child}`), querySelectorAll: () => [],
    });
    return nodes.get(selector);
  }
  const document = { querySelector: node, querySelectorAll: () => [], addEventListener() {} };
  const browserWindow = { document, addEventListener() {}, dispatchEvent() {},
    RiverlineAuthentication: { getState: () => ({ status: 'signed_in', profile: { riverlineIdentityId: identityId } }) } };
  const base = { state: 'disabled', enabled: false, decided: true, pendingCount: 0, conflictCount: 0, errorCount: 0 };
  const state = { ...base, state: 'error', enabled: true, saved: base,
    strategy: { ...base, state: 'error', enabled: true, errorCount: 1 } };
  let rejectedEnable = 0;
  const coordinator = { getState: () => state, subscribe() {},
    getEnableSummary: async () => ({ itemCount: 0 }),
    getStrategyEnableSummary: async () => ({ cloudSyncCompatible: false, profileCount: 1 }),
    enableStrategy: async () => { rejectedEnable += 1; throw Object.assign(new Error('upgrade'), { code: 'unsupported_schema' }); },
  };
  bindSyncUi(browserWindow, coordinator);
  await new Promise(setImmediate);
  assert.equal(node('#accountStrategySyncConsequence').textContent, PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE);
  assert.equal(node('#accountStrategySyncItemSummary').textContent, PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE);
  assert.equal(node('#accountSyncStatus span').textContent, PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE);
  assert.equal(node('#accountStrategySyncEnable').disabled, true);
  assert.equal(node('#accountStrategySyncToggle').disabled, false, 'an existing preference can still be disabled');
  node('#accountStrategySyncEnable').listeners.get('click')();
  await new Promise(setImmediate);
  assert.equal(rejectedEnable, 1);
  assert.equal(node('#accountSyncStatus span').textContent, PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE);
});

test('upgrade-required copy is registered in English, Russian, and Hebrew', async () => {
  const context = { window: {} };
  runInNewContext(await readFile(new URL('../app/src/locales/account-translations.js', import.meta.url), 'utf8'), context);
  const translations = context.window.riverlineAccountTranslations;
  assert.equal(translations.en[PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE], PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE);
  assert.match(translations.ru[PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE], /совместимая версия сервера/);
  assert.match(translations.he[PERSONAL_STRATEGY_SYNC_UPGRADE_MESSAGE], /גרסת שרת תואמת/);
});
