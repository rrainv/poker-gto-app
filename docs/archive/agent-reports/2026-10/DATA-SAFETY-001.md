# DATA-SAFETY-001 — Persistent Storage Request, Honest Storage Status & Guarded "Delete All Data"

- **Agent:** Gemini Argon
- **Branch:** `argon/m1-batch-2`
- **Tier:** T1
- **Date:** 2026-10-26

## Summary of Changes

1. **One-Time Persistent Storage Request & Honest Status (`app/src/application/data-safety.mjs`, `app/src/application/account-identity-bootstrap.mjs`, `app/index.html`, `app/styles.css`)**
   - Added `installDataSafetyController` (wired through `installAccountIdentityBridge`) to request `navigator.storage.persist()` once after local account identity initialization settles (or when Settings › Account & Data is opened if storage persistence becomes available later), guarded by `riverline.storagePersistence.v1` and an in-memory flag so it never nags or repeats.
   - Added the `Browser storage` status row (`#settingsStoragePersistenceRow`) to `#settingsAccountProfile` in Settings › Account & Data showing:
     - `Persistent browser storage` (`data-storage-status="persisted"`) vs `Temporary browser storage` (`data-storage-status="temporary"`), with honest explanatory copy (`#settingsStorageStatusDetail`).
     - A calm install/back-up note for iPhone/iPad browser tabs (`#settingsStorageIosNote`) explaining Safari's 7-day inactivity eviction for browser tabs and suggesting Home Screen installation or backing up important work.

2. **Strongly Guarded "Delete All Data" (`app/src/application/data-safety.mjs`, `app/index.html`, `app/styles.css`)**
   - Added `<section id="settingsDeleteAllDataSection">` in Settings › Account & Data with trigger `#settingsDeleteAllDataOpen` and hidden confirmation guard `#settingsDeleteAllDataGuard`.
   - Opening the guard displays a clear warning (`#settingsDeleteAllDataWarning`) and an explicit 5-item list (`#settingsDeleteAllDataList`) of what will be deleted (Saved Hands/Spots, Personal Strategy/Range Calibration, Training Memory, Home Game records, and local profiles/themes/preferences).
   - Required exact type-to-confirm matching the user's active language (`DELETE` in English, `УДАЛИТЬ` in Russian, `מחק` in Hebrew) before `#settingsDeleteAllDataConfirm` enables or executes; switching language live re-validates the input against the new language's confirmation word.
   - Confirming deletes all Riverline IndexedDB databases (`riverline-account-identity`, `riverline-saved-study-objects`, `riverline-personal-strategy`, `riverline-training-memory`, `riverline-home-game`, `riverline-sync`, plus any enumerated databases), clears `localStorage` and `sessionStorage`, closes the guard, and announces completion in `#settingsDeleteAllDataStatus`.

3. **Translations & Behavioural Tests (`app/src/locales/account-translations.js`, `app/src/locales/product-translations.js`, `tests/data_safety001.test.mjs`)**
   - Added complete EN, RU, and HE translations following `docs/TERMINOLOGY.md` (no em/en dashes; Russian infinitive and Hebrew masculine imperative for action buttons).
   - Added `tests/data_safety001.test.mjs` covering one-time `navigator.storage.persist()`, `persisted` vs `temporary` status, iOS Safari tab vs standalone detection, warning list, localized type-to-confirm across EN/RU/HE, cancel, and full IndexedDB + `localStorage` + `sessionStorage` deletion.

## Verification

- `node --check app/src/application/data-safety.mjs`
- `node --check app/src/application/account-identity-bootstrap.mjs`
- `node --check app/src/locales/account-translations.js`
- `node --check app/src/locales/product-translations.js`
- `node --test --test-concurrency=4 tests/data_safety001.test.mjs tests/settings_ia001.test.mjs tests/i18n001_runtime_integrity.test.mjs tests/account001_identity_foundation.test.mjs` — `35 pass, 0 fail`
