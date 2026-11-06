import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  deriveActionSizeFacts,
  getLegalActionSpec,
} from '../shared/poker-domain/index.js';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import { createFullHandTrainingSizingModel } from '../app/src/application/full-hand-training-sizing.mjs';

// TRAINING-FULLHAND-001: pot share and heads-up SPR after a size, from the
// domain selector. Poker maths, so exact values plus invariants.

function rules(playerCount) {
  return createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
  }, playerCount);
}

function dealt(playerCount, holeCards) {
  const session = createCanonicalHandSession();
  session.initializeFromGameRulesSnapshot({
    handId: `size-facts-${playerCount}`,
    rulesSnapshot: rules(playerCount),
    buttonSeat: 0,
    players: holeCards.map((_, seat) => ({ playerId: `P${seat}`, seat, startingStackMilliBb: 100_000 })),
  });
  session.configureHero({ heroPlayerId: 'P0', decisionContextOptions: { stackMode: 'hero' } });
  session.applyChance({
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(holeCards.map((cards, seat) => [`P${seat}`, cards])),
  });
  return session.getState();
}

const HEADS_UP = [['As', 'Kd'], ['Qh', 'Jd']];

test('a heads-up preflop raise reports exact pot share and SPR after a call', () => {
  const state = dealt(2, HEADS_UP);
  const facts = deriveActionSizeFacts(state, state.actingPlayerId, 3000);
  // Pot 1.5 bb; calling 0.5 makes the actor-contestable pot 2 bb; the raise adds 2 bb over the 1 bb wager.
  assert.equal(facts.potShare, 1);
  // Called: 2.5 bb from the actor, 2 bb from the opponent, pot 6 bb, 97 bb behind each.
  assert.ok(Math.abs(facts.sprAfterCalled - 97 / 6) < 1e-12);
});

test('pot share rises and SPR falls as the size grows (invariant over every legal size)', () => {
  const state = dealt(2, HEADS_UP);
  const bounds = getLegalActionSpec(state).raise;
  let previous = null;
  for (let amount = bounds.minToMilliBb; amount <= bounds.maxToMilliBb; amount += 4300) {
    const facts = deriveActionSizeFacts(state, state.actingPlayerId, amount);
    assert.ok(facts.potShare >= 0 && Number.isFinite(facts.potShare));
    assert.ok(facts.sprAfterCalled >= 0 && Number.isFinite(facts.sprAfterCalled));
    if (previous) {
      assert.ok(facts.potShare > previous.potShare, `share grows at ${amount}`);
      assert.ok(facts.sprAfterCalled < previous.sprAfterCalled, `SPR falls at ${amount}`);
    }
    previous = facts;
  }
});

test('a size that covers the stacks leaves nothing behind', () => {
  const state = dealt(2, HEADS_UP);
  const allIn = getLegalActionSpec(state).allIn.amountToMilliBb;
  assert.equal(deriveActionSizeFacts(state, state.actingPlayerId, allIn).sprAfterCalled, 0);
});

test('multiway SPR is unknown (null), never zero; the pot share is still defined', () => {
  const state = dealt(3, [['As', 'Kd'], ['Qh', 'Jd'], ['7c', '2d']]);
  const facts = deriveActionSizeFacts(state, state.actingPlayerId, 3000);
  assert.equal(facts.sprAfterCalled, null);
  assert.ok(facts.potShare > 0);
});

test('invalid amounts are refused, and the selector does not mutate the state', () => {
  const state = dealt(2, HEADS_UP);
  const before = JSON.stringify(state);
  assert.throws(() => deriveActionSizeFacts(state, state.actingPlayerId, -1), RangeError);
  assert.throws(() => deriveActionSizeFacts(state, state.actingPlayerId, 1.5), RangeError);
  deriveActionSizeFacts(state, state.actingPlayerId, 3000);
  assert.equal(JSON.stringify(state), before);
});

test('every sizing preset carries the selector output and nothing else invented', () => {
  const state = dealt(2, HEADS_UP);
  const model = createFullHandTrainingSizingModel(state);
  assert.ok(model.actions.raise.presets.length >= 3);
  for (const preset of model.actions.raise.presets) {
    const facts = deriveActionSizeFacts(state, state.actingPlayerId, preset.amountToMilliBb);
    assert.equal(preset.potShare, facts.potShare);
    assert.equal(preset.sprAfterCalled, facts.sprAfterCalled);
  }
  assert.equal(model.actions.raise.presets.at(-1).kind, 'all_in');
  assert.equal(model.actions.raise.presets.at(-1).sprAfterCalled, 0);
  assert.equal(ACTION_TYPES.RAISE, 'raise');
});
