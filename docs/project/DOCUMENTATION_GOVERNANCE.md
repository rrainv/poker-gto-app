# Riverline documentation governance

Last established: August 24, 2026 (`DOCS-INTEGRITY-001`).

## Authority hierarchy

1. **Final implementation truth:** executable code plus passing tests.
2. **Stable product and engineering authority:** `PROJECT_CHARTER.md`, `ARCHITECTURE_CONTRACT.md`, `PRODUCT_SPEC.md`, and current subsystem specifications.
3. **Live project state:** `CURRENT_PHASE.md`, `ROADMAP.md`, `PRODUCT_BACKLOG.md`, `PRODUCT_RETURN_QUEUE.md`, and `QA_BACKLOG.md`.
4. **Agent execution context:** `AGENTS.md`, `AGENT_MASTER_CONTEXT.md`, and `CODEX_WORKFLOW.md`.
5. **Historical/rationale material:** dated audits, superseded master plans, validation reports, ticket reports, and decision archives.

Lower levels summarize or route to higher levels; they do not override them. A filename containing `CURRENT`, `MASTER`, `AUTHORITY`, or `ROADMAP` grants no authority by itself.

## Ownership

- `CURRENT_PHASE.md` owns the current checkpoint, active ticket, exact directional execution order, and subsystem resume points.
- `ROADMAP.md` owns directional sequencing and the reason major phases are ordered as they are.
- `PRODUCT_BACKLOG.md` owns one current accepted capability/status record per product domain.
- `PRODUCT_RETURN_QUEUE.md` is the compact prioritized list of accepted checkpoint debt that Riverline refuses to forget.
- `QA_BACKLOG.md` owns stable issue IDs, status, evidence, and next owner for bugs and manual acceptance.
- Stable contracts and subsystem specs own durable product rules, dependency boundaries, schema semantics, and acceptance invariants. They do not own current ticket order.
- `CURRENT_REPO_AUDIT.md` is a dated evidence snapshot of repository structure. It is refreshed after major architecture or subsystem changes and must state unperformed verification.
- Agent documents own workflow and a compact execution snapshot. They point to live documents instead of maintaining another backlog.

## Coordinated updates

If an accepted checkpoint changes priority, subsystem status, architecture, known debt, or future ownership, update the affected live documents in the same ticket:

- priority or phase: `CURRENT_PHASE.md`, `ROADMAP.md`, and the affected `PRODUCT_BACKLOG.md` entry;
- implementation or capability status: `CURRENT_PHASE.md` and `PRODUCT_BACKLOG.md`, plus `ROADMAP.md` when directional sequencing changes;
- known bug or manual acceptance: `QA_BACKLOG.md`, plus `PRODUCT_RETURN_QUEUE.md` when it materially affects subsystem completion or release;
- accepted incomplete checkpoint: add or update a Return Queue owner/trigger;
- stable architecture or product rule: update the owning contract/spec and then its summaries.

A tiny patch that changes no accepted product state, priority, architecture, debt, or future ownership does **not** require Roadmap churn. It still updates QA when an issue closes, regresses, or changes owner.

## Ticket reports and stale documents

An accepted ticket report is evidence, not a permanent parallel status system. The accepting ticket incorporates any lasting status, priority, architecture, QA, or debt change into the owning documents above.

Historical material may preserve rationale, old decisions, measurements, and then-current status. It must show a date and a prominent label near the top such as `HISTORICAL`, `SUPERSEDED`, or `ARCHIVED`, name the current authorities, and avoid presenting old `ACTIVE NEXT`, `PLANNED`, or `DEFERRED` labels as current instructions.

Do not create a second roadmap, backlog, QA list, saved-object model, or architecture authority in a prompt, audit, report, README, or chat. Link to the owning document. At roadmap syncs, reconcile live status and remove contradictory duplicate domain sections rather than adding another summary table.
