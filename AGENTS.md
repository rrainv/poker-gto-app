# Riverline Agent Instructions

Riverline is a browser-first Texas Hold'em analysis and training application with a thin Electron host.

This file is the agent entry point. Keep it short. Detailed workflow and project state live in the linked documents.

## Read order

Before significant work, read:

1. `docs/agent-prompts/AGENT_MASTER_CONTEXT.md`
2. `docs/agent-prompts/CODEX_WORKFLOW.md`
3. `docs/project/CURRENT_PHASE.md`
4. the relevant project specification
5. `docs/project/QA_BACKLOG.md` for UI, UX, accessibility, i18n, or product work
6. `docs/project/PRODUCT_BACKLOG.md` when a ticket affects future extensibility

Use `docs/agent-prompts/README.md` to choose the correct prompt or subsystem document.

## Current canonical architecture

```text
Scenario input OR canonical PokerState
                ↓
        DecisionContext v1
                ↓
        StrategyProvider v1
                ↓
         StrategyResult v1
                ↓
 Playbook / Training / Matrix / Analysis
```

Canonical authorities:

- poker rules, state, actions, evaluator, and Equity: `shared/poker-domain/`
- Scenario/Hand state selection: Playbook application controllers
- strategy entry point: `StrategyProvider v1`
- current production strategy: deterministic heuristic fallback under `app/src/strategy/`
- Training generation and grading: canonical Training application modules
- explanations: `AnalysisExplanation v1`; renderers are consumers only
- performance scheduling/invalidation: `product-performance/v1`
- desktop: `app/main.js`, a thin Electron host
- bounded solver research: `solver/`, isolated from production runtime

Deliberately absent:

- no production ONNX/model runtime
- no remote strategy API
- no arbitrary solver-tree upload authority
- no synthetic legacy Training pipeline
- no second production Equity engine

## Non-negotiable rules

1. Inspect before editing and identify the canonical implementation.
2. One ticket owns one bounded outcome. Do not add unrelated cleanup or features.
3. Do not create duplicate poker, Equity, Training, strategy, or state authorities.
4. UI code must not implement poker mathematics.
5. Poker-math changes require invariant-focused tests.
6. Heuristic output is not solved GTO, CFR, Nash, or exploitability evidence.
7. Keep solver/model/data-generation experiments isolated from production runtime.
8. Preserve versioned contracts unless the ticket explicitly owns a migration.
9. Preserve PERF-001 invocation-count and invalidation guarantees in UI work.
10. Use the QA backlog. Do not silently forget, close, or absorb unrelated issue IDs.
11. Report missing browser/manual verification honestly; structural tests are not visual acceptance.
12. Do not stage or commit unless the ticket explicitly says otherwise. Normal agent work remains unstaged and uncommitted for human review.
13. Do not touch `.codex/config.toml`, `repo_dump.py`, or `repo_dump.txt` unless the ticket explicitly owns them.
14. Stop and report if the requested change requires an unapproved schema migration, architecture rewrite, or substantial scope expansion.

## Ticket lifecycle

- New ticket: new Codex chat.
- Regression caused by the current ticket: same chat.
- Independent reviewer or new subsystem ticket: new chat.
- Agent: inspect, implement, test, report, stop.
- Human: review, run manual acceptance where needed, stage only ticket files, commit.

See `docs/agent-prompts/CODEX_WORKFLOW.md` for the full process.
