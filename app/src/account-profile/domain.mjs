import { normalizeRiverlineDisplayName } from '../account-identity/domain.mjs';

export const ACCOUNT_PROFILE_SCHEMA_VERSION = 'riverline-account-profile/v1';
export const ACCOUNT_USERNAME_MIN_LENGTH = 3;
export const ACCOUNT_USERNAME_MAX_LENGTH = 24;

const RESERVED_USERNAMES = Object.freeze(new Set([
  'admin', 'administrator', 'api', 'auth', 'guest', 'help', 'moderator',
  'riverline', 'root', 'security', 'staff', 'support', 'system',
]));

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
    throw new TypeError(`${label} must be non-empty text`);
  }
  return value;
}

function requireOptionalText(value, label, maximum = 500) {
  if (value === null) return null;
  return requireOpaqueText(value, label, maximum);
}

function normalizedTimestamp(value, label) {
  const date = new Date(value);
  if (typeof value !== 'string' || !Number.isFinite(date.getTime())) {
    throw new TypeError(`${label} must be a valid timestamp`);
  }
  return date.toISOString();
}

export function normalizeAccountUsername(value) {
  if (typeof value !== 'string') throw new TypeError('Username must be text');
  const normalized = value.toLowerCase();
  if (value !== value.trim() || normalized.length < ACCOUNT_USERNAME_MIN_LENGTH
    || normalized.length > ACCOUNT_USERNAME_MAX_LENGTH
    || !/^[a-z0-9][a-z0-9_]*$/.test(normalized)) {
    throw new RangeError('Username must be 3-24 ASCII letters, digits, or underscores and start with a letter or digit');
  }
  if (RESERVED_USERNAMES.has(normalized)) throw new RangeError('Username is reserved');
  return normalized;
}

export function createAccountProfile({
  authUserId,
  riverlineIdentityId = null,
  username,
  usernameNormalized = normalizeAccountUsername(username),
  displayName,
  createdAt,
  updatedAt = createdAt,
} = {}) {
  const profile = {
    schemaVersion: ACCOUNT_PROFILE_SCHEMA_VERSION,
    authUserId,
    riverlineIdentityId,
    username,
    usernameNormalized,
    displayName,
    createdAt: normalizedTimestamp(createdAt, 'AccountProfile.createdAt'),
    updatedAt: normalizedTimestamp(updatedAt, 'AccountProfile.updatedAt'),
  };
  validateAccountProfile(profile);
  return Object.freeze(profile);
}

export function validateAccountProfile(profile) {
  requireObject(profile, 'AccountProfile');
  requireExactKeys(profile, [
    'schemaVersion', 'authUserId', 'riverlineIdentityId', 'username',
    'usernameNormalized', 'displayName', 'createdAt', 'updatedAt',
  ], 'AccountProfile');
  if (profile.schemaVersion !== ACCOUNT_PROFILE_SCHEMA_VERSION) {
    throw new TypeError(`Expected ${ACCOUNT_PROFILE_SCHEMA_VERSION}`);
  }
  requireOpaqueText(profile.authUserId, 'AccountProfile.authUserId');
  requireOptionalText(profile.riverlineIdentityId, 'AccountProfile.riverlineIdentityId', 240);
  const normalized = normalizeAccountUsername(profile.username);
  if (profile.username !== normalized || profile.usernameNormalized !== normalized) {
    throw new RangeError('AccountProfile username fields must contain the same normalized username');
  }
  normalizeRiverlineDisplayName(profile.displayName);
  const createdAt = normalizedTimestamp(profile.createdAt, 'AccountProfile.createdAt');
  const updatedAt = normalizedTimestamp(profile.updatedAt, 'AccountProfile.updatedAt');
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    throw new RangeError('AccountProfile.updatedAt cannot precede createdAt');
  }
  return profile;
}

export function accountProfileFromDatabaseRow(row) {
  requireObject(row, 'profiles row');
  return createAccountProfile({
    authUserId: row.auth_user_id,
    riverlineIdentityId: row.riverline_identity_id ?? null,
    username: row.username,
    usernameNormalized: row.username_normalized,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function accountProfileToDatabaseInsert({ authUserId, username, displayName } = {}) {
  const normalized = normalizeAccountUsername(username);
  return Object.freeze({
    auth_user_id: requireOpaqueText(authUserId, 'authUserId'),
    riverline_identity_id: null,
    username: normalized,
    username_normalized: normalized,
    display_name: normalizeRiverlineDisplayName(displayName),
  });
}

export function isReservedAccountUsername(value) {
  return typeof value === 'string' && RESERVED_USERNAMES.has(value.toLowerCase());
}
