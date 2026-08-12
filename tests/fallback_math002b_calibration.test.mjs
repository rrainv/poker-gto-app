import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { isStrategyResultV1 } from '../app/src/application/strategy-result.mjs';
import { calculatePreflopHeuristic } from '../app/src/strategy/preflop-heuristic.mjs';
import {
  BOUNDED_HU_GAME_VERSION,
  CALIBRATION_REFERENCE_SCHEMA_VERSION,
  CALIBRATION_SUPPORTED_DIMENSIONS,
  actionVectorForResult,
  buildCalibrationReport,
  compareBoundedHuReference,
  compareProbabilityVectors,
  createCalibrationStrategyProvider,
  diagnoseMultiway,
  diagnosePostflopCorpus,
  diagnosePreflopSanity,
  diagnosePriceResponse,
  diagnoseSizing,
  diagnoseStyleControls,
  evaluateDecisionContext,
  evaluatePostflopCorpus,
  evaluatePreflopGrid,
  preflopContextFor,
  summarizePreflopConfiguration,
} from './tooling/strategy-calibration-harness.mjs';
import {
  POSTFLOP_NAMED_CORPUS,
  PREFLOP_HAND_CLASSES,
  REPRESENTATIVE_PREFLOP_CONFIGURATIONS,
} from './tooling/strategy-calibration-corpora.mjs';

const HARNESS_SOURCE = fs.readFileSync(
  new URL('./tooling/strategy-calibration-harness.mjs', import.meta.url),
  'utf8',
);
const RUNNER_SOURCE = fs.readFileSync(
  new URL('./tooling/run-strategy-calibration.mjs', import.meta.url),
  'utf8',
);

function probabilityTotal(vector) {
  return Object.values(vector).reduce((sum, value) => sum + value, 0);
}

test('FALLBACK-MATH-002B calibration tooling stays outside production runtime', () => {
  assert.equal(CALIBRATION_SUPPORTED_DIMENSIONS.exactDecisionContext, true);
  assert.equal(CALIBRATION_SUPPORTED_DIMENSIONS.preflopHandClasses, 169);
  assert.equal(PREFLOP_HAND_CLASSES.length, 169);
  assert.equal(new Set(PREFLOP_HAND_CLASSES).size, 169);
  assert.match(RUNNER_SOURCE, /buildCalibrationReport/);
  assert.match(HARNESS_SOURCE, /createStrategyProvider/);

  for (const productionFile of [
    '../app/src/application/strategy-provider.mjs',
    '../app/src/strategy/heuristic-strategy.mjs',
    '../app/src/strategy/preflop-heuristic.mjs',
    '../app/src/strategy/postflop-heuristic.mjs',
  ]) {
    const source = fs.readFileSync(new URL(productionFile, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /strategy-calibration|tests\/tooling/);
  }
});

test('one exact DecisionContext and configurable preflop grids resolve deterministically', () => {
  const provider = createCalibrationStrategyProvider();
  const context = preflopContextFor('A5s', {
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BB',
    stackBb: 30,
    facing: 'facing_open',
    callAmountBb: 1.25,
  });
  const first = provider.resolve(context);
  const second = provider.resolve(context);
  assert.ok(isStrategyResultV1(first));
  assert.deepEqual(second, first);
  assert.equal(probabilityTotal(actionVectorForResult(first)), 1);

  const rows = evaluatePreflopGrid(provider, {
    handClasses: ['AA', 'A5s', '72o'],
    positions: ['UTG', 'BTN'],
    stackValues: [30, 100],
    facingCategories: ['unopened', 'facing_open'],
    tableSizes: [6],
    exactCallAmounts: { facing_open: 1.25 },
  });
  assert.equal(rows.length, 24);
  for (const row of rows) {
    assert.equal(probabilityTotal(row.result.actionVector), 1, JSON.stringify(row));
    if (row.facing === 'facing_open') {
      assert.equal(row.result.details.callPriceAvailable, true);
    }
  }
});

test('all representative 169-class summaries expose defined range-shape statistics', () => {
  const provider = createCalibrationStrategyProvider();
  const covered = new Set();
  for (const configuration of REPRESENTATIVE_PREFLOP_CONFIGURATIONS) {
    const summary = summarizePreflopConfiguration(provider, configuration);
    assert.equal(summary.classCount, 169);
    assert.equal(summary.aggressionOrdering.length, 169);
    assert.equal(new Set(summary.aggressionOrdering).size, 169);
    assert.ok(Math.abs(
      summary.averageAggression + summary.averagePassive + summary.averageFold - 1
    ) < 1e-9);
    covered.add(configuration.tableSize);
    covered.add(configuration.stackBb);
    covered.add(configuration.facing);
  }
  for (const expected of [2, 6, 9, 30, 100, 200, 'unopened', 'facing_open', 'facing_3bet']) {
    assert.ok(covered.has(expected), String(expected));
  }
});

test('robust preflop diagnostics avoid global monotonicity claims and find no material inversion', () => {
  const diagnostics = diagnosePreflopSanity(createCalibrationStrategyProvider());
  assert.match(diagnostics.caution, /global poker-strength monotonicity is not asserted/);
  assert.deepEqual(diagnostics.positionalInversions, []);
  assert.deepEqual(diagnostics.premiumDominanceAnomalies, []);
  assert.deepEqual(diagnostics.pairOrderingAnomalies, []);
  assert.deepEqual(diagnostics.suitednessAnomalies, []);
  assert.ok(diagnostics.maximumTinyStackDelta < 0.001);
});

test('HU reference comparisons are quality-gated and metrics have defined mathematics', () => {
  const provider = createCalibrationStrategyProvider();
  const unavailable = compareBoundedHuReference(provider, null);
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.metrics, null);

  const insufficient = compareBoundedHuReference(provider, {
    schemaVersion: CALIBRATION_REFERENCE_SCHEMA_VERSION,
    gameVersion: BOUNDED_HU_GAME_VERSION,
    quality: { sufficientForCalibration: false, reason: 'test fixture is unconverged' },
    rows: [],
  });
  assert.equal(insufficient.status, 'insufficient_reference_quality');
  assert.equal(insufficient.metrics, null);

  const decisionContext = preflopContextFor('AA', {
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BTN',
    stackBb: 100,
    facing: 'unopened',
    callAmountBb: 0.5,
  });
  decisionContext.heroStreetContributionBb = 0.5;
  const vector = evaluateDecisionContext(provider, decisionContext).actionVector;
  const compared = compareBoundedHuReference(provider, {
    schemaVersion: CALIBRATION_REFERENCE_SCHEMA_VERSION,
    gameVersion: BOUNDED_HU_GAME_VERSION,
    quality: {
      sufficientForCalibration: true,
      convergenceMetric: 'test-only exact identity fixture',
    },
    rows: [{
      id: 'root_AA_identity',
      handClass: 'AA',
      decisionContext,
      referenceActionVector: vector,
      projection: 'structural',
    }],
  });
  assert.equal(compared.status, 'compared');
  assert.equal(compared.metrics.meanL1Distance, 0);
  assert.equal(compared.metrics.maximumL1Distance, 0);
  assert.equal(compared.metrics.dominantActionDisagreementRate, 0);

  const known = compareProbabilityVectors(
    { fold: 0.2, call: 0.3, raise: 0.5 },
    { fold: 0.1, call: 0.4, raise: 0.5 },
  );
  assert.equal(known.l1Distance, 0.2);
  assert.equal(known.maxActionProbabilityError, 0.1);
});

test('named postflop corpus records canonical, strategic, sample, action, range, and sizing facts', () => {
  const rows = evaluatePostflopCorpus({ playStyle: 0.4, opponentStyle: 0.4 });
  assert.equal(rows.length, POSTFLOP_NAMED_CORPUS.length);
  assert.ok(rows.some((row) => row.street === 'flop'));
  assert.ok(rows.some((row) => row.street === 'turn'));
  assert.ok(rows.some((row) => row.street === 'river'));
  for (const row of rows) {
    assert.ok(row.canonicalCategory);
    assert.ok(row.strategicCategory);
    assert.ok(row.sampledStrength >= 0 && row.sampledStrength <= 1);
    assert.equal(probabilityTotal(row.actionVector), 1, row.id);
    assert.ok(Number.isInteger(row.opponentCount) && row.opponentCount >= 1);
    assert.ok(row.assumedRangeFraction > 0 && row.assumedRangeFraction <= 1);
    assert.equal(row.assumedRangeDistribution, 'uniform_over_selected_legal_combos');
    assert.ok(row.sizes.every((action) => (
      action.amountBb === null && action.potFraction === null
    )));
    assert.equal(row.positionAdjustmentApplied, false);
  }
  const diagnostics = diagnosePostflopCorpus(rows);
  assert.deepEqual(diagnostics.mechanicalAnomalies, []);
  assert.deepEqual(diagnostics.robustQualitativeAnomalies, []);
  assert.ok(diagnostics.calibrationUnknowns.every((finding) => /Level D|unvalidated/.test(finding)));
});

test('price, style, and multiway diagnostics preserve their bounded invariants', () => {
  const prices = diagnosePriceResponse();
  assert.ok(prices.every((spot) => spot.foldDirectionAnomalies.length === 0));
  for (const spot of prices) {
    assert.ok(spot.rows.every((row) => row.sampledStrength === spot.rows[0].sampledStrength));
  }

  const styles = diagnoseStyleControls();
  assert.equal(styles.opponentStyle.rangeWidthMonotonic, true);
  assert.equal(styles.playStyle.sampledStrengthInvariant, true);
  assert.ok(styles.playStyle.maximumAggressionProbabilityShift < 0.25);

  const multiway = diagnoseMultiway();
  assert.equal(multiway.equilibriumClaim, false);
  assert.equal(multiway.sampledStrengthNonIncreasing, true);
  assert.equal(multiway.aggressionNonIncreasing, true);
  assert.ok(multiway.rows.every((row) => (
    row.completedSamples === 250 && row.probabilityTotal === 1
    && !Object.hasOwn(row, 'runtimeMilliseconds')
  )));
});

test('objective preflop action and sizing semantics are projected coherently', () => {
  const provider = createCalibrationStrategyProvider();
  for (const stackBb of [1, 1.999, 2]) {
    const result = evaluateDecisionContext(provider, preflopContextFor('AA', {
      tableSize: 6,
      opponentCount: 5,
      heroPosition: 'BTN',
      stackBb,
      facing: 'unopened',
    }));
    const aggressive = result.actions.find((action) => action.type === 'all_in');
    assert.ok(aggressive, String(stackBb));
    assert.equal(aggressive.amountBb, null);
    assert.equal(aggressive.label, 'All-In');
  }

  const huRootContext = preflopContextFor('AKs', {
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BTN',
    stackBb: 100,
    facing: 'unopened',
  });
  const huRootCandidate = calculatePreflopHeuristic(huRootContext);
  assert.equal(
    huRootCandidate.actions.find((action) => action.action.type === 'call').label,
    'Limp',
  );

  const facingCap = evaluateDecisionContext(provider, preflopContextFor('AA', {
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BB',
    stackBb: 100,
    facing: 'facing_all_in',
  }));
  assert.equal(facingCap.actionVector.raise, 0);
  assert.equal(facingCap.actionVector.call, 0.98);
  assert.equal(facingCap.details.stackCapActionProjectionApplied, true);

  const sizing = diagnoseSizing();
  assert.deepEqual(sizing.anomalies, []);
  assert.equal(sizing.postflopExplicitSizeCount, 0);
});

test('default report is deterministic in content and keeps runtime out of the baseline', () => {
  const report = buildCalibrationReport();
  assert.equal(report.boundedSolver.referenceComparison.status, 'unavailable');
  assert.equal(report.boundedSolver.referenceComparison.metrics, null);
  assert.equal(report.claims.solvedGto, false);
  assert.equal(report.claims.multiplayerEquilibrium, false);
  assert.equal(report.preflop.configurations.length, REPRESENTATIVE_PREFLOP_CONFIGURATIONS.length);
  assert.ok(report.postflop.multiway.rows.every((row) => (
    !Object.hasOwn(row, 'runtimeMilliseconds')
  )));
  assert.doesNotMatch(JSON.stringify(report), /accuracy\s*%/i);
});
