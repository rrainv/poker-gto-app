import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PREFLOP_HAND_CLASSES,
  applyAction,
  applyChance,
  createAction,
  createEmptyCompleteHoldemRange,
  createFullyUnknownHoldemRange,
  createHoldemRangeProvenanceSource,
  createHoldemWeightedRangeFromHandClassWeights,
  initializeHand,
} from '../shared/poker-domain/index.js';
import {
  BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION,
  createBluffAnalysisFacts,
} from '../app/src/application/bluff-analysis.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createRangeAnalysisFacts } from '../app/src/application/range-analysis.mjs';
import { createStrategyResult } from '../app/src/application/strategy-result.mjs';

function context(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 2,
    opponentCount: 1,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['Kc', 'Qd'],
    board: ['2h', '7s', '9c'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 10,
    lastAction: 'check',
    facingSizeBb: 0,
    callAmountBb: 0,
    heroStreetContributionBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
  };
}

function strategy(action, options = {}) {
  return createStrategyResult({
    source: 'heuristic_postflop',
    actions: [{
      action: {
        type: action.type,
        amountBb: action.amountBb ?? null,
        potFraction: action.potFraction ?? null,
      },
      label: options.label || action.type,
      probability: options.probability ?? 1,
    }],
  });
}

function facts(decisionContext, strategyResult, ranges = {}) {
  const rangeAnalysisFacts = createRangeAnalysisFacts({ decisionContext, ranges });
  return createBluffAnalysisFacts({ decisionContext, strategyResult, rangeAnalysisFacts });
}

function completeRange() {
  const source = createHoldemRangeProvenanceSource({ id: 'complete', kind: 'manual' });
  return createHoldemWeightedRangeFromHandClassWeights({
    rangeId: 'complete-villain',
    provenanceSources: [source],
    handClassWeights: Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [
      handClass,
      { weight: handClass === 'AA' ? 0.5 : 1, provenanceId: source.id },
    ])),
  });
}

function partialRange() {
  const source = createHoldemRangeProvenanceSource({ id: 'partial', kind: 'manual' });
  return createHoldemWeightedRangeFromHandClassWeights({
    rangeId: 'partial-villain',
    provenanceSources: [source],
    handClassWeights: {
      AA: { weight: 1, provenanceId: source.id },
      AKs: { weight: 0.5, provenanceId: source.id },
      '76s': { weight: 0.25, provenanceId: source.id },
    },
  });
}

test('BluffAnalysisFacts v1 is immutable and calculates exact pure-bluff bet pressure', () => {
  const decisionContext = context();
  const result = facts(decisionContext, strategy({ type: 'bet', amountBb: 5 }, { label: 'Bet 5bb' }));
  assert.equal(result.schemaVersion, BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION);
  assert.equal(result.economics.availability, 'available');
  assert.equal(result.economics.potBeforeActionBb, 10);
  assert.equal(result.economics.riskBb, 5);
  assert.equal(result.economics.immediateRewardBb, 10);
  assert.equal(result.economics.breakEvenFoldFrequency, 1 / 3);
  assert.equal(result.opponentResponse.foldFrequencyAvailable, false);
  assert.equal(result.opponentResponse.expectedValueAvailable, false);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.economics));
  assert.ok(result.limitations.includes('no_opponent_fold_probability'));
  assert.ok(result.limitations.includes('no_action_ev'));
});

test('Ah4h on 2h3h9s reuses the exact 12-card outs model for semibluff structure', () => {
  const decisionContext = context({
    heroCards: ['Ah', '4h'],
    board: ['2h', '3h', '9s'],
  });
  const result = facts(decisionContext, strategy({ type: 'bet', potFraction: 0.5 }));
  assert.equal(result.economics.breakEvenFoldFrequency, 1 / 3);
  assert.equal(result.handStructure.classification, 'semibluff_structure');
  assert.deepEqual(result.handStructure.drawLabels, [
    'nut_flush_draw',
    'gutshot',
    'gutshot_straight_flush_draw',
  ]);
  assert.equal(result.handStructure.structuralImprovementCardCount, 12);
  assert.deepEqual(result.handStructure.drawOuts.overlaps, [{
    card: '5h', families: ['flush', 'straight', 'straight_flush'],
  }]);
  assert.equal(result.handStructure.equityCalculated, false);
});

test('open-ended straight-flush draw preserves both exact straight-flush completions', () => {
  const decisionContext = context({
    heroCards: ['6h', '7h'],
    board: ['8h', '9h', '2s'],
  });
  const result = facts(decisionContext, strategy({ type: 'bet', amountBb: 5 }));
  assert.equal(result.handStructure.classification, 'semibluff_structure');
  assert.ok(result.handStructure.drawLabels.includes('open_ended_straight_flush_draw'));
  assert.deepEqual(result.handStructure.drawOuts.straightFlush.completionCards, ['5h', 'Th']);
});

test('multiway pressure requires the joint all-opponents-fold event', () => {
  const result = facts(
    context({ opponentCount: 2, potBb: 12 }),
    strategy({ type: 'bet', amountBb: 6 }),
  );
  assert.equal(result.economics.breakEvenFoldFrequency, 1 / 3);
  assert.equal(result.economics.foldRequirementKind, 'required_all_opponents_fold_frequency');
  assert.equal(result.economics.allRelevantOpponentsMustFold, true);
});

test('range-free blockers stay neutral and never invent strategic quality', () => {
  const result = facts(
    context({ heroCards: ['As', 'Kd'], board: ['2h', '7s', '9c'] }),
    strategy({ type: 'bet', amountBb: 5 }),
  );
  assert.deepEqual(result.blockers.heroCards, ['As', 'Kd']);
  assert.equal(result.blockers.rawCombosRemoved, 101);
  assert.equal(result.blockers.interpretation, 'neutral_structural_removal');
  assert.equal(result.blockers.strategicQuality.available, false);
  assert.equal(result.suppliedOpponentRangeCount, 0);
  assert.equal(result.strategicPartitions.available, false);
});

test('complete, partial, and unknown supplied ranges preserve exact removal and coverage truth', () => {
  const decisionContext = context({ heroCards: ['As', 'Kd'] });
  const rangeFixtures = {
    complete: completeRange(),
    partial: partialRange(),
    unknown: createFullyUnknownHoldemRange({ rangeId: 'unknown-villain' }),
  };
  for (const [key, range] of Object.entries(rangeFixtures)) {
    const result = facts(decisionContext, strategy({ type: 'bet', amountBb: 5 }), {
      villain: { role: 'opponent', label: `${key} range`, range },
    });
    const effect = result.ranges.villain;
    assert.equal(
      effect.physicalComboCountBeforeHero - effect.physicalComboCountAfterHero,
      effect.physicalComboCountRemoved,
    );
    assert.equal(
      effect.knownComboCountBeforeHero - effect.knownComboCountAfterHero,
      effect.knownComboCountRemoved,
    );
    assert.ok(Math.abs(
      effect.knownComboMassBeforeHero - effect.knownComboMassAfterHero
        - effect.knownComboMassRemoved,
    ) < 1e-12);
    assert.equal(effect.behavioralFoldFrequencyAvailable, false);
    assert.equal(effect.strategicBlockerQualityAvailable, false);
  }
  const partial = facts(decisionContext, strategy({ type: 'bet', amountBb: 5 }), {
    villain: { role: 'opponent', range: rangeFixtures.partial },
  }).ranges.villain;
  assert.equal(partial.rangeState, 'partial');
  assert.equal(partial.normalizationAvailable, false);
  const unknown = facts(decisionContext, strategy({ type: 'bet', amountBb: 5 }), {
    villain: { role: 'opponent', range: rangeFixtures.unknown },
  }).ranges.villain;
  assert.equal(unknown.fullyUnknown, true);
  assert.equal(unknown.knownComboCountRemoved, 0);
  assert.equal(unknown.knownComboMassRemoved, 0);
  assert.ok(unknown.physicalComboCountRemoved > 0);
});

test('zero-known-mass complete range is not normalized or interpreted as behavioral evidence', () => {
  const result = facts(context(), strategy({ type: 'bet', amountBb: 5 }), {
    villain: { role: 'opponent', range: createEmptyCompleteHoldemRange() },
  });
  assert.equal(result.ranges.villain.complete, true);
  assert.equal(result.ranges.villain.knownComboMassAfterHero, 0);
  assert.equal(result.ranges.villain.normalizationAvailable, false);
  assert.equal(result.ranges.villain.behavioralFoldFrequencyAvailable, false);
});

test('river pot and half-pot bets expose only the scoped balanced-range reference', () => {
  for (const [betBb, foldRequirement, ratio, share] of [
    [10, 0.5, 0.5, 1 / 3],
    [5, 1 / 3, 1 / 3, 1 / 4],
  ]) {
    const decisionContext = context({
      street: 'river',
      heroCards: ['As', 'Kd'],
      board: ['2h', '7s', '9c', 'Jd', '3h'],
    });
    const result = facts(decisionContext, strategy({ type: 'bet', amountBb: betBb }));
    assert.equal(result.economics.breakEvenFoldFrequency, foldRequirement);
    assert.equal(result.riverReference.availability, 'available');
    assert.equal(result.riverReference.bluffToValueRatio, ratio);
    assert.equal(result.riverReference.bluffShareOfBettingRange, share);
    assert.equal(result.riverReference.actualSpotPrescription, false);
  }
});

function canonicalFacingRaiseContext() {
  let state = initializeHand({
    handId: 'bluff-001-raise',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [0, 1].map((seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: 100_000,
    })),
  });
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['As', 'Kd'], P1: ['Qh', 'Qc'] },
  });
  const act = (type, amountToMilliBb = null) => {
    state = applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
  };
  act(ACTION_TYPES.CALL);
  act(ACTION_TYPES.CHECK);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: ['2h', '7s', '9c'] });
  act(ACTION_TYPES.CHECK);
  act(ACTION_TYPES.BET, 2000);
  act(ACTION_TYPES.RAISE, 6000);
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId);
}

test('canonical Hand contribution semantics make raise risk incremental rather than raise-to', () => {
  const decisionContext = canonicalFacingRaiseContext();
  assert.equal(decisionContext.heroStreetContributionBb, 2);
  assert.equal(decisionContext.callAmountBb, 4);
  const result = facts(decisionContext, strategy({ type: 'raise', amountBb: 14 }));
  assert.equal(result.economics.availability, 'available');
  assert.equal(result.economics.amountSemantics, 'total_street_contribution_after_action');
  assert.equal(result.economics.riskBb, 12);
  assert.equal(result.economics.immediateRewardBb, decisionContext.potBb);
  assert.equal(
    result.economics.breakEvenFoldFrequency,
    12 / (12 + decisionContext.potBb),
  );
});

test('raise without trusted contribution semantics reports unavailable instead of fabricating risk', () => {
  const result = facts(
    context({ lastAction: 'bet', facingSizeBb: 4, callAmountBb: null, heroStreetContributionBb: null }),
    strategy({ type: 'raise', amountBb: 12 }),
  );
  assert.equal(result.economics.availability, 'unavailable');
  assert.equal(result.economics.unavailableReason, 'hero_street_contribution_unavailable');
  assert.equal(result.economics.breakEvenFoldFrequency, null);
});

test('edge economics never emit NaN or Infinity and unavailable states retain exact reasons', () => {
  const fixtures = [
    [context(), strategy({ type: 'bet', amountBb: 0 }), 'non_positive_risk'],
    [context(), strategy({ type: 'all_in', amountBb: 100 }), 'all_in_aggression_semantics_unavailable'],
    [context(), strategy({ type: 'check' }), 'current_action_not_aggressive'],
    [context(), strategy({ type: 'bet' }), 'bet_size_unavailable'],
  ];
  fixtures.forEach(([decisionContext, strategyResult, reason]) => {
    const result = facts(decisionContext, strategyResult);
    assert.equal(result.economics.unavailableReason, reason);
    assert.equal(result.economics.breakEvenFoldFrequency, null);
    assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  });

  for (const [potBb, riskBb, expected] of [
    [0, 5, 1],
    [10, 20, 2 / 3],
    [10, 0.1, 0.1 / 10.1],
  ]) {
    const result = facts(context({ potBb }), strategy({ type: 'bet', amountBb: riskBb }));
    assert.equal(result.economics.breakEvenFoldFrequency, expected);
    assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  }
});

test('river, plays-board, dead-card, and made-hand states remain structural rather than equity claims', () => {
  const fixtures = [
    context({
      street: 'river', heroCards: ['2c', '3d'],
      board: ['As', 'Kh', 'Qd', 'Jc', 'Ts'], deadCards: ['4h'],
    }),
    context({
      heroCards: ['9h', '9d'], board: ['9s', '8h', '7h'], deadCards: ['6c'],
    }),
    context({
      heroCards: ['As', 'Ah'], board: ['Ac', '7h', '2s'], deadCards: [],
    }),
  ];
  fixtures.forEach((decisionContext) => {
    const result = facts(decisionContext, strategy({ type: 'bet', amountBb: 5 }));
    assert.equal(result.handStructure.equityCalculated, false);
    assert.ok(result.limitations.includes('structural_outs_are_not_equity'));
    assert.doesNotMatch(JSON.stringify(result), /clean_out|rule_of_2|rule_of_4/i);
  });
});
