# Preflop Solver Design Prompt

Explorer mode. Do not implement yet.

Design a bounded real preflop CFR/MCCFR experiment.

Target:

- heads-up
- 100bb
- no rake
- standard Hold'em
- preflop only
- discrete action abstraction
- correct chance/dealing logic
- correct betting/terminal logic
- reproducible seed

Do not design a full 10-max solver.

Explain:

1. game state
2. information set
3. action abstraction
4. chance nodes
5. terminal utility
6. regret update
7. average strategy
8. sampling method
9. convergence metric
10. expected memory
11. expected compute
12. validation against known strategic expectations

Do not use random synthetic labels.

Do not call the output GTO until convergence/validation evidence supports the claim.
