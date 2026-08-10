export const DECISION_CONTEXT_V1_FIELDS = Object.freeze([
  'schemaVersion',
  'tableSize',
  'heroPosition',
  'street',
  'heroCards',
  'board',
  'deadCards',
  'stackBb',
  'stackMode',
  'potBb',
  'lastAction',
  'facingSizeBb',
  'rakeMode',
  'forcedContributionPerPlayerBb',
  'totalForcedContributionBb',
  'legacyRakePercent',
]);

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function valuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => valuesEqual(value, right[index]));
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key) => (
        Object.hasOwn(right, key) && valuesEqual(left[key], right[key])
      ));
  }
  return false;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function compareDecisionContexts(legacyContext, canonicalContext) {
  if (!legacyContext || typeof legacyContext !== 'object' || Array.isArray(legacyContext)
    || !canonicalContext || typeof canonicalContext !== 'object'
    || Array.isArray(canonicalContext)) {
    throw new TypeError('DecisionContext comparison requires two context objects');
  }

  const mismatches = [];
  for (const field of DECISION_CONTEXT_V1_FIELDS) {
    if (!valuesEqual(legacyContext[field], canonicalContext[field])) {
      mismatches.push({
        field,
        legacyValue: cloneValue(legacyContext[field]),
        canonicalValue: cloneValue(canonicalContext[field]),
      });
    }
  }
  return deepFreeze({ matches: mismatches.length === 0, mismatches });
}
