# EXTRACT-ANALYZE-002 report (T1)

The Range Matrix tab and the Range Category Comparison tab moved out of `app/src/core/logic.js` into two mounted modules. No visible change. Base: `940555d` (`origin/codex/stabilization`; the worktree was fast-forwarded to it from `d164f70` before any edit).

## 1. Outcome

- `app/src/application/analyze-matrix.mjs` mounts on `#chartView`: the 13x13 grid, cell inspector, selection preview, summary, postflop empty state, grid keyboard (A11Y-KEYS-001) and the memoised model.
- `app/src/application/analyze-range-comparison.mjs` mounts on `#rangeView`: both category grids, shares, bars, coverage and card-removal copy, conclusion, and the Hand mode, waiting-for-board and unavailable states.
- Both return `{ dispose, refreshLanguage, handleKey, setVisible, ... }`, expose `window.RiverlineAnalyzeMatrix` / `window.RiverlineAnalyzeRangeComparison`, and log once if a mount fails (same pattern as the decision panel).
- `tests/extract_analyze_000_characterization.test.mjs` passes **unchanged**.

## 2. Step 0 inventory

| Function (logic.js, before) | Decision |
|---|---|
| `renderChart` | **Moved** (`render`). Page wrapper stays: the invalidator, tab switch, language refresh and many tests call the page name (and the characterization test spies it) |
| `prepareMatrixStrategyModel`, `matrixStrategyKey` | **Moved** (`prepareModel`, `strategyKey`). Wrappers stay. The cache is still `app.matrixModel` (tests read and reset it); injected as `modelCache {get,set}` |
| `matrixMixState` | **Moved** (pure export). Wrapper stays (a test calls the page name) |
| `renderMatrixCellInspector`, `restoreSelectedMatrixInspector`, `bindMatrixGridInteractions` | **Moved**, no wrapper (only callers moved; 3 tests updated, see section 5) |
| `buildMatrixGridCells`, `matrixGridCells`, `syncMatrixTabStop`, `bindMatrixGridKeyboard` | **Moved** as exported grid kit in `analyze-matrix.mjs`; the comparison module imports it (both grids use it) |
| `renderRangeAdvantage` | **Moved** (`render`). Wrapper stays (invalidator, change handlers, tests) |
| `renderRangeGrid`, `renderRangeCategoryBars`, `rangeComparisonStats`, `rangeRemovalPresentation` | **Moved** (stats and removal helpers also exported) |
| `handCode`, `projectHandClassesAfterCardRemoval`, `representativeRangeComparisonFacts`, `PREFLOP_RANGES`, `visualActionKind` | **Stay** in logic.js (Training, other callers, or global bridges); injected |
| `#chartAction` and `rangeAdvHeroPos/VilPos` change bindings, `openCharts`, `backContext`, `postflopMatrixBack` | **Stay**: they are tab orchestration and call the invalidator |
| `playbookSurfaceIsVisible('matrix'/'range')` | Now `matrixView().isVisible()` / `rangeComparisonView().isVisible()` instead of reading `display` |
| language-refresh idle copy for never-rendered tabs | **Moved** to each module's `refreshLanguage()` |

## 3. Dependencies injected

Matrix: `translate`, `formatNumber`, `ranks`, `handCode`, `decisionContext` (validated by schema version), `heroClass`, `currentStreet`, `providerOptions` (`readHeuristicOptions`), `cardRemoval`, **`resolveCell`**, `visualActionKind`, `sourceLabel`, `policySummary`, `selectedHand {get,set}`, `modelCache {get,set}`.

Comparison: `translate`, `formatFixed`, `ranks`, `handCode`, `isHandMode`, `modes`, `board`, `decisionContext`, `preflopRanges`, `cardRemoval`, `comparisonFacts`.

`resolveCell(cellContext)` is the only provider access: the page implements it as one `strategyProvider.resolve` plus the presentation actions, and returns `{ source, unavailable, actions, claimPolicy() }` (the claim policy is computed lazily, once, as before). Neither module imports or names the provider, reads `window.app`, or queries outside its container; a test pins this.

## 4. Line counts

| File | Before | After |
|---|---|---|
| `app/src/core/logic.js` | 14,497 | 13,923 (-574) |
| `app/src/application/analyze-matrix.mjs` | n/a | 449 (new) |
| `app/src/application/analyze-range-comparison.mjs` | n/a | 342 (new) |
| `tests/extract_analyze_002_matrix_comparison.test.mjs` | n/a | 6 tests (new) |

The modules are larger than what left logic.js (-574, net of about 140 lines of wrappers and mount code) because they add the controllers, the dependency contract and comments.

## 5. Tests

Commands (concurrency 2, one at a time):

```text
node tools/run-tests.mjs --area analyze
  -> 45 files, total 489, pass 488, fail 0, skip 1, todo 0 (328.7 s)
node --test --test-concurrency=2 tests/extract_analyze_000_characterization.test.mjs tests/extract_analyze_001_decision_panel.test.mjs tests/extract_analyze_002_matrix_comparison.test.mjs tests/perf001_product_performance.test.mjs tests/perf_rl18_hidden_dom.test.mjs tests/cleanup001f_range_matrix_scope.test.mjs tests/analyze_range_ux001.test.mjs tests/analyze_range_authority_closeout.test.mjs tests/saved_objects001_performance.test.mjs tests/range_cal002d_personal_strategy_matrix.test.mjs tests/analyze_composition001.test.mjs tests/a11y_keys001.test.mjs tests/hands_on_defects001.test.mjs tests/product_ui005_workspace_fit.test.mjs tests/design005_poker_visual_system.test.mjs tests/design006_playbook_workspace.test.mjs tests/strategy_integrity001b_analytical_truthfulness.test.mjs
  -> tests 185, pass 185, fail 0, cancelled 0, skipped 0, todo 0
```

I also ran every other test that reads `logic.js` and mentions matrix or comparison identifiers (11 files). Two failed before I fixed them (below); after the fixes `i18n001_runtime_integrity` + `uiqa002b_range_poker_polish` give 27/27, `l10n001_native_terminology` 8/8, and the two docs tests 10/10. The full suite was not run (T1; CI is the gate).

`node --check`: logic.js and both modules ok. `git diff --check`: clean. New files LF.

Tests changed, each with a reason:

| Test | Change | Reason |
|---|---|---|
| `analyze_composition001` | the inspector case asserts `#selectedHand` after hover, focus, focusout, keyboard instead of spying `renderMatrixCellInspector` | the inspector moved into the module, no page function to spy |
| `perf_rl18_hidden_dom` | `bindMatrixGridInteractions` spy replaced by `#strategyGrid[data-delegated="true"]` (cells reuse assertion unchanged) | same |
| `analyze_range_ux001` | `renderRangeGrid` spy replaced by checking both grids have 169 cells | same |
| `uiqa002b_range_poker_polish` | `app.call('renderMatrixCellInspector', cell)` became `app.call('matrixView').renderInspector(cell)` | same |
| `tests/tooling/audit_i18n.cjs` | the two new modules added to the scanned product sources | the audit lost the string "Range comparison is unavailable because the canonical decision context could not be resolved." when it left logic.js, so the accepted-fallback list no longer matched; coverage restored, list unchanged |
| `extract_analyze_002_matrix_comparison` (new) | 6 tests | controller interface; `setVisible` pushed by the tab switch; PERF-001 resolve counts; module has no provider, `window.app` or document queries; hidden language refresh does no work; dispose |

## 6. PERF-001 evidence

From the new test (real app, instrumented provider) and the unchanged characterization test:

- Matrix hidden, surfaces marked dirty and `renderVisiblePlaybookDerivedSurfaces` run: **0** resolves, `app.matrixModel` stays `null`.
- Matrix tab shown (preflop UTG, As Kd): **169** resolves, one per hand class, each with two representative Hero cards.
- `renderChart` again with the same context: **0** (memo hit). A context differing only in Hero cards: **0** (key excludes them). Flop context: **0** (preflop only).
- Language refresh with both tabs hidden: **0** resolves, no render. The characterization test still sees exactly one `renderChart` / `renderRangeAdvantage` per show, and none on hidden refresh in EN, RU and HE.
- One `strategyProvider.resolve` per decision update is untouched (`updateContext` unchanged); `perf001_product_performance` passes unchanged.

## 7. Browser (Firefox, 1920x1080 EN Midnight)

Real Firefox headless over WebDriver BiDi, base `940555d` (scratch copy served on its own port) against this tree, same script: Analyze preflop UTG As Kd, then Decision, Range Matrix, Matrix with AKo selected, Category Comparison on a flop (2c 7d 9h), and the postflop Matrix empty state. Pixel diff of the five before/after pairs: 0 differing pixels for Decision; 27 to 36 for the others, all inside one 6x6 px box at the "Live" pill (animation timing), max channel delta 31. Cells 169 and 169, summary and status text identical. Screenshots are in the session scratchpad, not committed. Not checked: HE/RU in the browser, Daylight, 1366.

## 8. Behaviour differences

None intended or observed. Notes:

- A tab's visibility is now module state set by `selectPlaybookAnalysisView` (`setVisible`) instead of a `display` read. The orchestrator still ANDs it with the workspace being visible (`playbookModeIsVisible`), so a selected tab in a hidden workspace is not rendered, as before.
- Clicking a matrix cell calls the module's `render` directly instead of the page name `renderChart`. The click path had no spy or count in any test.
- The comparison stat cells were written twice per render (grid pass and result pass) with identical values; now once.

## 9. Limitations and debt

- `playbookModeIsVisible()` still reads the DOM; EXTRACT-ANALYZE-004 (controller) should drive it with `setVisible` on navigation, as noted in EXTRACT-ANALYZE-001.
- Page wrappers kept for callers and tests: `renderChart`, `prepareMatrixStrategyModel`, `matrixStrategyKey`, `matrixMixState`, `renderRangeAdvantage`, `representativeRangeComparisonFacts`. Remove with the controller ticket.
- `app.matrixModel` and `app.selectedHand` still live on `app` (accessors injected); they move with the controller.
- `handleKey` on both controllers returns false (no key bindings of their own yet).
- `analyze-decision-panel.mjs` (EXTRACT-ANALYZE-001) is still not scanned by `audit_i18n.cjs`; I added only my two modules. Adding it may surface new accepted fallbacks, so it is a separate small ticket.
- Register rows added (docs commit): ANALYZE-FULLHAND-BANNER, ANALYZE-SECOND-DECISION, ANALYZE-FACT-IDS.

## 10. Disagreements or doc conflicts

None new. AGENTS.md still says `logic.js` is about 16,200 lines; it is now 13,923.

## 11. Git

Two commits, exact file lists, pushed as a fast-forward to `codex/stabilization`:
1. `refactor(analyze): matrix and category comparison extracted (EXTRACT-ANALYZE-002)`: `app/index.html`, `app/src/core/logic.js`, both new modules, the new test, `analyze_composition001`, `analyze_range_ux001`, `perf_rl18_hidden_dom`, `uiqa002b_range_poker_polish`, `tests/tooling/audit_i18n.cjs`.
2. `docs: register rows from EXTRACT-ANALYZE-000, EXTRACT-ANALYZE-002 report`: `docs/ISSUE_REGISTER.md` and this report.

`.codex/config.toml` and `.claude/` were not staged. No pre-existing dirty files.
