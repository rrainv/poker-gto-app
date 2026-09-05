# Training Intelligence v1

Status: implementation contract for `TRAINING-INTELLIGENCE-001`, September 5,
2026. Product decisions are approved in the ticket. Human acceptance of the
first slice remains pending. This document does not change roadmap sequencing.

## Shared truth eligibility

`training-learning-eligibility/v1` consumes frozen `strategy-truth/v1` and distinguishes user-requested revisit, uncertainty revisit, heuristic comparison, accepted-reference comparison, and normative remediation. Only the accepted assessment criterion's explicit remediation permission allows automatic strategic priority. The existing Unsure -> Revisit -> Why it returned flow remains available without an assessment. Retention/transfer remain unavailable even for supported normative actions until independent learning criteria and exposure evidence exist. Same Spot uses historical evidence; Similar Spot uses current source resolution and is not transfer success.

## Authority and product contract

Training Intelligence answers what to practice next, why now, and what evidence
would support a learning claim. It consumes existing authorities:

```text
Training Memory / Saved / consented Personal Strategy / future review evidence
  -> learning facts -> eligibility -> learning-state and schedule projections
  -> claim permission -> natural-language presentation
  -> explicit user activation -> existing Training application handoff
```

PokerState/GameRules, DecisionContext, StrategyProvider/StrategyClaimPolicy,
Training planner/generator/grader, Replay, Saved, Personal Strategy, and identity
keep their authority. A scheduling reason is not a strategic recommendation.
No universal Mastered boolean, inferred confidence score, engagement score,
second generator, universal learning record, or language-model authority exists.

## Versioned contracts

All projections carry schema/policy versions, input evidence identities, owner
scope, availability and explicit reasons. Unknown is never zero, false, failure,
or lack of ability. Durable objects use their existing domain owner; ephemeral
work also carries generation/cancellation scope. Identifiers are opaque.

### Confidence and uncertainty evidence

`training-learning-evidence/v1` is an additive nested contract in
`training-decision-record/v1.1`. Legacy v1 records remain readable without
rewriting. The physical Memory database/stores remain unchanged. The database
record-version marker advances atomically on the first v1.1 write; old clients
must fail closed rather than erase new evidence.

Fields:

- `uncertainty`: null or `{ value: 'uncertain', phase: 'before_reveal', capturedAt }`;
- `revisitRequest`: null or `{ requestedAt, policyVersion }`;
- `revisit`: null or `{ sourceDecisionRecordId, requestedAt, dueAt, startedAt }`.

Absent uncertainty means not reported, never confident. A marker is captured
before revealing the answer and persisted with the normal action submission;
changing the pending marker before submission changes that pending self-report.
An answered report is immutable. Uncertainty never modifies poker assessment.
The action remains the existing canonical response including exact amount-to.
The first slice captures markers in Varied/Focused primary exercises only.
Abandoned unsubmitted markers are not durable answers.

The distinct future abstention command records no poker action and no grade;
it advances exercise participation once without fabricating an answer. Planner
coverage still advances only on serving. Abstention requires a separately
versioned response/status extension and is not implemented by this slice.
It is not Fold, Skip, incorrect, or Personal Strategy observed action.

### Learning facts: `training-learning-facts/v1`

Derived per decision: `decisionRecordId`, `sessionId`, `ownerRef`, `stateKind`,
canonical context/rules identity, source/assessment snapshot references,
uncertainty evidence, review intent/lifecycle, attempt-parent relationship,
shown/answered timing, and `assessmentAvailability`/reason. It references
canonical evidence instead of copying poker state or rendered prose.

Future adapters additionally provide explicit skill/context scope, assistance
and feedback exposure, actual changed/preserved dimensions, opportunity
definition, imported provenance, and historical/current analysis identity.
Absent exposure history cannot support a claim of unassisted recall.

### Eligibility: `training-revisit-eligibility/v1`

Fields: `eligible`, `reasonCodes`, `allowedRevisitKinds`, `evidenceRefs`,
`unavailableReasons`, `assessmentAvailability`.

First-slice eligibility requires an answered generated decision, pre-reveal
uncertainty, explicit revisit request, and compatible historical Same Spot
evidence. Future due time uses the existing Memory review lifecycle; explicit
user intent, not legacy comparison priority, permits the proposal. Failed
reconstruction, unsupported record versions, stale owner scope, missing source,
and active ordinary sessions block activation with an explicit reason.
Full Hand and arbitrary imported decisions are not first-slice candidates.

### Learning state: `training-learning-state/v1`

Key: owner + versioned skill/context scope + assessment/reference frame.
Five independent dimensions: `immediate_repetition`, `delayed_recall`,
`retention`, `near_transfer`, `contextual_transfer`. Each has `status`
(`unavailable`, `insufficient_evidence`, `observed`, or `supported`), opportunity
and eligible-assessed counts, contributing evidence references, time/context
coverage, criterion version, and limitations. No single numeric mastery value.

`observed` establishes participation only. `supported` requires an accepted
criterion and eligible assessments; it is unavailable in the first slice.
Retention requires multiple delayed, unassisted eligible opportunities over a
declared time window. Near transfer requires verified controlled differences
and a compatible assessment. Contextual transfer requires a relevant decision
actually encountered without targeted prompting during a canonical full hand;
hand completion/winnings alone are not evidence. Repeated cards, repeated
answers, Done clicks, confidence, and volume alone prove none of these.

Thresholds must be explicitly versioned and independently accepted before any
supported-state renderer is enabled. Source/rules/assessment incompatibility
partitions evidence. A source update never silently regrades historical answers.

### Scheduling: `training-scheduling-proposal/v1`

Fields: `proposalId`, `decisionRecordId`, `ownerRef`, `policyVersion`, `dueAt`,
`due`, `revisitKind`, `reasonCodes`, `evidenceRefs`, `handoff`, `limitations`.
The first policy is `uncertain-exact-revisit/v1`: explicit request schedules
24 elapsed hours later (UTC), using Memory `snoozed` and `dueAt`. This is a
transparent product interval, not a measured forgetting model. Practice now
may override time; it does not become delayed-learning success. Snooze uses the
existing 1–30 day rule. Stop reminding marks the existing lifecycle reviewed;
it preserves evidence and says nothing about ability. Requesting again is
explicit. No automatic scheduling follows uncertainty alone.

The first projection filters a bounded indexed Memory page for eligible intent
and sorts due time then stable ID. It never uses heuristic disagreement,
legacy review weights, or source-unavailable reasons. Page scope is explicit;
it does not claim complete-library counts or global optimal priority.

Adaptive scheduling is the long-term target: a future version may adjust bounded
intervals using eligible outcomes/exposure and user overrides. Each output
retains contributing evidence, rule version, prior/new interval and reason.
No opaque model or engagement optimization selects scheduling strength.

### Training handoff: `training-learning-handoff/v1`

Discriminated commands: `exact_same_spot` (implemented route),
`similar_spot`, `controlled_variation`, `full_hand` (future routes). Exact
handoff carries the source record ID and request identity, reconstructs through
Memory Same Spot, and starts its existing idle-only standalone review session.
It neither suspends nor replaces ordinary Training. Before activation, reread
the owning record and validate current request/lifecycle/identity.

Other handoffs carry structural targets into existing TrainingSessionIntent /
TrainingScenarioRequest or the Full Hand controller. They never contain locally
invented cards, actions, pot, StrategyResult, or grades. Unsupported requested
dimensions fail visibly; current Similar Spot is not proof of controlled
strategic equivalence. Analyze randomization recipes cannot replace legal
Training generation.

### Checkpoint and revisit relationship

Existing `decisionSource.parentDecisionRecordId` and `redrillKind='same_spot'`
remain the parent authority. Nested `revisit` names which explicit request and
due time caused this attempt. Completion is the child DecisionRecord's normal
answered status/time; no extra completed/retained boolean is stored.
Unanswered/abandoned attempts do not resolve the reminder. Completing an attempt
may resolve only the matching still-current request; a concurrent snooze or
new request must survive. This acknowledgement is not successful recall.

Future checkpoints reference eligible attempts and a versioned criterion,
scope, exposure policy and assessment frame; their conclusions are disposable
projections, not edits to historical answers.

## Normative and truth gates

| Gate | Remains unavailable until the gate is met |
|---|---|
| HEURISTIC-BASELINE-TRUTH-001 | Automatic learning/remediation priority from existing baseline agreement/disagreement; baseline-derived skill/accuracy/mistake summaries |
| TRAINING-NORMATIVE-001 | Objective action correctness, normative remediation, correctness-based recall/retention/transfer outcomes; modal probability gap is never sufficient |
| Accepted exact reference coverage and required capabilities | Assessment outside that source's accepted rules/context/action/sizing coverage; action EV/sizing/optimality remain separately gated |
| Accepted learning criterion and exposure evidence | Supported retention/transfer states, even when an action is normatively assessed |

This slice bypasses none of these gates: its reason is user-authored uncertainty
plus explicit intent. No source provider or Equity call is needed to list it.
Historical source/ClaimPolicy stays frozen for Same Spot comparison, without
promoting legacy permissions into new learning claims.

## Study Inbox and natural language

Repo evidence supports a projection: Memory already owns decision review and
due indexes; Saved owns Hand/Spot review annotations; Home already consumes
Saved and Personal Strategy projections and truthfully leaves Training activity
unsupported. No Inbox database is justified.

Future `study-inbox-item/v1` projects `{ownerDomain, objectId, reason, dueAt?,
availability, evidenceRefs, actions}`. Commands dispatch back to the named
owner. Duplicate surfaces link the same evidence; annotations/lifecycles are
not copied. Different owners' requests are not silently resolved together.
Bounded source pages expose partial coverage and independent failures.

Target composition: one recommendation with a concise why-now sentence and
primary Practice action, followed by an inspectable queue. Precise setup,
table/history, action controls, range distributions and Facts remain available.
The first slice adds this projection inside the existing lazy Memory surface,
with an explicit idle-state Review entry; Home/Saved integration is contract-only.
No startup polling, hidden provider/Equity/range work or full-library scan.

`training-learning-explanation/v1` carries reason code, fact references,
permitted claim kinds, limitations and localized rendering keys. The sentence
"You marked this decision uncertain and asked to revisit it" requires both
facts. Stronger clauses require individually permitted evidence. Pre-answer
proposals omit previous action/grade/feedback. Earlier/current answers appear
only after the new answer. The Memory/history surface and hints remain hidden
or disabled during the delayed revisit. Canonical pre-action trajectory history
stays visible as decision context; it does not contain the earlier answer.
No pre-answer strategic coaching.

Natural language changes hierarchy, not truth. Analyze/Review explain exact
selected facts and current/historical boundaries; Personal Strategy explains
sparsity/conflicts; Home/Saved/Inbox explain continuity; Equity/Hand Analysis and
Range retain scientific values and visualizations; Import explains gaps;
Reference explains coverage; Opponent views distinguish observation and
hypothesis. Future natural-language requests compile to inspectable structured
constraints, with deterministic editing and explicit unsupported results.
Deterministic EN/RU/HE templates implement the first slice; no remote service.

## Future adapters and opponent gate

- Imported/reviewed Hands: canonical observer-safe reconstruction, exact event
  identity, source quality, outcome/selection bias and current versus frozen
  judgment; unknown opportunity/exposure stays unknown.
- Personal Strategy: immutable intended versus consented observed evidence,
  exact profile/mode scope; conflict is not a poker mistake. No automatic opt-in.
- Saved/Home: existing owners, annotations, stable references and lazy bounded
  projections; no new Saved payload kind implied.
- Controlled perturbation/Another Like This: versioned locks and actual change
  validation through the canonical generator; current randomization is not a
  transfer classifier.
- Full Hand transfer: canonical opportunity and actor journal, terminal Review
  embargo and observer-safe history; no chip-result grading.
- Opponent-conditioned practice: hypothetical policy and evidence-derived model
  remain separate from selected reference, Hero intent/behavior and exploit
  assessment. Weak evidence permits only user-requested hypothetical drills.
  Proactive person-specific recommendations require accepted opportunity/sample
  criteria, context, provenance, recency and visible uncertainty.

Named prerequisite **OPPONENT-ACTOR-INFORMATION-001**: before serious/custom or
evidence-derived bot expansion, selectors receive only the acting player's
legally observable information. Inaccessible cards must not influence policy
inputs, fingerprints, seed mixing, caches or explanations. Private deal/chance
streams are separate from policy RNG. Identical actor information + policy
version + decision seed must select identically when other private cards vary.
Canonical legality validates the returned action but is not information
isolation. Current full-state selector input is insufficient. This ticket does
not change bot interfaces or implement the bot system.

## Verification and rollout

Focused tests must cover legacy/new records, atomic version marker, unchanged
assessment/action, no uncertainty from omission, explicit intent-only eligibility,
24h boundary and overrides, source-unavailable behavior, exact reproduction,
hidden earlier evidence, no hint leakage, no planner/stat effects, unfinished
attempts, concurrent answers/requests, stale reads/writes and owner transitions.
Existing Training, Memory, identity, Saved/Home regressions remain required.
No full-suite checkpoint or broad documentation closeout is implied.

Browser acceptance: primary flow and reload, pre-answer/feedback DOM, keyboard,
EN/RU/HE/RTL, active-session entry block, sign-out/owner transition, snooze/dismiss
and no false success language. Structural tests are not visual acceptance.

## First-slice file map

Paths below are relative to the repository root. Several already contained
uncommitted identity work; this ticket preserves those changes.

| Area | Files |
|---|---|
| New learning contracts/projection | `app/src/training-memory/learning-evidence.mjs`, `app/src/application/training-intelligence.mjs` |
| Existing Memory owners | `app/src/training-memory/domain.mjs`, `app/src/training-memory/repository.mjs`, `app/src/application/training-memory-service.mjs`, `app/src/application/training-memory-bootstrap.mjs` |
| UI and language | `app/index.html`, `app/styles.css`, `app/src/core/logic.js`, `app/src/locales/i18n.js`, `app/src/locales/tutorial-translations.js`, `app/src/tutorial/current-app-tutorials.mjs` |
| Behavioral/race tests and existing harness updates | `tests/training_intelligence001.test.mjs`, `tests/same_spot_coherence001.test.mjs`, `tests/auth_training_memory001.test.mjs`, `tests/identity_lifecycle001b.test.mjs` |
| Scoped documentation | This spec, `docs/project/TRAINING_MEMORY_V1_SPEC.md`, `docs/project/capabilities/TRAINING_INTELLIGENCE.md`, `docs/project/capabilities/OPPONENT_INTELLIGENCE.md`, `docs/project/QA_BACKLOG.md` |
