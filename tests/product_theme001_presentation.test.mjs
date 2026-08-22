import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY,
  PRESENTATION_THEME_SCHEMA_VERSION,
  PRESENTATION_THEME_STORAGE_KEY,
  PRESENTATION_THEMES,
  contrastRatio,
  createPresentationThemeController,
  normalizeHexColor,
  normalizeThemeCustomization,
} from '../app/src/application/presentation-theme.mjs';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../app/src/application/presentation-density-bootstrap.mjs', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/analysis-translations.js', import.meta.url), 'utf8');

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
    this.writes = [];
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    this.values.set(key, String(value));
    this.writes.push([key, String(value)]);
  }
}

function fixture(initial = {}) {
  const properties = new Map();
  const events = [];
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const root = {
    dataset: {
      density: initial.density ?? 'comfortable',
      layoutPreset: initial.layout ?? 'balanced',
      layoutPresetPreference: initial.layout ?? 'balanced',
    },
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); },
    },
    ownerDocument: { defaultView: { CustomEvent: FakeCustomEvent } },
    dispatchEvent(event) { events.push(event); },
  };
  const storage = new MemoryStorage(initial.storage);
  const controller = createPresentationThemeController({ root, storage }).init();
  return { controller, events, properties, root, storage };
}

function themeBlock(themeId) {
  return css.match(new RegExp(`\\[data-theme="${themeId}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

function token(block, name) {
  return block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))?.[1]?.toLowerCase() ?? null;
}

test('built-in switching is live, persistent, announced, and limited to three serious themes', () => {
  const view = fixture();
  assert.deepEqual(PRESENTATION_THEMES.map((theme) => theme.id), ['midnight', 'graphite', 'daylight']);
  assert.equal(view.controller.getTheme(), 'midnight');

  view.controller.apply('graphite');
  assert.equal(view.root.dataset.theme, 'graphite');
  assert.equal(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY), 'graphite');
  assert.deepEqual(view.events.at(-1).detail, { theme: 'graphite', customized: false });

  view.controller.apply('daylight');
  assert.equal(view.root.dataset.theme, 'daylight');
  assert.equal(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY), 'daylight');
});

test('custom accent, surface, and felt persist per built-in theme and restore', () => {
  const view = fixture();
  const customization = view.controller.customize({
    accent: '#2f7fd1',
    surface: '#10253b',
    felt: '#7a3b58',
  });
  assert.deepEqual(Object.keys(customization), ['accent', 'surface', 'felt']);
  assert.equal(view.root.dataset.themeCustomized, 'true');
  assert.equal(view.properties.get('--accent-primary'), customization.accent);
  assert.equal(view.properties.get('--surface-canvas'), customization.surface);
  assert.equal(view.properties.get('--poker-felt-accent'), customization.felt);

  view.controller.apply('graphite');
  assert.equal(view.controller.getCustomization(), null);
  view.controller.customize({ accent: '#a77731' });
  view.controller.apply('midnight');
  assert.deepEqual(view.controller.getCustomization(), customization);

  const restored = fixture({ storage: Object.fromEntries(view.storage.values) });
  assert.equal(restored.controller.getTheme(), 'midnight');
  assert.deepEqual(restored.controller.getCustomization(), customization);
  assert.equal(restored.properties.get('--surface-canvas'), customization.surface);
});

test('reset removes only the current theme customization and restores CSS defaults', () => {
  const view = fixture();
  view.controller.customize({ accent: '#3d78c5' });
  view.controller.apply('graphite');
  view.controller.customize({ felt: '#6b4b39' });
  view.controller.reset();
  assert.equal(view.controller.getCustomization(), null);
  assert.equal(view.root.dataset.themeCustomized, 'false');
  assert.equal(view.properties.size, 0);

  view.controller.apply('midnight');
  assert.ok(view.controller.getCustomization()?.accent);
  const record = JSON.parse(view.storage.getItem(PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY));
  assert.equal(record.schemaVersion, PRESENTATION_THEME_SCHEMA_VERSION);
  assert.ok(record.byTheme.midnight);
  assert.equal(record.byTheme.graphite, undefined);
});

test('invalid and legacy storage values repair to Midnight without leaking raw CSS', () => {
  const view = fixture({ storage: {
    [PRESENTATION_THEME_STORAGE_KEY]: 'discord-0px',
    [PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY]: JSON.stringify({
      schemaVersion: 'legacy/v0',
      byTheme: { midnight: { accent: 'url(javascript:bad)', surface: '#fff' } },
    }),
  } });
  assert.equal(view.controller.getTheme(), 'midnight');
  assert.equal(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY), 'midnight');
  assert.equal(view.controller.getCustomization(), null);
  assert.equal(view.properties.size, 0);

  assert.equal(normalizeHexColor('red'), null);
  assert.equal(normalizeThemeCustomization({ accent: 'var(--danger)' }, 'midnight'), null);
  const repaired = JSON.parse(view.storage.getItem(PRESENTATION_THEME_CUSTOMIZATION_STORAGE_KEY));
  assert.deepEqual(repaired, { schemaVersion: PRESENTATION_THEME_SCHEMA_VERSION, byTheme: {} });
});

test('custom guardrails preserve focus and foreground contrast', () => {
  for (const theme of PRESENTATION_THEMES) {
    const normalized = normalizeThemeCustomization({
      accent: theme.tone === 'light' ? '#ffffff' : '#000000',
      surface: theme.tone === 'light' ? '#ffffff' : '#000000',
      felt: '#ff00ff',
    }, theme.id);
    assert.ok(normalized);
    assert.ok(contrastRatio(normalized.accent, normalized.surface) >= 3, `${theme.id} custom focus contrast`);
    const readable = Math.max(
      contrastRatio('#07120d', normalized.accent),
      contrastRatio('#ffffff', normalized.accent),
    );
    assert.ok(readable >= 4.5, `${theme.id} custom accent foreground`);
  }
});

test('built-in primary, muted, status, and accent foreground contrast is safe', () => {
  for (const theme of PRESENTATION_THEMES) {
    const block = themeBlock(theme.id);
    const panel = token(block, '--surface-panel');
    const canvas = token(block, '--surface-canvas');
    const primary = token(block, '--text-primary');
    const muted = token(block, '--text-muted');
    const accent = token(block, '--accent-primary');
    const onAccent = token(block, '--text-on-accent');
    assert.ok(contrastRatio(primary, canvas) >= 7, `${theme.id} primary/canvas`);
    assert.ok(contrastRatio(muted, panel) >= 4.5, `${theme.id} muted/panel`);
    assert.ok(contrastRatio(onAccent, accent) >= 4.5, `${theme.id} accent foreground`);
    for (const status of ['--status-positive', '--status-warning', '--status-danger', '--status-info']) {
      assert.ok(contrastRatio(token(block, status), panel) >= 4.5, `${theme.id} ${status}`);
    }
  }
});

test('theme, density, and layout stay independent for every supported combination', () => {
  for (const theme of PRESENTATION_THEMES.map((entry) => entry.id)) {
    for (const density of ['comfortable', 'compact']) {
      for (const layout of ['balanced', 'table-focus', 'analysis-focus', 'controls-first']) {
        const view = fixture({ density, layout });
        view.controller.apply(theme);
        assert.equal(view.root.dataset.theme, theme);
        assert.equal(view.root.dataset.density, density);
        assert.equal(view.root.dataset.layoutPreset, layout);
        assert.equal(view.root.dataset.layoutPresetPreference, layout);
      }
    }
  }
  assert.doesNotMatch(themeBlock('midnight'), /data-density|data-layout-preset/);
});

test('major workspaces consume the shared semantic surface grammar', () => {
  for (const marker of [
    'id="homeMode"', 'id="homegameMode"', 'id="gtoMode"', 'id="trainingMode"',
    'id="calibrationMode"', 'id="equityMode"', 'id="settingsModal"', 'savedHandViewerBanner',
  ]) assert.match(html, new RegExp(marker));

  assert.match(css, /\.riverline-shell\s*\{[\s\S]*?background:\s*var\(--surface-canvas\)/);
  assert.match(css, /\.mode-rail\s*\{[\s\S]*?background:\s*var\(--surface-shell\)/);
  assert.match(css, /\.panel\s*\{[\s\S]*?background:\s*var\(--surface-panel\)/);
  assert.match(css, /#gtoMode \.playbook-state-source[\s\S]*?var\(--surface-panel\)/);
  assert.match(css, /#equityMode\s*\{[\s\S]*?background:\s*var\(--surface-base\)/);
  assert.match(css, /\.saved-study-viewer-banner\s*\{[\s\S]*?var\(--surface-inset\)/);
  assert.match(css, /\.home-game-player-card[\s\S]*?var\(--surface-subtle\)/);
  assert.match(css, /\.state-block--error[\s\S]*?var\(--status-danger\)/);
  assert.match(css, /\.state-block--success[\s\S]*?var\(--status-positive\)/);
});

test('theme Settings copy is localized for EN RU HE and remains RTL-neutral', () => {
  for (const key of [
    'Workstation theme', 'Built-in themes', 'Custom colors', 'Accent color', 'Surface tone',
    'Table accent', 'Reset theme colors', 'Using built-in theme defaults.',
  ]) {
    assert.match(translations, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  assert.match(translations, /Тема рабочей среды/);
  assert.match(translations, /ערכת נושא לסביבת העבודה/);
  assert.match(bootstrap, /riverline:languagechange/);
  const themeCss = css.slice(css.indexOf('.theme-swatch-grid'), css.indexOf('/* Tooltips, toasts'));
  assert.doesNotMatch(themeCss, /margin-left|margin-right|padding-left|padding-right|\bleft\s*:|\bright\s*:|direction\s*:/);
});
