export const WELCOME_ORIENTATION_SCHEMA_VERSION = 'welcome-orientation/v1';
export const WELCOME_ORIENTATION_STORAGE_KEY = 'riverline.welcomeOrientation.v1';
export const WELCOME_ORIENTATION_DESTINATIONS = Object.freeze([
  'hand',
  'analyze',
  'training',
  'equity',
  'personal-strategy',
  'home',
  'guide',
  'saved',
  'home-game',
]);

const TERMINAL_STATUSES = new Set(['completed', 'dismissed']);

function unseenState() {
  return Object.freeze({
    schemaVersion: WELCOME_ORIENTATION_SCHEMA_VERSION,
    localOwnerId: 'local',
    status: 'unseen',
    completedAt: null,
    completionReason: null,
    destination: null,
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validStoredState(value) {
  return Boolean(value
    && value.schemaVersion === WELCOME_ORIENTATION_SCHEMA_VERSION
    && value.localOwnerId === 'local'
    && TERMINAL_STATUSES.has(value.status)
    && typeof value.completedAt === 'string'
    && Number.isFinite(Date.parse(value.completedAt))
    && typeof value.completionReason === 'string'
    && (value.destination === null || WELCOME_ORIENTATION_DESTINATIONS.includes(value.destination)));
}

export function createWelcomeOrientationPreference({
  storage = globalThis.localStorage,
  storageKey = WELCOME_ORIENTATION_STORAGE_KEY,
  clock = () => new Date().toISOString(),
} = {}) {
  let memory = null;
  let recoveredInvalidState = false;
  let storageError = null;

  function read() {
    if (memory) return memory;
    try {
      const raw = storage?.getItem?.(storageKey);
      if (!raw) return (memory = unseenState());
      const parsed = JSON.parse(raw);
      if (!validStoredState(parsed)) {
        recoveredInvalidState = true;
        return (memory = unseenState());
      }
      return (memory = Object.freeze(parsed));
    } catch (error) {
      recoveredInvalidState = true;
      storageError = error;
      return (memory = unseenState());
    }
  }

  function finish({ status, reason, destination = null }) {
    const current = read();
    if (TERMINAL_STATUSES.has(current.status)) return clone(current);
    const next = Object.freeze({
      schemaVersion: WELCOME_ORIENTATION_SCHEMA_VERSION,
      localOwnerId: 'local',
      status,
      completedAt: clock(),
      completionReason: reason,
      destination,
    });
    memory = next;
    try {
      storage?.setItem?.(storageKey, JSON.stringify(next));
      storageError = null;
    } catch (error) {
      storageError = error;
    }
    return clone(next);
  }

  return Object.freeze({
    schemaVersion: 'welcome-orientation-preference/v1',
    getState: () => clone(read()),
    shouldShowOnStartup: () => !TERMINAL_STATUSES.has(read().status),
    complete(destination, reason = 'destination_selected') {
      if (!WELCOME_ORIENTATION_DESTINATIONS.includes(destination)) {
        throw new TypeError(`Unsupported Welcome destination: ${destination}`);
      }
      return finish({ status: 'completed', reason, destination });
    },
    dismiss(reason = 'dismissed') {
      return finish({ status: 'dismissed', reason, destination: 'home' });
    },
    diagnostics: () => Object.freeze({
      recoveredInvalidState,
      storageError: storageError ? String(storageError) : null,
    }),
  });
}

export function createWelcomeOrientationSession({ preference, navigate } = {}) {
  if (!preference?.shouldShowOnStartup || typeof navigate !== 'function') {
    throw new TypeError('Welcome orientation requires a preference and navigation callback');
  }
  let visible = false;
  let entryKind = null;

  return Object.freeze({
    schemaVersion: 'welcome-orientation-session/v1',
    open({ manual = false } = {}) {
      visible = true;
      entryKind = manual ? 'manual' : 'startup';
      return Object.freeze({ visible, entryKind });
    },
    choose(destination, { remember = true } = {}) {
      if (!WELCOME_ORIENTATION_DESTINATIONS.includes(destination)) {
        throw new TypeError(`Unsupported Welcome destination: ${destination}`);
      }
      if (remember) preference.complete(destination);
      visible = false;
      navigate(destination);
      return Object.freeze({ visible, entryKind, destination, remembered: Boolean(remember) });
    },
    dismiss({ remember = true } = {}) {
      if (remember) preference.dismiss();
      visible = false;
      navigate('home');
      return Object.freeze({ visible, entryKind, destination: 'home', remembered: Boolean(remember) });
    },
    leaveForExternalNavigation(destination, { remember = true } = {}) {
      if (!WELCOME_ORIENTATION_DESTINATIONS.includes(destination)) return false;
      if (remember) preference.complete(destination, 'navigation_selected');
      visible = false;
      return true;
    },
    closeManual() {
      if (entryKind !== 'manual') return false;
      visible = false;
      return true;
    },
    getState: () => Object.freeze({ visible, entryKind }),
  });
}
