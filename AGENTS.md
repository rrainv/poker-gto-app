# Riverline agent rules

Riverline is a local-first, browser-first No-Limit Hold'em learning workstation with a thin Electron host. These rules keep work consistent; they are a guide, not an ultimatum. **The owner's judgement is final.** If a rule or document seems wrong or blocks a better outcome, raise it in your report instead of silently working around it.

## Roles

- **Manager:** the owner's persistent Claude Project chat. Priorities, decisions, tickets, report review, continuity. No repository edits.
- **Work:** one Claude Code session per ticket (or an authorized batch session). Inspect, implement, verify at the ticket's tier, report, stop. Corrections and interruptions of the same ticket continue in the **same session** (resume from the files; never start a duplicate session for one ticket). A new ticket gets a new session.
- **Review:** an independent read-only session when risk justifies it (maths, money, identity, persistence, migrations, source authority). Not by default.

## Multi-agent work

- **Agents:** Claude Code (default implementer), Gemini Argon in Antigravity (batch implementer and independent reviewer), the Manager (Claude chat) plans and reviews.
- **One writer per folder:** each agent works in its own git worktree and branch; never edit a folder another agent uses.
- **Branches:** agent work lands on its own branch; the owner merges after Manager review.
- **Risk tiers:** money, persistence schemas, identity/lifecycle, truth-model or claim changes need an independent review by a different agent before merge.
- **Reports:** go to `docs/archive/agent-reports/<yyyy-mm>/<TICKET-ID>.md`.

## What to read

- **Minimum read set:** this file plus the files the ticket names. Tickets carry their own context. For project context, read [docs/BRIEF.md](docs/BRIEF.md).
- Owner decisions with reasons: `docs/design/decisions/`; licences of outside components: [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md) (record one before using it).
- Direction: [docs/NORTH_STAR.md](docs/NORTH_STAR.md). Live status and queue: [docs/STATE.md](docs/STATE.md). Issues: [docs/ISSUE_REGISTER.md](docs/ISSUE_REGISTER.md). Visual contract: [docs/project/DESIGN_SYSTEM.md](docs/project/DESIGN_SYSTEM.md). Terms: [docs/TERMINOLOGY.md](docs/TERMINOLOGY.md). Reference specs in `docs/project/` only when a ticket names them. `docs/archive/` is history, never required reading.
- **Skills** live in `.agents/skills/` (sources: `SOURCES.md`): `riverline-design` for any UI work; `/review-animations` before merging motion changes; `/break-ui` for new data-heavy components.
- **Never read giant files whole** (`app/src/core/logic.js`, `app/styles.css`, `docs/ISSUE_REGISTER.md`, large specs): search by ID, function or heading and read the relevant range.
- Don't re-read unchanged files during same-session corrections.

## Architecture in one screen

```text
Scenario input or canonical PokerState
  -> DecisionContext v1/v1.1 -> StrategyProvider v1 -> StrategyResult v1 -> StrategyClaimPolicy v1
  -> Analyze / Training / Review / Personal Strategy / Saved (consumers only)
```

- Poker rules, state, legality, accounting, evaluator, Equity, combos and ranges: `shared/poker-domain/` only. UI never does poker maths.
- Current strategy is a deterministic heuristic baseline (`app/src/strategy/`); no production reference pack, no solver/model runtime, no remote strategy API in the app. Never call heuristic output GTO, solved, Nash, CFR, exact EV or "correct".
- Scenario is lossy; Hand is canonical legal history. Unknown is never zero, fold or excluded.
- One canonical owner per concept; never create a duplicate poker, Equity, Training, strategy, Saved or state authority.
- Preserve versioned contracts and PERF-001 (one strategy resolution per decision update, coalesced input, no hidden Matrix/Equity work, dirty/visible invalidation). Schema or persistence migrations need explicit approval.
- Solver, model and data experiments stay under `solver/`, isolated from production.

Details: `docs/project/ARCHITECTURE_CONTRACT.md` and NORTH_STAR §5.

## Tickets

- One bounded outcome per ticket. No unrelated cleanup or features. Use issue IDs from the register; don't silently close, forget or absorb other IDs.
- Every ticket states an **execution class** (Mechanical Fast · Product Contract First · Correctness/Architecture · Heavy Future Design), a **verification tier** and a suggested model/effort.
- Redesigns need an approved mockup before building. Mockup numbers are illustrative; real numbers come from the engine.
- If a user-facing behaviour has several reasonable readings and the ticket doesn't settle it, ask one to four focused questions before building.
- A newly found issue joins the ticket only if the ticket caused it or it blocks acceptance; otherwise add a register row and continue.
- **Stop and report** if the work needs an unapproved schema migration, an architecture rewrite, a poker-rule interpretation, paid/cloud resources, or substantial scope growth; or if canonical implementations conflict.
- After about two corrections rejected for the same reason, stop patching and rethink the approach with the owner.

## Verification tiers

| Tier | For | Tests | Browser | Full suite | Beta smoke |
|---|---|---|---|---|---|
| T0 | docs, mechanical, read-only | touched only | none | no | no |
| T1 | fixes, small features | focused | 1 config (1920 EN Midnight); HE if layout/direction affected | only if shared modules changed | no |
| T2 | redesigns, big features | focused | mockup comparison: 1920+1366 EN, 1920 HE, one Daylight shot | once, at the end | no |
| T3 | milestones only | all | full matrix | yes | yes |

Commands: focused `node --test <files>`; syntax `node --check <changed .js/.mjs>`; hygiene `git diff --check`; full suite `node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs` (capped: CPU-heavy files such as `range_cal001b_elicitation` can crash under unbounded parallel load); solver suite (only when domain/solver/strategy changed), PowerShell: `$env:PYTHONPATH='solver;.'; python -B -m unittest discover -s tests/solver -p 'test_*.py'`. Poker-maths changes need invariant/property tests. Structural tests are not visual acceptance: without a real browser check, report visual status as `UNVERIFIED`, `PARTIAL` or `STRUCTURAL ONLY`. Human acceptance is the owner's; tests and commit titles cannot create it.

Visible features also own their tutorial, EN/RU/HE + RTL, accessibility, reduced motion and responsive behaviour (minimum desktop 1366×768).

## Git and file safety

- Never stage, commit, push, reset, clean, stash, rebase or switch branches unless the ticket explicitly authorizes it. Never broad-stage (`git add .`, `-A`, `--all`). The owner commits accepted work with exact file lists.
- Protected unless the ticket owns them: `.codex/config.toml`, `.gitignore`, `repo_dump.py`, `repo_dump.txt`, local auth config (`app/auth-config.js` and similar), helper/backup artifacts. Never print secrets or copy local auth config.
- Don't revert or reformat changes you didn't make; report pre-existing dirty files separately.
- **LF only** (`.gitattributes`: `* text=auto eol=lf`; `core.autocrlf=false`). Never convert line endings. Check `git diff --stat`: a small edit showing every line changed is line-ending churn; fix it before reporting (`git ls-files --eol <file>`).
- Windows / Git Bash: write files with the file-write/edit tools, not shell heredocs or PowerShell here-strings (they pick the shell's line endings and quoting). Use forward slashes and `/dev/null` in Bash.
- Node engines ≥22, `.nvmrc` 24 (CI Node 24). Dev server: `node tools/dev-web-server.mjs` in its own terminal (app at `http://127.0.0.1:3000`; dev-only component sheet at `/__dev/component-sheet.html`).
- Cloud sessions and paid compute only with explicit authorization, a pushed base, a separate branch and an approved max spend, runtime, artifacts and stop criteria.

## Docs you may touch

- Update the register rows your ticket owns (status in place, evidence, new rows for found issues).
- Update a reference spec only when your ticket changes the truth it describes.
- `docs/STATE.md` and `docs/NORTH_STAR.md` are the Manager's; edit them only when the ticket says so.
- Never create a second roadmap, backlog, status file or architecture authority.

## Report (every ticket, then STOP)

1. **Outcome:** what is now true, in plain words.
2. **Root causes / key design choices**, when relevant.
3. **Files:** changed by this ticket vs pre-existing dirty files (listed separately).
4. **Verification:** exact commands and results, including failures, reruns and anything skipped and why; browser checks with viewport/theme/language, or the honest `UNVERIFIED` status.
5. **Limitations and debt:** what is not done, with register IDs (new rows added).
6. **Disagreements or doc conflicts** you found (raise, don't silently resolve).
7. **Git status:** `git status --short` summary and confirmation that nothing was staged or committed.

Then stop. Do not start the next ticket.
