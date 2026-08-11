# Riverline Architecture Contract

This document is authoritative for implementation decisions unless explicitly superseded.

## 1. Layers

```text
UI
  ↓
Application / Controllers
  ↓
Poker Domain Engine
  ↓
Strategy Services
  ↓
Models / Solvers / Data Generation
```

### UI

Responsible for:

- rendering
- interaction
- formatting
- loading states
- errors
- localization
- responsive behavior

Not responsible for:

- hand evaluation
- equity calculation
- pot accounting
- strategy mathematics
- model training

### Application layer

Responsible for:

- coordinating UI actions
- calling poker-engine services
- requesting strategy
- managing session state
- mapping engine results to UI-friendly structures

### Poker domain engine

Responsible for:

- cards
- board
- players
- stacks
- contributions
- pot
- street
- action legality
- hand evaluation
- equity calculations
- terminal conditions
- game-specific deductions

This layer must be deterministic and testable.

### Strategy layer

Responsible for:

- selecting the appropriate strategy source
- deterministic fallback calculations
- future provider/model inference only through a validated versioned contract
- interpolation
- result provenance
- confidence/coverage metadata

The UI should not need to know whether a result came from a model or fallback.

### Training/solver layer

Responsible for:

- data generation
- CFR/MCCFR experiments
- model training
- validation
- export

It must not become a runtime dependency.

## 2. Canonical concepts

There should be one canonical implementation of:

- PokerState
- Action
- Card representation
- Hand evaluator
- Equity calculator
- StrategyResult
- Model metadata

If two implementations exist, one must be marked legacy/experimental.

## 3. StrategyResult

The runtime strategy API should conceptually return:

```text
action probabilities
expected values where available
confidence/coverage
source/provenance
model version
state/schema version
```

Example:

```json
{
  "actions": {
    "fold": 0.02,
    "call": 0.31,
    "raise": 0.67
  },
  "source": "heuristic_preflop",
  "modelVersion": null,
  "confidence": null
}
```

## 4. Provenance values

Current browser vocabulary:

- heuristic_preflop
- heuristic_postflop
- equity_fallback
- unavailable

Future providers must add explicitly versioned vocabulary; do not silently mix sources.

## 5. Model versioning

Every production model needs metadata containing:

- model version
- state schema version
- action schema version
- training configuration
- source dataset
- creation timestamp
- framework/version where relevant

## 6. Legacy policy

Retain experimental implementations only while they have an active research purpose.

When a prototype is obsolete, unreferenced, and outside the retained architecture, remove it from the current tree; Git history is the archive. Do not keep it in a misleading `legacy` directory.

Production code must have one obvious canonical path.

## 7. Dependency direction

Production code must not import:

- training scripts
- experimental solver code
- notebooks
- cloud benchmarking code

Training code may import shared domain-engine code.

The domain engine must not import UI code.
