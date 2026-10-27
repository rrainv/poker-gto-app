# FULLHAND-QUALITY-001 (B9): Full Hand skip, header state, lineup tiles

Ticket: B9 · Correctness / UI · T1 · branch `argon/m1-batch-3` · done by Claude while Argon is out of quota
Issues: WATCH-REST (skip part), QA-SWEEP-030, QA-SWEEP-010

## 1. Outcome

- **WATCH-REST (Partial: skip done, speed is M2).** While "Watch rest of hand" plays, a quiet **Skip to end** button sits in the live Full Hand controls (beside New Hand / Abort). Pressing it plays every remaining canonical event at once: no bot-thinking, deal or settle pauses and no motion, then the normal end-of-hand summary. Poker truth is unchanged: every event still goes through the controller's `advanceOne()`; only presentation pacing is dropped. The button hides itself and, if it had focus, focus moves to the summary's first action (Review Hand). A skip never carries into a later run.
- **QA-SWEEP-030 (Fixed).** The Training heading follows state and phase instead of staying "Make the decision": *Your hand summary* (Hero folded, opponents paused), *Watching the rest of this hand*, *Hand Complete*, *Post-Hand Review*, *Session complete*, *Learn from this decision* (feedback), otherwise *Make the decision*. All strings already existed in EN/RU/HE.
- **QA-SWEEP-010 (Fixed).** Cause: an opponent tile's text sits inside the seat `<button>`, so the `li > div` grid rule that stacks the Hero tile never applied, and the text column was about 50 px (tile padding plus button padding plus a 64 px portrait). Opponent tiles now stack name / position / behaviour on their own lines, the button carries the tile padding, portraits are 48 px, names break at words (`break-word`, was `anywhere`), and behaviour uses the secondary text colour. The ≤680 px stacked layout also applies to the seat button.

## 2. Key design choices

- Skip lives in the presentation orchestrator (`skip()`): a skip flag for the running epoch plus a releasable pause, so a wait in progress ends at once. The injected `wait` is still called for pauses before the skip, so existing timing tests are unaffected.
- The heading is one function (`trainingWorkspaceTitleKey`) used by both `setTrainingWorkspaceState` and `setFullHandTrainingPhase`, because Review and the summary change only the phase.
- After a Hero fold the summary section's own title is also "Your hand summary", so the page heading and section title match in that state. Accurate, but repetitive; see §6.

## 3. Files

Changed by this ticket: `app/src/application/full-hand-training-presentation-orchestrator.mjs`, `app/src/core/logic.js` (Watch rest / Skip binding, heading helpers, phase hook), `app/index.html` (Skip button), `app/styles.css` (QA-SWEEP-010 block), `app/src/locales/product-translations.js` (`Skip to end` EN/RU/HE), `docs/ISSUE_REGISTER.md` (WATCH-REST, WANT-WATCH-SPEED, QA-SWEEP-030, QA-SWEEP-010), `tests/fullhand_quality001.test.mjs` (new).
Pre-existing untracked: `.claude/`.

## 4. Verification

- `node --test tests/fullhand_quality001.test.mjs`: 5 pass (skip skips waits and motion but applies all events; skip does not leak into the next run; Skip markup and translation; heading per state; tile CSS).
- Existing Training / Full Hand suites (beta_design_refresh001, beta_feature_surface_refresh001, beta_repair_sweep_c, design008_training_workspace, training001_canonical_generator, training_composition001_final_hardening, training_hand_mode001_presentation, training_hand_mode001_ui, workspace_composition002): 83 pass, 0 fail.
- `node --check`, `git diff --check` clean; LF confirmed.
- **Browser (Chromium pane, Midnight, EN; 1920×1080 emulation for the lineup check, later at the pane's width):**
  - Lineup before: tiles read `MikaBTNCalling-heavy` (name, position and behaviour on one run of text, behaviour wrapped as "Calling-/heavy"). After: `Mika | BTN | Calling-heavy` on three lines, every name `scrollWidth == clientWidth` (no clipping).
  - Full Hand: heading "Make the decision" at Hero's turn → Fold + Confirm → "Your hand summary" → Watch rest → "Watching the rest of this hand" with Skip to end visible → real click on Skip → under 1 s later state `terminal`, "Showdown complete. Hero result: +0.0 bb.", heading "Hand Complete", Skip hidden, focus on Review Hand → Review Hand → "Post-Hand Review". No console errors other than three 404s for static resources (not from this change; not investigated).
  - Screenshots were taken in the pane (before: zoomed lineup strip; after: lineup, watching state with Skip, Review); they are session captures, not saved to the repo.
- Not checked: HE layout of the tiles and the Skip button, 1366×768, Firefox.

## 5. Limitations and debt

- Speed control (WATCH-REST M2) not done, as the ticket says.
- Skip only appears during Watch rest; normal bot turns before a Hero decision still use full pacing (not asked for).
- HE/RTL and 1366 visual status for this ticket: UNVERIFIED.

## 6. Disagreements or doc conflicts

- After a Hero fold the page heading ("Your hand summary") repeats the completion section's title. The ticket asked for the heading to follow state; the owner may prefer a different heading or dropping the section title in that state.

## 7. Git status

Committed as one commit on `argon/m1-batch-3` with the exact file list above (this ticket's hunks only); `.claude/` not staged.
