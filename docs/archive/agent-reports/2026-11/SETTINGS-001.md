# SETTINGS-001 report: Settings rebuilt from the approved mockups

Base: `origin/codex/stabilization` `ea15545551f2de55a11fa119939ebe4104f9994c`. Tier T2. QA folder: `C:\Users\sjzns\Projects\Riverline_QA_2026-10\SETTINGS-001\`.

## 1. Outcome
Settings is a workspace (sidebar gear selects it; gear again, Escape or any sidebar item leaves it; the previous workspace returns as left, nothing re-runs). Three zones: category rail (search, modified filter, per-category counts), controls stream (max 720 px), sticky preview (real action card, mix bar, source label, labelled sample). Instant apply; a modified row has a 3 px inline-start marker and its own Reset. Built-in themes are immutable ("Duplicate & customise"). Categories: Appearance, Audio & Motion, Language (cards with a real sample line), Help & guide, Shortcuts (list only), Account & Data (exact counts, delete unchanged). No About & legal.

## 2. Step 0 inventory and mapping
Was a modal (`#settingsModal`, `.show`, `closeSettingsModal`, focus trap) with 4 tabs: Appearance (layout preset [hidden], four-colour, rank, face, back, theme library and editor), Audio & Motion (sound, volume, poker, study, test sounds, Motion), Language & Help (answer mode, language select, Open Guide, tour), Account & Data. Storage keys unchanged: `riverline_presentation_theme_customization`, `riverline_card_presentation`, `riverline_motion_preference`, `language`/`appLang`, SoundFX keys, `riverline_training_answer_mode`. Tour anchors kept on rail tabs (`settings-overview` on the tab list); tour step placement left to right. Sidebar gear `#openSettings` kept. Deep link: `window.RiverlineSettings.open('account')` (no existing in-code deep links existed). Language & Help split into Language and Help & guide; answer mode now under Help & guide > While you study (SETTINGS-TRAINING-CATEGORY updated).

## 3. Files
New: `application/settings-workspace.mjs`, `settings-shell.mjs`, `settings-model.mjs`, `settings-data-counts.mjs`, `locales/settings-translations.js`, tests `settings001_model`, `settings001_workspace`. Deleted: `settings-ia-bootstrap.mjs`. Changed: `index.html`, `styles.css`, `logic.js` (net shorter), `i18n.js`, `tutorial-bootstrap.mjs` (Help button stays in Settings), `current-app-tutorials.mjs` (placement), `ISSUE_REGISTER.md`, `tests/tooling/audit_i18n.cjs`, 12 existing tests updated from dialog to workspace. All pre-existing dirty files: none.

## 4. Verification
`node --check` on changed JS OK; `git diff --check` clean. Full suite once (`--test-concurrency=2`): 2954 tests, 2951 pass, 0 fail, 1 skipped (first run had 4 house-lint failures on my CSS, fixed). Firefox 159 (headless): 1920 and 1366 EN Midnight, 1920 HE, 1920 RU, 1920 Daylight and Slate, plus modified, filter and search states; mockup renders and side-by-sides in the QA folder. Worst-case pass by hand (break-ui): long and non-Latin theme names, 10-digit counts, 300-character search (fixed: capped at 80, wraps), no overflow. `/review-animations` and `/break-ui` not invocable as skills; applied by hand. Not run: solver suite (not touched), cloud, real auth.

Dead-space audit (page height / viewport; no horizontal overflow in any shot): side margins of the centred group are 146 px at 1920 (rail+stream+preview = 1404 px); panel padding below last row 23 px; shorter categories (Language, Help, Audio, Account) leave a strip below the content (allowed: no further real content exists); at 1366 Appearance 1330/768 and Shortcuts 1211/768 scroll, with rail and preview sticky. Exact per-shot numbers: `report.json`.

## 5. Motion (MOTION_SPEC 32-36)
32 built (glide 380 io, page enters from travel direction with blur bridge, tempo 0.7). 33 built (knob stretches, spring across, track fills; tagged `control`, 0.85). 34 built (bubble rides the thumb; there is one slider). 35 not built (rebinding, M2). 36 built within Settings (crossfade with blur, Hebrew slide, tempo 0.5). Keyboard instant via the global rule. Reduced: swap is instant, not a fade (SETTINGS-REDUCED-FADE).

## 6. Differences from the mockup
Rail is a panel as drawn, but no Chippy or About & legal (not built / NOTICES-001). No Table felt, Text size, Numbers format, card animation, glossary, keyboard-hint toggles (no backing setting; SETTINGS-MOCKUP-CONTROLS, SETTINGS-TEXT-SIZE). Theme tiles keep the DS 2x2 swatches (no palette strips). Preview is a labelled static sample with Raise/Call/Fold, not "3-bet 55%" and no pot figure (invented numbers; SETTINGS-PREVIEW-SAMPLE). Preview stays visible on Shortcuts and Account to keep the layout stable. Theme editing (Save changes/Cancel) remains a transaction on copies. Search, modified marker and Reset borrowed from the explorer idea; Export and Clear history rejected.

## 7. Limitations and debt
Register rows added: SETTINGS-TEXT-SIZE, SETTINGS-MOCKUP-CONTROLS, SETTINGS-THEME-HOVER-PREVIEW, SETTINGS-SOUND-CATEGORIES, SETTINGS-KEYS-PHYSICAL (P2), SETTINGS-PREVIEW-SAMPLE, SETTINGS-REDUCED-FADE, SETTINGS-TOUR-COPY. The Training "Feel" popover also uses `data-motion-option` buttons (pre-existing).

## 8. Disagreements
"No staging or commit" and "push to origin/wip/SETTINGS-001" conflict (a push needs a commit); neither was done.

## 9. Git
Committed as `4ee37f1` (exact file list, nothing broad-staged; `.claude/` and `.codex/config.toml` untouched), pushed to `wip/SETTINGS-001`, then rebased onto `origin/codex/stabilization` `ea15545` (no movement) and fast-forwarded into `codex/stabilization` after owner acceptance.
