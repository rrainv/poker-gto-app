import { assertCardArray, assertUniqueKnownCards, getLegalActionSpec, playerById,
  validatePokerState } from '../../../shared/poker-domain/index.js';

export const OPPONENT_ACTOR_INFORMATION_VERSION = 'opponent-actor-information/v1';

export function freezeOpponentData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeOpponentData);
  return Object.freeze(value);
}

// Allowlist, never a redacted PokerState. Known-to-the-application private
// cards are not publicly revealed cards. Current canonical betting has no
// public private-card reveal contract; showdown reveals occur after betting.
export function createOpponentActorInformation({ pokerState, actorSeat, ownCards = null } = {}) {
  validatePokerState(pokerState);
  const actor = playerById(pokerState, pokerState.actingPlayerId);
  if (!actor || actor.seat !== actorSeat) throw new RangeError('Expected the current actor seat');
  const cards = ownCards ?? (Array.isArray(actor.holeCards) ? actor.holeCards : null);
  if (cards !== null) {
    assertCardArray(cards, 'actor private cards');
    if (cards.length !== 2) throw new RangeError('Actor requires exactly two private cards');
    assertUniqueKnownCards([{ label: 'actor', cards }, { label: 'board', cards: pokerState.board }]);
    if (Array.isArray(actor.holeCards) && JSON.stringify(cards) !== JSON.stringify(actor.holeCards)) {
      throw new RangeError('Actor private cards disagree with canonical known cards');
    }
  }
  const pick = (source, keys) => Object.fromEntries(keys.map(key => [key, source[key]]));
  const information = {
    schemaVersion: OPPONENT_ACTOR_INFORMATION_VERSION,
    actorSeat, actingPlayerId: actor.playerId, ownCards: cards,
    street: pokerState.street, board: pokerState.board,
    buttonSeat: pokerState.buttonSeat, potMilliBb: pokerState.potMilliBb,
    currentBetMilliBb: pokerState.currentBetMilliBb,
    lastFullRaiseIncrementMilliBb: pokerState.lastFullRaiseIncrementMilliBb,
    game: pick(pokerState.game, ['smallBlindMilliBb', 'bigBlindMilliBb', 'chipUnitMilliBb']),
    players: pokerState.players.map(player => pick(player, ['playerId', 'seat', 'position',
      'dealtIn', 'folded', 'startingStackMilliBb', 'currentStackMilliBb',
      'streetContributionMilliBb', 'totalPotContributionMilliBb'])),
    actionHistory: pokerState.actionHistory.map(record => ({
      street: record.street, playerId: record.playerId,
      type: record.submittedAction.type, amountToMilliBb: record.submittedAction.amountToMilliBb,
      committedMilliBb: record.committedMilliBb,
    })),
    legalActionSpec: getLegalActionSpec(pokerState),
  };
  return freezeOpponentData(structuredClone(information));
}
