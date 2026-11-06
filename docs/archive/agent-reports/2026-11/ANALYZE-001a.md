# ANALYZE-001a report (T2, result side rebuilt to Analyze v4)

Base: `origin/codex/stabilization` at `181f048`. Branch `wip/ANALYZE-001a` (pushed for owner review). Visual status: PARTIAL (Firefox screenshots of every required state, no side-by-side mockup composites; human acceptance pending).

## Built
- Hero answer card in `analyze-decision-panel.mjs`: one source/tier label (no "Verified" pill), two-state verdict, thick labelled mix bar (shared `createMixBar`, LTR), one plain sentence, one truth statement, Save spot (the one accent-filled action), All details (limits, spot facts, alternate wheel).
- Tiles from real facts (shared `createFactTile`, new `scope` line): Equity needed to call (Exact · price only), Pot, To call, SPR; omission rule kept, omitted facts listed under All details. Ids fixed: `mHeroHand`, `mBoard` (ANALYZE-FACT-IDS).
- Matrix inline on Decision for preflop on the Analyze destination (Range Matrix tab and View all hands retired; Category Comparison stays): labelled cells, Hero hand outlined, side card with "N of M combos" and the mix, legend, Baseline only, keyboard grid and inspector kept. Incomplete decision: gate card plus inert labelled grid (no resolves). Postflop: no matrix, Spot table open by default.
- De-clutter: truth note kept as the single statement; caution callout and provenance moved into All details; wheel inside All details.
- EN/RU/HE strings for new keys; about 330 lines of dead CSS removed; docs: DESIGN_SYSTEM Analyze bullets, register row ANALYZE-FACT-IDS.

## PERF-001
Firefox on this laptop (headless): 169-cell model 6 to 16 ms (median about 9), matrix DOM render 4 to 6 ms, full update at a context change 5 to 13 ms. Under 50 ms, so the matrix renders synchronously with the update (no idle deferral). One decision resolve per update is unchanged; the 169 cell resolves occur only for a visible matrix on a memo miss, never while hidden.
Test changes with reasons (matrix is now visible on Decision): b1/b2/b3, c3/c4 in the characterization test, 002 visibility and PERF tests, perf001 test 6, perf_rl18 and a11y_keys001 (tab click removed). Invariants preserved: one decision resolve; hidden matrix never resolves or renders.

## Motion checklist
Moment 3 answer reveal: verdict swap with 2 px blur bridge built; mix reveal built (replays only when structure changes, in-place update otherwise); reason fade built. Moment 4 number rolls: built for tiles (quiet-window so drags never flicker). Moment 7 All details: built (grid grow, chevron turn, rows 45 ms apart). Moment 1 (choosing an action): not applicable on the result side. Moment 8 tabs, 9 saving: existing, unchanged. Moment 21 loading: calm fade restyled to the hero. Tempo tags `data-motion="drill"` (hero) and `"panel"` (details); keyboard instant and Reduced fades via the shared rules. `/review-animations` was not run as a separate pass.

## Dead-space audit (1920 / 1366, EN Midnight; px)
Column vs rail: empty 1193/992 and 1972/1021; dominant 1450/992 and 1785/1021; close 1491/992 and 1798/1021; postflop 1398/992 and 1070/1021. The column is never shorter than the rail; vertical gap between sections 0. Widest empty strip: the tile row when only Pot shows (about 920 x 77, under 160 tall).

## Differences from the mockup (with reason)
No Verified pill, "Drill similar spots", "You here", "Open in Equity", equity-vs-range tile, Baseline/Your plan/Compare switch (no data or feature; owner decisions). Spot sentence and Edit spot are ANALYZE-001b (left rail untouched). Hover card is a fixed side card, not floating. Tiles: only real facts, so a Scenario often shows just Pot. Matrix inline only on Analyze (not in the Hand destination).

## Verification
`node tools/run-tests.mjs --area analyze --group css`: 45 files, 489 tests, 0 failures (1 skip, pre-existing). Touched tests outside that set, run separately: 17 files, 181 pass; docs and token tests 5 files, 27 pass. `node --check` on changed JS, `git diff --check` clean. Screenshots: `C:\Users\sjzns\Projects\Riverline_QA_2026-10\ANALYZE-001a\` (before, final, shots).

## Limitations and debt
- Tutorial steps still name "Range Matrix" next to the views (anchors work; copy plus RU/HE update needed): proposed row TUTORIAL-ANALYZE-001a.
- `tests/tooling/verify_product_ui002r3_geometry.cjs` still references retired ids (manual script, already stale).
- `extract_analyze_001/002` tests are in no area in `tests/areas.json` (pre-existing; `--check` reports it).
- Hero tile row looks sparse for Scenarios; owner may want Facing/Stack tiles.
- Not verified: Hand destination visually; phone widths; hover card in HE beyond screenshots.

## Git
Not staged: `.claude/`, `.codex/`. Committed with exact file list and pushed to `origin/wip/ANALYZE-001a`.
