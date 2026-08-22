import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  RIVERLINE_IDENTITY_KINDS,
  createAccountIdentityRepository,
  createMemoryAccountIdentityDatabase,
} from '../app/src/account-identity/index.mjs';
import {
  createMemoryAccountProfileRepository,
  normalizeAccountUsername,
} from '../app/src/account-profile/index.mjs';
import { createAccountIdentityService } from '../app/src/application/account-identity-service.mjs';
import { createAuthenticationService } from '../app/src/application/authentication-service.mjs';
import { installHomeWorkspaceBridge } from '../app/src/application/home-workspace-bootstrap.mjs';
import { createPersistentIdentityGate } from '../app/src/application/persistent-identity-gate.mjs';
import { installSavedStudyObjectBridge } from '../app/src/application/saved-study-object-bootstrap.mjs';
import {
  createAuthProviderIdentity,
  createFakeAuthProviderAdapter,
  createSupabaseAuthProviderAdapter,
} from '../app/src/authentication/index.mjs';

const T1 = '2026-08-17T10:00:00.000Z';
const T2 = '2026-08-17T10:01:00.000Z';

function identity(subject = 'account-002ar-user') {
  return createAuthProviderIdentity({
    provider: 'supabase',
    providerTenantId: 'riverline-test.supabase.co',
    providerSubject: subject,
    email: `${subject}@example.com`,
    displayName: 'Provider suggestion',
    authenticatedAt: T1,
  });
}

function accountFixture(label = 'guest') {
  let next = 0;
  const repository = createAccountIdentityRepository({
    database: createMemoryAccountIdentityDatabase(),
    clock: () => T1,
    idFactory: (prefix) => `${prefix}-${label}-${++next}`,
  });
  return {
    repository,
    account: createAccountIdentityService({ repository }),
  };
}

test('signed-out authentication is Guest Mode and hides legacy local identity from account UX', async () => {
  const { account, repository } = accountFixture('startup');
  const authentication = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: null,
  });
  const state = await authentication.initialize();
  assert.equal(state.status, 'guest');
  assert.equal(state.noticeCode, 'provider_not_configured');
  assert.equal(state.profile, null);
  assert.deepEqual(await authentication.getKnownIdentities(), []);
  const stored = await repository.getSnapshot();
  assert.equal(stored.identities.length, 1);
  assert.equal(stored.identities[0].kind, RIVERLINE_IDENTITY_KINDS.LOCAL);
});

test('profile-backed first sign-in claims legacy data explicitly and sign-out returns to Guest', async () => {
  const { account, repository } = accountFixture('claim');
  const providerIdentity = identity('claim-user');
  const profiles = createMemoryAccountProfileRepository({ clock: () => T2 });
  await profiles.createForProviderIdentity(providerIdentity, {
    username: 'river_player7',
    displayName: 'שחקן Riverline',
  });
  const authentication = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({ identities: [providerIdentity] }),
    profileRepository: profiles,
  });
  await authentication.initialize();
  const pending = await authentication.signInWithPassword({
    email: providerIdentity.email,
    password: 'not-exported',
  });
  assert.equal(pending.status, 'link_required');
  assert.equal(pending.profile.username, 'river_player7');
  const legacyId = (await repository.getSnapshot()).identities[0].identityId;
  const signedIn = await authentication.linkCurrentLocalData();
  assert.equal(signedIn.status, 'signed_in');
  assert.equal(signedIn.profile.riverlineIdentityId, legacyId);
  assert.equal((await repository.getSnapshot()).providerIdentityMappings.length, 1);
  const guest = await authentication.signOut();
  assert.equal(guest.status, 'guest');
  assert.equal(guest.profile, null);
  assert.equal((await repository.getSnapshot()).providerIdentityMappings.length, 1);
  assert.equal((await authentication.getKnownIdentities()).every(
    (entry) => entry.kind === RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE,
  ), true);
});

test('signup creates required normalized profile and supports Unicode display-name editing', async () => {
  const { account } = accountFixture('signup');
  const providerIdentity = identity('signup-user');
  const profiles = createMemoryAccountProfileRepository({ clock: () => T2 });
  const authentication = createAuthenticationService({
    accountIdentity: account,
    providerAdapter: createFakeAuthProviderAdapter({ identities: [providerIdentity] }),
    profileRepository: profiles,
  });
  await authentication.initialize();
  const pending = await authentication.signUpWithPassword({
    email: providerIdentity.email,
    password: 'not-exported',
    username: 'River_Player7',
    displayName: 'Игрок',
  });
  assert.equal(pending.status, 'link_required');
  assert.equal(pending.profile.username, 'river_player7');
  await authentication.startSeparately();
  const updated = await authentication.updateDisplayName('שחקנית');
  assert.equal(updated.profile.displayName, 'שחקנית');
  assert.equal((await profiles.getByProviderIdentity(providerIdentity)).displayName, 'שחקנית');
});

test('username contract is deterministic and memory repository enforces uniqueness', async () => {
  assert.equal(normalizeAccountUsername('Viktor_7'), 'viktor_7');
  for (const invalid of ['ab', '_starts_wrong', 'has space', 'riverline', 'way-too-long-username-12345']) {
    assert.throws(() => normalizeAccountUsername(invalid), RangeError);
  }
  const profiles = createMemoryAccountProfileRepository({ clock: () => T1 });
  await profiles.createForProviderIdentity(identity('one'), {
    username: 'same_name',
    displayName: 'One',
  });
  await assert.rejects(
    profiles.createForProviderIdentity(identity('two'), {
      username: 'SAME_NAME',
      displayName: 'Two',
    }),
    (error) => error.code === 'username_unavailable',
  );
});

test('persistent identity gate cancels safely and resumes the retained action exactly once', async () => {
  let authState = { status: 'guest' };
  const listeners = new Set();
  const authentication = {
    ready: async () => authState,
    getState: () => authState,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const gate = createPersistentIdentityGate({ authentication });
  let writes = 0;
  const cancelled = gate.requirePersistentIdentity({
    intent: 'save-study-object',
    resumeAction: async () => { writes += 1; },
  });
  await Promise.resolve();
  assert.equal(gate.getState().status, 'required');
  assert.equal(gate.cancelPendingIntent(), true);
  await assert.rejects(cancelled, (error) => error.code === 'persistent_identity_cancelled');
  assert.equal(writes, 0);

  const resumed = gate.requirePersistentIdentity({
    intent: 'save-study-object',
    resumeAction: async () => { writes += 1; return 'saved'; },
  });
  await Promise.resolve();
  authState = { status: 'signed_in' };
  listeners.forEach((listener) => listener(authState));
  assert.equal(await resumed, 'saved');
  listeners.forEach((listener) => listener(authState));
  await Promise.resolve();
  assert.equal(writes, 1);
});

test('Guest Save Spot cancellation writes nothing and authenticated resume saves the retained spot once', async () => {
  let authState = { status: 'guest' };
  const authListeners = new Set();
  const authentication = {
    ready: async () => authState,
    getState: () => authState,
    subscribe(listener) { authListeners.add(listener); return () => authListeners.delete(listener); },
  };
  const gate = createPersistentIdentityGate({ authentication });
  const storageWrites = [];
  const savedInputs = [];
  const browserWindow = {
    localStorage: {
      getItem: () => null,
      setItem: (key, value) => storageWrites.push([key, value]),
      removeItem: () => {},
    },
    RiverlineAuthentication: authentication,
    RiverlinePersistentIdentity: gate,
    RiverlinePlaybookState: {},
  };
  const application = {
    async saveHand() { throw new Error('This test owns a Scenario-derived spot'); },
    async saveScenarioDerivedSpot(input) {
      savedInputs.push(input);
      return { object: { id: input.operation.id }, created: true };
    },
    async getById() { return null; },
    async listRecent() { return []; },
    async listForReview() { return []; },
    async listMistakes() { return []; },
  };
  const saved = installSavedStudyObjectBridge(browserWindow, {
    application,
    persistentIdentityGate: gate,
    authentication,
    clock: () => T1,
  });
  const scenarioInput = Object.freeze({
    schemaVersion: 'playbook-scenario/v1',
    heroPosition: 'BTN',
    lastActionLabel: 'localized presentation only',
  });
  const decisionContext = Object.freeze({ schemaVersion: 'decision-context/v1' });

  const cancelled = saved.saveCurrent({ mode: 'scenario', scenarioInput, decisionContext });
  await Promise.resolve();
  assert.equal(gate.getState().status, 'required');
  assert.equal(gate.cancelPendingIntent(), true);
  await assert.rejects(cancelled, (error) => error.code === 'persistent_identity_cancelled');
  assert.deepEqual(savedInputs, []);
  assert.deepEqual(storageWrites, []);

  const resumed = saved.saveCurrent({ mode: 'scenario', scenarioInput, decisionContext });
  await Promise.resolve();
  authState = { status: 'signed_in' };
  authListeners.forEach((listener) => listener(authState));
  const result = await resumed;
  assert.equal(result.created, true);
  assert.equal(savedInputs.length, 1);
  assert.equal(savedInputs[0].scenarioInput, scenarioInput);
  assert.equal(savedInputs[0].decisionContext, decisionContext);
  assert.equal(storageWrites.length, 1);
  authListeners.forEach((listener) => listener(authState));
  await Promise.resolve();
  assert.equal(savedInputs.length, 1);
});

test('Guest Saved and Home boundaries do not query durable account-owned data', async () => {
  let durableCalls = 0;
  let gateCalls = 0;
  const authentication = { ready: async () => ({ status: 'guest' }), getState: () => ({ status: 'guest' }) };
  const browserWindow = {
    localStorage: {
      getItem: () => null,
      setItem: () => { throw new Error('Guest reference must not be written'); },
      removeItem: () => {},
    },
    RiverlineAuthentication: authentication,
    RiverlinePersistentIdentity: {
      requirePersistentIdentity: async () => {
        gateCalls += 1;
        const error = new Error('cancelled');
        error.code = 'persistent_identity_cancelled';
        throw error;
      },
    },
    RiverlineAccountIdentity: {
      getDomainOwnership: async () => { durableCalls += 1; throw new Error('must not query'); },
      getProfileSummary: async () => { durableCalls += 1; throw new Error('must not query'); },
    },
    RiverlinePlaybookState: {
      openSavedHand() {},
    },
  };
  const application = {
    saveHand: async () => { durableCalls += 1; },
    saveScenarioDerivedSpot: async () => { durableCalls += 1; },
    getById: async () => { durableCalls += 1; return null; },
    listRecent: async () => { durableCalls += 1; return []; },
    listForReview: async () => { durableCalls += 1; return []; },
    listMistakes: async () => { durableCalls += 1; return []; },
  };
  const saved = installSavedStudyObjectBridge(browserWindow, { application });
  assert.deepEqual(await saved.listRecent(), []);
  assert.equal(await saved.getById('hidden-account-item'), null);
  await assert.rejects(
    saved.saveCurrent({ mode: 'scenario' }),
    (error) => error.code === 'persistent_identity_cancelled',
  );
  assert.equal(gateCalls, 1);

  const home = installHomeWorkspaceBridge(browserWindow, {
    savedStudyQueries: saved,
    accountQueries: browserWindow.RiverlineAccountIdentity,
    personalStrategyQueries: {
      loadSummary: async () => { durableCalls += 1; throw new Error('must not query'); },
    },
    playbookBridge: browserWindow.RiverlinePlaybookState,
  });
  const model = await home.load();
  assert.equal(model.sessionMode, 'guest');
  assert.equal(model.sections.recent.status, 'unavailable');
  assert.deepEqual(model.sections.quickStart.destinations, ['hand', 'analyze', 'training', 'equity']);
  assert.equal(durableCalls, 0);
});

test('Supabase signup sends profile metadata but never exposes password outside Auth call', async () => {
  const calls = [];
  const user = { id: 'signup-user', email: 'signup@example.com', user_metadata: {} };
  const client = {
    auth: {
      async signUp(input) { calls.push(input); return { data: { session: { user }, user }, error: null }; },
      async signInWithPassword() { return { data: { user }, error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
      async getUser() { return { data: { user }, error: null }; },
      async refreshSession() { return { data: { user }, error: null }; },
      async signOut() { return { error: null }; },
    },
  };
  const adapter = createSupabaseAuthProviderAdapter({
    config: {
      supabaseUrl: 'https://riverline-test.supabase.co',
      supabasePublishableKey: 'sb_publishable_public',
    },
    client,
  });
  await adapter.signUpWithPassword({
    email: 'signup@example.com',
    password: 'trusted-auth-path-only',
    username: 'signup_user',
    displayName: 'Signup User',
  });
  assert.deepEqual(calls[0].options.data, {
    username: 'signup_user',
    username_normalized: 'signup_user',
    display_name: 'Signup User',
  });
  assert.equal(calls[0].password, 'trusted-auth-path-only');
  assert.doesNotMatch(JSON.stringify(calls[0].options.data), /password|secret|token/i);
});

test('profile migration and account UI expose RLS, ordered bootstraps, RTL islands, and no username-email directory', async () => {
  const [sql, html, bootstrap, savedBootstrap, homeBootstrap, profileRepository] = await Promise.all([
    readFile(new URL('../supabase/migrations/202608170001_account_profiles.sql', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/authentication-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/saved-study-object-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/home-workspace-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/account-profile/repository.mjs', import.meta.url), 'utf8'),
  ]);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /unique index[\s\S]+username_normalized/i);
  assert.match(sql, /auth\.uid\(\)[\s\S]+auth_user_id/i);
  assert.match(sql, /security definer set search_path = ''/i);
  assert.match(sql, /revoke all[\s\S]+from public, anon/i);
  assert.match(html, /id="accountMenuButton"[^>]+aria-expanded="false"/);
  assert.match(html, /id="accountMenu"[^>]+role="menu"/);
  assert.match(html, /id="accountProfileModal"[^>]+aria-modal="true"/);
  assert.match(html, /id="accountProfileUsername"[^>]+dir="ltr"/);
  assert.match(html, /id="accountSignInEmail"[^>]+dir="ltr"/);
  assert.match(bootstrap, /event\.key === 'Escape'/);
  assert.match(bootstrap, /event\.key === 'Tab'/);
  assert.match(bootstrap, /import '\.\/account-identity-bootstrap\.mjs'/);
  assert.match(savedBootstrap, /import '\.\/authentication-bootstrap\.mjs'/);
  assert.match(homeBootstrap, /import '\.\/saved-study-object-bootstrap\.mjs'/);
  assert.doesNotMatch(profileRepository, /select\([^)]*email|username[^\n]*email/i);
  assert.doesNotMatch(`${sql}\n${bootstrap}`, /service[_ -]?role|sb_secret_/i);
});
