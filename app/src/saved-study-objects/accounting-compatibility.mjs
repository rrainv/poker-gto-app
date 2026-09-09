import { validateSavedStudyObject } from './domain.mjs';
import { canonicalPokerStatesEqual, reconstructCanonicalHandReplaySource } from '../application/canonical-hand-replay-source.mjs';
import { deriveDecisionContextFromPokerState } from '../application/decision-context-from-poker-state.mjs';

export const SAVED_ACCOUNTING_COMPATIBILITY_VERSION = 'saved-accounting-compatibility/v1';

export function accountingUnavailable(cause = null) {
  const error = new RangeError('Historical accounting is unavailable: authoritative Hand evidence is missing or inconsistent.', cause ? { cause } : undefined);
  error.code = 'historical_accounting_unavailable';
  return error;
}

function historicalFacts(state) {
  const copy = structuredClone(state);
  delete copy.potMilliBb;
  for (const field of ['winnerPlayerIds', 'payoutsMilliBbByPlayer', 'refundsMilliBbByPlayer']) delete copy.terminal[field];
  delete copy.showdown.layerResults;
  if (copy.recordedSettlement) {
    delete copy.recordedSettlement.grossPayoutsMilliBbByPlayer;
    delete copy.recordedSettlement.netAwardedMilliBb;
  }
  for (const player of copy.players) delete player.currentStackMilliBb;
  copy.ledger = copy.ledger.filter(entry => !['uncalled_refund', 'pot_award'].includes(entry.kind))
    .map(({ sequence: _sequence, ...entry }) => entry);
  return copy;
}

// Reads old serialized DATA; all reconstruction uses the sole current rules
// implementation. No mutation, revision/timestamp churn, or legacy rule branch.
export function normalizeSavedAccounting(object) {
  if (object?.kind !== 'hand' || !(object.payload?.pokerState?.game?.ante?.amountMilliBb > 0)) return object;
  try {
    const snapshot = object.payload;
    if (!Number.isSafeInteger(snapshot.pokerState.potMilliBb) || snapshot.pokerState.potMilliBb < 0
      || snapshot.pokerState.players.some(player => !Number.isSafeInteger(player.currentStackMilliBb) || player.currentStackMilliBb < 0)
      || snapshot.pokerState.ledger.some(entry => !Number.isSafeInteger(entry.amountMilliBb) || entry.amountMilliBb <= 0)) throw accountingUnavailable();
    const replay = reconstructCanonicalHandReplaySource(snapshot.replaySource);
    if (replay.heroPlayerId !== snapshot.heroPlayerId
      || !canonicalPokerStatesEqual(historicalFacts(snapshot.pokerState), historicalFacts(replay.finalState))) {
      throw accountingUnavailable();
    }
    const current = canonicalPokerStatesEqual(snapshot.pokerState, replay.finalState) ? object
      : { ...object, payload: { ...snapshot, pokerState: replay.finalState } };
    validateSavedStudyObject(current);
    return current;
  } catch (cause) {
    throw accountingUnavailable(cause);
  }
}

export function needsHandAccountingEvidence(object) {
  const payload = object?.payload;
  return object?.kind === 'spot' && payload?.derivation === 'hand'
    && payload.schemaVersion !== 'saved-spot-snapshot/v3'
    && (!payload.decisionContext?.gameRules
      || payload.decisionContext.gameRules.definition.ante.amountMilliBb > 0);
}

export function materializeSavedSpotAccounting(object, parent) {
  if (!needsHandAccountingEvidence(object)) return object;
  try {
    const reference = object.payload.handReference;
    if (parent?.kind !== 'hand' || parent.id !== reference?.savedHandObjectId
      || !canonicalPokerStatesEqual(parent.ownerRef, object.ownerRef)) throw accountingUnavailable();
    const hand = normalizeSavedAccounting(parent).payload;
    if (hand.pokerState.handId !== reference.canonicalHandId) throw accountingUnavailable();
    const context = object.payload.decisionContext;
    const frames = reconstructCanonicalHandReplaySource(hand.replaySource).frames;
    const candidates = frames.filter(({ state }) => state.phase === 'betting'
      && state.actingPlayerId === hand.heroPlayerId
      && state.actionHistory.length === reference.actionSequenceCount
      && state.street === context.street && canonicalPokerStatesEqual(state.board, context.board));
    if (candidates.length !== 1) throw accountingUnavailable();
    const decisionContext = deriveDecisionContextFromPokerState(candidates[0].state, hand.heroPlayerId, { stackMode: context.stackMode });
    for (const field of ['tableSize', 'heroPosition', 'heroCards', 'board', 'deadCards', 'gameRules']) {
      if (context[field] !== undefined && !canonicalPokerStatesEqual(context[field], decisionContext[field])) throw accountingUnavailable();
    }
    return { ...object, payload: { ...object.payload, decisionContext,
      schemaVersion: 'saved-spot-snapshot/v3', accountingVersion: 'ante-dead-money/v1',
      rulesSnapshot: object.payload.rulesSnapshot ?? null } };
  } catch (cause) {
    throw accountingUnavailable(cause);
  }
}
