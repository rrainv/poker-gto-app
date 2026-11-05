import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SETTINGS_CATEGORY,
  SETTINGS_CATEGORY_IDS,
  createSettingsRowAdapters,
  differsFromDefault,
  matchesSearch,
  normalizeSearchText,
  normalizeSettingsCategory,
  resolveSettingsView,
} from '../app/src/application/settings-model.mjs';
import {
  LOCAL_DATA_COUNT_SOURCES,
  countLocalData,
} from '../app/src/application/settings-data-counts.mjs';
import { createFakeIndexedDB } from './helpers/fake-indexeddb.mjs';

// SETTINGS-001: the pure rules (view resolution, search, modified detection,
// per-row reset) and the local data counts. No DOM.

const rows = [
  { id: 'workstation-theme', category: 'appearance', text: 'Workstation theme Built-in themes never change', modified: false },
  { id: 'card-face-style', category: 'appearance', text: 'Card face style Classic Minimal', modified: true },
  { id: 'audio-volume', category: 'audio', text: 'Master volume Scales every Riverline sound', modified: true },
  { id: 'motion', category: 'audio', text: 'Motion Instant Faster Standard Reduced', modified: false },
  { id: 'language', category: 'language', text: 'Interface language English Русский עברית', modified: false },
  { id: 'key-1', category: 'shortcuts', text: 'F Fold', modified: false },
];

test('with no query a category shows only its own rows', () => {
  const view = resolveSettingsView({ rows, category: 'audio' });
  assert.equal(view.view, 'category');
  assert.deepEqual([...view.visibleRowIds], ['audio-volume', 'motion']);
  assert.equal(view.empty, false);
});

test('a search spans every category and drops the ones with no match', () => {
  const view = resolveSettingsView({ rows, category: 'audio', query: 'volume' });
  assert.equal(view.view, 'search');
  assert.deepEqual([...view.visibleRowIds], ['audio-volume']);
  assert.deepEqual([...view.matchedCategories], ['audio']);
  const across = resolveSettingsView({ rows, category: 'audio', query: 'fold' });
  assert.deepEqual([...across.visibleRowIds], ['key-1']);
});

test('every word must match, case and spacing do not matter, and no match is an empty state', () => {
  assert.equal(matchesSearch('Master volume', '  VOLUME   master '), true);
  assert.equal(matchesSearch('Master volume', 'volume theme'), false);
  assert.equal(normalizeSearchText('  Ёж  '), 'ёж');
  const view = resolveSettingsView({ rows, query: 'zzzz' });
  assert.equal(view.empty, true);
  assert.equal(view.matchCount, 0);
});

test('modified counts are per category and the filter keeps only changed rows', () => {
  const view = resolveSettingsView({ rows, modifiedOnly: true });
  assert.equal(view.modifiedTotal, 2);
  assert.deepEqual({ ...view.modifiedByCategory }, {
    appearance: 1, audio: 1, language: 0, help: 0, shortcuts: 0, account: 0, about: 0,
  });
  assert.deepEqual([...view.visibleRowIds].sort(), ['audio-volume', 'card-face-style']);
  const combined = resolveSettingsView({ rows, modifiedOnly: true, query: 'card' });
  assert.deepEqual([...combined.visibleRowIds], ['card-face-style']);
});

test('categories are the seven the tickets name and unknown ones fall back', () => {
  assert.deepEqual([...SETTINGS_CATEGORY_IDS], ['appearance', 'audio', 'language', 'help', 'shortcuts', 'account', 'about']);
  assert.equal(normalizeSettingsCategory('nope'), DEFAULT_SETTINGS_CATEGORY);
  assert.equal(normalizeSettingsCategory('account'), 'account');
});

test('unknown values are never treated as modified', () => {
  assert.equal(differsFromDefault(undefined, 'a'), false);
  assert.equal(differsFromDefault(null, 'a'), false);
  assert.equal(differsFromDefault('b', 'a'), true);
  assert.equal(differsFromDefault('a', 'a'), false);
});

function fakes() {
  const log = [];
  let theme = 'midnight';
  let card = { fourColor: true, rankStyle: 'poker', faceStyle: 'minimal', backStyle: 'riverline' };
  let prefs = { enabled: true, masterVolume: 0.72, pokerSoundsEnabled: true, studySoundsEnabled: true };
  let motion = null;
  let language = 'en';
  let answer = 'select';
  return {
    log,
    set: {
      theme: (value) => { theme = value; }, card: (value) => { card = { ...card, ...value }; },
      volume: (value) => { prefs = { ...prefs, masterVolume: value }; }, motion: (value) => { motion = value; },
      language: (value) => { language = value; }, answer: (value) => { answer = value; },
      study: (value) => { prefs = { ...prefs, studySoundsEnabled: value }; },
    },
    deps: {
      theme: { getTheme: () => theme, apply: (value) => { log.push(['theme', value]); theme = value; } },
      cards: { get: () => card, apply: (value) => { log.push(['cards', value]); card = { ...card, ...value }; } },
      sound: {
        getPreferences: () => prefs,
        setEnabled: (value) => { log.push(['enabled', value]); prefs = { ...prefs, enabled: value }; },
        setMasterVolume: (value) => { log.push(['volume', value]); prefs = { ...prefs, masterVolume: value }; },
        setCategoryEnabled: (name, value) => {
          log.push(['category', name, value]);
          prefs = { ...prefs, [name === 'poker' ? 'pokerSoundsEnabled' : 'studySoundsEnabled']: value };
        },
      },
      motion: { getPreference: () => motion, apply: (value) => { log.push(['motion', value]); motion = value; } },
      language: { get: () => language, set: (value) => { log.push(['language', value]); language = value; } },
      answerMode: { get: () => answer, set: (value) => { log.push(['answer', value]); answer = value; } },
    },
  };
}

test('the defaults are modified only when a preference differs, and reset restores them', () => {
  const f = fakes();
  const adapters = createSettingsRowAdapters(f.deps);
  const byId = Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter]));
  assert.deepEqual(Object.keys(byId).sort(), [
    'audio-enabled', 'audio-poker', 'audio-study', 'audio-volume', 'card-back-style', 'card-face-style',
    'card-rank-style', 'card-suit-colors', 'language', 'motion', 'training-answer-mode', 'workstation-theme',
  ]);
  assert.ok(adapters.every((adapter) => adapter.isModified() === false), 'a fresh install has nothing modified');

  f.set.theme('slate'); f.set.card({ faceStyle: 'classic', fourColor: false }); f.set.volume(0.3);
  f.set.motion('reduced'); f.set.language('he'); f.set.answer('one_click'); f.set.study(false);
  assert.deepEqual(adapters.filter((adapter) => adapter.isModified()).map((adapter) => adapter.id).sort(), [
    'audio-study', 'audio-volume', 'card-face-style', 'card-suit-colors', 'language', 'motion',
    'training-answer-mode', 'workstation-theme',
  ]);

  adapters.forEach((adapter) => adapter.reset());
  assert.ok(adapters.every((adapter) => adapter.isModified() === false), 'reset puts every row back');
  assert.deepEqual(f.log.find((entry) => entry[0] === 'motion'), ['motion', null], 'Motion default is "match this device"');
  assert.deepEqual(f.log.find((entry) => entry[0] === 'volume'), ['volume', 0.72]);
});

test('volume is compared by whole percent so float noise is never "modified"', () => {
  const f = fakes();
  f.set.volume(0.7200000001);
  const adapter = createSettingsRowAdapters(f.deps).find((entry) => entry.id === 'audio-volume');
  assert.equal(adapter.isModified(), false);
});

test('a controller that is not installed omits its rows instead of inventing them', () => {
  const adapters = createSettingsRowAdapters({ theme: null, cards: null, sound: null, motion: null, language: null, answerMode: null });
  assert.equal(adapters.length, 0);
  const partial = createSettingsRowAdapters({ language: { get: () => 'ru', set() {} } });
  assert.deepEqual(partial.map((adapter) => adapter.id), ['language']);
  assert.equal(partial[0].isModified(), true);
});

// ── Local data counts ────────────────────────────────────────────────────
function seed(indexedDB, name, stores) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      for (const [store, count] of Object.entries(stores)) {
        const created = request.result.createObjectStore(store, { keyPath: 'id' });
        for (let index = 0; index < count; index += 1) created.add({ id: `${store}-${index}` });
      }
    };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}

test('counts read each store exactly and report 0 for a database that was never created', async () => {
  const indexedDB = createFakeIndexedDB();
  await seed(indexedDB, 'riverline-saved-study-objects', { metadata: 1, objects: 7 });
  await seed(indexedDB, 'riverline-training-memory', { metadata: 1, sessions: 3, decisions: 41 });
  const counts = await countLocalData({ indexedDB });
  assert.deepEqual({ ...counts }, {
    saved: 7, trainingSessions: 3, trainingDecisions: 41, strategySetups: 0, gameNights: 0,
  });
  assert.equal(await indexedDB.databases().then((list) => list.some((entry) => entry.name === 'riverline-home-game')), false,
    'counting never creates a database');
  assert.equal(LOCAL_DATA_COUNT_SOURCES.length, 5);
});

test('counts are unknown (null), never zero, when the browser cannot say', async () => {
  const none = await countLocalData({ indexedDB: null });
  assert.ok(Object.values(none).every((value) => value === null));
  const noList = await countLocalData({ indexedDB: { open() {}, databases: undefined } });
  assert.ok(Object.values(noList).every((value) => value === null));
  const failing = await countLocalData({ indexedDB: { open() {}, databases: async () => { throw new Error('denied'); } } });
  assert.ok(Object.values(failing).every((value) => value === null));
});
