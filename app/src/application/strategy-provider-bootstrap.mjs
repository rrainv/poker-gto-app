import {
  STRATEGY_PROVIDER_SCHEMA_VERSION,
  createStrategyProvider,
} from './strategy-provider.mjs';
import {
  STRATEGY_CLAIM_POLICY_SCHEMA_VERSION,
  canStrategyClaim,
  resolveStrategyClaimPolicy,
} from './strategy-claim-policy.mjs';
import { strategySourceDescriptorFor } from './strategy-source-authority.mjs';
import { resolveHeuristicStrategy } from '../strategy/heuristic-strategy.mjs';
import { projectStrategyTruth, historicalStrategyTruth, strategyTruthPresentation, summarizeStrategyTruth } from './strategy-truth.mjs';

function browserProviderOptions(options = {}) {
  const heuristicOptionsResolver = typeof options?.heuristicOptionsResolver === 'function'
    ? options.heuristicOptionsResolver
    : () => ({});
  const fallbackResolver = typeof options?.fallbackResolver === 'function'
    ? options.fallbackResolver
    : (decisionContext) => resolveHeuristicStrategy(
        decisionContext,
        heuristicOptionsResolver(decisionContext),
      );

  return {
    referenceSourceIntake: options?.referenceSourceIntake ?? null,
    referencePack: options?.referencePack ?? null,
    allowTestReferencePack: options?.allowTestReferencePack === true,
    sourceAcceptanceRegistry: options?.sourceAcceptanceRegistry ?? null,
    assessmentPolicyRegistry: options?.assessmentPolicyRegistry ?? null,
    fallbackResolver,
  };
}

export function installStrategyProviderBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: STRATEGY_PROVIDER_SCHEMA_VERSION,
    claimPolicySchemaVersion: STRATEGY_CLAIM_POLICY_SCHEMA_VERSION,
    truthFor: projectStrategyTruth,
    historicalTruth: historicalStrategyTruth,
    truthPresentation: strategyTruthPresentation,
    summarizeTruth: summarizeStrategyTruth,
    createProvider(options) {
      return createStrategyProvider(browserProviderOptions(options));
    },
    claimsFor(strategyResult) {
      return resolveStrategyClaimPolicy(strategyResult);
    },
    canClaim(strategyResultOrPolicy, claim) {
      return canStrategyClaim(strategyResultOrPolicy, claim);
    },
    sourceDescriptorFor(source) {
      return strategySourceDescriptorFor(source);
    },
  });
  Object.defineProperty(browserWindow, 'RiverlineStrategy', {
    configurable: false,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installStrategyProviderBridge(window);
