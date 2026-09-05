import { createGuestWorkQuery } from './guest-work-query.mjs';
import { RIVERLINE_IDENTITY_KINDS, normalizeRiverlineDisplayName } from '../account-identity/index.mjs';
import { normalizeAccountUsername } from '../account-profile/index.mjs';
import { providerIdentityMappingId, validateAuthProviderIdentity } from '../authentication/domain.mjs';

export const AUTHENTICATION_STATE_SCHEMA_VERSION = 'riverline-authentication-state/v3';

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
  hasMeaningfulGuestWork = null,
} = {}) {
  const activateDeviceGuest = accountIdentity?.activateDeviceGuest
    ?? accountIdentity?.activateLocalIdentity;
  if (!accountIdentity?.initialize || !accountIdentity?.ensureLocalIdentity
    || typeof activateDeviceGuest !== 'function' || !accountIdentity?.activateProviderIdentity
    || !accountIdentity?.reserveIdentityId) {
    throw new TypeError('AuthenticationService requires the Riverline account identity service');
  }
  const adapter = adapterContract(providerAdapter);
  const profiles = profileRepositoryContract(profileRepository);
  const inspectGuestWork = hasMeaningfulGuestWork ?? createGuestWorkQuery({ accountIdentity });
  const listeners = new Set();
  let initializationPromise = null;
  let authenticationGeneration = 0;
  let providerOperationQueue = Promise.resolve();
  let currentProviderIdentity = null;
  let currentProfile = null;
  let pendingProviderIdentity = null;
  let pendingLocalIdentityId = null;
  let pendingScope = null;
  let transitionTask = null;
  let recoveryTransitionAvailable = false;
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

  function providerOperation(method, argument, expectedGeneration = authenticationGeneration) {
    const task = providerOperationQueue.catch(() => null).then(() => {
      if (!operationIsCurrent(expectedGeneration)) throw new Error('Stale provider operation');
      return adapter[method](argument);
    });
    providerOperationQueue = task.catch(() => null);
    return task;
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

  function useRecoveryState(noticeCode = 'identity_recovery_required') {
    currentProviderIdentity = null;
    currentProfile = null;
    pendingProviderIdentity = null;
    pendingLocalIdentityId = null;
    return publish({
      status: 'recovery_required',
      canRetrySignIn: recoveryTransitionAvailable,
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
    const pending = await accountIdentity.getPendingLifecycleTransition();
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    const existingMapping = pending ? null : await accountIdentity.getProviderIdentityMapping(providerIdentity);
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    if (existingMapping && profiles && !profile) {
      accountIdentity.requireRecovery({ code: 'profile_identity_conflict' });
      return useRecoveryState();
    }
    recoveryTransitionAvailable = Boolean(pending);
    if (pending && profiles && !profile) return useRecoveryState();
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

    if (pending) {
      if (pending.mapping.mappingId !== providerIdentityMappingId(providerIdentity)) {
        accountIdentity.requireRecovery({ code: 'profile_identity_conflict' });
        return useRecoveryState();
      }
      currentProfile = profile;
      pendingProviderIdentity = providerIdentity;
      return performChoice(null, { resume: true });
    }
    if (existingMapping) {
      if (profiles && (!profile || profile.authUserId !== providerIdentity.providerSubject
        || profile.riverlineIdentityId !== existingMapping.riverlineIdentityId)) {
        accountIdentity.requireRecovery({ code: 'profile_identity_conflict' });
        return useRecoveryState();
      }
      const existing = await accountIdentity.activateProviderIdentity(providerIdentity);
      if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
      if (!existing || existing.identity.identityId !== existingMapping.riverlineIdentityId) {
        accountIdentity.requireRecovery({ code: 'provider_identity_binding_invalid' });
        return useRecoveryState();
      }
      return publishSignedIn(providerIdentity, profile, null, expectedGeneration);
    }
    if (profile?.riverlineIdentityId) {
      accountIdentity.requireRecovery({ code: 'profile_identity_conflict' });
      return useRecoveryState();
    }
    const scope = await accountIdentity.captureLifecycleScope();
    if (scope.identityKind !== 'device_guest') throw new Error('First sign-in requires Device Guest');
    const meaningful = await inspectGuestWork();
    scope.assertCurrent();
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    if (typeof meaningful !== 'boolean') throw new Error('Guest work availability is unknown');
    pendingProviderIdentity = providerIdentity;
    pendingLocalIdentityId = scope.identityId;
    pendingScope = scope;
    currentProfile = profile;
    if (meaningful) publish({ status: 'link_choice_required', provider: providerIdentity.provider, email: providerIdentity.email,
      profile: null, canLinkCurrentLocalData: meaningful, noticeCode: null });
    return meaningful ? state : performChoice('keep_separate', { automaticEmpty: true });
  }

  function performChoice(choice, { resume = false, automaticEmpty = false } = {}) {
    if (transitionTask) return transitionTask;
    if (!pendingProviderIdentity || (!resume && ((!automaticEmpty && state.status !== 'link_choice_required') || !pendingScope?.isCurrent()))) {
      return Promise.reject(new RangeError('The first-sign-in choice is no longer current'));
    }
    const providerIdentity = pendingProviderIdentity;
    const scope = pendingScope;
    const expectedGeneration = beginAuthenticationOperation();
    const guard = () => {
      if (!operationIsCurrent(expectedGeneration)) throw new Error('Authentication operation changed');
    };
    publish({ status: 'transitioning', profile: null, canLinkCurrentLocalData: false, noticeCode: null });
    transitionTask = (async () => {
      let boundProfile = null;
      try {
        await accountIdentity.runFirstSignInTransition(providerIdentity, { choice, scope, resume,
          displayName: currentProfile?.displayName ?? suggestedDisplayName(providerIdentity), guard,
          async bindRemote(entry, beforeRequest) {
            guard();
            const session = await providerOperation('restoreSession', undefined, expectedGeneration);
            guard();
            if (!session || providerIdentityMappingId(session) !== entry.mapping.mappingId) throw new Error('Provider subject changed');
            const profile = profiles ? await profiles.getByProviderIdentity(providerIdentity) : null;
            guard();
            if (profiles && (!profile || profile.authUserId !== providerIdentity.providerSubject
              || (profile.riverlineIdentityId && profile.riverlineIdentityId !== entry.account.identity.identityId))) {
              const error = new Error('Remote profile binding differs'); error.code = 'profile_identity_conflict'; throw error;
            }
            if (!profile?.riverlineIdentityId) await beforeRequest();
            boundProfile = await bindRemoteProfile(profile, providerIdentity, entry.account.identity.identityId);
            guard();
            const confirmed = await providerOperation('restoreSession', undefined, expectedGeneration);
            guard();
            if (!confirmed || providerIdentityMappingId(confirmed) !== entry.mapping.mappingId) throw new Error('Provider subject changed');
            return boundProfile?.riverlineIdentityId ?? entry.account.identity.identityId;
          },
        });
        guard();
        return publishSignedIn(providerIdentity, boundProfile, choice === 'move' ? 'local_data_linked' : 'account_started_separately', expectedGeneration);
      } catch (error) {
        if (accountIdentity.getLifecycleState().status === 'recovery_required') {
          try { recoveryTransitionAvailable = Boolean(await accountIdentity.getPendingLifecycleTransition()); } catch { recoveryTransitionAvailable = false; }
          return useRecoveryState();
        }
        if (!operationIsCurrent(expectedGeneration)) return state;
        useGuestState(error?.code ?? 'link_failed');
        try { await providerOperation('signOut'); } catch { publish({ noticeCode: 'signout_incomplete' }); }
        return state;
      } finally { transitionTask = null; }
    })();
    return transitionTask;
  }

  async function settleFailure(error, fallback = 'authentication_failed', expectedGeneration = null) {
    if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
    const code = error?.code ?? fallback;
    if (accountIdentity.getLifecycleState?.().status === 'recovery_required') return useRecoveryState();
    if (['authentication_cancelled', 'session_expired', 'provider_unavailable',
      'profile_identity_conflict', 'provider_identity_binding_invalid'].includes(code)) {
      try { await activateDeviceGuest.call(accountIdentity, 'authentication_failed'); }
      catch { return useRecoveryState(); }
      if (expectedGeneration !== null && !operationIsCurrent(expectedGeneration)) return state;
      if (code === 'profile_identity_conflict' || code === 'provider_identity_binding_invalid') {
        return publish({
          status: 'identity_conflict',
          noticeCode: code,
          canLinkCurrentLocalData: false,
        });
      }
      return useGuestState(code);
    }
    return publish({
      status: 'authentication_failed',
      profile: null,
      noticeCode: code,
      canLinkCurrentLocalData: false,
    });
  }

  async function initialize() {
    if (initializationPromise) return initializationPromise;
    const expectedGeneration = beginAuthenticationOperation();
    initializationPromise = (async () => {
      const identityState = await accountIdentity.initialize();
      recoveryTransitionAvailable = Boolean(identityState?.metadata?.pendingTransitionId);
      if (!operationIsCurrent(expectedGeneration)) return state;
      if (identityState?.status === 'recovery_required'
        || accountIdentity.getLifecycleState?.().status === 'recovery_required') {
        if (!identityState?.metadata?.pendingTransitionId) return useRecoveryState(identityState?.recovery?.code ?? 'identity_recovery_required');
      }
      if (!adapter || !adapter.isAvailable()) return identityState?.metadata?.pendingTransitionId ? useRecoveryState() : useGuestState('provider_not_configured');
      try {
        const restored = await providerOperation('restoreSession', undefined, expectedGeneration);
        if (!operationIsCurrent(expectedGeneration)) return state;
        if (!restored) return identityState?.metadata?.pendingTransitionId ? useRecoveryState() : useGuestState();
        return await settleAuthenticatedIdentity(restored, null, expectedGeneration);
      } catch (error) {
        if (!operationIsCurrent(expectedGeneration)) return state;
        return await settleFailure(
          error,
          error?.code === 'session_expired' ? 'session_expired' : 'provider_unavailable',
          expectedGeneration,
        );
      }
    })();
    return initializationPromise;
  }

  async function authenticate(method, rawCredentials) {
    await initialize();
    if (transitionTask) return state;
    if (state.status === 'recovery_required' && (!recoveryTransitionAvailable || method !== 'signInWithPassword')) return state;
    if (state.status === 'signed_in') await signOut();
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
      const result = await providerOperation(method, credentials, expectedGeneration);
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
      return await settleFailure(error, 'authentication_failed', expectedGeneration);
    }
  }

  async function signOut() {
    beginAuthenticationOperation();
    if (transitionTask) {
      accountIdentity.requireRecovery({ code: 'identity_transition_interrupted' });
      useRecoveryState();
      await transitionTask;
      if (accountIdentity.getLifecycleState().status === 'guest_active') useGuestState('signed_out');
      try { await (adapter ? providerOperation('signOut') : null); } catch { if (state.status === 'guest') publish({ noticeCode: 'signout_incomplete' }); }
      return state;
    }
    let guestActivation;
    try { guestActivation = activateDeviceGuest.call(accountIdentity, 'signed_out'); }
    catch { guestActivation = Promise.reject(new Error('Device Guest activation failed')); }
    useGuestState('signed_out');
    try { await guestActivation; }
    catch { useRecoveryState(); }
    if (adapter) {
      try { await providerOperation('signOut'); }
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
      return identities.filter((identity) => identity.kind === RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT);
    },
    signInWithPassword: (credentials) => authenticate('signInWithPassword', credentials),
    signUpWithPassword: (credentials) => authenticate('signUpWithPassword', credentials),
    async completeProfileSetup({ username, displayName } = {}) {
      if (transitionTask) return state;
      if (!profiles || !pendingProviderIdentity) throw new RangeError('There is no profile setup to complete');
      const expectedGeneration = beginAuthenticationOperation();
      const providerIdentity = pendingProviderIdentity;
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
        await profiles.createForProviderIdentity(providerIdentity, setup);
        if (!operationIsCurrent(expectedGeneration)) return state;
        return await settleAuthenticatedIdentity(providerIdentity, null, expectedGeneration);
      } catch (error) {
        if (!operationIsCurrent(expectedGeneration)) return state;
        return publish({ status: 'profile_setup_required', noticeCode: error?.code ?? 'profile_setup_failed' });
      }
    },
    async refreshSession() {
      await initialize();
      if (transitionTask || state.status === 'recovery_required') return state;
      if (!adapter) return useGuestState('provider_not_configured');
      const expectedGeneration = beginAuthenticationOperation();
      try {
        const refreshed = await providerOperation('refreshSession', undefined, expectedGeneration);
        if (!operationIsCurrent(expectedGeneration)) return state;
        return await settleAuthenticatedIdentity(refreshed, null, expectedGeneration);
      } catch (error) {
        return await settleFailure(error, 'session_expired', expectedGeneration);
      }
    },
    linkCurrentLocalData: () => performChoice('move'),
    startSeparately: () => performChoice('keep_separate'),
    async retryIdentityTransition() {
      if (transitionTask) return transitionTask;
      if (!adapter || !await accountIdentity.getPendingLifecycleTransition()) return useRecoveryState();
      const expectedGeneration = beginAuthenticationOperation();
      try {
        const restored = await providerOperation('restoreSession', undefined, expectedGeneration);
        if (!operationIsCurrent(expectedGeneration)) return state;
        if (!restored) return useRecoveryState();
        return await settleAuthenticatedIdentity(restored, null, expectedGeneration);
      } catch { return useRecoveryState(); }
    },
    async updateDisplayName(value) {
      if (state.status !== 'signed_in' || !currentProviderIdentity || !profiles) {
        throw new RangeError('A signed-in Account Profile is required');
      }
      const expectedGeneration = authenticationGeneration;
      const lifecycleScope = await accountIdentity.captureLifecycleScope?.();
      const displayName = normalizeRiverlineDisplayName(value);
      const profile = await profiles.updateDisplayName(currentProviderIdentity, displayName);
      if (!operationIsCurrent(expectedGeneration)
        || state.status !== 'signed_in'
        || (lifecycleScope && !accountIdentity.isCurrentLifecycleScope(lifecycleScope))) {
        return state;
      }
      await accountIdentity.setDisplayName(profile.displayName);
      if (!operationIsCurrent(expectedGeneration)
        || state.status !== 'signed_in'
        || (lifecycleScope && !accountIdentity.isCurrentLifecycleScope(lifecycleScope))) {
        return state;
      }
      currentProfile = profile;
      return publish({ profile, noticeCode: 'display_name_saved' });
    },
    async cancelPendingAuthentication() {
      if (transitionTask) return signOut();
      beginAuthenticationOperation();
      try { await activateDeviceGuest.call(accountIdentity, 'authentication_cancelled'); }
      catch { return useRecoveryState(); }
      useGuestState('authentication_cancelled');
      try { await (adapter ? providerOperation('signOut') : null); } catch { publish({ noticeCode: 'signout_incomplete' }); }
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
