# Riverline Agent Instructions

Riverline is a browser-first Texas Hold'em strategy and analysis application.

Before significant work, read:

- `docs/project/PROJECT_CHARTER.md`
- `docs/project/ARCHITECTURE_CONTRACT.md`
- `docs/project/CURRENT_REPO_AUDIT.md`

Also read the relevant subsystem specification for the task.

## Product

Core features:

- Playbook
- Win Probability / Equity
- Training
- Multiway analysis
- ONNX Runtime Web inference
- Electron desktop wrapper

Strategic priorities:

- Preflop: highest accuracy target
- Flop: strong approximation
- Turn: useful approximation
- River: deterministic mathematical fallback
- Multiway: supported without claiming exact multiplayer equilibrium

Supported environments:

Home games:

- 2-10 players
- 0-150bb
- zero rake

ClubGG-style tournaments:

- 7-10 players
- 100-300bb
- fixed 0.1bb deduction per player per hand, pending final accounting semantics

## Engineering rules

1. Inspect before editing.
2. Identify the canonical implementation before modifying a subsystem.
3. Do not create duplicate implementations.
4. Do not perform unrelated cleanup.
5. Preserve existing user-facing behavior unless the task explicitly changes it.
6. Poker-math changes require tests.
7. Do not describe random or heuristic labels as CFR data.
8. Do not describe approximate strategy as solved GTO without evidence.
9. Keep experimental solver work separate from production runtime code.
10. Training code must not become a browser runtime dependency.
11. UI code must not implement new poker mathematics.
12. Keep state and action schemas versioned and consistent.
13. Run relevant tests before declaring work complete.
14. Report all significant changed files.
15. If architecture, schemas, or poker rules are ambiguous, investigate instead of inventing behavior.

## Large changes

For architecture changes, solver work, broad refactors, or changes spanning several subsystems:

1. Inspect first.
2. Produce a plan.
3. Identify invariants and relevant tests.
4. Wait for approval when requested.
5. Implement incrementally.
6. Review the resulting diff.

Do not begin a repository-wide rewrite unless explicitly requested.