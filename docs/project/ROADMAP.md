# Riverline Roadmap

## Phase A: Architecture

- repository audit
- canonical state
- canonical actions
- canonical evaluator/equity path
- canonical model path
- archive obsolete implementations

Exit criteria:
- one obvious production path for each major subsystem
- tests exist for critical poker math

## Phase B: Data correctness

- real state generator
- deterministic seeds
- reproducible datasets
- remove random policy/value labels from production training path

Exit criteria:
- dataset statistics are sensible
- impossible-state rate is zero

## Phase C: Bounded preflop solver

- heads-up
- 100bb
- no rake
- preflop only
- small action abstraction
- MCCFR/CFR
- local validation

Exit criteria:
- correct game tree
- convergence behavior
- strategy output passes sanity checks

## Phase D: Cloud benchmark

- benchmark CPU and GPU options
- short runs
- calculate cost per useful unit of work

Exit criteria:
- known throughput and cost

## Phase E: Preflop model

- generate real strategy dataset
- train model
- validate against held-out solver states
- export ONNX
- measure browser inference

## Phase F: Product polish

- design tokens
- Playbook UX
- Equity UX
- Training UX
- translation audit
- responsive layout
- accessibility
- visual regression

## Phase G: Flop/turn

- real poker features
- equity/range features
- strategy approximation
- fallback behavior
- uncertainty/coverage

## Phase H: Public beta

- build/release pipeline
- error telemetry if desired
- documentation
- legal/product review
- performance

## Phase I: Advanced solver research

Only after the product is stable:

- deeper MCCFR
- Deep CFR
- depth-limited solving
- stronger multiway research
