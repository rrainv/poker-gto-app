export const RIVERLINE_IDENTITY_SCHEMA_VERSION = 'riverline-identity/v1';
export const RIVERLINE_OWNERSHIP_REF_SCHEMA_VERSION = 'riverline-ownership-ref/v1';
export const RIVERLINE_DOMAIN_OWNERSHIP_BINDING_SCHEMA_VERSION = 'riverline-domain-ownership-binding/v1';
export const RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION = 'riverline-account-metadata/v1';
export const RIVERLINE_ACCOUNT_MIGRATION_SCHEMA_VERSION = 'riverline-account-migration/v1';
export const RIVERLINE_ACCOUNT_MIGRATION_VERSION = 1;
export const RIVERLINE_DISPLAY_NAME_MAX_LENGTH = 80;

export const RIVERLINE_IDENTITY_KINDS = Object.freeze({
  LOCAL: 'local',
  AUTHENTICATED_FUTURE: 'authenticated_future',
});

export const RIVERLINE_OWNER_TYPES = Object.freeze({
  LOCAL_IDENTITY: 'local_identity',
  ACCOUNT_IDENTITY: 'account_identity',
});

export const RIVERLINE_OWNED_DOMAINS = Object.freeze({
  SAVED_STUDY_OBJECTS: 'saved_study_objects',
  PERSONAL_STRATEGY: 'personal_strategy',
});

export const RIVERLINE_STORAGE_SCOPES = Object.freeze({
  LEGACY_DEFAULT: 'legacy_default',
});

export const RIVERLINE_BINDING_PROVENANCE = Object.freeze({
  LEGACY_ADOPTED: 'legacy_adopted',
  IDENTITY_INITIALIZED: 'identity_initialized',
});

const IDENTITY_KIND_VALUES = Object.freeze(Object.values(RIVERLINE_IDENTITY_KINDS));
const OWNER_TYPE_VALUES = Object.freeze(Object.values(RIVERLINE_OWNER_TYPES));
const OWNED_DOMAIN_VALUES = Object.freeze(Object.values(RIVERLINE_OWNED_DOMAINS));
const BINDING_PROVENANCE_VALUES = Object.freeze(Object.values(RIVERLINE_BINDING_PROVENANCE));

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

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError(`${label} contains unsupported or missing fields`);
  }
}

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 240) {
    throw new TypeError(`${label} must be a non-empty opaque ID`);
  }
  return value;
}

function requireIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp`);
  }
  return value;
}

export function normalizeRiverlineDisplayName(value) {
  if (typeof value !== 'string') throw new TypeError('Display name must be text');
  const normalized = value.trim();
  const length = [...normalized].length;
  if (length < 1 || length > RIVERLINE_DISPLAY_NAME_MAX_LENGTH) {
    throw new RangeError(`Display name must contain 1 through ${RIVERLINE_DISPLAY_NAME_MAX_LENGTH} characters`);
  }
  return normalized;
}

function expectedOwnerType(kind) {
  return kind === RIVERLINE_IDENTITY_KINDS.LOCAL
    ? RIVERLINE_OWNER_TYPES.LOCAL_IDENTITY
    : RIVERLINE_OWNER_TYPES.ACCOUNT_IDENTITY;
}

export function createRiverlineOwnershipRef({ ownerType, ownerId } = {}) {
  const ref = {
    schemaVersion: RIVERLINE_OWNERSHIP_REF_SCHEMA_VERSION,
    ownerType,
    ownerId,
  };
  validateRiverlineOwnershipRef(ref);
  return deepFreeze(ref);
}

export function validateRiverlineOwnershipRef(ref) {
  requireObject(ref, 'RiverlineOwnershipRef');
  requireExactKeys(ref, ['schemaVersion', 'ownerType', 'ownerId'], 'RiverlineOwnershipRef');
  if (ref.schemaVersion !== RIVERLINE_OWNERSHIP_REF_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RIVERLINE_OWNERSHIP_REF_SCHEMA_VERSION}`);
  }
  if (!OWNER_TYPE_VALUES.includes(ref.ownerType)) {
    throw new RangeError(`Unsupported Riverline owner type: ${ref.ownerType}`);
  }
  requireId(ref.ownerId, 'RiverlineOwnershipRef.ownerId');
  return ref;
}

export function createRiverlineIdentity({
  identityId,
  kind = RIVERLINE_IDENTITY_KINDS.LOCAL,
  displayName = 'Local Player',
  localDeviceIdentityId,
  createdAt,
  updatedAt = createdAt,
} = {}) {
  const identity = {
    schemaVersion: RIVERLINE_IDENTITY_SCHEMA_VERSION,
    identityId,
    kind,
    displayName: normalizeRiverlineDisplayName(displayName),
    localDeviceIdentityId,
    createdAt,
    updatedAt,
  };
  validateRiverlineIdentity(identity);
  return deepFreeze(identity);
}

export function validateRiverlineIdentity(identity) {
  requireObject(identity, 'RiverlineIdentity');
  requireExactKeys(identity, [
    'schemaVersion', 'identityId', 'kind', 'displayName', 'localDeviceIdentityId',
    'createdAt', 'updatedAt',
  ], 'RiverlineIdentity');
  if (identity.schemaVersion !== RIVERLINE_IDENTITY_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RIVERLINE_IDENTITY_SCHEMA_VERSION}`);
  }
  requireId(identity.identityId, 'RiverlineIdentity.identityId');
  if (!IDENTITY_KIND_VALUES.includes(identity.kind)) {
    throw new RangeError(`Unsupported Riverline identity kind: ${identity.kind}`);
  }
  normalizeRiverlineDisplayName(identity.displayName);
  requireId(identity.localDeviceIdentityId, 'RiverlineIdentity.localDeviceIdentityId');
  requireIsoTimestamp(identity.createdAt, 'RiverlineIdentity.createdAt');
  requireIsoTimestamp(identity.updatedAt, 'RiverlineIdentity.updatedAt');
  if (Date.parse(identity.updatedAt) < Date.parse(identity.createdAt)) {
    throw new RangeError('RiverlineIdentity.updatedAt cannot precede createdAt');
  }
  return identity;
}

export function riverlineOwnershipRefForIdentity(identity) {
  validateRiverlineIdentity(identity);
  return createRiverlineOwnershipRef({
    ownerType: expectedOwnerType(identity.kind),
    ownerId: identity.identityId,
  });
}

export function updateRiverlineIdentityDisplayName(identity, displayName, updatedAt) {
  validateRiverlineIdentity(identity);
  return createRiverlineIdentity({
    ...cloneData(identity),
    displayName: normalizeRiverlineDisplayName(displayName),
    updatedAt,
  });
}

export function transitionRiverlineIdentityKind(identity, kind, updatedAt) {
  validateRiverlineIdentity(identity);
  return createRiverlineIdentity({
    ...cloneData(identity),
    kind,
    updatedAt,
  });
}

export function rebindRiverlineDomainOwnershipBinding(binding, identity, updatedAt) {
  validateRiverlineDomainOwnershipBinding(binding);
  validateRiverlineIdentity(identity);
  if (binding.identityId !== identity.identityId) {
    throw new RangeError('Domain ownership binding cannot move to another Riverline identity');
  }
  return createRiverlineDomainOwnershipBinding({
    identity,
    domain: binding.domain,
    domainOwnerId: binding.domainOwnerId,
    storageScope: binding.storageScope,
    provenance: binding.provenance,
    createdAt: binding.createdAt,
    updatedAt,
  });
}

export function domainOwnershipBindingId(identityId, domain) {
  requireId(identityId, 'identityId');
  if (!OWNED_DOMAIN_VALUES.includes(domain)) throw new RangeError(`Unsupported owned domain: ${domain}`);
  return `${identityId}:${domain}`;
}

export function createRiverlineDomainOwnershipBinding({
  identity,
  domain,
  domainOwnerId,
  storageScope,
  provenance,
  createdAt,
  updatedAt = createdAt,
} = {}) {
  validateRiverlineIdentity(identity);
  const binding = {
    schemaVersion: RIVERLINE_DOMAIN_OWNERSHIP_BINDING_SCHEMA_VERSION,
    bindingId: domainOwnershipBindingId(identity.identityId, domain),
    identityId: identity.identityId,
    domain,
    ownershipRef: cloneData(riverlineOwnershipRefForIdentity(identity)),
    domainOwnerId,
    storageScope,
    provenance,
    createdAt,
    updatedAt,
  };
  validateRiverlineDomainOwnershipBinding(binding);
  return deepFreeze(binding);
}

export function validateRiverlineDomainOwnershipBinding(binding) {
  requireObject(binding, 'RiverlineDomainOwnershipBinding');
  requireExactKeys(binding, [
    'schemaVersion', 'bindingId', 'identityId', 'domain', 'ownershipRef', 'domainOwnerId',
    'storageScope', 'provenance', 'createdAt', 'updatedAt',
  ], 'RiverlineDomainOwnershipBinding');
  if (binding.schemaVersion !== RIVERLINE_DOMAIN_OWNERSHIP_BINDING_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${RIVERLINE_DOMAIN_OWNERSHIP_BINDING_SCHEMA_VERSION}`);
  }
  requireId(binding.identityId, 'RiverlineDomainOwnershipBinding.identityId');
  if (!OWNED_DOMAIN_VALUES.includes(binding.domain)) {
    throw new RangeError(`Unsupported owned domain: ${binding.domain}`);
  }
  if (binding.bindingId !== domainOwnershipBindingId(binding.identityId, binding.domain)) {
    throw new RangeError('RiverlineDomainOwnershipBinding.bindingId is inconsistent');
  }
  validateRiverlineOwnershipRef(binding.ownershipRef);
  if (binding.ownershipRef.ownerId !== binding.identityId) {
    throw new RangeError('RiverlineDomainOwnershipBinding ownership must reference its identity');
  }
  requireId(binding.domainOwnerId, 'RiverlineDomainOwnershipBinding.domainOwnerId');
  requireId(binding.storageScope, 'RiverlineDomainOwnershipBinding.storageScope');
  if (!/^[A-Za-z0-9._-]+$/.test(binding.storageScope)) {
    throw new RangeError('RiverlineDomainOwnershipBinding.storageScope must be storage-safe');
  }
  if (!BINDING_PROVENANCE_VALUES.includes(binding.provenance)) {
    throw new RangeError(`Unsupported binding provenance: ${binding.provenance}`);
  }
  requireIsoTimestamp(binding.createdAt, 'RiverlineDomainOwnershipBinding.createdAt');
  requireIsoTimestamp(binding.updatedAt, 'RiverlineDomainOwnershipBinding.updatedAt');
  return binding;
}

export function createRiverlineAccountMigration({ completedAt, adoptedDomains = [] } = {}) {
  const migration = {
    schemaVersion: RIVERLINE_ACCOUNT_MIGRATION_SCHEMA_VERSION,
    version: RIVERLINE_ACCOUNT_MIGRATION_VERSION,
    status: 'complete',
    completedAt,
    adoptedDomains: [...adoptedDomains].sort(),
  };
  validateRiverlineAccountMigration(migration);
  return deepFreeze(migration);
}

export function validateRiverlineAccountMigration(migration) {
  requireObject(migration, 'RiverlineAccountMigration');
  requireExactKeys(migration, [
    'schemaVersion', 'version', 'status', 'completedAt', 'adoptedDomains',
  ], 'RiverlineAccountMigration');
  if (migration.schemaVersion !== RIVERLINE_ACCOUNT_MIGRATION_SCHEMA_VERSION
    || migration.version !== RIVERLINE_ACCOUNT_MIGRATION_VERSION
    || migration.status !== 'complete') {
    throw new TypeError('Riverline account migration metadata is incompatible');
  }
  requireIsoTimestamp(migration.completedAt, 'RiverlineAccountMigration.completedAt');
  if (!Array.isArray(migration.adoptedDomains)
    || migration.adoptedDomains.some((domain) => !OWNED_DOMAIN_VALUES.includes(domain))
    || new Set(migration.adoptedDomains).size !== migration.adoptedDomains.length) {
    throw new TypeError('RiverlineAccountMigration.adoptedDomains is invalid');
  }
  return migration;
}

export function validateRiverlineAccountMetadata(metadata) {
  requireObject(metadata, 'RiverlineAccountMetadata');
  requireExactKeys(metadata, [
    'schemaVersion', 'key', 'backendSchemaVersion', 'databaseVersion',
    'activeIdentityId', 'localDeviceIdentityId', 'revision',
    'createdAt', 'updatedAt', 'migration',
  ], 'RiverlineAccountMetadata');
  if (metadata.schemaVersion !== RIVERLINE_ACCOUNT_METADATA_SCHEMA_VERSION || metadata.key !== 'state') {
    throw new TypeError('Riverline account metadata is incompatible');
  }
  if (typeof metadata.backendSchemaVersion !== 'string' || !metadata.backendSchemaVersion
    || !Number.isSafeInteger(metadata.databaseVersion) || metadata.databaseVersion < 1) {
    throw new TypeError('Riverline account backend metadata is invalid');
  }
  requireId(metadata.activeIdentityId, 'RiverlineAccountMetadata.activeIdentityId');
  requireId(metadata.localDeviceIdentityId, 'RiverlineAccountMetadata.localDeviceIdentityId');
  if (!Number.isSafeInteger(metadata.revision) || metadata.revision < 0) {
    throw new RangeError('RiverlineAccountMetadata.revision must be a non-negative safe integer');
  }
  requireIsoTimestamp(metadata.createdAt, 'RiverlineAccountMetadata.createdAt');
  requireIsoTimestamp(metadata.updatedAt, 'RiverlineAccountMetadata.updatedAt');
  validateRiverlineAccountMigration(metadata.migration);
  return metadata;
}

export function scopedDomainDatabaseName(baseName, binding) {
  if (typeof baseName !== 'string' || !baseName) throw new TypeError('Database base name is required');
  validateRiverlineDomainOwnershipBinding(binding);
  return binding.storageScope === RIVERLINE_STORAGE_SCOPES.LEGACY_DEFAULT
    ? baseName
    : `${baseName}--${binding.storageScope}`;
}

export function scopedPreferenceKey(baseKey, binding) {
  if (typeof baseKey !== 'string' || !baseKey) throw new TypeError('Preference key is required');
  validateRiverlineDomainOwnershipBinding(binding);
  return binding.storageScope === RIVERLINE_STORAGE_SCOPES.LEGACY_DEFAULT
    ? baseKey
    : `${baseKey}:${binding.storageScope}`;
}
