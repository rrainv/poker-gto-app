# Game Rules v1 specification

## Purpose and boundary

`GameRulesDefinition v1`, `GameRulesPreset v1`, and `GameRulesSnapshot v1` are Riverline's DOM-free mathematical game-rules contracts. They live in `shared/poker-domain/game-rules.js`; the current Home/ClubGG bridge lives in `shared/poker-domain/game-rules-compat.js`.

`GAME-RULES-001B` adopts this contract for new `PokerState v2` initialization at the canonical poker-domain boundary. `GAME-RULES-001C` makes those states durable through versioned Replay and Saved Hand/Spot payloads while retaining the existing outer persistence, export, sync, and account envelopes. `GAME-RULES-001D` adopts snapshots in the production live Hand path, `playbook-scenario/v2`, and `training-config/v2` while preserving historical PokerState, Scenario, Training, Replay, and Saved readers. Personal Strategy remains on its existing scope contract.

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

## PokerState v2 adoption

Schema version: `poker-state/v2`.

New snapshot-authoritative hands use:

```js
initializeHandFromGameRulesSnapshot({
  handId, // optional string or null
  rulesSnapshot,
  buttonSeat,
  players,
})
```

The initializer validates and copies the supplied `GameRulesSnapshot v1`; it never performs a live preset lookup and never chooses accounting from source, preset, operator, or legacy-mode provenance. `rulesSnapshot.setup.seatedPlayers` must equal the configured player count, and that count must fit `rulesSnapshot.definition.tableSize`. Unsupported variants, formats, straddles, collections, or other future mechanics fail through the strict snapshot contract.

`PokerState v2` contains the immutable `rulesSnapshot` plus a brand-free `game` projection of the resolved variant, format, table size, blinds, chip unit, and ante used by canonical transitions. It does not contain the v1 `game.mode` or `forcedContributionPerPlayerMilliBb` compatibility fields.

Initialization executes one shared posting path in this exact order:

1. fixed collection, when configured;
2. ante;
3. small blind and big blind.

`collectionPolicy.type: none` produces no deduction. `fixed_per_seated_player` requires full payment by every configured player before state construction proceeds, deducts the exact snapshot amount once per player, and records `fixed_player_collection` / `stack_to_deduction` entries on the hand-start ledger. Collection never changes the contestable pot, street contribution, pot layers, refunds, awards, or payouts. Antes and blinds retain the existing stack-capped short-post behavior after a successful collection.

The canonical validator, selectors, betting/chance transitions, pot derivation, private reveal, and showdown accept both supported state versions. V1 states retain `clubgg_forced_contribution`; v2 states require `fixed_player_collection`. Deduction totals, per-player deduction selection, and conservation use ledger movement semantics rather than brand switching.

`initializeHand()` remains the legacy `poker-state/v1` API and preserves its Home/ClubGG state shape, brand-specific ledger kind, and behavior. Existing v1 state and history are read as-is and are not rewritten or migrated.

## Replay and Saved durability

Historical `canonical-hand-replay-source/v1` and `canonical-hand-replay-event/v1` retain their exact initialization and transition semantics. A `poker-state/v2` journal instead uses `canonical-hand-replay-source/v2` plus `canonical-hand-replay-event/v2`. Its initialization configuration contains the exact `GameRulesSnapshot v1`, hand/button/player setup, and starting stacks, and reconstruction calls `initializeHandFromGameRulesSnapshot()`. Source provenance never triggers a preset lookup or selects accounting.

The outer `saved-study-object/v1`, `saved-study-library-export/v1`, `remote-saved-study-object/v1`, IndexedDB layout, and sync protocol remain unchanged. A v2 Hand uses `saved-hand-snapshot/v2`; its embedded final/current `poker-state/v2` and v2 Replay source must reconstruct exactly and must carry equal rule semantics and provenance. A rules-aware standalone or Hand-derived Spot uses `saved-spot-snapshot/v2`, retaining its existing `DecisionContext v1`/Scenario facts plus the immutable snapshot; the saved accounting projection and seated-player setup must agree with that snapshot. V1 Hand and Spot payloads remain strict v1 readers, and unknown nested versions fail explicitly.

Export/import and Saved sync transport complete validated nested payloads as opaque JSON. A cold device can import or pull a v2 object and open detached Replay without a preset repository or network lookup. Existing historical v1 bytes are validated and read without an automatic rewrite.

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

## Production application adoption

The current setup UI may continue to display Home and ClubGG as temporary compatibility choices. Those labels are not mathematical authority. The live Playbook controller resolves the selected value exactly once through `createGameRulesSnapshotFromLegacyGameConfiguration()` and initializes through `initializeHandFromGameRulesSnapshot()`. New live Hands are therefore `poker-state/v2`; their `game` projection has no brand mode or forced-contribution compatibility field. Home remains 2–10 players with no collection. ClubGG remains 7–10 players with exactly 100 milliBB collected from every configured player before antes and blinds, outside the contestable pot.

`playbook-scenario/v2` is a strict, immutable lossy study contract. It contains the existing Scenario decision facts plus one `GameRulesSnapshot v1`; it contains no canonical action history and does not invent call price, Hero prior contribution, or live-opponent count. Its table size must match the snapshot setup. DecisionContext accounting projection reads collection authority from the snapshot definition only; the snapshot also retains the exact ante semantics for other rules-aware consumers. Snapshot source, preset ID/revision, legacy-mode provenance, and display labels do not affect projection. The resulting `rakeMode`, `forcedContributionPerPlayerBb`, and `totalForcedContributionBb` fields are DecisionContext v1 compatibility vocabulary, not canonical rules authority.

Historical `playbook-scenario/v1` remains readable through an explicit compatibility projector. Known `off` and `fixed` modes preserve their exact established facts. Unknown accounting modes, inconsistent legacy accounting facts, missing/malformed v2 snapshots, fingerprint mismatches, and unknown Scenario versions fail explicitly; none normalize to Home/no-rake. A Hand-derived Scenario remains intentionally lossy but copies the Hand v2 rules snapshot unchanged.

`training-config/v1` and `training-exercise/v1` remain exact legacy/replay contracts. New `training-config/v2` replaces `gameMode` with an immutable `GameRulesSnapshot v1` and otherwise retains the current table, stack, position, street, target, difficulty/assistance, and seed controls. A generated v2 exercise is `training-exercise/v2`, uses `poker-state/v2`, and stores the exact snapshot initialization plus canonical event sequence in its generation metadata, so exact-seed regeneration and trajectory reconstruction require no preset lookup.

`training-rules-capability/v1` distinguishes canonical Hand support from current Training generator/reference support. A validated no-collection NLHE snapshot is supported. A validated fixed-per-seated-player snapshot is supported by the canonical Hand engine but is currently unsupported by Training and its reference-strategy capability, returning stable `fixed_collection_training_unsupported` without invoking StrategyProvider. Malformed or unknown rules return `invalid_rules_snapshot`. Training never substitutes a no-rake snapshot. StrategyProvider behavior is unchanged: equivalent legacy and snapshot-projected DecisionContexts produce the same StrategyResult, and no collection adjustment is claimed.

## Versioning and deferred work

Additive metadata does not justify changing mathematical identity, but this strict v1 shape does not accept unknown fields. A new rule mechanic, enum value, or breaking field change requires a new schema version and an explicit compatibility path. Historical records are not rewritten by this contract ticket.

The following remain deferred to separately approved work:

- broader setup/preset UX, preset persistence, and Personal Strategy adoption;
- Training Practice Planner, varied sampling, named RNG streams, coverage/recency, sizing families, and board targeting;
- semantic-fingerprint indexing or IndexedDB migration;
- preset storage, editing, ownership, account, sync, or Supabase work;
- any new collection, straddle, tournament, blind-schedule, or poker-variant behavior.
