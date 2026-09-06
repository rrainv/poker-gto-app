# Agent Master Context

September 7 explicit Equity slice: [Advanced Equity v1](../project/ADVANCED_EQUITY_V1_SPEC.md)
adds canonical weighted joint Equity and bounded runout/card inspection. Partial
results are known-only, never full-range Equity. Personal exact trajectories and
explicit Exploit hypotheses can consume it; policy weights still cannot supply
ranges. This supersedes earlier weighted-Equity-unavailable snapshots below.
`QA-ADVANCED-EQUITY-001` owns human acceptance; general sequencing is unchanged.

September 6 explicit source foundation: [Reference Source Foundation v1](../project/REFERENCE_SOURCE_FOUNDATION_V1_SPEC.md)
adds SHA-256 intake, exact coverage inventory, session health ledger, application
claim ceilings and local private preview. No production source is registered.
[Source research](../project/REFERENCE_SOURCE_ACQUISITION_2026_09.md) identifies
HRC's authorized-result distribution permission; actual acquisition and review
remain `RET-REFERENCE-PACK-001`. `QA-REFERENCE-STRATEGY-002` owns pending human QA.

September 6 explicit study slice: [Deep Review / Study Inbox v1](../project/DEEP_REVIEW_STUDY_INBOX_V1_SPEC.md)
adds ephemeral `decision-delta/v1`, deterministic reasons and a lazy owner-projected
Inbox. Saved annotations/parent Hands, Training Memory and Personal evidence retain
storage authority. `QA-DEEP-STUDY-001` owns pending human acceptance; no general
sequencing change or production normative/reference authority is implied.

September 6 explicit import slice: [Hand History Import v1](../project/HAND_HISTORY_IMPORT_V1_SPEC.md)
adds PokerStars English cash intake, opt-in recorded-settlement Game Rules v2 /
PokerState and Replay v3, Saved Hand v3 provenance and shared Review continuity.
`QA-HAND-HISTORY-IMPORT-001` retains human acceptance. Live/historical semantics
and general sequencing are unchanged; rake-aware Personal/Training remain unavailable.

Last refreshed: September 4, 2026 (`LIGHT-WINS-BATCH-001` is human accepted; `IDENTITY-LIFECYCLE-001` is active next).

This is compact agent execution context, not a Product Backlog. `CURRENT_PHASE.md` owns execution order, `PRODUCT_BACKLOG.md` owns accepted capability/status, and `DOCUMENTATION_GOVERNANCE.md` owns update rules.

## Product and runtime

`EXPLOIT-ANALYSIS-001` extends the existing teacher with [Exploit Analysis v1](../project/EXPLOIT_ANALYSIS_V1_SPEC.md): context-bound response facts, parameter-derived incentives/opportunities, Personal check questions, truthful unavailable semantic requests and six separate completed Review roles. Quantitative range response, weighted Equity, optimization and normative permissions are not added. `QA-EXPLOIT-ANALYSIS-001` owns pending human acceptance; general sequencing is unchanged.

The additive [Bluff / Exploit Teacher v1](../project/BLUFF_EXPLOIT_TEACHER_V1_SPEC.md) now consumes canonical facts and policy-owned conditional action weights in Analyze Explain and selected Personal Hand study. It supplies reasoning questions/comparison and Training request contracts, not quantitative role/Equity or normative exploit authority. Current Phase and `QA-BLUFF-EXPLOIT-TEACHER-001` own pending acceptance.

Riverline is a browser-first personal poker learning workstation connecting full-hand play, Review/Replay, Analyze, selected-reference comparison, Personal Strategy, Saved continuity, Training/re-drill, and later opponent policies. It should feel calm, serious, state-aware, and non-casino.

```text
app/index.html
├─ classic orchestration: app/src/core/logic.js
├─ GameRulesSnapshot v1 -> PokerState v2 for new live Hands
├─ Scenario or PokerState -> DecisionContext v1.1
├─ StrategyProvider v1 -> StrategyResult v1 -> StrategyClaimPolicy v1
├─ canonical Equity and range/evaluator facts under shared/poker-domain
├─ TrainingPracticePlanner -> canonical Training generator/session/grading
├─ table-presentation/v1 -> shared renderer
├─ hand-review/v1 -> shared Hand/Full Hand Training review
├─ experience-event/v1 -> riverline-audio/v1 + riverline-motion/v1
├─ Saved/Home, Personal Strategy, account/sync, and Home Game application domains
└─ product-performance/v1 scheduling and invalidation
```

Electron is a thin host for the same app. Solver research stays isolated under `solver/riverline_solver/`.

## Canonical authorities

- **Game Rules:** `GameRulesDefinition v1` / immutable `GameRulesSnapshot v1`; brand/operator provenance never selects accounting.
- **Poker:** `shared/poker-domain/` owns PokerState v1/v2, cards, actions, legality, accounting, evaluator, Equity, combos, and weighted ranges.
- **Decision strategy:** `DecisionContext v1` with additive `decision-context/v1.1` -> `StrategyProvider v1`; provider declaration -> structural/source validation -> application-owned acceptance -> effective bounded authority -> `StrategyResult v1` -> `StrategyClaimPolicy v1`. Strong authority cannot be self-declared.
- **Current strategy:** deterministic heuristic baseline under `app/src/strategy/`, generalized exploratory/comparative only; `reference-pack/v1` validation/matching/provider infrastructure and the application-owned trust gate exist, but no production pack, accepted production source record, or validated general Hold'em production reference is registered.
- **Training:** planner/intents/requests own structural curriculum targets only; canonical generator owns legal trajectories; sizing families are generation targets, not recommendations. Training Memory v1 owns durable encountered-decision/session evidence and frozen answer-time source/effective-authority/claim snapshots, not grading or Saved intent; reference comparison/remediation requires ClaimPolicy permission.
- **Analysis:** `RangeAnalysisFacts v1` owns canonical factual classification; DOM-free `range-comparison-facts/v1` projects representative-class comparison facts over Range Core card-removal truth; `AnalysisExplanation v1` consumes trusted facts without recreating poker/strategy/Equity.
- **Presentation:** `table-presentation/v1` and `hand-review/v1` are ephemeral projections only.
- **Experience:** `experience-event/v1`, `riverline-audio/v1`, and `riverline-motion/v1` create presentation consequences only.
- **Saved:** `SavedStudyObject v1` remains persistence/schema authority for current Hand/Spot objects; DOM-free `saved-study-preview-facts/v1` is the bounded preview projection, unknown future kinds remain unsupported, and consumers do not invent bookmark/note/review stores.
- **Personal Strategy:** sparse immutable intended-strategy evidence; reference and observed behavior stay separate.
- **Home Game:** exact-money organizer domain separate from poker/study authorities.

## Critical semantic facts

- `OPPONENT-INTELLIGENCE-002` adds Full Hand policy reflection intents, frozen review metadata and actor-input/branch disclosures, descriptive policy comparison, and read-only Personal Strategy region-teaching hooks. [Opponent Policy v2](../project/OPPONENT_POLICY_V2_SPEC.md) owns the contracts. Policy behavior/version and four parameters remain unchanged; themes never enter grading, exact semantic generation and quantitative response ranges remain unavailable, and evidence stays session-local. No real-person storage is implemented. `QA-OPPONENT-POLICY-002` retains human acceptance after an empty browser inventory.

- September 6 explicit opponent ticket: [Opponent Policy v2](../project/OPPONENT_POLICY_V2_SPEC.md) implements the actor allowlist for all selectors, policy/deal seed separation, three parameter-backed card-independent presets/custom Full Hand selection, and session-local completed bot review. Hidden/future-card invariance and complete-hand replay are tested; `QA-OPPONENT-POLICY-001` retains human acceptance after an empty browser inventory. No quantitative range response, Personal Strategy adapter, real-person profiling, normative authority or new persistence is implemented.

- `PERSONAL-STRATEGY-CONTINUATION-001C` (September 6) extends the [Personal Hand study](../project/PERSONAL_STRATEGY_COACH_V1_SPEC.md) through flop, turn and river on the existing bounded hypothetical BTN/BB line. Exact custom sizes, partial action-conditioned ranges, distinct mutation facts, street-aware combo questions, prior-node variations, Approach comparison and existing policy/concept lessons are implemented without a new persistence schema. Reload/correction reconstructs trajectories from intent and canonical replay. Exact-node/semantic Training generation, arbitrary Hand import, multiway branch generation, quantitative opponent ranges, weighted Equity and normative strategy assessment remain unavailable. Human acceptance remains with `QA-PERSONAL-COACH-001`; the browser inventory is empty. General sequencing and other issue owners are unchanged.

- Scenario is lossy; Hand is canonical legal history.
- Randomization is shared interaction language with bounded deterministic recipe infrastructure, not a universal poker-state generator. Analyze, Hand, and Equity retain surface-specific adapters/authorities; Training remains planner/generator-owned. Random output carries no strategic, frequency, representative-spot, or GTO claim.
- New live Hands use snapshot-authoritative `poker-state/v2`; v1 is historical compatibility.
- `facingSizeBb` is wager-to context; `callAmountBb` is exact incremental price when known.
- Exact pot/SPR uses `currentPotBb`; live stack reasoning uses Hero/effective-stack fields, never compatibility `potBb`/`stackBb`.
- Exact preflop decision role stays distinct from generalized fallback calibration.
- The v4 bounded BB-vs-BTN cold-response policy remains generalized comparative evidence, not solved or independently validated reference truth.
- Source identity, provenance, authority, coverage, capabilities, and permitted claims are distinct.
- Heuristic agreement/disagreement is not skill, accuracy, mastery, correctness, GTO, or automatic remediation.
- Probability gap to the modal action is not an accepted normative correctness rule.
- Personal dominant-only evidence is never fake 100% frequency.
- Structural tests do not replace human visual acceptance.

## Natural-language north star

Natural-language output is part of Riverline's learning experience, not decorative copy. It must be factual from trusted structured facts, keep claim strength within source authority, lead with natural and accessible poker language, vary depth with the decision, omit irrelevant generic sections and filler, state heuristic/incomplete/unsupported/unavailable evidence honestly, and keep a consistent voice across Analyze, Review, Training, Personal Strategy, Saved, Study/Home, and future import flows. Repeated language may vary within bounds, but factual meaning and claim strength must not change.

The authority path is: trusted structured facts -> explanation facts -> claim permission -> natural-language rendering. Natural language never becomes poker or strategy authority and must never imply fake certainty.

## Current execution snapshot

`DOCS-INTEGRITY-001`, `UX-REGRESSION-001`, `WELCOME-INTRO-001`, `WORKSPACE-COMPOSITION-002`, `DOCS-CAPABILITY-DOSSIERS-001`, `TABLE-PHYSICALITY-003`, `HOME-GAME-001B`, `SETTINGS-IA-001`, and `TRAINING-MEMORY-001` are completed/accepted checkpoints. `REFERENCE-PACK-001` is checkpointed/intentionally incomplete: its contract, strict matcher, provider/fallback, and synthetic consumer tests are accepted, while production source acquisition remains `RET-REFERENCE-PACK-001`.

`HANDS-ON-PRODUCT-REVIEW-001` is completed documentation/product triage. An independent outside-user review originated 59 findings, and the product owner manually reproduced all 59 in the current build. [The durable review](../project/HANDS_ON_PRODUCT_REVIEW_2026_08.md) owns detailed evidence and row-level ownership; no finding is closed by the review. Detailed future intent lives in `../project/capabilities/`; status remains in `PRODUCT_BACKLOG.md`. The directional order is:

1. **COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT — `HANDS-ON-DEFECTS-001`**
2. **COMPLETED / HUMAN ACCEPTED CORE-FLOW CORRECTNESS CHECKPOINT — `CORE-FLOW-CORRECTNESS-001`**
3. **COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT — `REPLAY-RAIL-NAV-001`**
4. **COMPLETED / HUMAN ACCEPTED — `TRAINING-COMPOSITION-001`**
5. **COMPLETED / HUMAN ACCEPTED — `EQUITY-COMPOSITION-001`, `ANALYZE-RANGE-UX-001`, and `FIRST-USE-HOME-001`**
6. **COMPLETED / HUMAN ACCEPTED — `SAVED-VISUAL-KNOWLEDGE-001`**
7. **COMPLETED / HUMAN ACCEPTED — `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001`**
8. **COMPLETED / HUMAN ACCEPTED — `GUIDE-CONTENT-001`**
9. **COMPLETED / HUMAN SECURITY ACCEPTED — `AUTH-TRAINING-MEMORY-001`**
10. **COMPLETED / HUMAN ACCEPTED — `DECISION-ECONOMICS-001`; COMPLETED / ACCEPTED — `STRATEGY-TRUST-001`; COMPLETED / ACCEPTED — `DECISION-CONTEXT-SINGLE-AUTHORITY-001`**
11. **COMPLETED / ACCEPTED — `AUDIT-CHEAP-FIX-BATCH-001`** — Full Hand Memory embargo, current-actor Hand context/stack, and complete-known-card structural Equity identities; exact entered-hand outcome authority unchanged
12. **COMPLETED / ACCEPTED — `AUTH-SUPABASE-SINGLETON-001`** — one browser-runtime Supabase client is shared by Authentication, Account/Profile, Saved sync, and Personal Strategy sync; equivalent/repeated acquisition is idempotent and materially different in-runtime configuration fails closed
13. **COMPLETED / HUMAN ACCEPTED — `ANALYZE-SCENARIO-READINESS-001` AND `CARD-CLEAR-SEMANTICS-001`**
14. **COMPLETED / HUMAN ACCEPTED — `HOME-HAND-LIFECYCLE-001`, `TRAINING-MEMORY-AVAILABILITY-001`, AND `SAME-SPOT-COHERENCE-001R`**
15. **COMPLETED / HUMAN ACCEPTED — `LIGHT-WINS-BATCH-001`** — Analyze Scenario uses atomic readiness-valid `analyze-whole-spot-policy/v2` generation and scoped Keep/Change-only controls; Hand rerolls only pending uncommitted chance drafts; Equity preserves matchup structure and explicit calculation while rerolling Known hands or requested board streets
16. **COMPLETED / ACCEPTED FOUNDATION — `MASSIVE-FOUNDATION-CHECKPOINT-001`** — Identity Lifecycle A/B/C, heuristic/reference/normative truth separation, explicit assessment policy, first Training Intelligence, and Personal Strategy Intelligence
17. **ACTIVE NEXT — PORTABLE BROWSER LIFECYCLE — `BROWSER-TEST-PLATFORM-001`**
18. **INCREMENTAL COMPOSITION — `UI-COMPOSITION-ROOT-001` → one workspace extraction pilot; no framework rewrite**
19. **SAVED/HOME — `SAVED-LIBRARY-001` → `HOME-STUDY-CONTINUITY-001`**
20. **BOUNDED REFERENCE-SOURCE DECISION — after read-only research, which may run in parallel**
21. **LEARNING-LOOP EXPANSION**
22. **PERSONAL STRATEGY — `PERSONAL-STRATEGY-003A`**
23. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`**
24. release/mobile/social/PLO later

This order is directional and may move after accepted checkpoints. Reprioritization updates affected live planning documents together; a tiny patch with no product-state change requires no Roadmap churn.

## Current checkpoint boundaries

- `LIGHT-WINS-BATCH-001` is human accepted across Analyze Scenario, top-level Hand / Analyze Hand Mode, and Equity. Preserve the compact dice utility grammar, EN/RU/HE and RTL, concise factual feedback, surface-specific application boundaries, and unchanged canonical card/rules/position/Hand/Scenario/Equity authorities. Hand never randomizes committed history or opponent private cards; Equity never randomizes player count or dead cards and never calculates automatically. Deterministic/versioned recipes remain details-on-demand. Another Like This, broader Lock & Perturb, controlled transfer drills, recipe sharing/import/history, Saved-derived randomization, Training Intelligence integrations, and runout exploration remain unimplemented future extensions.
- `ANALYZE-SCENARIO-READINESS-001` is human accepted. Scenario remains an editable lossy draft, but only centrally validated provider-ready coherence reaches StrategyProvider; invalid chronology, action/facing dependencies, uniqueness, and basic numeric inputs fail closed as `scenario_not_ready` with natural guidance, later-street clears preserve only valid earlier state, and exact actor-relative economics are never invented.
- `CARD-CLEAR-SEMANTICS-001` is human accepted. One DOM-free command owner defines isolated Hero/private/street/board/dead/all/pending clears, empty clears are no-ops, canonical Hand history is protected, and Analyze/Equity share whole-set Dead Cards draft/Apply/cancel behavior with ordinary resting slots and overlay-isolated geometry.
- `AUDIO-MOTION-001` is accepted; subjective Study/UI/Check polish remains `RET-AUDIO-001` debt, not current scope.
- `SETTINGS-IA-001` is accepted structurally; its unavailable real Firefox category/viewport/theme/language matrix remains `QA-HANDSON-010` / `RET-PREMIUM-001` debt.
- `PREMIUM-CLOSEOUT-001` is not cancelled: it is the later whole-product manual, visual, responsive, localization, accessibility, Guide, Core Flow, and release-quality gate after the feature set is materially more mature.
- `UX-REGRESSION-001` is accepted: the eleven owned hands-on IDs are closed with the checkpoint's Node and bounded Firefox 154 evidence; unowned composition/product debt remains open.
- Training Varied/Focused/Full Hand, the Practice Planner, and Training Memory v1 are implemented foundations. Durable Device Guest and account ownership are isolated by generation/disposal fences. The first Training Intelligence slice adds optional pre-reveal Unsure evidence and explicit exact 24-hour Revisit with historical-answer embargo and why-returned facts. Heuristic comparison remains descriptive; normative grading and remediation require an accepted application-owned assessment policy.
- `STRATEGY-TRUST-001` is accepted: declarations and manifest statuses are evidence only; application-owned acceptance bounds authority/capabilities/coverage and binds Reference Packs to exact source ID/version/fingerprint. Live opaque acceptance is process-local and never persisted as proof; historical records retain durable answer-time authority metadata and frozen ClaimPolicy without silent upgrade or reauthentication.
- `reference-pack/v1` has no production data registration. Never promote its synthetic test fixture, benchmark observations, or generalized heuristic curves into trusted reference truth.
- Personal Strategy Intelligence is an accepted local-first foundation: arbitrary named Game Setups and Approaches, structural question-driven range mapping, confirmed qualitative intent, What Riverline understands, Teach Riverline Next, and claim-bounded EN/RU/HE natural-language range analysis/comparison share one immutable evidence authority. Personal Strategy Coach, continuation ranges, observed/opponent integration, and deeper postflop/combo work remain future capability slices.
- Saved Hand/Spot and `HOME-002A` exist. `SAVED-VISUAL-KNOWLEDGE-001` is human accepted for the bounded loaded set: compact grid primary; All / Hands / Spots visible at zero; DOM-free observer-safe Hand and lossy Scenario Spot previews; body-level bounded hover/focus overlay; click/Enter detail; shared cards; identity clearing; unknown-kind unavailable state; unchanged reopen behavior. `SAVED-LIBRARY-001` now owns full retrieval/search/pagination for current Hand/Spot objects; new payload kinds remain later.
- Saved Training Experience, Saved Equity Snapshot, and learner-facing Full Hand Hero-fold termination are preserved future work only; they are not activated, prioritized, or current Saved kinds.
- `FIRST-USE-HOME-001` is human accepted. Home is the permanent recurring startup/study destination; optional Welcome orientation is separate presentation state, defaults to shown with suppression unchecked, suppresses only itself, and has zero selected sidebar destinations. Navigation always reflects the real destination. Guest Home is useful without sign-in. Continue uses only a live canonical Hand or active/paused Personal Strategy; all other current states receive Start. Training, Analyze, Equity, and last-route continuation remain unsupported pending explicit contracts. Current identity surfaces share one canonical brand-spade asset separately from poker-card suits.
- Home Game `001B` is an accepted implementation checkpoint over the separate 001A accounting authority; hard delete/import remain deliberately deferred and real Firefox/provider acceptance remains `RET-HOMEGAME-001` debt. Home Game expansion freezes after safety fixes.
- Workspace composition is accepted as a useful implementation checkpoint, not a whole-product visual-polish closeout: surviving specialized-layout polish remains `RET-COMPOSITION-002` debt. `EQUITY-COMPOSITION-001` is human accepted with bounded 2–10-player input, presentation-only inline names, adjacent Board/Dead/Method setup, compact lifecycle states, a dominant completed comparison, shared transactional card-set editing, and exact-entered-hand next-card outcomes that keep strict-ahead cards separate from structural completions still behind. Richer Equity/Hand Analysis remains preserved future work. Known-card inspectability is separately owned by `RET-CARDS-THEMES-001`.
- `HANDS-ON-DEFECTS-001` is accepted only as a bounded repair checkpoint. Welcome title focus/Escape, clearer Home Game completion state, Return to live, auth feedback, card-removal parity, Analyze clipping, Personal Strategy vocabulary, and Replay geometry are accepted; this is not whole-product or Hand/Training composition acceptance.
- `CORE-FLOW-CORRECTNESS-001` is the completed, human-accepted Core Flow correctness checkpoint. Preserve the fresh-Hand lifecycle; generalized session-level append-only correction over eligible buy-in/rebuy/add-on/cash-out facts with optional reason; continuous two-card known-opponent picker with logical focus and duplicate-card exclusion; and verified canonical minimum-raise/reopening semantics, including a legal 7bb → 13bb reraise from a 6bb last full increment. No human gate remains and no poker-domain rule changed.
- `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` is completed and human accepted. Canonical `PokerState` semantics were correct; the root cause was application/UI coordination: fully known hole deals were mislabeled as hidden/observed Replay events, Replay transition rejection left a stale committed flop draft, and the consumed card could reappear as a later chance candidate. Preserve the accepted explicit Turn → River → Showdown flow, the canonical available-card exclusion of current board, known hole cards, dead cards, and pending selections, stale consumed-draft removal before picker open, Replay/live terminal agreement, and exact-once runout events. Do not reopen Hand composition.
- `GUIDE-CONTENT-001` is completed and human accepted. Guide is the durable workflow-first reference for Hand, Analyze, Training, Equity, and Personal Strategy; Welcome / Learn Riverline remains orientation; existing workspace tutorials remain contextual interactive teaching. Guide actions reuse navigation authority, no tutorial/persistence authority was added, and the accepted Hand/Scenario, reference/Personal Strategy, Facts/Explain, Equity/strategy, heuristic/solved-GTO, Saved object, and sign-in/cloud-sync truth boundaries remain binding.
- `REPLAY-RAIL-NAV-001` is the human-accepted Hand/Replay composition checkpoint: compact Hand context/state on the left, the primary poker table in the center, and legal/chance controls, distinct Replay, and bounded vertical History on the right. Preserve table-first hierarchy, stable live/Replay structure, accepted chronology and seeking, Return to live, canonical actions, no-dongle cards, contributions, Abort/Raise/all-in/invalid-size behavior, EN/RU/HE/RTL, Daylight contrast, and Review. Minor debt remains explicit: dense/10-max lower side panels sit slightly too far inward and the top player slightly too far outward/high; hidden backs may later tuck under their owning player if privacy, ownership, inspectability, and non-obstruction remain intact; full-ring Dealer presence/explainability belongs to table physicality/Game Setup rather than a fake dealer; and History padding/weight/contrast/density/event-row polish belongs to global/premium quality. Do not reopen the accepted architecture for those debts.
- **September Alpha** evidence capture, independent audits, and human triage are complete. This does not claim public beta readiness, production reference coverage, completed live account/sync validation, mobile/social/PLO completion, or completion of the long-term capability roadmap. The resulting foundational order in `CURRENT_PHASE.md` is binding.
- Preserved future capability owners include Personal Strategy Coach; Range Evolution and continuation ranges; Opponent Intelligence and bots; Bluff/Exploit; Import → Review → Study; and Deep Review / Study Inbox. Activate them only through their named roadmap owners.
- The 59 confirmed August findings supersede any broad claim that accepted UI checkpoints equal current whole-product visual acceptance. Existing foundations remain accepted; remaining problems stay open under their named correctness, redesign, and quality owners in the review artifact.

## Hands-on product workflow

For user-facing feature work, use: agent implementation → automated verification → human hands-on use → product discussion → correction/acceptance → checkpoint. After roughly two or three substantial user-facing tickets, perform a short freeform whole-product hands-on pass even if ticket-level automation passed. Backend/foundation tickets with no meaningful visible surface may be checkpointed without artificial browser QA.

## Deliberately retired

Do not revive browser/Electron ONNX inference, native strategy IPC, remote strategy API, arbitrary solver-tree upload, root legacy Training/model/tree prototypes, duplicate Equity, synthetic Training, or arbitrary drag/drop layout editing without a new approved architecture.

## Read routes

Always read `CODEX_WORKFLOW.md`, `../project/CURRENT_PHASE.md`, and the relevant subsystem spec. UI/product work also reads `../project/QA_BACKLOG.md`, `../project/PRODUCT_RETURN_QUEUE.md`, and `../project/PRODUCT_SPEC.md`. Future capability work reads `../project/PRODUCT_BACKLOG.md`. Documentation/state changes read `../project/DOCUMENTATION_GOVERNANCE.md`.

Budget remains approximately US$75 total unless explicitly changed. No paid/cloud experiment without a cap, runtime, artifact, success criteria, and stop criteria.
