# TEST-SPEEDUP-001

Base: origin/codex/stabilization 940555d. Tier T1.

## Profile
- opponent_intelligence001 (213 s): 208 s is one test, "500bb always-raise practice". One hero answer, then 512 automated
  transitions. Each transition does structuredClone plus full validatePokerState/validateAction of the whole growing
  history (CPU profile: structuredClone 100 s, validate* ~85 s), so cost is quadratic in transitions. Other six tests: 5 s.
- beta_blocker_sync (99 s): 82 s is the six download cases at 499-501 (about 5 s each) and 999-1001 (about 27 s each). CPU
  profile of the 999 case: 13.3 of 14.9 s in structuredClone from createMemorySyncDatabase.runTransaction
  (app/src/sync/indexeddb-storage.mjs:127), which deep-clones every record of every store on every transaction (quadratic).

## Changes
- opponent_intelligence001: stack 500bb -> 250bb, title renamed. The assertions are unchanged (terminal, count > 256).
  Transition count is about stack/1bb + 12 (measured 112/162/212/262 at 100/150/200/250bb), so 250bb gives 262, still
  above the 256 cap. Trade-off: the 500bb stack itself is no longer exercised; the guard is the transition budget.
- beta_blocker_sync: NOT changed. Cutting the 999-1001 counts would drop the three-page boundary, and sharing setup does
  not help because the cost is inside the memory DB double. Proposal below.

## Before/after (node tools/run-tests.mjs --files, alone)
| File | Before | After (5 runs) |
|---|---|---|
| opponent_intelligence001 | 213 s | 43.1, 49.4, 47.6, 47.3, 45.5 s (all pass) |
| beta_blocker_sync | 99 s | unchanged |

## Mutations (opponent test, source restored after each)
| Mutation | Result |
|---|---|
| practice budget falls back to the 256 cap | fails: transition_limit_exceeded at 256 |
| budget fixed at 261 (one below the need of 262) | fails: transition_limit_exceeded at 261 |
| automated transitions not counted | fails: count > 256 assertion |

## Proposals (not done, outside a test-only ticket)
1. createMemorySyncDatabase.runTransaction: do not deep-clone all stores for readonly transactions (reads already clone
   on return), or clone on write. Expected: beta_blocker_sync download cases from about 27 s to a few s; helps the other
   five sync test files that use the same double. Needs the owner's OK (app/src change).
2. The poker-domain applyAction path revalidates the full history per transition (quadratic). A real cost for long hands
   in the app too; candidate register row.
