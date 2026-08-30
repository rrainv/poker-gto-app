import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  RANGE_COMPARISON_CELL_STATES,
  createRepresentativeRangeComparisonFacts,
} from '../app/src/application/range-comparison-facts.mjs';
import { projectPreflopHandClassesAfterCardRemoval } from '../app/src/application/range-card-removal.mjs';

const [logic, comparisonFactsSource, rangeAnalysisSource, bootstrap, html] = await Promise.all([
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/range-comparison-facts.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/range-analysis.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/analysis-explanation-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
]);

const renderer = logic.slice(
  logic.indexOf('function rangeRemovalPresentation'),
  logic.indexOf('function renderBettingTree'),
);

function projectSample(sampleHandClasses, board, extraBlockers = []) {
  return projectPreflopHandClassesAfterCardRemoval({
    handClasses: sampleHandClasses,
    blockers: [...board, ...extraBlockers],
  });
}

test('comparison renderer contains no evaluator, category-ranking, flush-draw, or straight-draw mathematics', () => {
  assert.doesNotMatch(logic, /function scoreSevenJs|function scoreRangeHand/);
  assert.doesNotMatch(renderer, /evaluateFive|evaluateSeven|deriveExactHandFacts|RANK_VAL|hasFD|hasSD|isFlush|isStraight|getCombinations/);
  assert.doesNotMatch(renderer, /suits\.filter|ranks\[k\s*\+\s*3\]|categoryRank\s*[><=]/);
  assert.match(renderer, /createRepresentativeRangeComparisonFacts/);
  assert.match(renderer, /comparisonFacts\?\.cells/);
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
  assert.match(renderer, /heroAdvBar'\)\) \$\('#heroAdvBar'\)\.style\.width = `\$\{\(heroStrongShare \* 100\)/);
  assert.match(renderer, /villainAdvBar'\)\) \$\('#villainAdvBar'\)\.style\.width = `\$\{\(villainStrongShare \* 100\)/);
  assert.doesNotMatch(renderer, /100\s*-\s*hero|combinedShare/);
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
  assert.match(renderer, /cell\?\.state === 'fully_removed'/);
  assert.match(renderer, /cell\?\.state === 'not_in_sample'/);
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
  assert.match(logic, /Shares describe those representatives only, not every combo in each class/);
  assert.match(logic, /category does not describe every combo in that class/);
  assert.match(html, /Unavailable · class sample has no combo weights/);
});
