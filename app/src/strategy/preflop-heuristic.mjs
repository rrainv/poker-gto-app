import { HEURISTIC_RANK_VALUES } from './heuristic-evaluator.mjs';
import { POSITIONS_BY_TABLE_SIZE } from '../../../shared/poker-domain/positions.js';

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
const FULL_RING_MINIMUM_TABLE_SIZE = 8;
const FULL_RING_EARLY_POSITION_ADJUSTMENT = Number((
  PREFLOP_FALLBACK_POSITION_MODIFIERS.UTG
  - PREFLOP_FALLBACK_POSITION_MODIFIERS['UTG+1']
).toFixed(12));

export const PREFLOP_DECISION_FAMILIES = Object.freeze({
  RFI: 'rfi',
  LIMPED: 'limped',
  VERSUS_OPEN: 'versus_open',
  VERSUS_THREE_BET: 'versus_three_bet',
  VERSUS_FOUR_BET_OR_MORE: 'versus_four_bet_or_more',
  BB_OPTION: 'bb_option',
});

export const PREFLOP_DECISION_ROLES = Object.freeze({
  UNOPENED_RFI: 'unopened_rfi',
  ISOLATION_OPPORTUNITY: 'isolation_opportunity',
  BB_OPTION_AFTER_LIMPS: 'bb_option_after_limps',
  COLD_RESPONSE_TO_OPEN: 'cold_response_to_open',
  BLIND_VS_BLIND_RESPONSE_TO_SB_OPEN: 'blind_vs_blind_response_to_sb_open',
  OPENED_FACING_THREE_BET: 'opened_facing_three_bet',
  COLD_FOUR_BET_OPPORTUNITY: 'cold_four_bet_opportunity',
  THREE_BETTOR_FACING_FOUR_BET: 'three_bettor_facing_four_bet',
  THREE_BETTOR_FACING_COLD_FOUR_BET: 'three_bettor_facing_cold_four_bet',
  OPENER_FACING_COLD_FOUR_BET: 'opener_facing_cold_four_bet',
  LIMPER_FACING_ISOLATION: 'limper_facing_isolation',
  FOUR_BET_OR_MORE_UNCLASSIFIED: 'four_bet_or_more_unclassified',
  UNKNOWN: 'unknown',
});

export const PREFLOP_ROLE_FALLBACK_CALIBRATIONS = Object.freeze({
  [PREFLOP_DECISION_ROLES.UNOPENED_RFI]: PREFLOP_DECISION_FAMILIES.RFI,
  [PREFLOP_DECISION_ROLES.ISOLATION_OPPORTUNITY]: PREFLOP_DECISION_FAMILIES.LIMPED,
  [PREFLOP_DECISION_ROLES.BB_OPTION_AFTER_LIMPS]: PREFLOP_DECISION_FAMILIES.BB_OPTION,
  [PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN]: PREFLOP_DECISION_FAMILIES.VERSUS_OPEN,
  [PREFLOP_DECISION_ROLES.BLIND_VS_BLIND_RESPONSE_TO_SB_OPEN]:
    PREFLOP_DECISION_FAMILIES.VERSUS_OPEN,
  [PREFLOP_DECISION_ROLES.OPENED_FACING_THREE_BET]:
    PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET,
  [PREFLOP_DECISION_ROLES.COLD_FOUR_BET_OPPORTUNITY]:
    PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET,
  [PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_FOUR_BET]:
    PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE,
  [PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_COLD_FOUR_BET]:
    PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE,
  [PREFLOP_DECISION_ROLES.OPENER_FACING_COLD_FOUR_BET]:
    PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE,
  [PREFLOP_DECISION_ROLES.LIMPER_FACING_ISOLATION]:
    PREFLOP_DECISION_FAMILIES.VERSUS_OPEN,
  [PREFLOP_DECISION_ROLES.FOUR_BET_OR_MORE_UNCLASSIFIED]:
    PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE,
});

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
  // Close rounding on the last positive action so an explicit zero invariant
  // cannot reappear as a tiny floating-point residual.
  let closingIndex = normalized.length - 1;
  while (closingIndex > 0 && weights[closingIndex] === 0) closingIndex -= 1;
  normalized[closingIndex] += 1 - normalized.reduce((sum, value) => sum + value, 0);
  return { open: normalized[0], call: normalized[1], fold: normalized[2] };
}

function strategyAtAnchors(handStrength, anchors) {
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

function rfiAnchors(isPair) {
  return isPair
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
}

function responseFamilyAnchors(family, isPair) {
  // These are broad, smooth family-shape controls, not hand charts or copied
  // mixed-frequency targets. Their purpose is structural: the meaning of
  // aggression changes from opening to isolation to successively narrower
  // response families, so one raw-strength plateau must not be relabeled as
  // Open / 3-Bet / 4-Bet without changing its action mix.
  if (family === PREFLOP_DECISION_FAMILIES.LIMPED) {
    return isPair
      ? [
        [22, [0.7, 0.28, 0.02]], [19, [0.58, 0.36, 0.06]],
        [16, [0.42, 0.46, 0.12]], [13, [0.25, 0.48, 0.27]],
        [9, [0.1, 0.42, 0.48]], [5, [0.02, 0.25, 0.73]], [0, [0, 0, 1]],
      ]
      : [
        [22, [0.65, 0.3, 0.05]], [20, [0.55, 0.36, 0.09]],
        [18, [0.44, 0.4, 0.16]], [15, [0.29, 0.43, 0.28]],
        [12, [0.15, 0.4, 0.45]], [8, [0.05, 0.28, 0.67]],
        [4, [0, 0.1, 0.9]], [0, [0, 0, 1]],
      ];
  }
  if (family === PREFLOP_DECISION_FAMILIES.VERSUS_OPEN) {
    return isPair
      ? [
        [23, [0.78, 0.2, 0.02]], [21, [0.68, 0.27, 0.05]],
        [19, [0.55, 0.36, 0.09]], [17, [0.4, 0.43, 0.17]],
        [14, [0.22, 0.46, 0.32]], [10, [0.08, 0.36, 0.56]], [0, [0, 0, 1]],
      ]
      : [
        [23, [0.62, 0.34, 0.04]], [21, [0.52, 0.39, 0.09]],
        [19, [0.4, 0.45, 0.15]], [17, [0.27, 0.46, 0.27]],
        [14, [0.12, 0.4, 0.48]], [10, [0.03, 0.28, 0.69]],
        [6, [0, 0.12, 0.88]], [0, [0, 0, 1]],
      ];
  }
  if (family === PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET) {
    return isPair
      ? [
        [23, [0.72, 0.26, 0.02]], [21, [0.58, 0.36, 0.06]],
        [19, [0.42, 0.45, 0.13]], [17, [0.27, 0.48, 0.25]],
        [14, [0.11, 0.42, 0.47]], [10, [0.02, 0.28, 0.7]], [0, [0, 0, 1]],
      ]
      : [
        [23, [0.46, 0.47, 0.07]], [21, [0.31, 0.54, 0.15]],
        [19, [0.17, 0.54, 0.29]], [17, [0.08, 0.48, 0.44]],
        [14, [0.02, 0.34, 0.64]], [10, [0, 0.17, 0.83]], [0, [0, 0, 1]],
      ];
  }
  if (family === PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE) {
    return isPair
      ? [
        [23, [0.68, 0.3, 0.02]], [22, [0.58, 0.37, 0.05]],
        [21, [0.46, 0.44, 0.1]], [20, [0.3, 0.5, 0.2]],
        [18, [0.12, 0.48, 0.4]], [15, [0.03, 0.34, 0.63]],
        [10, [0, 0.15, 0.85]], [0, [0, 0, 1]],
      ]
      : [
        [23, [0.28, 0.62, 0.1]], [22, [0.2, 0.64, 0.16]],
        [21, [0.12, 0.58, 0.3]], [20, [0.07, 0.5, 0.43]],
        [18, [0.02, 0.34, 0.64]], [14, [0, 0.16, 0.84]], [0, [0, 0, 1]],
      ];
  }
  if (family === PREFLOP_DECISION_FAMILIES.BB_OPTION) {
    return isPair
      ? [
        [22, [0.68, 0.32, 0]], [19, [0.56, 0.44, 0]],
        [16, [0.42, 0.58, 0]], [12, [0.27, 0.73, 0]],
        [8, [0.12, 0.88, 0]], [0, [0, 1, 0]],
      ]
      : [
        [22, [0.6, 0.4, 0]], [20, [0.5, 0.5, 0]],
        [18, [0.4, 0.6, 0]], [15, [0.28, 0.72, 0]],
        [12, [0.17, 0.83, 0]], [8, [0.08, 0.92, 0]], [0, [0, 1, 0]],
      ];
  }
  return rfiAnchors(isPair);
}

function strategyForDecisionFamily(handStrength, isPair, family) {
  return strategyAtAnchors(handStrength, responseFamilyAnchors(family, isPair));
}

export function preflopTableFamilyPositionFacts(tableSize, position, priorAction = 'unopened') {
  const normalizedAction = String(priorAction || 'unopened').toLowerCase();
  const vocabulary = POSITIONS_BY_TABLE_SIZE[Number(tableSize)];
  if (normalizedAction !== 'unopened'
    || !vocabulary
    || !vocabulary.includes(position)
    || !NON_BLIND_POSITIONS.includes(position)) {
    return Object.freeze({
      applied: false,
      adjustment: 0,
      playersLeftToAct: null,
      equivalentPosition: position,
      basis: 'not_applicable',
    });
  }

  const earlyPositions = vocabulary.filter((entry) => !['BTN', 'SB', 'BB'].includes(entry));
  const earlyIndex = earlyPositions.indexOf(position);
  const playersLeftToAct = position === 'BTN'
    ? Number(tableSize) === 2 ? 1 : 2
    : 3 + (earlyPositions.length - earlyIndex - 1);
  if (Number(tableSize) === 2 && position === 'BTN') {
    // Heads-up BTN has one player left to act instead of the ring-game BTN's
    // two blinds. Extend the heuristic's existing CO-to-BTN late-position step
    // once; this uses its own structural ladder, not an external target rate.
    const adjustment = PREFLOP_FALLBACK_POSITION_MODIFIERS.BTN
      - PREFLOP_FALLBACK_POSITION_MODIFIERS.CO;
    return Object.freeze({
      applied: adjustment !== 0,
      adjustment,
      playersLeftToAct,
      equivalentPosition: 'BTN/SB',
      basis: 'canonical_one_player_left_to_act_late_position_step',
    });
  }

  // The legacy position modifiers were calibrated as named-position inputs,
  // not as one calibrated step per player left to act. Preserve their existing
  // short-handed magnitude and use only their smallest early-position step as
  // a bounded table-family correction for the full-ring first position.
  const isFullRingFirstPosition = Number(tableSize) >= FULL_RING_MINIMUM_TABLE_SIZE
    && earlyIndex === 0;
  const adjustment = isFullRingFirstPosition
    ? FULL_RING_EARLY_POSITION_ADJUSTMENT
    : 0;
  return Object.freeze({
    applied: adjustment !== 0,
    adjustment,
    playersLeftToAct,
    equivalentPosition: position,
    basis: adjustment === 0
      ? 'canonical_named_position_baseline'
      : 'bounded_full_ring_first_position_step',
  });
}

function positionAdjustment(position, priorAction, isFreeCheckOption, tableSize) {
  const configured = PREFLOP_FALLBACK_POSITION_MODIFIERS[position];
  let adjustment = configured ?? PREFLOP_FALLBACK_POSITION_MODIFIERS.UTG;

  if (isFreeCheckOption) return -1;
  adjustment += preflopTableFamilyPositionFacts(
    tableSize,
    position,
    priorAction,
  ).adjustment;
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
  if (!Number.isFinite(stackBb) || stackBb < 0) return 0;
  const configuredDepth = stackBb;
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

function collapseUnopenedPassiveMass(base) {
  // Preserve the old heuristic's tendency to convert passive mass into an
  // open for clearly playable hands, but replace its 25% binary gate with a
  // continuous transition for marginal hands.
  const passiveToRaiseShare = smoothstep(0.05, 0.3, base[0]);
  const passiveToRaise = base[1] * passiveToRaiseShare;
  return [base[0] + passiveToRaise, 0, base[2] + base[1] - passiveToRaise];
}

function applyMultipleLimpAdjustment(base, limperCount, speculative) {
  const additionalLimpers = Math.max(0, Math.min(4, Number(limperCount) - 1));
  if (!(additionalLimpers > 0)) return base;
  const isolationToOverlimp = base[0] * additionalLimpers * 0.055;
  const foldToOverlimp = speculative ? base[2] * additionalLimpers * 0.025 : 0;
  return [
    base[0] - isolationToOverlimp,
    base[1] + isolationToOverlimp + foldToOverlimp,
    base[2] - foldToOverlimp,
  ];
}

function legacyDecisionFamily(action, isFreeCheckOption) {
  if (isFreeCheckOption) return PREFLOP_DECISION_FAMILIES.BB_OPTION;
  if (action === 'raise') return PREFLOP_DECISION_FAMILIES.VERSUS_OPEN;
  if (action === '3bet') return PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET;
  if (action === '4bet') return PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE;
  return PREFLOP_DECISION_FAMILIES.RFI;
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

function isDominatedPremiumFold({ isPair, highRank, lowRank, facingAggression }) {
  // AA is the only universal premium invariant in the current chip-EV model.
  // The narrower unopened invariant covers hands whose Fold mass can only come
  // from the heuristic anchors: QQ+, AKs, and AKo. Facing-aggression behavior
  // for every hand except AA remains governed by the smooth heuristic.
  if (isPair && highRank === HEURISTIC_RANK_VALUES.A) return true;
  if (facingAggression) return false;
  return (isPair && highRank >= HEURISTIC_RANK_VALUES.Q)
    || (!isPair
      && highRank === HEURISTIC_RANK_VALUES.A
      && lowRank === HEURISTIC_RANK_VALUES.K);
}

function conditionOnContinuingActions(base) {
  if (!(base[2] > 0) || !(base[0] + base[1] > 0)) return base;
  return [base[0], base[1], 0];
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
  tableSize = null,
  decisionFamily = null,
  limperCount = 0,
  strategicStackBb = undefined,
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
  const family = Object.values(PREFLOP_DECISION_FAMILIES).includes(decisionFamily)
    ? decisionFamily
    : legacyDecisionFamily(normalizedAction, isFreeCheckOption);

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
  const depthForStrategy = strategicStackBb === undefined
    ? configuredStack
    : Number.isFinite(strategicStackBb) && strategicStackBb >= 0
      ? strategicStackBb
      : null;
  let handStrength = score
    + positionAdjustment(
      canonicalPosition,
      normalizedAction,
      isFreeCheckOption,
      tableSize,
    )
    + stackDepthAdjustment({
      stackBb: depthForStrategy,
      isPair,
      isSuited,
      connected,
      highRank,
      lowRank,
    });

  if (isSuited) {
    handStrength += 1.5;
    if (hasAce) handStrength += 1.2;
    else if (connected && highRank >= 5) handStrength += 1.2;
  } else if (connected && highRank >= 7) {
    handStrength += 0.5;
  }
  if (bothBroadway && !isPair) handStrength += 1;
  const facingAggression = [
    PREFLOP_DECISION_FAMILIES.VERSUS_OPEN,
    PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET,
    PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE,
  ].includes(family);
  if (hasAce && facingAggression) handStrength += 1;
  else if (hasKing && facingAggression) handStrength += 0.5;

  // Suited wheel-Ace playability and blocker value are encoded as a smooth
  // strength input, not as an action-specific replacement strategy.
  if (hasAce && isSuited) {
    const wheelAceWeight = 1 - smoothstep(5, 8, lowRank);
    handStrength += wheelAceWeight * (facingAggression ? 0.8 : 0.35);
  }

  if (family === PREFLOP_DECISION_FAMILIES.LIMPED) {
    handStrength -= Math.max(0, Math.min(4, Number(limperCount) - 1)) * 0.35;
  }
  let base = strategyForDecisionFamily(handStrength, isPair, family);

  if (family === PREFLOP_DECISION_FAMILIES.RFI
    && NON_BLIND_POSITIONS.includes(canonicalPosition)) {
    base = collapseUnopenedPassiveMass(base);
  }
  if (facingAggression && trustedCallAmount !== null) {
    base = applyKnownCallPrice(base, handStrength, Math.max(0, Number(potSize) || 0), trustedCallAmount);
  }
  if (isFreeCheckOption) {
    base[1] += base[2];
    base[2] = 0;
  }
  if (family === PREFLOP_DECISION_FAMILIES.LIMPED) {
    base = applyMultipleLimpAdjustment(
      base,
      limperCount,
      isPair || isSuited || connected,
    );
  }
  if (isDominatedPremiumFold({ isPair, highRank, lowRank, facingAggression })) {
    base = conditionOnContinuingActions(base);
  }

  return normalizedStrategy(base[0], base[1], base[2]);
}

function strategyAction(type, amountBb = null) {
  return { type, amountBb, potFraction: null };
}

function legacyPreflopDecisionFamilyFor(decisionContext) {
  const summary = decisionContext?.priorActionSummary;
  const aggressionFamily = String(summary?.aggressionFamily || '').toLowerCase();
  const limperCount = Number(summary?.limperCount);
  const lastAction = String(decisionContext?.lastAction || 'unopened').toLowerCase();
  const exactFreeOption = decisionContext?.heroPosition === 'BB'
    && decisionContext?.callAmountBb === 0
    && ['none', ''].includes(aggressionFamily);

  if (exactFreeOption) return PREFLOP_DECISION_FAMILIES.BB_OPTION;
  if (aggressionFamily === 'four_bet_or_more') {
    return PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE;
  }
  if (aggressionFamily === 'three_bet') {
    return PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET;
  }
  if (aggressionFamily === 'open') return PREFLOP_DECISION_FAMILIES.VERSUS_OPEN;
  if (aggressionFamily === 'none' && Number.isInteger(limperCount) && limperCount > 0) {
    return PREFLOP_DECISION_FAMILIES.LIMPED;
  }
  if (lastAction === '4bet') return PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE;
  if (lastAction === '3bet') return PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET;
  if (lastAction === 'raise') return PREFLOP_DECISION_FAMILIES.VERSUS_OPEN;
  const legacyFreeOption = decisionContext?.heroPosition === 'BB'
    && Number(decisionContext?.facingSizeBb) === 0
    && !AGGRESSIVE_PRIOR_ACTIONS.has(lastAction);
  return legacyFreeOption
    ? PREFLOP_DECISION_FAMILIES.BB_OPTION
    : PREFLOP_DECISION_FAMILIES.RFI;
}

function hasExactPreflopRoleFacts(decisionContext) {
  const summary = decisionContext?.priorActionSummary;
  if (decisionContext?.street !== 'preflop'
    || !summary
    || !Number.isInteger(summary.aggressionCount)
    || summary.aggressionCount < 0
    || !Number.isInteger(summary.limperCount)
    || summary.limperCount < 0
    || !Number.isInteger(summary.distinctAggressorCount)
    || summary.distinctAggressorCount < 0
    || ['unknown', 'not_applicable', ''].includes(
      String(summary.heroPreviousVoluntaryActionFamily || '').toLowerCase(),
    )) {
    return false;
  }
  if (summary.aggressionCount === 0) {
    return summary.distinctAggressorCount === 0
      && summary.initialAggressorPosition === null
      && summary.latestAggressionWasCold === null
      && summary.heroActionWouldBeCold === null;
  }
  return typeof summary.initialAggressorPosition === 'string'
    && summary.initialAggressorPosition.length > 0
    && typeof summary.aggressorPosition === 'string'
    && summary.aggressorPosition.length > 0
    && summary.distinctAggressorCount > 0
    && typeof summary.latestAggressionWasCold === 'boolean'
    && typeof summary.heroActionWouldBeCold === 'boolean';
}

export function preflopDecisionRoleFor(decisionContext) {
  if (!hasExactPreflopRoleFacts(decisionContext)) {
    return PREFLOP_DECISION_ROLES.UNKNOWN;
  }

  const summary = decisionContext.priorActionSummary;
  const aggressionCount = summary.aggressionCount;
  const heroPrevious = String(summary.heroPreviousVoluntaryActionFamily).toLowerCase();
  const heroPosition = String(decisionContext.heroPosition || '');

  if (aggressionCount === 0) {
    if (summary.limperCount > 0) {
      const exactFreeOption = heroPosition === 'BB' && decisionContext.callAmountBb === 0;
      return exactFreeOption
        ? PREFLOP_DECISION_ROLES.BB_OPTION_AFTER_LIMPS
        : PREFLOP_DECISION_ROLES.ISOLATION_OPPORTUNITY;
    }
    return PREFLOP_DECISION_ROLES.UNOPENED_RFI;
  }

  if (aggressionCount === 1) {
    if (heroPrevious === 'limp') {
      return PREFLOP_DECISION_ROLES.LIMPER_FACING_ISOLATION;
    }
    if (heroPrevious === 'none' && summary.heroActionWouldBeCold) {
      const blindVersusBlindOpen = heroPosition === 'BB'
        && (summary.initialAggressorPosition === 'SB'
          || (decisionContext.tableSize === 2
            && summary.initialAggressorPosition === 'BTN'));
      return blindVersusBlindOpen
        ? PREFLOP_DECISION_ROLES.BLIND_VS_BLIND_RESPONSE_TO_SB_OPEN
        : PREFLOP_DECISION_ROLES.COLD_RESPONSE_TO_OPEN;
    }
    return PREFLOP_DECISION_ROLES.UNKNOWN;
  }

  if (aggressionCount === 2) {
    if (heroPrevious === 'open' && summary.initialAggressorPosition === heroPosition) {
      return PREFLOP_DECISION_ROLES.OPENED_FACING_THREE_BET;
    }
    if (heroPrevious === 'none'
      && summary.heroActionWouldBeCold
      && summary.distinctAggressorCount === 2) {
      return PREFLOP_DECISION_ROLES.COLD_FOUR_BET_OPPORTUNITY;
    }
    return PREFLOP_DECISION_ROLES.UNKNOWN;
  }

  if (aggressionCount === 3) {
    if (heroPrevious === 'open'
      && summary.initialAggressorPosition === heroPosition
      && summary.latestAggressionWasCold
      && summary.distinctAggressorCount === 3) {
      return PREFLOP_DECISION_ROLES.OPENER_FACING_COLD_FOUR_BET;
    }
    if (heroPrevious === 'three_bet'
      && summary.latestAggressionWasCold === false
      && summary.distinctAggressorCount === 2) {
      return PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_FOUR_BET;
    }
    if (heroPrevious === 'three_bet'
      && summary.latestAggressionWasCold
      && summary.distinctAggressorCount === 3) {
      return PREFLOP_DECISION_ROLES.THREE_BETTOR_FACING_COLD_FOUR_BET;
    }
  }

  return PREFLOP_DECISION_ROLES.FOUR_BET_OR_MORE_UNCLASSIFIED;
}

export function preflopFallbackCalibrationFor(decisionContext, decisionRole = null) {
  const role = decisionRole ?? preflopDecisionRoleFor(decisionContext);
  return PREFLOP_ROLE_FALLBACK_CALIBRATIONS[role]
    ?? legacyPreflopDecisionFamilyFor(decisionContext);
}

// Compatibility export: historical callers use "decision family" to mean the
// numeric fallback curve. Exact strategic identity is exposed separately by
// preflopDecisionRoleFor() and StrategyResult.details.decisionRole.
export function preflopDecisionFamilyFor(decisionContext) {
  return preflopFallbackCalibrationFor(decisionContext);
}

function preflopAggressiveLabel(family, decisionRole) {
  if (family === PREFLOP_DECISION_FAMILIES.RFI) return 'Open';
  if (family === PREFLOP_DECISION_FAMILIES.LIMPED) return 'Isolate';
  if (decisionRole === PREFLOP_DECISION_ROLES.LIMPER_FACING_ISOLATION) return 'Raise';
  if (family === PREFLOP_DECISION_FAMILIES.VERSUS_OPEN) return '3-Bet';
  if (family === PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET) return '4-Bet';
  return 'Raise';
}

function legalAggressionMode(decisionContext) {
  if (decisionContext.canRaise === false) return 'unavailable';
  if (decisionContext.canRaise === true
    && decisionContext.minRaiseToBb === null
    && Number.isFinite(decisionContext.maxRaiseToBb)) {
    return 'short_all_in_only';
  }
  if (decisionContext.canRaise === true) return 'regular';
  return 'unknown';
}

/**
 * A finite preflop amountBb is an amount-to: Hero's total preflop
 * contribution after acting. Facing aggression lacks a proven legal minimum
 * for every response family, so the heuristic deliberately omits a raise
 * size there. Legal bounds are used for projection, not as recommendations.
 */
function preflopAggressiveAction(decisionContext, family) {
  const legalMode = legalAggressionMode(decisionContext);
  if (legalMode === 'unavailable') return null;
  if (legalMode === 'short_all_in_only') return strategyAction('all_in');
  if (family !== PREFLOP_DECISION_FAMILIES.RFI) return strategyAction('raise');

  const startingStackBb = Number.isFinite(decisionContext.startingStackBb)
    ? Math.max(0, decisionContext.startingStackBb)
    : Number.isFinite(decisionContext.stackBb)
      ? Math.max(0, decisionContext.stackBb)
      : 0;
  if (startingStackBb < 10) return strategyAction('raise');
  let openToBb = 2 + 0.5 * smoothstep(20, 80, startingStackBb);
  if (decisionContext.canRaise === true
    && Number.isFinite(decisionContext.minRaiseToBb)
    && Number.isFinite(decisionContext.maxRaiseToBb)) {
    openToBb = bounded(
      openToBb,
      decisionContext.minRaiseToBb,
      decisionContext.maxRaiseToBb,
    );
  }
  return strategyAction('raise', Number(openToBb.toFixed(3)));
}

function preflopStrategicStackFacts(decisionContext) {
  if (decisionContext.contractVersion !== 'decision-context/v1.1') {
    const compatibility = Number.isFinite(decisionContext.stackBb)
      ? Math.max(0, decisionContext.stackBb)
      : null;
    return {
      depthBb: compatibility,
      semantics: 'base_v1_compatibility_depth',
    };
  }
  if (Number.isFinite(decisionContext.effectiveStackBb)
    && decisionContext.effectiveStackBb >= 0) {
    return {
      depthBb: decisionContext.effectiveStackBb,
      semantics: 'heads_up_exact_effective_stack',
    };
  }
  return {
    depthBb: Number.isFinite(decisionContext.heroStackBb)
      ? decisionContext.heroStackBb
      : null,
    semantics: Number.isFinite(decisionContext.heroStackBb)
      ? 'multiway_exact_hero_stack_cap_not_effective_stack'
      : 'live_stack_unavailable_no_compatibility_fallback',
  };
}

function projectedPreflopWeights(open, call, fold, aggressiveAction, callReachesStackCap) {
  let aggressive = callReachesStackCap || aggressiveAction === null ? 0 : open;
  let passive = call + (callReachesStackCap ? open : 0);
  let folded = fold;
  const total = aggressive + passive + folded;
  if (!(total > 0)) return { aggressive: 0, passive: 1, fold: 0 };
  aggressive /= total;
  passive /= total;
  folded = 1 - aggressive - passive;
  return { aggressive, passive, fold: folded };
}

export function calculatePreflopHeuristic(decisionContext) {
  const cards = decisionContext.heroCards;
  if (!Array.isArray(cards) || cards.length !== 2 || !cards[0] || !cards[1]) return null;

  const lastAction = String(decisionContext.lastAction || 'unopened').toLowerCase();
  const facingSizeBb = Number(decisionContext.facingSizeBb) || 0;
  const decisionRole = preflopDecisionRoleFor(decisionContext);
  const fallbackCalibration = preflopFallbackCalibrationFor(
    decisionContext,
    decisionRole,
  );
  const decisionFamily = fallbackCalibration;
  const stackFacts = preflopStrategicStackFacts(decisionContext);
  const exactCurrentPot = decisionContext.contractVersion === 'decision-context/v1.1'
    && Number.isFinite(decisionContext.currentPotBb)
    && decisionContext.currentPotBb >= 0
    ? decisionContext.currentPotBb
    : decisionContext.contractVersion === 'decision-context/v1.1'
      ? null
      : decisionContext.potBb;
  const priceCallAmount = decisionContext.contractVersion === 'decision-context/v1.1'
    && exactCurrentPot === null
    ? null
    : decisionContext.callAmountBb;
  const fallback = calculatePreflopFallbackStrategy(
    cards[0][0],
    cards[1][0],
    cards[0][0] === cards[1][0],
    cards[0][1] === cards[1][1],
    decisionContext.heroPosition,
    lastAction,
    facingSizeBb,
    exactCurrentPot,
    decisionContext.startingStackBb ?? decisionContext.stackBb,
    priceCallAmount,
    decisionContext.tableSize,
    decisionFamily,
    decisionContext.priorActionSummary?.limperCount ?? 0,
    stackFacts.depthBb,
  );
  const { open, call, fold } = fallback;
  const isFreeCheckOption = decisionFamily === PREFLOP_DECISION_FAMILIES.BB_OPTION;
  const passiveType = isFreeCheckOption ? 'check' : 'call';
  const passiveLabel = isFreeCheckOption
    ? 'Check'
    : decisionFamily === PREFLOP_DECISION_FAMILIES.LIMPED
      ? 'Overlimp'
    : facingSizeBb === 0 && (
      decisionContext.heroPosition === 'SB'
      || (decisionContext.tableSize === 2 && decisionContext.heroPosition === 'BTN')
    ) ? 'Limp' : 'Call';
  const aggressiveAction = preflopAggressiveAction(decisionContext, decisionFamily);
  const aggressiveLabel = aggressiveAction?.type === 'all_in'
    ? 'All-In'
    : preflopAggressiveLabel(decisionFamily, decisionRole);
  const facesAggression = [
    PREFLOP_DECISION_FAMILIES.VERSUS_OPEN,
    PREFLOP_DECISION_FAMILIES.VERSUS_THREE_BET,
    PREFLOP_DECISION_FAMILIES.VERSUS_FOUR_BET_OR_MORE,
  ].includes(decisionFamily);
  const exactLiveCallCap = decisionContext.contractVersion === 'decision-context/v1.1'
    && facesAggression
    && Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0
    && Number.isFinite(decisionContext.heroStackBb)
    && decisionContext.heroStackBb >= 0
    && decisionContext.callAmountBb >= decisionContext.heroStackBb;
  const legacyCallCap = decisionContext.contractVersion !== 'decision-context/v1.1'
    && facesAggression
    && Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0
    && Number.isFinite(decisionContext.heroStreetContributionBb)
    && decisionContext.heroStreetContributionBb >= 0
    && Number.isFinite(decisionContext.stackBb)
    && decisionContext.stackBb >= 0
    && decisionContext.callAmountBb + decisionContext.heroStreetContributionBb
      >= decisionContext.stackBb;
  const callReachesStackCap = exactLiveCallCap || legacyCallCap;
  const weights = projectedPreflopWeights(
    open,
    call,
    fold,
    aggressiveAction,
    callReachesStackCap,
  );
  const actions = [
    ...(aggressiveAction ? [{
      action: aggressiveAction,
      label: aggressiveLabel,
      value: weights.aggressive,
      order: 0,
    }] : []),
    { action: strategyAction(passiveType), label: passiveLabel, value: weights.passive, order: 1 },
    { action: strategyAction('fold'), label: 'Fold', value: weights.fold, order: 2 },
  ].sort((left, right) => right.value - left.value || left.order - right.order);

  const callPriceAvailable = Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0;
  const highRank = Math.max(
    HEURISTIC_RANK_VALUES[cards[0][0]] || 0,
    HEURISTIC_RANK_VALUES[cards[1][0]] || 0,
  );
  const lowRank = Math.min(
    HEURISTIC_RANK_VALUES[cards[0][0]] || 0,
    HEURISTIC_RANK_VALUES[cards[1][0]] || 0,
  );
  const dominatedFoldSuppressionApplied = isDominatedPremiumFold({
    isPair: cards[0][0] === cards[1][0],
    highRank,
    lowRank,
    facingAggression: facesAggression,
  });
  const tableFamilyPosition = preflopTableFamilyPositionFacts(
    decisionContext.tableSize,
    decisionContext.heroPosition,
    lastAction,
  );
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
        facesAggression && callPriceAvailable && exactCurrentPot !== null
      ),
      styleControlsApplied: false,
      forcedContributionAdjustmentApplied: false,
      stackCapActionProjectionApplied: callReachesStackCap,
      dominatedFoldSuppressionApplied,
      tableFamilyPosition,
      decisionRole,
      actualRole: decisionRole,
      fallbackCalibration,
      decisionFamily,
      priorActionSummaryApplied: decisionContext.priorActionSummary !== undefined,
      limperCount: decisionFamily === PREFLOP_DECISION_FAMILIES.LIMPED
        ? decisionContext.priorActionSummary?.limperCount ?? null
        : 0,
      strategicStackBb: stackFacts.depthBb,
      strategicStackSemantics: stackFacts.semantics,
      legalAggressionMode: legalAggressionMode(decisionContext),
      illegalAggressionRemoved: aggressiveAction === null && open > 0,
      shortAllInProjectionApplied: aggressiveAction?.type === 'all_in' && weights.aggressive > 0,
    },
  };
}
