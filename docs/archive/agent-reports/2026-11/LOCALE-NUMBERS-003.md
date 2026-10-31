# LOCALE-NUMBERS-003: amount fields follow the app language

Ticket: LOCALE-NUMBERS-003 · Product Contract First (small) · T1 · branch `wip/LOCALE-NUMBERS-003` (base `e884ce6`)

## 1. Outcome

Bug: `<input type="number">` renders and parses in the browser's locale, so a Russian browser showed `1,5` in the English app. The bb/chip amount fields in Analyze, Hand and Training are now **text inputs with `inputmode="decimal"`** that:

- accept `.` and `,` whatever the app language is, typed or pasted (`2,5`, `2.5`, `1,234.5`, `1.234,5`, `1 234,5`);
- display the value in the **app** language after the user leaves the field or the language changes (EN and HE `2.5`, RU `2,5`), and never rewrite half-typed text (`2,` stays while typing; `abc` stays visible and is flagged by the existing readiness logic; unknown is never zero);
- keep `input.value` as plain dot-decimal text for every existing reader, so no poker or readiness logic changed.

Confirmed in Firefox with the browser reporting `ru-RU` (the bug's setup) in an EN and a RU app (section 5).

## 2. Design choice (the one thing to review)

Many places read these fields through `.value`, `Number(...)`, `selectedValue('#id')` and `readSliderPairDraft`. Rather than edit every reader, `bindLocaleNumberInput` (new, `app/src/application/locale-number-input.mjs`) installs an own `value` property on the element: the **getter** returns the canonical number text (`"2.5"`) when the field parses, `""` when empty, and the **raw typed text** when it is not a number (so validators see it as incomplete, never as 0); the **setter** (used by app code, e.g. slider sync) writes the app-language display text. A user's keystrokes write the field's own text through the native setter and are never rewritten while typing. `valueAsNumber` is mirrored. Consequence for tests: a test that simulates typing by assigning `input.value` now triggers formatting; such tests write through the native setter instead (section 4).

Parser rules (`parseLocaleNumber` in the existing `locale-number-format.mjs`): a single `.` or `,` is the decimal mark, so `1,234` is **1.234**, not 1234 (bb amounts are small; this is the "accept both" contract). Several of one mark, or both marks, are thousands groups only when the groups are three digits (`1,234,567`, `1.234,5`); anything else (`1,2,3`, `1.2.3`, `1e3`, `1,5bb`) is not a number. `2.` and `.5` are accepted drafts. Spaces, NBSP, thin spaces, apostrophes and bidi marks are ignored; U+2212 is a minus.

## 3. Fields

Converted (8 static + 2 dynamic):

| Workspace | Field | How |
|---|---|---|
| Analyze | `facingSizeNum`, `potSizeNum`, `stackNum`, `anteNum` | `app/index.html` `type="text" inputmode="decimal" data-locale-number`; bound by the bootstrap before `logic.js` runs |
| Analyze | exploit-teacher "Size" field | `exploit-teacher-workspace.mjs` calls `bindLocaleNumberInput(size)` |
| Hand | `handStackBb`, `handAnteBb`, `handActionAmountBb` | as above |
| Training | `trainingStackNum` | as above |
| Training | Full Hand "Bet/Raise to" sizing field (created in `logic.js`, `renderFullHandTrainingSizingControls`) | `window.RiverlineLocaleNumberInput.bind(input)` after min/max/step/value are set |
| Equity | none | the only number field is `equitySeed` (an integer seed) |

**Left as `type="number"` on purpose:**

- **Home Game money fields (excluded by the ticket: exact-money domain):** `homeGameSmallBlind`, `homeGameBigBlind`, `homeGameAnte`, `homeGameInitialBuyIn` and the dynamic amount inputs in `home-game-bootstrap.mjs` (lines about 549 and 698, `home-game-amount-input.mjs` relies on `validity.badInput`).
- Integers and percentages (no decimal-separator problem): `playersNum`, `handTableSize`, `trainingPlayersNum`, `equitySeed`, `trainingSeedInput`, `trainingOpponentSeed`, the opponent policy percentages (`opponent-*Percent`, `training-lineup-preview.mjs`), Personal Strategy percentages (`personal-evidence-review.mjs`, `personal-strategy-hand-workspace.mjs`).
- **Outside the four workspaces named in the ticket, but they are bb amounts with the same bug (follow-up candidate):** Personal Strategy `personalCollectionBb`, `personalAnteBb`, `calibrationEffectiveStack`, `personalSetupStack`, the bb size inputs in `personal-strategy-hand-workspace.mjs` (lines about 254 and 355; step 0.001) and `range-calibration-workspace.mjs` (about 2132).

## 4. Tests

New `tests/locale_numbers003_input.test.mjs` (12 tests, all pass): parser table (accepted and rejected strings), input formatter per language, the 8 fields are decimal text fields, no unexpected `type="number"` fields remain (and none of the converted ones went back), EN/RU/HE typing and commit, language switch keeps the value, half-typed text and non-numbers are never coerced, programmatic writes use dot-decimal, paste in both conventions (and junk left to the browser), binding is idempotent and reversible.

Existing tests changed (each because it asserted the old `type="number"` field or simulated typing by assigning `.value`):

| Test file | Change | Reason |
|---|---|---|
| `analyze_composition001_amend2.test.mjs` (A3) | expected `type` is `text` for facing/pot/stack, still `number` for `playersNum` | amounts are decimal text fields now; the table-size count stays a number field |
| `core_flow001b_hand_stage.test.mjs` | `handActionAmountBb` type `text` + `inputmode="decimal"` | same |
| `table_presence002_integration.test.mjs` | `handActionAmountBb` type `text` | same |
| `training_composition001_correction1.test.mjs`, `training_hand_mode001_ui.test.mjs` | sizing input found by `input[inputmode="decimal"]` instead of `input[type="number"]` | the sizing field is a text field now |
| `decision_input_truth001.test.mjs` | `typeText` (native setter) emulates keystrokes and `displayedText` reads what the field shows | these tests assert that typed drafts like `2.` are never rewritten; with the new setter, assigning `.value` is an app write that formats. The 584 "focus" failure was a knock-on of the first failure, not a separate problem |

`styles.css`: `input[data-locale-number]` joins the `input[type="number"]` rule that gives numeric fields the data font and tabular figures, so the converted fields look as before. Screenshots confirm it (below).

## 5. Verification

- `node --check` on every changed `.js`/`.mjs`: ok. `git diff --check`: clean.
- `node --test` on the 8 affected test files: 81 pass, 0 fail.
- Full suite once (shared module `locale-number-format.mjs` changed): `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`: 2855 tests, **2852 pass, 0 fail**, 1 skipped, 2 TODO (the pre-existing TEST-HYGIENE-001-F01 and -F07 Equity entries). (A first full run found the 10 failures fixed as listed in section 4.)
- **Firefox (headless puppeteer-core, dev server on a free port, 1920x1080, Guest), browser reporting `ru-RU`:**
  - EN app, Analyze: typed `2,5` in "Pot before action" -> while typing `2,5`, after Tab `2.5`, `value` `2.5`, slider 2.5; typed `3.25` -> `3.25`; "Facing size" `12,5` -> `12.5`.
  - RU app: the stored `3.25` shows as `3,25`; typed `2,5` stays `2,5`; facing `12,5` shows `12,5` with value `12.5`.
  - Switching EN -> RU -> EN keeps the values and only changes the mark (`3.25` / `3,25`, `12.5` / `12,5`).
  - Hand `handStackBb` 100 / `handAnteBb` 0 and Training `trainingStackNum` 30 render as text decimal fields in both languages.
  - **Visual regression:** 16 screenshots (Home, Training, Analyze, Settings x Midnight EN, Daylight EN, Slate EN, Midnight HE) are **pixel-identical** (SHA-256) to the same shots taken on the base commit, so the converted fields look exactly as before.
  - Console: only `auth-config.js` blocked (no auth config in this worktree; the app runs as Guest, none created).
  - Not checked in the browser: real clipboard paste (covered by the unit test with a synthetic paste event), HE typing (covered by the test, not by a browser run), Daylight/Slate interaction, the Training Full Hand sizing field in a running session, phone width, screen-reader behaviour of the changed fields (`inputmode="decimal"` and the existing labels are unchanged).

## 6. Limits and debt

- A single separator is always a decimal mark: typing `1,234` meaning one thousand 234 gives 1.234. Acceptable for bb amounts; a chips-in-thousands field would need a different rule (Home Game is excluded for this reason).
- `valueAsNumber`, `value` and `min`/`max`/`step` are still available on the converted fields, but the browser no longer enforces `min`/`max`/`step` on a text input; the app's existing bounds checks (`readSliderPairDraft`, readiness, Training sizing validation) are what apply, as before for typed values.
- Follow-up candidates: the Personal Strategy bb fields listed in section 3.
- No register rows changed.

## 7. Files and git

Changed: `app/index.html`, `app/styles.css`, `app/src/application/locale-number-format.mjs`, `locale-number-format-bootstrap.mjs`, `exploit-teacher-workspace.mjs`, `app/src/core/logic.js` (3 lines), new `app/src/application/locale-number-input.mjs`, new `tests/locale_numbers003_input.test.mjs`, six existing tests (section 4), this report. One commit on `wip/LOCALE-NUMBERS-003`, pushed to that branch only. `.codex/config.toml` and `.claude/` untouched.
