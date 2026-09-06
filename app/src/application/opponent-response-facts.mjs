import { createSyntheticResponseFacts, createSyntheticConfiguration, SYNTHETIC_PRESETS } from './synthetic-opponent-policy.mjs';
import { freezeLanguageData as freeze } from './natural-language-envelope.mjs';

export const OPPONENT_RESPONSE_FACTS_VERSION = 'opponent-response-facts/v1';
export function responseIdentity(value) {
  if (Array.isArray(value)) return `[${value.map(responseIdentity).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${responseIdentity(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const unknown = reason => ({ availability: 'unavailable', reason });
const weight = (policy, kind, type) => policy.branches.find(branch => branch.kind === kind
  && (kind === 'check_available' ? branch.aggressionAvailable : branch.raiseAvailable))
  .weights.find(item => item.type === type)?.weight ?? 0;

// Compare the selector's actual branch weights, including the weight reserved
// for raises. Labels and hand categories never select the conclusion.
export function derivePolicyIncentives(policy) {
  const peers = Object.values(SYNTHETIC_PRESETS).map(parameters => createSyntheticResponseFacts(createSyntheticConfiguration(parameters)));
  const highest = (kind, type) => peers.every(peer => weight(policy, kind, type) >= weight(peer, kind, type))
    && peers.some(peer => weight(policy, kind, type) > weight(peer, kind, type));
  const lowest = (kind, type) => peers.every(peer => weight(policy, kind, type) <= weight(peer, kind, type))
    && peers.some(peer => weight(policy, kind, type) < weight(peer, kind, type));
  const signals = [];
  if (['small_price', 'large_price'].every(kind => highest(kind, 'call') && lowest(kind, 'fold'))) signals.push('more_calls_less_fold_pressure');
  if (['small_price', 'large_price'].every(kind => highest(kind, 'fold') && weight(policy, kind, 'call') < weight(peers[0], kind, 'call'))) signals.push('more_folds_fewer_value_calls');
  if (highest('small_price', 'raise')) signals.push('more_raise_pressure');
  if (highest('check_available', 'bet')) signals.push('more_free_aggression');
  if (!signals.length) signals.push('mixed_response_tradeoff');
  return freeze({ availability: 'assumption_conditioned', signals,
    criterion: 'branch_weight_extrema_against_builtins_with_strict_difference/v1',
    signalCriteria: { more_calls_less_fold_pressure: 'highest_calls_and_lowest_folds_in_both_raise_legal_price_branches',
      more_folds_fewer_value_calls: 'highest_folds_in_both_raise_legal_price_branches_and_fewer_calls_than_calling_heavy',
      more_raise_pressure: 'highest_legal_raise_weight', more_free_aggression: 'highest_legal_free_aggression_weight' },
    comparisonSet: peers.map(peer => ({ policyId: peer.policyId, policyVersion: peer.policyVersion, configuration: peer.configuration })),
    conditions: ['same_price_branch', 'aggression_legal', 'same_explicit_reached_range_if_comparing_hands'],
    actionRecommendation: false, normativeAssessment: false });
}

// A Hero node does not provide the next opponent's legal actions, stack-capped
// price or reached range. Bind the question exactly, but keep branch selection
// unavailable instead of guessing from Hero's bet/pot ratio.
export function createOpponentResponseFacts({ decisionContext, action = null, configuration } = {}) {
  if (decisionContext?.schemaVersion !== 'decision-context/v1') throw new TypeError('DecisionContext required');
  const policy = createSyntheticResponseFacts(configuration);
  const postflop = ['flop', 'turn', 'river'].includes(decisionContext.street);
  return freeze({ schemaVersion: OPPONENT_RESPONSE_FACTS_VERSION,
    contextKey: responseIdentity(decisionContext), actionKey: responseIdentity(action),
    policy, evidenceKind: 'explicit_synthetic_assumption',
    actionSelection: { availability: 'conditional', branches: policy.branches, sampleSpace: policy.sampleSpace },
    responseToSmallPrice: policy.branches.filter(branch => branch.kind === 'small_price'),
    responseToLargePrice: policy.branches.filter(branch => branch.kind === 'large_price'),
    currentResponse: unknown('next_opponent_actor_price_and_legality_not_supplied'),
    quantitativeResponseProbabilities: unknown('no_quantitative_response_contract'),
    comboConditioning: unknown('no_combo_likelihood_contract'),
    betAfterCheck: { availability: 'conditional', branch: policy.branches.filter(branch => branch.kind === 'check_available'),
      historySpecific: false, reason: 'general_free_aggression_only' },
    checkRaise: unknown('no_history_specific_check_raise_policy'),
    riverAggression: { availability: decisionContext.street === 'river' ? 'conditional' : 'not_current_street',
      streetSpecific: false, reason: 'same_all_street_parameters' },
    unsupportedContexts: ['combo_response', 'reached_value_bluff_regions', 'population_model',
      'history_specific_bet_after_check', 'street_specific_river_aggression', 'check_raise_frequency'],
    teaching: postflop ? derivePolicyIncentives(policy) : unknown('postflop_exploit_teaching_only'),
    normativeAssessment: false });
}
