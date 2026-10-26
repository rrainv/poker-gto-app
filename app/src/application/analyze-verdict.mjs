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
export const ESTIMATED_MIX_STEP_PERCENT = 5;

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

export function presentStrategyMixActions(strategyResult) {
  if (!strategyResult || !Array.isArray(strategyResult.actions)) return Object.freeze([]);
  const isExact = strategyResult.exactFrequencies === true
    || strategyResult.sourceDescriptor?.capabilities?.actionDistribution === 'exact';
  const indexed = strategyResult.actions.map((entry, index) => ({ entry, index }));
  if (isExact) {
    const allocations = indexed.map(({ entry, index }) => {
      const exact = entry.probability * 100;
      const value = Math.floor(exact);
      return { entry, index, value, remainder: exact - value };
    });
    let pointsLeft = 100 - allocations.reduce((sum, item) => sum + item.value, 0);
    [...allocations]
      .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
      .forEach((item) => {
        if (pointsLeft <= 0) return;
        allocations[item.index].value += 1;
        pointsLeft -= 1;
      });
    return Object.freeze(allocations.map(({ entry, index, value }) => Object.freeze({
      index,
      action: entry.action,
      name: entry.label,
      value,
      kind: KIND_BY_TYPE[entry.action?.type] || 'aggressive',
    })));
  }
  const positive = indexed.filter(({ entry }) => Number.isFinite(entry.probability) && entry.probability > 0);
  if (!positive.length) return Object.freeze([]);
  const meaningful = positive.filter(({ entry }) => (
    Math.round(entry.probability * 10000) >= Math.round(VERDICT_MEANINGFUL_SHARE * 10000)
  ));
  const kept = meaningful.length ? meaningful : [
    [...positive].sort((left, right) => right.entry.probability - left.entry.probability || left.index - right.index)[0],
  ];
  const totalProbability = kept.reduce((sum, { entry }) => sum + entry.probability, 0) || 1;
  const allocations = kept.map(({ entry, index }, slot) => {
    const exactSteps = (entry.probability / totalProbability) * (100 / ESTIMATED_MIX_STEP_PERCENT);
    const steps = Math.floor(exactSteps);
    return { entry, index, slot, steps, remainder: exactSteps - steps };
  });
  let stepsLeft = (100 / ESTIMATED_MIX_STEP_PERCENT) - allocations.reduce((sum, item) => sum + item.steps, 0);
  [...allocations]
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((item) => {
      if (stepsLeft <= 0) return;
      allocations[item.slot].steps += 1;
      stepsLeft -= 1;
    });
  return Object.freeze(allocations.map(({ entry, index, steps }) => Object.freeze({
    index,
    action: entry.action,
    name: entry.label,
    value: steps * ESTIMATED_MIX_STEP_PERCENT,
    kind: KIND_BY_TYPE[entry.action?.type] || 'aggressive',
  })));
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
  const secondary = next && Math.round(next.probability * 10000) >= Math.round(VERDICT_MEANINGFUL_SHARE * 10000) ? next : null;
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
      estimatedMixStepPercent: ESTIMATED_MIX_STEP_PERCENT,
      presentMixActions: presentStrategyMixActions,
      describe: describeAnalyzeVerdict,
    }),
    writable: false,
  });
}
