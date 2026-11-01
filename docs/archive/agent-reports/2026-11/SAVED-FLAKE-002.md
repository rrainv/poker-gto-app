# SAVED-FLAKE-002 — root cause of the Saved keyboard-browsing flake

Tier T1 · Claude Code (Opus 5.5) · laptop, Windows 11, Node 26.5.1 and Node 24.22.2 (`npx node@24`) · base `d164f70`.

## 1. Outcome

`tests/saved_composition002.test.mjs` "Training history keyboard browsing coalesces the Saved lookup to the row the user stops on" is now deterministic. The flake came from the **test** (diagnosis a): it counted event-loop turns while waiting on real Web Crypto work that runs off the event loop.

## 2. Root cause

Every Saved lookup in the Training history workspace (`checkSavedState`, and `saveAsSpot`) first awaits `savedTrainingHistorySpotObjectId(id)`, which runs `crypto.subtle.digest('SHA-256', …)`. Node runs that digest on the libuv thread pool, so the promise settles after an unpredictable number of event-loop turns. The test waited exactly two `setImmediate` turns (`await settle(); await settle();`) after the click, and again after `flushTimers()`, then asserted `getById` had been called.

Evidence:

- Both lookup assertions fail ("a click looks up its decision immediately" and "one more lookup, for t3 only"). Both sit behind a digest. Assertions that don't depend on a digest never fail.
- A probe that counted `setImmediate` turns until `crypto.subtle.digest` resolved (200 samples each) gave **1 to 30 turns** on Node 26 (most often 3–5) and **1 to 28** on Node 24 (most often 2–4). Waiting two turns is a coin toss, and a faster PC moves the odds; that explains B10's "10/10 alone" on another machine.
- Not (b), a product race: `select()` calls `checkSavedState` synchronously on click (no timer). The coalescing timer only applies to arrow keys, and the test drives it with the fake `flushTimers()`.
- Not (c), the harness or Node version: it fails on both 24 and 26. Node 24 only has a slightly faster digest round-trip here.

### Reproduction (file run alone)

| | Node 26.5.1 | Node 24.22.2 |
|---|---|---|
| Before fix | 10/20 failed (8× "click looks up", 2× "t3 only") | 4/20 failed (3× "click looks up", 1× "t3 only") |
| After fix | 0/30 failed | 0/20 failed |

## 3. Change

- `app/src/application/saved-training-history-workspace.mjs`: new optional `deps.subtle` (Web Crypto), defaulting to `globalThis.crypto.subtle`, passed to `savedTrainingHistorySpotObjectId` in both call sites. It works like the existing `deps.timers` seam. The production behaviour and the Saved object IDs don't change.
- `tests/saved_composition002.test.mjs`: `mountHistory` injects a `syncSubtle` that computes the same SHA-256 with `node:crypto` `createHash` and settles as a microtask. The test now waits a single `settle()` per lookup and asserts the **exact** object IDs (`[t1Id]`, then `[t1Id, t3Id]`), computed with the real Web Crypto path. The assertion is stricter, not looser: it now also proves the ID derivation is unchanged and that the lookup after the pass-over is for t3 specifically. No retries, sleeps or skips.
- `docs/ISSUE_REGISTER.md`: FLAKY-SAVED-KEY row rewritten with the real cause (the SAVED-KEY-FLAKE-001 closure was premature).

## 4. Verification

- `node --check` on both changed `.mjs` files: OK. `git diff --check`: clean.
- 30 consecutive runs alone, Node 26: 0 failures. 20 runs alone, Node 24: 0 failures.
- All `tests/*saved*` files (107 tests): pass.
- Full suite ×3, `node --test --test-concurrency=2 tests/*.test.js tests/*.test.mjs`: 3/3 green. Each run: 2879 tests, 2876 pass, 0 fail, 1 skipped, 2 todo (both pre-existing), about 453 s; the coalescing test passed in every run.
- Browser: not applicable (test-only seam; no UI change).

## 5. Limitations and debt

- `tests/saved_training_history001.test.mjs` mounts the same workspace with the real digest but waits on a condition (`until(...)`), so it is correct as written; left unchanged.
- Other tests that await real `crypto.subtle` behind a fixed number of turns would have the same flaw. I found none touching this workspace; no wider sweep was done.

## 6. Disagreements or doc conflicts

None. The earlier closure note ("no code change … not bisected") is superseded in the register.

## 7. Git

Committed on `codex/stabilization` with an exact file list: the two code files, the register, and this report. Nothing under `.codex/` or `.claude/` was staged.
