# HOME-BRIDGE-RACE report

## 1. Outcome

Fixed at the root. `logic.js` init now waits until every module script has finished evaluating, so `window.RiverlineHome` and the other bridges exist when Home first loads. No retry.

## 2. Root cause

`authentication-bootstrap.mjs:524` and `saved-study-sync-bootstrap.mjs:577` end with an inline top-level await (`if (typeof window !== 'undefined') await install…Bridge(window);`). The first one awaits `import('../../auth-config.js')`, a network fetch. A module with a top-level await anywhere in its graph is an async module, and so is every importer: `saved-study-object-bootstrap`, `home-workspace-bootstrap`, `home-game-bootstrap`, training memory and sync. The browser does not hold later deferred scripts for an async module, so `logic.js` (deferred, after them in document order) ran and scheduled `init` while those modules were still pending.

EXTRACT-HOME-001 missed it because its search was for line-start `await`; this one sits inside an `if`.

Evidence (Firefox, headless, probe from the EXTRACT report, plus `Object.defineProperty` timestamps): in every failing reload the order was `setTimeout(init, 10)` and `DOMContentLoaded` first, then `RiverlineAuthentication`, `PersistentIdentity`, `TrainingMemory`, `SavedStudyObjects`, **`RiverlineHome`**, `HomeGame`, `SavedStudySync` about 40 ms later, with `readyState` already `complete`. Later modules in document order (welcome, header, shell navigation, and so on) had run before them. On the base this reproduced in 1 of 8 and 3 of 25 reloads (guest, this laptop).

## 3. Fix

- New classic deferred script `app/src/application/startup-gate.js`, placed just before `logic.js`. `window.RiverlineStartup.whenReady()` dynamic-imports every `script[type=module][src]` in the page (same module-map instances, so it settles when their async evaluation does) and resolves after all settle. A module that fails to load does not block start. A 15 s liveness guard, with a console warning, covers a module that never settles; it is a guard, not a retry.
- `logic.js` `scheduleInit()` starts `init` through the gate. With no gate (harness or other hosts) it starts exactly as before.
- `tests/helpers/browser-app.mjs`: `startup-gate.js` added to the default skipped scripts, because `bootApp` already awaits each module in order.
- No list of modules to maintain, and any future top-level await is covered.

## 4. Files

Changed by this ticket: `app/index.html` (+1), `app/src/core/logic.js` (+13/−2, no growth beyond the gate), `tests/helpers/browser-app.mjs` (+2), `docs/ISSUE_REGISTER.md` (row HOME-BRIDGE-RACE), new `app/src/application/startup-gate.js`, new `tests/home_bridge_race001_startup_gate.test.mjs`, this report. Pre-existing dirty files: none.

## 5. Verification

- `node --check` on `startup-gate.js` and `logic.js`: OK. `git diff --check`: clean; LF on all touched files.
- `node --test tests/home_bridge_race001_startup_gate.test.mjs`: 5/5 pass. It runs the real gate over temp modules with a real top-level await (bridge asserted installed only after `whenReady()`, importers of the late module also run), a module that fails to load, a module that never settles (liveness warning, one gate per page), plus contract checks (gate precedes `logic.js` in `index.html`; `logic.js` starts only through the gate).
- Full suite `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs`: 2884 tests, 2880 pass, 1 fail, 1 skipped, 2 todo. The failure is `saved_composition002` "Training history keyboard browsing coalesces the Saved lookup…" (TEST-SAVED-COMP-002, pre-existing; the EXTRACT report records it failing on the untouched base `d164f70`). Not touched.
- Browser, Firefox headless via `tests/tooling/browser-runtime.mjs`, Home landing, Midnight, EN, guest: base 3/25 reloads showed the error; with the fix **0/40**, with the full suite running in parallel as CPU load. `window.RiverlineHome` existed at `load` in all 40, Home content shown in all 40, no error state. Screenshots not taken (no visual change); viewport/theme/language not varied.
- Guest only on this laptop: no `app/auth-config.js` was read or created here. The account view is not exercised in a browser; it is covered by the existing `bootApp` tests through the fake auth provider, which pass in the full run. The gate does not touch the auth path.
- Solver suite: not run (no domain, solver or strategy change).

## 6. Limitations, debt, disagreements

- The ticket's base (`codex/stabilization` after EXTRACT-HOME-001 is merged, with `app/src/application/home-workspace.mjs`) does not exist in this checkout: `HEAD` is `d164f70` and EXTRACT-HOME-001 lives on the unmerged branch `claude/extract-home-module-35e83a` (`743112b`). I fixed on `d164f70`. The change touches none of the extracted code except the `logic.js` tail, so it should apply cleanly there; if the merge conflicts, it is in the last lines of `logic.js`.
- Other init-time code that reads `window.Riverline*` bridges (not just Home) now also starts after them; I did not audit which of them silently tolerated the race.
- The remaining design weakness is that auth bootstraps await at top level at all. Removing that would be an auth refactor and is out of scope.

## 7. Git

Nothing staged or committed. Branch `claude/home-bridge-race-root-cause-23ec38`.
