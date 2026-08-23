const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOGIC_PATH = path.join(REPO_ROOT, 'app', 'src', 'core', 'logic.js');
const HTML_PATH = path.join(REPO_ROOT, 'app', 'index.html');
const STRATEGY_RESULT_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'application', 'strategy-result.mjs',
);
const STRATEGY_SOURCE_AUTHORITY_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'application', 'strategy-source-authority.mjs',
);
const STRATEGY_CLAIM_POLICY_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'application', 'strategy-claim-policy.mjs',
);
const STRATEGY_PROVIDER_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'application', 'strategy-provider.mjs',
);
const HEURISTIC_EVALUATOR_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'strategy', 'heuristic-evaluator.mjs',
);
const PREFLOP_HEURISTIC_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'strategy', 'preflop-heuristic.mjs',
);
const POSTFLOP_HEURISTIC_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'strategy', 'postflop-heuristic.mjs',
);
const HEURISTIC_STRATEGY_PATH = path.join(
  REPO_ROOT, 'app', 'src', 'strategy', 'heuristic-strategy.mjs',
);
const POKER_POSITIONS_PATH = path.join(
  REPO_ROOT, 'shared', 'poker-domain', 'positions.js',
);

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
  const moduleSource = (filePath) => fs.readFileSync(filePath, 'utf8')
    .replace(/import[\s\S]*?from\s+['"][^'"]+['"];\s*/g, '')
    .replaceAll('export ', '');
  const strategySourceAuthoritySource = moduleSource(STRATEGY_SOURCE_AUTHORITY_PATH);
  const strategyClaimPolicySource = moduleSource(STRATEGY_CLAIM_POLICY_PATH);
  const strategyContractSource = moduleSource(STRATEGY_RESULT_PATH);
  const strategyProviderSource = moduleSource(STRATEGY_PROVIDER_PATH);
  const heuristicEvaluatorSource = moduleSource(HEURISTIC_EVALUATOR_PATH);
  const preflopHeuristicSource = moduleSource(PREFLOP_HEURISTIC_PATH);
  const postflopHeuristicSource = moduleSource(POSTFLOP_HEURISTIC_PATH);
  const heuristicStrategySource = moduleSource(HEURISTIC_STRATEGY_PATH);
  const pokerPositionsSource = moduleSource(POKER_POSITIONS_PATH);
  const positions = source.match(/const POSITIONS\s*=\s*\{[\s\S]*?\n\};/);
  const ranks = source.match(/const RANKS\s*=\s*\[[^\n]+\];/);
  const rankValue = source.match(/const RANK_VALUE\s*=\s*\{[^\n]+\};/);
  const fallbackPositions = preflopHeuristicSource.match(/const PREFLOP_FALLBACK_POSITION_MODIFIERS\s*=\s*Object\.freeze\(\{[\s\S]*?\n\}\);/);
  if (!positions || !ranks || !rankValue || !fallbackPositions) throw new Error('Could not extract core constants from logic.js');

  const numericSource = sliceBetween(source, 'function numericValue(id, fallback = 0)', 'function updatePositionSelect(')
    .replace("const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';", '');
  const currentStreetProductionSource = sliceBetween(source, 'function currentStreet(board)', 'function handClass(cards)');
  const currentStreetSource = currentStreetProductionSource
    .replace('function currentStreet(', 'function qaCurrentStreet(');
  const handClassSource = sliceBetween(source, 'function handClass(cards)', 'function numericValue(id, fallback = 0)');
  const updatePositionsSource = sliceBetween(source, 'function updatePositionSelect(', 'function strategyResultPresentationActions(');
  const presentationSource = sliceBetween(source, 'function strategyResultPresentationActions(', 'function readHeuristicOptions(');
  const strategyAuthorityPresentationSource = sliceBetween(
    source,
    'function strategySourceDisplayLabel(',
    'function setRecommendationState(',
  );
  const providerSeamSource = sliceBetween(
    source,
    'function readHeuristicOptions(',
    'function setFrequency(index, action)',
  );
  const fallbackSource = preflopHeuristicSource.slice(
    preflopHeuristicSource.indexOf('function extractPreflopHandFeatures('),
    preflopHeuristicSource.indexOf('function strategyAction('),
  );
  const potSource = sliceBetween(source, 'function preflopBasePot()', 'function updateMetrics()');
  const updateContextSource = sliceBetween(source, 'async function updateContext(reason =', '// Legacy fast evaluator retained for the existing Outs display only.');
  const tableProjectionSource = sliceBetween(
    source,
    'function renderPlaybookTableProjection()',
    'async function updateContext(reason =',
  );
  const sliderSource = sliceBetween(source, 'function syncSliderPair(rangeId, numberId)', 'function bindSliderPair(rangeId, numberId, callback)');
  const evaluatorEquitySource = sliceBetween(
    source,
    '// Static TypedArray buffers for zero-GC hand evaluation in main thread',
    'let equityCalculationGeneration = 0;',
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
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
    dispatchEvent(event) { sandbox.dispatchedState = event.detail; },
  };

  vm.createContext(sandbox);
  vm.runInContext(`
    const ACTION_TYPES = Object.freeze({
      FOLD: 'fold', CHECK: 'check', CALL: 'call', BET: 'bet', RAISE: 'raise', ALL_IN: 'all_in'
    });
    ${pokerPositionsSource}
    const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';
    ${strategySourceAuthoritySource}
    ${strategyContractSource}
    ${strategyClaimPolicySource}
    ${strategyProviderSource}
    ${evaluatorEquitySource}
    const CARD_RANKS = '23456789TJQKA';
    const CARD_SUITS = 'shdc';
    const HAND_CATEGORIES = Object.freeze({
      HIGH_CARD: 'high_card', ONE_PAIR: 'one_pair', TWO_PAIR: 'two_pair',
      THREE_OF_A_KIND: 'three_of_a_kind', STRAIGHT: 'straight', FLUSH: 'flush',
      FULL_HOUSE: 'full_house', FOUR_OF_A_KIND: 'four_of_a_kind',
      STRAIGHT_FLUSH: 'straight_flush'
    });
    const QA_HAND_CATEGORIES = Object.freeze(Object.values(HAND_CATEGORIES));
    function qaRank(cards, score) {
      return {
        score,
        category: QA_HAND_CATEGORIES[Math.floor(score / 1e10)],
        tiebreakers: [],
        bestFiveCards: cards.slice(0, 5)
      };
    }
    function evaluateFive(cards) { return qaRank(cards, scoreFive(cards)); }
    function evaluateSeven(cards) { return qaRank(cards, scoreSeven(cards)); }
    function assertUniqueKnownCards(groups) {
      const seen = new Set();
      for (const group of groups) {
        for (const card of group.cards) {
          if (!/^[2-9TJQKA][shdc]$/.test(card)) throw new TypeError('Invalid card');
          if (seen.has(card)) throw new RangeError('Duplicate known card: ' + card);
          seen.add(card);
        }
      }
      return seen;
    }
    ${heuristicEvaluatorSource}
    ${preflopHeuristicSource}
    ${postflopHeuristicSource}
    ${heuristicStrategySource}
    const RiverlineStrategy = Object.freeze({
      schemaVersion: STRATEGY_PROVIDER_SCHEMA_VERSION,
      claimPolicySchemaVersion: STRATEGY_CLAIM_POLICY_SCHEMA_VERSION,
      createProvider(options = {}) {
        if (typeof options.fallbackResolver === 'function') return createStrategyProvider(options);
        const optionResolver = typeof options.heuristicOptionsResolver === 'function'
          ? options.heuristicOptionsResolver
          : () => ({});
        const translate = typeof options.translate === 'function' ? options.translate : String;
        return createStrategyProvider({
          fallbackResolver: (context) => resolveHeuristicStrategy(
            context,
            optionResolver(context),
            { translate }
          )
        });
      },
      claimsFor(strategyResult) {
        return resolveStrategyClaimPolicy(strategyResult);
      },
      canClaim(strategyResultOrPolicy, claim) {
        return canStrategyClaim(strategyResultOrPolicy, claim);
      },
      sourceDescriptorFor(source) {
        return strategySourceDescriptorFor(source);
      }
    });
    window.RiverlineStrategy = RiverlineStrategy;
    const requireStrategyProviderBridge = () => RiverlineStrategy;
    const requireProductPerformanceBridge = () => ({
      schemaVersion: 'product-performance/v1',
      createLatestFrameScheduler({ run }) {
        let value;
        return {
          schedule(nextValue) { value = nextValue; },
          flush() { const nextValue = value; value = undefined; return run(nextValue); },
          cancel() { value = undefined; },
          isPending() { return value !== undefined; }
        };
      },
      createSurfaceInvalidator({ render }) {
        return {
          mark() {},
          renderIfNeeded(surface) {
            if (surface !== 'table') return false;
            render(surface);
            return true;
          },
          isDirty() { return true; }
        };
      }
    });
    ${positions[0]}
    ${ranks[0]}
    ${rankValue[0]}
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
    let capturedEquityDecisionContext = null;
    function decisionContextToLegacyPostflopContext(context) {
      return {
        board: context.board.slice(), heroCards: context.heroCards.slice(),
        deadCards: context.deadCards.slice(), hero_pos: context.heroPosition,
        villain_pos: ['BTN', 'CO', 'HJ'].includes(context.heroPosition) ? 'BB' : 'SB',
        facingSize: context.facingSizeBb, potSize: context.potBb, stack: context.stackBb
      };
    }
    function calculatePreflopFallbackForDecisionContext(context) {
      const cards = context.heroCards;
      return calculatePreflopFallbackStrategy(
        cards[0][0], cards[1][0], cards[0][0] === cards[1][0], cards[0][1] === cards[1][1],
        context.heroPosition, context.lastAction, context.facingSizeBb, context.potBb,
        context.stackBb, context.callAmountBb, context.tableSize
      );
    }
    function preflopHeuristicCandidate(fallback, presentation = {}) {
      const values = { open: Number(fallback.open) || 0, call: Number(fallback.call) || 0, fold: Number(fallback.fold) || 0 };
      return {
        source: 'heuristic_preflop',
        actions: ['open', 'call', 'fold'].map((key) => ({
          action: { type: key === 'open' ? 'raise' : key, amountBb: null, potFraction: null },
          label: key === 'open' ? 'Open' : key[0].toUpperCase() + key.slice(1),
          value: values[key]
        })),
        recommendedLabel: presentation.recommendedLabel || null,
        explanation: presentation.explanation || null
      };
    }
    function postflopHeuristicCandidate(strategy, presentation = {}) {
      const types = { Bet: 'bet', Check: 'check', Raise: 'raise', Call: 'call', Fold: 'fold' };
      return {
        source: 'heuristic_postflop',
        actions: Object.entries(strategy).filter(([name]) => name !== 'context').map(([name, value]) => ({
          action: { type: types[name], amountBb: null, potFraction: null }, label: name, value
        })),
        recommendedLabel: presentation.recommendedLabel || null,
        explanation: presentation.explanation || null,
        details: strategy.context || null
      };
    }
    ${numericSource}
    ${currentStreetProductionSource}
    ${currentStreetSource}
    ${handClassSource}
    ${updatePositionsSource}
    ${presentationSource}
    ${strategyAuthorityPresentationSource}
    ${potSource}
    ${sliderSource}
    ${providerSeamSource}
    ${tableProjectionSource}
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
      strategyActionFromLegacyLabel,
      createStrategyResult,
      preflopHeuristicCandidate,
      postflopHeuristicCandidate,
      createUnavailableStrategyResult,
      strategyResultToLegacyProfile,
      strategyProfile(context) {
        app.decisionContext = null;
        return strategyResultToLegacyProfile(strategyProvider.resolve(context));
      },
      strategyResult(context) {
        app.decisionContext = null;
        return strategyProvider.resolve(context);
      },
      strategyProfileCapture(context) {
        capturedEquityDecisionContext = context.street === 'preflop' ? null : context;
        const profile = this.strategyProfile(context);
        return { profile, equityDecisionContext: capturedEquityDecisionContext };
      },
      fallbackStrategyProfile(context, reason = 'Heuristic fallback') {
        app.decisionContext = null;
        return strategyResultToLegacyProfile(strategyProvider.resolve(context));
      },
      fallbackStrategyResult(context, reason = 'Heuristic fallback') {
        app.decisionContext = null;
        return strategyProvider.resolve(context);
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
        return calculatePostflopStrategyFromSample({
          schemaVersion: 'decision-context/v1', tableSize: 6, heroPosition: 'BTN',
          street: 'flop', heroCards: ['As', 'Kd'], board: ['2c', '7d', '9h'],
          deadCards: [], stackBb: 30, stackMode: 'hero', potBb: 10,
          lastAction: 'check', facingSizeBb: 0, callAmountBb: 0,
          heroStreetContributionBb: null, rakeMode: 'off',
          forcedContributionPerPlayerBb: 0, totalForcedContributionBb: 0
        }, { playStyle: 0, opponentStyle: 0, flatDropBb: drop }, { eq: equity, pct: 0.15 });
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
  structuralAction: (...args) => plain(harness.strategyActionFromLegacyLabel(...args)),
  createStrategyResult: (...args) => plain(harness.createStrategyResult(...args)),
  preflopStrategyResult: (...args) => plain(harness.createStrategyResult(harness.preflopHeuristicCandidate(...args))),
  postflopStrategyResult: (...args) => plain(harness.createStrategyResult(harness.postflopHeuristicCandidate(...args))),
  unavailableStrategyResult: (...args) => plain(harness.createUnavailableStrategyResult(...args)),
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
