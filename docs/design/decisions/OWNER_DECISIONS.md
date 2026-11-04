# Owner decisions: the single decision log

The **one place** for the owner's decisions with dates and reasons, from DOCS-RESET-002 (2026-10-31). New decisions are added here as dated entries at the top of "Decisions since 2026-10-31". The older per-area logs in this folder ([README](README.md)) stay as they were; this file adds the decisions that used to sit in STATE.md (table, open and resolved decisions) and in NORTH_STAR (§11b, §11c, §12), copied unchanged. NORTH_STAR and STATE keep one line pointing here.

When a living doc and a log disagree, the newer owner decision wins; raise the conflict in your report.

## Decisions since 2026-10-31

Recorded by DOCS-RESET-002 from the owner's repository review and the approved ticket.

| Date | Decision | Reason |
|---|---|---|
| 2026-11-04 | **The full suite is a gate, not a habit; CI is the merge gate.** Test policy lives in [WORKFLOW](../../WORKFLOW.md): T1 runs the ticket's TEST SET, T2 adds the CSS guard group when `styles.css` changed, the full suite runs only for shared harness/tokens/core paths and for `main` or milestones, never two suites at once. (WORKFLOW-001) | Cost: about 20 full-suite runs in 4 days for little new signal; CI already runs every PR, so local re-runs duplicate the gate. |
| 2026-11-04 | **Analyze spot chips wrap the Facing / Pot / Stack / Table sliders.** A chip opens a popover holding the same controls, sliders included; the readiness gate is unchanged. | The sentence-style spot stays compact while the sliders remain the one set of inputs; wrapping them adds no second input path and no new gating rule. |
| 2026-11-04 | **The mockup's "Verified" pill on the Analyze answer is dropped.** | Baseline output is never "verified"; the pill would claim a strength the deterministic baseline does not have (honesty rule: never GTO, solved or "correct"). |
| 2026-11-04 | **Sparse-state layout:** when a view has 4 cards or fewer, use a row-aligned grid with equal-height rows; "Start something" uses tiles. | Uneven cards in a sparse view leave ragged edges and dead space on PC; equal rows keep it calm and aligned. |
| 2026-11-04 | **Startup gate is the accepted fix for module startup order.** Top-level await in the auth and saved-sync bootstraps made those modules async, so the gate sequences startup explicitly. | Import order alone no longer guaranteed readiness once the bootstraps became async; one explicit gate is simpler than patching each importer. |
| 2026-11-04 | **Outside-the-mix answers show no marker in the bar but a labelled pill** (P1-31). | An unlabelled bar marker reads as a position in the mix; a labelled pill says plainly that the answer is outside it. |
| 2026-11-04 | **Test flakes are fixed at the root,** never retried or loosened. | A retry or looser assertion hides the real race or nondeterminism and weakens the test for every later change. |
| 2026-10-31 | **Integration branch:** `codex/stabilization` becomes `main`. The branch move is pending; the owner runs it. Until then agents base on `codex/stabilization`. | `main` is far behind the real line of work; two names for one line cause wrong bases and merges. |
| 2026-10-31 | **New binaries stay outside git** (PDFs, images, recordings, large exports). The research PDFs already in the repo stay. | Binaries bloat history permanently and cannot be diffed. Fonts and assets the app needs at runtime are the exception and are recorded in [THIRD_PARTY](../../THIRD_PARTY.md). |
| 2026-10-31 | **CI runs on pull requests, on the integration branch and on manual dispatch.** The CI ticket sets it up; until then the T2 wording "full suite once at the end" in AGENTS.md is the local rule. | Tests are the safety net for a large single-file app; they must run where the owner merges. |
| 2026-10-31 | **Module rule:** new UI code goes into mounted modules in `app/src/application/` (or `app/src/ui/`), never into `app/src/core/logic.js`. `logic.js` only shrinks. Mounted workspaces use one controller interface: `mount(container, deps)` returning `{ dispose, refreshLanguage, handleKey, setVisible }`, with `deps` injected (never the whole `window.app`) and characterization tests with `bootApp()` before any move. | `logic.js` (about 16k lines) is the main risk to every change; growth must stop before it can be reduced. |
| 2026-10-31 | **Extraction order:** quick drill (EXTRACT-QUICKDRILL-001) → Home (step 0 of HOME-001) → card picker → Training Memory (with the long-session ticket) → Equity (with its M2 rework). Hand/Review, Analyze and Full Hand are extracted only together with their M2 reworks. | Extract what is being rebuilt anyway; moving code that a rework will replace is wasted risk. |
| 2026-10-31 | **"Heuristic" is dropped from user-facing text** (TERMS-HEURISTIC-001). Internal names, contracts and docs may keep it; the honesty rule (never call it GTO, solved, exact EV or "correct") is unchanged. | Owner review of TRAINING-QUICK-001 (2026-10-30): the word reads as jargon and as a disclaimer; the confidence tier and source label already say what the number is. |
| 2026-11-01 | **HOME RULES.** One primary button on Home. At most 6 cards and 3 rows per card, fixed heights, no in-place expansion (detail opens its workspace). Adaptive slot merging: cards with nothing to show merge into the remaining slots rather than leaving holes. Honest nothing-due state (say nothing is due; never invent work). Plan-vs-played shows from n >= 8 hands; drift against a mixed baseline from n >= 20. Format defaults to the latest session; toggling it belongs with Table rules in M2. Owner confirmation: agreed (as relayed by the Manager in MERGE-NIGHT-001; edits, if any, to be added here). | A fixed, small grid keeps Home calm and predictable, and the sample-size floors stop small samples from reading as evidence. Basis: HOME-INVENTORY-001 and research round 5. |
| 2026-11-01 | **SETTINGS RULES.** Three zones. Instant apply with a "modified" marker and a per-row reset. Built-in presets are immutable (copy to edit). Shortcuts bind by physical key with localized labels; rebinding is M2. M1 delete stays total (wipe everything); selective wipe and export are M2. Owner confirmation: agreed (as relayed by the Manager in MERGE-NIGHT-001; edits, if any, to be added here). | Instant apply with visible reset removes Save/Cancel ambiguity; immutable built-ins keep Table rules trustworthy; physical-key shortcuts survive layout and language changes; a total delete is the one safe M1 behaviour before export exists. |
| 2026-11-01 | **NEW BINARIES STAY OUTSIDE GIT** (restates the 2026-10-31 rule for research): research PDFs live in `Riverline_archive`; only written summaries are committed under `docs/research/`. Opponent portrait masters were moved there by ASSETS-SHIP-001. | History never shrinks; summaries are diffable and enough for agents. |
| 2026-10-31 | **No framework and no rewrite.** Stay on plain JavaScript and ES modules. Revisit only on the triggers named in the repository review: mounted modules cannot hold a workspace's state, or the module count makes plain wiring the dominant cost. | The product is a learning workstation with deep local logic; a rewrite spends months on nothing the user sees. Incremental extraction gets the same benefit. |

## Mobile and shell clarifications

- **Mobile is not out of scope.** The phone version follows the MOB-01 … MOB-06 decisions (close to the full app, built on the same code, designed now, built after M2; [MOBILE_DESIGN_DECISIONS](MOBILE_DESIGN_DECISIONS.md), [NORTH_STAR §7.19](../../NORTH_STAR.md#719-phone-version-mob-01--mob-06-owner-2026-10-21-design-now-build-after-m2)). Desktop minimum stays 1366×768 for current work; QA-SHELL-008 (layouts under 820 px) is deferred to the phone milestone, not rejected.


## State decisions table, 2026-10-18 → 26 (from STATE.md)

Short index; each log keeps every decision's reason and date. Applied to [NORTH_STAR](../../NORTH_STAR.md) and [DESIGN_SYSTEM](../../project/DESIGN_SYSTEM.md) by DOCS-PHASE1-001.

| Area | Decided | Log |
|---|---|---|
| Shell | Sidebar variant 4: Home; Study / Tools / Library hubs with hub screens; Game night apart; footer; My poker in Library | [P1-01, P1-02](../../design/decisions/PHASE1_DECISIONS.md) |
| Answering | Select + confirm everywhere; one-time "answer with one click" prompt; Instant / Hold in Settings › Training | P1-03 |
| Controls | Action cards and seat buttons both exist as shared components; per-mode use provisional | P1-04 |
| Training | Five panels, all reachable, plan locked until answered; quick refresher draft | P1-05, P1-24 |
| Motion | Frequency decides motion; motion catalog approved; Balanced tempo, per-moment tempos; one global Motion setting; 60 fps | P1-06 … P1-10, [MOTION_SPEC](../../design/MOTION_SPEC.md) |
| Sound | Real recordings only (study cues too); CC0 preferred, CC-BY with credit; sound and motion separate | P1-11, [LONG_TERM_NOTES](../../design/decisions/LONG_TERM_NOTES.md) (2026-10-26) |
| Empty states, illustration | Useful starter from real data, else illustration + one line + one action; soft depth + fine line; two-card rule | P1-12 … P1-14 |
| Chippy | Calm, serious teacher who happens to be a chip; real-chip look; theme colour; parked until M3 art | P1-15 … P1-15b |
| Orbit | Stacks always carry over; top-up like a real game (offer to top up to the start; auto top-up as a setting) | P1-16 |
| Onboarding | A → C → B → D, all skippable; welcome tour draft "amazing", PC version added | P1-19, P1-23 |
| Achievements | Activity only, tiered sticker book that looks like real stickers; skill milestones removed | P1-20, P1-22, [catalogue](../../design/ACHIEVEMENTS_CATALOGUE.md) |
| Mockups | QA checklist; content inventory from earlier PC layouts; PC first at 1920×1080 | P1-21, P1-26, P1-28, [MOCKUP_QA](../../design/MOCKUP_QA.md) |
| PC picks (2026-10-26) | Card back with an "R" monogram; Rubik headings; Hebrew mix bar LTR with the legend following it; Equity B look with A density; Learn mix leaning to B with A's content | P1-30 |
| Personal Strategy | Thresholds + brush + table questions (buckets dropped); main action + optional "sometimes", % on request; families in, roles out; base plan + depth differences; three paces; sweep A; full-screen composition approved | [PS-01 … PS-08](../../design/decisions/PS_DESIGN_DECISIONS.md) |
| Hand | Table-first entry shown as the data rail; eight combined strengths; exact / about / unknown + gap rows; capture: Tap default on phone, Short notes for precision (also typed on PC), free text backup; result card + careful takeaway | [HAND-01 … HAND-07](../../design/decisions/HAND_DESIGN_DECISIONS.md) |
| Phone | Close to the full app; Quick spot lookup with warnings and four hard limits; build approach by prototypes; drill mix of variants 2 + 3 | [MOB-01 … MOB-06](../../design/decisions/MOBILE_DESIGN_DECISIONS.md) |
| Long term | Phone standalone then optional sync; mostly free, source model decided after licences; sourcing policy; testers when near public-ready; free-first solver path; no spending committed | [LT-01 … LT-07](../../design/decisions/LONG_TERM_NOTES.md) |
| Research answers | Name kept with a name watch (D-30); source + tier + scope labels (D-31); money mode kept (D-32); live mode renamed Quick spot lookup (D-33); 18+ notices; R-04 as guidance; limped multiway important; round 3 plan changes adopted with "don't focus on one preset"; QR on phone + PC webcam if cheap; plan conflicts kept as a named copy; RU «ты» | LONG_TERM_NOTES, [VOICE_GUIDE](../../design/VOICE_GUIDE.md) |
| Consistency | Older repo text vs the newer decisions, 14 rows, owner answers recorded | [CONSISTENCY_CHECK](../../design/decisions/CONSISTENCY_CHECK.md) |

---

## Open decisions (from STATE.md, as of 2026-10-27)

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
| D-34 | **Deals in drills and bot play (R-11):** honest shuffle only, or also a "representative deal" that steers toward instructive spots. *Manager recommends:* honest shuffle now; an optional, clearly labelled representative deal later | Owner; research round 4 |
| D-35 | **Bot adaptation (R-11):** fixed presets, or bots that adapt to you during a session. *Manager recommends:* fixed presets first | Owner; research round 4 |
| D-36 | **Playstyle controls (R-11):** how many presets and sliders. *Manager recommends:* 6 presets + 2 sliders (the initiative ratios), everything else in an "Adjust" drawer | Owner; research round 4 |
| D-37 | **All-in equity share scope (R-12):** which all-ins Review covers first. *Manager recommends:* heads-up and equal-stack all-ins first; side pots and multiway later | Owner; research round 4 |
| D-38 | **Review entry (R-12):** open on the hand overview, or straight into the key decisions. *Manager recommends:* overview by default, with a "try the key decisions first" option | Owner; research round 4 |
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

## Owner decisions, 2026-10-10 (from NORTH_STAR §11b)
- **Naming:** things that are not grouped together must not share a name. Rename proposal pending owner confirmation (see §13).
- **Money-mode input:** reconstruction and Home Game accept amounts in money or in bb; stored in bb with the blinds as the conversion (many live players think in money, online players in bb). [M2]
- **No schedule pressure:** milestones are approximate gates in one continuous flow; duration does not matter.
- **Short stacks:** the owner's home game buys in for 30–60 bb and plays normal (not push/fold) poker. The baseline must handle realistic 30–60 bb cash play; push/fold stays a separate model for very short stacks. Research item: how to reference-check 30–60 bb cash ("Verified" may not be reachable there; Estimated is honest).
- **Rare baseline actions in feedback:** mention briefly only when the frequency is low *and* there is a reason worth teaching; otherwise don't mention it.
- **Drills have two modes:** a quick refresher (fast, minimal) and a long atmospheric session (to start a study session). This also answers the table question: both exist, for different moods.
- **Input priority:** mouse-first; the app must look and feel good before keyboard behaviour is polished. The key contract stands but is low priority. Both mouse and keyboard should feel rewarding (hover and press micro-interactions).
- **Visual direction:** the owner wants the app to move toward the look of the 2026-10 design canvases (clean, useful, beautiful, smooth), with tweaks for preference. That style is the reference for the M1 design rework and for the decision-control exploration (no external reference apps needed). Common problems to remove everywhere: dead space from over-wide layouts, outdated features, missing settings and documentation.

## Owner decisions after the market research review (2026-10-10) (from NORTH_STAR §11c)
- **Confidence tiers renamed:** Exact / **Verified** (was Checked; "checked" collides with the poker action in EN, RU «чек», HE «צ'ק») / **Estimated** (was Approximate) / Unavailable. RU: Точно / Подтверждено / Оценочно / Недоступно. HE: מדויק / מאומת / משוער / לא זמין.
- **Positioning:** "The honest poker coach for the hands you actually play." Explanations that never invent facts are the differentiator; never position as "GTO trainer" or "AI coach".
- **Review (decisions vs luck) is the signature screen.**
- **Baseline priority:** multiway, 30–60 bb, rake-free spots, ordered by how often they occur in the owner's recorded hands. *(Refined 2026-10-23/26: limped multiway is important but not a declared priority, and no single preset is the focus: home/live contexts get attention alongside online 6-max/9-max, §3.3b.)*
- **First run asks "Where do you play?"** (home game 30–60 bb / live casino / online 6-max) before the first drill, which then uses that format.
- **Game night framing:** "keep score and settle up with friends"; a points / chips-only mode; legal read before any public RU/HE release; no rake/house-cut fields.
- **Monthly "would I use it by choice?" check** from now on, not only as a late gate.
- **Streaks dropped.** Chippy and achievements stay (M3).
- **Approaches stay a structural layer for now**, revisited once Personal Strategy is in real use.
- **Hand capture from the phone (both):** (1) a narrow **phone-note paste** in Hand that turns the owner's own shorthand into a draft hand with every guess labelled [M2, with Hand input; partly reverses the earlier "no shorthand entry" decision]; (2) a **phone-friendly capture page** reachable on the local network [M3; needs a privacy and security check before serving on a LAN]. *(Updated 2026-10-20 → 22: (1) became the defined capture flow (Tap default, Short notes for precision also on the PC, free text as backup; §7.5); (2) is a possible extra beside share sheet / file / QR transfer (LT-01, §7.11).)*
- **Equity intuition drills move earlier** (M2); the review queue and range recall stay late M2 / M3.
- **Personal Strategy starts question-first**, but not as a strict rule; a baseline-based starting plan (marked "not yet yours") can be reconsidered later.
- **Share a hand as text or image** (no account; for friends' chats): M3.
- **Game night → hands → review link** moves to **M2**: reconstructed hands can be attached to a game night; Home surfaces them next day ("2 hands from Friday") → Review → drill.
- **Audio trimmed:** first one good sound set + master volume and mute; the full per-category mixer and variants later (M3+).
- **Game night extras later:** banker mode, chip-rate mode, reopening settled sessions and live-night helpers wait; fewest-transfers settlement, notes, history and the balance gate come first.
- **Who uses it:** the owner as tester now; close friends as testers when interested; a public release is the eventual wish (legal documents first).
- **Game night happens on phones** (usually no laptop at the table). The desktop stays first-class, but Game night (and hand capture) need a phone-friendly view, planned with the M3 capture page.
- **The owner's poker:** home games 6–8 handed, short to mid stacks (30–60 bb buy-ins); online **9-max** with 100+ bb; and plenty of study. Built-in Table rules and the baseline priority should cover these contexts: add an online 9-max preset and a short-stacked 6–8-max home preset (replacing "Short-stacked 20–40 bb").
- Kept as planned (owner declined the trims): Equity full M2 redesign; full bot configuration depth in M3 (sliders, lineups, read the table).

## Decisions that changed recently (from NORTH_STAR §12)
- Achievements/XP: **reopened** (was rejected) with honesty guardrails; streaks dropped.
- "Heuristic disagreement is never a mistake" → refined: the baseline is the **teaching target, tiered by confidence**; disagreement outside a firm tier is still not called a mistake.
- Confidence tiers renamed: Checked → **Verified**, Approximate → **Estimated**.
- Equity "Calculate always explicit" → **auto when cheap, click when heavy**; Equity inputs are Cards / Range / Unknown with Random as a separate deal button.
- Verdict in action colour → **sentence case, primary colour; action colour in the mix card**; exactly two verdict states (dominant / close).
- Hand is a **reconstruction workstation**; bot play belongs to Training. Shorthand entry is out except a narrow phone-note paste.
- Releases → **milestones M1/M2/M3** in continuous development.
- Home "Destinations" panel removed; Guide workspace and Learn Riverline merge into the Learn hub (M2).
- Home Game → user-facing **Game night**; per-player buy-ins, independent sessions; banker, chip rates and reopening moved later.
- Game settings: Home/ClubGG presets → versioned **Table rules** (separate from Personal Strategy **Games**); built-ins cover online 9-max, online 6-max, private table, short-stacked home, heads-up.
- Strategy sliders: hidden until the M3 adjustment engine (Table / Opponent / Style).
- Data safety: persistent storage + guarded delete in M1, export early M2, import M3; not a gate.
- Weights: 650 for labels/controls/fact values (owner preference after comparing with the mockup).
- Mockups are visual references only; numbers come from the engine.
- **2026-10-18 → 26 (DOCS-PHASE1-001):** sidebar variant 4 with hubs, My poker in the Library hub (§6.5); select + confirm with a one-time prompt (§7.2); motion catalog + per-moment tempos + one global Motion setting replace the reduced-motion toggle (§7.16); sound from real recordings only, study cues included, CC0 preferred / CC-BY with credit, sound and motion separate (§7.15); first sound set moves after the listening page; illustration = soft depth + fine line with the two-card rule; Chippy = calm teacher, no idle personality (§7.13); achievements activity-only as a tiered sticker book, skill milestones removed (§7.12); Orbit top-up default = offer to top up to the starting stack (§7.2); onboarding A → C → B → D (§7.10); Personal Strategy thresholds + brush + table questions, main action + optional "sometimes", families in / roles out (§7.1); Hand table-first + short-notes capture syntax (replacing "shorthand [Out]") (§7.5); Equity B look with A density (replacing "rows not seats") (§7.4); Learn mix leaning to B with the R-10 58-concept draft map (§7.10); phone version close to the full app (replacing "later, intentional adaptation") (§7.19); Quick spot lookup with four hard limits (§2); combined source + tier + scope label (§3.2); free measurement harness, never downloading third-party charts (replacing "measure against public charts") (§3.3); free-first solver path, no spending committed (replacing the ≈US$75 budget) (§3.4); name kept with a name watch, money mode kept, mostly-free business model with the source model decided later (§1, §7.9); PC first (§8); Gemini Argon may implement in its own worktree (§10); RU «ты».
