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

export const ACCOUNT_PROFILE_SUMMARY_SCHEMA_VERSION = 'riverline-account-profile-summary/v2';
export const IDENTITY_LIFECYCLE_STATE_SCHEMA_VERSION = 'riverline-identity-lifecycle-state/v1';
export const IDENTITY_LIFECYCLE_SCOPE_SCHEMA_VERSION = 'riverline-identity-lifecycle-scope/v1';

export class IdentityLifecycleScopeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'IdentityLifecycleScopeError';
    this.code = code;
  }
}

function legacyOwnersFromStorage(storage) {
  return {
    [RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS]: storage.getItem(LEGACY_SAVED_STUDY_OWNER_KEY),
    [RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY]: storage.getItem(LEGACY_PERSONAL_STRATEGY_OWNER_KEY),
  };
}

function frozenLifecycleState(changes = {}) {
  return Object.freeze({
    schemaVersion: IDENTITY_LIFECYCLE_STATE_SCHEMA_VERSION,
    status: 'initializing',
    identityId: null,
    identityKind: null,
    lifecycleGeneration: 0,
    pendingTransitionId: null,
    errorCode: null,
    ...changes,
  });
}

function recoveryFailure(state) {
  return new IdentityLifecycleScopeError(
    state.errorCode ?? 'recovery_required',
    'Riverline identity ownership requires recovery before local profile data can be accessed.',
  );
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
  let initializationPromise = null;
  let registryState = null;
  let lifecycleState = frozenLifecycleState();
  let lifecycleController = new AbortController();
  let transitionEpoch = 0;
  let transitionQueue = Promise.resolve();

  function notify(reason, identity = null) {
    const event = Object.freeze({ reason, identity, lifecycle: lifecycleState });
    for (const listener of listeners) listener(event);
  }

  function invalidateScope() {
    lifecycleController.abort();
    lifecycleController = new AbortController();
  }

  function publishActive(state, reason, { minimumGeneration = 0 } = {}) {
    registryState = state;
    const identity = state.activeIdentity;
    const generation = Math.max(
      state.metadata.lifecycleGeneration,
      lifecycleState.lifecycleGeneration,
      minimumGeneration,
    );
    const changed = lifecycleState.identityId !== identity.identityId
      || lifecycleState.identityKind !== identity.kind
      || lifecycleState.lifecycleGeneration !== generation
      || !['guest_active', 'account_active'].includes(lifecycleState.status);
    if (changed) invalidateScope();
    lifecycleState = frozenLifecycleState({
      status: identity.kind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST
        ? 'guest_active'
        : 'account_active',
      identityId: identity.identityId,
      identityKind: identity.kind,
      lifecycleGeneration: generation,
      pendingTransitionId: state.metadata.pendingTransitionId,
      errorCode: null,
    });
    notify(reason, identity);
    return identity;
  }

  function publishTransition(identity, reason) {
    transitionEpoch += 1;
    invalidateScope();
    lifecycleState = frozenLifecycleState({
      status: 'transitioning',
      identityId: identity?.identityId ?? null,
      identityKind: identity?.kind ?? null,
      lifecycleGeneration: lifecycleState.lifecycleGeneration + 1,
      pendingTransitionId: null,
      errorCode: null,
    });
    notify(reason, identity);
    return Object.freeze({ epoch: transitionEpoch, generation: lifecycleState.lifecycleGeneration });
  }

  function publishRecovery(error, reason = 'recovery_required') {
    transitionEpoch += 1;
    invalidateScope();
    lifecycleState = frozenLifecycleState({
      status: 'recovery_required',
      lifecycleGeneration: lifecycleState.lifecycleGeneration + 1,
      errorCode: error?.code ?? 'recovery_required',
    });
    notify(reason, null);
    return lifecycleState;
  }

  function enqueue(operation) {
    const task = transitionQueue.catch(() => null).then(operation);
    transitionQueue = task.catch(() => null);
    return task;
  }

  function deviceGuestFromState(state = registryState) {
    return state?.identities?.find((identity) => (
      identity.identityId === state.metadata.deviceGuestIdentityId
        && identity.kind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST
    )) ?? null;
  }

  function ensureAvailable() {
    if (lifecycleState.status === 'recovery_required') throw recoveryFailure(lifecycleState);
    if (!['guest_active', 'account_active'].includes(lifecycleState.status)) {
      throw new IdentityLifecycleScopeError(
        'identity_transition_in_progress',
        'Riverline identity ownership is changing. Try again after the transition completes.',
      );
    }
  }

  async function initialize() {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      try {
        let state = await durableRepository.initialize();
        if (state.status === 'recovery_required') {
          registryState = state;
          publishRecovery({ code: state.recovery.code });
          return state;
        }
        if (state.metadata.pendingTransitionId) {
          registryState = state;
          publishRecovery({ code: 'identity_transition_pending' });
          return state;
        }
        if (state.activeIdentity.identityId !== state.metadata.deviceGuestIdentityId) {
          const activation = await durableRepository.activateDeviceGuest({
            minimumLifecycleGeneration: state.metadata.lifecycleGeneration + 1,
          });
          state = activation.state;
        }
        publishActive(state, 'device_guest_initialized');
        return state;
      } catch (error) {
        publishRecovery(error);
        return Object.freeze({
          status: 'recovery_required',
          activeIdentity: null,
          recovery: Object.freeze({
            code: error?.code ?? 'identity_storage_unavailable',
            message: error?.message ?? 'Local identity storage is unavailable.',
          }),
        });
      }
    })();
    return initializationPromise;
  }

  async function getActiveIdentity() {
    await initialize();
    ensureAvailable();
    return registryState.identities.find((identity) => identity.identityId === lifecycleState.identityId);
  }

  function scopeIsCurrent(scope) {
    return Boolean(scope)
      && scope.schemaVersion === IDENTITY_LIFECYCLE_SCOPE_SCHEMA_VERSION
      && !scope.signal.aborted
      && ['guest_active', 'account_active'].includes(lifecycleState.status)
      && scope.identityId === lifecycleState.identityId
      && scope.identityKind === lifecycleState.identityKind
      && scope.lifecycleGeneration === lifecycleState.lifecycleGeneration;
  }

  function assertCurrentScope(scope) {
    if (!scopeIsCurrent(scope)) {
      throw new IdentityLifecycleScopeError(
        'identity_lifecycle_scope_stale',
        'The identity lifecycle scope is stale and cannot adopt this result.',
      );
    }
    return scope;
  }

  async function captureLifecycleScope(domain = null) {
    const requestedState = lifecycleState;
    await initialize();
    if (requestedState.status !== 'initializing' && requestedState !== lifecycleState
      && (requestedState.lifecycleGeneration !== lifecycleState.lifecycleGeneration
        || requestedState.status !== lifecycleState.status)) {
      throw new IdentityLifecycleScopeError('identity_lifecycle_scope_stale', 'The requested identity changed.');
    }
    ensureAvailable();
    const identityId = lifecycleState.identityId;
    const identityKind = lifecycleState.identityKind;
    const lifecycleGeneration = lifecycleState.lifecycleGeneration;
    const signal = lifecycleController.signal;
    const binding = domain === null
      ? null
      : await durableRepository.getDomainOwnership(domain, identityId);
    const scope = Object.freeze({
      schemaVersion: IDENTITY_LIFECYCLE_SCOPE_SCHEMA_VERSION,
      identityId,
      identityKind,
      lifecycleGeneration,
      domainOwnerBinding: binding,
      signal,
      isCurrent: () => scopeIsCurrent(scope),
      assertCurrent: () => assertCurrentScope(scope),
      adopt(callback) {
        if (typeof callback !== 'function') {
          throw new TypeError('Identity lifecycle adoption callback must be a function');
        }
        if (!scopeIsCurrent(scope)) return false;
        callback();
        return true;
      },
    });
    return assertCurrentScope(scope);
  }

  function activateDeviceGuest(reason = 'device_guest_activated') {
    if (!registryState) return initialize().then(() => activateDeviceGuest(reason));
    if (lifecycleState.status === 'recovery_required') {
      return Promise.reject(recoveryFailure(lifecycleState));
    }
    const guest = deviceGuestFromState();
    if (!guest) {
      publishRecovery({ code: 'device_guest_missing' });
      return Promise.reject(recoveryFailure(lifecycleState));
    }
    if (lifecycleState.status === 'guest_active' && lifecycleState.identityId === guest.identityId) {
      return Promise.resolve(guest);
    }
    const transition = publishTransition(guest, 'account_access_revoked');
    return (async () => {
      try {
        const activation = await enqueue(() => durableRepository.activateDeviceGuest({
          minimumLifecycleGeneration: transition.generation,
        }));
        if (transition.epoch === transitionEpoch) {
          publishActive(activation.state, reason, { minimumGeneration: transition.generation });
        }
        return activation.identity;
      } catch (error) {
        if (transition.epoch === transitionEpoch) publishRecovery(error);
        throw error;
      }
    })();
  }

  async function runAuthenticatedTransition({ targetIdentityId = null, operation, reason }) {
    await initialize();
    ensureAvailable();
    if (lifecycleState.status === 'account_active'
      && (!targetIdentityId || lifecycleState.identityId !== targetIdentityId)) {
      throw new IdentityLifecycleScopeError(
        'direct_account_switch_forbidden',
        'Switching accounts requires returning to Device Guest first.',
      );
    }
    if (lifecycleState.status === 'account_active' && lifecycleState.identityId === targetIdentityId) {
      const result = await enqueue(() => operation(lifecycleState.lifecycleGeneration));
      if (result?.state) registryState = result.state;
      return result;
    }
    const guestBefore = deviceGuestFromState();
    const stateBefore = registryState;
    const transition = publishTransition(null, reason);
    try {
      const result = await enqueue(() => operation(transition.generation));
      if (!result) {
        if (transition.epoch === transitionEpoch) {
          publishActive(stateBefore, 'device_guest_restored', {
            minimumGeneration: transition.generation,
          });
        }
        return null;
      }
      const state = result.state ?? await durableRepository.getSnapshot();
      if (transition.epoch === transitionEpoch) {
        publishActive(state, reason, { minimumGeneration: transition.generation });
      }
      return result;
    } catch (error) {
      if (transition.epoch === transitionEpoch) {
        if (error?.code === 'recovery_required' || reason === 'provider_session_activated' || !guestBefore) publishRecovery(error);
        else publishActive(stateBefore, 'device_guest_restored', {
          minimumGeneration: transition.generation,
        });
      }
      throw error;
    }
  }

  async function setDisplayName(value) {
    const scope = await captureLifecycleScope();
    const identity = await durableRepository.setDisplayName(
      normalizeRiverlineDisplayName(value),
      scope.identityId,
    );
    if (registryState?.status === 'ready') {
      registryState = await durableRepository.getSnapshot();
      if (scopeIsCurrent(scope)) notify('display_name_changed', identity);
    }
    return identity;
  }

  const service = {
    repository: durableRepository,
    requireRecovery: (error) => publishRecovery(error),
    async getPendingLifecycleTransition() {
      await initialize();
      try {
        const snapshot = await durableRepository.getSnapshot();
        if (snapshot.status !== 'ready') throw recoveryFailure(lifecycleState);
        return snapshot.lifecycleTransitions.find((entry) => entry.transitionId === snapshot.metadata.pendingTransitionId) ?? null;
      } catch (error) { publishRecovery(error); throw error; }
    },
    async runFirstSignInTransition(providerIdentity, { choice, scope = null, displayName, resume = false, bindRemote, guard = () => {} } = {}) {
      if (!registryState) await initialize();
      let entry;
      if (resume) entry = await service.getPendingLifecycleTransition();
      else { assertCurrentScope(scope); ensureAvailable(); }
      if (resume && !entry) throw recoveryFailure(lifecycleState);
      const transition = publishTransition(null, 'first_sign_in_transition');
      const assertTransition = () => {
        guard();
        if (transition.epoch !== transitionEpoch) throw recoveryFailure(lifecycleState);
      };
      try {
        if (!entry) entry = await enqueue(() => durableRepository.prepareLifecycleTransition(providerIdentity, {
          choice, guestIdentityId: scope.identityId, displayName, minimumLifecycleGeneration: transition.generation, expectedRegistryGeneration: registryState.metadata.lifecycleGeneration,
        }));
        assertTransition();
        // Validation occurs before marking the potentially ambiguous remote request.
        const remoteIdentityId = await bindRemote(entry, async () => {
          assertTransition();
          entry = await durableRepository.updateLifecycleTransition(entry.transitionId, 'binding_remote');
          assertTransition();
        });
        assertTransition();
        if (entry.phase !== 'remote_bound') entry = await durableRepository.updateLifecycleTransition(entry.transitionId, 'remote_bound');
        assertTransition();
        const result = await enqueue(() => durableRepository.finalizeLifecycleTransition(entry.transitionId, providerIdentity, { remoteIdentityId, guard: assertTransition, signal: lifecycleController.signal }));
        assertTransition();
        publishActive(result.state, 'first_sign_in_finalized', { minimumGeneration: transition.generation });
        return result;
      } catch (error) {
        if (entry?.phase === 'prepared' && error?.code !== 'profile_identity_conflict') {
          try {
            await durableRepository.updateLifecycleTransition(entry.transitionId, 'cancelled');
            const snapshot = await durableRepository.getSnapshot();
            publishActive(snapshot, 'first_sign_in_cancelled', { minimumGeneration: transition.generation });
          } catch { publishRecovery(error); }
        } else if (entry) {
          // Cancellation can arrive just after a successful local commit. The
          // completed account remains bound; return to its designated Guest.
          let completed = false;
          try {
            const snapshot = await durableRepository.getSnapshot();
            completed = snapshot.lifecycleTransitions?.some((value) => value.transitionId === entry.transitionId && value.phase === 'locally_finalized') && !snapshot.metadata.pendingTransitionId;
            if (completed) {
              const guest = await durableRepository.activateDeviceGuest({ minimumLifecycleGeneration: lifecycleState.lifecycleGeneration });
              publishActive(guest.state, 'first_sign_in_cancelled');
            }
          } catch { completed = false; /* uncertain storage remains recovery-only */ }
          if (!completed) {
            try { await durableRepository.updateLifecycleTransition(entry.transitionId, 'recovery_required'); } catch { /* preserve the durable phase */ }
            publishRecovery(error);
          }

        } else if (transition.epoch === transitionEpoch) {
          try {
            const snapshot = await durableRepository.getSnapshot();
            if (snapshot.status === 'ready' && !snapshot.metadata.pendingTransitionId) publishActive(snapshot, 'first_sign_in_cancelled', { minimumGeneration: transition.generation });
            else publishRecovery(error);
          } catch { publishRecovery(error); }
        }
        throw error;
      }
    },

    initialize,
    async ensureDeviceGuestIdentity() {
      await initialize();
      const guest = deviceGuestFromState();
      if (!guest) throw recoveryFailure(lifecycleState);
      return guest;
    },
    // Kept for current internal callers until Slice B/C rename their flow.
    ensureLocalIdentity: () => service.ensureDeviceGuestIdentity(),
    getActiveIdentity,
    async getActiveIdentityId() {
      return (await getActiveIdentity()).identityId;
    },
    getLifecycleState: () => lifecycleState,
    captureLifecycleScope,
    isCurrentLifecycleScope: scopeIsCurrent,
    assertCurrentLifecycleScope: assertCurrentScope,
    async getDomainOwnership(domain) {
      return (await captureLifecycleScope(domain)).domainOwnerBinding;
    },
    async getProfileSummary() {
      const identity = await getActiveIdentity();
      return Object.freeze({
        schemaVersion: ACCOUNT_PROFILE_SUMMARY_SCHEMA_VERSION,
        identityId: identity.identityId,
        kind: identity.kind,
        displayName: identity.displayName,
        ownershipRef: riverlineOwnershipRefForIdentity(identity),
        status: identity.kind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST ? 'guest' : 'signed_in',
        storage: 'on_this_device',
        syncEnabled: false,
      });
    },
    setDisplayName,
    listKnownIdentities: () => durableRepository.listKnownIdentities(),
    reserveIdentityId: () => durableRepository.reserveIdentityId(),
    async getProviderIdentityMapping(providerIdentity) {
      try { return await durableRepository.getProviderIdentityMapping(providerIdentity); }
      catch (error) { publishRecovery(error); throw error; }
    },
    async activateProviderIdentity(providerIdentity) {
      const mapping = await durableRepository.getProviderIdentityMapping(providerIdentity);
      if (!mapping) return null;
      return runAuthenticatedTransition({
        targetIdentityId: mapping.riverlineIdentityId,
        reason: 'provider_session_activated',
        operation: (minimumLifecycleGeneration) => durableRepository.activateProviderIdentity(
          providerIdentity,
          { minimumLifecycleGeneration },
        ),
      });
    },
    linkProviderIdentityToLocal: (providerIdentity, options = {}) => runAuthenticatedTransition({
      targetIdentityId: options.localIdentityId ?? null,
      reason: 'local_profile_linked',
      operation: (minimumLifecycleGeneration) => durableRepository.linkProviderIdentityToLocal(
        providerIdentity,
        { ...options, minimumLifecycleGeneration },
      ),
    }),
    startProviderIdentitySeparately: (providerIdentity, options = {}) => runAuthenticatedTransition({
      reason: 'authenticated_profile_started',
      operation: (minimumLifecycleGeneration) => durableRepository.startProviderIdentitySeparately(
        providerIdentity,
        { ...options, minimumLifecycleGeneration },
      ),
    }),
    activateDeviceGuest,
    // Compatibility alias for the pre-lifecycle authenticated claim path.
    activateLocalIdentity: () => activateDeviceGuest('device_guest_activated'),
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Account identity listener must be a function');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      transitionEpoch += 1;
      invalidateScope();
      await durableRepository.close();
      initializationPromise = null;
      registryState = null;
      lifecycleState = frozenLifecycleState({
        lifecycleGeneration: lifecycleState.lifecycleGeneration + 1,
      });
    },
  };

  return Object.freeze(service);
}
