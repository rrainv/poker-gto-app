# HOME-001: Home rebuilt from the approved mockup (PC first)

Ticket: HOME-001 · Product redesign (visual) · T2 · Claude Code (Sonnet 5.5)
Base: `origin/codex/stabilization` `b6f84ddff73db67f8073a2f16f59de0c33a72d35` (the worktree branch was a clean ancestor and was fast-forwarded to it). Nothing staged or committed.
QA folder: `C:\Users\sjzns\Projects\Riverline_QA_2026-10\HOME-001\`

## 1. Outcome

- **HOME-BRIDGE-RACE has a root-cause fix**, with a test that fails on the old code and passes now.
- **HOME-HEADER-OWNER-LEAK and HOME-HIDDEN-IDENTITY-LEAK are fixed**, with an A -> B -> sign-out test.
- Home is rebuilt as a greeting row plus up to six cards in two columns, from real data only. At 1920×1080 it fits one screen in EN, HE, Daylight and Slate, both states. Russian overflows by 31 px (section 6).
- Exactly one solid primary on Home in every state (asserted in tests and measured in Firefox).

## 2. HOME-BRIDGE-RACE: root cause

Instrumented Firefox (reload loop, CPU load, probe script in the scratchpad): `core/logic.js` is a classic `defer` script and runs **before** the module scripts on every reload (`window.RiverlineHome` was `false` when logic.js ran, 5-40 ms ahead; some runs the bootstrap evaluated after `load`). logic.js starts `init` from a 10 ms timer, so when the bridge module landed later the first Home refresh hit "bridge is unavailable". My first attempt, a last "modules ready" module, made it **worse** (7 of 20 reloads under load): Firefox does not run module scripts in document order against each other either (a module with no imports ran before the Home bootstrap). So ordering by position in the page cannot be relied on.

Fix: each module announces itself (`riverline:bridgeinstalled`, from `home-workspace-bootstrap.mjs` and `home-workspace.mjs`), and logic.js runs anything that needs Home (`init` mount, `refreshHomeWorkspace`, `scheduleHomeRefresh`) through `whenHomeBridgesReady`, which runs at once when both exist and otherwise on the signal. No retry and no timer. A missing controller module is reported only after the `load` event.
Measured: before, 3 of 15 reloads (guest), about 7 of 20 under load; after, 0 of 14 under the same load.
Test: `tests/home_bridge_race.test.mjs` boots the app without the two modules (what the browser may deliver), checks no error and no load, then installs them in the bad order (bridge first, controller second) and checks one load and a rendered Home. It fails 2 of 3 on the old code.
Not verified: with the real auth config (this laptop's worktree has none; the main checkout does, I did not copy it).

## 3. Step 0: mapping table (mockup block -> real data today / future / drop)

| Mockup block | Verdict | What was built |
|---|---|---|
| Greeting + date | Built | Clock + display name (account only); no "hands waiting" half |
| Context chip | Built, read-only | Selected Game · Approach from Personal Strategy; no toggle (Table rules, M2) |
| Continue hero (Orbit) | Built for real items only | Live hand, Personal Strategy calibration (real progress bar). Orbit and the mini felt: future/drop |
| Today's session | Built from real data | Up to 3 rows: marked review-later items, marked items, then a quick drill. Honest "Nothing is due". No minutes |
| The night after | Built from the Game night ledger | Last active/completed night: title, players, transfers, amount, recency. Hand results, luck axis, plan axis, "Unknown" cards: future (HOME-NIGHT-HANDS) |
| What Riverline noticed | Built (gates + empty state) | Gated rendering, source line, link to spots. No data source yet: always the honest empty state (HOME-NOTICED-SOURCE) |
| Next sticker, Chippy, sticker book | Dropped | No such system |
| Learn next step | Dropped | No pointer exists |
| Your progress, plan coverage | Dropped | Study hub (P1-26) |
| Recent | Built | 5 compact rows |
| Review (review later, marked) | Built | One list, 3 rows, Review Mistakes link kept |
| Study Inbox | Kept | Now a popover in the greeting row (no in-place expansion); tour anchor kept |
| Guest / account strip | Kept, slimmer | Inline in the greeting row, not a card |
| First visit | Built | Welcome card (first drill), three things to try, game night intro, noticed empty state |
| "My poker" nav item | Not added | Does not exist |

## 4. What was built

- `app/src/application/home-cards.mjs` (new, pure): visit state, card plan (limit 6, two-column balance by estimated height), session plan, noticed gates (n >= 8, n >= 20 with mixed baseline, played hands only), sample tiers, greeting part.
- `home-view-model.mjs`: additive `nightAfter` and `noticed` sections (same `home-view-model/v2`, optional queries, per-section error isolation). `home-workspace-bootstrap.mjs`: lazy Game night query that does not touch the open session.
- `home-workspace.mjs`: new render layer. Cards left out hold no content. Rows are one native button each (keyboard equivalent for everything). Owner change now clears the header context, the Game/Approach chip, the hidden identity fields, the greeting and every card.
- `index.html`: new card markup; `styles.css`: old grid-area rules removed, one new HOME-001 block; EN/RU/HE strings (RU «ты», HE masculine).
- Component sheet: new "Home components" section (row, tile, noticed item, progress, context chip).
- Tokens: text >= 12 px except overlines (audit: 0 violations), controls >= 40 px, Rubik titles/numbers, full 1640 frame (no 1500 cap), no panel gradients.

## 5. Motion checklist (MOTION_SPEC)

| Moment | Status |
|---|---|
| 30 Opening Home: cards in reading order, 70 ms stagger | Built (transform + opacity, scaled by `--motion-scale`) |
| 30 Opening Home: one sheen on Continue | Built, once per opening; also on the welcome card (the lead) |
| Keyboard opening instant | Built (last input modality) |
| Reduced = fades <= 200 ms, no sheen | Built |
| Instant / Faster | Via `--motion-scale` |
| Press scale .97, hover only for fine pointers | Built (.985 on rows, .97 on buttons) |
| Cleared by timeout, not animationend | Built (1900 ms) |
| Other moments (1-29, 31-41) | Not applicable to Home / not built |

`/review-animations` and `/break-ui` are not invocable as skills in this session (not listed); I applied their rules by hand (no `transition: all`, no animated layout, tabular numbers, truncated titles only, no numbers truncated). Please run them before merge.

## 6. Dead-space audit (Firefox, numbers)

Content frame 1632 px wide (full width), widest card 994 px (never full width). Dead block = empty space under a card's last content.
- 1920 returning (6 cards): fits, scrollH 1080/1080, no dead block > 100 px.
- 1920 first visit: fits; **the page below the 4 cards is empty (about 1632×560 px)**, which exceeds the 160×160 rule. I did not pad it with invented content (same in the mockup).
- 1920 quiet returning (3 cards): Session card has 133 px empty below its content (under 160).
- 1366 returning: scrolls (1243/768) as expected; Resume button bottom at y=377, above the fold; Recent has 112 px dead below.
- Russian 1920 full: 1111/1080, 31 px over.
- Primary buttons: 1 in every state. Buttons are sized to labels.

## 7. Differences from the mockup (with reasons)

No Orbit/felt, stickers, Chippy, Learn, progress, plan coverage, minutes (no data); invented numbers replaced by stored facts; no "Take the tour again" (WELCOME-001); no 1500 cap; Study Inbox as a popover; account/guest strip inline; context chip duplicates the header chip (HOME-CONTEXT-CHIP-DUP); first-visit columns balance by height so "Three things to try" can sit in the narrow column; mockup QA #16 and #17 do not exist in MOCKUP_QA.md (it has 15 items), #13 applied (two-card art).

## 8. Verification

- `node --check` on every changed .js/.mjs: OK. `git diff --check`: clean; LF.
- Focused: Home group of 26 files: all pass (267 tests incl. new). New: `home001_cards` (14), `home_bridge_race` (3). Updated (they read the old markup): core_flow001_navigation, first_use_home001, home001_integration, home_workspace_characterization, home_workspace_controller, saved_composition002, saved_library001, shell001_workspace_header, beta_design_correction002.
- Full suite once (`--test-concurrency=4`): 2924 tests, 2919 pass, 2 fail, 1 skipped. Both failures were mine (CSS guardrails: a hard-coded `120ms` fallback in `analyze_composition001_amend2`, and my CSS block sitting after the MOTION-FOUNDATION-001 marker in `motion_foundation001`). Fixed (fallback removed, block moved before the marker); those two files plus the Home CSS tests re-run: 38/38 pass. The full suite was not re-run after that fix.
- Firefox (headless puppeteer): 12 screenshots plus mockup and side-by-side comparisons in the QA folder: returning/first at 1920 and 1366 EN Midnight, 1920 HE, Daylight, Slate, plus quiet and RU. **Limit: the returning state is a fixture model rendered through the real controller (no seeded IndexedDB data); the first-visit state is the real guest app.** The account view uses the harness/fake model, not a real provider (no auth config on this laptop).
- Tour: anchors `home-overview`, `home-study-inbox`, `home-review`, `home-recent` kept; `home-review` and `home-recent` are hidden when their card has nothing to show.

## 9. Limitations and debt (register rows added)

HOME-NOTICED-SOURCE, HOME-NIGHT-HANDS, HOME-SESSION-PLANNER, HOME-FIRST-VISIT-GUEST, HOME-I18N-DEADKEYS, HOME-CONTEXT-CHIP-DUP. Fixed: HOME-BRIDGE-RACE, HOME-HEADER-OWNER-LEAK, HOME-HIDDEN-IDENTITY-LEAK. Also: other bridges (Equity, Saved, Training) have the same startup-order exposure but are only called lazily; not touched.

## 10. Disagreements and doc conflicts

The ticket says "Start today's session" exists; the inventory says no planner is on Home. I built it from real marked items (opens the first step); owner may want a planner later. Ticket says the account view should be tested through a fake provider; only the Home view model path was exercised.

## 11. Git

Nothing staged or committed. Modified: app/index.html, app/styles.css, app/src/core/logic.js, app/src/application/{home-view-model,home-workspace-bootstrap,home-workspace}.mjs, app/src/locales/home-translations.js, tools/dev-pages/component-sheet.mjs, docs/ISSUE_REGISTER.md, nine tests. New: app/src/application/home-cards.mjs, tests/home001_cards.test.mjs, tests/home_bridge_race.test.mjs, this report. `.claude/`, `.codex/config.toml` and `app/auth-config.js` untouched.
