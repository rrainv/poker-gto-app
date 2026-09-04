import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { ACTION_TYPES, GAME_MODES, isCard } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import {
  HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,
  randomizeHandPendingDraft,
} from '../app/src/application/hand-pending-randomization.mjs';
import {
  EQUITY_RANDOMIZATION_REQUEST_VERSION,
  randomizeEquityInput,
} from '../app/src/application/equity-input-randomization.mjs';

function handController() {
  const controller = createCanonicalLiveController({ enabled: true });
  assert.ok(controller.initialize({
    tableSize: 2,
    gameMode: GAME_MODES.HOME,
    stackBb: 100,
    stackMode: 'hero',
    heroPosition: 'BTN',
    anteType: 'none',
    anteBb: 0,
    straddleBb: 0,
  }));
  return controller;
}

function handRequest(controller, seed, pendingCards = []) {
  return {
    schemaVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,
    state: controller.getState(),
    availableCards: controller.getAvailableChanceCards(pendingCards),
    seed,
  };
}

function assertLegalUnique(cards, exclusions = []) {
  assert.ok(cards.every(isCard));
  assert.equal(new Set([...cards, ...exclusions]).size, cards.length + exclusions.length);
}

test('Hand randomization fills only the canonical pending draft stage and is deterministic', () => {
  const controller = handController();
  const initial = controller.getState();
  const privateRequest = handRequest(controller, 17, ['2c', '3d']);
  const first = randomizeHandPendingDraft(privateRequest);
  const replay = randomizeHandPendingDraft(privateRequest);
  assert.equal(first.status, 'available');
  assert.equal(first.target, 'hero');
  assert.equal(first.cards.length, 2);
  assertLegalUnique(first.cards, ['2c', '3d']);
  assert.deepEqual(replay, first);
  assert.equal(controller.getState(), initial, 'draft sampling must not commit canonical history');
  assert.equal(first.recipe.pendingChanceType, 'deal_hole');
  assert.deepEqual(first.recipe.generatedCards, first.cards);

  controller.dealObservedHoleCards({ [controller.getHeroPlayerId()]: first.cards });
  controller.applyAction({ type: ACTION_TYPES.CALL });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  const flopState = controller.getState();
  assert.equal(flopState.pendingChance.type, 'deal_flop');
  const flop = randomizeHandPendingDraft(handRequest(controller, 18));
  assert.equal(flop.target, 'flop');
  assert.equal(flop.cards.length, 3);
  assert.equal(controller.getState(), flopState);

  controller.dealBoardCards(flop.cards);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  const turn = randomizeHandPendingDraft(handRequest(controller, 19));
  assert.equal(turn.target, 'turn');
  assert.equal(turn.cards.length, 1);

  controller.dealBoardCards(turn.cards);
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  controller.applyAction({ type: ACTION_TYPES.CHECK });
  const river = randomizeHandPendingDraft(handRequest(controller, 20));
  assert.equal(river.target, 'river');
  assert.equal(river.cards.length, 1);
});

function equityInput(overrides = {}) {
  return {
    players: [
      { id: 'p0', name: 'Hero', handMode: 'known', cards: ['As', 'Kd'] },
      { id: 'p1', name: 'Villain', handMode: 'unknown', cards: [] },
      { id: 'p2', name: 'Caller', handMode: 'known', cards: ['Qh', 'Qc'] },
    ],
    board: ['2c', '7d', 'Th'],
    deadCards: ['Js'],
    ...overrides,
  };
}

function equityRequest(target, overrides = {}) {
  return {
    schemaVersion: EQUITY_RANDOMIZATION_REQUEST_VERSION,
    input: equityInput(),
    target,
    seed: 31,
    ...overrides,
  };
}

test('Equity New matchup preserves roster, modes, board, and dead cards while replacing Known hands', () => {
  const request = equityRequest('matchup');
  const source = structuredClone(request.input);
  const result = randomizeEquityInput(request);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.input.players.map(({ id, name, handMode }) => ({ id, name, handMode })),
    source.players.map(({ id, name, handMode }) => ({ id, name, handMode })));
  assert.deepEqual(result.input.players[1].cards, []);
  assert.notDeepEqual(result.input.players[0].cards, source.players[0].cards);
  assert.notDeepEqual(result.input.players[2].cards, source.players[2].cards);
  assert.deepEqual(result.input.board, source.board);
  assert.deepEqual(result.input.deadCards, source.deadCards);
  assert.deepEqual(request.input, source, 'generation must not mutate the live Equity input');
  assert.deepEqual(randomizeEquityInput(request), result, 'the recipe inputs must replay deterministically');
  assert.equal(result.recipe.operation, 'matchup');
});

test('Equity Change only player and Board mutate exactly their target', () => {
  const source = equityInput();
  const player = randomizeEquityInput(equityRequest('player', { input: source, playerId: 'p2' }));
  assert.equal(player.status, 'available');
  assert.deepEqual(player.input.players[0], source.players[0]);
  assert.notDeepEqual(player.input.players[2].cards, source.players[2].cards);
  assert.deepEqual(player.input.board, source.board);
  assert.deepEqual(player.input.deadCards, source.deadCards);

  const board = randomizeEquityInput(equityRequest('board', { input: source }));
  assert.equal(board.status, 'available');
  assert.equal(board.input.board.length, source.board.length);
  assert.notDeepEqual(board.input.board, source.board);
  assert.deepEqual(board.input.players, source.players);
  assert.deepEqual(board.input.deadCards, source.deadCards);
});

test('Equity board-depth actions replace the whole board at exactly flop, turn, or river depth', () => {
  const source = equityInput({ board: [] });
  for (const [target, count] of [['flop', 3], ['turn', 4], ['river', 5]]) {
    const result = randomizeEquityInput(equityRequest(target, { input: source, seed: count }));
    assert.equal(result.status, 'available', target);
    assert.equal(result.input.board.length, count);
    assert.deepEqual(result.input.players, source.players);
    assert.deepEqual(result.input.deadCards, source.deadCards);
    assertLegalUnique([
      ...result.input.players.filter((player) => player.handMode === 'known').flatMap((player) => player.cards),
      ...result.input.board,
      ...result.input.deadCards,
    ]);
  }
});

test('Equity Board change is unavailable when empty and every failure is atomic', () => {
  const source = equityInput({ board: [] });
  const result = randomizeEquityInput(equityRequest('board', { input: source }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.code, 'board_empty');
  assert.equal(result.input, null);
  assert.deepEqual(source, equityInput({ board: [] }));

  const unknownOnly = equityInput({
    players: [
      { id: 'p0', name: 'One', handMode: 'unknown', cards: [] },
      { id: 'p1', name: 'Two', handMode: 'unknown', cards: [] },
    ],
  });
  const matchup = randomizeEquityInput(equityRequest('matchup', { input: unknownOnly }));
  assert.equal(matchup.status, 'unavailable');
  assert.equal(matchup.code, 'no_known_hands');
  assert.equal(matchup.input, null);
});

test('Equity board generation preserves incomplete Known drafts and excludes their cards', () => {
  const source = equityInput({
    players: [
      { id: 'p0', name: 'Hero', handMode: 'known', cards: ['As'] },
      { id: 'p1', name: 'Villain', handMode: 'unknown', cards: [] },
    ],
    board: [],
  });
  const result = randomizeEquityInput(equityRequest('flop', { input: source }));
  assert.equal(result.status, 'available');
  assert.deepEqual(result.input.players, source.players);
  assert.ok(!result.input.board.includes('As'));
});

test('cross-surface randomization copy resolves in EN, RU, and HE runtime catalogs', () => {
  const source = fs.readFileSync(
    new URL('../app/src/locales/analysis-translations.js', import.meta.url),
    'utf8',
  );
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const keys = [
    'Random Hero cards', 'Random {street} ready.', 'No card stage is waiting.',
    'New matchup', 'Matchup randomization settings', 'Board depth',
    'New cards for {count} Known hands.', 'There is no board to change.',
  ];
  for (const locale of ['en', 'ru', 'he']) {
    for (const key of keys) {
      assert.equal(typeof context.window.riverlineAnalysisTranslations[locale][key], 'string', `${locale}: ${key}`);
      assert.ok(context.window.riverlineAnalysisTranslations[locale][key].length > 0, `${locale}: ${key}`);
    }
  }
});
