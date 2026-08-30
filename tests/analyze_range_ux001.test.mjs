import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { projectPreflopHandClassesAfterCardRemoval } from '../app/src/application/range-card-removal.mjs';

const [html, css, logic, rangeAnalysis] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/range-analysis.mjs', import.meta.url), 'utf8'),
]);

const matrix = html.slice(html.indexOf('id="chartView"'), html.indexOf('id="rangeView"'));
const comparison = html.slice(html.indexOf('id="rangeView"'), html.indexOf('</main>'));
const renderChart = logic.slice(logic.indexOf('function renderChart()'), logic.indexOf('function matrixStrategyKey'));
const renderComparison = logic.slice(logic.indexOf('function rangeRemovalPresentation'), logic.indexOf('function renderBettingTree'));

test('Matrix keeps selection, canonical combo availability, source, and legend in one local layout', () => {
  assert.match(matrix, /class="range-matrix-layout"[\s\S]*class="selected-hand matrix-hand-inspector"[\s\S]*id="selectedMix"[\s\S]*class="matrix-inspector-legend"[\s\S]*id="strategyKey"/);
  const matrixMain = matrix.slice(matrix.indexOf('class="range-matrix-main"'), matrix.indexOf('class="selected-hand matrix-hand-inspector"'));
  assert.doesNotMatch(matrixMain, /id="strategyKey"/);
  for (const id of ['selectedAvailableCombos', 'selectedRemovedCombos', 'selectedRangeSource']) {
    assert.match(matrix, new RegExp(`id="${id}"`));
  }
  assert.match(renderChart, /matrixCell\.eligibleComboCount/);
  assert.match(renderChart, /matrixCell\.physicalComboCount/);
  assert.match(renderChart, /matrixCell\.blockedComboCount/);
  assert.match(css, /\.matrix-inspector-facts\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /\.matrix-action-legend\s*\{[^}]*display:\s*flex/);
});

test('Matrix inspection stays in the local inspector with no floating popup', () => {
  assert.doesNotMatch(html, /id="matrixCellCue"|class="matrix-cell-cue"/);
  assert.doesNotMatch(css, /\.matrix-cell-cue/);
  assert.doesNotMatch(logic, /showMatrixCellCue|hideMatrixCellCue/);
  assert.match(logic, /grid\.addEventListener\('pointerover',[\s\S]*?renderMatrixCellInspector\(cell\)/);
  assert.match(logic, /grid\.addEventListener\('focusin',[\s\S]*?renderMatrixCellInspector/);
  assert.match(logic, /restoreSelectedMatrixInspector\(grid\)/);
  assert.match(renderChart, /button\.setAttribute\('aria-label', `\$\{hand\}, \$\{kindLabel\}: \$\{detail\}`\)/);
});

test('Hero and opponent comparison uses independent values on one shared zero-to-one-hundred scale', () => {
  assert.match(comparison, /Independent shares on one 0–100% scale/);
  assert.match(comparison, /class="paired-range-comparison"/);
  for (const id of ['heroVeryStrongBar', 'villainVeryStrongBar', 'heroAdvBar', 'villainAdvBar']) {
    assert.match(comparison, new RegExp(`id="${id}"`));
  }
  assert.match(renderComparison, /heroAdvBar'\)\) \$\('#heroAdvBar'\)\.style\.width = `\$\{\(heroStrongShare \* 100\)/);
  assert.match(renderComparison, /villainAdvBar'\)\) \$\('#villainAdvBar'\)\.style\.width = `\$\{\(villainStrongShare \* 100\)/);
  assert.doesNotMatch(renderComparison, /combinedShare|100\s*-\s*heroBarShare|heroStrongShare\s*\/\s*combined/);
  assert.match(css, /\.paired-range-track\s*\{[^}]*width:[^}]*height:\s*9px/);
});

test('comparison exposes sources, coverage, unavailable normalization, and card-removal basis without inferring missing classes', () => {
  for (const id of ['heroRangeBasis', 'villainRangeBasis', 'rangeCoverageBasis', 'rangeRemovalSummary', 'rangeRemovalTechnical']) {
    assert.match(comparison, new RegExp(`id="${id}"`));
  }
  assert.match(comparison, /Unavailable · class sample has no combo weights/);
  assert.match(logic, /unlisted classes are not inferred/);
  assert.match(logic, /Board\/dead cards condition both; Hero cards additionally condition the opponent/);
  assert.match(logic, /Known weighted mass is unavailable because these samples have no combo weights/);
  assert.match(rangeAnalysis, /const normalizationAvailable = inspection\.complete && eligibleKnownMass > 0/);
  assert.match(rangeAnalysis, /unknownEligibleComboCount: conditioned\.facts\.unknownEligibleCombos/);
  assert.doesNotMatch(renderComparison, /weighted range-vs-range|calculateEquity|conditionHoldemRange/);
});

test('dead-card unavailable combos stay canonical and agree with the local inspector projection', () => {
  const conditioned = projectPreflopHandClassesAfterCardRemoval({
    handClasses: ['AA', 'AKs', 'AKo'],
    blockers: ['As', 'Ah', 'Ad', 'Ac'],
  });
  assert.equal(conditioned.cells.AA.eligibleComboCount, 0);
  assert.equal(conditioned.cells.AA.blockedComboCount, 6);
  assert.equal(conditioned.cells.AA.fullyRemoved, true);
  assert.match(logic, /projectHandClassesAfterCardRemoval\(\s*handClasses,\s*\[\.\.\.decisionContext\.board, \.\.\.decisionContext\.deadCards\]/);
  assert.match(logic, /\[\.\.\.commonBlockers, \.\.\.decisionContext\.heroCards\]/);
});

test('Facts are visible before bounded Explain and only secondary comparison detail stays disclosed', () => {
  const decision = html.slice(html.indexOf('id="recommendation"'), html.indexOf('id="handLiveStageHeader"'));
  assert.match(decision, /class="playbook-facts-heading"[\s\S]*data-i18n="Facts"/);
  assert.match(decision, /id="mEquity"/);
  assert.match(decision, /id="mRake"/);
  assert.match(decision, /id="toggleTeacher"[^>]+aria-expanded="false"[^>]+aria-controls="teacherContent"/);
  assert.match(logic, /toggleTeacher'\)\.setAttribute\('aria-expanded', String\(isHidden\)\)/);
  assert.match(css, /\.analysis-panel-content\s*\{[^}]*max-block-size:\s*min\(420px, 44vh\)[^}]*overflow:\s*auto/);
  assert.match(comparison, /<details id="rangeTechnicalDetails" class="range-technical-details">/);
  const technical = comparison.slice(comparison.indexOf('id="rangeTechnicalDetails"'), comparison.indexOf('</details>'));
  assert.doesNotMatch(technical, /heroRangeGrid|villainRangeGrid|range-comparison-scroll/);
});

test('comparison matrices lead the bars, render immediately, and have no internal scroll contract', () => {
  const matricesIndex = comparison.indexOf('class="range-comparison-matrices"');
  const barsIndex = comparison.indexOf('class="paired-range-comparison"');
  const basisIndex = comparison.indexOf('class="range-comparison-basis"');
  assert.ok(matricesIndex >= 0 && matricesIndex < barsIndex && barsIndex < basisIndex);
  assert.match(renderComparison, /renderRangeGrid\('heroRangeGrid'[\s\S]*renderRangeGrid\('villainRangeGrid'/);
  assert.doesNotMatch(renderComparison, /technicalDetails\?\.open|addEventListener\('toggle'/);
  assert.doesNotMatch(comparison, /range-comparison-scroll|Scrollable aligned/);
  assert.match(css, /\.range-comparison-matrices\s*\{[^}]*overflow:\s*visible/);
  assert.match(css, /\.range-grid-split\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.range-comparison-pane \.matrix-wrap\s*\{[^}]*overflow:\s*visible/);
});

test('comparison cells use semantic pastel states and keep removed distinct from not-in-sample', () => {
  for (const state of ['very-strong', 'strong-made', 'marginal-draw', 'air']) {
    assert.match(css, new RegExp(`\\.range-comparison-pane \\.range-cell\\[data-category="${state}"\\][^}]+color-mix`));
  }
  assert.match(renderComparison, /btn\.dataset\.sampleState = state/);
  assert.match(renderComparison, /fullyRemoved \? 'fully-removed' : notInSample \? 'not-in-sample'/);
  assert.match(css, /data-sample-state="fully-removed"[^}]*repeating-linear-gradient/);
  assert.match(css, /data-sample-state="not-in-sample"[^}]*border:\s*1px dashed/);
  assert.match(comparison, /data-state="fully-removed"[\s\S]*Unavailable after known-card removal/);
  assert.match(comparison, /data-state="not-in-sample"[\s\S]*Not in sample/);
  assert.doesNotMatch(renderComparison, /style\.background|#8bc34a|#1e293b|#334155/);
});
