# Reference source acquisition, coverage and health v1

`REFERENCE-STRATEGY-002`, September 6, 2026. Implemented foundation; human
acceptance pending under `QA-REFERENCE-STRATEGY-002`. No production source,
independent poker validation, or assessment policy is registered. This is an
explicit ticket exception, not a change to the general execution sequence.

## Scope and owners

The existing [Reference Pack v1](REFERENCE_PACK_V1_SPEC.md) validator and exact
matcher remain authoritative. The new application modules add intake metadata,
cryptographic identity, an inventory and health observations. They neither
solve poker nor interpret arbitrary solver trees. All production decisions
continue through StrategyProvider, ClaimPolicy and Strategy Truth.

Implemented:

- `reference-source-intake/v1`: bounded JSON input, six source classes, local-use
  and distribution distinctions, SHA-256 identity and validation evidence;
- `reference-coverage-map/v1`: one complete, exact preflop node per v1 pack;
- `source-health-entry/v1`: append-only, in-memory validation observations;
- additional acceptance coverage/claim bindings for SHA-256 intakes;
- provider integration for a reviewed redistributable intake, with no production
  registration; private import remains inspection-only;
- selected-reference diagnostics in Strategy Truth and the existing Analysis
  Limits & caveats display, localized in EN/RU/HE.

Not implemented: a Sources manager, vendor binary/CSV parsers, durable imports or
health database, cloud upload, paid acquisition, multi-node source routing,
postflop data, generalized source adapters, partial frequency repair, or a new
Training/Personal/Saved schema. These are explicit continuation work, not hidden
product capabilities.

## Intake model

`validateReferenceSourceIntake(input)` asynchronously validates this exact shape:

```js
{
  schemaVersion: 'reference-source-intake/v1',
  sourceClass: 'private_solver_export',
  visibility: 'private_local',
  displayName: 'My reviewed source',
  localUse: { status: 'permitted', evidence: 'Documented local-use permission' },
  pack: /* unchanged raw reference-pack/v1 JSON */
}
```

`sourceClass` is one of `licensed_solver_export`, `private_solver_export`,
`curated_exact_reference`, `reproducible_solver_run`,
`public_educational_range`, or `synthetic_benchmark`. Class is provenance, never
authority. A synthetic validation status must remain in the synthetic class;
the existing explicit test gate still controls runtime use. An input cannot
supply acceptance or an opaque validation token. Branding is display text only.

The nested pack preserves descriptor ID/version, pack ID/version, upstream
source identity/version/date, method, provenance notes, exact canonical rules,
positions, starting and effective stacks with their semantics, rake, prior
action tree, total-to sizing tree, all 169 strategy distributions, capabilities,
license name/identifier/URL, redistribution/repository permission, validation
corpus/metrics/evidence ID and declared limitations. The existing manifest's
`accepted_*` statuses remain **source evidence**, never application acceptance.

Local-use status and redistribution status are independent. Unknown or prohibited
rights do not become permission. A redistributable intake requires both permitted
redistribution and repository inclusion. A private solver export must be private.
Real sources with absent validation or assumptions cannot be converted by
inventing those facts; they remain rejected candidates until evidence exists.

The file entry point accepts a local File-like object with `size` and `text()`;
it does not accept a URL. Both declared size and actual UTF-8 size are checked
against 2 MiB. Exact envelope keys, declarative JSON, depth limits, prohibited
prototype keys and the existing strict pack validation bound the format. Returned
objects are detached, deeply immutable and recognized with a process-local
WeakSet. JSON-cloned tokens are not validated intake handles.

SHA-256 covers the key-sorted semantic JSON of the entire input envelope, including
rights, display name, upstream provenance, data and the legacy checksum. Whitespace
and object-key order do not create different identities; arrays retain order.
Exact node identity is a separate SHA-256 of the complete raw game assumptions.
Any material source edit requires a new reviewed identity/version and acceptance.
The legacy FNV-1a pack checksum is retained for compatibility and reported as
`legacyPackFingerprint`; it is not promoted into a cryptographic proof. A computed
SHA-256 is also not a signature or proof that provenance is truthful.

## Coverage inventory and query

`createReferenceCoverageMap(pack)` projects the pack's complete assumptions into
one node: variant/format, table size, ordered positions, Hero/aggressor, starting
and live effective stack, complete rules/rake, prior action/economics, supported
sizes and legal bounds, street, board, decision role and opponent boundary.
The board is empty; `boardFamily` is null. There are exactly 169 classes and zero
postflop nodes. This is a bounded node, not an entire six-max strategy tree.

`queryReferenceCoverage` calls the existing exact matcher. It never searches for
the nearest node, interpolates sizes or fills missing rows. The matcher now also
requires empty board/dead-card arrays, because a preflop class-only source does
not encode extra blocker conditioning.

| State | Meaning and v1 behavior |
|---|---|
| exact | Every canonical matcher requirement passes; says nothing about acceptance |
| incompatible | Known assumptions differ, e.g. 75bb, 3bb open, rake, position or extra blockers; no reference substitution |
| unavailable | Required canonical context/history/cards/rules are absent or validation/resolution fails |
| partial | Incomplete inventory evidence; malformed/missing classes are rejected for runtime use; health may report an unverified partial inventory |
| generalized | Reserved inventory/query vocabulary for explicitly generalized future adapters; v1 exact packs never emit this as a match |

The fallback's `StrategyContextCoverage v1` retains its existing three-state
contract. A fallback can be generalized while the selected reference is
incompatible. These describe different sources. Per-decision diagnostics carry
the selected source ID/version/fingerprint and mismatch dimensions without
copying the full inventory or calling the provider again.

## Source health ledger

`createSourceHealthLedger().inspect(input, options)` appends an immutable revision
with last-validation time, source/version/fingerprint, parser/adapter versions,
structural status, integrity status, exact coverage summary/query, mismatched
assumptions, missing class/node identifiers, license and redistribution facts,
declared validation evidence and independently accepted review status.

Structural rejection records unverified partial inventory and zero exact nodes.
It cannot make partial frequencies available. A complete structurally valid
source is `pending_review` unless the caller supplies a genuine application
registry record matching SHA-256 and node identity with reference authority and
exact coverage. Registry acceptance and current-spot compatibility remain
separate: an accepted 100bb source can be incompatible with today's 75bb spot.
`independentValidationStatus` defaults to `not_reviewed`, never inferred from
the manifest. Historical ledger entries do not change after later observations.

The ledger has no persistence, network, remote logger, or cross-owner lifecycle.
The caller owns its session lifetime. Invalid portable inputs retain computed
fingerprint identity where possible; unreadable/non-JSON data has no fingerprint.

## Two-step acceptance and consumers

Structural validation -> application-owned registry acceptance -> effective
source/capability/coverage ceilings -> ClaimPolicy -> consumers remains binding.

SHA-256 reference acceptance additionally requires `acceptedCoverageIdentity`
and explicit `acceptedClaimClasses`. Both source and node use full SHA-256 values.
`validated_reference` intake acceptance requires independently passed validation.
The provider checks the exact node binding; mismatches remove strong authority.
Allowed claim classes only narrow ClaimPolicy. They cannot grant optimality, EV
loss, accuracy or normative authority absent their separate prerequisites.
Source limitations cannot be suppressed. Normative permission requires the
separately accepted assessment policy; no such policy is registered here.
Legacy FNV-bound application records retain their established behavior.

The intake fingerprint replaces `provenance.contentHash` only for the new intake
provider path. Full assumptions are included in that identity. Legacy checksum
and coverage identity remain explicit additional provenance. Provider validation
and SHA computation happen at intake/creation, not on every decision.

Consumer audit:

| Consumer | Authority path and outcome |
|---|---|
| Analyze / Playbook | AnalysisExplanation consumes Strategy Truth; a translated coverage limitation appears in existing Limits & caveats |
| Matrix | Existing one-provider complete-node resolution remains; no per-cell repair or additional resolutions |
| Training | Answer evaluation consumes Truth; denied reference claims cannot become comparison/remediation |
| Training Memory / Review | Existing evidence serialization freezes source SHA/version, acceptance ceiling, ClaimPolicy and selected-reference facts; hydration never reauthenticates |
| Personal range comparison | `range-language-facts.mjs` uses Truth and explicit source role; Truth with an explicit source ceiling requires reference-match and deviation permissions before supplying reference comparison, so an allowlist cannot be bypassed by authority name |
| Deep Review / Study Inbox | Existing decision delta consumes Truth's permitted comparison; source class/name grants no new reason or remediation |

No consumer selects poker math or authority from provider brand. Historical Truth
continues to use its frozen policy; older records without new fields remain
readable. Neither provider rotation nor ledger revalidation rewrites old evidence.

## Private-source path and continuation

Implemented path: selected local JSON -> bounded parser -> canonical validation
-> checksum/SHA-256 -> immutable coverage/health preview in memory. The module
does not upload or persist it. Private intake activation in StrategyProvider
throws, even if a caller supplies an acceptance registry. This avoids leaking
private distributions into existing durable evidence/export paths before those
rights and ownership semantics are explicitly designed. There is no import UI
claim or production file shipped in this slice.

Next private slice needs a named vendor adapter and a concrete owner-scoped UX:
select file, inspect source name/version and exact coverage, show rights and
review status, keep a separate application review decision, and activate only
the approved fingerprint and claims. It must define guest/account switching,
local encrypted-at-rest expectations if desired, deletion, reload/revalidation,
historical frequency retention, export redaction and sync exclusions before
durable storage. “I own this file” is neither redistribution permission nor
independent validation. No cloud upload is the default; any future sharing needs
separate rights and user intent.

## Verification and human acceptance

September 6 final focused run: **157/157 tests passed** across
`reference_strategy002`, `reference_pack001_foundation`,
`reference_authority001_claim_policy`, `strategy_truth001`,
`perf001_product_performance`, `analysis001_explanation_service`,
`analysis001_app_integration`, `personal_strategy_intelligence_language`,
`training_memory001_foundation`, and `deep_review_study_inbox001` test files.
Syntax checks cover all 13 ticket JavaScript/test files; `git diff --check`
passes. No full-suite or solver run is claimed.

Focused tests cover identities and mutation, SHA-256 against Node crypto, exact
versus near-miss coverage, self-grant rejection, explicit claim ceilings, private
file limits/no fetch/activation refusal, immutable health history, provider
invocation counts, frozen Training evidence and EN/RU/HE catalog/RTL facts.

Browser discovery on September 6 returned no apps or browsers. Visual acceptance
is unverified. Human QA: open Analyze Limits & caveats in EN/RU/HE, both themes,
keyboard and narrow desktop; confirm no accepted-reference wording for the
ordinary heuristic; use synthetic development-only injection to check exact
accepted, exact-unaccepted, stack/size/rake mismatch and missing-context copy.
Review import API diagnostics separately: no Sources UI or durable import exists.
Never approve synthetic frequencies as production strategy evidence.

The [source decision and research](REFERENCE_SOURCE_ACQUISITION_2026_09.md) own
the recommendation and its licensing evidence. `RET-REFERENCE-PACK-001` remains
open for actual source acquisition and independent acceptance.
