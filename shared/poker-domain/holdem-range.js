import {
  assertCardArray,
  assertUniqueKnownCards,
} from './cards.js';
import { deepFreeze } from './freeze.js';
import {
  HOLDEM_COMBOS,
  assertHoldemComboId,
  compareHoldemCards,
  getHoldemComboById,
  getHoldemCombosForHandClass,
} from './holdem-combos.js';
import {
  PREFLOP_HAND_CLASSES,
  isPreflopHandClass,
} from './hand-class.js';

export const HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION = 'holdem-weighted-range/v1';
export const HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION = 'holdem-range-provenance/v1';
export const HOLDEM_RANGE_INSPECTION_SCHEMA_VERSION = 'holdem-range-inspection/v1';
export const HOLDEM_CONDITIONED_RANGE_SCHEMA_VERSION = 'holdem-conditioned-range/v1';
export const HOLDEM_COMBO_DISTRIBUTION_SCHEMA_VERSION = 'holdem-combo-distribution/v1';
export const HOLDEM_RANGE_MATRIX_PROJECTION_SCHEMA_VERSION = 'holdem-range-matrix-projection/v1';
export const HOLDEM_RANGE_GAME = 'holdem';

export const HOLDEM_RANGE_ENTRY_STATES = Object.freeze({
  KNOWN: 'known',
  UNKNOWN: 'unknown',
});

export const HOLDEM_RANGE_UNLISTED_POLICIES = Object.freeze({
  UNKNOWN: 'unknown',
  KNOWN_ZERO: 'known_zero',
});

export const HOLDEM_RANGE_PROVENANCE_KINDS = Object.freeze({
  MANUAL: 'manual',
  IMPORTED: 'imported',
  PERSONAL_DIRECT: 'personal_direct',
  PERSONAL_INFERRED: 'personal_inferred',
  STRATEGY_PROVIDER: 'strategy_provider',
  SOLVER_REFERENCE: 'solver_reference',
  DERIVED_FILTER: 'derived_filter',
  EXTERNAL: 'external',
});

const RANGE_KEYS = Object.freeze(['schemaVersion', 'game', 'rangeId', 'provenance', 'entries']);
const PROVENANCE_KEYS = Object.freeze(['schemaVersion', 'sources']);
const PROVENANCE_SOURCE_KEYS = Object.freeze([
  'id',
  'kind',
  'sourceId',
  'sourceSchemaVersion',
  'createdAt',
  'parentRangeId',
  'operation',
]);
const KNOWN_ENTRY_KEYS = Object.freeze(['comboId', 'state', 'weight', 'provenanceId']);
const UNKNOWN_ENTRY_KEYS = Object.freeze(['comboId', 'state', 'provenanceId']);
const PROVENANCE_KIND_PATTERN = /^[a-z][a-z0-9_.-]*$/;

function compareStableStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function nullableString(value, label) {
  if (value === null) return null;
  return requireString(value, label);
}

function normalizeTimestamp(value, label) {
  if (value === null) return null;
  requireString(value, label);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be an ISO timestamp or null`);
  return new Date(milliseconds).toISOString();
}

function requireCanonicalTimestamp(value, label) {
  const normalized = normalizeTimestamp(value, label);
  if (normalized !== value) throw new RangeError(`${label} must use canonical ISO formatting`);
  return value;
}

function requireNullableProvenanceId(value, sourceIds, label = 'provenanceId') {
  if (value === null) return null;
  requireString(value, label);
  if (!sourceIds.has(value)) throw new RangeError(`${label} must reference range provenance`);
  return value;
}

function requireWeight(value, label = 'weight') {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be finite and within [0, 1]`);
  }
  return value;
}

function sumWeights(entries) {
  let sum = 0;
  let correction = 0;
  for (const entry of entries) {
    if (entry.state !== HOLDEM_RANGE_ENTRY_STATES.KNOWN) continue;
    const adjusted = entry.weight - correction;
    const next = sum + adjusted;
    correction = (next - sum) - adjusted;
    sum = next;
  }
  return sum;
}

function coverageFacts(entries) {
  const knownCombos = entries.filter((entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN).length;
  const unknownCombos = entries.length - knownCombos;
  const totalKnownWeight = sumWeights(entries);
  return {
    totalCombos: entries.length,
    knownCombos,
    unknownCombos,
    knownZeroCombos: entries.filter(
      (entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN && entry.weight === 0,
    ).length,
    positiveWeightCombos: entries.filter(
      (entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN && entry.weight > 0,
    ).length,
    coverageRatio: entries.length === 0 ? 1 : knownCombos / entries.length,
    totalKnownWeight,
    complete: unknownCombos === 0,
    fullyUnknown: entries.length > 0 && knownCombos === 0,
    emptyComplete: unknownCombos === 0 && totalKnownWeight === 0,
  };
}

export function createHoldemRangeProvenanceSource({
  id,
  kind,
  sourceId = null,
  sourceSchemaVersion = null,
  createdAt = null,
  parentRangeId = null,
  operation = null,
} = {}) {
  const source = {
    id: requireString(id, 'provenance source id'),
    kind: requireString(kind, 'provenance source kind'),
    sourceId: nullableString(sourceId, 'provenance source sourceId'),
    sourceSchemaVersion: nullableString(
      sourceSchemaVersion,
      'provenance source sourceSchemaVersion',
    ),
    createdAt: normalizeTimestamp(createdAt, 'provenance source createdAt'),
    parentRangeId: nullableString(parentRangeId, 'provenance source parentRangeId'),
    operation: nullableString(operation, 'provenance source operation'),
  };
  validateHoldemRangeProvenanceSource(source);
  return deepFreeze(source);
}

export function validateHoldemRangeProvenanceSource(source) {
  requirePlainObject(source, 'Holdem range provenance source');
  requireExactKeys(source, PROVENANCE_SOURCE_KEYS, 'Holdem range provenance source');
  requireString(source.id, 'provenance source id');
  requireString(source.kind, 'provenance source kind');
  if (!PROVENANCE_KIND_PATTERN.test(source.kind)) {
    throw new RangeError('provenance source kind must be a lowercase extensible discriminator');
  }
  nullableString(source.sourceId, 'provenance source sourceId');
  nullableString(source.sourceSchemaVersion, 'provenance source sourceSchemaVersion');
  requireCanonicalTimestamp(source.createdAt, 'provenance source createdAt');
  nullableString(source.parentRangeId, 'provenance source parentRangeId');
  nullableString(source.operation, 'provenance source operation');
  return source;
}

function normalizeProvenanceSources(sources) {
  if (!Array.isArray(sources)) throw new TypeError('provenanceSources must be an array');
  const normalized = sources.map((source) => createHoldemRangeProvenanceSource(source));
  if (new Set(normalized.map((source) => source.id)).size !== normalized.length) {
    throw new RangeError('Holdem range provenance source IDs must be unique');
  }
  return normalized.sort((left, right) => compareStableStrings(left.id, right.id));
}

function validateProvenance(provenance) {
  requirePlainObject(provenance, 'Holdem range provenance');
  requireExactKeys(provenance, PROVENANCE_KEYS, 'Holdem range provenance');
  if (provenance.schemaVersion !== HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(provenance.sources)) throw new TypeError('provenance.sources must be an array');
  const ids = new Set();
  let priorId = null;
  for (const source of provenance.sources) {
    validateHoldemRangeProvenanceSource(source);
    if (ids.has(source.id)) throw new RangeError('Holdem range provenance source IDs must be unique');
    if (priorId !== null && compareStableStrings(priorId, source.id) >= 0) {
      throw new RangeError('Holdem range provenance sources must use deterministic ID order');
    }
    ids.add(source.id);
    priorId = source.id;
  }
  return ids;
}

function normalizedEntry(rawEntry) {
  requirePlainObject(rawEntry, 'Holdem range entry');
  const comboId = assertHoldemComboId(rawEntry.comboId);
  const provenanceId = rawEntry.provenanceId === undefined ? null : rawEntry.provenanceId;
  if (rawEntry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN) {
    if (!Object.hasOwn(rawEntry, 'weight')) throw new RangeError('A known combo entry requires weight');
    return {
      comboId,
      state: HOLDEM_RANGE_ENTRY_STATES.KNOWN,
      weight: requireWeight(rawEntry.weight),
      provenanceId,
    };
  }
  if (rawEntry.state === HOLDEM_RANGE_ENTRY_STATES.UNKNOWN) {
    if (Object.hasOwn(rawEntry, 'weight')) throw new RangeError('An unknown combo entry must not assert weight');
    return {
      comboId,
      state: HOLDEM_RANGE_ENTRY_STATES.UNKNOWN,
      provenanceId,
    };
  }
  throw new RangeError('Holdem range entry state must be known or unknown');
}

function validateRangeEntry(entry, sourceIds, label) {
  requirePlainObject(entry, label);
  if (entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN) {
    requireExactKeys(entry, KNOWN_ENTRY_KEYS, label);
    requireWeight(entry.weight, `${label}.weight`);
  } else if (entry.state === HOLDEM_RANGE_ENTRY_STATES.UNKNOWN) {
    requireExactKeys(entry, UNKNOWN_ENTRY_KEYS, label);
  } else {
    throw new RangeError(`${label}.state must be known or unknown`);
  }
  assertHoldemComboId(entry.comboId, `${label}.comboId`);
  requireNullableProvenanceId(entry.provenanceId, sourceIds, `${label}.provenanceId`);
  return entry;
}

function requireRangeId(rangeId) {
  return rangeId === null ? null : requireString(rangeId, 'rangeId');
}

function requireUnlistedPolicy(policy) {
  if (!Object.values(HOLDEM_RANGE_UNLISTED_POLICIES).includes(policy)) {
    throw new RangeError('unlistedState must be unknown or known_zero');
  }
  return policy;
}

export function createHoldemWeightedRangeFromEntries({
  rangeId = null,
  entries = [],
  provenanceSources = [],
  unlistedState = HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
  unlistedProvenanceId = null,
} = {}) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be an array');
  requireUnlistedPolicy(unlistedState);
  const sources = normalizeProvenanceSources(provenanceSources);
  const sourceIds = new Set(sources.map((source) => source.id));
  requireNullableProvenanceId(unlistedProvenanceId, sourceIds, 'unlistedProvenanceId');

  const supplied = new Map();
  for (const rawEntry of entries) {
    const entry = normalizedEntry(rawEntry);
    if (supplied.has(entry.comboId)) throw new RangeError(`Duplicate combo entry: ${entry.comboId}`);
    requireNullableProvenanceId(entry.provenanceId, sourceIds);
    supplied.set(entry.comboId, entry);
  }

  const orderedEntries = HOLDEM_COMBOS.map((combo) => {
    if (supplied.has(combo.id)) return supplied.get(combo.id);
    if (unlistedState === HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO) {
      return {
        comboId: combo.id,
        state: HOLDEM_RANGE_ENTRY_STATES.KNOWN,
        weight: 0,
        provenanceId: unlistedProvenanceId,
      };
    }
    return {
      comboId: combo.id,
      state: HOLDEM_RANGE_ENTRY_STATES.UNKNOWN,
      provenanceId: unlistedProvenanceId,
    };
  });

  const range = {
    schemaVersion: HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    rangeId: requireRangeId(rangeId),
    provenance: {
      schemaVersion: HOLDEM_RANGE_PROVENANCE_SCHEMA_VERSION,
      sources: sources.map(cloneData),
    },
    entries: orderedEntries,
  };
  validateHoldemWeightedRange(range);
  return deepFreeze(range);
}

export function createEmptyCompleteHoldemRange(options = {}) {
  return createHoldemWeightedRangeFromEntries({
    ...options,
    entries: [],
    unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
  });
}

export function createFullyUnknownHoldemRange(options = {}) {
  return createHoldemWeightedRangeFromEntries({
    ...options,
    entries: [],
    unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
  });
}

function classWeightRecords(handClassWeights) {
  if (handClassWeights instanceof Map) {
    return [...handClassWeights].map(([handClass, value]) => ({ handClass, value }));
  }
  if (Array.isArray(handClassWeights)) {
    return handClassWeights.map((record) => {
      requirePlainObject(record, 'handClassWeights entry');
      return { handClass: record.handClass, value: record };
    });
  }
  requirePlainObject(handClassWeights, 'handClassWeights');
  return Object.entries(handClassWeights).map(([handClass, value]) => ({ handClass, value }));
}

function normalizedClassWeight(record) {
  if (!isPreflopHandClass(record.handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${record.handClass}`);
  }
  if (typeof record.value === 'number') {
    return { handClass: record.handClass, weight: requireWeight(record.value), provenanceId: null };
  }
  requirePlainObject(record.value, `handClassWeights.${record.handClass}`);
  const weight = requireWeight(record.value.weight, `handClassWeights.${record.handClass}.weight`);
  const provenanceId = record.value.provenanceId === undefined ? null : record.value.provenanceId;
  return { handClass: record.handClass, weight, provenanceId };
}

export function createHoldemWeightedRangeFromHandClassWeights({
  rangeId = null,
  handClassWeights = {},
  provenanceSources = [],
  unlistedState = HOLDEM_RANGE_UNLISTED_POLICIES.UNKNOWN,
  unlistedProvenanceId = null,
} = {}) {
  requireUnlistedPolicy(unlistedState);
  const records = classWeightRecords(handClassWeights).map(normalizedClassWeight);
  if (new Set(records.map((record) => record.handClass)).size !== records.length) {
    throw new RangeError('handClassWeights must not repeat a hand class');
  }
  const byClass = new Map(records.map((record) => [record.handClass, record]));
  const entries = [];
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const record = byClass.get(handClass);
    if (!record) continue;
    for (const combo of getHoldemCombosForHandClass(handClass)) {
      entries.push({
        comboId: combo.id,
        state: HOLDEM_RANGE_ENTRY_STATES.KNOWN,
        weight: record.weight,
        provenanceId: record.provenanceId,
      });
    }
  }
  return createHoldemWeightedRangeFromEntries({
    rangeId,
    entries,
    provenanceSources,
    unlistedState,
    unlistedProvenanceId,
  });
}

export function withHoldemComboOverrides(range, overrides, { provenanceSources = null } = {}) {
  validateHoldemWeightedRange(range);
  if (!Array.isArray(overrides)) throw new TypeError('overrides must be an array');
  const nextSources = provenanceSources ?? range.provenance.sources;
  const byCombo = new Map(range.entries.map((entry) => [entry.comboId, cloneData(entry)]));
  const seen = new Set();
  for (const rawOverride of overrides) {
    const override = normalizedEntry(rawOverride);
    if (seen.has(override.comboId)) throw new RangeError(`Duplicate combo override: ${override.comboId}`);
    seen.add(override.comboId);
    byCombo.set(override.comboId, override);
  }
  return createHoldemWeightedRangeFromEntries({
    rangeId: range.rangeId,
    entries: HOLDEM_COMBOS.map((combo) => byCombo.get(combo.id)),
    provenanceSources: nextSources,
  });
}

export function validateHoldemWeightedRange(range) {
  requirePlainObject(range, 'HoldemWeightedRange');
  requireExactKeys(range, RANGE_KEYS, 'HoldemWeightedRange');
  if (range.schemaVersion !== HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION}`);
  }
  if (range.game !== HOLDEM_RANGE_GAME) throw new RangeError(`HoldemWeightedRange.game must be ${HOLDEM_RANGE_GAME}`);
  requireRangeId(range.rangeId);
  const sourceIds = validateProvenance(range.provenance);
  if (!Array.isArray(range.entries) || range.entries.length !== HOLDEM_COMBOS.length) {
    throw new RangeError(`HoldemWeightedRange requires exactly ${HOLDEM_COMBOS.length} combo entries`);
  }
  const seen = new Set();
  for (let index = 0; index < range.entries.length; index += 1) {
    const entry = validateRangeEntry(range.entries[index], sourceIds, `entries[${index}]`);
    if (seen.has(entry.comboId)) throw new RangeError(`Duplicate combo entry: ${entry.comboId}`);
    seen.add(entry.comboId);
    if (entry.comboId !== HOLDEM_COMBOS[index].id) {
      throw new RangeError('HoldemWeightedRange entries must use canonical deterministic combo order');
    }
  }
  return range;
}

export function inspectHoldemWeightedRange(range) {
  validateHoldemWeightedRange(range);
  const facts = coverageFacts(range.entries);
  return deepFreeze({
    schemaVersion: HOLDEM_RANGE_INSPECTION_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    rangeId: range.rangeId,
    state: facts.complete ? 'complete' : 'partial',
    ...facts,
  });
}

export function conditionHoldemRange(range, blockerCards = []) {
  validateHoldemWeightedRange(range);
  assertCardArray(blockerCards, 'blockerCards');
  assertUniqueKnownCards([{ label: 'blockerCards', cards: blockerCards }]);
  const blockers = [...blockerCards].sort(compareHoldemCards);
  const blockerSet = new Set(blockers);
  const eligibleEntries = [];
  const blockedEntries = [];
  for (const sourceEntry of range.entries) {
    const entry = cloneData(sourceEntry);
    const combo = getHoldemComboById(entry.comboId);
    const target = combo.cards.some((card) => blockerSet.has(card))
      ? blockedEntries
      : eligibleEntries;
    target.push(entry);
  }
  const before = coverageFacts(range.entries);
  const after = coverageFacts(eligibleEntries);
  const blockedKnownWeight = sumWeights(blockedEntries);
  const result = {
    schemaVersion: HOLDEM_CONDITIONED_RANGE_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    sourceRangeId: range.rangeId,
    blockers,
    provenance: cloneData(range.provenance),
    derivationProvenance: createHoldemRangeProvenanceSource({
      id: 'blocker-conditioning',
      kind: HOLDEM_RANGE_PROVENANCE_KINDS.DERIVED_FILTER,
      sourceId: range.rangeId,
      sourceSchemaVersion: HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION,
      parentRangeId: range.rangeId,
      operation: 'blocker_conditioning',
    }),
    eligibleEntries,
    blockedEntries,
    facts: {
      totalCombosBefore: before.totalCombos,
      knownCombosBefore: before.knownCombos,
      unknownCombosBefore: before.unknownCombos,
      coverageRatioBefore: before.coverageRatio,
      totalKnownWeightBefore: before.totalKnownWeight,
      completeBefore: before.complete,
      eligibleCombos: after.totalCombos,
      blockedCombos: blockedEntries.length,
      knownEligibleCombos: after.knownCombos,
      unknownEligibleCombos: after.unknownCombos,
      eligibleCoverageRatio: after.coverageRatio,
      totalEligibleWeight: after.totalKnownWeight,
      blockedKnownWeight,
      completeAfterConditioning: after.complete,
    },
  };
  return deepFreeze(result);
}

export function createNormalizedHoldemDistribution(range, { blockers = [] } = {}) {
  const inspection = inspectHoldemWeightedRange(range);
  if (!inspection.complete) {
    throw new RangeError('Cannot normalize an incomplete Holdem range without an explicit policy');
  }
  const conditioned = conditionHoldemRange(range, blockers);
  const totalEligibleWeight = conditioned.facts.totalEligibleWeight;
  if (!(totalEligibleWeight > 0)) {
    throw new RangeError('Cannot normalize a zero-mass Holdem range');
  }
  const entries = conditioned.eligibleEntries.map((entry) => ({
    comboId: entry.comboId,
    weight: entry.weight,
    probability: entry.weight / totalEligibleWeight,
    provenanceId: entry.provenanceId,
  }));
  return deepFreeze({
    schemaVersion: HOLDEM_COMBO_DISTRIBUTION_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    sourceRangeId: range.rangeId,
    blockers: [...conditioned.blockers],
    totalEligibleWeight,
    probabilityTotal: entries.reduce((sum, entry) => sum + entry.probability, 0),
    provenance: cloneData(conditioned.provenance),
    derivationProvenance: cloneData(conditioned.derivationProvenance),
    entries,
  });
}

function handClassKind(handClass) {
  if (handClass.length === 2) return 'pair';
  return handClass.endsWith('s') ? 'suited' : 'offsuit';
}

function matrixCellFor(rangeEntries, handClass, index) {
  const comboEntries = getHoldemCombosForHandClass(handClass).map(
    (combo) => cloneData(rangeEntries.get(combo.id)),
  );
  const knownEntries = comboEntries.filter((entry) => entry.state === HOLDEM_RANGE_ENTRY_STATES.KNOWN);
  const unknownComboCount = comboEntries.length - knownEntries.length;
  const knownWeights = knownEntries.map((entry) => entry.weight);
  const distinctKnownWeights = new Set(knownWeights);
  const complete = unknownComboCount === 0;
  const totalKnownWeight = sumWeights(knownEntries);
  return {
    handClass,
    kind: handClassKind(handClass),
    row: Math.floor(index / 13),
    column: index % 13,
    physicalComboCount: comboEntries.length,
    knownComboCount: knownEntries.length,
    unknownComboCount,
    knownCoverageFraction: knownEntries.length / comboEntries.length,
    totalKnownWeight,
    derivedAverageKnownWeight: knownEntries.length === 0
      ? null
      : totalKnownWeight / knownEntries.length,
    derivedUniformWeight: complete && distinctKnownWeights.size === 1 ? knownWeights[0] : null,
    complete,
    state: complete ? 'complete' : 'partial',
    hasIntraClassVariation: distinctKnownWeights.size > 1
      || (knownEntries.length > 0 && unknownComboCount > 0),
    comboEntries,
  };
}

function compositionFor(cells, kind) {
  const matching = cells.filter((cell) => cell.kind === kind);
  return {
    classCount: matching.length,
    physicalComboCount: matching.reduce((sum, cell) => sum + cell.physicalComboCount, 0),
    knownComboCount: matching.reduce((sum, cell) => sum + cell.knownComboCount, 0),
    unknownComboCount: matching.reduce((sum, cell) => sum + cell.unknownComboCount, 0),
    totalKnownWeight: matching.reduce((sum, cell) => sum + cell.totalKnownWeight, 0),
  };
}

export function projectHoldemRangeToMatrix(range) {
  validateHoldemWeightedRange(range);
  const byCombo = new Map(range.entries.map((entry) => [entry.comboId, entry]));
  const cells = PREFLOP_HAND_CLASSES.map(
    (handClass, index) => matrixCellFor(byCombo, handClass, index),
  );
  return deepFreeze({
    schemaVersion: HOLDEM_RANGE_MATRIX_PROJECTION_SCHEMA_VERSION,
    game: HOLDEM_RANGE_GAME,
    sourceRangeId: range.rangeId,
    inspection: inspectHoldemWeightedRange(range),
    facts: {
      totalCells: cells.length,
      pairCells: cells.filter((cell) => cell.kind === 'pair').length,
      suitedCells: cells.filter((cell) => cell.kind === 'suited').length,
      offsuitCells: cells.filter((cell) => cell.kind === 'offsuit').length,
    },
    composition: {
      pair: compositionFor(cells, 'pair'),
      suited: compositionFor(cells, 'suited'),
      offsuit: compositionFor(cells, 'offsuit'),
    },
    cells,
  });
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new RangeError('Holdem range JSON cannot contain non-finite numbers');
    }
    return value;
  }
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]),
  );
}

export function serializeHoldemWeightedRange(range) {
  validateHoldemWeightedRange(range);
  return JSON.stringify(stableJsonValue(range));
}

export function deserializeHoldemWeightedRange(serialized) {
  if (typeof serialized !== 'string') throw new TypeError('serialized Holdem range must be a string');
  const parsed = JSON.parse(serialized);
  validateHoldemWeightedRange(parsed);
  return deepFreeze(cloneData(parsed));
}
