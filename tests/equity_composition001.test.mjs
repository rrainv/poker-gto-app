import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  EQUITY_METHODS,
  EQUITY_REQUEST_SCHEMA_VERSION,
  calculateEquityExact,
} from '../shared/poker-domain/index.js';
import { createRangeAnalysisFacts } from '../app/src/application/range-analysis.mjs';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the Equity workspace is driven in the booted app (player
// count, hand pickers, a real calculation, stale invalidation, Hand Analysis),
// markup is parsed and styling resolved through the cascade. Several
// EQUITY-COMPOSITION-001R layout literals were superseded by the later
// two-column Equity canvas; effective values are asserted and noted.
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const handAnalysis = fs.readFileSync(new URL('../app/src/application/equity-hand-analysis.mjs', import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const equityMarkup = markup.getElementById('equityMode');
const equity = () => app.window.app.equity;
const playerIds = () => app.evaluate('app.equity.players.map(({ id }) => id)');
const footers = () => app.$$('#equityPlayers .equity-player-card .equity-player-footer');
const analysisContent = () => app.byId('equityHandAnalysisContent');

await app.navigate('equity');

async function setPlayerCount(count) {
  await app.click(`[data-equity-player-count="${count}"]`);
  await app.settle(100);
}

async function calculateMatchup() {
  await setPlayerCount(2);
  const [hero, villain] = playerIds();
  await app.pickCards(`[data-equity-edit-hand="${hero}"]`, ['Ah', 'Kh']);
  await app.click(`[data-equity-hand-mode="known"][data-player-id="${villain}"]`);
  await app.pickCards(`[data-equity-edit-hand="${villain}"]`, ['Qs', 'Qd']);
  await app.pickCards('[data-card-set-edit="eqboard"]', ['Qh', 'Jh', '2c']);
  await app.click('#calculate');
  await app.settle(3000);
  assert.equal(equity().lifecycle, 'complete');
}

test('2, 6, and 10 players use one genuine two-column gallery with bounded vertical overflow only', async () => {
  for (const count of [2, 6, 10]) assert.ok(equityMarkup.querySelector(`[data-equity-player-count="${count}"]`), count);
  for (const count of [2, 6, 10]) {
    await setPlayerCount(count);
    assert.equal(equity().players.length, count);
    assert.equal(app.byId('equityPlayers').dataset.playerCount, String(count));
    assert.equal(app.$$('#equityPlayers .equity-player-card').length, count);
  }
  // The player count is clamped to 2–10.
  app.call('setEquityPlayerCount', 20);
  assert.equal(equity().players.length, 10);
  app.call('setEquityPlayerCount', 1);
  assert.equal(equity().players.length, 2);
  // Superseded: the 2-up, 654px vertically scrolling list became an auto-fit
  // gallery; it still never scrolls horizontally, at any width.
  const list = app.$('.equity-player-list');
  for (const width of [1920, 1440, 600]) {
    assert.equal(css.cascaded(list, 'grid-template-columns', { width }), 'repeat(auto-fit, minmax(190px, 240px))', width);
    assert.doesNotMatch(css.cascaded(list, 'overflow-x', { width }) || 'visible', /auto|scroll/, width);
  }
});

test('player tiles retain fixed geometry and one result footer through setup, running, completed, and stale states', async () => {
  // Superseded: the fixed 216px tile became content-height with fixed head
  // and footer tracks (28px head, 152px body, >=56px footer).
  const card = app.$('.equity-player-card');
  assert.match(css.cascaded(card, 'grid-template-rows'), /^28px 152px\b/);
  // Superseded: a later Equity pass deliberately gives each tile a thin
  // series-coloured top rule; the inline-start edge stays neutral.
  assert.equal(css.cascaded(card, 'border-block-start'), '2px solid var(--series-color, var(--accent-primary))');
  assert.doesNotMatch(css.cascaded(card, 'border-inline-start') || '', /--series-color/);
  assert.ok(card.querySelector('.equity-player-identity > i.series-marker'));
  // One footer per tile; setup state first.
  for (const tile of app.$$('#equityPlayers .equity-player-card')) assert.equal(tile.querySelectorAll('.equity-player-footer').length, 1);
  assert.ok(footers().every((footer) => footer.dataset.resultState === 'setup'));
  // Tiles carry only identity, the hand editor and the result footer (no
  // structural facts, outs or read-only cards).
  assert.equal(app.$('#equityPlayers .equity-dossier-section, #equityPlayers .equity-outs, #equityPlayers .training-readonly-card'), null);
  await calculateMatchup();
  for (const footer of footers()) {
    assert.equal(footer.dataset.resultState, 'complete');
    assert.equal(text(footer.querySelector('.equity-result-primary > span')), 'Equity');
    const labels = footer.querySelectorAll('.equity-result-metrics > div > span').map((span) => text(span));
    assert.deepEqual(labels, ['Equity', 'Win', 'Tie']);
    for (const value of footer.querySelectorAll('.equity-result-metrics strong')) assert.ok(value.classList.contains('poker-data-token'));
  }
  // Changing inputs keeps the last result as stale.
  const last = equity().lastResult;
  await app.pickCards('[data-card-set-edit="eqdead"]', ['3s']);
  assert.equal(equity().staleResult, last);
  assert.ok(footers().every((footer) => footer.dataset.resultState === 'stale'));
});

test('stable player identity is the single private-hand authority for picker, tile, readiness, and request', async () => {
  await setPlayerCount(2);
  const [hero, villain] = playerIds();
  await app.pickCards(`[data-equity-edit-hand="${hero}"]`, ['Ah', 'Kh']);
  assert.equal(app.call('equityHandGroup', hero), `equity-hand-${hero}`);
  assert.equal(app.call('equityPlayerFromHandGroup', `equity-hand-${hero}`), equity().players[0]);
  assert.deepEqual(app.call('groupCards', `equity-hand-${hero}`), equity().players[0].cards);
  // The picker wrote into the player's own cards; the tile editor reflects them.
  assert.deepEqual(equity().players[0].cards, ['Ah', 'Kh']);
  assert.deepEqual(app.$$(`[data-equity-edit-hand="${hero}"] [data-card-id]`).map((slot) => slot.dataset.cardId), ['Ah', 'Kh']);
  // Unknown hands enter the request as null; a partial hand is not ready.
  await app.click(`[data-equity-hand-mode="unknown"][data-player-id="${villain}"]`);
  const request = app.call('equityRequestFromCurrentInputs');
  assert.deepEqual(request.players.map(({ id, cards }) => [id, cards]), [[hero, ['Ah', 'Kh']], [villain, null]]);
  await app.click(`[data-equity-hand-mode="known"][data-player-id="${villain}"]`);
  await app.pickCards(`[data-equity-edit-hand="${villain}"]`, ['9s']);
  assert.equal(app.byId('calculate').disabled, true, 'a one-card hand is not ready');
  // No per-player selection ownership exists.
  assert.equal(app.evaluate('typeof selectEquityPlayer'), 'undefined');
  assert.equal(app.evaluate('"selectedPlayerId" in app.equity'), false);
  assert.equal(app.$('#equityMode [data-equity-select-player], #equityMode [data-selected]'), null);
});

test('Board, Dead Cards, and calculation remain the stable center poker region', () => {
  const [players, center, dossier] = ['.equity-player-panel', '.equity-center-column', '.equity-dossier-panel'].map((selector) => equityMarkup.querySelector(selector));
  assert.ok(precedes(players, center) && precedes(center, dossier));
  const cards = center.querySelector('.panel.equity-cards-panel');
  const board = cards.querySelector('[data-slots="eqboard"]');
  const dead = cards.querySelector('[data-slots="eqdead"]');
  const strip = center.querySelector('.equity-calculation-strip');
  assert.ok(board && dead && strip);
  assert.ok(precedes(board, dead) && precedes(dead, strip));
  const copy = text(center);
  assert.ok(copy.indexOf('Flop') < copy.indexOf('Turn') && copy.indexOf('Turn') < copy.indexOf('River'));
  const advanced = equityMarkup.querySelector('#equityAdvanced');
  assert.equal(advanced.localName, 'details');
  assert.equal(advanced.firstElementChild.localName, 'summary');
  assert.equal(advanced.hasAttribute('open'), false);
  // Superseded: the three-column grid became the two-column Equity canvas;
  // its columns never depend on the calculation state.
  const workspace = app.$('.equity-workspace');
  const columns = css.cascaded(workspace, 'grid-template-columns');
  for (const state of ['running', 'complete']) {
    workspace.dataset.equityState = state;
    assert.equal(css.cascaded(workspace, 'grid-template-columns'), columns, state);
  }
  app.call('setEquityCompositionState', equity().lifecycle === 'complete' ? 'complete' : 'stale');
});

test('the permanent Hand Analysis rail exposes global facts once and every player without selection ownership', async () => {
  const rail = equityMarkup.querySelector('#equityHandAnalysis');
  for (const className of ['panel', 'equity-dossier-panel', 'equity-hand-analysis-panel']) assert.ok(rail.classList.contains(className), className);
  assert.equal(text(rail.querySelector('#equityHandAnalysisTitle')), 'Hand Analysis');
  assert.ok(rail.querySelector('#equityHandAnalysisContent'));
  assert.match(text(equityMarkup.querySelector('#equityDetails')), /Calculation evidence/);
  assert.ok(equityMarkup.querySelector('[data-future-analysis-home]'));
  assert.doesNotMatch(equityMarkup.innerHTML, /Selected player|headlineEquity|giant/i);
  await calculateMatchup();
  const content = analysisContent();
  // Board analysis once; then every player with current hand, exact outcome
  // and structural outs, each with its equity and secondary metrics.
  assert.equal(content.querySelectorAll('[data-dossier-section="board-analysis"]').length, 1);
  const players = content.querySelectorAll('.equity-player-analysis');
  assert.deepEqual(players.map((node) => node.dataset.playerId), playerIds());
  for (const player of players) {
    assert.equal(player.localName, 'section');
    assert.ok(player.querySelector('[data-dossier-section="current-hand"]'), 'current hand');
    assert.ok(player.querySelector('.equity-player-analysis-title .series-marker'));
  }
  assert.doesNotMatch(text(content), /Complete the flop to compare entered exact hands/);
  // Five or more calculated players collapse into per-player disclosures.
  await setPlayerCount(6);
  const hands = [['As', 'Ad'], ['Ks', 'Kd'], ['Js', 'Jd'], ['Ts', 'Td'], ['9h', '9c'], ['8h', '8c']];
  const ids = playerIds();
  for (const [index, id] of ids.entries()) {
    if (index > 0) await app.click(`[data-equity-hand-mode="known"][data-player-id="${id}"]`);
    await app.pickCards(`[data-equity-edit-hand="${id}"]`, hands[index]);
  }
  await app.click('#calculate');
  await app.settle(5000);
  const collapsed = analysisContent().querySelectorAll('.equity-player-analysis');
  assert.equal(collapsed.length, 6);
  assert.ok(collapsed.every((node) => node.localName === 'details' && node.dataset.equityDisclosure === 'player'));
  assert.equal(analysisContent().querySelectorAll('[data-dossier-section="board-analysis"]').length, 1);
  await setPlayerCount(2);
});

test('the optional center overview stays compact and does not duplicate cards or rich analysis', async () => {
  const overview = equityMarkup.querySelector('#equityResultsPanel');
  assert.ok(overview.classList.contains('panel') && overview.classList.contains('equity-overview-panel'));
  // Hidden in every lifecycle state.
  const workspace = app.$('.equity-workspace');
  for (const state of ['empty', 'complete']) {
    workspace.dataset.equityState = state;
    assert.equal(css.cascaded(app.byId('equityResultsPanel'), 'display'), 'none', state);
  }
  await calculateMatchup();
  const [player] = equity().players;
  const markupText = app.call('equityOverviewPlayerMarkup', player, 0);
  assert.match(markupText, /class="equity-overview-player"/);
  assert.match(markupText, new RegExp(`${(equity().lastResult.players[0].equity * 100).toFixed(1)}%`));
  assert.doesNotMatch(markupText, /training-readonly-card|Win|Tie|equity-outs|current-hand/);
});

test('canonical RangeAnalysisFacts drives one calculated projection while exact outcome math stays DOM-free', async () => {
  assert.match(handAnalysis, /createRangeAnalysisRequest/);
  assert.match(handAnalysis, /createRangeAnalysisFacts/);
  assert.match(handAnalysis, /orderBestFiveForPresentation/);
  await calculateMatchup();
  const projection = equity().lastAnalysis;
  assert.ok(projection?.players?.length === 2, 'one calculated projection');
  const content = analysisContent();
  const outs = content.querySelector('.equity-dossier-section.equity-outs');
  assert.ok(outs, 'structural outs section');
  assert.match(text(content), /Structural direct completions — not guaranteed winning outs|Structural draws \/ completions/);
  assert.match(text(content), /Unique direct completion cards/);
  assert.doesNotMatch(text(content), /drawing dead|clean outs/i);
  // No Equity-local evaluator exists in the page.
  for (const name of ['calculateOuts', 'scoreSeven', 'evaluateSeven', 'scoreFive']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
});

test('known flop and turn Outs remain overlap-safe structural direct completions', () => {
  for (const board of [['Qh', 'Jh', '2c'], ['Qh', 'Jh', '2c', '7d']]) {
    const facts = createRangeAnalysisFacts({ heroCards: ['Ah', 'Kh'], board, deadCards: [] });
    assert.equal(facts.exactHand.drawOuts.available, true);
    assert.equal(facts.exactHand.drawOuts.semantics, 'structural_direct_improvement_cards');
    assert.equal(facts.exactHand.drawOuts.flush.count, 9);
    assert.equal(facts.exactHand.drawOuts.straight.count, 4);
    assert.equal(facts.exactHand.drawOuts.uniqueCompletionCardCount, 12);
  }
  // The Hand Analysis lists the completion cards and their unique count.
  assert.match(text(analysisContent()), /Unique direct completion cards\s*12/);
});

test('preflop, river, zero-completion, and unknown states remain truthful', async () => {
  const preflop = createRangeAnalysisFacts({ heroCards: ['Ah', 'Kh'], board: [], deadCards: [] });
  const river = createRangeAnalysisFacts({ heroCards: ['Ah', 'Kh'], board: ['Qh', 'Jh', '2c', '7d', '4s'], deadCards: [] });
  const zero = createRangeAnalysisFacts({ heroCards: ['2c', '3d'], board: ['Kc', 'Qd', '9s'], deadCards: [] });
  const unknown = createRangeAnalysisFacts({ heroCards: [], board: ['Qh', 'Jh', '2c'], deadCards: [] });
  assert.equal(preflop.exactHand.preflopHandClass, 'AKs');
  assert.equal(preflop.exactHand.drawOuts.available, false);
  assert.equal(river.exactHand.available, true);
  assert.equal(river.exactHand.drawOuts.available, false);
  assert.equal(zero.exactHand.drawOuts.uniqueCompletionCardCount, 0);
  assert.equal(unknown.exactHand.available, false);
  // An unknown hand renders the truthful unavailable copy.
  const [, villain] = playerIds();
  await app.click(`[data-equity-hand-mode="unknown"][data-player-id="${villain}"]`);
  assert.equal(app.byId('calculate').disabled, false);
  await app.click('#calculate');
  for (let round = 0; round < 60 && equity().lifecycle === 'running'; round += 1) await app.settle(1000);
  assert.equal(equity().lifecycle, 'complete');
  assert.match(text(analysisContent()), /Exact hand facts are unavailable/);
  assert.doesNotMatch(text(analysisContent()), /drawing dead|guaranteed outs|clean outs/i);
});

test('legacy Equity-local evaluation and rejected duplicate result presentation are absent', () => {
  for (const name of ['calculateOuts', 'scoreSeven', 'scoreFive', 'renderEquityOuts']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  assert.equal(app.$('[id^="outsPanel-"]'), null);
  assert.equal(equityMarkup.querySelector('.equity-output-stack, .equity-result-tile, .equity-comparison-hand, #equityScenarioContext'), null);
  assert.doesNotMatch(text(equityMarkup), /generic Complete/i);
  // (Older rules still target .equity-player-results; the product never
  // renders it — TEST-HYGIENE-001-F07 dead CSS.)
  assert.equal(app.$('#equityMode .equity-player-results, #equityMode .equity-comparison-hand'), null);
});

test('canonical request, method, progress, cancellation, and invalidation semantics remain intact', async () => {
  await calculateMatchup();
  const request = app.call('equityRequestFromCurrentInputs');
  assert.equal(request.schemaVersion, 'equity-request/v1');
  assert.equal(request.schemaVersion, EQUITY_REQUEST_SCHEMA_VERSION);
  assert.ok(Object.values(EQUITY_METHODS).includes(request.method), request.method);
  assert.deepEqual(Object.keys(request).filter((key) => /strategy|range/i.test(key)), [], 'no strategy or weighted-range input');
  // Calculation goes through the Equity service; cancel asks it to cancel;
  // a superseded generation is ignored; input changes mark results stale.
  const spy = app.spy(['callEquityServiceBridge']);
  try {
    await app.click('#calculate');
    const calculate = spy.calls.callEquityServiceBridge.find(([method]) => method === 'calculate');
    assert.ok(calculate, JSON.stringify(spy.calls.callEquityServiceBridge.map(([method]) => method)));
    assert.deepEqual(calculate[1].players, request.players);
    app.call('cancelEquityCalculation');
    assert.ok(spy.calls.callEquityServiceBridge.some(([method]) => method === 'cancel'));
  } finally {
    spy.restore();
  }
  await app.settle(3000);
  await app.click('#calculate');
  await app.settle(3000);
  await app.pickCards('[data-card-set-edit="eqdead"]', ['4s']);
  assert.equal(text(app.byId('equityStatus')), 'Results are stale.');
  // Without a previous result, an input change asks for a calculation.
  app.evaluate('app.equity.lastResult = null; app.equity.staleResult = null');
  await app.pickCards('[data-card-set-edit="eqdead"]', ['5s']);
  assert.equal(text(app.byId('equityStatus')), 'Inputs changed. Calculate to refresh the result.');

  const fixture = {
    schemaVersion: EQUITY_REQUEST_SCHEMA_VERSION,
    players: [{ id: 'hero', cards: ['2c', '3d'] }, { id: 'villain', cards: ['As', 'Ah'] }],
    board: ['Kc', 'Qd', '9s'], deadCards: [], method: EQUITY_METHODS.EXACT, samples: 1000, seed: 1,
  };
  assert.ok(calculateEquityExact(fixture).players[0].equity > 0);
});

test('stable Hand Analysis factual copy remains present in both non-English catalogs', () => {
  for (const key of [
    'Hand Analysis', 'Selected hand', 'Clear hand', 'Current hand', 'Calculation evidence', 'Board texture',
    'Card removal', 'Stale', 'Results are stale.', 'Structural direct completions — not guaranteed winning outs',
  ]) {
    assert.ok((translations.match(new RegExp(`['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g')) || []).length >= 2, key);
  }
});
