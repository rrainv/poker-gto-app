# Riverline documentation

Executable code and passing tests are the final source of truth. Current-state documentation should match them; historical documents do not override them.

## Agent entry points

- [Root agent instructions](../AGENTS.md)
- [Agent-documentation index](agent-prompts/README.md)
- [Current architecture context](agent-prompts/AGENT_MASTER_CONTEXT.md)
- [Codex workflow](agent-prompts/CODEX_WORKFLOW.md)
- [Model and chat guide](agent-prompts/MODEL_AND_CHAT_GUIDE.md)
- [Ticket template](agent-prompts/TICKET_TEMPLATE.md)
- [Reviewer prompt](agent-prompts/REVIEW_PROMPT.md)

## Current planning

- [Current phase](project/CURRENT_PHASE.md)
- [Roadmap](project/ROADMAP.md)
- [Persistent QA backlog](project/QA_BACKLOG.md)
- [Product and feature backlog](project/PRODUCT_BACKLOG.md)
- [Definition of done](project/DEFINITION_OF_DONE.md)
- [Git workflow](project/GIT_WORKFLOW.md)

## Engineering contracts

- [Project charter](project/PROJECT_CHARTER.md)
- [Architecture contract](project/ARCHITECTURE_CONTRACT.md)
- [Current repository audit](project/CURRENT_REPO_AUDIT.md)
- [Product and UI specification](project/PRODUCT_SPEC.md)
- [Poker engine specification](project/POKER_ENGINE_SPEC.md)
- [Strategy and ML specification](project/STRATEGY_AND_ML_SPEC.md)
- [QA and regression specification](project/QA_AND_REGRESSION_SPEC.md)

## Specialized future work

Files under `agent-prompts/` for solver, data, cloud, models, i18n, and UI are task templates. Their existence does not authorize that phase or prove the subsystem exists.

## Historical material

`POST_MORTEM.md`, the retired DeepCFR blueprint, old audit reports, and historical ticket prompts may describe earlier repository states. Treat them as history unless a current contract explicitly cites them.

Claims of GTO, equilibrium, CFR provenance, model accuracy, or exploitability require reproducible evidence.
