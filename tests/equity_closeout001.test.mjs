import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { evaluateFive } from '../shared/poker-domain/evaluator.js';
import {
  createEquityHandAnalysisProjection,
  createExactEnteredHandOutcomeFacts,
  orderBestFiveForPresentation,
} from '../app/src/application/equity-hand-analysis.mjs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const equityLogic = logic.slice(
  logic.indexOf('function equityDefaultPlayerLabel'),
  logic.indexOf('// ---------------------------------------------------------------------------\n\n// UI utilities'),
);
const equityCss = css.slice(css.indexOf('/* EQUITY-COMPOSITION-001R'));

test('exact known Full House versus flush draw separates catch-up from structural completions', () => {
  const facts = createExactEnteredHandOutcomeFacts({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', '6c'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: ['5h'],
  });
  const hero = facts.players.find(({ id }) => id === 'hero');

  assert.equal(hero.currentStanding, 'behind');
  assert.deepEqual(hero.winningOuts.cards, ['Th']);
  assert.deepEqual(hero.winningOuts.groups, [{ resultCategory: 'straight_flush', count: 1, cards: ['Th'] }]);
  for (const flushOnly of ['2h', '3h', '4h', 'Jh', 'Qh', 'Kh', 'Ah']) {
    assert.ok(hero.structuralImprovementsStillBehind.cards.includes(flushOnly), flushOnly);
    assert.ok(!hero.winningOuts.cards.includes(flushOnly), flushOnly);
  }
  assert.equal(facts.nextCardMeaning, 'ahead_after_next_card_not_guaranteed_final_pot');

  const projection = createEquityHandAnalysisProjection({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', '6c'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: ['5h'],
  });
  const structural = projection.players[0].facts.exactHand.drawOuts;
  assert.equal(structural.flush.count, 8);
  assert.ok(structural.flush.completionCards.includes('2h'));
  assert.deepEqual(structural.straightFlush.completionCards, ['Th']);
});

test('multiway winning outs must beat every entered exact hand', () => {
  const headsUp = createExactEnteredHandOutcomeFacts({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', 'Kc'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: [],
  });
  assert.ok(headsUp.players[0].winningOuts.cards.includes('2h'));

  const multiway = createExactEnteredHandOutcomeFacts({
    players: [
      { id: 'hero', cards: ['9h', '8h'] },
      { id: 'villain', cards: ['7d', 'Kc'] },
      { id: 'player-3', cards: ['7s', '6c'] },
    ],
    board: ['7h', '6h', '7c'],
    deadCards: [],
  });
  assert.ok(!multiway.players[0].winningOuts.cards.includes('2h'));
  assert.ok(multiway.players[0].structuralImprovementsStillBehind.cards.includes('2h'));
  assert.equal(multiway.comparisonUniverse, 'all_entered_exact_hands');
});

test('unknown opponents suppress exact catch-up claims while turn analysis owns the final next card', () => {
  const unknown = createExactEnteredHandOutcomeFacts({
    players: [{ id: 'hero', cards: ['Ah', 'Kh'] }, { id: 'villain', cards: null }],
    board: ['Qh', 'Jh', '2c'],
    deadCards: [],
  });
  assert.equal(unknown.available, false);
  assert.equal(unknown.reason, 'unknown_opponent');
  assert.deepEqual(unknown.players, []);

  const turn = createExactEnteredHandOutcomeFacts({
    players: [{ id: 'hero', cards: ['Ah', 'Kh'] }, { id: 'villain', cards: ['Qs', 'Qd'] }],
    board: ['Qh', 'Jh', '2c', '7d'],
    deadCards: [],
  });
  assert.equal(turn.street, 'turn');
  assert.equal(turn.nextCardMeaning, 'final_one_card_runout');
  assert.match(equityLogic, /Catch-up cards: ahead after this turn card; River remains\./);
  assert.match(equityLogic, /River cards that win at showdown\./);
});

test('Best Five presentation follows canonical category and tiebreak structure', () => {
  const cases = [
    { cards: ['Jh', 'Jd', 'Qc', 'Js', 'Jc'], expected: 'JJJJQ' },
    { cards: ['2h', 'Kd', '2c', 'Ks', 'Kc'], expected: 'KKK22' },
    { cards: ['Ah', '7d', '7c', 'Ks', '7s'], expected: '777AK' },
    { cards: ['2h', 'Qd', '2c', 'Qs', 'Ac'], expected: 'QQ22A' },
    { cards: ['2h', 'Kd', '2c', 'Qs', 'Ac'], expected: '22AKQ' },
    { cards: ['2h', '5d', '3c', 'As', '4c'], expected: '5432A' },
    { cards: ['Th', 'Ah', 'Jh', 'Kh', 'Qh'], expected: 'AKQJT' },
    { cards: ['2h', '9h', 'Jh', 'Kh', 'Ah'], expected: 'AKJ92' },
    { cards: ['2h', '9d', 'Js', 'Kc', 'Ah'], expected: 'AKJ92' },
  ];
  for (const { cards, expected } of cases) {
    const canonical = evaluateFive(cards);
    const ordered = orderBestFiveForPresentation(canonical);
    assert.deepEqual([...ordered].sort(), [...canonical.bestFiveCards].sort());
    assert.equal(ordered.map((card) => card[0]).join(''), expected);
  }
});

test('one completed projection invokes one global and one known-player RangeAnalysis projection', () => {
  const calls = { requests: 0, facts: 0 };
  const projection = createEquityHandAnalysisProjection({
    players: [
      { id: 'hero', cards: ['Ah', 'Kh'] },
      { id: 'villain', cards: ['Qs', 'Qd'] },
      { id: 'unknown', cards: null },
    ],
    board: ['Qh', 'Jh', '2c'],
    deadCards: [],
  }, {
    createRangeAnalysisRequest(input) {
      calls.requests += 1;
      return input;
    },
    createRangeAnalysisFacts(input) {
      calls.facts += 1;
      return { schemaVersion: 'range-analysis-facts/v1', exactHand: { canonicalRank: null }, input };
    },
  });
  assert.equal(calls.requests, 3);
  assert.equal(calls.facts, 3);
  assert.equal(projection.players[2].facts, null);
});

test('result-owned analysis lifecycle performs no setup or stale replacement projection', () => {
  const renderResult = equityLogic.slice(equityLogic.indexOf('function renderEquityResult'), equityLogic.indexOf('function setEquityPending'));
  const pending = equityLogic.slice(equityLogic.indexOf('function setEquityPending'), equityLogic.indexOf('function resetEquityCalculator'));
  const playerRender = equityLogic.slice(equityLogic.indexOf('function renderEquityPlayers'), equityLogic.indexOf('function updateActionOptions'));
  assert.equal((renderResult.match(/createEquityHandAnalysisProjection/g) || []).length, 2);
  assert.doesNotMatch(pending, /createEquityHandAnalysisProjection|createRangeAnalysisFacts/);
  assert.doesNotMatch(playerRender, /renderEquityHandAnalysis|createRangeAnalysisFacts/);
  assert.match(pending, /staleAnalysis = app\.equity\.lastAnalysis/);
  assert.match(pending, /renderEquityHandAnalysis\(\)/);
  assert.match(logic, /rebuildAnalysis: false/);
});

test('analysis and exact-card depth are independently lazy and card removal is demoted', () => {
  assert.match(equityLogic, /data-equity-disclosure="best-five"/);
  assert.match(equityLogic, /data-equity-disclosure="structural" data-player-id=/);
  assert.match(equityLogic, /data-equity-disclosure="outcome" data-outcome-kind=/);
  assert.match(equityLogic, /data-equity-disclosure="player"/);
  assert.match(equityLogic, /event\.target\.closest\?\.\('details\[data-equity-disclosure\]'/);
  assert.match(equityLogic, /target\.dataset\.rendered === 'true'/);
  assert.match(equityLogic, /openEquityDisclosureKeys\(content\)/);
  assert.match(equityLogic, /restoreEquityDisclosureKeys\(content, openDisclosures, projection\)/);
  assert.doesNotMatch(equityLogic.slice(equityLogic.indexOf('function equityStructuralOutsMarkup'), equityLogic.indexOf('function equityCurrentHandMarkup')), /equityReadOnlyCardsMarkup/);
  assert.match(html, /id="equityFurtherAnalysisContent"/);
  assert.match(equityLogic, /equityFurtherAnalysisContent/);
  assert.match(equityLogic, /equityCardRemovalMarkup\(player\.facts\)/);
});

test('frozen proportions favor the right dossier and player headers are compact and aligned', () => {
  assert.match(equityCss, /grid-template-columns:\s*minmax\(360px, 400px\) minmax\(400px, 448px\) minmax\(520px, 1fr\)/);
  assert.match(equityCss, /\.equity-player-card\s*\{[\s\S]*?grid-template-rows:\s*28px minmax\(96px, 1fr\) 56px;[\s\S]*?row-gap:\s*var\(--space-1\)/);
  assert.match(equityCss, /\.equity-player-head\s*\{[\s\S]*?min-block-size:\s*28px[\s\S]*?align-items:\s*center/);
  assert.match(equityCss, /\.equity-player-identity\s*\{[^}]*min-block-size:\s*26px[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*padding-block:\s*0/);
  assert.match(equityCss, /\.equity-player-identity \.series-marker\s*\{[^}]*align-self:\s*center/);
  assert.match(equityCss, /\.equity-player-name\s*\{[^}]*height:\s*26px[^}]*padding:\s*0 var\(--space-2\)[^}]*font-weight:\s*800[^}]*line-height:\s*24px/s);
  assert.match(equityCss, /\.equity-player-head \.remove-player\s*\{[^}]*grid-column:\s*auto[^}]*min-height:\s*26px/s);
  assert.match(equityCss, /\.equity-player-body\s*\{[^}]*padding-block-start:\s*var\(--space-1\)/s);
  assert.doesNotMatch(equityCss, /data-equity-state="complete"[^}]*\.equity-overview-panel[^}]*display:\s*block/);
});

test('private-hand commits avoid Board and Dead rebuilds and dense picker updates only the changed control', () => {
  assert.match(logic, /equityPlayerFromHandGroup\(picker\.group\) \? 'players' : 'shared'/);
  assert.match(equityLogic, /renderInputs === 'players'[\s\S]*?renderEquityPlayers\(\);[\s\S]*?renderEquityCardCounts\(\)/);
  assert.match(equityLogic, /renderPlayerFooters: renderInputs !== 'players'/);
  assert.doesNotMatch(equityLogic.match(/renderInputs === 'players'[\s\S]*?else if \(renderInputs === 'shared'\)/)?.[0] || '', /renderEquitySharedCards/);
  assert.match(logic, /updateDeckCardStates\(\[card\]\)/);
  assert.match(logic, /updateDeckCardStates\(changedCards\)/);
  assert.match(logic, /document\.activeElement !== selectedControl/);
  assert.match(css, /#cardModal\s*\{\s*backdrop-filter:\s*none/);
  assert.match(css, /#cardModal \.deck-card\s*\{[^}]*box-shadow:\s*none[^}]*transition:\s*none/s);
  assert.match(css, /#cardModal \.deck-card:disabled,[\s\S]*?filter:\s*none; opacity:\s*\.42/);
});

test('right analysis is quantitative preflop and uses one Board band plus responsive player cards postflop', () => {
  const preflop = createEquityHandAnalysisProjection({
    players: [{ id: 'hero', cards: ['Ah', 'Kh'] }, { id: 'villain', cards: ['Js', 'Ts'] }],
    board: [],
    deadCards: [],
  });
  assert.equal(preflop.players[0].facts.exactHand.preflopHandClass, 'AKs');
  assert.equal(preflop.exactOutcomes.available, false);
  assert.equal(preflop.exactOutcomes.reason, 'insufficient_board');

  assert.match(equityLogic, /function equityAnalysisEquityMarkup[\s\S]*?result\.equity \* 100/);
  assert.match(equityLogic, /class="equity-analysis-bar" aria-hidden="true"><span style="--equity-percent: \$\{equityPercent\.toFixed\(3\)\}%"/);
  assert.match(equityLogic, /<strong class="poker-data-token">\$\{equityLabel\}<\/strong>/);
  assert.match(equityLogic, /function equityAnalysisSecondaryMetricsMarkup[\s\S]*?result\.winProbability[\s\S]*?result\.tieProbability/);
  assert.match(equityLogic, /equityAnalysisSecondaryMetricsMarkup\(playerProjection\.id\)[\s\S]*?equityCurrentHandMarkup/);
  assert.doesNotMatch(equityLogic, /function equityCurrentMatchupMarkup|Complete the flop to compare entered exact hands/);
  assert.equal((equityLogic.match(/\n\s{6}equityBoardAnalysisMarkup\(projection\),/g) || []).length, 1);
  assert.match(equityLogic, /const collapsePlayers = projection\.players\.length >= 5/);
  assert.match(equityCss, /\.equity-player-analysis-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(equityCss, /\.equity-player-analysis-list\[data-player-count="3"\] > \.equity-player-analysis:last-child\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*inline-size:\s*calc\(\(100% - var\(--space-2\)\) \/ 2\)[^}]*justify-self:\s*center/s);
  assert.match(equityCss, /\.equity-analysis-equity > strong\s*\{[^}]*font-size:\s*1\.55rem/);
  assert.match(equityCss, /\.equity-analysis-equity\s*\{[^}]*min-inline-size:\s*132px[^}]*gap:\s*3px var\(--space-2\)/s);
  assert.match(equityCss, /\.equity-analysis-bar\s*\{[^}]*block-size:\s*7px/s);
  assert.match(equityCss, /\.equity-analysis-bar > span\s*\{[^}]*inline-size:\s*var\(--equity-percent\)[^}]*background:\s*var\(--series-color\)/s);
  assert.match(equityCss, /\.equity-board-analysis-facts\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
});

test('the stale banner is global, explanatory, and absent from current analysis', () => {
  const render = equityLogic.slice(equityLogic.indexOf('function renderEquityHandAnalysis'), equityLogic.indexOf('function createEquityPlayer'));
  assert.match(render, /const stale = app\.equity\.lifecycle !== 'complete' && Boolean\(projection\)/);
  assert.match(render, /stale \? `<div class="equity-analysis-stale" role="status"><strong>\$\{t\('Analysis is out of date'\)\}<\/strong><span>\$\{t\('Inputs changed\. Recalculate to update these results\.'\)\}<\/span><\/div>` : ''/);
  assert.equal((render.match(/equity-analysis-stale/g) || []).length, 1);
  assert.doesNotMatch(equityLogic.slice(equityLogic.indexOf('function equityPlayerAnalysisBody'), equityLogic.indexOf('function equityPlayerAnalysisMarkup')), /out of date|equity-analysis-stale/);
});

test('stale tiles and center status stay concise while the center owns recalculation', () => {
  assert.match(equityLogic, /state === 'stale' \? t\('Stale'\)/);
  assert.doesNotMatch(equityLogic.slice(equityLogic.indexOf('function equityPlayerResultMarkup'), equityLogic.indexOf('function equityOverviewPlayerMarkup')), /Stale result · recalculate|Recalculating · showing stale result/);
  assert.match(equityCss, /\.equity-player-footer\[data-result-state="stale"\] \.equity-result-metrics\s*\{\s*opacity:\s*\.72/);
  assert.match(equityLogic, /t\(hasStaleResult \? 'Results are stale\.' : 'Inputs changed\. Calculate to refresh the result\.'\)/);
  assert.match(equityLogic, /const calculateLabel = hasStaleResult \? 'Recalculate' : 'Calculate equity'/);
});

test('unknown-opponent outcome copy is compact, truthful, and leaves structural analysis intact', () => {
  const exactOutcome = equityLogic.slice(equityLogic.indexOf('function equityExactOutcomeMarkup'), equityLogic.indexOf('function equityAnalysisResultForPlayer'));
  assert.match(exactOutcome, /data-outcome-state="unknown"><div class="equity-unknown-outcome"><strong>\$\{t\('Opponent unknown'\)\}<\/strong><span>\$\{t\('Exact catch-up analysis unavailable'\)\}/);
  assert.doesNotMatch(exactOutcome, /Entered-hand outcome|without claiming exact winning outs/);
  assert.match(equityLogic, /equityExactOutcomeMarkup\(playerProjection, projection\.exactOutcomes\)[\s\S]*?equityStructuralOutsMarkup\(playerProjection\)/);
  assert.match(equityCss, /\.equity-unknown-outcome\s*\{[^}]*display:\s*flex[^}]*align-items:\s*baseline/s);
});

test('status and exact next-card disclosures remain compact, contextual, and independent', () => {
  assert.match(equityLogic, /data-standing="\$\{outcome\.currentStanding\}"/);
  assert.match(equityLogic, /Cards that put this player ahead/);
  assert.match(equityLogic, /Catch-up cards/);
  assert.match(equityLogic, /Tie cards/);
  assert.match(equityLogic, /Other improvements — still behind/);
  assert.match(equityLogic, /data-outcome-kind="\$\{outcomeKind\}" data-player-id="\$\{playerId\}"/);
  assert.match(equityLogic, /equityBoardTechnicalMarkup\(projection\.globalFacts\)/);
  assert.match(equityLogic, /equityCardRemovalMarkup\(player\.facts\)/);
});

test('new calculated, stale, catch-up, and disclosure copy is present in both supported non-English catalogs', () => {
  for (const key of [
    'Calculated outcomes',
    'Calculate Equity to inspect entered-hand outcomes and detailed hand facts.',
    'Current matchup',
    'Catch-up cards',
    'Other improvements — still behind',
    'Exact structural completion cards',
    'Analysis is out of date',
    'Inputs changed. Recalculate to update these results.',
    'Results are stale.',
    'Opponent unknown',
    'Exact catch-up analysis unavailable',
    'Catch-up cards: ahead after this turn card; River remains.',
    'Board Analysis',
  ]) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.ok((translations.match(new RegExp(`['"]${escaped}['"]`, 'g')) || []).length >= 2, key);
  }
});
