import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES,
  STRATEGY_ACTION_SIZING_CAPABILITIES,
  STRATEGY_COVERAGE_KINDS,
  STRATEGY_GRADING_CAPABILITIES,
  STRATEGY_SOURCE_AUTHORITIES,
  STRATEGY_SOURCE_FAMILIES,
  createStrategyContextCoverage,
  createStrategySourceDescriptor,
  heuristicContextLimitationCodes,
} from '../app/src/application/strategy-source-authority.mjs';
import {
  STRATEGY_CLAIMS,
  canStrategyClaim,
  resolveStrategyClaimPolicy,
} from '../app/src/application/strategy-claim-policy.mjs';
import {
  createStrategyResult,
  createUnavailableStrategyResult,
} from '../app/src/application/strategy-result.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const translationsSource = fs.readFileSync(
  new URL('../app/src/locales/product-translations.js', import.meta.url),
  'utf8',
);

function context(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    opponentCount: 5,
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

function descriptor({
  id = 'validated_hu_100bb_test',
  authority = STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE,
  actionDistribution = STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.EXACT,
  actionSizing = STRATEGY_ACTION_SIZING_CAPABILITIES.NONE,
  actionEv = false,
  grading = STRATEGY_GRADING_CAPABILITIES.NORMATIVE,
  optimality = false,
} = {}) {
  return createStrategySourceDescriptor({
    id,
    version: `${id}/v1`,
    displayName: 'Validated HU 100bb test reference',
    family: authority === STRATEGY_SOURCE_AUTHORITIES.PERSONAL
      ? STRATEGY_SOURCE_FAMILIES.PERSONAL
      : STRATEGY_SOURCE_FAMILIES.REFERENCE_PACK,
    authority,
    capabilities: {
      actionDistribution,
      actionSizing,
      actionEv,
      grading,
      optimality,
    },
    defaultCoverage: STRATEGY_COVERAGE_KINDS.UNSUPPORTED,
  });
}

function resultFor(sourceDescriptor, coverageKind, options = {}) {
  return createStrategyResult({
    source: sourceDescriptor.id,
    sourceDescriptor,
    contextCoverage: createStrategyContextCoverage({
      kind: coverageKind,
      basis: 'test_fixture',
    }),
    actions: options.actions || [
      { action: { type: 'raise', amountBb: options.amountBb ?? null }, label: 'Raise', probability: 0.6, evBb: options.raiseEvBb },
      { action: { type: 'call' }, label: 'Call', probability: 0.3, evBb: options.callEvBb },
      { action: { type: 'fold' }, label: 'Fold', probability: 0.1, evBb: options.foldEvBb },
    ],
  });
}

test('heuristic authority permits comparison but never objective or exact claims', () => {
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const result = provider.resolve(context());
  const policy = resolveStrategyClaimPolicy(result);

  assert.equal(policy.mode, 'comparative');
  assert.equal(policy.coverage.kind, STRATEGY_COVERAGE_KINDS.GENERALIZED);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.REFERENCE_MATCH), true);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.REFERENCE_DEVIATION), true);
  for (const forbidden of [
    STRATEGY_CLAIMS.OBJECTIVE_CORRECTNESS,
    STRATEGY_CLAIMS.MISTAKE,
    STRATEGY_CLAIMS.ACCURACY,
    STRATEGY_CLAIMS.OPTIMALITY,
    STRATEGY_CLAIMS.EXACT_FREQUENCIES,
    STRATEGY_CLAIMS.EV_LOSS,
    STRATEGY_CLAIMS.NORMATIVE_CURRICULUM_WEIGHTING,
  ]) {
    assert.equal(canStrategyClaim(policy, forbidden), false, forbidden);
  }
});

test('coverage gates claims and an exact validated descriptor upgrades consumers without special cases', () => {
  const sourceDescriptor = descriptor();
  const exactPolicy = resolveStrategyClaimPolicy(resultFor(
    sourceDescriptor,
    STRATEGY_COVERAGE_KINDS.EXACT,
  ));
  const generalizedPolicy = resolveStrategyClaimPolicy(resultFor(
    sourceDescriptor,
    STRATEGY_COVERAGE_KINDS.GENERALIZED,
  ));
  const unsupportedPolicy = resolveStrategyClaimPolicy(resultFor(
    sourceDescriptor,
    STRATEGY_COVERAGE_KINDS.UNSUPPORTED,
  ));

  assert.equal(exactPolicy.mode, 'normative');
  assert.equal(canStrategyClaim(exactPolicy, STRATEGY_CLAIMS.OBJECTIVE_CORRECTNESS), true);
  assert.equal(canStrategyClaim(exactPolicy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), true);
  assert.equal(canStrategyClaim(exactPolicy, STRATEGY_CLAIMS.OPTIMALITY), false);

  assert.equal(generalizedPolicy.mode, 'comparative');
  assert.equal(canStrategyClaim(generalizedPolicy, STRATEGY_CLAIMS.REFERENCE_MATCH), true);
  assert.equal(canStrategyClaim(generalizedPolicy, STRATEGY_CLAIMS.OBJECTIVE_CORRECTNESS), false);
  assert.equal(canStrategyClaim(generalizedPolicy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), false);

  assert.equal(unsupportedPolicy.availability, 'unavailable');
  assert.equal(canStrategyClaim(unsupportedPolicy, STRATEGY_CLAIMS.STRATEGY_PRESENTATION), false);
  assert.equal(canStrategyClaim(unsupportedPolicy, STRATEGY_CLAIMS.RECOMMENDATION), false);
  assert.equal(unsupportedPolicy.primaryLimitation.code, 'context_unsupported');

  const unavailablePolicy = resolveStrategyClaimPolicy(createUnavailableStrategyResult());
  assert.equal(canStrategyClaim(unavailablePolicy, STRATEGY_CLAIMS.STRATEGY_PRESENTATION), false);
});

test('distribution, sizing, EV, and normative authority remain independent capabilities', () => {
  const personalDescriptor = descriptor({
    id: 'personal_strategy_test',
    authority: STRATEGY_SOURCE_AUTHORITIES.PERSONAL,
    grading: STRATEGY_GRADING_CAPABILITIES.NONE,
  });
  const personalPolicy = resolveStrategyClaimPolicy(resultFor(
    personalDescriptor,
    STRATEGY_COVERAGE_KINDS.EXACT,
  ));
  assert.equal(canStrategyClaim(personalPolicy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), true);
  assert.equal(canStrategyClaim(personalPolicy, STRATEGY_CLAIMS.NORMATIVE_GRADING), false);
  assert.equal(canStrategyClaim(personalPolicy, STRATEGY_CLAIMS.RECOMMENDATION), false);

  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const postflop = provider.resolve(context({
    street: 'flop',
    board: ['2c', '7d', 'Th'],
    potBb: 6,
    lastAction: 'bet',
    facingSizeBb: 3,
    callAmountBb: 3,
  }));
  const postflopPolicy = resolveStrategyClaimPolicy(postflop);
  assert.equal(postflop.capabilities.actionSizing, STRATEGY_ACTION_SIZING_CAPABILITIES.NONE);
  assert.equal(canStrategyClaim(postflopPolicy, STRATEGY_CLAIMS.ACTION_SIZING), false);
  assert.equal(canStrategyClaim(postflopPolicy, STRATEGY_CLAIMS.ACTION_EV), false);
  assert.equal(canStrategyClaim(postflopPolicy, STRATEGY_CLAIMS.EV_LOSS), false);

  const evDescriptor = descriptor({ id: 'validated_ev_test', actionEv: true });
  const evResult = resultFor(evDescriptor, STRATEGY_COVERAGE_KINDS.EXACT, {
    raiseEvBb: 1.2,
    callEvBb: 0.7,
    foldEvBb: 0,
  });
  const evPolicy = resolveStrategyClaimPolicy(evResult);
  assert.equal(canStrategyClaim(evPolicy, STRATEGY_CLAIMS.ACTION_EV), true);
  assert.equal(canStrategyClaim(evPolicy, STRATEGY_CLAIMS.EV_LOSS), true);
});

test('high-risk heuristic contexts use one structured limitation-code path', () => {
  const cases = [
    [context({ heroPosition: 'BB', lastAction: 'check', callAmountBb: 0 }), 'heuristic_limp_context_coarse'],
    [context({ lastAction: '3bet', facingSizeBb: 9, callAmountBb: 6 }), 'heuristic_facing_3bet_coarse'],
    [context({ lastAction: '4bet', facingSizeBb: 22, callAmountBb: 13 }), 'heuristic_facing_4bet_coarse'],
    [context({ street: 'flop', board: ['2c', '7d', 'Th'], lastAction: 'check', callAmountBb: 0 }), 'heuristic_postflop_position_ignored'],
    [context({ street: 'flop', board: ['2c', '7d', 'Th'], lastAction: 'bet', facingSizeBb: 4, callAmountBb: 4 }), 'heuristic_postflop_facing_wager_coarse'],
    [context({ street: 'flop', board: ['2c', '7d', 'Th'], lastAction: 'raise', facingSizeBb: 8, callAmountBb: 5 }), 'heuristic_postflop_facing_raise_coarse'],
    [context({ street: 'turn', board: ['2c', '7d', 'Th', 'Js'], opponentCount: 2 }), 'heuristic_postflop_multiway_coarse'],
    [context({ street: 'river', board: ['2c', '7d', 'Th', 'Js', 'Qh'], lastAction: 'bet', facingSizeBb: 8, callAmountBb: null }), 'heuristic_exact_call_price_unavailable'],
  ];
  for (const [decisionContext, expectedCode] of cases) {
    assert.ok(heuristicContextLimitationCodes(decisionContext).includes(expectedCode), expectedCode);
  }
  assert.equal(
    heuristicContextLimitationCodes(context({ tableSize: 2, opponentCount: 1 }))
      .includes('heuristic_hu_rfi_shared_baseline'),
    false,
  );
  assert.equal(
    heuristicContextLimitationCodes(context({ heroPosition: 'UTG' }))
      .includes('heuristic_six_max_first_position_coarse'),
    false,
  );
});

test('Training grading mathematics and heuristic action probabilities are unchanged', () => {
  const sourceDescriptor = descriptor({
    id: 'grading_math_test',
    authority: STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE,
    actionDistribution: STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.QUANTITATIVE,
    grading: STRATEGY_GRADING_CAPABILITIES.COMPARATIVE,
  });
  const gradingResult = resultFor(sourceDescriptor, STRATEGY_COVERAGE_KINDS.GENERALIZED, {
    actions: [
      { action: { type: 'raise' }, label: 'Raise', probability: 60 },
      { action: { type: 'call' }, label: 'Call', probability: 50 },
      { action: { type: 'fold' }, label: 'Fold', probability: 30 },
    ],
  });
  const grades = ['raise', 'call', 'fold'].map((chosenActionType) => evaluateTrainingAnswer({
    exerciseId: `grading-${chosenActionType}`,
    chosenActionType,
    strategyResult: gradingResult,
  }));
  assert.deepEqual(grades.map((entry) => entry.grade), ['optimal', 'acceptable', 'mistake']);
  assert.deepEqual(grades.map((entry) => entry.accepted), [true, true, false]);
  assert.deepEqual(grades.map((entry) => entry.scoreDelta), [1, 1, 0]);

  const decisionContext = context();
  const candidate = resolveHeuristicStrategy(decisionContext);
  const providerResult = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy })
    .resolve(decisionContext);
  const positiveCandidateActions = candidate.actions.filter((entry) => Number(entry.value) > 0);
  const total = positiveCandidateActions.reduce((sum, entry) => sum + Number(entry.value), 0);
  assert.deepEqual(
    providerResult.actions.map((entry) => ({ type: entry.action.type, label: entry.label })),
    positiveCandidateActions.map((entry) => ({ type: entry.action.type, label: entry.label })),
  );
  providerResult.actions.forEach((entry, index) => {
    assert.equal(entry.probability, Number(positiveCandidateActions[index].value) / total);
  });
});

test('Analysis, Training, and Matrix consume structured policy without adding authorities', () => {
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const decisionContext = context({ lastAction: '3bet', facingSizeBb: 9, callAmountBb: 6 });
  const strategyResult = provider.resolve(decisionContext);
  const explanation = createAnalysisExplanation({ decisionContext, strategyResult });
  assert.equal(explanation.claimPolicy.mode, 'comparative');
  assert.equal(explanation.provenance.authority, STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE);
  assert.ok(explanation.warnings.some((entry) => (
    entry.code === 'heuristic_facing_3bet_coarse'
  )));

  const trainingMarkup = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
  assert.match(trainingMarkup, /id="trainingSourceLimitation"[^>]*hidden/);
  assert.match(trainingMarkup, /id="trainingAnalysis"[^>]*hidden/);
  const preAnswerSource = logic.slice(
    logic.indexOf('function renderTrainingSource('),
    logic.indexOf('function renderTrainingGenerationError('),
  );
  assert.doesNotMatch(preAnswerSource, /\.actions|recommendation|probability/);
  const answerHandler = logic.slice(
    logic.indexOf('function handleTrainingGuess('),
    logic.indexOf('function bindTrainingSizingControl('),
  );
  assert.match(answerHandler, /renderTrainingDecisionAnalysis\(exercise\)/);

  const analysisRender = logic.slice(
    logic.indexOf('async function updateContext('),
    logic.indexOf('// Legacy fast evaluator retained for the existing Outs display only.'),
  );
  assert.match(analysisRender, /strategyClaimPolicy\(strategyResult\)/);
  assert.match(analysisRender, /strategySourceDisplayLabel\(strategyResult\)/);

  const matrixRender = logic.slice(
    logic.indexOf('function renderChart('),
    logic.indexOf('function visualActionKind('),
  );
  assert.match(matrixRender, /strategyProvider\.resolve\(cellDecisionContext\)/);
  assert.match(matrixRender, /strategyClaimPolicy\(cellStrategyResult\)/);
  assert.doesNotMatch(matrixRender, /STRATEGY_SOURCE_AUTHORITIES|createStrategySourceDescriptor/);
});

test('new comparative semantics have complete EN/RU/HE catalog entries', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(translationsSource, sandbox);
  const catalog = sandbox.window.riverlineProductTranslations;
  const keys = [
    'Matches Riverline reference',
    'Close to Riverline reference',
    'Differs from Riverline reference',
    'Reference-aligned',
    'Alignment rate',
    'Broad approximate coverage',
    'Useful for comparison and exploration; this source does not prove optimal play.',
    'This source does not cover the current decision context.',
  ];
  for (const language of ['en', 'ru', 'he']) {
    for (const key of keys) {
      assert.equal(typeof catalog[language][key], 'string', `${language}: ${key}`);
      assert.ok(catalog[language][key].length > 0, `${language}: ${key}`);
    }
  }
});
