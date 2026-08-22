export const PRESENTATION_LAYOUT_STORAGE_KEY = 'riverline_presentation_layout';
export const PRESENTATION_LAYOUT_PRESETS = Object.freeze([
  'balanced',
  'table-focus',
  'analysis-focus',
  'controls-first',
]);
export const DEFAULT_PRESENTATION_LAYOUT = 'balanced';

const BALANCED_ONLY = Object.freeze([DEFAULT_PRESENTATION_LAYOUT]);

export const WORKSPACE_LAYOUT_PRESETS = Object.freeze({
  hand: Object.freeze(['balanced', 'table-focus', 'controls-first']),
  analyze: Object.freeze(['balanced', 'analysis-focus', 'controls-first']),
  training: Object.freeze(['balanced', 'table-focus', 'controls-first']),
  'personal-strategy': Object.freeze(['balanced', 'analysis-focus']),
  equity: Object.freeze(['balanced', 'analysis-focus', 'controls-first']),
  home: BALANCED_ONLY,
  saved: BALANCED_ONLY,
});

export function normalizePresentationLayout(value) {
  return PRESENTATION_LAYOUT_PRESETS.includes(value)
    ? value
    : DEFAULT_PRESENTATION_LAYOUT;
}

export function normalizeLayoutWorkspace(value) {
  return Object.hasOwn(WORKSPACE_LAYOUT_PRESETS, value) ? value : 'unsupported';
}

export function getWorkspaceLayoutPresets(workspace) {
  return WORKSPACE_LAYOUT_PRESETS[normalizeLayoutWorkspace(workspace)] ?? BALANCED_ONLY;
}

export function resolveWorkspaceLayoutPreset(value, workspace) {
  const preference = normalizePresentationLayout(value);
  return getWorkspaceLayoutPresets(workspace).includes(preference)
    ? preference
    : DEFAULT_PRESENTATION_LAYOUT;
}

function readStoredLayouts(storage, workspace) {
  let stored;
  try {
    stored = storage?.getItem?.(PRESENTATION_LAYOUT_STORAGE_KEY) ?? null;
  } catch {
    return { preferences: {}, repair: false };
  }
  if (stored === null) return { preferences: {}, repair: false };

  let candidate;
  try {
    candidate = JSON.parse(stored);
  } catch {
    candidate = PRESENTATION_LAYOUT_PRESETS.includes(stored) ? stored : null;
  }

  if (typeof candidate === 'string') {
    const normalizedWorkspace = normalizeLayoutWorkspace(workspace);
    const supported = getWorkspaceLayoutPresets(normalizedWorkspace);
    return {
      preferences: supported.length > 1
        ? { [normalizedWorkspace]: resolveWorkspaceLayoutPreset(candidate, normalizedWorkspace) }
        : {},
      repair: true,
    };
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { preferences: {}, repair: true };
  }

  const preferences = {};
  let repair = false;
  Object.entries(candidate).forEach(([storedWorkspace, value]) => {
    const normalizedWorkspace = normalizeLayoutWorkspace(storedWorkspace);
    const supported = getWorkspaceLayoutPresets(normalizedWorkspace);
    if (normalizedWorkspace === 'unsupported' || supported.length <= 1) {
      repair = true;
      return;
    }
    const resolved = resolveWorkspaceLayoutPreset(value, normalizedWorkspace);
    preferences[normalizedWorkspace] = resolved;
    if (value !== resolved) repair = true;
  });
  return { preferences, repair };
}

function persistLayouts(storage, preferences) {
  try {
    storage?.setItem?.(PRESENTATION_LAYOUT_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Presentation still applies when browser storage is unavailable.
  }
}

export function createPresentationLayoutController({
  root,
  storage,
  buttons = [],
  control = null,
  initialWorkspace = 'unsupported',
} = {}) {
  if (!root?.dataset) throw new TypeError('A layout root element is required');

  const layoutButtons = [...buttons];
  const listeners = new Map();
  let preferences = {};
  let currentPreference = DEFAULT_PRESENTATION_LAYOUT;
  let currentPreset = DEFAULT_PRESENTATION_LAYOUT;
  let currentWorkspace = normalizeLayoutWorkspace(initialWorkspace);

  function syncControl() {
    const supportedPresets = getWorkspaceLayoutPresets(currentWorkspace);
    const supported = new Set(supportedPresets);
    if (control) {
      control.hidden = supportedPresets.length <= 1;
      control.dataset.layoutWorkspace = currentWorkspace;
    }
    layoutButtons.forEach((button) => {
      const option = button.dataset.layoutPresetOption;
      const available = supported.has(option);
      const selected = option === currentPreset;
      button.hidden = !available;
      button.disabled = !available;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
  }

  function announceLayout() {
    const view = root.ownerDocument?.defaultView;
    const LayoutEvent = view?.CustomEvent ?? globalThis.CustomEvent;
    if (typeof root.dispatchEvent !== 'function' || typeof LayoutEvent !== 'function') return;
    root.dispatchEvent(new LayoutEvent('riverline:layoutchange', {
      bubbles: true,
      detail: Object.freeze({
        preset: currentPreset,
        preference: currentPreference,
        workspace: currentWorkspace,
        supportedPresets: getWorkspaceLayoutPresets(currentWorkspace),
      }),
    }));
  }

  function apply(value, { persist = true, announce = true } = {}) {
    currentPreset = resolveWorkspaceLayoutPreset(value, currentWorkspace);
    currentPreference = currentPreset;
    if (getWorkspaceLayoutPresets(currentWorkspace).length > 1) {
      preferences[currentWorkspace] = currentPreset;
    }
    root.dataset.layoutPresetPreference = currentPreference;
    root.dataset.layoutPreset = currentPreset;
    root.dataset.layoutWorkspace = currentWorkspace;
    syncControl();
    if (persist) persistLayouts(storage, preferences);
    if (announce) announceLayout();
    return currentPreset;
  }

  function setWorkspace(value, { announce = true } = {}) {
    currentWorkspace = normalizeLayoutWorkspace(value);
    currentPreference = preferences[currentWorkspace] ?? DEFAULT_PRESENTATION_LAYOUT;
    currentPreset = resolveWorkspaceLayoutPreset(currentPreference, currentWorkspace);
    root.dataset.layoutPresetPreference = currentPreference;
    root.dataset.layoutPreset = currentPreset;
    root.dataset.layoutWorkspace = currentWorkspace;
    syncControl();
    if (announce) announceLayout();
    return currentPreset;
  }

  function restore() {
    const stored = readStoredLayouts(storage, currentWorkspace);
    preferences = stored.preferences;
    const preset = setWorkspace(currentWorkspace, { announce: false });
    if (stored.repair) persistLayouts(storage, preferences);
    return preset;
  }

  function init() {
    restore();
    layoutButtons.forEach((button) => {
      const listener = () => apply(button.dataset.layoutPresetOption);
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
    getPreference: () => currentPreference,
    getPreferences: () => Object.freeze({ ...preferences }),
    getPreset: () => currentPreset,
    getSupportedPresets: () => getWorkspaceLayoutPresets(currentWorkspace),
    getWorkspace: () => currentWorkspace,
    init,
    restore,
    setWorkspace,
  });

  return controller;
}
