import { DECISION_CONTEXT_SCHEMA_VERSION } from './decision-context-from-poker-state.mjs';
import {
  STRATEGY_RESULT_SCHEMA_VERSION,
  STRATEGY_SOURCES,
  createStrategyResult,
  createUnavailableStrategyResult,
} from './strategy-result.mjs';

export const STRATEGY_PROVIDER_SCHEMA_VERSION = 'strategy-provider/v1';

function invalidContextReason(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return 'StrategyProvider requires DecisionContext v1.';
  }
  if (context.schemaVersion !== DECISION_CONTEXT_SCHEMA_VERSION) {
    return `StrategyProvider expected ${DECISION_CONTEXT_SCHEMA_VERSION}.`;
  }
  if (!Array.isArray(context.heroCards) || !Array.isArray(context.board)
    || !Array.isArray(context.deadCards)) {
    return 'DecisionContext v1 is missing card arrays.';
  }
  return null;
}

function fallbackFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return createUnavailableStrategyResult('Heuristic fallback is unavailable.', {
    providerReason: 'fallback_error',
    error: {
      name: error instanceof Error ? error.name : 'Error',
      message,
    },
  });
}

/**
 * The provider is the sole application strategy entry point. The injected
 * fallback is a transitional seam for logic.js; a future validated model can
 * be selected inside this module without changing resolve() consumers.
 */
export function createStrategyProvider({ fallbackResolver } = {}) {
  if (typeof fallbackResolver !== 'function') {
    throw new TypeError('StrategyProvider requires an explicit fallbackResolver');
  }

  return Object.freeze({
    schemaVersion: STRATEGY_PROVIDER_SCHEMA_VERSION,
    resultSchemaVersion: STRATEGY_RESULT_SCHEMA_VERSION,
    sources: STRATEGY_SOURCES,

    resolve(decisionContext) {
      const reason = invalidContextReason(decisionContext);
      if (reason) {
        return createUnavailableStrategyResult(reason, { providerReason: 'invalid_decision_context' });
      }

      let candidate;
      try {
        candidate = fallbackResolver(decisionContext);
      } catch (error) {
        return fallbackFailure(error);
      }

      try {
        return createStrategyResult({
          ...candidate,
          recommendedLabel: candidate?.recommendedLabel
            ?? candidate?.recommendation?.label
            ?? null,
        });
      } catch (error) {
        return fallbackFailure(error);
      }
    },
  });
}
