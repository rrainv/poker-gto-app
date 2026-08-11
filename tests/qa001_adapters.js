const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGIC_PATH = path.join(REPO_ROOT, 'app', 'src', 'core', 'logic.js');
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
    '// Static TypedArray buffers for zero-GC hand evaluation in main thread',
    'let equityCalculationGeneration = 0;'
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
    let deckNode = { innerHTML: '' };

    const $ = (selector) => selector === '#deck' ? deckNode : null;
    const allDeck = () => SUITS.flatMap((suit) => RANKS.map((rank) => rank + suit.id));
    const getSuit = (card) => SUITS.find((suit) => suit.id === (card && card[1]));
    ${cardStateSource}
    ${renderDeckSource}
    ${evaluatorEquitySource}

    globalThis.__qa001 = {
      scoreFive,
      scoreSeven,
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

const logicHarness = createLogicHarness();
const equityModulePromise = import(pathToFileURL(
  path.join(REPO_ROOT, 'shared', 'poker-domain', 'equity.js')
).href);

function evaluateProduction(cards) {
  return logicHarness.scoreSeven(cards);
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

async function runProductionEquity(state, options = {}) {
  const equity = await equityModulePromise;
  const method = options.calcStyle === 'sim'
    ? equity.EQUITY_METHODS.MONTE_CARLO
    : options.calcStyle === 'exact'
      ? equity.EQUITY_METHODS.EXACT
      : equity.EQUITY_METHODS.AUTO;
  const result = await equity.calculateEquity({
    schemaVersion: equity.EQUITY_REQUEST_SCHEMA_VERSION,
    players: state.players.map((entry, index) => ({
      id: `P${index}`,
      cards: entry.cards.length === 0 ? null : [...entry.cards],
    })),
    board: [...state.board],
    deadCards: [...state.dead],
    method,
    samples: options.trials === undefined ? 1000 : options.trials,
    seed: options.seed === undefined ? 12345 : options.seed,
  }, { yieldControl: async () => {} });
  if (result.ok === false) {
    return { result: null, error: result.error, toastMessages: [] };
  }
  return {
    result: result.players.map((entry, index) => ({
      name: state.players[index].name,
      win: entry.winProbability * 100,
      tie: entry.tieProbability * 100,
      equity: entry.equity * 100,
    })),
    exact: result.exact,
    total: result.trials,
    splitRate: result.metadata.splitPotTrials / result.trials * 100,
    toastMessages: [],
  };
}

function renderProductionEquityDeck(state, picker) {
  return logicHarness.renderDeckFor(JSON.parse(JSON.stringify(state)), { ...picker });
}

module.exports = {
  evaluateProduction,
  evaluatePython,
  renderProductionEquityDeck,
  runProductionEquity,
};
