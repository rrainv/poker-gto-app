# Personal Strategy intelligence

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

Planning navigation: [PRODUCT_BACKLOG.md](../PRODUCT_BACKLOG.md), [CURRENT_PHASE.md](../CURRENT_PHASE.md), and [ROADMAP.md](../ROADMAP.md).

## Accepted product direction — August 26, 2026

The human product review for [`PERSONAL-STRATEGY-002R`](../PERSONAL_STRATEGY_002R_REVIEW.md) is accepted. The durable user job is:

> Teach Riverline how I intend to play in a recognizable poker setup, inspect what Riverline knows versus estimates, and later compare that intent separately with reference strategy and observed behavior.

The accepted user-facing model is:

```text
Personal Strategy
  Game setup: recognizable environment plus exact rules assumptions
    Approach: one discrete way the user intends to play
```

Accepted product rules:

- **Game setup** replaces Profile in user-facing language. Home Game, club game, cash game, MTT, and Heads-Up may be templates/examples, never hardcoded product identities. Users can name their own setup, and exact rules assumptions remain inspectable.
- **Approach** replaces Mode in user-facing language. A new Game setup starts with one Approach and may gain more when useful. Exactly three is not the future product model, and legacy three-Mode data must migrate without evidence or stable-identity loss.
- **Teach Riverline** replaces Calibration; **Teach Riverline Next** replaces Teacher; Builder is no longer a standalone product noun, while its useful grouped editing capability moves under **Matrix Edit**.
- First value is one lightweight Game setup, one Approach, one clearly supported first-in/RFI preflop context, approximately five dominant-action questions, then **What Riverline understands** and a **Teach Riverline Next** continuation. Strategy Matrix and Matrix Edit remain secondary/expert surfaces.
- Initial question selection seeks broad sparse/high-information coverage across useful regions before repeatedly refining narrow boundaries. Boundary and exact-mix refinement follows broad useful coverage or an explicit user request; ranking remains derived and must not become durable strategy evidence.
- The primary `003A` product scope is intentionally preflop first-in/RFI. Other contexts must be labelled supported or not-yet-supported honestly; architecture remains street/role extensible.
- One-click input means preferred/dominant intended action, never a manufactured 100% pure frequency. Exact/mixed frequency remains explicit refinement.
- The visible understanding vocabulary is **Specified — dominant**, **Specified — exact**, **Supported estimate**, **Tentative estimate**, **Unknown**, and **Conflict**. Supported/Tentative are not statistically calibrated numeric confidence.
- Personal Strategy is durable on-device without mandatory sign-in through Riverline's existing local owner/identity authority. Accounts retain isolated ownership and existing opt-in sync governance; no implicit cloud upload or second identity system is allowed.
- Training Memory remains observed Training evidence. Future comparison against a frozen Game setup/Approach snapshot is explicit opt-in, and adopting an observed answer as intent is a separate explicit action. This integration is not part of `003A`.
- Selected reference, personal intent, source-labelled observed behavior, and opponent policy remain separate roles. Reference/observed integration follows `003A`; disagreement is not automatically a mistake.
- With fewer than five compatible observed decisions, future observed comparison may show individual history only. Stronger pattern thresholds and compatibility rules are deliberately deferred to the analytics implementation ticket.
- Append-only evidence history, grouped undo/corrections, Duplicate Approach, immutable material Game setup versions, and restore-through-new-correction/version are accepted. Branches, arbitrary historical rollback, and Git-like version management are deferred.

`PERSONAL-STRATEGY-003A` owns the new versioned product/storage migration and first-value reset. Until that implementation is accepted, current Profile/Mode schemas and legacy internal names remain implementation truth only where compatibility requires them.

## Product purpose

Personal Strategy lets Riverline understand and preserve what the user intends to play in a recognizable Game setup without relabelling that intent as objective poker truth. Its long-term intelligence should help the user inspect what is specified versus estimated, find sparse or contradictory evidence, compare Game setups and Approaches, decide what to teach Riverline next, and connect intended strategy with selected references and source-labelled observed behavior.

The durable foundation is user evidence. Inference, summaries, comparisons, teaching queues, and future provider projections are derived views over that evidence and must remain reversible, provenance-aware, and honest about uncertainty.

## User jobs / why it matters

- Describe an intended strategy for a recognizable Game setup and one of its user-named Approaches.
- Answer quickly with a dominant action without falsely claiming a pure 100% frequency.
- Enter exact mixes only when the user actually knows them.
- Inspect specified-dominant, specified-exact, supported-estimate, tentative-estimate, unknown, and conflict regions separately.
- Understand why Riverline inferred or abstained and which evidence contributed.
- Correct individual hands or groups without losing history or hiding contradictions.
- Ask Riverline which boundary, sparse region, or conflict is most useful to teach next.
- Compare Game setups, Approaches, selected reference strategy, and source-labelled observed behavior without semantic collapse.
- Duplicate an Approach, make intentional changes, and restore through a new correction/version without rewriting historical evidence.
- Receive evidence-grounded summaries rather than invented personality prose.

## Existing foundation

Current implemented contracts remain in:

- [PERSONAL_STRATEGY_FOUNDATION_SPEC.md](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md): profiles, exactly three discrete user-named Modes, objective contexts, immutable direct and Training evidence contracts, revision history, sessions, repository, export/import, and durability;
- [PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md](../PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md): structured action identities, dominant versus exact precision, action-aware preflop contexts, and compatibility boundaries;
- [RANGE_INFERENCE_SPEC.md](../RANGE_INFERENCE_SPEC.md): source-preserving evidence view, conflicts, categorical same-context inference, abstention, ordinal uncertainty, support facts, and recomputable snapshots;
- [ADAPTIVE_RANGE_CALIBRATION_SPEC.md](../ADAPTIVE_RANGE_CALIBRATION_SPEC.md): deterministic question value, Quick/Standard/Deep intents, profile-readiness and clarification flow, Skip/Not sure semantics, progress, and resume;
- [PERSONAL_STRATEGY_MATRIX_SPEC.md](../PERSONAL_STRATEGY_MATRIX_SPEC.md): one 169-cell inspection/correction projection over the shared evidence authority;
- [RANGE_BUILDER_SPEC.md](../RANGE_BUILDER_SPEC.md): atomic class-level grouped direct edits and semantic undo over the same evidence;
- [RANGE_TEACHER_SPEC.md](../RANGE_TEACHER_SPEC.md): derived boundary/sparse/conflict/exact-mix guidance routed through Calibration, Matrix, and Builder;
- [RANGE_CONTEXT_TRANSFER_SPEC.md](../RANGE_CONTEXT_TRANSFER_SPEC.md): bounded same-Profile/same-Mode compatible RFI context transfer as a derived overlay;
- [PERSONAL_STRATEGY_SYNC_SPEC.md](../PERSONAL_STRATEGY_SYNC_SPEC.md): explicit opt-in sync of source profiles, Modes, evidence, and sessions while inferred output remains local/recomputable;
- [UNIFIED_RANGE_INTELLIGENCE_SPEC.md](../UNIFIED_RANGE_INTELLIGENCE_SPEC.md): the shared authority and consumer-adapter direction.

The current implemented scope is primarily preflop RFI Fold/Raise over canonical 169 hand classes. Class-level Matrix, Builder, Teacher, categorical inference, adaptive Calibration, context transfer, and optional sync are automated legacy-named checkpoints with human Firefox acceptance still separately tracked. The wider action contract can store additional direct preflop roles, but the accepted primary product must not imply equally mature inference outside first-in/RFI. There is no current Personal Strategy provider in StrategyProvider, live Training evidence opt-in, postflop model, combo editor, writable multi-head resolution, accepted Game setup/Approach migration, or narrative Personal Insights runtime.

## Desired future behavior

### Preserve intended, reference, and observed roles

Every comparison should retain at least these meanings:

```text
intended Personal Strategy
  versus selected reference strategy
  versus observed action or behavior
```

An opponent model, when present, is another separate role. Intended strategy is what the user says the Game setup/Approach should do. A reference describes a named source under its coverage. Observed behavior records what happened and remains source-labelled. None silently overwrites another.

Direct evidence remains stronger evidence of intent than observed behavior. Repeated Training actions must not vote the user's stated strategy away merely through volume.

### Game setup and Approach comparisons

Future comparison may identify evidence-supported differences such as:

> This BTN Approach is wider in suited Kings than Usual.

or:

> Offsuit Broadway evidence remains sparse.

The comparison must state:

- the exact Game setups, Approaches, and objective contexts compared;
- whether each point is direct, exact-mix, inferred, transferred, conflicting, or unknown;
- the evidence/snapshot and derivation versions;
- which hands, regions, or combo facts support the statement;
- uncertainty and coverage limitations.

Do not infer a personality such as `fearful`, `aggressive`, `creative`, or `disciplined` from range shape. Names supplied by the user are presentation identity, not behavioral proof. Approaches remain discrete and unordered in the user model; no hidden tight-to-loose continuum may force their meaning.

### Natural-language Personal Strategy summaries

Evidence-grounded summaries may eventually explain:

- the largest well-supported differences between Approaches or Game setups;
- clearly established range boundaries;
- sparse, uncertain, conflicting, or unusual regions;
- exact-mix evidence where explicitly supplied;
- how a selected reference differs from intended strategy;
- where observed behavior repeatedly differs from intended strategy after explicit evidence opt-in.

Summary prose must be traceable to structured facts. It must abstain when evidence is too sparse, scopes are not comparable, or conflicts make a claim ambiguous. Advanced users may request facts-only Matrix/range output and no summary prose.

### Range assessment

Future range-level assessment should distinguish:

- direct coverage versus modeled coverage;
- categorical intended actions versus exact action frequencies;
- local same-context inference versus transferred context estimates;
- uncertainty, contradiction, and abstention;
- strategic boundary shape without treating an ordinal interpolation coordinate as poker strength;
- selected-reference comparison without converting reference disagreement into an automatic error;
- observed-action alignment without calling it skill or accuracy.

An assessment may describe meaningful regions and differences. It may not normalize unknown hands into folds, fabricate frequencies from dominant answers, or claim a sparse synthetic model has learned the user's full strategy.

### Teach Riverline Next

A future cross-profile `Teach Riverline Next` queue should rank useful clarification opportunities such as:

- high-value uncertainty;
- sparse structural regions;
- contradictory active heads;
- boundaries and discontinuities;
- exact-mix refinement where the user has signaled useful precision;
- important reference-versus-intent gaps that still lack direct evidence;
- observed-versus-intended disagreement only after explicit collection consent.

Every item should show why it matters, which scope it affects, what evidence is missing or contradictory, and the expected kind of clarification. Selecting an item should route directly into Teach Riverline or Matrix Edit for that exact Game setup, Approach, context, and hand. Queue ranking is derived and never becomes durable strategy evidence.

The immediate first-value queue and the longer-term teaching experience are distinct. The current system may truthfully identify sparse, uncertain, or conflicting regions; it must not claim to teach poker concepts merely because it selects another question. A later teaching slice should connect compatible reference evidence, supported poker concepts, and traceable explanation while retaining facts-only inspection and explicit source limitations.

### Approach duplication, Game setup versions, and restoration

The accepted smallest useful versioning model lets a user duplicate an Approach, create immutable material Game setup versions, inspect grouped corrections, and restore by appending a new correction/version. It must preserve:

- stable source Game setup/Approach/evidence identities, including migrated legacy Profile/Mode IDs;
- immutable evidence and correction history;
- explicit duplication/version/restore provenance;
- the algorithm/model versions used for derived views;
- conflicts rather than a silent winner;
- the distinction between reverting a presentation selection and appending a durable correction.

Restore must not delete history or silently rewrite old observations. Branches, arbitrary historical rollback, and Git-like strategy management are deferred. `003A` owns the exact migration and storage design needed for the accepted bounded model.

### Later postflop Personal Strategy

Postflop Personal Strategy should use exact canonical facts as durable primary identity:

- board and street;
- exact cards or combo target;
- player/position/table structure;
- pot, live/effective stacks, price, legal actions, and exact action history;
- Game Rules identity;
- structured action and sizing semantics.

Lossy board/action abstractions may be separately versioned inference indexes, but they must not become the only historical key. Postflop evidence sparsity, combo removal, action space, and street propagation require their own contracts; current RFI inference cannot be renamed into a generic postflop model.

### Later range-level summaries

After a semantics-safe combo/action-strategy projection exists, summaries may describe:

- categories or regions that gain/lose action mass;
- exact differences across Game setups/Approaches/contexts;
- direct versus inferred sources for the change;
- postflop range evolution;
- value/bluff or showdown-role composition only where separate factual authorities support it.

`HoldemWeightedRange` inclusion weight, per-action strategy frequency, and inference uncertainty remain different quantities.

## Structured facts / evidence required

- Stable Game setup and Approach IDs, names, lifecycle, material version, exactly scoped objective context, and lossless identity mapping from legacy Profile/Mode records.
- Immutable `RangeObservation` or future evidence IDs, timestamps, source, correction/supersession lineage, and active/conflicting heads.
- Dominant-only versus exact-frequency precision, including exact ties with no fabricated dominant action.
- Direct intended, imported intended, transferred, inferred, selected-reference, or source-labelled observed role with explicit authority semantics; observed Training records remain owned by Training Memory rather than copied into Personal Strategy truth.
- Evidence view/snapshot fingerprint, inference model/configuration version, uncertainty policy, reasons, support neighbors, and abstention/conflict facts.
- Game Rules semantic identity and exact relevant action/price/history facts.
- Strategy source descriptor, version, coverage, capabilities, and claim policy for a selected reference.
- Observed action, DecisionContext, session/source version, and explicit Personal Strategy collection consent.
- Canonical combo IDs and quantitative action frequencies before deriving action-conditioned range mass.
- Approach-duplication parentage, material Game setup version, comparison basis, and restore-through-correction/version operation.

## Authority, provenance and uncertainty rules

- Sparse immutable source evidence remains durable Personal Strategy truth.
- Evidence views, inferred estimates, transfers, uncertainty bands, teaching queues, summaries, and Matrix projections are derived and recomputable.
- Direct intended evidence, inferred intended strategy, selected reference, observed behavior, and opponent policy remain distinct roles.
- A dominant action with no frequencies never becomes a pure 100% action.
- Exact ties retain no dominant action. Conflicting heads remain separate and force abstention where reconciliation would invent intent.
- Transferred evidence never becomes direct evidence and cannot override a local direct/conflicting point.
- Numeric confidence must not be fabricated from current ordinal uncertainty or synthetic validation.
- Personal Strategy is not poker correctness, GTO, population truth, or a prediction of actual future behavior.
- Natural-language summaries cite or expose the structured comparison and abstain when evidence is insufficient.
- Inference upgrades may change recomputed views but cannot rewrite what historical source evidence meant.
- Training or observed collection is opt-in and records behavior; it does not silently refine intended strategy.

## Preserved interactions and microfeatures

- Keep one exact-scope Strategy Matrix as the shared expert inspection/correction surface for Teach Riverline, Matrix Edit, and Teach Riverline Next.
- Prefer broad useful coverage before fine boundary refinement in first-value flows; expose a focused boundary question when it is genuinely the highest-value next input or the user asks for refinement.
- Preserve separate visual and accessible semantics for Specified — dominant, Specified — exact, Supported estimate, Tentative estimate, Unknown, and Conflict. Transfer remains inspectable derivation detail rather than another confidence level.
- Keep exact-frequency bands limited to explicit exact mixes.
- Let `Teach Riverline Next` items route directly to the existing exact scope and explanation for why the item was selected.
- Preserve source evidence/history in inspectors; do not reduce a conflict to one latest value.
- Game setup/Approach comparison should allow facts-only hand/region inspection behind every summary.
- Approach/version comparison should make the source, changed evidence, and restore consequence explicit before mutation.
- Keep Skip and `I'm not sure` distinct as session history while neither creates poker evidence; current exact semantics remain owned by [ADAPTIVE_RANGE_CALIBRATION_SPEC.md](../ADAPTIVE_RANGE_CALIBRATION_SPEC.md).

## Cross-surface applicability

- **Teach Riverline:** canonical intended-evidence elicitation and direct Teach Riverline Next destination.
- **What Riverline understands:** primary compact separation of specified intent, supported/tentative estimates, unknowns, and conflicts.
- **Strategy Matrix:** secondary/expert exact-scope inspection and correction.
- **Matrix Edit:** grouped direct action-evidence editing, preserving current Builder capabilities without a separate product identity or generic inclusion-range semantics.
- **Teach Riverline Next:** derived explanation and focused elicitation over the same authority.
- **Home/My Riverline:** compact direct facts and resume routes; no invented mastery or inference-heavy dashboard.
- **Training:** intended/reference comparison and observed evidence only after explicit session opt-in.
- **Analyze:** named Personal Strategy attachment after a versioned action-strategy comparison boundary exists.
- **Deep Hand Review:** intended/reference/observed comparison when evidence and historical source identity are available.
- **Saved Study:** future snapshot, comparison, or Saved Range relations only through approved payloads; no parallel profile store.

## Presentation depth

- **Facts:** exact scope, specified/supported-estimate/tentative-estimate/unknown/conflict points, frequencies where exact, evidence IDs/history, transfer reasons, reference/observed comparisons, and derivation versions.
- **Explain:** concise evidence-grounded descriptions of meaningful boundaries, differences, sparse regions, or contradictions.
- **Coach / Summary:** Teach Riverline Next and cross-setup/cross-session synthesis only when enough evidence exists.

Facts-only Matrix/range presentation remains a first-class advanced-user choice. Natural-language prose must never be mandatory or invent a personality.

## Dependencies

- [PERSONAL_STRATEGY_FOUNDATION_SPEC.md](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md) and focused Personal Strategy subsystem specs listed above.
- [STRATEGY_SOURCE_AUTHORITY_SPEC.md](../STRATEGY_SOURCE_AUTHORITY_SPEC.md) for future provider/reference/observed role comparison.
- [DECISION_CONTEXT_SPEC.md](../DECISION_CONTEXT_SPEC.md) and [GAME_RULES_V1_SPEC.md](../GAME_RULES_V1_SPEC.md) for exact objective decision identity.
- [RANGE_CORE_SPEC.md](../RANGE_CORE_SPEC.md) and [RANGE_EVOLUTION.md](./RANGE_EVOLUTION.md) for combo identity and later action-conditioned range projections.
- [TRAINING_INTELLIGENCE.md](./TRAINING_INTELLIGENCE.md) for durable observed decisions and explicit evidence opt-in.
- [LEARNING_EVIDENCE_FOUNDATION.md](./LEARNING_EVIDENCE_FOUNDATION.md) for historical source/version continuity.
- [NATURAL_LANGUAGE_INTELLIGENCE.md](./NATURAL_LANGUAGE_INTELLIGENCE.md) for evidence-grounded summaries.
- The independent `PERSONAL-STRATEGY-002R` human review is accepted. Live sequencing is owned by the planning documents; the accepted `003A` migration/first-value reset precedes provider/reference/observed integration.

## Suggested implementation slices

These are capability slices; live priority remains owned by `CURRENT_PHASE.md` and `ROADMAP.md`:

1. `PERSONAL-STRATEGY-003A`: versioned legacy Profile/Mode migration, local-first Game setup/Approach model, bounded first-in/RFI first value, What Riverline understands, Teach Riverline Next hierarchy, and Matrix Edit consolidation.
2. Versioned Personal Strategy comparison/attachment contract preserving dominant-only precision and role identity.
3. Explicit Training observed-evidence opt-in and intended/reference/observed comparison, with stronger pattern thresholds specified when analytics are implemented.
4. `PERSONAL-INSIGHTS-001`: Teach Riverline Next plus evidence-grounded Game setup/Approach summaries.
5. Complete Duplicate Approach, immutable material Game setup version, and restore-through-correction/version UX not included in the bounded 003A slice; branches and arbitrary rollback remain deferred.
6. Combo-aware action-strategy projection where evidence is quantitatively sufficient.
7. Exact-fact postflop evidence contract and separately versioned inference indexes.
8. Range-level and cross-session summaries over approved evidence.

## Competitive/reference lessons

No new market research is performed by this dossier. Existing Riverline lessons favor a dense Matrix with strict hierarchy, direct access to underlying facts, optional elicitation, and visible uncertainty/provenance. Riverline differentiates through personal evidence continuity and honest abstention, not personality quizzes, fake confidence, or opaque automatic profiling.

## Failure modes / non-goals

- Do not make dominant-only evidence a fake 100% mix.
- Do not average or choose between conflicting direct heads without a valid resolution operation.
- Do not persist inferred snapshots, summaries, or teaching queues as source truth.
- Do not let Training volume overwrite intended strategy.
- Do not treat transferred context output as direct evidence.
- Do not conflate inclusion range weight, action frequency, and inference uncertainty.
- Do not describe Personal Strategy as GTO, correct, optimal, or a model of a real opponent.
- Do not infer personality prose from range shape or Game setup/Approach names.
- Do not compare scopes as equivalent when Game Rules, position, stack, action tree, price, or action set differ materially.
- Do not key postflop history only by a lossy texture abstraction.
- Do not create a second Matrix, profile repository, inference engine, range format, or provider path.
- Do not introduce setup versions or restore by deleting or rewriting immutable history.
- Do not force exactly three Approaches, hide mandatory legacy anchors, expose anchor as normal product language, or hardcode example environments as identities.
- Do not require sign-in for durable on-device Personal Strategy or imply cloud sync without explicit account-governed opt-in.
- Do not imply that all preflop decision roles have equally mature Personal Strategy inference.

## Open product questions

- How should dominant-only Personal Strategy enter provider consumers without fabricating probabilities: exact-frequency-only v1 behavior or a future precision-aware result contract?
- What versioned attachment and consent record should freeze a future Training-to-Personal comparison without copying Training Memory evidence?
- What is the durable postflop evidence key and which abstractions are safe only as derived indexes?
- What minimum evidence permits a natural-language Game setup/Approach claim?
- How should Teach Riverline Next rank across Game setups without letting one large setup crowd out another?
- What stronger compatibility and sample thresholds should govern future observed-pattern claims beyond the accepted fewer-than-five history-only rule?
- Is any internal Approach relationship mathematically useful and evidence-supported without forcing a user-facing continuum?
- How should a future writable multi-head resolution preserve every source branch and sync safely?
- Which exact range-level summaries are useful without implying reference correctness or causal poker advice?

## Legacy/recovered IDs and ideas

- Current Personal Strategy Foundation, Calibration, Matrix, `RANGE-BUILDER-001`, and `RANGE-TEACHER-001` — **IMPLEMENTED/CHECKPOINTED LEGACY-NAMED FOUNDATION**; accepted user-facing evolution is Teach Riverline, Strategy Matrix/Matrix Edit, and Teach Riverline Next.
- `PERSONAL-INSIGHTS-001` / `PROFILE-SUMMARY-001` — **PRESERVED** as evidence/provenance/uncertainty-aware summaries and Teach Riverline Next.
- `PROFILE-SNAPSHOT-001` — **EVOLVED/BOUNDED** into Duplicate Approach, immutable material Game setup versions, and restore-through-new-correction/version; branches and arbitrary rollback are deferred.
- `ANALYSIS-PERSONALIZED-001` — **PRESERVED** as a future named Personal Strategy attachment/comparison, not a hidden provider override.
- `RANGE-BUILDER-002` — **PRESERVED/EVOLVED** beyond the implemented class-level action editor; combo overrides, generic inclusion ranges, imports, and Saved Range workflows remain separate future contracts.
- Beginner/expert personality-style presentation — **SUPERSEDED** by evidence depth, strong defaults, and Facts/Explain/Coach rather than invented global user types.

## Related specs/capabilities

- [UNIFIED_RANGE_INTELLIGENCE_SPEC.md](../UNIFIED_RANGE_INTELLIGENCE_SPEC.md)
- [PERSONAL_STRATEGY_FOUNDATION_SPEC.md](../PERSONAL_STRATEGY_FOUNDATION_SPEC.md)
- [PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md](../PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md)
- [RANGE_INFERENCE_SPEC.md](../RANGE_INFERENCE_SPEC.md)
- [ADAPTIVE_RANGE_CALIBRATION_SPEC.md](../ADAPTIVE_RANGE_CALIBRATION_SPEC.md)
- [PERSONAL_STRATEGY_MATRIX_SPEC.md](../PERSONAL_STRATEGY_MATRIX_SPEC.md)
- [RANGE_BUILDER_SPEC.md](../RANGE_BUILDER_SPEC.md)
- [RANGE_TEACHER_SPEC.md](../RANGE_TEACHER_SPEC.md)
- [RANGE_CONTEXT_TRANSFER_SPEC.md](../RANGE_CONTEXT_TRANSFER_SPEC.md)
- [PERSONAL_STRATEGY_SYNC_SPEC.md](../PERSONAL_STRATEGY_SYNC_SPEC.md)
- [RANGE_EVOLUTION.md](./RANGE_EVOLUTION.md)
- [TRAINING_INTELLIGENCE.md](./TRAINING_INTELLIGENCE.md)
- [NATURAL_LANGUAGE_INTELLIGENCE.md](./NATURAL_LANGUAGE_INTELLIGENCE.md)
