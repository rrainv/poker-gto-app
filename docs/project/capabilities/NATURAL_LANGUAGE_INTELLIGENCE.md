# Natural-Language Intelligence

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

## Product purpose

Riverline should combine broad poker study tooling with deeply integrated, evidence-grounded natural-language learning intelligence. Language should help a user notice what matters, understand supported reasons, and connect patterns across decisions without hiding the underlying facts.

Natural language is presentation and synthesis, not poker authority. This dossier does not approve an LLM runtime, external service, model provider, persistence schema, or implementation ticket.

## User jobs / why it matters

Users should be able to:

- get a concise explanation of a dense factual result;
- ask what changed between two decisions, ranges, modes, or versions;
- understand why Riverline is uncertain or why a source is unavailable;
- review a hand or session as a coherent learning story;
- trace every material claim back to structured evidence;
- suppress narrative and inspect dense facts when prose adds no value;
- receive summaries appropriate to the available evidence rather than generic poker advice.

## Existing foundation

- [Architecture Contract](../ARCHITECTURE_CONTRACT.md) keeps renderers and explanations downstream from canonical poker, strategy, Equity, range, Training, and Saved authorities.
- [Analysis Range specification](../ANALYSIS_RANGE_SPEC.md) defines `RangeAnalysisFacts v1 -> AnalysisExplanation v1 -> renderer` and keeps provenance grouped by source.
- [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) controls which source-grounded strategy claims a consumer may make.
- [DecisionContext](../DECISION_CONTEXT_SPEC.md), [Range Core](../RANGE_CORE_SPEC.md), and [Bluff Analysis](../BLUFF_ANALYSIS_SPEC.md) provide bounded structured facts without turning presentation into mathematics.
- [Personal Strategy Foundation](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md) preserves intended evidence, observation, contradictions, and uncertainty as distinct facts.
- [Product Specification](../PRODUCT_SPEC.md) already favors strict hierarchy, progressive disclosure, and honest provenance.

Current `AnalysisExplanation v1` is a structured explanation boundary. Riverline has no approved general natural-language model runtime, and current heuristic output does not authorize solved-GTO or objective-correctness prose.

## Desired future behavior

The durable direction is:

```text
canonical state and evidence
        -> structured factual analysis
        -> selected reference / Personal Strategy / observed / opponent evidence
        -> provenance and uncertainty
        -> structured explanation model
        -> user-facing projection
```

Never:

```text
cards -> language model guesses poker -> plausible advice
```

Potential applications include:

- Personal Strategy profile and mode summaries;
- range assessment and meaningful range-change summaries;
- Training session summaries and recurring-pattern explanations;
- Deep Hand Review and turning-point narratives;
- Equity, runout, made-hand, draw, nut-status, and blocker explanations;
- value, bluff, semibluff, and bluff-catcher explanations;
- opponent tendency summaries with sample/uncertainty context;
- exploit-versus-reference explanations with explicit model assumptions;
- “Teach Riverline Next” explanations of uncertainty and sparse evidence;
- Saved-study synthesis across related Hands, Spots, Ranges, Drills, Reviews, or Sessions when their payload owners exist.

Language may organize and connect approved facts. It may not manufacture a missing range, opponent tendency, strategy recommendation, causal explanation, or confidence level.

## Structured facts / evidence required

A natural-language claim should be generated from a structured explanation input that can identify:

- canonical Hand/Scenario/Training/hypothetical state and its truth boundary;
- exact cards, board, street, stacks, pot, price, legality, and history when relevant;
- the factual evaluator, Equity, range, bluff, or runout results being described;
- selected source role: reference, generalized fallback, Personal Strategy, observation, opponent model, or unavailable;
- source/model ID and version, context coverage, capabilities, assumptions, and limitations;
- Personal Strategy evidence scope, sparsity, contradictions, and uncertainty;
- opponent sample/context/time window and uncertainty where applicable;
- comparison dimensions and their compatible reference frames;
- contributing decision/session/profile IDs for aggregate summaries;
- unsupported, partial, stale, unknown, or unavailable inputs.

Generated copy should retain machine-readable links back to the supporting fact groups even if the UI reveals them only on inspection.

## Authority, provenance and uncertainty rules

- Natural-language consumers never become poker, strategy, Equity, range, opponent-model, or grading authority.
- A fluent sentence has no more authority than its weakest required structured input.
- `StrategyClaimPolicy v1` still controls normative, exactness, sizing, EV, and optimality language.
- Reference strategy, intended Personal Strategy, observed behavior, and opponent policy remain explicitly named roles.
- Missing evidence stays unknown or unavailable; it is never filled from “general poker knowledge.”
- A summary must state material uncertainty, limited coverage, stale model identity, or small sample size in user-comprehensible terms.
- Comparative heuristic disagreement remains alignment with Riverline's generalized reference, not objective error.
- Natural-language output should be reproducible enough to audit its inputs and policy version; wording need not be stored as truth.
- Any future remote language service requires a separate privacy, data-minimization, redaction, consent, latency, fallback, and failure-mode decision.
- Localization may adapt wording and order but cannot change fact or authority semantics.

## Preserved interactions and microfeatures

- Switch or expand between Facts, Explain, and Coach/Summary without changing the underlying analysis.
- Open the exact facts and provenance supporting a sentence.
- Follow a summary claim to contributing decisions, sessions, or evidence scopes.
- Suppress narrative and keep a dense facts-only presentation.
- Compare source roles side by side without merging their language.
- Mark current versus historical interpretation when source or policy versions differ.
- Explain unavailable/unknown states calmly and identify the next evidence Riverline would need.
- Route “Teach Riverline Next” suggestions directly to the relevant Calibration scope.
- Keep hypothetical-card/runout language visually distinct from actual Hand history.

## Cross-surface applicability

- **Analyze:** applicable for supported decision, range, board, blocker, and bluff explanations.
- **Equity / Runout Explorer:** applicable for factual hand standing, draw paths, split-pot math, and hypothetical outcomes once structured owners exist.
- **Hand / Replay / Deep Review:** applicable for decision-by-decision explanation and supported cross-street synthesis.
- **Training:** applicable after answers and for evidence-backed session/recurring-pattern summaries; long prose does not belong in the live decision.
- **Personal Strategy:** applicable for profile/mode comparisons, sparsity, conflicts, and “Teach Riverline Next.”
- **Opponent Intelligence:** applicable only with context, sample, provenance, and uncertainty.
- **Saved / Home:** applicable to bounded study summaries only after durable contributing records exist.
- **Matrix / Builder / Teacher:** applicable as optional explanation around exact range/evidence facts, not as a replacement for dense visual facts.
- **Settings and unrelated utility flows:** generally not consumers except user preferences for explanation depth or privacy.

Applicability does not require the same amount of prose everywhere. Shared meaning and evidence rules matter more than identical layouts.

## Presentation depth

### Facts

Dense structured information for advanced users: exact state, numbers, range/evaluator facts, source/version, coverage, provenance, and uncertainty. Facts remain usable without narrative.

### Explain

A concise supported account of what matters and why within the available reference frame. Explanation should prefer a few decision-relevant facts over restating every field.

### Coach / Summary

Cross-decision, cross-session, cross-profile, or cross-opponent synthesis only when enough comparable evidence exists. It should name the pattern, evidence scope, uncertainty, and a useful next study action without pretending to diagnose a player from sparse data.

Facts/Explain/Coach is progressive depth, not a global Beginner/Expert identity. Advanced users must be able to tell Riverline to get out of the way and show the facts.

Confirmed hands-on evidence shows that both extremes fail: important decision facts hidden behind weak discovery and a fully expanded explanation that overwhelms the workspace. Each consumer should keep its principal result visible, expose concise local depth near the affected object, and let the user move between Facts, Explain, and Coach/Summary without a large unrelated recomposition.

## Dependencies

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md);
- structured factual contracts for each domain being described;
- source authority, claim policy, and coverage/limitation metadata;
- explicit comparison roles and compatible reference frames;
- versioned explanation policy and traceability to contributing facts;
- optional user preference for default depth and prose suppression;
- localization, accessibility, privacy, latency, offline, and fallback decisions;
- performance/invalidation that avoids recomputing explanations on hidden surfaces.

## Suggested implementation slices

These are possible future boundaries, not roadmap priority:

1. Standardize a structured explanation projection and Facts/Explain controls over existing `AnalysisExplanation` facts.
2. Add one bounded evidence-backed Personal Strategy summary tied to explicit profile/mode evidence.
3. Add Training session summaries only after durable DecisionRecord/session history exists.
4. Extend Deep Hand Review with source-aware cross-street synthesis over recorded decision facts.
5. Add opponent/exploit summaries only after an explicit opponent-policy/evidence contract exists.
6. Evaluate deterministic templates versus a model-assisted renderer under the same authority/privacy contract; do not let implementation choice alter truth rules.

## Competitive/reference lessons

Existing Riverline competitive work finds value in strict job-specific density, direct transitions between play and analysis, compact provenance, and short feedback loops. Advanced Poker Training's public presentation supports translating measures into understandable questions, while the same Riverline review rejects long-form coaching in the live decision surface. GTO Wizard and DTO reinforce that dense facts can remain useful when hierarchy is strict and deeper evaluation is an explicit transition. See [Table Presence competitive reference](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md).

Riverline's differentiation is evidence-grounded explanation plus personal learning continuity, not copying competitor copy, strategy, score language, or visual treatment. No new competitive research was performed for this dossier.

## Failure modes / non-goals

- No language model, prompt, or generated paragraph becomes a poker engine.
- No plausible but unsupported action, range, opponent tendency, reason, or outcome.
- No mandatory narrative clutter for users who prefer facts.
- No invented personality prose from sparse Personal Strategy or opponent evidence.
- No collapse of reference, intended, observed, opponent, or exploit roles into “Riverline recommends.”
- No fake confidence number, accuracy score, EV loss, GTO label, or mastery claim.
- No storage of generated prose as canonical evidence merely to make it durable.
- No long-form coaching inside time-sensitive live Hand or pre-answer Training decisions.
- No hidden network dependency or disclosure of private cards/notes/opponent data.
- No global Beginner/Expert mode introduced by this dossier.

## Open product questions

- What evidence thresholds permit a Coach/Summary claim for a session, profile, or opponent?
- Should explanation depth be global, per surface, remembered per job, or selected ad hoc?
- Which explanation inputs and policy versions must be retained for audit or historical reproduction?
- When is deterministic structured copy sufficient, and when would model-assisted synthesis materially improve learning?
- What local/offline and remote-service privacy guarantees are required before any model-assisted renderer?
- How should users correct a misleading synthesis without treating the correction as poker truth?
- How should EN/RU/HE terminology preserve precise poker roles and uncertainty without unnatural copy?
- How should facts-only, Explain, and Coach layouts behave on smaller screens and assistive technology?

## Legacy/recovered IDs and ideas

- **PROFILE-SUMMARY-001:** preserved and evolved into evidence/provenance/uncertainty-aware Personal Strategy summaries.
- **ANALYSIS-PERSONALIZED-001:** preserved as role-separated analysis using explicit Personal Strategy evidence; it does not authorize personalization by guesswork.
- **BEGINNER-EXPERT-001:** superseded by strong defaults plus Facts/Explain/Coach progressive depth unless later evidence justifies a global mode.
- **BLUFF-COACHING-002:** related future consumer; strategic facts and authority remain owned by the Bluff/Exploit capability.
- **GUIDED-TUTORIALS-002:** current tutorial/onboarding contracts own product guidance; natural-language intelligence must not create a second help system.

## Related specs/capabilities

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Deep Hand Review](DEEP_HAND_REVIEW.md)
- [Training Intelligence](TRAINING_INTELLIGENCE.md)
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md)
- [Equity Hand Analysis](EQUITY_HAND_ANALYSIS.md)
- [Bluff / Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md)
- [Opponent Intelligence](OPPONENT_INTELLIGENCE.md)
- [Range Evolution](RANGE_EVOLUTION.md)
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md)
