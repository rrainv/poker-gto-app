import {
  ANALYSIS_EXPLANATION_SCHEMA_VERSION,
  ANALYSIS_THRESHOLDS,
  createAnalysisExplanation,
  deriveBoardTextureFacts,
  formatAnalysisTemplate,
} from './analysis-explanation.mjs';
import {
  RANGE_ANALYSIS_FACTS_SCHEMA_VERSION,
  RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION,
  createRangeAnalysisFacts,
  createRangeAnalysisRequest,
  deriveExactHandFacts,
} from './range-analysis.mjs';
import {
  BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION,
  createBluffAnalysisFacts,
} from './bluff-analysis.mjs';
import {
  formatExactPokerAmountBb,
  formatSuggestedSizingBb,
  roundSuggestedSizingBb,
} from './poker-sizing-presentation.mjs';
import {
  EQUITY_HAND_ANALYSIS_SCHEMA_VERSION,
  EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
  createEquityHandAnalysisProjection,
  createExactEnteredHandOutcomeFacts,
  orderBestFiveForPresentation,
} from './equity-hand-analysis.mjs';
import {
  RANGE_COMPARISON_FACTS_SCHEMA_VERSION,
  createRepresentativeRangeComparisonFacts,
} from './range-comparison-facts.mjs';

export function installAnalysisExplanationBridge(browserWindow) {
  if (!browserWindow) return null;
  const bridge = Object.freeze({
    schemaVersion: ANALYSIS_EXPLANATION_SCHEMA_VERSION,
    thresholds: ANALYSIS_THRESHOLDS,
    create: createAnalysisExplanation,
    rangeAnalysisFactsSchemaVersion: RANGE_ANALYSIS_FACTS_SCHEMA_VERSION,
    rangeAnalysisRequestSchemaVersion: RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION,
    createRangeAnalysisRequest,
    createRangeAnalysisFacts,
    bluffAnalysisFactsSchemaVersion: BLUFF_ANALYSIS_FACTS_SCHEMA_VERSION,
    createBluffAnalysisFacts,
    deriveExactHandFacts,
    deriveBoardTextureFacts,
    rangeComparisonFactsSchemaVersion: RANGE_COMPARISON_FACTS_SCHEMA_VERSION,
    createRepresentativeRangeComparisonFacts,
    equityHandAnalysisSchemaVersion: EQUITY_HAND_ANALYSIS_SCHEMA_VERSION,
    exactEnteredHandOutcomesSchemaVersion: EXACT_ENTERED_HAND_OUTCOMES_SCHEMA_VERSION,
    createEquityHandAnalysisProjection,
    createExactEnteredHandOutcomeFacts,
    orderBestFiveForPresentation,
    formatTemplate: formatAnalysisTemplate,
    formatExactPokerAmountBb,
    formatSuggestedSizingBb,
    roundSuggestedSizingBb,
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
