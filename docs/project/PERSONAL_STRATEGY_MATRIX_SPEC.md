# Personal Strategy Matrix specification

Status: implementation authority for `RANGE-CAL-002D`

Last updated: August 18, 2026.

## Role and authority

The Personal Strategy Matrix is the compact inspection and correction surface for one exact Personal Strategy scope: Profile, Mode, and objective RFI context. It consumes the accepted `RANGE-CAL-002B` evidence view and `PersonalStrategySnapshot v1`, plus `RANGE-CAL-002C` candidate and boundary facts. Sparse immutable evidence remains durable truth; the Matrix is a derived read model and never a second strategy or range store.

`RANGE-INTELLIGENCE-003A` may additionally supply a matching `personal-strategy-rfi-transfer-projection/v2`. A transferred cell retains its underlying local status, uses a distinct `T`/Transferred provenance state, carries donor relationship/evidence facts, and remains qualitative. Local direct, inferred, uncertain, and conflicting states take precedence. See `RANGE_CONTEXT_TRANSFER_SPEC.md`.

The existing Playbook Matrix is intentionally separate. It samples a representative available combo from `StrategyProvider v1` and presents provider-backed preflop reference context. The Personal Strategy Matrix neither reads those cells nor calls StrategyProvider. The two surfaces answer different questions and must not be labelled or wired as the same authority.

## Projection contract

`createPersonalStrategyMatrixProjection(...)` produces `personal-strategy-matrix-projection/v1` from one matching snapshot/evidence revision. `getPersonalStrategyMatrixProjection(scope, { session })` obtains one projection bundle for the visible scope and attaches ranked-question facts without per-cell repository requests.

The projection contains exactly the canonical 169 hand classes in 13×13 order. Every cell exposes:

- hand class, row, column, and canonical index;
- one of `directly_known`, `inferred_high`, `inferred_medium`, `uncertain`, `conflicting`, or `unknown`;
- provenance separately from action presentation;
- action kind (`fold`, `raise`, `mixed`, `conflict`, or `none`), dominant action, optional exact frequencies, and precision;
- source IDs, active direct heads, bounded immutable history, retractions, superseded records, and separately labelled Training observations;
- versioned reason codes, uncertainty/support facts, selected neighboring evidence, and 002C candidate/boundary facts;
- a sparse combo-override indicator without materializing 1,326 combos.

The projection cannot expose inclusion-range `weight`. Dominant-only action is qualitative and retains `exactFrequencies = null`. Exact pure, exact mixed, and tied exact mixed values remain distinct.

## Visual semantics

Action and evidence status are orthogonal:

- Fold/Raise/mixed fill communicates the modeled action only.
- `D`, `H`, `M`, `?`, `!`, and `·` markers, distinct borders/patterns, and accessible text communicate direct, inferred-high, inferred-medium, uncertain, conflict, and unknown status.
- An exact-frequency band appears only for explicit exact mixes.
- Conflict is never averaged into a fake mix.

The legend names all six states and explains that action fill is not provenance. Filters for All, Direct, Inferred, Uncertain, and Conflicts dim non-matching cells without changing the underlying projection.

## Inspector

The selected-cell inspector presents the current action semantics, status/provenance explanation, uncertainty and boundary facts, question rank/value category, reason codes, actual contributing neighboring records, active direct evidence, bounded correction history, conflict state, and combo-override presence. Inferred categories remain ordinal; no confidence percentage or fabricated frequency is shown.

The Matrix follows the active adaptive question by default. Manual cell selection disables follow mode until the user explicitly resumes it. “Ask this next” changes only the resumable session cursor and creates no strategy evidence.

## Corrections and exact mixes

`recordPersonalStrategyMatrixEvidence(activeState, edit)` is the reusable single-cell application write seam. It accepts one scoped hand and either a dominant Fold/Raise action or an exact Fold/Raise mix, loads the selected current direct head once, appends a canonical `RangeObservation v1`, links it through `supersedesObservationId`, invalidates only that scope, and recomputes through the shared projection service. Renderer code never writes repository records or snapshots.

Confirming an inference passes its categorical dominant action through this seam. The new direct observation is dominant-only and has null frequencies. Changing a cell uses the same correction lineage. The shared exact-mix dialog stores explicit frequencies through existing canonical normalization, including pure and tied values.

Multiple incompatible active heads remain visible as conflict. 002D does not introduce a schema migration or multi-head resolution transaction: changing a conflicting cell corrects the selected current branch and preserves other independent evidence, so the conflict may remain. No “Resolve” claim is made.

Local/account mutation notification contains the new source observation only. Derived snapshots, estimates, selected neighbors, ranking, and Matrix projections are never synced or persisted as evidence.

## Calibration integration

An active adaptive answer and its Matrix share the same projection bundle in `calibrationState()`. Outside an active session, configuration loads one Matrix projection for the selected scope. A correction updates both the Matrix and active calibration state immediately; profile, mode, or objective context changes select a new isolated projection and cannot leak stale cells.

## Accessibility, responsive behavior, and i18n

The grid uses one roving tab stop. Arrow keys move by row/column; Enter or Space selects; focus is visible; and each cell label includes hand, status, and action. Exact mixes and conflicts are announced in text. The shared modal traps focus, closes with Escape, and restores focus.

Compact cells, a bounded grid scroll region, and an adaptive side/below inspector avoid horizontal page overflow at laptop sizes. Card/rank notation and the matrix remain LTR islands in Hebrew while inspector prose follows document RTL. Static and dynamic copy is supplied in EN, RU, and HE. Reduced-motion preferences remain binding.

## Performance

- one snapshot/evidence bundle is fetched per relevant projection update;
- there are no 169 independent async or repository calls;
- the hidden Calibration workspace does no Matrix render or projection work;
- selection uses the in-memory projection;
- inspector facts come from the selected cell;
- no StrategyProvider, Equity, or eager combo expansion participates;
- instrumentation records projection preparation, selection, correction-to-recompute, and scope-switch time.

## `RANGE-BUILDER-001` integration

Builder reuses the versioned 169-cell projection, action/mix presentation, scope contract, selected-hand identity, inspector, and combo-override marker. `applyRangeBuilderOperation(...)` collects canonical classes and commits one bounded repository batch with explicit `range_builder` provenance/action grouping; it does not loop `recordPersonalStrategyMatrixEvidence(...)` or create a parallel table. Group undo appends canonical source corrections/retractions. Combo-override persistence remains deferred. See `RANGE_BUILDER_SPEC.md`.

## Known limits

- Fold/Raise unopened-preflop scope only;
- no inferred exact frequencies;
- no writable multi-head conflict resolution; Builder skips ambiguous/conflicting heads;
- combo overrides are indicator/readiness data only;
- synthetic inference validation is not poker correctness evidence;
- automated structure and browser checks do not replace outstanding human Firefox visual acceptance tracked in `QA_BACKLOG.md`.
