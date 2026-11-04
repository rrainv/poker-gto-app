# ANALYZE-HANDOFF-STACK-001 report (T1)

Base: `origin/codex/stabilization` at `f2044b8`.

## 1. Outcome

Edit as Scenario can no longer show two different stacks for one decision without saying why. The Scenario model cannot carry the stack at the decision, so the loss is stated, not hidden: the Hand context panel gets a labelled note, EN/RU/HE.

## 2. Root cause and the choice

`scenarioInputFromHeroDecisionRecord` copies `context.stackBb`, the configured starting stack (100). That is correct for the Scenario model, not a copy bug:

- The Scenario Stack control is labelled "Starting stack".
- `createPlaybookScenarioFromDecisionInput` (playbook-state-source.mjs) always emits `heroStackBb: null` and `effectiveStackBb: null` with `scenario_live_stack_unavailable` / `scenario_effective_stack_unavailable`; the strategy then uses `stackBb` only as `base_v1_compatibility_spr`.
- Putting 79 into "Starting stack" would be false, and carrying live stacks needs a Scenario schema change (explicit approval). So: state the loss.

Fix: `#analyzeHandContextStackNote` in the Hand context (logic.js `renderAnalyzeHandContextStackNote`). It appears when Hero or effective stack at the decision differs from the starting stack, with the three numbers (Hero 99.0, effective 79.0, starting 100.0) and "SPR and pot odds can change". A Hero-only wording covers an unknown effective stack (multiway). Unknown is never printed as 0 (a first draft did print 0.0 for null; the new test caught it). One render, no extra resolve (PERF-001 kept: edit path asserts one update, one resolve).

## 3. Files

Changed: `app/index.html`, `app/src/core/logic.js`, `app/src/locales/product-translations.js`, `tests/extract_analyze_000_characterization.test.mjs`, `docs/ISSUE_REGISTER.md` (row QA-AUDIT-HAND-ANALYZE-STACK-001), this report. Pre-existing dirty: none.

## 4. Tests

- The pinned today's-behaviour test is kept, renamed and annotated: the controls still hold the starting stack and the edit still re-derives null stacks; what changed is that the panel now says so.
- `test.todo` replaced by 4 passing tests: note content and visibility (also while editing is open); Edit-as-Scenario path (one update, one resolve, lossy scenario with `scenario_live_stack_unavailable`); hidden when stacks are equal, Hero-only wording, RU/HE; lossy-context warning translated.

## 5. RU/HE string table (owner review)

| Key (EN) | RU | HE |
|---|---|---|
| Stack at this decision: Hero {hero}, effective {effective}. Edit as Scenario starts from the starting stack ({starting}) and cannot keep these, so SPR and pot odds can change. | Стек в этом решении: Hero {hero}, эффективный {effective}. «Изменить как сценарий» начинает со стартового стека ({starting}) и не может их сохранить, поэтому SPR и шансы банка могут измениться. | הסטאק בהחלטה זו: Hero {hero}, אפקטיבי {effective}. עריכה כתרחיש מתחילה מהסטאק ההתחלתי ({starting}) ואינה יכולה לשמור אותם, ולכן SPR ויחס הקופה עלולים להשתנות. |
| Stack at this decision: Hero {hero}. Edit as Scenario starts from the starting stack ({starting}) and cannot keep it, so SPR and pot odds can change. | (same, singular) | (same, singular) |
| The exact preflop role is unavailable in this lossy context, so a broad fallback is used. | Точная префлоп-роль недоступна в этом неполном контексте, поэтому используется широкая приближённая эвристика. | התפקיד המדויק בפרפלופ אינו זמין בהקשר החלקי הזה, ולכן משתמשים בהערכת גיבוי רחבה. |

## 6. Verification

- `node --check` on logic.js, product-translations.js and the test: ok. `git diff --check`: clean; all files LF.
- `node --test --test-concurrency=2 tests/extract_analyze_000_characterization.test.mjs tests/analysis001_app_integration.test.mjs tests/analyze_composition001.test.mjs tests/analyze_composition001_amend2.test.mjs tests/analyze_scenario_readiness001.test.mjs tests/full_hand_review001_integration.test.mjs tests/decision_economics001.test.mjs tests/decision_input_truth001.test.mjs tests/perf001_product_performance.test.mjs tests/saved_library001.test.mjs tests/i18n001_runtime_integrity.test.mjs`: tests 169, pass 169, fail 0, cancelled 0, skipped 0, todo 0.
- Browser: `UNVERIFIED` (not run; the note reuses the existing `analyze-hand-context-truth` style, so only a visual check of wrapping in RU/HE at 1366 is outstanding).

## 7. Limitations and debt

- Carrying live stacks through Scenario needs a schema change; not done (needs approval).
- The same note also shows for the Training Full Hand handoff (shared panel).
- The HE decimal and RU `99,0` formats follow the existing number formatter.
