import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp } from './helpers/app-under-test.mjs';

// EXTRACT-HOME-001: characterization of the Home workspace through the running
// app (bootApp), written BEFORE the Home code moved out of logic.js and kept
// unchanged after. It asserts observable behaviour only: the DOM, the page
// bridges Home calls (window.RiverlineHome, header, tutorials, shell hubs) and
// the page functions that stay in logic.js (navigation, Saved open, live hand).
// The Home bridge is replaced by a scripted fake so each load can be held,
// resolved late or failed on purpose.

const app = await bootApp();
const { createGuestHomeViewModel } = await import('../app/src/application/home-view-model.mjs');
const $ = (selector) => app.$(selector);
const win = app.window;
const root = win.document.documentElement;

const originals = new Map();
function override(name, changes) {
  if (!originals.has(name)) originals.set(name, win[name]);
  const base = originals.get(name);
  const copy = {};
  for (const key of Reflect.ownKeys(base ?? {})) copy[key] = base[key];
  Object.assign(copy, changes);
  Object.defineProperty(win, name, { configurable: true, enumerable: false, writable: false, value: Object.freeze(copy) });
}
function restore(name) {
  if (!originals.has(name)) return;
  Object.defineProperty(win, name, { configurable: true, enumerable: false, writable: false, value: originals.get(name) });
  originals.delete(name);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Scripted Home bridge: `load` returns the next queued result (a model, a
// deferred, or an Error), else the default model.
const bridge = {
  loads: 0,
  opens: [],
  queue: [],
  model: null,
  openImpl: null,
  reset(model) {
    this.loads = 0;
    this.opens = [];
    this.queue = [];
    this.model = model;
    this.openImpl = null;
  },
};
override('RiverlineHome', {
  schemaVersion: 'home-workspace/v1',
  load() {
    bridge.loads += 1;
    const next = bridge.queue.length ? bridge.queue.shift() : bridge.model;
    if (next instanceof Error) return Promise.reject(next);
    if (next?.promise) return next.promise;
    return Promise.resolve(next);
  },
  openSavedItem(id) {
    bridge.opens.push(id);
    return bridge.openImpl ? bridge.openImpl(id) : new Promise(() => {});
  },
});

function savedItem(id, overrides = {}) {
  return Object.freeze({
    schemaVersion: 'home-saved-item/v1',
    id,
    kind: 'hand',
    title: `Saved ${id}`,
    note: '',
    hasNote: false,
    tags: [],
    reviewState: 'none',
    isMistake: false,
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'flop',
    stackBb: 100,
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    ...overrides,
  });
}

function accountModel({
  displayName = 'Dana River',
  username = 'dana_river',
  sync = { status: 'ready', state: 'synced', enabled: true, pendingCount: 0, conflictCount: 0, errorCount: 0 },
  continueItems = [],
  recent = { status: 'ready', items: [savedItem('recent-1')] },
  reviewLater = { status: 'ready', items: [] },
  mistakes = { status: 'ready', items: [] },
  personalStrategy = { status: 'ready', selectedProfile: null, profileCount: 0 },
  destinations = ['hand', 'analyze', 'training', 'equity'],
} = {}) {
  return {
    schemaVersion: 'home-view-model/v2',
    sessionMode: 'account',
    identity: { status: 'ready', profile: { displayName, username } },
    sync,
    sections: {
      continue: { status: 'ready', items: continueItems },
      recent,
      review: { status: 'ready', reviewLater, mistakes },
      personalStrategy,
      quickStart: { status: 'ready', destinations },
      history: { status: 'unsupported', training: { status: 'unsupported' }, analysis: { status: 'unsupported' } },
    },
  };
}

async function goHome() {
  if ($('.riverline-shell').dataset.activeDestination !== 'home') await app.navigate('home');
  await app.settle(200);
}

async function showModel(model) {
  await goHome();
  bridge.reset(model);
  await app.call('refreshHomeWorkspace');
  await app.flush();
}

const text = (selector) => ($(selector)?.textContent || '').replace(/\s+/g, ' ').trim();

test.after(() => { for (const name of [...originals.keys()]) restore(name); });

test('returning account Home: identity, sync, Recent, Review and Continue empty state', async () => {
  await showModel(accountModel());
  assert.equal(bridge.loads, 1);
  assert.equal($('#homeWorkspace').getAttribute('aria-busy'), 'false');
  assert.equal($('#homeLoadingState').hidden, true);
  assert.equal($('#homeWorkspaceContent').hidden, false);
  assert.equal($('#homeWorkspaceContent').dataset.sessionMode, 'account');
  assert.equal($('#homeWorkspaceContent').dataset.hasContinuation, 'false');
  assert.equal($('#homeMode').dataset.productDestination, 'home');
  assert.equal($('#homeAccountOverview').hidden, false);
  assert.equal($('#homeGuestAccount').hidden, true);
  assert.equal(text('#homeIdentityDisplayName'), 'Dana River');
  assert.equal(text('#homeIdentityUsername'), '@dana_river');
  assert.equal($('#homeIdentityUsername').hidden, false);
  assert.equal(text('#homeSyncStatusLabel'), 'Synced');
  assert.equal(text('#homeSyncStatusDetail'), 'Enabled study data is up to date.');
  assert.equal($('#homeSyncStatus').dataset.state, 'synced');
  assert.equal($('#homeSyncReview').hidden, true);
  assert.equal($('#homeAccountOverview').getAttribute('data-tutorial-anchor'), 'home-overview');
  assert.equal($('#homeGuestAccount').hasAttribute('data-tutorial-anchor'), false);

  // Continue: first visit with nothing to resume offers Start a Hand (primary).
  assert.equal(text('#homeContinueTitle'), 'Start study');
  assert.equal(text('#homeContinueEyebrow'), 'Your next action');
  const start = $('#homeContinueContent [data-home-destination="hand"]');
  assert.equal(start.textContent, 'Start a Hand');
  assert.match(start.className, /ui-button--primary/);
  assert.equal(text('#homeContinueContent .home-empty-state p'), 'Play or reconstruct a legal hand.');

  // Recent: one row with kind, title, facts and an Open button.
  const rows = app.$$('#homeRecentContent .home-saved-item');
  assert.equal(rows.length, 1);
  assert.equal(text('#homeRecentContent .home-saved-item-kind'), 'Saved Hand');
  const title = $('#homeRecentContent .home-saved-item-title-row strong');
  assert.equal(title.textContent, 'Saved recent-1');
  assert.equal(title.dir, 'auto');
  const meta = $('#homeRecentContent .home-saved-item-meta');
  assert.equal(meta.dir, 'ltr');
  assert.ok(meta.classList.contains('poker-data-token'));
  const facts = [...meta.children].map((node) => node.textContent);
  assert.deepEqual(facts.slice(0, 4), ['6-handed', 'BTN', 'Flop', '100 bb']);
  assert.match(facts[4], /^Updated /);
  const open = $('#homeRecentContent [data-home-saved-id="recent-1"]');
  assert.equal(open.textContent, 'Open replay');
  assert.equal(open.getAttribute('aria-label'), 'Open replay: Saved recent-1');
  assert.match(open.className, /ui-button--secondary/);

  // Review: two groups with their empty lines; no Review Mistakes link.
  const groups = app.$$('#homeReviewContent .home-review-group');
  assert.deepEqual(groups.map((group) => group.querySelector('h3').textContent), ['Review later', 'Marked as a mistake']);
  assert.deepEqual(groups.map((group) => group.querySelector('.home-empty-state').textContent),
    ['Nothing marked for review.', 'No mistakes marked.']);
  assert.equal($('#homeReviewMistakesLink').hidden, true);
});

test('guest Home: guest panel, overview hidden, anchors move, unavailable lists show empty states', async () => {
  await showModel(createGuestHomeViewModel());
  assert.equal($('#homeWorkspaceContent').dataset.sessionMode, 'guest');
  assert.equal($('#homeGuestAccount').hidden, false);
  assert.equal($('#homeAccountOverview').hidden, true);
  assert.equal($('#homeGuestAccount').getAttribute('data-tutorial-anchor'), 'home-overview');
  assert.equal($('#homeAccountOverview').hasAttribute('data-tutorial-anchor'), false);
  assert.equal($('#homeGuestAccountEyebrow').dataset.i18n, 'Guest Mode');
  assert.equal(text('#homeGuestAccountEyebrow'), win.t('Guest Mode'));
  assert.equal(text('#homeGuestAccountTitle'), win.t('Riverline is ready to use'));
  assert.equal($('#homeGuestAccountTitle').dataset.i18n, 'Riverline is ready to use');
  assert.equal($('#homeGuestAccountPrimary').dataset.i18n, 'Analyze hands, train decisions, and calculate Equity without an account.');
  assert.equal($('#homeReviewContent').closest('.home-section').hidden, false);
  assert.equal($('#homeRecentContent').closest('.home-section').hidden, false);
  assert.equal(text('#homeRecentContent .home-empty-state p'), 'No saved study yet.');
  assert.equal($('#homeRecentContent [data-home-destination="analyze"]').textContent, 'Analyze a Hand');
  assert.match($('#homeRecentContent [data-home-destination="analyze"]').className, /ui-button--quiet/);
  assert.equal(app.$$('#homeReviewContent .home-empty-state').length, 2);
});

test('every sync branch: label, detail and the Review issue button', async () => {
  const cases = [
    [{ status: 'error', state: 'error' }, 'Sync issue', 'Study data remains available on this device.', true],
    [{ status: 'unavailable', state: 'unavailable' }, 'Saved on this device', 'Cloud study sync is unavailable.', false],
    [null, 'Saved on this device', 'Cloud study sync is unavailable.', false],
    [{ status: 'ready', state: 'conflict', conflictCount: 2 }, 'Conflict needs attention', '2 conflicts need review.', true],
    [{ status: 'ready', state: 'error' }, 'Sync issue', 'Study data remains available on this device.', true],
    [{ status: 'ready', state: 'syncing' }, 'Syncing', 'Updating your enabled study domains.', false],
    [{ status: 'ready', state: 'offline', pendingCount: 3 }, 'Offline', '3 changes waiting. They will sync when Riverline is online.', false],
    [{ status: 'ready', state: 'offline', pendingCount: 0 }, 'Offline', 'Study data remains available on this device.', false],
    [{ status: 'ready', state: 'synced' }, 'Synced', 'Enabled study data is up to date.', false],
    [{ status: 'ready', state: 'auth_paused' }, 'Sync paused', 'Sign in again to continue study sync.', false],
    [{ status: 'ready', state: 'disabled' }, 'Saved on this device', 'Cloud study sync is not enabled.', false],
  ];
  for (const [sync, label, detail, review] of cases) {
    await showModel(accountModel({ sync }));
    const name = JSON.stringify(sync);
    assert.equal(text('#homeSyncStatusLabel'), label, name);
    assert.equal(text('#homeSyncStatusDetail'), detail, name);
    assert.equal($('#homeSyncReview').hidden, !review, name);
    assert.equal($('#homeSyncStatus').dataset.state, sync?.state || 'unavailable', name);
  }
});

test('Continue: live hand, calibration, both (first primary) and their actions', async () => {
  const calibration = {
    kind: 'range_calibration', profileName: 'Live 9-max', modeName: 'Serious',
    context: { tableSize: 9 }, answeredCount: 12, totalCount: 169,
  };
  await showModel(accountModel({ continueItems: [calibration, { kind: 'live_hand' }] }));
  assert.equal(text('#homeContinueTitle'), 'Continue');
  assert.equal(text('#homeContinueEyebrow'), 'Pick up where you left off');
  assert.equal($('#homeWorkspaceContent').dataset.hasContinuation, 'true');
  const cards = app.$$('#homeContinueContent .home-calibration-card');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].querySelector('strong').textContent, 'Personal Strategy');
  assert.equal(cards[0].querySelectorAll('p')[0].textContent, 'Live 9-max · Serious · 9-handed');
  assert.equal(cards[0].querySelectorAll('p')[0].dir, 'auto');
  assert.equal(cards[0].querySelectorAll('p')[1].textContent, '12 of 169 directly answered');
  const resume = cards[0].querySelector('button');
  assert.equal(resume.textContent, 'Resume calibration');
  assert.equal(resume.dataset.homeDestination, 'personal-strategy');
  assert.match(resume.className, /ui-button--primary/);
  assert.ok(cards[1].classList.contains('home-live-hand-card'));
  assert.equal(cards[1].querySelector('strong').textContent, 'Live Hand');
  assert.equal(cards[1].querySelectorAll('p').length, 1);
  assert.equal(cards[1].querySelector('p').textContent, win.t('Your current in-memory hand is ready to continue.'));
  const liveButton = cards[1].querySelector('button');
  assert.equal(liveButton.dataset.homeAction, 'return-live-hand');
  assert.equal(liveButton.textContent, 'Return to live hand');
  assert.match(liveButton.className, /ui-button--secondary/);

  const spy = app.spy(['navigateToProductDestination', 'returnToHomeLiveHand']);
  try {
    await app.click(resume);
    assert.deepEqual(spy.calls.navigateToProductDestination, [['personal-strategy']]);
    await showModel(accountModel({ continueItems: [{ kind: 'live_hand' }] }));
    const only = $('#homeContinueContent [data-home-action="return-live-hand"]');
    assert.match(only.className, /ui-button--primary/, 'a lone live hand gets the primary action');
    spy.reset();
    await app.click(only);
    await app.settle(200);
    assert.equal(spy.count('returnToHomeLiveHand'), 1);
    assert.equal($('.riverline-shell').dataset.activeDestination, 'hand');
  } finally {
    spy.restore();
  }
});

test('Recent and Review states: error, spot rows, compact review rows, Review Mistakes link', async () => {
  const spot = savedItem('spot-1', { kind: 'spot', derivation: 'scenario', street: 'turn', potBb: 12, tags: ['3bet', 'oop', 'extra'], hasNote: true });
  const mistake = savedItem('mistake-1', { isMistake: true, reviewState: 'review_later' });
  await showModel(accountModel({
    recent: { status: 'error' },
    reviewLater: { status: 'ready', items: [spot] },
    mistakes: { status: 'ready', items: [mistake] },
    destinations: ['hand', 'analyze', 'review_mistakes'],
  }));
  assert.equal(text('#homeRecentContent .home-error-state'), 'Saved items could not be loaded.');
  const reviewRows = app.$$('#homeReviewContent .home-saved-item');
  assert.equal(reviewRows.length, 2);
  const spotOpen = reviewRows[0].querySelector('[data-home-saved-id="spot-1"]');
  assert.equal(spotOpen.textContent, 'Open spot');
  assert.match(spotOpen.className, /ui-button--quiet/);
  assert.equal(reviewRows[0].querySelector('.home-saved-item-kind').textContent, 'Saved Spot');
  const spotFacts = [...reviewRows[0].querySelectorAll('.home-saved-item-meta span')].map((node) => node.textContent);
  assert.deepEqual(spotFacts.slice(0, 6), ['6-handed', 'BTN', 'Turn', '100 bb', 'Pot 12 bb', 'Scenario']);
  const badges = [...reviewRows[0].querySelectorAll('.home-saved-badge')].map((node) => node.textContent);
  assert.deepEqual(badges, ['Note', '3bet · oop']);
  assert.equal(reviewRows[0].querySelector('.home-saved-badge:last-child').dir, 'auto');
  const mistakeBadges = [...reviewRows[1].querySelectorAll('.home-saved-badge')].map((node) => node.className);
  assert.deepEqual(mistakeBadges, ['home-saved-badge home-saved-badge--review', 'home-saved-badge home-saved-badge--mistake']);
  assert.equal($('#homeReviewMistakesLink').hidden, false);

  await showModel(accountModel({ reviewLater: { status: 'error' }, mistakes: { status: 'error' } }));
  assert.equal(app.$$('#homeReviewContent .home-error-state').length, 2);
  assert.equal($('#homeReviewMistakesLink').hidden, true);
});

test('Review Mistakes opens Saved with the mistakes filter', async () => {
  await showModel(accountModel({ mistakes: { status: 'ready', items: [savedItem('m-1', { isMistake: true })] }, destinations: ['review_mistakes'] }));
  const controller = app.evaluate('savedLibraryController');
  let filtered = 0;
  const wrapped = {};
  for (const key of Reflect.ownKeys(controller)) {
    const value = controller[key];
    wrapped[key] = typeof value === 'function' ? value.bind(controller) : value;
  }
  wrapped.showMistakesOnly = () => { filtered += 1; return controller.showMistakesOnly?.(); };
  app.window.__homeCharacterizationLibrary = wrapped;
  app.evaluate('savedLibraryController = window.__homeCharacterizationLibrary');
  const spy = app.spy(['navigateToProductDestination']);
  try {
    await app.click('#homeReviewMistakesLink');
    await app.settle(200);
    assert.deepEqual(spy.calls.navigateToProductDestination, [['saved']]);
    assert.equal(filtered, 1);
    assert.equal($('.riverline-shell').dataset.activeDestination, 'saved');
  } finally {
    spy.restore();
    app.window.__homeCharacterizationLibrary = controller;
    app.evaluate('savedLibraryController = window.__homeCharacterizationLibrary');
    delete app.window.__homeCharacterizationLibrary;
  }
});

test('Review issue opens the account panel; empty-state actions navigate', async () => {
  let opened = 0;
  override('RiverlineAuthentication', { openAccount: () => { opened += 1; } });
  const spy = app.spy(['navigateToProductDestination']);
  try {
    await showModel(accountModel({ sync: { status: 'ready', state: 'conflict', conflictCount: 1 }, recent: { status: 'ready', items: [] } }));
    await app.click('#homeSyncReview');
    assert.equal(opened, 1);
    await app.click('#homeRecentContent [data-home-destination="analyze"]');
    assert.deepEqual(spy.calls.navigateToProductDestination, [['analyze']]);
    assert.equal($('.riverline-shell').dataset.activeDestination, 'analyze');
  } finally {
    spy.restore();
    restore('RiverlineAuthentication');
  }
});

test('Saved reopen from Home: one bridge call, busy while pending, error toast, lifecycle fence', async () => {
  await showModel(accountModel());
  const open = () => $('#homeRecentContent [data-home-saved-id="recent-1"]');
  const pending = deferred();
  bridge.openImpl = () => pending.promise;
  const spy = app.spy(['openHomeSavedItem', 'navigateToWorkspace']);
  try {
    const button = open();
    await app.click(button);
    assert.deepEqual(bridge.opens, ['recent-1']);
    assert.equal(spy.count('openHomeSavedItem'), 1);
    assert.equal(spy.calls.openHomeSavedItem[0][0], 'recent-1');
    assert.equal(spy.calls.openHomeSavedItem[0][1], button);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    await app.click(button, { force: true });
    assert.equal(bridge.opens.length, 1, 'a busy Open ignores further clicks');
    pending.reject(new Error('not found'));
    await app.flush();
    assert.equal(button.disabled, false);
    assert.equal(button.hasAttribute('aria-busy'), false);
    assert.equal(text('#toast'), 'Saved item could not be opened.');

    // The owner changes while the open is in flight: the result is abandoned.
    const late = deferred();
    bridge.openImpl = () => late.promise;
    let generation = 1;
    const identity = originals.get('RiverlineAccountIdentity') ?? win.RiverlineAccountIdentity;
    override('RiverlineAccountIdentity', {
      getLifecycleState: () => ({ ...identity.getLifecycleState(), lifecycleGeneration: generation }),
    });
    spy.reset();
    await app.click(open());
    generation = 2;
    late.resolve({ kind: 'hand', object: { payload: {} } });
    await app.flush();
    assert.equal(spy.count('navigateToWorkspace'), 0);
    assert.equal($('.riverline-shell').dataset.activeDestination, 'home');
    assert.equal(open().disabled, false);
  } finally {
    spy.restore();
    restore('RiverlineAccountIdentity');
  }
});

test('imported-hand event outside an imported hand leaves Home alone', async () => {
  await showModel(accountModel());
  win.dispatchEvent(new win.Event('riverline:imported-hand-opened'));
  await app.flush();
  assert.equal($('.riverline-shell').dataset.activeDestination, 'home');
  assert.equal($('#homeWorkspaceContent').hidden, false);
});

test('fences: a load superseded by an owner change is never rendered', async () => {
  await showModel(accountModel({ displayName: 'Owner A' }));
  const first = deferred();
  bridge.reset(accountModel({ displayName: 'Owner B' }));
  bridge.queue.push(first);
  const refresh = app.call('refreshHomeWorkspace', { preserveVisible: true });
  assert.equal(bridge.loads, 1);
  // Sign-out / account switch: private Home content clears at once.
  win.dispatchEvent(new win.CustomEvent('riverline:identitychange', { detail: {} }));
  assert.equal($('#homeWorkspaceContent').hidden, true);
  assert.equal($('#homeLoadingState').hidden, false);
  assert.equal($('#homeWorkspace').getAttribute('aria-busy'), 'true');
  assert.equal($('#homeRecentContent').childElementCount, 0);
  assert.equal($('#homeReviewContent').childElementCount, 0);
  assert.equal($('#homeContinueContent').childElementCount, 0);
  first.resolve(accountModel({ displayName: 'Stale Owner A', recent: { status: 'ready', items: [savedItem('stale-a')] } }));
  await refresh;
  await app.flush();
  assert.equal($('#homeWorkspaceContent').hidden, true, 'the stale result does not show Home');
  assert.equal($('[data-home-saved-id="stale-a"]'), null);
  assert.notEqual(text('#homeIdentityDisplayName'), 'Stale Owner A');
  // The coalesced refresh after 80 ms renders the new owner.
  app.advance(79);
  await app.flush();
  assert.equal(bridge.loads, 1);
  app.advance(1);
  await app.flush();
  assert.equal(bridge.loads, 2);
  assert.equal(text('#homeIdentityDisplayName'), 'Owner B');
  assert.equal($('#homeWorkspaceContent').hidden, false);
});

test('fences: a stale failure is dropped, a current failure renders the error fallback', async () => {
  await showModel(accountModel({ displayName: 'Owner A' }));
  const stale = deferred();
  bridge.reset(accountModel({ displayName: 'Owner B' }));
  bridge.queue.push(stale);
  const refresh = app.call('refreshHomeWorkspace');
  win.dispatchEvent(new win.CustomEvent('riverline:identitychange', { detail: {} }));
  const errors = app.consoleErrors.length;
  stale.reject(new Error('stale failure'));
  await refresh;
  await app.flush();
  assert.equal(app.consoleErrors.length, errors, 'a superseded failure is not reported');
  app.advance(80);
  await app.flush();
  assert.equal(text('#homeIdentityDisplayName'), 'Owner B');

  bridge.reset(new Error('down'));
  await app.call('refreshHomeWorkspace');
  await app.flush();
  assert.equal(app.consoleErrors.at(-1)[0], '[Riverline Home]');
  assert.equal($('#homeWorkspaceContent').hidden, false);
  assert.equal(text('#homeRecentContent .home-error-state'), 'Saved items could not be loaded.');
  assert.equal(app.$$('#homeReviewContent .home-error-state').length, 2);
  assert.equal(text('#homeContinueTitle'), 'Start study');
  assert.equal($('#homeWorkspaceContent').dataset.sessionMode, 'account', 'the fallback has no session mode, so account panels stay');
});

test('fences: leaving Home before the load resolves discards the result', async () => {
  await showModel(accountModel({ displayName: 'Before' }));
  const late = deferred();
  bridge.reset(accountModel({ displayName: 'Before' }));
  bridge.queue.push(late);
  const refresh = app.call('refreshHomeWorkspace');
  assert.equal($('#homeWorkspaceContent').hidden, true, 'a fresh refresh shows the loading state');
  await app.navigate('analyze');
  late.resolve(accountModel({ displayName: 'Late', recent: { status: 'ready', items: [savedItem('late-1')] } }));
  await refresh;
  await app.flush();
  assert.equal($('[data-home-saved-id="late-1"]'), null);
  assert.notEqual(text('#homeIdentityDisplayName'), 'Late');
});

test('refresh timer: events coalesce into one load after 80 ms; preserveVisible keeps content', async () => {
  await showModel(accountModel());
  bridge.reset(accountModel({ displayName: 'Coalesced' }));
  for (const type of ['riverline:savedstudychange', 'riverline:personalstrategychange', 'riverline:studysyncchange']) {
    win.dispatchEvent(new win.CustomEvent(type, { detail: {} }));
    app.advance(30);
  }
  assert.equal(bridge.loads, 0);
  assert.equal($('#homeWorkspaceContent').hidden, false, 'a plain change keeps Home shown while it reloads');
  app.advance(50);
  await app.flush();
  assert.equal(bridge.loads, 1);
  assert.equal(text('#homeIdentityDisplayName'), 'Coalesced');

  bridge.reset(accountModel({ displayName: 'Preserved' }));
  const held = deferred();
  bridge.queue.push(held);
  const refresh = app.call('refreshHomeWorkspace', { preserveVisible: true });
  assert.equal($('#homeWorkspaceContent').hidden, false, 'preserveVisible keeps the last model shown');
  held.resolve(accountModel({ displayName: 'Preserved' }));
  await refresh;
  await app.flush();
  assert.equal(text('#homeIdentityDisplayName'), 'Preserved');
});

test('refresh timer: no refresh while away from Home or while the welcome orientation shows', async () => {
  await showModel(accountModel());
  await app.navigate('analyze');
  bridge.reset(accountModel());
  win.dispatchEvent(new win.CustomEvent('riverline:savedstudychange', { detail: {} }));
  app.advance(200);
  await app.flush();
  assert.equal(bridge.loads, 0, 'away from Home nothing loads');

  await goHome();
  bridge.reset(accountModel());
  const state = root.dataset.welcomeOrientation;
  root.dataset.welcomeOrientation = 'visible';
  try {
    win.dispatchEvent(new win.CustomEvent('riverline:savedstudychange', { detail: {} }));
    app.advance(200);
    await app.call('refreshHomeWorkspace');
    await app.flush();
    assert.equal(bridge.loads, 0, 'the welcome orientation blocks Home loads');
  } finally {
    root.dataset.welcomeOrientation = state;
  }
});

test('navigating to Home reloads once, keeping the last model shown', async () => {
  await showModel(accountModel({ displayName: 'Kept' }));
  await app.navigate('analyze');
  bridge.reset(accountModel({ displayName: 'Reloaded' }));
  const held = deferred();
  bridge.queue.push(held);
  await app.click('.mode-nav-item[data-navigation-id="home"]');
  assert.equal(bridge.loads, 1);
  assert.equal($('#homeWorkspaceContent').hidden, false);
  assert.equal(text('#homeIdentityDisplayName'), 'Kept');
  held.resolve(accountModel({ displayName: 'Reloaded' }));
  await app.settle(200);
  assert.equal(text('#homeIdentityDisplayName'), 'Reloaded');
  assert.equal(bridge.loads, 1);
});

test('language switch re-renders the last model without a second load (EN, RU, HE)', async () => {
  await showModel(accountModel({ sync: { status: 'ready', state: 'synced' } }));
  bridge.reset(accountModel());
  try {
    await app.setValue('#langToggle', 'ru');
    await app.settle(200);
    assert.equal(root.lang, 'ru');
    const ruLabel = text('#homeSyncStatusLabel');
    assert.notEqual(ruLabel, 'Synced');
    assert.equal(ruLabel, win.t('Synced'));
    assert.equal(app.$$('#homeReviewContent h3')[0].textContent, win.t('Review later'));
    await app.setValue('#langToggle', 'he');
    await app.settle(200);
    assert.equal(root.dir, 'rtl');
    assert.equal(text('#homeSyncStatusLabel'), win.t('Synced'));
    assert.equal($('#homeRecentContent .home-saved-item-meta').dir, 'ltr');
    assert.equal(bridge.loads, 0);
  } finally {
    await app.setValue('#langToggle', 'en');
    await app.settle(200);
  }
  assert.equal(text('#homeSyncStatusLabel'), 'Synced');
  assert.equal(bridge.loads, 0);
});

test('header: description, context and the Game/Approach chip', async () => {
  const calls = { setContext: [], setDescription: [], setPlayContext: [] };
  const header = originals.get('RiverlineWorkspaceHeader') ?? win.RiverlineWorkspaceHeader;
  override('RiverlineWorkspaceHeader', {
    setContext: (...args) => { calls.setContext.push(args); return header.setContext(...args); },
    setDescription: (...args) => { calls.setDescription.push(args); return header.setDescription(...args); },
    setPlayContext: (...args) => { calls.setPlayContext.push(args); return header.setPlayContext?.(...args); },
  });
  try {
    await showModel(createGuestHomeViewModel());
    assert.deepEqual(calls.setDescription.at(-1), ['home', 'Your learning workspace is saved on this device.']);
    assert.deepEqual(calls.setContext.filter(([id]) => id === 'home').at(-1), ['home', ['Guest Mode']]);
    assert.equal(calls.setPlayContext.length, 0);

    await showModel(accountModel({
      sync: { status: 'ready', state: 'offline', pendingCount: 0 },
      personalStrategy: { status: 'ready', selectedProfile: { id: 'p', displayName: 'Live 9-max' }, selectedMode: { id: 'm', displayName: 'Serious' } },
    }));
    assert.deepEqual(calls.setDescription.at(-1), ['home', 'Your saved study, review queue, and next useful action.']);
    assert.deepEqual(calls.setContext.filter(([id]) => id === 'home').at(-1), ['home', ['Dana River', 'Offline']]);
    assert.deepEqual(calls.setPlayContext.at(-1), [{ game: 'Live 9-max', approach: 'Serious' }]);

    calls.setPlayContext.length = 0;
    await showModel(accountModel({ displayName: '', personalStrategy: { status: 'error' } }));
    assert.deepEqual(calls.setContext.filter(([id]) => id === 'home').at(-1)[1][0], 'Riverline player');
    assert.equal(text('#homeIdentityDisplayName'), 'Riverline player');
    assert.equal(calls.setPlayContext.length, 0, 'no chip without a selected profile');
  } finally {
    restore('RiverlineWorkspaceHeader');
  }
});

test('destinations: Saved hides Home sections and the Study Inbox; hubs get the last model', async () => {
  const model = accountModel({ displayName: 'Hub model' });
  await showModel(model);
  assert.equal($('#studyInboxPanel').hidden, false);
  assert.equal($('#savedLibrarySection').hidden, true);
  await app.navigate('saved');
  assert.equal($('#homeMode').dataset.productDestination, 'saved');
  assert.equal($('#homeMode').dataset.i18nAriaLabel, 'Saved study');
  assert.equal($('#homeMode').getAttribute('aria-label'), win.t('Saved study'));
  assert.equal($('#homeWorkspaceContent').dataset.productDestination, 'saved');
  assert.equal($('#studyInboxPanel').hidden, true);
  assert.equal($('#savedLibrarySection').hidden, false);
  for (const id of ['#homeAccountOverview', '#homeGuestAccount']) assert.equal($(id).hidden, true, id);
  for (const id of ['#homeContinueContent', '#homeReviewContent', '#homeRecentContent']) {
    assert.equal($(id).closest('.home-section').hidden, true, id);
  }
  assert.equal($('#homeGuestAccountTitle').dataset.i18n, 'Saved Hands & Spots');

  await goHome();
  assert.equal($('#homeMode').dataset.i18nAriaLabel, 'Home dashboard');
  assert.equal($('#homeMode').getAttribute('aria-label'), win.t('Home dashboard'));
  assert.equal($('#studyInboxPanel').hidden, false);

  const hubCalls = [];
  const shell = originals.get('RiverlineShellNavigation') ?? win.RiverlineShellNavigation;
  override('RiverlineShellNavigation', {
    showHub: (destination, options) => { hubCalls.push([destination, options]); return shell.showHub(destination, options); },
  });
  try {
    bridge.reset(model);
    await app.call('refreshHomeWorkspace');
    await app.flush();
    await app.navigate('study');
    assert.equal(hubCalls.length, 1);
    assert.equal(hubCalls[0][0], 'study');
    assert.equal(hubCalls[0][1].homeModel, model);
    // A change event drops the cached model before the hub is shown again.
    await goHome();
    win.dispatchEvent(new win.CustomEvent('riverline:savedstudychange', { detail: {} }));
    await app.navigate('study');
    assert.equal(hubCalls.at(-1)[1].homeModel, null);
  } finally {
    restore('RiverlineShellNavigation');
  }
});

test('tours: Home and Saved anchors are present; Home offers its tour on render', async () => {
  const offers = [];
  const tutorials = originals.get('RiverlineTutorials') ?? win.RiverlineTutorials;
  override('RiverlineTutorials', {
    offerForWorkspace: (...args) => { offers.push(args); return tutorials.offerForWorkspace?.(...args); },
  });
  try {
    for (const model of [createGuestHomeViewModel(), accountModel()]) {
      await showModel(model);
      offers.length = 0;
      await app.call('refreshHomeWorkspace');
      await app.flush();
      assert.deepEqual(offers.map(([id]) => id), ['home']);
      assert.equal(offers[0][1], $('#homeWorkspace'));
      for (const anchor of ['home-overview', 'home-recent', 'home-study-inbox', 'shell-navigation', 'saved-workspace', 'home-review']) {
        assert.equal(app.$$(`[data-tutorial-anchor="${anchor}"]`).length, 1, anchor);
      }
      const overview = $('[data-tutorial-anchor="home-overview"]');
      assert.equal(overview.id, model.sessionMode === 'guest' ? 'homeGuestAccount' : 'homeAccountOverview');
      assert.equal($('[data-tutorial-anchor="saved-workspace"]').id, 'homeWorkspace');
    }
    await app.navigate('saved');
    offers.length = 0;
    bridge.reset(accountModel());
    await app.call('refreshHomeWorkspace');
    await app.flush();
    assert.deepEqual(offers.map(([id]) => id), ['saved']);
  } finally {
    restore('RiverlineTutorials');
    await goHome();
  }
});

test('PERF-001: one load per refresh and no strategy, Equity or Hand work when Home renders', async () => {
  await goHome();
  const spy = app.spy(['requestPlaybookMode', 'calculateEquity', 'updateContext', 'renderCanonicalHandWorkspace']);
  try {
    bridge.reset(accountModel({ continueItems: [{ kind: 'live_hand' }] }));
    await app.call('refreshHomeWorkspace');
    await app.flush();
    assert.equal(bridge.loads, 1);
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
  } finally {
    spy.restore();
  }
});
