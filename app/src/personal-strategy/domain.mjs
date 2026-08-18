import {
  ACTION_TYPES,
  ANTE_TYPES,
  POKER_VARIANT,
  POSITIONS_BY_TABLE_SIZE,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';

export const STRATEGY_PROFILE_SCHEMA_VERSION = 'strategy-profile/v1';
export const STRATEGY_MODE_SCHEMA_VERSION = 'strategy-mode/v1';
export const CALIBRATION_CONTEXT_SCHEMA_VERSION = 'calibration-context/v1';
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
});

export const PROFILE_EVIDENCE_TYPES = Object.freeze({
  DIRECT_CALIBRATION: 'direct_calibration',
  TRAINING_OBSERVATION: 'training_observation',
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
const FREQUENCY_TOLERANCE = 1e-12;

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

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
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
  requireUniqueStrings(profile.modeIds, 'StrategyProfile.modeIds', 3);
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
    state,
  };
  validateStrategyProfile(profile);
  return deepFreeze(profile);
}

export function updateStrategyProfile(profile, changes = {}, updatedAt) {
  validateStrategyProfile(profile);
  return createStrategyProfile({
    ...profile,
    displayName: changes.displayName ?? profile.displayName,
    description: Object.hasOwn(changes, 'description') ? changes.description : profile.description,
    tags: changes.tags ?? profile.tags,
    state: changes.state ?? profile.state,
    updatedAt,
  });
}

export function validateStrategyMode(mode) {
  requireSchema(mode, STRATEGY_MODE_SCHEMA_VERSION, 'StrategyMode');
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
    throw new RangeError('StrategyMode v1 does not support numeric style/interpolation coordinates');
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
    state,
  };
  validateStrategyMode(mode);
  return deepFreeze(mode);
}

export function updateStrategyMode(mode, changes = {}, updatedAt) {
  validateStrategyMode(mode);
  return createStrategyMode({
    ...mode,
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
} = {}) {
  if (!Array.isArray(modes) || modes.length !== 3) {
    throw new RangeError('A StrategyProfile v1 bundle requires exactly three user-named modes');
  }
  const ids = requireUniqueStrings(modeIds, 'modeIds', 3);
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
    createdAt,
  });
  return deepFreeze({ profile, modes: strategyModes });
}

export function validateCalibrationContext(context) {
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

export function calibrationContextKey(context) {
  validateCalibrationContext(context);
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
  for (const field of ['sessionQuestionCount', 'additionalQuestionAllowance']) {
    if (session.cursor[field] !== undefined
      && (!Number.isInteger(session.cursor[field]) || session.cursor[field] < 0)) {
      throw new RangeError(`CalibrationSession.cursor.${field} must be non-negative`);
    }
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
