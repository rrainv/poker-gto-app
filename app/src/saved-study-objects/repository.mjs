import {
  SAVED_STUDY_CLASSIFICATIONS,
  SAVED_STUDY_LIFECYCLE_STATES,
  SAVED_STUDY_OBJECT_SCHEMA_VERSION,
  SAVED_STUDY_REVIEW_STATES,
  archiveSavedStudyObject,
  cloneSavedStudyData,
  deepFreezeSavedStudyData,
  normalizeSavedStudyTag,
  sameSavedStudyOwner,
  savedStudyOwnerKey,
  updateSavedStudyAnnotations,
  validateSavedStudyObject,
  validateSavedStudyOwnerRef,
} from './domain.mjs';
import {
  SAVED_STUDY_BACKEND_SCHEMA_VERSION,
  SAVED_STUDY_DATABASE_NAME,
  SAVED_STUDY_DATABASE_VERSION,
  SAVED_STUDY_INDEXES,
  SAVED_STUDY_OBJECT_STORES,
  createIndexedDbSavedStudyDatabase,
} from './indexeddb-storage.mjs';

export const SAVED_STUDY_LIBRARY_EXPORT_SCHEMA_VERSION = 'saved-study-library-export/v1';

const STORES = SAVED_STUDY_OBJECT_STORES;
const METADATA_KEY = 'state';
const MAX_QUERY_LIMIT = 500;
const INDEX_STRING_FLOOR = '';
const INDEX_STRING_CEILING = '\uffff';

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp`);
  }
  return value;
}

function timestampFrom(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Saved Study clock returned an invalid date');
  return date.toISOString();
}

function queryLimit(value) {
  const limit = value ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT) {
    throw new RangeError(`Saved Study query limit must be from 1 through ${MAX_QUERY_LIMIT}`);
  }
  return limit;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function objectRecord(object) {
  return {
    id: object.id,
    ownerKey: savedStudyOwnerKey(object.ownerRef),
    lifecycleState: object.lifecycle.state,
    kind: object.kind,
    updatedAt: object.updatedAt,
    reviewState: object.annotations.reviewState,
    tagKeys: object.annotations.tags.map((tag) => tag.key),
    classificationKeys: [...object.annotations.classifications],
    value: cloneSavedStudyData(object),
  };
}

function sortPortableObjects(objects) {
  return [...objects].sort((left, right) => (
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id, 'en-US')
  ));
}

export function validateSavedStudyLibraryExport(portable) {
  requireObject(portable, 'SavedStudyLibraryExport');
  if (portable.schemaVersion !== SAVED_STUDY_LIBRARY_EXPORT_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${SAVED_STUDY_LIBRARY_EXPORT_SCHEMA_VERSION}`);
  }
  requireIsoTimestamp(portable.exportedAt, 'SavedStudyLibraryExport.exportedAt');
  validateSavedStudyOwnerRef(portable.ownerRef);
  if (!Array.isArray(portable.objects)) {
    throw new TypeError('SavedStudyLibraryExport.objects must be an array');
  }
  const ids = new Set();
  for (const object of portable.objects) {
    validateSavedStudyObject(object);
    if (!sameSavedStudyOwner(object.ownerRef, portable.ownerRef)) {
      throw new RangeError('SavedStudyLibraryExport objects must share the envelope owner');
    }
    if (ids.has(object.id)) throw new RangeError(`Duplicate SavedStudyObject ID: ${object.id}`);
    ids.add(object.id);
  }
  return portable;
}

export function createSavedStudyLibraryExport({ ownerRef, objects, exportedAt } = {}) {
  validateSavedStudyOwnerRef(ownerRef);
  if (!Array.isArray(objects)) throw new TypeError('SavedStudyLibraryExport.objects must be an array');
  const portable = {
    schemaVersion: SAVED_STUDY_LIBRARY_EXPORT_SCHEMA_VERSION,
    exportedAt: requireIsoTimestamp(exportedAt, 'exportedAt'),
    ownerRef: cloneSavedStudyData(ownerRef),
    objects: sortPortableObjects(objects).map(cloneSavedStudyData),
  };
  validateSavedStudyLibraryExport(portable);
  return deepFreezeSavedStudyData(portable);
}

export function serializeSavedStudyLibraryExport(portable) {
  validateSavedStudyLibraryExport(portable);
  return canonicalJson(portable);
}

export function parseSavedStudyLibraryExport(value) {
  let parsed;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : cloneSavedStudyData(value);
  } catch (error) {
    throw new TypeError(`Saved Study export is not valid JSON: ${error.message}`);
  }
  validateSavedStudyLibraryExport(parsed);
  return deepFreezeSavedStudyData(parsed);
}

export class SavedStudyStorageError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SavedStudyStorageError';
    this.code = code;
  }
}

function storageFailure(code, message, cause = null) {
  return new SavedStudyStorageError(code, message, cause);
}

function createMetadata(ownerRef, timestamp) {
  return {
    key: METADATA_KEY,
    backendSchemaVersion: SAVED_STUDY_BACKEND_SCHEMA_VERSION,
    databaseVersion: SAVED_STUDY_DATABASE_VERSION,
    domainSchemaVersion: SAVED_STUDY_OBJECT_SCHEMA_VERSION,
    revision: 0,
    ownerRef: cloneSavedStudyData(ownerRef),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function validateMetadata(metadata, ownerRef) {
  requireObject(metadata, 'Saved Study database metadata');
  if (metadata.backendSchemaVersion !== SAVED_STUDY_BACKEND_SCHEMA_VERSION
    || metadata.databaseVersion !== SAVED_STUDY_DATABASE_VERSION) {
    throw storageFailure(
      'unsupported_database_version',
      'Saved Study storage uses an unsupported database version and was left untouched.',
    );
  }
  if (metadata.domainSchemaVersion !== SAVED_STUDY_OBJECT_SCHEMA_VERSION) {
    throw storageFailure(
      'unsupported_schema',
      'Saved Study storage uses an unsupported object schema and was left untouched.',
    );
  }
  if (!sameSavedStudyOwner(metadata.ownerRef, ownerRef)) {
    throw storageFailure(
      'owner_mismatch',
      'Saved Study data belongs to a different local owner and was left untouched.',
    );
  }
  if (!Number.isInteger(metadata.revision) || metadata.revision < 0) {
    throw storageFailure('invalid_record', 'Saved Study database metadata is invalid.');
  }
  requireIsoTimestamp(metadata.createdAt, 'Saved Study metadata.createdAt');
  requireIsoTimestamp(metadata.updatedAt, 'Saved Study metadata.updatedAt');
  return metadata;
}

function nextMetadata(metadata, clock) {
  const candidate = timestampFrom(clock);
  return {
    ...cloneSavedStudyData(metadata),
    revision: metadata.revision + 1,
    updatedAt: Date.parse(candidate) < Date.parse(metadata.updatedAt) ? metadata.updatedAt : candidate,
  };
}

function activeUpdatedRange(ownerKey) {
  return {
    lower: [ownerKey, SAVED_STUDY_LIFECYCLE_STATES.ACTIVE, INDEX_STRING_FLOOR],
    upper: [ownerKey, SAVED_STUDY_LIFECYCLE_STATES.ACTIVE, INDEX_STRING_CEILING],
    direction: 'prev',
  };
}

function activeKindUpdatedRange(ownerKey, kind) {
  return {
    lower: [ownerKey, SAVED_STUDY_LIFECYCLE_STATES.ACTIVE, kind, INDEX_STRING_FLOOR],
    upper: [ownerKey, SAVED_STUDY_LIFECYCLE_STATES.ACTIVE, kind, INDEX_STRING_CEILING],
    direction: 'prev',
  };
}

function activeReviewUpdatedRange(ownerKey, reviewState) {
  return {
    lower: [ownerKey, SAVED_STUDY_LIFECYCLE_STATES.ACTIVE, reviewState, INDEX_STRING_FLOOR],
    upper: [ownerKey, SAVED_STUDY_LIFECYCLE_STATES.ACTIVE, reviewState, INDEX_STRING_CEILING],
    direction: 'prev',
  };
}

function recentValues(records, limit) {
  return records
    .map((record) => record.value)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id))
    .slice(0, limit)
    .map(cloneSavedStudyData);
}

function rehomeObject(object, ownerRef) {
  const copy = cloneSavedStudyData(object);
  copy.ownerRef = cloneSavedStudyData(ownerRef);
  validateSavedStudyObject(copy);
  return copy;
}

export function createSavedStudyRepository({
  database = null,
  ownerRef,
  clock = () => new Date(),
} = {}) {
  validateSavedStudyOwnerRef(ownerRef);
  if (typeof clock !== 'function') throw new TypeError('Saved Study repository clock must be a function');
  let durableDatabase = database;
  let initializationPromise = null;
  const ownerKey = savedStudyOwnerKey(ownerRef);

  function getDatabase() {
    if (!durableDatabase) durableDatabase = createIndexedDbSavedStudyDatabase();
    if (typeof durableDatabase.runTransaction !== 'function') {
      throw new TypeError('SavedStudyRepository requires a transactional database adapter');
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
        if (error instanceof SavedStudyStorageError) throw error;
        throw storageFailure(
          error?.name === 'VersionError' ? 'unsupported_database_version' : 'open_failed',
          'Saved Study storage could not be opened.',
          error,
        );
      }
      if (existing) return deepFreezeSavedStudyData(cloneSavedStudyData(validateMetadata(existing, ownerRef)));

      const timestamp = timestampFrom(clock);
      const metadata = createMetadata(ownerRef, timestamp);
      try {
        return await getDatabase().runTransaction(
          [STORES.METADATA, STORES.OBJECTS],
          'readwrite',
          async (transaction) => {
            const raced = await transaction.get(STORES.METADATA, METADATA_KEY);
            if (raced) return deepFreezeSavedStudyData(cloneSavedStudyData(validateMetadata(raced, ownerRef)));
            if (await transaction.count(STORES.OBJECTS) !== 0) {
              throw storageFailure(
                'unowned_records',
                'Saved Study records exist without valid ownership metadata and were left untouched.',
              );
            }
            await transaction.add(STORES.METADATA, metadata);
            return deepFreezeSavedStudyData(cloneSavedStudyData(metadata));
          },
        );
      } catch (error) {
        if (error instanceof SavedStudyStorageError) throw error;
        throw storageFailure('migration_failed', 'Saved Study storage initialization failed safely.', error);
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
      if (error instanceof SavedStudyStorageError || error instanceof RangeError || error instanceof TypeError) {
        throw error;
      }
      throw storageFailure('read_failed', 'Saved Study data could not be read.', error);
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
      if (error instanceof SavedStudyStorageError || error instanceof RangeError || error instanceof TypeError) {
        throw error;
      }
      throw storageFailure(
        'transaction_failed',
        'Saved Study data could not be saved; prior durable records remain authoritative.',
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
    return next;
  }

  async function getOwnedRecord(transaction, id) {
    const record = await transaction.get(STORES.OBJECTS, id);
    if (record && record.ownerKey !== ownerKey) {
      throw storageFailure('owner_mismatch', 'Saved Study object belongs to a different owner.');
    }
    return record;
  }

  const repository = {
    schemaVersion: SAVED_STUDY_OBJECT_SCHEMA_VERSION,
    backendSchemaVersion: SAVED_STUDY_BACKEND_SCHEMA_VERSION,
    databaseName: database?.name ?? SAVED_STUDY_DATABASE_NAME,
    databaseVersion: SAVED_STUDY_DATABASE_VERSION,
    ownerRef: deepFreezeSavedStudyData(cloneSavedStudyData(ownerRef)),

    initialize,

    async save(object) {
      validateSavedStudyObject(object);
      if (!sameSavedStudyOwner(object.ownerRef, ownerRef)) {
        throw new RangeError('SavedStudyObject owner does not match repository owner');
      }
      return writeTransaction([STORES.OBJECTS], async (transaction) => {
        const [metadata, existing] = await Promise.all([
          metadataIn(transaction),
          getOwnedRecord(transaction, object.id),
        ]);
        if (existing) {
          if (canonicalJson(existing.value) === canonicalJson(object)) {
            return deepFreezeSavedStudyData({
              object: cloneSavedStudyData(existing.value),
              repositoryRevision: metadata.revision,
              idempotent: true,
            });
          }
          throw new RangeError(`SavedStudyObject ID collision: ${object.id}`);
        }
        await transaction.add(STORES.OBJECTS, objectRecord(object));
        const next = await commitMetadata(transaction, metadata);
        return deepFreezeSavedStudyData({
          object: cloneSavedStudyData(object),
          repositoryRevision: next.revision,
          idempotent: false,
        });
      });
    },

    async getById(id, { includeArchived = true } = {}) {
      if (typeof id !== 'string' || !id) throw new TypeError('SavedStudyObject id is required');
      return readTransaction([STORES.OBJECTS], async (transaction) => {
        const record = await getOwnedRecord(transaction, id);
        if (!record || (!includeArchived
          && record.lifecycleState === SAVED_STUDY_LIFECYCLE_STATES.ARCHIVED)) return null;
        validateSavedStudyObject(record.value);
        return deepFreezeSavedStudyData(cloneSavedStudyData(record.value));
      });
    },

    async updateAnnotations(id, changes, { updatedAt = timestampFrom(clock), expectedRevision = null } = {}) {
      return writeTransaction([STORES.OBJECTS], async (transaction) => {
        const [metadata, record] = await Promise.all([
          metadataIn(transaction),
          getOwnedRecord(transaction, id),
        ]);
        if (!record) throw new RangeError(`Unknown SavedStudyObject: ${id}`);
        if (expectedRevision !== null && record.value.revision !== expectedRevision) {
          throw new RangeError('SavedStudyObject changed since it was read');
        }
        const updated = updateSavedStudyAnnotations(record.value, changes, updatedAt);
        await transaction.put(STORES.OBJECTS, objectRecord(updated));
        const next = await commitMetadata(transaction, metadata);
        return deepFreezeSavedStudyData({
          object: cloneSavedStudyData(updated),
          repositoryRevision: next.revision,
        });
      });
    },

    async archive(id, { archivedAt = timestampFrom(clock), expectedRevision = null } = {}) {
      return writeTransaction([STORES.OBJECTS], async (transaction) => {
        const [metadata, record] = await Promise.all([
          metadataIn(transaction),
          getOwnedRecord(transaction, id),
        ]);
        if (!record) throw new RangeError(`Unknown SavedStudyObject: ${id}`);
        if (expectedRevision !== null && record.value.revision !== expectedRevision) {
          throw new RangeError('SavedStudyObject changed since it was read');
        }
        if (record.value.lifecycle.state === SAVED_STUDY_LIFECYCLE_STATES.ARCHIVED) {
          return deepFreezeSavedStudyData({
            object: cloneSavedStudyData(record.value),
            repositoryRevision: metadata.revision,
            idempotent: true,
          });
        }
        const archived = archiveSavedStudyObject(record.value, archivedAt);
        await transaction.put(STORES.OBJECTS, objectRecord(archived));
        const next = await commitMetadata(transaction, metadata);
        return deepFreezeSavedStudyData({
          object: cloneSavedStudyData(archived),
          repositoryRevision: next.revision,
          idempotent: false,
        });
      });
    },

    async listRecent({ limit = 50 } = {}) {
      const boundedLimit = queryLimit(limit);
      return readTransaction([STORES.OBJECTS], async (transaction) => {
        const records = await transaction.getAllByIndexRange(
          STORES.OBJECTS,
          SAVED_STUDY_INDEXES.OWNER_STATE_UPDATED_AT,
          { ...activeUpdatedRange(ownerKey), limit: boundedLimit },
        );
        return deepFreezeSavedStudyData(records.map((record) => cloneSavedStudyData(record.value)));
      });
    },

    async listByKind(kind, { limit = 50 } = {}) {
      if (typeof kind !== 'string' || !kind) throw new TypeError('Saved Study kind is required');
      const boundedLimit = queryLimit(limit);
      return readTransaction([STORES.OBJECTS], async (transaction) => {
        const records = await transaction.getAllByIndexRange(
          STORES.OBJECTS,
          SAVED_STUDY_INDEXES.OWNER_STATE_KIND_UPDATED_AT,
          { ...activeKindUpdatedRange(ownerKey, kind), limit: boundedLimit },
        );
        return deepFreezeSavedStudyData(records.map((record) => cloneSavedStudyData(record.value)));
      });
    },

    async listForReview({
      reviewState = SAVED_STUDY_REVIEW_STATES.REVIEW_LATER,
      limit = 50,
    } = {}) {
      if (!Object.values(SAVED_STUDY_REVIEW_STATES).includes(reviewState)) {
        throw new RangeError(`Unsupported Saved Study review state: ${reviewState}`);
      }
      const boundedLimit = queryLimit(limit);
      return readTransaction([STORES.OBJECTS], async (transaction) => {
        const records = await transaction.getAllByIndexRange(
          STORES.OBJECTS,
          SAVED_STUDY_INDEXES.OWNER_STATE_REVIEW_UPDATED_AT,
          { ...activeReviewUpdatedRange(ownerKey, reviewState), limit: boundedLimit },
        );
        return deepFreezeSavedStudyData(records.map((record) => cloneSavedStudyData(record.value)));
      });
    },

    async listByTag(tag, { limit = 50 } = {}) {
      const tagKey = normalizeSavedStudyTag(tag).key;
      const boundedLimit = queryLimit(limit);
      return readTransaction([STORES.OBJECTS], async (transaction) => {
        const records = await transaction.getAllByIndex(
          STORES.OBJECTS,
          SAVED_STUDY_INDEXES.TAG_KEYS,
          tagKey,
        );
        return deepFreezeSavedStudyData(recentValues(
          records.filter((record) => record.ownerKey === ownerKey
            && record.lifecycleState === SAVED_STUDY_LIFECYCLE_STATES.ACTIVE),
          boundedLimit,
        ));
      });
    },

    async listByClassification(
      classification = SAVED_STUDY_CLASSIFICATIONS.MISTAKE,
      { limit = 50 } = {},
    ) {
      if (!Object.values(SAVED_STUDY_CLASSIFICATIONS).includes(classification)) {
        throw new RangeError(`Unsupported Saved Study classification: ${classification}`);
      }
      const boundedLimit = queryLimit(limit);
      return readTransaction([STORES.OBJECTS], async (transaction) => {
        const records = await transaction.getAllByIndex(
          STORES.OBJECTS,
          SAVED_STUDY_INDEXES.CLASSIFICATION_KEYS,
          classification,
        );
        return deepFreezeSavedStudyData(recentValues(
          records.filter((record) => record.ownerKey === ownerKey
            && record.lifecycleState === SAVED_STUDY_LIFECYCLE_STATES.ACTIVE),
          boundedLimit,
        ));
      });
    },

    async exportLibrary({ exportedAt = timestampFrom(clock) } = {}) {
      return readTransaction([STORES.OBJECTS], async (transaction) => {
        const records = await transaction.getAll(STORES.OBJECTS);
        return createSavedStudyLibraryExport({
          ownerRef,
          objects: records.filter((record) => record.ownerKey === ownerKey).map((record) => record.value),
          exportedAt,
        });
      });
    },

    async importLibrary(value, { ownerPolicy = 'adopt_local' } = {}) {
      const portable = parseSavedStudyLibraryExport(value);
      if (!['adopt_local', 'require_match'].includes(ownerPolicy)) {
        throw new RangeError(`Unsupported Saved Study import owner policy: ${ownerPolicy}`);
      }
      if (ownerPolicy === 'require_match' && !sameSavedStudyOwner(portable.ownerRef, ownerRef)) {
        throw new RangeError('Saved Study export owner does not match repository owner');
      }
      const incoming = portable.objects.map((object) => (
        sameSavedStudyOwner(object.ownerRef, ownerRef) ? cloneSavedStudyData(object) : rehomeObject(object, ownerRef)
      ));
      return writeTransaction([STORES.OBJECTS], async (transaction) => {
        const metadata = await metadataIn(transaction);
        const existing = await Promise.all(incoming.map((object) => getOwnedRecord(transaction, object.id)));
        let importedCount = 0;
        let skippedCount = 0;
        for (let index = 0; index < incoming.length; index += 1) {
          const object = incoming[index];
          const durable = existing[index];
          if (durable) {
            if (canonicalJson(durable.value) !== canonicalJson(object)) {
              throw new RangeError(`SavedStudyObject ID collision: ${object.id}`);
            }
            skippedCount += 1;
            continue;
          }
          await transaction.add(STORES.OBJECTS, objectRecord(object));
          importedCount += 1;
        }
        const next = importedCount > 0 ? await commitMetadata(transaction, metadata) : metadata;
        return deepFreezeSavedStudyData({
          importedCount,
          skippedCount,
          repositoryRevision: next.revision,
        });
      });
    },

    async getRepositoryStatus() {
      const metadata = await initialize();
      return deepFreezeSavedStudyData(cloneSavedStudyData(metadata));
    },

    async close() {
      if (durableDatabase?.close) await durableDatabase.close();
      initializationPromise = null;
    },
  };

  return Object.freeze(repository);
}

