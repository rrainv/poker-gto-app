# EXTRACT-ANALYZE-001 report (T1)

The Analyze decision panel moved out of `app/src/core/logic.js` into a mounted module, `app/src/application/analyze-decision-panel.mjs`. No visible change. Work started on `f2044b8`; origin moved to `0db67b2` (the QA-AUDIT-HAND-ANALYZE-STACK-001 fix) before I pushed, so the commit was rebased onto it (no conflicts) and the test set re-run there. Base at push: `0db67b2`.

## 1. Outcome

The module mounts on `#recommendation` with `mount(container, deps)` and returns `{ dispose, refreshLanguage, handleKey, setVisible, ...panel methods }`. It owns the verdict and truth line, the mix bar and wheel (including the Alternate view toggle), the caution callout, the fact table with its omission rule, Explain (open state, Facts/Explain toggle, `T`), Teach, Provenance fields and the "Complete this decision" gate.

`logic.js` keeps the ONE `strategyProvider.resolve` in `updateContext`, builds a frozen view model (`{ decisionContext, strategyResult, claimPolicy, state }`) and hands it to `decisionPanel().renderResult(view)`. The module never calls the provider (a test pins this) and never reads `window.app`.

## 2. Step 0 inventory

| Function (logic.js, before) | Touches | Decision |
|---|---|---|
| `renderAnalyzeVerdict` | `#bestAction`, `#bestActionClose` | **Moved** (`renderVerdict`, also exported pure). logic.js keeps a one-line wrapper (tests and spies call the page name). Deps: `describeVerdict`, `presentationActions`, `translate` |
| `renderAnalyzeTruth` | `#strategyTruthHeading/Tier/Note`, `#recommendation` data | **Moved** (`renderTruth`). Wrapper stays. Deps: `truthFor`, `truthPresentation`, `sourceLabel` |
| `renderStrategyMeta` | `#strategyMeta` | **Moved** (internal); wrapper removed (only callers moved too) |
| `renderUnavailableStrategy` | gate, verdict, mix, facts dashes, then action path, invalidator, mode status | **Split.** Panel part moved (`renderUnavailable`); logic.js keeps the wrapper with `renderPath`, `renderUnavailableActionPath`, `playbookSurfaceInvalidator`, `renderPlaybookModeStatus` in the original order |
| `setRecommendationState` + the `#analysisEditInputs.onclick` | `#recommendation`, gate, Teach | **Moved**. The click body is `editDecisionInputs()` in logic.js (focus, Hand route, rail) and is injected as `editInputs`. Dep `isHandMode` for the button label |
| `setFrequency` | `#f1..f3` | **Moved**; wrapper stays (qa002 adapter slices logic.js by this name) |
| `renderFrequencyStack` | any container | **Moved** as pure export, because Training uses it too. logic.js wrapper passes `translate` and `actionKind` |
| wheel and centre text in `updateContext` | `#actionWheel`, `#wheelCenterText` | **Moved** into the panel |
| `updateMetrics` | fact cells, `#facingSizeOut`, `#potSizeOut`, slider pair, header context | **Split.** Fact formatting and omission moved (`renderFacts`, returns the values). Stays in logic.js: preflop facing normalization, slider read-outs, header context, rail outputs |
| `analyzeFacingFact`, `analyzeToCallFact`, `analyzeFactIsUnavailable`, `applyAnalyzeFactOmission` | fact strip | **Moved**; wrappers removed |
| `syncExplainDepthControls`, `#toggleTeacher` / `#analyzeExplainFacts` bindings | Explain controls | **Moved** (state held in the panel, not read back from aria) |
| `renderPlaybookDecisionAnalysis` | `#teacherContent` | **Moved** (`renderExplain`); wrapper stays and sets `app.analysisExplanation`. `renderDecisionAnalysis`, `mountedDecisionAnalyses`, `refreshingAnalysisLanguage` **stay** (shared with Training and the language refresh); injected as `renderDecisionAnalysis` |
| `canonicalActionHistoryForAnalysis`, `trustedAnalysisFacts`, `analysisUnavailableReasonForResolution` | PlaybookState bridge | **Stay**; injected as `explainFacts`. History is only built when Explain renders (no hidden work) |
| Teach binding (`#analysisTeachDecision`) | click | **Moved**; injected `teachDecision` -> `teachPersonalDecision(app.decisionContext, 'Analyze')` |
| `T` key branch | global keydown | **Moved** to `handleKey`; the global handler calls `decisionPanel()?.handleKey(e)` |
| language refresh block in `refreshLocalizedPlaybookRuntime` | verdict, truth, mix, meta, warnings | **Moved** to `refreshLanguage(view)`; logic.js still calls `updateMetrics`, `renderPath` and the unavailable branch |
| `playbookSurfaceIsVisible('analysis')` | read `#teacherContent` style | Now `decisionPanel().isExplainVisible()`; the orchestrator pushes `setVisible(playbookModeIsVisible())` |
| street tabs, `contextKey`, Live pill, `schedulePlaybookUpdate` calm-loading mark, matrix, range, tree, table, Hand context, Saved banner | rail and other surfaces | **Stay** (later tickets 002 to 004) |

## 3. Dependencies injected

`translate`, `formatFixed`, `formatNumber`, `formatHand`, `displayCard`, `describeVerdict`, `presentationActions`, `profileFor`, `warningsFor`, `limitationFor`, `policySummary`, `sourceLabel`, `truthFor`, `truthPresentation`, `actionKind`, `actionColor`, `describeFacing`, `facingKinds`, `stackToPotRatio`, `formatSuggestedSizing`, `resultSchemaVersion`, `renderDecisionAnalysis`, `explainFacts`, `renderExplainIfNeeded`, `isHandMode`, `editInputs`, `teachDecision`. All are late-bound lambdas in `mountDecisionPanel()` so page-function spies still apply. A failed mount logs once (same pattern as Home).

## 4. Line counts

| File | Before | After |
|---|---|---|
| `app/src/core/logic.js` | 14,916 (at `0db67b2`; 14,888 at `f2044b8`) | 14,497 (-419) |
| `app/src/application/analyze-decision-panel.mjs` | n/a | 548 (new) |

The module is larger than the removed code (-419) because it adds the controller, view contract and comments. Wrappers kept in logic.js (`renderAnalyzeVerdict`, `renderAnalyzeTruth`, `renderUnavailableStrategy`, `setRecommendationState`, `setFrequency`, `renderFrequencyStack`, `renderPlaybookDecisionAnalysis`, `updateMetrics`) are for callers inside logic.js, Training, and the unchanged characterization tests that call them by page name.

## 5. Tests

Exact command (one run, concurrency 4):

```text
node --test --test-concurrency=4 tests/extract_analyze_000_characterization.test.mjs tests/analysis001_app_integration.test.mjs tests/analyze_composition001.test.mjs tests/analyze_composition001_amend2.test.mjs tests/analyze_range_ux001.test.mjs tests/analyze_range_authority_closeout.test.mjs tests/analyze_scenario_readiness001.test.mjs tests/perf001_product_performance.test.mjs tests/perf_rl18_hidden_dom.test.mjs tests/design006_playbook_workspace.test.mjs tests/ui_density001_playbook_guardrail.test.mjs tests/light_wins_batch001_cross_surface_randomization.test.mjs tests/i18n001_runtime_integrity.test.mjs tests/truth_surfaces002.test.mjs tests/extract_analyze_001_decision_panel.test.mjs
```

Result on the rebased tree (`0db67b2` + this commit): tests 173, pass 173, fail 0, cancelled 0, skipped 0, todo 0. (Before the rebase, on `f2044b8`: 170 tests, 169 pass, 1 todo, the old stack `test.todo` that the `0db67b2` fix resolved.)

- `extract_analyze_000_characterization.test.mjs`: **unchanged by me**, all green both on `f2044b8` and on `0db67b2` (the latter version includes the stack-fix edits from that ticket).
- Wider check: every other test that reads `core/logic.js` or uses `qa002_adapters.js`, plus `domain_math001`, `uiqa002b`, `strategy_integrity001a`, `playbook001`: 408 tests, 406 pass, 1 todo; the single failure before my test edit was `truth_surfaces002` (below). I did not run the full suite (CI is the gate).
- `node --check` on logic.js, the module and the four touched/new test files: ok. `git diff --check`: clean. New files are LF.

Tests changed, each with a reason:

| Test | Change | Reason |
|---|---|---|
| `analyze_composition001.test.mjs` | `analyzeFacingFact` / `analyzeToCallFact` page calls became `decisionPanel().facingFact / toCallFact` | the formatters moved into the module; logic.js wrappers were removed |
| `analyze_composition001_amend2.test.mjs` | `applyAnalyzeFactOmission` page call became `decisionPanel().applyFactOmission` | same |
| `truth_surfaces002.test.mjs` | the verdict-render case now imports `renderVerdict` from the module instead of slicing `renderAnalyzeVerdict` out of logic.js text | it read moved logic.js text; the fake DOM and assertions are unchanged |
| `extract_analyze_001_decision_panel.test.mjs` (new) | 6 tests | controller interface, Explain state and `T`, injected visibility, no provider or `window.app` in the module, dispose |

## 6. Browser (Firefox, 1920x1080 EN Midnight)

Real Firefox headless driven over WebDriver BiDi, base (`f2044b8`, served from a scratch copy) against this branch, same state script: Analyze empty gate, dominant (A♠A♥ UTG, 30 bb), close (A♠4♠, Fold 60% / Open 40%) and Explain open. Pixel diff of the four before/after pairs: 5 to 35 differing pixels each, max channel delta 16, all inside a 6x6 px box at the "Live · updated" pill (animation timing). Visually identical. Screenshots are in the session scratchpad, not committed. No console errors. Not checked: HE/RU in the browser (language refresh is covered by test e1), Daylight, 1366.

## 7. Behaviour differences

None intended or observed. Notes:

- Explain open state is now module state (`explainOpen`) instead of being read from `#teacherContent` style; the toggle still writes `display`, `aria-expanded`, `is-analysis-entering`, so tests and CSS see the same DOM. The Full Hand handoff opens Explain through `decisionPanel().toggleExplain()` instead of clicking the button.
- `T` calls the panel directly (same toggle, one fewer synthetic click).
- Language refresh repaints the same view without re-applying the recommendation state or the wheel gradient, matching the old refresh branch.
- The qa002 sandbox slice now includes `mountDecisionPanel()`/`decisionPanel()`; it finds no `#recommendation` there and returns null, so sandboxed `updateContext` runs unchanged.

## 8. Limitations and debt

- `setVisible` is pushed by the orchestrator when it evaluates surface visibility (`playbookSurfaceIsVisible`), not on navigation events. EXTRACT-ANALYZE-004 (controller) should call it on destination and tab changes and drop the DOM read in `playbookModeIsVisible`.
- Recommendation-state classification (`warning`/`mixed`/`ready`) and `contextKey` still live in `updateContext`; they belong to the controller ticket.
- `renderDecisionAnalysis` stays in logic.js because Training and Review share it; moving it is a separate ticket.
- Known facts debt from the inventory is untouched: the "Hero hand" fact is `#mEquity` and "Board" is `#mRake`.
- AGENTS.md line count (about 16,200) is stale; logic.js is now 14,497.

## 9. Disagreements or doc conflicts

None new.

## 10. Git

Committed exact files only: `app/index.html` (script tag), `app/src/core/logic.js`, `app/src/application/analyze-decision-panel.mjs`, three changed tests, the new test, this report. `.codex/config.toml` and `.claude/` were not staged. Pushed as a fast-forward to `codex/stabilization`.
