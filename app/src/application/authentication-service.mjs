import { RIVERLINE_IDENTITY_KINDS, normalizeRiverlineDisplayName } from '../account-identity/index.mjs';
import { normalizeAccountUsername } from '../account-profile/index.mjs';
import { validateAuthProviderIdentity } from '../authentication/domain.mjs';

export const AUTHENTICATION_STATE_SCHEMA_VERSION = 'riverline-authentication-state/v2';

function suggestedDisplayName(providerIdentity) {
  const emailPrefix = typeof providerIdentity.email === 'string'
    ? providerIdentity.email.split('@')[0]
    : null;
  for (const candidate of [providerIdentity.displayName, emailPrefix, 'Riverline Account']) {
    if (typeof candidate !== 'string') continue;
    try { return normalizeRiverlineDisplayName([...candidate].slice(0, 80).join('')); } catch { /* try fallback */ }
  }
  return 'Riverline Account';
}

function adapterContract(adapter) {
  if (adapter === null) return null;
  for (const method of [
    'isAvailable', 'restoreSession', 'refreshSession',
    'signInWithPassword', 'signUpWithPassword', 'signOut',
  ]) {
    if (typeof adapter?.[method] !== 'function') {
      throw new TypeError(`AuthProviderAdapter must provide ${method}()`);
    }
  }
  return adapter;
}

function profileRepositoryContract(repository) {
  if (repository === null) return null;
  for (const method of [
    'getByProviderIdentity', 'createForProviderIdentity',
    'bindRiverlineIdentity', 'updateDisplayName',
  ]) {
    if (typeof repository?.[method] !== 'function') {
      throw new TypeError(`AccountProfileRepository must provide ${method}()`);
    }
  }
  return repository;
}

function normalizedSignUpCredentials(credentials = {}) {
  return {
    ...credentials,
    username: normalizeAccountUsername(credentials.username),
    displayName: normalizeRiverlineDisplayName(credentials.displayName),
  };
}

export function createAuthenticationService({
  accountIdentity,
  providerAdapter = null,
  profileRepository = null,
} = {}) {
  if (!accountIdentity?.initialize || !accountIdentity?.ensureLocalIdentity
    || !accountIdentity?.activateLocalIdentity || !accountIdentity?.activateProviderIdentity
    || !accountIdentity?.reserveIdentityId) {
    throw new TypeError('AuthenticationService requires the Riverline account identity service');
  }
  const adapter = adapterContract(providerAdapter);
  const profiles = profileRepositoryContract(profileRepository);
  const listeners = new Set();
  let initializationPromise = null;
  let authenticationGeneration = 0;
  let currentProviderIdentity = null;
  let currentProfile = null;
  let pendingProviderIdentity = null;
  let pendingLocalIdentityId = null;
  let state = Object.freeze({
    schemaVersion: AUTHENTICATION_STATE_SCHEMA_VERSION,
    status: 'initializing',
    provider: adapter?.provider ?? null,
    email: null,
    profile: null,
    canLinkCurrentLocalData: false,
    noticeCode: null,
  });

  function publish(changes) {
    state = Object.freeze({ ...state, ...changes });
    for (const listener of listeners) listener(state);
    return state;
  }

  function beginAuthenticationOperation() {
    authenticationGeneration += 1;
    return authenticationGeneration;
  }

  function operationIsCurrent(expectedGeneration) {
    return expectedGeneration === authenticationGeneration;
  }

  function useGuestState(noticeCode = null) {
    currentProviderIdentity = null;
    currentProfile = null;
    pendingProviderIdentity = null;
    pendingLocalIdentityId = null;
    return publish({
      status: 'guest',
      email: null,
      profile: null,
      canLinkCurrentLocalData: false,
      noticeCode,
    });
  }

  async function bindRemoteProfile(profile, providerIdentity, riverlineIdentityId) {
    if (!profiles) return profile;
    if (!profile) {
      const error = new RangeError('Account profile setup is required');
      error.code = 'profile_setup_required';
      throw error;
    }
    if (profile.riverlineIdentityId && profile.riverlineIdentityId !== riverlineIdentityId) {
      const error = new RangeError('Account profile is bound to a different Riverline identity');
      error.code = 'profile_identity_conflict';
      throw error;
    }
    return profile.riverlineIdentityId
      ? profile
      : profiles.bindRiverlineIdentity(providerIdentity, riverlineIdentityId);
  }

  function publishSignedIn(providerIdentity, profile, noticeCode = null, expectedGeneration = null) {
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    currentProviderIdentity = providerIdentity;
    currentProfile = profile;
    pendingProviderIdentity = null;
    pendingLocalIdentityId = null;
    return publish({
      status: 'signed_in',
      provider: providerIdentity.provider,
      email: providerIdentity.email,
      profile,
      canLinkCurrentLocalData: false,
      noticeCode,
    });
  }

  async function settleAuthenticatedIdentity(
    providerIdentity,
    profileSetup = null,
    expectedGeneration = null,
  ) {
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    validateAuthProviderIdentity(providerIdentity);
    currentProviderIdentity = providerIdentity;
    let profile = profiles ? await profiles.getByProviderIdentity(providerIdentity) : null;
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    if (!profile && profiles && profileSetup) {
      profile = await profiles.createForProviderIdentity(providerIdentity, profileSetup);
      if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    }
    if (!profile && profiles) {
      pendingProviderIdentity = providerIdentity;
      pendingLocalIdentityId = null;
      return publish({
        status: 'profile_setup_required',
        provider: providerIdentity.provider,
        email: providerIdentity.email,
        profile: null,
        canLinkCurrentLocalData: false,
        noticeCode: 'profile_setup_required',
      });
    }

    const existing = await accountIdentity.activateProviderIdentity(providerIdentity);
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    if (existing) {
      profile = await bindRemoteProfile(profile, providerIdentity, existing.identity.identityId);
      return publishSignedIn(providerIdentity, profile, null, expectedGeneration);
    }

    if (profile?.riverlineIdentityId) {
      const account = await accountIdentity.startProviderIdentitySeparately(providerIdentity, {
        displayName: profile.displayName,
        riverlineIdentityId: profile.riverlineIdentityId,
      });
      if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
      return publishSignedIn(
        providerIdentity,
        profile,
        account.created ? 'account_restored_on_device' : null,
        expectedGeneration,
      );
    }

    // The legacy identity becomes active only inside this explicit authenticated
    // claim decision. Guest Mode never activates or exposes it.
    const local = await accountIdentity.activateLocalIdentity();
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    pendingProviderIdentity = providerIdentity;
    pendingLocalIdentityId = local.identityId;
    currentProfile = profile;
    return publish({
      status: 'link_required',
      provider: providerIdentity.provider,
      email: providerIdentity.email,
      profile,
      canLinkCurrentLocalData: true,
      noticeCode: null,
    });
  }

  function settleFailure(error, fallback = 'authentication_failed', expectedGeneration = null) {
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    const code = error?.code ?? fallback;
    if (code === 'authentication_cancelled') return useGuestState('authentication_cancelled');
    if (code === 'session_expired') return useGuestState('session_expired');
    if (code === 'provider_unavailable') return useGuestState('provider_unavailable');
    return publish({
      status: code === 'profile_identity_conflict' ? 'identity_conflict' : 'authentication_failed',
      noticeCode: code,
      canLinkCurrentLocalData: false,
    });
  }

  async function initialize() {
    if (initializationPromise) return initializationPromise;
    const expectedGeneration = beginAuthenticationOperation();
    initializationPromise = (async () => {
      await accountIdentity.initialize();
      if (!operationIsCurrent(expectedGeneration)) return state;
      if (!adapter || !adapter.isAvailable()) return useGuestState('provider_not_configured');
      try {
        const restored = await adapter.restoreSession();
        if (!operationIsCurrent(expectedGeneration)) return state;
        if (!restored) return useGuestState();
        return await settleAuthenticatedIdentity(restored, null, expectedGeneration);
      } catch (error) {
        if (!operationIsCurrent(expectedGeneration)) return state;
        if (error?.code === 'profile_identity_conflict') return settleFailure(error);
        return useGuestState(error?.code === 'session_expired' ? 'session_expired' : 'provider_unavailable');
      }
    })();
    return initializationPromise;
  }

  async function authenticate(method, rawCredentials) {
    await initialize();
    if (!adapter || !adapter.isAvailable()) return useGuestState('provider_not_configured');
    const expectedGeneration = beginAuthenticationOperation();
    let credentials = rawCredentials;
    if (method === 'signUpWithPassword') {
      try { credentials = normalizedSignUpCredentials(rawCredentials); }
      catch {
        return publish({ status: 'authentication_failed', noticeCode: 'invalid_profile', profile: null });
      }
    }
    publish({ status: 'authenticating', noticeCode: null });
    try {
      const result = await adapter[method](credentials);
      if (!operationIsCurrent(expectedGeneration)) return state;
      if (result?.status === 'confirmation_required') {
        currentProviderIdentity = null;
        return publish({
          status: 'confirmation_required',
          email: typeof result.email === 'string' ? result.email : credentials?.email ?? null,
          profile: null,
          canLinkCurrentLocalData: false,
          noticeCode: 'check_email',
        });
      }
      return await settleAuthenticatedIdentity(
        result,
        method === 'signUpWithPassword'
          ? { username: credentials.username, displayName: credentials.displayName }
          : null,
        expectedGeneration,
      );
    } catch (error) {
      return settleFailure(error, 'authentication_failed', expectedGeneration);
    }
  }

  async function signOut() {
    beginAuthenticationOperation();
    useGuestState('signed_out');
    if (adapter) {
      try { await adapter.signOut(); }
      catch {
        return state.status === 'guest'
          ? publish({ noticeCode: 'signout_incomplete' })
          : state;
      }
    }
    return state;
  }

  return Object.freeze({
    initialize,
    ready: initialize,
    getState: () => state,
    async getKnownIdentities() {
      await accountIdentity.initialize();
      const identities = await accountIdentity.listKnownIdentities();
      return identities.filter((identity) => identity.kind === RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_FUTURE);
    },
    signInWithPassword: (credentials) => authenticate('signInWithPassword', credentials),
    signUpWithPassword: (credentials) => authenticate('signUpWithPassword', credentials),
    async completeProfileSetup({ username, displayName } = {}) {
      if (!profiles || !pendingProviderIdentity) throw new RangeError('There is no profile setup to complete');
      let setup;
      try {
        setup = {
          username: normalizeAccountUsername(username),
          displayName: normalizeRiverlineDisplayName(displayName),
        };
      } catch {
        return publish({ status: 'profile_setup_required', noticeCode: 'invalid_profile' });
      }
      publish({ status: 'authenticating', noticeCode: null });
      try {
        await profiles.createForProviderIdentity(pendingProviderIdentity, setup);
        return await settleAuthenticatedIdentity(pendingProviderIdentity);
      } catch (error) {
        return publish({ status: 'profile_setup_required', noticeCode: error?.code ?? 'profile_setup_failed' });
      }
    },
    async refreshSession() {
      await initialize();
      if (!adapter) return useGuestState('provider_not_configured');
      const expectedGeneration = beginAuthenticationOperation();
      try {
        const refreshed = await adapter.refreshSession();
        if (!operationIsCurrent(expectedGeneration)) return state;
        return await settleAuthenticatedIdentity(refreshed, null, expectedGeneration);
      } catch (error) {
        return settleFailure(error, 'session_expired', expectedGeneration);
      }
    },
    async linkCurrentLocalData() {
      if (!pendingProviderIdentity || !pendingLocalIdentityId) {
        throw new RangeError('There is no pending legacy data claim');
      }
      publish({ status: 'linking', noticeCode: null });
      try {
        currentProfile = await bindRemoteProfile(
          currentProfile,
          pendingProviderIdentity,
          pendingLocalIdentityId,
        );
        await accountIdentity.linkProviderIdentityToLocal(pendingProviderIdentity, {
          localIdentityId: pendingLocalIdentityId,
        });
        return publishSignedIn(pendingProviderIdentity, currentProfile, 'local_data_linked');
      } catch (error) {
        return publish({
          status: 'link_required',
          canLinkCurrentLocalData: true,
          noticeCode: error?.code ?? 'link_failed',
        });
      }
    },
    async startSeparately() {
      if (!pendingProviderIdentity) throw new RangeError('There is no pending authenticated account');
      publish({ status: 'linking', noticeCode: null });
      try {
        const riverlineIdentityId = currentProfile?.riverlineIdentityId
          ?? accountIdentity.reserveIdentityId();
        currentProfile = await bindRemoteProfile(
          currentProfile,
          pendingProviderIdentity,
          riverlineIdentityId,
        );
        const providerIdentity = pendingProviderIdentity;
        await accountIdentity.startProviderIdentitySeparately(providerIdentity, {
          displayName: currentProfile?.displayName ?? suggestedDisplayName(providerIdentity),
          riverlineIdentityId,
        });
        return publishSignedIn(providerIdentity, currentProfile, 'account_started_separately');
      } catch (error) {
        return publish({ status: 'link_required', noticeCode: error?.code ?? 'link_failed' });
      }
    },
    async updateDisplayName(value) {
      if (state.status !== 'signed_in' || !currentProviderIdentity || !profiles) {
        throw new RangeError('A signed-in Account Profile is required');
      }
      const displayName = normalizeRiverlineDisplayName(value);
      const profile = await profiles.updateDisplayName(currentProviderIdentity, displayName);
      await accountIdentity.setDisplayName(profile.displayName);
      currentProfile = profile;
      return publish({ profile, noticeCode: 'display_name_saved' });
    },
    async cancelPendingAuthentication() {
      beginAuthenticationOperation();
      useGuestState('authentication_cancelled');
      if (adapter) {
        try { await adapter.signOut(); } catch { /* Guest Mode still wins locally */ }
      }
      return state;
    },
    signOut,
    switchToGuest: () => signOut(),
    switchToLocalProfile: () => signOut(),
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Authentication listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
