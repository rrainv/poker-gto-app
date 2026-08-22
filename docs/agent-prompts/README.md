# Riverline agent-documentation index

Use these files to keep ticket prompts concise and consistent.

## Always read

- `../../AGENTS.md`
- `AGENT_MASTER_CONTEXT.md`
- `CODEX_WORKFLOW.md`
- `../project/CURRENT_PHASE.md`

## Choose by task

| Task | Read additionally |
|---|---|
| UI/UX/Product repair | `../project/QA_BACKLOG.md`, `../project/PRODUCT_SPEC.md`, `UI_STABILIZATION_PROMPT.md` |
| New product feature | `../project/PRODUCT_BACKLOG.md`, relevant subsystem spec |
| Poker rules/Equity | `../project/POKER_ENGINE_SPEC.md`, `../project/QA_AND_REGRESSION_SPEC.md` |
| Strategy/fallback/reference authority | `../project/STRATEGY_SOURCE_AUTHORITY_SPEC.md`, calibration docs |
| Solver research | `PRELFLOP_SOLVER_DESIGN.md`, `../solver/` specifications |
| Model work | `PREFLOP_MODEL_PROMPT.md`; only after validated data exists |
| i18n | `I18N_AUDIT_PROMPT.md`, QA backlog i18n section |
| Cloud benchmark | `CLOUD_BENCHMARK_PROMPT.md`; explicit human spend approval required |
| Review | `REVIEW_PROMPT.md` |

## Core workflow files

- `AGENT_MASTER_CONTEXT.md`: current repository truth and dependency map
- `CODEX_WORKFLOW.md`: one-ticket lifecycle, Git boundaries, tests, reports
- `MODEL_AND_CHAT_GUIDE.md`: suggested model/reasoning and chat lifecycle
- `AGENT_OPERATING_MODEL.md`: Explorer, Implementer, Reviewer responsibilities
- `SESSION_START_PROMPT.md`: short session preamble
- `TICKET_TEMPLATE.md`: prompt skeleton
- `MASTER_AGENT_PROMPT.md`: reusable implementation-agent preamble
- `REVIEW_PROMPT.md`: independent patch review

## Prompt-size policy

Do not paste the full architecture history, QA backlog, or future feature list into every ticket.

A normal prompt should contain:

1. ticket identity and execution settings
2. exact goal
3. documents to read
4. owned QA/product IDs
5. invariants and out-of-scope boundaries
6. tests and manual acceptance
7. report format

Reference authoritative files by path. Repeat only rules whose omission would create immediate risk.

## Maintenance

Update:

- `CURRENT_PHASE.md` after accepted tickets or phase changes
- `QA_BACKLOG.md` when an issue is reported, regresses, closes, or changes owner
- `PRODUCT_BACKLOG.md` when a future capability is accepted or reprioritized
- `CURRENT_REPO_AUDIT.md` after major architecture changes
- `ROADMAP.md` at phase boundaries, not after every small patch
