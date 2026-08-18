import {
  CALIBRATION_SESSION_SCHEMA_VERSION,
  RANGE_OBSERVATION_SCHEMA_VERSION,
  STRATEGY_MODE_SCHEMA_VERSION,
  STRATEGY_PROFILE_SCHEMA_VERSION,
  TRAINING_OBSERVATION_SCHEMA_VERSION,
  createLocalOwnerRef,
  validateCalibrationSession,
  validateRangeObservation,
  validateStrategyMode,
  validateStrategyProfile,
  validateTrainingObservation,
} from '../personal-strategy/index.mjs';
import { PREFLOP_HAND_CLASSES } from '../../../shared/poker-domain/index.js';
import { PERSONAL_STRATEGY_SYNC_DOMAIN, cloneSyncData } from './domain.mjs';

export const REMOTE_PERSONAL_STRATEGY_ENTITY_VERSION = 'remote-personal-strategy-entity/v1';
export const PERSONAL_STRATEGY_RECONCILIATION_VERSION = 'personal-strategy-reconciliation/v1';
export const PERSONAL_STRATEGY_CONFLICT_VERSION = 'personal-strategy-metadata-conflict/v1';

export const PERSONAL_STRATEGY_ENTITY_TYPES = Object.freeze({
  PROFILE_BUNDLE: 'profile_bundle',
  RANGE_OBSERVATION: 'range_observation',
  TRAINING_OBSERVATION: 'training_observation',
  CALIBRATION_SESSION: 'calibration_session',
});

const TYPE_ORDER = Object.freeze({
  [PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE]: 0,
  [PERSONAL_STRATEGY_ENTITY_TYPES.CALIBRATION_SESSION]: 1,
  [PERSONAL_STRATEGY_ENTITY_TYPES.RANGE_OBSERVATION]: 2,
  [PERSONAL_STRATEGY_ENTITY_TYPES.TRAINING_OBSERVATION]: 3,
});

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp`);
  }
  return value;
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value ?? {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function same(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function withoutOwner(profile) {
  const { ownerRef: _ownerRef, ...portable } = cloneSyncData(profile);
  return portable;
}

function validateProfileBundlePayload(payload) {
  requireObject(payload, 'Remote profile bundle payload');
  exactKeys(payload, ['profile', 'modes'], 'Remote profile bundle payload');
  if (!Array.isArray(payload.modes) || payload.modes.length !== 3) {
    throw new RangeError('Remote profile bundle requires exactly three modes');
  }
  const profile = { ...cloneSyncData(payload.profile), ownerRef: createLocalOwnerRef('remote-validation-owner') };
  validateStrategyProfile(profile);
  payload.modes.forEach(validateStrategyMode);
  if (profile.modeIds.some((id) => !payload.modes.some((mode) => mode.id === id))) {
    throw new RangeError('Remote profile bundle modes do not match the profile');
  }
}

function validatePayload(type, payload) {
  if (type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE) return validateProfileBundlePayload(payload);
  if (type === PERSONAL_STRATEGY_ENTITY_TYPES.RANGE_OBSERVATION) return validateRangeObservation(payload);
  if (type === PERSONAL_STRATEGY_ENTITY_TYPES.TRAINING_OBSERVATION) return validateTrainingObservation(payload);
  if (type === PERSONAL_STRATEGY_ENTITY_TYPES.CALIBRATION_SESSION) return validateCalibrationSession(payload);
  throw new RangeError(`Unsupported Personal Strategy sync entity type: ${type}`);
}

export function validateRemotePersonalStrategyEntity(document) {
  requireObject(document, 'Remote Personal Strategy entity');
  exactKeys(document, [
    'schemaVersion', 'entityType', 'entitySchemaVersion', 'id', 'profileId',
    'revision', 'createdAt', 'updatedAt', 'payload',
  ], 'Remote Personal Strategy entity');
  if (document.schemaVersion !== REMOTE_PERSONAL_STRATEGY_ENTITY_VERSION) {
    throw new TypeError('Remote Personal Strategy entity uses an unsupported schema');
  }
  if (typeof document.id !== 'string' || !document.id
    || typeof document.profileId !== 'string' || !document.profileId) {
    throw new TypeError('Remote Personal Strategy stable IDs are required');
  }
  if (!Number.isInteger(document.revision) || document.revision < 1) {
    throw new RangeError('Remote Personal Strategy revision must be positive');
  }
  requireTimestamp(document.createdAt, 'Remote Personal Strategy createdAt');
  requireTimestamp(document.updatedAt, 'Remote Personal Strategy updatedAt');
  validatePayload(document.entityType, document.payload);
  const expectedSchema = {
    [PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE]: STRATEGY_PROFILE_SCHEMA_VERSION,
    [PERSONAL_STRATEGY_ENTITY_TYPES.RANGE_OBSERVATION]: RANGE_OBSERVATION_SCHEMA_VERSION,
    [PERSONAL_STRATEGY_ENTITY_TYPES.TRAINING_OBSERVATION]: TRAINING_OBSERVATION_SCHEMA_VERSION,
    [PERSONAL_STRATEGY_ENTITY_TYPES.CALIBRATION_SESSION]: CALIBRATION_SESSION_SCHEMA_VERSION,
  }[document.entityType];
  if (document.entitySchemaVersion !== expectedSchema) {
    throw new TypeError('Remote Personal Strategy entity payload schema does not match its type');
  }
  if (document.entityType === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE) {
    if (document.id !== document.payload.profile.id || document.profileId !== document.id) {
      throw new RangeError('Remote profile bundle stable ID is inconsistent');
    }
  } else if (document.id !== document.payload.id || document.profileId !== document.payload.profileId) {
    throw new RangeError('Remote Personal Strategy entity stable ID is inconsistent');
  }
  return document;
}

export function createPersonalStrategyProfileBundle(profile, modes) {
  validateStrategyProfile(profile);
  if (!Array.isArray(modes) || modes.length !== 3) throw new RangeError('Profile bundle requires three modes');
  modes.forEach(validateStrategyMode);
  return Object.freeze({
    syncEntityType: PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE,
    id: profile.id,
    profile: cloneSyncData(profile),
    modes: cloneSyncData(modes),
  });
}

function entityType(value) {
  if (value?.syncEntityType === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE) return value.syncEntityType;
  return {
    [RANGE_OBSERVATION_SCHEMA_VERSION]: PERSONAL_STRATEGY_ENTITY_TYPES.RANGE_OBSERVATION,
    [TRAINING_OBSERVATION_SCHEMA_VERSION]: PERSONAL_STRATEGY_ENTITY_TYPES.TRAINING_OBSERVATION,
    [CALIBRATION_SESSION_SCHEMA_VERSION]: PERSONAL_STRATEGY_ENTITY_TYPES.CALIBRATION_SESSION,
  }[value?.schemaVersion] ?? null;
}

export function toRemotePersonalStrategyEntity(value, { remoteRevision = 0 } = {}) {
  const type = entityType(value);
  if (!type) throw new TypeError('Unsupported local Personal Strategy sync entity');
  const immutable = [
    PERSONAL_STRATEGY_ENTITY_TYPES.RANGE_OBSERVATION,
    PERSONAL_STRATEGY_ENTITY_TYPES.TRAINING_OBSERVATION,
  ].includes(type);
  const payload = type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE
    ? { profile: withoutOwner(value.profile), modes: cloneSyncData(value.modes) }
    : cloneSyncData(value);
  const id = type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE ? value.profile.id : value.id;
  const profileId = type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE ? id : value.profileId;
  const createdTimes = type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE
    ? [value.profile.createdAt, ...value.modes.map((mode) => mode.createdAt)]
    : [value.createdAt ?? value.startedAt];
  const updatedTimes = type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE
    ? [value.profile.updatedAt, ...value.modes.map((mode) => mode.updatedAt)]
    : [value.updatedAt];
  const document = {
    schemaVersion: REMOTE_PERSONAL_STRATEGY_ENTITY_VERSION,
    entityType: type,
    entitySchemaVersion: type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE
      ? STRATEGY_PROFILE_SCHEMA_VERSION
      : value.schemaVersion,
    id,
    profileId,
    revision: immutable ? 1 : remoteRevision + 1,
    createdAt: new Date(Math.min(...createdTimes.map(Date.parse))).toISOString(),
    updatedAt: new Date(Math.max(...updatedTimes.map(Date.parse))).toISOString(),
    payload,
  };
  validateRemotePersonalStrategyEntity(document);
  return Object.freeze(cloneSyncData(document));
}

export function fromRemotePersonalStrategyEntity(document, ownerRef) {
  validateRemotePersonalStrategyEntity(document);
  if (document.entityType === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE) {
    return createPersonalStrategyProfileBundle(
      { ...cloneSyncData(document.payload.profile), ownerRef: cloneSyncData(ownerRef) },
      document.payload.modes,
    );
  }
  return Object.freeze(cloneSyncData(document.payload));
}

export function sameRemotePersonalStrategyEntity(left, right) {
  if (!left || !right) return false;
  const portable = (document) => {
    const { revision: _revision, ...value } = document;
    return value;
  };
  return same(portable(left), portable(right));
}

function mergeField(base, local, remote) {
  if (same(local, remote)) return { ok: true, value: cloneSyncData(local) };
  if (base !== undefined && same(local, base)) return { ok: true, value: cloneSyncData(remote) };
  if (base !== undefined && same(remote, base)) return { ok: true, value: cloneSyncData(local) };
  return { ok: false, value: null };
}

function laterTimestamp(...values) {
  return new Date(Math.max(...values.filter(Boolean).map(Date.parse))).toISOString();
}

function mergeProfileBundleDocuments(local, remote, base) {
  if (!base) return null;
  const immutableProfileFields = ['schemaVersion', 'id', 'createdAt', 'gameDomain', 'modeIds'];
  if (immutableProfileFields.some((field) => !same(local.payload.profile[field], remote.payload.profile[field]))) return null;
  const profile = cloneSyncData(remote.payload.profile);
  for (const field of ['displayName', 'description', 'tags', 'state']) {
    const merged = mergeField(base.payload.profile[field], local.payload.profile[field], remote.payload.profile[field]);
    if (!merged.ok) return null;
    profile[field] = merged.value;
  }
  profile.updatedAt = laterTimestamp(local.payload.profile.updatedAt, remote.payload.profile.updatedAt);
  const localModes = new Map(local.payload.modes.map((mode) => [mode.id, mode]));
  const baseModes = new Map(base.payload.modes.map((mode) => [mode.id, mode]));
  const modes = [];
  for (const remoteMode of remote.payload.modes) {
    const localMode = localModes.get(remoteMode.id);
    const baseMode = baseModes.get(remoteMode.id);
    if (!localMode || !baseMode || localMode.profileId !== remoteMode.profileId
      || localMode.createdAt !== remoteMode.createdAt) return null;
    const mode = cloneSyncData(remoteMode);
    for (const field of ['displayName', 'description', 'displayOrder', 'state']) {
      const merged = mergeField(baseMode[field], localMode[field], remoteMode[field]);
      if (!merged.ok) return null;
      mode[field] = merged.value;
    }
    mode.updatedAt = laterTimestamp(localMode.updatedAt, remoteMode.updatedAt);
    modes.push(mode);
  }
  const merged = {
    ...cloneSyncData(remote),
    updatedAt: laterTimestamp(local.updatedAt, remote.updatedAt),
    payload: { profile, modes },
  };
  validateRemotePersonalStrategyEntity(merged);
  return Object.freeze(merged);
}

function mergeSessionDocuments(local, remote) {
  const left = local.payload;
  const right = remote.payload;
  if (left.id !== right.id || left.profileId !== right.profileId || left.modeId !== right.modeId
    || !same(left.contextScope, right.contextScope) || left.startedAt !== right.startedAt) return null;
  const observationIds = [...new Set([...left.observationIds, ...right.observationIds])];
  const newest = Date.parse(left.updatedAt) > Date.parse(right.updatedAt) ? left : right;
  const completed = left.state === 'completed' || right.state === 'completed';
  const handIndex = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));
  const mergeHandHistory = (field) => [...new Set([
    ...(left.cursor[field] ?? []),
    ...(right.cursor[field] ?? []),
  ])].sort((first, second) => handIndex.get(first) - handIndex.get(second));
  const askedHandClasses = mergeHandHistory('askedHandClasses');
  const payload = {
    ...cloneSyncData(newest),
    updatedAt: laterTimestamp(left.updatedAt, right.updatedAt),
    state: completed ? 'completed' : newest.state,
    completedAt: completed
      ? laterTimestamp(left.completedAt ?? left.updatedAt, right.completedAt ?? right.updatedAt)
      : null,
    observationIds,
    cursor: {
      ...cloneSyncData(newest.cursor),
      nextPromptIndex: Math.min(left.cursor.nextPromptIndex, right.cursor.nextPromptIndex),
      askedHandClasses,
      skippedHandClasses: mergeHandHistory('skippedHandClasses'),
      notSureHandClasses: mergeHandHistory('notSureHandClasses'),
      sessionQuestionCount: Math.max(
        askedHandClasses.length,
        left.cursor.sessionQuestionCount ?? 0,
        right.cursor.sessionQuestionCount ?? 0,
      ),
      additionalQuestionAllowance: Math.max(
        left.cursor.additionalQuestionAllowance ?? 0,
        right.cursor.additionalQuestionAllowance ?? 0,
      ),
    },
  };
  const merged = { ...cloneSyncData(remote), updatedAt: payload.updatedAt, payload };
  validateRemotePersonalStrategyEntity(merged);
  return Object.freeze(merged);
}

export function createPersonalStrategySyncAdapter({ syncPort } = {}) {
  if (!syncPort?.listEntities || !syncPort?.getEntityById || !syncPort?.applyRemoteEntity || !syncPort?.ownerRef) {
    throw new TypeError('Personal Strategy sync requires the canonical repository port');
  }
  return Object.freeze({
    domain: PERSONAL_STRATEGY_SYNC_DOMAIN,
    reconciliationVersion: PERSONAL_STRATEGY_RECONCILIATION_VERSION,
    conflictSchemaVersion: PERSONAL_STRATEGY_CONFLICT_VERSION,
    supports: (value) => entityType(value) !== null,
    objectId: (value) => value?.id,
    listLocalObjects: () => syncPort.listEntities(),
    getLocalObject: (id) => syncPort.getEntityById(id),
    serialize: toRemotePersonalStrategyEntity,
    validateRemote: validateRemotePersonalStrategyEntity,
    same: sameRemotePersonalStrategyEntity,
    operationKind(value) {
      const type = entityType(value);
      if (type === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE
        && value.profile.state === 'archived') return 'tombstone_strategy_profile';
      return `upsert_${type}`;
    },
    orderRemoteRecords(records) {
      return [...records].sort((left, right) => (
        (TYPE_ORDER[left.object.entityType] ?? 99) - (TYPE_ORDER[right.object.entityType] ?? 99)
        || left.serverUpdatedAt.localeCompare(right.serverUpdatedAt)
        || left.object.id.localeCompare(right.object.id)
      ));
    },
    async applyRemote(document) {
      return syncPort.applyRemoteEntity(
        fromRemotePersonalStrategyEntity(document, await syncPort.ownerRef()),
        document,
      );
    },
    mergeRemote({ localDocument, remoteDocument, baseObject }) {
      if (remoteDocument.entityType === PERSONAL_STRATEGY_ENTITY_TYPES.PROFILE_BUNDLE) {
        return mergeProfileBundleDocuments(localDocument, remoteDocument, baseObject);
      }
      if (remoteDocument.entityType === PERSONAL_STRATEGY_ENTITY_TYPES.CALIBRATION_SESSION) {
        return mergeSessionDocuments(localDocument, remoteDocument);
      }
      return null;
    },
    async prepareLocalWinner(localObject, remoteDocument) {
      const next = toRemotePersonalStrategyEntity(localObject, { remoteRevision: remoteDocument.revision });
      await syncPort.applyRemoteEntity(
        fromRemotePersonalStrategyEntity(next, await syncPort.ownerRef()),
        next,
      );
      return syncPort.getEntityById(next.id);
    },
  });
}

export function createRangeCalibrationSyncAdapter(options = {}) {
  const adapter = createPersonalStrategySyncAdapter(options);
  return Object.freeze({
    schemaVersion: 'range-calibration-sync-adapter/v1',
    supports: (value) => entityType(value) === PERSONAL_STRATEGY_ENTITY_TYPES.CALIBRATION_SESSION,
    serialize: adapter.serialize,
    mergeRemote: adapter.mergeRemote,
  });
}
