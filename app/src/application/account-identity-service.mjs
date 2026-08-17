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

  async function ensureLocalIdentity() {
    const state = await durableRepository.initialize();
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
        status: identity.kind === RIVERLINE_IDENTITY_KINDS.LOCAL ? 'local_only' : 'authenticated_future',
        storage: 'on_this_device',
        syncEnabled: false,
      });
    },
    async setDisplayName(value) {
      return durableRepository.setDisplayName(normalizeRiverlineDisplayName(value));
    },
    activateIdentity: (identityId) => durableRepository.activateIdentity(identityId),
    async activateLocalIdentity() {
      const local = await ensureLocalIdentity();
      return durableRepository.activateIdentity(local.identityId);
    },
    close: () => durableRepository.close(),
  });
}
