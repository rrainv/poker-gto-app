# Current Riverline phase

Last refreshed: August 18, 2026 (`RANGE-BUILDER-001` implementation checkpoint).

Code, tests, accepted tags/ticket reports, new manual QA, and explicit user decisions override this snapshot. Detailed future capability is preserved in `PRODUCT_BACKLOG.md`; subsystem contracts remain authoritative for implementation semantics.

## Status vocabulary

- **COMPLETED** — accepted bounded implementation; later work must be a new ticket.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE** — usable or foundational work is accepted, with an explicit resume point.
- **ACTIVE NEXT** — next bounded ticket to execute.
- **PLANNED NEXT** — accepted work ordered after the active ticket.
- **PRESERVED FUTURE** — accepted capability with no immediate execution commitment.
- **SHELVED FOR LATER** — deliberately paused while higher-value foundations proceed.
- **OPEN PRODUCT DECISION** — requires a later explicit product choice.

## Current checkpoint / resume map

### Core, strategy, and stabilization — COMPLETED

Established production authorities and invariants:

- canonical `PokerState`, structured actions, legality, accounting, evaluator, and Equity separation under `shared/poker-domain/`;
- Scenario as a truthful lossy study snapshot versus Hand as a canonical legal state/history;
- `DecisionContext v1`, including distinct `callAmountBb` and `facingSizeBb` semantics;
- one `StrategyProvider v1` / `StrategyResult v1` strategy path;
- deterministic, honestly labelled heuristic fallback—not solved GTO, CFR, Nash, EV, or exploitability evidence;
- converged canonical Training generation, session, grading, and presentation authorities;
- `PERF-001` invocation-count, hidden-surface, reuse, and invalidation guarantees;
- Home versus ClubGG accounting semantics: no Home deduction; ClubGG-style contribution is exactly `0.1bb` per seated player and is outside the contestable pot.

Do not reopen the retired browser/Electron ONNX runtime, remote strategy API, arbitrary solver-tree upload, synthetic legacy Training, or duplicate Equity architecture. Future solver, reference, model, and imported strategy sources enter only behind validated versioned provider contracts.

### Personal Strategy — CHECKPOINTED / INTENTIONALLY INCOMPLETE

**COMPLETED through:** `RANGE-CAL-000`, `RANGE-CAL-001A`, `RANGE-CAL-001B/001BR`, `RANGE-CAL-001C-A`, `RANGE-CAL-UI-001R`, `RANGE-CAL-002A`, `RANGE-CAL-002B`, `RANGE-CAL-002C`, and the automated implementation checkpoints for `RANGE-CAL-002D` and `RANGE-BUILDER-001`.

Accepted foundation:

- Profile means a recognizable poker environment/strategic identity; objective Spot Context remains separate;
- exactly three user-named discrete Modes per profile;
- a quick answer records the dominant/preferred action, never an implicit pure frequency;
- exact mixes are optional, and a tied exact mix truthfully has `dominantAction = null`;
- Training evidence later has distinct provenance and explicit per-session opt-in;
- contradictory direct and Training evidence is preserved rather than silently overwritten;
- local-first, private, exportable, and structurally account-ready data;
- isolated sparse-RFI inference baseline with synthetic holdout evidence and abstention.
- unified source-preserving evidence projection with explicit correction, compatible-head, retraction, and contradiction semantics;
- one deterministic local-graph RFI inference authority with versioned directly-known/high/medium/uncertain/conflicting/unknown estimates, categorical-only inference, 169-estimate snapshots, 002C support facts, and scope cache/application APIs;
- hard-fixture validation over smooth, irregular, gapped, suited/offsuit, pair, direct-conflict, and exact-boundary synthetic targets, including false-high safety, abstention, stability, and runtime.
- deterministic adaptive question value, structurally diverse cold start, boundary/uncertainty/sparsity targeting, repetition control, optional exact-mix refinement facts, truthful category progress, explicit stopping, Skip/Not sure, and resumable Quick/Standard/Deep sessions;
- adaptive-versus-canonical validation at 10/20/30/40/50/75 questions: materially faster structured-boundary discovery and useful coverage, with irregular abstention and 002B high-band safety preserved.
- a compact Personal Strategy Matrix over the shared 169-estimate snapshot, with separate action/status encoding, direct/inferred/uncertain/conflict/unknown inspection, actual evidence and neighbor facts, dominant-only confirmation, exact-mix correction lineage, adaptive-question follow/selection, scope isolation, and EN/RU/HE keyboard/RTL structure.
- a unified class-level Range Builder over that Matrix/evidence authority, with multi-selection, rectangular and paint gestures, dominant/pure/exact bulk commands, explicit Builder provenance/action groups, conflict-safe atomic commits, session history, semantic undo, one-scope invalidation, and immediate adaptive reranking.

`RANGE-CAL-002A` is retained only as a compatibility API and historical evaluator; all decisions delegate to the 002B authority. `RANGE-CAL-002B/002C` synthetic validation proves deterministic mechanics and honest known failure behavior, not poker correctness or real-user uncertainty calibration. Adaptive questioning is the default; the deterministic 169-question loop remains an explicit exhaustive fallback/test path.

`PERSONAL-STRATEGY-ARCH-002` defines the follow-on authority in `UNIFIED_RANGE_INTELLIGENCE_SPEC.md`: immutable sparse evidence remains durable truth; inference/conflicts/uncertainty form a recomputable read model; 169 class baselines plus sparse combo overrides lazily materialize combo action strategies; Range Calibration, Matrix, Builder, and Teacher remain surfaces over that one model. `RANGE-CAL-002D` implements the shared Matrix consumer and `RANGE-BUILDER-001` adds grouped direct editing over it without a database migration, StrategyProvider path, Equity path, Range Core weight write, or eager combo materialization. Human Firefox visual acceptance remains tracked in `QA_BACKLOG.md`.

**Resume at:** `RANGE-TEACHER-001` over the shared evidence/snapshot/selector/Matrix/Builder seams, then `002R` independent review. Complete the separately tracked 002D and Builder human Firefox visual matrices before final visual acceptance.

**PRESERVED FUTURE:** evidence-backed mode relationships/interpolation, StrategyProvider integration, Training-to-profile evidence, postflop range propagation, and Range Builder/Teacher links. Do not redesign the accepted foundation when work resumes.

### Table Presence, Replay, and poker physicality — COMPLETED

Accepted tags/checkpoints: `TABLE-PRESENCE-001A`, `REPLAY-001A`, `REPLAY-001B` plus chance-event repair, `REPLAY-001C`, and `ui-poker-primitives-001`.

Current product includes canonical table presence; a read-only action/chance timeline; deterministic step projection; play/pause and speed; reduced-motion-safe restrained movement; on-felt current-street contributions; truthful contribution-to-pot transitions; and a reusable poker-chip primitive. Saved Hands preserve the canonical replay source, not renderer frames.

**SHELVED FOR LATER:** richer dealer/model or marker presentation, physical card-dealing trajectories, cards traveling from dealer/deck, chips moving from stacks to bets and into the pot, richer chip stacks/denominations, deeper or possibly 3D table treatment, elaborate showdown/reveal motion, and restrained ambience. Preserve the reduced-motion and no-casino aesthetic.

### Saved / Noted Study Objects — COMPLETED

`SAVED-OBJECTS-001` established versioned local-first `SavedStudyObject v1` Hand and Spot objects, IndexedDB persistence, shared annotations/tags/review-later/mistake metadata, ownership/version/export/import boundaries, archive tombstones, and canonical Saved Hand replay sources.

`SAVED-OBJECTS-002` added visible Save Hand / Save Spot, metadata editing, Review later / Mistake, archive, and truthful source-surface saved state.

**PRESERVED FUTURE:** Saved Range, Saved Drill, saved sessions/session review, richer tag/filter/search, history/revisions, account/cloud ownership, and sharing/forking. Add folders/collections only if later usage justifies them. Home/Dashboard is a consumer, never the owner.

### Home / Dashboard — CHECKPOINTED / INTENTIONALLY INCOMPLETE

`HOME-001` provides Continue, Recent, Review, Mistakes, Personal Strategy summary, and Quick Start. Saved Hands open in detached read-only Replay; Saved Spots reopen truthfully; a live Hand is preserved while detached saved content is viewed.

`HOME-002A` evolves this into **My Riverline** with a distinct private Guest composition; authenticated display name/username and aggregate sync state; truthful calibration/live-Hand Continue; bounded Saved/Review/Mistake previews; direct Personal Strategy evidence/contradiction facts; coalesced account/domain invalidation; intentional empty/error states; responsive EN/RU/HE UI; and explicit unsupported Training/Analysis history seams. Home remains a consumer and performs no poker or range computation. Automated acceptance is present; requested Firefox visual acceptance remains pending because no browser instance was available in the implementation environment.

**PRESERVED FUTURE / `HOME-002B`:** full Saved Study Library with View all, search/filter/tags, and bounded drilldowns. Persistent Training/re-drill intelligence and Analysis history require their own canonical persistence tickets before Home may consume them. Module personalization remains later. Streak/mastery belongs only after an explicit gamification decision.

### Account identity and authentication — CHECKPOINTED / INTENTIONALLY INCOMPLETE

`ACCOUNT-001` establishes a persistent opaque local `RiverlineIdentity v1`, central active-identity service, reusable ownership reference, non-destructive legacy owner bindings for Saved Study and Personal Strategy, active-identity query/storage scoping, safe import adoption, explicit preference scope/privacy/conflict/sign-out contracts, an additive Home identity seam, and a minimal truthful EN/RU/HE Settings profile surface.

`ACCOUNT-002A/AR` selects Supabase Auth and adds an injectable provider boundary, email/password sign-in/sign-up, required `AccountProfile v1` (unique normalized username plus Unicode display name), ProviderIdentityMapping v1, explicit rollback-safe legacy-data claim or start-separate flow, Guest sign-out/fail-closed restoration, one persistent-identity action gate, and discoverable header/menu/Account-Profile EN/RU/HE UI. Guest Home issues no account-domain reads; Saved persistence and Range Calibration promote to sign-in and resume only after a validated account. Existing linked Riverline, Saved, Replay, and Personal Strategy IDs remain stable.

Local/offline Riverline remains first-class. Signing in does not upload study data or enable backup. OAuth/magic-link/deep-link recovery, provider-to-provider linking, remote deletion, local forgetting, cross-device preferences, Training-history sync, and later approved sharing/social features remain future. Provider IDs and credentials stay outside user domain objects.

`ACCOUNT-002B-A` adds explicit identity-scoped opt-in for Saved Hand / Saved Spot sync only: a reusable versioned coordinator/transport boundary, separate IndexedDB sidecar and coalesced outbox, Supabase JSONB schema/RLS/RPC migration, bounded pull cursor, retry/idempotency, archive tombstones, generation-token account isolation, compact account status/manual sync, and explicit keep-device/keep-cloud/keep-both conflict UX. Local writes remain authoritative and cold remote Saved Hands reopen through canonical detached Replay. Deterministic fake-adapter tests are complete; applying `202608170002_saved_study_object_sync.sql` and the full two-browser Firefox lifecycle remain required before acceptance.

`ACCOUNT-002B-B` adds a separately consented Personal Strategy / Range Calibration sync domain behind the reusable transport. It stores profile/mode metadata relationally, keeps direct range and opted-in Training observations immutable, preserves divergent direct histories, excludes inferred artifacts, merges calibration sessions by stable evidence references, and surfaces only metadata conflicts that require a choice. Guest/account switching cancels work before repositories change. Deterministic cold-device, offline contradiction, metadata conflict, identity-isolation, import/export, RLS-structure, and status-aggregation coverage is complete. Applying `202608170003_personal_strategy_sync.sql` and the requested two-profile Firefox lifecycle remain required before final acceptance.

The bounded Accounts v1 implementation is now functionally present: Guest Mode, authentication/profile UX, legacy claim, identity isolation, Saved sync, Personal Strategy / Range Calibration sync, offline queues, and conflict-safe reconciliation. Live Supabase migrations/RLS checks and web multi-device acceptance remain tracked in QA, so this checkpoint does not claim those external checks were performed.

### Tutorials — CHECKPOINTED

`TUTORIAL-001/002` provide the reusable tutorial foundation and current-app coverage for Home, Scenario, Hand, Replay, Matrix, Analysis, Range Comparison, Equity, Training, Range Calibration, Settings, and truthful Saved contexts through reused flows. Guide remains the persistent reference rather than owning a tour.

Every future meaningful visible feature, mode, or workspace owns its tutorial definition/update, semantic anchors, EN/RU/HE copy, RTL/accessibility/reduced-motion coverage, and relevant acceptance inside that feature ticket. Preserve the what/how/why teaching style, subtle first-use offers, skip, and restart. There should be no future giant tutorial catch-up project.

### Canonical Range Core — COMPLETED

`RANGE-CORE-001` establishes:

```text
52 canonical cards
        -> 1,326 canonical unordered combos
        -> HoldemWeightedRange v1
        -> blockers / normalization / derived 13x13 Matrix projection
```

Locked semantics: unknown is not known zero; range weight is not probability, action frequency, or confidence; combo mass is not combo count; the Matrix is derived presentation rather than canonical truth; provenance remains explicit.

**PRESERVED FUTURE CONSUMERS:** richer Analysis, Bluffing, Range Builder, Range Teacher, Personal Strategy, Training, Compare Spots, Saved Ranges, validated provider/reference/solver data, and sharing.

### Richer Analysis — CHECKPOINTED

`ANALYSIS-RANGE-001`, including its RR/RRR corrections, establishes `RangeAnalysisFacts v1`: exact made-hand relationships, draw taxonomy, board structure, blockers, optional canonical supplied-range composition, explicit complete/partial/unknown state, distinct physical combo count/known combo count/known combo mass, and grouped provenance.

Structural draw/outs support includes flush and straight outs; gutshot/OESD/double-gutshot; direct straight-flush draws and geometry; Royal, wheel, and Broadway subtypes; de-duplicated overlapping outs; direct-improvement-card union; dead-card removal; and no Equity claim from outs. It does not invent range/nut advantage, EV, solver frequencies, or a missing current range.

Implementation is accepted; `QA-ANALYSIS-RANGE-001` still records final live viewport/theme/language acceptance honestly.

`BLUFF-001` adds immutable DOM-free `BluffAnalysisFacts v1` after Range Analysis: exact risk/reward and pure-bluff break-even folds when action semantics are trusted; truthful unavailable raise/all-in states; all-opponents-fold multiway wording; structural semibluff classification with unchanged draw outs; neutral range-free removal; exact supplied-range removal; and a simplified heads-up river bluff:value reference. It does not infer opponent fold frequency, action EV, optimal bluffing, solver truth, or strategic blocker quality without an explicit semantic partition. Current postflop heuristic actions remain unsized, so live economics are unavailable until a trusted size is supplied; StrategyProvider behavior is unchanged.

`QA-ANALYSIS-BLUFF-001` records the remaining human visual/language acceptance.

**PRESERVED FUTURE:** weighted Hero-range versus Villain-range analysis, legitimate range/nut distribution and advantage, action-conditioned ranges, deeper blocker/unblocker interpretation, richer board interaction, personalized Analysis, Compare Spots, value/bluff composition, and postflop range propagation.

## Active and planned execution

1. **COMPLETED — `ANALYSIS-RANGE-001` checkpoint:** range-aware Analysis v1 and RR/RRR corrections are at the accepted `analysis-range-001` tag.
2. **COMPLETED — `PREFLOP-SANITY-001`: Premium Dominated-Action Suppression.** The bounded premium Fold-leak suppression and invariant corpus are present without broad heuristic retuning or new ICM assumptions.
3. **CHECKPOINTED — `BLUFF-001`: honest bluff analysis.** The structural fact contract, Analysis UI, EN/RU/HE copy, tutorial update, formula/range/raise/unavailable tests, and documentation are implemented. Final human visual/language acceptance remains tracked separately rather than being inferred from structural tests.
4. **CHECKPOINTED — `ACCOUNT-001` + `ACCOUNT-002A/AR`: local-first identity and real authentication.** Supabase email/password auth, DB-enforced profiles/RLS migration, Guest semantics, durable-feature gating, atomic link/start-separate, account switching, sign-out, restoration, header/profile UX, and truthful no-sync UI are implemented. Live migration/provider validation and final human Firefox visual/language acceptance remain separate from structural verification. Secure username/password login is the immediate `ACCOUNT-002A2` follow-up, not a client-side lookup.
5. **CHECKPOINTED / INTENTIONALLY INCOMPLETE — `ACCOUNT-002B-A`: Saved Study sync.** Implementation, deterministic fake-adapter coverage, migration, EN/RU/HE structure, and documentation are present. Live migration/RLS verification plus two-profile Firefox lifecycle/manual visual acceptance remain open.
6. **PLANNED NEXT — `ACCOUNT-002A2`: secure username/password login adapter.** Add a rate-limited trusted server/Edge Function path with private username resolution, enumeration-resistant errors, and no renderer secret or public username-to-email directory. Email/password remains the production sign-in path until that bounded ticket is deployed and verified.
7. **CHECKPOINTED / INTENTIONALLY INCOMPLETE — `ACCOUNT-002B-B`: Personal Strategy / Range Calibration sync.** Domain adapters, relational migration, immutable-history/session reconciliation, separate consent, account cancellation, UI, i18n, documentation, and deterministic coverage are present. Live migration/RLS and two-profile Firefox acceptance remain open.
8. **CHECKPOINTED / INTENTIONALLY INCOMPLETE — `HOME-002A`: My Riverline.** Account-aware Home v2 is implemented with truthful Guest/account composition, sync/identity isolation, bounded study summaries, tutorial/i18n/accessibility coverage, and no fabricated history or heavy computation. Firefox visual/manual acceptance remains open.
9. **CHECKPOINTED / INTENTIONALLY INCOMPLETE — `HOME-GAME-001A`: Home Game foundation.** A separate versioned DOM-free domain now owns players, saved groups, sessions/seats, exact minor-unit money, append-only ledger/corrections, chip snapshots, lifecycle, balance validation, and deterministic settlement. Account-scoped IndexedDB and explicit Guest-memory behavior are implemented behind an application service, with a bounded top-level EN/RU/HE web workspace. It has no `PokerState`, StrategyProvider, Saved Study, or Personal Strategy coupling. Automated invariant/persistence/UI-structure acceptance is present; requested Firefox viewport/language acceptance remains open. Resume at `HOME-GAME-001B` for roster/correction-history/session-management UX hardening and live browser acceptance before cloud/mobile work.

Reassess priorities at every clean checkpoint rather than forcing an entire branch through without review.

## Preserved future branches

- **Training intelligence:** persistent mistake history, Review Mistakes, targeted/similar-spot re-drilling, spaced/adaptive review, expanded filters, saved drill presets, Concept Mastery, session summaries/trends, Home/Replay integration, profile-aware Training, stated-versus-actual behavior, and explicit per-session opt-in for Training evidence.
- **Range Builder:** combo-level editing, derived Matrix painting, exact overrides, action/frequency painting, partial/unknown support, save/version/compare/export/import, and later approved sharing/forking.
- **Range Teacher / Profiler:** sparse boundary-seeking questions, uncertain-cell targeting, direct-versus-inferred provenance, correction/confirmation, disagreement drills, and reuse of Personal Strategy plus Range Core.
- **Compare Spots:** explain changes in position, stack, pot, call/facing size, board, blockers, hand, opponent count, range assumptions, and profile/mode without unsupported causal claims.
- **Product Lab / UI personalization:** safe layout presets, comfortable/compact density, card sizing, beginner/expert modes, curated themes, workspace persistence/reset, expert keyboard workflow, later deliberate mobile composition, and a richer visual-table branch. Strategy/study capability remains the priority over endless visual polish.
- **Solver/reference/model:** bounded trustworthy problems, reproducible validated reference data, datasets worth learning, model/interpolation only after evidence, and validated providers behind StrategyProvider with fallback elsewhere. Never train on heuristic labels and call the result solver/GTO truth; cloud/desktop runs require bounded budget/runtime/stop criteria.
- **PLO:** a separate future game domain with four-card hands, exactly-two-hole-card evaluation, its own range/Equity/Training/UI and reference pipeline—not a Hold'em toggle.
- **Gamification:** optional study streaks, daily study, mastery, and goals/progress; no XP/badges/levels merely for engagement.
- **Mobile/public release:** deliberate mobile composition, packaging/release, hosting, offline/cache policy, privacy/legal review, and telemetry only if explicitly approved.

## Preserved cross-surface card semantics

**PRESERVED FUTURE — `UI-CARD-SEMANTICS-001`:** raw internal card IDs such as `As` or `5h` should not normally be user-facing. Visible Analysis outs/blockers, Replay, Saved summaries, Training, Matrix/range inspection, Bluffing, and tutorials should use proper suit notation such as `A♠` / `5♥` or Riverline card tokens/mini-cards.

**PRESERVED FUTURE — Card Outcome Preview:** when a concrete out/completion/combo card is interactive, hover and keyboard focus may open a reusable anchored preview showing the actual resulting canonical best five (including kickers), with the canonical made-hand headline. Evaluate the exact post-card state through the canonical evaluator and consume `bestFiveCards`; renderers must not construct rankings. Touch/click behavior remains an **OPEN PRODUCT DECISION**.

Examples: a `5♥` completion may preview `A♥ 2♥ 3♥ 4♥ 5♥ — Wheel straight flush`; an `A♦` pairing card must show the actual best pair plus its three real kickers rather than a generic pair label.

## Open product decisions

- exact Personal Strategy mode naming/order defaults and whether evidence ever supports interpolation;
- final Training-evidence opt-in placement/default and conflict-clarification UX;
- ACCOUNT-002A2 secure rate-limited server-side username/password login adapter, with enumeration-resistant errors and no username-to-email directory;
- ACCOUNT-002B-B Personal Strategy / Range Calibration remote schema and domain-specific conflict-resolution UX;
- sharing permissions, clone/fork defaults, comments, friends, and study groups;
- Training grading default when My Strategy and a Riverline reference differ;
- first Home Game Organizer scope beyond the staged foundation;
- eventual monetization/public-release timing and PLO priority;
- whether restrained streak/mastery features are approved;
- touch/click behavior for reusable card outcome previews.

## Update rule

After an accepted ticket, update this resume map only when checkpoint status, the active ticket, or priority order changes. Put detailed future capability in `PRODUCT_BACKLOG.md`, keep implementation contracts in subsystem specs, and route unresolved visual/manual acceptance through `QA_BACKLOG.md`.
