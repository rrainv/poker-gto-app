# MOCKUP-ASSETS-001 Report

## 1. Outcome
Created `docs/design/mockup-assets/` with:
1. `docs/design/mockup-assets/assets.html` (73,817 bytes): self-contained single-file HTML reference sheet (inline CSS, inline SVGs, and inline `data:image/webp;base64,...` data URIs; zero network dependencies) showing:
   - Every runtime card back (`riverline`, `solid`, `geometric`) in both HTML (`.riverline-card-back`) and SVG table (`.table-card-back`) renderers across Midnight (`#285444`), Graphite (`#354d62`), and Daylight (`#285a46`), plus the two legacy `.card-back` SVG data-URI card backs still present in `app/styles.css`.
   - Every navigation, sidebar utility, workspace header, and toolbar icon with its name and selector/ID (`#riverlineBrandSpade`, `#sidebarCollapseBtn`, `hand`, `analyze`, `training`, `personal-strategy`, `equity`, `saved`, `home`, `home-game`, `guide`, `#langToggle`, `#audioToggleBtn` sound/muted, `#openSettings`, `#workspaceLearnButton`, `#workspaceTutorialButton`, `#scenarioRandomizeButton`, `#welcomeCloseButton`, `[data-saved-category="all|hands|spots"]`, `.saved-study-bookmark-action`, `pokerChipGlyphSvg`, `#savedStudyEmptyState svg`).
   - All 10 opponent character portraits (`Cleo`, `Fern`, `Luma`, `Mika`, `Nova`, `Otto`, `Pip`, `Remy`, `Sol`, `Zig`) rendered inline at 64×64 px (`*-seat.webp`) alongside pixel dimensions and file sizes for all three shipped variants (`*-seat.webp`, `*-preview.webp`, `*.png`).
2. `docs/design/mockup-assets/MEASUREMENTS.md`: live rendered Firefox measurements at `1920×1080` and `1366×768` (`2-max`, `6-max`, `9-max` table container, SVG, outer/inner rail, cushion, felt, seat box, hole cards), sidebar width, header height, panel radius/padding, control heights, card sizes per context (`mini`, `result`, `table`, `picker`, `compact`, `slot`, `standard`, `representative`, `full`), and font sizes/weights per role.
3. `docs/design/mockup-assets/screens/`: 6 PNG screenshots captured at `1920×1080` EN Midnight using headless Firefox and `tools/dev-web-server.mjs`:
   - `home.png` (87,646 B)
   - `analyze.png` (171,799 B)
   - `hand-in-progress.png` (358,066 B)
   - `training-drill-decision.png` (152,702 B)
   - `training-drill-feedback.png` (173,163 B)
   - `full-hand.png` (391,035 B)

No application files were changed.

## 2. Decisions Made
- Installed `tests/tooling` dependencies (`npm.cmd ci` inside `tests/tooling/`) inside this worktree only (`tests/tooling/node_modules` is gitignored).
- Kept `app/node_modules` uninstalled so B3 (`CLEANUP-PREP-001`) can verify the fresh-checkout Supabase UMD 404 fix. Note: in `tests/tooling/browser-runtime.mjs` line 48, `response.request().resourceType()` throws `UnsupportedOperation` under Puppeteer WebDriver BiDi when a 404 response occurs; B3 item 1 eliminates the 404 response.

## 3. Files Changed
- `docs/design/mockup-assets/assets.html`
- `docs/design/mockup-assets/MEASUREMENTS.md`
- `docs/design/mockup-assets/screens/analyze.png`
- `docs/design/mockup-assets/screens/full-hand.png`
- `docs/design/mockup-assets/screens/hand-in-progress.png`
- `docs/design/mockup-assets/screens/home.png`
- `docs/design/mockup-assets/screens/training-drill-decision.png`
- `docs/design/mockup-assets/screens/training-drill-feedback.png`
- `docs/STATE.md`
- `docs/archive/agent-reports/2026-10/MOCKUP-ASSETS-001.md`

Pre-existing dirty files: none.

## 4. Verification
- Browser capture script executed against headless Firefox (`1920×1080` and `1366×768`, `en`, `midnight`): all 6 screenshots written and table/shell geometry measured.
- `node --test tests/docs_integrity001_governance.test.mjs`: passed.
- `git diff --check`: clean.

## 5. Limitations and Risks
- None.
