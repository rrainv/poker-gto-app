# MERGE-002: Argon batch 2 + skills, with review fixes

Execution class: Correctness · Tier: T1 + full suite once · Agent: Claude Code (Opus 5.5)

## Outcome

- `codex/stabilization` now contains SKILLS-001 (`merge: SKILLS-001 agent skills`, `--no-ff`) and Argon batch 2 (B4–B6, `--no-ff`), plus the REVIEW-BATCH2 fixes below.
- **Explain (B4)** reads the same two-state verdict as Analyze (`describeAnalyzeVerdict`: dominant when the top action leads by ≥ 20 points or no other action reaches 5%, else "A or B · close") and the same display shares (`presentStrategyMixActions`: estimated sources in 5% steps, actions under 5% hidden at every depth; exact sources in whole percentages). The private 95/70/10 four-state `strategyShape` and its `pure`/`mixed`/`fragmented` copy are gone; EN/RU/HE copy is now `dominant`, `dominant.withSecondary` and `close`. Explain with 62/30/8 reads "This is mostly Call (60%), with Raise at 30%." and the summary says 60%.
- **Data safety (B6)**: Delete all data signs out first (best effort, this device only, bounded wait), wipes, shows the status briefly, then reloads into first run. The window bridge no longer exposes an unconfirmed delete. The iOS 7-day note shows only in iPhone/iPad browser tabs. A blocked deletion waits; if still blocked it says "Close other Riverline tabs to finish deleting" (EN/RU/HE) and finishes (success status + reload) once those tabs close.

## Conflicts

- `docs/STATE.md`: resolved to `codex/stabilization`'s version. The batch's three rows (TRUTH-SURFACES-002, DOMAIN-MATH-001, DATA-SAFETY-001) were the batch's own edits, not Manager rows, so none were re-added.
- Skills keyboard contract: the riverline-design skill already says F, C, B/R, A, digits, Enter per DESIGN_SYSTEM; no change needed.

## Key design choices

- Explain passes its sorted, claim-filtered actions to the shared verdict and presenter rather than keeping thresholds; `ANALYSIS_THRESHOLDS` now re-exports the verdict constants (`closeMargin`, `meaningfulShare`). `actionAnalysis[].strategyShape` became `verdictKind`; entries gain `displayPercent`. StrategyResult probabilities are not changed.
- `teacher.js` no longer recomputes raw percentages for the summary or the dominant-with-secondary sentence; it renders the service's values.
- Local sign-out: `RiverlineAuthentication.signOut({ scope: 'local' })` is passed through the service to the Supabase provider, which then skips the global (all-devices) revoke. Other sign-out paths are unchanged.
- Added one string beyond the ticket: "Some local data could not be deleted. Try again." for a deletion `error`, so a failure is never reported as success.

## Files (this ticket, beyond the two merge commits)

- `app/src/application/analysis-explanation.mjs`
- `app/src/ui/teacher.js`
- `app/src/locales/analysis-translations.js`
- `app/src/application/analyze-verdict.mjs` (window install removed)
- `app/src/application/analyze-verdict-bridge.mjs` (new)
- `app/index.html` (loads the bridge module)
- `tests/analyze_composition001.test.mjs` (script-order check follows the bridge)
- `app/src/application/data-safety.mjs`
- `app/src/application/authentication-service.mjs`
- `app/src/application/authentication-bootstrap.mjs`
- `app/src/authentication/supabase-auth-provider.mjs`
- `app/src/locales/account-translations.js`
- `app/src/locales/product-translations.js`
- `tests/analysis001_explanation_service.test.mjs`
- `tests/data_safety001.test.mjs`
- `docs/ISSUE_REGISTER.md`
- `docs/archive/agent-reports/2026-10/BATCH-SUMMARY.md`
- `docs/archive/agent-reports/2026-10/TRUTH-SURFACES-002.md`
- `docs/archive/agent-reports/2026-10/MERGE-002.md`

Pre-existing dirty, not touched or staged: `.codex/config.toml`, `.claude/`, `docs/_incoming/`.

## Verification

- `node --check` on all changed `.js`/`.mjs`: pass. `git diff --check`: clean.
- Focused: `node --test` on `analysis001_explanation_service`, `analysis001_app_integration`, `truth_surfaces002`, `analyze_composition001`, `data_safety001`, `domain_math001`, `account002a_authentication`, `auth_supabase_singleton001`, `i18n001_runtime_integrity`: 110 pass, 0 fail.
- New behavioural tests: 62/30/8 → dominant, 60/30/10 at concise and detailed depth; 52/44/4 → close, Fold hidden at detailed depth; exact source keeps 62/35/3; delete-all signs out locally before wiping, shows status, reloads after the delay, and the prepaint script then reads first run (`unseen`); bridge has no unconfirmed delete; blocked deletion shows the close-tabs message, no reload, then success + reload when the requests finish.
- Full suite (`node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`): first run 2780 pass, 1 fail, 2 todo. The failure was caused by this ticket: `test_hygiene001_harness` "booted-app tests do not import self-installing app modules before bootApp()". Explain now imports `analyze-verdict.mjs`, which installed `window.RiverlineAnalyzeVerdict` at import time, so five tests that import Explain before `bootApp()` would leave the booted app without the bridge. Fix: the window install moved to a new `app/src/application/analyze-verdict-bridge.mjs`, which `index.html` now loads in place of `analyze-verdict.mjs`; the verdict module is side-effect free. Rerun: **2783 tests, 2781 pass, 0 fail, 2 todo** (both known TODOs, e.g. TEST-HYGIENE-001-F01). The focused set plus the five affected files: 122 pass. The bridge was rechecked in the browser (bridge present, loaded from the new file, dominant and close verdicts render).
- Browser (built-in pane, 1920×1080, EN, Midnight, dev server on port 3001 because 3000 was taken):
  - Analyze dominant spot (UTG AKo unopened): verdict `dominant`, "Open", mix 100%; Explain summary "Open leads at 100%." ✔
  - Analyze close spot (SB Q8o unopened, via New random spot): verdict "Open or Limp", "Close mix · Open 45% · Limp 35%", mix 45/35/20; Explain summary "Open leads at 45%." ✔ (Explain does not render a separate Strategy Mix section in the UI; the mix sentence is covered by the service tests.)
  - Settings › Account & Data: "Temporary browser storage" with detail; iOS note hidden on desktop ✔. Delete flow: typed DELETE in the field, confirmed; the status "All local data has been deleted from this browser." appeared, then the page reloaded (`navigation.type = reload`) into the welcome orientation with preferences cleared ✔. No console errors.
  - Not checked in the browser: the blocked-deletion message (needs a second tab holding a connection; covered by tests), HE/RU layout (strings only).

## Limitations and debt

- `MIX-ROUNDING-OWNER` (new, P3): three copies of the 5% rounding (`analyze-verdict.mjs`, `strategyResultPresentationActions` and a fallback in `renderAnalyzeVerdict`, both in `logic.js`).
- `DOMAIN-MATH-FOLLOWUPS` (new, P3): optional B5 follow-ups (inline SPR in `analysis-explanation.mjs`, MDF unit normalization, duplicate selector names).
- REVIEW-MATH-03 and DATA-SAFETY-M1: Fixed, pending owner acceptance.

## Disagreements or doc conflicts

- BATCH-SUMMARY.md stated the verdict rule as "≥ 70% or ≥ 15 pp"; TRUTH-SURFACES-002.md named a nonexistent `classifyVerdictDominance` and claimed every verdict surface followed the rule. Both corrected in place with a note.
- The ticket's "(local)" sign-out needed a small option in the auth service/provider (identity area); flagged for the Manager since identity is a review-tier area.
