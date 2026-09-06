import { assertMilliBbAlignment } from './amounts.js';
import { compareHandRanks, evaluateSeven } from './evaluator.js';
import { deepFreeze } from './freeze.js';
import { clonePokerState } from './poker-state-rules.js';
import { LEDGER_KINDS, LEDGER_MOVEMENTS, PHASES, POKER_STATE_V3_SCHEMA_VERSION } from './schema.js';
import { validatePokerState } from './validate.js';
import { splitLayerAmount } from './showdown.js';

export const RECORDED_HAND_SETTLEMENT_SCHEMA_VERSION = 'recorded-hand-settlement/v1';
const INPUT_KEYS = ['schemaVersion', 'grossPotMilliBb', 'rakeMilliBb', 'payoutsMilliBbByPlayer'];
const sum = (record) => Object.values(record).reduce((total, amount) => total + amount, 0);
const same = (a, b) => Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every((id) => Object.hasOwn(b, id) && a[id] === b[id]);

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key))) throw new TypeError(`Invalid ${label} fields`);
}

function validateEvidence(state, evidence, persisted = false) {
  exactKeys(evidence, persisted ? [...INPUT_KEYS, 'netAwardedMilliBb', 'grossPayoutsMilliBbByPlayer'] : INPUT_KEYS, 'recorded settlement');
  if (evidence.schemaVersion !== RECORDED_HAND_SETTLEMENT_SCHEMA_VERSION) throw new TypeError('Unsupported recorded settlement version');
  for (const field of ['grossPotMilliBb', 'rakeMilliBb']) {
    assertMilliBbAlignment(evidence[field], state.game.chipUnitMilliBb, field);
  }
  if (!evidence.payoutsMilliBbByPlayer || typeof evidence.payoutsMilliBbByPlayer !== 'object'
    || Array.isArray(evidence.payoutsMilliBbByPlayer)) throw new TypeError('Recorded payouts must be a player amount record');
  for (const [id, amount] of Object.entries(evidence.payoutsMilliBbByPlayer)) {
    if (!state.players.some((player) => player.playerId === id)) throw new RangeError('Unknown recorded payout recipient');
    assertMilliBbAlignment(amount, state.game.chipUnitMilliBb, 'recorded payout');
    if (amount === 0) throw new RangeError('Recorded payouts must omit zero awards');
  }
  const net = sum(evidence.payoutsMilliBbByPlayer);
  if (!Number.isSafeInteger(net) || net + evidence.rakeMilliBb !== evidence.grossPotMilliBb) {
    throw new RangeError('Recorded gross pot must equal net awards plus recorded rake');
  }
  if (persisted && evidence.netAwardedMilliBb !== net) throw new RangeError('Recorded net award total mismatch');
}

// Called by canonical validation. The existing showdown layers continue to describe
// gross evaluated entitlement; no per-layer rake allocation is invented from totals.
export function validateRecordedSettlementState(state, ledgerRake) {
  const evidence = state.recordedSettlement;
  if (evidence === null) {
    if (ledgerRake !== 0) throw new RangeError('Rake requires recorded settlement evidence');
    return;
  }
  validateEvidence(state, evidence, true);
  if (state.phase !== PHASES.TERMINAL || !state.terminal.isTerminal
    || !['fold', 'showdown'].includes(state.terminal.reason)) throw new RangeError('Recorded settlement requires canonical terminal results');
  const gross = evidence.grossPayoutsMilliBbByPlayer;
  if (!gross || typeof gross !== 'object' || Array.isArray(gross)) throw new TypeError('Gross payouts required');
  for (const [id, amount] of Object.entries(gross)) {
    assertMilliBbAlignment(amount, state.game.chipUnitMilliBb, 'gross payout');
    if (amount === 0 || !state.terminal.winnerPlayerIds.includes(id)) throw new RangeError('Invalid gross award recipient');
  }
  if (state.terminal.winnerPlayerIds.length !== Object.keys(gross).length
    || new Set(state.terminal.winnerPlayerIds).size !== Object.keys(gross).length) {
    throw new RangeError('Recorded terminal winners must match gross entitlement recipients');
  }
  if (sum(gross) !== evidence.grossPotMilliBb || ledgerRake !== evidence.rakeMilliBb
    || !same(state.terminal.payoutsMilliBbByPlayer, evidence.payoutsMilliBbByPlayer)) {
    throw new RangeError('Recorded settlement totals must match canonical terminal accounting');
  }
  const awarded = {};
  const refunds = {};
  const paid = {};
  const rakeEntries = state.ledger.filter((entry) => entry.kind === LEDGER_KINDS.RECORDED_RAKE);
  if (rakeEntries.length !== (evidence.rakeMilliBb > 0 ? 1 : 0)
    || rakeEntries.some((entry) => entry.street !== state.street)) throw new RangeError('Recorded rake must be one exact terminal ledger entry');
  const settlementStart = state.ledger.findIndex((entry) => [LEDGER_KINDS.RECORDED_RAKE, LEDGER_KINDS.POT_AWARD].includes(entry.kind));
  if (settlementStart >= 0 && state.ledger.slice(settlementStart).some((entry, index) => (
    entry.kind !== LEDGER_KINDS.POT_AWARD && !(index === 0 && entry.kind === LEDGER_KINDS.RECORDED_RAKE)
  ))) throw new RangeError('Recorded rake and net awards must form the final settlement ledger segment');
  for (const entry of state.ledger) {
    if (entry.kind === LEDGER_KINDS.POT_AWARD) awarded[entry.playerId] = (awarded[entry.playerId] || 0) + entry.amountMilliBb;
    if (entry.kind === LEDGER_KINDS.UNCALLED_REFUND) refunds[entry.playerId] = (refunds[entry.playerId] || 0) + entry.amountMilliBb;
    if (entry.movement === LEDGER_MOVEMENTS.POT_TO_STACK) paid[entry.playerId] = (paid[entry.playerId] || 0) + entry.amountMilliBb;
  }
  const grossPot = state.players.reduce((total, player) => total + player.totalPotContributionMilliBb, 0) - sum(refunds);
  if (grossPot !== evidence.grossPotMilliBb || !same(awarded, evidence.payoutsMilliBbByPlayer)) throw new RangeError('Recorded awards and gross pot must reconcile with the ledger');
  for (const player of state.players) {
    const net = evidence.payoutsMilliBbByPlayer[player.playerId] || 0;
    if (net > (gross[player.playerId] || 0)) throw new RangeError('Recorded award exceeds evaluated gross entitlement');
    if (player.currentStackMilliBb !== player.startingStackMilliBb - player.totalPotContributionMilliBb
      - player.totalDeductionMilliBb + (paid[player.playerId] || 0)) throw new RangeError('Recorded player stack does not reconcile');
  }
  if (state.terminal.reason === 'fold') {
    const live = state.players.filter((player) => player.dealtIn && !player.folded);
    if (live.length !== 1 || Object.keys(gross).length !== 1 || gross[live[0].playerId] !== grossPot) {
      throw new RangeError('Recorded fold award requires the sole live winner');
    }
  } else {
    for (const layer of state.showdown.layerResults) {
      const ranks = layer.eligiblePlayerIds.map((id) => {
        const player = state.players.find((candidate) => candidate.playerId === id);
        if (!Array.isArray(player.holeCards)) throw new RangeError('Recorded showdown requires known eligible cards');
        const rank = evaluateSeven([...player.holeCards, ...state.board]);
        if (Object.keys(rank).some((key) => JSON.stringify(rank[key])
          !== JSON.stringify(state.showdown.handRanksByPlayer[id]?.[key]))) {
          throw new RangeError('Recorded showdown ranks must match canonical evaluation');
        }
        return { id, rank };
      });
      const best = ranks.reduce((rank, item) => rank === null || compareHandRanks(item.rank, rank) > 0 ? item.rank : rank, null);
      const winners = ranks.filter((item) => compareHandRanks(item.rank, best) === 0).map((item) => item.id);
      if (winners.length !== layer.winnerPlayerIds.length || winners.some((id) => !layer.winnerPlayerIds.includes(id))) {
        throw new RangeError('Recorded showdown winners must match canonical evaluation');
      }
      if (!same(splitLayerAmount(state, layer.amountMilliBb, winners).payoutsMilliBbByPlayer,
        layer.payoutsMilliBbByPlayer)) throw new RangeError('Recorded gross layer awards must match canonical split and odd-chip rules');
    }
  }
}

export function applyRecordedSettlement(state, evidence) {
  validatePokerState(state);
  if (state.schemaVersion !== POKER_STATE_V3_SCHEMA_VERSION || state.phase !== PHASES.TERMINAL) {
    throw new RangeError('Recorded settlement requires a terminal PokerState v3');
  }
  validateEvidence(state, evidence);
  if (state.recordedSettlement !== null) {
    const previous = state.recordedSettlement;
    if (previous.grossPotMilliBb === evidence.grossPotMilliBb && previous.rakeMilliBb === evidence.rakeMilliBb
      && same(previous.payoutsMilliBbByPlayer, evidence.payoutsMilliBbByPlayer)) return state;
    throw new RangeError('Recorded settlement cannot overwrite different evidence');
  }
  const gross = state.terminal.payoutsMilliBbByPlayer;
  if (sum(gross) !== evidence.grossPotMilliBb) throw new RangeError('Recorded gross pot does not match canonical settlement');
  const next = clonePokerState(state);
  for (const player of next.players) {
    const net = evidence.payoutsMilliBbByPlayer[player.playerId] || 0;
    const entitlement = gross[player.playerId] || 0;
    if (net > entitlement) throw new RangeError('Recorded award exceeds evaluated gross entitlement');
    player.currentStackMilliBb += net - entitlement;
  }
  next.ledger = next.ledger.filter((entry) => entry.kind !== LEDGER_KINDS.POT_AWARD);
  if (evidence.rakeMilliBb > 0) next.ledger.push({ playerId: null, street: state.street,
    kind: LEDGER_KINDS.RECORDED_RAKE, movement: LEDGER_MOVEMENTS.POT_TO_RECORDED_RAKE, amountMilliBb: evidence.rakeMilliBb });
  for (const player of next.players) {
    const amount = evidence.payoutsMilliBbByPlayer[player.playerId];
    if (amount) next.ledger.push({ playerId: player.playerId, street: state.street,
      kind: LEDGER_KINDS.POT_AWARD, movement: LEDGER_MOVEMENTS.POT_TO_STACK, amountMilliBb: amount });
  }
  next.ledger.forEach((entry, sequence) => { entry.sequence = sequence; });
  next.recordedSettlement = { ...structuredClone(evidence), netAwardedMilliBb: sum(evidence.payoutsMilliBbByPlayer),
    grossPayoutsMilliBbByPlayer: { ...gross } };
  next.terminal.payoutsMilliBbByPlayer = { ...evidence.payoutsMilliBbByPlayer };
  validatePokerState(next);
  return deepFreeze(next);
}
