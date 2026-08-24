# Current Riverline phase

Last refreshed: August 24, 2026 (`AUDIO-MOTION-001` accepted implementation checkpoint; `DOCS-INTEGRITY-001` active next).

Code, tests, accepted ticket reports, manual QA, and explicit product decisions override this snapshot. `PRODUCT_BACKLOG.md` preserves detailed future capability; subsystem specs remain authoritative for implementation semantics.

## Status vocabulary

- **COMPLETED** — accepted bounded implementation; later work must be a new ticket.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE** — useful foundation accepted with a defined resume point.
- **ACTIVE NEXT** — next bounded ticket to execute.
- **ACTIVE / FINAL QA CORRECTION** — the current ticket remains the sole active implementation scope pending final human acceptance.
- **PLANNED NEXT** — accepted work ordered after the active ticket.
- **PLANNED LATER** — ordered work that remains behind the immediate planned-next ticket.
- **PRESERVED FUTURE** — accepted capability without immediate execution commitment.
- **SHELVED FOR LATER** — deliberately paused.
- **OPEN PRODUCT DECISION** — requires explicit later choice.

## Immediate execution order

1. **COMPLETED — `TABLE-PRESENCE-REF-001`**

2. **COMPLETED — `TABLE-PRESENCE-002` accepted implementation checkpoint**

3. **COMPLETED — `FULL-HAND-REVIEW-001` implementation checkpoint**
   - one shared Hand/Full-Hand Training review projection and surface;
   - canonical Hero-decision journal extraction and explicit pre-action Replay frame convention;
   - source-gated mixed-frequency comparison, compact provenance, and non-EV review priority;
   - exact existing Analyze, Save Hand/Spot, Replay, Repeat, and Next seams;
   - EN/RU/HE, RTL, responsive/density, accessibility, reduced-motion, and bounded strategy cache coverage.

4. **COMPLETED — `AUDIO-MOTION-001` accepted implementation checkpoint**
   - one deterministic, immutable `experience-event/v1` boundary separates poker-world and study/application events;
   - audio follows the interaction metaphor: ordinary Varied/Focused Training emits one canonical study-result cue, while visible Hand, Full Hand Training, Replay, card, chip, and pot actions retain physical foley;
   - eleven coherent production recordings are selected from fifteen provenance-documented CC0 assets; explicit gain/window/tail trims and very small variation replace semantically divergent variants;
   - one compact motion policy drives restrained card, fold, chip, pot, actor, street, hand-complete, and Review-selection consequences from TablePresentation anchors;
   - live Hand, Replay playback, and Training Full Hand share the path, while direct seek, initial render, hydration, and review selection never replay historical poker events;
   - human accepted the overall audio system, materially improved physical foley, semantic routing, and the ordinary-Training Study/UI versus visible poker-world distinction as sufficient to move on;
   - subjective Study/UI and Check refinement remains known polish debt rather than a claim of sound-design perfection;
   - reduced motion, sound off, no-casino, no-reward, and no-proprietary-asset constraints are automated.

5. **ACTIVE NEXT — `DOCS-INTEGRITY-001`**

6. **PLANNED NEXT — `UX-REGRESSION-001`**
   - execute immediately after `DOCS-INTEGRITY-001`;
   - retain its existing unrelated regression scope rather than absorbing audio polish debt.

7. **PLANNED LATER — `PREMIUM-CLOSEOUT-001`**
   - whole-app hierarchy and Core Flow closeout;
   - desktop responsive / themes / density / cards / EN-RU-HE / RTL acceptance;
   - resolve high-value UI QA rather than adding more customization variants.

8. **PLANNED NEXT — first trusted bounded reference pack / provider**
   - exact assumptions, versioning, validation, licensing/provenance, context coverage;
   - heuristic fallback elsewhere.

9. **PLANNED NEXT — Training Memory / re-drill intelligence**

10. **PLANNED NEXT — Personal Strategy integration and review comparison**

11. **PLANNED NEXT — `HOME-002B` Saved Study Library / knowledge workspace**

12. **PRESERVED FUTURE, high strategic value — OpponentPolicy / bots / full-hand bot learning**

Reassess at every clean checkpoint.

## Global baseline and CI — COMPLETED

The `AUDIO-MOTION-001` correction finished with the canonical 1,759/1,759 Node suite green. Human QA accepted the implementation checkpoint while retaining subjective audio polish debt; automated success is not presented as subjective perfection. Minimal GitHub Actions runs canonical syntax checks plus the full Node suite on Node 24.

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

## Table / Full-Hand learning checkpoint — COMPLETED

`TABLE-PRESENCE-002` supplies pure ephemeral `table-presentation/v1`, deliberate 2–10 player geometry, Hero/action hierarchy, the visible canonical timeline, and deterministic `selectFrame(frameIndex)` without Hand mutation.

`FULL-HAND-REVIEW-001` adds ephemeral `hand-review/v1` over the canonical Hero decision journal, Replay projection, StrategyResult, and StrategyClaimPolicy. Normal Hand and Full-Hand Training share the same overview, decision navigation, selected-decision comparison, pre-action Replay synchronization, provenance, and unavailable-state continuity. No second PokerState, Replay history, Training grader, Analysis implementation, or Saved schema was introduced.

Independent hands-on Firefox acceptance and the broader Table Presence visual matrix remain separately owned by `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.

### `STRATEGY-REPAIR-001A` — COMPLETED

- table-size / position structural repair without broad intuition retuning;
- HU/ring distinction;
- causal deterministic postflop sampling seed;
- missing exact call price no longer fabricates economics;
- unreachable sub-2bb shove branch removed;
- permanent strategy-quality calibration corpus established.

### `DECISION-CONTEXT-001A` — COMPLETED

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

## Table Presence / Replay / Full Hand Review — implementation checkpoints COMPLETED

Current foundation includes:

- canonical table presence;
- read-only action/chance timeline;
- deterministic replay projection;
- play/pause and speed;
- on-felt contributions and contribution-to-pot transitions;
- reusable poker-chip primitive;
- reduced-motion-safe restrained movement.

The richer visual branch is checkpointed through `TABLE-PRESENCE-REF-001`, `TABLE-PRESENCE-002`, `FULL-HAND-REVIEW-001`, and the accepted `AUDIO-MOTION-001` implementation. `DOCS-INTEGRITY-001` is active next; `UX-REGRESSION-001` is planned immediately afterward, while `PREMIUM-CLOSEOUT-001` remains later.

Preserve the no-casino aesthetic. The bounded semantic card/chip/pot paths are implemented; detailed denominations, elaborate card physics/showdown choreography, ambience, and deeper/3D treatment remain later unless a new bounded ticket proves they are needed.

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

Do not add more theme/layout/density/card variants in the active phase. Preserve their integration with Table Presence and Full Hand Review, and finish the separately routed human acceptance.

## Personal Strategy — CHECKPOINTED / INTENTIONALLY INCOMPLETE

Completed through the automated checkpoints for Calibration 002D, Range Builder and Range Teacher.

Locked model:

- Profile is a recognizable poker environment/identity;
- exactly three user-named modes per profile;
- dominant quick answer is not implicit 100%;
- exact mixes optional;
- direct/Training contradictions preserved;
- sparse immutable evidence is durable truth;
- inference/uncertainty/conflicts are recomputable read model;
- Matrix/Builder/Teacher consume one evidence authority.

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

After an accepted ticket, update this resume map whenever checkpoint status, the active ticket, or priority order changes. The authoritative roadmap/resume/backlog state moves with the accepted checkpoint; do not create a parallel status system. Put detailed future capability in `PRODUCT_BACKLOG.md`, keep implementation contracts in subsystem specs, and route unresolved visual/manual acceptance through `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.
