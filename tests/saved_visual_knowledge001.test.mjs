import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';

import { createHomeSavedItem } from '../app/src/application/home-view-model.mjs';
import { createSavedStudyPreviewFacts } from '../app/src/application/saved-study-preview-facts.mjs';
import { filterSavedLibraryItems, savedLibraryKindCounts } from '../app/src/application/saved-library-query.mjs';
import { createFakeDom, descendants } from './fixtures/saved-library-fake-dom.mjs';
import { StyleSheetModel, appStyleSheet, bootApp, freshIndexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: parsed markup, the cascade, and the page wiring in the booted
// app. Workspace-module sources are outside this ticket. Booting installs the
// page's fake timers; Node's are kept for the fake-DOM workspace tests.
const nodeTimers = { setTimeout: globalThis.setTimeout, setImmediate: globalThis.setImmediate, clearTimeout: globalThis.clearTimeout };
const page = await bootApp();
// Imported after boot: the workspace module self-installs its page bridge.
const { mountSavedLibrary } = await import('../app/src/application/saved-library-workspace.mjs');
const markup = freshIndexDocument();
const css = appStyleSheet();
const probe = (className, host = markup.body, attributes = {}) => {
  const element = markup.createElement('div');
  element.className = className;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  host.appendChild(element);
  return element;
};
// SOURCE-SHAPE: "the Saved block adds no clipping (overflow hidden/clip) and
// no Saved-specific card sizes" is a policy lint over the Saved block as
// authored (parsed, not regex-matched).
const savedSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('.saved-library-layout');
  return new StyleSheetModel(raw.slice(start, raw.indexOf('.home-dashboard-grid[data-product-destination="saved"] {', start)));
})();

const [modelSource, previewSource, translations, library, sharedPreview] = await Promise.all([
  readFile(new URL('../app/src/application/home-view-model.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/saved-study-preview-facts.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
  // SAVED-LIBRARY-001 moved Saved destination rendering from logic.js into this module.
  readFile(new URL('../app/src/application/saved-library-workspace.mjs', import.meta.url), 'utf8'),
  // SAVED-TRAINING-HISTORY-001 moved the card-tile builder into this shared module.
  readFile(new URL('../app/src/application/saved-poker-preview.mjs', import.meta.url), 'utf8'),
]);

const annotations = Object.freeze({
  title: 'Turn bluff-catcher',
  note: 'Review the river sizing.',
  tags: [{ display: 'River', key: 'river' }],
  reviewState: 'review_later',
  classifications: ['mistake'],
});

function mountQuickPreviewLibrary(objects) {
  const dom = createFakeDom();
  const section = dom.document.createElement('section');
  const overlay = dom.document.createElement('div');
  overlay.hidden = true;
  dom.document.body.append(section, overlay);
  const controller = mountSavedLibrary(section, {
    savedService: { listRecent: async () => objects },
    translate: (key) => key,
    presentation: { itemTitle: (item) => item.title || item.id, itemFacts: () => [] },
    overlay,
    openItem() {},
  });
  return { dom, section, overlay, controller };
}

function savedObject(kind, payload, id = `saved-${kind}`) {
  return {
    schemaVersion: 'saved-study-object/v1',
    id,
    annotations,
    kind,
    payload,
    createdAt: '2026-08-29T10:00:00.000Z',
    updatedAt: '2026-08-30T10:00:00.000Z',
  };
}

function handPayload(holeCards) {
  return {
    heroPlayerId: 'Hero',
    pokerState: {
      schemaVersion: 'poker-state/v1',
      game: { mode: 'off' },
      players: [
        { playerId: 'Hero', position: 'BTN', holeCards },
        { playerId: 'Villain', position: 'BB', holeCards: { state: 'hidden' } },
      ],
      street: 'turn',
      phase: 'betting',
      board: ['Qc', '7d', '2s', 'Jh'],
      potMilliBb: 12500,
    },
  };
}

test('Saved library projections remain SavedStudyObject v1 facts and preserve unknown cards', () => {
  const known = createHomeSavedItem(savedObject('hand', handPayload(['As', 'Kh'])));
  assert.equal(known.schemaVersion, 'home-saved-item/v1');
  assert.equal(known.previewSchemaVersion, 'saved-study-preview-facts/v1');
  assert.deepEqual(known.heroCards, ['As', 'Kh']);
  assert.deepEqual(known.board, ['Qc', '7d', '2s', 'Jh']);
  assert.equal(known.note, annotations.note);
  assert.equal(known.potBb, 12.5);
  assert.equal(known.historyStatus, 'canonical_replay');

  const unknown = createHomeSavedItem(savedObject('hand', handPayload({ state: 'hidden' }), 'unknown-hero'));
  assert.equal(unknown.heroCards, null);
  assert.equal(JSON.stringify(unknown).includes('Villain'), false);
  assert.throws(() => createHomeSavedItem({ ...savedObject('hand', handPayload(null)), schemaVersion: 'saved-study-object/v2' }), /SavedStudyObject v1/);
});

test('DOM-free preview facts preserve revealed opponents and omit unrevealed holdings', () => {
  const payload = handPayload(['As', 'Kh']);
  payload.pokerState.players.push(
    { playerId: 'Revealed', seat: 2, position: 'SB', holeCards: ['Ad', 'Ac'] },
  );
  const facts = createSavedStudyPreviewFacts(savedObject('hand', payload));
  assert.deepEqual(facts.knownOpponentHands, [{
    playerId: 'Revealed', seat: 2, position: 'SB', cards: ['Ad', 'Ac'],
  }]);
  assert.equal(JSON.stringify(facts).includes('Villain'), false);
  assert.equal(Object.isFrozen(facts), true);
  assert.doesNotMatch(previewSource, /document|window|HTMLElement|createElement|applyAction|applyChance|reconstruct|evaluate|StrategyProvider|Equity/);
  assert.match(modelSource, /createSavedStudyPreviewFacts\(object\)/);
});

test('Saved Scenario preview is explicitly lossy and uses only its stored DecisionContext', () => {
  const item = createHomeSavedItem(savedObject('spot', {
    derivation: 'scenario',
    decisionContext: {
      tableSize: 6,
      rakeMode: 'off',
      heroPosition: 'BTN',
      street: 'flop',
      heroCards: ['As', 'Kh'],
      board: ['Qc', '7d', '2s'],
      stackBb: 100,
      potBb: 6.5,
      facingSizeBb: 0,
      callAmountBb: 0,
    },
    truth: { historyStatus: 'not_available' },
  }));
  assert.equal(item.kind, 'spot');
  assert.equal(item.derivation, 'scenario');
  assert.equal(item.historyStatus, 'not_available');
  assert.deepEqual(item.heroCards, ['As', 'Kh']);
  assert.equal(Object.hasOwn(item, 'actionHistory'), false);
  for (const unavailable of ['currentActor', 'button', 'opponentHoldings', 'foldedPlayers', 'contributions', 'opponentCount']) {
    assert.equal(Object.hasOwn(item, unavailable), false, unavailable);
  }
  assert.match(library, /Scenario study snapshot · no canonical Hand history/);
});

test('unknown future Saved kinds remain unsupported and are never projected as Spots', () => {
  const facts = createSavedStudyPreviewFacts(savedObject('future_kind', { schemaVersion: 'future/v1' }));
  assert.equal(facts.kind, 'future_kind');
  assert.equal(facts.supported, false);
  assert.equal(facts.derivation, 'unsupported');
  assert.equal(facts.historyStatus, 'not_available');
  assert.equal(Object.hasOwn(facts, 'potBb'), false);
  assert.doesNotMatch(JSON.stringify(facts), /spot/i);
});

// Retargeted by SAVED-COMPOSITION-002: the 440px card grid became dense rows beside a
// reserved inspector column (the review §C list + inspector). Detail stays on request.
test('Saved defaults to a dense list beside a reserved inspector and expands detail only on request', () => {
  assert.ok(markup.querySelector('#savedLibrarySection [data-saved-library-body]'));
  assert.match(library, /const layout = el\('div', 'saved-library-layout saved-split'\);[\s\S]*?const list = el\('div', 'saved-list'\);[\s\S]*?layout\.append\(listSurface, detail\)/);
  assert.equal(css.cascaded(probe('saved-split', markup.getElementById('savedLibrarySection')), 'grid-template-columns', { width: 1920 }), 'minmax(0, 1fr) var(--saved-inspector-width)');
  // SHELL-001: Saved uses the one shared canvas frame (no per-workspace frame override).
  const home = markup.getElementById('homeMode');
  const inner = probe('saved-frame-probe', home);
  const frame = (destination) => { home.dataset.productDestination = destination; return css.cascaded(inner, '--workspace-frame-max', { width: 1920 }); };
  assert.equal(frame('saved'), frame('home'));
  assert.equal(css.cascaded(markup.documentElement, '--workspace-frame-standard'), 'var(--canvas-max)');
  assert.match(library, /let expandedId = null/);
  assert.match(library, /if \(!model\.results\.some[\s\S]*?expandedId = null/);
  assert.doesNotMatch(library, /expandedId = (?:model\.results|items)\[0\]\.id/);
  assert.match(library, /node\.setAttribute\('aria-expanded', String\(selected\)\)/);

  const detailStart = library.indexOf('function renderDetail');
  const detailEnd = library.indexOf('function libraryEmptyState', detailStart + 1);
  const detailRenderer = library.slice(detailStart, detailEnd);
  assert.equal((detailRenderer.match(/savedLibraryOpen: item\.id/g) || []).length, 1);
  assert.match(detailRenderer, /'ui-button saved-library-open'[\s\S]*?variant: 'primary', savedLibraryOpen/);
  assert.match(detailRenderer, /savedDetailClose: 'true'/);
  assert.doesNotMatch(detailRenderer, /openSavedItem|PokerState|evaluate|Equity|StrategyProvider/);
});

test('hover and keyboard focus share a viewport-aware preview owned outside the clipping workspace', () => {
  const overlay = markup.getElementById('savedQuickPreviewOverlay');
  assert.equal(overlay.closest('.shell'), null, 'the overlay lives outside the clipping workspace');
  assert.ok(precedes(markup.querySelector('.shell'), overlay));
  const quick = probe('saved-library-quick-preview', overlay);
  assert.equal(css.cascaded(quick, 'position'), 'fixed');
  quick.hidden = true;
  assert.equal(css.cascaded(quick, 'display'), 'none');
  quick.hidden = false;
  // Hover/focus on a row never reveals a CSS-only preview inside it.
  const item = probe('saved-library-item', markup.getElementById('savedLibrarySection'));
  const nested = probe('saved-library-quick-preview', item);
  const resting = css.cascaded(nested, 'display');
  for (const state of ['hover', 'focus-visible']) assert.equal(css.cascaded(nested, 'display', { states: [state], stateElement: item }), resting, state);
  const itemRenderer = library.slice(library.indexOf('function createItemElement'), library.indexOf('function itemTruth'));
  assert.doesNotMatch(itemRenderer, /saved-library-quick-preview/);
  assert.match(library, /function positionPreview[\s\S]*?getBoundingClientRect[\s\S]*?view\.innerWidth[\s\S]*?view\.innerHeight[\s\S]*?useAbove/);
  assert.match(library, /function onPreviewEnter[\s\S]*?showPreview\(owner\)[\s\S]*?'pointerover', onPreviewEnter[\s\S]*?'focusin', onPreviewEnter/);
  assert.match(library, /\[container, 'pointerout', handlePreviewExit\]/);
  assert.match(library, /\[container, 'focusout', handlePreviewExit\]/);
  // SAVED-COMPOSITION-002: selecting a row selects (no toggle-off); Escape and Close
  // close the inspector without rebuilding the list.
  assert.match(library, /function select\(id[\s\S]*?expandedId = id;[\s\S]*?applySelection\(\)/);
  assert.match(library, /function closeInspector\(\)[\s\S]*?expandedId = null;[\s\S]*?applySelection\(\)/);
  assert.match(library, /event\.key !== 'Escape'[\s\S]*?hidePreview\(\)[\s\S]*?closeInspector\(\)/);
  assert.match(library, /data-saved-detail-close[\s\S]*?closeInspector\(\)/);
  assert.match(`${library}\n${sharedPreview}`, /dataset\.savedPreviewDerivation = item\.derivation/);
  const scenarioPreview = probe('saved-poker-preview', markup.getElementById('savedLibrarySection'), { 'data-saved-preview-derivation': 'scenario' });
  assert.equal(css.cascaded(scenarioPreview, 'border-style'), 'dashed');
});

// The quick-preview exit handler is now a mounted-controller closure, so these
// keep the same inert/dismiss invariants through real delegated events.
test('Saved pointerout is inert when no quick-preview owner exists', async () => {
  const f = mountQuickPreviewLibrary([savedObject('hand', handPayload(['As', 'Kh']), 'h1')]);
  f.controller.show();
  await new Promise((resolve) => nodeTimers.setImmediate(resolve));
  f.overlay.hidden = false;
  const search = f.section.querySelector('[data-saved-library-search]');
  assert.doesNotThrow(() => f.dom.dispatch(search, 'pointerout', { relatedTarget: null }));
  assert.equal(f.overlay.hidden, false);
});

test('Saved focusout is inert when no quick-preview owner exists', async () => {
  const f = mountQuickPreviewLibrary([savedObject('hand', handPayload(['As', 'Kh']), 'h1')]);
  f.controller.show();
  await new Promise((resolve) => nodeTimers.setImmediate(resolve));
  f.overlay.hidden = false;
  const search = f.section.querySelector('[data-saved-library-search]');
  assert.doesNotThrow(() => f.dom.dispatch(search, 'focusout', { relatedTarget: null }));
  assert.equal(f.overlay.hidden, false);
});

test('Saved quick-preview exit still dismisses the active owner', async () => {
  const f = mountQuickPreviewLibrary([savedObject('hand', handPayload(['As', 'Kh']), 'h1')]);
  f.controller.show();
  await new Promise((resolve) => nodeTimers.setImmediate(resolve));
  const owner = f.section.querySelector('[data-saved-select-id="h1"]');
  f.dom.dispatch(owner, 'pointerover');
  assert.equal(f.overlay.hidden, false);
  f.dom.dispatch(owner, 'pointerout', { relatedTarget: f.dom.document.body });
  assert.equal(f.overlay.hidden, true);
});

test('All, Hands, and Spots remain visible and filter actual bounded Saved objects truthfully', async () => {
  const f = mountQuickPreviewLibrary([]);
  f.controller.show();
  await new Promise((resolve) => nodeTimers.setImmediate(resolve));
  const categories = descendants(f.section).filter((node) => node.dataset.savedCategory);
  assert.deepEqual(categories.map((node) => node.dataset.savedCategory), ['all', 'hands', 'spots']);
  for (const category of ['all', 'hands', 'spots']) {
    assert.equal(f.section.querySelector(`[data-saved-category-count="${category}"]`).textContent, '0');
  }
  assert.doesNotMatch(categories.map((node) => node.textContent).join(' '), /Training|Equity/);

  const items = [
    { id: 'h1', kind: 'hand' },
    { id: 's1', kind: 'spot' },
    { id: 'future1', kind: 'future_kind' },
  ];
  assert.deepEqual({ ...savedLibraryKindCounts(items) }, { all: 3, hands: 1, spots: 1 });
  assert.deepEqual(filterSavedLibraryItems(items, { kind: 'all' }).map(({ id }) => id), ['h1', 's1', 'future1']);
  assert.deepEqual(filterSavedLibraryItems(items, { kind: 'hands' }).map(({ id }) => id), ['h1']);
  assert.deepEqual(filterSavedLibraryItems(items, { kind: 'spots' }).map(({ id }) => id), ['s1']);
  assert.deepEqual(filterSavedLibraryItems([{ id: 's1', kind: 'spot' }], { kind: 'hands' }), []);
  assert.match(library, /No saved Hands yet\.[\s\S]*?Save a Hand from Hand or Review/);
  assert.match(library, /No saved Spots yet\.[\s\S]*?Save a Spot from Analyze or Review/);
  assert.doesNotMatch(library.slice(library.indexOf('const CATEGORY_LABELS'), library.indexOf('const REVIEW_LABELS')), /training|equity/i);
});

test('Saved cards consume shared presentation sizes without Saved clipping hacks', () => {
  // The page hands the library the shared card presentation.
  const descriptor = Object.getOwnPropertyDescriptor(page.window, 'RiverlineSavedLibrary');
  const mounts = [];
  Object.defineProperty(page.window, 'RiverlineSavedLibrary', { ...descriptor, value: Object.freeze({
    ...descriptor.value,
    mount(section, options) { mounts.push(options); return descriptor.value.mount(section, options); },
  }) });
  try {
    page.call('mountSavedLibraryWorkspace');
  } finally {
    Object.defineProperty(page.window, 'RiverlineSavedLibrary', descriptor);
  }
  assert.ok(mounts[0].getCardPresentation() === page.window.RiverlineCardPresentation);
  assert.equal(page.evaluate('typeof savedCardPresentation'), 'undefined');
  assert.match(`${library}\n${sharedPreview}`, /presentation\.appendCardFaceContents/);
  assert.match(`${library}\n${sharedPreview}`, /variant === 'detail' \? 'compact' : variant === 'quick' \? 'result' : 'mini'/);
  assert.doesNotMatch(`${library}\n${sharedPreview}`, /suit: \{ c:|data\.tone|savedCardPresentation/);
  for (const rule of savedSheet.rules) {
    for (const { property, value } of rule.declarations) {
      if (property.startsWith('overflow')) assert.doesNotMatch(value, /hidden|clip/, rule.selectors.join(', '));
    }
    if (rule.selectors.includes('.saved-preview-card')) {
      for (const { property } of rule.declarations) assert.ok(!['inline-size', 'block-size'].includes(property), property);
    }
  }
});

test('empty, Guest, type, note, and locale truth remain explicit without fabricated study facts', async () => {
  assert.match(library, /Saved Hands and Spots you intentionally keep will appear here\./);
  // A Guest Home states what stays on the device and that it does not sync.
  await page.navigate('home');
  await page.call('refreshHomeWorkspace');
  await page.settle(300);
  const homeText = text(page.byId('homeMode'));
  assert.match(homeText, /Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode/);
  assert.match(homeText, /Guest data does not sync\./);
  assert.match(library, /item\.note[\s\S]*?Study note/);
  assert.match(library, /item\.kind === 'hand' \? 'Hand' : item\.kind === 'spot' \? 'Spot'/);
  // Home rows say when an item was updated, from its stored timestamp only.
  const updated = page.call('homeSavedItemFacts', { kind: 'hand', updatedAt: new Date(Date.now() - 60_000).toISOString() });
  const recency = page.call('homeRecency', new Date(Date.now() - 60_000).toISOString());
  assert.ok(recency);
  assert.deepEqual(updated, [`${page.call('t', 'Updated')} ${recency}`]);
  assert.deepEqual(page.call('homeSavedItemFacts', { kind: 'hand' }), [], 'no timestamp, no recency');
  assert.doesNotMatch(`${modelSource}\n${library}`, /mastery|EV loss|solver correctness|progress percentage|resolveStrategy|calculateEquity/iu);
  for (const key of ['Stored poker preview', 'Open Hand', 'Open Spot', 'Study note', 'Unknown card', 'Updated', 'View details', 'Close details']) {
    assert.equal((translations.match(new RegExp(`'${key}'`, 'g')) || []).length >= 2, true, key);
  }
});

test('identity invalidation clears private Saved presentation before a late owner load can render', async () => {
  await page.navigate('home');
  await page.settle(300);
  page.byId('homeRecentContent').replaceChildren(page.document.createElement('article'));
  page.evaluate('activeSavedSpotContext = { private: true }');
  const object = { id: 'owner-a', kind: 'spot', revision: 1, lifecycle: { state: 'active' }, source: {}, payload: {},
    annotations: { title: 'A', note: '', tags: [], reviewState: 'none', classifications: [] } };
  page.call('openSavedStudyEditor', object);
  const sequence = page.evaluate('homeRefreshSequence');
  const controller = page.evaluate('savedLibraryController');
  let ownerChanged = 0;
  page.window.__wrappedLibrary = Object.create(controller, { ownerChanged: { value: (...args) => { ownerChanged += 1; return controller.ownerChanged(...args); } } });
  page.evaluate('savedLibraryController = window.__wrappedLibrary');
  const playbook = page.window.callPlaybookStateBridge;
  const calls = [];
  page.window.callPlaybookStateBridge = (method, ...args) => {
    calls.push(method);
    if (method === 'createReplayProjectionViewModel') return { viewerContext: { kind: 'saved_hand' } };
    if (method === 'closeSavedHand') return null;
    return playbook(method, ...args);
  };
  const spy = page.spy(['closeSavedStudyEditor']);
  try {
    page.call('clearSavedOwnerPresentation');
  } finally {
    spy.restore();
    page.window.callPlaybookStateBridge = playbook;
    page.window.__wrappedLibrary = controller;
    page.evaluate('savedLibraryController = window.__wrappedLibrary');
    delete page.window.__wrappedLibrary;
  }
  assert.equal(page.evaluate('homeRefreshSequence'), sequence + 1);
  assert.equal(page.byId('homeRecentContent').children.length, 0);
  assert.equal(ownerChanged, 1);
  assert.equal(page.evaluate('activeSavedSpotContext'), null);
  assert.ok(calls.includes('closeSavedHand'));
  assert.equal(spy.count('closeSavedStudyEditor'), 1);
  assert.equal(page.byId('savedStudyModal').hidden, true);
  // Identity and auth owner changes clear private state synchronously, before
  // the delayed reload.
  const refresh = page.spy(['scheduleHomeRefresh', 'clearSavedOwnerPresentation', 'refreshHomeWorkspace']);
  try {
    page.window.dispatchEvent(new page.window.CustomEvent('riverline:identitychange', { detail: { reason: 'identity_activated' } }));
    assert.ok(refresh.calls.scheduleHomeRefresh.some(([options]) => options?.clearPrivateState === true));
    assert.ok(refresh.count('clearSavedOwnerPresentation') >= 1, 'cleared synchronously');
    assert.equal(refresh.count('refreshHomeWorkspace'), 0, 'the reload is deferred');
    refresh.reset();
    page.window.dispatchEvent(new page.window.CustomEvent('riverline:authchange', { detail: { status: 'guest', signedIn: false, ownerKey: 'visual-knowledge-owner' } }));
    assert.ok(refresh.calls.scheduleHomeRefresh.some(([options]) => options?.clearPrivateState === true));
    await page.settle(300);
    assert.ok(refresh.count('refreshHomeWorkspace') >= 1);
  } finally {
    refresh.restore();
  }
});
