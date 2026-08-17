import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createRangeCalibrationLifecycle } from '../app/src/application/range-calibration-lifecycle.mjs';

function eventWithDetail(type, detail = {}) {
  const event = new Event(type);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class CountingEventTarget extends EventTarget {
  constructor() {
    super();
    this.added = new Map();
  }

  addEventListener(type, listener, options) {
    this.added.set(type, (this.added.get(type) ?? 0) + 1);
    return super.addEventListener(type, listener, options);
  }
}

function fixture({
  status = 'signed_in',
  identityId = 'account-a',
  ready = Promise.resolve(),
  dataByIdentity = { 'account-a': { state: 'empty', records: [] } },
  failMount = null,
  mountGate = null,
} = {}) {
  const auth = { status };
  const identity = { value: identityId };
  const history = [];
  const repositories = [];
  let visible = 'unmounted';
  let controller = null;
  let selected = true;
  const authentication = {
    ready: () => ready,
    getState: () => auth,
  };
  const accountIdentity = {
    getActiveIdentityId: async () => identity.value,
  };
  const surface = {
    showLoading() { visible = 'loading'; history.push('loading'); },
    showGuest() { visible = 'guest'; history.push('guest'); },
    showError(error) { visible = 'error'; history.push(`error:${error?.code ?? 'load_failed'}`); },
    async mountAuthenticated({ identityId: owner }) {
      history.push(`mount-start:${owner}`);
      await mountGate;
      if (failMount) throw failMount;
      const repository = { owner, closed: false };
      repositories.push(repository);
      const data = dataByIdentity[owner] ?? { state: 'empty', records: [] };
      visible = data.state;
      controller = { owner, records: [...data.records] };
      history.push(`mount:${owner}:${data.state}`);
      return controller;
    },
    async disposeAuthenticated() {
      const active = repositories.findLast((entry) => !entry.closed);
      if (active) active.closed = true;
      controller = null;
      history.push(`dispose:${active?.owner ?? 'none'}`);
    },
    getController: () => controller,
  };
  const events = new CountingEventTarget();
  const navigation = new CountingEventTarget();
  const lifecycle = createRangeCalibrationLifecycle({
    authentication,
    accountIdentity,
    surface,
    eventTarget: events,
    navigationButton: navigation,
    isSelected: () => selected,
  });
  return {
    auth,
    identity,
    history,
    repositories,
    authentication,
    events,
    navigation,
    lifecycle,
    get visible() { return visible; },
    get controller() { return controller; },
    setSelected(value) { selected = value; },
  };
}

async function settleEvents() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test('authenticated account with no profile renders first-use instead of a blank mount', async () => {
  const app = fixture();
  await app.lifecycle.activate();
  assert.equal(app.visible, 'empty');
  assert.equal(app.lifecycle.getState().status, 'authenticated');
  assert.equal(app.controller.owner, 'account-a');
});

test('authenticated account with an existing session renders and resumes owner-scoped data', async () => {
  const app = fixture({
    dataByIdentity: {
      'account-a': { state: 'configured', records: ['profile-a', 'paused-session-a'] },
    },
  });
  await app.lifecycle.activate();
  assert.equal(app.visible, 'configured');
  assert.deepEqual(app.controller.records, ['profile-a', 'paused-session-a']);
});

test('reload-selected and navigation activation both reconcile to a visible workspace', async () => {
  const reload = fixture();
  assert.equal(reload.lifecycle.start(), true);
  await settleEvents();
  assert.equal(reload.visible, 'empty');

  const navigation = fixture();
  navigation.setSelected(false);
  navigation.navigation.addEventListener('click', () => navigation.setSelected(true));
  navigation.lifecycle.start();
  navigation.navigation.dispatchEvent(new Event('click'));
  await settleEvents();
  assert.equal(navigation.visible, 'empty');
});

test('identity switch disposes the old repository before mounting isolated new-owner data', async () => {
  const app = fixture({
    dataByIdentity: {
      'account-a': { state: 'configured', records: ['a-only'] },
      'account-b': { state: 'configured', records: ['b-only'] },
    },
  });
  app.lifecycle.start();
  await settleEvents();
  app.identity.value = 'account-b';
  app.events.dispatchEvent(eventWithDetail('riverline:identitychange', { reason: 'identity_activated' }));
  await settleEvents();
  assert.equal(app.repositories[0].owner, 'account-a');
  assert.equal(app.repositories[0].closed, true);
  assert.equal(app.controller.owner, 'account-b');
  assert.deepEqual(app.controller.records, ['b-only']);
  assert.ok(app.history.indexOf('dispose:account-a') < app.history.indexOf('mount:account-b:configured'));
});

test('identity invalidation during an in-flight mount disposes the stale repository before continuing', async () => {
  const mount = deferred();
  const app = fixture({
    mountGate: mount.promise,
    dataByIdentity: {
      'account-a': { state: 'configured', records: ['a-only'] },
      'account-b': { state: 'configured', records: ['b-only'] },
    },
  });
  const firstActivation = app.lifecycle.activate();
  await settleEvents();
  assert.ok(app.history.includes('mount-start:account-a'));
  app.identity.value = 'account-b';
  const switchedActivation = app.lifecycle.identityChanged();
  mount.resolve();
  await Promise.all([firstActivation, switchedActivation]);
  assert.equal(app.repositories[0].owner, 'account-a');
  assert.equal(app.repositories[0].closed, true);
  assert.equal(app.controller.owner, 'account-b');
  assert.deepEqual(app.controller.records, ['b-only']);
  assert.ok(app.history.indexOf('dispose:account-a') < app.history.indexOf('mount-start:account-b'));
});

test('Guest and authenticated transitions always render an intentional state', async () => {
  const app = fixture({ status: 'guest' });
  app.lifecycle.start();
  await settleEvents();
  assert.equal(app.visible, 'guest');
  assert.equal(app.repositories.length, 0);

  app.auth.status = 'signed_in';
  app.events.dispatchEvent(eventWithDetail('riverline:authchange', { status: 'signed_in' }));
  await settleEvents();
  assert.equal(app.visible, 'empty');

  app.auth.status = 'guest';
  app.events.dispatchEvent(eventWithDetail('riverline:authchange', { status: 'guest' }));
  await settleEvents();
  assert.equal(app.visible, 'guest');
  assert.equal(app.repositories[0].closed, true);
});

test('delayed initialization shows loading and then the correct authenticated surface', async () => {
  const initialization = deferred();
  const app = fixture({ ready: initialization.promise });
  const activation = app.lifecycle.activate();
  assert.equal(app.visible, 'loading');
  initialization.resolve();
  await activation;
  assert.equal(app.visible, 'empty');
});

test('initialization and repository failures render recoverable error states', async () => {
  const initializationError = Object.assign(new Error('auth unavailable'), { code: 'auth_init_failed' });
  const initialization = deferred();
  const authFailure = fixture({ ready: initialization.promise });
  const activation = authFailure.lifecycle.activate();
  initialization.reject(initializationError);
  await assert.rejects(activation, initializationError);
  assert.equal(authFailure.visible, 'error');
  assert.equal(authFailure.lifecycle.getState().errorCode, 'auth_init_failed');

  const repositoryError = Object.assign(new Error('database unavailable'), { code: 'open_failed' });
  const repositoryFailure = fixture({ failMount: repositoryError });
  await assert.rejects(repositoryFailure.lifecycle.activate(), repositoryError);
  assert.equal(repositoryFailure.visible, 'error');
});

test('repeated lifecycle start does not duplicate subscriptions and account data stays isolated', async () => {
  const app = fixture({
    dataByIdentity: {
      'account-a': { state: 'configured', records: ['private-a'] },
      'account-b': { state: 'configured', records: ['private-b'] },
    },
  });
  assert.equal(app.lifecycle.start(), true);
  assert.equal(app.lifecycle.start(), false);
  assert.equal(app.events.added.get('riverline:authchange'), 1);
  assert.equal(app.events.added.get('riverline:identitychange'), 1);
  await settleEvents();
  app.identity.value = 'account-b';
  app.events.dispatchEvent(eventWithDetail('riverline:identitychange', { reason: 'identity_activated' }));
  await settleEvents();
  assert.deepEqual(app.controller.records, ['private-b']);
  assert.doesNotMatch(JSON.stringify(app.controller), /private-a/);
});

test('production shell declares every non-blank state and keeps authenticated storage identity-scoped', async () => {
  const [html, css, bootstrap, workspace, translations] = await Promise.all([
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8'),
  ]);
  for (const id of [
    'calibrationLoadingState', 'calibrationGuestState', 'calibrationErrorState',
    'calibrationEmptyState', 'calibrationConfiguredState',
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(css, /\.calibration-account-required-state/);
  assert.match(bootstrap, /import '\.\/authentication-bootstrap\.mjs'/);
  assert.match(bootstrap, /createRangeCalibrationLifecycle/);
  assert.match(workspace, /createIdentityScopedRangeCalibrationApplication\(binding\)/);
  assert.doesNotMatch(workspace, /createRangeCalibrationApplication\(\)/);
  assert.match(workspace, /await application\?\.repository\?\.close\?\.\(\)/);
  for (const key of [
    'Account required',
    'Sign in to build and save your Personal Strategy',
    'Your account identity is still becoming available. Try again.',
  ]) assert.equal(translations.split(`'${key}':`).length, 3, `${key} must have RU and HE translations`);
});
