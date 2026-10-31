# ASSETS-SHIP-001: master portrait PNGs out of the shipped tree

Ticket: ASSETS-SHIP-001 · Mechanical Fast · T1 · branch `wip/ASSETS-SHIP-001` (base `e884ce6`)

## 1. Outcome

The ten 1254x1254 master PNGs (20,501,764 bytes, about 19.6 MiB) are no longer under `app/src`. The runtime reads only the WebP derivatives (`<id>-seat.webp` 128x128, `<id>-preview.webp` 320x320 via `app/src/ui/table-environment.mjs:29-31`), which stay in place. `app/package.json` now excludes any `*.png` under `src` from the packaged app. `app/src` goes from 26,254,515 to **5,752,751 bytes** (298 tracked files remain): **20,501,764 bytes freed from the working tree and from the installer input.**

The PNGs are still in git history (they were committed earlier), so the repository's `.git` size does not shrink; only checkouts and the shipped package do.

## 2. Where the masters went

20 MB is too large to keep in git, so they are archived outside the repo (rule in the ticket):

`C:\Users\sjzns\Projects\Riverline_archive\opponent-masters-2026-11\` (copied with `cp`, hashes verified identical to the originals before `git rm`).

| File | SHA-256 |
|---|---|
| cleo.png | `8a88c7f0d1a60adca5373e45e8a326bb49dccab0638c9ab5a7247371a6e2c07a` |
| fern.png | `1e4b49a2999b91a48c594e8ce0a7d47436a7aa9fc6320f508cde3582603a72f4` |
| luma.png | `17d32e5dcffc1eccc4382b1157bcf66e65bfb347a952189cfacb25adfc8bf65f` |
| mika.png | `b48586d8f33651e30a2b4793a812ff38d3c11bdf7b422f3bc49ab64e7c9ca16b` |
| nova.png | `7fac6b7d1e70d12fafd1a76d4f3d67fe8edbea0e8b9d3a76c19708f0e3809ce6` |
| otto.png | `d1a6fb48702b3c75c4b1762beb0cabb81abc3e71806efaa18667fca168c9497a` |
| pip.png | `de1e4c9eda3125adc24879ff1b0bdd4b91808aff99b1b9365d034127fee781da` |
| remy.png | `60ee5779c2f23bcea99fd79f2de9d194e97f797ac80f162a010a458241f10319` |
| sol.png | `eb477c825a7b307890b9146fa1a7af3e47314e4f5ecc8a94c0019882a810b64f` |
| zig.png | `9e629071086756d14a5f31bda34e6edd991b6f98c2a41f9f50ad24aebdab5886` |

If you want them back in the repo later, `docs/design/assets-masters/` would be the place, but at 2 MB each I did not put them there. Note that `Riverline_archive` is a local folder on this machine, not a backup: copy it somewhere durable.

## 3. Changes

- `app/package.json`: `build.files` gains `"!src/**/*.png"` right after `"src/**/*"`. No other PNG exists under `app/` (checked with `find`), so nothing needed is excluded. I did not run `electron-builder`.
- `tests/beta_repair_sweep_b.test.mjs` (test "portrait delivery uses bounded WebP derivatives..."): the old assertion required each `<id>.png` to exist with size > 100,000. Reason for change: that asserted the retained masters. It now asserts they are **absent** from `app/src/ui/assets/opponents/` and that `package.json` carries the `!src/**/*.png` filter. The WebP header and size bounds are unchanged. The test title was reworded to match.
- `app/src/ui/assets/opponents/PROMPTS.md`: one sentence changed (it said BETA-REPAIR-SWEEP-B "retains these source bytes"); it now says the masters were moved by this ticket and points to this report.
- `docs/THIRD_PARTY.md`: the portraits row notes the PNGs moved out of the tree (location column). Licence status is unchanged (still UNKNOWN, AI-generated, terms not recorded).

## 4. Verification

- Focused tests: `node --test` on the six test files that mention `assets/opponents`, `THIRD_PARTY` or `app/package.json` (`beta_repair_sweep_b`, `cleanup001e1_browser_strategy_retirement`, `cleanup001e2_electron_native_inference_retirement`, `dev_web_server`, `ds_foundation001`, `ds_tokens001`): 32 pass, 0 fail.
- `git diff --check`: clean; `.gitattributes` shows `eol=lf` for the edited text files.
- Full suite: **not run** (the ticket is T1 and changes no shared module); the full suite for the CSS ticket ran earlier on a different branch.
- **Firefox (headless puppeteer-core, dev server on a free port, 1920x1080, EN, Guest, Midnight):**
  - All 20 runtime URLs (`<id>-seat.webp` and `<id>-preview.webp` for the ten characters) load as images, sizes 128x128 and 320x320 as expected (20 of 20).
  - Training > Full Hand shows the lineup preview ("Your next table"): 8 `<img>` portraits (Mika, Pip, Nova, Remy, Cleo, Otto, Luma seats plus the Mika preview), all `complete` with non-zero width; screenshot viewed, the portraits are crisp and correct. Fern, Sol and Zig are not in that particular 8-max lineup, so their rendering in the UI is covered only by the URL load check.
  - No 404 for any `opponents/` file. The only 404 is `auth-config.js` (expected: the worktree has no auth config and I did not create one; the app runs as Guest).
  - Not checked: HE, Daylight, phone width, the Welcome screen's three seat portraits (same files, same loader).

## 5. Limits, disagreements, git

- The archive folder is outside the repository and unversioned (see section 2).
- The ticket suggested `docs/design/assets-masters/` "if small enough"; at 20 MB it is not.
- Git: this branch contains the ten file deletions plus the four edits above and this report, one commit, pushed to `wip/ASSETS-SHIP-001` only. `.codex/config.toml` and `.claude/` untouched.
