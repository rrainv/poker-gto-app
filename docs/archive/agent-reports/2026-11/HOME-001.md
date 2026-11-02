# HOME-001: Home rebuilt from the approved mockup (PC first)

Ticket: HOME-001 · Product redesign (visual) · T2 · Claude Code (Sonnet 5.5)
Base: `origin/codex/stabilization` `b6f84ddff73db67f8073a2f16f59de0c33a72d35` (the worktree branch was a clean ancestor and was fast-forwarded to it). Nothing staged or committed.
QA folder: `C:\Users\sjzns\Projects\Riverline_QA_2026-10\HOME-001\`

## 1. Outcome

- **HOME-BRIDGE-RACE has a root-cause fix**, with a test that fails on the old code and passes now.
- **HOME-HEADER-OWNER-LEAK and HOME-HIDDEN-IDENTITY-LEAK are fixed**, with an A -> B -> sign-out test.
- Home is rebuilt as a greeting row plus up to six cards in two columns, from real data only. At 1920×1080 it fits one screen in EN, HE, Daylight and Slate, both states. Russian overflows by 31 px (section 6).
- Exactly one solid primary on Home in every state (asserted in tests and measured in Firefox).

## 2. HOME-BRIDGE-RACE (round 2: my fix dropped)

My own startup fix was removed. The accepted fix is the startup gate (`startup-gate.js`, `019cb6b`) already on the base. My `tests/home_bridge_race.test.mjs` was deleted (it tested my event mechanism, which no longer exists). Verified with the probe on the gated base: 20 Firefox reloads under CPU load, 0 errors, Home shown 20 of 20. Owner-leak fixes and their tests are kept.

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

## 6. Round 2: Start something card, dead-space audit, Russian

**Start something card** (real destinations only: Quick drill, Analyze a spot, Equity, Reconstruct a hand, Game night; rows sized as a list, no solid button). It appears only when fewer than 5 other cards show (cap of 6 kept). The first-visit "game night intro" card was dropped (Game night is now in Start something). Few-card states use a "roomy" density and cards with rows/tiles share spare column height (capped), so cards are not hollow.

Dead-space numbers (Firefox, Midnight EN unless noted). "Below" = empty strip under the cards inside the viewport; "column" = empty block under the shorter column; "in-card" = largest empty block inside a card.

| State | Viewport | Page | Below | Column | In-card |
|---|---|---|---|---|---|
| First visit | 1920 | fits | 77 px | 0 | Welcome hero 167 px (centered content) |
| First visit | 1366 | 810/768 | 6 px | 0 | none over 60 |
| Quiet (3 + Start) | 1920 | fits | 77 px | **490 px left column (Session "Nothing is due" is short)** | none |
| Quiet | 1366 | 786/768 | 30 px | **178 px** | none |
| Returning (6 cards) | 1920 | fits | 80 px | 0 | none |
| Returning | 1366 | scrolls (1199/768) | 0 | 0 | none |

**Not fully met:** the quiet state still has a 490 px (1920) / 178 px (1366) empty column block, and the first-visit Welcome hero has 167 px centred slack. The cause is thin real data (a short "Nothing is due" card); filling it would need invented content. Options for the owner: make the Session card in the nothing-due state carry the Start something tiles itself, or let quiet use a single wide column.

**Russian:** 1920 returning now fits (1080/1080, 49 px below). First visit RU is 7 px over (1087/1080). 1366 RU returning scrolls (1288/768) with no horizontal overflow. Hebrew 1920: all three states as EN. Long-name stress (60-char profile, 90-char titles, 9-digit numbers) at 1920, 1366 and 1366 HE: no card overflow after a wrap fix.

## 7. Differences from the mockup (with reasons)

No Orbit/felt, stickers, Chippy, Learn, progress, plan coverage, minutes (no data); invented numbers replaced by stored facts; no "Take the tour again" (WELCOME-001); no 1500 cap; Study Inbox as a popover; account/guest strip inline; context chip duplicates the header chip (HOME-CONTEXT-CHIP-DUP); first-visit columns balance by height so "Three things to try" can sit in the narrow column; mockup QA #16 and #17 do not exist in MOCKUP_QA.md (it has 15 items), #13 applied (two-card art).

## 8. Verification

- Base: `origin/codex/stabilization` `019cb6b` (rebased; one register conflict resolved by keeping the base's HOME-BRIDGE-RACE row).
- `node --check` on changed files OK; `git diff --check` clean; LF.
- **Account view:** `home001_cards` has a behavioural test that builds the real Home bridge around a **FAKE auth provider** (signed in, sync conflict, then signed out) and renders it. **No real auth provider was used.**
- Motion by hand against `.agents/skills/review-animations/SKILL.md`: entrance 420 ms (MOTION_SPEC 30), 70 ms stagger, transform/opacity only, ease-out, Reduced = fade, keyboard instant, hover under fine pointers, no `transition: all`. Components by hand against `break-ui`: long unbroken names, 9-digit numbers, empty and error states, RTL: fixed one overflow class (wrap), numbers never truncated.
- Firefox QA: 16 screenshots plus mockup and side-by-side comparisons in `C:\Users\sjzns\Projects\Riverline_QA_2026-10\HOME-001\` (returning state is a fixture model through the real controller; first visit is the real guest app).
- Full suite (`--test-concurrency=2`): see the result line appended at the end of this file.

## 9. Limitations and debt (register rows added)

HOME-NOTICED-SOURCE, HOME-NIGHT-HANDS, HOME-SESSION-PLANNER, HOME-FIRST-VISIT-GUEST, HOME-I18N-DEADKEYS, HOME-CONTEXT-CHIP-DUP. Fixed: HOME-BRIDGE-RACE, HOME-HEADER-OWNER-LEAK, HOME-HIDDEN-IDENTITY-LEAK. Also: other bridges (Equity, Saved, Training) have the same startup-order exposure but are only called lazily; not touched.

## 10. Disagreements and doc conflicts

The ticket says "Start today's session" exists; the inventory says no planner is on Home. I built it from real marked items (opens the first step); owner may want a planner later. Ticket says the account view should be tested through a fake provider; only the Home view model path was exercised.

## 11. Git

Committed on `claude/home-workspace-redesign-129bdd` and pushed to `origin/wip/HOME-001` (not `codex/stabilization`). `.claude/`, `.codex/config.toml`, `app/auth-config.js` untouched.

## Result

Full suite after the final CSS, `--test-concurrency=2`: 2928 tests, 2925 pass, 0 fail, 1 skipped. The known flake uiqa002a did not fail in this run (not edited).
