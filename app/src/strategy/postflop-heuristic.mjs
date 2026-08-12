import {
  CARD_RANKS,
  CARD_SUITS,
  assertUniqueKnownCards,
} from '../../../shared/poker-domain/cards.js';
import {
  HEURISTIC_RANK_VALUES,
  evaluatePostflopHandStrength,
  scoreHeuristicSeven,
} from './heuristic-evaluator.mjs';

export const POSTFLOP_HEURISTIC_SAMPLES = 250;

const FULL_DECK = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

function clampUnit(value) {
  return Math.min(1, Math.max(0, Number(value)));
}

function sampleIndex(rng, length) {
  if (!Number.isInteger(length) || length <= 0) throw new RangeError('Cannot sample an empty set');
  const randomValue = Number(rng());
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError('Injected heuristic RNG must return values in [0, 1)');
  }
  return Math.floor(randomValue * length);
}

function opponentCountFor({ opponentCount, tableSize }) {
  if (Number.isInteger(opponentCount) && opponentCount >= 1 && opponentCount <= 9) {
    return { count: opponentCount, source: 'decision_context_exact' };
  }
  const seatedPlayers = Number.isInteger(tableSize)
    ? Math.min(10, Math.max(2, tableSize))
    : 2;
  return { count: seatedPlayers - 1, source: 'table_size_approximation' };
}

function preflopComboScore(card1, card2) {
  const rank1 = HEURISTIC_RANK_VALUES[card1[0]] || 0;
  const rank2 = HEURISTIC_RANK_VALUES[card2[0]] || 0;
  const highRank = Math.max(rank1, rank2);
  const lowRank = Math.min(rank1, rank2);
  if (rank1 === rank2) return highRank * 5 + 30;
  let points = highRank * 3 + lowRank;
  if (card1[1] === card2[1]) points += 8;
  const gap = highRank - lowRank;
  if (gap === 1) points += 4;
  else if (gap === 2) points += 2;
  else if (gap === 3) points += 1;
  return points;
}

function buildOpponentCandidateRange(deck, {
  opponentStyle,
  facingSizeBb,
  lastAction,
  totalPlayers,
}) {
  const allCombos = [];
  for (let first = 0; first < deck.length; first += 1) {
    for (let second = first + 1; second < deck.length; second += 1) {
      const hand = [deck[first], deck[second]];
      allCombos.push({ hand, points: preflopComboScore(...hand) });
    }
  }
  allCombos.sort((left, right) => (
    right.points - left.points
    || left.hand[0].localeCompare(right.hand[0])
    || left.hand[1].localeCompare(right.hand[1])
  ));

  // This is deliberately a crude, uniform candidate range rather than a
  // weighted or solved range. A higher opponentStyle means a looser range.
  let targetFraction = 0.15 + 0.3 * clampUnit(opponentStyle);
  if (Number(facingSizeBb) > 0 || String(lastAction || '').toLowerCase().includes('raise')) {
    targetFraction *= 0.7;
  }
  if (totalPlayers >= 6) targetFraction *= 0.9;
  targetFraction = Math.max(0.05, Math.min(1, targetFraction));
  const selectedCount = Math.max(1, Math.floor(allCombos.length * targetFraction));
  return {
    combos: allCombos.slice(0, selectedCount),
    selectedCount,
    totalCount: allCombos.length,
    actualFraction: selectedCount / allCombos.length,
    targetFraction,
  };
}

function allocateOpponentHands(candidateCombos, opponentCount, initialUsedCards, rng) {
  const usedCards = new Set(initialUsedCards);
  const hands = [];
  for (let opponent = 0; opponent < opponentCount; opponent += 1) {
    const legal = candidateCombos.filter(({ hand }) => (
      !usedCards.has(hand[0]) && !usedCards.has(hand[1])
    ));
    if (legal.length === 0) return null;
    const selected = legal[sampleIndex(rng, legal.length)].hand;
    hands.push(selected);
    usedCards.add(selected[0]);
    usedCards.add(selected[1]);
  }
  return { hands, usedCards };
}

function sampleRunout(deck, usedCards, neededRunout, rng) {
  const available = deck.filter((card) => !usedCards.has(card));
  if (available.length < neededRunout) return null;
  for (let index = 0; index < neededRunout; index += 1) {
    const selected = index + sampleIndex(rng, available.length - index);
    [available[index], available[selected]] = [available[selected], available[index]];
  }
  return available.slice(0, neededRunout);
}

/**
 * Range-conditioned sampled showdown share used only by the heuristic strategy
 * fallback. This is not the canonical Equity service or an equilibrium range.
 */
export function simulateHeuristicEquity({
  heroCards,
  board,
  deadCards = [],
  tableSize,
  opponentCount = null,
  facingSizeBb,
  lastAction,
  opponentStyle = 0,
  iterations = POSTFLOP_HEURISTIC_SAMPLES,
  rng,
  observeTrial = null,
}) {
  if (typeof rng !== 'function') throw new TypeError('Heuristic equity requires an injected RNG');
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new RangeError('Heuristic sample count must be a positive integer');
  }
  const filteredHeroCards = Array.isArray(heroCards) ? heroCards.filter(Boolean) : [];
  const boardCards = Array.isArray(board) ? board.filter(Boolean) : [];
  const excludedDeadCards = Array.isArray(deadCards) ? deadCards.filter(Boolean) : [];
  if (filteredHeroCards.length !== 2 || boardCards.length < 3 || boardCards.length > 5) {
    throw new RangeError('Heuristic postflop sampling requires two Hero cards and a valid board street');
  }
  assertUniqueKnownCards([
    { label: 'heroCards', cards: filteredHeroCards },
    { label: 'board', cards: boardCards },
    { label: 'deadCards', cards: excludedDeadCards },
  ]);

  const excluded = new Set([...filteredHeroCards, ...boardCards, ...excludedDeadCards]);
  const deck = FULL_DECK.filter((card) => !excluded.has(card));
  const opponents = opponentCountFor({ opponentCount, tableSize });
  const neededRunout = 5 - boardCards.length;
  if (deck.length < opponents.count * 2 + neededRunout) {
    throw new RangeError('Heuristic sample cannot allocate every opponent and board card');
  }
  const range = buildOpponentCandidateRange(deck, {
    opponentStyle,
    facingSizeBb,
    lastAction,
    totalPlayers: opponents.count + 1,
  });

  let equityShare = 0;
  let soleWins = 0;
  let splitPotTrials = 0;
  let attemptedSamples = 0;
  let completedSamples = 0;
  const maximumAttempts = iterations * 25;

  while (completedSamples < iterations && attemptedSamples < maximumAttempts) {
    attemptedSamples += 1;
    const allocation = allocateOpponentHands(range.combos, opponents.count, excluded, rng);
    if (!allocation) continue;
    const runout = sampleRunout(deck, allocation.usedCards, neededRunout, rng);
    if (!runout) continue;

    const finalBoard = [...boardCards, ...runout];
    const scores = [
      scoreHeuristicSeven([...filteredHeroCards, ...finalBoard]),
      ...allocation.hands.map((hand) => scoreHeuristicSeven([...hand, ...finalBoard])),
    ];
    const bestScore = Math.max(...scores);
    const winnerIndexes = scores
      .map((score, index) => (score === bestScore ? index : -1))
      .filter((index) => index >= 0);
    if (winnerIndexes.includes(0)) {
      equityShare += 1 / winnerIndexes.length;
      if (winnerIndexes.length === 1) soleWins += 1;
      else splitPotTrials += 1;
    }

    completedSamples += 1;
    if (typeof observeTrial === 'function') {
      observeTrial({
        heroCards: [...filteredHeroCards],
        opponentHands: allocation.hands.map((hand) => [...hand]),
        board: finalBoard,
        runout: [...runout],
        deadCards: [...excludedDeadCards],
        winnerIndexes: [...winnerIndexes],
      });
    }
  }

  if (completedSamples !== iterations) {
    throw new RangeError(
      `Heuristic allocation completed ${completedSamples}/${iterations} samples after ${attemptedSamples} attempts`,
    );
  }

  return {
    eq: equityShare / completedSamples,
    pct: range.actualFraction,
    provenance: 'heuristic_conditional_sample',
    requestedSamples: iterations,
    attemptedSamples,
    completedSamples,
    opponentCount: opponents.count,
    opponentCountSource: opponents.source,
    rangeComboCount: range.selectedCount,
    unblockedComboCount: range.totalCount,
    rangeFraction: range.actualFraction,
    rangeTargetFraction: range.targetFraction,
    rangeDistribution: 'uniform_over_selected_legal_combos',
    sharedRangeAssumption: true,
    soleWins,
    splitPotTrials,
  };
}

function linearAt(value, anchors) {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [rightX, rightY] = anchors[index];
    const [leftX, leftY] = anchors[index - 1];
    if (value <= rightX) {
      const progress = (value - leftX) / (rightX - leftX);
      return leftY + (rightY - leftY) * progress;
    }
  }
  return anchors[anchors.length - 1][1];
}

function smoothBoundary(value, center, halfWidth = 0.1) {
  const progress = clampUnit((value - (center - halfWidth)) / (halfWidth * 2));
  return progress * progress * (3 - 2 * progress);
}

function closedHeadsUpMix(aggressiveName, passiveName, aggressivePercent) {
  const aggressive = Math.min(100, Math.max(0, aggressivePercent));
  return {
    [aggressiveName]: aggressive,
    [passiveName]: 100 - aggressive,
  };
}

function actionContextFacesWager(decisionContext, trustedCallAmount) {
  if (trustedCallAmount === 0) return false;
  return Number(decisionContext.facingSizeBb) > 0
    || ['bet', 'raise'].includes(String(decisionContext.lastAction || '').toLowerCase());
}

function handClassificationDetails(evaluation) {
  const draws = [];
  if (evaluation.drawFeatures?.flushDraw) {
    draws.push(evaluation.drawFeatures.nutFlushDraw ? 'Nut Flush Draw' : 'Flush Draw');
  }
  if (evaluation.drawFeatures?.isOESD) draws.push('OESD');
  else if (evaluation.drawFeatures?.isDoubleGutshot) draws.push('Double Gutshot');
  else if (evaluation.drawFeatures?.isGutshot) draws.push('Gutshot');
  return {
    canonicalCategory: evaluation.canonicalRank?.category ?? null,
    canonicalScore: evaluation.canonicalRank?.score ?? null,
    strategicCategory: evaluation.strategicCategory,
    madeHand: evaluation.madeHand,
    madeHandLabel: evaluation.madeHandLabel,
    draws,
    drawFeatures: evaluation.drawFeatures,
    boardTexture: evaluation.boardTexture,
    tripsType: evaluation.tripsType,
    usesHeroCards: evaluation.usesHeroCards,
    playsBoard: evaluation.playsBoard,
    source: 'heuristic_postflop_classifier',
  };
}

export function calculatePostflopHeuristicStrategy(decisionContext, options, rng) {
  const heroCards = decisionContext.heroCards;
  const board = decisionContext.board;
  if (!heroCards || heroCards.length !== 2 || !board || board.length < 3) {
    return { Check: 100 };
  }

  const simulation = simulateHeuristicEquity({
    heroCards,
    board,
    deadCards: decisionContext.deadCards,
    tableSize: decisionContext.tableSize,
    opponentCount: decisionContext.opponentCount,
    facingSizeBb: decisionContext.facingSizeBb,
    lastAction: decisionContext.lastAction,
    opponentStyle: options.opponentStyle,
    iterations: POSTFLOP_HEURISTIC_SAMPLES,
    rng,
  });
  return calculatePostflopStrategyFromSample(decisionContext, options, simulation);
}

export function calculatePostflopStrategyFromSample(decisionContext, options, simulation) {
  const heroCards = decisionContext.heroCards;
  const board = decisionContext.board;
  if (!heroCards || heroCards.length !== 2 || !board || board.length < 3) {
    return { Check: 100 };
  }
  const evaluation = evaluatePostflopHandStrength(heroCards, board);
  const sampledEquity = clampUnit(simulation.eq);
  if (!Number.isFinite(sampledEquity)) throw new RangeError('Heuristic sample equity must be finite');

  const potSize = Number.isFinite(Number(decisionContext.potBb))
    ? Math.max(0, Number(decisionContext.potBb))
    : 1.5;
  const trustedCallAmount = Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0
    ? decisionContext.callAmountBb
    : null;
  const compatibilityStack = Number.isFinite(Number(decisionContext.stackBb))
    ? Math.max(0, Number(decisionContext.stackBb))
    : 100;
  const compatibilityStackToPotRatio = potSize > 0 ? compatibilityStack / potSize : null;
  const playStyle = clampUnit(options.playStyle);

  // These offsets are explicit strategic heuristics, not equity corrections.
  const categoryOffsets = {
    monster: 0.12,
    two_pair: 0.07,
    overpair: 0.05,
    top_pair: 0.04,
    middle_pair: 0.01,
    bottom_pair: -0.01,
    weak_pair: -0.03,
    flush_draw: 0.03,
    air: -0.02,
  };
  let aggressionScore = sampledEquity + (categoryOffsets[evaluation.strategicCategory] || 0);
  if (evaluation.drawFeatures?.isOESD) aggressionScore += 0.04;
  else if (evaluation.drawFeatures?.isGutshot) aggressionScore += 0.015;
  if (evaluation.drawFeatures?.nutFlushDraw) aggressionScore += 0.02;
  if (evaluation.isWetBoard && evaluation.strategicCategory === 'top_pair') aggressionScore -= 0.04;
  if (compatibilityStackToPotRatio !== null && compatibilityStackToPotRatio < 2
    && ['monster', 'two_pair', 'overpair', 'top_pair'].includes(evaluation.strategicCategory)) {
    aggressionScore += 0.03;
  }
  if (compatibilityStackToPotRatio !== null && compatibilityStackToPotRatio > 10
    && evaluation.isWetBoard && evaluation.strategicCategory === 'top_pair') {
    aggressionScore -= 0.03;
  }
  aggressionScore = clampUnit(aggressionScore + playStyle * 0.05);

  const requiredRawEquity = trustedCallAmount !== null && trustedCallAmount > 0
    ? trustedCallAmount / (potSize + trustedCallAmount)
    : null;
  const facesWager = actionContextFacesWager(decisionContext, trustedCallAmount);
  let strategy;

  if (!facesWager) {
    let betPercent = linearAt(aggressionScore, [
      [0, 0], [0.35, 0], [0.5, 25], [0.65, 75], [0.85, 100], [1, 100],
    ]);
    const categoryFloor = {
      monster: 95,
      two_pair: 75,
      overpair: 60,
      top_pair: 60,
      middle_pair: 20,
      bottom_pair: 15,
      weak_pair: 10,
      flush_draw: 25,
    }[evaluation.strategicCategory] || 0;
    betPercent = Math.max(categoryFloor, betPercent);
    strategy = closedHeadsUpMix('Bet', 'Check', betPercent);
  } else {
    const continueBoundary = requiredRawEquity ?? 0.5;
    const defendPercent = smoothBoundary(sampledEquity, continueBoundary, 0.1) * 100;
    const raiseShare = linearAt(aggressionScore, [
      [0, 0], [0.6, 0], [0.75, 0.25], [0.9, 1], [1, 1],
    ]);
    const raisePercent = defendPercent * raiseShare;
    const callPercent = defendPercent - raisePercent;
    strategy = {
      Raise: raisePercent,
      Call: callPercent,
      Fold: 100 - defendPercent,
    };
  }

  strategy.context = {
    heuristicSample: {
      ...simulation,
      eq: sampledEquity,
      provenance: 'heuristic_conditional_sample',
    },
    handClassification: handClassificationDetails(evaluation),
    aggressionScore,
    sampledEquity,
    requiredRawEquity,
    priceSource: trustedCallAmount === null
      ? 'unavailable_scenario_price'
      : trustedCallAmount === 0 ? 'trusted_free_action' : 'trusted_call_amount',
    priceDependentAdjustmentApplied: requiredRawEquity !== null,
    facesWager,
    compatibilityStackToPotRatio,
    stackSemantics: 'decision_context_compatibility_stack_not_effective_stack',
    playStyle,
    opponentStyle: clampUnit(options.opponentStyle),
    playStyleSemantics: 'continuous_aggression_bias',
    opponentStyleSemantics: 'higher_value_samples_a_looser_assumed_range',
    positionAdjustmentApplied: false,
    flatDropApplied: false,
    flatDropBbIgnored: Number.isFinite(Number(options.flatDropBb))
      ? Math.max(0, Number(options.flatDropBb))
      : 0,
    sizingSemantics: 'omitted_because_decision_context_lacks_complete_legal_raise_bounds',
  };
  return strategy;
}
