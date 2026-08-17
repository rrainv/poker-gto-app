# Riverline — Master Product, Strategy, and Platform Plan

**Status:** Living planning authority — v1.3

**Date:** 2026-08-17
**Purpose:** Preserve Riverline’s product vision, strategy/mathematical direction, architecture, user priorities, constraints, accepted ideas, candidate ideas, and long-term implementation path in one place.

> This is a planning authority, not code truth. The current repository remains the authority for implementation details. New manual QA and explicit product decisions override older planning assumptions.

## Current checkpoint — August 17, 2026

`ROADMAP-CHECKPOINT-002` consolidates the current implementation checkpoint, intentionally incomplete branches, exact resume tickets, shelved work, and near-term ordering in `CURRENT_PHASE.md`. That file is the authoritative current checkpoint/resume map; `PRODUCT_BACKLOG.md` preserves detailed future capability. This master plan retains the long-term rationale and decision history without duplicating the whole live status map.

Accepted implementation now includes Personal Strategy through `RANGE-CAL-002A`; Table Presence and Replay through `REPLAY-001C` plus the poker-chip/physical-contribution checkpoint; Saved Objects through `SAVED-OBJECTS-002`; `HOME-001`; tutorial foundation and current-app coverage; `RANGE-CORE-001`; and `ANALYSIS-RANGE-001` including RR/RRR corrections. Personal Strategy remains intentionally incomplete and resumes at `RANGE-CAL-002B`.

The current execution sequence is: completed Analysis checkpoint → **ACTIVE NEXT `PREFLOP-SANITY-001`** → **PLANNED NEXT `BLUFF-001`** → account identity/foundation → richer Home → a separate Home Game Organizer domain/tab. Reassess at each clean checkpoint.

## 1. Executive vision

Riverline should evolve from a polished Texas Hold’em study workstation into a **personal poker strategy and study platform**.

The long-term differentiator should not be “Riverline has many poker tools.” It should be:

> **Riverline learns how I think about poker, helps me model and improve my ranges, remembers my weaknesses, explains why decisions change, and eventually lets me compare/share that poker model with other people.**

The project should remain useful at every stage. We should not disappear into architecture, solver work, or model training for months without visible product payoff.

The development pattern should be:

> **foundation → visible payoff → deeper foundation → larger payoff**

The long-term Personal Strategy Foundation can eventually support:
- inferred personal ranges;
- style anchors;
- interpolation/extrapolation;
- calibrated fallback strategy;
- Training intelligence;
- Range Builder / Range Teacher;
- mistake review and targeted re-drilling;
- Compare Spots;
- richer personalized Analysis;
- sharing/accounts/social features;
- later model and solver integration.

Riverline should feel **custom, premium, serious, and coherent**, not like a collection of unrelated poker widgets.


## 1.1 Locked / planned decisions from product review

The following decisions are now explicit product authority.

### LOCKED — Personal Strategy / Calibration
- **Calibration is per-profile.** A calibration answer means: “this is how this named profile/mode should play in this real poker environment,” not “this is universally how I play.” Profiles should map to recognizable game environments users can reason about naturally (e.g. Home Game, ClubGG Freeroll, online cash, MTT), and should be user-named rather than hardcoded around one person.
- **Multiple named profiles should be supported early.** The user is willing to train several profiles deeply, and Riverline should treat that as a major source of personalization rather than forcing one universal personal profile.
- **Start with 3 named strategy modes/anchors per profile.** Five anchors are unnecessary initially. These should feel like concrete ways the user actually plays inside that environment, not abstract theoretical slider labels. Names should be user-customizable. Do not assume they form a mathematically valid continuous axis until the data supports interpolation.
- **One-click calibration answers mean dominant/preferred action, not 100% purity.** Exact/mixed-frequency entry is always available as optional refinement. Riverline may explicitly request a detailed mix when uncertainty/boundary information makes it valuable, but must never silently convert a quick answer into a pure strategy.
- **Training observations can contribute to profiles through per-session opt-in.** A session should be attachable to a selected `profile · mode`, with an explicit `Don't use for profile` option. Training evidence must retain different provenance from deliberate calibration answers.
- **Training-vs-calibration conflicts preserve both pieces of evidence.** Riverline should notify the user of the deviation, save both observations, and later ask for clarification rather than silently overwriting the profile.
- **RFI/open ranges are the first calibration family.** Prove the full elicitation → persistence → inspection → inference loop on the simplest high-leverage family before globalizing.
- **Personal data is local-first, private by default, and exportable.** Accounts/cloud/sharing are later optional enhancements rather than prerequisites.

### PLANNED — Product / Presentation
- `HOME-001` is complete. A substantially richer “my Riverline” Home is a near-term priority after account identity/foundation and remains a consumer of real user domains.
- Broader UI/presentation expansion remains desired after the Personal Strategy Foundation produces meaningful new data.
- **Per-workspace guided tutorials are checkpointed for the current app.** Every future meaningful visible feature owns its tutorial update in the feature ticket. Tutorials remain first-use subtle, re-openable, skippable, and focused on **what to do, how it works, and why/when to use it**; they complement rather than replace the Guide.
- Gamification depth, including streaks/XP/badges, remains deliberately undecided and deferred.

### PLANNED — Previously candidate ideas
The following are no longer merely speculative; they should remain visible as planned future opportunities, with timing still open:
- confidence / uncertainty queue;
- profile snapshots / experiments / rollback;
- notes and tags;
- personal-data export/import;
- study goals;
- friend challenges / shared drills;
- natural-language StrategyProfile summaries;
- range evolution by street;
- versioned benchmark/reference packs.

## 2. Product identity and design principles

Riverline should feel like a premium analytical poker workstation.

### Desired characteristics
- serious and analytical;
- compact but readable;
- information-rich with clear hierarchy;
- fast;
- restrained;
- visually polished;
- trustworthy about what is known vs inferred;
- personalized where personalization is meaningful;
- useful without requiring a server, account, or neural model.

### Avoid
- casino/jackpot aesthetics;
- neon everywhere;
- gratuitous gamification;
- giant empty surfaces;
- noisy dashboards where every value has equal weight;
- engineering/debug terminology leaking into product copy;
- UI celebrating the fact that a bug/safeguard was implemented;
- fake GTO/EV/solver claims;
- architecture-heavy copy in normal product surfaces.

### Product-copy rule
Tell users:
- what they can do;
- what the result means;
- what the relevant uncertainty/provenance is.

Do not repeatedly advertise implementation safeguards such as “hints never reveal the answer.”

## 3. Current architecture and non-negotiable authorities

### 3.1 Canonical poker domain

`shared/poker-domain` is the authority for:
- PokerState;
- legal actions;
- blinds / antes / forced contributions;
- betting progression;
- all-ins;
- refunds;
- side pots;
- showdown;
- canonical hand ordering/evaluation;
- canonical Hold'em deck/combo identity and combo-level weighted range math.

UI code must not become a second poker-rules engine.

### 3.2 Scenario Mode vs Hand Mode

**Scenario Mode**
- arbitrary/lossy study snapshot;
- user supplies context;
- may not have a complete legal action history;
- must not fabricate exact PokerState/history;
- exact call price/history may be unknown.

**Hand Mode**
- canonical legal PokerState/session;
- exact actor, contribution, history, live players, call amount, etc. derive from canonical state.

Do not silently merge Scenario and Hand authority.

### 3.3 DecisionContext

Current strategic consumer contract: `DecisionContext v1`.

Important semantics:
- `facingSizeBb` = nominal wager-to / facing context;
- `callAmountBb` = exact incremental call price when trusted;
- `heroStreetContributionBb` = existing Hero street investment when trusted;
- `opponentCount` = exact live-opponent count when canonical state knows it.

Never substitute `facingSizeBb` for trusted `callAmountBb`.

### 3.4 Strategy authority

Current product flow:

`DecisionContext → StrategyProvider → StrategyResult → presentation`

There should be one strategic authority.

Consumers include:
- Playbook;
- Training;
- preflop Matrix;
- future Range Teacher;
- future personalized/reference strategy views.

Future model/solver/profile strategy sources should enter behind the same StrategyProvider boundary rather than creating parallel strategy engines.

### 3.5 StrategyResult

The versioned result contract owns:
- structured action types;
- normalized action probabilities;
- source/provenance;
- unavailable semantics;
- details/limitations where appropriate.

Structured action type is authoritative; labels are presentation.

### 3.6 Equity

Canonical Equity remains separate from heuristic strategy sampling.

`equity-request → canonical Equity service → exact enumeration or seeded Monte Carlo → equity-result`

Do not treat heuristic sampled showdown share as canonical Equity.

### 3.7 Training

Canonical Training:
- generates reachable legal PokerState trajectories;
- deterministic by seed;
- uses StrategyProvider;
- grades from StrategyResult;
- keeps Training RNG separate from strategy RNG.

### 3.8 Analysis

`AnalysisExplanation` is the explanation authority.

It consumes:
- DecisionContext;
- StrategyResult;
- trusted `RangeAnalysisFacts v1` and other bounded application facts.

It may explain strategy but must not independently invent strategy, Equity, or poker-state math.

The range-aware path is trusted inputs -> `RangeAnalysisFacts v1` -> `AnalysisExplanation v1` -> renderer. Exact-card blocker counts are structural facts. Supplied-range effects and composition appear only when a named `HoldemWeightedRange v1` with independent provenance is attached; partial data remains partial, and normalization is limited to complete positive-mass ranges. This foundation does not establish range advantage, nut advantage, bluff quality, action EV, or solver frequencies.

### 3.9 Electron

Electron remains a thin host:
- BrowserWindow;
- loads app;
- no separate ONNX/native strategy authority.

Browser behavior matters. Firefox is the user’s normal web runtime and should be the primary real-browser acceptance target for browser-specific behavior.

## 4. Current strategy/math status

### 4.1 Current production strategy
The current strategy source is a deterministic heuristic fallback.

It is:
- useful;
- structurally cleaner than the old prototype;
- not validated GTO;
- not solver truth;
- not a source of trustworthy EV loss numbers.

Do not call its output “optimal.”

Training currently means “matches Riverline’s current reference,” not “objectively optimal poker.”

### 4.2 Preflop status
Completed integrity work includes:
- removal of fake preflop SPR;
- removal of hand-level MDF misuse;
- removal of abrupt fold cliffs;
- improved continuity;
- correct BB free-check semantics;
- safer action/sizing semantics;
- canonical hand ordering where appropriate.

But:
- one universal parameterization is too coarse;
- HU/6-max/9-max contexts may still behave too similarly;
- current frequencies are not trustworthy solver-derived ranges.

### 4.3 Postflop status
Completed integrity work includes:
- correct multiway tie shares;
- complete opponent allocation per counted sample;
- dead-card handling;
- canonical evaluator for winners;
- exact live opponent count where available;
- shared resolved sample rather than duplicate sampling;
- removal of hand-level MDF;
- improved continuous thresholds.

But:
- postflop remains heuristic conditional sampling against assumed opponent ranges;
- it does not yet carry a sophisticated path-conditioned range model;
- bluff construction/value-bluff balance remains underdeveloped.

### 4.4 Calibration status
A calibration harness exists.

Previous conclusion:
- there is no sufficiently trustworthy Hold’em strategy reference currently in the repo for broad calibration;
- broad heuristic tweaking should not resume as hand-by-hand patching;
- future calibration should be based on explicit anchor families and better reference data.

## 5. Game/accounting rules

### Home
- 2–10 players;
- no Riverline rake/deduction.

### ClubGG-style tournament rule
- 7–10 players;
- every seated player contributes exactly 0.1bb once per hand;
- total contribution = seats × 0.1bb;
- contribution is outside the contestable pot;
- not percentage rake;
- no capped-rake mode.

Do not reintroduce percentage/capped rake unless product requirements deliberately change.

## 6. Completed stabilization / polish era

The following broad work is considered complete enough that future work should not reopen it without evidence of regression:

- major legacy cleanup;
- canonical engine/session integration;
- StrategyProvider / StrategyResult authority;
- heuristic extraction;
- preflop/postflop integrity work;
- calibration baseline;
- PERF-001;
- interaction correctness;
- UI density/geometry;
- Analysis hierarchy;
- card styles/themes;
- Matrix/workspace composition;
- Equity UX/progress/cancellation;
- Guide refresh;
- hidden DOM remeasurement/cleanup;
- runtime i18n;
- desktop responsive acceptance;
- motion/sound polish;
- Firefox Web Audio parity;
- product-copy truthfulness.

Known future micro-debt may still be fixed opportunistically as it appears, but the project should no longer live in generic “repair mode.”

## 6.1 Protect the polished baseline — LOCKED

The existing polished Riverline is a product baseline to protect, not temporary scaffolding that may be torn apart for the Personal Strategy work.

Before the new epic begins:
- create a clear Git tag/checkpoint for the accepted pre-Personal-Strategy product;
- keep all existing workspaces fully operational and regression-tested;
- make the new subsystem additive and isolated first;
- lazy-load or activate Personal Strategy work only when its workspace/services are used;
- do not route personal profiles into StrategyProvider until the elicitation, persistence, inspection, and inference layers have independently earned integration;
- keep the current heuristic/fallback path available and testable throughout the transition;
- use feature flags or equivalent bounded activation for incomplete stages where appropriate;
- preserve schema versions and migrations from the first persisted object.

A failed Lab experiment must be removable without destabilizing Playbook, Training, Equity, Matrix, or the canonical poker domain.

## 6.2 Scope interpretation — LOCKED

Range Calibration is **not a small feature**.

It is a flagship subsystem and likely one of the largest feature families in Riverline so far, comparable to or larger than the current Training workspace once persistence, profiles, inspection, inference, confidence, adaptive questioning, and integration are included.

When this plan refers to a “small first step,” it means:
- a small irreversible commitment;
- a small blast radius on the accepted application;
- a bounded ticket with one provable outcome.

It does **not** mean the overall feature family is small.

## 7. Personal Strategy Foundation — completed historical plan

The following records the original foundation plan, now completed through `RANGE-CAL-002A`; its remaining inference and integration stages are deferred by the August 14 checkpoint.

### `RANGE-CAL-000 — Personal Strategy Domain, Contracts, and Implementation Specification`

This is an architecture/domain ticket, not the Range Calibration UI implementation.

Purpose:
- define the semantics of the Personal Strategy domain before code begins to depend on it;
- create a dedicated `PERSONAL_STRATEGY_FOUNDATION_SPEC.md`;
- define versioned, persistent, ownership-ready data structures;
- define repository/service boundaries;
- define migration, import/export, provenance, and failure behavior;
- define how the subsystem remains isolated from existing StrategyProvider behavior until later integration.

Core objects should likely include versioned forms of:
- `StrategyProfile`;
- `StrategyMode`;
- `RangeObservation`;
- `RangeAnchor`;
- `CalibrationSession`;
- `InferredRange`;
- `TrainingObservation` / `ProfileEvidence`;
- `SavedSpot`;
- profile/range version metadata.

Requirements:
- serializable;
- versioned;
- stable IDs;
- created/updated timestamps;
- local ownership now;
- account ownership ready later;
- explicit source/provenance;
- schema migration strategy;
- deterministic validation;
- no DOM-only state;
- no requirement for server/authentication;
- clear handling of unknown future fields and incompatible versions;
- non-destructive export/import groundwork;
- test fixtures for round-trip serialization and migrations.

A future account/cloud layer should be able to replace `localOwnerId` with an account/user identity without redefining what a range/profile is.

### `RANGE-CAL-000` exit gate

Do not begin the flagship workspace until:
- the domain terminology is explicit;
- dominant-action vs exact-frequency semantics are represented directly;
- Profile / Mode / Spot Context are separate in the schema;
- direct calibration evidence and Training evidence have separate provenance;
- local storage/repository boundaries are defined;
- migration and export/import strategy are documented;
- independent architecture review finds no dependency on DOM, current locale, or mutable global UI state.

No production strategy frequency should change in this ticket.

## 7.1 Profile vs Mode vs Spot Context — LOCKED conceptual separation

Riverline should not force users to think in abstract theoretical profiles when real poker environments are easier to reason about.

Use three distinct layers:

### Profile = real poker environment / strategic identity
Examples:
- `Home Game with Friends`
- `ClubGG Freeroll`
- `6-max Online Cash`
- `Live MTT`
- custom user-defined environments

A profile may store useful defaults/metadata such as:
- game family;
- common table-size range;
- usual stack-depth bands;
- accounting/rake model where relevant;
- optional notes/tags;
- user-defined description.

A profile is **not** a replacement for the exact current spot. Objective spot facts still belong in the calibration/DecisionContext.

### Mode / Anchor = a concrete way the user plays inside that profile
Each profile starts with up to **three named modes**.

Examples might be:
- `Normal`
- `Cautious`
- `Pressure`

but Riverline must not hardcode universal names. Users should be able to name modes in terms that match how they actually think about their game.

Important:
- a mode is a discrete strategic anchor;
- modes may later be ordered/interpolated if evidence shows a coherent axis;
- do **not** assume three arbitrary named modes are automatically linearly interpolatable;
- if the modes are not meaningfully ordered, preserve them as discrete profiles/modes rather than inventing fake continuum math.

### Spot Context = objective current situation
Examples:
- table size;
- position;
- effective stack;
- action/facing family;
- sizing/call price;
- tournament/cash-specific facts when modeled;
- exact hand class.

This separation lets a user answer a natural question like:

> “What would I do with K9s in my Home Game · Normal mode from BTN at 100bb?”

without pretending `Home Game`, `Normal`, `BTN`, and `100bb` are the same kind of parameter.

This distinction is foundational for future sharing, accounts, Training evidence, interpolation, and strategy-source selection.


## 8. RANGE-CAL-001 EPIC — Interactive Range Elicitation

This is the first major visible post-repair **epic**, not one implementation ticket.

It should be delivered through substantial bounded stages with human use and stop/go review between them.

### `RANGE-CAL-001A — Calibration Workspace & Context Builder`
Owns:
- new isolated workspace/navigation entry;
- profile creation/selection;
- mode creation/selection;
- initial RFI/open-range context builder;
- table size, position, effective stack, and relevant configuration;
- session shell/progress framing;
- localization, accessibility, and responsive foundation.

It does **not** own inference or StrategyProvider integration.

### `RANGE-CAL-001B — Elicitation Engine & Answer Loop`
Owns:
- deterministic hand prompt generation;
- legal answer choices for the selected RFI context;
- one-click dominant-action semantics;
- keyboard-first operation;
- optional detailed mix entry;
- previous/undo behavior;
- next-question loop;
- immediate session feedback without strategy grading.

Initially, question selection may be simple and deterministic. Adaptive questioning belongs to `RANGE-CAL-002`.

### `RANGE-CAL-001C — Persistence, Resume & Profile Library`
Owns:
- immediate durable save after each answer;
- resumable sessions;
- profile/mode library;
- rename/duplicate/archive where approved;
- schema migrations;
- local repository failure handling;
- export/import groundwork;
- restart/crash recovery tests.

Closing the app must never lose accepted observations.

### `RANGE-CAL-001D — Matrix Inspection & Correction`
Owns:
- profile-range inspection through the 13×13 Matrix;
- directly answered vs unanswered states;
- observation detail;
- correction/revision flow;
- coverage/progress;
- navigation from uncertain/missing cells back into elicitation;
- comparison between modes only where the data is explicit.

No inferred confidence is shown before `RANGE-CAL-002` exists.

### `RANGE-CAL-001E — Detailed Mixes & Calibration Quality UX`
Owns:
- dominant vs mixed semantics;
- “mostly” answers;
- exact-frequency editor;
- validation/normalization;
- conflicting duplicate observations;
- calibration-session quality indicators;
- user-friendly review of decisions needing clarification.

### `RANGE-CAL-001R — Independent Product, Persistence, Performance & QA Review`
Before the skeleton epic is considered complete:
- run an independent architecture/product audit;
- use the feature for real calibration sessions;
- test hundreds of observations and multiple profiles/modes;
- test close/reopen/restart/migration/export/import behavior;
- verify Firefox, Electron, EN/RU/HE, RTL, 1024–4K;
- measure prompt-to-next latency, workspace activation, storage growth, and existing-workspace regressions;
- verify the current Riverline workspaces remain smooth when Personal Strategy is unused.

This is the first major visible post-repair feature family.

It should **not** initially be a traditional 169-cell painting tool.

The first usable payoff is still deliberately narrow: teach one selected profile/mode through one RFI family, save the observations safely, and inspect/correct them.

The primary interaction:

> Riverline shows a concrete poker situation and one hand.  
> User chooses an action.  
> Riverline records that answer and asks another high-value question.

Example context:
- game;
- table size;
- position;
- effective stack;
- action/facing family;
- relevant sizing/call context;
- style anchor/profile;
- hand class.

Example:

`6-max · BTN · 100bb · Unopened · Baseline`  
`K8s`

Actions:
- Fold
- Call
- Raise
- All-in where legal.

### 8.1 Friction target
Calibration should be usable for:
- 30 seconds;
- 5 minutes;
- a longer focused session;

without losing progress.

The system should not require finishing a 169-hand form.

### 8.2 One-click by default
Most prompts should take one action.

A one-click response records the **dominant/preferred action** for that profile/mode/context. It does **not** mean 100% pure frequency.

The observation should explicitly distinguish:
- `dominantAction`;
- whether exact frequencies were supplied;
- optional frequency detail when present.

Exact frequency entry should not be required for every hand.

### 8.3 Mixed-strategy refinement
Mixed-frequency input should always be available as an optional refinement.

When a boundary looks especially informative/ambiguous, Riverline may explicitly ask for more detail:
- Pure;
- Mostly Raise;
- Mostly Call;
- Mixed;
- advanced exact frequencies.

The default remains the fast dominant-action answer. A discrete answer must never be silently interpreted as 100% pure.

### 8.4 Keyboard operation
Fast keyboard controls should be first-class for expert calibration sessions.

### 8.5 Persistence
Every direct answer should be stored immediately.

The user can close Riverline and resume later.

## 9. Deferred active-question selection — `RANGE-CAL-002`, not the initial skeleton

A core premium feature should be **adaptive/boundary-seeking questioning**.

`RANGE-CAL-001` may use a simple deterministic/question-order strategy while the data model and workflow are being proven. Do not hide premature inference behind a seemingly intelligent question order.

The system should not waste questions on obvious spots once confidence is high.

Bad:
- repeatedly asking AA and 72o after their behavior is clear.

Good:
- find the boundary around K9s/K8s/K7s;
- A8o/A7o;
- 55/44;
- weak suited connectors;
- marginal blind-defense hands;
- threshold hands against specific open sizes.

Product principle:

> **Every question should either materially reduce uncertainty or test a strategic boundary.**

Useful internal metrics:
- information gained per answer;
- uncertainty reduced;
- direct vs inferred coverage;
- number of questions required to reach confidence thresholds;
- marginal information value of the next question.

## 10. Matrix as inspection/correction surface

The existing 13×13 Matrix should become the visual inspection surface for the personal profile.

It should show states such as:
- directly answered;
- inferred high confidence;
- inferred medium confidence;
- uncertain;
- conflicting/inconsistent;
- needs review.

Example progress:

`BTN 100bb RFI · Baseline`
- 37 direct decisions
- 119 high-confidence inferred hands
- 13 uncertain
- estimated profile confidence: 91%

Selecting an inferred cell should expose:
- inferred action mix;
- confidence;
- source;
- nearby observations that influenced it;
- confirm/change actions.

The traditional manual Range Builder can later become an advanced direct editor of the same data model.

## 11. RANGE-CAL-002 EPIC — completed baseline and deferred continuation

`RANGE-CAL-002A` is complete as an isolated, unpersisted, unexported research baseline. The remaining stages are intentionally deferred; they must not be integrated into Matrix, StrategyProvider, Training, or live question selection without a new approved ticket.

Suggested staged delivery:

### `RANGE-CAL-002A — Transparent Similarity Baseline` — COMPLETED
- deterministic hand/context similarity;
- explainable neighboring observations;
- no active questioning yet;
- direct holdout evaluation against known answers.

### `RANGE-CAL-002B — Confidence & Validation` — DEFERRED
- confidence model;
- calibration of confidence against withheld direct observations;
- uncertainty display;
- contradiction detection;
- avoid presenting confidence as truth.

### `RANGE-CAL-002C — Boundary Detection & Next-Best Question` — DEFERRED
- identify likely strategic boundaries;
- estimate expected information gain;
- select high-value next questions;
- preserve diversity and avoid repetitive sessions.

### `RANGE-CAL-002D — Inferred Matrix & Uncertainty Queue` — DEFERRED
- inferred action/mix display;
- confidence/provenance;
- “teach Riverline next” queue;
- direct confirm/correct workflow.

### `RANGE-CAL-002R — Independent Inference Quality Review` — DEFERRED
- compare inferred ranges against intentionally held-out manual ranges;
- quantify questions needed for useful coverage;
- test profile/mode/context separation;
- verify no systematic ordering assumptions erase legitimate exploitative strategies;
- decide whether deterministic inference is sufficient before considering ML.

When the deferral is explicitly lifted at `RANGE-CAL-002B`, evaluate further inference only through the approved confidence/validation gate; do not integrate the current baseline from this historical plan.

Start transparent and deterministic before introducing ML.

Potential features to model:
- rank strength;
- pair ordering;
- suited/offsuit relationship;
- connectivity/gaps;
- ace/king effects;
- relative ordering within a position/action family;
- neighboring direct observations.

Output should include:
- inferred action probabilities or dominant action;
- confidence;
- source;
- nearest/direct observations;
- inference model version.

Example:

```
Raise 0.74
Call  0.05
Fold  0.21

confidence: 0.83
source: inferred_user_profile
```

Direct user answers must remain distinguishable from inferred values.

## 12. Style anchors

### `STRATEGY-FOUNDATION-002 — Style Anchors & Interpolation` — DEFERRED

The existing playstyle sliders should eventually stop being arbitrary heuristic multipliers.

Instead, they should correspond to actual benchmark profile anchors.

Initial scope:
- **3 named modes/anchors per profile**, not 5.

User-facing names should be concrete and customizable rather than universally fixed to `Tight / Baseline / Loose`.

At first, treat them as **discrete strategic anchors**.

Only after real calibration data exists should `STRATEGY-FOUNDATION-002` test whether the modes can be meaningfully ordered on one or more continuous dimensions. If a coherent ordering exists, interpolation may be enabled between those anchors. If it does not, keep them discrete rather than forcing fake slider math.

The existing playstyle sliders can later be redefined from validated mode relationships rather than dictating the profile model up front.

The user should not have to calibrate every anchor from scratch.

Example:
- fully establish Baseline;
- calibrating Loose starts from Baseline and asks where Riverline expects meaningful differences;
- obvious invariant hands are reused;
- only boundary differences are queried.

Intermediate slider values should interpolate between explicit anchors.

Extrapolation outside good anchor coverage should:
- clamp;
- degrade confidence;
- or fall back,
depending on the final mathematical design.

Never silently present unsupported extrapolation as a direct benchmark.

## 13. One style dimension first

Do not begin with a giant personality space.

Start with one interpretable axis, likely:
- Tight ↔ Loose

Later evidence may justify additional dimensions such as:
- Passive ↔ Aggressive;
- Bluff-light ↔ Bluff-heavy;
- Low-variance ↔ High-variance.

Do not assume those dimensions are independent without data.

The elicitation data itself may help determine which style dimensions are useful.

## 14. Training as optional profile evidence — DEFERRED

Normal Training can become another source of information for the personal strategy model.

Important provenance distinction:

### Direct calibration answer
A deliberate statement:
> “This is how I want this profile to play.”

High-confidence profile evidence.

### Training observation
Behavior observed during drills:
> “This is what I actually chose under Training conditions.”

Lower/different confidence and provenance.

At Training-session start or setup, provide a profile-evidence selector such as:

> **Use this session to refine:** `Home Game · Normal`
> **Don't use for profile**

Training evidence contributes to the selected profile/mode but must retain distinct provenance from direct calibration answers.

When Training behavior conflicts with a direct calibration answer:
- preserve both;
- surface the deviation;
- never silently overwrite the calibration observation;
- after enough contradictory evidence, Riverline may ask the user which better represents the intended profile.

A valuable later comparison:

> **Stated range vs actual Training behavior**

This could become an excellent leak-detection tool.

## 15. Cross-Riverline strategy integration — DEFERRED

### `STRATEGY-FOUNDATION-003`

After range elicitation, inference, and anchors are credible, route them through StrategyProvider.

Possible strategy-source hierarchy:

1. validated model/solver source for covered contexts;
2. selected personal StrategyProfile;
3. calibrated Riverline fallback;
4. generic heuristic fallback.

Every StrategyResult should preserve source/provenance/confidence.

Possible UI provenance:

`My Baseline · direct anchor`
`My Loose profile · interpolated · 87% confidence`
`Riverline calibrated fallback`
`Generic heuristic fallback`
`Validated reference`

Consumers should not need separate math:
- Playbook;
- Matrix;
- Training;
- Analysis;
- future Range Teacher;
- future Compare Spots.

## 15.1 Smoothness, isolation, and performance budgets — LOCKED

The new subsystem must preserve or improve the current product feel.

Requirements:
- Profile/Mode services are not initialized by unrelated workspaces unless required.
- A calibration answer must save and advance to the next prompt perceptually instantly.
- Persistence may not block the interaction thread for noticeable periods.
- Heavy inference must be incremental, on demand, in a worker, or otherwise isolated if measurements justify it.
- Existing Playbook/Training/Equity interactions must remain within their accepted performance envelope when Personal Strategy is unused.
- No full-range recomputation should run on unrelated UI interactions.
- Matrix/profile caches must be keyed, bounded, and invalidated deliberately.
- Storage growth must be measured with large synthetic profile libraries.
- Migrations must be deterministic and recoverable.
- Every ticket should record performance measurements relevant to the work it changes.

Exact numerical budgets should be established from a baseline benchmark in `RANGE-CAL-001A/001B`, then enforced by regression tests where practical.

## 15.2 Integration gates — LOCKED

Personal Strategy integration into existing Riverline surfaces must be earned in stages.

Gate 1 — Domain:
- contracts/spec reviewed.

Gate 2 — Workflow:
- users can answer, undo, resume, and inspect direct observations reliably.

Gate 3 — Durability:
- persistence, migrations, export/import, and recovery are verified.

Gate 4 — Inference:
- inferred ranges pass holdout/quality review and expose confidence/provenance.

Gate 5 — Mode relationship:
- evidence supports either discrete modes or a valid ordered/interpolatable relationship.

Gate 6 — StrategyProvider:
- only then may personal profiles become selectable StrategyProvider sources.

Gate 7 — Cross-product:
- only after provider integration is stable should Training, Analysis, postflop assumptions, Range Teacher, and Compare Spots depend on it.

At every gate, the project may stop, revise, or remove the experiment without compromising the accepted Riverline baseline.

## 16. Better fallback calibration

Personal/manual benchmark ranges should help reveal structural fallback failures.

Do not patch individual hands.

Compare:
- current Riverline fallback;
- user Baseline anchor;
- future solver/reference anchors.

Look for systematic deviations:
- position family too tight/loose;
- offsuit broadways;
- suited kings/aces;
- blind defense;
- stack response;
- table-size response.

Then improve parameter families rather than hardcoding specific hands.

## 17. Postflop range propagation

Long-term postflop strategy should be conditioned on ranges that actually reached the street.

Desired concept:

preflop StrategyProfile  
→ actions taken  
→ conditional range entering flop  
→ subsequent action updates  
→ conditional turn/river range  
→ opponent sampling / analysis

This should improve:
- postflop sampled strength;
- multiway behavior;
- Analysis;
- Training;
- bluff modeling;
- villain profiles.

Style sliders should eventually alter the ranges entering postflop rather than acting as disconnected postflop modifiers.

## 18. Bluffing/value strategy — explicit future work

Current heuristics/Training do not encourage or explain bluff construction enough.

Future strategy/analysis should explicitly model and teach:
- value vs bluff composition;
- bluff candidate selection;
- blockers;
- unblockers where relevant;
- fold equity;
- semi-bluffs;
- draw equity;
- bluff frequency relative to value;
- sizing and required bluff frequency;
- how board texture/ranges alter bluff viability;
- underbluffing/overbluffing tendencies in a personal profile.

Possible personalized coaching:

> Your profile raises enough value here but contains very few low-showdown-value blocker hands as bluffs.

Do not claim EV surrendered unless a trustworthy EV/reference source exists.

## 19. Features that directly stem from the Personal Strategy Foundation

### 19.1 Polished Range Builder
Eventually becomes:
- direct visual editing;
- frequency painting;
- save/version;
- compare;
- annotate;
- clone;
- correct inferred profiles.

It should use the canonical combo-level `HoldemWeightedRange v1` foundation and preserve Personal Strategy evidence/profile boundaries rather than inventing another Matrix-owned range format.

### 19.2 Range Teacher / Profiler
Can ask:
- what would you do?
- what does this profile do?
- where are your boundaries?
- how does your profile differ from another reference?

Can characterize:
- too tight/loose by region;
- structural tendencies;
- deviations;
- uncertainty.

### 19.3 Mistake review
Persist Training mistakes.

Each mistake should retain:
- exact spot;
- seed/context;
- chosen action;
- reference source/profile;
- relevant analysis;
- category/tags.

### 19.4 Targeted re-drilling
Generate related spots from:
- recurring mistakes;
- low-confidence profile regions;
- inconsistent direct answers;
- action-family weaknesses;
- board texture/position patterns.

### 19.5 Expanded Training filters
Potential filters:
- street;
- position;
- table size;
- stack;
- decision family;
- facing family;
- sizing;
- hand class;
- board texture;
- mistake category;
- profile/style anchor;
- saved range/profile.

### 19.6 Compare Spots
Show why a decision changed.

Potential dimensions:
- opponent count;
- stack;
- price;
- board;
- position;
- style point;
- range entering street;
- action history;
- confidence/source.

### 19.7 Similar-spot exploration
After a mistake/interesting decision, vary one dimension:
- kicker;
- sizing;
- stack;
- opponents;
- board;
- style;
- action history.

### 19.8 Real range-vs-range analysis
Future weighted analysis:
- combo-aware ranges;
- card removal;
- Equity;
- made-hand/draw distributions;
- board interaction;
- strategy comparison.

## 20. Rich qualitative decision analysis

Continue expanding the shared Analysis capability.

Desired trusted features where support exists:

### Hero
- made hand;
- pair type;
- kicker quality;
- overpair;
- set/trips;
- two pair;
- straight/flush/full house/quads;
- draws;
- OESD/gutshot;
- flush/combo draws;
- overcards;
- blockers when genuinely supported.

### Board
- paired/unpaired;
- rainbow/two-tone/monotone;
- connectivity;
- coordination;
- dry/wet;
- Broadway/low;
- texture changes by street.

### Decision
- position;
- price/call amount;
- pot odds;
- SPR;
- opponent count;
- prior action;
- selected profile/range assumptions.

Eventually personalized Analysis can explain profile effects, e.g.:
> Your Loose profile reaches this flop with more suited kings than Baseline.

## 21. Training intelligence

Once enough structured data exists:

### 21.1 Mistake dashboard / Leak Finder
Examples:
- overfolding BB vs BTN;
- under-defending small flop bets;
- underbluffing;
- weak paired-board performance;
- inconsistent 3-bet boundaries.

Always show sample size/confidence.

### 21.2 Concept Mastery
Potential categories:
- RFI;
- blind defense;
- 3-bets;
- pot odds;
- board texture;
- draws;
- multiway;
- position-specific play;
- bluff/value composition.

Do not show strong mastery claims from tiny sample sizes.

### 21.3 Adaptive/daily study session
Example:
- 6 recent mistakes;
- 5 weak boundary spots;
- 4 maintenance reps.

### 21.4 Streaks
Optional restrained study streaks inspired by Duolingo.

Use streaks to support habit formation, not dominate product identity.

Avoid excessive XP/confetti/gamification.

### 21.5 Saved drill presets
Save configurations such as:
`BTN vs BB · flop small-bet defense · 30bb`

### 21.6 Performance trends
Track recent improvement/regression by meaningful concept.

## 22. Targeted personal-decision coaching

Future Decision/Training/Hand Mode may display personalized insights derived from calibrated profiles.

Examples:

> Your calibrated profile tends to overfold this region.

> This spot requires a looser defense than your recent Training behavior.

> Your profile rarely bluffs this blocker class.

Important constraint:
Do not say:
> “You surrendered 0.37bb EV”
unless Riverline has trustworthy EV/reference data for that spot.

Distinguish:
- deviation from own profile;
- deviation from selected reference;
- actual measured EV loss.

## 23. Home / dashboard product direction

`HOME-001` has returned Home as a meaningful persistent study hub with Continue, Recent, Review, Mistakes, Personal Strategy, Quick Start, Saved Hand detached Replay reopening, and truthful Saved Spot reopening while preserving the live Hand.

Home/Dashboard is a consumer of the canonical SavedStudyObject application domain established by `SAVED-OBJECTS-001`; it must not own or redefine saved hands, spots, notes, tags, review state, or persistence.

It should become the center of Riverline, not a decorative navigation page.

Possible sections:

### Continue
- resume range calibration;
- resume Training drill;
- reopen saved range/spot.

### Weak spots
- recent mistake clusters;
- uncertain ranges;
- targeted drills.

### Profile progress
- calibration confidence;
- ranges updated;
- style anchors.

### Recent
- saved spots;
- hands;
- ranges;
- mistakes.

### Quick start
- Playbook;
- Training;
- Equity;
- Range Calibration/Builder.

Later:
- streak;
- daily study session;
- concept mastery;
- friend/shared activity if social features are enabled.

## 24. Product / Presentation Lab

Accepted product/presentation ideas:

### Safe layout presets
Examples:
- Cards First;
- Controls First;
- Table Focus;
- Analysis Focus;
- Compact;
- Configuration First.

Do not bring back arbitrary descendant drag/drop.

### Density modes
- Comfortable;
- Compact;
- later card-size controls.

### Beginner vs Expert
Beginner:
- simpler hierarchy;
- guided wording;
- fewer raw diagnostics.

Expert:
- denser frequency/provenance data;
- keyboard operation;
- advanced controls.

### Themes
- curated theme families;
- continue pruning/renaming only when justified;
- user-facing theme names may localize naturally.

### Workspace personalization
Persist:
- layout preset;
- theme;
- density;
- display mode;
- selected profile/source.

### Richer table physicality
Future:
- dealer;
- chips;
- contributions;
- bet placement;
- pot movement;
- dealing motion;
- richer seats/player presentation.

### Motion/sound
Current subtle motion/sound system becomes the foundation for future richer physical actions.

### Mobile
Mobile should eventually receive a deliberate composition, not squeezed desktop UI.

### Per-workspace tutorials / onboarding
Tutorial foundation and current-app coverage are complete for Home, Scenario, Hand, Replay, Matrix, Analysis, Range Comparison, Equity, Training, Range Calibration, Settings, and truthful Saved contexts through reused flows.

Desired behavior:
- encouraged automatically on first use;
- always re-accessible later;
- contextual coach marks/overlays rather than only static documentation;
- short animated/GIF-like examples where they genuinely explain interaction better;
- explain **what the user is doing, how the feature works, and why/when it is useful**;
- dismissible/skippable;
- should never block an experienced user;
- should use the same localization system as the rest of Riverline.

Every future meaningful visible feature or workspace owns its tutorial definition/update, semantic anchors, EN/RU/HE copy, RTL, accessibility, reduced-motion behavior, and relevant acceptance in the same ticket. Range Builder, Bluffing, richer Home, Home Game Organizer, and other later modules therefore extend the foundation when they ship; no giant tutorial catch-up project should be needed.

Tutorials complement the existing Guide; they do not replace it.

## 25. Replay timeline

Replay remains a canonical PokerState/Hand feature and architecturally independent from personal range inference. `REPLAY-001A/001B/001C`, including chance-event repair, are complete: Riverline has the chronological action/chance timeline, street progression, deterministic step projection, and restrained playback/motion. Future Replay work may add strategy/profile overlays, mistake markers, notes, and richer study integration.

Useful for:
- Training review;
- saved hands;
- shared spots;
- session review.

## 26. Saved objects and version history

`SAVED-OBJECTS-001/001R` establishes the local-first `SavedStudyObject v1` foundation. Current strict payloads are canonical observer-level Hands and truthful Hand/Scenario Spots. Saved Hands include a versioned observer-safe canonical event source that cold-reconstructs deterministic Replay states through the existing poker domain/projection architecture without persisting presentation frames. Shared annotations, review state, mistake classification, local ownership, archive tombstones, IndexedDB queries, and portable export/import belong to this domain rather than Dashboard. `SAVED-OBJECTS-002` adds visible Save Hand/Save Spot, annotations, review/mistake state, archive, and source-surface saved state; `HOME-001` consumes the domain for recent/review/mistake lists and Saved reopening. Range, drill, session-review, account, cloud, sharing, and object-history payloads remain later work.

Future saved content:
- spots;
- canonical hands;
- ranges;
- StrategyProfiles;
- mistakes;
- drills;
- Matrix states;
- comparisons.

Objects should have:
- stable IDs;
- versions;
- creation/update time;
- owner;
- source;
- notes/tags;
- share/privacy state later.

Potential future feature:
**Strategy history / diff over time**

Example:
> BTN Baseline v2 vs v5 — where did your range change?

## 27. Accounts, sync, friends, and sharing

Do not build accounts merely because applications often have accounts.

Build them once personal data is valuable enough to justify sync.

### Local-first requirement
Core functionality must work locally/offline.

Future account benefits:
- sync across devices;
- backup;
- sharing;
- social study;
- ownership.

### Friends / study groups
Potential:
- share ranges;
- share spots;
- share drills;
- compare profiles;
- clone/annotate another user’s range;
- collaborative review.

### Shareable spot
Should be an actual serialized Riverline object, not a screenshot.

May include:
- cards;
- table/stack;
- action history;
- assumptions;
- selected StrategyProfile;
- notes;
- source/provenance.

### Privacy
Personal range/profile data should default private unless explicitly shared.

Detailed permission model remains an open decision.

## 28. Home-game organizer — separate domain

A future Home Game Organizer is useful but should remain separate from strategy math.

Primary intended use:
- player roster;
- buy-ins;
- rebuys/add-ons;
- cash-outs;
- current chip totals;
- net results;
- settlement / who owes whom.

Potential additions:
- seat assignment;
- button/blind assignment;
- saved regular groups;
- session summary;
- shareable settlement.

Later it may share:
- accounts;
- player identities;
- saved sessions.

Do not contaminate StrategyProfile architecture with money/session bookkeeping.

## 29. Player/villain profiles

Long-term profile concepts may include:
- editable player names;
- per-player stacks;
- notes;
- tendencies;
- archetypes;
- range assumptions;
- eventually shared/personal inferred profiles.

Future postflop opponent sampling could consume actual selected villain profiles rather than generic “aggressive +20%” modifiers.

This should come after the Personal Strategy Foundation is mature.

## 30. Model training and solver roadmap

Model training remains planned, but after trustworthy data/reference structures exist.

### Principle
Do not train a network on heuristic labels and then pretend it became smarter than the heuristic.

Desired path:
1. user/manual anchors;
2. better calibrated fallback;
3. bounded solver/reference anchors;
4. validated datasets;
5. learned interpolation/generalization model where useful;
6. model enters behind StrategyProvider for covered contexts.

Potential separate models:
- preflop strategy interpolation;
- postflop strategy later;
- sparse personal-range inference;
- next-best-question selection if deterministic active learning stops being sufficient.

Always start deterministic/simple before ML when possible.

### Solver
Existing bounded solver remains research/reference infrastructure.

Possible future use:
- anchor generation;
- regression oracle for its exact abstraction;
- dataset generation.

Do not claim full multiway GTO.

## 31. Cloud/compute strategy

The laptop should not be treated as a CI/renderer/training server.

Development goal:
shift heavy work to:
- stronger desktop via remote development;
- cloud only when useful.

Potential setup:
- desktop as primary heavy compute/dev host;
- laptop as thin client;
- Firefox on laptop for final real-browser checks where environment-specific behavior matters.

For model/solver work:
- benchmark cheaply first;
- use rented CPU/GPU only when needed;
- do not commit to expensive persistent infrastructure.

Budget principle:
- total project spend target has historically been around US$75;
- solver/cloud experiments should begin around US$5–15;
- spend more only when measured throughput/value justifies it.

## 32. Developer-machine / testing-cost policy

Future tickets should minimize unnecessary local workload.

During iteration:
- focused tests only;
- syntax checks;
- no giant renderer matrix unless layout requires it;
- no full suite after every tiny correction.

At ticket completion:
- full Node gate once;
- Python solver gate when relevant or as milestone regression;
- renderer only for states touched.

At milestones:
- broader acceptance audit.

This reduces heat, lag, turnaround time, and wasted development effort.

## 33. PLO — long-term separate game-domain branch

Pot-Limit Omaha is a possible future expansion.

It should not be implemented as a trivial Hold’em toggle.

PLO would require serious work in:
- card/range representation;
- combinatorics;
- evaluator assumptions;
- Equity performance;
- Training;
- strategy abstraction;
- UI;
- solver/model data.

However, product infrastructure can be reusable:
- accounts;
- saved objects;
- Training shell;
- dashboard;
- replay;
- social/sharing;
- profiles.

Only assess PLO after the Hold’em personal-strategy foundation is mature.

## 34. Planned additional ideas — timing not yet fixed

These ideas have been positively selected for future consideration/implementation. Their exact priority and scope are intentionally not fixed yet.

### 34.1 Confidence / uncertainty queue
A dedicated view:
> “Teach Riverline these 12 decisions next.”

Could surface the highest-information questions across all partially calibrated ranges.

### 34.2 Profile snapshots / experiments
Allow:
- duplicate profile;
- experiment with a looser version;
- compare v1/v2;
- roll back.

### 34.3 Notes/tags
Attach notes to:
- ranges;
- spots;
- mistakes;
- profiles;
- drills.

### 34.4 Data export/import
Personal data portability:
- export StrategyProfile/ranges/spots;
- local backup;
- future account migration.

Any future external strategy import must use a validated versioned contract, not revive the removed arbitrary solver-tree upload.

### 34.5 Study goals
Optional goals:
- minutes/week;
- calibration targets;
- specific range families;
- number of targeted reps.

Could feed Home dashboard without becoming heavy gamification.

### 34.6 Challenges / friend drills
Future social study:
- send a 20-spot drill;
- compare results;
- no gambling/leaderboard pressure required.

### 34.7 Strategy-profile natural-language summary
Example:
> “Your BTN profile is relatively tight in offsuit broadways but wide in suited kings.”

Only after profile inference is reliable.

### 34.8 Range evolution by street
Visualize:
preflop range → flop continuation → turn range → river range.

Requires mature range propagation.

### 34.9 Benchmark packs
Versioned curated/reference anchor packs:
- user-defined;
- future solver-derived;
- expert/coach-defined;
- shared.

Must preserve provenance and avoid presenting unvalidated packs as truth.

## 35. Development workflow

Preferred workflow:
1. bounded ticket;
2. Codex inspects;
3. implements;
4. focused tests;
5. final ticket gate;
6. agent reports and stops;
7. user sends output for review;
8. human manually stages ticket only;
9. inspect cached diff;
10. commit.

One Codex chat = one ticket/tightly related outcome.

Same chat:
- regressions from that ticket;
- correction pass.

New chat:
- new subsystem/ticket;
- independent review.

Protected/local operational files should not enter unrelated commits.

User manual QA is the final gate for subjective visual/product feel.

## 36. Architecture principles for the new era

### 36.1 One data model, many features
Range Builder, Range Teacher, Training intelligence, Compare Spots, profiles, sharing, and later models should consume shared versioned range/profile objects.

Do not let each feature invent its own “range” format.

`RANGE-CORE-001` establishes the combo-level range half of this rule. Future visible consumers adopt it deliberately; existing Personal Strategy evidence remains a separate source contract until an approved adapter owns the semantic mapping.

### 36.2 Provenance everywhere
Distinguish:
- direct user answer;
- observed Training behavior;
- inferred profile;
- interpolated profile;
- extrapolated profile;
- calibrated fallback;
- generic heuristic;
- validated reference/model.

### 36.3 Confidence is not truth
Inferred values should expose confidence.

### 36.4 Personal strategy is not GTO
“My Strategy” must not be silently treated as universal optimal strategy.

### 36.5 Local-first
Accounts/cloud should enhance, not gate, the product.

### 36.6 Ownership-ready
Everything meaningful a user creates should be versioned, identifiable, serializable, and later shareable.

### 36.7 Friction is a metric
The cost of using calibration/Training matters.

The system should minimize user effort while maximizing information learned.

### 36.8 No fake EV
Only show EV loss when a trustworthy source supports it.

### 36.9 No hand-specific heuristic hacks
Fix families/systematic behavior.

### 36.10 Future models stay behind StrategyProvider
Do not make consumers model-aware.

## 37. Proposed high-level roadmap

### Active product direction — Analysis checkpoint → preflop sanity → Bluffing

Table Presence and Replay are **COMPLETED** through `TABLE-PRESENCE-001A` and `REPLAY-001A/001B/001C`, including chance-event repair, on-felt street contributions, truthful pot transitions, and the reusable poker-chip primitive. Richer physical dealing/chip/table/showdown visuals are preserved but **SHELVED FOR LATER**.

`ANALYSIS-RANGE-001` is the accepted current checkpoint. `PREFLOP-SANITY-001` is **ACTIVE NEXT** and owns a narrow, characterized suppression of obviously dominated premium-hand Fold leakage from heuristic smoothing. `BLUFF-001` is **PLANNED NEXT**, followed by account-ready identity architecture, richer Home, and the separate Home Game Organizer. See `CURRENT_PHASE.md` for exact boundaries and the live status map.

### Phase 0 — Protect the accepted product
- tag/checkpoint the polished pre-Personal-Strategy baseline;
- record current performance/UX baselines;
- establish feature isolation/activation policy.

### Phase A — Domain and implementation specification — COMPLETED
`RANGE-CAL-000`
- `PERSONAL_STRATEGY_FOUNDATION_SPEC.md`;
- domain semantics;
- Profile / Mode / Spot Context;
- versioned objects;
- serialization;
- repositories/services;
- provenance;
- migrations;
- local ownership;
- export/import groundwork;
- architecture review.

### Cross-cutting range foundation — COMPLETED
`RANGE-CORE-001`
- canonical 52-card and 1,326-combo identity;
- exact canonical 169 mapping;
- versioned weighted/partial range contract;
- unknown-versus-zero semantics and provenance;
- blocker conditioning and complete-range normalization;
- DOM-free Matrix projection and deterministic portability;
- no visible product or StrategyProvider/Equity behavior change.

### Range-aware Analysis foundation — COMPLETED
`ANALYSIS-RANGE-001`
- canonical exact-hand and draw classification derived through the shared evaluator;
- board-structure and exact-card blocker facts;
- optional named `HoldemWeightedRange v1` conditioning and composition with complete/partial truth preserved;
- separate strategy, card, board, and range provenance;
- compact visible Analysis sections and EN/RU/HE tutorial coverage;
- no inferred current range, range/nut-advantage claim, bluff-quality verdict, StrategyProvider call, or Equity call.

### Phase B — Range Calibration Skeleton Epic — COMPLETED
`RANGE-CAL-001A`
- workspace/context builder.

`RANGE-CAL-001B`
- elicitation engine/answer loop.

`RANGE-CAL-001C`
- persistence/resume/profile library.

`RANGE-CAL-001D`
- Matrix inspection/correction.

`RANGE-CAL-001E`
- detailed mixes/calibration quality UX.

`RANGE-CAL-001R`
- independent product/persistence/performance QA.

Visible milestone:
> A user can teach Riverline one RFI profile/mode through fast dominant-action answers, safely resume later, and inspect/correct the direct range.

### Phase C — Inference Epic — DEFERRED
`RANGE-CAL-002A` — COMPLETED
- transparent similarity baseline.

`RANGE-CAL-002B`
- confidence/holdout validation.

`RANGE-CAL-002C`
- boundary detection/next-best question.

`RANGE-CAL-002D`
- inferred Matrix/uncertainty queue.

`RANGE-CAL-002R`
- independent inference-quality review.

Visible milestone:
> Riverline reconstructs a recognizably useful range from substantially fewer questions than a full 169-hand form, while clearly separating direct and inferred data.

### Phase D — Mode relationships and style foundation — DEFERRED
`STRATEGY-FOUNDATION-002`
- analyze relationships among three modes;
- keep modes discrete if no valid continuum exists;
- interpolation only where evidence supports it;
- extrapolation/clamping/confidence rules;
- later redefine existing style sliders from real anchors.

### Phase E — Cross-Riverline integration — DEFERRED
`STRATEGY-FOUNDATION-003`
- selectable personal StrategyProvider source;
- Playbook;
- Matrix;
- Training reference options;
- Analysis;
- postflop range assumptions;
- provenance/confidence presentation;
- fallback preserved.

### Feature Wave 1
- polished Range Builder;
- Range Teacher/Profiler;
- mistake history;
- targeted re-drilling;
- Training filters;
- Compare Spots.

### Product Wave 1
- richer Home after the completed `HOME-001` checkpoint and account foundation;
- new Saved content types and richer library workflows after the completed Hand/Spot foundation;
- layout/density personalization;
- per-feature tutorial maintenance for new workflows.

### Feature Wave 2 — preserved after higher-priority checkpoints
- leak detection;
- Concept Mastery;
- adaptive/daily sessions;
- optional streaks if later approved;
- similar-spot exploration;
- richer bluff/value coaching;
- deeper Replay/study integration;
- range-vs-range.

### Platform Wave
- accounts;
- cloud sync;
- friends;
- sharing;
- collaborative study;
- profile/range versioning/history.

### Advanced Math Wave
- solver/reference anchors;
- datasets;
- model training;
- validated model StrategyProviders;
- better postflop strategy.

### Independent/parallel branches
- Home Game Organizer;
- richer table presentation;
- mobile;
- eventual PLO investigation.


## 38. Remaining open questions requiring explicit product decisions

The highest-leverage calibration questions have now been resolved. The following remain open or partially open and should be answered when the relevant phase approaches.

### Personal Strategy / Calibration
1. **Training evidence UX — PARTIALLY OPEN.** Per-session opt-in is selected. Decide exact placement/default behavior after the first calibration prototype exists.

2. **Mode naming/order UX — PARTIALLY OPEN.** Three user-named modes are locked. Decide the initial creation/editing UX and whether a profile should suggest default names. Numeric ordering/interpolation is explicitly deferred until calibration data shows it is meaningful.

3. **Conflict clarification UX — OPEN.** When Training repeatedly contradicts direct calibration data, determine when Riverline should ask whether the named profile should be revised.

### Product / Presentation
4. **Richer Home scope after accounts — PLANNED.** `HOME-001` is complete. After account identity/foundation, decide the bounded composition of a substantially richer “my Riverline” Home using real user/study state.

5. **Gamification depth — DEFERRED.** Streaks remain a future option. XP/levels/badges/achievements are deliberately undecided.

6. **Tutorial policy — LOCKED.** Tutorial foundation and current-app coverage are checkpointed. Every future meaningful visible feature/workspace owns its tutorial definition/update, anchors, localization, accessibility, RTL, and reduced-motion acceptance in that feature ticket.

### Social / Platform
7. Sharing scope desired first:
   - public link;
   - friend-only;
   - private invite;
   - downloadable file;
   - several of these?

8. Should shared ranges/profiles be cloneable/forkable by default?

9. Should friends be able to comment/annotate ranges/spots, or should sharing initially be read-only?

### Strategy / Reference
10. When “My Strategy” differs from Riverline reference, which should Training grade against by default?
   - Riverline reference;
   - selected personal profile;
   - user chooses per drill.

11. When the current heuristic fallback and personal Baseline disagree strongly, should Riverline:
   - show both;
   - default to one;
   - use disagreement as a calibration/review flag?

### Home Game Organizer
12. First intended scope:
   - only money/buy-ins/settlement;
   - plus seats/button;
   - plus statistics/history;
   - plus player profiles?

### Platform / Release
13. Is public release still a distant goal, or should the new personal-profile architecture be treated as the beginning of eventual public-product preparation?

14. Do you envision eventual monetization/subscriptions, or is that intentionally out of scope for planning for now?

### PLO
15. PLO priority:
   - distant “maybe someday”;
   - serious post-Hold’em expansion target;
   - something to actively preserve architectural compatibility for now?



### Current decision-state snapshot

**LOCKED**
- calibration is per named profile;
- multiple named profiles early;
- 3 user-named strategy modes/anchors per profile initially;
- one-click answers mean dominant action, never implicit 100% purity;
- mixed-frequency entry always available;
- Training evidence is per-session opt-in and preserved separately from direct calibration answers;
- conflict evidence is preserved, surfaced, and later clarified rather than silently overwriting;
- RFI/open ranges first;
- local-first/private/exportable personal data.

**PLANNED**
- Personal Strategy continuation from the accepted foundation at `RANGE-CAL-002B`;
- Range elicitation/inference/style anchors;
- Range Builder/Teacher;
- mistake review / targeted drilling;
- Compare Spots;
- richer bluff/value analysis;
- richer Home after account foundation;
- per-feature tutorial maintenance for every future visible feature/workspace;
- accounts/sync/sharing later;
- Section 34 idea set.

**DEFERRED**
- heavy gamification decision;
- PLO implementation;
- major social/platform implementation;
- full cloud backend;
- large table/dealer/chip animation system.

**OPEN**
- exact 3-anchor labels/positions;
- final Training-evidence opt-in UX;
- social sharing permissions;
- Training reference-source defaults;
- Home-game organizer first scope;
- public-release/monetization timing;
- PLO priority level.


## 39. Decision log policy

This document should maintain explicit decision states:

- **LOCKED** — explicit product decision; future agents should not override casually.
- **PLANNED** — accepted roadmap item.
- **CANDIDATE** — interesting idea, not committed.
- **DEFERRED** — intentionally postponed.
- **REJECTED** — should not be revived without new evidence.
- **OPEN** — needs user decision.

Future revisions should move items between these states instead of silently rewriting history.

## 40. Active next step

`PREFLOP-SANITY-001` is **ACTIVE NEXT**. Characterize the known heuristic smoothing leak before changing it, then suppress meaningless Fold mass for AA and similarly clear premiums only in ordinary supported chip-EV contexts. Do not blanket-zero every premium in every situation, introduce unmodelled ICM/satellite assumptions, or resume broad intuition-based tuning. Preserve smoothness at legitimate boundaries and require focused invariants.

After that clean checkpoint, proceed to `BLUFF-001`, then account-ready identity architecture, richer Home, and the separate Home Game Organizer. `CURRENT_PHASE.md` owns the exact current sequence and resume map; `PRODUCT_BACKLOG.md` owns preserved future detail. Personal Strategy remains safely checkpointed and resumes at `RANGE-CAL-002B` when reprioritized.
