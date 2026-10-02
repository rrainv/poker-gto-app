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

### Type (UI font; numbers use `tabular-nums`; mono only for IDs, seeds, diagnostics)

| Token / class | Size / line | Weight | Text role (color) | Use |
|---|---|---|---|---|
| `--t-hero` / `.t-hero` | 3.5rem / 1.07 | 750 | primary; an action-named verdict takes `--action-*-text` | Analyze verdict only |
| `--t-display` / `.t-display` | 2.25rem / 1.1 | 750 | primary | one focal value per view |
| `--t-title` / `.t-title` | 1.25rem / 1.3 | 700 | primary | workspace and inspector titles |
| `--t-heading` / `.t-heading` | 1rem / 1.3 | 700 | primary | section heading inside a surface |
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
`--weight-bold` 700, `--weight-heavy` 750. Deviation from §B1: heading 16px (not 15)
and small 12px (not 12.5) snap to the most-used existing values.
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

`--radius-cell` 4 (matrix cells, mini cards in rows), `--radius-control` 8 (buttons,
fields, chips), `--radius-panel` 12 (surfaces and overlays), `--radius-pill` 999
(badges). `--radius-overlay`/`--radius-modal` now equal `--radius-panel`.
`--radius-card` belongs to card faces. `--radius-sm/md/lg` were referenced but never
defined (they rendered square); they now alias cell/control/panel.

### Elevation (maximum nesting: surface → group)

| Level | Token | Treatment |
|---|---|---|
| 0 group | — | no box; separated by `--border-subtle` rule or space |
| 1 surface | `--elevation-surface` (none) | `--surface-panel`, 1px `--border-default`, `--radius-panel` |
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

## Components

| Component | Markup | Variants / states | Notes |
|---|---|---|---|
| Button | `.ui-button` | `data-variant`: primary · secondary (default) · quiet · danger · icon; `data-size`: md · sm; `aria-pressed`, `:disabled`, `aria-busy` | Aliases `--primary`, `--secondary`, `--tertiary` (= secondary sm), `--quiet`/`--ghost`, `--danger`/`--destructive`, `--icon`. Poker action buttons (`--poker-*`) keep action colors. Pressed toggle = elevated + underline. Disabled = inset + dashed. |
| Field | `.ui-field` > label text + control; `.control-input`, `.control-select`, native inputs/selects | text, number, search, select (one height), textarea, number+slider `.ui-stepper` | Inset well, `--border-strong`, select caret mirrors in RTL. |
| Checkbox / Radio | native `input[type=checkbox|radio]`, optional `.ui-check` label | checked, indeterminate, disabled | One shared glyph: `--check-glyph` / `--indeterminate-glyph` SVG masks (12px, 2px round stroke, optically centered) on `::before`, painted `--text-on-accent` on the accent fill; masks never mirror in RTL. Boundary `--text-muted`; disabled = dashed `--text-disabled` boundary, no fill, disabled label color. Keyboard/semantics native. |
| Switch | `.ui-switch` (`role=switch`/`aria-checked` or `aria-pressed`) | on/off, disabled | Off: `--text-secondary` thumb on `--surface-inset`, `--text-muted` boundary. On: `--text-on-accent` thumb on `--accent-primary`. Immediate preferences only. |
| Segmented control | `.ui-segments` > `.ui-tab` (buttons or radio labels) | `data-size` md · sm; selected via `aria-pressed`, `aria-selected`, `.active`, or a checked radio | Selected = elevated + accent underline. |
| Tabs | `.ui-tabs` > `[role=tab]` | selected | Underline navigation between views. |
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
