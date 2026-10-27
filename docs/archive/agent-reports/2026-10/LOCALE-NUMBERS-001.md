# LOCALE-NUMBERS-001 (B7): finished by Claude after Argon quota

Ticket: B7-TAKEOVER-001 · Correctness · T1 (+ full suite once) · branch `argon/m1-batch-3` (base `a9b2578`)
Issues: EQ-LOCALE, QA-DECISION-INPUT-009, QA-SWEEP-022, QA-LANGUAGE-SWITCH-003 (new: LOCALE-NUMBERS-002)

## 1. Outcome

- **EQ-LOCALE (Fixed).** User-facing numbers go through one formatter, `app/src/application/locale-number-format.mjs`, keyed to the UI language (en/ru/he), never the OS locale. English shows `12.3`, `1,234,567`; Russian `12,3`, `1 234 567`; Hebrew `12.3`. Unknown values render `-`, never `0`, and a value rounding to zero never shows `-0`. The root cause was bare `toLocaleString()` calls (OS locale) plus scattered `toFixed`.
- **QA-DECISION-INPUT-009 (Fixed).** The Equity random-card status ("Random {street} ready.", "New cards for N Known hands.") belongs to its card stage: any change of players, board or dead cards retires it; calculating does not. A language switch re-words it instead of clearing it. Training Memory rows now use the facing summary ("Unopened · 1 bb to call"), as Saved Training history already did, so "Facing N bb" is gone.
- **QA-SWEEP-022 (Fixed).** "Random private cards ready." was already translated; the bug was that the Hand and Equity status kept the language it was first written in. Both now re-word on a switch, including the street word inside the sentence. Russian prose that still said "Training Memory" / "Approach" / "Training" now uses «история тренировок», «подход», «тренировок» (TERMINOLOGY.md); Hebrew uses «זיכרון האימונים».
- **QA-LANGUAGE-SWITCH-003 (Partial).** 11 static `data-i18n` keys removed from elements the code owns (`playbookModeStatus`, `liveContextText`, `savedSpotViewerTitle/Truth`, `tightnessLabel`, `oppTightnessLabel`, `handSessionBadge`, `savedHandViewerTitle`, `handSetupCompactSummary`, `handSetupDisclosureState`, `handStartButton`); the language refresh re-renders them in their current state. About 45 remain (see §5).

## 2. What Argon did, and what I kept, changed or dropped

Argon's WIP was backed up first: `C:\Users\sjzns\Projects\Riverline_archive\argon-b7-wip-2026-10-26.patch` (tracked diff), `…untracked.txt` and `argon-b7-wip-untracked/` (the new formatter as Argon left it).

Kept (reviewed and correct):
- The new formatter module and the ~60 `toFixed`/`toLocaleString` replacements in `logic.js`, `advanced-equity-workspace.mjs`, `exploit-teacher-workspace.mjs`, `personal-strategy-hand-workspace.mjs`, `teacher.js`, `TableRenderer.js`.
- `decision-facing-summary.mjs` / `training-memory-row-format.mjs` taking a `language`; Training Memory rows switched to `facing: 'summary'`.
- RU/HE prose fixes in `i18n.js` and `opponent-learning-language.mjs`.
- Removal of 11 static keys in `index.html` and most of the language-refresh additions in `logic.js` (default copy for code-owned elements, tightness labels, best sizing, wheel centre, street label, Training Memory status replay, hint button and study hints).

Changed:
- **One formatter, not two.** Argon pasted a full copy of the formatter into `i18n.js`. Removed; the module is the only implementation. A new `locale-number-format-bootstrap.mjs` (repo's `*-bootstrap.mjs` pattern) installs `createLocaleNumberFormatBridge()` as `window.RiverlineLocaleNumberFormat`, loaded right after `i18n.js`, before every classic script. `logic.js`, `teacher.js` and `TableRenderer.js` are thin delegates with no own `Intl` fallback. The core module has no side effects, so tests can import it before or after boot.
- **Unknown is `-`.** Argon's formatter returned `'0'` / `'0 bb'` for non-finite input; now `-`.
- **`teacher.js` crash.** Argon's edit called `formatExplainNumber`, which does not exist (ReferenceError whenever an explanation carried confidence or coverage). Now uses the shared formatter.
- **Equity status.** Argon tied it to a stage key that included the Equity lifecycle, so Calculate cleared it, and it still cleared on a language switch. The key is now cards only; the message and its replacements are stored and re-rendered (`renderEquityRandomizationStatus`). Replacements may be a function, so the street or player label is re-read in the current language.
- **Hand status.** Argon replayed the message key on a switch but froze the translated street word; the street is now re-translated.
- **Matrix on language switch.** Argon's refresh rendered the Matrix whenever its grid had cells, even while hidden: hidden Matrix work (PERF-001). Hidden surfaces are now only marked dirty and render when shown; idle copy is set only for never-rendered surfaces.
- **Training on language switch.** Argon's refresh called `setTrainingWorkspaceState(lifecycle)` (could change what is shown; violates "language switch is presentation-only") and re-ran `renderTrainingGenerationError` (side effects, console error, state reset). Replaced with pure re-rendering: `renderTrainingStateBadge(currentState)` and `trainingGenerationErrorCopy(error)` (extracted, no side effects).
- **Range Calibration** percentage labels (4 sites) now use the formatter too.

Dropped:
- Argon's additions to `analysis-translations.js` ("Random private cards…"): exact duplicates of entries already in `product-translations.js`, plus an EN identity entry.
- Argon's RU change of "Explain last decision" to «…последнее решения» (ungrammatical); restored «…последнее решение».

## 3. Files

Changed by this ticket:
`app/index.html`, `app/src/application/locale-number-format.mjs` (new), `app/src/application/locale-number-format-bootstrap.mjs` (new), `app/src/application/advanced-equity-workspace.mjs`, `app/src/application/decision-facing-summary.mjs`, `app/src/application/exploit-teacher-workspace.mjs`, `app/src/application/opponent-learning-language.mjs`, `app/src/application/personal-strategy-hand-workspace.mjs`, `app/src/application/range-calibration-workspace.mjs`, `app/src/application/training-memory-row-format.mjs`, `app/src/core/logic.js`, `app/src/locales/i18n.js`, `app/src/ui/TableRenderer.js`, `app/src/ui/teacher.js`, `tests/locale_numbers001.test.mjs` (new), `tests/helpers/locale-number-sandbox.cjs` (new), `tests/qa002_adapters.js`, `tests/uiqa001r_card_picker_adapter.mjs`, `tests/truth_surfaces002.test.mjs`, `tests/analysis_range001_integration.test.mjs`, `tests/beta_design_refresh001.test.mjs`, `tests/equity_closeout001.test.mjs`, `docs/ISSUE_REGISTER.md`, this report.

Test harness changes (why): several older harnesses run slices of `logic.js` / `teacher.js` / `TableRenderer.js` in a vm sandbox; they now get the bridge and the `formatUi*` delegates from `tests/helpers/locale-number-sandbox.cjs` (built from the core module, never the page bootstrap, so a harness loaded before `bootApp()` cannot pre-cache the bootstrap). The card-picker adapter stubs the new Equity status reconcile like its other out-of-scope renderers. `equity_closeout001` compared the page's percentages with JS `toFixed`; ICU and `toFixed` can round binary edge cases differently (seen: a tie share), so it now compares with the shared formatter. No assertion was weakened.

Pre-existing dirty files: none besides Argon's WIP above (all of it is accounted for in §2). Not committed: `.claude/launch.json` (local preview config for this session, port 3107).

## 4. Verification

- `node --test tests/locale_numbers001.test.mjs`: 10/10 pass (also inside the full suite) (formatter EN/RU/HE, unknown and `-0`; facing summary and Training Memory rows in RU; booted app: the Analyze pot fact uses a decimal point in EN, a comma in RU and a point again back in EN; Equity status follows cards not lifecycle and re-words on switch; street word re-translated; Training Memory rows have no "Facing N bb"; the 11 de-keyed elements carry no key, are re-worded in RU and round-trip to EN; a code-written slider label survives a switch). First runs failed 7/10 because the window bridge was installed as a side effect of the core module and the test imported it before boot; fixed by the bootstrap module (see §2), then a test-only translator bug.
- `node --check` on all changed/new JS/MJS files: OK.
- First full-suite run: 2793 tests, 2769 pass, 21 fail, 2 todo (pre-existing `TEST-HYGIENE-001` TODOs). All 21 traced to this ticket: 20 sandbox harnesses missing the new helpers/bridge, 1 `toFixed` comparison (see §3). Fixed as described; a rerun of the 11 affected files then exposed 17 more failures hidden behind the first ones (my first helper loaded the bootstrap and pre-cached it, so booted pages had no bridge; the card-picker adapter needed the reconcile stub), both fixed.
- `git diff --check`: OK. LF: no CR in any changed or new file; `git diff --stat` proportionate (no line-ending churn).
- Full suite `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`, final run: **2793 tests, 2790 pass, 0 fail, 1 skipped, 2 todo** (the two TODOs are the pre-existing `TEST-HYGIENE-001-F01` / `-F07` Equity CSS-target findings).
- Browser (dev server on port 3107, 1920×1080, Midnight/dark): **PARTIAL.** The app booted in Russian (browser language), covering the boot-in-RU path. Equity, RU: random matchup gave grouped counts «Комбинации: 2 097 572 400» and the status in Russian. Switched to EN: the same counts read `2,097,572,400`, the status survived the switch re-worded as "New cards for 1 Known hands."; Calculate showed `9,000 / 10,000 trials` while running (status kept, as designed) and results `48.1%` / `51.9%`. Switching back to RU after the result, Analyze numbers and the Training Memory panel in the browser: **UNVERIFIED** (the auto-mode permission check repeatedly failed on browser actions, "no verdict"); covered only behaviourally by the booted-app tests, which are not visual acceptance. HE not checked (no layout or direction change). The steps above ran before the final bridge refactor (same formatting code, bridge then installed by the core module); after the refactor a reload showed both `locale-number-format-bootstrap.mjs` and `locale-number-format.mjs` served 200 and no script errors at boot (console errors: only the expected 404s, `auth-config.js` is a local uncommitted file). Visual acceptance remains the owner's.
- Solver suite: not run (no domain/solver/strategy change).

## 5. Limitations and debt

- **QA-LANGUAGE-SWITCH-003 stays Partial.** About 45 elements still carry static keys the code overwrites: Hand live stage (`handLiveStage*`, `handDeal*`, `handChance*`, sizing presets, save buttons), Training (`trainingInstruction`, `trainingCurrentActor`, `trainingNextHandBtn`, error/feedback copy, setup summary/title), Matrix/Range idle copy, account menu, calibration, `methodBadge`/`equityStatus`, card picker title. Most are already re-rendered by the language refresh, so the static key is harmless today; removing each key needs a verified code render at boot and on switch. Hand elements are not re-rendered when a Hand exists but Analyze is in Scenario mode.
- **Boot-time refresh.** Argon added `refreshLocalizedRuntime()` once at init for non-English boots (kept: it is the same path a language switch runs and re-renders from existing state without resolving strategy). It costs one extra presentation pass at boot in RU/HE.
- **LOCALE-NUMBERS-002 (new row).** Explain text values from `analysis-explanation.mjs` (`percent()`, `bb()`), `heuristic-strategy.mjs` explanation percents and the `gameStateUpdate` pot are still formatted in English; fixing them means passing the language into explanation creation or formatting at render.
- Pre-existing, not touched: the Explain footer shows "Confidence N%" (DESIGN_SYSTEM says no numeric confidence percentages).

## 6. Disagreements or doc conflicts

- The ticket says "remove stale static data-i18n keys on elements the code overwrites". The code already uses a second, equally valid pattern on some elements (`trainingWorkspaceTitle`, `trainingGeneratingTitle`): it rewrites `data-i18n` to the current key, so a switch re-translates correctly. Worth an owner decision on one pattern before finishing QA-LANGUAGE-SWITCH-003.

## 7. Git status

Committed on `argon/m1-batch-3` as "B7 LOCALE-NUMBERS-001 (finished by Claude after Argon quota)" with the exact file list in §3 (no broad staging), and pushed that branch only. Nothing merged; `codex/stabilization` and the main folder untouched; `docs/STATE.md` not edited. Left uncommitted: `.claude/launch.json` (local preview config).
