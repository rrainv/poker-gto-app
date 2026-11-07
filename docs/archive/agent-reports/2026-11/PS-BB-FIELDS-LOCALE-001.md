# Agent Report — PS-BB-FIELDS-LOCALE-001

**Date**: 2026-11-06  
**Ticket**: PS-BB-FIELDS-LOCALE-001 (T1)  
**Branch**: `argon/m1-batch-4` (base: `43f3e54be4b46d814ed80522ca3dd198731797ee` on `origin/codex/stabilization`)

## Summary

Converted the Personal Strategy big-blind (`bb`) amount fields to locale-aware decimal text inputs using `app/src/application/locale-number-input.mjs`, matching the `LOCALE-NUMBERS-003` contract:
- `type="text"`, `inputmode="decimal"`, `data-locale-number`
- Accepts both `.` and `,` while typing or pasting in EN, RU, and HE
- Displays values in the active app language (`1.5` in EN/HE, `1,5` in RU) while keeping `input.value` canonical dot-decimal text for all callers
- Preserves typed/committed values across language switches without overwriting in-progress edits
- Excludes Home Game money fields (`#homeGameSmallBlind`, `#homeGameBigBlind`, `#homeGameAnte`, `#homeGameInitialBuyIn`) and integer table-size fields (`#personalSetupTable`)

## Converted Personal Strategy bb Fields

1. `#personalCollectionBb` (Fixed collection per player in bb) — marked in `locale-number-format-bootstrap.mjs` on template initialization and bound with `bindLocaleNumberInput` in `range-calibration-workspace.mjs`.
2. `#personalAnteBb` (Ante in bb) — marked in `locale-number-format-bootstrap.mjs` on template initialization and bound with `bindLocaleNumberInput` in `range-calibration-workspace.mjs`.
3. `#calibrationEffectiveStack` (Effective stack in bb) — marked in `locale-number-format-bootstrap.mjs` on template initialization and bound with `bindLocaleNumberInput` in `range-calibration-workspace.mjs`.
4. `#personalSetupStack` (Default effective stack in bb in the Game Setup modal) — marked in `locale-number-format-bootstrap.mjs` on template initialization and bound with `bindLocaleNumberInput` in `range-calibration-workspace.mjs`.
5. `[data-hand-field="custom-size"]` (Custom action size in bb) — bound with `bindLocaleNumberInput` (`fractionDigits: 3`) in `personal-strategy-hand-workspace.mjs`.
6. `[data-hand-field="opponent-bet"]` (Opponent bet in bb) — bound with `bindLocaleNumberInput` (`fractionDigits: 3`) in `personal-strategy-hand-workspace.mjs`.

## Files Changed

- `app/src/application/locale-number-format-bootstrap.mjs`
- `app/src/application/locale-number-input.mjs`
- `app/src/application/personal-strategy-hand-workspace.mjs`
- `app/src/application/range-calibration-workspace.mjs`
- `tests/locale_numbers003_input.test.mjs`
- `tests/personal_strategy_hand_workspace.test.mjs`
- `docs/ISSUE_REGISTER.md`
- `docs/archive/agent-reports/2026-11/PS-BB-FIELDS-LOCALE-001.md`

## Verification

- Syntax check (`node --check` on all 6 changed JS/MJS files): exit 0
- `node tools/run-tests.mjs --files tests/locale_numbers003_input.test.mjs`: `SUMMARY files=1 total=13 pass=13 fail=0 skip=0 todo=0 seconds=5`
- `node tools/run-tests.mjs --changed`: `SUMMARY files=121 total=1138 pass=1137 fail=0 skip=0 todo=1 seconds=205.2`
