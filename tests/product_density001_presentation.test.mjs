import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_DENSITY,
  PRESENTATION_DENSITY_STORAGE_KEY,
  createPresentationDensityController,
  normalizePresentationDensity,
} from '../app/src/application/presentation-density.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
const densityStart = css.indexOf('PRODUCT-DENSITY-001: first-class presentation density');
const densityEnd = css.indexOf('LAYOUT-PRESETS-001: first-class workspace composition', densityStart);
const densityCss = css.slice(densityStart, densityEnd);

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

test('Settings exposes one simple first-class density control with EN RU HE labels', () => {
  assert.match(html, /<html[^>]+data-density="comfortable"/);
  assert.match(html, /id="densityControl"[^>]+role="group"/);
  assert.equal((html.match(/data-density-option=/g) || []).length, 2);
  assert.match(html, /data-density-option="comfortable"[^>]+aria-pressed="true"/);
  assert.match(html, /data-density-option="compact"[^>]+aria-pressed="false"/);
  assert.match(html, /presentation-density-bootstrap\.mjs/);

  for (const key of ['Workspace density', 'Comfortable', 'Compact', 'Details', 'Keyboard shortcuts', 'Calculation guidance']) {
    assert.match(translations, new RegExp(`"${key}"`));
  }
  assert.match(translations, /Плотность интерфейса/);
  assert.match(translations, /Комфортно/);
  assert.match(translations, /צפיפות הממשק/);
  assert.match(translations, /קומפקטית/);
});

test('Compact uses structural hierarchy across representative workspaces', () => {
  assert.match(densityCss, /\[data-density="comfortable"\]/);
  assert.match(densityCss, /\[data-density="compact"\][\s\S]*?--workspace-gutter:/);
  assert.match(densityCss, /--control-height:\s*40px/);
  assert.match(densityCss, /\.workspace-canvas[\s\S]*?--density-canvas/);
  assert.match(densityCss, /\.panel-head[\s\S]*?--density-panel/);
  assert.match(densityCss, /\.playbook-analysis-switcher-copy[\s\S]*?display:\s*none/);
  assert.match(densityCss, /\.hand-current-section-head > :first-child/);
  assert.match(densityCss, /\.training-session-panel/);
  assert.match(densityCss, /\.calibration-inspector-empty[\s\S]*?min-height:\s*0/);
  assert.match(densityCss, /\.equity-section-head \.equity-eyebrow/);
  assert.match(densityCss, /\.home-quick-link span[\s\S]*?display:\s*none/);
  assert.match(densityCss, /\.home-quick-links[\s\S]*?repeat\(3/);

  assert.match(html, /class="panel training-session-panel"[^>]+data-density-collapse-in-compact[^>]+open/);
  assert.match(html, /class="density-support-disclosure calibration-builder-shortcuts"[^>]+data-density-collapse-in-compact/);
  assert.match(html, /class="density-support-disclosure equity-method-disclosure"[^>]+data-density-collapse-in-compact/);
  assert.ok((html.match(/data-density-collapse-in-compact/g) || []).length >= 6);
});

test('Compact keeps primary controls, 1024 stacking, RTL, Matrix, and cards readable', () => {
  assert.match(densityCss, /@media \(max-width: 1100px\)[\s\S]*?\[data-density="compact"\]/);
  assert.match(densityCss, /@media \(max-width: 820px\)[\s\S]*?min-height:\s*48px/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.training-workspace,[\s\S]*?\.equity-workspace[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /\[dir="rtl"\] \.calibration-matrix-grid/);
  assert.match(css, /--range-matrix-cell:\s*clamp\(42px, 2\.75vw, 46px\)/);
  assert.doesNotMatch(densityCss, /--range-matrix-cell|--personal-matrix-cell|card-corner|font-size\s*:/);
  assert.doesNotMatch(densityCss, /direction\s*:|grid-template-areas\s*:/);
  assert.doesNotMatch(densityCss, /--control-height:\s*(?:3[0-9]|[0-2][0-9])px/);
  assert.doesNotMatch(densityCss, /\.mode-nav-item\s*\{\s*min-height:\s*(?:3[0-9]|4[0-3])px/);
  assert.match(css, /\.hand-action-dock \.hand-legal-actions \.ui-button[\s\S]*?min-height:\s*48px/);
});
