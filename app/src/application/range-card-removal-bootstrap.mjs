import {
  RANGE_CARD_REMOVAL_PROJECTION_VERSION,
  projectPreflopHandClassesAfterCardRemoval,
} from './range-card-removal.mjs';

export function installRangeCardRemovalBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: RANGE_CARD_REMOVAL_PROJECTION_VERSION,
    projectHandClasses: (options) => projectPreflopHandClassesAfterCardRemoval(options),
  });
  Object.defineProperty(browserWindow, 'RiverlineRangeCardRemoval', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installRangeCardRemovalBridge(window);

