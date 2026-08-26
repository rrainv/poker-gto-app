# Reference Pack v1 specification

Status: `REFERENCE-PACK-001` provider foundation checkpoint; production source
acquisition intentionally incomplete.

## 1. Outcome and authority boundary

`reference-pack/v1` is the declarative contract for one exact, bounded preflop
strategy source. It enters the existing production path only through:

```text
DecisionContext v1.1
        -> StrategyProvider v1
        -> StrategyResult v1
        -> StrategyClaimPolicy v1
        -> Playbook / Training / Matrix / Analyze / Review
```

It is not another poker engine, result type, grading policy, UI data source, or
solver runtime. Consumers never branch on pack ID, source brand, filename, or a
`trusted` flag. Source authority and user-facing claims remain policy-derived.

This checkpoint is Outcome B. The contract, validator, matcher, adapter,
provider selection, fallback, and cross-consumer tests are implemented. No
production pack or production strategy frequencies are registered. Browser
discovery on August 26, 2026 returned no available browser, so the bounded
source-feasibility pass could not establish a legally redistributable and
independently defensible corpus. Repository frequencies are synthetic test data
only and are rejected by production registration.

## 2. Selected intake family

The first source-acquisition target remains:

- No-Limit Texas Hold'em cash;
- six seated players in canonical order `UTG, HJ, CO, BTN, SB, BB`;
- Hero in BB, heads-up at the decision after folds;
- BTN opens to exactly 2.5bb;
- exact role `cold_response_to_open`;
- 0.5bb/1bb blinds, no ante, no straddle, no collection/rake;
- 100bb starting stacks and 97.5bb effective chips behind at the decision;
- exact legal actions `fold`, `call`, `raise`, and `all_in`;
- source-declared raise-to sizes and exact legal total-to bounds.

This family is selected because canonical role facts, a bounded heuristic
comparison, and research benchmark fixtures already exist for it. Those
existing heuristic and benchmark artifacts are diagnostic evidence only; none
is promoted into production reference data.

If a future source for this family lacks clear rights, exact assumptions, or
reproducibility, source quality outranks this preference and a new reviewed pack
family/version is required.

## 3. Contract

A pack contains exactly four root fields:

- `schemaVersion`: `reference-pack/v1`;
- `manifest`: identity, source descriptor, exact game assumptions, source and
  redistribution facts, capabilities, validation evidence, and limitations;
- `representation`: one `preflop_169_class` row set;
- `integrity`: algorithm and deterministic content hash.

Identity includes immutable `packId` and `packVersion`. Changed data, tree,
method, or assumptions must use an explicit new version or family identity;
old semantics must never change beneath an existing identity/version.

The source record requires origin, method, identity, version, date, named
license, license identifier/URL, explicit redistribution status, explicit
repository-inclusion permission, and provenance notes. Permitted source origins
are Riverline-owned data, licensed data, clearly public data, or an independent
reproducible solver method. A manifest does not itself establish that its legal
or validation statements are true; production acceptance remains a reviewed
checkpoint.

The validation record requires a validation contract version, evidence
identity, status, authority decision, non-empty corpus and metric descriptions,
known limitations, and an acceptance date for accepted packs. Status is one of:

- `synthetic_test_only`;
- `accepted_comparative`;
- `accepted_validated`.

Synthetic packs cannot claim `validated_reference`, cannot register in normal
production mode, and require the explicit test-only adapter gate.

## 4. Exact assumptions and representation

Game assumptions retain the complete canonical `GameRulesDefinition v1` and
its semantic fingerprint, table size and ordered positions, Hero/aggressor
positions, exact decision role, starting/effective stack semantics, complete
bounded prior-action tree, legal action families, supported aggressive
total-to sizes, exact legal bounds, and the heads-up/multiway boundary.

The v1 data representation is exactly the canonical 169 preflop classes. Every
class must appear once. Every row must contain each declared legal action once
in canonical order, including explicit zero-frequency actions. Frequencies must
be finite, non-negative, and sum to one within `1e-9`; malformed production data
is rejected rather than normalized. Only canonical preflop action families are
accepted. Non-aggressive actions cannot carry sizes. Aggressive sizes are
total-to amounts and must be declared, legal, and unambiguous. All-in size must
equal the exact legal all-in total.

The contract does not create a parallel combo representation. A later source
that genuinely distinguishes suits/blockers requires a separately reviewed
representation change rather than silent expansion of v1.

## 5. Capability and authority validation

The manifest separately declares action-distribution precision, dominant-action
support, action-sizing coverage, action EV, grading semantics, and optimality.
Because v1 requires a complete distribution for every row, dominant-action
support must be explicit and true. Validation also enforces:

- no sizing capability without corresponding declared/row sizes;
- no row EV without `actionEv`, and no `actionEv` without every action EV;
- no normative grading without an accepted `validated_reference` review;
- no `validated_reference` authority for synthetic data;
- no `optimality` capability in `reference-pack/v1`.

An exact distribution means the pack preserves the accepted source's exact
declared frequencies for its exact node. It does not by itself mean solved,
Nash, GTO, exploitability-tested, or optimal.

Production registration additionally requires an accepted comparative or
validated status, permitted redistribution, and explicit repository-inclusion
permission. The current repository contains no such accepted pack.

## 6. Integrity and security

The validator accepts portable declarative data only and requires exact object
keys. Integrity uses deterministic key-sorted serialization and
`fnv1a32:<hex>` content identity across the full pack except the hash value
itself. This checksum detects accidental mutation and identity/version
tampering; it is not a cryptographic signature or proof of provenance.

Pack validation occurs before adapter registration. Runtime packs execute no
code, fetch no remote data, load no arbitrary solver tree, and invoke no solver.

## 7. Exact matcher

`reference-pack-context-matcher/v1` accepts only canonical-hand-derived
DecisionContext v1.1 input. It requires exact equality for:

- game variant and format;
- complete blinds, ante, straddle, and collection/rake definition plus semantic
  fingerprint;
- seated table size and canonical ordered positions;
- Hero and aggressor positions;
- exact preflop decision role;
- starting and effective chips-behind stack;
- live opponent count;
- prior-action families, actors, aggression depth, limpers, distinct
  aggressors, Hero prior voluntary action, and cold-action semantics;
- exact open-to size, incremental call, Hero contribution, and current pot;
- raise availability, min/max/all-in total-to bounds, and legal action support;
- a valid canonical Hero hand class.

Any mismatch returns structured `unsupported` coverage with stable limitation
codes. V1 never maps neighboring sizes or stacks, changes table formats,
ignores rake, or interpolates contexts.

`DecisionContext.gameRules` is the additive canonical rules projection that
makes this comparison possible. Legacy PokerState v1 and snapshot-authoritative
v2 project semantically identical rules; lossy/unknown Scenario rules remain
unavailable and therefore cannot match.

## 8. Provider selection and fallback

`reference-pack-provider-adapter/v1` validates the pack once, indexes all rows
in a `Map`, and resolves a matched hand class by direct lookup. A matched pack
emits a normal StrategyResult v1 with its source descriptor, exact coverage,
effective capabilities, action distribution, supported sizes, provenance,
limitations, pack identity/version/hash, validation status, role, and hand
class.

StrategyProvider checks the configured adapter before its existing heuristic
fallback. An exact match returns only pack data. Unsupported coverage, missing
facts, or a resolution error invokes the unchanged heuristic resolver, whose
source remains `heuristic_preflop` or `heuristic_postflop`. Pack and heuristic
frequencies are never blended, missing rows are never filled, and no consumer
chooses the source.

Normal production bootstrap currently supplies no pack. Its steady-state cost
is one null check. A configured pack uses validation at provider creation,
strict field comparisons per decision, and an O(1)-style in-memory Map lookup;
there is no network or heavy runtime compute.

## 9. Consumer and claim-policy behavior

- Playbook retains the normal StrategyResult source, precision, provenance, and
  limitations surfaces.
- Training grades the same result; comparative packs stay comparative, while
  normative wording requires policy-authorized exact validated capability.
- Matrix resolves one complete 169-class node through the provider. A complete
  match is coherent; an unsupported context uses the normal fallback without
  per-cell source repair.
- Analyze consumes the result through AnalysisExplanation and does not recreate
  source semantics.
- Full Hand Review re-resolves only reconstructable historical decision
  contexts. A similar current pack never makes a mismatched old context exact.

Policy permits exact-frequency display only when exact distribution and exact
coverage survive result capability resolution. No action EV means no EV or EV
loss claim. No optimality means no optimal language. `comparative_reference`
permits comparison but not normative grading.

## 10. Current evidence, limitations, and resume point

Automated evidence covers schema/provenance/license/integrity validation,
complete 169 rows, malformed probability/action/size/EV rejection, every
material mismatch dimension, provider selection, unchanged fallback, no source
mixing, claim policy, deterministic output, Map lookup, and generic Playbook,
Training, Matrix, Analyze, and Review consumption. Existing reference-benchmark
tests remain research-only and do not validate the synthetic frequencies.

Known limitations at this checkpoint:

- no production-safe source corpus was available for review;
- no independent solver methodology or reproducible artifact was supplied;
- no external/private validation corpus was available;
- no action distribution, sizing tree, EV, normative grading, or optimality is
  accepted as production poker truth;
- no browser was available for manual Firefox inspection.

Resume `REFERENCE-PACK-001` source acquisition only when a candidate source can
provide exact assumptions and action-tree semantics, explicit compatible
license/redistribution rights, immutable versioned data, reproducible method or
strong provenance, and a predeclared independent validation corpus/metrics.
Review that evidence before setting an accepted status or registering data.
Do not convert benchmark observations or the synthetic architecture fixture
into a production pack.
