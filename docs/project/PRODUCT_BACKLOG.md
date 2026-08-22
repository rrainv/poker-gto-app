# Riverline Product and Feature Backlog

Last consolidated: August 18, 2026 (`RANGE-TEACHER-001` implementation checkpoint).

This file preserves accepted future capability so it does not depend on chat memory and is not implemented opportunistically. `CURRENT_PHASE.md` is the authoritative checkpoint/resume map and delivery order; subsystem specifications own implementation semantics.

## Status vocabulary

- **COMPLETED**
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE**
- **ACTIVE NEXT**
- **PLANNED NEXT**
- **PRESERVED FUTURE**
- **SHELVED FOR LATER**
- **OPEN PRODUCT DECISION**

## Current delivery ordering

| Order | Status | Ticket / outcome |
|---:|---|---|
| 1 | COMPLETED | `ANALYSIS-RANGE-001` accepted checkpoint, including RR/RRR corrections |
| 2 | COMPLETED | `PREFLOP-SANITY-001` — bounded premium-hand dominated Fold suppression with invariant coverage |
| 3 | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `BLUFF-001` — structural fact contract and visible Analysis integration implemented; final human visual/language acceptance remains open |
| 4 | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `ACCOUNT-001` + `ACCOUNT-002A/AR` — legacy-safe identity/scoping, Supabase email/password, DB-enforced account profiles, Guest semantics, durable-feature gate, header/profile UX, explicit claim/start-separate, switching/sign-out/session restoration |
| 5 | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `ACCOUNT-002B-A` — explicit Saved Hand/Spot sync, local-first outbox/retry, Supabase RLS/RPC, tombstones, account isolation, conflict UX; live migration and two-browser Firefox acceptance remain open |
| 6 | PLANNED NEXT | `ACCOUNT-002A2` — secure rate-limited server/Edge Function username/password login adapter; private resolution, enumeration-resistant failure, no renderer secret or public username-to-email directory |
| 7 | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `ACCOUNT-002B-B` — separately consented Personal Strategy / Range Calibration sync, immutable evidence/contradiction preservation, session reconciliation, relational RLS/RPC schema, and account isolation are implemented; live Supabase and Firefox acceptance remain open |
| 8 | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `HOME-002A` — My Riverline powered by real account, sync, Saved, Personal Strategy, and calibration state; Firefox visual acceptance remains open |
| 9 | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `HOME-GAME-001A` standalone exact-accounting/persistence foundation plus bounded session/settlement workspace; Firefox acceptance and management UX hardening continue in `001B` |

Personal Strategy resumes at independent review `002R`; 002D supplies snapshot-derived Matrix inspection/correction, Builder supplies grouped class-level direct editing/undo, and Teacher supplies deterministic explanation plus focused Calibration routing over the same 002B evidence authority and 002C question/boundary facts. Human Firefox visual acceptance remains tracked separately. Reassess at every clean checkpoint.

## Checkpointed foundations and explicit resume points

| Subsystem | Status | Resume / future owner |
|---|---|---|
| Personal Strategy through `RANGE-TEACHER-001` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Unified evidence/correction/conflict projection, categorical estimates, adaptive questioning/stopping, compact Matrix inspection, atomic class-level Builder editing/undo, and derived Teacher profiling are implemented without a second authority. Resume `002R`; complete 002D/Builder/Teacher human Firefox visual acceptance separately, then evidence-backed mode relationships, provider and Training integration |
| `PERSONAL-STRATEGY-ARCH-002` | COMPLETED architecture contract | `UNIFIED_RANGE_INTELLIGENCE_SPEC.md` defines one evidence-derived action-strategy model for Calibration, Matrix, Builder, and Teacher; no production implementation or schema migration is implied |
| Table Presence / Replay / poker-chip primitive | COMPLETED | Richer physical table visuals are SHELVED FOR LATER |
| Saved Hands/Spots through `SAVED-OBJECTS-002` | COMPLETED | New payload tickets for Saved Range, Drill, or Session; richer library/history/account/sharing later |
| Home through `HOME-002A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Firefox acceptance, then `HOME-002B` full Saved Study Library/drilldowns |
| Tutorials foundation/current-app coverage | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Every future meaningful visible feature owns its tutorial update; no broad catch-up epic |
| `RANGE-CORE-001` | COMPLETED | Adopt deliberately in future combo-aware consumers |
| `ANALYSIS-RANGE-001` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Live QA remains in `QA_BACKLOG.md`; deeper range-vs-range/value-bluff work uses new tickets |

## Bluffing and analysis

| ID | Status | Preserved scope |
|---|---|---|
| `PREFLOP-SANITY-001` | COMPLETED | Bounded premium Fold-leak suppression is implemented with invariant coverage; no broad intuition retuning or new ICM/satellite assumptions |
| `BLUFF-001` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `BluffAnalysisFacts v1`, exact trusted risk/reward and break-even folds, truthful raise/all-in unavailability, multiway joint-fold wording, structural semibluff/outs reuse, neutral blocker facts, exact supplied-range removal, simplified heads-up river reference, compact UI, tutorial, and EN/RU/HE integration are implemented. Human visual/language acceptance remains open; current unsized postflop heuristic actions do not fabricate economics |
| `ANALYSIS-RANGE-002+` | PRESERVED FUTURE | weighted Hero range vs Villain range; legitimate range/nut distribution and advantage; action-conditioned ranges; deeper blocker/unblocker interpretation; board interaction; personalized Analysis; value/bluff composition; postflop propagation |
| Compare Spots | PRESERVED FUTURE | compare position, stack, pot, call/facing size, board, blockers, hand, opponents, range assumptions, and profile/mode; explain only relationships supported by trusted facts |

`BLUFF-001` must not derive opponent fold frequency, EV, “optimal bluff,” solver frequency, or good/bad blocker verdicts from a generic range. Blocker quality needs a trustworthy continuing/value/bluff partition or another relevant strategic source.

## Range and Personal Strategy tools

| Capability | Status | Preserved scope |
|---|---|---|
| Range Builder | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `RANGE-BUILDER-001` implements the Personal Strategy class editor over shared evidence/snapshots: multi-selection and painting, dominant/pure/exact actions, partial/unknown state, explicit Builder provenance/action groups, conflict skip, atomic undo, adaptive interoperability, and no 1,326-entry write explosion. Human Firefox acceptance remains open; sparse canonical-combo overrides and general Saved Range editing require later approved schemas |
| Range Teacher / Profiler | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `RANGE-TEACHER-001` implements deterministic boundary/sparse/conflict/exact-mix recommendations, source-derived progress/recent changes, optional session-local dismissal, and focused biases through the existing 002C/Calibration/Matrix/Builder paths. Human Firefox acceptance and future writable conflict resolution/richer history remain open; it does not duplicate Training grading |
| Range-vs-range tools | PRESERVED FUTURE | combo-aware blockers, weighted category analysis, legitimate Equity integration through an approved versioned weighted-opponent boundary |
| Personal Strategy integration | PRESERVED FUTURE | sparse evidence is durable authority; derived class baselines plus sparse combo overrides are recomputable and not synced; StrategyProvider source only after quantitative/qualitative result-contract validation; Training evidence remains explicit per-session opt-in; postflop range propagation later |
| Saved Ranges | PRESERVED FUTURE | versioned SavedStudyObject payload, compare/export/import, later account ownership and sharing |

The canonical range chain remains 52 cards → 1,326 unordered combos → `HoldemWeightedRange v1` → derived blocker/normalization/Matrix views. Personal action strategy is a separate vector-valued read model derived from evidence; an action-conditioned weighted range is valid only from a known prior inclusion range and exact action frequencies. Unknown is not zero, and weight/mass/count/probability/frequency/confidence remain distinct. See `UNIFIED_RANGE_INTELLIGENCE_SPEC.md`.

## Training intelligence

| Capability | Status |
|---|---|
| persistent mistake history and Review Mistakes | PRESERVED FUTURE |
| targeted re-drilling, similar spots, spaced/adaptive review | PRESERVED FUTURE |
| expanded filters and saved drill presets | PRESERVED FUTURE |
| Concept Mastery, session summaries, and performance trends | PRESERVED FUTURE |
| Home Review and Replay integration | PRESERVED FUTURE |
| profile-aware Training and stated-range vs actual-behavior comparison | PRESERVED FUTURE |
| Training evidence → Personal Strategy with explicit per-session opt-in | PRESERVED FUTURE |

The current legal, deterministic, provider-backed Training base is established; these intelligence and persistence branches are not completed by that foundation.

## Saved study, Home, and account platform

| Capability | Status | Notes |
|---|---|---|
| Saved Range / Saved Drill / saved sessions | PRESERVED FUTURE | New versioned payloads; no parallel persistence models |
| richer Saved search/filter/tags | PRESERVED FUTURE | Full drilldowns/View all; folders/collections only if later justified |
| Saved history/revisions | PRESERVED FUTURE | Preserve ownership/version/conflict semantics |
| `ACCOUNT-001` + `ACCOUNT-002A/AR` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | persistent opaque identity/scoped storage plus Supabase Auth mapping, required unique-username/Unicode-display-name profile with RLS, Guest no-history semantics, reusable persistence gate, discoverable header/profile UX, rollback-safe legacy claim or separate account, switching/sign-out, bounded restore, and no-sync copy; live-provider/manual acceptance remains tracked in QA |
| `ACCOUNT-002A2` | PLANNED NEXT | secure username/password login adapter deployed behind a rate-limited trusted server/Edge Function; private normalized-username resolution, enumeration-resistant errors, no public username→email lookup, no password or privileged key outside the trusted auth path |
| `ACCOUNT-002B-A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | explicit opt-in Saved Hand/Spot sync is implemented with a reusable transport/coordinator, durable sidecar/outbox, Supabase schema/RLS/RPCs, retries, tombstones, account cancellation, compact status/manual action, three-choice conflict recovery, and cold remote Replay; live migration and Firefox lifecycle acceptance remain open |
| `ACCOUNT-002B-B` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Personal Strategy / Range Calibration sync reuses transport/outbox/retry while owning relational profile/mode serialization, immutable evidence/retraction/contradiction preservation, inferred-artifact exclusion, calibration-session merge, separate consent, and metadata conflicts. The bounded Accounts v1 implementation is functionally present; live Supabase/RLS and Firefox multi-device acceptance remain open |
| sharing/social | PRESERVED FUTURE | share/fork ranges, spots, and drills; friends/study groups; collaborative range review only if approved |
| `HOME-002A` My Riverline | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest/account composition, identity and aggregate sync status, truthful Continue, Saved/Recent/Review/Mistakes, direct Personal Strategy facts, tutorial, future Training/Analysis seams; Firefox acceptance pending |
| `HOME-002B` Saved Study Library | PRESERVED FUTURE | Full View all destination, bounded drilldowns, search/filter/tags; reuse the canonical SavedStudyObject repository |
| Training/Analysis Home history | PRESERVED FUTURE | Consume only after canonical persistence exists; no fake accuracy, mastery, streak, or recent-analysis history |

Riverline remains local-first and useful offline. Home is a consumer of user domains, never their owner. Do not invent analytics merely to make Home busy.

## Home Game Organizer

This is a separate top-level tab and domain, not part of `StrategyProfile` or `PokerState`.

| Ticket | Status | Scope |
|---|---|---|
| `HOME-GAME-001A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | standalone v1 players/groups/sessions, exact minor-unit ledger, append-only corrections, chip snapshots, lifecycle, balance rejection, deterministic settlement, account-scoped IndexedDB, Guest memory semantics, and bounded top-level EN/RU/HE workspace |
| `HOME-GAME-001B` | PLANNED NEXT | saved-player reuse/edit/archive, visible correction/reversal history, session archive/delete confirmation, group/session management polish, import/export decision, and Firefox desktop/language acceptance |
| richer organizer tools | PRESERVED FUTURE | optional button advance/blind timer, richer chip tools, player history, recurring games, payment links, and tournament mode only behind separate accounting semantics |
| live/mobile sharing | PRESERVED FUTURE | much later, after account and organizer foundations |

The exact first shipped scope remains an **OPEN PRODUCT DECISION** at ticket planning.

## Product Lab and table presentation

| Capability | Status | Preserved scope |
|---|---|---|
| layout presets | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Balanced plus workspace-curated Table Focus, Analysis Focus, and Controls First are implemented as density-independent per-workspace presentation preferences with safe 1024 convergence and no custom layout serializer; final human Firefox acceptance remains open |
| density and sizing | PRESERVED FUTURE | Comfortable/Compact density and card sizing |
| beginner/expert modes | PRESERVED FUTURE | simpler guided presentation vs denser provenance/frequency/keyboard workflow |
| themes/preferences | PRESERVED FUTURE | curated themes and safe workspace persistence/reset; no arbitrary drag/drop serializer |
| expert keyboard workflow | PRESERVED FUTURE | deliberate shortcuts and fast study operation |
| richer table visuals | SHELVED FOR LATER | richer dealer/marker, physical dealing/card paths, stack-to-bet and pot-collection chip motion, denominations/stacks, table depth/3D, showdown/reveal motion, restrained ambience |
| mobile composition | PRESERVED FUTURE | deliberate mobile product, not compressed desktop |

Preserve reduced motion, analytical clarity, and the no-casino aesthetic. Do not let endless visual polish displace strategy/study capability.

## Card semantics and reusable outcome preview

| ID | Status | Preserved scope |
|---|---|---|
| `UI-CARD-SEMANTICS-001` | PRESERVED FUTURE | replace normally visible raw IDs (`As`, `5h`) with suit glyph notation (`A♠`, `5♥`) or Riverline card tokens/mini-cards across Analysis, Replay, Saved summaries, Training, Matrix/range inspection, Bluffing, and tutorials |
| Card Outcome Preview | PRESERVED FUTURE | hover/keyboard-focus anchored preview for an exact out/completion/combo card; show canonical resulting best five, actual kickers, and canonical made-hand headline; consume evaluator `bestFiveCards`; no renderer ranking math |
| touch/click preview behavior | OPEN PRODUCT DECISION | define when the reusable interaction reaches touch surfaces |

## Solver, reference, model, PLO, release, and optional gamification

| Branch | Status | Preserved path |
|---|---|---|
| solver/reference/model | PRESERVED FUTURE | bounded trustworthy problems → reproducible reference data → validation → worthwhile dataset → model/interpolation if justified → validated StrategyProvider → fallback elsewhere |
| compute/cloud experiments | PRESERVED FUTURE | explicit budget/runtime/stop criteria; no unapproved spend; approximately US$75 total optional project budget remains the planning cap |
| PLO | PRESERVED FUTURE | separate four-card domain, exactly-two-hole-card evaluation, range representation, Equity, Training/UI, strategy/reference pipeline |
| gamification | OPEN PRODUCT DECISION | restrained streaks, daily study, mastery, goals/progress may be useful; no XP/badges/levels merely for engagement |
| desktop/public release | PRESERVED FUTURE | reproducible packaging, installer/portable assets, hosting, offline/cache policy, release docs, privacy/legal review |
| telemetry | OPEN PRODUCT DECISION | only if explicitly approved |

Never train on heuristic labels and present the output as solver/GTO truth. A future production model/reference remains a versioned provider behind `StrategyProvider`.

## Pull-forward rule

A preserved item moves earlier only when the user explicitly reprioritizes it or its dependencies are ready and a bounded ticket owns it. Do not absorb future capability merely because a touched file makes it convenient.
