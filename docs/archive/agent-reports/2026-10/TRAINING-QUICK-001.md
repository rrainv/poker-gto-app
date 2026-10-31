# TRAINING-QUICK-001 — Training quick refresher rebuilt to the approved prototype

Work session, Claude Code (Opus 5.5). Tier T2. Base `codex/stabilization` at `7904a23` (SHELL-002), already up to date with origin. Nothing staged or committed.

Owner answers before building (2026-10-27): no sizes row in quick drills (action type is all that is graded); Hard assistance locks the equity-needed tile until the answer; the felt shows the spot's real table size; setup fills the idle screen and opens from "Adjust drill" in the drill head during a session.

> **Correction 1 (owner review 2026-10-30, not accepted):** five points (motion, dead space, mix bar, "heuristic" wording, DESIGN_SYSTEM). See **§0** directly below. §1–§10 are the first delivery; where §0 changes them, §0 wins.

## 0. Correction 1 (2026-10-30)

### 0.1 Motion: every drill moment (point 1)

Compared against the prototype's own CSS/JS (`mockups/training-pc.html`) and MOTION_SPEC moments 1–4, 6, 7, 11, 14. All durations are MOTION_SPEC base values ÷ drill tempo 0.7 (Standard). The keyboard path is instant (`data-motion-input="key"` zeroes every duration). Reduced leaves only ≤ 160 ms opacity fades. Measurements: headless Firefox (`motion.mjs`, `motion-report.json`).

| # | Moment | Before correction | Now | Measured (Firefox, Standard, drill tempo) |
|---|---|---|---|---|
| 1 | Hero cards flip in | **Weak**: `rotateY` without perspective read as a squash | Built: real 3D turn (`perspective: 700px` on hole/board), 420 per card, 90 apart | 600 ms per card, 129 ms apart |
| 2 | Seat / felt changes on a new spot | **Missing** | Built: the felt comes back through a blur bridge (opacity .35 + 2 px blur, 200); seats fade in 30 apart | felt 286 ms; seats staggered 43 ms |
| 3 | Action card hover lift | **Weak** (100 ms) | Built: −2 px lift, 200, fine pointers only | — |
| 4 | Press scale .97 | Built | Built (unchanged) | — |
| 5 | Border draws around the pressed card | **Weak**: an SVG stroke-dash on a square rect that did not follow the card's radius and did not read as a draw | Built as in the prototype: a conic sweep from 12 o'clock, masked to the card's rounded border, animated through a registered `@property --rl-sweep` (no per-frame JS) | 157° at 71 ms, 344° at 284 ms, 360° at 638 ms |
| 6 | Glow breathes once | **Missing** | Built: `::after` glow, opacity 0 → 1 → 0, 900 | peak 0.99 at ~500 ms, gone at ~1.3 s |
| 7 | Others step back | **Weak** (143 ms) | Built: opacity .5, 220 | .50 at 214 ms |
| 8 | Check springs in | Built | Built (spring 320, +180) | visible 284–355 ms |
| 9 | Sizes row appears | **Missing** (component) | Built on the shared component (fade + 4 px rise). Not shown in quick drills (owner decision: no sizes row) | — |
| 10 | Confirm label change | **Missing** | Built: a changed label ("Confirm Fold" → "Confirm Call 1 bb") crossfades through a 2 px blur | — |
| 11 | Confirm morph (moment 2) | **Missing** | Built: on a pointer confirm the button closes to a 50 px round jade check (`clip-path`, 140 io); the label fades and the check rises with a spring | clip 200 ms; check 257–514 ms |
| 12 | Feedback swap with blur bridge | **Weak**: the old answer path hid the action cards at once, so the zone emptied before the swap | Built: the cards stay for the morph; the action layer steps up and out (40 hold + 80); the feedback rises through a 2 px blur at +110 | actions gone at 171 ms |
| 13 | Sequential answer reveal | **Weak / slow** (~1.3 s to the reason line) | Built, all within ~600 ms: verdict rises (110 + 180), pill (+170), mix (from +150), "you" (+250), reason and buttons (+290) | **586 ms** from the Confirm click to the last frame (runs: 586, 572, 586) |
| 14 | Mix-bar fill | **Weak**: 360 each, 140 apart; `scaleX` squashed the labels | Built: each segment wipes in with `clip-path` (labels never squash), 140, 40 apart | segments end at 414 and 471 ms |
| 15 | "You" marker arrival | Built but late (600 + 420) | Built: spring drop, 160 at +250 | ends 586 ms |
| 16 | Rolling digits (fact tiles) | Built | Built (520, 60 apart; equity tile rolls when Hard unlocks it) | — |
| 17 | Session dot fill | Built | Built (spring) | 514 ms |
| 18 | Panel expand / collapse (moment 7) | **Weak**: rows faded in, no height change; instant collapse | Built as in the prototype: the body grows to its content (`grid-template-rows` 0fr → 1fr, 360 io), the chevron turns (360), rows fade in 45 apart; collapse shrinks (240, faster than the entrance) and then hides | height 12 → 113 px over ~420 ms; collapse 113 → hidden by ~360 ms |
| 19 | Plan unlock | **Missing** | Built: once per answered spot the "Your plan" card glows once (900) and its rows arrive 45 apart | glow 1286 ms |
| 20 | Finish ring + count | Built | Built (900 io draw + `@property` count-up) | — |
| — | Feel popover grows from its trigger | Built | Built | — |

Keyboard (F/C then Enter): every drill animation's remaining time is 0 ms on both select and reveal. Reduced: select and reveal run only `opacity` transitions of 160 ms (no transform, clip or blur).

Frame sequence of selection → confirm → reveal (deterministic frames: every animation started by the click is paused and stepped): `Riverline_QA_2026-10/TRAINING-QUICK-001/frames/` (`1-select-0000…0900ms.png`, `2-confirm-reveal-0000…0600ms.png`). A real-time screen recording was not possible with the headless tooling.

Review-animations notes: the panel height uses `grid-template-rows`, the ring repaints a conic gradient, and the bridges use `filter: blur(2px)`. These go beyond the transform/opacity/clip-path guideline. Each is short, rare and on small elements, and the prototype does the same. There is no per-frame JS: the prototype's `requestAnimationFrame` ring became a CSS `@property` animation. Every transition reads its duration from scaled tokens (`--rl-motion-*`, defined like the foundation tokens), so Faster, Instant and keyboard all apply.

### 0.2 Dead space (point 2)

Changes:
- The drill column is capped at 1000 px (`minmax(0, 1000px)`) and the rail takes the rest (`minmax(320px, 1fr)`).
- At 1920 the rail is 620 px. Its panels sit two by two (container query at 560 px): Assistance pairs with Training Memory, and the action line reads in two columns.
- On a wide rail all five drill panels and the action history open by default, until the learner toggles one.
- The felt grows with the screen height: `clamp(200px, 100vh − 660px, 420px)`.
- Buttons size to their label: Confirm (208 px for "Confirm Fold"), the Training Memory tabs, rail panel buttons, and the Study hints strip.

Audit (`deadspace.mjs`, Firefox, EN Midnight, 20 px grid). An empty cell is one whose topmost element is a bare container: no text, control, card, felt or graphic. "Wide buttons" are buttons with more than 120 px of slack beyond their label.

| Viewport · state | Before: largest empty | Before: drill / rail width | Before: wide buttons | After: largest empty | After: drill / rail width | After: wide buttons | After: page scrolls |
|---|---|---|---|---|---|---|---|
| 1920 · before answer | 980 × 140 | 1260 / 360 | Confirm 1234 px for a 168 px label; "Generate from seed" 342 / 116 | 1360 × 140 (strip under the hint) | 1000 / 620 | none | no |
| 1920 · after answer | 840 × 120 | 1260 / 360 | "Generate from seed" | 1180 × 120 | 1000 / 620 | none | no |
| 1366 · before answer | 420 × 80 | 706 / 360 | Confirm 680 / 168 | 460 × 100 | 746 / 320 | none | 70 px (rail) |
| 1366 · after answer | 720 × 60 | 706 / 360 | none | 760 × 80 | 746 / 320 | none | 56 px (rail) |

No empty region is taller than 140 px at either size. The widest one at 1920 is a 140 px band at the bottom of the drill column, under the Study hints strip. In intermediate runs, a spot with a long action line made the rail scroll; the two-column action line fixed that, and the final runs show no scroll at 1920. At 1366 the page still scrolls 56–70 px: the rail (one column, 320 px) runs past the fold while the drill fits. This is listed as remaining debt (§0.6).

### 0.3 Mix bar and the "you" marker (point 3)

How it was computed before: `projectQuickDrillAnswer` laid out every segment with a share above 0 % in order and put the marker at `start + share / 2` of the segment whose action type matched the evaluation's `mappedStrategyAction.type` (the engine's mapping of Hero's action onto the strategy's actions; the chosen type when unmapped). For exact-frequency sources that list could include segments under 5 %, so a 3 % action got a marker and counted as "inside".

The rule now:
- The bar draws only shares of 5 % or more (`QUICK_DRILL_MIX_MIN_PERCENT`).
- The marker sits under the centre of the segment of the action Hero chose (same mapping, `start + share / 2`).
- If that action is not drawn (under 5 % or absent) there is no marker; the pill says "You: <action> · not in the baseline's mix" (RU «нет в миксе базовой стратегии», HE «לא בתמהיל של אסטרטגיית הבסיס»).
- Nothing else places the marker.
- Firefox check: the marker centre is at 1187 px, and the chosen Fold segment spans 1140–1234 px (centre 1187).
- Test: `tests/training_quick001_drill.test.mjs` covers centre-of-first-segment (22.5 %), a 4 % share (no marker, not inside), and absent (no marker).
- Speed: the whole reveal finishes in ~590 ms (§0.1).

### 0.4 "Heuristic" off Training (point 4)

- One Training-only mapping in `logic.js` (`TRAINING_TERMS` / `trainingTerm`) turns the shared truth labels into Baseline wording on every Training surface: the drill's source label "Baseline · Estimated", the feedback heading and grade, the session summary, Same Spot's "Historical baseline", the Full Hand fold list, and the tier tooltip.
- Terms: EN "Baseline", RU «Базовая стратегия», HE «אסטרטגיית בסיס», via the new key `quickDrill.term.baseline`. The existing "Baseline" key (RU «Базовый») belongs to another screen and was left alone.
- Firefox scan (`terms.mjs`; visible text, titles, aria-labels of `#trainingMode` in EN/RU/HE; before the answer, after it, and with Explain open):
  - Before and after the answer: 0 hits.
  - With Explain open: 2 hits per language, both inside the shared analysis's Source / provenance block: the source name "Heuristic fallback" and the "Limits & caveats" range note. The owner's rule allows "heuristic" in Source details, so they stay.
- New register row **TERMS-HEURISTIC-001** covers the app-wide sweep (Analyze heading and badge, Hand Review, status badge, range notes, About/Help).

### 0.5 DESIGN_SYSTEM (point 5)

The sequential answer reveal stays (P1-07 wins). DESIGN_SYSTEM "Frequency decides motion" now says: keyboard instant; pointer responses near-instant; the answer reveal is the one sequential moment and finishes within ~600 ms at Standard (drill tempo).

Because this ticket changed the truth they describe, two more lines were updated: the source-label example ("Baseline · Estimated") and the feedback wording and marker rule.

Register: DOC-MOTION-DRILL-REVEAL and TRAINING-QUICK-MOTION resolved; I18N-RU-BASELINE resolved on Training; TERMS-HEURISTIC-001 added.

### 0.6 Correction files, verification, debt

Files changed in this correction:
- `app/src/core/logic.js`: Training terms, felt swap, Confirm morph flag, cards kept for the swap, plan unlock, wide-rail panel defaults, row index.
- `app/src/ui/drill-components.mjs`: conic ring, confirm check + label swap + `markConfirmed`, panel open/close animation.
- `app/src/application/training-quick-drill.mjs`: the 5 % / marker rule.
- `app/src/locales/training-quick-translations.js`: Baseline terms; "not in the mix" replaces "outside".
- `app/index.html`: Training provenance heading and tooltip.
- `app/styles.css`: drill motion and the layout block at the end of the file.
- `docs/project/DESIGN_SYSTEM.md`, `docs/ISSUE_REGISTER.md`.
- Tests updated to the new contract: `training_quick001_drill`, `layout_presets001_presentation`, `training_composition001`, `training001_app_integration`, `same_spot_coherence001`, `strategy_truth001`, `truth_surfaces002`, `workspace_composition002`.

Verification (correction 1):

- **Focused tests:** 22 Training, shell, i18n, CSS-guard and truth suites: 224 tests. The first run had 3 failures, all old-contract assertions (grid width, rail span, term). After updating them: pass.
- **Full suite:** `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`, four runs.
  - Run 1: 4 failures. Same Spot "Historical heuristic baseline", the grade title, the provenance markup regex and a workspace grid width. All were old-contract assertions and were updated.
  - Runs 2–4 (the last on the final code): **2843 tests, 2841 pass, 0 fail.** The 2 TODOs are pre-existing (TEST-HYGIENE-001-F01, -F07).
- **Syntax:** `node --check` on every changed `.js`/`.mjs` passes.
- **Hygiene:** `git diff --check` is clean. LF only (no CR in any changed file).
- **Firefox screenshots** (`capture.mjs`), 1920 EN Midnight, 1366 EN Midnight, 1920 HE, 1920 Daylight, 1920 Slate:
  - Every config captured all 6 states, including the finish ring, and the side-by-side set was refreshed (25 images in `side-by-side/`).
  - 1366: Confirm bottom at 615 of 768 px.
  - Diagnostics: only the pre-existing `[Riverline Home]` startup errors.
- **Motion** (`motion.mjs`): the reveal finishes at 572–586 ms.
  - "You" marker: in the final run it sat at the centre of the chosen Fold segment (1070 px; the segment spans 905–1234).
  - Keyboard: 0 ms left on every animation. Reduced: only 160 ms opacity transitions.
- **Terms** (`terms.mjs`): 0 "heuristic" hits outside Explain's Source block in EN/RU/HE.
- **Dead space** (`deadspace.mjs`, final run):
  - 1920: largest empty region 1360 × 140 before the answer, 1180 × 120 after; nothing scrolls.
  - 1366: 460 × 100 before, 760 × 80 after; the page scrolls 56–70 px (the rail).
- **Found and fixed in these runs:**
  - The felt minimum: a 200 px floor let the hero cards cover the "You" seat at 1366, so it is back to 215 px (the first delivery's size).
  - Hebrew amounts in the action history, now visible by default on wide rails: isolated as LTR.

Visual status: **PARTIAL**. Real-browser checks were done; human visual acceptance is the owner's.

Debt and limits:
- At 1366 the one-column rail still runs 56–70 px past the fold (TRAINING-QUICK-1366-RAIL), and the hero cards still touch the top of the "You" seat label, as in the first delivery. The 1920 band under the Study hints is TRAINING-QUICK-BAND. Both follow up in TRAINING-QUICK-002; the owner accepted correction 1 on 2026-10-31.
- The action-history amount isolation (Hebrew) touches an older Training renderer; the change is one line, made because this correction opens that panel by default on wide rails.

Git status after correction 1:
- Nothing staged or committed (`git diff --cached` is empty).
- Correction files are as listed above. `docs/project/DESIGN_SYSTEM.md` and four test files are newly modified in this pass.
- Pre-existing and untouched: `.codex/config.toml` (M), `.claude/` (??).
- Two untracked files appeared on 2026-10-30 at 12:35 that this work did not create and did not touch: `logic_outline.txt` and `riverline_snapshot.txt`. Owner to check.
- Real-time video was not recorded; deterministic frames were captured instead.
- The two "heuristic" strings in Explain's Source block stay by rule (TERMS-HEURISTIC-001 for the rest of the app).
- The drill's RU/HE strings still await owner review.

## 1. Outcome

Varied and Focused drills (and Same Spot re-drills) now use the prototype layout (P1-24, PC first):

- **Drill head:** spot line (position · facing · table · effective stack · street), session dots, the one source/tier label ("Heuristic baseline · Estimated"), Feel popover (answer mode, the global Motion setting, keys), Adjust drill.
- **Felt:** every seat of the real table size around the oval, hero at the bottom, folded seats dimmed, the last action on each seat, pot and price in the centre (board above the pot postflop), hero cards flip in.
- **Fact tiles:** pot, to call, equity needed · Exact · price only, each with its derivation on hover, keyboard focus or tap. All values come from the DecisionContext (`currentPotBb`, `callAmountBb`, `actorContestablePotAfterCallBb`, `requiredRawEquity`); unknown shows `-`. In Hard the price tile reads "After you answer" until the answer.
- **Decision zone (reserved height, 248 px at 1920, measured identical in both states):** action cards (F/C/B·R/A keys, tinted by action colour, border-draw selection, others step back, check springs in) + Confirm carrying the action and amount; after two confirms the one-time "Answer with one click" prompt. On answer the zone swaps in place to the feedback: dominance verdict (dominant or "A or B · close"), inside/outside pill, 5%-step mix bar (under 5% hidden, labels inside, "you" tick below), one quiet line, then Next (the one canonical Next control) / Explain / Review later / Your plan. At the end of a bounded session Next becomes "Finish session" and the finish ring draws in the same zone.
- **Right rail:** five collapsible panel cards (Spot at a glance and Opponent's range open by default; This session; Your plan locked until answered; Similar spots), then the existing History, Assistance, Training Memory and Seed panels collapsed below.
- **Answer mode** is stored (`riverline_training_answer_mode`) and mirrored in Feel and in Settings › Language & Help.
- Full Hand is unchanged (its own table, action dock and sizing); switching to it restores the old placement of setup, controls and Next.

## 2. Step 0 — content inventory (current drill → new layout)

| Current item | New place | Note |
|---|---|---|
| Header "Training workspace / Make the decision", state badges | Idle/error only; hidden during a drill | Drill head carries state (dots) |
| Strategy source badge (`#trainingStrategySource`) | Drill head source/tier label | One label per surface (D-31) |
| Source limitation note | Kept above the drill | Honest scope note |
| Curriculum tags | Folded into the spot line | Street, position, table, facing, stack |
| Idle message + lineup preview | Kept (idle) with setup below it in the main area | Owner choice |
| Generating / error states | Unchanged | |
| Board + hero cards summary | Felt (board centre, hero cards above hero seat) | |
| Context strip (facing, position, stack, pot, players, street) | Spot line + fact tiles + Spot at a glance | |
| Pot odds / MDF (Easy, Guided) | Equity-needed tile (all levels; locked in Hard) and "MDF (range reference)" row in Spot at a glance (Easy/Guided) | |
| Guided prompt text | Unchanged (shown in Guided) | |
| Study hints (Get a hint) | Kept below the decision zone | |
| Decision prompt "What is your decision?" | Removed in quick mode | The zone itself is the prompt |
| Action buttons, digit keys | Action cards, letter keys, Confirm | Full Hand keeps digits and buttons |
| "I'm unsure" checkbox | Drill footer (U key) | |
| Keyboard hint | Drill footer, lists exactly the bound keys | |
| Skip / next exercise | "Skip" in the drill footer before answering; the same canonical Next button in the feedback row after | |
| Feedback badge, verdict text, provenance, facts, frequency rows, EV fact | Verdict + pill + mix bar in the zone; the full older feedback stays under Explain ("All details") | Nothing deleted |
| Same-spot comparison | Under Explain | |
| Review later / Mark difficult / Revisit in 24 hours | Review later mirrored in the feedback row (L key); all three under Explain | |
| Teach from this decision | Your plan panel and under Explain | |
| Explain (analysis) | Explain button (E key) opens All details with the analysis open | |
| Replay this decision, Adjust drill (continuation row) | Under Explain; Adjust drill also in the drill head | |
| Session progress panel, Reset session stats | This session panel (results by spot type, Reset) and dots | |
| Reference summary panel | Hidden during a drill (the head label carries it) | |
| Action history, Assistance, Training Memory, Seed/replay/diagnostics | Rail, collapsed under the five panels | |
| Session completion card | Finish ring card in the decision zone | Same three actions |
| Full Hand surfaces | Unchanged | |

Dropped: nothing. Moved behind one click: the deep feedback (Explain), Replay this decision, Mark difficult, Revisit.

## 3. Shared components (`app/src/ui/drill-components.mjs`)

Built for Training first and for Home, Analyze and Review later; all on `/__dev/component-sheet.html` (EN + HE columns, every theme):

- `createActionCard` / `selectActionCard`, `createConfirmButton` / `updateConfirmButton`, `createSizesRow` (sheet only in this ticket), `createAnswerModePrompt`, `createAnswerModeStore`
- `createFactTile` (derivation, locked state), `setRollingText` (moment 4)
- `createSourceTierLabel`
- `createVerdict`, `createMixBar` (LTR island, isolated name and share per segment, "you" tick below)
- `createPanelCard` / `setPanelCardOpen`
- `createSessionDots` (dots up to 20; a count beyond, or for open sessions), `createFinishRing` (CSS draw + `@property` count-up)
- `pokerIsland`

View model: `app/src/application/training-quick-drill.mjs` (seats and geometry, facts, action cards, key mapping, answer projection, session summary). Bridge: `training-quick-drill-bootstrap.mjs` (`window.RiverlineQuickDrill`). Verdict and mix reuse the existing `analyze-verdict` (`describeAnalyzeVerdict`, `presentStrategyMixActions`); no second rounding or dominance owner was added.

## 4. Motion

Tagged `data-motion="drill"` (tempo 0.7) on the drill and `"panel"` on the rail panels. Built: 1 border-draw selection + others to .5 + check spring; 3 verdict rise with 2 px blur bridge, segments fill in turn (360 io, 140 apart), "you" drop (spring), reason fade (+900); 4 rolling digits on the fact tiles between spots; hero-card flip-in (420, 90 apart); 11 dot fill (spring) and finish ring (900 io + count-up). Keyboard input is instant through the shared `data-motion-input="key"` rule; Reduced leaves only the ≤ 200 ms opacity fades (the zone swap). Only transform/opacity are animated, plus the spec'd blur bridge and SVG stroke offsets; hover is gated to fine pointers.

**Review-animations (applied by hand from `.agents/skills/review-animations`):**

| Before | After | Why |
|---|---|---|
| Panel open as height-to-content (prototype `grid-template-rows`) | Rows fade/slide 4 px on open only (`is-opening`) | No animated layout properties |
| `.rl-panel-card__chevron` with logical borders | Physical borders | Rotation pointed sideways in HE |
| Prototype ungated card/tile hover lift | Card lift and fact-tile derivation under `@media (hover: hover) and (pointer: fine)`; focus/tap equivalent for the derivation | Hover gating || Prototype JS `requestAnimationFrame` ring draw | SVG `stroke-dashoffset` keyframe on `pathLength=1` | No per-frame JS |

Verdict: **Approve with one owner decision**: the answer reveal (moment 3) takes ~1.3 s to the reason line on every pointer answer. It follows MOTION_SPEC and the ticket but conflicts with DESIGN_SYSTEM's "no growing bars on every answer" (DOC-MOTION-DRILL-REVEAL). Keyboard answers are instant. Not built: confirm morph, glow breath (TRAINING-QUICK-MOTION).

## 5. Differences from the prototype (with reasons)

1. Drill sits inside the workspace's decision panel and the SHELL-002 header carries "Training"; the prototype has no outer box. Shell and panel are owned by SHELL-002.
2. Source/tier label shown once (drill head), not also as a pill in the feedback. DESIGN_SYSTEM: one label per surface.
3. No sizes row in quick drills; the raise card shows the legal range and "Size is not graded" (owner decision; action type is all that is graded).
4. Real table size (2–10 seats), not always six (owner decision). On boards the pot line sits under the board; on short screens board cards use the mini size.
5. Fact tiles in Hard show "After you answer" for equity needed (owner decision).
6. "Save" is "Review later" (the existing persisted Training Memory action); no separate Save for drill decisions exists.
7. The reason line is the honest generic truth description, not a spot-specific sentence (no producer exists; TRAINING-QUICK-REASON).
8. Opponent's range uses the fixed per-position class sample (labelled Estimated, not action-conditioned); postflop and unopened spots say so (TRAINING-QUICK-RANGE). The prototype's "Opens about 27%" is not shown (would be UI maths on a fixed sample).
9. Your plan after answering shows the baseline's mix and "Not mapped yet" + Teach from this decision (TRAINING-QUICK-PLAN).
10. Finish ring appears in the decision zone instead of a dimmed modal overlay: no focus trap needed, the felt stays visible, no layout jump. Actions are the existing Review due items / Recent sessions / Start another session (no "outside ones" filter exists).
11. Next keeps the existing canonical button (one owner); label "Next spot" / "Finish session" with the Enter key chip.
12. Feel's Motion offers the four global modes (Instant/Faster/Standard/Reduced), not the prototype's two; it is the same one setting as Settings.
13. Answer-mode setting lives in Settings › Language & Help (no Training category; SETTINGS-TRAINING-CATEGORY).
14. Verdict at the DESIGN_SYSTEM display size (40 px dominant, 28 px close), larger than the prototype's 23 px.
15. Phone layout (chips, bottom dock, sheets) not built: PC first (P1-28); MOB-02.

## 6. Files

Changed by this ticket:
- `app/index.html` (drill block, rail panel mount, setup mount, finish ring mount, Settings answer-mode field, two script tags)
- `app/src/core/logic.js` (quick drill controller section + hooks in keyboard, state, buttons, answer, session start/finish, language refresh)
- `app/styles.css` (TRAINING-QUICK-001 section, placed before MOTION-FOUNDATION-001)
- `app/src/locales/i18n.js` (registers the new catalog)
- New: `app/src/ui/drill-components.mjs`, `app/src/application/training-quick-drill.mjs`, `app/src/application/training-quick-drill-bootstrap.mjs`, `app/src/locales/training-quick-translations.js`
- `tools/dev-pages/component-sheet.html`, `tools/dev-pages/component-sheet.mjs` (drill components section)
- `docs/ISSUE_REGISTER.md` (9 new rows, section C)
- Tests: new `tests/training_quick001_drill.test.mjs`; helpers `tests/helpers/browser-app.mjs` (answer selects then confirms; `openSetup`, `selectMode`, `openDetails`), `tests/tooling/audit_i18n.cjs` (new catalog); updated for the new behaviour: `decision_input_truth001`, `design004_component_system`, `design008_training_workspace`, `i18n001_runtime_integrity`, `i18n_residue001`, `motion_foundation001`, `training001_app_integration`, `training_composition001`, `training_composition001_correction1`, `training_composition001_lean_closeout`, `training_varied_session001`, `ux_regression001`, `layout_presets001_presentation` (idle setup sits in the drill's setup mount; history stays on the rail), `settings_ia001` (the new `training-answer-mode` preference in Language; inventory 12 → 13), plus mechanical `selectMode`/`openSetup` routing in `hands_on_defects001`, `perf001_product_performance`, `prelabs_fix001_training_layout`, `product_ui001_interactions`, `product_ui005_workspace_fit`, `training_f12_session_restart`, `training_hand_mode001_ui`. Each changed assertion says why (TRAINING-QUICK-001 comment); none was weakened to pass: old-contract checks were replaced by the new contract (letters + Enter, select + confirm, one row of cards, setup behind Adjust drill).

Pre-existing dirty, untouched: `.codex/config.toml` (M), `.claude/` (??).

## 7. Verification

Commands and results (Node 22.23.2, Windows):

- Focused: `node --test tests/training_quick001_drill.test.mjs` → 17/17 pass. After the last fixes, the affected suites were rerun together (`training_quick001_drill`, `training_composition001*`, `layout_presets001_presentation`, `ux_regression001`, `design008_training_workspace`, `product_ui005_workspace_fit`, `prelabs_fix001_training_layout`, `hands_on_defects001`, `analyze_composition001*`, `i18n001_runtime_integrity`, `training001_app_integration`, `uiqa002a_card_training_polish`, `settings_ia001`, `product_ui001_interactions`, `motion_foundation001`) → 180/180 pass.
- Syntax: `node --check` on `logic.js`, the four new app modules, `i18n.js`, `component-sheet.mjs`, `browser-app.mjs`, the new test and `audit_i18n.cjs` → all OK.
- Hygiene: `git diff --check` → clean. LF confirmed (`git ls-files --eol` i/lf w/lf on the large files; no CR in new files). `git diff --stat`: 31 files, +1433 / −52; no line-ending churn.
- Full suite: `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`
  - First run: 2843 tests, 2834 pass, **7 fail**. Causes and fixes:
    - `analyze_composition001`: a `!important` and two token rules failed in the CSS slice that ends at MOTION-FOUNDATION. I removed the `!important` (an `#trainingMode` prefix gives the specificity). The ring stroke now uses `--primary`. The outside session dot is drawn with an inset box-shadow, not a `--provenance` border.
    - `analyze_composition001_amend2`: a raw `320ms` in a transition. It now uses `var(--motion-table)`.
    - `layout_presets001_presentation`: the idle setup now sits in the drill's setup mount (owner decision). I updated the test and added a `grid-column: auto` reset for the moved panel.
    - `product_ui001_interactions`: a card click now needs Confirm. The test now confirms.
    - `settings_ia001`: the new `training-answer-mode` preference. Expected inventory is now 13.
    - `uiqa002a_card_training_polish` (2 tests): failed only under full-suite load. It passed 21 times out of 21 when run alone, and passed in both later full runs.
  - Second and final runs: 2843 tests, **2841 pass, 0 fail**. The 2 TODOs are pre-existing (TEST-HYGIENE-001-F01, -F07).
- Solver suite: not run (no domain, solver or strategy change).

Browser (Firefox headless via `tests/tooling/browser-runtime.mjs`, disposable profile). Script and output: `C:\Users\sjzns\Projects\Riverline_QA_2026-10\TRAINING-QUICK-001\` (`capture.mjs`, `report.json`, `side-by-side/`, `mockups/proto-*.png`).

- Configs: 1920×1080 EN Midnight · 1366×768 EN Midnight · 1920 HE Midnight (rtl) · 1920 EN Daylight · 1920 EN Slate.
- States per config: 0 setup · 1 before answer (one card selected) · 2 after inside · 3 panels open · 4 after outside · 5 finish ring. All 5 configs captured all 6 states, and every session reached the finish ring.
- 1366×768: felt bottom 389, action cards 557, Confirm 615 of 768. The focal object and the primary action fit without scrolling.
- Diagnostics: only `[Riverline Home]` startup console errors. These are pre-existing and seen in SHELL-002 captures too. Nothing new from Training.
- Found and fixed in the final pass:
  - Hebrew amounts inside sentences (seat actions, pot line, spot line, Confirm, raise range) read "bb 13.5". They are now isolated as LTR islands (LRI…PDI) and read "13.5 bb".
  - At 1366 the drill jumped down 18 px with an empty divider row when the answer landed. A legacy feedback-state surface border and an empty setup mount caused it. The spot line now stays put (93 → 93 px).
- Side-by-side with the prototype: `side-by-side/<config>-<state>.png`. Differences are listed in §5.

Visual status: **PARTIAL**. Real-browser checks were done in all the configs above. Human visual acceptance is the owner's. RU was checked only in the break-ui pass, not in the capture matrix.

## 8. Limitations and debt

New register rows: TRAINING-QUICK-PLAN, TRAINING-QUICK-RANGE, TRAINING-QUICK-REASON, TRAINING-QUICK-MOTION, TRAINING-QUICK-SIZES, I18N-OPEN-ACTION, I18N-RU-BASELINE, SETTINGS-TRAINING-CATEGORY, DOC-MOTION-DRILL-REVEAL. Not closed (partly addressed only by the new drill's mix bar; the older frequency rows under Explain are unchanged): QA-ANALYZE-COMPOSITION-004, I18N-HE-MIXBAR-LEGEND.

Also: break-ui was run as a live worst-case pass (RU, 1366, 10-max, 500 bb, Easy, open session) without building the dev "Demo / Worst case" toggle the skill describes. RU/HE strings for the drill are mine and await owner review. Human visual acceptance is the owner's.

## 9. Disagreements / doc conflicts

- DESIGN_SYSTEM "Drill actions… no growing bars on every answer" vs MOTION_SPEC moment 3 / P1-07 / this ticket (DOC-MOTION-DRILL-REVEAL). Built per the ticket.
- P1-03 "Settings › Training" does not exist yet (SETTINGS-TRAINING-CATEGORY).
- The riverline-design skill's "Confirm carries the action and amount" cannot carry a raise amount while quick drills grade the action only (owner decision recorded).

## 10. Git status

`git status --short` (branch `codex/stabilization`):

- Modified (this ticket): `app/index.html`, `app/src/core/logic.js`, `app/src/locales/i18n.js`, `app/styles.css`, `docs/ISSUE_REGISTER.md`, `tools/dev-pages/component-sheet.html`, `tools/dev-pages/component-sheet.mjs`, `tests/helpers/browser-app.mjs`, `tests/tooling/audit_i18n.cjs`, and 21 test files (listed in §6).
- Untracked (this ticket): `app/src/application/training-quick-drill.mjs`, `app/src/application/training-quick-drill-bootstrap.mjs`, `app/src/locales/training-quick-translations.js`, `app/src/ui/drill-components.mjs`, `tests/training_quick001_drill.test.mjs`, this report.
- Pre-existing, untouched: `.codex/config.toml` (M), `.claude/` (??).

Nothing was staged or committed (`git diff --cached` is empty). The commit is left for the owner after acceptance.
