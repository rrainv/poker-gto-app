# CSS-DEADTHEME-001: remove CSS for themes nobody can select

Ticket: CSS-DEADTHEME-001 · Mechanical Fast · T1 · branch `wip/CSS-DEADTHEME-001` (base `e884ce6`)

## 1. Outcome

`app/styles.css` lost 54 dead-theme rules, 8 duplicate rules and 2 dominated rules (64 rules), and one selector list was trimmed, with **no change to any live rule value**. Before and after Firefox screenshots (16 of them) are pixel-identical.

| | Before | After | Change |
|---|---|---|---|
| Lines | 20,172 | 18,985 | -1,187 |
| Bytes | 927,110 | 907,046 | -20,064 (about 2.2%) |

## 2. How reachability was decided

The theme owner is `app/src/application/presentation-theme.mjs` (the ticket said `app/src/ui/`; the file is under `application/`). `PRESENTATION_THEMES` there contains **midnight, graphite, daylight, slate**. Every path that writes `data-theme` goes through it (`presentation-theme.mjs:623` writes `base.id` of a built-in theme; `presentation-theme-prepaint.js:7-10` only accepts those four; `normalizePresentationTheme` falls back to `midnight`; the legacy `appTheme` and custom themes resolve to one of the four through `baseThemeId`). `app/index.html` and `tools/dev-pages/component-sheet.html` hard-code `data-theme="midnight"`. Nothing else sets the attribute.

**`felt` disagreement (for the owner):** the ticket lists `felt` as allowed, but it is **not** in `PRESENTATION_THEMES` and nothing sets `data-theme="felt"` (the only "felt" in the theme module is a colour token, `SUPPORTED_COLOR_TOKENS`). So the 10 `[data-theme="felt"]` rules in `styles.css` (the `.panel`, `.cta`/`.btn-action`, `.card-slot` blocks around the old lines 2751-2841 and 4132) are unreachable too. I **kept** them as the ticket instructs; remove them in a follow-up if you agree they are dead.

Rule used: a selector is dead when it contains a `[data-theme...]` attribute test that no allowed theme can satisfy (`=`, and the `*=` wildcard forms were evaluated against the five ids). Selectors inside `:not(...)` were not treated as dead. A rule is removed only when **all** its selectors are dead; in a mixed list only the dead selectors were dropped. Nothing was classified as "manual/ambiguous" by the tool.

## 3. What was removed

54 whole dead-theme rules (old lines 2159-5883; 53 by the dead-theme pass and the earlier copy of the `.suit-s` rule by the duplicate pass):

| Dead theme | Rules |
|---|---|
| `terminal` | 12 |
| `luxury` | 7 |
| `brutalist-red/-cyan/-purple/-amber/-emerald/-rose/-slate` | 3 each (21) |
| `discord-0px` | 2 |
| `serious-pio` | 2 |
| `discord`, `cyberpunk`, `monochrome`, `legacy-midnight-cyan`, `red`, `blue`, `green`, `orange`, `purple` | 1 each |
| `[data-theme*="terminal"] / [data-theme*="brutalist"] .suit-s` | 2 (the same dark-contrast rule existed twice; one copy went in the duplicate pass) |

Mixed selector list, one rule: `[data-theme="red|orange|green|purple|blue"] .card-slot.facedown, [data-theme="felt"] .card-slot.facedown` now reads only `[data-theme="felt"] .card-slot.facedown {`. This is the only line added to the file.

Orphaned comments removed: `/* Brutalist Themes - 0px border radius variations */`, the two copies of `/* Dark contrast enforcement for terminal / dark brutalist modes */`, and one `/* RTL Fixes for text scale mirroring */` left above a surviving rule whose twin carries the same comment lower down.

## 4. Duplicate RTL / contrast blocks (ticket line pairs 5804-5873 vs 5925-5998, 5874 vs 6025)

They were **not byte-identical** (the second block adds a `.path-progress` rule, and two rules differ in `!important`), so I only removed what is provably redundant:

- 8 rules in the first block (old lines 5811, 5816, 5836, 5843, 5856, 5860, 5869 and the `.bar > *` mirroring rule at 5875) that have a byte-identical later twin (same selector list, same body, normalised whitespace). The later copy wins every property in the cascade, so deleting the earlier one cannot change any final value (tool: `dedupe` pass, range 5804-5880).
- 2 rules in the second block that are **dominated**: `[dir="rtl"] .matrix-wrap, .strategy-grid, #strategyGrid { direction: ltr; }` and `[dir="rtl"] #heroAdvBar, #villainAdvBar { transform-origin: right; }` also exist earlier with `!important`; the plain copies could never win. The `!important` copies stay.
- Not touched: the `.path-progress` rule that exists only in the second block; the `.mode-view`/`.card` animation rules at old 5895/5899 (outside the ticket's ranges, though they too have identical later twins: candidate for a follow-up).

## 5. Left as is, worth a decision

- `html:not([data-theme="midnight"]):not([data-theme="graphite"]):not([data-theme="daylight"]):not([data-theme="slate"]) { --surface-canvas: var(--bg); ... }` (now around line 2381, under the comment "Legacy themes remain selectable while component CSS migrates"). It only applies to themes outside the four, so it is dead too, but it also matches an `<html>` with no `data-theme`. Removing it is a behaviour judgement, so I left it and its now-false comment.
- `[data-theme="felt"]` rules: see section 2.

## 6. Tests

Tests that read the removed selectors: **none**. A search for the dead theme names in `tests/` found only `design002_theme_foundation.test.mjs`, `i18n001_runtime_integrity.test.mjs` and `product_theme001_presentation.test.mjs`; they assert that dead themes are *normalised away or absent from the UI*, not that CSS exists, and all three pass unchanged (30 tests). No test file was edited.

## 7. Verification

- `git diff --check`: clean. `git ls-files --eol app/styles.css`: `i/lf w/lf`.
- `git diff -U0 --minimal`: 1 added line (the rebuilt `[data-theme="felt"] .card-slot.facedown {`), everything else is deletions.
- `node --test tests/design002_theme_foundation.test.mjs tests/i18n001_runtime_integrity.test.mjs tests/product_theme001_presentation.test.mjs`: 30 pass, 0 fail.
- Full suite once: see section 8.
- **Firefox (puppeteer-core, headless, dev server on a free port, Guest, reduced motion, 1920x1080):** screenshots of Home, Training, Analyze and the Settings dialog for Midnight EN, Daylight EN, Slate EN and Midnight HE (16 shots). I captured the baseline from the original CSS **twice** (identical hashes: the check is deterministic), then the new CSS once: **all 16 SHA-256 hashes identical, i.e. no visible difference at pixel level.** I also opened one image (Slate, Analyze) to confirm the shots are real renders. The shared `createBrowserRuntime` helper in `tests/tooling` throws `UnsupportedOperation` (`request.resourceType()` under the installed puppeteer-core 25.10.0 BiDi), so the capture script uses `launchFirefox` and `startDevWebServer` directly; the script lives outside the repo (not committed). The tooling `npm ci` was needed (`tests/tooling/node_modules` is ignored, nothing staged from it).

## 8. Full suite

`node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`: 2843 tests, **2839 pass, 1 fail, 1 skipped, 2 TODO** (the TODOs are the pre-existing TEST-HYGIENE-001-F01 and -F07 Equity entries).

The one failure was `tests/saved_composition002.test.mjs` "Training history keyboard browsing coalesces the Saved lookup to the row the user stops on" (`1 !== 2`, a timer-coalescing count). It is unrelated to CSS (the test never reads `styles.css`). Run alone it passes: `node --test tests/saved_composition002.test.mjs` x3 gave 15 pass, 0 fail each time, so I treat it as load-sensitive timing under `--test-concurrency=4`, not as caused by this change. I did not re-run the baseline commit under the same load, so that attribution is a judgement, not a measurement.

## 9. Files, limits, git

- Changed by this ticket: `app/styles.css`; added: this report.
- Not verified: Graphite theme (no shot taken; it shares only live rules), RU, 1366 width, other workspaces than the four listed.
- No tests were edited, no register rows touched. Nothing staged outside the exact file list; `.codex/config.toml` and `.claude/` untouched.
