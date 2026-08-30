import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const strategyHarness = require('./qa002_adapters.js');

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const foleyManifest = fs.readFileSync(new URL('../app/src/core/AudioFoleyManifest.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const cardPresentation = fs.readFileSync(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8');
const experienceEvents = fs.readFileSync(new URL('../app/src/application/experience-events.mjs', import.meta.url), 'utf8');
const playbookBootstrap = fs.readFileSync(new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url), 'utf8');
const trainingBootstrap = fs.readFileSync(new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url), 'utf8');
const analysisBootstrap = fs.readFileSync(new URL('../app/src/application/analysis-explanation-bootstrap.mjs', import.meta.url), 'utf8');
const equityHandAnalysis = fs.readFileSync(new URL('../app/src/application/equity-hand-analysis.mjs', import.meta.url), 'utf8');
const rangeAnalysis = fs.readFileSync(new URL('../app/src/application/range-analysis.mjs', import.meta.url), 'utf8');

const matrixHtml = html.slice(html.indexOf('id="chartView"'), html.indexOf('id="rangeView"'));
const uiQaStart = css.indexOf('UI-QA-002B: dense range analysis');
assert.ok(uiQaStart > 0, 'UI-QA-002B stylesheet section must exist');
const uiQaEnd = css.indexOf('PRODUCT-UI-002: density, geometry, and component fit', uiQaStart);
assert.ok(uiQaEnd > uiQaStart, 'UI-QA-002B stylesheet section must remain bounded');
const uiQaCss = css.slice(uiQaStart, uiQaEnd);
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
  const result = strategyHarness.preflopStrategyResult({ open: 70, call: 30, fold: 0 });
  const presentation = strategyHarness.legacyProfileForStrategyResult(result);

  assert.ok(Math.abs(result.actions[0].probability - 0.7) <= 1e-12);
  assert.ok(Math.abs(result.actions[1].probability - 0.3) <= 1e-12);
  assert.ok(Math.abs(result.actions.reduce((total, action) => total + action.probability, 0) - 1) <= 1e-12);
  assert.deepEqual(presentation.actions.map(({ kind, value }) => ({ kind, value })), [
    { kind: 'aggressive', value: 70 },
    { kind: 'passive', value: 30 },
  ]);
  assert.equal(presentation.actions.reduce((total, action) => total + action.value, 0), 100);
  assert.match(renderChart, /actions = strategyResultPresentationActions\(cellStrategyResult\)/);
  assert.match(renderChart, /const mixState = matrixMixState\(actions, dominantAction\)/);
  assert.match(renderChart, /button\.dataset\.mixState = mixState/);
  assert.match(renderChart, /button\.dataset\.strategyActions = JSON\.stringify\(actions\.map/);
  assert.match(logic, /const actions = JSON\.parse\(cell\.dataset\.strategyActions \|\| '\[\]'\)/);
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

test('Equity analysis consumes canonical structural completions and exact entered-hand outcomes', () => {
  assert.match(rangeAnalysis, /structural_direct_improvement_cards/);
  assert.match(equityHandAnalysis, /createExactEnteredHandOutcomeFacts/);
  assert.match(equityHandAnalysis, /winningOuts/);
  assert.match(equityHandAnalysis, /'winning_out'/);
  assert.match(equityHandAnalysis, /structuralImprovementsStillBehind/);
  assert.match(analysisBootstrap, /createEquityHandAnalysisProjection/);
  assert.match(logic, /bridge\.createEquityHandAnalysisProjection/);
  assert.doesNotMatch(logic, /function calculateOuts\(|\bscoreSeven\(/);
});

test('polished exact-card fallbacks use displayCard while analytical hand classes remain intact', () => {
  assert.match(logic, /formatHand\(heroCards\) \|\| heroCards\.map\(displayCard\)\.join\(' '\)/);
  assert.match(logic, /const hand = handCode\(row, column\)/);
  assert.match(logic, /const displayCard = \(card\) => card \? displayCardRank\(card\[0\]\) \+ getSuit\(card\)\.symbol/);
});

function createSoundHarness() {
  let oscillatorCount = 0;
  let sampleStartCount = 0;
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
    createBufferSource() {
      return {
        buffer: null,
        playbackRate: { setValueAtTime() {} },
        connect() {},
        start() { sampleStartCount += 1; },
      };
    },
    decodeAudioData(arrayBuffer, success) {
      const buffer = { duration: 0.5, byteLength: arrayBuffer.byteLength };
      success?.(buffer);
      return Promise.resolve(buffer);
    },
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    },
  };
  class AudioContext { constructor() { return context; } }
  const storage = new Map();
  const sandbox = {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    document: { hidden: false, baseURI: 'http://riverline.test/app/index.html', getElementById: () => null, querySelectorAll: () => [] },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }),
    URL,
    ArrayBuffer,
    window: { AudioContext, location: { href: 'http://riverline.test/app/index.html' }, addEventListener() {} },
  };
  vm.runInNewContext(`${foleyManifest}\n${sound}\nthis.exposedSoundFX = SoundFX;`, sandbox);
  return { soundFx: sandbox.exposedSoundFX, context, oscillatorCount: () => oscillatorCount, sampleStartCount: () => sampleStartCount };
}

test('card-deal sound is combined, throttled, and controlled by the global Audio toggle', async () => {
  const harness = createSoundHarness();
  await harness.soundFx.playCardDeal(5);
  assert.equal(harness.sampleStartCount(), 1, 'a grouped deal uses one recorded card placement cue');
  assert.equal(harness.oscillatorCount(), 0, 'poker cards never use the procedural oscillator');
  await harness.soundFx.playCardDeal(5);
  assert.equal(harness.sampleStartCount(), 1, 'same-frame rerenders do not create audio spam');
  harness.soundFx.toggle();
  harness.context.currentTime += 1;
  await harness.soundFx.playCardDeal(2);
  assert.equal(harness.sampleStartCount(), 1, 'muted playback is silent');
});

test('sound hooks are selected only at the semantic event boundary', () => {
  assert.equal((logic.match(/SoundFX\.play/g) || []).length, 0);
  assert.match(experienceEvents, /SoundFX\?\.consumeExperienceEvent\?\.\(event\)/);
  assert.match(playbookBootstrap, /createPokerWorldExperienceEvents/);
  assert.match(trainingBootstrap, /createPokerWorldExperienceEvents/);
  assert.match(experienceEvents, /emitPokerAction/);
  assert.match(experienceEvents, /emitTrainingDecisionResult/);
  assert.match(logic, /emitTrainingDecisionResultExperience/);
  assert.doesNotMatch(logic, /emitTrainingActionExperience|emitPokerAction/);
  assert.doesNotMatch(logic, /bindSliderPair[\s\S]{0,800}playChip/);
  assert.doesNotMatch(table, /SoundFX|playCardDeal/);
});

test('deal and feedback motion are event-scoped, restrained, and reduced-motion safe', () => {
  assert.match(table, /previous\[index\] !== signatures\[index\]/);
  assert.match(cardPresentation, /isDealing \? ' is-card-dealt'/);
  assert.doesNotMatch(table, /setTimeout/);
  assert.match(uiQaCss, /@keyframes riverline-card-deal[\s\S]*?translate:\s*var\(--card-deal-from-x, 0\) var\(--card-deal-from-y, -8px\)[\s\S]*?translate:\s*0 0/);
  assert.match(uiQaCss, /animation-delay:\s*calc\(var\(--card-deal-order, 0\) \* 22ms\)/);
  assert.match(uiQaCss, /\.card-slot\.filled\s*\{\s*animation:\s*none/);
  assert.match(uiQaCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.card-group\.is-card-dealt[\s\S]*?animation:\s*none/);
  assert.doesNotMatch(uiQaCss, /bounce|spin|rotate|pulse/i);
});

test('UI-QA-002B remains presentation-only and keeps protected engines intact', () => {
  for (const symbol of ['deriveDecisionContext', 'strategyProvider.resultSchemaVersion', 'calculateEquity', 'handleTrainingGuess']) {
    assert.match(logic, new RegExp(symbol));
  }
  assert.doesNotMatch(logic, /function calculateOuts\(|\bscoreSeven\(/);
  assert.doesNotMatch(table, /PokerState|DecisionContext|StrategyResult|calculateEquity|regret|MCCFR/);
  assert.doesNotMatch(uiQaCss, /calculateEquity|calculateOuts|DecisionContext|StrategyResult|MCCFR|teacher/i);
});
