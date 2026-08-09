# Real Data Pipeline Prompt

Explorer mode first.

Trace the complete current path from state generation to training target.

Determine whether each target comes from:

- CFR/MCCFR
- deterministic poker math
- curated data
- heuristic labels
- random synthetic generation

Do not edit.

Then design a reproducible real-state dataset generator.

Requirements:

- valid Hold'em states
- no duplicate cards
- correct street
- legal history
- correct pot/stack values
- player count distribution
- stack distribution
- reproducible seed
- metadata for reproducing a bad sample

Add dataset diagnostics:

- invalid states
- duplicate cards
- action distribution
- stack distribution
- street distribution
- player distribution
- target distribution

Do not train until the dataset is validated.
