# Strategy Source Authority and Claim Policy

Status: `REFERENCE-AUTHORITY-001` implementation contract.

This specification defines how Riverline interprets a strategy result. It does not decide poker actions, tune the heuristic, validate a reference dataset, or make Personal Strategy a production provider.

## 1. Canonical dependency

```text
DecisionContext v1
        ↓
StrategyProvider v1
        ↓
StrategyResult v1 + SourceDescriptor + ContextCoverage + capabilities
        ↓
StrategyClaimPolicy v1
        ↓
Playbook / Analyze / Matrix / Training / in-memory Full Hand review
```

`StrategyProvider` remains the only production strategy entry point. `StrategyClaimPolicy` is the only application authority that translates source metadata into permitted product claims. It never generates actions or changes probabilities.

## 2. Concepts that must remain separate

| Concept | Meaning | Canonical representation |
|---|---|---|
| Source identity | What generated the result | stable descriptor `id` |
| Source provenance | Which version, origin, method, and assumptions produced it | descriptor `version` plus `StrategyResult.provenance` |
| Source authority | Which epistemic/product role Riverline may assign | descriptor `authority` |
| Context coverage | Whether this source covers this exact decision | `StrategyContextCoverage v1` |
| Capabilities | Which data and comparisons the result genuinely supplies | descriptor declarations intersected with actual result data |
| Claim policy | Which statements a consumer may make now | `StrategyClaimPolicy v1` |

Legacy `confidence` and numeric `coverage` fields remain readable for additive `StrategyResult v1` compatibility. They do not grant authority and must not be used as a substitute for structured context coverage.

## 3. Source descriptor

`StrategySourceDescriptor v1` contains only metadata, never strategy datasets:

- stable source ID and version;
- localized display-name key;
- family (`heuristic`, `equity`, `reference_pack`, `learned`, `personal`, `manual`, or `unavailable`);
- authority;
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

Family does not grant authority. A solver pack, learned model, heuristic, or personal source receives only the authority supported by its declared validation contract.

### Registry decision

Riverline has a small immutable built-in descriptor registry in `strategy-source-authority.mjs`. It covers the current preflop heuristic, postflop heuristic, equity fallback, and unavailable source. This is appropriate because old source IDs previously carried only implicit semantics and every consumer needs the same interpretation.

Future provider-owned descriptors travel with their `StrategyResult`; they do not require UI source-ID branches. The registry is not a provider selector, dataset store, or second strategy authority.

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

Normative presentation is enabled by descriptor and coverage facts, not provider-specific UI code. A synthetic exact validated descriptor therefore upgrades existing consumers without changing them.

## 7. Current heuristic policy

The built-in heuristic is deterministic, versioned, known-provenance, generalized, quantitative, and comparative. It remains useful for:

- scoped Riverline recommendations;
- exploratory Analysis;
- comparative Training feedback;
- rough provider-backed Matrix frequencies;
- action-price practice;
- deterministic reproduction while the same source version is available.

It does not authorize solved GTO, Nash, equilibrium, proven optimality, objective correctness, exact exploitability, exact EV loss, calibrated confidence, or validated population-truth claims.

The policy does not hide or shame the heuristic. Normal UI uses concise source, precision, coverage, and one relevant limitation. Detailed structured facts remain available to Analysis.

## 8. High-risk context limitations

Known audit risks use one path: context classification → coverage limitation code → claim policy → localized consumer presentation.

Codes cover:

- heads-up BTN RFI shared baseline;
- coarse six-max first-position opening;
- limped preflop action-history semantics;
- facing 3-bet and facing 4-bet fallbacks;
- postflop position not applied;
- postflop facing wager and facing raise;
- multiway postflop shared-range fallback;
- facing a wager without an exact call price.

These codes do not change heuristic probabilities or grading math. Training shows a compact high-priority context note. Analyze exposes the limitation through provenance/warnings. Matrix keeps one workspace-level precision/coverage summary rather than cell disclaimers.

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

### Learned provider

The model supplies a versioned descriptor, explicit evaluation/validation basis, coverage, and actual capabilities. Being learned grants no authority. Generalized coverage cannot become exact merely because a confidence score is high.

### Solver-derived source

Being solver-derived grants no automatic trust. Reproducible assumptions, bounded coverage, independent validation, and declared capabilities determine authority.

## 14. Extension checklist

Before enabling a new production source:

1. define stable identity/version and provenance;
2. define the complete coverage matcher;
3. declare only capabilities present in every emitted result;
4. document validation evidence supporting the chosen authority;
5. prove unsupported contexts fall through without extrapolation;
6. run claim-policy consumer tests without adding source-ID UI conditions;
7. decide separately whether durable historical reproduction is required.

