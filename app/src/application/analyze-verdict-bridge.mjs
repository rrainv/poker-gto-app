import {
  ANALYZE_VERDICT_SCHEMA_VERSION,
  ESTIMATED_MIX_STEP_PERCENT,
  VERDICT_CLOSE_MARGIN,
  VERDICT_MEANINGFUL_SHARE,
  describeAnalyzeVerdict,
  presentStrategyMixActions,
} from './analyze-verdict.mjs';

// The window bridge lives apart from the verdict logic so Explain can import the
// logic without installing anything (tests import it before bootApp()).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineAnalyzeVerdict', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: ANALYZE_VERDICT_SCHEMA_VERSION,
      closeMargin: VERDICT_CLOSE_MARGIN,
      meaningfulShare: VERDICT_MEANINGFUL_SHARE,
      estimatedMixStepPercent: ESTIMATED_MIX_STEP_PERCENT,
      presentMixActions: presentStrategyMixActions,
      describe: describeAnalyzeVerdict,
    }),
    writable: false,
  });
}
