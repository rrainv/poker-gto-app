import { DECISION_CONTEXT_SCHEMA_VERSION } from './decision-context-from-poker-state.mjs';
import {
  STRATEGY_RESULT_SCHEMA_VERSION,
  STRATEGY_SOURCES,
  createStrategyResult,
  createUnavailableStrategyResult,
} from './strategy-result.mjs';
import {
  strategyContextCoverageFor,
  strategySourceDescriptorFor,
} from './strategy-source-authority.mjs';
import { createReferencePackAdapter } from './reference-pack-v1.mjs';
import { bindStrategyAssessmentPolicy } from './strategy-assessment-policy.mjs';

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

function resultFromCandidate(candidate, decisionContext, sourceAcceptance = null) {
  const sourceDescriptor = strategySourceDescriptorFor(
    candidate?.source,
    candidate?.sourceDescriptor ?? null,
  );
  return createStrategyResult({
    ...candidate,
    sourceDescriptor,
    sourceAcceptance,
    contextCoverage: candidate?.contextCoverage
      ?? strategyContextCoverageFor(
        candidate?.source,
        decisionContext,
        sourceDescriptor,
      ),
    recommendedLabel: candidate?.recommendedLabel
      ?? candidate?.recommendation?.label
      ?? null,
  });
}

function withReferenceSelection(candidate, referenceSelection) {
  if (!referenceSelection) return candidate;
  return {
    ...candidate,
    details: {
      ...(candidate?.details && typeof candidate.details === 'object'
        ? candidate.details
        : {}),
      providerSelection: {
        referencePack: referenceSelection,
        selectedSource: candidate?.source ?? 'unavailable',
      },
    },
  };
}

/**
 * The provider is the sole application strategy entry point. The injected
 * fallback is injected by the browser bootstrap; a future validated model can
 * be selected inside this module without changing resolve() consumers.
 */
export function createStrategyProvider({
  fallbackResolver,
  referencePack = null,
  allowTestReferencePack = false,
  sourceAcceptanceRegistry = null,
  assessmentPolicyRegistry = null,
} = {}) {
  if (typeof fallbackResolver !== 'function') {
    throw new TypeError('StrategyProvider requires an explicit fallbackResolver');
  }
  if (sourceAcceptanceRegistry !== null
    && typeof sourceAcceptanceRegistry?.acceptanceFor !== 'function') {
    throw new TypeError('StrategyProvider sourceAcceptanceRegistry must be an acceptance registry');
  }
  const referenceAdapter = referencePack === null || referencePack === undefined
    ? null
    : createReferencePackAdapter(referencePack, {
      allowTestPack: allowTestReferencePack === true,
    });

  return Object.freeze({
    schemaVersion: STRATEGY_PROVIDER_SCHEMA_VERSION,
    resultSchemaVersion: STRATEGY_RESULT_SCHEMA_VERSION,
    sources: STRATEGY_SOURCES,

    resolve(decisionContext) {
      const reason = invalidContextReason(decisionContext);
      if (reason) {
        return createUnavailableStrategyResult(reason, { providerReason: 'invalid_decision_context' });
      }

      let referenceSelection = null;
      if (referenceAdapter) {
        try {
          const referenceResolution = referenceAdapter.resolve(decisionContext);
          if (referenceResolution.candidate) {
            const descriptor = strategySourceDescriptorFor(
              referenceResolution.candidate.source,
              referenceResolution.candidate.sourceDescriptor,
            );
            return bindStrategyAssessmentPolicy(resultFromCandidate(
              referenceResolution.candidate,
              decisionContext,
              sourceAcceptanceRegistry?.acceptanceFor(
                descriptor,
                referenceAdapter.contentHash,
              ) ?? null,
            ), decisionContext, assessmentPolicyRegistry);
          }
          referenceSelection = {
            packId: referenceAdapter.packId,
            packVersion: referenceAdapter.packVersion,
            coverage: referenceResolution.match.coverage.kind,
            limitationCodes: [...referenceResolution.match.coverage.limitationCodes],
          };
        } catch (error) {
          referenceSelection = {
            packId: referenceAdapter.packId,
            packVersion: referenceAdapter.packVersion,
            coverage: 'unsupported',
            limitationCodes: ['reference_pack_resolution_error'],
            error: {
              name: error instanceof Error ? error.name : 'Error',
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }

      let candidate;
      try {
        candidate = withReferenceSelection(
          fallbackResolver(decisionContext),
          referenceSelection,
        );
      } catch (error) {
        return fallbackFailure(error);
      }

      try {
        const descriptor = strategySourceDescriptorFor(
          candidate?.source,
          candidate?.sourceDescriptor ?? null,
        );
        const acceptance = sourceAcceptanceRegistry?.acceptanceFor(
          descriptor,
          candidate?.provenance?.contentHash ?? null,
        ) ?? null;
        return bindStrategyAssessmentPolicy(resultFromCandidate(candidate, decisionContext, acceptance), decisionContext, assessmentPolicyRegistry);
      } catch (error) {
        return fallbackFailure(error);
      }
    },
  });
}
