# Riverline Project Charter

## 1. Product

Riverline is a browser-first Texas Hold'em analysis application for personal use, friends, and a possible future public release.

Primary features:

- Playbook, the main strategy feature
- Win Probability / Equity
- Training
- Hand and state analysis
- Multiway support
- Deterministic browser strategy fallback behind versioned contracts
- Electron desktop wrapper

The product should feel like a coherent poker tool, not a research demo.

## 2. Strategic scope

The project does not currently aim to solve full 2-10 player Hold'em to exact equilibrium.

Current target:

- Preflop: highest accuracy target, eventually supported by genuine solver-generated data
- Flop: strong approximation
- Turn: useful approximation, with mathematical fallback
- River: deterministic range/equity mathematics for now
- Multiway: supported in the product, while acknowledging that multiplayer equilibrium is harder than heads-up zero-sum poker

## 3. Supported environments

Home games:

- 2-10 players
- 0-150bb stack range
- 0 rake

ClubGG-style tournaments:

- 7-10 players
- 100-300bb stack range
- fixed 0.1bb deduction per hand

Do not implement percentage rake unless explicitly requested.

## 4. Runtime

- Vanilla JS/CSS frontend
- Electron wrapper
- The browser has no trusted production model; deterministic fallback is its only current strategy authority
- Future models require a new validated, versioned StrategyProvider/model contract
- Runtime must remain usable without a Python backend

## 5. Engineering principles

- Correctness before optimization
- One canonical representation per concept
- Small reversible changes
- Tests before and after risky changes
- No broad rewrites during feature work
- No unrelated cleanup in scoped tasks
- No claims of GTO or equilibrium without appropriate evidence
- Experimental solver work stays separate from production application code

## 6. Current development priority

1. Architecture stabilization
2. Poker-engine correctness
3. Real preflop strategy experiment
4. Cheap cloud benchmark and bounded cloud run
5. Useful preflop model
6. UI/UX stabilization
7. Translation and responsive polish
8. Flop/turn approximation
9. Public-beta readiness
10. Optional advanced solver research

## 7. Budget principle

Cloud compute is experimental.

Never start an unbounded cloud run.

Every cloud experiment must have:

- explicit configuration
- expected workload
- maximum runtime
- maximum spend
- output artifacts
- success criteria
- stop criteria

A failed $20 experiment is acceptable. An uncontrolled multi-hundred-dollar run is not.
