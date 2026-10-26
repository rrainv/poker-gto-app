# Agent Report — DOMAIN-MATH-001

- **Ticket**: `DOMAIN-MATH-001` (Batch item B5)
- **Register IDs**: `REPO-AUDIT-011` (partial)
- **Branch**: `argon/m1-batch-2`
- **Date**: 2026-10-26
- **Outcome**: Done

## Summary of Changes

1. **Pot-Before-Action, SPR, and MDF Moved to `shared/poker-domain` Selectors**:
   - Added canonical selectors in `shared/poker-domain/actor-call-economics.js` and re-exported them from `shared/poker-domain/selectors.js` and `shared/poker-domain/index.js`:
     - `deriveActorPotBeforeActionBb(context)` (alias `actorPotBeforeActionBb`): computes actor-contestable pot before the current decision action (`actorContestablePotAfterCallBb - callAmountBb` or `(actorContestablePotAfterCallMilliBb - callCommitmentMilliBb) / 1000`), returning `null` when unavailable.
     - `deriveStackToPotRatio(context)` (alias `stackToPotRatio`): computes heads-up SPR (`effectiveStackBb / potBeforeActionBb`) when `opponentCount === 1`, `effectiveStackBb >= 0`, and `potBeforeActionBb > 0`, returning `null` otherwise.
     - `deriveMinimumDefenseFrequency(context)` (alias `minimumDefenseFrequency`) and `deriveMinimumDefenseFrequencyPercent(context)` (alias `minimumDefenseFrequencyPercent`): computes heads-up MDF (`potBeforeActionBb / actorContestablePotAfterCallBb`, or `* 100` for percent) when `opponentCount === 1` and a positive call is faced (`callAmountBb > 0`), returning `null` otherwise.
   - Exposed the selectors on `window.RiverlinePokerDomain` (and `window.RiverlinePlaybookState`) in `app/src/application/playbook-mode-bootstrap.mjs`.
   - Replaced the inline `actorPotBeforeAction` and `mSPR` math in `updateMetrics()` (`app/src/core/logic.js` ~L6334) and the inline `mdf` calculation in `trainingContextPresentationAdapter()` (`app/src/core/logic.js` ~L12897) with calls to `window.RiverlinePokerDomain.deriveStackToPotRatio(context)` and `window.RiverlinePokerDomain.deriveMinimumDefenseFrequencyPercent(decisionContext)`, leaving only formatting (`spr.toFixed(1)` / `'-'`) in UI code.

2. **Numeric Bet Amounts in Presentation Model (No Display-String Parsing)**:
   - Updated `createTrainingPresentationModel(exercise)` in `app/src/application/training-presentation.mjs` so each `actionHistory` entry (and `legalActions` `call`/`all_in` entry) carries numeric `amountMilliBb` and `amountBb` alongside `amountLabel`.
   - Updated `trainingActionHistoryForAnalysis(presentation)` in `app/src/core/logic.js` (~L14588) to read numeric `entry.amountBb` (or `entry.amountMilliBb / 1000`) directly instead of parsing `entry.amountLabel` with `Number.parseFloat(String(entry.amountLabel || '').replace('bb', ''))`.
   - Verified with Russian decimal commas (`"2,5 бб"`) and Hebrew labels (`"ב״ב 2.5"`) that `amountBb: 2.5` is preserved without truncation to `2` or `NaN`.

## Files Changed

- `shared/poker-domain/actor-call-economics.js`
- `shared/poker-domain/selectors.js`
- `app/src/application/playbook-mode-bootstrap.mjs`
- `app/src/application/training-presentation.mjs`
- `app/src/core/logic.js`
- `tests/domain_math001.test.mjs` (new)
- `docs/ISSUE_REGISTER.md`
- `docs/STATE.md`
- `docs/archive/agent-reports/2026-10/DOMAIN-MATH-001.md` (new)

## Verification & Tests Run

- Syntax checks (`node --check`):
  - `node --check shared/poker-domain/actor-call-economics.js` — PASS
  - `node --check shared/poker-domain/selectors.js` — PASS
  - `node --check app/src/application/playbook-mode-bootstrap.mjs` — PASS
  - `node --check app/src/application/training-presentation.mjs` — PASS
  - `node --check app/src/core/logic.js` — PASS
  - `node --check tests/domain_math001.test.mjs` — PASS
- Focused test suite:
  - `node --test --test-concurrency=4 tests/domain_math001.test.mjs tests/decision_economics001.test.mjs tests/design008_training_presentation.test.mjs tests/training001_app_integration.test.mjs tests/analyze_composition001.test.mjs tests/analyze_composition001_amend2.test.mjs tests/design006_playbook_workspace.test.mjs tests/analysis001_app_integration.test.mjs` — **90 pass, 0 fail**.
- Whitespace / line-ending check:
  - `git diff --check` — PASS (0 warnings/errors).

## Decisions Made

- Kept `function preflopBasePot()` in `app/src/core/logic.js` at its existing position because legacy VM-slice test harnesses (`tests/qa002_adapters.js` and `tests/uiqa001r_card_picker_adapter.mjs`) slice `logic.js` between `function preflopBasePot()` and `function updateMetrics()`.
- Added both `derive*` and short selector names (`deriveActorPotBeforeActionBb` / `actorPotBeforeActionBb`, `deriveStackToPotRatio` / `stackToPotRatio`, `deriveMinimumDefenseFrequency` / `minimumDefenseFrequency`, `deriveMinimumDefenseFrequencyPercent` / `minimumDefenseFrequencyPercent`) in `shared/poker-domain/actor-call-economics.js` and `shared/poker-domain/selectors.js`.

## Left Undone / Risks

- None for B5 scope.
