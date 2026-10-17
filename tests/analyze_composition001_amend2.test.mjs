import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural. The amendment's functions run in the booted app against the
// real Analyze DOM (instead of vm-sliced logic.js), markup is parsed, and
// styling is resolved through the cascade on the rendered workspace.
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
// SOURCE-SHAPE: D22's "durations come from motion tokens" is a policy lint
// over the amendment block as authored (parsed, not regex-matched); there is
// no runtime behaviour for "never declares a literal ms duration".
const amendSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  return new StyleSheetModel(raw.slice(raw.indexOf('*/', raw.indexOf('ANALYZE-COMPOSITION-001 amendment 2: fidelity finish')) + 2));
})();
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const rail = markup.getElementById('playbookSpotPanel');
const wide = { width: 1600 };

await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
const analyze = (selector) => app.$(`#gtoMode ${selector}`);

test('A1: the mix card lists only actions present in the mix', () => {
  const rows = [1, 2, 3].map((index) => app.byId(`f${index}name`).closest('.frequency'));
  app.call('setFrequency', 1, { name: 'Bet', value: 67, kind: 'aggressive' });
  app.call('setFrequency', 2, { name: 'Check', value: 33, kind: 'passive' });
  app.call('setFrequency', 3, { name: '-', value: 0, kind: 'unavailable' });
  assert.deepEqual(rows.map((row) => row.hidden), [false, false, true]);
  assert.equal(css.cascaded(rows[2], 'display', wide), 'none');
  assert.equal(css.cascaded(rows[0], 'grid-template-columns', wide), '74px minmax(0, 1fr) 48px');
  const number = app.byId('f1num');
  assert.equal(css.cascaded(number, 'text-align', wide), 'end');
  assert.equal(css.cascaded(number, 'font-variant-numeric', wide), 'tabular-nums');
  app.call('renderPath');
});

function applyFacts(values, context) {
  // The real facts strip, rebuilt with the given cells.
  const strip = analyze('.analyze-facts');
  const original = [...strip.children];
  strip.replaceChildren(...values.map(([id, label, value]) => {
    const cell = app.document.createElement('div');
    cell.className = 'metric';
    cell.innerHTML = `<span>${label}</span><b id="${id}-probe">${value}</b>`;
    cell.querySelector('b').id = id;
    return cell;
  }));
  app.call('applyAnalyzeFactOmission', context);
  const cells = [...strip.children];
  const note = app.byId('analyzeOmittedFacts');
  const result = { cells, strip, note: { hidden: note.hidden, textContent: note.textContent } };
  return { ...result, restore: () => strip.replaceChildren(...original) };
}

test('A2: fact-cell omission rule — unavailable facts leave the table, reflow evenly, and stay in Provenance', () => {
  const { cells, strip, note, restore } = applyFacts([
    ['mPosition', 'Position', 'BTN'], ['mPot', 'Pot', '5.0 bb'], ['mFacing', 'Facing', '3.0 bb'],
    ['mToCall', 'To call', 'price unavailable'], ['mStack', 'Stack', '100 bb'], ['mEquity', 'Hero hand', 'AKs'],
    ['mPotOdds', 'Pot odds', '— (Price unavailable)'], ['mSPR', 'SPR', '-'], ['mRake', 'Board', 'Preflop · no board'],
  ], { callAmountBb: null });
  try {
    assert.deepEqual(cells.map((cell) => cell.hidden), [false, false, false, true, false, false, true, true, false]);
    assert.equal(strip.style.getPropertyValue('--fact-cols'), '6');
    assert.equal(strip.style.getPropertyValue('--fact-cols-narrow'), '3');
    assert.equal(note.hidden, false);
    assert.equal(note.textContent, 'Not shown for this decision: To call (price unavailable) · Pot odds (Price unavailable) · SPR');
    // Never a bare dash in the table: the grid uses the visible count.
    assert.equal(css.cascaded(strip, 'grid-template-columns', wide), 'repeat(var(--fact-cols, 8), minmax(0, 1fr))');
    assert.equal(css.cascaded(cells[3], 'display', wide), 'none');
  } finally {
    restore();
  }
  // An exact canonical price keeps the To call cell.
  const hand = applyFacts([['mToCall', 'To call', '6.0 bb'], ['mSPR', 'SPR', '3.1']], { callAmountBb: 6 });
  try {
    assert.deepEqual(hand.cells.map((cell) => cell.hidden), [false, false]);
    assert.equal(hand.note.hidden, true);
  } finally {
    hand.restore();
  }
  const omitted = markup.getElementById('analyzeOmittedFacts');
  assert.equal(omitted.localName, 'p');
  assert.ok(omitted.classList.contains('analyze-provenance-omitted'));
  assert.equal(omitted.hidden, true);
  assert.equal(text(omitted), '');
  assert.ok(translations.includes("['Not shown for this decision: {facts}',"));
});

test('A3: rail numeric rows are label above, slider + boxed value field with a unit suffix; ids and bounds unchanged', async () => {
  for (const [id, unit, min, max] of [['facingSizeNum', 'bb', '0', '100'], ['potSizeNum', 'bb', '0.5', '200'], ['playersNum', 'max', '2', '10'], ['stackNum', 'bb', '10', '500']]) {
    const input = rail.querySelector(`#${id}`);
    const box = input.parentElement;
    assert.ok(box.classList.contains('control-value'), `${id} sits in a boxed value field`);
    assert.equal(input.nextElementSibling?.className, 'control-unit', id);
    assert.equal(text(input.nextElementSibling), unit, id);
    assert.equal(input.className, 'control-input control-input--inline', id);
    assert.equal(input.getAttribute('type'), 'number', id);
    assert.equal(input.getAttribute('min'), min, id);
    assert.equal(input.getAttribute('max'), max, id);
  }
  const container = app.byId('facingSizeNum').closest('.slider-container');
  assert.equal(css.cascaded(container, 'display', wide), 'grid');
  assert.equal(css.cascaded(container, 'grid-template-columns', wide), 'minmax(0, 1fr) var(--analyze-value-column)');
  assert.equal(css.cascaded(container, 'grid-template-areas', wide), '"label label" "slider value"');
  assert.equal(css.cascaded(container, '--analyze-value-column', wide), '92px');
  assert.equal(css.cascaded(app.byId('facingSizeNum'), 'font-variant-numeric', wide), 'tabular-nums');
  assert.ok(translations.includes("['max', 'макс', 'שחקנים']"));
  // Numeric entry stays in the shared slider-pair code: typing a value syncs
  // the slider and leaves the unit suffix untouched.
  const number = app.byId('playersNum');
  const slider = app.byId('players');
  const previous = number.value;
  await app.setValue(number, '7');
  assert.equal(slider.value, '7');
  assert.equal(text(number.nextElementSibling), 'max');
  await app.setValue(number, previous);
});

test('A4/A5: rail card sizes and the compact dead-card row; randomization text under the rail header', () => {
  const size = (element) => [css.cascaded(element, '--poker-card-width', wide), css.cascaded(element, '--poker-card-height', wide)];
  assert.deepEqual(size(analyze('.playbook-cards-panel [data-slots="hero"]')), ['44px', '60px']);
  assert.deepEqual(size(analyze('.playbook-cards-panel .playbook-board-layout')), ['40px', '54px']);
  assert.deepEqual(size(analyze('.playbook-dead-card-header [data-slots="dead"]')), ['28px', '38px']);
  const header = rail.querySelector('.section-head.playbook-dead-card-header');
  assert.ok(header.querySelector('[data-card-clear-command="clear_dead_set"]'));
  const deadSlots = header.querySelector('.card-slots[data-slots="dead"]');
  assert.equal(deadSlots.childElementCount, 0);
  const meta = rail.querySelector('header + .playbook-spot-meta');
  assert.ok(meta, 'the spot meta follows the rail header');
  assert.equal(meta.firstElementChild.id, 'scenarioRandomizeStatus');
  assert.ok(meta.querySelector('#scenarioRandomizationDetails'));
  // The whole-set editor still opens from the dead slots.
  assert.ok(app.$('#gtoMode [data-slots="dead"] [data-card-set-edit="dead"], #gtoMode [data-card-set-edit="dead"]'));
  assert.match(app.call('deadCardSetEditorMarkup', 'dead', [], 2), /data-card-set-edit="dead"/);
});

test('A7: header switch reads Hand / Scenario with descriptive accessible names', () => {
  for (const [id, label, name] of [['playbookScenarioMode', 'Scenario', 'Scenario Analysis'], ['playbookHandMode', 'Hand', 'Hand Mode']]) {
    const control = markup.getElementById(id);
    const [visible, accessible] = control.children;
    assert.ok(visible.classList.contains('workspace-mode-label'), id);
    assert.equal(visible.getAttribute('aria-hidden'), 'true');
    assert.equal(visible.dataset.i18n, label);
    assert.equal(text(visible), label);
    assert.equal(accessible.localName, 'strong');
    assert.ok(accessible.classList.contains('sr-only'));
    assert.equal(accessible.dataset.i18n, name);
    assert.equal(text(accessible), name);
  }
  assert.equal(css.cascaded(markup.querySelector('#strategySourceStatus strong'), 'font-weight'), 'var(--weight-body)');
  assert.equal(css.cascaded(markup.querySelector('.rail-brand-copy span'), 'white-space'), 'nowrap');
});

test('B10: reached streets show board cards as shared mini cards in an LTR island', async () => {
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['Qh', 'Jh', '2c']);
  app.call('renderPath');
  const islands = app.$$('#pathList .path-cards');
  assert.ok(islands.length >= 1, 'the reached flop shows its cards');
  const island = islands[0];
  assert.equal(island.getAttribute('dir'), 'ltr');
  assert.equal(island.getAttribute('role'), 'img');
  assert.ok(island.getAttribute('aria-label'));
  const cards = island.querySelectorAll('.analysis-mini-card.riverline-card');
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.ok([...card.classList].some((name) => name.startsWith('card--suit-')), card.className);
    assert.ok(card.childElementCount > 0, 'shared card face contents');
  }
  // Superseded: 20px became 22px in a later pixel-fidelity pass.
  assert.equal(css.cascaded(cards[0], '--card-size-mini-width', wide), '22px');
  // Pending streets keep their text.
  const pending = app.$$('#pathList .path-step').filter((step) => !step.querySelector('.path-cards'));
  assert.ok(pending.length >= 1);
  assert.ok(pending.every((step) => text(step).length > 0));
});

test('B11: the close-mix line is secondary text with action colors only in small dots', () => {
  const base = app.window.app.strategyResult;
  const [first] = base.actions;
  const close = {
    ...base,
    actions: [
      { ...first, action: { type: 'raise', amountBb: 3, potFraction: null }, probability: 0.52 },
      { ...first, action: { type: 'fold', amountBb: null, potFraction: null }, probability: 0.48 },
    ],
  };
  app.call('renderAnalyzeVerdict', close);
  const note = app.byId('bestActionClose');
  assert.equal(app.byId('bestAction').dataset.verdictKind, 'close');
  assert.equal(note.hidden, false);
  const dots = note.querySelectorAll('.verdict-dot');
  assert.equal(dots.length, 2);
  assert.deepEqual(dots.map((dot) => dot.dataset.actionKind), ['aggressive', 'fold']);
  assert.ok(dots.every((dot) => dot.getAttribute('aria-hidden') === 'true'));
  assert.equal(css.cascaded(note, 'color', wide), 'var(--text-secondary)');
  assert.equal(css.cascaded(dots[0], 'background', wide), 'var(--action-aggressive)');
  assert.equal(css.cascaded(app.byId('bestReason'), 'max-width', wide), '70ch');
  app.call('renderAnalyzeVerdict', base);
});

test('D21: a pending recompute fades only the verdict and mix card; dimensions never change', async () => {
  const recommendation = app.byId('recommendation');
  app.call('schedulePlaybookUpdate', 'test');
  assert.equal(recommendation.dataset.recomputing, 'true');
  const targets = [analyze('#recommendation .analyze-verdict-copy'), analyze('#recommendation .frequency-visualization')];
  const geometry = ['width', 'height', 'min-height', 'display', 'position', 'transform', 'margin', 'padding'];
  const snapshot = () => targets.map((node) => geometry.map((property) => css.cascaded(node, property, wide)).join('|'));
  const during = snapshot();
  for (const node of targets) assert.equal(css.cascaded(node, 'opacity', wide), '.55');
  await app.settle(1000);
  assert.equal(recommendation.dataset.recomputing, undefined, 'updateContext clears the flag');
  assert.deepEqual(snapshot(), during, 'only opacity changes');
  for (const node of targets) assert.notEqual(css.cascaded(node, 'opacity', wide), '.55');
  for (const node of targets) assert.equal(css.cascaded(node, 'transition', { ...wide, reducedMotion: true }), 'none');
});

test('D22: interaction states use motion tokens and focus-visible outlines', () => {
  const focused = (element, states = ['focus-visible']) => {
    element.focus?.();
    return css.cascaded(element, 'outline', { ...wide, states }) || css.cascaded(element, 'outline-color', { ...wide, states }) || css.cascaded(element, 'box-shadow', { ...wide, states });
  };
  const tab = analyze('#playbookAnalysisTabs .ui-tab');
  assert.ok(focused(tab), 'analysis tab focus ring');
  const value = app.byId('playersNum');
  value.focus();
  assert.ok(css.cascaded(value.parentElement, 'border-color', { ...wide, states: ['focus-within'] }) || css.cascaded(value.parentElement, 'box-shadow', { ...wide, states: ['focus-within'] }), 'value box focus-within');
  const summary = analyze('summary');
  assert.ok(summary, 'the Analyze summary exists');
  assert.ok(focused(summary), 'summary focus ring');
  const transitions = amendSheet.rules.flatMap((rule) => rule.declarations).filter(({ property }) => property === 'transition');
  assert.ok(transitions.some(({ value }) => value.startsWith('color var(--motion-fast) var(--ease-standard)')));
  for (const { value } of transitions) assert.doesNotMatch(value, /\d+ms/, 'durations come from motion tokens');
  for (const selector of ['#playbookAnalysisTabs .ui-tab:focus-visible', '.control-value:focus-within', 'summary:focus-visible', '.hand-cell:focus-visible', '.analyze-explain-depth > .ui-tab:focus-visible']) {
    assert.ok(amendSheet.rules.some((rule) => rule.selectors.some((candidate) => candidate.includes(selector))), selector);
  }
});

test('D24: dead Analyze CSS is gone (captures unchanged: amend2/dead-css-pixdiff.json)', () => {
  for (const dead of ['playbook-field-group-title', 'playbook-betting-context', 'playbook-inline-heading', 'playbook-context-grid', 'playbook-context-primary', 'playbook-inline-copy', 'playbook-inline-actions', 'playbook-facts-panel']) {
    assert.equal(css.rules.filter((rule) => rule.selectors.some((selector) => new RegExp(`\\.${dead}(?![\\w-])`).test(selector))).length, 0, dead);
    assert.equal(markup.querySelector(`.${dead}`), null, `${dead} markup`);
  }
});
