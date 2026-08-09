import { validateAction } from './action.js';
import { deepFreeze } from './freeze.js';
import { getLegalActionSpec } from './legal-actions.js';
import {
  amountToCallMilliBb,
  isPlayerAllIn,
  isPlayerLive,
  nextActionablePlayerId,
} from './selectors.js';
import {
  ACTION_TYPES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  POKER_ACTION_RECORD_SCHEMA_VERSION,
} from './schema.js';
import { completePreflop, settleFoldTerminal } from './settlement.js';
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

function isBettingRoundComplete(state) {
  const livePlayers = state.players.filter(isPlayerLive);
  return livePlayers.length >= 2 && livePlayers.every((player) => (
    isPlayerAllIn(player)
      || (player.actedThisStreet && player.streetContributionMilliBb === state.currentBetMilliBb)
  ));
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
    }
    nextState.currentBetMilliBb = amountToMilliBb;
    nextState.lastAggressorPlayerId = actor.playerId;
    actor.actedThisStreet = true;
    actor.raiseReopenAtMilliBb = nextState.currentBetMilliBb + nextState.lastFullRaiseIncrementMilliBb;
    reopenedBetting = wasFullRaise || nextState.players.some((player) => (
      player.playerId !== actor.playerId
      && isPlayerLive(player)
      && !isPlayerAllIn(player)
      && player.actedThisStreet
      && player.raiseReopenAtMilliBb !== null
      && currentBetBeforeMilliBb < player.raiseReopenAtMilliBb
      && nextState.currentBetMilliBb >= player.raiseReopenAtMilliBb
    ));
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

  const livePlayers = nextState.players.filter(isPlayerLive);
  if (livePlayers.length === 1) {
    settleFoldTerminal(nextState, livePlayers[0].playerId);
  } else if (isBettingRoundComplete(nextState)) {
    completePreflop(nextState);
  } else {
    const nextPlayerId = nextActionablePlayerId(nextState, actor.playerId);
    if (nextPlayerId === null) {
      throw new RangeError('No actionable player found before preflop betting was complete');
    }
    nextState.actingPlayerId = nextPlayerId;
  }

  validatePokerState(nextState);
  return deepFreeze(nextState);
}
