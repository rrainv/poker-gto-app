import test from 'node:test';
import assert from 'node:assert/strict';

import { POSITIONS_BY_TABLE_SIZE } from '../shared/poker-domain/positions.js';
import { STRATEGY_SOURCE_AUTHORITIES } from '../app/src/application/strategy-source-authority.mjs';
import { isStrategyResultV1 } from '../app/src/application/strategy-result.mjs';
import {
  calculatePostflopStrategyFromSample,
} from '../app/src/strategy/postflop-heuristic.mjs';
import {
  createDeterministicHeuristicRng,
  decisionContextStrategySeed,
} from '../app/src/strategy/heuristic-strategy.mjs';
import {
  calculatePreflopFallbackStrategy,
  preflopTableFamilyPositionFacts,
} from '../app/src/strategy/preflop-heuristic.mjs';
import {
  STRATEGY_QUALITY_SNAPSHOT_SCHEMA_VERSION,
  buildStrategyQualitySnapshot,
  createCalibrationStrategyProvider,
  evaluateDecisionContext,
  evaluatePostflopCounterfactuals,
  preflopContextFor,
  summarizePreflopConfiguration,
} from './tooling/strategy-calibration-harness.mjs';
import {
  POSTFLOP_COUNTERFACTUAL_CORPUS,
  PREFLOP_HAND_CLASSES,
  REPRESENTATIVE_PREFLOP_CONFIGURATIONS,
  RFI_EXTERNAL_SANITY_REFERENCES,
  calibrationDecisionContext,
} from './tooling/strategy-calibration-corpora.mjs';

function options() {
  return { playStyle: 0, opponentStyle: 0, flatDropBb: 0 };
}

function availableProbabilityTotal(result) {
  return result.actions.reduce((sum, entry) => sum + entry.probability, 0);
}

test('STRATEGY-REPAIR-001A preserves a compact calibration corpus without solved-truth claims', () => {
  const snapshot = buildStrategyQualitySnapshot();
  assert.equal(snapshot.schemaVersion, STRATEGY_QUALITY_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(snapshot.scope, 'heuristic_calibration_metrics_not_solved_truth');
  assert.deepEqual(snapshot.claims, {
    solvedGto: false,
    exactSolverAgreement: false,
    safeForFrequencyRetuning: false,
  });
  assert.equal(
    snapshot.preflop.configurations.length,
    REPRESENTATIVE_PREFLOP_CONFIGURATIONS.length,
  );
  assert.ok(snapshot.preflop.boundaryHands.includes('AJo'));
  assert.ok(snapshot.preflop.boundaryHands.includes('K8s'));
  assert.deepEqual(snapshot.preflop.metricAssumptions.physicalCombo, {
    weighting: 'physical_combo_count',
    pairClassCombos: 6,
    suitedClassCombos: 4,
    offsuitClassCombos: 12,
    totalCombos: 1326,
    blockerConditioning: 'none',
    classStrategyProjection: 'each physical combo receives its 169-class action vector',
  });
  assert.equal(
    snapshot.preflop.externalSanityReferences.length,
    RFI_EXTERNAL_SANITY_REFERENCES.length,
  );
  assert.ok(snapshot.preflop.acceptanceInvariants.length >= 6);
  assert.deepEqual(snapshot.preflop.structuralDiagnostics, {
    weighting: 'physical_combo_count',
    huMinusSixMaxButtonAggression: 0.049289370466,
    sixMaxMinusNineMaxFirstAggression: 0.018358343979,
    sixMaxMinusNineMaxButtonAggression: 0,
    sixMaxProgressionMonotonic: true,
    nineMaxProgressionMonotonic: true,
    externalPercentageAssertions: false,
  });
  for (const configuration of snapshot.preflop.configurations) {
    assert.equal(configuration.actionMassByWeighting.physicalCombo.totalWeight, 1326);
    assert.equal(configuration.actionMassByWeighting.equalClass.totalWeight, 169);
  }
  assert.ok(snapshot.postflop.namedCorpus.length >= 14);
  assert.equal(snapshot.preflop.allInReachability.evaluatedResultCount, 845);
  assert.equal(snapshot.preflop.allInReachability.positiveAllInResultCount, 0);
});

test('bounded table-family correction does not reinterpret the named-position ladder', () => {
  const hu = preflopTableFamilyPositionFacts(2, 'BTN');
  const sixFirst = preflopTableFamilyPositionFacts(6, 'UTG');
  const nineFirst = preflopTableFamilyPositionFacts(9, 'UTG');
  const sixButton = preflopTableFamilyPositionFacts(6, 'BTN');

  assert.deepEqual(
    { players: hu.playersLeftToAct, equivalent: hu.equivalentPosition, applied: hu.applied },
    { players: 1, equivalent: 'BTN/SB', applied: true },
  );
  assert.deepEqual(
    { players: sixFirst.playersLeftToAct, equivalent: sixFirst.equivalentPosition },
    { players: 5, equivalent: 'UTG' },
  );
  assert.deepEqual(
    {
      players: nineFirst.playersLeftToAct,
      equivalent: nineFirst.equivalentPosition,
      adjustment: nineFirst.adjustment,
      basis: nineFirst.basis,
    },
    {
      players: 8,
      equivalent: 'UTG',
      adjustment: -0.4,
      basis: 'bounded_full_ring_first_position_step',
    },
  );
  assert.equal(sixFirst.adjustment, 0);
  assert.equal(sixFirst.basis, 'canonical_named_position_baseline');
  assert.equal(sixButton.applied, false);
  assert.deepEqual(
    {
      players: preflopTableFamilyPositionFacts(5, 'HJ').playersLeftToAct,
      equivalent: preflopTableFamilyPositionFacts(5, 'HJ').equivalentPosition,
    },
    { players: 4, equivalent: 'HJ' },
  );
  assert.equal(preflopTableFamilyPositionFacts(9, 'UTG+1').adjustment, 0);
  assert.equal(preflopTableFamilyPositionFacts(9, 'MP').adjustment, 0);
  assert.equal(preflopTableFamilyPositionFacts(9, 'LJ').adjustment, 0);
  assert.equal(preflopTableFamilyPositionFacts(6, 'UTG', '3bet').applied, false);
});

test('HU and six-max first position repair aggregate shape while ring progression stays monotonic', () => {
  const provider = createCalibrationStrategyProvider();
  const summary = (tableSize, heroPosition) => summarizePreflopConfiguration(provider, {
    tableSize,
    opponentCount: tableSize - 1,
    heroPosition,
    stackBb: 100,
    facing: 'unopened',
  });

  const huButton = summary(2, 'BTN');
  const sixButton = summary(6, 'BTN');
  const nineButton = summary(9, 'BTN');
  const sixFirst = summary(6, 'UTG');
  const nineFirst = summary(9, 'UTG');
  assert.ok(huButton.averageAggression > sixButton.averageAggression + 0.02);
  assert.equal(sixButton.averageAggression, nineButton.averageAggression);
  assert.ok(sixFirst.averageAggression > nineFirst.averageAggression + 0.015);

  const sixPhysical = sixFirst.actionMassByWeighting.physicalCombo;
  const ninePhysical = nineFirst.actionMassByWeighting.physicalCombo;
  assert.ok(sixPhysical.aggression > ninePhysical.aggression + 0.01);
  assert.equal(sixPhysical.totalWeight, 1326);
  assert.equal(ninePhysical.totalWeight, 1326);

  for (const tableSize of [6, 9]) {
    const nonBlind = POSITIONS_BY_TABLE_SIZE[tableSize].filter(
      (position) => !['SB', 'BB'].includes(position),
    );
    const progression = nonBlind.map((position) => summary(tableSize, position));
    for (let index = 1; index < progression.length; index += 1) {
      assert.ok(
        progression[index].averageAggression + 1e-12
          >= progression[index - 1].averageAggression,
        `${tableSize}-max ${nonBlind[index - 1]} -> ${nonBlind[index]}`,
      );
    }
  }
});

test('representative preflop corpus remains finite, normalized, deterministic, and provider-compatible', () => {
  const provider = createCalibrationStrategyProvider();
  for (const configuration of REPRESENTATIVE_PREFLOP_CONFIGURATIONS) {
    for (const handClass of ['AA', 'AJo', 'KQo', 'T9o', '98o', '76s', '72o']) {
      const context = preflopContextFor(handClass, configuration);
      const first = provider.resolve(context);
      const second = provider.resolve(context);
      assert.ok(isStrategyResultV1(first));
      assert.deepEqual(second, first);
      assert.equal(first.sourceVersion, 'riverline-preflop-heuristic/v2');
      assert.equal(availableProbabilityTotal(first), 1);
      assert.ok(first.actions.every((entry) => Number.isFinite(entry.probability)));
      assert.doesNotMatch(JSON.stringify(first), /solved GTO|Nash|action EV|EV loss/i);
    }
  }
});

test('table-family correction leaves every facing-action and BB-option class unchanged', () => {
  const contexts = [
    { id: 'facing_open', position: 'BB', action: 'raise', facing: 2.5, pot: 3.5, call: 1.5 },
    { id: 'facing_3bet', position: 'BTN', action: '3bet', facing: 8, pot: 11.5, call: 5.5 },
    { id: 'facing_4bet', position: 'BTN', action: '4bet', facing: 20, pot: 31.5, call: 12 },
    { id: 'bb_option', position: 'BB', action: 'unopened', facing: 0, pot: 1.5, call: null },
  ];
  const strategy = (handClass, context, tableSize) => calculatePreflopFallbackStrategy(
    handClass[0],
    handClass[1],
    handClass.length === 2,
    handClass.endsWith('s'),
    context.position,
    context.action,
    context.facing,
    context.pot,
    100,
    context.call,
    tableSize,
  );

  for (const context of contexts) {
    for (const handClass of PREFLOP_HAND_CLASSES) {
      const withoutTableFamily = strategy(handClass, context, null);
      assert.deepEqual(
        strategy(handClass, context, 6),
        withoutTableFamily,
        `${context.id} ${handClass} at 6-max`,
      );
      assert.deepEqual(
        strategy(handClass, context, 9),
        withoutTableFamily,
        `${context.id} ${handClass} at 9-max`,
      );
    }
  }
});

test('postflop sample seed ignores nominal labels but responds to genuine population facts', () => {
  const nominal = POSTFLOP_COUNTERFACTUAL_CORPUS.nominalSizeInvariant;
  const betRaise = POSTFLOP_COUNTERFACTUAL_CORPUS.betRaiseEquivalentRange;
  assert.equal(
    decisionContextStrategySeed(nominal.baseline, options()),
    decisionContextStrategySeed(nominal.counterfactual, options()),
  );
  assert.equal(
    decisionContextStrategySeed(betRaise.baseline, options()),
    decisionContextStrategySeed(betRaise.counterfactual, options()),
  );

  const reorderedCards = {
    ...nominal.baseline,
    heroCards: [...nominal.baseline.heroCards].reverse(),
    board: [...nominal.baseline.board].reverse(),
  };
  assert.equal(
    decisionContextStrategySeed(nominal.baseline, options()),
    decisionContextStrategySeed(reorderedCards, options()),
  );
  assert.notEqual(
    decisionContextStrategySeed(
      POSTFLOP_COUNTERFACTUAL_CORPUS.multiwaySensitivity.baseline,
      options(),
    ),
    decisionContextStrategySeed(
      POSTFLOP_COUNTERFACTUAL_CORPUS.multiwaySensitivity.counterfactual,
      options(),
    ),
  );
  assert.notEqual(
    decisionContextStrategySeed(nominal.baseline, options()),
    decisionContextStrategySeed({
      ...nominal.baseline,
      board: ['Ah', '8d', '2c'],
    }, options()),
  );
});

test('postflop counterfactuals prove causal invariance, determinism, and multiway sensitivity', () => {
  const counterfactuals = evaluatePostflopCounterfactuals();
  assert.equal(counterfactuals.nominalSizeInvariant.sameSample, true);
  assert.equal(counterfactuals.nominalSizeInvariant.sameActions, true);
  assert.equal(counterfactuals.nominalSizeInvariant.maximumActionDelta, 0);
  assert.equal(counterfactuals.betRaiseEquivalentRange.sameSample, true);
  assert.equal(counterfactuals.betRaiseEquivalentRange.sameActions, true);
  assert.equal(counterfactuals.betRaiseEquivalentRange.maximumActionDelta, 0);
  assert.equal(counterfactuals.multiwaySensitivity.sameSample, false);
  assert.ok(counterfactuals.multiwaySensitivity.maximumActionDelta > 0);

  const provider = createCalibrationStrategyProvider();
  const context = POSTFLOP_COUNTERFACTUAL_CORPUS.nominalSizeInvariant.baseline;
  assert.deepEqual(provider.resolve(context), provider.resolve(context));
  const firstRng = createDeterministicHeuristicRng(context, options());
  const secondRng = createDeterministicHeuristicRng(context, options());
  assert.deepEqual(
    Array.from({ length: 20 }, () => firstRng()),
    Array.from({ length: 20 }, () => secondRng()),
  );
});

test('missing trusted postflop call price abstains with unsupported authority metadata', () => {
  const provider = createCalibrationStrategyProvider();
  const context = POSTFLOP_COUNTERFACTUAL_CORPUS.missingCallPrice.counterfactual;
  const result = provider.resolve(context);
  assert.ok(isStrategyResultV1(result));
  assert.equal(result.source, 'unavailable');
  assert.equal(result.actions.length, 0);
  assert.equal(result.recommendation, null);
  assert.equal(result.sourceDescriptor.authority, STRATEGY_SOURCE_AUTHORITIES.NONE);
  assert.equal(result.contextCoverage.kind, 'unsupported');
  assert.equal(result.contextCoverage.basis, 'missing_trusted_call_price');
  assert.deepEqual(
    result.contextCoverage.limitationCodes,
    ['heuristic_exact_call_price_unavailable'],
  );
  assert.match(result.explanation, /Exact call price is required/);
  assert.doesNotMatch(
    [result.explanation, ...result.warnings].filter(Boolean).join(' '),
    /GTO|Nash|optimal|EV loss/i,
  );

  assert.throws(
    () => calculatePostflopStrategyFromSample(context, options(), { eq: 0.5 }),
    /requires an exact callAmountBb/,
  );
});

test('genuine postflop contexts remain v2 deterministic heuristic results with normalized actions', () => {
  const provider = createCalibrationStrategyProvider();
  const context = calibrationDecisionContext({
    tableSize: 3,
    opponentCount: 2,
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c'],
    lastAction: 'bet',
    facingSizeBb: 5,
    callAmountBb: 5,
    potBb: 10,
  });
  const result = provider.resolve(context);
  assert.ok(isStrategyResultV1(result));
  assert.equal(result.source, 'heuristic_postflop');
  assert.equal(result.sourceVersion, 'riverline-postflop-heuristic/v2');
  assert.equal(availableProbabilityTotal(result), 1);
  assert.equal(result.details.heuristicSample.completedSamples, 250);
});
