import {
  STRATEGY_PROVIDER_SCHEMA_VERSION,
  createStrategyProvider,
} from './strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../strategy/heuristic-strategy.mjs';

function browserProviderOptions(options = {}) {
  if (typeof options?.fallbackResolver === 'function') return options;
  const heuristicOptionsResolver = typeof options?.heuristicOptionsResolver === 'function'
    ? options.heuristicOptionsResolver
    : () => ({});
  const translate = typeof options?.translate === 'function'
    ? options.translate
    : (value) => String(value);
  return {
    fallbackResolver(decisionContext) {
      return resolveHeuristicStrategy(
        decisionContext,
        heuristicOptionsResolver(decisionContext),
        { translate },
      );
    },
  };
}

export function installStrategyProviderBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: STRATEGY_PROVIDER_SCHEMA_VERSION,
    createProvider(options) {
      return createStrategyProvider(browserProviderOptions(options));
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
