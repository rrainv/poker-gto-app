# Agent Report — TOOLING-BROWSER-RUNTIME-001

**Date**: 2026-11-06  
**Ticket**: TOOLING-BROWSER-RUNTIME-001 (T1)  
**Branch**: `argon/m1-batch-4` (base: `43f3e54be4b46d814ed80522ca3dd198731797ee` on `origin/codex/stabilization`)

## Summary

1. **Fixed `createBrowserRuntime` under `puppeteer-core` 25.10 (`webDriverBiDi`)**:
   - In `tests/tooling/browser-runtime.mjs`, `BidiHTTPRequest.prototype.resourceType()` throws `UnsupportedOperation` on Firefox WebDriver BiDi when `browser().cdpSupported` is false.
   - Added `safeRequestResourceType(request, response)` to catch `UnsupportedOperation` and infer the resource type from `request.isNavigationRequest()`, `sec-fetch-dest` / `content-type` headers, and URL file extensions (`.html`, `.js`, `.mjs`, `.css`, `.svg`, `.png`, `.woff2`, etc.).
   - Ignored the expected optional `/auth-config.js` local probe in `record()` so a clean checkout without local auth config does not record a false-positive 404/module diagnostic.
2. **Added `tests/tooling/capture-screens.mjs`**:
   - Reusable CLI and programmatic module driven by a JSON list of named states (`viewport`, `theme`, `language`, `guest`, `dismissFirstRunOverlays`, `destination`, `steps`).
   - Runs on an isolated free dev-server port (`port: 0`) via `createBrowserRuntime` and guarantees clean browser + server teardown in `finally`.
   - Writes one `.png` per state plus `INDEX.md` in the output directory.
3. **Documented `capture-screens.mjs` in `tests/tooling/README.md`**.
4. **Verified live Firefox capture at 1920x1080 EN Midnight**:
   - Captured `Home 1920 EN Midnight` (`home-1920-en-midnight.png`) and `Training Quick Drill 1920 EN Midnight` (`training-quick-drill-1920-en-midnight.png`) plus `INDEX.md` in a temporary directory (`PASS capture:home-1920-en-midnight`, `PASS capture:training-quick-drill-1920-en-midnight`) and inspected the rendered PNGs and `INDEX.md`.
   - No product code files were modified.

## Files Changed

- `tests/tooling/browser-runtime.mjs`
- `tests/tooling/capture-screens.mjs`
- `tests/tooling/README.md`
- `tests/browser_beta_runtime.test.mjs`
- `docs/archive/agent-reports/2026-11/TOOLING-BROWSER-RUNTIME-001.md`

## Verification

- `node --check` on `tests/tooling/browser-runtime.mjs`, `tests/tooling/capture-screens.mjs`, `tests/browser_beta_runtime.test.mjs`: exit 0
- `node tools/run-tests.mjs --files tests/browser_beta_runtime.test.mjs`: `SUMMARY files=1 total=5 pass=5 fail=0 skip=0 todo=0 seconds=0.2`
- `node tools/run-tests.mjs --changed`: `SUMMARY files=121 total=1140 pass=1139 fail=0 skip=0 todo=1 seconds=198.9`
- Live Firefox capture verification (`node tests/tooling/capture-screens.mjs --states <temp-spec.json>`): `PASS capture:home-1920-en-midnight (3.48s)`, `PASS capture:training-quick-drill-1920-en-midnight (4.72s)`
