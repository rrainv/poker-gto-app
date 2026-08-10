import {
  CHANCE_TYPES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  STREETS,
} from './schema.js';
import { isPlayerLive } from './selectors.js';
import { markShowdownReady, requestBoardChance } from './street-transitions.js';

function appendLedger(state, playerId, kind, amountMilliBb) {
  if (amountMilliBb === 0) return;
  state.ledger.push({
    sequence: state.ledger.length,
    playerId,
    street: state.street,
    kind,
    movement: LEDGER_MOVEMENTS.POT_TO_STACK,
    amountMilliBb,
  });
}

function creditFromPot(state, player, amountMilliBb, kind) {
  if (amountMilliBb === 0) return;
  if (amountMilliBb > state.potMilliBb) throw new RangeError('Pot credit exceeds the pot');
  state.potMilliBb -= amountMilliBb;
  player.currentStackMilliBb += amountMilliBb;
  appendLedger(state, player.playerId, kind, amountMilliBb);
}

function highestLiveContributor(state) {
  const ordered = state.players.filter(isPlayerLive).sort((left, right) => (
    right.totalPotContributionMilliBb - left.totalPotContributionMilliBb
  ));
  const candidate = ordered[0];
  return candidate || null;
}

export function refundUncalledExcess(state, recipientPlayerId = null) {
  const recipient = recipientPlayerId === null
    ? highestLiveContributor(state)
    : state.players.find((player) => player.playerId === recipientPlayerId);
  if (!recipient || !isPlayerLive(recipient)) return null;
  const matchedByOthers = state.players
    .filter((player) => player.playerId !== recipient.playerId)
    .reduce((maximum, player) => Math.max(maximum, player.totalPotContributionMilliBb), 0);
  const amountMilliBb = Math.max(
    0,
    recipient.totalPotContributionMilliBb - matchedByOthers,
  );
  creditFromPot(state, recipient, amountMilliBb, LEDGER_KINDS.UNCALLED_REFUND);
  return amountMilliBb === 0 ? null : { playerId: recipient.playerId, amountMilliBb };
}

export function completeBettingRound(state) {
  refundUncalledExcess(state);
  if (state.street === STREETS.PREFLOP) {
    requestBoardChance(state, CHANCE_TYPES.DEAL_FLOP);
  } else if (state.street === STREETS.FLOP) {
    requestBoardChance(state, CHANCE_TYPES.DEAL_TURN);
  } else if (state.street === STREETS.TURN) {
    requestBoardChance(state, CHANCE_TYPES.DEAL_RIVER);
  } else if (state.street === STREETS.RIVER) {
    markShowdownReady(state);
  } else {
    throw new RangeError(`Cannot complete unsupported betting street: ${state.street}`);
  }
}

export function completePreflop(state) {
  if (state.street !== STREETS.PREFLOP) throw new RangeError('completePreflop requires the preflop street');
  completeBettingRound(state);
}

export function settleFoldTerminal(state, winnerPlayerId) {
  const winner = state.players.find((player) => player.playerId === winnerPlayerId);
  if (!winner || !isPlayerLive(winner)) throw new RangeError('Fold settlement requires one live winner');
  const refund = refundUncalledExcess(state, winnerPlayerId);
  const payoutMilliBb = state.potMilliBb;
  creditFromPot(state, winner, payoutMilliBb, LEDGER_KINDS.POT_AWARD);

  state.phase = PHASES.TERMINAL;
  state.actingPlayerId = null;
  state.pendingChance = null;
  state.terminal = {
    isTerminal: true,
    reason: 'fold',
    winnerPlayerIds: [winner.playerId],
    payoutsMilliBbByPlayer: payoutMilliBb === 0 ? {} : { [winner.playerId]: payoutMilliBb },
    refundsMilliBbByPlayer: refund === null ? {} : { [winner.playerId]: refund.amountMilliBb },
  };
}
