import { compareDecisionContexts } from './decision-context-comparator.mjs';
import { deriveDecisionContextFromPokerState } from './decision-context-from-poker-state.mjs';

export const DECISION_CONTEXT_SHADOW_DEFAULT_ENABLED = false;

function frozenResult(status, comparison = null, error = null) {
  return Object.freeze({ status, comparison, error });
}

export function runDecisionContextShadowComparison({
  enabled = DECISION_CONTEXT_SHADOW_DEFAULT_ENABLED,
  session,
  legacyContext,
  heroPlayerId,
  projectionOptions = {},
} = {}) {
  if (!enabled) return frozenResult('disabled');

  try {
    if (!session || typeof session.getState !== 'function') {
      throw new TypeError('Shadow comparison requires a CanonicalHandSession');
    }
    const canonicalContext = deriveDecisionContextFromPokerState(
      session.getState(),
      heroPlayerId,
      projectionOptions,
    );
    return frozenResult(
      'compared',
      compareDecisionContexts(legacyContext, canonicalContext),
    );
  } catch (error) {
    return frozenResult('error', null, Object.freeze({
      name: error instanceof Error ? error.name : 'Error',
      message: error instanceof Error ? error.message : String(error),
    }));
  }
}
