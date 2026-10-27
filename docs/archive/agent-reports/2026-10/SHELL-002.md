# SHELL-002 report: the new shell from the mockups

Ticket: SHELL-002 · Product redesign (visual) · T2 · base `codex/stabilization` at `ddd4840` (DS-TOKENS-001; `git pull` was already up to date). Nothing staged or committed.

## 1. Outcome

- The sidebar is variant 4: Riverline brand; **Home**; **STUDY** (Training, Personal Strategy, Learn); **TOOLS** (Hand, Analyze, Equity); **LIBRARY** (Saved); **Game night** apart below a hairline; footer Language, Sound, Settings.
- Each group label is a quiet overline button. It opens that group's **hub screen**: one card per workspace with a one-line purpose. A card shows a "continue" line only when the app already holds the fact (see §2).
- The **workspace header** is shared: the title is in Rubik, then the existing context line, then a read-only **context chip** "Game: … · Approach: …", then the workspace's existing actions on the right.
- **Motion:** the rail is tagged `data-motion="control"` and the header `data-motion="nav"`. The workspace switch rises 10 px from the direction of travel at nav tempo. Keyboard switches stay instant (existing `data-motion-input="key"` rule). Reduced keeps a fade only.
- Every workspace, route, tour, Saved reopen and in-app deep link still works. The RTL sidebar sits on the right and mirrors correctly. EN, RU and HE strings are in place, and Midnight, Daylight and Slate render.

## 2. Step 0: content inventory, and key choices

### Current shell (before) → new structure

| Before | After | Note |
|---|---|---|
| Brand "Riverline · Poker strategy & analysis" + collapse button | Same | Mockup subtitle "Poker study" is illustrative; existing translated copy kept. Collapse kept (the mockup has none; dropping it would remove a working feature and its tests) |
| Group "Core study": Hand, Analyze, Training, Personal Strategy, Equity, Saved | Split into Study / Tools / Library | Routes (`data-mode`, `data-navigation-id`) unchanged |
| Group "Riverline": Home, Home Game, Guide | Home on top; Game night apart; Guide → **Learn** in Study | "Game night" was already the EN/RU/HE name of the Home Game key; Guide's title key is now "Learn" (Learn RU «Обучение», HE «למידה», per TERMINOLOGY) |
| Footer: Language (native select), Audio, Settings icon row | Same | About & legal does not exist yet: not added (no placeholder controls) |
| — | Hub labels Study / Tools / Library (new destinations `study`, `tools`, `library`, mode `hub`) | New |
| My poker (mockup Library) | Not added | Does not exist today |
| Header: title, context line, mode switch, source badge, Learn Riverline, Help, Account | Same plus the context chip after the context line; title in Rubik | Personal Strategy's context line (Game · Approach) moved into the chip so it is not shown twice |
| Collapsed-rail tooltips (data-tooltip on items) | Same, hub labels included | In the collapsed rail the hub labels show their icon (Study cap, Tools wrench, Library books) |
| Tour targets: Home tour step `quick-start` → `[data-tutorial-anchor="shell-navigation"]` on `<nav>` | Unchanged: the anchor stays on the new `<nav>` | Coach-mark focus fallback `.mode-nav-item[aria-current="page"]` still matches |
| Other code selecting nav buttons (guide, settings, welcome orientation, density, Personal Strategy bootstrap) | Unchanged: all select `.mode-nav-item[data-navigation-id=…]` / `[data-mode=…]`, which still exist | |

### Mockup boards (illustrative content) vs what was built

| Board content | Built? | Why |
|---|---|---|
| Sidebar 4: collapsible hub rows with chevrons, sub-items indented | Built with flat groups and quiet overline labels | The ticket asks for quiet overlines and one active signal; the newer PC boards (Training, Equity) draw the same flat STUDY/TOOLS/LIBRARY pattern |
| Home v3: Continue hero, Today's session, last game night, what Riverline noticed | Not changed | Home content is HOME-001; this ticket builds the shell only |
| Study hub: plan coverage table, drill launcher, review queue, learning path | One card per workspace | Those need data owners that don't exist yet. The ticket says "real continue information only where the app already has it" (SHELL-HUB-CONTENT) |
| Tools hub: recent hands, spots, Equity calculations; Paste hand history; Random spot | One card per workspace | Same reason |
| Header "Game: Thursday live · Approach: Serious" | Context chip, same template | Shown when known (SHELL-CONTEXT-CHIP) |
| Tools hub header chip "Table rules: Thursday game" | Not built | Table rules come in M2 (ticket) |

### Continue lines (only facts the app already holds)

- **Hand:** "Hand in progress · {Hand header facts}" when Home's view model has a live-hand continue item.
- **Personal Strategy:** "{answered} of {total} directly answered" from Home's resumable calibration item.
- **Training, Analyze:** the context line the workspace already published, only if the player opened that workspace this session. Without that rule the default setup would look like progress.
- **Saved:** "Last saved: {title}" from Home's recent section.
- **Learn, Equity:** none.

The hub reads no persistence, strategy or Equity (PERF-001 unchanged).

## 3. Files

Changed by this ticket:
- `app/index.html`: sidebar markup (lists, groups, hub labels), header chip, `#hubMode` with the three hubs' cards, `shell-navigation.mjs` script tag, `data-motion` tags
- `app/styles.css`: new `SHELL-002` section (after SHELL-001, before ANALYZE-COMPOSITION-001)
- `app/src/application/shell-navigation.mjs` (new): hub definitions, continue-line resolver, hub renderer, arrow-key focus
- `app/src/application/workspace-header.mjs`: `setPlayContext` / chip rendering with a whole-string template and `<bdi dir="auto">` values; re-render on language switch
- `app/src/core/logic.js`: hub routes, hub render on navigation, direction-of-travel attribute, Home publishes the chip from its view model
- `app/src/application/range-calibration-workspace.mjs`: publishes the chip (clears it with no Games) instead of its context line
- `app/src/locales/home-translations.js`: RU/HE for Study, Tools, Learn, hub purposes, chip templates, continue lines
- Tests: `tests/shell002_navigation_hubs.test.mjs` (new); updated `tests/core_flow001_navigation.test.mjs`, `tests/design003_app_shell.test.mjs`, `tests/uiqa001_layout_stabilization.test.mjs`, `tests/range_cal001a_workspace.test.mjs` (old groups and order, Guide → Learn, 208 → 240 px) and `tests/saved_composition002.test.mjs` (the Library-key check is scoped to `#homeMode`)
- Docs: `docs/project/DESIGN_SYSTEM.md` (Shell: code since SHELL-002; Personal Strategy context line), `docs/ISSUE_REGISTER.md` (5 new rows), this report

Pre-existing dirty, not touched: `.codex/config.toml` (modified), `.claude/` (untracked).

Outside the repo (QA): `C:\Users\sjzns\Projects\Riverline_QA_2026-10\SHELL-002\` (capture scripts, screenshots, mockup renders, `report.json`).

## 4. Verification

- `node --check` on every changed `.js`/`.mjs`: OK. `git diff --check`: clean. LF only. `git diff --stat` shows no whole-file churn.
- Focused tests: `tests/shell002_navigation_hubs.test.mjs` (new, 9 tests) covers the hub definitions vs sidebar groups; group label → hub → card → workspace; `navigateToProductDestination('study')`; continue-line honesty; the chip template, isolation and RTL template; Rubik title vs body-face card titles; one active signal in LTR and RTL; overline labels (no uppercase in HE); arrow-key focus; the direction-of-travel attribute and animation; the tour anchor; RU/HE strings.
- Final focused run (shell, navigation, header, motion, Analyze, Personal Strategy, first-use, layout, interactions; 10 files): 109 pass, 0 fail. `saved_composition002` + `training_f12_session_restart`: 22 pass, 0 fail.
- Full suite, once: `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs` ran 2824 tests: 2817 pass, 5 fail, 2 todo (the pre-existing TEST-HYGIENE-001 TODOs), 291 s. The 5 failures and what I did:
  1. `analyze_composition001` "no decorative borders or color": its guard lints everything from the Analyze marker to MOTION-FOUNDATION, and my CSS section sat there. I moved the section to just after SHELL-001. (The motion guard also bans any `:hover` after its own marker, so the end of the file was not an option either.)
  2. `range_cal001a_workspace`: pinned the old nav order. Retargeted to the variant 4 order.
  3. `saved_composition002` toolbar test: asserted that no element in the whole page has `data-i18n="Library"` (meant for the removed Saved title panels). The sidebar LIBRARY label uses that key, and the node-vs-null diff ran out of memory. Narrowed to `#homeMode`.
  4. `saved_composition002` keyboard coalescing: cascade from (3); passes after it.
  5. `training_f12_session_restart`: process crash (exit 134) under load; passes alone.
  I did not rerun the whole suite (the tier asks for one run). All five pass in the targeted reruns above.
- Firefox (headless, repo `tests/tooling/browser-runtime.mjs`, disposable profile, fresh app per config). Scripts: `capture.mjs` and `boot-errors.mjs` in the QA folder.
  - Configs: 1920×1080 EN Midnight; 1366×768 EN Midnight; 1920 HE Midnight; 1920 EN Daylight; 1920 EN Slate; plus 1920 RU Midnight for label length.
  - Each config has Home, the Study hub, Training and Analyze. EN and HE Midnight also have Tools, Library, Hand, Equity, Personal Strategy, Learn, Game night, Saved, keyboard focus after ArrowDown ×2, the collapsed rail, and a chip demo with **injected** example values.
  - `side-by-side/` holds 20 pairs (5 configs × Home, Study hub, Training, Analyze), each next to its board: Home v3, Study hub, Training quick refresher PC, Analyze v4. The boards are rendered from their saved HTML in `mockups/`.
  - `report.json` shows the expected theme, language, `dir`, a 240 px rail and a Rubik title in every config.
  - Console: one pre-existing intermittent error, `[Riverline Home] Riverline Home bridge is unavailable`. An A/B run (HEAD vs HEAD + this diff, both with the tracked `auth-config.example.js`) shows it on plain HEAD too, so this ticket did not cause it (HOME-BRIDGE-RACE). No page errors and no asset failures.
  - Reviewed by eye: Home, Training and Study at 1920 EN; Study at 1366; HE Study and the HE chip (values isolated, RTL rail on the right with the bar on the inline-start side); Daylight Analyze; Slate Study; the RU Study hub (labels fit); the collapsed rail.
  - Found and fixed in the browser: the chip dropped the spaces around names (inline-flex). It is now inline text.
- Visual status: **PARTIAL**. Screenshots exist for every config and pair; owner visual acceptance is open. The motion feel is not profiled beyond one keyframe on transform and opacity.

## 5. Differences from the mockup (with reasons)

1. **Hub screens are sparse** (one row of cards, empty below). The mockup content needs data that doesn't exist yet. Honest emptiness beats invented data. SHELL-HUB-CONTENT.
2. **Library hub has one card** (Saved). My poker doesn't exist; the card is capped at one column instead of stretching across the row.
3. **Groups are flat, not collapsible.** This follows the ticket (quiet overlines) and the newer PC boards. Collapsing would hide destinations behind a click for no gain at 1080 px of height.
4. **Active tint is `--navigation-active-surface`** (#222a26 in Midnight, as in the Sidebar 4 / Home v3 boards) plus the accent bar. The newer Training/Equity boards use a 12 % accent tint; the token keeps themes consistent. One signal, no border.
5. **Sidebar 240 px** (kit value, mockup 240); the brand subtitle keeps the app's translated copy.
6. **Collapse button kept.** It isn't in the mockup, but it is an existing feature. In the collapsed rail the hub labels show icons so hubs stay reachable.
7. **No About & legal link, no My poker:** neither exists (no placeholder controls).
8. **Context chip** is a pill in the header row (Equity PC board style) and shows only when a Game is known. In a fresh profile it is hidden; the screenshot `*-chip-demo-injected.png` uses injected example values to show the look.
9. **Workspace switch has no blur bridge** and the sidebar highlight doesn't glide (moment 13). These were left out to keep the switch short and 60 fps; SHELL-NAV-GLIDE.
10. **Home, Training and Analyze content** differ from their boards because those are other tickets (HOME-001, Training/Analyze redesigns). Only the shell is compared.

## 6. Limitations and debt

- New register rows: SHELL-HUB-CONTENT, SHELL-NAV-GLIDE, SHELL-CONTEXT-CHIP, SHELL-TERMS, HOME-BRIDGE-RACE.
- QA-SHELL-002 (legacy RTL header double-flip) was not touched; it is not in the shell header.
- The mobile (≤ 820 px) horizontal bar shows hub labels as items; phone layouts wait for MOB-02.
- `/review-animations` was not run (not available in this session); the motion is one keyframe on transform and opacity plus the existing press scale.

## 7. Disagreements or doc conflicts

- P1-01 / DESIGN_SYSTEM list "About & legal" and "My poker" in the shell; the ticket says no placeholders. I followed the ticket.
- The Sidebar 4 board draws collapsible hub rows; the ticket asks for quiet overlines. I followed the ticket (see §5.3).
- The new terms (Study, Tools) need a TERMINOLOGY decision (SHELL-TERMS). Hebrew Study «לימוד» and Learn «למידה» are close.

## 8. Git status

`git status --short`: modified `app/index.html`, `app/styles.css`, `app/src/core/logic.js`, `app/src/application/workspace-header.mjs`, `app/src/application/range-calibration-workspace.mjs`, `app/src/locales/home-translations.js`, `docs/ISSUE_REGISTER.md`, `docs/project/DESIGN_SYSTEM.md`, and five test files (`core_flow001_navigation`, `design003_app_shell`, `range_cal001a_workspace`, `saved_composition002`, `uiqa001_layout_stabilization`). New: `app/src/application/shell-navigation.mjs`, `tests/shell002_navigation_hubs.test.mjs`, this report. Pre-existing and untouched: `.codex/config.toml` (M), `.claude/` (??). Nothing staged or committed.
