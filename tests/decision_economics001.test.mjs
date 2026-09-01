import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  LEDGER_KINDS,
  applyAction,
  applyChance,
  createAction,
  deriveActorCallEconomics,
  derivePotAccounting,
  initializeHand,
} from '../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from
  '../app/src/application/decision-context-from-poker-state.mjs';
import { deriveDecisionContextFromPlaybookScenario } from
  '../app/src/application/playbook-state-source.mjs';
import { calculatePreflopHeuristic } from '../app/src/strategy/preflop-heuristic.mjs';
import { calculatePostflopHeuristicStrategy } from
  '../app/src/strategy/postflop-heuristic.mjs';

const HOLE_CARDS = Object.freeze({
  P0: ['As', 'Kh'],
  P1: ['Qd', 'Jc'],
  P2: ['Ts', '9h'],
  P3: ['8d', '7c'],
});

function dealtTable(stacksBb) {
  let state = initializeHand({
    handId: `decision-economics-${stacksBb.join('-')}`,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: stacksBb.map((stackBb, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: stackBb * 1000,
    })),
  });
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      state.players.map((player) => [player.playerId, HOLE_CARDS[player.playerId]]),
    ),
  });
  return state;
}

function act(state, type, amountToMilliBb = null) {
  return applyAction(
    state,
    createAction(state.actingPlayerId, type, amountToMilliBb),
  );
}

function huPreflopShove(bigStackBb = 100, shortStackBb = 10) {
  return act(dealtTable([bigStackBb, shortStackBb]), ACTION_TYPES.ALL_IN);
}

function huPostflopShove() {
  let state = dealtTable([100, 10]);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  state = applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: ['2h', '3h', '4h'] });
  state = act(state, ACTION_TYPES.CHECK);
  return act(state, ACTION_TYPES.ALL_IN);
}

function trainingPresentationAdapter() {
  const source = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  const start = source.indexOf('function trainingContextPresentationAdapter(');
  const end = source.indexOf('function formatTrainingFacingCopy(', start);
  assert.ok(start >= 0 && end > start);
  const sandbox = {};
  vm.runInNewContext(
    `${source.slice(start, end)}\nglobalThis.adapter = trainingContextPresentationAdapter;`,
    sandbox,
  );
  return sandbox.adapter;
}

test('HU 100bb-vs-10bb preflop shove prices the short call at 45%, not 8.18%', () => {
  const state = huPreflopShove();
  const accounting = derivePotAccounting(state);
  assert.equal(state.potMilliBb, 101_000);
  assert.equal(accounting.contestablePotMilliBb, 2000);
  assert.equal(accounting.unmatchedMilliBb, 99_000);

  const beforeSelector = structuredClone(state);
  const domain = deriveActorCallEconomics(state, 'P1');
  assert.deepEqual(state, beforeSelector);
  assert.equal(Object.isFrozen(domain), true);
  assert.equal(domain.potAfterCallMilliBb, 110_000);
  assert.equal(domain.callCommitmentMilliBb, 9000);
  assert.equal(domain.actorContestablePotAfterCallMilliBb, 20_000);
  assert.equal(domain.actorIneligiblePotAfterCallMilliBb, 90_000);
  assert.equal(domain.requiredRawEquity, 0.45);
  assert.equal(
    domain.actorContestablePotAfterCallMilliBb
      + domain.actorIneligiblePotAfterCallMilliBb,
    state.potMilliBb + domain.callCommitmentMilliBb,
  );

  const context = deriveDecisionContextFromPokerState(state, 'P1');
  assert.equal(context.currentPotBb, 101);
  assert.equal(context.callAmountBb, 9);
  assert.equal(context.actorContestablePotAfterCallBb, 20);
  assert.equal(context.actorIneligiblePotAfterCallBb, 90);
  assert.equal(context.requiredRawEquity, 0.45);
  assert.equal(calculatePreflopHeuristic(context).details.requiredRawEquity, 0.45);

  const afterCall = act(state, ACTION_TYPES.CALL);
  assert.equal(afterCall.potMilliBb, 20_000);
  assert.equal(afterCall.ledger.at(-1).kind, LEDGER_KINDS.UNCALLED_REFUND);
  assert.equal(derivePotAccounting(afterCall).unmatchedMilliBb, 0);
});

test('HU unequal-stack postflop shove uses the same actor-relative final pot', () => {
  const state = huPostflopShove();
  const context = deriveDecisionContextFromPokerState(state, 'P1');
  assert.equal(context.currentPotBb, 101);
  assert.equal(context.callAmountBb, 9);
  assert.equal(context.actorContestablePotAfterCallBb, 20);
  assert.equal(context.requiredRawEquity, 0.45);

  const strategy = calculatePostflopHeuristicStrategy(context, {}, () => 0.5);
  assert.equal(strategy.context.requiredRawEquity, 0.45);
  assert.equal(strategy.context.actorContestablePotAfterCallBbUsed, 20);
});

test('multiway short actor prices only the main pot and cannot win upper layers', () => {
  let state = dealtTable([100, 50, 10]);
  state = act(state, ACTION_TYPES.ALL_IN);
  state = act(state, ACTION_TYPES.CALL);
  const context = deriveDecisionContextFromPokerState(state, 'P2');

  assert.equal(context.currentPotBb, 151);
  assert.equal(context.callAmountBb, 9);
  assert.equal(context.actorContestablePotAfterCallBb, 30);
  assert.equal(context.actorIneligiblePotAfterCallBb, 130);
  assert.equal(context.requiredRawEquity, 0.3);
});

test('multiway folded dead money helps eligible layers while upper side pots stay excluded', () => {
  let state = dealtTable([50, 10, 10, 100]);
  state = act(state, ACTION_TYPES.ALL_IN);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.FOLD);
  const context = deriveDecisionContextFromPokerState(state, 'P2');

  assert.equal(context.currentPotBb, 151.5);
  assert.equal(context.callAmountBb, 9);
  assert.equal(context.actorContestablePotAfterCallBb, 30.5);
  assert.equal(context.actorIneligiblePotAfterCallBb, 130);
  assert.equal(context.requiredRawEquity, 9 / 30.5);
  assert.equal(
    context.actorContestablePotAfterCallBb + context.actorIneligiblePotAfterCallBb,
    context.currentPotBb + context.callAmountBb,
  );
});

test('symmetric stacks agree with ordinary total-pot pricing', () => {
  const state = huPreflopShove(100, 100);
  const context = deriveDecisionContextFromPokerState(state, 'P1');
  assert.equal(context.currentPotBb, 101);
  assert.equal(context.callAmountBb, 99);
  assert.equal(context.actorContestablePotAfterCallBb, 200);
  assert.equal(context.actorIneligiblePotAfterCallBb, 0);
  assert.equal(context.requiredRawEquity, 0.495);
});

test('free actions and lossy Scenario contexts do not invent required equity', () => {
  let state = dealtTable([100, 100]);
  state = act(state, ACTION_TYPES.CALL);
  const freeContext = deriveDecisionContextFromPokerState(state, 'P1');
  assert.equal(freeContext.callAmountBb, 0);
  assert.equal(freeContext.requiredRawEquity, null);

  const scenario = deriveDecisionContextFromPlaybookScenario({
    tableSize: 2,
    heroPosition: 'BB',
    heroCards: ['As', 'Kh'],
    board: [],
    deadCards: [],
    stackBb: 10,
    potBb: 101,
    lastAction: 'raise',
    facingSizeBb: 100,
    rakeMode: 'off',
    gameMode: 'home',
  });
  assert.equal(scenario.actorContestablePotAfterCallBb, null);
  assert.equal(scenario.actorIneligiblePotAfterCallBb, null);
  assert.equal(scenario.requiredRawEquity, null);
});

test('Training presents exact pot odds but limits scalar MDF to proven heads-up contexts', () => {
  const adapter = trainingPresentationAdapter();
  const base = {
    tableSize: 2,
    stackBb: 10,
    heroPosition: 'BB',
    street: 'preflop',
    lastAction: 'raise',
    currentPotBb: 101,
    potBb: 101,
    facingSizeBb: 100,
    callAmountBb: 9,
    actorContestablePotAfterCallBb: 20,
    requiredRawEquity: 0.45,
    board: [],
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
  };
  const headsUp = adapter({ ...base, opponentCount: 1 });
  assert.equal(headsUp.potOdds, 45);
  assert.ok(Math.abs(headsUp.mdf - 55) < 1e-9);
  const multiway = adapter({ ...base, tableSize: 3, opponentCount: 2 });
  assert.equal(multiway.potOdds, 45);
  assert.equal(multiway.mdf, null);
});
