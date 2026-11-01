# TEST-DETERMINISM-001 report

Tier T1 · Claude Code (Sonnet 5.5) · base `origin/codex/stabilization` @ 7044bc5. Stopped early at the owner's request: the proof below is partial.

## 1. Outcome

The quick-drill `waitFor` "timeout" was not load. It was a **product defect**: a Varied Training session sometimes fails to generate the next spot, the workspace goes to `error`, and `waitFor` waited out its deadline for a state that could never arrive. Two test-side defects are fixed; the product defect is registered, not fixed.

## 2. Root causes / design choices

- `waitFor` (`tests/helpers/browser-app.mjs`) failed on a 10 s wall-clock deadline, so a slow machine could fail a wait that was only slow. It now fails after 20000 settle rounds (about 2.6 s on a true hang) and never on elapsed time. The work it waits for is fake-clock/microtask driven or settles within a few dozen turns, so rounds are load-independent.
- `training_quick001_drill` asserted the answer pill matched `(inside|outside) the baseline's mix`; the product says "not in the baseline's mix". It failed about 1 in 20 whenever the randomly chosen action had no baseline share. It now checks the wording against the real `inside` flag.
- Product defect, not fixed: with a diagnostic added temporarily to the test, 2 failures in about 150 runs showed `unsupported_target` / `requested_sizing_family_collapsed` (requested `overbet`, realized as `large`, 8900 milliBb, distinct families small/medium/large/all_in). Registered as TRAINING-PLANNER-OVERBET-001. I did not seed or retry around it, so those tests keep a residual ~1% failure.

## 3. Files

Changed: `tests/helpers/browser-app.mjs`, `tests/training_quick001_drill.test.mjs`, `docs/ISSUE_REGISTER.md` (FLAKY-QUICKDRILL-WAITFOR, TRAINING-PLANNER-OVERBET-001), this report. No pre-existing dirty files.

## 4. Sweep (tests/*.test.*; tooling/archive audit scripts excluded)

| Location | Pattern | Risk |
|---|---|---|
| `helpers/browser-app.mjs:527` `waitFor` | 10 s wall-clock deadline | High, fixed |
| `training_quick001_drill.test.mjs:211` | wrong expected wording, data dependent | High, fixed |
| `training_quick*` waits | hang when generation errors (planner defect) | Medium, registered |
| `helpers/browser-app.mjs:511` `settle` | fixed 20 rounds | Medium; slow work must use `waitFor` |
| `audio_motion001_experience.test.mjs:869` | real `Date.now()` >= 90 against a real 120 ms timer | Low (30 ms margin) |
| `hand_history_import.test.mjs:116`, `deep_review_study_inbox001:249`, `personal_strategy_intelligence_sync:212,219`, `saved_objects002_source_ux:293`, `typography_fidelity001:139`, `fullhand_quality001:67` | one `setImmediate`/`setTimeout(0)` flush over promise-only stubs | Low (microtasks, no real crypto or I/O) |
| `account002b_saved_sync.test.mjs:376` | spins on a condition (`while (!release)`) | Low, already condition-based |
| `training001_canonical_generator:473` (15 s), `range_core001_weighted_holdem_range:553` (1 s/op), `analysis_range001_range_analysis:588` (30 s) | wall-clock performance budgets | Medium to low; needs op-count guards, separate ticket |
| `saved_composition002`, `saved_training_history001` | SAVED-FLAKE-002 already fixed (injected `subtle`, `until`) | Done |

## 5. Verification

- Baseline before changes: full suite `--test-concurrency=2`: 2879 tests, 2876 pass, 0 fail, 3 skipped (8m13s).
- Each of the 8 files that use `waitFor`, 20 runs alone: 7 of 8 were 0/20 after the `waitFor` change. `training_quick001_drill` was 1/20 (pill assertion, since fixed) and 0/20 after the fix. A later pass showed `training_f12_session_restart` 1/20, not diagnosed; most likely the same planner defect.
- Full suite after changes: run 1 of 3 at `--test-concurrency=2`: 2879 tests, 0 fail. Runs 2 and 3 were **not done** (stopped at the owner's request). The 20x loops for the final state of the code were also stopped early.
- `node --check` on both changed test files and `git diff --check` clean; LF confirmed via `git ls-files --eol`.
- Not met: "20 clean runs of every fixed file" and "full suite 3x". Browser checks: not applicable (T1, test-only).

## 6. Limitations and debt

- TRAINING-PLANNER-OVERBET-001 (P1, open): about 1% of Varied sessions can hit a generation error in the real product. Needs an owner decision (re-plan to another candidate vs plan only realizable families).
- FLAKY-QUICKDRILL-WAITFOR stays Partial for that reason.
- `training_f12_session_restart` 1/20 is undiagnosed.

## 7. Disagreements / doc conflicts

None. The ticket's premise (timing under load) was wrong for the quick-drill case; I report that instead of calling `waitFor` the cause.

## 8. Git

Exact-file commit and push to `claude/test-determinism-timing-a3667a`; nothing else staged. `.codex/config.toml` and `.claude/` not touched.
