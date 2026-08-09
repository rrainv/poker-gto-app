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
  const updatePositionsSource = sliceBetween(source, 'function updatePositionSelect(', 'function normalizeTree(data, fileName)');
  const actionParserSource = sliceBetween(source, 'function isAllInActionName(name)', 'function parseCard(cardStr)');
  const treeContextSource = sliceBetween(source, 'function treeContext(decisionContext =', 'function isAllInActionName(name)')
    .replace('function treeContext(', 'function qaTreeContext(');
  const noTreeProfileSource = sliceBetween(source, 'function noTreeProfile(reason,', 'function actionProfile(hand =')
    .replace('function noTreeProfile(', 'function qaNoTreeProfile(');
  const actionProfileSource = sliceBetween(source, 'function actionProfile(hand =', 'function setFrequency(index, action)')
    .replace('function actionProfile(', 'function qaActionProfile(');
  const fallbackSource = sliceBetween(source, 'function calculatePreflopFallbackStrategy(', 'function noTreeProfile(reason,');
  const potSource = sliceBetween(source, 'function preflopBasePot()', 'function updateMetrics()');
  const updateContextSource = sliceBetween(source, 'async function updateContext(reason =', 'async function loadOnnxModel()');
  const sliderSource = sliceBetween(source, 'function syncSliderPair(rangeId, numberId)', 'function bindSliderPair(rangeId, numberId, callback)');
  const heuristicSource = sliceBetween(source, 'function getHandTier(hand)', 'function combinations(items, size)');
  const trainingActionSource = sliceBetween(source, 'const ACTION_PASSIVE_TO_AGGRESSIVE_ORDER', 'function generateFeedback(userAction, bestAction, solution)');
  const postflopSource = sliceBetween(source, 'function calculateUnifiedPostflopStrategy(context, heroCards, deadCards = [], decisionContext = null)', 'function calculatePostflopFallbackStrategy(context, heroCards)');
  const trainingStrategySource = sliceBetween(source, 'function getTrainingStrategy(context, heroCards)', '// Hook renderRangeAdvantage into updateContext and villain pos changes');

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
    capturedOnnxContext: null,
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
      useOnnx: true,
      onnxSession: {},
      useApi: false,
      solver: null,
      cachedStrategy: null,
      lastApiContext: '',
      lastContextKey: ''
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
    const actionProfile = () => ({
      actions: [{ name: 'Fold', value: 100, kind: 'fold' }],
      best: 'FOLD', reason: 'test capture', source: 'TEST'
    });
    const setFrequency = syncNoop;
    const updateMetrics = syncNoop;
    const renderPath = syncNoop;
    const renderChart = syncNoop;
    const renderRangeAdvantage = syncNoop;
    const renderBettingTree = syncNoop;
    const setApiStatus = syncNoop;
    const treeContext = () => ({ available: true });
    const noTreeProfile = (reason) => ({ actions: [], best: 'NONE', reason, source: 'NO TREE' });
    const fetchWithTimeout = async () => ({ ok: false });
    const formatHand = (cards) => {
      const first = cards[0][0];
      const second = cards[1][0];
      if (first === second) return first + second;
      return first + second + (cards[0][1] === cards[1][1] ? 's' : 'o');
    };
    const calculatePostflopFallbackStrategy = () => ({ Check: 100 });
    const evaluatePostflopHandStrength = () => ({
      category: 'air', score: 1, tripsType: null, tripsStrength: 1,
      isBoardPaired: false, isWetBoard: false, boardTexture: {}
    });
    let capturedEquityDecisionContext = null;
    const simulateEquity = (heroCards, board, deadCards, iterations, decisionContext) => {
      capturedEquityDecisionContext = decisionContext || null;
      return { eq: postflopEquity, pct: postflopEquity * 100 };
    };
    const generateStrategyWithOnnx = async (context) => {
      capturedOnnxContext = JSON.parse(JSON.stringify(context));
      return { strategy: {} };
    };

    ${numericSource}
    ${currentStreetProductionSource}
    ${currentStreetSource}
    ${handClassSource}
    ${updatePositionsSource}
    ${treeContextSource}
    ${actionParserSource}
    ${fallbackSource}
    ${potSource}
    ${sliderSource}
    ${heuristicSource}
    ${trainingActionSource}
    ${postflopSource}
    ${trainingStrategySource}
    ${noTreeProfileSource}
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
      defaultTrainingFacingSize,
      strategyAccountingContext,
      deriveDecisionContext,
      decisionContextToLegacyStrategyContext,
      decisionContextToLegacyPostflopContext,
      calculatePreflopFallbackForDecisionContext,
      parseSolverEntry,
      classifyAction,
      standardActionName,
      playbookActionProfile(entry) {
        controls.set('#heroPos', createElement('BTN'));
        controls.set('#lastAction', createElement('unopened', { text: 'Unopened' }));
        app.gto.hero = ['As', 'Ks'];
        app.gto.board = [];
        app.decisionContext = null;
        app.solver = { strategy: { AKs: { BTN: entry } } };
        return qaActionProfile('AKs');
      },
      strategyProfile(context, solver = null) {
        app.decisionContext = null;
        app.useOnnx = false;
        app.onnxSession = null;
        app.solver = solver;
        return qaActionProfile(null, context);
      },
      strategyProfileCapture(context, solver = null) {
        capturedEquityDecisionContext = null;
        const profile = this.strategyProfile(context, solver);
        return { profile, equityDecisionContext: capturedEquityDecisionContext };
      },
      noTreeStrategyProfile(context, reason = 'No matching tree') {
        app.decisionContext = null;
        app.solver = null;
        return qaNoTreeProfile(reason, context);
      },
      localTreeContext(context, solver) {
        app.decisionContext = null;
        app.solver = solver;
        return qaTreeContext(context);
      },
      normalizeActionName,
      actionRank: getActionAggressionRank,
      heuristic(policy, context, hand) {
        return applyHeuristicToPrediction(policy, context, 0, 0, hand);
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
          rakeValue: [values.rake ?? 5, 0, 20],
          rakeValueNum: [values.rake ?? 5, 0, 20],
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
        app.useOnnx = true;
        app.onnxSession = {};
        app.useApi = false;
        app.gto.board = values.board || [];
        app.gto.hero = values.heroCards || [];
        app.gto.dead = values.deadCards || [];
        app.lastApiContext = '';
        app.lastContextKey = '';
        app.cachedStrategy = null;
        capturedOnnxContext = null;
        dispatchedState = null;
        const contexts = [];
        const decisionContexts = [];
        const refreshCount = values.refreshCount ?? 1;
        for (let refresh = 0; refresh < refreshCount; refresh += 1) {
          app.lastApiContext = '';
          capturedOnnxContext = null;
          await updateContext('QA-002 capture');
          contexts.push({ ...capturedOnnxContext });
          decisionContexts.push({ ...app.decisionContext });
        }
        return {
          context: contexts[contexts.length - 1],
          contexts,
          decisionContext: decisionContexts[decisionContexts.length - 1],
          decisionContexts,
          snapshot: readPlaybookInputSnapshot(),
          facingControl: controls.get('#facingSize').value,
          facingNumberControl: controls.get('#facingSizeNum').value,
          dispatchedState,
        };
      },
      trainingButtons(context, solution) {
        const container = createElement();
        controls.set('#trainingGuessButtons', container);
        app.training.currentContext = { ...context };
        app.training.board = context.board || [];
        updateTrainingButtons(solution);
        return container.children.map((child) => ({
          text: child.textContent,
          action: child['data-action']
        }));
      },
      trainingStrategy(entry, context) {
        app.solver = { strategy: { AKs: { BTN: entry } } };
        return getTrainingStrategy(context, ['As', 'Ks']);
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
  defaultTrainingFacingSize: (...args) => harness.defaultTrainingFacingSize(...args),
  strategyAccountingContext: (...args) => plain(harness.strategyAccountingContext(...args)),
  deriveDecisionContext: (...args) => plain(harness.deriveDecisionContext(...args)),
  legacyStrategyContext: (...args) => plain(harness.decisionContextToLegacyStrategyContext(...args)),
  legacyPostflopContext: (...args) => plain(harness.decisionContextToLegacyPostflopContext(...args)),
  fallbackForDecisionContext: (...args) => plain(harness.calculatePreflopFallbackForDecisionContext(...args)),
  parseSolverEntry: (...args) => plain(harness.parseSolverEntry(...args)),
  classifyAction: (...args) => harness.classifyAction(...args),
  standardActionName: (...args) => harness.standardActionName(...args),
  playbookActionProfile: (...args) => plain(harness.playbookActionProfile(...args)),
  strategyProfile: (...args) => plain(harness.strategyProfile(...args)),
  strategyProfileCapture: (...args) => plain(harness.strategyProfileCapture(...args)),
  noTreeStrategyProfile: (...args) => plain(harness.noTreeStrategyProfile(...args)),
  localTreeContext: (...args) => plain(harness.localTreeContext(...args)),
  normalizeActionName: (...args) => harness.normalizeActionName(...args),
  actionRank: (...args) => harness.actionRank(...args),
  heuristic: (...args) => plain(harness.heuristic(...args)),
  preflopPot: (...args) => harness.preflopPot(...args),
  captureContext: async (...args) => plain(await harness.captureContext(...args)),
  trainingButtons: (...args) => plain(harness.trainingButtons(...args)),
  trainingStrategy: (...args) => plain(harness.trainingStrategy(...args)),
  postflopWithDrop: (...args) => plain(harness.postflopWithDrop(...args)),
  rankValue: (...args) => harness.rankValue(...args),
  fallbackSource: harness.fallbackSource,
  readInputBounds,
};
