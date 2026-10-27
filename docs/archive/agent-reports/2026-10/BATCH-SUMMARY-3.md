# M1 Batch Summary 3 (`argon/m1-batch-3`)

- **Agent:** Claude Code (taking over Argon's batch 3 while Argon is out of quota)
- **Branch:** `argon/m1-batch-3`, based on `a9b2578` (MERGE-002); pushed, not merged
- **Date:** 2026-10-27

## Tickets

- **B7 LOCALE-NUMBERS-001:** done (`3559a20`). Argon started it; Claude finished it after Argon's quota ran out. One locale number formatter keyed to the UI language; Equity/Hand status re-worded on a language switch. QA-LANGUAGE-SWITCH-003 is partial (about 45 static keys left; LOCALE-NUMBERS-002). See LOCALE-NUMBERS-001.md.
- **B8 A11Y-KEYS-001:** done (`e4ad631`). The card picker and the 13×13 matrices are each one roving Tab stop with arrow/Home/End keys. Arrows never scroll the page from the picker. Matrices have proper ARIA rows and a visible focus ring. Browser-checked in EN Midnight; HE/RTL deck arrows unverified.
- **B9 FULLHAND-QUALITY-001:** done (`d9ae637`). Adds "Skip to end" for Watch rest (speed is still M2, so WATCH-REST stays partial). The Training heading follows the state, and lineup tiles no longer run text together or clip names. Browser-checked in EN Midnight with before/after observations; HE and 1366 unverified.
- **B10 SAVED-KEY-FLAKE-001:** done, no code change (commit with this summary). The test passed 10/10 alone and 4/4 under the full suite, so FLAKY-SAVED-KEY is closed with that evidence.

## Full Test Suite Result

- Command: `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`
- Final tree (after B8 and B9; B10 changes only docs): **2802 tests, 2799 pass, 0 fail, 1 skipped (Electron binary not installed), 2 todo (TEST-HYGIENE-001-F01, F07)**. I ran it 3 times for B10's evidence, all identical (289–318 s).
- The first full run, before the fix, had **1 real failure caused by B8**: `qa001_evaluator_equity` used a second mock deck without `querySelectorAll`. I fixed it in the B8 commit before the three clean runs.
- Solver suite not run (no domain, solver or strategy changes).

## Not staged / not touched

`.claude/` (untracked, pre-existing). `docs/STATE.md` not edited. Nothing merged.
