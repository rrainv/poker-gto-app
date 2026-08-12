import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  createAction,
} from '../shared/poker-domain/index.js';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);

function configuration({ playerCount = 2, mode = GAME_MODES.HOME } = {}) {
  return {
    handId: 'integration-003',
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: 100_000,
    })),
  };
}

function dealtSession(options = {}) {
  const session = createCanonicalHandSession(configuration(options));
  const state = session.getState();
  session.applyChance({
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      state.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
    ),
  });
  return session;
}

test('CanonicalHandSession owns immutable Home and ClubGG hand states', () => {
  const home = createCanonicalHandSession(configuration());
  assert.equal(home.getState().potMilliBb, 1500);
  assert.equal(home.getState().deductionTotalMilliBb, 0);
  assert.equal(Object.isFrozen(home.getState()), true);

  for (const playerCount of [7, 9, 10]) {
    const club = createCanonicalHandSession(configuration({ playerCount, mode: GAME_MODES.CLUBGG }));
    assert.equal(club.getState().deductionTotalMilliBb, playerCount * 100);
    assert.equal(club.getState().potMilliBb, 1500);
  }
});

test('canonical sessions transition through chance and legal actions only', () => {
  const session = dealtSession();
  assert.equal(session.getState().phase, PHASES.BETTING);
  assert.throws(() => session.applyAction(createAction('P1', ACTION_TYPES.FOLD)), /current actor/);
  session.applyAction(createAction('P0', ACTION_TYPES.CALL));
  const waiting = session.applyAction(createAction('P1', ACTION_TYPES.CHECK));
  assert.equal(waiting.pendingChance.type, CHANCE_TYPES.DEAL_FLOP);
  const flop = session.applyChance({ type: CHANCE_TYPES.DEAL_FLOP, cards: ['2c', '3d', '4s'] });
  assert.deepEqual(flop.board, ['2c', '3d', '4s']);
});

test('canonical projection reports only Home and ClubGG accounting fields', () => {
  const session = dealtSession({ playerCount: 7, mode: GAME_MODES.CLUBGG });
  const state = session.getState();
  const context = deriveDecisionContextFromPokerState(state, state.actingPlayerId);
  assert.deepEqual({
    rakeMode: context.rakeMode,
    perPlayer: context.forcedContributionPerPlayerBb,
    total: context.totalForcedContributionBb,
  }, { rakeMode: 'fixed', perPlayer: 0.1, total: 0.7 });
  assert.equal(Object.hasOwn(context, 'legacyRakePercent'), false);
});
