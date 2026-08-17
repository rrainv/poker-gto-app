import {
  LEGACY_PERSONAL_STRATEGY_OWNER_KEY,
  LEGACY_SAVED_STUDY_OWNER_KEY,
  RIVERLINE_IDENTITY_KINDS,
  RIVERLINE_OWNED_DOMAINS,
  createAccountIdentityBrowserStorage,
  createAccountIdentityRepository,
  normalizeRiverlineDisplayName,
  riverlineOwnershipRefForIdentity,
} from '../account-identity/index.mjs';

export const ACCOUNT_PROFILE_SUMMARY_SCHEMA_VERSION = 'riverline-account-profile-summary/v1';

function legacyOwnersFromStorage(storage) {
  return {
    [RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS]: storage.getItem(LEGACY_SAVED_STUDY_OWNER_KEY),
    [RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY]: storage.getItem(LEGACY_PERSONAL_STRATEGY_OWNER_KEY),
  };
}

export function createAccountIdentityService({
  storage = null,
  database = null,
  repository = null,
  clock = () => new Date(),
  idFactory,
  defaultDisplayName = 'Local Player',
} = {}) {
  const ownerStorage = storage ?? (repository ? null : createAccountIdentityBrowserStorage());
  const durableRepository = repository ?? createAccountIdentityRepository({
    database,
    legacyOwners: legacyOwnersFromStorage(ownerStorage),
    clock,
    ...(idFactory ? { idFactory } : {}),
    defaultDisplayName,
  });
  const listeners = new Set();

  async function notifyAfter(operation, reason) {
    const result = await operation;
    if (result === null) return result;
    const identity = await durableRepository.getActiveIdentity();
    for (const listener of listeners) listener(Object.freeze({ reason, identity }));
    return result;
  }

  async function ensureLocalIdentity() {
    await durableRepository.initialize();
    const state = await durableRepository.getSnapshot();
    const local = state.identities.find((identity) => identity.kind === RIVERLINE_IDENTITY_KINDS.LOCAL);
    if (!local) throw new RangeError('Riverline local identity is missing');
    return local;
  }

  async function getActiveIdentity() {
    await durableRepository.initialize();
    return durableRepository.getActiveIdentity();
  }

  return Object.freeze({
    repository: durableRepository,
    initialize: () => durableRepository.initialize(),
    ensureLocalIdentity,
    getActiveIdentity,
    async getActiveIdentityId() {
      return (await getActiveIdentity()).identityId;
    },
    getDomainOwnership: (domain) => durableRepository.getDomainOwnership(domain),
    async getProfileSummary() {
      const identity = await getActiveIdentity();
      return Object.freeze({
        schemaVersion: ACCOUNT_PROFILE_SUMMARY_SCHEMA_VERSION,
        identityId: identity.identityId,
        kind: identity.kind,
        displayName: identity.displayName,
        ownershipRef: riverlineOwnershipRefForIdentity(identity),
        status: identity.kind === RIVERLINE_IDENTITY_KINDS.LOCAL ? 'local_only' : 'signed_in',
        storage: 'on_this_device',
        syncEnabled: false,
      });
    },
    async setDisplayName(value) {
      return notifyAfter(
        durableRepository.setDisplayName(normalizeRiverlineDisplayName(value)),
        'display_name_changed',
      );
    },
    listKnownIdentities: () => durableRepository.listKnownIdentities(),
    reserveIdentityId: () => durableRepository.reserveIdentityId(),
    getProviderIdentityMapping: (providerIdentity) => (
      durableRepository.getProviderIdentityMapping(providerIdentity)
    ),
    activateProviderIdentity: (providerIdentity) => notifyAfter(
      durableRepository.activateProviderIdentity(providerIdentity),
      'provider_session_activated',
    ),
    linkProviderIdentityToLocal: (providerIdentity, options) => notifyAfter(
      durableRepository.linkProviderIdentityToLocal(providerIdentity, options),
      'local_profile_linked',
    ),
    startProviderIdentitySeparately: (providerIdentity, options) => notifyAfter(
      durableRepository.startProviderIdentitySeparately(providerIdentity, options),
      'authenticated_profile_started',
    ),
    activateIdentity: (identityId) => notifyAfter(
      durableRepository.activateIdentity(identityId),
      'identity_activated',
    ),
    async activateLocalIdentity() {
      const local = await ensureLocalIdentity();
      return notifyAfter(
        durableRepository.activateIdentity(local.identityId),
        'local_profile_activated',
      );
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Account identity listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => durableRepository.close(),
  });
}
