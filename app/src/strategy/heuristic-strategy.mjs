import { calculatePreflopHeuristic } from './preflop-heuristic.mjs';
import { calculatePostflopHeuristicStrategy } from './postflop-heuristic.mjs';

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
  // Only sampled-strength inputs participate. Presentation/accounting fields
  // that do not change the opponent/runout sampler cannot perturb it.
  const input = JSON.stringify({
    tableSize: decisionContext?.tableSize,
    opponentCount: effectiveOpponentCount,
    heroCards: decisionContext?.heroCards,
    board: decisionContext?.board,
    deadCards: decisionContext?.deadCards,
    facingSizeBb: decisionContext?.facingSizeBb,
    lastAction: decisionContext?.lastAction,
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

function unavailableCandidate(reason, translate) {
  const translatedReason = translate(reason);
  return {
    source: 'unavailable',
    actions: [],
    explanation: translatedReason || null,
    warnings: translatedReason ? [String(translatedReason)] : [],
  };
}

function preflopCandidate(decisionContext, translate) {
  const result = calculatePreflopHeuristic(decisionContext);
  const actionLabel = result.recommendedActionLabel;
  return {
    source: result.source,
    actions: result.actions,
    recommendedLabel: translate(actionLabel).toUpperCase(),
    explanation: `${translate('Mathematical Fallback suggests')} ${translate(actionLabel)} ${translate('based on hand playability & position.')}`,
    details: result.details,
  };
}

function postflopCandidate(decisionContext, options, translate, rng) {
  const strategy = calculatePostflopHeuristicStrategy(decisionContext, options, rng);
  const actionTypes = {
    Bet: 'bet',
    Check: 'check',
    Raise: 'raise',
    Call: 'call',
    Fold: 'fold',
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
    actions,
    recommendedLabel: translate(recommendedAction).toUpperCase(),
    explanation: `${translate('Heuristic sampled equity')}: ${sampledPercent}% ${translate('against an assumed opponent range')} (${candidatePercent}% ${translate('of unblocked combinations')}).`,
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
  { translate = (value) => String(value) } = {},
) {
  const options = normalizeHeuristicOptions(rawOptions);
  if (!hasValidHeroHand(decisionContext?.heroCards)) {
    return unavailableCandidate(
      'Choose two hero cards to calculate a heuristic strategy.',
      translate,
    );
  }
  if (decisionContext.street === 'invalid') {
    return unavailableCandidate(
      'Complete the current board street: 0, 3, 4, or 5 board cards.',
      translate,
    );
  }
  if (decisionContext.street === 'preflop') return preflopCandidate(decisionContext, translate);
  return postflopCandidate(
    decisionContext,
    options,
    translate,
    createDeterministicHeuristicRng(decisionContext, options),
  );
}
