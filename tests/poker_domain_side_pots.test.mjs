import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  LEDGER_KINDS,
  LEDGER_MOVEMENTS,
  PHASES,
  POKER_POT_LAYER_SCHEMA_VERSION,
  POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION,
  STREETS,
  applyAction,
  applyChance,
  createAction,
  derivePotAccounting,
  derivePotLayers,
  deriveUnmatchedContribution,
  initializeHand,
  isChipConserved,
  isPlayerAllIn,
  playerById,
  validatePokerState,
  validatePotAccounting,
} from '../shared/poker-domain/index.js';

const HOLE_DECK = Object.freeze([
  'As', 'Kh', 'Qd', 'Jc', 'Ts', '9h', '8d', '7c', '6s', '5h',
  '4d', '3c', '2s', 'Ah', 'Kd', 'Qc', 'Js', 'Th', '9d', '8c',
]);
const FLOP = Object.freeze(['2h', '3h', '4h']);
const TURN = Object.freeze(['5d']);
const RIVER = Object.freeze(['6d']);

function playerIds(count) {
  return Array.from({ length: count }, (_, index) => `P${index}`);
}

function contributionState(contributions, {
  foldedPlayerIds = [],
  mode = GAME_MODES.HOME,
  refundsByPlayerId = {},
  startingStacks = contributions.map((amount) => amount + 100_000),
} = {}) {
  const state = structuredClone(initializeHand({
    handId: 'engine-007-derived-state',
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: contributions.map((_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: startingStacks[seat],
    })),
  }));

  const deductionEntries = state.ledger.filter((entry) => (
    entry.kind === LEDGER_KINDS.CLUBGG_FORCED_CONTRIBUTION
  ));
  state.ledger = deductionEntries.map((entry, sequence) => ({ ...entry, sequence }));
  state.potMilliBb = 0;
  for (const [index, player] of state.players.entries()) {
    const contribution = contributions[index];
    const refund = refundsByPlayerId[player.playerId] || 0;
    player.currentStackMilliBb = player.startingStackMilliBb
      - player.totalDeductionMilliBb - contribution + refund;
    player.streetContributionMilliBb = contribution;
    player.totalPotContributionMilliBb = contribution;
    player.folded = foldedPlayerIds.includes(player.playerId);
    player.actedThisStreet = false;
    player.raiseReopenAtMilliBb = null;
    if (contribution > 0) {
      state.ledger.push({
        sequence: state.ledger.length,
        playerId: player.playerId,
        street: STREETS.PREFLOP,
        kind: LEDGER_KINDS.ACTION,
        movement: LEDGER_MOVEMENTS.STACK_TO_POT,
        amountMilliBb: contribution,
      });
      state.potMilliBb += contribution;
    }
    if (refund > 0) {
      state.ledger.push({
        sequence: state.ledger.length,
        playerId: player.playerId,
        street: STREETS.PREFLOP,
        kind: LEDGER_KINDS.UNCALLED_REFUND,
        movement: LEDGER_MOVEMENTS.POT_TO_STACK,
        amountMilliBb: refund,
      });
      state.potMilliBb -= refund;
    }
  }
  validatePokerState(state);
  return state;
}

function layer(amount, floor, ceiling, contributors, eligible = contributors) {
  return {
    schemaVersion: POKER_POT_LAYER_SCHEMA_VERSION,
    amountMilliBb: amount,
    contributionFloorMilliBb: floor,
    contributionCeilingMilliBb: ceiling,
    contributorPlayerIds: contributors,
    eligiblePlayerIds: eligible,
  };
}

function unmatched(playerId, amount, floor, ceiling) {
  return {
    schemaVersion: POKER_UNMATCHED_CONTRIBUTION_SCHEMA_VERSION,
    playerId,
    amountMilliBb: amount,
    contributionFloorMilliBb: floor,
    contributionCeilingMilliBb: ceiling,
  };
}

function assertPotInvariant(state, accounting = derivePotAccounting(state)) {
  const layerTotal = accounting.potLayers.reduce((sum, potLayer) => (
    sum + potLayer.amountMilliBb
  ), 0);
  assert.equal(layerTotal, accounting.contestablePotMilliBb);
  assert.equal(layerTotal + accounting.unmatchedMilliBb, state.potMilliBb);
  assert.equal(isChipConserved(state), true);
  validatePotAccounting(state, accounting);
}

function cardsFor(playerCount) {
  return Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [
    `P${index}`,
    [HOLE_DECK[index * 2], HOLE_DECK[index * 2 + 1]],
  ]));
}

function initializedTable(playerCount, stacks) {
  return initializeHand({
    handId: `engine-007-showdown-${playerCount}`,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stacks[seat],
    })),
  });
}

function dealtTable(playerCount, stacks) {
  return applyChance(initializedTable(playerCount, stacks), {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: cardsFor(playerCount),
  });
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
}

function applyBoard(state, type, cards) {
  return applyChance(state, { type, cards });
}

function runOut(state) {
  state = applyBoard(state, CHANCE_TYPES.DEAL_FLOP, FLOP);
  state = applyBoard(state, CHANCE_TYPES.DEAL_TURN, TURN);
  return applyBoard(state, CHANCE_TYPES.DEAL_RIVER, RIVER);
}

function checkedToRiver() {
  let state = dealtTable(2, [100_000, 100_000]);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  state = applyBoard(state, CHANCE_TYPES.DEAL_FLOP, FLOP);
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  state = applyBoard(state, CHANCE_TYPES.DEAL_TURN, TURN);
  state = act(act(state, ACTION_TYPES.CHECK), ACTION_TYPES.CHECK);
  return applyBoard(state, CHANCE_TYPES.DEAL_RIVER, RIVER);
}

test('HU equal contributions produce one versioned contestable pot layer', () => {
  const state = contributionState([10_000, 10_000]);
  assert.deepEqual(derivePotLayers(state), [
    layer(20_000, 0, 10_000, ['P0', 'P1']),
  ]);
  assert.equal(deriveUnmatchedContribution(state), null);
  assertPotInvariant(state);
});

test('HU unequal contributions separate contestable chips from unique excess', () => {
  const state = contributionState([10_000, 6000]);
  const accounting = derivePotAccounting(state);
  assert.deepEqual(accounting.potLayers, [
    layer(12_000, 0, 6000, ['P0', 'P1']),
  ]);
  assert.deepEqual(accounting.unmatchedContribution, unmatched('P0', 4000, 6000, 10_000));
  assertPotInvariant(state, accounting);
});

test('ordinary three-way equal contributions produce one main pot', () => {
  const state = contributionState([5000, 5000, 5000]);
  assert.deepEqual(derivePotLayers(state), [
    layer(15_000, 0, 5000, ['P0', 'P1', 'P2']),
  ]);
  assertPotInvariant(state);
});

test('a single side pot uses contribution thresholds exactly', () => {
  const state = contributionState([6000, 6000, 2000]);
  assert.deepEqual(derivePotLayers(state), [
    layer(6000, 0, 2000, ['P0', 'P1', 'P2']),
    layer(8000, 2000, 6000, ['P0', 'P1']),
  ]);
  assert.equal(deriveUnmatchedContribution(state), null);
  assertPotInvariant(state);
});

test('three-way nested thresholds exclude the one-contributor top layer', () => {
  const state = contributionState([10_000, 6000, 2000]);
  const accounting = derivePotAccounting(state);
  assert.deepEqual(accounting.potLayers, [
    layer(6000, 0, 2000, ['P0', 'P1', 'P2']),
    layer(8000, 2000, 6000, ['P0', 'P1']),
  ]);
  assert.deepEqual(accounting.unmatchedContribution, unmatched('P0', 4000, 6000, 10_000));
  assertPotInvariant(state, accounting);
});

test('four-player nested side pots match every funded level', () => {
  const state = contributionState([100_000, 80_000, 50_000, 20_000]);
  const accounting = derivePotAccounting(state);
  assert.deepEqual(accounting.potLayers, [
    layer(80_000, 0, 20_000, ['P0', 'P1', 'P2', 'P3']),
    layer(90_000, 20_000, 50_000, ['P0', 'P1', 'P2']),
    layer(60_000, 50_000, 80_000, ['P0', 'P1']),
  ]);
  assert.deepEqual(accounting.unmatchedContribution, unmatched('P0', 20_000, 80_000, 100_000));
  assertPotInvariant(state, accounting);
});

test('five distinct thresholds retain exact integer milliBb arithmetic', () => {
  const state = contributionState([10_000, 9000, 7000, 4000, 1000]);
  const accounting = derivePotAccounting(state);
  assert.deepEqual(accounting.potLayers, [
    layer(5000, 0, 1000, playerIds(5)),
    layer(12_000, 1000, 4000, ['P0', 'P1', 'P2', 'P3']),
    layer(9000, 4000, 7000, ['P0', 'P1', 'P2']),
    layer(4000, 7000, 9000, ['P0', 'P1']),
  ]);
  assert.deepEqual(accounting.unmatchedContribution, unmatched('P0', 1000, 9000, 10_000));
  assertPotInvariant(state, accounting);
});

test('seat order, not mutable player-array order, controls layer player IDs', () => {
  const state = contributionState([10_000, 6000, 2000]);
  state.players = [state.players[2], state.players[0], state.players[1]];
  validatePokerState(state);
  assert.deepEqual(derivePotLayers(state), [
    layer(6000, 0, 2000, ['P0', 'P1', 'P2']),
    layer(8000, 2000, 6000, ['P0', 'P1']),
  ]);
});

test('folded largest contributor funds layers but is never eligible', () => {
  const state = contributionState([10_000, 6000, 2000], { foldedPlayerIds: ['P0'] });
  const accounting = derivePotAccounting(state);
  assert.deepEqual(accounting.potLayers, [
    layer(6000, 0, 2000, ['P0', 'P1', 'P2'], ['P1', 'P2']),
    layer(8000, 2000, 6000, ['P0', 'P1'], ['P1']),
  ]);
  assert.deepEqual(accounting.unmatchedContribution, unmatched('P0', 4000, 6000, 10_000));
  assertPotInvariant(state, accounting);
});

test('folded middle contributor remains funding but not eligible for either layer', () => {
  const state = contributionState([10_000, 6000, 2000], { foldedPlayerIds: ['P1'] });
  assert.deepEqual(derivePotLayers(state), [
    layer(6000, 0, 2000, ['P0', 'P1', 'P2'], ['P0', 'P2']),
    layer(8000, 2000, 6000, ['P0', 'P1'], ['P0']),
  ]);
  assertPotInvariant(state);
});

test('several folded contributors remain in layer amounts and out of eligibility', () => {
  const state = contributionState([10_000, 8000, 5000, 2000], {
    foldedPlayerIds: ['P0', 'P2'],
  });
  assert.deepEqual(derivePotLayers(state).map((potLayer) => potLayer.eligiblePlayerIds), [
    ['P1', 'P3'], ['P1'], ['P1'],
  ]);
  assertPotInvariant(state);
});

test('live all-in players remain eligible only through their funded thresholds', () => {
  const state = contributionState([10_000, 6000, 2000], {
    startingStacks: [10_000, 6000, 2000],
  });
  assert.equal(state.players.every(isPlayerAllIn), true);
  assert.deepEqual(derivePotLayers(state).map((potLayer) => potLayer.eligiblePlayerIds), [
    ['P0', 'P1', 'P2'], ['P0', 'P1'],
  ]);
  assertPotInvariant(state);
});

test('equal top contributions produce no unmatched excess', () => {
  const state = contributionState([10_000, 10_000, 2000]);
  assert.equal(deriveUnmatchedContribution(state), null);
  assert.equal(derivePotAccounting(state).contestablePotMilliBb, state.potMilliBb);
});

test('recorded uncalled refunds are subtracted from gross contribution derivation', () => {
  const state = contributionState([10_000, 6000, 2000], {
    refundsByPlayerId: { P0: 4000 },
  });
  const accounting = derivePotAccounting(state);
  assert.deepEqual(accounting.potLayers, [
    layer(6000, 0, 2000, ['P0', 'P1', 'P2']),
    layer(8000, 2000, 6000, ['P0', 'P1']),
  ]);
  assert.equal(accounting.unmatchedContribution, null);
  assert.equal(accounting.contestablePotMilliBb, 14_000);
  assert.equal(state.players[0].totalPotContributionMilliBb, 10_000);
  assertPotInvariant(state, accounting);
});

test('ClubGG deductions remain outside pot layers for 7, 9, and 10 players', () => {
  for (const count of [7, 9, 10]) {
    const state = contributionState(Array.from({ length: count }, () => 1000), {
      mode: GAME_MODES.CLUBGG,
    });
    const accounting = derivePotAccounting(state);
    assert.equal(state.deductionTotalMilliBb, count * 100);
    assert.equal(state.potMilliBb, count * 1000);
    assert.deepEqual(accounting.potLayers, [
      layer(count * 1000, 0, 1000, playerIds(count)),
    ]);
    assert.equal(accounting.unmatchedContribution, null);
    assertPotInvariant(state, accounting);
  }
});

test('pot derivation is immutable and returns deeply frozen structures', () => {
  const state = contributionState([10_000, 6000, 2000]);
  const snapshot = structuredClone(state);
  const accounting = derivePotAccounting(state);
  assert.deepEqual(state, snapshot);
  assert.equal(Object.isFrozen(accounting), true);
  assert.equal(Object.isFrozen(accounting.potLayers), true);
  assert.equal(Object.isFrozen(accounting.potLayers[0]), true);
  assert.equal(Object.isFrozen(accounting.potLayers[0].contributorPlayerIds), true);
  assert.equal(Object.isFrozen(accounting.unmatchedContribution), true);
});

test('pot-accounting validation rejects malformed and noncanonical structures', () => {
  const state = contributionState([10_000, 6000, 2000], { foldedPlayerIds: ['P1'] });
  const canonical = derivePotAccounting(state);

  const zeroAmount = structuredClone(canonical);
  zeroAmount.potLayers[0].amountMilliBb = 0;
  assert.throws(() => validatePotAccounting(state, zeroAmount));

  const overlapping = structuredClone(canonical);
  overlapping.potLayers[1].contributionFloorMilliBb = 1000;
  assert.throws(() => validatePotAccounting(state, overlapping));

  const duplicateContributor = structuredClone(canonical);
  duplicateContributor.potLayers[0].contributorPlayerIds[1] = 'P0';
  assert.throws(() => validatePotAccounting(state, duplicateContributor));

  const foldedEligible = structuredClone(canonical);
  foldedEligible.potLayers[0].eligiblePlayerIds.push('P1');
  assert.throws(() => validatePotAccounting(state, foldedEligible));

  const wrongTotal = structuredClone(canonical);
  wrongTotal.contestablePotMilliBb -= 100;
  assert.throws(() => validatePotAccounting(state, wrongTotal));
});

test('HU unequal all-in runout derives only the net contestable pot after refund', () => {
  let state = dealtTable(2, [3000, 10_000]);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.ALL_IN);
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(state.potMilliBb, 6000);
  assert.equal(state.ledger.at(-1).kind, LEDGER_KINDS.UNCALLED_REFUND);
  state = runOut(state);

  assert.equal(state.phase, PHASES.SHOWDOWN);
  assert.deepEqual(state.showdown.pots, []);
  assert.deepEqual(derivePotLayers(state), [
    layer(6000, 0, 3000, ['P0', 'P1']),
  ]);
  assert.equal(deriveUnmatchedContribution(state), null);
  assertPotInvariant(state);
});

test('multiway unequal all-in runout exposes deterministic nested layers', () => {
  let state = dealtTable(4, [4000, 2000, 3000, 100_000]);
  state = act(state, ACTION_TYPES.RAISE, 3000);
  state = act(state, ACTION_TYPES.ALL_IN);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CALL);
  state = runOut(state);

  assert.equal(state.phase, PHASES.SHOWDOWN);
  assert.deepEqual(derivePotLayers(state), [
    layer(8000, 0, 2000, ['P0', 'P1', 'P2', 'P3']),
    layer(3000, 2000, 3000, ['P0', 'P2', 'P3']),
    layer(2000, 3000, 4000, ['P0', 'P3']),
  ]);
  assert.equal(deriveUnmatchedContribution(state), null);
  assertPotInvariant(state);
});

test('active river betting completion exposes its showdown pot through the pure selector', () => {
  let state = checkedToRiver();
  state = act(state, ACTION_TYPES.BET, 1000);
  state = act(state, ACTION_TYPES.CALL);

  assert.equal(state.phase, PHASES.SHOWDOWN);
  assert.equal(state.showdown.status, 'ready');
  assert.deepEqual(state.showdown.pots, []);
  assert.deepEqual(derivePotLayers(state), [
    layer(4000, 0, 2000, ['P0', 'P1']),
  ]);
  assertPotInvariant(state);
});

test('fold-terminal settlement remains byte-for-behavior compatible', () => {
  let state = dealtTable(2, [100_000, 100_000]);
  state = act(state, ACTION_TYPES.FOLD);
  assert.equal(state.phase, PHASES.TERMINAL);
  assert.deepEqual(state.terminal.winnerPlayerIds, ['P1']);
  assert.deepEqual(state.terminal.refundsMilliBbByPlayer, { P1: 500 });
  assert.deepEqual(state.terminal.payoutsMilliBbByPlayer, { P1: 1000 });
  assert.equal(playerById(state, 'P1').currentStackMilliBb, 100_500);
  assert.equal(state.potMilliBb, 0);
  assert.equal(isChipConserved(state), true);
});
