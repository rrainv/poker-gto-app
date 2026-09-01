import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSupabaseAuthProviderAdapter,
  getRiverlineSupabaseBrowserClient,
} from '../app/src/authentication/index.mjs';
import { createSupabaseRemoteSyncAdapter } from '../app/src/sync/index.mjs';

const CONFIG = Object.freeze({
  supabaseUrl: 'https://riverline-test.supabase.co',
  supabasePublishableKey: 'sb_publishable_test',
});

function harness() {
  const calls = [];
  let authSubscriptionCount = 0;
  const user = Object.freeze({ id: 'singleton-user', email: 'player@example.com' });
  const client = {
    auth: {
      async signInWithPassword() {
        calls.push('signInWithPassword');
        return { data: { user }, error: null };
      },
      async signUp() { return { data: { user, session: { user } }, error: null }; },
      async getSession() { return { data: { session: null }, error: null }; },
      async getUser() { return { data: { user }, error: null }; },
      async refreshSession() { return { data: { session: { user } }, error: null }; },
      async signOut() {
        calls.push('signOut');
        return { error: null };
      },
      onAuthStateChange() {
        authSubscriptionCount += 1;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
    from() {},
    async rpc(name) {
      calls.push(name);
      return { data: [], error: null };
    },
  };
  let createCount = 0;
  let factoryArguments = null;
  const clientFactory = (...args) => {
    createCount += 1;
    factoryArguments = args;
    return client;
  };
  return {
    calls,
    client,
    clientFactory,
    createCount: () => createCount,
    authSubscriptionCount: () => authSubscriptionCount,
    factoryArguments: () => factoryArguments,
  };
}

function acquire(browserWindow, setup, config = CONFIG) {
  return getRiverlineSupabaseBrowserClient({
    browserWindow,
    config,
    clientFactory: setup.clientFactory,
  });
}

test('Authentication then Saved sync share one browser-runtime Supabase client', async () => {
  const browserWindow = {};
  const setup = harness();
  const authenticationClient = acquire(browserWindow, setup);
  const savedSyncClient = acquire(browserWindow, setup);

  assert.equal(setup.createCount(), 1);
  assert.strictEqual(authenticationClient, setup.client);
  assert.strictEqual(savedSyncClient, authenticationClient);

  const authentication = createSupabaseAuthProviderAdapter({ config: CONFIG, client: authenticationClient });
  const savedSync = createSupabaseRemoteSyncAdapter({ client: savedSyncClient });
  await authentication.signInWithPassword({ email: 'player@example.com', password: 'not-stored' });
  await savedSync.pullChanges({
    domain: 'saved_study_objects',
    identityId: 'riverline-identity',
  });
  assert.deepEqual(setup.calls, ['signInWithPassword', 'pull_saved_study_objects_v1']);
});

test('Saved sync then Authentication still share exactly one client', () => {
  const browserWindow = {};
  const setup = harness();
  const savedSyncClient = acquire(browserWindow, setup);
  const authenticationClient = acquire(browserWindow, setup);

  assert.equal(setup.createCount(), 1);
  assert.strictEqual(authenticationClient, savedSyncClient);
});

test('equivalent and repeated acquisition is idempotent with the canonical Auth namespace', () => {
  const browserWindow = {};
  const setup = harness();
  const first = acquire(browserWindow, setup);
  const equivalent = acquire(browserWindow, setup, {
    supabaseUrl: 'https://riverline-test.supabase.co/some-ignored-path',
    supabasePublishableKey: '  sb_publishable_test  ',
  });
  const repeated = acquire(browserWindow, setup);

  assert.strictEqual(equivalent, first);
  assert.strictEqual(repeated, first);
  assert.equal(setup.createCount(), 1);
  assert.equal(
    setup.factoryArguments()[2].auth.storageKey,
    'riverline.auth.supabase.https___riverline-test.supabase.co.v1',
  );
  assert.deepEqual(setup.factoryArguments()[2].auth, {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storageKey: 'riverline.auth.supabase.https___riverline-test.supabase.co.v1',
  });
});

test('missing configuration creates no client and a new browser runtime owns a new client', () => {
  const setup = harness();
  assert.equal(getRiverlineSupabaseBrowserClient({
    browserWindow: {},
    config: null,
    clientFactory: setup.clientFactory,
  }), null);
  assert.equal(setup.createCount(), 0);

  acquire({}, setup);
  acquire({}, setup);
  assert.equal(setup.createCount(), 2);
});

test('material reconfiguration in one runtime is rejected instead of reusing the wrong client', () => {
  const browserWindow = {};
  const setup = harness();
  acquire(browserWindow, setup);

  assert.throws(
    () => acquire(browserWindow, setup, {
      ...CONFIG,
      supabasePublishableKey: 'sb_publishable_other',
    }),
    /does not support Supabase client reconfiguration/,
  );
  assert.equal(setup.createCount(), 1);
});

test('sign-in, sign-out, and sign-in reuse the client without adding an Auth subscription', async () => {
  const browserWindow = {};
  const setup = harness();
  const client = acquire(browserWindow, setup);
  const authentication = createSupabaseAuthProviderAdapter({ config: CONFIG, client });

  await authentication.signInWithPassword({ email: 'player@example.com', password: 'not-stored' });
  await authentication.signOut();
  await authentication.signInWithPassword({ email: 'player@example.com', password: 'not-stored' });

  assert.equal(setup.createCount(), 1);
  assert.equal(setup.authSubscriptionCount(), 0);
  assert.deepEqual(setup.calls, ['signInWithPassword', 'signOut', 'signInWithPassword']);
});
