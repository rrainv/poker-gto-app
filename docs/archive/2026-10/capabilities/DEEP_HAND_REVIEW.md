# Deep Hand Review

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

## Product purpose

Deep Hand Review is the long-term evolution of Riverline's current shared `hand-review/v1` projection. It should turn a canonical Hand into a coherent, inspectable learning object: what happened on each street, which Hero decisions mattered, how factual and strategic roles evolved, what evidence supports each comparison, and what the user can study next.

Review is a consumer of canonical state and evidence. It must not become another PokerState, Replay timeline, strategy resolver, grader, range engine, Equity engine, Saved schema, or analysis authority.

## User jobs / why it matters

Users should eventually be able to:

- replay the complete Hand while keeping every Hero decision addressable;
- understand state, price, cards, made-hand/draw role, and strategic context at each decision;
- compare the observed action with a selected reference and intended Personal Strategy;
- see where ranges, Equity, bluff/value roles, or opponent assumptions changed;
- distinguish a consequential turning point from a merely different result;
- inspect alternate runouts or actions without confusing them with actual history;
- attach notes, save the Hand or decision, and return later;
- re-drill the same or a meaningfully similar spot;
- read a supported hand narrative or switch to facts-only review.

## Existing foundation

- [Architecture Contract](../ARCHITECTURE_CONTRACT.md) defines pure ephemeral `hand-review/v1` over canonical Hero decisions, Replay, `StrategyResult`, and `StrategyClaimPolicy`.
- [Table Presence competitive reference](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md) records the implemented review workflow, pre-action Replay convention, source-gated comparison, and ADOPT/ADAPT/DIFFERENTIATE/REJECT decisions.
- [Strategy Source Authority](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) governs mixed-frequency comparison, source precision, provenance, limitations, and generalized-versus-normative wording.
- [DecisionContext](../DECISION_CONTEXT_SPEC.md) owns exact decision facts and derivation quality.
- [Saved Study Objects](../SAVED_STUDY_OBJECTS_SPEC.md) owns current Save Hand/Spot, notes/tags/review metadata, and detached canonical Replay reopening.
- [Analysis Range specification](../ANALYSIS_RANGE_SPEC.md) owns exact made-hand, draw, board, blocker, and explicit-range facts consumed by explanation.
- [Bluff Analysis](../BLUFF_ANALYSIS_SPEC.md) owns current structural risk/reward, semibluff, outs, and removal facts.
- [Product Specification](../PRODUCT_SPEC.md) defines Review as a state-aware projection in which timeline, selected decision, comparison, and learning actions dominate.

The current implementation provides a shared Hand/Full-Hand Training review, canonical Hero-decision journal, direct pre-action Replay synchronization, source-aware comparison, provenance/limitations, and existing Analyze/Save/Repeat/Next routes. `REPLAY-RAIL-NAV-001` is completed and human accepted as the Hand/Replay composition checkpoint: compact Hand context/state sits left, the primary table remains central, and legal/chance controls, distinct Replay, and bounded vertical street-grouped History sit right; exact seeking, Return to live, adjacent canonical actions, and the desktop overview/navigation + selected decision/analysis + Replay/history Review are accepted. Minor table-physicality and History micro-polish debt remains explicitly routed and does not reopen that architecture. The product still does not provide full Equity/range evolution, opponent-model analysis, or a frozen historical `StrategyResult` payload.

## Desired future behavior

A mature review may combine:

- street-by-street canonical state;
- every recorded Hero decision and an explainable review priority;
- key or turning-point decisions, without pretending difference equals EV importance;
- Equity evolution where canonical Equity was calculated or can be truthfully recomputed;
- made-hand, draw, nut-status, blocker, and runout-role evolution;
- action-conditioned range evolution with source-separated ranges;
- selected reference comparison within exact coverage/capability limits;
- Personal Strategy comparison as intended strategy;
- observed action comparison as behavior;
- bluff, value, thin-value, semibluff, showdown-value, and bluff-catcher evolution where supported;
- opponent-model and exploit comparison with explicit assumptions;
- alternate action or runout branches as hypothetical states;
- Saved notes, tags, review intent, and study-object relations;
- provenance, source versions, missing evidence, and uncertainty;
- direct actions to Analyze, Replay, save, re-drill, repeat, or continue.

Natural-language narrative is a projection over these structured facts. Facts-only review remains available for advanced users.

A supported summary might say:

> Flop was close to the selected reference. Turn is the first material divergence. River becomes primarily a bluff-catcher decision.

Riverline may say this only if the selected reference, comparison thresholds, factual role classification, and decision history support every clause.

## Structured facts / evidence required

Per Hand and selected decision, Deep Review may need:

- canonical Hand/replay source, rules snapshot, hand ID, terminal result, and privacy boundary;
- exact event index and pre-action Replay frame for each Hero decision;
- actor, street, cards/board, pot, price, contributions, stacks, position, opponents, legal actions, sizing bounds, and bounded prior history;
- observed action and exact sizing;
- `DecisionContext` and its exact/defaulted/normalized/unavailable provenance;
- recorded or current `StrategyResult`, source/version, coverage, capabilities, precision, limitations, and claim-policy interpretation;
- factual evaluator/range/bluff/runout analysis and its source inputs;
- canonical Equity request/result identity when an Equity claim is shown;
- Personal Strategy profile/mode/evidence/result identity and uncertainty;
- opponent-policy/model identity, version, sample assumptions, and uncertainty;
- actual versus hypothetical branch identity;
- Saved object/note/review relations;
- Training session/answer/grade semantics and later re-drill relations;
- historical versus current interpretation when sources or policies changed.

The review projection should request only the evidence needed for the visible decision. Hidden decisions and inactive details must not trigger duplicate strategy, Equity, or range work.

## Authority, provenance and uncertainty rules

- Canonical Hand and Replay own actual cards, actions, pot, stacks, actor, street, and history.
- The selected pre-action frame is a projection convention, not a new state snapshot.
- `StrategyProvider` and `StrategyClaimPolicy` own strategy data and permitted comparison language.
- Heuristic disagreement alone cannot select an important decision. An accepted-reference difference may be a descriptive study reason, separately from explicit intent, uncertainty, economics and permitted remediation. [Decision Delta / Study Inbox](../DEEP_REVIEW_STUDY_INBOX_V1_SPEC.md) owns the first bounded contracts; no frequency gap implies EV loss or objective error.
- Reference, intended Personal Strategy, observed action, and opponent/exploit roles stay separate.
- Final chip outcome does not measure decision quality.
- Equity, range, hand-analysis, and bluff facts come from their canonical services/contracts; Review does not recompute them.
- A hypothetical action/card/runout branch is visually distinct, does not mutate actual history, and makes no Equity claim unless separately calculated.
- Missing source, unsupported coverage, lossy Scenario ancestry, partial range, and unknown opponent evidence remain explicit.
- Historical strategy interpretation may be reproduced only when a future approved payload preserves the necessary source/version/capability snapshot. Otherwise Review labels a newly resolved comparison as current.
- Saved user “Mistake” annotation is not reinterpreted as objective strategy grading.

## Preserved interactions and microfeatures

- One vertical, street-grouped Hero-decision navigator linked to direct pre-action Replay seeking. Human product evidence selected and accepted this direction over the horizontal Action Path, and `REPLAY-RAIL-NAV-001` final hands-on acceptance checkpointed the resulting Hand/Replay composition with named minor debt.
- Treat the Replay rail as first-class interaction space for chronology, Current Legal Actions, compact Hand Stage, and return-to-live control when it preserves the central table and remains readable at supported widths.
- Preserve coherent table, rail, title, and control geometry when moving among live Hand, Replay, and selected-decision states; the selected history point may change without making the workspace feel unrelated.
- Previous/next decision, street jumps, Replay playback, and selected-event context without duplicate cursors.
- Clearly mark observed action and source's highest-frequency action while retaining full supported mixes.
- Expand provenance, coverage, precision, and limitations without overwhelming the first layer.
- Open the exact selected decision in Analyze without losing the completed Hand.
- Save Hand or existing-schema Spot through the one Saved authority; edit notes/tags/review state through that authority.
- Inspect current made hand, draws, outs, blockers, range, Equity, or bluff facts through progressive detail.
- Preview a concrete hypothetical card/runout with actual-versus-hypothetical distinction and the shared card-outcome interaction when available.
- Compare selected reference, Personal Strategy, observed action, and opponent model as separate layers.
- Repeat Hand, Next Hand, Return, same-spot re-drill, or similar-spot practice through their owning workflows.
- Preserve keyboard, focus, tap/disclosure, RTL, reduced-motion, and facts-only equivalence.

## Cross-surface applicability

- **Canonical Hand:** primary completed-hand review consumer.
- **Full-Hand Training:** reuses the same review projection and canonical Hand/decision evidence with Training-specific terminal actions.
- **Replay:** shares the one frame projection/cursor; Review selection may seek but never rewrites Replay history.
- **Analyze:** receives the selected decision/state through an explicit route and becomes the dense analysis surface.
- **Saved:** reopens detached canonical Hand history and approved annotations; future durable review payloads need explicit versions.
- **Training Memory:** supplies historical session/re-drill relations after its evidence owner exists.
- **Equity / Range / Bluff:** provide structured facts on demand; they are not automatically mounted for every decision.
- **Personal Strategy / Opponent Intelligence:** provide optional source-separated comparisons after their adapters/contracts exist.
- **Home:** may route into review or show bounded summaries; it never reconstructs the review itself.

## Presentation depth

- **Facts:** actual timeline/state, decision context, observed action, supported frequencies, exact factual analysis, provenance, and unavailable evidence.
- **Explain:** concise account of why the selected decision is interesting within its source/reference frame.
- **Coach / Summary:** supported cross-street or whole-hand synthesis, recurring-pattern link, and next study action only when enough evidence exists.

The table remains supporting context while the vertical street-grouped timeline/decision rail and comparison lead Review. The rail must support scanability, current-action visibility, direct seeking, compact Hand Stage and legal actions, long hands, 1920×1080 at 100% zoom, larger desktop canvases, functional 1366×768, EN/RU/HE, RTL, and keyboard access. State transitions retain coherent table/control geometry, and an in-progress live Hand exposes an obvious immediate return from an earlier Replay frame. Users can remain in facts-only mode and avoid narrative entirely.

## Dependencies

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md);
- canonical Hand, Hero-decision journal, Replay projection, and pre-action frame convention;
- StrategyResult/ClaimPolicy and, for historical reproduction, an approved frozen-analysis payload;
- factual Equity/hand/range/bluff/runout contracts;
- [Range Evolution](RANGE_EVOLUTION.md) for action-conditioned street ranges;
- Personal Strategy comparison adapter and explicit observed-evidence semantics;
- [Opponent Intelligence](OPPONENT_INTELLIGENCE.md) for model/exploit layers;
- Training Memory for session/re-drill continuity;
- Saved payload/version decisions for durable review-specific data;
- shared interaction grammar, performance invalidation, localization, accessibility, and responsive rules.

## Suggested implementation slices

These are possible future boundaries, not roadmap priority:

1. Preserve the current shared `hand-review/v1` and complete outstanding human acceptance without adding scope.
2. Add on-demand factual hand/runout detail to a selected decision through existing Analysis facts.
3. Add canonical Equity evolution only through bounded, cache-aware requests and explicit result identity.
4. Add source-separated Personal Strategy comparison after its provider/comparison adapter exists.
5. Add action-conditioned range evolution and supported bluff/value role changes.
6. Add opponent/exploit comparison after an explicit policy/evidence contract exists.
7. Add same/similar re-drill and cross-session pattern links after Training Memory exists.
8. Add evidence-grounded whole-hand synthesis while preserving facts-only review.

## Competitive/reference lessons

The existing [Table Presence competitive reference](../TABLE_PRESENCE_COMPETITIVE_REFERENCE.md) is the approved evidence base. It records these durable decisions:

- **ADOPT:** chronological decision-by-decision review, an obvious optional Review transition, compact decision navigation, and direct Replay movement. This adopts the user job and semantics, not the current navigator orientation.
- **ADAPT:** use Riverline's immutable Hero journal and pre-action Replay convention; expose deterministic evidence-backed study reasons; keep heuristic differences separate from permitted remediation and the table as exact context.
- **DIFFERENTIATE:** remain useful when a source is unavailable/generalized, retain compact provenance/limitations, and reuse one Review for Hand and Full-Hand Training.
- **REJECT:** unsupported solver scores, objective mistake language, exploitability/EV-loss theater, or duplicate state/timeline/Analysis/Saved authorities.

No new competitive research was performed for this dossier.

## Failure modes / non-goals

- No second Hand state, event timeline, Replay cursor, or derived legal history.
- No automatic full Analysis stack that buries the post-hand next action.
- No outcome bias: winning or losing chips does not grade the decisions.
- No “biggest mistake,” EV loss, GTO score, or exploitability claim without an authorized source/capability.
- No source-frequency difference presented as monetary or strategic importance.
- No collapse of reference, Personal Strategy, observation, and opponent/exploit evidence.
- No hypothetical branch styled as actual history or given implicit Equity.
- No persistence of renderer frames, selected UI state, or generated narrative as canonical Hand evidence.
- No duplicate Saved note/review model.
- No eager per-decision StrategyProvider/Equity/range computation that violates performance invalidation.

## Open product questions

- Which bounded History padding, font-weight, contrast, density, and event-row refinements improve scanability without changing the accepted selected-street-open grouping, collapsible non-selected streets, direct seeking, RTL/keyboard behavior, or one-canonical-cursor architecture?
- What transparent rule identifies a turning point without implying EV importance?
- Which analysis layers should load by default versus only on request?
- Should historical Review freeze selected strategy results, or compare the recorded decision with the current selected source by default?
- How should “then” and “current” comparison be shown when source versions differ?
- What is the first safe alternate-action/runout branch scope?
- Which dimensions define a similar spot for re-drill?
- When does a whole-hand narrative have enough evidence to move from Explain to Coach/Summary?
- What review annotations require a new Saved payload versus current notes/tags/review flags?
- How should multiway decisions and partial opponent information affect comparison and summary language?

## Legacy/recovered IDs and ideas

- **FULL-HAND-REVIEW-001:** implemented foundation and current semantic owner for shared Hand/Full-Hand Training decision review.
- **CARD-OUTCOME-PREVIEW-001:** preserved as a shared hypothetical-card interaction owned by Equity Hand Analysis and applicable to concrete review runouts; Review must not reimplement ranking.
- **COLLAB-REVIEW-001:** preserved under Saved Knowledge and Sharing for later comments/collaboration over versioned study objects, not a new Review persistence model.
- **SHAREABLE-SPOT-001:** preserved under Saved Knowledge and Sharing; review-to-share must retain versioned state/provenance rather than export only an image.

## Related specs/capabilities

- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Natural-Language Intelligence](NATURAL_LANGUAGE_INTELLIGENCE.md)
- [Equity Hand Analysis](EQUITY_HAND_ANALYSIS.md)
- [Bluff / Exploit Analysis](BLUFF_EXPLOIT_ANALYSIS.md)
- [Opponent Intelligence](OPPONENT_INTELLIGENCE.md)
- [Training Intelligence](TRAINING_INTELLIGENCE.md)
- [Personal Strategy Intelligence](PERSONAL_STRATEGY_INTELLIGENCE.md)
- [Range Evolution](RANGE_EVOLUTION.md)
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md)
