import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createStrategyResult } from '../app/src/application/strategy-result.mjs';
import {
  ACTION_PRECISION_LEVELS,
  CONTEXT_COMPARISON_OUTCOMES,
  DIAGNOSES,
  aggregateBenchmarkRows,
  calculateStrategyMetrics,
  classifyDiagnosis,
  compareEquity,
  evaluateContextMatch,
  projectReferenceActions,
} from './tooling/reference-bench-metrics.mjs';
import {
  formatReferenceBenchmarkSummary,
  runReferenceBenchmark,
} from './tooling/reference-bench-harness.mjs';
import {
  REFERENCE_BENCHMARK_INPUT_SCHEMA_VERSION,
  validateReferenceBenchmarkInput,
} from './tooling/reference-bench-schema.mjs';
import { runReferenceBenchmarkCli } from './tooling/run-reference-bench.mjs';
import { POSTFLOP_NAMED_CORPUS } from './tooling/strategy-calibration-corpora.mjs';

const SYNTHETIC_FIXTURE_URL = new URL(
  './fixtures/reference-bench001-synthetic.json',
  import.meta.url,
);

function fixture() {
  return JSON.parse(fs.readFileSync(SYNTHETIC_FIXTURE_URL, 'utf8'));
}

function exactGate() {
  return {
    outcome: CONTEXT_COMPARISON_OUTCOMES.EXACT,
    numericalStrategyAllowed: true,
    numericalEquityAllowed: true,
  };
}

function equitySemantics(overrides = {}) {
  return {
    quantity: 'equity_share',
    heroPopulation: 'exact_combo',
    opponentPopulation: 'range',
    heroRangeId: null,
    opponentRangeId: 'synthetic.same-range/v1',
    weighting: 'uniform_combos',
    opponentCount: 1,
    boardTreatment: 'fixed_board_random_runout',
    tieTreatment: 'split_pot',
    ...overrides,
  };
}

function postflopHeuristicFixture() {
  const input = fixture();
  const context = POSTFLOP_NAMED_CORPUS.find((spot) => spot.id === 'flop_top_pair_dry').context;
  const assumptions = {
    gameType: 'no_limit_texas_holdem',
    tableSize: 2,
    positions: ['BTN', 'BB'],
    stackDepthBb: 100,
    blinds: { smallBlindBb: 0.5, bigBlindBb: 1 },
    ante: { kind: 'none', amountBb: 0 },
    rake: { kind: 'none', description: null, percentage: null, capBb: null },
    format: 'cash',
    actionTree: [
      { actorPosition: 'BB', rawLabel: 'Check', canonicalType: 'check', size: null },
    ],
    availableActionSizes: [],
    street: 'flop',
    board: [...context.board],
    currentPotBb: 10,
    callAmountBb: 0,
    effectiveStackBb: 100,
    legalActions: [
      { canonicalType: 'check', size: null, rawLabel: 'Check' },
      { canonicalType: 'bet', size: null, rawLabel: 'Bet (family only)' },
    ],
  };
  input.packId = 'synthetic.postflop-sample';
  input.nodes = [{
    id: 'flop_top_pair_dry',
    referenceCoverage: 'supported',
    coverageNote: 'Synthetic semantics-equality fixture.',
    referenceContext: structuredClone(assumptions),
    riverline: {
      decisionContext: structuredClone(context),
      gameAssumptions: structuredClone(assumptions),
    },
    contextMatch: { kind: 'exact', mappings: [], note: null },
    observations: [{
      id: 'ak_top_pair',
      hand: {
        kind: 'postflop_exact_combo',
        combo: [...context.heroCards],
        rangeWeight: 1,
      },
      reference: {
        frequencyUnit: 'percent',
        rawActions: [
          { label: 'Check', canonicalType: 'check', frequency: 35, size: null, evBb: null },
          { label: 'Bet', canonicalType: 'bet', frequency: 65, size: null, evBb: null },
        ],
        equity: { value: 0.7, semantics: equitySemantics() },
        eqr: null,
      },
      riverlineEquity: {
        source: 'heuristic_conditional_sample',
        semantics: equitySemantics(),
      },
    }],
  }];
  return input;
}

test('versioned input schema accepts the synthetic pack and rejects incompatible contracts', () => {
  const input = fixture();
  const validated = validateReferenceBenchmarkInput(input);
  assert.equal(validated.schemaVersion, REFERENCE_BENCHMARK_INPUT_SCHEMA_VERSION);
  assert.equal(validated.source.sourceType, 'riverline_owned');
  assert.throws(
    () => validateReferenceBenchmarkInput({ ...input, schemaVersion: 'riverline-reference-benchmark-input/v2' }),
    /Expected riverline-reference-benchmark-input\/v1/,
  );
  const invalidClass = fixture();
  invalidClass.nodes[0].observations[0].hand.handClass = 'AA';
  assert.throws(() => validateReferenceBenchmarkInput(invalidClass), /does not represent AA/);
});

test('exact-combo and preflop 169-class observations remain distinct', () => {
  const input = fixture();
  input.nodes[0].observations[0].hand.kind = 'exact_combo';
  assert.throws(
    () => validateReferenceBenchmarkInput(input),
    /exact-combo observations must not carry handClass/,
  );
  delete input.nodes[0].observations[0].hand.handClass;
  assert.doesNotThrow(() => validateReferenceBenchmarkInput(input));
});

test('exact context matching checks all required assumptions', () => {
  const input = validateReferenceBenchmarkInput(fixture());
  const gate = evaluateContextMatch(input.nodes[0]);
  assert.equal(gate.outcome, CONTEXT_COMPARISON_OUTCOMES.EXACT);
  assert.equal(gate.numericalStrategyAllowed, true);
  assert.equal(gate.numericalEquityAllowed, true);
  assert.deepEqual(gate.discrepancies, []);
});

test('mapped stack context remains usable only with a verified explicit mapping', async () => {
  const input = fixture();
  const node = input.nodes[0];
  node.referenceContext.stackDepthBb = 93;
  node.contextMatch = {
    kind: 'mapped',
    mappings: [{
      field: 'stackDepthBb',
      riverlineValue: 100,
      referenceValue: 93,
      note: 'Actual Riverline node 100bb -> nearest reference solution 93bb.',
    }],
    note: null,
  };
  const gate = evaluateContextMatch(validateReferenceBenchmarkInput(input).nodes[0]);
  assert.equal(gate.outcome, CONTEXT_COMPARISON_OUTCOMES.USABLE_MAPPED);
  assert.equal(gate.numericalStrategyAllowed, true);
  assert.equal(gate.numericalEquityAllowed, false);
  const mappedReport = await runReferenceBenchmark(input);
  const mappedRow = mappedReport.nodes[0].observations[0];
  assert.equal(mappedRow.strategy[ACTION_PRECISION_LEVELS.LEVEL_1].comparable, true);
  assert.equal(mappedRow.strategy[ACTION_PRECISION_LEVELS.LEVEL_3].comparable, false);
  assert.equal(
    mappedRow.strategy[ACTION_PRECISION_LEVELS.LEVEL_3].blockedReason,
    'exact_sizing_requires_exact_context',
  );

  node.contextMatch.mappings[0].referenceValue = 100;
  const unverified = evaluateContextMatch(validateReferenceBenchmarkInput(input).nodes[0]);
  assert.equal(unverified.outcome, CONTEXT_COMPARISON_OUTCOMES.DIRECTIONAL_ONLY);
});

test('unknown and approximate contexts are directional while critical mismatches are incomparable', () => {
  const unknown = fixture();
  unknown.nodes[0].referenceContext.rake = {
    kind: 'unknown', description: null, percentage: null, capBb: null,
  };
  unknown.nodes[0].contextMatch = { kind: 'unknown', mappings: [], note: 'Rake not visible.' };
  assert.equal(
    evaluateContextMatch(validateReferenceBenchmarkInput(unknown).nodes[0]).outcome,
    CONTEXT_COMPARISON_OUTCOMES.DIRECTIONAL_ONLY,
  );

  const incomparable = fixture();
  incomparable.nodes[0].referenceContext.positions = ['BB', 'BTN'];
  incomparable.nodes[0].contextMatch = { kind: 'approximate', mappings: [], note: null };
  assert.equal(
    evaluateContextMatch(validateReferenceBenchmarkInput(incomparable).nodes[0]).outcome,
    CONTEXT_COMPARISON_OUTCOMES.INCOMPARABLE,
  );
});

test('incomparable context blocks numerical strategy metrics', async () => {
  const input = fixture();
  input.nodes[0].referenceContext.tableSize = 3;
  input.nodes[0].referenceContext.positions = ['BTN', 'SB', 'BB'];
  input.nodes[0].contextMatch = { kind: 'approximate', mappings: [], note: null };
  const report = await runReferenceBenchmark(input);
  const level1 = report.nodes[0].observations[0].strategy[ACTION_PRECISION_LEVELS.LEVEL_1];
  assert.equal(report.nodes[0].context.outcome, CONTEXT_COMPARISON_OUTCOMES.INCOMPARABLE);
  assert.equal(level1.comparable, false);
  assert.equal(level1.metrics, null);
  assert.equal(report.nodes[0].observations[0].diagnosis.primary, DIAGNOSES.CONTEXT_MISMATCH);
});

test('raw reference actions are preserved before normalization', async () => {
  const input = fixture();
  const raw = structuredClone(input.nodes[0].observations[0].reference.rawActions);
  const report = await runReferenceBenchmark(input);
  assert.deepEqual(report.nodes[0].observations[0].reference.rawActions, raw);
  assert.equal(report.nodes[0].observations[0].reference.rawActions[2].label, 'Raise to 2.5bb');
  assert.equal(report.nodes[0].observations[0].reference.rawActions[2].evBb, 0.8);
});

test('frequency normalization and level 1/2 action projection are explicit', () => {
  const reference = fixture().nodes[0].observations[0].reference;
  reference.rawActions[0].frequency = 10;
  reference.rawActions[1].frequency = 30;
  reference.rawActions[2].frequency = 60;
  const level1 = projectReferenceActions(reference, ACTION_PRECISION_LEVELS.LEVEL_1);
  const level2 = projectReferenceActions(reference, ACTION_PRECISION_LEVELS.LEVEL_2);
  assert.equal(level1.inputTotal, 100);
  assert.equal(level1.normalizationFactor, 0.01);
  assert.deepEqual(level1.vector, { AGGRESSION: 0.6, FOLD: 0.1, PASSIVE_CONTINUE: 0.3 });
  assert.equal(level2.vector.CALL, 0.3);
  assert.equal(level2.vector.RAISE, 0.6);

  reference.rawActions[2].frequency = 40;
  const renormalized = projectReferenceActions(reference, ACTION_PRECISION_LEVELS.LEVEL_1);
  assert.equal(renormalized.inputTotal, 80);
  assert.equal(renormalized.normalizationFactor, 0.0125);
  assert.deepEqual(renormalized.vector, {
    AGGRESSION: 0.5,
    FOLD: 0.125,
    PASSIVE_CONTINUE: 0.375,
  });
});

test('TVD, per-action delta, biases, and dominant-action agreement are deterministic', () => {
  const metrics = calculateStrategyMetrics(
    { FOLD: 0.2, PASSIVE_CONTINUE: 0.3, AGGRESSION: 0.5 },
    { FOLD: 0.5, PASSIVE_CONTINUE: 0.4, AGGRESSION: 0.1 },
  );
  assert.equal(metrics.totalVariationDistance, 0.4);
  assert.equal(metrics.maximumActionDelta, 0.4);
  assert.equal(metrics.foldBias, -0.3);
  assert.equal(metrics.passiveBias, -0.1);
  assert.equal(metrics.aggressionBias, 0.4);
  assert.equal(metrics.dominantActionAgreement, false);
  assert.equal(metrics.referenceDominantAction, 'FOLD');
  assert.equal(metrics.riverlineDominantAction, 'AGGRESSION');
});

test('weighted node aggregates retain unweighted and reference-range-weighted metrics', async () => {
  const report = await runReferenceBenchmark(fixture());
  const aggregate = report.nodes[0].aggregate.strategy;
  assert.equal(aggregate.meanTvd, 0.35);
  assert.equal(aggregate.medianTvd, 0.25);
  assert.equal(aggregate.p95Tvd, 0.45);
  assert.equal(aggregate.weighted.totalReferenceRangeWeight, 1);
  assert.equal(aggregate.weighted.meanTvd, 0.3);
  assert.equal(aggregate.weighted.dominantActionAgreementRate, 1);
});

test('equity comparison requires exact context and identical quantity semantics', () => {
  const reference = { value: 0.55, semantics: equitySemantics() };
  const riverline = { value: 0.57, semantics: equitySemantics(), sampling: {} };
  const compared = compareEquity(reference, riverline, exactGate());
  assert.equal(compared.comparable, true);
  assert.equal(compared.absoluteDelta, 0.02);

  const mismatched = compareEquity(reference, {
    ...riverline,
    semantics: equitySemantics({ heroPopulation: 'range', heroRangeId: 'whole-range/v1' }),
  }, exactGate());
  assert.equal(mismatched.comparable, false);
  assert.equal(mismatched.reason, 'equity_semantics_mismatch');

  const mappedGate = { ...exactGate(), outcome: 'USABLE_MAPPED', numericalEquityAllowed: false };
  assert.equal(compareEquity(reference, riverline, mappedGate).reason, 'equity_requires_exact_context');
});

test('heuristic equity stays separate and records range, trials, opponents, seed, and evaluator metadata', async () => {
  const report = await runReferenceBenchmark(postflopHeuristicFixture());
  const row = report.nodes[0].observations[0];
  assert.equal(row.equity.comparable, true);
  assert.equal(row.equity.riverline.source, 'heuristic_conditional_sample');
  assert.equal(row.equity.riverline.sampling.numberOfTrials, 250);
  assert.equal(row.equity.riverline.sampling.opponentCount, 1);
  assert.equal(row.equity.riverline.sampling.opponentRangeConstruction.distribution, 'uniform_over_selected_legal_combos');
  assert.equal(Number.isInteger(row.equity.riverline.sampling.deterministicSeedFamily), true);
  assert.match(row.equity.riverline.sampling.evaluatorPath, /heuristic-evaluator/);
});

test('canonical Equity requests are semantics-validated and retain their separate evaluator path', async () => {
  const input = postflopHeuristicFixture();
  const observation = input.nodes[0].observations[0];
  const canonicalSemantics = equitySemantics({
    opponentPopulation: 'uniform_unknown_combos',
    opponentRangeId: null,
  });
  observation.reference.equity = { value: 0.65, semantics: canonicalSemantics };
  observation.riverlineEquity = {
    source: 'canonical_equity_service',
    heroPlayerId: 'hero',
    semantics: canonicalSemantics,
    request: {
      schemaVersion: 'equity-request/v1',
      players: [
        { id: 'hero', cards: [...observation.hand.combo] },
        { id: 'villain', cards: null },
      ],
      board: [...input.nodes[0].referenceContext.board],
      deadCards: [],
      method: 'monte_carlo',
      samples: 25,
      seed: 12345,
    },
  };
  const report = await runReferenceBenchmark(input);
  const equity = report.nodes[0].observations[0].equity;
  assert.equal(equity.comparable, true);
  assert.equal(equity.riverline.sampling.numberOfTrials, 25);
  assert.equal(equity.riverline.sampling.deterministicSeedFamily, 12345);
  assert.match(equity.riverline.sampling.evaluatorPath, /shared\/poker-domain\/equity/);

  observation.riverlineEquity.semantics = equitySemantics();
  assert.throws(
    () => validateReferenceBenchmarkInput(input),
    /semantics do not describe the canonical Equity request/,
  );
});

test('diagnosis distinguishes close equity/far strategy and far equity/close strategy', () => {
  const strategyFar = {
    [ACTION_PRECISION_LEVELS.LEVEL_1]: { metrics: { totalVariationDistance: 0.4 } },
  };
  const strategyClose = {
    [ACTION_PRECISION_LEVELS.LEVEL_1]: { metrics: { totalVariationDistance: 0.1 } },
  };
  const noSupportMismatch = {
    detected: false, unsupportedActionTypes: [], unsupportedSizingTypes: [],
  };
  assert.equal(classifyDiagnosis({
    contextGate: exactGate(),
    strategy: strategyFar,
    equity: { comparable: true, absoluteDelta: 0.01 },
    actionSupport: noSupportMismatch,
  }).primary, DIAGNOSES.EQUITY_CLOSE_STRATEGY_FAR);
  assert.equal(classifyDiagnosis({
    contextGate: exactGate(),
    strategy: strategyClose,
    equity: { comparable: true, absoluteDelta: 0.12 },
    actionSupport: noSupportMismatch,
  }).primary, DIAGNOSES.EQUITY_FAR_STRATEGY_CLOSE);
});

test('action support mismatch is diagnosed without inventing sizing precision', () => {
  const strategy = {
    [ACTION_PRECISION_LEVELS.LEVEL_1]: { metrics: { totalVariationDistance: 0.5 } },
  };
  const diagnosis = classifyDiagnosis({
    contextGate: exactGate(),
    strategy,
    equity: { comparable: false },
    actionSupport: {
      detected: true, unsupportedActionTypes: ['all_in'], unsupportedSizingTypes: [],
    },
  });
  assert.equal(diagnosis.primary, DIAGNOSES.ACTION_SUPPORT_MISMATCH);
});

test('reports and terminal summaries are byte-deterministic for identical input', async () => {
  const first = await runReferenceBenchmark(fixture());
  const second = await runReferenceBenchmark(fixture());
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(formatReferenceBenchmarkSummary(first), formatReferenceBenchmarkSummary(second));
  assert.doesNotMatch(JSON.stringify(first), /durationMs|generatedAt/);
});

test('missing optional action EV, equity, and EQR remain valid and explicit', async () => {
  const input = fixture();
  const observation = input.nodes[0].observations[0];
  observation.reference.rawActions.forEach((action) => delete action.evBb);
  delete observation.reference.equity;
  delete observation.reference.eqr;
  delete observation.riverlineEquity;
  assert.doesNotThrow(() => validateReferenceBenchmarkInput(input));
  const report = await runReferenceBenchmark(input);
  assert.deepEqual(report.nodes[0].observations[0].reference.optionalEvidence, {
    actionEvAvailable: false,
    equityAvailable: false,
    eqrAvailable: false,
  });
});

test('aggregate equity reports mean, median, p95, and signed systematic bias separately', () => {
  const rows = [0.01, -0.02, 0.08].map((signedDelta, index) => ({
    hand: { rangeWeight: index + 1 },
    strategy: null,
    equity: {
      comparable: true,
      absoluteDelta: Math.abs(signedDelta),
      signedDelta,
    },
  }));
  const aggregate = aggregateBenchmarkRows(rows).equity;
  assert.equal(aggregate.meanAbsoluteDelta, 0.036666666667);
  assert.equal(aggregate.medianAbsoluteDelta, 0.02);
  assert.equal(aggregate.p95AbsoluteDelta, 0.08);
  assert.equal(aggregate.systematicDirectionalBias, 0.023333333333);
});

test('CLI emits machine JSON and a concise deterministic summary', async () => {
  let stdout = '';
  let stderr = '';
  const sink = (target) => ({ write(value) { target(value); } });
  const result = await runReferenceBenchmarkCli([
    '--input',
    fs.realpathSync(SYNTHETIC_FIXTURE_URL),
  ], {
    stdout: sink((value) => { stdout += value; }),
    stderr: sink((value) => { stderr += value; }),
  });
  assert.equal(result, 0);
  assert.equal(JSON.parse(stdout).schemaVersion, 'riverline-reference-benchmark-report/v1');
  assert.match(stderr, /CONTEXT hu_btn_rfi_100bb_synthetic: EXACT/);
  assert.match(stderr, /DIAGNOSIS/);
  assert.match(stderr, /LIMITATIONS/);
});

test('benchmark tooling consumes production authorities without becoming their dependency', () => {
  const productionAuthorities = [
    '../app/src/application/strategy-provider.mjs',
    '../app/src/application/strategy-result.mjs',
    '../app/src/application/strategy-source-authority.mjs',
    '../shared/poker-domain/equity.js',
  ];
  for (const relative of productionAuthorities) {
    const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /reference-bench|external reference observation/i);
  }
  const syntheticCandidate = createStrategyResult({
    source: 'heuristic_preflop',
    actions: [{ action: { type: 'fold', amountBb: null, potFraction: null }, probability: 1 }],
  });
  assert.equal(syntheticCandidate.sourceDescriptor.family, 'heuristic');
  assert.notEqual(syntheticCandidate.sourceDescriptor.family, 'reference_pack');
});
