import { initializeHand, applyChance, GAME_MODES, ANTE_TYPES, CHANCE_TYPES } from '../shared/poker-domain/index.js';
import { createReplayProjectionController, REPLAY_FRAME_OPERATIONS } from '../app/src/application/replay-projection-controller.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccountIdentityRepository, createMemoryAccountIdentityDatabase,
  RIVERLINE_ACCOUNT_OBJECT_STORES as STORES, RIVERLINE_OWNED_DOMAINS as DOMAINS,
  rebindRiverlineDomainOwnershipBinding, transitionRiverlineIdentityKind, scopedPreferenceKey,
} from '../app/src/account-identity/index.mjs';
import { createAccountIdentityService } from '../app/src/application/account-identity-service.mjs';
import { createAuthProviderIdentity } from '../app/src/authentication/index.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { installSavedStudyObjectBridge } from '../app/src/application/saved-study-object-bootstrap.mjs';
import { installHomeWorkspaceBridge } from '../app/src/application/home-workspace-bootstrap.mjs';
import { createPersonalStrategyHomeQuery } from '../app/src/application/personal-strategy-home-query.mjs';
import { createSavedStudyObjectOpenController } from '../app/src/application/saved-study-object-open-controller.mjs';
import { createPlaybookScenarioInput, deriveDecisionContextFromPlaybookScenario } from '../app/src/application/playbook-state-source.mjs';
import { createMemorySavedStudyDatabase, createSavedStudyOwnerRef } from '../app/src/saved-study-objects/index.mjs';
import { createPersonalStrategyRepository, createMemoryPersonalStrategyDatabase, createLocalOwnerRef, updateStrategyProfile } from '../app/src/personal-strategy/index.mjs';
import { createTrainingMemoryOwnerResolver, createTrainingMemoryService } from '../app/src/application/training-memory-service.mjs';
import { createMemoryTrainingMemoryDatabase } from '../app/src/training-memory/indexeddb-storage.mjs';
import { trainingMemoryOwnerKey } from '../app/src/training-memory/domain.mjs';
import { RANGE_CALIBRATION_PREFERENCES_KEY } from '../app/src/application/range-calibration-service.mjs';
import { createPreAccountPersonalStrategyFixture } from './fixtures/account001_legacy.mjs';

const NOW = '2026-09-05T12:00:00.000Z';
const ids = (label) => { let n = 0; return (prefix) => `${prefix}-${label}-${++n}`; };
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
};
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function gateDatabase(backing) {
  let pending = null;
  return {
    ...backing, close: async () => {},
    delayNext(mode) {
      const entered = deferred();
      const release = deferred();
      pending = { mode, entered, release };
      return { entered: entered.promise, release: release.resolve };
    },
    runTransaction(stores, mode, operation, options) {
      const gate = pending?.mode === mode ? pending : null;
      if (gate) pending = null;
      return backing.runTransaction(stores, mode, async (transaction) => {
        const result = await operation(transaction);
        if (gate) { gate.entered.resolve(); await gate.release.promise; }
        return result;
      }, options);
    },
  };
}
function scenario() {
  const scenarioInput = createPlaybookScenarioInput({
    tableSize: 6, heroPosition: 'BTN', street: 'flop', heroCards: ['As', 'Kh'],
    board: ['Qc', '7d', '2s'], deadCards: [], stackBb: 100, stackMode: 'hero',
    potBb: 6.5, lastAction: 'check', lastActionLabel: 'Checked to Hero', facingSizeBb: 0,
    rakeMode: 'off', forcedContributionPerPlayerBb: 0, totalForcedContributionBb: 0, anteBb: 0, straddleBb: 0,
  });
  return { scenarioInput, decisionContext: deriveDecisionContextFromPlaybookScenario(scenarioInput) };
}
function accountFixture(database = createMemoryAccountIdentityDatabase()) {
  const repository = createAccountIdentityRepository({ database, clock: () => NOW, idFactory: ids('identity') });
  return { database, repository, account: createAccountIdentityService({ repository }) };
}
async function fixture() {
  const identity = accountFixture();
  const initial = await identity.account.initialize();
  let authState = Object.freeze({ status: 'guest', profile: null });
  const authListeners = new Set();
  const authentication = {
    ready: async () => authState, getState: () => authState,
    subscribe(listener) { authListeners.add(listener); return () => authListeners.delete(listener); },
  };
  const publishAuth = (identityId = null) => {
    authState = Object.freeze(identityId ? { status: 'signed_in', profile: { riverlineIdentityId: identityId } }
      : { status: 'guest', profile: null });
    authListeners.forEach((listener) => listener(authState));
  };
  const domainDatabases = new Map();
  function databaseFor(binding) {
    const key = `${binding.domain}:${binding.storageScope}`;
    if (!domainDatabases.has(key)) {
      domainDatabases.set(key, gateDatabase(binding.domain === DOMAINS.SAVED_STUDY_OBJECTS
        ? createMemorySavedStudyDatabase({ name: key }) : createMemoryPersonalStrategyDatabase({ name: key })));
    }
    return domainDatabases.get(key);
  }
  const localStorage = storage();
  const browser = { localStorage };
  const saved = installSavedStudyObjectBridge(browser, { accountIdentity: identity.account,
    storage: localStorage, databaseResolver: databaseFor });
  const personalHome = createPersonalStrategyHomeQuery({ storage: localStorage,
    lifecycleScopeResolver: () => identity.account.captureLifecycleScope(DOMAINS.PERSONAL_STRATEGY),
    databaseResolver: databaseFor, clock: () => NOW });
  const home = installHomeWorkspaceBridge(browser, { accountQueries: identity.account, authentication,
    savedStudyQueries: saved, personalStrategyQueries: personalHome,
    playbookBridge: { openSavedHand() {} }, syncQueries: { getState() {
      assert.equal(authState.status, 'signed_in', 'Guest cloud query forbidden');
      return { state: 'saved_locally', enabled: false };
    } } });
  const memoryDatabase = gateDatabase(createMemoryTrainingMemoryDatabase());
  const memory = createTrainingMemoryService({
    ownerProvider: createTrainingMemoryOwnerResolver({ authentication, identityProvider: identity.account }),
    database: memoryDatabase, clock: () => NOW, idFactory: ids('memory'),
  });
  async function savedApplication() {
    const scope = await identity.account.captureLifecycleScope(DOMAINS.SAVED_STUDY_OBJECTS);
    return { scope, database: databaseFor(scope.domainOwnerBinding), application: createSavedStudyObjectApplication({
      lifecycleScope: scope, ownerRef: createSavedStudyOwnerRef(scope.domainOwnerBinding.domainOwnerId),
      database: databaseFor(scope.domainOwnerBinding), clock: () => NOW, idFactory: ids(scope.identityId),
    }) };
  }
  async function personalRepository() {
    const scope = await identity.account.captureLifecycleScope(DOMAINS.PERSONAL_STRATEGY);
    return { scope, database: databaseFor(scope.domainOwnerBinding), repository: createPersonalStrategyRepository({
      lifecycleScope: scope, ownerRef: createLocalOwnerRef(scope.domainOwnerBinding.domainOwnerId),
      database: databaseFor(scope.domainOwnerBinding), legacyStorage: storage(), clock: () => NOW,
    }) };
  }
  async function signIn(label) {
    const provider = createAuthProviderIdentity({ provider: 'fake', providerSubject: label,
      email: `${label}@example.com`, authenticatedAt: NOW });
    await identity.account.startProviderIdentitySeparately(provider, { riverlineIdentityId: label, displayName: label });
    publishAuth(label);
  }
  async function guest() {
    const transition = identity.account.activateDeviceGuest();
    publishAuth();
    await transition;
  }
  async function seed(label) {
    const savedContext = await savedApplication();
    const savedResult = await savedContext.application.saveScenarioDerivedSpot({ ...scenario(),
      title: label, note: `${label} note`, reviewState: 'review_later' });
    const personalContext = await personalRepository();
    const personal = createPreAccountPersonalStrategyFixture({
      ownerId: personalContext.scope.domainOwnerBinding.domainOwnerId, suffix: label,
    });
    await personalContext.repository.saveProfileBundle(personal.bundle);
    await personalContext.repository.saveCalibrationSession(personal.initialSession);
    await personalContext.repository.saveCalibrationAnswer({ observation: personal.direct,
      session: personal.session, expectedSessionUpdatedAt: personal.initialSession.updatedAt });
    await personalContext.repository.saveTrainingObservation(personal.training);
    localStorage.setItem(scopedPreferenceKey(RANGE_CALIBRATION_PREFERENCES_KEY, personalContext.scope.domainOwnerBinding),
      JSON.stringify({ selectedProfileId: personal.bundle.profile.id, byProfile: {
        [personal.bundle.profile.id]: { activeModeId: personal.bundle.modes[0].id,
          context: { environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 } },
      } }));
    const session = await memory.startSession({ mode: 'focused', requestedLength: 1 });
    await memory.finishSession(session.id);
    return { saved: savedResult.object, personal, session, savedContext, personalContext };
  }
  return { ...identity, initial, authentication, publishAuth, signIn, guest, seed,
    saved, home, memory, memoryDatabase, savedApplication, personalRepository, databaseFor, personalHome, localStorage };
}

async function assertOwner(f, expected) {
  assert.deepEqual((await f.saved.listRecent()).map((item) => item.id), [expected.saved.id]);
  const personal = await f.personalRepository();
  const snapshot = await personal.repository.loadSnapshot();
  assert.deepEqual(snapshot.profiles.map((item) => item.id), [expected.personal.bundle.profile.id]);
  assert.deepEqual(snapshot.rangeObservations, [expected.personal.direct]);
  assert.deepEqual(snapshot.trainingObservations, [expected.personal.training]);
  assert.deepEqual(snapshot.calibrationSessions, [expected.personal.session]);
  assert.deepEqual((await f.memory.listRecentSessions()).map((item) => item.session.id), [expected.session.id]);
  const home = await f.home.load();
  assert.deepEqual(home.sections.recent.items.map((item) => item.id), [expected.saved.id]);
  assert.equal(home.sections.personalStrategy.selectedProfile.id, expected.personal.bundle.profile.id);
  if ((await f.account.getActiveIdentity()).kind === 'device_guest') {
    assert.equal(home.sessionMode, 'guest');
    assert.equal(home.identity.profile, null);
    assert.equal(home.sync.state, 'unavailable');
  }
}

test('real lifecycle Guest -> A -> Guest -> B -> Guest preserves isolated Saved, Personal Strategy, Memory and Home', async () => {
  const f = await fixture();
  const guest = await f.seed('guest');
  await assertOwner(f, guest);
  await f.signIn('A');
  assert.deepEqual(await f.saved.listRecent(), []);
  assert.deepEqual(await f.memory.listRecentSessions(), []);
  const a = await f.seed('A');
  await assertOwner(f, a);
  assert.equal(await f.saved.getById(guest.saved.id), null);
  await f.guest();
  await assertOwner(f, guest);
  assert.equal(await f.saved.getById(a.saved.id), null);
  await f.signIn('B');
  assert.deepEqual(await f.saved.listRecent(), []);
  const b = await f.seed('B');
  await assertOwner(f, b);
  assert.equal(await f.saved.getById(a.saved.id), null);
  await f.guest();
  await assertOwner(f, guest);
  assert.equal((await f.account.getActiveIdentity()).identityId, f.initial.metadata.deviceGuestIdentityId);
  const reload = accountFixture(f.database);
  await reload.account.initialize();
  assert.equal((await reload.account.getActiveIdentity()).identityId, f.initial.metadata.deviceGuestIdentityId);
  const scope = await reload.account.captureLifecycleScope(DOMAINS.TRAINING_MEMORY);
  assert.equal(trainingMemoryOwnerKey(scope.domainOwnerBinding.domainOwnerRef), trainingMemoryOwnerKey(guest.session.ownerRef));
  const reloadedSaved = installSavedStudyObjectBridge({ localStorage: f.localStorage }, {
    accountIdentity: reload.account, databaseResolver: f.databaseFor,
  });
  assert.deepEqual((await reloadedSaved.listRecent()).map((item) => item.id), [guest.saved.id]);
  const personalScope = await reload.account.captureLifecycleScope(DOMAINS.PERSONAL_STRATEGY);
  const reloadedPersonal = createPersonalStrategyRepository({ lifecycleScope: personalScope,
    ownerRef: createLocalOwnerRef(personalScope.domainOwnerBinding.domainOwnerId),
    database: f.databaseFor(personalScope.domainOwnerBinding), legacyStorage: storage() });
  assert.deepEqual((await reloadedPersonal.loadSnapshot()).rangeObservations, [guest.personal.direct]);
  const reloadedMemory = createTrainingMemoryService({ database: f.memoryDatabase,
    ownerProvider: createTrainingMemoryOwnerResolver({ authentication: f.authentication, identityProvider: reload.account }) });
  assert.deepEqual((await reloadedMemory.listRecentSessions()).map((item) => item.session.id), [guest.session.id]);
});

test('Guest Saved annotate, archive, export/import and reopen preserve existing local semantics', async () => {
  const f = await fixture();
  const context = await f.savedApplication();
  const created = (await context.application.saveScenarioDerivedSpot({ ...scenario(), title: 'Guest spot' })).object;
  await context.application.updateAnnotations(created.id, { note: 'Local note', reviewState: 'review_later' });
  assert.equal((await f.saved.getById(created.id)).annotations.note, 'Local note');
  const opener = createSavedStudyObjectOpenController({ application: f.saved, playbookBridge: { openSavedHand() {} } });
  assert.equal((await opener.open(created.id)).kind, 'spot');
  const portable = await f.saved.exportLibrary();
  await f.saved.importLibrary(portable);
  assert.equal((await f.saved.listRecent()).length, 1);
  await context.application.archive(created.id);
  assert.deepEqual(await f.saved.listRecent(), []);
  await assert.rejects(opener.open(created.id), /unavailable/);
  assert.equal((await f.saved.exportLibrary()).objects[0].lifecycle.state, 'archived');
});

for (const domain of ['Saved', 'Personal Strategy']) {
  test(`${domain} delayed write/read and cached repository reject revoked real lifecycle scope`, async () => {
    const f = await fixture();
    const owner = await f.seed('guest');
    const context = domain === 'Saved' ? owner.savedContext : owner.personalContext;
    const read = () => domain === 'Saved' ? context.application.listRecent() : context.repository.loadSnapshot();
    const write = () => domain === 'Saved'
      ? context.application.updateAnnotations(owner.saved.id, { note: 'must not commit' })
      : context.repository.saveProfile(updateStrategyProfile(owner.personal.bundle.profile, { displayName: 'must not commit' }, NOW));
    await read();
    const delayedRead = context.database.delayNext('readonly');
    const reading = read();
    await delayedRead.entered;
    const delayedWrite = context.database.delayNext('readwrite');
    const writing = write();
    await delayedWrite.entered;
    await f.signIn('A');
    assert.equal(context.scope.isCurrent(), false);
    delayedRead.release();
    delayedWrite.release();
    await assert.rejects(reading);
    await assert.rejects(writing);
    await assert.rejects(read());
    await assert.rejects(write());
    await f.guest();
    await assertOwner(f, owner);
    if (domain === 'Saved') assert.equal((await f.saved.getById(owner.saved.id)).annotations.note, 'guest note');
    else assert.equal((await (await f.personalRepository()).repository.loadSnapshot()).profiles[0].displayName,
      owner.personal.bundle.profile.displayName);
  });
}

test('late Home and Training Memory reads from A cannot adopt after Guest transition', async () => {
  const f = await fixture();
  const guest = await f.seed('guest');
  await f.signIn('A');
  const a = await f.seed('A');
  const delayedHome = a.savedContext.database.delayNext('readonly');
  const home = f.home.load();
  await delayedHome.entered;
  const delayedMemory = f.memoryDatabase.delayNext('readonly');
  const memory = f.memory.listRecentSessions();
  await delayedMemory.entered;
  const staleScope = await f.account.captureLifecycleScope();
  let visible = 'A';
  f.account.subscribe(() => { visible = null; });
  const transition = f.account.activateDeviceGuest();
  assert.equal(visible, null);
  assert.equal(staleScope.adopt(() => { visible = 'late A'; }), false);
  f.publishAuth();
  await transition;
  delayedHome.release();
  delayedMemory.release();
  await assert.rejects(home);
  await assert.rejects(memory);
  await assertOwner(f, guest);
});

test('Training Memory in-flight session write aborts before commit on real lifecycle transition', async () => {
  const f = await fixture();
  await f.memory.listRecentSessions();
  const gate = f.memoryDatabase.delayNext('readwrite');
  const writing = f.memory.startSession({ mode: 'focused', requestedLength: 1 });
  await gate.entered;
  await f.signIn('A');
  gate.release();
  await assert.rejects(writing);
  assert.deepEqual(await f.memory.listRecentSessions(), []);
  await f.guest();
  assert.deepEqual(await f.memory.listRecentSessions(), []);
});

async function raw(database) {
  return database.runTransaction(Object.values(STORES), 'readonly', async (tx) => ({
    metadata: await tx.get(STORES.METADATA, 'state'), identities: await tx.getAll(STORES.IDENTITIES),
    bindings: await tx.getAll(STORES.DOMAIN_BINDINGS), mappings: await tx.getAll(STORES.PROVIDER_MAPPINGS),
    transitions: await tx.getAll(STORES.LIFECYCLE_TRANSITIONS),
  }));
}
async function v3Database() {
  const f = await fixture();
  await f.signIn('A');
  const historicalSession = await f.memory.startSession({ mode: 'focused', requestedLength: 1 });
  await f.guest();
  const records = await raw(f.database);
  records.metadata.databaseVersion = 3;
  records.metadata.backendSchemaVersion = 'riverline-account-indexeddb/v3';
  records.bindings = records.bindings.filter((binding) => binding.domain !== DOMAINS.TRAINING_MEMORY);
  const database = createMemoryAccountIdentityDatabase();
  await database.runTransaction(Object.values(STORES), 'readwrite', async (tx) => {
    await tx.add(STORES.METADATA, records.metadata);
    for (const identity of records.identities) await tx.add(STORES.IDENTITIES, identity);
    for (const binding of records.bindings) await tx.add(STORES.DOMAIN_BINDINGS, binding);
    for (const mapping of records.mappings) await tx.add(STORES.PROVIDER_MAPPINGS, mapping);
  });
  return { database, records, memoryDatabase: f.memoryDatabase, historicalSession };
}

test('v3 registry migration adds stable Training bindings while preserving existing identities and domain bindings', async () => {
  const { database, records, memoryDatabase, historicalSession } = await v3Database();
  const f = accountFixture(database);
  const state = await f.repository.initialize();
  assert.equal(state.status, 'ready');
  const migrated = await raw(database);
  assert.deepEqual(migrated.identities, records.identities);
  assert.deepEqual(migrated.bindings.filter((binding) => binding.domain !== DOMAINS.TRAINING_MEMORY), records.bindings);
  assert.deepEqual(migrated.mappings, records.mappings);
  assert.equal(migrated.metadata.databaseVersion, 4);
  const memoryBindings = migrated.bindings.filter((binding) => binding.domain === DOMAINS.TRAINING_MEMORY);
  assert.equal(memoryBindings.length, 2);
  assert.equal(trainingMemoryOwnerKey(memoryBindings.find((binding) => binding.identityId === 'A').domainOwnerRef), 'account_identity:A');
  const guestBinding = memoryBindings.find((binding) => binding.identityId === records.metadata.deviceGuestIdentityId);
  assert.equal(trainingMemoryOwnerKey(guestBinding.domainOwnerRef), `local_identity:${guestBinding.identityId}`);
  const writes = database.getMetrics().recordsWritten;
  await accountFixture(database).repository.initialize();
  assert.equal(database.getMetrics().recordsWritten, writes, 'completed migration does no writes');
  await f.account.initialize();
  await f.account.activateProviderIdentity(createAuthProviderIdentity({ provider: 'fake', providerSubject: 'A',
    email: 'A@example.com', authenticatedAt: NOW }));
  const auth = { ready: async () => {}, getState: () => ({ status: 'signed_in', profile: { riverlineIdentityId: 'A' } }),
    subscribe() {} };
  const memory = createTrainingMemoryService({ database: memoryDatabase,
    ownerProvider: createTrainingMemoryOwnerResolver({ authentication: auth, identityProvider: f.account }) });
  assert.deepEqual((await memory.listRecentSessions())[0].session, historicalSession,
    'existing account sessions retain their exact native owner reference and historical bytes');
});

test('ambiguous v3 ownership fails closed without mutating registry bytes', async () => {
  const { database } = await v3Database();
  await database.runTransaction([STORES.DOMAIN_BINDINGS], 'readwrite', async (tx) => {
    const bindings = await tx.getAll(STORES.DOMAIN_BINDINGS);
    const personal = bindings.filter((binding) => binding.domain === DOMAINS.PERSONAL_STRATEGY);
    await tx.put(STORES.DOMAIN_BINDINGS, { ...personal[1], domainOwnerId: personal[0].domainOwnerId });
  });
  const before = await raw(database);
  assert.equal((await accountFixture(database).repository.initialize()).status, 'recovery_required');
  assert.deepEqual(await raw(database), before);
});

test('Training native owner reference stays stable under identity-kind rebind without rewriting historical session', async () => {
  const f = await fixture();
  const session = await f.memory.startSession({ mode: 'focused', requestedLength: 1 });
  const identity = await f.account.getActiveIdentity();
  const binding = await f.account.getDomainOwnership(DOMAINS.TRAINING_MEMORY);
  const promoted = transitionRiverlineIdentityKind(identity, 'authenticated_account', NOW);
  const rebound = rebindRiverlineDomainOwnershipBinding(binding, promoted, NOW);
  assert.equal(rebound.ownershipRef.ownerType, 'account_identity');
  assert.deepEqual(rebound.domainOwnerRef, binding.domainOwnerRef);
  assert.equal(trainingMemoryOwnerKey(rebound.domainOwnerRef), trainingMemoryOwnerKey(session.ownerRef));
  assert.equal((await f.memory.listRecentSessions())[0].session.ownerRef.ownerType, 'local_identity');
  assert.equal((await f.account.getActiveIdentity()).kind, 'device_guest', 'no promotion flow was executed');
});

test('queued Saved and Personal Strategy intents cannot begin storage work after their captured scope is revoked', async () => {
  const f = await fixture();
  const guest = await f.seed('guest');
  const queue = deferred();
  const savedWriting = queue.promise.then(() => guest.savedContext.application.updateAnnotations(guest.saved.id, { note: 'stale queue' }));
  const personalWriting = queue.promise.then(() => guest.personalContext.repository.saveProfile(
    updateStrategyProfile(guest.personal.bundle.profile, { displayName: 'stale queue' }, NOW),
  ));
  await f.signIn('A');
  const savedTransactions = guest.savedContext.database.getMetrics().transactions;
  const personalTransactions = guest.personalContext.database.getMetrics().transactions;
  queue.resolve();
  await assert.rejects(savedWriting);
  await assert.rejects(personalWriting);
  assert.equal(guest.savedContext.database.getMetrics().transactions, savedTransactions);
  assert.equal(guest.personalContext.database.getMetrics().transactions, personalTransactions);
  await f.guest();
  await assertOwner(f, guest);
});

test('Training authorization uses current identity scope despite local compatibility owner type', async () => {
  const f = await fixture();
  const historical = await f.memory.startSession({ mode: 'focused', requestedLength: 1 });
  const identity = await f.account.getActiveIdentity();
  const current = await f.account.captureLifecycleScope(DOMAINS.TRAINING_MEMORY);
  const promoted = transitionRiverlineIdentityKind(identity, 'authenticated_account', NOW);
  const binding = rebindRiverlineDomainOwnershipBinding(current.domainOwnerBinding, promoted, NOW);
  const futureScope = { ...current, identityKind: 'authenticated_account', domainOwnerBinding: binding };
  const auth = { ready: async () => {}, getState: () => ({ status: 'signed_in',
    profile: { riverlineIdentityId: identity.identityId } }), subscribe() {} };
  const resolver = createTrainingMemoryOwnerResolver({ authentication: auth, identityProvider: {
    getActiveIdentity: async () => promoted, captureLifecycleScope: async () => futureScope, subscribe() {},
  } });
  const captured = await resolver.capture();
  assert.equal(captured.lifecycleScope.identityKind, 'authenticated_account');
  assert.equal(captured.ownerRef.ownerType, 'local_identity');
  const memory = createTrainingMemoryService({ ownerProvider: resolver, database: f.memoryDatabase });
  assert.deepEqual((await memory.listRecentSessions())[0].session, historical);
  assert.equal((await f.account.getActiveIdentity()).kind, 'device_guest', 'test adapts scope only; no Move is implemented');
});

function runtimeFunction(source, name) {
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  if (source.slice(start - 6, start) === 'async ') start -= 6;
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Missing runtime function ${name}`);
}

test('already-started Training queue callback cannot start Guest work after waiting on prior Account session', async () => {
  const f = await fixture();
  await f.signIn('A');
  const entered = deferred();
  const prior = deferred();
  const app = { training: {
    memoryGeneration: 1, memoryWritePromise: Promise.resolve(), currentExercise: null,
    memorySessionPromise: { then(resolve) { entered.resolve(); prior.promise.then(resolve); } },
  } };
  const sandbox = { app, console, window: {}, $: () => null,
    resetTrainingMemoryDecisionState() {}, setTrainingMemoryStatus() {},
    callTrainingMemoryBridge: (method, ...args) => f.memory[method](...args),
  };
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const functions = ['clearTrainingLearningPresentation', 'queueTrainingMemoryWrite', 'startTrainingMemorySession', 'clearTrainingMemoryOwnerPresentation']
    .map((name) => runtimeFunction(source, name)).join('\n');
  vm.createContext(sandbox);
  vm.runInContext(`${functions}; this.result = startTrainingMemorySession({ mode: 'focused', requestedLength: 1 });`, sandbox);
  await entered.promise;
  await f.guest();
  vm.runInContext('clearTrainingMemoryOwnerPresentation();', sandbox);
  prior.resolve(null);
  assert.equal(await sandbox.result, null);
  assert.deepEqual(await f.memory.listRecentSessions(), [], 'Account intent must not create a Guest session');
});

test('Saved Hand opener validates lifecycle after read and before mutating Playbook', async () => {
  const f = await fixture();
  await f.signIn('A');
  let pokerState = initializeHand({ handId: 'account-A-hand', buttonSeat: 0,
    game: { mode: GAME_MODES.HOME, smallBlindMilliBb: 500, bigBlindMilliBb: 1000, chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 } },
    players: [{ playerId: 'Hero', seat: 0, startingStackMilliBb: 100000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 100000 }],
  });
  const replay = createReplayProjectionController({ getLiveState: () => pokerState, getHeroPlayerId: () => 'Hero' });
  replay.replaceHand({ state: pokerState, heroPlayerId: 'Hero', operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND });
  pokerState = applyChance(pokerState, { type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: ['As', 'Kh'] }, hiddenPlayerIds: ['Villain'] });
  replay.recordTransition({ state: pokerState, heroPlayerId: 'Hero', operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED });
  const application = (await f.savedApplication()).application;
  const saved = await application.saveHand({ pokerState, heroPlayerId: 'Hero', replaySource: replay.createCanonicalHandReplaySource() });
  let openCalls = 0;
  const home = installHomeWorkspaceBridge({}, {
    accountQueries: f.account, authentication: f.authentication, personalStrategyQueries: f.personalHome,
    savedStudyQueries: { ...f.saved, async getById(id) {
      const object = await f.saved.getById(id);
      await f.guest();
      return object;
    } },
    playbookBridge: { openSavedHand() { openCalls += 1; } },
  });
  await assert.rejects(home.openSavedItem(saved.object.id), /scope is stale/);
  assert.equal(openCalls, 0);
});

test('owner clearing removes Saved Scenario cards and context even after its viewer banner was dismissed', () => {
  const controls = new Map([
    ['stack', { value: '237', defaultValue: '100' }],
    ['pot', { value: '84', defaultValue: '1.5' }],
    ['heroPosition', { value: 'CO', options: [
      { value: 'UTG', defaultSelected: false }, { value: 'BTN', defaultSelected: true },
    ] }],
    ['lastAction', { value: 'raise', options: [{ value: 'none' }, { value: 'check' }] }],
  ]);
  const canonicalInput = Object.freeze({ schemaVersion: 'canonical-test-scenario', heroCards: [], board: [] });
  const unavailable = Object.freeze({ status: 'unavailable', reason: 'scenario_not_ready' });
  const calls = [];
  const app = {
    playbookMode: 'scenario', gto: { hero: ['As', 'Kh'], board: ['Qc', '7d', '2s'], dead: ['9h'] },
    decisionContext: { ownerPrivate: 'A decision' }, strategyResult: { ownerPrivate: 'A strategy' },
    playbookResolution: { ownerPrivate: 'A resolution' }, handReview: { savedDecisionIds: new Set(['A-decision']) },
  };
  const sandbox = {
    app, PLAYBOOK_MODES: { SCENARIO: 'scenario' },
    PLAYBOOK_SCENARIO_CONTROL_IDS: [...controls.keys(), 'absent-control'],
    document: { getElementById: (id) => controls.get(id) ?? null },
    savedScenarioOwnerActive: true,
    importedHandOwnerPresentation: false,
    handReviewDecisionSaver: { clear() { sandbox.decisionSaverCleared = true; } },
    handReviewProjector: { clear() { sandbox.reviewProjectorCleared = true; } },
    closeActiveHandReview({ returnToEndpoint }) {
      assert.equal(returnToEndpoint, false);
      app.handReview.source = null;
      app.handReview.model = null;
    },
    activeSavedSpotContext: null,
    savedPlaybookScenarioPresentation: { ownerPrivate: 'cached A presentation' },
    homeRefreshSequence: 0, homeViewModel: { ownerPrivate: 'A home' }, homeSavedExpandedId: 'A', homeSavedCategory: 'spot',
    savedStudyRefreshSequence: 0, savedStudyCurrentObject: { ownerPrivate: 'A object' },
    $: () => null, hideSavedQuickPreview() {}, renderSavedLibraryDetail() {}, renderSavedSpotViewer() {},
    closeSavedStudyEditor() {},
    playbookUpdateScheduler: { cancel() { calls.push('cancel'); } },
    readPlaybookScenarioInput() {
      calls.push('canonical-read');
      assert.equal(app.gto.hero.length + app.gto.board.length + app.gto.dead.length, 0);
      assert.equal(app.decisionContext, null);
      assert.equal(app.strategyResult, null);
      assert.equal(controls.get('stack').value, '100');
      assert.equal(controls.get('pot').value, '1.5');
      assert.equal(controls.get('heroPosition').value, 'BTN');
      assert.equal(controls.get('lastAction').value, 'none');
      return canonicalInput;
    },
    callPlaybookStateBridge(method, ...args) {
      if (method === 'createReplayProjectionViewModel') return null;
      calls.push(method);
      if (method === 'setMode') {
        assert.equal(args[0], 'scenario');
        assert.equal(args[1], canonicalInput);
      } else if (method === 'resolveDecisionContext') {
        assert.equal(args[0], canonicalInput);
        return unavailable;
      } else assert.fail(`Unexpected authority invocation ${method}`);
    },
    renderUnavailableStrategy(result) { assert.equal(result, unavailable); calls.push('render-unavailable'); },
    renderAllCards(options) { assert.equal(options.mode, 'gto'); calls.push('render-empty-cards'); },
  };
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const functions = ['clearSavedScenarioOwnerPresentation', 'clearSavedOwnerPresentation']
    .map((name) => runtimeFunction(source, name)).join('\n');
  vm.runInNewContext(`${functions}; clearSavedOwnerPresentation();`, sandbox);
  assert.deepEqual(calls, ['cancel', 'canonical-read', 'setMode', 'resolveDecisionContext', 'render-unavailable', 'render-empty-cards']);
  assert.equal(sandbox.savedScenarioOwnerActive, false);
  assert.equal(sandbox.savedPlaybookScenarioPresentation, null);
  assert.equal(sandbox.savedStudyCurrentObject, null);
  assert.equal(sandbox.homeViewModel, null);
  assert.equal(app.playbookResolution, unavailable);
  assert.equal(app.handReview.savedDecisionIds.size, 0);
  assert.equal(sandbox.decisionSaverCleared, true);
  assert.equal(sandbox.reviewProjectorCleared, true);
});
