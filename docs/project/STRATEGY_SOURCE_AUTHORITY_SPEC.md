# Strategy Source Authority and Claim Policy

Status: accepted implementation contract through `STRATEGY-TRUST-001`, August 31, 2026. No production Reference Pack or validated general Hold'em production reference is registered.

This specification defines how Riverline interprets a strategy result. It does not decide poker actions, tune the heuristic, validate a reference dataset, or make Personal Strategy a production provider.

## 1. Canonical dependency

```text
DecisionContext v1 / additive v1.1 facts
        ↓
StrategyProvider v1
        ↓
StrategyResult v1 + SourceDescriptor + ContextCoverage + capabilities
        ↓
StrategyClaimPolicy v1
        ↓
Playbook / Analyze / Matrix / Training / in-memory Full Hand review
```

`StrategyProvider` remains the required production strategy entry point. `StrategyClaimPolicy` is the only application authority that translates source metadata into permitted product claims. It never generates actions or changes probabilities. `DECISION-CONTEXT-SINGLE-AUTHORITY-001` is accepted: Scenario and Hand now reach this path only through their canonical application projectors selected by `resolvePlaybookDecisionContext()`, and missing/failed canonical resolution clears strategy state instead of manufacturing a fallback DecisionContext or StrategyResult.

The accepted trust boundary inside that path is: provider declaration ->
structural/source validation -> application-owned acceptance -> effective
bounded authority -> StrategyResult -> StrategyClaimPolicy. Strong authority
can never be self-declared.

## 2. Concepts that must remain separate

| Concept | Meaning | Canonical representation |
|---|---|---|
| Source identity | What generated the result | stable descriptor `id` |
| Source provenance | Which version, origin, method, and assumptions produced it | descriptor `version` plus `StrategyResult.provenance` |
| Declared source authority | Which epistemic/product role the source requests | descriptor `authority` |
| Accepted source authority | Which bounded role Riverline grants after validation/review | application-owned acceptance record and effective authority snapshot |
| Context coverage | Whether this source covers this exact decision | `StrategyContextCoverage v1` |
| Capabilities | Which data and comparisons the result genuinely supplies | descriptor declarations intersected with actual result data |
| Claim policy | Which statements a consumer may make now | `StrategyClaimPolicy v1` |

Legacy `confidence` and numeric `coverage` fields remain readable for additive `StrategyResult v1` compatibility. They do not grant authority and must not be used as a substitute for structured context coverage.

## 3. Source descriptor

`StrategySourceDescriptor v1` contains only metadata, never strategy datasets:

- stable source ID and version;
- localized display-name key;
- family (`heuristic`, `equity`, `reference_pack`, `learned`, `personal`, `manual`, or `unavailable`);
- requested/declared authority;
- declared capabilities;
- default coverage;
- source-level limitations.

Authority values are deliberately small:

- `none`: no strategy claim;
- `exploratory`: information may be explored but not graded as a reference;
- `comparative_reference`: may support explicit comparison to the named source;
- `validated_reference`: may support bounded normative claims only with exact coverage and declared normative grading;
- `personal`: intended user strategy, not poker truth;
- `observed`: recorded behavior, not intended or normative strategy.

Family, schema version, descriptor authority, and provider possession do not grant authority. A solver pack, learned model, heuristic, or personal source receives only the intersection of its declaration, actual result data, context coverage, and application-owned acceptance ceiling. Without acceptance, an otherwise usable unknown source fails toward exploratory semantics and receives no strong claim.

### Registry decision

Riverline has a small immutable built-in descriptor registry in `strategy-source-authority.mjs`. It covers the current preflop heuristic, postflop heuristic, equity fallback, and unavailable source. This is appropriate because old source IDs previously carried only implicit semantics and every consumer needs the same interpretation.

Future provider-owned descriptors travel with their `StrategyResult`; they do not require UI source-ID branches. Separately, the application composition root injects the immutable source-acceptance registry used by StrategyProvider. A provider cannot mint or persist its own trusted registry entry. Neither registry is a dataset store or a second strategy selector.

### Application-owned acceptance

An acceptance record binds exact source ID, allowed family, accepted authority,
capability ceiling, coverage ceiling, validation status, and optional decision
identity. Strong Reference Pack acceptance additionally requires an exact source
version and content fingerprint; neither may be null or wildcarded. Changed
bytes, wrong source/version/fingerprint, or revoked/superseded registry state
fail closed. Manifest `accepted_validated` and equivalent provider declarations
remain evidence only.

The opaque live acceptance token is process-local and used only during current
resolution. It is not serialized or persisted as proof of trust. StrategyResult
and durable Training Memory instead freeze a data-only answer-time authority
snapshot—source ID/version/fingerprint where available, accepted authority,
capabilities, coverage, validation/decision identity—and the resolved
StrategyClaimPolicy. Cloning or IndexedDB hydration cannot reauthenticate that
snapshot, silently upgrade it, or rewrite an old policy.

## 4. Context coverage

`StrategyContextCoverage v1` has three states:

- `exact`: the source explicitly matches the complete bounded context contract;
- `generalized`: the source intentionally provides an approximate/general fallback;
- `unsupported`: no claims may be made for this decision, even if data was accidentally supplied.

Coverage also carries a basis and structured limitation codes. This ticket adds no interpolation rules. A future HU 100bb pack must declare exact support only for its complete assumptions. Six-max, different stacks, different rake or sizes, limped trees, and postflop remain unsupported unless independently covered.

## 5. Capabilities

Only capabilities required by current consumers are modeled:

- action distribution: `none`, `qualitative`, `quantitative`, or `exact`;
- dominant/preferred action availability, derived from actual result actions;
- action sizing: `none`, `partial`, or `complete`, intersected with supplied action data;
- action EV: true only when declared and supplied for every result action;
- grading: `none`, `comparative`, or `normative`;
- optimality: separate explicit capability.

Important invariants:

- a dominant action is not an implicit pure 100% strategy;
- a quantitative distribution is not automatically exact or validated;
- action frequency is not action EV;
- reference disagreement is not automatically a mistake;
- exact personal frequencies remain personal intent, not normative truth;
- source confidence does not measure user skill.
- accepted exact or normative action distributions require numeric, finite,
  non-negative probabilities with mass one within the shared `1e-12`
  tolerance; percentage-unit inputs such as `60/30/10`, clamping, and semantic
  renormalization are rejected.

Range availability/provenance is not added to `StrategyResult` in this ticket because no current StrategyResult consumer receives a source-owned range. Existing range contracts remain separate.

## 6. Central claim policy

`resolveStrategyClaimPolicy(strategyResult)` returns a deeply immutable `strategy-claim-policy/v1` contract. `canStrategyClaim(resultOrPolicy, claim)` provides a narrow boolean query. The browser bridge exposes these operations without giving renderers authority logic.

Current claims include:

- strategy presentation, preferred action, and scoped recommendation;
- reference match/deviation and comparative grading;
- normative grading, objective correctness, mistake, and accuracy;
- optimality;
- exact frequencies;
- sizing;
- action EV and EV loss;
- normative curriculum weighting;
- source limitations.

The policy is derived from authority + coverage + effective capabilities + result availability. Consumers must not reproduce this matrix.

| Result semantics | Comparative wording | Correct/Mistake/Accuracy | Exact-frequency wording | EV loss |
|---|---:|---:|---:|---:|
| current heuristic, generalized | yes | no | no | no |
| validated reference, exact, normative capability | yes | yes | only with exact distribution | only with declared complete action EV |
| validated source, generalized mismatch | yes | no | no | no |
| personal exact mix | personal/intended-strategy semantics | no | yes, if exact distribution | no |
| observed behavior | observed-action semantics | no | only if the observation contract supports it | no |
| unsupported/unavailable | no | no | no | no |

Normative presentation is enabled only by declared metadata intersected with exact coverage, actual capabilities, and current application-owned acceptance, not provider-specific UI code. Synthetic fixtures may exercise consumer behavior but can never grant or simulate production trust merely by declaring an exact validated descriptor.

## 7. Current heuristic policy

The built-in heuristic is deterministic, versioned, known-provenance, generalized, quantitative, and comparative. It is a baseline for exploration and explicit comparison only. It remains useful for:

- exploratory Analysis;
- comparative Training feedback;
- rough provider-backed Matrix frequencies;
- action-price practice;
- deterministic reproduction while the same source version is available.

Heuristic agreement is not skill, accuracy, mastery, correctness, or GTO. The heuristic is not normative, optimal, exact-frequency, or solved-strategy authority. Heuristic disagreement is not objective error and must not automatically create remediation, a mistake queue, or curriculum priority. Product copy may describe the baseline's preferred action or distribution only when it remains explicit that the claim belongs to this exploratory source. Equity fallback remains exploratory, and unavailable remains unavailable.

The v4 preflop source preserves the v3 unopened, limped, BB-option, facing-3-bet,
and facing-4-bet-or-more probability paths. Inside the exact
`cold_response_to_open` role, its first bounded six-max, roughly 100bb BB versus
BTN 2–3bb open calibration replaces the former one-scalar facing-open
allocation with reusable structural hand facts and a separate generalized
policy. Other cold-response contexts retain the v3 curve until separately
calibrated. The policy exposes distinct continue value, passive realization,
and aggression suitability dimensions, so lower-value bluff candidates can
carry more aggression than stronger calls without a 169-hand chart or
hand-specific exceptions. The compatibility fallback family remains
`versus_open`; the numeric owner is reported separately as
`StrategyResult.details.probabilityPolicy`. Other roles retain the legacy
single-strength curve byte-for-byte at the probability level.

Canonical v1.1 contexts use `currentPotBb`, live Hero/effective stack facts,
`priorActionSummary`, and legal aggression facts; legacy `stackBb`/`potBb`
remain base-v1 compatibility only. The v4 calibration remains generalized,
comparative, non-EV, and not independently solver-validated.

`PREFLOP-ROLE-001` separates exact decision identity from those numeric curves.
`StrategyResult.details.decisionRole` / `actualRole` carries one stable role ID,
while `fallbackCalibration` (and the compatibility `decisionFamily`) names the
existing generalized curve used for probabilities:

| Exact role | Fallback calibration |
|---|---|
| `unopened_rfi` | `rfi` |
| `isolation_opportunity` | `limped` |
| `bb_option_after_limps` | `bb_option` |
| `cold_response_to_open` | `versus_open` |
| `blind_vs_blind_response_to_sb_open` | `versus_open` |
| `opened_facing_three_bet` | `versus_three_bet` |
| `cold_four_bet_opportunity` | `versus_three_bet` |
| `three_bettor_facing_four_bet` | `versus_four_bet_or_more` |
| `three_bettor_facing_cold_four_bet` | `versus_four_bet_or_more` |
| `opener_facing_cold_four_bet` | `versus_four_bet_or_more` |
| `limper_facing_isolation` | `versus_open` |
| `four_bet_or_more_unclassified` | `versus_four_bet_or_more` |
| `unknown` | legacy compatible family route |

The shared mapping is explicit and limitation-coded. In particular, BB versus a
BTN open and BB versus an SB open remain numerically shared for now but no longer
have the same semantic identity. A cold 4-bet opportunity retains that role even
while using the broad facing-3-bet curve. No row is a calibrated chart or solver
claim.

The v3 postflop source keeps its seeded conditional sampler and existing hand/board signals. It uses exact `currentPotBb` and HU `effectiveStackBb / currentPotBb`, applies one bounded position/SPR/history aggression-to-passive reallocation, disables a fake scalar SPR adjustment in multiway pots, projects away illegal aggression, and abstains rather than manufacturing price-sensitive behavior without exact decision economics. Legal bounds are not sizing recommendations, and postflop actions remain unsized.

It does not authorize solved GTO, Nash, equilibrium, proven optimality, objective correctness, exact exploitability, exact EV loss, calibrated confidence, or validated population-truth claims.

The policy does not hide or shame the heuristic. Normal UI uses concise source, precision, coverage, and one relevant limitation. Detailed structured facts remain available to Analysis.

## 8. High-risk context limitations

Known audit risks use one path: context classification → coverage limitation code → claim policy → localized consumer presentation.

Codes cover:

- limped preflop action-history semantics;
- facing 3-bet and facing 4-bet fallbacks;
- postflop position covered only by a bounded heuristic adjustment;
- postflop facing wager and facing raise;
- multiway postflop shared-range fallback;
- facing a wager without exact `callAmountBb` and v1.1 `currentPotBb`.
- an exact preflop role using a shared generalized calibration;
- exact preflop role facts being unavailable in a lossy context.

The remaining generalized-context codes do not retune heuristic probabilities or grading math. The missing-price code instead accompanies an unsupported, unavailable result. Training shows a compact high-priority context note. Analyze exposes the limitation through provenance/warnings. Matrix keeps one workspace-level precision/coverage summary rather than cell disclaimers.

Training continues to generate the same legal target distribution, but its
curriculum metadata now records the realized exact role and fallback calibration
separately from generic target labels such as `preflop_facing_4bet`. The current
generic facing-4-bet trajectory can realize
`three_bettor_facing_cold_four_bet`; it is not relabeled as an ordinary heads-up
four-bet response.

## 9. Consumer audit and resulting semantics

| Consumer | Data used | Previous claim risk | Current behavior | Reproduction state |
|---|---|---|---|---|
| Training | actions, probabilities, recommendation, source | public Correct/Acceptable/Mistake, accuracy, and streak language implied objective skill | internal grades/math remain; presentation says Matches/Close/Differs from Riverline reference, alignment rate/run, and policy-gated normative wording | exercise holds the full result in memory |
| Full Hand review | per-decision StrategyResult and internal grade | Correct/Mistake and grading summary | policy-driven comparison labels and source-frequency copy | full result exists only in the current in-memory snapshot |
| Playbook recommendation | recommendation, actions, explanation, warnings, source | source was visible but confidence/coverage numbers and generic recommendation lacked one claim authority | descriptor name/version, structured coverage, precision, and relevant limitation; recommendation stays scoped to Riverline | current result only |
| Analyze / AnalysisExplanation | actions, sizing, optional EV, provenance | AnalysisExplanation hardcoded source interpretation; undeclared EV could pass through | consumes claim policy, structured provenance and limitations; sizing/EV are capability gated | current result only |
| Matrix | 169 provider results | numeric cells could read as exact strategy frequencies | workspace source + quantitative/exact precision + generalized/exact coverage; still one provider result per cell | derived/cache state only |
| Replay / saved Hand | canonical replay state | no current frozen historical strategy result | replay resolves the current provider at the selected decision; it does not pretend to reproduce an old reference result | canonical state is durable; strategy result is not |
| Saved Spot/Decision | scenario/saved metadata | generic future historical label could become ambiguous | no StrategyResult is currently persisted, so no misleading historical source label is added | future frozen analysis needs an approved payload contract |
| Personal Strategy | separate evidence/snapshot contracts | intended, reference, and observed semantics could collapse during future integration | remains outside StrategyProvider; authority model reserves distinct personal/observed roles | durable Personal evidence remains its own authority |
| Home | Saved and Personal aggregates | fake accuracy/history risk | no Training/Analysis history is invented; no new consumer change | unsupported seams remain explicit |

The Saved `Mistake` review flag is a user annotation and is not reinterpreted as strategy grading.

## 10. StrategyResult versioning

The contract remains `StrategyResult v1`. New metadata is additive:

- `sourceDescriptor`;
- `sourceVersion`;
- `provenance`;
- `contextCoverage`;
- effective `capabilities`.

Existing built-in IDs resolve through the registry, so old additive-v1 readers remain valid. A v2 migration would add churn without improving safety. Unknown future source IDs require an accompanying descriptor.

## 11. Persistence and historical interpretation

No durable schema changes are justified now. Saved Hands preserve the canonical replay source, and Saved Spots preserve their declared lossy scenario facts; neither claims to freeze historical strategy analysis.

If a later ticket persists a resolved/frozen strategy review, it must store at least source ID, source version, authority at resolution, context coverage, and the relevant capability/limitation snapshot. It must not silently reinterpret the old result using today's registry policy. That future change requires an explicit SavedStudyObject payload/version decision.

## 12. Personal Strategy and future comparison

Future `StrategyComparison` must accept separate roles:

```text
intended Personal Strategy
        versus
selected Riverline/reference strategy
        versus
observed action or behavior
```

Personal dominant-only evidence remains qualitative/dominant-only; it must not be normalized into a fake 100% mix. Exact user-entered mixes may be described as exact personal frequencies but never as objective poker correctness.

## 13. Provider extension rules

### Validated bounded reference pack

The provider supplies a versioned descriptor and exact coverage only after matching every bounded assumption. Exact match may enable declared normative claims. Mismatch returns unsupported so another provider/fallback handles it. No consumer receives pack-specific branches.

`REFERENCE-PACK-001` implements this path as `reference-pack/v1` with a strict
declarative validator, exact canonical matcher, provider adapter, and unchanged
heuristic fallback. Production registration requires the accepted
`STRATEGY-TRUST-001` gate, explicit permitted redistribution/repository
inclusion, and application acceptance matching exact source ID, version, and
content fingerprint. Synthetic
fixtures require a test-only gate and cannot claim `validated_reference`.
There is currently no registered production pack, accepted frequency corpus, or
normative/EV/optimality upgrade. Contract and current source blocker are owned
by `REFERENCE_PACK_V1_SPEC.md`.

### Learned provider

The model supplies a versioned descriptor, explicit evaluation/validation basis, coverage, and actual capabilities. Being learned grants no authority. Generalized coverage cannot become exact merely because a confidence score is high.

### Solver-derived source

Being solver-derived grants no automatic trust. Reproducible assumptions, bounded coverage, independent validation, and declared capabilities determine authority.

## 14. Production trust acceptance

`STRATEGY-TRUST-001` is accepted. Before any production source receives trusted
or normative authority, one human-auditable application acceptance must bind
source identity/version, immutable content fingerprint, allowed family,
accepted capabilities and coverage ceiling, compatible license and
redistribution rights, reproducible or strong provenance, independent
validation against a predeclared corpus, exact mismatch behavior,
reviewer/decision identity, registration status, and revocation/supersession
behavior. Automated schema/integrity validation, manifest status, and an exact
matcher are necessary evidence, never the acceptance decision.

Read-only reference-source research may run in parallel with foundation work. One bounded source decision follows when the evidence is ready; research observations or private benchmark material do not become production truth.

## 15. Extension checklist

Before enabling a new production source:

1. define stable identity/version and provenance;
2. define the complete coverage matcher;
3. declare only capabilities present in every emitted result;
4. document validation evidence and satisfy the production trust acceptance record supporting the chosen authority;
5. prove unsupported contexts fall through without extrapolation;
6. run claim-policy consumer tests without adding source-ID UI conditions;
7. decide separately whether durable historical reproduction is required.
