export const PROVIDER_IDENTITY_MAPPING_SCHEMA_VERSION = 'provider-identity-mapping/v1';
export const AUTH_PROVIDER_IDENTITY_SCHEMA_VERSION = 'auth-provider-identity/v1';
export const AUTH_PROVIDER_NAMES = Object.freeze({
  SUPABASE: 'supabase',
  FAKE: 'fake',
});

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

function requireOpaqueText(value, label, maximum = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw new TypeError(`${label} must be non-empty opaque text`);
  }
  return value;
}

function requireOptionalText(value, label, maximum = 500) {
  if (value === null) return null;
  return requireOpaqueText(value, label, maximum);
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString() !== value) {
    throw new TypeError(`${label} must be a normalized ISO timestamp`);
  }
  return value;
}

export function providerIdentityMappingId({ provider, providerTenantId = null, providerSubject } = {}) {
  requireOpaqueText(provider, 'provider', 80);
  requireOptionalText(providerTenantId, 'providerTenantId', 240);
  requireOpaqueText(providerSubject, 'providerSubject');
  return JSON.stringify([provider, providerTenantId, providerSubject]);
}

export function createAuthProviderIdentity({
  provider,
  providerTenantId = null,
  providerSubject,
  email = null,
  displayName = null,
  authenticatedAt,
} = {}) {
  const identity = {
    schemaVersion: AUTH_PROVIDER_IDENTITY_SCHEMA_VERSION,
    provider,
    providerTenantId,
    providerSubject,
    email,
    displayName,
    authenticatedAt,
  };
  validateAuthProviderIdentity(identity);
  return deepFreeze(identity);
}

export function validateAuthProviderIdentity(identity) {
  requireObject(identity, 'AuthProviderIdentity');
  requireExactKeys(identity, [
    'schemaVersion', 'provider', 'providerTenantId', 'providerSubject',
    'email', 'displayName', 'authenticatedAt',
  ], 'AuthProviderIdentity');
  if (identity.schemaVersion !== AUTH_PROVIDER_IDENTITY_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${AUTH_PROVIDER_IDENTITY_SCHEMA_VERSION}`);
  }
  requireOpaqueText(identity.provider, 'AuthProviderIdentity.provider', 80);
  requireOptionalText(identity.providerTenantId, 'AuthProviderIdentity.providerTenantId', 240);
  requireOpaqueText(identity.providerSubject, 'AuthProviderIdentity.providerSubject');
  requireOptionalText(identity.email, 'AuthProviderIdentity.email', 320);
  requireOptionalText(identity.displayName, 'AuthProviderIdentity.displayName', 160);
  requireTimestamp(identity.authenticatedAt, 'AuthProviderIdentity.authenticatedAt');
  return identity;
}

export function createProviderIdentityMapping({
  providerIdentity,
  riverlineIdentityId,
  createdAt = providerIdentity?.authenticatedAt,
  updatedAt = createdAt,
  lastAuthenticatedAt = updatedAt,
} = {}) {
  validateAuthProviderIdentity(providerIdentity);
  const mapping = {
    schemaVersion: PROVIDER_IDENTITY_MAPPING_SCHEMA_VERSION,
    mappingId: providerIdentityMappingId(providerIdentity),
    provider: providerIdentity.provider,
    providerTenantId: providerIdentity.providerTenantId,
    providerSubject: providerIdentity.providerSubject,
    riverlineIdentityId,
    createdAt,
    updatedAt,
    lastAuthenticatedAt,
  };
  validateProviderIdentityMapping(mapping);
  return deepFreeze(mapping);
}

export function validateProviderIdentityMapping(mapping) {
  requireObject(mapping, 'ProviderIdentityMapping');
  requireExactKeys(mapping, [
    'schemaVersion', 'mappingId', 'provider', 'providerTenantId', 'providerSubject',
    'riverlineIdentityId', 'createdAt', 'updatedAt', 'lastAuthenticatedAt',
  ], 'ProviderIdentityMapping');
  if (mapping.schemaVersion !== PROVIDER_IDENTITY_MAPPING_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${PROVIDER_IDENTITY_MAPPING_SCHEMA_VERSION}`);
  }
  if (mapping.mappingId !== providerIdentityMappingId(mapping)) {
    throw new RangeError('ProviderIdentityMapping.mappingId is inconsistent');
  }
  requireOpaqueText(mapping.riverlineIdentityId, 'ProviderIdentityMapping.riverlineIdentityId', 240);
  requireTimestamp(mapping.createdAt, 'ProviderIdentityMapping.createdAt');
  requireTimestamp(mapping.updatedAt, 'ProviderIdentityMapping.updatedAt');
  requireTimestamp(mapping.lastAuthenticatedAt, 'ProviderIdentityMapping.lastAuthenticatedAt');
  if (Date.parse(mapping.updatedAt) < Date.parse(mapping.createdAt)
    || Date.parse(mapping.lastAuthenticatedAt) < Date.parse(mapping.createdAt)) {
    throw new RangeError('ProviderIdentityMapping timestamps are inconsistent');
  }
  return mapping;
}

export function refreshProviderIdentityMapping(mapping, authenticatedAt) {
  validateProviderIdentityMapping(mapping);
  requireTimestamp(authenticatedAt, 'authenticatedAt');
  const safeTime = Date.parse(authenticatedAt) < Date.parse(mapping.updatedAt)
    ? mapping.updatedAt
    : authenticatedAt;
  const refreshed = {
    ...cloneData(mapping),
    updatedAt: safeTime,
    lastAuthenticatedAt: safeTime,
  };
  validateProviderIdentityMapping(refreshed);
  return deepFreeze(refreshed);
}
