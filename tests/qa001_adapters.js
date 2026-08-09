const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGIC_PATH = path.join(REPO_ROOT, 'app', 'src', 'core', 'logic.js');
const WORKER_PATH = path.join(REPO_ROOT, 'app', 'equity.worker.js');
const PYTHON_ADAPTER_PATH = path.join(__dirname, 'python_evaluator_adapter.py');

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract production source between ${startMarker} and ${endMarker}`);
  }
  return source.slice(start, end);
}

function createLogicHarness() {
  const source = fs.readFileSync(LOGIC_PATH, 'utf8');
  const rankValue = source.match(/const RANK_VALUE\s*=\s*\{[^\n]+\};/);
  if (!rankValue) throw new Error('Could not extract RANK_VALUE from logic.js');

  const cardStateSource = sliceBetween(source, 'function groupCards(group)', 'function cardMarkup(card)');
  const renderDeckSource = sliceBetween(source, 'function renderDeck()', 'function firstEmptyIndex(cards, limit)');
  const evaluatorEquitySource = sliceBetween(
    source,
    'function combinations(items, size)',
    'function renderEquityResult(result, exact, total, splitRate)'
  );

  const sandbox = {
    Array,
    Int32Array,
    Math,
    Number,
    Set,
    Uint8Array,
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    ${rankValue[0]}
    const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
    const SUITS = [
      { id: 'h', symbol: 'h' },
      { id: 's', symbol: 's' },
      { id: 'd', symbol: 'd' },
      { id: 'c', symbol: 'c' }
    ];

    let app = { equity: { board: [], dead: [], players: [] }, gto: {}, training: {} };
    let config = {};
    let capturedResult = null;
    let toastMessages = [];
    let deckNode = { innerHTML: '' };

    const $ = (selector) => selector === '#deck' ? deckNode : null;
    const allDeck = () => SUITS.flatMap((suit) => RANKS.map((rank) => rank + suit.id));
    const getSuit = (card) => SUITS.find((suit) => suit.id === (card && card[1]));
    const selectedValue = (id) => config[id];
    const numericValue = (id, fallback = 0) => {
      const value = Number(config[id]);
      return Number.isFinite(value) ? value : fallback;
    };
    const requestAnimationFrame = (callback) => callback();
    const renderEquityResult = (result, exact, total, splitRate) => {
      capturedResult = { result, exact, total, splitRate };
    };
    const toast = (message) => { toastMessages.push(message); };

    ${cardStateSource}
    ${renderDeckSource}
    ${evaluatorEquitySource}

    globalThis.__qa001 = {
      scoreFive,
      scoreSeven,
      calculateEquity,
      setEquityState(state, options) {
        app.equity = state;
        config = {
          '#calcStyle': options.calcStyle || 'exact',
          '#trials': options.trials === undefined ? 1000 : options.trials
        };
        capturedResult = null;
        toastMessages = [];
      },
      getEquityCapture() {
        return { capturedResult, toastMessages: [...toastMessages] };
      },
      renderDeckFor(state, picker) {
        app.equity = state;
        app.picker = picker;
        deckNode = { innerHTML: '' };
        renderDeck();
        return deckNode.innerHTML;
      }
    };
  `, sandbox, { filename: LOGIC_PATH });

  return sandbox.__qa001;
}

function createWorkerHarness() {
  const workerCode = fs.readFileSync(WORKER_PATH, 'utf8');
  const sandbox = {
    self: { postMessage() {} },
    console,
    Date,
    Float32Array,
    Int32Array,
    Map,
    Math,
    Set,
    Uint8Array,
  };

  vm.createContext(sandbox);
  vm.runInContext(`${workerCode}
    self.__qa001 = { CARD_CODES, evaluate5, evaluateHandFast };
  `, sandbox, { filename: WORKER_PATH });

  const api = sandbox.self.__qa001;
  return {
    evaluate(cards) {
      const encoded = new Int32Array(cards.map((card) => api.CARD_CODES[card]));
      return api.evaluateHandFast(encoded, encoded.length);
    }
  };
}

const logicHarness = createLogicHarness();
const workerHarness = createWorkerHarness();

function evaluateProduction(cards) {
  return logicHarness.scoreSeven(cards);
}

function evaluateWorker(cards) {
  return workerHarness.evaluate(cards);
}

function evaluatePython(hands) {
  const processResult = spawnSync('python', [PYTHON_ADAPTER_PATH], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    input: JSON.stringify(hands),
  });

  if (processResult.status !== 0) {
    throw new Error(`Python evaluator adapter failed: ${processResult.stderr || processResult.stdout}`);
  }
  return JSON.parse(processResult.stdout);
}

function runProductionEquity(state, options = {}) {
  const clonedState = JSON.parse(JSON.stringify(state));
  logicHarness.setEquityState(clonedState, options);
  logicHarness.calculateEquity();
  const capture = logicHarness.getEquityCapture();
  return {
    ...capture.capturedResult,
    toastMessages: capture.toastMessages,
  };
}

function renderProductionEquityDeck(state, picker) {
  return logicHarness.renderDeckFor(JSON.parse(JSON.stringify(state)), { ...picker });
}

module.exports = {
  evaluateProduction,
  evaluatePython,
  evaluateWorker,
  renderProductionEquityDeck,
  runProductionEquity,
};
