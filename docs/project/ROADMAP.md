# Riverline Roadmap

Last refreshed: August 17, 2026 (`ROADMAP-CHECKPOINT-002`).

This roadmap is directional, not a rigid waterfall. `CURRENT_PHASE.md` is the authoritative current checkpoint/resume map; `PRODUCT_BACKLOG.md` preserves detailed future capability; code, tests, accepted tags/reports, manual QA, and explicit user decisions override planning prose.

## Established foundation — COMPLETED

- canonical PokerState/action/evaluator/Equity authority and Scenario-versus-Hand separation;
- `DecisionContext v1`, one `StrategyProvider v1` / `StrategyResult v1`, and an honestly labelled deterministic heuristic fallback;
- canonical Training convergence and `PERF-001`;
- Personal Strategy foundation through `RANGE-CAL-002A` (later inference/integration intentionally checkpointed);
- canonical Table Presence, Replay through `REPLAY-001C`, physical current-street contributions, and reusable poker-chip visuals;
- Saved Hand/Spot domain and visible save/note/review workflows through `SAVED-OBJECTS-002`;
- `HOME-001` persistent study dashboard and detached Saved Hand Replay reopening;
- reusable tutorial foundation and current-app coverage;
- `RANGE-CORE-001` canonical combo-level weighted range foundation;
- `ANALYSIS-RANGE-001` range-aware Analysis/structural outs checkpoint.

Do not revive retired ONNX/model runtime, remote strategy API, arbitrary solver-tree upload, duplicate Equity, or legacy synthetic Training paths. Future validated sources enter behind versioned provider contracts.

## Near-term sequence

1. **COMPLETED — `ANALYSIS-RANGE-001` checkpoint.** Implementation is accepted at the `analysis-range-001` tag; final live visual/language acceptance remains honestly tracked in `QA_BACKLOG.md`.
2. **ACTIVE NEXT — `PREFLOP-SANITY-001`.** Characterize and suppress obviously dominated premium Fold leakage caused by heuristic smoothing. Keep the correction narrow, context-aware, smooth at genuine boundaries, and invariant-tested; do not add broad hand-by-hand intuition tuning or unmodelled ICM assumptions.
3. **PLANNED NEXT — `BLUFF-001`.** Deliver mathematically honest always-available risk/reward and hand/draw/removal facts, with range-enhanced claims only from explicit canonical sources and value/call/bluff verdicts only from trustworthy partitions.
4. **PLANNED NEXT — account architecture/foundation.** Establish account-ready identity, ownership mapping, offline/privacy/conflict boundaries before authentication or sync.
5. **PLANNED NEXT — richer Home.** Evolve Home into “my Riverline” using real account, Saved, Personal Strategy, Analysis, and later Training state; Home remains a consumer.
6. **PLANNED NEXT — Home Game Organizer.** Build a separate top-level domain/tab, staged from persistence through session UI to settlement/reconciliation.

Reassess after each clean checkpoint rather than forcing all six branches to completion.

## Explicit resume points

- **Personal Strategy — CHECKPOINTED / INTENTIONALLY INCOMPLETE:** resume at `RANGE-CAL-002B`, then `002C`, `002D`, and `002R`; mode relationships, StrategyProvider integration, Training evidence, postflop propagation, and Range Builder/Teacher remain later gates.
- **Training intelligence — PRESERVED FUTURE:** persistent mistakes, review/re-drill, adaptive/spaced study, expanded filters, saved drills, mastery, session summaries/trends, Home/Replay integration, and opt-in profile evidence.
- **Range tools — PRESERVED FUTURE:** canonical combo-level Range Builder, sparse Range Teacher/Profiler, range-vs-range tools, Compare Spots, and Saved Ranges.
- **Accounts/cloud/social — PRESERVED FUTURE after `ACCOUNT-001`:** authentication, offline-first sync/backup, cross-device user data, then approved sharing/forking/friends/study groups.
- **Product Lab — PRESERVED FUTURE:** safe layout presets, density/card sizing, beginner/expert modes, curated themes, preference persistence/reset, expert keyboard workflow, and deliberate mobile composition.
- **Solver/reference/model — PRESERVED FUTURE:** validated bounded reference work and data first; model/interpolation only afterward; production integration only behind StrategyProvider.
- **PLO, public release, and optional gamification — PRESERVED FUTURE / OPEN PRODUCT DECISION:** separate game domain, deliberate packaging/mobile/privacy work, and restrained study mechanics only if approved.

## Shelved visual branch

Richer dealer presentation, physical card trajectories, stack-to-bet and pot-collection chip animation, detailed chip stacks/denominations, deeper/3D table treatment, elaborate showdown/reveal motion, and ambience are **SHELVED FOR LATER**. Preserve the reduced-motion and no-casino aesthetic. Resume only after higher-priority product intelligence/foundation branches reach clean checkpoints.

## Product priority principle

The current explicit priority is: tutorials and richer Analysis/range foundation are checkpointed; next comes the small preflop sanity correction, then Bluffing, account identity, a substantially richer Home, and the separate Home Game Organizer. Detailed accepted ideas remain in `PRODUCT_BACKLOG.md` and must not depend on chat memory.
