import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  applyChance,
  amountToCallMilliBb,
  createAction,
  initializeHand,
} from '../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';

const require = createRequire(import.meta.url);
const legacy = require('./qa002_adapters.js');

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const FLOP = Object.freeze(['2c', '3d', '4s']);
const TURN = Object.freeze(['9c']);
const RIVER = Object.freeze(['Tc']);

function createDealtState({
  playerCount = 2,
  mode = GAME_MODES.HOME,
  stacksMilliBb = Array(playerCount).fill(100_000),
  buttonSeat = 0,
} = {}) {
  const initialized = initializeHand({
    handId: 'integration-001',
    game: {
      mode,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat,
    players: stacksMilliBb.map((startingStackMilliBb, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb,
    })),
  });
  return applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      initialized.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
    ),
  });
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(
    state,
    createAction(state.actingPlayerId, type, amountToMilliBb),
  );
}

function context(state, options = {}) {
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId, options);
}

function legacyEquivalent(projected) {
  return legacy.deriveDecisionContext({
    tableSize: projected.tableSize,
    heroPosition: projected.heroPosition,
    heroCards: projected.heroCards,
    board: projected.board,
    deadCards: projected.deadCards,
    stackBb: projected.stackBb,
    stackMode: projected.stackMode,
    potBb: projected.potBb,
    lastAction: projected.lastAction,
    facingSizeBb: projected.facingSizeBb,
    rakeMode: projected.rakeMode,
    legacyRakeValue: 0,
  });
}

function assertLegacyParity(projected) {
  assert.deepEqual(projected, legacyEquivalent(projected));
}

function foldUntilPosition(state, position) {
  let next = state;
  while (next.players.find((player) => player.playerId === next.actingPlayerId).position !== position) {
    next = act(next, ACTION_TYPES.FOLD);
  }
  return next;
}

function reachFlop() {
  let state = createDealtState();
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  assert.equal(state.phase, PHASES.CHANCE);
  return applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
}

function reachTurn() {
  let state = reachFlop();
  state = act(state, ACTION_TYPES.CHECK);
  state = act(state, ACTION_TYPES.CHECK);
  return applyChance(state, { type: CHANCE_TYPES.DEAL_TURN, cards: TURN });
}

function reachRiver() {
  let state = reachTurn();
  state = act(state, ACTION_TYPES.CHECK);
  state = act(state, ACTION_TYPES.CHECK);
  return applyChance(state, { type: CHANCE_TYPES.DEAL_RIVER, cards: RIVER });
}

test('HU unopened PokerState projects the exact DecisionContext v1 shape', () => {
  const state = createDealtState();
  const projected = context(state);
  assert.deepEqual(projected, {
    schemaVersion: 'decision-context/v1',
    tableSize: 2,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Ad'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    legacyRakePercent: 0,
  });
  assertLegacyParity(projected);
});

test('six-max BTN remains unopened after earlier positions fold', () => {
  const state = foldUntilPosition(createDealtState({ playerCount: 6 }), 'BTN');
  const projected = context(state);
  assert.equal(projected.heroPosition, 'BTN');
  assert.equal(projected.lastAction, 'unopened');
  assert.equal(projected.facingSizeBb, 0);
  assertLegacyParity(projected);
});

test('10-max UTG unopened projection preserves the full-ring position', () => {
  const projected = context(createDealtState({ playerCount: 10 }));
  assert.equal(projected.tableSize, 10);
  assert.equal(projected.heroPosition, 'UTG');
  assert.equal(projected.lastAction, 'unopened');
  assertLegacyParity(projected);
});

test('preflop raise, 3-bet, and 4-bet use legacy nominal facing sizes', () => {
  let state = createDealtState();
  state = act(state, ACTION_TYPES.RAISE, 2500);
  const raised = context(state);
  assert.equal(raised.lastAction, 'raise');
  assert.equal(raised.facingSizeBb, 2.5);
  assertLegacyParity(raised);

  state = act(state, ACTION_TYPES.RAISE, 7500);
  const threeBet = context(state);
  assert.equal(threeBet.lastAction, '3bet');
  assert.equal(threeBet.facingSizeBb, 7.5);
  assertLegacyParity(threeBet);

  state = act(state, ACTION_TYPES.RAISE, 18_000);
  const fourBet = context(state);
  assert.equal(fourBet.lastAction, '4bet');
  assert.equal(fourBet.facingSizeBb, 18);
  assertLegacyParity(fourBet);
});

test('limps map lossily to check and preserve the BB free option', () => {
  let state = createDealtState({ playerCount: 3 });
  state = act(state, ACTION_TYPES.CALL);
  assert.equal(context(state).lastAction, 'check');
  assert.equal(context(state).facingSizeBb, 0);
  state = act(state, ACTION_TYPES.CALL);
  const projected = context(state);
  assert.equal(projected.heroPosition, 'BB');
  assert.equal(projected.lastAction, 'check');
  assert.equal(projected.facingSizeBb, 0);
  assertLegacyParity(projected);
});

test('short-stack projection keeps starting depth and nominal wager size', () => {
  let state = createDealtState({ stacksMilliBb: [100_000, 20_000] });
  state = act(state, ACTION_TYPES.RAISE, 25_000);
  const projected = context(state);
  assert.equal(projected.stackBb, 20);
  assert.equal(projected.facingSizeBb, 25);
  assert.equal(amountToCallMilliBb(state, state.actingPlayerId), 24_000);
  assert.equal(state.players.find((player) => player.playerId === state.actingPlayerId).currentStackMilliBb, 19_000);
  assert.equal(projected.lastAction, 'raise');
  assertLegacyParity(projected);
});

test('flop first action and a prior check project as check with zero facing size', () => {
  let state = reachFlop();
  const firstAction = context(state);
  assert.equal(firstAction.street, 'flop');
  assert.equal(firstAction.lastAction, 'check');
  assert.equal(firstAction.facingSizeBb, 0);
  assertLegacyParity(firstAction);

  state = act(state, ACTION_TYPES.CHECK);
  const checkedTo = context(state);
  assert.equal(checkedTo.lastAction, 'check');
  assert.equal(checkedTo.facingSizeBb, 0);
  assertLegacyParity(checkedTo);
});

test('postflop bet and raise classifications preserve nominal bet-to sizes', () => {
  let state = reachFlop();
  state = act(state, ACTION_TYPES.BET, 2000);
  const facingBet = context(state);
  assert.equal(facingBet.lastAction, 'bet');
  assert.equal(facingBet.facingSizeBb, 2);
  assertLegacyParity(facingBet);

  state = act(state, ACTION_TYPES.RAISE, 6000);
  const facingRaise = context(state);
  assert.equal(facingRaise.lastAction, 'raise');
  assert.equal(facingRaise.facingSizeBb, 6);
  assertLegacyParity(facingRaise);
});

test('turn and river street projections follow canonical board transitions', () => {
  const turn = context(reachTurn());
  assert.equal(turn.street, 'turn');
  assert.equal(turn.board.length, 4);
  assert.equal(turn.lastAction, 'check');
  assertLegacyParity(turn);

  const river = context(reachRiver());
  assert.equal(river.street, 'river');
  assert.equal(river.board.length, 5);
  assert.equal(river.lastAction, 'check');
  assertLegacyParity(river);
});

test('Home and ClubGG accounting map without percentage-rake semantics', () => {
  const home = context(createDealtState({ playerCount: 6 }));
  assert.deepEqual({
    rakeMode: home.rakeMode,
    perPlayer: home.forcedContributionPerPlayerBb,
    total: home.totalForcedContributionBb,
    legacy: home.legacyRakePercent,
  }, { rakeMode: 'off', perPlayer: 0, total: 0, legacy: 0 });

  for (const playerCount of [7, 9, 10]) {
    const club = context(createDealtState({ playerCount, mode: GAME_MODES.CLUBGG }));
    assert.equal(club.rakeMode, 'fixed');
    assert.equal(club.forcedContributionPerPlayerBb, 0.1);
    assert.equal(club.totalForcedContributionBb, playerCount / 10);
    assert.equal(club.legacyRakePercent, 0);
    assert.equal(club.potBb, 1.5);
    assertLegacyParity(club);
  }
});

test('all stack modes preserve the same configured starting-stack projection', () => {
  let state = createDealtState();
  const firstActor = state.players.find((player) => player.playerId === state.actingPlayerId);
  assert.ok(firstActor.currentStackMilliBb < firstActor.startingStackMilliBb);
  const contexts = [];
  for (const stackMode of ['hero', 'effective', 'custom']) {
    const projected = context(state, { stackMode });
    assert.equal(projected.stackBb, 100);
    assert.equal(projected.stackMode, stackMode);
    assertLegacyParity(projected);
    contexts.push(projected);
  }

  state = act(state, ACTION_TYPES.RAISE, 2500);
  state = act(state, ACTION_TYPES.RAISE, 7500);
  const actorAfterThreeBet = state.players.find((player) => (
    player.playerId === state.actingPlayerId
  ));
  assert.ok(actorAfterThreeBet.currentStackMilliBb < actorAfterThreeBet.startingStackMilliBb);
  for (const stackMode of ['hero', 'effective', 'custom']) {
    assert.equal(context(state, { stackMode }).stackBb, 100);
  }
  assert.equal(new Set(contexts.map((projected) => projected.stackBb)).size, 1);

  const multiway = createDealtState({ playerCount: 3 });
  assert.equal(context(multiway, { stackMode: 'effective' }).stackBb, 100);
});

test('action compatibility emits only the vocabulary supported downstream', () => {
  const unopened = context(createDealtState());

  let callState = createDealtState({ playerCount: 3 });
  callState = act(callState, ACTION_TYPES.CALL);
  callState = act(callState, ACTION_TYPES.CALL);

  let checkState = reachFlop();
  checkState = act(checkState, ACTION_TYPES.CHECK);

  let betState = reachFlop();
  betState = act(betState, ACTION_TYPES.BET, 1000);

  let raiseState = reachFlop();
  raiseState = act(raiseState, ACTION_TYPES.BET, 1000);
  raiseState = act(raiseState, ACTION_TYPES.RAISE, 3000);

  let allInState = createDealtState();
  allInState = act(allInState, ACTION_TYPES.ALL_IN);

  let allInThreeBetState = createDealtState();
  allInThreeBetState = act(allInThreeBetState, ACTION_TYPES.RAISE, 2500);
  allInThreeBetState = act(allInThreeBetState, ACTION_TYPES.ALL_IN);

  let postflopAllInState = reachFlop();
  postflopAllInState = act(postflopAllInState, ACTION_TYPES.ALL_IN);

  assert.deepEqual([
    unopened.lastAction,
    context(checkState).lastAction,
    context(callState).lastAction,
    context(betState).lastAction,
    context(raiseState).lastAction,
    context(allInState).lastAction,
    context(allInThreeBetState).lastAction,
    context(postflopAllInState).lastAction,
  ], ['unopened', 'check', 'check', 'bet', 'raise', 'raise', '3bet', 'bet']);
});

test('DecisionContext v1 applies the same stack, pot, and facing bounds as legacy derivation', () => {
  const shallowState = createDealtState({ stacksMilliBb: [5000, 5000] });
  const shallow = context(shallowState);
  assert.equal(shallowState.players[0].startingStackMilliBb, 5000);
  assert.equal(shallow.stackBb, 10);
  assert.equal(shallow.facingSizeBb, 0);
  assertLegacyParity(shallow);

  let deepState = createDealtState({ stacksMilliBb: [600_000, 600_000] });
  deepState = act(deepState, ACTION_TYPES.RAISE, 250_000);
  const deep = context(deepState);
  assert.equal(deepState.players.find((player) => player.playerId === deepState.actingPlayerId).startingStackMilliBb, 600_000);
  assert.equal(deepState.currentBetMilliBb, 250_000);
  assert.equal(deepState.potMilliBb, 251_000);
  assert.equal(deep.stackBb, 500);
  assert.equal(deep.facingSizeBb, 100);
  assert.equal(deep.potBb, 200);
  assertLegacyParity(deep);
});

test('every emitted lastAction is accepted by current fallback and ONNX vocabularies', () => {
  const supported = ['unopened', 'raise', '3bet', '4bet', 'bet', 'check'];
  const productionLogic = fs.readFileSync(
    new URL('../app/src/core/logic.js', import.meta.url),
    'utf8',
  );
  assert.match(
    productionLogic,
    /const ACTIONS = \['unopened', 'raise', '3bet', '4bet', 'bet', 'check'\];/,
  );

  for (const lastAction of supported) {
    const projected = legacy.deriveDecisionContext({
      tableSize: 6,
      heroPosition: 'BTN',
      heroCards: ['As', 'Ad'],
      board: [],
      deadCards: [],
      stackBb: 100,
      stackMode: 'hero',
      potBb: 10,
      lastAction,
      facingSizeBb: lastAction === 'unopened' || lastAction === 'check' ? 0 : 5,
      rakeMode: 'off',
      legacyRakeValue: 0,
    });
    assert.equal(projected.lastAction, lastAction);
    assert.doesNotThrow(() => legacy.fallbackForDecisionContext(projected));
  }
});

test('adapter rejects unsupported or non-decision projections clearly', () => {
  const betting = createDealtState();
  assert.throws(
    () => deriveDecisionContextFromPokerState(betting, 'missing'),
    /Unknown heroPlayerId/,
  );
  const nonActor = betting.players.find((player) => player.playerId !== betting.actingPlayerId);
  assert.throws(
    () => deriveDecisionContextFromPokerState(betting, nonActor.playerId),
    /current acting player/,
  );
  assert.throws(() => context(betting, { stackMode: 'mystery' }), /Unsupported stackMode/);

  let afterFold = createDealtState({ playerCount: 3 });
  const foldedHeroPlayerId = afterFold.actingPlayerId;
  afterFold = act(afterFold, ACTION_TYPES.FOLD);
  assert.throws(
    () => deriveDecisionContextFromPokerState(afterFold, foldedHeroPlayerId),
    /live and not folded/,
  );

  const chance = initializeHand({
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [0, 1].map((seat) => ({ playerId: `P${seat}`, seat, startingStackMilliBb: 100_000 })),
  });
  assert.throws(
    () => deriveDecisionContextFromPokerState(chance, 'P0'),
    /active betting decision/,
  );

  const terminal = act(createDealtState(), ACTION_TYPES.FOLD);
  assert.throws(
    () => deriveDecisionContextFromPokerState(terminal, terminal.terminal.winnerPlayerIds[0]),
    /active betting decision/,
  );

  let showdown = reachRiver();
  showdown = act(showdown, ACTION_TYPES.CHECK);
  showdown = act(showdown, ACTION_TYPES.CHECK);
  assert.equal(showdown.phase, PHASES.SHOWDOWN);
  assert.throws(
    () => deriveDecisionContextFromPokerState(showdown, showdown.showdown.eligiblePlayerIds[0]),
    /active betting decision/,
  );
});

test('adapter is pure, copies card arrays, and has no browser/global dependency', () => {
  const state = createDealtState();
  const before = structuredClone(state);
  const projected = context(state);
  assert.deepEqual(state, before);
  assert.notEqual(projected.heroCards, state.players[0].holeCards);
  assert.notEqual(projected.board, state.board);
  assert.notEqual(projected.deadCards, state.deadCards);

  const adapterSource = fs.readFileSync(
    new URL('../app/src/application/decision-context-from-poker-state.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(adapterSource, /\b(?:document|window|globalThis)\b|app\.gto|querySelector/);

  const productionLogic = fs.readFileSync(
    new URL('../app/src/core/logic.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(productionLogic, /decision-context-from-poker-state/);
  assert.match(productionLogic, /deriveDecisionContext\(readPlaybookInputSnapshot\(\)\)/);

  const domainFiles = fs.readdirSync(new URL('../shared/poker-domain/', import.meta.url));
  for (const file of domainFiles.filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(new URL(`../shared/poker-domain/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*app\//, file);
  }
});
