# Current Riverline phase

Last refreshed: August 17, 2026 (`ACCOUNT-002AR` correction checkpoint).

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

**COMPLETED through:** `RANGE-CAL-000`, `RANGE-CAL-001A`, `RANGE-CAL-001B/001BR`, `RANGE-CAL-001C-A`, `RANGE-CAL-UI-001R`, and `RANGE-CAL-002A`.

Accepted foundation:

- Profile means a recognizable poker environment/strategic identity; objective Spot Context remains separate;
- exactly three user-named discrete Modes per profile;
- a quick answer records the dominant/preferred action, never an implicit pure frequency;
- exact mixes are optional, and a tied exact mix truthfully has `dominantAction = null`;
- Training evidence later has distinct provenance and explicit per-session opt-in;
- contradictory direct and Training evidence is preserved rather than silently overwritten;
- local-first, private, exportable, and structurally account-ready data;
- isolated sparse-RFI inference baseline with synthetic holdout evidence and abstention.

`RANGE-CAL-002A` is research evidence, not live product inference or real-user validation. Its support difference is neither confidence nor action frequency. The deterministic 169-question loop remains fallback/test infrastructure, not the intended final experience.

**Resume at:** `RANGE-CAL-002B` confidence/validation, then `002C` boundary detection/next-best question/automatic stopping, `002D` direct/inferred/uncertain Matrix presentation, and `002R` independent review.

**PRESERVED FUTURE:** evidence-backed mode relationships/interpolation, StrategyProvider integration, Training-to-profile evidence, postflop range propagation, and Range Builder/Teacher links. Do not redesign the accepted foundation when work resumes.

### Table Presence, Replay, and poker physicality — COMPLETED

Accepted tags/checkpoints: `TABLE-PRESENCE-001A`, `REPLAY-001A`, `REPLAY-001B` plus chance-event repair, `REPLAY-001C`, and `ui-poker-primitives-001`.

Current product includes canonical table presence; a read-only action/chance timeline; deterministic step projection; play/pause and speed; reduced-motion-safe restrained movement; on-felt current-street contributions; truthful contribution-to-pot transitions; and a reusable poker-chip primitive. Saved Hands preserve the canonical replay source, not renderer frames.

**SHELVED FOR LATER:** richer dealer/model or marker presentation, physical card-dealing trajectories, cards traveling from dealer/deck, chips moving from stacks to bets and into the pot, richer chip stacks/denominations, deeper or possibly 3D table treatment, elaborate showdown/reveal motion, and restrained ambience. Preserve the reduced-motion and no-casino aesthetic.

### Saved / Noted Study Objects — COMPLETED

`SAVED-OBJECTS-001` established versioned local-first `SavedStudyObject v1` Hand and Spot objects, IndexedDB persistence, shared annotations/tags/review-later/mistake metadata, ownership/version/export/import boundaries, archive tombstones, and canonical Saved Hand replay sources.

`SAVED-OBJECTS-002` added visible Save Hand / Save Spot, metadata editing, Review later / Mistake, archive, and truthful source-surface saved state.

**PRESERVED FUTURE:** Saved Range, Saved Drill, saved sessions/session review, richer tag/filter/search, history/revisions, account/cloud ownership, and sharing/forking. Add folders/collections only if later usage justifies them. Home/Dashboard is a consumer, never the owner.

### Home / Dashboard — COMPLETED

`HOME-001` provides Continue, Recent, Review, Mistakes, Personal Strategy summary, and Quick Start. Saved Hands open in detached read-only Replay; Saved Spots reopen truthfully; a live Hand is preserved while detached saved content is viewed.

**PRESERVED FUTURE:** evolve Home into “my Riverline” with full Saved drilldowns/View all, filtering/search/tags, recent Analysis, Training history, mistake/re-drill queues, account/profile identity and sync status, Personal Strategy progress, bluff/range-study shortcuts, session history, and personalization. Streak/mastery belongs only after an explicit gamification decision. Do not add fake analytics to fill space.

### Account identity and authentication — CHECKPOINTED / INTENTIONALLY INCOMPLETE

`ACCOUNT-001` establishes a persistent opaque local `RiverlineIdentity v1`, central active-identity service, reusable ownership reference, non-destructive legacy owner bindings for Saved Study and Personal Strategy, active-identity query/storage scoping, safe import adoption, explicit preference scope/privacy/conflict/sign-out contracts, an additive Home identity seam, and a minimal truthful EN/RU/HE Settings profile surface.

`ACCOUNT-002A/AR` selects Supabase Auth and adds an injectable provider boundary, email/password sign-in/sign-up, required `AccountProfile v1` (unique normalized username plus Unicode display name), ProviderIdentityMapping v1, explicit rollback-safe legacy-data claim or start-separate flow, Guest sign-out/fail-closed restoration, one persistent-identity action gate, and discoverable header/menu/Account-Profile EN/RU/HE UI. Guest Home issues no account-domain reads; Saved persistence and Range Calibration promote to sign-in and resume only after a validated account. Existing linked Riverline, Saved, Replay, and Personal Strategy IDs remain stable.

Local/offline Riverline remains first-class. Signing in does not upload study data or enable backup. OAuth/magic-link/deep-link recovery, provider-to-provider linking, remote deletion, local forgetting, cloud backup/sync, cross-device preferences, domain-specific conflict resolution, and later approved sharing/social features remain future. Provider IDs and credentials stay outside user domain objects.

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
5. **ACTIVE NEXT — `ACCOUNT-002A2`: secure username/password login adapter.** Add a rate-limited trusted server/Edge Function path with private username resolution, enumeration-resistant errors, and no renderer secret or public username-to-email directory. Email/password remains the production sign-in path until that bounded ticket is deployed and verified.
6. **ACTIVE NEXT — richer Home:** substantially extend “my Riverline” using real account/personal/study state while keeping Home a consumer.
7. **PLANNED NEXT — Home Game Organizer:** create a separate top-level tab/domain. Stage as `HOME-GAME-001` domain/persistence, `HOME-GAME-002` session UI, and `HOME-GAME-003` settlement/reconciliation. It may own saved groups, roster/seats/button/blinds, buy-ins/rebuys/cash-outs, chip counts/stacks, net results, who-owes-whom settlement, saved sessions, and summaries. It does not belong in `StrategyProfile` or `PokerState`.

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
- ACCOUNT-002B cloud-sync opt-in, backend schema, and domain-specific conflict-resolution UX;
- sharing permissions, clone/fork defaults, comments, friends, and study groups;
- Training grading default when My Strategy and a Riverline reference differ;
- first Home Game Organizer scope beyond the staged foundation;
- eventual monetization/public-release timing and PLO priority;
- whether restrained streak/mastery features are approved;
- touch/click behavior for reusable card outcome previews.

## Update rule

After an accepted ticket, update this resume map only when checkpoint status, the active ticket, or priority order changes. Put detailed future capability in `PRODUCT_BACKLOG.md`, keep implementation contracts in subsystem specs, and route unresolved visual/manual acceptance through `QA_BACKLOG.md`.
