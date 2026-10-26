# Agent Report: CLEANUP-PREP-001

- **Date:** 2026-10-18
- **Agent:** Gemini Argon (Antigravity)
- **Branch:** `argon/m1-batch-1`
- **Ticket:** B3 — `CLEANUP-PREP-001` (register row `DS-CSS-DEBT`, test hygiene findings F04 and F06)

## Outcome
Completed:
1. **Supabase UMD 404 fix (`app/index.html`, `app/src/application/authentication-bootstrap.mjs`):**
   - Removed the unconditional `<script src="node_modules/@supabase/supabase-js/dist/umd/supabase.js" defer></script>` tag from `app/index.html` (~line 37) so a fresh unconfigured checkout does not emit a 404 for the unbundled Supabase UMD script.
   - Added on-demand `ensureSupabaseUmdScript(browserWindow)` in `app/src/application/authentication-bootstrap.mjs` inside `installAuthenticationBridge`, guarded so it only loads when `config` is present and no `client`, `options.clientFactory`, or `browserWindow.supabase.createClient` exists. Sync remains disabled unless configured.
2. **CSS token cleanup & redundant `!important` removal (`app/styles.css`):**
   - Replaced **48** hard-coded colour literals and redundant `var(--token, #hardcoded)` fallbacks on `:root`-defined tokens with their exact existing `:root` tokens (10 legacy `:root` alias definitions, 7 exact `#fff`/`#ffffff` matches, and 31 redundant fallbacks on `:root` tokens).
   - Removed **106** provably redundant `!important` declarations from `app/styles.css` (**273** before → **167** remaining):
     - All **44** `!important` declarations inside retired legacy `[data-theme=...]` blocks (lines 2041–3365) plus **4** in retired theme selectors (`[data-theme="light"]`, `[data-theme="minimal"]`, `[data-theme="amber"]`).
     - **24** `!important` declarations in the exact duplicate responsive/print block (lines 5803–5988, duplicating lines 5681–5795).
     - **34** `!important` declarations on dead selectors or rules overridden by later rules.
3. **Browser-verified CSS bug fixes (`app/styles.css`):**
   - **F04 (`@media (max-width: 1100px)` Hand `private-cards` rail order):** At lines 13192 and 13196, `#gtoMode[data-product-destination="hand"][data-hand-stage]:not([data-hand-stage="setup"]) .playbook-decision-workspace { order: 1; }` and `.playbook-context-rail { order: 2; }` had specificity `(1, 4, 0)` due to the redundant `[data-hand-stage]` attribute selector alongside `:not([data-hand-stage="setup"])`, defeating `#gtoMode[data-product-destination="hand"][data-hand-stage="private-cards"] .playbook-context-rail { order: 1; }` (specificity `(1, 3, 0)`) at lines 13207 and 13745. Removed the redundant `[data-hand-stage]` so the general rule has specificity `(1, 3, 0)` and the later `private-cards`/`reveal` rules win in the browser (`railOrder: "1"`, `workspaceOrder: "2"`).
   - **F06 (Analyze dead-card header grid overridden to flex):** At line 18699, `html[data-layout-preset] #gtoMode[data-product-destination="analyze"] .playbook-dead-card-header { display: grid; ... }` had specificity `(1, 3, 1)` and lost in the browser to `html[data-layout-preset] #gtoMode[data-product-destination="analyze"] .playbook-cards-panel .section-head { display: flex; ... }` (specificity `(1, 4, 1)`) at line 17691. Scoped line 18699 under `.playbook-cards-panel .playbook-dead-card-header` (specificity `(1, 4, 1)`), restoring `display: grid` (`gridTemplateColumns: "188.967px 73.0333px 28px"`).
4. **Before/after screenshot comparison (1920×1080 EN Midnight & Daylight):**
   - Captured deterministic before/after screenshots of Home, Analyze, Training, and Hand in both Midnight and Daylight (`1920×1080`, EN) with seeded PRNG (`Math.random`, `crypto.getRandomValues`) and fixed `Date.now`.
   - **Home (Midnight & Daylight):** `0` differing pixels (`byteIdentical: true`).
   - **Training (Midnight & Daylight):** `0` differing pixels (`byteIdentical: true`).
   - **Hand (Midnight & Daylight):** `0` differing pixels (`byteIdentical: true`).
   - **Analyze (Midnight & Daylight):** `44,156` differing pixels in Midnight (2.13%) and `48,045` differing pixels in Daylight (2.32%), caused solely by the intentional **F06** fix (`.playbook-dead-card-header` changing from `display: flex; gap: 10px` to `display: grid; column-gap: 8px; row-gap: 4px`, making the header 6px more compact and shifting the left-rail controls below it up by 6px).

## Files Changed
- `app/index.html`
- `app/src/application/authentication-bootstrap.mjs`
- `app/styles.css`
- `tests/cleanup_prep001.test.mjs`
- `docs/ISSUE_REGISTER.md`
- `docs/STATE.md`
- `docs/archive/agent-reports/2026-10/CLEANUP-PREP-001.md`

## Colour Values Without an Exact `:root` Token (Left Untouched)
Per ticket rules, no new tokens were invented. Outside `:root` and theme palette definitions, the following **76** distinct colour literals (plus **4** `#fff`/`#ffffff` occurrences inside the HSV colour picker gradient and `--riverline-card-face` override at lines 7514, 7528, 7537, 7883) do not have an exact token in `:root`:
- `rgb(0 0 0 / .64)` (line 584)
- `rgba(59, 130, 246, 0.1)` (line 3559)
- `rgba(59, 130, 246, 0.3)` (line 3563)
- `rgba(37, 194, 129, 0.08)` (line 3878)
- `rgba(0, 0, 0, 0.4)` / `rgba(0,0,0,0.4)` (lines 3966, 4000, 4078, 4304)
- `#ef4444` (line 3992)
- `#2563eb` (line 4024)
- `rgba(0, 0, 0, 0.5)` / `rgba(0,0,0,0.5)` (lines 4111, 5157)
- `rgba(0,0,0,0.3)` (line 4320)
- `rgba(0,0,0,0.22)` / `rgba(0, 0, 0, .22)` (lines 4330, 13348, 13367, 13419)
- `rgba(255,255,255,0.1)` / `rgba(255, 255, 255, 0.1)` / `rgba(255,255,255,.10)` (lines 4374, 5141, 8034)
- `#93c5fd` (line 4686)
- `rgba(3, 7, 18, 0.8)` (line 4690)
- `rgba(255,255,255,0.05)` (line 4855)
- `rgba(255,255,255,0.4)` (line 4929)
- `rgba(0, 0, 0, 0.15)` (lines 5127, 5296)
- `rgba(0, 0, 0, 0.2)` / `rgba(0,0,0,0.2)` / `rgba(0, 0, 0, .2)` (lines 5314, 5791, 5953, 10259)
- `rgba(0, 0, 0, 0.25)` (lines 5380, 5641)
- `rgba(0, 0, 0, 0.6)` / `rgb(0 0 0 / .6)` (lines 5421, 16504)
- `rgba(0,0,0,0.8)` (lines 5470, 5681)
- `rgba(0,0,0,0.7)` (line 5478)
- `rgba(51, 65, 85, 0.6)` (line 5501)
- `rgba(30, 41, 59, 0.8)` (line 5529)
- `rgba(56, 189, 248, 0.15)` (lines 5535, 5591)
- `rgba(30, 41, 59, 0.9)` (line 5535)
- `rgba(56, 189, 248, 0.25)` (line 5537)
- `#f8fafc` (line 5564)
- `#334155` (lines 5574, 5601)
- `#94a3b8` (line 5616)
- `#e2e8f0` (line 5629)
- `rgb(0 0 0 / .31)` (line 6861)
- `rgb(0 0 0 / .28)` / `rgba(0, 0, 0, .28)` (lines 6975, 13424)
- `#000000` (lines 7434, 7513, 7530, 7536, 8260, 13343, 13344, 16753)
- `#ff0000`, `#ffff00`, `#00ff00`, `#00ffff`, `#0000ff`, `#ff00ff` (HSV colour picker spectrum, lines 7515, 7538, 7547, 7552)
- `#fff6df` (line 7873), `#8c826f` (line 7874), `#111714` (line 7884)
- `rgba(0, 0, 0, .32)` (line 7885)
- `rgba(35, 42, 38, .18)` (line 7958)
- `rgba(255,255,255,.6)` (line 7989), `rgba(255,255,255,.68)` (line 8309)
- `rgba(255,255,255,.28)` (lines 7990, 8306, 8308)
- `rgba(255,255,255,.15)` (line 8003), `rgba(255,255,255,.14)` (line 8033), `rgba(255,255,255,.12)` (line 8004), `rgba(255,255,255,.08)` (line 8020), `rgba(255, 255, 255, .04)` (line 13324)
- `rgba(70, 82, 76, .22)` (line 8065)
- `rgba(0,0,0,.16)` / `rgba(0, 0, 0, .16)` (lines 8099, 13321)
- `rgba(0, 0, 0, .26)` (line 13310), `rgba(0, 0, 0, .18)` (lines 13313, 13392), `rgba(0, 0, 0, .12)` (line 13527)
- `#61bfa7` (line 16381), `#d5a95e` (line 16459), `#d97474` (line 16471)
- `rgb(0 0 0 / .09)` (line 16749), `rgb(0 0 0 / .33)` (lines 16810, 16852), `rgb(0 0 0 / .13)` (lines 16810, 16865, 16867, 16884), `rgb(0 0 0 / .47)` (line 16829), `rgb(0 0 0 / .4)` (lines 16841, 16843), `rgb(0 0 0 / .27)` (lines 16862, 16893, 17015, 17017)

## Tests & Verification Run
- `node --test tests/cleanup_prep001.test.mjs` → `4 pass, 0 fail`
- `node --test tests/ds_foundation001.test.mjs tests/analyze_composition001_inspector_contract.test.mjs tests/core_flow001b_hand_stage.test.mjs tests/premium_layout001_workspace_composition.test.mjs tests/ui_density001_playbook_guardrail.test.mjs tests/account002a_authentication.test.mjs` → `40 pass, 0 fail`
- `node --check app/src/application/authentication-bootstrap.mjs` → `0` (clean)
- `node --check tests/cleanup_prep001.test.mjs` → `0` (clean)
- `git diff --check` → `0` (clean, LF only)

## Anything Left Undone / Risks
- None for `CLEANUP-PREP-001`. The remaining 167 `!important` rules (reduced-motion accessibility guard, `[hidden]` attribute guards, active utility/modal overrides, and `@media print`) and the 76 unmapped colour literals are documented for future `DS-TOKENS-V4` / `DS-COMPONENTS-V4` work.
