# Agent Master Context

Last refreshed: August 23, 2026 (`ROADMAP-SYNC-003`).

## Product

Riverline is a browser-first Texas Hold'em analysis, training, and personal-study application for personal use, friends, and a possible future public release.

The product north star is a **personal poker learning workstation** connecting:

- full-hand play;
- post-hand review/replay;
- selected-reference comparison;
- Personal Strategy comparison;
- Saved study continuity;
- targeted re-drilling and persistent learning;
- later opponent policies / recognizable archetypes.

It should feel like a calm, serious, coherent analytical poker workstation, not a research demo or casino game.

## Current runtime map

```text
app/index.html
├─ classic UI/application orchestration: app/src/core/logic.js
├─ Playbook mode/state controllers
├─ DecisionContext v1 / v1.1 additive facts
├─ StrategyProvider v1
│  └─ deterministic heuristic strategy modules under app/src/strategy/
├─ StrategyResult v1 + StrategyClaimPolicy v1
├─ AnalysisExplanation v1
├─ canonical Equity controller + worker
│  └─ shared/poker-domain Equity/evaluator
├─ canonical Training generator/session/grading/presentation
│  └─ same StrategyProvider
├─ pure table-presentation/v1 over canonical Table Presence / Replay / legality
├─ hand-review/v1 over canonical Hero decisions / Replay / strategy claims
├─ TableRenderer / SoundFX / i18n
└─ product-performance scheduling and invalidation
```

Electron remains a thin BrowserWindow host for the same application. It has no second poker implementation, model inference path, or strategy IPC.

## Canonical authorities

- `shared/poker-domain/`: cards, PokerState, actions, legality, accounting, evaluator, canonical Equity
- `DecisionContext v1` with additive `contractVersion: decision-context/v1.1`
- `StrategyProvider v1`: sole application strategy entry point
- `StrategyResult v1`: canonical strategy result/provenance contract
- `StrategySourceDescriptor v1` / context coverage / capabilities
- `StrategyClaimPolicy v1`: sole application authority for comparative/normative/exactness/sizing/EV/optimality claims
- `app/src/strategy/`: current deterministic generalized heuristic implementation
- canonical Training modules: legal generated states, seeded replay, grading/presentation
- `AnalysisExplanation v1`: structured explanatory facts; UI renders, does not recompute poker math
- `SavedStudyObject`: durable Saved Hand/Spot authority
- Personal Strategy evidence/snapshot modules: intended-strategy authority separate from reference/observed behavior
- `product-performance/v1`: interaction scheduling/invalidation
- `solver/riverline_solver/`: bounded research only, never production runtime

## Bounded presentation contracts

- `table-presentation/v1`: pure ephemeral geometry, hierarchy, projection, timeline, and decision-dock presentation facts over canonical authorities; never PokerState, legality, accounting, strategy, persistence, or Saved authority

## DecisionContext facts

Important semantics:

- `facingSizeBb`: nominal/current wager-to, not call price;
- `callAmountBb`: exact incremental stack-capped call when known;
- `currentPotBb`: unclamped v1.1 current-pot fact; live SPR logic must use this, not legacy `potBb`;
- `stackBb`: compatibility/configured depth, not live stack;
- `heroStackBb`: live Hero chips behind when canonical;
- `effectiveStackBb`: exact scalar only with one live opponent;
- `effectiveStackByOpponent`: per-live-opponent facts for multiway;
- `positionRelation`: postflop `in_position` / `out_of_position` / `mixed` / `unknown` / `not_applicable`;
- `minRaiseToBb` / `maxRaiseToBb` / `allInToBb`: canonical legal total-to bounds;
- `priorActionSummary`: bounded semantic history including exact preflop role facts where canonical;
- `derivation`: stable exact/defaulted/normalized/clamped/unavailable provenance.

Scenario remains lossy. Unknown facts must stay unknown rather than being reconstructed from guesses.

## Preflop role semantics

Current exact role taxonomy includes, where evidence permits:

- `unopened_rfi`
- `isolation_opportunity`
- `bb_option_after_limps`
- `cold_response_to_open`
- `blind_vs_blind_response_to_sb_open`
- `opened_facing_three_bet`
- `cold_four_bet_opportunity`
- ordinary/cold four-bet response roles
- `opener_facing_cold_four_bet`
- `limper_facing_isolation`
- unclassified deeper aggression / unknown

Actual role must remain distinct from temporary heuristic fallback calibration.

## Strategy truth

Current production sources include heuristic preflop/postflop, equity fallback, and unavailable states.

There is no validated general Hold'em strategy reference in production.

The deterministic heuristic has **generalized comparative authority** only. It may support strategy display and comparison, but not objective correctness, solved-GTO claims, exact frequency authority, EV-loss, exploitability or optimality.

Recent strategy-quality work:

- `REFERENCE-AUTHORITY-001`: source/claim semantics;
- `STRATEGY-REPAIR-001A`: structural preflop repair, causal sampler seed, missing-price honesty;
- `DECISION-CONTEXT-001A`: live/current facts;
- `STRATEGY-REPAIR-001B`: live SPR/position/price/legal/history consumption;
- `REFERENCE-BENCH-001`: source-agnostic benchmark tooling;
- `PREFLOP-ROLE-001`: exact preflop roles;
- `PREFLOP-CALIBRATION-001`: first richer hand representation and bounded BB-vs-BTN cold-response policy.

The preflop v4 policy introduced separate `continueValue`, `passiveRealization`, and `aggressionSuitability` dimensions for a bounded six-max BB-vs-BTN ~100bb/~2.5bb region. This is still generalized and not independently solver-validated.

Do not broad-tune heuristics from intuition. Use benchmark/reference evidence and isolate changes by role.

## Reference benchmark truth

`REFERENCE-BENCH-001` is research tooling, not production strategy.

It supports manually observed/public/licensed/Riverline-owned/independent-solver observations, explicit context matching, raw actions, normalized comparison levels, strategy/equity metrics, and diagnostic hints.

Paid-product observations such as GTO Wizard samples remain private/local research evidence. Do not check proprietary frequencies into public fixtures or reconstruct external paid solution databases.

## Competitive Reference Gate

For substantial user-facing or strategy work, perform bounded competitor/reference research when it materially helps.

Record:

- ADOPT
- ADAPT
- DIFFERENTIATE
- REJECT

GTO Wizard is the default high-end benchmark for many trainer/table/matrix/reference UX questions; DTO, PokerSnowie, Advanced Poker Training and specialized tools are secondary references where relevant.

Competitor behavior is evidence, not authority. Never copy proprietary charts, branding, text, or assets.

## Equity truth

Canonical Equity is separate from heuristic conditional sampling:

- exact enumeration where practical;
- seeded Monte Carlo for larger spaces;
- multiway support;
- cancellation/progress.

Do not compare quantities with different populations/semantics merely because both are called "equity".

## Training truth

Training:

- generates legal canonical trajectories;
- uses deterministic seeds and replay metadata;
- resolves strategy through the same StrategyProvider as other consumers;
- uses source-aware comparative presentation;
- does not prove exact EV loss or GTO correctness.

Persistent Training Memory / re-drill intelligence is planned after the next trusted-reference phase.

## Personal Strategy truth

Personal Strategy is intended-strategy authority, not reference truth.

Locked concepts:

- recognizable Profile/environment;
- exactly three user-named modes;
- quick answer = dominant/preferred action, not implicit pure frequency;
- exact mixes optional;
- direct/Training contradictions preserved;
- sparse direct evidence is durable truth;
- inference/uncertainty/conflicts are recomputable projections.

Future review should keep **selected reference**, **intended Personal Strategy**, and **observed play** as three distinct roles.

## Current development direction

The strategy-integrity burst is complete through `PREFLOP-CALIBRATION-001`.

Active sequence:

1. `TABLE-PRESENCE-REF-001` — completed competitive/design brief;
2. `TABLE-PRESENCE-002` — completed adaptive table implementation checkpoint;
3. `FULL-HAND-REVIEW-001` — completed shared Hand/Training review implementation checkpoint;
4. `AUDIO-MOTION-001` — active next semantic audio/motion layer;
5. `PREMIUM-CLOSEOUT-001` — planned whole-app premium/Core Flow closeout;
6. first bounded trusted reference pack/provider;
7. Training Memory/re-drill;
8. Personal Strategy integration;
9. Saved/Home study knowledge workspace;
10. opponent policies/bots later.

Do not let accounts/Supabase cleanup, architecture decomposition, or more heuristic tuning displace this sequence unless they become actual blockers.

## UI/product principles

- Playing: table + current decision dominate.
- Review: timeline + important decisions dominate.
- Analyze: evidence/ranges/explanation dominate.
- Saved: compact inspector supports dense library.
- Premium means calm, state-aware, selectively dense.
- Preserve reduced motion and no-casino aesthetic.
- Freeze expansion of themes/layout presets/density/card variants during the active table phase.

## Deliberately retired

Do not revive without a new approved architecture:

- browser or Electron ONNX strategy runtime
- native preload inference bridge
- remote strategy API
- arbitrary solver-tree upload
- root legacy `training/`, `solver-model/`, or checked-in tree data
- synthetic Training generator/grader
- duplicate Equity worker/evaluator authority
- arbitrary drag-and-drop layout editor

## Current Table / Replay checkpoint

`TABLE-PRESENCE-REF-001` and the `TABLE-PRESENCE-002` implementation checkpoint are **COMPLETED**. The accepted foundation includes pure ephemeral `table-presentation/v1`; deliberate 2–10 player geometry families; stronger Hero/current-actor/relevant/live/folded hierarchy; restrained felt, rail, dealer, pot, and chip physicality; integrated Hero cards and legal-action dock; canonical-bounds sizing; distinct live/completed/Review/Analyze presentation foundations; the visible canonical Replay timeline; and deterministic `selectFrame(frameIndex)` without Hand mutation. It preserves EN/RU/HE, RTL poker geometry, themes/custom themes, density, layout presets, and Premium Card settings.

Verification at this checkpoint is 1,720/1,720 Node tests plus a successful bounded installed-Firefox matrix. Do not infer that every manual matrix is closed: independent hands-on Firefox, 4K/zoom, 1024/1366, Graphite/custom-theme, Analysis Focus/Controls First, and broader 3–9-player visual sampling remain in `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.

`FULL-HAND-REVIEW-001` is **COMPLETED**. Normal Hand and Full-Hand Training now share a decision-by-decision post-hand Review derived from the canonical Hero journal, Replay, StrategyResult, and StrategyClaimPolicy. It uses the explicit pre-action frame convention, source-gated comparison language, non-EV review priority, exact Analyze/Save seams, and cached strategy resolution without introducing a second Hand, Replay, grading, or Saved authority.

`AUDIO-MOTION-001` is **ACTIVE NEXT**, followed by `PREMIUM-CLOSEOUT-001`; later ordering is trusted bounded reference pack/provider, Training Memory/re-drill, Personal Strategy integration, `HOME-002B`, then opponent policies/bots.

## Current development direction

The project is in the bounded audio/motion phase. Strategy integrity, authority, extraction, mathematical integrity, calibration baseline, initial performance, the premium adaptive table foundation, and the shared full-hand learning workflow are checkpointed.

Read `../project/CURRENT_PHASE.md`, `../project/PRODUCT_BACKLOG.md`, `../project/QA_BACKLOG.md`, `../project/PRODUCT_RETURN_QUEUE.md`, and `../project/ROADMAP.md` for the active ticket, ordered future work, and remaining acceptance debt. When an accepted checkpoint changes priority or subsystem state, update those authoritative roadmap/resume/backlog documents together; never create a parallel status system in prompts or chat memory.

## Budget and deployment

- Optional compute/services budget remains approximately US$75 total unless explicitly changed.
- No paid/cloud experiment without explicit cap, runtime, artifact, success and stop criteria.
- Public release is later; product quality and trustworthy study behavior come first.
