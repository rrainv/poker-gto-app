import { assertCardArray, assertUniqueKnownCards } from '../../../shared/poker-domain/cards.js';
import { compareHandRanks, evaluateFive, evaluateSeven, HAND_CATEGORIES } from '../../../shared/poker-domain/evaluator.js';
import { deepFreeze } from '../../../shared/poker-domain/freeze.js';
import { HOLDEM_DECK } from '../../../shared/poker-domain/holdem-combos.js';
import { createRangeAnalysisFacts, createRangeAnalysisRequest } from './range-analysis.mjs';

export const EQUITY_HAND_ANALYSIS_SCHEMA_VERSION = 'equity-hand-analysis/v1';
export const EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION = 'exact-entered-hand-outcomes/v1';

const RANK_VALUE = Object.freeze(Object.fromEntries(
  [...'23456789TJQKA'].map((rank, index) => [rank, index + 2]),
));

export function evaluateAvailableCards(cards) {
  if (cards.length === 5) return evaluateFive(cards);
  if (cards.length === 7) return evaluateSeven(cards);
  if (cards.length !== 6) throw new RangeError('Exact entered-hand comparison requires five through seven cards');
  let best = null;
  for (let excluded = 0; excluded < cards.length; excluded += 1) {
    const candidate = evaluateFive(cards.filter((_, index) => index !== excluded));
    if (best === null || compareHandRanks(candidate, best) > 0) best = candidate;
  }
  return best;
}

function cardsForRank(cards, rank) {
  return cards.filter((card) => RANK_VALUE[card[0]] === rank);
}

export function orderBestFiveForPresentation(canonicalRank) {
  const cards = canonicalRank?.bestFiveCards;
  const tiebreakers = canonicalRank?.tiebreakers;
  if (!Array.isArray(cards) || cards.length !== 5 || !Array.isArray(tiebreakers)) return [];

  const ranks = (() => {
    switch (canonicalRank.category) {
      case HAND_CATEGORIES.FOUR_OF_A_KIND:
        return [tiebreakers[0], tiebreakers[0], tiebreakers[0], tiebreakers[0], tiebreakers[1]];
      case HAND_CATEGORIES.FULL_HOUSE:
        return [tiebreakers[0], tiebreakers[0], tiebreakers[0], tiebreakers[1], tiebreakers[1]];
      case HAND_CATEGORIES.THREE_OF_A_KIND:
        return [tiebreakers[0], tiebreakers[0], tiebreakers[0], ...tiebreakers.slice(1)];
      case HAND_CATEGORIES.TWO_PAIR:
        return [tiebreakers[0], tiebreakers[0], tiebreakers[1], tiebreakers[1], tiebreakers[2]];
      case HAND_CATEGORIES.ONE_PAIR:
        return [tiebreakers[0], tiebreakers[0], ...tiebreakers.slice(1)];
      case HAND_CATEGORIES.STRAIGHT:
      case HAND_CATEGORIES.STRAIGHT_FLUSH: {
        const high = tiebreakers[0];
        return high === 5 ? [5, 4, 3, 2, 14] : [high, high - 1, high - 2, high - 3, high - 4];
      }
      case HAND_CATEGORIES.FLUSH:
      case HAND_CATEGORIES.HIGH_CARD:
        return [...tiebreakers];
      default:
        return [];
    }
  })();

  const remaining = [...cards];
  const ordered = [];
  for (const rank of ranks) {
    const match = cardsForRank(remaining, rank)[0];
    if (!match) return [...cards];
    ordered.push(match);
    remaining.splice(remaining.indexOf(match), 1);
  }
  return ordered.length === 5 && remaining.length === 0 ? ordered : [...cards];
}

function normalizedPlayers(players) {
  if (!Array.isArray(players) || players.length < 2 || players.length > 10) {
    throw new RangeError('Exact entered-hand analysis requires 2 through 10 players');
  }
  const ids = new Set();
  return players.map((player, index) => {
    const id = String(player?.id || '').trim();
    if (!id || ids.has(id)) throw new TypeError('Each exact entered-hand player requires a unique id');
    ids.add(id);
    if (player.cards === null) return { id, cards: null };
    assertCardArray(player.cards, `players[${index}].cards`);
    if (player.cards.length !== 2) throw new RangeError(`players[${index}].cards requires exactly two cards or null`);
    return { id, cards: [...player.cards] };
  });
}

function groupedOutcomes(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.resultCategory;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry.card);
  }
  return [...groups].map(([resultCategory, cards]) => ({
    resultCategory,
    count: cards.length,
    cards,
  }));
}

function outcomeFamily(entries) {
  return {
    count: entries.length,
    cards: entries.map((entry) => entry.card),
    groups: groupedOutcomes(entries),
  };
}

function currentStandingFor(ranks, playerIndex) {
  const comparisons = ranks.map((rank, opponentIndex) => (
    opponentIndex === playerIndex ? null : compareHandRanks(ranks[playerIndex], rank)
  )).filter((comparison) => comparison !== null);
  if (comparisons.every((comparison) => comparison > 0)) return 'leading';
  if (comparisons.every((comparison) => comparison >= 0)
    && comparisons.some((comparison) => comparison === 0)) return 'tied';
  return 'behind';
}

export function createExactEnteredHandOutcomeFacts(input = {}) {
  const players = normalizedPlayers(input.players);
  const board = [...(input.board || [])];
  const deadCards = [...(input.deadCards || [])];
  assertCardArray(board, 'board');
  assertCardArray(deadCards, 'deadCards');
  if (board.length > 5) throw new RangeError('board supports at most five cards');
  assertUniqueKnownCards([
    ...players.filter((player) => player.cards).map((player) => ({ label: `player ${player.id}`, cards: player.cards })),
    { label: 'board', cards: board },
    { label: 'deadCards', cards: deadCards },
  ]);

  if (players.some((player) => player.cards === null)) {
    return deepFreeze({
      schemaVersion: EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
      available: false,
      reason: 'unknown_opponent',
      comparisonUniverse: 'all_entered_exact_hands',
      boardCardCount: board.length,
      players: [],
    });
  }
  if (board.length < 3) {
    return deepFreeze({
      schemaVersion: EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
      available: false,
      reason: 'insufficient_board',
      comparisonUniverse: 'all_entered_exact_hands',
      boardCardCount: board.length,
      players: [],
    });
  }

  const currentRanks = players.map((player) => evaluateAvailableCards([...player.cards, ...board]));
  const currentStandings = currentRanks.map((_, playerIndex) => currentStandingFor(currentRanks, playerIndex));
  const nextCardAvailable = board.length === 3 || board.length === 4;
  const known = new Set([
    ...players.flatMap((player) => player.cards),
    ...board,
    ...deadCards,
  ]);
  const legalNextCards = nextCardAvailable
    ? HOLDEM_DECK.filter((card) => !known.has(card))
    : [];
  const entriesByPlayer = players.map(() => []);

  for (const card of legalNextCards) {
    const nextRanks = players.map((player) => evaluateAvailableCards([...player.cards, ...board, card]));
    players.forEach((player, playerIndex) => {
      const comparisons = nextRanks.map((rank, opponentIndex) => (
        opponentIndex === playerIndex ? null : compareHandRanks(nextRanks[playerIndex], rank)
      )).filter((comparison) => comparison !== null);
      const strictlyAhead = comparisons.every((comparison) => comparison > 0);
      const tiedForBest = comparisons.every((comparison) => comparison >= 0)
        && comparisons.some((comparison) => comparison === 0);
      const canonicalImprovement = nextRanks[playerIndex].categoryRank > currentRanks[playerIndex].categoryRank;
      const classification = strictlyAhead && currentStandings[playerIndex] !== 'leading'
        ? 'winning_out'
        : tiedForBest
          ? 'tie_out'
          : canonicalImprovement && comparisons.some((comparison) => comparison < 0)
            ? 'structural_improvement_still_behind'
            : 'non_catch_up';
      entriesByPlayer[playerIndex].push({
        card,
        classification,
        resultCategory: nextRanks[playerIndex].category,
        resultTiebreakers: [...nextRanks[playerIndex].tiebreakers],
      });
    });
  }

  return deepFreeze({
    schemaVersion: EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
    available: true,
    reason: null,
    comparisonUniverse: 'all_entered_exact_hands',
    boardCardCount: board.length,
    street: board.length === 3 ? 'flop' : board.length === 4 ? 'turn' : 'river',
    nextCardAvailable,
    nextCardMeaning: board.length === 3
      ? 'ahead_after_next_card_not_guaranteed_final_pot'
      : board.length === 4
        ? 'final_one_card_runout'
        : 'no_cards_to_come',
    legalNextCardCount: legalNextCards.length,
    players: players.map((player, playerIndex) => {
      const entries = entriesByPlayer[playerIndex];
      return {
        id: player.id,
        currentStanding: currentStandings[playerIndex],
        currentCategory: currentRanks[playerIndex].category,
        winningOuts: outcomeFamily(entries.filter((entry) => entry.classification === 'winning_out')),
        tieOuts: outcomeFamily(entries.filter((entry) => entry.classification === 'tie_out')),
        structuralImprovementsStillBehind: outcomeFamily(entries.filter((entry) => (
          entry.classification === 'structural_improvement_still_behind'
        ))),
        nonCatchUpCards: outcomeFamily(entries.filter((entry) => entry.classification === 'non_catch_up')),
      };
    }),
  });
}

function analysisSource() {
  return {
    kind: 'scenario',
    label: 'Equity calculated input',
    sourceId: 'equity-workspace',
    sourceSchemaVersion: 'equity-request/v1',
  };
}

function rangeFactsFor(heroCards, board, unavailableCards, createRequest, createFacts) {
  const source = analysisSource();
  return createFacts(createRequest({
    heroCards,
    board,
    deadCards: unavailableCards,
    ranges: {},
    provenance: { exactHand: source, board: source, deadCards: source },
  }));
}

export function createEquityHandAnalysisProjection(input = {}, dependencies = {}) {
  const createRequest = dependencies.createRangeAnalysisRequest || createRangeAnalysisRequest;
  const createFacts = dependencies.createRangeAnalysisFacts || createRangeAnalysisFacts;
  const players = normalizedPlayers(input.players);
  const board = [...(input.board || [])];
  const deadCards = [...(input.deadCards || [])];
  const knownHoleCards = players.flatMap((player) => player.cards || []);
  const globalFacts = rangeFactsFor(
    [], board, [...deadCards, ...knownHoleCards], createRequest, createFacts,
  );
  const playerFacts = players.map((player) => {
    const unavailableCards = [
      ...deadCards,
      ...players.filter((candidate) => candidate.id !== player.id)
        .flatMap((candidate) => candidate.cards || []),
    ];
    const facts = player.cards
      ? rangeFactsFor(player.cards, board, unavailableCards, createRequest, createFacts)
      : null;
    return {
      id: player.id,
      cards: player.cards ? [...player.cards] : null,
      facts,
      bestFivePresentationCards: orderBestFiveForPresentation(facts?.exactHand?.canonicalRank),
    };
  });
  return deepFreeze({
    schemaVersion: EQUITY_HAND_ANALYSIS_SCHEMA_VERSION,
    board,
    deadCards,
    globalFacts,
    players: playerFacts,
    exactOutcomes: createExactEnteredHandOutcomeFacts({ players, board, deadCards }),
  });
}
