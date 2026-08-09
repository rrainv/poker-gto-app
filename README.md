# Riverline

Riverline is a browser-first Texas Hold'em analysis application. It combines a configurable strategy Playbook, multiway equity calculations, and practice hands in one interface, with an optional Electron desktop wrapper.

Riverline is under active development. Its current strategy output is primarily heuristic and should not be treated as solved GTO.

## What it does today

- **Playbook:** enter hole cards, board cards, position, stack, pot, and prior action to receive a strategy mix and supporting hand metrics.
- **Win Probability / Equity:** estimate outcomes for known hands and board states, including ties and multiway pots. The current Equity UI supports up to eight players.
- **Training:** generate practice spots and compare a chosen action with Riverline's current recommendation.
- **Game configuration:** Playbook and Training support tables from 2 to 10 players, full-ring positions, and configurable stack depths.
- **Game modes:** represent zero-contribution Home games and ClubGG-style fixed per-player contributions. Legacy percentage-rake controls remain in the application.
- **Optional strategy sources:** compatible local trees, ONNX inference, and API responses can feed the Playbook; heuristic fallbacks keep the application usable when those sources are unavailable.

The Playbook's current application boundary is deliberately small: a versioned `DecisionContext` is passed to a strategy source, which returns a versioned `StrategyResult`. This provides a stable seam for future solver- and model-backed work without presenting today's heuristics as equilibrium solutions.

## Run Riverline

### Browser

Browser mode uses Python's standard-library HTTP server and does not require a Python package installation.

```bash
git clone https://github.com/rrainv/poker-gto-app.git
cd poker-gto-app
python server.py
```

Open the URL printed by the server (normally `http://localhost:3000`; it falls back to port 8080 if needed). Run the command from the repository root so model and worker assets are served from `app/` correctly.

### Electron desktop app

Install a current Node.js/npm release, then run:

```bash
cd app
npm install
npm start
```

The Electron app loads `app/index.html` directly. A Python backend is not required.

## Current status and limitations

- Riverline is a pre-beta analysis and study tool, not a validated poker solver.
- Heuristic recommendations are not solved GTO, CFR output, or evidence of low exploitability.
- The repository contains several experimental model and training implementations with incompatible schemas. Bundled ONNX paths exist, but model-backed behavior is not yet a single validated capability across browser and Electron.
- Multiway equity analysis is supported; solver-backed multiway equilibrium is not.
- Equity results for incomplete boards are Monte Carlo estimates and may vary between runs.
- Some in-app labels still use older “GTO” or “DeepCFR” language. Those labels are not proof of the underlying method or accuracy.

## Development direction

Current work focuses on stabilizing shared poker state and action contracts, consolidating evaluator and model paths, and strengthening regression coverage. The longer-term aim is to replace unverified training targets with reproducible solver-generated data, validate exported models, and improve preflop first before extending postflop approximations.

## Documentation

- [Documentation index](docs/README.md)
- [Project charter](docs/project/PROJECT_CHARTER.md)
- [Architecture contract](docs/project/ARCHITECTURE_CONTRACT.md)
- [Roadmap](docs/project/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
