import './authentication-bootstrap.mjs';
import { createRangeCalibrationLifecycle } from './range-calibration-lifecycle.mjs';

let installedLifecycle = null;

function translated(browserWindow, key) {
  return browserWindow.t?.(key) ?? key;
}

function createRangeCalibrationSurface(browserWindow, options = {}) {
  const document = browserWindow.document;
  const loadWorkspaceModule = options.loadWorkspaceModule
    ?? (() => import('./range-calibration-workspace.mjs'));
  let loadedWorkspaceModule = null;

  function ensureShell() {
    const mount = document.querySelector('#rangeCalibrationMount');
    const template = document.querySelector('#rangeCalibrationTemplate');
    if (!mount || !template) throw new Error('Range Calibration workspace template is unavailable');
    if (!mount.firstElementChild) mount.append(template.content.cloneNode(true));
    browserWindow.RiverlineI18n?.translateNode?.(mount);
    return document.querySelector('#rangeCalibrationWorkspace');
  }

  function setState(nextState) {
    const root = ensureShell();
    root.dataset.calibrationState = nextState;
    root.setAttribute('aria-busy', String(nextState === 'loading'));
    const states = {
      loading: '#calibrationLoadingState',
      guest: '#calibrationGuestState',
      error: '#calibrationErrorState',
      empty: '#calibrationEmptyState',
      configured: '#calibrationConfiguredState',
    };
    for (const [state, selector] of Object.entries(states)) {
      const element = document.querySelector(selector);
      if (element) element.hidden = state !== nextState;
    }
    return root;
  }

  return Object.freeze({
    showLoading() {
      setState('loading');
    },
    showGuest() {
      setState('guest');
    },
    showError(error) {
      const root = ensureShell();
      const workspaceAlreadyRenderedError = root.dataset.calibrationState === 'error';
      setState('error');
      if (!workspaceAlreadyRenderedError) {
        const message = document.querySelector('#calibrationErrorMessage');
        if (message) message.textContent = translated(
          browserWindow,
          error?.code === 'identity_unavailable'
            ? 'Your account identity is still becoming available. Try again.'
            : 'Your stored data was left untouched. Try reopening this workspace.',
        );
      }
    },
    async mountAuthenticated() {
      loadedWorkspaceModule ??= await loadWorkspaceModule();
      return loadedWorkspaceModule.mountRangeCalibrationWorkspace();
    },
    async disposeAuthenticated() {
      await loadedWorkspaceModule?.disposeRangeCalibrationWorkspace?.();
    },
    getController: () => browserWindow.RiverlineRangeCalibration ?? null,
    ensureShell,
  });
}

export function installRangeCalibrationBootstrap(browserWindow, options = {}) {
  if (!browserWindow?.document) return null;
  if (browserWindow.RiverlineRangeCalibrationLifecycle) {
    return browserWindow.RiverlineRangeCalibrationLifecycle;
  }
  const authentication = options.authentication ?? browserWindow.RiverlineAuthentication;
  const accountIdentity = options.accountIdentity ?? browserWindow.RiverlineAccountIdentity;
  const surface = options.surface ?? createRangeCalibrationSurface(browserWindow, options);
  const document = browserWindow.document;
  const mount = document.querySelector('#rangeCalibrationMount');
  const navigationButton = document.querySelector('.mode-nav-item[data-mode="calibration"]');
  const lifecycle = createRangeCalibrationLifecycle({
    authentication,
    accountIdentity,
    surface,
    eventTarget: browserWindow,
    navigationButton,
    isSelected: options.isSelected ?? (() => (
      document.querySelector('.riverline-shell')?.dataset.activeMode === 'calibration'
    )),
  });

  mount?.addEventListener('click', (event) => {
    if (event.target.closest('#calibrationRetry')) {
      void lifecycle.retry().catch(() => {});
      return;
    }
    if (event.target.closest('[data-calibration-account-action]')) {
      browserWindow.RiverlineAuthentication?.openAccount?.();
    }
  });

  Object.defineProperty(browserWindow, 'RiverlineRangeCalibrationLifecycle', {
    configurable: true,
    enumerable: false,
    value: lifecycle,
    writable: false,
  });
  lifecycle.start();
  return lifecycle;
}

export function activateRangeCalibrationWorkspace() {
  return installedLifecycle?.activate() ?? Promise.resolve(null);
}

export function remountRangeCalibrationWorkspaceForIdentityChange() {
  return installedLifecycle?.identityChanged() ?? Promise.resolve(null);
}

if (typeof window !== 'undefined') {
  installedLifecycle = installRangeCalibrationBootstrap(window);
}
