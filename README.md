# Riverline

Riverline is a browser-first Texas Hold'em analysis application. It combines a configurable strategy Playbook, multiway equity calculations, and practice hands in one interface, with an optional Electron desktop wrapper.

Riverline is under active development. Its current strategy output is primarily heuristic and should not be treated as solved GTO.

## What it does today

- **Playbook:** enter hole cards, board cards, position, stack, pot, and prior action to receive a strategy mix and supporting hand metrics.
- **Win Probability / Equity:** estimate outcomes for known hands and board states, including ties and multiway pots. The current Equity UI supports up to eight players.
- **Training:** generate practice spots and compare a chosen action with Riverline's current recommendation.
- **Game configuration:** Playbook and Training support tables from 2 to 10 players, full-ring positions, and configurable stack depths.
- **Game modes:** Home games have no deduction; ClubGG deducts exactly 0.1bb from each seated player once per hand, outside the contestable pot.
- **Strategy:** the deterministic heuristic fallback is the browser's only current production strategy authority. Future solver-backed providers must enter through a new validated, versioned contract.

The Playbook's current application boundary is deliberately small: a versioned `DecisionContext` is passed to a strategy source, which returns a versioned `StrategyResult`. This provides a stable seam for future solver- and model-backed work without presenting today's heuristics as equilibrium solutions.

For pricing, `facingSizeBb` means the nominal wager-to level. The trusted
incremental price to call is `callAmountBb` when available; Scenario mode
intentionally leaves it unavailable when no legal history establishes it.

## Run Riverline

### Browser

Browser mode uses a checked-in dependency-free Node development server and does not require a Python package installation.

```bash
node tools/dev-web-server.mjs
```

Open `http://127.0.0.1:3000/` and configure your browser with `--port` or, if needed, `RIVERLINE_DEV_PORT`:

```bash
node tools/dev-web-server.mjs --port 4000
$env:RIVERLINE_DEV_PORT='4000'
# optional fallback for compatibility:
$env:PORT='4000'
node tools/dev-web-server.mjs
```

`RIVERLINE_DEV_PORT` takes precedence over `PORT` when both are set.

Run this command from the repository root so application and canonical Equity worker assets are served correctly.

### Canonical dev/test commands

```bash
node --test tests/*.test.js tests/*.test.mjs
$env:PYTHONPATH='solver;.'
py -3.12 -B -m unittest discover -s tests/solver -p 'test_*.py'
```

### Electron desktop app

Install a current Node.js/npm release, then run:

```bash
cd app
npm install
npm start
```

The Electron app loads `app/index.html` directly. A Python backend is not required.

Install app dependencies from:

```bash
cd app
npm install
```

Firefox is the primary browser acceptance target.

## Current status and limitations

- Riverline is a pre-beta analysis and study tool, not a validated poker solver.
- Heuristic recommendations are not solved GTO, CFR output, or evidence of low exploitability.
- Riverline has no trusted production model and does not load model/ONNX assets in either browser or Electron mode.
- Multiway equity analysis is supported; solver-backed multiway equilibrium is not.
- Equity uses exact enumeration where practical and Monte Carlo simulation for larger incomplete states.

## Development direction

Current work focuses on stabilizing shared poker state and action contracts, consolidating evaluator paths, and strengthening regression coverage. The longer-term aim is to create reproducible solver-generated data, introduce a new validated strategy-provider contract, and improve preflop first before extending postflop approximations.

## Documentation

- [Documentation index](docs/README.md)
- [Project charter](docs/project/PROJECT_CHARTER.md)
- [Architecture contract](docs/project/ARCHITECTURE_CONTRACT.md)
- [Roadmap](docs/project/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
