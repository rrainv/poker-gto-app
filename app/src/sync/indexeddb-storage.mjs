export const SYNC_DATABASE_NAME = 'riverline-sync';
export const SYNC_DATABASE_VERSION = 1;
export const SYNC_BACKEND_SCHEMA_VERSION = 'riverline-sync-indexeddb/v1';

export const SYNC_STORES = Object.freeze({
  PREFERENCES: 'preferences',
  RECORDS: 'records',
  OPERATIONS: 'operations',
  CONFLICTS: 'conflicts',
  CURSORS: 'cursors',
});

export const SYNC_INDEXES = Object.freeze({ IDENTITY_DOMAIN: 'identityDomain' });

const DEFINITIONS = Object.freeze(Object.fromEntries(
  Object.values(SYNC_STORES).map((name) => [name, Object.freeze({
    keyPath: 'key',
    indexes: name === SYNC_STORES.PREFERENCES || name === SYNC_STORES.CURSORS
      ? []
      : [Object.freeze({ name: SYNC_INDEXES.IDENTITY_DOMAIN, keyPath: ['identityId', 'domain'] })],
  })]),
));

function clone(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(clone(request.result)), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function completion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', resolve, { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('Sync transaction aborted')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('Sync transaction failed')), { once: true });
  });
}

function openDatabase(indexedDB, name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, SYNC_DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      for (const [storeName, definition] of Object.entries(DEFINITIONS)) {
        const store = request.result.objectStoreNames.contains(storeName)
          ? request.transaction.objectStore(storeName)
          : request.result.createObjectStore(storeName, { keyPath: definition.keyPath });
        for (const index of definition.indexes) {
          if (!store.indexNames.contains(index.name)) store.createIndex(index.name, index.keyPath);
        }
      }
    }, { once: true });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener('blocked', () => reject(new Error('Sync database upgrade is blocked')), { once: true });
  });
}

function adapter(transaction) {
  const store = (name) => transaction.objectStore(name);
  return Object.freeze({
    get: (name, key) => requestResult(store(name).get(key)),
    getAllByIdentityDomain: (name, identityId, domain) => (
      requestResult(store(name).index(SYNC_INDEXES.IDENTITY_DOMAIN).getAll([identityId, domain]))
    ),
    put: (name, value) => requestResult(store(name).put(clone(value))),
    delete: (name, key) => requestResult(store(name).delete(key)),
  });
}

export function createIndexedDbSyncDatabase({
  indexedDB = globalThis.indexedDB,
  name = SYNC_DATABASE_NAME,
} = {}) {
  if (!indexedDB?.open) throw new TypeError('IndexedDB is unavailable');
  let connectionPromise = null;
  const connection = () => {
    connectionPromise ??= openDatabase(indexedDB, name).then((database) => {
      database.addEventListener('versionchange', () => database.close());
      return database;
    });
    return connectionPromise;
  };
  return Object.freeze({
    name,
    async runTransaction(storeNames, mode, operation) {
      const database = await connection();
      const transaction = database.transaction(storeNames, mode, { durability: 'strict' });
      const done = completion(transaction);
      try {
        const result = await operation(adapter(transaction));
        await done;
        return result;
      } catch (error) {
        try { transaction.abort(); } catch { /* already complete */ }
        try { await done; } catch { /* preserve operation error */ }
        throw error;
      }
    },
    async close() {
      if (!connectionPromise) return;
      (await connectionPromise).close();
      connectionPromise = null;
    },
  });
}

export function createMemorySyncDatabase({ name = 'memory-riverline-sync' } = {}) {
  const stores = new Map(Object.values(SYNC_STORES).map((store) => [store, new Map()]));
  let closed = false;
  return Object.freeze({
    name,
    async runTransaction(storeNames, mode, operation) {
      if (closed) throw new Error('Sync database is closed');
      const working = new Map(storeNames.map((store) => [
        store,
        new Map([...stores.get(store)].map(([key, value]) => [key, clone(value)])),
      ]));
      const map = (store) => working.get(store) ?? stores.get(store);
      const transaction = Object.freeze({
        async get(store, key) { return clone(map(store).get(key)); },
        async getAllByIdentityDomain(store, identityId, domain) {
          return [...map(store).values()]
            .filter((entry) => entry.identityId === identityId && entry.domain === domain)
            .map(clone);
        },
        async put(store, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          map(store).set(value.key, clone(value));
        },
        async delete(store, key) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          map(store).delete(key);
        },
      });
      const result = await operation(transaction);
      if (mode === 'readwrite') {
        for (const store of storeNames) stores.set(store, working.get(store));
      }
      return clone(result);
    },
    snapshot() {
      return clone(Object.fromEntries([...stores].map(([name, entries]) => [name, [...entries.values()]])));
    },
    async close() { closed = true; },
    reopen() { closed = false; },
  });
}
