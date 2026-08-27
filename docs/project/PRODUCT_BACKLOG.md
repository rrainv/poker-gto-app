# Riverline Product and Feature Backlog

Last consolidated: August 27, 2026 (`CORE-FLOW-CORRECTNESS-001` completed human-QA correction #1 and requires final human acceptance; Replay rail remains planned next but blocked on that acceptance, followed by Training composition and `PERSONAL-STRATEGY-003A` before a whole-app mini-pass).

This is the concise accepted capability/status registry. [Current Phase](CURRENT_PHASE.md) owns exact execution order; [Roadmap](ROADMAP.md) owns major directional sequencing; [capability dossiers](capabilities/README.md) own detailed long-term intent and recovered microfeatures; specs/code own current contracts and implementation truth. `QA_BACKLOG.md` owns issue-level defects and manual acceptance; `PRODUCT_RETURN_QUEUE.md` owns accepted must-return debt.

## Status vocabulary

- **COMPLETED:** accepted bounded implementation or documentation outcome.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE:** accepted foundation with an explicit resume point.
- **ACTIVE NEXT:** accepted next bounded ticket.
- **PLANNED NEXT:** ordered accepted work after the active-next ticket.
- **PLANNED LATER:** accepted and ordered behind nearer work.
- **PRESERVED FUTURE:** accepted direction without immediate commitment.
- **SHELVED FOR LATER:** deliberately paused.
- **OPEN PRODUCT DECISION:** requires a later explicit choice.
- **REJECTED / REMOVED:** do not revive without new evidence and an approved ticket.

## Product north star and permanent rules

Riverline is a local-first personal poker learning workstation connecting full-hand play, Review/Replay, selected-reference comparison, Personal Strategy, Saved continuity, targeted re-drill, and recurring-pattern learning.

Reference strategy, intended Personal Strategy, observed behavior, opponent policy, and exploit analysis remain distinct roles. UI and natural-language consumers use canonical structured facts and never invent poker math. Strategy claims require source authority, capabilities, and exact-enough coverage. Functionally correct but visibly sloppy is a product defect.

## Current delivery order

| Order | Status | Ticket / outcome |
|---:|---|---|
| checkpoint | COMPLETED | `DOCS-INTEGRITY-001`, `UX-REGRESSION-001`, `WELCOME-INTRO-001` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN DEBT | `WORKSPACE-COMPOSITION-002` |
| checkpoint | COMPLETED / ACCEPTED DOCUMENTATION ARCHITECTURE CHECKPOINT | `DOCS-CAPABILITY-DOSSIERS-001` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN PRESENTATION DEBT | `TABLE-PHYSICALITY-003` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX/PROVIDER DEBT | `HOME-GAME-001B` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT | `SETTINGS-IA-001` |
| checkpoint | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT | `TRAINING-MEMORY-001` |
| return dependency | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `REFERENCE-PACK-001` production source acquisition and acceptance |
| checkpoint | COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED | `PERSONAL-STRATEGY-002R` |
| checkpoint | COMPLETED / CONFIRMED PRODUCT EVIDENCE CAPTURED | `HANDS-ON-PRODUCT-REVIEW-001` / all 59 findings preserved and owned |
| checkpoint | COMPLETED / ACCEPTED BOUNDED REPAIR WITH EXPLICIT DEBT | `HANDS-ON-DEFECTS-001`; no whole-product, Hand-composition, or Training-composition acceptance claim |
| 1 | IMPLEMENTATION COMPLETE / FINAL HUMAN ACCEPTANCE REQUIRED | `CORE-FLOW-CORRECTNESS-001` bounded lifecycle/input correctness and canonical min-raise verification |
| 2 | PLANNED NEXT / BLOCKED ON CORE FLOW HUMAN ACCEPTANCE | `REPLAY-RAIL-NAV-001` vertical street-grouped rail and coherent Hand/table action integration |
| 3 | PLANNED NEXT | `TRAINING-COMPOSITION-001` stable practice workspace and one primary start action |
| 4 | PLANNED NEXT | `PERSONAL-STRATEGY-003A` first-value product-model reset |
| checkpoint | HUMAN WHOLE-APP MINI-PASS | short freeform pass after the four visible tickets |
| likely next | EXACT ORDER REASSESS AT MINI-PASS | `EQUITY-COMPOSITION-001`, `ANALYZE-RANGE-UX-001`, `GAME-SETUP-EVOLUTION-001` |
| later | PLANNED LATER | Personal Strategy provider/reference/observed integration and other named owners below |
| later gate | PLANNED LATER / PRE-RELEASE QUALITY GATE | `PREMIUM-CLOSEOUT-001` |
| future | PRESERVED FUTURE | release/mobile/social/PLO later |

Documented Equity, bluff, opponent, natural-language, Home Game, sharing, and randomization depth remains in its existing status; the dossier migration does not pull it forward.

## Confirmed August 2026 product-review owners

Detailed evidence and row-level traceability remain in [Hands-On Product Review — August 2026](HANDS_ON_PRODUCT_REVIEW_2026_08.md). This registry records only accepted owners and status.

| Ticket / owner | Status | Concise accepted outcome |
|---|---|---|
| `HANDS-ON-DEFECTS-001` | COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT | Accept Welcome title focus/Escape, clearer Home Game completion state, Return to live, auth feedback, card-removal parity, Analyze clipping, Personal Strategy vocabulary, and Replay geometry. Repeated Welcome selection, warning prominence, and card/seat visual failures remain with structural owners; no third correction cycle. |
| `CORE-FLOW-CORRECTNESS-001` | IMPLEMENTATION COMPLETE / FINAL HUMAN ACCEPTANCE REQUIRED | Review and `Start new hand` are the two primary terminal actions while lifecycle/new identity remains unchanged; `Correct entries` surfaces every eligible buy-in, rebuy, add-on, and cash-out with optional reason and append-only replacement or reversal-only atomicity; nested picker Escape preserves the expanded known-opponent workflow, first card, and focus; canonical minimum-raise and short-all-in reopening rules remain verified correct without poker-math changes. Focused Node and Firefox 154 EN/RU/HE/RTL evidence pass; final human acceptance remains open. No Hand/rail/table redesign. |
| `FIRST-USE-HOME-001` | PLANNED LATER / NAMED STRUCTURAL OWNER | Recurring launch/home model, onboarding separation, sidebar/active-workspace semantics, first-launch versus returning-launch behavior, and useful Guest Home density; owns the still-selected Hand appearance on Welcome. |
| `REPLAY-RAIL-NAV-001` | PLANNED NEXT / BLOCKED ON CORE FLOW HUMAN ACCEPTANCE | Vertical street-grouped chronology, first-class rail actions including Current Legal Actions, compact Hand Stage, coherent card/seat/player ownership, folded-seat readability, physical Dealer treatment, contribution-line clarity, table/history/action integration, and timeline typography. |
| `TRAINING-COMPOSITION-001` | PLANNED NEXT | One primary start CTA, stable pre/post skeleton, top packing, Action History, Assistance, Memory, setup/status, and progressive explanation depth. |
| `EQUITY-COMPOSITION-001` | LIKELY NEXT / REASSESS AT MINI-PASS | Bounded player tiles, optional names, central Board/Dead/Method, and dominant results. |
| `GUIDE-CONTENT-001` | PLANNED LATER / REASSESS AT CHECKPOINT | Current interactive/visual Guide and concise human content design across explanatory surfaces. |
| `GAME-SETUP-EVOLUTION-001` | LIKELY NEXT / REASSESS AT MINI-PASS | Reusable configurable game setups/presets and physical seat/button/Dealer interaction. |
| `HOME-GAME-PRESENTATION-001` | PLANNED LATER / NAMED STRUCTURAL OWNER | Denser Riverline-integrated organizer, useful table/session representation, stronger proximate imbalance/toast presentation, and broader lifecycle feedback. |
| `RANDOM-SPOT-GENERATOR-001` | PRESERVED FUTURE / REASSESS AT CHECKPOINT | Shared legal Randomize/Lock capability with card-removal truth and later reproduction. |
| `ANALYZE-RANGE-UX-001` | LIKELY NEXT / REASSESS AT MINI-PASS | Local Matrix inspection, clearer comparison, card-removal presentation, legend, and progressive decision facts. |
| `PERSONAL-STRATEGY-TEACHING-001` | PRESERVED FUTURE / REASSESS AT CHECKPOINT | Evidence-grounded concepts/reference/reasoning that genuinely teach; not a claim about the current Teacher. |
| `SAVED-VISUAL-KNOWLEDGE-001` | PRESERVED FUTURE / REASSESS AT CHECKPOINT | Observer-safe payload-owned visual previews for Saved Spots and later approved objects. |
| `GLOBAL-PRODUCT-QUALITY-001` | PLANNED LATER / ACCEPTED QUALITY DEBT | Spacing, sizing, typography/casing, iconography, account hierarchy, intro/logo, non-poker audio, Royal Flush presentation. |
| `CUSTOMIZATION-UX-001` | PLANNED LATER / ACCEPTED CUSTOMIZATION DEBT | Card backs, custom-theme creation, Daylight comfort, compact controls, and manual reduced-motion override. |

## 1. Strategy / Reference

| Capability | Status | Accepted scope |
|---|---|---|
| source authority, DecisionContext, fallback repair, role semantics, benchmark, and bounded calibration | COMPLETED FOUNDATION | One `DecisionContext → StrategyProvider → StrategyResult → StrategyClaimPolicy` path; current v4 remains generalized/comparative and narrowly calibrated. |
| `REFERENCE-PACK-001` bounded reference pack/provider | CHECKPOINTED / INTENTIONALLY INCOMPLETE | `reference-pack/v1`, exact rules/history/stack/legality matcher, deterministic validation/integrity, provider adapter, unchanged labelled fallback, and generic Playbook/Training/Matrix/Analyze/Review consumption are implemented with synthetic test-only data. No production corpus is registered; resume with exact immutable source data, compatible license/redistribution, reproducible or strong provenance, and independent validation evidence. See [Reference Pack v1](REFERENCE_PACK_V1_SPEC.md) and [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |
| broader preflop/postflop reference and evidence-driven fallback calibration | PRESERVED FUTURE | Expand only through measurable validation; exact coverage never extrapolates. See [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |
| trustworthy datasets and learned/model providers | PRESERVED FUTURE / dependency-gated | Only after validated anchors demonstrate value; never train on heuristic labels and market the result as GTO. See [Reference Strategy Evolution](capabilities/REFERENCE_STRATEGY_EVOLUTION.md). |

Known limitations remain explicit: no production reference pack or validated general reference, coarse postflop opponent ranges, no trustworthy general sizing strategy, no solved multiway equilibrium, and narrow v4 calibration.

## 2. Full Hand / Replay / Review

| Capability | Status | Accepted scope |
|---|---|---|
| canonical Hand, Table Presence, Replay, and shared Full Hand Review | COMPLETED FOUNDATION | Legal Hand history, deterministic read-only Replay, `table-presentation/v1`, `hand-review/v1`, Hero decisions, pre-action frames, source-gated comparison, provenance, Analyze/Save/Repeat/Next continuity. |
| deeper evidence-rich Hand Review | PRESERVED FUTURE / dependency-gated | Street-by-street Equity/hand/range/reference/Personal/observed/opponent evidence and supported synthesis without another history or grader. Chronology/navigation orientation remains an explicit Riverline product-fit question, not a permanently accepted horizontal pattern. See [Deep Hand Review](capabilities/DEEP_HAND_REVIEW.md). |

Independent visual/interaction acceptance remains in QA and the Return Queue; implementation checkpoints are not visual sign-off.

## 3. Audio / Motion

| Capability | Status | Accepted scope |
|---|---|---|
| `AUDIO-MOTION-001` | COMPLETED / ACCEPTED CHECKPOINT | One semantic event boundary, independent audio/motion policies, physical poker-world foley, restrained Study/UI feedback, origin suppression, reduced motion, and sound-off behavior. |
| subjective audio polish | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Study/UI, optional Check refinement, fatigue review, and unperformed Firefox acceptance remain `RET-AUDIO-001`. |
| richer ambience | SHELVED FOR LATER | Optional and subtle only; no casino noise, reward loops, or engagement manipulation. |

## 4. Training

| Capability | Status | Accepted scope |
|---|---|---|
| deterministic Training and Practice Planner | COMPLETED FOUNDATION | Legal canonical generator, shared provider/grading path, Varied/Focused structural planning, Full Hand mode, reproducible seeds, and generation-only sizing families. |
| Training Memory / DecisionRecord / review and re-drill | COMPLETED / ACCEPTED V1 CHECKPOINT WITH MANUAL FIREFOX DEBT | Durable shown/answered/source/version/context/session evidence, owner-isolated IndexedDB, bounded recent history, transparent Review lifecycle, exact historical Same Spot, current planner/generator-backed Similar Spot, factual source-aware summaries, and Full Hand replay sharing are implemented. The heuristic remains comparative. See [Training Memory v1](TRAINING_MEMORY_V1_SPEC.md), [Learning Evidence Foundation](capabilities/LEARNING_EVIDENCE_FOUNDATION.md), and [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md). |
| Training Memory scheduling and cross-surface continuation | PLANNED LATER | Principled spaced/adaptive scheduling, rich filters/trends, Saved Drill payloads, Home/Replay/Analyze continuity, export/import, sync, and explicit Personal Strategy observation require later bounded tickets; `Not sure` remains open. |
| profile-aware Training evidence and opponent-policy drills | PLANNED LATER / dependency-gated | Explicit opt-in, immutable observed provenance, no overwrite of intended strategy, later explicit opponent policy. |
| study goals | PRESERVED FUTURE / mechanics open | Restrained goals derived from real history; XP/badges/levels/achievements remain rejected by default. See [Training Intelligence](capabilities/TRAINING_INTELLIGENCE.md). |

Training `Not sure` behavior remains an open product question; Calibration's existing no-evidence behavior is not inherited automatically.

## 5. Personal Strategy

| Capability | Status | Accepted scope |
|---|---|---|
| Foundation / Calibration / inference / Matrix / Builder / Teacher | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Three user-named modes per profile, sparse immutable intended evidence, dominant-only ≠ pure, contradictions, categorical uncertainty, adaptive questions, and one shared evidence authority. |
| `PERSONAL-STRATEGY-002R` | COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED | The [independent review and human disposition](PERSONAL_STRATEGY_002R_REVIEW.md) preserve the intended-evidence authority and accept the Game setup/Approach, local-first, RFI-first, first-value product reset before integration. Browser/real-user acceptance remains routed debt. |
| `PERSONAL-STRATEGY-003A` | PLANNED NEXT / AFTER CORE FLOW, REPLAY, AND TRAINING COMPOSITION | Own the versioned legacy migration and deliver one Game setup, one initial Approach, approximately five supported RFI questions, broad sparse/high-information coverage before fine boundary refinement, What Riverline understands, Teach Riverline Next, and secondary Strategy Matrix/Matrix Edit. No provider/reference/observed integration. |
| provider/reference/observed integration | PLANNED LATER / AFTER 003A AND HUMAN CHECKPOINT | Keep intended Personal Strategy, selected reference, source-labelled observed behavior, and opponent policy explicit; Training comparison/adoption is opt-in and Training Memory remains the observed authority. |
| `PERSONAL-INSIGHTS-001` | PLANNED LATER after integration | Cross-profile Teach Riverline Next queue and evidence/provenance/uncertainty-aware summaries. See [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md). |
| bounded versioning and later postflop/combo depth | ACCEPTED DIRECTION / LATER SLICES | Duplicate Approach, immutable material Game setup versions, and restore-through-new-correction/version are accepted; branches, arbitrary rollback, and Git-like management are deferred. Postflop remains exact-fact future work. See [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md). |

## 6. Analysis / Matrix / Ranges / Equity

| Capability | Status | Accepted scope |
|---|---|---|
| canonical Equity | COMPLETED | One exact/seeded Monte Carlo 2–10-player service with win/tie/share accounting; no weighted-opponent request yet. |
| `RANGE-CORE-001` | COMPLETED | 52 cards → 1,326 combos → `HoldemWeightedRange v1` → blocker/normalization/Matrix projections; unknown ≠ zero. |
| `ANALYSIS-RANGE-001` and `BLUFF-001` | CHECKPOINTED | Structural exact-hand/draw/board/blocker/range and bounded bluff economics/removal facts; no invented ranges, response, EV, advantage, or verdict. |
| `EQUITY-HAND-ANALYSIS-001` | PLANNED LATER / dependency-gated | Structured hand/runout/nut/blocker/standing intelligence and shared card-outcome preview. See [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md). |
| `BLUFF-ANALYSIS-002` | PLANNED LATER / dependency-gated | Range-aware value/bluff/bluff-catcher/candidate-quality and explicit exploit analysis. See [Bluff and Exploit Analysis](capabilities/BLUFF_EXPLOIT_ANALYSIS.md). |
| `RANGE-EVOLUTION-001` | PLANNED LATER | Canonical combo-level action-conditioned preflop-to-river propagation with distinct reference/Personal/opponent roles. See [Range Evolution](capabilities/RANGE_EVOLUTION.md). |
| weighted range-vs-range / range and nut distribution | PRESERVED FUTURE / dependency-gated | Requires approved Equity/Analysis boundaries, explicit weighted ranges, provenance, and unknown-preserving semantics. See [Range Evolution](capabilities/RANGE_EVOLUTION.md). |
| `RANDOM-SPOT-GENERATOR-001` | PRESERVED FUTURE | Legal lock-aware randomized study-state utility for supported consumers. See [Random Spot Generator](capabilities/RANDOM_SPOT_GENERATOR.md). |

## 7. Saved / Home

| Capability | Status | Accepted scope |
|---|---|---|
| Saved Hand / Spot | COMPLETED | Versioned local-first objects, shared title/note/tags/review/mistake metadata, archive, observer-safe canonical Replay, and portability foundations. |
| `HOME-002A` My Riverline | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest/account-aware Continue and bounded Saved/Recent/Review/Mistakes/Personal Strategy previews; human acceptance remains open. |
| `HOME-002B` Saved Study Library | PLANNED LATER | Dense master-detail Hands/Spots first, then approved Range/Drill/Review/Session payloads with search/filter/tags and explicit Open/Study. See [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md). |
| user-visible export/import, version history, share/fork/collaborate | PRESERVED FUTURE / dependency-gated | Private by default; share actual versioned state/provenance, with read-only-first acceptable. See [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md). |

Home remains a consumer and must not invent accuracy, mastery, streaks, or history.

## 8. Accounts / Sync / Social

| Capability | Status | Accepted scope |
|---|---|---|
| identity/auth plus Saved and Personal Strategy sync | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest-first local identity, Supabase email/password/profile, explicit opt-in local-first sync, outbox/retry/tombstones/conflicts; live migrations/RLS and lifecycle acceptance remain. |
| username/password adapter | OPEN PRODUCT DECISION | Trusted rate-limited server/Edge Function only if still required; never client-side username-to-email lookup. |
| recovery/deletion/local forgetting and cross-device preferences | PRESERVED FUTURE | Explicit privacy/lifecycle work after core sync stability. |
| social identity and study sharing | PRESERVED FUTURE / dependency-gated | After privacy/versioning maturity; sharing semantics live in [Saved Knowledge and Sharing](capabilities/SAVED_KNOWLEDGE_AND_SHARING.md). |

Authentication never silently enables upload; Riverline remains useful offline.

## 9. Home Game Organizer

| Capability | Status | Accepted scope |
|---|---|---|
| `HOME-GAME-001A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Separate players/groups/sessions, exact integer money, append-only corrections, chips separate from money, lifecycle/reopen, balance rejection, deterministic settlement, account IndexedDB/Guest memory. |
| Create Game routing blocker | COMPLETED | Creation stays in Home Game and opens the intended active session. |
| `HOME-GAME-001B` | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX/PROVIDER DEBT | Stable reusable player edit/archive/restore; ordered group management and roster reuse; session archive/restore and lifecycle inspection; atomic visible correction/replacement history; account-only canonical export. Hard delete/import are deliberately deferred for missing safety contracts. |
| settlement/history/Hand-link/mobile evolution | PRESERVED FUTURE / decisions open | Fewest Transfers vs Banker/preferred banker, payment tracking, recurring games, stable Hand linkage, reconciliation, and later sharing. See [Home Game Evolution](capabilities/HOME_GAME_EVOLUTION.md). |

The current settlement algorithm is deterministic; it is not a selected Fewest Transfers or Banker product preference.

## 10. Product Experience / Settings / Themes / Layout / Cards

| Capability | Status | Accepted scope |
|---|---|---|
| `UX-REGRESSION-001` and `WELCOME-INTRO-001` | COMPLETED | Repaired owned functional/semantic/legibility regressions and established versioned first-use orientation with human acceptance. |
| `WORKSPACE-COMPOSITION-002` | COMPLETED / ACCEPTED CHECKPOINT WITH KNOWN DEBT | Stronger state-aware composition; Controls First and ineffective density selector removed; only useful specialized presets survive; debt remains `RET-COMPOSITION-002`. |
| `DOCS-CAPABILITY-DOSSIERS-001` | COMPLETED / ACCEPTED DOCUMENTATION ARCHITECTURE CHECKPOINT | Durable dossier layer, Legacy ID Index, Interaction Grammar, recovered intent, anti-loop governance, and concise live planning; no runtime feature work. |
| `TABLE-PHYSICALITY-003` | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH KNOWN PRESENTATION DEBT | Human acceptance passed table scale, HU/normal Hand composition, felt/rail coherence, Hero-card readability, and contribution-to-pot presentation as sufficient to move on. Revealed-opponent card inspectability remains `RET-CARDS-THEMES-001` debt; no perfect-polish claim is made. |
| `SETTINGS-IA-001` | COMPLETED / ACCEPTED IMPLEMENTATION CHECKPOINT WITH MANUAL FIREFOX DEBT | Replaced the god menu with Appearance, Audio & Motion, Language & Help, and Account & Data categories; retained one authority per existing preference, demoted previews to actions, exposed truthful OS motion status, and kept Learn Riverline primary. Automated coverage is complete; live Firefox acceptance remains routed debt. |
| `HANDS-ON-PRODUCT-REVIEW-001` | COMPLETED / CONFIRMED PRODUCT EVIDENCE CAPTURED | An independent outside-user review originated 59 findings; the product owner manually reproduced all 59; detailed evidence and ownership live in the review artifact. No finding is closed. |
| `HANDS-ON-DEFECTS-001` | COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT DEBT | Successful bounded repairs are preserved; repeated structural failures and newly discovered functional defects remain explicitly routed rather than cosmetically patched again. |
| `PREMIUM-CLOSEOUT-001` | PLANNED LATER / PRE-RELEASE QUALITY GATE | Whole-product manual QA, final high-value visual-debt burn, Guide finalization, responsive desktop matrix, EN/RU/HE/RTL, accessibility, cards/table/replay/Settings polish, theme consistency, applicable Return Queue debt, and release-quality Core Flow acceptance after the feature set is materially more mature. |
| evidence-grounded natural-language intelligence | PRESERVED FUTURE / first concrete slice `PERSONAL-INSIGHTS-001` | Facts / Explain / Coach depth over approved structured evidence, with facts-only use always available. See [Natural-Language Intelligence](capabilities/NATURAL_LANGUAGE_INTELLIGENCE.md). |
| shared interaction integrity | COMPLETED | Accepted product rule: one semantic owner and interaction language across applicable surfaces; see [Interaction Grammar](INTERACTION_GRAMMAR.md). |
| restrained felt/table/chip customization | OPEN PRODUCT DECISION | Default quality first; customization cannot compensate for a bad default. |
| arbitrary layout editor, Controls First, ineffective density choice | REJECTED / REMOVED | Do not revive without materially new evidence. Global Beginner/Expert mode is superseded by strong defaults plus local Facts/Explain/Coach depth. |

## 11. Opponent Policies / Bots

| Capability | Status | Accepted scope |
|---|---|---|
| `OPPONENT-POLICY-ARCH-001` and opponent intelligence | PRESERVED FUTURE / high strategic value | Context-conditioned observations and versioned population/generic/real/custom policies separate from reference, exploit, Personal Strategy, and claims about people. See [Opponent Intelligence](capabilities/OPPONENT_INTELLIGENCE.md). |
| full-hand bot Training | PRESERVED FUTURE / dependency-gated | Legal complete hands, post-hand review, Save/re-drill continuity, and explicit policy assumptions after table/Training/reference maturity. |

## 12. Platform / Release / Mobile

| Capability | Status | Accepted scope |
|---|---|---|
| browser runtime / thin Electron / CI | COMPLETED FOUNDATION | Same dependency-free browser application in Electron; Node 24 syntax/full-suite CI. |
| targeted architecture decomposition | PRESERVED MAINTENANCE | Extract stable seams only when real tickets touch them; no rewrite program. |
| live Supabase verification | PLANNED LATER / release gate | Migrations, RLS, idempotency, conflicts, and multi-profile Firefox lifecycle. |
| packaging/hosting/offline/privacy/legal/observability | PRESERVED FUTURE | Before public release as applicable. |
| deliberate mobile | PRESERVED FUTURE | A distinct composition, not compressed/stacked desktop. |
| telemetry and public release/monetization | OPEN PRODUCT DECISION | Privacy-first and no implied commitment. |

## 13. PLO / Other Game Domains

| Branch | Status | Accepted path |
|---|---|---|
| PLO | PRESERVED FUTURE | Separate four-card domain, exactly-two-hole evaluation, dedicated ranges/Equity/Training/reference/UI; never a Hold'em toggle. |
| tournament/ICM depth | PRESERVED FUTURE | Explicit tournament assumptions and reference/accounting pipeline. |
| other variants | OPEN PRODUCT DECISION | No generic framework until a real need exists. |

## 14. Open Product Decisions

- whether the preferred exact BB-versus-BTN family can acquire a production-safe source or must yield to a better licensed/reproducible bounded family;
- Training `Not sure` behavior, Training-evidence opt-in placement/default, and future default comparison source;
- first OpponentPolicy archetypes and custom-policy UX;
- Saved folders/collections and sharing/forking permissions, read-only-first scope, comments, friends, study groups, and shared drills;
- Home Game Fewest Transfers vs Banker/preferred banker settlement preference and later payment workflow;
- whether username login is required before release;
- restrained table/felt/chip customization only after default quality is strong;
- card-outcome preview touch/click semantics;
- study goals/streaks based on real activity; mastery waits for valid history; XP/badges/levels/achievements remain rejected by default;
- mobile timing, public release/monetization, PLO priority, and telemetry.

## Pull-forward rule

A preserved item moves earlier only through explicit reprioritization and a bounded owner. Touching a related file or documenting an idea does not authorize implementation. Priority changes update Current Phase, Roadmap, and the affected row here together.
