# Training Memory v1 specification

Status: accepted bounded evidence/re-drill checkpoint for `TRAINING-MEMORY-001`, August 26, 2026; authentication-owner isolation is human/security accepted under `AUTH-TRAINING-MEMORY-001`, and source-trust persistence/comparison gating is accepted under `STRATEGY-TRUST-001`, August 31, 2026. Baseline/remediation semantics remain reopened under `HEURISTIC-BASELINE-TRUTH-001` / `TRAINING-NORMATIVE-001`.

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
- the exact `StrategyResult v1` shown at answer time, including source descriptor/version, coverage, capabilities, distribution, provenance, limitations, and the durable effective-authority snapshot (source ID/version/fingerprint where available, accepted authority/capabilities/coverage, validation status, and acceptance decision identity);
- the resolved `StrategyClaimPolicy v1` from that time;
- the internal deterministic Training evaluation as internal evidence;
- a public comparison state: `matches_reference`, `close_to_reference`, `differs_from_reference`, `unsupported`, or `unavailable`.

Internal modal-distance grades remain descriptive compatibility evidence. New heuristic records have no reference-comparison permission: their legacy comparison field is unavailable, while `internalEvaluation.truth` preserves explicitly named heuristic agreement/disagreement. The additive `strategy-truth/v1` snapshot freezes source/assessment identity, context/action, permitted claims, assessment outcome, reasons and learning eligibility. Only an accepted action-set criterion can authorize supported/unsupported outcomes; source acceptance alone cannot. See [Strategy Source Authority](STRATEGY_SOURCE_AUTHORITY_SPEC.md).

Historical snapshots are validated without consulting current registries. Existing records are neither rewritten nor upgraded; legacy reference-comparison names remain readable but cannot create normative assessments or automatic remediation. No new schema/store/index/database migration is introduced by the truth gate.

Study metadata is user-authored and distinct from source truth: `review`, `difficult`, `important`, and `myMistake`. `TRAINING-INTELLIGENCE-001` adds optional pre-reveal uncertainty on ordinary Varied/Focused answers through `training-decision-record/v1.1` / `training-learning-evidence/v1`; legacy v1 records are unchanged. The action and assessment remain separate. A distinct ungraded abstention is preserved for later implementation, never mapped to Fold or Skip. See [Training Intelligence v1](TRAINING_INTELLIGENCE_V1_SPEC.md).

### `training-session-record/v1`

A session record stores its stable ID and owner, future-compatible mode, start/end timestamps, active/completed/abandoned status, requested length, uint32 session seed, exact planner intent and stable intent identity where present, Focused/re-drill facts, selected-provider runtime semantics, ordered decision IDs, and at most one Full Hand replay source.

When a user requests a new Training session while the current session is active or otherwise unfinished, presentation must confirm the transition. Acceptance finishes the existing canonical session as `abandoned` before starting the replacement; recorded decisions remain in Training Memory. Cancellation leaves the active session untouched. No UI-only abandoned flag or destructive reset is permitted.

Accuracy is not a session field. Session summaries are derived from ordered DecisionRecords. The storage wrapper maintains a replaceable summary cache containing shown/answered counts, public comparison counts, source-and-version identities, and review count.

## Store, derive, and cache classification

| Class | Facts |
|---|---|
| Store durably | ownership and IDs; timestamps/status/order; exact PokerState or Full Hand replay reference; DecisionContext; legal actions/sizing bounds; generator/planner replay identity; response; frozen StrategyResult, effective source-authority snapshot/acceptance decision identity, and ClaimPolicy; study metadata; review lifecycle |
| Derive deterministically | public review reasons; priority; session summary; similarity dimensions/envelope; cards/board/position/source presentation; exact same-spot state from stored canonical evidence |
| Cache/recompute | per-session summary cache and UI formatting; bounded recent/due list projections |

Presentation strings, hand-category prose, UI tags as poker inference, fake accuracy/mastery, and redundant Full Hand snapshots are not durable truth.

## Local-first persistence and ownership

Training Memory retains its own IndexedDB database, `riverline-training-memory`, version 1, and unchanged historical decision/session schemas. Slice B resolves the current lifecycle `training_memory` domain binding; its stable `domainOwnerRef` supplies persisted owner indexes independently of the current identity kind. Existing account references are preserved. Slice C Move preserves the same Guest persisted owner reference when its identity becomes authenticated; no historical session or decision record is rewritten. Missing or incompatible stable bindings block promotion.

Owner indexes are storage invariants, not authorization. The bridge preserves the accepted authentication/owner generation model and adds current lifecycle-scope validation. Account access requires the matching authenticated profile; Device Guest receives only its own durable local Memory. Bootstrap ordering remains recoverable. Auth/identity transitions synchronously clear owner-sensitive Memory presentation and invalidate stale reads, lazy decisions, Same Spot, Similar Spot, review actions, mixed panel reads, and queued intents. In-flight writes carry an abort signal; IndexedDB aborts and deterministic memory storage discards staged writes. Existing bytes survive denial and are available only to the same current owner. No remote work, sync, export UI, or new Home history projection is added.


Stores and important indexes:

- `metadata`: database and record versions plus monotonic revision;
- `sessions`: `ownerStartedAt` and `ownerStatusStartedAt`;
- `decisions`: `ownerSessionOrdinal`, `ownerCreatedAt`, `ownerReviewStateDueAt`, and `ownerSimilarityAnsweredAt`.

Version-1 migration creates missing stores/indexes without deleting other data. Shown-decision append atomically writes the decision and extends the ordered session; answer/metadata/review updates atomically replace the decision and session summary cache. An unsupported database/record version or owner mismatch leaves existing history untouched.

## Review queue and lifecycle

The bounded Intelligence extension reuses this lifecycle for explicit uncertain
revisit requests: a request schedules 24 hours later, with Practice now, Snooze
and Stop reminding controls. The new lazy recommendation projection consumes
only those requests and sorts by due time/ID; it does not inherit the legacy
comparative weights below. Exact revisits retain historical source evidence,
hide previous answers/hints, and keep ordinary stats/planner progress unchanged.
Only a persisted linked answer resolves a still-matching request, without any
retention, correctness, or transfer claim. Record-version metadata advances
atomically to v1.1 on the first extended write; no database/store/index migration
or historical rewrite occurs. Human browser acceptance remains pending.

The queue is derived from frozen truth and explicit study intent:

- accepted normative unsupported outcomes with explicit remediation permission;
- manually marked Review, Difficult, Important, or My mistake;
- explicit uncertainty/revisit requests.

Heuristic or accepted-reference disagreement, closeness, and unavailable comparison do not create automatic reasons. Old evidence and lifecycle bytes remain preserved; reasonless historical entries are excluded from due queries and have zero priority. Deterministic user/accepted-remediation weights, bounded age and prior-review counts order eligible items; priority is not skill or mastery.

Lifecycle states remain `none`, `pending`, `reviewed`, and `snoozed`. Done preserves evidence; Review tomorrow and Review again preserve the existing reversible workflow. Unsure -> explicit Revisit -> Why it returned continues when assessment is unavailable.

Session summaries partition heuristic comparison, accepted-reference comparison, normative permitted outcomes and unassessed participation. Presentation shows meaningful groups only and no universal accuracy/alignment rate.

## Same Spot

Same Spot reconstructs the exact canonical decision:

- generated decisions reuse the frozen PokerState, DecisionContext, legal actions, cards, rules, positions, stacks, price, and source result;
- Full Hand decisions reconstruct their exact pre-action frame from the one session-level canonical replay source.

The v1 comparison is explicitly `historical`: it uses the frozen original StrategyResult, durable answer-time authority metadata, ClaimPolicy, and the frozen assessment/truth snapshot when present. It never silently substitutes today's provider, reauthenticates a lost process-local acceptance token, upgrades an old record, or re-grades authority during Same Spot.

For the current alpha, Same Spot is a standalone Training Memory re-drill that starts only while ordinary Training is idle. It creates one temporary `review` Memory session for one decision, is neither Focused Drill nor planner-backed, and completes or abandons that review session before returning to ordinary idle Training. When an ordinary Varied, Focused, or Full Hand session is active, entry is prevented with natural explanatory copy without replacing, suspending, or abandoning that session. Riverline has no suspended Training snapshot, restore machinery, or Return-to-session path. Frozen `Earlier answer` / `This try` and `Historical heuristic baseline` / `Historical selected reference` evidence remains distinct, and the re-drill changes neither ordinary Training headline statistics nor planner progress.

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

One Training Memory session represents one Full Hand. Its Hero DecisionRecords reference exact replay points; one evolving session-level canonical replay source is retained. Exact action amount-to is recorded and supplied to the shared evaluator; normative assessment additionally requires accepted exact sizing coverage. Ordinary action-only answers abstain when the criterion needs a concrete size. Memory writes do not replace or alter the Full Hand controller, Hero journal, Replay, or shared Review.

## UI, accessibility, and localization

Training hosts a lazy Training Memory disclosure with Review queue and Recent sessions tabs. Session decisions load only when a session is expanded. Review rows expose cards/board, context, original action, source/version, coverage, public comparison, and explicit reasons. Actions support Done, Review tomorrow, Same Spot, and Similar Spot. Post-answer Review and Difficult toggles are reversible.

The surface uses semantic lists/disclosures/tabs/buttons, keyboard-native controls, shared visible focus, EN/RU/HE copy, logical CSS properties, RTL layout, and LTR poker/source islands. Review reasons are textual rather than color-only.

Saved remains intentional bookmarking; Training Memory remains automatic encountered-decision evidence. V1 does not add Home, Saved payload, Replay/Analyze, Personal Strategy, natural-language, or sync integration.

## Performance and limits

No history query runs at normal startup. Opening the panel performs bounded indexed reads: up to 12 due items, 10 recent sessions, and 25 decisions for an explicitly expanded session. There is no polling and no hidden StrategyProvider, Equity, range, or Matrix work. Same/Similar Spot resolves strategy only after explicit user activation.

V1 limitations and return points:

- manual Firefox acceptance at 1920x1080 and 1366x768 for EN, HE RTL, representative RU, and Full Hand remains open;
- advanced spaced/adaptive scheduling, saved drills, rich filters/trends, Home/Replay/Analyze continuity, export/import, sync, and Personal Strategy opt-in are later tickets;
- current source coverage remains a generalized exploratory/comparative heuristic baseline because no production reference pack is registered;
- authentication-gated owner isolation and explicit sign-out inaccessibility are accepted under `AUTH-TRAINING-MEMORY-001`; Slice B adds durable Device Guest ownership and awaits human acceptance; Slice C adds journaled promotion with the same persisted owner binding and pending human acceptance;
- heuristic disagreement must stop creating automatic remediation under `HEURISTIC-BASELINE-TRUTH-001` / `TRAINING-NORMATIVE-001`;
- Optional pre-answer uncertainty and explicit delayed exact revisits are implemented under `TRAINING-INTELLIGENCE-001`; the separate abstention path remains future work.

Focused automated coverage is in `tests/training_memory001_foundation.test.mjs`.
