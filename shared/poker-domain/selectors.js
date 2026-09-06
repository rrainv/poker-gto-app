import {
  LEDGER_MOVEMENTS,
  POKER_STATE_SCHEMA_VERSION,
  POKER_STATE_SCHEMA_VERSIONS,
  POKER_STATE_V2_SCHEMA_VERSION,
} from './schema.js';
import { deriveSeatAssignments, playersClockwiseAfterSeat } from './positions.js';

function requirePokerState(state) {
  if (!state || !POKER_STATE_SCHEMA_VERSIONS.includes(state.schemaVersion)) {
    throw new TypeError(`Expected ${POKER_STATE_SCHEMA_VERSION} or ${POKER_STATE_V2_SCHEMA_VERSION}`);
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

export function firstPostflopActorId(state) {
  requirePokerState(state);
  const order = playersClockwiseAfterSeat(state.players, state.buttonSeat);
  const actor = order.find((player) => isPlayerLive(player) && !isPlayerAllIn(player));
  return actor ? actor.playerId : null;
}

export function currentActor(state) {
  requirePokerState(state);
  return state.actingPlayerId === null ? null : playerById(state, state.actingPlayerId);
}

export function isHandResumable(state) {
  if (state === null || state === undefined) return false;
  requirePokerState(state);
  return state.terminal?.isTerminal === false;
}

export function amountToCallMilliBb(state, playerId = state.actingPlayerId) {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${playerId}`);
  return Math.max(0, state.currentBetMilliBb - player.streetContributionMilliBb);
}

export function maximumAmountToMilliBb(state, playerId = state.actingPlayerId) {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${playerId}`);
  return player.streetContributionMilliBb + player.currentStackMilliBb;
}

export function minimumBetToMilliBb(state) {
  requirePokerState(state);
  return state.currentBetMilliBb === 0 ? state.game.bigBlindMilliBb : null;
}

export function minimumRaiseToMilliBb(state) {
  requirePokerState(state);
  if (state.currentBetMilliBb === 0) return null;
  if (state.currentBetMilliBb < state.game.bigBlindMilliBb) return state.game.bigBlindMilliBb;
  return state.currentBetMilliBb + state.lastFullRaiseIncrementMilliBb;
}

export function hasRaisingRights(state, playerId = state.actingPlayerId) {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${playerId}`);
  if (!isPlayerLive(player) || isPlayerAllIn(player)) return false;
  if (maximumAmountToMilliBb(state, playerId) <= state.currentBetMilliBb) return false;
  if (!player.actedThisStreet || player.raiseReopenAtMilliBb === null) return true;
  return state.currentBetMilliBb >= player.raiseReopenAtMilliBb;
}

export function playerNeedsAction(state, playerId) {
  requirePokerState(state);
  const player = playerById(state, playerId);
  if (!player) throw new RangeError(`Unknown playerId: ${playerId}`);
  return isPlayerLive(player)
    && !isPlayerAllIn(player)
    && (!player.actedThisStreet || player.streetContributionMilliBb < state.currentBetMilliBb);
}

export function nextActionablePlayerId(state, afterPlayerId) {
  requirePokerState(state);
  const player = playerById(state, afterPlayerId);
  if (!player) throw new RangeError(`Unknown playerId: ${afterPlayerId}`);
  const next = playersClockwiseAfterSeat(state.players, player.seat)
    .find((candidate) => playerNeedsAction(state, candidate.playerId));
  return next ? next.playerId : null;
}

export function isBettingRoundComplete(state) {
  requirePokerState(state);
  const livePlayers = state.players.filter(isPlayerLive);
  return livePlayers.length >= 2 && livePlayers.every((player) => (
    isPlayerAllIn(player)
      || (player.actedThisStreet && player.streetContributionMilliBb === state.currentBetMilliBb)
  ));
}

export function ledgerTotals(state) {
  requirePokerState(state);
  let potMilliBb = 0;
  let deductionMilliBb = 0;
  let recordedRakeMilliBb = 0;
  for (const entry of state.ledger) {
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_POT) potMilliBb += entry.amountMilliBb;
    if ([LEDGER_MOVEMENTS.POT_TO_STACK, LEDGER_MOVEMENTS.POT_TO_RECORDED_RAKE].includes(entry.movement)) potMilliBb -= entry.amountMilliBb;
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) deductionMilliBb += entry.amountMilliBb;
    if (entry.movement === LEDGER_MOVEMENTS.POT_TO_RECORDED_RAKE) recordedRakeMilliBb += entry.amountMilliBb;
  }
  return Object.freeze({ potMilliBb, deductionMilliBb,
    ...(state.schemaVersion === 'poker-state/v3' ? { recordedRakeMilliBb } : {}) });
}

export function deductionTotalsByPlayer(state) {
  requirePokerState(state);
  const totals = Object.fromEntries(state.players.map((player) => [player.playerId, 0]));
  for (const entry of state.ledger) {
    if (entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION) {
      totals[entry.playerId] += entry.amountMilliBb;
    }
  }
  return Object.freeze(totals);
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
    === stacks.remainingMilliBb + state.potMilliBb + state.deductionTotalMilliBb
      + (state.recordedSettlement?.rakeMilliBb ?? 0);
}
