# Git workflow for Riverline agent work

## Principles

- one ticket, one reviewable commit
- agent does not stage or commit by default
- human reviews and commits after tests/manual acceptance
- same chat fixes current-ticket regressions
- new ticket starts a new chat
- do not mix unrelated dirty files into a ticket

## Before a ticket

```powershell
git status --short
git branch --show-current
git diff --stat
```

Never use `git add .`, `git add -A`, or `git add --all` for Riverline ticket staging. Inspect first and stage exact ticket-owned paths only.

Use a branch for risky/long work when helpful:

```powershell
git switch -c product-ui-003-analysis-presentation
```

## Protected operational files

Unless explicitly owned by the ticket, do not stage, revert, or commit:

- `.codex/config.toml`
- `.gitignore`
- `repo_dump.py`
- `repo_dump.txt`
- user/helper artifacts and unrelated generated files

Other pre-existing dirty paths must be identified in the report.

## Agent completion

The agent leaves changes unstaged and uncommitted.

The report must separate:

- ticket files
- pre-existing user/tooling changes
- generated/ignored artifacts

## Human review and staging

After acceptance, stage exact ticket-owned files. Example for a documentation ticket:

```powershell
git add -- `
  AGENTS.md `
  README.md `
  docs/README.md `
  docs/project/DOCUMENTATION_GOVERNANCE.md
```

Add every other owned path explicitly. Do not use an exclusion-based broad add: a newly created helper or user artifact may not be on the exclusion list.

Then inspect:

```powershell
git --no-pager diff --cached --name-status
git --no-pager diff --cached --stat
git --no-pager diff --cached --check

git diff --cached --name-only |
  Select-String '\.codex/config\.toml|\.gitignore|repo_dump\.py|repo_dump\.txt'
```

The protected-file check should return no output.

For tickets with known line-ending-only files, exclude those paths explicitly rather than committing meaningless changes.

## Commit

Use a short descriptive message:

```text
ui: refine workspace density and geometry
strategy: improve postflop heuristic integrity
perf: reduce redundant interaction work
docs: refresh agent workflow and project navigation
```

Then verify:

```powershell
git commit -m "<message>"
git status --short
git log -5 --oneline
```

## Regressions

If manual QA finds a regression before commit:

- do not commit
- return to the same ticket chat
- fix only that regression
- rerun focused/full tests
- repeat manual acceptance

If found after commit, create a clearly named repair ticket unless the commit is still local and intentionally amended.

## Large/reviewer tickets

Use a new chat for independent review. Do not let a reviewer silently implement unrelated recommendations.
