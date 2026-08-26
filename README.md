# Riverline

Riverline is a browser-first Texas Hold'em analysis, training, and personal-study workstation with an optional thin Electron host. It is under active development.

## What Riverline does today

- **Hand:** play complete legal 2–10-player hands through canonical poker state and actions.
- **Full Hand Review and Replay:** inspect the hand timeline and each recorded Hero decision, with source-aware comparison and direct Analyze/Save routes.
- **Analyze:** study Scenario snapshots or canonical Hand decisions through structured explanation, Matrix, range/board/blocker facts, provenance, and limitations.
- **Training:** use deterministic legal Varied, Focused, and Full Hand practice. The Training Practice Planner chooses structural targets; the canonical generator remains legal-trajectory authority.
- **Personal Strategy:** teach intended preflop strategy by profile and user-named mode through Calibration, Matrix, Range Builder, and Range Teacher. Intended strategy remains distinct from reference truth and observed behavior.
- **Equity:** calculate canonical exact or seeded Monte Carlo Hold'em outcomes, including ties and multiway pots.
- **Saved and Home:** save versioned Hands and Spots locally, reopen canonical Replay, annotate/review them, and use the My Riverline hub.
- **Home Game:** track a separate exact-money cash-game organizer domain with append-only corrections and deterministic settlement.
- **Guide and Settings:** access product help and shared presentation, accessibility, localization, audio, motion, theme, density, layout, and card preferences.

## Strategy truth

Riverline is not a validated general Hold'em solver. Its only current production strategy is a deterministic generalized heuristic fallback behind `DecisionContext` → `StrategyProvider` → `StrategyResult` → `StrategyClaimPolicy`. It supports honest comparative study, not solved-GTO, Nash, exact-EV, exploitability, or optimality claims. Future trusted sources must be versioned, validated, provenance-aware, and exact about context coverage.

For pricing, `facingSizeBb` is the nominal wager-to context. The trusted incremental call price is `callAmountBb` when canonical history establishes it. Scenario mode intentionally preserves missing legal-history facts as unavailable.

## Current direction

The one-time capability-documentation recovery, table physicality checkpoint, and bounded Home Game management continuation are complete. Settings information architecture is active next, followed by premium closeout. Trusted reference strategy and learning-intelligence work then resume without changing their preserved order. [Current phase](docs/project/CURRENT_PHASE.md) owns exact execution order; the [capability dossiers](docs/project/capabilities/README.md) preserve detailed long-term intent without setting priority.

## Run Riverline

Browser mode uses the checked-in dependency-free Node development server:

```powershell
node tools/dev-web-server.mjs
```

Open `http://127.0.0.1:3000/`. Use `--port` or `RIVERLINE_DEV_PORT` when needed. Run from the repository root so application and canonical Equity worker assets are served correctly.

For Electron:

```powershell
cd app
npm install
npm start
```

Firefox is the primary browser acceptance target.

## Canonical verification

```powershell
node --test tests/*.test.js tests/*.test.mjs
$env:PYTHONPATH='solver;.'
py -3.12 -B -m unittest discover -s tests/solver -p 'test_*.py'
```

## Documentation

- [Documentation index](docs/README.md)
- [Project charter](docs/project/PROJECT_CHARTER.md)
- [Architecture contract](docs/project/ARCHITECTURE_CONTRACT.md)
- [Current phase](docs/project/CURRENT_PHASE.md)
- [Contributing](CONTRIBUTING.md)
