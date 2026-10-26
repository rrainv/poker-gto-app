# Riverline Design Language v2 (draft)

Status: draft by the Manager, 2026-10-12 (updated 2026-10-13 with the design kit), from NORTH_STAR §8, the 2026-10 design canvases and the owner's feedback (MOCKUP_REVIEW_LOG.md). It is the spec the M1 design refresh builds against; the docs reset folds it into `docs/project/DESIGN_SYSTEM.md`. Values marked *provisional* are proposals to confirm on the PC. A guide, not an ultimatum: the owner's judgement is final.

---

## 0. The design kit
The canonical base for mockups and for the M1 build: https://claude.ai/artifact/SStpE2d5pkehonTDTfWadu (shell template, components, table at a realistic size). All screens re-drawn on it: https://claude.ai/artifact/T3AFKWngjB7Wwt16S4Ghts. The target look is these canvases, not the current app; only the real card backs and icons, and the current table's measurements, come from the app (MOCKUP-ASSETS-001).

## 0b. Style v4 (owner-approved direction, 2026-10-14)
The app style comes from Analyze v4 and is shown on the design kit's "Style v4" board. Every screen, mockup and polish pass follows it:
- **Soft panels:** 16 px radius, a gentle vertical gradient (#1d2420 → #1a201d), a soft shadow, 22 px padding; panel titles in sentence case at 15 px / 650 (no small-capital overlines except for tiny data labels).
- **A hero answer card** where a screen gives an answer: the big result, small pills right beside it (closeness, confidence tier with a coloured dot), a thick mix bar with labels inside the segments, one plain sentence of why, the primary action, and "All details ›" for the raw data.
- **Number tiles** instead of fact tables for the 2–4 numbers that matter; full fact lists live behind "All details".
- **Pills** for chips, context and quick links (tinted when selected); content-sized, never long strips.
- **Buttons pop a little more:** primary = jade gradient with a soft glow; secondary = tinted fill with a hairline, not a bare outline.
- **Friendly language first:** the situation as a sentence ("You're on the button. CO opens to 2.5 bb."), raw values one step away.
- Remains bound by: no real or pseudo dead space, calm surface / deep data, labelled large matrices, pointer feedback, one primary action per view.

## 0c. Adopted from the independent design critique (Argon, 2026-10-15)
Build rules (accepted):
- **Tiers stay honest:** heuristic baseline output is labelled Estimated until measured; price facts are labelled "Exact · price only". (The prototype wrongly showed Verified.)
- **Comparison is size-aware:** a different bet size is a different choice; recompute every derived fact (multiple, stack after) when a size changes, and compare against the baseline for that size or say the size is not modelled.
- **No interactive elements inside buttons:** an action card is a group holding a select button and a separate row of real size buttons; every control works by keyboard.
- **In-place swaps use grid stacking,** not absolute positioning with a fixed height; the outgoing layer leaves fast (about 110 ms) before the incoming one enters (about 190 ms), so they never overlap.
- **Animate transform and opacity only:** mix bars grow with scaleX in about 240 ms; nothing animates width, left or height.
- **Accent means action, not approval:** the jade accent is for the one primary action, focus and navigation. Confidence tiers and "inside / outside the baseline's mix" use their own neutral colours, so green never reads as "correct".
- **Fonts are bundled locally** (no Google Fonts requests in the app: local-first and offline). If Rubik is used, ship the variable font so the 650/750 weights render properly.
- **Radius tokens:** 5 (badges, keys), 8 (inputs, nav, cards), 12 (buttons, action tiles), 16 (panels), full (pills).
- **Contrast fixes:** muted text on raised surfaces must stay at 4.5:1 (raise --t3 slightly); text on the fold colour in mix bars must be light; disabled-looking text never carries an instruction; interactive borders reach 3:1; session markers use shape as well as colour.
- **Focus ring:** a light outline with an accent halo, so it shows on accent buttons too.
- **Logical CSS everywhere** (inline-start/end), poker data isolated left-to-right, and sentences built from translation templates, never by concatenating English.
- **Settings-like toggles never live in a study rail;** before answering, the rail shows useful context, not a locked placeholder.
To test on mockups (proposals): corner-index card faces with a quicker, flatter deal (no 3D flip); a positional action breadcrumb plus pot and stack tiles instead of grey tags; a smaller, quieter Fold card so Call and Raise get the room; a crisp top hairline on panels instead of a soft drop shadow; faster micro-feedback (about 100 ms).
Owner decision needed: should a click on an action card submit at once (with Select-then-confirm and Hold as options), or stay select-then-confirm by default?

## 1. Identity

**Riverline should feel like** a calm, premium study workstation: dark forest, jade and brass, rich felt, clean and modern (the look of the 2026-10 canvases, which the owner likes, adapted to the real icons and card backs). Dense with useful information, never cramped; smooth and responsive; quietly confident.

**It must never look like:** a casino (neon, jackpots, confetti, fake 3D), a generic admin dashboard, a phone app stretched onto a desktop, or an AI demo that explains itself in every line.

**Calm surface, deep data** (owner, 2026-10-14): clean, friendly and smooth at first glance, aiming for Apple-level polish; nearly all raw data one hover, click or expand away. Neither empty nor a wall of numbers.

**Three tests for every screen**
1. *Does it help the next decision?* Every element earns its place.
2. *Is it honest?* Numbers say where they come from; unknown looks unknown.
3. *Would a serious design do the job better?* Playful or unusual designs are welcome only when they work as well or better.

---

## 2. Themes and colour

### 2.1 Role tokens
All colours come from role tokens (canvas, shell, panel, elevated, interactive, hover, inset, lines, text 1–3, accent, on-accent, brass, action colours, felt, rail). Themes only change token values; components never hard-code colours. Contrast rules apply to every theme, including custom ones.

### 2.2 Midnight (default)
canvas #101311 · shell #151a17 · panel #1a201d · elevated #202824 · interactive #222a26 · hover #2a342f · inset #171c19 · lines #303a35 / #46524c · text #f2f5f1 / #c1c8c3 / #8f9a94 · accent #42ad7b (hover #58c18f, on-accent #07120d) · brass #cdb67e · actions: fold #68716c, passive (check/call) #4f8f99, aggressive (bet/raise) #b27e4d, all-in #a85f70 · felt #2f6c52 → #1d4636 · rail #b9a777 → #6f6447.

### 2.3 Daylight (*provisional* first draft, from the language check canvas)
canvas #f4f2ec · panel #ffffff · inset #f0eee7 · lines #dedad0 / #c9c4b7 · text #1a1d1b / #3f4642 / #5c6560 · accent #2f8a5f (on-accent #ffffff) · actions: fold #7b827e, passive #2f7480, aggressive #a5652f · felt #3d7d61 → #2a5c46. Action colours are darker than in Midnight to keep contrast on white.

### 2.4 Custom themes and the table
- Built-in themes are read-only; "Duplicate and customise" makes an editable copy.
- **The table can have its own theme** (felt, rail, card back, later chips), separate from the app theme, so a calm app can sit around a richer table. Appearance shows a live preview that includes a mini table; later also Chippy, bot characters and chips.

### 2.5 Colour use
Colour carries meaning only: the one primary action, selection, active step, action data (mix bars, action buttons), status, provenance (brass). No decorative accent borders, no gradient washes, no coloured left-border cards.

---

## 3. Type

- **UI font:** "Avenir Next", "Segoe UI Variable Text", "Segoe UI", system-ui. Tabular digits for all numbers; monospace only for technical IDs.
- **Heading face (*provisional*):** the current UI font at heavy weight, or **Rubik** (owner leans Rubik for bolder headings; it covers Latin, Cyrillic and Hebrew in one family). Serifs rejected. Used for workspace titles, verdicts and big numbers only.
- **Scale:** label 11 (overline, small caps), small 12.5, body 14, heading 15, fact value 15, section title 20, display 40. Nothing below 12 px except overlines.
- **Weights:** body 400; **labels, controls and fact values 650** (owner); headings 650; titles 700; workspace titles 750; verdict/display 800.
- **Line length:** explanatory text max ~70 characters per line.

---

## 4. Layout, space and stability

### 4.1 Grid and spacing
- Spacing scale on a 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 48. One rhythm per screen.
- Kit values: sidebar 240 px; header 56 px; page padding 28 px; gaps 24 px; right rail 340–400 px; panels 12 px radius and 20 px padding; buttons 40 px tall (44–48 for the main action); content capped at ~1640 px.
- Radii: panels 12 px, controls 7–8 px, chips fully rounded.
- At most two containment levels; group with spacing and hairlines, not boxes inside boxes.
- Content canvas max ~1680 px with 24 px gutters; side rails 300–360 px; the primary area flexes.

### 4.2 Width and density rules (owner, app-wide)
- **No pseudo dead space** (top priority): no long strips whose content could fit in a fraction of the space: no wide inputs holding a short value, no rows with a label far left and its value far right, no lone badge at the end of a long line. Size to content, group tightly, and use freed space for something useful.
- **No over-wide rows or bars.** Rows never push related values to opposite edges with dead space between them; use compact columns.
- **No dead zones** (> ~160×160 px) while useful information exists elsewhere; no oversized near-empty panels; no over-compressed tabs or rails either.
- **Rows cope with any number of entries:** totals plus a count, details one click away (e.g. Game night rebuys).
- Size follows content; values never truncate.

### 4.3 Comfort contract (every redesign)
Focal object and primary action above the fold at 1920×1080 and 1366×768; information preserved; clicks and scrolls never worse than before; RTL correct; fidelity differences from the mockup listed with reasons.

### 4.4 Stability
Fixed workspace skeleton; reserved heights for regions that change (feedback strips replace answer areas in place); no reflow when inputs change; one app-ready moment (no pop-in or flicker); hover never changes layout; card size scale by context (inline / mini / standard / table; hero = board = dead within a context); one status or provenance indicator per surface.

---

## 5. Shell and sidebar (decision before M1 screen work)

- **Shell refresh** toward the canvas shell: brand at the top, clear groups, footer row with language, sound, settings and About & legal; header per workspace with title, one context line and the workspace's chips (e.g. Table rules).
- **Sidebar options still open** (shell refresh canvas):
  - **Variant 4, hubs with sub-items**, preferred *if* hubs earn real screens: **Tools** = recent work per tool (Hand, Analyze, Equity) with New buttons; **Study** = plan coverage, drill launcher (quick / long), review queue with reasons, learning path; **Library** = Saved items plus My poker setups with an inspector. **Home** stays a separate entity for app-wide content (continue, today's session invite, last game night, what Riverline noticed; later Chippy, news, achievements).
  - **Variant 2, Home first, grouped by job** (Study, Tools, Yours).
  - The current rail, refreshed, stays in consideration.
- "My poker" placement (own slot or merged into Library) is decided with the sidebar.

---

## 6. Shared components (same feature, same component, same behaviour)

Each exists once and is reused everywhere; diverging copies are reworked, not duplicated.

- **History rail:** vertical, street-grouped, compact three-column rows (marker, actor, action); Hero rows emphasised; selected row highlighted; key-moment dots; transparent backgrounds. Used by Replay, Review, Hand, Training, Full Hand, Orbit.
- **Cards:** inline 22×30, mini 30×42, standard 46×64 (also on the table), table/hero 58×82; four-colour or two-colour suits and T/10 from Settings. **Unknown cards are face-down card backs**, never only words. Card back: the app's real back, or the kit's modernised proposal (cream border, forest face with a fine brass lattice and the leaf mark).
- **Decision controls by mode** (*provisional*): the colour-tinted action cards suit the quick refresher; the round seat buttons suit table play (long sessions, Full Hand, Orbit). Directions: (A) big action cards tinted in action colours, raise sizes inside the raise card, a confirm button that carries the amount; (B) round action buttons at the seat with a size chip bar and a one-line cost, click again to confirm. Both show the cost of each choice (price, share of stack, stack after). Drills have a quick refresher mode and an atmospheric session mode.
- **Training panels** (beyond the decision): the opener's likely range, this session's results by spot type, and your plan plus the baseline revealed after answering; never leak the answer before submission.
- **Table size:** a 900×470 table block (felt about 780×356) inside the shell at 1920×1080, closer to a real table; never a full-width table.
- **Feedback strip:** replaces the decision area in place; "You chose X · Baseline: Y · close"; tier badge; mix bar with a "you" marker; one-line why; Next as the single accent action.
- **Range matrix:** small = plain coloured cells with the hand and mix on hover; large = hand labels in every cell, mixed cells split by action colours, axis labels, a hover card with combos and the mix; never a large field of unlabelled squares.
- **Mix bar:** action colours, values rounded to 5%, actions under 5% hidden. Direction in Hebrew decided on the PC (left-to-right data island vs mirrored).
- **Tier badge:** Exact / Verified / Estimated / Unavailable, one per surface, fixed position, one-line reason on hover. Scoped labels where needed ("Exact · price only", "Exact · known cards").
- **Fact grid:** label (11, overline) over value (15, 650, tabular); unavailable facts omitted, listed under limitations.
- **Seats:** character (human portrait or semi-abstract avatar), name, position, stack, state; folded seats dimmed; playstyle label visible by default.
- **Ledger rows:** player, bought in (total + count, expandable), cash out (money with chips beneath), net, actions (Rebuy, Cash out, Edit).
- **Tabs and segmented controls:** selected = underline (tabs) or filled segment; never an extra "Selected" label.
- **Buttons:** one accent-filled primary per view; secondary outlined; danger outlined in the danger colour; icon buttons with labels for screen readers.
- **Chips:** context chips in headers (Table rules, Game, Approach) open their picker with "Manage…" leading to My poker.
- **Empty states:** one line of what to do, one action; later an illustration or Chippy.

---

## 7. Motion, feedback and sound

### 7.1 Motion levels
- **Smooth (default):** visible and pleasant, ~150–220 ms, ease-out; panels, tabs, the feedback strip, counters, skeleton fades.
- **Table motion:** deal, flip, chips to the pot, pot push: ~200–350 ms, physical and satisfying, never fireworks.
- **Quiet:** repeated high-frequency actions (answering drill after drill, scrolling lists) get minimal motion.
- **Expressive (rare):** session or orbit completion, milestones, Chippy, onboarding moments: up to ~600 ms.
- **Reduced motion:** follows the system or the in-app toggle; removes movement but keeps short pauses so changes can be followed.
- No motion ever shifts layout.

**Reference timings from research (Argon, to test against the prototype):** hover and press feedback 80–120 ms; press scale 0.98 (never below 0.95); popovers and panels 180–220 ms in, about 25% faster out; tab and street switches crossfade around 140 ms without blocking input; bar morphs 220–260 ms; animate only transform and opacity.

### 7.2 Hover and press
Both mouse and keyboard should feel rewarding: hover lifts or brightens slightly, press gives a quick tactile response, focus rings are clear. Hover never changes layout. Mouse-first: the app must look and feel good before keyboard polish; the key contract still applies.

### 7.3 Sound (M1 first set)
One good sound set (cards, chips, a few study cues) with master volume and mute. Realistic but softened, moderate level. Study cues are neutral tones and never sound like right or wrong. The full per-category mixer comes later.

---

**Accessibility additions:** check the action colours (fold, call, raise, all-in) under red-green colour blindness and keep a second cue besides colour (labels, split widths, numbers on hover); the range matrix is one keyboard stop with arrow-key navigation; targets at least 36 px for main controls and matrix cells at least 28 px at 1366×768; a clearly visible focus ring on every coloured control.

## 8. Copy

- **Quiet copy:** don't state what the user already assumes; let the design show what's possible (a chevron, not "entries"); say only what helps the next action or prevents a mistake.
- **Plain labels:** "Edit", not "Correct"; everyday words over system words.
- **Never double-signal a state** (no "In use" on something already highlighted).
- **Honesty wording:** "inside the baseline's mix", "possible reading, not a verdict", "solution for these ranges and this tree"; never "correct" for heuristic agreement.
- No em or en dashes in user-facing sentences; sentence case.

---

## 9. Languages

- EN, RU and HE are first-class; terminology per TERMINOLOGY.md (Russian poker loanwords except пас; Hebrew loanwords; Latin abbreviations and position codes).
- **Russian length:** short labels can grow 200–300%; design buttons and chips for the longest locale; let rows wrap gracefully.
- **Hebrew:** full right-to-left layout; cards, ranges, amounts, percentages and abbreviations stay left-to-right islands; the range matrix is never mirrored; masculine imperative buttons where natural.
- Switching language keeps everything open where it is.

---

## 10. Room for what comes later

The M1 refresh reserves space and patterns so M2/M3 features slot in without another redesign:
- **Home:** room for "today's session", game-night hands, skill progress, and later Chippy.
- **Training:** feedback strip with space for plan context (M3); session framing for Orbit; seat component ready for bot playstyles and "read the table" stats.
- **Review:** walkthrough layout ready for notes, the equity line and the hand story.
- **Equity:** layout that accepts the range grid (M2) and per-player runouts.
- **Library / My poker:** list-and-detail pattern that takes bot tables and custom playstyles (M3).
- **Settings:** categories for Chippy and About & legal; appearance preview that grows with tables, chips and characters.
- **Phone views (M3):** Game night and hand capture get phone-friendly pages; desktop stays first-class.
- Every redesign ticket includes a "without later features" version of the screen.

---

## 11. Mockups and acceptance

- Mockups are visual references, never numeric specs; production numbers come from the engine.
- New mockups are 1920×1080; boards moved by accident are reset; smaller mockups sometimes get RU, HE, Daylight or custom-theme versions.
- Mockups should use the real shell, icons and card backs unless the shell itself is being designed.
- Visual acceptance: Firefox 1920×1080 at 100% primary; 1366×768 functional; EN/RU/HE; Midnight + Daylight; never "zoom out" as a fix.
- Before M1 closes, the owner walks through every screen (the owner design pass).

---

## 12. Open design decisions

Shell and sidebar variant; Tools hub screen; My poker placement; decision-control direction (A or B); drill with or without a table (both modes exist); Equity layout A or B; Learn A/B mix details; heading face (UI font vs Rubik); Hebrew mix bar direction; Daylight values; table theme picker scope.
