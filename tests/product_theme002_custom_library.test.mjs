import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGACY_PRESENTATION_THEME_STORAGE_KEY,
  PRESENTATION_THEME_SCHEMA_VERSION,
  PRESENTATION_THEME_STORAGE_KEY,
  PRESENTATION_THEMES,
  createPresentationThemeController,
} from '../app/src/application/presentation-theme.mjs';

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function fixture({ storage: initial = {}, density = 'comfortable', layout = 'balanced' } = {}) {
  const properties = new Map();
  const storage = new MemoryStorage(initial);
  const ids = ['one', 'two', 'three', 'four', 'five'];
  let time = 0;
  const root = {
    dataset: { density, layoutPreset: layout, layoutPresetPreference: layout },
    style: {
      setProperty(name, value) { properties.set(name, value); },
      removeProperty(name) { properties.delete(name); },
    },
    ownerDocument: { defaultView: {} },
    dispatchEvent() {},
  };
  const controller = createPresentationThemeController({
    root,
    storage,
    createId: () => ids.shift(),
    now: () => `2026-08-22T00:00:0${time++}.000Z`,
  }).init();
  return { controller, properties, root, storage };
}

test('an exact Graphite customization saves as a named stable custom theme and survives reload', () => {
  const view = fixture();
  view.controller.apply('graphite');
  const exact = view.controller.customize({ accent: '#ba7134', surface: '#202936', felt: '#62465a' });
  const saved = view.controller.saveAsNew('Graphite Study');

  assert.equal(saved.id, 'custom-one');
  assert.equal(saved.name, 'Graphite Study');
  assert.equal(saved.baseThemeId, 'graphite');
  assert.equal(saved.version, 1);
  assert.equal(saved.createdAt, '2026-08-22T00:00:01.000Z');
  assert.deepEqual(saved.overrides, exact);
  assert.equal(view.controller.getTheme(), saved.id);
  assert.equal(view.controller.getBaseTheme(), 'graphite');
  assert.equal(view.root.dataset.theme, 'graphite');
  assert.equal(view.root.dataset.presentationThemeId, saved.id);
  assert.equal(view.root.dataset.density, 'comfortable');
  assert.equal(view.root.dataset.layoutPreset, 'balanced');

  const record = JSON.parse(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY));
  assert.equal(record.schemaVersion, PRESENTATION_THEME_SCHEMA_VERSION);
  assert.equal(record.activeThemeId, saved.id);
  assert.equal(record.customThemes.length, 1);
  assert.deepEqual(record.draftsByTheme, {});
  assert.equal(view.storage.getItem(LEGACY_PRESENTATION_THEME_STORAGE_KEY), null);

  const restored = fixture({ storage: Object.fromEntries(view.storage.values) });
  assert.equal(restored.controller.getTheme(), saved.id);
  assert.deepEqual(restored.controller.getCustomization(), exact);
  assert.equal(restored.properties.get('--surface-canvas'), exact.surface);
  assert.ok(PRESENTATION_THEMES.every((theme) => Object.isFrozen(theme) && Object.isFrozen(theme.preview)));
});

test('duplicate, rename, edit, individual reset, and base reset preserve independent custom values', () => {
  const view = fixture();
  view.controller.apply('daylight');
  view.controller.customize({ accent: '#336699', surface: '#f0eadf', felt: '#6f5260' });
  const original = view.controller.saveAsNew('Day Study');
  const duplicate = view.controller.duplicateTheme(original.id, 'Day Study');

  assert.equal(duplicate.name, 'Day Study (2)');
  assert.equal(duplicate.baseThemeId, original.id);
  assert.equal(view.controller.renameTheme(duplicate.id, 'Reading'), 'Reading');
  const beforeEdit = view.controller.getColors();
  view.controller.customize({ accent: '#8751a2' });
  assert.notEqual(view.controller.getColors().accent, beforeEdit.accent);

  view.controller.resetToken('accent');
  assert.equal(view.controller.getColors().accent, beforeEdit.accent);
  assert.ok(view.controller.getCustomization()?.surface);
  view.controller.reset();
  assert.deepEqual(view.controller.getColors(), beforeEdit);

  view.controller.apply(original.id);
  assert.equal(view.controller.getColors().accent, beforeEdit.accent);
  assert.equal(view.controller.renameTheme('midnight', 'Nope'), null);
  assert.equal(view.controller.deleteTheme('graphite'), false);
});

test('deleting the active custom theme falls back to its base and deleting a parent safely rebases children', () => {
  const view = fixture();
  view.controller.apply('graphite');
  view.controller.customize({ accent: '#aa6633' });
  const parent = view.controller.saveAsNew('Parent');
  const child = view.controller.duplicateTheme(parent.id, 'Child');

  assert.equal(view.controller.deleteTheme(child.id), true);
  assert.equal(view.controller.getTheme(), parent.id);
  assert.equal(view.controller.getBaseTheme(), 'graphite');

  const secondChild = view.controller.duplicateTheme(parent.id, 'Second Child');
  view.controller.apply('midnight');
  assert.equal(view.controller.deleteTheme(parent.id), true);
  const repairedChild = view.controller.getLibrary().customThemes.find((theme) => theme.id === secondChild.id);
  assert.equal(repairedChild.baseThemeId, 'graphite');
  view.controller.apply(secondChild.id);
  assert.equal(view.controller.getBaseTheme(), 'graphite');
  assert.ok(view.controller.getCustomization()?.accent);
});

test('malformed v2 records repair invalid IDs, duplicate names, cycles, raw CSS, and active selection', () => {
  const malformed = {
    schemaVersion: PRESENTATION_THEME_SCHEMA_VERSION,
    activeThemeId: 'missing',
    customThemes: [
      {
        id: 'custom-a', name: 'Study', baseThemeId: 'custom-b', version: 99,
        overrides: { accent: 'var(--danger)', surface: '#fff', arbitraryCss: 'body{}' },
        createdAt: 'bad', updatedAt: 'bad',
      },
      {
        id: 'custom-b', name: 'Study', baseThemeId: 'custom-a', version: 1,
        overrides: { felt: '#ff00ff' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      },
      { id: 'not-custom', name: 'Drop me', baseThemeId: 'midnight', overrides: {} },
    ],
    draftsByTheme: { missing: { accent: '#ffffff' }, midnight: { accent: 'url(bad)' } },
  };
  const view = fixture({ storage: { [PRESENTATION_THEME_STORAGE_KEY]: JSON.stringify(malformed) } });
  const repaired = JSON.parse(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY));

  assert.equal(view.controller.getTheme(), 'midnight');
  assert.deepEqual(repaired.customThemes.map((theme) => theme.name), ['Study', 'Study (2)']);
  assert.equal(repaired.customThemes[0].baseThemeId, 'midnight');
  assert.equal(repaired.customThemes[0].version, 1);
  assert.deepEqual(Object.keys(repaired.customThemes[0].overrides), ['surface']);
  assert.deepEqual(repaired.draftsByTheme, {});
  assert.doesNotMatch(JSON.stringify(repaired), /arbitraryCss|var\(|url\(/);
});

test('legacy split preferences migrate once into the single versioned library record', () => {
  const legacy = JSON.stringify({
    schemaVersion: 'presentation-theme-customization/v1',
    byTheme: { graphite: { accent: '#976531' } },
  });
  const view = fixture({ storage: {
    [LEGACY_PRESENTATION_THEME_STORAGE_KEY]: 'graphite',
    [PRESENTATION_THEME_STORAGE_KEY]: legacy,
  } });
  const record = JSON.parse(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY));

  assert.equal(record.schemaVersion, PRESENTATION_THEME_SCHEMA_VERSION);
  assert.equal(record.activeThemeId, 'graphite');
  assert.ok(record.draftsByTheme.graphite.accent);
  assert.equal(view.storage.getItem(LEGACY_PRESENTATION_THEME_STORAGE_KEY), null);
});

test('controller preview is non-persistent, Cancel restores, and Apply-style customization commits', () => {
  const view = fixture();
  view.controller.apply('graphite');
  const before = view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY);
  const preview = view.controller.preview({ accent: '#9a668f' });
  assert.equal(view.root.dataset.themePreview, 'true');
  assert.equal(view.properties.get('--accent-primary'), preview.accent);
  assert.equal(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY), before);

  view.controller.cancelPreview();
  assert.equal(view.root.dataset.themePreview, undefined);
  assert.equal(view.properties.has('--accent-primary'), false);
  assert.equal(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY), before);

  const committed = view.controller.customize({ accent: '#9a668f' });
  assert.equal(view.properties.get('--accent-primary'), committed.accent);
  assert.notEqual(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY), before);
});

test('controller preview, Apply, storage, and reload preserve extreme valid colors exactly', () => {
  const view = fixture();
  view.controller.apply('graphite');
  const exact = { accent: '#ff00ff', surface: '#000000', felt: '#ffffff' };
  const preview = view.controller.preview(exact);

  assert.deepEqual(preview, exact);
  assert.equal(view.properties.get('--accent-primary'), exact.accent);
  assert.equal(view.properties.get('--surface-canvas'), exact.surface);
  assert.equal(view.properties.get('--poker-felt-accent'), exact.felt);
  view.controller.customize(exact);
  assert.deepEqual(view.controller.getColors(), exact);

  const record = JSON.parse(view.storage.getItem(PRESENTATION_THEME_STORAGE_KEY));
  assert.deepEqual(record.draftsByTheme.graphite, exact);
  const restored = fixture({ storage: Object.fromEntries(view.storage.values) });
  assert.deepEqual(restored.controller.getColors(), exact);
});

test('custom themes remain independent across theme, density, and every layout preference', () => {
  for (const density of ['comfortable', 'compact']) {
    for (const layout of ['balanced', 'table-focus', 'analysis-focus', 'controls-first']) {
      const view = fixture({ density, layout });
      view.controller.apply('graphite');
      view.controller.customize({ felt: '#71506a' });
      const custom = view.controller.saveAsNew(`${density}-${layout}`);
      assert.equal(view.controller.getTheme(), custom.id);
      assert.equal(view.root.dataset.theme, 'graphite');
      assert.equal(view.root.dataset.density, density);
      assert.equal(view.root.dataset.layoutPreset, layout);
      assert.equal(view.root.dataset.layoutPresetPreference, layout);
    }
  }
});
