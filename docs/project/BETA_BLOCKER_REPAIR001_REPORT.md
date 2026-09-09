# BETA-BLOCKER-REPAIR-001 verification report

Dated execution evidence: September 8, 2026. **COMPLETE for the bounded repair.** This is not a Beta readiness or accepted checkpoint claim.
QA_BACKLOG.md and owning specifications remain the live authorities.

## Scope and outcomes

AUD-01 now uses the product owner's approved correctness-first compatibility
policy. Canonical pot layers separate actual ante funding from matched wagers;
refunds use net wager excess. HU AA/KK is 3bb after calling, a 0.5bb call with 1/6
raw Equity threshold, no ante refund, and terminal SB102 / BB98. Individual short
antes retain capped ante eligibility; BBA is shared dead money. Tied layers permit
zero-chip tied winners, and fully refundable nominal calls have zero net risk.

`saved-accounting-compatibility/v1` reconstructs preserved Replay with the sole
current engine. It compares actual action records/amounts and source facts before
returning corrected Hand projections. Source recorded pot/rake/net awards must
reconcile unchanged. Reads do not overwrite storage, revisions or timestamps;
regular successful writes may persist normalized values. Missing or contradictory
authority returns a typed compatibility error and leaves raw evidence intact.

PokerState and Replay v1/v2/v3, Saved Hand v1/v2/v3, outer Saved object/export,
database and sync versions remain unchanged. Ante-bearing derived pot layers use
v2; current exact ante Spots use `saved-spot-snapshot/v3` and the
`ante-dead-money/v1` accounting marker. Legacy exact Spots require same-owner Hand
lineage and one exact Replay decision point; Scenario intent remains lossy.

Training Memory's frozen answer context, strategy truth, user response and metadata
are not rewritten independently. Affected product reads and redrills compare
canonical economics, returning unavailable on mismatch or insufficient source.
Generated ante snapshots with refunds have insufficient Replay authority and fail
closed. Personal Strategy Hand Study already rejects ante inputs; other exact-node
fingerprint/Replays remain strict, so no unrelated Personal evidence migration.

Genuine pre-fix fixtures were captured before canonical edits, with original
SB101/BB99/25% values, source events, annotations and no-ante/import controls.
Idempotence, owner mismatch, corrupted actual amounts, missing lineage, independent
Spot-before-Hand sync arrival and old outbox normalization have focused coverage.

AUD-02 retains CALL when the source marks all-in stack exhaustion. Exact amount,
raise-to and terminal-stack checks remain strict. Synthetic tests independently
assert ordinary/exact/short call money outcomes, all-in bet/raise, check, replay
equality and malformed-evidence rejection.

AUD-03 uses the existing Review teardown for Analyze, direct mode changes,
workspace exit and invalid models, restoring History and clearing presentation
without changing canonical Hand state. Direct incomplete-Hand Review is not a
current product flow; the live-retention test opens an imported completed Hand
over a live Hand and returns through Analyze.

AUD-04 gives the rail normal grid ownership with size containment, adaptive
stage facts and laptop column reservations. The verified table widths are 592px
at 1366x768 and 946px at 1920x1080. No core horizontal scrolling or stage/rail
overlap; page and rail vertical scrolling remain available. Count-specific seat
geometry and the current visual direction remain unchanged.

AUD-05 retains 25-upload / five-100-row pull budgets and continues after each
bounded run clears. Manual force carries across successful runs; retries use
backoff; owner/generation/consent fences remain. Non-advancing hasMore cursors
fail visibly. A deferred-status test protects a late local edit whose scheduled
callback joins the active run. No real cloud/account interaction occurred.

## Seven old baseline classifications

All seven are B: stale implementation-shape or presentation expectations,
reconciled against the accepted direction and mounted presentation.

| Test | Obsolete expectation | Retained/replacement protection |
|---|---|---|
| design005_poker_visual_system | inline fallback anchors | shared table-environment anchor authority |
| design007_equity_workspace | blanket range prohibition | accepted Advanced Equity mount and poker-math isolation |
| range_teacher001_personal_strategy | redundant Understanding grid selector | existing inherited base-grid assertion |
| replay001c_integration | inline fallback anchors | shared anchors, centered cards, radial lanes |
| replay_rail_nav001_hardening #1 | universal width/gap | distinct panels for 2–10 players and Hero below felt center |
| replay_rail_nav001_hardening #2 | identical HU attachment gaps | opposing HU axis, shared ownership lanes, count-specific size |
| ui_polish003_responsive_action_path_daylight | dotted betting oval present | debug oval absent; physical table/card/chip hooks retained |

## Prior AUD-02/03/04/05 verification evidence

Focused passes: 51 import/existing-sync tests; 24 executing-scheduler boundaries;
67 reconciled baseline tests; 56 Review/Hand/PERF tests; 7 subsequent focused sync
checks including the late-edit race. Counts overlap and are not unique totals.
Twelve ticket JS/MJS files passed syntax checking; diff hygiene passed.

Mounted Firefox used existing Puppeteer infrastructure, true app HTML/modules,
a loopback server and temporary profile. Daylight, 100%, 1366x768 and 1920x1080:
2/6/10-max preflop and five-card river; completed Review and imported-over-live
Review through Analyze, directly and via Training. Canonical state equality,
History restoration, visibility and overlap checks passed; no page errors.
Screenshots were inspected. The optional tutorial was skipped with its visible
control. Primary human/subjective Firefox acceptance remains later; this is not
closure of unrelated table physicality, art, theme or cloud QA.

Initial restricted Firefox launch failed before mounting; the authorized local
headless run outside the process sandbox succeeded. Reusable harness:
`tests/tooling/verify_beta_blocker001_firefox.mjs`.

Final gates and exact file/hash inventory follow below.

## Exact ticket file manifest (45 files)

- `app/src/application/hand-history-import.mjs`
- `app/src/application/saved-study-object-bootstrap.mjs`
- `app/src/application/saved-study-object-service.mjs`
- `app/src/application/training-memory-service.mjs`
- `app/src/core/logic.js`
- `app/src/saved-study-objects/accounting-compatibility.mjs`
- `app/src/saved-study-objects/domain.mjs`
- `app/src/saved-study-objects/repository.mjs`
- `app/src/sync/coordinator.mjs`
- `app/src/sync/domain.mjs`
- `app/src/sync/saved-study-domain-adapter.mjs`
- `app/styles.css`
- `docs/project/BETA_BLOCKER_REPAIR001_REPORT.md`
- `docs/project/DECISION_CONTEXT_SPEC.md`
- `docs/project/GAME_RULES_V1_SPEC.md`
- `docs/project/HAND_HISTORY_IMPORT_V1_SPEC.md`
- `docs/project/PRODUCT_SPEC.md`
- `docs/project/QA_BACKLOG.md`
- `docs/project/SAVED_OBJECT_SYNC_SPEC.md`
- `docs/project/SAVED_STUDY_OBJECTS_SPEC.md`
- `docs/project/TRAINING_MEMORY_V1_SPEC.md`
- `shared/poker-domain/actor-call-economics.js`
- `shared/poker-domain/pot-layers.js`
- `shared/poker-domain/recorded-settlement.js`
- `shared/poker-domain/schema.js`
- `shared/poker-domain/settlement.js`
- `shared/poker-domain/validate.js`
- `tests/beta_blocker_accounting.test.mjs`
- `tests/beta_blocker_import.test.mjs`
- `tests/beta_blocker_sync.test.mjs`
- `tests/design005_poker_visual_system.test.mjs`
- `tests/design007_equity_workspace.test.mjs`
- `tests/fixtures/accounting-compatibility/README.md`
- `tests/fixtures/accounting-compatibility/pre-fix.json`
- `tests/fixtures/hand-history/AllInCall.txt`
- `tests/fixtures/hand-history/README.md`
- `tests/game_rules001b_state_adoption.test.mjs`
- `tests/range_cal002b_validation.test.mjs`
- `tests/range_teacher001_personal_strategy.test.mjs`
- `tests/replay001c_integration.test.mjs`
- `tests/replay_rail_nav001_hardening.test.mjs`
- `tests/tooling/range_cal002b_evaluation.mjs`
- `tests/tooling/verify_beta_blocker001_firefox.mjs`
- `tests/training_memory001_foundation.test.mjs`
- `tests/ui_polish003_responsive_action_path_daylight.test.mjs`

## Pre-existing tree preservation

The initial SHA-256 inventory is `%TEMP%/riverline-beta-blocker-baseline.json`.
Four already-dirty files were edited for this ticket: app/src/core/logic.js,
app/styles.css, docs/project/PRODUCT_SPEC.md and docs/project/QA_BACKLOG.md.
Their pre-existing refresh hunks remain. The following 53 files are unchanged
byte-for-byte from the initial inventory:

- `.codex/config.toml`
- `Riverline Repository Deep Audit Handoff.docx`
- `app/index.html`
- `app/src/application/advanced-equity-language.mjs`
- `app/src/application/advanced-equity-workspace.mjs`
- `app/src/application/exploit-teacher-workspace.mjs`
- `app/src/application/opponent-practice-workspace.mjs`
- `app/src/application/personal-strategy-hand-workspace.mjs`
- `app/src/application/personal-strategy-understanding-workspace.mjs`
- `app/src/application/playbook-mode-bootstrap.mjs`
- `app/src/application/presentation-theme.mjs`
- `app/src/application/table-presence-view-model.mjs`
- `app/src/application/table-presentation.mjs`
- `app/src/locales/product-translations.js`
- `app/src/locales/range-calibration-translations.js`
- `app/src/locales/tutorial-translations.js`
- `app/src/locales/welcome-translations.js`
- `app/src/tutorial/current-app-tutorials.mjs`
- `app/src/ui/TableRenderer.js`
- `app/src/ui/assets/opponents/PROMPTS.md`
- `app/src/ui/assets/opponents/cleo.png`
- `app/src/ui/assets/opponents/fern.png`
- `app/src/ui/assets/opponents/luma.png`
- `app/src/ui/assets/opponents/mika.png`
- `app/src/ui/assets/opponents/nova.png`
- `app/src/ui/assets/opponents/otto.png`
- `app/src/ui/assets/opponents/pip.png`
- `app/src/ui/assets/opponents/remy.png`
- `app/src/ui/assets/opponents/sol.png`
- `app/src/ui/assets/opponents/zig.png`
- `app/src/ui/riverline-design.css`
- `app/src/ui/study-disclosure.mjs`
- `app/src/ui/table-environment.mjs`
- `app/src/ui/training-lineup-preview.mjs`
- `docs/project/ADVANCED_EQUITY_V1_SPEC.md`
- `docs/project/CURRENT_PHASE.md`
- `docs/project/INTERACTION_GRAMMAR.md`
- `docs/project/OPPONENT_POLICY_V2_SPEC.md`
- `docs/project/PRODUCT_BACKLOG.md`
- `docs/project/PRODUCT_RETURN_QUEUE.md`
- `docs/project/ROADMAP.md`
- `docx_output.txt`
- `read_docx.py`
- `tests/advanced_equity_workspace001.test.mjs`
- `tests/beta_design_correction002.test.mjs`
- `tests/beta_design_refresh001.test.mjs`
- `tests/beta_feature_surface_refresh001.test.mjs`
- `tests/personal_strategy_intelligence_workspace.test.mjs`
- `tests/product_theme001_presentation.test.mjs`
- `tests/table_physicality003.test.mjs`
- `tests/table_presence002_presentation.test.mjs`
- `tests/tooling/profile_beta_design002.mjs`
- `tests/welcome_intro001.test.mjs`

Nothing staged, committed, stashed, reset or reverted. Protected config and
helper artifacts retain their original hashes. All ticket work is unstaged or
untracked for human review. No next Beta ticket was started.

Browser artifacts: `C:\Users\sjzns\AppData\Local\Temp\riverline-beta-blocker-hkQ31w`.

## Continuation verification gates

- Focused canonical/Saved/domain/import/Memory/performance run: 120 passed.
  After final additions and the old ante-layer expectation correction, 55 focused
  tests passed. Counts overlap; they are not a unique combined total.
- AUD-02/05 focused preservation: all 8 import and 25 executing-scheduler tests
  passed. Review/Hand/geometry/PERF checks are included in the normal full gate.
- Exact `node --test tests/*.test.js tests/*.test.mjs`: first continuation run
  2,528 passed / 1 failed, 356.064 seconds. The one old per-player-ante assertion
  included ante in wager thresholds; its expected layers now assert separate
  ante funding and unchanged outside-pot collection. Final rerun: **2,529 passed / 0 failed / 0 skipped**, 355.033 seconds.
  The canonical default command itself is green; no concurrency override.
- The existing range-cal002b timing harness measures batched current-thread CPU
  (101 estimates, five snapshot samples), retaining wall diagnostics. Computation
  limits remain <5ms per estimate and <100ms per snapshot; cached build/hit and
  invalidation counts remain asserted. It no longer treats time descheduled by
  unrelated full-suite processes as algorithm work. No production optimization
  or performance-budget increase was substituted for the harness correction.
- Solver: 26 passed in 1.663 seconds with the exact requested PYTHONPATH/unittest
  command. No solver code changed.
- Syntax: all 31 ticket JS/MJS files passed `node --check`; every ticket text file
  is valid UTF-8. Normal-config `git diff --check` passed.
- Mounted Firefox `--accounting`, 1920x1080 / 100%: normal Hand, current BBA
  SB102/BB98, actual Saved library import/reopen of the old SB101/BB99 fixture,
  corrected read-only Replay, completed/imported Review -> Analyze -> Hand,
  directly and via Training. No page errors. Saved Replay screenshot inspected.
  Artifacts: `%TEMP%/riverline-beta-blocker-FM4ksX`. This bounded sanity does not
  close pre-existing subjective design or localization QA; the Saved replay badge
  still exposes its existing untranslated status key in the captured surface.
- All 53 unrelated initially dirty files remain byte-for-byte unchanged. The four
  already-dirty files modified by the original ticket retain their refresh hunks.
  HEAD remains `b36999b`; nothing staged or committed. No AUD-14 planning sweep.

## Final Git status

Ticket changes and original design work remain unstaged/untracked:

```text
 M .codex/config.toml
 M app/index.html
 M app/src/application/advanced-equity-language.mjs
 M app/src/application/advanced-equity-workspace.mjs
 M app/src/application/exploit-teacher-workspace.mjs
 M app/src/application/hand-history-import.mjs
 M app/src/application/opponent-practice-workspace.mjs
 M app/src/application/personal-strategy-hand-workspace.mjs
 M app/src/application/personal-strategy-understanding-workspace.mjs
 M app/src/application/playbook-mode-bootstrap.mjs
 M app/src/application/presentation-theme.mjs
 M app/src/application/saved-study-object-bootstrap.mjs
 M app/src/application/saved-study-object-service.mjs
 M app/src/application/table-presence-view-model.mjs
 M app/src/application/table-presentation.mjs
 M app/src/application/training-memory-service.mjs
 M app/src/core/logic.js
 M app/src/locales/product-translations.js
 M app/src/locales/range-calibration-translations.js
 M app/src/locales/tutorial-translations.js
 M app/src/locales/welcome-translations.js
 M app/src/saved-study-objects/domain.mjs
 M app/src/saved-study-objects/repository.mjs
 M app/src/sync/coordinator.mjs
 M app/src/sync/domain.mjs
 M app/src/sync/saved-study-domain-adapter.mjs
 M app/src/tutorial/current-app-tutorials.mjs
 M app/src/ui/TableRenderer.js
 M app/styles.css
 M docs/project/ADVANCED_EQUITY_V1_SPEC.md
 M docs/project/CURRENT_PHASE.md
 M docs/project/DECISION_CONTEXT_SPEC.md
 M docs/project/GAME_RULES_V1_SPEC.md
 M docs/project/HAND_HISTORY_IMPORT_V1_SPEC.md
 M docs/project/INTERACTION_GRAMMAR.md
 M docs/project/OPPONENT_POLICY_V2_SPEC.md
 M docs/project/PRODUCT_BACKLOG.md
 M docs/project/PRODUCT_RETURN_QUEUE.md
 M docs/project/PRODUCT_SPEC.md
 M docs/project/QA_BACKLOG.md
 M docs/project/ROADMAP.md
 M docs/project/SAVED_OBJECT_SYNC_SPEC.md
 M docs/project/SAVED_STUDY_OBJECTS_SPEC.md
 M docs/project/TRAINING_MEMORY_V1_SPEC.md
 M shared/poker-domain/actor-call-economics.js
 M shared/poker-domain/pot-layers.js
 M shared/poker-domain/recorded-settlement.js
 M shared/poker-domain/schema.js
 M shared/poker-domain/settlement.js
 M shared/poker-domain/validate.js
 M tests/advanced_equity_workspace001.test.mjs
 M tests/design005_poker_visual_system.test.mjs
 M tests/design007_equity_workspace.test.mjs
 M tests/fixtures/hand-history/README.md
 M tests/game_rules001b_state_adoption.test.mjs
 M tests/personal_strategy_intelligence_workspace.test.mjs
 M tests/product_theme001_presentation.test.mjs
 M tests/range_cal002b_validation.test.mjs
 M tests/range_teacher001_personal_strategy.test.mjs
 M tests/replay001c_integration.test.mjs
 M tests/replay_rail_nav001_hardening.test.mjs
 M tests/table_physicality003.test.mjs
 M tests/table_presence002_presentation.test.mjs
 M tests/tooling/range_cal002b_evaluation.mjs
 M tests/training_memory001_foundation.test.mjs
 M tests/ui_polish003_responsive_action_path_daylight.test.mjs
 M tests/welcome_intro001.test.mjs
?? "Riverline Repository Deep Audit Handoff.docx"
?? app/src/saved-study-objects/accounting-compatibility.mjs
?? app/src/ui/assets/
?? app/src/ui/riverline-design.css
?? app/src/ui/study-disclosure.mjs
?? app/src/ui/table-environment.mjs
?? app/src/ui/training-lineup-preview.mjs
?? docs/project/BETA_BLOCKER_REPAIR001_REPORT.md
?? docx_output.txt
?? read_docx.py
?? tests/beta_blocker_accounting.test.mjs
?? tests/beta_blocker_import.test.mjs
?? tests/beta_blocker_sync.test.mjs
?? tests/beta_design_correction002.test.mjs
?? tests/beta_design_refresh001.test.mjs
?? tests/beta_feature_surface_refresh001.test.mjs
?? tests/fixtures/accounting-compatibility/
?? tests/fixtures/hand-history/AllInCall.txt
?? tests/tooling/profile_beta_design002.mjs
?? tests/tooling/verify_beta_blocker001_firefox.mjs
```
