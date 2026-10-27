# REVIEW-BATCH2: Argon `origin/argon/m1-batch-2`

B5 is ready to merge. B4 and B6 need fixes first, and B6 has two persistence bugs that I reproduced in a real browser.

| Ticket | Verdict |
|---|---|
| B4 TRUTH-SURFACES-002 | Merge after the listed fixes |
| B5 DOMAIN-MATH-001 | Merge (small optional follow-ups) |
| B6 DATA-SAFETY-001 | Merge after the listed fixes (the fixes are required) |

How I checked: a temporary detached worktree at `a31404d`, focused tests (66 pass, 0 fail, 1 todo that was already there: `TEST-HYGIENE-001-F13`), `git diff --check` clean, all touched files LF, node probes, and a real-browser run of the branch on `127.0.0.1:3417` (EN, Midnight). I did not rerun the full suite.

**Merge note:** the branch is based on `0105083`, not `9d963dc`. Merging it with `9d963dc` conflicts only in `docs/STATE.md`.

## B4: TRUTH-SURFACES-002

**The known deviation is partly a reporting error.**
- **Analyze verdict is correct.** `analyze-verdict.mjs` uses the owner's rule: `VERDICT_CLOSE_MARGIN = 0.2` and a 5% meaningful share, compared in whole basis points. The `>= 70% / >= 15 pp` text appears only in `BATCH-SUMMARY.md`.
- **Two things in the reports are false.** The B4 report says it "hardened `classifyVerdictDominance`" and "verified every verdict display", but `classifyVerdictDominance` does not exist anywhere in the repo.
- **The real violation is in Explain.** `app/src/application/analysis-explanation.mjs:26-30` and `:205-212` classify the mix with their own thresholds (95% pure, 70% dominant, 10% meaningful) and four states: pure, dominant, mixed, fragmented.
  - Reproduced with Raise 62 / Call 30 / Fold 8: the verdict says **dominant** and the mix shows 60/30/10. Explain says **"mixed"** ("No action reaches the dominant threshold") and prints 62% and 30%.
  - In `detailed` depth (`:932-941`) Explain also lists actions under 5%, at 1% precision.

**Every place to fix for the verdict rule:**
1. `analysis-explanation.mjs:26-30` and `:205-212`: replace `strategyShape` with a call to `describeAnalyzeVerdict` (two states only). Keep "pure" only as wording inside "dominant", or drop it.
2. `analysis-explanation.mjs:944-971`: rewrite the dominant/mixed/fragmented copy to match the two states. The "close" wording should read like "A or B · close", with no "No action reaches the dominant threshold".
3. `analysis-explanation.mjs:932-941`, and the `percent(...)` values in the strategy section: for estimated sources, show the 5%-rounded values from `presentStrategyMixActions` and hide actions under 5%.
4. `BATCH-SUMMARY.md` (B4 line) and `TRUTH-SURFACES-002.md` §3: correct the rule text and remove the claim about a function that doesn't exist.
5. Not part of the verdict rule: `strategy-truth.mjs:25-26` and `training-answer-evaluation.mjs:9-10` use 0.05/0.15 gaps to compare Hero's choice with the mix. That is a separate concept, so leave it alone.

**Provenance, rounding and wording**
- One indicator per surface: met. The header badge is off on all four surfaces, and Training, Hand Review and Personal Strategy each have a single eyebrow, with the duplicate nodes hidden.
- Rounding: estimated mixes are rounded to 5% and actions under 5% are hidden in Analyze, Training and Hand Review.
- Wording: no "mistake / correct / GTO / solved" was added.
- **Debt (new register row):** the same 5% rounding code now exists three times: `analyze-verdict.mjs` `presentStrategyMixActions`, `logic.js` `strategyResultPresentationActions`, and `logic.js` `renderHandReviewFrequencyComparison`. They also detect "exact" sources differently (descriptor capability vs claim policy). There should be one owner.
- Visual status: I did not browser-check the B4 surfaces, so that is UNVERIFIED.

## B5: DOMAIN-MATH-001

**Merge.**
- **No values changed.** SPR and MDF match the old formulas. For example, stack 97.5 / pot after call 9.5 / call 2.5 gives SPR 13.93 and MDF 73.68% both before and after. Multiway and no-call cases correctly return null.
- **The old label parsing was never wrong.** `formatExactPokerAmountBb` always produces locale-independent text like `"2.5bb"`. Over 2 million sampled milliBb values, old parse and new numeric field matched exactly. So the RU/HE fix in the report is preventive only, and the RU decimal comma and HE labels are unaffected.

Follow-ups (optional, register row):
- `analysis-explanation.mjs:854-863` still computes pot-before-action and SPR inline. It should call `deriveStackToPotRatio`, which is the last piece of REPO-AUDIT-011 for SPR.
- `deriveMinimumDefenseFrequency` returns null when given mixed units (bb pot with a milliBb call). No current caller does this, but the inputs should be normalized once.
- The selectors are exported under two names each (`derive*` plus short aliases). Keeping one name avoids two names for one concept.
- `logic.js` silently shows `-` if `window.RiverlinePokerDomain` is missing. Load order is fine today because the module runs before the deferred `logic.js`.

## B6: DATA-SAFETY-001

**Store coverage is complete.** The app's IndexedDB databases are:
- `riverline-account-identity`
- `riverline-saved-study-objects`
- `riverline-personal-strategy`
- `riverline-training-memory`
- `riverline-home-game`
- `riverline-sync`

All six are in `KNOWN_RIVERLINE_DATABASES`, and `indexedDB.databases()` adds any others it finds. `localStorage.clear()` and `sessionStorage.clear()` cover every key, including `appLang`, `language`, `riverline_*`, the persist marker and `riverline.auth.supabase.*`. There is no Cache API, service worker, cookie or Electron-side store. The protected `app/auth-config.js` is a file the app imports, and the batch doesn't touch it.

**Required fixes**
1. **The app is not in a clean first-run state after deletion (reproduced).** After clicking delete, the databases and storage were empty and the status said success. But the app kept its in-memory Guest identity, and every write then failed: `setDisplayName` threw `AccountIdentityStorageError`, and `listKnownIdentities` threw "The database connection is closing". Nothing listens for `riverline:alldatadeleted`. A manual reload did give a clean first run (Welcome shown).
   - **Fix:** in `data-safety.mjs` `confirmDeleteAllData`, after the wipe, show the status briefly and then call `location.reload()`.
2. **The signed-in session survives in memory.** `localStorage.clear()` removes the stored Supabase session, but the live client is still signed in and its token auto-refresh can write the session back before any reload. That would break "clean state" and blur owner isolation.
   - **Fix:** before wiping, call `RiverlineAuthentication.signOut()` (best effort, local), then wipe, then reload. I could not test signed-in mode because there is no auth config in the review worktree.
3. **The iOS note shows on every desktop with temporary storage (reproduced).** On Windows Chrome the note appears with `iosBrowserTab: false`. The cause is `data-safety.mjs:198`, `iosNoteEl.hidden = persisted && !iosTab`, and `tests/data_safety001.test.mjs:63` asserts this wrong behaviour.
   - **Fix:** use `iosNoteEl.hidden = !iosTab;` and change the test to expect the note hidden on non-iOS whether storage is persisted or not.
4. **Deletion can run without the typed confirmation.** The page exposes `window.RiverlineDataSafety.deleteAllLocalData()`, which deletes without checking the confirmation word.
   - **Fix:** remove `deleteAllLocalData` from the bridge at `data-safety.mjs:410`. `confirmDeleteAllData` already checks the word.
5. **A "blocked" deletion is reported as success** (`data-safety.mjs:105`). If another Riverline tab holds a database open, the status can claim success before the deletion has actually happened.
   - **Fix:** wait for `success`. If it stays blocked, show "Close other Riverline tabs to finish deleting".

**Met**
- `persist()` is called once (marker plus in-flight guard). It is asked again only after Delete-all, which is acceptable as a fresh first run.
- The status shown follows `persisted()`.
- The confirm button stays disabled until the word matches (DELETE / УДАЛИТЬ / מחק).
- All new strings exist in EN, RU and HE, with the localized word in the prompt.

## AGENTS.md compliance
- **Protected files and staging:** no protected files touched, no broad-staging evidence, LF clean.
- **STATE.md:** all three tickets edited `docs/STATE.md`, which belongs to the Manager. That is also the merge conflict. Drop the batch's STATE rows at merge, or confirm the tickets authorized them.
- **Register rows marked done too early:** `DATA-SAFETY-M1` and `REVIEW-MATH-03` in `docs/ISSUE_REGISTER.md` are marked done. They should go back to Partial until the B4 and B6 fixes above land.

## Git status
- Nothing staged or committed. `git status --short` shows only the files that were already dirty: `M .codex/config.toml`, `?? .claude/`, `?? docs/_incoming/`.
- Your main checkout is now on `skills/m1` (`cb4f087`), not `codex/stabilization`. I didn't switch it, so this happened outside this session.
- The temporary worktree is removed and the port 3417 server is stopped. One shell command I tried, a broad `taskkill`, was blocked; I used a targeted stop instead.

STOP.
