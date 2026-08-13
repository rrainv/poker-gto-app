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
- `PRODUCT-UI-001` through `PRODUCT-UI-005`, including their accepted correction passes
- agent-documentation refresh

Current reported ticket:

- `PERF-RL18` completed a live Electron DOM inventory across Playbook, Matrix, Range, Training, Equity, and Guide states
- the targeted card-picker cleanup detaches 376 elements/52 buttons on close with focus return; `RL-18` and `QA-PERF-002` are closed while visible-Matrix profiling remains `QA-PERF-003`

Previously reported acceptance work:

- `EQUITY-UX-001` and its `EQUITY-UX-001R` presentation correction are implemented and test-verified in the current unstaged working ticket
- renderer automation was unavailable for the correction pass, so `RL-16` remains `PARTIAL` pending final human visual acceptance and commit
- `GUIDE-001` is implemented and test-verified; `RL-17` remains `PARTIAL` pending final human review of the live Guide

Next planned ticket after acceptance:

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
