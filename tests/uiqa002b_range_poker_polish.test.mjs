import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');

const matrixHtml = html.slice(html.indexOf('id="chartView"'), html.indexOf('id="rangeView"'));
const uiQaStart = css.indexOf('UI-QA-002B: dense range analysis');
assert.ok(uiQaStart > 0, 'UI-QA-002B stylesheet section must exist');
const uiQaCss = css.slice(uiQaStart);
const renderChart = logic.slice(logic.indexOf('function renderChart()'), logic.indexOf('function visualActionKind'));

test('Range Matrix keeps the exact 13 by 13 hand-class mapping', () => {
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const handCode = (row, column) => row === column
    ? ranks[row] + ranks[column]
    : row < column ? ranks[row] + ranks[column] + 's' : ranks[column] + ranks[row] + 'o';
  const matrix = ranks.flatMap((_, row) => ranks.map((__, column) => handCode(row, column)));
  assert.equal(matrix.length, 169);
  assert.equal(new Set(matrix).size, 169);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(matrix)).digest('hex'), '9ac1d305342fd5b14e612c80a12c309b4fe94e6a2e3c07f2cfc3cc425c3262d8');
  assert.match(logic, /return row < column \? RANKS\[row\] \+ RANKS\[column\] \+ 's' : RANKS\[column\] \+ RANKS\[row\] \+ 'o'/);
});

test('matrix cells are compact, fixed, scroll-contained, LTR, and never zoom', () => {
  assert.match(matrixHtml, /class="matrix-wrap"[^>]+tabindex="0"/);
  assert.match(matrixHtml, /id="strategyGrid" role="grid"/);
  assert.match(uiQaCss, /--range-matrix-cell:\s*clamp\(42px, 3\.2vw, 50px\)/);
  assert.match(uiQaCss, /grid-template-columns:\s*repeat\(13, var\(--range-matrix-cell\)\)/);
  assert.match(uiQaCss, /\.range-matrix-panel \.matrix-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(uiQaCss, /\[dir="rtl"\][\s\S]*?\.strategy-grid\s*\{\s*direction:\s*ltr !important/);
  assert.match(uiQaCss, /\.range-matrix-panel \.hand-cell:hover\s*\{[^}]*transform:\s*none/);
  assert.doesNotMatch(uiQaCss, /scale\(/);
});

test('matrix selection, inspector, and unavailable states remain explicit', () => {
  for (const id of ['selectedHand', 'selectedHandKind', 'selectedHandPrimary', 'selectedMix']) {
    assert.match(matrixHtml, new RegExp(`id="${id}"`));
  }
  assert.match(matrixHtml, /class="selected-hand matrix-hand-inspector"[^>]+aria-live="polite"/);
  assert.match(renderChart, /btn\.setAttribute\('aria-rowindex'/);
  assert.match(renderChart, /btn\.setAttribute\('aria-colindex'/);
  assert.match(renderChart, /button\.setAttribute\('aria-pressed', String\(isSelected\)\)/);
  assert.match(renderChart, /matrix-inspector-unavailable/);
  assert.match(uiQaCss, /\[aria-pressed="true"\]::after/);
});

test('matrix action probabilities and mixed encoding remain unmodified', () => {
  assert.match(renderChart, /style="width:\$\{action\.value\}%"/);
  assert.equal((renderChart.match(/style="width:\$\{action\.value\}%"/g) || []).length, 2);
  assert.match(renderChart, /matrix-mix-bar[\s\S]*?visualActionKind\(action\)/);
  assert.doesNotMatch(renderChart, /actions\s*=\s*actions\.map\([^)]*(?:normalize|\/\s*100)/i);
  assert.match(renderChart, /button\.dataset\.state = actions\.length \? 'available' : 'unavailable'/);
});

test('one compact legend retains every stable semantic action mapping', () => {
  assert.equal((matrixHtml.match(/id="strategyKey"/g) || []).length, 1);
  assert.match(matrixHtml, /class="strategy-key matrix-action-legend"[^>]+role="list"/);
  for (const kind of ['aggressive', 'passive', 'all-in', 'mixed', 'fold']) {
    assert.match(matrixHtml, new RegExp(`data-action-kind="${kind}"`));
  }
  assert.match(uiQaCss, /\.matrix-action-legend \.key > i[^}]*background:\s*var\(--action-visual\)/);
});

test('spades use face-dark and theme-aware UI contrast without changing suit compatibility', () => {
  assert.match(css, /--suit-spade:\s*#18201c/);
  assert.match(uiQaCss, /--suit-spade-ui:\s*var\(--text-primary\)/);
  assert.match(uiQaCss, /data-picker-suit="s"[^}]*var\(--suit-spade-ui\)/);
  assert.match(css, /html\[data-four-color="false"\][\s\S]*?--suit-diamond:\s*var\(--suit-heart\)[\s\S]*?--suit-club:\s*var\(--suit-spade\)/);
  for (const suit of ['h', 'd', 'c', 's']) assert.match(logic, new RegExp(`card--suit-\\$\\{suit\\.id\\}`));
});

test('Outs uses grouped analytical markup while retaining the legacy calculation entry point', () => {
  for (const className of ['outs-panel-head', 'outs-total', 'outs-groups', 'outs-group-head', 'outs-card-list', 'outs-card']) {
    assert.match(logic, new RegExp(className));
  }
  assert.match(logic, /const outsResult = calculateOuts\(myCards, allOpponentsCards, board, deadCards\)/);
  assert.match(logic, /function calculateOuts\(myCards, allOpponentsCards, boardCards, deadCards = \[\]\)/);
  assert.match(logic, /class="outs-card riverline-card card--suit-\$\{suit\}"[^>]+aria-label="\$\{label\}"/);
  assert.doesNotMatch(logic, /OutsAhead/);
  assert.doesNotMatch(logic.match(/const outsResult = calculateOuts[\s\S]*?\n\s*}\n\s*}\)\(\);/)?.[0] ?? '', /style="/);
});

test('polished exact-card fallbacks use displayCard while analytical hand classes remain intact', () => {
  assert.match(logic, /formatHand\(heroCards\) \|\| heroCards\.map\(displayCard\)\.join\(' '\)/);
  assert.match(logic, /const hand = handCode\(row, column\)/);
  assert.match(logic, /const displayCard = \(card\) => card \? displayCardRank\(card\[0\]\) \+ getSuit\(card\)\.symbol/);
});

function createSoundHarness() {
  let oscillatorCount = 0;
  const context = {
    currentTime: 1,
    state: 'running',
    destination: {},
    resume: async () => {},
    createOscillator() {
      oscillatorCount += 1;
      return {
        type: 'sine',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      };
    },
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    },
  };
  class AudioContext { constructor() { return context; } }
  const storage = new Map();
  const sandbox = {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    document: { getElementById: () => null },
    window: { AudioContext, addEventListener() {} },
  };
  vm.runInNewContext(`${sound}\nthis.exposedSoundFX = SoundFX;`, sandbox);
  return { soundFx: sandbox.exposedSoundFX, context, oscillatorCount: () => oscillatorCount };
}

test('card-deal sound is combined, throttled, and controlled by the global Audio toggle', () => {
  const harness = createSoundHarness();
  harness.soundFx.playCardDeal(5);
  assert.equal(harness.oscillatorCount(), 2, 'a multi-card deal uses one two-stroke cue');
  harness.soundFx.playCardDeal(5);
  assert.equal(harness.oscillatorCount(), 2, 'same-frame rerenders do not create audio spam');
  harness.soundFx.toggle();
  harness.context.currentTime += 1;
  harness.soundFx.playCardDeal(2);
  assert.equal(harness.oscillatorCount(), 2, 'muted playback is silent');
});

test('sound hooks fire only from user-perceived deals, actions, and one Training result', () => {
  assert.match(logic, /dealObservedHoleCards[\s\S]*?playCardDeal/);
  assert.match(logic, /dealBoardCards[\s\S]*?playCardDeal\(expected\)/);
  assert.match(logic, /applyCanonicalHandAction[\s\S]*?playPokerAction\(type\)/);
  assert.match(logic, /playTrainingResult\(evaluation\.grade\)/);
  assert.equal((logic.match(/playTrainingResult\(evaluation\.grade\)/g) || []).length, 1);
  assert.doesNotMatch(logic, /bindSliderPair[\s\S]{0,800}playChip/);
  assert.doesNotMatch(table, /SoundFX|playCardDeal/);
});

test('deal and feedback motion are event-scoped, restrained, and reduced-motion safe', () => {
  assert.match(table, /previous\[index\] !== signatures\[index\]/);
  assert.match(table, /isDealing \? ' is-card-dealt'/);
  assert.doesNotMatch(table, /setTimeout/);
  assert.match(uiQaCss, /@keyframes riverline-card-deal[\s\S]*?translate:\s*0 -8px[\s\S]*?translate:\s*0 0/);
  assert.match(uiQaCss, /animation-delay:\s*calc\(var\(--card-deal-order, 0\) \* 22ms\)/);
  assert.match(uiQaCss, /\.card-slot\.filled\s*\{\s*animation:\s*none/);
  assert.match(uiQaCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.card-group\.is-card-dealt[\s\S]*?animation:\s*none/);
  assert.doesNotMatch(uiQaCss, /bounce|spin|rotate|pulse/i);
});

test('UI-QA-002B remains presentation-only and keeps protected engines intact', () => {
  for (const symbol of ['deriveDecisionContext', 'strategyProvider.resultSchemaVersion', 'calculateEquity', 'calculateOuts', 'handleTrainingGuess']) {
    assert.match(logic, new RegExp(symbol));
  }
  assert.doesNotMatch(table, /PokerState|DecisionContext|StrategyResult|calculateEquity|regret|MCCFR/);
  assert.doesNotMatch(uiQaCss, /calculateEquity|calculateOuts|DecisionContext|StrategyResult|MCCFR|teacher/i);
});
