# Opponent Policy v2 and actor information

September 6, 2026. Actor-safe foundation plus `OPPONENT-INTELLIGENCE-002` / policy-conditioned Training / opponent-review foundation: bounded implementation, human acceptance pending. This is the current contract; [Opponent Intelligence](capabilities/OPPONENT_INTELLIGENCE.md) preserves broader intent.

## Information and authority

The additive [Exploit Analysis v1](EXPLOIT_ANALYSIS_V1_SPEC.md) consumes this unchanged policy through a context/action-bound response envelope. Branch-weight criteria supply conditional teaching, Personal check-count questions and separate completed Review facts. No actor-input, behavior-version, quantitative-range, history-specific aggression or normative capability changes occur.

`opponent-actor-information/v1` is an immutable allowlist built outside the selector. It contains the acting seat/ID, its own cards (or explicit unknown), current public board, public action records, positions, live stacks/contributions, pot, blinds/chip unit, and canonical legal actions. It contains no PokerState, Hand ID, rules provenance/fingerprint, other private cards, dead/burn cards, terminal evaluation, future schedule, deal seed, or Replay identity. Canonically known private cards are not proof of public visibility. Canonical private reveals currently happen after betting; future public reveals during betting require an explicit visibility contract, never a guess based on non-null cards.

Full Hand keeps its private deck schedule in the application controller. Only the current actor's two cards pass from that schedule to the projector; Hero's observer state stays hidden for bot cards until canonical showdown. The projector does not mutate PokerState. The wrapper validates the selected action through canonical `applyAction`, and `CanonicalHandSession` alone commits it. Projector/selector are trusted in-process application code, not a sandbox for downloaded selectors or closures over private state.

The old whole-PokerState fingerprint was unsafe even for selectors that ignored cards. All policies now receive the actor boundary. The retained basic policy has behavior version `deterministic-legal-heuristic/actor-safe-v2`; historical records are not recomputed as if they came from this version. Existing v1 factory shape remains for internal basic/test selectors, but full PokerState access is deliberately removed under the correctness gate.

Policy seeds are explicit uint32 inputs independent of deal randomness. Basic assignments default to policy seed 0; the compatibility `handSeed` argument no longer contributes to bot randomness. Configured assignments derive seat streams from the policy seed. Decision streams use that base seed, seat/public action ordinals, and policy identity/version, never hand/chance seed or Replay event count. The wrapper mixes only that decision seed, actor information, configuration and policy identity/version. Callers must not source policy seeds, IDs, or configuration from hidden data.

`stateFingerprint` now has the `actor-information-fnv1a32` prefix and describes only the allowlisted input. It is a compact diagnostic, not a cryptographic or collision-free cache identity. The separate canonical serialized `cacheKey` includes full observable information, policy ID/version, exact configuration, and decision seed. There is no application decision cache in this slice. Consumer cache equality is covered by counterfactual tests.

## Configurable synthetic policy

`opponent-policy/v2`, ID `riverline.synthetic-opponent`, behavior `context-action-selection/v2`, contains an immutable `synthetic-opponent-parameters/v1` configuration. All four values are explicit integer percentages in [0, 100]:

| Parameter | Exact semantics |
|---|---|
| `freeAggressionPercent` | If checking is available, choose the legal bet/raise with this weight; otherwise check. If neither aggressive action is available, check. |
| `facingRaisePercent` | When facing a wager, choose a raise with this weight if canonically available. No explicit all-in action is selected. |
| `smallPriceCallPercent` | Conditional call weight among the remaining non-raise decisions when incremental stack-capped call price is at most one third of current pot, including the wager. |
| `largePriceCallPercent` | The same conditional call weight for larger incremental prices. |

Facing a wager, remaining weight folds. If raising is unavailable, the call percentage applies to the entire decision. Effective action weights sum to 10,000; the seeded sample selects one action. Bets/raises always use canonical minimum-to sizing. Calls can be stack-capped all-in. No UI arithmetic or second legality engine exists.

Configured practice uses a finite automation budget derived from public starting chip units plus bounded check/fold/chance/reveal events. This permits legal 500bb minimum-raise sequences beyond the old 256-event basic-policy guard. Explicit caller limits remain authoritative and fail with a latched error; the basic default retains 256.

These are deliberately **card-independent action-selection assumptions**, applied on all canonical Hold'em betting streets for 2–10 seats. This is not a hand-strength, value/bluff, population, equilibrium, or sizing strategy model. Rules outside existing Full Hand Training support remain rejected by Training before progression. Unsupported configuration/request versions, contexts, formats, percentages, or unavailable target roles fail explicitly. No fallback silently changes a configured request.

| Presentation preset | Small call | Large call | Free aggression | Facing raise | Practice distinction |
|---|---:|---:|---:|---:|---|
| Calling-heavy | 90 | 65 | 15 | 5 | More calls to study continuing branches and value/bluff assumptions. |
| Aggressive | 65 | 45 | 65 | 35 | More wagers and raises to study responses. |
| Tight/passive | 45 | 15 | 10 | 5 | More folds and checks to study different response branches. |

Labels only populate explicit parameters in setup and never enter behavior or seed identity. Changing a parameter changes the configuration/cache identity. Check-raise-heavy and value-heavy presets are deferred until history/hand-class semantics justify those names. No Easy/Medium/Hard identity is introduced.

## Training and review

`opponent-practice-request/v1` freezes policy ID/version, exact configuration, independent policy seed, target role, allowed context, and Hold'em/no-limit/table-size constraints. The Full Hand start adapter/controller passes it into automated progression. The UI offers all opponents or BB only, three presets and four editable parameters. A role matching Hero or no seated opponent is rejected. Unselected seats retain the actor-safe basic policy. TrainingConfig, planner, legal generator and grader contracts are unchanged; policy results never feed normative evaluation or the StrategyProvider.

The completed automated Hand and bot journal retain the exact request, assignments, base and decision seeds, policy identity/schema/version, parameters, action, observable inputs, deterministic metadata, selection/sizing provenance and canonical Replay references. Terminal UI explains configured weights for each recorded branch; EN/RU/HE use a factual `natural-language-envelope/v1` with subject `synthetic_opponent_policy`, never a Hero assessment. Numeric tokens use RTL isolation. Replay seed preserves the frozen policy request even if draft parameters change. Controller reset clears journal/request/review; bridge reset also releases rendered review evidence. New choices affect new hands, not recorded decisions.

This evidence is session-local. There is no new database, export format, person store, Saved payload or Training Memory migration. Existing Saved/reopened Hand and durable Training Memory replay do **not** acquire bot-policy evidence through this ticket. Persistent policy review is a future explicit payload/lifecycle decision, not an implied extension of existing stores.

## Educational connections and future boundaries

### Educational implementation (002)

`policy-conditioned-training-intent/v1` is an ephemeral Training-owned envelope over the unchanged `opponent-practice-request/v1`. It freezes the exact policy request and one study theme: play against the selected policy, explore thin value, explore bluff-catching, or plan responses to raises. Three parameter presets and custom configuration remain independently selectable. The UI states that these are reflection questions for a **new Full Hand**, not guaranteed semantic drills. The controller rejects a missing/mismatched policy request; only the opponent request enters automation. Neither theme nor policy enters provider/grader inputs. Replay seed retains both frozen envelopes; reset clears them. Varied/Focused planner, generation, assessment and durable Memory schemas remain unchanged. The existing Bluff/Exploit Full Hand preparation adapter now supplies the same educational envelope; unsupported exact concept requests still return unavailable.

The Full Hand review retains the policy request and study theme alongside its original bot journal. `opponent-decision-review-facts/v1` projects the recorded policy version/configuration, actor input, exact action, active parameter influences, configured action weights, seeds and replay reference. Completed-hand disclosures show actor cards as known at that decision, public board/history/stacks, pot, incremental call price, canonical legal choices, active settings and sampling/replay details. The panel remains hidden before completion, clears on reset, and does not recompute history from current setup controls. Evidence is **session-local**; Saved and durable Training Memory replay do not preserve these new envelopes.

`opponent-learning-comparison/v1` compares the four conditional settings and associates differences with small-price, large-price, free-action or facing-wager questions. Full Hand setup displays two configurations side by side. The existing Bluff/Exploit comparison adds the same parameter-grounded questions. These are descriptive questions, not predicted response ranges, action recommendations or value/bluff classification. EN/RU/HE and RTL isolation are implemented; the existing synthetic-policy natural-language envelope supplies parameter facts.

`personal-opponent-study/v1` projects the current immutable Approach snapshot, exact node/trajectory identity, current region coverage and question evidence/action precision. **My Approach under opponent assumptions** in Teach through a hand pairs the selected policy's questions with mapped, missing/conflicting and preferred-only coverage and offers the existing region editor when that region has an available question. Policy changes write nothing, change no intended actions or reached mass, and call no provider/Equity service. Unknown coverage is a teaching gap, not evidence of weak play against a policy. Current-render abort and owner/context fences dispose old controls. A Personal-Strategy-as-bot adapter is still absent.

### Parameter audit (002)

Retain the four parameters and behavior version: small/large incremental prices already create a useful distinction; free aggression and facing raises support betting and raise-response questions. Separate preflop looseness, river aggression, aggression **after another player's check**, and check-raise frequency would need new street/history conditions, behavior-version semantics and additional invariants. They are not implemented or implied by current controls. No slider wall or new archetype label is justified. All presets explicitly disclose all-street, card-independent, minimum-size coverage and these unsupported distinctions.

### Action selection versus quantitative response

**Range Evolution:** this is action selection only. `quantitativeRangeResponse` is explicitly unavailable. A future quantitative response contract must bind exact starting-range identity, immutable policy/model snapshot, actor/public context, exact action/size, combo-level likelihoods with coverage/unknown semantics, and method/version. Only then can canonical Range Core multiply and remove public blockers. Aggregate action weights here do not justify a reconstructed opponent range or an assertion that a branch stayed wider.

**Personal Strategy:** the read-only educational connection above is implemented. Future bot adapters must additionally bind immutable owner/Setup/Approach/evidence versions and exact action/size coverage. Missing evidence returns unavailable; adapters must not invent actions or overwrite intent. Hero selected Personal Approach, intended-response comparison, and opponent policy remain separate roles. No Personal-Strategy-as-bot adapter is implemented.

**Real opponent evidence (design only):** a future observation should bind `ownerId`, optional consented subject ID, observation ID, opportunity definition/version, exact comparable context (rules/table, role, street, board, stacks, prices, public action sequence), eligible opportunity, observed exact action/size or explicit missing outcome, observation timestamp, source/provenance and visibility basis. Counts need an explicit denominator: e.g. 9 check-raises in 43 comparable opportunities. Missing/incomparable observations are not folds or zero frequency. Facts also bind the contributing observation IDs, time window, comparability method/version, uncertainty and selection-bias limits. An immutable model snapshot separates current mutable observations from “Train against Alex.” Ownership, consent, privacy, retention, deletion/export, sharing and source rights must be resolved before any persistence. Home Game participation/accounting never opts anyone into profiling.

The future evidence boundary has three separate records, **design only; no runtime collection or persistence is authorized**:

| Layer | Required binding / failure behavior |
|---|---|
| Raw observation | User owner, explicitly consented subject (if any), immutable observation/source ID, opportunity definition/version, exact public context and action/size or missing outcome, visibility basis, occurrence and capture timestamps. Correction preserves lineage; duplicate source events do not create new opportunities. |
| Derived estimate | Immutable snapshot ID/version, contributing observation IDs, exact comparability criteria/version, time window, eligible and observed denominators, action count, missing/incomparable counts, uncertainty/selection-bias limits. Missing results are excluded from observed-action rates, never counted as folds. Unsupported comparison returns unavailable. |
| Synthetic configuration | Explicit parameters, policy identity/version and seed. No person identity or automatic conversion of counts to an archetype. An explicit future model-to-policy adapter must separately declare coverage and approximation. |

A future statement such as “9 check-raises in 43 comparable observed opportunities” must bind its exact denominator and disclose missing outcomes; it cannot become “Aggressive player.” Training from an estimate must freeze that estimate and its adapter version. Export must carry user-owned observations, lineage, source rights and derived dependencies; deletion must remove or invalidate dependent estimates and practice attachments; consent withdrawal must block new derivation/training. Identity/account relationship, display name, shared device and Home Game membership are never consent or evidence links. Existing account/Personal Strategy storage is insufficient authorization for a real-person model, so this ticket creates no subject store, observation intake, telemetry, Home Game linkage, import or sync.

**Bluff/Exploit:** [Teacher v1](BLUFF_EXPLOIT_TEACHER_V1_SPEC.md) now consumes explicit policy snapshots through `synthetic-response-facts/v1`, sharing the selector's weight function. It supplies assumption-labelled reasoning and comparisons, with unchanged bot behavior/version. Compatible quantitative response ranges, canonical weighted Equity and optimized exploit recommendations remain future; no normative authority is added.

## Verification and human acceptance

002 verification: 124/124 tests passed in the main Opponent/Training/Personal/Bluff/tutorial regression group, including complete-hand reconstruction and hidden/future-card counterfactuals. The existing 500bb always-raise test took about 332 seconds (whole group 345 seconds); this remains a known long minimum-raise performance limitation, not interactive acceptance. A 76/76 follow-up group passed updated mounted Personal region navigation/disposal, exact range rejection, Replay visibility/lifecycle, strategy-truth, PERF-001 and tutorial checks. Final copy/seed-label corrections passed the eight-test new-intent/mounted-opponent group. All 16 ticket JavaScript/MJS files passed syntax checks; diff hygiene passed. No full-suite or solver run was performed. Browser inventory was empty; `QA-OPPONENT-POLICY-002` owns hands-on acceptance and previous owners remain open. Nothing staged or committed.

### Implementation map (002)

This continuation adds four application modules and one test file, and extends the existing in-progress foundation files listed below. Earlier working-tree changes are preserved.

| Changed files | Purpose |
|---|---|
| `app/src/application/policy-conditioned-training.mjs` (new) | Frozen educational intent and exact request validation. |
| `app/src/application/opponent-learning-facts.mjs` (new) | Descriptive comparisons, recorded branch facts, read-only Personal node projection. |
| `app/src/application/opponent-learning-language.mjs` (new), `opponent-learning-workspace.mjs` (new, same directory) | EN/RU/HE questions, comparison columns and Personal region links. |
| `app/src/application/opponent-practice-workspace.mjs`, `full-hand-training-session-controller.mjs`, `training-mode-bootstrap.mjs` (same directory), `app/src/core/logic.js` | Full Hand controls, intent lifecycle, review and replay wiring. |
| `app/src/application/personal-strategy-hand-workspace.mjs`, `exploit-teacher-workspace.mjs`, `exploit-training-request.mjs` (same directory) | Personal and Bluff/Exploit connections. |
| `app/styles.css`, `app/src/tutorial/current-app-tutorials.mjs`, `app/src/locales/tutorial-translations.js` | Responsive columns and current-flow tutorial localization. |
| `tests/opponent_intelligence002.test.mjs` (new), `tests/opponent_practice_workspace001.test.mjs`, `tests/personal_strategy_hand_workspace.test.mjs` | Authority/determinism, rendered review and stale-region regression coverage. |
| This spec; `TRAINING_PRACTICE_PLANNER_SPEC.md`, `BLUFF_EXPLOIT_TEACHER_V1_SPEC.md`, `PERSONAL_STRATEGY_COACH_V1_SPEC.md` | Owning cross-surface contracts. |
| `CURRENT_PHASE.md`, `PRODUCT_BACKLOG.md`, `PRODUCT_RETURN_QUEUE.md`, `QA_BACKLOG.md`, `capabilities/OPPONENT_INTELLIGENCE.md`, `../agent-prompts/AGENT_MASTER_CONTEXT.md` | Current truth, retained future boundaries and pending human acceptance; no sequence change. |

### Actor-safe foundation verification (001)

Counterfactual tests compare captured input, fingerprint, decision seed, cache identity/hit, action, metadata, and localized explanation after changing inaccessible private/dead cards. Separate shuffled deals with the same actor cards/public state prove that future board/other private cards do not affect the first decision. Public board and actor-card changes remain observable. Complete hands across three policies and HU/six-handed tables are replayed; each bot action is regenerated at its reconstructed pre-action state. Mounted controls verify preset/custom requests, locale switching, RTL tokens and reset cleanup. Focused poker, Full Hand, replay, identity/privacy, language, performance and tutorial tests supplement these checks.

Browser inventory on September 6 returned no apps/browsers. Human EN/RU/HE/RTL, keyboard, themes, narrow layout and full-hand playthrough acceptance remain open under `QA-OPPONENT-POLICY-001`. Structural tests are not visual acceptance.

Verification result: the 405-test focused regression group passed; after final edge-case changes, the 39-test opponent/Full Hand group passed, including a three-handed 500bb always-raise sequence after Hero folds. That stress run took about 160 seconds on this machine: very long minimum-raise sequences are a known performance limitation, not interactive performance acceptance. Canonical Hero-fold lifecycle remains unchanged (`RET-FULLHAND-HERO-FOLD-001`). All 14 ticket JavaScript/MJS files passed syntax checks and `git diff --check` passed. No full-suite or solver run was required; nothing was staged or committed.
