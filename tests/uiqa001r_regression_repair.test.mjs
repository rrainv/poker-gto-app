import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { StyleSheetModel, appStyleSheet, bootApp, freshIndexDocument, precedes } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: parsed markup, the cascade on the parsed document, and the
// Training solution renderer in the booted app.
const app = await bootApp({ width: 1920 });
// Imported after boot: these module graphs self-install page bridges.
const {
  CARD_GEOMETRY,
  CARD_PRESENTATION_STORAGE_KEY,
  CARD_RANK_GEOMETRY,
  cardFaceMarkup,
  createCardPresentationController,
  tableCardSvgMarkup,
} = await import('../app/src/application/card-presentation.mjs');
const { createProductionPickerHarness, delegatedCardSlotClick } = await import('./uiqa001r_card_picker_adapter.mjs');
const markup = freshIndexDocument();
const css = appStyleSheet();
const W = { width: 1920 };
const probe = (className, host = markup.body, tag = 'div') => {
  const element = markup.createElement(tag);
  element.className = className;
  host.appendChild(element);
  return element;
};
// SOURCE-SHAPE: "the UI-QA-001 repair block names no poker/solver authority"
// is a scope lint over the block as authored (parsed); styles have no runtime
// observable for which concepts their selectors mention.
const repairSheet = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  return new StyleSheetModel(raw.slice(raw.indexOf('UI-QA-001: responsive shell')));
})();
const preflop = fs.readFileSync(new URL('../app/src/strategy/preflop-heuristic.mjs', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');


test('card-set preview geometry reserves full-size cards, stable gaps, padding, and visible edges', () => {
  const context = markup.querySelector('.card-set-picker-context');
  assert.equal(css.cascaded(context, 'padding', W), 'var(--space-4) var(--space-5)');
  const cards = markup.querySelector('.card-set-picker-cards');
  assert.deepEqual(['gap', 'padding', 'overflow'].map((property) => css.cascaded(cards, property, W)), ['var(--space-4)', 'var(--space-2)', 'visible']);
  const card = probe('card-set-picker-card', cards);
  assert.equal(css.cascaded(card, 'flex', W), '0 0 var(--card-size-standard-width)');
  assert.equal(css.cascaded(card, 'height', W), 'var(--card-size-standard-height)');
  for (const className of ['private-hand-set-editor', 'equity-hand-editor-cards']) {
    const editor = probe(className);
    assert.equal(css.cascaded(editor, 'gap', W), 'var(--space-3)', className);
    assert.equal(css.cascaded(editor, 'overflow', W), 'visible', className);
  }
  const board = probe('board-card-set-editor');
  assert.equal(css.cascaded(board, 'gap', W), 'var(--space-2)');
  assert.equal(css.cascaded(board, 'padding', W), '0');
  assert.ok(!css.rulesFor('.board-card-set-editor').some((rule) => rule.declarations.some(({ property }) => property.startsWith('overflow'))));
});

test('root rank preference no longer consumes delegated Playbook card clicks', () => {
  const calls = delegatedCardSlotClick('hero', 0);
  assert.equal(calls.picker.length, 1);
  assert.equal(calls.picker[0][0], 'hero');
  assert.equal(calls.picker[0][1], 0);

  const values = new Map();
  let chooseFullTen = null;
  const fullTenButton = {
    dataset: { cardRankStyle: 'full-ten' },
    classList: { toggle() {} },
    setAttribute() {},
    querySelector() { return null; },
    addEventListener(type, listener) { if (type === 'click') chooseFullTen = listener; },
  };
  const controller = createCardPresentationController({
    root: { dataset: {} },
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    rankStyleButtons: [fullTenButton],
  }).init();
  chooseFullTen();
  assert.equal(controller.get().rankStyle, 'full-ten');
  assert.equal(JSON.parse(values.get(CARD_PRESENTATION_STORAGE_KEY)).rankStyle, 'full-ten');
});

for (const [label, group, cards, handMode] of [
  ['Playbook Hero', 'hero', ['As', 'Kh'], false],
  ['Playbook Flop', 'board', ['Kh', '7d', '2c'], false],
  ['Playbook dead cards', 'dead', ['Qc'], false],
  ['Equity Flop', 'eqboard', ['Jd', '8s', '3h'], false],
  ['Equity dead cards', 'eqdead', ['9s'], false],
]) {
  test(`${label} uses the production picker draft/Apply path`, () => {
    const picker = createProductionPickerHarness({ handMode });
    picker.openPicker(group, 0);
    assert.equal(picker.modalOpen(), true);
    cards.forEach(picker.selectCard);
    assert.deepEqual([...picker.groupCards(group)], []);
    assert.equal(picker.modalOpen(), true);
    assert.equal(picker.applyDisabled(), false);
    picker.apply();
    assert.deepEqual([...picker.groupCards(group)], cards);
    assert.equal(picker.app.picker, null);
    assert.equal(picker.modalOpen(), false);
    assert.match(picker.slotMarkup(group), group.includes('dead') ? /card--dead/ : /card--known/);
  });
}

test('Hand private-card picker stays open for two cards and commits only on Apply', () => {
  const picker = createProductionPickerHarness({ handMode: true });
  picker.openPicker('hand-seat-0', 0);
  picker.selectCard('Ad');

  assert.deepEqual([...picker.groupCards('hand-seat-0')], []);
  assert.equal(picker.app.picker.group, 'hand-seat-0');
  assert.equal(picker.modalOpen(), true);
  assert.match(picker.deckMarkup(), /is-selected[^>]*data-deck-card="Ad"/);

  picker.selectCard('Kh');
  assert.deepEqual([...picker.groupCards('hand-seat-0')], []);
  assert.equal(picker.modalOpen(), true);
  picker.apply();
  assert.deepEqual([...picker.groupCards('hand-seat-0')], ['Ad', 'Kh']);
  assert.equal(picker.app.picker, null);
  assert.equal(picker.modalOpen(), false);
  assert.match(picker.slotMarkup('hand-seat-0'), /data-card-set-edit="hand-seat-0"/);
  assert.equal((picker.slotMarkup('hand-seat-0').match(/card--known/g) || []).length, 2);
});

test('Hand private-card picker supports cancel after one card and multiple known opponents', () => {
  const picker = createProductionPickerHarness({ handMode: true });
  picker.openPicker('hand-seat-0', 0);
  picker.selectCard('As');
  picker.closePicker();
  assert.deepEqual([...picker.groupCards('hand-seat-0')], []);
  assert.equal(picker.modalOpen(), false);

  picker.openPicker('hand-seat-1', 0);
  picker.selectCard('Kd');
  assert.equal(picker.app.picker.group, 'hand-seat-1');
  picker.selectCard('Qc');
  picker.apply();

  picker.openPicker('hand-seat-2', 0);
  for (const card of ['Kd', 'Qc']) {
    assert.match(picker.deckMarkup(), new RegExp(`data-deck-card="${card}"[^>]*disabled`));
  }
  picker.selectCard('Jh');
  picker.selectCard('Ts');
  picker.apply();

  assert.deepEqual([...picker.groupCards('hand-seat-1')], ['Kd', 'Qc']);
  assert.deepEqual([...picker.groupCards('hand-seat-2')], ['Jh', 'Ts']);
  assert.equal(picker.modalOpen(), false);
});

test('Hand private-card picker keeps the same two-card flow from heads-up through ten-handed seats', () => {
  for (let tableSize = 2; tableSize <= 10; tableSize += 1) {
    const picker = createProductionPickerHarness({ handMode: true });
    const group = `hand-seat-${tableSize - 1}`;
    picker.openPicker(group, 0);
    picker.selectCard('7c');
    assert.equal(picker.app.picker.group, group);
    assert.equal(picker.modalOpen(), true);
    picker.selectCard('6d');
    assert.equal(picker.modalOpen(), true);
    picker.apply();
    assert.deepEqual([...picker.groupCards(group)], ['7c', '6d']);
    assert.equal(picker.modalOpen(), false);
  }
});

test('picker can close one target and open the next board or dead-card target', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('board', 0);
  picker.selectCard('2s');
  picker.openPicker('dead', 0);
  assert.equal(picker.app.picker.group, 'dead');
  assert.equal(picker.app.picker.originIndex, 0);
  assert.equal(picker.modalOpen(), true);
});

test('filled private hands reopen as an unordered draft; Cancel preserves and Apply replaces', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('hero', 0);
  picker.selectCard('Ah');
  picker.selectCard('Qd');
  picker.apply();

  picker.openPicker('hero', 0);
  assert.equal(picker.modalOpen(), true);
  assert.deepEqual([...picker.groupCards('hero')], ['Ah', 'Qd']);
  assert.match(picker.contextMarkup(), /A[\s\S]*Q/);

  picker.selectCard('Ah');
  picker.selectCard('Kh');
  picker.closePicker();
  assert.deepEqual([...picker.groupCards('hero')], ['Ah', 'Qd']);

  picker.openPicker('hero', 0);
  picker.selectCard('Ah');
  picker.selectCard('Kh');
  picker.apply();
  assert.deepEqual([...picker.groupCards('hero')], ['Qd', 'Kh']);
});

test('T and 10 are presentation choices while canonical IDs and face ranks stay stable', () => {
  const poker = createProductionPickerHarness({ rankStyle: 'poker' });
  poker.openPicker('hero', 0);
  poker.selectCard('Th');
  poker.selectCard('As');
  poker.apply();
  assert.equal(poker.groupCards('hero')[0], 'Th');
  assert.match(poker.slotMarkup('hero'), /class="rank s-h">T</);

  const fullTen = createProductionPickerHarness({ rankStyle: 'full-ten' });
  fullTen.openPicker('hero', 0);
  fullTen.selectCard('Th');
  fullTen.selectCard('As');
  fullTen.apply();
  assert.equal(fullTen.groupCards('hero')[0], 'Th');
  assert.match(fullTen.slotMarkup('hero'), /class="rank rank--ten s-h" data-card-rank-width="wide">10</);
  for (const card of ['As', 'Kh', 'Qd', 'Jc']) {
    const next = createProductionPickerHarness({ rankStyle: 'full-ten' });
    next.openPicker('hero', 0);
    next.selectCard(card);
    next.selectCard(card === 'As' ? 'Kh' : 'As');
    next.apply();
    assert.doesNotMatch(next.slotMarkup('hero'), /rank--ten/);
    assert.match(next.slotMarkup('hero'), new RegExp(`class="rank s-${card[1]}">${card[0]}<`));
  }
});

test('DESIGN-005 card proportions remain canonical and full 10 uses shared rank geometry', () => {
  assert.deepEqual(CARD_GEOMETRY.slot, { width: 48, height: 68, radius: 6 });
  assert.ok(Math.abs((CARD_GEOMETRY.slot.width / CARD_GEOMETRY.slot.height) - CARD_GEOMETRY.ratio) < 0.005);
  assert.equal(CARD_RANK_GEOMETRY.tenScaleX, 0.82);

  const domTen = cardFaceMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' });
  assert.equal((domTen.match(/data-card-rank="10"/g) || []).length, 2);
  assert.equal((domTen.match(/>10<\/span>/g) || []).length, 1);
  assert.equal((domTen.match(/data-card-rank-width="wide"/g) || []).length, 3);

  const tableTen = tableCardSvgMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' });
  assert.match(tableTen, /width="40" height="57" rx="5" ry="5"/);
  assert.match(tableTen, /table-card-rank--ten/);
  assert.match(tableTen, /data-card-rank-width="wide"/);
  assert.match(tableTen, /scale\(0\.82 1\)/);
  assert.equal(css.cascaded(markup.documentElement, '--card-size-slot-width'), '48px');
  assert.equal(css.cascaded(markup.documentElement, '--card-size-slot-height'), '68px');
  assert.equal(css.cascaded(probe('riverline-card'), '--card-rank-ten-scale-x'), '.82');
});

test('sidebar collapse control remains in-flow with reserved accessible geometry', () => {
  const button = markup.getElementById('sidebarCollapseBtn');
  assert.ok(button.closest('.rail-brand'), 'the control lives in the rail brand row');
  assert.ok(button.classList.contains('rail-collapse-button'));
  // (Superseded: the 44px square from UI-QA-001 was reduced to 28x30 by the
  // later rail rule; it still exceeds the 24px WCAG 2.2 AA target minimum.)
  assert.equal(css.cascaded(button, 'width', W), '28px');
  assert.equal(css.cascaded(button, 'height', W), '30px');
  const shell = markup.querySelector('.riverline-shell');
  shell.classList.add('is-sidebar-collapsed');
  try {
    assert.equal(css.cascaded(button, 'position', W), 'static');
    for (const property of ['inset-inline', 'inset-inline-start', 'inset-inline-end']) assert.equal(css.cascaded(button, property, W), undefined, property);
  } finally {
    shell.classList.remove('is-sidebar-collapsed');
  }
});

test('Betting Context is a coherent six-column two-row structural grid', () => {
  // ANALYZE-COMPOSITION-001: the center Betting context strip became the Spot rail Action section
  // (position + prior action pair, then the facing/pot slider rows).
  const shared = markup.getElementById('sharedControls');
  const pair = shared.querySelector('.playbook-field-pair');
  const sliders = shared.querySelector('.fields.playbook-context-sliders');
  assert.ok(pair && sliders);
  assert.ok(precedes(pair, sliders));
  // ANALYZE-COMPOSITION-001 amendment 2 removed the strip's dead grid CSS.
  for (const className of ['playbook-context-grid', 'playbook-context-primary']) assert.deepEqual(css.rulesMentioning(`.${className}`), [], className);
  // (Superseded: display: contents / span-3 fields from UI-QA-001 became the
  // Spot rail's own one-column slider grid.)
  assert.equal(css.cascaded(sliders, 'display', W), 'grid');
  assert.equal(css.cascaded(sliders.querySelector(':scope > .field'), 'grid-column', W), 'span 1');
});

test('table viewBox reserves seat extrema and expanded wrapper does not clip', () => {
  assert.match(table, /viewBox="0 0 1000 650"/);
  const wrapper = markup.querySelector('.table-wrapper');
  assert.equal(css.cascaded(wrapper, 'overflow', W), 'visible');
  assert.equal(css.cascaded(markup.getElementById('visual-table-container'), 'overflow', W), 'visible');
  // Collapsing removes the table's space and clips it. (Superseded: height 0
  // became an animated max-height 0 with deferred visibility.)
  wrapper.classList.add('collapsed');
  try {
    assert.deepEqual(['max-height', 'overflow', 'visibility'].map((property) => css.cascaded(wrapper, property, W)), ['0', 'hidden', 'hidden']);
  } finally {
    wrapper.classList.remove('collapsed');
  }
});

test('Equity reads as Players to Board and Calculation to Hand Analysis', () => {
  const equity = markup.getElementById('equityMode');
  const order = [
    equity.querySelector('.panel.equity-player-panel'),
    equity.querySelector('.equity-center-column'),
    equity.querySelector('.panel.equity-cards-panel'),
    equity.querySelector('.panel.equity-controls-panel'),
    equity.querySelector('#equityHandAnalysis'),
  ];
  assert.ok(order.every(Boolean));
  order.slice(1).forEach((node, index) => assert.ok(precedes(order[index], node), node.className || node.id));
  assert.ok(css.cascaded(equity.querySelector('.equity-workspace'), 'grid-template-columns', W));
  assert.equal(css.cascaded(equity.querySelector('.equity-center-column'), 'display', W), 'grid');
  assert.ok(precedes(markup.getElementById('equityDecreasePlayers'), markup.getElementById('equityIncreasePlayers')));
});

test('Training keeps stacked probabilities and removes the circular reference wheel', async () => {
  const training = markup.getElementById('trainingMode');
  assert.ok(training.querySelector('#trainingFrequencyStack'));
  assert.ok(training.querySelector('#trainingFrequencyRows'));
  assert.equal(training.querySelector('#trainingWheel, .training-wheel-secondary'), null);
  // The solution renders the canonical presented actions as a stacked bar.
  await app.training.start('focused');
  await app.training.answer();
  const exercise = app.window.app.training.currentExercise;
  const solution = app.call('strategyResultPresentationActions', exercise.strategyResult);
  assert.ok(Array.isArray(solution) && solution.length > 0);
  const spy = app.spy(['renderFrequencyStack']);
  try {
    app.call('showTrainingSolution', solution);
    assert.ok(spy.count('renderFrequencyStack') >= 1);
    // Entries keep the canonical action and value, ordered by frequency.
    const [, actions] = spy.calls.renderFrequencyStack.at(-1);
    const expected = [...solution].sort((left, right) => right.value - left.value);
    assert.deepEqual(actions.map((entry) => [entry.action, entry.value]), expected.map((entry) => [entry.action, entry.value]));
  } finally {
    spy.restore();
  }
  const stack = app.byId('trainingFrequencyStack');
  assert.doesNotMatch(stack.getAttribute('style') || '', /conic-gradient/);
  assert.equal(app.byId('trainingWheel'), null);
});

test('repair remains outside poker, Equity math, Training grading, and solver code', () => {
  // The page consumes the existing poker, Equity and Training authorities.
  assert.ok(app.window.RiverlinePlaybookState);
  for (const name of ['handleTrainingGuess', 'callEquityServiceBridge']) assert.equal(app.evaluate(`typeof ${name}`), 'function', name);
  assert.match(preflop, /calculatePreflopFallbackStrategy/);
  for (const rule of repairSheet.rules) {
    assert.doesNotMatch([...rule.selectors, ...rule.declarations.map(({ value }) => value)].join(' '), /PokerState|DecisionContext|StrategyResult|evaluateSeven|MCCFR|regret/);
  }
});
