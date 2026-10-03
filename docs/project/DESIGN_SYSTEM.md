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
| `--t-hero` / `.t-hero` | 3.5rem / 1.07 | 750 | primary; an action-named verdict takes `--action-*-text` | Analyze verdict only |
| `--t-display` / `.t-display` | 2.5rem / 1.1 | 750 | primary | one focal value per view |
| `--t-title` / `.t-title` | 1.375rem / 1.25 | 700 (`--weight-title`) | primary | workspace and inspector titles |
| `--t-heading` / `.t-heading` | 1.0625rem / 1.3 | 650 (`--weight-heading`) | primary | section heading inside a surface |
| `--t-body` / `.t-body` | .875rem / 1.5 | 400 | secondary | prose (callout text included) |
| `--t-small` / `.t-small` | .75rem / 1.45 | 500 | muted (≥ 4.5:1) | metadata, row meta, field labels |
| `--t-label` / `.t-label` | .6875rem / 1.3, `--t-label-tracking` | 650 | muted (≥ 4.5:1) | fact-grid keys (uppercase only there); floor size |

Hierarchy comes from color role as well as size. The accent is **never** a
text-hierarchy color (it is reserved for the one primary action and selection
indicators); provenance (brass) is for provenance only. Control text (buttons,
segments, check labels) keeps its component's role. Verdict mapping: fold →
`--action-fold-text`; check/call → `--action-passive-text`; bet/raise →
`--action-aggressive-text`; all-in → `--action-all-in-text`; anything else →
primary. `.t-hero[data-action]` and Analyze's existing
`.recommend[data-action-kind] .action-name` consume it.

Weights: `--weight-regular` 400, `--weight-medium` 500, `--weight-strong` 650,
`--weight-bold` 700, `--weight-heavy` 750 (the Analyze verdict / display values only).
Small 12px (not 12.5) snaps to the most-used existing value. Headings were raised by the
token tuning (see below): title 22px, heading 17px, display 40px.

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
