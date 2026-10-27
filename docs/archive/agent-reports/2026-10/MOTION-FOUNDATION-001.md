# MOTION-FOUNDATION-001 report (2026-10-27)

Execution class: Correctness/Architecture · Tier T1 · Claude Code (Opus 5.5). Base `codex/stabilization` at `245d7d1` (`git pull --ff-only`: already up to date). Nothing staged or committed.

## 1. Outcome
- **One motion scale.** The two old duration scales and their aliases are gone (`--duration-*`, `--motion-fast/normal/slow`, `--transition-*`, `--ease-standard`, `--motion-instant`, `--motion-*-semantic`, `--motion-poker-*`, `--motion-micro/standard/emphasis` as aliases). New `:root` tokens: the four curves (`--ease-out`, `--ease-in-out`, `--ease-drawer`, `--ease-spring`), base durations (`--motion-base-micro` 100, `-panel` 180, `-dialog` 240, `-table` 260, `-rare` 600), `--motion-fade` 160, `--motion-scale`, `--motion-tempo`. Rules use the scaled tokens `--motion-micro|panel|dialog|table|rare` = base × scale ÷ tempo. All usages were renamed (nearest old value → new token).
- **Tempo hook.** `data-motion="drill|panel|table"` (0.7), `"control"` (0.85), `"rare"` (0.6), `"nav"` (0.5). Scaled tokens are recomputed on every tagged element, so later tickets only tag. Untagged UI stays at tempo 1 (see debt).
- **Motion setting** in Settings › Audio & Motion: Instant / Faster / Standard / Reduced (existing `ui-segments` control, no new visual language). No stored choice = follow `prefers-reduced-motion` (live, on system change); a choice persists per device (`riverline_motion_preference`); "Match this device's setting" returns to following the system. EN/RU («ты») /HE (masculine singular) copy; the Settings tutorial step and the panel note were updated. Sound is untouched.
- **Reduced** = one global rule: only opacity transitions, at 160 ms; animations end at once (end states kept); no smooth scrolling. Full Hand comprehension pauses are script timings and do not change under any setting.
- **Keyboard rule**, one mechanism: a non-modifier keydown sets `data-motion-input="key"` on the root (CSS drops all transitions/animations; loading spinners keep turning) until the pointer moves or is pressed. Script-driven motion (smooth scrolls in `logic.js`, experience-event table travel, Full Hand travel, tutorial coach scroll) now asks `window.RiverlineMotion.allowsTravel()` instead of reading `matchMedia` directly.
- **Guardrails:** all 16 `transition: all` rules (incl. bare `transition: .2s`) now list explicit properties; the foundation block animates nothing but opacity; tests lint these.

## 2. Key design choices
- **All 25 `@media (prefers-reduced-motion …)` blocks became `:where(:root[data-motion-mode="reduced"]) …` (or `:not(reduced)`) scopes.** Otherwise an explicit Standard/Faster choice could never override a system "reduce", and choosing Reduced on a non-reduced system would miss them. `:where()` keeps each rule's original specificity, so the cascade is unchanged. A prepaint script sets the mode before first paint.
- **Legacy literal durations** (~55, e.g. `0.2s ease`) were wrapped as `calc(<value> * var(--motion-scale))`, not retuned: Standard timing is identical to before (no redesign), and Faster/Instant still scale them.
- Removed the two global "kill everything" reduced blocks and the `.riverline-shell * { transition: none !important }` part of one block: they made Reduced "no motion" rather than "fades only" (P1-09).
- The training spinner used `--duration-slow` as its spin period; it is now a literal 260 ms so Instant does not freeze it.
- `tests/helpers/css-model.mjs`: a `reducedMotion` environment now evaluates with the root in `data-motion-mode="reduced"`, which is what the app resolves the system preference to.

## 3. Files
Changed by this ticket:
- New: `app/src/application/motion-preference.mjs`, `motion-preference-bootstrap.mjs`, `motion-preference-prepaint.js`, `tests/motion_foundation001.test.mjs`, this report.
- `app/styles.css`, `app/index.html`, `app/src/application/settings-ia-bootstrap.mjs`, `app/src/application/experience-events.mjs`, `app/src/core/logic.js`, `app/src/tutorial/coach-mark.mjs`, `app/src/tutorial/current-app-tutorials.mjs`, `app/src/locales/i18n.js`, `app/src/locales/product-translations.js`, `app/src/locales/tutorial-translations.js`.
- Docs: `docs/project/DESIGN_SYSTEM.md` (new "Motion in code" paragraph), `docs/ISSUE_REGISTER.md` (MOTION-DEBT → Pending acceptance; new MOTION-HOVER-GATE, MOTION-LEGACY-LITERALS).
- Tests updated from the old tokens/media queries to the new contract: `tests/helpers/css-model.mjs`, `analyze_composition001`, `analyze_composition001_amend2`, `audio_motion001_experience`, `design002_theme_foundation`, `design007_equity_workspace`, `polish_final001_interaction_feel`, `product_ui001_interactions`, `replay001c_integration`, `settings_ia001` (the old "reduced motion is system status only" test now asserts the Motion setting), `table_presence002_integration`, `uiqa001_layout_stabilization`, `uiqa002b_range_poker_polish`.

Dirty before this ticket (not touched): `.codex/config.toml`, `.claude/`.

## 4. Verification
- `node --check` on every changed `.js`/`.mjs`: OK.
- `node --test tests/motion_foundation001.test.mjs`: 8/8 pass (pure durations/tempo; follows system by default, explicit choice persists and wins; Settings control persists and applies; CSS durations at Standard/Faster/Instant and per tempo, including scaled legacy literals; Reduced = opacity fades ≤ 200 ms; key path instant, modifiers ignored, pointer restores, spinners exempt; EN/RU/HE keys; guardrail lints).
- Full suite `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`: **2811 tests, 2809 pass, 0 fail, 2 todo** (both TODOs already there: TEST-HYGIENE-001-F01, F07). The first run before the test updates showed 26 failures, all from old token names or old `@media` source shape; fixed as listed above.
- `git diff --check`: clean. LF only (`git ls-files --eol`).
- Solver suite: skipped (no domain/solver/strategy change).
- **Browser** (Claude in-app browser, Chromium; Firefox not available here), 1920×1080 EN Midnight, dev server `tools/dev-web-server.mjs`: Settings › Audio & Motion at each setting. Computed values on a shell button: Standard 0.14 s; Faster 62.5 ms on a `--motion-micro` button; Instant 0 s; Reduced `transition-property: opacity`, 0.16 s; after a keydown 0 s, after pointer move back to 0.14 s; `scrollBehavior` smooth/auto as expected. Follow-device button hidden while following the system and shown after a choice. **Bug found and fixed in the browser:** `.ui-button` display beat `[hidden]` on that button. HE 1920: control and copy mirror correctly (RTL). Visual status: **PARTIAL**. Firefox 60 fps profiling and a feel check of the four settings on real moments were not done.
- `/review-animations` on the diff (self-applied; it adds no new animations):

| Before | After | Why |
| --- | --- | --- |
| 16× `transition: all …` (e.g. `styles.css` `.btn`, `.tab`, `.toast`) | explicit `transition-property` list | `all` animates unintended, off-GPU properties |
| global reduced `animation/transition-duration: .01ms` on `*` | opacity-only fades at 160 ms | reduced motion is gentler, not zero (P1-09) |
| key-triggered changes animated | `data-motion-input="key"` drops all motion | keyboard actions never animate |
| `@media (prefers-reduced-motion)` only | scoped to the Motion setting | the in-app setting can override the system |

  Remaining, not introduced here: the explicit property lists keep the legacy `box-shadow`/`filter` transitions (non-GPU), legacy weak or overshooting curves (`ease`, `cubic-bezier(.34,1.56,.64,1)` on card flips), the press translate rather than `scale(.97)`, and ~127 ungated `:hover` rules. All tracked (MOTION-LEGACY-LITERALS, MOTION-HOVER-GATE). Verdict for the foundation scope: **Approve**, with that debt.

## 5. Limitations and debt
- MOTION-LEGACY-LITERALS (new): legacy literals scale but are not retuned; untagged UI runs at tempo 1, not Balanced 0.7, until each moment is tagged.
- MOTION-HOVER-GATE (new): existing hover rules not gated to fine pointers.
- Keyboard mode lasts until the pointer moves, so async updates right after a key press (e.g. a result arriving) are also instant. Intended, but worth an owner feel check.
- Under Reduced, elements that had no transition now fade opacity changes over 160 ms (the global fades-only rule). Harmless so far.
- The test harness's `click()` fires no `pointerdown`, so one test resets `data-motion-input` by hand.
- `RET-HPR-CUSTOMIZATION-001` (manual reduced-motion override) is delivered by this setting. On acceptance it was closed. Its other items (rank-style control, card backs, custom themes, Daylight comfort) moved to the new row `RET-HPR-CUSTOMIZATION-002`.

**Acceptance (2026-10-27):** the owner accepted the ticket; MOTION-DEBT is closed.

## 6. Disagreements or doc conflicts
- The ticket says "Settings › Sound & motion"; the app's category is named "Audio & Motion". The name was kept (no redesign).
- MOTION_SPEC defines tempo per moment; the ticket's `panel` and `table` names map to Balanced 0.7. I added `control` (≈0.85: sidebar, switches, invalid input, search) because several spec moments use it.
- DESIGN_SYSTEM says Balanced is "the default for every moment"; untagged legacy UI stays at 1.0 here to avoid a visual change. Each moment ticket should tag.

## 7. Git status
`git status --short`: 26 modified (listed above plus `.codex/config.toml`, which was already dirty), untracked: the 4 new files, this report, `.claude/`. Nothing staged, committed, pushed or switched.
