// TRAINING-QUICK-001: the quick refresher's view model (Varied and Focused
// drills). A presentation-only projection of a TrainingExercise v1/v2 and its
// answer: seats, facts, action cards and the answer reveal. Every number comes
// from the canonical DecisionContext, PokerState or StrategyResult; nothing
// here does poker maths, and an unknown value stays null (never zero).
// Full Hand keeps its own table and controls.

export const QUICK_DRILL_VIEW_SCHEMA_VERSION = 'training-quick-drill-view/v1';

const ACTION_ORDER = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);

// DESIGN_SYSTEM keyboard contract: F fold, C check/call, B/R bet or raise, A all-in.
export const QUICK_DRILL_ACTION_KEYS = Object.freeze({
  fold: Object.freeze(['f']),
  check: Object.freeze(['c']),
  call: Object.freeze(['c']),
  bet: Object.freeze(['b', 'r']),
  raise: Object.freeze(['r', 'b']),
  all_in: Object.freeze(['a']),
});

const ACTION_KIND = Object.freeze({
  fold: 'fold',
  check: 'passive',
  call: 'passive',
  bet: 'aggressive',
  raise: 'aggressive',
  all_in: 'all-in',
});

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function milliToBb(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value / 1000 : null;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

export function quickDrillActionKind(type) {
  return ACTION_KIND[type] || 'aggressive';
}

/** The action type a key selects, given the legal action types on screen. */
export function quickDrillActionForKey(key, availableTypes = []) {
  const pressed = String(key || '').toLowerCase();
  const ordered = ACTION_ORDER.filter((type) => availableTypes.includes(type));
  return ordered.find((type) => QUICK_DRILL_ACTION_KEYS[type]?.[0] === pressed)
    || ordered.find((type) => QUICK_DRILL_ACTION_KEYS[type]?.includes(pressed))
    || null;
}

/** The key printed on an action card (the first key of its family). */
export function quickDrillKeyLabel(type) {
  return (QUICK_DRILL_ACTION_KEYS[type]?.[0] || '').toUpperCase();
}

/**
 * Seat positions around the oval, hero at the bottom, the rest clockwise in
 * seat order. Geometry only: percentages of the felt box.
 */
export function quickDrillSeatSlots(count) {
  const total = Math.max(2, Math.min(10, Math.trunc(Number(count)) || 2));
  return Array.from({ length: total }, (_, index) => {
    const angle = (Math.PI / 2) + (index * 2 * Math.PI) / total;
    return Object.freeze({
      x: Math.round((50 + 41 * Math.cos(angle)) * 10) / 10,
      y: Math.round((50 + 40 * Math.sin(angle)) * 10) / 10,
    });
  });
}

// The last action each player took on the current street, from the canonical
// action history (the presentation model's already-labelled rows).
function lastStreetActions(exercise, presentation) {
  const street = exercise.decisionContext?.street;
  const history = presentation?.actionHistory || [];
  const players = exercise.pokerState?.players || [];
  const byPosition = new Map();
  history.forEach((row) => {
    if (row.street !== street || !row.position) return;
    byPosition.set(row.position, row);
  });
  const result = new Map();
  players.forEach((player) => {
    const row = byPosition.get(player.position);
    if (row) result.set(player.playerId, row);
  });
  return result;
}

export function projectQuickDrillSeats(exercise, presentation = exercise?.presentation) {
  const state = exercise?.pokerState;
  const players = (state?.players || []).filter((player) => player.seated !== false && player.dealtIn !== false)
    .sort((left, right) => left.seat - right.seat);
  const heroIndex = Math.max(0, players.findIndex((player) => player.playerId === exercise.heroPlayerId));
  const rotated = [...players.slice(heroIndex), ...players.slice(0, heroIndex)];
  const slots = quickDrillSeatSlots(rotated.length);
  const actions = lastStreetActions(exercise, presentation);
  return freeze(rotated.map((player, index) => {
    const row = actions.get(player.playerId) || null;
    return {
      playerId: player.playerId,
      position: player.position || null,
      isHero: player.playerId === exercise.heroPlayerId,
      folded: player.folded === true,
      stackBb: milliToBb(player.currentStackMilliBb),
      streetBetBb: milliToBb(player.streetContributionMilliBb),
      action: row && row.actionType !== 'fold'
        ? { type: row.actionType, label: row.actionLabel, amountBb: finiteOrNull(row.amountBb) }
        : null,
      slot: slots[index],
    };
  }));
}

/**
 * The three fact tiles: pot, to call and equity needed (Exact · price only).
 * Derivation operands are the domain's own values (call commitment and the
 * actor-contestable pot after the call); the ratio is the domain's
 * requiredRawEquity, never recomputed here.
 */
export function projectQuickDrillFacts(decisionContext) {
  const context = decisionContext || {};
  const potBb = finiteOrNull(context.currentPotBb ?? context.potBb);
  const callBb = finiteOrNull(context.callAmountBb);
  const potAfterCallBb = finiteOrNull(context.actorContestablePotAfterCallBb);
  const required = finiteOrNull(context.requiredRawEquity);
  const facingPrice = callBb !== null && callBb > 0;
  return freeze({
    potBb,
    toCallBb: callBb,
    potAfterCallBb,
    equityNeededPercent: facingPrice && required !== null ? required * 100 : null,
    facingPrice,
    effectiveStackBb: finiteOrNull(context.effectiveStackBb) ?? finiteOrNull(context.stackBb),
  });
}

/** One card per legal action, in the canonical order, with its amount. */
export function projectQuickDrillActions(exercise, presentationModel = exercise?.presentation) {
  const legal = exercise?.legalActions || {};
  const presentation = new Map((presentationModel?.legalActions || []).map((entry) => [entry.type, entry]));
  return freeze(ACTION_ORDER.filter((type) => (type === 'all_in' ? legal.allIn?.available : legal[type]?.available))
    .map((type) => {
      const source = type === 'all_in' ? legal.allIn : legal[type];
      const entry = presentation.get(type);
      const range = ['bet', 'raise'].includes(type)
        ? { minBb: milliToBb(source?.minToMilliBb), maxBb: milliToBb(source?.maxToMilliBb) }
        : null;
      return {
        type,
        kind: quickDrillActionKind(type),
        key: quickDrillKeyLabel(type),
        amountBb: type === 'call' ? milliToBb(source?.commitMilliBb)
          : type === 'all_in' ? milliToBb(source?.amountToMilliBb)
            : null,
        range: range && range.minBb !== null && range.maxBb !== null ? range : null,
        label: entry?.label || null,
      };
    }));
}

/** The spot family used to group this session's results. */
export function quickDrillSpotType(exercise) {
  const reason = exercise?.generationMetadata?.targetReason;
  if (typeof reason === 'string' && reason) return reason;
  const context = exercise?.decisionContext || {};
  return `${context.street || 'unknown'}_${finiteOrNull(context.facingSizeBb) > 0 ? 'facing' : 'first'}`;
}

/**
 * The answer reveal. `mix` is the presented mix (5% steps, under 5% hidden:
 * analyze-verdict presentStrategyMixActions) and `verdict` its dominance
 * reading (describeAnalyzeVerdict). The answer is inside the source's mix when
 * the chosen action is part of the presented mix; the "you" tick sits at the
 * middle of its segment. Descriptive only, never a grade.
 */
/** Shares under this many percent are not drawn in the mix bar. */
export const QUICK_DRILL_MIX_MIN_PERCENT = 5;

/**
 * The answer reveal. The "you" marker sits under the centre of the segment of
 * the action Hero chose (start + share / 2, in percent of the bar). When that
 * action is not drawn (under 5% or absent) there is no marker: the view says
 * "not in the mix" instead. Nothing else places the marker.
 */
export function projectQuickDrillAnswer({ chosenType, mix = [], verdict = null } = {}) {
  const segments = [];
  let offset = 0;
  mix.filter((entry) => entry.value >= QUICK_DRILL_MIX_MIN_PERCENT).forEach((entry) => {
    segments.push({
      type: entry.action?.type ?? null,
      kind: entry.kind,
      name: entry.name,
      value: entry.value,
      start: offset,
    });
    offset += entry.value;
  });
  const chosen = segments.find((segment) => segment.type === chosenType) || null;
  return freeze({
    schemaVersion: QUICK_DRILL_VIEW_SCHEMA_VERSION,
    chosenType,
    inside: chosen !== null,
    youAtPercent: chosen ? chosen.start + chosen.value / 2 : null,
    segments,
    verdict: verdict?.kind === 'close'
      ? { kind: 'close', primary: verdict.primary?.label ?? null, secondary: verdict.secondary?.label ?? null }
      : verdict?.kind === 'dominant'
        ? { kind: 'dominant', primary: verdict.primary?.label ?? null, secondary: null }
        : { kind: 'unavailable', primary: null, secondary: null },
  });
}

/** This session's results grouped by spot type (counts only). */
export function summarizeQuickDrillSession(results = []) {
  const groups = new Map();
  results.forEach((result) => {
    const group = groups.get(result.spotType) || { spotType: result.spotType, answered: 0, inside: 0 };
    group.answered += 1;
    if (result.inside) group.inside += 1;
    groups.set(result.spotType, group);
  });
  return freeze({
    answered: results.length,
    inside: results.filter((result) => result.inside).length,
    groups: [...groups.values()],
  });
}
