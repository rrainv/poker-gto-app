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
| Context chip | Dropped (round 3) | The workspace header chip already shows Game · Approach (HOME-CONTEXT-CHIP-DUP fixed) |
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

## 6. Round 3: row-aligned sparse states, tiles, chip removed, audit

Base: `origin/codex/stabilization` `6c1f62a`. Four cards or fewer now use a **row-aligned grid**: two cards per row, equal-height rows, Start something in the wide cell of row two (an odd last card spans both). Start something is a 2-column grid of tiles (Quick drill, Analyze a spot, Equity, Reconstruct a hand, Game night). Rows and tiles grow with their card (capped) and a text card centers its text. The 5 to 6-card returning layout is unchanged (two columns). Home's own context chip is removed (tests and component sheet updated).

Dead-space audit (Firefox, Midnight). "Below" = strip under the last row (allowed). "Column" = empty block under a shorter column (none: rows are equal). "In-card" = largest empty block under a card's content.

| State | Viewport | Page | Below | Column | In-card |
|---|---|---|---|---|---|
| First visit | 1920 EN | fits | 234 px | 0 | 75 px (Welcome hero) |
| First visit | 1920 RU | fits (was 7 px over) | 198 px | 0 | 75 px |
| First visit | 1920 HE | fits | 234 px | 0 | 75 px |
| First visit | 1366 EN | 924/768 | 0 | 0 | 46 px |
| Quiet | 1920 EN / RU / HE | fits | 234 px | 0 | 1 px |
| Quiet | 1366 EN | 888/768 | 0 | 0 | 1 px |
| Returning (6 cards) | 1920 EN / RU / HE | fits | 68 px | 0 | 1 px |
| Returning | 1366 EN | 1147/768 | 0 | 0 | 23 px |
| Returning | 1366 RU | 1236/768 | 0 | 0 | 32 px |

No block over ~160 px inside or between cards. The 234 px strip below the last row at 1920 (first visit, quiet) is the allowed case: no useful real content exists to put there. One solid primary in every state; no horizontal overflow in any shot. 17 screenshots plus mockup comparisons are in the QA folder (stale PNGs cleared first, in one command).

## 7. Differences from the mockup (with reasons)

No Orbit/felt, stickers, Chippy, Learn, progress, plan coverage, minutes (no data); invented numbers replaced by stored facts; no "Take the tour again" (WELCOME-001); no 1500 cap; Study Inbox as a popover; account/guest strip inline; context chip duplicates the header chip (HOME-CONTEXT-CHIP-DUP); first-visit columns balance by height so "Three things to try" can sit in the narrow column; mockup QA #16 and #17 do not exist in MOCKUP_QA.md (it has 15 items), #13 applied (two-card art).

## 8. Verification

- Base: `origin/codex/stabilization` `019cb6b` (rebased; one register conflict resolved by keeping the base's HOME-BRIDGE-RACE row).
- `node --check` on changed files OK; `git diff --check` clean; LF.
- **Account view:** `home001_cards` has a behavioural test that builds the real Home bridge around a **FAKE auth provider** (signed in, sync conflict, then signed out) and renders it. **No real auth provider was used.**
- Motion by hand against `.agents/skills/review-animations/SKILL.md`: entrance 420 ms (MOTION_SPEC 30), 70 ms stagger, transform/opacity only, ease-out, Reduced = fade, keyboard instant, hover under fine pointers, no `transition: all`. Components by hand against `break-ui`: long unbroken names, 9-digit numbers, empty and error states, RTL: fixed one overflow class (wrap), numbers never truncated.
- Firefox QA: 16 screenshots plus mockup and side-by-side comparisons in `C:\Users\sjzns\Projects\Riverline_QA_2026-10\HOME-001\` (returning state is a fixture model through the real controller; first visit is the real guest app).
- Full suite: see the result line at the end of this file.

## 9. Limitations and debt (register rows added)

HOME-NOTICED-SOURCE, HOME-NIGHT-HANDS, HOME-SESSION-PLANNER, HOME-FIRST-VISIT-GUEST, HOME-I18N-DEADKEYS, HOME-CONTEXT-CHIP-DUP. Fixed: HOME-BRIDGE-RACE, HOME-HEADER-OWNER-LEAK, HOME-HIDDEN-IDENTITY-LEAK. Also: other bridges (Equity, Saved, Training) have the same startup-order exposure but are only called lazily; not touched.

## 10. Disagreements and doc conflicts

The ticket says "Start today's session" exists; the inventory says no planner is on Home. I built it from real marked items (opens the first step); owner may want a planner later. Ticket says the account view should be tested through a fake provider; only the Home view model path was exercised.

## 11. Git

Committed on `claude/home-workspace-redesign-129bdd` and pushed to `origin/wip/HOME-001` (not `codex/stabilization`). `.claude/`, `.codex/config.toml`, `app/auth-config.js` untouched.

## Result

Full suite after the final CSS (round 3), `--test-concurrency=2`: 2929 tests, 2926 pass, 0 fail, 1 skipped.
