# Riverline M1 plan: design first (draft, 2026-10-15)

M1's first job is a **very good design refresh**: the app should look and feel the way the owner imagines it (Style v4, calm surface and deep data, no real or pseudo dead space, smooth motion and pointer feedback, sound) before the resource-heavy feature work of M2/M3. Feature work in M1 is limited to what makes the base honest and usable (truth fixes, trust package, data safety, i18n completeness). The owner will QA heavily on the PC; expect several correction rounds per screen. A guide, not an ultimatum: the owner decides order and scope.

Sizes: S (one session), M (one session plus corrections), L (two or more sessions or parts). Tiers per NORTH_STAR §10.

---

## Phase 0: safe start (16–17 Oct)
| ID | Outcome | Depends | Tier | Size |
|---|---|---|---|---|
| WIP-BACKUP-001 | Uncommitted Analyze work backed up on a wip branch | none | T0 | S |
| DOCS-RESET-001 | Compact agent docs: AGENTS, NORTH_STAR, STATE, ISSUE_REGISTER, TERMINOLOGY, DESIGN_SYSTEM (merging Design Language v2) + invariant ledger | backup | T0 | L |
| ANALYZE-ACCEPT | Owner accepts or corrects the Analyze composition work, then commit | docs reset | human | S |
| TRUTH-FIXES-001 | Hide sliders, honest spot table, reject 0 buy-in, 650 weights | docs reset | T1 | M |
| MOCKUP-ASSETS-001 | Real card backs, icons, table measurements for the design kit | none | T0 | S |

## Phase 1: design decisions on the PC (before any screen build)
Mockups are refined with the owner until each decision is signed off. No code yet.
| ID | Decision | Input |
|---|---|---|
| DES-SHELL | Shell and sidebar (variant 4 with hub screens, 2, or current); Home vs Study vs Tools vs Library split; My poker placement | shell canvas, kit screens |
| DES-STYLE | Style v4 final: tokens, heading face (UI font or Rubik), card back (real or modernised), Daylight values, table theme scope | design kit, typeface test |
| DES-COMPONENTS | Component state sheet signed off (idle, hover, pressed, held, selected, disabled, loading, error) with timings | to be drawn |
| DES-MOTION | Motion and sound spec from the motion prototype: timings, easing, what moves, what sounds, reduced-motion behaviour | motion prototype, optional Gemini research |
| DES-CONTROLS | Decision controls per mode (cards for quick drills, seat buttons at the table) | controls canvases |

## Phase 2: design foundation in code
| ID | Outcome | Depends | Tier | Size |
|---|---|---|---|---|
| DS-TOKENS-V4 | Style v4 tokens (panels, radii, gradients, shadows, buttons, pills, tiers, mix bar), Midnight + Daylight, heading face | DES-STYLE | T2 | M |
| SHELL-002 | New shell and sidebar, hub screens if chosen, About & legal footer link | DES-SHELL, tokens | T2 | L |
| DS-COMPONENTS-V4 | Shared components rebuilt once: buttons, pills, tabs, segmented, switch, fields, hero answer card, number tiles, tier pill, mix bar (labelled), history rail, cards and backs, seats, ledger rows, labelled matrix with hover card, empty/loading/error states | tokens, DES-COMPONENTS | T2 | L |
| MOTION-001 | Functional motion layer: in-place swaps with reserved heights, deal/flip, chip and pot moves, counters, hover/press/hold feedback, skeletons; in-app reduced-motion toggle | components, DES-MOTION | T2 | M |
| SOUND-001 | First sound set (cards, chips, neutral study cues) with master volume and mute | DES-MOTION | T1 | M |
| LAYOUT-AUDIT-001 | Automated audit: overflow, clipping, reflow, dead space where reliable | components | T1 | M |

## Phase 3: screens in Style v4 (each: approved mockup first, then build, then owner QA)
Full redesigns first, then foundation passes that keep M2 reworks cheap.
| Order | Screen | Kind | Notes |
|---|---|---|---|
| 1 | Training (quick refresher + long session + feedback) | full redesign | core loop; panels: opener range, session results, plan after answering |
| 2 | Analyze | finish in v4 | spot as sentence, hero answer card, tiles, You here, labelled matrix |
| 3 | Home (+ Study hub if chosen) | redesign | Home = app-wide; Study = coverage, drills, queue, path |
| 4 | Settings | full redesign | all categories, table preview, Chippy and About & legal categories (only when they work) |
| 5 | Review | foundation pass | rail, walkthrough, key moments, luck panel in v4 |
| 6 | Hand | foundation pass | realistic table, input, rail |
| 7 | Full Hand / Orbit table | quality pass | realistic table size, seat buttons, Watch Rest skip |
| 8 | Equity | foundation pass | players, inputs, result in v4 |
| 9 | Personal Strategy | foundation pass | coverage, matrix, edges in v4 |
| 10 | Game night | foundation pass | ledger in v4, Edit, expandable buy-ins |
| 11 | Library / Saved (+ My poker if chosen) | foundation pass | list, inspector |
| 12 | Guide / Learn | foundation pass | until the M2 Learn hub |

## Phase 4: honesty and completeness (alongside phase 3, small tickets)
Trust package (reference measurement, exact maths everywhere, scoped tier labels); persistent storage + guarded "Delete all data"; i18n completeness (RU length, HE RTL with LTR poker data); issue-register M1 items; test hygiene; Hebrew mix-bar decision applied.

## Phase 5: close M1
Owner design pass over every screen (expect correction rounds); optional independent design critique (Gemini Argon) before the pass; RU / HE / Daylight QA; milestone gates (no P0/P1, design standard + audit, clean QA sweep, trust package, i18n); monthly "would I use it by choice?" check.

---

## Owner answers (2026-10-15)
1. **No hard gate:** the trust package is not a hard M1 gate; exact maths and honest labels land in M1, the reference measurement may trail into early M2.
2. **Full Hand table visual pass stays in M1.**
3. **Screen order follows the logical time axis:** screens with big reworks or feature reworks ahead get light foundation passes now; the Manager orders the rest so nothing is done twice.
