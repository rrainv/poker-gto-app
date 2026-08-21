# Adaptive Range Calibration

Status: implementation authority for `RANGE-CAL-002C`, `PLAYSTYLE-QUICK-PROFILE-001`, and `ACTIVE-CLARIFICATION-001`

Date: August 21, 2026

## Scope and authority

`RANGE-CAL-002C` makes deterministic adaptive questioning the default preflop RFI Calibration path. `PLAYSTYLE-QUICK-PROFILE-001` changes its user-facing completion unit from direct coverage of a 169-cell survey to a useful first RFI profile approximation. `ACTIVE-CLARIFICATION-001` makes questions after readiness a bounded queue of uncertainty, boundary, transfer-disagreement, and conflict clarifications. The selector consumes the accepted `RANGE-CAL-002B` snapshot and optional compatible RFI transfer projection. It does not create another inference engine or mutate inferred or transferred state.

```text
immutable source evidence
          |
          v
PersonalStrategySnapshot v1 (002B)
          |
          v
rank unresolved candidates by local and transfer-aware question value
          |
          v
assess profile readiness and targeted clarification priorities
          |
          v
ask -> commit one direct observation/session cursor atomically
          |
          v
invalidate scope -> recompute snapshot -> rerank
```

Durable authority remains immutable source evidence. Candidate order, question scores, readiness, clarification priorities, and inferred/transferred output are derived and are never synced or persisted as poker truth.

The bounded implementation remains preflop raise-first-in with Fold/Raise actions and 169 hand-class baselines. It does not add Matrix, Builder, Teacher, Training, StrategyProvider, Equity, Range Core, solver, or postflop behavior.

## Versioned contracts

| Contract | Version | Role |
|---|---|---|
| Question selection policy | `adaptive-rfi-question-value/v2` | Deterministic local/transfer-aware candidate components, tiers, score, reasons, and canonical tie break |
| Cold-start policy | `adaptive-rfi-cold-start/v1` | Bounded structurally diverse initial anchors |
| Stopping policy | `adaptive-rfi-stopping/v2` | Profile-readiness gates, intent budgets, truthful category progress, refinement, and explicit stop reasons |
| Candidate | `rfi-calibration-candidate/v2` | One ranked unresolved hand with transparent local/transfer support and clarification facts |
| Profile readiness | `rfi-profile-readiness/v1` | Derived RFI usefulness state, blockers, coverage regions, and at most six clarification priorities |
| Progress | `rfi-calibration-progress/v2` | Truthful counts, readiness, next-question value, stop recommendation, and reason |

The pure DOM-free APIs are:

```js
rankCalibrationCandidates(snapshot, sessionOptions)
getNextCalibrationQuestion(snapshot, sessionOptions)
getCalibrationQuestionExplanation(candidate)
assessRfiProfileReadiness(snapshot, sessionOptions)
assessCalibrationProgress(snapshot, sessionOptions)
```

The application service owns snapshot loading, answer orchestration, pause/stop/skip, resume, and the exhaustive fallback. The workspace only renders the returned state.

## Candidate semantics

Ordinary candidates are unresolved estimates in the exact Profile x Mode x objective RFI scope. Directly known hands are excluded. A conflicting cell is exposed as `questionKind: "conflict_resolution"` and `ordinaryQuestionEligible: false`; another ordinary click cannot semantically resolve two legitimate independent heads.

Each candidate exposes:

- hand class, canonical index, deterministic rank, and priority tier;
- current estimate status and predicted dominant action, when 002B supplies one;
- uncertainty, evidence density, support direction, and structural family;
- boundary likelihood, conflict proximity, local disagreement/boundary/conflict counts, unresolved-neighbor count, and relation types;
- reason codes and up to three priority reasons;
- compatible transfer band/action/provenance, local disagreement, priority adjustment, and recommended-clarification flag;
- component values, repetition penalty, interaction cost, and exact-mix refinement value/reason.

`questionValueScore` is a bounded deterministic question-value score. It is not poker confidence, action probability, range weight, EV, solved GTO evidence, or a statement that a candidate action is correct.

## Question-value model

The v2 score retains the v1 local components and adds bounded transfer facts:

```text
35% uncertainty value
30% boundary value
20% local coverage-gain potential
15% structural novelty
10% relation diversity
15% nearby conflict value
-20% recent repetition penalty
+25% donor disagreement value
-18% compatible transfer support value
divided by interaction cost
```

Priority tiers preserve the intended ordering before the scalar tie breakers:

```text
explicit conflict review (not ordinary-question eligible)
local/donor transfer disagreement
boundary tests
cold-start anchors
medium boundary / uncertain / unknown
medium inference
high-inference maintenance
```

Stable ties use component ordering and finally canonical hand-class order. There is no random input and no `Math.random` dependency.

Compatible strong/moderate transfer lowers redundant unknown-hand priority. A donor action that disagrees with current local inference raises a still-unanswered hand into the clarification queue. Target direct evidence remains excluded, and its optional donor diagnostic never weakens local precedence or turns a direct hand into an ordinary question.

### Boundary likelihood

Boundary likelihood is ordinal: `unknown`, `low`, `medium`, or `high`. The selector consumes 002B boundary/support facts and raises a candidate to `high` when primary structural neighbors contain both direct Fold and Raise support. It therefore prioritizes a midpoint such as K8s between K9s Raise and K7s Fold, or 44 between 55 Raise and 33 Fold, without assuming a single global threshold.

Exact and tied neighboring mixes remain boundary signals only. They do not create inferred numeric frequencies.

### Coverage-gain proxy

Coverage-gain potential is the weighted count of unresolved local graph neighbors: primary relations count more than secondary or tertiary relations. Relation diversity separately rewards candidates that connect several local structural explanations. This is a deterministic local proxy, not Shannon information gain and not a probability.

### Novelty and repetition

Cold and sparse sessions receive a bounded novelty benefit across pair, suited-Ace, offsuit-Ace, broadway, suited connector/gap, weak-suited, connected-offsuit, and trash-offsuit families. Direct family coverage and the last eight questions reduce novelty. The last six questions also apply a stronger penalty to primary/secondary neighbors and a smaller same-family penalty.

Skipped and “not sure” hands are excluded for the rest of the current session unless exhaustive mode is selected. Neither creates strategy evidence. A retracted answer is deliberately eligible again.

### Exact-mix refinement

Candidates expose `exactMixRefinementValue`, band, and reason. High local boundaries receive the highest refinement value. This is future-facing explanation data: v1 keeps exact mix entry optional in the existing secondary modal and never treats refusal, Skip, or “I’m not sure” as numeric evidence.

## Cold start

The versioned bounded anchors are:

```text
AA, 72o, 77, A5s, AJo, T9s, K8s, Q9o, 44
```

They sample distinct structural families instead of walking AA, KK, QQ. They are learning anchors, not poker prescriptions or universal thresholds. As direct evidence appears, a stronger detected boundary can outrank the remaining anchors and normal adaptive ranking takes over.

## Profile readiness, stopping, and progress

User-facing intents map to deterministic question goals, not duration promises:

| Intent | Maximum session questions | Readiness behavior |
|---|---:|---|
| Quick | 5 | A short checkpoint; normally remains `building` |
| Standard | 30 | Stops early when the profile-readiness gates are met |
| Deep | 75 | Uses the same readiness gates but allows irregular profiles more evidence |
| Exhaustive fallback | 169 | Explicitly bypasses readiness until full direct coverage |

The preset maximums remain interaction budgets, not uncertainty calibration or wall-clock promises. Except for the explicit exhaustive fallback, readiness may end a Standard or Deep session before its maximum.

`rfi-profile-readiness/v1` is derived for one exact Profile × Mode × objective RFI context. Its states are `building`, `ready`, `refining`, and `conflicted`. Readiness requires all of the following:

- a stability-adjusted minimum of informative direct answers;
- direct evidence across enough structural hand families;
- at least one direct sample in premium/strong, pair, suited, offsuit, and weaker-boundary regions;
- enough direct plus local high/medium inference plus compatible transferred coverage;
- enough reliable local direct/high support plus strong/moderate transfer;
- no unresolved direct contradiction.

Unknown/stable scopes start with 15 direct, 45 modeled/transferred, 28 reliable, and six-family gates. A naturally mixed local boundary raises the direct/family gates to 24/seven while retaining the 45/28 modeled/reliable gates. An unstable scope requires materially more evidence: 36 direct, 65 modeled/transferred, 45 reliable, and eight families. These are bounded product heuristics validated against the existing synthetic fixtures, not confidence calibration, poker correctness, or solved-GTO evidence.

Progress returns exact snapshot categories:

- direct;
- inferred high;
- inferred medium;
- uncertain;
- conflicting;
- unknown;
- compatible transferred;
- modeled or transferred total;
- readiness state, blocker reasons, structural family/region coverage, and major unexplored regions;
- attempted coverage (`direct + inferred high + inferred medium`);
- high-quality coverage (`direct + inferred high`);
- current next-question value and at most six recommended clarifications.

The UI keeps these categories separate and never collapses them into a confidence percentage.

Supported stop reasons are:

- `user_time_budget_reached`;
- `target_coverage_reached`;
- `low_remaining_question_value`;
- `no_useful_candidates`;
- `user_paused`;
- `user_stopped`;
- `full_direct_coverage`;
- `conflict_resolution_needed`.
- `profile_ready`.

Automatic readiness means “useful starter approximation,” not “range perfect.” It deliberately interrupts question flow with “Your starter profile is ready,” Direct answers, Modeled hands, Uncertain regions, Recommended clarifications, and Review profile / Continue refining / Stop for now actions. “Continue refining” starts one derived batch capped at the current recommended clarification count and therefore at six questions. Each answer or skip consumes one batch allowance; exhausting the allowance returns to the summary before another batch can begin. Before readiness, “Continue questions” can still grant one additional question after a time budget. Pause and Stop preserve source progress. Exhaustive mode retains the canonical all-169 path for advanced/debug/test use; the 169-cell Matrix remains an inspection/edit surface rather than Calibration progress.

## Persistence, resume, and sync

The additive v1 session cursor may preserve:

- selection and stopping policy versions;
- calibration intent;
- asked, skipped, and not-sure hand histories;
- session question count and one-question override allowance;
- whether targeted refinement is active;
- the current refinement batch size and remaining allowance;
- last stop reason;
- a forced hand after undo;
- the existing `nextPromptIndex` meaning.

No candidate score, ranking, inferred chart, or progress snapshot is persisted. Old v1 sessions containing only `nextPromptIndex` remain valid and are upgraded through the application service.

One accepted answer uses the existing atomic repository transaction to append exactly one observation and update the session cursor. The application previews that observation through the canonical 002B snapshot plus the same bounded transfer inputs to choose the next cursor before the transaction, then invalidates and recomputes the durable scope after commit. There is no second answer write or duplicate persistence path. No durable evidence, IndexedDB, sync, export, or Supabase schema changed for readiness.

Session sync carries only source/session facts. Device B merges immutable evidence and deterministic cursor histories, then recomputes its snapshot and next candidate. Remote contradictions remain source conflicts and are never replaced by a synced ranking.

## Product surface

Range Calibration now exposes:

- Quick, Standard, and Deep question-count goals;
- a compact “Why this hand?” reason;
- optional exact frequencies, Skip, and “I’m not sure”;
- Pause and Stop for now;
- a compact `Building your profile` / `Your starter profile is ready` / `Refining your profile` / conflict-review state;
- direct, locally inferred, transferred, uncertain, unknown, and conflicting counts;
- direct plus modeled/transferred summary and at most six recommended clarifications;
- a truthful checkpoint with Continue questions/refining, Open Teacher, Open Matrix, and Stop for now.

The EN/RU/HE UI explains that Riverline selects informative hands, all 169 are not required, direct answers remain the user’s, exact mixes are optional, and inferred/transferred/uncertain categories are derived rather than confidence percentages. Completion has no remaining-cell or 169-survey progress semantics.

## Validation

The comparison reuses all eight accepted 002B synthetic fixtures, fixed seed labels 17/43/89, and equal budgets 10/20/30/40/50/75. Selection sees only evidence revealed by previous questions; a held-out-label mutation test proves question order cannot use hidden truth. Because the production selector is seed-free, fixed seed replications intentionally produce identical sequences.

The interpretable boundary metric is the fraction of target hand classes on a matrix-adjacency action boundary that were directly asked. The efficiency proxy is unique initially-unresolved hands that become inferred high/medium plus twice the number of directly discovered truth-boundary hands, divided by questions. It is not Shannon information gain.

Full results and limitations are in `RANGE_CAL_002C_VALIDATION_REPORT.md`. Reproduce them with:

```powershell
node tests/tooling/evaluate_range_cal002c.mjs
```

Quick-profile readiness and active clarification have focused deterministic coverage in `tests/playstyle_quick_profile001.test.mjs` and the Calibration session suite. Smooth-tight and smooth-loose fixtures reach readiness at 15 adaptive answers with respectively 66 and 82 locally inferred hands in the current deterministic run; the irregular fixture, an explicit unusual hole, and a 30-answer single-family input abstain where required. The suite also covers distributed family sampling, inferred interiors, boundary priority, transfer contribution and suppression, local/donor disagreement, contradiction blocking, derived-only output, scope switching, the explicit starter checkpoint, no 169-completion semantics, and a complete bounded refinement batch.

## Limitations and 002D integration

- Synthetic targets validate deterministic mechanics, boundary seeking, and known failure behavior; they are not poker correctness or real-user calibration evidence.
- The deliberately irregular fixture still produces a few low-quality medium attempts at intermediate budgets, then fully abstains at 75; it produces no high-band predictions.
- Conflicts are surfaced and excluded from ordinary questioning, but writable multi-head resolution remains deferred.
- Exact-frequency inference and combo-specific calibration remain unavailable.
- Question budgets and thresholds require real-user usability and corpus validation before stronger product claims.
- Firefox visual/manual acceptance is tracked separately from deterministic structural tests.

`RANGE-CAL-002D` now consumes the existing `PersonalStrategySnapshot v1` estimates/support/provenance/evidence IDs together with ranked candidate status, question value, boundary indicators, exact-mix refinement facts, and reason codes through `personal-strategy-matrix-projection/v1`. The Matrix follows the current prompt by default, can request an ordinary selected candidate as the next resumable question, and recomputes after a direct correction. Ranking remains session-derived and is neither persisted nor synced; Matrix inspection does not implement a second inference engine. See `PERSONAL_STRATEGY_MATRIX_SPEC.md`.

`RANGE-BUILDER-001` uses the same interoperability rule for grouped edits. After one atomic Builder commit, the exact scope is invalidated once, the shared snapshot is recomputed, and an active Calibration state reranks from durable current heads. Newly direct Builder hands disappear from ordinary candidates; session question history is not rewritten and no Builder selection/preview/ranking is persisted. See `RANGE_BUILDER_SPEC.md`.

`RANGE-TEACHER-001` adds `adaptive-rfi-selection-intent/v1` as a deterministic bias inside this same ranking authority. General preserves canonical 002C behavior; boundary, sparse, conflict-review, and exact-mix intents adjust priority only from existing candidate facts. Teacher presets persist these cursor facts in the existing resumable Calibration session, while recommendations, clusters, and dismissals remain derived/ephemeral. No second selector, evidence path, or stopping authority is introduced. See `RANGE_TEACHER_SPEC.md`.
