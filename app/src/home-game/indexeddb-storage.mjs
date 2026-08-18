export const HOME_GAME_DATABASE_NAME = 'riverline-home-game';
export const HOME_GAME_DATABASE_VERSION = 1;
export const HOME_GAME_BACKEND_SCHEMA_VERSION = 'home-game-indexeddb/v1';

export const HOME_GAME_OBJECT_STORES = Object.freeze({
  METADATA: 'metadata',
  PLAYERS: 'players',
  GROUPS: 'groups',
  SESSIONS: 'sessions',
  TRANSACTIONS: 'transactions',
  SNAPSHOTS: 'snapshots',
});

export const HOME_GAME_INDEXES = Object.freeze({
  OWNER: 'ownerId',
  OWNER_UPDATED_AT: 'ownerIdUpdatedAt',
  OWNER_SESSION: 'ownerIdSessionId',
});

const STORE_DEFINITIONS = Object.freeze({
  [HOME_GAME_OBJECT_STORES.METADATA]: Object.freeze({ keyPath: 'key', indexes: [] }),
  [HOME_GAME_OBJECT_STORES.PLAYERS]: Object.freeze({
    keyPath: 'playerId',
    indexes: [
      [HOME_GAME_INDEXES.OWNER, 'ownerRef.ownerId'],
      [HOME_GAME_INDEXES.OWNER_UPDATED_AT, ['ownerRef.ownerId', 'updatedAt']],
    ],
  }),
  [HOME_GAME_OBJECT_STORES.GROUPS]: Object.freeze({
    keyPath: 'groupId',
    indexes: [
      [HOME_GAME_INDEXES.OWNER, 'ownerRef.ownerId'],
      [HOME_GAME_INDEXES.OWNER_UPDATED_AT, ['ownerRef.ownerId', 'updatedAt']],
    ],
  }),
  [HOME_GAME_OBJECT_STORES.SESSIONS]: Object.freeze({
    keyPath: 'sessionId',
    indexes: [
      [HOME_GAME_INDEXES.OWNER, 'ownerRef.ownerId'],
      [HOME_GAME_INDEXES.OWNER_UPDATED_AT, ['ownerRef.ownerId', 'updatedAt']],
    ],
  }),
  [HOME_GAME_OBJECT_STORES.TRANSACTIONS]: Object.freeze({
    keyPath: 'transactionId',
    indexes: [
      [HOME_GAME_INDEXES.OWNER, 'ownerRef.ownerId'],
      [HOME_GAME_INDEXES.OWNER_SESSION, ['ownerRef.ownerId', 'sessionId']],
    ],
  }),
  [HOME_GAME_OBJECT_STORES.SNAPSHOTS]: Object.freeze({
    keyPath: 'snapshotId',
    indexes: [
      [HOME_GAME_INDEXES.OWNER, 'ownerRef.ownerId'],
      [HOME_GAME_INDEXES.OWNER_SESSION, ['ownerRef.ownerId', 'sessionId']],
    ],
  }),
});

function cloneData(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('Home Game IndexedDB request failed')), { once: true });
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('Home Game transaction aborted')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('Home Game transaction failed')), { once: true });
  });
}

function migrateToVersion1(database) {
  for (const [name, definition] of Object.entries(STORE_DEFINITIONS)) {
    if (database.objectStoreNames.contains(name)) continue;
    const store = database.createObjectStore(name, { keyPath: definition.keyPath });
    for (const [indexName, keyPath] of definition.indexes) store.createIndex(indexName, keyPath, { unique: false });
  }
}

export const HOME_GAME_DATABASE_MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, upgrade: migrateToVersion1 }),
]);

function openDatabase(indexedDBFactory, name, version) {
  return new Promise((resolve, reject) => {
    let request;
    try { request = indexedDBFactory.open(name, version); } catch (error) { reject(error); return; }
    request.addEventListener('upgradeneeded', (event) => {
      for (const migration of HOME_GAME_DATABASE_MIGRATIONS) {
        if (migration.version > event.oldVersion && migration.version <= event.newVersion) migration.upgrade(request.result, request.transaction);
      }
    });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('Home Game database open failed')), { once: true });
    request.addEventListener('blocked', () => reject(new Error('Home Game database upgrade is blocked')), { once: true });
  });
}

function adapter(transaction) {
  const store = (name) => transaction.objectStore(name);
  return Object.freeze({
    get: async (name, key) => cloneData(await requestResult(store(name).get(key))),
    getAll: async (name) => cloneData(await requestResult(store(name).getAll())),
    getAllByIndex: async (name, indexName, query) => cloneData(await requestResult(store(name).index(indexName).getAll(query))),
    count: async (name) => requestResult(store(name).count()),
    add: async (name, value) => requestResult(store(name).add(cloneData(value))),
    put: async (name, value) => requestResult(store(name).put(cloneData(value))),
  });
}

export function createIndexedDbHomeGameDatabase({
  indexedDB = globalThis.indexedDB,
  name = HOME_GAME_DATABASE_NAME,
  version = HOME_GAME_DATABASE_VERSION,
} = {}) {
  if (!indexedDB || typeof indexedDB.open !== 'function') throw new TypeError('IndexedDB is unavailable for Home Game persistence');
  let connectionPromise = null;
  async function connection() {
    if (!connectionPromise) {
      connectionPromise = openDatabase(indexedDB, name, version).then((database) => {
        database.addEventListener('versionchange', () => database.close());
        return database;
      }).catch((error) => { connectionPromise = null; throw error; });
    }
    return connectionPromise;
  }
  return Object.freeze({
    name,
    version,
    durability: 'durable',
    async runTransaction(storeNames, mode, operation) {
      const database = await connection();
      const transaction = database.transaction(storeNames, mode, { durability: 'strict' });
      const completion = transactionCompletion(transaction);
      try {
        const result = await operation(adapter(transaction));
        await completion;
        return result;
      } catch (error) {
        try { transaction.abort(); } catch { /* already complete */ }
        try { await completion; } catch { /* preserve operation error */ }
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

export function createMemoryHomeGameDatabase({ name = 'memory-home-game' } = {}) {
  let stores = Object.fromEntries(Object.keys(STORE_DEFINITIONS).map((store) => [store, new Map()]));
  let pendingFailure = null;
  const metrics = { transactions: 0, recordsRead: 0, recordsWritten: 0 };

  function recordKey(storeName, value) {
    return value[STORE_DEFINITIONS[storeName].keyPath];
  }

  function indexValue(record, indexName) {
    if (indexName === HOME_GAME_INDEXES.OWNER) return record.ownerRef?.ownerId;
    if (indexName === HOME_GAME_INDEXES.OWNER_UPDATED_AT) return [record.ownerRef?.ownerId, record.updatedAt];
    if (indexName === HOME_GAME_INDEXES.OWNER_SESSION) return [record.ownerRef?.ownerId, record.sessionId];
    throw new RangeError(`Unsupported Home Game memory index: ${indexName}`);
  }

  function equalQuery(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return Object.freeze({
    name,
    version: HOME_GAME_DATABASE_VERSION,
    durability: 'memory',
    failNextTransaction(stage = 'before_commit', error = new Error('Injected Home Game storage failure'), mode = null) {
      pendingFailure = { stage, error, mode };
    },
    getMetrics: () => cloneData(metrics),
    async runTransaction(storeNames, mode, operation) {
      metrics.transactions += 1;
      if (pendingFailure?.stage === 'open' && (!pendingFailure.mode || pendingFailure.mode === mode)) {
        const failure = pendingFailure; pendingFailure = null; throw failure.error;
      }
      const draft = mode === 'readwrite'
        ? Object.fromEntries(Object.entries(stores).map(([storeName, records]) => [
          storeName, new Map([...records].map(([key, value]) => [key, cloneData(value)])),
        ]))
        : stores;
      const transaction = Object.freeze({
        async get(storeName, key) { metrics.recordsRead += 1; return cloneData(draft[storeName].get(key)); },
        async getAll(storeName) { metrics.recordsRead += draft[storeName].size; return [...draft[storeName].values()].map(cloneData); },
        async getAllByIndex(storeName, indexName, query) {
          const values = [...draft[storeName].values()].filter((entry) => equalQuery(indexValue(entry, indexName), query));
          metrics.recordsRead += values.length;
          return values.map(cloneData);
        },
        async count(storeName) { return draft[storeName].size; },
        async add(storeName, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = recordKey(storeName, value);
          if (draft[storeName].has(key)) throw new Error(`Duplicate Home Game key: ${key}`);
          draft[storeName].set(key, cloneData(value));
          metrics.recordsWritten += 1;
        },
        async put(storeName, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          draft[storeName].set(recordKey(storeName, value), cloneData(value));
          metrics.recordsWritten += 1;
        },
      });
      const result = await operation(transaction);
      if (pendingFailure?.stage === 'before_commit' && (!pendingFailure.mode || pendingFailure.mode === mode)) {
        const failure = pendingFailure; pendingFailure = null; throw failure.error;
      }
      if (mode === 'readwrite') stores = draft;
      return result;
    },
    async close() {},
    reopen() {},
  });
}
