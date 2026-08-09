import {
  CHANCE_TYPES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
} from './schema.js';
import { isPlayerLive } from './selectors.js';

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

export function completePreflop(state) {
  refundUncalledExcess(state);
  state.phase = PHASES.CHANCE;
  state.actingPlayerId = null;
  state.pendingChance = {
    type: CHANCE_TYPES.DEAL_FLOP,
    cardCount: 3,
  };
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
