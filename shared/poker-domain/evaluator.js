import { assertCardArray, assertUniqueKnownCards, CARD_RANKS } from './cards.js';
import { deepFreeze } from './freeze.js';
import { POKER_HAND_RANK_SCHEMA_VERSION } from './schema.js';

export const HAND_CATEGORIES = Object.freeze({
  HIGH_CARD: 'high_card',
  ONE_PAIR: 'one_pair',
  TWO_PAIR: 'two_pair',
  THREE_OF_A_KIND: 'three_of_a_kind',
  STRAIGHT: 'straight',
  FLUSH: 'flush',
  FULL_HOUSE: 'full_house',
  FOUR_OF_A_KIND: 'four_of_a_kind',
  STRAIGHT_FLUSH: 'straight_flush',
});

const CATEGORY_BY_RANK = Object.freeze([
  HAND_CATEGORIES.HIGH_CARD,
  HAND_CATEGORIES.ONE_PAIR,
  HAND_CATEGORIES.TWO_PAIR,
  HAND_CATEGORIES.THREE_OF_A_KIND,
  HAND_CATEGORIES.STRAIGHT,
  HAND_CATEGORIES.FLUSH,
  HAND_CATEGORIES.FULL_HOUSE,
  HAND_CATEGORIES.FOUR_OF_A_KIND,
  HAND_CATEGORIES.STRAIGHT_FLUSH,
]);
const RANK_VALUE = Object.freeze(Object.fromEntries(
  [...CARD_RANKS].map((rank, index) => [rank, index + 2]),
));
const SCORE_WEIGHTS = Object.freeze([50_625, 3375, 225, 15, 1]);

function packScore(categoryRank, tiebreakers) {
  return categoryRank * 1e10 + tiebreakers.reduce((sum, rank, index) => (
    sum + rank * SCORE_WEIGHTS[index]
  ), 0);
}

function straightHigh(ranks) {
  const unique = [...new Set(ranks)].sort((left, right) => right - left);
  if (unique.length !== 5) return null;
  if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4
    && unique[3] === 3 && unique[4] === 2) return 5;
  return unique[0] - unique[4] === 4 ? unique[0] : null;
}

function structuralRank(categoryRank, tiebreakers, bestFiveCards) {
  return deepFreeze({
    schemaVersion: POKER_HAND_RANK_SCHEMA_VERSION,
    score: packScore(categoryRank, tiebreakers),
    category: CATEGORY_BY_RANK[categoryRank],
    categoryRank,
    tiebreakers: [...tiebreakers],
    bestFiveCards: [...bestFiveCards],
  });
}

function evaluateFiveUnchecked(cards) {
  const ranks = cards.map((card) => RANK_VALUE[card[0]]).sort((left, right) => right - left);
  const flush = cards.every((card) => card[1] === cards[0][1]);
  const highStraight = straightHigh(ranks);
  if (flush && highStraight !== null) return structuralRank(8, [highStraight], cards);

  const counts = new Map();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) || 0) + 1);
  const groups = [...counts.entries()].sort((left, right) => (
    right[1] - left[1] || right[0] - left[0]
  ));
  const four = groups.find(([, count]) => count === 4);
  if (four) {
    const kicker = groups.find(([, count]) => count === 1)[0];
    return structuralRank(7, [four[0], kicker], cards);
  }

  const three = groups.find(([, count]) => count === 3);
  const pairs = groups.filter(([, count]) => count === 2).map(([rank]) => rank)
    .sort((left, right) => right - left);
  if (three && pairs.length > 0) return structuralRank(6, [three[0], pairs[0]], cards);
  if (flush) return structuralRank(5, ranks, cards);
  if (highStraight !== null) return structuralRank(4, [highStraight], cards);
  if (three) {
    const kickers = groups.filter(([, count]) => count === 1).map(([rank]) => rank)
      .sort((left, right) => right - left);
    return structuralRank(3, [three[0], ...kickers], cards);
  }
  if (pairs.length >= 2) {
    const kicker = groups.find(([, count]) => count === 1)[0];
    return structuralRank(2, [pairs[0], pairs[1], kicker], cards);
  }
  if (pairs.length === 1) {
    const kickers = groups.filter(([, count]) => count === 1).map(([rank]) => rank)
      .sort((left, right) => right - left);
    return structuralRank(1, [pairs[0], ...kickers], cards);
  }
  return structuralRank(0, ranks, cards);
}

function validateCards(cards, expectedCount, label) {
  assertCardArray(cards, label);
  if (cards.length !== expectedCount) {
    throw new RangeError(`${label} requires exactly ${expectedCount} cards`);
  }
  assertUniqueKnownCards([{ label, cards }]);
}

export function evaluateFive(cards) {
  validateCards(cards, 5, 'evaluateFive.cards');
  return evaluateFiveUnchecked(cards);
}

export function evaluateSeven(cards) {
  validateCards(cards, 7, 'evaluateSeven.cards');
  let best = null;
  for (let firstExcluded = 0; firstExcluded < 6; firstExcluded += 1) {
    for (let secondExcluded = firstExcluded + 1; secondExcluded < 7; secondExcluded += 1) {
      const five = cards.filter((_, index) => (
        index !== firstExcluded && index !== secondExcluded
      ));
      const candidate = evaluateFiveUnchecked(five);
      if (best === null || candidate.score > best.score) best = candidate;
    }
  }
  return best;
}

export function compareHandRanks(left, right) {
  if (!left || left.schemaVersion !== POKER_HAND_RANK_SCHEMA_VERSION
    || !right || right.schemaVersion !== POKER_HAND_RANK_SCHEMA_VERSION) {
    throw new TypeError(`compareHandRanks requires two ${POKER_HAND_RANK_SCHEMA_VERSION} values`);
  }
  return Math.sign(left.score - right.score);
}
