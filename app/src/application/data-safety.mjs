import { RIVERLINE_ACCOUNT_DATABASE_NAME } from '../account-identity/indexeddb-storage.mjs';
import { HOME_GAME_DATABASE_NAME } from '../home-game/indexeddb-storage.mjs';
import { PERSONAL_STRATEGY_DATABASE_NAME } from '../personal-strategy/indexeddb-storage.mjs';
import { SAVED_STUDY_DATABASE_NAME } from '../saved-study-objects/indexeddb-storage.mjs';
import { SYNC_DATABASE_NAME } from '../sync/indexeddb-storage.mjs';
import { TRAINING_MEMORY_DATABASE_NAME } from '../training-memory/indexeddb-storage.mjs';

export const STORAGE_PERSIST_MARKER_KEY = 'riverline.storagePersistence.v1';

export const KNOWN_RIVERLINE_DATABASES = Object.freeze([
  RIVERLINE_ACCOUNT_DATABASE_NAME,
  SAVED_STUDY_DATABASE_NAME,
  PERSONAL_STRATEGY_DATABASE_NAME,
  TRAINING_MEMORY_DATABASE_NAME,
  HOME_GAME_DATABASE_NAME,
  SYNC_DATABASE_NAME,
]);

export const DELETE_CONFIRM_WORDS = Object.freeze({
  en: 'DELETE',
  ru: 'УДАЛИТЬ',
  he: 'מחק',
});

function translated(key) {
  return globalThis.t?.(key) ?? key;
}

function setTranslatedText(element, key) {
  if (!element) return;
  element.dataset.i18n = key;
  element.textContent = translated(key);
}

export function resolveActiveLanguage(browserWindow) {
  const raw = browserWindow?.RiverlineI18n?.getLanguage?.()
    ?? browserWindow?.document?.documentElement?.getAttribute?.('lang')
    ?? browserWindow?.localStorage?.getItem?.('riverline_lang')
    ?? 'en';
  const normalized = String(raw || 'en').trim().toLowerCase();
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('he') || normalized.startsWith('iw')) return 'he';
  return 'en';
}

export function confirmWordForLanguage(language) {
  return DELETE_CONFIRM_WORDS[language] ?? DELETE_CONFIRM_WORDS.en;
}

export function isIosBrowserTab(browserWindow) {
  const nav = browserWindow?.navigator;
  if (!nav) return false;
  const ua = String(nav.userAgent ?? '');
  const platform = String(nav.platform ?? '');
  const isIosDevice = /iPhone|iPad|iPod/i.test(ua)
    || (/Mac/i.test(platform) && Number(nav.maxTouchPoints) > 1);
  if (!isIosDevice) return false;
  const standalone = nav.standalone === true
    || Boolean(browserWindow?.matchMedia?.('(display-mode: standalone)')?.matches);
  return !standalone;
}

function readPersistMarker(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_PERSIST_MARKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writePersistMarker(storage, persisted) {
  try {
    storage?.setItem?.(STORAGE_PERSIST_MARKER_KEY, JSON.stringify({
      schemaVersion: 'riverline-storage-persistence/v1',
      requested: true,
      persisted: Boolean(persisted),
    }));
  } catch {
    // Ignore storage quota or private-mode restrictions.
  }
}

function deleteDatabaseByName(indexedDBFactory, name) {
  if (!indexedDBFactory || typeof indexedDBFactory.deleteDatabase !== 'function' || !name) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const request = indexedDBFactory.deleteDatabase(name);
      if (!request || typeof request.addEventListener !== 'function') {
        finish(true);
        return;
      }
      request.addEventListener('success', () => finish(true), { once: true });
      request.addEventListener('error', () => finish(false), { once: true });
      request.addEventListener('blocked', () => finish(true), { once: true });
    } catch {
      finish(false);
    }
  });
}

export async function deleteAllRiverlineData(browserWindow) {
  const indexedDBFactory = browserWindow?.indexedDB;
  const databaseNames = new Set(KNOWN_RIVERLINE_DATABASES);
  if (typeof indexedDBFactory?.databases === 'function') {
    try {
      const entries = await indexedDBFactory.databases();
      if (Array.isArray(entries)) {
        for (const entry of entries) {
          const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
          if (name) databaseNames.add(name);
        }
      }
    } catch {
      // Fall back to known Riverline database names when enumeration is unsupported.
    }
  }

  for (const name of databaseNames) {
    await deleteDatabaseByName(indexedDBFactory, name);
  }

  try { browserWindow?.localStorage?.clear?.(); } catch { /* ignore */ }
  try { browserWindow?.sessionStorage?.clear?.(); } catch { /* ignore */ }

  return Object.freeze({
    deletedDatabases: Object.freeze([...databaseNames]),
  });
}

export function installDataSafetyController(browserWindow, options = {}) {
  if (!browserWindow?.document) return null;
  const document = browserWindow.document;

  let requestedInMemory = Boolean(readPersistMarker(browserWindow.localStorage)?.requested);
  let inFlightPersist = null;
  let deleting = false;
  let storageState = Object.freeze({
    status: 'temporary',
    persisted: false,
    supported: false,
    requestedOnce: requestedInMemory,
    iosBrowserTab: isIosBrowserTab(browserWindow),
  });

  function hasRequestedPersist() {
    if (requestedInMemory) return true;
    const marker = readPersistMarker(browserWindow.localStorage);
    if (marker?.requested) {
      requestedInMemory = true;
      return true;
    }
    return false;
  }

  function renderStorageStatus() {
    const statusEl = document.querySelector('#settingsStorageStatus');
    const detailEl = document.querySelector('#settingsStorageStatusDetail');
    const iosNoteEl = document.querySelector('#settingsStorageIosNote');
    const persisted = storageState.persisted === true;
    const iosTab = isIosBrowserTab(browserWindow);
    storageState = Object.freeze({
      ...storageState,
      status: persisted ? 'persisted' : 'temporary',
      iosBrowserTab: iosTab,
    });
    if (statusEl) {
      statusEl.dataset.storageStatus = storageState.status;
      setTranslatedText(
        statusEl,
        persisted ? 'Persistent browser storage' : 'Temporary browser storage',
      );
    }
    if (detailEl) {
      setTranslatedText(
        detailEl,
        persisted
          ? 'The browser will keep your local Riverline data unless you clear site data or delete it below.'
          : 'Local data stays on this device during normal use, but the browser can clear temporary storage if device space runs low.',
      );
    }
    if (iosNoteEl) {
      iosNoteEl.dataset.iosBrowserTab = iosTab ? 'true' : 'false';
      setTranslatedText(
        iosNoteEl,
        'In iPhone and iPad browser tabs, Safari may clear local data after 7 days without use. Add Riverline to the Home Screen or back up important work.',
      );
      iosNoteEl.hidden = persisted && !iosTab;
    }
  }

  async function refreshStorageStatus() {
    const storageManager = browserWindow?.navigator?.storage;
    const hasPersisted = typeof storageManager?.persisted === 'function';
    const hasPersist = typeof storageManager?.persist === 'function';
    let persisted = false;
    if (hasPersisted) {
      try {
        persisted = (await storageManager.persisted()) === true;
      } catch {
        persisted = false;
      }
    }
    storageState = Object.freeze({
      status: persisted ? 'persisted' : 'temporary',
      persisted,
      supported: Boolean(hasPersisted || hasPersist),
      requestedOnce: hasRequestedPersist(),
      iosBrowserTab: isIosBrowserTab(browserWindow),
    });
    renderStorageStatus();
    return storageState;
  }

  async function requestPersistentStorageOnce() {
    if (inFlightPersist) return inFlightPersist;
    inFlightPersist = (async () => {
      const storageManager = browserWindow?.navigator?.storage;
      const hasPersisted = typeof storageManager?.persisted === 'function';
      const hasPersist = typeof storageManager?.persist === 'function';
      let persisted = false;
      if (hasPersist && !hasRequestedPersist()) {
        requestedInMemory = true;
        writePersistMarker(browserWindow.localStorage, false);
        try {
          persisted = (await storageManager.persist()) === true;
        } catch {
          persisted = false;
        }
        writePersistMarker(browserWindow.localStorage, persisted);
      } else if (hasPersisted) {
        try {
          persisted = (await storageManager.persisted()) === true;
        } catch {
          persisted = false;
        }
      }
      storageState = Object.freeze({
        status: persisted ? 'persisted' : 'temporary',
        persisted,
        supported: Boolean(hasPersisted || hasPersist),
        requestedOnce: hasRequestedPersist(),
        iosBrowserTab: isIosBrowserTab(browserWindow),
      });
      renderStorageStatus();
      return storageState;
    })();
    try {
      return await inFlightPersist;
    } finally {
      inFlightPersist = null;
    }
  }

  function currentConfirmWord() {
    return confirmWordForLanguage(resolveActiveLanguage(browserWindow));
  }

  function isConfirmationMatch() {
    const inputEl = document.querySelector('#settingsDeleteAllDataInput');
    if (!inputEl) return false;
    return String(inputEl.value ?? '').trim() === currentConfirmWord();
  }

  function syncDeleteConfirmGuardUi() {
    const promptEl = document.querySelector('#settingsDeleteAllDataPrompt');
    const inputEl = document.querySelector('#settingsDeleteAllDataInput');
    const confirmBtn = document.querySelector('#settingsDeleteAllDataConfirm');
    const statusEl = document.querySelector('#settingsDeleteAllDataStatus');
    const expectedWord = currentConfirmWord();
    if (promptEl) {
      promptEl.dataset.confirmWord = expectedWord;
      setTranslatedText(promptEl, 'Type DELETE to confirm');
    }
    if (inputEl) {
      inputEl.dataset.confirmWord = expectedWord;
    }
    if (confirmBtn) {
      confirmBtn.disabled = deleting || !isConfirmationMatch();
    }
    if (statusEl && !statusEl.hidden && statusEl.dataset.i18n) {
      statusEl.textContent = translated(statusEl.dataset.i18n);
    }
  }

  function openDeleteGuard() {
    const openBtn = document.querySelector('#settingsDeleteAllDataOpen');
    const guardEl = document.querySelector('#settingsDeleteAllDataGuard');
    const inputEl = document.querySelector('#settingsDeleteAllDataInput');
    const statusEl = document.querySelector('#settingsDeleteAllDataStatus');
    if (!guardEl) return;
    if (statusEl) {
      statusEl.hidden = true;
      statusEl.textContent = '';
      statusEl.removeAttribute('data-i18n');
    }
    if (inputEl) inputEl.value = '';
    guardEl.hidden = false;
    openBtn?.setAttribute('aria-expanded', 'true');
    syncDeleteConfirmGuardUi();
    inputEl?.focus?.();
  }

  function closeDeleteGuard({ restoreFocus = false } = {}) {
    const openBtn = document.querySelector('#settingsDeleteAllDataOpen');
    const guardEl = document.querySelector('#settingsDeleteAllDataGuard');
    const inputEl = document.querySelector('#settingsDeleteAllDataInput');
    const confirmBtn = document.querySelector('#settingsDeleteAllDataConfirm');
    if (inputEl) inputEl.value = '';
    if (confirmBtn) confirmBtn.disabled = true;
    if (guardEl) guardEl.hidden = true;
    openBtn?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) openBtn?.focus?.();
  }

  async function confirmDeleteAllData() {
    if (deleting || !isConfirmationMatch()) return false;
    const confirmBtn = document.querySelector('#settingsDeleteAllDataConfirm');
    const statusEl = document.querySelector('#settingsDeleteAllDataStatus');
    deleting = true;
    if (confirmBtn) confirmBtn.disabled = true;
    try {
      const result = await deleteAllLocalDataAndReset();
      closeDeleteGuard({ restoreFocus: false });
      if (statusEl) {
        statusEl.hidden = false;
        setTranslatedText(statusEl, 'All local data has been deleted from this browser.');
      }
      browserWindow.dispatchEvent?.(new browserWindow.CustomEvent('riverline:alldatadeleted', {
        detail: result,
      }));
      return true;
    } finally {
      deleting = false;
      syncDeleteConfirmGuardUi();
    }
  }

  async function deleteAllLocalDataAndReset() {
    const result = await deleteAllRiverlineData(browserWindow);
    requestedInMemory = false;
    return result;
  }

  function bindUi() {
    const openBtn = document.querySelector('#settingsDeleteAllDataOpen');
    const cancelBtn = document.querySelector('#settingsDeleteAllDataCancel');
    const confirmBtn = document.querySelector('#settingsDeleteAllDataConfirm');
    const inputEl = document.querySelector('#settingsDeleteAllDataInput');
    const accountTab = document.querySelector('#settingsTabAccount');
    const openSettingsBtn = document.querySelector('#openSettings');

    openBtn?.addEventListener('click', () => openDeleteGuard());
    cancelBtn?.addEventListener('click', () => closeDeleteGuard({ restoreFocus: true }));
    inputEl?.addEventListener('input', () => syncDeleteConfirmGuardUi());
    inputEl?.addEventListener('change', () => syncDeleteConfirmGuardUi());
    confirmBtn?.addEventListener('click', () => { void confirmDeleteAllData(); });

    accountTab?.addEventListener('click', () => { void requestPersistentStorageOnce(); });
    openSettingsBtn?.addEventListener('click', () => {
      if (browserWindow?.navigator?.storage) void requestPersistentStorageOnce();
      else renderStorageStatus();
    });

    browserWindow.addEventListener?.('riverline:languagechange', () => {
      renderStorageStatus();
      syncDeleteConfirmGuardUi();
    });

    renderStorageStatus();
    syncDeleteConfirmGuardUi();
  }

  bindUi();

  if (options.initialization && typeof options.initialization.then === 'function') {
    options.initialization.then(() => {
      if (browserWindow?.navigator?.storage) {
        return requestPersistentStorageOnce();
      }
      renderStorageStatus();
      return storageState;
    }).catch(() => {
      renderStorageStatus();
    });
  } else if (browserWindow?.navigator?.storage) {
    void requestPersistentStorageOnce();
  }

  const bridge = Object.freeze({
    schemaVersion: 'riverline-data-safety/v1',
    getStorageState: () => storageState,
    refreshStorageStatus: () => refreshStorageStatus(),
    requestPersistentStorageOnce: () => requestPersistentStorageOnce(),
    getRequiredConfirmWord: () => currentConfirmWord(),
    isConfirmationMatch: () => isConfirmationMatch(),
    openDeleteGuard: () => openDeleteGuard(),
    closeDeleteGuard: (opts) => closeDeleteGuard(opts),
    confirmDeleteAllData: () => confirmDeleteAllData(),
    deleteAllLocalData: () => deleteAllLocalDataAndReset(),
  });

  Object.defineProperty(browserWindow, 'RiverlineDataSafety', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });

  return bridge;
}
