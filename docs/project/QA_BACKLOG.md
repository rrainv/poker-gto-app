# Riverline persistent QA backlog

Last consolidated: August 22, 2026 (global Node baseline and CI checkpoint).

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
| QA-NODE-BASELINE-001 | CLOSED | After the Premium Card System v1 checkpoint, the canonical global Node suite is green at 1,636/1,636. Accepted Core Flow, Guest privacy, action-aware Personal Strategy metadata, localized poker terminology, lazy workspace behavior, and Premium Card structural coverage remain represented. Machine-sensitive macro runtime reporting is separated from correctness and operation-level interaction thresholds. | Global Node baseline checkpoint |
| QA-CI-001 | CLOSED | Minimal GitHub Actions automation runs the canonical syntax checks and full Node suite on Node 24 for pushes, pull requests, and manual dispatches. This records repository automation presence; the first hosted run remains externally observable in GitHub rather than being inferred locally. | `.github/workflows/node-ci.yml` |

## Home / My Riverline

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-002A-001 | PARTIAL | Guest privacy/usefulness, authenticated identity/sync composition, truthful Continue, bounded Saved/Review/Mistakes, Personal Strategy evidence facts, account switching, coalesced invalidation, performance boundaries, EN/RU/HE structure, and accessibility are automated; requested Firefox viewport/theme/language visual acceptance was unavailable in the implementation environment | HOME-002A human Firefox acceptance |
| QA-HOME-002A-002 | DEFERRED | Full Saved Study View all/library, search, filters, and tag drilldowns do not yet exist; HOME-002A intentionally provides only actionable bounded previews | HOME-002B |
| QA-HOME-002A-003 | DEFERRED | Persistent Training history/re-drill intelligence and recent Analysis history remain unsupported; Home exposes seams but no statistics | dedicated Training/Analysis persistence tickets |

## Home Game Organizer

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-GAME-001A-001 | PARTIAL | Standalone boundary, exact money, append-only corrections, balance rejection, deterministic settlement, lifecycle/reopen, account isolation, Guest memory, groups/session-from-group, atomic persistence, top-level workspace, EN/RU/HE structure, RTL/logical CSS, and accessible form/status structure are automated; requested Firefox checks at 1024×768, 1366×768, and 1920×1080 remain open | HOME-GAME-001A human Firefox acceptance / HOME-GAME-001B |
| QA-HOME-GAME-001A-002 | DEFERRED | Saved-player editing/archive, visible reversal history, session archive/delete confirmation, and richer organizer management are intentionally outside the foundation proof surface | HOME-GAME-001B |

## Active Product UI repair

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-UI-001 | PARTIAL | Action Path nodes/connector must share one axis in LTR/RTL; glow must not clip | PRODUCT-UI-002R manual acceptance |
| QA-UI-002 | PARTIAL | ordinary status pills must remain one-line, content-sized, centered | PRODUCT-UI-002R manual acceptance |
| QA-UI-003 | PARTIAL | Betting Context still needs confirmed meaningful height reduction/alignment | PRODUCT-UI-002R manual acceptance |
| QA-UI-004 | PARTIAL | `View all hands` must align with Position/Prior action row | PRODUCT-UI-002R manual acceptance |
| QA-UI-005 | PARTIAL | table identity/stack must remain visible and cards must not cover seat information | PRODUCT-UI-002R manual acceptance |
| QA-UI-006 | PARTIAL | Settings modal must remain centered and viewport-safe at smaller desktop sizes | PRODUCT-UI-002R manual acceptance |

## Next: shared analysis presentation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ANALYSIS-001 | PARTIAL | Playbook analysis retains its full Decision-grid row; R2 readability needs final manual acceptance | PRODUCT-UI-003R2 |
| QA-ANALYSIS-002 | PARTIAL | Shared Hero/board, economics, reasons, and context hierarchy refined; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-ANALYSIS-RANGE-001 | PARTIAL | exact-hand, board, blocker, supplied-range, provenance, tutorial, and EN/RU/HE integration are structurally tested; final live viewport/theme/language acceptance remains pending | ANALYSIS-RANGE-001 human acceptance |
| QA-ANALYSIS-BLUFF-001 | PARTIAL | Bluff & Pressure risk/reward, unavailable sizing, semibluff structure, multiway wording, river reference, range-removal boundaries, tutorial, and EN/RU/HE/RTL integration are structurally tested; final human viewport/theme/language acceptance remains pending | BLUFF-001 human acceptance |
| QA-TRAIN-ANALYSIS-001 | PARTIAL | Training uses the refined shared hierarchy; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-TRAIN-ANALYSIS-002 | PARTIAL | Pre-answer assistance is now one-at-a-time coaching hints; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-TRAIN-ANALYSIS-003 | PARTIAL | Post-answer reference remains one canonical frequency panel; final manual acceptance pending | PRODUCT-UI-003R2 |

## August 13 live audit IDs

These identifiers are the current live-audit baseline. They remain distinct from historical QA routing.

| ID | Status | Issue | Owner |
|---|---|---|---|
| RL-05 | OPEN | Playbook long-page / analysis-location composition | PRODUCT-UI-005 |
| RL-06 | OPEN | 169 unavailable postflop Matrix cells | PRODUCT-UI-005 |
| RL-07 | OPEN | Range comparison stacking / long-page comparison | PRODUCT-UI-005 |
| RL-12 | PARTIAL | supported theme catalog now exposes only polished product labels; human visual acceptance pending | PRODUCT-THEME-001 |
| RL-13 | PARTIAL | One-at-a-time coaching hints replace pre-answer reference disclosure; manual acceptance pending | PRODUCT-UI-003R2 |
| RL-14 | PARTIAL | Training result uses the refined Hero/board-first hierarchy; manual acceptance pending | PRODUCT-UI-003R2 |
| RL-16 | PARTIAL | Equity UX accepted except card-back containment and small 1080p fit regressions; correction implemented and test-verified, final renderer acceptance pending | EQUITY-UX-001R visual acceptance |
| RL-17 | PARTIAL | Guide terminology/content refresh is implemented and test-verified; final human Guide review is pending | GUIDE-001 human review |
| RL-18 | CLOSED | current DOM remeasured; card-picker deck now detaches on close while Matrix/Range caches retain PERF-001 behavior | PERF-RL18 |
| RL-20 | PARTIAL | semantic theme authority and Daylight contrast checks are implemented; human visual acceptance pending | PRODUCT-THEME-001 |

## Cards, themes, and micro-polish

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-POLISH-001 | PARTIAL | Visual/motion polish is manually accepted; PRELABS-FIX-001 now proves Firefox 153 creates/resumes one lazy AudioContext before starting the first cue, with card/correct/mistake/hint and off/re-enable paths clean; subjective Firefox audibility still needs human listening acceptance | PRELABS-FIX-001 human Firefox listening acceptance |
| QA-CARD-001 | PARTIAL | Premium Card System v1 unifies table/DOM rank and suit placement with size-aware corners; Firefox visual acceptance at 1920×1080 remains | PREMIUM-CARD-001 human Firefox acceptance |
| QA-CARD-002 | PARTIAL | `10` now has an explicit optical-width treatment in DOM and SVG faces across all three styles; Firefox visual acceptance remains | PREMIUM-CARD-001 human Firefox acceptance |
| QA-CARD-003 | PARTIAL | DOM and SVG cards now share one presentation authority, named geometry, face semantics, and back variants; representative workspace and theme visual acceptance remains | PREMIUM-CARD-001 human Firefox acceptance |
| QA-THEME-001 | PARTIAL | Daylight controls now use semantic light surfaces; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-002 | PARTIAL | Daylight muted text passes structural contrast checks; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-003 | PARTIAL | legacy/experimental labels are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-004 | PARTIAL | duplicate Discord entries are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-005 | PARTIAL | Luxury Gold is retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-006 | PARTIAL | Named custom themes, v1→v2 single-record migration/repair, create/duplicate/rename/edit/delete/reset/fallback operations, exact accent/surface/felt overrides with derived readable dependent tokens, a pointer/keyboard HSV + hex Riverline picker, EN/RU/HE/RTL structure, and theme × density × layout independence are automated. Remaining acceptance: human Firefox at 1920×1080 for Graphite create → three picker edits → save/reload → rename → duplicate → delete, built-in immutability, exact picker marker/hex/preview identity, focus/Escape/Cancel, and Compact + Table Focus composition. | PRODUCT-THEME-002 human Firefox acceptance |
| QA-MICRO-001 | OPEN | Settings/current utility icon alignment needs final pass | PRODUCT-UI-004 |
| QA-MICRO-002 | OPEN | action-color palette needs final restrained consistency review | PRODUCT-UI-004 |
| QA-MICRO-003 | OPEN | awkward near-black inset surfaces need final token review | PRODUCT-UI-004 |

## Account identity foundation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ACCOUNT-001 | PARTIAL | Legacy Local Profile storage remains preserved and claimable behind the Guest boundary; its earlier Settings/profile acceptance is superseded in normal signed-out UX by ACCOUNT-002AR. Final migration acceptance must still prove existing local objects survive and retain stable IDs when claimed. | ACCOUNT-001 compatibility acceptance |
| QA-ACCOUNT-002A | PARTIAL | Supabase email/password auth, required profile/RLS migration, explicit claim/start-separate flow, Guest fail-closed semantics, durable-action resume gate, account switching/sign-out, truthful no-sync copy, EN/RU/HE/RTL, focus management, and Range Calibration gating are structurally implemented and deterministic tests pass. Electron HE automation verified the Guest Home, header menu, Guest-only auth dialog, Escape/focus restoration, and Save Spot promotion/cancel with the current spot retained at 1426×914 (plus an earlier maximized 1440×763 pass); it also found and prompted fixes for RTL menu placement, hidden Guest navigation/actions, modal visibility/panels, and asynchronous module-bootstrap ordering. Remaining acceptance: apply/verify the migration against a live Supabase project, exercise real signup/profile conflict/edit/sign-out/re-auth/resumed save, and complete human Firefox EN/RU/HE checks at 1024×768, 1366×768, and 1920×1080. | ACCOUNT-002A/AR live/manual acceptance |
| QA-ACCOUNT-002B-A | PARTIAL | Explicit Saved Hand/Spot opt-in, local-first coalesced outbox/retry, stable IDs, two-device fake-adapter flow, conflicts/three recovery choices, archive tombstones, Guest/account cancellation, cold remote Replay, import/export isolation, Supabase RLS/RPC structure, compact status/manual sync, and EN/RU/HE/RTL/accessibility structure are deterministic-test covered. Remaining acceptance: apply `202608170002_saved_study_object_sync.sql`, verify real cross-user RLS/idempotency/stale-revision behavior, and complete the requested two-profile Firefox lifecycle in EN/HE at 1024/1366, including offline/reconnect and conflict focus/visual checks. | ACCOUNT-002B-A live Supabase / Firefox acceptance |
| QA-ACCOUNT-002B-B | PARTIAL | Separate Personal Strategy / Range Calibration opt-in, shared transport with domain adapters, stable profile/mode/evidence/session IDs, cold-device restore/resume, immutable evidence dedupe, offline divergent direct-history preservation and inference abstention, metadata conflicts, session merge, Guest/account cancellation, import/export isolation, relational Supabase RLS/RPC structure, status aggregation, and EN/RU/HE/RTL/accessibility structure are deterministic-test covered. Remaining acceptance: apply `202608170003_personal_strategy_sync.sql`, verify live two-user RLS/idempotency/stale-revision/append-only behavior, and complete the requested two-profile Firefox lifecycle in EN/HE at 1024/1366, including offline answers on both devices, contradictory same-hand histories, merged resume, profile/mode conflict focus, and first-sync/status visual checks. | ACCOUNT-002B-B live Supabase / Firefox acceptance |

## Personal Strategy / Range Calibration

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-RANGE-CAL-002C | PARTIAL | Adaptive default selection, cold-start diversity, boundary/uncertainty/sparsity ranking, deterministic resume, atomic answer/rerank, Quick/Standard/Deep stopping, exhaustive fallback, Pause/Stop/Skip/Not sure/Ask another, category progress, EN/RU/HE/RTL structure, sync-safe cursor facts, comparative validation, and performance are automated. Remaining acceptance: human Firefox fresh/cold/10/~30/boundary/automatic-stop/Ask-another/Pause-resume checks in EN/RU/HE at 1024 and 1366; structural and scripted browser evidence is not visual acceptance. | RANGE-CAL-002C human Firefox acceptance |
| QA-PLAYSTYLE-QUICK-PROFILE-001 | PARTIAL | Bounded pair/suited/offsuit regional interpolation, broad 15-answer smooth-fixture coverage, unusual-hole/irregular/single-family abstention, inferred-interior redundancy penalty, boundary/transfer-disagreement priority, conflict blocking, explicit starter-profile checkpoint, Direct/Modeled/Uncertain-region/Clarification facts, maximum-six refinement batches that return to summary, scope isolation, no 169-completion semantics, derived-only evidence, and EN/RU/HE keys are automated. Remaining acceptance: human Firefox at zero/few/15–30 smooth/irregular-hole/transferred/conflicted/checkpoint/refinement-batch-complete states; verify the interruption feels deliberate, Review profile routing, no automatic next question, batch return, keyboard/focus, RTL/LTR poker tokens, scope switching, and both themes at 1024×768, 1366×768, and 1920×1080. | PLAYSTYLE-QUICK-PROFILE-001 + ACTIVE-CLARIFICATION-001 human Firefox acceptance |
| QA-RANGE-CAL-002D | PARTIAL | The snapshot-derived 169-cell Personal Strategy Matrix, six truthful status states, separate action/provenance encoding, filters, evidence/support/history inspector, conflict preservation, dominant-only confirmation, exact-mix corrections, adaptive-question follow/selection, source-only mutation, scope isolation, keyboard/RTL structure, responsive CSS, and performance boundaries are automated. Remaining acceptance: human Firefox fresh/10/~30/conflict/correction/exact-mix/pause-resume/scope-switch checks in EN/RU/HE, Midnight/Daylight, at 1024×768, 1366×768, and 1920×1080; confirm readability rather than debugging-grid overload. | RANGE-CAL-002D human Firefox acceptance |
| QA-RANGE-BUILDER-001 | PARTIAL | Same-scope Builder provenance, dominant/pure/exact semantics, click/Ctrl/Shift/drag selection, Fold/Raise paint-on-release, shape helpers, atomic 1/10/50/169-hand groups, correction lineage, conflict skip, semantic group undo, adaptive reranking, one notification/invalidation/recompute, EN/RU/HE keys, keyboard structure, RTL/LTR islands, tutorial, and architecture boundaries are automated. Remaining acceptance: human Firefox 10-answer → Builder region paint → multi-hand exact mix → undo → inferred/direct transition → Calibration rerank → profile/mode/reload checks in EN/RU/HE, Midnight/Daylight, at 1024×768, 1366×768, and 1920×1080; confirm editing feels fast and obvious. | RANGE-BUILDER-001 human Firefox acceptance |
| QA-RANGE-TEACHER-001 | PARTIAL | Source-derived summary, deterministic boundary islands/sparse regions/conflict hotspots/exact-mix opportunities, unaveraged heads, focused 002C session bias, same-session dismissal, Matrix/Builder/Calibration routing, scope/cloud/export isolation, EN/RU/HE keys, semantic tabs/live status, tutorial, architecture boundaries, and cold/cached/recompute/clustering benchmarks are automated. Remaining acceptance: human Firefox fresh/10/~30/conflict/Builder-edit/reload/profile-mode-switch/stop-resume checks in EN/RU/HE, Midnight/Daylight, at 1024×768, 1366×768, and 1920×1080; confirm compactness, keyboard/RTL behavior, truthful copy, and interactive latency. | RANGE-TEACHER-001 human Firefox acceptance |

## Workspace composition and responsive fit

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-LAYOUT-001 | OPEN | Decision/Matrix/Range tabs sit too low and feel disconnected | PRODUCT-UI-005 |
| QA-LAYOUT-002 | PARTIAL | Core Flow now separates Hand setup from the live stage, places the canonical table and current action dock before secondary details at narrow desktop widths, and keeps Analysis a distinct destination; Firefox acceptance at the target desktop viewports remains open | CORE-FLOW-001B Firefox acceptance / PRODUCT-UI-005 |
| QA-LAYOUT-003 | OPEN | card-first versus configuration-first ordering needs product decision | PRODUCT-UI-005 / Product Lab |
| QA-LAYOUT-PRESETS-001 | PARTIAL | Manual acceptance found the original variants too width-led, then found Hand Controls First too form-like as a full-width setup band. The correction now uses workspace-specific stage/stacked-rail compositions; Hand Controls First uses a bounded 420px setup rail that contracts to 300px for an active Hand, while the table remains dominant. Supported-only selection, density-independent persistence, safe 1024 fallback, and refreshed Firefox 154 geometry/screenshots cover EN/RU/HE/RTL at 1024, 1920, and 2560 widths; repeat human Firefox composition acceptance remains open | LAYOUT-PRESETS-001 correction acceptance |
| QA-MATRIX-001 | PARTIAL | Matrix now has dominant-action tint, a full-mix band, and exact hover/focus cues; final live acceptance pending | PRODUCT-UI-005R |
| QA-MATRIX-002 | OPEN | postflop unavailable state should not render 169 inactive cells | PRODUCT-UI-005 |
| QA-RANGE-001 | OPEN | two Range Category grids create an extremely long comparison page | PRODUCT-UI-005 |
| QA-EQUITY-001 | OPEN | Equity workspace still feels like loosely assembled panels | PRODUCT-UI-005 |
| QA-EQUITY-002 | OPEN | Equity `Hero / Win / Tie` label spacing/wrapping | PRODUCT-UI-005 |
| QA-EQUITY-003 | PARTIAL | Flop/Turn/River guides and live board slots now share one five-column LTR grid; Electron geometry is exact across the RESPONSIVE-001 EN/RU/HE viewport matrix, with human visual acceptance still pending | RESPONSIVE-001 human acceptance |
| QA-TRAIN-LAYOUT-001 | PARTIAL | Training desktop density is reduced for 1920×1080 pre-answer fit; final live acceptance pending | PRODUCT-UI-005R |
| QA-TRAIN-LAYOUT-002 | OPEN | idle/no-board surfaces waste vertical space | PRODUCT-UI-005 |
| FQA-002 | CLOSED | Training context values use the real grid, reflow to two columns at 1024, and remain atomic in Firefox EN/RU/HE with no global overflow or inaccessible action controls | PRELABS-FIX-001 |
| FQA-004 | DEFERRED | Settings column imbalance is accepted low-priority Labs-era debt; no redesign is justified before Labs | Product Lab |
| QA-TABLE-001 | PARTIAL | The active Hand now centers canonical table facts, actor/price status, and legal controls while setup, players, and Replay use progressive disclosure; final table/support-rail composition and Firefox scroll acceptance remain open | CORE-FLOW-001B Firefox acceptance / PRODUCT-UI-005 |
| QA-COLLAPSE-001 | PARTIAL | Starting a Hand restores the table to expanded state and keeps the collapse control integrated; Firefox compact-state acceptance remains open | CORE-FLOW-001B Firefox acceptance / UI-005 |

## Equity UX

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-EQUITY-ETA-001 | PARTIAL | real Monte Carlo throughput and conservative ETA implemented and test-verified; live renderer acceptance pending | EQUITY-UX-001 visual acceptance |
| QA-EQUITY-PROGRESS-001 | PARTIAL | indeterminate preparation replaces fake `0%`; determinate progress uses real counters; live renderer acceptance pending | EQUITY-UX-001 visual acceptance |
| QA-EQUITY-NARROW-001 | PARTIAL | per-hand Equity/Win/Tie cards and responsive context hierarchy implemented; live renderer acceptance pending | EQUITY-UX-001 visual acceptance |

## Guide, localization, responsive, and mobile

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-GUIDE-001 | PARTIAL | Guide terminology/content refresh is implemented and test-verified; final human Guide review is pending | GUIDE-001 human review |
| QA-I18N-001 | PARTIAL | I18N-001R2 Electron rendered-visible RU/HE audit is clean across Matrix, empty Hand, unavailable Playbook Analysis, answered Training Analysis, localized theme Settings, and Equity advanced seed controls; exact-state screenshots captured, with human linguistic acceptance pending | I18N-001R2 human acceptance |
| QA-I18N-002 | PARTIAL | one initialized runtime localizes static/dynamic/attribute content; Electron live switching preserves the same Matrix model, Training exercise/ID/seed, and unavailable StrategyResult while RU → HE → EN → RU re-renders both unavailable message surfaces without recomputation or cross-locale script leakage | I18N-001R2 human acceptance |
| QA-I18N-003 | PARTIAL | static diagnostics report zero missing visible keys, zero mojibake, and zero cross-locale script contamination; the rendered audit covers text, pseudo-content, options, input values, and user-facing attributes with zero unintended English/Cyrillic/Hebrew findings under the narrow poker/technical proper-noun whitelist | I18N-001R2 human acceptance |
| QA-I18N-004 | PARTIAL | RTL direction and LTR poker-data islands are structurally tested; RESPONSIVE-001's 260-case Electron sweep and exact Equity street geometry cover Hebrew at 1024, 1080p, 1600p, and 90/110/125% zoom, with human visual acceptance still pending | RESPONSIVE-001 human acceptance |
| QA-RESP-001 | PARTIAL | RESPONSIVE-001 completed a 260-case Electron renderer sweep across the target desktop viewport, EN/RU/HE, primary-theme, workspace-state, and zoom matrix with no automated bounds/overflow findings; human visual acceptance remains pending | RESPONSIVE-001 human acceptance |
| QA-MOBILE-001 | DEFERRED | mobile needs a distinct composition, not only stacked desktop panels | MOBILE-001 |

## Performance and DOM follow-up

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-PERF-001 | CLOSED | duplicate slider/context updates and hidden Matrix computation | PERF-001 |
| QA-PERF-002 | CLOSED | live renderer inventory completed; 376-element/52-button hidden picker deck removed on close, remaining heavy grids are intentional visible/cached work | PERF-RL18 |
| QA-PERF-003 | OPEN | visible Matrix DOM mutation needs browser profiling if still sluggish | later PERF follow-up if measured |

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

Every UI/product ticket report must list owned IDs as:

- `CLOSED`
- `PARTIAL`
- `DEFERRED` with next owner
- `REGRESSION`

Do not close an issue merely because source-level tests pass. Add newly reported issues here rather than relying on chat memory.
