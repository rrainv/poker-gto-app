import {
  STRATEGY_PROVIDER_SCHEMA_VERSION,
  createStrategyProvider,
} from './strategy-provider.mjs';

export function installStrategyProviderBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: STRATEGY_PROVIDER_SCHEMA_VERSION,
    createProvider(options) {
      return createStrategyProvider(options);
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
