export function createAccountIdentityBrowserStorage(storage = globalThis.localStorage) {
  if (!storage || typeof storage.getItem !== 'function') {
    throw new TypeError('Account identity browser storage is unavailable');
  }
  return Object.freeze({
    getItem: (key) => storage.getItem(key),
  });
}

