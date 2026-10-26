# Agent Report — TRUTH-SURFACES-002

- **Ticket**: `TRUTH-SURFACES-002` (Batch item B4)
- **Register IDs**: `QA-SHELL-004`, `OWNER-19`, `REVIEW-MATH-03`
- **Branch**: `argon/m1-batch-2` (created from `origin/codex/stabilization` @ `0105083`)
- **Date**: 2026-10-26
- **Outcome**: Done

## Branch Setup & Re-Application (`MERGE-001` Follow-Up)

1. Saved the uncommitted B4 working tree diff to an external patch file (`b4.patch` outside the repository).
2. Ran `git fetch origin` and created branch `argon/m1-batch-2` from `origin/codex/stabilization` (`0105083`, `MERGE-001: B0-B3 from argon/m1-batch-1 with F04 and harness fixes`).
3. Re-applied `b4.patch` onto `argon/m1-batch-2` via `git apply --index`: **0 conflicts**.
4. Verified both `MERGE-001` follow-ups remain untouched:
   - `app/styles.css` retains `[data-hand-stage]:not([data-hand-stage="private-cards"]):not([data-hand-stage="reveal"])` in the `<=1100px` live-stage rule.
   - `tests/helpers/browser-app.mjs` retains its runtime skipped-script `onerror` failure handler.

## Summary of Changes

1. **Single Provenance Indicator per Surface (`QA-SHELL-004`, `OWNER-19`)**:
   - **Header (`app/src/application/workspace-header.mjs`)**: `shouldShowSourceBadge()` now returns `false` across `analyze`, `hand`, `training`, and `personal-strategy` (as well as non-strategy views), keeping `#strategySourceStatus` hidden so each strategy surface owns its single provenance eyebrow in-context.
   - **Training feedback (`app/index.html`, `app/src/core/logic.js`, `app/styles.css`)**: Added `#trainingFeedbackProvenance` (`#trainingTruthHeading` + `#trainingTier` + `#trainingFeedbackStreet`) directly above `#trainingFeedbackVerdictTitle` in `.training-verdict`. Hidden the duplicate `#trainingStrategySource` side-panel line, `#trainingReferenceSummary`, and `#trainingGradeBadge` so provenance appears once (`Heuristic baseline · Estimated · <Street>` for heuristic fallback, or `<Provider> · <Street>` for exact/reference sources).
   - **Hand Review & Full Hand Review (`app/index.html`, `app/src/core/logic.js`, `app/styles.css`)**: Added `#handReviewProvenance` (`#handReviewTruthHeading` + `#handReviewTier` + `#handReviewDecisionStreet`) in `.hand-review-decision-header`, and hidden the redundant `#handReviewSourceBadge` pill and `#handReviewOverviewSource` overview row.
   - **Personal Strategy source comparison (`app/index.html`, `app/src/application/personal-strategy-understanding-workspace.mjs`, `app/styles.css`)**: Added `#personalComparisonProvenance` above the comparison summary inside `.personal-comparison`, populated only when comparison mode is active (`Heuristic baseline · Estimated · Preflop` or `Selected reference · Preflop`) and hidden on reset/close.

2. **Estimated Mix Rounding to 5% & Trace Action Filtering (`REVIEW-MATH-03`, `NORTH_STAR §7.3`)**:
   - **Analyze verdict & mix bar (`app/src/application/analyze-verdict.mjs`, `app/src/core/logic.js`)**: Added `presentStrategyMixActions(strategyResult)` with `ESTIMATED_MIX_STEP_PERCENT = 5`. When `strategyResult.source.exactFrequencies !== true`, actions are rounded to 5% steps (largest-remainder allocation across 20 steps so visible shares sum to 100%) and actions rounding below 5% are excluded from the displayed mix. Exact sources (`exactFrequencies === true`) remain unrounded. Updated `renderAnalyzeVerdict` in `app/src/core/logic.js` to match mix-bar `shares` by action `name`/`type` rather than raw array index so filtered `< 5%` actions never shift action labels. Underlying `StrategyResult.actions` and `normalizedMix` are never mutated.
   - **Training feedback (`app/src/core/logic.js`)**: Updated `strategyResultPresentationActions(strategyResult)` so non-exact results use 5%-step largest-remainder rounding and filter out actions `< 5%`, while exact results preserve 1% largest-remainder allocation.
   - **Hand Review frequency comparison (`app/src/core/logic.js`)**: Updated `renderHandReviewFrequencyComparison(decision)` so estimated decisions (`decision.source?.exactFrequencies !== true`) round mix percentages to 5% steps and hide actions `< 5%` without mutating `decision.allActions`.

3. **Verdict Dominance Rule (`NORTH_STAR §7.3`)**:
   - Confirmed and hardened `classifyVerdictDominance(actions)` in `app/src/application/analyze-verdict.mjs` to strictly return `'dominant'` (when the top action leads the second action by `>= 20` percentage points or no second action reaches `5%`) or `'close'` (using integer basis-point comparison `Math.round(next.probability * 10000) >= Math.round(VERDICT_MEANINGFUL_SHARE * 10000)` to avoid floating-point boundary drift at `0.05` / `0.20`), and verified every verdict display across Analyze, Training, and Review follows this two-state rule.

## Files Changed

- `app/index.html`
- `app/styles.css`
- `app/src/application/workspace-header.mjs`
- `app/src/application/analyze-verdict.mjs`
- `app/src/application/personal-strategy-understanding-workspace.mjs`
- `app/src/core/logic.js`
- `tests/shell001_workspace_header.test.mjs`
- `tests/truth_surfaces002.test.mjs` (new)
- `docs/ISSUE_REGISTER.md`
- `docs/STATE.md`
- `docs/archive/agent-reports/2026-10/TRUTH-SURFACES-002.md` (new)

## Verification & Tests Run

- Syntax checks (`node --check`):
  - `node --check app/src/application/workspace-header.mjs` — PASS
  - `node --check app/src/application/analyze-verdict.mjs` — PASS
  - `node --check app/src/application/personal-strategy-understanding-workspace.mjs` — PASS
  - `node --check app/src/core/logic.js` — PASS
  - `node --check tests/truth_surfaces002.test.mjs` — PASS
  - `node --check tests/shell001_workspace_header.test.mjs` — PASS
- Focused test suite:
  - `node --test tests/truth_surfaces002.test.mjs tests/shell001_workspace_header.test.mjs tests/truth_fixes001.test.mjs tests/analyze_composition001.test.mjs tests/training_composition001.test.mjs tests/hand_review_decision_rail.test.mjs tests/personal_strategy_understanding_workspace.test.mjs tests/personal_strategy_intelligence_localization.test.mjs tests/strategy_integrity001b_analytical_truthfulness.test.mjs` — **156 pass, 0 fail, 1 todo** (`TEST-HYGIENE-001-F13` pre-existing todo).
- Whitespace / line-ending check:
  - `git diff --check` — PASS (0 warnings/errors).

## Decisions Made

- Kept legacy DOM nodes (`#trainingStrategySource`, `#trainingReferenceSummary`, `#trainingGradeBadge`, `#handReviewSourceBadge`, `#handReviewOverviewSource`) in the DOM with `hidden` attributes so existing code/tests that query their `textContent` do not throw null-reference errors while ensuring only one provenance indicator is visible per surface.
- Kept `strategyResultPresentationActions` in `app/src/core/logic.js` self-contained (no external helper call outside its function slice) because `tests/strategy_integrity001b_analytical_truthfulness.test.mjs` extracts that function by source slicing into a standalone VM context.
- Used existing i18n keys (`Heuristic baseline`, `Estimated`, `Selected reference`, `Preflop`) for `#personalComparisonProvenance` so `tests/personal_strategy_intelligence_localization.test.mjs` passes across EN, RU, and HE without requiring new catalog keys.

## Left Undone / Risks

- None for B4 scope. Prose sentences inside explanations that mention "heuristic baseline" or "approximate" remain descriptive text rather than duplicate provenance badges, matching Analyze (`TRUTH-FIXES-001`).
