// MOTION-FOUNDATION-001: the one global Motion setting (P1-09) and the shared
// keyboard rule (P1-06). CSS owns the timings (app/styles.css motion tokens);
// this module only resolves the effective mode, writes it to the root and
// tells script-driven motion what it may do.
export const MOTION_PREFERENCE_STORAGE_KEY = 'riverline_motion_preference';
export const MOTION_MODES = Object.freeze(['instant', 'faster', 'standard', 'reduced']);
export const SYSTEM_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Mirrors the CSS tokens: --motion-scale per mode and --motion-tempo per
// data-motion moment (MOTION_SPEC tempos; real duration = base × scale ÷ tempo).
export const MOTION_SCALE_BY_MODE = Object.freeze({ instant: 0, faster: 0.625, standard: 1, reduced: 1 });
export const MOTION_TEMPO_BY_MOMENT = Object.freeze({
  drill: 0.7,
  panel: 0.7,
  table: 0.7,
  control: 0.85,
  nav: 0.5,
  rare: 0.6,
});
export const REDUCED_FADE_MAX_MS = 200;

export function normalizeMotionPreference(value) {
  return MOTION_MODES.includes(value) ? value : null;
}

/** The effective mode: an explicit choice wins; otherwise follow the system. */
export function resolveMotionMode(preference, systemReduced = false) {
  return normalizeMotionPreference(preference) ?? (systemReduced ? 'reduced' : 'standard');
}

/**
 * Duration in ms for a script-timed moment. Keyboard-triggered moments and
 * Instant are 0; Reduced keeps a fade of at most 200 ms.
 */
export function motionDurationMs(baseMs, { mode = 'standard', moment = null, keyboard = false } = {}) {
  if (!Number.isFinite(baseMs) || baseMs <= 0) return 0;
  const effective = MOTION_MODES.includes(mode) ? mode : 'standard';
  if (keyboard || effective === 'instant') return 0;
  const tempo = MOTION_TEMPO_BY_MOMENT[moment] ?? 1;
  const duration = Math.round((baseMs * MOTION_SCALE_BY_MODE[effective]) / tempo);
  return effective === 'reduced' ? Math.min(duration, REDUCED_FADE_MAX_MS) : duration;
}

/** Whether things may travel (move, scale, flip); Reduced and Instant never do. */
export function motionAllowsTravel({ mode = 'standard', keyboard = false } = {}) {
  return !keyboard && (mode === 'standard' || mode === 'faster');
}

function readStoredPreference(storage) {
  try {
    return normalizeMotionPreference(storage?.getItem?.(MOTION_PREFERENCE_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

function writeStoredPreference(storage, preference) {
  try {
    if (preference) storage?.setItem?.(MOTION_PREFERENCE_STORAGE_KEY, preference);
    else storage?.removeItem?.(MOTION_PREFERENCE_STORAGE_KEY);
  } catch {
    // The setting still applies for this visit when storage is unavailable.
  }
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn']);

/**
 * Keyboard rule: one mechanism for the whole app. A key press marks the root
 * data-motion-input="key" (CSS then drops every transition and animation)
 * until the pointer is used again.
 */
export function installKeyboardInstantMotion({ root, target } = {}) {
  if (!root?.dataset || typeof target?.addEventListener !== 'function') return () => {};
  const onPointer = () => {
    if (root.dataset.motionInput !== 'pointer') root.dataset.motionInput = 'pointer';
    target.removeEventListener('pointermove', onPointer, true);
  };
  const onKey = (event) => {
    if (MODIFIER_KEYS.has(event.key)) return;
    if (root.dataset.motionInput !== 'key') root.dataset.motionInput = 'key';
    // Only listen for movement while keyboard mode is active.
    target.addEventListener('pointermove', onPointer, true);
  };
  target.addEventListener('keydown', onKey, true);
  target.addEventListener('pointerdown', onPointer, true);
  return () => {
    target.removeEventListener('keydown', onKey, true);
    target.removeEventListener('pointerdown', onPointer, true);
    target.removeEventListener('pointermove', onPointer, true);
  };
}

export function createMotionPreferenceController({
  root,
  storage,
  systemQuery = null,
  buttons = [],
  sourceNote = null,
  followDeviceButton = null,
} = {}) {
  if (!root?.dataset) throw new TypeError('A motion root element is required');
  const optionButtons = [...buttons];
  const listeners = [];
  let preference = null;

  function listen(target, type, listener) {
    if (typeof target?.addEventListener !== 'function') return;
    target.addEventListener(type, listener);
    listeners.push([target, type, listener]);
  }

  function getMode() {
    return resolveMotionMode(preference, systemQuery?.matches === true);
  }

  function announce(mode) {
    const view = root.ownerDocument?.defaultView;
    const MotionEvent = view?.CustomEvent ?? globalThis.CustomEvent;
    if (typeof root.dispatchEvent !== 'function' || typeof MotionEvent !== 'function') return;
    root.dispatchEvent(new MotionEvent('riverline:motionchange', {
      bubbles: true,
      detail: Object.freeze({ mode, source: preference ? 'user' : 'system' }),
    }));
  }

  function sync() {
    const mode = getMode();
    root.dataset.motionMode = mode;
    root.dataset.motionSource = preference ? 'user' : 'system';
    optionButtons.forEach((button) => {
      const selected = button.dataset.motionOption === mode;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
    if (sourceNote) sourceNote.hidden = Boolean(preference);
    if (followDeviceButton) followDeviceButton.hidden = !preference;
    return mode;
  }

  function apply(value, { persist = true, announce: shouldAnnounce = true } = {}) {
    preference = normalizeMotionPreference(value);
    if (persist) writeStoredPreference(storage, preference);
    const mode = sync();
    if (shouldAnnounce) announce(mode);
    return mode;
  }

  function init() {
    apply(readStoredPreference(storage), { persist: false, announce: false });
    optionButtons.forEach((button) => listen(button, 'click', () => apply(button.dataset.motionOption)));
    listen(followDeviceButton, 'click', () => apply(null));
    // Following the system: a system change applies immediately.
    listen(systemQuery, 'change', () => {
      if (preference) return;
      announce(sync());
    });
    return controller;
  }

  function destroy() {
    listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener));
    listeners.length = 0;
  }

  const controller = Object.freeze({
    apply,
    destroy,
    getMode,
    getPreference: () => preference,
    init,
  });
  return controller;
}

/** Read-only view for classic scripts (logic.js) and script-timed motion. */
export function createMotionRuntime(root) {
  const mode = () => (MOTION_MODES.includes(root?.dataset?.motionMode) ? root.dataset.motionMode : 'standard');
  const keyboard = () => root?.dataset?.motionInput === 'key';
  return Object.freeze({
    getMode: mode,
    isKeyboardInput: keyboard,
    allowsTravel: () => motionAllowsTravel({ mode: mode(), keyboard: keyboard() }),
    durationMs: (baseMs, moment = null) => motionDurationMs(baseMs, { mode: mode(), moment, keyboard: keyboard() }),
    scrollBehavior: () => (motionAllowsTravel({ mode: mode(), keyboard: keyboard() }) ? 'smooth' : 'auto'),
  });
}
