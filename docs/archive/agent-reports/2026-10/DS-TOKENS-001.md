# DS-TOKENS-001: Style v4 values into the token layer

Execution class: Correctness/Architecture (visual) · Tier T2 · Base `codex/stabilization` at `7ab2bfe` (MOTION-FOUNDATION-001), already up to date with origin. Nothing staged or committed. Owner visual acceptance pending.

## 1. Outcome

- **Style v4 geometry is in the token layer:** `--radius-panel` 16 (overlays follow), `--pad-panel` 22 with `--pad-panel-head` 16 (default density panels use them), `--canvas-max` 1640, `--control-height-md` 40, new `--control-height-primary` 44 for the md primary action, `--control-height-sm` 32 unchanged. A named card size scale (`--card-scale-inline/mini/standard/table-*`) aliases the measured app sizes. The weight roles already matched the spec (body 400; controls, labels, values, headings 650; titles 700; section titles 750; display 800). I verified them and left them unchanged.
- **Contrast (DS-CONTRAST-TOKENS):** every text role passes 4.5:1 on every Midnight, Daylight and Slate surface, hover included. The primary button, focus ring and accent fill pass in all three themes. There are two value changes and two usage fixes (section 2).
- **Slate (DS-THEME-SLATE):** a fourth read-only built-in preset (role tokens only). Editing it saves a separate custom copy. The Settings built-in picker is now 2×2.
- **Rubik (DS-FONT-RUBIK):** self-hosted variable woff2 (300–900) for `--font-display`, OFL licence copied, THIRD_PARTY row added, Latin subset preloaded. Firefox does no runtime font CDN request. Body text is unchanged.

## 2. Key design choices

- **Hover surface counts as a text background.** The preset `surfaces` lists in `presentation-theme.mjs` left out `--surface-interactive-hover`, so derived status, accent and action text was never measured on it. Midnight, Daylight and Slate now list it. I bumped the prepaint cache to `beta-b-3` because derived roles changed.
- **Contrast changes, each with its ratio:**
  - Midnight `--text-muted` #8f9a94 → **#939e98**: 4.43 → 4.65:1 on hover #2a342f. This is the smallest step that passes with margin. It is applied in `:root`, `[data-theme="midnight"]`, `html[data-theme="midnight"]` and the pinned `--analysis-muted`.
  - Hand dock fold label used the fill hue `--action-fold` (3.29:1). It now uses `--action-fold-text` (≥ 4.59:1).
  - Hand dock all-in labels (two rules) used `--action-all-in` (3.58:1). They now use `--action-all-in-text` (≥ 4.72:1).
  - Primary button, unchanged: Midnight 6.81:1 (hover 8.57), Daylight 7.41:1 (hover 9.41). The kit draft #2f8a5f (4.27:1) and the proposed #287a53 were never in code. Daylight muted #545e58 has a worst case of 4.52:1 (on the shell) and is unchanged.
  - The `--action-fold` fill keeps #68716c. It is a non-text mark (3.29:1 ≥ 3) and the stable poker hue. The proposed #828c86 is not needed once text uses the text role.
- **Slate values:** the kit's Settings swatch gives canvas #121417, panel #1b1f24, felt #2b3a4a and accent #5b9bd5. I derived the other roles in the Graphite pattern; full list in DESIGN_SYSTEM › Slate. On-accent #07111c is 6.41:1. Slate had to be excluded from the legacy `html:not([data-theme=…])` remap, which would otherwise have overwritten its roles. It also shares Graphite's table rail mix.
- **Rubik `font-display: block` plus a preload** for the Latin subset. The files are local and load in milliseconds, so `block` avoids a visible font swap ("one app-ready moment"). The files live under `app/src/ui/assets/fonts/` because electron-builder ships `src/**` and not `assets/`. The dev server gained the `font/woff2` MIME type.
- **Primary height** is applied as `.ui-button:where(primary):where(:not([data-size="sm"]))`, at single-class specificity so surfaces can still size it. Legacy `.cta` / `.btn-action` aliases are not changed (debt).
- **Tutorial offer alignment** was caused by this ticket. With `--canvas-max` 1640 the frame no longer fills a 1920 viewport, and the offer banner (inserted beside the frame) stuck out 12 px on each side. It now takes `max-width: var(--canvas-max)` with auto inline margins. This is a placement rule, not a restyle.
- **Built-in grid 2×2:** four presets in the old 3-column grid would read as 3+1, which the composition rules reject. The unused `.theme-swatch-grid--custom` rule folded into the base rule, which is now the same.

## 3. Files

Changed by this ticket:
- `app/styles.css`: Rubik `@font-face` ×5, token block (font, panel padding, controls, muted, radius, card scale, canvas), Midnight muted ×2, Slate preset block, legacy remap exclusion, Slate/Graphite table rail, density panel padding roles, primary height rule, fold/all-in text roles ×3, two literal 16 px radii → `--radius-panel`, theme grid 2×2, tutorial offer width.
- `app/index.html`: Rubik preload; stylesheet cache-buster `v=28` → `v=29`.
- `app/src/application/presentation-theme.mjs`: Slate preset, hover surfaces, Midnight `--analysis-muted`, prepaint cache `beta-b-3`.
- `app/src/application/presentation-theme-prepaint.js`: cache version, `slate` allowed.
- `app/src/locales/analysis-translations.js`: «Riverline: Сланец» / «Riverline: צפחה».
- `app/src/ui/assets/fonts/rubik/`: new; 5 woff2 files and `OFL.txt`, about 91 KB.
- `tools/dev-web-server.mjs`: `.woff2` MIME type.
- `tools/dev-pages/component-sheet.html`: Slate option.
- `tests/ds_tokens001.test.mjs`: new guard (6 tests).
- Updated tests (assertions changed because the intended values changed): `design002_theme_foundation`, `design004_component_system`, `i18n001_runtime_integrity`, `product_theme001_presentation`, `token_tuning001`, `premium_layout001_workspace_composition`, `uiqa001_layout_stabilization`.
- Docs: `docs/project/DESIGN_SYSTEM.md` (token tables, contrast table, Slate, Rubik), `docs/ISSUE_REGISTER.md` (3 rows updated, 3 added), `docs/THIRD_PARTY.md` (Rubik row), this report.

Pre-existing dirty or untracked files, not touched: `.codex/config.toml` (M), `.claude/` (untracked).

## 4. Verification

- `node --check` on every changed `.js`/`.mjs` file: clean.
- `git diff --check`: clean. `git diff --stat` shows no line-ending churn. All files LF; the woff2 files are binary.
- Focused: `node --test --test-concurrency=4` on `ds_tokens001`, `design002`–`design005`, `product_theme001/002`, `token_tuning001`, `ds_foundation001`, `i18n001_runtime_integrity`, `beta_design_correction002`, `beta_feature_surface_refresh001`, `beta_repair_sweep_b`, `premium_card_system_v1` and `product_ui004_cards_themes`.
  - First run: 6 failures, all intended value changes (four presets, 40 px, all-in text role, hover in the mirror list, radius 16). I updated those assertions.
  - The new guard then found a second raw all-in text use (`.hand-action-dock`), which I fixed.
  - Final run: 135 pass, 0 fail.
- Full suite, once: `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs` gave 2817 tests, 2812 pass, 3 fail, 2 todo (pre-existing TEST-HYGIENE-001 TODOs), 273 s.
  - The 3 failures pinned the old `--canvas-max` 1680: `premium_layout001_workspace_composition` (2 tests, 3 assertions) and `uiqa001_layout_stabilization` (1). I retargeted them to 1640.
  - Rerun of those two files plus `ds_tokens001`: 30 pass, 0 fail. I did not rerun the whole suite (the tier asks for one run).
- Browser, Firefox headless through `tests/tooling/browser-runtime.mjs`, disposable profile, fresh app per run:
  - 1920×1080 EN Midnight, 1366×768 EN Midnight, 1920×1080 HE Midnight, 1920×1080 EN Daylight and 1920×1080 EN Slate.
  - Each config covers Home, Training, Analyze, Settings and Settings scrolled to the theme picker.
  - `C:\Users\sjzns\Projects\Riverline_QA_2026-10\DS-TOKENS-001\before\` holds 21 shots. Slate has no before: it did not exist.
  - `…\after\` holds 25 shots. Both folders have a `report.json`. No page errors or console errors.
- Font probe (Firefox): Rubik faces load from the app origin (Latin on load; Cyrillic on RU; Hebrew on HE). Rendered Rubik differs from the fallback. `h1` resolves to Rubik 750 and `body` to the UI font. No request goes to fonts.googleapis/gstatic.
- Visual status: **PARTIAL.** Screenshots exist for every config, and I reviewed Training 1920/1366, Analyze 1920 Midnight and Slate, Home HE, Daylight Training, and the Slate theme picker. Owner acceptance of the look is still open.

### Visible changes (before → after)

1. Panels and overlays: corner radius 10 → 16 px everywhere, Settings modal included.
2. Default-density panel heads and bodies: inline padding 17 → 22 px; head and body start 14/15 → 16 px; body end 17 → 22 px. Panels are slightly taller.
3. Fields, md buttons and md icon buttons: 36 → 40 px tall. Form columns (Training setup, Analyze Spot) are about 4 px taller per row.
4. The view's md primary action is at least 44 px (Start Training, Edit decision inputs).
5. At 1920 wide, the workspace frame is capped at 1640 instead of 1680, so content starts about 12 px further in. The header start edge and the tutorial offer follow it. At 1366 nothing changes, because the cap is not reached.
6. Workspace titles (`h1`), `.t-title`, `.t-display`, `.panel-title`, close verdicts and matrix inspector headings render in Rubik. Ad hoc h2 titles such as "Make the decision" do not (DS-DISPLAY-FONT-ADOPT).
7. Midnight muted text (hints, meta, labels) is a touch lighter (#8f9a94 → #939e98).
8. The Hand dock Fold and All-in labels take the readable text roles: lighter in Midnight, deeper in Daylight.
9. Settings › Workstation theme: four built-ins in 2×2, Riverline Slate added.
10. New Slate theme: cool blue-grey surfaces, blue accent and primary, blue-grey felt.

## 5. Limitations and debt

- **DS-CONTRAST-GRAPHITE (new):** Graphite text on its hover surface misses 4.5:1. This is pre-existing and outside the Midnight/Daylight scope. The fix is written in the row.
- **DS-DISPLAY-FONT-ADOPT (new):** display-sized headings with their own family and size stay in the UI font.
- **DS-TOKEN-ADOPTION (new):**
  - About 72 raw hex values outside the token and preset blocks.
  - 186 literal font sizes, 39 literal weights and 87 literal px radii.
  - Nested wells that misuse `--radius-panel` now show 16 inside 16.
  - Per-workspace literal panel paddings (13–18 px).
  - The legacy `.cta` / `.btn-action` primary height.

  I replaced only the two literal 16 px panel radii, where the token value now matches exactly.
- The Style v4 panel gradient and soft shadow, and the jade-gradient primary with glow, remain Target. They are component restyling, outside "token values only".
- Slate's RU/HE names need the owner's check (Сланец / צפחה).
- The design kit (`StyleV4.dc.html`, `Main.dc.html`) still loads Rubik from Google Fonts. That is a mockup only, not the app.

## 6. Disagreements or doc conflicts

- **Rubik scope:** the ticket says "display/headings", but DESIGN_SYSTEM › Type says "workspace titles, verdicts and big numbers only". The kit renders panel titles in the UI face, while code's `.panel-title` already used `--font-display`, so panel titles now render in Rubik. I kept the existing token usage. Owner to decide whether `.panel-title` should go back to `--font-ui` (recorded in DS-DISPLAY-FONT-ADOPT).
- **Kit Main board:** it states "panels 12 px radius, 20 px padding", which conflicts with Style v4/D-14 (16/22). D-14 wins, as the spec says.
- **riverline-design skill:** it still says "code still 10 px until DS-TOKENS-001". After merge, that line should say 16. I did not edit the skill; it has its own owner.
- **Compact density** sets `--control-height: 40px` and `--control-height-compact: 34px`, which is larger than the old default of 36. This is pre-existing and I left it alone. With the new default of 40, compact and comfortable controls are now the same height. Worth a look in a density ticket.

**Acceptance (2026-10-27):** the owner accepted the token values; no visible regressions were found. Panel titles stay in Rubik for now, and SHELL-002 will settle fonts in headers. The riverline-design skill now says panels are 16 px.

## 7. Git status

`git status --short`: the 17 tracked files listed above are modified, `.codex/config.toml` (pre-existing) is modified, and `.claude/` (pre-existing), `app/src/ui/assets/fonts/` and `tests/ds_tokens001.test.mjs` are untracked, along with this report. Nothing staged, nothing committed, no branch change.
