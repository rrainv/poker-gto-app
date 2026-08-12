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

Do not create an automatic `git add .` checkpoint when unrelated files are dirty.

Use a branch for risky/long work when helpful:

```powershell
git switch -c product-ui-003-analysis-presentation
```

## Protected operational files

Unless explicitly owned by the ticket, do not stage, revert, or commit:

- `.codex/config.toml`
- `repo_dump.py`
- `repo_dump.txt`

Other pre-existing dirty paths must be identified in the report.

## Agent completion

The agent leaves changes unstaged and uncommitted.

The report must separate:

- ticket files
- pre-existing user/tooling changes
- generated/ignored artifacts

## Human review and staging

After acceptance, stage the ticket while excluding protected files:

```powershell
git add -A -- . `
  ':(exclude).codex/config.toml' `
  ':(exclude)repo_dump.py' `
  ':(exclude)repo_dump.txt'
```

Then inspect:

```powershell
git --no-pager diff --cached --name-status
git --no-pager diff --cached --stat
git --no-pager diff --cached --check

git diff --cached --name-only |
  Select-String '\.codex/config\.toml|repo_dump\.py|repo_dump\.txt'
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
