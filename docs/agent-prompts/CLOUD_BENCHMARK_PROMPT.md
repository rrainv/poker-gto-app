# Cloud Benchmark Prompt

Do not start a long training run.

Benchmark the exact same bounded workload on candidate hardware.

Measure:

- states/sec
- CFR iterations/sec
- evaluator calls/sec
- samples/sec
- CPU utilization
- GPU utilization
- RAM
- VRAM
- wall time
- estimated cost

Candidate classes may include:

- local CPU
- RTX 5090
- A6000
- A100
- H100

Use short runs.

Report:

```text
hardware
throughput
runtime
cost
cost per million useful states
```

Do not optimize the algorithm between hardware runs.

The purpose is to select price/performance, not prestige hardware.
