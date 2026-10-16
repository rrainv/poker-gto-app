// SAVED-COMPOSITION-002: Saved toolbar, dense rows, keyboard model, sticky inspector,
// auto-titles from stored facts, Archive, completed-Hand pot and Training facing wording.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createFakeDom, descendants } from './fixtures/saved-library-fake-dom.mjs';
import { appStyleSheet, bootApp, freshIndexDocument, precedes } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: parsed markup, the cascade, and the page wiring in the booted
// app with stubbed bridges. Booting installs the page's fake timers: Node's
// are kept for the fake-DOM workspace tests.
const nodeSetImmediate = globalThis.setImmediate;
const page = await bootApp();
// Imported after boot: several of these modules self-install page bridges.
const { mountSavedLibrary } = await import('../app/src/application/saved-library-workspace.mjs');
const { mountSavedTrainingHistory } = await import('../app/src/application/saved-training-history-workspace.mjs');
const { createHomeSavedItem } = await import('../app/src/application/home-view-model.mjs');
const { createSavedStudyPreviewFacts } = await import('../app/src/application/saved-study-preview-facts.mjs');
const {
  savedItemAutoTitle,
  savedItemFactGrid,
  savedItemMetaFacts,
  savedItemTitle,
} = await import('../app/src/application/saved-item-presentation.mjs');
const { trainingMemoryContextSummary } = await import('../app/src/application/training-memory-row-format.mjs');
const markup = freshIndexDocument();
const css = appStyleSheet();
const probe = (className, host = markup.body, tag = 'div', attributes = {}) => {
  const element = markup.createElement(tag);
  element.className = className;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  host.appendChild(element);
  return element;
};
/** Temporarily replace a frozen page bridge with an overriding copy. */
async function withBridge(name, overrides, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(page.window, name);
  Object.defineProperty(page.window, name, { ...descriptor, value: overrides === null ? undefined : Object.freeze({ ...descriptor.value, ...overrides }) });
  try { return await callback(); } finally { Object.defineProperty(page.window, name, descriptor); }
}

const [library, history, bootstrap, sourceController, tutorialBootstrap] = await Promise.all([
  '../app/src/application/saved-library-workspace.mjs',
  '../app/src/application/saved-training-history-workspace.mjs',
  '../app/src/application/saved-study-object-bootstrap.mjs',
  '../app/src/application/saved-study-object-source-controller.mjs',
  '../app/src/application/tutorial-bootstrap.mjs',
].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

const FACING_EN = Object.freeze({
  'facing.detail.unopened': 'unopened · {price}',
  'facing.detail.wager': 'facing {facing} · {price}',
  'facing.price.toCall': '{call} to call',
  'facing.price.unavailable': 'price unavailable',
});
const interpolate = (key, parameters) => {
  const template = FACING_EN[key] ?? key;
  return parameters ? template.replace(/\{(\w+)\}/g, (_, name) => String(parameters[name])) : template;
};
const settle = () => new Promise((resolve) => nodeSetImmediate(resolve));

function handObject({ id, title = null, phase = 'betting', potMilliBb = 1500, heroActions = 1, board = [] } = {}) {
  const actionHistory = Array.from({ length: heroActions }, (_, index) => ({ sequence: index, playerId: 'Hero' }));
  return {
    schemaVersion: 'saved-study-object/v1',
    id,
    kind: 'hand',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    payload: {
      heroPlayerId: 'Hero',
      pokerState: {
        schemaVersion: 'poker-state/v1',
        game: { mode: 'off' },
        players: [
          { playerId: 'Hero', position: 'BTN', holeCards: ['Ks', 'Js'], currentStackMilliBb: 98000 },
          { playerId: 'Villain', position: 'BB', holeCards: { state: 'hidden' }, currentStackMilliBb: 102000 },
        ],
        street: 'river',
        phase,
        board,
        potMilliBb,
        actionHistory,
      },
    },
    annotations: { title, note: null, tags: [], reviewState: 'none', classifications: [] },
  };
}

function spotObject({ id, title = null, heroCards = ['Ks', 'Js'], aggressorPosition = 'BB', stackBb = 100 } = {}) {
  return {
    schemaVersion: 'saved-study-object/v1',
    id,
    kind: 'spot',
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    payload: {
      derivation: 'scenario',
      decisionContext: {
        tableSize: 6, rakeMode: 'off', heroPosition: 'BTN', street: 'river', heroCards,
        board: ['Qc', '7d', '2s', 'Jh', '3c'], stackBb, potBb: 12, facingSizeBb: 6, callAmountBb: 6,
        priorActionSummary: { aggressorPosition },
      },
      truth: { historyStatus: 'not_available' },
    },
    annotations: { title, note: null, tags: [], reviewState: 'none', classifications: [] },
  };
}

function mountLibrary(objects, extra = {}) {
  const dom = createFakeDom();
  const section = dom.document.createElement('section');
  const overlay = dom.document.createElement('div');
  overlay.hidden = true;
  dom.document.body.append(section, overlay);
  const opened = [];
  const edited = [];
  const archived = [];
  const controller = mountSavedLibrary(section, {
    savedService: { listRecent: async () => objects, subscribeLocalMutations: () => () => {} },
    translate: interpolate,
    presentation: { recency: () => 'today' },
    overlay,
    openItem: (id, control, options) => opened.push([id, options]),
    editItem: (id) => edited.push(id),
    archiveItem: async (id) => { archived.push(id); },
    ...extra,
  });
  const find = (selector) => section.querySelector(selector);
  const rows = () => section.querySelectorAll('[data-saved-select-id]');
  const row = (id) => rows().find((node) => node.dataset.savedSelectId === id);
  const key = (target, value) => dom.dispatch(target, 'keydown', { key: value });
  return { dom, section, controller, opened, edited, archived, find, rows, row, key };
}

// ---------------------------------------------------------------- composition

test('one toolbar row holds view tabs, search, chips, selects, Mistakes toggle, Clear and the result count', async () => {
  assert.equal(markup.querySelector('#homeSavedOverview, #savedLibraryTitle, [data-i18n="Library"]'), null,
    'the duplicated "Saved Hands & Spots" and "Library" title panels are gone');
  const toolbar = markup.querySelector('#savedLibrarySection [data-saved-toolbar]');
  assert.ok(toolbar.classList.contains('saved-toolbar') && toolbar.classList.contains('panel'));
  assert.ok(toolbar.firstElementChild.matches('.saved-view-toggle[data-saved-view-toggle]'));
  assert.ok(toolbar.querySelector('[data-saved-library-controls]'));
  const trainingControls = toolbar.lastElementChild;
  assert.ok(trainingControls.matches('[data-saved-training-controls]'));
  assert.equal(trainingControls.hidden, true);
  assert.equal(trainingControls.children.length, 0);
  // The Saved destination shows only the library section of Home.
  await page.navigate('saved');
  const homeSections = {
    overview: page.byId('homeAccountOverview'),
    guest: page.byId('homeGuestAccount'),
    continue: page.byId('homeContinueContent')?.closest('.home-section'),
    review: page.byId('homeReviewContent')?.closest('.home-section'),
    recent: page.byId('homeRecentContent')?.closest('.home-section'),
    library: page.byId('savedLibrarySection'),
    other: page.byId('homeOtherTitle')?.closest('.home-section'),
  };
  assert.deepEqual(Object.entries(homeSections).filter(([, node]) => node && !node.hidden).map(([key]) => key), ['library']);
  await page.navigate('home');
  assert.equal(page.byId('savedLibrarySection').hidden, true);

  const f = mountLibrary([handObject({ id: 'h1' }), spotObject({ id: 's1' })]);
  f.controller.show();
  await settle();
  const controls = f.find('[data-saved-library-controls]');
  const order = controls.children.map((node) => node.className.split(' ')[0]);
  assert.deepEqual(order, ['saved-library-search', 'saved-library-categories', 'saved-library-filters', 'saved-library-status']);
  const filters = controls.children[2];
  assert.deepEqual(filters.children.map((node) => node.dataset.savedLibraryMistakes !== undefined ? 'mistakes'
    : node.dataset.savedLibraryClear !== undefined ? 'clear' : node.className.split(' ')[0]),
  ['saved-library-filter', 'saved-library-filter', 'saved-library-filter', 'mistakes', 'clear']);
  const mistakes = f.find('[data-saved-library-mistakes]');
  assert.equal(mistakes.tagName, 'button');
  assert.equal(mistakes.dataset.variant, 'filter');
  assert.equal(mistakes.getAttribute('aria-pressed'), 'false');
  assert.equal(controls.children[3].textContent, 'Showing all 2');
  assert.equal(controls.children[3].getAttribute('role'), 'status');
  assert.equal(css.cascaded(probe('saved-library-status', markup.getElementById('savedLibrarySection')), 'margin-inline-start'), 'auto');
});

test('rows are dense: mini cards in an LTR island, title, meta, state badges and updated time', async () => {
  const f = mountLibrary([handObject({ id: 'h1', board: ['Qc', '7d', '2s'] })]);
  f.controller.show();
  await settle();
  const row = f.row('h1');
  assert.match(row.className, /saved-library-item ui-row/);
  const [cards, copy, aside] = row.children;
  const [states, time] = aside.children;
  const preview = cards.children[0];
  assert.match(preview.className, /saved-poker-preview--row/);
  assert.deepEqual(preview.querySelectorAll('[data-card-size]').map((node) => node.getAttribute('aria-label')), ['Ks', 'Js', 'Qc', '7d', '2s']);
  assert.ok(descendants(preview).filter((node) => /poker-island/.test(node.className)).every((node) => node.dir === 'ltr'));
  assert.match(copy.textContent, /K♠J♠ · BTN · River/);
  assert.match(states.className, /saved-row-states/);
  assert.equal(time.textContent, 'today');
  const rowPreview = probe('saved-poker-preview saved-poker-preview--row', markup.getElementById('savedLibrarySection'));
  markup.documentElement.setAttribute('dir', 'rtl');
  try { assert.equal(css.cascaded(rowPreview, 'direction'), 'ltr'); } finally { markup.documentElement.removeAttribute('dir'); }
});

test('keyboard: Up/Down/Home/End move selection and focus, Enter opens, Escape closes the inspector', async () => {
  const f = mountLibrary([handObject({ id: 'a' }), spotObject({ id: 'b' }), spotObject({ id: 'c' })]);
  f.controller.show();
  await settle();
  const ids = f.rows().map((node) => node.dataset.savedSelectId);
  assert.deepEqual(f.rows().map((node) => node.tabIndex), [0, -1, -1], 'one tab stop into the list');
  f.dom.dispatch(f.row(ids[0]), 'click');
  assert.equal(f.dom.document.activeElement, f.row(ids[0]));
  const down = f.key(f.row(ids[0]), 'ArrowDown');
  assert.equal(down.defaultPrevented, true);
  assert.equal(f.controller.getState().expandedId, ids[1]);
  assert.equal(f.dom.document.activeElement, f.row(ids[1]), 'focus follows the selection');
  assert.equal(f.row(ids[1]).getAttribute('aria-current'), 'true');
  assert.deepEqual(f.rows().map((node) => node.tabIndex), [-1, 0, -1]);
  f.key(f.row(ids[1]), 'End');
  assert.equal(f.controller.getState().expandedId, ids[2]);
  f.key(f.row(ids[2]), 'ArrowDown');
  assert.equal(f.controller.getState().expandedId, ids[2], 'Down stops at the last row');
  f.key(f.row(ids[2]), 'Home');
  assert.equal(f.controller.getState().expandedId, ids[0]);
  f.key(f.row(ids[0]), 'ArrowUp');
  assert.equal(f.controller.getState().expandedId, ids[0], 'Up stops at the first row');

  const enter = f.key(f.row(ids[0]), 'Enter');
  assert.equal(enter.defaultPrevented, true, 'Enter does not also click (select) the row');
  assert.deepEqual(f.opened, [[ids[0], { handReview: 'none' }]]);

  f.dom.document.activeElement = f.row(ids[0]);
  const escape = f.dom.dispatch(f.row(ids[0]), 'keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.controller.getState().expandedId, null);
  assert.equal(f.dom.document.activeElement, f.row(ids[0]), 'focus stays on the row');
  assert.equal(f.find('[data-saved-inspector-state]').dataset.savedInspectorState, 'empty');
});

test('selecting a row never rebuilds or moves the list; the inspector column is always reserved', async () => {
  const f = mountLibrary([handObject({ id: 'a' }), spotObject({ id: 'b' })]);
  f.controller.show();
  await settle();
  const list = f.find('[data-saved-library-list]');
  const before = [...list.childNodes];
  const inspector = f.find('[data-saved-inspector-state]');
  assert.equal(inspector.hidden, false, 'reserved before any selection');
  assert.equal(inspector.dataset.savedInspectorState, 'empty');
  assert.ok(inspector.querySelector('[data-saved-inspector-empty]'));
  f.dom.dispatch(before[1], 'click');
  f.key(before[1], 'ArrowUp');
  assert.deepEqual([...list.childNodes], before, 'same row nodes, same order: the list did not move');
  assert.equal(inspector.dataset.savedInspectorState, 'selected');
  const split = probe('saved-split', markup.getElementById('savedLibrarySection'));
  assert.equal(css.cascaded(split, 'grid-template-columns', { width: 1920 }), 'minmax(0, 1fr) var(--saved-inspector-width)');
  assert.equal(css.cascaded(split, 'align-items', { width: 1920 }), 'start');
  assert.equal(css.cascaded(split, '--saved-inspector-width', { width: 1920 }), 'clamp(380px, 30vw, 560px)');
  assert.equal(css.cascaded(probe('saved-inspector', split), 'position', { width: 1920 }), 'sticky');
  const home = markup.getElementById('homeMode');
  home.dataset.productDestination = 'saved';
  assert.equal(css.cascaded(home, 'overflow-y', { width: 1920 }), 'visible',
    'the non-scrolling mode view must not capture the sticky inspector');
});

test('inspector: title, kind badge, cards, fact grid, note, tags, review state; one primary action', async () => {
  const f = mountLibrary([handObject({ id: 'done', phase: 'terminal', potMilliBb: 0 }), handObject({ id: 'live' }), spotObject({ id: 's' })]);
  f.controller.show();
  await settle();
  f.dom.dispatch(f.row('done'), 'click');
  const inspector = f.find('[data-saved-inspector-state]');
  assert.equal(inspector.querySelector('[data-saved-preview-kind]').dataset.savedPreviewKind, 'hand');
  const facts = inspector.querySelectorAll('[data-saved-fact]').map((node) => node.dataset.savedFact);
  assert.deepEqual(facts, ['players', 'position', 'street', 'stack', 'result', 'origin', 'updated'], 'no pot for an awarded Hand');
  assert.match(inspector.textContent, /Review state[\s\S]*Study note[\s\S]*No note yet\.[\s\S]*Tags[\s\S]*No tags/);
  const buttons = descendants(inspector).filter((node) => node.tagName === 'button');
  assert.deepEqual(buttons.filter((node) => node.dataset.variant === 'primary').map((node) => node.textContent), ['Open replay']);
  assert.deepEqual(buttons.map((node) => node.textContent), ['Close', 'Open replay', 'Review decisions', 'Edit', 'Archive']);

  f.dom.dispatch(inspector.querySelector('[data-saved-library-review]'), 'click');
  assert.deepEqual(f.opened.at(-1), ['done', { handReview: 'open' }]);
  f.dom.dispatch(inspector.querySelector('[data-saved-library-open]'), 'click');
  assert.deepEqual(f.opened.at(-1), ['done', { handReview: 'none' }]);
  f.dom.dispatch(inspector.querySelector('[data-saved-library-edit]'), 'click');
  assert.deepEqual(f.edited, ['done'], 'Edit opens the existing transactional editor');

  f.dom.dispatch(f.row('live'), 'click');
  assert.equal(inspector.querySelector('[data-saved-library-review]'), null, 'an unfinished Hand cannot be reviewed yet');
  f.dom.dispatch(f.row('s'), 'click');
  assert.equal(inspector.querySelector('[data-saved-library-review]'), null, 'Spots have no duplicate Analyze action');
  assert.equal(inspector.querySelector('[data-saved-library-open]').textContent, 'Open spot');
  // The page opens Review for a saved Hand only when asked, or by default
  // when the Hand is complete and has Hero decisions.
  const homeBridge = page.window.callHomeBridge;
  const playbookBridge = page.window.callPlaybookStateBridge;
  const openReview = page.window.openCanonicalHandReview;
  let reviews = 0;
  let journal = null;
  let completed = null;
  page.window.callHomeBridge = async (method) => (method === 'openSavedItem' ? { kind: 'hand', object: { payload: {} } } : homeBridge(method));
  page.window.callPlaybookStateBridge = (method, ...args) => (method === 'getHeroDecisionJournal' ? journal
    : method === 'getCompletedHandResult' ? completed : playbookBridge(method, ...args));
  page.window.openCanonicalHandReview = () => { reviews += 1; };
  try {
    for (const [options, decisions, done, expected] of [
      [undefined, true, true, 1], [undefined, true, false, 0], [undefined, false, true, 0],
      [{ handReview: 'open' }, false, false, 1], [{ handReview: 'none' }, true, true, 0],
    ]) {
      reviews = 0;
      journal = { decisions: decisions ? [{ decisionId: 'd1' }] : [] };
      completed = done ? { status: 'complete' } : null;
      await page.call('openHomeSavedItem', 'saved-hand', null, options);
      assert.equal(reviews, expected, JSON.stringify({ options, decisions, done }));
    }
  } finally {
    page.window.callHomeBridge = homeBridge;
    page.window.callPlaybookStateBridge = playbookBridge;
    page.window.openCanonicalHandReview = openReview;
    playbookBridge('closeSavedHand');
    await page.navigate('home');
  }
});

test('a reload after an edit keeps the selection and returns focus to the same inspector control', async () => {
  const f = mountLibrary([handObject({ id: 'a' }), spotObject({ id: 'b' })]);
  f.controller.show();
  await settle();
  f.dom.dispatch(f.row('b'), 'click');
  const edit = f.find('[data-saved-library-edit]');
  edit.focus();
  f.controller.invalidate();
  f.dom.flushTimers();
  await settle();
  const replacement = f.find('[data-saved-library-edit]');
  assert.notEqual(replacement, edit, 'the inspector was rebuilt');
  assert.equal(f.controller.getState().expandedId, 'b');
  assert.equal(f.dom.document.activeElement, replacement);
});

test('Archive is labelled Archive, is danger-quiet, confirms first and archives once', async () => {
  const f = mountLibrary([handObject({ id: 'a' }), spotObject({ id: 'b' })]);
  f.controller.show();
  await settle();
  f.dom.dispatch(f.row('a'), 'click');
  const archive = f.find('[data-saved-library-archive]');
  assert.equal(archive.textContent, 'Archive');
  assert.equal(archive.dataset.variant, 'danger');
  assert.equal(archive.dataset.emphasis, 'quiet');
  assert.doesNotMatch(library, /'Delete'|Archive \/ remove/);
  f.dom.dispatch(archive, 'click');
  assert.deepEqual(f.archived, [], 'the first click only asks');
  assert.ok(f.find('[data-saved-archive-confirmation]'));
  f.dom.dispatch(f.find('[data-saved-archive-keep]'), 'click');
  assert.equal(f.find('[data-saved-archive-confirmation]'), null, 'Keep saved item cancels');
  f.dom.dispatch(f.find('[data-saved-library-archive]'), 'click');
  f.dom.dispatch(f.find('[data-saved-archive-confirm]'), 'click');
  await settle();
  assert.deepEqual(f.archived, ['a']);
  assert.deepEqual(f.rows().map((node) => node.dataset.savedSelectId), ['b'], 'the archived item leaves the list');
  assert.ok(f.dom.document.activeElement === f.row('b'), 'focus moves to the neighbouring row');
  const quiet = probe('ui-button', markup.body, 'button', { 'data-variant': 'danger', 'data-emphasis': 'quiet' });
  assert.equal(css.cascaded(quiet, 'background'), 'transparent');
  assert.equal(css.cascaded(quiet, 'border-color'), 'transparent');
  assert.match(sourceController, /async archiveById\(id, \{ expectedRevision = null \} = \{\}\) \{[\s\S]*?application\.archive\(id[\s\S]*?objectCache\.delete\(key\)/);
  assert.match(bootstrap, /'archiveCurrent', 'archiveById'\]/);
  // The page archives by id with the revision it just read.
  const archives = [];
  await withBridge('RiverlineSavedStudyObjects', {
    getById: async (id) => ({ id, revision: 7 }),
    archiveById: async (...args) => { archives.push(args); },
  }, () => page.call('archiveSavedLibraryItem', 'saved-a'));
  assert.deepEqual(archives, [['saved-a', { expectedRevision: 7 }]]);
});

// ---------------------------------------------------------------- titles and facts

test('auto-titles come only from stored preview facts; missing facts are omitted, never invented', async () => {
  assert.equal(savedItemAutoTitle({ kind: 'hand', heroCards: ['Ks', 'Js'], heroPosition: 'BTN', street: 'river' }), 'K♠J♠ · BTN · River');
  assert.equal(savedItemAutoTitle({ kind: 'spot', heroCards: ['Ks', 'Js'], heroPosition: 'BTN', aggressorPosition: 'BB', street: 'river' }),
    'K♠J♠ · BTN vs BB · River');
  assert.equal(savedItemAutoTitle({ kind: 'spot', heroCards: null, heroPosition: 'BTN', street: 'preflop', stackBb: 100 }),
    'BTN · Preflop · 100 bb', 'without Hero cards the stored stack identifies the spot');
  assert.equal(savedItemAutoTitle({ kind: 'spot', heroCards: ['Ks', null], heroPosition: 'CO', street: 'flop' }), 'CO · Flop',
    'a partly unknown hand is not shown as cards');
  assert.equal(savedItemAutoTitle({ kind: 'spot', heroPosition: 'BTN', aggressorPosition: 'BTN', street: 'turn' }), 'BTN · Turn');
  assert.equal(savedItemAutoTitle({ kind: 'hand', aggressorPosition: 'BB', heroPosition: 'SB' }), 'SB',
    'Hands never claim an opponent from a field they do not store');
  assert.equal(savedItemAutoTitle({ kind: 'hand' }), 'Saved Hand');
  assert.equal(savedItemAutoTitle({ kind: 'future_kind' }), 'Saved item');

  const spot = createHomeSavedItem(spotObject({ id: 's' }));
  assert.equal(spot.aggressorPosition, 'BB', 'the aggressor comes from the frozen DecisionContext');
  assert.equal(savedItemTitle(spot), 'K♠J♠ · BTN vs BB · River');
  // The page's titles are the shared presentation's titles.
  const calls = [];
  const presentation = page.window.RiverlineSavedItemPresentation;
  await withBridge('RiverlineSavedItemPresentation', {
    title: (...args) => { calls.push(args); return presentation.title(...args); },
  }, () => page.call('homeSavedItemTitle', spot));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], spot);
  assert.equal(calls[0][1], page.window.t);
  assert.equal(page.call('homeSavedItemTitle', spot), page.window.RiverlineSavedItemPresentation.title(spot, page.window.t));
});

test('a user title always wins over the auto-title', async () => {
  assert.equal(savedItemTitle({ kind: 'hand', title: 'Flop c-bet sizing check', heroCards: ['Ks', 'Js'], heroPosition: 'BTN' }), 'Flop c-bet sizing check');
  assert.equal(savedItemTitle({ kind: 'hand', title: '   ', heroPosition: 'BTN', street: 'flop' }), 'BTN · Flop', 'blank titles are not titles');
  const f = mountLibrary([handObject({ id: 'mine', title: 'Mon titre שלי' })]);
  f.controller.show();
  await settle();
  assert.match(f.row('mine').textContent, /Mon titre שלי/);
  assert.doesNotMatch(f.row('mine').textContent, /K♠J♠/);
});

test('completed saved Hands never show "Pot 0 bb" (QA-SWEEP-024); live Hands keep their stored pot', () => {
  const done = createSavedStudyPreviewFacts(handObject({ id: 'done', phase: 'terminal', potMilliBb: 0 }));
  assert.equal(done.handComplete, true);
  assert.equal(done.potBb, null, 'the awarded pot is omitted, not reported as 0');
  assert.equal(done.heroDecisionCount, 1);
  const live = createSavedStudyPreviewFacts(handObject({ id: 'live', potMilliBb: 4500, heroActions: 0 }));
  assert.equal(live.potBb, 4.5);
  assert.equal(live.handComplete, false);
  assert.equal(live.heroDecisionCount, 0);
  const doneItem = createHomeSavedItem(handObject({ id: 'done', phase: 'terminal', potMilliBb: 0 }));
  assert.doesNotMatch(savedItemMetaFacts(doneItem).join(' · '), /Pot/);
  assert.deepEqual(savedItemFactGrid(doneItem).map((fact) => fact.key), ['players', 'position', 'street', 'stack', 'result', 'origin']);
  assert.match(savedItemMetaFacts(createHomeSavedItem(handObject({ id: 'live' }))).join(' · '), /Pot 1\.5 bb/);
  assert.doesNotMatch(savedItemMetaFacts({ kind: 'spot', potBb: 0 }).join(' '), /Pot 0/);
  // Home Recent reads the same omitted pot.
  assert.doesNotMatch(page.call('homeSavedItemFacts', doneItem).join(' '), /Pot/);
  assert.match(page.call('homeSavedItemFacts', createHomeSavedItem(handObject({ id: 'live', potMilliBb: 4500 }))).join(' '), /Pot/);
});

// ---------------------------------------------------------------- Training history

function trainingRecord(id, answeredAt, context) {
  return {
    id, status: 'answered', sessionId: 's1', mode: 'varied', answeredAt, shownAt: answeredAt,
    decisionContext: context, userResponse: { action: { type: 'fold' } }, learningEvidence: {},
    reviewState: { state: 'none' }, strategyEvidence: null, decisionSource: { kind: 'generated', heroPlayerId: 'Hero' },
  };
}
const unopenedBtn = Object.freeze({
  heroCards: ['Ts', '3s'], board: [], street: 'preflop', heroPosition: 'BTN', effectiveStackBb: 100,
  currentPotBb: 1.5, callAmountBb: 1, facingSizeBb: 1, heroStackBb: 100,
  priorActionSummary: { aggressionCount: 0, limperCount: 0, facingActionFamily: 'none', aggressionFamily: 'none' },
});

test('Training history words the price through decision-facing-summary (QA-DECISION-INPUT-009, Saved part)', () => {
  const saved = trainingMemoryContextSummary(unopenedBtn, interpolate, { facing: 'summary' });
  assert.equal(saved.spotParts.at(-1), 'Unopened · 1 bb to call');
  assert.doesNotMatch(saved.spot, /Facing 1 bb/);
  const memory = trainingMemoryContextSummary(unopenedBtn, interpolate);
  assert.equal(memory.spotParts.at(-1), 'Facing 1 bb', 'the Training Memory panel output is unchanged (outside this ticket)');
  assert.match(history, /trainingMemoryContextSummary\(item\.context, t, \{ facing: 'summary' \}\)/);
});

function mountHistory(records) {
  const dom = createFakeDom();
  const section = dom.document.createElement('section');
  dom.document.body.append(section);
  const calls = { getById: [], redrill: [], context: [] };
  const controller = mountSavedTrainingHistory(section, {
    getTrainingMemory: () => ({ listRecentAnsweredDecisions: async () => ({ decisions: records, sessions: [{ id: 's1' }], bounded: false }) }),
    savedService: { async getById(id) { calls.getById.push(id); return null; }, async saveHandDerivedSpot() { throw new Error('unused'); } },
    translate: interpolate,
    presentationGate: () => ({ feedbackEmbargoed: false, revealAnswerAndReference: true, revealReviewReasons: true }),
    openRedrill: (id, kind) => calls.redrill.push([id, kind]),
    publishContext: (parts) => calls.context.push(parts),
  });
  const input = section.querySelectorAll('[data-saved-view-option]').find((node) => node.value === 'training');
  return { dom, section, controller, calls, input, rows: () => section.querySelectorAll('[data-training-history-id]') };
}

test('Training history uses the same layout: toolbar filters, rows, inspector with Same Spot primary', async () => {
  const records = [trainingRecord('t1', '2026-09-03T10:00:00.000Z', unopenedBtn), trainingRecord('t2', '2026-09-02T10:00:00.000Z', unopenedBtn)];
  const f = mountHistory(records);
  f.controller.show();
  f.input.checked = true;
  f.dom.dispatch(f.input, 'change');
  await settle();
  const controls = f.section.querySelector('[data-saved-training-controls]');
  assert.equal(controls.hidden, false);
  assert.ok(controls.querySelector('[data-training-history-mode="all"]'));
  assert.equal(controls.querySelector('[data-training-history-unsure]').dataset.variant, 'filter');
  assert.equal(controls.querySelector('[data-training-history-queued]').getAttribute('aria-pressed'), 'false');
  assert.match(controls.textContent, /Showing all 2/);
  assert.deepEqual(f.calls.context.at(-1), ['Showing all 2'], 'the header context follows the shown view');
  const [first] = f.rows();
  assert.match(first.className, /ui-row/);
  assert.match(first.textContent, /T♠3♠ · BTN · Preflop/);
  assert.match(first.textContent, /Unopened · 1 bb to call/);
  assert.doesNotMatch(first.textContent, /Facing 1 bb/);

  f.dom.dispatch(first, 'click');
  const inspector = f.section.querySelector('[data-saved-inspector-state]');
  const buttons = descendants(inspector).filter((node) => node.tagName === 'button');
  assert.deepEqual(buttons.filter((node) => node.dataset.variant === 'primary').map((node) => node.textContent), ['Same Spot']);
  assert.deepEqual(buttons.filter((node) => node.dataset.variant === 'secondary').map((node) => node.textContent), ['Similar Spot', 'Save as Spot']);
  assert.equal(inspector.querySelector('[data-saved-library-edit]'), null, 'Training Memory evidence is read-only');
  assert.equal(inspector.querySelector('[data-saved-library-archive]'), null);

  const enter = f.dom.dispatch(first, 'keydown', { key: 'Enter' });
  assert.equal(enter.defaultPrevented, true);
  assert.deepEqual(f.calls.redrill, [['t1', 'same_spot']]);
});

test('Training history keyboard browsing coalesces the Saved lookup to the row the user stops on', async () => {
  const records = ['t1', 't2', 't3'].map((id, index) => trainingRecord(id, `2026-09-0${3 - index}T10:00:00.000Z`, unopenedBtn));
  const f = mountHistory(records);
  f.controller.show();
  f.input.checked = true;
  f.dom.dispatch(f.input, 'change');
  await settle();
  const [r1] = f.rows();
  f.dom.dispatch(r1, 'click');
  await settle();
  await settle();
  assert.equal(f.calls.getById.length, 1, 'a click looks up its decision immediately');
  const list = f.section.querySelector('[data-training-history-list]');
  const before = [...list.childNodes];
  f.dom.dispatch(f.rows()[0], 'keydown', { key: 'ArrowDown' });
  f.dom.dispatch(f.rows()[1], 'keydown', { key: 'ArrowDown' });
  assert.deepEqual([...list.childNodes], before, 'arrowing never rebuilds the list');
  assert.equal(f.controller.getState().expandedId, 't3');
  assert.equal(f.dom.document.activeElement.dataset.trainingHistoryId, 't3');
  assert.equal(f.controller.getState().savedStates.t2, undefined, 'a passed-over row is not left "checking"');
  assert.equal(f.dom.pendingTimers(), 1);
  f.dom.flushTimers();
  await settle();
  await settle();
  assert.equal(f.calls.getById.length, 2, 'one more lookup, for t3 only');
  const escape = f.dom.dispatch(f.dom.document, 'keydown', { key: 'Escape' });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.controller.getState().expandedId, null);
});

test('the Saved library mounts even when the Saved bridge installs after init (QA-SAVED-COMPOSITION-003)', async () => {
  assert.match(bootstrap, /value: bridge, writable: false,\s*\}\);[\s\S]*?dispatchEvent\(new CustomEvent\('riverline:savedstudybridgeready'\)\)[\s\S]*?return bridge;/);
  page.evaluate('savedLibraryController?.dispose(); savedLibraryController = null');
  // Without the Saved bridge an early mount returns without recursing.
  await withBridge('RiverlineSavedStudyObjects', null, async () => {
    page.call('syncSavedLibraryVisibility');
    page.call('mountSavedLibraryWorkspace');
    assert.equal(page.evaluate('savedLibraryController'), null);
  });
  // The bridge-ready event mounts it once the bridge exists.
  page.window.dispatchEvent(new page.window.CustomEvent('riverline:savedstudybridgeready'));
  await page.settle(50);
  assert.ok(page.evaluate('savedLibraryController'));
  // A later visibility sync also mounts lazily.
  page.evaluate('savedLibraryController?.dispose(); savedLibraryController = null');
  page.call('syncSavedLibraryVisibility');
  assert.ok(page.evaluate('savedLibraryController'));
});

test('Saved composition keeps ownership, bounds and invalidation; it adds no load path', () => {
  assert.match(library, /deps\.savedService\.listRecent\(\{ limit \}\)/);
  assert.equal((library.match(/listRecent\(/g) || []).length, 1, 'still one bounded read');
  assert.doesNotMatch(library, /getById|updateAnnotations|localStorage|indexedDB|StrategyProvider|calculateEquity/);
  assert.match(library, /subscribeLocalMutations\(\(\) => invalidate\(\)\)/);
  assert.doesNotMatch(history, /updateStudyMetadata|markReviewed|snooze|localStorage|indexedDB/);
  const scripts = markup.querySelectorAll('script[src]');
  const script = (path) => scripts.find((node) => node.getAttribute('src').split('?')[0] === path);
  assert.ok(precedes(script('src/application/saved-item-presentation.mjs'), script('src/application/saved-library-workspace.mjs')));
  assert.ok(precedes(script('src/application/saved-library-workspace.mjs'), script('src/core/logic.js')));
  assert.match(tutorialBootstrap, /'saved-library-ready': \(\) => elementShown\('#savedLibrarySection'\)/,
    'the Saved tour precondition follows the library, not the removed overview panel');
});
