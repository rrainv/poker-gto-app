# Riverline: work batch while the owner is away (2026-10-17)

Two agents, two folders, never the same files at once:
- **Claude Code** in `C:\Users\sjzns\Projects\poker-gto-app` (branch `cloud/TEST-HYGIENE-001`): finishes TEST-HYGIENE-001-FIX only.
- **Gemini Argon in Antigravity** in a separate worktree `C:\Users\sjzns\Projects\poker-gto-app-argon` (branch `argon/m1-batch-1`): works through batch B0–B10 below, one commit per ticket.

Money, persistence schemas and identity stay out of the Argon batch (they wait for Claude: HG-002, HG-003).

---

## 1. Claude Code: resume TEST-HYGIENE-001-FIX
Resume the **same** session (from the PC, or remotely from the Claude mobile app) when the usage limit resets, and send:
```text
Continue TEST-HYGIENE-001-FIX where you stopped.
FIRST, protect the work: commit the current working-tree changes on cloud/TEST-HYGIENE-001
by exact paths as "wip(test-hygiene-fix): harness fidelity + weak-test fixes (in progress)"
and push this branch (never .codex/config.toml).
Then do the remaining steps in order:
1. Triage the 28 failures from run2.log (some may be fixed by the double-firing and
   product_theme001 fixes): rerun only those files first. Sort each into "test needs
   fixing" (fix it) or "real product finding" (keep the test honest: mark it todo with a
   register row, never weaken it to pass).
2. Re-run the review's 5 mutations in memory and show all 5 are caught.
3. One final full suite on Windows (--test-concurrency=4); rerun failures once;
   flaky vs broken.
4. Register: REPO-AUDIT-009, TEST-HYGIENE-001 rows, new F11 (Equity layout to confirm with
   the owner), and one row per real product finding.
5. Commit by exact paths, push this branch.
Note on the review: you found three of its claims didn't match the code
(exploit_teacher_workspace001, uiqa001_shell_navigation_hygiene,
buildTrainingFeedbackPresentation). Record that in the report; don't chase them.
REPORT: triage table, mutation table, full-suite result, head hash. STOP.
```
If the limit hits again: the same message works again (it starts with a commit, so nothing is lost).

---

## 2. Gemini Argon in Antigravity: setup (PowerShell, once)
```powershell
cd C:\Users\sjzns\Projects\poker-gto-app
git fetch origin
git worktree add -b argon/m1-batch-1 ..\poker-gto-app-argon origin/codex/stabilization
```
Open **only** `C:\Users\sjzns\Projects\poker-gto-app-argon` in Antigravity (Argon, high). Paste the whole block in §3. It runs the batch in order and pushes after every ticket, so progress shows on GitHub (viewable from a phone: branch `argon/m1-batch-1`, folder `docs/archive/agent-reports/2026-10/`).

## 3. The Argon batch (paste everything inside the block)
```text
ROLE: WORK (batch). Agent: Gemini Argon in Antigravity.
Workspace: C:\Users\sjzns\Projects\poker-gto-app-argon ONLY (branch argon/m1-batch-1,
created from origin/codex/stabilization). Another agent works in
C:\Users\sjzns\Projects\poker-gto-app: never open, edit or run git there.

BATCH RULES (apply to every ticket)
- Read AGENTS.md once at the start and follow it (minimum read set; search giant files
  like app/src/core/logic.js and app/styles.css by symbol, never read them whole).
  docs/NORTH_STAR.md is the product truth; docs/STATE.md the status; docs/ISSUE_REGISTER.md
  the issue list (search by ID); docs/project/DESIGN_SYSTEM.md the design contract;
  docs/TERMINOLOGY.md the EN/RU/HE terms.
- Truth model (never break): heuristic disagreement is never a mistake; unknown is never
  fold/zero/excluded; one canonical owner per concept; no poker maths in UI code; numbers
  say where they come from (Exact / Verified / Estimated / Unavailable).
- Authorized: commits on argon/m1-batch-1 and pushing that branch only. Never push or merge
  other branches, never force-push, never touch .codex/, .gitignore, repo_dump.*, auth
  config, never change persistence schemas or money logic (Home Game ledger), never
  delete user data paths. LF line endings only. Stage by exact paths only.
- Tests: prefer behavioural tests; add NEW test files for new behaviour; do not rewrite
  existing test files unless the ticket requires it (a large test refactor is in progress
  on another branch). Per ticket: run the focused tests you touched or added, node --check
  on changed JS, git diff --check. At the END of the batch only: one full suite
  (node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs), rerun failures once.
  Known pre-existing failure: saved_composition002 keyboard browsing (B10 looks at it).
- Each ticket: one commit "<TICKET-ID>: <summary>", then push. Write a report to
  docs/archive/agent-reports/2026-10/<TICKET-ID>.md (outcome, files, tests with exact
  results, decisions you made, anything left undone, risks) and include it in the commit.
- Honesty: never claim a check you did not run; mark UNVERIFIED. If a ticket hits a stop
  condition or would need an owner decision, write the report, commit what is safe, and
  move to the next ticket. The owner is away and will not answer questions.
- Update docs/ISSUE_REGISTER.md rows you fix (status + ticket ID) and docs/STATE.md queue
  in the same commit.

B0 AGENT-POLICY-001 (docs only)
Add a section "Multi-agent work" to AGENTS.md (keep the file under 10 KB):
- Agents: Claude Code (default implementer), Gemini Argon in Antigravity (batch
  implementer and independent reviewer), the Manager (Claude chat) plans and reviews.
- One writer per folder: each agent works in its own git worktree and branch; never edit
  a folder another agent uses.
- Branches: agent work lands on its own branch; the owner merges after Manager review.
- Risk tiers: money, persistence schemas, identity/lifecycle, truth-model or claim
  changes need an independent review by a different agent before merge.
- Reports go to docs/archive/agent-reports/<yyyy-mm>/<TICKET-ID>.md.

B1 MOCKUP-ASSETS-001
Create docs/design/mockup-assets/ (nothing else changes in the app):
1. assets.html: one self-contained file (inline SVG / data URIs, no network) showing every
   card back the app ships, every nav/toolbar icon with its name, and the character
   portraits at small size if they fit (else list names and sizes).
2. MEASUREMENTS.md: the current table at 1920×1080 and 1366×768 (felt size, rail, seat
   box, card sizes per context), sidebar width, header height, panel radius/padding,
   control heights, font sizes/weights per role.
3. screens/: PNGs at 1920×1080 EN Midnight: Hand with a hand in progress, Training drill
   (decision and feedback), Full Hand, Analyze, Home. Use the repo's browser tooling
   (tests/tooling; install its dependencies inside this worktree if needed).

B2 I18N-RESIDUE-001 (register row I18N-TERMS-RESIDUE)
Finish terminology per docs/TERMINOLOGY.md outside the locale catalogs: RU «фолд» (30) and
HE «טווח» (41) in app/src/application/*-language.mjs and app/src/personal-strategy/*.mjs
(some are INPUT PARSING: keep accepting the old words as input aliases, change only what
is displayed); RU Hero = Latin "Hero"; HE Value = «ואליו»; HE "Open …" guide buttons in
masculine imperative («פתח …»); keep «טווח» where it means an ordinary number range.
List every change (file:line, old → new) in the report. Run the i18n tests and
tests/tooling/audit_i18n.cjs.

B3 CLEANUP-PREP-001 (no visual change intended)
1. Fix the 404 for the unbundled Supabase UMD script (app/index.html ~line 37) so a fresh
   checkout has a clean console, without enabling sync for anyone (load it only when
   available/needed, or guard it).
2. app/styles.css: replace hard-coded colours with existing tokens only where an exact
   token exists (list values without a token; do not invent tokens); remove `!important`
   rules that are provably redundant; count what remains.
3. The CSS bugs found by test hygiene: F04 (at ≤1100px the private-cards "rail first"
   order loses to a more specific rule) and F06 (Analyze dead-card header grid overridden
   to flex), if they are real in the browser; fix them.
4. Before/after screenshots of Home, Analyze, Training, Hand at 1920 EN Midnight and
   Daylight; report any pixel difference.

B4 TRUTH-SURFACES-002
1. QA-SHELL-004 / OWNER-19: Training shows provenance three times (header pill, side panel,
   feedback title). One indicator per surface, like Analyze now ("Heuristic baseline ·
   Estimated · …" in one place). Audit Hand review and the Personal Strategy comparison
   for the same and fix them the same way.
2. REVIEW-MATH-03: estimated mixes are shown rounded to 5% and actions under 5% are not
   shown as part of the mix, everywhere a mix is displayed (Analyze, Training feedback,
   Review); the underlying data is not changed. Exact values are not rounded.
3. Verdict dominance rule (NORTH_STAR §7.3): exactly two states, dominant (top action leads
   by ≥20 points or no other action reaches 5%) or close; confirm every verdict display
   follows it.
Behavioural tests for each.

B5 DOMAIN-MATH-001
1. Move pot-before-action, SPR and MDF calculations out of UI code (app/src/core/logic.js
   ~6242 and ~12823) into shared/poker-domain selectors with tests; the UI only formats.
2. Stop parsing bet amounts back out of display strings (logic.js ~14501): carry numeric
   amounts in the presentation model. Tests with RU decimal commas and HE labels
   ("2,5 бб", "ב״ב 2.5") proving no NaN or truncation.
No behaviour change for users other than fixing wrong values.

B6 DATA-SAFETY-001 (NORTH_STAR §7.11, M1)
1. Request persistent browser storage (navigator.storage.persist) once, at a sensible
   moment, with no nagging; show the result quietly in Settings › Account & Data.
2. "Delete all data" must be strongly guarded: a clear warning listing what is deleted,
   type-to-confirm (the word shown in the user's language), then delete. No change to what
   gets deleted. Translations EN/RU/HE. Tests.

B7 LOCALE-NUMBERS-001
1. EQ-LOCALE: numbers follow the UI language (English mode must not use Russian
   formatting); one shared formatter, no ad hoc toFixed in UI for user-facing numbers.
2. QA-DECISION-INPUT-009 (Equity "Random … ready." status tied to stage; Training Memory
   still says "Facing N bb").
3. QA-SWEEP-022 untranslated strings, and QA-LANGUAGE-SWITCH-003 (~43 elements with static
   data-i18n overwritten by code): make the code-owned text the single source; remove the
   stale static keys.

B8 A11Y-KEYS-001
1. QA-SWEEP-016: card picker is one tab stop with arrow-key navigation, Enter/Space to pick,
   Escape to close; ArrowDown never scrolls the page while the picker has focus.
2. A11Y-MATRIX-KEYS: the 13×13 range matrix is one tab stop with arrow-key navigation and
   a visible focus ring; screen-reader labels per cell (hand + state).
Tests for both.

B9 FULLHAND-QUALITY-001 (M1 Full Hand quality pass, small items)
1. WATCH-REST: a Skip control that jumps to the end of the hand (speed controls are M2).
2. QA-SWEEP-030: Full Hand header text follows the state (not "Make the decision" during
   summary and Review).
3. QA-SWEEP-010: lineup tiles: names not clipped, position/behaviour not run together.
Screenshots before/after at 1920 EN Midnight.

B10 SAVED-KEY-FLAKE-001
Investigate tests/saved_composition002 "Training history keyboard browsing coalesces…":
reproduce alone and under the full suite; decide test bug vs product bug; fix the real
cause (no added sleeps without a condition). Update FLAKY-SAVED-KEY / TEST-SAVED-COMP-002.

END OF BATCH
Run the full suite once; write docs/archive/agent-reports/2026-10/BATCH-SUMMARY.md (one
line per ticket: done / partial / skipped and why; the full-suite result); commit; push.
STOP.
```

## 4. Optional (only if the owner adds the word YES): SOLVER-PILOT-001
Not in the batch by default because it installs software. If wanted, append this to the batch before pasting:
```text
B11 SOLVER-PILOT-001 (owner says YES: installing the Rust toolchain via rustup for the
current user is authorized; nothing else)
Work ONLY in C:\Users\sjzns\Projects\riverline-solver-lab (a separate folder, NOT a git
repo of the app; AGPL code must never enter the app repo). Follow the plan in
C:\Users\sjzns\Projects\Riverline_audit_2026-10\F_SOLVERS.md §5: 12 spots (BTN vs BB and
CO vs BB single-raised pots; 40 and 100 bb; flops AsKh7c, QsQd7d, JhTd8s), the bet tree,
target exploitability 0.25% of the pot. Measure real time, peak RAM and output size per
solve. Export a small JSON per spot (root and facing-c-bet strategies, EVs, provenance:
solver name/version, tree, exploitability). Confirm whether lock_current_strategy works.
Write RESULTS.md there with measured numbers (replace every estimate). Do not compare
against the app's heuristic yet. Report in docs/archive/agent-reports/2026-10/
SOLVER-PILOT-001.md (numbers only, no solver code) and commit that report only.
```

## 5. Queued for Claude later (not in the batch)
HG-002 zero cash-out record (option B) and HG-003 repeatable edits (money); spot generator coherence (OWNER-17 full); Phase 2 design build (after the owner's Phase 1 decisions).
