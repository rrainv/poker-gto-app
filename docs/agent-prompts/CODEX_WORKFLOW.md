# Codex workflow

## 1. One ticket, one bounded outcome

A ticket owns one coherent result. Do not mix UI redesign, poker math, solver work, i18n, cleanup, and new features unless the ticket explicitly combines them.

Use issue IDs from `../project/QA_BACKLOG.md`, `../project/PRODUCT_RETURN_QUEUE.md`, and `../project/PRODUCT_BACKLOG.md` instead of repeating the full project history.

## 2. Chat lifecycle

- New ticket: start a new Codex chat.
- Regression or missed acceptance point from the current ticket: continue in the same chat.
- Independent review: new chat.
- New subsystem or phase: new chat.
- Retire a chat after its ticket is accepted and committed.

Do not continue unrelated work in a chat simply because it has repository context.

## 3. Agent lifecycle

Default implementation ticket:

1. inspect current code, tests, and named documents
2. confirm the canonical path
3. implement only approved scope
4. add/update focused tests
5. run focused and full verification
6. report clearly
7. stop

Do not wait for another approval after inspection when the prompt already approves a bounded implementation. Use an Explorer-only turn only when the ticket is explicitly inspection-only or architecture is genuinely unresolved.

## 4. Git and working-tree policy

Normal agent behavior:

- do not stage
- do not commit
- do not revert unrelated user changes
- do not run broad formatters over unrelated files

Protected unless explicitly owned by the ticket:

- `.codex/config.toml`
- `.gitignore`
- `repo_dump.py`
- `repo_dump.txt`
- user/helper artifacts

Before work, inspect:

```powershell
git status --short
git diff --stat
```

After work, report ticket files separately from pre-existing changes.

The human reviews and commits after acceptance. See `../project/GIT_WORKFLOW.md`.

Documentation movement follows `../project/DOCUMENTATION_GOVERNANCE.md`: a tiny patch with no product-state change needs no Roadmap churn, while an accepted checkpoint or reprioritization updates every affected live planning document in the same ticket.

## 5. Tests

Run the smallest relevant suite while developing, then the required full gate before reporting.

Default full gate:

```powershell
node --test tests/*.test.js tests/*.test.mjs
$env:PYTHONPATH='solver;.'
python -B -m unittest discover -s tests/solver -p 'test_*.py'
node --check app/src/core/logic.js
node --check app/main.js
git diff --check -- app shared solver tests docs README.md
```

Syntax-check every new or modified module.

Ticket prompts may add focused gates. Do not silently skip a required command. If unavailable, report why.

## 6. Manual and browser acceptance

Automated structural tests do not prove visual correctness.

For UI work:

- run browser inspection when available
- test requested viewports/themes/languages/states
- if unavailable, mark visual findings `UNVERIFIED`, `PARTIAL`, or `STRUCTURAL ONLY`
- never report a visual QA item closed solely because CSS source tests passed

For mathematical work, prefer invariant/property tests over arbitrary exact snapshots.

## 7. Scope expansion

Stop and report before proceeding if:

- a schema version migration is required but not approved
- canonical implementations conflict
- a poker rule is ambiguous
- a change requires broad architecture replacement
- a paid/cloud action is required
- the ticket would need unrelated cleanup or feature work

Small implementation details needed to satisfy the explicit goal do not require a new approval.

## 8. Completion report

Always return:

1. outcome
2. root cause or before/after architecture where relevant
3. files changed
4. behavior preserved
5. tests added/updated
6. focused results
7. full Node/Python/static results
8. browser/manual result or explicit absence
9. QA/product IDs closed, partial, deferred, or regressed
10. known limitations
11. diff stat and Git status
12. confirmation that nothing was staged or committed

Do not start the next ticket in the report.

## 9. Prompt efficiency

Ticket prompts should reference these documents instead of repeating them:

- architecture: `AGENT_MASTER_CONTEXT.md`, `../project/ARCHITECTURE_CONTRACT.md`
- workflow: this file
- current phase: `../project/CURRENT_PHASE.md`
- QA: `../project/QA_BACKLOG.md`
- product ideas: `../project/PRODUCT_BACKLOG.md`
- checkpoint debt: `../project/PRODUCT_RETURN_QUEUE.md`
- definition of done: `../project/DEFINITION_OF_DONE.md`
- documentation ownership: `../project/DOCUMENTATION_GOVERNANCE.md`

Repeat only high-risk invariants directly relevant to the ticket.
