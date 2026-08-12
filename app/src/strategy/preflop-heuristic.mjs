import { HEURISTIC_RANK_VALUES } from './heuristic-evaluator.mjs';

// Non-blind values progress from earlier/tighter to later/looser. Blind
// contexts receive explicit overrides below because they are not RFI seats.
export const PREFLOP_FALLBACK_POSITION_MODIFIERS = Object.freeze({
  UTG: -4,
  'UTG+1': -3.6,
  'UTG+2': -3.2,
  MP: -2.8,
  LJ: -2.4,
  HJ: -2,
  CO: -0.5,
  BTN: 1,
  SB: 1.5,
  BB: 3,
});

const NON_BLIND_POSITIONS = Object.freeze([
  'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN',
]);
const AGGRESSIVE_PRIOR_ACTIONS = Object.freeze(new Set(['raise', '3bet', '4bet']));

function bounded(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(minimum, maximum, value) {
  if (maximum <= minimum) return value >= maximum ? 1 : 0;
  const unit = bounded((value - minimum) / (maximum - minimum), 0, 1);
  return unit * unit * (3 - 2 * unit);
}

function normalizedStrategy(open, call, fold) {
  const weights = [open, call, fold].map((value) => (
    Number.isFinite(value) ? Math.max(0, value) : 0
  ));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) return { open: 0, call: 0, fold: 1 };
  const normalized = weights.map((value) => value / total);
  normalized[2] += 1 - normalized.reduce((sum, value) => sum + value, 0);
  return { open: normalized[0], call: normalized[1], fold: normalized[2] };
}

function strategyForStrength(handStrength, isPair) {
  const anchors = isPair
    ? [
      [16, [0.9, 0.08, 0.02]],
      [14, [0.8, 0.15, 0.05]],
      [10, [0.55, 0.35, 0.1]],
      [6, [0.1, 0.65, 0.25]],
      [3, [0.05, 0.5, 0.45]],
      [0, [0, 0, 1]],
    ]
    : [
      [14, [0.85, 0.1, 0.05]],
      [11, [0.65, 0.25, 0.1]],
      [9, [0.45, 0.35, 0.2]],
      [7, [0.2, 0.4, 0.4]],
      [5, [0.05, 0.25, 0.7]],
      [3, [0, 0, 1]],
      [0, [0, 0, 1]],
    ];

  if (handStrength >= anchors[0][0]) return anchors[0][1].slice();
  const lastAnchor = anchors[anchors.length - 1];
  if (handStrength <= lastAnchor[0]) return lastAnchor[1].slice();

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [highThreshold, highStrategy] = anchors[index];
    const [lowThreshold, lowStrategy] = anchors[index + 1];
    if (handStrength < lowThreshold || handStrength > highThreshold) continue;
    const interpolation = smoothstep(lowThreshold, highThreshold, handStrength);
    return [0, 1, 2].map((strategyIndex) => (
      lowStrategy[strategyIndex]
      + interpolation * (highStrategy[strategyIndex] - lowStrategy[strategyIndex])
    ));
  }
  return lastAnchor[1].slice();
}

function positionAdjustment(position, priorAction, isFreeCheckOption) {
  const configured = PREFLOP_FALLBACK_POSITION_MODIFIERS[position];
  let adjustment = configured ?? PREFLOP_FALLBACK_POSITION_MODIFIERS.UTG;

  if (isFreeCheckOption) return -1;
  if (priorAction === 'unopened' && (position === 'BTN' || position === 'SB')) {
    adjustment += 0.5;
  }
  if (AGGRESSIVE_PRIOR_ACTIONS.has(priorAction)) {
    if (position === 'SB') adjustment = -3.5;
    if (position === 'BB') adjustment = -1;
    if (['BTN', 'CO', 'HJ'].includes(position)) adjustment += 0.8;
  }
  return adjustment;
}

function stackDepthAdjustment({ stackBb, isPair, isSuited, connected, highRank, lowRank }) {
  const configuredDepth = Number.isFinite(stackBb) && stackBb >= 0 ? stackBb : 30;
  const shortWeight = 1 - smoothstep(10, 50, configuredDepth);
  const deepWeight = smoothstep(100, 300, configuredDepth);
  let adjustment = 0;

  if (isPair) adjustment += 0.45 * shortWeight;
  else if (highRank >= 12) adjustment += 0.3 * shortWeight;
  if (isSuited && connected && highRank <= 11) adjustment -= 0.35 * shortWeight;

  if (isSuited && connected && lowRank >= 5) adjustment += 0.45 * deepWeight;
  if (isPair && highRank <= 8) adjustment += 0.3 * deepWeight;
  return adjustment;
}

function responseTightness(priorAction, commitmentFraction) {
  const commitment = commitmentFraction === null ? null : bounded(commitmentFraction, 0, 1);
  if (priorAction === 'raise') {
    return commitment === null ? 0 : 3 * commitment / (commitment + 0.2);
  }
  if (priorAction === '3bet') {
    return commitment === null ? 3 : 3 + 3 * commitment / (commitment + 0.2);
  }
  if (priorAction === '4bet') {
    return commitment === null ? 6 : 6 + 4 * commitment / (commitment + 0.2);
  }
  return 0;
}

function collapseUnopenedPassiveMass(base) {
  // Preserve the old heuristic's tendency to convert passive mass into an
  // open for clearly playable hands, but replace its 25% binary gate with a
  // continuous transition for marginal hands.
  const passiveToRaiseShare = smoothstep(0.05, 0.3, base[0]);
  const passiveToRaise = base[1] * passiveToRaiseShare;
  return [base[0] + passiveToRaise, 0, base[2] + base[1] - passiveToRaise];
}

function applyKnownCallPrice(base, handStrength, potSizeBb, callAmountBb) {
  const priceDenominator = potSizeBb + callAmountBb;
  if (!(priceDenominator > 0) || base[2] <= 0) return base;
  const potOdds = callAmountBb / priceDenominator;
  const cheapness = 1 - smoothstep(0.08, 0.36, potOdds);
  const playability = 0.2 + 0.8 * smoothstep(3, 12, handStrength);
  const shiftToCall = base[2] * 0.55 * cheapness * playability;
  return [base[0], base[1] + shiftToCall, base[2] - shiftToCall];
}

export function calculatePreflopFallbackStrategy(
  r1str,
  r2str,
  isPair,
  isSuited,
  pos = 'UTG',
  action = 'unopened',
  facingSize = 0,
  potSize = 1.5,
  stack = 30,
  callAmountBb = null,
) {
  const r1 = HEURISTIC_RANK_VALUES[r1str] || 0;
  const r2 = HEURISTIC_RANK_VALUES[r2str] || 0;
  const highRank = Math.max(r1, r2);
  const lowRank = Math.min(r1, r2);
  const gap = highRank - lowRank;
  const hasAce = highRank === 14;
  const hasKing = highRank === 13;
  const bothBroadway = highRank >= 10 && lowRank >= 10;
  const connected = gap <= 1 && !isPair;
  const canonicalPosition = Object.hasOwn(PREFLOP_FALLBACK_POSITION_MODIFIERS, pos)
    ? pos
    : 'UTG';
  const normalizedAction = String(action || 'unopened').toLowerCase();
  const nominalFacingSize = Number.isFinite(Number(facingSize))
    ? Math.max(0, Number(facingSize))
    : 0;
  const trustedCallAmount = Number.isFinite(callAmountBb) && callAmountBb >= 0
    ? callAmountBb
    : null;
  const isFreeCheckOption = canonicalPosition === 'BB'
    && nominalFacingSize === 0
    && !AGGRESSIVE_PRIOR_ACTIONS.has(normalizedAction);

  let score = highRank;
  if (isPair) score += 6;
  if (gap > 4) score -= gap - 4;

  if (!isPair && !isSuited) {
    score -= 3;
    if (gap >= 3) score -= gap - 2;
    if (highRank <= 11) score -= (12 - highRank) * 0.8;
    if (lowRank <= 7) score -= (8 - lowRank) * 0.5;
  }

  const configuredStack = Number.isFinite(stack) && stack >= 0 ? stack : 30;
  const commitment = trustedCallAmount === null
    ? null
    : (configuredStack > 0 ? trustedCallAmount / configuredStack : 1);
  const actionTightness = responseTightness(normalizedAction, commitment);
  let handStrength = score
    + positionAdjustment(canonicalPosition, normalizedAction, isFreeCheckOption)
    + stackDepthAdjustment({
      stackBb: configuredStack,
      isPair,
      isSuited,
      connected,
      highRank,
      lowRank,
    })
    - actionTightness;

  if (isSuited) {
    handStrength += 1.5;
    if (hasAce) handStrength += 1.2;
    else if (connected && highRank >= 5) handStrength += 1.2;
  } else if (connected && highRank >= 7) {
    handStrength += 0.5;
  }
  if (bothBroadway && !isPair) handStrength += 1;
  if (hasAce && actionTightness > 0) handStrength += 1;
  else if (hasKing && actionTightness > 0) handStrength += 0.5;

  // Suited wheel-Ace playability and blocker value are encoded as a smooth
  // strength input, not as an action-specific replacement strategy.
  if (hasAce && isSuited) {
    const wheelAceWeight = 1 - smoothstep(5, 8, lowRank);
    handStrength += wheelAceWeight * (actionTightness > 0 ? 0.8 : 0.35);
  }

  let base = strategyForStrength(handStrength, isPair);
  const facingAggression = nominalFacingSize > 0 || AGGRESSIVE_PRIOR_ACTIONS.has(normalizedAction);

  if (!facingAggression && NON_BLIND_POSITIONS.includes(canonicalPosition)) {
    base = collapseUnopenedPassiveMass(base);
  }
  if (facingAggression && trustedCallAmount !== null) {
    base = applyKnownCallPrice(base, handStrength, Math.max(0, Number(potSize) || 0), trustedCallAmount);
  }
  if (isFreeCheckOption) {
    base[1] += base[2];
    base[2] = 0;
  }

  return normalizedStrategy(base[0], base[1], base[2]);
}

function strategyAction(type, amountBb = null) {
  return { type, amountBb, potFraction: null };
}

function preflopAggressiveLabel(lastAction, facingSizeBb) {
  if (facingSizeBb <= 0 && !AGGRESSIVE_PRIOR_ACTIONS.has(lastAction)) return 'Open';
  if (lastAction === 'raise') return '3-Bet';
  if (lastAction === '3bet') return '4-Bet';
  return 'Raise';
}

/**
 * A finite preflop amountBb is an amount-to: Hero's total preflop
 * contribution after acting. Facing aggression lacks a proven legal minimum
 * in DecisionContext v1, so the heuristic deliberately omits a raise size.
 */
function preflopAggressiveAction(decisionContext) {
  const lastAction = String(decisionContext.lastAction || 'unopened').toLowerCase();
  const facingSizeBb = Number(decisionContext.facingSizeBb) || 0;
  if (facingSizeBb > 0 || AGGRESSIVE_PRIOR_ACTIONS.has(lastAction)) {
    return strategyAction('raise');
  }

  const stackBb = Number.isFinite(decisionContext.stackBb)
    ? Math.max(0, decisionContext.stackBb)
    : 0;
  if (stackBb < 2) return strategyAction('all_in');
  const openToBb = 2 + 0.5 * smoothstep(20, 80, stackBb);
  return strategyAction('raise', Math.min(stackBb, Number(openToBb.toFixed(3))));
}

export function calculatePreflopHeuristic(decisionContext) {
  const cards = decisionContext.heroCards;
  if (!Array.isArray(cards) || cards.length !== 2 || !cards[0] || !cards[1]) return null;

  const lastAction = String(decisionContext.lastAction || 'unopened').toLowerCase();
  const facingSizeBb = Number(decisionContext.facingSizeBb) || 0;
  const fallback = calculatePreflopFallbackStrategy(
    cards[0][0],
    cards[1][0],
    cards[0][0] === cards[1][0],
    cards[0][1] === cards[1][1],
    decisionContext.heroPosition,
    lastAction,
    facingSizeBb,
    decisionContext.potBb,
    decisionContext.stackBb,
    decisionContext.callAmountBb,
  );
  const { open, call, fold } = fallback;
  const isFreeCheckOption = decisionContext.heroPosition === 'BB'
    && facingSizeBb === 0
    && !AGGRESSIVE_PRIOR_ACTIONS.has(lastAction);
  const passiveType = isFreeCheckOption ? 'check' : 'call';
  const passiveLabel = isFreeCheckOption
    ? 'Check'
    : facingSizeBb === 0 && decisionContext.heroPosition === 'SB' ? 'Limp' : 'Call';
  const aggressiveLabel = preflopAggressiveLabel(lastAction, facingSizeBb);
  const aggressiveAction = preflopAggressiveAction(decisionContext);
  const actions = [
    { action: aggressiveAction, label: aggressiveLabel, value: open, order: 0 },
    { action: strategyAction(passiveType), label: passiveLabel, value: call, order: 1 },
    { action: strategyAction('fold'), label: 'Fold', value: fold, order: 2 },
  ].sort((left, right) => right.value - left.value || left.order - right.order);

  const callPriceAvailable = Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0;
  return {
    source: 'heuristic_preflop',
    actions: actions.map(({ order: _order, ...entry }) => entry),
    recommendedActionLabel: actions[0].label,
    position: decisionContext.heroPosition,
    details: {
      method: 'deterministic_preflop_heuristic',
      amountSemantics: 'total_preflop_contribution_after_action',
      callPriceAvailable,
      priceAdjustmentApplied: (
        facingSizeBb > 0 || AGGRESSIVE_PRIOR_ACTIONS.has(lastAction)
      ) && callPriceAvailable,
      styleControlsApplied: false,
      forcedContributionAdjustmentApplied: false,
    },
  };
}
