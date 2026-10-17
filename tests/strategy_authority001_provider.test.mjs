import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import {
  STRATEGY_RESULT_SCHEMA_VERSION,
  STRATEGY_SOURCES,
  createStrategyResult,
  isStrategyResultV1,
} from '../app/src/application/strategy-result.mjs';
import {
  STRATEGY_PROVIDER_SCHEMA_VERSION,
  createStrategyProvider,
} from '../app/src/application/strategy-provider.mjs';
import { bootApp, indexDocument, precedes, strategyProviderProbe, text } from './helpers/app-under-test.mjs';

const require = createRequire(import.meta.url);
const qa = require('./qa002_adapters.js');
// TEST-HYGIENE-001: index.html / logic.js assertions are behavioural: the
// app boots with its StrategyProvider bridge instrumented so every page
// resolve is recorded; Playbook, Matrix, Training and analysis flows are run
// and the page's own presentation functions called. Strategy module sources
// are outside this ticket.
const provider = strategyProviderProbe();
const app = await bootApp({ beforeScripts: provider.beforeScripts });
// Imported after boot: the module installs the page's bridge on load.
const { installStrategyProviderBridge } = await import('../app/src/application/strategy-provider-bootstrap.mjs');
const markup = indexDocument();
const trainingGenerator = fs.readFileSync(
  new URL('../app/src/application/training-generator.mjs', import.meta.url),
  'utf8',
);
const analysisExplanation = fs.readFileSync(
  new URL('../app/src/application/analysis-explanation.mjs', import.meta.url),
  'utf8',
);
const heuristicStrategy = fs.readFileSync(
  new URL('../app/src/strategy/heuristic-strategy.mjs', import.meta.url),
  'utf8',
);
const preflopHeuristic = fs.readFileSync(
  new URL('../app/src/strategy/preflop-heuristic.mjs', import.meta.url),
  'utf8',
);
const postflopHeuristic = fs.readFileSync(
  new URL('../app/src/strategy/postflop-heuristic.mjs', import.meta.url),
  'utf8',
);
const heuristicEvaluator = fs.readFileSync(
  new URL('../app/src/strategy/heuristic-evaluator.mjs', import.meta.url),
  'utf8',
);

function context(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Ks'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    callAmountBb: null,
    heroStreetContributionBb: null,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
  };
}

function candidate() {
  return {
    source: STRATEGY_SOURCES.HEURISTIC_PREFLOP,
    actions: [
      { action: { type: 'raise', amountBb: 2.5 }, label: 'Open 2.5bb', value: 70 },
      { action: { type: 'call' }, label: 'Call', value: 20 },
      { action: { type: 'fold' }, label: 'Fold', value: 10 },
      { action: { type: 'check' }, label: 'Check', value: 0 },
    ],
    recommendedLabel: 'OPEN 2.5BB',
  };
}

test('StrategyProvider v1 accepts DecisionContext v1 and owns normalized StrategyResult output', () => {
  let received = null;
  const provider = createStrategyProvider({
    fallbackResolver(decisionContext) {
      received = decisionContext;
      return candidate();
    },
  });
  const decisionContext = context();
  const result = provider.resolve(decisionContext);

  assert.equal(provider.schemaVersion, STRATEGY_PROVIDER_SCHEMA_VERSION);
  assert.equal(provider.resultSchemaVersion, STRATEGY_RESULT_SCHEMA_VERSION);
  assert.equal(received, decisionContext);
  assert.equal(result.schemaVersion, STRATEGY_RESULT_SCHEMA_VERSION);
  assert.equal(result.source, STRATEGY_SOURCES.HEURISTIC_PREFLOP);
  assert.equal(result.actions.length, 3, 'zero-probability entries are consistently omitted');
  assert.deepEqual(result.actions.map((entry) => entry.action.type), ['raise', 'call', 'fold']);
  assert.equal(result.actions.reduce((sum, entry) => sum + entry.probability, 0), 1);
  assert.equal(result.recommendation.action.type, 'raise');
  assert.equal(result.recommendation.action.amountBb, 2.5);
  assert.ok(isStrategyResultV1(result));
  assert.ok(Object.isFrozen(provider));
  assert.ok(Object.isFrozen(result));
});

test('provider is deterministic for deterministic fallback and invalid contexts return valid unavailable results', () => {
  const provider = createStrategyProvider({ fallbackResolver: () => candidate() });
  const first = provider.resolve(context());
  const second = provider.resolve(context());
  assert.deepEqual(second, first);

  for (const invalid of [null, {}, { schemaVersion: 'decision-context/v2' }]) {
    const unavailable = provider.resolve(invalid);
    assert.equal(unavailable.schemaVersion, STRATEGY_RESULT_SCHEMA_VERSION);
    assert.equal(unavailable.source, STRATEGY_SOURCES.UNAVAILABLE);
    assert.deepEqual(unavailable.actions, []);
    assert.equal(unavailable.details.providerReason, 'invalid_decision_context');
    assert.ok(isStrategyResultV1(unavailable));
  }
});

test('production heuristic resolver is deterministic for the same postflop DecisionContext', () => {
  const postflopContext = context({
    street: 'flop',
    heroCards: ['As', 'Kd'],
    board: ['2c', '7d', 'Th'],
    potBb: 6,
    lastAction: 'check',
    facingSizeBb: 0,
  });
  assert.deepEqual(qa.strategyResult(postflopContext), qa.strategyResult(postflopContext));
  assert.doesNotMatch(trainingGenerator, /Math\.random\s*=/);
});

test('StrategyResult has one source vocabulary, one normalization rule, and structured action authority', () => {
  const result = createStrategyResult(candidate());
  assert.deepEqual(Object.values(STRATEGY_SOURCES).sort(), [
    'equity_fallback', 'heuristic_postflop', 'heuristic_preflop', 'unavailable',
  ]);
  assert.deepEqual(result.actions.slice(0, 2).map((entry) => entry.probability), [0.7, 0.2]);
  assert.ok(Math.abs(result.actions[2].probability - 0.1) < 1e-12);
  assert.equal(result.actions.reduce((sum, entry) => sum + entry.probability, 0), 1);
  assert.equal(result.actions[0].action.type, 'raise');
  assert.equal(result.actions[0].label, 'Open 2.5bb');
  assert.throws(() => createStrategyResult({
    source: STRATEGY_SOURCES.HEURISTIC_PREFLOP,
    actions: [{ action: { type: 'invented' }, label: 'Raise', probability: 1 }],
  }), /Unsupported strategy action type/);
});

test('browser bridge is frozen, narrow, and loaded before classic logic', () => {
  const browserWindow = {};
  const bridge = installStrategyProviderBridge(browserWindow);
  assert.equal(browserWindow.RiverlineStrategy, bridge);
  assert.deepEqual(Object.keys(bridge), [
    'schemaVersion',
    'claimPolicySchemaVersion',
    'truthFor',
    'historicalTruth',
    'truthPresentation',
    'summarizeTruth',
    'createProvider',
    'claimsFor',
    'canClaim',
    'sourceDescriptorFor',
  ]);
  assert.ok(Object.isFrozen(bridge));
  assert.deepEqual(
    Object.getOwnPropertyDescriptor(browserWindow, 'RiverlineStrategy'),
    {
      configurable: false,
      enumerable: false,
      value: bridge,
      writable: false,
    },
  );
  const scripts = markup.querySelectorAll('script[src]');
  const bridgeScript = scripts.find((script) => script.getAttribute('src').endsWith('strategy-provider-bootstrap.mjs'));
  const logicScript = scripts.find((script) => script.getAttribute('src').split('?')[0] === 'src/core/logic.js');
  assert.ok(precedes(bridgeScript, logicScript));
});

test('Playbook, Training, and preflop Matrix converge on the same provider boundary', async () => {
  // Playbook: the main update resolves its DecisionContext through the provider.
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const update = await provider.count(() => app.call('updateContext', 'test'));
  assert.ok(update.includes(app.window.app.decisionContext));
  // Training: generation receives the page provider.
  const spy = app.spy(['callTrainingServiceBridge']);
  try {
    await app.training.start('focused');
    const generate = spy.calls.callTrainingServiceBridge.find(([method]) => method === 'generate');
    assert.ok(generate, 'Training generates through the service');
    assert.equal(generate[2].strategyProvider, app.evaluate('strategyProvider'));
  } finally {
    spy.restore();
  }
  assert.match(trainingGenerator, /strategyProvider\.resolve\(decisionContext\)/);
  // Matrix (preflop): one provider resolve per class, each with representative cards.
  await app.navigate('analyze');
  const matrix = await provider.count(() => {
    app.evaluate('app.matrixModel = null');
    app.call('renderChart');
  });
  assert.equal(matrix.length, 169);
  assert.ok(matrix.every((context) => Array.isArray(context.heroCards) && context.heroCards.length === 2));
  for (const name of ['calculatePreflopFallbackStrategy', 'calculateUnifiedPostflopStrategy', 'evaluatePostflopHandStrength', 'normalizedMatrixActions']) {
    assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  }
  // Postflop the provider-backed Matrix is deferred: no cell is resolved.
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['Qh', 'Jh', '2c']);
  const postflop = await provider.count(() => {
    app.evaluate('app.matrixModel = null');
    app.call('renderChart');
  });
  assert.equal(postflop.length, 0);
  assert.equal(text(app.byId('selectedHandPrimary')), 'Range expansion unavailable');
});

test('full three-action preflop mix survives presentation and sums to 100 percent', () => {
  const result = createStrategyResult(candidate());
  const profile = qa.legacyProfileForStrategyResult(result);
  assert.deepEqual(profile.actions.map((entry) => entry.action.type), ['raise', 'call', 'fold']);
  assert.equal(profile.actions.reduce((sum, entry) => sum + entry.value, 0), 100);
  // The page presentation keeps all three actions.
  const presented = app.call('strategyResultPresentationActions', result);
  assert.equal(presented.length, 3);
  assert.equal(presented.reduce((sum, entry) => sum + entry.value, 0), 100);
});

test('provenance remains provider-owned across presentation consumers', async () => {
  const result = createStrategyResult(candidate());
  const profile = qa.legacyProfileForStrategyResult(result);
  assert.equal(profile.source, result.source);
  assert.equal(profile.provenance, result.source);
  assert.doesNotMatch(JSON.stringify(app.call('strategyResultPresentationActions', result)), /MATH FALLBACK|MONTE CARLO|DEEP CFR MODEL|LOCAL TREE/);
  // Matrix provenance summarises the provider's claim policy.
  await app.click('#gtoMode [data-card-set-edit="board"]');
  // Clearing the board applies at once and closes the picker.
  await app.click('#cardSetPickerClear');
  await app.settle(200);
  assert.equal(app.window.app.picker, null, 'Clear closed the picker');
  const spy = app.spy(['strategyPolicySummary', 'strategySourceDisplayLabel']);
  try {
    app.evaluate('app.matrixModel = null');
    app.call('renderChart');
    assert.ok(spy.count('strategyPolicySummary') >= 1);
    assert.ok(text(app.byId('chartSummary')).endsWith(app.call('strategyPolicySummary', app.evaluate('app.matrixModel.claimPolicy'))));
    // A reviewed decision names its source through the provider's label.
    spy.reset();
    await app.startHand(['As', 'Kd']);
    await app.handAction('fold');
    app.call('openCanonicalHandReview');
    const decision = app.window.app.handReview.model?.selectedDecision;
    assert.ok(decision?.strategyResult, 'the reviewed decision carries its strategy result');
    assert.ok(spy.calls.strategySourceDisplayLabel.some(([argument]) => argument === decision.strategyResult));
  } finally {
    spy.restore();
  }
});

test('AnalysisExplanation consumes StrategyResult and never becomes a strategy source', () => {
  assert.match(analysisExplanation, /strategyResult/);
  assert.match(analysisExplanation, /from '\.\/strategy-result\.mjs'/);
  assert.doesNotMatch(analysisExplanation, /strategy-provider|createStrategyProvider|\.resolve\(/);
});

test('production source sweep leaves fallback math only behind the provider seam', async () => {
  // (The logic.js call-site counts are replaced by runtime accounting: every
  // page resolve receives a real DecisionContext, and the analysis renderer
  // never resolves.)
  await app.navigate('analyze');
  const tour = await provider.count(async () => {
    await app.call('updateContext', 'test');
    app.evaluate('app.matrixModel = null');
    app.call('renderChart');
    await app.training.start('focused');
    await app.training.answer();
  });
  assert.ok(tour.length > 0);
  assert.ok(tour.every((context) => context && typeof context === 'object' && context.schemaVersion), 'never resolves a missing context');
  await app.navigate('analyze');
  const analysis = await provider.count(() => {
    app.call('renderPlaybookDecisionAnalysis', app.window.app.decisionContext, app.window.app.strategyResult, app.window.app.playbookResolution);
  });
  assert.equal(analysis.length, 0, 'the analysis renderer consumes the resolved result');
  for (const name of ['actionProfile', 'fallbackStrategyResult', 'calculatePreflopFallbackStrategy', 'calculatePostflopHeuristicStrategy', 'simulateHeuristicEquity']) {
    assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  }
  assert.equal((preflopHeuristic.match(/calculatePreflopFallbackStrategy\(/g) || []).length, 1);
  assert.equal((preflopHeuristic.match(/calculatePreflopFallbackEvaluation\(/g) || []).length, 3);
  assert.equal((postflopHeuristic.match(/calculatePostflopHeuristicStrategy\(/g) || []).length, 1);
  assert.match(heuristicStrategy, /resolveHeuristicStrategy/);
  assert.match(heuristicEvaluator, /from '\.\.\/\.\.\/\.\.\/shared\/poker-domain\/evaluator\.js'/);
  for (const source of [heuristicStrategy, preflopHeuristic, postflopHeuristic, heuristicEvaluator]) {
    assert.doesNotMatch(source, /\b(?:document|window|querySelector|selectedValue|numericValue)\b/);
    assert.doesNotMatch(source, /\bapp\.settings\b|Math\.random\s*=/);
  }
  assert.doesNotMatch(trainingGenerator, /createStrategyResult|normalizeStrategy|fallbackStrategy/);
});
