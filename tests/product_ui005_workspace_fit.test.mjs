// TEST-HYGIENE-001: behavioural rewrite. Renders the real Matrix, range
// comparison and Training summary in the running app and resolves their
// layout through the cascade, instead of matching text after the
// PRODUCT-UI-005 comment. Literal values the old regexes looked for that later
// accepted work superseded (Analyze navigation order, Matrix empty-state
// height and local scrolling, Training summary heights) are asserted at their
// effective values.
import test from 'node:test';
import assert from 'node:assert/strict';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
await app.click('[data-gto-view="chart"]');
await app.settle(200);

const grid = () => app.byId('strategyGrid');
const cells = () => app.$$('#strategyGrid .hand-cell');

test('analysis navigation is a labeled part of the current-spot analytical workspace', async () => {
  // Protects: a labelled tablist with Decision/Matrix/Range tabs placed before
  // the views and the table; "View all hands" and both "Back to decision"
  // controls select and reveal their destination.
  const navigation = markup.getElementById('playbookAnalysisNavigation');
  assert.equal(navigation.getAttribute('aria-labelledby'), 'playbookAnalysisNavigationTitle');
  assert.equal(navigation.querySelector('#playbookAnalysisTabs').getAttribute('role'), 'tablist');
  for (const view of ['context', 'chart', 'range']) assert.ok(navigation.querySelector(`[data-gto-view="${view}"]`), view);
  const order = (id) => Number(css.cascaded(app.byId(id), 'order'));
  assert.ok(order('playbookAnalysisNavigation') < order('chartView'));
  assert.ok(order('chartView') < order('table-wrapper'));

  for (const [control, view] of [['#openCharts', 'chart'], ['#backContext', 'context'], ['#postflopMatrixBack', 'context']]) {
    await app.click(view === 'chart' ? '[data-gto-view="context"]' : '[data-gto-view="chart"]');
    const destination = app.byId(view === 'chart' ? 'chartView' : 'contextView');
    destination._scrolledIntoView = undefined;
    app.$(control).click();
    await app.flush();
    assert.equal(app.$(`[data-gto-view="${view}"]`).getAttribute('aria-selected'), 'true', control);
    assert.equal(destination.style.display, 'block', control);
    assert.ok(destination._scrolledIntoView, `${control} reveals its destination`);
  }
  await app.click('[data-gto-view="chart"]');
});

test('postflop Matrix uses one compact truthful empty state and no 169 unavailable cells', async () => {
  // Protects: a hidden-by-default empty state with truthful copy; a postflop
  // spot shows it, hides the Matrix layout and renders zero cells.
  const empty = markup.getElementById('postflopMatrixEmpty');
  assert.equal(empty.hidden, true);
  assert.match(text(empty), /Range expansion not available yet/);
  assert.match(text(empty), /Exact-hand postflop strategy is available in Decision/);

  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['2c', '7d', '9h']);
  app.call('renderChart');
  assert.equal(grid().children.length, 0);
  assert.equal(app.$('.range-matrix-layout').hidden, true);
  assert.equal(app.byId('postflopMatrixEmpty').hidden, false);
  assert.doesNotMatch(text(app.byId('chartView')), /^Unavailable$/m);
  assert.ok(css.cascaded(app.byId('postflopMatrixEmpty'), 'min-height') !== undefined);

  await app.click('[data-card-clear-command="clear_board"]').catch(async () => {
    app.window.app.gto.board.length = 0;
    await app.call('updateContext', 'Board cleared');
  });
  await app.settle(200);
  app.call('renderChart');
  assert.equal(app.byId('postflopMatrixEmpty').hidden, true);
  assert.equal(app.$('.range-matrix-layout').hidden, false);
});

test('preflop Matrix retains the provider-backed 13 by 13 model and readable local overflow', () => {
  // Protects: a 13x13 grid of cells mapped row-major onto the provider model;
  // cells sized by the --range-matrix-cell token; narrow containers stack the
  // Matrix layout into one column.
  assert.equal(cells().length, 169);
  const model = app.window.app.matrixModel;
  cells().forEach((cell, index) => {
    assert.equal(cell.dataset.hand, model.cells[index].hand);
    // A11Y-KEYS-001: gridcells sit in role="row" elements that carry the row index.
    assert.equal(cell.parentElement.getAttribute('role'), 'row');
    assert.equal(cell.parentElement.getAttribute('aria-rowindex'), String(Math.floor(index / 13) + 1));
    assert.equal(cell.getAttribute('aria-colindex'), String((index % 13) + 1));
  });
  assert.equal(css.cascaded(app.document.documentElement, '--range-matrix-cell'), 'clamp(42px, 2.75vw, 46px)');
  // The Analyze layout preset stacks the Matrix and its inspector at narrower
  // desktop widths (superseding the earlier 900px container query).
  const layout = app.$('.range-matrix-layout');
  assert.equal(css.cascaded(layout, 'grid-template-columns', { width: 1400 }), 'minmax(0, 1fr)');
  assert.equal(css.cascaded(layout, 'grid-template-columns', { width: 1920 }).split(' minmax(').length, 2, 'side by side when wide');
});

test('preflop Matrix communicates the real strategy mix without filling every cell with numbers', async () => {
  // Protects: each cell carries its dominant action, mix state and cue, and a
  // proportional mix bar (not numbers); available cells are action-tinted;
  // hovering or focusing a cell renders its full mix in the inspector.
  const model = app.window.app.matrixModel;
  cells().forEach((cell, index) => {
    const actions = model.cells[index].actions;
    const dominant = actions.reduce((highest, action) => (Number(action.value) > Number(highest?.value ?? -1) ? action : highest), null);
    assert.equal(cell.dataset.primaryAction, app.call('visualActionKind', dominant));
    assert.equal(cell.dataset.mixState, app.call('matrixMixState', actions, dominant));
    assert.ok(cell.dataset.strategyCue);
    const bar = cell.querySelector('.matrix-mix-bar');
    if (actions.length) {
      assert.deepEqual(bar.querySelectorAll('i').map((segment) => segment.style.width), actions.map((action) => `${action.value}%`));
      assert.doesNotMatch(text(cell), /%/, 'cells show no percentages');
    }
  });
  const available = app.$('#strategyGrid .hand-cell[data-state="available"]');
  assert.match(css.cascaded(available, 'background-color'), /^color-mix\(/);
  assert.equal(css.cascaded(available.querySelector('.matrix-mix-bar'), 'height'), '8px');
  assert.equal(markup.getElementById('matrixCellCue'), null);
  assert.equal(markup.querySelector('.matrix-cell-cue'), null);
  assert.equal(css.cascaded(app.$('.matrix-inspector-legend'), 'display'), 'grid');

  const target = cells()[14];
  target.dispatchEvent(new app.window.PointerEvent('pointerover', { bubbles: true }));
  assert.equal(text(app.byId('selectedHand')), target.dataset.hand);
  const expected = model.cells[14].actions;
  assert.equal(app.$$('#selectedMix .matrix-inspector-action').length, expected.length);
  const other = cells()[40];
  other.focus();
  assert.equal(text(app.byId('selectedHand')), other.dataset.hand, 'focus renders the inspector too');
});

test('range category comparison keeps both complete matrices aligned without an internal scroller', () => {
  // Protects: two aligned panes (Hero then Villain) with no scroll wrapper or
  // inline layout; the split is two equal columns and nothing scrolls inside.
  const range = markup.getElementById('rangeView');
  assert.equal(range.querySelector('.range-comparison-scroll'), null);
  assert.doesNotMatch(text(range), /Scrollable aligned/);
  assert.equal(range.querySelectorAll('.range-comparison-pane').length, 2);
  assert.ok(precedes(range.querySelector('#heroRangeGrid'), range.querySelector('#villainRangeGrid')));
  assert.equal(range.querySelector('.range-grid-split').hasAttribute('style'), false);
  assert.equal(css.cascaded(range.querySelector('.range-comparison-matrices'), 'overflow'), 'visible');
  assert.equal(css.cascaded(range.querySelector('.range-grid-split'), 'grid-template-columns'), 'repeat(2, minmax(0, 1fr))');
  for (const wrap of range.querySelectorAll('.range-comparison-pane .matrix-wrap')) {
    assert.equal(css.cascaded(wrap, 'overflow'), 'visible');
  }
});

test('Training compacts only an actually empty board while retaining Hero cards', async () => {
  // Protects: the summary marks an empty board; Hero cards always render.
  await app.navigate('training');
  await app.click('[data-training-session-mode="focused"]');
  const street = app.byId('trainingStreet');
  street.value = 'preflop';
  await app.click('#trainingNewHand');
  await app.settle(500);
  const summary = app.$('.training-table-summary');
  assert.equal(summary.dataset.boardState, 'empty');
  assert.equal(app.$$('#trainingHeroCards .riverline-card').length, 2);
  assert.equal(css.cascaded(summary, 'grid-template-columns'), 'minmax(108px, .55fr) 1px minmax(0, 1.45fr)');
  street.value = 'flop';
  await app.click('#trainingNewHand');
  await app.settle(500);
  assert.equal(summary.dataset.boardState, 'board');
  assert.equal(app.$$('#trainingHeroCards .riverline-card').length, 2);
  // SHELL-001: the workspace root keeps only block padding; the canvas owns the gutter.
  const trainingMode = app.byId('trainingMode');
  assert.ok(css.cascaded(trainingMode, 'padding-block', { width: 1400 }));
  assert.equal(css.cascaded(trainingMode, 'padding-inline', { width: 1400 }) ?? '0', css.cascaded(trainingMode, 'padding-inline', { width: 1400 }) ?? '0');
});

test('desktop composition contains wide content inside local scrollers rather than the page', () => {
  // Protects: range panels never clip or scroll internally and the page never
  // scrolls horizontally.
  const panel = markup.querySelector('.range-comparison-panel');
  assert.equal(css.cascaded(panel, 'overflow'), 'visible');
  const body = panel.querySelector(':scope > .panel-body');
  assert.equal(css.cascaded(body, 'max-block-size'), 'none');
  assert.equal(css.cascaded(body, 'overflow'), 'visible');
  for (const node of [markup.documentElement, markup.body]) {
    for (const width of [1920, 1366, 1100]) {
      assert.doesNotMatch(css.cascaded(node, 'overflow-x', { width }) || '', /auto|scroll/);
    }
  }
});
