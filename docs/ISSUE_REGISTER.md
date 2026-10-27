# Riverline issue register

The one register for bugs, findings, debt, pending acceptance and small wants. Feature direction lives in [NORTH_STAR.md](NORTH_STAR.md); the queue in [STATE.md](STATE.md). A guide, not an ultimatum: the owner decides priorities.

Built by DOCS-RESET-001 (2026-10-15) from the Manager's draft (2026-10-07: PRODUCT-QA-SWEEP-2026-10, the owner's UI/UX QA report of 2026-10-02, REPO-WORKFLOW-AUDIT-2026-10, VISUAL-DESIGN-REVIEW-2026-10 and ticket debt since 2026-09-29), merged with the former `QA_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md` (archived under `docs/archive/2026-10/` with full evidence text). Existing IDs are kept; duplicates are merged into one row whose Note names the other IDs.

**How to use:** search by ID; never read the whole file. Add a row for every new issue; change Status in place. Close only with evidence (the fixing ticket and, for visual issues, human acceptance).

Legend. **Sev:** P0 data loss or false money; **P1** blocks a core flow or misleads; **P2** clear quality/usability problem; **P3** polish; `—` for wants and decisions. **Status:** Open · Partial · Fixed (ticket) · Decision (needs owner) · Pending acceptance · Deferred · Won't fix. A status marked *(verified 2026-10-15)* was checked by a quick code search during the reset; *(unverified)* means it was carried over without a check. **MS:** M1 / M2 / M3 / Later / —.

Source keys: **sweep** = PRODUCT-QA-SWEEP-2026-10 · **owner** = owner UI/UX QA report 2026-10-02 · **audit** = REPO-WORKFLOW-AUDIT-2026-10 · **design review** = VISUAL-DESIGN-REVIEW-2026-10 · **indep review** = independent review 2026-10 · **QA** = former QA_BACKLOG · **RQ** = former PRODUCT_RETURN_QUEUE · **HPR** = Hands-On Product Review 2026-08 · **ticket** = debt recorded by a ticket report.

---

## A. Truth, correctness and money

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| QA-SWEEP-001 | sweep | Home Game: empty Cash out recorded a 0 final cash-out, uncorrectable | P1 | Fixed (HOMEGAME-LEDGER-INPUT-001, `5ae58de`); acceptance pending as QA-HOME-GAME-INPUT-001 | — | Typed-0 correctability is HG-002 |
| QA-SWEEP-002 | sweep | Home Game: typed amounts wiped by other seats' actions; Enter did nothing | P2 | Fixed (HOMEGAME-LEDGER-INPUT-001); acceptance pending as QA-HOME-GAME-INPUT-002 | — | |
| QA-SWEEP-023 | sweep | Guest Home Game claimed data saved; dead saved-player/group controls for Guest | P3 | Fixed (HOMEGAME-LEDGER-INPUT-001); acceptance pending as QA-HOME-GAME-INPUT-003 | — | |
| HG-002 | ticket | Typed 0 cash-out must be a correctable recorded fact; existing stuck account sessions need a route | P1 | Decision made (option B: append-only final-state correction record); not built | M1 | = QA-HOME-GAME-INPUT-004 (`HomeGameTransaction v1` amounts must be ≥ 1 minor unit, so the zero fact has no ledger row). Ticket HOMEGAME-ZERO-CASHOUT-001. Persisted-format change needs explicit approval |
| HG-003 | owner | A correction can only be corrected once | P2 | Open *(verified 2026-10-15: the current contract in `HOME_GAME_ORGANIZER_SPEC.md` says a transaction may be corrected once)* | M1 | Corrections must be editable repeatedly; UI says "Edit", ledger stays append-only; changes a contract rule, needs its own ticket |
| HG-004 | owner | Initial buy-in of 0 allowed | P2 | Fixed (TRUTH-FIXES-001); acceptance pending | M1 | Verified open before the fix: the New Session form defaulted the field to `0` and read it with `minimumMinor: 0`. Now the field starts empty (empty = no buy-in), a typed 0 shows an inline "Enter a buy-in greater than zero, or leave it empty." and starts nothing; test in `home_game_ledger_input001.test.mjs` |
| TRAINING-GRADE-TRUTH-001 | indep audit (2026-10) | `training-answer-evaluation.mjs` gave heuristic comparisons `grade: 'mistake'` (and a `comparisonGrade`/`comparisonAccepted` pass/fail); fed Full Hand grade counts, the session grade tally and Training Memory internal evaluations | P0 | Fixed (TRUTH-FIXES-001); acceptance pending | M1 | Non-normative sources now return only a descriptive `comparison` (`matches` / `close` / `differs`, same gap rule as strategy-truth); `grade` is set only for normative assessments (`optimal` / `mistake` as the truth model allows). Full Hand counts are `comparisonCounts`; Training Memory maps legacy stored `comparisonGrade` values. Tests `truth_fixes001_training_grading.test.mjs`. Persisted evaluations keep their old fields (history is not rewritten) |
| QA-SWEEP-003 | sweep | Analyze typed 2.5 became 25 (decimal eaten) | P1 | Fixed (DECISION-INPUT-TRUTH-001, `da78be7`); acceptance pending as QA-DECISION-INPUT-001 | — | |
| QA-SWEEP-004 | sweep | "facing 0 bb · 1 bb to call" wording | P2 | Fixed (DECISION-INPUT-TRUTH-001); acceptance pending as QA-DECISION-INPUT-003 | — | |
| QA-SWEEP-008 | sweep | Replay header showed live pot/actor vs frame | P2 | Fixed (DECISION-INPUT-TRUTH-001); acceptance pending as QA-DECISION-INPUT-004 | — | |
| QA-SWEEP-027 | sweep | Action-panel jargon ("amount-to") | P3 | Fixed (DECISION-INPUT-TRUTH-001); acceptance pending as QA-DECISION-INPUT-006 | — | |
| QA-SWEEP-007 | sweep | Language switch turned Training source into "Source unavailable" | P2 | Fixed (LANGUAGE-SWITCH-EVENT-001, `a0bc491`); acceptance pending as QA-LANGUAGE-SWITCH-002 | — | |
| OWNER-12 | owner #12 | Strategy adjustment sliders appear to do nothing | P1 | Fixed (TRUTH-FIXES-001); acceptance pending | M1 | The "Strategy adjustment" disclosure is `hidden`; `STRATEGY_ADJUSTMENT_ENABLED = false` keeps `readHeuristicOptions` at baseline so stored tightness values (kept intact) cannot silently change strategy while hidden. Re-enable with the M3 adjustment engine (NORTH_STAR §7.3) |
| OWNER-17 | owner #17 | Randomized spot table incoherent (pot 6 bb, all stacks 100 bb), no history | P1 | Partial (TRUTH-FIXES-001: short-term honesty) | M1 | Scenario table now shows Hero's stack only in Hero-stack mode; every other stack renders `?` ("Stack unknown in this Scenario"); label reads "Approximate Scenario view · only the facts you entered". Remaining: coherent generated spots and action history (spot generator contract, NORTH_STAR §6.2) |
| QA-DECISION-INPUT-009 | ticket | Equity "Random {street} ready." status not tied to its stage; Training Memory panel still says "Facing N bb" | P3 | Fixed (LOCALE-NUMBERS-001 on `argon/m1-batch-3`; Saved part by SAVED-COMPOSITION-002) | M1 | Equity status tied to the card stage (not lifecycle), re-worded on language switch; Training Memory rows use the facing summary. `tests/locale_numbers001.test.mjs` |
| REF-DEBT-001 | recovery review | Analyze reference heading can use a provider-declared display name and drops localization | P2 | Open | M3 (before any real reference) | Must be fixed before registering any reference |
| QA-ANALYZE-COMPOSITION-004 | ticket | Mix-bar RTL fix applied only to Analyze; Training mix rows still broken in HE | P2 | Open (Analyze part fixed in uncommitted ANALYZE-COMPOSITION-001) | M1 | Decide D-13 (HE mix bar direction) first |
| REVIEW-MATH-03 | indep review | Estimated mixes shown at 1% precision; trace actions shown | P2 | Fixed (TRUTH-SURFACES-002 + MERGE-002), pending owner acceptance | M1 | Estimated mixes rounded to 5% and actions under 5% hidden across Analyze, Training feedback, and Hand Review without mutating StrategyResult or Review data; exact mixes stay unrounded (NORTH_STAR §7.3). REVIEW-BATCH2 found Explain still used a private 95/70/10 four-state shape and 1% values; MERGE-002 moved Explain onto the shared two-state verdict (`describeAnalyzeVerdict`) and `presentStrategyMixActions` at every depth. Rounding code still has three copies (`MIX-ROUNDING-OWNER`) |
| QA-AUDIT-HAND-ANALYZE-STACK-001 | QA (audit) | Hand → Analyze may transfer the wrong stack/economics snapshot | P1 | Open, needs reproduction | M1 | RET-AUDIT-HIGH-RISK-REPRO-001 |
| QA-AUDIT-HAND-REVIEW-PRIORITY-001 | QA (audit) | Hand Review priority metrics may disagree across displayed values | P2 | Open, needs reproduction | M2 (Review rework) | RET-AUDIT-HIGH-RISK-REPRO-001 |

## B. Layout, density and stability (systemic)

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| OWNER-2/3/8/9/10 | owner | Oversized panels and dead space app-wide (Home, Home Game, Personal Strategy, Training post-answer, Full Hand) | P2 | Open | M1 | Comfort contract; covers QA-SHELL-006 sparse 1920 layouts, QA-LAYOUT-001 |
| OWNER-14/15/16 | owner | Over-compression: tab outlines and rail borders cut into text; stepper cramped | P2 | Open | M1 | One inset scale for tabs/rails/panels |
| OWNER-12-REFLOW | owner | UI reflows when inputs change (app-wide) | P2 | Open | M1 | Reserved heights, stable dimensions (stability rules) |
| OWNER-2b | owner | Load flicker: sidebar leaf, character images pop in; "Enter Riverline" hover flicker | P2 | Open | M1 | App-ready gate, preloading, hover without layout change |
| OWNER-11 | owner | Card slot sizing inconsistent (hero larger than board/dead) | P2 | Open | M1 | Card size scale by context |
| OWNER-18 | owner | Stepper/mini cards cut off or positioned too high | P2 | Partial (Analyze stepper mini cards reworked in uncommitted amendment 2) | M1 | Shared card rules |
| OWNER-19 | owner | "Heuristic fallback" shown 3–4 times on one page | P2 | Fixed (TRUTH-FIXES-001, TRUTH-SURFACES-002) | M1 | One provenance indicator per surface: header `#strategySourceStatus` hidden on Analyze, Training, Hand Review, and Personal Strategy; each surface renders one provenance eyebrow (`Heuristic baseline · Estimated · <Street>`) above its verdict/feedback/review/comparison |
| OWNER-20 | owner | Explain leaves dead space under columns | P3 | Open | M1 | Adaptive to content; see QA-ANALYZE-COMPOSITION-002 |
| OWNER-1 | owner | Sidebar header arrow and text end at the same point | P3 | Open | M1 | Shell rework |
| QA-SHELL-002 | QA | Legacy `[dir="rtl"] header` double-flip still affects other headers (Home/Saved section heads, Review "Review Mistakes") | P2 | Open *(verified 2026-10-15: rule at `app/styles.css` ~L4955)* | M1 | Small RTL repair or SHELL-002 |
| QA-SHELL-003 | QA | Hand status line still above workspace | P3 | Open (fixed for Analyze) | M1 (Hand foundation) | |
| QA-SHELL-004 | QA | Training shows its own "Heuristic fallback" labels besides the header badge | P3 | Fixed (TRUTH-SURFACES-002) | M1 | Training feedback now shows a single provenance eyebrow above the verdict; redundant header badge, side source line, reference summary, and grade badge are hidden |
| QA-SHELL-005 | QA | Unaudited states for the one-accent rule (Full Hand states, Saved detail, Personal inner) | P3 | Open | M1 | LAYOUT-AUDIT-001 |
| QA-SHELL-006 | QA | Home, Saved, Training sparse at 1920 in the wide frame | P2 | Open (Saved addressed by SAVED-COMPOSITION-002) | M1/M2 | Merged into OWNER-2/3/8/9/10 |
| QA-SHELL-007 | QA | Home tour step 1 uses Guest wording for signed-in users; empty context lines | P3 | Open | M2 | Home redesign |
| QA-SHELL-008 | QA | Layouts under 820 px unchecked | P3 | Open | Later | Mobile out of scope; desktop minimum 1366×768 |
| DS-FOUNDATION-005 | QA (= QA-DS-FOUNDATION-005) | Un-migrated component families (shell nav, Hand legal-action buttons, fact strips, Personal/Training tabs, Equity fields, Settings choice cards); ~225 literal font sizes | P2 | Open | M1 (per screen) | DS-COMPONENTS-V4 |
| DS-CSS-DEBT | QA (= QA-DS-FOUNDATION-006, QA-ANALYZE-COMPOSITION-003) | `CLEANUP-PREP-001` removed 106 redundant `!important` declarations (including all 44 in retired legacy theme blocks; 167 remain), replaced 48 exact-match colours/fallbacks with `:root` tokens, and fixed F04/F06; remaining: ~710 relocated surface lines at the end of `styles.css`, inline `<style>` in `index.html`, legacy Analyze rules kept for old tests, preset colours duplicated in CSS and theme JS (guarded by a test) | P3 | Open | M1 | CLEANUP-PREP-001 (partial) |
| MOTION-DEBT | audio recon | Two competing CSS duration scales; no in-app reduced-motion toggle | P3 | Open | M1 | MOTION-001 |

## C. Screen-specific findings

### Hand / Replay / Table

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| QA-SWEEP-009 | sweep | Setup preview table oversized, Hero off-screen, layout jumps on Start | P2 | Open | M1 (Hand foundation) | |
| QA-SWEEP-017 | sweep | Street/status label drawn under top seat's cards | P3 | Open | M1 | |
| QA-SWEEP-018 | sweep | Seat panels translucent (rail shows through) | P3 | Open | M1 | |
| QA-SWEEP-019 | sweep | Stack text overflows seat (Full Hand) | P3 | Open | M1 | |
| QA-SWEEP-020 | sweep | Normal pre-hand state shows orange "Hand mode unavailable" warning | P3 | Open *(unverified: exact string not found by search)* | M1 | |
| QA-SWEEP-021 | sweep | Native selects cut off values (RU/EN) | P3 | Open | M1 | |
| HAND-WANT-1 | owner want | Bet-size presets, showdown winner line, keyboard actions, "everyone else folds" | — | Planned | M2 | NORTH_STAR §7.5 |
| RET-TABLE-001 | RQ | Dense/10-max geometry: lower side panels slightly too far inward, top player slightly too far outward/high; hidden backs may later tuck under their owner only if privacy/ownership/inspectability hold; full-ring Dealer presence without a fake dealer | P3 | Open (accepted checkpoint debt) | M1 (Hand foundation / Full Hand quality pass) | Also QA-TABLE-001, QA-HANDSON-015, QA-UI-005, QA-TABLE-VNEXT-001 |
| RET-CARDS-THEMES-001 | RQ | Revealed opponent cards can be obscured by seat/action chrome; broader card/theme/layout comfort polish | P3 | Open (accepted checkpoint debt) | M1 | Also QA-HANDSON-021, QA-CARD-001, QA-CARD-002, QA-CARD-003 |
| RET-REVIEW-NAV-001 | RQ | History rail micro-polish: padding, font weight, contrast, density, event rows | P3 | Open | M1 (Review foundation) | Accepted rail architecture is not reopened |
| QA-COLLAPSE-001 | QA | Table collapse compact state: Firefox acceptance open | P3 | Partial | M1 | |

### Analyze

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| OWNER-16-STEPPER | owner | Action header (stepper) readability: competing fonts, cramped "Turn Waiting for turn…" | P2 | Partial (uncommitted ANALYZE-COMPOSITION-001 reworks the stepper) | M1 | |
| OWNER-13 | owner | Game & accounting limited to Home/ClubGG presets | P2 | Planned | M2 | Table rules v1 (NORTH_STAR §6.1); also RET-HPR-GAME-SETUP-001 |
| ANALYZE-OPP | ticket | "Opponent assumptions" disclosure not built (no data) | P3 | Open | M3 | |
| QA-ANALYZE-COMPOSITION-002 | QA | Explain collapsed by default leaves an empty region under the Result panel at 1920 | — | Decision made: stays collapsed (owner) | — | Dead-space concern remains under OWNER-20 |
| GEOMETRY-TOOL | ticket | `verify_product_ui002r3_geometry.cjs` still probes the removed Betting context strip | P3 | Open | M1 | Test hygiene |
| RL-05 | QA | Playbook long-page / analysis-location composition | P3 | Open | M1 (Analyze finish) | Likely superseded by the v4 Analyze |
| RL-06 | QA | 169 unavailable postflop Matrix cells | P3 | Open | M2 | |
| RL-07 | QA | Range comparison stacking / long-page comparison | P3 | Open | M1 (Analyze finish) | |
| QA-AUDIT-RANGE-COMPARISON-INTERACTION-001 | QA (audit) | Range comparison hover/focus may be inconsistent or inaccessible | P2 | Open, needs reproduction | M1 | RET-AUDIT-HIGH-RISK-REPRO-001 |

### Training

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| OWNER-9 | owner | Post-answer panel huge; hides cards and position | P2 | Open | M1 (Training redesign) | |
| OWNER-10 | owner | Full Hand: visual bugs, text alignment, spacing, oversized panels | P2 | Open | M1 | Full Hand quality pass |
| QA-SWEEP-010 | sweep | Full Hand lineup tiles: names clipped, run together with position/behaviour | P2 | Fixed (FULLHAND-QUALITY-001 on `argon/m1-batch-3`); acceptance pending | M1 | Cause: the opponent text sits inside the seat button, outside the `li > div` grid rule, in a ~50 px column. Tiles now stack name / position / behaviour; 48 px portraits |
| QA-SWEEP-026 | sweep | Training Memory: "No decisions recorded" above decisions; cards as text | P3 | Open | M1 | |
| TM-RAW-ID | ticket | Training Memory panel shows raw `source@version` | P3 | Open | M1 | |
| QA-SWEEP-030 | sweep | Full Hand header stays "Make the decision" through summary and Review | P3 | Fixed (FULLHAND-QUALITY-001 on `argon/m1-batch-3`); acceptance pending | M1 | Heading follows state and phase: Your hand summary (Hero folded), Watching the rest of this hand, Hand Complete, Post-Hand Review, Session complete |
| QA-SWEEP-028 | sweep | Native `window.confirm` dialogs (unstyled, blocking, partly untranslated) | P3 | Open *(verified 2026-10-15: present in `logic.js`)* | M1 | |
| WATCH-REST | sweep / owner | Watch Rest takes ~45–55 s with no speed/skip | P2 | Partial: skip fixed (FULLHAND-QUALITY-001 on `argon/m1-batch-3`); speed open (M2) | M1 (skip) / M2 (speed) | = WANT-WATCH-SPEED. "Skip to end" plays the remaining canonical events without pacing or motion |
| RET-TRAIN-001 | RQ | Training does not generate the exact calibrated BB-vs-BTN node; no cold-4bet / opener-facing-cold-4bet targets | P3 | Deferred | M2/M3 | Do not fabricate families to cover them |

### Equity

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| OWNER-7 | owner | Layout breaks at 5+ players; full-width "Add player"; duplicate result panels; IA needs rework | P2 | Planned | M2 (rework); M1 foundation fixes | |
| QA-SWEEP-005 | sweep | Spade mini-cards invisible in Runout Explorer | P2 | Open *(verify; may be fixed by DS card rules)* | M1 | |
| QA-SWEEP-006 | sweep | Card-outcome preview positioned off-screen | P2 | Open | M1 | |
| QA-SWEEP-031 | sweep | Precision mismatch (27.05% vs 27.1%), chip-style cards, mislabelled range select | P3 | Open | M2 | |
| EQ-LOCALE | sweep | Numbers use Russian formatting in English mode | P3 | Fixed (LOCALE-NUMBERS-001 on `argon/m1-batch-3`) | M1 | Cause: bare `toLocaleString()` (OS locale). One formatter `app/src/application/locale-number-format.mjs`; remaining pre-formatted numbers: LOCALE-NUMBERS-002 |

### Personal Strategy

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| OWNER-8 | owner | Panels too long/large; whole tab needs work | P2 | Planned | M2 (rework); M1 foundation | |
| QA-SWEEP-011 | sweep | Raw JSON, UUIDs, fingerprints in disclosures | P2 | Open | M1 | |
| PS-TENTATIVE | sweep | Copy says answers "don't fill in nearby hands" while neighbours show Tentative | P3 | Open | M1 | |
| PS-MATRIX-CONTRAST | sweep | Range matrix strategy colours faint | P3 | Partial (Analyze fixed) | M2 | |
| PS-MATRIXEDIT-TERMS | sweep | Matrix Edit status labels don't match Understanding terminology | P3 | Open | M2 | |

### Saved

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| OWNER-5 | owner | Hover adds almost no information; tag system needs rework | P2 | Planned | M2 | |
| OWNER-6 | owner | Training history bubbles ("Revisit due…") display issues; "Answered" column cut off | P2 | Open | M1 | |
| QA-SAVED-COMPOSITION-004 | QA | Search doesn't cover auto-titles (cards, positions, street) | P3 | Open | M2 | |
| SAVED-FELT | design review | Inspector felt card preview from the mockup; richer header context line | P3 | Open | M1 | |
| RET-HOME-001 | RQ | Saved retrieval beyond 200 (cursor pagination), poker-dimension filters, new payload kinds | P3 | Deferred | M3/Later | Returns when a real library nears the bound |

### Home / Study Inbox / onboarding

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| QA-SWEEP-012 | sweep | Welcome focus escapes to hidden content under the overlay | P2 | Open | M1 | |
| QA-SWEEP-025 | sweep | Study Inbox: nested duplicate disclosure, generic "Saved"/"Open source" | P3 | Open | M2 | |
| REPO-AUDIT-003 | audit | Home Personal Strategy card promised in spec, no DOM target; dead query on every Home load | P2 | Open | M2 (Home redesign decides) | |
| QA-SWEEP-032 | sweep | Defensive/meta copy in Settings/Guide; dash typo in Guide intro | P3 | Open | M1 | |

### Game night (Home Game)

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| OWNER-4 | owner | Blinds optional, per-player buy-ins missing, player configuration needs rework | P2 | Planned | M2 (rework); 0 buy-in in M1 | |
| HG-GLYPH | owner screenshot | ₪ renders as an empty box (font lacks glyph) | P3 | Open | M1 | |
| HG-SEATS | owner screenshot | Seat cards noisy (empty fields, big name blocks) | P2 | Planned | M2 | |
| RET-HOMEGAME-001 | RQ | Stronger imbalance prominence, denser presentation, real-provider/full Firefox acceptance; hard delete/import stay deferred for missing safety contracts | P3 | Open | M2 (Game night rework) | Also QA-HOME-GAME-001A-001; HOME-GAME-PRESENTATION-001 |

### Settings / Guide / i18n

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| QA-SWEEP-016 | sweep | Card picker: 52 Tab stops, no arrow navigation, ArrowDown scrolls the page | P2 | Fixed (A11Y-KEYS-001 on `argon/m1-batch-3`); acceptance pending | M1 | Deck is one roving Tab stop; arrows move by suit row / rank column (visual direction in RTL), skipping unavailable cards; Home/End, Ctrl+Home/End; arrow keys are consumed inside the picker; Enter/Space stay native; Escape closes |
| A11Y-MATRIX-KEYS | ticket | 13×13 matrices: 169 Tab stops, no arrow navigation, gridcells without rows | P2 | Fixed (A11Y-KEYS-001 on `argon/m1-batch-3`); acceptance pending | M1 | Strategy matrix and both Range Category Comparison grids: `role=row` wrappers (`display: contents`), one roving Tab stop, arrows/Home/End/Ctrl+Home/End (physical; matrix never mirrored), 2px `--border-focus` ring; the Analyze `.matrix-wrap` is no longer a second stop. Labels already carried hand + kind + state |
| QA-SWEEP-022 | sweep | Untranslated strings ("Random private cards ready", "Training Memory" in RU prose) | P3 | Fixed (LOCALE-NUMBERS-001 on `argon/m1-batch-3`) | M1 | The key was translated; the status kept its old language after a switch. Status now re-worded (street included); RU prose uses «история тренировок» / «подход» |
| QA-LANGUAGE-SWITCH-003 | QA | ~45 elements carry static `data-i18n` keys overwritten by code (latent stale text) | P2 | Partial (LOCALE-NUMBERS-001 on `argon/m1-batch-3`) | M1 | 11 keys removed (Analyze status/live/saved-spot/style labels, Hand setup); Training state badge and error copy re-worded on switch. ~45 remain (Hand live stage, Training, account, calibration, Matrix/Range idle copy): each needs a verified code re-render at boot and on switch before its key goes |
| LOCALE-NUMBERS-002 | LOCALE-NUMBERS-001 | Numbers still pre-formatted in English: `analysis-explanation.mjs` `percent()`/`bb()` values interpolated into Explain text, `heuristic-strategy.mjs` explanation percents (logic.js re-formats its own copy), `gameStateUpdate` pot (`logic.js`) | P3 | Open | M1 | Needs language at explanation creation or formatting at render; not a one-line swap |
| OWNER-I18N | owner | Translation quality, poker terminology, overflow, RTL as an app-wide requirement | P2 | Planned | M1 (completeness) / later (native polish) | Apply [TERMINOLOGY.md](TERMINOLOGY.md); also RET-I18N-001, QA-I18N-001/003/004 |
| I18N-TERMS-RESIDUE | I18N-TERMS-001 | Old terms outside the locale catalogs: RU фолд (30) and HE טווח (41) in `app/src/application/*-language.mjs` / `app/src/personal-strategy/*.mjs`; EN "Guest Home Game sessions" sentence lives in a key (`account-translations.js`, audit treats account EN values as visible keys); shadowed `i18n.js` RU `"Clear": "фолд"` (resolves to «Очистить»); RU Hero «Герой»/«Игрок» vs sheet «Hero»; HE Value «ערך» vs sheet «ואליו»; HE "Open …" guide buttons still noun form (פתיחת …) | P3 | Fixed (I18N-RESIDUE-001 on `argon/m1-batch-1`) | M1 | Preserved `перефолд` input alias in `intent-interpretation.mjs` and numeric `טווח` in `i18n.js` / `analysis-translations.js` |
| I18N-HE-FOLD | MERGE-001 | HE Fold still «קיפול» (24 matches: `exploit-*-language.mjs`, `exploit-review-workspace.mjs`, `personal-strategy-hand-workspace.mjs`, `study-language.mjs`, `node-coach.mjs`, `i18n.js`) vs TERMINOLOGY.md «פולד»; not in I18N-TERMS-RESIDUE's listed scope | P3 | Open | M1 | Check input parsing before changing |
| TEST-SAVED-COMP-002 | I18N-TERMS-001 | `tests/saved_composition002.test.mjs` "Training history keyboard browsing coalesces the Saved lookup…" fails (expected 1, actual 0) | P3 | Open | — | Fails identically on `codex/stabilization` `f18b6be`; unrelated to i18n |
| RET-I18N-001 | RQ | Human linguistic/visual acceptance across checkpointed surfaces; new visible tickets own their translations | P2 | Open | M1 (gate 5) | |
| RET-RESP-001 | RQ | Human Firefox acceptance at 1366×768 plus representative 1080p/1440p/1600p/4K, themes, zoom, RTL | P2 | Open | M1 (gate 2) | Also QA-RESP-001; 1024×768 stays future evidence |
| QA-MICRO-001 | QA | Settings/utility icon alignment needs a final pass | P3 | Open | M1 | |
| QA-MICRO-002 | QA | Action-colour palette needs a final restrained consistency review | P3 | Open | M1 (DES-STYLE) | |
| QA-MICRO-003 | QA | Awkward near-black inset surfaces need a final token review | P3 | Open | M1 (DES-STYLE) | |

## D. Repository, tests, docs and workflow

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| WIP-BACKUP | manager | Uncommitted Analyze work (+ amendments) only in the working tree | P1 | Fixed (WIP-BACKUP-001: `wip/analyze-composition-2026-10` @ `956ca6e`) *(verified 2026-10-15)* | — | Acceptance is ANALYZE-ACCEPT |
| REPO-AUDIT-001 | audit | Docs vs commits disagree on acceptance | P1 | Fixed (docs reset `d1c826e`; D-01 resolved by the owner 2026-10-15, §G rows updated in TRUTH-FIXES-001) | M1 | |
| REPO-AUDIT-002 | audit | Personal Strategy local v2 vs remote v1 sync contract; RET-ACCOUNT-003 mislabelled | P1 | Decision | Later | Account work; see RET-ACCOUNT-003, QA-MODERNIZATION-SYNC-001 |
| REPO-AUDIT-004 | audit | Electron test in CI glob | P2 | Fixed (REPO-HYGIENE-001, `1e23638`) | — | |
| REPO-AUDIT-005/006/007/008 | audit | Stale ACTIVE NEXT, undocumented checkpoints, stale claims, unreadable planning docs | P2 | Fixed (DOCS-RESET-001, uncommitted): one status file, archived history | — | |
| REPO-AUDIT-009 | audit | ~98 test files assert source text of `logic.js`/CSS; copied `sourceBetween` helpers | P2 | Partial (TEST-HYGIENE-001, branch `cloud/TEST-HYGIENE-001`): the 138 test files that asserted raw `logic.js`/`styles.css`/`index.html` text now test behaviour (parsed markup, a CSS cascade model, and the booted app via `tests/helpers/app-under-test.mjs`); checks with no behavioural observable are marked `// SOURCE-SHAPE:` (28 files, mostly parsed-CSS policy lints). TEST-HYGIENE-001-FIX (independent review `REVIEW_TEST_HYGIENE.md`): Windows paths fixed (the suite ran 114 failures on Windows); page listener errors now fail tests; dead guards/tautologies removed (review mutations M2–M4 were missed, all 5 now caught); harness fidelity hardened (click/focus actionability, stylesheet visibility, `<select>`, constraint validation, logical CSS sides by direction, unparseable selectors reported, IndexedDB transaction activation, duplicate `on*` dispatch removed), with self-tests in `tests/test_hygiene001_harness.test.mjs`. Remaining: the shared vm-slice adapters `tests/qa001_adapters.js`, `tests/qa002_adapters.js`, `tests/bug003_adapters.js`, `tests/uiqa001r_card_picker_adapter.mjs` still build harnesses from `logic.js` slices | M1 | Test hygiene; per-extraction rule; owner acceptance pending |
| REPO-AUDIT-010 | audit | `logic.js` ~14k lines; next extraction candidates: Home rendering, Training Memory panel, Equity results | P2 | Open | M1/M2 | Follow redesigns; also RET-ARCH-001, QA-UI-COMPOSITION-ROOT-001 |
| REPO-AUDIT-011 | audit | UI-side poker helpers (handClass, preflopBasePot, strategyAccountingContext, SPR) | P3 | Partial (`DOMAIN-MATH-001` moved pot-before-action, SPR, and MDF into `shared/poker-domain` selectors and replaced display-string bet-amount parsing in `trainingActionHistoryForAnalysis` with numeric `amountBb`/`amountMilliBb` in the presentation model) | M2 | Move remaining helpers to the shared domain when touched |
| REPO-AUDIT-012 | audit | 22 unused exports | P3 | Open | M1 | |
| REPO-AUDIT-013 | audit | Root artifacts; `server.py` unused; root package-lock coupled to a test; empty reference-data dir; `.claude/*.lock` not ignored | P3 | Partial *(verified 2026-10-15: `.gitignore` has no `.claude` entry)* | M1 | Owner decisions pending; `.gitignore` is protected |
| REPO-AUDIT-014/015 | audit | Line endings; Node/Python versions | P3 | Fixed (REPO-HYGIENE-001) | — | |
| REPO-AUDIT-016 | audit | Workflow docs vendor-specific/contradictory; no minimum read set | P2 | Fixed (DOCS-RESET-001, uncommitted): new AGENTS.md with minimum read set | — | |
| REPO-AUDIT-017 | audit | `.git` 71 MB from retired ONNX blobs | P3 | Won't fix | — | Don't rewrite history |
| TEST-DIT001-PREEXIST | tickets | Two `decision_input_truth001` tests were already failing at HEAD before later tickets | P3 | Fixed *(verified 2026-10-17, TEST-HYGIENE-001: `decision_input_truth001` passes alone and in the full suite after its behavioural rewrite)* | M1 | Test hygiene |
| TEST-TUTORIAL002-PREEXIST | ticket (PERSONAL-STRATEGY-INTELLIGENCE-001 report) | `tutorial002_current_app_coverage.test.mjs` had 2 pre-existing failures: Home Guest data sentence missing from the tutorial locale catalog; Training feedback assertion expects the old universal-optimality sentence | P3 | Fixed *(verified 2026-10-17, TEST-HYGIENE-001: `tutorial002_current_app_coverage.test.mjs` passes alone and in the full suite)* | M1 | Test hygiene |
| FLAKY-SAVED-KEY | tickets | Saved keyboard test fails under parallel load (seen 3×) | P2 | Fixed — no code change (SAVED-KEY-FLAKE-001 on `argon/m1-batch-3`): reliable on 2026-10-27, 10/10 alone and 4/4 under the full suite (`--test-concurrency=4`, 2802 tests); the 2026-10-17 deterministic failure no longer reproduces. The test drives the debounce with fake timers (`flushTimers`), no sleeps; what changed since 2026-10-17 was not bisected | M1 | Reopen if it fails again |
| EVIDENCE-ARCHIVE | recovery | `full_diff.patch`, `status.txt`, `%TEMP%` recovery snapshot (ACL-denied) and logs need a durable archive | P3 | Open | M1 | `Riverline_archive` folder outside the repo |
| RET-TEST-INFRA-001 | RQ (= QA-PERF-004) | Highly parallel full-suite runs can trip a `<100ms` wall-clock assertion | P3 | Partial *(verified 2026-10-15: analysis-range timing fixed in `1e23638`; `tests/range_cal002b_validation.test.mjs` still asserts `< 100` ms. 2026-10-17 TEST-HYGIENE-001: documented full-suite command caps `--test-concurrency=4`; full run 2731 tests, no wall-clock or `range_cal001b` failures)* | M1 | Do not loosen thresholds casually |
| TEST-HYGIENE-001-F01 | ticket (TEST-HYGIENE-001) | Dead CSS: `.equity-scenario`, `.equity-headline`, `.equity-scenario-context`, `.equity-result-summary`, `.equity-results-panel`, `.equity-output-stack` match no markup; the EQUITY-UX-001R 1080p compact block is inert | P3 | Open | M1 | Found converting `equity_ux001r`/`premium_layout001`; CSS cleanup ticket. Live-DOM guarantee kept as a `todo` test in `equity_ux001r_presentation` (TEST-HYGIENE-001-FIX) |
| TEST-HYGIENE-001-F02 | ticket (TEST-HYGIENE-001) | Dead code: `renderHomePersonalStrategy` targets `#homeStrategyContent`, removed from `index.html` by SHELL-001 | P3 | Open | M1 | Found converting `home001` |
| TEST-HYGIENE-001-F03 | ticket (TEST-HYGIENE-001) | Inert rule: `.home-dashboard-grid` `grid-template-areas` ("continue quick" / "recent recent") is overridden to `none` / one column | P3 | Open | M1 | Found converting `home001` |
| TEST-HYGIENE-001-F04 | ticket (TEST-HYGIENE-001) | CSS defect: at ≤1100px the Hand private-cards/reveal "context rail first" `order` override (specificity 1,3,0) loses to the generic `[data-hand-stage]:not([data-hand-stage="setup"])` rule (1,4,0); effective order is decision 1, rail 2 | P2 | Fixed (CLEANUP-PREP-001; MERGE-001 restored `[data-hand-stage]` on the live-stage rule, so a Hand with no stage yet keeps setup order, and excluded private-cards/reveal instead; todo tests promoted) | M1 | Found converting `premium_layout001`, `core_flow001b_hand_stage` (SOURCE-SHAPE there converted to cascaded order in MERGE-001) |
| TEST-HYGIENE-001-F05 | ticket (TEST-HYGIENE-001) | Superseded rules: PREMIUM-LAYOUT-001 Analyze 3-col (≥1500px), Hand rail 280–320px, `#visual-table-container` 900px, Equity rail tokens are all overridden by later blocks | P3 | Open | M1 | Tests now assert the effective values |
| TEST-HYGIENE-001-F06 | ticket (TEST-HYGIENE-001) | CSS defect: Analyze dead-card header intended grid (`minmax(0,1fr) auto auto`, ANALYZE amendment 2) is overridden to flex by `html[data-layout-preset] … .playbook-cards-panel .section-head` (1,4,1 > 1,3,1); its grid-column placements are inert | P2 | Fixed (CLEANUP-PREP-001; promoted from todo to normal tests in MERGE-001) | M1 | Found converting `ui_density001` |
| AUTH-UMD-LOAD-001 | MERGE-001 | `ensureSupabaseUmdScript` (CLEANUP-PREP-001) awaits script load/error with no timeout inside a module top-level await, so a stalled request blocks the auth bridge (and anything awaiting that module); if the tag already exists but is still loading it resolves `false` immediately (sign-in unavailable). Rare in browsers (a 404 fires error); a stalled request would hang | P3 | Open | M1 | Harness now fails skipped scripts appended at runtime (`tests/helpers/browser-app.mjs`) |
| MIX-ROUNDING-OWNER | MERGE-002 | Three copies of the estimated-mix 5% rounding: `presentStrategyMixActions` (`app/src/application/analyze-verdict.mjs`, the intended owner), `strategyResultPresentationActions` in `app/src/core/logic.js`, and the `Math.round(p * 20) * 5` fallback in `renderAnalyzeVerdict` (`logic.js`) | P3 | Open | M1 | Make `logic.js` call the bridge (`RiverlineAnalyzeVerdict.presentMixActions`) and delete its copies; Explain already uses the owner |
| DOMAIN-MATH-FOLLOWUPS | REVIEW-BATCH2 (B5) | Optional DOMAIN-MATH-001 follow-ups: `analysis-explanation.mjs` still computes SPR inline instead of the shared selector; MDF unit normalization (fraction vs percent) is not uniform across callers; duplicate/near-duplicate selector names in `shared/poker-domain/selectors.js` | P3 | Open | M1/M2 | Optional; do when the files are next touched |
| TEST-HYGIENE-001-F07 | ticket (TEST-HYGIENE-001) | Dead CSS: 7 rules (incl. the POLISH-FINAL-001 entrance rule) target `.equity-player-results`, which nothing renders | P3 | Open | M1 | Found converting `equity_composition001`, `polish_final001`. The completed-result entrance guarantee is a `todo` test on the rendered `.equity-player-footer` in `polish_final001` (TEST-HYGIENE-001-FIX) |
| TEST-HYGIENE-001-F08 | ticket (TEST-HYGIENE-001) | Dead code: `renderChart`'s per-cell "provider-backed postflop Matrix deferred" label is unreachable (postflop returns early) | P3 | Open | M1 | Found converting `strategy_integrity001b` |
| TEST-HYGIENE-001-F09 | ticket (TEST-HYGIENE-001) | Dead CSS: `.solver-import-btn` (nothing renders it) | P3 | Open | M1 | Found converting `uiqa001` |
| TEST-HYGIENE-001-F10 | ticket (TEST-HYGIENE-001) | Dead CSS: `.calibration-account-required-state` (class removed from markup in `fa0d3b8`; the guest state is a status panel) | P3 | Open | M1 | Found converting `account002ar2` |
| TEST-HYGIENE-001-F11 | ticket (TEST-HYGIENE-001-FIX) | Owner to confirm: the design-system pass (`71b7ccb`) superseded two EQUITY-COMPOSITION-001R invariants: the player list is no longer a 654px vertically scrolling 2-up list (`#equityMode .equity-player-list` sets `max-block-size: none; overflow: visible`, so the gallery grows with the page), and tiles now carry a series-coloured top border (`border-block-start: 2px solid var(--series-color, …)`; the old regex missed it because of the `var()` fallback) | P3 | Open — owner decision | M1 | `equity_composition001` asserts the current values explicitly so any change is noticed |
| TEST-HYGIENE-001-F12 | ticket (TEST-HYGIENE-001-FIX) | Product defect: after a bounded Varied session completes, starting another Varied session (New Hand) keeps `data-training-session-complete="true"` on `.training-workspace` (the Varied start path in `logic.js` never calls `clearTrainingSessionCompletion()`, unlike Focused), so `styles.css` hides `#trainingGuessButtons` and the prompt: the new session cannot be answered. TRAINING-F12-001 found Same Spot and Revisit had the same defect (a completed Varied session is not "active", so they could open over it) | P1 | Fixed (TRAINING-F12-001); accepted (owner, 2026-10-26) | M1 | `startConfiguredTrainingSession` clears completion for every non–Full Hand start (Full Hand clears it itself after folding the finished hand into Memory); `openTrainingMemorySameSpot` clears it before beginning (Same Spot + Revisit); Similar Spot already cleared via `clearTrainingSessionState`. Tests: `training_f12_session_restart` (one per start path; Varied, Start another session, Same Spot, Revisit fail without the fix) and the former `todo` in `training_varied_session001`. Browser: built-in pane 1920 EN Midnight (finish Varied → start Varied → answered); Firefox: both flows OK (owner, 2026-10-26) |
| TEST-HYGIENE-001-F13 | ticket (TEST-HYGIENE-001-FIX) | Product defect: after a Full Hand, "Adjust drill" opens Session setup and focuses `#trainingHeroPos`, but the completed-phase rule hides every setup field except the mode switch and compact controls, so focus falls to `<body>` and nothing editable is shown | P2 | Fixed (TRAINING-F12-001); accepted (owner, 2026-10-26) | M1 | `setTrainingSetupExpanded` focuses the mode's field when shown, else the pressed mode button (after a Full Hand: "Full Hand"), else the first shown setup control (owner amendment). Former `todo` in `training_composition001` now passes. Browser: built-in pane 1920 EN Midnight, focus lands in setup, not `<body>` (checked before the amendment); Firefox: both flows OK (owner, 2026-10-26) |
| TEST-HYGIENE-001-F14 | ticket (TEST-HYGIENE-001-FIX) | Harness limits still open: `role=dialog aria-modal` backdrops (e.g. Settings) do not block clicks behind them (only `<dialog>` modals do); `innerText` aliases `textContent`; fake IndexedDB cursors snapshot entries and advance synchronously on `continue()`; `:user-invalid` is always false; `matchMedia` change events never fire | P3 | Open | M1 | Documented limits; extend `tests/helpers/` with self-tests when a test needs them |
| RET-ARCH-001 | RQ (= QA-UI-COMPOSITION-ROOT-001) | `logic.js` orchestration/lifecycle chokepoint: bounded composition root and mount/owner/generation/disposal seams; no framework rewrite | P2 | Open (first pilot done: Saved library) | M1/M2 | Follow redesigns |
| RET-BROWSER-TEST-PLATFORM-001 | RQ (= QA-BROWSER-TEST-PLATFORM-001) | Portable mounted-browser lifecycle tests (mounting, focus/modals, identity changes, inactive workspaces, generation cancellation, disposal) | P2 | Partial (local Firefox beta smoke exists) | M1 | Structural tests cannot close these behaviours |
| QA-AUDIT-BROWSER-A11Y-001 | QA (audit) | Real-browser Tab order, modal containment/restoration, inactive-workspace accessibility may diverge from structural tests | P2 | Open, needs reproduction | M1 | |

## E. Small wants and preserved ideas (not bugs)

| ID | Want | MS | Note |
|---|---|---|---|
| WANT-TUTORIAL-INDEX | Tutorial index in Learn hub | M2 | |
| WANT-EQUITY-GRID | Visual range picker in Equity (reuse the Personal Strategy matrix) | M2 | NORTH_STAR §7.4 moved it to M2 (owner, 2026-10-12); draft said M3 |
| WANT-SAVED-TITLES | Meaningful auto-titles | Fixed (SAVED-COMPOSITION-002) | |
| WANT-BACK-TO-REVIEW | Back to Review after Explain | M3 | |
| WANT-WATCH-SPEED | Watch Rest skip (M1, done) and speed (M2) | M1/M2 | = WATCH-REST |
| WANT-SHORTCUTS | Shortcuts sheet; command palette later | M2 / M3 | |
| WANT-DERIVATIONS | Hover number derivations | M3 | |
| WANT-AUTO-NEXT | Training speed: auto-next after feedback, optional timer | M2 | |
| WANT-REVISIT-WHY | Transparent scheduling: every due or revisit item says why it is due | M2 | |
| WANT-SIMILAR-SPOTS | "Similar saved spots" next to a decision | M3 | |
| WANT-PRINT-SHEET | Printable strategy sheet | M3 | |
| WANT-LEAK-REPORT | Leak report vs your plan | M3 | |
| WANT-SPOT-OF-DAY | Spot of the day | M3 | |
| WANT-FOCUS-MODE | Focus mode | M3 | |
| WANT-HG-HISTORY-STATS | Game night per-person lifetime stats | Later | |
| WANT-HG-SHARE | Share Game night results; live-night helpers | M3 | |
| WANT-GLOSSARY-TOOLTIPS | Glossary tooltips | M2 | |
| WANT-GUIDED-WEEK | Guided first week | M3 | |
| WANT-RANGE-V-RANGE | Range vs range on a board | M3 | |
| WANT-COMPETITIVE-PASS | Competitive reference pass for feature ideas (adopt/adapt/differentiate/reject; never copy) | M3 | |
| AUDIO-RECON | Mixer, assets, System category; audio provenance doc out of date | M3 | |
| WANT-SHORTCUT-REBIND | Configurable keyboard shortcuts with clash check and reset (key contract M1, rebinding M2) | M2 | |
| WANT-LEGAL-DOCS | Privacy policy, cookie/local storage notice, terms, licences and third-party notices, study-tool disclaimer, contact, accessibility statement (Settings › About & legal); professional review before sharing | Later (gate for the first real release) | |
| DATA-SAFETY-M1 | Request persistent storage; guard "Delete all data" (type to confirm); export early M2; import M3 | M1/M2/M3 | M1 part Fixed, pending owner acceptance (`DATA-SAFETY-001` + MERGE-002 review fixes: local-only sign-out before wiping, status then reload into first run, no unconfirmed delete on the window bridge, iOS note only in iPhone/iPad browser tabs, blocked deletion waits and asks to close other Riverline tabs instead of claiming success). Batch part: one-time `navigator.storage.persist()` request with honest `persisted` vs `temporary` status and calm iOS tab install/back-up note in Settings › Account & Data, plus strongly guarded "Delete all data" with warning list and localized type-to-confirm (`DELETE` / `УДАЛИТЬ` / `מחק`); export early M2; import M3 |
| RET-HPR-RANDOM-001 | Random spot extensions: Another Like This, broader Lock & Perturb, controlled transfer drills, recipe sharing/history, Saved-derived randomization, runout exploration | M2/M3 | Accepted bounded foundation; spot generator direction in NORTH_STAR §6.2 |
| RET-SAVED-TRAINING-EXPERIENCE-001 | Saved Training Experience payload (canonical Hand + its Training decisions/evidence) | M3/Later | Needs an approved payload/ownership/reopen contract |
| RET-SAVED-EQUITY-SNAPSHOT-001 | Saved Equity Snapshot payload (exact inputs/unknowns, method/version/result) | M3/Later | Needs an approved payload contract |
| RET-HPR-GAME-SETUP-001 | Reusable game setups/presets; physical Hero/button/Dealer/empty-seat configuration | M2 | Becomes Table rules v1 (NORTH_STAR §6.1); = GAME-SETUP-EVOLUTION-001 |
| RET-PERF-001 | Visible Matrix DOM mutation: profile only if measured sluggish | Later (watch) | = QA-PERF-003 |

## F. Independent review findings (2026-10)

| ID | Finding | Status | MS |
|---|---|---|---|
| REVIEW-DOC-01 | NORTH_STAR Equity input types, fold example, verdict "leans" state, mockups-as-spec | Fixed in NORTH_STAR | — |
| REVIEW-DOC-02 | Shortcut keys inconsistent across mockups; Settings › Shortcuts incomplete | Key contract adopted as proposal | M1 |
| REVIEW-DOC-03 | Disabled "coming later" controls in Settings | Rule: no placeholder controls | M1 |
| REVIEW-DOC-04 | Missing About & legal placeholder; Chippy vs Help & guide category | Open | Later/M3 |
| REVIEW-MATH-01 | Mockup numbers wrong (Equity runouts, Style, Learn wording, Home Game totals) | Rule: golden numbers from the engine; corrections recorded in the archived mockup log | M1 |
| REVIEW-MATH-02 | Scoped "Exact" labels; Monte Carlo confidence level; luck needs known cards | Adopted in NORTH_STAR | M1/M2 |
| REVIEW-MATH-03 | Estimated mixes shown at 1% precision; trace actions | Fixed in TRUTH-SURFACES-002 + MERGE-002, pending owner acceptance (see section A) | M1 |
| REVIEW-EVID-01 | Evidence gate, no VPIP from drills | Adopted in NORTH_STAR | M2 |
| REVIEW-PS-01 | Plan bounds with Sometimes; spot map from Table rules; HJ group | Adopted in NORTH_STAR | M2 |
| REVIEW-HG-01 | Balance gate must count only recorded entries | Adopted | M2 |
| REVIEW-ORBIT-01 | Stack carry/top-up undefined | Answered by owner (NORTH_STAR §7.2, 2026-10-11) | M3 |
| REVIEW-BASE-01 | Review example: heuristic suggests raise/fold mixes that look dubious (AK on K84 two-tone) | For the baseline audit | M1 |
| REVIEW-IDEA-10 | Money-mode reconstruction (type ₪, stored in bb) | Decided (NORTH_STAR §11b) | M2 |

## G. Pending human acceptance (pre-reset)

Implemented work whose human acceptance was never recorded. Many will be superseded by the M1 Style v4 redesigns; decision D-02 in [STATE.md](STATE.md#open-decisions) asks whether to close these in bulk at the M1 owner design pass. Evidence text and checklists are in the archived `QA_BACKLOG.md`.

| ID | Implemented by | What to accept | Status | MS |
|---|---|---|---|---|
| QA-ANALYZE-COMPOSITION-001, QA-ANALYZE-COMPOSITION-005 | ANALYZE-COMPOSITION-001 (uncommitted, `956ca6e`) | Analyze two-panel composition, verdict dominance, fact table + omission rule, inline Explain, app-wide type scale; amendment 2 fidelity | Accepted (D-21, owner 2026-10-15; committed `4e3e11a`; was pending acceptance as ANALYZE-ACCEPT) | M1 |
| QA-SAVED-COMPOSITION-002, QA-SAVED-COMPOSITION-005, QA-SAVED-COMPOSITION-006 | SAVED-COMPOSITION-002 (`0919e62`) | Saved toolbar, dense rows, sticky inspector, keyboard model, auto-titles; global weights; Midnight = mockup palette | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-TOKEN-TUNING-001 | token tuning | Global tokens (Midnight colours later superseded by the mockup palette) | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-SHELL-001, QA-SWEEP-013, QA-SWEEP-014, QA-SWEEP-029 | SHELL-001 (`bf90a55`) | One header bar, canvas grid, compact footer, one accent per view; tour anchors; RU/HE Home label; nav tooltips | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-DS-FOUNDATION-001, QA-DS-FOUNDATION-002, QA-DS-FOUNDATION-003, QA-DS-FOUNDATION-004, QA-DS-FOUNDATION-007 | DS-FOUNDATION-001 (`71b7ccb`) | Component sheet, selected caption contrast (= QA-SWEEP-015), checkboxes, HE Saved card order (= HE-SAVED-ORDER), switch visuals | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-DECISION-INPUT-001, QA-DECISION-INPUT-002, QA-DECISION-INPUT-003, QA-DECISION-INPUT-004, QA-DECISION-INPUT-005, QA-DECISION-INPUT-006, QA-DECISION-INPUT-007, QA-DECISION-INPUT-008 | DECISION-INPUT-TRUTH-001 (`da78be7`) | Typed numbers, readiness labels, facing summary, frame-true Replay, randomizer status, sizing copy, raw replay key (= REPLAY-RAW-KEY), key hint | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-LANGUAGE-SWITCH-001, QA-LANGUAGE-SWITCH-002 | LANGUAGE-SWITCH-EVENT-001 (`a0bc491`) | Language change is presentation-only; source label survives re-translation | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-HOME-GAME-INPUT-001, QA-HOME-GAME-INPUT-002, QA-HOME-GAME-INPUT-003 | HOMEGAME-LEDGER-INPUT-001 (`5ae58de`) | Amount validation, seat drafts, Guest truth | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-SAVED-LIBRARY-001, QA-HOME-002A-002 | SAVED-LIBRARY-001 (`cedf241`) | Saved library 200 bound, search, filters, sort | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| QA-SAVED-TRAINING-HISTORY-001 | SAVED-TRAINING-HISTORY-001 (`2a444e2`) | Training history view in Saved | Accepted (D-01, owner 2026-10-15; was pending acceptance) | M1 |
| REFERENCE-INTEGRITY-RECOVERY-001 | REFERENCE-INTEGRITY-RECOVERY-001 (`8541e76`) | Small human checklist in the archived recovery report (new row: the report pointed at the QA backlog but no QA ID existed) | Pending acceptance | M1 |
| BETA-CANDIDATE-QUICK-SWEEP-001, QA-I18N-002 | Beta quick sweep (2026-09-13) | Mounted Explain refresh across EN/RU/HE | Pending acceptance (D-02) | M1 |
| QA-BETA-COHERENCE-001 | Beta coherence sweep (2026-09-12) | Focused coherence flows | Pending acceptance (D-02) | M1 |
| QA-BROWSER-BETA-HARNESS-001 | BROWSER-BETA-HARNESS-001 | Firefox real-app smoke command (automated pass) | Pending acceptance (D-02) | M1 |
| QA-BROWSER-BETA-THEME-FOCUS-001 | BROWSER-BETA-HARNESS-001 | Theme choice keeps focus | Fixed, regression covered | — |
| QA-BETA-PRODUCT-MODERNIZATION-001 | BETA-PRODUCT-MODERNIZATION-001 | Clarity pass: unavailable/empty compositions, Training decide/learn, Review roles, Personal map, Guide legend | Pending acceptance (D-02) | M1 |
| QA-MODERNIZATION-SYNC-001 | BROWSER-BETA-HARNESS-001 | Local Guest Personal mutation diagnostic fixed; real sync acceptance stays RET-ACCOUNT-003 | Fixed (local); remainder Later | Later |
| BETA-REPAIR-SWEEP-A / -B | Beta repair sweeps (2026-09-10) | Delivery sizing, table/Review/Equity composition, theme contrast/startup, sound/pacing; AUD-01…AUD-13 audit repairs | Pending acceptance (D-02) | M1 |
| HAND-PREQA-001, BETA-HAND-PRE-QA-CORRECTION-001 | Hand pre-QA (2026-09-08/09) | Rake/collection choices, ante contribution markers, draft-only randomization | Pending acceptance (D-02) | M1 |
| BETA-BLOCKER-REPAIR-001 | Beta blocker repair (2026-09-08) | AUD-01 accounting compatibility, AUD-02…05 | Complete for the bounded repair; broader beta QA separate | — |
| QA-BETA-DESIGN-CORRECTION-002, QA-BETA-FEATURE-SURFACE-REFRESH-001, QA-BETA-DESIGN-REFRESH-001 | Beta design passes (2026-09-07) | Forest/jade identity, surface roles, portraits (TEMPORARY BETA ART), checklists per surface; browser lag measurement | Pending acceptance (D-02); largely superseded by Style v4 | M1 |
| QA-ADVANCED-EQUITY-001 | ADVANCED-EQUITY-001 | Weighted Equity, partial known-only results, runouts, card previews | Pending acceptance (D-02) | M2 (Equity rework) |
| QA-REFERENCE-STRATEGY-002 | REFERENCE-STRATEGY-002 | Source intake / coverage / health foundation | Pending acceptance (D-02) | M3 |
| QA-DEEP-STUDY-001 | DEEP-REVIEW-001 + STUDY-INBOX-001 | Decision Delta roles, top decisions, Home Study Inbox | Pending acceptance (D-02) | M2 (Review rework) |
| QA-HAND-HISTORY-IMPORT-001 | HAND-HISTORY-IMPORT-001 | PokerStars English cash import, recorded rake, Saved provenance | Pending acceptance (D-02) | M2 |
| QA-EXPLOIT-ANALYSIS-001 | EXPLOIT-ANALYSIS-001 | Exploit response facts, Personal questions, completed Review roles | Pending acceptance (D-02) | M3 |
| QA-BLUFF-EXPLOIT-TEACHER-001 | BLUFF-EXPLOIT-TEACHER-001 | Teacher v1 in Explain and Personal Hand study | Pending acceptance (D-02) | M3 |
| QA-OPPONENT-POLICY-001, QA-OPPONENT-POLICY-002 | OPPONENT-INTELLIGENCE-001/002 | Actor-safe bots, presets/custom, reflection intents, policy review | Pending acceptance (D-02) | M3 (bots) |
| QA-PERSONAL-COACH-001 | PERSONAL-STRATEGY-CONTINUATION-001C | Teach-through-a-Hand flop–river | Pending acceptance (D-02) | M2 |
| QA-PERSONAL-INTELLIGENCE-001, QA-PERSONAL-002R | PERSONAL-STRATEGY-INTELLIGENCE-001 | Games/Approaches, intent, Understanding, language | Pending acceptance (D-02) | M2 |
| QA-RANGE-CAL-002C, QA-RANGE-CAL-002D, QA-PLAYSTYLE-QUICK-PROFILE-001, QA-RANGE-BUILDER-001, QA-RANGE-TEACHER-001 | Range calibration family | Adaptive questions, Matrix inspection, Builder, Teacher | Partial (Firefox acceptance open; D-02) | M2 |
| QA-IDENTITY-LIFECYCLE-001 | IDENTITY-LIFECYCLE-001A/B/C | Guest/account isolation, Move/Keep/Cancel, recovery | Pending acceptance | Later (accounts) |
| QA-TRAINING-INTELLIGENCE-001 | TRAINING-INTELLIGENCE-001 | Unsure, 24 h Revisit, why-returned | Pending acceptance (D-02) | M1 (Training redesign) |
| QA-HEURISTIC-BASELINE-TRUTH-001, QA-TRAINING-NORMATIVE-001 | HEURISTIC-BASELINE-TRUTH-001, TRAINING-NORMATIVE-001 | Neutral comparison language/audio; assessment-policy gate | Partial (= RET-HEURISTIC-BASELINE-TRUTH-001) | M1 |
| QA-REFERENCE-AUTHORITY-001, RET-REFERENCE-UI-001 | REFERENCE-AUTHORITY-001, FULL-HAND-REVIEW-001 | Training pre/post wording, Full Hand comparison copy, provenance, Matrix precision in Firefox | Partial | M1 |
| QA-FULL-HAND-REVIEW-001, QA-TABLE-VNEXT-002, RET-FULLHAND-001, QA-TRAIN-ANALYSIS-003 | FULL-HAND-REVIEW-001 | Shared review states A–H in Firefox | Partial | M1 (Review foundation) |
| QA-AUDIO-MOTION-001, QA-HANDSON-009, QA-POLISH-001, RET-AUDIO-001 | AUDIO-MOTION-001 | Subjective listening/feel acceptance | Partial (listening debt) | M1 (SOUND-001) |
| QA-HANDSON-005, QA-LAYOUT-PRESETS-001, RET-COMPOSITION-002 | WORKSPACE-COMPOSITION-002 | Surviving Table Focus / Analysis Focus presets polish | Partial | M1 |
| QA-HANDSON-010, QA-UI-006 | SETTINGS-IA-001 | Settings categories in Firefox (EN/RU/HE, themes, sizes) | Partial | M1 (Settings redesign) |
| QA-HOME-002A-001 | HOME-002A | Home in Firefox (viewports, themes, languages) | Partial | M1 (Home redesign) |
| QA-HOME-GAME-001A-001 | HOME-GAME-001A/001B | Game night in Firefox / real provider | Partial (= RET-HOMEGAME-001) | M2 |
| QA-UI-001, QA-UI-002, QA-UI-003, QA-UI-004, QA-ANALYSIS-001, QA-ANALYSIS-002, QA-TRAIN-ANALYSIS-002, RL-13, RL-14 | PRODUCT-UI-002R / 003R2 | Older Analyze/Training presentation checks | Partial; likely superseded by Style v4 (D-02) | M1 |
| QA-ANALYSIS-RANGE-001, QA-ANALYSIS-BLUFF-001 | ANALYSIS-RANGE-001, BLUFF-001 | Live viewport/theme/language acceptance | Partial (D-02) | M1 |
| QA-CARD-001, QA-CARD-002, QA-CARD-003, QA-THEME-001, QA-THEME-002, QA-THEME-003, QA-THEME-004, QA-THEME-005, QA-THEME-006, RL-12, RL-20 | PREMIUM-CARD-001, PRODUCT-THEME-001/002, TABLE-PRESENCE-002 | Card faces, Daylight surfaces, theme catalog, custom themes in Firefox | Partial (D-02) | M1 (DES-STYLE) |
| QA-LAYOUT-002, QA-LAYOUT-003 | TABLE-PRESENCE-002 | Active Hand composition at 1366 and zoom | Partial | M1 (Hand foundation) |
| QA-I18N-001, QA-I18N-003, QA-I18N-004, QA-RESP-001 | various | Human linguistic, RTL and responsive acceptance | Partial (= RET-I18N-001, RET-RESP-001) | M1 |
| RL-17 | GUIDE-CONTENT-001 | Guide terminology/content final review | Partial | M1 (Guide pass) |
| RET-HPR-QUALITY-001 | HPR #2–3, #9, #15, #18, #27, #47, #58 | Intro/systemic spacing and sizing, semantic iconography, Account/Profile hierarchy, typography/casing, non-poker sound, restrained Royal Flush | Open (accepted debt); likely absorbed by the M1 refresh | M1 |
| RET-HPR-CUSTOMIZATION-001 | HPR #8, #10–13 | Compact rank-style control, richer card backs, custom-theme creation, Daylight comfort, manual reduced-motion override | Open; reduced-motion toggle is MOTION-001 | M1 |
| RET-PREMIUM-001 | RQ | Release-quality whole-product manual/visual collection point | Becomes the M1 owner design pass (STATE phase 5) | M1 |

## H. Carried strategy, reference, account and learning debt

| ID | Source | Issue | Sev | Status | MS | Note |
|---|---|---|---|---|---|---|
| RET-AUDIT-HIGH-RISK-REPRO-001 | RQ | Remaining audit findings need reproduction (stack transfer, a11y, range comparison interaction, review priority) | P2 | Partial | M1 | Rows in A, C, D |
| RET-TRAINING-NORMATIVE-001 | RQ | Probability gap to the modal action is not a normative correctness rule; comparative practice and future normative grading need distinct contracts | P2 | Open (foundation accepted; no production assessment policy) | M1 (wording) / M3 | |
| RET-REFERENCE-PACK-001 | RQ (= QA-REFERENCE-PACK-001) | No production-safe corpus, sizing tree, independent validation corpus or licence evidence; no production pack registered. Also owns the pilot-era historical-evidence disposition | P2 | Open (dependency) | M1 (trust package measurement) / M3 (solver library) | Decision D-20 |
| RET-PREFLOP-001 | RQ (= QA-PREFLOP-REFERENCE-001) | v4 calibration is narrow (BB vs BTN, 6-max, ~80–120 bb, 2–3 bb opens); other roles are generalized fallbacks | P2 | Open | M1 (baseline audit) | |
| RET-POSTFLOP-001 | RQ (= QA-POSTFLOP-REFERENCE-001) | Coarse opponent ranges, strong-made-hand aggression saturation, no trustworthy sizing strategy, limited history conditioning, no multiway equilibrium | P2 | Open | M3 (solver library) | Postflop stays Estimated |
| RET-BENCH-001 | RQ | Reference benchmark v1 cannot encode handless whole-node observations, is conservative with unknown rake, cannot compare sizing when Riverline is unsized, lacks weighted range-vs-range Equity | P3 | Deferred | M1/M3 | Extend only when blocking |
| QA-REFERENCE-AUTHORITY-002 / RET-SAVED-PROV-001 | QA / RQ | Saved Hand/Spot do not freeze historical StrategyResult provenance; any future historical-analysis payload must snapshot source ID/version/authority/coverage/capabilities/limitations | P3 | Deferred | Later | |
| RET-PERSONAL-001 | RQ | Personal Strategy future slices: Coach, continuation ranges, observed/opponent integration, postflop/combo | — | Open (foundation accepted) | M2/M3 | |
| RET-ADVANCED-EQUITY-001 | RQ | Advanced Equity follow-ups: Personal A/B UI, clean/dirty and redraw/nuts/lock facts, source picker, persisted runout continuity | — | Open | M2 | |
| QA-HOME-002A-003 | QA | Persistent Training history/re-drill intelligence and recent Analysis history unsupported on Home; no fabricated statistics | — | Deferred | M2 (Home continuity) | |
| RET-ACCOUNT-001 | RQ (= QA-ACCOUNT-001, QA-ACCOUNT-002A) | Live Supabase/provider, RLS, interruption/restart and Firefox acceptance of identity lifecycle; legacy local data claim keeps stable IDs | P2 | Open | Later (before sharing) | M1/M2 are local-only |
| RET-ACCOUNT-002 | RQ (= QA-ACCOUNT-002B-A) | Saved sync: live migration, cross-user RLS/idempotency/stale revision, offline/reconnect/conflict, two-profile Firefox | P2 | Open | Later | |
| RET-ACCOUNT-003 | RQ (= QA-ACCOUNT-002B-B) | Personal Strategy sync: live relational migration/RLS/idempotency/append-only, two-profile conflict/resume; local v2 vs remote v1 mismatch | P1 (before sync ships) | Open | Later | = REPO-AUDIT-002 |
| RET-ACCOUNT-004 | RQ (= QA-ACCOUNT-002A2) | Username login only behind a trusted rate-limited server path; never client-side username→email lookup | — | Deferred | Later | Decision D-22 |

## I. Closed and historical IDs (index)

Closed, removed or superseded; evidence in the archived `QA_BACKLOG.md` / `PRODUCT_RETURN_QUEUE.md`. Listed so a search by ID finds them.

- **Return queue, closed:** RET-DECISION-ECONOMICS-001, RET-STRATEGY-TRUST-001, RET-DECISION-CONTEXT-AUTHORITY-001, RET-ANALYZE-SCENARIO-READINESS-001, RET-CARD-CLEAR-SEMANTICS-001, RET-CORE-FLOW-CORRECTNESS-001, RET-ALL-IN-RUNOUT-REGRESSION-001, RET-ONBOARDING-001, RET-HPR-SAVED-VISUAL-001, RET-MATRIX-001, RET-ANALYSIS-001, RET-EQUITY-001, RET-GUIDE-001, RET-TRAINING-MEMORY-001, RET-HEURISTIC-BASELINE-TRUTH-001 (foundation; human QA row in G).
- **RET-FULLHAND-HERO-FOLD-001:** Fixed *(verified 2026-10-15: Full Hand `hero_complete` boundary in `TRAINING_MEMORY_V1_SPEC.md` "Sweep C" and `full-hand-training-*` controllers)*.
- **Audit foundation, closed:** QA-AUTH-TRAINING-MEMORY-001, QA-DECISION-ECONOMICS-001, QA-STRATEGY-TRUST-001, QA-DECISION-CONTEXT-SINGLE-AUTHORITY-001, QA-CARD-CLEAR-SEMANTICS-001, QA-LIGHT-WINS-BATCH-001, QA-DOCS-CONTINUITY-001, QA-AUDIT-EQUITY-EXACT-OPPONENT-001, QA-AUDIT-FULL-HAND-MEMORY-LEAK-001, QA-AUDIT-SAME-SPOT-COHERENCE-001, QA-TRAINING-MEMORY-AVAILABILITY-001, QA-AUDIT-NON-HERO-CONTEXT-001, QA-AUDIT-ANALYZE-CHRONOLOGY-001, QA-AUDIT-HOME-COMPLETED-HAND-001, QA-AUDIT-AUTH-CLIENT-DUPLICATE-001.
- **CI and baseline:** QA-NODE-BASELINE-001, QA-CI-001.
- **Strategy/reference, closed:** QA-STRATEGY-REPAIR-001A, QA-DECISION-CONTEXT-001A, QA-STRATEGY-REPAIR-001B, QA-REFERENCE-BENCH-001, QA-PREFLOP-ROLE-001, QA-PREFLOP-CALIBRATION-001.
- **Table/Replay, closed or accepted:** QA-TABLE-VNEXT-001, QA-REVIEW-NAV-001 (micro-polish in RET-REVIEW-NAV-001), QA-REPLAY-RAIL-CORRECTION-001, QA-REPLAY-RAIL-HARDENING-001, QA-TABLE-VNEXT-003, QA-TABLE-001, QA-UI-005.
- **Core flow, closed:** QA-CORE-FLOW-NEW-HAND-001, QA-HOME-GAME-CORRECTION-001, QA-KNOWN-CARD-PICKER-001, QA-MIN-RAISE-VERIFY-001 (no canonical defect), QA-ALL-IN-RUNOUT-REGRESSION-001.
- **Hands-on findings (Aug 2026):** QA-HANDSON-001, QA-HANDSON-002, QA-HANDSON-003, QA-HANDSON-004, QA-HANDSON-006, QA-HANDSON-007, QA-HANDSON-008, QA-HANDSON-011, QA-HANDSON-012, QA-HANDSON-013, QA-HANDSON-014, QA-HANDSON-016, QA-HANDSON-017, QA-HANDSON-018, QA-HANDSON-019, QA-HANDSON-020 closed; QA-HANDSON-015 and QA-HANDSON-021 accepted with physicality debt (RET-TABLE-001, RET-CARDS-THEMES-001); QA-HANDSON-005, QA-HANDSON-009, QA-HANDSON-010 in section G. HPR-2026-08 #1–#59 dispositions are in the archived review; open ones map to RET-HPR-* rows; #49–55 feed Personal Strategy (QA-PERSONAL-002R).
- **Saved/analysis, closed:** QA-SAVED-COMPOSITION-003, QA-SWEEP-024 (SAVED-COMPOSITION-002), QA-SWEEP-015 (DS-FOUNDATION-001), HE-SAVED-ORDER (DS-FOUNDATION-001), REPLAY-RAW-KEY (DECISION-INPUT-TRUTH-001), QA-TRAIN-ANALYSIS-001, QA-MATRIX-001, QA-MATRIX-002, QA-RANGE-001.
- **Equity and Training layout, closed:** QA-EQUITY-001, QA-EQUITY-002, QA-EQUITY-003, QA-EQUITY-ETA-001, QA-EQUITY-PROGRESS-001, QA-EQUITY-NARROW-001, QA-TRAIN-LAYOUT-001, QA-TRAIN-LAYOUT-002, QA-TRAIN-LAYOUT-003, QA-TRAIN-LAYOUT-004, QA-TRAINING-MEMORY-001, QA-TRAINING-REDRILL-001.
- **Other closed:** QA-HOME-GAME-001A-002, QA-GUIDE-001, QA-PERF-001, QA-PERF-002, FQA-002, FQA-004 (superseded), RL-16, RL-18, QA-HIST-001 to QA-HIST-026 (closed or removed historical items): QA-HIST-001, QA-HIST-002, QA-HIST-003, QA-HIST-004, QA-HIST-005, QA-HIST-006, QA-HIST-007, QA-HIST-008, QA-HIST-009, QA-HIST-010, QA-HIST-011, QA-HIST-012, QA-HIST-013, QA-HIST-014, QA-HIST-015, QA-HIST-016, QA-HIST-017, QA-HIST-018, QA-HIST-019, QA-HIST-020, QA-HIST-021, QA-HIST-022, QA-HIST-023, QA-HIST-024, QA-HIST-025, QA-HIST-026.
- **Deferred to later milestones (no row needed until activated):** QA-MOBILE-001 (mobile gets a distinct composition, Later).
