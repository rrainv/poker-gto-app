# Capability guardrails

Reference spec: read only when a ticket names it or touches one of these capabilities. It keeps the authority rules and non-goals of the former capability dossiers (`docs/project/capabilities/*`, archived under `docs/archive/2026-10/capabilities/` with their product purpose, ideas and open questions). Direction and milestones come from [NORTH_STAR.md](../NORTH_STAR.md); ideas from [IDEA_BANK.md](../IDEA_BANK.md). Installed by DOCS-RESET-001 (2026-10-15).

Rules that a later owner decision changed are marked **[superseded: …]** and kept only so the change is visible.

## Shared across every capability

- One canonical owner per concept: poker state, legality, accounting, evaluator, Equity, ranges, strategy, Training, Saved, Personal Strategy, opponent policy and Game night stay separate authorities. No capability creates a second one.
- Reference strategy, intended Personal Strategy, observed behaviour, opponent policy/model, exploit analysis and normative assessment are separate roles, even when shown together. Never collapse them into "Riverline recommends".
- Unknown is never zero, fold, false or excluded. Partial evidence stays partial.
- A durable record preserves evidence; it never upgrades that evidence's authority. Historical source/version snapshots are immutable; current re-analysis is a separately labelled projection.
- Source branding, a model label, a large sample or a confidence number grants no normative authority.
- Natural-language and UI layers consume structured facts; they never compute poker maths, conditioning, outs or claims.
- User notes and "Mistake" flags are annotations, not objective grading.
- Privacy and data minimization apply to real opponents, hidden cards, imported hands and sharing. No capability infers consent.
- No eager hidden strategy/Equity/range work (PERF-001).

## Learning evidence

- No catch-all "learning record" holding redundant poker state, rendered copy and every future field. Don't store presentation frames, generated prose or caches as canonical truth; don't persist every transient calculation.
- No silent reinterpretation of historical judgments with today's provider registry or model.
- No fake accuracy, mastery, EV loss, GTO score or confidence from generalized heuristic disagreement.
- No cross-profile or real-opponent evidence collection without explicit identity, consent and privacy boundaries. Any schema migration needs its own approval.

## Natural language

- Never a poker, strategy, Equity, range, opponent-model or grading authority. A fluent sentence has no more authority than its weakest structured input.
- `StrategyClaimPolicy v1` plus `strategy-truth/v1` control source, comparison and assessment language; normative claims need a separately accepted assessment policy.
- Missing evidence stays unknown; never filled from "general poker knowledge". Summaries state material uncertainty, limited coverage, stale model identity or small samples in plain terms.
- Heuristic agreement/disagreement is a comparison with an approximate baseline, never reference alignment, correctness, mistake, remediation, accuracy, retention or transfer evidence.
- Output is reproducible enough to audit inputs and policy version; wording need not be stored as truth.
- Any remote language service needs its own privacy, redaction, consent, latency, fallback and failure decision (NORTH_STAR: no LLM in the product).
- Localization may adapt wording and order but never facts or authority.
- Non-goals: no plausible but unsupported action, range, tendency, reason or outcome; no mandatory narrative clutter; no personality prose from sparse evidence; no fake confidence/accuracy/EV/GTO/mastery; no long-form coaching inside live Hand or pre-answer Training; no hidden network dependency; no global Beginner/Expert mode.

## Reference strategy evolution

- Source identity, provenance, authority, coverage, capabilities, validation and confidence are separate facts. Provenance proves origin, not correctness. A source family (`reference_pack`, `learned`, `solver-derived`) grants nothing by itself.
- Exact claims need exact-enough coverage and the matching declared, validated capability. A nearby stack, size, rake model or tree is not an exact match. Unsupported output stays visibly unsupported or uses a truthfully labelled fallback; never silent interpolation.
- Benchmark observations stay research evidence until a separate production review settles licensing, validation, coverage, authority, fallback and claim policy.
- Consumers use the shared claim policy; they never branch on source IDs or infer authority from branding, probability shape or confidence.
- Non-goals: no production ONNX/model runtime, remote strategy API or arbitrary tree loader; no model trained on heuristic labels marketed as GTO; no extrapolating exact coverage across rules, rake, stacks, roles, actions, sizes or streets; no copying or redistributing proprietary strategy data; no UI-side reference maths or matching; no hand-specific heuristic patches presented as calibration; no requirement to use learned models when a simpler provider is better.

## Equity and hand analysis

- `shared/poker-domain/` is the sole evaluator, card, deck and Equity authority; `RangeAnalysisFacts` (or a shared successor) owns hand/runout facts.
- A hypothetical state comes from canonical facts/transitions or an explicitly versioned hypothetical-analysis boundary.
- Structural improvement, Equity, strategy recommendation and opponent response are four different claims.
- Supplied ranges keep subject, role, source, version, known coverage and uncertainty; partial output is never normalized into whole-range truth.
- Expensive exhaustive claims need an explicit workload, cancellation and an unavailable state, not a shortcut label.
- Non-goals: don't count a Turn card that only creates River outs as a direct out; don't call current nuts a lock without exhaustive proof; don't turn percentiles or Equity into strategy truth; don't call a blocker good or bad without a strategic frame; don't double-count overlapping completion cards; a category improvement is not proof Hero wins; no structural preview implies Equity; don't persist derivable evaluator/Equity projections; no second Equity engine, deck, range or state authority.

## Bluff and exploit analysis

- StrategyProvider stays the strategy entry point; Analysis never rewrites its actions or probabilities.
- StrategyResult probability is not opponent fold probability, Hero range weight, action EV or bluff frequency. `HoldemWeightedRange` inclusion weight is not a response probability or value/bluff label.
- A model label (`aggressive`, `nit`, `calling station`) grants no behavioural authority without explicit parameters/evidence.
- Exact pot/SPR economics use `currentPotBb` and live/effective-stack facts; compatibility `potBb`/`stackBb` are never blessed as exact.
- Non-goals: no sunk-cost reasoning; never substitute wager-to size for incremental call price or raise risk; a generic range is not a fold/call or value/bluff partition; structural outs are not clean outs or Equity; card removal is not good or bad without a semantic partition; a one-pair hand is not a bluff catcher without action/range context; a draw is a semibluff only when an aggressive candidate action is analysed; no heuristic label marketed as GTO/EV evidence.

## Opponent intelligence and bots

- Keep reference strategy, opponent model, exploit analysis and Personal Strategy separate. An opponent model describes assumed or estimated behaviour; it never defines correct strategy.
- Exploit advice needs explicit opponent assumptions, a compatible analysis authority and visible uncertainty.
- Observing an action may condition a range only through a named, versioned method; it never reveals hidden cards. Sparse data is not zero-frequency behaviour.
- Real-person observations need explicit ownership, privacy, consent, deletion, export and sharing decisions before persistence. Game night participation or an account relationship is not consent to profiling.
- Imported or manual claims keep their source identity. Current vs historical model results stay distinguishable.
- A bot policy uses canonical legal actions/state; it never becomes a second PokerState, Training generator or StrategyProvider. Bots see only actor-allowed facts; policy randomness is separate from deal randomness. Appearance never implies behaviour; playstyles are defined by parameters.
- Non-goals: no vague label as evidence; no prediction about a real person from an archetype or sparse sample; no covert tracking, automatic Game night profiling or hidden-card leakage; no single opponent score erasing context and sample; no fabricated fold frequency, response or range; no leaderboards or public player ratings.

## Deep hand review

- Canonical Hand and Replay own cards, actions, pot, stacks, actor, street and history. The selected pre-action frame is a projection convention, not a new snapshot.
- Heuristic disagreement alone never selects an important decision. No frequency gap implies EV loss or objective error. Final chip outcome does not measure decision quality.
- A hypothetical branch is visually distinct, never mutates history and makes no Equity claim unless separately calculated.
- Historical strategy interpretation is reproduced only when an approved payload preserved the source snapshot; otherwise a new comparison is labelled current.
- Non-goals: no second Hand state, timeline or Replay cursor; no automatic full Analysis stack burying the next action; no "biggest mistake", EV loss or GTO score without authorized capability; no source-frequency difference presented as money or importance; no persistence of renderer frames or generated narrative as Hand evidence; no duplicate Saved note/review model.

## Training intelligence

- `TrainingPracticePlanner` owns structural targets only; the canonical generator owns cards, actions, state, legality, pot and trajectories. Planner sizing families are generation targets, never recommendations or grades.
- Training calls the same StrategyProvider as everyone else; no Training-only fallback.
- `StrategyClaimPolicy` and `strategy-truth/v1` separate heuristic comparison, exact accepted-reference comparison and assessment-authorized outcomes; there is no universal alignment metric.
- Training observation of Personal Strategy needs explicit profile/mode choice and consent; it never overwrites direct intended evidence.
- Same Spot keeps reproducible identity; Similar Spot names its selection policy/version and changed dimensions.
- Study volume alone does not establish mastery; planner coverage counters are not learning progress or real-world frequency.
- Non-goals: no second generator, PokerState, legal-action engine, grader, StrategyProvider, Replay or Saved store; no heuristic disagreement labelled correct/incorrect, EV loss or mistake; no accuracy/mastery claim without valid concept, history and source semantics; no review scheduling optimized for engagement; no fabricated Home history or due counts.
- **[superseded: "No XP, badges, levels, achievements … by default"]** NORTH_STAR §7.12 and §12 reopen achievements and a progression system with honesty guardrails (effort-based, diminishing returns, skill shown separately, can be hidden, no time pressure, no loot boxes); **streaks are dropped**.

## Personal Strategy intelligence

- Sparse immutable source evidence is durable truth; views, inferred estimates, transfers, uncertainty bands, teaching queues, summaries and Matrix projections are derived and recomputable.
- A dominant action without frequencies never becomes a pure 100% action. Exact ties keep no dominant action. Conflicting heads stay separate and force abstention where reconciliation would invent intent.
- Transferred evidence never becomes direct evidence or overrides a local direct/conflicting point.
- No fabricated numeric confidence from ordinal uncertainty or synthetic validation. Personal Strategy is not correctness, GTO, population truth or a prediction of future behaviour.
- Inference upgrades may change recomputed views but never what historical evidence meant. Training/observed collection is opt-in and records behaviour; it never silently refines intent.
- Before Personal Strategy feeds a provider, reference or observed comparison (from the accepted 002R review): a precision-aware result or an honest qualitative/unavailable result (never dominance smuggled into exact frequencies); Training Memory stays the observed authority (reference frozen `training-decision-record/v1`, store only consent/link/adoption events; no duplicate observed records in Personal Strategy); an explicit multi-head conflict resolution; comparison scope frozen at comparison time (context, source/algorithm version, rules snapshot, coverage, precision, claim semantics); intended evidence keyed by exact immutable rules/decision facts, not a display environment label; non-RFI families stay direct-only until their own validated inference adapters exist; postflop intent through its own street-specific adapter (never the 169-class RFI graph); opponent-policy comparison only through its own versioned authority.
- Non-goals: don't average or choose between conflicting heads without a valid operation; don't persist inferred snapshots as truth; don't conflate inclusion weight, action frequency and inference uncertainty; no personality prose from range shape or Game/Approach names; don't compare scopes as equivalent when rules, position, stack, tree, price or action set differ; don't key postflop history only by a lossy texture; no second Matrix, repository, inference engine, range format or provider path; no restore by deleting or rewriting history; don't force exactly three Approaches or expose legacy anchors as product language; no sign-in required for on-device Personal Strategy, no implied cloud sync.

## Range evolution

- Range Core is the sole authority for combo identity, inclusion weights, blockers, normalization and serialization; PokerState/Replay stay the sole action/card history.
- Inclusion weight, action frequency, inference uncertainty and opponent-model confidence are different quantities. A partial range stays partial after conditioning.
- Derived ranges are not evidence and are never recursively reused as observations.
- Exact tree and sizing mismatches stay unsupported or explicitly mapped; no silent nearest-node substitution.
- Historical review keeps enough source/version/derivation identity that algorithm changes don't rewrite meaning.
- Non-goals: no dominant-only or categorical inference turned into numeric action mass; no frequency reused across a different tree, size, rules context or street; no Matrix average as combo truth; card removal never erases provenance or turns blocked unknowns into folds; no value/bluff roles from evaluator category alone; no range or nut advantage until the statistic and reference frame are approved and calculated.

## Saved knowledge and sharing

- `SavedStudyObject` is the one Saved wrapper authority; each payload keeps its subsystem authority. Stable ID, object revision, payload schema version and source version are distinct.
- Private by default. Authentication or sync never silently enables sharing or upload. Read, comment, fork and edit are separate permissions; a fork is a new owned object with immutable origin provenance.
- Comments and reactions are user content, never poker evidence. A screenshot is illustrative only. Unknown kinds and unavailable facts stay unknown.
- Sync conflict copies are explicit conflict resolution, not general version control.
- Non-goals: no second Saved store in Home, Training, Review, Matrix or a sharing service; no premature Range/Drill/Session/Review payload without an owner and versioned contract; no public-by-default objects; no fork dropping provenance; no social feed, follower metric, leaderboard, gambling challenge or engagement loop; no arbitrary solver-tree import via portability; no silent re-evaluation of historical judgments.

## Game night (Home Game) evolution

- Game night owns real-world session/accounting facts; PokerState owns cards, actions, legality, pots and chip contributions.
- Chip snapshots are observations, not ledger facts. Corrections append and point to prior facts; history is never mutated invisibly.
- Settlement derives only from an exactly balanced ledger; presentation preferences never change net results. The current deterministic settlement must not be called globally minimal without a specified objective and proof. A preferred banker is a preference, not accounting authority.
- Paid/pending is operational payment history, distinct from ledger balance and settlement.
- A Hand link is an explicit relation with provenance; similar timestamps, names or chip movements don't establish it; applying it is exactly-once and auditable. Untracked activity stays unknown.
- Player/session history is factual and implies nothing about skill or tendencies. Sharing is private and least-privilege by default.
- Non-goals: no strategy, Equity or opponent authority inside Game night; no floating-point or display-string accounting; no settlement on an unbalanced session; no automatic Hand → ledger conversion; no duplicate application of a linked Hand after retry/reload/sync; no fabricated hands during reconciliation; no conflating Game night players with accounts, strategy profiles or opponent models.
- **[superseded: "Home Game expansion freezes after safety fixes"; "no implication that Home Game outranks the learning workflow"]** NORTH_STAR §7.9 schedules the Game night rework for M2 (still a supporting domain).

## Random spot generator

- Canonical card/deck operations and PokerState validation stay in `shared/poker-domain/`. A randomizer selects from legal possibilities; it never ranks hands, calculates Equity, chooses strategy, grades or builds opponent policy.
- Uniform physical-card, uniform hand-class, range-weighted and policy-conditioned sampling are different operations and never share an ambiguous "random" claim.
- Locks and targets are semantic inputs; known, dead, burned, excluded, hidden and unknown keep their meanings. Generated state is clearly distinct from actual state.
- A seed reproduces only with the matching algorithm version, input, locks, exclusions and targets. Failure to satisfy locks or legality is an unavailable result, never silent relaxation.
- Non-goals: no duplicate cards or draws from dead/burned/excluded cards; no randomizing locked or unrequested components; no revealing or predicting actual hidden opponent cards; no local deck arrays in UI code; no random cards treated as a representative range; no hidden weighted sampling under a generic Random button; no silently generating missing Flop/Turn for a River-only request; no mutation of an actual or historical state without that surface's explicit apply; no strategy, GTO, Equity or grade from randomization alone.
- Stack randomization (configurable stacks, NORTH_STAR §6.2) goes only through the shared randomization contract and an owning canonical Scenario, Hand or legal Training generator, within legal minimum and maximum; never a Training-specific stack randomizer, and presentation code never invents stack state.
- Direction: NORTH_STAR §6.2 (target-first, most plausible legal path, one generator for Analyze, Training and Full Hand setup; a generated spot is a real canonical hand). Equity: Random is a separate deal button and never means Unknown (NORTH_STAR §7.4).
