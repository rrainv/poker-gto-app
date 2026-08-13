import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  applyChance,
  applyPrivateReveal,
  createAction,
  derivePotLayers,
  getLegalActionSpec,
  initializeHand,
  isHiddenHoleCards,
  resolveShowdown,
  validatePokerState,
} from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { resolvePlaybookDecisionContext } from '../app/src/application/playbook-state-source.mjs';

const BOARD_BY_CHANCE = Object.freeze({
  [CHANCE_TYPES.DEAL_FLOP]: Object.freeze(['2c', '3d', '4s']),
  [CHANCE_TYPES.DEAL_TURN]: Object.freeze(['5c']),
  [CHANCE_TYPES.DEAL_RIVER]: Object.freeze(['9h']),
});
const HOLES = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'], ['4h', '4d'],
]);

function configuration(playerCount, {
  gameMode = GAME_MODES.HOME,
  stacks = Array.from({ length: playerCount }, () => 100_000),
} = {}) {
  return {
    handId: `engine-009-${playerCount}`,
    game: {
      mode: gameMode,
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
  };
}

function partialDeal(playerCount, options = {}) {
  const initialized = initializeHand(configuration(playerCount, options));
  return applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HOLES[0] },
    hiddenPlayerIds: initialized.players.slice(1).map((player) => player.playerId),
  });
}

function fullDeal(playerCount) {
  const initialized = initializeHand(configuration(playerCount));
  return applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      initialized.players.map((player, index) => [player.playerId, HOLES[index]]),
    ),
  });
}

function passiveAction(state) {
  const spec = getLegalActionSpec(state);
  const type = spec.check.available ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL;
  return applyAction(state, createAction(state.actingPlayerId, type));
}

function reachShowdown(state) {
  let next = state;
  let guard = 0;
  while (next.phase !== PHASES.SHOWDOWN && next.phase !== PHASES.TERMINAL) {
    if (guard++ > 80) throw new Error('Failed to reach showdown');
    if (next.phase === PHASES.BETTING) next = passiveAction(next);
    else if (next.phase === PHASES.CHANCE) {
      next = applyChance(next, {
        type: next.pendingChance.type,
        cards: BOARD_BY_CHANCE[next.pendingChance.type],
      });
    }
  }
  return next;
}

function browserBridge() {
  const events = [];
  const browserWindow = {
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = init.detail; }
    },
    dispatchEvent(event) { events.push(event); },
  };
  return { bridge: installPlaybookStateSourceBridge(browserWindow), events };
}

test('HU partial deal keeps Hero known and marks the opponent structurally hidden', () => {
  const initialized = initializeHand(configuration(2));
  const before = structuredClone(initialized);
  const state = applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HOLES[0] },
    hiddenPlayerIds: ['P1'],
  });
  assert.deepEqual(initialized, before);
  assert.deepEqual(state.players[0].holeCards, ['As', 'Ad']);
  assert.equal(isHiddenHoleCards(state.players[1].holeCards), true);
  assert.equal(state.phase, PHASES.BETTING);
  assert.equal(state.pendingChance, null);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.players[1].holeCards), true);
  assert.equal(validatePokerState(state), state);
});

test('6-max and 10-max partial deals mark every opponent hidden without inventing cards', () => {
  for (const count of [6, 10]) {
    const state = partialDeal(count);
    assert.equal(state.players.filter((player) => isHiddenHoleCards(player.holeCards)).length, count - 1);
    assert.equal(state.players.flatMap((player) => (
      Array.isArray(player.holeCards) ? player.holeCards : []
    )).length, 2);
    assert.equal(JSON.stringify(state).includes('??'), false);
  }
});

test('full-information deal remains byte-for-shape compatible for known holeCards', () => {
  const state = fullDeal(6);
  assert.deepEqual(state.players.map((player) => player.holeCards), HOLES.slice(0, 6));
  assert.equal(state.players.some((player) => isHiddenHoleCards(player.holeCards)), false);
});

test('partial deal rejects malformed, duplicate, missing, and overlapping representations', () => {
  const initialized = initializeHand(configuration(2));
  assert.throws(() => applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['As', 'As'] },
    hiddenPlayerIds: ['P1'],
  }), /Duplicate known card/);
  assert.throws(() => applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: ['as', 'Ad'] },
    hiddenPlayerIds: ['P1'],
  }), /strict two-character/);
  assert.throws(() => applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HOLES[0] },
    hiddenPlayerIds: [],
  }), /represent every dealt-in player/);
  assert.throws(() => applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { P0: HOLES[0] },
    hiddenPlayerIds: ['P0', 'P1'],
  }), /both known and hidden/);
});

test('hidden private cards do not alter actor order or legal action specs', () => {
  const partial = partialDeal(6);
  const full = fullDeal(6);
  assert.equal(partial.actingPlayerId, full.actingPlayerId);
  assert.deepEqual(getLegalActionSpec(partial), getLegalActionSpec(full));
  const nextPartial = passiveAction(partial);
  const nextFull = passiveAction(full);
  assert.equal(nextPartial.actingPlayerId, nextFull.actingPlayerId);
  assert.equal(Object.isFrozen(nextPartial), true);
  assert.deepEqual(partial.players.map((player) => player.actedThisStreet), Array(6).fill(false));
  assert.deepEqual(
    nextPartial.players.map((player) => [player.folded, player.currentStackMilliBb]),
    nextFull.players.map((player) => [player.folded, player.currentStackMilliBb]),
  );
});

test('flop, turn, and river remain explicit deterministic chance events with hidden opponents', () => {
  const showdown = reachShowdown(partialDeal(2));
  assert.deepEqual(showdown.board, ['2c', '3d', '4s', '5c', '9h']);
  assert.equal(showdown.phase, PHASES.SHOWDOWN);
  assert.equal(showdown.showdown.status, 'awaiting_private_reveal');
});

test('known duplicates are rejected while a hidden identity does not reject a legal board card', () => {
  let state = partialDeal(2);
  state = passiveAction(state);
  state = passiveAction(state);
  assert.equal(state.pendingChance.type, CHANCE_TYPES.DEAL_FLOP);
  assert.throws(() => applyChance(state, {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: ['As', '3d', '4s'],
  }), /Duplicate known card: As/);
  const legal = applyChance(state, {
    type: CHANCE_TYPES.DEAL_FLOP,
    cards: ['Kh', '3d', '4s'],
  });
  assert.deepEqual(legal.board, ['Kh', '3d', '4s']);
});

test('Hero DecisionContext projects normally and contains no opponent private-card field', () => {
  const state = partialDeal(2);
  const context = deriveDecisionContextFromPokerState(state, 'P0');
  assert.deepEqual(context.heroCards, ['As', 'Ad']);
  assert.equal(context.schemaVersion, 'decision-context/v1');
  assert.equal(Object.hasOwn(context, 'opponentCards'), false);
  assert.equal(JSON.stringify(context).includes('poker-hidden-hole-cards'), false);
});

test('controller partial deal makes the normal Hand decision available without opponent leakage', () => {
  const controller = createCanonicalLiveController({ enabled: true });
  controller.initialize({
    tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
    heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0,
  });
  const state = controller.dealObservedHoleCards({ 'seat-0': ['As', 'Ad'] });
  const result = resolvePlaybookDecisionContext({
    mode: 'hand', canonicalSession: controller, heroPlayerId: 'seat-0',
  });
  assert.equal(result.status, 'available');
  assert.deepEqual(result.decisionContext.heroCards, ['As', 'Ad']);
  const opponent = state.players.find((player) => player.playerId === 'seat-1');
  assert.equal(opponent.holeCards.status, 'hidden');
  assert.equal(opponent.holeCards.cardCount, 2);
});

test('live hidden opponent produces explicit awaiting-private-reveal showdown state', () => {
  const state = reachShowdown(partialDeal(2));
  assert.equal(state.showdown.status, 'awaiting_private_reveal');
  assert.deepEqual(state.showdown.requiredRevealPlayerIds, ['P1']);
  assert.throws(() => resolveShowdown(state), /showdown-ready/);
  assert.equal(state.terminal.isTerminal, false);
});

test('explicit reveal is deterministic, immutable, deeply frozen, and enables exact settlement', () => {
  const awaiting = reachShowdown(partialDeal(2));
  const snapshot = structuredClone(awaiting);
  const revealed = applyPrivateReveal(awaiting, { playerId: 'P1', cards: ['Kc', 'Kd'] });
  assert.deepEqual(awaiting, snapshot);
  assert.deepEqual(revealed.players[1].holeCards, ['Kc', 'Kd']);
  assert.equal(revealed.showdown.status, 'ready');
  assert.equal(Object.hasOwn(revealed.showdown, 'requiredRevealPlayerIds'), false);
  assert.equal(Object.isFrozen(revealed), true);
  assert.equal(Object.isFrozen(revealed.players[1].holeCards), true);
  const settled = resolveShowdown(revealed);
  assert.equal(settled.showdown.status, 'settled');
  assert.equal(settled.terminal.reason, 'showdown');
});

test('several required reveals advance one at a time and repeated or duplicate reveals reject', () => {
  let awaiting = reachShowdown(partialDeal(3));
  assert.deepEqual(awaiting.showdown.requiredRevealPlayerIds, ['P1', 'P2']);
  awaiting = applyPrivateReveal(awaiting, { playerId: 'P1', cards: ['Kc', 'Kd'] });
  assert.deepEqual(awaiting.showdown.requiredRevealPlayerIds, ['P2']);
  assert.throws(() => applyPrivateReveal(awaiting, {
    playerId: 'P1', cards: ['Kh', 'Ks'],
  }), /Only dealt hidden/);
  assert.throws(() => applyPrivateReveal(awaiting, {
    playerId: 'P2', cards: ['As', 'Qd'],
  }), /Duplicate known card: As/);
  awaiting = applyPrivateReveal(awaiting, { playerId: 'P2', cards: ['Qc', 'Qd'] });
  assert.equal(awaiting.showdown.status, 'ready');
  assert.equal(resolveShowdown(awaiting).terminal.isTerminal, true);
});

test('private reveal rejects undealt players and malformed card counts', () => {
  const initialized = initializeHand(configuration(2));
  assert.throws(() => applyPrivateReveal(initialized, {
    playerId: 'P1', cards: ['Kc', 'Kd'],
  }), /Only dealt hidden/);
  const dealt = partialDeal(2);
  assert.throws(() => applyPrivateReveal(dealt, {
    playerId: 'P1', cards: ['Kc'],
  }), /exactly two cards/);
});

test('folded hidden player remains hidden and is not required for exact showdown', () => {
  let state = partialDeal(3);
  if (state.actingPlayerId === 'P0') {
    state = passiveAction(state);
  }
  const foldedPlayerId = state.actingPlayerId;
  assert.notEqual(foldedPlayerId, 'P0');
  state = applyAction(state, createAction(foldedPlayerId, ACTION_TYPES.FOLD));
  state = reachShowdown(state);
  assert.equal(isHiddenHoleCards(state.players.find((player) => player.playerId === foldedPlayerId).holeCards), true);
  assert.equal(state.showdown.requiredRevealPlayerIds.includes(foldedPlayerId), false);
  const requiredId = state.showdown.requiredRevealPlayerIds[0];
  state = applyPrivateReveal(state, { playerId: requiredId, cards: ['Kc', 'Kd'] });
  assert.equal(state.showdown.status, 'ready');
  assert.equal(resolveShowdown(state).terminal.isTerminal, true);
});

test('side-pot showdown requests every eligible hidden hand', () => {
  let state = partialDeal(3, { stacks: [10_000, 20_000, 30_000] });
  let guard = 0;
  while (state.phase === PHASES.BETTING) {
    if (guard++ > 20) throw new Error('All-in sequence did not finish');
    const spec = getLegalActionSpec(state);
    const type = spec.allIn.available ? ACTION_TYPES.ALL_IN
      : spec.call.available ? ACTION_TYPES.CALL : ACTION_TYPES.CHECK;
    state = applyAction(state, createAction(state.actingPlayerId, type));
  }
  state = reachShowdown(state);
  assert.ok(derivePotLayers(state).length >= 2);
  assert.deepEqual(state.showdown.requiredRevealPlayerIds, ['P1', 'P2']);
});

test('fold terminal settles exactly without revealing any hidden hand', () => {
  const state = partialDeal(2);
  const terminal = applyAction(state, createAction(state.actingPlayerId, ACTION_TYPES.FOLD));
  assert.equal(terminal.terminal.reason, 'fold');
  assert.equal(terminal.potMilliBb, 0);
  assert.deepEqual(terminal.terminal.payoutsMilliBbByPlayer, { P1: 1000 });
  assert.deepEqual(terminal.terminal.refundsMilliBbByPlayer, { P1: 500 });
  assert.deepEqual(terminal.players.map((player) => player.currentStackMilliBb), [99_500, 100_500]);
  assert.equal(isHiddenHoleCards(terminal.players[1].holeCards), true);
  assert.equal(terminal.showdown.status, 'not_reached');
});

test('ClubGG seven-player partial deal preserves exact deduction and hidden opponents', () => {
  const state = partialDeal(7, { gameMode: GAME_MODES.CLUBGG });
  assert.equal(state.deductionTotalMilliBb, 700);
  assert.equal(state.potMilliBb, 1500);
  assert.equal(state.players.filter((player) => isHiddenHoleCards(player.holeCards)).length, 6);
});

test('Playbook bridge exposes observed deal and explicit reveal without changing full deal API', () => {
  const { bridge, events } = browserBridge();
  bridge.initializeHand({
    tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
    heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0,
  });
  const dealt = bridge.dealObservedHoleCards({ 'seat-0': ['As', 'Ad'] });
  assert.equal(isHiddenHoleCards(dealt.players[1].holeCards), true);
  assert.equal(typeof bridge.dealHoleCards, 'function');
  assert.equal(typeof bridge.revealHoleCards, 'function');
  assert.equal(events.at(-1).detail.operation, 'deal_hole_observed');
});

test('Hand Mode source uses canonical partial deal/reveal APIs and does not sample hidden cards', () => {
  const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const bootstrap = fs.readFileSync(
    new URL('../app/src/application/playbook-mode-bootstrap.mjs', import.meta.url),
    'utf8',
  );
  const chance = fs.readFileSync(new URL('../shared/poker-domain/chance.js', import.meta.url), 'utf8');
  const reveal = fs.readFileSync(new URL('../shared/poker-domain/private-reveal.js', import.meta.url), 'utf8');
  const handStart = logic.indexOf('function commitCanonicalHoleDeal');
  const handEnd = logic.indexOf('function deriveDecisionContext', handStart);
  assert.ok(handStart >= 0 && handEnd > handStart, 'canonical Hand section must be present');
  const canonicalHandLogic = logic.slice(handStart, handEnd);
  assert.match(logic, /callPlaybookStateBridge\('dealObservedHoleCards', cardsByPlayer\)/);
  assert.match(logic, /callPlaybookStateBridge\('revealHoleCards', playerId, cards\)/);
  assert.match(logic, /t\('\{count\} opponents hidden by default', \{ count: opponents\.length \}\)/);
  assert.match(bootstrap, /revealHoleCards\(playerId, cards\)/);
  assert.doesNotMatch(
    canonicalHandLogic + bootstrap + chance + reveal,
    /Math\.random|sampleHidden|shuffle/,
  );
});
