// SETTINGS-001: exact local entity counts for Settings > Account & Data.
// Read-only. Each count is one IndexedDB `count()` on a store the owning module
// already defines; a database that does not exist yet is never created (it is
// checked with indexedDB.databases() first) and reports 0. When the browser
// cannot say whether a database exists, or a read fails, that count is null:
// unknown is never shown as zero.
import { HOME_GAME_DATABASE_NAME } from '../home-game/indexeddb-storage.mjs';
import { PERSONAL_STRATEGY_DATABASE_NAME } from '../personal-strategy/indexeddb-storage.mjs';
import { SAVED_STUDY_DATABASE_NAME } from '../saved-study-objects/indexeddb-storage.mjs';
import { TRAINING_MEMORY_DATABASE_NAME } from '../training-memory/indexeddb-storage.mjs';

export const SETTINGS_DATA_COUNTS_SCHEMA_VERSION = 'settings-data-counts/v1';

// [count id, database, object store]
export const LOCAL_DATA_COUNT_SOURCES = Object.freeze([
  Object.freeze(['saved', SAVED_STUDY_DATABASE_NAME, 'objects']),
  Object.freeze(['trainingSessions', TRAINING_MEMORY_DATABASE_NAME, 'sessions']),
  Object.freeze(['trainingDecisions', TRAINING_MEMORY_DATABASE_NAME, 'decisions']),
  Object.freeze(['strategySetups', PERSONAL_STRATEGY_DATABASE_NAME, 'profiles']),
  Object.freeze(['gameNights', HOME_GAME_DATABASE_NAME, 'sessions']),
]);

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function countStore(indexedDB, databaseName, storeName) {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    // Opening an unknown name would create it; refuse the upgrade instead.
    request.onupgradeneeded = () => {
      request.transaction?.abort?.();
      reject(new Error('database does not exist'));
    };
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  try {
    if (!database.objectStoreNames.contains(storeName)) return 0;
    const transaction = database.transaction(storeName, 'readonly');
    return await requestResult(transaction.objectStore(storeName).count());
  } finally {
    database.close();
  }
}

/** { saved, trainingSessions, ... } each a non-negative integer or null. */
export async function countLocalData({ indexedDB = globalThis.indexedDB } = {}) {
  const result = Object.fromEntries(LOCAL_DATA_COUNT_SOURCES.map(([id]) => [id, null]));
  if (!indexedDB || typeof indexedDB.open !== 'function' || typeof indexedDB.databases !== 'function') {
    return Object.freeze(result);
  }
  let existing;
  try {
    existing = new Set((await indexedDB.databases()).map((entry) => entry.name));
  } catch {
    return Object.freeze(result);
  }
  await Promise.all(LOCAL_DATA_COUNT_SOURCES.map(async ([id, databaseName, storeName]) => {
    if (!existing.has(databaseName)) {
      result[id] = 0;
      return;
    }
    try {
      const count = await countStore(indexedDB, databaseName, storeName);
      result[id] = Number.isSafeInteger(count) && count >= 0 ? count : null;
    } catch {
      result[id] = null;
    }
  }));
  return Object.freeze(result);
}
