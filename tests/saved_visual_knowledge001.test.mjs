import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createHomeSavedItem } from '../app/src/application/home-view-model.mjs';
import { createSavedStudyPreviewFacts } from '../app/src/application/saved-study-preview-facts.mjs';

const [html, css, logic, modelSource, previewSource, translations] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-view-model.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/saved-study-preview-facts.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
]);

const annotations = Object.freeze({
  title: 'Turn bluff-catcher',
  note: 'Review the river sizing.',
  tags: [{ display: 'River', key: 'river' }],
  reviewState: 'review_later',
  classifications: ['mistake'],
});

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
  assert.match(logic, /Scenario study snapshot · no canonical Hand history/);
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

test('Saved defaults to a compact width-filling collection and expands detail only on request', () => {
  assert.match(html, /id="savedLibraryLayout"[\s\S]*?id="homeRecentContent"[\s\S]*?id="homeSavedDetail"/);
  assert.match(css, /home-saved-list[\s\S]*?repeat\(auto-fill, minmax\(min\(100%, 440px\), 1fr\)\)/);
  assert.match(css, /#homeMode\[data-product-destination="saved"\][\s\S]*?--workspace-frame-max: var\(--workspace-frame-wide\)/);
  assert.match(logic, /let homeSavedExpandedId = null/);
  assert.match(logic, /if \(!items\.some[\s\S]*?homeSavedExpandedId = null/);
  assert.doesNotMatch(logic, /homeSavedExpandedId = items\[0\]\.id/);
  assert.match(logic, /control\.setAttribute\('aria-expanded', String\(expanded\)\)/);

  const detailStart = logic.indexOf('function renderSavedLibraryDetail');
  const detailEnd = logic.indexOf('function renderSavedLibrary', detailStart + 1);
  const detailRenderer = logic.slice(detailStart, detailEnd);
  assert.equal((detailRenderer.match(/dataset\.homeSavedId/g) || []).length, 1);
  assert.match(detailRenderer, /ui-button--primary saved-library-open/);
  assert.match(detailRenderer, /dataset\.savedDetailClose/);
  assert.doesNotMatch(detailRenderer, /openSavedItem|PokerState|evaluate|Equity|StrategyProvider/);
});

test('hover and keyboard focus share a viewport-aware preview owned outside the clipping workspace', () => {
  assert.ok(html.indexOf('id="savedQuickPreviewOverlay"') > html.indexOf('</div> <!-- /.shell -->'));
  assert.match(css, /\.saved-library-quick-preview\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(css, /\.saved-library-quick-preview\[hidden\]\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /saved-library-item:is\(:hover, :focus-visible\)[\s\S]*saved-library-quick-preview/);
  const itemRenderer = logic.slice(logic.indexOf('function createSavedLibraryItemElement'), logic.indexOf('function savedItemTruth'));
  assert.doesNotMatch(itemRenderer, /saved-library-quick-preview/);
  assert.match(logic, /function positionSavedQuickPreview[\s\S]*?getBoundingClientRect[\s\S]*?window\.innerWidth[\s\S]*?window\.innerHeight[\s\S]*?useAbove/);
  assert.match(logic, /pointerover[\s\S]*?showSavedQuickPreview\(owner\)[\s\S]*?focusin[\s\S]*?showSavedQuickPreview\(owner\)/);
  assert.match(logic, /pointerout[\s\S]*?hideSavedQuickPreview[\s\S]*?focusout[\s\S]*?hideSavedQuickPreview/);
  assert.match(logic, /homeSavedExpandedId = homeSavedExpandedId === id \? null : id/);
  assert.match(logic, /event\.key !== 'Escape'[\s\S]*?hideSavedQuickPreview\(\)[\s\S]*?homeSavedExpandedId = null[\s\S]*?renderSavedLibrary/);
  assert.match(logic, /data-saved-detail-close[\s\S]*?homeSavedExpandedId = null/);
  assert.match(logic, /dataset\.savedPreviewDerivation = item\.derivation/);
  assert.match(css, /saved-preview-derivation="scenario"[\s\S]*?border-style: dashed/);
});

test('All, Hands, and Spots remain visible and filter actual bounded Saved objects truthfully', () => {
  for (const category of ['all', 'hands', 'spots']) {
    assert.match(html, new RegExp(`data-saved-category="${category}"[\\s\\S]*?data-saved-category-count="${category}">0`));
  }
  assert.doesNotMatch(html.slice(html.indexOf('id="savedLibraryCategories"'), html.indexOf('id="savedLibraryLayout"')), /Training|Equity/);

  const start = logic.indexOf('function savedLibraryCategoryModel');
  const end = logic.indexOf('function renderSavedLibraryCategories', start);
  const implementation = logic.slice(start, end);
  const categoryModel = Function('homeSavedCategory', `${implementation}; return savedLibraryCategoryModel;`)('all');
  const items = [
    { id: 'h1', kind: 'hand' },
    { id: 's1', kind: 'spot' },
    { id: 'future1', kind: 'future_kind' },
  ];
  const all = categoryModel(items, 'all');
  assert.deepEqual(all.counts, { all: 3, hands: 1, spots: 1 });
  assert.deepEqual(all.items.map(({ id }) => id), ['h1', 's1', 'future1']);
  assert.deepEqual(categoryModel(items, 'hands').items.map(({ id }) => id), ['h1']);
  assert.deepEqual(categoryModel(items, 'spots').items.map(({ id }) => id), ['s1']);
  assert.deepEqual(categoryModel([{ id: 's1', kind: 'spot' }], 'hands').items, []);
  assert.match(logic, /No saved Hands yet\.[\s\S]*?Save a Hand from Hand or Review/);
  assert.match(logic, /No saved Spots yet\.[\s\S]*?Save a Spot from Analyze or Review/);
  assert.doesNotMatch(implementation, /training|equity/i);
});

test('Saved cards consume shared presentation sizes without Saved clipping hacks', () => {
  const savedCssStart = css.indexOf('.saved-library-layout');
  const savedCssEnd = css.indexOf('.home-dashboard-grid[data-product-destination="saved"] {', savedCssStart);
  const savedCss = css.slice(savedCssStart, savedCssEnd);
  assert.match(logic, /window\.RiverlineCardPresentation/);
  assert.match(logic, /presentation\.appendCardFaceContents/);
  assert.match(logic, /variant === 'detail' \? 'compact' : variant === 'quick' \? 'result' : 'mini'/);
  assert.doesNotMatch(logic, /suit: \{ c:|data\.tone|savedCardPresentation/);
  assert.doesNotMatch(savedCss, /overflow:\s*(?:hidden|clip)/);
  assert.doesNotMatch(savedCss, /\.saved-preview-card\s*\{[^}]*inline-size|\.saved-preview-card\s*\{[^}]*block-size/s);
});

test('empty, Guest, type, note, and locale truth remain explicit without fabricated study facts', () => {
  assert.match(logic, /Saved Hands and Spots you intentionally keep will appear here\./);
  assert.match(logic, /Saved study belongs to a signed-in Riverline profile/);
  assert.match(logic, /Signing in does not enable sync or cloud backup\./);
  assert.match(logic, /item\.note[\s\S]*?Study note/);
  assert.match(logic, /item\.kind === 'hand' \? 'Hand' : item\.kind === 'spot' \? 'Spot'/);
  assert.match(logic, /facts\.push\(`\$\{t\('Updated'\)\} \$\{recency\}`\)/);
  assert.doesNotMatch(`${modelSource}\n${logic.slice(logic.indexOf('function createSavedPreviewCard'), logic.indexOf('function renderHomeContinue'))}`, /mastery|EV loss|solver correctness|progress percentage|resolveStrategy|calculateEquity/iu);
  for (const key of ['Stored poker preview', 'Open Hand', 'Open Spot', 'Study note', 'Unknown card', 'Updated', 'View details', 'Close details']) {
    assert.equal((translations.match(new RegExp(`'${key}'`, 'g')) || []).length >= 2, true, key);
  }
});

test('identity invalidation clears private Saved presentation before a late owner load can render', () => {
  const clearStart = logic.indexOf('function clearSavedOwnerPresentation');
  const clearEnd = logic.indexOf('async function refreshHomeWorkspace', clearStart);
  const clear = logic.slice(clearStart, clearEnd);
  assert.match(clear, /\+\+homeRefreshSequence/);
  assert.match(clear, /homeSavedExpandedId = null/);
  assert.match(clear, /homeRecentContent[\s\S]*?replaceChildren/);
  assert.match(clear, /renderSavedLibraryDetail\(null\)/);
  assert.match(clear, /activeSavedSpotContext = null/);
  assert.match(clear, /closeSavedHand/);
  assert.match(clear, /closeSavedStudyEditor/);

  const scheduleStart = logic.indexOf('function scheduleHomeRefresh');
  const scheduleEnd = logic.indexOf('function restoreSavedSpotPresentation', scheduleStart);
  const schedule = logic.slice(scheduleStart, scheduleEnd);
  assert.ok(schedule.indexOf('clearSavedOwnerPresentation()') < schedule.indexOf('setTimeout'), 'owner data clears before delayed reload');
  assert.match(logic, /sequence !== homeRefreshSequence \|\| activeWorkspaceMode\(\) !== 'home'/);
  assert.match(logic, /riverline:identitychange[\s\S]*?scheduleHomeRefresh\(\{ clearPrivateState: true \}\)/);
  assert.match(logic, /riverline:authchange[\s\S]*?scheduleHomeRefresh\(\{ clearPrivateState: true \}\)/);
});
