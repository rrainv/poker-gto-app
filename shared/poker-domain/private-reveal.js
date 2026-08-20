import { assertCardArray, assertUniqueKnownCards } from './cards.js';
import { deepFreeze } from './freeze.js';
import { clonePokerState } from './poker-state-rules.js';
import { isHiddenHoleCards } from './private-cards.js';
import { PHASES } from './schema.js';
import { isPlayerLive } from './selectors.js';
import { validatePokerState } from './validate.js';

function knownCardGroups(state) {
  return [
    { label: 'board', cards: state.board },
    { label: 'deadCards', cards: state.deadCards },
    ...state.players
      .filter((player) => Array.isArray(player.holeCards))
      .map((player) => ({ label: `holeCards.${player.playerId}`, cards: player.holeCards })),
  ];
}

/** Deterministically materialize one previously dealt hidden private hand. */
export function applyPrivateReveal(state, revealEvent) {
  validatePokerState(state);
  if (!revealEvent || typeof revealEvent !== 'object' || Array.isArray(revealEvent)) {
    throw new TypeError('revealEvent must be an object');
  }
  if (typeof revealEvent.playerId !== 'string' || !revealEvent.playerId) {
    throw new TypeError('revealEvent.playerId is required');
  }
  const player = state.players.find((candidate) => candidate.playerId === revealEvent.playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${revealEvent.playerId}`);
  if (!isHiddenHoleCards(player.holeCards)) {
    throw new RangeError('Only dealt hidden hole cards may be revealed');
  }
  const cards = assertCardArray(revealEvent.cards, 'revealEvent.cards');
  if (cards.length !== 2) throw new RangeError('A private reveal requires exactly two cards');
  assertUniqueKnownCards([
    ...knownCardGroups(state),
    { label: `reveal.${player.playerId}`, cards },
  ]);

  const nextState = clonePokerState(state);
  nextState.players.find((candidate) => candidate.playerId === player.playerId).holeCards = [...cards];

  if (nextState.phase === PHASES.SHOWDOWN
    && nextState.showdown.status === 'awaiting_private_reveal') {
    const requiredRevealPlayerIds = nextState.players
      .filter((candidate) => isPlayerLive(candidate) && isHiddenHoleCards(candidate.holeCards))
      .map((candidate) => candidate.playerId);
    if (requiredRevealPlayerIds.length === 0) {
      nextState.showdown.status = 'ready';
      delete nextState.showdown.requiredRevealPlayerIds;
    } else {
      nextState.showdown.requiredRevealPlayerIds = requiredRevealPlayerIds;
    }
  }

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
