import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const locales = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0, start);
  assert.ok(to > from, end);
  return source.slice(from, to);
}

test('Matrix exposes only heuristic strategy-frequency views', () => {
  const select = sourceBetween(html, '<select id="chartAction"', '</select>');
  assert.deepEqual(
    [...select.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]),
    ['strategy', 'raise', 'call', 'fold'],
  );
  assert.doesNotMatch(html + locales, /EV Heatmap \(bb\)|Equity % Heatmap/);
  assert.doesNotMatch(logic, /estEV|estEq|\(score - 4\.0\) \* 0\.22|30 \+ score \* 2\.8/);
});

test('canonical StrategyResult presentation allocates exactly 100 visible percent', () => {
  const helper = sourceBetween(logic, 'function strategyResultPresentationActions(', 'function strategyResultToLegacyProfile(');
  const context = {};
  vm.runInNewContext(`${helper}\nglobalThis.present = strategyResultPresentationActions;`, context);

  for (const entries of [
    [['Raise', 'raise', 1 / 3], ['Call', 'call', 1 / 3], ['Fold', 'fold', 1 / 3]],
    [['Raise', 'raise', 0.666], ['Call', 'call', 0.111], ['Fold', 'fold', 0.223]],
    [['Call', 'call', 0.7], ['Fold', 'fold', 0.3]],
  ]) {
    const result = {
      actions: entries.map(([label, type, probability]) => ({ label, action: { type }, probability })),
    };
    const presented = context.present(result);
    assert.equal(presented.reduce((sum, entry) => sum + entry.value, 0), 100);
    assert.ok(presented.every((entry) => Number.isInteger(entry.value) && entry.value >= 0));
  }
  assert.deepEqual(Array.from(context.present({ actions: [] })), []);
});

test('Matrix uses current context, labels unavailable cells, and discloses fallback provenance', () => {
  const matrix = sourceBetween(logic, 'function renderChart()', 'function visualActionKind(');
  assert.match(matrix, /app\.decisionContext\?\.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION/);
  assert.match(matrix, /heroCards: representativeCards/);
  assert.match(matrix, /strategyProvider\.resolve\(cellDecisionContext\)/);
  assert.match(matrix, /actions = strategyResultPresentationActions\(cellStrategyResult\)/);
  assert.doesNotMatch(matrix, /calculatePreflopFallbackStrategy|evaluatePostflopHandStrength/);
  assert.match(matrix, /actions\.length \? `\$\{val \|\| 0\}%` : 'Unavailable'/);
  assert.match(matrix, /strategySourceDisplayLabel\(matrixSource\)/);
  assert.match(matrix, /provider-backed postflop Matrix deferred/);
});

function fakeElement(value = '') {
  return {
    value,
    hidden: false,
    textContent: '',
    dataset: {},
    style: {},
    children: [],
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
  };
}

function rangeHarness() {
  const elements = new Map([
    ['rangeAdvHeroPos', fakeElement('BTN')],
    ['rangeAdvVilPos', fakeElement('BB')],
    ['rangeAdvantageStatus', fakeElement()],
    ['rangeAdvantageAnalysis', fakeElement()],
    ['heroRangeTitle', fakeElement()],
    ['villainRangeTitle', fakeElement()],
    ['heroAdvBar', fakeElement()],
    ['villainAdvBar', fakeElement()],
    ['heroRangeScore', fakeElement()],
    ['villainRangeScore', fakeElement()],
    ['rangeConclusion', fakeElement()],
  ]);
  const ranges = {
    BTN: { stats: { veryStrong: 20, strongMade: 20, marginal: 10, air: 50, total: 100 } },
    UTG: { stats: { veryStrong: 5, strongMade: 10, marginal: 20, air: 65, total: 100 } },
    BB: { stats: { veryStrong: 10, strongMade: 15, marginal: 25, air: 50, total: 100 } },
    CO: { stats: { veryStrong: 15, strongMade: 20, marginal: 20, air: 45, total: 100 } },
  };
  const context = {
    app: { playbookMode: 'scenario', gto: { board: ['As', 'Kd', '2c'] } },
    PLAYBOOK_MODES: { SCENARIO: 'scenario', HAND: 'hand' },
    PREFLOP_RANGES: ranges,
    $: (selector) => elements.get(selector.slice(1)) || null,
    t: (text) => text,
    renderRangeGrid: (_gridId, _hoverId, range) => ({ ...range.stats }),
    document: { createElement: () => fakeElement() },
  };
  const rangeFunction = sourceBetween(logic, 'function renderRangeAdvantage()', 'function renderBettingTree()');
  vm.runInNewContext(`${rangeFunction}\nglobalThis.render = renderRangeAdvantage;`, context);
  return { context, elements };
}

test('Range comparison dedicated selectors are authoritative and both change the analysis', () => {
  const rangeSource = sourceBetween(logic, 'function renderRangeAdvantage()', 'function renderBettingTree()');
  assert.match(rangeSource, /#rangeAdvHeroPos/);
  assert.match(rangeSource, /#rangeAdvVilPos/);
  assert.doesNotMatch(rangeSource, /#heroPos|rangeAdvVillainPos/);

  const { context, elements } = rangeHarness();
  const first = context.render();
  elements.get('rangeAdvHeroPos').value = 'UTG';
  const heroChanged = context.render();
  assert.notEqual(heroChanged.heroStrongShare, first.heroStrongShare);
  assert.equal(elements.get('heroRangeTitle').textContent, 'Hero sample (UTG)');

  elements.get('rangeAdvVilPos').value = 'CO';
  const villainChanged = context.render();
  assert.notEqual(villainChanged.villainStrongShare, heroChanged.villainStrongShare);
  assert.equal(elements.get('villainRangeTitle').textContent, 'Villain sample (CO)');
  assert.match(logic, /\['rangeAdvHeroPos', 'rangeAdvVilPos'\][\s\S]*addEventListener\('change', renderRangeAdvantage\)/);
});

test('Range comparison is descriptive, limitation-labelled, and context-safe in Hand Mode', () => {
  const rangeSource = sourceBetween(logic, 'function renderRangeAdvantage()', 'function renderBettingTree()');
  assert.doesNotMatch(logic + locales, /Significant Nut Advantage|Villain Nut Advantage|use large bet sizes and overbets|bet very frequently \(using smaller bet sizes\)|distributing equity evenly/);
  assert.match(rangeSource, /heuristic fixed-range\/category analysis/);
  assert.match(rangeSource, /one representative available combo per hand class/);
  assert.match(rangeSource, /not solver range advantage, range-vs-range equity/);

  const { context, elements } = rangeHarness();
  context.app.playbookMode = 'hand';
  Object.defineProperty(context.app.gto, 'board', {
    get() { throw new Error('Scenario board must not be read in Hand Mode'); },
  });
  const result = context.render();
  assert.equal(result.status, 'unavailable');
  assert.equal(elements.get('rangeAdvantageAnalysis').hidden, true);
  assert.match(elements.get('rangeAdvantageStatus').textContent, /Canonical hand history does not establish weighted ranges/);
});

test('Equity results omit the tautological Total equity summary without touching canonical calculations', () => {
  const equityHtml = sourceBetween(html, 'id="equityMode"', 'id="infoMode"');
  const equityRender = sourceBetween(logic, 'function clearEquityResults(', 'function resetEquityCalculator(');
  assert.doesNotMatch(equityHtml, /Total equity|equitySum/);
  assert.doesNotMatch(equityRender, /equityTotal|equitySum/);
  assert.match(equityHtml, /id="equitySplitSummary"/);
  assert.match(equityHtml, /id="eqDeckCount"/);
});

test('related analytical surfaces retain explicit truthfulness boundaries', () => {
  assert.match(logic, /MDF \([^)]*\) is a range-level reference, not a threshold for this hand/);
  assert.match(logic, /No EV estimate is available unless the strategy source supplies one/);
  const explanation = fs.readFileSync(new URL('../app/src/application/analysis-explanation.mjs', import.meta.url), 'utf8');
  assert.match(explanation, /compatibility stack rather than a guaranteed effective stack/);
  assert.match(explanation, /The strategy source supplies no action EV comparison/);
  const facts = sourceBetween(logic, 'function trustedAnalysisFacts(', 'function renderDecisionAnalysis(');
  assert.doesNotMatch(facts, /originalEquity|facts\.equity/);
});
