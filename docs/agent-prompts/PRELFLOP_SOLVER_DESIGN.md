# Bounded preflop solver extension prompt

Compatibility filename retained. Riverline already has a bounded HU preflop solver under `solver/riverline_solver/`.

Do not design a new solver from scratch without first reading:

- `docs/solver/HU_PREFLOP_100BB_V1.md`
- current solver tests and characterization tools
- calibration baseline documents

Any extension must preserve isolation from production runtime and document:

1. exact game and abstraction
2. chance/private-card representation
3. legal betting tree and amount semantics
4. information sets
5. utility and leaf-value assumptions
6. regret/average-strategy algorithm
7. RNG/reproducibility
8. convergence/exploitability metric
9. memory and compute estimate
10. validation fixtures
11. artifact schema/provenance

Do not extrapolate bounded HU results to multiway, other stacks, or full-game Hold'em without evidence.
