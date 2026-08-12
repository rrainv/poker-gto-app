import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  assert.equal(calls.rankStyle.length, 0);
  assert.match(logic, /closest\('button\[data-card-rank-style\]'\)/);
  assert.doesNotMatch(logic, /closest\('\[data-card-rank-style\]'\)/);
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
  assert.match(fullTen.slotMarkup('hero'), /class="rank rank--ten s-h">10</);
  for (const card of ['As', 'Kh', 'Qd', 'Jc']) {
    const next = createProductionPickerHarness({ rankStyle: 'full-ten' });
    next.openPicker('hero', 0);
    next.selectCard(card);
    assert.doesNotMatch(next.slotMarkup('hero'), /rank--ten/);
    assert.match(next.slotMarkup('hero'), new RegExp(`class="rank s-${card[1]}">${card[0]}<`));
  }
});

test('DESIGN-005 card proportions remain canonical and only 10 gets compact typography', () => {
  assert.match(css, /--poker-card-width:\s*48px/);
  assert.match(css, /--poker-card-height:\s*68px/);
  assert.match(css, /\.card-slot \.rank\s*\{[^}]*font-family:\s*Georgia[^}]*font-size:\s*18px[^}]*line-height:\s*17px/);
  assert.match(css, /\.card-slot \.suit\s*\{[^}]*font-size:\s*19px[^}]*line-height:\s*20px/);
  assert.match(repairCss, /\.card-slot \.rank\.rank--ten\s*\{[^}]*font-size:\s*16px/);
  assert.doesNotMatch(repairCss, /\[data-card-rank-style="full-ten"\] \.card-slot \.rank/);
  assert.match(table, /table-card-rank\$\{rankClass\}/);
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
  assert.match(table, /viewBox="0 -40 800 560"/);
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
