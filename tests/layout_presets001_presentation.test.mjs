import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_LAYOUT,
  PRESENTATION_LAYOUT_STORAGE_KEY,
  WORKSPACE_LAYOUT_DEFINITIONS,
  WORKSPACE_LAYOUT_PRESETS,
  createPresentationLayoutController,
  getWorkspaceLayoutDefinitions,
  getWorkspaceLayoutPresets,
  normalizePresentationLayout,
  resolveWorkspaceLayoutPreset,
} from '../app/src/application/presentation-layout.mjs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css assertions are behavioural
// (parsed markup, and the cascade with each preset applied to the document;
// Training is checked in the booted app, which restructures its columns).
// Translation and bootstrap sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const root = markup.documentElement;
const gto = markup.getElementById('gtoMode');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
// SOURCE-SHAPE: "preset CSS is RTL-neutral (no physical direction/margin/
// padding/left/right)" is a policy lint over the LAYOUT-PRESETS-001 block as
// authored (parsed, not regex-matched); the cascade cannot tell a physical
// property that happens to be symmetric from a logical one.
const presetSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  return new StyleSheetModel(raw.slice(raw.indexOf('LAYOUT-PRESETS-001: first-class workspace composition'), raw.indexOf('Surface styles relocated from the retired')));
})();
const PRESETS = ['balanced', 'table-focus', 'analysis-focus'];
function withPreset(preset, destination, callback) {
  const previous = [root.dataset.layoutPreset, gto.dataset.productDestination];
  root.dataset.layoutPreset = preset;
  if (destination) gto.dataset.productDestination = destination;
  try { return callback(); } finally { [root.dataset.layoutPreset, gto.dataset.productDestination] = previous; }
}
const LAYOUT_PROPERTIES = ['display', 'flex-direction', 'order', 'grid-template-columns', 'grid-template-areas', 'grid-area', 'grid-column', 'grid-row', 'position'];
const layoutOf = (elements, width) => elements.map((element) => LAYOUT_PROPERTIES.map((property) => css.cascaded(element, property, { width })).join('|'));

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
  assert.equal(restored.controller.getPreset(), 'balanced');
  assert.equal(restored.buttons.balanced.classes.has('active'), true);
  assert.equal(restored.control.hidden, true);
  assert.equal(restored.storage.getItem(PRESENTATION_LAYOUT_STORAGE_KEY), '{}');
  assert.equal(restored.events.length, 0);
});

test('workspace support is curated and unsupported preferences fall back safely', () => {
  assert.deepEqual(getWorkspaceLayoutPresets('hand'), ['balanced', 'table-focus']);
  assert.deepEqual(getWorkspaceLayoutPresets('analyze'), ['balanced', 'analysis-focus']);
  assert.deepEqual(getWorkspaceLayoutPresets('training'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('personal-strategy'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('equity'), ['balanced']);
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
  assert.equal(view.controller.getPreset(), 'balanced');

  view.controller.setWorkspace('hand');
  assert.equal(view.controller.getPreset(), 'table-focus');
  view.controller.setWorkspace('analyze');
  assert.equal(view.controller.getPreset(), 'analysis-focus');
  view.controller.setWorkspace('equity');
  assert.equal(view.controller.getPreset(), 'balanced');
  assert.deepEqual(JSON.parse(view.storage.getItem(PRESENTATION_LAYOUT_STORAGE_KEY)), {
    hand: 'table-focus',
    analyze: 'analysis-focus',
  });
});

test('layout and density remain independent presentation axes', () => {
  const compact = fixture({ workspace: 'hand', density: 'compact' });
  compact.buttons['table-focus'].click();
  assert.equal(compact.root.dataset.density, 'compact');
  assert.equal(compact.root.dataset.layoutPreset, 'table-focus');

  compact.root.dataset.density = 'comfortable';
  compact.buttons.balanced.click();
  assert.equal(compact.root.dataset.density, 'comfortable');
  assert.equal(compact.root.dataset.layoutPreset, 'balanced');
  assert.equal(PRESENTATION_LAYOUT_STORAGE_KEY, 'riverline_presentation_layout');
  assert.doesNotMatch(fs.readFileSync(new URL('../app/src/application/presentation-layout.mjs', import.meta.url), 'utf8'), /PRESENTATION_DENSITY|density-collapse/);
});

test('surviving presets have immutable, workspace-specific product jobs', () => {
  assert.equal(Object.isFrozen(WORKSPACE_LAYOUT_DEFINITIONS), true);
  for (const [workspace, definitions] of Object.entries(WORKSPACE_LAYOUT_DEFINITIONS)) {
    assert.equal(Object.isFrozen(definitions), true, `${workspace} definitions are immutable`);
    assert.deepEqual(definitions.map(({ preset }) => preset), getWorkspaceLayoutPresets(workspace));
    assert.equal(new Set(definitions.map(({ job }) => job)).size, definitions.length);
    for (const definition of definitions) {
      assert.equal(Object.isFrozen(definition), true);
      assert.ok(definition.job.length >= 40, `${workspace}/${definition.preset} has a precise job`);
    }
  }
  assert.deepEqual(getWorkspaceLayoutDefinitions('unsupported'), WORKSPACE_LAYOUT_DEFINITIONS.home);
});

test('Settings exposes only the three globally relevant preset labels', () => {
  const field = markup.querySelector('[data-layout-preset-field]');
  assert.equal(field.hidden, true);
  assert.equal(root.dataset.layoutPreset, 'balanced');
  const control = markup.getElementById('layoutPresetControl');
  assert.equal(control.getAttribute('role'), 'group');
  const options = markup.querySelectorAll('[data-layout-preset-option]').map((button) => button.dataset.layoutPresetOption);
  assert.deepEqual(options, ['balanced', 'table-focus', 'analysis-focus']);
  assert.match(bootstrap, /createPresentationDensityController/);
  assert.match(bootstrap, /createPresentationLayoutController/);
  assert.match(bootstrap, /storage: window\.localStorage/g);
  assert.match(bootstrap, /MutationObserver/);
  assert.doesNotMatch(bootstrap, /PokerState|StrategyProvider|Equity|Training/);
  // One row of equal, non-wrapping tabs; two columns at narrow widths.
  const tab = control.querySelector('.ui-tab');
  assert.equal(css.cascaded(control, 'display', { width: 1440 }), 'flex');
  assert.equal(css.cascaded(control, 'flex-wrap', { width: 1440 }), 'nowrap');
  assert.equal(css.cascaded(tab, 'flex', { width: 1440 }), '1 1 0');
  assert.equal(css.cascaded(tab, 'white-space', { width: 1440 }), 'nowrap');
  assert.equal(css.cascaded(control, 'display', { width: 600 }), 'grid');
  assert.match(css.cascaded(control, 'grid-template-columns', { width: 600 }), /^repeat\(2,/);

  for (const key of [
    'Workspace layout',
    'Changes emphasis and composition only. Density, poker state, and available tools stay the same.',
    'Balanced',
    'Table Focus',
    'Analysis Focus',
  ]) {
    assert.ok((translations.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) || []).length >= 2, `${key} is localized`);
  }
  assert.match(translations, /Компоновка рабочей области/);
  assert.match(translations, /פריסת סביבת העבודה/);
});

test('Hand and Analyze presets change composition rather than only maximum width', () => {
  const workspace = gto.querySelector('.playbook-workspace');
  const dock = markup.getElementById('handStageDock');
  const table = markup.getElementById('table-wrapper');
  // Hand Table Focus: decision first, then context; live facts precede the
  // table. (Superseded literals: HAND stage composition later pins the dock
  // to order 1 and the live table to order 5; the dock-before-table order is
  // the preserved guarantee.)
  withPreset('table-focus', 'hand', () => {
    assert.equal(css.cascaded(workspace, 'grid-template-areas', { width: 1440 }), '"decision context"');
    assert.ok(Number(css.cascaded(dock, 'order', { width: 1440 })) < Number(css.cascaded(table, 'order', { width: 1440 })));
  });
  withPreset('balanced', 'hand', () => assert.notEqual(css.cascaded(workspace, 'grid-template-areas', { width: 1440 }), '"decision context"'));
  // Analyze: Analysis Focus mirrors Balanced's spot rail / result columns.
  // (Superseded: the "decision support" row and the support-rail placement
  // were replaced by ANALYZE-COMPOSITION-001, which has no support rail in
  // Analyze in any preset.)
  const support = gto.querySelector('.playbook-support-rail');
  withPreset('balanced', 'analyze', () => {
    assert.equal(css.cascaded(workspace, 'grid-template-areas', { width: 1600 }), '"context decision"');
    assert.equal(css.cascaded(support, 'display', { width: 1600 }), 'none');
  });
  withPreset('analysis-focus', 'analyze', () => {
    assert.equal(css.cascaded(workspace, 'grid-template-areas', { width: 1600 }), '"decision context"');
    assert.equal(css.cascaded(support, 'display', { width: 1600 }), 'none');
  });
  assert.equal(markup.querySelector('[data-layout-preset-option="controls-first"]'), null);
  assert.doesNotMatch(markup.body.textContent, /Controls First/);
  // Presets never hide a Playbook surface that Balanced shows.
  const surfaces = gto.querySelectorAll('[class*="playbook"], #handStageDock, #table-wrapper');
  for (const destination of ['hand', 'analyze']) {
    for (const width of [1440, 1600]) {
      const balanced = withPreset('balanced', destination, () => surfaces.map((element) => css.cascaded(element, 'display', { width })));
      for (const preset of PRESETS) {
        withPreset(preset, destination, () => surfaces.forEach((element, index) => {
          if (balanced[index] !== 'none') assert.notEqual(css.cascaded(element, 'display', { width }), 'none', `${preset}/${destination}@${width}: ${element.id || element.className}`);
        }));
      }
    }
  }
});

test('Training and Equity use meaningful Balanced compositions without hidden layout variants', async () => {
  // No preset changes any rule that applies to Training, Equity or Range
  // Calibration surfaces.
  const surfaces = ['#trainingMode', '#equityMode', '#calibrationMode']
    .flatMap((selector) => [markup.querySelector(selector), ...markup.querySelectorAll(`${selector} [class*="workspace"], ${selector} [class*="panel"], ${selector} [class*="column"]`)]);
  assert.ok(surfaces.length > 20);
  for (const width of [1440, 1600]) {
    const rulesFor = () => surfaces.map((element) => css.matchingRules(element, { width }).map((rule) => rule.order).join(','));
    const balanced = withPreset('balanced', 'hand', rulesFor);
    for (const preset of PRESETS) assert.deepEqual(withPreset(preset, 'analyze', rulesFor), balanced, `${preset}@${width}`);
  }
  // Training's Balanced composition: a decision column and an insight rail.
  // (Superseded: the 12-column grid with per-panel column placements was
  // replaced by TRAINING-COMPOSITION-001's two-column decision/insight grid,
  // into which the running app gathers the panels as a study rail.)
  const app = await bootApp({ width: 1440 });
  await app.navigate('training');
  const training = app.$('.training-workspace');
  const rail = app.$('.training-study-rail');
  assert.equal(training.dataset.trainingFullHandPhase, 'off');
  for (const preset of PRESETS) {
    app.document.documentElement.dataset.layoutPreset = preset;
    assert.equal(css.cascaded(training, 'grid-template-columns', { width: 1440 }), 'minmax(0, 1fr) minmax(320px, 360px)');
    assert.equal(css.cascaded(training, 'grid-template-areas', { width: 1440 }), '"decision insight"');
    assert.equal(css.cascaded(app.$('.training-decision-column'), 'grid-area', { width: 1440 }), 'decision');
    assert.equal(css.cascaded(rail, 'grid-area', { width: 1440 }), 'insight');
    for (const panel of ['trainingSetupPanel', 'trainingHistoryPanel']) {
      assert.ok(app.byId(panel).parentElement === rail, panel);
      assert.equal(css.cascaded(app.byId(panel), 'grid-column', { width: 1440 }), 'auto', panel);
    }
  }
  app.document.documentElement.dataset.layoutPreset = 'balanced';
});

test('1024 uses the established safe stack and preset CSS remains RTL-neutral', () => {
  // Presets only take effect from 1320px; below that every preset shares the
  // canonical layout.
  const surfaces = [gto.querySelector('.playbook-workspace'), ...gto.querySelector('.playbook-workspace').children,
    markup.getElementById('handStageDock'), markup.getElementById('table-wrapper'), markup.getElementById('layoutPresetControl')];
  for (const destination of ['hand', 'analyze']) {
    for (const width of [600, 1024]) {
      const balanced = withPreset('balanced', destination, () => layoutOf(surfaces, width));
      for (const preset of PRESETS) assert.deepEqual(withPreset(preset, destination, () => layoutOf(surfaces, width)), balanced, `${preset}/${destination}@${width}`);
    }
  }
  assert.equal(css.cascaded(gto.querySelector('.playbook-workspace'), 'flex-direction', { width: 1024 }), 'column');
  assert.equal(css.cascaded(markup.querySelector('.training-workspace'), 'flex-direction', { width: 1024 }), 'column');
  assert.equal(css.cascaded(markup.querySelector('.equity-workspace'), 'flex-direction', { width: 1024 }), 'column');
  const physical = /^(?:direction|margin-left|margin-right|padding-left|padding-right|left|right)$/;
  for (const rule of presetSheet.rules) {
    for (const { property } of rule.declarations) assert.doesNotMatch(property, physical, rule.selectors.join(', '));
  }
});
