# Riverline design system

Owner since `DS-FOUNDATION-001` (October 2, 2026). This document owns visual tokens,
the component inventory and the cascade contract for product CSS. It implements the
direction of `VISUAL-DESIGN-REVIEW-2026-10` §B1/§B2 with the owner decisions below.
`PRODUCT_SPEC.md` owns product presentation intent; `INTERACTION_GRAMMAR.md` owns
interaction semantics; `presentation-theme.mjs` owns theme values. Human acceptance
is pending under `QA-DS-FOUNDATION-001`.

## Owner decisions (binding)

- Themes stay fully customizable (presets + custom themes). Components use **role
  tokens only**; no hard-coded accent ("jade") or brass values in components.
- **One accent-filled primary action per view.** The accent is whatever the theme sets.
- Selected tabs, segments and toggles are **not** accent-filled: elevated surface +
  accent underline.
- The existing icon set, card faces, felt/table treatment and `PokerPrimitives` are
  unchanged and outside this system's restyling scope.
- Provenance (brass) and the aggressive poker-action color stay visibly distinct.

## Cascade contract

One product stylesheet: `app/styles.css` (plus the small legacy inline `<style>` in
`index.html`, listed as debt). There is no override layer.

1. **Token block** — the single top-level `:root` block at the top of `styles.css`.
   Preset blocks (`[data-theme]`, `html[data-theme]`) and the theme controller's
   inline properties override color roles only, never the scales.
2. **Component layer** — the section marked `DS-FOUNDATION-001: component layer`.
   One rule set per component. Variants are attributes (`data-variant`,
   `data-size`, `data-tone`); legacy modifier classes are aliases awaiting markup
   migration. Geometry selectors stay at single-class specificity so surfaces can
   place and size components; variant color selectors use `.ui-x:is(...)`.
3. **Surface sections** — workspace rules. They may place or size a component;
   restyling its color, border, radius or type is migration debt, never a new variant.
4. **Relocated surface section** — the end of `styles.css` holds the surface rules
   formerly in the retired `src/ui/riverline-design.css`, in their old cascade
   position, expressed with role tokens. They dissolve into SHELL-001 and the
   per-workspace batches.

Rules: components reference theme primitives directly (`var(--surface-inset)`, not a
`:root` alias of it), because custom properties resolve where they are defined and
several surfaces rescope primitives (`--surface-inset: var(--evidence-surface)`).
New code never adds `!important` to win against a component; delete the conflicting
surface declaration instead.

## Tokens

### Type (UI font; numbers use `tabular-nums`; mono only for technical strings)

| Token / class | Size / line | Weight | Text role (color) | Use |
|---|---|---|---|---|
| `--t-display` / `.t-display` | 2.5rem (40px) / 1.1 | 800 (`--weight-display`) | primary | one focal value per view; the Analyze verdict when one action dominates |
| `--t-verdict-close` | 1.75rem (28px) / 1.2 | 800 | primary | the Analyze verdict for a close mix only ([Verdict dominance](#verdict-dominance)) |
| `--t-hero` / `.t-hero` | = `--t-display` | 800 | primary | legacy alias (was 3.5rem); no new use |
| `--t-title` / `.t-title` | 1.25rem (20px) / 1.3 | 700 (`--weight-title`) | primary | workspace and inspector titles |
| `--t-heading` / `.t-heading` | .9375rem (15px) / 1.45 | 650 (`--weight-heading`) | primary | section heading inside a surface |
| `--t-value` | .9375rem (15px) / 1.4 | 600 (`--weight-value`) | primary | fact-grid values (`.ui-facts dd`, the Analyze fact table) |
| `--t-body` / `.t-body` | .875rem (14px) / 1.5 | 400 | secondary | prose (callout text included), controls |
| `--t-small` / `.t-small` | .78125rem (12.5px) / 1.5 | 400 | muted (≥ 4.5:1) | metadata, row meta, field labels, badges, sm segments; the product-text floor |
| `--t-label` / `.t-label` | .6875rem (11px) / 1.4, `--t-label-tracking` | 600 | muted (≥ 4.5:1) | overline labels only (uppercase); in Hebrew no uppercase and the small size |

**Global type scale (ANALYZE-COMPOSITION-001).** The mockups' sizes are the app-wide
scale: body 14, small 12.5, label 11, heading 15, title 20, display 40; fact values
15/600. No product text renders below 12px except overline labels. Excluded: card
faces, table SVG art, matrix/range cell glyphs, theme swatches and icon glyphs.
Mechanics: literal sub-12px sizes moved to `--t-small` (uppercase ones to `--t-label`);
`--text-micro-size` now resolves to `--t-small` (uppercase rules that used it moved to
`--t-label`); badges, sm segments, chip counts, panel notes and legends moved from
`--t-label` to `--t-small`; `<small>` never drops below the small step
(`max(var(--t-small), .83em)`). `tests/analyze_composition001.test.mjs` guards the
floor. (History: the token tuning had title 22px / heading 17px and a 12px small step.)

Hierarchy comes from color role as well as size. The accent is **never** a
text-hierarchy color (it is reserved for the one primary action and selection
indicators); provenance (brass) is for provenance only. Control text (buttons,
segments, check labels) keeps its component's role. **Verdict color:** the Analyze
verdict is sentence case in primary text color (ANALYZE-COMPOSITION-001 supersedes the
earlier action-colored verdict for Analyze); action color appears in the mix card. The
action text roles (fold → `--action-fold-text`; check/call → `--action-passive-text`;
bet/raise → `--action-aggressive-text`; all-in → `--action-all-in-text`) remain for
`.t-hero[data-action]` and other action-named text.

Weights: `--weight-regular` 400, `--weight-medium` 500, `--weight-strong` 600,
`--weight-bold` 700, `--weight-heavy` 800 (the Analyze verdict / display values only).

**Weight roles** (SAVED-COMPOSITION-002 amendment 2: the mockups' weights): `--weight-body`
400 (body and prose, row meta, chip counts, typed inputs), `--weight-control` 600 (buttons,
chips, select values, tabs and segments, sidebar nav items, disclosure summaries),
`--weight-label` 600 (field and overline labels, fact keys, `<strong>`/`<b>`),
`--weight-value` 600 (fact-grid values), `--weight-heading` 650 (`h1`–`h6`),
`--weight-title` 700 (`.t-title`, list row titles, current nav item),
`--weight-section-title` 750 (workspace header title, panel/section titles, inspector
title), `--weight-display` 800 (= `--weight-heavy`: Analyze verdict, `.t-hero`,
`.t-display`). Surface CSS uses no literal weights: they map to these roles (≤450 body,
500–550 control, 600–650 label, 700–720 heading, ≥750 title; uppercase rules → label).
Card faces, table SVG art, matrix cells and swatches keep theirs.

**Font family:** `--font-ui` is "Avenir Next", "Segoe UI Variable Text", "Segoe UI",
system-ui, sans-serif (the mockups'). On Windows Firefox Avenir Next is not installed and
**Segoe UI Variable Text** renders (a variable font, so 650/750 are true weights).

**Overline labels** (uppercase eyebrows such as CARDS, POSITION): `--t-label` size,
`--weight-label`, `--t-label-tracking` (.06em), `--text-muted` (never the accent).

**Poker numbers** (bb amounts, pot, stacks, percentages, fact values) use the UI font:
`--font-data` now resolves to `--font-ui`, and `body` sets
`font-variant-numeric: tabular-nums`. `--font-mono` is for genuinely technical strings
only: `kbd`, `code`, `samp` and `.technical-id` (e.g. the Training history source
`id@version` in the inspector). LTR poker islands are unchanged.
Legacy names map onto the scale: `--text-body-size`, `--text-label-size`,
`--text-micro-size`, `--text-section-size`, `--text-display-size`,
`--text-overline-size` (→ `--t-label`, raising the old 10px floor to 11px).
`--text-page-title-size` (1.75rem) is no longer used by the header bar (SHELL-001); it
remains a legacy token.

### Spacing (4px base)

Scale `--space-1…11` (2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48). Layout roles:
`--gap-control` 8, `--gap-group` 12, `--gap-section` 24, `--pad-control-block` 8,
`--pad-control-inline` 12, `--pad-surface` 16 (dense) / `--pad-surface-reading` 24,
`--gutter-canvas` 24, `--canvas-max` 1680 (SHELL-001), `--header-bar-height` 56.
`--space-1/3/7/10` are legacy steps for existing geometry.

### Radius

`--radius-cell` 4 (matrix cells, mini cards in rows), `--radius-control` 7 (buttons,
fields, chips), `--radius-panel` 10 (surfaces and overlays), `--radius-pill` 999
(badges). `--radius-overlay`/`--radius-modal` now equal `--radius-panel`.
`--radius-card` belongs to card faces. `--radius-sm/md/lg` were referenced but never
defined (they rendered square); they now alias cell/control/panel.

### Elevation (maximum nesting: surface → group)

| Level | Token | Treatment |
|---|---|---|
| 0 group | — | no box; separated by `--border-subtle` rule or space |
| 1 surface | `--elevation-surface` (faint lift; Daylight sets a lighter one) | `--surface-panel`, 1px `--border-default`, `--radius-panel` |
| 2 overlay | `--elevation-overlay` | `--surface-elevated`, `--border-strong` |
| primary press | `--elevation-primary`, `--elevation-pressed` | tactile edge on primary buttons only |
| field well | `--elevation-inset` | input wells only, never a nested box |
| legacy | `--elevation-feature` | Welcome, coach and Ranges & runouts feature cards (debt) |

### Control geometry

`--control-height-md` 36px (fields, md buttons, icon buttons; `--control-height`),
`--control-height-sm` 32px (sm buttons, chips; `--control-height-compact`).

### Color roles

All values come from the theme owner (`presentation-theme.mjs` inline properties
and preset blocks). Components consume these names directly.

| Role | Tokens | Rule |
|---|---|---|
| Canvas / shell / surfaces | `--surface-canvas`, `--surface-shell`, `--surface-panel`, `--surface-elevated`, `--surface-interactive(-hover)`, `--surface-inset` | inset = wells only |
| Text 1/2/3 | `--text-primary`, `--text-secondary`, `--text-muted`, `--text-disabled` | muted never below `--t-small`; segmented/fact labels use secondary |
| Accent (act / selected) | `--accent-primary(-hover)`, `--text-on-accent`, `--accent-text`, `--border-focus` | one filled primary per view; selection = underline |
| Provenance | `--provenance` (= `--support-text`) | source badges, nav group labels, provenance text; not warnings. Surfaces rescope `--provenance` (e.g. `--analysis-support`) |
| Caution | `--status-warning` | limitations, unavailable prices; callout with icon + text |
| Assumption | `--status-info` | hypothetical / assumed inputs |
| Positive / danger | `--status-positive`, `--status-danger` | state only |
| Felt / game | `--poker-felt-accent`, `--game-*`, `--table-*` | table stage only |
| Poker actions | `--action-fold/passive/aggressive/all-in/mixed` | poker data only (bars, matrix, action buttons) |
| Poker action text | `--action-fold-text`, `--action-passive-text`, `--action-aggressive-text`, `--action-all-in-text` | derived by `presentation-theme.mjs` from the stable hues (`POKER_ACTION_COLORS`, mirrored in `styles.css`) to ≥ 4.5:1 on every study surface, custom themes included; `:root` holds pre-bootstrap fallbacks |

Contrast rules (all themes, custom included): text pairs ≥ 4.5:1; non-text pairs
(check glyph vs checked fill, checkbox/disabled-checkbox boundary vs surface, switch
thumb vs track, switch track or track boundary vs surface) ≥ 3:1; provenance vs
`--action-aggressive` RGB distance ≥ 60.
The component sheet measures the rendered pairs per theme.

## Midnight = the mockup palette (SAVED-COMPOSITION-002 amendment 2)

Supersedes the token tuning's Midnight colors and "deeper accent" values below (owner:
still not deep enough versus the mockups). Source of truth: the `.rl` block shared by
`mockup-saved.html`, `mockup-analyze.html` and `mockup-hand.html`.

- **Midnight surfaces:** canvas #101311, shell #151a17, panel #1a201d, elevated #202824,
  interactive #222a26, hover #2a342f, inset #171c19; borders #303a35 / #46524c, subtle
  rgba(226,236,230,.08); no surface lift (`--elevation-surface: none`).
- **Text:** #f2f5f1 / #c1c8c3 / #8f9a94. **Accent:** #42ad7b, hover/focus #58c18f, on-accent
  #07120d (6.8:1).
- **Pinned preset roles** (`PRESENTATION_THEMES[midnight].roles`, applied only when the
  preset is not customized): provenance/support #cdb67e; Analyze and evidence surfaces on
  the mockup panel/elevated/inset with its text roles; active nav #222a26; table felt
  #2f6c52 → #1d4636 and rail #b9a777 → #6f6447 (a drop-in token change; felt text 6.2:1).
- **Status** (`theme.status` bases, still contrast-derived): warning #d5a34b, info #57a6b6,
  positive #58c18f, danger #d0646b (the raw mockup value measures 4.01:1 on the interactive
  surface; the derivation lifts it to ≥ 4.5:1 on every study surface, 5.3:1 rendered there).
- **Poker actions** already equal the mockup (fold #68716c, passive #4f8f99, aggressive
  #b27e4d, all-in #a85f70); derived action text stays ≥ 4.5:1 in every theme.
- **Graphite and Daylight** keep their surfaces with the jade accent family: Graphite
  #42ad7b / #58c18f (on-accent #07120d); Daylight deep jade #256044 / #1e4f38 (hue 152, white
  text 7.4:1, ≥ 4.97:1 on every Daylight surface).
- Contrast (component sheet 40 pairs + 98 surface/accent/felt pairs) passes in Midnight,
  Graphite, Daylight and the custom sample.

## Token tuning (TOKEN-TUNING, final October 2, 2026; Midnight colors superseded above)

Owner choice after reviewing variants A (current), B (more depth) and C (tighter): a mix,
applied only through the `:root` block, the preset blocks and the theme derivation in
`presentation-theme.mjs`. A was rejected. Evidence: `Riverline_QA_2026-10/tuning/index.html`.

- **Colors (B):** clearer canvas / surface / well separation, stronger borders and row
  separators, a faint surface lift, a slight tint on neutral study desks.

  | Role | Midnight | Daylight |
  |---|---|---|
  | `--surface-canvas` | #081312 | #e2ddd2 |
  | `--surface-shell` | #0d1f1c | #d9d3c6 |
  | `--surface-panel` | #1f3734 | #fbfaf6 |
  | `--surface-elevated` | #2c4844 | #fefdfb (Daylight never paints pure white, UI-QA-001) |
  | `--surface-interactive` / `-hover` | #2e4a45 / #3a5d53 | #ece7de / #ddd5c7 |
  | `--surface-inset` | #10221f | #e5dfd3 |
  | `--border-subtle` | rgba(226,236,230,.14) | rgba(43,52,47,.16) |
  | `--border-default` / `-strong` | #4b685e / #6f9183 | #bcb4a6 / #978f82 |
  | `--text-muted` | #b4c5ba (unchanged) | #545e58 |
  | `--elevation-surface` | inset 1px white 3.5% + 0 2px 6px black 32% (`:root`) | 0 1px 2px + 0 2px 8px warm 7%/5% |

- **Accents (presets only):** same hue, a little darker. Midnight `#8ad7b0` → `#73cfa1`
  (hover/focus `#8ddeb3`; on-accent text 10.1:1); Daylight `#267457` → `#21654b` (hover
  `#1a523d`; on-accent 6.9:1). Derived roles (accent text, focus, selection, support/
  provenance, navigation) follow from the preset `preview.accent`. Custom themes keep the
  user's accent.
- **Derived text roles:** preset themes now measure accent-text and status roles against the
  surfaces their CSS block actually paints (`PRESENTATION_THEMES[].surfaces`, which must
  mirror the preset block), not a palette derived from the preview color. This is what keeps
  status/accent text at ≥ 4.5:1 on every resting surface.
- **Custom-theme derivation:** dark: panel +6, elevated +10, interactive +10, hover +14,
  inset +1.5, borders +22/+32 (lightness points over the user canvas); light: shell −5,
  panel +5, elevated +7, interactive +2, hover −5, inset +1, borders −22/−34;
  `--border-subtle` 45% of the default border. Neutral study desks keep up to 10%
  saturation of the theme surface; the light desk sits 3 points above the canvas.
- **Geometry:** `--radius-panel` 10, `--radius-control` 7. Spacing roles unchanged (B).
- **Type:** heading sizes from C (title 1.375rem/1.25, heading 1.0625rem, display 2.5rem);
  C's heavier 750 headings were reduced by the amendment to the weight roles (titles 700,
  headings 650); body unchanged.
- **Contrast:** component sheet 40/40 and 95 text-on-surface pairs pass in Midnight, Graphite,
  Daylight and the custom sample (accent #e0a458, surface #1b2230, felt #5b3a6b). The
  control-hover surface is checked for primary/secondary text only.
- The prepaint cache version is `beta-b-2` so no stale derived roles paint first.

## Components

| Component | Markup | Variants / states | Notes |
|---|---|---|---|
| Button | `.ui-button` | `data-variant`: primary · secondary (default) · quiet · danger (+ `data-emphasis="quiet"`: danger-quiet) · icon; `data-size`: md · sm; `aria-pressed`, `:disabled`, `aria-busy` | Aliases `--primary`, `--secondary`, `--tertiary` (= secondary sm), `--quiet`/`--ghost`, `--danger`/`--destructive`, `--icon`. Poker action buttons (`--poker-*`) keep action colors. Pressed toggle = elevated + underline. Disabled = inset + dashed. |
| Field | `.ui-field` > label text + control; `.control-input`, `.control-select`, native inputs/selects | text, number, search, select (one height), textarea, number+slider `.ui-stepper` | Inset well, `--border-strong`, select caret mirrors in RTL. |
| Checkbox / Radio | native `input[type=checkbox|radio]`, optional `.ui-check` label | checked, indeterminate, disabled | One shared glyph: `--check-glyph` / `--indeterminate-glyph` SVG masks (12px, 2px round stroke, optically centered) on `::before`, painted `--text-on-accent` on the accent fill; masks never mirror in RTL. Boundary `--text-muted`; disabled = dashed `--text-disabled` boundary, no fill, disabled label color. Keyboard/semantics native. |
| Switch | `.ui-switch` (`role=switch`/`aria-checked` or `aria-pressed`) | on/off, disabled | Off: `--text-secondary` thumb on `--surface-inset`, `--text-muted` boundary. On: `--text-on-accent` thumb on `--accent-primary`. Immediate preferences only. |
| Segmented control | `.ui-segments` > `.ui-tab` (buttons or radio labels) | `data-size` md · sm; selected via `aria-pressed`, `aria-selected`, `.active`, or a checked radio | Selected = elevated + accent underline. |
| Tabs | `.ui-tabs` > `[role=tab]` or `.ui-tabs-item` (label + native radio) | selected (`aria-selected` or a checked radio) | Underline navigation between views. Radio items keep one tab stop and arrow-key switching (Saved items \| Training history). |
| Chip | `.ui-chip` | `data-variant`: filter (toggle, `.ui-chip-count`) · tag | Pressed filter = accent-tinted, not filled. |
| Badge | `.ui-badge` (aliases `.status-badge`, `.badge`) | `data-tone`: neutral · info · caution · positive · danger; `data-variant`: source · count | Toned and source badges are outlined; one line, content-sized. |
| Callout | `.ui-callout` | `data-tone`: caution · assumption · info | Icon + text, inline edge; never a full-width colored box. |
| Fact grid | `dl.ui-facts` > div > dt + dd | `--facts-min` | Values wrap, never truncate. |
| Disclosure | `details.ui-disclosure` (alias `.study-disclosure`) | section · `data-variant="inline"` | Native `<details>` keyboard behavior. |
| List row | `.ui-row` (+ `.ui-row-title`, `.ui-row-meta`) | `aria-current`/`aria-selected` | Rows inside a surface, no nested box. |
| Poker data island | `.poker-island` / `[data-poker-island]` + `dir="ltr"` | — | Cards, amounts and card rows read left-to-right in every locale. |
| Surface / overlay | `.panel` / `.overlay-surface`, `.modal` | — | Elevation 1 / 2. |

Text rule: a component never carries a static `data-i18n` attribute on text that code
rewrites; dynamic writers set the text (or rebind the key) themselves.

## Shell (SHELL-001)

Owner since `SHELL-001` (October 2, 2026); human acceptance pending under
`QA-SHELL-001`. CSS lives in the `SHELL-001: shell composition` section at the end
of `styles.css`; behavior in `app/src/application/workspace-header.mjs`
(`workspace-header/v1`).

**Header bar.** One 56px bar (`--header-bar-height`) per workspace. Start side:
`#workspaceTitle` (`--t-title`) and `#workspaceContext`, a one-line context of facts
the workspace already rendered, joined with ` · `, each fact direction-isolated
(`<bdi>`), muted when absent. End side, in this order: the Hand/Scenario mode switch
(`#workspaceModeSwitch`, Hand and Analyze only; Segmented sm), the strategy source
badge (Badge, `data-variant="source"`), Learn Riverline, Help, Account. No eyebrow
and no description line: each workspace's description (`data-mode-subtitle`, or a
workspace override such as Home's Guest/account sentence) opens from **Help**
together with that workspace's tutorials. The header mirrors by `dir` alone.

| Workspace | Context line (existing facts) |
| --- | --- |
| Home | `Guest Mode`, or display name · sync state |
| Hand | setup summary (`6 players · Hero BTN · 100 bb`) · shown street |
| Analyze | `Scenario` or `Hand` · Hero position · stack · street |
| Training | session mode · `Exercise n of N` (Varied) |
| Personal Strategy | Game Setup · Approach |
| Equity | `n players` |
| Saved | `Showing all n` / `Showing n of m` |
| Home Game | persistence · open session title |
| Guide | none |

Contexts are published by the renderers that already produce those facts
(`RiverlineWorkspaceHeader.setContext`); the header performs no strategy, Equity or
state computation (PERF-001 counts unchanged).

**Source badge placement.** Shown only where strategy content is shown: Analyze;
Hand while the review surface is open (never during live play); Training once an
answer's feedback or the Full Hand review is visible; Personal Strategy while a
comparison surface is open. Hidden on Home, Saved, Equity, Home Game and Guide.
The rule (`shouldShowSourceBadge`) reads presentation state only; it never changes
*when* strategy information is revealed. In-surface source labels (Analyze result
pill, Training rail source) remain and belong to their workspace batches.

**Canvas grid.** `--canvas-max` 1680px; the canvas owns the 24px gutter
(`--gutter-canvas`); every frame (`workspace-frame--standard/wide/dense`, Home Game,
Guide) is `min(100%, --canvas-max)` centered, and the header pads to the same start
edge. Workspace roots keep block padding only. Workspaces choose column templates
inside the frame (rail + main + rail, list + inspector, main + rail, main); they never
set page margins or their own max widths.

**Sidebar footer.** Language, Audio and Settings are one row of 36px icon buttons with
the existing icons (one column in the collapsed rail). Names: `aria-label` plus an
`sr-only` label; one translated tooltip each (`data-tooltip` + `data-i18n-tooltip`;
the audio tooltip is written by SoundFX). Expanded nav items carry no tooltip; the
collapsed rail sets a translated tooltip to the inline end.

**One accent action per view.** At most one accent-filled (`primary`) control is
visible per state; legal poker actions are peers (none accent-filled); transport
controls and tutorial offers are secondary; a list shows a primary only for its
first continuation. Switch "on" tracks and selected segments are selection
indicators, not actions.

## List and inspector (SAVED-COMPOSITION-002)

Owner since `SAVED-COMPOSITION-002` (October 2, 2026; human acceptance pending under
`QA-SAVED-COMPOSITION-002`). First consumer: Saved (both views). CSS: the
`SAVED-COMPOSITION-002` section in `styles.css`; it places and sizes components only.

- **Toolbar** — one Surface (`.panel`): the view Tabs (underline, radio items) on their
  own row at the top, then one row of the view's controls · Clear (quiet sm) · result count (`--t-small`, muted, pushed to the end
  with `margin-inline-start: auto`). Search grows (`flex: 1 1 220px`); filter chips are
  `.ui-chip[data-variant="filter"]` with counts; on/off filters are toggle chips with
  `aria-pressed`, not checkboxes; select captions are `sr-only` (the first option names
  the filter). Groups are separated by a `--border-subtle` inline-start rule. The row
  wraps; it never scrolls horizontally.
- **List** — one Surface: a column header row (`.saved-list-head`, overline labels,
  `aria-hidden`: rows carry their own labels) and `button.ui-row` rows on the same grid.
  Columns: poker island (`--saved-row-cards` 14.5rem) · title + meta · review
  (`--saved-row-review` 12rem) · time (`--saved-row-time` 6.5rem); below 1600px review and
  time stack in one column. An empty review cell keeps its column. Row titles 500, meta 400. Selected
  = the List row's `aria-current="true"` treatment (elevated + accent inline-start).
- **Inspector** — a second Surface in a reserved end-side column
  (`--saved-inspector-width: clamp(380px, 30vw, 560px)`), `position: sticky` below the
  header bar, scrolling internally; its action row sticks to its foot on the panel
  color. Reserving the column is what keeps selection from moving the list; with nothing
  selected it is a calm full-height panel with a centered message and keyboard hint. Below 1100px the inspector stacks under the list and is not sticky.
  Head: kind Badge (neutral) · `--t-title` title · `--t-small` truth line · quiet sm Close.
  Body: preview, Fact grid (`--facts-min: 7rem`), labelled sections. Actions: exactly one
  primary, secondaries, quiet Edit, and a destructive action pushed to the end.
- **Keyboard** — roving `tabindex` (one tab stop), Up/Down/Home/End select and focus,
  Enter runs the row's primary action, Escape closes the inspector and keeps focus on
  the row; re-renders return focus to the same control.
- **Button addition** — danger-quiet: `.ui-button[data-variant="danger"][data-emphasis="quiet"]`
  (danger text, no fill or border at rest; the danger hover). For a destructive action
  that is not the view's focus (Archive).
- Scroll note: a sticky child needs every ancestor up to the scroller to be
  `overflow: visible`; Saved sets `#homeMode[data-product-destination="saved"]`
  to `overflow-y: visible` because the document, not the mode view, scrolls.

## Composition principles

Owner-approved in `ANALYZE-COMPOSITION-001` (October 3, 2026). They apply to every
workspace batch; Analyze is the first consumer.

1. **Structure by spacing and hairlines, not boxes.** At most two containment levels
   (surface → section). Sections are separated by space and `--border-subtle` rules.
2. **Three depths.** Summary visible → detail on hover/focus (keyboard equivalent) →
   full detail on click/disclosure. Nothing is lost, only layered.
3. **One action color language** (fold, check/call, bet/raise, all-in) through the same
   `--action-*` roles in mix bars, matrix, history, Replay, Training and Saved badges.
4. **Mini-visuals next to numbers** where they aid reading (inline mix bars, thin equity
   or stack bars), always paired with the number; never decorative or invented.
5. **Ledger numbers:** tabular digits, right-aligned numeric columns, muted smaller units.
6. **One object, one look:** hands, spots and decisions use the same object component
   everywhere.
7. **Free space shows context relevant to the job**, built only from facts the workspace
   already has: never hidden computation (PERF-001), fake recommendations or filler. If
   nothing qualifies, the layout tightens instead.
8. **Calm loading and motion:** skeletons, ~150ms functional transitions from motion
   tokens, no layout jumps when results arrive, reduced motion respected.

## Analyze (ANALYZE-COMPOSITION-001)

Owner since `ANALYZE-COMPOSITION-001` (October 3, 2026; human acceptance pending under
`QA-ANALYZE-COMPOSITION-001`). Visual base: `mockup-analyze.html` (frames `#a-en`,
`#a-he`); product rules win. CSS: the `ANALYZE-COMPOSITION-001: Analyze composition`
section at the end of `styles.css`, scoped to
`html[data-layout-preset] #gtoMode[data-product-destination="analyze"]` (Hand keeps its
own composition). It places and sizes components only.

- **Containers.** Exactly two Surfaces: the Spot rail panel (`#playbookSpotPanel`, start
  side, `--analyze-rail-width: clamp(300px, 21vw, 340px)`) and the Result panel (the
  `.playbook-decision-workspace` itself). Analysis Focus mirrors the order; below
  1100px they stack. Everything else is a section. No context column is rendered: no
  existing owner provides per-decision card-removal/blocker facts without extra work
  in the Decision view, and the lossy-context sentence lives in Provenance (principle 7).
- **Spot rail.** Head: "Spot", the live indicator and the quiet randomize controls.
  Sections: Cards (Hero hand, board with Flop/Turn/River labels, dead cards) → Action
  (position + prior action pair; facing size and pot before action as slider + value
  rows) → Table (table size, stack setup, starting stack) → disclosures "Strategy
  adjustment" and "Game & accounting" whose summaries show the current values. Same
  control ids, readiness gate and numeric-entry behavior (`INTERACTION_GRAMMAR.md`).
  The saved-spot banner is a rail section.
- **Hand context.** A decision handed off from a completed Hand or a Full Hand review
  (`setAnalyzeHandContext`) shows a read-only "Hand decision" section (title, exact
  facts: position, street, Hero hand, board, pot, to call, stack) with the existing
  route back (Back to Hand / Back to Training, i.e. the navigation destination) and
  "Edit as Scenario", which reveals the Scenario sections. Any Scenario edit clears the
  Hand context (it becomes a lossy Scenario), like the saved-spot context. The header
  context reads "Hand".
- **Result header.** View Tabs (Decision / Range matrix / Category comparison, underline
  selection) on the start side; Save spot (secondary, sm) and View all hands (quiet, sm)
  on the end side. Under it the **street stepper**: the existing Action path panel and
  renderer, always in the compact mount, one row (Preflop → Flop → Turn → River) with
  per-street context; the active step carries the accent.
- **Decision view**, top to bottom: verdict block (provenance eyebrow "Heuristic baseline
  · Preflop", verdict, optional close-mix line, one-sentence summary at 15px, the
  honest-limits line) beside the mix card (inset well, stacked bar + per-action mini bars
  and percentages) → caution callouts (existing text) → fact table → Explain.
- **Fact table.** One bordered table with hairlines: Position, Pot, Facing, To call,
  Stack, Hero hand, Pot odds (required equity), SPR, Board. Labels 11px overline muted;
  values `--t-value` 15/600, wrap, never truncate, `unicode-bidi: plaintext` (LTR for
  amounts and cards in Hebrew). Facing reads `decision-facing-summary/v1` (a voluntary
  wager shows its size; unopened / limped / option / check available say so); To call is
  the exact canonical price, or "price unavailable" for a Scenario
  (`DECISION_CONTEXT_SPEC.md` §10).
- **Explain.** Inline section: "EXPLAIN" overline, Facts | Explain depth (Segmented sm;
  Facts collapses, Explain opens the existing explanation; collapsed by default), the
  hint, and "Teach from this decision" (secondary). The explanation renders flat: "Why
  this action?" headline (title size) and summary, then Hero state | Decision economics
  | Bluff & pressure as three columns separated by thin rules, then the renderer's own
  sections and disclosures; no inner scrollbar. "Provenance & limitations" (static
  disclosure, keeps its open state across language switches) holds the Scenario
  authority sentence and the source version (`code.technical-id`, the only monospace).
- **Source badge once.** The header badge names the source. The in-body `#sourceBadge`
  shows only when the result's source differs (comparative reference).
- **Range matrix.** Cells tinted by the dominant action from the shared action roles
  (`--matrix-action-tint` 52% pure / 34% mixed; Daylight 42 / 26), fold cells neutral,
  unavailable cells dashed with a hatch; the selected-hand inspector (hover/focus shows
  that hand's mix; Escape restores) is a hairline-separated section.
- **Spot table.** A collapsed section at the end of the Result panel; each destination
  remembers its choice (Analyze collapsed, Hand open).

### Amendment 2 patterns (fidelity finish, October 3, 2026)

Values come from the extracted mockup spec (`Riverline_QA_2026-10/analyze/mockup/mockup-spec.json`):
type exact, geometry within ±2px, role tokens only. Off-scale mockup sizes (13, 13.5, 19px) map to
the type scale and weights follow the weight roles; those are recorded exceptions, not drift.
Analyze text uses line height 1.5 like the mockup.

- **Fact-cell omission rule.** A fact that is unavailable for the current context (Scenario has no
  exact call price, so To call and Pot odds; SPR without one opponent and an exact pot; anything
  shown as "—"/"-") is not rendered as a bare dash: its cell is hidden, the table reflows into
  `--fact-cols` equal columns (`--fact-cols-narrow` = half, rounded up, under a 900px panel), and
  Provenance & limitations lists the omitted facts ("Not shown for this decision: To call (price
  unavailable) · Pot odds (Price unavailable) · SPR"). `applyAnalyzeFactOmission` reads only the
  rendered values and the DecisionContext price; it computes nothing.
- **Mix card rows.** Only actions present in the mix (probability > 0) get a row; rows are
  `74px | 1fr | 48px` with 12px gaps, a 9px swatch, a 6px mini bar and a right-aligned tabular
  percentage. The stacked bar is 10px with 2px gaps between action segments. "Alternate view" is a
  quiet link.
- **Rail numeric row.** Label above; then the slider and a boxed value field on one row, aligned to
  a shared 92px column (`--analyze-value-column`): inset well, strong border, 36px, the number at
  body size with tabular digits and a muted unit suffix behind a hairline ("3 | bb", "6 | max").
  Same inputs, slider sync, readiness and numeric-entry behavior (CSS-only grid over the existing
  slider-pair markup). Selects and values use the regular weight.
- **Rail fit.** Hero cards 44×60, board slots 40×54, dead slots 28×38 (rail-scoped
  `--poker-card-*`); dead cards are one row ("Known burned / dead · Dead: N · Available: M",
  Clear, slots on the end side; the whole-set editor opens from the slots); randomization status and
  details are quiet text under the rail header; Stack setup puts its label and select on one row.
  The rail measures 978px at 1920×1080 (mockup 976) and fits without scrolling. At 1366×768 it
  cannot fit; disclosures are collapsed by default and the rail scrolls with the page.
- **Stepper mini cards.** Reached streets show their board cards as the shared mini card object
  (`analysis-mini-card riverline-card`, 22×30 at stepper scale, overhanging the row by 5px; the
  path list uses `contain: layout style` so the overhang is not clipped) inside an LTR island
  labelled with the card text; pending streets keep their text. Dots 10px with a 2px ring, 56px rules with 14px
  margins; completed steps muted, the active step accent with a 4px halo.
- **Disclosure row.** One style for Strategy adjustment, Game & accounting, Provenance &
  limitations and the Spot table row: a rotating chevron, a 14px control-weight title, a muted
  12.5px caption, 12px block padding and a hairline above.
- **Close-mix line.** Secondary small text; action colors appear only as 7px dots before each
  action name.
- **Calm loading.** While an update is pending, the verdict copy and mix card fade to 55% opacity;
  no size, position or display changes, so results never jump (Firefox probe: 0px shift during and
  after recomputes). Recomputes usually finish within one frame, so the fade is rarely visible.
  Reduced motion removes the transitions.
- **Interaction finish.** Tabs, disclosure rows, value fields, segmented items, matrix cells and
  links have hover, pressed and `:focus-visible` states with transitions from `--motion-fast` /
  `--ease-standard`.

### Verdict dominance

`app/src/application/analyze-verdict.mjs` (`analyze-verdict/v1`) reads the existing
StrategyResult action distribution; it never changes the recommendation, frequencies or
claim policy. **Dominant** when the leading action is at least 20 percentage points
ahead of the next action, or no other action reaches 5%: the verdict shows the leading
action alone at `--t-display`. **Close** when the two leading actions are within 20
points: the verdict reads "3-Bet or Call" at `--t-verdict-close` and a line under it
says "Close mix · 3-Bet 50% · Call 40%" (shares from the mix card's rounding). Ties
follow the provider's order. Labels are the provider's sentence-case action labels.

## Component sheet (dev only)

`tools/dev-pages/component-sheet.html` renders every component and variant in EN and
HE side by side, through the real theme controller (in-memory storage, so the app's
saved theme is untouched) and the real card faces. A toolbar switches the four
review themes (Midnight, Graphite, Daylight, and the custom sample accent `#e0a458`,
surface `#1b2230`, felt `#5b3a6b`), 2/4-color cards and card style, and the page
shows the rendered contrast table for the active theme.

Open it from the dev server (it is not in `app/`, not shipped and not in navigation):

```bash
node tools/dev-web-server.mjs
```

then visit `http://127.0.0.1:3000/__dev/component-sheet.html` (`?theme=daylight` etc.).

## Migration status and debt

Adopted in `DS-FOUNDATION-001`: Button (all `.ui-button` families; Equity Calculate /
Cancel moved onto it), Field and select (all native fields, Saved search/filters),
Checkbox (every native checkbox/radio, Saved filters), Segmented (all `.ui-segments`
users, Saved view toggle, Equity Known/Unknown), Chip (Saved category and Training
history filters), Badge (`.status-badge`/`.badge`), Disclosure (`.study-disclosure`),
Poker island (Saved previews). Remaining families by workspace are tracked under
`QA-DS-FOUNDATION-005` in `QA_BACKLOG.md`.
