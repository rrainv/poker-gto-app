import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import {
  WELCOME_ORIENTATION_DESTINATIONS,
  WELCOME_ORIENTATION_SCHEMA_VERSION,
  WELCOME_ORIENTATION_STORAGE_KEY,
  createWelcomeOrientationPreference,
  createWelcomeOrientationSession,
} from '../app/src/application/welcome-orientation.mjs';

const [html, css, bootstrap, prepaint, translations, i18n, logic] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-prepaint.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/welcome-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
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
  assert.match(html, /id="workspaceLearnButton"[^>]*data-i18n-aria-label="Learn Riverline"/);
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

test('prepaint selects Welcome before Home and the main init skips hidden Home work', () => {
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
  assert.equal(unseen.shell.dataset.activeMode, 'welcome');
  assert.equal(unseen.active['aria-current'], 'false');
  assert.match(logic, /else if \(activeWorkspaceMode\(\) !== 'welcome'\) updateContext\('Ready'\)/);
  assert.ok(html.indexOf('welcome-orientation-prepaint.js') < html.indexOf('styles.css'));
  assert.match(css, /data-welcome-orientation="unseen"\] \.workspace-canvas[\s\S]*display: none/);

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
  assert.equal(invalidTerminal.shell.dataset.activeMode, 'welcome');
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
  assert.match(css, /inset-inline-end/);
  assert.match(css, /padding-inline/);
  assert.doesNotMatch(css.slice(css.indexOf('WELCOME-INTRO-001')), /margin-left|margin-right|padding-left|padding-right/);
});

test('Welcome uses semantic headings, native buttons and checkbox, visible focus, and keyboard dismissal', () => {
  const welcome = html.slice(html.indexOf('id="welcomeOrientation"'), html.indexOf('class="shell workspace-canvas"'));
  assert.match(welcome, /<h1 id="welcomeTitle"/);
  assert.match(welcome, /<h2 id="welcomeJobsTitle"/);
  assert.equal((welcome.match(/class="welcome-job-card" type="button"/g) ?? []).length, 5);
  assert.match(welcome, /id="welcomeRememberChoice" type="checkbox"/);
  assert.match(welcome, /aria-labelledby="welcomeTitle" aria-describedby="welcomeDescription"/);
  assert.match(welcome, /id="welcomeOrientation"[^>]+tabindex="-1"/);
  assert.doesNotMatch(welcome, /id="welcomeTitle"[^>]+tabindex/);
  assert.match(css, /welcome-job-card:focus-visible/);
  assert.match(css, /welcome-preference:focus-within/);
  assert.match(bootstrap, /event\.key !== 'Escape'/);
  assert.match(bootstrap, /session\.dismiss/);
  assert.match(bootstrap, /clearNavigationSelection/);
  assert.match(bootstrap, /setAttribute\('aria-current', 'false'\)/);
  assert.doesNotMatch(bootstrap, /heading\?\.focus/);
});

test('five primary cards keep deliberate 3+2 wide and 2+2+1 constrained-desktop balance', () => {
  assert.match(css, /welcome-job-grid[\s\S]*grid-template-columns: repeat\(6/);
  assert.match(css, /welcome-job-card:nth-child\(n \+ 4\) \{ grid-column: span 3/);
  assert.match(css, /@media \(max-width: 1180px\)[\s\S]*welcome-job-grid \{ grid-template-columns: repeat\(2/);
  assert.match(css, /welcome-job-card:last-child \{ grid-column: 1 \/ -1/);
  assert.match(css, /width: min\(100%, 1420px\)/);
  assert.match(css, /@media \(max-height: 800px\) and \(min-width: 821px\)/);
});
