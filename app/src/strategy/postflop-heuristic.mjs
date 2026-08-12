import {
  HEURISTIC_RANK_VALUES,
  evaluatePostflopHandStrength,
  scoreHeuristicSeven,
} from './heuristic-evaluator.mjs';

const DECK_RANKS = Object.freeze(['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']);
const DECK_SUITS = Object.freeze(['s', 'h', 'd', 'c']);

/**
 * Legacy sampled strength used only by the heuristic strategy fallback. This
 * is deliberately separate from the canonical Equity service.
 */
export function simulateHeuristicEquity({
  heroCards,
  board,
  deadCards = [],
  tableSize,
  facingSizeBb,
  lastAction,
  opponentStyle = 0,
  iterations = 800,
  rng,
}) {
  if (typeof rng !== 'function') throw new TypeError('Heuristic equity requires an injected RNG');

  const excluded = heroCards.concat(board).concat(deadCards || []).filter(Boolean);
  const filteredHeroCards = heroCards.filter(Boolean);
  const boardCards = board.filter(Boolean);
  const deck = [];
  for (const rank of DECK_RANKS) {
    for (const suit of DECK_SUITS) {
      if (!excluded.includes(rank + suit)) deck.push(rank + suit);
    }
  }

  let wins = 0;
  let ties = 0;
  const neededRunout = Math.max(0, 5 - boardCards.length);
  let villainCombos = [];
  for (let first = 0; first < deck.length; first += 1) {
    for (let second = first + 1; second < deck.length; second += 1) {
      const card1 = deck[first];
      const card2 = deck[second];
      const rank1 = HEURISTIC_RANK_VALUES[card1[0]] || 0;
      const rank2 = HEURISTIC_RANK_VALUES[card2[0]] || 0;
      const highRank = Math.max(rank1, rank2);
      const lowRank = Math.min(rank1, rank2);
      const isPair = rank1 === rank2;
      const isSuited = card1[1] === card2[1];
      let points = 0;
      if (isPair) {
        points = highRank * 5 + 30;
      } else {
        points = highRank * 3 + lowRank;
        if (isSuited) points += 8;
        const gap = highRank - lowRank;
        if (gap === 1) points += 4;
        else if (gap === 2) points += 2;
        else if (gap === 3) points += 1;
      }
      villainCombos.push({ hand: [card1, card2], points });
    }
  }

  villainCombos.sort((left, right) => right.points - left.points);
  let basePercent = 0.15 + 0.3 * opponentStyle;
  if (facingSizeBb > 0 || String(lastAction || '').toLowerCase().includes('raise')) {
    basePercent *= 0.7;
  }
  if (tableSize >= 6) basePercent *= 0.9;
  const rangePercent = Math.max(0.05, Math.min(1, basePercent));
  const cutoff = Math.max(1, Math.floor(villainCombos.length * rangePercent));
  villainCombos = villainCombos.slice(0, cutoff);

  const villainCount = Math.max(1, tableSize - 1);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const villainHands = [];
    const usedCards = [...filteredHeroCards, ...boardCards];
    for (let villain = 0; villain < villainCount; villain += 1) {
      let candidate;
      let valid = false;
      let attempts = 0;
      while (!valid && attempts < 20) {
        candidate = villainCombos[Math.floor(rng() * villainCombos.length)];
        if (!usedCards.includes(candidate.hand[0]) && !usedCards.includes(candidate.hand[1])) {
          valid = true;
        }
        attempts += 1;
      }
      if (valid) {
        villainHands.push(candidate.hand);
        usedCards.push(candidate.hand[0], candidate.hand[1]);
      }
    }

    const runoutDeck = deck.filter((card) => !usedCards.includes(card));
    const runout = [];
    const deckLength = runoutDeck.length;
    for (let cardIndex = 0; cardIndex < neededRunout; cardIndex += 1) {
      const randomIndex = cardIndex + Math.floor(rng() * (deckLength - cardIndex));
      const temporary = runoutDeck[cardIndex];
      runoutDeck[cardIndex] = runoutDeck[randomIndex];
      runoutDeck[randomIndex] = temporary;
      runout.push(runoutDeck[cardIndex]);
    }

    const finalBoard = boardCards.concat(runout);
    const heroScore = scoreHeuristicSeven([...filteredHeroCards, ...finalBoard]);
    let maximumVillainScore = 0;
    for (const villainHand of villainHands) {
      maximumVillainScore = Math.max(
        maximumVillainScore,
        scoreHeuristicSeven([...villainHand, ...finalBoard]),
      );
    }
    if (heroScore > maximumVillainScore) wins += 1;
    else if (heroScore === maximumVillainScore) ties += 1;
  }

  return {
    eq: (wins + ties / 2) / iterations,
    pct: rangePercent,
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
    facingSizeBb: decisionContext.facingSizeBb,
    lastAction: decisionContext.lastAction,
    opponentStyle: options.opponentStyle,
    iterations: 250,
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
  let equity = simulation.eq;

  // Compatibility-only manual drop. It remains distinct from ClubGG's fixed
  // per-player contribution and does not mutate DecisionContext accounting.
  const flatDropBb = options.flatDropBb;
  const potSize = (Number(decisionContext.potBb) || 1.5) + flatDropBb;
  const facingSize = Number(decisionContext.facingSizeBb) || 0;
  const trustedCallAmount = Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0
    ? decisionContext.callAmountBb
    : null;
  const stack = Number(decisionContext.stackBb) || 100;
  const spr = stack / (potSize || 1);
  const bleedDiscount = flatDropBb * 0.15;
  const tripsType = evaluation.tripsType || null;
  const tripsStrength = evaluation.tripsStrength || 1;
  const isBoardPaired = evaluation.isBoardPaired || false;
  const isWetBoard = evaluation.isWetBoard || false;
  const boardTexture = evaluation.boardTexture || {};

  if (boardTexture.flushDrawCompletion) equity *= 1.15;
  if (boardTexture.backdoorFlushDraw && evaluation.category === 'middle_pair') equity *= 1.05;
  if (boardTexture.isOESD) equity *= 1.12;
  else if (boardTexture.isGutshot) equity *= 1.04;
  if (boardTexture.monotone && evaluation.category === 'air') equity *= 0.85;
  if (tripsType && tripsStrength !== 1) equity *= tripsStrength;
  if (isBoardPaired && evaluation.category === 'monster' && !tripsType) equity *= 0.8;

  if (isWetBoard && evaluation.category === 'top_pair') {
    const heroSuits = heroCards.map((card) => card[1]);
    const boardSuits = board.map((card) => card[1]);
    const hasSuitBlocker = heroSuits.some((suit) => boardSuits.includes(suit));
    if (!hasSuitBlocker) equity *= 0.75;
  }

  if (spr < 2) {
    if ((evaluation.category === 'top_pair' || evaluation.category === 'two_pair' || tripsType)
      && tripsType && tripsStrength < 1) {
      equity /= tripsStrength;
    }
  } else if (spr > 10) {
    if (tripsType === 'trips' && tripsStrength < 1) equity *= 0.8;
    if (evaluation.category === 'top_pair' && isWetBoard) equity *= 0.7;
  }

  const isSuited = heroCards[0][1] === heroCards[1][1];
  const rank1 = HEURISTIC_RANK_VALUES[heroCards[0][0]];
  const rank2 = HEURISTIC_RANK_VALUES[heroCards[1][0]];
  const isKxQx = rank1 >= 10 || rank2 >= 10;
  if (isSuited || isKxQx) equity *= 1 + 0.15 * options.playStyle;

  // calculateBoardWetness was never defined in production, so its guarded
  // compatibility branch had no runtime effect and is intentionally omitted.
  const requiredRawEquity = trustedCallAmount !== null && trustedCallAmount > 0
    ? trustedCallAmount / (potSize + trustedCallAmount)
    : null;
  let realizationFactor = 1;
  const heroPosition = decisionContext.heroPosition || 'BTN';
  const villainPosition = ['BTN', 'CO', 'HJ'].includes(heroPosition) ? 'BB' : 'SB';
  const inPosition = ['BTN', 'CO', 'HJ'].includes(heroPosition)
    && ['BB', 'SB'].includes(villainPosition);
  if (inPosition) realizationFactor += 0.15;
  else realizationFactor -= 0.1;
  const isConnected = Math.abs(rank1 - rank2) <= 2;
  if (isSuited) realizationFactor += 0.1;
  if (isConnected) realizationFactor += 0.05;

  let realizedEquity = equity * realizationFactor;
  if (evaluation.category === 'monster') realizedEquity = Math.max(realizedEquity, 0.9);
  realizedEquity = Math.min(1, realizedEquity);

  let strategy;
  const openThreshold = 0.85 - bleedDiscount;
  const betThreshold = 0.65 - bleedDiscount;
  const callRaiseThreshold = 0.75 - bleedDiscount;
  if (facingSize === 0) {
    if (realizedEquity >= openThreshold || equity >= 0.95 || evaluation.category === 'monster') {
      strategy = { Bet: 100 };
    } else if (realizedEquity >= betThreshold
      || evaluation.category === 'two_pair' || evaluation.category === 'top_pair') {
      strategy = { Bet: 75, Check: 25 };
    } else if (realizedEquity >= 0.5 - bleedDiscount || evaluation.category === 'middle_pair') {
      strategy = { Bet: 25, Check: 75 };
    } else {
      strategy = { Check: 100 };
    }
  } else if (realizedEquity >= 0.9 - bleedDiscount || evaluation.category === 'monster') {
    strategy = { Raise: 100 };
  } else if (realizedEquity >= callRaiseThreshold || evaluation.category === 'two_pair') {
    strategy = { Raise: 25, Call: 75 };
  } else if (requiredRawEquity !== null
    ? realizedEquity >= requiredRawEquity
    : realizedEquity >= 0.5 - bleedDiscount) {
    strategy = { Call: 100 };
  } else {
    strategy = { Fold: 100 };
  }

  strategy.context = {
    tripsType,
    tripsStrength,
    isBoardPaired,
    isWetBoard,
    spr,
    originalEquity: simulation.eq,
    modifiedEquity: equity,
    boardTexture,
  };
  return strategy;
}
