import { createPresentationDensityController } from './presentation-density.mjs';
import { createPresentationLayoutController } from './presentation-layout.mjs';

function activeLayoutWorkspace() {
  return document.querySelector('.mode-nav-item.active[data-navigation-id]')?.dataset.navigationId
    ?? 'unsupported';
}

function initializePresentationPreferences() {
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePresentationPreferences, { once: true });
} else {
  initializePresentationPreferences();
}
