# Riverline persistent QA backlog

Last consolidated: August 24, 2026 (`UX-REGRESSION-001` accepted; eleven owned hands-on regressions closed).

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
| QA-NODE-BASELINE-001 | CLOSED | The canonical global Node suite remains the correctness baseline. Strategy authority, DecisionContext v1.1, exact preflop roles, benchmark tooling, bounded structural calibration, Core Flow, Premium Cards, Personal Strategy metadata, account/Guest semantics, localization, Table Presence, and Full Hand Review invariants remain represented. Machine-sensitive macro runtime reporting stays separate from correctness and operation-level interaction thresholds. | Global Node baseline checkpoint |
| QA-CI-001 | CLOSED | Minimal GitHub Actions automation runs canonical syntax checks and the full Node suite on Node 24 for pushes, pull requests, and manual dispatches. Hosted-run state remains externally observable rather than inferred locally. | `.github/workflows/node-ci.yml` |

## Strategy / reference / calibration

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-REFERENCE-AUTHORITY-001 | PARTIAL | Additive source descriptors, structured coverage/capabilities, central claim policy, comparative heuristic Training language, high-risk limitation path, Playbook/Analyze provenance, Matrix precision, AnalysisExplanation consumption, and EN/RU/HE semantics are automated. FULL-HAND-REVIEW-001 adds source-gated comparison, exact recorded frequencies, compact provenance, limitations, and unavailable/generalized continuity without changing authority. Remaining human Firefox acceptance includes Training pre/after-answer, Full Hand comparison copy, high-risk context notes, Playbook Details/provenance, Matrix precision, Daylight/Midnight, and HE RTL. | REFERENCE-AUTHORITY-001 / FULL-HAND-REVIEW-001 human Firefox acceptance |
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
| QA-TABLE-VNEXT-001 | PARTIAL | Pure deterministic tests cover all 2–10 player templates, normalized anchors, Hero-bottom invariance, geometry families, seat prominence, physical table facts, projection sizing targets, RTL-stable poker geometry, and deep immutability. The TABLE-PRESENCE-002 Firefox matrix passed its bounded checks; independent human acceptance remains open. | TABLE-PRESENCE-002 human Firefox acceptance |
| QA-TABLE-VNEXT-002 | PARTIAL | Hand and Full Hand Training share the presentation and derived review contracts; direct pre-action frame seeking, complete/review states, decision navigation, canonical source semantics, and exact Analyze/Save routes are structurally covered. Independent human interaction and requested Firefox A–H visual acceptance remain open. | FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-FULL-HAND-REVIEW-001 | PARTIAL | One shared review surface now covers the hand overview, every recorded Hero decision, mixed-reference comparison only when source capabilities permit it, provenance/limitations, exact Replay synchronization, Analyze, existing-schema Save Spot/Hand, Repeat/Next/Return, multiway facts, accessibility, responsive rules, EN/RU/HE, RTL, themes, cards, and provider-result caching. Focused automated coverage is present; independent human Firefox acceptance of exact states A–H at 1920×1080, 2560×1440, and 2560×1600 in Midnight and Daylight remains open. | FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-TABLE-VNEXT-003 | PARTIAL | `AUDIO-MOTION-001` implements the first bounded TablePresentation-based stack-to-contribution, contribution-to-pot, pot-to-winner, fold, street, actor, and hand-complete consequences with direct-seek suppression and reduced-motion safety. Human Firefox visual interaction remains open; detailed denominations, elaborate card/showdown choreography, deeper/3D treatment, and ambience remain deferred. | `RET-AUDIO-001` Firefox acceptance / later explicit physicality ticket |
| QA-AUDIO-MOTION-001 | PARTIAL | Accepted implementation checkpoint: the overall audio system, materially improved physical foley, routing architecture, and ordinary-Training Study/UI versus visible poker-world distinction are accepted as sufficient to move on. Subjective Study/UI polish, optional Check refinement, fatigue review, and any unperformed Firefox visual/audio acceptance remain known debt; do not claim subjective perfection. | `RET-AUDIO-001` later subjective refinement / Firefox acceptance if prioritized |

## August 24 hands-on product findings

These IDs are durable hands-on findings: open rows are current product defects or accepted polish debt, while closed rows preserve repaired invariants. They are not a generic “premium polish” bucket and may close only with the named owner plus appropriate real-browser/human acceptance.

| ID | Status | Issue / durable invariant | Owner |
|---|---|---|---|
| QA-HANDSON-001 | CLOSED | Default picker cards now use a readable 42×60 target with prominent rank/suit and comfortable hit areas; Firefox verified all 52 cards without extreme shrink or viewport overflow. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-002 | CLOSED | One presentation authority rounds generated/suggested strategy sizing to human 0.5bb increments while canonical, historical, user-entered, legal, and accounting amounts remain exact. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-003 | OPEN | Controls First gives tiny controls an oversized left region and unexplained dead space. | `WORKSPACE-COMPOSITION-002` |
| QA-HANDSON-004 | CLOSED | Five board cards remain one horizontal LTR poker-order row with semantic Flop/Turn/River guides across supported desktop presets, including 1024px and HE RTL chrome. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-005 | OPEN | Some layout presets mostly redistribute whitespace/width and reduce usability. Weak presets may be redesigned, renamed, consolidated, or removed. | `WORKSPACE-COMPOSITION-002` |
| QA-HANDSON-006 | CLOSED | The released tutorial version no longer re-nags after skip or completion; reload/navigation persistence, manual restart, and intentional version re-offer remain covered. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-007 | OPEN | Guide needs a current-product content review. | `PREMIUM-CLOSEOUT-001` Guide closeout |
| QA-HANDSON-008 | CLOSED | Home Game Create binds only after its authentication dependency is ready, stays in the Organizer, and opens the intended active session; broader organizer work remains `HOME-GAME-001B`. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-009 | PARTIAL | Audio volume is implemented by `AUDIO-MOTION-001`; retain subjective Study/UI/Check/fatigue/Firefox polish debt without reopening accepted architecture. | `RET-AUDIO-001` later polish |
| QA-HANDSON-010 | OPEN | Settings is a god menu containing too many unrelated concerns. | `SETTINGS-IA-001` |
| QA-HANDSON-011 | OPEN | Tutorial/help discovery is buried at the bottom of Settings. | `WELCOME-INTRO-001` / `SETTINGS-IA-001` |
| QA-HANDSON-012 | CLOSED | Built-ins are immutable and custom themes use explicit Edit, Save, Cancel, Duplicate, and Save as New transactions; draft changes do not persist or mutate the source before commit. | `UX-REGRESSION-001` accepted checkpoint; broader IA remains `SETTINGS-IA-001` |
| QA-HANDSON-013 | OPEN | Comfortable/Compact does not consistently create enough value. Strengthen, simplify, or remove the weak distinction; do not add more density modes. | `WORKSPACE-COMPOSITION-002` |
| QA-HANDSON-014 | OPEN | Training Facing/Position/Pot/Stack/Players facts render as equal-weight dark boxes and are hard to scan. Critical decision context needs stronger hierarchy. | `WORKSPACE-COMPOSITION-002` |
| QA-HANDSON-015 | OPEN | Table visuals still feel weird/unfinished despite stronger architecture. Improve composition and physical presentation without casino spectacle. | `WORKSPACE-COMPOSITION-002` / `TABLE-PHYSICALITY-003` |
| QA-HANDSON-016 | CLOSED | Existing durable Save actions share an accessible outline/filled bookmark state backed by exact SavedStudyObject detection; repeated exact saves remain idempotent and no unsupported unsave/delete was invented. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-017 | OPEN | Equity wastes a large amount of canvas/dead space. | `WORKSPACE-COMPOSITION-002` |
| QA-HANDSON-018 | CLOSED | Four legal Training actions render as a balanced 2×2 constrained-desktop grid or readable 4×1 wide grid, preserving source/keyboard order and avoiding an orphan row. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-019 | CLOSED | Hint selection is street-aware: preflop uses starting-hand/position concepts and cannot select postflop made-hand/draw/board prompts; postflop may use those existing facts. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-020 | CLOSED | Table Focus now materially increases the presentation target over Balanced while retaining canonical HU/sparse/6-max/full-ring geometry, usable timeline/action dock, and density-independent layout. Broader composition/physicality remains separately open. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-021 | CLOSED | Every visible known compact/table card exposes rank plus suit across current card styles, color modes, themes, densities, table sizes, and RTL; hidden opponent cards remain backs with no identity leak. | `UX-REGRESSION-001` accepted checkpoint |

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
| QA-UI-001 | PARTIAL | Action Path nodes/connector must share one axis in LTR/RTL; glow must not clip | PRODUCT-UI-002R manual acceptance |
| QA-UI-002 | PARTIAL | ordinary status pills must remain one-line, content-sized, centered | PRODUCT-UI-002R manual acceptance |
| QA-UI-003 | PARTIAL | Betting Context still needs confirmed meaningful height reduction/alignment | PRODUCT-UI-002R manual acceptance |
| QA-UI-004 | PARTIAL | `View all hands` must align with Position/Prior action row | PRODUCT-UI-002R manual acceptance |
| QA-UI-005 | PARTIAL | `table-presentation/v1` now integrates hole cards with each adaptive 2–10 player unit while preserving name, position, stack, action, and prominence facts; the TABLE-PRESENCE-002 Firefox capture matrix found no seat/card overlap, but independent human interaction acceptance remains required | TABLE-PRESENCE-002 human Firefox acceptance |
| QA-UI-006 | PARTIAL | Settings modal must remain centered and viewport-safe at smaller desktop sizes | PRODUCT-UI-002R manual acceptance |

## Next: shared analysis presentation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ANALYSIS-001 | PARTIAL | Playbook analysis retains its full Decision-grid row; R2 readability needs final manual acceptance | PRODUCT-UI-003R2 |
| QA-ANALYSIS-002 | PARTIAL | Shared Hero/board, economics, reasons, and context hierarchy refined; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-ANALYSIS-RANGE-001 | PARTIAL | exact-hand, board, blocker, supplied-range, provenance, tutorial, and EN/RU/HE integration are structurally tested; final live viewport/theme/language acceptance remains pending | ANALYSIS-RANGE-001 human acceptance |
| QA-ANALYSIS-BLUFF-001 | PARTIAL | Bluff & Pressure risk/reward, unavailable sizing, semibluff structure, multiway wording, river reference, range-removal boundaries, tutorial, and EN/RU/HE/RTL integration are structurally tested; final human viewport/theme/language acceptance remains pending | BLUFF-001 human acceptance |
| QA-TRAIN-ANALYSIS-001 | PARTIAL | Training uses the refined shared hierarchy and now converges with normal Hand on the shared completed-hand review surface; final manual acceptance remains pending. | FULL-HAND-REVIEW-001 human Firefox acceptance / premium closeout |
| QA-TRAIN-ANALYSIS-002 | PARTIAL | Pre-answer assistance is now one-at-a-time coaching hints; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-TRAIN-ANALYSIS-003 | PARTIAL | Post-answer reference remains one canonical frequency panel; the shared completed-hand review now reuses recorded StrategyResults and gates mixed comparison by source capability. Final manual acceptance remains pending. | FULL-HAND-REVIEW-001 human Firefox acceptance / premium closeout |

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
| QA-POLISH-001 | PARTIAL | PRELABS-FIX-001 established the lazy Firefox AudioContext seam and `AUDIO-MOTION-001` is now an accepted implementation checkpoint. Remaining subjective Study/UI and Check refinement plus unperformed Firefox audio/visual acceptance stay open as later polish debt rather than blocking the next ticket. | `RET-AUDIO-001` / later prioritized polish |
| QA-CARD-001 | PARTIAL | Premium Card System v1 remains the shared face authority and now scales inside the adaptive 2–10 player-unit geometry; Firefox visual acceptance at 1920×1080 remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-CARD-002 | PARTIAL | `10` keeps its explicit optical-width treatment in the scaled table-card family across all three styles; Firefox visual acceptance remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-CARD-003 | PARTIAL | DOM and SVG cards still share one presentation authority, named geometry, face semantics, and back variants; structural tests cover TablePresentation integration, while representative workspace/theme visual acceptance remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-THEME-001 | PARTIAL | Daylight controls now use semantic light surfaces; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-002 | PARTIAL | Daylight muted text passes structural contrast checks; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-003 | PARTIAL | legacy/experimental labels are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-004 | PARTIAL | duplicate Discord entries are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-005 | PARTIAL | Luxury Gold is retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-006 | PARTIAL | Named custom-theme lifecycle and independence remain automated; TABLE-PRESENCE-002 adds token-driven felt texture, two-band rail, betting line, seat prominence, and projection sizing without changing persisted theme records. Remaining acceptance: the existing custom-theme lifecycle plus Midnight/Daylight table legibility and Compact + Table Focus composition in Firefox. | PRODUCT-THEME-002 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-MICRO-001 | OPEN | Settings/current utility icon alignment needs final pass | PRODUCT-UI-004 |
| QA-MICRO-002 | OPEN | action-color palette needs final restrained consistency review | PRODUCT-UI-004 |
| QA-MICRO-003 | OPEN | awkward near-black inset surfaces need final token review | PRODUCT-UI-004 |

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
| QA-LAYOUT-001 | OPEN | Decision/Matrix/Range tabs sit too low and feel disconnected | PRODUCT-UI-005 |
| QA-LAYOUT-002 | PARTIAL | Active Hand now uses a primary compact timeline → adaptive table → Hero action dock sequence before secondary details, while setup remains a bounded rail and Analysis remains separate; Firefox passed the ticket's 1920×1080, 2560×1440, and 2560×1600 capture matrix, while 1024×768, 1366×768, representative zoom, and independent interaction acceptance remain open | TABLE-PRESENCE-002 human Firefox acceptance / PRODUCT-UI-005 |
| QA-LAYOUT-003 | PARTIAL | TABLE-PRESENCE-002 resolves active play and review as table/card-first while retaining configuration-first setup before a Hand starts; HU, 6-max, and 10-max Firefox captures passed target-width, dock-visibility, overflow, and collision checks, while independent human validation remains open | TABLE-PRESENCE-002 human Firefox acceptance / Product Lab follow-up if rejected |
| QA-LAYOUT-PRESETS-001 | PARTIAL | Existing workspace-specific layout presets remain the authority; TablePresentation adds Play/Review/Analyze/Saved-preview sizing targets and final responsive convergence without adding a competing preset. Firefox captures passed Balanced/Table Focus with Comfortable/Compact and EN/HE at ticket desktop widths; independent interaction acceptance plus Analysis Focus/Controls First regression sampling remains open. | LAYOUT-PRESETS-001 / TABLE-PRESENCE-002 human Firefox acceptance |
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
| QA-TABLE-001 | PARTIAL | The active Hand now renders canonical facts through `table-presentation/v1`: deliberate 2–10 geometry, felt/rail/betting-line physicality, player-unit prominence, integrated cards, dealer/contribution/pot placement, compact timeline, and a legal-action-only Hero dock. Automated Firefox geometry checks and manual screenshot inspection passed the ticket matrix; independent human interaction acceptance remains open. | TABLE-PRESENCE-002 human Firefox acceptance |
| QA-COLLAPSE-001 | PARTIAL | Starting a Hand restores the table to expanded state and keeps the collapse control integrated; Firefox compact-state acceptance remains open | CORE-FLOW-001B Firefox acceptance / UI-005 |

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
| QA-I18N-001 | PARTIAL | Rendered-visible RU/HE audit is structurally clean across representative surfaces; FULL-HAND-REVIEW-001 adds complete EN/RU/HE review vocabulary and structural audits. Human linguistic acceptance remains pending. | i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-I18N-002 | PARTIAL | Live locale switching preserves state and re-renders without cross-locale leakage; shared review content is translated through the canonical runtime. Human acceptance remains pending. | i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-I18N-003 | PARTIAL | Static diagnostics report no missing visible keys, mojibake, or cross-locale contamination under the narrow whitelist, including Full Hand Review keys. Human acceptance remains pending. | i18n human acceptance |
| QA-I18N-004 | PARTIAL | RTL and poker-data LTR islands are structurally tested, including the shared review surface and cards/action values; human visual acceptance remains. | responsive/i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-RESP-001 | PARTIAL | Automated desktop renderer and structural responsive checks cover existing workspaces; Full Hand Review adds two-column-to-single-column convergence and Compact rules. Human Firefox acceptance remains pending at the ticket viewports/themes. | FULL-HAND-REVIEW-001 / premium closeout human acceptance |
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
