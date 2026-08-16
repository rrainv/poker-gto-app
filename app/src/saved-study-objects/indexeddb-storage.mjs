export const SAVED_STUDY_DATABASE_NAME = 'riverline-saved-study-objects';
export const SAVED_STUDY_DATABASE_VERSION = 1;
export const SAVED_STUDY_BACKEND_SCHEMA_VERSION = 'saved-study-indexeddb/v1';

export const SAVED_STUDY_OBJECT_STORES = Object.freeze({
  METADATA: 'metadata',
  OBJECTS: 'objects',
});

export const SAVED_STUDY_INDEXES = Object.freeze({
  OWNER_STATE_UPDATED_AT: 'ownerStateUpdatedAt',
  OWNER_STATE_KIND_UPDATED_AT: 'ownerStateKindUpdatedAt',
  OWNER_STATE_REVIEW_UPDATED_AT: 'ownerStateReviewUpdatedAt',
  TAG_KEYS: 'tagKeys',
  CLASSIFICATION_KEYS: 'classificationKeys',
});

const STORE_DEFINITIONS = Object.freeze({
  [SAVED_STUDY_OBJECT_STORES.METADATA]: Object.freeze({ keyPath: 'key', indexes: [] }),
  [SAVED_STUDY_OBJECT_STORES.OBJECTS]: Object.freeze({
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({
        name: SAVED_STUDY_INDEXES.OWNER_STATE_UPDATED_AT,
        keyPath: ['ownerKey', 'lifecycleState', 'updatedAt'],
      }),
      Object.freeze({
        name: SAVED_STUDY_INDEXES.OWNER_STATE_KIND_UPDATED_AT,
        keyPath: ['ownerKey', 'lifecycleState', 'kind', 'updatedAt'],
      }),
      Object.freeze({
        name: SAVED_STUDY_INDEXES.OWNER_STATE_REVIEW_UPDATED_AT,
        keyPath: ['ownerKey', 'lifecycleState', 'reviewState', 'updatedAt'],
      }),
      Object.freeze({ name: SAVED_STUDY_INDEXES.TAG_KEYS, keyPath: 'tagKeys', multiEntry: true }),
      Object.freeze({
        name: SAVED_STUDY_INDEXES.CLASSIFICATION_KEYS,
        keyPath: 'classificationKeys',
        multiEntry: true,
      }),
    ]),
  }),
});

function cloneData(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(cloneData(request.result)), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error || new Error('Saved Study transaction aborted')),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error || new Error('Saved Study transaction failed')),
      { once: true },
    );
  });
}

function ensureStore(database, transaction, name, definition) {
  const store = database.objectStoreNames.contains(name)
    ? transaction.objectStore(name)
    : database.createObjectStore(name, { keyPath: definition.keyPath });
  for (const index of definition.indexes) {
    if (!store.indexNames.contains(index.name)) {
      store.createIndex(index.name, index.keyPath, {
        unique: index.unique === true,
        multiEntry: index.multiEntry === true,
      });
    }
  }
}

function migrateToVersion1(database, transaction) {
  for (const [name, definition] of Object.entries(STORE_DEFINITIONS)) {
    ensureStore(database, transaction, name, definition);
  }
}

export const SAVED_STUDY_DATABASE_MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, upgrade: migrateToVersion1 }),
]);

function applyMigrations(database, transaction, oldVersion, newVersion) {
  for (const migration of SAVED_STUDY_DATABASE_MIGRATIONS) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      migration.upgrade(database, transaction);
    }
  }
}

function openDatabase(indexedDBFactory, name, version) {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDBFactory.open(name, version);
    } catch (error) {
      reject(error);
      return;
    }
    request.addEventListener('upgradeneeded', (event) => {
      applyMigrations(request.result, request.transaction, event.oldVersion, event.newVersion);
    }, { once: true });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener(
      'blocked',
      () => reject(new Error('Saved Study database upgrade is blocked')),
      { once: true },
    );
  });
}

function cursorResults(request, limit) {
  return new Promise((resolve, reject) => {
    const values = [];
    request.addEventListener('success', () => {
      const cursor = request.result;
      if (!cursor || values.length >= limit) {
        resolve(cloneData(values));
        return;
      }
      values.push(cursor.value);
      cursor.continue();
    });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function indexedDbTransactionAdapter(transaction, IDBKeyRangeFactory) {
  function store(name) {
    return transaction.objectStore(name);
  }
  return Object.freeze({
    get: (name, key) => requestResult(store(name).get(key)),
    getAll: (name) => requestResult(store(name).getAll()),
    getAllByIndex: (name, indexName, query, limit = null) => {
      const index = store(name).index(indexName);
      return requestResult(limit === null ? index.getAll(query) : index.getAll(query, limit));
    },
    getAllByIndexRange(name, indexName, { lower, upper, direction = 'next', limit = 100 } = {}) {
      if (!IDBKeyRangeFactory || typeof IDBKeyRangeFactory.bound !== 'function') {
        throw new TypeError('IDBKeyRange is unavailable');
      }
      const range = IDBKeyRangeFactory.bound(lower, upper);
      return cursorResults(store(name).index(indexName).openCursor(range, direction), limit);
    },
    count: (name) => requestResult(store(name).count()),
    add: (name, value) => requestResult(store(name).add(cloneData(value))),
    put: (name, value) => requestResult(store(name).put(cloneData(value))),
    delete: (name, key) => requestResult(store(name).delete(key)),
  });
}

export function createIndexedDbSavedStudyDatabase({
  indexedDB = globalThis.indexedDB,
  IDBKeyRange = globalThis.IDBKeyRange,
  name = SAVED_STUDY_DATABASE_NAME,
  version = SAVED_STUDY_DATABASE_VERSION,
} = {}) {
  if (!indexedDB || typeof indexedDB.open !== 'function') throw new TypeError('IndexedDB is unavailable');
  let connectionPromise = null;

  async function connection() {
    if (!connectionPromise) {
      connectionPromise = openDatabase(indexedDB, name, version).then((database) => {
        database.addEventListener('versionchange', () => database.close());
        return database;
      });
    }
    return connectionPromise;
  }

  return Object.freeze({
    name,
    version,
    async runTransaction(storeNames, mode, operation) {
      const database = await connection();
      const transaction = database.transaction(storeNames, mode, { durability: 'strict' });
      const completion = transactionCompletion(transaction);
      try {
        const result = await operation(indexedDbTransactionAdapter(transaction, IDBKeyRange));
        await completion;
        return result;
      } catch (error) {
        try { transaction.abort(); } catch { /* transaction already completed or aborted */ }
        try { await completion; } catch { /* preserve the operation error */ }
        throw error;
      }
    },
    async close() {
      if (!connectionPromise) return;
      const database = await connectionPromise;
      database.close();
      connectionPromise = null;
    },
  });
}

function valueAtKeyPath(value, keyPath) {
  if (Array.isArray(keyPath)) return keyPath.map((entry) => valueAtKeyPath(value, entry));
  return String(keyPath).split('.').reduce((current, part) => current?.[part], value);
}

function compareKeys(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      if (index >= left.length) return -1;
      if (index >= right.length) return 1;
      const compared = compareKeys(left[index], right[index]);
      if (compared !== 0) return compared;
    }
    return 0;
  }
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function indexDefinition(storeName, indexName) {
  const definition = STORE_DEFINITIONS[storeName]?.indexes.find((entry) => entry.name === indexName);
  if (!definition) throw new RangeError(`Unknown Saved Study index: ${storeName}.${indexName}`);
  return definition;
}

function matchesIndex(value, definition, query) {
  const key = valueAtKeyPath(value, definition.keyPath);
  return definition.multiEntry && Array.isArray(key)
    ? key.some((entry) => compareKeys(entry, query) === 0)
    : compareKeys(key, query) === 0;
}

export function createMemorySavedStudyDatabase({ name = 'memory-saved-study-objects' } = {}) {
  const stores = new Map(Object.keys(STORE_DEFINITIONS).map((storeName) => [storeName, new Map()]));
  let nextFailure = null;
  let closed = false;
  const metrics = {
    transactions: 0,
    readonly: 0,
    readwrite: 0,
    recordsRead: 0,
    indexRecordsReturned: 0,
    recordsWritten: 0,
    recordsDeleted: 0,
  };

  function takeFailure(phase, mode) {
    if (!nextFailure || nextFailure.phase !== phase || (nextFailure.mode && nextFailure.mode !== mode)) {
      return null;
    }
    const failure = nextFailure;
    nextFailure = null;
    return failure;
  }

  function keyFor(storeName, value) {
    return valueAtKeyPath(value, STORE_DEFINITIONS[storeName].keyPath);
  }

  function visibleValue(storeName, key, writes, deletes) {
    if (deletes.get(storeName)?.has(key)) return undefined;
    if (writes.get(storeName)?.has(key)) return cloneData(writes.get(storeName).get(key));
    return cloneData(stores.get(storeName).get(key));
  }

  function visibleEntries(storeName, writes, deletes) {
    const keys = new Set([
      ...stores.get(storeName).keys(),
      ...(writes.get(storeName)?.keys() ?? []),
    ]);
    return [...keys]
      .filter((key) => !deletes.get(storeName)?.has(key))
      .map((key) => visibleValue(storeName, key, writes, deletes));
  }

  return Object.freeze({
    name,
    version: SAVED_STUDY_DATABASE_VERSION,
    async runTransaction(storeNames, mode, operation) {
      if (closed) throw new Error('Saved Study database is closed');
      metrics.transactions += 1;
      metrics[mode] += 1;
      const openFailure = takeFailure('open', mode);
      if (openFailure) throw openFailure.error;
      const writes = new Map(storeNames.map((storeName) => [storeName, new Map()]));
      const deletes = new Map(storeNames.map((storeName) => [storeName, new Set()]));
      const adapter = Object.freeze({
        async get(storeName, key) {
          metrics.recordsRead += 1;
          return visibleValue(storeName, key, writes, deletes);
        },
        async getAll(storeName) {
          const values = visibleEntries(storeName, writes, deletes);
          metrics.recordsRead += values.length;
          return values;
        },
        async getAllByIndex(storeName, indexName, query, limit = null) {
          const definition = indexDefinition(storeName, indexName);
          const matches = visibleEntries(storeName, writes, deletes)
            .filter((entry) => matchesIndex(entry, definition, query));
          const values = limit === null ? matches : matches.slice(0, limit);
          metrics.recordsRead += values.length;
          metrics.indexRecordsReturned += values.length;
          return values;
        },
        async getAllByIndexRange(storeName, indexName, {
          lower, upper, direction = 'next', limit = 100,
        } = {}) {
          const definition = indexDefinition(storeName, indexName);
          const values = visibleEntries(storeName, writes, deletes)
            .map((entry) => ({ entry, key: valueAtKeyPath(entry, definition.keyPath) }))
            .filter(({ key }) => compareKeys(key, lower) >= 0 && compareKeys(key, upper) <= 0)
            .sort((left, right) => compareKeys(left.key, right.key));
          if (direction === 'prev') values.reverse();
          const selected = values.slice(0, limit).map(({ entry }) => entry);
          metrics.recordsRead += selected.length;
          metrics.indexRecordsReturned += selected.length;
          return selected;
        },
        async count(storeName) {
          return visibleEntries(storeName, writes, deletes).length;
        },
        async add(storeName, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = keyFor(storeName, value);
          if (visibleValue(storeName, key, writes, deletes) !== undefined) {
            throw new Error(`ConstraintError: duplicate key ${key}`);
          }
          deletes.get(storeName).delete(key);
          writes.get(storeName).set(key, cloneData(value));
          return key;
        },
        async put(storeName, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = keyFor(storeName, value);
          deletes.get(storeName).delete(key);
          writes.get(storeName).set(key, cloneData(value));
          return key;
        },
        async delete(storeName, key) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          writes.get(storeName).delete(key);
          deletes.get(storeName).add(key);
        },
      });
      const result = await operation(adapter);
      const beforeCommitFailure = takeFailure('before_commit', mode);
      if (beforeCommitFailure) throw beforeCommitFailure.error;
      for (const storeName of storeNames) {
        metrics.recordsDeleted += deletes.get(storeName).size;
        metrics.recordsWritten += writes.get(storeName).size;
        for (const key of deletes.get(storeName)) stores.get(storeName).delete(key);
        for (const [key, value] of writes.get(storeName)) stores.get(storeName).set(key, cloneData(value));
      }
      const afterCommitFailure = takeFailure('after_commit', mode);
      if (afterCommitFailure) throw afterCommitFailure.error;
      return cloneData(result);
    },
    failNextTransaction(phase = 'before_commit', error = new Error('Injected database failure'), mode = null) {
      nextFailure = { phase, error, mode };
    },
    estimateBytes() {
      return new TextEncoder().encode(JSON.stringify(Object.fromEntries(
        [...stores].map(([storeName, entries]) => [storeName, [...entries.values()]]),
      ))).byteLength;
    },
    getMetrics() { return cloneData(metrics); },
    async close() { closed = true; },
    reopen() { closed = false; },
  });
}
