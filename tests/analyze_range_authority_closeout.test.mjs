import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  RANGE_COMPARISON_CELL_STATES,
  createRepresentativeRangeComparisonFacts,
} from '../app/src/application/range-comparison-facts.mjs';
import { projectPreflopHandClassesAfterCardRemoval } from '../app/src/application/range-card-removal.mjs';
import { bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

const [comparisonFactsSource, rangeAnalysisSource, bootstrap] = await Promise.all([
  readFile(new URL('../app/src/application/range-comparison-facts.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/range-analysis.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/analysis-explanation-bootstrap.mjs', import.meta.url), 'utf8'),
]);

// TEST-HYGIENE-001: logic.js / index.html assertions are behavioural: the
// Range Category Comparison is rendered in the running app and compared with
// the canonical comparison facts, instead of slicing the renderer source.
const markup = indexDocument();
const app = await bootApp();
await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['Qs', 'Qd']);
await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['As', 'Ad', '7c']);
await app.pickCards('#gtoMode [data-card-set-edit="dead"]', ['Ah', 'Ac']);
await app.click('[data-gto-view="range"]');
await app.settle(200);
const rendered = app.call('renderRangeAdvantage');

function expectedFacts(side) {
  const ranges = app.evaluate('PREFLOP_RANGES');
  const position = side === 'hero' ? (app.byId('rangeAdvHeroPos')?.value || 'BTN') : (app.byId('rangeAdvVilPos')?.value || 'BB');
  const range = ranges[position] || ranges[side === 'hero' ? 'BTN' : 'BB'];
  const context = app.window.app.decisionContext;
  const blockers = [...context.board, ...context.deadCards, ...(side === 'hero' ? [] : context.heroCards)];
  const removal = app.call('projectHandClassesAfterCardRemoval', [...range], blockers);
  return app.call('representativeRangeComparisonFacts', range, app.window.app.gto.board.filter(Boolean), removal);
}

function projectSample(sampleHandClasses, board, extraBlockers = []) {
  return projectPreflopHandClassesAfterCardRemoval({
    handClasses: sampleHandClasses,
    blockers: [...board, ...extraBlockers],
  });
}

test('comparison renderer contains no evaluator, category-ranking, flush-draw, or straight-draw mathematics', () => {
  // Protects: the page has no evaluator of its own; every rendered cell shows
  // exactly the category/state of the canonical comparison facts.
  for (const name of ['scoreSevenJs', 'scoreRangeHand', 'evaluateFive', 'evaluateSeven', 'hasFD', 'hasSD']) {
    assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  }
  assert.equal(rendered?.status ?? 'available', 'available');
  for (const [side, gridId] of [['hero', 'heroRangeGrid'], ['villain', 'villainRangeGrid']]) {
    const facts = expectedFacts(side);
    const cells = app.$$(`#${gridId} .range-cell`);
    assert.equal(cells.length, 169);
    for (const cell of cells) {
      const fact = facts.cells[cell.dataset.hand];
      const state = fact?.state === 'fully_removed' ? 'fully-removed' : fact?.state === 'not_in_sample' ? 'not-in-sample' : 'eligible';
      assert.equal(cell.dataset.sampleState, state, `${side} ${cell.dataset.hand}`);
      const category = { very_strong_made: 'very-strong', strong_made: 'strong-made', marginal_or_draw: 'marginal-draw', air: 'air' }[fact?.category] || 'none';
      assert.equal(cell.dataset.category, category, `${side} ${cell.dataset.hand}`);
    }
  }
});

test('DOM-free application projection delegates exact classification to canonical Range Analysis facts', () => {
  assert.match(comparisonFactsSource, /import \{ deriveExactHandFacts \} from '\.\/range-analysis\.mjs'/);
  assert.match(comparisonFactsSource, /const exactFacts = deriveExactHandFacts/);
  assert.match(rangeAnalysisSource, /evaluateAvailableCards\(\[\.\.\.heroCards, \.\.\.board\]\)/);
  assert.match(rangeAnalysisSource, /evaluateFive|evaluateSeven/);
  assert.match(bootstrap, /createRepresentativeRangeComparisonFacts/);
  assert.match(bootstrap, /rangeComparisonFactsSchemaVersion/);
});

test('independent representative shares preserve forty percent versus twenty percent', () => {
  const board = ['As', 'Kd', '7c'];
  const heroSample = ['AA', 'AKs', 'QQ', '98s', '54s'];
  const opponentSample = ['AA', 'QQ', 'JJ', '98s', '54s'];
  const allClasses = [...new Set([...heroSample, ...opponentSample])];
  const hero = createRepresentativeRangeComparisonFacts({
    handClasses: allClasses,
    sampleHandClasses: heroSample,
    board,
    cardRemoval: projectSample(heroSample, board),
  });
  const opponent = createRepresentativeRangeComparisonFacts({
    handClasses: allClasses,
    sampleHandClasses: opponentSample,
    board,
    cardRemoval: projectSample(opponentSample, board),
  });
  const strongShare = (facts) => (
    facts.categoryShares.very_strong_made + facts.categoryShares.strong_made
  );
  assert.equal(strongShare(hero), 0.4);
  assert.equal(strongShare(opponent), 0.2);
  // Protects: each advantage bar shows its own side's strong share on the same
  // 0-100% scale (not complementary widths).
  for (const [side, bar] of [['hero', 'heroAdvBar'], ['villain', 'villainAdvBar']]) {
    const facts = expectedFacts(side);
    const share = (facts.categoryShares.very_strong_made || 0) + (facts.categoryShares.strong_made || 0);
    assert.equal(app.byId(bar).style.width, `${(share * 100).toFixed(1)}%`, side);
  }
});

test('fully removed and not-in-sample remain distinct structured states', () => {
  const board = ['2s', '3h', '4d'];
  const facts = createRepresentativeRangeComparisonFacts({
    handClasses: ['AA', 'KK'],
    sampleHandClasses: ['AA'],
    board,
    cardRemoval: projectSample(['AA'], board, ['As', 'Ah', 'Ad', 'Ac']),
  });
  assert.equal(facts.cells.AA.state, RANGE_COMPARISON_CELL_STATES.FULLY_REMOVED);
  assert.equal(facts.cells.KK.state, RANGE_COMPARISON_CELL_STATES.NOT_IN_SAMPLE);
  assert.equal(facts.coverage.fullyRemovedSampleClassCount, 1);
  assert.equal(facts.coverage.notInSampleClassCount, 1);
  // Both states render distinctly in the page.
  const fullyRemoved = app.$('#heroRangeGrid .range-cell.is-fully-removed, #villainRangeGrid .range-cell.is-fully-removed');
  const notInSample = app.$('#heroRangeGrid .range-cell.is-not-in-sample');
  assert.ok(fullyRemoved && notInSample);
  assert.match(fullyRemoved.getAttribute('aria-label'), /Unavailable after known-card removal/);
  assert.match(notInSample.getAttribute('aria-label'), /Not in sample/);
});

test('representative-sample basis is immutable and visibly rejects class-wide generalization', () => {
  const board = ['As', 'Kd', '7c'];
  const facts = createRepresentativeRangeComparisonFacts({
    handClasses: ['AA'],
    sampleHandClasses: ['AA'],
    board,
    cardRemoval: projectSample(['AA'], board),
  });
  assert.equal(facts.basis, 'one_canonical_surviving_combo_per_eligible_sampled_class');
  assert.equal(facts.generalizesToEveryComboInClass, false);
  assert.equal(facts.normalization.available, false);
  assert.equal(Object.isFrozen(facts), true);
  assert.match(text(app.byId('rangeCoverageBasis')), /Shares describe those representatives only, not every combo in each class/);
  assert.match(text(app.byId('rangeComparisonLimitation')), /category does not describe every combo in that class/);
  assert.match(text(markup.body), /Unavailable · class sample has no combo weights/);
});
