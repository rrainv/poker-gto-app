# Future preflop model prompt

Do not implement until a validated, versioned strategy dataset exists and the roadmap explicitly authorizes model work.

Requirements:

- enter production only through a new validated StrategyProvider branch
- no revival of retired browser/Electron model loaders
- reproducible train/validation/test split
- source dataset and game-abstraction metadata
- held-out policy/calibration metrics
- action-frequency and worst-case analysis
- coverage/uncertainty behavior
- versioned model and schema metadata
- browser size, memory, cold-load, and inference measurements
- exported-runtime agreement if an export format is used

ONNX is optional, not assumed. If chosen, validate exported outputs against the training runtime.

Do not call the model GTO unless its exact source and validation evidence support that claim.
