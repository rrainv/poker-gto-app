# Riverline persistent QA backlog

Last consolidated: August 23, 2026 (`ROADMAP-SYNC-003`, current through `PREFLOP-CALIBRATION-001`).

This is the authoritative issue-routing file for historical and current QA. Code/tests/latest accepted ticket reports determine actual closure.

## Status vocabulary

- `OPEN`: not addressed
- `ACTIVE`: owned by the current ticket
- `PARTIAL`: structural or incomplete fix; requires more work or live acceptance
- `CLOSED`: accepted behavior fix
- `REMOVED`: feature/control intentionally retired
- `DEFERRED`: accepted future owner exists
- `REGRESSION`: previously better/closed behavior broke

A visual issue is not `CLOSED` without manual/browser confirmation.

## Global Node baseline and CI

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-NODE-BASELINE-001 | CLOSED | After `PREFLOP-CALIBRATION-001`, the canonical global Node suite is green at 1,706/1,706. Strategy authority, DecisionContext v1.1, exact preflop roles, benchmark tooling, bounded structural calibration, Core Flow, Premium Cards, Personal Strategy metadata, account/Guest semantics, localization and existing product invariants remain represented. Machine-sensitive macro runtime reporting stays separate from correctness and operation-level interaction thresholds. | Global Node baseline checkpoint |
| QA-CI-001 | CLOSED | Minimal GitHub Actions automation runs canonical syntax checks and the full Node suite on Node 24 for pushes, pull requests, and manual dispatches. Hosted-run state remains externally observable rather than inferred locally. | `.github/workflows/node-ci.yml` |

## Strategy / reference / calibration

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-REFERENCE-AUTHORITY-001 | PARTIAL | Additive source descriptors, structured coverage/capabilities, central claim policy, comparative heuristic Training language, high-risk limitation path, Playbook/Analyze provenance, Matrix precision, AnalysisExplanation consumption, and EN/RU/HE semantics are automated. Remaining acceptance: Firefox Training pre/after-answer and Full Hand comparison copy, high-risk context notes, Playbook Details/provenance, Matrix workspace precision, Daylight/Midnight, and HE RTL at representative desktop sizes. | REFERENCE-AUTHORITY-001 human Firefox acceptance |
| QA-REFERENCE-AUTHORITY-002 | DEFERRED | Saved Hand/Spot preserve canonical/scenario state but not frozen historical StrategyResult metadata. If durable historical analysis is added, its payload must snapshot source ID/version, authority, coverage, capabilities and limitations rather than reinterpret against today's registry. | future Saved historical-analysis payload |
| QA-STRATEGY-REPAIR-001A | CLOSED | Table-family preflop structure, causal postflop sampling seed, missing-price abstention, unreachable shove cleanup, apples-to-apples physical-combo diagnostics and quality corpus accepted. | STRATEGY-REPAIR-001A |
| QA-DECISION-CONTEXT-001A | CLOSED | v1.1 live/current stack, unclamped current pot, effective stack, position relation, canonical legal sizing, bounded prior-action facts, Scenario lossiness and derivation provenance accepted; legacy compatibility stack/pot remain explicitly non-live. | DECISION-CONTEXT-001A |
| QA-STRATEGY-REPAIR-001B | CLOSED | Live SPR, exact price, legality, bounded position/history and separated response-family structure accepted without authority upgrade; known postflop saturation remains explicit reference debt. | STRATEGY-REPAIR-001B |
| QA-REFERENCE-BENCH-001 | CLOSED | Source-agnostic private/manual benchmark schema, context gate, raw/normalized action projections, TVD/bias/equity semantics, CLI and proprietary-data boundary accepted. | REFERENCE-BENCH-001 |
| QA-PREFLOP-ROLE-001 | CLOSED | Canonical histories now preserve exact preflop decision role, Hero prior voluntary action, initial/latest aggressors, distinct aggressor count and cold-action semantics; actual role remains distinct from fallback calibration. | PREFLOP-ROLE-001 |
| QA-PREFLOP-CALIBRATION-001 | CLOSED | Bounded six-max BB-vs-BTN cold-response policy now separates continue value, passive realization and aggression suitability; all non-target role distributions and postflop corpus remain byte-stable; source remains generalized comparative v4. | PREFLOP-CALIBRATION-001 |
| QA-PREFLOP-REFERENCE-001 | DEFERRED | Exact rake/sizing, wider position/stack/open-size validation and independently reviewed provenance/licensing are still required before any reference-grade preflop frequencies or stronger claims. | first trusted reference-pack program |
| QA-POSTFLOP-REFERENCE-001 | DEFERRED | Strong-made-hand aggression saturation, coarse opponent-range construction and unsized postflop strategy remain known generalized-heuristic debt. | future trusted postflop reference/calibration |

## Active Table Presence / full-hand vNext

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-TABLE-VNEXT-001 | ACTIVE | Current table foundation is canonical but the next visible phase must establish purpose-built HU/sparse/6-max/full-ring geometry, stronger Hero/current-opponent hierarchy, restrained physicality, cards/chips/contributions/dealer presentation, and a decision dock that visually belongs to the live decision. Competitive-reference brief owns acceptance criteria before CSS implementation. | TABLE-PRESENCE-REF-001 |
| QA-TABLE-VNEXT-002 | DEFERRED | Live, hand-complete, post-hand review, Analyze and Saved-inspector projections should not share one compromise hierarchy. Visual timeline/review-entry details are owned by TABLE-PRESENCE-002 or FULL-HAND-REVIEW-001. | TABLE-PRESENCE-002 / FULL-HAND-REVIEW-001 |
| QA-TABLE-VNEXT-003 | DEFERRED | Richer physical dealing/chip trajectories, deeper/3D table treatment and ambience remain later; no casino excess and reduced-motion behavior are mandatory. | later audio/motion/table physicality |

## Home / My Riverline

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-002A-001 | PARTIAL | Guest privacy/usefulness, authenticated identity/sync composition, truthful Continue, bounded Saved/Review/Mistakes, Personal Strategy evidence facts, account switching, coalesced invalidation, performance boundaries, EN/RU/HE structure, and accessibility are automated; requested Firefox viewport/theme/language visual acceptance remains open. | HOME-002A human Firefox acceptance |
| QA-HOME-002A-002 | DEFERRED | Full Saved Study View all/library, search, filters, tag drilldowns and master-detail inspector do not yet exist; HOME-002A intentionally provides bounded previews. | HOME-002B |
| QA-HOME-002A-003 | DEFERRED | Persistent Training history/re-drill intelligence and recent Analysis history remain unsupported; Home exposes seams but no fabricated statistics. | dedicated Training/Analysis persistence tickets |

## Home Game Organizer

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-GAME-001A-001 | PARTIAL | Standalone boundary, exact money, append-only corrections, balance rejection, deterministic settlement, lifecycle/reopen, account isolation, Guest memory, groups/session-from-group, atomic persistence, EN/RU/HE structure, RTL/logical CSS and accessible forms are automated; requested Firefox checks at 1024×768, 1366×768 and 1920×1080 remain open. | HOME-GAME-001A human Firefox acceptance / HOME-GAME-001B |
| QA-HOME-GAME-001A-002 | DEFERRED | Saved-player editing/archive, visible reversal history, session archive/delete confirmation and richer organizer management remain outside the foundation proof surface. | HOME-GAME-001B |

## Product UI / shared presentation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-UI-001 | PARTIAL | Action Path nodes/connector must share one axis in LTR/RTL; glow must not clip. | premium closeout/manual acceptance |
| QA-UI-002 | PARTIAL | Ordinary status pills must remain one-line, content-sized and centered. | premium closeout/manual acceptance |
| QA-UI-003 | PARTIAL | Betting Context still needs confirmed meaningful height reduction/alignment. | premium closeout |
| QA-UI-004 | PARTIAL | `View all hands` alignment with Position/Prior action row remains manual debt. | premium closeout / HOME-002B |
| QA-UI-005 | PARTIAL | Table identity/stack must remain visible and cards must not cover seat information; next table vNext owns the stronger hierarchy. | TABLE-PRESENCE-002 |
| QA-UI-006 | PARTIAL | Settings modal must remain centered and viewport-safe at smaller desktop sizes. | premium closeout |
| QA-ANALYSIS-001 | PARTIAL | Playbook analysis retains its full Decision-grid row; final readability/manual acceptance pending. | premium closeout |
| QA-ANALYSIS-002 | PARTIAL | Shared Hero/board, economics, reasons and context hierarchy refined; final manual acceptance pending. | premium closeout |
| QA-ANALYSIS-RANGE-001 | PARTIAL | Exact-hand, board, blocker, supplied-range, provenance, tutorial and EN/RU/HE integration are structurally tested; final live viewport/theme/language acceptance remains pending. | ANALYSIS-RANGE-001 human acceptance |
| QA-ANALYSIS-BLUFF-001 | PARTIAL | Bluff & Pressure risk/reward, unavailable sizing, semibluff structure, multiway wording, river reference, range-removal boundaries, tutorial and EN/RU/HE/RTL integration are structurally tested; final human viewport/theme/language acceptance remains pending. | BLUFF-001 human acceptance |
| QA-TRAIN-ANALYSIS-001 | PARTIAL | Training uses refined shared hierarchy; final manual acceptance pending. | premium closeout |
| QA-TRAIN-ANALYSIS-002 | PARTIAL | Pre-answer assistance is one-at-a-time coaching hints; final manual acceptance pending. | premium closeout |
| QA-TRAIN-ANALYSIS-003 | PARTIAL | Post-answer reference remains one canonical frequency panel; final manual acceptance pending. | premium closeout |

## August 13 live audit IDs

These identifiers remain the historical live-audit baseline; current tickets may supersede their owner.

| ID | Status | Issue | Owner |
|---|---|---|---|
| RL-05 | OPEN | Playbook long-page / analysis-location composition | premium closeout |
| RL-06 | OPEN | 169 unavailable postflop Matrix cells | future Matrix/premium closeout |
| RL-07 | OPEN | Range comparison stacking / long-page comparison | future Analysis/premium closeout |
| RL-12 | PARTIAL | supported theme catalog exposes polished product labels; human visual acceptance pending | theme acceptance |
| RL-13 | PARTIAL | One-at-a-time coaching hints replace pre-answer reference disclosure; manual acceptance pending | Training acceptance |
| RL-14 | PARTIAL | Training result uses refined Hero/board-first hierarchy; manual acceptance pending | Training acceptance |
| RL-16 | PARTIAL | Equity UX correction is test-verified; final renderer acceptance pending | Equity visual acceptance |
| RL-17 | PARTIAL | Guide terminology/content refresh implemented; final human review pending | Guide human review |
| RL-18 | CLOSED | hidden picker deck detaches on close while Matrix/Range caches retain PERF behavior | PERF-RL18 |
| RL-20 | PARTIAL | semantic theme authority and Daylight contrast checks implemented; human visual acceptance pending | theme acceptance |

## Cards, themes, density, layouts, and micro-polish

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-POLISH-001 | PARTIAL | Existing visual/motion polish and lazy AudioContext behavior are automated; subjective Firefox audibility still needs human listening acceptance. | AUDIO-MOTION-001 / human listening acceptance |
| QA-CARD-001 | PARTIAL | Premium Card System v1 unifies table/DOM rank and suit placement; Firefox visual acceptance remains. | premium closeout |
| QA-CARD-002 | PARTIAL | `10` optical-width treatment exists across DOM/SVG; Firefox visual acceptance remains. | premium closeout |
| QA-CARD-003 | PARTIAL | DOM/SVG cards share one presentation authority and back variants; representative workspace/theme acceptance remains. | premium closeout |
| QA-THEME-001 | PARTIAL | Daylight controls use semantic light surfaces; human visual acceptance pending. | premium closeout |
| QA-THEME-002 | PARTIAL | Daylight muted text passes structural contrast checks; human visual acceptance pending. | premium closeout |
| QA-THEME-003 | CLOSED | legacy/experimental labels retired from supported catalog. | PRODUCT-THEME-001 |
| QA-THEME-004 | CLOSED | duplicate Discord entries retired. | PRODUCT-THEME-001 |
| QA-THEME-005 | CLOSED | Luxury Gold retired. | PRODUCT-THEME-001 |
| QA-THEME-006 | PARTIAL | Named custom themes, migration/repair, create/duplicate/rename/edit/delete/reset/fallback, exact semantic overrides, Riverline HSV+hex picker and EN/RU/HE/RTL structure are automated; human Firefox lifecycle/composition acceptance remains. | premium closeout |
| QA-MICRO-001 | OPEN | Settings/current utility icon alignment needs final pass. | premium closeout |
| QA-MICRO-002 | OPEN | action-color palette needs final restrained consistency review. | premium closeout |
| QA-MICRO-003 | OPEN | awkward near-black inset surfaces need final token review. | premium closeout |

Do not expand theme/layout/density/card variant catalogs during the active table phase.

## Account identity / sync

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ACCOUNT-001 | PARTIAL | Legacy local data remains claimable behind Guest boundary; final migration acceptance must prove existing objects survive and IDs remain stable when claimed. | ACCOUNT compatibility acceptance |
| QA-ACCOUNT-002A | PARTIAL | Supabase email/password auth, profile/RLS migration, claim/start-separate, Guest fail-closed semantics, durable-action resume gate, switching/sign-out, no-sync copy, i18n/RTL/focus are structurally implemented. Remaining: live migration/provider validation and human Firefox lifecycle. | ACCOUNT-002A/AR live/manual acceptance |
| QA-ACCOUNT-002B-A | PARTIAL | Saved Hand/Spot opt-in sync, outbox/retry, stable IDs, conflict choices, tombstones, isolation, cold remote Replay and RLS/RPC structure are deterministic-test covered. Remaining: live migration/RLS and two-profile Firefox lifecycle. | ACCOUNT-002B-A live acceptance |
| QA-ACCOUNT-002B-B | PARTIAL | Personal Strategy/Calibration separate opt-in, stable IDs, immutable evidence, divergent-history preservation, metadata conflicts, session merge and RLS/RPC structure are deterministic-test covered. Remaining: live migration/RLS and two-profile Firefox lifecycle. | ACCOUNT-002B-B live acceptance |
| QA-ACCOUNT-002A2 | DEFERRED | Secure username/password adapter remains a separate trusted-server/Edge Function ticket if username login is still desired before release. | ACCOUNT-002A2 |

## Personal Strategy / Range Calibration

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-RANGE-CAL-002C | PARTIAL | Adaptive selection, boundary/uncertainty/sparsity ranking, deterministic resume, stopping, Skip/Not sure, category progress, i18n/RTL, sync-safe facts, validation and performance are automated; human Firefox acceptance remains. | RANGE-CAL-002C human acceptance |
| QA-PLAYSTYLE-QUICK-PROFILE-001 | PARTIAL | Bounded regional interpolation, starter checkpoint, clarification batches, abstention/conflict safety and EN/RU/HE are automated; human Firefox experience acceptance remains. | PLAYSTYLE-QUICK-PROFILE / ACTIVE-CLARIFICATION human acceptance |
| QA-RANGE-CAL-002D | PARTIAL | Snapshot-derived Matrix, truthful statuses, filters, evidence/history inspector, conflict preservation, corrections, adaptive follow/selection, keyboard/RTL and performance are automated; human Firefox matrix acceptance remains. | RANGE-CAL-002D human acceptance |
| QA-RANGE-BUILDER-001 | PARTIAL | Builder selection/painting, grouped direct/exact edits, conflict-safe commits, undo, adaptive reranking, i18n and tutorial are automated; human Firefox editing acceptance remains. | RANGE-BUILDER-001 human acceptance |
| QA-RANGE-TEACHER-001 | PARTIAL | Boundary/sparse/conflict/exact-mix recommendations, focused Calibration routing, scope isolation, i18n/tutorial and performance are automated; human Firefox compactness/truthfulness acceptance remains. | RANGE-TEACHER-001 human acceptance |
| QA-PERSONAL-002R | DEFERRED | Unified Calibration/Matrix/Builder/Teacher system still needs independent real-user review before more inference machinery or provider integration. | PERSONAL-STRATEGY-002R |

## Workspace composition and responsive fit

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-LAYOUT-001 | OPEN | Decision/Matrix/Range tabs sit too low and feel disconnected. | premium closeout |
| QA-LAYOUT-002 | PARTIAL | Core Flow separates Hand setup from live stage and places canonical table/action dock before secondary details at narrow desktop widths; Firefox acceptance remains. | TABLE-PRESENCE-002 / premium closeout |
| QA-LAYOUT-003 | OPEN | Card-first versus configuration-first ordering remains a product decision by state; table vNext should resolve live-Hand behavior without globally rewriting setup. | TABLE-PRESENCE-REF-001 |
| QA-LAYOUT-PRESETS-001 | PARTIAL | Supported presets now use workspace-specific stage/stacked-rail compositions with safe narrow fallback; repeat human Firefox acceptance remains. | premium closeout |
| QA-MATRIX-001 | PARTIAL | Matrix has dominant-action tint, mix band and exact hover/focus cues; final live acceptance pending. | future Matrix/premium closeout |
| QA-MATRIX-002 | OPEN | Postflop unavailable state should not render 169 inactive cells. | future Matrix/premium closeout |
| QA-RANGE-001 | OPEN | two Range Category grids create an extremely long comparison page. | future Analysis/premium closeout |
| QA-EQUITY-001 | OPEN | Equity workspace still feels like loosely assembled panels. | premium closeout |
| QA-EQUITY-002 | OPEN | Equity `Hero / Win / Tie` label spacing/wrapping. | premium closeout |
| QA-EQUITY-003 | PARTIAL | Flop/Turn/River guides and board slots share one grid; automated geometry is clean, human visual acceptance pending. | responsive human acceptance |
| QA-TRAIN-LAYOUT-001 | PARTIAL | Training desktop density reduced for 1080p pre-answer fit; final live acceptance pending. | premium closeout |
| QA-TRAIN-LAYOUT-002 | OPEN | idle/no-board Training surfaces waste vertical space. | premium closeout |
| FQA-002 | CLOSED | Training context values reflow cleanly at 1024 in Firefox EN/RU/HE. | PRELABS-FIX-001 |
| FQA-004 | DEFERRED | Settings column imbalance accepted low-priority debt. | Product Lab later |
| QA-TABLE-001 | PARTIAL | Active Hand centers canonical table facts, actor/price status and legal controls; next table vNext owns stronger stage/support-rail composition. | TABLE-PRESENCE-002 |
| QA-COLLAPSE-001 | PARTIAL | Starting a Hand restores expanded table state; Firefox compact-state acceptance remains. | TABLE-PRESENCE-002 / premium closeout |

## Equity UX

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-EQUITY-ETA-001 | PARTIAL | real Monte Carlo throughput and conservative ETA implemented; live renderer acceptance pending. | Equity visual acceptance |
| QA-EQUITY-PROGRESS-001 | PARTIAL | indeterminate preparation and real determinate counters implemented; live renderer acceptance pending. | Equity visual acceptance |
| QA-EQUITY-NARROW-001 | PARTIAL | per-hand Equity/Win/Tie cards and responsive context hierarchy implemented; live renderer acceptance pending. | Equity visual acceptance |

## Guide, localization, responsive, mobile

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-GUIDE-001 | PARTIAL | Guide terminology/content refresh implemented; final human review pending. | Guide human review |
| QA-I18N-001 | PARTIAL | Rendered-visible RU/HE audit is structurally clean across representative surfaces; human linguistic acceptance pending. | i18n human acceptance |
| QA-I18N-002 | PARTIAL | Live locale switching preserves state and re-renders without cross-locale leakage; human acceptance pending. | i18n human acceptance |
| QA-I18N-003 | PARTIAL | Static diagnostics report no missing visible keys/mojibake/cross-locale contamination under narrow whitelist; human acceptance pending. | i18n human acceptance |
| QA-I18N-004 | PARTIAL | RTL and poker-data LTR islands structurally tested; human visual acceptance remains. | responsive/i18n human acceptance |
| QA-RESP-001 | PARTIAL | Automated desktop renderer sweep found no bounds/overflow failures; human visual acceptance remains. | premium closeout / responsive human acceptance |
| QA-MOBILE-001 | DEFERRED | Mobile needs a distinct composition, not stacked desktop panels. | MOBILE-001 |

## Training intelligence / Saved study future QA

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-TRAINING-MEMORY-001 | DEFERRED | No canonical persistent DecisionRecord/mistake/review queue yet; Home must not invent accuracy/mastery/history. | TRAINING-MEMORY-001 |
| QA-TRAINING-REDRILL-001 | DEFERRED | Same/similar spot re-drill, spaced/adaptive review and saved drill presets remain future. | TRAINING-REDRILL-001 |
| QA-SAVED-LIBRARY-001 | DEFERRED | Full dense master-detail Saved Study Library and Hand/Spot/Range/Drill/Review/Session taxonomy are not implemented. | HOME-002B + payload tickets |

## Opponent policy / bots future QA

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-OPPONENT-POLICY-001 | DEFERRED | Opponent archetypes/custom policies/full-hand bot Training require a separate provenance-aware behavior contract and must not be conflated with reference strategy or real-person certainty. | OPPONENT-POLICY-ARCH-001 |

## Performance and DOM follow-up

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-PERF-001 | CLOSED | duplicate slider/context updates and hidden Matrix computation | PERF-001 |
| QA-PERF-002 | CLOSED | hidden picker deck removed on close; remaining heavy grids are intentional visible/cached work | PERF-RL18 |
| QA-PERF-003 | OPEN | visible Matrix DOM mutation needs browser profiling only if still measured sluggish | later PERF follow-up |

## Closed or intentionally removed historical QA

| ID | Status | Outcome |
|---|---|---|
| QA-HIST-001 | CLOSED | collapsible vertical sidebar and utilities moved into rail |
| QA-HIST-002 | CLOSED | flags/full language names and persisted RTL direction |
| QA-HIST-003 | REMOVED | broken arbitrary layout-lock/drag editor removed |
| QA-HIST-004 | CLOSED | table-collapse empty-region bug |
| QA-HIST-005 | CLOSED | card picker root event interception regression |
| QA-HIST-006 | CLOSED | card typography/proportions restored and shared card system introduced |
| QA-HIST-007 | CLOSED | spade/outside-suit contrast refinement |
| QA-HIST-008 | CLOSED | T/10 visual preference added |
| QA-HIST-009 | CLOSED | basic deal/action/training sounds and reduced-motion support |
| QA-HIST-010 | CLOSED | Matrix fixed grid/no hover expansion and selected-hand inspector |
| QA-HIST-011 | REMOVED | fake Matrix EV heatmap |
| QA-HIST-012 | REMOVED | fake Matrix Equity heatmap |
| QA-HIST-013 | CLOSED | Range controls use dedicated selectors and unsupported prescriptions removed |
| QA-HIST-014 | CLOSED | Scenario/Hand pricing semantics and truthful pot odds |
| QA-HIST-015 | CLOSED | AJo/pure-fold implementation cliff and per-hand MDF/fake preflop SPR |
| QA-HIST-016 | CLOSED | postflop multiway split/allocation/evaluator/sample consistency |
| QA-HIST-017 | CLOSED | one StrategyProvider/StrategyResult authority across surfaces |
| QA-HIST-018 | CLOSED | Equity board horizontal and 2–10 player controls |
| QA-HIST-019 | REMOVED | useless Total Equity summary |
| QA-HIST-020 | CLOSED | Outs visual grouping and raw-card cleanup |
| QA-HIST-021 | REMOVED | Training circular answer wheel |
| QA-HIST-022 | CLOSED | Training chosen/highest markers, muted action palette, session dividers |
| QA-HIST-023 | CLOSED | Replace-card semantics, scoped toasts, sidebar truthfulness, View-all destination reveal |
| QA-HIST-024 | CLOSED | Hand pre-start state isolation and showdown prerequisite |
| QA-HIST-025 | CLOSED | Training Strategy Preview versus After-answer copy truthfulness |
| QA-HIST-026 | REMOVED | local solver-tree/model upload control until a validated import contract exists |

## Update rules

Every UI/product ticket report must list owned IDs as `CLOSED`, `PARTIAL`, `DEFERRED` with next owner, or `REGRESSION`.

Do not close an issue merely because source-level tests pass. Add newly reported issues here rather than relying on chat memory.
