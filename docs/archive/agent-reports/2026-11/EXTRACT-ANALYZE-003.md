# EXTRACT-ANALYZE-003 report (T1)

The Analyze Spot rail moved out of `app/src/core/logic.js` into a mounted module, `app/src/application/analyze-spot-setup.mjs`, in two commits. No visible change. Bases: work started on `15737ec`; origin moved to `43f3e54` (docs only) before the push, so both commits were rebased onto it.

## 1. Outcome

- 003a (Scenario setup) and 003b (Hand-context and Saved banners) both live in one module, mounted on `#playbookSpotPanel`, with `{ dispose, refreshLanguage, handleKey, setVisible }`. It registers `window.RiverlineAnalyzeSpotSetup`; a failed mount logs once.
- It owns the randomize button and its keep / change-only menu, the setup slider pairs and selects (which update each asks for), the Advanced rules switch, the disclosure summaries, the Scenario control authority (read-only while Hand is authoritative), the readiness gate's focus target, the Hand-context banner and the Saved banner.
- The three handoffs (Review, Training Full Hand, Saved), the Scenario/Hand switch and PERF-001 are unchanged. The scheduler, `bindSliderPair` and the one `strategyProvider.resolve` stay in `logic.js`; the module only calls the injected `schedulePlaybookUpdate` / `commitPlaybookUpdate` / `updateContext`.

## 2. Step 0 inventory

| Function / block (logic.js, before) | Decision |
|---|---|
| `setScenarioRandomizationStatus`, `scenarioRandomizationTargetLabel`, `renderScenarioRandomizationRecipe`, `scenarioRandomizationFailureMessage`, `scenarioRandomizationSuccessMessage` | **Moved** (private / exported pure) |
| `renderScenarioRandomizationControls` | **Moved**; wrapper stays (`renderPlaybookCards` and tests call the page name) |
| `randomizeCurrentAnalyzeScenario` | **Moved** (`randomize`); wrapper stays (tests spy the page name; the click handler goes through it) |
| `copyScenarioRandomizationRecipe`, menu Escape / outside click, keep / target / copy bindings | **Moved** |
| `applyRandomizedScenarioToControls`, `scenarioRandomizationSeed`, `randomizationSeed` | **Stay** (touch `app.gto`, card slots, page globals the tests inject a seed through); injected |
| slider-pair bindings (players, stack, ante, facing, pot), selects (`heroPos`, `stackMode`, `rakeMode`, `straddle`, `lastAction`), `#toggleAdvanced` | **Moved** |
| `bindSliderPair`, `sliderPairValue`, `syncSliderPair`, `readSliderPairDraft`, `SLIDER_PAIR_NUMBER_IDS` | **Stay** (shared kit; `qa002_adapters.js` and `bug003_adapters.js` slice their text); injected |
| `syncSpotDisclosureSummaries` + its input bindings | **Moved**; wrapper stays |
| `setPlaybookControlAuthority` | **Split.** Control disabling and the card-clear buttons moved (`setControlAuthority`). Mode data attribute, mode buttons, `[data-playbook-scenario/hand]` visibility and `renderCanonicalHandWorkspace` stay |
| `PLAYBOOK_SCENARIO_CONTROL_IDS` | **Stays** (a test reads the page global); injected |
| `SCENARIO_READINESS_FIELD_CONTROLS`, `scenarioReadinessFocusTarget`, `focusScenarioReadinessField` | **Moved**; wrappers stay (tests call and spy the page names) |
| `renderAnalyzeHandContext`, `renderAnalyzeHandContextStackNote`, Return / Edit bindings | **Moved**; wrapper stays |
| `analyzeHandContext` (handoff slot), `setAnalyzeHandContext` | **Stay**: three handoffs and `updateContext` write it, and the qa002 sandbox slices `updateContext` text with a `typeof` guard on it |
| `renderSavedSpotViewer`, `#savedSpotCloseButton` binding | **Moved**; wrapper stays. `activeSavedSpotContext` stays (many writers) |
| Hero / Board / Dead card rendering (`renderPlaybookCards`, `renderCanonicalDecisionCards`, `renderPlaybookCardStateSummary`, `syncCanonicalDecisionDisplay`) | **Stay.** Shared with the card picker, Equity and Hand; `uiqa001r_card_picker_adapter.mjs` extracts `renderPlaybookCardStateSummary` by text. Moving them is a separate ticket |
| `readPlaybookScenarioInput`, `updatePositions`, `updateActionOptions`, `setScenarioControlPair` | **Stay** (used by Saved, Training, Hand paths); injected where needed |
| `updateContext` | **Untouched** |

## 3. Dependencies injected

`translate`, `isHandMode`, `currentStreet`, `modes`, `controlIds`, `randomizationBridge`, `randomization {keeps, pending/setPending, recipe/setRecipe}`, `readScenarioInput`, `newSeed`, `applyScenario`, `requestRandomize`, `writeClipboard`, `updateContext`, `schedulePlaybookUpdate`, `commitPlaybookUpdate`, `bindSliderPair`, `updatePositions`, `reconcileActionDependencies`, `expandContext`, `handContext`, `savedSpotContext`, `closeSavedSpot`, `navigate`, `streetLabel`, `displayCard`, `formatFixed`. All late-bound lambdas, so page-function spies still apply. A test pins that the module has no provider, no `window.app`, and no query outside its container.

## 4. Line counts

| File | Before | After |
|---|---|---|
| `app/src/core/logic.js` | 13,927 | 13,579 (-348) |
| `app/src/application/analyze-spot-setup.mjs` | n/a | 563 (new) |
| `tests/extract_analyze_003_characterization.test.mjs` | n/a | 24 tests (new) |
| `tests/extract_analyze_003_spot_setup.test.mjs` | n/a | 6 tests (new) |

The module is larger than what left `logic.js` (about 140 lines of wrappers, mount code and deps stay behind; the module adds the controller, deps contract and comments).

## 5. Tests

Step 1 (before moving): `extract_analyze_003_characterization.test.mjs` pins what 000 does not: each slider pair's update reason, typing coalesced and the final change flushing at once, drag then release, selects (one "Configuration changed" update, `lastAction` reconciling facing first), the Advanced switch, disclosure summaries, menu Escape / outside click / inside click, pending guard, Copy recipe (success and clipboard refusal), Hand making every Scenario control read-only and restoring, and readiness focus (field, Advanced rules opening, collapsed rail expanding, card picker, non-owned states). It passed 24/24 on the untouched base (`15737ec`, scratch worktree) and 24/24 after the move.

Commands, one run at a time, concurrency 2, after the final tree (upstream delta is docs only):

```text
node tools/run-tests.mjs --area analyze
  -> files 48, total 505, pass 504, fail 0, skip 1, todo 0
node --test --test-concurrency=2 tests/extract_analyze_*.test.mjs tests/perf001_product_performance.test.mjs tests/perf_rl18_hidden_dom.test.mjs tests/analyze_scenario_readiness001.test.mjs tests/light_wins_batch001_*.test.mjs tests/saved_objects001_performance.test.mjs tests/i18n001_runtime_integrity.test.mjs
  -> tests 137, pass 137, fail 0
30-file adapter group (every test using qa002_adapters, bug003_adapters, uiqa001r_card_picker_adapter or saved-spot names)
  -> tests 405, pass 405, fail 0
```

I also ran `decision_input_truth001`, `locale_numbers003_input`, `playbook001_state_source` (green). `node --check` on `logic.js` and the module: ok. `git diff --check`: clean; all files LF. The full suite was not run (T1; CI is the gate). The area run showed one skip, as before.

Tests changed, each with a reason:

| Test | Change | Reason |
|---|---|---|
| `tests/tooling/audit_i18n.cjs` | the new module added to the scanned sources | strings left `logic.js` |
| `tests/uiqa001r_card_picker_adapter.mjs` | stubs `mountSpotSetup` next to `mountDecisionPanel` | its sandbox runs the init slice, which now mounts the module; it found one test failing with `mountSpotSetup is not defined` |
| `tests/light_wins_batch001_randomization.test.mjs` | counts decision resolves only | pre-existing flake, see section 8; not caused by this ticket |
| two new test files | | characterization and module contract |

## 6. Browser (Firefox, 1920x1080 EN Midnight)

Real Firefox headless over WebDriver BiDi: base `15737ec` (scratch worktree on its own port) against this tree, same script (Welcome dismissed, Analyze opened). Four states: empty, spot filled (A♠K♦ BTN, preflop), Hand context (`setAnalyzeHandContext` with the live DecisionContext) and Saved banner (`renderSavedSpotViewer`, Scenario-derived). Pixel diff of the four before/after pairs:

| State | Differing pixels | Max channel delta |
|---|---|---|
| empty | 0 | 0 |
| spot filled | 33 | 14 |
| Hand context | 32 | 2 |
| Saved banner | 3 | 2 |

All differing pixels are inside one 6x6 px box at the "Live" pill (animation timing). Screenshots are in the session scratchpad, not committed. Not checked: HE/RU in the browser (language refresh and the RU/HE stack note are covered by `extract_analyze_000` tests e1 and the stack-note tests), Daylight, 1366. My first capture attempt showed the Welcome screen instead of Analyze (a vacuous 0-pixel diff); it was redone after dismissing Welcome and navigating.

## 7. Behaviour differences

None intended or observed. Notes:

- The module's document-level outside-click listener is removed on `dispose`.
- Hand-context, Saved banner and disclosure summaries now refresh through one `refreshLanguage()` call, placed where `syncSpotDisclosureSummaries()` used to run (after the tightness labels update, so the summary text is current).
- Listeners attach when the module mounts (in the same init position as before, or lazily on first use).

## 8. Limitations and debt

- Pre-existing flake fixed: `light_wins_batch001_randomization` "empty Analyze dice adapter" expected exactly one provider resolve, but since ANALYZE-001a a random preflop spot also renders the inline matrix (169 more resolves). About 7 of 25 random spots are preflop, so it failed roughly a quarter of runs on the base too (measured on both trees). It now counts decision resolves, as the 000 test does.
- Cards stay in `logic.js` (see inventory); Hero / Board / Dead rendering plus the card picker is its own extraction.
- The handoff slot `analyzeHandContext` and `activeSavedSpotContext` are still page variables; EXTRACT-ANALYZE-004 (controller) can own them.
- `setVisible` on this module is stored but not yet pushed by the orchestrator (nothing in the rail needs it today).
- `handleKey` returns false (no key bindings of its own).
- No register rows added or closed.

## 9. Disagreements or doc conflicts

None new. AGENTS.md now says `logic.js` is "about 14,900 lines at 2026-11-04"; it is 13,579.

## 10. Git

Two code commits, this report and a manifest fix, exact file lists, rebased onto `origin/codex/stabilization` `43f3e54`, pushed as fast-forwards. The first push (`8018291`) failed the CI "test manifest covers every test file" step in 11 s because the two new test files were not in `tests/areas.json`; the fix (`d2cc63c`, two lines in the analyze area) passed `node tools/run-tests.mjs --check` locally.

CI: run 42393902559 (Node CI, `d2cc63c`) green; Docs tests run 42393902505 green. The pre-rebase commits are also on `origin/wip/EXTRACT-ANALYZE-003`. `.codex/config.toml` and `.claude/` were not staged. No pre-existing dirty files. Two scratch worktrees and the screenshots live only in the session scratchpad.
