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
import { installStrategyProviderBridge } from '../app/src/application/strategy-provider-bootstrap.mjs';

const require = createRequire(import.meta.url);
const qa = require('./qa002_adapters.js');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
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
  assert.deepEqual(Object.keys(bridge), ['schemaVersion', 'createProvider']);
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
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('strategy-provider-bootstrap.mjs') < html.indexOf('src/core/logic.js'));
});

test('Playbook, Training, and preflop Matrix converge on the same provider boundary', () => {
  const update = logic.slice(
    logic.indexOf('async function updateContext('),
    logic.indexOf('// Legacy fast evaluator retained for the existing Outs display only.'),
  );
  const matrix = logic.slice(
    logic.indexOf('function renderChart()'),
    logic.indexOf('function visualActionKind('),
  );
  const training = logic.slice(
    logic.indexOf('async function newRandomTrainingHand('),
    logic.indexOf('function canonicalTrainingFeedback('),
  );

  assert.match(update, /strategyProvider\.resolve\(decisionContext\)/);
  assert.match(training, /callTrainingServiceBridge\('generate', config, \{ strategyProvider \}\)/);
  assert.match(trainingGenerator, /strategyProvider\.resolve\(decisionContext\)/);
  assert.match(matrix, /strategyProvider\.resolve\(cellDecisionContext\)/);
  assert.match(matrix, /heroCards: representativeCards/);
  assert.doesNotMatch(matrix, /calculatePreflopFallbackStrategy|calculateUnifiedPostflopStrategy|evaluatePostflopHandStrength/);
  assert.doesNotMatch(matrix, /normalizedMatrixActions|openVal|callVal|foldVal/);
  assert.match(matrix, /provider-backed postflop Matrix deferred/);
});

test('full three-action preflop mix survives presentation and sums to 100 percent', () => {
  const result = createStrategyResult(candidate());
  const profile = qa.legacyProfileForStrategyResult(result);
  assert.deepEqual(profile.actions.map((entry) => entry.action.type), ['raise', 'call', 'fold']);
  assert.equal(profile.actions.reduce((sum, entry) => sum + entry.value, 0), 100);
  assert.doesNotMatch(logic, /actions\s*=\s*actions\.slice\(0,\s*2\)/);
});

test('provenance remains provider-owned across presentation consumers', () => {
  const result = createStrategyResult(candidate());
  const profile = qa.legacyProfileForStrategyResult(result);
  assert.equal(profile.source, result.source);
  assert.equal(profile.provenance, result.source);
  const strategyPresentation = logic.slice(
    logic.indexOf('function strategyResultPresentationActions('),
    logic.indexOf('// evaluateHand removed'),
  );
  assert.doesNotMatch(strategyPresentation, /MATH FALLBACK|MONTE CARLO|DEEP CFR MODEL|LOCAL TREE/);
  assert.match(logic, /exercise\?\.strategyResult\?\.source/);
  assert.match(logic, /strategySourceDisplayLabel\(matrixSource\)/);
});

test('AnalysisExplanation consumes StrategyResult and never becomes a strategy source', () => {
  assert.match(analysisExplanation, /strategyResult/);
  assert.match(analysisExplanation, /from '\.\/strategy-result\.mjs'/);
  assert.doesNotMatch(analysisExplanation, /strategy-provider|createStrategyProvider|\.resolve\(/);
});

test('production source sweep leaves fallback math only behind the provider seam', () => {
  assert.equal((logic.match(/strategyProvider\.resolve\(/g) || []).length, 4);
  const analysisRender = logic.slice(
    logic.indexOf('function renderDecisionAnalysis('),
    logic.indexOf('function renderPlaybookTableProjection('),
  );
  assert.doesNotMatch(analysisRender, /strategyProvider\.resolve\(/);
  assert.doesNotMatch(logic, /\bactionProfile\s*\(/);
  assert.doesNotMatch(logic, /\bfallbackStrategyResult\s*\(/);
  assert.doesNotMatch(logic, /calculatePreflopFallbackStrategy|calculatePostflopHeuristicStrategy|simulateHeuristicEquity/);
  assert.equal((preflopHeuristic.match(/calculatePreflopFallbackStrategy\(/g) || []).length, 2);
  assert.equal((postflopHeuristic.match(/calculatePostflopHeuristicStrategy\(/g) || []).length, 1);
  assert.match(heuristicStrategy, /resolveHeuristicStrategy/);
  assert.match(heuristicEvaluator, /from '\.\.\/\.\.\/\.\.\/shared\/poker-domain\/evaluator\.js'/);
  assert.equal((logic.match(/strategyResultToLegacyProfile\(/g) || []).length, 3);
  for (const source of [heuristicStrategy, preflopHeuristic, postflopHeuristic, heuristicEvaluator]) {
    assert.doesNotMatch(source, /\b(?:document|window|querySelector|selectedValue|numericValue)\b/);
    assert.doesNotMatch(source, /\bapp\.settings\b|Math\.random\s*=/);
  }
  assert.doesNotMatch(trainingGenerator, /createStrategyResult|normalizeStrategy|fallbackStrategy/);
});
