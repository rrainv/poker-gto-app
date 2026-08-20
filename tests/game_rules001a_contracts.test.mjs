import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BUILT_IN_GAME_RULES_PRESETS,
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
  GAME_RULES_COLLECTION_BASES,
  GAME_RULES_COLLECTION_DESTINATIONS,
  GAME_RULES_COLLECTION_ROUNDING,
  GAME_RULES_COLLECTION_SHORTFALL_POLICIES,
  GAME_RULES_COLLECTION_TIMINGS,
  GAME_RULES_COLLECTION_TYPES,
  GAME_RULES_DEFINITION_SCHEMA_VERSION,
  GAME_RULES_FORMATS,
  GAME_RULES_PRESET_ORIGIN_KINDS,
  GAME_RULES_PRESET_SCHEMA_VERSION,
  GAME_RULES_PRESET_STATES,
  GAME_RULES_SNAPSHOT_SCHEMA_VERSION,
  GAME_RULES_SNAPSHOT_SOURCE_KINDS,
  GAME_RULES_STRADDLE_TYPES,
  GAME_RULES_VARIANTS,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  createGameRulesDefinition,
  createGameRulesPreset,
  createGameRulesSnapshot,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getGameRulesSemanticFingerprint,
  parseGameRulesSemanticSerialization,
  serializeGameRulesSemantics,
  validateGameRulesDefinition,
  validateGameRulesPreset,
  validateGameRulesPresetSet,
  validateGameRulesSnapshot,
} from '../shared/poker-domain/index.js';

function definition(overrides = {}) {
  return {
    schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
    variant: GAME_RULES_VARIANTS.NO_LIMIT_TEXAS_HOLDEM,
    format: GAME_RULES_FORMATS.CASH,
    tableSize: { minimumSeated: 2, maximumSeated: 10 },
    blinds: {
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
    },
    ante: { type: 'none', amountMilliBb: 0 },
    straddle: { type: GAME_RULES_STRADDLE_TYPES.NONE },
    collectionPolicy: { type: GAME_RULES_COLLECTION_TYPES.NONE },
    ...overrides,
  };
}

function preset(overrides = {}) {
  return {
    schemaVersion: GAME_RULES_PRESET_SCHEMA_VERSION,
    id: 'test:rules:preset',
    revision: 1,
    origin: { kind: GAME_RULES_PRESET_ORIGIN_KINDS.USER_DEFINED },
    displayName: 'Test rules',
    description: 'Test description',
    state: GAME_RULES_PRESET_STATES.ACTIVE,
    setupDefaults: { seatedPlayers: 6 },
    definition: definition(),
    ...overrides,
  };
}

function legacyGame(overrides = {}) {
  return {
    mode: 'home',
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: 'none', amountMilliBb: 0 },
    ...overrides,
  };
}

function directSnapshot(definitionInput = definition(), seatedPlayers = 6) {
  return createGameRulesSnapshot({
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
    setup: { seatedPlayers },
    definition: definitionInput,
  });
}

test('the generic no-rake built-in validates and is deeply immutable', () => {
  const normalized = validateGameRulesPreset(NO_RAKE_CASH_GAME_RULES_PRESET);
  assert.equal(normalized.id, 'riverline:builtin:no-rake-cash');
  assert.equal(normalized.definition.format, GAME_RULES_FORMATS.CASH);
  assert.deepEqual(normalized.definition.tableSize, { minimumSeated: 2, maximumSeated: 10 });
  assert.deepEqual(normalized.definition.collectionPolicy, { type: 'none' });
  assert.equal(Object.isFrozen(NO_RAKE_CASH_GAME_RULES_PRESET), true);
  assert.equal(Object.isFrozen(NO_RAKE_CASH_GAME_RULES_PRESET.definition.blinds), true);
});

test('the generic fixed-per-seated-player built-in validates exact legacy-compatible math', () => {
  const normalized = validateGameRulesPreset(FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET);
  assert.equal(normalized.id.includes('clubgg'), false);
  assert.equal(normalized.definition.format, GAME_RULES_FORMATS.LEGACY_UNSPECIFIED);
  assert.deepEqual(normalized.definition.tableSize, { minimumSeated: 7, maximumSeated: 10 });
  assert.deepEqual(normalized.definition.collectionPolicy, {
    type: GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER,
    amountMilliBb: 100,
    timing: GAME_RULES_COLLECTION_TIMINGS.HAND_START_BEFORE_ANTES_AND_BLINDS,
    basis: GAME_RULES_COLLECTION_BASES.SEATED_PLAYERS,
    destination: GAME_RULES_COLLECTION_DESTINATIONS.OUTSIDE_CONTESTABLE_POT,
    rounding: GAME_RULES_COLLECTION_ROUNDING.NONE,
    shortfallPolicy: GAME_RULES_COLLECTION_SHORTFALL_POLICIES.REJECT_HAND,
  });
});

test('built-in identities are unique and the bounded set validates', () => {
  assert.equal(BUILT_IN_GAME_RULES_PRESETS.length, 2);
  assert.equal(new Set(BUILT_IN_GAME_RULES_PRESETS.map((entry) => entry.id)).size, 2);
  assert.equal(Object.isFrozen(BUILT_IN_GAME_RULES_PRESETS), true);
  assert.throws(
    () => validateGameRulesPresetSet([
      NO_RAKE_CASH_GAME_RULES_PRESET,
      { ...structuredClone(NO_RAKE_CASH_GAME_RULES_PRESET), revision: 2 },
    ]),
    /Duplicate GameRulesPreset id/,
  );
});

test('unknown variants fail explicitly', () => {
  assert.throws(
    () => validateGameRulesDefinition(definition({ variant: 'pot_limit_omaha' })),
    /Unsupported game rules variant: pot_limit_omaha/,
  );
});

test('malformed global and ordered table bounds fail', () => {
  for (const tableSize of [
    { minimumSeated: 1, maximumSeated: 10 },
    { minimumSeated: 2, maximumSeated: 11 },
    { minimumSeated: 8, maximumSeated: 7 },
    { minimumSeated: 2.5, maximumSeated: 10 },
  ]) {
    assert.throws(() => createGameRulesDefinition(definition({ tableSize })), /tableSize/);
  }
});

test('v1 rejects unknown and nonzero straddles explicitly', () => {
  assert.throws(
    () => createGameRulesDefinition(definition({ straddle: { type: 'utg' } })),
    /Unsupported straddle type/,
  );
  assert.throws(
    () => createGameRulesDefinition(definition({
      straddle: { type: 'none', amountMilliBb: 2000 },
    })),
    /must contain exactly/,
  );
});

test('unsupported collection policies and percentage-rake fields never become no collection', () => {
  assert.throws(
    () => createGameRulesDefinition(definition({
      collectionPolicy: { type: 'percentage_rake', percent: 5 },
    })),
    /Unsupported collection policy type: percentage_rake/,
  );
  assert.throws(
    () => createGameRulesDefinition(definition({
      collectionPolicy: { type: 'none', capMilliBb: 3000 },
    })),
    /must contain exactly/,
  );
});

test('malformed fixed collection amounts and enum values fail', () => {
  const valid = structuredClone(FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET.definition);
  valid.collectionPolicy.amountMilliBb = 0;
  assert.throws(() => createGameRulesDefinition(valid), /greater than zero/);

  valid.collectionPolicy.amountMilliBb = 150;
  assert.throws(() => createGameRulesDefinition(valid), /align/);

  valid.collectionPolicy.amountMilliBb = 100;
  valid.collectionPolicy.timing = 'after_flop';
  assert.throws(() => createGameRulesDefinition(valid), /Unsupported collection timing/);
});

test('Home compatibility creates an exact generic no-rake snapshot', () => {
  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame(), 6);
  assert.equal(snapshot.schemaVersion, GAME_RULES_SNAPSHOT_SCHEMA_VERSION);
  assert.deepEqual(snapshot.source, {
    kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.LEGACY_COMPATIBILITY,
    presetId: NO_RAKE_CASH_GAME_RULES_PRESET.id,
    presetRevision: NO_RAKE_CASH_GAME_RULES_PRESET.revision,
    legacyMode: 'home',
  });
  assert.deepEqual(snapshot.setup, { seatedPlayers: 6 });
  assert.equal(snapshot.definition.format, GAME_RULES_FORMATS.CASH);
  assert.deepEqual(snapshot.definition.tableSize, { minimumSeated: 2, maximumSeated: 10 });
  assert.deepEqual(snapshot.definition.collectionPolicy, { type: 'none' });
  assert.equal(snapshot.semanticFingerprint, getGameRulesSemanticFingerprint(snapshot.definition));
});

test('ClubGG compatibility creates the exact fixed collection and 7-10 policy', () => {
  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    9,
  );
  assert.equal(snapshot.source.legacyMode, 'clubgg');
  assert.equal(snapshot.source.presetId.includes('clubgg'), false);
  assert.deepEqual(snapshot.setup, { seatedPlayers: 9 });
  assert.equal(snapshot.definition.format, GAME_RULES_FORMATS.LEGACY_UNSPECIFIED);
  assert.deepEqual(snapshot.definition.tableSize, { minimumSeated: 7, maximumSeated: 10 });
  assert.deepEqual(snapshot.definition.collectionPolicy, {
    type: GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER,
    amountMilliBb: 100,
    timing: GAME_RULES_COLLECTION_TIMINGS.HAND_START_BEFORE_ANTES_AND_BLINDS,
    basis: GAME_RULES_COLLECTION_BASES.SEATED_PLAYERS,
    destination: GAME_RULES_COLLECTION_DESTINATIONS.OUTSIDE_CONTESTABLE_POT,
    rounding: GAME_RULES_COLLECTION_ROUNDING.NONE,
    shortfallPolicy: GAME_RULES_COLLECTION_SHORTFALL_POLICIES.REJECT_HAND,
  });
});

test('legacy adapters preserve every currently legal ante form', () => {
  for (const ante of [
    { type: 'none', amountMilliBb: 0 },
    { type: 'per_player', amountMilliBb: 100 },
    { type: 'big_blind', amountMilliBb: 600 },
  ]) {
    const home = createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame({ ante }), 6);
    const club = createGameRulesSnapshotFromLegacyGameConfiguration(
      legacyGame({ mode: 'clubgg', ante }),
      8,
    );
    assert.deepEqual(home.definition.ante, ante);
    assert.deepEqual(club.definition.ante, ante);
  }
});

test('legacy adapters preserve exact blind, chip-unit, and seated-player inputs', () => {
  const home = createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame({
    smallBlindMilliBb: 250,
    chipUnitMilliBb: 50,
  }), 4);
  assert.deepEqual(home.definition.blinds, {
    smallBlindMilliBb: 250,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 50,
  });
  assert.equal(home.setup.seatedPlayers, 4);

  const club = createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame({
    mode: 'clubgg',
    smallBlindMilliBb: 400,
    chipUnitMilliBb: 20,
  }), 10);
  assert.deepEqual(club.definition.blinds, {
    smallBlindMilliBb: 400,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 20,
  });
  assert.equal(club.setup.seatedPlayers, 10);
});

test('unknown legacy modes and unknown legacy rule fields fail without a Home fallback', () => {
  assert.throws(
    () => createGameRulesSnapshotFromLegacyGameConfiguration(
      legacyGame({ mode: 'mystery_operator' }),
      9,
    ),
    /Unsupported legacy game mode: mystery_operator/,
  );
  assert.throws(
    () => createGameRulesSnapshotFromLegacyGameConfiguration({
      ...legacyGame(),
      percentageRake: 5,
    }, 6),
    /must contain exactly/,
  );
});

test('legacy compatibility retains the existing ClubGG 7-10 boundary', () => {
  assert.throws(
    () => createGameRulesSnapshotFromLegacyGameConfiguration(
      legacyGame({ mode: 'clubgg' }),
      6,
    ),
    /7 through 10/,
  );
  assert.doesNotThrow(() => createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  ));
});

test('canonical serialization ignores JavaScript key insertion order', () => {
  const normal = definition();
  const reordered = {
    collectionPolicy: { type: 'none' },
    straddle: { type: 'none' },
    ante: { amountMilliBb: 0, type: 'none' },
    blinds: {
      chipUnitMilliBb: 100,
      bigBlindMilliBb: 1000,
      smallBlindMilliBb: 500,
    },
    tableSize: { maximumSeated: 10, minimumSeated: 2 },
    format: 'cash',
    variant: 'no_limit_texas_holdem',
    schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
  };
  assert.equal(serializeGameRulesSemantics(normal), serializeGameRulesSemantics(reordered));
  assert.equal(
    getGameRulesSemanticFingerprint(normal),
    getGameRulesSemanticFingerprint(reordered),
  );
});

test('preset rename and description changes do not alter semantic identity', () => {
  const before = createGameRulesPreset(preset());
  const renamed = createGameRulesPreset(preset({
    displayName: 'Renamed rules',
    description: 'Entirely different prose',
  }));
  assert.equal(
    getGameRulesSemanticFingerprint(before.definition),
    getGameRulesSemanticFingerprint(renamed.definition),
  );
});

test('preset revision-only changes do not alter semantic identity', () => {
  const revisionOne = createGameRulesPreset(preset({ revision: 1 }));
  const revisionTwo = createGameRulesPreset(preset({ revision: 2 }));
  assert.equal(
    getGameRulesSemanticFingerprint(revisionOne.definition),
    getGameRulesSemanticFingerprint(revisionTwo.definition),
  );
});

test('operator provenance changes do not alter semantic identity', () => {
  const operatorA = createGameRulesPreset(preset({
    origin: { kind: GAME_RULES_PRESET_ORIGIN_KINDS.EXTERNAL, operator: 'Operator A' },
  }));
  const operatorB = createGameRulesPreset(preset({
    origin: { kind: GAME_RULES_PRESET_ORIGIN_KINDS.EXTERNAL, operator: 'Operator B' },
  }));
  assert.equal(
    getGameRulesSemanticFingerprint(operatorA.definition),
    getGameRulesSemanticFingerprint(operatorB.definition),
  );
});

test('collection amount changes semantic identity', () => {
  const original = structuredClone(FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET.definition);
  const changed = structuredClone(original);
  changed.collectionPolicy.amountMilliBb = 200;
  assert.notEqual(
    getGameRulesSemanticFingerprint(original),
    getGameRulesSemanticFingerprint(changed),
  );
});

test('ante changes semantic identity', () => {
  assert.notEqual(
    getGameRulesSemanticFingerprint(definition()),
    getGameRulesSemanticFingerprint(definition({
      ante: { type: 'per_player', amountMilliBb: 100 },
    })),
  );
});

test('table-size policy changes semantic identity', () => {
  assert.notEqual(
    getGameRulesSemanticFingerprint(definition()),
    getGameRulesSemanticFingerprint(definition({
      tableSize: { minimumSeated: 2, maximumSeated: 9 },
    })),
  );
});

test('snapshot validation rejects a fingerprint and definition mismatch', () => {
  const snapshot = structuredClone(directSnapshot());
  snapshot.definition.tableSize.maximumSeated = 9;
  assert.throws(
    () => validateGameRulesSnapshot(snapshot),
    /semanticFingerprint does not match/,
  );
});

test('validated snapshots are normalized copies that cannot be mutated', () => {
  const portable = structuredClone(directSnapshot());
  const snapshot = validateGameRulesSnapshot(portable);
  assert.notEqual(snapshot, portable);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.source), true);
  assert.equal(Object.isFrozen(snapshot.setup), true);
  assert.equal(Object.isFrozen(snapshot.definition.collectionPolicy), true);
  assert.throws(() => {
    snapshot.definition.tableSize.maximumSeated = 9;
  }, TypeError);
  assert.equal(snapshot.definition.tableSize.maximumSeated, 10);
});

test('malformed preset and snapshot revisions fail explicitly', () => {
  assert.throws(() => createGameRulesPreset(preset({ revision: 0 })), /positive safe integer/);
  const snapshot = structuredClone(directSnapshot());
  snapshot.source = {
    kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
    presetId: 'test:rules:preset',
    presetRevision: 0,
  };
  assert.throws(() => validateGameRulesSnapshot(snapshot), /positive safe integer/);
});

test('canonical serialization and portable snapshot import round-trip deterministically', () => {
  const first = serializeGameRulesSemantics(
    FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET.definition,
  );
  const importedDefinition = parseGameRulesSemanticSerialization(first);
  const second = serializeGameRulesSemantics(importedDefinition);
  assert.equal(second, first);

  const snapshot = createGameRulesSnapshot({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
      presetId: FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET.id,
      presetRevision: FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET.revision,
    },
    setup: { seatedPlayers: 8 },
    definition: importedDefinition,
  });
  const importedSnapshot = validateGameRulesSnapshot(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual(importedSnapshot, snapshot);
  assert.equal(importedSnapshot.semanticFingerprint, getGameRulesSemanticFingerprint(importedDefinition));
});

test('public index exposes the bounded Game Rules v1 API in Node ESM form', () => {
  assert.equal(typeof createGameRulesDefinition, 'function');
  assert.equal(typeof createGameRulesPreset, 'function');
  assert.equal(typeof createGameRulesSnapshot, 'function');
  assert.equal(typeof createGameRulesSnapshotFromLegacyGameConfiguration, 'function');
  assert.equal(typeof serializeGameRulesSemantics, 'function');
  assert.equal(GAME_RULES_DEFINITION_SCHEMA_VERSION, 'game-rules-definition/v1');
  assert.equal(GAME_RULES_PRESET_SCHEMA_VERSION, 'game-rules-preset/v1');
  assert.equal(GAME_RULES_SNAPSHOT_SCHEMA_VERSION, 'game-rules-snapshot/v1');
});
