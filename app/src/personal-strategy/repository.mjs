import {
  DIRECT_COMPARISON_RELATIONS,
  RANGE_OBSERVATION_STATES,
  calibrationContextKey,
  rangeObservationKey,
  sameOwnerRef,
  validateCalibrationContext,
  validateCalibrationSession,
  validateProfileOwnerRef,
  validateRangeObservation,
  validateStrategyMode,
  validateStrategyProfile,
  validateTrainingObservation,
} from './domain.mjs';
import {
  PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION,
  PERSONAL_STRATEGY_DATABASE_NAME,
  PERSONAL_STRATEGY_DATABASE_VERSION,
  PERSONAL_STRATEGY_OBJECT_STORES,
  createIndexedDbPersonalStrategyDatabase,
} from './indexeddb-storage.mjs';
import { PREFLOP_HAND_CLASSES } from '../../../shared/poker-domain/index.js';

export const PERSONAL_STRATEGY_STORE_SCHEMA_VERSION = 'personal-strategy-store/v1';
export const PERSONAL_STRATEGY_EXPORT_SCHEMA_VERSION = 'personal-strategy-export/v1';
export const PERSONAL_STRATEGY_STORAGE_KEY = 'riverline.personalStrategy.v1';

const LEGACY_STORE_SCHEMA_VERSION = 'personal-strategy-store/v0';
const LEGACY_BACKEND_SCHEMA_VERSION = 'personal-strategy-indexeddb/v1';
const LEGACY_DATABASE_VERSION = 1;

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

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value;
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError(`${label} must be an ISO timestamp`);
  }
  return value;
}

function timestampFrom(clock) {
  const value = clock();
  const timestamp = value instanceof Date ? value.toISOString() : String(value);
  return requireTimestamp(timestamp, 'clock result');
}

function idsForStore(store) {
  return [
    ...store.profiles.map((entry) => entry.id),
    ...store.modes.map((entry) => entry.id),
    ...store.rangeObservations.map((entry) => entry.id),
    ...store.trainingObservations.map((entry) => entry.id),
    ...store.calibrationSessions.map((entry) => entry.id),
  ];
}

function requireUniqueIds(store) {
  const ids = idsForStore(store);
  if (new Set(ids).size !== ids.length) {
    throw new RangeError('Personal Strategy object IDs must be globally unique');
  }
}

function profileAndMode(store, profileId, modeId, label) {
  const profile = store.profiles.find((entry) => entry.id === profileId);
  if (!profile) throw new RangeError(`${label} references an unknown profile`);
  const mode = store.modes.find((entry) => entry.id === modeId);
  if (!mode || mode.profileId !== profileId || !profile.modeIds.includes(modeId)) {
    throw new RangeError(`${label} references a mode outside its profile`);
  }
  return { profile, mode };
}

function directRevisionLeaves(observations) {
  const supersededIds = new Set(
    observations
      .map((entry) => entry.revision.supersedesObservationId)
      .filter(Boolean),
  );
  return observations.filter((entry) => !supersededIds.has(entry.id));
}

function validateDirectRevisionGraph(store) {
  const byId = new Map(store.rangeObservations.map((entry) => [entry.id, entry]));
  const byKey = new Map();
  for (const observation of store.rangeObservations) {
    const key = rangeObservationKey(observation);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(observation);
    const parentId = observation.revision.supersedesObservationId;
    if (parentId === null) continue;
    const parent = byId.get(parentId);
    if (!parent) throw new RangeError('RangeObservation supersedes an unknown observation');
    if (rangeObservationKey(parent) !== key) {
      throw new RangeError('RangeObservation revisions must preserve profile, mode, context, and hand');
    }
    if (Date.parse(observation.createdAt) < Date.parse(parent.createdAt)) {
      throw new RangeError('RangeObservation revision cannot precede its parent');
    }
  }
  for (const observations of byKey.values()) {
    const roots = observations.filter((entry) => entry.revision.supersedesObservationId === null);
    if (roots.length < 1 || directRevisionLeaves(observations).length < 1) {
      throw new RangeError('A direct calibration key must retain a root and a current evidence head');
    }
    for (const observation of observations) {
      const seen = new Set([observation.id]);
      let parentId = observation.revision.supersedesObservationId;
      while (parentId !== null) {
        if (seen.has(parentId)) throw new RangeError('RangeObservation revision history cannot contain a cycle');
        seen.add(parentId);
        parentId = byId.get(parentId)?.revision.supersedesObservationId ?? null;
      }
    }
  }
}

function validateProfileGraph(store) {
  const profilesById = new Map(store.profiles.map((entry) => [entry.id, entry]));
  const modesById = new Map(store.modes.map((entry) => [entry.id, entry]));
  for (const profile of store.profiles) {
    if (!sameOwnerRef(profile.ownerRef, store.ownerRef)) {
      throw new RangeError('StrategyProfile owner does not match its local store owner');
    }
    const modes = profile.modeIds.map((modeId) => modesById.get(modeId));
    if (modes.some((mode) => !mode || mode.profileId !== profile.id)) {
      throw new RangeError('StrategyProfile modeIds must resolve to its own StrategyModes');
    }
    const orders = modes.map((mode) => mode.displayOrder);
    if (new Set(orders).size !== orders.length) {
      throw new RangeError('StrategyMode displayOrder must be unique within a profile');
    }
  }
  for (const mode of store.modes) {
    const profile = profilesById.get(mode.profileId);
    if (!profile || !profile.modeIds.includes(mode.id)) {
      throw new RangeError('StrategyMode must be listed by its parent StrategyProfile');
    }
  }
}

function latestDirectRevision(store, candidate) {
  const key = rangeObservationKey(candidate);
  const matching = store.rangeObservations.filter((entry) => rangeObservationKey(entry) === key);
  return directRevisionLeaves(matching)[0] ?? null;
}

function currentDirectObservation(store, candidate) {
  const latest = latestDirectRevision(store, candidate);
  return latest?.state === RANGE_OBSERVATION_STATES.ACTIVE ? latest : null;
}

function validateTrainingComparisons(store) {
  const directById = new Map(store.rangeObservations.map((entry) => [entry.id, entry]));
  for (const training of store.trainingObservations) {
    const comparison = training.directCalibrationComparison;
    if (comparison === null) continue;
    const direct = directById.get(comparison.observationId);
    if (!direct || direct.state !== RANGE_OBSERVATION_STATES.ACTIVE
      || rangeObservationKey(direct) !== rangeObservationKey(training)) {
      throw new RangeError('TrainingObservation comparison must reference matching direct evidence');
    }
    if (direct.dominantAction === null) {
      throw new RangeError('A tied direct mix has no dominant action to compare');
    } else {
      const expected = direct.dominantAction.type === training.chosenAction.type
        ? DIRECT_COMPARISON_RELATIONS.MATCHES
        : DIRECT_COMPARISON_RELATIONS.DEVIATES;
      if (comparison.relation !== expected) {
        throw new RangeError('TrainingObservation direct comparison relation is inconsistent');
      }
    }
  }
}

function validateSessions(store) {
  const directById = new Map(store.rangeObservations.map((entry) => [entry.id, entry]));
  for (const session of store.calibrationSessions) {
    for (const observationId of session.observationIds) {
      const observation = directById.get(observationId);
      if (!observation || observation.profileId !== session.profileId
        || observation.modeId !== session.modeId
        || calibrationContextKey(observation.context) !== calibrationContextKey(session.contextScope)) {
        throw new RangeError('CalibrationSession observationIds must reference its own context evidence');
      }
    }
  }
  const sessionsById = new Map(store.calibrationSessions.map((entry) => [entry.id, entry]));
  for (const observation of store.rangeObservations) {
    const sessionId = observation.provenance.calibrationSessionId;
    if (sessionId === null) continue;
    const session = sessionsById.get(sessionId);
    if (!session || session.profileId !== observation.profileId
      || session.modeId !== observation.modeId
      || calibrationContextKey(session.contextScope) !== calibrationContextKey(observation.context)) {
      throw new RangeError('RangeObservation calibrationSessionId is inconsistent');
    }
  }
}

export function validatePersonalStrategyStore(store) {
  requireObject(store, 'PersonalStrategyStore');
  if (store.schemaVersion !== PERSONAL_STRATEGY_STORE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_STORE_SCHEMA_VERSION}`);
  }
  if (!Number.isInteger(store.revision) || store.revision < 0) {
    throw new RangeError('PersonalStrategyStore.revision must be a non-negative integer');
  }
  validateProfileOwnerRef(store.ownerRef);
  requireTimestamp(store.updatedAt, 'PersonalStrategyStore.updatedAt');
  requireArray(store.profiles, 'PersonalStrategyStore.profiles').forEach(validateStrategyProfile);
  requireArray(store.modes, 'PersonalStrategyStore.modes').forEach(validateStrategyMode);
  requireArray(store.rangeObservations, 'PersonalStrategyStore.rangeObservations')
    .forEach(validateRangeObservation);
  requireArray(store.trainingObservations, 'PersonalStrategyStore.trainingObservations')
    .forEach(validateTrainingObservation);
  requireArray(store.calibrationSessions, 'PersonalStrategyStore.calibrationSessions')
    .forEach(validateCalibrationSession);
  requireUniqueIds(store);
  validateProfileGraph(store);
  for (const observation of [...store.rangeObservations, ...store.trainingObservations]) {
    profileAndMode(store, observation.profileId, observation.modeId, 'Profile evidence');
  }
  for (const session of store.calibrationSessions) {
    profileAndMode(store, session.profileId, session.modeId, 'CalibrationSession');
  }
  validateDirectRevisionGraph(store);
  validateTrainingComparisons(store);
  validateSessions(store);
  return store;
}

export function createEmptyPersonalStrategyStore(ownerRef, updatedAt) {
  const store = {
    schemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
    revision: 0,
    ownerRef: cloneData(ownerRef),
    updatedAt,
    profiles: [],
    modes: [],
    rangeObservations: [],
    trainingObservations: [],
    calibrationSessions: [],
  };
  validatePersonalStrategyStore(store);
  return deepFreeze(store);
}

export function migratePersonalStrategyStore(rawStore) {
  requireObject(rawStore, 'PersonalStrategyStore');
  if (rawStore.schemaVersion === PERSONAL_STRATEGY_STORE_SCHEMA_VERSION) {
    validatePersonalStrategyStore(rawStore);
    return deepFreeze(cloneData(rawStore));
  }
  if (rawStore.schemaVersion !== LEGACY_STORE_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported Personal Strategy store schema: ${rawStore.schemaVersion}`);
  }
  const migrated = {
    schemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
    revision: Number.isInteger(rawStore.revision) ? rawStore.revision : 0,
    ownerRef: { kind: 'local', id: rawStore.ownerId },
    updatedAt: rawStore.updatedAt,
    profiles: cloneData(rawStore.profiles ?? []),
    modes: cloneData(rawStore.modes ?? []),
    rangeObservations: cloneData(rawStore.observations ?? []),
    trainingObservations: [],
    calibrationSessions: cloneData(rawStore.sessions ?? []),
  };
  validatePersonalStrategyStore(migrated);
  return deepFreeze(migrated);
}

function portableAsStore(portable) {
  return {
    schemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
    revision: 0,
    ownerRef: cloneData(portable.ownerRef),
    updatedAt: portable.exportedAt,
    profiles: cloneData(portable.profiles),
    modes: cloneData(portable.modes),
    rangeObservations: cloneData(portable.rangeObservations),
    trainingObservations: cloneData(portable.trainingObservations),
    calibrationSessions: cloneData(portable.calibrationSessions),
  };
}

export function validatePersonalStrategyExport(portable) {
  requireObject(portable, 'PersonalStrategyExport');
  if (portable.schemaVersion !== PERSONAL_STRATEGY_EXPORT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PERSONAL_STRATEGY_EXPORT_SCHEMA_VERSION}`);
  }
  requireTimestamp(portable.exportedAt, 'PersonalStrategyExport.exportedAt');
  validatePersonalStrategyStore(portableAsStore(portable));
  return portable;
}

export function createPersonalStrategyExport(store, { profileIds = null, exportedAt } = {}) {
  validatePersonalStrategyStore(store);
  requireTimestamp(exportedAt, 'exportedAt');
  const selectedIds = profileIds === null
    ? new Set(store.profiles.map((entry) => entry.id))
    : new Set(requireArray(profileIds, 'profileIds'));
  for (const profileId of selectedIds) {
    if (!store.profiles.some((entry) => entry.id === profileId)) {
      throw new RangeError(`Cannot export unknown profile: ${profileId}`);
    }
  }
  const profiles = store.profiles.filter((entry) => selectedIds.has(entry.id));
  const modes = store.modes.filter((entry) => selectedIds.has(entry.profileId));
  const rangeObservations = store.rangeObservations
    .filter((entry) => selectedIds.has(entry.profileId));
  const trainingObservations = store.trainingObservations
    .filter((entry) => selectedIds.has(entry.profileId));
  const selectedObservationIds = new Set(rangeObservations.map((entry) => entry.id));
  const calibrationSessions = store.calibrationSessions
    .filter((entry) => selectedIds.has(entry.profileId))
    .map((entry) => ({
      ...cloneData(entry),
      observationIds: entry.observationIds.filter((id) => selectedObservationIds.has(id)),
    }));
  const portable = {
    schemaVersion: PERSONAL_STRATEGY_EXPORT_SCHEMA_VERSION,
    exportedAt,
    ownerRef: cloneData(store.ownerRef),
    profiles: cloneData(profiles),
    modes: cloneData(modes),
    rangeObservations: cloneData(rangeObservations),
    trainingObservations: cloneData(trainingObservations),
    calibrationSessions,
  };
  validatePersonalStrategyExport(portable);
  return deepFreeze(portable);
}

export function serializePersonalStrategyExport(portable) {
  validatePersonalStrategyExport(portable);
  return JSON.stringify(portable);
}

export function parsePersonalStrategyExport(value) {
  let parsed;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : cloneData(value);
  } catch (error) {
    throw new TypeError(`Personal Strategy export is not valid JSON: ${error.message}`);
  }
  validatePersonalStrategyExport(parsed);
  return deepFreeze(parsed);
}

function rehomePersonalStrategyExport(portable, ownerRef) {
  const adopted = cloneData(portable);
  adopted.ownerRef = cloneData(ownerRef);
  adopted.profiles = adopted.profiles.map((profile) => ({
    ...profile,
    ownerRef: cloneData(ownerRef),
  }));
  validatePersonalStrategyExport(adopted);
  return deepFreeze(adopted);
}

export class PersonalStrategyStorageError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PersonalStrategyStorageError';
    this.code = code;
  }
}

function storageFailure(code, message, cause) {
  return new PersonalStrategyStorageError(code, message, cause);
}

const STORES = PERSONAL_STRATEGY_OBJECT_STORES;
const ALL_DATABASE_STORES = Object.freeze(Object.values(STORES));
const ID_STORES = Object.freeze([
  STORES.PROFILES,
  STORES.MODES,
  STORES.RANGE_OBSERVATIONS,
  STORES.TRAINING_OBSERVATIONS,
  STORES.CALIBRATION_SESSIONS,
]);
const METADATA_KEY = 'state';

function scopeKey({ profileId, modeId, context, contextScope }) {
  return `${profileId}|${modeId}|${calibrationContextKey(context ?? contextScope)}`;
}

function rangeRecord(observation) {
  return {
    id: observation.id,
    profileId: observation.profileId,
    logicalKey: rangeObservationKey(observation),
    scopeKey: scopeKey(observation),
    calibrationSessionId: observation.provenance.calibrationSessionId,
    value: cloneData(observation),
  };
}

function currentRangeRecord(observation) {
  return {
    logicalKey: rangeObservationKey(observation),
    profileId: observation.profileId,
    scopeKey: scopeKey(observation),
    observationId: observation.id,
    value: cloneData(observation),
  };
}

function conflictingRangeRecord(observation) {
  return {
    observationId: observation.id,
    logicalKey: rangeObservationKey(observation),
    profileId: observation.profileId,
    scopeKey: scopeKey(observation),
    value: cloneData(observation),
  };
}

function rangeHeadsByLogicalKey(observations) {
  const leaves = directRevisionLeaves(observations);
  const groups = new Map();
  for (const observation of leaves) {
    const key = rangeObservationKey(observation);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(observation);
  }
  return [...groups.values()].map((entries) => {
    const ordered = [...entries].sort((left, right) => (
      left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id)
    ));
    return { selected: ordered.at(-1), conflicting: ordered.slice(0, -1) };
  });
}

async function writeRangeHeads(transaction, observations) {
  for (const group of rangeHeadsByLogicalKey(observations)) {
    await transaction.put(STORES.CURRENT_RANGE_OBSERVATIONS, currentRangeRecord(group.selected));
    for (const observation of group.conflicting) {
      await transaction.put(STORES.CONFLICTING_RANGE_OBSERVATIONS, conflictingRangeRecord(observation));
    }
  }
}

function trainingRecord(observation) {
  return {
    id: observation.id,
    profileId: observation.profileId,
    logicalKey: rangeObservationKey(observation),
    value: cloneData(observation),
  };
}

function sessionRecord(session) {
  return {
    id: session.id,
    profileId: session.profileId,
    scopeKey: scopeKey(session),
    value: cloneData(session),
  };
}

function migrationCounts(store) {
  return Object.freeze({
    profiles: store.profiles.length,
    modes: store.modes.length,
    rangeObservations: store.rangeObservations.length,
    trainingObservations: store.trainingObservations.length,
    calibrationSessions: store.calibrationSessions.length,
  });
}

function createMetadata(store, migration) {
  return {
    key: METADATA_KEY,
    backendSchemaVersion: PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION,
    databaseVersion: PERSONAL_STRATEGY_DATABASE_VERSION,
    domainSchemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
    revision: store.revision,
    ownerRef: cloneData(store.ownerRef),
    updatedAt: store.updatedAt,
    migration: cloneData(migration),
  };
}

function validateMetadata(metadata, ownerRef) {
  requireObject(metadata, 'Personal Strategy database metadata');
  if (metadata.backendSchemaVersion !== PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION
    || metadata.databaseVersion !== PERSONAL_STRATEGY_DATABASE_VERSION) {
    throw storageFailure(
      'unsupported_database_version',
      'Personal Strategy storage uses an unsupported database version and was left untouched.',
    );
  }
  if (metadata.domainSchemaVersion !== PERSONAL_STRATEGY_STORE_SCHEMA_VERSION) {
    throw storageFailure(
      'unsupported_schema',
      'Personal Strategy data uses an unsupported domain schema and was left untouched.',
    );
  }
  if (!sameOwnerRef(metadata.ownerRef, ownerRef)) {
    throw storageFailure(
      'owner_mismatch',
      'Personal Strategy data belongs to a different owner and was left untouched.',
    );
  }
  if (!Number.isInteger(metadata.revision) || metadata.revision < 0) {
    throw storageFailure('invalid_record', 'Personal Strategy database metadata is invalid.');
  }
  requireTimestamp(metadata.updatedAt, 'Personal Strategy database updatedAt');
  return metadata;
}

function isUpgradeableMetadata(metadata, ownerRef) {
  return metadata?.backendSchemaVersion === LEGACY_BACKEND_SCHEMA_VERSION
    && metadata?.databaseVersion === LEGACY_DATABASE_VERSION
    && metadata?.domainSchemaVersion === PERSONAL_STRATEGY_STORE_SCHEMA_VERSION
    && sameOwnerRef(metadata?.ownerRef, ownerRef);
}

function nextMetadata(metadata, clock) {
  return {
    ...cloneData(metadata),
    revision: metadata.revision + 1,
    updatedAt: timestampFrom(clock),
  };
}

async function assertUnusedId(transaction, id) {
  const matches = await Promise.all(ID_STORES.map((storeName) => transaction.get(storeName, id)));
  if (matches.some((entry) => entry !== undefined)) {
    throw new RangeError(`Personal Strategy ID collision: ${id}`);
  }
}

async function requireProfileAndMode(transaction, profileId, modeId, label) {
  const [profile, mode] = await Promise.all([
    transaction.get(STORES.PROFILES, profileId),
    transaction.get(STORES.MODES, modeId),
  ]);
  if (!profile) throw new RangeError(`${label} references an unknown profile`);
  if (!mode || mode.profileId !== profileId || !profile.modeIds.includes(modeId)) {
    throw new RangeError(`${label} references a mode outside its profile`);
  }
  return { profile, mode };
}

function validateSessionReplacement(previous, session) {
  if (session.profileId !== previous.profileId || session.modeId !== previous.modeId
    || session.startedAt !== previous.startedAt
    || calibrationContextKey(session.contextScope) !== calibrationContextKey(previous.contextScope)) {
    throw new RangeError('CalibrationSession update cannot change identity or context scope');
  }
}

function legacySnapshotFromStorage(storage, storageKey, ownerRef, clock) {
  if (!storage) return { snapshot: createEmptyPersonalStrategyStore(ownerRef, timestampFrom(clock)), sourceBytes: 0, source: 'none' };
  let serialized;
  try {
    serialized = storage.getItem(storageKey);
  } catch (error) {
    throw storageFailure('read_failed', 'Legacy Personal Strategy data could not be read.', error);
  }
  if (serialized === null || serialized === undefined) {
    return { snapshot: createEmptyPersonalStrategyStore(ownerRef, timestampFrom(clock)), sourceBytes: 0, source: 'none' };
  }
  let raw;
  try {
    raw = JSON.parse(serialized);
  } catch (error) {
    throw storageFailure(
      'corrupt_record',
      'Legacy Personal Strategy data is malformed; the stored record was left untouched.',
      error,
    );
  }
  let snapshot;
  try {
    snapshot = migratePersonalStrategyStore(raw);
  } catch (error) {
    const code = String(error.message).startsWith('Unsupported Personal Strategy store schema')
      ? 'unsupported_schema'
      : 'invalid_record';
    throw storageFailure(
      code,
      'Legacy Personal Strategy data is incompatible or invalid; the stored record was left untouched.',
      error,
    );
  }
  if (!sameOwnerRef(snapshot.ownerRef, ownerRef)) {
    throw storageFailure(
      'owner_mismatch',
      'Legacy Personal Strategy data belongs to a different owner and was left untouched.',
    );
  }
  return {
    snapshot,
    sourceBytes: new TextEncoder().encode(serialized).byteLength,
    source: 'web-storage-v1',
  };
}

async function importSnapshotTransaction(transaction, store, metadata) {
  for (const profile of store.profiles) await transaction.add(STORES.PROFILES, profile);
  for (const mode of store.modes) await transaction.add(STORES.MODES, mode);
  for (const observation of store.rangeObservations) {
    await transaction.add(STORES.RANGE_OBSERVATIONS, rangeRecord(observation));
  }
  await writeRangeHeads(transaction, store.rangeObservations);
  for (const observation of store.trainingObservations) {
    await transaction.add(STORES.TRAINING_OBSERVATIONS, trainingRecord(observation));
  }
  for (const session of store.calibrationSessions) {
    await transaction.add(STORES.CALIBRATION_SESSIONS, sessionRecord(session));
  }
  const actualCounts = {
    profiles: await transaction.count(STORES.PROFILES),
    modes: await transaction.count(STORES.MODES),
    rangeObservations: await transaction.count(STORES.RANGE_OBSERVATIONS),
    trainingObservations: await transaction.count(STORES.TRAINING_OBSERVATIONS),
    calibrationSessions: await transaction.count(STORES.CALIBRATION_SESSIONS),
  };
  if (JSON.stringify(actualCounts) !== JSON.stringify(metadata.migration.counts)) {
    throw new Error('Personal Strategy migration verification failed');
  }
  await transaction.put(STORES.METADATA, metadata);
}

function snapshotFromRecords(metadata, { profiles, modes, rangeObservations, trainingObservations, calibrationSessions }) {
  const store = {
    schemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
    revision: metadata.revision,
    ownerRef: cloneData(metadata.ownerRef),
    updatedAt: metadata.updatedAt,
    profiles: cloneData(profiles),
    modes: cloneData(modes),
    rangeObservations: rangeObservations.map((entry) => cloneData(entry.value)),
    trainingObservations: trainingObservations.map((entry) => cloneData(entry.value)),
    calibrationSessions: calibrationSessions.map((entry) => cloneData(entry.value)),
  };
  validatePersonalStrategyStore(store);
  return deepFreeze(store);
}

export function createPersonalStrategyRepository({
  database = null,
  legacyStorage = null,
  ownerRef,
  storageKey = PERSONAL_STRATEGY_STORAGE_KEY,
  clock = () => new Date(),
} = {}) {
  validateProfileOwnerRef(ownerRef);
  if (typeof storageKey !== 'string' || !storageKey) throw new TypeError('storageKey is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');
  let durableDatabase = database;
  let initializationPromise = null;

  function getDatabase() {
    if (!durableDatabase) durableDatabase = createIndexedDbPersonalStrategyDatabase();
    if (typeof durableDatabase.runTransaction !== 'function') {
      throw new TypeError('PersonalStrategyRepository requires a transactional database adapter');
    }
    return durableDatabase;
  }

  async function initialize() {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      let existing;
      try {
        existing = await getDatabase().runTransaction([STORES.METADATA], 'readonly', (transaction) => (
          transaction.get(STORES.METADATA, METADATA_KEY)
        ));
      } catch (error) {
        const code = error?.name === 'VersionError' ? 'unsupported_database_version' : 'open_failed';
        throw storageFailure(code, 'Personal Strategy storage could not be opened.', error);
      }
      if (existing) {
        if (isUpgradeableMetadata(existing, ownerRef)) {
          const upgraded = {
            ...cloneData(existing),
            backendSchemaVersion: PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION,
            databaseVersion: PERSONAL_STRATEGY_DATABASE_VERSION,
            migration: {
              ...cloneData(existing.migration),
              syncEvidenceHeadsAddedAt: timestampFrom(clock),
            },
          };
          await getDatabase().runTransaction([
            STORES.METADATA,
            STORES.CONFLICTING_RANGE_OBSERVATIONS,
          ], 'readwrite', (transaction) => transaction.put(STORES.METADATA, upgraded));
          return deepFreeze(cloneData(validateMetadata(upgraded, ownerRef)));
        }
        return deepFreeze(cloneData(validateMetadata(existing, ownerRef)));
      }

      const legacy = legacySnapshotFromStorage(legacyStorage, storageKey, ownerRef, clock);
      const startedAt = timestampFrom(clock);
      const migration = {
        status: 'complete',
        source: legacy.source,
        sourceKey: legacy.source === 'none' ? null : storageKey,
        sourceRetained: legacy.source !== 'none',
        sourceBytes: legacy.sourceBytes,
        startedAt,
        completedAt: timestampFrom(clock),
        counts: migrationCounts(legacy.snapshot),
      };
      const metadata = createMetadata(legacy.snapshot, migration);
      try {
        return await getDatabase().runTransaction(ALL_DATABASE_STORES, 'readwrite', async (transaction) => {
          const raced = await transaction.get(STORES.METADATA, METADATA_KEY);
          if (raced) return deepFreeze(cloneData(validateMetadata(raced, ownerRef)));
          await importSnapshotTransaction(transaction, legacy.snapshot, metadata);
          return deepFreeze(cloneData(metadata));
        });
      } catch (error) {
        if (error instanceof PersonalStrategyStorageError) throw error;
        throw storageFailure(
          'migration_failed',
          'Personal Strategy migration could not be completed; the legacy data remains intact and retry is safe.',
          error,
        );
      }
    })();
    try {
      return await initializationPromise;
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  }

  async function readTransaction(storeNames, operation) {
    await initialize();
    try {
      return await getDatabase().runTransaction(storeNames, 'readonly', operation);
    } catch (error) {
      if (error instanceof PersonalStrategyStorageError || error instanceof RangeError || error instanceof TypeError) throw error;
      throw storageFailure('read_failed', 'Personal Strategy data could not be read.', error);
    }
  }

  async function writeTransaction(storeNames, operation) {
    await initialize();
    try {
      return await getDatabase().runTransaction(
        [...new Set([STORES.METADATA, ...storeNames])],
        'readwrite',
        operation,
      );
    } catch (error) {
      if (error instanceof PersonalStrategyStorageError || error instanceof RangeError || error instanceof TypeError) throw error;
      throw storageFailure(
        'transaction_failed',
        'Personal Strategy data could not be saved; the prior durable records remain authoritative.',
        error,
      );
    }
  }

  async function metadataIn(transaction) {
    return validateMetadata(await transaction.get(STORES.METADATA, METADATA_KEY), ownerRef);
  }

  async function commitMetadata(transaction, metadata) {
    const next = nextMetadata(metadata, clock);
    await transaction.put(STORES.METADATA, next);
    return deepFreeze(cloneData(next));
  }

  async function saveSessionInTransaction(
    transaction,
    session,
    { expectedSession = undefined } = {},
  ) {
    await requireProfileAndMode(transaction, session.profileId, session.modeId, 'CalibrationSession');
    const stored = await transaction.get(STORES.CALIBRATION_SESSIONS, session.id);
    if (!stored) await assertUnusedId(transaction, session.id);
    else {
      if (expectedSession !== undefined
        && JSON.stringify(stored.value) !== JSON.stringify(expectedSession)) {
        throw new RangeError('CalibrationSession changed since the action was presented');
      }
      validateSessionReplacement(stored.value, session);
    }
    await transaction.put(STORES.CALIBRATION_SESSIONS, sessionRecord(session));
    return stored?.value ?? null;
  }

  async function saveRangeInTransaction(transaction, observation) {
    await assertUnusedId(transaction, observation.id);
    await requireProfileAndMode(transaction, observation.profileId, observation.modeId, 'RangeObservation');
    const current = await transaction.get(STORES.CURRENT_RANGE_OBSERVATIONS, rangeObservationKey(observation));
    const supersedes = observation.revision.supersedesObservationId;
    if ((!current && supersedes !== null) || (current && supersedes !== current.observationId)) {
      throw new RangeError('RangeObservation must supersede the current direct revision');
    }
    const sessionId = observation.provenance.calibrationSessionId;
    if (sessionId !== null) {
      const storedSession = await transaction.get(STORES.CALIBRATION_SESSIONS, sessionId);
      const session = storedSession?.value;
      if (!session || session.profileId !== observation.profileId
        || session.modeId !== observation.modeId
        || calibrationContextKey(session.contextScope) !== calibrationContextKey(observation.context)) {
        throw new RangeError('RangeObservation references an incompatible CalibrationSession');
      }
    }
    await transaction.add(STORES.RANGE_OBSERVATIONS, rangeRecord(observation));
    await transaction.put(STORES.CURRENT_RANGE_OBSERVATIONS, currentRangeRecord(observation));
  }

  const repository = {
    schemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
    backendSchemaVersion: PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION,
    databaseName: database?.name ?? PERSONAL_STRATEGY_DATABASE_NAME,
    databaseVersion: PERSONAL_STRATEGY_DATABASE_VERSION,
    storageKey,

    initialize,

    async getMigrationStatus() {
      const metadata = await initialize();
      return deepFreeze(cloneData(metadata.migration));
    },

    async loadSnapshot() {
      return readTransaction(ALL_DATABASE_STORES, async (transaction) => {
        const [metadata, profiles, modes, rangeObservations, trainingObservations, calibrationSessions] = await Promise.all([
          metadataIn(transaction),
          transaction.getAll(STORES.PROFILES),
          transaction.getAll(STORES.MODES),
          transaction.getAll(STORES.RANGE_OBSERVATIONS),
          transaction.getAll(STORES.TRAINING_OBSERVATIONS),
          transaction.getAll(STORES.CALIBRATION_SESSIONS),
        ]);
        return snapshotFromRecords(metadata, {
          profiles, modes, rangeObservations, trainingObservations, calibrationSessions,
        });
      });
    },

    async loadWorkspaceSnapshot() {
      return readTransaction([
        STORES.METADATA,
        STORES.PROFILES,
        STORES.MODES,
        STORES.CURRENT_RANGE_OBSERVATIONS,
        STORES.CONFLICTING_RANGE_OBSERVATIONS,
        STORES.CALIBRATION_SESSIONS,
      ], async (transaction) => {
        const [metadata, profiles, modes, conflicts, current, sessions] = await Promise.all([
          metadataIn(transaction),
          transaction.getAll(STORES.PROFILES),
          transaction.getAll(STORES.MODES),
          transaction.getAll(STORES.CONFLICTING_RANGE_OBSERVATIONS),
          transaction.getAll(STORES.CURRENT_RANGE_OBSERVATIONS),
          transaction.getAll(STORES.CALIBRATION_SESSIONS),
        ]);
        return deepFreeze({
          schemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
          revision: metadata.revision,
          ownerRef: cloneData(metadata.ownerRef),
          updatedAt: metadata.updatedAt,
          profiles: cloneData(profiles),
          modes: cloneData(modes),
          rangeObservations: [...conflicts, ...current].map((entry) => cloneData(entry.value)),
          trainingObservations: [],
          calibrationSessions: sessions.map((entry) => cloneData(entry.value)),
        });
      });
    },

    /**
     * Load source evidence for one Profile x Mode x objective context. Direct
     * history uses the existing scope index so corrections and independent
     * heads remain available to the derived evidence view. Training v1 has a
     * profile index only, so it is bounded to the selected profile and then
     * filtered by exact mode/context. No inferred artifact is read or written.
     */
    async loadEvidenceScope({ profileId, modeId, context } = {}) {
      if (typeof profileId !== 'string' || !profileId.trim()) {
        throw new TypeError('Personal Strategy evidence scope profileId is required');
      }
      if (typeof modeId !== 'string' || !modeId.trim()) {
        throw new TypeError('Personal Strategy evidence scope modeId is required');
      }
      validateCalibrationContext(context);
      const selectedScopeKey = scopeKey({ profileId, modeId, context });
      return readTransaction([
        STORES.METADATA,
        STORES.RANGE_OBSERVATIONS,
        STORES.TRAINING_OBSERVATIONS,
      ], async (transaction) => {
        const [metadata, rangeRecords, profileTrainingRecords] = await Promise.all([
          metadataIn(transaction),
          transaction.getAllByIndex(STORES.RANGE_OBSERVATIONS, 'scopeKey', selectedScopeKey),
          transaction.getAllByIndex(STORES.TRAINING_OBSERVATIONS, 'profileId', profileId),
        ]);
        const rangeObservations = rangeRecords.map((entry) => entry.value);
        const trainingObservations = profileTrainingRecords
          .map((entry) => entry.value)
          .filter((entry) => entry.modeId === modeId
            && calibrationContextKey(entry.context) === calibrationContextKey(context));
        rangeObservations.forEach(validateRangeObservation);
        trainingObservations.forEach(validateTrainingObservation);
        return deepFreeze({
          schemaVersion: 'personal-strategy-evidence-scope-source/v1',
          repositoryRevision: metadata.revision,
          profileId,
          modeId,
          context: cloneData(context),
          rangeObservations: cloneData(rangeObservations),
          trainingObservations: cloneData(trainingObservations),
        });
      });
    },

    async loadRangeHeadsScope({ profileId, modeId, context } = {}) {
      if (typeof profileId !== 'string' || !profileId.trim()) {
        throw new TypeError('Personal Strategy head scope profileId is required');
      }
      if (typeof modeId !== 'string' || !modeId.trim()) {
        throw new TypeError('Personal Strategy head scope modeId is required');
      }
      validateCalibrationContext(context);
      const selectedScopeKey = scopeKey({ profileId, modeId, context });
      return readTransaction([
        STORES.CURRENT_RANGE_OBSERVATIONS,
        STORES.CONFLICTING_RANGE_OBSERVATIONS,
      ], async (transaction) => {
        const [current, conflicting] = await Promise.all([
          transaction.getAllByIndex(STORES.CURRENT_RANGE_OBSERVATIONS, 'scopeKey', selectedScopeKey),
          transaction.getAllByIndex(STORES.CONFLICTING_RANGE_OBSERVATIONS, 'scopeKey', selectedScopeKey),
        ]);
        return deepFreeze({
          schemaVersion: 'personal-strategy-range-heads/v1',
          current: current.map((entry) => cloneData(entry.value)),
          conflicting: conflicting.map((entry) => cloneData(entry.value)),
        });
      });
    },

    /**
     * Read only the selected calibration scope needed by Home. The exact-scope
     * indexes cap current direct observations at the 169 RFI hand classes and
     * avoid loading the profile library's observation/session history.
     */
    async loadHomeSummary({ profileId = null, modeId = null, context = null } = {}) {
      return readTransaction([
        STORES.PROFILES,
        STORES.MODES,
        STORES.CURRENT_RANGE_OBSERVATIONS,
        STORES.CONFLICTING_RANGE_OBSERVATIONS,
        STORES.CALIBRATION_SESSIONS,
      ], async (transaction) => {
        const profileCount = await transaction.count(STORES.PROFILES);
        if (typeof profileId !== 'string' || typeof modeId !== 'string' || !context) {
          return deepFreeze({
            profileCount,
            selectedProfile: null,
            selectedMode: null,
            context: null,
            answeredCount: 0,
            directEvidenceCount: 0,
            contradictionCount: 0,
            session: null,
          });
        }

        const selectedProfile = await transaction.get(STORES.PROFILES, profileId);
        const selectedMode = await transaction.get(STORES.MODES, modeId);
        if (!selectedProfile || !selectedMode
          || selectedProfile.state !== 'active'
          || selectedMode.state !== 'active'
          || selectedMode.profileId !== selectedProfile.id
          || !selectedProfile.modeIds.includes(selectedMode.id)) {
          return deepFreeze({
            profileCount,
            selectedProfile: null,
            selectedMode: null,
            context: null,
            answeredCount: 0,
            directEvidenceCount: 0,
            contradictionCount: 0,
            session: null,
          });
        }
        validateStrategyProfile(selectedProfile);
        validateStrategyMode(selectedMode);
        const selectedScopeKey = scopeKey({ profileId, modeId, context });
        const [currentRecords, conflictingRecords, sessionRecords] = await Promise.all([
          transaction.getAllByIndex(STORES.CURRENT_RANGE_OBSERVATIONS, 'scopeKey', selectedScopeKey),
          transaction.getAllByIndex(STORES.CONFLICTING_RANGE_OBSERVATIONS, 'scopeKey', selectedScopeKey),
          transaction.getAllByIndex(STORES.CALIBRATION_SESSIONS, 'scopeKey', selectedScopeKey),
        ]);
        const observations = [...conflictingRecords, ...currentRecords].map((entry) => entry.value);
        observations.forEach(validateRangeObservation);
        const activeObservations = observations.filter(
          (entry) => entry.state === RANGE_OBSERVATION_STATES.ACTIVE,
        );
        const sessions = sessionRecords.map((entry) => entry.value);
        sessions.forEach(validateCalibrationSession);
        const session = sessions
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
        return deepFreeze({
          profileCount,
          selectedProfile: cloneData(selectedProfile),
          selectedMode: cloneData(selectedMode),
          context: cloneData(context),
          answeredCount: new Set(activeObservations.map((entry) => entry.handClass)).size,
          directEvidenceCount: activeObservations.length,
          contradictionCount: conflictingRecords.filter(
            (entry) => entry.value.state === RANGE_OBSERVATION_STATES.ACTIVE,
          ).length,
          session: cloneData(session),
        });
      });
    },

    async saveProfileBundle(bundle) {
      requireObject(bundle, 'StrategyProfile bundle');
      validateStrategyProfile(bundle.profile);
      requireArray(bundle.modes, 'StrategyProfile bundle modes').forEach(validateStrategyMode);
      if (!sameOwnerRef(bundle.profile.ownerRef, ownerRef)) {
        throw new RangeError('StrategyProfile bundle owner does not match repository owner');
      }
      if (bundle.modes.length !== 3
        || bundle.modes.some((mode) => mode.profileId !== bundle.profile.id)
        || bundle.profile.modeIds.some((id) => !bundle.modes.some((mode) => mode.id === id))) {
        throw new RangeError('StrategyProfile bundle must contain its three declared modes');
      }
      return writeTransaction([STORES.PROFILES, STORES.MODES, ...ID_STORES], async (transaction) => {
        const metadata = await metadataIn(transaction);
        await assertUnusedId(transaction, bundle.profile.id);
        for (const mode of bundle.modes) await assertUnusedId(transaction, mode.id);
        await transaction.add(STORES.PROFILES, cloneData(bundle.profile));
        for (const mode of bundle.modes) await transaction.add(STORES.MODES, cloneData(mode));
        return commitMetadata(transaction, metadata);
      });
    },

    async saveProfile(profile) {
      validateStrategyProfile(profile);
      return writeTransaction([STORES.PROFILES], async (transaction) => {
        const [metadata, previous] = await Promise.all([
          metadataIn(transaction), transaction.get(STORES.PROFILES, profile.id),
        ]);
        if (!previous) throw new RangeError('Use saveProfileBundle to add a new StrategyProfile');
        if (!sameOwnerRef(profile.ownerRef, previous.ownerRef)
          || profile.createdAt !== previous.createdAt
          || JSON.stringify(profile.modeIds) !== JSON.stringify(previous.modeIds)) {
          throw new RangeError('StrategyProfile update cannot change identity, owner, creation, or mode relationship');
        }
        await transaction.put(STORES.PROFILES, cloneData(profile));
        return commitMetadata(transaction, metadata);
      });
    },

    async saveProfileConfiguration({ profile, modes } = {}) {
      validateStrategyProfile(profile);
      requireArray(modes, 'StrategyProfile configuration modes').forEach(validateStrategyMode);
      if (modes.length !== 3
        || profile.modeIds.some((id) => !modes.some((mode) => mode.id === id))
        || modes.some((mode) => mode.profileId !== profile.id)) {
        throw new RangeError('StrategyProfile configuration must contain its three declared modes');
      }
      return writeTransaction([STORES.PROFILES, STORES.MODES], async (transaction) => {
        const [metadata, previousProfile, ...previousModes] = await Promise.all([
          metadataIn(transaction),
          transaction.get(STORES.PROFILES, profile.id),
          ...modes.map((mode) => transaction.get(STORES.MODES, mode.id)),
        ]);
        if (!previousProfile) throw new RangeError('StrategyProfile does not exist');
        if (!sameOwnerRef(profile.ownerRef, previousProfile.ownerRef)
          || profile.createdAt !== previousProfile.createdAt
          || JSON.stringify(profile.modeIds) !== JSON.stringify(previousProfile.modeIds)) {
          throw new RangeError('StrategyProfile update cannot change identity, owner, creation, or mode relationship');
        }
        modes.forEach((mode, index) => {
          const previous = previousModes[index];
          if (!previous) throw new RangeError('StrategyMode does not exist');
          if (mode.profileId !== previous.profileId || mode.createdAt !== previous.createdAt) {
            throw new RangeError('StrategyMode update cannot change identity, parent, or creation');
          }
        });
        await transaction.put(STORES.PROFILES, cloneData(profile));
        for (const mode of modes) await transaction.put(STORES.MODES, cloneData(mode));
        return commitMetadata(transaction, metadata);
      });
    },

    async saveMode(mode) {
      validateStrategyMode(mode);
      return writeTransaction([STORES.MODES], async (transaction) => {
        const [metadata, previous] = await Promise.all([
          metadataIn(transaction), transaction.get(STORES.MODES, mode.id),
        ]);
        if (!previous) throw new RangeError('StrategyMode additions require a versioned profile migration');
        if (mode.profileId !== previous.profileId || mode.createdAt !== previous.createdAt) {
          throw new RangeError('StrategyMode update cannot change identity, parent, or creation');
        }
        await transaction.put(STORES.MODES, cloneData(mode));
        return commitMetadata(transaction, metadata);
      });
    },

    async saveRangeObservation(observation) {
      validateRangeObservation(observation);
      return writeTransaction([
        ...ID_STORES,
        STORES.CURRENT_RANGE_OBSERVATIONS,
      ], async (transaction) => {
        const metadata = await metadataIn(transaction);
        await saveRangeInTransaction(transaction, observation);
        return commitMetadata(transaction, metadata);
      });
    },

    async saveRangeObservationBatch(observations) {
      requireArray(observations, 'RangeObservation batch').forEach(validateRangeObservation);
      if (observations.length === 0) throw new RangeError('RangeObservation batch cannot be empty');
      const ids = observations.map((entry) => entry.id);
      const keys = observations.map(rangeObservationKey);
      if (new Set(ids).size !== ids.length || new Set(keys).size !== keys.length) {
        throw new RangeError('RangeObservation batch requires unique IDs and strategic points');
      }
      const first = observations[0];
      const contextKey = calibrationContextKey(first.context);
      if (observations.some((entry) => entry.profileId !== first.profileId
        || entry.modeId !== first.modeId
        || calibrationContextKey(entry.context) !== contextKey)) {
        throw new RangeError('RangeObservation batch must share one Personal Strategy scope');
      }
      return writeTransaction([
        ...ID_STORES,
        STORES.CURRENT_RANGE_OBSERVATIONS,
      ], async (transaction) => {
        const metadata = await metadataIn(transaction);
        for (const observation of observations) {
          await saveRangeInTransaction(transaction, observation);
        }
        return commitMetadata(transaction, metadata);
      });
    },

    async saveCalibrationAnswer({
      observation,
      session,
      expectedSession = undefined,
      expectedSessionUpdatedAt = undefined,
    } = {}) {
      validateRangeObservation(observation);
      validateCalibrationSession(session);
      if (expectedSession !== undefined) validateCalibrationSession(expectedSession);
      if (observation.provenance.calibrationSessionId !== session.id
        || observation.profileId !== session.profileId
        || observation.modeId !== session.modeId
        || calibrationContextKey(observation.context) !== calibrationContextKey(session.contextScope)) {
        throw new RangeError('Calibration answer observation and session must share one scope');
      }
      if (!session.observationIds.includes(observation.id)) {
        throw new RangeError('CalibrationSession must include the accepted observation ID');
      }
      return writeTransaction([
        ...ID_STORES,
        STORES.CURRENT_RANGE_OBSERVATIONS,
      ], async (transaction) => {
        const [metadata, existing, durableSessionRecord] = await Promise.all([
          metadataIn(transaction),
          transaction.get(STORES.RANGE_OBSERVATIONS, observation.id),
          transaction.get(STORES.CALIBRATION_SESSIONS, session.id),
        ]);
        if (existing) {
          if (JSON.stringify(existing.value) === JSON.stringify(observation)
            && JSON.stringify(durableSessionRecord?.value) === JSON.stringify(session)) {
            return deepFreeze({ ...cloneData(metadata), idempotent: true });
          }
          throw new RangeError(`Personal Strategy ID collision: ${observation.id}`);
        }
        const durableSession = durableSessionRecord?.value;
        if (!durableSession) throw new RangeError('CalibrationSession does not exist');
        if ((expectedSession !== undefined
            && JSON.stringify(durableSession) !== JSON.stringify(expectedSession))
          || (expectedSession === undefined && expectedSessionUpdatedAt
            && durableSession.updatedAt !== expectedSessionUpdatedAt)) {
          throw new RangeError('CalibrationSession changed since the question was presented');
        }
        if (session.observationIds.length !== durableSession.observationIds.length + 1
          || session.observationIds.at(-1) !== observation.id
          || durableSession.observationIds.some((id, index) => session.observationIds[index] !== id)) {
          throw new RangeError('Calibration answer must append exactly one session observation');
        }
        await saveRangeInTransaction(transaction, observation);
        validateSessionReplacement(durableSession, session);
        await transaction.put(STORES.CALIBRATION_SESSIONS, sessionRecord(session));
        return commitMetadata(transaction, metadata);
      });
    },

    async saveTrainingObservation(observation) {
      validateTrainingObservation(observation);
      return writeTransaction([...ID_STORES, STORES.CURRENT_RANGE_OBSERVATIONS], async (transaction) => {
        const metadata = await metadataIn(transaction);
        await assertUnusedId(transaction, observation.id);
        await requireProfileAndMode(transaction, observation.profileId, observation.modeId, 'TrainingObservation');
        const current = await transaction.get(STORES.CURRENT_RANGE_OBSERVATIONS, rangeObservationKey(observation));
        const direct = current?.value?.state === RANGE_OBSERVATION_STATES.ACTIVE ? current.value : null;
        const comparison = observation.directCalibrationComparison;
        if (direct === null && comparison !== null) {
          throw new RangeError('TrainingObservation cannot compare against absent direct calibration');
        }
        if (direct !== null && direct.dominantAction !== null) {
          const expected = direct.dominantAction.type === observation.chosenAction.type
            ? DIRECT_COMPARISON_RELATIONS.MATCHES
            : DIRECT_COMPARISON_RELATIONS.DEVIATES;
          if (comparison?.observationId !== direct.id || comparison.relation !== expected) {
            throw new RangeError('TrainingObservation must record its current direct-calibration deviation');
          }
        } else if (direct !== null && comparison !== null) {
          throw new RangeError('TrainingObservation cannot compare against a tied direct mix');
        }
        await transaction.add(STORES.TRAINING_OBSERVATIONS, trainingRecord(observation));
        return commitMetadata(transaction, metadata);
      });
    },

    async saveCalibrationSession(session, { expectedSession = undefined } = {}) {
      validateCalibrationSession(session);
      if (expectedSession !== undefined) validateCalibrationSession(expectedSession);
      return writeTransaction([...ID_STORES], async (transaction) => {
        const metadata = await metadataIn(transaction);
        await saveSessionInTransaction(transaction, session, { expectedSession });
        return commitMetadata(transaction, metadata);
      });
    },

    async getCurrentRangeObservation({ profileId, modeId, context, handClass } = {}) {
      const key = rangeObservationKey({ profileId, modeId, context, handClass });
      return readTransaction([STORES.CURRENT_RANGE_OBSERVATIONS], async (transaction) => {
        const record = await transaction.get(STORES.CURRENT_RANGE_OBSERVATIONS, key);
        return record?.value?.state === RANGE_OBSERVATION_STATES.ACTIVE
          ? deepFreeze(cloneData(record.value))
          : null;
      });
    },

    async getSyncSummary() {
      const snapshot = await repository.loadSnapshot();
      return deepFreeze({
        profileCount: snapshot.profiles.length,
        directObservationCount: snapshot.rangeObservations
          .filter((entry) => entry.state === RANGE_OBSERVATION_STATES.ACTIVE).length,
        activeSessionCount: snapshot.calibrationSessions
          .filter((entry) => entry.state !== 'completed').length,
      });
    },

    async listSyncEntities() {
      const snapshot = await repository.loadSnapshot();
      const modesByProfile = new Map();
      for (const mode of snapshot.modes) {
        if (!modesByProfile.has(mode.profileId)) modesByProfile.set(mode.profileId, []);
        modesByProfile.get(mode.profileId).push(mode);
      }
      return deepFreeze([
        ...snapshot.profiles.map((profile) => ({
          syncEntityType: 'profile_bundle',
          id: profile.id,
          profile: cloneData(profile),
          modes: cloneData(profile.modeIds.map((id) => (
            modesByProfile.get(profile.id)?.find((mode) => mode.id === id)
          ))),
        })),
        ...cloneData(snapshot.calibrationSessions),
        ...cloneData(snapshot.rangeObservations),
        ...cloneData(snapshot.trainingObservations),
      ]);
    },

    async getSyncEntityById(id) {
      return readTransaction([
        STORES.PROFILES,
        STORES.MODES,
        STORES.RANGE_OBSERVATIONS,
        STORES.TRAINING_OBSERVATIONS,
        STORES.CALIBRATION_SESSIONS,
      ], async (transaction) => {
        const [profile, range, training, session] = await Promise.all([
          transaction.get(STORES.PROFILES, id),
          transaction.get(STORES.RANGE_OBSERVATIONS, id),
          transaction.get(STORES.TRAINING_OBSERVATIONS, id),
          transaction.get(STORES.CALIBRATION_SESSIONS, id),
        ]);
        if (profile) {
          const modes = await Promise.all(profile.modeIds.map((modeId) => transaction.get(STORES.MODES, modeId)));
          return deepFreeze({
            syncEntityType: 'profile_bundle', id: profile.id,
            profile: cloneData(profile), modes: cloneData(modes),
          });
        }
        return deepFreeze(cloneData(range?.value ?? training?.value ?? session?.value ?? null));
      });
    },

    async applySyncedEntity(entity, remoteDocument) {
      requireObject(remoteDocument, 'Remote Personal Strategy entity');
      const type = remoteDocument.entityType;
      if (type === 'profile_bundle') {
        const { profile, modes } = entity;
        validateStrategyProfile(profile);
        requireArray(modes, 'Synced StrategyProfile modes').forEach(validateStrategyMode);
        if (!sameOwnerRef(profile.ownerRef, ownerRef) || modes.length !== 3) {
          throw new RangeError('Synced StrategyProfile bundle is incompatible with the active owner');
        }
        return writeTransaction([STORES.PROFILES, STORES.MODES, ...ID_STORES], async (transaction) => {
          const metadata = await metadataIn(transaction);
          const previousProfile = await transaction.get(STORES.PROFILES, profile.id);
          if (!previousProfile) {
            await assertUnusedId(transaction, profile.id);
            for (const mode of modes) await assertUnusedId(transaction, mode.id);
          } else if (!sameOwnerRef(previousProfile.ownerRef, profile.ownerRef)
            || previousProfile.createdAt !== profile.createdAt
            || JSON.stringify(previousProfile.modeIds) !== JSON.stringify(profile.modeIds)) {
            throw new RangeError('Synced StrategyProfile cannot change stable identity or mode relationships');
          }
          for (const mode of modes) {
            const previousMode = await transaction.get(STORES.MODES, mode.id);
            if (previousMode && (previousMode.profileId !== mode.profileId
              || previousMode.createdAt !== mode.createdAt)) {
              throw new RangeError('Synced StrategyMode cannot change stable identity or parent');
            }
          }
          await transaction.put(STORES.PROFILES, cloneData(profile));
          for (const mode of modes) await transaction.put(STORES.MODES, cloneData(mode));
          return commitMetadata(transaction, metadata);
        });
      }
      if (type === 'calibration_session') {
        validateCalibrationSession(entity);
        return writeTransaction([...ID_STORES], async (transaction) => {
          const metadata = await metadataIn(transaction);
          await saveSessionInTransaction(transaction, entity);
          return commitMetadata(transaction, metadata);
        });
      }
      if (type === 'training_observation') {
        validateTrainingObservation(entity);
        return writeTransaction([...ID_STORES], async (transaction) => {
          const metadata = await metadataIn(transaction);
          const existing = await transaction.get(STORES.TRAINING_OBSERVATIONS, entity.id);
          if (existing) {
            if (JSON.stringify(existing.value) !== JSON.stringify(entity)) {
              throw new RangeError(`Personal Strategy ID collision: ${entity.id}`);
            }
            return deepFreeze({ ...cloneData(metadata), idempotent: true });
          }
          await assertUnusedId(transaction, entity.id);
          await requireProfileAndMode(transaction, entity.profileId, entity.modeId, 'TrainingObservation');
          await transaction.add(STORES.TRAINING_OBSERVATIONS, trainingRecord(entity));
          return commitMetadata(transaction, metadata);
        });
      }
      if (type !== 'range_observation') throw new RangeError(`Unsupported synced entity type: ${type}`);
      validateRangeObservation(entity);
      return writeTransaction([
        ...ID_STORES,
        STORES.CURRENT_RANGE_OBSERVATIONS,
        STORES.CONFLICTING_RANGE_OBSERVATIONS,
      ], async (transaction) => {
        const metadata = await metadataIn(transaction);
        const existing = await transaction.get(STORES.RANGE_OBSERVATIONS, entity.id);
        if (existing) {
          if (JSON.stringify(existing.value) !== JSON.stringify(entity)) {
            throw new RangeError(`Personal Strategy ID collision: ${entity.id}`);
          }
          return deepFreeze({ ...cloneData(metadata), idempotent: true });
        }
        await assertUnusedId(transaction, entity.id);
        await requireProfileAndMode(transaction, entity.profileId, entity.modeId, 'RangeObservation');
        const sessionId = entity.provenance.calibrationSessionId;
        const storedSession = sessionId
          ? await transaction.get(STORES.CALIBRATION_SESSIONS, sessionId)
          : null;
        if (sessionId && !storedSession) {
          throw new RangeError('Synced RangeObservation references an unavailable CalibrationSession');
        }
        const logicalKey = rangeObservationKey(entity);
        const selected = await transaction.get(STORES.CURRENT_RANGE_OBSERVATIONS, logicalKey);
        const conflicts = await transaction.getAllByIndex(
          STORES.CONFLICTING_RANGE_OBSERVATIONS, 'logicalKey', logicalKey,
        );
        const parentId = entity.revision.supersedesObservationId;
        if (parentId) {
          const parent = await transaction.get(STORES.RANGE_OBSERVATIONS, parentId);
          if (!parent || parent.logicalKey !== logicalKey) {
            throw new RangeError('Synced RangeObservation supersedes unavailable matching evidence');
          }
        }
        await transaction.add(STORES.RANGE_OBSERVATIONS, rangeRecord(entity));
        if (!selected) {
          await transaction.put(STORES.CURRENT_RANGE_OBSERVATIONS, currentRangeRecord(entity));
        } else if (parentId === selected.observationId) {
          await transaction.put(STORES.CURRENT_RANGE_OBSERVATIONS, currentRangeRecord(entity));
        } else {
          const conflictingParent = conflicts.find((entry) => entry.observationId === parentId);
          if (conflictingParent) await transaction.delete(
            STORES.CONFLICTING_RANGE_OBSERVATIONS, conflictingParent.observationId,
          );
          await transaction.put(
            STORES.CONFLICTING_RANGE_OBSERVATIONS,
            conflictingRangeRecord(entity),
          );
        }
        if (storedSession) {
          const records = await transaction.getAllByIndex(
            STORES.RANGE_OBSERVATIONS, 'calibrationSessionId', sessionId,
          );
          const observationIds = [...new Set([
            ...storedSession.value.observationIds,
            ...records.map((entry) => entry.id),
            entity.id,
          ])];
          const scopeHeads = [
            ...(await transaction.getAllByIndex(
              STORES.CONFLICTING_RANGE_OBSERVATIONS, 'scopeKey', storedSession.scopeKey,
            )),
            ...(await transaction.getAllByIndex(
              STORES.CURRENT_RANGE_OBSERVATIONS, 'scopeKey', storedSession.scopeKey,
            )),
          ].map((entry) => entry.value);
          if (!scopeHeads.some((entry) => entry.id === entity.id)) scopeHeads.push(entity);
          const answered = new Set(scopeHeads
            .filter((entry) => entry.state === RANGE_OBSERVATION_STATES.ACTIVE)
            .map((entry) => entry.handClass));
          const nextPromptIndex = PREFLOP_HAND_CLASSES.findIndex((handClass) => !answered.has(handClass));
          const completed = nextPromptIndex < 0;
          const updatedAt = entity.updatedAt > storedSession.value.updatedAt
            ? entity.updatedAt : storedSession.value.updatedAt;
          await transaction.put(STORES.CALIBRATION_SESSIONS, sessionRecord({
            ...cloneData(storedSession.value),
            updatedAt,
            state: completed ? 'completed' : storedSession.value.state === 'paused' ? 'paused' : 'active',
            completedAt: completed ? updatedAt : null,
            observationIds,
            cursor: {
              ...cloneData(storedSession.value.cursor),
              nextPromptIndex: completed ? PREFLOP_HAND_CLASSES.length : nextPromptIndex,
            },
          }));
        }
        return commitMetadata(transaction, metadata);
      });
    },

    async exportPortable({ profileIds = null, exportedAt = timestampFrom(clock) } = {}) {
      if (profileIds === null) {
        return createPersonalStrategyExport(await repository.loadSnapshot(), { profileIds, exportedAt });
      }
      const selectedIds = [...new Set(requireArray(profileIds, 'profileIds'))];
      const selected = await readTransaction([
        STORES.METADATA,
        STORES.PROFILES,
        STORES.MODES,
        STORES.RANGE_OBSERVATIONS,
        STORES.TRAINING_OBSERVATIONS,
        STORES.CALIBRATION_SESSIONS,
      ], async (transaction) => {
        const metadata = await metadataIn(transaction);
        const profiles = await Promise.all(selectedIds.map((id) => transaction.get(STORES.PROFILES, id)));
        const unknownIndex = profiles.findIndex((entry) => !entry);
        if (unknownIndex >= 0) throw new RangeError(`Cannot export unknown profile: ${selectedIds[unknownIndex]}`);
        const [modes, rangeObservations, trainingObservations, calibrationSessions] = await Promise.all([
          Promise.all(selectedIds.map((id) => transaction.getAllByIndex(STORES.MODES, 'profileId', id))),
          Promise.all(selectedIds.map((id) => transaction.getAllByIndex(STORES.RANGE_OBSERVATIONS, 'profileId', id))),
          Promise.all(selectedIds.map((id) => transaction.getAllByIndex(STORES.TRAINING_OBSERVATIONS, 'profileId', id))),
          Promise.all(selectedIds.map((id) => transaction.getAllByIndex(STORES.CALIBRATION_SESSIONS, 'profileId', id))),
        ]);
        return snapshotFromRecords(metadata, {
          profiles,
          modes: modes.flat(),
          rangeObservations: rangeObservations.flat(),
          trainingObservations: trainingObservations.flat(),
          calibrationSessions: calibrationSessions.flat(),
        });
      });
      return createPersonalStrategyExport(selected, { profileIds: selectedIds, exportedAt });
    },

    async importPortable(value, { ownerPolicy = 'adopt_active' } = {}) {
      const parsed = parsePersonalStrategyExport(value);
      if (!['adopt_active', 'require_match'].includes(ownerPolicy)) {
        throw new RangeError(`Unsupported Personal Strategy import owner policy: ${ownerPolicy}`);
      }
      if (ownerPolicy === 'require_match' && !sameOwnerRef(parsed.ownerRef, ownerRef)) {
        throw new RangeError('Portable Personal Strategy owner does not match repository owner');
      }
      const portable = sameOwnerRef(parsed.ownerRef, ownerRef)
        ? parsed
        : rehomePersonalStrategyExport(parsed, ownerRef);
      const current = await repository.loadSnapshot();
      const existingIds = new Set(idsForStore(current));
      const collision = idsForStore(portableAsStore(portable)).find((id) => existingIds.has(id));
      if (collision) throw new RangeError(`Portable Personal Strategy ID collision: ${collision}`);
      const draft = cloneData(current);
      draft.profiles.push(...cloneData(portable.profiles));
      draft.modes.push(...cloneData(portable.modes));
      draft.rangeObservations.push(...cloneData(portable.rangeObservations));
      draft.trainingObservations.push(...cloneData(portable.trainingObservations));
      draft.calibrationSessions.push(...cloneData(portable.calibrationSessions));
      draft.revision += 1;
      draft.updatedAt = timestampFrom(clock);
      validatePersonalStrategyStore(draft);
      return writeTransaction(ALL_DATABASE_STORES, async (transaction) => {
        const metadata = await metadataIn(transaction);
        for (const id of idsForStore(portableAsStore(portable))) await assertUnusedId(transaction, id);
        for (const observation of portable.rangeObservations.filter((entry) => entry.revision.supersedesObservationId === null)) {
          if (await transaction.get(STORES.CURRENT_RANGE_OBSERVATIONS, rangeObservationKey(observation))) {
            throw new RangeError('Portable import collides with an existing direct-calibration history');
          }
        }
        for (const profile of portable.profiles) await transaction.add(STORES.PROFILES, cloneData(profile));
        for (const mode of portable.modes) await transaction.add(STORES.MODES, cloneData(mode));
        for (const observation of portable.rangeObservations) {
          await transaction.add(STORES.RANGE_OBSERVATIONS, rangeRecord(observation));
        }
        await writeRangeHeads(transaction, portable.rangeObservations);
        for (const observation of portable.trainingObservations) {
          await transaction.add(STORES.TRAINING_OBSERVATIONS, trainingRecord(observation));
        }
        for (const session of portable.calibrationSessions) {
          await transaction.add(STORES.CALIBRATION_SESSIONS, sessionRecord(session));
        }
        return commitMetadata(transaction, metadata);
      });
    },

    async close() {
      if (durableDatabase?.close) await durableDatabase.close();
      initializationPromise = null;
    },
  };

  return Object.freeze(repository);
}
