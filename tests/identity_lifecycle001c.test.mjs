import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountIdentityRepository, createMemoryAccountIdentityDatabase, RIVERLINE_ACCOUNT_OBJECT_STORES as STORES } from '../app/src/account-identity/index.mjs';
import { createAccountIdentityService } from '../app/src/application/account-identity-service.mjs';
import { createAuthenticationService } from '../app/src/application/authentication-service.mjs';
import { createAuthProviderIdentity, createFakeAuthProviderAdapter } from '../app/src/authentication/index.mjs';
import { createMemoryAccountProfileRepository } from '../app/src/account-profile/index.mjs';
import { createGuestWorkQuery } from '../app/src/application/guest-work-query.mjs';
import { createPersistentIdentityGate } from '../app/src/application/persistent-identity-gate.mjs';
import { createMemorySavedStudyDatabase, createSavedStudyRepository, createSavedStudyOwnerRef } from '../app/src/saved-study-objects/index.mjs';
import { createMemoryPersonalStrategyDatabase, createPersonalStrategyRepository, createLocalOwnerRef } from '../app/src/personal-strategy/index.mjs';
import { createMemoryTrainingMemoryDatabase } from '../app/src/training-memory/indexeddb-storage.mjs';
import { createTrainingMemoryRepository } from '../app/src/training-memory/repository.mjs';
import { createTrainingMemoryOwnerResolver, createTrainingMemoryService } from '../app/src/application/training-memory-service.mjs';
import { createPreAccountSavedStudyFixture, createPreAccountPersonalStrategyFixture } from './fixtures/account001_legacy.mjs';
import { createSyncCoordinator } from '../app/src/sync/coordinator.mjs';
import { createSyncRepository } from '../app/src/sync/repository.mjs';
import { createMemorySyncDatabase } from '../app/src/sync/indexeddb-storage.mjs';
import { TRAINING_DECISION_TYPES, createTrainingConfigFromLegacyCompatibility, generateTrainingExercise } from '../app/src/application/training-generator.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';

const NOW = '2026-09-05T12:00:00.000Z';
const clock = () => NOW;
const provider = (subject = 'A') => createAuthProviderIdentity({ provider: 'fake', providerSubject: subject, email: 'same@example.com', authenticatedAt: NOW });
const storage = { getItem: () => null, setItem() {} };
let serial = 0;
const ids = (prefix) => `${prefix}-slice-c-${++serial}`;
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

async function fixture({ meaningful = true, database = createMemoryAccountIdentityDatabase(), profiles = null, adapter = null } = {}) {
  const subject = provider();
  profiles ??= createMemoryAccountProfileRepository({ clock });
  await profiles.createForProviderIdentity(subject, { username: 'player_a', displayName: 'Account A' });
  adapter ??= createFakeAuthProviderAdapter({ identities: [subject] });
  const repository = createAccountIdentityRepository({ database, clock, idFactory: ids });
  const account = createAccountIdentityService({ repository });
  let queries = 0;
  const auth = createAuthenticationService({ accountIdentity: account, profileRepository: profiles, providerAdapter: adapter,
    hasMeaningfulGuestWork: async () => { queries++; if (meaningful instanceof Error) throw meaningful; return meaningful; } });
  await auth.initialize();
  return { database, repository, account, auth, subject, profiles, adapter, queries: () => queries,
    signIn: () => auth.signInWithPassword({ email: subject.email, password: 'fixture' }) };
}

test('empty Guest automatically keeps separate without publishing a choice or enabling sync', async () => {
  const f = await fixture({ meaningful: false });
  const before = await f.repository.getSnapshot();
  const statuses = [];
  f.auth.subscribe((state) => statuses.push(state.status));
  assert.equal((await f.signIn()).status, 'signed_in');
  const after = await f.repository.getSnapshot();
  assert.notEqual(after.activeIdentity.identityId, before.activeIdentity.identityId);
  assert.deepEqual(after.identities.find((identity) => identity.kind === 'device_guest'), before.activeIdentity);
  assert.equal((await f.account.getProfileSummary()).syncEnabled, false);
  assert.equal(statuses.includes('link_choice_required'), false);
  assert.equal(after.lifecycleTransitions[0].choice, 'keep_separate');
});

for (const choice of ['move', 'keep_separate', 'cancel']) test(`meaningful Guest requires explicit ${choice}; ownership is never exposed before choice`, async () => {
  const f = await fixture();
  const before = await f.repository.getSnapshot();
  const scope = await f.account.captureLifecycleScope();
  const pending = await f.signIn();
  assert.equal(pending.status, 'link_choice_required');
  assert.equal(pending.profile, null);
  assert.equal(f.account.getLifecycleState().status, 'guest_active');
  assert.deepEqual(await f.repository.getSnapshot(), before);
  if (choice === 'cancel') {
    assert.equal((await f.auth.cancelPendingAuthentication()).status, 'guest');
    assert.deepEqual(await f.repository.getSnapshot(), before);
    assert.equal((await f.profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, null);
    return;
  }
  assert.equal((await (choice === 'move' ? f.auth.linkCurrentLocalData() : f.auth.startSeparately())).status, 'signed_in');
  assert.equal(scope.isCurrent(), false);
  const after = await f.repository.getSnapshot();
  const guest = after.identities.find((identity) => identity.kind === 'device_guest');
  assert.equal(after.identities.length, 2);
  assert.equal(after.bindings.length, 6);
  assert.equal(after.providerIdentityMappings.length, 1);
  assert.equal(after.lifecycleTransitions[0].phase, 'locally_finalized');
  if (choice === 'move') {
    assert.equal(after.activeIdentity.identityId, before.activeIdentity.identityId);
    assert.notEqual(guest.identityId, before.activeIdentity.identityId);
    for (const binding of before.bindings) {
      const promoted = after.bindings.find((entry) => entry.bindingId === binding.bindingId);
      for (const key of ['bindingId', 'identityId', 'domainOwnerId', 'domainOwnerRef', 'storageScope', 'provenance', 'createdAt']) assert.deepEqual(promoted[key], binding[key]);
    }
  } else {
    assert.deepEqual(guest, before.activeIdentity);
    assert.deepEqual(after.bindings.filter((entry) => entry.identityId === guest.identityId), before.bindings);
  }
  await f.auth.signOut();
  assert.equal((await f.account.getActiveIdentity()).identityId, guest.identityId);
});

test('already-bound account never inspects Guest; A to Guest to B remains separate', async () => {
  const f = await fixture();
  await f.signIn(); await f.auth.startSeparately();
  const accountA = await f.account.getActiveIdentity();
  await f.auth.signOut();
  f.adapter.queueIdentity(f.subject);
  assert.equal((await f.signIn()).status, 'signed_in');
  assert.equal(f.queries(), 1);
  await f.auth.signOut();
  const b = provider('B');
  await f.profiles.createForProviderIdentity(b, { username: 'player_b', displayName: 'Account B' });
  f.adapter.queueIdentity(b);
  await f.signIn(); await f.auth.startSeparately();
  const accountB = await f.account.getActiveIdentity();
  assert.notEqual(accountB.identityId, accountA.identityId);
  const snapshot = await f.repository.getSnapshot();
  assert.equal(new Set(snapshot.bindings.map((binding) => `${binding.domain}:${binding.storageScope}`)).size, 9);
});

test('unknown meaningful-data result fails safely without any mapping or remote bind', async () => {
  for (const meaningful of [undefined, new Error('unreadable')]) {
    const f = await fixture({ meaningful: meaningful === undefined ? null : meaningful });
    assert.equal((await f.signIn()).status, 'authentication_failed');
    assert.equal((await f.repository.getSnapshot()).identities.length, 1);
    assert.equal((await f.profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, null);
  }
});

test('stale choice and duplicate clicks cannot reserve competing identities', async () => {
  const f = await fixture(); await f.signIn();
  const waiting = deferred(); const entered = deferred();
  const original = createMemoryAccountProfileRepository({ clock });
  const g = await fixture({ profiles: { ...original, async bindRiverlineIdentity(...args) { entered.resolve(); await waiting.promise; return original.bindRiverlineIdentity(...args); } } });
  await g.signIn();
  const move = g.auth.linkCurrentLocalData();
  await entered.promise;
  const keep = g.auth.startSeparately();
  assert.equal(g.account.getLifecycleState().status, 'transitioning');
  await assert.rejects(g.account.captureLifecycleScope());
  waiting.resolve();
  await Promise.all([move, keep]);
  assert.equal((await g.repository.getSnapshot()).lifecycleTransitions.length, 1);
  const scope = await f.account.captureLifecycleScope();
  await f.account.startProviderIdentitySeparately(provider('external'));
  await f.account.activateDeviceGuest();
  assert.equal(scope.isCurrent(), false);
  await assert.rejects(f.auth.linkCurrentLocalData());
  assert.equal((await f.profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, null);
});

test('failed preparation safely returns to unchanged Guest with no remote commit', async () => {
  const f = await fixture(); await f.signIn();
  const before = await f.repository.getSnapshot();
  f.database.failNextTransaction('before_commit', new Error('disk failure'), 'readwrite');
  assert.equal((await f.auth.linkCurrentLocalData()).status, 'guest');
  assert.deepEqual(await f.repository.getSnapshot(), before);
  assert.equal((await f.profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, null);
});

for (const phase of ['prepared', 'binding_remote', 'remote_bound']) test(`restart at ${phase} resumes the same reserved Move exactly once`, async () => {
  const f = await fixture();
  const guest = await f.account.getActiveIdentity();
  const entry = await f.repository.prepareLifecycleTransition(f.subject, { choice: 'move', guestIdentityId: guest.identityId });
  if (phase !== 'prepared') {
    await f.repository.updateLifecycleTransition(entry.transitionId, 'binding_remote');
    await f.profiles.bindRiverlineIdentity(f.subject, entry.account.identity.identityId);
    if (phase === 'remote_bound') await f.repository.updateLifecycleTransition(entry.transitionId, 'remote_bound');
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const freshRepository = createAccountIdentityRepository({ database: f.database, clock, idFactory: ids });
    const freshAccount = createAccountIdentityService({ repository: freshRepository });
    const auth = createAuthenticationService({ accountIdentity: freshAccount, profileRepository: f.profiles,
      providerAdapter: createFakeAuthProviderAdapter({ restoredIdentity: f.subject }), hasMeaningfulGuestWork: () => { throw new Error('Recovery must not inspect Guest'); } });
    assert.equal((await auth.initialize()).status, 'signed_in');
    const result = await freshRepository.getSnapshot();
    assert.equal(result.activeIdentity.identityId, guest.identityId);
    assert.equal(result.metadata.deviceGuestIdentityId, entry.replacement.identity.identityId);
    assert.equal(result.identities.length, 2);
    assert.equal(result.bindings.length, 6);
    assert.equal(result.lifecycleTransitions.length, 1);
  }
});

test('remote commit followed by lost confirmation enters recovery and retries the same identity', async () => {
  const backing = createMemoryAccountProfileRepository({ clock });
  let loseConfirmation = true;
  const f = await fixture({ profiles: { ...backing, async bindRiverlineIdentity(...args) {
    const result = await backing.bindRiverlineIdentity(...args);
    if (loseConfirmation) { loseConfirmation = false; throw new Error('connection lost after commit'); }
    return result;
  } } });
  await f.signIn();
  assert.equal((await f.auth.linkCurrentLocalData()).status, 'recovery_required');
  const pending = await f.account.getPendingLifecycleTransition();
  assert.equal(pending.phase, 'recovery_required');
  assert.equal((await f.repository.getSnapshot()).identities.length, 1);
  await assert.rejects(f.account.getActiveIdentity());
  assert.equal((await f.auth.retryIdentityTransition()).status, 'signed_in');
  assert.equal((await f.account.getActiveIdentity()).identityId, pending.account.identity.identityId);
});

test('local finalization failure after remote commit retries reserved identity and replacement Guest', async () => {
  const database = createMemoryAccountIdentityDatabase();
  let failFinalize = true;
  const wrapped = { ...database, async runTransaction(stores, mode, operation, options) {
    return database.runTransaction(stores, mode, async (tx) => operation({ ...tx, async put(store, value) {
      if (failFinalize && store === STORES.LIFECYCLE_TRANSITIONS && value.phase === 'locally_finalized') {
        failFinalize = false; throw new Error('disk failure during finalization');
      }
      return tx.put(store, value);
    } }), options);
  } };
  const f = await fixture({ database: wrapped }); await f.signIn();
  assert.equal((await f.auth.linkCurrentLocalData()).status, 'recovery_required');
  const pending = await f.account.getPendingLifecycleTransition();
  assert.equal((await f.profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, pending.account.identity.identityId);
  assert.equal((await f.repository.getSnapshot()).identities.length, 1);
  assert.equal((await f.auth.retryIdentityTransition()).status, 'signed_in');
  assert.equal((await f.repository.getSnapshot()).metadata.deviceGuestIdentityId, pending.replacement.identity.identityId);
});

test('revocation while local commit is pending aborts ownership writes', async () => {
  const backing = createMemoryAccountIdentityDatabase();
  const entered = deferred(); const release = deferred();
  const database = { ...backing, async runTransaction(stores, mode, operation, options) {
    return backing.runTransaction(stores, mode, async (tx) => {
      const result = await operation(tx);
      if (mode === 'readwrite' && result?.state?.activeIdentity?.kind === 'authenticated_account') {
        entered.resolve(); await release.promise;
      }
      return result;
    }, options);
  } };
  const f = await fixture({ database }); await f.signIn();
  const moving = f.auth.linkCurrentLocalData();
  await entered.promise;
  const cancelling = f.auth.cancelPendingAuthentication();
  release.resolve(); await moving; await cancelling;
  assert.equal(f.auth.getState().status, 'recovery_required');
  const snapshot = await f.repository.getSnapshot();
  assert.equal(snapshot.identities.length, 1);
  assert.equal(snapshot.providerIdentityMappings.length, 0);
  assert.equal(snapshot.activeIdentity.kind, 'device_guest');
});

test('Move cannot synthesize sync consent or inherit another account sidecar', async () => {
  const f = await fixture();
  const database = createMemorySyncDatabase();
  const repository = createSyncRepository({ database });
  await repository.setPreference('other-account', true, NOW);
  const before = database.snapshot();
  let remoteCalls = 0;
  const coordinator = createSyncCoordinator({ repository,
    domainAdapter: { domain: 'saved_study_objects', listLocalObjects: async () => [], serialize: (value) => value, applyRemote: async () => {}, getLocalObject: async () => null, same: () => false },
    remoteAdapter: { pushOperation: async () => { remoteCalls++; }, pullChanges: async () => { remoteCalls++; return { records: [], cursor: null, hasMore: false }; } },
    scheduleTask: () => ({}), cancelTask: () => {},
  });
  const guestScope = await f.account.captureLifecycleScope('saved_study_objects');
  await coordinator.activate({ identityId: guestScope.identityId, authenticated: false, sessionValid: false, lifecycleScope: guestScope });
  await f.signIn(); await f.auth.linkCurrentLocalData();
  const accountScope = await f.account.captureLifecycleScope('saved_study_objects');
  await coordinator.activate({ identityId: accountScope.identityId, authenticated: true, sessionValid: true, lifecycleScope: accountScope });
  await coordinator.syncNow();
  assert.equal(coordinator.getState().enabled, false);
  assert.equal(coordinator.getState().decided, false);
  assert.equal(remoteCalls, 0);
  assert.deepEqual(database.snapshot(), before);
});

for (const stage of ['prepared', 'binding_remote']) test(`cancel during ${stage} respects the remote commit boundary`, async () => {
  const entered = deferred(); const release = deferred();
  const adapter = createFakeAuthProviderAdapter({ identities: [provider()] });
  let pauseRestore = false;
  const profiles = createMemoryAccountProfileRepository({ clock });
  const f = await fixture({
    adapter: { ...adapter, async restoreSession() {
      if (pauseRestore && stage === 'prepared') { entered.resolve(); await release.promise; pauseRestore = false; }
      return adapter.restoreSession();
    } },
    profiles: { ...profiles, async bindRiverlineIdentity(...args) {
      const value = await profiles.bindRiverlineIdentity(...args);
      if (stage === 'binding_remote') { entered.resolve(); await release.promise; }
      return value;
    } },
  });
  await f.signIn(); pauseRestore = true;
  const moving = f.auth.linkCurrentLocalData();
  await entered.promise;
  const cancelling = f.auth.cancelPendingAuthentication();
  release.resolve(); await moving;
  const result = await cancelling;
  if (stage === 'prepared') {
    assert.equal(result.status, 'guest');
    assert.equal(f.account.getLifecycleState().status, 'guest_active');
    assert.equal(await f.account.getPendingLifecycleTransition(), null);
    assert.equal((await profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, null);
  } else {
    assert.equal(result.status, 'recovery_required');
    const pending = await f.account.getPendingLifecycleTransition();
    assert.equal((await profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, pending.account.identity.identityId);
    adapter.queueIdentity(f.subject);
    assert.equal(result.canRetrySignIn, true);
    assert.equal((await f.signIn()).status, 'signed_in');
    assert.equal((await f.account.getActiveIdentity()).identityId, pending.account.identity.identityId);
  }
});

test('remote-only binding and wrong recovery provider fail closed without Guest inspection', async () => {
  const f = await fixture();
  await f.profiles.bindRiverlineIdentity(f.subject, 'foreign-identity');
  assert.equal((await f.signIn()).status, 'recovery_required');
  assert.equal(f.queries(), 0);
  assert.equal((await f.repository.getSnapshot()).identities.length, 1);
});

test('recovery sign-in rejects another subject and preserves the same journal', async () => {
  const f = await fixture();
  const guest = await f.account.getActiveIdentity();
  const entry = await f.repository.prepareLifecycleTransition(f.subject, { choice: 'keep_separate', guestIdentityId: guest.identityId });
  const freshAccount = createAccountIdentityService({ repository: createAccountIdentityRepository({ database: f.database, clock, idFactory: ids }) });
  const b = provider('B');
  const adapter = createFakeAuthProviderAdapter({ identities: [b, f.subject] });
  const auth = createAuthenticationService({ accountIdentity: freshAccount, profileRepository: f.profiles, providerAdapter: adapter,
    hasMeaningfulGuestWork: () => { throw new Error('Recovery cannot inspect Guest'); } });
  assert.equal((await auth.initialize()).status, 'recovery_required');
  assert.equal((await auth.signInWithPassword({ email: b.email, password: 'fixture' })).status, 'recovery_required');
  assert.equal((await freshAccount.getPendingLifecycleTransition()).transitionId, entry.transitionId);
  assert.equal((await f.profiles.getByProviderIdentity(b)), null);
  assert.equal((await auth.signInWithPassword({ email: f.subject.email, password: 'fixture' })).status, 'signed_in');
  assert.equal((await freshAccount.getActiveIdentity()).identityId, entry.account.identity.identityId);
});

test('provider cleanup failure cannot restore access and clears pending intents', async () => {
  const f = await fixture({ adapter: createFakeAuthProviderAdapter({ identities: [provider()], failures: { signOut: new Error('offline') } }) });
  await f.signIn();
  const gate = createPersistentIdentityGate({ authentication: f.auth });
  let writes = 0;
  const pending = gate.requirePersistentIdentity({ intent: 'save', resumeAction: () => { writes++; } });
  const rejected = assert.rejects(pending, (error) => error.code === 'persistent_identity_cancelled');
  await Promise.resolve();
  assert.equal((await f.auth.cancelPendingAuthentication()).noticeCode, 'signout_incomplete');
  await rejected;
  assert.equal(writes, 0);
  assert.equal(f.account.getLifecycleState().status, 'guest_active');
  assert.equal((await f.repository.getSnapshot()).providerIdentityMappings.length, 0);
});

test('missing or corrupt stable Training binding blocks Move and preserves all registry bytes', async () => {
  for (const corrupt of [false, true]) {
    const f = await fixture(); await f.signIn();
    const binding = await f.account.getDomainOwnership('training_memory');
    await f.database.runTransaction([STORES.DOMAIN_BINDINGS], 'readwrite', async (tx) => {
      if (corrupt) await tx.put(STORES.DOMAIN_BINDINGS, { ...binding, domainOwnerRef: { ...binding.domainOwnerRef, ownerId: 'wrong' } });
      else { const { domainOwnerRef, ...missingStableOwner } = binding; await tx.put(STORES.DOMAIN_BINDINGS, missingStableOwner); }
    });
    await f.auth.linkCurrentLocalData();
    assert.notEqual(f.auth.getState().status, 'signed_in');
    const records = await f.database.runTransaction(Object.values(STORES), 'readonly', (tx) => tx.getAll(STORES.PROVIDER_MAPPINGS));
    assert.equal(records.length, 0);
    assert.equal((await f.profiles.getByProviderIdentity(f.subject)).riverlineIdentityId, null);
  }
});

test('bounded domain detection counts archived Saved, profile bundles and abandoned Training; Move preserves actual domain bytes', async () => {
  const f = await fixture();
  const bindings = (await f.repository.getSnapshot()).bindings;
  const savedBinding = bindings.find((binding) => binding.domain === 'saved_study_objects');
  const personalBinding = bindings.find((binding) => binding.domain === 'personal_strategy');
  const memoryBinding = bindings.find((binding) => binding.domain === 'training_memory');
  const savedDb = createMemorySavedStudyDatabase();
  const personalDb = createMemoryPersonalStrategyDatabase();
  const memoryDb = createMemoryTrainingMemoryDatabase();
  const saved = createSavedStudyRepository({ database: savedDb, ownerRef: createSavedStudyOwnerRef(savedBinding.domainOwnerId), clock });
  const personal = createPersonalStrategyRepository({ database: personalDb, legacyStorage: storage, ownerRef: createLocalOwnerRef(personalBinding.domainOwnerId), clock });
  const memory = createTrainingMemoryService({ database: memoryDb,
    ownerProvider: createTrainingMemoryOwnerResolver({ authentication: f.auth, identityProvider: f.account }), clock, idFactory: ids });
  const query = createGuestWorkQuery({ accountIdentity: f.account, storage, databaseResolver: (binding) => ({ saved_study_objects: savedDb, personal_strategy: personalDb, training_memory: memoryDb })[binding.domain] });
  assert.equal(await query(), false);
  const session = await memory.startSession({ mode: 'focused', requestedLength: 1 });
  const generated = generateTrainingExercise(createTrainingConfigFromLegacyCompatibility({ tableSize: 6, stackBb: 100, streets: ['preflop'], gameMode: 'home', heroPositions: ['BTN'], allowedDecisionTypes: [TRAINING_DECISION_TYPES.PREFLOP_UNOPENED], difficulty: 'hard', seed: 123 }), {
    strategyProvider: createStrategyProvider({ fallbackResolver: () => ({ source: 'heuristic_preflop', modelVersion: 'slice-c-fixture', actions: [{ action: { type: 'fold' }, label: 'Fold', probability: 1 }] }) }),
  });
  assert.equal(generated.ok, true);
  const unanswered = await memory.recordExerciseShown({ sessionId: session.id, exercise: generated.exercise });
  await memory.finishSession(session.id, 'abandoned');
  assert.equal(await query(), true);
  assert.equal(await saved.hasMeaningfulData(), false);
  const object = { ...createPreAccountSavedStudyFixture(), ownerRef: saved.ownerRef };
  await saved.save(object);
  await saved.archive(object.id);
  assert.equal(await saved.hasMeaningfulData(), true);
  const personalFixture = createPreAccountPersonalStrategyFixture();
  const bundle = structuredClone(personalFixture.bundle); bundle.profile.ownerRef = createLocalOwnerRef(personalBinding.domainOwnerId);
  await personal.saveProfileBundle(bundle);
  assert.equal(await personal.hasMeaningfulData(), true);
  const savedBefore = await saved.exportLibrary();
  const personalBefore = await personal.loadSnapshot();
  const trainingBefore = await memory.listRecentSessions();
  await f.signIn(); await f.auth.linkCurrentLocalData();
  assert.deepEqual(await saved.exportLibrary(), savedBefore);
  assert.deepEqual(await personal.loadSnapshot(), personalBefore);
  assert.deepEqual(await memory.listRecentSessions(), trainingBefore);
  assert.deepEqual(await memory.getDecision(unanswered.id), unanswered);
  await f.auth.signOut();
  assert.deepEqual(await memory.listRecentSessions(), []);
});
