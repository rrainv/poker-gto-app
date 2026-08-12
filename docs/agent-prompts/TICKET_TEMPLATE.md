# Riverline ticket template

## Execution

- Ticket: `AREA-NNN`
- Model: `GPT-5.6 Terra` / `GPT-5.6 Sol`
- Reasoning: `high` / `xhigh`
- Chat: `NEW` / `SAME current ticket`
- Mode: `INSPECT` / `IMPLEMENT + TEST` / `REVIEW`
- Commit policy: `DO NOT STAGE OR COMMIT`

## Read first

- `AGENTS.md`
- `docs/agent-prompts/AGENT_MASTER_CONTEXT.md`
- `docs/agent-prompts/CODEX_WORKFLOW.md`
- `docs/project/CURRENT_PHASE.md`
- `[relevant specification]`

Owned backlog IDs:

- `QA-...`
- `PROD-...`

## Goal

One precise outcome.

## Current behavior / evidence

Only the facts needed for this ticket.

## Requirements

1. ...
2. ...
3. ...

## Invariants to preserve

- canonical architecture boundary
- named contracts and behavior
- relevant PERF/QA guarantees

## Explicitly out of scope

- unrelated UI or backend work
- future backlog items
- schema/architecture changes not listed here

## Tests

Focused:

- ...

Full gate:

```powershell
node --test tests/*.test.js tests/*.test.mjs
$env:PYTHONPATH='solver;.'
python -B -m unittest discover -s tests/solver -p 'test_*.py'
node --check app/src/core/logic.js
node --check app/main.js
git diff --check -- app shared solver tests docs README.md
```

## Manual/browser acceptance

List exact states, viewports, themes, languages, and interactions.

If unavailable, report visual status as unverified; do not claim closure.

## Report

Return:

1. outcome/root cause
2. files changed
3. before/after behavior
4. tests and results
5. browser/manual result
6. owned backlog status
7. deferred items preserved
8. limitations
9. diff/status

Stop. Do not begin the next ticket.
