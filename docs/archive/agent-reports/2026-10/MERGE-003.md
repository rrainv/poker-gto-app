# MERGE-003 report: batch 3 (B7–B10) merge and Hero-fold summary title fix

Ticket: MERGE-003 · Mechanical + small fix · T1 + full suite once · branch `codex/stabilization` (base `096a4ab`)

## 1. Outcome

- `origin/argon/m1-batch-3` (B7 LOCALE-NUMBERS-001, B8 A11Y-KEYS-001, B9 FULLHAND-QUALITY-001, B10 SAVED-KEY-FLAKE-001) is merged into `codex/stabilization` as `b3ef6d4` (`--no-ff`).
- After a Hero fold the Full Hand heading says "Your hand summary" and the summary section no longer repeats it. The section title stays in the DOM only as the section's accessible name (`sr-only`), so screen readers still hear it; the quiet "Full Hand" eyebrow is the visible label. At the real end of the hand the section title is visible again. No new strings, so EN/RU/HE all follow.
- One test that the merge broke intermittently is fixed (see §2).

## 2. Root causes / key design choices

- **Conflict:** one, in `docs/ISSUE_REGISTER.md` (Settings / Guide / i18n table). Kept codex/stabilization's structure and the batch's status changes. For `QA-LANGUAGE-SWITCH-003` both sides were kept: the owner decision ("the code owns the text", 2026-10-27) plus the batch's progress (Partial, 11 keys removed). The batch's new rows (A11Y-MATRIX-KEYS, LOCALE-NUMBERS-002) and the QA-SWEEP-016/022 status changes were kept. `docs/STATE.md` was not touched by the batch.
- **Fix choice:** hide the section title visually instead of deleting it, because `#trainingFullHandCompletion` is `aria-labelledby` that title and is `aria-live`.
- **Merge-caused test failure:** `design007_equity_workspace` › "results prioritize equity…" compared tile values against `toFixed(1)`. B7 now formats with `Intl.NumberFormat`, which rounds borderline values differently (`(81.85).toFixed(1)` = `81.8`, Intl = `81.9`). The Equity seed is random, so it fails only when a value lands on such an edge (the batch's 3 clean runs missed it; my full run hit it: `81.9%` vs `81.8%`). The test now compares against the app's own `formatUiPercent`. It joined this ticket because the merge caused it and it blocked acceptance.

## 3. Files

Changed by this ticket (fix commit):
- `app/src/core/logic.js` (`renderFullHandTerminal`: toggle `sr-only` on the section title after a Hero fold)
- `tests/fullhand_quality001.test.mjs` (new test for the fix)
- `tests/design007_equity_workspace.test.mjs` (compare with the app formatter)
- `docs/ISSUE_REGISTER.md` (new rows FULLHAND-SUMMARY-TITLE, FULLHAND-DOUBLE-SIGNAL-002, LOCALE-NUMBERS-003)
- `docs/archive/agent-reports/2026-10/MERGE-003.md` (this report)

Merge commit `b3ef6d4`: the batch's 37 files plus the conflict resolution in `docs/ISSUE_REGISTER.md`.

Pre-existing dirty files, not touched or staged: `.codex/config.toml` (M), `.claude/` (untracked).

## 4. Verification

- `node --check` on `logic.js`, `locale-number-format.mjs`, `locale-number-format-bootstrap.mjs`, `full-hand-training-presentation-orchestrator.mjs`: OK.
- `git diff --check`: clean. `git ls-files --eol`: LF.
- Focused: `node --test tests/fullhand_quality001.test.mjs tests/a11y_keys001.test.mjs tests/locale_numbers001.test.mjs tests/saved*.test.*`: 110/110 pass (before the new test); `fullhand_quality001` after the new test: 6/6.
- Full suite once, `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs` (after the fix, before the Equity test change): **2803 tests, 2800 pass, 1 fail, 2 todo** (TEST-HYGIENE-001-F01/F07). The failure was the Equity rounding test above. After the change, `design007_equity_workspace.test.mjs` alone 3 runs: 17/17 each. The full suite was not rerun (test-only change).
- Browser (built-in browser, dev server `127.0.0.1:3000`, Midnight):
  - **1920 EN:** card picker: Right from A♥ → K♥, Down → K♠, no page scroll, Enter selects, End → 2♠, Escape closes and returns focus to "Edit Hero hand". Matrix (Analyze Range Matrix): 169 cells, one Tab stop, Right/Right/Down → KQs, Ctrl+End → 22, focus ring visible. Lineup tiles: 7 tiles, no clipped text. Full Hand: Fold → heading "Your hand summary", section title `sr-only`, eyebrow "Full Hand" visible (screenshot checked) → Watch rest → heading "Watching the rest of this hand", Skip visible → Skip → `terminal`, "Showdown complete. Hero result: +0.0 bb.", heading "Hand Complete", Skip hidden, focus on Review Hand → Enter → "Post-Hand Review". No console errors.
  - **1920 HE (RTL):** card picker is one Tab stop; from A♥ (right edge) ArrowLeft → K♥ (visually left), ArrowRight → back to A♥. Matrix grid `direction: ltr`, AA left of AKs (not mirrored), arrows work. Numbers go through `Intl` `he`. Full Hand fold in HE: heading «סיכום היד שלכם», section title `sr-only`, eyebrow «יד מלאה» (screenshot checked).
  - **1366×768 EN:** Analyze and Training at 1366: no horizontal overflow. The pane's emulation dropped during screenshots, so the 1366 look is **PARTIAL** (JS layout check plus one screenshot).
  - Visual acceptance remains the owner's.

## 5. Limitations and debt

- **FULLHAND-DOUBLE-SIGNAL-002 (new, Open):** after a Hero fold the state badge also reads "Your hand summary" and a "Hand Complete" chip shows although the hand is not complete; at the real end the heading and section title both read "Hand Complete". Outside the ticket's named fix; needs an owner call.
- **LOCALE-NUMBERS-003 (new, Open):** native number inputs render in the browser's locale (RU browser shows `1,5` in the EN app).
- Seen in passing, not registered as new (likely covered by OWNER-I18N / QA-LANGUAGE-SWITCH-003): HE tutorial banner keeps "Training" in Latin; HE Analyze "Expand Table" stays English.

## 6. Disagreements or doc conflicts

- The batch's register rows say "on `argon/m1-batch-3`"; after this merge they are on `codex/stabilization`. Left as written (Manager's call on wording).

## 7. Git status

See the session report: merge `b3ef6d4` and the fix commit pushed to `origin/codex/stabilization`; `.codex/config.toml` and `.claude/` not staged.
