# Training Intelligence

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

## Product purpose

Training Intelligence is Riverline's long-term program for turning isolated legal exercises into a persistent, evidence-grounded learning loop: remember what was shown and answered, revisit useful mistakes or uncertainty, re-drill the same or similar spots, space review over time, and summarize recurring patterns honestly.

It extends the learning experience around current Training authorities. It does not replace the Training Practice Planner, canonical legal generator, session/grading modules, StrategyProvider, StrategyClaimPolicy, Replay, Saved, or Personal Strategy evidence models.

## User jobs / why it matters

Users should eventually be able to:

- resume a real Training session and understand what it contains;
- find decisions marked for review, uncertainty, or later practice;
- repeat the exact spot reproducibly;
- practice a similar spot and see which dimensions changed;
- receive spaced/adaptive review based on durable study history;
- filter and save useful drill scopes;
- see session trends without fake accuracy, mastery, or sample-size certainty;
- compare a chosen action with a selected reference and intended Personal Strategy as separate roles;
- opt in explicitly before Training behavior becomes Personal Strategy observation;
- move between Training, Replay, Deep Review, Analyze, Saved, and Home without losing evidence continuity.

## Existing foundation

- [Training Practice Planner](../TRAINING_PRACTICE_PLANNER_SPEC.md) defines deterministic Varied/Focused structural target selection through `TrainingSessionIntent v1` and `TrainingScenarioRequest v1`. It does not construct cards, actions, bets, state, strategy results, or grades.
- The canonical Training generator/session/grading application modules remain the only legal-trajectory and answer-outcome authorities, as summarized in the [Architecture Contract](../ARCHITECTURE_CONTRACT.md).
- [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) requires public Training wording such as Matches/Close/Differs for generalized comparative sources and reserves normative wording for authorized capabilities.
- [DecisionContext](../DECISION_CONTEXT_SPEC.md) supplies exact decision evidence and provenance where canonical state supports it.
- [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md) owns current durable Hand/Spot notes, tags, review flags, and Replay reopening. Training does not yet have approved Saved Drill/Session/Review payloads.
- [Personal Strategy Foundation](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md) separates direct intended evidence from an explicitly opted-in immutable Training observation.
- [Home Dashboard](../HOME_DASHBOARD_SPEC.md) exposes unsupported Training-history seams rather than inventing accuracy, mastery, or resumable history.
- [Tutorial and onboarding](../TUTORIAL_ONBOARDING_SPEC.md) owns current help lifecycle; Training Intelligence does not create another tutorial system.
- [Training Memory v1](../TRAINING_MEMORY_V1_SPEC.md) now owns durable profile-scoped DecisionRecord/session evidence, frozen answer-time source/claim snapshots, bounded recent/review queries, exact historical Same Spot, and planner/generator-backed current Similar Spot.

Current Training is legal, deterministic, planner/provider-backed, source-aware, and durably remembers Varied, Focused, and Full Hand Hero decisions. The v1 queue uses transparent comparative/user-study reasons and reversible reviewed/snoozed lifecycle; it does not claim heuristic disagreement is a mistake. Advanced spaced/adaptive scheduling, rich filters/trends, Saved Drill payloads, Home/Replay/Analyze continuity, and Personal Strategy observation remain future work.

Human product evidence also establishes a durable composition direction for `TRAINING-COMPOSITION-001`: one conceptual session start has one primary CTA; useful setup and status are top-packed; the pre-answer and post-answer states retain one stable workspace skeleton; and Action History, Assistance, Training Memory, feedback, and explanation receive explicit roles instead of appearing as competing or empty panels. This is presentation ownership only and does not change Training generation, grading, session, or memory authority.

## Desired future behavior

Training Intelligence should preserve:

- durable DecisionRecord and session history;
- exact source/version/context at the time of each answer;
- shown, answered, skipped, abstained/uncertain, interrupted, and unavailable states as explicitly defined events;
- persistent mistake/review queue without turning every disagreement into objective error;
- reproducible same-spot re-drill;
- versioned, explainable similar-spot re-drill;
- spaced and adaptive review based on durable history and transparent scheduling inputs;
- filters and Saved drill definitions over approved context dimensions;
- recurring-pattern detection with minimum evidence thresholds;
- honest session summaries and trends;
- Home, Replay, Deep Review, Analyze, and Saved continuity;
- selected-reference and Personal Strategy comparison as distinct roles;
- explicit per-session/profile/mode opt-in before recording observed Personal Strategy evidence;
- later opponent-policy drills through canonical full-hand generation.

A future supported summary might say:

> Most disagreements this session came from defending BB too tightly against small BTN opens.

Riverline may say this only when durable comparable decisions, exact role/sizing context, a selected authorized comparison source, and an explicit summary rule support it. It must also state the sample and source limitations.

## Structured facts / evidence required

A future Training decision/session history may need:

- stable session, exercise, ordinal, mode, and deterministic reproduction identity;
- planner intent/request/policy version, target envelope, relaxation reason, and served state;
- immutable rules snapshot/fingerprint and canonical generated Hand/decision source;
- exact `DecisionContext`, cards/board/street, positions, stacks, pot, price, legal actions, sizing bounds, and bounded history;
- exercise presentation state: shown, answered, skipped, uncertain/abstained, interrupted, failed generation, unavailable source, or completed as explicitly contracted;
- chosen action and exact sizing;
- `StrategyResult`, source ID/version, coverage, capabilities, limitations, and claim-policy interpretation used at answer time when historical comparison is retained;
- internal grade facts separately from permitted public semantics;
- factual hand/range/bluff/Equity evidence shown after the answer;
- selected Personal Strategy profile/mode and explicit observation opt-in, if any;
- same-spot reproduction link and similar-spot policy/version plus changed dimensions;
- review-queue reason, scheduling facts, due/served/reviewed events, and user overrides;
- Saved Drill/Session/Review relation when approved payload owners exist;
- later opponent-policy identity/version and assumptions;
- uncertainty, missing evidence, incompatible contexts, and source changes.

The first implementation should store only what its user job cannot truthfully reconstruct. Derived summaries, schedules, trends, and prose remain recomputable read models or caches where possible.

## Authority, provenance and uncertainty rules

- `TrainingPracticePlanner` owns structural target planning only; the canonical generator owns cards, actions, PokerState, legality, pot, and trajectories.
- Planner sizing families are generation targets, never recommendations or grades.
- Training calls the same `StrategyProvider` as other consumers and has no Training-only fallback.
- `StrategyClaimPolicy` controls whether a comparison may be generalized alignment or stronger normative wording.
- Comparative heuristic disagreement is not objective poker correctness, EV loss, or proof of a mistake.
- Internal grading math may support deterministic session behavior, but public history/summaries must preserve source authority and limitations.
- Reference strategy, intended Personal Strategy, observed Training behavior, and opponent policy remain distinct.
- Training observation requires explicit profile/mode choice and consent; it never overwrites direct Personal Strategy evidence.
- Unknown/unavailable source, price, history, or range remains explicit and cannot become a zero, failure, or incorrect answer.
- Same-spot re-drill must preserve reproducible identity; similar-spot re-drill must name its selection policy/version and changed dimensions.
- Historical comparisons must retain sufficient source/version/coverage/capability identity or be labelled as current re-analysis.
- Study frequency or answer volume alone does not establish mastery.

## Preserved interactions and microfeatures

- Persistent Review Later, mistake/uncertainty, and user-selected re-drill actions after an answer.
- Repeat exact spot with deterministic reproduction and no accidental planner-coverage distortion.
- Practice similar spot with a concise explanation of what stayed fixed and what changed.
- Filter by mode, source, position, stack, street, decision family, sizing family, date, review state, or saved drill where evidence supports it.
- Save a drill definition through an approved Saved payload rather than a parallel Training bookmark store.
- Move from an answer to the selected decision in Deep Review, Replay, or Analyze.
- Show session progress, due review, and scheduling reason without reward-loop pressure.
- Inspect source/version/provenance and why a result is Matches/Close/Differs or unavailable.
- Compare reference, Personal Strategy, and observed action in separate labelled layers.
- Explicitly enable or disable Personal Strategy observation for the chosen session/profile/mode.
- Open a session summary's claim to the contributing decisions.
- Keep mouse, keyboard, focus, tap/disclosure, RTL, and reduced-motion behavior equivalent.

## Cross-surface applicability

- **Varied / Focused Training:** primary consumers for DecisionRecord, session memory, review queue, and same/similar re-drill.
- **Full-Hand Training:** shares canonical Hand, Replay, and Deep Review continuity while retaining its distinct visible-hand mode.
- **Deep Hand Review / Replay:** applicable to completed decisions, actual state, source-aware comparison, and re-drill actions.
- **Analyze:** receives an explicit selected decision; it does not become Training history storage.
- **Home:** consumes bounded continue/review/due/session summaries only after canonical history exists.
- **Saved:** owns future Drill/Session/Review payloads and user annotations when separately approved.
- **Personal Strategy:** receives observed evidence only through explicit opt-in and existing immutable evidence authority.
- **Opponent Intelligence:** later supplies explicit policy identity for targeted/full-hand practice; it does not replace the generator or grader.
- **Matrix / Range tools:** may inspect supported source or Personal Strategy facts; they do not infer Training history from UI state.

## Presentation depth

- **Facts:** exact exercise/context/action, source/version/coverage, comparison semantics, review/scheduling events, sample size, and uncertainty.
- **Explain:** concise supported account of why this decision entered review, how the source comparison applies, or what changed in a similar re-drill.
- **Coach / Summary:** recurring session/cross-session pattern and recommended next study scope only with enough comparable evidence and explicit limitations.

Facts-only history and dense filters remain available. In the practice workspace, Facts stay closest to the decision/result, Explain follows through concise disclosure, and Coach/Summary occupies later/deeper space only when evidence supports it. Coach/Summary should never be mandatory bulk or replace exact decision access.

## Dependencies

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md);
- a versioned minimum DecisionRecord/session contract;
- existing planner/generator/session/grader deterministic boundaries;
- StrategyResult/ClaimPolicy source snapshots for historical comparisons;
- approved Saved Drill/Session/Review payloads and queries;
- Deep Hand Review and Replay routes over canonical state;
- explicit similar-spot dimensions and policy version;
- a transparent scheduling policy with user overrides and no engagement manipulation;
- Personal Strategy observation consent and profile/mode selection;
- opponent-policy contract before opponent-specific drills;
- localization, accessibility, privacy, export/import, sync, and performance/invalidation decisions.

## Suggested implementation slices

These are possible future boundaries, not roadmap priority:

1. **Implemented by Training Memory v1:** smallest durable DecisionRecord/session history with exact source/context/reproduction identity.
2. **Implemented by Training Memory v1:** bounded History and Review queries plus exact same-spot re-drill.
3. **Implemented by Training Memory v1:** explainable similarity dimensions and planner/generator-backed bounded generation.
4. Add spaced/adaptive scheduling over durable review events with explicit reason and override.
5. Add Saved Drill definitions and Home/Replay continuity through approved payload owners.
6. Add truthful session summaries/trends with evidence thresholds and facts drill-down.
7. Add explicit Personal Strategy observation opt-in and source-separated comparison.
8. Add opponent-policy/full-hand drills only after their behavior contract exists.

## Competitive/reference lessons

Existing [Table Presence competitive reference](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md) records useful mature patterns:

- DTO connects practice, immediate feedback, deeper evaluation, retry/continue, and repeated drills while keeping the table separate from full analysis.
- Advanced Poker Training emphasizes fast repetition, targeted spots, reports, and understandable questions around measures.
- GTO Wizard's Full Hand observations support chronological review and direct continuation from play to study.
- Riverline must adapt all scoring/feedback language to actual source authority and reject casino presentation, unsupported correctness claims, and long-form coaching inside the live decision.

The durable lesson is a short, truthful practice-review-repractice loop with evidence continuity. No new competitive research was performed for this dossier.

## Failure modes / non-goals

- No second Training generator, PokerState, legal-action engine, grader, StrategyProvider, Replay, or Saved store.
- No planner coverage counters treated as learning progress or real-world poker frequency.
- No generalized heuristic disagreement labelled correct/incorrect, EV loss, GTO score, or objective mistake.
- No accuracy/mastery/streak claim without a valid concept, history, and source semantics.
- No XP, badges, levels, achievements, competitive rating, or engagement theater by default.
- No silent Personal Strategy evidence collection or rewriting of direct intended evidence.
- No “similar” spot chosen by an opaque model with no changed-dimension explanation.
- No review scheduling optimized for engagement rather than user-controlled learning value.
- No fabricated Home history, summaries, or due counts before canonical persistence exists.
- No eager hidden strategy/Equity/range work or violation of performance invalidation.
- No attempt to implement this future program inside the current Practice Planner contract.

## Open product questions

- **Training “Not sure” behavior — OPEN PRODUCT QUESTION:** Does “Not sure” abstain without grading, reveal the selected reference then queue review, count as an answered decision with explicit uncertainty, repeat immediately, or follow another exact rule? Its effect on session progress, planner served coverage, history, summaries, Personal Strategy observation, and re-drill must be decided together. It must not be silently equated with Fold, Skip, incorrect, or missing data.
- Retention duration/export remains open; the minimum v1 DecisionRecord payload is specified in `TRAINING_MEMORY_V1_SPEC.md`.
- V1 review reasons and Same/Similar dimensions are specified; later contradiction, Personal Strategy, uncertainty, and relaxed-dimension policy require new versions.
- Source-version handling is resolved for v1: original evidence remains frozen/historical and Similar Spot uses a separately labelled current provider.
- What scheduling policy is understandable, user-controllable, and resistant to reward-loop pressure?
- Which session trends are meaningful before trusted reference coverage broadens?
- Where should Personal Strategy evidence opt-in live, and what should its default be?
- What Saved Drill/Session/Review payloads are needed first?
- Should restrained study goals or streaks exist at all, and what real activity/history would support them?
- What first opponent-policy drills provide learning value without cartoon difficulty labels?

## Legacy/recovered IDs and ideas

- **Training Memory / DecisionRecord:** implemented in v1 as durable shown/answered/source/version/context/session evidence; planner state remains structurally separate.
- **same-spot / similar-spot re-drill:** implemented in v1 with reproducible historical identity and transparent current-generation dimensions; sophisticated spaced/adaptive scheduling remains preserved future work.
- **exact Training “Not sure” behavior:** preserved as an open product question; it must not disappear into generic Skip semantics.
- **STUDY-GOALS-001:** preserved as a restrained future capability requiring real study history and explicit product approval.
- **GUIDED-TUTORIALS-002:** evolved into the current tutorial/onboarding authority plus future context-specific learning guidance; Training Intelligence does not create a parallel help lifecycle.
- **XP / badges / levels / achievements:** rejected by default as engagement theater unless new evidence and an explicit product decision reverse the policy.

## Related specs/capabilities

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md)
- [Deep Hand Review](DEEP_HAND_REVIEW.md)
- [Opponent Intelligence](OPPONENT_INTELLIGENCE.md)
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md)
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md)
- [Reference Strategy Evolution](REFERENCE_STRATEGY_EVOLUTION.md)
- [Range Evolution](RANGE_EVOLUTION.md)
