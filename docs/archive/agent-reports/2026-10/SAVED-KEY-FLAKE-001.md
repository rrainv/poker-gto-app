# SAVED-KEY-FLAKE-001 (B10): Saved keyboard test reliability

Ticket: B10 · Mechanical / evidence · T0 · branch `argon/m1-batch-3` · done by Claude while Argon is out of quota
Issue: FLAKY-SAVED-KEY

## 1. Outcome

`tests/saved_composition002.test.mjs` "Training history keyboard browsing coalesces the Saved lookup to the row the user stops on" is reliable today. FLAKY-SAVED-KEY is closed with that evidence. No code or test change.

## 2. Evidence

- Alone, 10 runs: `node --test --test-name-pattern="Training history keyboard browsing" tests/saved_composition002.test.mjs` → `# pass 1 # fail 0` each time (the filter matched exactly this test).
- Under the full suite (`node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`, 2802 tests), 4 runs: `ok 2250 - Training history keyboard browsing …` every time. The first run was before the B8 test-adapter fix and had one unrelated failure (see A11Y-KEYS-001); the next three were clean, 2799 pass / 0 fail / 1 skipped / 2 todo, 289–318 s each.
- The test needs no timing luck: it uses the DOM harness's fake timers (`pendingTimers()` / `flushTimers()`) and `settle()`, with no sleeps.
- The register said the test failed deterministically on 2026-10-17 (`getById` called 0 times). That failure does not reproduce on this branch. I did not bisect what changed; the last commit to the test file (`e119ab5`, TEST-HYGIENE-001) is dated 2026-10-16, before that note, so I can't name the cause.

## 3. Files

Changed by this ticket: `docs/ISSUE_REGISTER.md` (FLAKY-SAVED-KEY row), this report.
Pre-existing untracked: `.claude/`.

## 4. Verification

As in §2. Nothing skipped.

## 5. Limitations and debt

The cause of the earlier failure is unknown. If it comes back, reopen FLAKY-SAVED-KEY and bisect from `f18b6be`.

## 6. Disagreements or doc conflicts

The register row's title says "fails under parallel load (seen 3×)", but its status said "broken, not flaky". Neither matches today's behaviour. Closed with today's evidence.

## 7. Git status

Committed as one commit on `argon/m1-batch-3` with the two files above; `.claude/` not staged.
