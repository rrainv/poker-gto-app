import { validateAction } from './action.js';
import { deepFreeze } from './freeze.js';
import { getLegalActionSpec } from './legal-actions.js';
import {
  amountToCallMilliBb,
  isPlayerAllIn,
  isPlayerLive,
  playerById,
} from './selectors.js';
import {
  ACTION_TYPES,
  CHANCE_TYPES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  POKER_ACTION_RECORD_SCHEMA_VERSION,
  STREETS,
} from './schema.js';
import { validatePokerState } from './validate.js';

function mutablePlayerById(state, playerId) {
  return state.players.find((player) => player.playerId === playerId);
}

function appendLedger(state, playerId, kind, movement, amountMilliBb) {
  if (amountMilliBb === 0) return;
  state.ledger.push({
    sequence: state.ledger.length,
    playerId,
    street: state.street,
    kind,
    movement,
    amountMilliBb,
  });
}

function commitToPot(state, player, amountMilliBb) {
  if (amountMilliBb < 0 || amountMilliBb > player.currentStackMilliBb) {
    throw new RangeError('Action commitment exceeds the available stack');
  }
  if (amountMilliBb === 0) return;
  player.currentStackMilliBb -= amountMilliBb;
  player.streetContributionMilliBb += amountMilliBb;
  player.totalPotContributionMilliBb += amountMilliBb;
  state.potMilliBb += amountMilliBb;
  appendLedger(
    state,
    player.playerId,
    LEDGER_KINDS.ACTION,
    LEDGER_MOVEMENTS.STACK_TO_POT,
    amountMilliBb,
  );
}

function creditFromPot(state, player, amountMilliBb, kind) {
  if (amountMilliBb === 0) return;
  if (amountMilliBb > state.potMilliBb) throw new RangeError('Pot credit exceeds the pot');
  state.potMilliBb -= amountMilliBb;
  player.currentStackMilliBb += amountMilliBb;
  appendLedger(state, player.playerId, kind, LEDGER_MOVEMENTS.POT_TO_STACK, amountMilliBb);
}

function refundUncalledExcess(state) {
  const [first, second] = state.players;
  const high = first.totalPotContributionMilliBb >= second.totalPotContributionMilliBb ? first : second;
  const low = high === first ? second : first;
  const refund = high.totalPotContributionMilliBb - low.totalPotContributionMilliBb;
  creditFromPot(state, high, refund, LEDGER_KINDS.UNCALLED_REFUND);
  return { playerId: high.playerId, amountMilliBb: refund };
}

function isBettingRoundComplete(state) {
  const livePlayers = state.players.filter(isPlayerLive);
  return livePlayers.length === 2 && livePlayers.every((player) => (
    isPlayerAllIn(player)
      || (player.actedThisStreet && player.streetContributionMilliBb === state.currentBetMilliBb)
  ));
}

function settleFold(state, foldedPlayerId) {
  const winner = state.players.find((player) => player.playerId !== foldedPlayerId && isPlayerLive(player));
  const foldedPlayer = mutablePlayerById(state, foldedPlayerId);
  const refund = Math.max(
    0,
    winner.totalPotContributionMilliBb - foldedPlayer.totalPotContributionMilliBb,
  );
  creditFromPot(state, winner, refund, LEDGER_KINDS.UNCALLED_REFUND);
  const payout = state.potMilliBb;
  creditFromPot(state, winner, payout, LEDGER_KINDS.POT_AWARD);

  state.phase = PHASES.TERMINAL;
  state.actingPlayerId = null;
  state.pendingChance = null;
  state.terminal = {
    isTerminal: true,
    reason: 'fold',
    winnerPlayerIds: [winner.playerId],
    payoutsMilliBbByPlayer: payout === 0 ? {} : { [winner.playerId]: payout },
    refundsMilliBbByPlayer: refund === 0 ? {} : { [winner.playerId]: refund },
  };
}

function completePreflop(state) {
  refundUncalledExcess(state);
  state.phase = PHASES.CHANCE;
  state.actingPlayerId = null;
  state.pendingChance = {
    type: CHANCE_TYPES.DEAL_FLOP,
    cardCount: 3,
  };
}

function validateConcreteAction(action, spec) {
  const option = spec[action.type === ACTION_TYPES.ALL_IN ? 'allIn' : action.type];
  if (!option || option.available !== true) throw new RangeError(`Illegal ${action.type} action`);
  if (action.type === ACTION_TYPES.BET || action.type === ACTION_TYPES.RAISE) {
    if (action.amountToMilliBb < option.minToMilliBb
      || action.amountToMilliBb > option.maxToMilliBb) {
      throw new RangeError(`${action.type} amount is outside legal raise-to bounds`);
    }
  }
}

export function applyAction(state, action) {
  validatePokerState(state);
  validateAction(action, state.game.chipUnitMilliBb);
  const spec = getLegalActionSpec(state);
  if (action.playerId !== state.actingPlayerId) throw new RangeError('Action player is not the current actor');
  validateConcreteAction(action, spec);

  const nextState = structuredClone(state);
  const actor = mutablePlayerById(nextState, action.playerId);
  const opponent = nextState.players.find((player) => player.playerId !== actor.playerId);
  const currentBetBeforeMilliBb = nextState.currentBetMilliBb;
  const toCallBeforeMilliBb = amountToCallMilliBb(nextState, actor.playerId);
  let committedMilliBb = 0;
  let wasFullRaise = false;
  let reopenedBetting = false;

  if (action.type === ACTION_TYPES.FOLD) {
    actor.folded = true;
    actor.actedThisStreet = true;
  } else if (action.type === ACTION_TYPES.CHECK) {
    actor.actedThisStreet = true;
    actor.raiseReopenAtMilliBb = nextState.currentBetMilliBb + nextState.game.chipUnitMilliBb;
  } else if (action.type === ACTION_TYPES.CALL) {
    committedMilliBb = Math.min(toCallBeforeMilliBb, actor.currentStackMilliBb);
    commitToPot(nextState, actor, committedMilliBb);
    actor.actedThisStreet = true;
    actor.raiseReopenAtMilliBb = nextState.currentBetMilliBb + nextState.lastFullRaiseIncrementMilliBb;
  } else {
    const amountToMilliBb = action.type === ACTION_TYPES.ALL_IN
      ? spec.allIn.amountToMilliBb
      : action.amountToMilliBb;
    committedMilliBb = amountToMilliBb - actor.streetContributionMilliBb;
    commitToPot(nextState, actor, committedMilliBb);

    const raiseIncrementMilliBb = amountToMilliBb - currentBetBeforeMilliBb;
    wasFullRaise = currentBetBeforeMilliBb === 0
      ? amountToMilliBb >= nextState.game.bigBlindMilliBb
      : raiseIncrementMilliBb >= nextState.lastFullRaiseIncrementMilliBb;
    if (wasFullRaise) {
      nextState.lastFullRaiseIncrementMilliBb = currentBetBeforeMilliBb === 0
        ? amountToMilliBb
        : raiseIncrementMilliBb;
      reopenedBetting = true;
    }
    nextState.currentBetMilliBb = amountToMilliBb;
    nextState.lastAggressorPlayerId = actor.playerId;
    actor.actedThisStreet = true;
    actor.raiseReopenAtMilliBb = nextState.currentBetMilliBb + nextState.lastFullRaiseIncrementMilliBb;
  }

  const record = {
    schemaVersion: POKER_ACTION_RECORD_SCHEMA_VERSION,
    sequence: nextState.actionHistory.length,
    street: nextState.street,
    playerId: actor.playerId,
    submittedAction: { ...action },
    toCallBeforeMilliBb,
    committedMilliBb,
    streetContributionAfterMilliBb: actor.streetContributionMilliBb,
    currentBetBeforeMilliBb,
    currentBetAfterMilliBb: nextState.currentBetMilliBb,
    wasAllIn: isPlayerAllIn(actor),
    wasFullRaise,
    reopenedBetting,
  };
  nextState.actionHistory.push(record);

  if (action.type === ACTION_TYPES.FOLD) {
    settleFold(nextState, actor.playerId);
  } else if (isBettingRoundComplete(nextState)) {
    completePreflop(nextState);
  } else if (isPlayerLive(opponent) && !isPlayerAllIn(opponent)) {
    nextState.actingPlayerId = opponent.playerId;
  } else {
    completePreflop(nextState);
  }

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
