import { validateAuthProviderIdentity } from './domain.mjs';

export function createFakeAuthProviderAdapter({
  identities = [],
  restoredIdentity = null,
  available = true,
  failures = {},
} = {}) {
  identities.forEach(validateAuthProviderIdentity);
  if (restoredIdentity) validateAuthProviderIdentity(restoredIdentity);
  const queue = [...identities];
  const calls = [];
  let current = restoredIdentity;

  function fail(name) {
    if (failures[name]) throw failures[name];
  }

  function nextIdentity() {
    const identity = queue.shift() ?? current;
    if (!identity) throw new Error('Fake auth provider has no queued identity');
    current = identity;
    return identity;
  }

  return Object.freeze({
    provider: 'fake',
    isAvailable: () => available,
    getCalls: () => calls.map((entry) => ({ ...entry })),
    queueIdentity(identity) { validateAuthProviderIdentity(identity); queue.push(identity); },
    async restoreSession() { calls.push({ method: 'restoreSession' }); fail('restoreSession'); return current; },
    async refreshSession() { calls.push({ method: 'refreshSession' }); fail('refreshSession'); return current; },
    async signInWithPassword() { calls.push({ method: 'signInWithPassword' }); fail('signInWithPassword'); return nextIdentity(); },
    async signUpWithPassword() { calls.push({ method: 'signUpWithPassword' }); fail('signUpWithPassword'); return nextIdentity(); },
    async signOut() { calls.push({ method: 'signOut' }); fail('signOut'); current = null; },
  });
}

