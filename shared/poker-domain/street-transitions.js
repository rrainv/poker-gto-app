import { firstPostflopActorId, isPlayerAllIn, isPlayerLive } from './selectors.js';
import { CHANCE_TYPES, PHASES, STREETS } from './schema.js';

export const BOARD_CHANCE_TRANSITIONS = Object.freeze({
  [CHANCE_TYPES.DEAL_FLOP]: Object.freeze({
    fromStreet: STREETS.PREFLOP,
    toStreet: STREETS.FLOP,
    cardCount: 3,
    nextChanceType: CHANCE_TYPES.DEAL_TURN,
  }),
  [CHANCE_TYPES.DEAL_TURN]: Object.freeze({
    fromStreet: STREETS.FLOP,
    toStreet: STREETS.TURN,
    cardCount: 1,
    nextChanceType: CHANCE_TYPES.DEAL_RIVER,
  }),
  [CHANCE_TYPES.DEAL_RIVER]: Object.freeze({
    fromStreet: STREETS.TURN,
    toStreet: STREETS.RIVER,
    cardCount: 1,
    nextChanceType: null,
  }),
});

export function boardChanceTransition(chanceType) {
  return BOARD_CHANCE_TRANSITIONS[chanceType] || null;
}

function resetStreetBettingState(state) {
  for (const player of state.players) {
    player.streetContributionMilliBb = 0;
    player.actedThisStreet = false;
    player.raiseReopenAtMilliBb = null;
  }
  state.currentBetMilliBb = 0;
  state.lastFullRaiseIncrementMilliBb = state.game.bigBlindMilliBb;
  state.lastAggressorPlayerId = null;
  state.actingPlayerId = null;
  state.pendingChance = null;
}

function playersAbleToBet(state) {
  return state.players.filter((player) => isPlayerLive(player) && !isPlayerAllIn(player));
}

export function requestBoardChance(state, chanceType) {
  const transition = boardChanceTransition(chanceType);
  if (!transition) throw new RangeError(`Unsupported board chance type: ${chanceType}`);
  state.phase = PHASES.CHANCE;
  state.actingPlayerId = null;
  state.pendingChance = {
    type: chanceType,
    cardCount: transition.cardCount,
  };
}

export function markShowdownReady(state) {
  state.phase = PHASES.SHOWDOWN;
  state.actingPlayerId = null;
  state.pendingChance = null;
  state.showdown = {
    status: 'ready',
    eligiblePlayerIds: state.players.filter(isPlayerLive).map((player) => player.playerId),
    pots: [],
    handRanksByPlayer: null,
  };
}

export function initializeStreetAfterBoardDeal(state, transition, cards) {
  if (!transition || state.street !== transition.fromStreet) {
    throw new RangeError('Board chance event does not follow the current street');
  }
  state.board.push(...cards);
  state.street = transition.toStreet;
  resetStreetBettingState(state);

  if (playersAbleToBet(state).length >= 2) {
    state.phase = PHASES.BETTING;
    state.actingPlayerId = firstPostflopActorId(state);
  } else if (transition.nextChanceType !== null) {
    requestBoardChance(state, transition.nextChanceType);
  } else {
    markShowdownReady(state);
  }
}
