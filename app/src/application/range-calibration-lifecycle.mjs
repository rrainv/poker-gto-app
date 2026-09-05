import { RIVERLINE_OWNED_DOMAINS } from '../account-identity/domain.mjs';
export const RANGE_CALIBRATION_LIFECYCLE_STATE_SCHEMA_VERSION = 'range-calibration-lifecycle-state/v1';

const PENDING_AUTH_STATUSES = new Set(['initializing', 'authenticating', 'linking', 'transitioning']);

function frozenState(changes = {}) {
  return Object.freeze({
    schemaVersion: RANGE_CALIBRATION_LIFECYCLE_STATE_SCHEMA_VERSION,
    status: 'unmounted',
    identityId: null,
    errorCode: null,
    ...changes,
  });
}

function requireMethod(target, method, label) {
  if (typeof target?.[method] !== 'function') {
    throw new TypeError(`Range Calibration lifecycle requires ${label}.${method}()`);
  }
}

export function createRangeCalibrationLifecycle({
  authentication,
  accountIdentity,
  surface,
  eventTarget = null,
  navigationButton = null,
  isSelected = () => true,
} = {}) {
  for (const method of ['ready', 'getState']) requireMethod(authentication, method, 'authentication');
  requireMethod(accountIdentity, 'getActiveIdentityId', 'accountIdentity');
  for (const method of [
    'showLoading', 'showGuest', 'showError', 'mountAuthenticated', 'disposeAuthenticated',
  ]) requireMethod(surface, method, 'surface');
  if (typeof isSelected !== 'function') throw new TypeError('Range Calibration lifecycle requires isSelected()');

  let state = frozenState();
  let activeIdentityId = null;
  let activeScope = null;
  let surfaceKind = 'unmounted';
  let requestVersion = 0;
  let queue = Promise.resolve(null);
  let started = false;
  let unsubscribeIdentity = null;

  function publish(changes) {
    state = frozenState({ ...state, ...changes });
    return state;
  }

  function showLoading() {
    surface.showLoading();
    publish({ status: 'loading', errorCode: null });
  }

  async function applyRequest(version, { force = false } = {}) {
    try {
      await authentication.ready();
      if (version !== requestVersion) return null;

      const authState = authentication.getState();
      if (PENDING_AUTH_STATUSES.has(authState?.status)) {
        showLoading();
        return null;
      }

      if (!accountIdentity.captureLifecycleScope && authState?.status !== 'signed_in') {
        if (surfaceKind === 'authenticated') await surface.disposeAuthenticated();
        if (version !== requestVersion) return null;
        activeIdentityId = null;
        surfaceKind = 'guest';
        surface.showGuest();
        publish({ status: 'guest', identityId: null, errorCode: null });
        return null;
      }

      const lifecycleScope = accountIdentity.captureLifecycleScope
        ? await accountIdentity.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY) : null;
      const identityId = lifecycleScope?.identityId ?? await accountIdentity.getActiveIdentityId();
      const status = lifecycleScope?.identityKind === 'device_guest' ? 'guest' : 'authenticated';
      if (version !== requestVersion) return null;
      if (typeof identityId !== 'string' || !identityId.trim()) {
        const error = new RangeError('The authenticated Riverline identity is unavailable');
        error.code = 'identity_unavailable';
        throw error;
      }

      if (!force && surfaceKind === 'authenticated' && activeIdentityId === identityId
        && (!activeScope || activeScope.isCurrent())) {
        publish({ status, identityId, errorCode: null });
        return surface.getController?.() ?? null;
      }

      showLoading();
      if (surfaceKind === 'authenticated') await surface.disposeAuthenticated();
      if (version !== requestVersion) return null;
      const controller = await surface.mountAuthenticated({
        identityId,
        lifecycleScope,
        previousIdentityId: activeIdentityId,
      });
      if (version !== requestVersion) {
        await surface.disposeAuthenticated();
        return null;
      }
      lifecycleScope?.assertCurrent();
      activeScope = lifecycleScope;
      activeIdentityId = identityId;
      surfaceKind = 'authenticated';
      publish({ status, identityId, errorCode: null });
      return controller;
    } catch (error) {
      if (version === requestVersion) {
        activeIdentityId = null;
        surfaceKind = 'error';
        surface.showError(error);
        publish({ status: 'error', identityId: null, errorCode: error?.code ?? 'load_failed' });
      }
      throw error;
    }
  }

  function reconcile({ force = false } = {}) {
    const version = ++requestVersion;
    if (isSelected() && (force || surfaceKind !== 'authenticated')) showLoading();
    const task = queue.catch(() => null).then(() => applyRequest(version, { force }));
    queue = task;
    return task;
  }

  function revokeAuthenticatedPresentation() {
    requestVersion += 1;
    const disposal = surfaceKind === 'authenticated'
      ? Promise.resolve(surface.disposeAuthenticated())
      : Promise.resolve();
    activeIdentityId = null;
    activeScope = null;
    surfaceKind = 'guest';
    surface.showGuest();
    publish({ status: 'guest', identityId: null, errorCode: null });
    const task = Promise.all([queue.catch(() => null), disposal]).then(() => null);
    queue = task;
    return task;
  }

  function onAuthenticationChange() {
    if (accountIdentity.captureLifecycleScope) {
      const hadWorkspace = surfaceKind === 'authenticated';
      void revokeAuthenticatedPresentation().then(() => {
        if (isSelected() || hadWorkspace) return reconcile();
        return null;
      }).catch(() => {});
      return;
    }
    if (authentication.getState()?.status === 'guest'
      || authentication.getState()?.status === 'recovery_required') {
      void revokeAuthenticatedPresentation().catch(() => {});
      return;
    }
    if (isSelected() || surfaceKind === 'authenticated') void reconcile().catch(() => {});
  }

  function onIdentityChange(event) {
    if (event?.detail?.reason === 'display_name_changed') return;
    if (accountIdentity.captureLifecycleScope) {
      const hadWorkspace = surfaceKind === 'authenticated';
      void revokeAuthenticatedPresentation().then(() => {
        if (['guest_active', 'account_active'].includes(accountIdentity.getLifecycleState().status)
          && (isSelected() || hadWorkspace)) return reconcile();
        return null;
      }).catch(() => {});
      return;
    }
    if (event?.detail?.reason === 'account_access_revoked'
      || event?.detail?.lifecycleStatus === 'recovery_required') {
      void revokeAuthenticatedPresentation().catch(() => {});
      return;
    }
    if (authentication.getState()?.status !== 'signed_in') return;
    if (isSelected() || surfaceKind === 'authenticated') void reconcile({ force: true }).catch(() => {});
  }

  function onRemoteStrategyChange() {
    if (authentication.getState()?.status !== 'signed_in') return;
    if (isSelected() || surfaceKind === 'authenticated') void reconcile({ force: true }).catch(() => {});
  }

  function start() {
    if (started) return false;
    started = true;
    unsubscribeIdentity = accountIdentity.captureLifecycleScope ? accountIdentity.subscribe?.((event) => {
      onIdentityChange({ detail: event });
    }) : null;
    navigationButton?.addEventListener?.('click', onNavigation);
    eventTarget?.addEventListener?.('riverline:authchange', onAuthenticationChange);
    if (!unsubscribeIdentity) eventTarget?.addEventListener?.('riverline:identitychange', onIdentityChange);
    eventTarget?.addEventListener?.('riverline:personalstrategychange', onRemoteStrategyChange);
    if (isSelected()) void reconcile().catch(() => {});
    return true;
  }

  function onNavigation() {
    void reconcile().catch(() => {});
  }

  return Object.freeze({
    schemaVersion: 'range-calibration-lifecycle/v1',
    activate: () => reconcile(),
    retry: () => reconcile({ force: true }),
    identityChanged: () => reconcile({ force: true }),
    start,
    stop() {
      if (!started) return false;
      started = false;
      unsubscribeIdentity?.();
      unsubscribeIdentity = null;
      navigationButton?.removeEventListener?.('click', onNavigation);
      eventTarget?.removeEventListener?.('riverline:authchange', onAuthenticationChange);
      eventTarget?.removeEventListener?.('riverline:identitychange', onIdentityChange);
      eventTarget?.removeEventListener?.('riverline:personalstrategychange', onRemoteStrategyChange);
      return true;
    },
    getState: () => state,
  });
}
