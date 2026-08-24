# Riverline Product and Feature Backlog

Last consolidated: August 24, 2026 (`DOCS-INTEGRITY-001`; `AUDIO-MOTION-001` accepted checkpoint).

This is the one accepted capability/status record for each product domain. `CURRENT_PHASE.md` owns exact execution order; subsystem specifications own implementation semantics; `QA_BACKLOG.md` owns issue-level defects; `PRODUCT_RETURN_QUEUE.md` owns compact must-return debt.

## Status vocabulary

- **COMPLETED** — accepted bounded implementation.
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE** — accepted foundation with explicit remaining work.
- **ACTIVE** — current bounded ticket.
- **PLANNED NEXT** — ordered accepted work.
- **PLANNED LATER** — accepted and ordered behind nearer work.
- **PRESERVED FUTURE** — accepted capability without immediate commitment.
- **SHELVED FOR LATER** — deliberately paused.
- **OPEN PRODUCT DECISION** — requires a later choice.
- **REJECTED / REMOVED** — do not revive without new evidence and an approved ticket.

## Product north star and permanent rules

Riverline is a local-first personal poker learning workstation connecting full-hand play, Review/Replay, selected-reference comparison, Personal Strategy, Saved continuity, targeted re-drill, and recurring-pattern learning.

Reference strategy, intended Personal Strategy, observed behavior, and opponent policy remain distinct semantic roles. UI consumes canonical facts and never invents poker math. Strategy claims require source authority/capabilities and exact-enough coverage. Substantial product/strategy work uses the Competitive Reference Gate. Functionally correct but visibly sloppy is a product defect.

## Current delivery order

`AUDIO-MOTION-001` is completed and accepted. `DOCS-INTEGRITY-001` is active. After this ticket:

| Order | Status | Ticket / outcome |
|---:|---|---|
| 1 | PLANNED NEXT | `UX-REGRESSION-001` |
| 2 | PLANNED NEXT | `WELCOME-INTRO-001` |
| 3 | PLANNED NEXT | `WORKSPACE-COMPOSITION-002` |
| 4 | PLANNED NEXT | `TABLE-PHYSICALITY-003` |
| 5 | PLANNED NEXT | `HOME-GAME-001B` |
| 6 | PLANNED NEXT | `SETTINGS-IA-001` |
| 7 | PLANNED NEXT | `PREMIUM-CLOSEOUT-001` |
| 8 | PLANNED NEXT | first trusted bounded reference pack/provider |
| 9 | PLANNED NEXT | Training Memory / re-drill |
| 10 | PLANNED NEXT | `PERSONAL-STRATEGY-002R` |
| 11 | PLANNED NEXT | Personal Strategy provider/reference/observed integration |
| 12 | PLANNED LATER | `PERSONAL-INSIGHTS-001` |
| 13 | PLANNED LATER | `RANGE-EVOLUTION-001` |
| 14 | PLANNED LATER | `HOME-002B` Saved Study Library |
| 15 | PRESERVED FUTURE | OpponentPolicy / bots |
| 16 | PRESERVED FUTURE | release/mobile/social/PLO later |

The order is directional and may move after later accepted checkpoints. Reprioritization updates `CURRENT_PHASE.md`, `ROADMAP.md`, and affected backlog entries together.

## 1. Strategy / Reference

| Capability | Status | Accepted scope |
|---|---|---|
| `REFERENCE-AUTHORITY-001` | COMPLETED | Source identity, provenance, authority, coverage, capabilities, and one `StrategyClaimPolicy` are separate; heuristic cannot authorize GTO/exact frequency/EV loss/objective correctness. |
| `STRATEGY-REPAIR-001A/001B` | COMPLETED | Table-family structure, causal sampling, missing-price honesty, live pot/stack/SPR/position/history use, legality, and separated response families without authority upgrade. |
| `DECISION-CONTEXT-001A` | COMPLETED | Additive v1.1 current pot, live/effective stacks, position relation, legal bounds, bounded history, and derivation quality. |
| `REFERENCE-BENCH-001` | COMPLETED | Source-agnostic private/manual/public/licensed/solver observation and comparison harness; no production dependency. |
| `PREFLOP-ROLE-001` | COMPLETED | Exact preflop decision-role taxonomy stays distinct from fallback calibration. |
| `PREFLOP-CALIBRATION-001` | COMPLETED | Bounded six-max BB-vs-BTN cold-response structural policy; v4 remains generalized comparative. |
| first trusted bounded reference pack/provider | PLANNED NEXT after visible closeout | Exact assumptions, sizing/rake/rules, versioning, validation, licensing/provenance, declared capabilities, exact coverage, fallback elsewhere. |
| broader preflop reference expansion | PRESERVED FUTURE | Expand only with measurable validation across roles/stacks/sizes/rules. |
| postflop reference quality | PRESERVED FUTURE | Board/range/action/SPR/position families after preflop provider path proves itself. |
| learned model/interpolation | PRESERVED FUTURE | Only after trustworthy data demonstrates measurable value; never train on heuristic labels and call it GTO. |
| benchmark UI | PRESERVED FUTURE | Research-only if CLI becomes a bottleneck. |

Known limitations remain explicit: no validated general reference, coarse postflop opponent ranges, no trustworthy general sizing strategy, no solved multiway equilibrium, and narrow v4 calibration.

## 2. Full Hand / Replay / Review

| Capability | Status | Accepted scope |
|---|---|---|
| canonical Hand/Table Presence/Replay foundation | COMPLETED | Legal Hand state, action/chance timeline, deterministic read-only projection/playback/direct seek, exact contributions/pot transitions, reduced-motion-safe presentation. |
| `TABLE-PRESENCE-REF-001` | COMPLETED | Accepted GTO Wizard-primary competitive reference and ADOPT/ADAPT/DIFFERENTIATE/REJECT decisions. |
| `TABLE-PRESENCE-002` | COMPLETED | Ephemeral `table-presentation/v1`, deliberate 2–10 geometry, hierarchy, legal dock/sizing, live/completed/review/analyze projections. |
| `FULL-HAND-REVIEW-001` | COMPLETED | Shared `hand-review/v1`, Hero decisions, pre-action Replay frames, source-gated comparison, provenance, Analyze/Save/Repeat/Next continuity. |
| richer hand timeline markers | PRESERVED FUTURE | Reference/Personal/observed/note markers only behind proper source/Saved authority. |
| advanced dealing/chip/showdown choreography | PRESERVED FUTURE | Restrained, reduced-motion-safe, never renderer truth. |

Independent visual/interaction acceptance and current table readability defects remain in QA/Return Queue; implementation checkpoints are not visual sign-off.

## 3. Audio / Motion

| Capability | Status | Accepted scope |
|---|---|---|
| `AUDIO-MOTION-001` | COMPLETED / ACCEPTED CHECKPOINT | `experience-event/v1`, `riverline-audio/v1`, `riverline-motion/v1`, origin suppression, independent preferences, recorded physical poker-world CC0 foley, restrained Study/UI feedback, reduced motion/sound off. |
| subjective audio polish | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Study/UI, optional Check refinement, fatigue review, and unperformed Firefox acceptance remain `RET-AUDIO-001`; no perfection claim. |
| richer ambience | SHELVED FOR LATER | Optional/subtle only; no casino noise, reward loops, or engagement manipulation. |

## 4. Training

| Capability | Status | Accepted scope |
|---|---|---|
| canonical deterministic Training | COMPLETED | Legal generator, deterministic seeds/replay metadata, shared StrategyProvider, source-aware grading/presentation. |
| Training Practice Planner | COMPLETED FOUNDATION | `TrainingSessionIntent v1`, `TrainingScenarioRequest v1`, Varied/Focused target planning, coverage/recency, adapter, sizing-family diversity. Planner owns structural envelope only; canonical generator owns legal trajectory. Sizing families are generation targets, not recommendations. |
| Varied / Focused Training | COMPLETED FOUNDATION | Live modes consume the planner/generator path; Full Hand remains a separate visible table mode. |
| Training Memory / DecisionRecord | PLANNED NEXT | Durable shown/answered/source/version/context/session history with honest source semantics. |
| review queue and same/similar re-drill | PLANNED NEXT | Persistent mistakes/review, reproducible same-spot, versioned similarity, spaced/adaptive review. |
| filters, saved drills, summaries/trends | PLANNED NEXT | Derived from canonical history; comparative alignment stays distinct from objective accuracy. |
| Home/Replay integration | PLANNED NEXT | Continue/review/re-drill only after canonical history exists. |
| profile-aware Training evidence | PLANNED LATER | Explicit per-session opt-in; immutable observed provenance; never overwrites intended strategy. |
| study goals | PRESERVED FUTURE | Preserve a restrained goal-setting capability; exact goal/streak mechanics remain an open product decision and must use real study history. |

## 5. Personal Strategy

| Capability | Status | Accepted scope |
|---|---|---|
| Foundation / Calibration / deterministic inference | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Local-first sparse immutable intended-strategy evidence, three user-named modes, dominant-only ≠ pure, contradictions preserved, categorical uncertainty/provenance. |
| Matrix / Range Builder / Range Teacher | CHECKPOINTED / INTENTIONALLY INCOMPLETE | One evidence authority, derived Matrix, grouped direct edits/undo, boundary/sparse/conflict teaching; human Firefox QA remains. |
| `PERSONAL-STRATEGY-002R` | PLANNED NEXT | Independent real-user review before provider integration or more inference machinery. |
| provider/reference/observed integration | PLANNED NEXT | Intended Personal Strategy, selected reference, and observed play remain explicit roles; Training evidence is opt-in. |
| `PERSONAL-INSIGHTS-001` | PLANNED LATER after integration | Cross-profile **Teach Riverline next** queue ranks uncertainty, sparse evidence, contradictions, and strategic boundaries with transparent reasons/direct Calibration routing; evidence/provenance/uncertainty-aware natural-language StrategyProfile summaries; no fake confidence or invented personality prose. |
| profile snapshots / experiments / rollback | PRESERVED FUTURE | Duplicate/version/compare/roll back while preserving evidence history. |
| mode relationships/interpolation | PRESERVED FUTURE | Only when evidence supports a real relation; modes otherwise stay discrete. |
| combo overrides / postflop Personal Strategy | PRESERVED FUTURE | Separate versioned evidence/model work. |

`PERSONAL-INSIGHTS-001` summaries may say, for example, “This BTN mode is wider in suited Kings than Standard” or “Offsuit Broadway evidence remains sparse” only when evidence and provenance support the comparison. They must state uncertainty and never invent personality prose.

## 6. Analysis / Matrix / Ranges / Equity

| Capability | Status | Accepted scope |
|---|---|---|
| `RANGE-CORE-001` | COMPLETED | 52 cards → 1,326 combos → `HoldemWeightedRange v1` → derived Matrix; unknown ≠ zero. |
| `ANALYSIS-RANGE-001` | CHECKPOINTED | Exact made/draw/board/blocker/supplied-range facts; no invented range/nut advantage or EV. |
| `BLUFF-001` | CHECKPOINTED | Risk/reward, break-even folds, semibluff/outs, neutral removal, bounded river reference; no inferred opponent response. |
| current Matrix / Range comparison | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Provider-backed preflop Matrix and fixed comparison remain distinct; unavailable postflop and long-page QA remain. |
| canonical Equity | COMPLETED | One exact/seeded Monte Carlo multiway service; weighted-opponent range contract not yet present. |
| `RANGE-EVOLUTION-001` | PLANNED LATER | Canonical combo-level preflop range → action-conditioned flop → turn → river propagation with provenance; unknown remains unknown; reference and Personal Strategy roles stay distinct. |
| weighted range-vs-range analysis | PRESERVED FUTURE | Approved Equity/Analysis contract, distributions/advantage/value-bluff facts only where supported. |
| richer blocker/value/bluff and Compare Spots | PRESERVED FUTURE | Supported explanations across position/stack/price/board/history/ranges/profile; no fake verdicts. |
| Saved Ranges | PRESERVED FUTURE | New versioned SavedStudyObject payload, history/export/import, later sharing. |

## 7. Saved / Home

| Capability | Status | Accepted scope |
|---|---|---|
| Saved Hand / Spot | COMPLETED | Versioned local-first objects, shared annotations/tags/review/mistake metadata, archive, canonical observer-safe Replay source. |
| `HOME-002A` My Riverline | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest/account composition, Continue, Saved/Recent/Review/Mistakes, Personal Strategy facts, sync state; human acceptance open. |
| `HOME-002B` Saved Study Library | PLANNED LATER | Dense master-detail Hands/Spots first, search/filter/tags, selected inspector and explicit Open/Study; add Range/Drill/Review/Session types only as approved payloads arrive. |
| Saved Drill / Session / Review payloads | PRESERVED FUTURE | Versioned source/context/history semantics; no parallel stores. |
| revisions/history | PRESERVED FUTURE | Ownership/version/conflict semantics. |
| folders/collections | OPEN PRODUCT DECISION | Add only if real use justifies them. |
| user-visible personal-data export/import | PRESERVED FUTURE | Hands/Spots and Personal Strategy/range portability with version/provenance; never revive arbitrary solver-tree upload. |

Home is a consumer and must not invent accuracy, mastery, streaks, or history.

## 8. Accounts / Sync / Social

| Capability | Status | Accepted scope |
|---|---|---|
| local identity + account/profile auth | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Persistent opaque identity, Guest, Supabase email/password/profile, claim/start-separate, switching/sign-out; live migration/provider acceptance open. |
| Saved sync | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Opt-in local-first outbox/retry, tombstones, RLS/RPC, conflict UX; live two-profile acceptance open. |
| Personal Strategy sync | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Separate consent, relational immutable evidence/session sync, contradictions preserved; live acceptance open. |
| username/password adapter | OPEN PRODUCT DECISION | Trusted rate-limited server/Edge Function only if still required; no client-side username→email lookup. |
| recovery/deletion/local forgetting | PRESERVED FUTURE | Explicit privacy/lifecycle tickets. |
| cross-device preferences | PRESERVED FUTURE | After core sync stability. |
| sharing/forking/friends/study groups | PRESERVED FUTURE | After privacy/versioning maturity. |
| friend challenges / shared drills | PRESERVED FUTURE | Bounded study sharing without gambling/leaderboard pressure. |

Riverline remains useful offline; authentication never silently enables upload.

## 9. Home Game Organizer

| Capability | Status | Accepted scope |
|---|---|---|
| `HOME-GAME-001A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Separate players/groups/sessions, exact minor-unit ledger, append-only corrections, chip snapshots, lifecycle, balance rejection, deterministic settlement, account IndexedDB/Guest memory. |
| Create Game routing blocker | PLANNED NEXT | Immediate broken route owned by `UX-REGRESSION-001`; broader flow stays `HOME-GAME-001B`. |
| `HOME-GAME-001B` | PLANNED NEXT | Player reuse/edit/archive, visible correction history, session archive/delete, group/session management polish, import/export decision, Firefox acceptance. |
| richer organizer tools | PRESERVED FUTURE | Blind timer/button advance, richer chips, player history, recurring games, payments; tournament only with separate accounting semantics. |
| live/mobile sharing | PRESERVED FUTURE | After accounts and organizer foundations. |

## 10. Product Experience / Settings / Themes / Layout / Cards

| Capability | Status | Accepted scope |
|---|---|---|
| `UX-REGRESSION-001` | PLANNED NEXT | Immediate functional/semantic/legibility regressions enumerated in QA; no unrelated audio debt. |
| `WELCOME-INTRO-001` | PLANNED NEXT | Concise first-use product introduction and obvious Hand/Analyze/Train/Equity/Personal Strategy/Guide actions; first-use friendly, dismissible/remembered, non-nagging for experienced users, EN/RU/HE, accessible, not a recurring modal or giant splash. Separate from workspace tutorials. |
| `WORKSPACE-COMPOSITION-002` | PLANNED NEXT | Whole-workspace hierarchy, dead space, presets, density, Training facts, Equity, table balance; may redesign/rename/consolidate/remove weak presets. |
| `TABLE-PHYSICALITY-003` | PLANNED NEXT | Better felt/table proportions, rail/depth, seat/card integration, chip stacks, contributions, central pot, restrained physical motion, and table readability over existing authorities. Reject casino scene, spectacle, confetti, fake 3D, and avatars by default. |
| `SETTINGS-IA-001` | PLANNED NEXT | Split Settings god-menu concerns, improve help/tutorial discovery, and make theme editing transactional with immutable built-ins. |
| `PREMIUM-CLOSEOUT-001` | PLANNED NEXT | Whole-app hierarchy/Core Flow, Guide, desktop, themes/density/cards, EN/RU/HE/RTL, accessibility and human visual closeout. |
| themes/layout/density/cards | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Midnight/Daylight/Graphite + custom themes; Balanced/Table Focus/Analysis Focus/Controls First; Comfortable/Compact; shared Premium Cards. Freeze expansion and fix value/defaults. |
| restrained felt/table/chip customization | OPEN PRODUCT DECISION | Later product-design question only. **Default quality first**; customization cannot compensate for a bad default. |
| beginner/expert presentation + keyboard workflow | PRESERVED FUTURE | Guided vs denser provenance/shortcut experience after core surfaces stabilize. |
| arbitrary layout editor | REJECTED / REMOVED | Do not revive. |

## 11. Opponent Policies / Bots

| Capability | Status | Accepted scope |
|---|---|---|
| `OPPONENT-POLICY-ARCH-001` | PRESERVED FUTURE | High-value versioned opponent-behavior contract separate from reference strategy and real-person claims. |
| generic/environment archetypes | PRESERVED FUTURE | Transparent Calling Station/Nit/TAG/Maniac or environment assumptions, not difficulty labels. |
| custom opponent policies | PRESERVED FUTURE | User-owned behavior identity with explicit uncertainty/privacy. |
| Personal Strategy as opponent | PRESERVED FUTURE | Practice against intended mode without claiming it models a person. |
| full-hand bot Training | PRESERVED FUTURE | Complete legal hands, Hero decision record, post-hand review, selected reference, Personal Strategy, save/re-drill. |
| observed opponent learning | PRESERVED FUTURE | Only with sufficient evidence/consent; no false certainty about real people. |

## 12. Platform / Release / Mobile

| Capability | Status | Accepted scope |
|---|---|---|
| browser runtime / thin Electron | COMPLETED | Dependency-free Node server and same app in Electron; no Python or model runtime required. |
| CI | COMPLETED | Node 24 syntax + canonical Node suite. |
| targeted architecture decomposition | PRESERVED MAINTENANCE | Extract `logic.js` seams only when real tickets touch them; no rewrite program. |
| live Supabase verification | PLANNED LATER | Release gate: migrations, RLS, multi-profile Firefox lifecycle. |
| packaging/installer/hosting/offline cache | PRESERVED FUTURE | After product quality. |
| privacy/legal/observability | PRESERVED FUTURE | Before public release as applicable. |
| mobile | PRESERVED FUTURE | Deliberate composition, not compressed/stacked desktop. |
| telemetry | OPEN PRODUCT DECISION | Explicit approval only; privacy-first. |
| public release/monetization | OPEN PRODUCT DECISION | No implied current commitment. |

## 13. PLO / Other Game Domains

| Branch | Status | Accepted path |
|---|---|---|
| PLO | PRESERVED FUTURE | Separate four-card domain, exactly-two-hole evaluation, dedicated ranges/Equity/Training/reference/UI; never a Hold'em toggle. |
| tournament/ICM depth | PRESERVED FUTURE | Explicit tournament assumptions and reference/accounting pipeline. |
| other variants | OPEN PRODUCT DECISION | No generic framework until a real need exists. |

## 14. Open Product Decisions

- exact first trusted reference-pack family;
- Training-evidence opt-in placement/default and future default comparison source;
- first OpponentPolicy archetypes/custom-policy UX;
- Saved folders/collections;
- sharing/forking permissions, comments, friends, study groups, and shared drills;
- whether username login is required before release;
- restrained felt/table/chip presentation choices after default quality;
- study streaks/daily goals: **OPEN PRODUCT DECISION**, restrained and based on real activity;
- mastery/progress: **OPEN PRODUCT DECISION** until valid concept/history exists;
- XP, badges, levels, achievements: **REJECT BY DEFAULT** as a conscious anti-engagement-theater stance;
- mobile timing, public release/monetization, PLO priority, and telemetry;
- touch/click semantics for reusable card outcome preview.

## Pull-forward rule

A preserved item moves earlier only through explicit reprioritization and a bounded owner. Do not absorb future capability merely because a touched file makes it convenient. Follow `DOCUMENTATION_GOVERNANCE.md` when accepted status, priority, debt, or ownership changes.
