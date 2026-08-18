# Range Teacher / Active Personal Strategy Profiler

Status: implementation authority for `RANGE-TEACHER-001`; automated checkpoint, human Firefox QA open

Date: August 18, 2026

## Purpose and authority

Range Teacher is a compact derived explanation and elicitation surface over the existing Personal Strategy system. It helps a user describe their own intended preflop RFI Fold/Raise strategy; it is not a poker reference, solver, StrategyProvider source, Equity consumer, or Training grader.

The authority chain remains:

```text
immutable Personal Strategy evidence
  -> evidence view + PersonalStrategySnapshot v1
  -> 002C ranking/progress
  -> range-teacher-view/v1
  -> Teacher presentation and existing Calibration/Matrix/Builder actions
```

Teacher introduces no repository, evidence schema, sync entity, inferred truth, or second range format. Its view model and recommendation order are recomputed from one current scope revision.

## View-model contract

`createRangeTeacherView(...)` is a pure, DOM-free projection requiring a matching evidence view, snapshot, ranked candidates, and progress assessment. `range-teacher-view/v1` exposes:

- direct, inferred-high, inferred-medium, uncertain, conflicting, and unknown summary counts;
- deterministic `boundary-cluster/v1` groups;
- contradiction hotspots with every active direct head preserved separately;
- sparse structural regions and high-value next questions;
- useful exact-mix refinement candidates;
- recent source-derived evidence groups and selected-hand details;
- ordered optional actions plus same-session dismissal state;
- explicit preflop RFI, categorical-inference, no-reference-grading, and conflict-resolution limitations.

Boundary connectivity uses the canonical 002B primary-neighborhood graph within one structural family. Sparse regions use 002C structural families and density/status facts. Conflicts are never averaged. All ties use canonical 169-hand order; no recommendation is randomized.

## Session intents and routing

`range-teacher-session-presets/v1` maps focused Teacher sessions onto the existing resumable Calibration session:

| Teacher preset | Calibration intent | 002C selection intent |
|---|---|---|
| Quick profile | Quick | General |
| Boundaries | Standard | Boundary focus |
| Unknown regions | Standard | Sparse focus |
| Conflicts | Quick | Conflict review |
| Exact-mix refinement | Quick | Exact-mix refinement |

Selection intent is a deterministic bias inside the canonical 002C ranking, not a separate selector. Starting a focused session persists only the existing calibration-session cursor; it does not create answer evidence. Answering continues through Calibration and creates ordinary direct intended-strategy evidence.

Teacher routes inspection to the existing Matrix inspector, exact-mix refinement to the Matrix editor, grouped manual changes to the existing Builder, and questions to the existing Calibration loop. Conflict inspection remains read-only because writable multi-head resolution is outside this ticket. Same-session recommendation dismissals remain presentation state and are neither persisted nor strategy evidence.

## UI, cloud, and Guest behavior

Personal Strategy keeps Matrix as the default subview to minimize behavior change. The adjacent Teacher tab is a compact summary/recommendation surface with focused-session controls and bounded sections for boundaries, conflicts, unknown regions, and exact-mix opportunities. Hidden Matrix DOM work is not used to derive Teacher.

Teacher-derived state is not exported or synced. Profiles, modes, immutable evidence, and calibration sessions continue through the existing local/account paths; another device recomputes Teacher deterministically. The existing durable-feature account gate applies, so no persistent Guest Teacher profile or recommendation state is created.

EN/RU/HE copy, semantic tabs, keyboard tab switching, live status announcements, canonical hand-class LTR islands, responsive layouts, and a truthful tutorial step are included. Recommendations remain optional through dismiss, direct Matrix/Builder navigation, and Stop for now.

## Performance checkpoint

`node tests/tooling/benchmark_range_teacher001.mjs` measures cold construction, a cache-hit construction, recompute after one answer, and bounded boundary clustering. Representative runs on the implementation machine measured 63–80 ms cold, 5–7 ms cached, 3–4 ms after an evidence change, and 2.9–3.3 ms mean cached boundary analysis. These in-memory measurements are regression evidence, not universal Firefox or IndexedDB latency promises.

Each service request loads one scope projection bundle, reuses its evidence view and cached snapshot, computes one 002C ranking/progress assessment, and runs bounded analysis over 169 classes. It performs no per-cell repository loop, StrategyProvider call, Equity calculation, 1,326-combo expansion, or hidden Matrix render.

## Known limits

- preflop RFI Fold/Raise and 169 hand classes only;
- categorical inference only; exact mixes are direct user claims;
- no writable multi-head conflict resolution;
- no combo overrides, postflop propagation, imports/comparisons, or Saved Range workflow;
- no Training grading/history or StrategyProvider/reference comparison;
- synthetic deterministic coverage is not real-user uncertainty calibration or poker correctness evidence;
- human Firefox EN/RU/HE, theme, viewport, keyboard, and visual acceptance remains open in `QA_BACKLOG.md`.
