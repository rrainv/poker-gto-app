import {
  accountProfileFromDatabaseRow,
  accountProfileToDatabaseInsert,
  createAccountProfile,
  normalizeAccountUsername,
  validateAccountProfile,
} from './domain.mjs';
import { normalizeRiverlineDisplayName } from '../account-identity/domain.mjs';
import { validateAuthProviderIdentity } from '../authentication/domain.mjs';

const PROFILE_COLUMNS = [
  'auth_user_id', 'riverline_identity_id', 'username', 'username_normalized',
  'display_name', 'created_at', 'updated_at',
].join(',');

export class AccountProfileRepositoryError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AccountProfileRepositoryError';
    this.code = code;
  }
}

function failure(code, message, cause = null) {
  return new AccountProfileRepositoryError(code, message, cause);
}

function databaseFailure(error, fallback = 'profile_unavailable') {
  const content = `${error?.code ?? ''} ${error?.message ?? ''} ${error?.details ?? ''}`;
  if (fallback === 'profile_identity_conflict') return failure(fallback, 'Account profile binding could not be confirmed.', error);
  if (/23505|unique|duplicate|username/i.test(content)) {
    return failure('username_unavailable', 'That username is unavailable.', error);
  }
  if (/fetch|network|offline|timeout/i.test(content)) {
    return failure('profile_unavailable', 'Account profile service is unavailable.', error);
  }
  return failure(fallback, 'Account profile could not be saved.', error);
}

function subject(providerIdentity) {
  validateAuthProviderIdentity(providerIdentity);
  return providerIdentity.providerSubject;
}

export function createSupabaseAccountProfileRepository({ client } = {}) {
  if (!client || typeof client.from !== 'function' || typeof client.rpc !== 'function') {
    throw new TypeError('Supabase AccountProfileRepository requires a client');
  }

  async function getByProviderIdentity(providerIdentity) {
    const result = await client.from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('auth_user_id', subject(providerIdentity))
      .maybeSingle();
    if (result?.error) throw databaseFailure(result.error);
    return result?.data ? accountProfileFromDatabaseRow(result.data) : null;
  }

  return Object.freeze({
    getByProviderIdentity,
    async createForProviderIdentity(providerIdentity, { username, displayName } = {}) {
      const insert = accountProfileToDatabaseInsert({
        authUserId: subject(providerIdentity), username, displayName,
      });
      const result = await client.from('profiles').insert(insert).select(PROFILE_COLUMNS).single();
      if (result?.error) throw databaseFailure(result.error, 'profile_setup_failed');
      return accountProfileFromDatabaseRow(result.data);
    },
    async bindRiverlineIdentity(providerIdentity, riverlineIdentityId) {
      if (typeof riverlineIdentityId !== 'string' || !riverlineIdentityId.trim()) {
        throw new TypeError('Riverline identity ID is required');
      }
      const result = await client.rpc('bind_riverline_identity', {
        p_riverline_identity_id: riverlineIdentityId,
      });
      if (result?.error) throw databaseFailure(result.error, 'profile_identity_conflict');
      const profile = await getByProviderIdentity(providerIdentity);
      if (!profile || profile.riverlineIdentityId !== riverlineIdentityId) {
        throw failure('profile_identity_conflict', 'Account profile identity binding was not confirmed.');
      }
      return profile;
    },
    async updateDisplayName(providerIdentity, displayName) {
      const normalized = normalizeRiverlineDisplayName(displayName);
      const result = await client.from('profiles')
        .update({ display_name: normalized })
        .eq('auth_user_id', subject(providerIdentity))
        .select(PROFILE_COLUMNS)
        .single();
      if (result?.error) throw databaseFailure(result.error, 'profile_update_failed');
      return accountProfileFromDatabaseRow(result.data);
    },
  });
}

export function createMemoryAccountProfileRepository({ profiles = [], clock = () => new Date() } = {}) {
  const bySubject = new Map();
  const byUsername = new Map();
  profiles.forEach((profile) => {
    validateAccountProfile(profile);
    bySubject.set(profile.authUserId, profile);
    byUsername.set(profile.usernameNormalized, profile.authUserId);
  });

  function timestamp() {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Account profile clock is invalid');
    return date.toISOString();
  }

  return Object.freeze({
    async getByProviderIdentity(providerIdentity) {
      return bySubject.get(subject(providerIdentity)) ?? null;
    },
    async createForProviderIdentity(providerIdentity, { username, displayName } = {}) {
      const authUserId = subject(providerIdentity);
      if (bySubject.has(authUserId)) return bySubject.get(authUserId);
      const normalized = normalizeAccountUsername(username);
      if (byUsername.has(normalized)) throw failure('username_unavailable', 'That username is unavailable.');
      const now = timestamp();
      const profile = createAccountProfile({
        authUserId,
        username: normalized,
        usernameNormalized: normalized,
        displayName,
        createdAt: now,
      });
      bySubject.set(authUserId, profile);
      byUsername.set(normalized, authUserId);
      return profile;
    },
    async bindRiverlineIdentity(providerIdentity, riverlineIdentityId) {
      const authUserId = subject(providerIdentity);
      const existing = bySubject.get(authUserId);
      if (!existing) throw failure('profile_setup_required', 'Account profile setup is required.');
      if (existing.riverlineIdentityId && existing.riverlineIdentityId !== riverlineIdentityId) {
        throw failure('profile_identity_conflict', 'Account profile is already bound to another Riverline identity.');
      }
      const updated = createAccountProfile({
        ...existing,
        riverlineIdentityId,
        updatedAt: timestamp(),
      });
      bySubject.set(authUserId, updated);
      return updated;
    },
    async updateDisplayName(providerIdentity, displayName) {
      const authUserId = subject(providerIdentity);
      const existing = bySubject.get(authUserId);
      if (!existing) throw failure('profile_setup_required', 'Account profile setup is required.');
      const updated = createAccountProfile({
        ...existing,
        displayName: normalizeRiverlineDisplayName(displayName),
        updatedAt: timestamp(),
      });
      bySubject.set(authUserId, updated);
      return updated;
    },
    listProfiles: () => [...bySubject.values()],
  });
}
