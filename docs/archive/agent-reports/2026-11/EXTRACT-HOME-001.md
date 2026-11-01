# EXTRACT-HOME-001: Home out of logic.js into a mounted module

Ticket: EXTRACT-HOME-001 · Correctness/Architecture (refactor) · T1 + full suite once · Claude Code (Opus 5.5)
Branch: `claude/extract-home-module-35e83a` (worktree), base `codex/stabilization` `d164f70`. Nothing staged or committed.

## 1. Outcome

Home now lives in `app/src/application/home-workspace.mjs`, a mounted controller:
`mount(container, deps)` returns `{ dispose, refreshLanguage, handleKey, setVisible }` plus the hooks logic.js calls (`refresh`, `schedule`, `render`, `applyDestination`, `ownerChanged`, `getModel`). logic.js mounts it once on `#homeMode` at init (and lazily on first use) and passes only injected accessors and callbacks, never `window.app`.

- `logic.js`: **15,361 → 14,880 lines (−481)**. It only shrank.
- Before and after screenshots in Firefox are **byte-identical** (SHA-256) at 1920 EN Midnight, 1366 EN Midnight and 1920 HE Midnight.
- The 20 new characterization tests were written and passing **before** any code moved, and pass **unchanged** after.
- Same DOM ids and classes. No CSS changes, no copy changes, no translation changes.

## 2. Step 0: inventory (current line numbers at `d164f70`)

| Function / state (logic.js before) | What it touches | Decision |
|---|---|---|
| `homeViewModel`, `homeRefreshSequence`, `homeRefreshTimer` (8472-8476) | Home model, owner fence, coalescing timer | **Moved** (controller-private `model`, `refreshSequence`, `refreshTimer`) |
| `savedLibraryController`, `savedTrainingHistoryController`, `activeSavedSpotContext`, `savedScenarioOwnerActive` | Saved / Analyze state | **Stays** (Saved, not Home) |
| `welcomeOrientationIsVisible` | shell `data-welcome-orientation` | Stays; injected as `welcomeVisible()` |
| `activateNavigationItem` | shell nav | Stays; calls the `applyHomeDestinationPresentation` facade |
| `resolveHomeDestinationPresentation` (pure) | none | **Moved** (exported) |
| `setTranslatedElement` | generic | Stays (also used for `#workspaceTitle`); the module has its own 4-line helper |
| `applyHomeDestinationPresentation` | `#homeMode`, sections, Study Inbox, guest copy | **Moved** → `applyDestination`; a 3-line facade stays (called by `activateNavigationItem`) |
| Playbook destination, `navigateToWorkspace`, `navigateToProductDestination`, `revealHomeDestination` | shell | Stay; `navigate` injected |
| `returnToHomeLiveHand` | Hand bridge, Playbook mode, Saved spot viewer | Stays (all Hand internals); injected as `returnToLiveHand()` |
| `homeEmptyState`, `homeEmptyAction` | Home DOM | **Moved** |
| `homeRecency` | Intl | **Moved to the shared `saved-item-presentation.mjs`** as `savedItemRecency(iso, locale)`, used by Home and the Saved library (one copy, no Saved → Home dependency) |
| `homeSavedItemTitle` | `RiverlineSavedItemPresentation.title` | Deleted; Home imports `savedItemTitle`; the Saved library mount calls the shared presentation directly |
| `homeSavedItemFacts`, `createHomeSavedItemElement` | Home rows | **Moved** (`homeSavedItemFacts` exported) |
| `syncSavedLibraryVisibility`, `openSavedTrainingHistoryRedrill`, `editSavedLibraryItem`, `archiveSavedLibraryItem`, `mountSavedLibraryWorkspace` | Saved | Stay; `syncSavedLibraryVisibility` injected |
| `renderHomeContinue`, `renderHomeRecent`, `renderHomeReviewGroup`, `renderHomeReview`, `homeSyncCopy`, `renderHomeAccountOverview`, `renderHomeReviewMistakesLink`, `renderHomeWorkspace`, `beginHomeLoading` | Home DOM, header, tutorials | **Moved** |
| `renderHomePersonalStrategy` | `#homeStrategyContent`, which does not exist in index.html | **Deleted** (dead; HOME-INVENTORY-001 §1.1, register TEST-HYGIENE-001-F02), together with the dead `strategy`/`other` section keys and the `#homePersonalStrategyContent` clear |
| `clearSavedScenarioOwnerPresentation` | Analyze | Stays |
| `clearSavedOwnerPresentation` | Home + Saved + Hand + Analyze reset | Stays as the coordinator; its Home lines became `homeWorkspace()?.ownerChanged()` |
| `refreshHomeWorkspace`, `scheduleHomeRefresh` | bridge load, fences, timer | **Moved** → `refresh` / `schedule`; one-line facades stay (8 callers in logic.js, many page-level spies) |
| `restoreSavedSpotPresentation`, `renderSavedSpotViewer` | Analyze / Saved | Stay |
| `openHomeSavedItem` | Saved-open orchestration (Home, Saved, Study Inbox) | Stays (HOME-INVENTORY-001); injected as `openSavedItem(id, control)` |
| `openImportedHandWorkspace` | Hand/import | **Stays** (see §6) |
| `callHomeBridge` | `window.RiverlineHome` | Stays (also used by `openHomeSavedItem`); Home loads go through the injected `load()` → `callHomeBridge('load')` |
| `bindEvents` Home click branches | `[data-home-destination]`, `[data-home-action]`, `[data-home-saved-id]` on `document` | **Moved**: one delegated listener on `#homeMode` (every `data-home-*` control lives inside it) |
| hub `showHub(..., { homeModel })`, `mode === 'home'` navigation, language and card-style re-render | callers | Now `getModel()`, `setVisible(true, { destination })`, `refreshLanguage()` |

## 3. Injected deps

`translate`, `locale`, `load`, `activeMode`, `activeDestination`, `welcomeVisible`, `header` (→ `window.RiverlineWorkspaceHeader`), `tutorials` (→ `window.RiverlineTutorials`), `navigate`, `showSavedMistakes`, `returnToLiveHand`, `openAccount`, `openSavedItem`, `syncSavedLibraryVisibility`, `clearOwnerPresentation`, `reportError`, `setTimer`, `clearTimer`. Every dep is a late-bound arrow in logic.js, so page-function spies and overrides still apply, and every bridge is read at call time.

**Fences, unchanged semantics.** Each load takes a new sequence number. `ownerChanged()` (called by `clearSavedOwnerPresentation`), a newer refresh and `dispose()` bump it. A result with a stale number, or one that arrives when Home is no longer the active mode, is dropped; a stale failure is not reported. `schedule({ clearPrivateState: true })` clears private content at once, through the logic.js coordinator, before the 80 ms coalesced load. There is no load while the welcome orientation shows. The lifecycle-generation fence in `openHomeSavedItem` is untouched. Two additions: `dispose()` drops in-flight loads and the timer, and a disposed controller never loads again.

## 4. Files

Changed by this ticket:
- `app/src/application/home-workspace.mjs` (new, 555 lines)
- `app/src/core/logic.js` (−481 net)
- `app/src/application/saved-item-presentation.mjs` (+`savedItemRecency`, exposed as `RiverlineSavedItemPresentation.recency`)
- `app/index.html` (+1 module script tag, `home-workspace.mjs`, placed before `logic.js`)
- `tests/home_workspace_characterization.test.mjs` (new, 20 tests)
- `tests/home_workspace_controller.test.mjs` (new, 6 tests)
- 11 existing tests updated (see §5)
- `docs/ISSUE_REGISTER.md` (rows, see §7)
- this report

Pre-existing dirty files: none (the worktree started clean).

## 5. Verification

- **Characterization first.** `node --test tests/home_workspace_characterization.test.mjs` passed 20/20 on unmodified `d164f70`, then 20/20 after the move with the file unchanged. It covers: first visit and returning (guest and account), every `homeSyncCopy` branch, Continue (live hand, calibration, both, primary rule, actions), Recent and Review (ready, empty, error, spot vs hand rows, badges, Review Mistakes link and its Saved filter), Review issue, the owner-switch fence, the stale-failure fence, leaving Home mid-load, 80 ms coalescing, preserveVisible, no refresh away from Home or behind the welcome orientation, the language switch EN → RU → HE → EN with no second load, header description, context and chip, the Home vs Saved destination and the hub model, Home and Saved tour anchors and the tour offer, Saved reopen (one bridge call, busy state, error toast, lifecycle fence), the imported-hand event guard, and a PERF-001 guard.
- **Controller contract:** `tests/home_workspace_controller.test.mjs` 6/6 (mounted once with one listener; the module uses deps only; `handleKey` returns false; `setVisible`; `refreshLanguage` only while Home is active; `dispose` removes the listener, cancels the timer and drops in-flight loads; a fresh mount works).
- **Existing tests updated**, each because it read a moved logic.js name:
  - `core_flow001_navigation`: `resolveHomeDestinationPresentation` → module export; `renderHomeRecent`/`renderHomeContinue` → `controller.render`; dropped the dead `renderHomePersonalStrategy` call.
  - `first_use_home001`: the `beginHomeLoading` spy → DOM check (aria-busy and the loading state are unchanged).
  - `home001_integration`: render via the controller; dropped the dead Personal Strategy card block (it injected its own `#homeStrategyContent`); the refresh spies now count `callHomeBridge`, because navigation and the timer reach the controller directly.
  - `home002a_account_dashboard`: the `renderHomeWorkspace` spy → renders counted through `RiverlineTutorials.offerForWorkspace` (one per render).
  - `identity_lifecycle001b`: planted `homeViewModel` → `controller.render` plus `getModel()`.
  - `saved_composition002`: the window-bridge title spy → compare a rendered Home row with the shared title; `homeSavedItemFacts` → module export.
  - `saved_library001`: the `createHomeSavedItemElement` spy → DOM rows; dropped the `activeNavigationDestination` count (a full render applies the destination presentation).
  - `saved_visual_knowledge001`: `homeSavedItemFacts`/`homeRecency` → module and shared presentation; `homeRefreshSequence` → `getModel()` null plus content hidden; refresh spy → `callHomeBridge`.
  - `shell001_workspace_header`, `tutorial001_integration`, `welcome_intro001`: `renderHomeContinue`/`renderHomeWorkspace`/`homeViewModel` → controller.
- **Focused Home group** (22 files, `--test-concurrency=2`): 232/233. The one failure is the flake below.
- `node --check` on every changed .js/.mjs: OK. `git diff --check`: clean; new files checked with `git diff --no-index --check`: clean. All LF.
- **Full suite** `node --test --test-concurrency=2 tests/*.test.js tests/*.test.mjs`:
  - First run: 2905 tests, 2901 pass, 1 fail (`uiqa001r_regression_repair` "root rank preference…"), 1 skipped, 2 todo.
  - That failure **was caused by this ticket**: the test slices `bindEvents` out of logic.js with a naive brace scanner. My new comment there had an apostrophe, and the mount call is not one of its sandbox stubs. Fixed in code: the comment is reworded and `mountHomeWorkspace()` moved from `bindEvents` to init, next to `mountSavedLibraryWorkspace()`. The test file is unchanged and now passes.
  - Final run (after that fix): 2905 tests, 2900 pass, 2 fail, 1 skipped, 2 todo. Both failures are in `training_quick_drill_workspace_characterization`: "owner / sign-out switch…" timed out on a 10 s real-time `waitFor` for a decision, and "session end…" then failed because the drill cards were still inert (a cascade).
  - Those two tests passed in the first full run, pass 2/2 alone and 3/3 in a concurrency-4 group with the Home, Saved and identity tests. I read this as load timing, but it is **not proven**: register row QUICKDRILL-WAITFOR-FLAKE. The `saved_composition002` flake below passed in both full runs.
  - A third full run was not done (the ticket asks for one).
- **Pre-existing flake** `saved_composition002` "Training history keyboard browsing coalesces the Saved lookup…": fails 3 of 4 runs alone on the untouched base checkout (`d164f70`) and 2 of 3 here. This is register row TEST-SAVED-COMP-002 (see FLAKY-SAVED-KEY). It failed in the pre-move baseline too. Not touched.
- **Browser (Firefox, headless puppeteer, `tests/tooling/browser-runtime.mjs`)**: Home, guest returning user, Midnight, at 1920×1080 EN, 1366×768 EN and 1920×1080 HE (RTL). Before and after PNGs are byte-identical (after-shots retaken on the final code), and so are the captured DOM states (lang, dir, theme, aria-busy, content text). Files are in `C:\Users\sjzns\Projects\Riverline_QA_2026-10\EXTRACT-HOME-001\` (`before-*.png`, `after-*.png`). Limit: the worktree has no local `app/auth-config.js` (protected; not created), so the app ran as "provider not configured" (guest only). The account view is covered by the bootApp tests, not by screenshots.

## 6. Behaviour differences

None visible. Internal differences:
1. Home clicks are delegated on `#homeMode` instead of `document`; they fire earlier in the bubble, and the remaining document click branches cannot match Home controls.
2. Navigation to Home calls `setVisible(true, { destination })` instead of the `refreshHomeWorkspace` facade. Same work: apply the destination, then reload with `preserveVisible`.
3. A disposed controller never loads (new; logic.js never disposes it).
4. Dead Personal Strategy summary code was removed (it had no DOM target).

## 7. Limitations, debt, register

- **TEST-HYGIENE-001-F02** (dead `renderHomePersonalStrategy`): marked Fixed by this ticket.
- New **HOME-DOM-IDS**: like the quick drill, the module still reads its elements by id through the container document instead of receiving them.
- New **QUICKDRILL-WAITFOR-FLAKE**: the two quick-drill failures in the final full run (see §5).
- New **HOME-FACADES**: logic.js keeps three one-line facades (`refreshHomeWorkspace`, `scheduleHomeRefresh`, `applyHomeDestinationPresentation`) because about 10 logic.js callers and many tests use these names. They can go when the callers move.
- **HOME-BRIDGE-RACE: not fixed (as instructed).** Exact reproduction:
  - Setup: Firefox headless via `tests/tooling/browser-runtime.mjs` (dev server port 0); welcome orientation marked completed in localStorage (`riverline.welcomeOrientation.v1`), so Home is the landing workspace; then reload Home repeatedly.
  - Symptom: within about 1.3–2 s of each load, `console.error('[Riverline Home]', Error('Riverline Home bridge is unavailable'))` fires while `window.RiverlineHome` is still undefined (`document.readyState` is `interactive` or `complete`). Home then renders the error fallback ("Saved items could not be loaded.") until the next refresh, which repopulates it (`homeShown: true` by the time it is checked).
  - Base `d164f70` (main checkout, with its real local auth config): 15 of 15 reloads.
  - This branch (no auth config, guest): 3 of 15 reloads. More under CPU load: 4 errors in one screenshot run while the full suite ran in parallel.
  - Probe script: `C:\Users\sjzns\AppData\Local\Temp\claude\C--Users-sjzns-Projects-poker-gto-app--claude-worktrees-extract-home-module-35e83a\16fbcc55-bbfe-441c-8adf-0c16ebc37b44\scratchpad\home-race.mjs`. Run it as `node home-race.mjs <repo> <reloads>`.
  - What I could establish: the init `refreshHomeWorkspace()` runs before `home-workspace-bootstrap.mjs` has installed the bridge. I found no top-level `await` in `app/` or `shared/`, so the cause of the ordering is still open.
  - The move did not change this path: `callHomeBridge` is the same function and the bridge is still read at call time. `home-workspace.mjs` imports only `saved-item-presentation.mjs`, so the controller itself is always mounted before logic.js runs.

## 8. Disagreements and doc conflicts

- The ticket goal lists `openImportedHandWorkspace` and the `savedScenarioOwnerActive` wiring as Home code to move. HOME-INVENTORY-001 §1.6 classifies both as Hand/Analyze state that only sits in the Home line range. I followed the inventory: both stay in logic.js. `openHomeSavedItem` and `returnToHomeLiveHand` also stay, as injected callbacks, because their bodies are entirely Hand, Analyze and Saved internals. The owner may want this recorded for the Saved extraction ticket.
- I deleted the dead `renderHomePersonalStrategy` instead of moving it, following the inventory ("delete, do not move"). This is not visible, but strictly it is cleanup beyond a pure move.
- `AGENTS.md` says logic.js is "about 16,200 lines today"; it is 14,880 after this ticket.

## 9. Git

Nothing is staged or committed. During verification I briefly ran `git add -N` (intent-to-add) on the three new files to include them in `git diff --check`. I undid it at once with `git restore --staged`, and `git diff --cached` is empty. The new files are untracked. `.codex/config.toml` and `.claude/` were not touched. The untracked `app/auth-config.js` was not created or read.
