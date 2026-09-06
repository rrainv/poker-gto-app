import {
  assertMilliBbAlignment,
  assertPositiveMilliBb,
} from './amounts.js';
import { deepFreeze } from './freeze.js';
import { ANTE_TYPES, POKER_VARIANT } from './schema.js';

export const GAME_RULES_DEFINITION_SCHEMA_VERSION = 'game-rules-definition/v1';
export const GAME_RULES_DEFINITION_V2_SCHEMA_VERSION = 'game-rules-definition/v2';
export const GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION = 'game-rules-snapshot/v2';
export const GAME_RULES_PRESET_SCHEMA_VERSION = 'game-rules-preset/v1';
export const GAME_RULES_SNAPSHOT_SCHEMA_VERSION = 'game-rules-snapshot/v1';
export const GAME_RULES_SEMANTIC_FINGERPRINT_PREFIX = 'game-rules-semantic/v1:';

export const GAME_RULES_VARIANTS = Object.freeze({
  NO_LIMIT_TEXAS_HOLDEM: POKER_VARIANT,
});

export const GAME_RULES_FORMATS = Object.freeze({
  CASH: 'cash',
  LEGACY_UNSPECIFIED: 'legacy_unspecified',
});

export const GAME_RULES_STRADDLE_TYPES = Object.freeze({
  NONE: 'none',
});

export const GAME_RULES_COLLECTION_TYPES = Object.freeze({
  NONE: 'none',
  FIXED_PER_SEATED_PLAYER: 'fixed_per_seated_player',
});

export const GAME_RULES_COLLECTION_TIMINGS = Object.freeze({
  HAND_START_BEFORE_ANTES_AND_BLINDS: 'hand_start_before_antes_and_blinds',
});

export const GAME_RULES_COLLECTION_BASES = Object.freeze({
  SEATED_PLAYERS: 'seated_players',
});

export const GAME_RULES_COLLECTION_DESTINATIONS = Object.freeze({
  OUTSIDE_CONTESTABLE_POT: 'outside_contestable_pot',
});

export const GAME_RULES_COLLECTION_ROUNDING = Object.freeze({
  NONE: 'none',
});

export const GAME_RULES_COLLECTION_SHORTFALL_POLICIES = Object.freeze({
  REJECT_HAND: 'reject_hand',
});

export const GAME_RULES_PRESET_ORIGIN_KINDS = Object.freeze({
  RIVERLINE_BUILTIN: 'riverline_builtin',
  USER_DEFINED: 'user_defined',
  EXTERNAL: 'external',
});

export const GAME_RULES_PRESET_STATES = Object.freeze({
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
});

export const GAME_RULES_SNAPSHOT_SOURCE_KINDS = Object.freeze({
  DIRECT: 'direct',
  PRESET: 'preset',
  LEGACY_COMPATIBILITY: 'legacy_compatibility',
});

const DEFINITION_KEYS = Object.freeze([
  'schemaVersion',
  'variant',
  'format',
  'tableSize',
  'blinds',
  'ante',
  'straddle',
  'collectionPolicy',
]);
const TABLE_SIZE_KEYS = Object.freeze(['minimumSeated', 'maximumSeated']);
const BLINDS_KEYS = Object.freeze([
  'smallBlindMilliBb',
  'bigBlindMilliBb',
  'chipUnitMilliBb',
]);
const ANTE_KEYS = Object.freeze(['type', 'amountMilliBb']);
const STRADDLE_KEYS = Object.freeze(['type']);
const NO_COLLECTION_KEYS = Object.freeze(['type']);
const FIXED_COLLECTION_KEYS = Object.freeze([
  'type',
  'amountMilliBb',
  'timing',
  'basis',
  'destination',
  'rounding',
  'shortfallPolicy',
]);
const PRESET_KEYS = Object.freeze([
  'schemaVersion',
  'id',
  'revision',
  'origin',
  'displayName',
  'description',
  'state',
  'setupDefaults',
  'definition',
]);
const SETUP_KEYS = Object.freeze(['seatedPlayers']);
const SNAPSHOT_KEYS = Object.freeze([
  'schemaVersion',
  'source',
  'setup',
  'semanticFingerprint',
  'definition',
]);
const SNAPSHOT_INPUT_KEYS = Object.freeze(['source', 'setup', 'definition']);
const DIRECT_SOURCE_KEYS = Object.freeze(['kind']);
const PRESET_SOURCE_KEYS = Object.freeze(['kind', 'presetId', 'presetRevision']);
const LEGACY_SOURCE_KEYS = Object.freeze([
  'kind',
  'presetId',
  'presetRevision',
  'legacyMode',
]);
const BUILTIN_ORIGIN_KEYS = Object.freeze(['kind']);
const USER_DEFINED_ORIGIN_KEYS = Object.freeze(['kind']);
const EXTERNAL_ORIGIN_KEYS = Object.freeze(['kind', 'operator']);
const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,127}$/;
const VALUES = (object) => Object.values(object);

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function requireEnum(value, vocabulary, label) {
  if (!VALUES(vocabulary).includes(value)) {
    throw new RangeError(`Unsupported ${label}: ${String(value)}`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function requireString(value, label) {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`);
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function normalizePresetId(value, label = 'GameRulesPreset.id') {
  const id = requireNonEmptyString(value, label);
  if (!PRESET_ID_PATTERN.test(id)) {
    throw new RangeError(`${label} must use a stable lowercase identifier`);
  }
  return id;
}

function normalizeTableSize(tableSize) {
  requirePlainObject(tableSize, 'GameRulesDefinition.tableSize');
  requireExactKeys(tableSize, TABLE_SIZE_KEYS, 'GameRulesDefinition.tableSize');
  const { minimumSeated, maximumSeated } = tableSize;
  if (!Number.isInteger(minimumSeated) || !Number.isInteger(maximumSeated)
    || minimumSeated < 2 || maximumSeated > 10 || minimumSeated > maximumSeated) {
    throw new RangeError('GameRulesDefinition.tableSize must stay within 2 through 10 with minimumSeated <= maximumSeated');
  }
  return { minimumSeated, maximumSeated };
}

function normalizeBlinds(blinds) {
  requirePlainObject(blinds, 'GameRulesDefinition.blinds');
  requireExactKeys(blinds, BLINDS_KEYS, 'GameRulesDefinition.blinds');
  const { smallBlindMilliBb, bigBlindMilliBb, chipUnitMilliBb } = blinds;
  assertPositiveMilliBb(chipUnitMilliBb, 'GameRulesDefinition.blinds.chipUnitMilliBb');
  assertPositiveMilliBb(smallBlindMilliBb, 'GameRulesDefinition.blinds.smallBlindMilliBb');
  assertPositiveMilliBb(bigBlindMilliBb, 'GameRulesDefinition.blinds.bigBlindMilliBb');
  if (bigBlindMilliBb !== 1000) {
    throw new RangeError('GameRulesDefinition.blinds.bigBlindMilliBb must equal 1000 in v1');
  }
  if (smallBlindMilliBb > bigBlindMilliBb) {
    throw new RangeError('GameRulesDefinition.blinds.smallBlindMilliBb cannot exceed the big blind');
  }
  assertMilliBbAlignment(
    smallBlindMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.blinds.smallBlindMilliBb',
  );
  assertMilliBbAlignment(
    bigBlindMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.blinds.bigBlindMilliBb',
  );
  return { smallBlindMilliBb, bigBlindMilliBb, chipUnitMilliBb };
}

function normalizeAnte(ante, chipUnitMilliBb) {
  requirePlainObject(ante, 'GameRulesDefinition.ante');
  requireExactKeys(ante, ANTE_KEYS, 'GameRulesDefinition.ante');
  const type = requireEnum(ante.type, ANTE_TYPES, 'ante type');
  assertMilliBbAlignment(
    ante.amountMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.ante.amountMilliBb',
  );
  if (type === ANTE_TYPES.NONE && ante.amountMilliBb !== 0) {
    throw new RangeError('A none ante must use amountMilliBb 0');
  }
  if (type !== ANTE_TYPES.NONE && ante.amountMilliBb === 0) {
    throw new RangeError('An enabled ante must use a positive amountMilliBb');
  }
  return { type, amountMilliBb: ante.amountMilliBb };
}

function normalizeStraddle(straddle) {
  requirePlainObject(straddle, 'GameRulesDefinition.straddle');
  requireExactKeys(straddle, STRADDLE_KEYS, 'GameRulesDefinition.straddle');
  const type = requireEnum(straddle.type, GAME_RULES_STRADDLE_TYPES, 'straddle type');
  return { type };
}

function normalizeCollectionPolicy(collectionPolicy, chipUnitMilliBb) {
  requirePlainObject(collectionPolicy, 'GameRulesDefinition.collectionPolicy');
  const type = requireEnum(
    collectionPolicy.type,
    GAME_RULES_COLLECTION_TYPES,
    'collection policy type',
  );
  if (type === GAME_RULES_COLLECTION_TYPES.NONE) {
    requireExactKeys(
      collectionPolicy,
      NO_COLLECTION_KEYS,
      'GameRulesDefinition.collectionPolicy none policy',
    );
    return { type };
  }

  requireExactKeys(
    collectionPolicy,
    FIXED_COLLECTION_KEYS,
    'GameRulesDefinition.collectionPolicy fixed policy',
  );
  assertPositiveMilliBb(
    collectionPolicy.amountMilliBb,
    'GameRulesDefinition.collectionPolicy.amountMilliBb',
  );
  assertMilliBbAlignment(
    collectionPolicy.amountMilliBb,
    chipUnitMilliBb,
    'GameRulesDefinition.collectionPolicy.amountMilliBb',
  );
  const timing = requireEnum(
    collectionPolicy.timing,
    GAME_RULES_COLLECTION_TIMINGS,
    'collection timing',
  );
  const basis = requireEnum(
    collectionPolicy.basis,
    GAME_RULES_COLLECTION_BASES,
    'collection basis',
  );
  const destination = requireEnum(
    collectionPolicy.destination,
    GAME_RULES_COLLECTION_DESTINATIONS,
    'collection destination',
  );
  const rounding = requireEnum(
    collectionPolicy.rounding,
    GAME_RULES_COLLECTION_ROUNDING,
    'collection rounding',
  );
  const shortfallPolicy = requireEnum(
    collectionPolicy.shortfallPolicy,
    GAME_RULES_COLLECTION_SHORTFALL_POLICIES,
    'collection shortfall policy',
  );
  return {
    type,
    amountMilliBb: collectionPolicy.amountMilliBb,
    timing,
    basis,
    destination,
    rounding,
    shortfallPolicy,
  };
}

function normalizeDefinition(definition) {
  requirePlainObject(definition, 'GameRulesDefinition');
  const recorded = definition.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION;
  requireExactKeys(definition, recorded ? [...DEFINITION_KEYS, 'recordedSettlementPolicy'] : DEFINITION_KEYS, 'GameRulesDefinition');
  if (!recorded && definition.schemaVersion !== GAME_RULES_DEFINITION_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${GAME_RULES_DEFINITION_SCHEMA_VERSION}`);
  }
  const variant = requireEnum(definition.variant, GAME_RULES_VARIANTS, 'game rules variant');
  const format = requireEnum(definition.format, GAME_RULES_FORMATS, 'game rules format');
  const tableSize = normalizeTableSize(definition.tableSize);
  const blinds = normalizeBlinds(definition.blinds);
  const ante = normalizeAnte(definition.ante, blinds.chipUnitMilliBb);
  const straddle = normalizeStraddle(definition.straddle);
  const collectionPolicy = normalizeCollectionPolicy(
    definition.collectionPolicy,
    blinds.chipUnitMilliBb,
  );

  if (recorded) {
    requireExactKeys(definition.recordedSettlementPolicy, ['type', 'rakeModel'], 'recordedSettlementPolicy');
    if (definition.recordedSettlementPolicy.type !== 'source_recorded_rake'
      || definition.recordedSettlementPolicy.rakeModel !== 'unknown'
      || collectionPolicy.type !== 'none' || format !== 'cash') {
      throw new RangeError('Recorded settlement requires cash, no start collection, and unknown source-recorded rake model');
    }
  }
  return {
    schemaVersion: definition.schemaVersion,
    variant,
    format,
    tableSize,
    blinds,
    ante,
    straddle,
    collectionPolicy,
    ...(recorded ? { recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' } } : {}),
  };
}

export function validateGameRulesDefinition(definition) {
  return deepFreeze(normalizeDefinition(definition));
}

export function createGameRulesDefinition(definition) {
  return validateGameRulesDefinition(definition);
}

export function serializeGameRulesSemantics(definition) {
  return JSON.stringify(normalizeDefinition(definition));
}

export function parseGameRulesSemanticSerialization(serialized) {
  if (typeof serialized !== 'string' || !serialized) {
    throw new TypeError('Game rules semantic serialization must be a non-empty string');
  }
  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    throw new TypeError(`Invalid game rules semantic serialization: ${error.message}`);
  }
  return validateGameRulesDefinition(parsed);
}

export function getGameRulesSemanticFingerprint(definition) {
  const prefix = definition?.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION
    ? 'game-rules-semantic/v2:' : GAME_RULES_SEMANTIC_FINGERPRINT_PREFIX;
  return `${prefix}${serializeGameRulesSemantics(definition)}`;
}

function normalizePresetOrigin(origin) {
  requirePlainObject(origin, 'GameRulesPreset.origin');
  const kind = requireEnum(origin.kind, GAME_RULES_PRESET_ORIGIN_KINDS, 'preset origin kind');
  if (kind === GAME_RULES_PRESET_ORIGIN_KINDS.RIVERLINE_BUILTIN) {
    requireExactKeys(origin, BUILTIN_ORIGIN_KEYS, 'GameRulesPreset.origin riverline_builtin');
    return { kind };
  }
  if (kind === GAME_RULES_PRESET_ORIGIN_KINDS.USER_DEFINED) {
    requireExactKeys(origin, USER_DEFINED_ORIGIN_KEYS, 'GameRulesPreset.origin user_defined');
    return { kind };
  }
  requireExactKeys(origin, EXTERNAL_ORIGIN_KEYS, 'GameRulesPreset.origin external');
  return { kind, operator: requireNonEmptyString(origin.operator, 'GameRulesPreset.origin.operator') };
}

function normalizeSetup(setup, tableSize, label) {
  requirePlainObject(setup, label);
  requireExactKeys(setup, SETUP_KEYS, label);
  if (!Number.isInteger(setup.seatedPlayers)
    || setup.seatedPlayers < tableSize.minimumSeated
    || setup.seatedPlayers > tableSize.maximumSeated) {
    throw new RangeError(`${label}.seatedPlayers must fit the definition table-size policy`);
  }
  return { seatedPlayers: setup.seatedPlayers };
}

function normalizePreset(preset) {
  requirePlainObject(preset, 'GameRulesPreset');
  requireExactKeys(preset, PRESET_KEYS, 'GameRulesPreset');
  if (preset.schemaVersion !== GAME_RULES_PRESET_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${GAME_RULES_PRESET_SCHEMA_VERSION}`);
  }
  const definition = normalizeDefinition(preset.definition);
  if (definition.schemaVersion !== GAME_RULES_DEFINITION_SCHEMA_VERSION) {
    throw new RangeError('GameRulesPreset v1 requires a v1 definition');
  }
  return {
    schemaVersion: GAME_RULES_PRESET_SCHEMA_VERSION,
    id: normalizePresetId(preset.id),
    revision: requirePositiveInteger(preset.revision, 'GameRulesPreset.revision'),
    origin: normalizePresetOrigin(preset.origin),
    displayName: requireNonEmptyString(preset.displayName, 'GameRulesPreset.displayName'),
    description: requireString(preset.description, 'GameRulesPreset.description'),
    state: requireEnum(preset.state, GAME_RULES_PRESET_STATES, 'preset state'),
    setupDefaults: normalizeSetup(
      preset.setupDefaults,
      definition.tableSize,
      'GameRulesPreset.setupDefaults',
    ),
    definition,
  };
}

export function validateGameRulesPreset(preset) {
  return deepFreeze(normalizePreset(preset));
}

export function createGameRulesPreset(preset) {
  return validateGameRulesPreset(preset);
}

export function validateGameRulesPresetSet(presets) {
  if (!Array.isArray(presets)) throw new TypeError('GameRulesPreset set must be an array');
  const normalized = presets.map(validateGameRulesPreset);
  const ids = new Set();
  for (const preset of normalized) {
    if (ids.has(preset.id)) throw new RangeError(`Duplicate GameRulesPreset id: ${preset.id}`);
    ids.add(preset.id);
  }
  return deepFreeze(normalized);
}

function normalizeSnapshotSource(source) {
  requirePlainObject(source, 'GameRulesSnapshot.source');
  const kind = requireEnum(source.kind, GAME_RULES_SNAPSHOT_SOURCE_KINDS, 'snapshot source kind');
  if (kind === GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT) {
    requireExactKeys(source, DIRECT_SOURCE_KEYS, 'GameRulesSnapshot.source direct');
    return { kind };
  }
  if (kind === GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET) {
    requireExactKeys(source, PRESET_SOURCE_KEYS, 'GameRulesSnapshot.source preset');
    return {
      kind,
      presetId: normalizePresetId(source.presetId, 'GameRulesSnapshot.source.presetId'),
      presetRevision: requirePositiveInteger(
        source.presetRevision,
        'GameRulesSnapshot.source.presetRevision',
      ),
    };
  }
  requireExactKeys(source, LEGACY_SOURCE_KEYS, 'GameRulesSnapshot.source legacy_compatibility');
  if (!['home', 'clubgg'].includes(source.legacyMode)) {
    throw new RangeError(`Unsupported legacy game mode: ${String(source.legacyMode)}`);
  }
  return {
    kind,
    presetId: normalizePresetId(source.presetId, 'GameRulesSnapshot.source.presetId'),
    presetRevision: requirePositiveInteger(
      source.presetRevision,
      'GameRulesSnapshot.source.presetRevision',
    ),
    legacyMode: source.legacyMode,
  };
}

export function createGameRulesSnapshot(input) {
  requirePlainObject(input, 'GameRulesSnapshot input');
  requireExactKeys(input, SNAPSHOT_INPUT_KEYS, 'GameRulesSnapshot input');
  const definition = normalizeDefinition(input.definition);
  const snapshot = {
    schemaVersion: definition.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION
      ? GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION : GAME_RULES_SNAPSHOT_SCHEMA_VERSION,
    source: normalizeSnapshotSource(input.source),
    setup: normalizeSetup(input.setup, definition.tableSize, 'GameRulesSnapshot.setup'),
    semanticFingerprint: getGameRulesSemanticFingerprint(definition),
    definition,
  };
  return deepFreeze(snapshot);
}

export function validateGameRulesSnapshot(snapshot) {
  requirePlainObject(snapshot, 'GameRulesSnapshot');
  requireExactKeys(snapshot, SNAPSHOT_KEYS, 'GameRulesSnapshot');
  if (![GAME_RULES_SNAPSHOT_SCHEMA_VERSION, GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION].includes(snapshot.schemaVersion)) {
    throw new TypeError(`Expected ${GAME_RULES_SNAPSHOT_SCHEMA_VERSION}`);
  }
  const definition = normalizeDefinition(snapshot.definition);
  if ((snapshot.schemaVersion === GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION)
    !== (definition.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION)) {
    throw new RangeError('GameRulesSnapshot and definition versions must match');
  }
  const expectedFingerprint = getGameRulesSemanticFingerprint(definition);
  if (snapshot.semanticFingerprint !== expectedFingerprint) {
    throw new RangeError('GameRulesSnapshot semanticFingerprint does not match its definition');
  }
  return deepFreeze({
    schemaVersion: definition.schemaVersion === GAME_RULES_DEFINITION_V2_SCHEMA_VERSION
      ? GAME_RULES_SNAPSHOT_V2_SCHEMA_VERSION : GAME_RULES_SNAPSHOT_SCHEMA_VERSION,
    source: normalizeSnapshotSource(snapshot.source),
    setup: normalizeSetup(snapshot.setup, definition.tableSize, 'GameRulesSnapshot.setup'),
    semanticFingerprint: expectedFingerprint,
    definition,
  });
}

const DEFAULT_BLINDS = Object.freeze({
  smallBlindMilliBb: 500,
  bigBlindMilliBb: 1000,
  chipUnitMilliBb: 100,
});
const DEFAULT_ANTE = Object.freeze({ type: ANTE_TYPES.NONE, amountMilliBb: 0 });
const NO_STRADDLE = Object.freeze({ type: GAME_RULES_STRADDLE_TYPES.NONE });

export const NO_RAKE_CASH_GAME_RULES_PRESET = createGameRulesPreset({
  schemaVersion: GAME_RULES_PRESET_SCHEMA_VERSION,
  id: 'riverline:builtin:no-rake-cash',
  revision: 1,
  origin: { kind: GAME_RULES_PRESET_ORIGIN_KINDS.RIVERLINE_BUILTIN },
  displayName: 'No-rake cash',
  description: 'No-limit Hold\'em with no collection.',
  state: GAME_RULES_PRESET_STATES.ACTIVE,
  setupDefaults: { seatedPlayers: 6 },
  definition: {
    schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
    variant: GAME_RULES_VARIANTS.NO_LIMIT_TEXAS_HOLDEM,
    format: GAME_RULES_FORMATS.CASH,
    tableSize: { minimumSeated: 2, maximumSeated: 10 },
    blinds: DEFAULT_BLINDS,
    ante: DEFAULT_ANTE,
    straddle: NO_STRADDLE,
    collectionPolicy: { type: GAME_RULES_COLLECTION_TYPES.NONE },
  },
});

export const FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET = createGameRulesPreset({
  schemaVersion: GAME_RULES_PRESET_SCHEMA_VERSION,
  id: 'riverline:builtin:fixed-per-seated-player-100-millibb',
  revision: 1,
  origin: { kind: GAME_RULES_PRESET_ORIGIN_KINDS.RIVERLINE_BUILTIN },
  displayName: 'Fixed collection per seated player',
  description: 'Legacy-compatible 100 milliBB collection outside the contestable pot.',
  state: GAME_RULES_PRESET_STATES.ACTIVE,
  setupDefaults: { seatedPlayers: 8 },
  definition: {
    schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
    variant: GAME_RULES_VARIANTS.NO_LIMIT_TEXAS_HOLDEM,
    format: GAME_RULES_FORMATS.LEGACY_UNSPECIFIED,
    tableSize: { minimumSeated: 7, maximumSeated: 10 },
    blinds: DEFAULT_BLINDS,
    ante: DEFAULT_ANTE,
    straddle: NO_STRADDLE,
    collectionPolicy: {
      type: GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER,
      amountMilliBb: 100,
      timing: GAME_RULES_COLLECTION_TIMINGS.HAND_START_BEFORE_ANTES_AND_BLINDS,
      basis: GAME_RULES_COLLECTION_BASES.SEATED_PLAYERS,
      destination: GAME_RULES_COLLECTION_DESTINATIONS.OUTSIDE_CONTESTABLE_POT,
      rounding: GAME_RULES_COLLECTION_ROUNDING.NONE,
      shortfallPolicy: GAME_RULES_COLLECTION_SHORTFALL_POLICIES.REJECT_HAND,
    },
  },
});

export const BUILT_IN_GAME_RULES_PRESETS = validateGameRulesPresetSet([
  NO_RAKE_CASH_GAME_RULES_PRESET,
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
]);
