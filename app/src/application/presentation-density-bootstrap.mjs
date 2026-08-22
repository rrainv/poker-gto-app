import { createPresentationDensityController } from './presentation-density.mjs';
import { createPresentationLayoutController } from './presentation-layout.mjs';
import { createPresentationThemeController } from './presentation-theme.mjs';

function activeLayoutWorkspace() {
  return document.querySelector('.mode-nav-item.active[data-navigation-id]')?.dataset.navigationId
    ?? 'unsupported';
}

function initializePresentationPreferences() {
  const themeController = createPresentationThemeController({
    root: document.documentElement,
    storage: window.localStorage,
    themeGrid: document.querySelector('#themeSwatchGrid'),
    accentInput: document.querySelector('#themeAccentColor'),
    surfaceInput: document.querySelector('#themeSurfaceColor'),
    feltInput: document.querySelector('#themeFeltColor'),
    resetButton: document.querySelector('#resetThemeCustomization'),
    status: document.querySelector('#themeCustomizationStatus'),
    translate: (key) => window.t?.(key) ?? key,
  }).init();

  const densityController = createPresentationDensityController({
    root: document.documentElement,
    storage: window.localStorage,
    buttons: document.querySelectorAll('[data-density-option]'),
    compactDisclosures: document.querySelectorAll('[data-density-collapse-in-compact]'),
  }).init();

  const layoutController = createPresentationLayoutController({
    root: document.documentElement,
    storage: window.localStorage,
    buttons: document.querySelectorAll('[data-layout-preset-option]'),
    control: document.querySelector('[data-layout-preset-field]'),
    initialWorkspace: activeLayoutWorkspace(),
  }).init();

  let workspaceSyncQueued = false;
  const syncLayoutWorkspace = () => {
    if (workspaceSyncQueued) return;
    workspaceSyncQueued = true;
    queueMicrotask(() => {
      workspaceSyncQueued = false;
      layoutController.setWorkspace(activeLayoutWorkspace());
    });
  };
  const navigation = document.querySelector('.mode-navigation');
  if (navigation && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(syncLayoutWorkspace);
    observer.observe(navigation, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  window.RiverlinePresentationDensity = densityController;
  window.RiverlinePresentationLayout = layoutController;
  window.RiverlinePresentationTheme = themeController;
  window.addEventListener('riverline:languagechange', () => themeController.refreshLabels());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePresentationPreferences, { once: true });
} else {
  initializePresentationPreferences();
}
