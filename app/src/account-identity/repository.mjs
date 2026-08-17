import {
  RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION,
  RIVERLINE_BINDING_PROVENANCE,
  RIVERLINE_IDENTITY_KINDS,
  RIVERLINE_OWNED_DOMAINS,
  RIVERLINE_STORAGE_SCOPES,
  createRiverlineAccountMigration,
  createRiverlineDomainOwnershipBinding,
  createRiverlineIdentity,
  domainOwnershipBindingId,
  rebindRiverlineDomainOwnershipBinding,
  transitionRiverlineIdentityKind,
  updateRiverlineIdentityDisplayName,
  validateRiverlineAccountMetadata,
  validateRiverlineDomainOwnershipBinding,
  validateRiverlineIdentity,
} from './domain.mjs';
import {
  RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
  RIVERLINE_ACCOUNT_DATABASE_NAME,
  RIVERLINE_ACCOUNT_DATABASE_VERSION,
  RIVERLINE_ACCOUNT_OBJECT_STORES,
  createIndexedDbAccountIdentityDatabase,
} from './indexeddb-storage.mjs';
import {
  createProviderIdentityMapping,
  providerIdentityMappingId,
  refreshProviderIdentityMapping,
  validateAuthProviderIdentity,
  validateProviderIdentityMapping,
} from '../authentication/domain.mjs';

const STORES = RIVERLINE_ACCOUNT_OBJECT_STORES;
const ALL_STORES = Object.freeze(Object.values(STORES));
const METADATA_KEY = 'state';
const OWNED_DOMAINS = Object.freeze(Object.values(RIVERLINE_OWNED_DOMAINS));

function cloneData(value) {
  if (Array.isArray(value)) return value.map(cloneData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function timestampFrom(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Account identity clock returned an invalid date');
  return date.toISOString();
}

function timestampNotBefore(clock, prior) {
  const candidate = timestampFrom(clock);
  return Date.parse(candidate) < Date.parse(prior) ? prior : candidate;
}

function defaultIdFactory(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  const random = Math.random().toString(36).slice(2, 14);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function validLegacyOwner(value) {
  return typeof value === 'string' && Boolean(value.trim()) ? value : null;
}

function normalizedLegacyOwners(legacyOwners = {}) {
  return Object.fromEntries(OWNED_DOMAINS.map((domain) => [domain, validLegacyOwner(legacyOwners[domain])]));
}

function createMetadata({ identity, createdAt, adoptedDomains }) {
  return {
    schemaVersion: RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION,
    key: METADATA_KEY,
    backendSchemaVersion: RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
    databaseVersion: RIVERLINE_ACCOUNT_DATABASE_VERSION,
    activeIdentityId: identity.identityId,
    localDeviceIdentityId: identity.localDeviceIdentityId,
    revision: 0,
    createdAt,
    updatedAt: createdAt,
    migration: cloneData(createRiverlineAccountMigration({ completedAt: createdAt, adoptedDomains })),
  };
}

function validateRegistry(metadata, identities, bindings, mappings = []) {
  validateRiverlineAccountMetadata(metadata);
  if (metadata.backendSchemaVersion !== RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION
    || metadata.databaseVersion !== RIVERLINE_ACCOUNT_DATABASE_VERSION) {
    throw storageFailure(
      'unsupported_database_version',
      'Local profile storage uses a newer unsupported version and was left untouched.',
    );
  }
  identities.forEach(validateRiverlineIdentity);
  bindings.forEach(validateRiverlineDomainOwnershipBinding);
  mappings.forEach(validateProviderIdentityMapping);
  const identityById = new Map(identities.map((identity) => [identity.identityId, identity]));
  const active = identityById.get(metadata.activeIdentityId);
  if (!active) throw new TypeError('Active Riverline identity is missing');
  if (active.localDeviceIdentityId !== metadata.localDeviceIdentityId) {
    throw new TypeError('Active Riverline identity belongs to a different local device identity');
  }
  const bindingIds = new Set();
  const storageTargets = new Set();
  const domainOwnerTargets = new Set();
  for (const binding of bindings) {
    const identity = identityById.get(binding.identityId);
    if (!identity) throw new TypeError('Domain ownership binding references an unknown identity');
    if (binding.ownershipRef.ownerId !== identity.identityId) {
      throw new TypeError('Domain ownership binding has inconsistent ownership');
    }
    if (bindingIds.has(binding.bindingId)) throw new TypeError('Duplicate domain ownership binding');
    bindingIds.add(binding.bindingId);
    const storageTarget = `${binding.domain}:${binding.storageScope}`;
    const ownerTarget = `${binding.domain}:${binding.domainOwnerId}`;
    if (storageTargets.has(storageTarget) || domainOwnerTargets.has(ownerTarget)) {
      throw new TypeError('Domain ownership targets cannot be shared silently across identities');
    }
    storageTargets.add(storageTarget);
    domainOwnerTargets.add(ownerTarget);
  }
  for (const identity of identities) {
    for (const domain of OWNED_DOMAINS) {
      if (!bindingIds.has(domainOwnershipBindingId(identity.identityId, domain))) {
        throw new TypeError(`Riverline identity is missing its ${domain} ownership binding`);
      }
    }
  }
  const mappingIds = new Set();
  for (const mapping of mappings) {
    if (mappingIds.has(mapping.mappingId)) throw new TypeError('Duplicate provider identity mapping');
    mappingIds.add(mapping.mappingId);
    const identity = identityById.get(mapping.riverlineIdentityId);
    if (!identity) throw new TypeError('Provider identity mapping references an unknown Riverline identity');
    if (identity.kind !== RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE) {
      throw new TypeError('Provider identity mapping must reference an authenticated Riverline identity');
    }
  }
  return { active, identityById };
}

function snapshot(metadata, identities, bindings, mappings = []) {
  const { active } = validateRegistry(metadata, identities, bindings, mappings);
  return deepFreeze({
    metadata: cloneData(metadata),
    identities: cloneData(identities),
    bindings: cloneData(bindings),
    providerIdentityMappings: cloneData(mappings),
    activeIdentity: cloneData(active),
  });
}

export class AccountIdentityStorageError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AccountIdentityStorageError';
    this.code = code;
  }
}

function storageFailure(code, message, cause = null) {
  return new AccountIdentityStorageError(code, message, cause);
}

export function createAccountIdentityRepository({
  database = null,
  legacyOwners = {},
  clock = () => new Date(),
  idFactory = defaultIdFactory,
  defaultDisplayName = 'Local Player',
} = {}) {
  if (typeof clock !== 'function' || typeof idFactory !== 'function') {
    throw new TypeError('Account identity clock and idFactory must be functions');
  }
  const adoptedLegacyOwners = normalizedLegacyOwners(legacyOwners);
  let durableDatabase = database;
  let initializationPromise = null;

  function getDatabase() {
    if (!durableDatabase) durableDatabase = createIndexedDbAccountIdentityDatabase();
    if (typeof durableDatabase.runTransaction !== 'function') {
      throw new TypeError('Account identity repository requires a transactional database adapter');
    }
    return durableDatabase;
  }

  async function readRawSnapshot(transaction) {
    const [metadata, identities, bindings, mappings] = await Promise.all([
      transaction.get(STORES.METADATA, METADATA_KEY),
      transaction.getAll(STORES.IDENTITIES),
      transaction.getAll(STORES.DOMAIN_BINDINGS),
      transaction.getAll(STORES.PROVIDER_MAPPINGS),
    ]);
    if (!metadata) return null;
    return snapshot(metadata, identities, bindings, mappings);
  }

  async function initialize() {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      let existing;
      try {
        existing = await getDatabase().runTransaction(ALL_STORES, 'readonly', readRawSnapshot);
      } catch (error) {
        if (error instanceof AccountIdentityStorageError) throw error;
        throw storageFailure(
          error?.name === 'VersionError' ? 'unsupported_database_version' : 'open_failed',
          'Local profile storage could not be opened.',
          error,
        );
      }
      if (existing) return existing;

      const createdAt = timestampFrom(clock);
      const localDeviceIdentityId = idFactory('local-device');
      const identity = createRiverlineIdentity({
        identityId: idFactory('identity'),
        kind: RIVERLINE_IDENTITY_KINDS.LOCAL,
        displayName: defaultDisplayName,
        localDeviceIdentityId,
        createdAt,
      });
      const adoptedDomains = OWNED_DOMAINS.filter((domain) => adoptedLegacyOwners[domain] !== null);
      const bindings = OWNED_DOMAINS.map((domain) => createRiverlineDomainOwnershipBinding({
        identity,
        domain,
        domainOwnerId: adoptedLegacyOwners[domain] ?? identity.identityId,
        storageScope: RIVERLINE_STORAGE_SCOPES.LEGACY_DEFAULT,
        provenance: adoptedLegacyOwners[domain]
          ? RIVERLINE_BINDING_PROVENANCE.LEGACY_ADOPTED
          : RIVERLINE_BINDING_PROVENANCE.IDENTITY_INITIALIZED,
        createdAt,
      }));
      const metadata = createMetadata({ identity, createdAt, adoptedDomains });

      try {
        return await getDatabase().runTransaction(ALL_STORES, 'readwrite', async (transaction) => {
          const raced = await readRawSnapshot(transaction);
          if (raced) return raced;
          const counts = await Promise.all(ALL_STORES.map((store) => transaction.count(store)));
          if (counts.some((count) => count !== 0)) {
            throw storageFailure(
              'incomplete_registry',
              'Local profile storage contains an incomplete registry and was left untouched.',
            );
          }
          await transaction.add(STORES.IDENTITIES, identity);
          for (const binding of bindings) await transaction.add(STORES.DOMAIN_BINDINGS, binding);
          await transaction.add(STORES.METADATA, metadata);
          return snapshot(metadata, [identity], bindings, []);
        });
      } catch (error) {
        if (error instanceof AccountIdentityStorageError) throw error;
        throw storageFailure(
          'migration_failed',
          'Local profile initialization did not complete; existing study data remains untouched.',
          error,
        );
      }
    })();
    try {
      return await initializationPromise;
    } catch (error) {
      initializationPromise = null;
      throw error;
    }
  }

  async function read(operation) {
    await initialize();
    try {
      return await getDatabase().runTransaction(ALL_STORES, 'readonly', operation);
    } catch (error) {
      if (error instanceof AccountIdentityStorageError || error instanceof TypeError || error instanceof RangeError) throw error;
      throw storageFailure('read_failed', 'Local profile data could not be read.', error);
    }
  }

  async function write(operation) {
    await initialize();
    try {
      return await getDatabase().runTransaction(ALL_STORES, 'readwrite', operation);
    } catch (error) {
      if (error instanceof AccountIdentityStorageError || error instanceof TypeError || error instanceof RangeError) throw error;
      throw storageFailure('transaction_failed', 'Local profile changes could not be saved.', error);
    }
  }

  async function currentMetadata(transaction) {
    const metadata = await transaction.get(STORES.METADATA, METADATA_KEY);
    validateRiverlineAccountMetadata(metadata);
    return metadata;
  }

  async function commitMetadata(transaction, metadata, changes = {}) {
    const next = {
      ...cloneData(metadata),
      ...cloneData(changes),
      revision: metadata.revision + 1,
      updatedAt: timestampNotBefore(clock, metadata.updatedAt),
    };
    validateRiverlineAccountMetadata(next);
    await transaction.put(STORES.METADATA, next);
    return next;
  }

  function createAdditionalIdentity({
    kind,
    displayName,
    localDeviceIdentityId,
    createdAt,
    identityId = idFactory('identity'),
  }) {
    const identity = createRiverlineIdentity({
      identityId,
      kind,
      displayName,
      localDeviceIdentityId,
      createdAt,
    });
    const storageScope = idFactory('scope');
    const bindings = OWNED_DOMAINS.map((domain) => createRiverlineDomainOwnershipBinding({
      identity,
      domain,
      domainOwnerId: identity.identityId,
      storageScope,
      provenance: RIVERLINE_BINDING_PROVENANCE.IDENTITY_INITIALIZED,
      createdAt,
    }));
    return { identity, bindings };
  }

  async function assertFreshIdentityTargets(transaction, identity, bindings) {
    if (await transaction.get(STORES.IDENTITIES, identity.identityId)) {
      throw new RangeError(`Riverline identity already exists: ${identity.identityId}`);
    }
    const existingBindings = await transaction.getAll(STORES.DOMAIN_BINDINGS);
    for (const binding of bindings) {
      if (existingBindings.some((entry) => entry.domain === binding.domain
        && (entry.storageScope === binding.storageScope
          || entry.domainOwnerId === binding.domainOwnerId))) {
        throw new RangeError(`The ${binding.domain} ownership target is already assigned`);
      }
    }
  }

  async function addIdentityWithBindings(transaction, identity, bindings) {
    await assertFreshIdentityTargets(transaction, identity, bindings);
    await transaction.add(STORES.IDENTITIES, identity);
    for (const binding of bindings) await transaction.add(STORES.DOMAIN_BINDINGS, binding);
  }

  async function mappingForProviderIdentity(transaction, providerIdentity) {
    validateAuthProviderIdentity(providerIdentity);
    const mapping = await transaction.get(
      STORES.PROVIDER_MAPPINGS,
      providerIdentityMappingId(providerIdentity),
    );
    if (mapping) validateProviderIdentityMapping(mapping);
    return mapping ?? null;
  }

  const repository = {
    backendSchemaVersion: RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
    databaseName: database?.name ?? RIVERLINE_ACCOUNT_DATABASE_NAME,
    databaseVersion: RIVERLINE_ACCOUNT_DATABASE_VERSION,
    initialize,

    async getSnapshot() {
      return read(async (transaction) => {
        const value = await readRawSnapshot(transaction);
        if (!value) throw storageFailure('missing_registry', 'Local profile registry is missing.');
        return value;
      });
    },

    async getActiveIdentity() {
      const value = await repository.getSnapshot();
      return value.activeIdentity;
    },

    async getDomainOwnership(domain, identityId = null) {
      if (!OWNED_DOMAINS.includes(domain)) throw new RangeError(`Unsupported owned domain: ${domain}`);
      return read(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        const resolvedIdentityId = identityId ?? metadata.activeIdentityId;
        const binding = await transaction.get(
          STORES.DOMAIN_BINDINGS,
          domainOwnershipBindingId(resolvedIdentityId, domain),
        );
        if (!binding) throw new RangeError(`Identity has no ${domain} ownership binding`);
        validateRiverlineDomainOwnershipBinding(binding);
        return deepFreeze(cloneData(binding));
      });
    },

    async listKnownIdentities() {
      const value = await repository.getSnapshot();
      return value.identities;
    },

    reserveIdentityId() {
      return idFactory('identity');
    },

    async getProviderIdentityMapping(providerIdentity) {
      validateAuthProviderIdentity(providerIdentity);
      return read(async (transaction) => {
        const mapping = await mappingForProviderIdentity(transaction, providerIdentity);
        return mapping ? deepFreeze(cloneData(mapping)) : null;
      });
    },

    async activateProviderIdentity(providerIdentity) {
      validateAuthProviderIdentity(providerIdentity);
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        const mapping = await mappingForProviderIdentity(transaction, providerIdentity);
        if (!mapping) return null;
        const identity = await transaction.get(STORES.IDENTITIES, mapping.riverlineIdentityId);
        validateRiverlineIdentity(identity);
        const refreshed = refreshProviderIdentityMapping(mapping, providerIdentity.authenticatedAt);
        await transaction.put(STORES.PROVIDER_MAPPINGS, refreshed);
        if (metadata.activeIdentityId !== identity.identityId) {
          await commitMetadata(transaction, metadata, { activeIdentityId: identity.identityId });
        }
        return deepFreeze({
          identity: cloneData(identity),
          mapping: cloneData(refreshed),
          created: false,
        });
      });
    },

    async linkProviderIdentityToLocal(providerIdentity, { localIdentityId = null } = {}) {
      validateAuthProviderIdentity(providerIdentity);
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        const existingMapping = await mappingForProviderIdentity(transaction, providerIdentity);
        if (existingMapping) {
          throw storageFailure(
            'provider_identity_already_linked',
            'This provider identity is already linked to a Riverline account.',
          );
        }
        const resolvedLocalIdentityId = localIdentityId ?? metadata.activeIdentityId;
        if (metadata.activeIdentityId !== resolvedLocalIdentityId) {
          throw storageFailure('link_target_changed', 'The active Riverline profile changed before linking completed.');
        }
        const localIdentity = await transaction.get(STORES.IDENTITIES, resolvedLocalIdentityId);
        validateRiverlineIdentity(localIdentity);
        if (localIdentity.kind !== RIVERLINE_IDENTITY_KINDS.LOCAL) {
          throw new RangeError('Only the active Local Profile can be linked');
        }

        const changedAt = timestampNotBefore(clock, localIdentity.updatedAt);
        const authenticatedIdentity = transitionRiverlineIdentityKind(
          localIdentity,
          RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE,
          changedAt,
        );
        const reboundBindings = [];
        for (const domain of OWNED_DOMAINS) {
          const binding = await transaction.get(
            STORES.DOMAIN_BINDINGS,
            domainOwnershipBindingId(localIdentity.identityId, domain),
          );
          validateRiverlineDomainOwnershipBinding(binding);
          reboundBindings.push(rebindRiverlineDomainOwnershipBinding(binding, authenticatedIdentity, changedAt));
        }
        const replacement = createAdditionalIdentity({
          kind: RIVERLINE_IDENTITY_KINDS.LOCAL,
          displayName: defaultDisplayName,
          localDeviceIdentityId: metadata.localDeviceIdentityId,
          createdAt: changedAt,
        });
        await assertFreshIdentityTargets(transaction, replacement.identity, replacement.bindings);

        const mapping = createProviderIdentityMapping({
          providerIdentity,
          riverlineIdentityId: authenticatedIdentity.identityId,
          createdAt: changedAt,
          updatedAt: changedAt,
          lastAuthenticatedAt: changedAt,
        });
        await transaction.put(STORES.IDENTITIES, authenticatedIdentity);
        for (const binding of reboundBindings) await transaction.put(STORES.DOMAIN_BINDINGS, binding);
        await transaction.add(STORES.IDENTITIES, replacement.identity);
        for (const binding of replacement.bindings) await transaction.add(STORES.DOMAIN_BINDINGS, binding);
        await transaction.add(STORES.PROVIDER_MAPPINGS, mapping);
        await commitMetadata(transaction, metadata, { activeIdentityId: authenticatedIdentity.identityId });
        const state = await readRawSnapshot(transaction);
        return deepFreeze({
          identity: cloneData(authenticatedIdentity),
          localIdentity: cloneData(replacement.identity),
          mapping: cloneData(mapping),
          state,
          created: true,
        });
      });
    },

    async startProviderIdentitySeparately(providerIdentity, {
      displayName = 'Riverline Account',
      riverlineIdentityId = null,
    } = {}) {
      validateAuthProviderIdentity(providerIdentity);
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        const existingMapping = await mappingForProviderIdentity(transaction, providerIdentity);
        if (existingMapping) {
          const identity = await transaction.get(STORES.IDENTITIES, existingMapping.riverlineIdentityId);
          validateRiverlineIdentity(identity);
          const refreshed = refreshProviderIdentityMapping(existingMapping, providerIdentity.authenticatedAt);
          await transaction.put(STORES.PROVIDER_MAPPINGS, refreshed);
          if (metadata.activeIdentityId !== identity.identityId) {
            await commitMetadata(transaction, metadata, { activeIdentityId: identity.identityId });
          }
          return deepFreeze({ identity: cloneData(identity), mapping: cloneData(refreshed), created: false });
        }

        const createdAt = timestampFrom(clock);
        const account = createAdditionalIdentity({
          kind: RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE,
          displayName,
          localDeviceIdentityId: metadata.localDeviceIdentityId,
          createdAt,
          ...(riverlineIdentityId ? { identityId: riverlineIdentityId } : {}),
        });
        await addIdentityWithBindings(transaction, account.identity, account.bindings);
        const mapping = createProviderIdentityMapping({
          providerIdentity,
          riverlineIdentityId: account.identity.identityId,
          createdAt,
          updatedAt: createdAt,
          lastAuthenticatedAt: createdAt,
        });
        await transaction.add(STORES.PROVIDER_MAPPINGS, mapping);
        await commitMetadata(transaction, metadata, { activeIdentityId: account.identity.identityId });
        const state = await readRawSnapshot(transaction);
        return deepFreeze({
          identity: cloneData(account.identity),
          mapping: cloneData(mapping),
          state,
          created: true,
        });
      });
    },

    async setDisplayName(displayName) {
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        const identity = await transaction.get(STORES.IDENTITIES, metadata.activeIdentityId);
        validateRiverlineIdentity(identity);
        const updated = updateRiverlineIdentityDisplayName(
          identity,
          displayName,
          timestampNotBefore(clock, identity.updatedAt),
        );
        await transaction.put(STORES.IDENTITIES, updated);
        await commitMetadata(transaction, metadata);
        return deepFreeze(cloneData(updated));
      });
    },

    async activateIdentity(identityId) {
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        const identity = await transaction.get(STORES.IDENTITIES, identityId);
        if (!identity) throw new RangeError(`Unknown Riverline identity: ${identityId}`);
        validateRiverlineIdentity(identity);
        if (identity.localDeviceIdentityId !== metadata.localDeviceIdentityId) {
          throw new RangeError('Riverline identity does not belong to this local device registry');
        }
        for (const domain of OWNED_DOMAINS) {
          const binding = await transaction.get(
            STORES.DOMAIN_BINDINGS,
            domainOwnershipBindingId(identityId, domain),
          );
          if (!binding) throw new RangeError(`Identity has no ${domain} ownership binding`);
          validateRiverlineDomainOwnershipBinding(binding);
        }
        if (metadata.activeIdentityId !== identityId) {
          await commitMetadata(transaction, metadata, { activeIdentityId: identityId });
        }
        return deepFreeze(cloneData(identity));
      });
    },

    async registerIdentity({ identity, bindings } = {}) {
      validateRiverlineIdentity(identity);
      if (!Array.isArray(bindings) || bindings.length !== OWNED_DOMAINS.length) {
        throw new TypeError('A registered identity requires one binding for every owned domain');
      }
      bindings.forEach(validateRiverlineDomainOwnershipBinding);
      for (const domain of OWNED_DOMAINS) {
        const binding = bindings.find((entry) => entry.domain === domain);
        if (!binding || binding.identityId !== identity.identityId) {
          throw new RangeError(`Registered identity has an invalid ${domain} binding`);
        }
      }
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        if (identity.localDeviceIdentityId !== metadata.localDeviceIdentityId) {
          throw new RangeError('Registered identity must use this registry localDeviceIdentityId');
        }
        await addIdentityWithBindings(transaction, identity, bindings);
        await commitMetadata(transaction, metadata);
        return deepFreeze(cloneData(identity));
      });
    },

    async close() {
      if (durableDatabase?.close) await durableDatabase.close();
      initializationPromise = null;
    },
  };

  return Object.freeze(repository);
}
