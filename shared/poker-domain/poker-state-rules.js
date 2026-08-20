import { validateGameRulesSnapshot } from './game-rules.js';

const NORMALIZED_RULES_SNAPSHOTS = new WeakSet();

export function normalizePokerStateRulesSnapshot(snapshot) {
  if (snapshot && NORMALIZED_RULES_SNAPSHOTS.has(snapshot)) return snapshot;
  const normalized = validateGameRulesSnapshot(snapshot);
  NORMALIZED_RULES_SNAPSHOTS.add(normalized);
  return normalized;
}

export function clonePokerState(state) {
  const normalizedRulesSnapshot = state && Object.hasOwn(state, 'rulesSnapshot')
    ? normalizePokerStateRulesSnapshot(state.rulesSnapshot)
    : null;
  const clone = structuredClone(state);
  if (normalizedRulesSnapshot !== null) clone.rulesSnapshot = normalizedRulesSnapshot;
  return clone;
}
