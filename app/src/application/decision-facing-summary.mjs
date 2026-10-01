export const DECISION_FACING_SUMMARY_SCHEMA_VERSION = 'decision-facing-summary/v1';

/**
 * Bounded wording classes for "what does Hero face" copy. A presentation-only
 * projection of canonical DecisionContext facts; it never recomputes betting
 * amounts and never changes strategy input.
 */
export const DECISION_FACING_KINDS = Object.freeze({
  FACING_WAGER: 'facing_wager',
  UNOPENED: 'unopened',
  LIMPED: 'limped',
  OPTION: 'option',
  CHECK_AVAILABLE: 'check_available',
  PRICE_ONLY: 'price_only',
  UNAVAILABLE: 'unavailable',
});

const VOLUNTARY_WAGER_FAMILIES = new Set(['bet', 'raise']);
const VOLUNTARY_AGGRESSION_FAMILIES = new Set(['open', 'three_bet', 'four_bet_or_more', 'bet', 'raise']);
const PREFLOP_LIMP_FAMILIES = new Set(['limp', 'call']);

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Whether the canonical summary proves a voluntary wager (beyond blinds,
// straddles and antes) on the current street, proves there is none, or cannot say.
function voluntaryWagerFact(summary) {
  if (!summary || typeof summary !== 'object') return null;
  if (Number.isInteger(summary.aggressionCount)) return summary.aggressionCount > 0;
  if (VOLUNTARY_WAGER_FAMILIES.has(summary.facingActionFamily)
    || VOLUNTARY_AGGRESSION_FAMILIES.has(summary.aggressionFamily)) return true;
  if (summary.aggressionFamily === 'none') return false;
  return null;
}

/**
 * Classify a DecisionContext v1 into one facing wording class.
 * `facingToBb` is the canonical wager-to (`facingSizeBb`); `callAmountBb` is the
 * canonical exact, stack-capped call commitment. Neither is derived here.
 */
export function describeDecisionFacing(decisionContext) {
  const context = decisionContext && typeof decisionContext === 'object' ? decisionContext : {};
  const summary = context.priorActionSummary;
  const callAmountBb = finiteOrNull(context.callAmountBb);
  const facingToBb = finiteOrNull(context.facingSizeBb);
  const heroStackBb = finiteOrNull(context.heroStackBb);
  const street = typeof context.street === 'string' ? context.street : null;
  const facts = {
    schemaVersion: DECISION_FACING_SUMMARY_SCHEMA_VERSION,
    kind: DECISION_FACING_KINDS.UNAVAILABLE,
    street,
    facingToBb: null,
    callAmountBb,
    // Canonical Hand exposes chips behind; a call that commits all of them is all-in.
    callIsAllIn: callAmountBb !== null && callAmountBb > 0
      && heroStackBb !== null && callAmountBb >= heroStackBb,
  };
  // Scenario contexts never fabricate a price (callAmountBb null); the spot is
  // still classified and the price line says it is unavailable.
  const voluntaryWager = voluntaryWagerFact(summary);
  if (voluntaryWager === true) {
    return Object.freeze({
      ...facts,
      kind: callAmountBb === 0 ? DECISION_FACING_KINDS.CHECK_AVAILABLE : DECISION_FACING_KINDS.FACING_WAGER,
      facingToBb: callAmountBb === 0 ? null : facingToBb,
    });
  }
  if (voluntaryWager === false) {
    if (street === 'preflop') {
      // Preflop with no voluntary aggression and nothing to call is the big
      // blind's option; otherwise the pot is unopened or limped.
      if (callAmountBb === 0) return Object.freeze({ ...facts, kind: DECISION_FACING_KINDS.OPTION });
      const limped = (Number.isInteger(summary.limperCount) && summary.limperCount > 0)
        || PREFLOP_LIMP_FAMILIES.has(summary.facingActionFamily);
      return Object.freeze({
        ...facts,
        kind: limped ? DECISION_FACING_KINDS.LIMPED : DECISION_FACING_KINDS.UNOPENED,
      });
    }
    if (callAmountBb === 0 || callAmountBb === null) {
      return Object.freeze({ ...facts, kind: DECISION_FACING_KINDS.CHECK_AVAILABLE });
    }
  }
  if (callAmountBb === null) return Object.freeze(facts);
  // Insufficient canonical facts: show only the trusted call price.
  return Object.freeze({
    ...facts,
    kind: callAmountBb > 0 ? DECISION_FACING_KINDS.PRICE_ONLY : DECISION_FACING_KINDS.CHECK_AVAILABLE,
  });
}

function formatBb(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded)} bb`;
}

/**
 * Localized one-line copy. With `position` the line leads with it
 * ("BTN · unopened · 1 bb to call"); without it the line suits a "Facing" tile.
 */
export function formatDecisionFacing(summary, { position = null, translate } = {}) {
  const t = typeof translate === 'function' ? translate : (key, values = {}) => (
    String(key).replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match))
  );
  const call = summary?.callAmountBb === null || summary?.callAmountBb === undefined
    ? null
    : formatBb(summary.callAmountBb);
  const price = call === null
    ? t('facing.price.unavailable')
    : t(summary.callIsAllIn ? 'facing.price.allInCall' : 'facing.price.toCall', { call });
  let detail;
  switch (summary?.kind) {
    case DECISION_FACING_KINDS.FACING_WAGER:
      detail = summary.facingToBb === null || summary.facingToBb === 0
        ? price
        : t('facing.detail.wager', { facing: formatBb(summary.facingToBb), price });
      break;
    case DECISION_FACING_KINDS.UNOPENED:
      detail = t('facing.detail.unopened', { price });
      break;
    case DECISION_FACING_KINDS.LIMPED:
      detail = t('facing.detail.limped', { price });
      break;
    case DECISION_FACING_KINDS.OPTION:
      detail = t('facing.detail.option');
      break;
    case DECISION_FACING_KINDS.CHECK_AVAILABLE:
      detail = t('facing.detail.checkAvailable');
      break;
    case DECISION_FACING_KINDS.PRICE_ONLY:
      detail = price;
      break;
    default:
      detail = t('facing.detail.unavailable');
  }
  if (position) return t('facing.line.position', { position, detail });
  // A standalone "Facing" tile starts with a capital letter (no-op for Hebrew).
  return detail ? `${detail.charAt(0).toLocaleUpperCase()}${detail.slice(1)}` : detail;
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineDecisionFacing', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: DECISION_FACING_SUMMARY_SCHEMA_VERSION,
      kinds: DECISION_FACING_KINDS,
      describe: describeDecisionFacing,
      format: formatDecisionFacing,
    }),
    writable: false,
  });
}
