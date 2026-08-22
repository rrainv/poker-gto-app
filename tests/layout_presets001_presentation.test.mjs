import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_LAYOUT,
  PRESENTATION_LAYOUT_STORAGE_KEY,
  WORKSPACE_LAYOUT_PRESETS,
  createPresentationLayoutController,
  getWorkspaceLayoutPresets,
  normalizePresentationLayout,
  resolveWorkspaceLayoutPreset,
} from '../app/src/application/presentation-layout.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
const presetCss = css.slice(css.indexOf('LAYOUT-PRESETS-001: first-class workspace composition'));

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

function fakeButton(preset) {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  return {
    dataset: { layoutPresetOption: preset },
    hidden: false,
    disabled: false,
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    setAttribute(name, value) { attributes.set(name, value); },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    click() { listeners.get('click')?.(); },
    classes,
    attributes,
  };
}

function fixture({ stored, workspace = 'hand', density = 'comfortable' } = {}) {
  const storage = new MemoryStorage(stored === undefined ? {} : {
    [PRESENTATION_LAYOUT_STORAGE_KEY]: typeof stored === 'string' ? stored : JSON.stringify(stored),
  });
  const buttons = Object.fromEntries([
    'balanced',
    'table-focus',
    'analysis-focus',
    'controls-first',
  ].map((preset) => [preset, fakeButton(preset)]));
  const control = { dataset: {}, hidden: true };
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const root = {
    dataset: { density },
    ownerDocument: { defaultView: { CustomEvent: FakeCustomEvent } },
    dispatchEvent(event) { events.push(event); },
  };
  const controller = createPresentationLayoutController({
    root,
    storage,
    buttons: Object.values(buttons),
    control,
    initialWorkspace: workspace,
  }).init();
  return { storage, buttons, control, events, root, controller };
}

test('Balanced is the default and invalid stored values are repaired safely', () => {
  assert.equal(DEFAULT_PRESENTATION_LAYOUT, 'balanced');
  assert.equal(normalizePresentationLayout(null), 'balanced');
  assert.equal(normalizePresentationLayout('configuration-first'), 'balanced');

  const missing = fixture();
  assert.equal(missing.root.dataset.layoutPreset, 'balanced');
  assert.equal(missing.root.dataset.layoutPresetPreference, 'balanced');
  assert.equal(missing.buttons.balanced.attributes.get('aria-pressed'), 'true');
  assert.deepEqual(missing.storage.writes, []);

  const invalid = fixture({ stored: 'legacy-layout' });
  assert.equal(invalid.controller.getPreset(), 'balanced');
  assert.equal(invalid.storage.getItem(PRESENTATION_LAYOUT_STORAGE_KEY), '{}');
});

test('preset switching applies immediately, persists, restores, and announces', () => {
  const view = fixture({ workspace: 'hand' });
  view.buttons['table-focus'].click();
  assert.equal(view.root.dataset.layoutPreset, 'table-focus');
  assert.equal(view.root.dataset.layoutPresetPreference, 'table-focus');
  assert.deepEqual(JSON.parse(view.storage.getItem(PRESENTATION_LAYOUT_STORAGE_KEY)), { hand: 'table-focus' });
  assert.equal(view.buttons['table-focus'].attributes.get('aria-pressed'), 'true');
  assert.equal(view.events.at(-1).type, 'riverline:layoutchange');
  assert.deepEqual(view.events.at(-1).detail, {
    preset: 'table-focus',
    preference: 'table-focus',
    workspace: 'hand',
    supportedPresets: WORKSPACE_LAYOUT_PRESETS.hand,
  });

  const restored = fixture({ stored: { training: 'table-focus' }, workspace: 'training' });
  assert.equal(restored.controller.getPreset(), 'table-focus');
  assert.equal(restored.buttons['table-focus'].classes.has('active'), true);
  assert.equal(restored.events.length, 0);
});

test('workspace support is curated and unsupported preferences fall back safely', () => {
  assert.deepEqual(getWorkspaceLayoutPresets('hand'), ['balanced', 'table-focus', 'controls-first']);
  assert.deepEqual(getWorkspaceLayoutPresets('analyze'), ['balanced', 'analysis-focus', 'controls-first']);
  assert.deepEqual(getWorkspaceLayoutPresets('training'), ['balanced', 'table-focus', 'controls-first']);
  assert.deepEqual(getWorkspaceLayoutPresets('personal-strategy'), ['balanced', 'analysis-focus']);
  assert.deepEqual(getWorkspaceLayoutPresets('equity'), ['balanced', 'analysis-focus', 'controls-first']);
  assert.deepEqual(getWorkspaceLayoutPresets('home'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('saved'), ['balanced']);
  assert.equal(resolveWorkspaceLayoutPreset('analysis-focus', 'hand'), 'balanced');

  const view = fixture({ stored: { hand: 'analysis-focus', analyze: 'analysis-focus' }, workspace: 'hand' });
  assert.equal(view.controller.getPreference(), 'balanced');
  assert.equal(view.controller.getPreset(), 'balanced');
  assert.deepEqual(JSON.parse(view.storage.getItem(PRESENTATION_LAYOUT_STORAGE_KEY)), {
    hand: 'balanced',
    analyze: 'analysis-focus',
  });
  assert.equal(view.buttons['analysis-focus'].hidden, true);

  view.controller.setWorkspace('analyze');
  assert.equal(view.controller.getPreset(), 'analysis-focus');
  assert.equal(view.buttons['analysis-focus'].hidden, false);

  view.controller.setWorkspace('home');
  assert.equal(view.controller.getPreset(), 'balanced');
  assert.equal(view.control.hidden, true, 'Home does not expose a meaningless preset selector');
});

test('each workspace restores its own preset from one preference record', () => {
  const view = fixture({ workspace: 'hand' });
  view.buttons['table-focus'].click();
  view.controller.setWorkspace('analyze');
  assert.equal(view.controller.getPreset(), 'balanced');
  view.buttons['analysis-focus'].click();
  view.controller.setWorkspace('equity');
  view.buttons['controls-first'].click();

  view.controller.setWorkspace('hand');
  assert.equal(view.controller.getPreset(), 'table-focus');
  view.controller.setWorkspace('analyze');
  assert.equal(view.controller.getPreset(), 'analysis-focus');
  view.controller.setWorkspace('equity');
  assert.equal(view.controller.getPreset(), 'controls-first');
  assert.deepEqual(JSON.parse(view.storage.getItem(PRESENTATION_LAYOUT_STORAGE_KEY)), {
    hand: 'table-focus',
    analyze: 'analysis-focus',
    equity: 'controls-first',
  });
});

test('layout and density remain independent presentation axes', () => {
  const compact = fixture({ workspace: 'hand', density: 'compact' });
  compact.buttons['table-focus'].click();
  assert.equal(compact.root.dataset.density, 'compact');
  assert.equal(compact.root.dataset.layoutPreset, 'table-focus');

  compact.root.dataset.density = 'comfortable';
  compact.buttons['controls-first'].click();
  assert.equal(compact.root.dataset.density, 'comfortable');
  assert.equal(compact.root.dataset.layoutPreset, 'controls-first');
  assert.doesNotMatch(presetCss, /data-density|density-collapse|control-height/);
});

test('Settings uses the existing presentation bootstrap with localized four-preset UX', () => {
  assert.match(html, /data-layout-preset="balanced"/);
  assert.match(html, /data-layout-preset-field hidden/);
  assert.match(html, /id="layoutPresetControl"[^>]+role="group"/);
  assert.equal((html.match(/data-layout-preset-option=/g) || []).length, 4);
  assert.match(bootstrap, /createPresentationDensityController/);
  assert.match(bootstrap, /createPresentationLayoutController/);
  assert.match(bootstrap, /storage: window\.localStorage/g);
  assert.match(bootstrap, /MutationObserver/);
  assert.doesNotMatch(bootstrap, /PokerState|StrategyProvider|Equity|Training/);

  for (const key of [
    'Workspace layout',
    'Changes emphasis and composition only. Density, poker state, and available tools stay the same.',
    'Balanced',
    'Table Focus',
    'Analysis Focus',
    'Controls First',
  ]) {
    assert.ok((translations.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) || []).length >= 2, `${key} is localized`);
  }
  assert.match(translations, /Компоновка рабочей области/);
  assert.match(translations, /פריסת סביבת העבודה/);
});

test('Hand and Analyze presets change composition rather than only maximum width', () => {
  assert.match(presetCss, /data-layout-preset="table-focus"[\s\S]*?data-product-destination="hand"[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(230px, 270px\)/);
  assert.match(presetCss, /data-layout-preset="table-focus"[\s\S]*?#visual-table-container[\s\S]*?max-width:\s*1100px/);
  assert.match(presetCss, /data-layout-preset="controls-first"[\s\S]*?#handStageDock:not\(\[hidden\]\)[\s\S]*?order:\s*3/);
  assert.match(presetCss, /data-layout-preset="analysis-focus"[\s\S]*?data-product-destination="analyze"[\s\S]*?grid-template-columns:\s*minmax\(230px, 250px\) minmax\(0, 1fr\) minmax\(210px, 235px\)/);
  assert.match(presetCss, /data-layout-preset="controls-first"[\s\S]*?data-product-destination="analyze"[\s\S]*?minmax\(340px, 380px\)/);
  assert.doesNotMatch(presetCss, /playbook[^\n{]*\{[^}]*display:\s*none/s);
});

test('Training, Personal Strategy, and Equity use meaningful supported compositions', () => {
  assert.match(presetCss, /grid-template-areas:\s*"decision setup insight"/);
  assert.match(presetCss, /grid-template-areas:\s*"setup decision insight"/);
  assert.match(presetCss, /calibration-personal-column[\s\S]*?order:\s*-1/);
  assert.match(presetCss, /equity-output-stack[\s\S]*?grid-column:\s*1[\s\S]*?max-width:\s*none/);
  assert.match(presetCss, /equity-controls-panel[\s\S]*?order:\s*-1/);
});

test('1024 uses the established safe stack and preset CSS remains RTL-neutral', () => {
  assert.match(presetCss, /@media \(min-width: 1320px\)/);
  assert.match(presetCss, /@media \(min-width: 1500px\)/);
  assert.doesNotMatch(presetCss, /@media \(max-width:/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?#gtoMode \.playbook-workspace[\s\S]*?flex-direction:\s*column/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?\.training-workspace,[\s\S]*?\.equity-workspace[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(presetCss, /direction\s*:|margin-left|margin-right|padding-left|padding-right|\bleft\s*:|\bright\s*:/);
});
