# QA and Regression Specification

## 1. Goal

Protect poker correctness and user-facing stability from agent-driven changes.

## 2. Required test categories

### Poker math

- evaluator known-answer tests
- equity tests
- multiway equity tests
- pot/stack accounting
- street transitions
- legal-action generation

### ML

- model input shape
- output shape
- probability normalization
- deterministic inference when seeded
- PyTorch vs ONNX output agreement within tolerance
- model metadata

### UI

- Playbook loads
- Equity loads
- Training loads
- model lazy-loading works
- translations resolve
- mobile layout
- dark/light theme

### E2E

At minimum:

1. open app
2. open Playbook
3. select cards
4. set board
5. request strategy
6. open Equity
7. calculate equity
8. open Training
9. complete one training interaction
10. switch language
11. reload

## 3. Mathematical smoke cases

Include:

- AA vs KK
- AKs vs a defined range
- obvious straight
- obvious flush
- full house
- quads
- board-made hand
- tie
- 3-way equity
- 5-way equity
- impossible duplicate cards
- all-in state
- zero-rake state
- 0.1bb ClubGG deduction

## 4. Agent rule

An agent must not claim a task is complete if relevant tests were not run.

If a test cannot run, report why.
