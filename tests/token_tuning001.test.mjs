// TOKEN-TUNING (SAVED-COMPOSITION-002 Part 3): the owner's final global token set.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  PRESENTATION_THEMES,
  contrastRatio,
  createPresentationThemeController,
  deriveFeatureSurfaceRoles,
} from '../app/src/application/presentation-theme.mjs';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');
const prepaint = await readFile(new URL('../app/src/application/presentation-theme-prepaint.js', import.meta.url), 'utf8');

// The last block for a selector wins in the cascade (html[data-theme] beats [data-theme]).
function presetBlock(id) {
  const blocks = [...css.matchAll(/(^|\n)(html)?\[data-theme="([a-z-]+)"\] \{([^}]*)\}/g)]
    .filter((match) => match[3] === id);
  const values = {};
  for (const block of blocks) {
    for (const [, name, value] of block[4].matchAll(/(--[a-z-]+):\s*([^;]+);/g)) values[name] = value.trim();
  }
  return values;
}
const RESTING = ['--surface-canvas', '--surface-shell', '--surface-panel', '--surface-elevated', '--surface-interactive', '--surface-inset'];

test('preset surfaces used for text-role contrast mirror the painted preset blocks', () => {
  for (const theme of PRESENTATION_THEMES) {
    const block = presetBlock(theme.id);
    assert.deepEqual([...theme.surfaces], RESTING.map((name) => block[name]), theme.id);
    assert.equal(theme.preview.accent, block['--accent-primary'], `${theme.id} preview accent = painted accent`);
  }
});

// Amendment 2: Midnight is the mockup palette (superseding the B / deeper-accent values);
// Graphite and Daylight keep their surfaces with the jade accent family.
test('final values: mockup Midnight, jade accents, B Daylight surfaces, radius 10/7, C heading sizes, B spacing', () => {
  assert.equal(presetBlock('midnight')['--accent-primary'], '#42ad7b');
  assert.equal(presetBlock('daylight')['--accent-primary'], '#256044');
  assert.equal(presetBlock('graphite')['--accent-primary'], '#42ad7b');
  assert.equal(presetBlock('midnight')['--surface-canvas'], '#101311');
  assert.equal(presetBlock('daylight')['--surface-panel'], '#fbfaf6');
  assert.equal(presetBlock('daylight')['--text-muted'], '#545e58');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  for (const [name, value] of Object.entries({
    '--radius-panel': '10px', '--radius-control': '7px', '--t-title': '1.375rem', '--t-heading': '1.0625rem',
    '--t-display': '2.5rem', '--weight-bold': '700', '--gap-section': 'var(--space-8)', '--pad-surface': 'var(--space-6)',
  })) assert.match(root, new RegExp(`${name}: ${value.replace(/[()]/g, '\\$&')};`), name);
  assert.match(root, /--elevation-surface: none;/);
  assert.match(prepaint, /cache\?\.version === 'beta-b-2'/);
});

function applied(themeId, customization = null) {
  const properties = new Map();
  const root = { dataset: {}, style: { setProperty: (name, value) => properties.set(name, value), removeProperty: (name) => properties.delete(name), getPropertyValue: (name) => properties.get(name) ?? '' } };
  const storage = new Map();
  const controller = createPresentationThemeController({
    root,
    storage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) },
  });
  controller.apply(themeId);
  if (customization) { controller.beginEdit(); controller.customize(customization); }
  return properties;
}

test('derived status and accent text reach 4.5:1 on every resting surface of every preset', () => {
  for (const theme of PRESENTATION_THEMES) {
    const properties = applied(theme.id);
    for (const role of ['--accent-text', '--status-warning', '--status-danger', '--status-info', '--status-positive']) {
      const color = properties.get(role);
      assert.ok(color, `${theme.id} ${role}`);
      for (const surface of theme.surfaces) {
        assert.ok(contrastRatio(color, surface) >= 4.5, `${theme.id} ${role} ${color} on ${surface}: ${contrastRatio(color, surface).toFixed(2)}`);
      }
    }
    const block = presetBlock(theme.id);
    for (const surface of theme.surfaces) {
      assert.ok(contrastRatio(block['--text-muted'], surface) >= 4.5, `${theme.id} muted on ${surface}`);
    }
  }
});

test('custom themes keep the user accent and still derive readable roles', () => {
  const custom = { accent: '#e0a458', surface: '#1b2230', felt: '#5b3a6b' };
  const properties = applied('midnight', custom);
  assert.equal(properties.get('--accent-primary'), '#e0a458');
  const surfaces = ['--surface-canvas', '--surface-panel', '--surface-elevated', '--surface-interactive', '--surface-inset'].map((name) => properties.get(name));
  for (const role of ['--text-primary', '--text-secondary', '--text-muted', '--status-warning', '--accent-text']) {
    for (const surface of surfaces) assert.ok(contrastRatio(properties.get(role), surface) >= 4.5, `${role} on ${surface}`);
  }
  const roles = deriveFeatureSurfaceRoles(custom);
  assert.ok(contrastRatio(roles['--analysis-text'], roles['--analysis-surface']) >= 4.5);
});
