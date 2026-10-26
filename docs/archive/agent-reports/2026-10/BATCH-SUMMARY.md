# M1 Batch Summary (`argon/m1-batch-2`)

- **Agent:** Gemini Argon
- **Branch:** `argon/m1-batch-2` (based on `origin/codex/stabilization` @ `0105083`, `MERGE-001`)
- **Date:** 2026-10-26

## Rebase / Patch Re-Application Conflict Report (B4 onto `0105083`)

- Saved uncommitted B4 diff outside the repo (`C:\Users\sjzns\AppData\Local\Temp\b4-truth-surfaces-002.patch`), fetched `origin`, created `argon/m1-batch-2` from `origin/codex/stabilization` (`0105083`), and applied the B4 patch cleanly with zero merge conflicts.
- Preserved both `MERGE-001` (`0105083`) follow-ups:
  1. `app/styles.css` keeps `[data-hand-stage]` in the live-stage rule and excludes `private-cards` and `reveal` (`#gtoMode[data-product-destination="hand"] .hand-table-stage[data-hand-stage]:not([data-hand-stage="setup"]):not([data-hand-stage="private-cards"]):not([data-hand-stage="reveal"])`).
  2. `tests/helpers/browser-app.mjs` keeps failing runtime-appended skipped scripts (`if (src && skip.has(src)) queueMicrotask(() => node.onerror?.(new dom.Event('error')));`).

## Ticket Status (One Line per Ticket)

- **B0 (`AGENT-POLICY-001`)** — **Done** (merged in `0105083`): Multi-agent work policy, verification tiers, and report conventions added to `AGENTS.md`.
- **B1 (`MOCKUP-ASSETS-001`)** — **Done** (merged in `0105083`): Real SVG card backs, stroke icons, and table geometry measurements extracted into `docs/mockups/v4-design-kit-assets.js` and wired into `docs/mockups/v4-design-kit.html`.
- **B2 (`I18N-RESIDUE-001`)** — **Done** (merged in `0105083`): Remaining RU/HE terminology residue aligned with `docs/TERMINOLOGY.md` across `.mjs` modules and locale catalogs (`I18N-TERMS-RESIDUE`).
- **B3 (`CLEANUP-PREP-001`)** — **Done** (merged in `0105083`): Unbundled Supabase UMD script removed from `app/index.html` and guarded dynamically, exact-match CSS hex/rgba literals replaced with `:root` tokens, 106 redundant `!important` declarations removed, and `TEST-HYGIENE-001-F04` / `F06` fixed.
- **B4 (`TRUTH-SURFACES-002`)** — **Done** (`3380ff0`): Single provenance indicator per surface (Analyze, Training feedback, Hand Review, Personal Strategy comparison), 5% estimated strategy mix rounding with `< 5%` sub-threshold filtering, and strict two-state verdict dominance rule (`>= 70%` or `>= 15` pp lead).
- **B5 (`DOMAIN-MATH-001`)** — **Done** (`9afb6a6`): Canonical `deriveActorPotBeforeActionBb`, `deriveStackToPotRatio`, and `deriveMinimumDefenseFrequency` / `deriveMinimumDefenseFrequencyPercent` selectors added in `shared/poker-domain`, UI inline arithmetic removed from `app/src/core/logic.js`, and numeric `amountMilliBb` / `amountBb` carried on `training-presentation.mjs` entries instead of `parseFloat(entry.amountLabel)`.
- **B6 (`DATA-SAFETY-001`)** — **Done** (`4700646`): One-time `navigator.storage.persist()` request with honest `persisted` vs `temporary` status and calm iOS Safari tab install/back-up note in Settings › Account & Data, plus strongly guarded "Delete all data" with warning list and localized type-to-confirm (`DELETE` / `УДАЛИТЬ` / `מחק`).

## Full Test Suite Result

- Command: `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`
- Result: **2771 total, 2766 pass, 0 fail, 1 skipped, 4 todo** (duration ~373.6s, 0 reruns needed).
