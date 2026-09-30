// SAVED-TRAINING-HISTORY-001: DOM-free projection of answered Training Memory
// decisions for the Saved destination. Training Memory stays the sole owner of this
// evidence; nothing here is persisted, and no poker, strategy, or Equity is computed.
import { reviewReasonsForDecision } from '../training-memory/domain.mjs';
import { createTrainingMemoryPresentationGate } from './training-memory-presentation.mjs';

export const SAVED_TRAINING_HISTORY_QUERY_SCHEMA_VERSION = 'saved-training-history-query/v1';
export const SAVED_TRAINING_HISTORY_VIEW_SCHEMA_VERSION = 'saved-training-history-view/v1';
export const SAVED_TRAINING_HISTORY_ITEM_SCHEMA_VERSION = 'saved-training-history-item/v1';
export const SAVED_TRAINING_HISTORY_LIMIT = 200;
export const SAVED_TRAINING_HISTORY_MODES = Object.freeze(['all', 'varied', 'focused', 'full_hand']);
export const SAVED_TRAINING_HISTORY_SOURCE_SURFACE = 'training';
export const SAVED_TRAINING_HISTORY_SOURCE_PREFIX = 'training-memory:';

const OPEN_REVIEW_STATES = new Set(['pending', 'snoozed']);

export function createSavedTrainingHistoryQuery({ mode = 'all', unsureOnly = false, queuedOnly = false } = {}) {
  return Object.freeze({
    schemaVersion: SAVED_TRAINING_HISTORY_QUERY_SCHEMA_VERSION,
    mode: SAVED_TRAINING_HISTORY_MODES.includes(mode) ? mode : 'all',
    unsureOnly: unsureOnly === true,
    queuedOnly: queuedOnly === true,
  });
}

export function savedTrainingHistoryQueryIsFiltered(query) {
  return (query?.mode ?? 'all') !== 'all' || query?.unsureOnly === true || query?.queuedOnly === true;
}

function reviewStatus(record) {
  let reasons = [];
  try { reasons = reviewReasonsForDecision(record); } catch { reasons = []; }
  const state = record.reviewState?.state;
  const open = OPEN_REVIEW_STATES.has(state);
  if (open && record.learningEvidence?.revisitRequest) {
    return Object.freeze({ kind: 'revisit', dueAt: record.reviewState.dueAt ?? null });
  }
  if (open && reasons.length) {
    return Object.freeze({ kind: 'queued', dueAt: state === 'snoozed' ? record.reviewState.dueAt ?? null : null });
  }
  if (state === 'reviewed') return Object.freeze({ kind: 'reviewed', dueAt: null });
  return Object.freeze({ kind: 'none', dueAt: null });
}

// Human-readable historical source labels (translation keys). The label comes only from
// the frozen built-in source id and, when frozen, its descriptor family. It never reads a
// provider-declared display name or authority, so it cannot upgrade a source.
export const SAVED_TRAINING_HISTORY_SOURCE_LABELS = Object.freeze({
  heuristic_preflop: 'Riverline heuristic guidance, preflop, at the time',
  heuristic_postflop: 'Riverline heuristic guidance, postflop, at the time',
  equity_fallback: 'Riverline equity-based guidance, at the time',
  unavailable: 'No strategy guidance at the time',
  other: 'Another strategy source, at the time',
});
const BUILT_IN_SOURCE_FAMILIES = Object.freeze({
  heuristic_preflop: 'heuristic',
  heuristic_postflop: 'heuristic',
  equity_fallback: 'equity',
  unavailable: 'unavailable',
});

export function savedTrainingHistorySourceLabelKey(strategyResult) {
  const labels = SAVED_TRAINING_HISTORY_SOURCE_LABELS;
  if (!strategyResult || typeof strategyResult !== 'object') return labels.unavailable;
  const source = strategyResult.source;
  if (!Object.hasOwn(BUILT_IN_SOURCE_FAMILIES, source)) return labels.other;
  const family = strategyResult.sourceDescriptor?.family;
  // A frozen descriptor that disagrees with the built-in family is not trusted for a name.
  if (family !== undefined && family !== BUILT_IN_SOURCE_FAMILIES[source]) return labels.other;
  return labels[source];
}

// One list item per answered decision; the frozen record stays attached for detail/actions.
export function projectSavedTrainingHistoryItem(record) {
  if (record?.status !== 'answered') throw new RangeError('Training history lists answered decisions only');
  const result = record.strategyEvidence?.strategyResult ?? null;
  const review = reviewStatus(record);
  return Object.freeze({
    schemaVersion: SAVED_TRAINING_HISTORY_ITEM_SCHEMA_VERSION,
    id: record.id,
    sessionId: record.sessionId,
    mode: record.mode,
    answeredAt: record.answeredAt,
    shownAt: record.shownAt,
    context: record.decisionContext,
    action: record.userResponse?.action ?? null,
    unsure: record.learningEvidence?.uncertainty?.value === 'uncertain',
    review,
    queued: review.kind === 'revisit' || review.kind === 'queued',
    // Historical answer-time identity only; never re-resolved or upgraded.
    source: result ? Object.freeze({ id: result.source, version: result.sourceVersion }) : null,
    sourceLabelKey: savedTrainingHistorySourceLabelKey(result),
    // Card-tile facts copied from the frozen DecisionContext (presentation only).
    kind: 'training',
    derivation: record.decisionSource?.kind === 'full_hand_replay_point' ? 'full_hand' : 'generated',
    heroCards: Array.isArray(record.decisionContext?.heroCards) ? record.decisionContext.heroCards : [],
    board: Array.isArray(record.decisionContext?.board) ? record.decisionContext.board : [],
    record,
  });
}

// Applies the existing Training Memory presentation gate per owning session. A withheld
// decision is excluded entirely: no answer, comparison, or review reason can render.
export function partitionSavedTrainingHistory(records, sessions, gateFor = createTrainingMemoryPresentationGate) {
  const sessionsById = new Map((Array.isArray(sessions) ? sessions : []).map((session) => [session.id, session]));
  const visible = [];
  let withheldCount = 0;
  for (const record of Array.isArray(records) ? records : []) {
    if (record?.status !== 'answered') continue;
    const session = sessionsById.get(record.sessionId) ?? null;
    const gate = session ? gateFor(session) : null;
    const withheld = session
      ? (!gate || gate.feedbackEmbargoed || !gate.revealAnswerAndReference || !gate.revealReviewReasons)
      // A Full Hand answer without its owning session cannot prove its Hand is finished.
      : record.mode === 'full_hand';
    if (withheld) withheldCount += 1;
    else visible.push(record);
  }
  return Object.freeze({ visible: Object.freeze(visible), withheldCount });
}

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function sortSavedTrainingHistoryItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => (
    timestamp(right.answeredAt) - timestamp(left.answeredAt)
    || timestamp(right.shownAt) - timestamp(left.shownAt)
    || String(left.id).localeCompare(String(right.id))
  ));
}

export function filterSavedTrainingHistoryItems(items, query) {
  const normalized = createSavedTrainingHistoryQuery(query);
  return (Array.isArray(items) ? items : []).filter((item) => (
    (normalized.mode === 'all' || item.mode === normalized.mode)
    && (!normalized.unsureOnly || item.unsure)
    && (!normalized.queuedOnly || item.queued)
  ));
}

export function savedTrainingHistoryCounts(items) {
  const source = Array.isArray(items) ? items : [];
  return Object.freeze({
    all: source.length,
    varied: source.filter((item) => item.mode === 'varied').length,
    focused: source.filter((item) => item.mode === 'focused').length,
    full_hand: source.filter((item) => item.mode === 'full_hand').length,
    unsure: source.filter((item) => item.unsure).length,
    queued: source.filter((item) => item.queued).length,
  });
}

export function createSavedTrainingHistoryView({
  items = [],
  bounded = false,
  limit = SAVED_TRAINING_HISTORY_LIMIT,
  withheldCount = 0,
  query = createSavedTrainingHistoryQuery(),
} = {}) {
  const source = Array.isArray(items) ? items : [];
  const normalized = createSavedTrainingHistoryQuery(query);
  const results = sortSavedTrainingHistoryItems(filterSavedTrainingHistoryItems(source, normalized));
  let status = 'results';
  if (!source.length) status = withheldCount > 0 ? 'withheld_only' : 'empty';
  else if (!results.length) status = 'no_results';
  return Object.freeze({
    schemaVersion: SAVED_TRAINING_HISTORY_VIEW_SCHEMA_VERSION,
    status,
    bounded: bounded === true,
    limit,
    countScope: bounded === true ? 'shown' : 'history',
    counts: savedTrainingHistoryCounts(source),
    totalCount: source.length,
    resultCount: results.length,
    withheldCount,
    results: Object.freeze(results),
    filtered: savedTrainingHistoryQueryIsFiltered(normalized),
    query: normalized,
  });
}

export function savedTrainingHistorySourceId(recordId) {
  if (typeof recordId !== 'string' || !recordId) throw new TypeError('A Training decision ID is required');
  return `${SAVED_TRAINING_HISTORY_SOURCE_PREFIX}${recordId}`;
}

// Stable Saved object ID per Training decision, so a retry or second click never
// creates a duplicate Spot (same pattern as reviewed-decision saving).
export async function savedTrainingHistorySpotObjectId(recordId, subtle = globalThis.crypto?.subtle) {
  if (!subtle?.digest) throw new TypeError('Stable Saved IDs require Web Crypto');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(savedTrainingHistorySourceId(recordId)));
  return `training-spot-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

// Input for the existing Saved Hand-derived Spot builder. The canonical pre-action
// PokerState comes from Training Memory's own exact reconstruction of the decision.
export function buildSavedTrainingHistorySpotInput(record, pokerState) {
  if (record?.status !== 'answered') throw new RangeError('Only an answered Training decision can be saved as a Spot');
  if (!pokerState || typeof pokerState !== 'object') throw new TypeError('The decision\'s canonical state is required');
  const heroPlayerId = record.decisionSource?.heroPlayerId;
  if (typeof heroPlayerId !== 'string' || !heroPlayerId) throw new TypeError('The decision\'s Hero is required');
  return Object.freeze({
    pokerState,
    heroPlayerId,
    projectionOptions: Object.freeze({ stackMode: record.decisionContext?.stackMode ?? 'hero' }),
    sourceSurface: SAVED_TRAINING_HISTORY_SOURCE_SURFACE,
    sourceId: savedTrainingHistorySourceId(record.id),
  });
}
