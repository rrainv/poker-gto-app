import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import { bootApp } from './helpers/app-under-test.mjs';

// EXTRACT-HOME-001: the mounted Home controller's contract
// (mount(container, deps) -> { dispose, refreshLanguage, handleKey, setVisible })
// and the one-way dependency: the module never reaches for window.app or the
// page globals; everything comes through deps.

const app = await bootApp();
const $ = (selector) => app.$(selector);
const page = (code) => vm.runInThisContext(code);
const listenersOn = (node) => [...(node._listeners?.values() ?? [])].reduce((sum, list) => sum + list.length, 0);
// Code only: the header comment documents the deps by their page names.
const source = (await readFile(new URL('../app/src/application/home-workspace.mjs', import.meta.url), 'utf8'))
  .replace(/^\s*\/\/.*$/gm, '');

const model = (displayName) => ({
  sessionMode: 'account',
  identity: { profile: { displayName, username: 'dana' } },
  sync: { status: 'ready', state: 'synced' },
  sections: { continue: { status: 'ready', items: [] }, recent: { status: 'ready', items: [] }, review: {} },
});

function holdHomeLoads() {
  const descriptor = Object.getOwnPropertyDescriptor(app.window, 'RiverlineHome');
  const pending = [];
  Object.defineProperty(app.window, 'RiverlineHome', {
    ...descriptor,
    value: Object.freeze({ ...descriptor.value, load: () => new Promise((resolve) => pending.push(resolve)) }),
  });
  return { pending, restore: () => Object.defineProperty(app.window, 'RiverlineHome', descriptor) };
}

test('logic.js mounts one controller on #homeMode with the contract methods', async () => {
  await app.navigate('home');
  const controller = page('homeWorkspaceController');
  assert.ok(controller, 'mounted at init');
  for (const method of ['dispose', 'refreshLanguage', 'handleKey', 'setVisible', 'refresh', 'schedule', 'render', 'applyDestination', 'ownerChanged', 'getModel']) {
    assert.equal(typeof controller[method], 'function', method);
  }
  assert.equal(listenersOn($('#homeMode')), 1, 'one delegated click listener on the container');
  assert.equal(app.window.RiverlineHomeWorkspace.schemaVersion, 'home-workspace-controller/v1');
});

test('the module takes everything through deps', () => {
  assert.doesNotMatch(source, /window\.app\b|globalThis\.app\b/);
  // The only window use is installing the module's own frozen entry point.
  const windowUses = source.match(/\bwindow\.[A-Za-z]+/g) ?? [];
  assert.deepEqual([...new Set(windowUses)], []);
  assert.match(source, /Object\.defineProperty\(window, 'RiverlineHomeWorkspace'/);
  assert.match(source, /const document = container\.ownerDocument;/, 'DOM lookups go through the container document');
  assert.doesNotMatch(source, /globalThis\.document|\$\(/);
  assert.doesNotMatch(source, /calculateEquity|EquityService|StrategyProvider|resolveStrategy|PokerState|Matrix/);
});

test('handleKey consumes nothing; setVisible(false) is inert; setVisible(true) applies and reloads', async () => {
  const controller = page('homeWorkspaceController');
  assert.equal(controller.handleKey({ key: 'Enter', target: app.window.document.body }), false);
  const held = holdHomeLoads();
  try {
    controller.setVisible(false);
    assert.equal(held.pending.length, 0);
    controller.render(model('Shown'));
    controller.setVisible(true, { destination: 'home' });
    assert.equal(held.pending.length, 1, 'one load');
    assert.equal($('#homeWorkspaceContent').hidden, false, 'the last model stays shown while it loads');
    held.pending[0](model('Reloaded'));
    await app.flush();
    assert.equal($('#homeIdentityDisplayName').textContent, 'Reloaded');
  } finally {
    held.restore();
  }
});

test('refreshLanguage re-renders the last model only while Home is active', async () => {
  const controller = page('homeWorkspaceController');
  controller.render(model('Language'));
  $('#homeIdentityDisplayName').textContent = '';
  controller.refreshLanguage();
  assert.equal($('#homeIdentityDisplayName').textContent, 'Language');
  await app.navigate('analyze');
  $('#homeIdentityDisplayName').textContent = '';
  controller.refreshLanguage();
  assert.equal($('#homeIdentityDisplayName').textContent, '', 'no render while Home is hidden');
  await app.navigate('home');
});

test('dispose removes the click listener, cancels the timer and drops in-flight loads', async () => {
  const controller = page('homeWorkspaceController');
  await app.navigate('home');
  await app.settle(200);
  const held = holdHomeLoads();
  try {
    controller.render(model('Before dispose'));
    const timers = app.clock.pendingTimers();
    controller.schedule();
    assert.equal(app.clock.pendingTimers(), timers + 1, 'the refresh timer is armed');
    const inFlight = controller.refresh({ preserveVisible: true });
    assert.equal(held.pending.length, 1);

    controller.dispose();

    assert.equal(listenersOn($('#homeMode')), 0, 'the container keeps no listener');
    assert.equal(app.clock.pendingTimers(), timers, 'the timer is cancelled');
    assert.equal(controller.getModel(), null);
    held.pending[0](model('After dispose'));
    await inFlight;
    await app.flush();
    assert.equal($('#homeIdentityDisplayName').textContent, 'Before dispose', 'an in-flight load never renders');
    controller.schedule();
    await controller.refresh();
    assert.equal(held.pending.length, 1, 'a disposed controller never loads');
    controller.dispose();
    // Clicks inside Home no longer route anywhere.
    const spy = app.spy(['navigateToProductDestination']);
    try {
      controller.render(model('Dead'));
      await app.click('#homeContinueContent [data-home-destination="hand"]');
      assert.equal(spy.count('navigateToProductDestination'), 0);
    } finally {
      spy.restore();
    }
  } finally {
    held.restore();
  }
});

test('a fresh mount after dispose works again', async () => {
  page('homeWorkspaceController = null; mountHomeWorkspace();');
  const controller = page('homeWorkspaceController');
  assert.ok(controller);
  assert.equal(listenersOn($('#homeMode')), 1);
  await app.navigate('home');
  await app.settle(200);
  assert.ok(controller.getModel(), 'the new controller loads Home');
  const spy = app.spy(['navigateToProductDestination']);
  try {
    await app.click('#homeContinueContent [data-home-destination="hand"]');
    assert.deepEqual(spy.calls.navigateToProductDestination, [['hand']]);
  } finally {
    spy.restore();
  }
});
