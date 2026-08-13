# Riverline persistent QA backlog

Last consolidated: August 13, 2026.

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
| RL-12 | OPEN | theme/debug labels | PRODUCT-UI-004 |
| RL-13 | PARTIAL | One-at-a-time coaching hints replace pre-answer reference disclosure; manual acceptance pending | PRODUCT-UI-003R2 |
| RL-14 | PARTIAL | Training result uses the refined Hero/board-first hierarchy; manual acceptance pending | PRODUCT-UI-003R2 |
| RL-16 | PARTIAL | Equity UX accepted except card-back containment and small 1080p fit regressions; correction implemented and test-verified, final renderer acceptance pending | EQUITY-UX-001R visual acceptance |
| RL-17 | PARTIAL | Guide terminology/content refresh is implemented and test-verified; final human Guide review is pending | GUIDE-001 human review |
| RL-18 | CLOSED | current DOM remeasured; card-picker deck now detaches on close while Matrix/Range caches retain PERF-001 behavior | PERF-RL18 |
| RL-20 | OPEN | theme semantics / Daylight contrast | PRODUCT-UI-004 |

## Cards, themes, and micro-polish

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-POLISH-001 | PARTIAL | Visual/motion polish is manually accepted; POLISH-FINAL-001R raises and separates cue levels with clean one-event/one-hook and Audio-toggle renderer checks, pending human audibility acceptance | POLISH-FINAL-001R human listening acceptance |
| QA-CARD-001 | OPEN | table/DOM card corner rank and suit can clip | PRODUCT-UI-004 |
| QA-CARD-002 | OPEN | full `10` mirrored bottom-corner centering/geometry looks wrong | PRODUCT-UI-004 |
| QA-CARD-003 | OPEN | DOM and SVG card-face geometry need final consistency pass | PRODUCT-UI-004 |
| QA-THEME-001 | OPEN | Daylight still has dark/black inputs in some states | PRODUCT-UI-004 |
| QA-THEME-002 | OPEN | Daylight small muted text needs contrast verification | PRODUCT-UI-004 |
| QA-THEME-003 | OPEN | legacy/experimental theme labels expose `(0px)`/debug-like text | PRODUCT-UI-004 |
| QA-THEME-004 | OPEN | duplicate/confusing Discord Dark entries | PRODUCT-UI-004 |
| QA-THEME-005 | OPEN | Luxury Gold name does not match its palette | PRODUCT-UI-004 |
| QA-MICRO-001 | OPEN | Settings/current utility icon alignment needs final pass | PRODUCT-UI-004 |
| QA-MICRO-002 | OPEN | action-color palette needs final restrained consistency review | PRODUCT-UI-004 |
| QA-MICRO-003 | OPEN | awkward near-black inset surfaces need final token review | PRODUCT-UI-004 |

## Workspace composition and responsive fit

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-LAYOUT-001 | OPEN | Decision/Matrix/Range tabs sit too low and feel disconnected | PRODUCT-UI-005 |
| QA-LAYOUT-002 | OPEN | Playbook table/configuration pushes analysis far below the fold | PRODUCT-UI-005 |
| QA-LAYOUT-003 | OPEN | card-first versus configuration-first ordering needs product decision | PRODUCT-UI-005 / Product Lab |
| QA-MATRIX-001 | PARTIAL | Matrix now has dominant-action tint, a full-mix band, and exact hover/focus cues; final live acceptance pending | PRODUCT-UI-005R |
| QA-MATRIX-002 | OPEN | postflop unavailable state should not render 169 inactive cells | PRODUCT-UI-005 |
| QA-RANGE-001 | OPEN | two Range Category grids create an extremely long comparison page | PRODUCT-UI-005 |
| QA-EQUITY-001 | OPEN | Equity workspace still feels like loosely assembled panels | PRODUCT-UI-005 |
| QA-EQUITY-002 | OPEN | Equity `Hero / Win / Tie` label spacing/wrapping | PRODUCT-UI-005 |
| QA-EQUITY-003 | PARTIAL | Flop/Turn/River guides and live board slots now share one five-column LTR grid; Electron geometry is exact across the RESPONSIVE-001 EN/RU/HE viewport matrix, with human visual acceptance still pending | RESPONSIVE-001 human acceptance |
| QA-TRAIN-LAYOUT-001 | PARTIAL | Training desktop density is reduced for 1920×1080 pre-answer fit; final live acceptance pending | PRODUCT-UI-005R |
| QA-TRAIN-LAYOUT-002 | OPEN | idle/no-board surfaces waste vertical space | PRODUCT-UI-005 |
| QA-TABLE-001 | OPEN | support rails/Action Path should be visible where useful without excessive scroll | PRODUCT-UI-005 |
| QA-COLLAPSE-001 | PARTIAL | collapsed table control should remain compact and integrated | PRODUCT-UI-002R acceptance / UI-005 |

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
