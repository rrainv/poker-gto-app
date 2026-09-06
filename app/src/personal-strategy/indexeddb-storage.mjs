export const PERSONAL_STRATEGY_DATABASE_NAME = 'riverline-personal-strategy';
export const PERSONAL_STRATEGY_DATABASE_VERSION = 4;
export const PERSONAL_STRATEGY_BACKEND_SCHEMA_VERSION = 'personal-strategy-indexeddb/v4';

export const PERSONAL_STRATEGY_OBJECT_STORES = Object.freeze({
  METADATA: 'metadata',
  QUALITATIVE_EVIDENCE: 'qualitativeEvidence',
  EXACT_NODE_INTENTS: 'exactNodeIntents',
  PROFILES: 'profiles',
  MODES: 'modes',
  RANGE_OBSERVATIONS: 'rangeObservations',
  CURRENT_RANGE_OBSERVATIONS: 'currentRangeObservations',
  CONFLICTING_RANGE_OBSERVATIONS: 'conflictingRangeObservations',
  TRAINING_OBSERVATIONS: 'trainingObservations',
  CALIBRATION_SESSIONS: 'calibrationSessions',
});

const STORE_DEFINITIONS = Object.freeze({
  [PERSONAL_STRATEGY_OBJECT_STORES.EXACT_NODE_INTENTS]: Object.freeze({ keyPath: 'id', indexes: [['profileId', 'profileId'], ['modeId', 'modeId']] }),
  [PERSONAL_STRATEGY_OBJECT_STORES.QUALITATIVE_EVIDENCE]: Object.freeze({ keyPath: 'id', indexes: [['profileId', 'profileId'], ['modeId', 'modeId']] }),
  [PERSONAL_STRATEGY_OBJECT_STORES.METADATA]: Object.freeze({ keyPath: 'key', indexes: [] }),
  [PERSONAL_STRATEGY_OBJECT_STORES.PROFILES]: Object.freeze({ keyPath: 'id', indexes: [] }),
  [PERSONAL_STRATEGY_OBJECT_STORES.MODES]: Object.freeze({
    keyPath: 'id', indexes: [['profileId', 'profileId']],
  }),
  [PERSONAL_STRATEGY_OBJECT_STORES.RANGE_OBSERVATIONS]: Object.freeze({
    keyPath: 'id',
    indexes: [
      ['profileId', 'profileId'],
      ['logicalKey', 'logicalKey'],
      ['scopeKey', 'scopeKey'],
      ['calibrationSessionId', 'calibrationSessionId'],
    ],
  }),
  [PERSONAL_STRATEGY_OBJECT_STORES.CURRENT_RANGE_OBSERVATIONS]: Object.freeze({
    keyPath: 'logicalKey',
    indexes: [['profileId', 'profileId'], ['scopeKey', 'scopeKey']],
  }),
  [PERSONAL_STRATEGY_OBJECT_STORES.CONFLICTING_RANGE_OBSERVATIONS]: Object.freeze({
    keyPath: 'observationId',
    indexes: [
      ['profileId', 'profileId'],
      ['logicalKey', 'logicalKey'],
      ['scopeKey', 'scopeKey'],
    ],
  }),
  [PERSONAL_STRATEGY_OBJECT_STORES.TRAINING_OBSERVATIONS]: Object.freeze({
    keyPath: 'id', indexes: [['profileId', 'profileId'], ['logicalKey', 'logicalKey']],
  }),
  [PERSONAL_STRATEGY_OBJECT_STORES.CALIBRATION_SESSIONS]: Object.freeze({
    keyPath: 'id', indexes: [['profileId', 'profileId'], ['scopeKey', 'scopeKey']],
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
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB transaction aborted')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB transaction failed')), { once: true });
  });
}

function ensureSchema(database, upgradeTransaction) {
  for (const [name, definition] of Object.entries(STORE_DEFINITIONS)) {
    const store = database.objectStoreNames.contains(name)
      ? upgradeTransaction.objectStore(name)
      : database.createObjectStore(name, { keyPath: definition.keyPath });
    for (const [indexName, keyPath] of definition.indexes) {
      if (!store.indexNames.contains(indexName)) store.createIndex(indexName, keyPath, { unique: false });
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
    request.addEventListener('upgradeneeded', () => ensureSchema(request.result, request.transaction), { once: true });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener('blocked', () => reject(new Error('Personal Strategy database upgrade is blocked')), { once: true });
  });
}

function indexedDbTransactionAdapter(transaction) {
  function store(name) {
    return transaction.objectStore(name);
  }
  return Object.freeze({
    get: (name, key) => requestResult(store(name).get(key)),
    getAll: (name) => requestResult(store(name).getAll()),
    getAllByIndex: (name, indexName, query) => requestResult(store(name).index(indexName).getAll(query)),
    count: (name) => requestResult(store(name).count()),
    add: (name, value) => requestResult(store(name).add(cloneData(value))),
    put: (name, value) => requestResult(store(name).put(cloneData(value))),
    delete: (name, key) => requestResult(store(name).delete(key)),
    clear: (name) => requestResult(store(name).clear()),
  });
}

export function createIndexedDbPersonalStrategyDatabase({
  indexedDB = globalThis.indexedDB,
  name = PERSONAL_STRATEGY_DATABASE_NAME,
  version = PERSONAL_STRATEGY_DATABASE_VERSION,
} = {}) {
  if (!indexedDB || typeof indexedDB.open !== 'function') {
    throw new TypeError('IndexedDB is unavailable');
  }
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
    async runTransaction(storeNames, mode, operation, { signal = null } = {}) {
      if (signal?.aborted) throw new Error('Identity lifecycle scope is stale');
      const database = await connection();
      if (signal?.aborted) throw new Error('Identity lifecycle scope is stale');
      const transaction = database.transaction(storeNames, mode, { durability: 'strict' });
      const completion = transactionCompletion(transaction);
      completion.catch(() => {});
      const abortForSignal = () => {
        try { transaction.abort(); } catch { /* already complete */ }
      };
      signal?.addEventListener('abort', abortForSignal, { once: true });
      try {
        if (signal?.aborted) throw new Error('Identity lifecycle scope is stale');
        const result = await operation(indexedDbTransactionAdapter(transaction));
        if (signal?.aborted) throw new Error('Identity lifecycle scope is stale');
        await completion;
        if (signal?.aborted) throw new Error('Identity lifecycle scope is stale');
        return result;
      } catch (error) {
        try { transaction.abort(); } catch { /* already completed or aborted */ }
        try { await completion; } catch { /* preserve the operation error */ }
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

function memoryKey(definition, value) {
  return value[definition.keyPath];
}

export function createMemoryPersonalStrategyDatabase({ name = 'memory-personal-strategy' } = {}) {
  const stores = new Map(Object.keys(STORE_DEFINITIONS).map((storeName) => [storeName, new Map()]));
  let nextFailure = null;
  let closed = false;
  const metrics = { transactions: 0, readonly: 0, readwrite: 0 };

  function takeFailure(phase, mode) {
    if (!nextFailure || nextFailure.phase !== phase || (nextFailure.mode && nextFailure.mode !== mode)) return null;
    const failure = nextFailure;
    nextFailure = null;
    return failure;
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
    version: PERSONAL_STRATEGY_DATABASE_VERSION,
    async runTransaction(storeNames, mode, operation, { signal = null } = {}) {
      if (signal?.aborted) throw new Error('Identity lifecycle scope is stale');
      if (closed) throw new Error('Personal Strategy database is closed');
      metrics.transactions += 1;
      metrics[mode] += 1;
      const openFailure = takeFailure('open', mode);
      if (openFailure) throw openFailure.error;
      const writes = new Map(storeNames.map((storeName) => [storeName, new Map()]));
      const deletes = new Map(storeNames.map((storeName) => [storeName, new Set()]));
      const adapter = Object.freeze({
        async get(storeName, key) {
          return visibleValue(storeName, key, writes, deletes);
        },
        async getAll(storeName) {
          return visibleEntries(storeName, writes, deletes);
        },
        async getAllByIndex(storeName, indexName, query) {
          return visibleEntries(storeName, writes, deletes)
            .filter((entry) => entry?.[indexName] === query);
        },
        async count(storeName) {
          return visibleEntries(storeName, writes, deletes).length;
        },
        async add(storeName, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = memoryKey(STORE_DEFINITIONS[storeName], value);
          if (visibleValue(storeName, key, writes, deletes) !== undefined) {
            throw new Error(`ConstraintError: duplicate key ${key}`);
          }
          deletes.get(storeName).delete(key);
          writes.get(storeName).set(key, cloneData(value));
          return key;
        },
        async put(storeName, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = memoryKey(STORE_DEFINITIONS[storeName], value);
          deletes.get(storeName).delete(key);
          writes.get(storeName).set(key, cloneData(value));
          return key;
        },
        async delete(storeName, key) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          writes.get(storeName).delete(key);
          deletes.get(storeName).add(key);
        },
        async clear(storeName) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          for (const entry of visibleEntries(storeName, writes, deletes)) {
            deletes.get(storeName).add(memoryKey(STORE_DEFINITIONS[storeName], entry));
          }
          writes.get(storeName).clear();
        },
      });
      const result = await operation(adapter);
      if (signal?.aborted) throw new Error('Identity lifecycle scope is stale');
      const beforeCommitFailure = takeFailure('before_commit', mode);
      if (beforeCommitFailure) throw beforeCommitFailure.error;
      for (const storeName of storeNames) {
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
