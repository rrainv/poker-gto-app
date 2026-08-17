import {
  cloneSavedStudyData,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudySource,
  validateSavedStudyObject,
} from '../saved-study-objects/index.mjs';

export const SYNC_PROTOCOL_VERSION = 'riverline-sync/v1';
export const SYNC_OUTBOX_OPERATION_VERSION = 'riverline-sync-operation/v1';
export const SYNC_RECONCILIATION_VERSION = 'saved-study-reconciliation/v1';
export const REMOTE_SAVED_STUDY_OBJECT_VERSION = 'remote-saved-study-object/v1';
export const SAVED_STUDY_SYNC_DOMAIN = 'saved_study_objects';
export const PERSONAL_STRATEGY_SYNC_DOMAIN = 'personal_strategy';

export const SYNC_STATES = Object.freeze({
  LOCAL_ONLY: 'local_only',
  PENDING_UPLOAD: 'pending_upload',
  SYNCED: 'synced',
  PENDING_UPDATE: 'pending_update',
  PENDING_DELETE: 'pending_delete',
  CONFLICT: 'conflict',
  ERROR: 'error',
});

export const SYNC_UI_STATES = Object.freeze({
  DISABLED: 'disabled',
  SAVED_LOCALLY: 'saved_locally',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  OFFLINE: 'offline',
  ERROR: 'error',
  CONFLICT: 'conflict',
  AUTH_PAUSED: 'auth_paused',
});

function clone(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(value ?? {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new TypeError(`${label} contains unsupported fields`);
  }
}

function normalizedTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp`);
  }
  return value;
}

function timestampAtLeast(clock, ...values) {
  const supplied = clock();
  const date = supplied instanceof Date ? supplied : new Date(supplied);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Sync clock returned an invalid date');
  const milliseconds = Math.max(date.getTime(), ...values.map((value) => Date.parse(value) || 0));
  return new Date(milliseconds).toISOString();
}

export function validateRemoteSavedStudyObject(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new TypeError('Remote SavedStudyObject must be an object');
  }
  exactKeys(document, [
    'schemaVersion', 'objectSchemaVersion', 'id', 'kind', 'createdAt', 'updatedAt',
    'revision', 'annotations', 'source', 'payload', 'lifecycle',
  ], 'Remote SavedStudyObject');
  if (document.schemaVersion !== REMOTE_SAVED_STUDY_OBJECT_VERSION
    || document.objectSchemaVersion !== 'saved-study-object/v1') {
    throw new TypeError('Remote SavedStudyObject uses an unsupported schema');
  }
  const validationOwner = createSavedStudyOwnerRef('remote-validation-owner');
  validateSavedStudyObject(createSavedStudyObject({
    ...clone(document),
    schemaVersion: document.objectSchemaVersion,
    ownerRef: validationOwner,
  }));
  return document;
}

export function toRemoteSavedStudyObject(object) {
  validateSavedStudyObject(object);
  const { ownerRef: _localOwner, schemaVersion: objectSchemaVersion, ...portable } = clone(object);
  const document = {
    schemaVersion: REMOTE_SAVED_STUDY_OBJECT_VERSION,
    objectSchemaVersion,
    ...portable,
  };
  validateRemoteSavedStudyObject(document);
  return Object.freeze(clone(document));
}

export function fromRemoteSavedStudyObject(document, ownerRef) {
  validateRemoteSavedStudyObject(document);
  const { schemaVersion: _remoteSchema, objectSchemaVersion, ...portable } = clone(document);
  return createSavedStudyObject({
    ...portable,
    schemaVersion: objectSchemaVersion,
    ownerRef,
  });
}

export function sameRemoteSavedStudyObject(left, right) {
  if (!left || !right) return false;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function createSyncOperation({
  operationId,
  identityId,
  object,
  expectedRemoteRevision = 0,
  createdAt,
  domain = SAVED_STUDY_SYNC_DOMAIN,
  kind = object?.lifecycle?.state === 'archived' ? 'tombstone_saved_object' : 'upsert_saved_object',
  validateObject = validateRemoteSavedStudyObject,
} = {}) {
  validateObject(object);
  if (typeof operationId !== 'string' || !operationId
    || typeof identityId !== 'string' || !identityId) {
    throw new TypeError('Sync operation and identity IDs are required');
  }
  if (!Number.isInteger(expectedRemoteRevision) || expectedRemoteRevision < 0) {
    throw new RangeError('Sync expectedRemoteRevision must be a non-negative integer');
  }
  normalizedTimestamp(createdAt, 'Sync operation createdAt');
  return Object.freeze({
    schemaVersion: SYNC_OUTBOX_OPERATION_VERSION,
    protocolVersion: SYNC_PROTOCOL_VERSION,
    domain,
    operationId,
    identityId,
    objectId: object.id,
    kind,
    expectedRemoteRevision,
    object: clone(object),
    createdAt,
    updatedAt: createdAt,
    attempts: 0,
    nextAttemptAt: createdAt,
    lastErrorCode: null,
  });
}

export function prepareLocalConflictWinner(localObject, remoteDocument, { ownerRef, clock } = {}) {
  validateSavedStudyObject(localObject);
  validateRemoteSavedStudyObject(remoteDocument);
  const updatedAt = timestampAtLeast(clock, localObject.updatedAt, remoteDocument.updatedAt);
  return createSavedStudyObject({
    ...cloneSavedStudyData(localObject),
    ownerRef,
    revision: Math.max(localObject.revision, remoteDocument.revision) + 1,
    updatedAt,
    lifecycle: localObject.lifecycle.state === 'archived'
      ? { state: 'archived', archivedAt: updatedAt }
      : { state: 'active', archivedAt: null },
  });
}

export function createSavedStudyConflictCopy(localObject, {
  id,
  ownerRef,
  clock,
} = {}) {
  validateSavedStudyObject(localObject);
  const createdAt = timestampAtLeast(clock, localObject.updatedAt);
  return createSavedStudyObject({
    ...cloneSavedStudyData(localObject),
    id,
    ownerRef,
    createdAt,
    updatedAt: createdAt,
    revision: 1,
    source: createSavedStudySource({
      surface: 'conflict_copy',
      sourceId: localObject.source.sourceId,
      parentObjectId: localObject.id,
    }),
    lifecycle: { state: 'active', archivedAt: null },
  });
}

export function cloneSyncData(value) {
  return clone(value);
}
