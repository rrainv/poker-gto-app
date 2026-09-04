import { HOLDEM_DECK, isCard } from '../../../shared/poker-domain/index.js';
import { createSeededRandom } from './deterministic-random.mjs';
import {
  createRandomizationRecipe,
  deepFreezeRandomization,
} from './randomization-recipe.mjs';

export const EQUITY_RANDOMIZATION_REQUEST_VERSION = 'equity-randomization-request/v1';
export const EQUITY_RANDOMIZATION_RESULT_VERSION = 'equity-randomization-result/v1';
export const EQUITY_RANDOMIZER_VERSION = 'equity-input-randomizer/v1';
export const EQUITY_RANDOMIZATION_TARGETS = Object.freeze({
  MATCHUP: 'matchup', PLAYER: 'player', BOARD: 'board',
  FLOP: 'flop', TURN: 'turn', RIVER: 'river',
});

const TARGETS = new Set(Object.values(EQUITY_RANDOMIZATION_TARGETS));
const BOARD_COUNTS = Object.freeze({ flop: 3, turn: 4, river: 5 });

function unavailable(code) {
  return deepFreezeRandomization({
    schemaVersion: EQUITY_RANDOMIZATION_RESULT_VERSION,
    status: 'unavailable', code, input: null, recipe: null,
  });
}

function copyInput(input) {
  return {
    players: input.players.map((player) => ({
      id: player.id, name: player.name ?? '', handMode: player.handMode, cards: [...player.cards],
    })),
    board: [...input.board],
    deadCards: [...input.deadCards],
  };
}

function normalizeInput(input) {
  if (!input || !Array.isArray(input.players) || input.players.length < 2 || input.players.length > 10
    || !Array.isArray(input.board) || !Array.isArray(input.deadCards)) return null;
  const ids = new Set();
  const players = [];
  for (const player of input.players) {
    if (!player || typeof player.id !== 'string' || !player.id || ids.has(player.id)
      || !['known', 'unknown'].includes(player.handMode) || !Array.isArray(player.cards)) return null;
    ids.add(player.id);
    players.push({
      id: player.id,
      name: typeof player.name === 'string' ? player.name : '',
      handMode: player.handMode,
      cards: player.cards.filter(Boolean),
    });
  }
  if (input.board.length > 5) return null;
  return { players, board: input.board.filter(Boolean), deadCards: input.deadCards.filter(Boolean) };
}

function validUniqueCards(cards) {
  return cards.every(isCard) && new Set(cards).size === cards.length;
}

function sampleDifferent(random, deck, count, prior) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const cards = random.shuffle(deck).slice(0, count);
    if (cards.join('|') !== prior.join('|')) return cards;
  }
  return null;
}

export function randomizeEquityInput(request = {}) {
  if (request.schemaVersion !== EQUITY_RANDOMIZATION_REQUEST_VERSION) {
    throw new TypeError('Unsupported Equity randomization request version');
  }
  if (!Number.isInteger(request.seed) || request.seed < 0 || request.seed > 0xffffffff) {
    throw new RangeError('Equity randomization seed must be uint32');
  }
  if (!TARGETS.has(request.target)) throw new RangeError('Unsupported Equity randomization target');
  const source = normalizeInput(request.input);
  if (!source) return unavailable('invalid_equity_input');
  const target = request.target;
  const knownPlayers = source.players.filter((player) => player.handMode === 'known');
  const targetPlayer = target === 'player'
    ? source.players.find((player) => player.id === request.playerId) : null;
  if (target === 'matchup' && knownPlayers.length === 0) return unavailable('no_known_hands');
  if (target === 'player' && (!targetPlayer || targetPlayer.handMode !== 'known')) {
    return unavailable('player_not_known');
  }
  const boardCount = target === 'board' ? source.board.length : BOARD_COUNTS[target] ?? null;
  if (target === 'board' && boardCount === 0) return unavailable('board_empty');

  const replacingPlayerIds = new Set(target === 'matchup'
    ? knownPlayers.map((player) => player.id)
    : target === 'player' ? [targetPlayer.id] : []);
  const replacingBoard = target === 'board' || target in BOARD_COUNTS;
  const preservedKnown = [
    ...source.deadCards,
    ...(replacingBoard ? [] : source.board),
    ...source.players.flatMap((player) => (
      player.handMode === 'known' && !replacingPlayerIds.has(player.id) ? player.cards : []
    )),
  ];
  if (!validUniqueCards(preservedKnown)) return unavailable('preserved_cards_invalid');
  if (!replacingBoard && !validUniqueCards([...source.board, ...source.deadCards])) {
    return unavailable('preserved_cards_invalid');
  }
  for (const player of source.players) {
    if (player.handMode === 'unknown' && player.cards.length !== 0) return unavailable('unknown_hand_has_cards');
    if (player.handMode === 'known' && !replacingPlayerIds.has(player.id)
      && (player.cards.length > 2 || !validUniqueCards(player.cards))) {
      return unavailable('preserved_hand_invalid');
    }
  }

  const preservedCardSet = new Set(preservedKnown);
  const deck = HOLDEM_DECK.filter((card) => !preservedCardSet.has(card));
  const generatedCount = replacingPlayerIds.size * 2 + (replacingBoard ? boardCount : 0);
  if (deck.length < generatedCount) return unavailable('insufficient_available_cards');
  const prior = [
    ...source.players.filter((player) => replacingPlayerIds.has(player.id)).flatMap((player) => player.cards),
    ...(replacingBoard ? source.board : []),
  ];
  const generated = sampleDifferent(createSeededRandom(request.seed), deck, generatedCount, prior);
  if (!generated) return unavailable('no_alternative_realization');

  const result = copyInput(source);
  let offset = 0;
  for (const player of result.players) {
    if (!replacingPlayerIds.has(player.id)) continue;
    player.cards = generated.slice(offset, offset + 2);
    offset += 2;
  }
  if (replacingBoard) result.board = generated.slice(offset, offset + boardCount);
  const allKnown = [
    ...result.players.filter((player) => player.handMode === 'known').flatMap((player) => player.cards),
    ...result.board,
    ...result.deadCards,
  ];
  if (!validUniqueCards(allKnown)) return unavailable('candidate_cards_invalid');

  const recipe = createRandomizationRecipe({
    generatorVersion: EQUITY_RANDOMIZER_VERSION,
    requestVersion: EQUITY_RANDOMIZATION_REQUEST_VERSION,
    sourceSurface: 'equity_input',
    target,
    seed: request.seed,
    inputContext: source,
    resultContext: result,
    details: {
      operation: target,
      playerId: target === 'player' ? targetPlayer.id : null,
      players: result.players.map(({ id, handMode }) => ({ id, handMode })),
      preservedBoard: replacingBoard ? null : [...source.board],
      preservedDeadCards: [...source.deadCards],
      generatedCards: generated,
      boardCardCount: replacingBoard ? boardCount : source.board.length,
    },
  });
  return deepFreezeRandomization({
    schemaVersion: EQUITY_RANDOMIZATION_RESULT_VERSION,
    status: 'available', code: null, input: result, recipe,
  });
}
