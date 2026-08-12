# Product UI repair prompt guide

Use this only for a named Product UI ticket.

Read:

- `CODEX_WORKFLOW.md`
- `../project/PRODUCT_SPEC.md`
- `../project/QA_BACKLOG.md`
- current ticket-owned QA IDs

Rules:

- repair current behavior before adding new Product Lab capabilities
- do not modify poker rules, Equity math, strategy frequencies, Training grading, or schemas unless explicitly owned
- preserve PERF-001 scheduling, single-provider resolution, hidden-surface invalidation, and Matrix reuse
- prefer shared tokens/components over one-off fixes, but do not rewrite the stylesheet
- distinguish structural tests from visual acceptance
- test 1024, 1280, 1440, and 1600 desktop widths when the ticket owns geometry
- include Hebrew/RTL and longer-copy stress when relevant
- do not close an issue without live visual confirmation if its defect is visual

Ticket prompts should list exact owned QA IDs and explicitly preserve all others.
