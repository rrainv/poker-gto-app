# Unified Range Intelligence Architecture

Status: architecture authority for `PERSONAL-STRATEGY-ARCH-002`; implementation checkpointed through `RANGE-TEACHER-001`

Date: August 18, 2026

## 1. Purpose and decision summary

Riverline's Range Calibration, Personal Strategy Matrix, Range Builder, and Range Teacher must be different workflows over one range-intelligence model. They must not become separate range stores, inference engines, or strategy authorities.

The selected architecture is:

```text
immutable, source-specific evidence
                |
                v
normalized PersonalStrategyEvidenceView
                |
                v
conflict projection + deterministic inference + uncertainty
                |
                v
recomputable PersonalStrategySnapshot
  - 169 hand-class baselines
  - sparse exact-combo overrides
                |
                v
lazy 1,326-combo action-strategy view
                |
                +--> Calibration / Range Teacher
                +--> Personal Strategy Matrix
                +--> Range Builder
                +--> Training evidence adapter later
                +--> Analysis / Compare Spots later
                `--> StrategyProvider adapter only after a separate gate
```

The durable authority is sparse evidence, not a 169-cell Matrix, a 1,326-entry snapshot, an inferred chart, or `HoldemWeightedRange v1`. Derived output is versioned and reproducible from evidence, but is not recursively reused as evidence and is not synced as truth.

This ticket creates no production schema, runtime, provider, UI, or persistence migration. Existing v1 contracts and code remain authoritative until the follow-on ticket that owns a proposed contract implements, validates, migrates, and syncs it.

## 2. Current implementation checkpoint

### 2.1 Accepted tickets and behavior

| Ticket | Current result |
|---|---|
| `RANGE-CAL-000` | Versioned Personal Strategy domain: profiles, exactly three user-named modes, objective RFI context, direct observations, Training observations, resumable sessions, repository, validation, and portable export/import. |
| `RANGE-CAL-001A` | Lazy Range Calibration workspace, profile/mode selection and editing, and objective preflop RFI context builder. |
| `RANGE-CAL-001B` | Durable keyboard-first question loop over the canonical 169 hand-class order, one-click dominant Fold/Raise answers, optional exact Fold/Raise mix, undo/retraction, pause, and resume. |
| `RANGE-CAL-001BR` | Truthful exact-mix handling: normalization, exact ties with `dominantAction = null`, and no fabricated winner. |
| `RANGE-CAL-001C-A` | IndexedDB v2 repository with atomic answer/session transactions, immutable history, current-leaf indexes, recovery-safe legacy migration, and measured Firefox/Electron performance. |
| `RANGE-CAL-UI-001R` | Accepted Range Calibration product/interaction refinement. The full 169-question order remains fallback and test infrastructure. |
| `RANGE-CAL-002A` | Isolated deterministic sparse RFI Fold/Raise inference, explicit abstention, direct-evidence precedence, contradictory-head abstention, evidence references, and synthetic holdout evaluation. |
| `RANGE-CAL-002B` | Unified read-only evidence projection, explicit correction/compatible-head/conflict semantics, `PersonalStrategyEstimate v1`, 169-estimate snapshot, ordinal high/medium/uncertain/conflicting/unknown states, conservative local-graph inference, scope cache/application API, and eight-fixture deterministic validation. |
| `RANGE-CAL-002C` | Deterministic adaptive question-value ranking, structurally diverse cold start, boundary/sparsity/uncertainty targeting, repetition and skip control, category progress, explicit automatic stop reasons, resumable Quick/Standard/Deep intents, exhaustive fallback, and equal-budget comparative validation. |
| `RANGE-CAL-002D` | Snapshot-derived 169-cell Personal Strategy Matrix, separate action/provenance encoding, evidence/support inspector, dominant-only confirmation, exact-mix correction lineage, scope isolation, adaptive-question integration, and bounded accessible EN/RU/HE presentation. |
| `RANGE-BUILDER-001` | Same-Matrix class-level multi-selection/painting, dominant/pure/exact bulk edits, explicit Builder provenance/action groups, one atomic repository transaction/invalidation/recompute, conflict skip, semantic group undo, and immediate Calibration reranking. |
| `RANGE-TEACHER-001` | Derived Personal Strategy summary, deterministic boundary/sparse/conflict/exact-mix recommendations, focused 002C selection intents, and routing through existing Calibration, Matrix, and Builder actions without new durable truth. |
| `ACCOUNT-002B-B` | Opt-in Personal Strategy sync that preserves stable IDs, immutable direct and Training evidence, divergent offline heads, profile/mode metadata conflicts, and resumable sessions; inferred output is deliberately excluded. |
| `HOME-002A` | Lightweight Personal Strategy summary: profile count, direct-evidence count, answered hand classes, contradictory heads, and resumable calibration state. Home performs no inference or range math. |

### 2.2 Current code authorities

- `app/src/personal-strategy/domain.mjs` owns the implemented v1 profile, mode, RFI context, direct observation, Training observation, and calibration-session contracts.
- `app/src/personal-strategy/repository.mjs` owns current local durability, immutable history, selected and conflicting direct heads, export/import, and sync application.
- `app/src/application/range-calibration-service.mjs` owns adaptive answer/session orchestration, one atomic answer commit, pause/stop/skip/resume, and the explicit sequential exhaustive fallback.
- `app/src/application/range-calibration-workspace.mjs` is a UI consumer of that application service and does not implement inference.
- `app/src/personal-strategy/evidence-view.mjs` owns the source-preserving `personal-strategy-evidence-view/v1` and derived conflict projection. `app/src/personal-strategy/rfi-inference.mjs` owns the sole `deterministic-rfi-local-graph/v1` estimate/snapshot authority; its 002A request/result exports are compatibility adapters over that authority. `app/src/personal-strategy/projection-service.mjs` owns scope caching, answer preview through the same authority, and the repository-facing query API. `app/src/personal-strategy/rfi-question-selection.mjs` owns the DOM-free 002C ranking, explanation, and stopping policies.
- `app/src/application/range-builder-service.mjs` owns DOM-free Builder selection summaries/previews plus grouped apply/undo orchestration; `saveRangeObservationBatch(...)` in the canonical repository owns its all-or-nothing write. Builder UI remains a mode over the Personal Strategy Matrix and never accesses persistence directly.
- `shared/poker-domain/holdem-combos.js` and `holdem-range.js` own the 1,326-combo registry and `HoldemWeightedRange v1`.
- the current production Matrix in `app/src/core/logic.js` resolves one representative available combo per 169 class through `StrategyProvider v1`. It is not a Personal Strategy Matrix or range authority.
- canonical Training generates, grades, and presents against `StrategyResult v1`. A `TrainingObservation v1` repository contract exists, but no live per-session Training-to-profile adapter or opt-in UI exists.
- `RangeAnalysisFacts v1` can consume a caller-supplied `HoldemWeightedRange v1`; no current caller attaches Personal Strategy and Analysis does not accept an action-strategy snapshot.
- current sync serializes profiles, modes, direct observations, Training observations, and sessions. It does not serialize inference or a derived range.

### 2.3 Current limitations

- only preflop RFI is modeled, with the Fold/Raise action family;
- direct evidence is keyed by 169 hand class, not exact combo;
- adaptive question selection is the live default; the deterministic unanswered-hand walk remains only an explicit exhaustive fallback and test/debug path;
- 002B inference remains categorical only; exact direct mixes pass through, while inferred exact frequencies are deliberately unavailable;
- 002B validation remains synthetic mechanics evidence rather than real-user uncertainty calibration or poker-reference truth;
- deliberately non-local evidence is expected to produce near-total abstention; 002C adaptive validation preserves that behavior, while real-user corpora remain a future gate;
- synced contradictory heads are preserved, but there is no first-class conflict-resolution workflow;
- Personal Strategy now projects the accepted class-level snapshot into Matrix- and Teacher-specific read models; Analysis and provider consumers do not yet have a shared action-strategy attachment;
- class-level unified Range Builder and derived Range Teacher exist; combo overrides, imports/exports, comparisons, writable multi-head resolution, and richer Teacher history remain unavailable;
- no Training click mutates Personal Strategy in the current product;
- no personal source exists in `StrategyProvider v1` or its closed `StrategyResult v1` source vocabulary;
- Home intentionally shows direct facts and resume state only;
- the 169-class Personal Strategy evidence and combo-level Range Core are not yet connected by a semantics-safe application adapter.

## 3. Authority and dependency model

### 3.1 Layer ownership

| Layer | Owns | Must not own |
|---|---|---|
| Evidence domain | immutable user claims/observations, source, scope, timestamps, stable IDs, correction lineage | inference, confidence, Matrix presentation, provider output |
| Personal Strategy repository | durable local records, indexes, transactions, export/import, current/conflicting heads | poker math, UI state, inferred truth |
| Evidence view | lossless normalization of current and future evidence schemas for consumers | durable mutation or conflict deletion |
| Inference/uncertainty | deterministic estimates, abstention, reasons, evidence references, validation-backed uncertainty band | new evidence, universal poker truth, provider calls |
| Snapshot projector | one coherent class/combination action-strategy read model | persistence authority, recursive self-training |
| Range Core | physical combo identity, scalar inclusion weights, blocker conditioning, normalization, Matrix projection of weights | action strategy, inference certainty, intended-action evidence |
| Application services | commands, visibility, selection, caching, atomic evidence writes, question policy | poker evaluation or renderer-owned state authority |
| Surfaces | render, inspect, collect edits, explain provenance and uncertainty | direct repository access, duplicate range formats, inference math |
| StrategyProvider later | one decision-time source-selection seam | Personal Strategy persistence or Calibration workflow |

### 3.2 Authoritative flow

```text
Calibration answer / Matrix correction / Builder edit / opted-in Training answer / import
                                      |
                                      v
                         source-specific evidence record
                                      |
                                      v
                  Personal Strategy repository + sync boundary
                                      |
                                      v
                      PersonalStrategyEvidenceView v1
                                      |
                    +-----------------+------------------+
                    |                                    |
                    v                                    v
          conflict/correction projection       inference and uncertainty
                    |                                    |
                    +-----------------+------------------+
                                      v
                     PersonalStrategySnapshot v1
                                      |
                         consumer-specific adapters
```

`PersonalStrategyEvidenceView v1`, `PersonalStrategySnapshot v1`, and the other new contract names in this document are proposed follow-on contracts. They are not implemented by this architecture ticket.

## 4. Evidence model

### 4.1 Evidence is source-specific

Riverline should retain source-specific durable record schemas rather than persist one permissive generic bag. A normalized read view may unite them for projection.

| Input | Durable meaning | Authority for intended strategy | Initial projection policy |
|---|---|---:|---|
| Direct dominant-action calibration answer | deliberate preferred action; frequencies unknown | highest, explicit intent | direct qualitative point |
| Direct exact-frequency calibration answer | deliberate complete action-frequency vector for the supported action universe | highest, explicit intent | direct quantitative point |
| Direct Matrix correction/confirmation | deliberate inspection-time correction or confirmation | same as calibration; provenance remains Matrix | direct point; explicit lineage required |
| Direct Range Builder edit | deliberate manual strategy edit, class-level or later combo-level | same as calibration; provenance remains Builder | direct point or sparse combo override |
| Imported action strategy | external assertion until user deliberately adopts it | external by default; explicit intent only after adoption | reference-only or adopted direct events |
| Opted-in Training answer | observed behavior in one canonical Training decision | behavioral, not intended-strategy replacement | disagreement/question signal; excluded from 002B inference |
| Manual label/annotation later | commentary or explicitly labelled claim | none unless the record also carries a supported strategy claim | annotation only by default |
| Inferred result | reproducible estimate from evidence | not evidence | derived point only; never written back as an observation |
| Conflict marker | derived fact that active evidence cannot be reconciled automatically | not evidence | derived state with all evidence references |

### 4.2 Normalized evidence view

The proposed DOM-free `personal-strategy-evidence-view/v1` is a read model over implemented and future source records:

```text
schemaVersion
evidenceId
authority = intentional_strategy | observed_behavior | external_assertion | annotation
source
  kind = calibration | matrix | range_builder | import | training | manual
  sourceRecordSchema
  sessionId | null
  importId | null
scope
  profileId
  modeId
  contextKey
target
  kind = hand_class | combo
  id
claim
  kind = dominant_action | exact_action_mix | observed_action | annotation
  value
lineage
  supersedesEvidenceId | null
  resolvesEvidenceIds[]
occurredAt
recordedAt
```

This view is not synced or persisted. It retains references to the source records so export, audit, correction, and explanation can return to immutable evidence.

Current `RangeObservation v1` maps losslessly to `authority = intentional_strategy`, `source.kind = calibration`, and a hand-class target. Current `TrainingObservation v1` maps to `authority = observed_behavior`, `source.kind = training`. The adapter must not infer absent frequency detail, discard tied mixes, or change timestamps and lineage.

### 4.3 Authority is not confidence

Authority answers which kind of claim is allowed to determine the intended Personal Strategy model:

1. unsuperseded explicit-intent evidence from Calibration, Matrix, Builder, or an explicit adoption action;
2. external imported assertions when no adoption occurred, retained as a named reference rather than silently becoming the user's strategy;
3. opted-in Training behavior as a separate comparison signal.

Two explicit-intent sources at the same target have equal semantic authority. Recency alone does not choose between them. One replaces another only through explicit correction lineage. Training volume never silently outvotes one deliberate direct answer.

Confidence belongs only to a derived inference estimate. Direct evidence is known as a user claim, but a dominant-only direct answer still has unknown action frequencies.

### 4.4 Provenance and time

Every evidence record requires:

- globally stable ID;
- profile, mode, objective context, and target granularity;
- structured source kind and source schema/version;
- `occurredAt` for the user's action and `recordedAt` for durable acceptance when they differ;
- source session/import/batch references where applicable;
- correction or conflict-resolution lineage;
- canonical action identities, never localized labels;
- account owner inherited through the profile relationship.

Server receive time, sync order, display order, and localized names are not evidence order or authority.

### 4.5 Imported data

A plain `HoldemWeightedRange v1` import is an inclusion range, not an action strategy. It may be saved or compared as an external range, but cannot become Personal Strategy evidence without an explicit action semantic.

An action-strategy import must declare:

- the action universe and whether the mix is complete;
- the exact objective context;
- class or combo target semantics;
- whether values are exact action frequencies, dominant actions, or only range inclusion weights;
- source and validation status.

The product must offer separate actions equivalent to **Use as reference** and **Adopt into My Strategy**. Adoption creates explicit user-intent evidence referencing the immutable import; it does not mutate the imported source into direct evidence.

## 5. Strategic action model

### 5.1 Structured actions

Actions use canonical structured action identities from the poker domain. The initial RFI universe is exactly:

```text
Fold
Raise
```

Later decision families may allow:

```text
Fold
Check
Call
Bet
Raise
All-in
```

All-in remains a distinct canonical action where legal. A later sizing-aware strategy contract must use structured size fields or a versioned size abstraction. It must not parse labels such as "2.5x" or translated action names.

### 5.2 Strategy value variants

The proposed `personal-action-strategy-value/v1` is a tagged union:

```text
unknown

dominant_only
  dominantAction
  actionFrequencies = null

exact_mix
  actionUniverse[]
  frequencies[]
  dominantAction | null
  mixCoverage = complete
```

Rules:

- `dominant_only Raise` never means `Raise = 1`;
- unknown action weights are represented by `actionFrequencies = null`, not zeros;
- an exact mix covers the complete action universe for that decision family, including explicit zero actions where appropriate;
- exact probabilities are non-negative, normalized to one, and keyed by structured actions;
- a unique maximum supplies the matching dominant action;
- an exact maximum tie has `dominantAction = null`;
- omitted actions in a dominant-only claim remain unknown, not known zero;
- 002B may infer only a dominant action in v1; it must not manufacture an exact mix from categorical evidence.

## 6. Canonical strategy representation decision

### 6.1 Options evaluated

| Option | Strengths | Failures |
|---|---|---|
| A. Persist 169 class action distributions | compact, fast Matrix, matches current RFI evidence | cannot express suit/combo differences; blockers and combo-aware consumers need another authority |
| B. Persist all 1,326 combo action distributions | exact combo addressability and simple reads | large repetitive writes, poor sparse/unknown semantics, stale derived output risk, unnecessary sync cost |
| C. Persist sparse evidence and derive a combo-level model | immutable truth, recomputable inference, efficient sync, uncertainty preserved | needs an explicit derived snapshot and deterministic materializer |
| D. Persist class baselines plus combo overrides as canonical state | compact and combo-capable | becomes a second mutable truth beside evidence and can drift after correction or algorithm changes |

### 6.2 Selected architecture: C, with D as a derived snapshot

Personal Strategy persists sparse evidence. A versioned projector derives `personal-strategy-snapshot/v1`:

```text
schemaVersion
scope
  profileId
  modeId
  context
  contextKey
actionUniverse[]
evidenceRevision
  activeHeadIds[]
  fingerprint
derivation
  evidenceViewVersion
  conflictPolicyVersion
  inferenceAlgorithmVersion
  uncertaintySemanticsVersion
classBaselines[169]
comboOverrides[]
summary
  directCount
  inferredHighCount
  inferredMediumCount
  uncertainCount
  conflictingCount
  unknownCount
```

Each strategy point contains:

```text
target
resolutionState
strategyValue
evidenceReferences[]
derivationReason
uncertainty
```

The snapshot's 169 class baselines are efficient for RFI inference and Matrix presentation. Sparse exact-combo observations override the class baseline only for their physical combo. The 1,326-combo view is materialized lazily from the canonical combo registry when a combo-aware consumer requests it.

The snapshot is a cacheable read model, not evidence. Initial implementations should keep it in memory. A future persisted cache is allowed only after measurement, and must be keyed by evidence fingerprint plus every derivation version, disposable, excluded from sync/export truth, and safe to rebuild.

### 6.3 Class and combo semantics

- a hand-class direct answer applies to all physical combos in that class unless a more specific combo override exists;
- a combo override does not contradict its class baseline merely because it differs; target specificity is intentional layering;
- a class edit does not silently delete combo overrides;
- clearing overrides requires an explicit command and immutable retraction events;
- Matrix class summaries retain a combo-deviation marker and exact combo detail so aggregation cannot erase overrides;
- inference initially operates at class level; it cannot invent combo differences without combo-specific evidence or a separately validated model.

## 7. Range Core relationship

### 7.1 Three distinct quantities

| Quantity | Meaning | Canonical owner |
|---|---|---|
| `HoldemWeightedRange` weight | scalar inclusion mass for one physical combo in a range | Range Core |
| action frequency | probability/frequency of choosing Fold/Call/Raise/etc. for a hand or combo | Personal action-strategy snapshot / later StrategyResult |
| inference uncertainty | how cautiously Riverline should treat a derived estimate under a versioned validation policy | Personal Strategy inference |

They must use different field names and tagged contracts. No generic `weight` or `confidence` field may cross these boundaries without an explicit adapter.

Example:

```text
A5s: Raise 0.70, Fold 0.30
```

is an action strategy. It is not automatically a `HoldemWeightedRange` with A5s weight `0.70`.

### 7.2 Legitimate action-conditioned conversion

An action-conditioned range may be derived only when both terms are quantitatively known:

```text
prior inclusion weight(combo)
  * exact action frequency(action | combo, context)
  = unnormalized action-conditioned combo mass
```

Requirements:

- the prior range has explicit known weights for the combos being projected;
- the action strategy has an exact complete mix, not dominant-only semantics;
- unknown or conflicting points remain unknown in the derived range;
- inference provenance and uncertainty propagate into the derived range source metadata;
- normalization follows existing complete-positive-mass Range Core rules;
- a uniform unit prior may be used only when the caller explicitly means the complete physical combo universe;
- no consumer silently treats a dominant Raise answer as 100% Raise inclusion.

Blocker conditioning and 169 weight projection remain Range Core operations after a valid action-conditioned `HoldemWeightedRange v1` exists. Personal Strategy does not duplicate those operations.

## 8. Context and key design

### 8.1 Separate objective context from personal scope

Profile and mode remain outside objective poker context.

```text
StrategySpotContext v1       objective strategic facts
PersonalStrategyScopeKey v1  profile ID + mode ID + context key
StrategicPointKey v1         scope key + target kind + target ID
```

This preserves the accepted Profile / Mode / Spot Context separation while allowing exact personal lookup.

### 8.2 Proposed objective `strategy-spot-context/v1`

Common fields:

```text
schemaVersion
gameVariant
gameRulesId
decisionFamily
street
tableSize
heroPosition
opponentCount | null
effectiveStack
  valueBb
  basis
accounting
  anteType
  anteBb
  forcedContributionPerPlayerBb
  rakeMode
priorAction
facing
board
```

Family-specific validation determines which fields are required:

- `preflop_rfi`: street preflop, unopened prior action, no facing wager, no board;
- later facing-open/facing-3bet families: structured prior action, raise-to amount, incremental call amount when trusted, and legal action universe;
- later postflop families: exact board, structured action path or a versioned abstraction, price facts, opponents, and street.

The key must preserve these distinctions:

- `facingSizeBb`/raise-to context is not `callAmountBb`;
- `tableSize` is seated players, not live opponents;
- unknown is `null`, not a default value;
- exact board cards use canonical card IDs, not UI labels or texture names;
- action history uses structured canonical facts, not localized summaries;
- effective-stack basis is explicit rather than assuming one scalar has identical heads-up and multiway meaning.

### 8.3 Compatibility with current context

Current `CalibrationContext v1` remains the durable RFI key. A future adapter maps it losslessly into `StrategySpotContext v1`. Historical evidence is not reinterpreted or rewritten. New context families require their own validated constructors and canonical serializers.

Exact objective facts should remain the primary evidence key. Stack buckets, board textures, action families, and other abstractions are derived inference indexes with their own versions; they must not replace exact historical facts silently.

## 9. Uncertainty semantics

### 9.1 Required states

Every projected strategic point uses one of:

| State | Meaning |
|---|---|
| `directly_known` | one non-conflicting current explicit-intent claim determines the point; this may still be dominant-only with unknown frequencies |
| `inferred_high` | a derived categorical estimate satisfies the versioned high-reliability validation policy for an applicable cohort |
| `inferred_medium` | a derived estimate satisfies a weaker but still measured policy |
| `uncertain` | evidence exists, but boundary risk, instability, insufficient validation, or disagreement prevents a reliable estimate |
| `conflicting` | current evidence contains unresolved incompatible claims |
| `unknown` | no supported direct or inferred value is available |

`directly_known` describes provenance, not poker correctness. `inferred_high` and `inferred_medium` describe a validation policy, not a universal posterior probability.

### 9.2 Ordinal bands first

V1 should use ordinal bands. It must not display values such as `0.873 confidence`.

An uncertainty result records:

```text
semanticsVersion
band
algorithmVersion
validationCohortId | null
policyThresholdId | null
reasons[]
```

002B must establish band eligibility from held-out evaluation and report attempted coverage separately from attempted accuracy. Synthetic validation can establish regression thresholds and expose failures, but it is insufficient by itself for a strong user-facing claim. Until a band has relevant validation, the output is `uncertain` or `unknown`.

A future numeric value is allowed only when its calibration target is explicit, for example empirical correctness among attempted categorical predictions in a defined cohort and algorithm version. It must not be called the probability that an individual hand is correct unless that interpretation has actually been calibrated.

## 10. Corrections, contradictions, and conflicts

### 10.1 Correction

A correction is deliberate lineage:

- the user edits the current claim from the same logical target;
- the new immutable event explicitly supersedes the selected current head;
- the prior record remains in history;
- undo is an immutable retraction that supersedes the prior leaf;
- a new answer after retraction starts from that retracted leaf.

Same-session timing alone does not make two records a correction. The lineage reference does.

### 10.2 Contradiction

A contradiction exists when unsuperseded active evidence for the same strategic target is incompatible, including:

- two independent direct roots or siblings that disagree;
- direct Calibration and direct Builder/Matrix claims that were not deliberately linked as a correction;
- a direct intended action and opted-in Training behavior that deviates;
- incompatible exact mixes outside a versioned equality tolerance;
- multiple independent synced heads.

Direct versus Training disagreement is inspectable even though direct intent remains the initial projection authority. It is not resolved by counting Training clicks.

### 10.3 Derived conflict projection

The proposed `personal-strategy-conflict/v1` contains:

```text
conflictId derived from stable evidence IDs
scope and target
kind
evidenceReferences[]
status = unresolved | resolved
resolutionEvidenceId | null
```

It is recomputed and is not evidence. Inference abstains for an unresolved direct conflict and may widen uncertainty around neighboring boundary points.

### 10.4 Resolving multiple heads

Current `RangeObservation v1` has one `supersedesObservationId`, so it cannot honestly merge several contradictory heads into one lineage. A future explicit conflict resolution must add a versioned additive resolution reference such as `resolvesEvidenceIds[]`, validated to contain all current heads for one logical target.

The resolution is another immutable direct-intent event. It may select one existing claim, provide a new dominant action, provide an exact mix, or retract the target. It never deletes the resolved evidence. Server time or last-write-wins must not fabricate this resolution.

Until that contract lands, 002B may detect conflicts and 002C may prioritize them for review, but an ordinary answer must not claim that all heads were resolved.

## 11. `RANGE-CAL-002B` — inference and uncertainty

Implementation checkpoint: completed by `deterministic-rfi-local-graph/v1`, with exact semantics and fixture/budget results in `RANGE_INFERENCE_SPEC.md` and `RANGE_CAL_002B_VALIDATION_REPORT.md`. Sections 11.1–11.5 remain the normative design constraints.

### 11.1 Scope

002B should convert the isolated research result into a deterministic, application-ready projection contract while remaining DOM-free and outside live Matrix, question selection, persistence, sync, Training, Analysis, and StrategyProvider.

Initial family remains preflop RFI Fold/Raise at 169-class granularity.

### 11.2 Inputs

- exact profile, mode, and canonical RFI context;
- all current direct-intent heads for that scope, including synced contradictory heads;
- current retractions and correction lineage;
- exact mixes where supplied;
- requested class or complete 169-class projection;
- explicit inference, conflict-policy, and uncertainty-semantics versions.

Training observations, previous inferred outputs, heuristic charts, StrategyProvider results, solver/reference ranges, and hidden synthetic labels are not 002B inputs.

### 11.3 Transparent features

The deterministic feature set may include:

- pair/suited/offsuit family;
- high-rank and low-rank indexes;
- gaps/connectivity;
- explicit ace/king indicators;
- orthogonal Matrix neighbors and wider local neighbors;
- nearby direct observations and their distances;
- local action disagreement;
- tied or near-tied exact mixes as boundary evidence;
- suited/offsuit counterpart relationship;
- pair-neighbor ordering;
- leave-one-out stability or sensitivity to one nearby observation;
- position/context isolation.

The model must not assume a global poker-strength ordering. Any monotonic-ish constraint is local, family-specific, versioned, and applied only when the user's evidence supports it. Deliberate gaps, islands, pair anomalies, and suited/offsuit anomalies must remain possible.

### 11.4 Output

For each class, return:

```text
resolutionState
strategyValue
evidenceReferences[]
inferenceAlgorithmVersion
uncertainty
reasons[]
diagnostics safe for inspection
```

Policies:

- exact direct answer wins and is returned unchanged;
- direct tied mix remains exact with no dominant action;
- contradictory direct heads produce `conflicting` and no inferred action;
- unsupported or sparse cases abstain;
- inferred v1 output is `dominant_only`, never an exact frequency;
- an exact neighbor mix may indicate boundary/margin, but its precision does not grant a stronger universal vote about another hand;
- inferred output is never appended to evidence or included in cloud payloads;
- deterministic tie-breaking uses canonical hand-class order and stable evidence ID.

### 11.5 Validation gate

002B is acceptable only if it publishes fixture-specific and aggregate results for:

1. smooth tight range;
2. smooth loose range;
3. irregular/non-monotonic range;
4. multiple islands or polarized/gapped range;
5. contradictory evidence;
6. exact-frequency boundary;
7. suited/offsuit anomaly;
8. pair anomaly.

Metrics must include attempted coverage, accuracy among attempted predictions, abstention, total held-out resolution, boundary error, stability after additional evidence, and failure reasons. A high aggregate score cannot hide a failed irregular or anomaly fixture.

## 12. `RANGE-CAL-002C` — adaptive questioning

### 12.1 Principle

Every ordinary question must either reduce a meaningful unresolved region or test a likely strategic boundary. Conflict review is a separate highest-priority review task until multi-head resolution is implemented.

### 12.2 Candidate set

Candidates are unresolved hand classes in the exact selected scope. Already-direct classes are excluded from ordinary questioning unless they are:

- part of explicit conflict review;
- deliberately selected for confirmation after material neighboring changes;
- requested by the user.

Obvious hands are not hardcoded as unimportant. They become low value after local evidence makes their region stable. Irregular user evidence can make any class valuable again.

### 12.3 Versioned question-value function

For each candidate `h`, compute versioned normalized components:

```text
U(h) uncertainty/abstention value
B(h) boundary likelihood from local disagreement, tied mixes, and inference sensitivity
G(h) coverage-gain potential: unresolved dependent points that could change if h were known
C(h) contradiction-review value
N(h) novelty/sparsity across pair, suited, offsuit, rank, and gap regions
R(h) recent-question repetition penalty
E(h) interaction cost: dominant answer < exact-mix request
```

Initial deterministic ordering should use a priority tier followed by a versioned score:

```text
priority tier:
  conflict review > boundary test > uncertainty/coverage > maintenance

within a tier:
  Q(h) = (0.35U + 0.30B + 0.20G + 0.15N - 0.20R) / E
```

These coefficients are an initial testable policy, not poker truth. 002C must version and compare them against deterministic canonical-order and seeded-random baselines. If there is no calibrated probability model, `G` is called coverage-gain potential, not expected information gain.

The selected result includes component values and a concise user-facing reason such as:

- "This tests the suited-king boundary around K9s/K8s/K7s";
- "Nearby direct answers disagree";
- "Pairs around 55/44 remain unresolved".

### 12.4 Determinism and resume

The selector is a pure function of active evidence, scope, policy version, recent-question history, and user goal/budget. Stable ties use canonical hand order.

The current session may continue to persist accepted evidence IDs and `nextPromptIndex`. A backward-compatible additive cursor field may record `selectionPolicyVersion` and `stoppingPolicyVersion`; the existing meaning of `nextPromptIndex` remains the canonical index of the selected next prompt. A schema bump is required if this cannot be implemented without changing existing v1 semantics.

After reopen or remote evidence application, the next question is recomputed from current evidence. No persisted inferred chart or stale prompt queue is authoritative.

## 13. Automatic stopping and progress

### 13.1 Stop reasons

Calibration may stop with an explicit reason:

- `user_stopped`;
- `user_paused`;
- `user_time_budget_reached`;
- `target_coverage_reached`;
- `low_remaining_question_value`;
- `no_useful_candidates`;
- `conflict_resolution_needed`;
- `full_direct_coverage`.

The product must not imply that completing all 169 direct questions is normal or required.

### 13.2 User goals

The implemented v1 resumable presets are deterministic question-count goals rather than wall-clock promises:

- Quick: at most 5 session questions unless the user asks for another;
- Standard: at most 30;
- Deep: at most 75;
- Exhaustive: the advanced canonical 169-direct fallback.

Coverage and remaining-value conditions may recommend stopping earlier after their minimum direct counts. A session never discards progress when a checkpoint is reached.

### 13.3 Meaningful metrics

Show counts or clearly defined coverage percentages for:

- direct class coverage;
- inferred-high and inferred-medium attempted coverage;
- uncertain and unknown classes;
- unresolved conflicts;
- tested boundary regions;
- questions answered this session;
- current next-question value relative to the versioned stopping threshold.

A useful Matrix progress summary is:

```text
24 direct | 83 inferred-high | 31 inferred-medium | 29 uncertain/unknown | 2 conflicts
```

Do not collapse those categories into "91% confidence". Coverage is not confidence, and dominant-only coverage is not exact-frequency coverage.

Automatic stopping occurs when the time budget ends, when the selected intended-use goal and its conflict policy are satisfied, or when the next-question score falls below the versioned policy threshold. Thresholds are determined by 002C evaluation, not chosen to produce a desired question count.

## 14. `RANGE-CAL-002D` — Matrix inspection and correction

### 14.1 Role

The Personal Strategy Matrix is an inspection and correction projection over `PersonalStrategySnapshot v1`. It is not the canonical store and must not reuse the current provider-backed representative-combo Matrix as a data source.

### 14.2 Cell presentation

Each cell can represent:

- dominant action when available;
- exact mix indicator only when an exact mix exists;
- directly known, inferred-high, inferred-medium, uncertain, conflicting, or unknown state;
- a class-with-combo-overrides marker;
- accessible text conveying the same state without relying on color.

Keep the grid quiet. Recommended layers are one action fill, one small provenance/status marker, one mix band when exact, and a conflict/uncertain outline. Full evidence and reasoning belong in the inspector, not every cell.

### 14.3 Inspector

Selecting a cell exposes:

- current qualitative or exact strategy value;
- direct versus inferred provenance;
- uncertainty band and honest meaning;
- current evidence records and correction history;
- contradictory heads;
- inference reason and influential neighbors;
- combo-specific overrides;
- Confirm, Change dominant action, Edit exact mix, Retract, and conflict-review actions when supported.

Confirming an inferred answer creates new direct dominant evidence. It does not mark the inference itself as evidence. Editing a mix creates explicit direct exact-frequency evidence. Conflict resolution requires the multi-head resolution contract described above.

### 14.4 Application boundary

The UI consumes a DOM-free `personal-strategy-matrix-projection/v1` from an application service. It never queries IndexedDB, runs inference, expands combos, or calls StrategyProvider per cell.

PERF-001 remains binding:

- no hidden 169-cell render;
- one keyed projection per visible scope/evidence fingerprint/model version;
- direct edits invalidate only the affected scope; the shared projector then deterministically rebuilds its bounded 169 estimates;
- remote batches coalesce invalidation;
- visual acceptance requires Firefox, EN/RU/HE, RTL, keyboard, non-color status, and requested desktop viewports.

## 15. Range Builder unification

### 15.1 Product role

When opened for a Personal Strategy profile/mode/spot, Range Builder is an advanced editor of the same evidence and snapshot. It does not save a parallel Matrix table.

Initial capabilities should include:

- paint one or multiple hand classes with a dominant action;
- set a complete exact action mix;
- brush pair, suited, offsuit, rank, or gap regions;
- show unknown/partial strategy honestly;
- retract selected current claims;
- preserve and inspect history;
- group a bulk edit under one operation/batch ID;
- compare before/after derived snapshots.

Combo-level override follows the same architecture and writes only changed combos. A complete class edit creates at most one class-level evidence event per changed class, never 1,326 duplicated combo records.

### 15.2 Manual edit versus calibration observation

Both are explicit intended-strategy evidence with equal authority, but provenance remains distinct:

```text
Calibration: user answered a prompted question.
Matrix: user confirmed/corrected while inspecting.
Builder: user deliberately painted or entered a strategy value.
```

If a Builder command edits an existing current head, the command must explicitly supersede it. If it is imported independently or arrives as another head, disagreement is a contradiction rather than last-write-wins.

Example:

```text
A5s -> Raise 0.60 / Fold 0.40
```

is exact direct strategy evidence. It is not inference and is not a `HoldemWeightedRange` inclusion weight.

### 15.3 General range building

A future generic inclusion-range editor may create `HoldemWeightedRange v1` or Saved Range objects. That is a different semantic mode from editing a profile's action strategy. The UI must label which quantity is being edited and never transfer scalar range weights into action frequencies implicitly.

## 16. Range Teacher / Profiler

Range Teacher is the active elicitation and explanation surface over the same question selector, evidence service, snapshot, and Matrix projection. It may evolve the current Range Calibration workflow rather than create another persistence path.

It should:

- ask the current highest-value question;
- explain why the question was chosen;
- test likely boundaries and anomalies;
- route conflicts to explicit review;
- drill neighboring classes after a surprising answer;
- compare an answer with the user's current modeled strategy without grading it as right or wrong;
- request an exact mix only when the additional detail has sufficient question value;
- avoid obvious stable regions after they are learned;
- allow the user to stop at any time.

Range Teacher learns/models the user's intended strategy. Training tests a user against a selected reference from StrategyProvider. Teacher answers create direct intent evidence; Training answers create behavioral evidence only when explicitly opted in.

## 17. Training evidence integration

The accepted rule remains: Training evidence is per-session opt-in and off unless the user deliberately selects a profile and mode.

Future flow:

```text
canonical TrainingAnswer
        |
        v
compatibility/context adapter
        |
        +--> incompatible/unrepresentable: no evidence write, honest status
        |
        v
TrainingObservation v1
source = training, selected profile/mode, exercise/session IDs
        |
        v
Personal Strategy repository
```

Requirements:

- opt-in is recorded for the Training session, not inferred from a previous global selection;
- **Don't use for profile** remains a first-class choice;
- only a context that can be mapped truthfully to a supported Personal Strategy family is written;
- one Training click never changes direct calibration evidence;
- direct/Training disagreement remains inspectable;
- current 002B inference excludes Training evidence;
- a future algorithm may use Training only after a separate validation policy defines its role; volume must not silently overpower direct intent;
- generic Training history is not copied into Personal Strategy or sync.

## 18. Future StrategyProvider seam

No provider integration occurs in this architecture ticket or the initial 002B ticket.

The future dependency path is:

```text
DecisionContext v1
        |
        v
validated DecisionContext -> StrategySpotContext adapter
        |
        v
Personal Strategy projection service
        |
        v
provider candidate with explicit precision/provenance
        |
        v
StrategyProvider source selection
```

Potential user selections:

- Reference Strategy;
- My Strategy: Profile X / Mode Y;
- Compare Reference vs My Strategy.

The provider candidate must expose profile/mode/context, evidence fingerprint, direct/inferred composition, algorithm version, uncertainty, coverage, and limitations. A personal result must never use GTO, Nash, solver, or validated-reference language unless a separate source actually provides that evidence.

`StrategyResult v1` requires normalized action probabilities and has a closed source vocabulary. A dominant-only personal answer cannot be emitted as `Raise = 100%`. Therefore the integration ticket must either:

- emit v1 only for complete exact-frequency points and return unavailable for qualitative points; or
- own an approved StrategyResult contract migration that represents preferred-action-only precision without fabricating probabilities.

Consumers must not add a parallel Personal Strategy strategy path around StrategyProvider.

## 19. Analysis, Compare Spots, and postflop seams

### 19.1 Analysis

Analysis may later receive a named Personal Strategy attachment containing:

- exact scope and subject;
- action-strategy snapshot or a legitimately action-conditioned `HoldemWeightedRange v1`;
- direct/inferred/conflicting/unknown state per point;
- uncertainty semantics and derivation versions;
- evidence and source provenance.

Current `RangeAnalysisFacts v1` accepts only weighted inclusion ranges. It must not receive a dominant-only Personal Strategy value disguised as a weight. A future Analysis contract may either consume a Personal Strategy attachment directly or consume a safely derived partial action-conditioned range. Unknown/inferred inputs remain partial, are not normalized as complete truth, and retain provenance through `AnalysisExplanation`.

### 19.2 Compare Spots

Compare Spots derives two snapshots and reports:

- action/value changes;
- uncertainty/provenance changes;
- evidence differences;
- objective context differences such as position, stack, mode, profile, price, opponents, board, or prior action.

It may say that K8s changes between two modeled contexts and identify which facts differ. It must not claim a causal poker explanation unless a trusted explanatory source supports it.

### 19.3 Postflop future

The deepest canonical contracts avoid RFI-specific names. Future evidence can target a combo in an exact postflop context with board and structured prior action.

Range evolution is derived:

```text
prior combo range
  * exact action frequency at the decision
  -> action-conditioned next-street range
  + new board blockers
  -> next decision context
```

Unknown dominant-only or conflicting actions produce partial/unknown propagated ranges. Propagated street ranges are derived artifacts, not new evidence and not a replacement for the original observations.

## 20. Persistence, cloud sync, and versioning

### 20.1 Sync policy

Sync:

- stable profiles and exactly three mode relationships;
- immutable direct source records and their correction/resolution lineage;
- opted-in Training observations;
- calibration sessions and evidence references;
- later class/combo edit evidence and imports only after their remote schemas are approved.

Do not sync:

- inferred points;
- uncertainty bands;
- conflict markers;
- question scores;
- Matrix projections;
- action-conditioned ranges;
- disposable snapshot caches.

Every derived artifact is recomputed after local/remote evidence changes. This avoids stale model output, reduces payload, and makes algorithm upgrades deterministic.

### 20.2 Required versions

Version independently:

- each durable evidence schema;
- normalized evidence-view contract;
- objective context key and serializer;
- conflict and correction policy;
- inference algorithm and configuration;
- uncertainty semantics and threshold policy;
- question-selection algorithm;
- stopping policy;
- snapshot and Matrix projection;
- action-conditioned range adapter;
- any provider-result migration.

Historical direct evidence retains its original schema and meaning. An adapter may project it into a newer read model, but an algorithm update cannot rewrite the original record or reinterpret dominant-only as exact.

### 20.3 Future durable schema changes

Combo targets, source-specific Matrix/Builder provenance, imports, and multi-head resolution may require additive record schemas, IndexedDB indexes/stores, portable-export changes, sync adapter changes, and a Supabase migration. The implementation ticket that first persists one of these types owns that complete migration and real sync acceptance. This architecture document is not approval to change schemas opportunistically.

## 21. Performance and invalidation

### 21.1 Interaction path

The accepted answer path remains:

1. validate direct command;
2. atomically persist evidence and session;
3. render the next durable state;
4. schedule bounded inference/projection work.

Inference must not delay durability. If adaptive next-question selection depends on new inference, compute only the affected class neighborhood synchronously when measured safe and schedule the remaining Matrix projection outside the immediate input task.

### 21.2 Cache keys and incremental work

Cache by:

```text
profileId + modeId + canonical context key
+ active evidence-head fingerprint
+ conflict policy version
+ inference version
+ uncertainty version
+ projection version
```

On one evidence change:

- update the affected class/target and conflict set;
- recompute only inference points whose declared dependency neighborhood includes it;
- recompute aggregate counts from the 169-class read model;
- materialize combo entries only for visible inspection, Builder, Analysis, or export requests;
- retain class-to-combo mapping from the canonical Range Core registry;
- coalesce a remote batch into one scope invalidation.

### 21.3 Explicit prohibitions

- no 1,326-combo rewrite on each Calibration click;
- no hidden 169-cell DOM work;
- no full-cloud upload for derived inference;
- no StrategyProvider or Equity call during evidence inference;
- no blocking full-profile history scan on an answer;
- no worker until profiling justifies its lifecycle cost;
- no derived cache that can outlive its evidence/version fingerprint as truth.

Current 002A evidence shows one requested class is sub-millisecond while all unanswered classes can take tens of milliseconds. That supports local incremental work and visible-surface scheduling before adding a worker.

## 22. Deterministic validation harness

### 22.1 Test corpus

Synthetic user strategies are allowed to test mechanics, never as poker-reference truth. Keep fixture metadata explicit and include:

- smooth tight;
- smooth loose;
- boundary-heavy;
- irregular/non-monotonic;
- multiple islands/polarized or gapped;
- contradictory roots/siblings;
- exact-frequency and tied boundary;
- suited/offsuit anomaly;
- pair anomaly;
- later combo-override anomaly.

Add complete local user-authored RFI strategies as private evaluation corpora when available. They remain local, opt-in, and are not telemetry. Fixed holdout seeds and splits must prevent hidden labels from entering prediction or question selection.

### 22.2 Inference metrics

- direct answer count;
- eligible holdouts;
- attempted coverage;
- accuracy among attempted predictions;
- abstention rate and reason distribution;
- total held-out resolution;
- incorrect boundary predictions;
- boundary localization distance/error;
- prediction flip/stability after additional evidence;
- direct exact-mix preservation;
- contradictory-target abstention;
- scope isolation;
- runtime for one point, affected neighborhood, 169 projection, and lazy combo materialization.

### 22.3 Question-policy metrics

- questions needed to reach each defined direct/inferred coverage state;
- attempted accuracy at equal question counts;
- boundary recovery after equal question counts;
- coverage gain per answer;
- repeated-region rate;
- anomaly discovery rate;
- conflict-review prioritization;
- stopping point and reason;
- comparison against canonical-order, seeded-random, nearest-uncertain, and boundary-only baselines.

Do not optimize only smooth fixtures or only attempted accuracy. A policy that predicts everywhere with poor error, or abstains everywhere with perfect attempted accuracy, is not useful.

### 22.4 Release interpretation

- synthetic tests prove determinism, leakage resistance, and known failure behavior;
- private complete user-authored holdouts are required before strong user-facing uncertainty labels are treated as validated for real Personal Strategy ranges;
- no result proves GTO, optimality, EV, or solver accuracy;
- fixture-specific negative results remain in the report.

## 23. Intended user loop

```text
Create profile: Home Game with Friends
Choose mode: Standard
Choose spot: 6-max BTN, 100bb, RFI
Choose quick / 5-minute / long session
        |
        v
Riverline asks one high-value question and explains why
        |
        v
Direct answer is saved immediately
        |
        v
Snapshot and Matrix update:
direct | inferred | uncertain | conflicting | unknown
        |
        +--> answer next question
        +--> inspect a Matrix cell
        +--> confirm/change/edit exact mix
        +--> open Range Builder
        `--> stop and resume later
```

Riverline should feel as if it is learning the user's boundaries, not assigning a 169-cell form. It remembers evidence and contradictions. It remains honest about unknown frequencies and uncertainty. Training may later contribute behavior only with per-session opt-in.

## 24. Recommended implementation sequence

### 24.1 `RANGE-CAL-002B` — inference + uncertainty — COMPLETED

Dependencies:

- accepted `RANGE-CAL-000` through `002A`;
- current synced-head semantics;
- this architecture specification.

Owned outcome:

- DOM-free evidence-view, conflict projection, strategy-point/snapshot, and ordinal uncertainty contracts for RFI;
- deterministic categorical inference hardening;
- expanded validation harness and report.

Acceptance:

- exact direct/dominant/tied-mix semantics pass through unchanged;
- contradictory heads yield `conflicting` with all references;
- no dominant answer becomes a frequency;
- inferred result is categorical or abstained and never evidence;
- ordinal bands are tied to explicit validation policies or remain uncertain;
- all required hard fixtures and metrics are published;
- deterministic versioning, scope isolation, stability, and performance tests pass;
- no import from UI, repository, sync, StrategyProvider, Training, Analysis, or Home.

Implemented files:

- `app/src/personal-strategy/evidence-view.mjs`, `rfi-inference.mjs`, and `projection-service.mjs`;
- a scope-aware source query in the existing repository and bounded lazy Calibration application query methods;
- `tests/range_cal002b_*.test.mjs`;
- `tests/fixtures/` and `tests/tooling/` evaluation files;
- a new 002B validation report and bounded spec references.

Not owned:

- live question selection, Matrix UI, persistence migration, sync payload, Builder, Teacher, Training, provider, Analysis.

### 24.2 `RANGE-CAL-002C` — adaptive questions + stopping — COMPLETED

Dependencies:

- accepted 002B projection/uncertainty contract.

Owned outcome:

- deterministic versioned question-value selector;
- recent-question diversity and boundary targeting;
- Quick/Standard/Deep deterministic question-count goals plus exhaustive fallback;
- explicit stop reasons and category-based progress;
- live Calibration application integration without a Matrix redesign.

Acceptance:

- selection uses current evidence only and recomputes after local/remote change;
- obvious stable regions fall behind boundary/anomaly questions without hardcoded poker answers;
- exact-mix prompts pay a higher interaction-cost penalty and occur only when valuable;
- conflict tasks are ranked but not falsely resolved before a resolution contract exists;
- resume is deterministic for the same policy/evidence;
- 169 completion is no longer the only completion path;
- policy beats canonical-order/random baselines on at least boundary recovery or useful coverage without hiding anomaly failures;
- answer durability and accepted latency budgets remain intact.

Likely files:

- new `app/src/personal-strategy/rfi-question-selection.mjs`;
- `app/src/application/range-calibration-service.mjs`;
- `app/src/application/range-calibration-workspace.mjs`;
- bounded HTML/CSS/localization/tutorial changes for budgets, reasons, and stop states;
- focused selection, resume, performance, and Firefox acceptance tests.

Implemented checkpoint:

- `adaptive-rfi-question-value/v1`, `adaptive-rfi-cold-start/v1`, and `adaptive-rfi-stopping/v1`;
- state-local ranking reuse over the 002B scope cache, one atomic accepted-answer write, and recomputation after commit/resume/sync;
- additive backward-compatible cursor facts only; no ranking or inferred snapshot is persisted or synced;
- bounded EN/RU/HE workspace/tutorial updates with truthful category progress and “Why this hand?” reasons;
- equal-budget adaptive-versus-sequential validation over all eight 002B fixtures, with structured boundary/coverage gains, honest irregular abstention, and high-band safety;
- `ADAPTIVE_RANGE_CALIBRATION_SPEC.md` and `RANGE_CAL_002C_VALIDATION_REPORT.md` own implementation detail and measured results.

Not owned:

- personal Matrix, Builder, Training integration, StrategyProvider, Analysis, postflop.

### 24.3 `RANGE-CAL-002D` — Matrix inspection/correction/provenance — IMPLEMENTED / VISUAL QA OPEN

Dependencies:

- 002B snapshot;
- 002C application progress semantics;
- approved multi-head resolution design if conflict resolution is writable.

Owned outcome:

- DOM-free personal Matrix projection and visible inspection/correction UI;
- direct/inferred/uncertain/conflicting/unknown states;
- cell inspector with evidence, inference reason, exact mix, and corrections;
- explicit direct confirmation/edit path;
- versioned multi-head resolution if the ticket exposes Resolve.

Acceptance:

- Matrix consumes the application projection, not repository internals or current provider Matrix cells;
- direct and inferred are distinguishable without color alone;
- inferred categorical output never displays fake percentages;
- confirming inference writes direct evidence;
- conflicts remain visible until explicit valid resolution;
- hidden workspace performs no 169-cell compute/render;
- EN/RU/HE, RTL, keyboard/focus, reduced-motion, and Firefox viewport acceptance are completed or reported honestly.

Implementation checkpoint:

- `personal-strategy-matrix-projection/v1` maps the one 002B snapshot/evidence revision to exactly 169 canonical cells and carries 002C candidate/boundary facts;
- action fill/precision is separate from six-state provenance/status, with no inferred percentage or Range Core weight;
- the inspector consumes projected direct history, active heads, selected neighbors, reasons, uncertainty, candidate facts, and combo-override indicators;
- Confirm/Change/Edit mix append canonical direct `RangeObservation v1` records through one application seam, supersede the selected head, invalidate the scope, and sync only source evidence;
- conflicts remain visible and are not averaged; writable multi-head resolution is deferred because 002D owns no schema migration;
- the Calibration surface reuses an active session projection, follows or selects questions explicitly, and records Matrix preparation/selection/correction/scope timing;
- focused deterministic, i18n, architecture, and accessibility-structure coverage is present; human Firefox visual acceptance remains in `QA_BACKLOG.md`.

The detailed consumer contract and `RANGE-BUILDER-001` reuse seams are in `PERSONAL_STRATEGY_MATRIX_SPEC.md`.

Likely files:

- new Matrix projection/application module;
- Range Calibration workspace, HTML/CSS/locales/tutorial;
- Personal Strategy domain/repository/sync/migration files only if multi-head resolution is implemented;
- focused projection, evidence-write, PERF-001, accessibility, and visual acceptance tests.

Not owned:

- general Builder brushes/import/export, Training, provider, Analysis, postflop.

### 24.4 `RANGE-BUILDER-001` — unified manual editor — IMPLEMENTED / VISUAL QA OPEN

Dependencies:

- 002D personal Matrix projection/edit commands;
- Range Core combo registry;
- approved source-specific direct-edit provenance.

Owned outcome:

- profile-attached class-level painting and exact mix editing over the same evidence/snapshot;
- bulk command transaction and history;
- explicit action-strategy semantics distinct from inclusion ranges;
- sparse combo-override contract only if the ticket also owns its local/export/sync schema.

Acceptance:

- no parallel range table or persistence authority;
- a Builder edit appears immediately in Calibration/Matrix projection;
- class edits do not write 1,326 duplicate records;
- exact mix remains action frequency;
- corrections have explicit lineage and independent edits create inspectable conflicts;
- partial/unknown state is preserved;
- combo overrides, if included, use canonical combo IDs and survive blocker-aware inspection without changing Range Core;
- bulk edits are atomic, performant, local-first, and sync only source evidence.

Likely files:

- new Range Builder application/workspace modules;
- Personal Strategy direct-edit/target contracts and repository commands;
- Range Core imports for identity/projection only;
- HTML/CSS/locales/tutorial and focused persistence/sync/performance/Firefox tests.

Not owned:

- generic Saved Range library, sharing, notation parser, provider, weighted Equity, postflop propagation.

Implementation checkpoint:

- additive `calibration | matrix | range_builder` source metadata and Builder action-group/undo references remain inside immutable `RangeObservation v1` payloads, requiring no physical database or remote schema migration;
- one canonical-order batch transaction, one mutation notification, one scope invalidation, and one snapshot recompute cover 1–169 accepted class edits;
- ambiguous/conflicting heads skip by default; Builder does not claim multi-head resolution;
- semantic undo appends canonical corrections/retractions and cannot touch a later or unrelated Calibration/Matrix/remote head;
- the existing Personal Strategy Matrix supplies multi-selection, structural helpers, rectangular/paint gestures, exact-mix presets, keyboard operation, session history, feedback, EN/RU/HE, and RTL/LTR structure;
- deterministic application/architecture/performance coverage is implemented; requested human Firefox visual acceptance remains in `QA_BACKLOG.md`.

Detailed contracts and reusable Teacher seams are in `RANGE_BUILDER_SPEC.md`.

### 24.5 `RANGE-TEACHER-001` — active profiler/teacher — IMPLEMENTED / VISUAL QA OPEN

Dependencies:

- 002C selector/stopping;
- 002D inspection;
- Builder edit commands where used.

Owned outcome:

- a coherent teaching/profiling experience over the same selector, evidence, snapshot, and Matrix;
- why-this-question explanations, boundary drills, contradiction review, and useful exact-mix requests.

Acceptance:

- no new repository, range format, or inference engine;
- Teacher questions create direct intended-strategy evidence;
- it never grades against StrategyProvider or calls an answer a mistake;
- neighboring drills and conflict tasks are deterministic and provenance-aware;
- stable obvious regions are skipped;
- user can inspect, edit, stop, and resume through shared state;
- tutorial, localization, accessibility, and Firefox acceptance are owned by the ticket.

Implemented checkpoint:

- `range-teacher-view/v1` is a pure projection of one matching evidence/snapshot revision plus 002C ranking/progress; it is not persisted, exported, or synced;
- `boundary-cluster/v1` uses deterministic primary-neighborhood connectivity within structural families and canonical-hand tie-breaking;
- contradiction hotspots preserve all direct heads; sparse regions and exact-mix opportunities reuse existing inference/support/ranking facts;
- Quick profile, Boundaries, Unknown regions, Conflicts, and Exact-mix refinement map to the existing Calibration session with a versioned deterministic 002C selection-intent bias;
- inspect/edit/question actions route to the existing Matrix, Builder, and Calibration application APIs; recommendation dismissal remains same-session UI state;
- compact EN/RU/HE UI, semantic tab/keyboard/live-region structure, tutorial coverage, deterministic architecture tests, and performance benchmark are implemented;
- requested human Firefox viewport/theme/language acceptance remains tracked in `QA_BACKLOG.md`.

Detailed contracts are in `RANGE_TEACHER_SPEC.md`.

Likely files:

- Range Calibration/Teacher presentation and application orchestration;
- existing question-selection/snapshot modules;
- locales/tutorial/HTML/CSS;
- focused user-loop, provenance, boundary, resume, and visual tests.

Not owned:

- Training grading/history, StrategyProvider integration, solver/reference comparison, social sharing.

Each ticket is independently reviewable and commit-ready. None should stage or commit automatically.

## 25. Open decisions

Only decisions that remain materially valid in more than one form are listed here.

### 25.1 Dominant-only Personal Strategy in StrategyProvider

Option A: keep `StrategyResult v1` quantitative and expose Personal Strategy only for exact-frequency points.

- smaller integration;
- no fabricated probabilities;
- most quick calibration evidence remains unavailable to provider consumers.

Option B: introduce an approved `StrategyResult v2` precision variant for preferred-action-only results.

- makes dominant calibration useful across Playbook/Training/Analysis;
- preserves honesty if consumers handle missing frequencies;
- requires a deliberate cross-surface contract migration.

Recommendation: keep provider integration deferred; when it begins, choose Option B if dominant-only cross-product behavior is a core requirement. Until that migration is owned, use Option A and return unavailable rather than 100%.

### 25.2 Training evidence in inference

Option A: use Training only as a disagreement/question signal.

- preserves intended-strategy authority and avoids behavior volume dominating;
- learns less automatically.

Option B: include Training as a weighted inference feature.

- may model actual behavior sooner;
- requires calibrated weighting, session-quality semantics, and protection against correlated/repeated drills.

Recommendation: Option A for 002B–002D. Evaluate Option B only in a separate holdout study with explicit per-session opt-in data.

### 25.3 Postflop evidence key

Option A: key evidence only by exact board/action facts.

- truthful and replayable;
- sparse and harder to generalize.

Option B: key evidence directly by abstractions such as texture/action family.

- denser learning;
- abstraction-version changes can reinterpret history and hide meaningful combo differences.

Recommendation: exact canonical facts are the durable primary key; separately versioned abstraction indexes drive inference. Do not make a lossy abstraction the only historical authority.

### 25.4 First Range Builder semantic scope

Option A: Personal Strategy action editor first.

- directly advances the unified model;
- avoids mixing range inclusion with strategy frequency.

Option B: ship profile strategy and generic inclusion-range/Saved Range editing together.

- broader immediate utility;
- substantially larger schemas, UX modes, persistence, and acceptance surface.

Recommendation: Option A for `RANGE-BUILDER-001`; add generic Saved Range editing in a separate ticket over `HoldemWeightedRange v1`.

## 26. Explicit non-goals of this architecture ticket

- no production code or prototype interface;
- no schema or IndexedDB migration;
- no Supabase migration;
- no live inference integration;
- no Matrix, Builder, or Teacher UI;
- no Training opt-in;
- no StrategyProvider source;
- no Analysis or Compare Spots implementation;
- no postflop solver/range propagation;
- no solver, ML, or reference strategy;
- no numeric user-facing confidence;
- no staging or commit.
