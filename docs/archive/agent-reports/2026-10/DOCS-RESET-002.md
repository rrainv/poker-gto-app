# DOCS-RESET-002: agent core reset, accurate STATE, single decision log

Work session, Claude Code (Sonnet 5.5). Tier T0, docs only. Base `codex/stabilization` at `7904a23`; `git fetch` showed nothing new upstream, so there was nothing to pull. TRAINING-QUICK-001 is **not committed** in this checkout (its files are in the working tree), so STATE records it as uncommitted with no hash.

## 1. Outcome

- **Agent core** (AGENTS + BRIEF + STATE): 48,705 B → 23,013 B (AGENTS 9,063 → 10,245; BRIEF 7,004 → 7,258; STATE 32,638 → 5,510). Total is under the 25 KB target; AGENTS.md itself is about 4 KB over its ~6 KB target because the area map and the module rule were added.
- [AGENTS.md](../../../../AGENTS.md): roles, git/file safety, tiers and report format kept; added the module rule, the standard controller interface (`mount(container, deps)` → `{ dispose, refreshLanguage, handleKey, setVisible }`, injected deps, `bootApp()` characterization tests first) and an area map (module globs and specs per area, checked against `app/src/`).
- [STATE.md](../../../STATE.md): live queue with statuses from `git log`; next queue HOUSEKEEPING-001, EXTRACT-QUICKDRILL-001, HOME-001 (Home extraction as step 0), CSS-DEADTHEME-001, TRAINING-QUICK-002, then the rest of M1. The old STATE is archived verbatim (links repaired) as `docs/archive/2026-10/STATE_SNAPSHOT_2026-10-31.md`; mockup links moved to [design/CANVASES.md](../../../design/CANVASES.md).
- **One decision log:** [design/decisions/OWNER_DECISIONS.md](../../../design/decisions/OWNER_DECISIONS.md) holds the new dated decisions, STATE's decisions/open/resolved tables and NORTH_STAR §11b, §11c, §12, all verbatim. NORTH_STAR keeps headings with one pointer line each.
- NORTH_STAR §7 moved verbatim to [project/AREA_DIRECTION.md](../../../project/AREA_DIRECTION.md); the 7.x headings stay in NORTH_STAR as one-line pointers so anchors keep working.
- [project/README.md](../../../project/README.md): spec index with current / dormant.
- Contradictions: BRIEF `logic.js` size (now 16,213 lines, must shrink); register "uncommitted" rows (11 replacements, now with hashes `4e3e11a`, `ddd4840`, `d1c826e`; REPO-AUDIT-010 states the real size and the extraction order); QA-SHELL-008 now follows MOB-01 … MOB-06; CONTRIBUTING.md is 5 lines; README python command and AGENTS use the same `py -3.12` line; docs/README, decisions README, THIRD_PARTY and DESIGN_SYSTEM links to the moved STATE sections repaired.

## 2. Design choices to review

- **Reasons for the new decisions** (integration branch, binaries, CI triggers, module rule, extraction order, "heuristic", no framework) are my drafting from the ticket text and the TRAINING-QUICK-001 report; the owner should confirm the wording. The "revisit only on the triggers named in the repo review" clause is paraphrased because the review text was not in the ticket; please check it.
- NORTH_STAR's top part (§1–§6) is still about 34.9 KB, above the ~25 KB target, and the whole file is 61.6 KB (was 120.7 KB). Reaching 25 KB would mean moving §3 or §4, which "nothing deleted" allows but the ticket did not name. Not done.
- TRAINING-QUICK-002's scope in STATE is a placeholder ("follow-ups from the owner review, heuristic wording out of user text"); the Manager should write the real ticket.
- STATE keeps empty-ish "Open decisions" and "Waiting on the owner" sections because `tests/docs_integrity001_governance.test.mjs` requires the `## Ordered queue` and `## Open decisions` headings.
- Dormant marking for all Personal Strategy specs follows the ticket, but the code for them ships; the index says "read when a ticket names it" and keeps ADR_PERSONAL_STRATEGY_PERSISTENCE as "read before any storage change".

## 3. Files

Changed by this ticket: `AGENTS.md`, `CONTRIBUTING.md`, `docs/BRIEF.md`, `docs/STATE.md`, `docs/NORTH_STAR.md`, `docs/README.md`, `docs/THIRD_PARTY.md`, `docs/design/decisions/README.md`; new `docs/design/decisions/OWNER_DECISIONS.md`, `docs/design/CANVASES.md`, `docs/project/AREA_DIRECTION.md`, `docs/project/README.md`, `docs/archive/2026-10/STATE_SNAPSHOT_2026-10-31.md`, this report.
`docs/ISSUE_REGISTER.md` and `docs/project/DESIGN_SYSTEM.md` were already dirty from TRAINING-QUICK-001. Only this ticket's edits were staged for them (built from the `HEAD` blob with the same replacements); their working-tree files still hold the TRAINING-QUICK-001 changes, unstaged.
Pre-existing dirty files left alone: everything under `app/`, `tests/`, `tools/`, `.codex/config.toml`, `.claude/`, `logic_outline.txt`, `riverline_snapshot.txt`, the TRAINING-QUICK-001 report and files.

## 4. Verification

- `node --test tests/docs_*.test.mjs`: 10/10 pass (first run failed 1: STATE lacked the `## Open decisions` heading the governance test requires; fixed).
- Related tests that read docs (`account001`, `account002a`, `truth_surfaces002`, docs tests): 31 of 32 files pass; the one "failure" is `tests/repo_dump_filter.test.py`, a Python file that Node cannot run and which is outside the suite globs.
- Link and anchor check (own script, relative links and `#anchors` in 16 touched or linking docs): 0 bad after fixes. The archive snapshot's links were repaired and checked; other archive files were not checked.
- `git diff --check`: clean. LF confirmed with `git ls-files --eol`.
- Not run: full suite, browser (T0).

## 5. Limitations and debt

- The T2 "full suite once at the end" wording stays in AGENTS; the CI ticket (HOUSEKEEPING-001) should replace it. Noted, not fixed.
- Other docs (BRIEF §6, NORTH_STAR §9) still describe the M1 queue in prose; they were not rewritten.
- Spec content untouched (as ticketed).

## 6. Disagreements

- The ticket asks for AGENTS ≤ ~6 KB and also an area map plus module rule; both fit only at about 10 KB. I kept the map.

## 7. Git status

Committed with an exact file list as authorized (see the commit); `.codex/config.toml` and `.claude/` not staged. See the final message for the push result.
