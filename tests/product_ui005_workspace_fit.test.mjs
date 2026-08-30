import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const ticketCss = css.slice(css.indexOf('PRODUCT-UI-005: workspace composition'));
const renderChart = logic.slice(logic.indexOf('function renderChart()'), logic.indexOf('function matrixStrategyKey('));

test('analysis navigation is a labeled part of the current-spot analytical workspace', () => {
  const navigation = html.slice(
    html.indexOf('id="playbookAnalysisNavigation"'),
    html.indexOf('</nav>', html.indexOf('id="playbookAnalysisNavigation"')),
  );
  assert.match(navigation, /aria-labelledby="playbookAnalysisNavigationTitle"/);
  assert.match(navigation, /id="playbookAnalysisTabs"[^>]+role="tablist"/);
  for (const view of ['context', 'chart', 'range']) assert.match(navigation, new RegExp(`data-gto-view="${view}"`));
  assert.match(ticketCss, /#playbookAnalysisNavigation\s*\{\s*order:\s*2/);
  assert.match(ticketCss, /#chartView,[\s\S]*?order:\s*3/);
  assert.match(ticketCss, /#table-wrapper\s*\{\s*order:\s*5/);
  assert.match(logic, /openCharts[\s\S]*?selectPlaybookAnalysisView\(el, true\)/);
  assert.match(logic, /\['backContext', 'postflopMatrixBack'\][\s\S]*?selectPlaybookAnalysisView\(el, true\)/);
});

test('postflop Matrix uses one compact truthful empty state and no 169 unavailable cells', () => {
  assert.match(html, /id="postflopMatrixEmpty"[^>]+hidden/);
  assert.match(html, /Range expansion not available yet/);
  assert.match(html, /Exact-hand postflop strategy is available in Decision/);
  assert.match(renderChart, /if \(isPostFlop\) \{[\s\S]*?grid\.replaceChildren\(\)[\s\S]*?return;/);
  assert.match(renderChart, /matrixLayout\.hidden = isPostFlop/);
  assert.match(renderChart, /matrixEmptyState\.hidden = !isPostFlop/);
  assert.doesNotMatch(renderChart, /isPostFlop\s*\?\s*['"]Unavailable['"]/);
  assert.match(ticketCss, /\.matrix-empty-state\s*\{[\s\S]*?min-height:\s*156px/);
});

test('preflop Matrix retains the provider-backed 13 by 13 model and readable local overflow', () => {
  assert.match(renderChart, /RANKS\.forEach\(\(_?, row\) => RANKS\.forEach/);
  assert.match(renderChart, /grid\.appendChild\(btn\)/);
  assert.match(renderChart, /const matrixCell = matrixModel\.cells\[row \* 13 \+ column\]/);
  assert.match(renderChart, /const actions = matrixCell\?\.actions \|\| \[\]/);
  assert.match(ticketCss, /--range-matrix-cell:\s*clamp\(42px, 2\.75vw, 46px\)/);
  assert.match(css, /\.range-matrix-panel \.matrix-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(ticketCss, /@container \(max-width: 900px\)/);
});

test('preflop Matrix communicates the real strategy mix without filling every cell with numbers', () => {
  assert.match(renderChart, /const dominantAction = actions\.reduce/);
  assert.match(renderChart, /button\.dataset\.primaryAction = visualActionKind\(dominantAction\)/);
  assert.match(renderChart, /button\.dataset\.mixState = mixState/);
  assert.match(renderChart, /matrix-mix-bar[\s\S]*?actions\.map[\s\S]*?action\.value/);
  assert.match(ticketCss, /\.hand-cell\[data-state="available"\]\s*\{[\s\S]*?color-mix/);
  assert.match(ticketCss, /\.range-matrix-panel \.matrix-mix-bar\s*\{[\s\S]*?height:\s*8px/);
  assert.doesNotMatch(html, /id="matrixCellCue"|class="matrix-cell-cue"/);
  assert.match(logic, /grid\.addEventListener\('pointerover',[\s\S]*?renderMatrixCellInspector/);
  assert.match(logic, /grid\.addEventListener\('focusin',[\s\S]*?renderMatrixCellInspector/);
  assert.match(css, /\.matrix-inspector-legend\s*\{[^}]*display:\s*grid/);
  assert.match(renderChart, /button\.dataset\.strategyCue = detail/);
  assert.match(logic, /function renderMatrixCellInspector\([\s\S]*?\$\('#selectedMix'\)\.innerHTML/);
});

test('range category comparison keeps both complete matrices aligned without an internal scroller', () => {
  const range = html.slice(html.indexOf('id="rangeView"'), html.indexOf('</main>'));
  assert.doesNotMatch(range, /range-comparison-scroll|Scrollable aligned/);
  assert.equal((range.match(/class="range-comparison-pane"/g) || []).length, 2);
  assert.match(range, /id="heroRangeGrid"[\s\S]*?id="villainRangeGrid"/);
  assert.doesNotMatch(range, /class="range-grid-split"[^>]+style=/);
  assert.match(ticketCss, /\.range-comparison-matrices\s*\{[^}]*overflow:\s*visible/);
  assert.match(ticketCss, /\.range-grid-split\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(ticketCss, /\.range-comparison-pane \.matrix-wrap\s*\{[^}]*overflow:\s*visible/);
});

test('Training compacts only an actually empty board while retaining Hero cards', () => {
  assert.match(logic, /tableSummary\.dataset\.boardState = boardCards\.length \? 'board' : 'empty'/);
  assert.match(ticketCss, /\.training-table-summary\[data-board-state="empty"\]\s*\{[\s\S]*?min-height:\s*148px/);
  assert.match(ticketCss, /@media \(min-width: 1320px\)[\s\S]*?\.training-table-summary\[data-board-state="empty"\]\s*\{[^}]*min-height:\s*140px/);
  assert.match(ticketCss, /@media \(min-width: 1320px\)[\s\S]*?#trainingMode\s*\{[^}]*padding:\s*var\(--space-3\)/);
  assert.match(ticketCss, /grid-template-columns:\s*minmax\(108px, \.55fr\) 1px minmax\(0, 1\.45fr\)/);
  assert.match(html, /id="trainingHeroCards"/);
  assert.match(logic, /heroTarget\.innerHTML = heroCards\.map\(readOnlyCard\)\.join\(''\)/);
});

test('desktop composition contains wide content inside local scrollers rather than the page', () => {
  assert.match(ticketCss, /\.range-comparison-panel\s*\{[^}]*overflow:\s*visible/);
  assert.match(ticketCss, /\.range-comparison-panel > \.panel-body\s*\{[^}]*max-block-size:\s*none;[^}]*overflow:\s*visible/);
  assert.match(ticketCss, /\.range-comparison-matrices\s*\{[^}]*overflow:\s*visible/);
  assert.match(ticketCss, /\.range-matrix-panel \.strategy-grid\s*\{[^}]*min-width:\s*max-content/);
  assert.doesNotMatch(ticketCss, /(?:^|\n)\s*(?:html|body)\s*\{[^}]*overflow-x:\s*(?:auto|scroll)/);
});
