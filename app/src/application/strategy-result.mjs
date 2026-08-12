import { ACTION_TYPES } from '../../../shared/poker-domain/index.js';

export const STRATEGY_RESULT_SCHEMA_VERSION = 'strategy-result/v1';

export const STRATEGY_SOURCES = Object.freeze({
  HEURISTIC_PREFLOP: 'heuristic_preflop',
  HEURISTIC_POSTFLOP: 'heuristic_postflop',
  EQUITY_FALLBACK: 'equity_fallback',
  UNAVAILABLE: 'unavailable',
});

export const STRATEGY_ACTION_TYPES = Object.freeze({ ...ACTION_TYPES });

export const STRATEGY_PROBABILITY_TOLERANCE = 1e-12;

const SOURCE_VALUES = Object.freeze(Object.values(STRATEGY_SOURCES));
const ACTION_TYPE_VALUES = Object.freeze(Object.values(STRATEGY_ACTION_TYPES));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function nullableMetric(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, Number(value))) : null;
}

function nullableNonNegativeNumber(value, name) {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new RangeError(`${name} must be a finite non-negative number or null`);
  }
  return numeric;
}

/**
 * Boundary compatibility for the current classic fallback only. New strategy
 * sources must supply a structured action and must not rely on their label.
 */
export function strategyActionFromLegacyLabel(value) {
  const label = String(value || '');
  const normalized = label.toLowerCase();
  const amountMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*bb\b/);
  const potFractionMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?pot\b/);
  let type = null;

  if (/\b(?:all(?:[-\s]+in)?|jam)\b/.test(normalized)) type = ACTION_TYPES.ALL_IN;
  else if (/\bfold\b/.test(normalized)) type = ACTION_TYPES.FOLD;
  else if (/\bcheck\b/.test(normalized)) type = ACTION_TYPES.CHECK;
  else if (/\bcall\b/.test(normalized)) type = ACTION_TYPES.CALL;
  else if (/\bbet\b/.test(normalized) && !/\d\s*-?\s*bet\b/.test(normalized)) type = ACTION_TYPES.BET;
  else if (/\b(?:open|raise|3\s*-?\s*bet|4\s*-?\s*bet|5\s*-?\s*bet)\b/.test(normalized)) {
    type = ACTION_TYPES.RAISE;
  }

  if (!type) throw new RangeError(`Cannot derive a structured strategy action from label: ${label}`);
  return deepFreeze({
    type,
    amountBb: nullableNonNegativeNumber(amountMatch?.[1], 'action.amountBb'),
    potFraction: nullableNonNegativeNumber(
      potFractionMatch ? Number(potFractionMatch[1]) / 100 : null,
      'action.potFraction',
    ),
  });
}

function normalizeStructuredAction(action, label) {
  if (action === null || action === undefined) return strategyActionFromLegacyLabel(label);
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    throw new TypeError('Strategy action must be an object');
  }
  if (!ACTION_TYPE_VALUES.includes(action.type)) {
    throw new RangeError(`Unsupported strategy action type: ${action.type}`);
  }
  return deepFreeze({
    type: action.type,
    amountBb: nullableNonNegativeNumber(action.amountBb, 'action.amountBb'),
    potFraction: nullableNonNegativeNumber(action.potFraction, 'action.potFraction'),
  });
}

function defaultActionLabel(type) {
  if (type === ACTION_TYPES.ALL_IN) return 'All-in';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function normalizedActions(entries) {
  const prepared = (Array.isArray(entries) ? entries : []).map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError('StrategyResult actions must be objects');
    }
    const label = String(entry.label ?? entry.name ?? '');
    const action = normalizeStructuredAction(entry.action, label);
    const weight = Math.max(0, Number(entry.probability ?? entry.value) || 0);
    return {
      action,
      label: label || defaultActionLabel(action.type),
      weight,
      evBb: Number.isFinite(entry.evBb) ? Number(entry.evBb) : null,
    };
  }).filter((entry) => entry.weight > 0);

  const total = prepared.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return [];

  const normalized = prepared.map((entry) => ({
    action: entry.action,
    label: entry.label,
    probability: entry.weight / total,
    evBb: entry.evBb,
  }));
  // Close the distribution with an exact residual in array order. A positive
  // weight smaller than floating-point resolution can leave no representable
  // residual; in that case omit that zero-probability entry and absorb it into
  // the preceding action instead of violating the StrategyResult contract.
  while (normalized.length > 0) {
    const prefixTotal = normalized
      .slice(0, -1)
      .reduce((sum, entry) => sum + entry.probability, 0);
    const residual = 1 - prefixTotal;
    if (residual > 0) {
      normalized[normalized.length - 1].probability = residual;
      break;
    }
    normalized.pop();
  }
  return normalized;
}

export function createStrategyResult({
  source,
  actions = [],
  recommendedLabel = null,
  explanation = null,
  confidence = null,
  coverage = null,
  modelVersion = null,
  warnings = [],
  details = null,
} = {}) {
  if (!SOURCE_VALUES.includes(source)) {
    throw new TypeError(`Unsupported StrategyResult source: ${source}`);
  }

  const resultActions = normalizedActions(actions);
  if (source === STRATEGY_SOURCES.UNAVAILABLE && resultActions.length > 0) {
    throw new RangeError('Unavailable StrategyResult cannot contain actions');
  }
  if (source !== STRATEGY_SOURCES.UNAVAILABLE && resultActions.length === 0) {
    throw new RangeError('Available StrategyResult requires a positive-probability action');
  }

  const bestAction = resultActions.reduce(
    (best, entry) => (!best || entry.probability > best.probability ? entry : best),
    null,
  );
  return deepFreeze({
    schemaVersion: STRATEGY_RESULT_SCHEMA_VERSION,
    source,
    actions: resultActions,
    recommendation: bestAction ? {
      action: { ...bestAction.action },
      label: recommendedLabel ? String(recommendedLabel) : bestAction.label,
    } : null,
    explanation: explanation === null || explanation === undefined ? null : String(explanation),
    confidence: nullableMetric(confidence),
    coverage: nullableMetric(coverage),
    modelVersion: modelVersion === null || modelVersion === undefined ? null : String(modelVersion),
    warnings: Array.isArray(warnings) ? warnings.map(String) : [],
    details: details === undefined ? null : cloneData(details),
  });
}

export function createUnavailableStrategyResult(reason = null, details = null) {
  const message = reason === null || reason === undefined ? null : String(reason);
  return createStrategyResult({
    source: STRATEGY_SOURCES.UNAVAILABLE,
    actions: [],
    explanation: message,
    warnings: message ? [message] : [],
    details,
  });
}

export function isStrategyResultV1(result) {
  if (!result || result.schemaVersion !== STRATEGY_RESULT_SCHEMA_VERSION
    || !SOURCE_VALUES.includes(result.source) || !Array.isArray(result.actions)) return false;
  if (result.source === STRATEGY_SOURCES.UNAVAILABLE && result.actions.length !== 0) return false;
  if (result.source !== STRATEGY_SOURCES.UNAVAILABLE && result.actions.length === 0) return false;
  if (result.actions.some((entry) => (
    !entry || !ACTION_TYPE_VALUES.includes(entry.action?.type)
    || !Number.isFinite(entry.probability) || entry.probability <= 0 || entry.probability > 1
  ))) return false;
  const total = result.actions.reduce((sum, entry) => sum + entry.probability, 0);
  return result.actions.length === 0 || Math.abs(total - 1) <= STRATEGY_PROBABILITY_TOLERANCE;
}
