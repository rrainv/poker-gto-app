import {
  ANALYSIS_EXPLANATION_SCHEMA_VERSION,
  ANALYSIS_THRESHOLDS,
  createAnalysisExplanation,
  deriveBoardTextureFacts,
  formatAnalysisTemplate,
} from './analysis-explanation.mjs';

export function installAnalysisExplanationBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: ANALYSIS_EXPLANATION_SCHEMA_VERSION,
    thresholds: ANALYSIS_THRESHOLDS,
    create: createAnalysisExplanation,
    deriveBoardTextureFacts,
    formatTemplate: formatAnalysisTemplate,
  });
  Object.defineProperty(browserWindow, 'RiverlineAnalysisExplanation', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

if (typeof window !== 'undefined') installAnalysisExplanationBridge(window);

