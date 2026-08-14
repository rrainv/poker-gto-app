import {
  DIRECT_COMPARISON_RELATIONS,
  RANGE_OBSERVATION_STATES,
  calibrationContextKey,
  rangeObservationKey,
  sameOwnerRef,
  validateCalibrationSession,
  validateProfileOwnerRef,
  validateRangeObservation,
  validateStrategyMode,
  validateStrategyProfile,
  validateTrainingObservation,
} from './domain.mjs';

export const PERSONAL_STRATEGY_STORE_SCHEMA_VERSION = 'personal-strategy-store/v1';
export const PERSONAL_STRATEGY_EXPORT_SCHEMA_VERSION = 'personal-strategy-export/v1';
export const PERSONAL_STRATEGY_STORAGE_KEY = 'riverline.personalStrategy.v1';

const LEGACY_STORE_SCHEMA_VERSION = 'personal-strategy-store/v0';

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
  const childCounts = new Map();
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
    childCounts.set(parentId, (childCounts.get(parentId) ?? 0) + 1);
    if (childCounts.get(parentId) > 1) {
      throw new RangeError('RangeObservation revision history cannot branch');
    }
  }
  for (const observations of byKey.values()) {
    const roots = observations.filter((entry) => entry.revision.supersedesObservationId === null);
    if (roots.length !== 1 || directRevisionLeaves(observations).length !== 1) {
      throw new RangeError('A direct calibration key must have one linear revision chain');
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

export function createPersonalStrategyRepository({
  storage,
  ownerRef,
  storageKey = PERSONAL_STRATEGY_STORAGE_KEY,
  clock = () => new Date(),
} = {}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('PersonalStrategyRepository requires a Storage-compatible adapter');
  }
  validateProfileOwnerRef(ownerRef);
  if (typeof storageKey !== 'string' || !storageKey) throw new TypeError('storageKey is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  function load() {
    let serialized;
    try {
      serialized = storage.getItem(storageKey);
    } catch (error) {
      throw storageFailure('read_failed', 'Personal Strategy data could not be read.', error);
    }
    if (serialized === null || serialized === undefined) {
      return createEmptyPersonalStrategyStore(ownerRef, timestampFrom(clock));
    }
    let raw;
    try {
      raw = JSON.parse(serialized);
    } catch (error) {
      throw storageFailure(
        'corrupt_record',
        'Personal Strategy data is malformed; the stored record was left untouched.',
        error,
      );
    }
    let migrated;
    try {
      migrated = migratePersonalStrategyStore(raw);
    } catch (error) {
      const code = String(error.message).startsWith('Unsupported Personal Strategy store schema')
        ? 'unsupported_schema'
        : 'invalid_record';
      throw storageFailure(
        code,
        'Personal Strategy data is incompatible or invalid; the stored record was left untouched.',
        error,
      );
    }
    if (!sameOwnerRef(migrated.ownerRef, ownerRef)) {
      throw storageFailure(
        'owner_mismatch',
        'Personal Strategy data belongs to a different owner and was left untouched.',
      );
    }
    return migrated;
  }

  function persist(nextStore) {
    validatePersonalStrategyStore(nextStore);
    const serialized = JSON.stringify(nextStore);
    try {
      storage.setItem(storageKey, serialized);
    } catch (error) {
      throw storageFailure(
        'write_failed',
        'Personal Strategy data could not be saved; the prior stored record remains authoritative.',
        error,
      );
    }
    return deepFreeze(cloneData(nextStore));
  }

  function commit(change) {
    const current = load();
    const draft = cloneData(current);
    change(draft, current);
    draft.schemaVersion = PERSONAL_STRATEGY_STORE_SCHEMA_VERSION;
    draft.revision = current.revision + 1;
    draft.updatedAt = timestampFrom(clock);
    return persist(draft);
  }

  function assertUnusedId(store, id) {
    if (idsForStore(store).includes(id)) throw new RangeError(`Personal Strategy ID collision: ${id}`);
  }

  function appendRangeObservation(draft, observation) {
    assertUnusedId(draft, observation.id);
    profileAndMode(draft, observation.profileId, observation.modeId, 'RangeObservation');
    const latest = latestDirectRevision(draft, observation);
    const supersedes = observation.revision.supersedesObservationId;
    if ((latest === null && supersedes !== null)
      || (latest !== null && supersedes !== latest.id)) {
      throw new RangeError('RangeObservation must supersede the current direct revision');
    }
    const sessionId = observation.provenance.calibrationSessionId;
    if (sessionId !== null) {
      const session = draft.calibrationSessions.find((entry) => entry.id === sessionId);
      if (!session || session.profileId !== observation.profileId
        || session.modeId !== observation.modeId
        || calibrationContextKey(session.contextScope) !== calibrationContextKey(observation.context)) {
        throw new RangeError('RangeObservation references an incompatible CalibrationSession');
      }
    }
    draft.rangeObservations.push(cloneData(observation));
  }

  function replaceCalibrationSession(draft, session) {
    profileAndMode(draft, session.profileId, session.modeId, 'CalibrationSession');
    const index = draft.calibrationSessions.findIndex((entry) => entry.id === session.id);
    if (index < 0) {
      assertUnusedId(draft, session.id);
      draft.calibrationSessions.push(cloneData(session));
      return null;
    }
    const previous = draft.calibrationSessions[index];
    if (session.profileId !== previous.profileId || session.modeId !== previous.modeId
      || session.startedAt !== previous.startedAt
      || calibrationContextKey(session.contextScope) !== calibrationContextKey(previous.contextScope)) {
      throw new RangeError('CalibrationSession update cannot change identity or context scope');
    }
    draft.calibrationSessions[index] = cloneData(session);
    return previous;
  }

  return Object.freeze({
    schemaVersion: PERSONAL_STRATEGY_STORE_SCHEMA_VERSION,
    storageKey,

    loadSnapshot() {
      return deepFreeze(cloneData(load()));
    },

    saveProfileBundle(bundle) {
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
      return commit((draft) => {
        assertUnusedId(draft, bundle.profile.id);
        bundle.modes.forEach((mode) => assertUnusedId(draft, mode.id));
        draft.profiles.push(cloneData(bundle.profile));
        draft.modes.push(...cloneData(bundle.modes));
      });
    },

    saveProfile(profile) {
      validateStrategyProfile(profile);
      return commit((draft) => {
        const index = draft.profiles.findIndex((entry) => entry.id === profile.id);
        if (index < 0) throw new RangeError('Use saveProfileBundle to add a new StrategyProfile');
        const previous = draft.profiles[index];
        if (!sameOwnerRef(profile.ownerRef, previous.ownerRef)
          || profile.createdAt !== previous.createdAt
          || JSON.stringify(profile.modeIds) !== JSON.stringify(previous.modeIds)) {
          throw new RangeError('StrategyProfile update cannot change identity, owner, creation, or mode relationship');
        }
        draft.profiles[index] = cloneData(profile);
      });
    },

    saveProfileConfiguration({ profile, modes } = {}) {
      validateStrategyProfile(profile);
      requireArray(modes, 'StrategyProfile configuration modes').forEach(validateStrategyMode);
      if (modes.length !== 3
        || profile.modeIds.some((id) => !modes.some((mode) => mode.id === id))
        || modes.some((mode) => mode.profileId !== profile.id)) {
        throw new RangeError('StrategyProfile configuration must contain its three declared modes');
      }
      return commit((draft) => {
        const profileIndex = draft.profiles.findIndex((entry) => entry.id === profile.id);
        if (profileIndex < 0) throw new RangeError('StrategyProfile does not exist');
        const previousProfile = draft.profiles[profileIndex];
        if (!sameOwnerRef(profile.ownerRef, previousProfile.ownerRef)
          || profile.createdAt !== previousProfile.createdAt
          || JSON.stringify(profile.modeIds) !== JSON.stringify(previousProfile.modeIds)) {
          throw new RangeError('StrategyProfile update cannot change identity, owner, creation, or mode relationship');
        }
        const modeUpdates = modes.map((mode) => {
          const index = draft.modes.findIndex((entry) => entry.id === mode.id);
          if (index < 0) throw new RangeError('StrategyMode does not exist');
          const previousMode = draft.modes[index];
          if (mode.profileId !== previousMode.profileId || mode.createdAt !== previousMode.createdAt) {
            throw new RangeError('StrategyMode update cannot change identity, parent, or creation');
          }
          return { index, mode };
        });
        draft.profiles[profileIndex] = cloneData(profile);
        modeUpdates.forEach(({ index, mode }) => { draft.modes[index] = cloneData(mode); });
      });
    },

    saveMode(mode) {
      validateStrategyMode(mode);
      return commit((draft) => {
        const index = draft.modes.findIndex((entry) => entry.id === mode.id);
        if (index < 0) throw new RangeError('StrategyMode additions require a versioned profile migration');
        const previous = draft.modes[index];
        if (mode.profileId !== previous.profileId || mode.createdAt !== previous.createdAt) {
          throw new RangeError('StrategyMode update cannot change identity, parent, or creation');
        }
        draft.modes[index] = cloneData(mode);
      });
    },

    saveRangeObservation(observation) {
      validateRangeObservation(observation);
      return commit((draft) => {
        appendRangeObservation(draft, observation);
      });
    },

    saveCalibrationAnswer({ observation, session, expectedSessionUpdatedAt } = {}) {
      validateRangeObservation(observation);
      validateCalibrationSession(session);
      if (observation.provenance.calibrationSessionId !== session.id
        || observation.profileId !== session.profileId
        || observation.modeId !== session.modeId
        || calibrationContextKey(observation.context) !== calibrationContextKey(session.contextScope)) {
        throw new RangeError('Calibration answer observation and session must share one scope');
      }
      if (!session.observationIds.includes(observation.id)) {
        throw new RangeError('CalibrationSession must include the accepted observation ID');
      }
      return commit((draft) => {
        const durableSession = draft.calibrationSessions.find((entry) => entry.id === session.id);
        if (!durableSession) throw new RangeError('CalibrationSession does not exist');
        if (expectedSessionUpdatedAt && durableSession.updatedAt !== expectedSessionUpdatedAt) {
          throw new RangeError('CalibrationSession changed since the question was presented');
        }
        if (session.observationIds.length !== durableSession.observationIds.length + 1
          || session.observationIds.at(-1) !== observation.id
          || durableSession.observationIds.some((id, index) => session.observationIds[index] !== id)) {
          throw new RangeError('Calibration answer must append exactly one session observation');
        }
        appendRangeObservation(draft, observation);
        replaceCalibrationSession(draft, session);
      });
    },

    saveTrainingObservation(observation) {
      validateTrainingObservation(observation);
      return commit((draft) => {
        assertUnusedId(draft, observation.id);
        profileAndMode(draft, observation.profileId, observation.modeId, 'TrainingObservation');
        const direct = currentDirectObservation(draft, observation);
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
        draft.trainingObservations.push(cloneData(observation));
      });
    },

    saveCalibrationSession(session) {
      validateCalibrationSession(session);
      return commit((draft) => {
        replaceCalibrationSession(draft, session);
      });
    },

    getCurrentRangeObservation({ profileId, modeId, context, handClass } = {}) {
      const store = load();
      const candidate = { profileId, modeId, context, handClass };
      const observation = currentDirectObservation(store, candidate);
      return observation === null ? null : deepFreeze(cloneData(observation));
    },

    exportPortable({ profileIds = null, exportedAt = timestampFrom(clock) } = {}) {
      return createPersonalStrategyExport(load(), { profileIds, exportedAt });
    },

    importPortable(value) {
      const portable = parsePersonalStrategyExport(value);
      if (!sameOwnerRef(portable.ownerRef, ownerRef)) {
        throw new RangeError('Portable Personal Strategy owner does not match repository owner');
      }
      return commit((draft) => {
        const existingIds = new Set(idsForStore(draft));
        const incomingIds = idsForStore(portableAsStore(portable));
        const collision = incomingIds.find((id) => existingIds.has(id));
        if (collision) throw new RangeError(`Portable Personal Strategy ID collision: ${collision}`);
        const existingKeys = new Set(draft.rangeObservations.map(rangeObservationKey));
        const logicalCollision = portable.rangeObservations.find((entry) => (
          entry.revision.supersedesObservationId === null && existingKeys.has(rangeObservationKey(entry))
        ));
        if (logicalCollision) {
          throw new RangeError('Portable import collides with an existing direct-calibration history');
        }
        draft.profiles.push(...cloneData(portable.profiles));
        draft.modes.push(...cloneData(portable.modes));
        draft.rangeObservations.push(...cloneData(portable.rangeObservations));
        draft.trainingObservations.push(...cloneData(portable.trainingObservations));
        draft.calibrationSessions.push(...cloneData(portable.calibrationSessions));
      });
    },
  });
}
