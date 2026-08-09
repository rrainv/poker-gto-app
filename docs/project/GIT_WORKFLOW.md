# Git Workflow for Agent Work

## Before an agent task

```bash
git status
git branch
git diff
```

Create a clean checkpoint:

```bash
git add .
git commit -m "checkpoint before <task>"
```

## For risky work

Use a branch:

```bash
git switch -c arch-001-state-schema
```

or:

```bash
git switch -c ui-002-playbook-polish
```

## After the agent

Inspect:

```bash
git diff
git status
```

Run the relevant tests.

If the patch is bad, revert the branch rather than manually repairing a tangled patch.

## Branch principle

Keep these separate:

- architecture
- poker engine
- ML/training
- solver experiments
- UI
- localization

Do not combine a solver rewrite and UI redesign in one branch.
