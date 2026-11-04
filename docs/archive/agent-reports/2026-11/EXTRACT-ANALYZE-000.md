# EXTRACT-ANALYZE-000 report (T1)

Characterization tests for the current Analyze, written before any extraction. Product code is unchanged and no test seam was added. Base: `origin/codex/stabilization` at `59a0b2d`.

## 1. Outcome

`tests/extract_analyze_000_characterization.test.mjs` (21 passing tests, 1 documented `test.todo`) boots the real app with `bootApp()` and the StrategyProvider probe and pins:

| Test | Pins |
|---|---|
| a1 | Empty gate: state `unavailable`, gate shown, message, `Unavailable` verdict, dashes in all facts, no provider resolve |
| a2 | Scenario with Hero cards: lossy context is `warning`, verdict `dominant`, warning text, facts, no recomputing mark |
| a3 | Missing Facing size: `unavailable` gate with the specific message; supplying it gives a real `close` verdict with the close note, then back to baseline |
| a4 | `setRecommendationState` contract for ready, mixed, warning, waiting, unavailable, loading (gate, Teach, aria-busy, messages) |
| a5 | Close verdict markup (synthetic result): "A or B", two shares, two dots, hides again when dominant |
| b1 | Exactly one `strategyProvider.resolve` per `updateContext` on every tab |
| b2 | Three slider inputs in one frame: one update, one resolve, latest value wins, calm-loading mark set then cleared |
| b3 | Matrix: hidden means dirty only (0 renders, 0 matrix model, 1 resolve); shown renders once with 169 resolves; same key reuses the model (1 resolve); table-size change rebuilds (1 + 169) |
| b4 | Hidden Range and Explain stay unrendered, render once when shown, no re-render on a clean revisit, Explain re-renders on update only while open, with the already-resolved result |
| d1 | Tab visibility and aria-selected, Back to decision |
| d2 | Matrix ARIA grid: 169 cells, one tab stop, arrows, Home/End, Ctrl+Home/End, no wrap, click select, hover preview, restore |
| d3 | Postflop Matrix empty state: 1 resolve, copy, inspector placeholders, Back to Decision |
| e1 | Language refresh EN to RU to HE to EN after a tab change: visible Decision follows, hidden Matrix and Range are not rendered, then render once each when shown |
| e2 | Language change with the Matrix visible re-renders it once |
| f | Save spot: unsaved, checking, saving, failed (retryable, logged), saved (Edit appears), back to unsaved on change, unavailable |
| g | Randomization: Keep toggles and aria-pressed, disabled targets with reasons, Keep Hero keeps Hero, change-only New Hero and New position, refused target when kept (fixed seed injected through the page global) |
| c1 | Review handoff: one update, one resolve, Hand context name, Back label, exact facts (Position, Street, Hero hand, Board, Pot, To call, Stack), no Saved banner, Edit as Scenario, first edit clears the context and becomes a lossy Scenario |
| c2 | Review handoff Back returns to Hand |
| c3 | Training Full Hand handoff: Back to Training, facts, one resolve; it also shows the Saved banner and opens Explain |
| c4 | Saved handoff: banner, truth line, restored controls, one resolve, saved state, close |
| QA-AUDIT... | Current stack behaviour (passing) plus the `test.todo` below |

## 2. QA-AUDIT-HAND-ANALYZE-STACK-001: reproduced, not fixed

It reproduces. Heads-up, 100 bb. Hero BTN A♠ K♦ limps, BB checks, flop Q♥ J♥ 2♣, BB bets 20 bb. Open that Hero decision in Analyze (`openCanonicalHandDecisionInAnalysis(1)`).

- Recorded DecisionContext: `stackBb` 100 (starting), `heroStackBb` 99, `effectiveStackBb` 79.
- The Hand context panel shows Stack 99.0 bb. The Scenario Stack control (`#stack`) holds 100, and `#stackMode` is `hero`.
- The first strategy uses the exact recorded context, so the opened result is right.
- After "Edit as Scenario" and any edit (Facing 19), the re-derived context has `stackBb` 100 and `heroStackBb` / `effectiveStackBb` null: the 79 bb effective stack is lost.

Cause: `scenarioInputFromHeroDecisionRecord` copies `context.stackBb` (the starting stack) into the Scenario input. The current behaviour is pinned by a passing test; the desired behaviour is `test.todo` with the same reproduction. Not fixed here.

## 3. Mutation table (each reverted; `git diff` on `logic.js` is empty)

| Mutation | Failing tests |
|---|---|
| Double `strategyProvider.resolve(decisionContext)` in `updateContext` | b1, b2, b3, b4, d3, c1, c3, c4 |
| `playbookSurfaceIsVisible('matrix')` always true (matrix computed while hidden) | b2, b3, e1, c3, c4 |
| Remove `invalidatePlaybookDerivedSurfaces()` from the language refresh (stale surfaces) | e1 ("ru: range rendered once on show: 0 !== 1") |

## 4. Verification

- `node --test tests/extract_analyze_000_characterization.test.mjs` alone, 5 runs: pass 21, fail 0, todo 1 each.
- `node --check` on the test file: ok. `git diff --check`: clean. File is LF.
- Full suite once: `node --test --test-concurrency=2 tests/*.test.js tests/*.test.mjs` gives tests 2976, pass 2972, fail 0, cancelled 0, skipped 1, todo 3 (one is new). It took 10 min 14 s.
- Browser: none needed (T1, tests only).

## 5. Observations (no register rows added)

- Hand-derived and Full Hand contexts are not lossy, but a postflop decision is still `warning` (heuristic limitation text). `ready` and `mixed` were seen only for preflop Hand decisions.
- Once a Hand decision is opened in Analyze, `getHeroDecisionJournal` is unavailable until Back to Hand, so a second decision of the same hand cannot be opened from Analyze.
- The lossy-context warning sentence stays English in RU and HE (not asserted in e1; a localization gap worth a register row).
- The Full Hand handoff shows the Saved banner as well as the Hand context; the Review handoff does not. The EXTRACT tickets must keep this difference or decide it.
- `card picker Clear` closes the picker when it commits a clear (test helper reopens it).
- AGENTS.md still says `logic.js` is about 16,200 lines; ANALYZE-INVENTORY-001 measured 14,902.

## 6. Git

Committed the test file and this report only, as "test(analyze): characterization tests before extraction (EXTRACT-ANALYZE-000)". Pushed as a fast-forward to `codex/stabilization`. `.codex/config.toml` and `.claude/` were not staged.
