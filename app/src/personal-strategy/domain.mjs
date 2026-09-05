import {
  ACTION_TYPES,
  ANTE_TYPES,
  POKER_VARIANT,
  POSITIONS_BY_TABLE_SIZE,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';

export const STRATEGY_PROFILE_SCHEMA_VERSION = 'strategy-profile/v2';
export const STRATEGY_MODE_SCHEMA_VERSION = 'strategy-mode/v2';
export const CALIBRATION_CONTEXT_SCHEMA_VERSION = 'calibration-context/v1';
export const CALIBRATION_CONTEXT_V2_SCHEMA_VERSION = 'calibration-context/v2';
export const RANGE_OBSERVATION_SCHEMA_VERSION = 'range-observation/v1';
export const TRAINING_OBSERVATION_SCHEMA_VERSION = 'training-observation/v1';
export const CALIBRATION_SESSION_SCHEMA_VERSION = 'calibration-session/v1';

export const PROFILE_STATES = Object.freeze({
  ACTIVE: 'active',
  ARCHIVED: 'archived',
});

export const PROFILE_OWNER_KINDS = Object.freeze({
  LOCAL: 'local',
});

export const CALIBRATION_DECISION_FAMILIES = Object.freeze({
  PREFLOP_RFI: 'preflop_rfi',
  PREFLOP_FACING_LIMP: 'preflop_facing_limp',
  PREFLOP_FACING_OPEN: 'preflop_facing_open',
  PREFLOP_FACING_3BET: 'preflop_facing_3bet',
  PREFLOP_FACING_4BET: 'preflop_facing_4bet',
  PREFLOP_BB_OPTION: 'preflop_bb_option',
});

export const CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS = Object.freeze({
  SEMANTIC_FINGERPRINT: 'semantic_fingerprint',
  LEGACY_OPAQUE_ID: 'legacy_opaque_id',
});

export const CALIBRATION_CONTEXT_STACK_BASES = Object.freeze({
  EFFECTIVE_LIVE_POT_CAPACITY: 'effective_live_pot_capacity',
  LEGACY_CALIBRATION_EFFECTIVE: 'legacy_calibration_effective',
});

export const CALIBRATION_PRIOR_ACTION_FAMILIES = Object.freeze({
  UNOPENED: 'unopened',
  LIMPED: 'limped',
  OPEN: 'open',
  THREE_BET: 'three_bet',
  FOUR_BET: 'four_bet',
});

export const PROFILE_EVIDENCE_TYPES = Object.freeze({
  DIRECT_CALIBRATION: 'direct_calibration',
  TRAINING_OBSERVATION: 'training_observation',
});

export const DIRECT_EVIDENCE_SOURCES = Object.freeze({
  CALIBRATION: 'calibration',
  MATRIX: 'matrix',
  RANGE_BUILDER: 'range_builder',
});

export const RANGE_OBSERVATION_STATES = Object.freeze({
  ACTIVE: 'active',
  RETRACTED: 'retracted',
});

export const CALIBRATION_SESSION_STATES = Object.freeze({
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});

export const DIRECT_COMPARISON_RELATIONS = Object.freeze({
  MATCHES: 'matches',
  DEVIATES: 'deviates',
});

const ACTION_TYPE_VALUES = Object.freeze(Object.values(ACTION_TYPES));
const ANTE_TYPE_VALUES = Object.freeze(Object.values(ANTE_TYPES));
const PROFILE_STATE_VALUES = Object.freeze(Object.values(PROFILE_STATES));
const OBSERVATION_STATE_VALUES = Object.freeze(Object.values(RANGE_OBSERVATION_STATES));
const SESSION_STATE_VALUES = Object.freeze(Object.values(CALIBRATION_SESSION_STATES));
const COMPARISON_RELATION_VALUES = Object.freeze(Object.values(DIRECT_COMPARISON_RELATIONS));
const DIRECT_EVIDENCE_SOURCE_VALUES = Object.freeze(Object.values(DIRECT_EVIDENCE_SOURCES));
const FREQUENCY_TOLERANCE = 1e-12;
const PERSONAL_STRATEGY_ACTION_ORDER = Object.freeze([
  ACTION_TYPES.FOLD,
  ACTION_TYPES.CHECK,
  ACTION_TYPES.CALL,
  ACTION_TYPES.RAISE,
  ACTION_TYPES.ALL_IN,
]);
const PERSONAL_STRATEGY_ACTION_INDEX = new Map(
  PERSONAL_STRATEGY_ACTION_ORDER.map((type, index) => [type, index]),
);
const CALIBRATION_DECISION_FAMILY_VALUES = Object.freeze(
  Object.values(CALIBRATION_DECISION_FAMILIES),
);
const CALIBRATION_STACK_BASIS_VALUES = Object.freeze(
  Object.values(CALIBRATION_CONTEXT_STACK_BASES),
);
const PRIOR_ACTION_FAMILY_VALUES = Object.freeze(
  Object.values(CALIBRATION_PRIOR_ACTION_FAMILIES),
);

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

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(value, expected, label) {
  requireObject(value, label);
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length
    || actual.some((key, index) => key !== canonical[index])) {
    throw new RangeError(`${label} contains unsupported or missing fields`);
  }
  return value;
}

function requireSchema(value, expected, label) {
  requireObject(value, label);
  if (value.schemaVersion !== expected) throw new TypeError(`Expected ${expected}`);
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

function optionalString(value, label) {
  if (value === null || value === undefined) return null;
  return requireString(value, label);
}

function requireIsoTimestamp(value, label) {
  requireString(value, label);
  if (!Number.isFinite(Date.parse(value))) throw new TypeError(`${label} must be an ISO timestamp`);
  return value;
}

function requireChronology(createdAt, updatedAt, label) {
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new RangeError(`${label}.updatedAt cannot precede createdAt`);
  }
}

function requireFiniteNonNegative(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`);
  }
  return numeric;
}

function requireFinitePositive(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new RangeError(`${label} must be a finite positive number`);
  }
  return numeric;
}

function requireNullableFiniteNonNegative(value, label) {
  if (value === null) return null;
  return requireFiniteNonNegative(value, label);
}

function requireUniqueStrings(values, label, expectedLength = null) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array`);
  const normalized = values.map((value, index) => requireString(value, `${label}[${index}]`));
  if (expectedLength !== null && normalized.length !== expectedLength) {
    throw new RangeError(`${label} must contain exactly ${expectedLength} entries`);
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new RangeError(`${label} must not contain duplicates`);
  }
  return normalized;
}

function requireActionIdentity(value, label) {
  requireObject(value, label);
  if (!ACTION_TYPE_VALUES.includes(value.type)) {
    throw new RangeError(`${label}.type must be a canonical poker action type`);
  }
  return value;
}

function actionIdentity(value) {
  return deepFreeze({ type: requireActionIdentity(value, 'action').type });
}

function validateAccounting(accounting) {
  requireObject(accounting, 'CalibrationContext.accounting');
  if (!ANTE_TYPE_VALUES.includes(accounting.anteType)) {
    throw new RangeError('CalibrationContext.accounting.anteType is unsupported');
  }
  requireFiniteNonNegative(accounting.anteBb, 'CalibrationContext.accounting.anteBb');
  requireFiniteNonNegative(
    accounting.forcedContributionPerPlayerBb,
    'CalibrationContext.accounting.forcedContributionPerPlayerBb',
  );
  requireString(accounting.rakeMode, 'CalibrationContext.accounting.rakeMode');
  if (accounting.anteType === ANTE_TYPES.NONE && accounting.anteBb !== 0) {
    throw new RangeError('No-ante CalibrationContext must use anteBb 0');
  }
  return accounting;
}

function normalizedPersonalStrategyLegalActions(legalActions, label = 'CalibrationContext.legalActions') {
  if (!Array.isArray(legalActions) || legalActions.length === 0) {
    throw new RangeError(`${label} must be a non-empty array`);
  }
  const types = legalActions.map((entry, index) => {
    const type = typeof entry === 'string' ? entry : entry?.type;
    if (!PERSONAL_STRATEGY_ACTION_INDEX.has(type)) {
      throw new RangeError(`${label}[${index}] must be a canonical Personal Strategy action`);
    }
    return type;
  });
  if (new Set(types).size !== types.length) {
    throw new RangeError(`${label} must not repeat an action identity`);
  }
  return [...types].sort(
    (left, right) => PERSONAL_STRATEGY_ACTION_INDEX.get(left) - PERSONAL_STRATEGY_ACTION_INDEX.get(right),
  );
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

export function validatePersonalStrategyLegalActionsForDecisionFamily(
  decisionFamily,
  legalActions,
) {
  if (!CALIBRATION_DECISION_FAMILY_VALUES.includes(decisionFamily)) {
    throw new RangeError(`Unsupported CalibrationContext family: ${decisionFamily}`);
  }
  const types = normalizedPersonalStrategyLegalActions(legalActions);
  const canonical = normalizedPersonalStrategyLegalActions(types);
  if (!sameStrings(types, canonical)) {
    throw new RangeError('CalibrationContext legal actions must use canonical identity order');
  }
  const includes = (type) => types.includes(type);
  if (decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI) {
    const legacyCompatibility = sameStrings(types, [ACTION_TYPES.FOLD, ACTION_TYPES.RAISE]);
    const canonical = includes(ACTION_TYPES.FOLD)
      && includes(ACTION_TYPES.CALL)
      && includes(ACTION_TYPES.RAISE)
      && !includes(ACTION_TYPES.CHECK)
      && types.every((type) => [
        ACTION_TYPES.FOLD,
        ACTION_TYPES.CALL,
        ACTION_TYPES.RAISE,
        ACTION_TYPES.ALL_IN,
      ].includes(type));
    if (!legacyCompatibility && !canonical) {
      throw new RangeError('preflop_rfi legal actions require Fold, Call, and Raise, with optional All-in');
    }
    return types;
  }
  if (decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION) {
    const valid = includes(ACTION_TYPES.CHECK)
      && !includes(ACTION_TYPES.FOLD)
      && !includes(ACTION_TYPES.CALL)
      && types.every((type) => [ACTION_TYPES.CHECK, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN].includes(type));
    if (!valid) {
      throw new RangeError('preflop_bb_option legal actions require Check, with optional Raise and All-in');
    }
    return types;
  }
  const valid = includes(ACTION_TYPES.FOLD)
    && includes(ACTION_TYPES.CALL)
    && !includes(ACTION_TYPES.CHECK)
    && types.every((type) => [ACTION_TYPES.FOLD, ACTION_TYPES.CALL, ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN].includes(type));
  if (!valid) {
    throw new RangeError(`${decisionFamily} legal actions require Fold and Call, with optional Raise and All-in`);
  }
  return types;
}

export function createLocalOwnerRef(id) {
  return deepFreeze({ kind: PROFILE_OWNER_KINDS.LOCAL, id: requireString(id, 'ownerRef.id') });
}

export function validateProfileOwnerRef(ownerRef) {
  requireObject(ownerRef, 'ownerRef');
  if (ownerRef.kind !== PROFILE_OWNER_KINDS.LOCAL) {
    throw new RangeError(`Unsupported profile owner kind: ${ownerRef.kind}`);
  }
  requireString(ownerRef.id, 'ownerRef.id');
  return ownerRef;
}

export function sameOwnerRef(left, right) {
  validateProfileOwnerRef(left);
  validateProfileOwnerRef(right);
  return left.kind === right.kind && left.id === right.id;
}

function versionSnapshot(value) {
  const { versionHistory, ...snapshot } = cloneData(value);
  return snapshot;
}

function validateVersionedMetadata(value, field) {
  if (!Number.isInteger(value[field]) || value[field] < 1) throw new RangeError(`${field} must be positive`);
  if (!Array.isArray(value.versionHistory) || value.versionHistory.length !== value[field] - 1) {
    throw new RangeError('Version history must preserve every preceding version');
  }
  value.versionHistory.forEach((entry, index) => {
    if (entry[field] !== index + 1 || entry.id !== value.id || entry.versionHistory !== undefined) {
      throw new RangeError('Version history identity or order is invalid');
    }
  });
}

export function migrateStrategyProfile(profile) {
  if (profile.schemaVersion === STRATEGY_PROFILE_SCHEMA_VERSION) {
    validateStrategyProfile(profile); return deepFreeze(cloneData(profile));
  }
  if (profile.schemaVersion !== 'strategy-profile/v1') throw new RangeError('Unsupported StrategyProfile schema');
  requireUniqueStrings(profile.modeIds, 'Legacy StrategyProfile.modeIds', 3);
  const migrated = { ...cloneData(profile), schemaVersion: STRATEGY_PROFILE_SCHEMA_VERSION,
    setupAssumptions: {}, setupVersion: 1, versionHistory: [] };
  validateStrategyProfile(migrated); return deepFreeze(migrated);
}

export function migrateStrategyMode(mode) {
  if (mode.schemaVersion === STRATEGY_MODE_SCHEMA_VERSION) {
    validateStrategyMode(mode); return deepFreeze(cloneData(mode));
  }
  if (mode.schemaVersion !== 'strategy-mode/v1') throw new RangeError('Unsupported StrategyMode schema');
  const migrated = { ...cloneData(mode), schemaVersion: STRATEGY_MODE_SCHEMA_VERSION,
    approachVersion: 1, versionHistory: [], forkProvenance: null };
  validateStrategyMode(migrated); return deepFreeze(migrated);
}

export function validateStrategyProfile(profile) {
  requireSchema(profile, STRATEGY_PROFILE_SCHEMA_VERSION, 'StrategyProfile');
  requireString(profile.id, 'StrategyProfile.id');
  validateProfileOwnerRef(profile.ownerRef);
  requireString(profile.displayName, 'StrategyProfile.displayName');
  optionalString(profile.description, 'StrategyProfile.description');
  requireIsoTimestamp(profile.createdAt, 'StrategyProfile.createdAt');
  requireIsoTimestamp(profile.updatedAt, 'StrategyProfile.updatedAt');
  requireChronology(profile.createdAt, profile.updatedAt, 'StrategyProfile');
  if (profile.gameDomain !== POKER_VARIANT) {
    throw new RangeError(`StrategyProfile.gameDomain must be ${POKER_VARIANT}`);
  }
  requireUniqueStrings(profile.modeIds, 'StrategyProfile.modeIds');
  if (!profile.modeIds.length) throw new RangeError('Game Setup requires at least one Approach');
  validateVersionedMetadata(profile, 'setupVersion');
  requireObject(profile.setupAssumptions, 'Game Setup assumptions');
  requireUniqueStrings(profile.tags, 'StrategyProfile.tags');
  if (!PROFILE_STATE_VALUES.includes(profile.state)) {
    throw new RangeError(`Unsupported StrategyProfile state: ${profile.state}`);
  }
  return profile;
}

export function createStrategyProfile({
  id,
  ownerRef,
  displayName,
  description = null,
  createdAt,
  updatedAt = createdAt,
  gameDomain = POKER_VARIANT,
  tags = [],
  modeIds,
  setupAssumptions = {},
  setupVersion = 1,
  versionHistory = [],
  state = PROFILE_STATES.ACTIVE,
} = {}) {
  const profile = {
    schemaVersion: STRATEGY_PROFILE_SCHEMA_VERSION,
    id: requireString(id, 'StrategyProfile.id'),
    ownerRef: cloneData(ownerRef),
    displayName: requireString(displayName, 'StrategyProfile.displayName'),
    description: optionalString(description, 'StrategyProfile.description'),
    createdAt,
    updatedAt,
    gameDomain,
    tags: [...tags],
    modeIds: [...(modeIds ?? [])],
    setupAssumptions: cloneData(setupAssumptions),
    setupVersion,
    versionHistory: cloneData(versionHistory),
    state,
  };
  validateStrategyProfile(profile);
  return deepFreeze(profile);
}

export function updateStrategyProfile(profile, changes = {}, updatedAt) {
  validateStrategyProfile(profile);
  return createStrategyProfile({
    ...profile,
    setupAssumptions: changes.setupAssumptions ?? profile.setupAssumptions,
    setupVersion: profile.setupVersion + 1,
    versionHistory: [...profile.versionHistory, versionSnapshot(profile)],
    displayName: changes.displayName ?? profile.displayName,
    description: Object.hasOwn(changes, 'description') ? changes.description : profile.description,
    tags: changes.tags ?? profile.tags,
    state: changes.state ?? profile.state,
    updatedAt,
  });
}

export function validateStrategyMode(mode) {
  requireSchema(mode, STRATEGY_MODE_SCHEMA_VERSION, 'StrategyMode');
  validateVersionedMetadata(mode, 'approachVersion');
  if (mode.forkProvenance !== null) requireObject(mode.forkProvenance, 'Approach fork provenance');
  requireString(mode.id, 'StrategyMode.id');
  requireString(mode.profileId, 'StrategyMode.profileId');
  requireString(mode.displayName, 'StrategyMode.displayName');
  optionalString(mode.description, 'StrategyMode.description');
  requireIsoTimestamp(mode.createdAt, 'StrategyMode.createdAt');
  requireIsoTimestamp(mode.updatedAt, 'StrategyMode.updatedAt');
  requireChronology(mode.createdAt, mode.updatedAt, 'StrategyMode');
  if (!Number.isInteger(mode.displayOrder) || mode.displayOrder < 0) {
    throw new RangeError('StrategyMode.displayOrder must be a non-negative integer');
  }
  if (!PROFILE_STATE_VALUES.includes(mode.state)) {
    throw new RangeError(`Unsupported StrategyMode state: ${mode.state}`);
  }
  if (Object.hasOwn(mode, 'styleValue') || Object.hasOwn(mode, 'interpolationCoordinate')) {
    throw new RangeError('StrategyMode does not support numeric style/interpolation coordinates');
  }
  return mode;
}

export function createStrategyMode({
  id,
  profileId,
  displayName,
  description = null,
  createdAt,
  updatedAt = createdAt,
  displayOrder,
  approachVersion = 1,
  versionHistory = [],
  forkProvenance = null,
  state = PROFILE_STATES.ACTIVE,
} = {}) {
  const mode = {
    schemaVersion: STRATEGY_MODE_SCHEMA_VERSION,
    id: requireString(id, 'StrategyMode.id'),
    profileId: requireString(profileId, 'StrategyMode.profileId'),
    displayName: requireString(displayName, 'StrategyMode.displayName'),
    description: optionalString(description, 'StrategyMode.description'),
    createdAt,
    updatedAt,
    displayOrder,
    approachVersion,
    versionHistory: cloneData(versionHistory),
    forkProvenance: cloneData(forkProvenance),
    state,
  };
  validateStrategyMode(mode);
  return deepFreeze(mode);
}

export function updateStrategyMode(mode, changes = {}, updatedAt) {
  validateStrategyMode(mode);
  return createStrategyMode({
    ...mode,
    approachVersion: mode.approachVersion + 1,
    versionHistory: [...mode.versionHistory, versionSnapshot(mode)],
    displayName: changes.displayName ?? mode.displayName,
    description: Object.hasOwn(changes, 'description') ? changes.description : mode.description,
    displayOrder: changes.displayOrder ?? mode.displayOrder,
    state: changes.state ?? mode.state,
    updatedAt,
  });
}

export function createStrategyProfileBundle({
  profileId,
  ownerRef,
  displayName,
  description = null,
  tags = [],
  modes,
  createdAt,
  modeIds,
  setupAssumptions = {},
} = {}) {
  if (!Array.isArray(modes) || modes.length < 1) {
    throw new RangeError('A Game Setup bundle requires at least one user-named Approach');
  }
  const ids = requireUniqueStrings(modeIds, 'modeIds', modes.length);
  const strategyModes = modes.map((entry, index) => createStrategyMode({
    id: ids[index],
    profileId,
    displayName: typeof entry === 'string' ? entry : entry?.displayName,
    description: typeof entry === 'string' ? null : entry?.description ?? null,
    createdAt,
    displayOrder: index,
  }));
  const profile = createStrategyProfile({
    id: profileId,
    ownerRef,
    displayName,
    description,
    tags,
    modeIds: ids,
    setupAssumptions,
    createdAt,
  });
  return deepFreeze({ profile, modes: strategyModes });
}

function validateCalibrationContextV1(context) {
  requireSchema(context, CALIBRATION_CONTEXT_SCHEMA_VERSION, 'CalibrationContext');
  if (context.decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI) {
    throw new RangeError(`Unsupported CalibrationContext family: ${context.decisionFamily}`);
  }
  if (context.gameVariant !== POKER_VARIANT) {
    throw new RangeError(`CalibrationContext.gameVariant must be ${POKER_VARIANT}`);
  }
  requireString(context.gameRulesId, 'CalibrationContext.gameRulesId');
  if (!Number.isInteger(context.tableSize) || !POSITIONS_BY_TABLE_SIZE[context.tableSize]) {
    throw new RangeError('CalibrationContext.tableSize must be an integer from 2 through 10');
  }
  if (!POSITIONS_BY_TABLE_SIZE[context.tableSize].includes(context.heroPosition)) {
    throw new RangeError('CalibrationContext.heroPosition does not belong to tableSize');
  }
  requireFinitePositive(context.effectiveStackBb, 'CalibrationContext.effectiveStackBb');
  validateAccounting(context.accounting);
  return context;
}

function calibrationContextV1Key(context) {
  validateCalibrationContextV1(context);
  return JSON.stringify({
    schemaVersion: context.schemaVersion,
    decisionFamily: context.decisionFamily,
    gameVariant: context.gameVariant,
    gameRulesId: context.gameRulesId,
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    effectiveStackBb: context.effectiveStackBb,
    accounting: {
      anteType: context.accounting.anteType,
      anteBb: context.accounting.anteBb,
      forcedContributionPerPlayerBb: context.accounting.forcedContributionPerPlayerBb,
      rakeMode: context.accounting.rakeMode,
    },
  });
}

function validateCalibrationGameRulesV2(gameRules) {
  requireExactKeys(gameRules, ['identity', 'ante', 'collection'], 'CalibrationContext.gameRules');
  requireExactKeys(gameRules.identity, ['kind', 'value'], 'CalibrationContext.gameRules.identity');
  const identityKind = gameRules.identity.kind;
  if (!Object.values(CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS).includes(identityKind)) {
    throw new RangeError('CalibrationContext.gameRules identity kind is unsupported');
  }
  requireString(gameRules.identity.value, 'CalibrationContext.gameRules.identity.value');
  if (identityKind === CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS.SEMANTIC_FINGERPRINT
    && !gameRules.identity.value.startsWith('game-rules-semantic/v1:')) {
    throw new RangeError('CalibrationContext requires a canonical Game Rules semantic fingerprint');
  }
  requireExactKeys(gameRules.ante, ['type', 'amountBb'], 'CalibrationContext.gameRules.ante');
  if (!ANTE_TYPE_VALUES.includes(gameRules.ante.type)) {
    throw new RangeError('CalibrationContext.gameRules.ante.type is unsupported');
  }
  requireFiniteNonNegative(gameRules.ante.amountBb, 'CalibrationContext.gameRules.ante.amountBb');
  if (gameRules.ante.type === ANTE_TYPES.NONE && gameRules.ante.amountBb !== 0) {
    throw new RangeError('No-ante CalibrationContext v2 must use amountBb 0');
  }
  requireObject(gameRules.collection, 'CalibrationContext.gameRules.collection');
  if (gameRules.collection.type === 'legacy_accounting') {
    requireExactKeys(
      gameRules.collection,
      ['type', 'amountPerPlayerBb', 'rakeMode'],
      'CalibrationContext.gameRules.collection',
    );
    if (identityKind !== CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS.LEGACY_OPAQUE_ID) {
      throw new RangeError('Legacy accounting requires a legacy opaque Game Rules identity');
    }
    requireString(gameRules.collection.rakeMode, 'CalibrationContext.gameRules.collection.rakeMode');
  } else {
    requireExactKeys(
      gameRules.collection,
      ['type', 'amountPerPlayerBb'],
      'CalibrationContext.gameRules.collection',
    );
    if (!['none', 'fixed_per_seated_player'].includes(gameRules.collection.type)) {
      throw new RangeError('CalibrationContext.gameRules.collection.type is unsupported');
    }
    if (identityKind !== CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS.SEMANTIC_FINGERPRINT) {
      throw new RangeError('Canonical collection facts require semantic Game Rules identity');
    }
  }
  requireFiniteNonNegative(
    gameRules.collection.amountPerPlayerBb,
    'CalibrationContext.gameRules.collection.amountPerPlayerBb',
  );
  if (gameRules.collection.type === 'none' && gameRules.collection.amountPerPlayerBb !== 0) {
    throw new RangeError('No-collection CalibrationContext v2 must use amountPerPlayerBb 0');
  }
  if (gameRules.collection.type === 'fixed_per_seated_player'
    && gameRules.collection.amountPerPlayerBb <= 0) {
    throw new RangeError('Fixed collection requires a positive amountPerPlayerBb');
  }
  return gameRules;
}

function validatePriorActionV2(priorAction, decisionFamily) {
  requireExactKeys(priorAction, [
    'family', 'actionCount', 'foldCount', 'callCount', 'aggressionCount', 'lastAggression',
  ], 'CalibrationContext.priorAction');
  if (!PRIOR_ACTION_FAMILY_VALUES.includes(priorAction.family)) {
    throw new RangeError('CalibrationContext.priorAction.family is unsupported');
  }
  for (const field of ['actionCount', 'foldCount', 'callCount', 'aggressionCount']) {
    if (!Number.isInteger(priorAction[field]) || priorAction[field] < 0) {
      throw new RangeError(`CalibrationContext.priorAction.${field} must be a non-negative integer`);
    }
  }
  if (priorAction.actionCount
    !== priorAction.foldCount + priorAction.callCount + priorAction.aggressionCount) {
    throw new RangeError('CalibrationContext.priorAction counts must cover every summarized action');
  }
  const expected = {
    [CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI]: [CALIBRATION_PRIOR_ACTION_FAMILIES.UNOPENED, 0],
    [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_LIMP]: [CALIBRATION_PRIOR_ACTION_FAMILIES.LIMPED, 0],
    [CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION]: [CALIBRATION_PRIOR_ACTION_FAMILIES.LIMPED, 0],
    [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_OPEN]: [CALIBRATION_PRIOR_ACTION_FAMILIES.OPEN, 1],
    [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_3BET]: [CALIBRATION_PRIOR_ACTION_FAMILIES.THREE_BET, 2],
    [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_4BET]: [CALIBRATION_PRIOR_ACTION_FAMILIES.FOUR_BET, 3],
  }[decisionFamily];
  if (!expected || priorAction.family !== expected[0]
    || priorAction.aggressionCount !== expected[1]) {
    throw new RangeError('CalibrationContext decision family and prior-action summary disagree');
  }
  if (priorAction.family === CALIBRATION_PRIOR_ACTION_FAMILIES.UNOPENED
    && priorAction.callCount !== 0) {
    throw new RangeError('An unopened CalibrationContext cannot contain prior calls');
  }
  if (priorAction.family === CALIBRATION_PRIOR_ACTION_FAMILIES.LIMPED
    && priorAction.callCount < 1) {
    throw new RangeError('A limped CalibrationContext requires at least one prior call');
  }
  if (priorAction.aggressionCount === 0) {
    if (priorAction.lastAggression !== null) {
      throw new RangeError('A non-aggressive prior-action summary cannot contain lastAggression');
    }
    return priorAction;
  }
  requireExactKeys(priorAction.lastAggression, [
    'level', 'actionType', 'raiseToBb', 'incrementBb', 'wasFullRaise',
  ], 'CalibrationContext.priorAction.lastAggression');
  if (priorAction.lastAggression.level !== priorAction.family) {
    throw new RangeError('CalibrationContext last aggression level must match its prior-action family');
  }
  if (![ACTION_TYPES.RAISE, ACTION_TYPES.ALL_IN].includes(priorAction.lastAggression.actionType)) {
    throw new RangeError('CalibrationContext last aggression must be Raise or All-in');
  }
  requireFinitePositive(
    priorAction.lastAggression.raiseToBb,
    'CalibrationContext.priorAction.lastAggression.raiseToBb',
  );
  requireFinitePositive(
    priorAction.lastAggression.incrementBb,
    'CalibrationContext.priorAction.lastAggression.incrementBb',
  );
  if (typeof priorAction.lastAggression.wasFullRaise !== 'boolean') {
    throw new TypeError('CalibrationContext.priorAction.lastAggression.wasFullRaise must be boolean');
  }
  return priorAction;
}

function calibrationContextV2SerializationValue(context) {
  return {
    schemaVersion: context.schemaVersion,
    decisionFamily: context.decisionFamily,
    gameVariant: context.gameVariant,
    gameRules: stableValue(cloneData(context.gameRules)),
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    opponentCount: context.opponentCount,
    stack: stableValue(cloneData(context.stack)),
    priorAction: stableValue(cloneData(context.priorAction)),
    facing: stableValue(cloneData(context.facing)),
    sizing: stableValue(cloneData(context.sizing)),
    legalActions: context.legalActions.map((entry) => ({ type: entry.type })),
    compatibility: stableValue(cloneData(context.compatibility)),
  };
}

function projectCalibrationContextV1Data(context) {
  validateCalibrationContextV1(context);
  return {
    schemaVersion: CALIBRATION_CONTEXT_V2_SCHEMA_VERSION,
    decisionFamily: CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI,
    gameVariant: context.gameVariant,
    gameRules: {
      identity: {
        kind: CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS.LEGACY_OPAQUE_ID,
        value: context.gameRulesId,
      },
      ante: {
        type: context.accounting.anteType,
        amountBb: context.accounting.anteBb,
      },
      collection: {
        type: 'legacy_accounting',
        amountPerPlayerBb: context.accounting.forcedContributionPerPlayerBb,
        rakeMode: context.accounting.rakeMode,
      },
    },
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    opponentCount: null,
    stack: {
      valueBb: context.effectiveStackBb,
      basis: CALIBRATION_CONTEXT_STACK_BASES.LEGACY_CALIBRATION_EFFECTIVE,
    },
    priorAction: {
      family: CALIBRATION_PRIOR_ACTION_FAMILIES.UNOPENED,
      actionCount: 0,
      foldCount: 0,
      callCount: 0,
      aggressionCount: 0,
      lastAggression: null,
    },
    facing: {
      sizeBb: 0,
      callAmountBb: null,
      heroStreetContributionBb: null,
    },
    sizing: {
      currentBetBb: null,
      lastFullRaiseIncrementBb: null,
      minimumRaiseToBb: null,
      maximumNonAllInRaiseToBb: null,
      allInToBb: null,
    },
    legalActions: [
      { type: ACTION_TYPES.FOLD },
      { type: ACTION_TYPES.RAISE },
    ],
    compatibility: {
      sourceSchemaVersion: CALIBRATION_CONTEXT_SCHEMA_VERSION,
      sourceContextKey: calibrationContextV1Key(context),
    },
  };
}

function validateCalibrationContextV2(context) {
  requireSchema(context, CALIBRATION_CONTEXT_V2_SCHEMA_VERSION, 'CalibrationContext');
  requireExactKeys(context, [
    'schemaVersion', 'decisionFamily', 'gameVariant', 'gameRules', 'tableSize',
    'heroPosition', 'opponentCount', 'stack', 'priorAction', 'facing', 'sizing',
    'legalActions', 'compatibility',
  ], 'CalibrationContext v2');
  if (!CALIBRATION_DECISION_FAMILY_VALUES.includes(context.decisionFamily)) {
    throw new RangeError(`Unsupported CalibrationContext family: ${context.decisionFamily}`);
  }
  if (context.gameVariant !== POKER_VARIANT) {
    throw new RangeError(`CalibrationContext.gameVariant must be ${POKER_VARIANT}`);
  }
  validateCalibrationGameRulesV2(context.gameRules);
  if (!Number.isInteger(context.tableSize) || !POSITIONS_BY_TABLE_SIZE[context.tableSize]) {
    throw new RangeError('CalibrationContext.tableSize must be an integer from 2 through 10');
  }
  if (!POSITIONS_BY_TABLE_SIZE[context.tableSize].includes(context.heroPosition)) {
    throw new RangeError('CalibrationContext.heroPosition does not belong to tableSize');
  }
  if (context.opponentCount !== null
    && (!Number.isInteger(context.opponentCount)
      || context.opponentCount < 1 || context.opponentCount >= context.tableSize)) {
    throw new RangeError('CalibrationContext.opponentCount must be null or a live-opponent count');
  }
  requireExactKeys(context.stack, ['valueBb', 'basis'], 'CalibrationContext.stack');
  requireFinitePositive(context.stack.valueBb, 'CalibrationContext.stack.valueBb');
  if (!CALIBRATION_STACK_BASIS_VALUES.includes(context.stack.basis)) {
    throw new RangeError('CalibrationContext.stack.basis is unsupported');
  }
  validatePriorActionV2(context.priorAction, context.decisionFamily);
  requireExactKeys(
    context.facing,
    ['sizeBb', 'callAmountBb', 'heroStreetContributionBb'],
    'CalibrationContext.facing',
  );
  requireFiniteNonNegative(context.facing.sizeBb, 'CalibrationContext.facing.sizeBb');
  requireNullableFiniteNonNegative(
    context.facing.callAmountBb,
    'CalibrationContext.facing.callAmountBb',
  );
  requireNullableFiniteNonNegative(
    context.facing.heroStreetContributionBb,
    'CalibrationContext.facing.heroStreetContributionBb',
  );
  requireExactKeys(context.sizing, [
    'currentBetBb', 'lastFullRaiseIncrementBb', 'minimumRaiseToBb',
    'maximumNonAllInRaiseToBb', 'allInToBb',
  ], 'CalibrationContext.sizing');
  for (const field of Object.keys(context.sizing)) {
    requireNullableFiniteNonNegative(context.sizing[field], `CalibrationContext.sizing.${field}`);
  }
  const types = context.legalActions.map((entry) => entry?.type);
  const canonicalTypes = validatePersonalStrategyLegalActionsForDecisionFamily(
    context.decisionFamily,
    context.legalActions,
  );
  if (!sameStrings(types, canonicalTypes)) {
    throw new RangeError('CalibrationContext legal actions must use canonical identity order');
  }
  const hasRaise = types.includes(ACTION_TYPES.RAISE);
  const hasAllIn = types.includes(ACTION_TYPES.ALL_IN);
  if (context.compatibility === null) {
    if (context.gameRules.identity.kind
      !== CALIBRATION_CONTEXT_GAME_RULES_IDENTITY_KINDS.SEMANTIC_FINGERPRINT
      || context.opponentCount === null
      || context.stack.basis !== CALIBRATION_CONTEXT_STACK_BASES.EFFECTIVE_LIVE_POT_CAPACITY
      || context.facing.callAmountBb === null
      || context.facing.heroStreetContributionBb === null
      || context.sizing.currentBetBb === null
      || context.sizing.lastFullRaiseIncrementBb === null) {
      throw new RangeError('Canonical CalibrationContext v2 facts must be complete and semantically identified');
    }
    if (context.decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
      && !types.includes(ACTION_TYPES.CALL)) {
      throw new RangeError('Canonical preflop_rfi context must retain legal Call for Limp presentation');
    }
    if (hasRaise !== (context.sizing.minimumRaiseToBb !== null
      && context.sizing.maximumNonAllInRaiseToBb !== null)) {
      throw new RangeError('CalibrationContext Raise legality and sizing bounds disagree');
    }
    if (hasAllIn !== (context.sizing.allInToBb !== null)) {
      throw new RangeError('CalibrationContext All-in legality and sizing disagree');
    }
    const isFacingAggression = context.priorAction.aggressionCount > 0;
    if (context.facing.sizeBb !== (isFacingAggression
      ? context.priorAction.lastAggression.raiseToBb : 0)) {
      throw new RangeError('CalibrationContext facing size must be the last aggressive raise-to amount');
    }
    if (context.decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION) {
      if (context.facing.callAmountBb !== 0) {
        throw new RangeError('A preflop BB option must have zero incremental call amount');
      }
    } else if (context.decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
      && context.facing.callAmountBb <= 0) {
      throw new RangeError('A facing preflop family requires a positive incremental call amount');
    }
  } else {
    requireExactKeys(
      context.compatibility,
      ['sourceSchemaVersion', 'sourceContextKey'],
      'CalibrationContext.compatibility',
    );
    if (context.compatibility.sourceSchemaVersion !== CALIBRATION_CONTEXT_SCHEMA_VERSION) {
      throw new RangeError('CalibrationContext v2 compatibility source is unsupported');
    }
    requireString(context.compatibility.sourceContextKey, 'CalibrationContext.compatibility.sourceContextKey');
    let legacy;
    try {
      legacy = JSON.parse(context.compatibility.sourceContextKey);
    } catch (error) {
      throw new TypeError(`CalibrationContext legacy compatibility key is invalid JSON: ${error.message}`);
    }
    validateCalibrationContextV1(legacy);
    const expected = projectCalibrationContextV1Data(legacy);
    if (JSON.stringify(calibrationContextV2SerializationValue(context))
      !== JSON.stringify(calibrationContextV2SerializationValue(expected))) {
      throw new RangeError('CalibrationContext v2 is not the deterministic projection of its v1 source');
    }
  }
  return context;
}

export function validateCalibrationContext(context) {
  if (context?.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION) {
    return validateCalibrationContextV1(context);
  }
  if (context?.schemaVersion === CALIBRATION_CONTEXT_V2_SCHEMA_VERSION) {
    return validateCalibrationContextV2(context);
  }
  throw new TypeError(
    `Expected ${CALIBRATION_CONTEXT_SCHEMA_VERSION} or ${CALIBRATION_CONTEXT_V2_SCHEMA_VERSION}`,
  );
}

export function createRfiCalibrationContext({
  gameRulesId,
  tableSize,
  heroPosition,
  effectiveStackBb,
  accounting = {},
} = {}) {
  const context = {
    schemaVersion: CALIBRATION_CONTEXT_SCHEMA_VERSION,
    decisionFamily: CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI,
    gameVariant: POKER_VARIANT,
    gameRulesId: requireString(gameRulesId, 'CalibrationContext.gameRulesId'),
    tableSize,
    heroPosition,
    effectiveStackBb: Number(effectiveStackBb),
    accounting: {
      anteType: accounting.anteType ?? ANTE_TYPES.NONE,
      anteBb: Number(accounting.anteBb ?? 0),
      forcedContributionPerPlayerBb: Number(accounting.forcedContributionPerPlayerBb ?? 0),
      rakeMode: accounting.rakeMode ?? 'off',
    },
  };
  validateCalibrationContext(context);
  return deepFreeze(context);
}

export function createPreflopCalibrationContextV2({
  decisionFamily,
  gameRules,
  tableSize,
  heroPosition,
  opponentCount,
  stack,
  priorAction,
  facing,
  sizing,
  legalActions,
  compatibility = null,
} = {}) {
  const orderedTypes = normalizedPersonalStrategyLegalActions(legalActions);
  const context = {
    schemaVersion: CALIBRATION_CONTEXT_V2_SCHEMA_VERSION,
    decisionFamily,
    gameVariant: POKER_VARIANT,
    gameRules: cloneData(gameRules),
    tableSize,
    heroPosition,
    opponentCount,
    stack: cloneData(stack),
    priorAction: cloneData(priorAction),
    facing: cloneData(facing),
    sizing: cloneData(sizing),
    legalActions: orderedTypes.map((type) => ({ type })),
    compatibility: cloneData(compatibility),
  };
  validateCalibrationContextV2(context);
  return deepFreeze(context);
}

export function projectCalibrationContextV1ToV2(context) {
  return deepFreeze(projectCalibrationContextV1Data(context));
}

export function calibrationContextKey(context) {
  validateCalibrationContext(context);
  return context.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION
    ? calibrationContextV1Key(context)
    : JSON.stringify(calibrationContextV2SerializationValue(context));
}

export function calibrationContextIdentityKey(context) {
  if (context.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION) {
    return `calibration-context-equivalence/v1:${calibrationContextV1Key(context)}`;
  }
  validateCalibrationContextV2(context);
  if (context.compatibility !== null) {
    return `calibration-context-equivalence/v1:${context.compatibility.sourceContextKey}`;
  }
  return JSON.stringify(calibrationContextV2SerializationValue(context));
}

export function calibrationContextKeyAliases(context) {
  let keys;
  if (context.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION) {
    const legacyKey = calibrationContextV1Key(context);
    keys = [legacyKey, JSON.stringify(calibrationContextV2SerializationValue(
      projectCalibrationContextV1Data(context),
    ))];
  } else {
    validateCalibrationContextV2(context);
    const currentKey = JSON.stringify(calibrationContextV2SerializationValue(context));
    keys = context.compatibility === null
      ? [currentKey]
      : [currentKey, context.compatibility.sourceContextKey];
  }
  return deepFreeze([...new Set(keys)]);
}

export function calibrationContextsEquivalent(left, right) {
  if (left.schemaVersion === right.schemaVersion) {
    return left.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION
      ? calibrationContextV1Key(left) === calibrationContextV1Key(right)
      : calibrationContextKey(left) === calibrationContextKey(right);
  }
  const legacy = left.schemaVersion === CALIBRATION_CONTEXT_SCHEMA_VERSION ? left : right;
  const current = left.schemaVersion === CALIBRATION_CONTEXT_V2_SCHEMA_VERSION ? left : right;
  validateCalibrationContextV2(current);
  return current.compatibility !== null
    && current.compatibility.sourceContextKey === calibrationContextV1Key(legacy);
}

export function serializeCalibrationContext(context) {
  return calibrationContextKey(context);
}

export function parseCalibrationContextSerialization(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new TypeError(`CalibrationContext serialization is invalid JSON: ${error.message}`);
  }
  validateCalibrationContext(parsed);
  return deepFreeze(cloneData(parsed));
}

function normalizeFrequencies(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new RangeError('Explicit frequencies must be a non-empty array');
  }
  const prepared = entries.map((entry, index) => {
    requireObject(entry, `frequencies[${index}]`);
    const action = actionIdentity(entry.action);
    const weight = Number(entry.probability ?? entry.weight);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RangeError(`frequencies[${index}].probability must be non-negative`);
    }
    return { action, weight };
  });
  const types = prepared.map((entry) => entry.action.type);
  if (new Set(types).size !== types.length) {
    throw new RangeError('Explicit frequencies must not repeat an action identity');
  }
  const positive = prepared.filter((entry) => entry.weight > 0);
  const maximumWeight = positive.reduce((maximum, entry) => Math.max(maximum, entry.weight), 0);
  if (!(maximumWeight > 0)) throw new RangeError('Explicit frequencies require positive total weight');
  const scaled = positive.map((entry) => ({
    action: entry.action,
    weight: entry.weight / maximumWeight,
  })).filter((entry) => entry.weight > 0);
  const total = scaled.reduce((sum, entry) => sum + entry.weight, 0);
  const normalized = scaled.map((entry) => ({
    action: { ...entry.action },
    probability: entry.weight / total,
  }));
  while (normalized.length > 0) {
    const prefix = normalized
      .slice(0, -1)
      .reduce((sum, entry) => sum + entry.probability, 0);
    const residual = 1 - prefix;
    if (residual > 0) {
      normalized[normalized.length - 1].probability = residual;
      break;
    }
    normalized.pop();
  }
  return deepFreeze(normalized);
}

function validateNormalizedFrequencies(frequencies, dominantAction) {
  if (!Array.isArray(frequencies) || frequencies.length === 0) {
    throw new RangeError('RangeObservation frequencies must be a non-empty array when supplied');
  }
  const types = [];
  let total = 0;
  let maximum = -1;
  for (const [index, entry] of frequencies.entries()) {
    requireObject(entry, `RangeObservation.frequencies[${index}]`);
    requireActionIdentity(entry.action, `RangeObservation.frequencies[${index}].action`);
    if (!Number.isFinite(entry.probability) || entry.probability <= 0 || entry.probability > 1) {
      throw new RangeError('RangeObservation frequency probabilities must be in (0, 1]');
    }
    types.push(entry.action.type);
    total += entry.probability;
    maximum = Math.max(maximum, entry.probability);
  }
  if (new Set(types).size !== types.length) {
    throw new RangeError('RangeObservation frequencies must not repeat an action identity');
  }
  if (Math.abs(total - 1) > FREQUENCY_TOLERANCE) {
    throw new RangeError('RangeObservation frequencies must normalize to 1');
  }
  const maximumEntries = frequencies.filter(
    (entry) => Math.abs(entry.probability - maximum) <= FREQUENCY_TOLERANCE,
  );
  if (maximumEntries.length > 1) {
    if (dominantAction !== null) {
      throw new RangeError('A tied explicit RangeObservation mix cannot claim a dominantAction');
    }
  } else {
    requireActionIdentity(dominantAction, 'RangeObservation.dominantAction');
    if (maximumEntries[0].action.type !== dominantAction.type) {
      throw new RangeError('RangeObservation dominantAction must be the unique maximum-frequency action');
    }
  }
}

export function rangeObservationKey(observation) {
  return [
    observation.profileId,
    observation.modeId,
    calibrationContextKey(observation.context),
    observation.handClass,
  ].join('|');
}

export function rangeObservationIdentityKey(observation) {
  return [
    observation.profileId,
    observation.modeId,
    calibrationContextIdentityKey(observation.context),
    observation.handClass,
  ].join('|');
}

export function rangeObservationKeyAliases(observation) {
  return deepFreeze(calibrationContextKeyAliases(observation.context).map((contextKey) => [
    observation.profileId,
    observation.modeId,
    contextKey,
    observation.handClass,
  ].join('|')));
}

export function validateRangeObservation(observation) {
  requireSchema(observation, RANGE_OBSERVATION_SCHEMA_VERSION, 'RangeObservation');
  requireString(observation.id, 'RangeObservation.id');
  requireString(observation.profileId, 'RangeObservation.profileId');
  requireString(observation.modeId, 'RangeObservation.modeId');
  validateCalibrationContext(observation.context);
  if (!isPreflopHandClass(observation.handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${observation.handClass}`);
  }
  if (!OBSERVATION_STATE_VALUES.includes(observation.state)) {
    throw new RangeError(`Unsupported RangeObservation state: ${observation.state}`);
  }
  if (observation.state === RANGE_OBSERVATION_STATES.ACTIVE) {
    if (typeof observation.hasExplicitFrequencies !== 'boolean') {
      throw new TypeError('RangeObservation.hasExplicitFrequencies must be boolean');
    }
    if (observation.hasExplicitFrequencies) {
      validateNormalizedFrequencies(observation.frequencies, observation.dominantAction);
    } else {
      requireActionIdentity(observation.dominantAction, 'RangeObservation.dominantAction');
      if (observation.frequencies !== null) {
        throw new RangeError('Absent frequency detail must be stored as null');
      }
    }
    if (observation.context.schemaVersion === CALIBRATION_CONTEXT_V2_SCHEMA_VERSION) {
      const legalTypes = new Set(observation.context.legalActions.map((entry) => entry.type));
      const suppliedTypes = [
        observation.dominantAction?.type,
        ...(observation.frequencies ?? []).map((entry) => entry.action.type),
      ].filter(Boolean);
      if (suppliedTypes.some((type) => !legalTypes.has(type))) {
        throw new RangeError('RangeObservation action is illegal for its CalibrationContext');
      }
    }
  } else if (observation.dominantAction !== null
    || observation.hasExplicitFrequencies !== false || observation.frequencies !== null) {
    throw new RangeError('A retracted RangeObservation cannot retain an active answer');
  }
  requireObject(observation.provenance, 'RangeObservation.provenance');
  if (observation.provenance.type !== PROFILE_EVIDENCE_TYPES.DIRECT_CALIBRATION) {
    throw new RangeError('RangeObservation v1 is direct-calibration evidence');
  }
  optionalString(
    observation.provenance.calibrationSessionId,
    'RangeObservation.provenance.calibrationSessionId',
  );
  if (observation.provenance.source !== undefined
    && !DIRECT_EVIDENCE_SOURCE_VALUES.includes(observation.provenance.source)) {
    throw new RangeError(`Unsupported RangeObservation evidence source: ${observation.provenance.source}`);
  }
  optionalString(observation.provenance.actionGroupId, 'RangeObservation.provenance.actionGroupId');
  optionalString(observation.provenance.undoesActionGroupId, 'RangeObservation.provenance.undoesActionGroupId');
  if (observation.provenance.source === DIRECT_EVIDENCE_SOURCES.RANGE_BUILDER
    && !observation.provenance.actionGroupId) {
    throw new RangeError('Range Builder evidence requires an action group ID');
  }
  requireObject(observation.revision, 'RangeObservation.revision');
  optionalString(
    observation.revision.supersedesObservationId,
    'RangeObservation.revision.supersedesObservationId',
  );
  requireIsoTimestamp(observation.createdAt, 'RangeObservation.createdAt');
  requireIsoTimestamp(observation.updatedAt, 'RangeObservation.updatedAt');
  requireChronology(observation.createdAt, observation.updatedAt, 'RangeObservation');
  return observation;
}

export function createRangeObservation({
  id,
  profileId,
  modeId,
  context,
  handClass,
  dominantAction,
  frequencies = null,
  state = RANGE_OBSERVATION_STATES.ACTIVE,
  calibrationSessionId = null,
  evidenceSource = null,
  actionGroupId = null,
  undoesActionGroupId = null,
  supersedesObservationId = null,
  createdAt,
  updatedAt = createdAt,
} = {}) {
  const isActive = state === RANGE_OBSERVATION_STATES.ACTIVE;
  const normalizedFrequencies = isActive && frequencies !== null
    ? normalizeFrequencies(frequencies)
    : null;
  const observation = {
    schemaVersion: RANGE_OBSERVATION_SCHEMA_VERSION,
    id: requireString(id, 'RangeObservation.id'),
    profileId: requireString(profileId, 'RangeObservation.profileId'),
    modeId: requireString(modeId, 'RangeObservation.modeId'),
    context: cloneData(context),
    handClass,
    dominantAction: isActive && dominantAction !== null
      ? cloneData(actionIdentity(dominantAction))
      : null,
    hasExplicitFrequencies: isActive && normalizedFrequencies !== null,
    frequencies: normalizedFrequencies === null ? null : cloneData(normalizedFrequencies),
    state,
    provenance: {
      type: PROFILE_EVIDENCE_TYPES.DIRECT_CALIBRATION,
      calibrationSessionId: optionalString(calibrationSessionId, 'calibrationSessionId'),
      ...(evidenceSource === null ? {} : { source: evidenceSource }),
      ...(actionGroupId === null ? {} : { actionGroupId: optionalString(actionGroupId, 'actionGroupId') }),
      ...(undoesActionGroupId === null ? {} : {
        undoesActionGroupId: optionalString(undoesActionGroupId, 'undoesActionGroupId'),
      }),
    },
    revision: {
      supersedesObservationId: optionalString(supersedesObservationId, 'supersedesObservationId'),
    },
    createdAt,
    updatedAt,
  };
  validateRangeObservation(observation);
  return deepFreeze(observation);
}

export function validateTrainingObservation(observation) {
  requireSchema(observation, TRAINING_OBSERVATION_SCHEMA_VERSION, 'TrainingObservation');
  requireString(observation.id, 'TrainingObservation.id');
  requireString(observation.profileId, 'TrainingObservation.profileId');
  requireString(observation.modeId, 'TrainingObservation.modeId');
  validateCalibrationContext(observation.context);
  if (observation.context.schemaVersion !== CALIBRATION_CONTEXT_SCHEMA_VERSION
    || observation.context.decisionFamily !== CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI) {
    throw new RangeError('TrainingObservation v1 supports only legacy preflop_rfi context');
  }
  if (!isPreflopHandClass(observation.handClass)) {
    throw new RangeError(`Unsupported preflop hand class: ${observation.handClass}`);
  }
  requireActionIdentity(observation.chosenAction, 'TrainingObservation.chosenAction');
  requireObject(observation.provenance, 'TrainingObservation.provenance');
  if (observation.provenance.type !== PROFILE_EVIDENCE_TYPES.TRAINING_OBSERVATION) {
    throw new RangeError('TrainingObservation requires training_observation provenance');
  }
  optionalString(observation.provenance.trainingSessionId, 'TrainingObservation.trainingSessionId');
  requireString(observation.provenance.trainingExerciseId, 'TrainingObservation.trainingExerciseId');
  if (observation.directCalibrationComparison !== null) {
    requireObject(observation.directCalibrationComparison, 'directCalibrationComparison');
    requireString(
      observation.directCalibrationComparison.observationId,
      'directCalibrationComparison.observationId',
    );
    if (!COMPARISON_RELATION_VALUES.includes(observation.directCalibrationComparison.relation)) {
      throw new RangeError('Unsupported direct-calibration comparison relation');
    }
  }
  requireIsoTimestamp(observation.createdAt, 'TrainingObservation.createdAt');
  requireIsoTimestamp(observation.updatedAt, 'TrainingObservation.updatedAt');
  requireChronology(observation.createdAt, observation.updatedAt, 'TrainingObservation');
  return observation;
}

export function createTrainingObservation({
  id,
  profileId,
  modeId,
  context,
  handClass,
  chosenAction,
  trainingSessionId = null,
  trainingExerciseId,
  directCalibrationComparison = null,
  createdAt,
  updatedAt = createdAt,
} = {}) {
  const observation = {
    schemaVersion: TRAINING_OBSERVATION_SCHEMA_VERSION,
    id: requireString(id, 'TrainingObservation.id'),
    profileId: requireString(profileId, 'TrainingObservation.profileId'),
    modeId: requireString(modeId, 'TrainingObservation.modeId'),
    context: cloneData(context),
    handClass,
    chosenAction: cloneData(actionIdentity(chosenAction)),
    provenance: {
      type: PROFILE_EVIDENCE_TYPES.TRAINING_OBSERVATION,
      trainingSessionId: optionalString(trainingSessionId, 'trainingSessionId'),
      trainingExerciseId: requireString(trainingExerciseId, 'trainingExerciseId'),
    },
    directCalibrationComparison: directCalibrationComparison === null
      ? null
      : cloneData(directCalibrationComparison),
    createdAt,
    updatedAt,
  };
  validateTrainingObservation(observation);
  return deepFreeze(observation);
}

export function validateCalibrationSession(session) {
  requireSchema(session, CALIBRATION_SESSION_SCHEMA_VERSION, 'CalibrationSession');
  requireString(session.id, 'CalibrationSession.id');
  requireString(session.profileId, 'CalibrationSession.profileId');
  requireString(session.modeId, 'CalibrationSession.modeId');
  validateCalibrationContext(session.contextScope);
  requireIsoTimestamp(session.startedAt, 'CalibrationSession.startedAt');
  requireIsoTimestamp(session.updatedAt, 'CalibrationSession.updatedAt');
  requireChronology(session.startedAt, session.updatedAt, 'CalibrationSession');
  if (!SESSION_STATE_VALUES.includes(session.state)) {
    throw new RangeError(`Unsupported CalibrationSession state: ${session.state}`);
  }
  if (session.state === CALIBRATION_SESSION_STATES.COMPLETED) {
    requireIsoTimestamp(session.completedAt, 'CalibrationSession.completedAt');
  } else if (session.completedAt !== null) {
    throw new RangeError('Only a completed CalibrationSession may set completedAt');
  }
  requireUniqueStrings(session.observationIds, 'CalibrationSession.observationIds');
  requireObject(session.cursor, 'CalibrationSession.cursor');
  if (!Number.isInteger(session.cursor.nextPromptIndex) || session.cursor.nextPromptIndex < 0) {
    throw new RangeError('CalibrationSession.cursor.nextPromptIndex must be non-negative');
  }
  for (const field of [
    'selectionPolicyVersion',
    'stoppingPolicyVersion',
    'coldStartPolicyVersion',
    'calibrationIntent',
    'selectionIntent',
    'rangeTeacherPreset',
  ]) {
    if (session.cursor[field] !== undefined && session.cursor[field] !== null) {
      requireString(session.cursor[field], `CalibrationSession.cursor.${field}`);
    }
  }
  for (const field of ['askedHandClasses', 'skippedHandClasses', 'notSureHandClasses']) {
    if (session.cursor[field] === undefined) continue;
    if (!Array.isArray(session.cursor[field])
      || session.cursor[field].some((handClass) => !isPreflopHandClass(handClass))) {
      throw new RangeError(`CalibrationSession.cursor.${field} must contain canonical hand classes`);
    }
  }
  for (const field of [
    'sessionQuestionCount',
    'additionalQuestionAllowance',
    'refinementBatchSize',
    'refinementBatchRemaining',
  ]) {
    if (session.cursor[field] !== undefined
      && (!Number.isInteger(session.cursor[field]) || session.cursor[field] < 0)) {
      throw new RangeError(`CalibrationSession.cursor.${field} must be non-negative`);
    }
  }
  if (session.cursor.refinementActive !== undefined
    && typeof session.cursor.refinementActive !== 'boolean') {
    throw new TypeError('CalibrationSession.cursor.refinementActive must be a boolean');
  }
  if (session.cursor.lastStopReason !== undefined
    && session.cursor.lastStopReason !== null
    && (typeof session.cursor.lastStopReason !== 'string' || !session.cursor.lastStopReason.trim())) {
    throw new TypeError('CalibrationSession.cursor.lastStopReason must be null or a non-empty string');
  }
  if (session.cursor.forcedHandClass !== undefined
    && session.cursor.forcedHandClass !== null
    && !isPreflopHandClass(session.cursor.forcedHandClass)) {
    throw new RangeError('CalibrationSession.cursor.forcedHandClass must be a canonical hand class or null');
  }
  return session;
}

export function createCalibrationSession({
  id,
  profileId,
  modeId,
  contextScope,
  startedAt,
  updatedAt = startedAt,
  state = CALIBRATION_SESSION_STATES.ACTIVE,
  completedAt = null,
  observationIds = [],
  nextPromptIndex = 0,
  cursor = null,
} = {}) {
  const session = {
    schemaVersion: CALIBRATION_SESSION_SCHEMA_VERSION,
    id: requireString(id, 'CalibrationSession.id'),
    profileId: requireString(profileId, 'CalibrationSession.profileId'),
    modeId: requireString(modeId, 'CalibrationSession.modeId'),
    contextScope: cloneData(contextScope),
    startedAt,
    updatedAt,
    state,
    completedAt,
    observationIds: [...observationIds],
    cursor: {
      ...(cursor === null ? {} : cloneData(cursor)),
      nextPromptIndex,
    },
  };
  validateCalibrationSession(session);
  return deepFreeze(session);
}

export function updateCalibrationSession(session, changes = {}, updatedAt) {
  validateCalibrationSession(session);
  const nextState = changes.state ?? session.state;
  return createCalibrationSession({
    ...session,
    state: nextState,
    completedAt: nextState === CALIBRATION_SESSION_STATES.COMPLETED
      ? changes.completedAt ?? updatedAt
      : null,
    observationIds: changes.observationIds ?? session.observationIds,
    nextPromptIndex: changes.nextPromptIndex ?? session.cursor.nextPromptIndex,
    cursor: {
      ...session.cursor,
      ...(changes.cursor ?? {}),
    },
    updatedAt,
  });
}

export function isStrategyProfile(value) {
  try { return validateStrategyProfile(value) === value; } catch { return false; }
}

export function isStrategyMode(value) {
  try { return validateStrategyMode(value) === value; } catch { return false; }
}

export function isCalibrationContext(value) {
  try { return validateCalibrationContext(value) === value; } catch { return false; }
}

export function isRangeObservation(value) {
  try { return validateRangeObservation(value) === value; } catch { return false; }
}

export function isTrainingObservation(value) {
  try { return validateTrainingObservation(value) === value; } catch { return false; }
}

export function isCalibrationSession(value) {
  try { return validateCalibrationSession(value) === value; } catch { return false; }
}
