import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_DENSITY,
  PRESENTATION_DENSITY_STORAGE_KEY,
  createPresentationDensityController,
  normalizePresentationDensity,
} from '../app/src/application/presentation-density.mjs';

import { StyleSheetModel, appStyleSheet, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css assertions are behavioural
// (parsed markup and the cascade under each density). Translation and
// bootstrap sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const root = markup.documentElement;
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
// SOURCE-SHAPE: the "Compact never alters Matrix geometry, card typography,
// font sizes, direction, grid areas or primary control/navigation sizing"
// guarantees are policy lints over the PRODUCT-DENSITY-001 block as authored
// (parsed, not regex-matched); "never declares" has no runtime observable.
const densitySheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('*/', raw.indexOf('PRODUCT-DENSITY-001: first-class presentation density')) + 2;
  return new StyleSheetModel(raw.slice(start, raw.lastIndexOf('/*', raw.indexOf('LAYOUT-PRESETS-001: first-class workspace composition'))));
})();
function withDensity(density, callback) {
  const previous = root.dataset.density;
  root.dataset.density = density;
  try { return callback(); } finally { root.dataset.density = previous; }
}
const both = (element, property, environment) => ['comfortable', 'compact'].map((density) => withDensity(density, () => css.cascaded(element, property, environment)));

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writes = [];
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
    this.writes.push([key, String(value)]);
  }
}

function fakeButton(density) {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  return {
    dataset: { densityOption: density },
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    setAttribute(name, value) { attributes.set(name, value); },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    click() { listeners.get('click')?.(); },
    classes,
    attributes,
  };
}

function fixture(stored) {
  const storage = new MemoryStorage(stored === undefined ? {} : {
    [PRESENTATION_DENSITY_STORAGE_KEY]: stored,
  });
  const comfortable = fakeButton('comfortable');
  const compact = fakeButton('compact');
  const support = { dataset: {}, open: true };
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const root = {
    dataset: {},
    ownerDocument: { defaultView: { CustomEvent: FakeCustomEvent } },
    dispatchEvent(event) { events.push(event); },
  };
  const controller = createPresentationDensityController({
    root,
    storage,
    buttons: [comfortable, compact],
    compactDisclosures: [support],
  }).init();
  return { storage, comfortable, compact, support, events, root, controller };
}

test('Comfortable is the safe default for missing and unknown values', () => {
  assert.equal(DEFAULT_PRESENTATION_DENSITY, 'comfortable');
  assert.equal(normalizePresentationDensity(null), 'comfortable');
  assert.equal(normalizePresentationDensity('legacy-dense'), 'comfortable');

  const missing = fixture();
  assert.equal(missing.root.dataset.density, 'comfortable');
  assert.equal(missing.comfortable.attributes.get('aria-pressed'), 'true');
  assert.equal(missing.support.open, true);
  assert.deepEqual(missing.storage.writes, []);

  const old = fixture('legacy-dense');
  assert.equal(old.root.dataset.density, 'comfortable');
  assert.equal(old.storage.getItem(PRESENTATION_DENSITY_STORAGE_KEY), 'comfortable');
});

test('switching density applies hierarchy immediately, persists, and restores support', () => {
  const view = fixture();
  view.compact.click();
  assert.equal(view.root.dataset.density, 'compact');
  assert.equal(view.compact.attributes.get('aria-pressed'), 'true');
  assert.equal(view.comfortable.attributes.get('aria-pressed'), 'false');
  assert.equal(view.storage.getItem(PRESENTATION_DENSITY_STORAGE_KEY), 'compact');
  assert.equal(view.events.at(-1).type, 'riverline:densitychange');
  assert.deepEqual(view.events.at(-1).detail, { density: 'compact' });
  assert.equal(view.support.open, false, 'Compact closes explicitly secondary content');
  assert.equal(view.support.dataset.densityAutoCollapsed, 'true');

  view.comfortable.click();
  assert.equal(view.root.dataset.density, 'comfortable');
  assert.equal(view.storage.getItem(PRESENTATION_DENSITY_STORAGE_KEY), 'comfortable');
  assert.equal(view.support.open, true, 'Comfortable restores supporting content');
  assert.equal(view.support.dataset.densityAutoCollapsed, undefined);
});

test('Compact restores through the same presentation preference authority', () => {
  const view = fixture('compact');
  assert.equal(view.controller.getDensity(), 'compact');
  assert.equal(view.root.dataset.density, 'compact');
  assert.equal(view.compact.classes.has('active'), true);
  assert.equal(view.support.open, false);
  assert.equal(view.events.length, 0, 'restoration does not announce a user-initiated change');
  assert.match(bootstrap, /storage: window\.localStorage/);
  assert.match(bootstrap, /document\.documentElement/);
  assert.match(bootstrap, /\[data-density-collapse-in-compact\]/);
  assert.doesNotMatch(bootstrap, /PokerState|StrategyProvider|Equity|Training/);
});

test('density remains an internal capability while Settings exposes no density choice', () => {
  assert.equal(root.dataset.density, 'comfortable');
  assert.equal(markup.querySelector('#densityControl, [data-density-option]'), null);
  assert.ok(markup.querySelectorAll('script[src]').some((script) => script.getAttribute('src').endsWith('presentation-density-bootstrap.mjs')));
  assert.match(bootstrap, /getDensity\(\) !== 'comfortable'[\s\S]*densityController\.apply\('comfortable', \{ announce: false \}\)/);

  for (const key of ['Workspace density', 'Comfortable', 'Compact', 'Details', 'Keyboard shortcuts', 'Calculation guidance']) {
    assert.match(translations, new RegExp(`"${key}"`));
  }
  assert.match(translations, /Плотность интерфейса/);
  assert.match(translations, /Комфортно/);
  assert.match(translations, /צפיפות הממשק/);
  assert.match(translations, /קומפקטית/);
});

test('Compact uses structural hierarchy across representative workspaces', () => {
  const body = markup.body;
  // Rhythm tokens differ between densities and drive canvas/panel spacing.
  const [comfortableGutter, compactGutter] = both(body, '--workspace-gutter', { width: 1440 });
  assert.notEqual(comfortableGutter, compactGutter);
  assert.match(compactGutter, /^clamp\(/);
  // Superseded: .workspace-canvas no longer pads with the density canvas
  // tokens (SHELL-001's canvas frame sets a fixed block padding); the tokens
  // still differ per density.
  const canvas = markup.querySelector('.workspace-canvas');
  assert.notDeepEqual(...both(canvas, '--density-canvas-block-start'));
  const head = markup.querySelector('.panel-head');
  assert.equal(css.cascaded(head, 'padding-inline-start') ?? css.cascaded(head, 'padding-left'), 'var(--density-panel-inline)');
  assert.notDeepEqual(...both(head, '--density-panel-inline'));
  // Superseded: the block's 40px Compact control height is overridden by
  // WORKSPACE-COMPOSITION-002's 38px Compact token.
  assert.deepEqual(both(body, '--control-height'), ['var(--control-height-md)', '38px']);
  // Compact hides repeated labels/overlines; Comfortable shows them.
  for (const selector of ['.playbook-analysis-switcher-copy', '.hand-current-section-head > :first-child', '.equity-section-head .equity-eyebrow']) {
    const node = markup.querySelector(selector);
    assert.ok(node, selector);
    const [comfortable, compact] = both(node, 'display');
    assert.equal(compact, 'none', selector);
    assert.notEqual(comfortable, 'none', selector);
  }
  const inspector = markup.createElement('div');
  inspector.className = 'calibration-inspector-empty';
  markup.body.appendChild(inspector);
  assert.equal(both(inspector, 'min-height')[1], '0');
  inspector.remove();
  const session = markup.querySelector('.training-session-panel');
  assert.equal(css.cascaded(session.querySelector(':scope > summary'), 'cursor'), 'pointer');
  // SHELL-001: Home's Destinations quick links were removed (owner decision).
  assert.equal(densitySheet.rulesMentioning('.home-quick-link').length, 0);

  assert.equal(session.localName, 'details');
  assert.ok(session.classList.contains('panel'));
  assert.ok(session.hasAttribute('data-density-collapse-in-compact'));
  assert.ok(session.hasAttribute('open'));
  for (const selector of ['.density-support-disclosure.calibration-builder-shortcuts', '.density-support-disclosure.equity-method-disclosure']) {
    const node = [markup, ...markup.querySelectorAll('template').map((template) => template.content)].map((scope) => scope.querySelector(selector)).find(Boolean);
    assert.ok(node?.hasAttribute('data-density-collapse-in-compact'), selector);
  }
  const collapsible = [markup, ...markup.querySelectorAll('template').map((template) => template.content)]
    .flatMap((scope) => scope.querySelectorAll('[data-density-collapse-in-compact]'));
  assert.ok(collapsible.length >= 6);
});

test('Compact keeps primary controls, 1024 stacking, RTL, Matrix, and cards readable', () => {
  const body = markup.body;
  assert.equal(both(body, '--workspace-gutter', { width: 1000 })[1], 'var(--space-4)');
  const navItem = markup.querySelector('.mode-nav-item');
  assert.equal(both(navItem, 'min-height', { width: 800 })[1], '48px');
  for (const selector of ['.training-workspace', '.equity-workspace']) {
    const node = markup.querySelector(selector);
    assert.equal(css.cascaded(node, 'flex-direction', { width: 1000 }), 'column', selector);
  }
  const grid = markup.createElement('div');
  grid.className = 'calibration-matrix-grid';
  markup.body.appendChild(grid);
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(grid, 'direction'), 'ltr');
  root.setAttribute('dir', 'ltr');
  grid.remove();
  assert.equal(css.cascaded(root, '--range-matrix-cell'), 'clamp(42px, 2.75vw, 46px)');
  // SOURCE-SHAPE (policy lint over densitySheet).
  const declarations = densitySheet.rules.flatMap((rule) => rule.declarations.map((declaration) => ({ ...declaration, rule })));
  for (const { property } of declarations) {
    assert.doesNotMatch(property, /^(?:--range-matrix-cell|--personal-matrix-cell|font-size|direction|grid-template-areas)$|card-corner/, property);
  }
  for (const { property, value } of declarations.filter(({ property }) => property === '--control-height')) {
    assert.ok(Number.parseFloat(value) >= 40, `${property}: ${value}`);
  }
  for (const { value, rule } of declarations.filter(({ property, rule }) => property === 'min-height' && rule.selectorText.includes('.mode-nav-item'))) {
    assert.ok(Number.parseFloat(value) >= 44, `${rule.selectorText}: ${value}`);
  }
  const dock = markup.createElement('div');
  dock.className = 'hand-action-dock';
  dock.innerHTML = '<div class="hand-legal-actions"><button class="ui-button">Fold</button></div>';
  markup.body.appendChild(dock);
  assert.ok(Number.parseFloat(css.cascaded(dock.querySelector('.ui-button'), 'min-height')) >= 48);
  dock.remove();
});
