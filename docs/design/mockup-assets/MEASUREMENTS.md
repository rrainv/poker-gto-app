# Riverline Current UI & Table Measurements (MOCKUP-ASSETS-001)

Measured directly in headless Firefox (`1920×1080` and `1366×768` at `deviceScaleFactor: 1`, `en`, `midnight`) against the current live codebase on `argon/m1-batch-1`, cross-referenced with `app/styles.css`, `app/src/application/card-presentation.mjs`, `app/src/ui/TableRenderer.js`, and `app/src/application/table-presentation.mjs`.

---

## 1. Shell, Sidebar, Header, Panels & Controls

| Element / Token | CSS Token / Rule | Rendered at 1920×1080 | Rendered at 1366×768 | Style v4 Target (DESIGN_SYSTEM.md) |
|---|---|---|---|---|
| **Sidebar (`#modeRail`)** — expanded | `208px` fixed column (`grid-template-columns: 208px minmax(0, 1fr)`) | `208 × 1080 px` | `208 × 768 px` | `240 px` (*provisional*) |
| **Sidebar (`#modeRail`)** — collapsed | `.is-sidebar-collapsed` (`64px` column) | `64 × 1080 px` | `64 × 768 px` | — |
| **Workspace Header (`.workspace-header`)** | `--header-bar-height: 56px` | `1712 × 56 px` | `1158 × 56 px` | `56 px` |
| **Canvas Max Width** | `--canvas-max: 1680px` | `1680 px` max | `1158 px` available | `~1640 px` (D-14) |
| **Canvas Gutter** | `--gutter-canvas: var(--space-8)` (`24px`) | `24 px` inline | `24 px` inline | `28 px` page padding, `24 px` gaps |
| **Panel Radius** | `--radius-panel: 10px` (`--radius-lg`) | `10 px` | `10 px` | `16 px` (D-14) |
| **Panel Padding** | `--pad-surface: 16px` (dense) / `--pad-surface-reading: 24px` | `16 px` / `24 px` | `16 px` / `24 px` | `22 px` (D-14) |
| **Control Radius** | `--radius-control: 7px` (`--radius-md`), `--radius-cell: 4px`, `--radius-pill: 999px` | `7 px` / `4 px` / `999 px` | `7 px` / `4 px` / `999 px` | `7–8 px` controls, `999 px` pills |
| **Control Height (Medium)** | `--control-height-md: 36px` (`.ui-button`, `.control-input`, `.control-select`) | `36 px` | `36 px` | `40 px` (`44–48 px` main action, D-14) |
| **Control Height (Small)** | `--control-height-sm: 32px` (`.ui-button[data-size="sm"]`, `.ui-chip`, `.ui-segments[data-size="sm"]`) | `32 px` | `32 px` | — |

---

## 2. Poker Table Geometry (`1920×1080` vs `1366×768`)

The table SVG (`#poker-table-svg`) uses a fixed internal `viewBox="0 0 1000 650"` (`preserveAspectRatio="xMidYMid meet"`). At runtime, `TablePresentation v1` adjusts the table bounds, seat unit (`playerUnit`), and `cardScale` by player count (`2` heads-up, `3–6` short-handed, `7–10` full ring).

### 2.1 SVG Internal Coordinate Space (`viewBox="0 0 1000 650"`)

| Layer | Selector | SVG `width × height` (units) | SVG `rx / ry` (units) | Notes |
|---|---|---|---|---|
| **SVG Canvas** | `#poker-table-svg` | `1000 × 650` | — | Aspect ratio `20:13` (`1.5385`) |
| **Table Base / Outer Rail** (2-max) | `#table-base`, `#table-rail-outer` | `862 × 392` (scaled from `820 × 416` init by `TablePresentation`) | `196` | Centered around `(500, 312)` |
| **Table Base / Outer Rail** (6-max / 9-max) | `#table-base`, `#table-rail-outer` | `902 × 392` | `196` | Wider oval for 3–10 seats |
| **Inner Rail** (2-max / 6–9-max) | `#table-rail-inner` | `843 × 373` / `883 × 373` | `186.5` | `9.5` units inset from outer rail |
| **Cushion** (2-max / 6–9-max) | `#table-cushion` | `821.5 × 351.5` / `861.5 × 351.5` | `175.75` | `20.25` units inset from outer rail |
| **Felt Surface** (2-max / 6–9-max) | `#table-surface`, `#table-felt-texture` | `802.5 × 332.5` / `842.5 × 332.5` | `166.25` | `29.75` units inset from outer rail |
| **Seat Box (`playerUnit`)** | `.table-seat-surface` | `152.5 × 80.5` (2-max), `124.5 × 72.5` (3–6-max), `106.5 × 64.5` (7–10-max) | `12` | Portrait clip inside seat: `40×(h-26)` (`w≥120`) or `32×(h-26)` (`w<120`) |
| **Dealer Button** | `.table-dealer-button` | `34 × 34` (`r="17"`, inner `r="13"`) | `17` | Attached to outer seat shoulder |
| **Action Badge** | `.table-action-surface` | `88 × 18` | `9` | Below seat (`y = halfHeight + 12`) |

### 2.2 Rendered Pixel Measurements in Hand Workspace (`#visual-table-container`)

In Hand workspace, `#poker-table-svg` renders at `956.0 × 621.4 px` at `1920×1080` (scale factor `0.956×` from the `1000×650` viewBox) and `602.0 × 391.3 px` at `1366×768` (scale factor `0.602×`).

| Table Element | 2-Max @ 1920×1080 | 2-Max @ 1366×768 | 6-Max @ 1920×1080 | 6-Max @ 1366×768 | 9-Max @ 1920×1080 | 9-Max @ 1366×768 |
|---|---|---|---|---|---|---|
| **Table Container (`#visual-table-container`)** | `956.0 × 652.4 px` | `602.0 × 422.3 px` | `956.0 × 652.4 px` | `602.0 × 422.3 px` | `956.0 × 652.4 px` | `602.0 × 422.3 px` |
| **Table SVG (`#poker-table-svg`)** | `956.0 × 621.4 px` | `602.0 × 391.3 px` | `956.0 × 621.4 px` | `602.0 × 391.3 px` | `956.0 × 621.4 px` | `602.0 × 391.3 px` |
| **Outer Rail (`#table-rail-outer`)** | `824.1 × 374.8 px` | `518.9 × 236.0 px` | `862.3 × 374.8 px` | `543.0 × 236.0 px` | `862.3 × 374.8 px` | `543.0 × 236.0 px` |
| **Inner Rail (`#table-rail-inner`)** | `805.9 × 356.6 px` | `507.5 × 224.6 px` | `844.2 × 356.6 px` | `531.6 × 224.6 px` | `844.2 × 356.6 px` | `531.6 × 224.6 px` |
| **Cushion (`#table-cushion`)** | `785.4 × 336.1 px` | `494.6 × 211.6 px` | `823.6 × 336.1 px` | `518.6 × 211.6 px` | `823.6 × 336.1 px` | `518.6 × 211.6 px` |
| **Felt Surface (`#table-surface`)** | `767.2 × 317.9 px` | `483.1 × 200.2 px` | `805.4 × 317.9 px` | `507.2 × 200.2 px` | `805.4 × 317.9 px` | `507.2 × 200.2 px` |
| **Seat Box (`.table-seat-surface`)** | `145.8 × 77.0 px` | `91.8 × 48.5 px` | `119.0 × 69.3 px` | `75.0 × 43.7 px` | `101.8 × 61.7 px` | `64.1 × 38.9 px` |
| **Seat Hole Card (face / back)** | `49.0 × 69.3 px` | `30.9 × 43.7 px` | `39.2 × 55.5 px` | `24.7 × 34.9 px` | `34.5 × 48.8 px` | `21.7 × 30.8 px` |

---

## 3. Card Sizes per Context

Defined in `CARD_GEOMETRY` (`app/src/application/card-presentation.mjs`) and `:root` (`app/styles.css` lines 295–315), aspect ratio `40:57` (`~0.7018`):

| Context / `data-card-size` | CSS Token Pair | Current Code (`w × h`, radius) | Where Used | Style v4 Target (DESIGN_SYSTEM.md) |
|---|---|---|---|---|
| **`mini`** | `--card-size-mini-width/height` | `28 × 40 px`, `r = 4 px` | Hand hidden-opponent summary, Saved list rows, compact inline references | Inline `22 × 30 px` / Mini `30 × 42 px` |
| **`result`** | `--card-size-result-width/height` | `38 × 54 px`, `r = 5 px` | Equity result rows (`.equity-result-unknown`) | — |
| **`table`** | `--card-size-table-width/height` | `40 × 57 px`, `r = 5 px` (SVG units, scaled by `cardScale` × SVG width) | `#poker-table-svg` hole cards & community cards | Standard `46 × 64 px` / Table-Hero `58 × 82 px` |
| **`picker`** | `--card-size-picker-width/height` | `42 × 60 px`, `r = 5 px` | Card picker modal deck grid, Settings card face/back previews | — |
| **`compact`** | `--card-size-compact-width/height` | `42 × 60 px`, `r = 5 px` | Compact viewport (`≤1100px`) Equity unknown hand & compact card slots | — |
| **`slot`** | `--card-size-slot-width/height` | `48 × 68 px`, `r = 6 px` | Analyze Scenario / Hand card slots (`.card-slot`) | Standard `46 × 64 px` |
| **`standard`** | `--card-size-standard-width/height` | `52 × 74 px`, `r = 7 px` | Training drill hero/board cards, standard display | Standard `46 × 64 px` |
| **`representative`** | `--card-size-representative-width/height` | `52 × 74 px`, `r = 7 px` | Personal Strategy representative hand cards | — |
| **`full`** | `--card-size-full-width/height` | `56 × 80 px`, `r = 7 px` | Large focal card displays | Table/Hero `58 × 82 px` |

---

## 4. Typography Scale & Weights per Role

Font stack (`--font-ui` / `--font-data`): `"Avenir Next", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif` with `font-variant-numeric: tabular-nums` on `body`. Technical IDs (`--font-mono`): `"Cascadia Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace`.

### 4.1 Type Size Scale

| Role / Token | CSS Value | Computed Pixels | Line Height | Tracking | Use |
|---|---|---|---|---|---|
| **`--t-display`** (`.t-display`, `--t-hero`) | `2.5rem` | `40 px` | `1.1` (`44 px`) | normal | Dominant verdict, single focal display value |
| **`--t-verdict-close`** | `1.75rem` | `28 px` | `1.2` (`33.6 px`) | normal | Close verdict (`Analyze` / `Training` / `Review`) |
| **`--t-title`** (`.t-title`) | `1.25rem` | `20 px` | `1.3` (`26 px`) | `-0.01em` (header) | Workspace header `h1`, inspector titles |
| **`--t-heading`** (`.t-heading`) | `0.9375rem` | `15 px` | `1.45` (`21.75 px`) | normal | Section and panel headings |
| **`--t-value`** | `0.9375rem` | `15 px` | `1.4` (`21 px`) | normal | Fact grid values (`dl.ui-facts dd`), number tiles |
| **`--t-body`** (`.t-body`) | `0.875rem` | `14 px` | `1.5` (`21 px`) | normal | Body prose, standard button/input text |
| **`--t-small`** (`.t-small`) | `0.78125rem` | `12.5 px` | `1.5` (`18.75 px`) | normal | Metadata, row meta, field labels, badges (product text floor) |
| **`--t-label`** (`.t-label`) | `0.6875rem` | `11 px` | `1.4` (`15.4 px`) | `0.06em` | Overline data labels only (uppercase in EN/RU; no uppercase in HE) |

### 4.2 Font Weights per Role

| Weight Role Token | Value | Use |
|---|---|---|
| **`--weight-body`** (`--weight-regular`) | `400` | Body prose, row metadata, typed input values |
| **`--weight-medium`** | `500` | Legacy intermediate weight |
| **`--weight-strong`** | `600` | Legacy strong emphasis |
| **`--weight-control`** | `650` | Buttons, chips, selects, tabs, segmented controls, nav items, disclosure summaries |
| **`--weight-label`** | `650` | Field labels, overline labels, fact keys (`dt`), `<strong>` |
| **`--weight-value`** | `650` | Fact values (`dd`), number tiles |
| **`--weight-heading`** | `650` | Panel and section headings (`h1`–`h6` inside surfaces) |
| **`--weight-title`** (`--weight-bold`) | `700` | `.t-title`, list row titles, active navigation item |
| **`--weight-section-title`** | `750` | Workspace header title (`.workspace-heading h1`), section/inspector titles |
| **`--weight-display`** (`--weight-heavy`) | `800` | Verdict headline, focal display values |
