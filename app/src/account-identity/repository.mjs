import { LIFECYCLE_TRANSITION_SCHEMA_VERSION, transitionIsActive, validateLifecycleTransition } from './lifecycle-transition.mjs';
import {
  LEGACY_RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION,
  LEGACY_RIVERLINE_ACCOUNT_MIGRATION_SCHEMA_VERSION,
  LEGACY_RIVERLINE_IDENTITY_KINDS,
  LEGACY_RIVERLINE_IDENTITY_SCHEMA_VERSION,
  RIVERLINE_BINDING_PROVENANCE,
  RIVERLINE_IDENTITY_KINDS,
  RIVERLINE_OWNED_DOMAINS,
  RIVERLINE_OWNER_TYPES,
  RIVERLINE_STORAGE_SCOPES,
  createRiverlineAccountMigration,
  createRiverlineAccountMetadata,
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
const PRE_TRAINING_DOMAINS = Object.freeze(['saved_study_objects', 'personal_strategy']);
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
  return createRiverlineAccountMetadata({
    backendSchemaVersion: RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
    databaseVersion: RIVERLINE_ACCOUNT_DATABASE_VERSION,
    activeIdentityId: identity.identityId,
    deviceGuestIdentityId: identity.identityId,
    localDeviceIdentityId: identity.localDeviceIdentityId,
    revision: 0,
    lifecycleGeneration: 0,
    pendingTransitionId: null,
    createdAt,
    migration: createRiverlineAccountMigration({
      completedAt: createdAt,
      adoptedDomains,
      adoptedDeviceGuestIdentityId: identity.identityId,
    }),
  });
}

function expectedOwnerType(kind) {
  return kind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST
    ? RIVERLINE_OWNER_TYPES.LOCAL_IDENTITY
    : RIVERLINE_OWNER_TYPES.ACCOUNT_IDENTITY;
}

function validateRegistry(metadata, identities, bindings, mappings = [], transitions = [], prior = false) {
  validateRiverlineAccountMetadata(metadata);
  if (metadata.backendSchemaVersion !== (prior ? 'riverline-account-indexeddb/v3' : RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION)
    || metadata.databaseVersion !== (prior ? 3 : RIVERLINE_ACCOUNT_DATABASE_VERSION)) {
    throw storageFailure(
      'unsupported_database_version',
      'Local profile storage uses a newer unsupported version and was left untouched.',
    );
  }
  identities.forEach(validateRiverlineIdentity);
  bindings.forEach(validateRiverlineDomainOwnershipBinding);
  mappings.forEach(validateProviderIdentityMapping);
  const identityById = new Map(identities.map((identity) => [identity.identityId, identity]));
  if (identityById.size !== identities.length) throw new TypeError('Duplicate Riverline identity');
  const active = identityById.get(metadata.activeIdentityId);
  if (!active) throw new TypeError('Active Riverline identity is missing');
  if (active.localDeviceIdentityId !== metadata.localDeviceIdentityId) {
    throw new TypeError('Active Riverline identity belongs to a different local device identity');
  }
  const deviceGuests = identities.filter((identity) => (
    identity.kind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST
  ));
  if (deviceGuests.length !== 1 || deviceGuests[0].identityId !== metadata.deviceGuestIdentityId) {
    throw new TypeError('Registry must contain exactly one designated Device Guest');
  }
  if (deviceGuests[0].localDeviceIdentityId !== metadata.localDeviceIdentityId) {
    throw new TypeError('Device Guest belongs to a different local device identity');
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
    if (binding.ownershipRef.ownerType !== expectedOwnerType(identity.kind)) {
      throw new TypeError('Domain ownership binding owner type conflicts with its identity kind');
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
    for (const domain of (prior ? PRE_TRAINING_DOMAINS : OWNED_DOMAINS)) {
      if (!bindingIds.has(domainOwnershipBindingId(identity.identityId, domain))) {
        throw new TypeError(`Riverline identity is missing its ${domain} ownership binding`);
      }
    }
  }
  const mappingIds = new Set();
  const mappedAccountIds = new Set();
  for (const mapping of mappings) {
    if (mappingIds.has(mapping.mappingId)) throw new TypeError('Duplicate provider identity mapping');
    mappingIds.add(mapping.mappingId);
    const identity = identityById.get(mapping.riverlineIdentityId);
    if (!identity) throw new TypeError('Provider identity mapping references an unknown Riverline identity');
    if (identity.kind !== RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT) {
      throw new TypeError('Provider identity mapping must reference an authenticated Riverline identity');
    }
    if (mappedAccountIds.has(identity.identityId)) {
      throw new TypeError('Authenticated Riverline identity has multiple provider mappings');
    }
    mappedAccountIds.add(identity.identityId);
  }
  if (mappings.some((mapping) => mapping.riverlineIdentityId === metadata.deviceGuestIdentityId)) {
    throw new TypeError('Device Guest cannot have an authentication-provider mapping');
  }
  transitions.forEach(validateLifecycleTransition);
  const pending = transitions.filter(transitionIsActive);
  if (new Set(transitions.map((entry) => entry.transitionId)).size !== transitions.length
    || pending.length > 1 || (pending[0]?.transitionId ?? null) !== metadata.pendingTransitionId) {
    throw new TypeError('Conflicting lifecycle transitions');
  }
  if (pending.length) {
    const entry = pending[0];
    if (entry.generation !== metadata.lifecycleGeneration
      || metadata.activeIdentityId !== metadata.deviceGuestIdentityId
      || JSON.stringify(entry.guest) !== JSON.stringify(deviceGuests[0])
      || entry.guestBindings.some((before) => JSON.stringify(before) !== JSON.stringify(
        bindings.find((binding) => binding.bindingId === before.bindingId)))
      || mappings.some((mapping) => mapping.mappingId === entry.mapping.mappingId)) {
      throw new TypeError('Lifecycle reservation no longer matches the registry');
    }
    const retainedIdentities = identities.filter((identity) => entry.choice !== 'move' || identity.identityId !== entry.guest.identityId);
    const retainedBindings = bindings.filter((binding) => entry.choice !== 'move' || binding.identityId !== entry.guest.identityId);
    validateRegistry({ ...metadata, pendingTransitionId: null,
      activeIdentityId: entry.account.identity.identityId,
      deviceGuestIdentityId: entry.replacement?.identity.identityId ?? entry.guest.identityId },
    [...retainedIdentities, entry.account.identity, ...(entry.replacement ? [entry.replacement.identity] : [])],
    [...retainedBindings, ...entry.account.bindings, ...(entry.replacement?.bindings ?? [])],
    [...mappings, entry.mapping]);
  }
  return { active, identityById };
}

function snapshot(metadata, identities, bindings, mappings = [], transitions = []) {
  const { active } = validateRegistry(metadata, identities, bindings, mappings, transitions);
  return deepFreeze({
    status: 'ready',
    metadata: cloneData(metadata),
    identities: cloneData(identities),
    bindings: cloneData(bindings),
    lifecycleTransitions: cloneData(transitions),
    providerIdentityMappings: cloneData(mappings),
    activeIdentity: cloneData(active),
  });
}

function recoverySnapshot(code, message, raw) {
  return deepFreeze({
    status: 'recovery_required',
    metadata: null,
    identities: [],
    bindings: [],
    providerIdentityMappings: [],
    activeIdentity: null,
    recovery: {
      code,
      message,
      preservedRecordCounts: {
        metadata: raw.metadata ? 1 : 0,
        identities: raw.identities.length,
        bindings: raw.bindings.length,
        providerIdentityMappings: raw.mappings.length,
        lifecycleTransitions: raw.transitions.length,
      },
    },
  });
}

function requireLegacyKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} contains unsupported or missing fields`);
  }
}

function validateLegacyMigration(migration) {
  requireLegacyKeys(migration, [
    'schemaVersion', 'version', 'status', 'completedAt', 'adoptedDomains',
  ], 'Legacy Riverline account migration');
  if (migration.schemaVersion !== LEGACY_RIVERLINE_ACCOUNT_MIGRATION_SCHEMA_VERSION
    || migration.version !== 1 || migration.status !== 'complete'
    || !Number.isFinite(Date.parse(migration.completedAt))) {
    throw new TypeError('Legacy Riverline account migration is incompatible');
  }
  if (!Array.isArray(migration.adoptedDomains)
    || migration.adoptedDomains.some((domain) => !OWNED_DOMAINS.includes(domain))
    || new Set(migration.adoptedDomains).size !== migration.adoptedDomains.length) {
    throw new TypeError('Legacy Riverline adopted domains are invalid');
  }
}

function validateLegacyMetadata(metadata) {
  requireLegacyKeys(metadata, [
    'schemaVersion', 'key', 'backendSchemaVersion', 'databaseVersion',
    'activeIdentityId', 'localDeviceIdentityId', 'revision',
    'createdAt', 'updatedAt', 'migration',
  ], 'Legacy Riverline account metadata');
  if (metadata.schemaVersion !== LEGACY_RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION
    || metadata.key !== METADATA_KEY
    || metadata.backendSchemaVersion !== 'riverline-account-indexeddb/v2'
    || metadata.databaseVersion !== 2
    || typeof metadata.activeIdentityId !== 'string' || !metadata.activeIdentityId.trim()
    || typeof metadata.localDeviceIdentityId !== 'string' || !metadata.localDeviceIdentityId.trim()
    || !Number.isSafeInteger(metadata.revision) || metadata.revision < 0
    || !Number.isFinite(Date.parse(metadata.createdAt))
    || !Number.isFinite(Date.parse(metadata.updatedAt))) {
    throw new TypeError('Legacy Riverline account metadata is invalid');
  }
  validateLegacyMigration(metadata.migration);
}

function migrateLegacyIdentity(identity) {
  requireLegacyKeys(identity, [
    'schemaVersion', 'identityId', 'kind', 'displayName', 'localDeviceIdentityId',
    'createdAt', 'updatedAt',
  ], 'Legacy Riverline identity');
  if (identity.schemaVersion !== LEGACY_RIVERLINE_IDENTITY_SCHEMA_VERSION) {
    throw new TypeError('Legacy Riverline identity schema is incompatible');
  }
  const kind = identity.kind === LEGACY_RIVERLINE_IDENTITY_KINDS.LOCAL
    ? RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST
    : identity.kind === LEGACY_RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE
      ? RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT
      : null;
  if (!kind) throw new TypeError('Legacy Riverline identity kind is invalid');
  return createRiverlineIdentity({
    identityId: identity.identityId,
    kind,
    displayName: identity.displayName,
    localDeviceIdentityId: identity.localDeviceIdentityId,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  });
}

function assessLegacyRegistry(raw, migratedAt) {
  validateLegacyMetadata(raw.metadata);
  if (raw.transitions.length !== 0) throw new TypeError('Unexpected lifecycle transition records');
  const migratedIdentities = raw.identities.map(migrateLegacyIdentity);
  const identityById = new Map(migratedIdentities.map((identity) => [identity.identityId, identity]));
  if (identityById.size !== migratedIdentities.length
    || !identityById.has(raw.metadata.activeIdentityId)) {
    throw new TypeError('Legacy identity registry is incomplete');
  }
  if (migratedIdentities.some((identity) => (
    identity.localDeviceIdentityId !== raw.metadata.localDeviceIdentityId
  ))) {
    throw new TypeError('Legacy identities span conflicting device registries');
  }

  raw.bindings.forEach(validateRiverlineDomainOwnershipBinding);
  raw.mappings.forEach(validateProviderIdentityMapping);
  const mappedIdentityIds = new Set();
  const mappingIds = new Set();
  for (const mapping of raw.mappings) {
    if (mappingIds.has(mapping.mappingId)) throw new TypeError('Duplicate provider identity mapping');
    mappingIds.add(mapping.mappingId);
    const identity = identityById.get(mapping.riverlineIdentityId);
    if (!identity || identity.kind !== RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT) {
      throw new TypeError('Legacy provider mapping has conflicting ownership');
    }
    if (mappedIdentityIds.has(identity.identityId)) {
      throw new TypeError('Legacy account has multiple provider mappings');
    }
    mappedIdentityIds.add(identity.identityId);
  }

  const guestCandidates = migratedIdentities.filter((identity) => (
    identity.kind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST
      && !mappedIdentityIds.has(identity.identityId)
  ));
  if (guestCandidates.length !== 1) {
    throw new TypeError('Legacy registry does not have exactly one unbound local identity');
  }
  const guest = guestCandidates[0];
  const bindingIds = new Set();
  const storageTargets = new Set();
  const domainOwnerTargets = new Set();
  for (const binding of raw.bindings) {
    const identity = identityById.get(binding.identityId);
    if (!identity || binding.ownershipRef.ownerType !== expectedOwnerType(identity.kind)) {
      throw new TypeError('Legacy domain binding has conflicting ownership');
    }
    if (bindingIds.has(binding.bindingId)) throw new TypeError('Duplicate legacy domain binding');
    bindingIds.add(binding.bindingId);
    const storageTarget = `${binding.domain}:${binding.storageScope}`;
    const ownerTarget = `${binding.domain}:${binding.domainOwnerId}`;
    if (storageTargets.has(storageTarget) || domainOwnerTargets.has(ownerTarget)) {
      throw new TypeError('Legacy ownership targets are shared across identities');
    }
    storageTargets.add(storageTarget);
    domainOwnerTargets.add(ownerTarget);
  }
  for (const identity of migratedIdentities) {
    for (const domain of PRE_TRAINING_DOMAINS) {
      if (!bindingIds.has(domainOwnershipBindingId(identity.identityId, domain))) {
        throw new TypeError(`Legacy identity is missing its ${domain} binding`);
      }
    }
  }

  const metadata = createRiverlineAccountMetadata({
    backendSchemaVersion: RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
    databaseVersion: RIVERLINE_ACCOUNT_DATABASE_VERSION,
    activeIdentityId: guest.identityId,
    deviceGuestIdentityId: guest.identityId,
    localDeviceIdentityId: raw.metadata.localDeviceIdentityId,
    revision: raw.metadata.revision + 1,
    lifecycleGeneration: raw.metadata.revision + 1,
    pendingTransitionId: null,
    createdAt: raw.metadata.createdAt,
    updatedAt: Date.parse(migratedAt) < Date.parse(raw.metadata.updatedAt)
      ? raw.metadata.updatedAt
      : migratedAt,
    migration: createRiverlineAccountMigration({
      completedAt: migratedAt,
      adoptedDomains: raw.metadata.migration.adoptedDomains,
      adoptedDeviceGuestIdentityId: guest.identityId,
    }),
  });
  return { metadata, identities: migratedIdentities, guest };
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

  async function readRawRecords(transaction) {
    const [metadata, identities, bindings, mappings, transitions] = await Promise.all([
      transaction.get(STORES.METADATA, METADATA_KEY),
      transaction.getAll(STORES.IDENTITIES),
      transaction.getAll(STORES.DOMAIN_BINDINGS),
      transaction.getAll(STORES.PROVIDER_MAPPINGS),
      transaction.getAll(STORES.LIFECYCLE_TRANSITIONS),
    ]);
    return { metadata: metadata ?? null, identities, bindings, mappings, transitions };
  }

  function healthySnapshot(raw) {
    return snapshot(raw.metadata, raw.identities, raw.bindings, raw.mappings, raw.transitions);
  }

  function inspectStoredRegistry(raw) {
    if (!raw.metadata) {
      const hasOrphans = raw.identities.length || raw.bindings.length
        || raw.mappings.length || raw.transitions.length;
      return hasOrphans
        ? recoverySnapshot(
          'incomplete_registry',
          'Local identity storage is incomplete and was left untouched.',
          raw,
        )
        : null;
    }
    if (raw.metadata.schemaVersion === LEGACY_RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION) {
      return 'legacy';
    }
    try {
      if (raw.metadata.databaseVersion === 3) {
        validateRegistry(raw.metadata, raw.identities, raw.bindings, raw.mappings, raw.transitions, true);
        if (raw.bindings.some((binding) => binding.domain === RIVERLINE_OWNED_DOMAINS.TRAINING_MEMORY)) {
          throw new TypeError('Unexpected pre-migration Training binding');
        }
        return 'training_binding_migration';
      }
      return healthySnapshot(raw);
    } catch (error) {
      return recoverySnapshot(
        'identity_registry_conflict',
        'Local identity ownership is ambiguous and was left untouched.',
        raw,
      );
    }
  }

  async function migrateLegacyRegistry() {
    return getDatabase().runTransaction(ALL_STORES, 'readwrite', async (transaction) => {
      const raw = await readRawRecords(transaction);
      const inspection = inspectStoredRegistry(raw);
      if (inspection !== 'legacy') return inspection;
      let migration;
      try {
        migration = assessLegacyRegistry(raw, timestampFrom(clock));
      } catch (error) {
        return recoverySnapshot(
          'ambiguous_legacy_identity',
          'Legacy local identity ownership is ambiguous and was left untouched.',
          raw,
        );
      }
      for (const identity of migration.identities) {
        await transaction.put(STORES.IDENTITIES, identity);
      }
      const bindings = await addTrainingBindings(transaction, migration.identities, raw.bindings);
      await transaction.put(STORES.METADATA, migration.metadata);
      return snapshot(
        migration.metadata,
        migration.identities,
        bindings,
        raw.mappings,
        raw.transitions,
      );
    });
  }

  async function addTrainingBindings(transaction, identities, bindings) {
    const added = identities.map((identity) => createRiverlineDomainOwnershipBinding({
      identity, domain: RIVERLINE_OWNED_DOMAINS.TRAINING_MEMORY,
      domainOwnerId: identity.identityId,
      storageScope: 'training-' + identity.identityId.replace(/[^A-Za-z0-9._-]/g, '_'),
      provenance: RIVERLINE_BINDING_PROVENANCE.IDENTITY_INITIALIZED,
      createdAt: timestampFrom(clock),
    }));
    for (const binding of added) await transaction.add(STORES.DOMAIN_BINDINGS, binding);
    return [...bindings, ...added];
  }

  async function migrateTrainingBindings() {
    return getDatabase().runTransaction(ALL_STORES, 'readwrite', async (transaction) => {
      const raw = await readRawRecords(transaction);
      const inspection = inspectStoredRegistry(raw);
      if (inspection !== 'training_binding_migration') return inspection;
      const bindings = await addTrainingBindings(transaction, raw.identities, raw.bindings);
      const metadata = { ...raw.metadata,
        backendSchemaVersion: RIVERLINE_ACCOUNT_BACKEND_SCHEMA_VERSION,
        databaseVersion: RIVERLINE_ACCOUNT_DATABASE_VERSION,
        revision: raw.metadata.revision + 1,
      };
      const result = snapshot(metadata, raw.identities, bindings, raw.mappings, raw.transitions);
      await transaction.put(STORES.METADATA, metadata);
      return result;
    });
  }

  async function initialize() {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      let raw;
      try {
        raw = await getDatabase().runTransaction(ALL_STORES, 'readonly', readRawRecords);
      } catch (error) {
        if (error instanceof AccountIdentityStorageError) throw error;
        throw storageFailure(
          error?.name === 'VersionError' ? 'unsupported_database_version' : 'open_failed',
          'Local profile storage could not be opened.',
          error,
        );
      }
      const existing = inspectStoredRegistry(raw);
      if (existing === 'training_binding_migration') return migrateTrainingBindings();
      if (existing === 'legacy') {
        try {
          return await migrateLegacyRegistry();
        } catch (error) {
          if (error instanceof AccountIdentityStorageError) throw error;
          throw storageFailure(
            'migration_failed',
            'Local identity migration did not complete; existing data remains untouched.',
            error,
          );
        }
      }
      if (existing) return existing;

      const createdAt = timestampFrom(clock);
      const localDeviceIdentityId = idFactory('local-device');
      const identity = createRiverlineIdentity({
        identityId: idFactory('identity'),
        kind: RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST,
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
          const racedRaw = await readRawRecords(transaction);
          const raced = inspectStoredRegistry(racedRaw);
          if (raced === 'legacy') {
            return recoverySnapshot(
              'concurrent_legacy_registry',
              'Local identity storage changed during initialization and was left untouched.',
              racedRaw,
            );
          }
          if (raced) return raced;
          await transaction.add(STORES.IDENTITIES, identity);
          for (const binding of bindings) await transaction.add(STORES.DOMAIN_BINDINGS, binding);
          await transaction.add(STORES.METADATA, metadata);
          return snapshot(metadata, [identity], bindings, [], []);
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
    const initialized = await initialize();
    if (initialized.status === 'recovery_required') {
      throw storageFailure('recovery_required', initialized.recovery.message);
    }
    try {
      return await getDatabase().runTransaction(ALL_STORES, 'readonly', operation);
    } catch (error) {
      if (error instanceof AccountIdentityStorageError || error instanceof TypeError || error instanceof RangeError) throw error;
      throw storageFailure('read_failed', 'Local profile data could not be read.', error);
    }
  }

  async function write(operation, options = {}) {
    const initialized = await initialize();
    if (initialized.status === 'recovery_required') {
      throw storageFailure('recovery_required', initialized.recovery.message);
    }
    try {
      return await getDatabase().runTransaction(ALL_STORES, 'readwrite', operation, options);
    } catch (error) {
      if (error instanceof AccountIdentityStorageError || error instanceof TypeError || error instanceof RangeError) throw error;
      throw storageFailure('transaction_failed', 'Local profile changes could not be saved.', error);
    }
  }

  async function currentMetadata(transaction, allowTransition = false) {
    const metadata = await transaction.get(STORES.METADATA, METADATA_KEY);
    validateRiverlineAccountMetadata(metadata);
    if (metadata.pendingTransitionId && !allowTransition) throw storageFailure('recovery_required', 'A lifecycle transition must be completed first.');
    return metadata;
  }

  async function commitMetadata(transaction, metadata, changes = {}, {
    lifecycleTransition = false,
    minimumLifecycleGeneration = null,
  } = {}) {
    const lifecycleGeneration = lifecycleTransition
      ? Math.max(
        metadata.lifecycleGeneration + 1,
        Number.isSafeInteger(minimumLifecycleGeneration) ? minimumLifecycleGeneration : 0,
      )
      : metadata.lifecycleGeneration;
    const next = {
      ...cloneData(metadata),
      ...cloneData(changes),
      revision: metadata.revision + 1,
      lifecycleGeneration,
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
      const initialized = await initialize();
      if (initialized.status === 'recovery_required') return initialized;
      return getDatabase().runTransaction(ALL_STORES, 'readonly', async (transaction) => {
        const raw = await readRawRecords(transaction);
        if (!raw.metadata) throw storageFailure('missing_registry', 'Local profile registry is missing.');
        return healthySnapshot(raw);
      });
    },

    async prepareLifecycleTransition(providerIdentity, { choice, guestIdentityId, minimumLifecycleGeneration, expectedRegistryGeneration, displayName = 'Riverline Account' } = {}) {
      validateAuthProviderIdentity(providerIdentity);
      if (!['move', 'keep_separate'].includes(choice)) throw new TypeError('Explicit lifecycle choice required');
      return write(async (transaction) => {
        const raw = await readRawRecords(transaction);
        healthySnapshot(raw);
        const metadata = await currentMetadata(transaction);
        if ((expectedRegistryGeneration !== undefined && metadata.lifecycleGeneration !== expectedRegistryGeneration)
          || metadata.deviceGuestIdentityId !== guestIdentityId || metadata.activeIdentityId !== guestIdentityId
          || await mappingForProviderIdentity(transaction, providerIdentity)) {
          throw storageFailure('identity_lifecycle_scope_stale', 'The first-sign-in target changed.');
        }
        const guest = raw.identities.find((identity) => identity.identityId === guestIdentityId);
        const guestBindings = raw.bindings.filter((binding) => binding.identityId === guestIdentityId);
        const createdAt = timestampNotBefore(clock, guest.updatedAt);
        const identity = choice === 'move' ? transitionRiverlineIdentityKind(guest, RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT, createdAt) : null;
        const account = identity ? { identity, bindings: guestBindings.map((binding) => rebindRiverlineDomainOwnershipBinding(binding, identity, createdAt)) }
          : createAdditionalIdentity({ kind: RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT, displayName, localDeviceIdentityId: metadata.localDeviceIdentityId, createdAt });
        const replacement = choice === 'move' ? createAdditionalIdentity({ kind: RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST, displayName: defaultDisplayName, localDeviceIdentityId: metadata.localDeviceIdentityId, createdAt }) : null;
        const mapping = createProviderIdentityMapping({ providerIdentity, riverlineIdentityId: account.identity.identityId, createdAt, updatedAt: createdAt, lastAuthenticatedAt: createdAt });
        const transitionId = idFactory('transition');
        const next = await commitMetadata(transaction, metadata, { pendingTransitionId: transitionId }, { lifecycleTransition: true, minimumLifecycleGeneration });
        const entry = { schemaVersion: LIFECYCLE_TRANSITION_SCHEMA_VERSION, transitionId, choice, phase: 'prepared', generation: next.lifecycleGeneration, guest, guestBindings, account, replacement, mapping };
        await transaction.add(STORES.LIFECYCLE_TRANSITIONS, entry);
        healthySnapshot(await readRawRecords(transaction));
        return deepFreeze(cloneData(entry));
      });
    },

    async updateLifecycleTransition(transitionId, phase) {
      return write(async (transaction) => {
        const raw = await readRawRecords(transaction);
        healthySnapshot(raw);
        const entry = raw.transitions.find((value) => value.transitionId === transitionId);
        if (!entry || raw.metadata.pendingTransitionId !== transitionId) throw storageFailure('recovery_required', 'Lifecycle reservation missing');
        const allowed = { prepared: ['binding_remote', 'remote_bound', 'cancelled', 'recovery_required'], binding_remote: ['remote_bound', 'recovery_required'], remote_bound: ['recovery_required'], recovery_required: ['binding_remote', 'remote_bound'] };
        if (!allowed[entry.phase]?.includes(phase) && phase !== entry.phase) throw new TypeError('Invalid lifecycle phase change');
        const next = { ...entry, phase };
        await transaction.put(STORES.LIFECYCLE_TRANSITIONS, next);
        if (phase === 'cancelled') await commitMetadata(transaction, raw.metadata, { pendingTransitionId: null });
        return deepFreeze(cloneData(next));
      });
    },

    async finalizeLifecycleTransition(transitionId, providerIdentity, { remoteIdentityId, guard = () => {}, signal = null } = {}) {
      validateAuthProviderIdentity(providerIdentity);
      return write(async (transaction) => {
        guard();
        const raw = await readRawRecords(transaction);
        healthySnapshot(raw);
        const entry = raw.transitions.find((value) => value.transitionId === transitionId);
        if (!entry || entry.mapping.mappingId !== providerIdentityMappingId(providerIdentity)
          || remoteIdentityId !== entry.account.identity.identityId) throw storageFailure('recovery_required', 'Remote lifecycle binding differs');
        if (entry.phase === 'locally_finalized') return { identity: entry.account.identity, state: healthySnapshot(raw) };
        if (raw.metadata.pendingTransitionId !== transitionId || entry.phase !== 'remote_bound') throw storageFailure('recovery_required', 'Remote binding has not been confirmed');
        await transaction.put(STORES.IDENTITIES, entry.account.identity);
        for (const binding of entry.account.bindings) await transaction.put(STORES.DOMAIN_BINDINGS, binding);
        if (entry.replacement) await addIdentityWithBindings(transaction, entry.replacement.identity, entry.replacement.bindings);
        await transaction.add(STORES.PROVIDER_MAPPINGS, entry.mapping);
        await transaction.put(STORES.LIFECYCLE_TRANSITIONS, { ...entry, phase: 'locally_finalized' });
        await commitMetadata(transaction, raw.metadata, { pendingTransitionId: null, activeIdentityId: entry.account.identity.identityId, deviceGuestIdentityId: entry.replacement?.identity.identityId ?? entry.guest.identityId });
        const state = healthySnapshot(await readRawRecords(transaction));
        guard();
        return { identity: entry.account.identity, state };
      }, { signal });
    },

    async getActiveIdentity() {
      const value = await repository.getSnapshot();
      return value.activeIdentity;
    },

    async getDomainOwnership(domain, identityId = null) {
      if (!OWNED_DOMAINS.includes(domain)) throw new RangeError(`Unsupported owned domain: ${domain}`);
      return read(async (transaction) => {
        const metadata = await currentMetadata(transaction, true);
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

    async activateProviderIdentity(providerIdentity, { minimumLifecycleGeneration = null } = {}) {
      validateAuthProviderIdentity(providerIdentity);
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction);
        const mapping = await mappingForProviderIdentity(transaction, providerIdentity);
        if (!mapping) return null;
        const identity = await transaction.get(STORES.IDENTITIES, mapping.riverlineIdentityId);
        validateRiverlineIdentity(identity);
        if (identity.kind !== RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT) {
          throw storageFailure(
            'provider_identity_binding_invalid',
            'The provider mapping does not reference an authenticated Riverline account.',
          );
        }
        for (const domain of OWNED_DOMAINS) {
          const binding = await transaction.get(
            STORES.DOMAIN_BINDINGS,
            domainOwnershipBindingId(identity.identityId, domain),
          );
          validateRiverlineDomainOwnershipBinding(binding);
          if (binding.ownershipRef.ownerType !== RIVERLINE_OWNER_TYPES.ACCOUNT_IDENTITY) {
            throw storageFailure(
              'provider_identity_binding_invalid',
              'The authenticated Riverline account has conflicting domain ownership.',
            );
          }
        }
        const refreshed = refreshProviderIdentityMapping(mapping, providerIdentity.authenticatedAt);
        await transaction.put(STORES.PROVIDER_MAPPINGS, refreshed);
        if (metadata.activeIdentityId !== identity.identityId) {
          await commitMetadata(
            transaction,
            metadata,
            { activeIdentityId: identity.identityId },
            { lifecycleTransition: true, minimumLifecycleGeneration },
          );
        }
        const state = healthySnapshot(await readRawRecords(transaction));
        return deepFreeze({
          identity: cloneData(identity),
          mapping: cloneData(refreshed),
          state,
          created: false,
        });
      });
    },

    async linkProviderIdentityToLocal(providerIdentity, {
      localIdentityId = null,
      minimumLifecycleGeneration = null,
    } = {}) {
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
        if (localIdentity.identityId !== metadata.deviceGuestIdentityId
          || localIdentity.kind !== RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST) {
          throw new RangeError('Only the active Device Guest can be linked');
        }

        const changedAt = timestampNotBefore(clock, localIdentity.updatedAt);
        const authenticatedIdentity = transitionRiverlineIdentityKind(
          localIdentity,
          RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT,
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
          kind: RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST,
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
        await commitMetadata(
          transaction,
          metadata,
          {
            activeIdentityId: authenticatedIdentity.identityId,
            deviceGuestIdentityId: replacement.identity.identityId,
          },
          { lifecycleTransition: true, minimumLifecycleGeneration },
        );
        const state = healthySnapshot(await readRawRecords(transaction));
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
      minimumLifecycleGeneration = null,
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
            await commitMetadata(
              transaction,
              metadata,
              { activeIdentityId: identity.identityId },
              { lifecycleTransition: true, minimumLifecycleGeneration },
            );
          }
          return deepFreeze({ identity: cloneData(identity), mapping: cloneData(refreshed), created: false });
        }

        const createdAt = timestampFrom(clock);
        const account = createAdditionalIdentity({
          kind: RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT,
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
        await commitMetadata(
          transaction,
          metadata,
          { activeIdentityId: account.identity.identityId },
          { lifecycleTransition: true, minimumLifecycleGeneration },
        );
        const state = healthySnapshot(await readRawRecords(transaction));
        return deepFreeze({
          identity: cloneData(account.identity),
          mapping: cloneData(mapping),
          state,
          created: true,
        });
      });
    },

    async setDisplayName(displayName, identityId = null) {
      return write(async (transaction) => {
        const metadata = await currentMetadata(transaction, true);
        const resolvedIdentityId = identityId ?? metadata.activeIdentityId;
        const identity = await transaction.get(STORES.IDENTITIES, resolvedIdentityId);
        validateRiverlineIdentity(identity);
        if (identity.localDeviceIdentityId !== metadata.localDeviceIdentityId) {
          throw new RangeError('Riverline identity does not belong to this local device registry');
        }
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

    async activateIdentity(identityId, { minimumLifecycleGeneration = null } = {}) {
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
          await commitMetadata(
            transaction,
            metadata,
            { activeIdentityId: identityId },
            { lifecycleTransition: true, minimumLifecycleGeneration },
          );
        }
        const state = healthySnapshot(await readRawRecords(transaction));
        return deepFreeze({ identity: cloneData(identity), state });
      });
    },

    async activateDeviceGuest(options = {}) {
      const current = await repository.getSnapshot();
      if (current.status === 'recovery_required') {
        throw storageFailure('recovery_required', current.recovery.message);
      }
      return repository.activateIdentity(current.metadata.deviceGuestIdentityId, options);
    },

    async registerIdentity({ identity, bindings } = {}) {
      validateRiverlineIdentity(identity);
      if (identity.kind !== RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT) {
        throw new RangeError('Only authenticated account identities may be registered additionally');
      }
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
