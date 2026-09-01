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

Classify the ticket by product risk before choosing its verification level:

- **Mechanical Fast:** tiny bugs, copy, CSS, i18n, mechanical test maintenance, simple state resets, and bounded quality-of-life work. Inspect narrowly, implement directly when unambiguous, run focused tests, avoid broad documentation reconciliation, and use low/medium reasoning.
- **Product Contract First:** new user-facing features or materially new UX, Training, natural-language, Personal Strategy, product-flow, or user-visible persistence behavior. Inspect first, resolve material ambiguity, agree a concise behavior contract, and only then implement.
- **Correctness / Architecture:** poker correctness, privacy/security, persistence integrity or migrations, strategy authority, canonical state ownership, and architecture. Use the rigorous bounded-ticket workflow, deeper reasoning, invariant-focused tests, and an independent scout/reviewer only when it materially reduces risk.
- **Heavy Future Design:** major future capabilities where design has more value than premature implementation. Prioritize product decisions, boundaries/interfaces, state ownership, truth/authority, failure/abstention behavior, natural-language implications, tests, vertical slices, and explicit non-goals. Do not automatically implement the broad system after designing it.

For user-facing product behavior, UX, learning semantics, natural-language behavior, user-visible persistence, or workflows with multiple reasonable interpretations, do not silently choose a materially ambiguous interpretation. If a reasonable product owner could reject the result because of that choice, inspect first, ask one to four high-information questions, propose a concise behavior contract, and wait for the answer before implementation. Do not ask when accepted specifications already answer the question, the ticket is a deterministic correctness repair, the choice is purely internal, or clarification would not materially change the product.

Then choose the verification level below. The default is a normal bounded ticket; a correction remains part of that ticket, and release-style gates wait for an accepted checkpoint or audit.

### Fast iteration / human correction

Use while developing a bounded change or repairing a concept the product owner rejected:

- run focused affected tests only
- run `node --check` for changed JavaScript/MJS modules
- run `git diff --check`
- use targeted browser inspection only when it is useful to the correction
- do not run the full Node suite
- do not run the solver suite unless the changed behavior directly involves the solver
- do not repeat an exhaustive locale/theme/viewport matrix
- do not broadly reconcile planning documents

A correction prompt repairs the rejected concept. It does not silently become a second backlog ticket.

### Normal bounded ticket

Use for the complete implementation and review loop of one approved outcome:

- inspect the canonical path, implement only approved scope, and add or update focused tests
- run focused affected tests, syntax checks for changed JavaScript/MJS, and diff hygiene
- for UI tickets, inspect the primary browser state
- update only documentation whose truth actually changed
- obtain product-owner hands-on acceptance before treating the result as a checkpoint

### Accepted checkpoint / audit

Use after human acceptance when checkpointing the result, or when the ticket explicitly owns an audit:

- run the full Node suite
- run the solver suite only when domain, solver, or strategy changes make it relevant, or checkpoint policy explicitly requires it
- run a broader browser matrix when risk or checkpoint policy justifies it
- reconcile all affected documentation under `../project/DOCUMENTATION_GOVERNANCE.md`
- leave staging and committing to the human

The implementation loop is:

1. inspect current code, tests, and named documents
2. confirm the canonical path
3. implement only approved scope
4. add/update focused tests
5. verify at the applicable execution level
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

Verification follows the execution level in section 3. Ordinary iterations and normal bounded reports do not require the full gate.

Accepted checkpoint/audit full gate:

```powershell
node --test tests/*.test.js tests/*.test.mjs
git diff --check -- app shared solver tests docs README.md
```

Add the solver suite only when the checkpoint changed domain, solver, or strategy code, or its policy explicitly requires solver verification:

```powershell
$env:PYTHONPATH='solver;.'
python -B -m unittest discover -s tests/solver -p 'test_*.py'
```

During fast and normal work, syntax-check each changed JavaScript/MJS module rather than a fixed global list. Focused tests should cover the affected behavior and relevant invariants.

Ticket prompts may add focused gates. Do not silently skip a required command. If unavailable, report why.

## 6. Manual and browser acceptance

Automated structural tests do not prove visual correctness.

For UI work:

- inspect the primary browser state for a normal bounded ticket when available
- expand to additional viewports/themes/languages/states only when requested or justified by checkpoint risk
- if unavailable, mark visual findings `UNVERIFIED`, `PARTIAL`, or `STRUCTURAL ONLY`
- never report a visual QA item closed solely because CSS source tests passed

The product owner's hands-on QA is the subjective acceptance gate. If the product owner was explicitly asked to check several items and later reports only failures, treat the unmentioned requested checks as passed. Do not ask for those checks again unless subsequent code changes create a credible regression risk.

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

A newly discovered issue joins the current ticket only when the ticket caused it or it blocks acceptance of the ticket's intended user job. Otherwise record or route it to the appropriate owner under documentation governance and continue the bounded ticket.

## 8. Completion report

Normal reports are concise and include:

1. outcome
2. important root cause or design choice, when relevant
3. files changed
4. focused verification
5. browser/manual verification, when applicable
6. known or deferred issues
7. Git status and confirmation that nothing was staged or committed

An accepted checkpoint or audit report also records its broader gates and coordinated documentation result. Ordinary tickets do not require a release-style 20-30 item certification report.

Do not start the next ticket in the report.

## 9. Multi-agent work

One writer/integrator owns the working tree by default and reviews the final diff.

Independent scouts and reviewers are not the default. Use them when independence materially reduces risk, especially for privacy/security, poker mathematics, persistence/migrations, strategy authority, broad architecture, or high-risk cross-subsystem work. Do not routinely add them to labels, CSS, tiny UI work, simple randomization or local-state controls, or mechanical test maintenance.

When justified, use parallel subagents primarily for read-only repository reconnaissance, browser/current-state inspection, test and edge-case analysis, documentation/authority consistency review, or requested competitor/research analysis.

Parallel writes are allowed only when file ownership is explicitly disjoint or agents use isolated Git worktrees/branches. Never let multiple agents mutate overlapping files in the same working tree. Do not run competing heavy test or browser jobs in parallel on the same working tree or machine when resource or timing noise is credible.

## 10. Model and reasoning economy

Match reasoning depth to risk. Architecture, poker correctness, persistence, migrations, strategy authority, and audits warrant deeper reasoning. Bounded UI, CSS, i18n, and mechanical work do not require maximum reasoning by default. Repository policy should express this principle without depending on product-specific model names.

Optimize for accepted product progress, not maximum ceremony per ticket:

- batch several cheap related fixes into one bounded coherent outcome
- use focused tests during implementation; reserve full gates for checkpoints and audits
- after roughly two same-cause rejected corrections, stop patching blindly and reassess the behavior contract or root cause
- replace stale implementation-shape tests with behavioral coverage when appropriate
- after approximately two or three maintenance/correctness tickets, consider one bounded high-value, low-cost product batch; never promote it above an unresolved P0/P1 blocker

## 11. Prompt efficiency

Repository documents own durable invariants. Ticket prompts should name only the few invariants specifically at risk and reference these authorities instead of restating the architecture:

- architecture: `AGENT_MASTER_CONTEXT.md`, `../project/ARCHITECTURE_CONTRACT.md`
- workflow: this file
- current phase: `../project/CURRENT_PHASE.md`
- QA: `../project/QA_BACKLOG.md`
- product ideas: `../project/PRODUCT_BACKLOG.md`
- checkpoint debt: `../project/PRODUCT_RETURN_QUEUE.md`
- definition of done: `../project/DEFINITION_OF_DONE.md`
- documentation ownership: `../project/DOCUMENTATION_GOVERNANCE.md`

Repeat only high-risk invariants directly relevant to the ticket.
