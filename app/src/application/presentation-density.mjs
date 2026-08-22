export const PRESENTATION_DENSITY_STORAGE_KEY = 'riverline_presentation_density';
export const PRESENTATION_DENSITIES = Object.freeze(['comfortable', 'compact']);
export const DEFAULT_PRESENTATION_DENSITY = 'comfortable';

export function normalizePresentationDensity(value) {
  return PRESENTATION_DENSITIES.includes(value)
    ? value
    : DEFAULT_PRESENTATION_DENSITY;
}

function readStoredDensity(storage) {
  try {
    return storage?.getItem?.(PRESENTATION_DENSITY_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function persistDensity(storage, density) {
  try {
    storage?.setItem?.(PRESENTATION_DENSITY_STORAGE_KEY, density);
  } catch {
    // Presentation still applies when browser storage is unavailable.
  }
}

export function createPresentationDensityController({
  root,
  storage,
  buttons = [],
  compactDisclosures = [],
} = {}) {
  if (!root?.dataset) throw new TypeError('A density root element is required');

  const densityButtons = [...buttons];
  const densityDisclosures = [...compactDisclosures];
  const listeners = new Map();
  let currentDensity = DEFAULT_PRESENTATION_DENSITY;

  function syncControl(density) {
    densityButtons.forEach((button) => {
      const selected = button.dataset.densityOption === density;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
  }

  function announceDensity(density) {
    const view = root.ownerDocument?.defaultView;
    const DensityEvent = view?.CustomEvent ?? globalThis.CustomEvent;
    if (typeof root.dispatchEvent !== 'function' || typeof DensityEvent !== 'function') return;
    root.dispatchEvent(new DensityEvent('riverline:densitychange', {
      bubbles: true,
      detail: Object.freeze({ density }),
    }));
  }

  function syncCompactDisclosures(density) {
    densityDisclosures.forEach((disclosure) => {
      if (density === 'compact') {
        if (!disclosure.open) return;
        disclosure.dataset.densityComfortableOpen = 'true';
        disclosure.dataset.densityAutoCollapsed = 'true';
        disclosure.open = false;
        return;
      }

      if (disclosure.dataset.densityAutoCollapsed !== 'true') return;
      disclosure.open = disclosure.dataset.densityComfortableOpen === 'true';
      delete disclosure.dataset.densityComfortableOpen;
      delete disclosure.dataset.densityAutoCollapsed;
    });
  }

  function apply(value, { persist = true, announce = true } = {}) {
    const density = normalizePresentationDensity(value);
    currentDensity = density;
    root.dataset.density = density;
    syncControl(density);
    syncCompactDisclosures(density);
    if (persist) persistDensity(storage, density);
    if (announce) announceDensity(density);
    return density;
  }

  function restore() {
    const stored = readStoredDensity(storage);
    const density = apply(stored, { persist: false, announce: false });
    if (stored !== null && stored !== density) persistDensity(storage, density);
    return density;
  }

  function init() {
    restore();
    densityButtons.forEach((button) => {
      const listener = () => apply(button.dataset.densityOption);
      listeners.set(button, listener);
      button.addEventListener?.('click', listener);
    });
    return controller;
  }

  function destroy() {
    listeners.forEach((listener, button) => button.removeEventListener?.('click', listener));
    listeners.clear();
  }

  const controller = Object.freeze({
    apply,
    destroy,
    getDensity: () => currentDensity,
    init,
    restore,
  });

  return controller;
}
