# Riverline design system

The visual contract: design direction (Style v4), tokens, components, composition and stability rules, and the acceptance standard. It merges the former design-system document (tokens, components and cascade facts that match the code) with Design Language v2 (the Manager's 2026-10-12/13 spec, authoritative for direction). Direction comes from [NORTH_STAR §8](../NORTH_STAR.md#8-design-language); this file says how. A guide, not an ultimatum: the owner's judgement is final.

Where the target and the current code differ, both are stated: **Target** is what M1 builds toward, **Code** is what `app/styles.css` and `presentation-theme.mjs` do today. Values marked *provisional* are proposals to confirm on the PC (decisions D-10 to D-13 in [STATE.md](../STATE.md#open-decisions); D-14 resolved 2026-10-15).

Interaction semantics live in [INTERACTION_GRAMMAR.md](INTERACTION_GRAMMAR.md); terms and copy in [TERMINOLOGY.md](../TERMINOLOGY.md); theme values in `app/src/application/presentation-theme.mjs`.

---

## Identity and principles

**Riverline should feel like** a calm, premium study workstation: dark forest, jade and brass, rich felt, clean and modern (the look of the 2026-10 canvases, adapted to the real icons and card backs). Dense with useful information, never cramped; smooth and responsive; quietly confident.

**It must never look like** a casino (neon, jackpots, confetti, fake cinematic 3D, reward theatre), a generic admin dashboard, a phone app stretched onto a desktop, or an AI demo that explains itself in every line. Rejected for good: decorative gradients and accent borders, mockup-replacement icons, an arbitrary layout editor, Controls First, a Comfortable/Compact density toggle.

**Calm surface, deep data** (owner, 2026-10-14): clean, friendly and smooth at first glance, aiming for Apple-level polish; nearly all raw data one hover, click or expand away. Neither empty nor a wall of numbers.

**Three tests for every screen**
1. *Does it help the next decision?* Every element earns its place.
2. *Is it honest?* Numbers say where they come from; unknown looks unknown.
3. *Would a serious design do the job better?* Playful or unusual designs are welcome only when they work as well or better.

**Functionally correct but visibly sloppy is a product defect.** No clipping, no overlap and valid geometry are necessary, not sufficient.

**Same feature, same component, same behaviour everywhere.** History rails, card displays, action inputs, fact grids, tier badges, mix bars, seats and player rows are shared components that look and behave identically in Hand, Review, Analyze, Training, Full Hand, Equity and Saved. Rework diverging copies rather than adding new ones.

**State-aware compositions.** One canonical Hand or state can be shown in different ephemeral compositions, each led by its job: Play (table, actor, legal decision, pot, stacks, cards), Review (timeline, selected Hero decision, comparison, learning actions), Analyze (answer, reasons, evidence, provenance; table is context), Saved inspection (dense library plus compact preview), Personal Strategy (evidence, uncertainty, editing). Presentation never becomes poker, strategy or persistence authority.

**Colour never grants authority.** Colour accompanies wording and structure (assumptions, method badges, limitations); it never implies strategy authority or correctness.

Characters: original illustrated portraits (Cleo, Fern, Luma, Mika, Nova, Otto, Pip, Remy, Sol, Zig) are appearance only, never behaviour or real-person evidence; the current files are **TEMPORARY BETA ART** behind the asset lookup seam. Semi-abstract bot art (e.g. "Nebula", "Astra") is the M3 direction (NORTH_STAR §7.13).

---

## Style v4 (the app style)

Owner-approved direction, 2026-10-14. The app style comes from Analyze v4 and is shown on the design kit's "Style v4" board. Every screen, mockup and polish pass follows it.

- **Soft panels:** 16 px radius, a gentle vertical gradient (#1d2420 → #1a201d), a soft shadow, 22 px padding; panel titles in sentence case at 15 px / 650. No small-capital overlines except for tiny data labels. *(Code: flat panels, `--radius-panel` 10 px, no shadow in Midnight. Target values settled by D-14.)*
- **A hero answer card** wherever a screen gives an answer: the big result, small pills right beside it (closeness, confidence tier with a coloured dot), a thick mix bar with labels inside the segments, one plain sentence of why, the primary action, and "All details ›" for the raw data.
- **Number tiles** instead of fact tables for the 2–4 numbers that matter; full fact lists live behind "All details".
- **Pills** for chips, context and quick links (tinted when selected); content-sized, never long strips.
- **Buttons pop a little more:** primary = jade gradient with a soft glow; secondary = tinted fill with a hairline, not a bare outline.
- **Friendly language first:** the situation as a sentence ("You're on the button. CO opens to 2.5 bb."), raw values one step away.
- Still bound by: no real or pseudo dead space, calm surface / deep data, labelled large matrices, pointer feedback, one primary action per view.

### The design kit

The canonical base for mockups and for the M1 build: <https://claude.ai/artifact/SStpE2d5pkehonTDTfWadu> (shell template, components, table at a realistic size, Style v4 board). All screens re-drawn on it: <https://claude.ai/artifact/T3AFKWngjB7Wwt16S4Ghts>. The target look is these canvases, not the current app; only the real card backs and icons, and the current table's measurements, come from the app (MOCKUP-ASSETS-001).

Target values (Style v4 wins where the kit disagreed; owner decision D-14, 2026-10-15): panels 16 px radius and 22 px padding; buttons 40 px tall (44–48 for the main action); content capped at ~1640 px. Kit values (*provisional*): sidebar 240 px; header 56 px; page padding 28 px; gaps 24 px; right rail 340–400 px. *(Code: header 56, gutter 24, `--canvas-max` 1680, controls 36 px.)*

---

## Themes and colour

### Role tokens

All colours come from role tokens (canvas, shell, panel, elevated, interactive, hover, inset, lines, text 1–3, accent, on-accent, brass/provenance, status, action colours, felt, rail). Themes change token values only; components never hard-code colours (no literal jade or brass in components). Themes stay fully customizable: built-in presets (read-only; "Duplicate and customise" makes an editable copy) plus custom themes. Contrast rules apply to every theme, custom ones included.

| Role | Tokens | Rule |
|---|---|---|
| Canvas / shell / surfaces | `--surface-canvas`, `--surface-shell`, `--surface-panel`, `--surface-elevated`, `--surface-interactive(-hover)`, `--surface-inset` | inset = wells only |
| Text 1/2/3 | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled` | muted never below `--t-small` |
| Accent (act / selected) | `--accent-primary(-hover)`, `--text-on-accent`, `--accent-text`, `--border-focus` | one filled primary per view; selection = underline or tint |
| Provenance | `--provenance` (= `--support-text`) | source badges, nav group labels, provenance text; not warnings. Surfaces may rescope it |
| Caution | `--status-warning` | limitations, unavailable prices; callout with icon + text |
| Assumption | `--status-info` | hypothetical / assumed inputs |
| Positive / danger | `--status-positive`, `--status-danger` | state only |
| Felt / game | `--poker-felt-accent`, `--game-*`, `--table-*` | table stage only |
| Poker actions | `--action-fold/passive/aggressive/all-in/mixed` | poker data only (bars, matrix, action buttons, history) |
| Poker action text | `--action-fold-text`, `--action-passive-text`, `--action-aggressive-text`, `--action-all-in-text` | derived by `presentation-theme.mjs` from the stable hues to ≥ 4.5:1 on every study surface, custom themes included |

**Contrast rules** (all themes): text pairs ≥ 4.5:1; non-text pairs (check glyph vs fill, checkbox boundary vs surface, switch thumb vs track, track vs surface) ≥ 3:1; provenance vs `--action-aggressive` RGB distance ≥ 60. The component sheet measures the rendered pairs per theme.

**Colour use:** colour carries meaning only: the one primary action, selection, active step, action data (mix bars, action buttons), status, provenance (brass). No decorative accent borders, gradient washes or coloured left-border cards. The accent is never a text-hierarchy colour; provenance (brass) and the aggressive action colour stay visibly distinct.

### Midnight (default) = the mockup palette

canvas #101311 · shell #151a17 · panel #1a201d · elevated #202824 · interactive #222a26 · hover #2a342f · inset #171c19 · lines #303a35 / #46524c (subtle rgba(226,236,230,.08)) · text #f2f5f1 / #c1c8c3 / #8f9a94 · accent #42ad7b (hover/focus #58c18f, on-accent #07120d, 6.8:1) · brass/provenance #cdb67e · actions: fold #68716c, passive (check/call) #4f8f99, aggressive (bet/raise) #b27e4d, all-in #a85f70 · felt #2f6c52 → #1d4636 · rail #b9a777 → #6f6447.

Code facts: these are the pinned preset roles (`PRESENTATION_THEMES[midnight].roles`, applied only when the preset is not customized); status bases warning #d5a34b, info #57a6b6, positive #58c18f, danger #d0646b, each contrast-derived to ≥ 4.5:1 on every study surface. Graphite keeps its surfaces with the jade accent #42ad7b / #58c18f. Style v4 panel gradient and shadow are Target only.

### Daylight (*provisional*, D-12)

Target draft (language check canvas): canvas #f4f2ec · panel #ffffff · inset #f0eee7 · lines #dedad0 / #c9c4b7 · text #1a1d1b / #3f4642 / #5c6560 · accent #2f8a5f (on-accent #ffffff) · actions: fold #7b827e, passive #2f7480, aggressive #a5652f · felt #3d7d61 → #2a5c46. Action colours are darker than in Midnight to keep contrast on white.

Code today: Daylight accent deep jade #256044 / #1e4f38 (white text 7.4:1, ≥ 4.97:1 on every Daylight surface); Daylight never paints pure white (`--surface-elevated` #fefdfb). Reconcile in DS-TOKENS-V4.

### Custom themes and the table

- **The table can have its own theme** (felt, rail, card back, later chips), separate from the app theme, so a calm app can sit around a richer table. Appearance shows a live preview that includes a mini table; later Chippy, bot characters and chips.
- Custom-theme derivation (code): dark themes derive panel +6, elevated +10, interactive +10, hover +14, inset +1.5, borders +22/+32 lightness points over the user canvas; light themes shell −5, panel +5, elevated +7, interactive +2, hover −5, inset +1, borders −22/−34; `--border-subtle` is 45% of the default border; neutral study desks keep up to 10% saturation. Preset text roles are measured against the surfaces their CSS block actually paints (`PRESENTATION_THEMES[].surfaces` must mirror the preset block). Custom themes keep the user's accent; custom colours keep their source values while foregrounds are adjusted for contrast.
- **Startup:** the persisted theme resolves before meaningful content paints. An optional disposable prepaint cache holds only a derivative of the canonical theme library (revision/library matched, canonical fallback); bump its version when derived roles change.

---

## Type

- **UI font:** `--font-ui` "Avenir Next", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif. On Windows Firefox, Segoe UI Variable Text renders (a variable font, so 650/750 are true weights).
- **Numbers:** tabular digits everywhere (`body` sets `font-variant-numeric: tabular-nums`; `--font-data` resolves to `--font-ui`). Monospace (`--font-mono`) only for technical strings: `kbd`, `code`, `samp`, `.technical-id`.
- **Heading face (*provisional*, D-10):** the current UI font at heavy weight, or **Rubik** (owner leans Rubik; one family covers Latin, Cyrillic and Hebrew). Serifs rejected. Workspace titles, verdicts and big numbers only.
- **Line length:** explanatory text max ~70 characters per line.

### Scale

| Token / class | Size / line | Use |
|---|---|---|
| `--t-display` / `.t-display` | 40 px / 1.1 | one focal value per view; the dominant verdict |
| `--t-verdict-close` | 28 px / 1.2 | a close verdict only ([Verdict dominance](#verdict-dominance)) |
| `--t-title` / `.t-title` | 20 px / 1.3 | workspace and inspector titles |
| `--t-heading` / `.t-heading` | 15 px / 1.45 | section and panel headings |
| `--t-value` | 15 px / 1.4 | fact values and number tiles |
| `--t-body` / `.t-body` | 14 px / 1.5 | prose, controls |
| `--t-small` / `.t-small` | 12.5 px / 1.5 | metadata, row meta, field labels, badges; the product-text floor |
| `--t-label` / `.t-label` | 11 px / 1.4, tracking .06em | overline data labels only (uppercase; Hebrew: no uppercase) |

Nothing renders below 12 px except overline labels. Excluded: card faces, table SVG art, matrix cell glyphs, swatches, icon glyphs. `<small>` never drops below the small step. `--t-hero` is a legacy alias of `--t-display` (no new use). A test guards the floor (`tests/analyze_composition001.test.mjs`, uncommitted with the Analyze work).

### Weights

| Role | Target (owner: 650 for labels, controls and fact values) | Code today |
|---|---|---|
| `--weight-body` (prose, row meta, typed inputs) | 400 | 400 |
| `--weight-control` (buttons, chips, selects, tabs, segments, nav items, disclosure summaries) | **650** | 650 |
| `--weight-label` (field and overline labels, fact keys, `<strong>`) | **650** | 650 |
| `--weight-value` (fact values, tiles) | **650** | 650 |
| `--weight-heading` (`h1`–`h6`, panel titles in Style v4) | 650 | 650 |
| `--weight-title` (`.t-title`, list row titles, current nav item) | 700 | 700 |
| `--weight-section-title` (workspace header, section/inspector titles) | 750 | 750 |
| `--weight-display` (verdict, display values) | 800 | 800 |

The 600 → 650 change landed in TRUTH-FIXES-001. Surface CSS uses no literal weights: it maps to these roles. Card faces, table art, matrix cells and swatches keep theirs.

**Hierarchy** comes from colour role as well as size. Control text keeps its component's role. Verdicts are sentence case in primary text colour; action colour lives in the mix card. Action text roles (`--action-*-text`) remain for action-named text.

---

## Layout, space and stability

### Spacing and geometry (code)

- Spacing scale `--space-1…11` on a 4 px base (2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48). Roles: `--gap-control` 8, `--gap-group` 12, `--gap-section` 24, `--pad-control-block` 8, `--pad-control-inline` 12, `--pad-surface` 16 (dense) / `--pad-surface-reading` 24, `--gutter-canvas` 24, `--canvas-max` 1680, `--header-bar-height` 56. One spacing rhythm per screen.
- Radius: `--radius-cell` 4 (matrix cells, mini cards in rows), `--radius-control` 7 (buttons, fields, chips), `--radius-panel` 10 (surfaces, overlays), `--radius-pill` 999. `--radius-sm/md/lg` alias cell/control/panel. *(Style v4 target, D-14: panels 16, controls 7–8, chips fully rounded.)*
- Controls: `--control-height-md` 36 px (fields, md buttons, icon buttons), `--control-height-sm` 32 px (sm buttons, chips). *(Target, D-14: 40 px, 44–48 for the main action.)*
- Elevation, maximum nesting surface → group: group (no box; separated by `--border-subtle` or space) · surface (`--surface-panel`, 1 px `--border-default`, `--radius-panel`, `--elevation-surface`) · overlay (`--surface-elevated`, `--border-strong`, `--elevation-overlay`) · primary press (`--elevation-primary`, `--elevation-pressed`, primary buttons only) · field well (`--elevation-inset`, inputs only, never a nested box). `--elevation-feature` (Welcome, coach and Ranges & runouts cards) is legacy debt.

### Structure

- **Structure over boxes:** at most two containment levels (surface → section). Group with spacing and hairlines, not boxes inside boxes.
- **Free space** shows only already-available context relevant to the job (never hidden computation, fake recommendations or filler). If nothing qualifies, the layout tightens instead.
- **Space allocation:** space follows the importance of the information or action; panels do not get equal weight because they exist. Avoid both extremes: no oversized near-empty panels, no over-compressed tabs or rails. Use horizontal space; put related content side by side. Technical and semantic correctness beat mockup fidelity.
- **Table size** (*provisional*): a 900×470 table block (felt about 780×356) inside the shell at 1920×1080, closer to a real table; never a full-width table.

### Width and density rules (owner, app-wide)

- **No pseudo dead space** (top priority): no long strips whose content could fit in a fraction of the space: no wide inputs holding a short value, no rows with a label far left and its value far right, no lone badge at the end of a long line. Size to content, group tightly, use freed space for something useful.
- **No over-wide rows or bars.** Rows never push related values to opposite edges with dead space between them (history rails, ledgers, lists); use compact columns.
- **No dead zones** (> ~160×160 px) while useful information exists elsewhere.
- **Rows cope with any number of entries:** totals plus a count, details one click away (e.g. Game night rebuys).
- Size follows content; values never truncate.
- **Matrices:** small matrices may be plain coloured cells, but every cell shows its hand and mix on hover; large matrices show hand labels in the cells (mixed cells split by action colour), never a field of unlabelled squares.
- **Show states visually, not only in words:** e.g. an unknown hand is two face-down card backs, not just "Any two cards". Words may stay as support.

### Comfort contract (every redesign)

- Size follows content; no dead zones while useful information exists elsewhere.
- Focal object and primary action above the fold at 1920×1080 and 1366×768.
- Information preserved; clicks and scrolls never worse than before.
- One spacing rhythm; values never truncate; RTL correct.
- Fidelity differences from the mockup are listed with reasons.

A composition fails acceptance despite valid geometry when it has obvious orphan controls or almost-empty rows, unexplained dead space, tiny controls in oversized regions, poor balance or alignment, unnecessary wrapping, weak hierarchy, excessive equal-weight boxes, low-information panels taking large areas, dense critical information rendered too small, or a layout preset worse than the default. A control grid of four prefers 4×1 or 2×2 over 3+1.

### Stability rules (M1 foundation)

- Fixed workspace skeleton; reserved heights for regions that change (feedback strips replace answer areas in place).
- No reflow when inputs change; results never jump when they arrive.
- One app-ready moment (no asset pop-in or flicker).
- Hover never changes layout.
- Card size scale by context: inline / mini / standard / table; hero = board = dead within a context.
- One status or provenance indicator per surface (no repeated "Heuristic fallback").
- State changes preserve orientation: entering Replay, answering, completing a session, expanding Explain or producing a result must not recompose the workspace unnecessarily.

---

## Cascade contract (code)

One product stylesheet: `app/styles.css` (plus a small legacy inline `<style>` in `index.html`, listed as debt). No override layer.

1. **Token block:** the single top-level `:root` block at the top of `styles.css`. Preset blocks (`[data-theme]`, `html[data-theme]`) and the theme controller's inline properties override colour roles only, never the scales.
2. **Component layer:** the section marked `DS-FOUNDATION-001: component layer`. One rule set per component. Variants are attributes (`data-variant`, `data-size`, `data-tone`); legacy modifier classes are aliases awaiting migration. Geometry selectors stay at single-class specificity; variant colour selectors use `.ui-x:is(...)`.
3. **Surface sections:** workspace rules may place or size a component; restyling its colour, border, radius or type is migration debt, never a new variant.
4. **Relocated surface section:** the end of `styles.css` holds rules formerly in the retired `src/ui/riverline-design.css`, expressed with role tokens; they dissolve into per-workspace batches.

Components reference theme primitives directly (`var(--surface-inset)`, not a `:root` alias), because custom properties resolve where defined and surfaces rescope primitives. New code never adds `!important` to beat a component; delete the conflicting surface declaration instead. A component never carries a static `data-i18n` attribute on text that code rewrites.

---

## Components

Each exists once and is reused everywhere. Code inventory first, then the Style v4 shared components M1 builds (DS-COMPONENTS-V4).

### Code inventory (DS-FOUNDATION-001)

| Component | Markup | Variants / states | Notes |
|---|---|---|---|
| Button | `.ui-button` | `data-variant`: primary · secondary (default) · quiet · danger (+ `data-emphasis="quiet"`: danger-quiet) · icon; `data-size`: md · sm; `aria-pressed`, `:disabled`, `aria-busy` | Poker action buttons keep action colours and are peers (none accent-filled). Pressed toggle = elevated + underline. Disabled = inset + dashed |
| Field | `.ui-field` > label + control; `.control-input`, `.control-select`, native inputs | text, number, search, select (one height), textarea, number+slider `.ui-stepper` | Inset well, `--border-strong`; select caret mirrors in RTL |
| Checkbox / Radio | native inputs, optional `.ui-check` | checked, indeterminate, disabled | One shared glyph mask (never mirrors in RTL), `--text-on-accent` on the accent fill; disabled = dashed boundary |
| Switch | `.ui-switch` (`role=switch`) | on/off, disabled | Off: secondary thumb on inset; On: on-accent thumb on accent. Immediate preferences only |
| Segmented control | `.ui-segments` > `.ui-tab` | md · sm; selected via `aria-pressed`, `aria-selected`, `.active` or checked radio | Selected = elevated + accent underline, never an accent fill |
| Tabs | `.ui-tabs` > `[role=tab]` or `.ui-tabs-item` | selected | Underline navigation; radio items keep one tab stop and arrow keys |
| Chip | `.ui-chip` | filter (toggle, `.ui-chip-count`) · tag | Pressed filter = accent-tinted, not filled |
| Badge | `.ui-badge` (aliases `.status-badge`, `.badge`) | `data-tone`: neutral · info · caution · positive · danger; `data-variant`: source · count | Outlined; one line, content-sized |
| Callout | `.ui-callout` | caution · assumption · info | Icon + text, inline edge; never a full-width coloured box |
| Fact grid | `dl.ui-facts` > div > dt + dd | `--facts-min` | Label (overline) over value (`--t-value`); values wrap, never truncate; unavailable facts omitted and listed under limitations |
| Disclosure | `details.ui-disclosure` (alias `.study-disclosure`) | section · inline | Native `<details>` keyboard behaviour; Escape closes the innermost and returns focus to its summary |
| List row | `.ui-row` (+ `.ui-row-title`, `.ui-row-meta`) | `aria-current` / `aria-selected` | Rows inside a surface, no nested box |
| Poker data island | `.poker-island` / `[data-poker-island]` + `dir="ltr"` | — | Cards, amounts and card rows read left-to-right in every locale |
| Surface / overlay | `.panel`, `.overlay-surface`, `.modal` | — | Elevation surface / overlay |

Migration status: adopted families are Button, Field, Checkbox, Segmented, Chip, Badge, Disclosure, Poker island. Remaining families are tracked as DS-FOUNDATION-005 in the [register](../ISSUE_REGISTER.md).

### Style v4 shared components (target)

- **Buttons:** one accent-filled primary per view (Style v4: jade gradient with soft glow); secondary = tinted fill with a hairline; danger outlined in the danger colour; icon buttons labelled for screen readers.
- **Pills:** context, quick links and filter chips; content-sized; tinted when selected. Header context chips (Table rules, Game, Approach) open their picker, with "Manage…" leading to My poker.
- **Tabs and segmented controls:** selected = underline (tabs) or filled segment; never an extra "Selected" label (never double-signal a state).
- **Hero answer card:** see Style v4.
- **Number tiles:** 2–4 key numbers, value 15/650 tabular, label above; full list behind "All details".
- **Tier badge / pill:** Exact / Verified / Estimated / Unavailable; one per surface, fixed position, one-line reason on hover; scoped labels where needed ("Exact · price only", "Exact · known cards", "Exact · push/fold model"). No numeric confidence percentages.
- **Mix bar:** action colours, labels inside segments (Style v4), estimated values rounded to 5%, actions under 5% hidden, a "you" marker where relevant, hover tooltip per segment. Hebrew direction decided on the PC (D-13).
- **History rail:** vertical, street-grouped, compact three-column rows (marker, actor, action); Hero rows emphasised; selected row highlighted; key-moment dots; transparent backgrounds. Used by Replay, Review, Hand, Training, Full Hand, Orbit. The rejected horizontal action path stays rejected.
- **Cards:** inline 22×30, mini 30×42, standard 46×64 (also on the table), table/hero 58×82; four- or two-colour suits and T/10 from Settings. Every known card shows rank and suit identity across themes, colour modes and RTL. **Unknown cards are face-down backs**, never only words. Card back: the app's real back or the kit's modernised proposal (cream border, forest face, fine brass lattice, leaf mark), D-11.
- **Decision controls by mode** (*provisional*, D-05): (A) big action cards tinted in action colours, raise sizes inside the raise card, a confirm button that carries the amount; (B) round action buttons at the seat with a size chip bar and one cost line, click again to confirm. Both show each choice's cost (price, share of stack, stack after). Choosing Bet/Raise never silently submits a size.
- **Feedback strip:** replaces the decision area in place; "You chose X · Baseline: Y · close"; tier badge; mix bar with a "you" marker; one-line why; Next as the single accent action. Neutral wording ("inside / outside the baseline's mix"), never right/wrong for heuristic comparison.
- **Training panels** beyond the decision: the opener's likely range, this session's results by spot type, your plan plus the baseline revealed after answering; never leak the answer before submission.
- **Range matrix:** small = plain coloured cells with hand and mix on hover; large = hand labels in every cell, mixed cells split by action colours, axis labels, a hover card with combos and mix. Never mirrored in RTL.
- **Seats:** character (portrait or semi-abstract avatar), name, position, stack, state; folded seats dimmed; playstyle label visible by default (appearance never implies behaviour).
- **Ledger rows:** player, bought in (total + count, expandable with a chevron, not an "entries" label), cash out (money with chips beneath), net, actions (Rebuy, Cash out, Edit).
- **Empty states:** one line of what to do, one action; later an illustration or Chippy.

---

## Shell (SHELL-001)

Code since SHELL-001 (`bf90a55`); the shell and sidebar direction is being re-decided (D-03, SHELL-002). Behaviour in `app/src/application/workspace-header.mjs` (`workspace-header/v1`); CSS in the `SHELL-001: shell composition` section.

- **Header bar:** one 56 px bar per workspace. Start: `#workspaceTitle` (`--t-title`) and `#workspaceContext`, a one-line context of facts the workspace already rendered, joined with ` · `, each fact direction-isolated (`<bdi>`). End, in order: Hand/Scenario mode switch (Hand and Analyze only), strategy source badge, Learn Riverline, Help, Account. Each workspace's description opens from **Help** with its tutorials. The header mirrors by `dir` alone. Contexts are published by renderers that already have the facts (`RiverlineWorkspaceHeader.setContext`); the header computes nothing (PERF-001 counts unchanged).
- **Help panel and Tab order:** Help opens a non-modal panel with the workspace description and its tutorials; focus moves into it, Escape or Help closes it and focus returns to Help (`aria-expanded` reflects the state). Header Tab order: mode switch (Hand/Analyze), Learn Riverline, Help, Account; the source badge is a non-interactive note. Sidebar footer Tab order: Language (native select), Audio, Settings.
- **Context lines:** Home `Guest Mode` or name · sync state; Hand setup summary · street; Analyze `Scenario`/`Hand` · position · stack · street; Training mode · `Exercise n of N`; Personal Strategy Game · Approach; Equity `n players`; Saved `Showing n of m`; Home Game persistence · open session; Guide none.
- **Source badge placement:** shown only where strategy content is shown (Analyze; Hand while Review is open, never during live play; Training once feedback or the Full Hand review is visible; Personal Strategy while a comparison is open). It reads presentation state only and never changes when strategy information is revealed.
- **Canvas grid:** `--canvas-max` 1680 px (target ~1640 px, D-14); the canvas owns the 24 px gutter; every frame is `min(100%, --canvas-max)` centered and the header pads to the same start edge. Workspaces choose column templates inside the frame; they never set page margins or their own max widths.
- **Sidebar footer:** Language, Audio and Settings as one row of 36 px icon buttons (one column in the collapsed rail), each with `aria-label`, an `sr-only` label and one translated tooltip. Expanded nav items carry no tooltip; the collapsed rail sets one to the inline end. Target footer adds an About & legal link (NORTH_STAR §7.11).
- **One accent action per view:** at most one accent-filled control per state; legal poker actions are peers; transport controls and tutorial offers are secondary; switch tracks and selected segments are indicators, not actions.
- **Target shell** (D-03): brand at the top, clear groups, footer row with language, sound, settings and About & legal; header per workspace with title, one context line and the workspace's chips. Sidebar options: variant 4 (hubs with sub-items: Home, Study, Tools, Library, Game night), variant 2 (Home first, grouped by job: Study, Tools, Yours), or the current rail refreshed.

## List and inspector (SAVED-COMPOSITION-002)

Code since `0919e62`; first consumer Saved (both views). CSS places and sizes components only.

- **Toolbar:** one surface; view tabs on their own row, then the view's controls · Clear (quiet sm) · result count (muted, pushed to the end). Search grows; filter chips with counts; on/off filters are toggle chips with `aria-pressed`; select captions `sr-only`. Groups separated by a subtle inline-start rule. The row wraps, never scrolls horizontally.
- **List:** one surface; a column header row (`aria-hidden`) and `button.ui-row` rows on the same grid (poker island · title + meta · review · time; review and time stack below 1600 px). Selected = `aria-current="true"` (elevated + accent inline-start).
- **Inspector:** a second surface in a reserved end-side column (`clamp(380px, 30vw, 560px)`), sticky below the header bar, scrolling internally, action row stuck to its foot. Reserving the column keeps selection from moving the list. Below 1100 px it stacks under the list. Head: kind badge · title · truth line · Close. Actions: exactly one primary, secondaries, quiet Edit, destructive (danger-quiet) at the end.
- **Keyboard:** roving `tabindex` (one tab stop), Up/Down/Home/End select, Enter runs the row's primary action, Escape closes the inspector and keeps focus on the row.
- Sticky children need every ancestor up to the scroller at `overflow: visible`.

## Analyze (ANALYZE-COMPOSITION-001, uncommitted)

The current Analyze composition (backed up at `956ca6e`, acceptance pending as ANALYZE-ACCEPT); Phase 3 finishes Analyze in Style v4 (spot as sentence, hero answer card, tiles, "You here", labelled matrix).

- **Containers:** exactly two surfaces: the Spot rail (start side, `clamp(300px, 21vw, 340px)`) and the Result panel; they stack below 1100 px.
- **Spot rail:** Cards (Hero, board with street labels, dead cards) → Action (position + prior action; facing size and pot before action) → Table → disclosures "Strategy adjustment" (to be hidden, OWNER-12) and "Game & accounting". Same control ids, readiness gate and numeric-entry behaviour.
- **Hand context:** a decision handed off from a Hand or Full Hand review shows a read-only "Hand decision" section with exact facts, the route back and "Edit as Scenario"; any Scenario edit clears the Hand context.
- **Result header:** view tabs (Decision / Range matrix / Category comparison), Save spot, View all hands; under it the street stepper (Preflop → Flop → Turn → River; active step accent; reached streets show mini board cards).
- **Decision view:** verdict block beside the mix card → caution callouts → fact table → Explain. Explain stays collapsed by default (owner decision).
- **Fact table and fact-cell omission rule:** Position, Pot, Facing, To call, Stack, Hero hand, Pot odds (required equity), SPR, Board. An unavailable fact (e.g. a Scenario has no exact call price, so To call and Pot odds; SPR without one opponent and an exact pot) is not shown as a dash: its cell is hidden, the table reflows, and Provenance & limitations lists the omitted facts. The rule reads rendered values only; it computes nothing.
- **Source badge once:** the header badge names the source; the in-body badge shows only when the result's source differs.
- **Range matrix:** cells tinted by the dominant action (52% pure / 34% mixed; Daylight 42 / 26), fold neutral, unavailable cells dashed with a hatch; hover/focus shows the hand's mix.
- **Calm loading:** while an update is pending the verdict and mix fade; no size, position or display change.

### Verdict dominance

`app/src/application/analyze-verdict.mjs` (`analyze-verdict/v1`) reads the StrategyResult distribution; it never changes the recommendation, frequencies or claim policy. Exactly two states:
- **Dominant:** the leading action is at least 20 percentage points ahead of the next, or no other action reaches 5%: the verdict shows the leading action alone at display size.
- **Close:** otherwise: e.g. "3-Bet or Call · close" at the smaller size, with the shares on a line beneath. No third state ("leans" is not used). Ties follow the provider's order; labels are the provider's sentence-case action labels.

Estimated mixes are rounded to 5% and actions under 5% are not shown as part of the mix (Target; not yet in code, REVIEW-MATH-03).

---

## Composition principles

1. **Structure by spacing and hairlines, not boxes** (at most two containment levels).
2. **Three depths:** summary visible → detail on hover/focus (keyboard equivalent) → full detail on click/disclosure. Nothing is lost, only layered.
3. **One action colour language** (fold, check/call, bet/raise, all-in) through the same `--action-*` roles in mix bars, matrix, history, Replay, Training and Saved.
4. **Mini-visuals next to numbers** where they aid reading (inline mix bars, thin equity or stack bars), always paired with the number; never decorative or invented.
5. **Ledger numbers:** tabular digits, right-aligned numeric columns, muted smaller units.
6. **One object, one look:** hands, spots and decisions use the same object component everywhere.
7. **Free space shows relevant context** built only from facts the workspace already has; never hidden computation, fake recommendations or filler.
8. **Calm loading and motion:** skeletons, ~150 ms functional transitions from motion tokens, no layout jumps, reduced motion respected.
9. **Answer first:** primary job, next action and principal result are obvious; analysis presents answer, concise reason, key facts, deeper detail, then provenance and limitations. Don't duplicate the same evidence across equally prominent panels. Inputs stay coherent while configuring; after an action, the output gains hierarchy without destroying input context.

---

## Motion, feedback and sound

- **Smooth (default):** visible and pleasant, ~150–220 ms, ease-out: panels, tabs, the feedback strip, counters, skeleton fades.
- **Table motion:** deal, flip, chips to the pot, pot push: ~200–350 ms, physical and satisfying, never fireworks.
- **Quiet:** repeated high-frequency actions (drill after drill, scrolling lists) get minimal motion.
- **Expressive (rare):** session or orbit completion, milestones, Chippy, onboarding moments: up to ~600 ms.
- **Reduced motion:** follows the system or the in-app toggle (MOTION-001); removes movement but keeps short pauses so changes can be followed; never shortens Full Hand comprehension pauses.
- No motion ever shifts layout; motion never owns or delays poker truth (canonical state updates first).
- **Hover and press:** every control reacts to the pointer (hover lifts or brightens slightly, press gives a quick tactile response, hold where meaningful, clear focus rings). Mouse-first: the app must look and feel good before keyboard polish; the key contract still applies.
- **Sound (M1 first set):** one good set (cards, chips, a few study cues) with master volume and mute; realistic but softened, moderate level. Study cues are neutral synthesized tones and never sound like right or wrong; confirmation and disclosure sounds never imply correctness. Muting sound never removes a visual state change. Seek/hydration never replays world effects. The full per-category mixer comes later (NORTH_STAR §7.15).
- **Keyboard contract** (default proposal, low priority): F fold, C check/call, B/R bet or raise, A all-in, digits = size presets; U unsure, L review later, S save, E explain. Keys are configurable (M2 rebinding with clash check and reset); one key per action across screens; every workspace lists its keys in Settings › Shortcuts; a keyboard hint lists exactly the bound keys.

---

## Copy

- **Quiet copy:** don't state what the user already assumes; let the design show what's possible (a chevron, not "entries"); say only what helps the next action or prevents a mistake. Explanatory copy earns its space; no defensive filler; raw enum, schema or state identifiers never reach users.
- **Plain labels:** "Edit", not "Correct"; everyday words over system words, even when the data model is append-only underneath.
- **Never double-signal a state** (no "In use" / "Selected" / "Active" on something already highlighted).
- **No placeholder controls:** features that don't exist yet are not shown as disabled "coming later" controls (exception: About & legal once legal documents exist).
- **Honesty wording:** "inside the baseline's mix", "possible reading, not a verdict", "solution for these ranges and this tree"; never "correct" for heuristic agreement; never GTO/solver language for the heuristic.
- No em or en dashes in user-facing sentences; sentence case. Terms per [TERMINOLOGY.md](../TERMINOLOGY.md).

## Languages, RTL and accessibility

- EN, RU and HE are first-class. Stable copy enters the translation system; dynamic copy supports interpolation and units; translation never alters poker logic.
- **Russian length:** short labels grow 200–300%; design buttons and chips for the longest locale; let rows wrap gracefully.
- **Hebrew:** full right-to-left layout with logical CSS properties; cards, ranges, amounts, percentages and abbreviations stay left-to-right islands (`.poker-island`); the range matrix is never mirrored; masculine imperative buttons where natural.
- Switching language keeps everything open where it is.
- Semantic controls and headings, visible focus, keyboard workflows, truthful ARIA state, contrast, non-colour cues, reduced motion, readable status and error announcements. Hover has a keyboard-focus equivalent; touch gets an explicit tap model.

---

## Room for what comes later

The M1 refresh reserves space and patterns so M2/M3 features slot in without another redesign; every redesign ticket includes a "without later features" version of the screen.
- **Home:** room for "today's session", game-night hands, skill progress, later Chippy.
- **Training:** feedback strip with space for plan context (M3); session framing for Orbit; seat component ready for bot playstyles and "read the table" stats.
- **Review:** walkthrough layout ready for notes, the equity line and the hand story.
- **Equity:** layout that accepts the range grid (M2) and per-player runouts.
- **Library / My poker:** list-and-detail pattern that takes bot tables and custom playstyles (M3).
- **Settings:** categories for Chippy and About & legal; appearance preview that grows with tables, chips and characters.
- **Phone views (M3):** Game night and hand capture get phone-friendly pages; desktop stays first-class.

---

## Mockups and acceptance

- Mockups are visual references, never numeric specs; every number in a mockup, demo, lesson or test comes from the domain engine ("golden spots"). Mockup figures were found wrong in places.
- Screens without an approved mockup get one **before** they are built. New mockups are 1920×1080 on the design kit, with the real shell, icons and card backs unless the shell itself is being designed; some get RU, HE, Daylight or custom-theme versions.
- **Visual acceptance:** Firefox 1920×1080 at 100% primary; 1366×768 functional (the minimum supported desktop); EN/RU/HE; Midnight + Daylight; never "zoom out" as a fix. Larger widths (2560×1440/1600) when a ticket owns geometry. 1024×768 findings are compact/mobile future evidence. Mobile later gets its own composition, not stacked desktop panels.
- Structural CSS or no-overlap tests are evidence, not visual acceptance; without a browser, visual status is `UNVERIFIED`, `PARTIAL` or `STRUCTURAL ONLY`.
- Before M1 closes, the owner walks through every screen (the owner design pass).

## Component sheet (dev only)

`tools/dev-pages/component-sheet.html` renders every component and variant in EN and HE side by side through the real theme controller (in-memory storage) and real card faces, with a toolbar for the review themes (Midnight, Graphite, Daylight, custom sample accent `#e0a458`, surface `#1b2230`, felt `#5b3a6b`), card colours and style, and the rendered contrast table. Start `node tools/dev-web-server.mjs`, then open `http://127.0.0.1:3000/__dev/component-sheet.html` (`?theme=daylight` etc.). Not shipped, not in navigation.

## Open design decisions

Tracked in [STATE.md › Open decisions](../STATE.md#open-decisions): shell and sidebar variant and hub screens (D-03); My poker placement (D-04); decision controls (D-05); drill with or without a table (D-06); Equity layout (D-07); Learn mix (D-08); heading face (D-10); card back (D-11); Daylight values and table theme scope (D-12); Hebrew mix bar direction (D-13). Kit-number conflicts (D-14) are resolved: Style v4 values win (see Style v4 › The design kit).
