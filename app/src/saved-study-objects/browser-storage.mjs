export function createSavedStudyBrowserStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('Saved Study browser storage is unavailable');
  }
  return Object.freeze({
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
  });
}

