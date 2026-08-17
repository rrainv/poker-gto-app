export const RANGE_CALIBRATION_LIFECYCLE_STATE_SCHEMA_VERSION = 'range-calibration-lifecycle-state/v1';

const PENDING_AUTH_STATUSES = new Set(['initializing', 'authenticating', 'linking']);

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
  let surfaceKind = 'unmounted';
  let requestVersion = 0;
  let queue = Promise.resolve(null);
  let started = false;

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

      if (authState?.status !== 'signed_in') {
        if (surfaceKind === 'authenticated') await surface.disposeAuthenticated();
        if (version !== requestVersion) return null;
        activeIdentityId = null;
        surfaceKind = 'guest';
        surface.showGuest();
        publish({ status: 'guest', identityId: null, errorCode: null });
        return null;
      }

      const identityId = await accountIdentity.getActiveIdentityId();
      if (version !== requestVersion) return null;
      if (typeof identityId !== 'string' || !identityId.trim()) {
        const error = new RangeError('The authenticated Riverline identity is unavailable');
        error.code = 'identity_unavailable';
        throw error;
      }

      if (!force && surfaceKind === 'authenticated' && activeIdentityId === identityId) {
        publish({ status: 'authenticated', identityId, errorCode: null });
        return surface.getController?.() ?? null;
      }

      showLoading();
      if (surfaceKind === 'authenticated') await surface.disposeAuthenticated();
      if (version !== requestVersion) return null;
      const controller = await surface.mountAuthenticated({
        identityId,
        previousIdentityId: activeIdentityId,
      });
      if (version !== requestVersion) {
        await surface.disposeAuthenticated();
        return null;
      }
      activeIdentityId = identityId;
      surfaceKind = 'authenticated';
      publish({ status: 'authenticated', identityId, errorCode: null });
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
    if (isSelected()) showLoading();
    const task = queue.catch(() => null).then(() => applyRequest(version, { force }));
    queue = task;
    return task;
  }

  function onAuthenticationChange() {
    if (isSelected() || surfaceKind === 'authenticated') void reconcile().catch(() => {});
  }

  function onIdentityChange(event) {
    if (event?.detail?.reason === 'display_name_changed') return;
    if (authentication.getState()?.status !== 'signed_in') return;
    if (isSelected() || surfaceKind === 'authenticated') void reconcile({ force: true }).catch(() => {});
  }

  function start() {
    if (started) return false;
    started = true;
    navigationButton?.addEventListener?.('click', onNavigation);
    eventTarget?.addEventListener?.('riverline:authchange', onAuthenticationChange);
    eventTarget?.addEventListener?.('riverline:identitychange', onIdentityChange);
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
      navigationButton?.removeEventListener?.('click', onNavigation);
      eventTarget?.removeEventListener?.('riverline:authchange', onAuthenticationChange);
      eventTarget?.removeEventListener?.('riverline:identitychange', onIdentityChange);
      return true;
    },
    getState: () => state,
  });
}
