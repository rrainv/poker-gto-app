import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createWelcomeOrientationPreference,
  createWelcomeOrientationSession,
} from '../app/src/application/welcome-orientation.mjs';
import {
  createGuestHomeViewModel,
  createHomeViewModelController,
} from '../app/src/application/home-view-model.mjs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural. The app boots with the welcome orientation unseen (first use),
// and the shell, Home and navigation are exercised in the running app. The
// orientation bootstrap/prepaint and translation sources are outside this
// ticket.
const [bootstrap, prepaint, translations] = await Promise.all([
  readFile(new URL('../app/src/application/welcome-orientation-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-prepaint.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
]);

const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp({ oriented: false });
const root = app.document.documentElement;
const navItems = () => app.$$('.mode-nav-item[data-navigation-id]');
const selectedNav = () => navItems().filter((item) => item.classList.contains('active') || item.getAttribute('aria-current') === 'page');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('onboarding preference suppresses only orientation while Home remains the landing destination', () => {
  const preference = createWelcomeOrientationPreference({ storage: memoryStorage() });
  const routes = [];
  const session = createWelcomeOrientationSession({ preference, navigate: (route) => routes.push(route) });
  session.open();
  session.dismiss({ remember: true });
  assert.equal(preference.shouldShowOnStartup(), false);
  assert.deepEqual(routes, ['home']);
  const shell = markup.querySelector('.riverline-shell');
  assert.equal(shell.dataset.activeMode, 'home');
  assert.equal(shell.dataset.activeDestination, 'home');
  assert.equal(markup.querySelector('.mode-nav-item[data-navigation-id="home"]').getAttribute('aria-current'), 'page');
  assert.doesNotMatch(prepaint, /activeMode = 'welcome'|activeDestination = 'welcome'/);
  // First use: the orientation shows over Home, which stays the destination.
  assert.equal(root.dataset.welcomeOrientation, 'visible');
  assert.equal(app.byId('welcomeOrientation').hidden, false);
  assert.equal(app.$('.riverline-shell').dataset.activeMode, 'home');
  assert.ok(app.byId('homeMode').classList.contains('active'));
});

test('orientation has no false selected workspace and dismissal restores sensible focus without poker mutation', async () => {
  // Protects: while orientation is visible no navigation item is selected and
  // the shell never claims a 'welcome' destination; Home does not load
  // behind it; dismissing focuses Home navigation and touches no poker state.
  assert.equal(selectedNav().length, 0);
  for (const item of navItems()) assert.equal(item.getAttribute('aria-current'), 'false');
  assert.notEqual(app.$('.riverline-shell').dataset.activeMode, 'welcome');
  assert.notEqual(app.$('.riverline-shell').dataset.activeDestination, 'welcome');
  assert.doesNotMatch(bootstrap, /PokerState|requestPlaybookMode|TrainingSession|StrategyProvider/);
  assert.equal(app.call('welcomeOrientationIsVisible'), true);
  const homeLoad = app.spy(['callHomeBridge', 'beginHomeLoading']);
  try {
    await app.call('refreshHomeWorkspace');
    assert.equal(homeLoad.total(), 0, 'Home does not refresh behind the orientation');
  } finally {
    homeLoad.restore();
  }
  // The workspace canvas is not display:none'd behind the orientation.
  const canvas = app.$('.workspace-canvas');
  if (canvas) assert.notEqual(css.cascaded(canvas, 'display'), 'none');

  const state = { decisionContext: app.window.app.decisionContext, strategyResult: app.window.app.strategyResult };
  const spy = app.spy(['requestPlaybookMode', 'calculateEquity', 'refreshHomeWorkspace']);
  try {
    app.dispatch(app.byId('welcomeOrientation'), new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await app.settle(500);
    assert.equal(spy.count('requestPlaybookMode') + spy.count('calculateEquity'), 0);
  } finally {
    spy.restore();
  }
  assert.equal(root.dataset.welcomeOrientation, 'inactive');
  assert.equal(app.document.activeElement.dataset.navigationId, 'home');
  assert.equal(app.window.app.decisionContext, state.decisionContext);
  assert.equal(app.window.app.strategyResult, state.strategyResult);
  // Home now loads (the guest description is set once orientation is gone).
  assert.equal(app.window.RiverlineWorkspaceHeader.getDescription('home'), 'Your learning workspace is saved on this device.');
});

test('a rejected navigation aborts before any shared workspace transition', async () => {
  // Protects: when navigation is rejected (orientation visible), the click
  // handler returns before clearing toasts, switching mode views or
  // requesting a Playbook mode.
  await app.navigate('home');
  root.dataset.welcomeOrientation = 'visible';
  const views = app.$$('.mode-view').map((view) => [view.id, view.classList.contains('active'), view.style.display]);
  const spy = app.spy(['clearToast', 'requestPlaybookMode', 'restoreSharedPokerTable', 'syncSavedLibraryVisibility']);
  try {
    await app.click('.mode-nav-item[data-navigation-id="hand"]');
    assert.equal(spy.total(), 0, JSON.stringify(spy.sequence));
  } finally {
    spy.restore();
    root.dataset.welcomeOrientation = 'inactive';
  }
  assert.deepEqual(app.$$('.mode-view').map((view) => [view.id, view.classList.contains('active'), view.style.display]), views);
  assert.notEqual(app.$('.riverline-shell').dataset.activeDestination, 'hand');
});

test('inactive Hand has identity only and never receives pseudo-selection styling', () => {
  const hand = markup.querySelector('.mode-nav-item--hand');
  const peer = markup.querySelector('.mode-nav-item[data-navigation-id="training"]');
  assert.equal(hand.getAttribute('aria-current'), 'false');
  for (const property of ['background', 'background-color', 'border-color']) {
    assert.equal(css.cascaded(hand, property), css.cascaded(peer, property), property);
  }
  assert.equal(css.cascaded(hand.querySelector('.mode-nav-icon'), 'color'), 'var(--accent-secondary)');
  // Only the selected item gets the active surface (superseded token:
  // --surface-interactive became --navigation-active-surface).
  const active = markup.querySelector('.mode-nav-item[aria-current="page"]');
  assert.equal(css.cascaded(active, 'background'), 'var(--navigation-active-surface)');
  assert.notEqual(css.cascaded(hand, 'background'), css.cascaded(active, 'background'));
});

test('Guest Home exposes truthful Start, core study, Personal, and supporting destinations', async () => {
  const model = createGuestHomeViewModel();
  assert.deepEqual(model.sections.continue.items, []);
  assert.deepEqual(model.sections.quickStart.destinations, ['hand', 'analyze', 'training', 'equity']);
  assert.equal(model.sections.personalStrategy.status, 'unavailable');

  // SHELL-001 (owner decision): Home's Destinations panel duplicated the sidebar
  // and was removed. Every destination stays one click away in the sidebar,
  // exactly once, and Home no longer repeats them.
  const home = markup.getElementById('homeMode');
  const rail = markup.getElementById('modeRail');
  for (const destination of ['hand', 'analyze', 'training', 'equity', 'saved', 'home-game', 'guide']) {
    assert.equal(rail.querySelectorAll(`[data-navigation-id="${destination}"]`).length, 1, destination);
    assert.equal(home.querySelector(`[data-home-destination="${destination}"]`), null, destination);
  }
  assert.equal(home.querySelector('.home-quick-links, .home-quick-link, #homeQuickStartTitle'), null);
  // With nothing to continue, Home offers one primary Start a Hand action.
  await app.navigate('home');
  await app.settle(300);
  const empty = app.$('#homeContinueContent .home-empty-state');
  assert.equal(text(empty.querySelector('p')), 'Play or reconstruct a legal hand.');
  const start = empty.querySelector('button');
  assert.equal(text(start), 'Start a Hand');
  assert.equal(start.dataset.homeDestination, 'hand');
  assert.ok(start.classList.contains('ui-button--primary'));
  assert.equal(app.window.RiverlineWorkspaceHeader.getDescription('home'), 'Your learning workspace is saved on this device.');
  assert.match(text(markup.body), /Guest data does not sync\./);
});

test('Continue is derived only from authoritative resumable state and never fabricates recency', async () => {
  const withHand = createGuestHomeViewModel({ continuation: { hasLiveHand: true } });
  assert.deepEqual(withHand.sections.continue.items, [{
    schemaVersion: 'home-continue-item/v1',
    kind: 'live_hand',
  }]);
  assert.equal(JSON.stringify(createGuestHomeViewModel()).includes('recent hand'), false);
  const continueCopy = () => [text(app.byId('homeContinueEyebrow')), text(app.byId('homeContinueTitle'))];
  await app.navigate('home');
  await app.settle(300);
  assert.deepEqual(continueCopy(), ['Your next action', 'Start study']);
  await app.startHand(['As', 'Kd']);
  await app.navigate('home');
  await app.settle(300);
  assert.deepEqual(continueCopy(), ['Pick up where you left off', 'Continue']);
  assert.doesNotMatch(text(app.byId('homeContinueContent')), /streak|recommendation|last analyzed spot/i);
});

test('active Personal Strategy remains a truthful resumable continuation', async () => {
  const controller = createHomeViewModelController({
    savedStudyQueries: {
      listRecent: async () => [],
      listForReview: async () => [],
      listMistakes: async () => [],
    },
    personalStrategyQueries: {
      loadSummary: async () => ({
        profileCount: 1,
        selectedProfile: { id: 'profile-1', displayName: 'My strategy' },
        selectedMode: { id: 'mode-1', displayName: 'Cash' },
        context: { tableSize: 6 },
        answeredCount: 12,
        directEvidenceCount: 12,
        contradictionCount: 0,
        totalCount: 169,
        session: { state: 'active', updatedAt: '2026-08-30T12:00:00.000Z' },
        resumable: true,
      }),
    },
  });
  const model = await controller.load();
  assert.deepEqual(model.sections.continue.items.map((item) => item.kind), ['range_calibration']);
  assert.equal(model.sections.continue.items[0].profileName, 'My strategy');
  assert.equal(model.sections.continue.items[0].answeredCount, 12);
});

test('Home routes every visible job through the existing navigation registry', async () => {
  // Protects: every product destination is routable by the registry, and
  // Home's visible actions go through it.
  for (const destination of ['hand', 'analyze', 'training', 'personal-strategy', 'equity', 'saved', 'home-game', 'guide']) {
    app.call('navigateToProductDestination', destination);
    await app.settle(100);
    assert.equal(app.$('.riverline-shell').dataset.activeDestination, destination, destination);
  }
  app.call('navigateToProductDestination', 'home');
  await app.settle(300);
  const action = app.$$('#homeMode [data-home-destination]').find((node) => node.dataset.homeDestination !== 'review_mistakes');
  assert.ok(action, 'Home renders a destination action');
  const spy = app.spy(['navigateToProductDestination']);
  try {
    await app.click(action);
    assert.deepEqual(spy.calls.navigateToProductDestination, [[action.dataset.homeDestination]]);
  } finally {
    spy.restore();
  }
  await app.navigate('home');
});

test('1920 composition is top-packed and localized without equal-weight destination treatment', () => {
  // SHELL-001: the Destinations quick-link grid is gone; Home is one main
  // column and Continue keeps its top-packed minimum height at 1920.
  assert.equal(css.rulesMentioning('.home-quick-link').length + css.rulesMentioning('.home-quick-links').length, 0);
  const content = markup.getElementById('homeWorkspaceContent');
  const previous = content.dataset.productDestination;
  content.dataset.productDestination = 'home';
  assert.equal(css.cascaded(content, 'grid-template-columns', { width: 1920 }), 'minmax(0, 1fr)');
  if (previous === undefined) delete content.dataset.productDestination; else content.dataset.productDestination = previous;
  // Superseded: the 238px Continue floor (>=1500px) is reset by the later
  // Home main-flow rule; sections are content-height and top-packed.
  assert.equal(css.cascaded(markup.querySelector('.home-section--continue'), 'min-height', { width: 1920 }), '0');
  const link = markup.createElement('a');
  link.className = 'home-other-link';
  markup.getElementById('homeMode').appendChild(link);
  assert.equal(css.cascaded(link, 'min-height', { width: 1920 }), '54px');
  link.remove();
  for (const key of ['Start study', 'Start a Hand', 'Choose a workspace', 'More destinations', 'Play or reconstruct a legal hand.']) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((translations.match(new RegExp(`'${escaped}'`, 'g')) ?? []).length, 2, key);
  }
});
