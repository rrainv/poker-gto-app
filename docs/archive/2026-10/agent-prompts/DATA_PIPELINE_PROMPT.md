# Real strategy-data pipeline prompt

Future work only. Do not run unless `CURRENT_PHASE.md` and a ticket explicitly authorize it.

Inspect the current bounded solver and strategy-provider contracts first.

Trace every proposed target to a documented source:

- converged solver/MCCFR output
- curated strategy data
- deterministic poker feature
- heuristic label

Random or heuristic targets must never be described as CFR/equilibrium data.

A dataset generator must provide:

- valid canonical Hold'em states and legal histories
- unique cards and correct board/street
- exact pot/stack/contribution semantics
- configuration coverage metadata
- reproducible seed and sample identifier
- source/provenance and solver convergence metadata
- diagnostics for invalid states, duplicates, actions, stacks, streets, players, and targets

Do not train until data validity and reference quality are demonstrated.
