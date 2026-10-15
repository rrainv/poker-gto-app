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

Milestone M1 is design-first: a full Style v4 design refresh plus honesty and usability fixes before the bigger M2/M3 feature work. [docs/STATE.md](docs/STATE.md) owns the live status and ordered queue; [docs/NORTH_STAR.md](docs/NORTH_STAR.md) owns product direction.

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

Real-app Beta smoke: `node tests/tooling/verify_beta_candidate_browser.mjs`.
See [browser prerequisites, coverage and failure artifacts](tests/tooling/README.md#current-beta-browser-entry-point).
Automated smoke does not replace human Firefox visual acceptance.

```powershell
node --test --test-concurrency=4 tests/*.test.js tests/*.test.mjs
$env:PYTHONPATH='solver;.'
py -3.12 -B -m unittest discover -s tests/solver -p 'test_*.py'
```

## Documentation

- [Documentation index](docs/README.md)
- [Agent rules](AGENTS.md)
- [North Star](docs/NORTH_STAR.md)
- [State](docs/STATE.md)
- [Architecture contract](docs/project/ARCHITECTURE_CONTRACT.md)
- [Contributing](CONTRIBUTING.md)
