# Current Riverline phase

Last refreshed: August 26, 2026 (`SETTINGS-IA-001` completed as an accepted implementation checkpoint with explicit manual Firefox debt; the first trusted bounded reference pack/provider is active next; `PREMIUM-CLOSEOUT-001` is deferred to the pre-release quality gate).

This document answers **what Riverline is doing now and what follows it**. `ROADMAP.md` explains major sequencing, `PRODUCT_BACKLOG.md` owns concise capability/status, capability dossiers preserve detailed long-term intent, and subsystem specs/code own current contracts and implementation truth. QA and accepted checkpoint debt remain in `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md`.

## Status vocabulary

- **COMPLETED:** accepted bounded outcome; later changes require a new ticket.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE:** useful foundation accepted with a named resume point.
- **ACTIVE NEXT:** accepted next bounded ticket, started in its own chat.
- **PLANNED NEXT:** ordered work after the active-next ticket.
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

5. **ACTIVE NEXT — first trusted bounded reference pack/provider**
   - establish defensible strategy truth for one narrow covered family with exact rules/rake, stacks, sizing tree, source/version/licensing/provenance, validation, capabilities, coverage matching, and unsupported fallback;
   - validate the source/provider architecture and give Training and Review a stronger comparison target before richer learning and explanation work.

6. **PLANNED NEXT — Training Memory / re-drill intelligence**

7. **PLANNED NEXT — `PERSONAL-STRATEGY-002R` independent review**

8. **PLANNED NEXT — Personal Strategy provider/reference/observed integration**

9. **NEXT INTELLIGENCE / PRODUCT WAVE — exact order reassessed at a clean checkpoint**
   - accepted candidates include `PERSONAL-INSIGHTS-001`, `EQUITY-HAND-ANALYSIS-001A`, `RANGE-EVOLUTION-001`, deeper Bluff/Exploit analysis, later Opponent Intelligence / OpponentPolicy, and `HOME-002B`;
   - capability documentation does not activate any candidate or pre-commit their order.

10. **PLANNED LATER / PRE-RELEASE QUALITY GATE — `PREMIUM-CLOSEOUT-001`**

11. **PRESERVED FUTURE — release, deliberate mobile, social, and PLO branches later**

Reassess only at clean checkpoints. Documenting a capability does not pull it forward.

## Accepted foundation

The following architecture is established and must not be duplicated:

- `GameRulesDefinition v1` / immutable `GameRulesSnapshot v1` own mathematical rules; new live Hands use snapshot-authoritative `PokerState v2`.
- `shared/poker-domain/` owns cards, state, actions, legality, accounting, evaluator, canonical Equity, Hold'em combos, and weighted ranges.
- Scenario remains a truthful lossy snapshot; Hand remains canonical legal history.
- `DecisionContext v1` plus additive v1.1 facts feeds one `StrategyProvider v1` → `StrategyResult v1` → `StrategyClaimPolicy v1` path.
- The current deterministic heuristic is generalized/comparative fallback, never solved-GTO, Nash, exact-EV, exploitability, or optimality authority.
- Training Practice Planner/intent/request own structural curriculum targets; the canonical Training generator owns legal trajectories and grading.
- `AnalysisExplanation v1`, `RangeAnalysisFacts v1`, and `BluffAnalysisFacts v1` consume trusted facts without becoming poker, Equity, range, or strategy authorities.
- `table-presentation/v1` and `hand-review/v1` are ephemeral projections; `experience-event/v1`, `riverline-audio/v1`, and `riverline-motion/v1` create presentation consequences only.
- `SavedStudyObject v1`, Personal Strategy evidence, account/sync, and Home Game each retain their separate application/persistence authorities.

Do not revive browser/Electron ONNX inference, remote strategy APIs, arbitrary solver-tree upload, duplicate Equity, synthetic legacy Training, or a second poker/range/Saved authority.

## Current checkpoint and resume map

### Visible product and table

Completed/checkpointed work includes adaptive Table Presence, canonical Replay, shared Full Hand Review, accepted audio/motion architecture, `UX-REGRESSION-001`, `WELCOME-INTRO-001`, the accepted-with-debt `WORKSPACE-COMPOSITION-002` simplification, and `TABLE-PHYSICALITY-003` with explicit presentation debt.

`HOME-GAME-001B` is completed at an accepted implementation checkpoint with its unavailable real Firefox/provider acceptance retained as `RET-HOMEGAME-001`. `SETTINGS-IA-001` is also completed at an accepted implementation checkpoint; its unavailable real Firefox matrix is retained under `QA-HANDSON-010` and `RET-PREMIUM-001`. No known visual issue currently blocks substantive reference or learning work. Revealed-opponent card inspectability remains `RET-CARDS-THEMES-001` debt, while the horizontal-versus-vertical Review chronology comparison remains `RET-REVIEW-NAV-001` debt. Full Hand Firefox acceptance, surviving composition verification, and broader premium QA remain separately owned by the QA Backlog and Return Queue. Controls First and the ineffective user-facing Comfortable/Compact selector remain removed.

### Home Game

`HOME-GAME-001B` completes the bounded organizer-management continuation over the separate 001A exact-money domain: stable reusable players, editable ordered groups, roster reuse, completed-session archive/restore, atomic visible correction/replacement history, lifecycle revisions, and canonical account-only export. Hard delete and import are explicitly deferred for missing safety contracts. Guest remains runtime-only. Long-term settlement and optional Hand-link intent remain preserved in the [Home Game dossier](capabilities/HOME_GAME_EVOLUTION.md), not sequenced here. Real Firefox and authenticated provider-path acceptance remain routed through the QA Backlog/Return Queue rather than reopening implementation scope.

### Settings and premium closeout

`SETTINGS-IA-001` replaced the Settings god menu with four focused categories, kept Learn Riverline as the primary global help entry, and added a secondary Guide/restart path inside Settings without creating new preference authorities. `PREMIUM-CLOSEOUT-001` remains the later pre-release whole-product manual QA, high-value visual-debt burn, Guide finalization, desktop matrix, themes/cards/table/replay/Settings polish, EN/RU/HE/RTL, accessibility, and release-quality Core Flow gate. It is intentionally deferred until upcoming substantive features have matured the affected surfaces. Existing transactional custom-theme editing and immutable built-ins remain accepted.

### Strategy and references

Source authority, DecisionContext v1.1, exact preflop role semantics, research-only reference benchmarking, and the bounded v4 BB-vs-BTN cold-response calibration are complete foundations. No validated general Hold'em production reference exists.

The first trusted bounded provider is active next because Riverline's visible shell is currently ahead of the trustworthiness and coverage of its strategy reference. It must define exact rules/rake, stacks, sizing tree, source/version/licensing/provenance, validation, declared capabilities, coverage matching, and unsupported fallback, giving Training and Review a defensible narrow comparison target and grounding later natural-language analysis. See the [Reference Strategy dossier](capabilities/REFERENCE_STRATEGY_EVOLUTION.md).

### Training

Varied, Focused, and Full Hand Training are legal, deterministic, provider-backed foundations. The next intelligence program adds durable DecisionRecord/session history, review/mistake queues, same/similar re-drill, spaced/adaptive review, filters/saved drills, truthful trends, and Home/Replay continuity. Comparative heuristic disagreement is not objective poker correctness. See the [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md) and [Learning Evidence](capabilities/LEARNING_EVIDENCE_FOUNDATION.md) dossiers.

### Personal Strategy

Calibration, deterministic inference, Matrix, Range Builder, Range Teacher, bounded RFI context transfer, and optional sync are checkpointed over one sparse immutable intended-strategy evidence authority.

Resume at independent `PERSONAL-STRATEGY-002R`, then provider/reference/observed integration, then `PERSONAL-INSIGHTS-001`. Direct intent, inference, reference, and observed behavior remain distinct; dominant-only evidence never becomes a fake 100% mix. See the [Personal Strategy dossier](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md).

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

## Update rule

After an accepted ticket, update this file when the active ticket, exact order, or subsystem resume point changes. Sequence changes move with `ROADMAP.md` and the affected `PRODUCT_BACKLOG.md` record. Capability dossiers preserve long-term intent; specs/code preserve current contracts/truth; QA and Return Queue preserve unresolved acceptance and debt. Do not create another status summary.
