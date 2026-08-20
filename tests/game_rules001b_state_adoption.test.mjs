import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GAME_RULES_COLLECTION_TYPES,
  GAME_RULES_SNAPSHOT_SOURCE_KINDS,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  POKER_STATE_V2_SCHEMA_VERSION,
  applyAction,
  applyChance,
  applyPrivateReveal,
  createAction,
  createGameRulesSnapshot,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  deductionTotalsByPlayer,
  derivePotAccounting,
  getLegalActionSpec,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  isChipConserved,
  ledgerTotals,
  resolveShowdown,
  validateInitializedPokerState,
  validatePokerState,
} from '../shared/poker-domain/index.js';

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

function playerSeeds(count, stack = 100000) {
  return Array.from({ length: count }, (_, seat) => ({
    playerId: `P${seat}`,
    seat,
    startingStackMilliBb: typeof stack === 'function' ? stack(seat) : stack,
  }));
}

function legacyConfiguration(game, count, overrides = {}) {
  return {
    handId: 'game-rules-001b-fixture',
    game,
    buttonSeat: 0,
    players: playerSeeds(count),
    ...overrides,
  };
}

function snapshotConfiguration(rulesSnapshot, overrides = {}) {
  return {
    handId: 'game-rules-001b-fixture',
    rulesSnapshot,
    buttonSeat: 0,
    players: playerSeeds(rulesSnapshot.setup.seatedPlayers),
    ...overrides,
  };
}

function normalizedCollectionAmount(state) {
  if (state.schemaVersion === 'poker-state/v1') {
    return state.game.forcedContributionPerPlayerMilliBb;
  }
  const policy = state.rulesSnapshot.definition.collectionPolicy;
  return policy.type === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER
    ? policy.amountMilliBb
    : 0;
}

function realizedFacts(state) {
  return {
    handId: state.handId,
    game: {
      variant: state.game.variant,
      tableSize: state.game.tableSize,
      smallBlindMilliBb: state.game.smallBlindMilliBb,
      bigBlindMilliBb: state.game.bigBlindMilliBb,
      chipUnitMilliBb: state.game.chipUnitMilliBb,
      ante: structuredClone(state.game.ante),
      collectionAmountMilliBb: normalizedCollectionAmount(state),
    },
    phase: state.phase,
    street: state.street,
    buttonSeat: state.buttonSeat,
    actingPlayerId: state.actingPlayerId,
    board: structuredClone(state.board),
    deadCards: structuredClone(state.deadCards),
    players: structuredClone(state.players),
    potMilliBb: state.potMilliBb,
    deductionTotalMilliBb: state.deductionTotalMilliBb,
    currentBetMilliBb: state.currentBetMilliBb,
    lastFullRaiseIncrementMilliBb: state.lastFullRaiseIncrementMilliBb,
    lastAggressorPlayerId: state.lastAggressorPlayerId,
    actionHistory: structuredClone(state.actionHistory),
    ledger: state.ledger.map((entry) => ({
      ...structuredClone(entry),
      kind: [
        LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION,
        LEDGER_KINDS.FIXED_PLAYER_COLLECTION,
      ].includes(entry.kind)
        ? LEDGER_KINDS.FIXED_PLAYER_COLLECTION
        : entry.kind,
    })),
    pendingChance: structuredClone(state.pendingChance),
    terminal: structuredClone(state.terminal),
    showdown: structuredClone(state.showdown),
  };
}

function assertRealizedEquivalent(v1, v2) {
  assert.deepEqual(realizedFacts(v2), realizedFacts(v1));
  if (v1.phase === 'betting') {
    assert.deepEqual(getLegalActionSpec(v2), getLegalActionSpec(v1));
  }
}

function initializeLegacyPair(game, count, overrides = {}) {
  const configuration = legacyConfiguration(game, count, overrides);
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(game, count);
  return [
    initializeHand(configuration),
    initializeHandFromGameRulesSnapshot({
      handId: configuration.handId,
      rulesSnapshot,
      buttonSeat: configuration.buttonSeat,
      players: configuration.players,
    }),
  ];
}

function hiddenDeal(state) {
  return applyChance(state, {
    type: 'deal_hole',
    cardsByPlayer: {},
    hiddenPlayerIds: state.players.map((player) => player.playerId),
  });
}

function assertRulesSnapshotPreserved(previousState, nextState) {
  assert.equal(nextState.schemaVersion, POKER_STATE_V2_SCHEMA_VERSION);
  assert.equal(nextState.rulesSnapshot, previousState.rulesSnapshot);
  assert.equal(Object.isFrozen(nextState.rulesSnapshot), true);
  return nextState;
}

test('PokerState v2 initializes no-rake HU and 10-max from immutable snapshot authority', () => {
  for (const count of [2, 10]) {
    const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame(), count);
    const state = initializeHandFromGameRulesSnapshot(snapshotConfiguration(snapshot));

    assert.equal(state.schemaVersion, POKER_STATE_V2_SCHEMA_VERSION);
    assert.equal(Object.hasOwn(state.game, 'mode'), false);
    assert.equal(Object.hasOwn(state.game, 'forcedContributionPerPlayerMilliBb'), false);
    assert.notEqual(state.rulesSnapshot, snapshot);
    assert.equal(state.rulesSnapshot.semanticFingerprint, snapshot.semanticFingerprint);
    assert.equal(state.deductionTotalMilliBb, 0);
    assert.equal(state.ledger.some((entry) => (
      entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION
    )), false);
    assert.equal(validateInitializedPokerState(state), state);
    assert.equal(isChipConserved(state), true);
  }
});

test('fixed collection uses a generic hand-start ledger before ante and blinds and stays outside pot layers', () => {
  const game = legacyGame({
    mode: 'clubgg',
    ante: { type: 'per_player', amountMilliBb: 100 },
  });
  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(game, 7);
  const state = initializeHandFromGameRulesSnapshot(snapshotConfiguration(snapshot));
  const collectionEntries = state.ledger.slice(0, 7);

  assert.deepEqual(collectionEntries.map((entry) => entry.kind), Array(7).fill(
    LEDGER_KINDS.FIXED_PLAYER_COLLECTION,
  ));
  assert.ok(collectionEntries.every((entry) => (
    entry.street === 'hand'
      && entry.movement === LEDGER_MOVEMENTS.STACK_TO_DEDUCTION
      && entry.amountMilliBb === 100
  )));
  assert.deepEqual(state.ledger.slice(7, 14).map((entry) => entry.kind), Array(7).fill(
    LEDGER_KINDS.ANTE,
  ));
  assert.deepEqual(state.ledger.slice(14).map((entry) => entry.kind), [
    LEDGER_KINDS.SMALL_BLIND,
    LEDGER_KINDS.BIG_BLIND,
  ]);
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.equal(state.potMilliBb, 2200);
  assert.deepEqual(derivePotAccounting(state), {
    potLayers: [{
      schemaVersion: 'poker-pot-layer/v1',
      amountMilliBb: 700,
      contributionFloorMilliBb: 0,
      contributionCeilingMilliBb: 100,
      contributorPlayerIds: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      eligiblePlayerIds: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    }, {
      schemaVersion: 'poker-pot-layer/v1',
      amountMilliBb: 1000,
      contributionFloorMilliBb: 100,
      contributionCeilingMilliBb: 600,
      contributorPlayerIds: ['P1', 'P2'],
      eligiblePlayerIds: ['P1', 'P2'],
    }],
    unmatchedContribution: {
      schemaVersion: 'poker-unmatched-contribution/v1',
      playerId: 'P2',
      amountMilliBb: 500,
      contributionFloorMilliBb: 600,
      contributionCeilingMilliBb: 1100,
    },
    contestablePotMilliBb: 1700,
    unmatchedMilliBb: 500,
  });
  assert.equal(isChipConserved(state), true);
});

test('fixed collection executes the exact snapshot amount instead of a branded constant', () => {
  const legacyFixed = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  );
  const definition = structuredClone(legacyFixed.definition);
  definition.collectionPolicy.amountMilliBb = 200;
  const snapshot = createGameRulesSnapshot({
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
    setup: { seatedPlayers: 7 },
    definition,
  });
  const state = initializeHandFromGameRulesSnapshot(snapshotConfiguration(snapshot));

  assert.equal(state.deductionTotalMilliBb, 1400);
  assert.ok(state.players.every((player) => player.totalDeductionMilliBb === 200));
  assert.ok(state.ledger.slice(0, 7).every((entry) => (
    entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION && entry.amountMilliBb === 200
  )));
  assert.equal(state.potMilliBb, 1500);
  assert.equal(isChipConserved(state), true);
});

test('deduction and conservation selectors read both legacy and generic ledgers without brand switching', () => {
  const game = legacyGame({ mode: 'clubgg' });
  const [v1, v2] = initializeLegacyPair(game, 7);

  assert.deepEqual(ledgerTotals(v1), ledgerTotals(v2));
  assert.deepEqual(deductionTotalsByPlayer(v1), deductionTotalsByPlayer(v2));
  assert.deepEqual(deductionTotalsByPlayer(v2), {
    P0: 100,
    P1: 100,
    P2: 100,
    P3: 100,
    P4: 100,
    P5: 100,
    P6: 100,
  });
  assert.equal(isChipConserved(v1), true);
  assert.equal(isChipConserved(v2), true);
});

test('Home v1 and snapshot-authoritative v2 stay equivalent through legal actions and showdown', () => {
  let [v1, v2] = initializeLegacyPair(legacyGame(), 2);
  assertRealizedEquivalent(v1, v2);

  const holeDeal = {
    type: 'deal_hole',
    cardsByPlayer: { P0: ['As', 'Ah'], P1: ['Ks', 'Kh'] },
  };
  v1 = applyChance(v1, holeDeal);
  v2 = applyChance(v2, holeDeal);
  assertRealizedEquivalent(v1, v2);

  const applyBoth = (action) => {
    v1 = applyAction(v1, action);
    v2 = applyAction(v2, action);
    assertRealizedEquivalent(v1, v2);
  };
  const chanceBoth = (chanceEvent) => {
    v1 = applyChance(v1, chanceEvent);
    v2 = applyChance(v2, chanceEvent);
    assertRealizedEquivalent(v1, v2);
  };

  applyBoth(createAction('P0', 'call'));
  applyBoth(createAction('P1', 'check'));
  chanceBoth({ type: 'deal_flop', cards: ['2c', '3d', '4h'] });
  applyBoth(createAction('P1', 'check'));
  applyBoth(createAction('P0', 'check'));
  chanceBoth({ type: 'deal_turn', cards: ['7s'] });
  applyBoth(createAction('P1', 'check'));
  applyBoth(createAction('P0', 'check'));
  chanceBoth({ type: 'deal_river', cards: ['9c'] });
  applyBoth(createAction('P1', 'check'));
  applyBoth(createAction('P0', 'check'));

  v1 = resolveShowdown(v1);
  v2 = resolveShowdown(v2);
  assertRealizedEquivalent(v1, v2);
  assert.equal(v2.phase, 'terminal');
  assert.equal(v2.potMilliBb, 0);
  assert.deepEqual(v2.terminal.winnerPlayerIds, ['P0']);
});

test('ClubGG v1 and fixed-collection v2 stay equivalent through multiway action and fold terminal', () => {
  const game = legacyGame({
    mode: 'clubgg',
    ante: { type: 'big_blind', amountMilliBb: 600 },
  });
  let [v1, v2] = initializeLegacyPair(game, 7);
  assertRealizedEquivalent(v1, v2);
  assert.deepEqual(v2.ledger.slice(0, 7).map((entry) => entry.amountMilliBb), Array(7).fill(100));

  v1 = hiddenDeal(v1);
  v2 = hiddenDeal(v2);
  assertRealizedEquivalent(v1, v2);
  while (v1.phase === 'betting') {
    assert.deepEqual(getLegalActionSpec(v2), getLegalActionSpec(v1));
    const action = createAction(v1.actingPlayerId, 'fold');
    v1 = applyAction(v1, action);
    v2 = applyAction(v2, action);
    assertRealizedEquivalent(v1, v2);
  }

  assert.equal(v2.phase, 'terminal');
  assert.equal(v2.deductionTotalMilliBb, 700);
  assert.equal(v2.potMilliBb, 0);
  assert.equal(isChipConserved(v2), true);
});

test('fixed collection preserves exact-payment, short-ante, partial-blind, and full-blind boundaries', () => {
  const anteGame = legacyGame({
    mode: 'clubgg',
    chipUnitMilliBb: 50,
    ante: { type: 'per_player', amountMilliBb: 100 },
  });
  const anteSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(anteGame, 7);
  const anteState = initializeHandFromGameRulesSnapshot(snapshotConfiguration(anteSnapshot, {
    players: playerSeeds(7, (seat) => seat === 3 ? 150 : 100000),
  }));
  const shortAnte = anteState.players.find((player) => player.playerId === 'P3');
  assert.equal(shortAnte.totalDeductionMilliBb, 100);
  assert.equal(shortAnte.totalPotContributionMilliBb, 50);
  assert.equal(shortAnte.currentStackMilliBb, 0);

  const blindGame = legacyGame({ mode: 'clubgg' });
  const blindSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(blindGame, 7);
  const blindState = initializeHandFromGameRulesSnapshot(snapshotConfiguration(blindSnapshot, {
    players: playerSeeds(7, (seat) => ({ 1: 400, 2: 1100, 3: 100 }[seat] ?? 100000)),
  }));
  const byId = Object.fromEntries(blindState.players.map((player) => [player.playerId, player]));
  assert.deepEqual({
    exactCollection: {
      stack: byId.P3.currentStackMilliBb,
      pot: byId.P3.totalPotContributionMilliBb,
      deduction: byId.P3.totalDeductionMilliBb,
    },
    partialSmallBlind: {
      stack: byId.P1.currentStackMilliBb,
      street: byId.P1.streetContributionMilliBb,
      deduction: byId.P1.totalDeductionMilliBb,
    },
    fullBigBlind: {
      stack: byId.P2.currentStackMilliBb,
      street: byId.P2.streetContributionMilliBb,
      deduction: byId.P2.totalDeductionMilliBb,
    },
  }, {
    exactCollection: { stack: 0, pot: 0, deduction: 100 },
    partialSmallBlind: { stack: 0, street: 300, deduction: 100 },
    fullBigBlind: { stack: 0, street: 1000, deduction: 100 },
  });
  assert.equal(isChipConserved(anteState), true);
  assert.equal(isChipConserved(blindState), true);
});

test('insufficient fixed collection rejects atomically before any player can pay', () => {
  const game = legacyGame({ mode: 'clubgg', chipUnitMilliBb: 1 });
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(game, 7);
  const players = playerSeeds(7, (seat) => seat === 4 ? 99 : 100000);
  const originalPlayers = structuredClone(players);

  assert.throws(() => initializeHandFromGameRulesSnapshot(snapshotConfiguration(rulesSnapshot, {
    players,
  })), /cannot pay fixed collection of 100 milliBb/);
  assert.deepEqual(players, originalPlayers);
  assert.equal(Object.isFrozen(rulesSnapshot), true);
});

test('snapshot initialization rejects invalid fingerprints, seated mismatch, table-policy mismatch, and fields', () => {
  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  );
  const badFingerprint = structuredClone(snapshot);
  badFingerprint.semanticFingerprint = 'game-rules-semantic/v1:tampered';
  assert.throws(() => initializeHandFromGameRulesSnapshot(
    snapshotConfiguration(badFingerprint),
  ), /semanticFingerprint does not match/);

  assert.throws(() => initializeHandFromGameRulesSnapshot(snapshotConfiguration(snapshot, {
    players: playerSeeds(8),
  })), /seatedPlayers must match/);

  const tablePolicyMismatch = structuredClone(snapshot);
  tablePolicyMismatch.setup.seatedPlayers = 6;
  assert.throws(() => initializeHandFromGameRulesSnapshot(snapshotConfiguration(
    tablePolicyMismatch,
    { players: playerSeeds(6) },
  )), /fit the definition table-size policy/);

  assert.throws(() => initializeHandFromGameRulesSnapshot({
    ...snapshotConfiguration(snapshot),
    game: legacyGame({ mode: 'clubgg' }),
  }), /unsupported fields: game/);
});

test('accessor-backed snapshot identities are re-normalized instead of receiving stale trust', () => {
  const firstSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  );
  const changedDefinition = structuredClone(firstSnapshot.definition);
  changedDefinition.collectionPolicy.amountMilliBb = 200;
  const secondSnapshot = createGameRulesSnapshot({
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
    setup: { seatedPlayers: 7 },
    definition: changedDefinition,
  });

  let exposedSnapshot = firstSnapshot;
  const accessorSnapshot = {};
  for (const key of Object.keys(firstSnapshot)) {
    Object.defineProperty(accessorSnapshot, key, {
      enumerable: true,
      get: () => exposedSnapshot[key],
    });
  }
  Object.freeze(accessorSnapshot);

  const configuration = snapshotConfiguration(accessorSnapshot);
  const firstState = initializeHandFromGameRulesSnapshot(configuration);
  assert.equal(firstState.ledger[0].amountMilliBb, 100);
  assert.notEqual(firstState.rulesSnapshot, accessorSnapshot);

  exposedSnapshot = secondSnapshot;
  const secondState = initializeHandFromGameRulesSnapshot(configuration);
  assert.equal(accessorSnapshot.definition.collectionPolicy.amountMilliBb, 200);
  assert.equal(secondState.rulesSnapshot.definition.collectionPolicy.amountMilliBb, 200);
  assert.equal(secondState.ledger[0].amountMilliBb, 200);
  assert.equal(secondState.deductionTotalMilliBb, 1400);

  exposedSnapshot = firstSnapshot;
  const directValidationState = structuredClone(firstState);
  directValidationState.rulesSnapshot = accessorSnapshot;
  assert.equal(validatePokerState(directValidationState), directValidationState);
  exposedSnapshot = secondSnapshot;
  assert.throws(() => validatePokerState(directValidationState), (
    error
  ) => error instanceof RangeError && /Fixed collection must be exact/.test(error.message));
});

test('7-max fixed collection is valid while a 6-max fixed snapshot is invalid', () => {
  const seven = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  );
  assert.equal(initializeHandFromGameRulesSnapshot(snapshotConfiguration(seven)).players.length, 7);
  assert.throws(() => createGameRulesSnapshot({
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
    setup: { seatedPlayers: 6 },
    definition: seven.definition,
  }), /fit the definition table-size policy/);
});

test('unsupported future collection mechanics fail instead of coercing to no collection', () => {
  const future = structuredClone(createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame(), 6));
  future.definition.collectionPolicy = {
    type: 'percentage_rake',
    percent: 5,
  };
  assert.throws(() => initializeHandFromGameRulesSnapshot(snapshotConfiguration(future)), (
    error
  ) => error instanceof RangeError && /Unsupported collection policy type/.test(error.message));
});

test('direct, preset, and contradictory legacy brand provenance never change v2 execution', () => {
  const base = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  );
  const direct = createGameRulesSnapshot({
    source: { kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.DIRECT },
    setup: base.setup,
    definition: base.definition,
  });
  const presetA = createGameRulesSnapshot({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
      presetId: 'unknown:room:a',
      presetRevision: 1,
    },
    setup: base.setup,
    definition: base.definition,
  });
  const presetB = createGameRulesSnapshot({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.PRESET,
      presetId: 'unknown:room:b',
      presetRevision: 99,
    },
    setup: base.setup,
    definition: base.definition,
  });
  const legacyHomeProvenance = createGameRulesSnapshot({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.LEGACY_COMPATIBILITY,
      presetId: base.source.presetId,
      presetRevision: base.source.presetRevision,
      legacyMode: 'home',
    },
    setup: base.setup,
    definition: base.definition,
  });

  const directState = initializeHandFromGameRulesSnapshot(snapshotConfiguration(direct));
  assert.deepEqual(realizedFacts(
    initializeHandFromGameRulesSnapshot(snapshotConfiguration(presetA)),
  ), realizedFacts(directState));
  assert.deepEqual(realizedFacts(
    initializeHandFromGameRulesSnapshot(snapshotConfiguration(presetB)),
  ), realizedFacts(directState));
  assert.deepEqual(realizedFacts(
    initializeHandFromGameRulesSnapshot(snapshotConfiguration(legacyHomeProvenance)),
  ), realizedFacts(directState));
  assert.equal(directState.deductionTotalMilliBb, 700);
});

test('v2 validation rejects wrong collection movement, order, duplicates, totals, and game projection', () => {
  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg', ante: { type: 'per_player', amountMilliBb: 100 } }),
    7,
  );
  const state = initializeHandFromGameRulesSnapshot(snapshotConfiguration(snapshot));

  const inPot = structuredClone(state);
  inPot.ledger[0].movement = LEDGER_MOVEMENTS.STACK_TO_POT;
  assert.throws(() => validatePokerState(inPot), /must be non-pot deductions/);

  const late = structuredClone(state);
  [late.ledger[0], late.ledger[7]] = [late.ledger[7], late.ledger[0]];
  late.ledger.forEach((entry, index) => { entry.sequence = index; });
  assert.throws(() => validatePokerState(late), /precede antes and blinds/);

  const duplicate = structuredClone(state);
  duplicate.ledger.push({
    ...duplicate.ledger[0],
    sequence: duplicate.ledger.length,
  });
  duplicate.players[0].currentStackMilliBb -= 100;
  duplicate.players[0].totalDeductionMilliBb += 100;
  duplicate.deductionTotalMilliBb += 100;
  assert.throws(() => validatePokerState(duplicate), /exactly once per seated player/);

  const wrongPlayerTotal = structuredClone(state);
  wrongPlayerTotal.ledger[0].playerId = 'P1';
  assert.throws(() => validatePokerState(wrongPlayerTotal), /Ledger does not agree with player totals/);

  const wrongGame = structuredClone(state);
  wrongGame.game.smallBlindMilliBb = 400;
  assert.throws(() => validatePokerState(wrongGame), /exactly project its GameRulesSnapshot/);
});

test('one normalized v2 snapshot identity survives actions, streets, chance, reveal, showdown, and payout', () => {
  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame(), 2);
  let state = initializeHandFromGameRulesSnapshot(snapshotConfiguration(snapshot));
  const normalizedRulesSnapshot = state.rulesSnapshot;
  const advance = (nextState) => {
    state = assertRulesSnapshotPreserved(state, nextState);
  };

  advance(hiddenDeal(state));
  advance(applyAction(state, createAction('P0', 'call')));
  advance(applyAction(state, createAction('P1', 'check')));
  assert.equal(state.phase, 'chance');

  advance(applyChance(state, { type: 'deal_flop', cards: ['2c', '3d', '4h'] }));
  assert.equal(state.street, 'flop');
  advance(applyAction(state, createAction('P1', 'check')));
  advance(applyAction(state, createAction('P0', 'check')));
  advance(applyChance(state, { type: 'deal_turn', cards: ['7s'] }));
  advance(applyAction(state, createAction('P1', 'check')));
  advance(applyAction(state, createAction('P0', 'check')));
  advance(applyChance(state, { type: 'deal_river', cards: ['9c'] }));
  advance(applyAction(state, createAction('P1', 'check')));
  advance(applyAction(state, createAction('P0', 'check')));
  assert.equal(state.showdown.status, 'awaiting_private_reveal');

  advance(applyPrivateReveal(state, { playerId: 'P0', cards: ['As', 'Ah'] }));
  advance(applyPrivateReveal(state, { playerId: 'P1', cards: ['Ks', 'Kh'] }));
  assert.equal(state.showdown.status, 'ready');
  advance(resolveShowdown(state));

  assert.equal(state.rulesSnapshot, normalizedRulesSnapshot);
  assert.equal(state.schemaVersion, POKER_STATE_V2_SCHEMA_VERSION);
  assert.equal(state.terminal.reason, 'showdown');
  assert.equal(state.potMilliBb, 0);
  assert.ok(state.ledger.some((entry) => entry.kind === LEDGER_KINDS.POT_AWARD));
});

test('fixed collection is not reapplied and its snapshot identity survives fold settlement', () => {
  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  );
  let state = initializeHandFromGameRulesSnapshot(snapshotConfiguration(snapshot));
  const normalizedRulesSnapshot = state.rulesSnapshot;
  const before = JSON.stringify(state);
  for (let index = 0; index < 10; index += 1) {
    ledgerTotals(state);
    deductionTotalsByPlayer(state);
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(Object.isFrozen(normalizedRulesSnapshot.definition.collectionPolicy), true);
  assert.throws(() => {
    normalizedRulesSnapshot.setup.seatedPlayers = 8;
  }, TypeError);

  state = assertRulesSnapshotPreserved(state, hiddenDeal(state));
  while (state.phase === 'betting') {
    state = assertRulesSnapshotPreserved(
      state,
      applyAction(state, createAction(state.actingPlayerId, 'fold')),
    );
  }

  assert.equal(state.rulesSnapshot, normalizedRulesSnapshot);
  assert.equal(state.schemaVersion, POKER_STATE_V2_SCHEMA_VERSION);
  assert.equal(state.terminal.reason, 'fold');
  assert.equal(state.potMilliBb, 0);
  assert.equal(state.ledger.filter((entry) => (
    entry.kind === LEDGER_KINDS.FIXED_PLAYER_COLLECTION
  )).length, 7);
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.ok(state.ledger.some((entry) => entry.kind === LEDGER_KINDS.POT_AWARD));
});

test('legacy v1 state and brand-specific ledger remain valid while ledger kinds stay version-specific', () => {
  const v1 = initializeHand(legacyConfiguration(legacyGame({ mode: 'clubgg' }), 7));
  assert.equal(validatePokerState(v1), v1);
  assert.equal(v1.ledger[0].kind, LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION);

  const v1WithGenericKind = structuredClone(v1);
  v1WithGenericKind.ledger.slice(0, 7).forEach((entry) => {
    entry.kind = LEDGER_KINDS.FIXED_PLAYER_COLLECTION;
  });
  assert.throws(() => validatePokerState(v1WithGenericKind), /Invalid ledger kind/);

  const snapshot = createGameRulesSnapshotFromLegacyGameConfiguration(
    legacyGame({ mode: 'clubgg' }),
    7,
  );
  const v2WithBrandKind = structuredClone(initializeHandFromGameRulesSnapshot(
    snapshotConfiguration(snapshot),
  ));
  v2WithBrandKind.ledger.slice(0, 7).forEach((entry) => {
    entry.kind = LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION;
  });
  assert.throws(() => validatePokerState(v2WithBrandKind), /Invalid ledger kind/);
});

test('the public domain index exposes the explicit v2 state API and schema', () => {
  assert.equal(typeof initializeHandFromGameRulesSnapshot, 'function');
  assert.equal(POKER_STATE_V2_SCHEMA_VERSION, 'poker-state/v2');
  assert.equal(LEDGER_KINDS.FIXED_PLAYER_COLLECTION, 'fixed_player_collection');
});
