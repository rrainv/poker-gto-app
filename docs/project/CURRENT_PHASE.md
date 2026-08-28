# Current Riverline phase

Last refreshed: August 28, 2026 (`CORE-FLOW-CORRECTNESS-001` and `REPLAY-RAIL-NAV-001` are completed and human accepted; `TRAINING-COMPOSITION-001` is active next, followed by the visible-product closure wave and September Alpha whole-app/docs/audit gates; `PERSONAL-STRATEGY-003A` is preserved but is not immediately next).

This document answers **what Riverline is doing now and what follows it**. `ROADMAP.md` explains major sequencing, `PRODUCT_BACKLOG.md` owns concise capability/status, capability dossiers preserve detailed long-term intent, and subsystem specs/code own current contracts and implementation truth. QA and accepted checkpoint debt remain in `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.

## Status vocabulary

- **COMPLETED:** accepted bounded outcome; later changes require a new ticket.
- **COMPLETED / HUMAN ACCEPTED ... WITH MINOR DEBT:** accepted bounded product checkpoint whose named non-blocking debt stays with later owners; later architecture changes require a new ticket.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE:** useful foundation accepted with a named resume point.
- **IMPLEMENTATION COMPLETE / FINAL HUMAN ACCEPTANCE REQUIRED:** the bounded implementation, human-QA correction, and agent verification are complete, but the product owner has not issued final acceptance.
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
   - Hand still appears selected on Welcome and Home Game imbalance prominence remains weak; those remain with `FIRST-USE-HOME-001` and `HOME-GAME-PRESENTATION-001`. The revealed-card/player overlap was routed to `REPLAY-RAIL-NAV-001` and is now resolved at its human-accepted no-dongle checkpoint, with only the named future hidden-back physicality constraint retained;
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

12. **ACTIVE NEXT — `TRAINING-COMPOSITION-001`**
   - own one primary start CTA, stable pre/post-answer skeleton, top packing, Action History, Assistance, Training Memory, setup/status, and progressive explanation depth.

13. **PLANNED AFTER TRAINING — `EQUITY-COMPOSITION-001`**
   - own bounded player tiles, optional useful names, central Board/Dead/Method controls, and dominant result presentation without changing canonical Equity.

14. **PLANNED AFTER EQUITY — `ANALYZE-RANGE-UX-001`**
   - own local Matrix inspection, truthful comparison/card-removal presentation, persistent/local legend, decision-fact discovery, and progressive depth without adding a range or analysis authority.

15. **PLANNED AFTER ANALYZE/RANGE — `FIRST-USE-HOME-001`**
   - own recurring launch/home, onboarding separation, sidebar/active-workspace semantics, first- versus returning-launch behavior, and useful truthful Guest Home density.

16. **BOUNDED SECONDARY POLISH WAVE — exact order reassessed as needed**
   - `GUIDE-CONTENT-001`, `SAVED-VISUAL-KNOWLEDGE-001`, `CUSTOMIZATION-UX-001`, and `GLOBAL-PRODUCT-QUALITY-001` address the highest-impact surviving visible/systemic debt;
   - `HOME-GAME-PRESENTATION-001` and `AUDIO-DESIGN-001` remain conditional and bounded according to remaining time and product impact.

17. **SEPTEMBER ALPHA CLOSURE AND AUDIT GATES**
   - run a human whole-app pass after the visible closure and bounded polish wave;
   - synchronize and freeze documentation integrity/continuity, then the human owns the clean commit and audit tag;
   - run independent cross-model deep audits: one blind hands-on product audit and one white-box theoretical/architecture audit;
   - perform human triage and fix serious P0/P1 audit findings before activating a major new feature.

18. **PRESERVED MAJOR FEATURES / ACTIVATE ONLY FROM POST-AUDIT EVIDENCE**
   - `PERSONAL-STRATEGY-003A`, `GAME-SETUP-EVOLUTION-001`, `RANGE-EVOLUTION-001`, or another major capability may be selected only after the September Alpha audits and human triage;
   - `003A` remains the preserved versioned Game setup/Approach migration and local-first first-value reset; it is not immediately next and has not been deleted or demoted;
   - selected reference, personal intent, source-labelled observed behavior, and opponent policy remain separate, and provider/reference/observed integration still follows an accepted `003A` checkpoint if that feature is selected.

19. **PRESERVED LONG-TERM CAPABILITY ROADMAP**
   - Learning Evidence, Natural-Language Intelligence, Reference Strategy Evolution, Equity/Hand Analysis, Bluff/Exploit Analysis, Opponent Intelligence, Deep Hand Review, Training Intelligence, Personal Strategy Intelligence, Range Evolution, Saved Knowledge/Sharing, Home Game Evolution, and Random Spot Generator remain durable continuation paths in capability dossiers;
   - capability documentation does not activate any candidate or pre-commit its order.

20. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`**

21. **PRESERVED FUTURE — release, deliberate mobile, social, and PLO branches later**

The near-term milestone is **September Alpha**: a coherent, trustworthy, human-tested desktop build with accepted Hand/Replay, Training, Equity, Analyze/Range, materially improved First Use/Home and major visible/systemic polish; synchronized documentation; a whole-product manual pass; independent cross-model hands-on and theoretical audits; and serious findings triaged/fixed. It is an internal/high-quality alpha, not public beta readiness, production reference coverage, completed live account/sync validation, finished mobile/social/PLO, or a completed long-term capability roadmap.

Reassess only at clean checkpoints. Documenting a capability does not pull it forward.

## Accepted foundation

The following architecture is established and must not be duplicated:

- `GameRulesDefinition v1` / immutable `GameRulesSnapshot v1` own mathematical rules; new live Hands use snapshot-authoritative `PokerState v2`.
- `shared/poker-domain/` owns cards, state, actions, legality, accounting, evaluator, canonical Equity, Hold'em combos, and weighted ranges.
- Scenario remains a truthful lossy snapshot; Hand remains canonical legal history.
- `DecisionContext v1` plus additive v1.1 facts feeds one `StrategyProvider v1` → `StrategyResult v1` → `StrategyClaimPolicy v1` path.
- `reference-pack/v1` validates declarative bounded packs and can select an exact pack behind that same provider path; no production pack is currently registered.
- The current deterministic heuristic is generalized/comparative fallback, never solved-GTO, Nash, exact-EV, exploitability, or optimality authority.
- Training Practice Planner/intent/request own structural curriculum targets; the canonical Training generator owns legal trajectories and grading.
- `training-decision-record/v1` / `training-session-record/v1` own durable encountered-decision/session evidence; historical source/claim snapshots are immutable, and Full Hand decisions share one session replay authority.
- `AnalysisExplanation v1`, `RangeAnalysisFacts v1`, and `BluffAnalysisFacts v1` consume trusted facts without becoming poker, Equity, range, or strategy authorities.
- `table-presentation/v1` and `hand-review/v1` are ephemeral projections; `experience-event/v1`, `riverline-audio/v1`, and `riverline-motion/v1` create presentation consequences only.
- `SavedStudyObject v1`, Personal Strategy evidence, account/sync, and Home Game each retain their separate application/persistence authorities.

Do not revive browser/Electron ONNX inference, remote strategy APIs, arbitrary solver-tree upload, duplicate Equity, synthetic legacy Training, or a second poker/range/Saved authority.

## Current checkpoint and resume map

### Visible product and table

Completed/checkpointed work includes adaptive Table Presence, canonical Replay, shared Full Hand Review, accepted audio/motion architecture, `UX-REGRESSION-001`, `WELCOME-INTRO-001`, the accepted-with-debt `WORKSPACE-COMPOSITION-002` simplification, and `TABLE-PHYSICALITY-003` with explicit presentation debt.

`HOME-GAME-001B` is completed at an accepted implementation checkpoint with broader real Firefox/provider acceptance retained as `RET-HOMEGAME-001`; the generalized append-only session-entry correction is human accepted under the completed Core Flow checkpoint. `SETTINGS-IA-001` is also completed at an accepted implementation checkpoint; its unavailable real Firefox matrix is retained under `QA-HANDSON-010` and `RET-PREMIUM-001`. `HANDS-ON-DEFECTS-001` is an accepted bounded repair checkpoint, not whole-product visual acceptance. The Hand/Replay structural owner is completed and human accepted with minor table-physicality debt: it replaces horizontal primary chronology with a vertical street-grouped rail, keeps table and actions simultaneously available, and repairs card/seat, folded-seat, Dealer-button, and static contribution-line presentation. Its accepted product model must remain stable; named seat geometry, hidden-card physicality, full-ring Dealer-presence explainability, and History micro-polish debt remain with the Return Queue and do not reopen the architecture. Fresh-Hand lifecycle, transaction correction, continuous two-card opponent entry, and canonical min-raise/reopening behavior are completed and human accepted under `CORE-FLOW-CORRECTNESS-001`. Controls First and the ineffective user-facing Comfortable/Compact selector remain removed.

### Home Game

`HOME-GAME-001B` completes the bounded organizer-management continuation over the separate 001A exact-money domain: stable reusable players, editable ordered groups, roster reuse, completed-session archive/restore, atomic visible correction/replacement history, lifecycle revisions, and canonical account-only export. The human-accepted Core Flow checkpoint exposes that append-only reversal/correction capability at session level across eligible ledger types, retains the cash-out shortcut, makes the reason optional, and preserves reversal-only/confirmation operability without destructive editing. Stronger imbalance prominence and broader organizer physicality remain conditional bounded work under `HOME-GAME-PRESENTATION-001`. Hard delete and import stay deferred for missing safety contracts. Guest remains runtime-only.

### Settings and premium closeout

`SETTINGS-IA-001` replaced the Settings god menu with four focused categories, kept Learn Riverline as the primary global help entry, and added a secondary Guide/restart path inside Settings without creating new preference authorities. The confirmed review preserves additional Settings/content/customization debt under `GUIDE-CONTENT-001`, `GLOBAL-PRODUCT-QUALITY-001`, and `CUSTOMIZATION-UX-001`, including clearer theme creation, Daylight comfort, richer card backs, compact controls, and a manual reduced-motion override. Existing transactional theme safety and immutable built-ins remain accepted foundations, not proof that creation/discovery is finished. `PREMIUM-CLOSEOUT-001` remains the later pre-release whole-product gate and is not the sole owner of these findings.

### Strategy and references

Source authority, DecisionContext v1.1, exact preflop role semantics, research-only reference benchmarking, the bounded v4 BB-vs-BTN cold-response calibration, and the `reference-pack/v1` provider foundation are complete/checkpointed foundations. No production reference pack or validated general Hold'em production reference exists.

`REFERENCE-PACK-001` proves the strict pack/provider/claim/fallback architecture for the preferred six-max BB-versus-BTN 2.5bb intake family, but a bounded browser pass found no available browser and no production-safe corpus was otherwise supplied. The exact resume point is source acquisition and independent review; synthetic architecture fixtures must never be promoted. Training Memory can proceed because its durable evidence model can preserve the actual heuristic source/version and comparative semantics without pretending reference completion. See the [Reference Pack v1 spec](REFERENCE_PACK_V1_SPEC.md) and [Reference Strategy dossier](capabilities/REFERENCE_STRATEGY_EVOLUTION.md).

### Training

Varied, Focused, and Full Hand Training are legal, deterministic, provider-backed foundations. `TRAINING-MEMORY-001` now adds durable DecisionRecord/session evidence, indexed recent history, a transparent Review queue, reversible review lifecycle, exact historical Same Spot, and conservative planner/generator-backed current Similar Spot. Comparative heuristic disagreement remains `differs_from_reference`, never objective poker correctness; old evidence retains its exact source/version/coverage/capabilities/claim snapshot. Advanced scheduling, filters/trends, Saved/Home/Replay/Analyze continuity, Personal Strategy opt-in, sync/export, and `Not sure` remain later slices. See [Training Memory v1](TRAINING_MEMORY_V1_SPEC.md), [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md), and [Learning Evidence](capabilities/LEARNING_EVIDENCE_FOUNDATION.md).

### Personal Strategy

Calibration, deterministic inference, Matrix, Range Builder, Range Teacher, bounded RFI context transfer, and optional sync are checkpointed over one sparse immutable intended-strategy evidence authority.

The independent [`PERSONAL-STRATEGY-002R` review](PERSONAL_STRATEGY_002R_REVIEW.md) is completed and human-accepted. `PERSONAL-STRATEGY-003A` remains the preserved versioned Game setup/Approach migration plus bounded local-first first-value reset before provider integration, but it is not immediately next: activation waits for visible closure, the whole-app pass, documentation freeze, cross-model audits, and human triage. The confirmed hands-on evidence strengthens broad sparse/high-information coverage before fine boundary refinement and confirms that exactly-three/environment restrictions and standalone Teacher/Builder complexity are painful. Direct intent, inference, selected reference, source-labelled observed behavior, and opponent policy remain distinct; dominant-only evidence never becomes a fake 100% mix. Accepted durable direction lives in the [Personal Strategy dossier](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md).

### Analysis, Equity, bluff, and ranges

Canonical Equity, `RANGE-CORE-001`, `ANALYSIS-RANGE-001`, and `BLUFF-001` are current foundations. Their richer long-term directions are preserved in the [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md), [Bluff and Exploit Analysis](capabilities/BLUFF_EXPLOIT_ANALYSIS.md), and [Range Evolution](capabilities/RANGE_EVOLUTION.md) dossiers. They do not jump the current queue.

### Saved, Home, opponents, and release

Saved Hand/Spot and `HOME-002A` exist. `HOME-002B` later builds the dense Saved Study Library only over approved payloads. OpponentPolicy/bots remain high-value future work after table, Training, and reference foundations mature. Accounts/sync remain local-first and opt-in, with live Supabase/RLS and two-profile acceptance required before beta.

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
