export const TRAINING_MEMORY_DATABASE_NAME = 'riverline-training-memory';
export const TRAINING_MEMORY_DATABASE_VERSION = 1;
export const TRAINING_MEMORY_BACKEND_SCHEMA_VERSION = 'training-memory-indexeddb/v1';

export const TRAINING_MEMORY_STORES = Object.freeze({
  METADATA: 'metadata',
  SESSIONS: 'sessions',
  DECISIONS: 'decisions',
});

export const TRAINING_MEMORY_INDEXES = Object.freeze({
  OWNER_STARTED_AT: 'ownerStartedAt',
  OWNER_STATUS_STARTED_AT: 'ownerStatusStartedAt',
  OWNER_SESSION_ORDINAL: 'ownerSessionOrdinal',
  OWNER_CREATED_AT: 'ownerCreatedAt',
  OWNER_REVIEW_STATE_DUE_AT: 'ownerReviewStateDueAt',
  OWNER_SIMILARITY_ANSWERED_AT: 'ownerSimilarityAnsweredAt',
});

const STORE_DEFINITIONS = Object.freeze({
  [TRAINING_MEMORY_STORES.METADATA]: Object.freeze({ keyPath: 'key', indexes: [] }),
  [TRAINING_MEMORY_STORES.SESSIONS]: Object.freeze({
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({
        name: TRAINING_MEMORY_INDEXES.OWNER_STARTED_AT,
        keyPath: ['ownerKey', 'startedAt'],
      }),
      Object.freeze({
        name: TRAINING_MEMORY_INDEXES.OWNER_STATUS_STARTED_AT,
        keyPath: ['ownerKey', 'status', 'startedAt'],
      }),
    ]),
  }),
  [TRAINING_MEMORY_STORES.DECISIONS]: Object.freeze({
    keyPath: 'id',
    indexes: Object.freeze([
      Object.freeze({
        name: TRAINING_MEMORY_INDEXES.OWNER_SESSION_ORDINAL,
        keyPath: ['ownerKey', 'sessionId', 'ordinal'],
      }),
      Object.freeze({
        name: TRAINING_MEMORY_INDEXES.OWNER_CREATED_AT,
        keyPath: ['ownerKey', 'createdAt'],
      }),
      Object.freeze({
        name: TRAINING_MEMORY_INDEXES.OWNER_REVIEW_STATE_DUE_AT,
        keyPath: ['ownerKey', 'reviewState', 'reviewDueAt'],
      }),
      Object.freeze({
        name: TRAINING_MEMORY_INDEXES.OWNER_SIMILARITY_ANSWERED_AT,
        keyPath: ['ownerKey', 'similarityKey', 'answeredAtIndex'],
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
      () => reject(transaction.error || new Error('Training Memory transaction aborted')),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error || new Error('Training Memory transaction failed')),
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
      store.createIndex(index.name, index.keyPath, { unique: false });
    }
  }
}

function migrateToVersion1(database, transaction) {
  for (const [name, definition] of Object.entries(STORE_DEFINITIONS)) {
    ensureStore(database, transaction, name, definition);
  }
}

export const TRAINING_MEMORY_DATABASE_MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, upgrade: migrateToVersion1 }),
]);

function applyMigrations(database, transaction, oldVersion, newVersion) {
  for (const migration of TRAINING_MEMORY_DATABASE_MIGRATIONS) {
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
      () => reject(new Error('Training Memory database upgrade is blocked')),
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
  const store = (name) => transaction.objectStore(name);
  return Object.freeze({
    get: (name, key) => requestResult(store(name).get(key)),
    count: (name) => requestResult(store(name).count()),
    add: (name, value) => requestResult(store(name).add(cloneData(value))),
    put: (name, value) => requestResult(store(name).put(cloneData(value))),
    delete: (name, key) => requestResult(store(name).delete(key)),
    getAllByIndexRange(name, indexName, {
      lower, upper, direction = 'next', limit = 100, lowerOpen = false, upperOpen = false,
    } = {}) {
      if (!IDBKeyRangeFactory?.bound) throw new TypeError('IDBKeyRange is unavailable');
      const range = IDBKeyRangeFactory.bound(lower, upper, lowerOpen, upperOpen);
      return cursorResults(store(name).index(indexName).openCursor(range, direction), limit);
    },
  });
}

export function createIndexedDbTrainingMemoryDatabase({
  indexedDB = globalThis.indexedDB,
  IDBKeyRange = globalThis.IDBKeyRange,
  name = TRAINING_MEMORY_DATABASE_NAME,
  version = TRAINING_MEMORY_DATABASE_VERSION,
} = {}) {
  if (!indexedDB?.open) throw new TypeError('IndexedDB is unavailable');
  let connectionPromise = null;
  const connection = async () => {
    if (!connectionPromise) {
      connectionPromise = openDatabase(indexedDB, name, version).then((database) => {
        database.addEventListener('versionchange', () => database.close());
        return database;
      });
    }
    return connectionPromise;
  };
  return Object.freeze({
    name,
    version,
    async runTransaction(storeNames, mode, operation, { signal = null } = {}) {
      const database = await connection();
      const transaction = database.transaction(storeNames, mode, { durability: 'strict' });
      const completion = transactionCompletion(transaction);
      const abortForSignal = () => {
        try { transaction.abort(); } catch { /* already complete */ }
      };
      signal?.addEventListener('abort', abortForSignal, { once: true });
      try {
        if (signal?.aborted) throw new Error('Training Memory authorization became stale');
        const result = await operation(indexedDbTransactionAdapter(transaction, IDBKeyRange));
        if (signal?.aborted) throw new Error('Training Memory authorization became stale');
        await completion;
        return result;
      } catch (error) {
        try { transaction.abort(); } catch { /* already complete */ }
        try { await completion; } catch { /* keep operation error */ }
        throw error;
      } finally {
        signal?.removeEventListener('abort', abortForSignal);
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
      const comparison = compareKeys(left[index], right[index]);
      if (comparison !== 0) return comparison;
    }
    return 0;
  }
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function indexDefinition(storeName, indexName) {
  const definition = STORE_DEFINITIONS[storeName]?.indexes
    .find((entry) => entry.name === indexName);
  if (!definition) throw new RangeError(`Unknown Training Memory index: ${indexName}`);
  return definition;
}

export function createMemoryTrainingMemoryDatabase({ name = 'memory-training-memory' } = {}) {
  const stores = new Map(Object.keys(STORE_DEFINITIONS).map((key) => [key, new Map()]));
  const metrics = {
    transactions: 0,
    readonly: 0,
    readwrite: 0,
    recordsRead: 0,
    indexRecordsReturned: 0,
    recordsWritten: 0,
  };
  let nextFailure = null;
  let nextCommitDelay = null;

  const keyFor = (storeName, value) => valueAtKeyPath(
    value,
    STORE_DEFINITIONS[storeName].keyPath,
  );

  return Object.freeze({
    name,
    version: TRAINING_MEMORY_DATABASE_VERSION,
    async runTransaction(storeNames, mode, operation, { signal = null } = {}) {
      metrics.transactions += 1;
      metrics[mode] += 1;
      let authorizationAborted = Boolean(signal?.aborted);
      const abortForSignal = () => { authorizationAborted = true; };
      signal?.addEventListener('abort', abortForSignal, { once: true });
      const writes = new Map(storeNames.map((name) => [name, new Map()]));
      const deletes = new Map(storeNames.map((name) => [name, new Set()]));
      const visible = (name, key) => {
        if (deletes.get(name)?.has(key)) return undefined;
        if (writes.get(name)?.has(key)) return cloneData(writes.get(name).get(key));
        return cloneData(stores.get(name).get(key));
      };
      const entries = (name) => {
        const keys = new Set([
          ...stores.get(name).keys(),
          ...(writes.get(name)?.keys() ?? []),
        ]);
        return [...keys]
          .filter((key) => !deletes.get(name)?.has(key))
          .map((key) => visible(name, key));
      };
      const adapter = Object.freeze({
        async get(name, key) {
          metrics.recordsRead += 1;
          return visible(name, key);
        },
        async count(name) { return entries(name).length; },
        async add(name, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = keyFor(name, value);
          if (visible(name, key) !== undefined) throw new Error(`ConstraintError: ${key}`);
          writes.get(name).set(key, cloneData(value));
          deletes.get(name).delete(key);
          return key;
        },
        async put(name, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = keyFor(name, value);
          writes.get(name).set(key, cloneData(value));
          deletes.get(name).delete(key);
          return key;
        },
        async delete(name, key) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          writes.get(name).delete(key);
          deletes.get(name).add(key);
        },
        async getAllByIndexRange(name, indexName, {
          lower, upper, direction = 'next', limit = 100,
          lowerOpen = false, upperOpen = false,
        } = {}) {
          const definition = indexDefinition(name, indexName);
          const values = entries(name)
            .map((entry) => ({ entry, key: valueAtKeyPath(entry, definition.keyPath) }))
            .filter(({ key }) => {
              const fromLower = compareKeys(key, lower);
              const toUpper = compareKeys(key, upper);
              return (lowerOpen ? fromLower > 0 : fromLower >= 0)
                && (upperOpen ? toUpper < 0 : toUpper <= 0);
            })
            .sort((left, right) => compareKeys(left.key, right.key));
          if (direction === 'prev') values.reverse();
          const selected = values.slice(0, limit).map(({ entry }) => cloneData(entry));
          metrics.recordsRead += selected.length;
          metrics.indexRecordsReturned += selected.length;
          return selected;
        },
      });
      try {
        if (authorizationAborted) throw new Error('Training Memory authorization became stale');
        const result = await operation(adapter);
        if (mode === 'readwrite' && nextCommitDelay) {
          const delay = nextCommitDelay;
          nextCommitDelay = null;
          await delay();
        }
        if (authorizationAborted) throw new Error('Training Memory authorization became stale');
        if (nextFailure) {
          const failure = nextFailure;
          nextFailure = null;
          throw failure;
        }
        for (const name of storeNames) {
          for (const key of deletes.get(name)) stores.get(name).delete(key);
          for (const [key, value] of writes.get(name)) {
            stores.get(name).set(key, cloneData(value));
            metrics.recordsWritten += 1;
          }
        }
        return cloneData(result);
      } finally {
        signal?.removeEventListener('abort', abortForSignal);
      }
    },
    failNextTransaction(error = new Error('Injected Training Memory failure')) {
      nextFailure = error;
    },
    delayNextCommit(operation) {
      if (typeof operation !== 'function') throw new TypeError('Commit delay must be a function');
      nextCommitDelay = operation;
    },
    getMetrics() { return cloneData(metrics); },
    inspectStore(name) { return entriesFromStore(stores, name); },
    async close() {},
  });
}

function entriesFromStore(stores, name) {
  if (!stores.has(name)) throw new RangeError(`Unknown Training Memory store: ${name}`);
  return [...stores.get(name).values()].map(cloneData);
}
