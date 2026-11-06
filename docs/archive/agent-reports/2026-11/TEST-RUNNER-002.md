# TEST-RUNNER-002 — Automatic `css` Group Computation & `alsoRun` Selection Rules

- **Ticket**: `TEST-RUNNER-002` (T1)
- **Branch**: `argon/m1-batch-4`
- **Date**: 2026-11-06

## Summary of Changes

1. **Automatic `css` Group Computation & Manifest Parity (`tools/run-tests.mjs`, `tests/areas.json`)**:
   - Updated `tools/run-tests.mjs` to compute the `css` group automatically by scanning `tests/*.test.{js,mjs}` for direct `app/styles.css` reads or indirect reads through `tests/helpers/css-model.mjs` (`/styles\.css|css-model\.mjs|appStyleSheet|StyleSheetModel|assertDeclared|assertCascaded/`).
   - Updated `checkManifest()` (`node tools/run-tests.mjs --check`) to compare the automatic `css` group list with `manifest.groups.css.tests` in both directions (reporting missing and extra entries).
   - Compared the automatic list (105 test files) with the prior `manifest.groups.css.tests` (81 test files): 0 files were in the old manifest only, and 24 files were missing from `manifest.groups.css.tests`:
     - `a11y_keys001.test.mjs`
     - `account001_identity_foundation.test.mjs`
     - `account002b_saved_sync.test.mjs`
     - `analyze_range_ux001.test.mjs`
     - `beta_feature_surface_refresh001.test.mjs`
     - `browser_beta_runtime.test.mjs`
     - `ci_fix001_runner_locale_selection.test.mjs`
     - `design002_theme_foundation.test.mjs`
     - `fullhand_quality001.test.mjs`
     - `home_game_ledger_input001.test.mjs`
     - `perf_rl18_hidden_dom.test.mjs`
     - `personal_strategy_preflop_ui001.test.mjs`
     - `prelabs_fix001_training_layout.test.mjs`
     - `premium_layout001_workspace_composition.test.mjs`
     - `product_ui005_workspace_fit.test.mjs`
     - `range_builder001_personal_strategy.test.mjs`
     - `range_intelligence003a_context_transfer.test.mjs`
     - `range_teacher001_personal_strategy.test.mjs`
     - `replay001br_chance_event_timeline.test.mjs`
     - `responsive001_equity_street_alignment.test.mjs`
     - `shell002_navigation_hubs.test.mjs`
     - `strategy_truth001.test.mjs`
     - `training_composition001_lean_closeout.test.mjs`
     - `training_memory001_foundation.test.mjs`
   - Updated `manifest.groups.css.tests` in `tests/areas.json` so `--check` passes with 105 CSS tests.

2. **`alsoRun` Rules (`tests/areas.json`, `tools/run-tests.mjs`)**:
   - Added `"app/src/ui/**"` to `manifest.alsoRun` selecting:
     - `locale_numbers001.test.mjs`
     - `motion_foundation001.test.mjs`
     - `ds_tokens001.test.mjs`
     - `design002_theme_foundation.test.mjs`
     - `design003_app_shell.test.mjs`
     - `design004_component_system.test.mjs`
     - `design005_poker_visual_system.test.mjs`
     - `design006_playbook_workspace.test.mjs`
     - `design007_equity_workspace.test.mjs`
     - `design008_training_presentation.test.mjs`
     - `design008_training_workspace.test.mjs`
   - Extended `manifest.alsoRun` and `tools/run-tests.mjs` so changes to `app/index.html` or `app/src/core/logic.js` (`logic.js`) also select the `smoke` group.

3. **Self-Tests (`tests/ci_fix001_runner_locale_selection.test.mjs`)**:
   - Added a self-test per rule:
     - `TEST-RUNNER-002 (a)`: verifies `--check` passes, the automatic `css` group matches `manifest.groups.css.tests`, and `--paths app/styles.css --list` selects `design002_theme_foundation.test.mjs`, `motion_foundation001.test.mjs`, and `ds_tokens001.test.mjs`.
     - `TEST-RUNNER-002 (b1)`: verifies `--paths app/src/ui/drill-components.mjs --list` selects `locale_numbers001.test.mjs`, `motion_foundation001.test.mjs`, `ds_tokens001.test.mjs`, and `design002_theme_foundation.test.mjs`..`design008_training_workspace.test.mjs`.
     - `TEST-RUNNER-002 (b2)`: verifies `--paths app/index.html --list`, `--paths app/src/core/logic.js --list`, and `--paths logic.js --list` select every test in `manifest.groups.smoke.tests`.

## Verification (`--paths --list`)

- `node tools/run-tests.mjs --paths app/src/ui/drill-components.mjs --list`:
  - `app/src/ui/drill-components.mjs -> training, design-system`
  - `app/src/ui/drill-components.mjs -> alsoRun 11 test(s)`
  - Selects 52 test files including `tests/locale_numbers001.test.mjs`, `tests/motion_foundation001.test.mjs`, `tests/ds_tokens001.test.mjs`, and `tests/design002_theme_foundation.test.mjs`..`tests/design008_training_workspace.test.mjs`.
- `node tools/run-tests.mjs --paths app/styles.css --list`:
  - `app/styles.css -> design-system, css`
  - Selects 110 test files including `tests/design002_theme_foundation.test.mjs` and `tests/motion_foundation001.test.mjs` (which check Reduced-motion rules in `app/styles.css`).
- `node tools/run-tests.mjs --check`:
  - `areas.json OK: 299 test files, 14 areas, groups css, smoke`
- `node tools/run-tests.mjs --files tests/ci_fix001_runner_locale_selection.test.mjs`:
  - `SUMMARY files=1 total=6 pass=6 fail=0 skip=0 todo=0 seconds=1`
- `node tools/run-tests.mjs --changed`:
  - `SUMMARY files=169 total=1650 pass=1648 fail=0 skip=1 todo=1 seconds=324.9`

