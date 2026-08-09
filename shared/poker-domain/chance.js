import { assertCardArray, assertUniqueKnownCards } from './cards.js';
import { deepFreeze } from './freeze.js';
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

function applyHoleDeal(state, chanceEvent) {
  validateInitializedPokerState(state);
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
    ...state.players
      .filter((player) => player.holeCards !== null)
      .map((player) => ({ label: `holeCards.${player.playerId}`, cards: player.holeCards })),
    { label: chanceEvent.type, cards },
  ];
  assertUniqueKnownCards(cardGroups);

  const nextState = structuredClone(state);
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
