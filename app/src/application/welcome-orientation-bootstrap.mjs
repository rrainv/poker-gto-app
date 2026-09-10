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
  let suspendedPresentation = null;

  function suspendBackground() {
    if (suspendedPresentation) return;
    const background = [];
    // The existing surface lives inside the shell; inert only its siblings.
    for (let node = surface; node?.parentElement; node = node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling !== node) { background.push([sibling, sibling.inert]); sibling.inert = true; }
      }
    }
    suspendedPresentation = { background, x: browserWindow.scrollX, y: browserWindow.scrollY,
      overflow: document.body.style.overflow, rootOverflow: root.style.overflow };
    document.body.style.overflow = root.style.overflow = 'hidden';
    surface.setAttribute('role', 'dialog');
    surface.setAttribute('aria-modal', 'true');
    surface.scrollTop = 0;
  }

  function restoreBackground() {
    if (!suspendedPresentation) return;
    const saved = suspendedPresentation; suspendedPresentation = null;
    for (const [node, inert] of saved.background) node.inert = inert;
    document.body.style.overflow = saved.overflow;
    root.style.overflow = saved.rootOverflow;
    surface.removeAttribute('role'); surface.removeAttribute('aria-modal');
    browserWindow.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
  }

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
    restoreBackground();
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
    if (session.getState().visible) return true;
    if (manual) browserWindow.RiverlineTutorials?.cancelForOverlay?.();
    invoker = invokingControl;
    session.open({ manual });
    surface.hidden = false;
    surface.removeAttribute('aria-hidden');
    surface.dataset.entryKind = manual ? 'manual' : 'startup';
    root.dataset.welcomeOrientation = 'visible';
    clearNavigationSelection();
    if (manual) suspendBackground();
    if (remember) {
      remember.checked = false;
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
    if (event.key === 'Tab' && session.getState().entryKind === 'manual') {
      const controls = [...surface.querySelectorAll('button, input, a[href], [tabindex]')]
        .filter(node => !node.disabled && !node.hidden && node.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surface)) {
        event.preventDefault(); last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus({ preventScroll: true });
      }
      return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (session.getState().entryKind === 'manual') {
      session.closeManual();
      hideSurface({ restoreFocus: true, restoreNavigation: true });
    } else {
      session.dismiss({ remember: remember?.checked !== false });
      findNavigationControl('home')?.focus?.({ preventScroll: true });
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
