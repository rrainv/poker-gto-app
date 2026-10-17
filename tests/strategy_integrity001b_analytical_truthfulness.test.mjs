import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { projectPreflopHandClassesAfterCardRemoval } from '../app/src/application/range-card-removal.mjs';

import { bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / logic.js assertions are behavioural: the
// Matrix, StrategyResult presentation, range comparison, Equity and Training
// hint copy run in the booted app (instead of vm-sliced logic.js), and markup
// is parsed. i18n and analysis-explanation sources are outside this ticket.
const locales = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const markup = indexDocument();
const app = await bootApp();

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0, start);
  assert.ok(to > from, end);
  return source.slice(from, to);
}

await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
const freshChart = () => {
  app.evaluate('app.matrixModel = null');
  app.call('renderChart');
  return app.$$('#strategyGrid .hand-cell');
};

test('Matrix exposes only heuristic strategy-frequency views', () => {
  const select = markup.getElementById('chartAction');
  assert.deepEqual(select.querySelectorAll('option').map((option) => option.value), ['strategy', 'raise', 'call', 'fold']);
  assert.doesNotMatch(text(markup.body) + locales, /EV Heatmap \(bb\)|Equity % Heatmap/);
  for (const name of ['estEV', 'estEq']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  // Every view renders frequencies (or Unavailable), never EV or equity estimates.
  for (const view of ['strategy', 'raise', 'call', 'fold']) {
    app.byId('chartAction').value = view;
    const cells = freshChart();
    assert.equal(cells.length, 169, view);
    for (const cell of cells) assert.doesNotMatch(text(cell), /bb|EV|equity/i, `${view}: ${text(cell)}`);
  }
  app.byId('chartAction').value = 'strategy';
  freshChart();
});

test('canonical StrategyResult presentation allocates exactly 100 visible percent', () => {
  const present = (result) => app.call('strategyResultPresentationActions', result);
  for (const entries of [
    [['Raise', 'raise', 1 / 3], ['Call', 'call', 1 / 3], ['Fold', 'fold', 1 / 3]],
    [['Raise', 'raise', 0.666], ['Call', 'call', 0.111], ['Fold', 'fold', 0.223]],
    [['Call', 'call', 0.7], ['Fold', 'fold', 0.3]],
  ]) {
    const result = {
      actions: entries.map(([label, type, probability]) => ({ label, action: { type }, probability })),
    };
    const presented = present(result);
    assert.equal(presented.reduce((sum, entry) => sum + entry.value, 0), 100);
    assert.ok(presented.every((entry) => Number.isInteger(entry.value) && entry.value >= 0));
  }
  assert.deepEqual(Array.from(present({ actions: [] })), []);
});

test('Matrix uses current context, labels unavailable cells, and discloses fallback provenance', async () => {
  // Every cell is resolved for the current context through the canonical
  // presentation of a provider StrategyResult.
  const spy = app.spy(['strategyResultPresentationActions', 'strategyPolicySummary']);
  let cells;
  try {
    cells = freshChart();
    assert.ok(spy.count('strategyResultPresentationActions') >= 169);
    assert.ok(spy.count('strategyPolicySummary') >= 1);
  } finally {
    spy.restore();
  }
  for (const name of ['calculatePreflopFallbackStrategy', 'evaluatePostflopHandStrength']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  for (const cell of cells) assert.ok(cell.dataset.strategyPrecision, 'every cell records its strategy precision');
  const context = app.window.app.decisionContext;
  assert.match(text(app.byId('chartSummary')), new RegExp(`${context.stackBb ?? context.effectiveStackBb} bb`));
  // Changing the context changes the Matrix model key (it is never stale).
  const before = app.evaluate('app.matrixModel.key');
  await app.setValue('#players', String(context.tableSize === 6 ? 7 : 6));
  freshChart();
  assert.notEqual(app.evaluate('app.matrixModel.key'), before);
  // Postflop the Matrix is not guessed: the grid is withheld and labelled
  // unavailable. (The per-cell "provider-backed postflop Matrix deferred"
  // label is unreachable because postflop returns before cells render.)
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['Qh', 'Jh', '2c']);
  const postflop = freshChart();
  assert.equal(postflop.length, 0);
  assert.equal(app.$('.range-matrix-layout').hidden, true);
  assert.equal(app.byId('postflopMatrixEmpty').hidden, false);
  assert.equal(text(app.byId('selectedHandPrimary')), 'Range expansion unavailable');
  assert.equal(text(app.byId('selectedRangeSource')), 'Unavailable');
});

test('Range comparison dedicated selectors are authoritative and both change the analysis', async () => {
  // (Board from the previous test: a flop is required.)
  assert.ok(app.window.app.gto.board.filter(Boolean).length >= 3);
  await app.setValue('#rangeAdvHeroPos', 'BTN', { events: ['change'] });
  await app.setValue('#rangeAdvVilPos', 'BB', { events: ['change'] });
  const first = app.call('renderRangeAdvantage');
  // Each dedicated selector re-renders the comparison on change.
  await app.setValue('#rangeAdvHeroPos', 'UTG', { events: ['change'] });
  assert.equal(text(app.byId('heroRangeTitle')), 'Hero sample (UTG)');
  const heroChanged = app.call('renderRangeAdvantage');
  assert.notEqual(heroChanged.heroStrongShare, first.heroStrongShare);
  await app.setValue('#rangeAdvVilPos', 'CO', { events: ['change'] });
  assert.equal(text(app.byId('villainRangeTitle')), 'Villain sample (CO)');
  const villainChanged = app.call('renderRangeAdvantage');
  assert.notEqual(villainChanged.villainStrongShare, heroChanged.villainStrongShare);
  // The Hero position control does not drive the comparison.
  const heroPos = app.byId('heroPos');
  assert.ok(heroPos, 'the Hero position control exists');
  const previous = heroPos.value;
  await app.setValue(heroPos, [...heroPos.options].map((option) => option.value).find((value) => value !== previous), { events: ['change'] });
  assert.equal(text(app.byId('heroRangeTitle')), 'Hero sample (UTG)');
  await app.setValue(heroPos, previous, { events: ['change'] });
});

test('Range comparison is descriptive, limitation-labelled, and context-safe in Hand Mode', async () => {
  assert.doesNotMatch(locales, /Significant Nut Advantage|Villain Nut Advantage|use large bet sizes and overbets|bet very frequently \(using smaller bet sizes\)|distributing equity evenly/);
  app.call('renderRangeAdvantage');
  const analysis = text(app.byId('rangeAdvantageAnalysis')) + ' ' + text(app.byId('rangeAdvantageStatus'));
  assert.doesNotMatch(analysis, /Significant Nut Advantage|Villain Nut Advantage|overbets|distributing equity evenly/);
  for (const phrase of [
    /heuristic fixed-range\/category analysis/,
    /one canonical surviving representative per eligible sampled class/,
    /category does not describe every combo in that class/,
    /not solver range advantage, range-vs-range equity/,
  ]) assert.match(analysis, phrase);
  await app.call('requestPlaybookMode', 'hand');
  await app.settle(200);
  const result = app.call('renderRangeAdvantage');
  assert.equal(result.status, 'unavailable');
  assert.equal(app.byId('rangeAdvantageAnalysis').hidden, true);
  assert.match(text(app.byId('rangeAdvantageStatus')), /Canonical hand history does not establish weighted ranges/);
  await app.call('requestPlaybookMode', 'scenario');
  await app.settle(200);
});

test('Equity results omit the tautological Total equity summary without touching canonical calculations', async () => {
  const equity = markup.getElementById('equityMode');
  assert.doesNotMatch(text(equity), /Total equity/);
  assert.equal(equity.querySelector('#equitySum, #equityTotal, [id*="equitySum"]'), null);
  assert.ok(equity.querySelector('#equitySplitSummary'));
  assert.ok(equity.querySelector('#eqDeckCount'));
  await app.navigate('equity');
  app.call('clearEquityResults');
  assert.equal(app.$('#equityMode [id*="equityTotal"], #equityMode [id*="equitySum"]'), null);
  assert.doesNotMatch(text(app.byId('equityMode')), /Total equity/);
  await app.navigate('analyze');
});

test('related analytical surfaces retain explicit truthfulness boundaries', async () => {
  // Guided Training states MDF as a range-level reference, and solutions say
  // no EV is implied.
  await app.navigate('training');
  app.window.app.training.currentContext = { hero_pos: 'BTN', facingSize: 3, callAmount: 2, potOdds: 25, mdf: 60 };
  app.byId('trainingDifficulty').value = 'guided';
  app.call('updateAssistanceDisplay');
  assert.match(text(app.byId('trainingHintText')), /MDF \([^)]*\) is a range-level reference, not a threshold for this hand/);
  app.byId('trainingDifficulty').value = 'hard';
  app.call('updateAssistanceDisplay');
  await app.training.start('focused');
  await app.training.answer();
  assert.match(text(app.byId('trainingSolution')), /no EV is implied/);
  const explanation = fs.readFileSync(new URL('../app/src/application/analysis-explanation.mjs', import.meta.url), 'utf8');
  assert.match(explanation, /claimPolicy\.claims\[STRATEGY_CLAIMS\.ACTION_EV\]/);
  const spr = sourceBetween(explanation, 'function sprSection(', 'function historyText(');
  assert.match(spr, /context\.effectiveStackBb/);
  assert.doesNotMatch(spr, /context\.stackBb\b/);
  assert.match(explanation, /The strategy source supplies no action EV comparison/);
  // Trusted facts carry only history, never an equity figure.
  assert.deepEqual(Object.keys(app.call('trustedAnalysisFacts', [])), ['actionHistory']);
});
