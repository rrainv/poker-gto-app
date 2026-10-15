export const ANALYZE_VERDICT_SCHEMA_VERSION = 'analyze-verdict/v1';

/**
 * Verdict dominance (ANALYZE-COMPOSITION-001). A presentation-only reading of an
 * existing StrategyResult v1 action distribution; it never changes strategy
 * output, frequencies or the recommendation.
 *
 * - `dominant`: the leading action is ahead of the next meaningful action by at
 *   least VERDICT_CLOSE_MARGIN (20 percentage points), or no other action reaches
 *   VERDICT_MEANINGFUL_SHARE (5%). The verdict shows the leading action alone at
 *   display size.
 * - `close`: the two leading actions are within VERDICT_CLOSE_MARGIN. The verdict
 *   names both ("3-Bet or Call") at the smaller close size with "close" wording.
 * - `unavailable`: no StrategyResult actions.
 *
 * Labels are the provider's sentence-case action labels (`entry.label`, e.g.
 * "3-Bet"), not the upper-case recommendation label.
 */
export const VERDICT_CLOSE_MARGIN = 0.2;
export const VERDICT_MEANINGFUL_SHARE = 0.05;

const KIND_BY_TYPE = Object.freeze({
  fold: 'fold',
  check: 'passive',
  call: 'passive',
  all_in: 'all-in',
});

function actionEntry(entry, index) {
  return Object.freeze({
    index,
    label: String(entry.label),
    type: entry.action?.type ?? null,
    kind: KIND_BY_TYPE[entry.action?.type] || 'aggressive',
    probability: entry.probability,
  });
}

export function describeAnalyzeVerdict(strategyResult) {
  const actions = Array.isArray(strategyResult?.actions)
    ? strategyResult.actions
      .map(actionEntry)
      .filter((entry) => Number.isFinite(entry.probability) && entry.probability > 0)
    : [];
  if (!actions.length) {
    return Object.freeze({ schemaVersion: ANALYZE_VERDICT_SCHEMA_VERSION, kind: 'unavailable', primary: null, secondary: null, marginPoints: null });
  }
  // Highest probability first; the provider's order breaks ties (same rule as its recommendation).
  const ranked = [...actions].sort((left, right) => right.probability - left.probability || left.index - right.index);
  const [primary, next] = ranked;
  const secondary = next && next.probability >= VERDICT_MEANINGFUL_SHARE ? next : null;
  const margin = secondary ? primary.probability - secondary.probability : null;
  // Compare in whole basis points so floating-point noise never flips the class.
  const close = secondary !== null && Math.round(margin * 10000) < Math.round(VERDICT_CLOSE_MARGIN * 10000);
  return Object.freeze({
    schemaVersion: ANALYZE_VERDICT_SCHEMA_VERSION,
    kind: close ? 'close' : 'dominant',
    primary,
    secondary: close ? secondary : null,
    marginPoints: close ? Math.round(margin * 100) : null,
  });
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineAnalyzeVerdict', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: ANALYZE_VERDICT_SCHEMA_VERSION,
      closeMargin: VERDICT_CLOSE_MARGIN,
      meaningfulShare: VERDICT_MEANINGFUL_SHARE,
      describe: describeAnalyzeVerdict,
    }),
    writable: false,
  });
}
