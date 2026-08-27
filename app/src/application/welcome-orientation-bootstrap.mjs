import {
  createWelcomeOrientationPreference,
  createWelcomeOrientationSession,
} from './welcome-orientation.mjs';

export function installWelcomeOrientation(browserWindow, options = {}) {
  if (!browserWindow?.document) return null;
  const { document } = browserWindow;
  const root = document.documentElement;
  const surface = document.querySelector('#welcomeOrientation');
  const shell = document.querySelector('.riverline-shell');
  if (!surface || !shell) return null;

  const preference = options.preference ?? createWelcomeOrientationPreference({
    storage: options.storage ?? browserWindow.localStorage,
  });
  const remember = surface.querySelector('#welcomeRememberChoice');
  const closeButton = surface.querySelector('#welcomeCloseButton');
  const manualNote = surface.querySelector('#welcomeManualNote');
  const learnButton = document.querySelector('#workspaceLearnButton');
  let invoker = null;
  let suspendedNavigation = null;

  const findNavigationControl = (destination) => [...document.querySelectorAll('.mode-nav-item[data-navigation-id]')]
    .find((control) => control.dataset.navigationId === destination) ?? null;

  function clearNavigationSelection() {
    const selected = [...document.querySelectorAll('.mode-nav-item[data-navigation-id]')]
      .find((control) => control.classList.contains('active') || control.getAttribute('aria-current') === 'page') ?? null;
    suspendedNavigation ??= selected;
    document.querySelectorAll('.mode-nav-item[data-navigation-id]').forEach((control) => {
      control.classList.remove('active');
      control.setAttribute('aria-current', 'false');
    });
    shell.dataset.activeMode = 'welcome';
    shell.dataset.activeDestination = 'welcome';
  }

  function restoreNavigationSelection() {
    if (!suspendedNavigation?.isConnected) return;
    suspendedNavigation.classList.add('active');
    suspendedNavigation.setAttribute('aria-current', 'page');
    shell.dataset.activeMode = suspendedNavigation.dataset.mode;
    shell.dataset.activeDestination = suspendedNavigation.dataset.navigationId;
  }

  function hideSurface({ restoreFocus = false, restoreNavigation = false } = {}) {
    surface.hidden = true;
    surface.setAttribute('aria-hidden', 'true');
    root.dataset.welcomeOrientation = 'inactive';
    if (restoreNavigation) restoreNavigationSelection();
    if (restoreFocus) invoker?.focus?.({ preventScroll: true });
    invoker = null;
    suspendedNavigation = null;
  }

  const session = createWelcomeOrientationSession({
    preference,
    navigate(destination) {
      hideSurface();
      const control = findNavigationControl(destination);
      if (control) control.click();
    },
  });

  function open({ manual = false, invokingControl = null } = {}) {
    if (manual) browserWindow.RiverlineTutorials?.cancelForOverlay?.();
    invoker = invokingControl;
    session.open({ manual });
    surface.hidden = false;
    surface.removeAttribute('aria-hidden');
    surface.dataset.entryKind = manual ? 'manual' : 'startup';
    root.dataset.welcomeOrientation = 'visible';
    clearNavigationSelection();
    if (remember) {
      remember.checked = true;
      remember.closest('.welcome-preference')?.toggleAttribute('hidden', manual);
    }
    if (manualNote) manualNote.hidden = !manual;
    if (closeButton) closeButton.hidden = !manual;
    browserWindow.requestAnimationFrame(() => {
      (manual ? closeButton : surface)?.focus?.({ preventScroll: true });
    });
    return true;
  }

  surface.querySelectorAll('[data-welcome-destination]').forEach((control) => {
    control.addEventListener('click', () => {
      session.choose(control.dataset.welcomeDestination, {
        remember: remember?.checked !== false,
      });
    });
  });

  closeButton?.addEventListener('click', () => {
    if (session.closeManual()) hideSurface({ restoreFocus: true, restoreNavigation: true });
  });

  learnButton?.addEventListener('click', () => open({ manual: true, invokingControl: learnButton }));

  document.addEventListener('click', (event) => {
    if (session.getState().entryKind !== 'startup' || !session.getState().visible) return;
    const navigationControl = event.target.closest?.('.mode-nav-item[data-navigation-id]');
    if (!navigationControl) return;
    session.leaveForExternalNavigation(navigationControl.dataset.navigationId, {
      remember: remember?.checked !== false,
    });
    hideSurface();
  }, { capture: true });

  surface.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (session.getState().entryKind === 'manual') {
      session.closeManual();
      hideSurface({ restoreFocus: true, restoreNavigation: true });
    } else {
      session.dismiss({ remember: remember?.checked !== false });
    }
  });

  const bridge = Object.freeze({
    schemaVersion: 'welcome-orientation-browser/v1',
    openManual: (control = learnButton) => open({ manual: true, invokingControl: control }),
    getState: () => Object.freeze({
      ...session.getState(),
      preference: preference.getState(),
    }),
    getDiagnostics: () => preference.diagnostics(),
  });
  Object.defineProperty(browserWindow, 'RiverlineWelcome', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });

  if (preference.shouldShowOnStartup()) open({ manual: false });
  else hideSurface();
  return bridge;
}

if (typeof window !== 'undefined') installWelcomeOrientation(window);
