# Riverline documentation

Start with the main [README](../README.md) for an overview and verified browser and Electron launch instructions.

## Project direction

- [Project charter](project/PROJECT_CHARTER.md) — product scope, supported environments, and engineering principles
- [Product specification](project/PRODUCT_SPEC.md) — intended product behavior and boundaries
- [Roadmap](project/ROADMAP.md) — staged development direction
- [Definition of done](project/DEFINITION_OF_DONE.md) — completion criteria for engineering work

## Engineering contracts

- [Architecture contract](project/ARCHITECTURE_CONTRACT.md) — dependency boundaries and versioned state/result contracts
- [Poker engine specification](project/POKER_ENGINE_SPEC.md) — poker-state, accounting, evaluator, and equity requirements
- [Strategy and ML specification](project/STRATEGY_AND_ML_SPEC.md) — strategy provenance, training-data, model, and export requirements
- [QA and regression specification](project/QA_AND_REGRESSION_SPEC.md) — required safety rails and test coverage
- [Git workflow](project/GIT_WORKFLOW.md) and [contributing guide](../CONTRIBUTING.md)

## Audits and historical material

- [Current repository audit](project/CURRENT_REPO_AUDIT.md) is a baseline audit snapshot. It should be checked against executable code and newer regression tests before being treated as current behavior.
- [DeepCFR training blueprint](DEEPCFR_TRAINING_BLUEPRINT.md), [audit report](audit_report.txt), and [post-mortem](../POST_MORTEM.md) are historical or experimental material. They describe proposals, investigations, or earlier repository states—not verified current product capabilities.
- Files under [`agent-prompts/`](agent-prompts/) are development instructions, not user documentation or evidence that a proposed subsystem has been implemented.

When documentation and executable behavior disagree, the code and tests are the source of truth. Claims of GTO, equilibrium, CFR provenance, model accuracy, or exploitability require reproducible evidence.
