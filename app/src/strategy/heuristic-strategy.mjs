import { calculatePreflopHeuristic } from './preflop-heuristic.mjs';
import {
  calculatePostflopHeuristicStrategy,
  postflopContextFacesWager,
  postflopOpponentRangeAssumption,
} from './postflop-heuristic.mjs';

export const DEFAULT_HEURISTIC_OPTIONS = Object.freeze({
  playStyle: 0,
  opponentStyle: 0,
  flatDropBb: 0,
});

function boundedUnit(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 0;
}

export function normalizeHeuristicOptions(options = {}) {
  const flatDrop = Number(options?.flatDropBb);
  return Object.freeze({
    playStyle: boundedUnit(options?.playStyle),
    opponentStyle: boundedUnit(options?.opponentStyle),
    flatDropBb: Number.isFinite(flatDrop) ? Math.max(0, flatDrop) : 0,
  });
}

export function decisionContextStrategySeed(decisionContext, rawOptions = {}) {
  const options = normalizeHeuristicOptions(rawOptions);
  const effectiveOpponentCount = Number.isInteger(decisionContext?.opponentCount)
    && decisionContext.opponentCount >= 1
    ? decisionContext.opponentCount
    : Math.max(1, (Number(decisionContext?.tableSize) || 2) - 1);
  const canonicalCards = (cards) => (
    Array.isArray(cards) ? cards.filter(Boolean).map(String).sort() : []
  );
  // Only facts that define the sampled population participate. Nominal wager
  // labels/amounts collapse to the exact opponent-range assumption consumed by
  // the sampler, so equivalent assumptions receive the same sample.
  const input = JSON.stringify({
    opponentCount: effectiveOpponentCount,
    heroCards: canonicalCards(decisionContext?.heroCards),
    board: canonicalCards(decisionContext?.board),
    deadCards: canonicalCards(decisionContext?.deadCards),
    opponentRangeAssumption: postflopOpponentRangeAssumption(decisionContext),
    opponentStyle: options.opponentStyle,
  });
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createDeterministicHeuristicRng(decisionContext, rawOptions = {}) {
  let state = decisionContextStrategySeed(decisionContext, rawOptions) || 0x9e3779b9;
  return function heuristicRandom() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function hasValidHeroHand(cards) {
  if (!Array.isArray(cards) || cards.length !== 2) return false;
  return cards.every((card) => (
    typeof card === 'string'
    && card.length >= 2
    && 'AKQJT98765432'.includes(card[0])
  ));
}

function unavailableCandidate(reason, details = null, contextCoverage = null) {
  return {
    source: 'unavailable',
    actions: [],
    explanation: reason || null,
    warnings: reason ? [String(reason)] : [],
    details,
    contextCoverage,
  };
}

function preflopCandidate(decisionContext) {
  const result = calculatePreflopHeuristic(decisionContext);
  const actionLabel = result.recommendedActionLabel;
  return {
    source: result.source,
    provenance: {
      origin: 'riverline_builtin',
      generationMethod: 'deterministic_preflop_heuristic',
      assumptions: [
        'broad_position_and_hand_playability_rules',
        'separate_structural_hand_features_for_exact_cold_response_role',
        'role_specific_policy_is_generalized_not_a_hand_chart',
        'not_independently_solver_validated',
      ],
    },
    actions: result.actions,
    recommendedLabel: actionLabel.toUpperCase(),
    explanation: `The heuristic baseline prefers ${actionLabel} using approximate hand and position rules.`,
    details: result.details,
  };
}

function postflopCandidate(decisionContext, options, rng) {
  const strategy = calculatePostflopHeuristicStrategy(decisionContext, options, rng);
  const actionTypes = {
    Bet: 'bet',
    Check: 'check',
    Raise: 'raise',
    Call: 'call',
    Fold: 'fold',
    AllIn: 'all_in',
  };
  const actions = Object.entries(strategy)
    .filter(([name, value]) => name !== 'context' && Number.isFinite(Number(value)))
    .map(([name, value]) => ({
      action: { type: actionTypes[name], amountBb: null, potFraction: null },
      label: name,
      value: Number(value),
    }))
    .sort((left, right) => right.value - left.value);
  const recommendedAction = actions[0]?.label || 'Check';
  const sample = strategy.context?.heuristicSample || null;
  const sampledPercent = Number.isFinite(sample?.eq) ? (sample.eq * 100).toFixed(1) : '—';
  const candidatePercent = Number.isFinite(sample?.rangeFraction)
    ? (sample.rangeFraction * 100).toFixed(1)
    : '—';

  return {
    source: 'heuristic_postflop',
    provenance: {
      origin: 'riverline_builtin',
      generationMethod: 'deterministic_postflop_heuristic_with_seeded_conditional_sampling',
      assumptions: [
        'shared_crude_opponent_range',
        'bounded_position_adjustment_not_equilibrium_frequency',
        'heads_up_effective_spr_only_multiway_scalar_disabled',
        'legal_aggression_projection_from_decision_context',
        'action_sizing_not_supplied',
        'not_independently_solver_validated',
      ],
    },
    actions,
    recommendedLabel: recommendedAction.toUpperCase(),
    explanation: `Heuristic sampled equity: ${sampledPercent}% against an assumed opponent range (${candidatePercent}% of unblocked combinations).`,
    details: strategy.context || null,
  };
}

/**
 * Provider-facing deterministic fallback resolver. All environment-derived
 * settings arrive through the explicit options object; no UI globals are read.
 */
export function resolveHeuristicStrategy(
  decisionContext,
  rawOptions = DEFAULT_HEURISTIC_OPTIONS,
) {
  const options = normalizeHeuristicOptions(rawOptions);
  if (!hasValidHeroHand(decisionContext?.heroCards)) {
    return unavailableCandidate(
      'Choose two hero cards to calculate a heuristic strategy.',
    );
  }
  if (decisionContext.street === 'invalid') {
    return unavailableCandidate(
      'Complete the current board street: 0, 3, 4, or 5 board cards.',
    );
  }
  if (decisionContext.street === 'preflop') return preflopCandidate(decisionContext);
  const trustedCallPrice = Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0;
  const trustedActorEconomics = decisionContext.contractVersion === 'decision-context/v1.1'
    && Number.isFinite(decisionContext.actorContestablePotAfterCallBb)
    && decisionContext.actorContestablePotAfterCallBb > 0
    && Number.isFinite(decisionContext.requiredRawEquity)
    && decisionContext.requiredRawEquity >= 0
    && decisionContext.requiredRawEquity <= 1;
  if (postflopContextFacesWager(decisionContext)
    && (!trustedCallPrice || !trustedActorEconomics)) {
    return unavailableCandidate(
      'Exact actor-relative call economics are required for a postflop facing-wager heuristic strategy.',
      { providerReason: 'exact_decision_economics_unavailable' },
      {
        kind: 'unsupported',
        basis: 'missing_trusted_decision_economics',
        limitationCodes: ['heuristic_exact_call_price_unavailable'],
      },
    );
  }
  return postflopCandidate(
    decisionContext,
    options,
    createDeterministicHeuristicRng(decisionContext, options),
  );
}
