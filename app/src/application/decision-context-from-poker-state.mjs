import {
  ACTION_TYPES,
  GAME_MODES,
  PHASES,
  STREETS,
  isPlayerLive,
  playerById,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';

export const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';

const STACK_MODES = Object.freeze(new Set(['hero', 'effective', 'custom']));
const PREFLOP_AGGRESSION_ACTIONS = Object.freeze(['raise', '3bet', '4bet']);

function normalizedDecisionNumber(value, fallback, min, max) {
  const numeric = Number(value);
  const finite = Number.isFinite(numeric) ? numeric : fallback;
  return Math.min(max, Math.max(min, finite));
}

function currentStreetRecords(state) {
  return state.actionHistory.filter((record) => record.street === state.street);
}

function classifyLastAction(state) {
  const records = currentStreetRecords(state);
  const aggressiveRecords = records.filter((record) => (
    record.currentBetAfterMilliBb > record.currentBetBeforeMilliBb
  ));

  if (aggressiveRecords.length > 0) {
    if (state.street === STREETS.PREFLOP) {
      return PREFLOP_AGGRESSION_ACTIONS[Math.min(aggressiveRecords.length - 1, 2)];
    }
    const latest = aggressiveRecords[aggressiveRecords.length - 1];
    return latest.currentBetBeforeMilliBb === 0 ? 'bet' : 'raise';
  }

  // DecisionContext v1 has no call/limp prior-action value.
  // Passive action without aggression is projected to the existing check
  // category; folds alone preserve the established unopened preflop meaning.
  const hasPassiveAction = records.some((record) => (
    record.submittedAction.type !== ACTION_TYPES.FOLD
  ));
  if (hasPassiveAction) return 'check';
  return state.street === STREETS.PREFLOP ? 'unopened' : 'check';
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
  const hasCompatibleAggression = PREFLOP_AGGRESSION_ACTIONS.includes(lastAction)
    || lastAction === 'bet';
  const facingSizeBb = hasCompatibleAggression
    ? normalizedDecisionNumber(state.currentBetMilliBb / 1000, 0, 0, 100)
    : 0;
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
    // DecisionContext v1's stack control is configured starting depth. The
    // selected stackMode is metadata only in the current Playbook runtime.
    stackBb: normalizedDecisionNumber(hero.startingStackMilliBb / 1000, 100, 10, 500),
    stackMode,
    potBb: normalizedDecisionNumber(state.potMilliBb / 1000, 1.5, 0.5, 200),
    lastAction,
    facingSizeBb,
    rakeMode,
    forcedContributionPerPlayerBb,
    totalForcedContributionBb: (
      state.players.length * state.game.forcedContributionPerPlayerMilliBb
    ) / 1000,
  };
}
