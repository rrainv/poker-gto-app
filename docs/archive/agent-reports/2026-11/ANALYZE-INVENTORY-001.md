# ANALYZE-INVENTORY-001 report (T0, read-only)

Nothing was edited, staged or committed. The worktree is detached at `ea15545` (origin/codex/stabilization). I did not run the test suite, and test files were only skimmed by name and header. I started the dev server for measurements, then stopped it and reset the viewport.

## 1. Outcome

The current Analyze is a left Spot rail plus a right Result panel with three tabs. The approved target is the v4 board, with some blocks the app already has the data for and some it does not.

**Spot rail:**
- At 1920×1080 on this commit it is 992 px tall when empty and 1042 px when filled.
- The Result panel beside it is only 395 px tall when empty and 488 px when filled.

**Extraction order:**
- Extract the decision panel first, then the matrix and comparison, then spot setup, then the `updateContext` orchestrator.
- Write characterization tests before any of it.
- Build ANALYZE-001 into the new modules instead of editing `logic.js`.

## 2. (a) What Analyze shows and does today

`logic.js` is 14,902 lines, not the ~16,200 AGENTS.md says. Markup is `app/index.html` lines 823–1810 (`#gtoMode`).

### Spot rail (index.html 833–1074)

| Block | Markup | logic.js |
|---|---|---|
| Scenario/Hand switch (Hand mode shares this rail, out of scope) | 471–473, 1077–1161 | `setPlaybookControlAuthority` |
| Header: Spot, Live indicator, Random spot, keep / change-only menu, recipe details | 837–883 | `randomizeCurrentAnalyzeScenario` 2668; bindings 9287–9318 |
| Hand-decision context (read-only facts, Back, Edit as Scenario) | 885–897 | 2962–3017 |
| Saved Spot banner | 899–906 | 8838–8900; close at 6100 |
| Cards: Hero, Board with street labels, Dead (Known burned / dead) | 908–943 | 3019–3060, `normalizedDecisionCards` 2480 |
| Action: position, prior action, facing size, pot | 945–979 | `readPlaybookInputSnapshot` 2729 |
| Table: table size, stack mode, starting stack | 981–1011 | slider pairs, `updateContext` 7619 |
| Strategy adjustment (hidden, OWNER-12) | 1014 | dormant |
| Game and accounting: rake, ante, straddle | 1038–1073 | |

### Result panel (index.html 1167–1800)

- **Tabs:** Decision / Range Matrix / Range Category Comparison. Switching is `selectPlaybookAnalysisView` 9247–9285. Save spot, Edit saved item and View all hands sit beside the tabs (1512–1521).
- **Street stepper:** `renderPath` 6625 plus the Action-path rail (1787) and compact mount (1168).
- **Decision tab** (1170–1275):
  - Verdict and truth line: `renderAnalyzeVerdict` 2876, `renderAnalyzeTruth` 7239.
  - Mix bar plus an alternate wheel: `renderFrequencyStack` 7157, with the wheel set in `updateContext` 7811–7847.
  - Caution callout.
  - Fact table: `updateMetrics` 6436 and the omission rule 6415–6570.
  - Explain: `renderPlaybookDecisionAnalysis` 7541, toggle at 9106–9140.
  - Teach from this decision: `teachPersonalDecision` 5623, bound at 9404.
  - Provenance disclosure: `renderStrategyMeta` 2929.
  - Gate state "Complete this decision": `renderUnavailableStrategy` 3063, `setRecommendationState` 7302.
- **Range Matrix tab** (1524–1660):
  - `renderChart` 6863, model `prepareMatrixStrategyModel` 7082, grid and inspector 6732–6860.
  - Postflop shows an empty state.
- **Range Category Comparison tab** (1665–1780): `renderRangeAdvantage` 10232 with helpers 10099–10231.
- **Also present:** a betting-tree surface (`renderBettingTree` 10400) and the collapsed "Spot table" strip (`renderPlaybookTableProjection` 7559).
- **Save spot:** a state machine at 3236–3340, bound at 3446.
- **`updateContext`** (7603–7883) is the single orchestrator.

### Handoffs into Analyze

| From | Function |
|---|---|
| Review | `openCanonicalHandDecisionInAnalysis` 5934, called from 5893 |
| Training Full Hand | `openFullHandDecisionInAnalysis` 14462 |
| Saved | `restoreSavedSpotPresentation` 8838 and the viewer at 8874; context set at 8931 |

All three go through `setAnalyzeHandContext` or the saved banner, then `updateContext` with an override resolution.

### PERF-001 constraints that must survive

1. One `strategyProvider.resolve` per decision update (7690). The perf001 test guards this.
2. Latest-frame coalescing: `playbookUpdateScheduler` (6302) and `schedulePlaybookUpdate` (6359). The final slider change flushes immediately.
3. Surface invalidator (6301–6357) over `matrix`, `range`, `tree`, `analysis` and `table`:
   - Hidden surfaces are only marked dirty and render once when shown.
   - Visibility is read from DOM state (6318–6326). A mounted module must replace this with `setVisible`.
4. The matrix model is memoised by a context key that excludes Hero cards (7074). It does 169 provider resolves, preflop only, and only when the matrix is visible. The test "Matrix preparation remains provider-backed" guards it.
5. The language refresh path (9715–9760) invalidates instead of rendering hidden surfaces.
6. Calm loading: `data-recomputing` on `#recommendation` (6359–6366).

Debris to fix during the redesign: the "Hero hand" fact has id `mEquity` and the "Board" fact has id `mRake`.

## 3. (b) Approved mockups

The kit canvas is https://claude.ai/artifact/T3AFKWngjB7Wwt16S4Ghts. Its boards are:

- **Board 12, AnalyzeD (v4):** the approved style.
- **Board 13, AnalyzeC (v3):** earlier.
- **Board 14, AnalyzeA (option A):** earlier.
- **Board 15, AnalyzeB (option B):** earlier.

The phone prototype is MOB-05, https://claude.ai/artifact/CdAHUhBxo21ZEFQvz6xPdL, found via `docs/design/CANVASES.md`.

**v4 blocks, top to bottom:**
1. Sentence spot: "You're on the button. CO opens to 2.5 bb." with large hole cards, a sub-line "Folded to the CO · 100 bb deep · 9-handed", an Edit spot button, and an underline street stepper.
2. Hero answer card:
   - Verdict "3-bet or call", with "close call" and "Verified" pills.
   - A thick labelled mix bar.
   - One plain-language sentence.
   - Drill similar spots (primary), Save spot, All details ›.
3. Three tiles: equity needed (38.5%, "price only · exact"), your equity vs CO's range (≈50%, "range estimated"), and pot with to-call.
4. "You here" pills: your plan, Training record (3 of 5 matched), saved hands (2).
5. Labelled 13×13 matrix:
   - Baseline / Your plan / Compare switch.
   - Hover card with combos ("7 of 12 combos") and the mix.
   - Legend.

**v3:**
- The spot is a row of chips (you, cards, before, stacks, players) plus Random spot.
- The result is a compact band with the four facts, a short why, and Drill, Save and Open in Equity.
- "You in this spot" is a three-part card, and the matrix has a Baseline / Your plan switch.

**A and B:**
- Setup is a form (A) or a chip sentence (B).
- Both have an action-history strip and Open in Equity.

**Phone (MOB-05):**
- A compact setup card with tappable tags that open bottom-sheet pickers.
- Tabs Decision / Range / Explain / Source, swipeable.
- Hero card, three tiles, an "All details" accordion, a tap-to-inspect matrix opening a sheet, and a Source tab.
- Its numbers are illustrative.

## 4. (c) Mapping and honest first-version scope

| Mockup block | Verdict | Notes |
|---|---|---|
| Spot as sentence + large cards + Edit spot | **Have** (re-presentation) | Same inputs. Editing moves to chips or popovers. Facing and pot sliders must stay reachable. Scenario is lossy, so the sentence says only what is known. |
| Street stepper | **Have** | `renderPath`. |
| Random spot | **Have** | Keep the keep / change-only menu. |
| Verdict + "close" | **Have** | `analyze-verdict.mjs`. |
| Thick labelled mix bar | **Have** | Shared mix bar. Bar stays LTR (D-13). |
| One-sentence why | **Have** | `profile.reason`. |
| Tier / source label | **Have** | The tier pill, never a "Verified" pill (see below). |
| Pot / to call / required-equity tiles | **Have** | Fact omission rule applies. To call and pot odds are hidden in Scenarios without an exact price. |
| Equity vs the opponent's range | **Partial** | Today it exists only inside Explain as "baseline sampled equity against an assumed range". A tile needs a ticket that calls equity code with the baseline-sample label. |
| Save spot | **Have** | State machine at 3236. |
| All details / Provenance | **Have** | Existing disclosure. |
| Labelled matrix, hero outlined, hover card with combos | **Have** | Cell inspector already shows available and removed combos. Labels in cells are presentation only. |
| Baseline / Your plan / Compare | **Future** | No Analyze consumer of Personal Strategy exists. The `personal-strategy-*` modules suggest the data is queryable, which needs a ticket and a review. |
| "You here" (plan / Training record / saved count) | **Future** | Training Memory and Saved exist, but there is no spot-keyed query. |
| Drill similar spots | **Future / verify** | `training-same-spot-lifecycle.mjs` exists. I did not confirm an entry point from Analyze. |
| Open in Equity | **Future** | No Equity handoff from Analyze today. |
| "Verified" pill | **Drop** | Conflicts with the claim policy (baseline output is never "verified" or "correct"). |
| Table-rules chip ("Online 9-max") | **Drop here** | The header context chip already owns it. |
| Phone layout | **Later** | PC first (P1-28). |

**First-version scope (ANALYZE-001):**
- Sentence spot with chips, plus the street stepper.
- Hero answer card from the existing verdict, mix and why.
- Tiles from real facts only.
- Labelled matrix, Baseline only.
- Tabs Decision / Range Matrix / Category Comparison kept.
- Save spot, Explain inline, Provenance.
- Hand-context and Saved banners restyled.
- The empty state redesigned (see §5).

## 5. (d) Dead space and clutter

BUILT-SET screenshot 09 is not in the repo or this session. I reproduced the state in the running app at 1920×1080 instead.

- **Empty "Complete this decision" panel:**
  - It is a 543×204 box with one sentence and a button.
  - The right column is about 395 px tall against a rail of 992 px (page 1199 px), so about 600 px is blank beside the form.
  - Gate message, tab strip, stepper and a collapsed Spot table all show with nothing in them.
- **Filled state (a random spot):**
  - The rail is 1042 px, while the result is about 488 px.
  - That is roughly 550 px empty under the result.
  - Explain is collapsed by default. The owner decided that (QA-ANALYZE-COMPOSITION-002), but the gap is OWNER-20.
- **Left rail too long:**
  - Eight stacked sections, with four sliders for Facing, Pot, Table size and Stack.
  - The Hand-context, Saved and randomization-detail blocks appear above them when active.
- **Other clutter:**
  - A "Guided tour" card on top.
  - The Spot header carries a Live badge and a dice menu.
  - The truth note, the caution callout and the Provenance disclosure repeat each other.
  - There is an alternate wheel view of the mix.
  - Two Save paths (a tab-bar button and the Hand-only buttons).

## 6. (e) Extraction plan

**Rules:**
- Follow `home-workspace.mjs`: `mount(container, deps)` returns `{dispose, refreshLanguage, handleKey, setVisible}`, with injected deps and never `window.app`.
- Existing tests assert on ids and classes, so keep those ids or update the tests deliberately.
- The orchestrator keeps the one `strategyProvider.resolve` and passes an immutable view model down. Modules never call the provider, except the matrix through an injected `resolveCell` with its keyed memo.

**Order, from least to most coupled:**
1. `analyze-decision-panel.mjs`:
   - Verdict, mix, warnings, facts, Explain, Provenance and the gate state.
   - Source ranges: 2876–2960, 3063–3120, 6415–6580, 7157–7300, 7541–7557, `updateContext` 7722–7855, bindings 9106–9140 and 9404.
2. `analyze-matrix.mjs`: 6732–7160 plus `renderChart`.
3. `analyze-range-comparison.mjs`: 10099–10300.
4. `analyze-spot-setup.mjs`:
   - Cards, action, table, accounting, randomize, and the hand-context and saved banners.
   - Last, because it is entangled with Hand mode (`setPlaybookControlAuthority`), the readiness gate, slider pairs, and the three handoffs.
5. `analyze-controller.mjs`: `updateContext`, the scheduler and the surface invalidator. Visibility comes from `setVisible` instead of DOM reads.

**Existing coverage (names only, not audited):**
- `analyze_composition001` and `_amend2`
- `analysis001_app_integration`
- `analyze_range_ux001`
- `analyze_range_authority_closeout`
- `analyze_scenario_readiness001`
- `perf001_product_performance`
- `perf_rl18_hidden_dom`
- `cleanup001f_range_matrix_scope`
- `playbook001_state_source`
- `design006_playbook_workspace`
- `ui_density001`
- `light_wins_batch001_cross_surface_randomization`
- `saved_objects001_performance`
- `range_cal002d`

**Characterization tests needed first (`bootApp()`):**
1. DOM contract per state: empty gate, dominant, close, warning, unavailable, and postflop matrix empty.
2. Update-call counts: one resolve per update, 169 matrix resolves only when the matrix is visible, hidden surfaces dirty then rendered once.
3. Handoffs from Review, Full Hand and Saved: context section, exact facts, Back, Edit as Scenario, saved banner. Include a reproduction for QA-AUDIT-HAND-ANALYZE-STACK-001 (open P1) before touching this code.
4. Tab visibility plus the matrix grid keyboard and inspector.
5. Language refresh (EN, RU, HE) after a tab change.
6. Save spot states: unsaved, checking, saving, saved, failed.
7. Randomization keeps and targets.

## 7. (f) Proposed ticket sequence

| Ticket | Class | Tier | Model / effort |
|---|---|---|---|
| EXTRACT-ANALYZE-000: characterization tests plus the stack-handoff reproduction | Correctness/Architecture | T1 | Sonnet, medium |
| EXTRACT-ANALYZE-001: decision panel | Correctness/Architecture | T1 | Sonnet, medium |
| EXTRACT-ANALYZE-002: matrix and category comparison | Correctness/Architecture | T1 | Sonnet, high |
| EXTRACT-ANALYZE-003: spot setup and handoffs (consider splitting 003a Scenario setup, 003b handoff banners) | Correctness/Architecture | T1 | Sonnet, high |
| EXTRACT-ANALYZE-004: controller and invalidator | Correctness/Architecture | T1 | Sonnet, high |
| ANALYZE-001: redesign to v4, split into ANALYZE-001a (result side) and 001b (spot sentence). It needs an owner-confirmed mockup first. | Product Contract First | T2 | Sonnet, high |
| ANALYZE-YOUHERE-001, ANALYZE-EQUITY-TILE-001, ANALYZE-DRILL-001, ANALYZE-PHONE-001 | Heavy Future Design | T2 | later |

My recommendation is to run 000–002 first. ANALYZE-001a then rebuilds the decision panel and matrix inside the new modules instead of moving old code and restyling it later. 003 and 001b follow.

## 8. Disagreements and doc conflicts

- AGENTS.md says `logic.js` is about 16,200 lines. It is 14,902.
- `docs/project/DESIGN_SYSTEM.md` calls the Analyze composition "uncommitted" and acceptance "pending (ANALYZE-ACCEPT)". The register records it as accepted (D-21) and committed as `4e3e11a`, so the doc is stale.
- The v4 mockup shows a "Verified" pill. The app must not.
- Owner decision needed: should the sentence-spot chips fully replace the Facing, Pot, Stack and Table sliders, or only wrap them? It changes ANALYZE-001b scope and the readiness gate.
- You named the phone prototype only as "the phone prototype". I used the MOB-05 link from `docs/design/CANVASES.md`.

## 9. Git status

The checkout is detached at `ea15545` and clean. Nothing was staged or committed. The temporary extraction script lives only in the session scratchpad.
