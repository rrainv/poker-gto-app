# Workflow

How a ticket is run: preamble, test policy, rules, model routing, accept prompt. [AGENTS.md](../AGENTS.md) keeps the safety rules and points here for everything else. The owner's judgement is final.

## 1. Standard ticket preamble

Every Work session starts with this, whatever the ticket says:

1. `git fetch`, then base the worktree on `origin/codex/stabilization` (until the branch becomes `main`). **Report the base hash.**
2. Read skills directly from `.agents/skills/<name>/SKILL.md` in worktrees (they are not auto-loaded there).
3. Never stage `.codex/config.toml` or `.claude/`. Never print secrets.
4. Commit only with an exact file list (no `git add .` / `-A`). Push only as a fast-forward, and only if the ticket authorizes it.
5. Report in the AGENTS.md format (outcome, causes, files, verification with exact commands and counts, limitations, disagreements, git status), then **STOP**.

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

## 3. Rules

- Report the exact test command and the counts instead of re-running to "double check".
- Flakes are fixed at the root; never retried, skipped or loosened.
- A red CI is fixed by a small ticket that reads the failing log first.
- The full suite is a gate, not a habit; CI is the merge gate (decision log, 2026-11-04).

## 4. Model routing

- **Sonnet:** mechanical work, docs, merges, accept prompts.
- **Opus:** extractions, redesigns, and review of identity, money or persistence.
- Effort follows the ticket's suggestion; raise it, never silently lower it, for correctness work.

## 5. Accept-prompt template

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
