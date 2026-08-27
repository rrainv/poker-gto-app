# Training Memory v1 specification

Status: accepted implementation checkpoint for `TRAINING-MEMORY-001`, August 26, 2026. Manual Firefox acceptance remains routed debt.

## Purpose and authority

Training Memory is Riverline's local-first evidence history for decisions the active profile was actually shown and answered. It supports recent-session inspection, a transparent review queue, exact same-spot reproduction, and bounded similar-spot generation.

It is not a second Training, poker, strategy, Replay, Saved, identity, or Personal Strategy authority. The permitted direction is:

```text
canonical Training exercise or Full Hand decision
  -> training-decision-record/v1
  -> training-session-record/v1
  -> bounded history/review queries
  -> historical Same Spot or current-provider Similar Spot
```

The canonical generator still owns legal trajectories. `DecisionContext v1`, `StrategyProvider v1`, `StrategyResult v1`, and `StrategyClaimPolicy v1` retain their existing authority. Training Memory never writes observed answers into intended Personal Strategy.

## Durable contracts

### `training-decision-record/v1`

A decision record has a stable opaque ID, Riverline ownership reference, session ID, exercise ID, ordered session ordinal, shown/answered timestamps, mode, optional planner-intent identity, status, canonical decision evidence, response, frozen strategy evidence, user study metadata, and review lifecycle.

Generated exercises store one exact canonical PokerState snapshot, Hero identity, DecisionContext, legal action/sizing bounds, and a `training-generator-replay-identity/v1` containing the uint32 seed, exercise/generator version, policy version, and scenario request when the planner path supplied one.

Full Hand decisions instead store the hand/Hero identity, hand seed, and exact replay point. They do not duplicate the complete Hand source per decision.

Answered records store:

- the normally submitted canonical action and exact amount-to in milliBB when supplied;
- the exact `StrategyResult v1` shown at answer time, including source descriptor/version, coverage, capabilities, distribution, provenance, and limitations;
- the resolved `StrategyClaimPolicy v1` from that time;
- the internal deterministic Training evaluation as internal evidence;
- a public comparison state: `matches_reference`, `close_to_reference`, `differs_from_reference`, `unsupported`, or `unavailable`.

Internal grade and permitted public claim are deliberately separate. A heuristic internal `mistake` grade remains a comparative `differs_from_reference` record; it is not stored as universal poker truth. A future exactly covered validated reference can preserve its genuinely normative policy without rewriting older evidence.

Study metadata is user-authored and distinct from source truth: `review`, `difficult`, `important`, and `myMistake`. Training v1 has no `Not sure` action, so the existing product question remains open rather than being silently mapped to an action.

### `training-session-record/v1`

A session record stores its stable ID and owner, future-compatible mode, start/end timestamps, active/completed/abandoned status, requested length, uint32 session seed, exact planner intent and stable intent identity where present, Focused/re-drill facts, selected-provider runtime semantics, ordered decision IDs, and at most one Full Hand replay source.

When a user requests a new Training session while the current session is active or otherwise unfinished, presentation must confirm the transition. Acceptance finishes the existing canonical session as `abandoned` before starting the replacement; recorded decisions remain in Training Memory. Cancellation leaves the active session untouched. No UI-only abandoned flag or destructive reset is permitted.

Accuracy is not a session field. Session summaries are derived from ordered DecisionRecords. The storage wrapper maintains a replaceable summary cache containing shown/answered counts, public comparison counts, source-and-version identities, and review count.

## Store, derive, and cache classification

| Class | Facts |
|---|---|
| Store durably | ownership and IDs; timestamps/status/order; exact PokerState or Full Hand replay reference; DecisionContext; legal actions/sizing bounds; generator/planner replay identity; response; frozen StrategyResult and ClaimPolicy; study metadata; review lifecycle |
| Derive deterministically | public review reasons; priority; session summary; similarity dimensions/envelope; cards/board/position/source presentation; exact same-spot state from stored canonical evidence |
| Cache/recompute | per-session summary cache and UI formatting; bounded recent/due list projections |

Presentation strings, hand-category prose, UI tags as poker inference, fake accuracy/mastery, and redundant Full Hand snapshots are not durable truth.

## Local-first persistence and ownership

Training Memory uses its own IndexedDB database, `riverline-training-memory`, version 1, with backend schema `training-memory-indexeddb/v1`. It shares Riverline's existing active identity authority and `RiverlineOwnershipRef`; it creates no identity or account binding.

The supported local/Guest identity path is durable on the device. Authenticated-future identities use a distinct account owner key. All records and indexed queries are owner-scoped and fail closed on owner mismatch. There is no upload, implicit sync, or remote assumption. The JSON-compatible schemas preserve a future export/import seam, but no export UI is claimed.

Stores and important indexes:

- `metadata`: database and record versions plus monotonic revision;
- `sessions`: `ownerStartedAt` and `ownerStatusStartedAt`;
- `decisions`: `ownerSessionOrdinal`, `ownerCreatedAt`, `ownerReviewStateDueAt`, and `ownerSimilarityAnsweredAt`.

Version-1 migration creates missing stores/indexes without deleting other data. Shown-decision append atomically writes the decision and extends the ordered session; answer/metadata/review updates atomically replace the decision and session summary cache. An unsupported database/record version or owner mismatch leaves existing history untouched.

## Review queue and lifecycle

The canonical queue is derived from answered evidence and study metadata. V1 reasons are narrow and inspectable:

- differs from the selected reference;
- close to the selected reference;
- source comparison unavailable/unsupported;
- manually marked Review, Difficult, Important, or My mistake.

Lifecycle states are `none`, `pending`, `reviewed`, and `snoozed`. Done marks reviewed but preserves evidence; Review tomorrow creates a one-day due date; Review again returns an item to pending.

Priority is deterministic and transparent: explicit Review/Difficult/Important/My mistake weights, then difference/unavailable/close weights, plus bounded age, minus bounded prior-review count. It is not a mastery, skill, or ability-confidence score. Sophisticated spaced/adaptive scheduling is deferred to `TRAINING-MEMORY-002`.

## Same Spot

Same Spot reconstructs the exact canonical decision:

- generated decisions reuse the frozen PokerState, DecisionContext, legal actions, cards, rules, positions, stacks, price, and source result;
- Full Hand decisions reconstruct their exact pre-action frame from the one session-level canonical replay source.

The v1 comparison is explicitly `historical`: it uses the frozen original StrategyResult and ClaimPolicy. It never silently substitutes today's provider.

## Similar Spot

`training-similarity/v1` is a conservative envelope derived only from available canonical evidence. It records policy version, availability, target decision type, generator constraints, and named dimensions: Game Rules fingerprint, exact decision role when supplied, street, position relation, prior-action family, effective-stack bucket, requested sizing family, and historical source coverage.

Generation follows:

```text
DecisionRecord
  -> training-similarity/v1
  -> focused TrainingSessionIntent v1
  -> Training Practice Planner
  -> TrainingScenarioRequest v1
  -> canonical legal generator
  -> current StrategyProvider
```

The result is labelled `current`, names why it is similar, records which card/board dimensions changed, and retains the parent decision relationship when answered. It tries a bounded four deterministic seeds to avoid returning the exact same cards. If the minimum rules/target/table/position/street/stack envelope is unavailable, Similar Spot fails explicitly while Same Spot may remain available.

## Full Hand behavior

One Training Memory session represents one Full Hand. Its Hero DecisionRecords reference exact replay points; one evolving session-level canonical replay source is retained. Exact action amount-to is recorded, while current Full Hand grading remains action-family only. Memory writes do not replace or alter the Full Hand controller, Hero journal, Replay, or shared Review.

## UI, accessibility, and localization

Training hosts a lazy Training Memory disclosure with Review queue and Recent sessions tabs. Session decisions load only when a session is expanded. Review rows expose cards/board, context, original action, source/version, coverage, public comparison, and explicit reasons. Actions support Done, Review tomorrow, Same Spot, and Similar Spot. Post-answer Review and Difficult toggles are reversible.

The surface uses semantic lists/disclosures/tabs/buttons, keyboard-native controls, shared visible focus, EN/RU/HE copy, logical CSS properties, RTL layout, and LTR poker/source islands. Review reasons are textual rather than color-only.

Saved remains intentional bookmarking; Training Memory remains automatic encountered-decision evidence. V1 does not add Home, Saved payload, Replay/Analyze, Personal Strategy, natural-language, or sync integration.

## Performance and limits

No history query runs at normal startup. Opening the panel performs bounded indexed reads: up to 12 due items, 10 recent sessions, and 25 decisions for an explicitly expanded session. There is no polling and no hidden StrategyProvider, Equity, range, or Matrix work. Same/Similar Spot resolves strategy only after explicit user activation.

V1 limitations and return points:

- manual Firefox acceptance at 1920x1080 and 1366x768 for EN, HE RTL, representative RU, and Full Hand remains open;
- advanced spaced/adaptive scheduling, saved drills, rich filters/trends, Home/Replay/Analyze continuity, export/import, sync, and Personal Strategy opt-in are later tickets;
- current source coverage remains generalized heuristic fallback because no production reference pack is registered;
- `Not sure` remains an open product decision.

Focused automated coverage is in `tests/training_memory001_foundation.test.mjs`.
