import { createPresentationDensityController } from './presentation-density.mjs';

function initializePresentationDensity() {
  const controller = createPresentationDensityController({
    root: document.documentElement,
    storage: window.localStorage,
    buttons: document.querySelectorAll('[data-density-option]'),
    compactDisclosures: document.querySelectorAll('[data-density-collapse-in-compact]'),
  }).init();

  window.RiverlinePresentationDensity = controller;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePresentationDensity, { once: true });
} else {
  initializePresentationDensity();
}
