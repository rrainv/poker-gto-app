# A11Y-KEYS-001 (B8): card picker and matrix keyboard access

Ticket: B8 · Correctness · T1 · branch `argon/m1-batch-3` (base `3559a20`) · done by Claude while Argon is out of quota
Issues: QA-SWEEP-016, A11Y-MATRIX-KEYS (the ID had no register row; added)

## 1. Outcome

- **QA-SWEEP-016 (Fixed).** The 52-card deck is one Tab stop (roving `tabindex`). Arrow keys move by suit row (Up/Down) and rank column (Left/Right) and skip unavailable cards; at an edge focus stays put. Home/End go to the row ends, Ctrl+Home/End to the first/last enabled card. Left/Right follow the visual direction, so they swap when the deck is laid out RTL. The Tab stop follows focus (click, pick, clear, reopen) and opens on the first drafted card, otherwise the first enabled one. Arrow keys are always consumed while focus is in the picker (deck or other picker controls, not text inputs), so ArrowDown never scrolls the page. Enter and Space stay with the native `<button>`; Escape still closes; the Tab trap ignores the 51 `tabindex=-1` cards.
- **A11Y-MATRIX-KEYS (Fixed).** The strategy matrix (`#strategyGrid`) and both Range Category Comparison grids are proper ARIA grids: 13 `role="row"` wrappers (`display: contents`, so the 13-column CSS grid is unchanged; `aria-rowindex` on the row, `aria-colindex` on the cell). One roving Tab stop (the selected hand, else the focused or first cell), arrows, Home/End, Ctrl+Home/End, no wrap. Arrows stay physical in RTL because the matrix is never mirrored (P1-30). Focus ring: 2 px `--border-focus` outline on every matrix cell (the Analyze preset already had one; the Range comparison grids had only the browser default). Per-cell labels already named hand, kind and state (`AKs, Suited: Raise 60% · …`, `AKs: Strong made`); kept. The Analyze `.matrix-wrap` scroll container was a second Tab stop; its `tabindex` and label were removed (focusing a cell scrolls it into view), plus the two orphaned RU/HE strings.

## 2. Key design choices

- Shared helpers in `logic.js`: `buildMatrixGridCells`, `matrixGridCells`, `syncMatrixTabStop`, `bindMatrixGridKeyboard` for all three matrices; `deckCardRows`, `syncDeckTabStop`, `deckKeyboardTarget` for the deck. Tab-stop sync writes `tabIndex` only when it changes, so a selection touches at most the old and new stop (PERF-001: no deck rebuild, no extra Matrix work).
- Cell lookup moved from `grid.children[idx]` to the gridcell list (rows are now the children).
- Unavailable cards stay natively `disabled` (not focusable); navigation skips them rather than making them focusable with `aria-disabled`. Their label still says "unavailable" to anyone reading the deck in browse mode.

## 3. Files

Changed by this ticket: `app/src/core/logic.js` (deck and matrix hunks), `app/index.html` (`.matrix-wrap` attributes), `app/styles.css` (A11Y-KEYS-001 block), `app/src/locales/product-translations.js` (two orphaned strings removed), `docs/ISSUE_REGISTER.md` (QA-SWEEP-016, new A11Y-MATRIX-KEYS row), `tests/a11y_keys001.test.mjs` (new), `tests/uiqa001r_card_picker_adapter.mjs` (extracts `syncDeckTabStop`), `tests/qa001_adapters.js` (mock deck gains `querySelectorAll`), `tests/perf_rl18_hidden_dom.test.mjs` (allows the roving `tabindex` move), `tests/product_ui005_workspace_fit.test.mjs` and `tests/uiqa002b_range_poker_polish.test.mjs` (row index now on `role=row`; wrap is not a Tab stop).
Pre-existing untracked: `.claude/` (not touched, not staged).

## 4. Verification

- `node --test tests/a11y_keys001.test.mjs`: 4 pass.
- Related suites (premium_card_system_v1, design005/006/007, uiqa002a/b, perf_rl18_hidden_dom, analyze_range_ux001, product_ui005, analyze_composition001(+amend2), card_clear_semantics001, i18n001, cleanup001f, hands_on_defects001, strategy_integrity001b, polish_final001, equity_closeout001, equity_correction001, analyze_scenario_readiness001, core_flow_correctness001, audio_motion001, prelabs_fix001): first run showed 9 `card_clear_semantics001` failures (mock adapter lacked the new helper / `querySelector`), 1 perf_rl18 failure (roving `tabindex` mutation) and 3 structure assertions (row index, wrap stop); fixed as listed in §3; rerun 279 pass, 0 fail, 1 pre-existing TODO (TEST-HYGIENE-001-F07).
- `node --check` on changed JS; `git diff --check` clean; LF confirmed.
- Full suite: the first full run (before this fix) had one real failure caused by this ticket: `qa001_evaluator_equity` "production card picker marks already-used equity cards unavailable" (`deck.querySelectorAll is not a function`; another mock deck in `tests/qa001_adapters.js`). Fixed by stubbing `querySelectorAll` on the mock; `node --test tests/qa001_evaluator_equity.test.js` 39 pass. Final full-suite numbers: BATCH-SUMMARY-3.md.
- **Browser (Chromium pane, Midnight, EN; the pane was emulating 1920×1080 at the start, later checks ran at the pane's own width):** picker opened from the Analyze board editor with focus on A♥ and one stop; real Right Right Down Down landed on Q♦ with the stop following and `scrollY` unchanged; Space picked Q♦ (visible ring); Tab left the deck, Shift+Tab returned to Q♦; Escape closed and focus went back to the board editor. Matrix: 169 cells in 13 rows, grid still 13 equal columns (855 px / 63 px cells), wrap has no `tabindex`, one stop (AA); real arrows moved to QJo with a 2 px solid outline and the inspector followed; the accessibility tree exposes `gridcell "AKs, Suited: Strategy unavailable"`.
- Not checked: HE in the browser (RTL deck mapping is unit-checked only for the matrix; the deck's RTL swap is untested), Firefox, NVDA/VoiceOver speech.

## 5. Limitations and debt

- Deck RTL arrow mapping relies on the computed `direction` of `#deck`; no automated test covers it (the test DOM has no computed direction). Visual status for HE: UNVERIFIED.
- The calibration "Matrix Edit" grid (`range-calibration-workspace.mjs`) was not in scope; it already uses its own roving `tabindex`, so it was left alone (two roving implementations now exist; consolidating them is optional cleanup, not filed).

## 6. Disagreements or doc conflicts

None.

## 7. Git status

Committed as one commit on `argon/m1-batch-3` with the exact file list above (the hunks for this ticket only); `.claude/` not staged.
