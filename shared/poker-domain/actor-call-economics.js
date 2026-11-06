import { deepFreeze } from './freeze.js';
import { getLegalActionSpec } from './legal-actions.js';
import { derivePotLayers, deriveUnmatchedContribution } from './pot-layers.js';
import { POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION } from './schema.js';
import { isPlayerLive } from './selectors.js';

/**
 * Projects the final pot layers for the current live actor after the canonical,
 * stack-capped legal call. Layer construction remains owned by pot-layers; this
 * selector does not mutate PokerState or expose an arbitrary commitment API.
 */
export function deriveActorCallEconomics(state, actorPlayerId) {
  const actor = state?.players?.find((player) => player.playerId === actorPlayerId);
  if (!actor) throw new RangeError(`Unknown playerId: ${actorPlayerId}`);
  if (!isPlayerLive(actor)) {
    throw new RangeError('Actor call economics requires a live player');
  }
  if (state.actingPlayerId !== actorPlayerId) {
    throw new RangeError('Actor call economics requires the current acting player');
  }
  const legalActions = getLegalActionSpec(state);
  if (legalActions.playerId !== actorPlayerId) {
    throw new RangeError('Legal call authority did not resolve the requested actor');
  }
  const callCommitmentMilliBb = legalActions.call.commitMilliBb;
  const projectedState = {
    ...state,
    potMilliBb: state.potMilliBb + callCommitmentMilliBb,
    players: state.players.map((player) => (
      player.playerId === actorPlayerId
        ? {
          ...player,
          totalPotContributionMilliBb:
            player.totalPotContributionMilliBb + callCommitmentMilliBb,
        }
        : player
    )),
  };
  const projectedLayers = derivePotLayers(projectedState);
  const actorContestablePotAfterCallMilliBb = projectedLayers
    .filter((layer) => layer.eligiblePlayerIds.includes(actorPlayerId))
    .reduce((sum, layer) => sum + layer.amountMilliBb, 0);
  const potAfterCallMilliBb = projectedState.potMilliBb;
  const actorIneligiblePotAfterCallMilliBb = potAfterCallMilliBb
    - actorContestablePotAfterCallMilliBb;
  if (actorIneligiblePotAfterCallMilliBb < 0) {
    throw new RangeError('Actor-contestable pot cannot exceed the projected total pot');
  }

  const ownRefund = projected => {
    const unmatched = deriveUnmatchedContribution(projected, actorPlayerId);
    return unmatched?.amountMilliBb ?? 0;
  };
  const incrementalRiskMilliBb = callCommitmentMilliBb
    - (ownRefund(projectedState) - ownRefund(state));
  return deepFreeze({
    schemaVersion: POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION,
    actorPlayerId,
    callCommitmentMilliBb,
    potAfterCallMilliBb,
    actorContestablePotAfterCallMilliBb,
    actorIneligiblePotAfterCallMilliBb,
    requiredRawEquity: callCommitmentMilliBb > 0
      ? incrementalRiskMilliBb / actorContestablePotAfterCallMilliBb
      : null,
  });
}

/**
 * TRAINING-FULLHAND-001: facts about one concrete bet/raise size for the acting
 * player, so a size ladder can show them without any UI arithmetic.
 *
 * - `potShare`: the size's increment over the current wager as a share of the
 *   actor-contestable pot after calling (the same basis the postflop size
 *   presets use), or null when that pot is unavailable.
 * - `sprAfterCalled`: heads-up only. Effective stack left behind divided by the
 *   pot if the single remaining opponent calls the size. Null when multiway
 *   (SPR is not defined there) or when the pot is zero. Unknown stays null,
 *   never zero.
 * Amounts are canonical milliBb and the selector never mutates PokerState.
 */
export function deriveActionSizeFacts(state, actorPlayerId, amountToMilliBb) {
  if (!Number.isSafeInteger(amountToMilliBb) || amountToMilliBb < 0) {
    throw new RangeError('amountToMilliBb must be a nonnegative safe integer');
  }
  const economics = deriveActorCallEconomics(state, actorPlayerId);
  const actor = state.players.find((player) => player.playerId === actorPlayerId);
  const increment = amountToMilliBb - state.currentBetMilliBb;
  const basis = economics.actorContestablePotAfterCallMilliBb;
  const potShare = basis > 0 && increment >= 0 ? increment / basis : null;

  const opponents = state.players.filter((player) => (
    player.playerId !== actorPlayerId && isPlayerLive(player)
  ));
  let sprAfterCalled = null;
  if (opponents.length === 1) {
    const [opponent] = opponents;
    const actorAdds = Math.min(
      Math.max(0, amountToMilliBb - actor.streetContributionMilliBb),
      actor.currentStackMilliBb,
    );
    const opponentAdds = Math.min(
      Math.max(0, amountToMilliBb - opponent.streetContributionMilliBb),
      opponent.currentStackMilliBb,
    );
    const potIfCalled = state.potMilliBb + actorAdds + opponentAdds;
    const effectiveBehind = Math.min(
      actor.currentStackMilliBb - actorAdds,
      opponent.currentStackMilliBb - opponentAdds,
    );
    sprAfterCalled = potIfCalled > 0 ? effectiveBehind / potIfCalled : null;
  }
  return deepFreeze({
    actorPlayerId,
    amountToMilliBb,
    potShare,
    sprAfterCalled,
  });
}

function finiteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Canonical actor-contestable pot before the current decision action, in big blinds.
 * Accepts either a DecisionContext (`actorContestablePotAfterCallBb`, `callAmountBb`)
 * or a milliBb actor-economics record (`actorContestablePotAfterCallMilliBb`, `callCommitmentMilliBb`).
 */
export function deriveActorPotBeforeActionBb(context) {
  if (!context || typeof context !== 'object') return null;
  const afterCallBb = finiteNonNegativeNumber(context.actorContestablePotAfterCallBb);
  const callAmountBb = finiteNonNegativeNumber(context.callAmountBb);
  if (afterCallBb !== null && callAmountBb !== null) {
    return afterCallBb >= callAmountBb ? afterCallBb - callAmountBb : null;
  }
  const afterCallMilliBb = finiteNonNegativeNumber(context.actorContestablePotAfterCallMilliBb);
  const callMilliBb = finiteNonNegativeNumber(context.callCommitmentMilliBb);
  if (afterCallMilliBb !== null && callMilliBb !== null) {
    return afterCallMilliBb >= callMilliBb ? (afterCallMilliBb - callMilliBb) / 1000 : null;
  }
  return null;
}

/**
 * Canonical heads-up Stack-to-Pot Ratio (SPR) before the current action.
 * Returns null when multiway, when effectiveStackBb is unavailable, or when pot before action <= 0.
 */
export function deriveStackToPotRatio(context) {
  if (!context || typeof context !== 'object') return null;
  if (context.opponentCount !== 1) return null;
  const effectiveStackBb = finiteNonNegativeNumber(context.effectiveStackBb);
  const potBeforeActionBb = deriveActorPotBeforeActionBb(context);
  if (effectiveStackBb === null || potBeforeActionBb === null || potBeforeActionBb <= 0) {
    return null;
  }
  return effectiveStackBb / potBeforeActionBb;
}

/**
 * Canonical heads-up Minimum Defense Frequency (MDF) as a probability in [0, 1].
 * Returns null when multiway, when no positive call is faced, or when actor-contestable pot is unavailable.
 */
export function deriveMinimumDefenseFrequency(context) {
  if (!context || typeof context !== 'object') return null;
  if (context.opponentCount !== 1) return null;
  const callAmountBb = finiteNonNegativeNumber(context.callAmountBb)
    ?? (finiteNonNegativeNumber(context.callCommitmentMilliBb) !== null
      ? context.callCommitmentMilliBb / 1000
      : null);
  const afterCallBb = finiteNonNegativeNumber(context.actorContestablePotAfterCallBb)
    ?? (finiteNonNegativeNumber(context.actorContestablePotAfterCallMilliBb) !== null
      ? context.actorContestablePotAfterCallMilliBb / 1000
      : null);
  if (callAmountBb === null || callAmountBb <= 0) return null;
  if (afterCallBb === null || afterCallBb <= 0 || afterCallBb < callAmountBb) return null;
  const potBeforeActionBb = deriveActorPotBeforeActionBb(context);
  if (potBeforeActionBb === null) return null;
  return potBeforeActionBb / afterCallBb;
}

/**
 * Canonical heads-up Minimum Defense Frequency (MDF) as a percentage in [0, 100].
 */
export function deriveMinimumDefenseFrequencyPercent(context) {
  const mdf = deriveMinimumDefenseFrequency(context);
  return mdf === null ? null : mdf * 100;
}

export {
  deriveActorPotBeforeActionBb as actorPotBeforeActionBb,
  deriveStackToPotRatio as stackToPotRatio,
  deriveMinimumDefenseFrequency as minimumDefenseFrequency,
  deriveMinimumDefenseFrequencyPercent as minimumDefenseFrequencyPercent,
};
