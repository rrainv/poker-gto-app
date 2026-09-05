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
  createStrategySourceAcceptanceRegistry,
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
  family = null,
  version = null,
} = {}) {
  return createStrategySourceDescriptor({
    id,
    version: version ?? `${id}/v1`,
    displayName: 'Validated HU 100bb test reference',
    family: family ?? (authority === STRATEGY_SOURCE_AUTHORITIES.PERSONAL
      ? STRATEGY_SOURCE_FAMILIES.PERSONAL
      : STRATEGY_SOURCE_FAMILIES.REFERENCE_PACK),
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
  const fingerprint = options.fingerprint ?? `${sourceDescriptor.id}-test-fingerprint`;
  const sourceAcceptance = options.accepted === false ? null : options.sourceAcceptance
    ?? createStrategySourceAcceptanceRegistry([{
      sourceId: sourceDescriptor.id,
      allowedFamily: sourceDescriptor.family,
      acceptedAuthority: sourceDescriptor.authority,
      acceptedCapabilities: sourceDescriptor.capabilities,
      acceptedCoverageCeiling: STRATEGY_COVERAGE_KINDS.EXACT,
      validationStatus: 'explicit_test_acceptance',
      acceptedVersion: sourceDescriptor.version,
      acceptedFingerprint: sourceDescriptor.family === STRATEGY_SOURCE_FAMILIES.REFERENCE_PACK
        ? fingerprint
        : null,
    }]).acceptanceFor(
      sourceDescriptor,
      sourceDescriptor.family === STRATEGY_SOURCE_FAMILIES.REFERENCE_PACK
        ? fingerprint
        : null,
    );
  return createStrategyResult({
    source: sourceDescriptor.id,
    sourceDescriptor,
    sourceAcceptance,
    provenance: { contentHash: fingerprint },
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

test('self-declared validated metadata cannot grant strong Riverline authority', () => {
  const malicious = descriptor({
    id: 'untrusted.learned',
    optimality: true,
    family: STRATEGY_SOURCE_FAMILIES.LEARNED,
  });
  const result = resultFor(malicious, STRATEGY_COVERAGE_KINDS.EXACT, { accepted: false });
  const policy = resolveStrategyClaimPolicy(result);

  assert.equal(policy.authority, STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY);
  assert.equal(policy.mode, 'exploratory');
  assert.equal(policy.coverage.kind, STRATEGY_COVERAGE_KINDS.GENERALIZED);
  assert.equal(policy.sourceAuthoritySnapshot, null);
  for (const claim of [
    STRATEGY_CLAIMS.NORMATIVE_GRADING,
    STRATEGY_CLAIMS.OBJECTIVE_CORRECTNESS,
    STRATEGY_CLAIMS.OPTIMALITY,
    STRATEGY_CLAIMS.EXACT_FREQUENCIES,
    STRATEGY_CLAIMS.ACTION_EV,
    STRATEGY_CLAIMS.NORMATIVE_CURRICULUM_WEIGHTING,
  ]) assert.equal(canStrategyClaim(policy, claim), false, claim);
});

test('unknown provider metadata and schema-shaped acceptance remain untrusted until registered', () => {
  const malicious = descriptor({
    id: 'untrusted.provider',
    optimality: true,
    family: STRATEGY_SOURCE_FAMILIES.LEARNED,
  });
  const provider = createStrategyProvider({
    fallbackResolver: () => ({
      source: malicious.id,
      sourceDescriptor: malicious,
      sourceAcceptance: {
        schemaVersion: 'strategy-source-acceptance-record/v1',
        sourceId: malicious.id,
        acceptedAuthority: STRATEGY_SOURCE_AUTHORITIES.VALIDATED_REFERENCE,
      },
      contextCoverage: createStrategyContextCoverage({ kind: STRATEGY_COVERAGE_KINDS.EXACT }),
      actions: [{ action: { type: 'raise' }, probability: 1 }],
    }),
  });
  const result = provider.resolve(context());
  const policy = resolveStrategyClaimPolicy(result);

  assert.equal(result.source, malicious.id);
  assert.equal(result.sourceAuthoritySnapshot, null);
  assert.equal(policy.mode, 'exploratory');
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.NORMATIVE_GRADING), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.OPTIMALITY), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), false);
});

test('explicit acceptance cannot be exceeded by a future provider declaration', () => {
  const future = descriptor({
    id: 'future.learned',
    optimality: true,
    family: STRATEGY_SOURCE_FAMILIES.LEARNED,
  });
  const registry = createStrategySourceAcceptanceRegistry([{
    sourceId: future.id,
    allowedFamily: future.family,
    acceptedAuthority: STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE,
    acceptedCapabilities: {
      actionDistribution: STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.QUANTITATIVE,
      grading: STRATEGY_GRADING_CAPABILITIES.COMPARATIVE,
    },
    acceptedCoverageCeiling: STRATEGY_COVERAGE_KINDS.GENERALIZED,
    validationStatus: 'bounded_future_test_acceptance',
    acceptedVersion: future.version,
  }]);
  const provider = createStrategyProvider({
    sourceAcceptanceRegistry: registry,
    fallbackResolver: () => ({
      source: future.id,
      sourceDescriptor: future,
      contextCoverage: createStrategyContextCoverage({ kind: STRATEGY_COVERAGE_KINDS.EXACT }),
      actions: [
        { action: { type: 'raise' }, probability: 0.7 },
        { action: { type: 'fold' }, probability: 0.3 },
      ],
    }),
  });
  const policy = resolveStrategyClaimPolicy(provider.resolve(context()));

  assert.equal(policy.authority, STRATEGY_SOURCE_AUTHORITIES.COMPARATIVE_REFERENCE);
  assert.equal(policy.coverage.kind, STRATEGY_COVERAGE_KINDS.GENERALIZED);
  assert.equal(policy.mode, 'exploratory');
  assert.equal(policy.capabilities.actionDistribution, 'quantitative');
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.NORMATIVE_GRADING), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.OPTIMALITY), false);
});

test('acceptance is not reusable across source, version, fingerprint, or registry revocation', () => {
  const sourceA = descriptor({ id: 'accepted.source-a' });
  const fingerprint = 'source-a-fingerprint';
  const registry = createStrategySourceAcceptanceRegistry([{
    sourceId: sourceA.id,
    allowedFamily: sourceA.family,
    acceptedAuthority: sourceA.authority,
    acceptedCapabilities: sourceA.capabilities,
    acceptedCoverageCeiling: STRATEGY_COVERAGE_KINDS.EXACT,
    validationStatus: 'accepted_test_reference',
    acceptanceDecisionId: 'accept-source-a-v1',
    acceptedVersion: sourceA.version,
    acceptedFingerprint: fingerprint,
  }]);
  const candidateFor = (sourceDescriptor, contentHash) => ({
    source: sourceDescriptor.id,
    sourceDescriptor,
    provenance: { contentHash },
    contextCoverage: createStrategyContextCoverage({ kind: STRATEGY_COVERAGE_KINDS.EXACT }),
    actions: [
      { action: { type: 'raise' }, probability: 0.7 },
      { action: { type: 'fold' }, probability: 0.3 },
    ],
  });
  const resolve = (sourceDescriptor, contentHash, activeRegistry = registry) => (
    createStrategyProvider({
      sourceAcceptanceRegistry: activeRegistry,
      fallbackResolver: () => candidateFor(sourceDescriptor, contentHash),
    }).resolve(context())
  );

  assert.equal(resolveStrategyClaimPolicy(resolve(sourceA, fingerprint)).mode, 'comparative');
  const rejected = [
    resolve(descriptor({ id: 'accepted.source-b' }), fingerprint),
    resolve(descriptor({ id: sourceA.id, version: `${sourceA.id}/v2` }), fingerprint),
    resolve(sourceA, 'wrong-fingerprint'),
    resolve(sourceA, fingerprint, null),
  ];
  for (const result of rejected) {
    assert.equal(result.sourceAuthoritySnapshot, null);
    assert.equal(resolveStrategyClaimPolicy(result).mode, 'exploratory');
  }
});

test('strong reference acceptance rejects wildcard version or fingerprint', () => {
  const sourceDescriptor = descriptor({ id: 'wildcard.reference' });
  const base = {
    sourceId: sourceDescriptor.id,
    allowedFamily: sourceDescriptor.family,
    acceptedAuthority: sourceDescriptor.authority,
    acceptedCapabilities: sourceDescriptor.capabilities,
    acceptedCoverageCeiling: STRATEGY_COVERAGE_KINDS.EXACT,
    validationStatus: 'invalid_wildcard_test',
  };
  assert.throws(
    () => createStrategySourceAcceptanceRegistry([{ ...base, acceptedFingerprint: 'fingerprint' }]),
    /requires exact version and fingerprint/,
  );
  assert.throws(
    () => createStrategySourceAcceptanceRegistry([{ ...base, acceptedVersion: sourceDescriptor.version }]),
    /requires exact version and fingerprint/,
  );
});

test('accepted exact or normative distributions fail closed instead of normalizing', () => {
  const acceptedDescriptor = descriptor({ id: 'accepted.exact.test' });
  const acceptance = createStrategySourceAcceptanceRegistry([{
    sourceId: acceptedDescriptor.id,
    allowedFamily: acceptedDescriptor.family,
    acceptedAuthority: acceptedDescriptor.authority,
    acceptedCapabilities: acceptedDescriptor.capabilities,
    acceptedCoverageCeiling: STRATEGY_COVERAGE_KINDS.EXACT,
    validationStatus: 'explicit_test_acceptance',
    acceptedVersion: acceptedDescriptor.version,
    acceptedFingerprint: 'accepted-exact-test-fingerprint',
  }]).acceptanceFor(acceptedDescriptor, 'accepted-exact-test-fingerprint');
  const createMalformed = (probabilities) => () => createStrategyResult({
    source: acceptedDescriptor.id,
    sourceDescriptor: acceptedDescriptor,
    sourceAcceptance: acceptance,
    provenance: { contentHash: 'accepted-exact-test-fingerprint' },
    contextCoverage: createStrategyContextCoverage({ kind: STRATEGY_COVERAGE_KINDS.EXACT }),
    actions: probabilities.map((probability, index) => ({
      action: { type: index === 0 ? 'raise' : 'fold' },
      probability,
    })),
  });

  assert.throws(createMalformed([-0.1, 1.1]), /must be finite values/);
  assert.throws(createMalformed([Number.NaN, 1]), /must be finite values/);
  assert.throws(createMalformed([Number.POSITIVE_INFINITY, 0]), /must be finite values/);
  assert.throws(createMalformed(['0.5', 0.5]), /must be finite values/);
  assert.throws(createMalformed([60, 30, 10]), /must be finite values/);
  assert.throws(createMalformed([0.7, 0.4]), /probability mass must equal 1/);
  assert.throws(createMalformed([0.4, 0.4]), /probability mass must equal 1/);
});

test('opaque live acceptance is not cloned while durable authority evidence remains readable', () => {
  const sourceDescriptor = descriptor({ id: 'clone.persistence.reference' });
  const liveResult = resultFor(sourceDescriptor, STRATEGY_COVERAGE_KINDS.EXACT);
  const livePolicy = resolveStrategyClaimPolicy(liveResult);
  const persistedResult = structuredClone(liveResult);
  const recomputedPolicy = resolveStrategyClaimPolicy(persistedResult);

  assert.equal(Object.hasOwn(liveResult, 'sourceAcceptance'), false);
  assert.equal(livePolicy.mode, 'comparative');
  assert.equal(liveResult.sourceAuthoritySnapshot.sourceId, sourceDescriptor.id);
  assert.equal(liveResult.sourceAuthoritySnapshot.sourceVersion, sourceDescriptor.version);
  assert.equal(liveResult.sourceAuthoritySnapshot.acceptedAuthority, 'validated_reference');
  assert.equal(liveResult.sourceAuthoritySnapshot.acceptedCoverage, 'exact');
  assert.deepEqual(persistedResult.sourceAuthoritySnapshot, liveResult.sourceAuthoritySnapshot);
  assert.equal(recomputedPolicy.mode, 'exploratory');
  assert.equal(recomputedPolicy.sourceAuthoritySnapshot.sourceId, sourceDescriptor.id);
});

test('heuristic authority permits comparison but never objective or exact claims', () => {
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const result = provider.resolve(context());
  const policy = resolveStrategyClaimPolicy(result);

  assert.equal(policy.mode, 'exploratory');
  assert.equal(policy.coverage.kind, STRATEGY_COVERAGE_KINDS.GENERALIZED);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.REFERENCE_MATCH), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.REFERENCE_DEVIATION), false);
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

test('equity fallback remains exploratory information rather than strategy authority', () => {
  const result = createStrategyResult({
    source: 'equity_fallback',
    actions: [
      { action: { type: 'call' }, probability: 0.55 },
      { action: { type: 'fold' }, probability: 0.45 },
    ],
  });
  const policy = resolveStrategyClaimPolicy(result);

  assert.equal(policy.authority, STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY);
  assert.equal(policy.mode, 'exploratory');
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.STRATEGY_PRESENTATION), true);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.REFERENCE_MATCH), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.NORMATIVE_GRADING), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), false);
  assert.equal(canStrategyClaim(policy, STRATEGY_CLAIMS.ACTION_EV), false);
});

test('exact accepted source grants reference comparison but requires a separate assessment policy', () => {
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

  assert.equal(exactPolicy.mode, 'comparative');
  assert.equal(canStrategyClaim(exactPolicy, STRATEGY_CLAIMS.OBJECTIVE_CORRECTNESS), false);
  assert.equal(canStrategyClaim(exactPolicy, STRATEGY_CLAIMS.EXACT_FREQUENCIES), true);
  assert.equal(canStrategyClaim(exactPolicy, STRATEGY_CLAIMS.OPTIMALITY), false);

  assert.equal(generalizedPolicy.mode, 'exploratory');
  assert.equal(canStrategyClaim(generalizedPolicy, STRATEGY_CLAIMS.REFERENCE_MATCH), false);
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
  assert.equal(canStrategyClaim(evPolicy, STRATEGY_CLAIMS.EV_LOSS), false);
});

test('high-risk heuristic contexts use one structured limitation-code path', () => {
  const cases = [
    [context({ heroPosition: 'BB', lastAction: 'check', callAmountBb: 0 }), 'heuristic_limp_context_coarse'],
    [context({ lastAction: '3bet', facingSizeBb: 9, callAmountBb: 6 }), 'heuristic_facing_3bet_coarse'],
    [context({ lastAction: '4bet', facingSizeBb: 22, callAmountBb: 13 }), 'heuristic_facing_4bet_coarse'],
    [context({ street: 'flop', board: ['2c', '7d', 'Th'], lastAction: 'check', callAmountBb: 0 }), 'heuristic_postflop_position_coarse'],
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

test('legacy comparison distance and heuristic probabilities remain descriptive without correctness', () => {
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
  assert.deepEqual(grades.map((entry) => entry.comparisonAccepted), [true, true, false]);
  assert.deepEqual(grades.map((entry) => entry.accepted), [false, false, false]);
  assert.deepEqual(grades.map((entry) => entry.scoreDelta), [0, 0, 0]);

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
  assert.equal(explanation.claimPolicy.mode, 'exploratory');
  assert.equal(explanation.provenance.authority, STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY);
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
