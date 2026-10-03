import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  SAVED_LIBRARY_LIMIT,
  clearSavedLibraryQuery,
  createSavedLibraryQuery,
  createSavedLibraryView,
  filterSavedLibraryItems,
  normalizeSavedLibrarySearchText,
  savedLibrarySearchTokens,
  savedLibraryTagOptions,
  sortSavedLibraryItems,
} from '../app/src/application/saved-library-query.mjs';
import { mountSavedLibrary } from '../app/src/application/saved-library-workspace.mjs';
import { HOME_RECENT_LIMIT } from '../app/src/application/home-view-model.mjs';
import { createFakeDom, descendants } from './fixtures/saved-library-fake-dom.mjs';

const [querySource, workspaceSource, logic, html] = await Promise.all([
  readFile(new URL('../app/src/application/saved-library-query.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/saved-library-workspace.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
]);

function item(id, overrides = {}) {
  return {
    id,
    kind: 'hand',
    title: null,
    note: null,
    tags: [],
    reviewState: 'none',
    isMistake: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

const ids = (items) => items.map(({ id }) => id);

test('search normalization folds accents, niqqud, ё/е, case, and whitespace', () => {
  assert.equal(normalizeSavedLibrarySearchText('  Café\tRÉSUMÉ \n naïve '), 'cafe resume naive');
  assert.equal(normalizeSavedLibrarySearchText('שָׁלוֹם  עוֹלָם'), 'שלום עולם');
  assert.equal(normalizeSavedLibrarySearchText('Ёлка ЁЖИК'), 'елка ежик');
  assert.equal(normalizeSavedLibrarySearchText('ﬁnal'), 'final', 'compatibility forms fold under NFKD');
  assert.deepEqual(savedLibrarySearchTokens('  River   BLUFF '), ['river', 'bluff']);
  assert.deepEqual(savedLibrarySearchTokens('   '), []);

  const items = [
    item('accent', { title: 'Café river call' }),
    item('hebrew', { note: 'בלאף בריבר שָׁלוֹם' }),
    item('russian', { tags: ['Ёлка'] }),
    item('plain', { title: 'Turn probe' }),
  ];
  const search = (text) => ids(filterSavedLibraryItems(items, { text }));
  assert.deepEqual(search('CAFE'), ['accent']);
  assert.deepEqual(search('café'), ['accent']);
  assert.deepEqual(search('שלום'), ['hebrew'], 'unpointed Hebrew query matches a pointed note');
  assert.deepEqual(search('שָׁלוֹם'), ['hebrew'], 'pointed Hebrew query matches too');
  assert.deepEqual(search('елка'), ['russian'], 'е query matches ё tag');
  assert.deepEqual(search('ЁЛКА'), ['russian']);
  assert.deepEqual(search('river call'), ['accent'], 'multiple words match all');
  assert.deepEqual(search('river probe'), [], 'every word must match (AND)');
  assert.deepEqual(search('   '), ['accent', 'hebrew', 'russian', 'plain']);
});

test('search covers title, note, and tags only and each word may match a different field', () => {
  const items = [
    item('split', { title: 'Squeeze', note: 'Out of position', tags: ['3-bet pot'] }),
    item('derived', { title: null, note: null, tags: [], heroPosition: 'BTN' }),
  ];
  assert.deepEqual(ids(filterSavedLibraryItems(items, { text: 'squeeze position 3-bet' })), ['split']);
  assert.deepEqual(ids(filterSavedLibraryItems(items, { text: 'BTN' })), [], 'derived facts are not searched');
  assert.match(querySource, /item\.title, item\.note, \.\.\.\(Array\.isArray\(item\.tags\)/);
});

test('kind, review, mistake, tag, and search filters combine; sort is deterministic', () => {
  const items = [
    item('h-old', { kind: 'hand', tags: ['River'], reviewState: 'review_later', isMistake: true,
      title: 'river spot', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-05T00:00:00.000Z' }),
    item('s-new', { kind: 'spot', tags: ['river '], reviewState: 'resolved',
      title: 'river decision', createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' }),
    item('h-new', { kind: 'hand', tags: ['Turn'], reviewState: 'review_later',
      createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z' }),
    item('future', { kind: 'future_kind', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' }),
  ];
  assert.deepEqual(ids(filterSavedLibraryItems(items, { kind: 'all' })), ['h-old', 's-new', 'h-new', 'future'], 'All keeps unknown kinds');
  assert.deepEqual(ids(filterSavedLibraryItems(items, { kind: 'hands' })), ['h-old', 'h-new']);
  assert.deepEqual(ids(filterSavedLibraryItems(items, { kind: 'spots' })), ['s-new']);
  assert.deepEqual(ids(filterSavedLibraryItems(items, { review: 'review_later' })), ['h-old', 'h-new']);
  assert.deepEqual(ids(filterSavedLibraryItems(items, { review: 'resolved' })), ['s-new']);
  assert.deepEqual(ids(filterSavedLibraryItems(items, { mistakesOnly: true })), ['h-old']);
  assert.deepEqual(ids(filterSavedLibraryItems(items, { tag: 'river' })), ['h-old', 's-new'], 'tag keys use the Saved tag normalization');
  assert.deepEqual(ids(filterSavedLibraryItems(items, { tag: 'river', kind: 'spots', text: 'decision' })), ['s-new']);
  assert.deepEqual(ids(filterSavedLibraryItems(items, { tag: 'river', review: 'review_later', text: 'decision' })), []);

  assert.deepEqual(ids(sortSavedLibraryItems(items, 'updated')), ['h-old', 'h-new', 'future', 's-new']);
  assert.deepEqual(ids(sortSavedLibraryItems(items, 'created')), ['s-new', 'h-new', 'future', 'h-old']);
  const tied = [item('b'), item('a'), item('c')];
  assert.deepEqual(ids(sortSavedLibraryItems(tied, 'updated')), ['a', 'b', 'c'], 'ties break by stable id');

  const options = savedLibraryTagOptions(items);
  assert.deepEqual(options.map(({ key, count }) => [key, count]), [['river', 2], ['turn', 1]]);
  assert.deepEqual(savedLibraryTagOptions(items, 'gone').map(({ key }) => key), ['gone', 'river', 'turn'],
    'a selected tag stays representable after reload');
});

test('counts are exact totals below the bound and declared as shown-item counts at the bound', () => {
  const build = (count) => Array.from({ length: count }, (_, index) => item(`i${index}`, { kind: index % 3 === 0 ? 'spot' : 'hand' }));
  const three = createSavedLibraryView({ items: build(3), loadedCount: 3 });
  assert.equal(three.bounded, false);
  assert.equal(three.countScope, 'library');
  assert.deepEqual({ ...three.counts }, { all: 3, hands: 2, spots: 1 });

  const almost = createSavedLibraryView({ items: build(199), loadedCount: 199 });
  assert.equal(almost.bounded, false);
  assert.equal(almost.countScope, 'library');
  assert.equal(almost.counts.all, 199);

  const full = createSavedLibraryView({ items: build(200), loadedCount: 200 });
  assert.equal(SAVED_LIBRARY_LIMIT, 200);
  assert.equal(full.bounded, true);
  assert.equal(full.countScope, 'shown');
  assert.deepEqual({ ...full.counts }, { all: 200, hands: 133, spots: 67 });

  const searched = createSavedLibraryView({ items: build(3), loadedCount: 3, query: { text: 'nothing' } });
  assert.deepEqual({ ...searched.counts }, { all: 3, hands: 2, spots: 1 }, 'category counts describe the library, not the search');
  assert.equal(searched.resultCount, 0);
  assert.equal(searched.filtered, true);
});

test('view state distinguishes empty library, empty kind, no results, and results', () => {
  const hand = item('h', { title: 'River' });
  assert.equal(createSavedLibraryView({ items: [] }).status, 'empty');
  assert.equal(createSavedLibraryView({ items: [], query: { text: 'river' } }).status, 'empty',
    'an empty library keeps the existing empty state even with a query');
  assert.equal(createSavedLibraryView({ items: [hand] }).status, 'results');
  assert.equal(createSavedLibraryView({ items: [hand], query: { kind: 'spots' } }).status, 'kind_empty');
  assert.equal(createSavedLibraryView({ items: [hand], query: { text: 'turn' } }).status, 'no_results');
  assert.equal(createSavedLibraryView({ items: [hand], query: { kind: 'spots', text: 'river' } }).status, 'no_results');
  assert.equal(createSavedLibraryView({ items: [hand], query: { mistakesOnly: true } }).status, 'no_results');

  const query = createSavedLibraryQuery({ text: 'x', kind: 'hands', review: 'resolved', mistakesOnly: true, tag: 'river', sort: 'created' });
  const cleared = clearSavedLibraryQuery(query);
  assert.deepEqual({ ...cleared, schemaVersion: undefined },
    { schemaVersion: undefined, text: '', kind: 'all', review: 'any', mistakesOnly: false, tag: null, sort: 'created' },
    'Clear resets search and filters but keeps the chosen sort');
  assert.equal(createSavedLibraryQuery({ kind: 'training', review: 'maybe', sort: 'random' }).kind, 'all');
});

test('the pure query owns no DOM, repository, persistence, or poker authority', () => {
  assert.doesNotMatch(querySource, /document|window|localStorage|indexedDB|listRecent|getById|setTimeout|StrategyProvider|Equity|evaluate/);
  assert.doesNotMatch(workspaceSource, /localStorage|sessionStorage|indexedDB|exportLibrary|importLibrary|setInterval|StrategyProvider|calculateEquity/);
});

function savedObject({ id, kind = 'hand', title = null, note = null, tags = [], reviewState = 'none', mistake = false,
  createdAt = '2026-09-01T10:00:00.000Z', updatedAt = '2026-09-01T10:00:00.000Z' }) {
  const payload = kind === 'hand'
    ? { heroPlayerId: 'Hero', pokerState: { schemaVersion: 'poker-state/v1', game: { mode: 'off' },
      players: [{ playerId: 'Hero', position: 'BTN', holeCards: ['As', 'Kh'] }, { playerId: 'Villain', position: 'BB', holeCards: { state: 'hidden' } }],
      street: 'turn', phase: 'betting', board: ['Qc', '7d', '2s', 'Jh'], potMilliBb: 12500 } }
    : kind === 'spot'
      ? { derivation: 'scenario', decisionContext: { tableSize: 6, rakeMode: 'off', heroPosition: 'BTN', street: 'flop',
        heroCards: ['As', 'Kh'], board: ['Qc', '7d', '2s'], stackBb: 100, potBb: 6.5, facingSizeBb: 0, callAmountBb: 0 },
      truth: { historyStatus: 'not_available' } }
      : { schemaVersion: 'future/v1' };
  return {
    schemaVersion: 'saved-study-object/v1',
    id,
    kind,
    payload,
    createdAt,
    updatedAt,
    annotations: { title, note, tags: tags.map((display) => ({ display, key: display.toLowerCase() })), reviewState,
      classifications: mistake ? ['mistake'] : [] },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
const interpolate = (key, parameters) => (parameters
  ? key.replace(/\{(\w+)\}/g, (_, name) => String(parameters[name]))
  : key);

function mountLibrary({ objects = [], listRecent, captureScope, whenReady } = {}) {
  const dom = createFakeDom();
  const section = dom.document.createElement('section');
  const overlay = dom.document.createElement('div');
  overlay.hidden = true;
  dom.document.body.append(section, overlay);
  const calls = [];
  const opened = [];
  const navigations = [];
  const errors = [];
  const mutationListeners = new Set();
  const savedService = {
    listRecent: listRecent ?? (async (options) => { calls.push(options); return objects; }),
    subscribeLocalMutations(listener) {
      mutationListeners.add(listener);
      return () => mutationListeners.delete(listener);
    },
  };
  const baseListeners = dom.listenerCount();
  const controller = mountSavedLibrary(section, {
    savedService,
    captureScope,
    whenReady,
    translate: interpolate,
    presentation: { itemTitle: (value) => value.title || value.id, itemFacts: () => ['6-handed'] },
    overlay,
    openItem: (id, control) => opened.push([id, control.dataset.savedLibraryOpen]),
    navigate: (destination) => navigations.push(destination),
    reportError: (error) => errors.push(error),
  });
  const all = () => descendants(section);
  const find = (selector) => section.querySelector(selector);
  const listIds = () => section.querySelectorAll('[data-saved-select-id]').map((node) => node.dataset.savedSelectId);
  const mutate = () => [...mutationListeners].forEach((listener) => listener({ type: 'upsert' }));
  return { dom, section, overlay, controller, calls, opened, navigations, errors, all, find, listIds, baseListeners,
    mutationListeners, mutate };
}

const twelve = Array.from({ length: 12 }, (_, index) => savedObject({
  id: `obj-${String(index).padStart(2, '0')}`,
  kind: index % 4 === 3 ? 'spot' : 'hand',
  title: index === 2 ? 'Café river bluff' : index === 5 ? 'Squeeze spot' : null,
  note: index === 7 ? 'Посмотреть ёмкость банка' : index === 8 ? 'בלאף בְּרִיבֶר' : null,
  tags: index % 2 ? ['Pressure'] : [],
  reviewState: index === 5 ? 'review_later' : index === 6 ? 'resolved' : 'none',
  mistake: index === 5,
  updatedAt: `2026-09-${String(20 - index).padStart(2, '0')}T10:00:00.000Z`,
  createdAt: `2026-08-${String(10 + index).padStart(2, '0')}T10:00:00.000Z`,
}));

test('Saved destination loads its own 200-bounded library once on show and renders more than Home Recent', async () => {
  const f = mountLibrary({ objects: twelve });
  assert.equal(f.calls.length, 0, 'mounting performs no library read');
  f.controller.show();
  await settle();
  assert.deepEqual(f.calls, [{ limit: 200 }]);
  assert.equal(HOME_RECENT_LIMIT, 6, 'Home Recent keeps its independent six-item bound');
  assert.equal(f.listIds().length, 12);
  assert.deepEqual(f.listIds().slice(0, 3), ['obj-00', 'obj-01', 'obj-02'], 'most recently updated first');
  const count = (category) => f.find(`[data-saved-category-count="${category}"]`).textContent;
  assert.deepEqual([count('all'), count('hands'), count('spots')], ['12', '9', '3']);
  assert.equal(f.find('[data-saved-library-bound]').hidden, true, 'no bound note below 200');

  f.controller.show();
  await settle();
  assert.equal(f.calls.length, 1, 'showing a clean library re-renders without another read');
});

test('a full 200-item result discloses the bound and labels counts as shown-item counts', async () => {
  const objects = Array.from({ length: 200 }, (_, index) => savedObject({ id: `b${index}`, kind: index % 2 ? 'spot' : 'hand' }));
  const f = mountLibrary({ objects });
  f.controller.show();
  await settle();
  const note = f.find('[data-saved-library-bound]');
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /Showing the 200 most recently updated items\./);
  assert.match(note.textContent, /Counts cover shown items only\./);
  assert.equal(f.find('[data-saved-category="all"]').parentNode.dataset.countScope, 'shown');
});

test('search is debounced client-side, combines with filters, reaches no results, and Clear restores all', async () => {
  const f = mountLibrary({ objects: twelve });
  f.controller.show();
  await settle();
  const search = f.find('[data-saved-library-search]');

  search.value = 'cafe';
  f.dom.dispatch(search, 'input');
  assert.equal(f.listIds().length, 12, 'no filtering until the debounce settles');
  search.value = 'cafe bluff';
  f.dom.dispatch(search, 'input');
  assert.equal(f.dom.pendingTimers(), 1, 'keystrokes coalesce into one pending search');
  f.dom.flushTimers();
  assert.deepEqual(f.listIds(), ['obj-02']);
  assert.equal(f.calls.length, 1, 'search never reads the repository');

  search.value = 'ЕМКОСТЬ';
  f.dom.dispatch(search, 'input');
  f.dom.flushTimers();
  assert.deepEqual(f.listIds(), ['obj-07'], 'Russian ё/е and case fold');
  search.value = 'בריבר';
  f.dom.dispatch(search, 'input');
  f.dom.flushTimers();
  assert.deepEqual(f.listIds(), ['obj-08'], 'Hebrew niqqud folds');

  search.value = 'pressure';
  f.dom.dispatch(search, 'input');
  f.dom.flushTimers();
  assert.equal(f.listIds().length, 6, 'tags are searchable');
  f.dom.dispatch(f.find('[data-saved-category="spots"]'), 'click');
  assert.deepEqual(f.listIds(), ['obj-03', 'obj-07', 'obj-11']);
  // SAVED-COMPOSITION-002: "Mistakes only" is a toggle chip (aria-pressed), not a checkbox.
  const mistakes = f.find('[data-saved-library-mistakes]');
  f.dom.dispatch(mistakes, 'click');
  assert.equal(mistakes.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(f.listIds(), []);
  const list = f.find('[data-saved-library-list]');
  assert.equal(list.dataset.libraryState, 'no_results');
  assert.match(list.textContent, /Nothing matches your search and filters\./);

  const clear = list.querySelector('[data-saved-library-clear]');
  assert.ok(clear, 'no-results offers Clear');
  f.dom.dispatch(clear, 'click');
  assert.equal(f.listIds().length, 12);
  assert.equal(search.value, '');
  assert.equal(f.dom.document.activeElement, search, 'focus returns to the search field');
  assert.equal(f.find('[data-saved-category="all"]').getAttribute('aria-pressed'), 'true');
  assert.equal(f.find('[data-saved-library-mistakes]').getAttribute('aria-pressed'), 'false');
  assert.equal(f.find('[data-saved-library-clear]').disabled, true, 'toolbar Clear is inert once nothing is filtered');
});

test('review, tag, and sort controls filter and order the loaded set; kind-only emptiness keeps its accepted copy', async () => {
  const f = mountLibrary({ objects: [savedObject({ id: 'only-hand', title: 'River', tags: ['Pressure'], reviewState: 'review_later',
    createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' }),
  savedObject({ id: 'resolved-hand', reviewState: 'resolved', createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })] });
  f.controller.show();
  await settle();
  const review = f.find('[data-saved-library-review]');
  review.value = 'resolved';
  f.dom.dispatch(review, 'change');
  assert.deepEqual(f.listIds(), ['resolved-hand']);
  review.value = 'any';
  f.dom.dispatch(review, 'change');

  const tag = f.find('[data-saved-library-tag]');
  assert.deepEqual(tag.options.map((option) => option.value), ['', 'pressure']);
  tag.value = 'pressure';
  f.dom.dispatch(tag, 'change');
  assert.deepEqual(f.listIds(), ['only-hand']);
  tag.value = '';
  f.dom.dispatch(tag, 'change');

  const sort = f.find('[data-saved-library-sort]');
  assert.deepEqual(f.listIds(), ['only-hand', 'resolved-hand']);
  sort.value = 'created';
  f.dom.dispatch(sort, 'change');
  assert.deepEqual(f.listIds(), ['resolved-hand', 'only-hand']);

  f.dom.dispatch(f.find('[data-saved-category="spots"]'), 'click');
  const list = f.find('[data-saved-library-list]');
  assert.equal(list.dataset.libraryState, 'kind_empty');
  assert.match(list.textContent, /No saved Spots yet\./);
});

test('grid selection, shared preview, Escape, and open keep the accepted Saved interaction model', async () => {
  const f = mountLibrary({ objects: [savedObject({ id: 'h1', title: 'River', note: 'Study the sizing' }),
    savedObject({ id: 'future', kind: 'future_kind' })] });
  f.controller.show();
  await settle();
  const item = f.section.querySelector('[data-saved-select-id="h1"]');
  f.dom.dispatch(item, 'pointerover');
  assert.equal(f.overlay.hidden, false, 'hover shows the shared body-level preview');
  assert.equal(f.dom.dispatch(f.dom.document, 'keydown', { key: 'Escape' }).defaultPrevented, true);
  assert.equal(f.overlay.hidden, true, 'Escape dismisses the preview first');

  // SAVED-COMPOSITION-002: the inspector is a reserved column; selection fills it.
  f.dom.dispatch(item, 'click');
  const detail = f.find('[data-saved-inspector-state]');
  assert.equal(detail.hidden, false);
  assert.equal(detail.dataset.savedInspectorState, 'selected');
  assert.match(detail.textContent, /Study the sizing/);
  const selected = f.section.querySelector('[data-saved-select-id="h1"]');
  assert.equal(selected.getAttribute('aria-expanded'), 'true');
  f.dom.dispatch(selected, 'focusin');
  assert.equal(f.overlay.hidden, true, 'the expanded item does not duplicate its detail in the preview');

  f.dom.dispatch(f.find('[data-saved-library-open]'), 'click');
  assert.deepEqual(f.opened, [['h1', 'h1']], 'open delegates to the existing Saved open controller');

  f.dom.dispatch(f.dom.document, 'keydown', { key: 'Escape' });
  assert.equal(f.find('[data-saved-library-open]'), null, 'Escape closes the detail');
  assert.equal(f.dom.document.activeElement.dataset.savedSelectId, 'h1', 'focus returns to the item');

  f.dom.dispatch(f.section.querySelector('[data-saved-select-id="future"]'), 'click');
  assert.equal(f.find('[data-saved-library-open]').disabled, true, 'unknown kinds stay unavailable');
});

test('stale load results are discarded after an owner change and never render', async () => {
  const pending = [];
  const f = mountLibrary({ listRecent: () => new Promise((resolve) => pending.push(resolve)) });
  f.controller.show();
  await settle();
  assert.equal(pending.length, 1);
  f.controller.ownerChanged();
  pending[0]([savedObject({ id: 'owner-A-private', title: 'A only' })]);
  await settle();
  assert.deepEqual(f.listIds(), []);
  assert.doesNotMatch(f.section.textContent, /A only/);
  assert.equal(f.controller.getState().itemCount, 0);

  f.dom.flushTimers();
  await settle();
  assert.equal(pending.length, 2, 'the visible library reloads for the new owner');
  pending[1]([savedObject({ id: 'owner-B', title: 'B only' })]);
  await settle();
  assert.deepEqual(f.listIds(), ['owner-B']);
});

test('a stale lifecycle scope is discarded without adopting results or showing an error', async () => {
  let stale = false;
  const scope = { assertCurrent() { if (stale) throw new Error('The identity lifecycle scope is stale'); }, isCurrent: () => !stale };
  let release;
  const f = mountLibrary({
    captureScope: async () => scope,
    listRecent: () => new Promise((resolve) => { release = resolve; }),
  });
  f.controller.show();
  await settle();
  stale = true;
  release([savedObject({ id: 'late', title: 'Late owner data' })]);
  await settle();
  assert.deepEqual(f.listIds(), []);
  assert.notEqual(f.controller.getState().status, 'error');
  assert.equal(f.errors.length, 0);
  assert.equal(f.dom.pendingTimers(), 1, 'a visible library retries for the current owner');
});

test('owner change synchronously clears query, tag options, preview, and detail before new data renders', async () => {
  const f = mountLibrary({ objects: twelve });
  f.controller.show();
  await settle();
  const search = f.find('[data-saved-library-search]');
  search.value = 'squeeze';
  f.dom.dispatch(search, 'input');
  f.dom.flushTimers();
  const sort = f.find('[data-saved-library-sort]');
  sort.value = 'created';
  f.dom.dispatch(sort, 'change');
  f.dom.dispatch(f.section.querySelector('[data-saved-select-id="obj-05"]'), 'click');
  f.dom.dispatch(f.section.querySelector('[data-saved-select-id="obj-05"]'), 'focusin');
  assert.equal(f.find('[data-saved-library-open]').dataset.savedLibraryOpen, 'obj-05');

  f.controller.ownerChanged();
  assert.equal(search.value, '');
  assert.deepEqual(f.listIds(), []);
  assert.equal(f.find('[data-saved-library-open]'), null);
  assert.equal(f.overlay.hidden, true);
  assert.deepEqual(f.find('[data-saved-library-tag]').options.map((option) => option.value), ['']);
  assert.equal(f.find('[data-saved-category-count="all"]').textContent, '0');
  assert.doesNotMatch(f.section.textContent, /Squeeze|Café/);
  const state = f.controller.getState();
  assert.equal(state.query.text, '');
  assert.equal(state.query.sort, 'updated');
  assert.equal(state.expandedId, null);
  assert.equal(f.calls.length, 1, 'no read happens synchronously during the clear');
});

test('invalidation while hidden marks dirty; visible invalidations coalesce; no polling', async () => {
  const f = mountLibrary({ objects: twelve });
  f.controller.invalidate();
  assert.equal(f.dom.pendingTimers(), 0);
  assert.equal(f.calls.length, 0, 'never-shown library does not load on invalidation');
  f.controller.show();
  await settle();
  assert.equal(f.calls.length, 1);

  f.controller.hide();
  f.controller.invalidate();
  f.controller.invalidate();
  assert.equal(f.dom.pendingTimers(), 0, 'hidden destination does not schedule a reload');
  assert.equal(f.controller.getState().dirty, true);
  await settle();
  assert.equal(f.calls.length, 1);

  f.controller.show();
  await settle();
  assert.equal(f.calls.length, 2, 'dirty library reloads on the next show');

  f.controller.invalidate();
  f.controller.invalidate();
  f.controller.invalidate();
  assert.equal(f.dom.pendingTimers(), 1, 'visible invalidations coalesce into one timer');
  f.dom.flushTimers();
  await settle();
  assert.equal(f.calls.length, 3);
  assert.equal(f.dom.pendingTimers(), 0, 'no follow-up polling timer');
});

test('committed local Saved writes (which emit no window event) mark the library dirty through the Saved service', async () => {
  const f = mountLibrary({ objects: twelve });
  assert.equal(f.mutationListeners.size, 1);
  f.controller.show();
  await settle();
  f.controller.hide();
  f.mutate();
  assert.equal(f.dom.pendingTimers(), 0, 'a save made elsewhere while Saved is hidden does not read');
  f.controller.show();
  await settle();
  assert.equal(f.calls.length, 2, 'returning to Saved shows the newly saved item');
  f.mutate();
  f.mutate();
  f.dom.flushTimers();
  await settle();
  assert.equal(f.calls.length, 3, 'visible mutations coalesce into one reload');
  f.controller.dispose();
  assert.equal(f.mutationListeners.size, 0, 'dispose unsubscribes');
});

test('search and filters persist across hide/show within one owner session', async () => {
  const f = mountLibrary({ objects: twelve });
  f.controller.show();
  await settle();
  const search = f.find('[data-saved-library-search]');
  search.value = 'pressure';
  f.dom.dispatch(search, 'input');
  f.dom.flushTimers();
  f.dom.dispatch(f.find('[data-saved-category="spots"]'), 'click');
  f.controller.hide();
  f.controller.show();
  await settle();
  assert.equal(f.calls.length, 1);
  assert.equal(search.value, 'pressure');
  assert.deepEqual(f.listIds(), ['obj-03', 'obj-07', 'obj-11']);
});

test('load errors show the existing error state and never keep a stale list as current', async () => {
  let fail = false;
  const f = mountLibrary({ listRecent: async () => { if (fail) throw new Error('quota'); return twelve; } });
  f.controller.show();
  await settle();
  assert.equal(f.listIds().length, 12);
  fail = true;
  f.controller.invalidate();
  f.dom.flushTimers();
  await settle();
  assert.deepEqual(f.listIds(), []);
  assert.match(f.find('[data-saved-library-list]').textContent, /Saved items could not be loaded\./);
  assert.equal(f.errors.length, 1);
  assert.equal(f.find('[data-saved-category-count="all"]').textContent, '0');
});

test('empty library keeps the accepted first-save state and routes through the injected navigator', async () => {
  const f = mountLibrary({ objects: [] });
  f.controller.show();
  await settle();
  const list = f.find('[data-saved-library-list]');
  assert.equal(list.dataset.libraryState, 'empty');
  assert.match(list.textContent, /Keep a decision worth returning to/);
  f.dom.dispatch(list.querySelector('[data-saved-library-navigate]'), 'click');
  assert.deepEqual(f.navigations, ['analyze']);
});

test('dispose is idempotent, removes owned listeners, timers, and DOM, and ignores later calls', async () => {
  const f = mountLibrary({ objects: twelve });
  assert.ok(f.dom.listenerCount() > f.baseListeners);
  f.controller.show();
  await settle();
  f.controller.invalidate();
  assert.equal(f.dom.pendingTimers(), 1);
  f.dom.dispatch(f.section.querySelector('[data-saved-select-id="obj-00"]'), 'pointerover');
  assert.equal(f.overlay.hidden, false);

  f.controller.dispose();
  assert.equal(f.dom.listenerCount(), f.baseListeners, 'every container/document/window listener is removed');
  assert.equal(f.dom.pendingTimers(), 0);
  assert.equal(f.section.childElementCount, 0, 'created slots are removed');
  assert.equal(f.overlay.hidden, true);
  assert.doesNotThrow(() => f.controller.dispose());
  f.controller.show();
  f.controller.invalidate();
  f.controller.ownerChanged();
  await settle();
  assert.equal(f.calls.length, 1);
  assert.equal(f.dom.pendingTimers(), 0);
});

test('logic.js keeps only wiring and routing; Home Recent keeps its own six-item rendering path', () => {
  assert.doesNotMatch(logic, /function renderSavedLibrary|function createSavedPokerPreview|homeSavedExpandedId|homeSavedCategory|homeSavedQuickPreviewOwner/);
  assert.match(logic, /window\.RiverlineSavedLibrary\.mount\(section, \{/);
  assert.match(logic, /captureLifecycleScope\?\.\('saved_study_objects'\)/);
  assert.match(logic, /riverline:savedstudychange[\s\S]*?savedLibraryController\?\.invalidate\(\)/);
  assert.match(logic, /riverline:studysyncchange[\s\S]*?savedLibraryController\?\.invalidate\(\)/);
  assert.match(logic, /function clearSavedOwnerPresentation[\s\S]*?savedLibraryController\?\.ownerChanged\(\)[\s\S]*?async function refreshHomeWorkspace/);
  const renderRecent = logic.slice(logic.indexOf('function renderHomeRecent'), logic.indexOf('function renderHomeReviewGroup'));
  assert.doesNotMatch(renderRecent, /activeNavigationDestination|renderSavedLibrary/);
  assert.match(renderRecent, /createHomeSavedItemElement\(item\)/);
  assert.match(html, /id="savedLibrarySection"[^>]*data-tutorial-anchor="saved-library"[^>]*hidden/);
  assert.match(html, /data-saved-library-controls data-tutorial-anchor="saved-library-find"/);
  assert.ok(html.indexOf('src/application/saved-library-workspace.mjs') < html.indexOf('src/core/logic.js'));
  assert.match(logic, /studyInbox\.hidden = state\.destination === 'saved'/);
});
