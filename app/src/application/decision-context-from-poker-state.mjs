import {
  ACTION_TYPES,
  GAME_MODES,
  PHASES,
  STREETS,
  amountToCallMilliBb,
  isPlayerLive,
  playerById,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';

export const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';

const STACK_MODES = Object.freeze(new Set(['hero', 'effective', 'custom']));

function currentStreetRecords(state) {
  return state.actionHistory.filter((record) => record.street === state.street);
}

function classifyLastAction(state) {
  const records = currentStreetRecords(state);
  const aggressiveRecords = records.filter((record) => (
    record.currentBetAfterMilliBb > record.currentBetBeforeMilliBb
  ));

  if (aggressiveRecords.length > 0) {
    const latest = aggressiveRecords[aggressiveRecords.length - 1].submittedAction.type;
    if (latest === ACTION_TYPES.ALL_IN) return 'all-in';
    if (state.street === STREETS.PREFLOP) {
      if (aggressiveRecords.length === 1) return 'raise';
      if (aggressiveRecords.length === 2) return '3bet';
      return '4bet';
    }
    return latest === ACTION_TYPES.BET ? 'bet' : 'raise';
  }

  const latestNonFold = [...records].reverse().find((record) => (
    record.submittedAction.type !== ACTION_TYPES.FOLD
  ));
  if (latestNonFold) {
    if (latestNonFold.submittedAction.type === ACTION_TYPES.ALL_IN) return 'all-in';
    return latestNonFold.submittedAction.type;
  }
  return state.street === STREETS.PREFLOP ? 'unopened' : 'check';
}

function projectStackMilliBb(state, hero, stackMode, effectiveOpponentPlayerId) {
  if (stackMode !== 'effective') return hero.currentStackMilliBb;

  const liveOpponents = state.players.filter((player) => (
    player.playerId !== hero.playerId && isPlayerLive(player)
  ));
  let opponent = null;
  if (effectiveOpponentPlayerId !== undefined && effectiveOpponentPlayerId !== null) {
    opponent = liveOpponents.find((player) => (
      player.playerId === effectiveOpponentPlayerId
    )) || null;
    if (!opponent) {
      throw new RangeError('effectiveOpponentPlayerId must identify a live opponent');
    }
  } else if (liveOpponents.length === 1) {
    [opponent] = liveOpponents;
  } else {
    throw new RangeError(
      'Multiway effective stack requires an explicit effectiveOpponentPlayerId',
    );
  }
  return Math.min(hero.currentStackMilliBb, opponent.currentStackMilliBb);
}

function requireActorDecision(state, heroPlayerId) {
  validatePokerState(state);
  if (state.phase !== PHASES.BETTING || state.pendingChance !== null
    || state.terminal.isTerminal || state.showdown.status !== 'not_reached') {
    throw new RangeError('DecisionContext projection requires an active betting decision');
  }
  const hero = playerById(state, heroPlayerId);
  if (!hero) throw new RangeError(`Unknown heroPlayerId: ${heroPlayerId}`);
  if (!isPlayerLive(hero)) throw new RangeError('DecisionContext hero must be live and not folded');
  if (hero.playerId !== state.actingPlayerId) {
    throw new RangeError('DecisionContext hero must be the current acting player');
  }
  if (!Array.isArray(hero.holeCards) || hero.holeCards.length !== 2) {
    throw new RangeError('DecisionContext hero requires two known hole cards');
  }
  return hero;
}

/**
 * Project an actor-only application strategy snapshot from canonical PokerState.
 * tableSize is the seated-player count; poker-state/v1 currently deals in every
 * seated player. All integer milliBb -> bb conversion remains at this boundary.
 */
export function deriveDecisionContextFromPokerState(state, heroPlayerId, options = {}) {
  const hero = requireActorDecision(state, heroPlayerId);
  const stackMode = options.stackMode ?? 'hero';
  if (!STACK_MODES.has(stackMode)) throw new RangeError(`Unsupported stackMode: ${stackMode}`);

  const lastAction = classifyLastAction(state);
  const facingCommitMilliBb = state.street === STREETS.PREFLOP && lastAction === 'unopened'
    ? 0
    : Math.min(amountToCallMilliBb(state, hero.playerId), hero.currentStackMilliBb);
  const forcedContributionPerPlayerBb = state.game.forcedContributionPerPlayerMilliBb / 1000;
  const rakeMode = state.game.mode === GAME_MODES.CLUBGG ? 'fixed' : 'off';

  return {
    schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
    tableSize: state.players.length,
    heroPosition: hero.position,
    street: state.street,
    heroCards: [...hero.holeCards],
    board: [...state.board],
    deadCards: [...state.deadCards],
    stackBb: projectStackMilliBb(
      state,
      hero,
      stackMode,
      options.effectiveOpponentPlayerId,
    ) / 1000,
    stackMode,
    potBb: state.potMilliBb / 1000,
    lastAction,
    facingSizeBb: facingCommitMilliBb / 1000,
    rakeMode,
    forcedContributionPerPlayerBb,
    totalForcedContributionBb: (
      state.players.length * state.game.forcedContributionPerPlayerMilliBb
    ) / 1000,
    legacyRakePercent: 0,
  };
}
