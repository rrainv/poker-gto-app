export const CONTEXT_COMPARISON_OUTCOMES = Object.freeze({
  EXACT: 'EXACT',
  USABLE_MAPPED: 'USABLE_MAPPED',
  DIRECTIONAL_ONLY: 'DIRECTIONAL_ONLY',
  INCOMPARABLE: 'INCOMPARABLE',
});

export const ACTION_PRECISION_LEVELS = Object.freeze({
  LEVEL_1: 'level_1_families',
  LEVEL_2: 'level_2_canonical_actions',
  LEVEL_3: 'level_3_exact_sizes',
});

export const DIAGNOSES = Object.freeze({
  EQUITY_CLOSE_STRATEGY_FAR: 'EQUITY_CLOSE_STRATEGY_FAR',
  EQUITY_FAR_STRATEGY_FAR: 'EQUITY_FAR_STRATEGY_FAR',
  EQUITY_FAR_STRATEGY_CLOSE: 'EQUITY_FAR_STRATEGY_CLOSE',
  EQUITY_CLOSE_STRATEGY_CLOSE: 'EQUITY_CLOSE_STRATEGY_CLOSE',
  EQUITY_UNAVAILABLE_STRATEGY_FAR: 'EQUITY_UNAVAILABLE_STRATEGY_FAR',
  EQUITY_UNAVAILABLE_STRATEGY_CLOSE: 'EQUITY_UNAVAILABLE_STRATEGY_CLOSE',
  ACTION_SUPPORT_MISMATCH: 'ACTION_SUPPORT_MISMATCH',
  CONTEXT_MISMATCH: 'CONTEXT_MISMATCH',
});

export const DIAGNOSTIC_THRESHOLDS = Object.freeze({
  strategyFarTvd: 0.25,
  equityCloseAbsoluteDelta: 0.03,
});

const LEVEL_1_KEYS = Object.freeze(['FOLD', 'PASSIVE_CONTINUE', 'AGGRESSION']);
const LEVEL_2_KEYS = Object.freeze(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
const AGGRESSIVE_TYPES = new Set(['bet', 'raise', 'all_in']);
const MAPPABLE_CONTEXT_FIELDS = Object.freeze([
  'stackDepthBb',
  'blinds',
  'actionTree',
  'availableActionSizes',
  'currentPotBb',
  'callAmountBb',
  'effectiveStackBb',
  'legalActionSizes',
]);

function rounded(value, digits = 12) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
  );
}

function equal(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
}

function canonicalSize(size) {
  if (!size) return null;
  return { basis: size.basis, value: Number(size.value) };
}

function canonicalActionList(actions, { includeSizes }) {
  return [...actions].map((action) => ({
    canonicalType: action.canonicalType,
    ...(includeSizes ? { size: canonicalSize(action.size) } : {}),
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function contextDimensions(assumptions) {
  return {
    gameType: assumptions.gameType,
    tableSize: assumptions.tableSize,
    positions: assumptions.positions,
    stackDepthBb: assumptions.stackDepthBb,
    blinds: assumptions.blinds,
    ante: assumptions.ante,
    rake: assumptions.rake,
    format: assumptions.format,
    actionTree: assumptions.actionTree,
    availableActionSizes: canonicalActionList(assumptions.availableActionSizes, {
      includeSizes: true,
    }),
    street: assumptions.street,
    board: assumptions.board,
    currentPotBb: assumptions.currentPotBb,
    callAmountBb: assumptions.callAmountBb,
    effectiveStackBb: assumptions.effectiveStackBb,
    legalActionFamilies: canonicalActionList(assumptions.legalActions, {
      includeSizes: false,
    }),
    legalActionSizes: canonicalActionList(assumptions.legalActions, {
      includeSizes: true,
    }),
  };
}

function unknownContextFields(assumptions) {
  const fields = [];
  if (assumptions.ante.kind === 'unknown') fields.push('ante');
  if (assumptions.rake.kind === 'unknown') fields.push('rake');
  if (assumptions.format === 'unknown') fields.push('format');
  if (assumptions.currentPotBb === null) fields.push('currentPotBb');
  if (assumptions.callAmountBb === null) fields.push('callAmountBb');
  if (assumptions.effectiveStackBb === null) fields.push('effectiveStackBb');
  return fields;
}

function pathParts(path) {
  return String(path).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
}

function valueAtPath(value, path) {
  return pathParts(path).reduce((current, part) => current?.[part], value);
}

function baseField(path) {
  return pathParts(path)[0] ?? '';
}

function verifiedMappingFor(discrepancy, mappings, riverlineDimensions, referenceDimensions) {
  return mappings.find((mapping) => {
    const mappingBase = baseField(mapping.field);
    if (mappingBase !== discrepancy.field) return false;
    return equal(mapping.riverlineValue, valueAtPath(riverlineDimensions, mapping.field))
      && equal(mapping.referenceValue, valueAtPath(referenceDimensions, mapping.field));
  }) ?? null;
}

export function evaluateContextMatch(node) {
  if (node.referenceCoverage !== 'supported') {
    return {
      outcome: CONTEXT_COMPARISON_OUTCOMES.INCOMPARABLE,
      declaredKind: node.contextMatch.kind,
      numericalStrategyAllowed: false,
      numericalEquityAllowed: false,
      discrepancies: [],
      unknownFields: [],
      mappings: clone(node.contextMatch.mappings),
      limitations: [node.coverageNote || 'The reference does not support this node.'],
    };
  }

  const referenceDimensions = contextDimensions(node.referenceContext);
  const riverlineDimensions = contextDimensions(node.riverline.gameAssumptions);
  const discrepancies = Object.keys(referenceDimensions).flatMap((field) => (
    equal(referenceDimensions[field], riverlineDimensions[field])
      ? []
      : [{
        field,
        riverlineValue: clone(riverlineDimensions[field]),
        referenceValue: clone(referenceDimensions[field]),
        mappable: MAPPABLE_CONTEXT_FIELDS.includes(field),
      }]
  ));
  const unknownFields = [...new Set([
    ...unknownContextFields(node.referenceContext),
    ...unknownContextFields(node.riverline.gameAssumptions),
  ])].sort();
  const verifiedMappings = discrepancies.map((discrepancy) => ({
    field: discrepancy.field,
    mapping: verifiedMappingFor(
      discrepancy,
      node.contextMatch.mappings,
      riverlineDimensions,
      referenceDimensions,
    ),
  }));
  const hasCriticalDiscrepancy = discrepancies.some((entry) => (
    !entry.mappable && !unknownFields.includes(entry.field)
  ));
  const everyDiscrepancyMapped = discrepancies.length > 0
    && discrepancies.every((entry) => entry.mappable)
    && verifiedMappings.every((entry) => entry.mapping !== null);

  let outcome;
  if (hasCriticalDiscrepancy) {
    outcome = CONTEXT_COMPARISON_OUTCOMES.INCOMPARABLE;
  } else if (unknownFields.length > 0) {
    outcome = CONTEXT_COMPARISON_OUTCOMES.DIRECTIONAL_ONLY;
  } else if (node.contextMatch.kind === 'exact' && discrepancies.length === 0) {
    outcome = CONTEXT_COMPARISON_OUTCOMES.EXACT;
  } else if (node.contextMatch.kind === 'mapped' && everyDiscrepancyMapped) {
    outcome = CONTEXT_COMPARISON_OUTCOMES.USABLE_MAPPED;
  } else if (node.contextMatch.kind === 'approximate' || node.contextMatch.kind === 'unknown') {
    outcome = CONTEXT_COMPARISON_OUTCOMES.DIRECTIONAL_ONLY;
  } else if (node.contextMatch.kind === 'exact' && discrepancies.length > 0) {
    outcome = CONTEXT_COMPARISON_OUTCOMES.INCOMPARABLE;
  } else {
    outcome = CONTEXT_COMPARISON_OUTCOMES.DIRECTIONAL_ONLY;
  }

  const limitations = [];
  if (unknownFields.length > 0) limitations.push(`Unknown context facts: ${unknownFields.join(', ')}`);
  for (const discrepancy of discrepancies) {
    const mapping = verifiedMappings.find((entry) => entry.field === discrepancy.field)?.mapping;
    limitations.push(mapping
      ? `${mapping.field}: ${mapping.note}`
      : `Unresolved context discrepancy: ${discrepancy.field}`);
  }
  if (node.contextMatch.note) limitations.push(node.contextMatch.note);

  return {
    outcome,
    declaredKind: node.contextMatch.kind,
    numericalStrategyAllowed: [
      CONTEXT_COMPARISON_OUTCOMES.EXACT,
      CONTEXT_COMPARISON_OUTCOMES.USABLE_MAPPED,
    ].includes(outcome),
    numericalEquityAllowed: outcome === CONTEXT_COMPARISON_OUTCOMES.EXACT,
    discrepancies,
    unknownFields,
    mappings: clone(node.contextMatch.mappings),
    limitations,
  };
}

function level1Key(type) {
  if (type === 'fold') return 'FOLD';
  if (type === 'check' || type === 'call') return 'PASSIVE_CONTINUE';
  return 'AGGRESSION';
}

function level2Key(type) {
  return type.toUpperCase();
}

function sizeKey(type, size) {
  if (!AGGRESSIVE_TYPES.has(type)) return level2Key(type);
  if (!size) return null;
  return `${level2Key(type)}@${size.basis}:${rounded(Number(size.value), 6)}`;
}

function emptyVector(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function closeVector(vector) {
  const keys = Object.keys(vector).sort();
  const closingKey = [...keys].reverse().find((key) => vector[key] > 0);
  const roundedVector = Object.fromEntries(keys.map((key) => [key, rounded(vector[key])]));
  if (closingKey) {
    const prefix = keys
      .filter((key) => key !== closingKey)
      .reduce((sum, key) => sum + roundedVector[key], 0);
    roundedVector[closingKey] = rounded(1 - prefix);
  }
  return roundedVector;
}

function projectWeightedActions(actions, level) {
  const fixedKeys = level === ACTION_PRECISION_LEVELS.LEVEL_1
    ? LEVEL_1_KEYS
    : level === ACTION_PRECISION_LEVELS.LEVEL_2
      ? LEVEL_2_KEYS
      : [];
  const vector = emptyVector(fixedKeys);
  const total = actions.reduce((sum, action) => sum + action.weight, 0);
  if (!(total > 0)) throw new RangeError('Action projection requires positive mass');
  const missingSizes = [];
  for (const action of actions) {
    let key;
    if (level === ACTION_PRECISION_LEVELS.LEVEL_1) key = level1Key(action.type);
    else if (level === ACTION_PRECISION_LEVELS.LEVEL_2) key = level2Key(action.type);
    else key = sizeKey(action.type, action.size);
    if (key === null) {
      missingSizes.push(action.type);
      continue;
    }
    vector[key] = (vector[key] || 0) + action.weight / total;
  }
  return {
    available: missingSizes.length === 0,
    vector: missingSizes.length === 0 ? closeVector(vector) : null,
    inputTotal: rounded(total),
    normalizationFactor: rounded(1 / total),
    missingSizes: [...new Set(missingSizes)].sort(),
  };
}

export function projectReferenceActions(reference, level) {
  const scale = reference.frequencyUnit === 'percent' ? 0.01 : 1;
  const projection = projectWeightedActions(reference.rawActions.map((action) => ({
    type: action.canonicalType,
    size: action.size,
    weight: action.frequency * scale,
  })), level);
  const rawTotal = reference.rawActions.reduce((sum, action) => sum + action.frequency, 0);
  return {
    ...projection,
    inputTotal: rounded(rawTotal),
    normalizationFactor: rounded(1 / rawTotal),
  };
}

function strategyResultSize(action) {
  if (Number.isFinite(action.amountBb)) {
    return { basis: 'amount_to_bb', value: Number(action.amountBb) };
  }
  if (Number.isFinite(action.potFraction)) {
    return { basis: 'pot_fraction', value: Number(action.potFraction) };
  }
  return null;
}

export function projectRiverlineActions(actions, level) {
  return projectWeightedActions(actions.map((entry) => ({
    type: entry.action.type,
    size: strategyResultSize(entry.action),
    weight: entry.probability,
  })), level);
}

function dominant(vector) {
  return Object.entries(vector).sort((left, right) => (
    right[1] - left[1] || left[0].localeCompare(right[0])
  ))[0]?.[0] ?? null;
}

export function calculateStrategyMetrics(riverline, reference) {
  const keys = [...new Set([...Object.keys(riverline), ...Object.keys(reference)])].sort();
  const absoluteFrequencyDelta = Object.fromEntries(keys.map((key) => [
    key,
    rounded(Math.abs((riverline[key] || 0) - (reference[key] || 0))),
  ]));
  const signedFrequencyDelta = Object.fromEntries(keys.map((key) => [
    key,
    rounded((riverline[key] || 0) - (reference[key] || 0)),
  ]));
  const referenceDominantAction = dominant(reference);
  const riverlineDominantAction = dominant(riverline);
  const familyMass = (vector, family) => Object.entries(vector).reduce((sum, [key, value]) => {
    if (family === 'fold') return sum + (key === 'FOLD' ? value : 0);
    if (family === 'passive') {
      return sum + (['PASSIVE_CONTINUE', 'CHECK', 'CALL'].includes(key) ? value : 0);
    }
    return sum + (key === 'AGGRESSION'
      || key === 'BET' || key === 'RAISE' || key === 'ALL_IN'
      || key.startsWith('BET@') || key.startsWith('RAISE@') || key.startsWith('ALL_IN@')
      ? value
      : 0);
  }, 0);
  const riverlineFold = familyMass(riverline, 'fold');
  const referenceFold = familyMass(reference, 'fold');
  const tvd = rounded(0.5 * Object.values(absoluteFrequencyDelta)
    .reduce((sum, value) => sum + value, 0));
  return {
    totalVariationDistance: tvd,
    dominantActionAgreement: referenceDominantAction === riverlineDominantAction,
    dominantActionDelta: rounded(absoluteFrequencyDelta[referenceDominantAction] || 0),
    referenceDominantAction,
    riverlineDominantAction,
    foldBias: rounded(riverlineFold - referenceFold),
    passiveBias: rounded(familyMass(riverline, 'passive') - familyMass(reference, 'passive')),
    aggressionBias: rounded(
      familyMass(riverline, 'aggression') - familyMass(reference, 'aggression'),
    ),
    continuationBias: rounded((1 - riverlineFold) - (1 - referenceFold)),
    absoluteFrequencyDelta,
    signedFrequencyDelta,
    maximumActionDelta: rounded(Math.max(...Object.values(absoluteFrequencyDelta))),
  };
}

export function compareStrategyActions(reference, riverlineActions, contextGate) {
  const result = {};
  for (const level of Object.values(ACTION_PRECISION_LEVELS)) {
    const referenceProjection = projectReferenceActions(reference, level);
    const riverlineProjection = projectRiverlineActions(riverlineActions, level);
    const level3 = level === ACTION_PRECISION_LEVELS.LEVEL_3;
    const precisionAllowed = !level3
      || (contextGate.outcome === CONTEXT_COMPARISON_OUTCOMES.EXACT
        && referenceProjection.available
        && riverlineProjection.available);
    const numericalAllowed = contextGate.numericalStrategyAllowed && precisionAllowed;
    result[level] = {
      reference: referenceProjection.vector,
      riverline: riverlineProjection.vector,
      frequencyNormalization: {
        referenceInputTotal: referenceProjection.inputTotal,
        referenceFactor: referenceProjection.normalizationFactor,
        riverlineInputTotal: riverlineProjection.inputTotal,
        riverlineFactor: riverlineProjection.normalizationFactor,
      },
      comparable: numericalAllowed,
      blockedReason: numericalAllowed
        ? null
        : !contextGate.numericalStrategyAllowed
          ? `context_${contextGate.outcome.toLowerCase()}`
          : contextGate.outcome !== CONTEXT_COMPARISON_OUTCOMES.EXACT
            ? 'exact_sizing_requires_exact_context'
            : `missing_exact_sizes:${[
              ...referenceProjection.missingSizes,
              ...riverlineProjection.missingSizes,
            ].join(',')}`,
      metrics: numericalAllowed
        ? calculateStrategyMetrics(riverlineProjection.vector, referenceProjection.vector)
        : null,
    };
    if (level3) {
      result[level].sizingDistributionDistance = result[level].metrics
        ?.totalVariationDistance ?? null;
    }
  }
  return result;
}

export function detectActionSupportMismatch(reference, riverlineActions, riverlineAssumptions) {
  const referenceTypes = new Set(reference.rawActions
    .filter((action) => action.frequency > 0)
    .map((action) => action.canonicalType));
  const legalTypes = new Set(riverlineAssumptions.legalActions.map((action) => action.canonicalType));
  const unsupportedTypes = [...referenceTypes].filter((type) => !legalTypes.has(type)).sort();
  const unsizedRiverlineTypes = new Set(riverlineActions
    .filter((entry) => entry.probability > 0
      && AGGRESSIVE_TYPES.has(entry.action.type)
      && strategyResultSize(entry.action) === null)
    .map((entry) => entry.action.type));
  const unsupportedSizingTypes = [...new Set(reference.rawActions
    .filter((action) => action.frequency > 0
      && action.size
      && unsizedRiverlineTypes.has(action.canonicalType))
    .map((action) => action.canonicalType))].sort();
  return {
    detected: unsupportedTypes.length > 0 || unsupportedSizingTypes.length > 0,
    unsupportedActionTypes: unsupportedTypes,
    unsupportedSizingTypes,
  };
}

export function compareEquity(referenceEquity, riverlineEquity, contextGate) {
  if (!referenceEquity || !riverlineEquity || !Number.isFinite(riverlineEquity.value)) {
    return {
      comparable: false,
      reason: !referenceEquity
        ? 'reference_equity_unavailable'
        : !riverlineEquity || !Number.isFinite(riverlineEquity.value)
          ? 'riverline_equity_unavailable'
          : 'equity_unavailable',
      reference: referenceEquity ? clone(referenceEquity) : null,
      riverline: riverlineEquity ? clone(riverlineEquity) : null,
      absoluteDelta: null,
      signedDelta: null,
    };
  }
  if (!contextGate.numericalEquityAllowed) {
    return {
      comparable: false,
      reason: 'equity_requires_exact_context',
      reference: clone(referenceEquity),
      riverline: clone(riverlineEquity),
      absoluteDelta: null,
      signedDelta: null,
    };
  }
  if (!equal(referenceEquity.semantics, riverlineEquity.semantics)) {
    return {
      comparable: false,
      reason: 'equity_semantics_mismatch',
      reference: clone(referenceEquity),
      riverline: clone(riverlineEquity),
      absoluteDelta: null,
      signedDelta: null,
    };
  }
  const signedDelta = rounded(riverlineEquity.value - referenceEquity.value);
  return {
    comparable: true,
    reason: null,
    reference: clone(referenceEquity),
    riverline: clone(riverlineEquity),
    absoluteDelta: rounded(Math.abs(signedDelta)),
    signedDelta,
  };
}

function percentile(values, probability) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(probability * sorted.length) - 1;
  return rounded(sorted[Math.max(0, index)]);
}

function average(values) {
  if (values.length === 0) return null;
  return rounded(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function weightedAverage(rows, selector) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!(total > 0)) return null;
  return rounded(rows.reduce((sum, row) => sum + selector(row) * row.weight, 0) / total);
}

function weightedPercentile(rows, selector, probability) {
  const positive = rows.filter((row) => row.weight > 0)
    .sort((left, right) => selector(left) - selector(right));
  const total = positive.reduce((sum, row) => sum + row.weight, 0);
  if (!(total > 0)) return null;
  const threshold = total * probability;
  let cumulative = 0;
  for (const row of positive) {
    cumulative += row.weight;
    if (cumulative >= threshold) return rounded(selector(row));
  }
  return rounded(selector(positive[positive.length - 1]));
}

export function aggregateBenchmarkRows(rows) {
  const comparable = rows.filter((row) => row.strategy
    ?.[ACTION_PRECISION_LEVELS.LEVEL_1]?.metrics);
  const equityComparable = rows.filter((row) => row.equity?.comparable);
  const tvds = comparable.map((row) => (
    row.strategy[ACTION_PRECISION_LEVELS.LEVEL_1].metrics.totalVariationDistance
  ));
  const weightedRows = comparable
    .filter((row) => Number.isFinite(row.hand.rangeWeight) && row.hand.rangeWeight > 0)
    .map((row) => ({
      row,
      weight: row.hand.rangeWeight,
      metrics: row.strategy[ACTION_PRECISION_LEVELS.LEVEL_1].metrics,
    }));
  return {
    observationCount: rows.length,
    strategyComparableCount: comparable.length,
    strategy: comparable.length === 0 ? null : {
      meanTvd: average(tvds),
      medianTvd: percentile(tvds, 0.5),
      p90Tvd: percentile(tvds, 0.9),
      p95Tvd: percentile(tvds, 0.95),
      dominantActionAgreementRate: average(comparable.map((row) => (
        row.strategy[ACTION_PRECISION_LEVELS.LEVEL_1].metrics.dominantActionAgreement ? 1 : 0
      ))),
      aggressionBias: average(comparable.map((row) => (
        row.strategy[ACTION_PRECISION_LEVELS.LEVEL_1].metrics.aggressionBias
      ))),
      continuationBias: average(comparable.map((row) => (
        row.strategy[ACTION_PRECISION_LEVELS.LEVEL_1].metrics.continuationBias
      ))),
      weighted: weightedRows.length === 0 ? null : {
        rowCount: weightedRows.length,
        totalReferenceRangeWeight: rounded(weightedRows.reduce(
          (sum, row) => sum + row.weight,
          0,
        )),
        meanTvd: weightedAverage(weightedRows, (row) => row.metrics.totalVariationDistance),
        medianTvd: weightedPercentile(
          weightedRows,
          (row) => row.metrics.totalVariationDistance,
          0.5,
        ),
        p90Tvd: weightedPercentile(
          weightedRows,
          (row) => row.metrics.totalVariationDistance,
          0.9,
        ),
        p95Tvd: weightedPercentile(
          weightedRows,
          (row) => row.metrics.totalVariationDistance,
          0.95,
        ),
        dominantActionAgreementRate: weightedAverage(
          weightedRows,
          (row) => (row.metrics.dominantActionAgreement ? 1 : 0),
        ),
        aggressionBias: weightedAverage(weightedRows, (row) => row.metrics.aggressionBias),
        continuationBias: weightedAverage(weightedRows, (row) => row.metrics.continuationBias),
      },
    },
    equity: equityComparable.length === 0 ? null : {
      comparableCount: equityComparable.length,
      meanAbsoluteDelta: average(equityComparable.map((row) => row.equity.absoluteDelta)),
      medianAbsoluteDelta: percentile(
        equityComparable.map((row) => row.equity.absoluteDelta),
        0.5,
      ),
      p95AbsoluteDelta: percentile(
        equityComparable.map((row) => row.equity.absoluteDelta),
        0.95,
      ),
      systematicDirectionalBias: average(equityComparable.map((row) => (
        row.equity.signedDelta
      ))),
    },
  };
}

export function classifyDiagnosis({ contextGate, strategy, equity, actionSupport }) {
  if (![CONTEXT_COMPARISON_OUTCOMES.EXACT, CONTEXT_COMPARISON_OUTCOMES.USABLE_MAPPED]
    .includes(contextGate.outcome)) {
    return {
      primary: DIAGNOSES.CONTEXT_MISMATCH,
      interpretation: 'The contexts are not sufficiently comparable for a numerical strategy error.',
      proof: false,
    };
  }
  if (actionSupport.detected) {
    return {
      primary: DIAGNOSES.ACTION_SUPPORT_MISMATCH,
      interpretation: 'The reference uses an action or sizing precision Riverline does not represent at this node.',
      proof: false,
    };
  }
  const tvd = strategy[ACTION_PRECISION_LEVELS.LEVEL_1].metrics
    ?.totalVariationDistance ?? null;
  const strategyFar = tvd !== null && tvd >= DIAGNOSTIC_THRESHOLDS.strategyFarTvd;
  if (!equity.comparable) {
    return {
      primary: strategyFar
        ? DIAGNOSES.EQUITY_UNAVAILABLE_STRATEGY_FAR
        : DIAGNOSES.EQUITY_UNAVAILABLE_STRATEGY_CLOSE,
      interpretation: strategyFar
        ? 'Strategy differs materially, but equity cannot isolate an upstream or downstream layer.'
        : 'Strategy is close at the selected projection; comparable equity evidence is unavailable.',
      proof: false,
    };
  }
  const equityClose = equity.absoluteDelta <= DIAGNOSTIC_THRESHOLDS.equityCloseAbsoluteDelta;
  const primary = equityClose
    ? strategyFar
      ? DIAGNOSES.EQUITY_CLOSE_STRATEGY_FAR
      : DIAGNOSES.EQUITY_CLOSE_STRATEGY_CLOSE
    : strategyFar
      ? DIAGNOSES.EQUITY_FAR_STRATEGY_FAR
      : DIAGNOSES.EQUITY_FAR_STRATEGY_CLOSE;
  const interpretations = {
    [DIAGNOSES.EQUITY_CLOSE_STRATEGY_FAR]:
      'Policy or equity-to-strategy transformation is a likely investigation target.',
    [DIAGNOSES.EQUITY_CLOSE_STRATEGY_CLOSE]:
      'Both quantities are close at this projection; broaden the sample before drawing conclusions.',
    [DIAGNOSES.EQUITY_FAR_STRATEGY_FAR]:
      'Range construction, sampling, or evaluation may be an upstream source of strategy disagreement.',
    [DIAGNOSES.EQUITY_FAR_STRATEGY_CLOSE]:
      'The close strategy may be compensating for an upstream equity or range-assumption difference.',
  };
  return { primary, interpretation: interpretations[primary], proof: false };
}
