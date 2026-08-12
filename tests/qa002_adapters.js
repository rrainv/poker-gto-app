const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGIC_PATH = path.join(REPO_ROOT, 'app', 'src', 'core', 'logic.js');
const HTML_PATH = path.join(REPO_ROOT, 'app', 'index.html');

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract production source between ${startMarker} and ${endMarker}`);
  }
  return source.slice(start, end);
}

function createElement(value = '', options = {}) {
  return {
    value: String(value),
    min: options.min === undefined ? '' : String(options.min),
    max: options.max === undefined ? '' : String(options.max),
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    children: [],
    selectedOptions: [{ text: options.text || String(value) }],
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    addEventListener() {},
    setAttribute(name, nextValue) { this[name] = String(nextValue); },
    appendChild(child) { this.children.push(child); },
  };
}

function createHarness() {
  const source = fs.readFileSync(LOGIC_PATH, 'utf8');
  const positions = source.match(/const POSITIONS\s*=\s*\{[\s\S]*?\n\};/);
  const ranks = source.match(/const RANKS\s*=\s*\[[^\n]+\];/);
  const rankValue = source.match(/const RANK_VALUE\s*=\s*\{[^\n]+\};/);
  const fallbackPositions = source.match(/const PREFLOP_FALLBACK_POSITION_MODIFIERS\s*=\s*Object\.freeze\(\{[\s\S]*?\n\}\);/);
  if (!positions || !ranks || !rankValue || !fallbackPositions) throw new Error('Could not extract core constants from logic.js');

  const numericSource = sliceBetween(source, 'function numericValue(id, fallback = 0)', 'function updatePositionSelect(');
  const currentStreetProductionSource = sliceBetween(source, 'function currentStreet(board)', 'function handClass(cards)');
  const currentStreetSource = currentStreetProductionSource
    .replace('function currentStreet(', 'function qaCurrentStreet(');
  const handClassSource = sliceBetween(source, 'function handClass(cards)', 'function numericValue(id, fallback = 0)');
  const updatePositionsSource = sliceBetween(source, 'function updatePositionSelect(', 'function isAllInActionName(name)');
  const actionParserSource = sliceBetween(source, 'function isAllInActionName(name)', 'function simulateEquity(');
  const fallbackStrategySource = sliceBetween(source, 'function fallbackStrategyResult(reason,', 'function actionProfile(hand =')
    .replace('function fallbackStrategyResult(', 'function qaFallbackStrategyResult(');
  const actionProfileSource = sliceBetween(source, 'function actionProfile(hand =', 'function setFrequency(index, action)')
    .replace('function actionProfile(', 'function qaActionProfile(')
    .replaceAll('fallbackStrategyResult(', 'qaFallbackStrategyResult(');
  const fallbackSource = sliceBetween(source, 'function calculatePreflopFallbackStrategy(', 'function fallbackStrategyResult(reason,');
  const potSource = sliceBetween(source, 'function preflopBasePot()', 'function updateMetrics()');
  const updateContextSource = sliceBetween(source, 'async function updateContext(reason =', '// Legacy fast evaluator retained for Playbook heuristics');
  const sliderSource = sliceBetween(source, 'function syncSliderPair(rangeId, numberId)', 'function bindSliderPair(rangeId, numberId, callback)');
  const postflopSource = sliceBetween(
    source,
    'function calculateUnifiedPostflopStrategy(context, heroCards, deadCards = [], decisionContext = null)',
    "const TRAINING_CONFIG_SCHEMA_VERSION = 'training-config/v1'",
  );

  const controls = new Map();
  const sandbox = {
    AbortController,
    Array,
    BigInt,
    BigInt64Array,
    console: { log() {}, error() {}, warn() {} },
    CustomEvent: function CustomEvent(type, init) { return { type, detail: init.detail }; },
    Float32Array,
    Math,
    Number,
    Object,
    Promise,
    Set,
    String,
    clearTimeout,
    setTimeout,
    controls,
    createElement,
    activeElement: null,
    dispatchedState: null,
    flatDrop: 0,
    postflopEquity: 0.48,
  };

  sandbox.document = {
    get activeElement() { return sandbox.activeElement; },
    set activeElement(value) { sandbox.activeElement = value; },
    getElementById(id) {
      if (id === 'flatDrop') return createElement(sandbox.flatDrop);
      return controls.get(`#${id}`) || null;
    },
    createElement() { return createElement(); },
  };
  sandbox.window = {
    clearTimeout,
    setTimeout,
    dispatchEvent(event) { sandbox.dispatchedState = event.detail; },
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    ${positions[0]}
    ${ranks[0]}
    ${rankValue[0]}
    ${fallbackPositions[0]}
    const ACTION_COLORS = { aggressive: 'a', passive: 'p', fold: 'f', unavailable: 'u' };
    let app = {
      settings: { tightness: 0, oppTightness: 0 },
      gto: { hero: [], board: [], dead: [] },
      training: { board: [], currentContext: null },
      lastContextKey: '',
      strategyResult: null,
      playbookResolution: null,
      playbookViewModel: null,
      decisionContext: null
    };

    const $ = (selector) => controls.get(selector) || null;
    const $$ = () => [];
    const selectedValue = (selector) => {
      const element = $(selector);
      return element ? element.value : undefined;
    };
    const t = (value) => value;
    const displayCard = (card) => card;
    const requestAnimationFrame = (callback) => callback();
    const syncNoop = () => {};
    const actionProfile = (...args) => qaActionProfile(...args);
    const setFrequency = syncNoop;
    const updateMetrics = syncNoop;
    const renderPath = syncNoop;
    const renderChart = syncNoop;
    const renderRangeAdvantage = syncNoop;
    const renderBettingTree = syncNoop;
    const formatHand = (cards) => {
      const first = cards[0][0];
      const second = cards[1][0];
      if (first === second) return first + second;
      return first + second + (cards[0][1] === cards[1][1] ? 's' : 'o');
    };
    const evaluatePostflopHandStrength = () => ({
      category: 'air', score: 1, tripsType: null, tripsStrength: 1,
      isBoardPaired: false, isWetBoard: false, boardTexture: {}
    });
    let capturedEquityDecisionContext = null;
    const simulateEquity = (heroCards, board, deadCards, iterations, decisionContext) => {
      capturedEquityDecisionContext = decisionContext || null;
      return { eq: postflopEquity, pct: postflopEquity * 100 };
    };
    ${numericSource}
    ${currentStreetProductionSource}
    ${currentStreetSource}
    ${handClassSource}
    ${updatePositionsSource}
    ${actionParserSource}
    ${fallbackSource}
    ${potSource}
    ${sliderSource}
    ${postflopSource}
    ${fallbackStrategySource}
    ${actionProfileSource}
    ${updateContextSource}

    globalThis.__qa002 = {
      positionsFor(count) { return [...(POSITIONS[count] || POSITIONS[6])]; },
      streetFor(board) { return qaCurrentStreet(board); },
      updateHeroPositions(count, oldHero) {
        controls.set('#playersNum', createElement(count));
        const hero = createElement(oldHero);
        controls.set('#heroPos', hero);
        updatePositions();
        return { value: hero.value, html: hero.innerHTML };
      },
      clampPair(rangeId, numberId, rangeValue, numberValue, min, max) {
        const range = createElement(rangeValue, { min, max });
        const number = createElement(numberValue, { min, max });
        controls.set('#' + rangeId, range);
        controls.set('#' + numberId, number);
        activeElement = number;
        syncSliderPair(rangeId, numberId);
        activeElement = null;
        return { range: range.value, number: number.value };
      },
      fallback: calculatePreflopFallbackStrategy,
      fallbackPositionModifiers() { return { ...PREFLOP_FALLBACK_POSITION_MODIFIERS }; },
      normalizeFacingSize,
      strategyAccountingContext,
      deriveDecisionContext,
      decisionContextToLegacyPostflopContext,
      calculatePreflopFallbackForDecisionContext,
      STRATEGY_RESULT_SCHEMA_VERSION,
      STRATEGY_SOURCES,
      structuralActionFromName,
      createStrategyResult,
      preflopHeuristicToStrategyResult,
      postflopHeuristicToStrategyResult,
      unavailableStrategyResult,
      strategyResultToLegacyProfile,
      strategyProfile(context) {
        app.decisionContext = null;
        return strategyResultToLegacyProfile(qaActionProfile(null, context));
      },
      strategyResult(context) {
        app.decisionContext = null;
        return qaActionProfile(null, context);
      },
      strategyProfileCapture(context) {
        capturedEquityDecisionContext = null;
        const profile = this.strategyProfile(context);
        return { profile, equityDecisionContext: capturedEquityDecisionContext };
      },
      fallbackStrategyProfile(context, reason = 'Heuristic fallback') {
        app.decisionContext = null;
        return strategyResultToLegacyProfile(qaFallbackStrategyResult(reason, context));
      },
      fallbackStrategyResult(context, reason = 'Heuristic fallback') {
        app.decisionContext = null;
        return qaFallbackStrategyResult(reason, context);
      },
      preflopPot({ ante, players, straddle }) {
        controls.set('#ante', createElement(ante));
        controls.set('#players', createElement(players));
        controls.set('#straddle', createElement(straddle));
        return preflopBasePot();
      },
      async captureContext(values) {
        controls.clear();
        const definitions = {
          players: [values.players ?? 6, 2, 10],
          playersNum: [values.players ?? 6, 2, 10],
          stack: [values.stack ?? 100, 10, 500],
          stackNum: [values.stack ?? 100, 10, 500],
          ante: [values.ante ?? 0, 0, 5],
          anteNum: [values.ante ?? 0, 0, 5],
          heroPos: [values.heroPos ?? 'BTN'],
          lastAction: [values.lastAction ?? 'unopened'],
          facingSize: [values.facingSize ?? 0, 0, 100],
          facingSizeNum: [values.facingSize ?? 0, 0, 100],
          potSize: [values.potSize ?? 1.5, 0.5, 200],
          stackMode: [values.stackMode ?? 'hero'],
          rakeMode: [values.rakeMode ?? 'off'],
        };
        for (const [id, [value, min, max]] of Object.entries(definitions)) {
          controls.set('#' + id, createElement(value, { min, max, text: String(value) }));
        }
        app.gto.board = values.board || [];
        app.gto.hero = values.heroCards || [];
        app.gto.dead = values.deadCards || [];
        app.lastContextKey = '';
        dispatchedState = null;
        const decisionContexts = [];
        const strategyResults = [];
        const refreshCount = values.refreshCount ?? 1;
        for (let refresh = 0; refresh < refreshCount; refresh += 1) {
          await updateContext('QA-002 capture');
          decisionContexts.push({ ...app.decisionContext });
          strategyResults.push(JSON.parse(JSON.stringify(app.strategyResult)));
        }
        return {
          decisionContext: decisionContexts[decisionContexts.length - 1],
          decisionContexts,
          strategyResult: strategyResults[strategyResults.length - 1],
          strategyResults,
          snapshot: readPlaybookInputSnapshot(),
          facingControl: controls.get('#facingSize').value,
          facingNumberControl: controls.get('#facingSizeNum').value,
          dispatchedState,
        };
      },
      postflopWithDrop(drop, equity = 0.48) {
        flatDrop = drop;
        postflopEquity = equity;
        return calculateUnifiedPostflopStrategy({
          board: ['2c', '7d', '9h'], hero_pos: 'BTN', villain_pos: 'BB',
          potSize: 10, facingSize: 0, stack: 30
        }, ['As', 'Kd'], []);
      },
      rankValue(rank) { return RANK_VALUE[rank]; }
    };
  `, sandbox, { filename: LOGIC_PATH });

  sandbox.__qa002.controls = controls;
  sandbox.__qa002.fallbackSource = fallbackSource;
  return sandbox.__qa002;
}

const harness = createHarness();

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function readInputBounds(id) {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const match = html.match(new RegExp(`<input[^>]+id="${id}"[^>]*>`, 'i'));
  if (!match) throw new Error(`Could not find #${id} in index.html`);
  const attribute = (name) => {
    const found = match[0].match(new RegExp(`${name}="([^"]+)"`, 'i'));
    return found ? Number(found[1]) : null;
  };
  return { min: attribute('min'), max: attribute('max'), step: attribute('step') };
}

module.exports = {
  positionsFor: (count) => plain(harness.positionsFor(count)),
  streetFor: (board) => harness.streetFor(board),
  updateHeroPositions: (...args) => plain(harness.updateHeroPositions(...args)),
  clampPair: (...args) => plain(harness.clampPair(...args)),
  fallback: (...args) => plain(harness.fallback(...args)),
  fallbackPositionModifiers: () => plain(harness.fallbackPositionModifiers()),
  normalizeFacingSize: (...args) => harness.normalizeFacingSize(...args),
  strategyAccountingContext: (...args) => plain(harness.strategyAccountingContext(...args)),
  deriveDecisionContext: (...args) => plain(harness.deriveDecisionContext(...args)),
  legacyPostflopContext: (...args) => plain(harness.decisionContextToLegacyPostflopContext(...args)),
  fallbackForDecisionContext: (...args) => plain(harness.calculatePreflopFallbackForDecisionContext(...args)),
  strategyResultSchemaVersion: harness.STRATEGY_RESULT_SCHEMA_VERSION,
  strategySources: plain(harness.STRATEGY_SOURCES),
  structuralAction: (...args) => plain(harness.structuralActionFromName(...args)),
  createStrategyResult: (...args) => plain(harness.createStrategyResult(...args)),
  preflopStrategyResult: (...args) => plain(harness.preflopHeuristicToStrategyResult(...args)),
  postflopStrategyResult: (...args) => plain(harness.postflopHeuristicToStrategyResult(...args)),
  unavailableStrategyResult: (...args) => plain(harness.unavailableStrategyResult(...args)),
  legacyProfileForStrategyResult: (...args) => plain(harness.strategyResultToLegacyProfile(...args)),
  strategyProfile: (...args) => plain(harness.strategyProfile(...args)),
  strategyResult: (...args) => plain(harness.strategyResult(...args)),
  strategyProfileCapture: (...args) => plain(harness.strategyProfileCapture(...args)),
  fallbackStrategyProfile: (...args) => plain(harness.fallbackStrategyProfile(...args)),
  fallbackStrategyResult: (...args) => plain(harness.fallbackStrategyResult(...args)),
  preflopPot: (...args) => harness.preflopPot(...args),
  captureContext: async (...args) => plain(await harness.captureContext(...args)),
  postflopWithDrop: (...args) => plain(harness.postflopWithDrop(...args)),
  rankValue: (...args) => harness.rankValue(...args),
  fallbackSource: harness.fallbackSource,
  readInputBounds,
};
