# Riverline Project Charter

## 1. Product

Riverline is a browser-first Texas Hold'em analysis and training application for personal use, friends, and a possible future public release.

Primary workspaces:

- Playbook Scenario Analysis
- canonical Hand Mode
- Equity / win probability
- Training
- Guide and Settings
- multiway analysis where supported
- thin Electron desktop wrapper

The product should feel like a serious, coherent analytical workstation. Premium means reliable, deliberate, and readable, not visually excessive.

## 2. Strategy scope

Riverline does not currently solve full 2–10-player Hold'em to exact equilibrium.

Current production strategy is a deterministic heuristic fallback behind versioned contracts. It has mathematical-integrity and calibration infrastructure, but no validated general strategy reference.

Long-term priorities:

- preflop receives the highest accuracy effort
- postflop remains a transparent approximation until better data exists
- multiway support must distinguish correct Equity from approximate strategy
- no GTO, CFR, Nash, model-accuracy, or exploitability claim without reproducible evidence

## 3. Supported study environments

- 2–10 seated players where the workspace supports it
- current exposed strategy/training stack controls: 10–500bb
- Home: no rake or forced deduction
- ClubGG-style: 7–10 players, exactly 0.1bb per seated player once per hand, outside the contestable pot
- no percentage/capped rake unless explicitly reintroduced through a new product decision

Accuracy is not uniform across all configurations; configuration support is not a solver-accuracy claim.

## 4. Runtime

- Vanilla JavaScript/CSS frontend
- browser runtime works without Python
- Electron is a thin host for the same application
- no current production model, model loader, remote strategy API, or tree upload
- future providers enter through a new validated, versioned StrategyProvider contract

## 5. Engineering principles

- correctness and truthfulness before optimization or visual polish
- one canonical authority per concept
- small, reviewable, reversible tickets
- tests for behavior and mathematical invariants
- no unrelated cleanup during scoped work
- no UI-implemented poker mathematics
- isolated solver/model/data experiments
- explicit provenance and limitations
- structural tests do not replace live visual acceptance
- Git history is the archive; obsolete implementations are removed, not kept as misleading legacy runtime

## 6. Current development priority

1. finish Product UI repair pipeline
2. Equity UX and Guide
3. i18n architecture and EN/RU/HE acceptance
4. responsive desktop acceptance and later distinct mobile composition
5. Product Lab UI capabilities and Feature Lab additions
6. desktop/web release preparation after product quality is acceptable
7. return to solver/reference data and model work later

The roadmap is flexible. New features may be inserted before release when they fit the architecture and budget.

## 7. Budget

The project is a student personal project. Optional compute/services should stay within approximately US$75 total unless the user explicitly approves more.

Every paid experiment requires:

- maximum spend
- maximum runtime
- reproducible configuration
- artifact path
- success criteria
- stop criteria

Public deployment is not the current focus.
