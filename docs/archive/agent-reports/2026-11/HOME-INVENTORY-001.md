# HOME-INVENTORY-001: Home inventory for HOME-001

Ticket: HOME-INVENTORY-001 · read-only analysis · T0 · branch `wip/HOME-INVENTORY-001` (base `e884ce6`)
Code changes: none. This report is the only file added.

Sources read: `app/src/core/logic.js` (Home and Saved ranges listed below), `app/index.html` 582-648, `app/src/application/home-view-model.mjs`, `home-workspace-bootstrap.mjs`, `app/src/tutorial/home-tutorial.mjs`, `saved-tutorial.mjs`, `shell-navigation.mjs`, `docs/design/decisions/PHASE1_DECISIONS.md` (P1-02, P1-25, P1-26), `docs/design/CANVASES.md`, and the mockup index artifact (https://claude.ai/artifact/63s8zYYpd53U7YKhqdph38), which I could open and parse (see section 2).

## 1. What the current Home shows and does

### 1.1 Markup (`app/index.html:582-648`, `<section id="homeMode">`)

`#homeMode` is shared by two destinations: **Home** (`data-product-destination="home"`) and **Saved** (`"saved"`). Both live in the same mode view; `applyHomeDestinationPresentation` hides or shows sections per destination. In order:

| Block | DOM id | Shown on | Content |
|---|---|---|---|
| Study Inbox | `#studyInboxPanel` (`<details>`) | Home | Lazy disclosure. Loads through `window.RiverlineStudy.loadInbox` only when opened; one recommendation plus an inspectable queue (Training Memory, Saved, Personal conflicts) with due reasons. `bindStudyInbox` at `logic.js:5636-5674`. |
| Account overview "My Riverline" | `#homeAccountOverview` | Home, account only | Display name, `@username`, Study sync status (label, detail, live region), "Review issue" button when sync state is `conflict` or `error`. |
| Guest panel | `#homeGuestAccount` | Home, guest only | "Riverline is ready to use", two honesty lines about local-only data, "Sign in or create account" (`#homeGuestSignIn`, bound in `authentication-bootstrap.mjs:340`). Carries tour anchor `home-overview` (moved to the account overview for accounts). |
| Continue / Start study | `#homeContinueContent` | Home | Up to two cards: **Live Hand** (in-memory hand, button "Return to live hand") and **Personal Strategy** calibration (profile, mode, table size, "N of M directly answered", button "Resume calibration"). Empty state: "Play or reconstruct a legal hand." + "Start a Hand". First card gets the only primary button. |
| Review | `#homeReviewContent` | Home | Two groups, "Review later" (limit 3) and "Marked as a mistake" (limit 3), each a list of Saved item rows (kind badge, title, facts, badges, Open button). Header link "Review Mistakes" (`#homeReviewMistakesLink`) only when at least one mistake is marked; opens Saved with the mistakes filter. |
| Recent | `#homeRecentContent` | Home | Latest 6 Saved hands and spots. Empty state "No saved study yet." + "Analyze a Hand". |
| Saved library | `#savedLibrarySection` | Saved | Mounted from `window.RiverlineSavedLibrary` and `RiverlineSavedTrainingHistory` (own modules, `saved-library-workspace.mjs`, `saved-training-history-workspace.mjs`). Not Home code, but hosted inside `#homeMode`. |

Not rendered although code exists: `renderHomePersonalStrategy` (`logic.js:8999-9069`) writes into `#homeStrategyContent`, which does **not** exist in `index.html` (grep: only `logic.js` mentions it, plus `#homeOtherTitle` at 8577 and `#homePersonalStrategyContent` at 9209). So the Personal Strategy summary card, the `strategy`/`other` section keys in `applyHomeDestinationPresentation`, and the `#homePersonalStrategyContent` clear are dead. The Personal Strategy data still feeds Continue and the header chip. (Candidate for deletion in HOME-001, not done here.)

### 1.2 Data sources and bridges

- **`window.RiverlineHome`** (`home-workspace-bootstrap.mjs`, schema `home-workspace/v1`, frozen, non-enumerable): `load()` and `openSavedItem(id)`. `logic.js` reaches it only through `callHomeBridge` (`logic.js:346`).
- **`createHomeViewModelController`** (`home-view-model.mjs`, `HomeViewModel v2` = `home-view-model/v2`): one `Promise.allSettled` over `savedStudyQueries.listRecent(6)`, `listForReview(3)`, `listMistakes(3)`, `personalStrategyQueries.loadSummary()`, account profile, auth profile, `RiverlineStudySync.getState()`, `continuationQueries.getSummary()` (just `hasLiveHand`, from `RiverlinePlaybookState.hasLiveHand`). Each section isolates its own error (`status: 'error'`).
- **Guest path:** `createGuestHomeViewModel` never queries Saved or Personal Strategy (recent/review `unavailable`); only the live-hand continuation survives.
- **Model shape:** `sections.continue | recent | review{reviewLater,mistakes} | personalStrategy | quickStart{destinations} | history{training,analysis: unsupported}`, plus `sessionMode`, `identity`, `sync`. `quickStart.destinations` now only decides the Review Mistakes link; `history` is an empty seam.
- **Open saved item:** `createSavedStudyObjectOpenController` via `callHomeBridge('openSavedItem')`, then `openHomeSavedItem` (`logic.js:9334-9400`) switches to Hand (read-only replay) or Analyze (restored lossy Scenario) and navigates.
- **Shell hubs** read `homeViewModel` through `showHub(destination, { homeModel: homeViewModel })` (`logic.js:9674`, consumer `shell-navigation.mjs:38-122`) for the "continue" lines; whatever mounts Home must keep exposing the last model.
- **Header:** `RiverlineWorkspaceHeader.setDescription/setContext('home', ...)` and `setPlayContext({game, approach})` (the Game/Approach chip) are set inside `renderHomeWorkspace` from the model.

### 1.3 Owner and generation fences, refresh

- `homeRefreshSequence` (monotonic): `refreshHomeWorkspace` discards a result when its sequence is stale or the active mode is no longer `home`; `clearSavedOwnerPresentation` bumps it.
- `scheduleHomeRefresh({ clearPrivateState })` (`logic.js:9269`): nulls the model, optionally clears private state, then one 80 ms `homeRefreshTimer` (re-armed on every event, so events coalesce). No refresh while the welcome orientation is visible.
- Triggers (`logic.js:10467-10503`): `riverline:identitychange` and `riverline:authchange` (with `clearPrivateState: true`; auth is filtered by `authenticationOwnerChanged`), `riverline:savedstudychange`, `riverline:personalstrategychange`, `riverline:studysyncchange`. Also `refreshHomeWorkspace({ preserveVisible })` on every navigation to Home (`logic.js:9677`) and once at init when Home is the landing workspace (`logic.js:10507`).
- Lifecycle-generation fence: `openHomeSavedItem`, `editSavedLibraryItem`, `archiveSavedLibraryItem` capture `RiverlineAccountIdentity.getLifecycleState().lifecycleGeneration` and abandon the result when it changed. `bridge.load()` additionally uses `captureLifecycleScope().assertCurrent()` (twice) and picks guest vs account from `scope.identityKind`.
- `clearSavedOwnerPresentation` (`logic.js:9202-9244`) is the owner-change reset. It clears Home content **and** a lot that is not Home: Hand review saver, Saved library and training-history controllers, imported-hand/saved-hand/saved-scenario presentation, Analyze resets, saved-study editor. It must stay a coordinating function; only its Home lines (9203-9209, 9205 `homeViewModel = null`) move.
- Language: `refreshLocalizedRuntime` (`logic.js:10384`) and card-style refresh (`11096`) re-render the last model with `renderHomeWorkspace(homeViewModel)` (no re-query).

### 1.4 Actions, keyboard, links

- One delegated `document` click handler in `bindEvents` (`logic.js:9465-9491`): `[data-home-destination]` (values used: `hand`, `analyze`, `personal-strategy`, `review_mistakes`) -> `navigateToProductDestination`; `[data-home-action="return-live-hand"]` -> `returnToHomeLiveHand` (`8668`); `[data-home-action="review-sync"]` -> `RiverlineAuthentication.openAccount()`; `[data-home-saved-id]` -> `openHomeSavedItem`.
- **Keyboard:** Home has none of its own. Everything is native buttons and a native `<details>`; the global handlers (sidebar arrows, `Escape`, training shortcuts) are not Home's.
- **Links to Saved:** Review Mistakes -> Saved with `showMistakesOnly`; Recent and Review rows open the item in Hand or Analyze. The Saved destination is the same mode view (`navigateToProductDestination('saved')` -> `['home','saved']`).
- **Links to Training:** Home has no direct Training link of its own. Training is reached through the sidebar; the Study Inbox "Redrill" and "Same spot" actions call `navigateToWorkspace('training')` then `openTrainingMemoryRedrill/SameSpot` (inside `bindStudyInbox`).
- Empty states link to Hand and Analyze only (`homeEmptyAction`).

### 1.5 Tours that target Home

- `home.first-use` v1 (`home-tutorial.mjs`): steps `overview` -> anchor `home-overview` (guest panel or account overview), `recent` -> `home-recent` (`#homeRecentContent`'s section, `tabindex=-1`), `review` -> `home-study-inbox` (the `<details>`), `quick-start` -> `shell-navigation`. Offered by `renderHomeWorkspace` through `RiverlineTutorials.offerForWorkspace('home' | 'saved', #homeWorkspace)`.
- `saved` tour (`saved-tutorial.mjs`): anchors `saved-workspace` (that is `#homeWorkspace`), `saved-view-toggle`, `saved-library-find`, `saved-library`, `home-review`. So the Saved tour depends on Home markup (`#homeWorkspace` and the Review section).
- Any re-skin must keep these `data-tutorial-anchor` values or bump the tour version on purpose (the file says only an intentional content migration may bump `version`).

### 1.6 Code to move: `logic.js` line ranges (file is 16,213 lines at `e884ce6`)

The ticket said "about 8472-9424"; real boundaries:

| Lines | What | Where it should go |
|---|---|---|
| 8472-8478 | module state: `homeViewModel`, `savedLibraryController`, `savedTrainingHistoryController`, `homeRefreshSequence`, `homeRefreshTimer`, `activeSavedSpotContext`, `savedScenarioOwnerActive` | Home controller owns the first/fourth/fifth; **the others are Saved/Hand state and stay** |
| 8480-8484 | `welcomeOrientationIsVisible` | stays (shared shell), inject as a dep |
| 8485-8516 | `activateNavigationItem` | stays (shell), only the `home` line calls Home |
| 8518-8552 | `resolveHomeDestinationPresentation` (pure) and `setTranslatedElement` | Home module (pure part is trivially movable; `setTranslatedElement` is generic, keep in shell/ui) |
| 8554-8600 | `applyHomeDestinationPresentation` | Home controller; the `library`/Saved branch calls `syncSavedLibraryVisibility` |
| 8604-8651 | Playbook destination presentation, `syncPlaybookNavigationDestination`, `navigateToWorkspace`, `navigateToProductDestination`, `revealHomeDestination` | stay (shell); inject `navigate` |
| 8669-8677 | `returnToHomeLiveHand` | Home action, needs Hand bridge as dep |
| 8679-8698 | `homeEmptyState`, `homeEmptyAction` | Home module (use `app/src/ui` empty-state helper if one exists) |
| 8700-8801 | `homeRecency`, `homeSavedItemTitle`, `homeSavedItemFacts`, `createHomeSavedItemElement` | Shared with Saved library (`presentation.recency/itemTitle`): extract to a small shared Saved-presentation module first |
| 8803-8905 | `syncSavedLibraryVisibility`, `openSavedTrainingHistoryRedrill`, `editSavedLibraryItem`, `archiveSavedLibraryItem`, `mountSavedLibraryWorkspace` | **Saved**, not Home. Separate ticket (Saved extraction). Home should not take them. |
| 8907-8975, 8977-8997 | `renderHomeContinue`, `renderHomeRecent`, `renderHomeReviewGroup`, `renderHomeReview` | Home module |
| 8999-9069 | `renderHomePersonalStrategy` | Dead (no DOM target): delete, do not move |
| 9071-9085 | `homeSyncCopy` | Home module (pure) |
| 9087-9116 | `renderHomeAccountOverview`, `renderHomeReviewMistakesLink` | Home module |
| 9118-9165 | `renderHomeWorkspace` | Home controller (`render(model)`) |
| 9167-9174 | `beginHomeLoading` | Home controller |
| 9176-9198 | `clearSavedScenarioOwnerPresentation` | **Analyze/Saved**, stays |
| 9202-9244 | `clearSavedOwnerPresentation` | stays as coordinator; Home lines call `home.ownerChanged()` |
| 9246-9267 | `refreshHomeWorkspace` | Home controller |
| 9269-9283 | `scheduleHomeRefresh` | Home controller (`schedule({clearPrivateState})`) |
| 9284-9332 | `restoreSavedSpotPresentation`, `renderSavedSpotViewer` | Saved/Analyze, stays |
| 9334-9400 | `openHomeSavedItem` | Saved-open orchestration shared by Home, Saved, Study Inbox; stays until the Saved extraction, inject as `openSavedItem` dep |
| 9402-9424 | `openImportedHandWorkspace` | Hand/import, **not Home**; stays (it only lives in this range) |
| 346-355 | `callHomeBridge` | disappears into the controller (bridge becomes a dep) |
| 5636-5674 | `bindStudyInbox` | Study Inbox, shared with Home markup; move with Home only if the inbox stays on Home (see section 3) |
| 9465-9491 | click handlers (`homeDestination`, `homeAction`, `homeSavedItem`) | controller `mount` binds to its own container instead of `document` |
| 9674-9678, 10384, 10467-10507, 11096 | callers: hub model, `scheduleHomeRefresh` event wiring, language refresh, card style refresh | become `home.refresh`, `home.schedule`, `home.refreshLanguage` calls |

Controller contract (AGENTS.md): `mount(container, deps)` -> `{ dispose, refreshLanguage, handleKey, setVisible }`. Deps Home needs: `t`, `locale`, `bridge` (`load`, `openSavedItem`), `navigate`, `openSavedItem`, `returnToLiveHand`, `openAccount`, `header` (`setContext`, `setDescription`, `setPlayContext`), `tutorials.offer`, `welcomeOrientationIsVisible`, `activeDestination`, `onModel(model)` (for the hub). Also expose `getLastModel()` for `showHub`.

## 2. What the earlier Home mockups contained

The index artifact opened. Static Home screens found in it (all PC): kit "Home" (group "Screens on the kit"), "Home (first)" and "Home v2" (group "Earlier workspace canvases"), "Home v3" (group "Shell and navigation"), and "Home · returning and first visit" (group "Latest PC screens", https://claude.ai/artifact/GkEYuGz7y4rsvRJpH7oLJo; its blocks are built by script, so P1-25/P1-26 are the readable description). Block lists:

- **Home (first)**: Continue (Orbit session, mini cards, Resume); Suggested for you (3 cards: plan-vs-play BB defense drill, plan gap, review yesterday's session); Recent (hand, spot, session); Start something (Reconstruct a hand, Quick drill, Analyze a spot, Equity); Due and flagged (revisits due, review later, marked unsure, "Start 6 items"); What Riverline noticed (2 observations with sample sizes); Plan coverage grid (positions x First in / vs open / vs 3-bet); Home game card (settled game night). Old sidebar.
- **Home v2**: Today's session ~15 min (3 steps with reasons, "Change the plan"); From Thursday's game night (hands with results, "Not reviewed yet", "Add a hand"); Your progress, last 3 weeks (trend lines with samples); Also worth your time (plan gap lesson, Learn); Continue; Due (counts); Plan summary (spots done / in progress / empty).
- **Home v3 and kit Home**: Continue hero (Orbit session, hand 3 of 12, Resume); Today's session ~15 min with "Start session" / "Open Study"; Thursday's game night (settled, players, transfers, two hands with results, "Open"); What Riverline noticed (call 3-bets OOP vs plan, multiway observation). Header chip "Thursday live · Serious". Hub sidebar.
- **P1-25 (latest draft)**: Returning: Continue hero (Orbit, mini felt, progress, sheen once), Today's session (~15 min, each step with its reason), the night after game night (result, hands logged / to complete, luck vs decisions bar, links), What Riverline noticed (sample-sized, from played hands only, "possible reading"), next sticker, Learn next step, recent items. First visit: illustrated welcome card with first drill, three things to try, Chippy "nothing noticed yet", empty sticker book, Game night intro. Greeting line ("Good evening / Saturday · Friday's game night has 4 hands waiting.") and the context chip.
- **P1-26 (merge rule)**: Home = continue + short session invitation + last game night + what Riverline noticed; progress card with samples; plan coverage and the due list stay in the Study hub (P1-02) with links. Two-card rule applies.

## 3. Mapping and honest HOME-001 scope

Data the app really has today (verified in code): Saved recent / review-later / mistakes (bounded), live-hand flag, Personal Strategy summary (selected profile, mode, answered/total, resumable), account identity, sync state, Study Inbox (Training Memory + Saved + Personal conflicts, with due reasons, lazy), Training Memory records (via Study Inbox and Saved history), Game/Approach chip, Game night data (`app/src/home-game/`; the Game night workspace is in the sidebar, the spec is marked dormant in AGENTS.md).

| Mockup block | Data today | Verdict for HOME-001 |
|---|---|---|
| Context chip (table rules · approach) | Yes: `setPlayContext` already renders Game and Approach | **Keep** (already live) |
| Greeting ("Good evening", day) | Local clock + display name | **Build** (pure presentation); drop the "N hands waiting" half until game-night linking exists |
| Continue hero | Live hand: yes. Personal Strategy resume: yes. **Orbit session: no** (Orbit/long session is a future feature) | **Build** as hero for live hand / calibration; Orbit variant later |
| Recent | Yes (6 Saved items) | **Keep**; "session" rows need Orbit, so only hand and spot |
| Review later / mistakes / due and flagged | Review later + mistakes: yes. "Revisits due", "marked unsure": only through Study Inbox (computed on open) | **Keep** Review later and mistakes. Show a due count only if Study Inbox exposes it without extra work (PERF-001); otherwise leave the inbox disclosure |
| Study Inbox disclosure | Yes (exists) | **Keep** (tour step depends on it); decide placement in the new layout |
| Start something (Reconstruct, Drill, Analyze, Equity) | Destinations exist | **Build** as a quiet row; the sidebar and hubs already carry these, so low value; do only if the layout needs the first-visit empty state |
| First-visit welcome card + three things to try | Static copy; first drill exists (quick refresher) | **Build** (first visit = no saved items, no profile) |
| Today's session (~15 min plan, steps with reasons) | **Not on Home.** A planner exists in Training (`app/src/application/training-practice-planner.mjs`, used by `training-generator.mjs`) but Home has no query for it | **Future** (needs planner). Do not fake; do not ship a static plan |
| What Riverline noticed / Your progress (plan vs play, trends) | **No.** Needs aggregated Training Memory stats with sample sizes and a claim policy (no "correct"/"GTO" wording) | **Future** (needs a Training Intelligence query). Show nothing rather than invent |
| Suggested for you (plan gap, plan vs play drill) | Partially: Personal Strategy knows empty ranges, but no comparison query | **Future** |
| Plan coverage grid | Personal Strategy data exists, but P1-26 moved it to the Study hub | **Drop from Home** (Study hub) |
| Night after game night / Thursday's game night (result, hands to complete, luck vs decisions, transfers) | Game night engine and workspace exist (`app/src/home-game/`, `homegameMode`); **no hands-to-game-night link** (planned M2) and no luck/decisions split | **Future** (night debrief). At most a "Last game night" link card if the Game night workspace is enabled |
| Orbit session progress | **No** | **Future** |
| Next sticker, empty sticker book | **No** achievements system (`docs/design/ACHIEVEMENTS_CATALOGUE.md` is a design catalogue; grep for achievement/sticker in `app/src` finds no code) | **Future** |
| Chippy "nothing noticed yet" | **No** Chippy | **Future** (a plain honest empty line meanwhile) |
| Learn next step | Learn content exists; no "next lesson" pointer | **Drop** for v1 (or a static link to Learn) |
| Account overview / sync / guest panel | Yes | **Keep** (functional, not in the mockups; decide whether it moves to Settings or stays a slim strip) |

**Honest first version of HOME-001** (data-honest, no new engines, no schema change):
1. Extract Home into a mounted module first (the "step 0" of OWNER_DECISIONS 2026-10-31), then restyle.
2. Greeting + context chip row.
3. Continue hero (live hand, Personal Strategy resume) with the existing empty state turned into the first-visit card.
4. Review (Review later, Mistakes) and Recent as two cards (two-card rule), Study Inbox kept as the disclosure.
5. Account / sync / guest strip kept (slimmer).
6. Not in v1: Today's session, Noticed/Progress, Orbit, night debrief, stickers, Chippy, Learn next step, plan coverage. The empty first-visit state may say what will appear later in plain words but must not show placeholder numbers.
Open owner questions: where the account/sync strip lives; whether Study Inbox stays a disclosure or becomes the Review card; whether "Saved" stays a destination inside `#homeMode` (strongly suggest splitting Saved into its own mounted module in the same series, because it shares helpers and the markup container).

## 4. Characterization tests needed before extraction

Existing coverage (kept as is): `home001_view_model` (view model + bounded queries, section isolation), `home001_saved_reopen` (Saved Hand/Spot reopen), `home002a_account_dashboard` (guest vs account, sync, structural CSS/i18n strings), `first_use_home001` (Home as landing, Continue derivation), `home001_integration` (structure), `shell002_navigation_hubs` (hub continue lines from the model), `shell001_workspace_header`. Several of these assert strings and structure inside `logic.js` or `styles.css` and will need to follow the move.

Missing, to write with `bootApp()` (`tests/helpers/browser-app.mjs:341`) in a new file (suggest `tests/home_workspace_characterization.test.mjs`, the same style as `tests/training_quick_drill_workspace_characterization.test.mjs`):
1. Guest Home renders the guest panel, hides overview, Review and Recent still show their empty/unavailable states, `home-overview` anchor is on the guest panel; account Home moves the anchor to the overview.
2. Account Home renders identity, sync label and detail per state (every branch of `homeSyncCopy`) and shows "Review issue" only for `conflict` / `error`.
3. Continue: live hand only, calibration only, both (first card primary), neither (empty action to Hand); `return-live-hand` click calls the Hand route; calibration click navigates to `personal-strategy`.
4. Recent and Review: ready, empty, error per group; Open button label per kind (`Open replay` / `Open spot`); `data-home-saved-id` click calls the bridge exactly once and the button is disabled/`aria-busy` while pending.
5. Review Mistakes link appears only with at least one mistake and opens Saved with the mistakes filter.
6. **Fences:** a stale `load()` result (identity change mid-flight) is not rendered; `scheduleHomeRefresh` coalesces several events into one load after 80 ms; `clearPrivateState` empties content and shows the loading state; no refresh while the welcome orientation is visible; navigating away from Home before the load resolves discards it (`activeWorkspaceMode() !== 'home'`); `openHomeSavedItem` abandons when the lifecycle generation changes.
7. Language switch re-renders the last model without a second `load()` (spy on the bridge).
8. Header side effects: `setContext('home', ...)` for guest and account, `setDescription`, `setPlayContext` only when a profile is selected.
9. Destination switch: Home vs Saved visibility of each section and of `#studyInboxPanel`; hub `showHub` receives the last model.
10. Tours: Home and Saved tours find all their anchors (`home-overview`, `home-recent`, `home-study-inbox`, `shell-navigation`, `saved-workspace`, `home-review`, ...) in the rendered DOM in both session modes.
11. PERF-001 guard: one `load()` per refresh, no Matrix/Equity/strategy work when Home renders (assert on bridge call counts).
12. RTL/HE smoke: `dir="auto"` on titles, `poker-data-token` meta stays `ltr`.

## 5. Findings worth a register row (not added; the ticket is read-only and I did not touch the register)

- `renderHomePersonalStrategy`, the `strategy`/`other` section keys and `#homePersonalStrategyContent` are dead code (no DOM target). Remove during HOME-001.
- `homeEmptyAction` and the `homeSavedItem*` helpers are shared with the Saved library through `presentation`; extracting Home without extracting that module first would create a second copy.

## 6. Verification, limits, git

- Tier T0: no tests run (read-only). Nothing was executed against the app; no browser check (visual status n/a).
- Limitation: the latest Home mockup (`GkEYuGz7y4rsvRJpH7oLJo`) renders its blocks from script, so its list of blocks comes from the decision log (P1-25/P1-26), not from a visual pass.
- Git: only this file was added on `wip/HOME-INVENTORY-001`. Nothing staged on `codex/stabilization`; `.codex/config.toml` and `.claude/` untouched.
