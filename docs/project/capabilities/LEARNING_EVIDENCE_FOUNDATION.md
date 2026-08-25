# Learning Evidence Foundation

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

## Product purpose

Riverline's deeper learning capabilities need a trustworthy evidence substrate: enough versioned, provenance-aware information to explain a decision, revisit it later, compare it with different strategic roles, and re-drill it without silently changing what was known at the time.

This dossier is a dependency map and retention philosophy. It is not a database design, a new aggregate schema, or approval for a broad persistence migration. Each implementation ticket must choose the smallest versioned payload or relationship that its owning capability actually requires.

## User jobs / why it matters

Users should eventually be able to:

- reopen a decision and see the exact situation that produced it;
- distinguish what Riverline knew then from what it can calculate now;
- understand which selected reference, Personal Strategy mode, observed action, or opponent assumption informed a judgment;
- compare decisions across a hand or session without mixing incompatible contexts;
- save notes and review intent without duplicating the underlying poker state;
- repeat the same spot or generate a meaningfully similar one from explicit criteria;
- see uncertainty caused by missing evidence instead of receiving a confident reconstruction;
- benefit from future Riverline improvements without having historical judgments silently rewritten.

## Existing foundation

Current foundations already define separate authorities that future evidence payloads must reuse:

- [Game Rules v1](../GAME_RULES_V1_SPEC.md) owns immutable rules snapshots and their semantic identity.
- [DecisionContext v1.1](../DECISION_CONTEXT_SPEC.md) owns the bounded strategy/analysis decision snapshot and derivation provenance.
- [Strategy Source Authority and Claim Policy](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) separates source identity, version, provenance, authority, coverage, capabilities, and permitted claims.
- [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md) owns current Saved Hand/Spot durability, annotations, source identity, and canonical Replay reopening.
- [Training Practice Planner](../TRAINING_PRACTICE_PLANNER_SPEC.md) owns structural Training targets while the canonical generator owns legal trajectories.
- [Personal Strategy Foundation](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md) owns sparse immutable intended-strategy and observed Training evidence, including contradictions and provenance.
- [Range Core](../RANGE_CORE_SPEC.md) owns combo-level weighted-range truth and provenance.
- [Architecture Contract](../ARCHITECTURE_CONTRACT.md) preserves one production authority per concept.

Current Saved Hand/Spot objects do not freeze historical `StrategyResult` analysis, and current Training does not yet provide durable DecisionRecord/session history. Those limitations remain truthful until separately versioned owners exist.

## Desired future behavior

Where a capability genuinely needs it, Riverline should be able to preserve or reconstruct:

- canonical Hand or explicitly lossy Scenario identity;
- the decision's canonical state and `DecisionContext`;
- exact Hero/opponent cards when legitimately known, board, street, and dead/excluded cards;
- player, position, table-size, and rules structure;
- starting, live, and effective stacks;
- current pot, incremental call price, contributions, and legal sizing bounds;
- bounded prior action history and the action actually chosen, including sizing;
- selected reference source, version, assumptions, coverage, capabilities, and limitations;
- resolved `StrategyResult` facts where a historical judgment depends on them;
- Personal Strategy profile, mode, version, result, evidence basis, and uncertainty where used;
- observed-action provenance without relabeling observation as intent;
- relevant range state, conditioning, coverage, and provenance;
- opponent model or policy identity/version and its evidence assumptions where used;
- factual hand, board, draw, blocker, and runout analysis;
- review annotations and the relation to a Saved object;
- Training session/exercise membership and deterministic reproduction identity;
- later review, same-spot/similar-spot re-drill, and outcome history;
- explicit evidence quality, unavailable facts, and uncertainty.

The substrate should connect bounded versioned objects and events rather than grow one giant redundant record.

### STORE DURABLY

Store a fact durably when it is user-authored, externally observed, non-reconstructible, required to reproduce a historical judgment, or the stable identity of evidence used at that time. Depending on the owning ticket, that can include:

- user choices, exact chosen sizing, notes, tags, review flags, and explicit consent;
- canonical versioned Hand/Scenario/decision source identity sufficient for truthful reconstruction;
- the immutable rules snapshot or semantic fingerprint required by the owning contract;
- session/exercise identity, deterministic seed/replay identity, and served/answered events;
- selected reference source ID/version and the authority, coverage, capability, assumption, and limitation snapshot used for a frozen judgment;
- a resolved strategy/personal/opponent result when the historical interpretation cannot be reproduced from durable inputs alone;
- Personal Strategy profile/mode/evidence identity and observed-action provenance when a comparison used them;
- range or opponent-policy identity/version when later mutation would otherwise change the meaning of the decision;
- links among a decision, Saved object, Training session, review event, and re-drill event;
- explicit unknown/unavailable states when their absence is semantically meaningful.

Historical judgments must retain enough source and version identity that a newer provider registry, policy, evaluator presentation, Personal Strategy snapshot, or opponent model cannot silently rewrite what Riverline showed or knew at the time. A current re-analysis may be offered separately and labelled as current.

### DERIVE DETERMINISTICALLY

Derive rather than duplicate facts when canonical versioned inputs and the applicable domain contract can reproduce them exactly. Examples can include:

- actor, street, pot, contributions, legal actions, and action history from canonical PokerState;
- `DecisionContext` facts and their derivation quality from a canonical Hand;
- made-hand rank, canonical best five, draw classes, and structural blocker facts from exact cards and board;
- effective-stack and price facts from exact state;
- normalized range composition and Matrix projections from a versioned weighted range;
- same-hand Replay frames from the canonical transition source;
- current summaries, counts, and ordering from durable decision/review events.

Derivation must name the contract/version that gives it meaning. If future code cannot faithfully reproduce a historical interpretation, the owning feature must preserve the necessary historical result or versioned algorithm identity rather than pretending today's derivation is identical.

### CACHE OR RECOMPUTE

Cache or recompute expensive or presentation-oriented outputs when their inputs, policy versions, and invalidation keys are explicit. Likely examples include:

- canonical Equity results and runout aggregations when the owning contract permits recomputation;
- range-analysis projections and grouped equivalent paths;
- natural-language explanations and session/profile summaries;
- recurring-pattern detection, review priority, and similar-spot candidates;
- Home/dashboard aggregates, trends, and counts;
- UI projections such as tables, timelines, charts, and Facts/Explain/Coach views.

A cache never becomes evidence authority. It must be safe to discard, and a recomputed result that uses newer evidence or policy must be identified as a new interpretation.

## Structured facts / evidence required

At minimum, an evidence-bearing feature should declare:

| Evidence dimension | Required distinction |
|---|---|
| State kind | canonical Hand, lossy Scenario, Training-generated state, or hypothetical branch |
| State identity | versioned source, rules identity, cards/board/street, actors, stacks, pot, price, legality, and history where available |
| User event | shown, chosen, skipped/abstained, sized, saved, annotated, reviewed, or re-drilled |
| Strategy role | selected reference, generalized fallback, intended Personal Strategy, observed behavior, opponent model, or unavailable |
| Source identity | stable ID, version, origin, assumptions, coverage, capabilities, and limitations |
| Derived facts | algorithm/contract family, inputs, provenance, and known omissions |
| Relationship | Hand, decision, session, Saved object, review, and re-drill membership |
| Quality | exact, derived, defaulted, normalized, partial, stale, unknown, or unavailable as appropriate |
| Time | occurrence time and, when relevant, source/model validity time; never a substitute for version identity |

No global confidence number may erase these distinctions.

## Authority, provenance and uncertainty rules

- Canonical poker state, legality, accounting, evaluator, Equity, range, strategy, Training, Saved, and Personal Strategy authorities remain separate.
- A durable record preserves evidence; it does not upgrade that evidence's authority.
- Reference strategy, intended Personal Strategy, observed behavior, and opponent policy are separate semantic roles even when displayed together.
- Source branding, a model label, a large sample, or numeric confidence does not grant normative strategy authority.
- Scenario lossiness, partial range coverage, missing opponent cards, unavailable prices, and absent history remain explicit.
- User-entered notes and “Mistake” flags are annotations, not objective grading.
- Historical source/version snapshots are immutable evidence; current re-analysis is a separately labelled projection.
- Privacy and data minimization apply to real opponents, hidden cards, imported hands, and cross-device sharing. Store only what the approved user job requires.
- No capability may infer consent to collect observed Personal Strategy or real-opponent evidence.

## Preserved interactions and microfeatures

- Open the exact decision from Hand, Replay, Saved, Training, or a later summary.
- Inspect the evidence and provenance behind a comparison without leaving the learning flow.
- Move from a summary to the contributing decisions, then back without losing context.
- Save or annotate through the one Saved Study authority.
- Re-drill the same spot from reproducible identity; label a similar spot with the dimensions that changed.
- Compare “then” with “current” analysis without overwriting either interpretation.
- Expose unknown/unavailable evidence rather than substituting zero, false, or a generic confidence score.
- Keep hypothetical branches visually and semantically distinct from the actual recorded Hand.

## Cross-surface applicability

- **Hand / Replay / Deep Review:** applicable for canonical history, decision identity, review navigation, and source-aware comparisons.
- **Analyze / Equity:** applicable when preserving a user-owned study result or linking an analysis to its exact inputs; ordinary transient calculation need not be saved.
- **Training:** central to future DecisionRecord, session history, re-drill, and summaries.
- **Personal Strategy:** applicable through existing immutable evidence identities and explicit observed-evidence opt-in.
- **Saved / Home:** Saved owns durable study objects; Home consumes bounded aggregates and never invents history.
- **Opponent Intelligence:** applicable only with explicit evidence/provenance/privacy and policy/model versions.
- **Matrix / Builder / Teacher:** applicable through Personal Strategy and range authorities, not by copying UI state.
- **Settings and unrelated presentation surfaces:** normally not evidence consumers.

## Presentation depth

- **Facts:** exact state, action, source/version, coverage, evidence quality, and related decision/session records.
- **Explain:** concise supported account of why a fact or comparison matters, including the reference frame and limitations.
- **Coach / Summary:** cross-decision, cross-session, or cross-profile synthesis only when enough comparable evidence exists; every claim remains traceable to contributing facts.

Facts-only inspection must remain available. Presentation depth never changes underlying evidence or authority.

## Dependencies

- stable canonical state and versioned rules identity;
- DecisionContext derivation provenance;
- source authority/coverage/capability snapshots;
- approved DecisionRecord/session and Saved payload owners;
- canonical range and factual-analysis contracts;
- explicit Personal Strategy and opponent-policy role boundaries;
- privacy, export/import, retention, and migration decisions for each durable payload;
- deterministic identifiers and invalidation keys for derived/cached projections.

## Suggested implementation slices

These are possible future boundaries, not roadmap priority:

1. Define the minimum durable DecisionRecord evidence needed by Training Memory without introducing a universal event schema.
2. Link Training decisions, sessions, Saved review state, and same-spot reproduction through approved versioned identities.
3. Preserve frozen reference/result provenance only for review/history features that require historical interpretation.
4. Add derived summary and re-drill queries over durable evidence, keeping caches disposable.
5. Extend evidence links to Personal Strategy and opponent models only after their explicit consent/version contracts exist.
6. Add “then versus current” analysis when both interpretations can be labelled truthfully.

## Competitive/reference lessons

Existing Riverline competitive work supports continuity from play to review, compact provenance, strict job-specific hierarchy, and explicit unavailable states. It also rejects fabricated mistake ranking and solver-score theater. See [Table Presence competitive reference](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md).

The transferable lesson is to retain the evidence spine behind useful review and repeated practice, not to copy a competitor's data model, scoring system, proprietary strategy, or engagement mechanics. No new competitive research was performed for this dossier.

## Failure modes / non-goals

- No giant catch-all “learning record” containing redundant poker state, rendered copy, and every future field.
- No second PokerState, evaluator, Equity, range, Replay, Training, Saved, or Personal Strategy authority.
- No silent reinterpretation of historical judgments with today's provider registry or model.
- No storing presentation frames, generated prose, or caches as canonical truth.
- No fake accuracy, mastery, EV loss, GTO score, or confidence derived from generalized heuristic disagreement.
- No cross-profile or real-opponent evidence collection without explicit identity, consent, and privacy boundaries.
- No schema migration is proposed or approved by this dossier.
- No requirement to persist every transient calculation or UI interaction.

## Open product questions

- What is the smallest first DecisionRecord payload that supports re-drill and honest session history?
- Which historical results must be frozen, and which can be recreated from versioned inputs?
- How long should detailed decision/opponent evidence be retained, and what user deletion/export controls are required?
- Which dimensions define “similar” without presenting similarity as strategic equivalence?
- How should “then” and “current” interpretations be compared when evidence or policy versions differ?
- Which summaries merit durable user-authored annotations versus disposable recomputation?
- What evidence threshold is required before a recurring pattern or coaching summary is shown?

## Legacy/recovered IDs and ideas

- **Training Memory / DecisionRecord and session history:** preserved as the first major consumer of this foundation; current Training planner state is not a substitute.
- **PROFILE-SNAPSHOT-001:** related future need for versioned Personal Strategy experiments/rollback; owned by Personal Strategy rather than a global evidence snapshot.
- **NOTES-TAGS-001:** implemented in bounded form for current Saved Hand/Spot objects and preserved for later approved study-object kinds through the Saved capability.
- **ANALYSIS-PERSONALIZED-001:** preserved as a future evidence-grounded comparison, not permission to merge Personal Strategy with reference authority.

## Related specs/capabilities

- [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md)
- [Deep Hand Review](DEEP_HAND_REVIEW.md)
- [Training Intelligence](TRAINING_INTELLIGENCE.md)
- [Opponent Intelligence](OPPONENT_INTELLIGENCE.md)
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md)
- [Range Evolution](RANGE_EVOLUTION.md)
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md)
- [Equity Hand Analysis](EQUITY_HAND_ANALYSIS.md)

