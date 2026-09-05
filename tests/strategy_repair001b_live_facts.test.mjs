import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STRATEGY_SOURCE_AUTHORITIES,
  STRATEGY_SOURCE_REGISTRY,
} from '../app/src/application/strategy-source-authority.mjs';
import { isStrategyResultV1 } from '../app/src/application/strategy-result.mjs';
import {
  TRAINING_CONFIG_V1_SCHEMA_VERSION,
  TRAINING_DECISION_TYPES,
  generateTrainingExercise,
} from '../app/src/application/training-generator.mjs';
import {
  calculatePostflopStrategyFromSample,
  postflopEffectiveSprFacts,
} from '../app/src/strategy/postflop-heuristic.mjs';
import {
  PREFLOP_DECISION_FAMILIES,
  preflopDecisionFamilyFor,
} from '../app/src/strategy/preflop-heuristic.mjs';
import {
  STRATEGY_REPAIR001B_FROZEN_BASELINE,
  buildStrategyRepair001bBaseline,
} from './tooling/strategy-repair001b-baseline.mjs';
import {
  actionVectorForResult,
  buildStrategyQualitySnapshot,
  createCalibrationStrategyProvider,
} from './tooling/strategy-calibration-harness.mjs';
import {
  calibrationDecisionContext,
  representativeCardsForClass,
} from './tooling/strategy-calibration-corpora.mjs';

const OPTIONS = Object.freeze({ playStyle: 0, opponentStyle: 0, flatDropBb: 0 });

function history(aggressionFamily = 'bet') {
  return {
    lastActionFamily: aggressionFamily === 'none' ? 'check' : 'raise',
    lastActorPosition: aggressionFamily === 'none' ? null : 'BB',
    facingActionFamily: ['bet', 'raise'].includes(aggressionFamily)
      ? aggressionFamily
      : 'check',
    aggressionFamily,
    aggressionCount: aggressionFamily === 'none' ? 0 : aggressionFamily === 'raise' ? 2 : 1,
    limperCount: null,
    aggressorPosition: aggressionFamily === 'none' ? null : 'BB',
  };
}

function postflopContext(overrides = {}) {
  return calibrationDecisionContext({
    contractVersion: 'decision-context/v1.1',
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BTN',
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c'],
    stackBb: 100,
    startingStackBb: 100,
    heroStackBb: 40,
    effectiveStackBb: 40,
    effectiveStackByOpponent: [
      { position: 'BB', opponentStackBb: 40, effectiveStackBb: 40 },
    ],
    potBb: 10,
    currentPotBb: 10,
    lastAction: 'bet',
    facingSizeBb: 5,
    callAmountBb: 5,
    heroStreetContributionBb: 0,
    positionRelation: 'unknown',
    aggressorPositionRelation: 'unknown',
    canRaise: true,
    minRaiseToBb: 10,
    maxRaiseToBb: 40,
    allInToBb: 40,
    priorActionSummary: history('bet'),
    ...overrides,
  });
}

function preflopHistory(aggressionFamily = 'none', limperCount = 0) {
  return {
    lastActionFamily: limperCount > 0 ? 'limp' : aggressionFamily === 'none' ? 'none' : 'raise',
    lastActorPosition: limperCount > 0 || aggressionFamily !== 'none' ? 'BB' : null,
    facingActionFamily: limperCount > 0 ? 'limp' : aggressionFamily === 'none' ? 'none' : 'raise',
    aggressionFamily,
    aggressionCount: aggressionFamily === 'none' ? 0
      : aggressionFamily === 'open' ? 1
        : aggressionFamily === 'three_bet' ? 2 : 3,
    limperCount,
    aggressorPosition: aggressionFamily === 'none' ? null : 'BB',
  };
}

function preflopContext(handClass, overrides = {}) {
  const startingStackBb = overrides.startingStackBb ?? 100;
  return calibrationDecisionContext({
    contractVersion: 'decision-context/v1.1',
    tableSize: 6,
    opponentCount: 5,
    heroPosition: 'BTN',
    heroCards: representativeCardsForClass(handClass),
    board: [],
    stackBb: startingStackBb,
    startingStackBb,
    heroStackBb: 97.5,
    effectiveStackBb: null,
    effectiveStackByOpponent: [],
    potBb: 1.5,
    currentPotBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    callAmountBb: null,
    heroStreetContributionBb: 0,
    positionRelation: 'not_applicable',
    aggressorPositionRelation: 'not_applicable',
    canRaise: true,
    minRaiseToBb: 2,
    maxRaiseToBb: 100,
    allInToBb: 100,
    priorActionSummary: preflopHistory(),
    ...overrides,
  });
}

function strategyActions(strategy) {
  return Object.fromEntries(Object.entries(strategy).filter(([key]) => key !== 'context'));
}

function resultFor(context) {
  return createCalibrationStrategyProvider().resolve(context);
}

function probability(result, type) {
  return actionVectorForResult(result)[type];
}

test('v1.1 live effective SPR ignores legacy stack/pot and distinguishes shallow, medium, and deep HU play', () => {
  const base = postflopContext();
  const legacyA = resultFor({ ...base, stackBb: 10, potBb: 1 });
  const legacyB = resultFor({ ...base, stackBb: 500, potBb: 200 });
  assert.deepEqual(legacyB, legacyA);

  const sampled = (effectiveStackBb) => calculatePostflopStrategyFromSample(
    postflopContext({
      heroStackBb: effectiveStackBb,
      effectiveStackBb,
      effectiveStackByOpponent: [
        { position: 'BB', opponentStackBb: effectiveStackBb, effectiveStackBb },
      ],
      maxRaiseToBb: effectiveStackBb,
      allInToBb: effectiveStackBb,
    }),
    OPTIONS,
    { eq: 0.72 },
  );
  const shallow = sampled(8);
  const medium = sampled(40);
  const deep = sampled(200);
  assert.ok(shallow.Raise > medium.Raise);
  assert.ok(medium.Raise > deep.Raise);
  assert.equal(shallow.context.effectiveSpr.scalar, 0.8);
  assert.equal(medium.context.effectiveSpr.scalar, 4);
  assert.equal(deep.context.effectiveSpr.scalar, 20);
  assert.equal(medium.context.stackSemantics, 'decision_context_v1.1_heads_up_effective_stack');
  assert.equal(Object.hasOwn(medium.context, 'compatibilityStackToPotRatio'), false);
});

test('exact currentPotBb drives >200bb price math while missing live facts never fall back', () => {
  const huge = calculatePostflopStrategyFromSample(postflopContext({
    stackBb: 500,
    potBb: 200,
    currentPotBb: 275,
    heroStackBb: 100,
    effectiveStackBb: 100,
    effectiveStackByOpponent: [
      { position: 'BB', opponentStackBb: 100, effectiveStackBb: 100 },
    ],
    facingSizeBb: 25,
    callAmountBb: 25,
  }), OPTIONS, { eq: 0.4 });
  assert.equal(huge.context.requiredRawEquity, 25 / 300);
  assert.equal(huge.context.currentPotBbUsed, 275);
  assert.equal(huge.context.effectiveSpr.scalar, 100 / 275);

  const sameCurrentPot = calculatePostflopStrategyFromSample(postflopContext({
    stackBb: 10,
    potBb: 0.5,
    currentPotBb: 275,
    heroStackBb: 100,
    effectiveStackBb: 100,
    effectiveStackByOpponent: [
      { position: 'BB', opponentStackBb: 100, effectiveStackBb: 100 },
    ],
    facingSizeBb: 25,
    callAmountBb: 25,
  }), OPTIONS, { eq: 0.4 });
  assert.deepEqual(strategyActions(sameCurrentPot), strategyActions(huge));

  const missingLiveV11 = {
    ...postflopContext({ lastAction: 'check', facingSizeBb: 0, callAmountBb: 0 }),
  };
  delete missingLiveV11.currentPotBb;
  delete missingLiveV11.heroStackBb;
  delete missingLiveV11.effectiveStackBb;
  delete missingLiveV11.effectiveStackByOpponent;
  const degraded = calculatePostflopStrategyFromSample(
    missingLiveV11,
    OPTIONS,
    { eq: 0.4 },
  );
  assert.equal(degraded.context.currentPotBbUsed, null);
  assert.equal(degraded.context.effectiveSpr.kind, 'unavailable');
  assert.match(degraded.context.stackSemantics, /unavailable_no_compatibility_fallback/);

  const unavailable = resultFor({
    ...missingLiveV11, lastAction: 'bet', facingSizeBb: 5, callAmountBb: 5,
  });
  assert.equal(unavailable.source, 'unavailable');
  assert.equal(unavailable.contextCoverage.basis, 'missing_trusted_decision_economics');
});

test('postflop position and raise history use bounded shared rules while mixed/unknown stay safe', () => {
  const sampled = (overrides) => calculatePostflopStrategyFromSample(
    postflopContext(overrides),
    OPTIONS,
    { eq: 0.72 },
  );
  const ip = sampled({
    positionRelation: 'in_position', aggressorPositionRelation: 'in_position',
  });
  const unknown = sampled({
    positionRelation: 'unknown', aggressorPositionRelation: 'unknown',
  });
  const oop = sampled({
    positionRelation: 'out_of_position', aggressorPositionRelation: 'out_of_position',
  });
  assert.ok(ip.Raise > unknown.Raise);
  assert.ok(unknown.Raise > oop.Raise);
  assert.equal(unknown.context.positionAdjustment.rate, 0);

  const mixed = sampled({
    tableSize: 3,
    opponentCount: 2,
    effectiveStackBb: null,
    effectiveStackByOpponent: [
      { position: 'SB', opponentStackBb: 20, effectiveStackBb: 20 },
      { position: 'BB', opponentStackBb: 80, effectiveStackBb: 40 },
    ],
    positionRelation: 'mixed',
    aggressorPositionRelation: 'out_of_position',
  });
  assert.equal(mixed.context.effectiveSpr.kind, 'multiway_per_opponent_spr_range');
  assert.equal(mixed.context.effectiveSpr.adjustmentEnabled, false);
  assert.match(mixed.context.positionAdjustment.semantics, /not_collapsed/);

  const facingBet = sampled({ priorActionSummary: history('bet') });
  const facingRaise = sampled({
    lastAction: 'raise', priorActionSummary: history('raise'),
  });
  assert.ok(facingRaise.Raise < facingBet.Raise);
  assert.equal(facingRaise.context.historyAdjustment.applied, true);

  const preflop = preflopContext('AJs');
  assert.deepEqual(
    resultFor({ ...preflop, positionRelation: 'in_position' }).actions,
    resultFor({ ...preflop, positionRelation: 'out_of_position' }).actions,
  );
});

test('known legal aggression removes impossible actions and represents only-legal short all-ins honestly', () => {
  const illegal = resultFor(postflopContext({
    canRaise: false, minRaiseToBb: null, maxRaiseToBb: null,
  }));
  assert.equal(probability(illegal, 'raise'), 0);
  assert.equal(probability(illegal, 'bet'), 0);
  assert.equal(probability(illegal, 'all_in'), 0);
  assert.equal(probability(illegal, 'call') + probability(illegal, 'fold'), 1);

  const shortAllInContext = postflopContext({
    heroStackBb: 3,
    effectiveStackBb: 3,
    effectiveStackByOpponent: [
      { position: 'BB', opponentStackBb: 40, effectiveStackBb: 3 },
    ],
    facingSizeBb: 2,
    callAmountBb: 2,
    canRaise: true,
    minRaiseToBb: null,
    maxRaiseToBb: 3,
    allInToBb: 3,
  });
  const shortAllIn = resultFor(shortAllInContext);
  assert.equal(probability(shortAllIn, 'raise'), 0);
  assert.ok(probability(shortAllIn, 'all_in') > 0);
  assert.equal(shortAllIn.capabilities.actionSizing, 'none');
  assert.equal(shortAllIn.details.legalAggression.shortAllInProjectionApplied, true);

  const noStrategicShove = calculatePostflopStrategyFromSample({
    ...shortAllInContext,
    heroCards: ['8h', '3d'],
    board: ['As', 'Kd', '2c'],
  }, OPTIONS, { eq: 0.1 });
  assert.equal(Number(noStrategicShove.AllIn || 0), 0);

  const noPreflopRaise = resultFor(preflopContext('AJs', {
    canRaise: false, minRaiseToBb: null, maxRaiseToBb: null,
  }));
  assert.equal(probability(noPreflopRaise, 'raise'), 0);
  assert.equal(probability(noPreflopRaise, 'all_in'), 0);
});

test('limps and facing-action families are structurally distinct without aggression plateaus', () => {
  const provider = createCalibrationStrategyProvider();
  const unopened = preflopContext('AJs');
  const oneLimp = preflopContext('AJs', {
    lastAction: 'check', priorActionSummary: preflopHistory('none', 1),
  });
  const multipleLimps = preflopContext('AJs', {
    lastAction: 'check', priorActionSummary: preflopHistory('none', 3),
  });
  assert.equal(preflopDecisionFamilyFor(unopened), PREFLOP_DECISION_FAMILIES.RFI);
  assert.equal(preflopDecisionFamilyFor(oneLimp), PREFLOP_DECISION_FAMILIES.LIMPED);
  assert.notDeepEqual(provider.resolve(unopened).actions, provider.resolve(oneLimp).actions);
  assert.notDeepEqual(provider.resolve(oneLimp).actions, provider.resolve(multipleLimps).actions);
  assert.ok(probability(provider.resolve(multipleLimps), 'call')
    > probability(provider.resolve(oneLimp), 'call'));

  const response = (handClass, family, lastAction, facingSizeBb, callAmountBb, potBb) => (
    provider.resolve(preflopContext(handClass, {
      lastAction,
      facingSizeBb,
      callAmountBb,
      currentPotBb: potBb,
      potBb,
      priorActionSummary: preflopHistory(family),
    }))
  );
  const open = response('AJs', 'open', 'raise', 2.5, 1.5, 3.5);
  const threeBet = response('AJs', 'three_bet', '3bet', 8, 5.5, 11.5);
  const fourBet = response('AJs', 'four_bet_or_more', '4bet', 20, 12, 31.5);
  assert.ok(probability(open, 'raise') > probability(threeBet, 'raise'));
  assert.ok(probability(threeBet, 'raise') > probability(fourBet, 'raise'));
  assert.ok(probability(threeBet, 'raise') < 0.5);
  assert.ok(probability(fourBet, 'raise') < 0.2);

  const kqsThreeBet = response('KQs', 'three_bet', '3bet', 8, 5.5, 11.5);
  const qqFourBet = response('QQ', 'four_bet_or_more', '4bet', 20, 12, 31.5);
  assert.ok(probability(kqsThreeBet, 'raise') < 0.5);
  assert.ok(probability(qqFourBet, 'raise') < 0.5);
  assert.equal(threeBet.details.decisionFamily, PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET);
  assert.equal(fourBet.details.decisionFamily, PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE);
});

test('exact price is causal while nominal wager-to labels remain invariant', () => {
  const baseline = postflopContext({
    heroCards: ['8h', '3d'],
    board: ['As', 'Kd', '2c'],
    facingSizeBb: 2,
    callAmountBb: 2,
    positionRelation: 'unknown',
    aggressorPositionRelation: 'unknown',
  });
  const nominal = calculatePostflopStrategyFromSample(baseline, OPTIONS, { eq: 0.35 });
  const relabeled = calculatePostflopStrategyFromSample(
    { ...baseline, facingSizeBb: 12 },
    OPTIONS,
    { eq: 0.35 },
  );
  assert.deepEqual(strategyActions(relabeled), strategyActions(nominal));

  const expensive = calculatePostflopStrategyFromSample(
    {
      ...baseline,
      callAmountBb: 10,
      actorContestablePotAfterCallBb: 20,
      requiredRawEquity: 0.5,
    },
    OPTIONS,
    { eq: 0.35 },
  );
  assert.ok(Number(expensive.Fold || 0) > Number(nominal.Fold || 0));
  assert.equal(nominal.context.requiredRawEquity, 2 / 12);
  assert.equal(expensive.context.requiredRawEquity, 0.5);
});

test('diagnostic corpus shows real deltas while authority and Training contracts remain intact', () => {
  const diagnostics = buildStrategyRepair001bBaseline();
  assert.equal(diagnostics.baseline, STRATEGY_REPAIR001B_FROZEN_BASELINE);
  assert.ok(diagnostics.deltas.find((row) => row.id === 'one_limp').maximumActionDelta > 0.4);
  assert.ok(diagnostics.deltas.find((row) => row.id === 'facing_4bet').maximumActionDelta > 0.6);
  assert.ok(diagnostics.deltas.find((row) => row.id === 'post_oop').maximumActionDelta > 0.05);
  assert.equal(diagnostics.deltas.find((row) => row.id === 'rfi_six_btn').maximumActionDelta, 0);
  const quality = buildStrategyQualitySnapshot();
  assert.ok(
    quality.preflop.historyCounterfactuals.unopenedVersusOneLimp.maximumActionDelta > 0,
  );
  assert.ok(quality.preflop.historyCounterfactuals.oneVersusMultipleLimps.maximumActionDelta > 0);
  assert.ok(quality.postflop.counterfactuals.positionSensitivity.maximumActionDelta > 0);
  assert.ok(quality.postflop.counterfactuals.effectiveStackSensitivity.maximumActionDelta > 0);
  assert.ok(quality.postflop.counterfactuals.effectiveStackShallowToMedium.maximumActionDelta > 0);
  assert.ok(quality.postflop.counterfactuals.effectiveStackMediumToDeep.maximumActionDelta > 0);
  assert.ok(quality.postflop.counterfactuals.legalAggressionSensitivity.maximumActionDelta > 0);
  assert.ok(quality.postflop.counterfactuals.exactPriceSensitivity.maximumActionDelta > 0);
  assert.ok(quality.postflop.counterfactuals.postflopRaiseHistorySensitivity.maximumActionDelta > 0);
  assert.ok(quality.preflop.historyCounterfactuals.unopenedVersusFacingOpen.maximumActionDelta > 0);
  assert.ok(quality.preflop.historyCounterfactuals.facingOpenVersusThreeBet.maximumActionDelta > 0);
  assert.ok(
    quality.preflop.historyCounterfactuals.facingThreeBetVersusFourBet.maximumActionDelta > 0,
  );

  for (const id of ['heuristic_preflop', 'heuristic_postflop']) {
    const descriptor = STRATEGY_SOURCE_REGISTRY[id];
    assert.equal(descriptor.authority, STRATEGY_SOURCE_AUTHORITIES.EXPLORATORY);
    assert.equal(descriptor.capabilities.actionEv, false);
    assert.equal(descriptor.capabilities.optimality, false);
    assert.equal(descriptor.defaultCoverage, 'generalized');
  }

  const provider = createCalibrationStrategyProvider();
  const targets = Object.values(TRAINING_DECISION_TYPES);
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const street = target.startsWith('preflop') ? 'preflop' : 'flop';
    const generated = generateTrainingExercise({
      schemaVersion: TRAINING_CONFIG_V1_SCHEMA_VERSION,
      gameMode: 'home',
      tableSize: 6,
      stackBb: 100,
      streets: [street],
      heroPositions: ['BTN', 'BB', 'SB', 'CO', 'HJ', 'UTG'],
      allowedDecisionTypes: [target],
      difficulty: 'hard',
      seed: 6200 + index,
    }, { strategyProvider: provider });
    assert.equal(generated.ok, true, target);
    assert.ok(isStrategyResultV1(generated.exercise.strategyResult), target);
    assert.equal(generated.exercise.strategyResult.contextCoverage.kind, 'generalized', target);
    assert.equal(
      generated.exercise.strategyResult.actions.reduce(
        (sum, entry) => sum + entry.probability,
        0,
      ),
      1,
      target,
    );
  }
});
