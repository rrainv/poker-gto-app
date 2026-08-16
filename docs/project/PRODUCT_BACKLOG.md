# Riverline Product and Feature Backlog

This file preserves accepted future ideas so repair tickets do not need to repeat them and agents do not implement them opportunistically.

Status vocabulary:

- `PRIORITY`: strongly desired when dependencies are ready
- `PLANNED`: accepted direction
- `IDEA`: worth exploring
- `DEFERRED`: intentionally later

## Current delivery ordering

- **ACTIVE NEXT — `TABLE-PRESENCE-001A`:** richer static canonical Hand Mode table presentation, using trusted state only; no replay controls, animation, or UI poker mathematics.
- **PLANNED — `REPLAY-001A`:** read-only canonical action timeline after Table Presence acceptance.
- **PLANNED LATER — `REPLAY-001B/001C`:** deterministic step-through, then playback/motion through the Table Presence layer.
- **DEFERRED — Personal Strategy continuation:** `RANGE-CAL-002B`–`002D`, `RANGE-CAL-002R`, mode interpolation, StrategyProvider integration, Training-to-profile evidence, and broader integration. The completed foundation and usable Range Calibration workspace remain preserved; resume at `RANGE-CAL-002B`.

## Product Lab: UI capabilities

| ID | Status | Capability | Dependencies |
|---|---|---|---|
| PROD-LAYOUT-001 | PRIORITY | safe workspace layout presets | Product UI repair baseline |
| PROD-LAYOUT-002 | PLANNED | card-first versus configuration-first Playbook layouts | UI-005 decisions |
| PROD-DENSITY-001 | PLANNED | compact/comfortable density modes | component-system stability |
| PROD-THEME-001 | PLANNED | additional curated theme families | UI-004 theme cleanup |
| PROD-MODE-001 | PLANNED | beginner versus expert presentation modes | Guide/i18n, analysis hierarchy |
| PROD-PERSONALIZE-001 | PLANNED | persist/reset workspace preferences safely | no arbitrary drag-drop serializer |
| PROD-MOTION-001 | PLANNED | restrained sound/motion controls | current sound inventory |

## Table and player experience

| ID | Status | Capability | Notes |
|---|---|---|---|
| PROD-TABLE-001 | PRIORITY | richer physical table presentation | active delivery begins with `TABLE-PRESENCE-001A`; preserve analytical readability and canonical-state authority |
| PROD-TABLE-002 | PLANNED | dealer and dealing/chip/contribution animations | replay-ready state model |
| PROD-TABLE-003 | PRIORITY | configurable player/villain names | generic seat labels remain fallback |
| PROD-TABLE-004 | PRIORITY | per-player starting/current stacks | canonical and Scenario authority must be explicit |
| PROD-TABLE-005 | PLANNED | villain notes/tendencies/archetypes | not a solver claim |
| PROD-TABLE-006 | IDEA | future per-villain strategy/player models | requires versioned source and provenance |

## Replay, persistence, and review

| ID | Status | Capability | Notes |
|---|---|---|---|
| PROD-REPLAY-001 | PRIORITY | replay timeline with animated bets/raises/calls/chance events | `REPLAY-001A` is timeline-only; step-through and motion follow only after acceptance |
| PROD-SAVE-001 | PARTIAL | bookmark/save spots, hands, and ranges | `SAVED-OBJECTS-001/001R` establishes the local-first Hand/Spot foundation and cold-reconstructable canonical Saved Hand Replay source; `SAVED-OBJECTS-002` adds current Hand/Replay/Scenario save, annotations, review/mistake, archive, and bounded reidentification UX; Home/Library browsing and future Range payload remain later work |
| PROD-SESSION-001 | PLANNED | session history and review |
| PROD-COMPARE-001 | PLANNED | compare strategies/spots/history |

## Training

| ID | Status | Capability |
|---|---|---|
| PROD-TRAIN-001 | PRIORITY | expanded Training filters |
| PROD-TRAIN-002 | PRIORITY | mistake library/review |
| PROD-TRAIN-003 | PRIORITY | targeted re-drilling and spaced review |
| PROD-TRAIN-004 | PLANNED | adaptive curriculum and range profiling |
| PROD-TRAIN-005 | PLANNED | persistence across sessions |

## Range and study tools

| ID | Status | Capability |
|---|---|---|
| PROD-RANGE-001 | PRIORITY | Range Builder |
| PROD-RANGE-002 | PRIORITY | Range Profiler / infer how tight or loose the user's choices are |
| PROD-RANGE-003 | PLANNED | save/share named ranges |
| PROD-RANGE-004 | PLANNED | weighted range analysis |
| PROD-RANGE-005 | PLANNED | range-vs-range Equity/category tools |
| PROD-RANGE-006 | PLANNED | provider-backed postflop full-range Matrix with board-aware weighted combos and validated source coverage |
| PROD-MATH-001 | IDEA | board/pot/poker-math study tools |

## Input and workflow

| ID | Status | Capability |
|---|---|---|
| PROD-KEYBOARD-001 | PLANNED | expert keyboard mode |
| PROD-MOBILE-001 | DEFERRED | distinct mobile composition |
| PROD-IMPORT-001 | DEFERRED | validated strategy-source/import workflow | replaces retired arbitrary tree upload; requires schema/provenance/coverage validation |

## Desktop, web, and release

| ID | Status | Capability |
|---|---|---|
| PROD-DESKTOP-001 | PLANNED | reproducible Electron install/package structure |
| PROD-DESKTOP-002 | PLANNED | correct portable and installer targets/assets |
| PROD-WEB-001 | DEFERRED | public web hosting after product quality acceptance |
| PROD-RELEASE-001 | DEFERRED | documentation, privacy/legal, optional telemetry decision |

## Strategy, solver, and model

| ID | Status | Capability |
|---|---|---|
| PROD-SOLVER-001 | DEFERRED | continue bounded solver/MCCFR validation |
| PROD-DATA-001 | DEFERRED | generate validated strategy dataset |
| PROD-MODEL-001 | DEFERRED | validated preflop provider/model behind StrategyProvider |
| PROD-CLOUD-001 | DEFERRED | bounded cloud benchmark with explicit spend cap |

## Budget rule

No paid/cloud/product service should exceed the user's approximately US$75 total optional project budget without explicit approval.

## Pull-forward rule

A backlog item may move earlier when:

- it naturally fits the current architecture ticket
- it does not broaden risk materially
- the user explicitly prioritizes it
- dependencies are satisfied

Do not implement a future item merely because a touched file makes it convenient.
