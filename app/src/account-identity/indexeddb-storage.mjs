export const RIVERLINE_ACCOUNT_DATABASE_NAME = 'riverline-account-identity';
export const RIVERLINE_ACCOUNT_DATABASE_VERSION = 2;
export const RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION = 'riverline-account-indexeddb/v2';

export const RIVERLINE_ACCOUNT_OBJECT_STORES = Object.freeze({
  METADATA: 'metadata',
  IDENTITIES: 'identities',
  DOMAIN_BINDINGS: 'domainOwnershipBindings',
  PROVIDER_MAPPINGS: 'providerIdentityMappings',
});

const STORE_DEFINITIONS = Object.freeze({
  [RIVERLINE_ACCOUNT_OBJECT_STORES.METADATA]: Object.freeze({ keyPath: 'key' }),
  [RIVERLINE_ACCOUNT_OBJECT_STORES.IDENTITIES]: Object.freeze({ keyPath: 'identityId' }),
  [RIVERLINE_ACCOUNT_OBJECT_STORES.DOMAIN_BINDINGS]: Object.freeze({ keyPath: 'bindingId' }),
  [RIVERLINE_ACCOUNT_OBJECT_STORES.PROVIDER_MAPPINGS]: Object.freeze({ keyPath: 'mappingId' }),
});

function cloneData(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed')), { once: true });
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('Account transaction aborted')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('Account transaction failed')), { once: true });
  });
}

function migrateToVersion1(database) {
  for (const [name, definition] of Object.entries(STORE_DEFINITIONS)) {
    if (name === RIVERLINE_ACCOUNT_OBJECT_STORES.PROVIDER_MAPPINGS) continue;
    if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, definition);
  }
}

function migrateToVersion2(database, transaction) {
  const mappings = RIVERLINE_ACCOUNT_OBJECT_STORES.PROVIDER_MAPPINGS;
  if (!database.objectStoreNames.contains(mappings)) {
    database.createObjectStore(mappings, STORE_DEFINITIONS[mappings]);
  }
  const metadataStore = transaction.objectStore(RIVERLINE_ACCOUNT_OBJECT_STORES.METADATA);
  const request = metadataStore.get('state');
  request.addEventListener('success', () => {
    if (!request.result) return;
    metadataStore.put({
      ...request.result,
      backendSchemaVersion: RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
      databaseVersion: RIVERLINE_ACCOUNT_DATABASE_VERSION,
    });
  }, { once: true });
}

export const RIVERLINE_ACCOUNT_DATABASE_MIGRATIONS = Object.freeze([
  Object.freeze({ version: 1, upgrade: migrateToVersion1 }),
  Object.freeze({ version: 2, upgrade: migrateToVersion2 }),
]);

function openDatabase(indexedDBFactory, name, version) {
  return new Promise((resolve, reject) => {
    let request;
    try { request = indexedDBFactory.open(name, version); } catch (error) { reject(error); return; }
    request.addEventListener('upgradeneeded', (event) => {
      for (const migration of RIVERLINE_ACCOUNT_DATABASE_MIGRATIONS) {
        if (migration.version > event.oldVersion && migration.version <= event.newVersion) {
          migration.upgrade(request.result, request.transaction);
        }
      }
    });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('Account database open failed')), { once: true });
    request.addEventListener('blocked', () => reject(new Error('Account database upgrade is blocked')), { once: true });
  });
}

function adapter(transaction) {
  const store = (name) => transaction.objectStore(name);
  return Object.freeze({
    get: async (name, key) => cloneData(await requestResult(store(name).get(key))),
    getAll: async (name) => cloneData(await requestResult(store(name).getAll())),
    count: async (name) => requestResult(store(name).count()),
    add: async (name, value) => requestResult(store(name).add(cloneData(value))),
    put: async (name, value) => requestResult(store(name).put(cloneData(value))),
  });
}

export function createIndexedDbAccountIdentityDatabase({
  indexedDB = globalThis.indexedDB,
  name = RIVERLINE_ACCOUNT_DATABASE_NAME,
  version = RIVERLINE_ACCOUNT_DATABASE_VERSION,
} = {}) {
  if (!indexedDB || typeof indexedDB.open !== 'function') {
    throw new TypeError('IndexedDB is unavailable for Riverline account identity');
  }
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

export function createMemoryAccountIdentityDatabase({ name = 'memory-account-identity' } = {}) {
  let stores = Object.fromEntries(Object.keys(STORE_DEFINITIONS).map((store) => [store, new Map()]));
  let pendingFailure = null;
  const metrics = { transactions: 0, recordsRead: 0, recordsWritten: 0 };

  function keyFor(name, value) {
    return value[STORE_DEFINITIONS[name].keyPath];
  }

  return Object.freeze({
    name,
    version: RIVERLINE_ACCOUNT_DATABASE_VERSION,
    failNextTransaction(stage = 'before_commit', error = new Error('Injected account storage failure'), mode = null) {
      pendingFailure = { stage, error, mode };
    },
    getMetrics: () => cloneData(metrics),
    async runTransaction(storeNames, mode, operation) {
      metrics.transactions += 1;
      if (pendingFailure?.stage === 'open' && (!pendingFailure.mode || pendingFailure.mode === mode)) {
        const failure = pendingFailure; pendingFailure = null; throw failure.error;
      }
      const draft = mode === 'readwrite'
        ? Object.fromEntries(Object.entries(stores).map(([store, records]) => [
          store, new Map([...records].map(([key, value]) => [key, cloneData(value)])),
        ]))
        : stores;
      const transaction = Object.freeze({
        async get(store, key) { metrics.recordsRead += 1; return cloneData(draft[store].get(key)); },
        async getAll(store) { metrics.recordsRead += draft[store].size; return [...draft[store].values()].map(cloneData); },
        async count(store) { return draft[store].size; },
        async add(store, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          const key = keyFor(store, value);
          if (draft[store].has(key)) throw new Error(`Duplicate account key: ${key}`);
          draft[store].set(key, cloneData(value)); metrics.recordsWritten += 1;
        },
        async put(store, value) {
          if (mode !== 'readwrite') throw new Error('Readonly transaction');
          draft[store].set(keyFor(store, value), cloneData(value)); metrics.recordsWritten += 1;
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
  });
}
