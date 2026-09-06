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
import { referenceCoverageFromMatch } from './reference-coverage.mjs';
import { isValidatedReferenceSourceIntake } from './reference-source-intake.mjs';

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
  referenceSourceIntake = null,
} = {}) {
  if (typeof fallbackResolver !== 'function') {
    throw new TypeError('StrategyProvider requires an explicit fallbackResolver');
  }
  if (sourceAcceptanceRegistry !== null
    && typeof sourceAcceptanceRegistry?.acceptanceFor !== 'function') {
    throw new TypeError('StrategyProvider sourceAcceptanceRegistry must be an acceptance registry');
  }
  if (referenceSourceIntake !== null) {
    if (!isValidatedReferenceSourceIntake(referenceSourceIntake)) throw new TypeError('A validated source intake is required');
    if (referencePack !== null) throw new TypeError('Select one reference source');
    if (referenceSourceIntake.visibility === 'private_local') throw new TypeError('Private source activation is preview-only');
    if (referenceSourceIntake.localUse.status !== 'permitted') throw new TypeError('Source use permission is missing');
    referencePack = referenceSourceIntake.pack;
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
            if (referenceSourceIntake) {
              referenceResolution.candidate.provenance = {
                ...referenceResolution.candidate.provenance,
                contentHash: referenceSourceIntake.fingerprint,
                legacyPackFingerprint: referenceAdapter.contentHash,
                coverageIdentity: referenceSourceIntake.coverage.nodes[0].nodeIdentity,
                sourceClass: referenceSourceIntake.sourceClass,
              };
            }
            const descriptor = strategySourceDescriptorFor(
              referenceResolution.candidate.source,
              referenceResolution.candidate.sourceDescriptor,
            );
            let acceptance = sourceAcceptanceRegistry?.acceptanceFor(descriptor,
              referenceSourceIntake?.fingerprint ?? referenceAdapter.contentHash) ?? null;
            if (referenceSourceIntake && acceptance?.acceptedCoverageIdentity !== referenceSourceIntake.coverage.nodes[0].nodeIdentity) acceptance = null;
            return bindStrategyAssessmentPolicy(resultFromCandidate(
              referenceResolution.candidate,
              decisionContext,
              acceptance,
            ), decisionContext, assessmentPolicyRegistry);
          }
          referenceSelection = {
            packId: referenceAdapter.packId,
            packVersion: referenceAdapter.packVersion,
            sourceId: referenceAdapter.sourceId,
            sourceVersion: referenceAdapter.sourceVersion,
            contentHash: referenceSourceIntake?.fingerprint ?? referenceAdapter.contentHash,
            coverageQuery: referenceCoverageFromMatch(referenceResolution.match,
              referenceSourceIntake?.coverage.nodes[0].nodeIdentity ?? null),
            coverage: referenceResolution.match.coverage.kind,
            limitationCodes: [...referenceResolution.match.coverage.limitationCodes],
          };
        } catch (error) {
          referenceSelection = {
            packId: referenceAdapter.packId,
            packVersion: referenceAdapter.packVersion,
            sourceId: referenceAdapter.sourceId,
            sourceVersion: referenceAdapter.sourceVersion,
            contentHash: referenceSourceIntake?.fingerprint ?? referenceAdapter.contentHash,
            coverageQuery: referenceCoverageFromMatch(null),
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
