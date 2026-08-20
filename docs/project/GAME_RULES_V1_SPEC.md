# Game Rules v1 specification

## Purpose and boundary

`GameRulesDefinition v1`, `GameRulesPreset v1`, and `GameRulesSnapshot v1` are Riverline's DOM-free mathematical game-rules contracts. They live in `shared/poker-domain/game-rules.js`; the current Home/ClubGG bridge lives in `shared/poker-domain/game-rules-compat.js`.

This foundation does not change `PokerState v1`, hand initialization, ledger movement kinds, Replay, Saved Hand/Spot, Scenario, Training, Personal Strategy, UI, persistence, Supabase, or account state. Those consumers continue to use their current contracts until a separately approved migration.

`StrategyProfile` remains the human poker-environment concept. A profile may describe a recognizable lineup or playing environment. Game Rules describe objective mathematical mechanics. Brand/operator names are provenance or presentation only and never select mathematical accounting in the new contract.

## GameRulesDefinition v1

Schema version: `game-rules-definition/v1`.

The contract has exactly these fields:

- `schemaVersion`
- `variant`
- `format`
- `tableSize`
- `blinds`
- `ante`
- `straddle`
- `collectionPolicy`

Supported v1 values and semantics:

- `variant`: `no_limit_texas_holdem` only.
- `format`: `cash` or `legacy_unspecified`. The latter preserves legacy compatibility without claiming cash or tournament architecture.
- `tableSize`: `{ minimumSeated, maximumSeated }`, with both values inside the global 2–10 boundary and the minimum no greater than the maximum. This is a supported-table policy, not a current hand's player count.
- `blinds`: `{ smallBlindMilliBb, bigBlindMilliBb, chipUnitMilliBb }`. All values use the existing integer milliBB model. The big blind is exactly 1000 milliBB in v1. The small blind is positive, no greater than the big blind, and aligned to the positive chip unit.
- `ante`: `{ type, amountMilliBb }`. `type` is exactly `none`, `per_player`, or `big_blind`. `none` requires zero; enabled forms require a positive chip-unit-aligned amount.
- `straddle`: `{ type: "none" }`. No nonzero or alternate straddle form exists in v1.
- `collectionPolicy`: the strict discriminated union below.

No-collection form:

```js
{ type: 'none' }
```

Fixed collection form:

```js
{
  type: 'fixed_per_seated_player',
  amountMilliBb: 100,
  timing: 'hand_start_before_antes_and_blinds',
  basis: 'seated_players',
  destination: 'outside_contestable_pot',
  rounding: 'none',
  shortfallPolicy: 'reject_hand'
}
```

The fixed amount must be a positive safe integer aligned to the definition's chip unit. The remaining fields have exactly the shown v1 values. Percentage rake, caps, drops, time-based collection, rounding, partial payment, sit-outs, and arbitrary hooks fail validation; they never normalize to `none`.

## GameRulesPreset v1

Schema version: `game-rules-preset/v1`.

A preset contains:

```text
schemaVersion
id
revision
origin
displayName
description
state
setupDefaults
definition
```

`id` is a stable lowercase identifier and `revision` is a positive safe integer. `state` is `active` or `deprecated`. `origin` is one of these strict provenance shapes:

- `{ kind: 'riverline_builtin' }`
- `{ kind: 'user_defined' }`
- `{ kind: 'external', operator }`

No owner, account repository, or persistence meaning is implied. `setupDefaults` contains only `{ seatedPlayers }`; it must fit the definition's table-size policy and is excluded from semantic identity. Display name, description, state, origin, ID, and revision are also preset metadata rather than mathematical rules.

Creation and validation return deep-frozen normalized copies. `validateGameRulesPresetSet()` rejects duplicate preset IDs in one available set. Distinct presets may intentionally have equal definitions and therefore equal semantic identities.

## Built-in presets

`riverline:builtin:no-rake-cash` revision 1:

- NLHE, `cash`, table policy 2–10;
- 500/1000 milliBB default blinds and 100 milliBB default chip unit;
- no ante by default, while a compatibility snapshot may resolve any currently supported ante;
- no straddle;
- `collectionPolicy: { type: 'none' }`.

`riverline:builtin:fixed-per-seated-player-100-millibb` revision 1:

- mathematical ID contains no operator brand;
- NLHE, `legacy_unspecified`, table policy 7–10;
- 500/1000 milliBB default blinds and 100 milliBB default chip unit;
- no ante by default, while a compatibility snapshot may resolve any currently supported ante;
- no straddle;
- exactly 100 milliBB per seated player before antes and blinds;
- outside the contestable pot, with no rounding and full-payment-or-reject semantics.

Both built-ins and their nested values are immutable. Their default ante and seated-player choices are setup starting points, not a restriction on legal effective legacy inputs.

## GameRulesSnapshot v1

Schema version: `game-rules-snapshot/v1`.

A snapshot contains exactly:

```text
schemaVersion
source
setup
semanticFingerprint
definition
```

`definition` is a normalized copied definition. A mathematical consumer reads that copy and never performs a live preset lookup. `setup.seatedPlayers` preserves the exact current seated-player selection while `definition.tableSize` preserves the mathematical supported-table policy. The selection must fit that policy. Table selection remains separate context; changing the policy changes rule identity.

Supported source shapes are:

- `{ kind: 'direct' }`
- `{ kind: 'preset', presetId, presetRevision }`
- `{ kind: 'legacy_compatibility', presetId, presetRevision, legacyMode }`

Legacy source mode is exactly `home` or `clubgg`. Brand appears only there as compatibility provenance. A snapshot remains mathematically usable after a preset rename, revision change, or removal because its definition is self-contained.

Snapshot validation normalizes and freezes a new copy, validates source and setup, revalidates the definition, and rejects a fingerprint that does not exactly match the copied definition.

## Semantic identity

`serializeGameRulesSemantics()` validates and rewrites a definition into one fixed field order before JSON serialization. It is therefore independent of JavaScript insertion order. `parseGameRulesSemanticSerialization()` validates imported serialized definitions and recreates the immutable normalized form.

`getGameRulesSemanticFingerprint()` uses this durable value:

```text
game-rules-semantic/v1:<canonical serialized GameRulesDefinition v1>
```

The full canonical definition, rather than a weak compact hash, is the durable identity authority. This design is synchronous, browser-compatible, collision-free for distinct canonical strings, and requires no Node crypto dependency. A later index may add a compact cryptographic convenience digest, but it must retain or verify against the canonical definition.

Preset name, description, ID, revision, origin/operator provenance, state, and setup defaults do not enter serialization. Collection amount, ante, blind/chip-unit mechanics, collection semantics, format, variant, straddle policy, and table-size policy do.

## Exact legacy mappings

`createGameRulesSnapshotFromLegacyGameConfiguration(game, tableSize)` accepts the current initialization game shape:

```js
{
  mode,
  smallBlindMilliBb,
  bigBlindMilliBb,
  chipUnitMilliBb,
  ante
}
```

It first applies the existing legacy configuration validator, then copies blind, chip-unit, ante, and exact seated-player inputs into a new immutable snapshot. It does not mutate or replace the current runtime path.

Legacy Home maps to the generic no-rake cash preset and `collectionPolicy: { type: 'none' }`. Its supported table policy remains 2–10. No deduction is introduced.

Legacy ClubGG maps to the non-brand fixed-collection preset. Its definition uses `legacy_unspecified`, policy 7–10, and the exact 100 milliBB fixed collection described above. The existing behavior is represented as collection from every currently configured/seated player once at hand start, before antes and blinds, outside the contestable pot, with no percentage, cap, or rounding, and rejection when any player cannot pay in full.

Unknown modes, unknown extra rule fields, invalid blinds/chip units/antes, unsupported table sizes, and all unsupported rule vocabulary fail explicitly. There is no compatibility fallback to Home/no-rake.

## Versioning and deferred work

Additive metadata does not justify changing mathematical identity, but this strict v1 shape does not accept unknown fields. A new rule mechanic, enum value, or breaking field change requires a new schema version and an explicit compatibility path. Historical records are not rewritten by this contract ticket.

The following belong to `GAME-RULES-001B` or another separately approved consumer migration:

- PokerState schema adoption and general initialization/accounting execution;
- generic ledger movement/kind migration away from legacy ClubGG names;
- Replay, Saved Hand/Spot, Scenario, Training, DecisionContext, StrategyProvider, and Personal Strategy adoption;
- semantic-fingerprint indexing or IndexedDB migration;
- preset storage, editing, ownership, account, sync, or Supabase work;
- any new collection, straddle, tournament, blind-schedule, or poker-variant behavior.
