# Current Riverline phase

Last refreshed: September 1, 2026 (`AUDIT-CHEAP-FIX-BATCH-001` is accepted; `AUTH-SUPABASE-SINGLETON-001` is active next in the post-audit foundation sequence).

This document answers **what Riverline is doing now and what follows it**. `ROADMAP.md` explains major sequencing, `PRODUCT_BACKLOG.md` owns concise capability/status, capability dossiers preserve detailed long-term intent, and subsystem specs/code own current contracts and implementation truth. QA and accepted checkpoint debt remain in `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.

## Status vocabulary

- **COMPLETED:** accepted bounded outcome; later changes require a new ticket.
- **COMPLETED / HUMAN ACCEPTED ... WITH MINOR DEBT:** accepted bounded product checkpoint whose named non-blocking debt stays with later owners; later architecture changes require a new ticket.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE:** useful foundation accepted with a named resume point.
- **IMPLEMENTATION COMPLETE / AWAITING HUMAN ACCEPTANCE:** the bounded implementation and agent verification are complete, but the product owner has not issued final acceptance.
- **ACTIVE NEXT:** accepted next bounded ticket, started in its own chat.
- **PLANNED NEXT:** ordered work after the active-next ticket.
- **PLANNED NEXT / BLOCKED ON HUMAN ACCEPTANCE:** ordered next work that must not start until the named human checkpoint is accepted.
- **COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED:** an independent product review and its explicit human decisions are complete; accepted implementation still requires its own ticket.
- **PLANNED LATER:** ordered behind nearer work.
- **PRESERVED FUTURE:** accepted direction without an immediate execution commitment.
- **OPEN PRODUCT DECISION:** requires a later explicit choice.

## Immediate execution order

1. **COMPLETED — `DOCS-CAPABILITY-DOSSIERS-001`**
   - established the capability-dossier layer, Legacy ID Index, and cross-surface Interaction Grammar;
   - recovered implemented, preserved, superseded, and rejected historical concepts without reviving features;
   - returned live planning to concise status and sequence ownership;
   - changed no runtime, CSS, poker math, schema, or product feature.

2. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN PRESENTATION DEBT — `TABLE-PHYSICALITY-003`**
   - human acceptance passed table scale, HU/normal Hand composition, felt/rail/table coherence, Hero-card readability, and contribution-to-pot presentation as sufficient to move on;
   - no claim of perfect physical-table polish: revealed opponent cards can still be obscured by seat/action/cradle chrome and remain `RET-CARDS-THEMES-001` debt;
   - existing PokerState, TablePresentation, card, chip, audio/motion, accessibility, privacy, and performance authorities remain unchanged.

3. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX/PROVIDER DEBT — `HOME-GAME-001B`**
   - reusable account players/groups, reorderable session rosters, archive/restore, correction and lifecycle history, completed-session inspection, and export-only portability are implemented without changing accounting authority;
   - hard delete and import are deliberately not exposed because retention, validation, ownership-adoption, and conflict semantics are not accepted;
   - automated coverage is complete for the bounded slice; the requested real Firefox matrix and real authenticated provider path remain explicitly unverified.

4. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT — `SETTINGS-IA-001`**
   - the all-at-once god menu is replaced by four focused categories: Appearance, Audio & Motion, Language & Help, and Account & Data;
   - the existing theme, card, layout, audio, language, tutorial, and account/profile authorities remain intact, while preview/test actions and OS reduced-motion status are not misrepresented as stored preferences;
   - automated inventory, localization, keyboard, authority, and runtime-boundary coverage is complete; the requested real Firefox viewport/theme/language matrix remains explicitly unverified.

5. **CHECKPOINTED / INTENTIONALLY INCOMPLETE — `REFERENCE-PACK-001`**
   - implemented `reference-pack/v1`, deterministic validation/integrity, an exact canonical matcher, a provider adapter, unchanged labelled fallback, and source-agnostic Playbook/Training/Matrix/Analyze/Review consumption;
   - retained all repository frequencies as explicit synthetic test data behind a test-only gate; no production pack or authority upgrade is registered;
   - resume source acquisition only with exact immutable assumptions/data, explicit compatible license and redistribution rights, reproducible or strong provenance, and predeclared independent validation evidence.

6. **COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT — `TRAINING-MEMORY-001`**
   - durable owner-scoped DecisionRecord/session evidence now covers Varied, Focused, and Full Hand decisions with frozen answer-time source/version/coverage/capability/claim semantics;
   - bounded indexed recent history, transparent review reasons/lifecycle, exact historical Same Spot, and planner/generator-backed current Similar Spot are implemented without creating new poker, Training, strategy, Replay, Saved, or identity authorities;
   - advanced scheduling, filters/trends, Saved/Home/Replay/Analyze continuity, Personal Strategy opt-in, sync/export, and `Not sure` remain later work; real Firefox EN/HE/RU and viewport acceptance is `RET-TRAINING-MEMORY-001`.

7. **COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED — `PERSONAL-STRATEGY-002R`**
   - the [independent review](PERSONAL_STRATEGY_002R_REVIEW.md) and human disposition preserve the immutable intended-evidence architecture while accepting Game setup/Approach, local-first Guest use, an RFI-first five-question path, What Riverline understands, Teach Riverline Next, Matrix Edit consolidation, and bounded versioning direction;
   - selected reference, personal intent, source-labelled observed behavior, and opponent policy remain separate; live Firefox/real-user acceptance remains routed debt.

8. **COMPLETED / CONFIRMED PRODUCT EVIDENCE CAPTURED — `HANDS-ON-PRODUCT-REVIEW-001`**
   - an independent outside-user review originated 59 findings, and the product owner manually reproduced and confirmed every one in the current build;
   - the [durable review artifact](HANDS_ON_PRODUCT_REVIEW_2026_08.md) preserves every finding, its user problem, desired outcome, classification, priority, and owner;
   - no runtime or tests changed, and no finding was closed by documentation.

9. **COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT — `HANDS-ON-DEFECTS-001`**
   - the second product-owner acceptance pass closes the bounded ticket under the anti-loop rule; no third local correction cycle is authorized;
   - accepted repairs are Welcome title focus/Escape, materially clearer Home Game completion state, Return to live, privacy-safe auth feedback, dead-card/range parity, Analyze clipping, stable Personal Strategy vocabulary, and materially improved Replay geometry;
   - the later human-accepted `FIRST-USE-HOME-001` checkpoint resolved false Welcome navigation selection; Home Game imbalance prominence remains with `HOME-GAME-PRESENTATION-001`. The revealed-card/player overlap was routed to `REPLAY-RAIL-NAV-001` and is now resolved at its human-accepted no-dongle checkpoint, with only the named future hidden-back physicality constraint retained;
   - the checkpoint does not claim all HPR issues fixed or accept Hand, Training, Home, Saved, or whole-product composition.

10. **COMPLETED / HUMAN ACCEPTED CORE-FLOW CORRECTNESS CHECKPOINT — `CORE-FLOW-CORRECTNESS-001`**
   - completed Hand exposes Review and `Start new hand` as the two primary actions while Replay, Analysis, and Save remain secondary; lifecycle behavior and fresh source/Hand identity are unchanged;
   - active sessions expose `Correct entries` over every uncorrected buy-in, rebuy, add-on, and cash-out, while the local cash-out shortcut remains; reason is optional and absence persists as `null`, confirmation remains operable, and reversal-only plus atomic replacement preserve the original ledger fact;
   - private-card entry continues from the first to second card for every Hand seat; the first Escape closes only the card picker while preserving the expanded known-opponent disclosure, selected first card, logical focus, and canonical cross-seat duplicate-card exclusion;
   - canonical no-limit sizing was verified without a poker-domain change: 1→3 has minimum 5, 1→7 has minimum 13, 1→3→8 has minimum 13, postflop 5→15 has minimum 25, and short/cumulative all-in reopening plus stack-bounded all-in behavior remain correct;
   - focused Node coverage and targeted Firefox 154 EN/RU/HE/RTL interaction verification passed with no page errors, and the product owner completed final hands-on acceptance before Replay began; no Core Flow human gate remains.

11. **COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT — `REPLAY-RAIL-NAV-001`**
   - the poker table now leads the Hand workspace, with compact Hand Stage and canonical legal/terminal controls in a first-class interaction rail beside it;
   - one vertically scrolling, street-grouped chronology owns Hand/Replay history, direct frame seeking, selected-street expansion, and in-progress Return to live without adding another cursor or history authority;
   - the second product-owner pass accepts the left-context / center-table / right-interaction skeleton, separate Replay and bounded vertical History, table-first 1920×1080 composition, no-dongle card language, and stable live/Replay structure; final hardening does not reopen those decisions;
   - final hardening attaches Hero and HU panels to the enlarged rail, keeps cards immediately inward, moves exact contributions outward and Dealer inward, and preserves distinct card/contribution/street/pot zones through HU, 4-max, 6-max, and 10-max;
   - the 10-max known-opponent editor and right rail now scroll without participating in center-grid track sizing; expanding all nine opponent rows changes measured table top/left/width/height by 0 px;
   - Abort is hidden in setup and terminal states and appears only in Current Hand for a live canonical Hand; Daylight contributions use explicit semantic surface/text/halo/border/chip roles with measured 13.23:1 text contrast;
   - legal Raise re-entry, exact all-in chance progression, invalid 20-player rejection, RU/HE/RTL presentation, focused/full Node checks, solver tests, and the Firefox 154 product-state matrix pass;
   - final hands-on acceptance at 1920×1080 / 100% confirms the left compact Hand context/state, center primary poker table, and right legal/chance + distinct Replay + bounded vertical History product model; table-first hierarchy, live/Replay stability, chronology, collapse/scroll, seeking, Return to live, actions, no-dongle cards, contributions, Abort, Raise, all-in, invalid-size handling, EN/RU/HE/RTL, Daylight contrast, and Review are accepted;
   - this is not perfect-polish acceptance. Non-blocking debt remains explicit: in dense/10-max geometry the lower side panels sit slightly too far inward and the top player slightly too far outward/high; hidden backs may later tuck under/behind their owning player only while privacy, ownership, inspectability, non-obstruction, known-card readability, and no-dongle presentation remain intact; full-ring Dealer presence/explainability belongs to table physicality/Game Setup without adding a fake dealer; and History padding, font weight, contrast, density, and event-row polish belong to global/premium quality. None reopens the accepted composition or chronology architecture.

12. **COMPLETED / HUMAN ACCEPTED — `TRAINING-COMPOSITION-001`**
   - one `Start Training` CTA now owns selected-configuration start; a persistent decision region plus bounded study rail retain the same skeleton through ready, feedback, completion, Focused, and Full Hand projections;
   - setup collapses during practice and reopens through Adjust Drill; Session Progress, source truth, History, Assistance, and lazy bounded Memory remain top-packed; answer feedback defaults to compact Facts with optional bounded Explain depth;
   - the first hands-on pass accepted this normal Training skeleton and returned bounded correction debt: pre-session support now hides meaningless zero/unavailable cards, Review later/Difficult expose durable reversible feedback, immediate Facts prioritize decision-relevant evidence while generic card-removal detail remains under Explain, and Full Hand now projects the large shared table beside Hand-grammar legal actions with sizing revealed only after Bet/Raise;
   - prompt Study audio schedules before deep answer rendering on a prepared context, and a clean-start Firefox gate opens Personal Strategy in its truthful Guest state rather than the error surface;
   - final acceptance hardening defers every normative Full Hand verdict, source, Fact, and deep explanation until the existing shared terminal Review; live Hero answers receive neutral recording confirmation only, while Varied and Focused retain immediate feedback;
   - live Full Hand now exposes confirmed Abort outside poker actions, preserves already-recorded Training Memory evidence as abandoned, clears transient/replay/controller state without fabricating completion, and returns to setup; normal answered drills keep primary progression above study labels, Facts, and Explain, and sparse normal states use content-driven height while Full Hand retains table scale;
   - focused semantic/domain tests and the Firefox 154 matrix pass at 1920×1080, 1366×768, 2560×1440, and 2560×1600 across EN/RU/HE RTL and Midnight/Graphite/Daylight.
   - lean closeout evidence at Firefox 154 / 1920×1080 proves `Replay this decision` remounts the exact canonical exercise, replay answers do not change headline session counters or planner progress, Next advances exactly one exercise, and terminal Full Hand Review retains the live-scale shared table with vertical canonical History and no horizontal timeline. The product owner human accepted the checkpoint.

13. **COMPLETED / HUMAN ACCEPTED — `EQUITY-COMPOSITION-001`**
   - bounded 2–10-player setup keeps player inputs in one scrollable region with optional transient names and keeps Board/Dead/Method readily adjacent; the empty/running result state stays compact, while completed Equity uses a separate dominant player-comparison surface and optional factual hand details.
   - canonical Equity requests, method selection/disclosure, progress, cancellation, stale-result invalidation, and factual outs remain preserved. Shared transactional card-set editing is accepted across its existing consumers, and optional inline player names remain presentation-only.
   - exact entered hands now expose current standing and next-card outcome families through `exact-entered-hand-outcomes/v1`: a structural completion is explicitly not the same claim as a card that puts a player ahead of every entered exact opponent. Focused and targeted Firefox evidence passed, and the product owner human accepted the checkpoint.
   - Runout Explorer, Card Outcome Preview, richer Hand Standing, nuts/locks/vulnerability, clean/dirty improvements, richer split-pot explanation, weighted range-relative analysis, and other dossier-owned depth remain preserved future work rather than hidden closeout debt.

14. **COMPLETED / HUMAN ACCEPTED — `ANALYZE-RANGE-UX-001`**
   - the Range Matrix keeps its selected-hand inspector and compact legend local to the Matrix; unavailable and known-card-removed states remain explicit without a duplicate floating hand popup.
   - Range Category Comparison leads with complete Hero and opponent matrices, then truthful paired category bars. Hero and opponent retain independent percentages on one shared 0–100% scale; fully removed and not-in-sample remain distinct.
   - comparison uses one canonical surviving representative per eligible sampled class and explicitly does not generalize that representative's category to every combo in the class. `range-comparison-facts/v1` is the DOM-free factual projection over canonical `RangeAnalysisFacts v1` and Range Core card-removal conditioning; renderers consume its structured facts only.
   - Facts → Explain progressive depth is accepted. Weighted ranges, range-vs-range Equity, nut-advantage/distribution claims, and combo-level action-conditioned propagation remain future `RANGE-EVOLUTION-001` / dependency-gated work rather than implied current capability.

15. **COMPLETED / HUMAN ACCEPTED — `FIRST-USE-HOME-001`**
   - Home is the permanent recurring startup and study destination; optional Welcome orientation is presentation state separate from routing, suppresses only itself, defaults to unsuppressed/unchecked on first use, and shows zero selected sidebar destinations while active;
   - active navigation always reflects the true destination, and Guest Home remains useful without sign-in;
   - truthful Continue is limited to a live canonical Hand or active/paused Personal Strategy. Without either, Home presents a useful Start state rather than fabricated recency;
   - Training, Analyze, Equity, and last-route continuation remain unsupported until their owners expose explicit contracts. Future Home evolution must not invent recent activity, recommendations, streaks, cloud/sync claims, or cross-workspace history;
   - current Riverline identity surfaces reuse one canonical brand-spade asset; poker-card suit rendering remains separate.

16. **COMPLETED / HUMAN ACCEPTED — `SAVED-VISUAL-KNOWLEDGE-001`**
   - `SavedStudyObject v1` remains the persistence/schema authority and Hand/Spot remain the only currently interpreted kinds; unknown future kinds render unsupported/unavailable;
   - DOM-free `saved-study-preview-facts/v1` projects observer-safe Hand facts and visibly lossy/schematic Scenario Spot facts for the compact primary Saved grid, while `card-presentation/v1` remains the card-rendering authority;
   - All / Hands / Spots remain visible at zero count; hover/focus share one viewport-bounded body-level overlay, while click/Enter owns bounded detail expansion;
   - identity/account changes clear private preview/detail state, and Hand/Spot reopen behavior remains unchanged. Saved Training Experience, Saved Equity Snapshot, and learner-facing Full Hand Hero-fold termination are preserved future work only.

17. **COMPLETED / HUMAN ACCEPTED — `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001`**
   - canonical `PokerState` semantics were correct; the root cause was application/UI state coordination, not poker mathematics and not Hand composition;
   - fully known hole deals were mislabeled as hidden/observed Replay events, Replay transition rejection left a stale committed flop draft, and that stale draft allowed an already-consumed board card to reappear as a later chance candidate;
   - the accepted explicit Turn → River → Showdown all-in chance flow remains intact. The canonical available-card query excludes the current board, known hole cards, dead cards, and pending selections, while stale consumed draft cards are removed before the chance picker opens;
   - Replay and live terminal states agree, and runout events occur exactly once.

18. **COMPLETED / HUMAN ACCEPTED — `GUIDE-CONTENT-001`**
   - Guide is the durable, workflow-first product reference rather than a feature inventory, manual, onboarding replacement, or second tutorial system;
   - the current Hand, Analyze, Training, Equity, and Personal Strategy workflows are covered with actions routed through the existing navigation authority;
   - Welcome / Learn Riverline remains orientation, while existing workspace tutorials remain contextual interactive teaching; no tutorial or persistence authority was added;
   - the accepted Guide preserves Hand versus Scenario, reference/source versus Personal Strategy, Facts versus Explain, Equity versus strategy, heuristic fallback versus solved GTO, object-specific Saved limitations, and sign-in versus guaranteed cloud-sync boundaries.

19. **FOUNDATIONAL GATES — POST-AUDIT HUMAN EXECUTION ORDER**
   1. **COMPLETED / HUMAN SECURITY ACCEPTED — `AUTH-TRAINING-MEMORY-001`** — authentication-aware owner scope and generation now isolate prior-account Training Memory from Guest/other accounts, revoke local access before provider cleanup, discard stale queued/read results, abort stale in-flight writes, and preserve account bytes for authenticated return;
   2. **COMPLETED / HUMAN ACCEPTED — `DECISION-ECONOMICS-001`** — canonical pot accounting remains authoritative; accepted actor-relative strategic pricing projects exact contestable/ineligible pot-after-call and raw-equity facts through `deriveActorCallEconomics(state, actorPlayerId)` without reopening ledger accounting;
   3. **COMPLETED / ACCEPTED — `STRATEGY-TRUST-001`** — provider declaration and structural/source validation are now separated from application-owned acceptance; bounded authority requires exact registered identity/version/fingerprint where applicable, cannot exceed acceptance ceilings, and persists only durable answer-time authority/claim evidence rather than a live trust token;
   4. **COMPLETED / ACCEPTED — `DECISION-CONTEXT-SINGLE-AUTHORITY-001`** — Scenario and Hand now use their canonical application projectors through `resolvePlaybookDecisionContext()`; missing/failed Playbook dependencies clear stale context/result state and fail closed without a local projector;
   5. **COMPLETED / ACCEPTED — `AUDIT-CHEAP-FIX-BATCH-001`** — live Full Hand Memory presentation redacts answer/source/comparison/review information until terminal Review without rewriting stored evidence; Hand action context and stack are current-actor-relative while Hero identity remains distinct; specific Equity structural completion identities exclude all known hole cards, board, and dead cards without changing exact entered-hand outcome authority;
   6. **ACTIVE NEXT — `AUTH-SUPABASE-SINGLETON-001`** — repair duplicate Supabase/auth client ownership without expanding the broader identity lifecycle;
   7. `IDENTITY-LIFECYCLE-001` — establish cross-surface owner, generation, invalidation, and disposal behavior, including the durable anonymous device-local Guest target and authenticated sign-out isolation;
   8. `HEURISTIC-BASELINE-TRUTH-001` — make every consumer treat the current heuristic as exploratory/comparative baseline evidence only;
   9. `TRAINING-NORMATIVE-001` — separate comparative practice from normative grading and replace probability-gap-to-modal-action as a normative correctness rule;
   10. `BROWSER-TEST-PLATFORM-001` — create a portable mounted-browser lifecycle test platform;
   11. `UI-COMPOSITION-ROOT-001` — define the bounded composition root and lifecycle seams without a framework rewrite;
   12. run one bounded workspace extraction pilot chosen by the composition-root ticket;
   13. `SAVED-LIBRARY-001` — deliver full retrieval for current Saved Hand/Spot objects before adding payload kinds;
   14. `HOME-STUDY-CONTINUITY-001` — connect only contract-backed study continuity;
   15. make one bounded reference-source decision after the read-only source research is ready;
   16. expand the learning loop only after the trust, grading, lifecycle, browser, and retrieval gates;
   17. `PERSONAL-STRATEGY-003A` — then execute the preserved versioned Game setup/Approach and first-value reset.
   - read-only reference-source research may run in parallel;
   - Home Game remains a supporting utility and freezes expansion after safety fixes;
   - no broad visual-polish wave, bots, Range Evolution, advanced Equity, new Saved payload kinds, mobile, social, PLO, or natural-language Coach work moves ahead of these gates.

20. **PRESERVED LONG-TERM CAPABILITY ROADMAP**
   - Learning Evidence, Natural-Language Intelligence, Reference Strategy Evolution, Equity/Hand Analysis, Bluff/Exploit Analysis, Opponent Intelligence, Deep Hand Review, Training Intelligence, Personal Strategy Intelligence, Range Evolution, Saved Knowledge/Sharing, Home Game Evolution, and Random Spot Generator remain durable continuation paths in capability dossiers;
   - capability documentation does not activate any candidate or pre-commit its order.

21. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`**

22. **PRESERVED FUTURE — release, deliberate mobile, social, and PLO branches later**

The **September Alpha evidence and audit checkpoint is complete**: it captured the desktop build, synchronized documentation, whole-product manual pass, independent cross-model hands-on and theoretical audits, and authoritative human triage. Completion does not mean the resulting foundation debts or eleven blind findings are fixed. It is an internal/high-quality alpha checkpoint, not public beta readiness, production reference coverage, completed live account/sync validation, finished mobile/social/PLO, or a completed long-term capability roadmap.

Reassess only at clean checkpoints. Documenting a capability does not pull it forward.

## Accepted foundation

The following architecture is established and must not be duplicated:

- `GameRulesDefinition v1` / immutable `GameRulesSnapshot v1` own mathematical rules; new live Hands use snapshot-authoritative `PokerState v2`.
- `shared/poker-domain/` owns cards, state, actions, legality, accounting, evaluator, canonical Equity, Hold'em combos, and weighted ranges.
- Scenario remains a truthful lossy snapshot; Hand remains canonical legal history.
- `DecisionContext v1` plus additive v1.1 facts is the intended input to one `StrategyProvider v1` → `StrategyResult v1` → `StrategyClaimPolicy v1` path. `DECISION-CONTEXT-SINGLE-AUTHORITY-001` is accepted: `deriveDecisionContextFromPlaybookScenario()` owns Scenario, `deriveDecisionContextFromPokerState()` owns Hand, and `resolvePlaybookDecisionContext()` selects the canonical projection. Missing or failed dependencies clear DecisionContext and StrategyResult without local reconstruction. This does not remove unrelated poker helpers or complete the broader `logic.js` composition work owned by `UI-COMPOSITION-ROOT-001`.
- Strategy trust follows provider declaration → structural/source validation → application-owned acceptance → effective bounded authority → `StrategyResult v1` → `StrategyClaimPolicy v1`. Strong authority is never self-declared; live opaque acceptance is process-local, while persisted historical evidence freezes durable answer-time authority/coverage/capability metadata and ClaimPolicy without reauthentication.
- `reference-pack/v1` validates declarative bounded packs and can select an exact pack behind that same provider path. Manifest validation status is evidence only; production authority additionally requires registered exact source ID, version, and content fingerprint. No production pack is currently registered.
- `RangeAnalysisFacts v1` owns canonical factual range/hand classification; DOM-free `range-comparison-facts/v1` projects representative-class comparison facts after canonical Range Core card-removal conditioning.
- The current deterministic heuristic is a generalized exploratory/comparative baseline only, never normative, exact-frequency, skill, accuracy, mastery, correctness, solved-GTO, Nash, exact-EV, exploitability, or optimality authority. Agreement does not prove ability, and disagreement alone does not create remediation. Equity fallback remains exploratory; unavailable remains unavailable.
- Training Practice Planner/intent/request own structural curriculum targets; the canonical Training generator owns legal trajectories and grading.
- `training-decision-record/v1` / `training-session-record/v1` own durable encountered-decision/session evidence; historical source/authority/claim snapshots are immutable, Same Spot preserves their answer-time semantics, and Full Hand decisions share one session replay authority. Reference comparison/remediation requires ClaimPolicy permission, so exploratory or unaccepted sources cannot create reference-alignment states or automatic reference-derived review. Authentication-aware owner/generation scope now gates every operation, while the durable anonymous Device Guest and generalized cross-surface lifecycle remain future `IDENTITY-LIFECYCLE-001` work.
- `AnalysisExplanation v1`, `RangeAnalysisFacts v1`, and `BluffAnalysisFacts v1` consume trusted facts without becoming poker, Equity, range, or strategy authorities.
- `table-presentation/v1` and `hand-review/v1` are ephemeral projections; `experience-event/v1`, `riverline-audio/v1`, and `riverline-motion/v1` create presentation consequences only.
- `SavedStudyObject v1` remains Saved persistence/schema authority; DOM-free `saved-study-preview-facts/v1` is its bounded Hand/Spot preview projection, not a second Saved or poker authority. Personal Strategy evidence, account/sync, and Home Game retain their separate authorities.

Do not revive browser/Electron ONNX inference, remote strategy APIs, arbitrary solver-tree upload, duplicate Equity, synthetic legacy Training, or a second poker/range/Saved authority.

## Current checkpoint and resume map

### Visible product and table

Completed/checkpointed work includes adaptive Table Presence, canonical Replay, shared Full Hand Review, accepted audio/motion architecture, `UX-REGRESSION-001`, `WELCOME-INTRO-001`, the accepted-with-debt `WORKSPACE-COMPOSITION-002` simplification, and `TABLE-PHYSICALITY-003` with explicit presentation debt.

`HOME-GAME-001B` is completed at an accepted implementation checkpoint with broader real Firefox/provider acceptance retained as `RET-HOMEGAME-001`; the generalized append-only session-entry correction is human accepted under the completed Core Flow checkpoint. `SETTINGS-IA-001` is also completed at an accepted implementation checkpoint; its unavailable real Firefox matrix is retained under `QA-HANDSON-010` and `RET-PREMIUM-001`. `HANDS-ON-DEFECTS-001` is an accepted bounded repair checkpoint, not whole-product visual acceptance. The Hand/Replay structural owner is completed and human accepted with minor table-physicality debt: it replaces horizontal primary chronology with a vertical street-grouped rail, keeps table and actions simultaneously available, and repairs card/seat, folded-seat, Dealer-button, and static contribution-line presentation. Its accepted product model must remain stable; named seat geometry, hidden-card physicality, full-ring Dealer-presence explainability, and History micro-polish debt remain with the Return Queue and do not reopen the architecture. Fresh-Hand lifecycle, transaction correction, continuous two-card opponent entry, and canonical min-raise/reopening behavior are completed and human accepted under `CORE-FLOW-CORRECTNESS-001`. Controls First and the ineffective user-facing Comfortable/Compact selector remain removed.

`CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` is completed and human accepted. Canonical `PokerState` semantics were correct; the application/UI repair aligns fully known hole-deal Replay labeling, clears stale committed board drafts after rejected Replay transitions, derives available chance cards without current-board, known-hole, dead, or pending cards, and removes stale consumed drafts before opening the picker. Explicit Turn → River → Showdown remains intact, Replay/live terminal states agree, and each runout event occurs exactly once. This acceptance does not reopen Hand composition.

### Home Game

`HOME-GAME-001B` completes the bounded organizer-management continuation over the separate 001A exact-money domain: stable reusable players, editable ordered groups, roster reuse, completed-session archive/restore, atomic visible correction/replacement history, lifecycle revisions, and canonical account-only export. The human-accepted Core Flow checkpoint exposes that append-only reversal/correction capability at session level across eligible ledger types, retains the cash-out shortcut, makes the reason optional, and preserves reversal-only/confirmation operability without destructive editing. Stronger imbalance prominence and broader organizer physicality remain conditional bounded work under `HOME-GAME-PRESENTATION-001`. Hard delete and import stay deferred for missing safety contracts. Guest remains runtime-only.

### Settings and premium closeout

`SETTINGS-IA-001` replaced the Settings god menu with four focused categories, kept Learn Riverline as the primary orientation entry, and added a secondary Guide/restart path inside Settings without creating new preference authorities. `GUIDE-CONTENT-001` is human accepted: Guide now owns durable product reference while workspace tutorials retain contextual interactive teaching. Separate customization debt remains preserved under `CUSTOMIZATION-UX-001`, including clearer theme creation, Daylight comfort, richer card backs, compact controls, and a manual reduced-motion override. Existing transactional theme safety and immutable built-ins remain accepted foundations, not proof that creation/discovery is finished. `GLOBAL-PRODUCT-QUALITY-001`, customization work, and god-file decomposition are not active before audit evidence unless the sanity pass exposes a blocker; `PREMIUM-CLOSEOUT-001` remains the later pre-release whole-product gate.

### Strategy and references

Source authority, DecisionContext v1.1, exact preflop role semantics, research-only reference benchmarking, the bounded v4 BB-vs-BTN cold-response calibration, and the `reference-pack/v1` provider foundation are complete/checkpointed foundations. No production reference pack or validated general Hold'em production reference exists.

`REFERENCE-PACK-001` proves the strict pack/provider/claim/fallback architecture for the preferred six-max BB-versus-BTN 2.5bb intake family, but a bounded browser pass found no available browser and no production-safe corpus was otherwise supplied. The exact resume point is source acquisition and independent review; synthetic architecture fixtures must never be promoted. Training Memory can proceed because its durable evidence model can preserve the actual heuristic source/version and comparative semantics without pretending reference completion. See the [Reference Pack v1 spec](REFERENCE_PACK_V1_SPEC.md) and [Reference Strategy dossier](capabilities/REFERENCE_STRATEGY_EVOLUTION.md).

### Training

Varied, Focused, and Full Hand Training are legal, deterministic, provider-backed foundations. `TRAINING-MEMORY-001` adds durable DecisionRecord/session evidence, indexed recent history, a Review queue, reversible review lifecycle, exact historical Same Spot, and planner/generator-backed current Similar Spot. `AUTH-TRAINING-MEMORY-001` is human/security accepted: raw AccountIdentity storage routing is no longer authorization; auth/owner generation protects reads, writes, lazy decisions, Same/Similar Spot, review actions, and mixed panel reads across A → Guest → B and A → Guest → A. Explicit sign-out revokes local access before provider cleanup, and provider failure cannot restore it. Heuristic disagreement still contributes automatic review priority, owned by `HEURISTIC-BASELINE-TRUTH-001` / `TRAINING-NORMATIVE-001`. Heuristic agreement or disagreement is comparative evidence only; it is not skill, accuracy, mastery, correctness, GTO, or automatic remediation. Old evidence retains its exact source/version/coverage/capabilities/claim snapshot. Advanced scheduling, filters/trends, Saved/Home/Replay/Analyze continuity, Personal Strategy opt-in, sync/export, `Not sure`, and the durable anonymous Device Guest remain later slices. See [Training Memory v1](TRAINING_MEMORY_V1_SPEC.md), [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md), and [Learning Evidence](capabilities/LEARNING_EVIDENCE_FOUNDATION.md).

### Personal Strategy

Calibration, deterministic inference, Matrix, Range Builder, Range Teacher, bounded RFI context transfer, and optional sync are checkpointed over one sparse immutable intended-strategy evidence authority.

The independent [`PERSONAL-STRATEGY-002R` review](PERSONAL_STRATEGY_002R_REVIEW.md) is completed and human-accepted. `PERSONAL-STRATEGY-003A` remains the preserved versioned Game setup/Approach migration plus bounded local-first first-value reset before provider integration. It is ordered only after the foundation gates, one workspace extraction pilot, current Saved/Home continuity, a bounded reference-source decision, and learning-loop expansion; it does not jump that queue. The confirmed hands-on evidence strengthens broad sparse/high-information coverage before fine boundary refinement and confirms that exactly-three/environment restrictions and standalone Teacher/Builder complexity are painful. Exactly three legacy UI modes are not a future product requirement. Direct intent, inference, selected reference, source-labelled observed behavior, and opponent policy remain distinct; dominant-only evidence never becomes a fake 100% mix. Accepted durable direction lives in the [Personal Strategy dossier](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md).

### Analysis, Equity, bluff, and ranges

Canonical Equity, `RANGE-CORE-001`, `ANALYSIS-RANGE-001`, and `BLUFF-001` are current foundations. Their richer long-term directions are preserved in the [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md), [Bluff and Exploit Analysis](capabilities/BLUFF_EXPLOIT_ANALYSIS.md), and [Range Evolution](capabilities/RANGE_EVOLUTION.md) dossiers. They do not jump the current queue.

### Saved, Home, opponents, and release

Saved Hand/Spot and `HOME-002A` exist. `SAVED-VISUAL-KNOWLEDGE-001` is completed and human accepted for the bounded loaded set: the compact grid is primary; All / Hands / Spots remain visible at zero; DOM-free observer-safe/lossy previews use a bounded body overlay and explicit detail; unknown kinds remain unavailable; reopen and persistence boundaries are unchanged. Full retrieval/search/pagination over the current Hand/Spot library is now `SAVED-LIBRARY-001`; it does not authorize new Saved payload kinds. Saved Training Experience and Saved Equity Snapshot remain dependency-gated future payload decisions. A strict deterministic `OpponentPolicy v1` and basic Full Hand bot policy already exist; richer archetypes, custom policies, and claims about real opponents remain future work. Accounts/sync remain local-first and opt-in; Training Memory auth isolation is accepted, while generalized cross-surface lifecycle repair, live Supabase/RLS, and two-profile acceptance remain required before beta.

Detailed intent lives in the [Saved Knowledge](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md) and [Opponent Intelligence](capabilities/OPPONENT_INTELLIGENCE.md) dossiers. Release, mobile, social, and PLO remain later branches in their preserved order.

## Cross-cutting acceptance

- Every visible feature owns its tutorial update, EN/RU/HE/RTL, accessibility, reduced-motion, responsive, and human visual acceptance.
- Structural tests never substitute for subjective real-browser acceptance.
- Shared semantics follow `INTERACTION_GRAMMAR.md`; unknown/unavailable never silently become zero/false.
- PERF-001 invocation, reuse, and invalidation guarantees remain binding.
- Repeated human rejection triggers product-concept reassessment before another mechanical correction loop.
- For user-facing work, use implementation → automated verification → human hands-on use → product discussion → correction/acceptance → checkpoint. After roughly two or three substantial user-facing tickets, run a short freeform whole-product hands-on pass; backend-only foundations do not need artificial browser QA.

## Update rule

After an accepted ticket, update this file when the active ticket, exact order, or subsystem resume point changes. Sequence changes move with `ROADMAP.md` and the affected `PRODUCT_BACKLOG.md` record. Capability dossiers preserve long-term intent; specs/code preserve current contracts/truth; QA and Return Queue preserve unresolved acceptance and debt. Do not create another status summary.
