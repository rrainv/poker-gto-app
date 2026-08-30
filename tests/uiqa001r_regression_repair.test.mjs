import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_GEOMETRY,
  CARD_PRESENTATION_STORAGE_KEY,
  CARD_RANK_GEOMETRY,
  cardFaceMarkup,
  createCardPresentationController,
  tableCardSvgMarkup,
} from '../app/src/application/card-presentation.mjs';

import {
  createProductionPickerHarness,
  delegatedCardSlotClick,
} from './uiqa001r_card_picker_adapter.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const preflop = fs.readFileSync(new URL('../app/src/strategy/preflop-heuristic.mjs', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');

const repairCss = css.slice(css.indexOf('UI-QA-001: responsive shell'));
const playbookHtml = html.slice(html.indexOf('id="gtoMode"'), html.indexOf('id="trainingMode"'));
const trainingHtml = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
const equityHtml = html.slice(html.indexOf('id="equityMode"'), html.indexOf('id="infoMode"'));

test('card-set preview geometry reserves full-size cards, stable gaps, padding, and visible edges', () => {
  const boardEditorRule = css.match(/^\.board-card-set-editor\s*\{[^}]*\}/ms)?.[0] || '';
  assert.match(css, /\.card-set-picker-context\s*\{[^}]*padding:\s*var\(--space-4\) var\(--space-5\)/s);
  assert.match(css, /\.card-set-picker-cards\s*\{[^}]*gap:\s*var\(--space-4\)[^}]*padding:\s*var\(--space-2\)[^}]*overflow:\s*visible/s);
  assert.match(css, /\.card-set-picker-card\s*\{[^}]*flex:\s*0 0 var\(--card-size-standard-width\)[^}]*height:\s*var\(--card-size-standard-height\) !important/s);
  assert.match(css, /\.private-hand-set-editor\s*\{[^}]*gap:\s*var\(--space-3\)[^}]*overflow:\s*visible/s);
  assert.match(css, /\.equity-hand-editor-cards\s*\{[^}]*gap:\s*var\(--space-3\)[^}]*overflow:\s*visible/s);
  assert.match(boardEditorRule, /gap:\s*var\(--space-2\)/);
  assert.match(boardEditorRule, /padding:\s*0/);
  assert.doesNotMatch(boardEditorRule, /overflow:/);
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
  assert.match(css, /--card-size-slot-width:\s*48px/);
  assert.match(css, /--card-size-slot-height:\s*68px/);
  assert.match(css, /--card-rank-ten-scale-x:\s*\.82/);
});

test('sidebar collapse control remains in-flow with reserved accessible geometry', () => {
  assert.match(repairCss, /\.rail-collapse-button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
  assert.match(repairCss, /\.is-sidebar-collapsed \.rail-collapse-button\s*\{[^}]*position:\s*static/);
  assert.doesNotMatch(repairCss, /\.is-sidebar-collapsed \.rail-collapse-button\s*\{[^}]*inset-inline/);
  const brand = html.slice(html.indexOf('<div class="rail-brand">'), html.indexOf('</div>', html.indexOf('id="sidebarCollapseBtn"')) + 6);
  assert.match(brand, /id="sidebarCollapseBtn"/);
});

test('Betting Context is a coherent six-column two-row structural grid', () => {
  assert.match(playbookHtml, /class="playbook-context-grid"[\s\S]*class="playbook-context-primary"[\s\S]*class="fields playbook-context-sliders"/);
  assert.match(repairCss, /\.playbook-context-grid\s*\{[^}]*grid-template-columns:\s*repeat\(6/);
  assert.match(repairCss, /\.playbook-context-primary\s*,\s*\n\.playbook-context-sliders\s*\{\s*display:\s*contents/);
  assert.match(repairCss, /\.playbook-context-primary > \*\s*\{\s*grid-column:\s*span 2/);
  assert.match(repairCss, /\.playbook-context-sliders > \.field\s*\{[^}]*grid-column:\s*span 3/);
});

test('table viewBox reserves seat extrema and expanded wrapper does not clip', () => {
  assert.match(table, /viewBox="0 0 1000 650"/);
  assert.match(repairCss, /\.table-wrapper\s*\{[^}]*overflow:\s*visible/);
  assert.match(repairCss, /#visual-table-container\s*\{[^}]*overflow:\s*visible/);
  assert.match(repairCss, /\.table-wrapper\.collapsed\s*\{[^}]*height:\s*0[^}]*overflow:\s*hidden/);
});

test('Equity reads as Players to Board and Calculation to Hand Analysis', () => {
  const players = equityHtml.indexOf('class="panel equity-player-panel"');
  const center = equityHtml.indexOf('class="equity-center-column"');
  const cards = equityHtml.indexOf('class="panel equity-cards-panel"');
  const controls = equityHtml.indexOf('class="panel equity-controls-panel');
  const analysis = equityHtml.indexOf('id="equityHandAnalysis"');
  assert.ok(players < center && center < cards && cards < controls && controls < analysis);
  assert.match(repairCss, /\.equity-workspace\s*\{[^}]*grid-template-columns:/);
  assert.match(repairCss, /\.equity-center-column\s*\{[^}]*display:\s*grid/);
  assert.match(equityHtml, /id="equityDecreasePlayers"[\s\S]*id="equityIncreasePlayers"/);
});

test('Training keeps stacked probabilities and removes the circular reference wheel', () => {
  assert.match(trainingHtml, /id="trainingFrequencyStack"/);
  assert.match(trainingHtml, /id="trainingFrequencyRows"/);
  assert.doesNotMatch(trainingHtml, /id="trainingWheel"|training-wheel-secondary/);
  const solution = logic.match(/function showTrainingSolution\(solution\)[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(solution, /Array\.isArray\(solution\)/);
  assert.match(solution, /action:\s*entry\.action/);
  assert.doesNotMatch(solution, /actionsList\.reduce|act\.pct\s*=/);
  assert.match(logic, /function strategyResultPresentationActions\(result\)/);
  assert.match(solution, /renderFrequencyStack/);
  assert.doesNotMatch(solution, /conic-gradient|trainingWheel/);
});

test('repair remains outside poker, Equity math, Training grading, and solver code', () => {
  for (const symbol of ['deriveDecisionContext', 'calculateEquity', 'handleTrainingGuess']) {
    assert.match(logic, new RegExp(symbol));
  }
  assert.match(preflop, /calculatePreflopFallbackStrategy/);
  assert.doesNotMatch(repairCss, /PokerState|DecisionContext|StrategyResult|evaluateSeven|MCCFR|regret/);
});
