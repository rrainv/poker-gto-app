import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const strategyHarness = require('./qa002_adapters.js');

import { StyleSheetModel, appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the Matrix, inspector, legend, suits and Equity analysis run in
// the booted app; markup is parsed and styling resolved through the cascade.
// SoundFX/table/presentation/bridge sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const root = markup.documentElement;
const matrix = markup.getElementById('chartView');
// SOURCE-SHAPE: "UI-QA-002B never zooms, bounces, spins, rotates or pulses and
// carries no engine code" is a policy lint over the block as authored.
const uiQa = (() => {
  const raw = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = raw.indexOf('*/', raw.indexOf('UI-QA-002B: dense range analysis')) + 2;
  return new StyleSheetModel(raw.slice(start, raw.indexOf('/* PRODUCT-UI-002: density, geometry, and component fit')));
})();
const authored = uiQa.rules.map((rule) => `${rule.selectorText}{${rule.declarations.map(({ property, value }) => `${property}:${value}`).join(';')}}`).join('\n')
  + [...uiQa.keyframes.entries()].map(([name, frames]) => `@keyframes ${name}{${frames.map((frame) => frame.declarations.map(({ property, value }) => `${property}:${value}`).join(';')).join('|')}}`).join('\n');
function probe(html, parent = markup.body) {
  const host = markup.createElement('div');
  host.innerHTML = html;
  parent.appendChild(host);
  return host.firstElementChild;
}
await app.navigate('analyze');
await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
const freshChart = () => {
  app.evaluate('app.matrixModel = null');
  app.call('renderChart');
  return app.$$('#strategyGrid .hand-cell');
};
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

test('Range Matrix keeps the exact 13 by 13 hand-class mapping', () => {
  const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  const handCode = (row, column) => row === column
    ? ranks[row] + ranks[column]
    : row < column ? ranks[row] + ranks[column] + 's' : ranks[column] + ranks[row] + 'o';
  const matrix = ranks.flatMap((_, row) => ranks.map((__, column) => handCode(row, column)));
  assert.equal(matrix.length, 169);
  assert.equal(new Set(matrix).size, 169);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(matrix)).digest('hex'), '9ac1d305342fd5b14e612c80a12c309b4fe94e6a2e3c07f2cfc3cc425c3262d8');
  // The page's handCode produces exactly this mapping, and so does the grid.
  const page = ranks.flatMap((_, row) => ranks.map((__, column) => app.call('handCode', row, column)));
  assert.deepEqual(page, matrix);
  const cells = freshChart();
  assert.deepEqual(cells.map((cell) => cell.dataset.hand), matrix);
});

test('matrix cells are compact, fixed, scroll-contained, LTR, and never zoom', () => {
  const wrap = matrix.querySelector('.matrix-wrap');
  assert.equal(wrap.getAttribute('tabindex'), '0');
  const grid = matrix.querySelector('#strategyGrid');
  assert.equal(grid.getAttribute('role'), 'grid');
  // Effective cell token: a later PRODUCT-UI-005 value superseded 3.2vw/50px and
  // DS-FOUNDATION-001 dropped that dead declaration when merging :root blocks.
  assert.equal(css.cascaded(root, '--range-matrix-cell'), 'clamp(42px, 2.75vw, 46px)');
  assert.ok(uiQa.rules.some((rule) => rule.declarations.some(({ property, value }) => property === 'grid-template-columns' && value === 'repeat(13, var(--range-matrix-cell))')));
  // The wrap scrolls horizontally on its own; in the Analyze preset layout
  // the panel contains it instead (superseded: wrap overflow visible, panel
  // overflow hidden).
  const panelWrap = markup.querySelector('.range-matrix-panel .matrix-wrap');
  const preset = root.dataset.layoutPreset;
  delete root.dataset.layoutPreset;
  assert.equal(css.cascaded(panelWrap, 'overflow-x'), 'auto');
  root.dataset.layoutPreset = preset || 'balanced';
  markup.getElementById('gtoMode').dataset.productDestination = 'analyze';
  assert.equal(css.cascaded(panelWrap, 'overflow'), 'visible');
  assert.equal(css.cascaded(markup.querySelector('.range-matrix-panel'), 'overflow-x'), 'hidden');
  if (preset === undefined) delete root.dataset.layoutPreset; else root.dataset.layoutPreset = preset;
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(grid, 'direction'), 'ltr');
  root.setAttribute('dir', 'ltr');
  const cell = probe('<button class="hand-cell"></button>', grid);
  assert.equal(css.cascaded(cell, 'transform', { states: ['hover'], stateElement: cell }), 'none');
  cell.parentElement.remove();
  assert.doesNotMatch(authored, /scale\(/);
});

test('matrix selection, inspector, and unavailable states remain explicit', async () => {
  for (const id of ['selectedHand', 'selectedHandKind', 'selectedHandPrimary', 'selectedMix']) {
    assert.ok(matrix.querySelector(`#${id}`), id);
  }
  const inspector = matrix.querySelector('.selected-hand.matrix-hand-inspector');
  assert.equal(inspector.getAttribute('aria-live'), 'polite');
  const cells = freshChart();
  cells.forEach((cell, index) => {
    assert.equal(cell.getAttribute('aria-rowindex'), String(Math.floor(index / 13) + 1));
    assert.equal(cell.getAttribute('aria-colindex'), String((index % 13) + 1));
    assert.match(cell.getAttribute('aria-pressed'), /^(?:true|false)$/);
  });
  const selected = probe('<button class="hand-cell" aria-pressed="true"></button>', markup.getElementById('strategyGrid'));
  assert.ok(css.cascaded(selected, 'content', { pseudoElement: 'after' }) !== undefined || css.cascaded(selected, 'box-shadow', { pseudoElement: 'after' }) !== undefined);
  selected.parentElement.remove();
  // Postflop the inspector says the exact hand is the unit (unavailable mix).
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['Qh', 'Jh', '2c']);
  freshChart();
  assert.ok(app.$('#selectedMix .matrix-inspector-unavailable'));
  await app.click('#gtoMode [data-card-set-edit="board"]');
  // Clearing the board applies at once and closes the picker.
  await app.click('#cardSetPickerClear');
  await app.settle(200);
  assert.equal(app.window.app.picker, null, 'Clear closed the picker');
  assert.equal(freshChart().length, 169, 'preflop again');
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
  // Each rendered cell carries its presented actions and mix state; the
  // inspector reads them back unmodified.
  const cells = freshChart();
  for (const cell of cells) {
    const actions = JSON.parse(cell.dataset.strategyActions || '[]');
    assert.equal(cell.dataset.state, actions.length ? 'available' : 'unavailable');
    assert.ok(cell.dataset.mixState);
    if (actions.length) assert.equal(actions.reduce((total, action) => total + Number(action.value), 0), 100, cell.dataset.strategyActions);
  }
  const mixed = cells.find((cell) => JSON.parse(cell.dataset.strategyActions || '[]').length > 1) || cells[0];
  const actions = JSON.parse(mixed.dataset.strategyActions);
  app.call('renderMatrixCellInspector', mixed);
  for (const action of actions) assert.match(text(app.byId('selectedMix')), new RegExp(`${action.value}%`));
});

test('one compact legend retains every stable semantic action mapping', () => {
  assert.equal(matrix.querySelectorAll('#strategyKey').length, 1);
  const legend = matrix.querySelector('#strategyKey');
  assert.ok(legend.classList.contains('strategy-key') && legend.classList.contains('matrix-action-legend'));
  assert.equal(legend.getAttribute('role'), 'list');
  for (const kind of ['aggressive', 'passive', 'all-in', 'mixed', 'fold']) {
    const key = legend.querySelector(`[data-action-kind="${kind}"]`);
    assert.ok(key, kind);
    const swatch = key.querySelector(':scope > i') || probe('<i></i>', key);
    assert.match(css.cascaded(swatch, 'background'), /^var\(--action-visual\b/, kind);
  }
});

test('spades use face-dark and theme-aware UI contrast without changing suit compatibility', async () => {
  assert.equal(css.cascaded(root, '--suit-spade'), '#18201c');
  assert.equal(css.cascaded(root, '--suit-spade-ui'), 'var(--text-primary)');
  const label = probe('<div class="deck-suit-row" data-picker-suit="s"><div class="deck-suit-label"></div></div>').firstElementChild;
  assert.equal(css.cascaded(label, 'color'), 'var(--suit-spade-ui)');
  const previous = root.dataset.fourColor;
  root.dataset.fourColor = 'false';
  assert.equal(css.cascaded(root, '--suit-diamond'), 'var(--suit-heart)');
  assert.equal(css.cascaded(root, '--suit-club'), 'var(--suit-spade)');
  root.dataset.fourColor = previous;
  // Picker cards carry the stable suit class for every suit.
  await app.click('#gtoMode [data-card-set-edit="hero"]');
  for (const suit of ['h', 'd', 'c', 's']) {
    const card = app.$(`[data-deck-card="A${suit}"]`);
    assert.ok(card.classList.contains(`card--suit-${suit}`) || card.querySelector(`.card--suit-${suit}`), suit);
  }
  await app.click('#cardSetPickerCancel');
});

test('Equity analysis consumes canonical structural completions and exact entered-hand outcomes', () => {
  assert.match(rangeAnalysis, /structural_direct_improvement_cards/);
  assert.match(equityHandAnalysis, /createExactEnteredHandOutcomeFacts/);
  assert.match(equityHandAnalysis, /winningOuts/);
  assert.match(equityHandAnalysis, /'winning_out'/);
  assert.match(equityHandAnalysis, /structuralImprovementsStillBehind/);
  assert.match(analysisBootstrap, /createEquityHandAnalysisProjection/);
  // The page builds Equity analysis through the bridge's projection.
  for (const name of ['calculateOuts', 'scoreSeven']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  assert.equal(typeof app.window.RiverlineAnalysisExplanation.createEquityHandAnalysisProjection, 'function');
});

test('polished exact-card fallbacks use displayCard while analytical hand classes remain intact', () => {
  // displayCard renders rank style + suit symbol; Hero's fact shows the hand
  // class, falling back to displayed cards.
  assert.equal(app.evaluate('displayCard("Th")'), `${app.evaluate('displayCardRank("T")')}♥`);
  assert.equal(app.evaluate('displayCard(null)'), '');
  app.call('updateMetrics');
  assert.equal(text(app.byId('mEquity')), app.call('formatHand', ['As', 'Kd']) || ['As', 'Kd'].map((card) => app.evaluate(`displayCard(${JSON.stringify(card)})`)).join(' '));
  // Matrix cells keep analytical hand classes (AKs above the diagonal).
  const cells = freshChart();
  assert.ok(cells[1].classList.contains('hand-suited'));
  assert.ok(cells[13].classList.contains('hand-offsuit'));
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

test('sound hooks are selected only at the semantic event boundary', async () => {
  // (logic.js never calls SoundFX directly: SOURCE-SHAPE call-site lint in
  // prelabs_fix001_firefox_audio.)
  assert.match(experienceEvents, /SoundFX\?\.consumeExperienceEvent\?\.\(event\)/);
  assert.match(playbookBootstrap, /createPokerWorldExperienceEvents/);
  assert.match(trainingBootstrap, /createPokerWorldExperienceEvents/);
  assert.match(experienceEvents, /emitPokerAction/);
  assert.match(experienceEvents, /emitTrainingDecisionResult/);
  assert.equal(app.evaluate('typeof emitTrainingDecisionResultExperience'), 'function');
  for (const name of ['emitTrainingActionExperience', 'emitPokerAction']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  // Slider input emits no experience (chip) cue.
  const spy = app.spy(['emitStudyExperience', 'emitTrainingDecisionResultExperience']);
  try {
    await app.setValue('#players', '5');
    assert.equal(spy.total(), 0);
  } finally {
    spy.restore();
  }
  assert.doesNotMatch(table, /SoundFX|playCardDeal/);
});

test('deal and feedback motion are event-scoped, restrained, and reduced-motion safe', () => {
  assert.match(table, /previous\[index\] !== signatures\[index\]/);
  assert.match(cardPresentation, /isDealing \? ' is-card-dealt'/);
  assert.doesNotMatch(table, /setTimeout/);
  const deal = css.keyframes.get('riverline-card-deal');
  const translate = (offset) => deal.find((frame) => frame.offsets.includes(offset)).declarations.find(({ property }) => property === 'translate')?.value;
  assert.equal(translate('from'), 'var(--card-deal-from-x, 0) var(--card-deal-from-y, -8px)');
  assert.equal(translate('to'), '0 0');
  const dealt = probe('<div class="card-group is-card-dealt"><span class="riverline-card"></span></div>');
  const delays = uiQa.rules.flatMap((rule) => rule.declarations).filter(({ property }) => property === 'animation-delay').map(({ value }) => value);
  assert.ok(delays.includes('calc(var(--card-deal-order, 0) * 22ms)'));
  assert.equal(css.cascaded(probe('<span class="card-slot filled"></span>'), 'animation'), 'none');
  assert.equal(css.cascaded(dealt, 'animation', { reducedMotion: true }), 'none');
  assert.doesNotMatch(authored, /bounce|spin|rotate|pulse/i);
});

test('UI-QA-002B remains presentation-only and keeps protected engines intact', () => {
  assert.equal(typeof app.window.RiverlinePlaybookState, 'object');
  assert.ok(app.evaluate('strategyProvider.resultSchemaVersion'));
  for (const name of ['calculateEquity', 'handleTrainingGuess']) assert.equal(app.evaluate(`typeof ${name}`), 'function', name);
  for (const name of ['calculateOuts', 'scoreSeven']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  assert.doesNotMatch(table, /PokerState|DecisionContext|StrategyResult|calculateEquity|regret|MCCFR/);
  assert.doesNotMatch(authored, /calculateEquity|calculateOuts|DecisionContext|StrategyResult|MCCFR|teacher/i);
});
