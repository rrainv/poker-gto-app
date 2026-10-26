# M1 build plan (draft, 2026-10-22)

Turns the week's decisions into the M1 build. Lanes: **C** = Claude Code (main folder), **A** = Argon (worktree batches of 3–4), **O** = owner. Tiers T0–T3 as in AGENTS.md. Every ticket uses the riverline-design skill and MOCKUP_QA; redesign tickets start by listing what the earlier layouts contained (P1-26). Order matters where noted; otherwise lanes run in parallel.

## M1 goal (unchanged)
A trustworthy, polished base: docs and truth fixed, the design and motion foundation, Training and Settings fully redesigned, Home/Welcome redesigned (owner's new priority), every other workspace on the new foundation (token/layout level), the trust package, i18n complete, a clean QA sweep.

## Phase 0 · Close out (week of 26 Oct) — already ticketed in RETURN_QUEUE.md
| # | Ticket | Lane | Tier | Depends on |
|---|---|---|---|---|
| 0.1 | MERGE-001 (Argon B0–B3) | C | T1 | — |
| 0.2 | TRAINING-F12-001 (+ commit) | C | T1 | 0.1 |
| 0.3 | SKILLS-001 (installs riverline-design draft) | C | T0 | 0.1 |
| 0.4 | DOCS-PHASE1-001 (all decisions + consistency check + brief + third-party register) | C | T0 | 0.3 |
| 0.5 | Argon batch 2: B4 truth surfaces, B5 domain maths, B6 data safety | A | T1 | 0.1 |
| 0.6 | Cross-review of B5 | C | review | 0.5 |
| 0.7 | NOTICES-001 (18+, study tool, rename live mode) | A or C | T1 | 0.4 |

## Phase 1 · Owner decisions at the PC (no agent cost)
O: whose-turn A or C · card back · heading font · Hebrew mix bar direction · Equity A/B (or the new third version) · Learn A/B · kit text notes · drill-mix refinement · Personal Strategy screen refinement · Rust toolchain yes/no · listening page (after AUDIO-RESEARCH / R-06).

## Phase 2 · Foundation (order matters)
| # | Ticket | Lane | Tier | Scope |
|---|---|---|---|---|
| 2.1 | DS-TOKENS-001 | C | T2 | Style v4 tokens: radius 16, padding 22, content max ~1640, button heights 40 / 44–48, weights (650 labels/controls/values…), Daylight values, card size scale, spacing rhythm; remove raw hex and ad hoc sizes where touched |
| 2.2 | MOTION-FOUNDATION-001 | C | T1 | curves, durations, per-moment tempo hook, global Motion setting, keyboard-instant mechanism, 60 fps guards |
| 2.3 | COMPONENTS-001 | C | T2 | shared components with motion: action card + Confirm (select + confirm, one-time prompt), fact tile with derivation, source/tier label, mix bar with "you" tick, verdict (dominance rule), collapsible panel card, bottom sheet, toast, session dots + finish ring, segmented control with thumb, switch, felt + seats (hero at bottom) + card flip; a component sheet page at /__dev/component-sheet.html |
| 2.4 | SHELL-002 | C | T2 | sidebar variant 4 (Home; Study / Tools / Library hubs; Game night apart; footer), context chip (table rules · approach), workspace switch motion, hub screens as skeletons |
| 2.5 | WELCOME-001 | A | T2 | welcome tour A → setup C (3 questions) → first drill B → one hand in Review D; phone + PC; skippable; first-run 18+ line |

## Phase 3 · Full redesigns (prototypes are the spec, numbers from the engine)
| # | Ticket | Lane | Tier | Spec |
|---|---|---|---|---|
| 3.1 | TRAINING-QUICK-001 | C | T2 | quick refresher per prototype CWT6NtfBMxXqQnJ3t6UGjK (PC + phone), five panels, plan locked until answered, keys |
| 3.2 | TRAINING-LONG-001 | C | T2 | long session: table presence, whose-turn (owner's pick), the same components |
| 3.3 | HOME-001 | A (+C review) | T2 | per GkEYuGz7y4rsvRJpH7oLJo: returning and first-visit states; only real data (no invented patterns); evidence gate for "noticed" |
| 3.4 | SETTINGS-001 | A | T2 | all categories: Appearance (themes, cards, text size), Sound & motion (Motion setting), Language, Help & guide, Shortcuts (list; rebinding is M2), Account & data (guarded delete), About & legal; motion moments 32–36 |
| 3.5 | ANALYZE-POLISH-001 | C | T2 | move Analyze onto the new components; one provenance label; "All details"; phone layout per CdAHUhBxo21ZEFQvz6xPdL |

## Phase 4 · Foundation passes (token/layout level only; full redesigns come with M2)
Argon batches of 3–4, each T1 with one Firefox check: REVIEW-FOUND-001 (on the Review mockup's structure, no new features), HAND-FOUND-001, FULLHAND-FOUND-001 (hero at bottom, quality pass items, Watch Rest skip), EQUITY-FOUND-001, PS-FOUND-001, GAMENIGHT-FOUND-001, LIBRARY-FOUND-001 (motion 39–41), LEARN-FOUND-001 (motion 37–38).

## Phase 5 · Trust package and truth (parallel with 3–4)
| # | Ticket | Lane | Tier | Scope |
|---|---|---|---|---|
| 5.1 | GOLDEN-SPOTS-001 | A | T1 | engine-computed fixture used by mockups, lessons and tests (Argon batch 4) |
| 5.2 | EXACT-LABELS-001 | C | T1 | scoped Exact labels everywhere they apply (price only, known cards, push/fold model later) |
| 5.3 | BASELINE-MEASURE-001 | C (+A review) | T2 | free measurement harness (R-01): invariants (monotonicity, blockers, size), exact preflop best response where possible, boundary checks; per-context results; **no third-party charts downloaded or copied**; "Verified" only where tolerances are met |
| 5.4 | SOLVER-PILOT-001 | A | — | optional, if Rust is approved; internal measurement only |

## Phase 6 · Quality to the gate
I18N-COMPLETE-001 (owner reviews RU/HE wording) · A11Y fixes from the audit · DATA-SAFETY (B6) acceptance · test hygiene follow-ups · full QA sweep (T3) · owner's month of "use it by choice" starts.

## Gates (M1)
No open P0/P1 · every in-scope screen meets the design standard and passes the automated audit · clean QA sweep · trust package delivered · i18n complete and natural · notices in place.

## Later in this flow (M2 starts after the gate)
Personal Strategy question flow (approved screen + sweep A), Hand input (HAND-01..07), Review walkthrough, Equity rework, Learn hub + estimation training, Game night rework, Table rules, sticker book, Orbit (M3), sound (after the listening page).
