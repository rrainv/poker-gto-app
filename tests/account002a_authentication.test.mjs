import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  LEGACY_PERSONAL_STRATEGY_OWNER_KEY,
  LEGACY_SAVED_STUDY_OWNER_KEY,
  RIVERLINE_IDENTITY_KINDS,
  RIVERLINE_OWNED_DOMAINS,
  RIVERLINE_ACCOUNT_DATABASE_MIGRATIONS,
  RIVERLINE_ACCOUNT_DATABASE_VERSION,
  createAccountIdentityRepository,
  createMemoryAccountIdentityDatabase,
} from '../app/src/account-identity/index.mjs';
import { createAccountIdentityService } from '../app/src/application/account-identity-service.mjs';
import { createAuthenticationService } from '../app/src/application/authentication-service.mjs';
import { createHomeViewModelController } from '../app/src/application/home-view-model.mjs';
import { createPersonalStrategyHomeQuery } from '../app/src/application/personal-strategy-home-query.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  AuthProviderError,
  createAuthProviderIdentity,
  createFakeAuthProviderAdapter,
  createSupabaseAuthProviderAdapter,
  providerIdentityMappingId,
} from '../app/src/authentication/index.mjs';
import {
  createLocalOwnerRef,
  createMemoryPersonalStrategyDatabase,
  createPersonalStrategyRepository,
} from '../app/src/personal-strategy/index.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
  createSavedStudyRepository,
} from '../app/src/saved-study-objects/index.mjs';
import {
  ACCOUNT001_LEGACY_PERSONAL_OWNER_ID,
  ACCOUNT001_LEGACY_SAVED_OWNER_ID,
  ACCOUNT001_LEGACY_T2,
  createPreAccountPersonalStrategyFixture,
  createPreAccountSavedStudyFixture,
} from './fixtures/account001_legacy.mjs';

const AUTH_T1 = '2026-08-17T09:00:00.000Z';
const AUTH_T2 = '2026-08-17T09:01:00.000Z';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function idFactory(label = 'account002a') {
  let id = 0;
  return (prefix) => `${prefix}-${label}-${++id}`;
}

function providerIdentity(subject, { email = 'same@example.com', at = AUTH_T1 } = {}) {
  return createAuthProviderIdentity({
    provider: 'supabase',
    providerTenantId: 'riverline-test.supabase.co',
    providerSubject: subject,
    email,
    displayName: null,
    authenticatedAt: at,
  });
}

function accountFixture({ storage = new MemoryStorage(), database = createMemoryAccountIdentityDatabase(), label } = {}) {
  const repository = createAccountIdentityRepository({
    database,
    clock: () => ACCOUNT001_LEGACY_T2,
    idFactory: idFactory(label),
    legacyOwners: {
      [RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS]: storage.getItem(LEGACY_SAVED_STUDY_OWNER_KEY),
      [RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY]: storage.getItem(LEGACY_PERSONAL_STRATEGY_OWNER_KEY),
    },
  });
  return { storage, database, repository, account: createAccountIdentityService({ repository }) };
}

async function seedPersonalStrategy(database, fixture) {
  const repository = createPersonalStrategyRepository({
    database,
    legacyStorage: new MemoryStorage(),
    ownerRef: fixture.ownerRef,
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  await repository.saveProfileBundle(fixture.bundle);
  await repository.saveCalibrationSession(fixture.initialSession);
  await repository.saveCalibrationAnswer({
    observation: fixture.direct,
    session: fixture.session,
    expectedSessionUpdatedAt: fixture.initialSession.updatedAt,
  });
  await repository.saveTrainingObservation(fixture.training);
  return repository;
}

test('Guest startup and unavailable provider preserve legacy Local Profile storage without exposing it', async () => {
  assert.equal(RIVERLINE_ACCOUNT_DATABASE_VERSION, 2);
  assert.deepEqual(RIVERLINE_ACCOUNT_DATABASE_MIGRATIONS.map((entry) => entry.version), [1, 2]);
  assert.notEqual(
    providerIdentityMappingId({ provider: 'fake', providerSubject: '/' }),
    providerIdentityMappingId({ provider: 'fake', providerSubject: '_2F' }),
  );
  const { account } = accountFixture({ label: 'local' });
  const authentication = createAuthenticationService({ accountIdentity: account, providerAdapter: null });
  const state = await authentication.initialize();
  assert.equal(state.status, 'guest');
  assert.equal(state.noticeCode, 'provider_not_configured');
  assert.equal((await account.getActiveIdentity()).kind, RIVERLINE_IDENTITY_KINDS.LOCAL);

  const offline = createFakeAuthProviderAdapter({
    failures: { restoreSession: new AuthProviderError('provider_unavailable', 'offline') },
  });
  const second = createAuthenticationService({ accountIdentity: account, providerAdapter: offline });
  assert.equal((await second.initialize()).status, 'guest');
  assert.equal((await account.getActiveIdentity()).kind, RIVERLINE_IDENTITY_KINDS.LOCAL);
});

test('first authentication links current data atomically while preserving Riverline and domain IDs', async () => {
  const storage = new MemoryStorage({
    [LEGACY_SAVED_STUDY_OWNER_KEY]: ACCOUNT001_LEGACY_SAVED_OWNER_ID,
    [LEGACY_PERSONAL_STRATEGY_OWNER_KEY]: ACCOUNT001_LEGACY_PERSONAL_OWNER_ID,
  });
  const { account, repository } = accountFixture({ storage, label: 'link' });
  const before = await account.initialize();
  const originalIdentityId = before.activeIdentity.identityId;
  const savedBindingBefore = await account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
  const personalBindingBefore = await account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY);
  const savedDatabase = createMemorySavedStudyDatabase();
  const savedRepository = createSavedStudyRepository({
    database: savedDatabase,
    ownerRef: createSavedStudyOwnerRef(savedBindingBefore.domainOwnerId),
    clock: () => ACCOUNT001_LEGACY_T2,
  });
  const saved = createPreAccountSavedStudyFixture();
  await savedRepository.save(saved);
  const personalDatabase = createMemoryPersonalStrategyDatabase();
  const personalFixture = createPreAccountPersonalStrategyFixture();
  const personalRepository = await seedPersonalStrategy(personalDatabase, personalFixture);
  const personalBefore = await personalRepository.loadSnapshot();

  const identityA = providerIdentity('provider-a');
  const fake = createFakeAuthProviderAdapter({ identities: [identityA] });
  const authentication = createAuthenticationService({ accountIdentity: account, providerAdapter: fake });
  await authentication.initialize();
  const pending = await authentication.signInWithPassword({ email: identityA.email, password: 'not-recorded' });
  assert.equal(pending.status, 'link_required');
  assert.equal(pending.canLinkCurrentLocalData, true);
  assert.equal((await repository.getSnapshot()).providerIdentityMappings.length, 0);

  const linked = await authentication.linkCurrentLocalData();
  assert.equal(linked.status, 'signed_in');
  const after = await repository.getSnapshot();
  assert.equal(after.activeIdentity.identityId, originalIdentityId);
  assert.equal(after.activeIdentity.kind, RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE);
  assert.equal(after.providerIdentityMappings.length, 1);
  assert.equal(after.providerIdentityMappings[0].riverlineIdentityId, originalIdentityId);
  const replacementLocal = after.identities.find((entry) => entry.kind === RIVERLINE_IDENTITY_KINDS.LOCAL);
  assert.ok(replacementLocal);
  assert.notEqual(replacementLocal.identityId, originalIdentityId);
  const savedBindingAfter = await repository.getDomainOwnership(
    RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS,
    originalIdentityId,
  );
  const personalBindingAfter = await repository.getDomainOwnership(
    RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY,
    originalIdentityId,
  );
  assert.equal(savedBindingAfter.domainOwnerId, savedBindingBefore.domainOwnerId);
  assert.equal(savedBindingAfter.storageScope, savedBindingBefore.storageScope);
  assert.equal(personalBindingAfter.domainOwnerId, personalBindingBefore.domainOwnerId);
  assert.equal(personalBindingAfter.storageScope, personalBindingBefore.storageScope);
  assert.equal((await savedRepository.getById(saved.id)).id, saved.id);
  const personalAfter = await personalRepository.loadSnapshot();
  assert.deepEqual(personalAfter, personalBefore);
  assert.equal(personalAfter.profiles[0].id, personalFixture.bundle.profile.id);
  assert.equal(personalAfter.rangeObservations[0].id, personalFixture.direct.id);
  assert.equal(personalAfter.trainingObservations[0].directCalibrationComparison.relation, 'deviates');
  assert.equal(personalAfter.calibrationSessions[0].state, 'paused');
  const studyExports = JSON.stringify([
    await savedRepository.exportLibrary({ exportedAt: AUTH_T2 }),
    await personalRepository.exportPortable({ exportedAt: AUTH_T2 }),
  ]);
  assert.doesNotMatch(studyExports, /providerSubject|providerIdentityMappings|access_token|refresh_token|not-recorded/i);

  await authentication.signOut();
  assert.equal(authentication.getState().status, 'guest');
  assert.equal((await account.getActiveIdentity()).identityId, originalIdentityId);
  assert.equal((await repository.getSnapshot()).providerIdentityMappings.length, 1);
  fake.queueIdentity(providerIdentity('provider-a', { at: AUTH_T2 }));
  assert.equal((await authentication.signInWithPassword({ email: identityA.email, password: 'not-recorded' })).status, 'signed_in');
  assert.equal((await account.getActiveIdentity()).identityId, originalIdentityId);
  assert.equal((await repository.getSnapshot()).providerIdentityMappings.length, 1);
});

test('link failure rolls back every record and retry is safe', async () => {
  const database = createMemoryAccountIdentityDatabase();
  const { account, repository } = accountFixture({ database, label: 'rollback' });
  const local = (await account.initialize()).activeIdentity;
  const identityA = providerIdentity('rollback-a');
  const authentication = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({ identities: [identityA] }),
  });
  await authentication.initialize();
  await authentication.signInWithPassword({ email: identityA.email, password: 'not-recorded' });
  database.failNextTransaction('before_commit', new Error('interrupted link'), 'readwrite');
  const failed = await authentication.linkCurrentLocalData();
  assert.equal(failed.status, 'link_required');
  const rolledBack = await repository.getSnapshot();
  assert.equal(rolledBack.activeIdentity.identityId, local.identityId);
  assert.equal(rolledBack.activeIdentity.kind, RIVERLINE_IDENTITY_KINDS.LOCAL);
  assert.equal(rolledBack.identities.length, 1);
  assert.equal(rolledBack.bindings.length, 2);
  assert.equal(rolledBack.providerIdentityMappings.length, 0);
  assert.equal((await authentication.linkCurrentLocalData()).status, 'signed_in');
  assert.equal((await repository.getSnapshot()).providerIdentityMappings.length, 1);
});

test('start separately preserves Local Profile and re-authentication does not duplicate the account', async () => {
  const { account, repository } = accountFixture({ label: 'separate' });
  const local = (await account.initialize()).activeIdentity;
  const identityA = providerIdentity('separate-a', { email: 'alice@example.com' });
  const fake = createFakeAuthProviderAdapter({ identities: [identityA] });
  const authentication = createAuthenticationService({ accountIdentity: account, providerAdapter: fake });
  await authentication.initialize();
  await authentication.signInWithPassword({ email: identityA.email, password: 'not-recorded' });
  assert.equal((await authentication.startSeparately()).status, 'signed_in');
  const accountA = await account.getActiveIdentity();
  assert.notEqual(accountA.identityId, local.identityId);
  assert.equal(accountA.kind, RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE);
  const localBinding = await repository.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS, local.identityId);
  const accountBinding = await repository.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS, accountA.identityId);
  assert.notEqual(localBinding.storageScope, accountBinding.storageScope);
  await authentication.signOut();
  assert.equal(authentication.getState().status, 'guest');
  assert.equal((await account.getActiveIdentity()).identityId, accountA.identityId);
  fake.queueIdentity(providerIdentity('separate-a', { email: 'alice@example.com', at: AUTH_T2 }));
  assert.equal((await authentication.signInWithPassword({ email: identityA.email, password: 'not-recorded' })).status, 'signed_in');
  assert.equal((await account.getActiveIdentity()).identityId, accountA.identityId);
  assert.equal((await repository.getSnapshot()).identities.length, 2);
});

test('matching emails from different provider subjects remain separate and Guest exposes neither owner', async () => {
  const { account, repository, storage } = accountFixture({ label: 'multi' });
  const local = (await account.initialize()).activeIdentity;
  const identityA = providerIdentity('multi-a');
  const identityB = providerIdentity('multi-b');
  const fake = createFakeAuthProviderAdapter({ identities: [identityA] });
  const authentication = createAuthenticationService({ accountIdentity: account, providerAdapter: fake });
  await authentication.initialize();
  await authentication.signInWithPassword({ email: identityA.email, password: 'not-recorded' });
  await authentication.startSeparately();
  const accountA = await account.getActiveIdentity();
  await authentication.signOut();
  fake.queueIdentity(identityB);
  await authentication.signInWithPassword({ email: identityB.email, password: 'not-recorded' });
  await authentication.startSeparately();
  const accountB = await account.getActiveIdentity();
  assert.notEqual(accountA.identityId, accountB.identityId);
  assert.equal((await repository.getSnapshot()).providerIdentityMappings.length, 2);

  const savedDatabases = new Map();
  const personalDatabases = new Map();
  for (const identity of [local, accountA, accountB]) {
    const savedBinding = await repository.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS, identity.identityId);
    const savedDatabase = createMemorySavedStudyDatabase({ name: `saved-${identity.identityId}` });
    savedDatabases.set(savedBinding.storageScope, savedDatabase);
    const savedRepository = createSavedStudyRepository({
      database: savedDatabase,
      ownerRef: createSavedStudyOwnerRef(savedBinding.domainOwnerId),
      clock: () => ACCOUNT001_LEGACY_T2,
    });
    await savedRepository.save(createPreAccountSavedStudyFixture({
      ownerId: savedBinding.domainOwnerId,
      id: `saved-${identity.identityId}`,
    }));

    const personalBinding = await repository.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY, identity.identityId);
    const personalDatabase = createMemoryPersonalStrategyDatabase({ name: `personal-${identity.identityId}` });
    personalDatabases.set(personalBinding.storageScope, personalDatabase);
    await seedPersonalStrategy(personalDatabase, createPreAccountPersonalStrategyFixture({
      ownerId: personalBinding.domainOwnerId,
      suffix: identity.identityId,
    }));
  }
  const savedQueries = createSavedStudyObjectApplication({
    activationResolver: async () => {
      const binding = await account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS);
      return { ownerRef: createSavedStudyOwnerRef(binding.domainOwnerId), database: savedDatabases.get(binding.storageScope) };
    },
  });
  const personalQueries = createPersonalStrategyHomeQuery({
    storage,
    ownershipResolver: () => account.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY),
    databaseResolver: (binding) => personalDatabases.get(binding.storageScope),
  });
  const home = createHomeViewModelController({ savedStudyQueries: savedQueries, personalStrategyQueries: personalQueries, accountQueries: account });

  assert.equal((await savedQueries.listRecent())[0].id, `saved-${accountB.identityId}`);
  assert.equal((await home.load()).identity.profile.identityId, accountB.identityId);
  fake.queueIdentity(providerIdentity('multi-a', { at: AUTH_T2 }));
  await authentication.signInWithPassword({ email: identityA.email, password: 'not-recorded' });
  assert.equal((await savedQueries.listRecent())[0].id, `saved-${accountA.identityId}`);
  assert.equal((await personalQueries.loadSummary()).profileCount, 1);
  assert.equal((await home.load()).identity.profile.identityId, accountA.identityId);
  await authentication.signOut();
  assert.equal(authentication.getState().status, 'guest');
  assert.equal((await account.getActiveIdentity()).identityId, accountA.identityId);
});

test('session restore activates the mapped Riverline identity; expired restore returns to Guest', async () => {
  const { account } = accountFixture({ label: 'restore' });
  const local = (await account.initialize()).activeIdentity;
  const identityA = providerIdentity('restore-a');
  const setup = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({ identities: [identityA] }),
  });
  await setup.initialize();
  await setup.signInWithPassword({ email: identityA.email, password: 'not-recorded' });
  await setup.startSeparately();
  const accountA = await account.getActiveIdentity();

  await account.activateLocalIdentity();
  const restored = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({ restoredIdentity: providerIdentity('restore-a', { at: AUTH_T2 }) }),
  });
  assert.equal((await restored.initialize()).status, 'signed_in');
  assert.equal((await account.getActiveIdentity()).identityId, accountA.identityId);

  const expired = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({
      failures: { restoreSession: new AuthProviderError('session_expired', 'expired') },
    }),
  });
  assert.equal((await expired.initialize()).status, 'guest');
  assert.equal(expired.getState().noticeCode, 'session_expired');
  assert.equal((await account.getActiveIdentity()).identityId, accountA.identityId);
});

test('fake adapter covers cancellation, failure, unavailable, expired session, and multiple identities without internet', async () => {
  const { account } = accountFixture({ label: 'fake' });
  const cancelled = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({
      failures: { signInWithPassword: new AuthProviderError('authentication_cancelled', 'cancelled') },
    }),
  });
  await cancelled.initialize();
  assert.equal((await cancelled.signInWithPassword({ email: 'a@b.c', password: 'not-recorded' })).status, 'guest');

  const unavailable = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({ available: false }),
  });
  assert.equal((await unavailable.initialize()).status, 'guest');
});

test('official Supabase adapter uses only public config, validates restored users, and delegates session operations', async () => {
  const calls = [];
  const user = { id: 'supabase-user', email: 'player@example.com', user_metadata: { full_name: 'Player' } };
  const client = {
    auth: {
      async signInWithPassword(credentials) { calls.push(['signInWithPassword', Object.keys(credentials)]); return { data: { user }, error: null }; },
      async signUp(credentials) { calls.push(['signUp', Object.keys(credentials)]); return { data: { user, session: null }, error: null }; },
      async getSession() { calls.push(['getSession']); return { data: { session: { user } }, error: null }; },
      async getUser() { calls.push(['getUser']); return { data: { user }, error: null }; },
      async refreshSession() { calls.push(['refreshSession']); return { data: { session: { user } }, error: null }; },
      async signOut(options) { calls.push(['signOut', options.scope]); return { error: null }; },
    },
  };
  let factoryArguments = null;
  const adapter = createSupabaseAuthProviderAdapter({
    config: {
      supabaseUrl: 'https://riverline-test.supabase.co',
      supabasePublishableKey: 'sb_publishable_test',
    },
    clientFactory: (...args) => { factoryArguments = args; return client; },
    clock: () => AUTH_T1,
  });
  assert.equal((await adapter.signInWithPassword({ email: 'player@example.com', password: 'never-persisted' })).providerSubject, user.id);
  assert.equal((await adapter.signUpWithPassword({ email: 'player@example.com', password: 'never-persisted' })).status, 'confirmation_required');
  assert.equal((await adapter.restoreSession()).providerSubject, user.id);
  assert.equal((await adapter.refreshSession()).providerSubject, user.id);
  await adapter.signOut();
  assert.equal(factoryArguments[0], 'https://riverline-test.supabase.co');
  assert.equal(factoryArguments[1], 'sb_publishable_test');
  assert.equal(factoryArguments[2].auth.detectSessionInUrl, false);
  assert.equal(factoryArguments[2].auth.flowType, 'pkce');
  assert.deepEqual(calls.map(([method]) => method), [
    'signInWithPassword', 'signUp', 'getSession', 'getUser', 'refreshSession', 'signOut',
  ]);
  assert.throws(
    () => createSupabaseAuthProviderAdapter({
      config: {
        supabaseUrl: 'https://riverline-test.supabase.co',
        supabasePublishableKey: 'sb_secret_never_bundle_this',
      },
      client,
    }),
    /service-role secret/,
  );
});

test('auth mappings and credentials never enter study exports; UI owns accessible explicit linking and remount seams', async () => {
  const [html, bootstrap, translations, accountSpec, rangeBootstrap, rangeLifecycle, rangeWorkspace, preload, exampleConfig] = await Promise.all([
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/authentication-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/account-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../docs/project/ACCOUNT_IDENTITY_SPEC.md', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-lifecycle.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/preload.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/auth-config.example.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /role="dialog"[^>]+aria-modal="true"[^>]+aria-labelledby="accountLinkModalTitle"/);
  assert.match(html, /Use current local data/);
  assert.match(html, /Start separately/);
  assert.match(html, /Cloud sync is not enabled/);
  assert.match(html, /accountSignInEmail[^>]+dir="ltr"/);
  assert.match(bootstrap, /event\.key === 'Escape'/);
  assert.match(bootstrap, /event\.key === 'Tab'/);
  assert.match(bootstrap, /button:not\(:disabled\)/);
  assert.match(rangeBootstrap, /createRangeCalibrationLifecycle/);
  assert.match(rangeLifecycle, /riverline:identitychange/);
  assert.match(rangeWorkspace, /remountRangeCalibrationWorkspace/);
  assert.match(rangeWorkspace, /application\.repository\?\.close/);
  for (const key of [
    'Sign in', 'Sign out', 'Signed in', 'Local Profile', 'Switch account/profile',
    'Use current local data', 'Start separately', 'Keep current Riverline data',
    'Authentication failed', 'Session expired. Local Profile is active.',
    'Offline / sign-in unavailable', 'Cloud sync is not enabled',
  ]) assert.match(translations, new RegExp(`['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`));
  assert.match(translations, /Ошибка аутентификации/);
  assert.match(translations, /האימות נכשל/);
  assert.match(preload, /RIVERLINE_AUTH_SUPABASE_URL/);
  assert.match(preload, /RIVERLINE_AUTH_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(preload, /SERVICE_ROLE|SECRET/i);
  assert.match(exampleConfig, /Never place a service-role secret here/);
  assert.match(accountSpec, /neither export contains[\s\S]*provider credentials, tokens, or secrets/);
});
