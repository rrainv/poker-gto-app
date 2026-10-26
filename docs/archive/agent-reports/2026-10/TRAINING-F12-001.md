# TRAINING-F12-001 report

Agent: Claude Code (Opus 5.5). Base: `codex/stabilization` @ `0105083`. Tier T1. Nothing staged or committed.

## Outcome

- **F12 (P1):** a new Training session started after a completed bounded Varied session can be answered again, whichever way it is started: Varied (Start Training or Start another session), Focused, Full Hand, Same Spot, Similar Spot and Revisit.
- **F13 (P2):** after a Full Hand, Adjust drill moves focus to the first control the drill setup still shows (the "Varied Session" mode button) instead of the hidden Hero position field; focus no longer falls to `<body>`.

## Root causes and design choices

- Only `completeVariedTrainingSession()` sets `data-training-session-complete`. Varied start never cleared it. Same Spot and Revisit had the same defect, which the ticket did not name: a completed Varied session is not "active", so `openTrainingMemorySameSpot` could open over it without clearing.
- Fix at the shared start path: `startConfiguredTrainingSession` now calls `clearTrainingSessionCompletion()` once for every non-Full Hand start. The Focused-only call was removed as redundant. Full Hand keeps its own clear in `startFullHandTraining`, because it must first fold a `hero_complete` snapshot into Training Memory and clearing earlier would drop that snapshot. `openTrainingMemorySameSpot` (Same Spot and Revisit) clears after its async guards pass, just before `beginSameSpot`. Similar Spot already cleared through `clearTrainingSessionState()`.
- F13: `setTrainingSetupExpanded(…, { focus: true })` tries the mode's field first, then the first enabled, rendered `button/select/input` in `.training-setup-fields`. It reuses the existing `getClientRects().length` idiom from `logic.js`.

## Files

Changed by this ticket:
- `app/src/core/logic.js` (shared start path, Same Spot start, setup focus)
- `tests/training_f12_session_restart.test.mjs` (new: one behavioural test per start path)
- `tests/training_varied_session001.test.mjs` (F12 `todo` removed; now passes)
- `tests/training_composition001.test.mjs` (F13 `todo` replaced: asserts focus on the first shown setup control)
- `docs/ISSUE_REGISTER.md` (F12, F13 rows)
- `docs/STATE.md` (Phase 0 row for this ticket)
- `docs/archive/agent-reports/2026-10/TRAINING-F12-001.md` (this report)

Pre-existing dirty files, untouched: `.codex/config.toml` (modified), `.claude/`, `docs/_incoming/` (untracked).

## Verification

- `node --test tests/training_f12_session_restart.test.mjs`: 7/7 pass. Against HEAD `logic.js` (temporarily restored, then put back) 4 fail (Varied, Start another session, Same Spot, Revisit) and 3 pass (Focused, Full Hand, Similar Spot), as the root cause predicts.
- `node --test tests/training_varied_session001.test.mjs tests/training_composition001.test.mjs tests/training_f12_session_restart.test.mjs tests/same_spot_coherence001.test.mjs`: 37/37 pass, 0 todo.
- `node --test --test-concurrency=4 tests/full_hand_*.test.mjs tests/saved_training_history001.test.mjs tests/training001_app_integration.test.mjs tests/training_composition001_*.test.mjs tests/training_hand_mode001_*.test.mjs tests/training_intelligence001.test.mjs tests/training_memory001_foundation.test.mjs`: 132/132 pass.
- `node --check` on `logic.js` and the three test files: OK. `git diff --check`: clean. `git ls-files --eol`: LF.
- Full suite not run (T1, no shared module changed).
- Browser: **built-in browser pane (Chromium), not Firefox**, 1920×1080, EN, LTR, Midnight, dev server `tools/dev-web-server.mjs`:
  - Completed a 10-exercise Varied session (`data-training-session-complete="true"`, "Exercise 10 of 10", completion card shown). Started another Varied session with Start Training: attribute gone, `#trainingGuessButtons` `display: grid`, Fold/Call/Raise/All-in shown, "Exercise 1 of 10". A real click on Fold reached the `feedback` state with an evaluation.
  - Played a Full Hand to `complete`, then a real click on Adjust drill: setup open, `#trainingHeroPos` not rendered, `document.activeElement` = "Varied Session" mode button inside the setup panel.
  - **Firefox: UNVERIFIED.** Firefox is installed but there is no geckodriver or Playwright here to drive it. One manual pass in Firefox is still owed.

## Limitations and debt

- Firefox check outstanding (above).
- With a mouse click, `:focus-visible` was false on the focused mode button in Chromium, so a mouse user sees no focus ring after Adjust drill. Keyboard activation should show one; not separately checked.
- Screenshots from the pane were unreliable (the pane was hidden or scaled). Evidence is DOM state read after real clicks.
- No new register rows: the Same Spot and Revisit extent is recorded in the F12 row.

## Disagreements or doc conflicts

- F13 target: the ticket says "first visible control", which is the "Varied Session" mode button, not the active mode. The owner may prefer the pressed "Full Hand" button or the Full Hand "New Hand" control. It is a one-line change in `setTrainingSetupExpanded` if so.
- The ticket asks for a Firefox check; this environment cannot drive Firefox (see above).

## Acceptance and amendment (2026-10-26)

- The owner accepted the ticket. The acceptance message left the Firefox result as an unfilled placeholder, so no Firefox outcome is recorded here.
- Amendment: when the mode's own field is hidden, Adjust drill now focuses the pressed mode button (after a Full Hand: "Full Hand"), then falls back to the first shown setup control. When the field is shown, it still comes first (Focused → Street, Varied → Session length), as the existing `training_composition001` test "setup is a single disclosure… Adjust Drill reopens" requires.
- Re-run: `node --check` on `logic.js` and the three test files OK. `node --test tests/training_f12_session_restart.test.mjs tests/training_varied_session001.test.mjs tests/training_composition001.test.mjs` passes 23/23 with 0 todo. `git diff --check` is clean. The browser was not re-checked after the amendment; the harness test covers the new target.
- Committed and pushed to `codex/stabilization` with the owner's authorization. Only the seven ticket files were staged.

## Git status (before acceptance)

`git status --short`: ` M .codex/config.toml` (pre-existing), ` M app/src/core/logic.js`, ` M docs/ISSUE_REGISTER.md`, ` M docs/STATE.md`, ` M tests/training_composition001.test.mjs`, ` M tests/training_varied_session001.test.mjs`, `?? .claude/`, `?? docs/_incoming/`, `?? docs/archive/agent-reports/2026-10/TRAINING-F12-001.md`, `?? tests/training_f12_session_restart.test.mjs`. Nothing staged or committed.
