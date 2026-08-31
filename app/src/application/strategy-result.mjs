import { ACTION_TYPES } from '../../../shared/poker-domain/index.js';
import {
  STRATEGY_CONTEXT_COVERAGE_SCHEMA_VERSION,
  STRATEGY_RESULT_CAPABILITIES_SCHEMA_VERSION,
  STRATEGY_SOURCE_DESCRIPTOR_SCHEMA_VERSION,
  STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES,
  STRATEGY_COVERAGE_KINDS,
  STRATEGY_GRADING_CAPABILITIES,
  STRATEGY_EXACT_DISTRIBUTION_TOLERANCE,
  bindLiveStrategyResultAcceptance,
  builtInStrategySourceAcceptanceFor,
  deriveStrategyResultCapabilities,
  isTrustedStrategySourceAcceptance,
  normalizeStrategyContextCoverage,
  strategySourceAuthoritySnapshotFor,
  strategySourceDescriptorFor,
} from './strategy-source-authority.mjs';

export const STRATEGY_RESULT_SCHEMA_VERSION = 'strategy-result/v1';

export const STRATEGY_SOURCES = Object.freeze({
  HEURISTIC_PREFLOP: 'heuristic_preflop',
  HEURISTIC_POSTFLOP: 'heuristic_postflop',
  EQUITY_FALLBACK: 'equity_fallback',
  UNAVAILABLE: 'unavailable',
});

export const STRATEGY_ACTION_TYPES = Object.freeze({ ...ACTION_TYPES });

export const STRATEGY_PROBABILITY_TOLERANCE = STRATEGY_EXACT_DISTRIBUTION_TOLERANCE;

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

function normalizedActions(entries, { strict = false } = {}) {
  const prepared = (Array.isArray(entries) ? entries : []).map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError('StrategyResult actions must be objects');
    }
    const label = String(entry.label ?? entry.name ?? '');
    const action = normalizeStructuredAction(entry.action, label);
    const rawProbability = entry.probability ?? entry.value;
    const rawWeight = Number(rawProbability);
    if (strict && (typeof rawProbability !== 'number'
      || !Number.isFinite(rawWeight) || rawWeight < 0 || rawWeight > 1)) {
      throw new RangeError('Exact/normative strategy probabilities must be finite values from 0 to 1');
    }
    const weight = strict ? rawWeight : Math.max(0, rawWeight || 0);
    return {
      action,
      label: label || defaultActionLabel(action.type),
      weight,
      evBb: Number.isFinite(entry.evBb) ? Number(entry.evBb) : null,
    };
  }).filter((entry) => entry.weight > 0);

  const total = prepared.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return [];

  if (strict) {
    if (Math.abs(total - 1) > STRATEGY_PROBABILITY_TOLERANCE) {
      throw new RangeError(`Exact/normative strategy probability mass must equal 1; received ${total}`);
    }
    return prepared.map((entry) => ({
      action: entry.action,
      label: entry.label,
      probability: entry.weight,
      evBb: entry.evBb,
    }));
  }

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
  sourceDescriptor = null,
  sourceAcceptance = null,
  sourceVersion = null,
  provenance = null,
  contextCoverage = null,
  actions = [],
  recommendedLabel = null,
  explanation = null,
  confidence = null,
  coverage = null,
  modelVersion = null,
  warnings = [],
  details = null,
} = {}) {
  const descriptor = strategySourceDescriptorFor(source, sourceDescriptor);
  if (!descriptor) {
    throw new TypeError(`Unsupported StrategyResult source: ${source}`);
  }
  const resolvedSourceVersion = sourceVersion === null || sourceVersion === undefined
    ? descriptor.version
    : String(sourceVersion);
  if (resolvedSourceVersion !== descriptor.version) {
    throw new RangeError('StrategyResult sourceVersion must match its source descriptor');
  }

  const builtInAcceptance = builtInStrategySourceAcceptanceFor(descriptor);
  const acceptedFingerprint = provenance?.contentHash ?? null;
  const acceptedSource = isTrustedStrategySourceAcceptance(
    sourceAcceptance,
    descriptor,
    acceptedFingerprint,
  ) ? sourceAcceptance : builtInAcceptance;
  const strictDistribution = acceptedSource !== null
    && (acceptedSource.acceptedCapabilities.actionDistribution
      === STRATEGY_ACTION_DISTRIBUTION_CAPABILITIES.EXACT
      || acceptedSource.acceptedCapabilities.grading
        === STRATEGY_GRADING_CAPABILITIES.NORMATIVE);
  const resultActions = normalizedActions(actions, { strict: strictDistribution });
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
  const resolvedContextCoverage = normalizeStrategyContextCoverage(
    contextCoverage,
    descriptor,
  );
  if (source === STRATEGY_SOURCES.UNAVAILABLE
    && resolvedContextCoverage.kind !== STRATEGY_COVERAGE_KINDS.UNSUPPORTED) {
    throw new RangeError('Unavailable StrategyResult must have unsupported context coverage');
  }
  const result = deepFreeze({
    schemaVersion: STRATEGY_RESULT_SCHEMA_VERSION,
    source,
    sourceDescriptor: descriptor,
    sourceAuthoritySnapshot: strategySourceAuthoritySnapshotFor(
      acceptedSource,
      descriptor,
      acceptedFingerprint,
    ),
    sourceVersion: resolvedSourceVersion,
    provenance: provenance === undefined || provenance === null ? null : cloneData(provenance),
    contextCoverage: resolvedContextCoverage,
    capabilities: deriveStrategyResultCapabilities(descriptor, resultActions),
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
  return bindLiveStrategyResultAcceptance(
    result,
    acceptedSource,
    descriptor,
    acceptedFingerprint,
  );
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
    || !Array.isArray(result.actions)) return false;
  let descriptor;
  try {
    descriptor = strategySourceDescriptorFor(result.source, result.sourceDescriptor ?? null);
  } catch {
    return false;
  }
  if (!descriptor) return false;
  if (result.sourceDescriptor !== undefined
    && result.sourceDescriptor?.schemaVersion !== STRATEGY_SOURCE_DESCRIPTOR_SCHEMA_VERSION) return false;
  if (result.sourceVersion !== undefined && result.sourceVersion !== descriptor.version) return false;
  if (result.contextCoverage !== undefined
    && result.contextCoverage?.schemaVersion !== STRATEGY_CONTEXT_COVERAGE_SCHEMA_VERSION) return false;
  if (result.capabilities !== undefined
    && result.capabilities?.schemaVersion !== STRATEGY_RESULT_CAPABILITIES_SCHEMA_VERSION) return false;
  if (result.source === STRATEGY_SOURCES.UNAVAILABLE && result.actions.length !== 0) return false;
  if (result.source !== STRATEGY_SOURCES.UNAVAILABLE && result.actions.length === 0) return false;
  if (result.actions.some((entry) => (
    !entry || !ACTION_TYPE_VALUES.includes(entry.action?.type)
    || !Number.isFinite(entry.probability) || entry.probability <= 0 || entry.probability > 1
  ))) return false;
  const total = result.actions.reduce((sum, entry) => sum + entry.probability, 0);
  return result.actions.length === 0 || Math.abs(total - 1) <= STRATEGY_PROBABILITY_TOLERANCE;
}
