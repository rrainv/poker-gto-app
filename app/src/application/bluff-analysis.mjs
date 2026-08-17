import { RANGE_ANALYSIS_FACTS_SCHEMA_VERSION } from './range-analysis.mjs';
import { STRATEGY_RESULT_SCHEMA_VERSION } from './strategy-result.mjs';

export const BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION = 'bluff-analysis-facts/v1';

const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';
const AGGRESSIVE_ACTION_TYPES = new Set(['bet', 'raise', 'all_in']);
const MADE_HAND_CATEGORIES = new Set([
  'one_pair', 'two_pair', 'three_of_a_kind', 'straight', 'flush',
  'full_house', 'four_of_a_kind', 'straight_flush',
]);
const SIZE_EPSILON = 1e-9;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function finiteNonNegative(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function normalizedAction(entry, source) {
  const action = entry?.action || entry;
  if (!action || typeof action !== 'object') return null;
  const type = String(action.type || '');
  if (!type) return null;
  return {
    type,
    label: String(entry?.label || type),
    probability: finiteNonNegative(entry?.probability),
    amountBb: finiteNonNegative(action.amountBb),
    potFraction: finiteNonNegative(action.potFraction),
    source,
  };
}

function selectedAction(strategyResult, explicitAction) {
  if (explicitAction !== null && explicitAction !== undefined) {
    return normalizedAction(explicitAction, 'explicit_action');
  }
  const actions = Array.isArray(strategyResult?.actions) ? strategyResult.actions : [];
  let best = null;
  actions.forEach((entry, index) => {
    const probability = finiteNonNegative(entry?.probability) ?? 0;
    if (!best || probability > best.probability) best = { entry, probability, index };
  });
  return best ? normalizedAction(best.entry, 'strategy_recommendation') : null;
}

function unavailableEconomics(action, decision, reason, extra = {}) {
  return {
    availability: AGGRESSIVE_ACTION_TYPES.has(action?.type) ? 'unavailable' : 'not_applicable',
    unavailableReason: reason,
    actionType: action?.type ?? null,
    actionLabel: action?.label ?? null,
    actionSource: action?.source ?? null,
    actionProbability: action?.probability ?? null,
    amountBb: action?.amountBb ?? null,
    potFraction: action?.potFraction ?? null,
    amountSemantics: action?.type === 'raise'
      ? 'total_street_contribution_after_action'
      : action?.type === 'bet' ? 'incremental_wager' : null,
    potBeforeActionBb: finiteNonNegative(decision?.potBb),
    riskBb: null,
    immediateRewardBb: null,
    breakEvenFoldFrequency: null,
    opponentCount: Number.isInteger(decision?.opponentCount) ? decision.opponentCount : null,
    foldRequirementKind: null,
    allRelevantOpponentsMustFold: true,
    ...extra,
  };
}

function betRisk(action, potBeforeActionBb) {
  const amount = action.amountBb;
  const fraction = action.potFraction;
  if (amount === null && fraction === null) {
    return { riskBb: null, source: null, reason: 'bet_size_unavailable' };
  }
  const fractionRisk = fraction === null ? null : potBeforeActionBb * fraction;
  if (amount !== null && fractionRisk !== null
    && Math.abs(amount - fractionRisk) > SIZE_EPSILON) {
    return { riskBb: null, source: null, reason: 'conflicting_bet_size_semantics' };
  }
  return {
    riskBb: amount ?? fractionRisk,
    source: amount !== null ? 'absolute_amount' : 'pot_fraction',
    reason: null,
  };
}

function aggressiveEconomics(action, decision) {
  if (!action) return unavailableEconomics(null, decision, 'action_unavailable');
  if (!AGGRESSIVE_ACTION_TYPES.has(action.type)) {
    return unavailableEconomics(action, decision, 'current_action_not_aggressive');
  }
  const potBeforeActionBb = finiteNonNegative(decision?.potBb);
  if (potBeforeActionBb === null) {
    return unavailableEconomics(action, decision, 'pot_before_action_unavailable');
  }
  if (action.type === 'all_in') {
    return unavailableEconomics(action, decision, 'all_in_aggression_semantics_unavailable');
  }

  let riskBb = null;
  let riskSource = null;
  let amountSemantics = null;
  if (action.type === 'bet') {
    const sizing = betRisk(action, potBeforeActionBb);
    if (sizing.reason) return unavailableEconomics(action, decision, sizing.reason);
    riskBb = sizing.riskBb;
    riskSource = sizing.source;
    amountSemantics = 'incremental_wager';
  } else {
    if (action.amountBb === null) {
      return unavailableEconomics(action, decision, 'raise_to_amount_unavailable');
    }
    const contribution = finiteNonNegative(decision?.heroStreetContributionBb);
    if (contribution === null) {
      return unavailableEconomics(action, decision, 'hero_street_contribution_unavailable');
    }
    if (action.amountBb <= contribution + SIZE_EPSILON) {
      return unavailableEconomics(action, decision, 'raise_increment_not_positive');
    }
    const callAmount = finiteNonNegative(decision?.callAmountBb);
    if (callAmount !== null && action.amountBb <= contribution + callAmount + SIZE_EPSILON) {
      return unavailableEconomics(action, decision, 'raise_to_amount_does_not_exceed_call');
    }
    riskBb = action.amountBb - contribution;
    riskSource = 'raise_to_minus_trusted_contribution';
    amountSemantics = 'total_street_contribution_after_action';
  }

  if (!(riskBb > 0)) return unavailableEconomics(action, decision, 'non_positive_risk');
  const denominator = riskBb + potBeforeActionBb;
  if (!(denominator > 0) || !Number.isFinite(denominator)) {
    return unavailableEconomics(action, decision, 'break_even_denominator_unavailable');
  }
  const opponentCount = Number.isInteger(decision?.opponentCount)
    && decision.opponentCount >= 1 ? decision.opponentCount : null;
  return {
    availability: 'available',
    unavailableReason: null,
    actionType: action.type,
    actionLabel: action.label,
    actionSource: action.source,
    actionProbability: action.probability,
    amountBb: action.amountBb,
    potFraction: action.potFraction,
    amountSemantics,
    riskSource,
    potBeforeActionBb,
    riskBb,
    immediateRewardBb: potBeforeActionBb,
    breakEvenFoldFrequency: riskBb / denominator,
    opponentCount,
    foldRequirementKind: opponentCount !== null && opponentCount > 1
      ? 'required_all_opponents_fold_frequency'
      : 'required_fold_frequency',
    allRelevantOpponentsMustFold: true,
  };
}

function directDrawLabels(draws) {
  if (!draws?.available) return [];
  const labels = [];
  if (draws.flushDraw) labels.push(draws.nutFlushDraw ? 'nut_flush_draw' : 'flush_draw');
  if (draws.openEndedStraightDraw) labels.push('open_ended_straight_draw');
  if (draws.doubleGutshot) labels.push('double_gutshot');
  else if (draws.gutshot) labels.push('gutshot');
  if (draws.straightFlushDraw) {
    labels.push(draws.royalFlushDraw
      ? 'royal_flush_draw'
      : draws.straightFlushDrawType || 'straight_flush_draw');
  }
  return labels;
}

function handStructure(rangeAnalysisFacts) {
  const exact = rangeAnalysisFacts?.exactHand;
  if (!exact?.available) {
    return {
      availability: 'unavailable',
      classification: 'exact_hand_unavailable',
      madeHand: null,
      madeHandRelationship: null,
      drawLabels: [],
      overcardCount: 0,
      structuralImprovementCardCount: 0,
      drawOuts: null,
      equityCalculated: false,
    };
  }
  const draws = exact.draws;
  const drawLabels = directDrawLabels(draws);
  const uniqueCount = exact.drawOuts?.available
    ? exact.drawOuts.uniqueCompletionCardCount : 0;
  const madeHand = exact.primaryCategory;
  const hasMadeHand = MADE_HAND_CATEGORIES.has(madeHand);
  let classification = 'limited_direct_improvement_structure';
  if (drawLabels.length) {
    if (madeHand === 'one_pair') classification = 'pair_plus_draw';
    else if (hasMadeHand) classification = 'made_hand_with_redraw';
    else classification = 'semibluff_structure';
  } else if (exact.street === 'river') {
    classification = 'river_no_future_card_structure';
  } else if (hasMadeHand) {
    classification = 'made_hand_without_direct_draw';
  } else if (draws?.overcardCount > 0) {
    classification = 'overcards_without_direct_draw';
  }
  return {
    availability: 'available',
    classification,
    madeHand,
    madeHandRelationship: exact.relationship,
    playsBoard: Boolean(exact.playsBoard),
    drawLabels,
    overcardCount: draws?.overcardCount || 0,
    structuralImprovementCardCount: uniqueCount,
    drawOuts: exact.drawOuts ? cloneData(exact.drawOuts) : null,
    equityCalculated: false,
  };
}

function neutralBlockerFacts(rangeAnalysisFacts) {
  const blockers = rangeAnalysisFacts?.blockers;
  return {
    availability: blockers?.heroCards?.length ? 'available' : 'unavailable',
    interpretation: 'neutral_structural_removal',
    heroCards: blockers?.heroCards ? [...blockers.heroCards] : [],
    rawCombosRemoved: blockers?.rawCombosRemovedByHeroCards ?? null,
    perCard: blockers?.heroCardEffects
      ? blockers.heroCardEffects.map((entry) => ({ ...entry })) : [],
    strategicQuality: {
      available: false,
      unavailableReason: 'no_continue_fold_or_value_bluff_partition',
    },
  };
}

function rangeEffects(rangeAnalysisFacts) {
  const effects = {};
  for (const [key, analysis] of Object.entries(rangeAnalysisFacts?.ranges || {})) {
    if (analysis.role !== 'opponent' || !analysis.blockers.heroConditioningApplied) continue;
    const afterKnownCount = analysis.eligibility.knownEligibleComboCount;
    const removedKnownCount = analysis.blockers.heroRemovedKnownComboCount;
    const afterKnownMass = analysis.eligibility.knownEligibleComboMass;
    const removedKnownMass = analysis.blockers.heroRemovedKnownComboMass;
    effects[key] = {
      schemaVersion: 'bluff-analysis-range-effect/v1',
      key,
      subjectId: analysis.subjectId,
      label: analysis.label,
      source: cloneData(analysis.source),
      rangeState: analysis.inspection.state,
      fullyUnknown: analysis.inspection.fullyUnknown,
      complete: analysis.inspection.complete,
      physicalComboCountBeforeHero: analysis.blockers.physicalEligibleComboCountBeforeHero,
      physicalComboCountAfterHero: analysis.blockers.physicalEligibleComboCountAfterHero,
      physicalComboCountRemoved: analysis.blockers.heroRemovedComboCount,
      knownComboCountBeforeHero: afterKnownCount + removedKnownCount,
      knownComboCountAfterHero: afterKnownCount,
      knownComboCountRemoved: removedKnownCount,
      knownComboMassBeforeHero: afterKnownMass + removedKnownMass,
      knownComboMassAfterHero: afterKnownMass,
      knownComboMassRemoved: removedKnownMass,
      knownCoverageAfterHero: analysis.eligibility.eligibleCoverageRatio,
      normalizationAvailable: analysis.normalization.available,
      composition: cloneData(analysis.composition),
      mostAffectedClasses: analysis.blockers.mostAffectedClasses.map((entry) => ({ ...entry })),
      interpretation: 'exact_removal_against_supplied_range',
      behavioralFoldFrequencyAvailable: false,
      strategicBlockerQualityAvailable: false,
    };
  }
  return effects;
}

function riverReference(decision, economics) {
  if (decision?.street !== 'river') {
    return { availability: 'unavailable', unavailableReason: 'not_river' };
  }
  if (decision?.opponentCount !== 1) {
    return { availability: 'unavailable', unavailableReason: 'heads_up_not_proven' };
  }
  if (economics.availability !== 'available' || economics.actionType !== 'bet') {
    return { availability: 'unavailable', unavailableReason: 'clean_single_bet_semantics_unavailable' };
  }
  const pot = economics.potBeforeActionBb;
  const bet = economics.riskBb;
  if (!(pot >= 0) || !(bet > 0)) {
    return { availability: 'unavailable', unavailableReason: 'river_reference_sizing_unavailable' };
  }
  return {
    availability: 'available',
    label: 'river_balanced_range_reference_simplified',
    potBeforeActionBb: pot,
    betBb: bet,
    bluffToValueRatio: bet / (pot + bet),
    bluffShareOfBettingRange: bet / (pot + 2 * bet),
    assumptions: [
      'heads_up_single_river_bet',
      'bluffs_zero_showdown_value_when_called',
      'value_bets_always_win_when_called',
      'defender_indifferent_at_call_boundary',
    ],
    actualSpotPrescription: false,
  };
}

export function createBluffAnalysisFacts({
  decisionContext,
  strategyResult = null,
  rangeAnalysisFacts,
  action = null,
} = {}) {
  if (!decisionContext || decisionContext.schemaVersion !== DECISION_CONTEXT_SCHEMA_VERSION) {
    throw new TypeError('Expected DecisionContext decision-context/v1');
  }
  if (strategyResult !== null && strategyResult !== undefined
    && strategyResult.schemaVersion !== STRATEGY_RESULT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${STRATEGY_RESULT_SCHEMA_VERSION}`);
  }
  if (!rangeAnalysisFacts
    || rangeAnalysisFacts.schemaVersion !== RANGE_ANALYSIS_FACTS_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RANGE_ANALYSIS_FACTS_SCHEMA_VERSION}`);
  }
  const chosenAction = selectedAction(strategyResult, action);
  const economics = aggressiveEconomics(chosenAction, decisionContext);
  const ranges = rangeEffects(rangeAnalysisFacts);
  const facts = {
    schemaVersion: BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION,
    sourceSchemas: {
      decisionContext: decisionContext.schemaVersion,
      strategyResult: strategyResult?.schemaVersion ?? null,
      rangeAnalysisFacts: rangeAnalysisFacts.schemaVersion,
    },
    action: chosenAction ? { ...chosenAction } : null,
    economics,
    handStructure: handStructure(rangeAnalysisFacts),
    blockers: neutralBlockerFacts(rangeAnalysisFacts),
    ranges,
    suppliedOpponentRangeCount: Object.keys(ranges).length,
    strategicPartitions: {
      available: false,
      unavailableReason: 'no_continue_fold_or_value_bluff_partition',
      futureSeam: 'explicit_semantic_range_partitions',
    },
    opponentResponse: {
      foldFrequencyAvailable: false,
      expectedValueAvailable: false,
    },
    riverReference: riverReference(decisionContext, economics),
    limitations: [
      'no_opponent_fold_probability',
      'no_action_ev',
      'no_optimal_bluff_frequency',
      'no_strategic_blocker_quality_without_partitions',
      'structural_outs_are_not_equity',
      ...(economics.availability === 'unavailable'
        ? [`economics_${economics.unavailableReason}`] : []),
      ...(Object.keys(ranges).length ? [] : ['no_supplied_opponent_range']),
    ],
  };
  return deepFreeze(facts);
}
