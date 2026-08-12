# Cloud benchmark prompt

Future work only. Explicit human approval is required before paid compute.

Project-wide optional compute/service budget is approximately US$75 unless the user changes it.

Before any run, state:

- exact workload and commit
- local baseline
- hardware candidate
- maximum wall time
- maximum spend
- artifact/output path
- success and stop criteria

Use short identical workloads. Do not optimize the algorithm between hardware comparisons.

Measure as relevant:

- states or iterations per second
- evaluator/sampler throughput
- CPU/GPU utilization
- RAM/VRAM
- wall time
- estimated and actual cost
- cost per useful unit

Never start a long, unbounded, or auto-scaling run.
