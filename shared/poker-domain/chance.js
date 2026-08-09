import { assertCardArray, assertUniqueKnownCards } from './cards.js';
import { deepFreeze } from './freeze.js';
import { firstPreflopActorId } from './selectors.js';
import { CHANCE_TYPES, PHASES } from './schema.js';
import { completePreflop } from './settlement.js';
import { validateInitializedPokerState, validatePokerState } from './validate.js';

export function applyChance(state, chanceEvent) {
  validateInitializedPokerState(state);
  if (!chanceEvent || typeof chanceEvent !== 'object' || Array.isArray(chanceEvent)) {
    throw new TypeError('chanceEvent must be an object');
  }
  if (chanceEvent.type !== CHANCE_TYPES.DEAL_HOLE
    || state.pendingChance.type !== CHANCE_TYPES.DEAL_HOLE) {
    throw new RangeError('Only the pending deal_hole chance event is supported');
  }
  if (!chanceEvent.cardsByPlayer || typeof chanceEvent.cardsByPlayer !== 'object'
    || Array.isArray(chanceEvent.cardsByPlayer)) {
    throw new TypeError('deal_hole requires cardsByPlayer');
  }

  const dealtPlayers = state.players.filter((player) => player.dealtIn);
  const expectedIds = new Set(dealtPlayers.map((player) => player.playerId));
  const suppliedIds = Object.keys(chanceEvent.cardsByPlayer);
  if (suppliedIds.length !== expectedIds.size || suppliedIds.some((playerId) => !expectedIds.has(playerId))) {
    throw new RangeError('cardsByPlayer must contain every dealt-in player exactly once for heads-up or multiway play');
  }

  const cardGroups = [
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
  ];
  for (const player of dealtPlayers) {
    const cards = assertCardArray(chanceEvent.cardsByPlayer[player.playerId], `cardsByPlayer.${player.playerId}`);
    if (cards.length !== 2) throw new RangeError('Each dealt-in player must receive exactly two cards');
    cardGroups.push({ label: `holeCards.${player.playerId}`, cards });
  }
  assertUniqueKnownCards(cardGroups);

  const nextState = structuredClone(state);
  for (const player of nextState.players) {
    player.holeCards = [...chanceEvent.cardsByPlayer[player.playerId]];
  }
  nextState.phase = PHASES.BETTING;
  nextState.actingPlayerId = firstPreflopActorId(nextState);
  nextState.pendingChance = null;
  if (nextState.actingPlayerId === null) completePreflop(nextState);

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
