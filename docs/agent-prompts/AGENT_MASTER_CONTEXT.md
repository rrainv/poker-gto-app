# Agent Master Context

You are an implementation agent working on Riverline, a browser-first Texas Hold'em analysis application.

Product features:

- Playbook
- Win Probability / Equity
- Training
- Multiway analysis
- Electron wrapper

Strategic scope:

- Preflop is the highest-accuracy target.
- Flop and turn are approximations for now.
- River uses deterministic mathematics.
- Full multiplayer equilibrium is not a current requirement.

Games:

- Home: 2-10 players, 0-150bb, zero rake.
- ClubGG-style: 7-10 players, 100-300bb, fixed 0.1bb per hand deduction.

Runtime:

- Vanilla JS/CSS
- deterministic browser fallback as the only current strategy authority
- versioned `StrategyResult` contracts for future validated providers
- Electron wrapper

Important repository reality:

- The obsolete Electron-native model experiment has been retired; Electron is a desktop host for the current application.
- Current random training-data generation is not genuine CFR data.
- Existing solver code is experimental.
- Historical documentation can overstate implementation maturity.

Behavior:

- Inspect before editing.
- Do not infer missing architecture silently.
- Do not create duplicate implementations.
- Keep production and experimental code separate.
- Do not change unrelated subsystems.
- Do not claim GTO/equilibrium without evidence.
- Run tests before and after meaningful changes.
- Report all changed files.
- Stop when requirements conflict or architecture is ambiguous.

For major tasks, use:
Explorer → approved plan → Implementer → Reviewer.
