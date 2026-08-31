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

function browserProviderOptions(options = {}) {
  if (typeof options?.fallbackResolver === 'function') return options;
  const heuristicOptionsResolver = typeof options?.heuristicOptionsResolver === 'function'
    ? options.heuristicOptionsResolver
    : () => ({});
  return {
    referencePack: options?.referencePack ?? null,
    sourceAcceptanceRegistry: options?.sourceAcceptanceRegistry ?? null,
    fallbackResolver(decisionContext) {
      return resolveHeuristicStrategy(
        decisionContext,
        heuristicOptionsResolver(decisionContext),
      );
    },
  };
}

export function installStrategyProviderBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: STRATEGY_PROVIDER_SCHEMA_VERSION,
    claimPolicySchemaVersion: STRATEGY_CLAIM_POLICY_SCHEMA_VERSION,
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
