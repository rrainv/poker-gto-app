# Current Riverline phase

Last refreshed: August 14, 2026.

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
- `RANGE-CAL-000` through `RANGE-CAL-002A` Personal Strategy foundation and isolated sparse-RFI inference baseline

## Strategy checkpoint — Personal Strategy

`STRATEGY-CHECKPOINT-001` records the completed Personal Strategy foundation:

- `RANGE-CAL-000` domain foundation
- `RANGE-CAL-001A` workspace/context builder
- `RANGE-CAL-001B/001BR` direct elicitation and truthful tied mixes
- `RANGE-CAL-001C-A` record-oriented IndexedDB persistence, migration, recovery, and atomic writes
- `RANGE-CAL-UI-001R` profile-editor geometry and polish
- `RANGE-CAL-002A` isolated sparse RFI inference baseline and synthetic holdout evaluation

The usable subsystem has named profiles, exactly three user-named discrete modes, direct RFI Fold/Raise calibration, optional explicit mixes, truthful tied-mix semantics, pause/resume/undo, durable local persistence, migration/recovery, portable export/import groundwork, and an isolated deterministic inference research module.

`RANGE-CAL-002A` is promising only for locally structured synthetic ranges: at 30/40/50 answers it selectively covered about 49.6%/60.0%/64.3% of eligible holdouts at about 89.5%/89.4%/91.0% attempted accuracy. It abstains rather than filling every cell, and the deliberately irregular/non-monotonic fixture remained near chance on attempted predictions. These are synthetic research results, not independent real-user validation. Internal support differences are not confidence, inferred dominant actions are not action frequencies, and the module remains unexported from the live Personal Strategy index, unpersisted, and unused by the product. See `RANGE_CAL_002A_HOLDOUT_REPORT.md`.

Further Personal Strategy work is intentionally **DEFERRED**, not rejected: `RANGE-CAL-002B`–`002D`, `RANGE-CAL-002R`, mode interpolation, StrategyProvider integration, Training-to-profile evidence, and broader integration. Existing contracts/data remain preserved, the Range Calibration workspace remains usable, the deterministic 169 loop remains a fallback/test harness, and no current workspace depends on incomplete inference. Resume at `RANGE-CAL-002B`; do not redesign the foundation.

## Active product direction

- **ACTIVE NEXT — `TABLE-PRESENCE-001A`:** create the richer static Hand Mode table layer from trusted canonical Hand Mode data only. It owns presentation for the dealer/button marker, player identity and stack hierarchy, current-actor emphasis, folded/all-in states, current-street contributions/chips, central pot, completed versus current actions, and a reusable application-level table view model. The renderer consumes trusted state; it does not calculate poker rules, pots, contributions, legality, or replay states. No replay controls or playback animation belong to this ticket. Preserve restrained premium presentation, EN/RU/HE, RTL, themes, desktop responsiveness, and Firefox-first acceptance.
- **PLANNED — `REPLAY-001A`:** after Table Presence acceptance, add a read-only canonical action timeline grouped by street, with player/position identity, action and amount, Hero emphasis, folds/checks/calls/bets/raises/all-ins, and a current-decision marker. No scrubbing yet.
- **PLANNED LATER — `REPLAY-001B`:** deterministic previous/next step-through with a trustworthy projected state and clear live-state versus replay-state distinction; table updates flow through the Table Presence layer.
- **PLANNED LATER — `REPLAY-001C`:** play/pause, adjustable speed, restrained card/chip/bet/pot motion, and reduced-motion behavior. No casino/jackpot aesthetic.

## Current priority

Develop one bounded ticket at a time: start with `TABLE-PRESENCE-001A`, then consider the Replay sequence only after the preceding acceptance gate. Preserve the polished baseline; Scenario Mode and canonical Hand Mode remain distinct, PokerState remains the poker-rule authority, and table rendering must not implement poker mathematics.

Do not start solver/model/cloud work merely because specialized prompt files exist.

## Update rule

After an accepted ticket:

- update owned issues in `QA_BACKLOG.md`
- update this file if active/next tickets changed
- update `ROADMAP.md` only when phase ordering or scope changed materially
