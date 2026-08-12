import { evaluateSeven } from '../../../shared/poker-domain/evaluator.js';

export const HEURISTIC_RANK_VALUES = Object.freeze({
  2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
});

/**
 * Strategy-internal comparison adapter. The shared poker-domain evaluator is
 * the product authority; the heuristic consumes only its packed score.
 */
export function scoreHeuristicSeven(cards) {
  return evaluateSeven(cards).score;
}

/**
 * Legacy fallback classifier retained for behavior compatibility only. Its
 * categories and texture flags are heuristic inputs, not canonical hand-rank
 * or Equity results.
 */
export function evaluatePostflopHandStrength(heroCards, boardCards) {
  if (!heroCards || heroCards.length !== 2 || !boardCards || boardCards.length < 3) {
    return {
      category: 'air',
      score: 0,
      tripsType: null,
      tripsStrength: 1,
      isBoardPaired: false,
      isWetBoard: false,
      boardTexture: null,
    };
  }

  const allCards = [...heroCards, ...boardCards];
  const hRanks = heroCards.map((card) => HEURISTIC_RANK_VALUES[card[0]] ?? 0);
  const bRanks = boardCards.map((card) => HEURISTIC_RANK_VALUES[card[0]] ?? 0);
  const maxBoardRank = Math.max(...bRanks);
  const matchedBoardRanks = hRanks.filter((rank) => bRanks.includes(rank));
  const isPocketPair = hRanks[0] === hRanks[1];

  const boardRankCounts = {};
  bRanks.forEach((rank) => { boardRankCounts[rank] = (boardRankCounts[rank] || 0) + 1; });
  const isBoardPaired = Object.values(boardRankCounts).some((count) => count >= 2);

  const boardSuits = boardCards.map((card) => card[1]);
  const boardSuitCounts = {};
  boardSuits.forEach((suit) => { boardSuitCounts[suit] = (boardSuitCounts[suit] || 0) + 1; });
  const isFlushyBoard = Object.values(boardSuitCounts).some((count) => count >= 3);

  const sortedBoardRanks = [...new Set(bRanks)].sort((left, right) => left - right);
  let maxConsecutive = 1;
  let currentConsecutive = 1;
  for (let index = 1; index < sortedBoardRanks.length; index += 1) {
    if (sortedBoardRanks[index] - sortedBoardRanks[index - 1] <= 2) {
      currentConsecutive += 1;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }
  const isConnectedBoard = maxConsecutive >= 3;
  const isWetBoard = isFlushyBoard || isConnectedBoard;

  const heroSuits = heroCards.map((card) => card[1]);
  let flushDrawCompletion = false;
  let flushDrawSuit = null;
  for (const [suit, count] of Object.entries(boardSuitCounts)) {
    if (count === 2 && heroSuits.filter((heroSuit) => heroSuit === suit).length >= 2) {
      flushDrawCompletion = true;
      flushDrawSuit = suit;
      break;
    }
  }

  let backdoorFlushDraw = false;
  for (const [suit, count] of Object.entries(boardSuitCounts)) {
    if (count === 1 && heroSuits.filter((heroSuit) => heroSuit === suit).length >= 2) {
      backdoorFlushDraw = true;
      break;
    }
  }

  const combinedRanks = [...new Set([...hRanks, ...bRanks])].sort((left, right) => left - right);
  let maxConsecutiveWithHero = 1;
  let currentWithHero = 1;
  for (let index = 1; index < combinedRanks.length; index += 1) {
    if (combinedRanks[index] - combinedRanks[index - 1] <= 2) {
      currentWithHero += 1;
      maxConsecutiveWithHero = Math.max(maxConsecutiveWithHero, currentWithHero);
    } else {
      currentWithHero = 1;
    }
  }
  const straightDrawCompletion = maxConsecutiveWithHero > maxConsecutive
    && maxConsecutiveWithHero >= 3;
  const straightCompletionCount = straightDrawCompletion
    ? maxConsecutiveWithHero - maxConsecutive
    : 0;

  let isOESD = false;
  for (let index = 0; index <= combinedRanks.length - 4; index += 1) {
    if (combinedRanks[index + 3] - combinedRanks[index] === 3) {
      isOESD = true;
      break;
    }
  }

  let isGutshot = false;
  for (let index = 0; index <= combinedRanks.length - 4; index += 1) {
    const sequence = combinedRanks.slice(index, index + 4);
    const gaps = [];
    for (let gapIndex = 1; gapIndex < 4; gapIndex += 1) {
      gaps.push(sequence[gapIndex] - sequence[gapIndex - 1]);
    }
    if (gaps.filter((gap) => gap === 1).length === 2
      && gaps.filter((gap) => gap === 2).length === 1) {
      isGutshot = true;
      break;
    }
  }

  const boardTexture = {
    isPaired: isBoardPaired,
    isFlushy: isFlushyBoard,
    isConnected: isConnectedBoard,
    isWet: isWetBoard,
    flushDrawCompletion,
    flushDrawSuit,
    backdoorFlushDraw,
    straightDrawCompletion,
    straightCompletionCount,
    isOESD,
    isGutshot,
    monotone: Object.values(boardSuitCounts).some((count) => count >= 3)
      && new Set(boardSuits).size === 1,
    twoTone: new Set(boardSuits).size === 2,
    rainbow: new Set(boardSuits).size === 3,
  };

  const rankCounts = {};
  allCards.forEach((card) => {
    const rank = HEURISTIC_RANK_VALUES[card[0]];
    if (rank !== undefined) rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  });
  const counts = Object.values(rankCounts).sort((left, right) => right - left);
  const maxRankCount = counts[0] || 0;
  const secondRankCount = counts[1] || 0;

  let tripsType = null;
  let tripsStrength = 1;
  if (maxRankCount >= 3) {
    const tripRank = Object.keys(rankCounts).find((rank) => rankCounts[rank] === 3);
    if (tripRank && isPocketPair) {
      if (hRanks[0] === Number.parseInt(tripRank, 10)) {
        tripsType = 'set';
        tripsStrength = 1.4;
      } else {
        tripsType = 'trips';
        const kickerRank = hRanks.find((rank) => rank !== Number.parseInt(tripRank, 10));
        if (kickerRank >= 12) tripsStrength = 1;
        else if (kickerRank < 10) tripsStrength = 0.7;
        else tripsStrength = 0.85;
      }
    } else if (!isPocketPair) {
      tripsType = 'trips';
      const kickerRank = hRanks.find((rank) => rank !== Number.parseInt(tripRank, 10));
      if (kickerRank >= 12) tripsStrength = 1;
      else if (kickerRank < 10) tripsStrength = 0.7;
      else tripsStrength = 0.85;
    }
  }

  let isFlush = false;
  let isFlushDraw = false;
  const allSuitCounts = {};
  allCards.forEach((card) => { allSuitCounts[card[1]] = (allSuitCounts[card[1]] || 0) + 1; });
  Object.values(allSuitCounts).forEach((count) => {
    if (count >= 5) isFlush = true;
    if (count === 4) isFlushDraw = true;
  });

  const uniqueRanks = [...new Set(allCards.map((card) => HEURISTIC_RANK_VALUES[card[0]]))]
    .sort((left, right) => right - left);
  // Preserve the legacy classifier's compatibility behavior exactly.
  if (uniqueRanks.includes(12)) uniqueRanks.push(-1);
  let isStraight = false;
  for (let index = 0; index <= uniqueRanks.length - 5; index += 1) {
    if (uniqueRanks[index] - uniqueRanks[index + 4] === 4) {
      isStraight = true;
      break;
    }
  }

  const result = (category, score) => ({
    category,
    score,
    tripsType,
    tripsStrength,
    isBoardPaired,
    isWetBoard,
    boardTexture,
  });

  if (maxRankCount >= 4) return result('monster', 10);
  if (maxRankCount >= 3 && secondRankCount >= 2) return result('monster', 9.8);
  if (isFlush) return result('monster', 9.5);
  if (isStraight) return result('monster', 9);
  if (maxRankCount >= 3) return result('monster', 8.8);
  if (matchedBoardRanks.length === 2 && !isPocketPair) return result('two_pair', 8);
  if (counts.filter((count) => count >= 2).length >= 2) return result('two_pair', 7.8);
  if (isPocketPair && hRanks[0] > maxBoardRank) return result('overpair', 7.5);
  if (matchedBoardRanks.includes(maxBoardRank)) return result('top_pair', 7);
  if (matchedBoardRanks.length === 1 || isPocketPair) return result('middle_pair', 4.5);
  if (isFlushDraw) return result('flush_draw', 5.5);
  return result('air', 1);
}
