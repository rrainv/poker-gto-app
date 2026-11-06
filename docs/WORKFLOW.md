# Workflow

How a ticket is run: preamble, test policy, rules, model routing, accept prompt. [AGENTS.md](../AGENTS.md) keeps the safety rules and points here for everything else. The owner's judgement is final.

## 1. Standard ticket preamble

Every Work session starts with this, whatever the ticket says:

1. `git fetch`, then base the worktree on `origin/codex/stabilization` (until the branch becomes `main`). **Report the base hash.** Then check the latest CI run on that branch (`gh run list --branch codex/stabilization --limit 3`). If it is red, fixing it is the first thing this ticket does (see section 4).
2. Read skills directly from `.agents/skills/<name>/SKILL.md` in worktrees (they are not auto-loaded there).
3. Never stage `.codex/config.toml` or `.claude/`. Never print secrets.
4. Commit only with an exact file list (no `git add .` / `-A`). Push only as a fast-forward, and only if the ticket authorizes it.
5. Report in the AGENTS.md format (outcome, causes, files, verification with exact commands and counts, limitations, disagreements, git status, and a final CI status line), then **STOP**. The CI line is `CI: run <id> green` (the run for the pushed commit) or `CI: not checked`; never write "green" for a run you did not read.

## 2. Test policy

| Situation | Run |
|---|---|
| T0 docs | The doc tests. |
| T1 | `node --check` on changed files + the ticket's TEST SET. No full suite. |
| T2 | TEST SET + the CSS guard group if `styles.css` changed. Full suite only if the shared harness, tokens or core paths changed. |
| Rebase | TEST SET only. |
| Merge into stabilization | CI is the gate. |
| Flake fix | 20 runs of the test alone + TEST SET. |
| `main` or milestone | One full suite + browser smoke. |

Never run two suites at once. Use `--test-concurrency=2`.

Targeted runs: `node tools/run-tests.mjs --changed` (or `--area a,b`, `--group smoke|css`, `--files ...`) runs only the mapped tests, with a lock and concurrency 2; see [tests/tooling/README.md](../tests/tooling/README.md).

## 3. Rules

- Report the exact test command and the counts instead of re-running to "double check".
- Flakes are fixed at the root; never retried, skipped or loosened.
- A red CI is fixed by a small ticket that reads the failing log first.
- The full suite is a gate, not a habit; CI is the merge gate (decision log, 2026-11-04). CI runs the full suite because the repo is public and minutes are free; local runs stay targeted (decision log, 2026-11-06).
- A red CI blocks updating `main` and is the first thing the next ticket fixes.

## 4. CI

Workflows in `.github/workflows/`:

- `node-ci.yml`: full Node suite (`node tools/run-tests.mjs --all --concurrency 4`) plus the Python solver tests. Runs on push to `codex/stabilization` and `main`, on pull requests, on manual dispatch, and nightly. It skips pushes that only touch `docs/**` or `*.md`. Concurrency group per ref cancels superseded runs; timeout 25 minutes; the per-file duration JSON is uploaded as the `test-timings` artifact. No secrets and no `app/auth-config.js` needed. The nightly run checks `codex/stabilization`.
- `docs-tests.yml`: the two docs tests; always runs, including on docs-only pushes.

Reading a run:

```bash
gh run list --branch codex/stabilization --limit 3
gh run view <id>
gh run view <id> --log-failed
```

`--log-failed` prints only the failing steps; the failing test file is named under `--- FAILED:` in the runner summary. Timings: `gh run download <id> -n test-timings`.

## 5. Model routing

- **Sonnet:** mechanical work, docs, merges, accept prompts.
- **Opus:** extractions, redesigns, and review of identity, money or persistence.
- Effort follows the ticket's suggestion; raise it, never silently lower it, for correctness work.

## 6. Accept-prompt template

Paste into a Sonnet session after the owner accepts a report:

```text
ROLE: WORK · Ticket: ACCEPT-<TICKET-ID> · Tier T0 · Sonnet, low
FIRST: git fetch; base on origin/codex/stabilization; report the base hash.
Authorized: commit exact files, push as a fast-forward. Never stage .codex/config.toml or .claude/.
1. Merge branch <branch> into the integration line (fast-forward if possible; no force).
2. Set the register rows this ticket owns to the status the owner accepted: <ids and status>.
3. Move the report to docs/archive/agent-reports/<yyyy-mm>/<TICKET-ID>.md if not there.
Run the doc tests. Commit; push. REPORT (base hash, commit hash, commands and counts). STOP.
```
