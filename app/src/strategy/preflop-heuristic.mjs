import { HEURISTIC_RANK_VALUES } from './heuristic-evaluator.mjs';

// Preserve the established six-max values and full-ring progression.
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
  const bothBroadway = highRank >= 8 && lowRank >= 8;
  const connected = gap <= 1 && !isPair;

  let score = Math.max(r1, r2);
  if (isPair) score += 6;
  if (gap > 4) score -= gap - 4;

  if (!isPair && !isSuited) {
    score -= 3;
    if (gap >= 3) score -= gap - 2;
    if (highRank <= 11) score -= (12 - highRank) * 0.8;
    if (lowRank <= 7) score -= (8 - lowRank) * 0.5;
  }

  const positionModifier = PREFLOP_FALLBACK_POSITION_MODIFIERS[pos];
  let posModifier = positionModifier !== undefined
    ? positionModifier
    : PREFLOP_FALLBACK_POSITION_MODIFIERS.UTG;

  if (action === 'unopened' && (pos === 'BTN' || pos === 'SB')) posModifier += 0.5;

  if (action === 'raise' || action === '3bet' || action === '4bet') {
    if (pos === 'SB') posModifier = -3.5;
    if (pos === 'BB') posModifier = -1;
    if (['BTN', 'CO', 'HJ'].includes(pos)) posModifier += 0.8;
  }

  const trustedCallAmount = Number.isFinite(callAmountBb) && callAmountBb >= 0
    ? callAmountBb
    : null;
  const spr = trustedCallAmount === null
    ? 20
    : (stack > 0 ? stack / (potSize + trustedCallAmount) : 20);
  if (spr < 5) {
    if (isPair || highRank >= 10) posModifier += 0.5;
    else posModifier -= 0.3;
  } else if (spr > 20) {
    if (isSuited && connected && lowRank >= 5) posModifier += 0.8;
    if (isPair && highRank <= 8) posModifier += 0.3;
  }

  const commitment = trustedCallAmount === null
    ? null
    : (stack > 0 ? trustedCallAmount / stack : 1);
  let actionTightness = 0;
  if (action === 'raise') {
    actionTightness = commitment === null ? 0 : Math.min(3, commitment * 8);
  } else if (action === '3bet') {
    actionTightness = commitment === null ? 3 : Math.min(6, 3 + commitment * 10);
  } else if (action === '4bet') {
    actionTightness = commitment === null ? 6 : Math.min(10, 6 + commitment * 15);
  }

  let handStrength = score + posModifier - actionTightness;
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

  let base = anchors[anchors.length - 1][1].slice();
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [highThreshold, highStrategy] = anchors[index];
    const [lowThreshold, lowStrategy] = anchors[index + 1];
    if (handStrength >= highThreshold) {
      base = highStrategy.slice();
      break;
    }
    if (handStrength >= lowThreshold) {
      const raw = (handStrength - lowThreshold) / (highThreshold - lowThreshold);
      const interpolation = 1 / (1 + Math.exp(-6 * (raw - 0.5)));
      base = [
        lowStrategy[0] + interpolation * (highStrategy[0] - lowStrategy[0]),
        lowStrategy[1] + interpolation * (highStrategy[1] - lowStrategy[1]),
        lowStrategy[2] + interpolation * (highStrategy[2] - lowStrategy[2]),
      ];
      break;
    }
  }

  if (facingSize === 0 && pos !== 'SB' && pos !== 'BB') {
    if (base[0] >= 0.25) {
      base[0] = Math.min(1, base[0] + base[1]);
      base[1] = 0;
      base[2] = 1 - base[0];
    } else {
      base[0] = 0;
      base[1] = 0;
      base[2] = 1;
    }
  }

  if (hasAce && isSuited && lowRank <= 3 && actionTightness > 0) {
    base = [0.35, 0.3, 0.35];
  } else if (hasAce && isSuited && lowRank <= 7 && actionTightness > 0) {
    base = [0.2, 0.5, 0.3];
  }

  if (facingSize > 0 && trustedCallAmount !== null) {
    const potOdds = potSize + trustedCallAmount > 0
      ? trustedCallAmount / (potSize + trustedCallAmount)
      : 0.3;
    const mdf = potSize + trustedCallAmount > 0
      ? potSize / (potSize + trustedCallAmount)
      : 0.7;
    let cheapOddsDefenseBoost = 0;
    if (potOdds <= 0.1) cheapOddsDefenseBoost = 0.8;
    else if (potOdds <= 0.2) cheapOddsDefenseBoost = 0.55;
    else if (potOdds <= 0.28) cheapOddsDefenseBoost = 0.35;
    else if (potOdds <= 0.35) cheapOddsDefenseBoost = 0.15;

    if (['BTN', 'CO', 'HJ'].includes(pos)) {
      cheapOddsDefenseBoost = Math.min(0.9, cheapOddsDefenseBoost * 1.15);
    }
    if (cheapOddsDefenseBoost > 0 && base[2] > 0) {
      const shift = base[2] * cheapOddsDefenseBoost;
      base[2] -= shift;
      base[1] += shift;
    }

    const defenseTotal = base[0] + base[1];
    const requiredDefense = Math.min(0.85, mdf * 0.75);
    if (defenseTotal < requiredDefense) {
      const defenseBoost = requiredDefense - defenseTotal;
      base[1] += defenseBoost;
      base[2] = Math.max(0, base[2] - defenseBoost);
    }
  }

  if (isPair && score >= 14) base[2] = Math.min(base[2], 0.05);
  else if (score >= 12) base[2] = Math.min(base[2], 0.1);

  if (pos === 'BB' && facingSize === 0) {
    base[1] += base[2];
    base[2] = 0;
  }

  return { open: base[0], call: base[1], fold: base[2] };
}

function strategyAction(type, amountBb = null) {
  return { type, amountBb, potFraction: null };
}

export function calculatePreflopHeuristic(decisionContext) {
  const cards = decisionContext.heroCards;
  if (!Array.isArray(cards) || cards.length !== 2 || !cards[0] || !cards[1]) return null;

  const fallback = calculatePreflopFallbackStrategy(
    cards[0][0],
    cards[1][0],
    cards[0][0] === cards[1][0],
    cards[0][1] === cards[1][1],
    decisionContext.heroPosition,
    decisionContext.lastAction,
    decisionContext.facingSizeBb,
    decisionContext.potBb,
    decisionContext.stackBb,
    decisionContext.callAmountBb,
  );
  const { heroPosition, facingSizeBb, potBb, stackBb } = decisionContext;
  const { open, call, fold } = fallback;
  let betSize = 0;
  let firstAction;
  let secondAction;

  if (open > call && open > fold) {
    const stackToPot = stackBb > 0 ? stackBb / potBb : 20;
    if (facingSizeBb === 0) {
      if (stackToPot >= 20) betSize = 2.5;
      else if (stackToPot >= 10) betSize = 2.2;
      else betSize = Math.min(stackBb * 0.6, 2);
    } else {
      const raiseAmount = facingSizeBb + potBb;
      if (stackToPot >= 15) betSize = raiseAmount * 2.5;
      else if (stackToPot >= 8) betSize = raiseAmount * 2.2;
      else betSize = Math.min(stackBb * 0.8, raiseAmount * 2);
    }
    firstAction = 'Open';
    secondAction = call > fold ? 'Call' : 'Fold';
  } else if (call > open && call > fold) {
    firstAction = 'Call';
    secondAction = open > fold ? 'Open' : 'Fold';
  } else {
    firstAction = 'Fold';
    secondAction = open > call ? 'Open' : 'Call';
  }

  if (betSize > 0 && firstAction === 'Open') firstAction = `Open ${betSize}bb`;
  const actionKey = (name) => (name.startsWith('Open') ? 'open' : name.toLowerCase());
  const values = { open, call, fold };
  const labels = { open: 'Open', call: 'Call', fold: 'Fold' };
  const order = [actionKey(firstAction), actionKey(secondAction), 'open', 'call', 'fold']
    .filter((key, index, all) => labels[key] && all.indexOf(key) === index);
  const openLabel = firstAction.startsWith('Open')
    ? firstAction
    : (secondAction.startsWith('Open') ? secondAction : 'Open');

  return {
    source: 'heuristic_preflop',
    actions: order.map((key) => ({
      action: strategyAction(key === 'open' ? 'raise' : key, key === 'open' && betSize > 0 ? betSize : null),
      label: key === 'open' ? openLabel : labels[key],
      value: values[key],
    })),
    recommendedActionLabel: firstAction,
    position: heroPosition,
  };
}
