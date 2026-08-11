# Riverline bounded HU 100bb preflop game v1

Status: implemented game and validation harness; not solved and not connected to production.

Version: `riverline-hu-preflop-100bb/v1`

## Provenance

Any strategy later solved for this game is an equilibrium of **this abstraction**. It is not automatically equivalent to full-game 100bb heads-up no-limit Hold'em GTO. SOLVER-001 contains no trained strategy, dataset, model, ONNX artifact, or production UI integration.

## Retired prototype audit

CLEANUP-001D removed the obsolete root prototype training, pseudo-CFR model, and checked-in tree-data directories. The table below is retained only as a historical audit of the components that were removed; none is part of the current repository or the bounded solver.

| Component | Actual behavior | Classification | Recommendation |
|---|---|---|---|
| `shared/poker-domain/*` | Versioned JS PokerState/Action, integer accounting, legal actions, folds, streets, side pots, showdown, evaluator/equity | Real usable canonical production primitive | Keep canonical; use neutral parity fixtures at the Python boundary |
| `scripts/backend_logic/evaluator.py` | Complete 5/7-card lookup evaluator, already characterized against browser/canonical results | Real usable Python primitive | Reused through the solver evaluator adapter; retain cross-tests |
| `solver-model/cfr.py:CFRTrainer` | History-length actor, global random deck, toy `p/c/b` actions, no legal NLHE accounting/chance tree | Prototype, unsafe for reuse | Quarantine; do not import into the new package |
| `solver-model/engine.py:GameState` | Arbitrary two-actions-per-player terminal, simplified evaluator/payoffs, string history | Prototype/obsolete | Quarantine |
| `training/cfr.py:CFRTrainer` | Similar prototype with float16 regrets, arbitrary history terminal and incomplete-board zero padding | Prototype, unsafe for reuse | Quarantine |
| `training/engine.py:GameState` | Mock isomorphism/pruning and a zero-filled LUT fallback that may create a 130MB file | Prototype/unsafe | Quarantine; never use its LUT as truth |
| `training/train.py:train` | Random state tensors and random policy/value targets; CFR trainer is instantiated but bypassed | Synthetic supervised-data generator | Quarantine; never label output CFR/solver data |
| `solver-model/train.py:generate_preflop_data` | Chen-score/threshold labels over randomly sampled context values | Heuristic supervised-data generator | Quarantine; provenance is heuristic, not Deep CFR |
| `solver-model/train.py:generate_postflop_data` | Simplified hand-strength thresholds and random contexts | Heuristic/synthetic generator | Quarantine |
| `training/train_postflop_xpu.py:PokerDataset` | Random features/cards with deterministic strength-threshold targets | Heuristic/synthetic generator | Quarantine |
| `training/model.py:PokerNet` | 121-feature training path with four actions in `train.py` | Experimental model architecture | Do not reuse for solver game or constrain its schemas |
| `solver-model/model.py:DeepCFRNet` | 69 inputs and five ambiguous action outputs; trained on heuristic labels | Misnamed experimental model | Quarantine the “Deep CFR” claim; no verified regret data |
| `training/export.py` | Exports a 100-input model and may export untrained weights | Obsolete/incompatible exporter | Do not reuse |
| `training/export_onnx.py` | Exports the 121-input experimental model and reports simulated quantization | Experimental exporter | Do not reuse in SOLVER-001/002 |
| `solver-model/export*.py`, `server.py` | Export/load the 69-input model; server blends model output with heuristics and emits “DeepCFR” labels | Experimental/unsafe provenance | Quarantine; no production solver evidence |
| `trees/preflop_solver.json`, `trees/preflop_30bb_solver.json` | Static RFI tables with no reproducible solver metadata | Provenance unclear | Treat only as legacy local-tree inputs, not solver data |
| `app/src/core/logic.js` local tree/ONNX/API paths | Adapters to `StrategyResult v1`, with heuristic fallback still reliable | Production compatibility path, not a solver | No SOLVER-001 changes |

No legacy CFR, model, target generator, or exporter is imported by `solver/riverline_solver`.

## Exact game

Players and order:

- player 0 is BTN/SB and acts first preflop;
- player 1 is BB and acts second;
- action alternates after every raise until fold or call;
- after a BTN limp, BB retains a real check option.

Initialization, before any action:

| Item | milliBb | bb |
|---|---:|---:|
| Each starting stack before blinds | 100,000 | 100 |
| BTN/SB forced contribution | 500 | 0.5 |
| BB forced contribution | 1,000 | 1 |
| Starting pot | 1,500 | 1.5 |

There is no rake, ClubGG contribution, ante, or straddle. The chip unit is 100 milliBb (0.1bb), and all betting/accounting is integer-only. Private cards are two strict two-character strings per player, drawn without replacement from the standard 52-card deck.

## Action and amount semantics

Solver actions are structural: `fold`, `check`, `call`, `raise`, and `all_in`. `raise` and solver-side `all_in` carry `amount_to_milli_bb`, meaning the player's total preflop contribution after acting. Calls carry no amount; their commitment is `min(current bet - contribution, stack)`.

This is raise-to, never raise-by or pot-addition. An amount that consumes the full stack is represented only as `all_in`. The later Riverline adapter maps the family and known amount into a structural `StrategyResult` action; it does not map actions to model indices or collapse sizes into Small/Large buckets.

## Betting abstraction

The tree exposes one bounded non-all-in size at each aggression depth plus all-in:

| Branch | First voluntary raise | Second aggression | Third aggression | Later aggression |
|---|---:|---:|---:|---|
| BTN open | raise to 2.5bb | BB raise to 8bb | BTN raise to 20bb | all-in only |
| BTN limp | BB raise to 4bb | BTN raise to 12bb | BB raise to 30bb | all-in only |

Root actions are fold, limp/call to 1bb, raise to 2.5bb, and all-in. Against an outstanding wager the responder may fold, call, take the configured raise if naturally legal, or go all-in. Against a limp, BB may check, raise to 4bb, or go all-in; fold is not legal when check is free.

A configured size is emitted only when it is at least the natural minimum raise and at most one chip below the stack cap. An invalid configured size is omitted, not clamped or rounded. All-in is generated from the exact live maximum amount-to. After the third bounded raise, canonical unrestricted NLHE may still permit another non-all-in raise; this abstraction intentionally omits it and exposes fold/call/all-in only.

## Pure transitions and invariants

`HuPreflopGame` exposes:

```text
initial_state()
current_player(state)
legal_actions(state)
apply_action(state, action) -> new immutable state
is_terminal(state)
```

The public state includes two immutable player states, actor, pot, total contributions, current bet, last full-raise increment, branch/aggression metadata, structural history, fold winner, and refunds. It contains no cards and no solver table.

Every transition enforces:

- stack is nonnegative and integer-aligned;
- live stacks plus unsettled pot equal 200,000 milliBb;
- no action occurs after a terminal;
- no check faces a bet;
- no fold is offered when check is free;
- calls are stack-capped;
- configured raises meet the natural minimum and stack cap;
- all-in uses the exact maximum amount-to;
- fold immediately settles the pot and any uncalled excess;
- betting closure has no actor and becomes a showdown-equity leaf.

The full canonical Action v1 remains separate. Its sized bet/raise uses amount-to, while canonical all-in carries `amountToMilliBb: null`; the neutral fixture adapter makes the solver's known all-in target explicit without altering Action v1.

## Public tree

Public node identity is the SHA-256-derived `hp100-v1:<20 hex>` of canonical JSON structural action records. Human-readable history is only a diagnostic rendering, not the sole identity.

Deterministic enumeration yields:

- 46 total public nodes;
- 16 decision nodes;
- 30 terminal nodes;
- maximum action depth 6;
- 45 decision-action entries;
- 2.8125 average actions per decision;
- decision-node distribution: eight with 2 actions, three with 3, five with 4.

`PublicTree.dump()` provides an inspectable in-memory text dump; SOLVER-001 does not modify `repo_dump.txt`.

## Information sets and chance

V1 uses exact private combos, not 169 classes. There are 1,326 physical two-card combos. An infoset key contains only:

- schema version;
- acting player identity/position;
- that player's canonical exact combo;
- stable public node ID.

Opponent cards are absent. Public stack/pot state is deterministically implied by public history. Suit-isomorphism reduction is deferred: correctness and auditability take priority over a premature canonicalization scheme.

There are 1,624,350 ordered disjoint private-card assignments and 812,175 unordered combo matchups. `SeededRng` owns a local `random.Random`; fixed seeds reproduce deals, and no global RNG or UI hidden-card marker is used.

## Terminal utility and leaf abstraction

Utility is zero-sum net stack change from the 100,000 milliBb hand-start stack.

Fold terminal:

```text
utility(player) = settled final stack - 100,000
```

Examples for player 0 / player 1:

- BTN folds immediately: `(-500, +500)`;
- BTN raises to 2.5bb and BB folds: `(+1,000, -1,000)`;
- 2.5bb open, 8bb 3-bet, BTN folds: `(-2,500, +2,500)`;
- 2.5bb / 8bb / 20bb, BB folds: `(+8,000, -8,000)`.

At any called/check-through preflop closure, future betting is removed. A five-card board is conceptually dealt with no further action and the contestable pot is awarded by exact showdown equity:

```text
settled_live_stack_i = live_stack_before_refund_i + refund_i
final_stack_i = settled_live_stack_i + equity_share_i * contestable_pot
utility_i = final_stack_i - 100,000
u0 = -u1
```

Ties contribute one-half to each player's heads-up equity share. Unmatched excess is refunded before the contestable pot is valued. `LeafValueProvider` is an explicit seam: a future postflop value model, subgame solver, or learned continuation value can replace `ShowdownEquityLeafValue` without changing betting transitions.

This `preflop showdown-equity terminal abstraction` is not full-game NLHE. It removes postflop position/realization, future betting leverage, implied odds, board-dependent bluffing and value extraction. It will systematically change incentives for suited/connective hands, polarization, calls, and raises. That limitation must travel with any future dataset/model provenance.

## Exact equity and cache boundary

`equity(heroCombo, villainCombo)` rejects overlap and returns a tie-aware share in `[0, 1]`. It uses the existing verified Python evaluator through a thin adapter. `enumerate_exact_preflop_equity` enumerates all `C(48,5) = 1,712,304` boards for one matchup. `PreflopEquityCache` stores a symmetric, versioned sparse record and can persist/load JSON.

Unit tests use small explicit cache fixtures and do not generate the universe. A naive full exact cache would require approximately 812,175 × 1,712,304 = 1.39 trillion matchup-board evaluations, so eager full generation is not a practical SOLVER-001 or unit-test operation. SOLVER-002 may sample future boards as an unbiased estimator of this exact leaf expectation while retaining exact cached values for validation subsets. It must label sampled estimates and never substitute heuristic hand strength.

## Exact-combo size and memory

With 1,326 exact combos at every public decision node:

- BTN infosets: 10,608;
- BB infosets: 10,608;
- total infosets: 21,216;
- regret/action entries: 59,670;
- one float64 action table: 477,360 bytes;
- float64 regrets plus average-strategy sums: 954,720 bytes;
- one float32 action table: 238,680 bytes;
- float32 regrets plus average-strategy sums: 477,360 bytes.

Betting-table memory is therefore small. Chance traversal and leaf equity, not regret-table memory, dominate cost.

## 169-hand reporting

`aggregate_strategy_to_169` is reporting-only. It averages each legal physical combo once, producing the natural 6 pair, 4 suited, and 12 offsuit weights. When blockers remove combos, only the remaining physical combos contribute. No simple average across differently sized 169 classes is used internally.

## JS/Python parity

`solver/fixtures/hu_preflop_parity_v1.json` is read independently by Node and Python tests. Representative root, limp/check, open/call, 3-bet, 4-bet, fold, and all-in histories compare actor, pot, stacks, contributions, current bet, legal families, boundary status, and fold settlement.

Two differences are explicit in fixtures:

1. canonical JS advances a closed preflop round to `deal_flop` chance; the bounded solver marks the same accounting boundary as `showdown_equity` terminal;
2. after the configured third raise, canonical unrestricted PokerState still permits a legal non-all-in raise while the solver abstraction intentionally offers only fold/call/all-in.

Neither difference is normalized away.

## DecisionContext and StrategyResult boundary

`DecisionContext v1` remains the application-facing actor snapshot: table size, hero position/cards, street/board/dead cards, stack/pot in bb, prior-action classification, facing size, and accounting compatibility fields. It is not a legal game tree and does not contain opponent private cards, full action history, or solver information sets. SOLVER-001 therefore consumes neither the DOM-derived nor PokerState-derived DecisionContext.

Current Playbook preflop sources commonly present `Open`, `Call`, `Fold`, `3-Bet`/`4-Bet`, and `All-in` labels; the legacy 69-input ONNX vocabulary uses five indices with overlapping Raise/Open, Call, Fold, Check, and Jam semantics. Those labels and indices do not define this game.

For later integration, `strategy_result_action()` maps each solver action directly to StrategyResult's structural `{type, amountBb, potFraction}` shape. Probabilities will remain per explicit solver size—for example `raise` to 2.5bb and `raise` to 8bb—rather than being prematurely collapsed into generic Small/Large buckets. `source`, convergence metadata, abstraction version, leaf-value provenance, and warnings must be added by a later adapter. No UI adapter or StrategyResult is emitted in SOLVER-001.

## Validation harness

Strategy profiles return probabilities keyed by exact infoset/action ID. The harness implements:

- exact expected value over any supplied finite chance fixture;
- exact best response over that finite fixture using opponent-reach-weighted infoset decisions;
- zero-sum NashConv and exploitability (`NashConv / 2`);
- always-fold, always-call/check, first-aggressive, and uniform baselines.

The two-deal golden fixture is deliberately not poker-representative. Its pinned player-0 values include `-0.5bb` for immediate fold, `0bb` for passive-versus-passive, and `+1bb` for first-aggressive versus always-fold. Passive-versus-passive has fixture exploitability `49.625bb`, demonstrating that the metric detects an intentionally exploitable profile. Full 1,624,350-deal exact best response is an interface-supported future workload, not a measured SOLVER-001 result.

An independent Kuhn Poker CFR fixture is isolated under `riverline_solver.validation`. At 20,000 deterministic full-deal iterations it measures value approximately `-0.0555551` (known value `-1/18`) and exploitability approximately `0.001608`. It exists to validate SOLVER-002 regret updates before Hold'em integration.

## Local performance characterization

Run with:

```powershell
$env:PYTHONPATH='solver'
python -B solver/tools/characterize_hu_preflop.py
```

One local 2026-08-11 run measured approximately:

- public-tree enumeration: 4.35ms;
- legal-action generation: 9.90µs/call;
- sparse equity lookup: 8.93µs/call;
- two-deal mixed profile evaluation: 6.24ms;
- two-deal exact best response: 19.25ms.

These smoke timings exclude full ordered-deal traversal and exact-board cache generation; the script prints that warning.

## SOLVER-002 recommendation and scope

Implement external-sampling MCCFR first.

- Vanilla CFR and CFR+ have attractive convergence on this small betting tree, but exact traversal of all private deals and exact board leaves per iteration is infeasible.
- External sampling can enumerate the traverser's bounded actions while sampling opponent/chance outcomes, retains substantially lower variance than outcome sampling, and maps well to independent seeded workers.
- Outcome sampling has lower per-iteration work but higher variance and is not the first choice for this validation-sensitive game.
- CFR+ is a useful later comparison once a tractable deterministic chance abstraction/cache subset exists.

Exact SOLVER-002 scope should be:

1. a generic regret-matching kernel proven on the isolated Kuhn harness;
2. external-sampling MCCFR over `HuPreflopGame` with local seeded chance sampling;
3. unbiased sampled-board handling for the exact showdown-equity leaf plus exact-cache validation subsets;
4. float64 reference mode and measured float32 mode;
5. average-strategy accumulation, deterministic checkpoints, resume, and reproducibility metadata;
6. periodic finite-fixture EV/best-response validation plus held-out exact-equity fixtures;
7. convergence/runtime/memory reports with explicit stop criteria.

SOLVER-002 must not include dataset generation, neural-model training, ONNX export, production model loading, StrategyResult/UI wiring, ClubGG/rake, multiway, postflop betting, or claims of full-game GTO.
