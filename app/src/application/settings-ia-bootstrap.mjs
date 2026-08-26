export const SETTINGS_CATEGORY_IDS = Object.freeze([
  'appearance',
  'audio',
  'language',
  'account',
]);

function isFocusable(element) {
  if (!element || element.disabled || element.closest?.('[hidden]')) return false;
  if (element.getAttribute?.('tabindex') === '-1') return false;
  return typeof element.getClientRects !== 'function' || element.getClientRects().length > 0;
}

export function installSettingsInformationArchitecture(browserWindow = window) {
  const { document } = browserWindow;
  const modal = document.querySelector('#settingsModal');
  const openButton = document.querySelector('#openSettings');
  const closeButton = document.querySelector('#closeSettingsModal');
  const content = modal?.querySelector('.settings-content');
  const tabs = [...(modal?.querySelectorAll('[data-settings-category]') ?? [])];
  const panels = [...(modal?.querySelectorAll('[data-settings-panel]') ?? [])];
  if (!modal || !openButton || !closeButton || tabs.length === 0 || panels.length === 0) return null;

  const listeners = [];
  let activeCategory = 'appearance';
  let restoreFocusOnClose = true;

  function listen(target, type, listener, options) {
    target?.addEventListener?.(type, listener, options);
    listeners.push([target, type, listener, options]);
  }

  function activate(category, { focus = false, resetScroll = true } = {}) {
    const nextTab = tabs.find((tab) => tab.dataset.settingsCategory === category) ?? tabs[0];
    const nextCategory = nextTab.dataset.settingsCategory;
    activeCategory = nextCategory;
    tabs.forEach((tab) => {
      const selected = tab === nextTab;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== nextCategory;
    });
    modal.dataset.settingsCategory = nextCategory;
    if (resetScroll && content) content.scrollTop = 0;
    if (focus) nextTab.focus({ preventScroll: true });
    return nextCategory;
  }

  tabs.forEach((tab, index) => {
    listen(tab, 'click', () => activate(tab.dataset.settingsCategory));
    listen(tab, 'keydown', (event) => {
      let nextIndex = null;
      if (event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      if (nextIndex == null) return;
      event.preventDefault();
      activate(tabs[nextIndex].dataset.settingsCategory, { focus: true });
    });
  });

  const languageSelect = document.querySelector('#settingsLanguageSelect');
  const syncLanguage = () => {
    if (languageSelect) languageSelect.value = browserWindow.appLang ?? document.documentElement.lang ?? 'en';
  };
  listen(languageSelect, 'change', (event) => {
    const setLanguage = browserWindow.RiverlineI18n?.setLanguage ?? browserWindow.setLanguage;
    setLanguage?.(event.currentTarget.value);
  });
  listen(browserWindow, 'riverline:languagechange', () => {
    syncLanguage();
    updateMotionStatus();
  });

  const motionStatus = document.querySelector('#settingsReducedMotionStatus');
  const reducedMotion = browserWindow.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
  function updateMotionStatus() {
    if (!motionStatus) return;
    const key = reducedMotion?.matches ? 'System preference: On' : 'System preference: Off';
    motionStatus.dataset.i18n = key;
    motionStatus.textContent = browserWindow.t?.(key) ?? key;
    motionStatus.classList.toggle('status-badge--available', Boolean(reducedMotion?.matches));
    motionStatus.classList.toggle('status-badge--neutral', !reducedMotion?.matches);
  }
  listen(reducedMotion, 'change', updateMotionStatus);

  function focusActiveTab() {
    browserWindow.requestAnimationFrame?.(() => {
      if (!modal.classList.contains('show')) return;
      tabs.find((tab) => tab.dataset.settingsCategory === activeCategory)?.focus?.({ preventScroll: true });
    });
  }

  listen(openButton, 'click', () => {
    restoreFocusOnClose = true;
    activate('appearance');
    syncLanguage();
    updateMotionStatus();
    focusActiveTab();
  });

  listen(closeButton, 'click', () => {
    if (!restoreFocusOnClose) return;
    browserWindow.requestAnimationFrame?.(() => openButton.focus?.({ preventScroll: true }));
  });

  listen(modal, 'click', (event) => {
    if (event.target !== modal) return;
    restoreFocusOnClose = true;
    browserWindow.requestAnimationFrame?.(() => openButton.focus?.({ preventScroll: true }));
  });

  listen(modal, 'keydown', (event) => {
    if (event.defaultPrevented || !modal.classList.contains('show')) return;
    if (event.key === 'Escape') {
      const picker = document.querySelector('#riverlineColorPicker');
      if (picker && !picker.hidden) return;
      event.preventDefault();
      restoreFocusOnClose = true;
      closeButton.click();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll(
      'button, select, input, textarea, summary, [href], [tabindex]',
    )].filter(isFocusable);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const openGuide = document.querySelector('#settingsOpenGuide');
  listen(openGuide, 'click', () => {
    restoreFocusOnClose = false;
    closeButton.click();
    document.querySelector('.mode-nav-item[data-navigation-id="guide"]')?.click();
  });

  activate('appearance', { resetScroll: false });
  syncLanguage();
  updateMotionStatus();

  const controller = Object.freeze({
    activate,
    getActiveCategory: () => activeCategory,
    destroy() {
      listeners.splice(0).forEach(([target, type, listener, options]) => {
        target?.removeEventListener?.(type, listener, options);
      });
    },
  });
  browserWindow.RiverlineSettingsIA = controller;
  return controller;
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => installSettingsInformationArchitecture(window), { once: true });
  } else {
    installSettingsInformationArchitecture(window);
  }
}
