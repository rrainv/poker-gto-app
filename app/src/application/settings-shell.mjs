// SETTINGS-001: the shell side of the Settings workspace. Settings is not a
// dialog: the sidebar gear selects it like a workspace and selects it again to
// go back. This module hides the current view, marks the gear, remembers the
// navigation item to return to and restores that view as it was left (no
// navigation re-runs, no state is rebuilt). It also mounts the workspace
// controller with the app's real preference controllers injected.
//
// window.RiverlineSettings: open(category?), close(), toggle(), leave(),
// isOpen(). `leave()` is for the navigation handler: it drops the Settings
// chrome without choosing a destination.

export const SETTINGS_SHELL_SCHEMA_VERSION = 'settings-shell/v1';

export function createSettingsShell(browserWindow = window, options = {}) {
  const { document } = browserWindow;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const translate = (key, values) => browserWindow.t?.(key, values) ?? key;

  let controller = null;
  let returnItem = null;
  let mountReported = false;

  const isOpen = () => $('.riverline-shell')?.dataset.settingsOpen === 'true';

  function workspace() {
    if (controller) return controller;
    const container = $('#settingsMode');
    const module = browserWindow.RiverlineSettingsWorkspace;
    if (!container || !module) {
      if (!mountReported) {
        mountReported = true;
        options.reportError?.(new Error(!container ? '#settingsMode is missing' : 'RiverlineSettingsWorkspace is missing'));
      }
      return null;
    }
    controller = module.mount(container, {
      translate,
      locale: () => browserWindow.appLang || 'en',
      resolveTranslation: (key, language) => browserWindow.RiverlineI18n?.resolveTranslation?.(key, language),
      theme: () => browserWindow.RiverlinePresentationTheme ?? null,
      cards: () => browserWindow.RiverlineCardPresentation ?? null,
      sound: () => browserWindow.SoundFX ?? null,
      motion: () => browserWindow.RiverlineMotionPreference ?? null,
      language: {
        get: () => browserWindow.appLang || 'en',
        set: (language) => (browserWindow.RiverlineI18n?.setLanguage ?? browserWindow.setLanguage)?.(language),
      },
      // The answer mode belongs to the Training drill's store; its buttons stay
      // in the page, so the same authority is read and driven through them.
      answerMode: {
        get: () => $('[data-answer-mode-option].active')?.dataset.answerModeOption ?? 'select',
        set: (mode) => $(`[data-answer-mode-option="${mode}"]`)?.click(),
      },
      openGuide: () => {
        close({ restoreFocus: false });
        $('.mode-nav-item[data-navigation-id="guide"]')?.click();
      },
      closeSettings: () => close({ restoreFocus: true }),
      scrollContainer: () => document.scrollingElement,
      reportError: options.reportError,
    });
    return controller;
  }

  // Drop the Settings chrome only (view hidden, gear released).
  function leave() {
    if (!isOpen()) return false;
    const shell = $('.riverline-shell');
    if (shell) delete shell.dataset.settingsOpen;
    const gear = $('#openSettings');
    if (gear) {
      gear.classList.remove('is-current');
      gear.removeAttribute('aria-current');
    }
    const view = $('#settingsMode');
    if (view) {
      view.classList.remove('active');
      view.style.display = 'none';
    }
    controller?.setVisible(false);
    return true;
  }

  function open(category = null) {
    const view = $('#settingsMode');
    const shell = $('.riverline-shell');
    if (!view || !shell) return false;
    if (!isOpen()) {
      const current = $('.mode-nav-item.active[data-navigation-id]');
      if (current) returnItem = current;
      $$('.mode-view').forEach((other) => {
        other.classList.remove('active');
        other.style.display = 'none';
      });
      // Exactly one place is highlighted: the gear, not the workspace behind it.
      $$('.mode-nav-item[data-mode][data-navigation-id]').forEach((item) => {
        item.classList.remove('active');
        item.setAttribute('aria-current', 'false');
      });
    }
    shell.dataset.settingsOpen = 'true';
    view.classList.add('active');
    view.style.display = 'block';
    const gear = $('#openSettings');
    if (gear) {
      gear.classList.add('is-current');
      gear.setAttribute('aria-current', 'page');
    }
    const canvas = $('.workspace-canvas');
    if (canvas) canvas.dataset.navDirection = 'forward';
    browserWindow.RiverlineWorkspaceHeader?.activate('settings', {
      titleKey: 'Settings',
      descriptionKey: 'Customize your workstation.',
    });
    publishContext();
    browserWindow.RiverlineTutorials?.workspaceChanged?.('settings');
    browserWindow.RiverlineTutorials?.offerForWorkspace?.('settings', $('#settingsTutorialOfferHost'));
    workspace()?.setVisible(true, { category });
    return true;
  }

  // The header's context line says where these choices live (translated text,
  // so it is published again on a language change).
  function publishContext() {
    browserWindow.RiverlineWorkspaceHeader?.setContext?.('settings', [translate('Saved on this device')]);
  }
  browserWindow.addEventListener?.('riverline:languagechange', () => {
    if (isOpen()) publishContext();
  });

  function close({ restoreFocus = false } = {}) {
    if (!leave()) return false;
    const item = returnItem?.isConnected ? returnItem : $('.mode-nav-item[data-navigation-id="home"]');
    if (item) {
      $$('.mode-nav-item[data-mode][data-navigation-id]').forEach((entry) => {
        const active = entry === item;
        entry.classList.toggle('active', active);
        entry.setAttribute('aria-current', active ? 'page' : 'false');
      });
      const mode = item.dataset.mode;
      const target = $(`#${mode}Mode`) ?? ((mode === 'info' || mode === 'guide') ? $('#infoMode') : null);
      if (target) {
        target.classList.add('active');
        target.style.display = 'block';
      }
      browserWindow.RiverlineWorkspaceHeader?.activate(item.dataset.navigationId, {
        titleKey: item.dataset.modeTitle || item.textContent.trim(),
        descriptionKey: item.dataset.modeSubtitle || '',
      });
      const tutorialWorkspace = mode === 'home' && item.dataset.navigationId === 'saved' ? 'saved' : mode;
      browserWindow.RiverlineTutorials?.workspaceChanged?.(tutorialWorkspace);
      if (mode !== 'home') browserWindow.RiverlineTutorials?.offerForWorkspace?.(mode, target);
    }
    if (restoreFocus) {
      browserWindow.requestAnimationFrame?.(() => $('#openSettings')?.focus?.({ preventScroll: true }));
    }
    return true;
  }

  return Object.freeze({
    schemaVersion: SETTINGS_SHELL_SCHEMA_VERSION,
    open,
    close: () => close({ restoreFocus: false }),
    toggle: () => (isOpen() ? close({ restoreFocus: true }) : open()),
    leave,
    isOpen,
    getController: () => controller,
  });
}

if (typeof window !== 'undefined' && window.document) {
  const shell = createSettingsShell(window, {
    reportError: (error) => console.error('[Riverline Settings]', error),
  });
  Object.defineProperty(window, 'RiverlineSettings', {
    configurable: true,
    enumerable: false,
    value: shell,
    writable: false,
  });
}
