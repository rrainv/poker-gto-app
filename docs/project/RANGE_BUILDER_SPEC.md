# Personal Strategy Range Builder specification

Status: implementation authority for `RANGE-BUILDER-001`; automated checkpoint, human Firefox QA open

Date: August 18, 2026

## Role and authority

Range Builder is the advanced manual editor for the same exact Personal Strategy scope used by Calibration and the Personal Strategy Matrix:

```text
Profile × Mode × CalibrationContext v1 (preflop RFI)
                         |
                         v
              immutable RangeObservation v1
                         |
                         v
       evidence view -> inference -> shared Matrix projection
             |                            |
             +---- Calibration -----------+
             +---- Range Builder ----------+
```

It does not persist a 169-cell chart, inferred snapshot, selection, preview, brush state, or `HoldemWeightedRange`. It does not call StrategyProvider, Equity, solver, or Training. The initial action universe is exactly Fold/Raise over the canonical 169 preflop hand classes in an unopened RFI context.

## Evidence and provenance

Builder writes canonical immutable `RangeObservation v1` evidence through the existing repository. The v1 compatibility discriminator remains `provenance.type = direct_calibration`; additive source metadata distinguishes the direct-intent surface:

```text
provenance.source = calibration | matrix | range_builder
provenance.actionGroupId = stable logical Builder operation ID
provenance.undoesActionGroupId = prior Builder group ID | absent
```

Old records without `provenance.source` retain calibration semantics. IndexedDB stores the full record, portable export preserves additive fields, and Personal Strategy sync transports the full immutable evidence payload. No database, portable-envelope, or Supabase migration is required. Evidence-view projection exposes `calibration`, `matrix`, and `range_builder` separately, including group/undo references.

Derived Matrix, inference, candidate ranking, preview, and history summaries are never synced or persisted as source truth.

## Action semantics

| Builder operation | Durable dominant action | Durable exact frequencies |
|---|---|---|
| Dominant Fold | Fold | `null` |
| Dominant Raise | Raise | `null` |
| Pure Fold | Fold | Fold 1.0; zero Raise is normalized away by the canonical v1 factory |
| Pure Raise | Raise | Raise 1.0; zero Fold is normalized away |
| Exact Mix 25/75, 50/50, 75/25, or numeric | unique maximum or `null` on tie | normalized complete supplied Fold/Raise mix |

Dominant-only is qualitative and never means a pure frequency. A 50/50 exact mix has `dominantAction = null`. Exact inputs are direct user assertions; no neighbor-specific frequencies are inferred.

## Selection, painting, and preview

Selection is workspace-session state only. The Matrix supports:

- click for one selected cell;
- Ctrl/Cmd+click toggle;
- Shift rectangular range extension;
- click-drag rectangular selection;
- Select All, Pairs, Suited, and Offsuit structural helpers derived from canonical class identity;
- Clear Selection;
- one roving Matrix tab stop and arrow navigation;
- Space toggle, F/R dominant application, Enter inspection, Ctrl/Cmd+Z undo, and Escape cancellation/clear.

Paint Fold and Paint Raise collect touched canonical classes and display a non-authoritative preview. One pointer release invokes one command. Pointer movement never writes evidence. Toolbar hover preview and drag-touched markers are DOM/session state and cannot enter a snapshot or repository.

## Atomic bulk application

The reusable application API is:

```js
applyRangeBuilderOperation(activeCalibrationState, scope, {
  handClasses,
  operationKind,
  mix,
  actionGroupId,
})
```

The DOM-free service is `createPersonalStrategyRangeBuilder(...)` in `app/src/application/range-builder-service.mjs`. It:

1. canonicalizes and deterministically orders unique hand classes;
2. loads exact-scope evidence history and current/conflicting heads in bounded scope reads;
3. skips ambiguous/conflicting heads by default;
4. creates one immutable source record per accepted class with one `actionGroupId`;
5. commits all rows through `saveRangeObservationBatch(...)` in one IndexedDB transaction;
6. sends one mutation notification containing the source rows;
7. invalidates the exact scope once;
8. recomputes one shared snapshot/Matrix result.

Transaction failure aborts the whole batch. There is no renderer repository loop, one transaction per cell, per-cell sync kick, or per-cell inference refresh. Evidence creation order follows `PREFLOP_HAND_CLASSES` regardless of UI selection order.

## Correction and conflict policy

An ordinary Builder edit is an intentional correction of the selected current head. Its new record explicitly supersedes that head; history is retained. Editing an inferred, uncertain, or unknown cell creates a new direct root and causes the shared inference/candidate read model to recompute.

Any target with an additional synced head is treated as ambiguous and skipped, even if the current evidence view can presently reconcile those heads. This prevents a bulk replacement from silently creating or hiding a contradiction. The UI reports the number of skipped conflicts. `RANGE-BUILDER-001` does not introduce multi-head resolution or claim to resolve conflicts.

Clear Builder edit is available only when the selected current head has Builder provenance. It appends a Builder correction restoring the prior branch's semantic value, or a retraction when no prior active value existed. Unsupported selected cells are skipped and reported.

## Undo and operation history

`undoRangeBuilderOperation(activeCalibrationState, scope, operation)` atomically undoes the most recent current-session Builder operation. The operation token records only the accepted Builder evidence IDs and their previous selected heads. Undo first proves every Builder evidence ID is still the current head; it fails closed rather than retracting unrelated Calibration, Matrix, remote, or later Builder evidence.

For corrected cells, undo appends a copy of the prior semantic claim superseding the Builder record. For new cells, undo appends a retraction. This restores the prior modeled strategy while keeping immutable history. Every undo row shares one new group and references `undoesActionGroupId`.

The UI keeps at most 20 current-session descriptions such as “Dominant Raise on 12 hands” and “Undid 12-hand Builder edit.” History is presentation state; durable evidence already owns the audit trail. Redo is deferred.

## Calibration and Matrix interoperability

Builder receives and returns the same `personal-strategy-matrix-projection/v1` used by the inspector. If Calibration is active in the same scope, the application reloads its durable current leaves after a Builder commit, recomputes the canonical 002B snapshot, reranks 002C candidates, and returns a refreshed active state. A now-direct hand disappears from ordinary adaptive candidates. Matrix, Builder, and Calibration never exchange a separately stored chart.

Single-cell Matrix correction remains available through `recordPersonalStrategyMatrixEvidence(...)`; it now records explicit `matrix` provenance. Builder uses the grouped transaction rather than looping that single-cell method.

## Sync, account, and persistence

Personal Strategy remains account-gated. The existing Range Calibration workspace refuses Guest activation, so Builder creates no durable Guest strategy state. Local commit completes before sync notification. Builder evidence uses existing Personal Strategy outbox, retry, identity-generation cancellation, account isolation, portable export, and immutable remote reconciliation.

One Builder group may produce multiple immutable remote evidence operations because every evidence row retains stable identity. The local application issues one source-mutation notification for the group. No derived Builder state, Matrix, snapshot, selection, preview, history, or inference is synced. Device B pulls source rows and recomputes the same scope.

## Range Core and combo seam

Range Builder edits action strategy evidence. It does not edit scalar combo inclusion weights.

```text
HoldemWeightedRange weight != action frequency != inference uncertainty
```

An action-conditioned weighted range remains valid only from a known prior inclusion range and an exact action frequency. Dominant-only Builder evidence cannot become numeric range mass.

The shared snapshot retains `comboOverrides: []` and Matrix cells retain `hasComboOverrides`. Future combo editing fits as:

```text
class baseline + sparse canonical holdem-combo/v1 overrides
```

That future ticket must own target schema, IndexedDB/export/sync migration, conflict/correction semantics, and canonical combo validation. Class edits must not silently remove combo overrides. `RANGE-BUILDER-001` performs no eager 1,326-combo expansion.

## Accessibility, i18n, and RTL

The Builder toolbar, selection helpers, apply group, exact-mix inputs, Undo, selection summary, and feedback have programmatic labels or live regions. Selected state uses `aria-selected`, border, shadow, and a primary outline rather than color alone. Painting is fully replaceable by keyboard selection plus apply buttons.

Static and dynamic copy is supplied in EN/RU/HE. The Matrix and poker class tokens remain LTR islands; toolbar and explanatory prose follow document RTL. Responsive layout wraps the compact toolbar and moves the existing inspector below the Matrix at narrower desktop widths.

## Performance evidence

`node tests/tooling/benchmark_range_builder001.mjs` measured the in-memory deterministic backend on the implementation machine:

| Hands | End-to-end command | Evidence rows | Groups | Notifications | Invalidations | Snapshot recomputes |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 68.92 ms | 1 | 1 | 1 | 1 | 1 |
| 10 | 27.11 ms | 10 | 1 | 1 | 1 | 1 |
| 50 | 78.58 ms | 50 | 1 | 1 | 1 | 1 |
| 169 | 205.28 ms | 169 | 1 | 1 | 1 | 1 |

These are regression measurements, not universal browser latency promises. Real Firefox IndexedDB and visual responsiveness remain part of manual acceptance.

## Range Teacher reusable interfaces

`RANGE-TEACHER-001` can reuse, without a new data authority:

- `getEvidenceView(scope)` for source/provenance/history;
- `getStrategySnapshot(scope)` and `getInferenceSupport(scope, handClass)` for state, uncertainty, boundary facts, and evidence references;
- `getPersonalStrategyMatrixProjection(scope, { session })` for the 169-cell inspection model;
- `rankCalibrationCandidates(...)`, `getNextCalibrationQuestion(...)`, and `assessCalibrationProgress(...)` for deterministic question value and stopping;
- `recordPersonalStrategyMatrixEvidence(...)` for one deliberate confirmation/correction;
- `applyRangeBuilderOperation(...)` only when a Teacher workflow deliberately owns a grouped direct edit;
- `personal-strategy-evidence/v1.source.kind` and source action-group metadata for honest provenance.

Builder UI session history is not a Teacher input. Teacher consumes durable evidence and the shared derived contracts.

## Known limits

- preflop RFI Fold/Raise only;
- 169 class editing only; no combo editor;
- conflicts skip by default; no multi-head resolution;
- current-session undo only; redo deferred;
- no generic inclusion-range import/export, Saved Range, comparison, sharing, postflop, or provider integration;
- automated structure and deterministic application tests do not replace the requested human Firefox viewport/language acceptance.
