import test from 'node:test';
import assert from 'node:assert/strict';

import { ACTION_TYPES, GAME_MODES, PHASES } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);

function configuration(overrides = {}) {
  return {
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroPosition: 'BTN',
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
    ...overrides,
  };
}

function controllerWithDeal(overrides = {}) {
  const controller = createCanonicalLiveController({ enabled: true });
  const initialized = controller.initialize(configuration(overrides));
  assert.ok(initialized, controller.getDiagnostics().error?.message);
  const cardsByPlayer = Object.fromEntries(
    initialized.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
  );
  assert.ok(controller.dealHoleCards(cardsByPlayer));
  return controller;
}

test('the canonical controller owns the production Hand session', () => {
  const controller = controllerWithDeal({ tableSize: 6, heroPosition: 'CO' });
  const state = controller.getState();
  assert.equal(state.phase, PHASES.BETTING);
  assert.equal(state.players.length, 6);
  assert.equal(state.players.find((player) => player.playerId === controller.getHeroPlayerId()).position, 'CO');
  assert.equal(state.deductionTotalMilliBb, 0);
  assert.equal(typeof controller.compare, 'undefined');
});

test('ClubGG deductions are exact and remain outside the contestable pot', () => {
  for (const tableSize of [7, 9, 10]) {
    const controller = controllerWithDeal({
      tableSize,
      gameMode: GAME_MODES.CLUBGG,
      heroPosition: 'BTN',
    });
    const state = controller.getState();
    assert.equal(state.deductionTotalMilliBb, tableSize * 100);
    assert.equal(state.potMilliBb, 1500);
  }
});

test('the controller advances only through canonical chance and action transitions', () => {
  const controller = controllerWithDeal();
  assert.equal(controller.applyAction({ type: ACTION_TYPES.CHECK }), null);
  assert.equal(controller.getDiagnostics().status, 'error');
  assert.ok(controller.applyAction({ type: ACTION_TYPES.CALL }));
  const waitingForFlop = controller.applyAction({ type: ACTION_TYPES.CHECK });
  assert.equal(waitingForFlop.pendingChance.type, 'deal_flop');
  const flop = controller.dealBoardCards(['2c', '3d', '4s']);
  assert.equal(flop.phase, PHASES.BETTING);
  assert.deepEqual(flop.board, ['2c', '3d', '4s']);
});
