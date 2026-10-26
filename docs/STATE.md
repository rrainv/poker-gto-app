# Riverline state

The **one live status file**: where the project is, what is next, what is waiting on a decision. It replaces `CURRENT_PHASE.md`, `ROADMAP.md`, `PRODUCT_BACKLOG.md` and `PRODUCT_RETURN_QUEUE.md` as status owners (archived under `docs/archive/2026-10/`). Direction lives in [NORTH_STAR.md](NORTH_STAR.md); bugs, debt and small wants in [ISSUE_REGISTER.md](ISSUE_REGISTER.md); the owner's decisions with reasons in [design/decisions/](design/decisions/README.md). A guide, not an ultimatum: the owner decides order and scope.

Last updated: 2026-10-26 (DOCS-PHASE1-001: Phase 1 decisions, the M1 build plan, canvases and research).

**Update rule.** The Manager (or a ticket that owns it) updates this file when a ticket is accepted, the queue changes, or a decision is made. Keep it short: replace rows, don't append history. Accepted-work rows keep only the latest ~15; older history is git log.

---

## Current milestone: M1, trustworthy and beautiful base (design-first)

M1's first job is a **very good design refresh** (Style v4, calm surface and deep data, no real or pseudo dead space, the approved motion direction) before the heavy feature work of M2/M3. Feature work in M1 is limited to honesty and usability: truth fixes, trust package, data safety, notices, i18n completeness. The owner QAs heavily on the PC; expect several correction rounds per screen. **M1 goal (M1_BUILD_PLAN, 2026-10-22):** docs and truth fixed, the design and motion foundation, Training and Settings fully redesigned, Home/Welcome redesigned (the owner's new priority), every other workspace on the new foundation (token/layout level), the trust package, i18n complete, a clean QA sweep. Details: [NORTH_STAR §9](NORTH_STAR.md#9-milestones-and-gates).

Sizes: S (one session), M (one session plus corrections), L (two or more sessions or parts). Tiers T0–T3 per [AGENTS.md](../AGENTS.md#verification-tiers). Lanes: **C** = Claude Code (main folder), **A** = Gemini Argon (own worktree, batches of 3–4), **O** = owner.

### Gates (checkpoints for judgement, not hard blockers; the owner decides)

| Gate | Status 2026-10-15 (not re-checked by DOCS-PHASE1-001) |
|---|---|
| 1. No open P0/P1 issues (data loss, wrong money, false strategy claims, broken core flows) | Not met: open P1s in [ISSUE_REGISTER › Truth, correctness and money](ISSUE_REGISTER.md#a-truth-correctness-and-money) (OWNER-12 sliders, OWNER-17 spot table, HG-002) |
| 2. Every in-scope screen meets the design standard and passes the automated audit | Not started (audit is LAYOUT-AUDIT-001) |
| 3. Clean hands-on QA sweep (independent Claude Code review after the M1 foundation lands) | Not started |
| 4. Trust package (not a hard gate; exact maths and honest labels in M1, reference measurement may trail into early M2) | Not started |
| 5. i18n complete and natural enough (native polish later) | Not met (see [TERMINOLOGY › Applying this sheet](TERMINOLOGY.md#applying-this-sheet-code-still-differs)) |
| 6. "I use it by choice", checked monthly | Monthly check running from 2026-10; gate meaningful after M2 |

M1_BUILD_PLAN adds one gate item: notices in place (NOTICES-001). Data safety is planned work, not a gate. Scope rule: anything new goes to a later milestone unless it fixes a P0/P1 or is tiny and inside a screen already being redesigned.

---

## Ordered queue (M1, design-first)

From the Manager's **M1 build plan (draft, 2026-10-22)**, which replaces the 2026-10-15 M1 plan's phases. Every ticket uses the `riverline-design` skill and [MOCKUP_QA](design/MOCKUP_QA.md); redesign tickets start by listing what the earlier layouts contained (P1-26). Order matters where noted; otherwise lanes run in parallel. The top unfinished row of each phase is next.

### Phase 0: close out (week of 2026-10-26)

| # | ID | Outcome | Lane | Tier | Status |
|---|---|---|---|---|---|
| 0.1 | MERGE-001 | Argon B0–B3 merged (AGENT-POLICY-001, MOCKUP-ASSETS-001, I18N-RESIDUE-001, CLEANUP-PREP-001) | C | T1 | Done: `0105083` |
| 0.2 | TRAINING-F12-001 | Every Training start clears completion state (F12); Adjust drill focuses a shown control (F13) | C | T1 | Done and accepted (owner, 2026-10-26): `9d963dc`, `06bc02d` |
| 0.3 | SKILLS-001 | Pinned, vetted agent skills in `.agents/skills` (riverline-design, better-accessibility, review-animations, break-ui) | C | T0 | Done: `cb4f087`, merged `dbaf49d` |
| 0.4 | DOCS-PHASE1-001 | All owner decisions and research into the repo with reasons; consistency check applied; brief; third-party register | C | T0 | This ticket (2026-10-26) |
| 0.5 | Argon batch 2 | B4 TRUTH-SURFACES-002, B5 DOMAIN-MATH-001, B6 DATA-SAFETY-001 (with honest storage status) | A | T1 | Done: merged `7b9fdc2`; review fixes MERGE-002 `a9b2578`; owner acceptance pending (register REVIEW-MATH-03, DATA-SAFETY-M1) |
| 0.6 | B5 cross-review | Independent review of DOMAIN-MATH-001 (maths risk tier) | C | review | Not recorded as a separate report; MERGE-002 merged B5 and logged follow-ups (DOMAIN-MATH-FOLLOWUPS) |
| 0.7 | NOTICES-001 | 18+ and responsible-gambling notices, study-tool and fair-play line, "Quick spot lookup" rename, no poker-room links | A or C | T1 | Next (after 0.4) |
| 0.8 | MOTION-FOUNDATION-001 | Motion tokens + the global Motion setting, no redesign (= 2.2 below) | C | T1 | Queued |
| 0.9 | HG-LEDGER-EDITS-001 | Money: zero cash-out record + repeatable corrections (HG-002, HG-003; persisted-format change needs approval) | C | T1 | Queued |
| 0.10 | Argon batch 3 | B7 LOCALE-NUMBERS-001, B8 A11Y-KEYS-001, B9 FULLHAND-QUALITY-001, B10 SAVED-KEY-FLAKE-001 | A | T1 | Queued |
| 0.11 | Argon batch 4 | B11 AUDIO-RESEARCH-001 (listening page from R-06), B12 GOLDEN-SPOTS-001 (from R-08's 20 spots), B13 A11Y-AUDIT-001 | A | T1 | Queued |
| 0.12 | SOLVER-PILOT-001 (Argon batch 5) | postflop-solver offline, 12 spots, internal measurement only | A | — | Optional; needs the owner's YES to the Rust toolchain |

### Phase 1: owner decisions at the PC (no agent cost)

Whose turn A or C · kit text notes · drill-mix refinement · Personal Strategy screen refinement · Equity PC bug list · Rust toolchain yes/no · the listening session (after AUDIO-RESEARCH-001). Already decided on 2026-10-26 (P1-30): card back, heading font, Hebrew mix bar, Equity layout, Learn mix.

### Phase 2: foundation (order matters)

| # | ID | Lane | Tier | Scope |
|---|---|---|---|---|
| 2.1 | DS-TOKENS-001 | C | T2 | Style v4 tokens: radius 16, padding 22, content max ~1640, button heights 40 / 44–48, weights (650 labels/controls/values…), Daylight values, card size scale, spacing rhythm, contrast tokens (DS-CONTRAST-TOKENS), self-hosted Rubik (DS-FONT-RUBIK); remove raw hex and ad hoc sizes where touched. Replaces DS-TOKENS-V4 |
| 2.2 | MOTION-FOUNDATION-001 | C | T1 | Curves, durations, per-moment tempo hook, the global Motion setting, keyboard-instant mechanism, 60 fps guards. Replaces MOTION-001 |
| 2.3 | COMPONENTS-001 | C | T2 | Shared components with motion: action card + Confirm (select + confirm, one-time prompt), fact tile with derivation, source/tier label, mix bar with "you" tick, verdict (dominance rule), collapsible panel card, bottom sheet, toast, session dots + finish ring, segmented control with thumb, switch, felt + seats (hero at bottom) + card flip; the component sheet at `/__dev/component-sheet.html`. Replaces DS-COMPONENTS-V4 |
| 2.4 | SHELL-002 | C | T2 | Sidebar variant 4 (Home; Study / Tools / Library hubs; Game night apart; footer), context chip (Table rules · approach), workspace switch motion, hub screens as skeletons |
| 2.5 | WELCOME-001 | A | T2 | Welcome tour A → setup C (3 questions) → first drill B → one hand in Review D; PC + phone; skippable; first-run 18+ line |

### Phase 3: full redesigns (prototypes are the spec; numbers from the engine)

| # | ID | Lane | Tier | Spec |
|---|---|---|---|---|
| 3.1 | TRAINING-QUICK-001 | C | T2 | Quick refresher per prototype CWT6NtfBMxXqQnJ3t6UGjK (PC + phone), five panels, plan locked until answered, keys |
| 3.2 | TRAINING-LONG-001 | C | T2 | Long session: table presence, whose-turn (the owner's pick), the same components |
| 3.3 | HOME-001 | A (+C review) | T2 | Per GkEYuGz7y4rsvRJpH7oLJo: returning and first-visit states; only real data; evidence gate for "noticed" |
| 3.4 | SETTINGS-001 | A | T2 | All categories: Appearance (themes incl. Slate as a built-in, cards, text size), Sound & motion (Motion setting), Language, Help & guide, Shortcuts (list; rebinding is M2), Account & data (guarded delete), About & legal; motion moments 32–36 |
| 3.5 | ANALYZE-POLISH-001 | C | T2 | Analyze on the new components; one provenance label; "All details"; phone layout per CdAHUhBxo21ZEFQvz6xPdL |

### Phase 4: foundation passes (token/layout level; full redesigns come with M2)

Argon batches of 3–4, each T1 with one Firefox check: REVIEW-FOUND-001 (on the Review mockup's structure, no new features), HAND-FOUND-001, FULLHAND-FOUND-001 (hero at bottom, quality pass items, Watch Rest skip), EQUITY-FOUND-001, PS-FOUND-001, GAMENIGHT-FOUND-001, LIBRARY-FOUND-001 (motion 39–41), LEARN-FOUND-001 (motion 37–38). Kit redraws first where a screen exists only as an old canvas (KIT-REDRAW-001).

### Phase 5: trust package and truth (parallel with 3–4)

| # | ID | Lane | Tier | Scope |
|---|---|---|---|---|
| 5.1 | GOLDEN-SPOTS-001 | A | T1 | Engine-computed fixture used by mockups, lessons and tests; prioritised by R-08's 20 home/live spots (Argon batch 4) |
| 5.2 | EXACT-LABELS-001 | C | T1 | Scoped Exact labels everywhere they apply (price only, known cards, push/fold model later) |
| 5.3 | BASELINE-MEASURE-001 | C (+A review) | T2 | Free measurement harness (R-01): invariants, exact preflop best response where possible, boundary checks; per-context results incl. home contexts; **no third-party charts downloaded or copied**; "Verified" only where tolerances are met. Baseline improvements follow as M2 tickets, implied-odds gate first |
| 5.4 | SOLVER-PILOT-001 | A | — | Optional, if Rust is approved; internal measurement only |

### Phase 6: quality to the gate

I18N-COMPLETE-001 (owner reviews RU/HE wording) · A11Y fixes from the audit · DATA-SAFETY acceptance · test hygiene follow-ups · LAYOUT-AUDIT-001 · full QA sweep (T3) · the owner's month of "use it by choice" starts.

**Later in this flow (M2 starts after the gate):** Personal Strategy question flow (approved screen + sweep A), Hand input (HAND-01 … 07), Review walkthrough, Equity rework, Learn hub + estimation training, Game night rework, Table rules, the sticker book, Orbit (M3), sound (after the listening page).

**Replaced by this plan (2026-10-26):** the 2026-10-15 Phase 1 rows DES-SHELL, DES-STYLE, DES-COMPONENTS, DES-MOTION, DES-CONTROLS (decided or folded into P1 decisions and the foundation tickets); Phase 2 rows DS-TOKENS-V4 → DS-TOKENS-001, DS-COMPONENTS-V4 → COMPONENTS-001, MOTION-001 → MOTION-FOUNDATION-001, SOUND-001 → after the listening page; the old Phase 3 screen order → Phases 3–4 above.

---

## Decisions (2026-10-18 → 26)

Short index; each log keeps every decision's reason and date. Applied to [NORTH_STAR](NORTH_STAR.md) and [DESIGN_SYSTEM](project/DESIGN_SYSTEM.md) by DOCS-PHASE1-001.

| Area | Decided | Log |
|---|---|---|
| Shell | Sidebar variant 4: Home; Study / Tools / Library hubs with hub screens; Game night apart; footer; My poker in Library | [P1-01, P1-02](design/decisions/PHASE1_DECISIONS.md) |
| Answering | Select + confirm everywhere; one-time "answer with one click" prompt; Instant / Hold in Settings › Training | P1-03 |
| Controls | Action cards and seat buttons both exist as shared components; per-mode use provisional | P1-04 |
| Training | Five panels, all reachable, plan locked until answered; quick refresher draft | P1-05, P1-24 |
| Motion | Frequency decides motion; motion catalog approved; Balanced tempo, per-moment tempos; one global Motion setting; 60 fps | P1-06 … P1-10, [MOTION_SPEC](design/MOTION_SPEC.md) |
| Sound | Real recordings only (study cues too); CC0 preferred, CC-BY with credit; sound and motion separate | P1-11, [LONG_TERM_NOTES](design/decisions/LONG_TERM_NOTES.md) (2026-10-26) |
| Empty states, illustration | Useful starter from real data, else illustration + one line + one action; soft depth + fine line; two-card rule | P1-12 … P1-14 |
| Chippy | Calm, serious teacher who happens to be a chip; real-chip look; theme colour; parked until M3 art | P1-15 … P1-15b |
| Orbit | Stacks always carry over; top-up like a real game (offer to top up to the start; auto top-up as a setting) | P1-16 |
| Onboarding | A → C → B → D, all skippable; welcome tour draft "amazing", PC version added | P1-19, P1-23 |
| Achievements | Activity only, tiered sticker book that looks like real stickers; skill milestones removed | P1-20, P1-22, [catalogue](design/ACHIEVEMENTS_CATALOGUE.md) |
| Mockups | QA checklist; content inventory from earlier PC layouts; PC first at 1920×1080 | P1-21, P1-26, P1-28, [MOCKUP_QA](design/MOCKUP_QA.md) |
| PC picks (2026-10-26) | Card back with an "R" monogram; Rubik headings; Hebrew mix bar LTR with the legend following it; Equity B look with A density; Learn mix leaning to B with A's content | P1-30 |
| Personal Strategy | Thresholds + brush + table questions (buckets dropped); main action + optional "sometimes", % on request; families in, roles out; base plan + depth differences; three paces; sweep A; full-screen composition approved | [PS-01 … PS-08](design/decisions/PS_DESIGN_DECISIONS.md) |
| Hand | Table-first entry shown as the data rail; eight combined strengths; exact / about / unknown + gap rows; capture: Tap default on phone, Short notes for precision (also typed on PC), free text backup; result card + careful takeaway | [HAND-01 … HAND-07](design/decisions/HAND_DESIGN_DECISIONS.md) |
| Phone | Close to the full app; Quick spot lookup with warnings and four hard limits; build approach by prototypes; drill mix of variants 2 + 3 | [MOB-01 … MOB-06](design/decisions/MOBILE_DESIGN_DECISIONS.md) |
| Long term | Phone standalone then optional sync; mostly free, source model decided after licences; sourcing policy; testers when near public-ready; free-first solver path; no spending committed | [LT-01 … LT-07](design/decisions/LONG_TERM_NOTES.md) |
| Research answers | Name kept with a name watch (D-30); source + tier + scope labels (D-31); money mode kept (D-32); live mode renamed Quick spot lookup (D-33); 18+ notices; R-04 as guidance; limped multiway important; round 3 plan changes adopted with "don't focus on one preset"; QR on phone + PC webcam if cheap; plan conflicts kept as a named copy; RU «ты» | LONG_TERM_NOTES, [VOICE_GUIDE](design/VOICE_GUIDE.md) |
| Consistency | Older repo text vs the newer decisions, 14 rows, owner answers recorded | [CONSISTENCY_CHECK](design/decisions/CONSISTENCY_CHECK.md) |

---

## Accepted and recent work

Commits on `codex/stabilization`. Per NORTH_STAR §10, a commit title is not acceptance evidence; acceptance status for each item is in the register.

| Commit | Date | Work | Acceptance |
|---|---|---|---|
| `a9b2578` | 2026-10-26 | MERGE-002: review fixes for Argon batch 2 (Explain uses the shared verdict; data-safety delete flow) | Pending owner acceptance (REVIEW-MATH-03, DATA-SAFETY-M1) |
| `7b9fdc2` | 2026-10-26 | Argon batch 2: TRUTH-SURFACES-002, DOMAIN-MATH-001, DATA-SAFETY-001 | same |
| `dbaf49d` | 2026-10-26 | SKILLS-001: pinned, vetted agent skills | Merged |
| `9d963dc`, `06bc02d` | 2026-10-26 | TRAINING-F12-001 (F12, F13) | Accepted (owner Firefox check, 2026-10-26) |
| `0105083` | 2026-10-26 | MERGE-001: Argon B0–B3 (agent policy, mockup assets, i18n residue, cleanup prep) | Merged; owner acceptance per register rows |
| `4e3e11a` | 2026-10-15 | ANALYZE-COMPOSITION-001 incl. amendments 1–2: composition, verdict dominance, fact omission, inline Explain | Accepted (owner, 2026-10-15; D-21) |
| `d1c826e` | 2026-10-15 | DOCS-RESET-001: agent docs reset | Accepted (owner, 2026-10-15) |
| `51c115d` | 2026-10-15 | TRUTH-FIXES-001: heuristic comparisons never graded as mistakes; one provenance indicator; hide sliders; honest spot table; reject 0 buy-in; 650 weights | Awaiting owner acceptance |
| `0919e62` | 2026-10-03 | SAVED-COMPOSITION-002: Saved list + inspector; Midnight = mockup palette, mockup weights | Treated as accepted (D-01, 2026-10-15) |
| `bf90a55` | 2026-10-02 | SHELL-001: one header bar, shared canvas grid, compact sidebar footer, one accent action per view | same |
| `71b7ccb` | 2026-10-02 | DS-FOUNDATION-001: design-system foundation; override stylesheet retired | same |
| `1e23638` | 2026-10-02 | REPO-HYGIENE-001: LF via `.gitattributes`, Node engines (≥22, `.nvmrc` 24), portable Electron test, non-flaky range-analysis timing | Committed |
| `a0bc491` | 2026-10-02 | LANGUAGE-SWITCH-EVENT-001: language switch is presentation-only | same as D-01 |
| `da78be7` | 2026-10-01 | DECISION-INPUT-TRUTH-001: typed numbers kept, truthful facing wording, frame-true Replay | same as D-01 |
| `5ae58de` | 2026-10-01 | HOMEGAME-LEDGER-INPUT-001: amount validation, drafts kept across actions, Guest truth | same as D-01 |

Older rows (Saved library, Training history, reference integrity recovery, solver benchmarks, Beta checkpoints): git log and [archive/](archive/README.md).

### What exists today (one line per area; contracts in `docs/project/`)

| Area | State |
|---|---|
| Poker domain | `shared/poker-domain/`: Game Rules v1/v2, PokerState v1/v2/v3 (new live Hands v2; v3 recorded-settlement import), legality, accounting, evaluator, canonical Equity (incl. weighted Advanced Equity slice), 1,326-combo Range Core; pot-before-action, SPR and MDF selectors (DOMAIN-MATH-001) |
| Strategy | Deterministic heuristic baseline behind DecisionContext → StrategyProvider → StrategyResult → StrategyClaimPolicy; `reference-pack/v1` infrastructure with **no production pack registered**; no normative assessment policy registered |
| Hand / Replay / Review | Canonical Hand, table-first workspace, vertical street-grouped rail, Replay, shared Review; PokerStars English cash import |
| Analyze | Scenario/Hand analysis, two-state verdict, facts, Explain (shared verdict), range matrix, category comparison, bluff/exploit teaching slices |
| Training | Varied, Focused, Full Hand vs synthetic policies; Training Memory, Same/Similar Spot, Unsure + 24h Revisit |
| Personal Strategy | Games/Approaches, question-driven RFI mapping, Understanding, Matrix Edit, Teach-through-a-Hand (BTN/BB) |
| Saved / Home | Saved Hand/Spot library + Training history view; Home with Continue, Study Inbox; Guide |
| Game night | Separate exact-money organizer (players, groups, sessions, append-only ledger, settlement) |
| Accounts and data | Local-first; Device Guest + account isolation; persistent-storage request and guarded "Delete all data" (DATA-SAFETY-001); Supabase auth and opt-in sync built but **live provider/RLS acceptance not done** (M1/M2 stay local-only) |
| Experience | Audio/motion event layer (CC0 Freesound previews + synthesized study cues, both to be replaced); themes (Midnight = mockup palette, Graphite, Daylight, custom); EN/RU/HE with RTL |
| Solver research | `solver/` isolated bounded HU preflop solver and benchmarks; not a production dependency |

---

## Open decisions

Decisions the owner (or Manager) still has to make. Mockup-derived items are design questions, not facts; mockup numbers are illustrative only.

| ID | Decision | Whose turn / source |
|---|---|---|
| D-23 | **Whose turn at the table:** A (halo + timer) or C (quiet pill), possibly A in normal play and C in fast/quiet modes; "needs further review" | Owner at the PC; P1-10, P1-30 |
| D-24 | **Kit text notes:** the owner's corrections to the kit screens' text ("none yet") | Owner; P1-30 |
| D-25 | **Equity PC bug list:** the visual bugs in the Equity PC draft ("later") | Owner; P1-29, P1-30 |
| D-26 | **Rust toolchain** for SOLVER-PILOT-001: yes or no | Owner |
| D-05 | Decision controls per mode: which mode uses action cards and which uses seat buttons (both exist, P1-04) | Owner at the PC |
| D-12 | Daylight values (first draft only), the contrast tokens (DS-CONTRAST-TOKENS) and table-theme picker scope | Owner, with DS-TOKENS-001 |
| D-27 | Drill-mix refinement (phone drill: variants 2 + 3, MOB-04) and the Personal Strategy screen refinement (PS-08) | Owner at the PC |
| D-28 | Tier vocabulary: the exact source words for the combined label (D-31 decided in principle) | Worker proposes, owner approves |
| D-29 | HRC Pro: whether and when to buy (deferred by LT-07) | Owner, later |
| D-15 | Game night workspace name ("Game night" applied; owner may revisit) and wording alternatives to "banker" / buy-in (kept for now); points-only wording for a store build (D-32) | Owner, later |
| D-16 | Exact "Verified" tolerances per spot type; the multiway 30–60 bb home game may never be strictly Verified (R-01) | Worker proposes, owner approves |
| D-18 | Pre-dependency versions of screens (an M1/M2 screen never relies on an M3 feature); Manager handles per redesign ticket | Manager |
| D-20 | Historical pilot-era Training Memory records (2026-09 HRC pilot): zero affected records found on the owner's origins; field-path control not run. Close, or run the control | Owner |
| D-22 | Older carried-over product questions: Training `Not sure` behaviour; Training-evidence opt-in placement/default; default comparison source; Home Game settlement preference (fewest transfers first per NORTH_STAR §7.9); username login before release; card-outcome preview touch/click semantics | archived PRODUCT_BACKLOG §14 |
| D-02 | Bulk disposition of ~60 pre-reset "human acceptance pending / partial" rows: close as superseded by the M1 redesign + owner design pass, or keep individually | ISSUE_REGISTER §G |
| — | Phone build approach (MOB-02: same web app with phone layouts vs native), decided by prototypes; solver packs later: download on demand or bundled (M3) | Owner, later |

**Name watch (D-30):** "Riverline" is kept; NAME-WATCH-001 tracks trademarks, domains, store listings and the "Riverline Poker" real-money room, repeated before any launch, with a trademark lawyer check before going public.

### Resolved

| ID | Decision |
|---|---|
| D-01 | (2026-10-15) Tickets committed but never formally accepted are treated as accepted for now; the M1 owner design pass catches remaining issues |
| D-14 | (2026-10-15) Style v4 values win: panel radius 16 px, padding 22 px, content max ~1640 px, buttons 40 px (44–48 for the main action) |
| D-19 | (2026-10-15) Analyze workspace name: RU «Анализ», HE «ניתוח»; Hebrew "Hero" = «הירו»; Russian keeps Latin "Hero" |
| D-21 | (2026-10-15) Analyze work accepted; committed `4e3e11a`, then docs reset `d1c826e` |
| D-03, D-04 | (2026-10-18, P1-01) Sidebar variant 4 with hub screens; My poker in the Library hub with Saved |
| D-06 | (2026-10-18, P1-05) Both drill modes exist (quick refresher, long session); five Training panels, no leaks before the answer |
| D-09 | (2026-10-19 → 21, PS-01 … PS-07) Thresholds + brush + table questions, buckets dropped; families for asking, roles for teaching; sweep A |
| D-17 | (2026-10-20, LT-02) Open vs closed is decided after the best tools' licences are known; treated as closed until then; no AGPL code inside the app |
| D-07 | (2026-10-26, P1-30) Equity: visually like B, density like A |
| D-08 | (2026-10-26, P1-30) Learn: a mix leaning to B (fun concept web) with all of A's useful content |
| D-10 | (2026-10-26, P1-30) Heading face: Rubik (self-hosted) |
| D-11 | (2026-10-26, P1-30) Card back: an "R" monogram, more like a real card back |
| D-13 | (2026-10-26, P1-30) Hebrew mix bar stays LTR; its legend follows the bar |

Answered and recorded in NORTH_STAR (not open): verdict states, confidence tier names, Equity input types, streaks dropped, achievements reopened (activity only), Table rules naming, data-safety staging, 650 weights, onboarding order, Orbit stacks, sound licences, QR transfer, plan conflict copies, RU «ты».

---

## Design canvases

Mockups are claude.ai artifacts on the owner's account (visual references, never numeric specs). **All mockups in one place: https://claude.ai/artifact/63s8zYYpd53U7YKhqdph38** (the all-mockups hub, with size presets and links to originals).

- **Kit and screens:** design kit (base for all new mockups) https://claude.ai/artifact/SStpE2d5pkehonTDTfWadu · all screens on the kit https://claude.ai/artifact/T3AFKWngjB7Wwt16S4Ghts · shell refresh + decision controls https://claude.ai/artifact/JGdFYsoCKu2QSz4vQVkVsc · language and theme check https://claude.ai/artifact/WDNVjr9NcmRuuwEz76jJsu
- **Workspace canvases:** Training https://claude.ai/artifact/9DNvuK1BP95FhHXNbwmEhG · Personal Strategy https://claude.ai/artifact/QJSHwD9MKXBuwrytU2ajWo · Full Hand/Orbit https://claude.ai/artifact/7u8MoEspbtCGn3gQRDatb5 · Home https://claude.ai/artifact/Ec2hY4gurv8oBoEjrZfk3c · Equity https://claude.ai/artifact/QZ4J2TQiNhjsbUEgnZpoHo · Review https://claude.ai/artifact/MkdkDSTN5WY7mc1vWsP7Zs · Hand https://claude.ai/artifact/KWaXJUnCPCE6rsMVcT2aHy · Game night https://claude.ai/artifact/HnM2fLZBjgT64sg7wpMy47 · Learn https://claude.ai/artifact/HBhMraUpUw3SKkunukRt9z · Settings https://claude.ai/artifact/NvWWdHFscXVyonHi7mSGhZ · My poker + sidebar variants https://claude.ai/artifact/4jx3ekEbqMNud57cdRwgyL
- **Motion:** prototype (quick drill) https://claude.ai/artifact/KAVPFd47pgvoMVdPfREQNJ · prototype v2 https://claude.ai/artifact/QU9fhzBcbfXSGR8LB4fiNk · prototype v3 (motion by frequency, select + confirm) https://claude.ai/artifact/DyUbUoWsYtTZAY278Gtur8 · tempo demo https://claude.ai/artifact/Hte23tzqMQeJyHs5ZLDXtw · prototype v4 (emil-design-eng rules) https://claude.ai/artifact/TzbFFFSRfVHawwyGoQyUQC · interaction gallery https://claude.ai/artifact/9YUY2oSLnTfviFxE8y2eks · motion catalog part 1 (approved direction) https://claude.ai/artifact/57zRYjjv2nqpX67cyPrbzw · part 2 https://claude.ai/artifact/6oSKHkdTMWx6UXu6gvRSa4 · part 3 https://claude.ai/artifact/4nNsyDcBCr1Aigbws7CZEC · part 4 (Settings, Learn, Library) https://claude.ai/artifact/YBRHGvTJhQb8nD38Akgiqy
- **Look and characters:** empty states https://claude.ai/artifact/824g9bxcmrtAvmgnqcVMpr · illustration styles https://claude.ai/artifact/9rQz34e4MZeMzEGpc1m8cb · soft depth + line (approved) https://claude.ai/artifact/7fZoz4bq5rrNyU7yabfLQj · Chippy v3 https://claude.ai/artifact/PX6EXmRnNTmXn2Kts3Xk7a (its sound board was rejected: synthesized) · sticker book (P1-22) https://claude.ai/artifact/9tv3PQ56XusCCmbjEKgBfD
- **Phase 1 screen drafts:** Review (P1-18) https://claude.ai/artifact/EqbQPm21Fg8yBqDaJHEbHx · welcome tour + setup (P1-23) https://claude.ai/artifact/GAP1fJfgZBAC9QBJhqtKHE · Training quick refresher (P1-24) https://claude.ai/artifact/CWT6NtfBMxXqQnJ3t6UGjK · Home (P1-25) https://claude.ai/artifact/GkEYuGz7y4rsvRJpH7oLJo · Equity C (P1-27) https://claude.ai/artifact/KmjXTrYm5vHhRt74aoouLM · Equity PC (P1-29) https://claude.ai/artifact/ApbEnatGhujBnFwKjAnUDn
- **Personal Strategy:** families/roles preview (PS-03) https://claude.ai/artifact/Cdx37aMzUUiPH8ZDKPGG1K · plan sweep A/B, A chosen (PS-06) https://claude.ai/artifact/E8uC9hLZMHUtFeCY61EeE8 · full screen (PS-08) https://claude.ai/artifact/A8cKDUChAHgTmxVhhNc6fZ
- **Hand:** capture options (HAND-06) https://claude.ai/artifact/X1HazzWjjqcuqApqCY6SRy
- **Phone:** drill, 3 variants (MOB-03) https://claude.ai/artifact/M51vnniJWW8W1YsNSwHRUr · Analyze (MOB-05) https://claude.ai/artifact/CdAHUhBxo21ZEFQvz6xPdL · Game night (MOB-06) https://claude.ai/artifact/NZqGEDA1xC2rd5AgnwGzqm
- **Ideas demos:** ideas 1–5 https://claude.ai/artifact/Ugg4c4w25yrXiw3oZiDLTV · ideas 5–22 https://claude.ai/artifact/1bLPyUScBU4LrA3HwpSQfY · estimation training https://claude.ai/artifact/4Y7Gw2TFXSJxgKkoKXpQMn
- **Earlier:** solver research findings (2026-10-12) https://claude.ai/artifact/PdNJrKcCYvzbXgiNS5EARY · full mockup log (to 2026-10-21): [archive/2026-10/MOCKUP_REVIEW_LOG.md](archive/2026-10/MOCKUP_REVIEW_LOG.md)

---

## Research

Filed in [research/](research/README.md) (evidence, not legal advice, to verify). Prompts in [RESEARCH_TICKETS.md](research/RESEARCH_TICKETS.md).

| # | Topic | Status / outcome |
|---|---|---|
| R-01 | Free preflop/multiway solving (+ R-01b rerun) | Analysed: free-first solver path, measurement harness, never download charts (NORTH_STAR §3.3–3.4) |
| R-02 | Legal and app-store landscape (+ R-02b rerun) | Analysed: D-32 money mode kept, D-33 Quick spot lookup, 18+ notices, "supporter tier" |
| R-03 | Name check (two runs, originals not kept) | Owner kept "Riverline" (D-30); name watch |
| R-04 | Coming back without streaks | Adopted as guidance, not hard rules |
| R-05 | Competitive reference pass | Analysed: ideas 24–28 |
| R-06 | Real sound candidates | Feeds the listening page (AUDIO-RESEARCH-001) |
| R-07 | Accounts, sync and phone ↔ PC | Analysed: storage status, QR transfer, named-copy conflicts |
| R-08 | Home and live games | Analysed: 20-spot priority list, four baseline improvement candidates (one data inconsistency noted) |
| R-09 | Accessible poker interfaces | Prompt written; no report yet |
| R-10 | Learning path | Analysed: 58-concept draft map, first 8 lessons; its RU/HE terms are not ours |
| — | LT-06 solver licensing; agent skills; master synthesis (not a brief) | Filed; see [research/README.md](research/README.md) |

---

## Pointers

- Direction and decisions: [NORTH_STAR.md](NORTH_STAR.md) (§12 lists decisions that changed recently); context: [BRIEF.md](BRIEF.md).
- Decision logs: [design/decisions/](design/decisions/README.md); design references: [design/](design/MOTION_SPEC.md) (motion, voice, mockup QA, achievements).
- Bugs, debt, small wants, pending acceptance: [ISSUE_REGISTER.md](ISSUE_REGISTER.md) (search by ID).
- Visual contract: [project/DESIGN_SYSTEM.md](project/DESIGN_SYSTEM.md). Licences: [THIRD_PARTY.md](THIRD_PARTY.md).
- Terms: [TERMINOLOGY.md](TERMINOLOGY.md). Ideas: [IDEA_BANK.md](IDEA_BANK.md).
- Reference specs (read only when a ticket names them): [project/](project/); guardrails for future capabilities: [project/CAPABILITY_GUARDRAILS.md](project/CAPABILITY_GUARDRAILS.md).
- History: [archive/](archive/README.md).
