import {
  HAND_CATEGORIES,
  evaluateFive,
  evaluateSeven,
} from '../../../shared/poker-domain/evaluator.js';

export const HEURISTIC_RANK_VALUES = Object.freeze({
  2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
});

const STRAIGHT_WINDOWS = Object.freeze([
  Object.freeze([14, 2, 3, 4, 5]),
  ...Array.from({ length: 9 }, (_, index) => Object.freeze(
    Array.from({ length: 5 }, (__, offset) => index + 2 + offset),
  )),
]);

const MADE_HAND_LABELS = Object.freeze({
  high_card: 'High Card',
  board_pair: 'Pair on Board',
  weak_pair: 'Weak Pair',
  bottom_pair: 'Bottom Pair',
  middle_pair: 'Middle Pair',
  top_pair: 'Top Pair',
  overpair: 'Overpair',
  two_pair: 'Two Pair',
  set: 'Set',
  trips: 'Trips',
  straight: 'Straight',
  flush: 'Flush',
  full_house: 'Full House',
  quads: 'Quads',
  straight_flush: 'Straight Flush',
  board_two_pair: 'Two Pair on Board',
  board_trips: 'Trips on Board',
  board_straight: 'Straight on Board',
  board_flush: 'Flush on Board',
  board_full_house: 'Full House on Board',
  board_quads: 'Quads on Board',
  board_straight_flush: 'Straight Flush on Board',
});

function canonicalRankForAvailableCards(cards) {
  if (cards.length === 5) return evaluateFive(cards);
  if (cards.length === 7) return evaluateSeven(cards);
  if (cards.length !== 6) {
    throw new RangeError('Postflop classification requires five through seven cards');
  }
  let best = null;
  for (let excluded = 0; excluded < cards.length; excluded += 1) {
    const candidate = evaluateFive(cards.filter((_, index) => index !== excluded));
    if (best === null || candidate.score > best.score) best = candidate;
  }
  return best;
}

function countsOf(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return counts;
}

function straightSequenceHits(rankSet) {
  return STRAIGHT_WINDOWS.map((sequence) => ({
    sequence,
    hits: sequence.filter((rank) => rankSet.has(rank)),
  }));
}

function straightDrawFeatures(heroRanks, boardRanks, madeStraight) {
  const combined = new Set([...heroRanks, ...boardRanks]);
  const hero = new Set(heroRanks);
  const board = new Set(boardRanks);
  const outRanks = new Set();
  const endOutRanks = new Set();
  const internalOutRanks = new Set();

  if (!madeStraight) {
    for (const { sequence, hits } of straightSequenceHits(combined)) {
      if (hits.length !== 4) continue;
      const heroCreatesPattern = sequence.some((rank) => hero.has(rank) && !board.has(rank));
      if (!heroCreatesPattern) continue;
      const missingIndex = sequence.findIndex((rank) => !combined.has(rank));
      const missingRank = sequence[missingIndex];
      outRanks.add(missingRank);
      if (missingIndex === 0 || missingIndex === sequence.length - 1) endOutRanks.add(missingRank);
      else internalOutRanks.add(missingRank);
    }
  }

  const isOESD = endOutRanks.size >= 2;
  const isDoubleGutshot = !isOESD && outRanks.size >= 2;
  const isGutshot = !isOESD && outRanks.size >= 1;
  return {
    isOESD,
    isGutshot,
    isDoubleGutshot,
    straightOutRanks: [...outRanks].sort((left, right) => left - right),
    internalStraightOutRanks: [...internalOutRanks].sort((left, right) => left - right),
  };
}

function boardConnectivity(boardRanks) {
  const ranks = new Set(boardRanks);
  return straightSequenceHits(ranks).some(({ hits }) => hits.length >= 3);
}

function madeHandLabel(key) {
  return MADE_HAND_LABELS[key] || String(key || 'High Card');
}

function boardMadeKey(category) {
  return {
    [HAND_CATEGORIES.TWO_PAIR]: 'board_two_pair',
    [HAND_CATEGORIES.THREE_OF_A_KIND]: 'board_trips',
    [HAND_CATEGORIES.STRAIGHT]: 'board_straight',
    [HAND_CATEGORIES.FLUSH]: 'board_flush',
    [HAND_CATEGORIES.FULL_HOUSE]: 'board_full_house',
    [HAND_CATEGORIES.FOUR_OF_A_KIND]: 'board_quads',
    [HAND_CATEGORIES.STRAIGHT_FLUSH]: 'board_straight_flush',
  }[category] || 'high_card';
}

/**
 * Strategy-internal comparison adapter. The shared poker-domain evaluator is
 * the product authority; the heuristic consumes only its packed score.
 */
export function scoreHeuristicSeven(cards) {
  return evaluateSeven(cards).score;
}

/**
 * Postflop feature adapter. Canonical rank ordering comes from the shared
 * evaluator. Hero-specific labels and draw/texture facts are explicitly
 * heuristic strategic features and never decide sampled showdown winners.
 */
export function evaluatePostflopHandStrength(heroCards, boardCards) {
  if (!heroCards || heroCards.length !== 2 || !boardCards || boardCards.length < 3) {
    return {
      category: 'air',
      strategicCategory: 'air',
      madeHand: 'high_card',
      madeHandLabel: madeHandLabel('high_card'),
      canonicalRank: null,
      usesHeroCards: false,
      playsBoard: false,
      tripsType: null,
      isBoardPaired: false,
      isWetBoard: false,
      drawFeatures: null,
      boardTexture: null,
    };
  }

  const allCards = [...heroCards, ...boardCards];
  const canonicalRank = canonicalRankForAvailableCards(allCards);
  const heroRanks = heroCards.map((card) => HEURISTIC_RANK_VALUES[card[0]]);
  const boardRanks = boardCards.map((card) => HEURISTIC_RANK_VALUES[card[0]]);
  const allRanks = [...heroRanks, ...boardRanks];
  const heroRankCounts = countsOf(heroRanks);
  const boardRankCounts = countsOf(boardRanks);
  const allRankCounts = countsOf(allRanks);
  const boardSuitCounts = countsOf(boardCards.map((card) => card[1]));
  const allSuitCounts = countsOf(allCards.map((card) => card[1]));
  const heroSuitCounts = countsOf(heroCards.map((card) => card[1]));
  const isPocketPair = heroRanks[0] === heroRanks[1];
  const distinctBoardRanks = [...boardRankCounts.keys()].sort((left, right) => right - left);
  const isBoardPaired = [...boardRankCounts.values()].some((count) => count >= 2);
  const isFlushyBoard = [...boardSuitCounts.values()].some((count) => count >= 3);
  const isConnectedBoard = boardConnectivity(boardRanks);
  const isWetBoard = isFlushyBoard || isConnectedBoard;

  const madeStraight = [HAND_CATEGORIES.STRAIGHT, HAND_CATEGORIES.STRAIGHT_FLUSH]
    .includes(canonicalRank.category);
  const straightDraw = straightDrawFeatures(heroRanks, boardRanks, madeStraight);
  let flushDrawSuit = null;
  if (![HAND_CATEGORIES.FLUSH, HAND_CATEGORIES.STRAIGHT_FLUSH].includes(canonicalRank.category)
    && boardCards.length < 5) {
    for (const [suit, count] of allSuitCounts) {
      if (count === 4 && (heroSuitCounts.get(suit) || 0) > 0) {
        flushDrawSuit = suit;
        break;
      }
    }
  }
  const backdoorFlushDraw = boardCards.length === 3 && [...allSuitCounts].some(([suit, count]) => (
    count === 3 && (heroSuitCounts.get(suit) || 0) > 0
  ));
  const drawFeatures = {
    madeFlush: [HAND_CATEGORIES.FLUSH, HAND_CATEGORIES.STRAIGHT_FLUSH]
      .includes(canonicalRank.category),
    flushDraw: flushDrawSuit !== null,
    flushDrawSuit,
    nutFlushDraw: flushDrawSuit !== null && heroCards.includes(`A${flushDrawSuit}`),
    backdoorFlushDraw,
    ...straightDraw,
  };

  const boardTexture = {
    isPaired: isBoardPaired,
    isFlushy: isFlushyBoard,
    isConnected: isConnectedBoard,
    isWet: isWetBoard,
    monotone: new Set(boardCards.map((card) => card[1])).size === 1,
    twoTone: new Set(boardCards.map((card) => card[1])).size === 2,
    rainbow: new Set(boardCards.map((card) => card[1])).size === boardCards.length,
    flushDraw: drawFeatures.flushDraw,
    flushDrawSuit,
    nutFlushDraw: drawFeatures.nutFlushDraw,
    backdoorFlushDraw,
    isOESD: drawFeatures.isOESD,
    isGutshot: drawFeatures.isGutshot,
    isDoubleGutshot: drawFeatures.isDoubleGutshot,
    straightOutRanks: drawFeatures.straightOutRanks,
  };

  let playsBoard = false;
  if (boardCards.length === 5) {
    playsBoard = evaluateFive(boardCards).score === canonicalRank.score;
  }

  const matchedBoardRanks = [...new Set(heroRanks.filter((rank) => boardRankCounts.has(rank)))];
  const heroContributesPair = isPocketPair || matchedBoardRanks.length > 0;
  let tripsType = null;
  let madeHand = 'high_card';
  let strategicCategory = 'air';

  if (playsBoard && canonicalRank.category !== HAND_CATEGORIES.HIGH_CARD) {
    madeHand = boardMadeKey(canonicalRank.category);
  } else if (canonicalRank.category === HAND_CATEGORIES.STRAIGHT_FLUSH) {
    madeHand = 'straight_flush';
    strategicCategory = 'monster';
  } else if (canonicalRank.category === HAND_CATEGORIES.FOUR_OF_A_KIND) {
    madeHand = 'quads';
    strategicCategory = 'monster';
  } else if (canonicalRank.category === HAND_CATEGORIES.FULL_HOUSE) {
    madeHand = 'full_house';
    strategicCategory = 'monster';
  } else if (canonicalRank.category === HAND_CATEGORIES.FLUSH) {
    madeHand = 'flush';
    strategicCategory = 'monster';
  } else if (canonicalRank.category === HAND_CATEGORIES.STRAIGHT) {
    madeHand = 'straight';
    strategicCategory = 'monster';
  } else if (canonicalRank.category === HAND_CATEGORIES.THREE_OF_A_KIND) {
    const tripRank = [...allRankCounts].find(([, count]) => count >= 3)?.[0] ?? null;
    if (tripRank !== null && heroRankCounts.get(tripRank) === 2
      && boardRankCounts.get(tripRank) === 1) {
      tripsType = 'set';
      madeHand = 'set';
      strategicCategory = 'monster';
    } else if (tripRank !== null && heroRankCounts.get(tripRank) === 1
      && boardRankCounts.get(tripRank) >= 2) {
      tripsType = 'trips';
      madeHand = 'trips';
      strategicCategory = 'monster';
    } else {
      madeHand = 'board_trips';
    }
  } else if (canonicalRank.category === HAND_CATEGORIES.TWO_PAIR) {
    const boardHasTwoPair = [...boardRankCounts.values()].filter((count) => count >= 2).length >= 2;
    if (boardHasTwoPair && !heroContributesPair) {
      madeHand = 'board_two_pair';
    } else {
      madeHand = 'two_pair';
      strategicCategory = 'two_pair';
    }
  } else if (canonicalRank.category === HAND_CATEGORIES.ONE_PAIR) {
    if (!heroContributesPair) {
      madeHand = 'board_pair';
    } else if (isPocketPair) {
      const pairRank = heroRanks[0];
      const highestBoardRank = Math.max(...boardRanks);
      const lowestBoardRank = Math.min(...boardRanks);
      if (pairRank > highestBoardRank) {
        madeHand = 'overpair';
        strategicCategory = 'overpair';
      } else if (pairRank < lowestBoardRank) {
        madeHand = 'weak_pair';
        strategicCategory = 'weak_pair';
      } else {
        madeHand = 'middle_pair';
        strategicCategory = 'middle_pair';
      }
    } else {
      const matchedRank = Math.max(...matchedBoardRanks);
      if (matchedRank === distinctBoardRanks[0]) {
        madeHand = 'top_pair';
        strategicCategory = 'top_pair';
      } else if (matchedRank === distinctBoardRanks[distinctBoardRanks.length - 1]) {
        madeHand = 'bottom_pair';
        strategicCategory = 'bottom_pair';
      } else {
        madeHand = 'middle_pair';
        strategicCategory = 'middle_pair';
      }
    }
  }

  if (strategicCategory === 'air' && drawFeatures.flushDraw) strategicCategory = 'flush_draw';

  return {
    category: strategicCategory,
    strategicCategory,
    madeHand,
    madeHandLabel: madeHandLabel(madeHand),
    canonicalRank: {
      category: canonicalRank.category,
      score: canonicalRank.score,
      tiebreakers: [...canonicalRank.tiebreakers],
      bestFiveCards: [...canonicalRank.bestFiveCards],
    },
    usesHeroCards: !playsBoard && canonicalRank.bestFiveCards.some((card) => heroCards.includes(card)),
    playsBoard,
    tripsType,
    isBoardPaired,
    isWetBoard,
    drawFeatures,
    boardTexture,
  };
}
