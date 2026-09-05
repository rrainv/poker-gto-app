import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGACY_RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION,
  LEGACY_RIVERLINE_ACCOUNT_MIGRATION_SCHEMA_VERSION,
  LEGACY_RIVERLINE_IDENTITY_KINDS,
  LEGACY_RIVERLINE_IDENTITY_SCHEMA_VERSION,
  RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
  RIVERLINE_ACCOUNT_DATABASE_MIGRATIONS,
  RIVERLINE_ACCOUNT_DATABASE_VERSION,
  RIVERLINE_ACCOUNT_OBJECT_STORES,
  RIVERLINE_BINDING_PROVENANCE,
  RIVERLINE_DOMAIN_OWNERSHIP_BINDING_SCHEMA_VERSION,
  RIVERLINE_IDENTITY_KINDS,
  RIVERLINE_OWNED_DOMAINS,
  RIVERLINE_OWNER_TYPES,
  RIVERLINE_OWNERSHIP_REF_SCHEMA_VERSION,
  RIVERLINE_STORAGE_SCOPES,
  createAccountIdentityRepository,
  createMemoryAccountIdentityDatabase,
} from '../app/src/account-identity/index.mjs';
import { createAccountIdentityService } from '../app/src/application/account-identity-service.mjs';
import { createAuthenticationService } from '../app/src/application/authentication-service.mjs';
import { createRangeCalibrationLifecycle } from '../app/src/application/range-calibration-lifecycle.mjs';
import { createAuthProviderIdentity, createProviderIdentityMapping } from '../app/src/authentication/index.mjs';

const T0 = '2026-08-01T08:00:00.000Z';
const T1 = '2026-09-04T08:00:00.000Z';
const STORES = RIVERLINE_ACCOUNT_OBJECT_STORES;
const ALL_STORES = Object.values(STORES);

function ids(label) {
  let next = 0;
  return (prefix) => `${prefix}-${label}-${++next}`;
}

function provider(subject, at = T1) {
  return createAuthProviderIdentity({
    provider: 'fake',
    providerSubject: subject,
    email: `${subject}@example.com`,
    authenticatedAt: at,
  });
}

function legacyIdentity(identityId, kind = LEGACY_RIVERLINE_IDENTITY_KINDS.LOCAL) {
  return {
    schemaVersion: LEGACY_RIVERLINE_IDENTITY_SCHEMA_VERSION,
    identityId,
    kind,
    displayName: kind === LEGACY_RIVERLINE_IDENTITY_KINDS.LOCAL ? 'Local Player' : identityId,
    localDeviceIdentityId: 'legacy-device',
    createdAt: T0,
    updatedAt: T0,
  };
}

function legacyBinding(identity, domain, suffix = identity.identityId) {
  const account = identity.kind === LEGACY_RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE;
  return {
    schemaVersion: RIVERLINE_DOMAIN_OWNERSHIP_BINDING_SCHEMA_VERSION,
    bindingId: `${identity.identityId}:${domain}`,
    identityId: identity.identityId,
    domain,
    ownershipRef: {
      schemaVersion: RIVERLINE_OWNERSHIP_REF_SCHEMA_VERSION,
      ownerType: account ? RIVERLINE_OWNER_TYPES.ACCOUNT_IDENTITY : RIVERLINE_OWNER_TYPES.LOCAL_IDENTITY,
      ownerId: identity.identityId,
    },
    domainOwnerId: `${domain}-${suffix}`,
    storageScope: suffix === 'guest-a' ? RIVERLINE_STORAGE_SCOPES.LEGACY_DEFAULT : `scope-${suffix}`,
    provenance: RIVERLINE_BINDING_PROVENANCE.IDENTITY_INITIALIZED,
    createdAt: T0,
    updatedAt: T0,
  };
}

function legacyMetadata(activeIdentityId, adoptedDomains = []) {
  return {
    schemaVersion: LEGACY_RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION,
    key: 'state',
    backendSchemaVersion: 'riverline-account-indexeddb/v2',
    databaseVersion: 2,
    activeIdentityId,
    localDeviceIdentityId: 'legacy-device',
    revision: 4,
    createdAt: T0,
    updatedAt: T0,
    migration: {
      schemaVersion: LEGACY_RIVERLINE_ACCOUNT_MIGRATION_SCHEMA_VERSION,
      version: 1,
      status: 'complete',
      completedAt: T0,
      adoptedDomains,
    },
  };
}

async function seedLegacy(database, { identities, bindings, mappings = [], activeIdentityId } = {}) {
  await database.runTransaction(ALL_STORES, 'readwrite', async (transaction) => {
    await transaction.add(STORES.METADATA, legacyMetadata(activeIdentityId));
    for (const identity of identities) await transaction.add(STORES.IDENTITIES, identity);
    for (const binding of bindings) await transaction.add(STORES.DOMAIN_BINDINGS, binding);
    for (const mapping of mappings) await transaction.add(STORES.PROVIDER_MAPPINGS, mapping);
  });
}

async function rawRecords(database) {
  return database.runTransaction(ALL_STORES, 'readonly', async (transaction) => ({
    metadata: await transaction.get(STORES.METADATA, 'state'),
    identities: await transaction.getAll(STORES.IDENTITIES),
    bindings: await transaction.getAll(STORES.DOMAIN_BINDINGS),
    mappings: await transaction.getAll(STORES.PROVIDER_MAPPINGS),
    transitions: await transaction.getAll(STORES.LIFECYCLE_TRANSITIONS),
  }));
}

function fixture(label, database = createMemoryAccountIdentityDatabase()) {
  const repository = createAccountIdentityRepository({ database, clock: () => T1, idFactory: ids(label) });
  const account = createAccountIdentityService({ repository });
  return { database, repository, account };
}

function deferred() {
  let resolve;
  const wait = new Promise((done) => { resolve = done; });
  return { wait, resolve };
}

test('v4 fresh install creates exactly one stable Device Guest and reload restores it', async () => {
  assert.equal(RIVERLINE_ACCOUNT_DATABASE_VERSION, 4);
  assert.equal(RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION, 'riverline-account-indexeddb/v4');
  assert.deepEqual(RIVERLINE_ACCOUNT_DATABASE_MIGRATIONS.map(({ version }) => version), [1, 2, 3, 4]);
  const database = createMemoryAccountIdentityDatabase();
  const first = fixture('fresh-a', database);
  const initial = await first.account.initialize();
  assert.equal(initial.status, 'ready');
  assert.equal(initial.identities.length, 1);
  assert.equal(initial.activeIdentity.kind, RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST);
  assert.equal(initial.metadata.deviceGuestIdentityId, initial.activeIdentity.identityId);
  assert.equal(initial.metadata.lifecycleGeneration, 0);
  assert.equal(initial.metadata.pendingTransitionId, null);

  const second = fixture('fresh-b', database);
  const restored = await second.account.initialize();
  assert.equal(restored.activeIdentity.identityId, initial.activeIdentity.identityId);
  assert.equal(restored.identities.filter(({ kind }) => kind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST).length, 1);
});

test('one valid v2 legacy local identity is adopted as Guest without rewriting domain bindings', async () => {
  const database = createMemoryAccountIdentityDatabase();
  const local = legacyIdentity('legacy-local');
  const accountA = legacyIdentity('legacy-account-a', LEGACY_RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE);
  const providerA = provider('legacy-provider-a', T0);
  const bindings = [local, accountA].flatMap((identity, index) => (
    ['saved_study_objects', 'personal_strategy'].map((domain) => legacyBinding(
      identity,
      domain,
      index === 0 ? 'guest-a' : 'account-a',
    ))
  ));
  await seedLegacy(database, {
    identities: [local, accountA],
    bindings,
    mappings: [createProviderIdentityMapping({
      providerIdentity: providerA,
      riverlineIdentityId: accountA.identityId,
      createdAt: T0,
    })],
    activeIdentityId: accountA.identityId,
  });
  const bindingsBefore = (await rawRecords(database)).bindings;
  const { account } = fixture('migrated', database);
  const migrated = await account.initialize();
  assert.equal(migrated.activeIdentity.identityId, local.identityId);
  assert.equal(migrated.activeIdentity.kind, RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST);
  assert.equal(migrated.metadata.deviceGuestIdentityId, local.identityId);
  assert.equal(migrated.metadata.lifecycleGeneration, 5);
  assert.equal(migrated.identities.find(({ identityId }) => identityId === accountA.identityId).kind,
    RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT);
  assert.deepEqual((await rawRecords(database)).bindings.filter((entry) => entry.domain !== 'training_memory'), bindingsBefore);
});

test('ambiguous legacy Guest candidates fail closed with zero stored-record mutation', async () => {
  const database = createMemoryAccountIdentityDatabase();
  const first = legacyIdentity('ambiguous-local-a');
  const second = legacyIdentity('ambiguous-local-b');
  const retainedAccount = legacyIdentity(
    'ambiguous-retained-account',
    LEGACY_RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE,
  );
  const retainedProvider = provider('ambiguous-retained-provider', T0);
  const bindings = [first, second, retainedAccount].flatMap((identity, index) => (
    ['saved_study_objects', 'personal_strategy'].map((domain) => legacyBinding(identity, domain, `guest-${index}`))
  ));
  await seedLegacy(database, {
    identities: [first, second, retainedAccount],
    bindings,
    mappings: [createProviderIdentityMapping({
      providerIdentity: retainedProvider,
      riverlineIdentityId: retainedAccount.identityId,
      createdAt: T0,
    })],
    activeIdentityId: retainedAccount.identityId,
  });
  const before = await rawRecords(database);
  const { account } = fixture('ambiguous', database);
  const state = await account.initialize();
  assert.equal(state.status, 'recovery_required');
  assert.equal(account.getLifecycleState().status, 'recovery_required');
  await assert.rejects(account.getActiveIdentity(), { code: 'ambiguous_legacy_identity' });
  assert.deepEqual(await rawRecords(database), before);
});

test('stored Account A is never startup authorization without a validated session', async () => {
  const database = createMemoryAccountIdentityDatabase();
  const setup = fixture('retained-setup', database);
  const providerA = provider('retained-a');
  const initial = await setup.account.initialize();
  await setup.account.startProviderIdentitySeparately(providerA, {
    riverlineIdentityId: 'retained-account-a',
    displayName: 'Account A',
  });
  assert.equal((await setup.repository.getSnapshot()).activeIdentity.identityId, 'retained-account-a');

  const reloaded = fixture('retained-reload', database);
  const authentication = createAuthenticationService({ accountIdentity: reloaded.account, providerAdapter: null });
  assert.equal((await authentication.initialize()).status, 'guest');
  assert.equal((await reloaded.account.getActiveIdentity()).identityId, initial.metadata.deviceGuestIdentityId);
});

test('mapped account activates only after provider, profile, mapping, and local bindings agree', async () => {
  const database = createMemoryAccountIdentityDatabase();
  const providerA = provider('validated-a');
  const setup = fixture('validated-setup', database);
  await setup.account.initialize();
  await setup.account.startProviderIdentitySeparately(providerA, {
    riverlineIdentityId: 'validated-account-a',
    displayName: 'Account A',
  });

  const profileRepository = (riverlineIdentityId) => ({
    getByProviderIdentity: async () => ({
      riverlineIdentityId,
      authUserId: providerA.providerSubject,
      displayName: 'Account A',
      username: 'account_a',
    }),
    createForProviderIdentity: async () => { throw new Error('not used'); },
    bindRiverlineIdentity: async () => { throw new Error('not used'); },
    updateDisplayName: async () => { throw new Error('not used'); },
  });
  const adapter = {
    provider: 'fake',
    isAvailable: () => true,
    restoreSession: async () => providerA,
    refreshSession: async () => providerA,
    signInWithPassword: async () => providerA,
    signUpWithPassword: async () => providerA,
    signOut: async () => {},
  };

  const conflicting = fixture('validated-conflict', database);
  const conflictAuth = createAuthenticationService({
    accountIdentity: conflicting.account,
    providerAdapter: adapter,
    profileRepository: profileRepository('different-account'),
  });
  assert.equal((await conflictAuth.initialize()).status, 'recovery_required');
  await assert.rejects(conflicting.account.getActiveIdentity());

  const matching = fixture('validated-match', database);
  const matchingAuth = createAuthenticationService({
    accountIdentity: matching.account,
    providerAdapter: adapter,
    profileRepository: profileRepository('validated-account-a'),
  });
  assert.equal((await matchingAuth.initialize()).status, 'signed_in');
  assert.equal((await matching.account.getActiveIdentity()).identityId, 'validated-account-a');
});

test('sign-out aborts Account A scope before delayed provider cleanup and provider failure leaves Guest active', async () => {
  const database = createMemoryAccountIdentityDatabase();
  const providerA = provider('signout-a');
  const setup = fixture('signout-setup', database);
  await setup.account.initialize();
  await setup.account.startProviderIdentitySeparately(providerA, {
    riverlineIdentityId: 'signout-account-a',
    displayName: 'Account A',
  });
  const account = fixture('signout-runtime', database).account;
  const cleanup = deferred();
  let cleanupStarted = false;
  const adapter = {
    provider: 'fake',
    isAvailable: () => true,
    restoreSession: async () => providerA,
    refreshSession: async () => providerA,
    signInWithPassword: async () => providerA,
    signUpWithPassword: async () => providerA,
    async signOut() {
      cleanupStarted = true;
      await cleanup.wait;
      throw new Error('offline');
    },
  };
  const authentication = createAuthenticationService({ accountIdentity: account, providerAdapter: adapter });
  assert.equal((await authentication.initialize()).status, 'signed_in');
  const accountScope = await account.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
  const pending = authentication.signOut();
  assert.equal(authentication.getState().status, 'guest');
  assert.equal(accountScope.signal.aborted, true);
  assert.equal(accountScope.isCurrent(), false);
  await Promise.resolve();
  while (!cleanupStarted) await Promise.resolve();
  assert.equal((await account.getActiveIdentity()).kind, RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST);
  cleanup.resolve();
  const signedOut = await pending;
  assert.equal(signedOut.status, 'guest');
  assert.equal(signedOut.noticeCode, 'signout_incomplete');
  assert.equal((await account.getActiveIdentity()).kind, RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST);
});

test('A to Guest to B uses isolated owner targets and stale scopes cannot adopt late work', async () => {
  const { account } = fixture('switching');
  const providerA = provider('switch-a');
  const providerB = provider('switch-b');
  const guest = (await account.initialize()).activeIdentity;
  const generations = [account.getLifecycleState().lifecycleGeneration];
  account.subscribe(({ lifecycle }) => generations.push(lifecycle.lifecycleGeneration));

  await account.startProviderIdentitySeparately(providerA, {
    riverlineIdentityId: 'switch-account-a',
    displayName: 'Account A',
  });
  const scopeA = await account.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
  const late = deferred();
  let presented = null;
  let written = false;
  const lateWork = late.wait.then((value) => ({
    readAdopted: scopeA.adopt(() => { presented = value; }),
    writeAdopted: scopeA.adopt(() => { written = true; }),
  }));

  await assert.rejects(
    account.startProviderIdentitySeparately(providerB, {
      riverlineIdentityId: 'switch-account-b',
      displayName: 'Account B',
    }),
    { code: 'direct_account_switch_forbidden' },
  );

  const guestActivation = account.activateDeviceGuest();
  assert.equal(scopeA.signal.aborted, true);
  await guestActivation;
  const guestScope = await account.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
  assert.equal(guestScope.identityId, guest.identityId);
  await account.startProviderIdentitySeparately(providerB, {
    riverlineIdentityId: 'switch-account-b',
    displayName: 'Account B',
  });
  const scopeB = await account.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
  assert.notEqual(scopeA.domainOwnerBinding.storageScope, guestScope.domainOwnerBinding.storageScope);
  assert.notEqual(scopeA.domainOwnerBinding.storageScope, scopeB.domainOwnerBinding.storageScope);
  assert.notEqual(guestScope.domainOwnerBinding.storageScope, scopeB.domainOwnerBinding.storageScope);
  late.resolve('private A result');
  assert.deepEqual(await lateWork, { readAdopted: false, writeAdopted: false });
  assert.equal(presented, null);
  assert.equal(written, false);
  assert.equal(generations.every((value, index) => index === 0 || value >= generations[index - 1]), true);
  assert.equal(new Set(generations).size >= 3, true);
});

test('lifecycle revocation synchronously aborts mounted Personal Strategy presentation', async () => {
  let authState = { status: 'signed_in' };
  const eventTarget = new EventTarget();
  const disposal = deferred();
  let disposeStarted = false;
  let guestShown = false;
  const lifecycle = createRangeCalibrationLifecycle({
    authentication: {
      ready: async () => authState,
      getState: () => authState,
    },
    accountIdentity: { getActiveIdentityId: async () => 'presentation-account-a' },
    surface: {
      showLoading() {},
      showGuest() { guestShown = true; },
      showError() {},
      mountAuthenticated: async () => ({}),
      async disposeAuthenticated() {
        disposeStarted = true;
        await disposal.wait;
      },
    },
    eventTarget,
  });
  lifecycle.start();
  await lifecycle.activate();
  authState = { status: 'guest' };
  eventTarget.dispatchEvent(new Event('riverline:authchange'));
  assert.equal(disposeStarted, true);
  assert.equal(guestShown, true);
  assert.equal(lifecycle.getState().status, 'guest');
  disposal.resolve();
  await Promise.resolve();
});
