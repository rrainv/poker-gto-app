# PERSONAL-STRATEGY-002R independent product and architecture review

Status: **HISTORICAL / SUPERSEDED FOR CURRENT SEQUENCING — COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED**

Date: August 26, 2026

Implementation state: **unchanged**

Accepted next implementation at this review's checkpoint: **`PERSONAL-STRATEGY-003A` / ACTIVE NEXT AT ACCEPTANCE**

Current planning note: this document preserves the August 26 `002R` rationale and then-current disposition. All `ACTIVE NEXT`, `PLANNED NEXT`, and ordering language below is historical. [Current Phase](CURRENT_PHASE.md) owns the post-audit foundation sequence and places `PERSONAL-STRATEGY-003A` after the foundation gates and learning-loop expansion. That sequencing update does not change the accepted `002R` product direction.

Human disposition: The product owner accepted the Game setup/Approach model, first-value reset, RFI-first scope, local-first Guest use, understanding vocabulary, surface consolidation, role boundaries, and bounded versioning direction on August 26, 2026. The review's stronger observed-pattern thresholds were not frozen; only the fewer-than-five history-only boundary was accepted. Provider/reference/observed integration remains planned after 003A.

## Review basis and verification boundary

This is the independent review rationale for the current Personal Strategy experience and its supporting contracts. Human acceptance authorizes `003A` as the next bounded implementation ticket, not runtime changes inside `002R` or premature provider/reference/observed integration.

The review used the current application source, Personal Strategy domain/application modules, governing product and architecture documents, all Personal Strategy specifications, capability dossiers, and focused automated coverage. The existing focused suite completed with **204 passing tests and 0 failures** across domain, persistence, lifecycle, inference, adaptive selection, Matrix, Builder, Teacher, preflop action contracts, sync, and UI structure.

No in-app browser was available in this environment after the required browser discovery and bootstrap checks. Therefore:

- the user journey and UI findings below are source-derived product findings, not live Firefox visual acceptance;
- EN, HE RTL, RU, 1920x1080, save/reopen, and interaction behavior remain structurally covered but visually unaccepted;
- no current screenshots, real account/provider path, or real-user session were available;
- the prior Firefox audit harnesses are historical evidence of intended acceptance matrices, not proof of the current product;
- no fresh competitive-product browser pass was performed, so no recommendation depends on competitor imitation.

## A. Executive product assessment

### Verdict

Riverline has a credible intended-strategy evidence foundation but does not yet have a coherent, low-friction Personal Strategy product. The current system is best described as a **preflop intended-strategy evidence workbench**. It is not yet ready to become a production strategy provider or to carry reference-versus-intended-versus-observed comparisons.

The architecture deserves to survive. The current information architecture does not deserve automatic preservation.

The strongest invariant is semantic honesty:

| Role | Meaning | May rewrite Personal Strategy? |
|---|---|---|
| **My intended strategy** | What the user says they want to play in an exact poker context | Only through explicit intended-strategy input or correction |
| **Selected reference strategy** | A named, versioned external or Riverline reference for compatible covered contexts | Never |
| **Observed behavior** | What a frozen evidence source records the user actually chose; today Training Memory means behavior inside Riverline Training, not verified real-world play | Never automatically |
| **Opponent policy** | A model or record of how another player tends to act | Never; it is a separate future authority |

The product job should be stated this simply:

> Teach Riverline how I want to play in a real poker setup, see what Riverline knows versus estimates, and later compare that intention with a selected reference and my observed decisions.

The current evidence contracts support the first half of that promise better than the UI communicates it. They do not yet support the second half safely enough for integration.

### Gate recommendation

1. Mark this review complete and await explicit human product acceptance.
2. Do not begin provider/reference/observed integration yet.
3. If the recommendations are accepted, run one bounded Personal Strategy product-model/first-value implementation ticket with an explicitly owned versioned profile migration.
4. Reassess provider integration only after that slice has real-user and Firefox acceptance.

## B. Current user journey

### Empty and first-use path

1. A Guest can see Personal Strategy entry points but cannot create Personal Strategy data. The product asks the user to sign in even though the subsystem otherwise presents as local-first and private.
2. An authenticated user reaches an empty state headed by “Teach Riverline how you play.”
3. The user must create a **profile**, select one of two canned environment types, name the profile, and name exactly three discrete **modes**.
4. The user then configures a preflop context: environment/rules assumptions, decision family, table size, Hero seat, effective stack, and family-specific action facts.
5. The user chooses Quick, Standard, or Deep questioning.
6. Calibration asks for the dominant action for one hand class at a time. The copy correctly states that a dominant answer is not a 100% frequency. An exact mix is optional. Skip and “I’m not sure” are session markers rather than intended-strategy evidence.
7. A checkpoint reports direct, inferred, uncertain, unknown, and conflicting coverage and may declare a starter profile ready under deterministic synthetic validation rules.
8. The user can switch between Range Teacher and Matrix. Matrix is the default tab. Range Builder opens as an advanced editing toolbar inside Matrix.
9. On return, owner-scoped profiles, modes, exact context selection, evidence, and resumable sessions are reconstructed. Optional account sync is a separate explicit setting.

### Existing-profile path

An experienced user can choose a profile, mode, and context; resume or start a question session; inspect the 169-cell Matrix; inspect evidence and derivation reasons; correct a cell; bulk-edit through Builder; or ask Teacher for a focused boundary, unknown, conflict, or quick-profile session.

### What feels natural

- Naming a real poker setup and a personal approach is more meaningful than choosing an abstract solver style.
- Answering a dominant action is fast and honest.
- Optional exact mixes let knowledgeable users add precision without making precision compulsory.
- Every accepted answer saves before the next question.
- “Why this question?” and evidence/history inspection make the system auditable.

### What requires too much assumed knowledge

- “Profile,” “mode,” “calibration,” “inferred high,” “boundary session,” and “Range Teacher” form an internal vocabulary before the user has received value.
- Exactly three modes are required before the user knows why a second approach would help.
- A detailed context and session-depth decision appear before the first useful answer.
- The default 169-cell Matrix foregrounds completeness and machinery rather than “what Riverline understands about me.”
- Current copy does not make the uneven intelligence boundary obvious: RFI receives modeled inference and transfer, while expanded preflop families are substantially more direct-evidence-driven.
- Training behavior, real-world play, intended play, and reference play are not yet available together, so users cannot currently validate why building the profile matters.

## C. Strongest current ideas

1. **One intended-evidence authority.** Calibration, Matrix, and Builder append to the same immutable evidence history rather than keeping separate range models.
2. **Dominant is not pure.** A quick Raise answer does not become a fake 100% Raise frequency. Tied exact mixes have no fabricated dominant action.
3. **Direct evidence outranks derivation.** Inference never silently corrects an explicit irregular answer.
4. **Abstention is first-class.** Unknown, uncertain, and conflict states survive instead of being filled for visual completeness.
5. **Evidence and projections are separate.** Inference, transfer, question ranking, Matrix snapshots, and Teacher recommendations are derived and are not persisted as user truth.
6. **Contradictions are preserved.** Independent sibling heads remain visible conflicts rather than being averaged into a fake strategy.
7. **User language is partly respected.** Names are user-authored and current modes are discrete rather than a hidden tight-to-loose interpolation.
8. **Question selection is inspectable.** Boundary, sparsity, uncertainty, diversity, and repetition reasons are exposed and deterministic.
9. **Precision is optional.** Dominant action, pure exact action, mixed exact action, and a tied mix remain distinct.
10. **Scope isolation is strong.** Profile, mode, and exact context boundaries constrain evidence and invalidation.
11. **Persistence and sync preserve identity/history.** Stable IDs, revision lineage, contradictions, owner isolation, import validation, and optional sync are established.
12. **Performance authority is clean.** Shared projections and scope-aware invalidation avoid each surface inventing its own computation.

These are durable product assets, not merely implementation assets.

## D. Weakest, most confusing, or most fragile parts

1. **The time-to-first-value is too long.** Account, profile, environment, exactly three modes, context, and session depth all precede a useful personal result.
2. **The product makes an unproven exactly-three commitment.** Three modes came from an earlier product hypothesis. It is not a natural law, and the current UI turns it into setup tax.
3. **Profile and mode are poor user terms.** They make users reverse-engineer the internal hierarchy.
4. **The account gate contradicts local-first expectations.** It may be an intentional commercial choice, but it is currently a product inconsistency rather than a clearly justified boundary.
5. **Environment identity is too canned.** “Home” and “ClubGG” are examples masquerading as the setup model. Real contexts also vary by format, rake/accounting rules, ante/blind structure, stack conventions, and table habits.
6. **The surface count overstates the number of user jobs.** Calibration, Matrix, Builder, and Teacher are mostly four entrances to one loop: state intention, inspect understanding, refine uncertainty.
7. **Matrix leads too early.** It is a strong expert inspection/editing tool, but a 169-cell grid full of small markers is not a welcoming value summary.
8. **Builder is a capability, not a destination.** Its grouped editing and undo are useful; its separate product name adds checklist complexity.
9. **Teacher has the best continuation job but the least clear name.** It sounds as though Riverline will teach the user a correct range, while the copy has to disclaim that it only asks for more intended evidence.
10. **Readiness and “high/medium” language can overclaim.** The deterministic mechanics are validated on synthetic fixtures, not calibrated against a real-user corpus. They are useful evidence-strength bands, not empirical confidence.
11. **The supported preflop surface is wider than the modeled intelligence.** Expanded action families can store canonical direct actions, but current regional inference/transfer remains centered on RFI Fold/Raise structure.
12. **Conflict creation is stronger than conflict resolution.** The history can preserve multiple heads, but the current one-parent revision model cannot resolve several conflicting heads with one explicit merge decision.
13. **No user-facing strategy version exists.** Append-only evidence is excellent audit history, but users cannot yet create a clear experiment, duplicate an approach, or restore a prior state through a first-class product action.
14. **Observed behavior is semantically easy to overstate.** Current Training Memory would establish observed Riverline Training decisions, not proof of how the user plays in the named live or online environment.

## E. Current architecture and evidence inventory

### Authority map

```text
Explicit intended input
  Calibration / Matrix correction / Builder group
                      |
                      v
       immutable RangeObservation history
                      |
                      v
        current-leaf evidence projection
              /       |        \
             v        v         v
       inference    Matrix    question/Teacher ranking

Training Memory DecisionRecord history ----> observed-behavior comparison only
Selected reference StrategyResult ----------> reference comparison only
OpponentPolicy ------------------------------> separate future role only
```

Personal Strategy is currently absent from `StrategyProvider v1` and Training generation/grading. That absence is correct at this checkpoint.

### Evidence inventory

| Current item | User meaning | Precision | Stored fields/provenance | Time/version behavior | Inference role |
|---|---|---|---|---|---|
| Calibration quick answer | “This is usually my action here” | Dominant-only | Stable observation ID; profile, mode, context, hand class; source/session; action; revision state; created/updated timestamps | Immutable record; later correction/retraction appends another record | Direct intended evidence |
| Calibration exact answer | “This is my intended full mix here” | Exact distribution, including pure or tied | Same identity/scope plus complete legal-action distribution | Immutable revision history | Highest-precision direct intended evidence |
| Matrix confirmation/correction | Direct inspection or correction for one cell | Dominant or exact | Source identifies Matrix; lineage links corrections | Appended, never in-place strategy rewrite | Direct intended evidence |
| Builder commit | Bulk user-authored intended edit | Dominant, pure, or exact per selected cell | Source identifies Range Builder; one action-group ID; conflicts skipped; atomic transaction | Grouped append with bounded undo through retraction | Direct intended evidence |
| Retraction | “This prior intended answer is no longer active” | No active action | Revision lineage and source retained | New history record; source record remains auditable | Removes a current leaf; creates no estimate |
| Independent sibling heads | Two incompatible intended claims | Conflict | Both immutable IDs and branches survive | Sync/import preserve both | Causes abstention |
| Legacy Personal Strategy `TrainingObservation v1` | Historical contract for a Training choice and optional direct comparison | Chosen action only; legacy RFI | Profile/mode/context/hand, Training session/exercise provenance, timestamps | Persistable/syncable contract, but no current product writer was found | Explicitly excluded from intended inference |
| Portable import | Another copy of canonical Personal Strategy records | Whatever the source record contains | Validates existing schema/IDs and rejects collisions | Imports the same evidence types; it is not generic solver/range adoption | Same as imported canonical evidence |
| Inference estimate | Riverline's deterministic projection from nearby direct intent | Qualitative action only | Evidence references, relationships, algorithm version/fingerprint, ordinal band | Recomputed; not synced or persisted as truth | Derived only |
| Context transfer | Qualitative projection from compatible nearby RFI contexts | Qualitative action only | Source scope, compatibility relation, derivation metadata | Recomputed; not direct evidence | Derived only |
| Question/Teacher ranking | “This answer may reduce uncertainty” | Ranking score/reasons, not strategy | Snapshot-derived reasons and deterministic version | Session/UI projection | Never evidence |

### Evidence gaps relevant to the next product model

- `createdAt`/`updatedAt` do not express a general `occurredAt` versus `recordedAt` distinction for future imported or real-world observations.
- There is no explicit numeric evidence confidence, which is good; current categorical bands must not be presented as measured probability.
- Current import supports Personal Strategy library portability, not adoption of an arbitrary reference or imported range as personal intent.
- Profile identity has timestamps and stable IDs but no named user version/checkpoint.
- The current profile contract requires exactly three mode IDs.
- A revision can supersede one parent but cannot explicitly merge several conflicting heads.
- The legacy Personal Strategy Training-observation contract would duplicate the newer Training Memory authority if it became a second live write target.

## F. KEEP / REWORK / REMOVE / DEFER surface audit

| Surface or control | Decision | Product reason |
|---|---|---|
| Personal Strategy as a top-level destination | **KEEP** | The user job is meaningful and distinct from Training, Saved, Matrix/reference inspection, and opponent modeling. |
| “Teach Riverline how you play” promise | **REWORK** | Change to intended language: “Teach Riverline how you want to play.” Observed play is a later, separately labelled source. |
| Guest account blocker | **REWORK** | Recommended default is device-local creation for Guests, with account sign-in required only for sync. Human product acceptance is required. |
| Empty state | **REWORK** | Promise a five-question first result and explain what will be learned; remove the three-mode tax. |
| Profile creation dialog | **REWORK** | Replace with a lightweight Game setup and one initial Approach. Advanced rules can follow before evidence is recorded. |
| Exactly three mode inputs | **REMOVE** | Start with one discrete Approach; add or duplicate another only when the user has a reason. Existing data must migrate without loss if approved. |
| User-named discrete approaches | **KEEP** | Do not invent a tight-to-loose continuum or interpolate between approaches without explicit evidence. |
| Home/ClubGG environment selector | **REWORK** | Treat these as templates, not the environment identity model. Show exact rules assumptions and allow a user-named setup. |
| Detailed preflop context builder | **REWORK** | Keep exact facts but use presets/progressive disclosure. Make first-use scope narrow and explicit. |
| Quick/Standard/Deep before first answer | **DEFER** | First use should default to five questions. Session depth becomes a returning-user choice. Do not promise time. |
| Dominant-action question | **KEEP** | This is the clearest and most honest fast-input mechanism. |
| Optional exact-mix editor | **KEEP** | Preserve pure, mixed, tied, and dominant-only distinctions; leave it collapsed by default. |
| Skip and “I’m not sure” | **KEEP** | Keep as session signals, never intended evidence. Clarify that they do not change Personal Strategy. |
| Session checkpoint | **REWORK** | Lead with direct facts, estimates, unknowns, and the next useful action. Avoid “ready” as an empirical quality claim. |
| Matrix | **KEEP / REWORK** | Retain as the expert Strategy Matrix and evidence inspector, but make it secondary to the personal summary/next-question loop. Simplify markers and progressive disclosure. |
| Range Builder as a named feature | **REMOVE** | Keep its bulk tools, grouped writes, conflict safety, and undo inside a Matrix **Edit** mode. |
| Range Teacher | **REWORK** | Rename to **Teach Riverline Next** and make it the primary continuation. Explain that ranking is a deterministic coverage-gain proxy, not GTO coaching or measured information gain. |
| Transfer and neighbor mechanics in first-use UI | **DEFER** | Show “estimated from nearby spots” when needed; keep graph/relationship details in Facts/Explain. |
| Evidence/history inspector | **KEEP / REWORK** | Essential for trust, conflicts, source, and restore; place it under Facts/Details rather than making evidence jargon primary. |
| Personal Strategy sync opt-in | **KEEP / REWORK** | Keep independent opt-in and frozen owner identity. Update copy so future observed Training data is not implied to be copied into intended strategy. |
| Reference comparison | **DEFER** | Implement only after a compatible selected reference and precision-aware Personal Strategy result contract exist. |
| Observed-behavior comparison | **DEFER** | Implement only as a view over frozen Training Memory or another explicit observed source; never as automatic intended evidence. |

### Real value versus implementation-checklist value

- **Real user value:** dominant questions, exact mixes, persistent intended history, honest unknown/conflict states, a focused “what should I tell Riverline next?” queue, Matrix inspection, bulk Matrix editing, and recoverable corrections.
- **Mostly checklist complexity in its present form:** three named modes at creation, three session-depth choices on first use, a separately branded Builder, a separately branded Teacher, dense marker taxonomy before value, and detailed inference mechanics in the primary flow.

## G. Recommended product model

### User-facing hierarchy

```text
Personal Strategy
  Game setup: "Tuesday home cash"
    Approach: "Usual"
    Approach: "Short-handed"
    Approach: "Against loose table"
```

**Game setup** is the user-recognizable real poker environment plus exact rules assumptions. It is not a personality and does not itself choose actions.

**Approach** is one discrete statement of how the user intends to play inside that setup. Approaches are user-named, unordered, and not points on an inferred aggression continuum.

**Exact context** remains below the approach: street, positions, action history, price, stack, legal actions, and immutable rules snapshot. Evidence belongs to an exact context even when the setup supplies defaults.

### How many approaches?

Exactly three is not a good first-use contract. The recommended model is:

- create a Game setup with one Approach;
- allow one or more active Approaches;
- add or duplicate an Approach when a real distinction arises;
- archive rather than destructively delete an Approach with evidence;
- do not interpolate between Approaches;
- do not force a second or third Approach for completeness.

This recommendation changes a versioned contract. It must be an explicitly accepted migration ticket, not an incidental UI patch.

### Product center

The center should be a compact **What Riverline understands** view:

- what the user directly specified;
- what Riverline estimates;
- what is unknown;
- what conflicts;
- one recommended next action.

Matrix becomes the detailed map. Matrix Edit contains the current Builder capability. Teach Riverline Next supplies the continuation queue. These are three views of one model, not three independent products.

## H. Terminology audit

| Current term | Recommendation | User-facing meaning |
|---|---|---|
| Personal Strategy | **Keep** | The user's intended strategy, never a reference or behavior log |
| Profile | **Rename to Game setup** | A named real poker environment and its rules assumptions |
| Mode | **Rename to Approach** | One discrete way the user intends to play in that setup |
| Anchor | **Keep internal / remove from primary copy** | Algorithmic or elicitation concept, not a user object |
| Range Calibration | **Rename to Teach Riverline** | Answer intended-strategy questions |
| Quick profile | **Rename to Quick setup** | The initial five-question evidence slice, not a finished profile |
| Matrix | **Keep as Strategy Matrix** | Detailed preflop range/evidence inspection |
| Range Builder | **Remove as a noun; use Matrix Edit** | Bulk edit tools inside Matrix |
| Range Teacher | **Rename to Teach Riverline Next** | Recommended intended-strategy questions; not GTO teaching |
| Inferred high | **Rename to Supported estimate** | Derived from stronger consistent local evidence; not empirical confidence |
| Inferred medium | **Rename to Tentative estimate** | Derived from weaker or less complete local evidence |
| Uncertain | **Use Tentative estimate or Unknown** | Avoid a second overlapping uncertainty vocabulary |
| Transferred | **Use Estimated from another compatible spot** | Derived and inspectable; never direct evidence |
| Conflict | **Keep** | Two incompatible direct intended claims require explicit review |
| Evidence | **Keep in Facts/Details** | The immutable source records behind a fact or estimate |
| Reference strategy | **Keep with named source/version** | A selected peer source, never “your strategy” |
| Observed play | **Qualify by source** | For example “Observed in Riverline Training”; do not imply live-game observation |

English, Hebrew RTL, and Russian should preserve these semantic distinctions rather than transliterating the old internal nouns. Poker notation and percentages remain LTR data islands.

## I. Recommended first-use flow

### Target: first honest value after five answers

1. **Enter Personal Strategy.** Copy: “Teach Riverline how you want to play. Answer five preflop questions to see what Riverline knows, estimates, and still needs.”
2. **Name a Game setup.** One required name. Choose a rules template or inspect/edit exact assumptions. Do not make “Home” or “ClubGG” the identity.
3. **Name one Approach.** Default to “Usual” and allow rename. Explain that another approach can be added later.
4. **Choose one clearly supported starting spot.** Recommend a common RFI preset, but show position, table size, stack, blinds/antes/rake assumptions, and legal actions before recording evidence.
5. **Answer five dominant-action questions.** Exact mix remains optional. Skip and “I’m not sure” clearly say “does not change your strategy.”
6. **Show a small honest checkpoint.** Example: “You directly specified 5 hands. Riverline can make 8 supported estimates, has 17 tentative estimates, and does not know 139. Nothing here is a reference strategy.” Counts are illustrative; the product must use actual snapshot facts.
7. **Primary CTA: Teach Riverline Next.** Secondary: “View Strategy Matrix.” Tertiary: “Add another Approach.”
8. **On return, show continuity.** Resume the exact Game setup, Approach, context, and pending question; also show the latest direct changes and unresolved conflicts.

### Progressive disclosure

- First use: one setup, one approach, one supported RFI context, five questions.
- Returning user: select focused question reason or session length.
- Advanced user: Matrix filters, evidence history, exact mix, bulk Matrix Edit, other direct-only preflop families.
- Later: selected reference and observed-source comparison.

No completion percentage should imply that 169 direct answers are the goal. The goal is useful, auditable understanding with honest abstention.

## J. Training Memory integration and explicit opt-in

### Canonical rule

Training Memory is the sole current authority for durable observed Training decisions. Personal Strategy stores intended strategy. Training must never automatically rewrite Personal Strategy, and the legacy Personal Strategy `TrainingObservation v1` contract must not become a competing live behavioral store.

### Recommended opt-in flow

1. Before the first decision in a Training session, offer an optional **Compare with my intended strategy** control.
2. If enabled, require the user to select a Game setup and Approach whose exact supported contexts can be matched.
3. Freeze that selected Personal Strategy snapshot/algorithm version and the actual reference source/claim metadata at answer time. A later profile edit must not reinterpret the historical comparison.
4. Freeze the user's Training answer before revealing reference or Personal Strategy comparison feedback.
5. Store the decision once in Training Memory. Store only a relation/attachment to the selected Personal Strategy snapshot, not a copied behavioral observation in the Personal Strategy repository.
6. Changing the selected setup/approach mid-session must explicitly end the current attachment segment and start a new one. It cannot retroactively relabel prior decisions.
7. The opt-in permits comparison, not adoption. If the user wants to change intent, provide a separate post-answer action: **Use this as my intended action** or **Edit my intended mix**. That action creates a new immutable intended record with explicit Training-adoption provenance after confirmation.
8. A future Training “Not sure” answer remains observed uncertainty in Training Memory. It creates no Personal Strategy action, no inferred mix, and no reference-correctness claim.

### Eligible versus ineligible comparisons

- Eligible: exact canonical context match, compatible legal action identities, frozen source versions, supported Personal Strategy precision, and explicit user opt-in.
- Ineligible: lossy nearest-context guesses, incompatible sizes/actions, a changed rules setup without a frozen version, unsupported postflop texture matching, or unselected intent.

## K. Reference and observed-behavior comparison

### Side-by-side roles

For one exact compatible decision, show peer columns rather than a winner hierarchy:

| My intended strategy | Selected reference | Observed in Riverline Training |
|---|---|---|
| Direct or derived badge; dominant/exact precision; setup/approach/version | Source name/version; coverage/authority/claim; exact/generalized precision | Chosen action or aggregate; source/session/time; sample label |

Rules:

- Never label a generalized heuristic as GTO, Nash, solved, optimal, exploitability evidence, or exact reference truth.
- When no compatible trusted production reference pack exists, say comparison is unavailable or show the current generalized Riverline heuristic as a separately labelled exploratory reference.
- A dominant-only personal answer supports action-family comparison only. It does not support a frequency-difference claim.
- Exact frequency deltas require exact compatible distributions on both sides.
- Derived Personal Strategy estimates must retain their estimate badge and evidence explanation in comparison views.
- Observed Training behavior must be labelled by source. It is not evidence of how the user played in the named live/online environment.

### Minimum data quality for observed patterns

Human disposition: the **1–4 compatible decisions → individual history only** rule is accepted. The stronger thresholds below remain review recommendations and must be specified and justified when observed-comparison analytics are implemented; they are not frozen product policy.

Use an effective sample that groups repeated Same Spot drills as correlated practice rather than pretending every repeat is independent.

- **1–4 comparable decisions:** show individual history only; no aggregate pattern language.
- **5–19 effective decisions:** show raw counts with “small sample; no pattern claim.”
- **20+ effective decisions across at least 3 sessions:** a recurring dominant-action divergence may be surfaced only when one alternative occurs in at least 70% of the effective sample and the 95% Wilson lower bound remains above 50%.
- **Exact intended-frequency comparison:** require at least 30 effective compatible decisions and at least 5 expected observations in each material action bucket before showing a frequency delta; show an interval and sample size, not a diagnosis.
- Any context, source-version, rules, legal-action, or precision incompatibility resets or partitions the aggregate.

These are conservative product-display gates, not poker-theory claims. They should be revisited with a real-user validation corpus.

### Facts / Explain / Coach threshold

1. **Facts** are always available: source, exact scope, direct/estimated status, precision, sample, version, and limitations.
2. **Explain** is available when Riverline can cite the actual evidence or comparison relation: “direct answer,” “supported estimate from these neighboring answers,” or “observed in 7 of 10 comparable Training decisions.”
3. **Coach** is optional and later. It requires the data gates above, a named reference with compatible authority, and language such as “consider reviewing” rather than “you should play.” Personal preference versus reference disagreement is not automatically a leak.

## L. Uncertainty, conflicts, corrections, and versioning

### Recommended visible states

Use one small state vocabulary:

- **Specified — dominant**
- **Specified — exact mix**
- **Supported estimate**
- **Tentative estimate**
- **Unknown**
- **Conflict**

“Transferred from another compatible spot” is a derivation badge under an estimate, not another certainty level. “Sparse” is a scope summary, not a hand-cell state.

Current high/medium bands may continue as internal deterministic categories, but they must not be described as calibrated probability or real-user confidence until validated on representative real evidence.

### Correction and conflict rules

- A normal correction creates a new immutable intended record and supersedes the selected prior head.
- Editing a quick dominant answer into an exact mix is a precision correction, not two coexisting truths.
- Independent imported/synced heads remain a Conflict until the user explicitly selects or merges the intended result.
- Observed behavior that differs from intent is **divergence**, not a Personal Strategy conflict.
- A reference that differs from intent is **difference**, not a conflict or error.
- Changing material Game setup rules creates a new version/scope. Old evidence is not silently reinterpreted under new rake, blinds, stack, action history, or legal sizes.
- A future multi-head resolution contract should allow one resolution event to cite every resolved head while preserving them in history.

### Smallest useful versioning model

Do not build Git for ranges.

1. Keep append-only evidence and grouped undo.
2. Add **Duplicate Approach** for experiments, with source Approach/version provenance.
3. Treat material Game setup rule changes as a new immutable setup version; cosmetic renames do not create a version.
4. Add **Restore this change** in history; restoration appends a new correction rather than deleting later history.
5. Defer named snapshots, branches, merges, and arbitrary rollback until real use demonstrates demand.

## M. Architecture corrections required before integration

### P0 — required before provider/reference/observed integration

1. **Accept or reject a versioned setup/approach migration.** `StrategyProfile v1` requires exactly three modes. A one-approach first-use model needs an explicitly owned additive/new schema, deterministic v1 migration, rollback/failure behavior, and preservation of profile/mode/evidence IDs.
2. **Define a precision-aware Personal Strategy provider result.** `StrategyResult v1` is quantitative. Dominant-only intended evidence cannot be turned into 100% without lying. Add a bounded precision-aware attachment/result version or allow an honest unavailable/qualitative result; do not smuggle dominance into exact frequencies.
3. **Keep Training Memory as the observed authority.** New integration should reference frozen `training-decision-record/v1` data and store consent/link/adoption events only where needed. Do not write duplicate live observed decisions to legacy Personal Strategy `TrainingObservation v1`.
4. **Define multi-head conflict resolution.** The current one-parent supersession lineage preserves conflicts but cannot close several heads with one explicit resolution.
5. **Freeze comparison scope/version.** Intended, reference, and observed columns need exact context, source/algorithm version, rules snapshot, coverage, precision, and claim semantics captured at comparison time.

### P1 — required for a trustworthy product slice

6. Treat canned environments as templates and ensure intended evidence keys exact immutable rules/decision facts rather than a display environment label.
7. Make the RFI inference boundary explicit. Other preflop families may remain direct-only until their own validated inference adapters exist.
8. Replace user-facing synthetic “ready/high confidence” implications with evidence-strength and unknown-coverage language.
9. Add the one-flow application projection that feeds summary, Teach Riverline Next, Matrix, and comparisons while preserving PERF-001 invocation and invalidation guarantees.
10. Preserve provenance for future Training adoption, setup duplication, and restore actions without adding a second evidence authority.

### P2 — later evolution

11. Add `occurredAt`/`recordedAt` semantics when a genuine external observed-play/import source exists.
12. Add postflop intent through a separate street-specific projection/inference adapter. Preserve canonical board, cards, action history, price, legal sizes, and combo identity; do not reuse a 169-class RFI graph as postflop authority.
13. Add an opponent-policy comparison only through its own versioned authority and explicit role label.

## N. Exact recommended next implementation scope

Recommended ticket: **`PERSONAL-STRATEGY-003A — first-value product-model reset`**

State at `002R` acceptance: **ACTIVE NEXT / HUMAN PRODUCT DIRECTION ACCEPTED**. This is historical checkpoint language; see [Current Phase](CURRENT_PHASE.md) for live status.

### One bounded outcome

A new user can create one real Game setup and one Approach, answer five supported RFI intended-strategy questions, and receive an honest “what Riverline understands” checkpoint without encountering a required three-mode form, a default 169-cell workbench, or provider/reference/observed claims.

### Accepted 003A scope

1. Add and migrate to the accepted versioned setup/approach cardinality contract while preserving all v1 IDs and evidence.
2. Adopt accepted user terminology in EN, HE RTL, and RU.
3. Implement the lightweight one-setup/one-approach/five-question first-use flow.
4. Make Teach Riverline Next the primary continuation and Strategy Matrix secondary.
5. Move current Builder tools under Matrix Edit without changing their evidence authority or atomic behavior.
6. Label the current intelligence boundary: preflop, with modeled RFI versus direct-only expanded families.
7. Replace “ready/high/medium confidence” implications with the accepted visible states.
8. Preserve sync opt-in, immutable evidence, scope isolation, conflicts, exact-mix semantics, and PERF-001.
9. Add migration/invariant/structural tests and perform real Firefox EN/HE/RU, 1920x1080 and 1366x768, empty/existing/save/reopen acceptance.

Provider, reference, Training Memory attachment, observed trends, inference-algorithm expansion, and postflop are not part of 003A.

## O. Explicit non-goals

- No implementation, schema migration, provider registration, reference pack, or Training integration in `002R`.
- No claim that current heuristic or inferred output is solved GTO, Nash, optimal, exploitability evidence, or exact EV.
- No automatic conversion of observed behavior into intended strategy.
- No automatic adoption of a reference or imported range as personal intent.
- No tight-to-loose interpolation between user Approaches.
- No second poker, Equity, range, Training, observed-evidence, strategy, Saved, or opponent authority.
- No production ONNX/model runtime, remote strategy API, solver-tree upload, or production promotion of synthetic fixtures.
- No postflop 169-cell reuse or texture-only authority.
- No arbitrary full version-control system for strategies.
- No visual acceptance claim without a real browser/manual pass.
- No runtime or implementation-contract mutation inside `002R`; accepted durable direction is recorded in the Personal Strategy capability dossier after human acceptance.

## P. Human product choices and disposition

The human product decision resolved the review gate as follows:

1. **Gate — accepted:** provider/reference/observed integration follows accepted `003A` rather than preceding it.
2. **Hierarchy — accepted:** use **Game setup → Approach** while retaining stable legacy identity through migration.
3. **Cardinality — accepted:** start with one Approach and allow more; exactly three is not the future product model.
4. **Guest boundary — accepted:** durable device-local Personal Strategy without mandatory sign-in; account ownership/sync stays governed by existing authorities.
5. **Initial scope — accepted:** lead with honestly supported first-in/RFI and label other contexts truthfully.
6. **Surface consolidation — accepted:** keep Strategy Matrix, merge Builder into Matrix Edit, and replace Teacher with Teach Riverline Next.
7. **Status language — accepted:** Specified — dominant, Specified — exact, Supported estimate, Tentative estimate, Unknown, and Conflict.
8. **Observed-pattern policy — partially accepted/deferred:** fewer than five compatible observations means individual history only; stronger thresholds are deferred to the analytics implementation ticket.
9. **Next ticket — accepted:** `PERSONAL-STRATEGY-003A` owns the versioned migration and first-value product reset.

The accepted state is:

> `PERSONAL-STRATEGY-002R` — **COMPLETED / HUMAN PRODUCT REVIEW ACCEPTED**
>
> `PERSONAL-STRATEGY-003A` — **ACTIVE NEXT AT `002R` ACCEPTANCE; CURRENT SEQUENCE SUPERSEDED**
>
> Provider/reference/observed integration — **HISTORICAL PLAN / AFTER 003A ACCEPTANCE**
