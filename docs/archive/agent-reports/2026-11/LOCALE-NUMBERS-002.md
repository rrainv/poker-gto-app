# LOCALE-NUMBERS-002 — Explain Locale Number Formatting

- **Ticket**: `LOCALE-NUMBERS-002` (T1)
- **Branch**: `argon/m1-batch-4`
- **Date**: 2026-11-06

## Summary of Changes

1. **`app/src/application/poker-sizing-presentation.mjs`**:
   - Replaced hardcoded `Intl.NumberFormat('en-US', ...)` in `compactDecimal` and raw `String(numeric)` in `formatExactPokerAmountBb` with `formatLocaleNumber` from `./locale-number-format.mjs`.
   - Added optional `language` option to `formatSuggestedSizingBb(value, { spaced, language })` and `formatExactPokerAmountBb(value, { spaced, language })`, defaulting to the active UI language (`en`, `ru`, `he`).
2. **`app/src/application/analysis-explanation.mjs`**:
   - Imported `formatLocaleNumber` and `formatLocalePercent` from `./locale-number-format.mjs`.
   - Updated `percent`, `wholePercent`, `bb`, `compactDecimal`, `normalizeHistory`, `blockerSection`, `bluffPressureSection`, `rangeSection`, `potOddsSection`, `sprSection`, `actionContextSection`, `strategySection`, `sizingSection`, `equitySection`, `heuristicSampleSection`, and `createAnalysisExplanation` (`summaryValues` / `summary`) to format percentages, bb amounts, ratios, and combo masses through `locale-number-format.mjs` and `poker-sizing-presentation.mjs`.
   - Added optional `language` option to `createAnalysisExplanation({ ..., language })` and exposed locale-dependent `values`, `text`, `amountLabel`, and `summary` via enumerable getters so mounted explanations in the booted app also re-format numbers on `setLanguage('en' | 'ru' | 'he')` without recomputing `AnalysisExplanation`.
3. **`tests/locale_numbers001.test.mjs`**:
   - Added EN, RU (decimal comma), and HE tests for `formatSuggestedSizingBb` and `formatExactPokerAmountBb`, `createAnalysisExplanation` facts across sections (`pot_odds`, `spr`, `action_context`, `bluff_pressure`, `blockers`, `range`, `heuristic_sample`, `equity`), and mounted `#teacherContent` language switching in the booted app.
4. **`docs/ISSUE_REGISTER.md`**:
   - Updated `LOCALE-NUMBERS-002` status.

## Verification

- `node tools/run-tests.mjs --files tests/locale_numbers001.test.mjs,tests/analysis001_explanation_service.test.mjs,tests/analysis_range001_integration.test.mjs,tests/ux_regression001.test.mjs`
  - `SUMMARY files=4 total=69 pass=69 fail=0 skip=0 todo=0 seconds=4.9`
- `node tools/run-tests.mjs --changed`
  - `SUMMARY files=169 total=1647 pass=1645 fail=0 skip=1 todo=1 seconds=276.7`
