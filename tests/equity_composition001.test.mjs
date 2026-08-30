import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  EQUITY_METHODS,
  EQUITY_REQUEST_SCHEMA_VERSION,
  calculateEquityExact,
} from '../shared/poker-domain/index.js';
import { createRangeAnalysisFacts } from '../app/src/application/range-analysis.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const handAnalysis = fs.readFileSync(new URL('../app/src/application/equity-hand-analysis.mjs', import.meta.url), 'utf8');

const equityHtml = html.slice(html.indexOf('id="equityMode"'), html.indexOf('id="infoMode"'));
const equityLogic = logic.slice(
  logic.indexOf('function equityDefaultPlayerLabel'),
  logic.indexOf('function syncSliderPair'),
);
const compositionCss = css.slice(css.indexOf('EQUITY-COMPOSITION-001R'));

test('2, 6, and 10 players use one genuine two-column gallery with bounded vertical overflow only', () => {
  for (const count of [2, 6, 10]) {
    assert.match(equityHtml, new RegExp(`data-equity-player-count="${count}"`));
  }
  assert.match(equityLogic, /Math\.max\(2, Math\.min\(10/);
  assert.match(equityLogic, /root\.dataset\.playerCount = String\(app\.equity\.players\.length\)/);
  assert.match(compositionCss, /\.equity-player-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[^}]*max-block-size:\s*654px[^}]*overflow-y:\s*auto[^}]*overflow-x:\s*hidden/s);
  assert.match(compositionCss, /@media \(max-width: 620px\)[\s\S]*?\.equity-player-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.doesNotMatch(compositionCss, /\.equity-player-list\s*\{[^}]*overflow-x:\s*(?:auto|scroll)/s);
});

test('player tiles retain fixed geometry and one result footer through setup, running, completed, and stale states', () => {
  assert.match(compositionCss, /\.equity-player-card\s*\{[^}]*block-size:\s*216px[^}]*grid-template-rows:\s*28px minmax\(96px, 1fr\) 56px/s);
  assert.match(equityLogic, /const state = complete \? 'complete' : \(result \? 'stale' : \(running \? 'running' : 'setup'\)\)/);
  assert.match(equityLogic, /<footer class="equity-player-footer" data-result-state="\$\{state\}"/);
  assert.match(equityLogic, /class="equity-result-primary"><span>\$\{t\('Equity'\)\}<\/span>/);
  assert.match(equityLogic, /<span>\$\{t\('Win'\)\}<\/span><strong class="poker-data-token">\$\{winValue\}<\/strong>/);
  assert.match(equityLogic, /<span>\$\{t\('Tie'\)\}<\/span><strong class="poker-data-token">\$\{tieValue\}<\/strong>/);
  assert.match(equityLogic, /if \(app\.equity\.lastResult\) app\.equity\.staleResult = app\.equity\.lastResult/);
  const playerRenderer = equityLogic.slice(equityLogic.indexOf('function renderEquityPlayers'), equityLogic.indexOf('function updateActionOptions'));
  assert.match(playerRenderer, /equityPlayerResultMarkup\(player, playerIndex\)/);
  assert.doesNotMatch(playerRenderer, /equityStructuralFactsMarkup|equityOutsMarkup|equityReadOnlyCardsMarkup/);
  assert.doesNotMatch(compositionCss, /\.equity-player-card\s*\{[^}]*(?:border-block-start|border-inline-start)[^}]*var\(--series-color\)/s);
  assert.match(equityLogic, /class="equity-player-identity"><i class="series-marker"/);
});

test('stable player identity is the single private-hand authority for picker, tile, readiness, and request', () => {
  assert.match(logic, /function equityHandGroup\(playerId\)[\s\S]*?`equity-hand-\$\{playerId\}`/);
  assert.match(logic, /function equityPlayerFromHandGroup[\s\S]*?app\.equity\.players\.find\(\(player\) => player\.id === playerId\)/);
  assert.match(logic, /if \(equityPlayer\) return equityPlayer\.cards/);
  assert.match(equityLogic, /equityHandEditorMarkup\(player, playerIndex, label\)/);
  assert.match(equityLogic, /player\.cards !== null && player\.cards\.length !== 2/);
  assert.match(equityLogic, /cards: player\.handMode === 'unknown' \? null : cards\.slice\(\)/);
  assert.doesNotMatch(logic, /selectedPlayerId|selectEquityPlayer|data-equity-select-player|data-selected=/);
});

test('Board, Dead Cards, and calculation remain the stable center poker region', () => {
  assert.ok(equityHtml.indexOf('equity-player-panel') < equityHtml.indexOf('equity-center-column'));
  assert.ok(equityHtml.indexOf('equity-center-column') < equityHtml.indexOf('equity-dossier-panel'));
  assert.match(equityHtml, /class="equity-center-column"[\s\S]*?class="panel equity-cards-panel"[\s\S]*?data-slots="eqboard"[\s\S]*?data-slots="eqdead"[\s\S]*?equity-calculation-strip/s);
  assert.match(equityHtml, /Flop[\s\S]*Turn[\s\S]*River/);
  assert.match(equityHtml, /id="equityAdvanced"[^>]*><summary/);
  assert.doesNotMatch(equityHtml, /id="equityAdvanced"[^>]+open/);
  assert.match(compositionCss, /\.equity-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(360px, 400px\) minmax\(400px, 448px\) minmax\(520px, 1fr\)/s);
  assert.doesNotMatch(compositionCss, /data-equity-state="(?:running|complete)"\]\s*\.equity-workspace[^}]*grid-template-columns/s);
});

test('the permanent Hand Analysis rail exposes global facts once and every player without selection ownership', () => {
  assert.match(equityHtml, /id="equityHandAnalysis" class="panel equity-dossier-panel equity-hand-analysis-panel"/);
  assert.match(equityHtml, /id="equityHandAnalysisTitle"[^>]*>Hand Analysis/);
  assert.match(equityHtml, /id="equityHandAnalysisContent"/);
  assert.match(equityHtml, /id="equityDetails"[\s\S]*?Calculation evidence/);
  assert.match(equityHtml, /data-future-analysis-home/);
  assert.doesNotMatch(equityHtml, /Selected player|headlineEquity|giant/i);
  const analysis = equityLogic.slice(equityLogic.indexOf('function equityPlayerAnalysisBody'), equityLogic.indexOf('function createEquityPlayer'));
  for (const call of ['equityCurrentHandMarkup', 'equityExactOutcomeMarkup', 'equityStructuralOutsMarkup']) {
    assert.match(analysis, new RegExp(call));
  }
  assert.equal((analysis.match(/equityBoardAnalysisMarkup\(projection\)/g) || []).length, 1);
  assert.match(analysis, /projection\.players\.map\(\(player, playerIndex\) => equityPlayerAnalysisMarkup\(player, playerIndex, projection, collapsePlayers\)\)/);
  assert.match(analysis, /projection\.players\.length >= 5/);
  assert.match(analysis, /equityAnalysisEquityMarkup\(playerProjection\.id\)/);
  assert.match(analysis, /equityAnalysisSecondaryMetricsMarkup\(playerProjection\.id\)/);
  assert.doesNotMatch(analysis, /equityCurrentMatchupMarkup|Complete the flop to compare entered exact hands/);
});

test('the optional center overview stays compact and does not duplicate cards or rich analysis', () => {
  const overview = equityLogic.slice(equityLogic.indexOf('function equityOverviewPlayerMarkup'), equityLogic.indexOf('function syncEquityPlayerNamePresentation'));
  assert.match(equityHtml, /id="equityResultsPanel" class="panel equity-overview-panel"/);
  assert.match(overview, /result\.equity/);
  assert.match(overview, /class="equity-overview-player"/);
  assert.doesNotMatch(overview, /equityReadOnlyCardsMarkup|Win|Tie|equityOutsMarkup|equityCurrentHandMarkup/);
  assert.match(compositionCss, /\.equity-overview-panel\s*\{\s*display:\s*none/);
  assert.doesNotMatch(compositionCss, /data-equity-state="complete"[^}]*\.equity-overview-panel\s*\{\s*display:\s*block/);
});

test('canonical RangeAnalysisFacts drives one calculated projection while exact outcome math stays DOM-free', () => {
  const projection = equityLogic.slice(equityLogic.indexOf('function equityMadeHandLabel'), equityLogic.indexOf('function createEquityPlayer'));
  assert.match(handAnalysis, /createRangeAnalysisRequest/);
  assert.match(handAnalysis, /createRangeAnalysisFacts/);
  assert.match(handAnalysis, /orderBestFiveForPresentation/);
  assert.match(projection, /exactHand\.relationship/);
  assert.match(projection, /board\.suitTexture/);
  assert.match(projection, /rawCombosRemovedByHeroCards/);
  assert.match(projection, /class="equity-dossier-section equity-outs"/);
  assert.match(projection, /Structural direct completions — not guaranteed winning outs/);
  assert.doesNotMatch(projection, /calculateOuts|scoreSeven|evaluateSeven|HOLDEM_DECK|drawing dead|clean outs/i);
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
  assert.match(equityLogic, /fact\.completionCards/);
  assert.match(equityLogic, /uniqueCompletionCardCount/);
});

test('preflop, river, zero-completion, and unknown states remain truthful', () => {
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
  assert.match(equityLogic, /cards === null[\s\S]*?Exact hand facts are unavailable/s);
  assert.match(equityLogic, /exactHand\?\.street === 'preflop'/);
  assert.doesNotMatch(equityLogic, /drawing dead|guaranteed outs|clean outs/i);
});

test('legacy Equity-local evaluation and rejected duplicate result presentation are absent', () => {
  assert.doesNotMatch(logic, /function\s+(?:calculateOuts|scoreSeven|scoreFive)\b|renderEquityOuts|outsPanel-/);
  assert.doesNotMatch(equityHtml, /equity-output-stack|equity-result-tile|equity-comparison-hand|equityScenarioContext|generic Complete/i);
  assert.doesNotMatch(compositionCss, /equity-player-results|equity-comparison-hand/);
});

test('canonical request, method, progress, cancellation, and invalidation semantics remain intact', () => {
  assert.match(equityLogic, /schemaVersion: 'equity-request\/v1'/);
  assert.match(equityLogic, /sim: 'monte_carlo'/);
  assert.match(equityLogic, /callEquityServiceBridge\('calculate', request/);
  assert.match(equityLogic, /function cancelEquityCalculation\(\)[\s\S]*?callEquityServiceBridge\('cancel'\)/s);
  assert.match(equityLogic, /generation === equityCalculationGeneration/);
  assert.match(equityLogic, /Inputs changed\. Calculate to refresh the result\./);
  assert.doesNotMatch(equityLogic.slice(equityLogic.indexOf('function equityRequestFromCurrentInputs')), /StrategyProvider|HoldemWeightedRange/);

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
