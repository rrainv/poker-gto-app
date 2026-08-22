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

for (const [label, group, card, handMode] of [
  ['Playbook Hero', 'hero', 'As', false],
  ['Playbook board', 'board', 'Kh', false],
  ['Playbook dead cards', 'dead', 'Qc', false],
  ['Equity known hand', 'player-0', 'Th', false],
  ['Equity board', 'eqboard', 'Jd', false],
  ['Equity dead cards', 'eqdead', '9s', false],
  ['Hand Mode private cards', 'hand-seat-0', 'Ad', true],
]) {
  test(`${label} uses the production picker open/select/close path`, () => {
    const picker = createProductionPickerHarness({ handMode });
    picker.openPicker(group, 0);
    assert.equal(picker.modalOpen(), true);
    picker.selectCard(card);
    assert.equal(picker.groupCards(group)[0], card);
    assert.equal(picker.app.picker, null);
    assert.equal(picker.modalOpen(), false);
    assert.match(picker.slotMarkup(group), new RegExp(`data-group="${group}"[^>]*data-index="0"`));
    assert.match(picker.slotMarkup(group), group.includes('dead') ? /card--dead/ : /card--known/);
  });
}

test('picker can close one target and open the next board or dead-card target', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('board', 0);
  picker.selectCard('2s');
  picker.openPicker('dead', 0);
  assert.equal(picker.app.picker.group, 'dead');
  assert.equal(picker.app.picker.index, 0);
  assert.equal(picker.modalOpen(), true);
});

test('filled editable cards use Replace semantics: open, cancel, then replace', () => {
  const picker = createProductionPickerHarness();
  picker.openPicker('hero', 0);
  picker.selectCard('Ah');

  picker.openPicker('hero', 0);
  assert.equal(picker.modalOpen(), true);
  assert.equal(picker.groupCards('hero')[0], 'Ah');
  assert.match(picker.slotMarkup('hero'), /aria-label="Replace A/);

  picker.closePicker();
  assert.equal(picker.groupCards('hero')[0], 'Ah');

  picker.openPicker('hero', 0);
  picker.selectCard('Kh');
  assert.equal(picker.groupCards('hero')[0], 'Kh');
});

test('T and 10 are presentation choices while canonical IDs and face ranks stay stable', () => {
  const poker = createProductionPickerHarness({ rankStyle: 'poker' });
  poker.openPicker('hero', 0);
  poker.selectCard('Th');
  assert.equal(poker.groupCards('hero')[0], 'Th');
  assert.match(poker.slotMarkup('hero'), /class="rank s-h">T</);

  const fullTen = createProductionPickerHarness({ rankStyle: 'full-ten' });
  fullTen.openPicker('hero', 0);
  fullTen.selectCard('Th');
  assert.equal(fullTen.groupCards('hero')[0], 'Th');
  assert.match(fullTen.slotMarkup('hero'), /class="rank rank--ten s-h" data-card-rank-width="wide">10</);
  for (const card of ['As', 'Kh', 'Qd', 'Jc']) {
    const next = createProductionPickerHarness({ rankStyle: 'full-ten' });
    next.openPicker('hero', 0);
    next.selectCard(card);
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
  assert.match(table, /viewBox="0 -80 800 600"/);
  assert.match(repairCss, /\.table-wrapper\s*\{[^}]*overflow:\s*visible/);
  assert.match(repairCss, /#visual-table-container\s*\{[^}]*overflow:\s*visible/);
  assert.match(repairCss, /\.table-wrapper\.collapsed\s*\{[^}]*height:\s*0[^}]*overflow:\s*hidden/);
});

test('Equity reads as Players to Shared Cards and Calculation to Results', () => {
  const players = equityHtml.indexOf('class="panel equity-player-panel"');
  const shared = equityHtml.indexOf('class="equity-shared-flow"');
  const cards = equityHtml.indexOf('class="panel equity-cards-panel"');
  const controls = equityHtml.indexOf('class="panel equity-controls-panel"');
  const output = equityHtml.indexOf('class="equity-output-stack"');
  assert.ok(players < shared && shared < cards && cards < controls && controls < output);
  assert.match(repairCss, /\.equity-shared-flow\s*\{[^}]*background:\s*var\(--surface-panel\)[^}]*border:/);
  assert.match(repairCss, /\.equity-shared-flow \.equity-controls-panel\s*\{\s*border-top:/);
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
