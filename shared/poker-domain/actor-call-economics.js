import { deepFreeze } from './freeze.js';
import { getLegalActionSpec } from './legal-actions.js';
import { derivePotLayers } from './pot-layers.js';
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

  return deepFreeze({
    schemaVersion: POKER_ACTOR_CALL_ECONOMICS_SCHEMA_VERSION,
    actorPlayerId,
    callCommitmentMilliBb,
    potAfterCallMilliBb,
    actorContestablePotAfterCallMilliBb,
    actorIneligiblePotAfterCallMilliBb,
    requiredRawEquity: callCommitmentMilliBb > 0
      ? callCommitmentMilliBb / actorContestablePotAfterCallMilliBb
      : null,
  });
}
