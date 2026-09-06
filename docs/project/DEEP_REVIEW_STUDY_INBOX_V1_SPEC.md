# Deep Review, Decision Delta and Study Inbox v1

September 6, 2026. `DEEP-REVIEW-001` + `STUDY-INBOX-001` +
`DECISION-DELTA-FOUNDATION`: bounded implementation, human acceptance pending.
`QA-DEEP-STUDY-001` owns acceptance. This explicit ticket does not reorder the
general delivery queue or accept earlier Review/Import/Opponent QA.

## Contracts and ownership

`decision-delta/v1` projects an already canonical Review decision into seven
independent roles: observed action, current Personal intent, selected accepted
reference, heuristic baseline, explicit opponent policy/model, assumption-labelled
exploit analysis, and normative assessment. `combinedVerdict` is always null.
Strategy Truth owns comparison and assessment permissions. Heuristic output is
never inserted into the selected-reference slot. Normative wording consumes
Strategy Truth presentation, including its outcome permissions.

`hand-review/v1` receives additive `importProvenance` and `deepReview` projections.
Canonical Hand, Replay, provider cache and durable contracts remain unchanged.
The new modules contain no provider/Equity calls, poker rules, database or evidence
store. Existing Saved Hand/Spot and Training Memory owners retain all persistence.

## Decision selection and language

`review-priority/v1` takes the highest applicable reason, without adding weights:

| Reason | Priority | Evidence |
|---|---:|---|
| Review later | 100 | Saved review flag or Training manual Review |
| Uncertain | 90 | Encountered Training uncertainty |
| Difficult | 85 | Training user flag |
| Normative remediation | 80 | Strategy Truth normative state and remediation permission |
| Current Personal preference difference | 70 | Compatible direct intent; action type only |
| Accepted reference difference | 60 | Strategy Truth reference permission and descriptive comparison |
| Import uncertainty | 55 | Missing, ambiguous or unsupported source facts |
| Policy-sensitive question | 40 | Explicit frozen synthetic policy and partial exploit facts |
| Large economics | 30 | Canonical call price or actual committed amount at least 20 bb |

Ties use canonical decision order and then decision ID. At most three reasoned
decisions are highlighted. With no reason the surface says so and leaves every
decision inspectable. Heuristic disagreement, pot outcome and probability gap
alone create no priority or error claim. Economics is a magnitude fact, not EV.

Natural-language reason templates consume structured reason codes and facts;
Decision Delta includes the shared factual language envelope and evidence refs.
Observed action stays visible; seven-role detail and extra Personal actions are
collapsed by default. Existing factual context, exact pre-action Replay, source
provenance, legal alternatives and Analyze remain in the shared Review. The old
six-role exploit disclosure is suppressed when Deep Review is installed.
EN/RU/HE copy, native controls, RTL layout and LTR source/frequency islands are
provided. Disclosure and focused-control state survive metadata refresh.

## Personal intent and actions

Inspect current intent is explicit and read-only through the existing scoped
Personal adapter. It requires compatible Setup, Approach, rules and context and
direct evidence. It names the inspected Setup/Approach. The UI labels this as
current intent at the last inspection; it is never substituted for answer-time
intent. Preferred-only intent never becomes a fabricated 100% mix. A difference
is a question about intention, not correction. Inspect again after editing.

Change/refine opens the existing Personal workspace; edits still require its
normal explicit save. Leave unresolved writes nothing. Direct region targeting
from Review is unavailable with an explanation; the user chooses a region in
Personal Strategy. No inferred observed-to-intended mutation exists.

Review later and Situational use existing idempotent Saved decision annotations.
Save/annotate uses the shared Saved editor with a captured object and owner,
preserves notes/tags, and cannot retarget a different current Hand. Archive is
unavailable in this detached decision editor. Saving a canonical reviewed
decision also preserves its parent Hand if necessary. Cold reopen derives Review
again; no Delta, generated narrative or ranking is persisted.

## Study Inbox

Home receives one lazy disclosure, not a redesign. `study-inbox/v1` reads existing
owner-scoped APIs only on opening or explicit refresh. `study-next/v1` leads with
one recommendation and a disclosure containing the inspectable loaded queue.

Inputs are up to 25 Training due records, their distinct owning sessions, 25 Saved
Review-later objects plus 25 recent Saved objects (deduplicated by ID), and conflicts
from the selected Personal Setup/Approach/context evidence view. Review metadata
loads separately once per Hand/invalidation, from at most 50 Saved review and 50
recent objects, plus at most 50 decisions in the current completed Training session.
Limits are not whole-library retrieval or exhaustive historical synthesis.

Each Inbox row retains its domain owner, source reference, reason codes, due and
owner-priority facts, available decision context, destination and relevant source
facts. Resolved/archived/unsupported Saved objects are omitted. Ordinary Saved
objects remain intentional study objects; being saved is their reason. Personal
conflicts link to the selected Personal workspace; exact hand-class targeting is
not claimed. Source failures are visible and the recommendation is qualified as
covering only loaded sources.

Order is due Training (100), Saved Review later (90), Personal conflicts (60),
recent Saved (10). Ties use due date, existing owner priority, then stable source
ID. No model ranking, skill score, adaptation or hidden aging rule is introduced.
Training retains the meaning of due/remediation, explicit uncertainty handoffs,
and original reasons. Missing sessions and active Full Hands expose no answer or
review reasons. The outer identity-generation scope rejects mixed-owner reads;
owner events clear rendered content and reject stale callbacks.

## Handoffs, imports and opponent context

Training-backed Review and Inbox items invoke existing Same Spot / Similar Spot
controllers only while Training is idle. Explicit uncertainty revisit uses its
existing request/due token. Generator, planner, grading and frozen historical
comparison stay Training-owned. Review can prepare the recorded synthetic policy
in Full Hand setup, including custom parameters, target and policy seed; the user
checks table/Hero compatibility and explicitly starts a new Hand. It is not exact
continuation or a guaranteed concept exercise.

Played/imported canonical decisions without compatible Training Memory evidence
have explicit unavailable Practice/Similar results. Current recorded-rake imports
also lack a compatible Personal rake model. Unsupported semantic drills, exact
region teaching, continuation-gap and unusual-sizing detectors remain later
owner-backed slices; there is no proxy exercise or local grading.

Imported source hand ID, parser/reconstruction versions and exact/inferred/missing/
ambiguous/unsupported fact classifications remain reachable from Saved Hand v3.
Inbox saved-decision links use their parent Hand to reopen the exact journal
decision when available; legacy orphan Spots retain their existing Spot viewer.
No source uncertainty becomes zero. Current import contracts reject incomplete
canonical Hands. If a future partial source supplies ambiguous/missing/unsupported
facts without a dependency map, shared Review conservatively withholds comparison
and avoids provider resolution; Delta explains the downgrade and retains provenance.

Synthetic opponent policy and derived exploit facts occupy separate slots.
Conditional action weights do not establish reached ranges, weighted Equity,
real-person evidence or Hero correctness. Historical policy attachments remain
session-local unless an existing owner already preserves them.

## First pattern model

`projectReviewPatterns` derives repeated uncertainty or Personal-preference
difference only after three distinct source decision IDs in the loaded set share
the canonical hand family, rules fingerprint, street, position, table size,
facing-action family and exact effective stack. Unknown required context abstains.
The UI shows count and source samples, limits the claim to the loaded context,
and makes no skill-deficit claim or ranking uplift. Today the Inbox's encountered
uncertainty is the wired input; durable cross-Hand Personal-difference synthesis
requires a later observation owner. No pattern store is created.

## Verification and acceptance

Focused tests cover separate roles, heuristic exclusion, deterministic bounded
selection, source downgrades, immutable qualitative intent, actual owner reads,
Training embargo/handoffs, Saved import reload/provenance, resolution, stale-owner
rejection, safe editor targeting, pattern minimum/context, mounted EN/RU/HE and
detached callbacks. Existing Review/PERF, Training Memory, Personal, Import,
Opponent, Truth, NL, Saved and identity suites remain required regressions.

Browser inventory returned no enabled apps/browsers. Mounted DOM tests are
structural only. Human QA must check completed played/imported/policy Hands,
exact decision seeking, Review later → Inbox → reload → source decision,
Saved notes and Situational repeat, current intent mismatch/refine/unresolved,
due uncertainty/Same/Similar/active-session blocking, policy preparation, partial
sources, Guest/account switching, keyboard/focus, EN/RU/HE/RTL, 1366×768/narrow
desktop and Midnight/Daylight. No accepted checkpoint, full-suite gate or solver
verification is claimed. Nothing staged or committed.

Verification result: **220 distinct focused tests across 24 files passed**. The
main regression run passed 219/219; the final overlapping targeted pass passed
48/48 after adding exact-mixture/answer-time coverage. Eighteen changed/new JS/MJS
files passed syntax checks; `git diff --check` passed. The old tutorial assertion
requiring probability-gap priority was replaced with the reason-based contract.
No full repository suite or solver suite was run.

Self-review fixes included whole-Review comparison suppression for ambiguous
imports, source-owner session embargo, fixed annotation-editor target/owner,
parent-Hand preservation for played decisions, truthful source-time labels,
canonical exact-mixture array rendering, stale callbacks and inspection requests,
disclosure/focus retention, and no current-Hand archive from detached note editing.

## Ticket file inventory

Pre-existing unstaged foundation work was preserved and extended only at the
named integration points. No protected file, Git index or commit was changed.

| Area | Files (relative to repository) |
|---|---|
| New projections / presentation | `app/src/application/decision-delta.mjs`, `study-inbox.mjs`, `study-language.mjs`, `study-workspace.mjs`, `study-workspace-bootstrap.mjs` in the same directory |
| Review / Saved / Training integration | `app/src/application/hand-review.mjs`, `hand-import-study.mjs`, `training-memory-service.mjs`, `training-memory-bootstrap.mjs`, `opponent-practice-workspace.mjs`, `training-mode-bootstrap.mjs` in the same directory; `app/src/core/logic.js`, `app/index.html`, `app/styles.css` |
| Tutorial | `app/src/tutorial/current-app-tutorials.mjs`, `app/src/tutorial/home-tutorial.mjs`, `app/src/locales/tutorial-translations.js` |
| Tests | `tests/deep_review_study_inbox001.test.mjs`, `tests/opponent_practice_workspace001.test.mjs`, `tests/full_hand_review001_integration.test.mjs` |
| Contracts / state / QA | This spec; `docs/project/ARCHITECTURE_CONTRACT.md`, `INTERACTION_GRAMMAR.md`, `HAND_HISTORY_IMPORT_V1_SPEC.md`, `TRAINING_MEMORY_V1_SPEC.md`, `SAVED_STUDY_OBJECTS_SPEC.md`, `CURRENT_PHASE.md`, `PRODUCT_BACKLOG.md`, `PRODUCT_RETURN_QUEUE.md`, `QA_BACKLOG.md` in the same directory; `docs/project/capabilities/DEEP_HAND_REVIEW.md`; `docs/agent-prompts/AGENT_MASTER_CONTEXT.md` |
