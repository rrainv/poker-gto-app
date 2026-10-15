import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import {
  WELCOME_ORIENTATION_DESTINATIONS,
  WELCOME_ORIENTATION_SCHEMA_VERSION,
  WELCOME_ORIENTATION_STORAGE_KEY,
  createWelcomeOrientationPreference,
  createWelcomeOrientationSession,
} from '../app/src/application/welcome-orientation.mjs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, precedes } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: parsed markup, the cascade, and a first-use boot (Welcome
// unseen) of the app. Bootstrap, prepaint, translation, i18n, brand-mark and
// card-presentation sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const welcome = markup.getElementById('welcomeOrientation');
const app = await bootApp({ oriented: false });
// SOURCE-SHAPE: "the WELCOME-INTRO-001 block uses logical properties only"
// is a policy lint over the block as authored (parsed, not regex-matched); the
// cascade cannot tell a symmetric physical property from a logical one.
const welcomeSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  return new StyleSheetModel(raw.slice(raw.indexOf('WELCOME-INTRO-001')));
})();
const [bootstrap, prepaint, translations, i18n, brandMark, cardPresentation] = await Promise.all([
  readFile(new URL('../app/src/application/welcome-orientation-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-prepaint.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/welcome-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/assets/riverline-brand-mark.svg', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8'),
]);

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function preference(storage = new MemoryStorage()) {
  return createWelcomeOrientationPreference({
    storage,
    clock: () => '2026-08-24T12:00:00.000Z',
  });
}

test('unseen local and Guest users start on Welcome while a completed preference reloads to Home', () => {
  const storage = new MemoryStorage();
  const firstUse = preference(storage);
  assert.equal(firstUse.getState().status, 'unseen');
  assert.equal(firstUse.shouldShowOnStartup(), true);
  const completed = firstUse.complete('home');
  assert.equal(completed.schemaVersion, WELCOME_ORIENTATION_SCHEMA_VERSION);
  assert.equal(completed.localOwnerId, 'local');
  assert.equal(completed.status, 'completed');
  assert.equal(preference(storage).shouldShowOnStartup(), false);
  assert.match(bootstrap, /storage: options\.storage \?\? browserWindow\.localStorage/);
  assert.doesNotMatch(bootstrap, /Account|authchange|identity|Supabase|network|fetch\(/i);
});

test('Welcome suppression is opt-in while explicit saved choices remain authoritative', () => {
  const remember = welcome.querySelector('#welcomeRememberChoice');
  assert.equal(remember.localName, 'input');
  assert.equal(remember.type, 'checkbox');
  assert.equal(remember.hasAttribute('checked'), false);
  assert.match(bootstrap, /remember\.checked = false/);
  assert.doesNotMatch(bootstrap, /remember\.checked = true/);

  const freshStorage = new MemoryStorage();
  const freshSession = createWelcomeOrientationSession({
    preference: preference(freshStorage),
    navigate: () => {},
  });
  freshSession.open();
  freshSession.dismiss({ remember: false });
  assert.equal(freshStorage.getItem(WELCOME_ORIENTATION_STORAGE_KEY), null);
  assert.equal(preference(freshStorage).shouldShowOnStartup(), true);

  const suppressedStorage = new MemoryStorage();
  preference(suppressedStorage).dismiss();
  assert.equal(preference(suppressedStorage).shouldShowOnStartup(), false);
});

test('Riverline identity uses one canonical geometric brand spade without changing card suits', () => {
  assert.equal((brandMark.match(/<symbol id="riverlineBrandSpade"/g) ?? []).length, 1);
  assert.equal((brandMark.match(/<path d=/g) ?? []).length, 1);
  assert.match(brandMark, /M128 18C111 40/);
  assert.equal(markup.querySelectorAll('use').filter((use) => use.getAttribute('href') === 'assets/riverline-brand-mark.svg#riverlineBrandSpade').length, 2);
  const icon = markup.querySelector('link[rel="icon"]');
  assert.equal(icon.getAttribute('type'), 'image/svg+xml');
  assert.equal(icon.getAttribute('href'), 'assets/riverline-brand-mark.svg');
  assert.doesNotMatch(brandMark, /♠|<text\b/);
  assert.doesNotMatch(markup.head.outerHTML, /♠/);
  const paths = markup.querySelectorAll('path').map((path) => path.getAttribute('d') || '');
  assert.ok(!paths.some((d) => d.startsWith('M12 3c-2.2 3.2-6.5 5.7') || d.startsWith('M272.5 6.6c-9.3')), 'retired spade drawings');
  assert.equal(css.cascaded(markup.documentElement, '--brand-mark-compact-background'), 'var(--accent-primary)');
  assert.equal(css.cascaded(markup.documentElement, '--brand-mark-compact-foreground'), 'var(--surface-canvas)');
  assert.equal(css.cascaded(markup.querySelector('.rail-brand .brand-mark svg'), 'fill'), 'currentColor');
  assert.match(cardPresentation, /s: Object\.freeze\(\{ id: 's', symbol: '♠', name: 'spades' \}\)/);
});

test('explicit dismissal is terminal across reload and returns through the existing Home route', () => {
  const storage = new MemoryStorage();
  const routes = [];
  const localPreference = preference(storage);
  const session = createWelcomeOrientationSession({
    preference: localPreference,
    navigate: (destination) => routes.push(destination),
  });
  session.open();
  session.dismiss();
  assert.deepEqual(routes, ['home']);
  assert.equal(localPreference.getState().status, 'dismissed');
  assert.equal(preference(storage).shouldShowOnStartup(), false);
});

test('each primary job delegates once to the existing destination and persists completion', () => {
  const primary = ['hand', 'analyze', 'training', 'equity', 'personal-strategy'];
  for (const destination of primary) {
    const storage = new MemoryStorage();
    const routes = [];
    const localPreference = preference(storage);
    const session = createWelcomeOrientationSession({
      preference: localPreference,
      navigate: (route) => routes.push(route),
    });
    session.open();
    const result = session.choose(destination);
    assert.deepEqual(routes, [destination]);
    assert.equal(result.remembered, true);
    assert.equal(localPreference.getState().destination, destination);
    assert.equal(preference(storage).shouldShowOnStartup(), false);
  }
});

test('Home and Guide actions use the same navigation registry without duplicate workspace logic', () => {
  assert.deepEqual(WELCOME_ORIENTATION_DESTINATIONS, [
    'hand', 'analyze', 'training', 'equity', 'personal-strategy', 'home', 'guide', 'saved', 'home-game',
  ]);
  for (const destination of ['home', 'guide']) {
    const routes = [];
    const session = createWelcomeOrientationSession({
      preference: preference(),
      navigate: (route) => routes.push(route),
    });
    session.open();
    session.choose(destination);
    assert.deepEqual(routes, [destination]);
  }
  assert.match(bootstrap, /querySelectorAll\('\.mode-nav-item\[data-navigation-id\]'\)/);
  assert.match(bootstrap, /control\.click\(\)/);
  assert.doesNotMatch(bootstrap, /requestPlaybookMode|TrainingSession|EquityController|RangeCalibration|StrategyProvider/);
});

test('manual reopen preserves terminal status and closes back to its invoking workspace', () => {
  const localPreference = preference();
  localPreference.complete('training');
  const routes = [];
  const session = createWelcomeOrientationSession({
    preference: localPreference,
    navigate: (destination) => routes.push(destination),
  });
  assert.deepEqual(session.open({ manual: true }), { visible: true, entryKind: 'manual' });
  assert.equal(session.closeManual(), true);
  assert.deepEqual(routes, []);
  assert.equal(localPreference.getState().status, 'completed');
  assert.equal(markup.getElementById('workspaceLearnButton').dataset.i18nAriaLabel, 'Learn Riverline');
  assert.match(bootstrap, /\(manual \? closeButton : surface\)\?\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(bootstrap, /invoker\?\.focus\?\.\(\{ preventScroll: true \}\)/);
});

test('direct use of the existing navigation rail completes startup orientation without a second route', () => {
  const localPreference = preference();
  const routes = [];
  const session = createWelcomeOrientationSession({
    preference: localPreference,
    navigate: (destination) => routes.push(destination),
  });
  session.open();
  assert.equal(session.leaveForExternalNavigation('analyze'), true);
  assert.equal(session.getState().visible, false);
  assert.equal(localPreference.getState().destination, 'analyze');
  assert.deepEqual(routes, []);
});

test('unavailable or invalid local storage safely falls back to an unseen in-session preference', () => {
  const storage = new MemoryStorage();
  storage.setItem(WELCOME_ORIENTATION_STORAGE_KEY, '{broken');
  const recovered = preference(storage);
  assert.equal(recovered.shouldShowOnStartup(), true);
  assert.equal(recovered.diagnostics().recoveredInvalidState, true);
  assert.doesNotThrow(() => recovered.complete('hand'));
});

test('prepaint layers Welcome over recurring Home without selecting a false workspace', async () => {
  function execute(storedValue = null) {
    const root = { dataset: {} };
    const shell = { dataset: { activeMode: 'home', activeDestination: 'home' } };
    const active = { classList: { remove(value) { this.removed = value; } }, setAttribute(name, value) { this[name] = value; } };
    let ready = null;
    const document = {
      documentElement: root,
      addEventListener(name, callback) { if (name === 'DOMContentLoaded') ready = callback; },
      querySelector(selector) { return selector === '.riverline-shell' ? shell : null; },
      querySelectorAll() { return [active]; },
    };
    const storage = new MemoryStorage();
    if (storedValue) storage.setItem(WELCOME_ORIENTATION_STORAGE_KEY, JSON.stringify(storedValue));
    vm.runInNewContext(prepaint, { document, window: { localStorage: storage } });
    ready?.();
    return { root, shell, active, ready };
  }

  const unseen = execute();
  assert.equal(unseen.root.dataset.welcomeOrientation, 'unseen');
  assert.equal(unseen.shell.dataset.activeMode, 'home');
  assert.equal(unseen.shell.dataset.activeDestination, 'home');
  assert.equal(unseen.active['aria-current'], 'false');
  // A first-use boot leaves Home unloaded under the visible Welcome; leaving
  // Welcome for Home loads it once.
  assert.equal(app.call('welcomeOrientationIsVisible'), true);
  assert.equal(app.$('.riverline-shell').dataset.activeMode, 'home');
  assert.equal(app.evaluate('homeViewModel'), null);
  const spy = app.spy(['refreshHomeWorkspace', 'updateContext']);
  try {
    await app.click('[data-welcome-destination="home"]');
    await app.settle(500);
    assert.equal(app.call('welcomeOrientationIsVisible'), false);
    assert.equal(spy.count('refreshHomeWorkspace'), 1);
    assert.equal(spy.count('updateContext'), 0);
    assert.ok(app.evaluate('homeViewModel'));
  } finally {
    spy.restore();
  }
  const prepaintScript = markup.querySelector('script[src="src/application/welcome-orientation-prepaint.js"]');
  const stylesheet = markup.querySelectorAll('link[rel="stylesheet"]').find((link) => /^styles\.css/.test(link.getAttribute('href')));
  assert.ok(precedes(prepaintScript, stylesheet));
  // Welcome layers over the canvas rather than hiding it.
  markup.documentElement.dataset.welcomeOrientation = 'unseen';
  try {
    assert.notEqual(css.cascaded(markup.querySelector('.workspace-canvas'), 'display'), 'none');
  } finally {
    delete markup.documentElement.dataset.welcomeOrientation;
  }
  assert.equal(css.cascaded(welcome, 'position'), 'absolute');
  assert.equal(css.cascaded(welcome, 'z-index'), '40');

  const completed = execute({
    schemaVersion: WELCOME_ORIENTATION_SCHEMA_VERSION,
    localOwnerId: 'local',
    status: 'completed',
    completedAt: '2026-08-24T12:00:00.000Z',
    completionReason: 'destination_selected',
    destination: 'hand',
  });
  assert.equal(completed.root.dataset.welcomeOrientation, 'completed');
  assert.equal(completed.ready, null);
  assert.equal(completed.shell.dataset.activeMode, 'home');

  const invalidTerminal = execute({
    schemaVersion: WELCOME_ORIENTATION_SCHEMA_VERSION,
    localOwnerId: 'local',
    status: 'completed',
    completedAt: '2026-08-24T12:00:00.000Z',
    completionReason: 'destination_selected',
    destination: 'unknown-workspace',
  });
  assert.equal(invalidTerminal.root.dataset.welcomeOrientation, 'unseen');
  assert.equal(invalidTerminal.shell.dataset.activeMode, 'home');
});

test('Welcome copy is complete in EN, RU, and HE and uses logical RTL-safe composition', () => {
  const context = { window: {} };
  vm.runInNewContext(translations, context);
  const dictionaries = context.window.riverlineWelcomeTranslations;
  assert.deepEqual(Object.keys(dictionaries).sort(), ['en', 'he', 'ru']);
  const englishKeys = Object.keys(dictionaries.en).sort();
  assert.ok(englishKeys.length >= 25);
  assert.deepEqual(Object.keys(dictionaries.ru).sort(), englishKeys);
  assert.deepEqual(Object.keys(dictionaries.he).sort(), englishKeys);
  assert.match(i18n, /window\.riverlineWelcomeTranslations/);
  const properties = welcomeSheet.rules.flatMap((rule) => rule.declarations.map(({ property }) => property));
  assert.ok(properties.includes('inset-inline-end'));
  assert.ok(properties.some((property) => property.startsWith('padding-inline')));
  for (const property of properties) assert.doesNotMatch(property, /^(?:margin|padding)-(?:left|right)$/);
});

test('Welcome uses semantic headings, native buttons and checkbox, visible focus, and keyboard dismissal', async () => {
  assert.equal(welcome.querySelector('#welcomeTitle').localName, 'h1');
  assert.equal(welcome.querySelector('#welcomeJobsTitle').localName, 'h2');
  const cards = welcome.querySelectorAll('.welcome-job-card');
  assert.equal(cards.length, 4);
  for (const card of cards) {
    assert.equal(card.localName, 'button');
    assert.equal(card.getAttribute('type'), 'button');
  }
  assert.equal(welcome.querySelector('#welcomeRememberChoice').type, 'checkbox');
  const dialog = welcome.matches('[aria-labelledby="welcomeTitle"]') ? welcome : welcome.querySelector('[aria-labelledby="welcomeTitle"]');
  assert.equal(dialog.getAttribute('aria-describedby'), 'welcomeDescription');
  assert.equal(welcome.getAttribute('tabindex'), '-1');
  assert.equal(welcome.querySelector('#welcomeTitle').hasAttribute('tabindex'), false);
  // Visible focus: keyboard focus on a job card and focus inside the
  // preference each draw an outline; a hidden close button is not displayed.
  // (Welcome was left for Home by an earlier test: reopen it manually.)
  await app.click('#workspaceLearnButton');
  await app.settle(200);
  assert.equal(app.call('welcomeOrientationIsVisible'), true);
  const live = app.$('.welcome-job-card');
  live.focus();
  assert.equal(app.document.activeElement, live);
  assert.match(css.cascaded(live, 'outline', { states: ['focus-visible'] }), /solid/);
  assert.doesNotMatch(css.cascaded(live, 'outline') || '', /solid/, 'pointer focus draws no ring');
  const preference = app.$('.welcome-preference');
  app.$('#welcomeRememberChoice').focus();
  assert.match(css.cascaded(preference, 'outline'), /solid var\(--border-focus\)/);
  app.$('#welcomeRememberChoice').blur();
  assert.equal(css.cascaded(preference, 'outline'), undefined);
  const close = markup.querySelector('.welcome-close');
  assert.equal(close.hidden, true);
  assert.equal(css.cascaded(close, 'display'), 'none');
  // Escape closes a manually opened Welcome.
  await app.key(app.byId('welcomeOrientation'), 'Escape');
  await app.settle(200);
  assert.equal(app.call('welcomeOrientationIsVisible'), false);
  assert.match(bootstrap, /event\.key !== 'Escape'/);
  assert.match(bootstrap, /session\.dismiss/);
  assert.match(bootstrap, /clearNavigationSelection/);
  assert.match(bootstrap, /setAttribute\('aria-current', 'false'\)/);
  assert.doesNotMatch(bootstrap, /heading\?\.focus/);
});

test('one primary Home entry accompanies four smaller paths and secondary Equity', () => {
  assert.equal(welcome.querySelectorAll('.ui-button--primary').length, 1);
  const enter = welcome.querySelector('.ui-button--primary');
  assert.ok(enter.classList.contains('welcome-enter'));
  assert.equal(enter.dataset.welcomeDestination, 'home');
  assert.ok(welcome.querySelector('[data-welcome-destination="equity"]').classList.contains('ui-button--quiet'));
  const grid = welcome.querySelector('.welcome-job-grid');
  assert.match(css.cascaded(grid, 'grid-template-columns', { width: 1440 }), /^repeat\(4,/);
  assert.equal(css.cascaded(welcome.querySelector('.welcome-job-grid > .welcome-job-card'), 'grid-column', { width: 1440 }), 'auto');
  assert.equal(welcome.querySelector('.welcome-table-scene').getAttribute('aria-hidden'), 'true');
});
