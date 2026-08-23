# Current Riverline phase

<<<<<<< Updated upstream
Last refreshed: August 23, 2026 (`ROADMAP-SYNC-003`, current through `PREFLOP-CALIBRATION-001`).
=======
Last refreshed: August 23, 2026 (`TABLE-PRESENCE-002` accepted implementation checkpoint).
>>>>>>> Stashed changes

Code, tests, accepted ticket reports, manual QA, and explicit product decisions override this snapshot. `PRODUCT_BACKLOG.md` preserves detailed future capability; subsystem specs remain authoritative for implementation semantics.

## Status vocabulary

- **COMPLETED** — accepted bounded implementation; later work must be a new ticket.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE** — useful foundation accepted with a defined resume point.
- **ACTIVE NEXT** — next bounded ticket to execute.
- **PLANNED NEXT** — accepted work ordered after the active ticket.
- **PRESERVED FUTURE** — accepted capability without immediate execution commitment.
- **SHELVED FOR LATER** — deliberately paused.
- **OPEN PRODUCT DECISION** — requires explicit later choice.

## Immediate execution order

1. **ACTIVE NEXT — `TABLE-PRESENCE-REF-001`**
   - short competitive-reference / design brief;
   - GTO Wizard primary reference, DTO/PokerSnowie/APT secondary where useful;
   - ADOPT / ADAPT / DIFFERENTIATE / REJECT;
   - implementation-grade scope for table/full-hand/post-hand projection.

<<<<<<< Updated upstream
2. **PLANNED NEXT — `TABLE-PRESENCE-002`**
   - next substantial visible / "fun" build;
   - adaptive HU / sparse / 6-max / full-ring geometry;
   - stronger table scale and seat hierarchy;
   - restrained felt/rail physicality;
   - cards/chips/contributions/dealer marker;
   - action dock hierarchy;
   - live versus completed-hand composition.
=======
The Premium Card System v1 checkpoint remains intact, including its separately tracked Firefox visual acceptance. At the accepted `TABLE-PRESENCE-002` checkpoint, the canonical global Node suite is green at **1,720/1,720 tests**, and `.github/workflows/node-ci.yml` runs the two canonical syntax checks plus the full suite on Node 24 for pushes, pull requests, and manual dispatches.
>>>>>>> Stashed changes

3. **PLANNED NEXT — `FULL-HAND-REVIEW-001` if 002 does not absorb it**
   - visual hand timeline;
   - concise hand-complete state;
   - Review / Replay / Repeat / Save / Next;
   - source-aware truthful review entry.

4. **PLANNED NEXT — `AUDIO-MOTION-001`**
   - semantic poker-world audio/motion events;
   - application motion separate from poker-world motion;
   - reduced-motion and no-casino constraints.

5. **PLANNED NEXT — `PREMIUM-CLOSEOUT-001`**
   - whole-app hierarchy and Core Flow closeout;
   - desktop responsive / themes / density / cards / EN-RU-HE / RTL acceptance;
   - resolve high-value UI QA rather than adding more customization variants.

6. **PLANNED NEXT — first trusted bounded reference pack / provider**
   - exact assumptions, versioning, validation, licensing/provenance, context coverage;
   - heuristic fallback elsewhere.

7. **PLANNED NEXT — Training Memory / re-drill intelligence**

8. **PLANNED NEXT — Personal Strategy integration and review comparison**

9. **PLANNED NEXT — `HOME-002B` Saved Study Library / knowledge workspace**

10. **PRESERVED FUTURE, high strategic value — OpponentPolicy / bots / full-hand bot learning**

Reassess at every clean checkpoint.

## Global baseline and CI — COMPLETED

The canonical Node suite is green at the latest accepted checkpoint: **1,706/1,706 tests** after `PREFLOP-CALIBRATION-001`. Minimal GitHub Actions runs canonical syntax checks plus the full Node suite on Node 24.

Correctness and interaction performance remain distinct gates. Machine-sensitive macro timings stay outside semantic correctness assertions.

## Core product / strategy authorities — COMPLETED foundation

Established invariants:

- canonical `PokerState`, cards, structured actions, legality, accounting, evaluator and Equity under `shared/poker-domain/`;
- Scenario is a truthful lossy study snapshot; Hand is canonical legal state/history;
- one `DecisionContext` strategy snapshot path;
- one `StrategyProvider` / `StrategyResult` strategy path;
- one `StrategyClaimPolicy` decides permitted claims;
- deterministic heuristic fallback is generalized/comparative, never solved-GTO/EV/optimality authority;
- canonical Training generator/session/grading/presentation;
- canonical Equity is separate from heuristic conditional sampling;
- Home versus ClubGG-style accounting remains explicit and separate from strategy truth.

Do not revive browser/Electron ONNX runtime, remote strategy API, arbitrary solver-tree upload, duplicate Equity, or synthetic legacy Training.

## Strategy/reference quality burst — COMPLETED through first evidence-driven calibration

### `REFERENCE-AUTHORITY-001` — COMPLETED

- source identity, provenance, authority, coverage and capabilities separated;
- one claim policy controls comparative/normative/exactness/sizing/EV/optimality language;
- heuristic Training wording is reference-alignment semantics;
- validated future sources can authorize stronger claims only for covered contexts.

Firefox semantic presentation acceptance remains in QA.

<<<<<<< Updated upstream
### `STRATEGY-REPAIR-001A` — COMPLETED

- table-size / position structural repair without broad intuition retuning;
- HU/ring distinction;
- causal deterministic postflop sampling seed;
- missing exact call price no longer fabricates economics;
- unreachable sub-2bb shove branch removed;
- permanent strategy-quality calibration corpus established.

### `DECISION-CONTEXT-001A` — COMPLETED
=======
Accepted checkpoints include `TABLE-PRESENCE-001A`, `REPLAY-001A`, `REPLAY-001B` plus chance-event repair, `REPLAY-001C`, `ui-poker-primitives-001`, `TABLE-PRESENCE-REF-001`, and the accepted `TABLE-PRESENCE-002` implementation checkpoint.

`TABLE-PRESENCE-002` adds the pure ephemeral `table-presentation/v1` projection layer over canonical Hand/Table Presence, Replay, and legal-action facts. It supplies deliberate 2–10 player geometry families; stronger Hero, actor, relevant-opponent, live, and folded-seat hierarchy; restrained felt, two-band rail, dealer, pot, and chip physicality; integrated Hero cards and legal-action dock; a canonical-bounds sizing tray; distinct live, completed, Review, and Analyze presentation foundations; a visible canonical Replay timeline; and deterministic `selectFrame(frameIndex)` without mutating the Hand. EN/RU/HE, RTL-stable poker geometry, existing themes, density, layout presets, and Premium Card customization remain intact. Saved Hands still preserve canonical replay sources rather than renderer frames.

Automated acceptance is **1,720/1,720 Node tests** plus a successful bounded installed-Firefox matrix for representative HU, 6-max, 10-max, completed-hand, and Replay states. This checkpoint does not close the independent hands-on Firefox, 4K/zoom, 1024/1366, Graphite/custom-theme, Analysis Focus/Controls First, or broader 3–9-player visual sampling already owned by `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.

`FULL-HAND-REVIEW-001` now owns the richer decision-by-decision post-hand learning workflow. It must reuse the accepted table projection, timeline, direct seek, hand-complete composition, and Replay integration rather than rebuilding them. `AUDIO-MOTION-001` follows with restrained, reduced-motion-safe feedback; elaborate casino motion, fake 3D, detailed denominations, and ambience remain outside that bounded ticket unless separately approved.
>>>>>>> Stashed changes

DecisionContext v1.1-compatible facts now include:

- starting versus live Hero stack;
- exact current pot (`currentPotBb`) separate from legacy compatibility `potBb`;
- effective stack / per-opponent effective stack;
- postflop position relation including mixed/unknown;
- exact legal call/raise/all-in bounds from canonical legality;
- bounded prior-action summary;
- exact/defaulted/normalized/clamped/unavailable derivation provenance.

Live strategy logic must not use legacy `stackBb` / `potBb` as exact live facts.

### `STRATEGY-REPAIR-001B` — COMPLETED

- postflop consumes live/effective SPR where semantically valid;
- IP/OOP, legal aggression, exact price and bounded history affect the generalized heuristic;
- impossible aggression is removed;
- limp/history and preflop facing families are structurally separated;
- authority remains generalized/comparative;
- known postflop saturation remains reference debt rather than hidden by arbitrary caps.

### `REFERENCE-BENCH-001` — COMPLETED research tooling

Source-agnostic external-reference benchmarking now supports:

- manual/public/licensed/Riverline-owned/independent-solver observations;
- exact/mapped/directional/incomparable context gates;
- raw actions preserved before normalization;
- TVD/dominant/bias/aggregate metrics;
- separate equity semantics and diagnostic hints;
- CLI/manual capture workflow;
- strict proprietary-data boundary.

GTOW manually observed data remains private/local research evidence, never a production pack.

### `PREFLOP-ROLE-001` — COMPLETED

Exact preflop role semantics distinguish, where evidence exists:

- unopened RFI;
- isolation opportunity;
- BB option after limps;
- cold response to open;
- blind-vs-blind response to SB open;
- opened-facing-3bet;
- cold-4bet opportunity;
- three-bettor facing ordinary/cold 4bet;
- opener facing cold 4bet;
- limper facing isolation;
- unclassified deeper aggression.

The actual role is preserved separately from any temporary fallback calibration family.

### `PREFLOP-CALIBRATION-001` — COMPLETED bounded generalized calibration

The first real benchmark showed that the legacy preflop heuristic was effectively one-dimensional inside response families. `PREFLOP-CALIBRATION-001` introduced reusable structural hand features and separate role-facing dimensions:

- `continueValue`;
- `passiveRealization`;
- `aggressionSuitability`.

A bounded six-max BB-vs-BTN ~100bb / ~2.5bb `cold_response_to_open` policy now uses this richer representation. It improved range composition directionally while leaving other roles byte-stable. Source version is preflop heuristic v4; authority remains generalized/comparative.

Remaining reference needs include exact rake/sizing assumptions, wider role/stack/sizing coverage, independently reviewed data/provenance/licensing and true validated reference packs.

## Competitive Reference Gate — ACTIVE PRODUCT RULE

Before substantial user-facing or strategy features when useful:

1. inspect strongest relevant products/references;
2. identify good interaction/strategy conventions and weaknesses;
3. record **ADOPT / ADAPT / DIFFERENTIATE / REJECT**;
4. do not copy proprietary charts, databases, branding, text or assets;
5. competitor behavior informs product decisions but never grants strategy authority.

GTO Wizard is the default high-end benchmark for many table/trainer/matrix/reference UX questions, with DTO, PokerSnowie, Advanced Poker Training and specialized tools used where relevant.

## Table Presence / Replay / poker physicality — foundation COMPLETED, visible vNext ACTIVE

Current foundation includes:

- canonical table presence;
- read-only action/chance timeline;
- deterministic replay projection;
- play/pause and speed;
- on-felt contributions and contribution-to-pot transitions;
- reusable poker-chip primitive;
- reduced-motion-safe restrained movement.

The richer visual branch is **no longer shelved**. It is the active next product phase through `TABLE-PRESENCE-REF-001` then `TABLE-PRESENCE-002`.

Preserve the no-casino aesthetic. Richer physical dealing/chip trajectories and deeper/3D treatment remain later unless the bounded vNext proves they are needed.

## Premium UI / customization — CHECKPOINTED, expansion frozen

Implemented/checkpointed:

- coherent Core Flow/navigation;
- table-centered Hand workspace;
- premium workspace composition;
- Comfortable/Compact density;
- Balanced/Table Focus/Analysis Focus/Controls First layouts;
- Midnight/Daylight/Graphite and named custom themes;
- Riverline color picker;
- Premium Card System v1 including face/back/suit-color variants.

Do not add more theme/layout/density/card variants in the active phase. Integrate the new Table Presence with these systems and finish acceptance.

<<<<<<< Updated upstream
## Personal Strategy — CHECKPOINTED / INTENTIONALLY INCOMPLETE

Completed through the automated checkpoints for Calibration 002D, Range Builder and Range Teacher.
=======
1. **COMPLETED — `TABLE-PRESENCE-REF-001`.** The competitive reference and bounded implementation contract are accepted.
2. **COMPLETED — `TABLE-PRESENCE-002` accepted implementation checkpoint.** Premium adaptive Hand/Table presentation, Replay timeline/direct seek, legal Hero decision composition, projection foundation, localization, automated coverage, and bounded Firefox evidence are present; remaining visual sampling stays in QA/return-queue ownership.
3. **ACTIVE NEXT — `FULL-HAND-REVIEW-001`.** Build the richer decision-by-decision post-hand learning workflow over the accepted table, timeline, direct seek, completion, and Replay seams. Do not create another table or hand-history authority.
4. **PLANNED NEXT — `AUDIO-MOTION-001`.** Add restrained, purposeful feedback with reduced-motion and no-casino constraints after Full Hand Review.
5. **PLANNED NEXT — `PREMIUM-CLOSEOUT-001`.** Reconcile the remaining bounded premium-product acceptance and closeout after Audio/Motion without absorbing unrelated QA debt.
6. **PLANNED NEXT — trusted bounded reference pack/provider.** Validate narrow reference data and declared capabilities behind `StrategyProvider`; do not promote heuristic labels to solver/GTO truth.
7. **PLANNED NEXT — Training Memory / re-drill.** Add canonical persistent mistake/review intelligence and targeted re-drilling before Home consumes it.
8. **PLANNED NEXT — Personal Strategy integration.** Connect the existing evidence authority through declared provider/Training seams without inventing exactness.
9. **PLANNED NEXT — `HOME-002B` Saved Study Library.** Build full Saved Study discovery and drilldowns over the canonical repository.
10. **SHELVED FOR LATER — opponent policies/bots.** Resume only after the higher-priority learning and study-library sequence.

Previously checkpointed account, sync, Home, Home Game, Analysis, and Personal Strategy foundations retain their recorded resume points and external QA debt; they do not displace the explicit sequence above. Reassess at every accepted checkpoint.
>>>>>>> Stashed changes

Locked model:

<<<<<<< Updated upstream
- Profile is a recognizable poker environment/identity;
- exactly three user-named modes per profile;
- dominant quick answer is not implicit 100%;
- exact mixes optional;
- direct/Training contradictions preserved;
- sparse immutable evidence is durable truth;
- inference/uncertainty/conflicts are recomputable read model;
- Matrix/Builder/Teacher consume one evidence authority.
=======
- **Training intelligence:** persistent mistake history, Review Mistakes, targeted/similar-spot re-drilling, spaced/adaptive review, expanded filters, saved drill presets, Concept Mastery, session summaries/trends, Home/Replay integration, profile-aware Training, stated-versus-actual behavior, and explicit per-session opt-in for Training evidence.
- **Range Builder:** combo-level editing, derived Matrix painting, exact overrides, action/frequency painting, partial/unknown support, save/version/compare/export/import, and later approved sharing/forking.
- **Range Teacher / Profiler:** sparse boundary-seeking questions, uncertain-cell targeting, direct-versus-inferred provenance, correction/confirmation, disagreement drills, and reuse of Personal Strategy plus Range Core.
- **Compare Spots:** explain changes in position, stack, pot, call/facing size, board, blockers, hand, opponent count, range assumptions, and profile/mode without unsupported causal claims.
- **Product Lab / UI personalization:** the accepted table foundation and existing layout/density/theme/card systems remain intact; future work is bounded preference refinement, expert workflow, and later deliberate mobile composition rather than another table rebuild. Strategy/study capability remains the priority over endless visual polish.
- **Solver/reference/model:** bounded trustworthy problems, reproducible validated reference data, datasets worth learning, model/interpolation only after evidence, and validated providers behind StrategyProvider with fallback elsewhere. Never train on heuristic labels and call the result solver/GTO truth; cloud/desktop runs require bounded budget/runtime/stop criteria.
- **PLO:** a separate future game domain with four-card hands, exactly-two-hole-card evaluation, its own range/Equity/Training/UI and reference pipeline—not a Hold'em toggle.
- **Gamification:** optional study streaks, daily study, mastery, and goals/progress; no XP/badges/levels merely for engagement.
- **Mobile/public release:** deliberate mobile composition, packaging/release, hosting, offline/cache policy, privacy/legal review, and telemetry only if explicitly approved.
>>>>>>> Stashed changes

**Resume at:** `002R` independent review plus remaining Firefox visual matrices.

After Training/reference maturity: add Personal Strategy provider/comparison adapter, explicit Training evidence opt-in, intended/reference/observed comparison and later postflop propagation.

## Training — canonical base COMPLETED, intelligence PRESERVED/PLANNED

Current Training is legal, deterministic and provider-backed.

Next intelligence program after trusted reference work:

- durable DecisionRecord/session history;
- persistent mistake/review queue;
- same/similar spot re-drill;
- spaced/adaptive review;
- filters/saved drills;
- truthful session trends;
- Home/Replay integration;
- profile-aware Training and opt-in Personal Strategy evidence later.

Do not label comparative heuristic disagreement as objective poker correctness.

## Saved / Home — foundation CHECKPOINTED

Saved Hand/Spot and Replay reopening are established. `HOME-002A` / My Riverline is checkpointed with account/sync composition and bounded study previews.

**Future owner:** `HOME-002B` full Saved Study Library after canonical Training/session payloads exist.

Target direction: dense master-detail knowledge workspace for Hands / Spots / Ranges / Drills / Reviews / Sessions as approved payloads arrive.

## Accounts / sync — CHECKPOINTED / external acceptance incomplete

Present foundation:

- persistent local identity;
- Guest semantics;
- Supabase email/password auth/profile;
- legacy claim/start-separate;
- Saved Hand/Spot opt-in sync;
- Personal Strategy/Calibration separate opt-in sync;
- local-first outbox/retry/conflict foundations.

Open release-quality work:

- live migrations/RLS verification;
- two-profile Firefox lifecycle;
- `ACCOUNT-002A2` secure username/password adapter if still desired;
- later recovery/deletion/cross-device preferences/sharing.

This branch remains important but should not displace the current visible-product sequence unless it becomes a security/release blocker.

## Home Game Organizer — CHECKPOINTED / INTENTIONALLY INCOMPLETE

`HOME-GAME-001A` established the separate exact-accounting/session domain.

**Resume at `HOME-GAME-001B`:** roster/edit/archive, correction history, session management polish, import/export decision, Firefox acceptance.

No StrategyProfile/PokerState/Saved Study coupling.

## Analysis / Range Core / Bluff — CHECKPOINTED

- `RANGE-CORE-001` canonical 1,326-combo weighted-range foundation;
- `ANALYSIS-RANGE-001` exact structural made/draw/board/blocker/range facts;
- `BLUFF-001` truthful risk/reward/BE-fold/semibluff/removal facts.

Preserved future: weighted range-vs-range analysis, range/nut distribution/advantage, action-conditioned ranges, deeper blocker/value/bluff interpretation, Compare Spots, postflop propagation.

## Tutorials / i18n / accessibility — CHECKPOINTED foundation

Every future visible feature owns its tutorial update and EN/RU/HE/RTL/accessibility/reduced-motion acceptance. No future giant tutorial catch-up project.

## Opponent policies / bots — PRESERVED FUTURE, elevated product importance

Future architecture should support transparent `OpponentPolicy`-style behavior separate from reference strategy:

- generic archetypes;
- environment-specific policies;
- custom opponent policies;
- Personal Strategy as an opponent mode;
- full-hand bot Training with post-hand review and re-drill continuity.

This branch is not active until Table/Training/reference foundations are mature enough.

## Preserved long-term branches

- first validated reference packs and provider expansion;
- richer Training memory/intelligence;
- Personal Strategy integration;
- Saved Study knowledge workspace;
- opponent policies/bots;
- sharing/social after privacy/versioning maturity;
- deliberate mobile composition;
- release/packaging/privacy/legal;
- optional restrained gamification only if approved;
- PLO as a separate game domain;
- learned model/interpolation only after trustworthy data demonstrates value.

## Open product decisions

- exact first trusted reference-pack family;
- whether username/password login adapter is needed before release;
- Training-evidence opt-in placement/default;
- first OpponentPolicy archetypes and custom-policy UX;
- Saved folders/collections;
- sharing/forking/friends/study groups;
- mobile timing;
- public release/monetization timing;
- PLO priority;
- restrained gamification approval;
- telemetry approval.

## Update rule

<<<<<<< Updated upstream
After an accepted ticket, update this resume map when checkpoint status, active ticket, or priority order changes. Put detailed future capability in `PRODUCT_BACKLOG.md`; keep implementation semantics in subsystem specs; route visual/manual acceptance through `QA_BACKLOG.md`.
=======
After an accepted ticket, update this resume map whenever checkpoint status, the active ticket, or priority order changes. The authoritative roadmap/resume/backlog state moves with the accepted checkpoint; do not create a parallel status system. Put detailed future capability in `PRODUCT_BACKLOG.md`, keep implementation contracts in subsystem specs, and route unresolved visual/manual acceptance through `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.
>>>>>>> Stashed changes
