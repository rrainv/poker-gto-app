# DecisionContext v1.1 specification

Status: `DECISION-CONTEXT-001A` additive application-contract extension.

## 1. Versioning and boundary

DecisionContext remains the one application strategy projection between Scenario
or canonical PokerState and StrategyProvider:

```text
Scenario OR canonical PokerState
              -> DecisionContext v1.1
              -> StrategyProvider v1
```

For compatibility, every extended context retains:

```js
schemaVersion: 'decision-context/v1'
```

and adds:

```js
contractVersion: 'decision-context/v1.1'
```

Existing v1 consumers may ignore the additive fields. A consumer that requires
an exact current pot, live stacks, position relation, legal bounds, bounded history, or derivation
provenance must require `contractVersion`. Historical base-v1 Saved Spot
contexts remain readable without rewriting. New contexts serialize the additive
fields deterministically, so newly created payload bytes and whole-object hashes
can differ from base v1.

DecisionContext is a projection, not a second poker engine, history model,
provider parameter bag, or solver schema. Canonical legality comes only from
`shared/poker-domain/getLegalActionSpec()` and related canonical selectors.

## 2. Base-v1 field audit

All monetary values are decimal big blinds (`bb`). Canonical PokerState stores
integer milliBB and converts only at this application boundary.

| Field | Meaning | Canonical Hand source/quality | Scenario source/quality | Known loss |
|---|---|---|---|---|
| `schemaVersion` | compatibility schema discriminator | constant, exact | constant, exact | does not itself identify v1.1 |
| `tableSize` | seated-player count | `state.players.length`, exact | supplied, defaulted/truncated/clamped to 2–10 | not live opponents |
| `opponentCount` | other dealt-in, non-folded players | canonical live-player filter, exact | unavailable `null` | Scenario cannot establish folds/live count |
| `heroPosition` | unchanged canonical position name | canonical seat assignment, exact | supplied or default `BTN` | Scenario cannot prove seat/button order |
| `street` | decision street | canonical state, exact | derived from board count | supplied Scenario street is not authority |
| `heroCards` | known Hero hole cards | canonical copy, exact | filtered Scenario array | Scenario boundary may normalize entries |
| `board` | current public board | canonical copy, exact | filtered Scenario array | invalid board counts become `invalid` street |
| `deadCards` | known excluded cards | canonical copy, exact | filtered Scenario array | Scenario evidence only |
| `stackBb` | legacy configured/starting-depth compatibility value | Hero starting stack, clamped 10–500 | supplied configured value, defaulted/clamped 10–500 | not live or effective stack |
| `stackMode` | legacy control metadata | projection option or `hero` | supplied or `hero` | does not alter canonical stack derivation |
| `potBb` | current contestable pot compatibility value | canonical pot, clamped 0.5–200 | supplied, defaulted/clamped 0.5–200 | clamp can differ from exact canonical pot |
| `lastAction` | legacy bounded action category | current-street history projection | supplied or `unopened` | passive canonical actions remain coarsened for compatibility |
| `facingSizeBb` | nominal/current wager-to compatibility value | current bet when legacy aggression category supports it | supplied/defaulted/clamped; zeroed unopened | never incremental call price |
| `callAmountBb` | exact stack-capped incremental call commitment when known | canonical legal action spec, exact | known-free category gives `0`; otherwise `null` | Scenario never fabricates price from nominal size |
| `heroStreetContributionBb` | Hero current-street investment | canonical player state, exact | unavailable `null` | Scenario has no canonical contribution history |
| `rakeMode` | legacy accounting projection (`off`/`fixed`) | canonical rules/state projection | Scenario rules/legacy projection | compatibility vocabulary, not rules authority |
| `forcedContributionPerPlayerBb` | fixed collection per seated player | canonical rules/state projection | Scenario rules/legacy projection | not percentage rake |
| `totalForcedContributionBb` | total fixed collection outside pot | canonical rules/state projection | Scenario rules/legacy projection | not contestable pot |

Heuristic style/profile controls are deliberately absent. They remain explicit
StrategyProvider fallback options rather than poker-state facts.

### Additive exact Game Rules projection

New v1.1 contexts add `gameRules` as a bounded rules identity for exact
provider matching:

```js
gameRules: {
  schemaVersion: 'decision-context-game-rules/v1',
  semanticFingerprint,
  seatedPlayers,
  orderedPositions,
  definition // canonical validated GameRulesDefinition v1
} | null
```

This is a read-only application projection, not a second rules authority.
Canonical Hand derives it from the authoritative v2 `rulesSnapshot`. Historical
PokerState v1 reconstructs the exact legacy-compatibility snapshot before
projection, preserving v1/v2 provider parity. Scenario v2 projects its supplied
snapshot; Scenario v1 can project only a valid exact legacy compatibility
configuration. Otherwise it uses `null` plus
`scenario_game_rules_unavailable` provenance. A null/unknown projection cannot
satisfy an exact reference-pack matcher.

The projection retains the complete definition and semantic fingerprint because
the older `rakeMode`/fixed-collection compatibility fields do not express every
material rule assumption. It is additive and optional for historical v1.1 Saved
Spot payloads; new saved contexts validate it when present and require its
fingerprint to agree with the Saved rules snapshot.

## 3. Additive current-pot and live-stack fields

- `currentPotBb`: exact current canonical pot converted from integer milliBB at
  the application boundary without the legacy 0.5–200 compatibility clamp. A
  Scenario preserves an explicitly supplied finite non-negative pot; a numeric
  string is normalized with provenance; an absent or invalid value is `null`
  with unavailable provenance. Scenario never reconstructs a pot from history.

- `startingStackBb`: exact canonical Hero starting stack. For Scenario, the
  normalized configured `stackBb` value; it is not evidence of live chips.
- `heroStackBb`: exact canonical chips behind at the decision; Scenario `null`.
- `effectiveStackByOpponent`: compact entries for every other dealt-in,
  non-folded opponent, ordered by seat. Each entry is
  `{ position, opponentStackBb, effectiveStackBb }`, where both stack values are
  current chips behind and `effectiveStackBb` is the smaller of Hero and that
  opponent. Folded players are excluded. An in-hand all-in opponent remains an
  entry with zero chips behind.
- `effectiveStackBb`: the one per-decision effective stack only when exactly one
  live opponent exists. Multiway uses `null` plus provenance because one scalar
  cannot represent side-pot/effective-stack relationships.

These fields do not model side-pot strategy or already-contributed pot layers.

### Mandatory v1.1 strategy field choice

A v1.1-aware strategy must use `currentPotBb` for exact current-pot or SPR
reasoning. It must not use `potBb`, which remains the legacy compatibility
projection and can be defaulted or clamped.

Likewise, live-stack reasoning must use `heroStackBb`, `effectiveStackBb`, or
`effectiveStackByOpponent` as appropriate. It must not use legacy `stackBb`,
which remains configured/starting-depth compatibility data and can be clamped.

## 4. Position relation

`positionRelation` is one of:

- `in_position`
- `out_of_position`
- `mixed`
- `unknown`
- `not_applicable`

Canonical postflop relation comes from button/seat postflop action order after
folded players are excluded. `mixed` means Hero is later than at least one live
opponent and earlier than at least one other. Preflop is `not_applicable`.
Scenario is `unknown` postflop because it has no seat/button evidence.

`aggressorPositionRelation` uses the same vocabulary relative to the current
street aggressor when that aggressor is still a live opponent. With no relevant
live aggressor it is `not_applicable`; lossy postflop Scenario is `unknown`.

## 5. Legal aggressive-to facts

- `canRaise`: whether any legal aggressive action exists, including a short
  all-in that is below a regular full bet/raise minimum.
- `minRaiseToBb`: minimum regular legal bet-to or raise-to total. It is `null`
  when no aggression is legal or only a short all-in is legal.
- `maxRaiseToBb`: maximum legal aggressive total-to, equal to the legal all-in
  cap when `canRaise` is true; otherwise `null`.
- `allInToBb`: Hero's exact total current-street contribution after committing
  all remaining chips. It remains available even when an aggressive all-in is
  not legal, such as a call-only all-in state.

`callAmountBb` remains the exact stack-capped call commitment. Every `...ToBb`
field is total-to, never raise-by. Scenario exposes all four new legality facts
as unavailable rather than recomputing betting rules.

## 6. Bounded prior-action summary

`priorActionSummary` contains exactly:

- `lastActionFamily`: `none`, `fold`, `check`, `limp`, `call`, `bet`, `raise`,
  `all_in`, or `unknown`;
- `lastActorPosition`: canonical most-recent actor position or `null`;
- `facingActionFamily`: current bounded family Hero faces (`none`, `check`,
  `limp`, `call`, `bet`, `raise`, or `unknown`);
- `aggressionFamily`: preflop `none`/`open`/`three_bet`/`four_bet_or_more`, or
  postflop `none`/`bet`/`raise`, with `unknown` for insufficient Scenario input;
- `aggressionCount`: exact number of current-street wager increases from Hand,
  or a bounded Scenario-derived count where its category proves one;
- `limperCount`: exact preflop calls before the first voluntary aggression from
  Hand; Scenario proves zero only for explicit unopened state and otherwise uses
  `null`;
- `aggressorPosition`: latest canonical current-street aggressor position or
  `null`.
- `heroPreviousVoluntaryActionFamily`: canonical preflop Hero role before the
  current decision: `none`, `check`, `limp`, `call`, `open`, `three_bet`, or
  `four_bet_or_more`; postflop is `not_applicable`. An aggressive all-in uses
  its aggression-depth family and a non-aggressive all-in uses `limp`/`call`.
- `initialAggressorPosition`: first canonical preflop aggressor position or
  `null` when there has been no voluntary aggression.
- `distinctAggressorCount`: exact number of distinct canonical preflop
  aggressors. This differs from `aggressionCount`, which counts wager
  increases.
- `latestAggressionWasCold`: for a canonical preflop re-raise, whether its actor
  had no earlier non-fold action in the street; the first open is `false`, and
  no aggression/postflop is `null`.
- `heroActionWouldBeCold`: when Hero faces preflop aggression, whether Hero has
  no earlier non-fold action in the street; no aggression/postflop is `null`.

A preflop call before voluntary aggression is a limp. A call after aggression,
and every postflop call, remains a call. The legacy `lastAction` field is not
redefined, so existing probabilities stay unchanged until a later strategy
ticket consumes this summary.

These additive facts are the bounded `PREFLOP-ROLE-001` representation. They do
not embed action records, provider labels, solver node IDs, or a second history
authority. Canonical Hand derives them only from current-street
`PokerState.actionHistory`. Scenario cannot establish Hero action role,
aggressor identity/count, or cold-action semantics from its single prior-action
category, so it uses `unknown`/`null` plus `unavailable` derivation events. A
Scenario's legacy category may still select the same generalized compatibility
fallback, but it does not become exact role evidence.

## 7. Scenario versus Hand evidence

Canonical Hand provides the exact current pot, live/current stacks, per-opponent
effective stacks, postflop seat-order relation, call price, contribution, legal
bounds, and action summary. Scenario provides only its explicit snapshot
categories, configured stack, cards, board, explicitly supplied pot, and
compatible rules projection. It does not gain
canonical history by having the same visible values.

For preflop role identity specifically, only canonical Hand provides exact Hero
prior-action, initial/latest aggressor, distinct-aggressor, and cold-action
facts. Scenario keeps all five unavailable even when `lastAction` proves a
bounded aggression-depth category.

When both sources genuinely contain the same fact, their value is semantically
equivalent. A missing Scenario current pot, call price, live stacks, opponent
stacks, actor and aggressor positions, and legal bounds remain `null`/`unknown`
with provenance. A defaulted `potBb` never makes `currentPotBb` exact.

## 8. Derivation provenance

Every v1.1 context adds:

```js
derivation: {
  schemaVersion: 'decision-context-derivation/v1',
  source: 'canonical_hand' | 'scenario',
  defaultQuality: 'exact',
  events: [
    { field, quality, code, rawValue?, value? }
  ]
}
```

An unlisted field uses `defaultQuality: exact`. Events record exceptions using
only `exact`, `defaulted`, `normalized`, `clamped`, or `unavailable`. Codes are
stable lowercase machine-readable identifiers. Events are emitted in stable
field-processing order and contain portable finite values only. The mechanism
is diagnostic metadata; normal UI does not render it yet.

## 9. Current consumer behavior

StrategyProvider v1 accepts both base v1 and v1.1. The preflop heuristic uses
the additive role facts for exact role identity and maps each role to an honest
existing generalized calibration family; it does not add or tune frequencies.
Base-v1 and lossy Scenario inputs retain their legacy family route with an
`unknown` exact role. The postflop heuristic remains unchanged. Playbook/Analyze,
Matrix clones, canonical Hand and Full Hand review,
regular Training, Saved Spot, Replay-resolved review, Range Analysis, Bluff
Analysis, and AnalysisExplanation receive or preserve the additive context.
Personal Strategy remains a separate evidence authority and receives no new
inference path.

`REFERENCE-PACK-001` uses the additive `gameRules` projection, canonical
history, live stacks, exact price/pot, exact role, and legal bounds in one strict
matcher. Missing or mismatched facts make that pack unsupported; the provider
then uses its separately labelled fallback. See
`REFERENCE_PACK_V1_SPEC.md`.

STRATEGY-REPAIR-001B may consume the new facts. It must do so explicitly and
must not reinterpret the compatibility fields. Exact current-pot/SPR logic uses
`currentPotBb`, never `potBb`; live-stack logic uses the explicit live/effective
stack fields, never `stackBb`.
