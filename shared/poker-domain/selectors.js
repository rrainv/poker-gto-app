import { LEDGER_MOVEMENTS, POKER_STATE_SCHEMA_VERSION } from './schema.js';
import { deriveSeatAssignments, playersClockwiseAfterSeat } from './positions.js';

function requirePokerState(state) {
  if (!state || state.schemaVersion !== POKER_STATE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${POKER_STATE_SCHEMA_VERSION}`);
  }
  return state;
}

export function playerById(state, playerId) {
  requirePokerState(state);
  return state.players.find((player) => player.playerId === playerId) || null;
}

export function blindAssignments(state) {
  requirePokerState(state);
  const assignments = deriveSeatAssignments(state.players, state.buttonSeat);
  return Object.freeze({
    buttonPlayerId: assignments.find((entry) => entry.isButton).playerId,
    smallBlindPlayerId: assignments.find((entry) => entry.isSmallBlind).playerId,
    bigBlindPlayerId: assignments.find((entry) => entry.isBigBlind).playerId,
  });
}

export function isPlayerLive(player) {
  return Boolean(player && player.dealtIn && !player.folded);
}

export function isPlayerAllIn(player) {
  return isPlayerLive(player) && player.currentStackMilliBb === 0;
}

export function totalHandContributionMilliBb(player) {
  if (!player) throw new TypeError('player is required');
  return player.totalPotContributionMilliBb + player.totalDeductionMilliBb;
}

export function firstPreflopActorId(state) {
  requirePokerState(state);
  const { bigBlindPlayerId } = blindAssignments(state);
  const bigBlind = playerById(state, bigBlindPlayerId);
  const order = playersClockwiseAfterSeat(state.players, bigBlind.seat);
  const actor = order.find((player) => isPlayerLive(player) && player.currentStackMilliBb > 0);
  return actor ? actor.playerId : null;
}

export function ledgerTotals(state) {
  requirePokerState(state);
  let potMilliBb = 0;
  let deductionMilliBb = 0;
  for (const entry of state.ledger) {
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_POT) potMilliBb += entry.amountMilliBb;
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) deductionMilliBb += entry.amountMilliBb;
  }
  return Object.freeze({ potMilliBb, deductionMilliBb });
}

export function stackTotals(state) {
  requirePokerState(state);
  return Object.freeze({
    startingMilliBb: state.players.reduce((sum, player) => sum + player.startingStackMilliBb, 0),
    remainingMilliBb: state.players.reduce((sum, player) => sum + player.currentStackMilliBb, 0),
  });
}

export function isChipConserved(state) {
  const stacks = stackTotals(state);
  return stacks.startingMilliBb
    === stacks.remainingMilliBb + state.potMilliBb + state.deductionTotalMilliBb;
}
