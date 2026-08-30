import { assertCardArray, assertUniqueKnownCards } from './cards.js';
import { deepFreeze } from './freeze.js';
import { HOLDEM_DECK } from './holdem-combos.js';
import { clonePokerState } from './poker-state-rules.js';
import { createHiddenHoleCards } from './private-cards.js';
import { firstPreflopActorId } from './selectors.js';
import { CHANCE_TYPES, PHASES } from './schema.js';
import { completePreflop } from './settlement.js';
import { boardChanceTransition, initializeStreetAfterBoardDeal } from './street-transitions.js';
import { validateInitializedPokerState, validatePokerState } from './validate.js';

function requirePendingChance(state, chanceEvent) {
  if (!chanceEvent || typeof chanceEvent !== 'object' || Array.isArray(chanceEvent)) {
    throw new TypeError('chanceEvent must be an object');
  }
  if (state.phase !== PHASES.CHANCE || state.pendingChance === null) {
    throw new RangeError('No chance event is pending');
  }
  if (chanceEvent.type !== state.pendingChance.type) {
    throw new RangeError(`Expected pending chance event ${state.pendingChance.type}`);
  }
}

export function getAvailableChanceCards(state, pendingCards = []) {
  validatePokerState(state);
  if (state.phase !== PHASES.CHANCE || state.pendingChance === null) {
    throw new RangeError('Available chance cards require a pending chance event');
  }

  const pending = assertCardArray(pendingCards, 'pendingCards');
  if (pending.length > state.pendingChance.cardCount) {
    throw new RangeError('Pending chance cards exceed the pending chance card count');
  }
  const consumed = assertUniqueKnownCards([
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
    ...state.players
      .filter((player) => Array.isArray(player.holeCards))
      .map((player) => ({ label: `holeCards.${player.playerId}`, cards: player.holeCards })),
    { label: 'pendingCards', cards: pending },
  ]);

  return deepFreeze(HOLDEM_DECK.filter((card) => !consumed.has(card)));
}

function applyHoleDeal(state, chanceEvent) {
  validateInitializedPokerState(state);
  if (!chanceEvent.cardsByPlayer || typeof chanceEvent.cardsByPlayer !== 'object'
    || Array.isArray(chanceEvent.cardsByPlayer)) {
    throw new TypeError('deal_hole requires cardsByPlayer');
  }

  const dealtPlayers = state.players.filter((player) => player.dealtIn);
  const expectedIds = new Set(dealtPlayers.map((player) => player.playerId));
  const suppliedIds = Object.keys(chanceEvent.cardsByPlayer);
  const hiddenPlayerIds = chanceEvent.hiddenPlayerIds ?? [];
  if (!Array.isArray(hiddenPlayerIds)
    || hiddenPlayerIds.some((playerId) => typeof playerId !== 'string')) {
    throw new TypeError('hiddenPlayerIds must be an array of player IDs');
  }
  if (new Set(hiddenPlayerIds).size !== hiddenPlayerIds.length) {
    throw new RangeError('hiddenPlayerIds cannot contain duplicates');
  }
  if (suppliedIds.some((playerId) => !expectedIds.has(playerId))
    || hiddenPlayerIds.some((playerId) => !expectedIds.has(playerId))) {
    throw new RangeError('Hole-card deal refers to an unknown or non-dealt player');
  }
  if (suppliedIds.some((playerId) => hiddenPlayerIds.includes(playerId))) {
    throw new RangeError('A player cannot have both known and hidden hole cards');
  }
  const representedIds = new Set([...suppliedIds, ...hiddenPlayerIds]);
  if (representedIds.size !== expectedIds.size
    || [...expectedIds].some((playerId) => !representedIds.has(playerId))) {
    throw new RangeError('deal_hole must represent every dealt-in player as known or hidden for heads-up or multiway play');
  }

  const cardGroups = [
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
  ];
  for (const player of dealtPlayers.filter((candidate) => suppliedIds.includes(candidate.playerId))) {
    const cards = assertCardArray(chanceEvent.cardsByPlayer[player.playerId], `cardsByPlayer.${player.playerId}`);
    if (cards.length !== 2) throw new RangeError('Each dealt-in player must receive exactly two cards');
    cardGroups.push({ label: `holeCards.${player.playerId}`, cards });
  }
  assertUniqueKnownCards(cardGroups);

  const nextState = clonePokerState(state);
  for (const player of nextState.players) {
    player.holeCards = Object.hasOwn(chanceEvent.cardsByPlayer, player.playerId)
      ? [...chanceEvent.cardsByPlayer[player.playerId]]
      : createHiddenHoleCards();
  }
  nextState.phase = PHASES.BETTING;
  nextState.actingPlayerId = firstPreflopActorId(nextState);
  nextState.pendingChance = null;
  if (nextState.actingPlayerId === null) completePreflop(nextState);
  return nextState;
}

function applyBoardDeal(state, chanceEvent, transition) {
  if (!Object.hasOwn(chanceEvent, 'cards')) throw new TypeError(`${chanceEvent.type} requires cards`);
  const cards = assertCardArray(chanceEvent.cards, 'chanceEvent.cards');
  if (cards.length !== transition.cardCount) {
    throw new RangeError(`${chanceEvent.type} requires exactly ${transition.cardCount} card(s)`);
  }
  const cardGroups = [
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
    // A hidden hand consumes two physical cards, but has no observable identity.
    // Only known cards can participate in duplicate checks until an explicit reveal.
    ...state.players
      .filter((player) => Array.isArray(player.holeCards))
      .map((player) => ({ label: `holeCards.${player.playerId}`, cards: player.holeCards })),
    { label: chanceEvent.type, cards },
  ];
  assertUniqueKnownCards(cardGroups);

  const nextState = clonePokerState(state);
  initializeStreetAfterBoardDeal(nextState, transition, cards);
  return nextState;
}

export function applyChance(state, chanceEvent) {
  validatePokerState(state);
  requirePendingChance(state, chanceEvent);

  const nextState = chanceEvent.type === CHANCE_TYPES.DEAL_HOLE
    ? applyHoleDeal(state, chanceEvent)
    : applyBoardDeal(state, chanceEvent, boardChanceTransition(chanceEvent.type));

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
