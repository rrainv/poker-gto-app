# Current Riverline phase

Last refreshed: August 13, 2026.

Code, tests, Git history, and the latest accepted ticket report override this snapshot.

## Reported current state

Completed major phases:

- concentrated legacy cleanup (`CLEANUP-001`)
- Strategy Integrity pricing and analytical truthfulness
- one StrategyProvider and StrategyResult authority
- heuristic strategy extraction from `logic.js`
- preflop and postflop mathematical-integrity work
- evidence-first calibration baseline; further broad tuning paused pending reference data
- `PERF-001`
- `PRODUCT-UI-001`
- `PRODUCT-UI-002` and its accepted correction pass
- agent-documentation refresh

Current reported ticket:

- `PRODUCT-UI-003`, `PRODUCT-UI-003R`, and `PRODUCT-UI-003R2` form the current unstaged working ticket
- implementation is awaiting human visual acceptance and commit

Next planned ticket after acceptance:

- `PRODUCT-UI-004` — cards, themes, and micro-polish
- `PRODUCT-UI-005` — workspace composition and responsive fit
- fresh UI QA checkpoint
- `EQUITY-UX-001`
- `GUIDE-001`
- `I18N-001`
- `RESPONSIVE-001`

## Current priority

Finish the existing product as a polished, trustworthy application before returning to model/cloud/deployment work.

Do not start solver/model/cloud work merely because specialized prompt files exist.

## Update rule

After an accepted ticket:

- update owned issues in `QA_BACKLOG.md`
- update this file if active/next tickets changed
- update `ROADMAP.md` only when phase ordering or scope changed materially
