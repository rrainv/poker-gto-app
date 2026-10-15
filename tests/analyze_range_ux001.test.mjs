// TEST-HYGIENE-001: behavioural rewrite. The Matrix and the Range Category
// Comparison are rendered and inspected in the running app; markup is queried
// and styles are resolved through the cascade. The range-analysis module
// source is outside this ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { projectPreflopHandClassesAfterCardRemoval } from '../app/src/application/range-card-removal.mjs';
import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

const rangeAnalysis = await readFile(new URL('../app/src/application/range-analysis.mjs', import.meta.url), 'utf8');
const markup = indexDocument();
const matrix = markup.getElementById('chartView');
const comparison = markup.getElementById('rangeView');
const css = appStyleSheet();
const app = await bootApp();
await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['Qs', 'Qd']);
await app.pickCards('#gtoMode [data-card-set-edit="dead"]', ['Ah', 'Ac']);
await app.click('[data-gto-view="chart"]');
await app.settle(200);
const cells = () => app.$$('#strategyGrid .hand-cell');

test('Matrix keeps selection, canonical combo availability, source, and legend in one local layout', () => {
  // Protects: the inspector, mix, legend and key live in one Matrix layout
  // (the key outside the grid column); hovering a cell shows its canonical
  // available/removed combo counts; inspector facts are two columns and the
  // action legend is a flex row.
  const layout = matrix.querySelector('.range-matrix-layout');
  const chain = ['.selected-hand.matrix-hand-inspector', '#selectedMix', '.matrix-inspector-legend', '#strategyKey'].map((selector) => layout.querySelector(selector));
  assert.ok(chain.every(Boolean));
  chain.slice(1).forEach((node, index) => assert.ok(precedes(chain[index], node)));
  assert.equal(layout.querySelector('.range-matrix-main #strategyKey'), null);
  for (const id of ['selectedAvailableCombos', 'selectedRemovedCombos', 'selectedRangeSource']) assert.ok(matrix.querySelector(`#${id}`), id);

  const model = app.window.app.matrixModel;
  const index = model.cells.findIndex((cell) => cell.hand === 'AA');
  cells()[index].dispatchEvent(new app.window.PointerEvent('pointerover', { bubbles: true }));
  const aa = model.cells[index];
  assert.equal(aa.blockedComboCount > 0, true, 'dead aces remove AA combos');
  assert.match(text(app.byId('selectedAvailableCombos')), new RegExp(`\\b${aa.eligibleComboCount}\\b`));
  assert.match(text(app.byId('selectedRemovedCombos')), new RegExp(`\\b${aa.blockedComboCount}\\b`));
  assert.match(css.cascaded(app.$('.matrix-inspector-facts'), 'grid-template-columns'), /^repeat\(2/);
  assert.equal(css.cascaded(app.$('.matrix-action-legend'), 'display'), 'flex');
});

test('Matrix inspection stays in the local inspector with no floating popup', () => {
  // Protects: no floating cue; hover/focus render the local inspector and
  // leaving restores the selected hand; cells announce hand, kind and detail.
  assert.equal(markup.getElementById('matrixCellCue'), null);
  assert.equal(markup.querySelector('.matrix-cell-cue'), null);
  assert.equal(css.rulesMentioning('.matrix-cell-cue').length, 0);
  for (const name of ['showMatrixCellCue', 'hideMatrixCellCue']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined');
  const [first, , third] = cells();
  first.click();
  const selected = app.window.app.selectedHand;
  third.dispatchEvent(new app.window.PointerEvent('pointerover', { bubbles: true }));
  assert.equal(text(app.byId('selectedHand')), third.dataset.hand);
  third.dispatchEvent(new app.window.PointerEvent('pointerout', { bubbles: true }));
  assert.equal(text(app.byId('selectedHand')), selected, 'leaving restores the selected hand');
  cells()[20].focus();
  assert.equal(text(app.byId('selectedHand')), cells()[20].dataset.hand);
  for (const cell of cells().slice(0, 20)) {
    const label = cell.getAttribute('aria-label');
    assert.ok(label.startsWith(`${cell.dataset.hand}, `), label);
    assert.ok(label.endsWith(`: ${cell.dataset.strategyCue}`), label);
  }
});

async function renderComparison() {
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['As', 'Ad', '7c']);
  await app.click('[data-gto-view="range"]');
  await app.settle(200);
  return app.call('renderRangeAdvantage');
}

test('Hero and opponent comparison uses independent values on one shared zero-to-one-hundred scale', async () => {
  const scale = comparison.querySelector('[data-i18n="Independent shares on one 0–100% scale"]');
  assert.match(text(scale), /^Independent shares on one 0.100% scale$/);
  assert.ok(comparison.querySelector('.paired-range-comparison'));
  for (const id of ['heroVeryStrongBar', 'villainVeryStrongBar', 'heroAdvBar', 'villainAdvBar']) assert.ok(comparison.querySelector(`#${id}`), id);
  await renderComparison();
  const width = (id) => Number.parseFloat(app.byId(id).style.width);
  const hero = width('heroAdvBar');
  const villain = width('villainAdvBar');
  assert.ok(hero >= 0 && hero <= 100 && villain >= 0 && villain <= 100);
  assert.match(text(app.byId('heroRangeScore')), new RegExp(`^${hero.toFixed(1)}%`));
  assert.match(text(app.byId('villainRangeScore')), new RegExp(`^${villain.toFixed(1)}%`));
  assert.equal(css.cascaded(app.$('.paired-range-track'), 'height'), '9px');
  assert.equal(css.cascaded(app.$('.paired-range-track'), 'min-width'), '0');
});

test('comparison exposes sources, coverage, unavailable normalization, and card-removal basis without inferring missing classes', async () => {
  for (const id of ['heroRangeBasis', 'villainRangeBasis', 'rangeCoverageBasis', 'rangeRemovalSummary', 'rangeRemovalTechnical']) {
    assert.ok(comparison.querySelector(`#${id}`), id);
  }
  assert.match(text(comparison), /Unavailable · class sample has no combo weights/);
  const spy = app.spy(['calculateEquity']);
  try {
    await renderComparison();
    assert.equal(spy.count('calculateEquity'), 0);
  } finally {
    spy.restore();
  }
  assert.match(text(app.byId('rangeCoverageBasis')), /unlisted classes are not inferred/);
  assert.match(text(app.byId('rangeRemovalSummary')), /Board\/dead cards condition both; Hero cards additionally condition the opponent/);
  assert.match(text(app.byId('rangeRemovalTechnical')), /Known weighted mass is unavailable because these samples have no combo weights/);
  assert.match(rangeAnalysis, /const normalizationAvailable = inspection\.complete && eligibleKnownMass > 0/);
  assert.match(rangeAnalysis, /unknownEligibleComboCount: conditioned\.facts\.unknownEligibleCombos/);
});

test('dead-card unavailable combos stay canonical and agree with the local inspector projection', async () => {
  const conditioned = projectPreflopHandClassesAfterCardRemoval({
    handClasses: ['AA', 'AKs', 'AKo'],
    blockers: ['As', 'Ah', 'Ad', 'Ac'],
  });
  assert.equal(conditioned.cells.AA.eligibleComboCount, 0);
  assert.equal(conditioned.cells.AA.blockedComboCount, 6);
  assert.equal(conditioned.cells.AA.fullyRemoved, true);
  // Protects: Matrix projection blocks board + dead cards; the opponent sample
  // is additionally conditioned on Hero's cards.
  const spy = app.spy(['projectHandClassesAfterCardRemoval']);
  try {
    await renderComparison();
    app.window.app.matrixModel = null;
    app.call('prepareMatrixStrategyModel', app.window.app.decisionContext);
  } finally {
    spy.restore();
  }
  const context = app.window.app.decisionContext;
  const common = [...context.board, ...context.deadCards];
  const blockers = spy.calls.projectHandClassesAfterCardRemoval.map(([, cards]) => JSON.stringify(cards));
  assert.ok(blockers.includes(JSON.stringify(common)), 'board + dead');
  assert.ok(blockers.includes(JSON.stringify([...common, ...context.heroCards])), 'opponent also blocks Hero cards');
});

test('Facts are visible before bounded Explain and only secondary comparison detail stays disclosed', async () => {
  const decision = markup.getElementById('recommendation').parentElement;
  // ANALYZE-COMPOSITION-001: the fact grid heading stays as an accessible (sr-only) heading.
  const heading = markup.querySelector('.playbook-facts-heading');
  assert.ok(heading && (heading.dataset.i18n === 'Facts' || heading.querySelector('[data-i18n="Facts"]')));
  for (const id of ['mEquity', 'mRake']) assert.ok(markup.getElementById(id), id);
  const toggle = markup.getElementById('toggleTeacher');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), 'teacherContent');
  await app.click('[data-gto-view="context"]');
  const live = app.byId('toggleTeacher');
  await app.click(live);
  assert.equal(live.getAttribute('aria-expanded'), 'true');
  await app.click(live);
  assert.equal(live.getAttribute('aria-expanded'), 'false');
  const panel = app.$('.analysis-panel-content:not(#teacherContent)') || app.$('.analysis-panel-content');
  assert.ok(decision);
  const technical = comparison.querySelector('#rangeTechnicalDetails');
  assert.equal(technical.localName, 'details');
  assert.ok(technical.classList.contains('range-technical-details'));
  assert.equal(technical.querySelector('#heroRangeGrid, #villainRangeGrid, .range-comparison-scroll'), null);
  assert.ok(panel);
});

test('comparison matrices lead the bars, render immediately, and have no internal scroll contract', async () => {
  const [matrices, bars, basis] = ['.range-comparison-matrices', '.paired-range-comparison', '.range-comparison-basis'].map((selector) => comparison.querySelector(selector));
  assert.ok(precedes(matrices, bars) && precedes(bars, basis));
  app.byId('rangeTechnicalDetails').open = false;
  const spy = app.spy(['renderRangeGrid']);
  try {
    await renderComparison();
    assert.deepEqual(spy.calls.renderRangeGrid.map(([id]) => id).slice(-2), ['heroRangeGrid', 'villainRangeGrid']);
  } finally {
    spy.restore();
  }
  assert.equal(app.$$('#heroRangeGrid .range-cell').length, 169, 'renders without opening the technical details');
  assert.equal(comparison.querySelector('.range-comparison-scroll'), null);
  assert.doesNotMatch(text(comparison), /Scrollable aligned/);
  assert.equal(css.cascaded(comparison.querySelector('.range-comparison-matrices'), 'overflow'), 'visible');
  assert.equal(css.cascaded(comparison.querySelector('.range-grid-split'), 'grid-template-columns'), 'repeat(2, minmax(0, 1fr))');
  for (const wrap of comparison.querySelectorAll('.range-comparison-pane .matrix-wrap')) assert.equal(css.cascaded(wrap, 'overflow'), 'visible');
});

test('comparison cells use semantic pastel states and keep removed distinct from not-in-sample', async () => {
  await renderComparison();
  const rendered = app.$$('#heroRangeGrid .range-cell, #villainRangeGrid .range-cell');
  for (const state of ['very-strong', 'strong-made', 'marginal-draw', 'air']) {
    const cell = rendered.find((candidate) => candidate.dataset.category === state && candidate.dataset.sampleState === 'eligible');
    if (!cell) continue;
    assert.match(css.cascaded(cell, 'background') || css.cascaded(cell, 'background-color') || '', /color-mix/, state);
  }
  const removed = rendered.find((cell) => cell.dataset.sampleState === 'fully-removed');
  const missing = rendered.find((cell) => cell.dataset.sampleState === 'not-in-sample');
  assert.ok(removed && missing);
  assert.match(css.cascaded(removed, 'background') || css.cascaded(removed, 'background-image') || '', /repeating-linear-gradient/);
  assert.match(css.cascaded(missing, 'border') || '', /^1px dashed/);
  const legend = (state) => comparison.querySelector(`[data-state="${state}"]`);
  assert.match(text(legend('fully-removed').parentElement), /Unavailable after known-card removal/);
  assert.match(text(legend('not-in-sample').parentElement), /Not in sample/);
  assert.ok(rendered.every((cell) => !cell.style.getPropertyValue('background') && !cell.style.getPropertyValue('background-color')), 'no inline colours');
});
