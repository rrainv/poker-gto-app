import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp, text } from './helpers/app-under-test.mjs';
import { isRendered } from './helpers/mini-dom.mjs';

let persistCalls = 0;
let persistedCalls = 0;
let storagePersistedValue = true;

const app = await bootApp({
  beforeScripts(win) {
    win.navigator.storage = {
      async persist() {
        persistCalls += 1;
        return storagePersistedValue;
      },
      async persisted() {
        persistedCalls += 1;
        return storagePersistedValue;
      },
    };
  },
});

const {
  DELETE_CONFIRM_WORDS,
  KNOWN_RIVERLINE_DATABASES,
  STORAGE_PERSIST_MARKER_KEY,
  isIosBrowserTab,
} = await import('../app/src/application/data-safety.mjs');

test('DATA-SAFETY-001: requests persistent storage once at startup without nagging and renders persisted vs temporary + iOS tab status in Settings › Account & Data', async () => {
  await app.settle(200);

  // Requested exactly once after account identity initialization settles.
  assert.equal(persistCalls, 1, 'navigator.storage.persist() should be called once on startup');
  assert.ok(app.window.localStorage.getItem(STORAGE_PERSIST_MARKER_KEY), 'persistence marker stored in localStorage');

  // Open Settings › Account & Data.
  await app.click('#openSettings');
  await app.click('#settingsTabAccount');

  // Opening Settings or switching to Account & Data does not re-request persist().
  await app.window.RiverlineDataSafety.requestPersistentStorageOnce();
  assert.equal(persistCalls, 1, 'navigator.storage.persist() must never be called a second time');

  const statusEl = app.byId('settingsStorageStatus');
  const detailEl = app.byId('settingsStorageStatusDetail');
  const iosNoteEl = app.byId('settingsStorageIosNote');

  assert.equal(statusEl.dataset.storageStatus, 'persisted');
  assert.equal(text(statusEl), 'Persistent browser storage');
  assert.match(text(detailEl), /keep your local Riverline data/i);
  assert.equal(iosNoteEl.hidden, true, 'iOS tab note is hidden on non-iOS when storage is persisted');

  // When browser reports temporary storage, status and calm iOS tab note update honestly.
  storagePersistedValue = false;
  await app.window.RiverlineDataSafety.refreshStorageStatus();
  assert.equal(statusEl.dataset.storageStatus, 'temporary');
  assert.equal(text(statusEl), 'Temporary browser storage');
  assert.match(text(detailEl), /browser can clear temporary storage if device space runs low/i);
  assert.equal(iosNoteEl.hidden, false, 'calm install/back-up note is shown when storage is temporary');
  assert.match(text(iosNoteEl), /Add Riverline to the Home Screen or back up important work/i);

  // On an iOS Safari browser tab (non-standalone), the calm install/back-up note remains visible even if persisted() is true.
  const originalUa = app.window.navigator.userAgent;
  const originalStandalone = app.window.navigator.standalone;
  try {
    storagePersistedValue = true;
    app.window.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    app.window.navigator.standalone = false;
    assert.equal(isIosBrowserTab(app.window), true);
    await app.window.RiverlineDataSafety.refreshStorageStatus();
    assert.equal(statusEl.dataset.storageStatus, 'persisted');
    assert.equal(iosNoteEl.dataset.iosBrowserTab, 'true');
    assert.equal(iosNoteEl.hidden, false, 'iOS Safari tab keeps install/back-up note visible');

    // Once installed to Home Screen (standalone), it is no longer an iOS browser tab.
    app.window.navigator.standalone = true;
    assert.equal(isIosBrowserTab(app.window), false);
    await app.window.RiverlineDataSafety.refreshStorageStatus();
    assert.equal(iosNoteEl.dataset.iosBrowserTab, 'false');
    assert.equal(iosNoteEl.hidden, true);
  } finally {
    app.window.navigator.userAgent = originalUa;
    app.window.navigator.standalone = originalStandalone;
    await app.window.RiverlineDataSafety.refreshStorageStatus();
  }
});

test('DATA-SAFETY-001: Delete all data is strongly guarded with warning list, localized type-to-confirm (EN/RU/HE), cancel, and full local deletion', async () => {
  if (!app.byId('settingsModal').classList.contains('show')) {
    await app.click('#openSettings');
  }
  if (app.byId('settingsAccountProfile').hidden) {
    await app.click('#settingsTabAccount');
  }

  const openBtn = app.byId('settingsDeleteAllDataOpen');
  const guardEl = app.byId('settingsDeleteAllDataGuard');
  const warningEl = app.byId('settingsDeleteAllDataWarning');
  const listEl = app.byId('settingsDeleteAllDataList');
  const promptEl = app.byId('settingsDeleteAllDataPrompt');
  const inputEl = app.byId('settingsDeleteAllDataInput');
  const confirmBtn = app.byId('settingsDeleteAllDataConfirm');
  const cancelBtn = app.byId('settingsDeleteAllDataCancel');
  const statusEl = app.byId('settingsDeleteAllDataStatus');

  // Guard is closed at rest.
  assert.equal(guardEl.hidden, true);
  assert.equal(isRendered(guardEl), false);
  assert.equal(openBtn.getAttribute('aria-expanded'), 'false');
  assert.equal(confirmBtn.disabled, true);

  // Open the Delete all data guard.
  await app.click('#settingsDeleteAllDataOpen');
  assert.equal(guardEl.hidden, false);
  assert.equal(isRendered(guardEl), true);
  assert.equal(openBtn.getAttribute('aria-expanded'), 'true');
  assert.match(text(warningEl), /permanently deletes all local data/i);

  const items = [...listEl.querySelectorAll('li')].map((li) => text(li));
  assert.equal(items.length, 5);
  assert.ok(items.some((item) => /Saved Hands and Saved Spots/i.test(item)));
  assert.ok(items.some((item) => /Personal Strategy/i.test(item)));
  assert.ok(items.some((item) => /Training Memory/i.test(item)));
  assert.ok(items.some((item) => /Home Game/i.test(item)));
  assert.ok(items.some((item) => /Local profiles, custom themes, and device preferences/i.test(item)));

  // Wrong or lowercase confirmation words keep confirm disabled and block deletion.
  app.window.localStorage.setItem('riverline_test_sentinel', 'keep-me');
  app.window.sessionStorage.setItem('riverline_session_sentinel', 'keep-me-too');
  for (const wrong of ['', 'del', 'delete', 'УДАЛИТЬ', 'מחק']) {
    await app.setValue('#settingsDeleteAllDataInput', wrong);
    assert.equal(confirmBtn.disabled, true, `should stay disabled for "${wrong}" in EN`);
  }
  await app.click('#settingsDeleteAllDataConfirm', { force: true });
  assert.equal(app.window.localStorage.getItem('riverline_test_sentinel'), 'keep-me');

  // Exact English word "DELETE" enables confirmation.
  await app.setValue('#settingsDeleteAllDataInput', DELETE_CONFIRM_WORDS.en);
  assert.equal(promptEl.dataset.confirmWord, 'DELETE');
  assert.equal(confirmBtn.disabled, false);

  // Switching language to Russian updates the required word to "УДАЛИТЬ" and disables confirm until matched.
  app.window.RiverlineI18n.setLanguage('ru');
  await app.flush();
  assert.equal(promptEl.dataset.confirmWord, 'УДАЛИТЬ');
  assert.match(text(promptEl), /УДАЛИТЬ/);
  assert.equal(confirmBtn.disabled, true, 'English word must not satisfy Russian confirmation');

  await app.setValue('#settingsDeleteAllDataInput', DELETE_CONFIRM_WORDS.ru);
  assert.equal(confirmBtn.disabled, false, 'Russian word УДАЛИТЬ enables confirm in RU');

  // Switching language to Hebrew updates the required word to "מחק" and disables confirm until matched.
  app.window.RiverlineI18n.setLanguage('he');
  await app.flush();
  assert.equal(promptEl.dataset.confirmWord, 'מחק');
  assert.match(text(promptEl), /מחק/);
  assert.equal(confirmBtn.disabled, true, 'Russian word must not satisfy Hebrew confirmation');

  await app.setValue('#settingsDeleteAllDataInput', DELETE_CONFIRM_WORDS.he);
  assert.equal(confirmBtn.disabled, false, 'Hebrew word מחק enables confirm in HE');

  // Cancel closes the guard, resets input, and preserves all data.
  await app.click('#settingsDeleteAllDataCancel');
  assert.equal(guardEl.hidden, true);
  assert.equal(openBtn.getAttribute('aria-expanded'), 'false');
  assert.equal(inputEl.value, '');
  assert.equal(confirmBtn.disabled, true);
  assert.equal(app.window.localStorage.getItem('riverline_test_sentinel'), 'keep-me');

  // Return to English, reopen guard, type DELETE, and confirm deletion.
  app.window.RiverlineI18n.setLanguage('en');
  await app.flush();

  // Seed a database in fake IndexedDB to verify all Riverline databases are deleted.
  await new Promise((resolve, reject) => {
    const req = app.window.indexedDB.open(KNOWN_RIVERLINE_DATABASES[1], 1);
    req.addEventListener('success', () => {
      req.result.close();
      resolve();
    }, { once: true });
    req.addEventListener('error', () => reject(req.error), { once: true });
  });
  const beforeDbs = await app.window.indexedDB.databases();
  assert.ok(beforeDbs.length >= 1, 'at least one Riverline IndexedDB database exists before deletion');

  await app.click('#settingsDeleteAllDataOpen');
  await app.setValue('#settingsDeleteAllDataInput', 'DELETE');
  assert.equal(confirmBtn.disabled, false);

  await app.click('#settingsDeleteAllDataConfirm');
  await app.settle(100);

  const afterDbs = await app.window.indexedDB.databases();
  assert.deepEqual(afterDbs, [], 'all Riverline IndexedDB databases are deleted');
  assert.equal(app.window.localStorage.length, 0, 'localStorage is cleared');
  assert.equal(app.window.sessionStorage.length, 0, 'sessionStorage is cleared');
  assert.equal(guardEl.hidden, true, 'guard closes after deletion');
  assert.equal(statusEl.hidden, false, 'deletion status message is shown');
  assert.equal(text(statusEl), 'All local data has been deleted from this browser.');
});
