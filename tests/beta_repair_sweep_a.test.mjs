import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTION_TYPES, GAME_MODES } from '../shared/poker-domain/index.js';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { randomizeHandPendingDraft, HAND_PENDING_RANDOMIZATION_REQUEST_VERSION } from '../app/src/application/hand-pending-randomization.mjs';
import { createExactEnteredHandOutcomeFacts } from '../app/src/application/equity-hand-analysis.mjs';
import { randomizeAnalyzeScenario, ANALYZE_RANDOMIZATION_REQUEST_VERSION } from '../app/src/application/analyze-scenario-randomization.mjs';
import { validatePlaybookScenarioReadiness } from '../app/src/application/playbook-scenario-readiness.mjs';

function showdown({ foldHero = false, count = 3, knownOpponent = false } = {}) {
  const c = createCanonicalLiveController({ enabled: true });
  assert.ok(c.initialize({ tableSize: count, gameMode: GAME_MODES.HOME, stackBb: 10,
    heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0 }));
  const hero = c.getHeroPlayerId();
  const known = { [hero]: ['Ah', '6d'] };
  if (knownOpponent) known[c.getState().players.find(p => p.playerId !== hero).playerId] = ['Ks', 'Kd'];
  c.dealObservedHoleCards(known);
  for (let n = 0; n < 100 && c.getState().showdown.status === 'not_reached'; n++) {
    const s = c.getState();
    if (s.pendingChance) {
      const cards = s.pendingChance.type === 'deal_flop' ? ['7d', 'Qh', 'Ad'] : s.pendingChance.type === 'deal_turn' ? ['2c'] : ['3c'];
      assert.ok(c.dealBoardCards(cards));
    } else {
      const spec = c.getLegalActions();
      assert.ok(c.applyAction({ type: foldHero && s.actingPlayerId === hero ? ACTION_TYPES.FOLD : spec.check.available ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL }));
    }
  }
  return c;
}

test('showdown draft randomization follows eligible unknown opponents with Hero active or folded', () => {
  for (const foldHero of [false, true]) for (const knownOpponent of [false, true]) {
    const c = showdown({ foldHero, knownOpponent, count: 4 }), state = c.getState();
    assert.equal(state.showdown.status, 'awaiting_private_reveal');
    const required = state.showdown.requiredRevealPlayerIds.map(id => state.players.find(p => p.playerId === id));
    const bySeat = { [required[0].seat]: ['Tc', null] };
    for (let seed = 0; seed < 80; seed++) {
      const request = { schemaVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION, state, seed, bySeat };
      const result = randomizeHandPendingDraft(request);
      assert.equal(result.status, 'available');
      assert.deepEqual(randomizeHandPendingDraft(request), result);
      assert.deepEqual(Object.keys(result.bySeat).sort(), required.map(p => String(p.seat)).sort());
      assert.equal(result.bySeat[required[0].seat][0], 'Tc');
      const cards = [...Object.values(result.bySeat).flat(), ...state.board, ...state.deadCards,
        ...state.players.flatMap(p => Array.isArray(p.holeCards) ? p.holeCards : [])];
      assert.equal(new Set(cards).size, cards.length);
      assert.equal(c.getState(), state, 'draft never commits history');
    }
    const blocked = randomizeHandPendingDraft({ schemaVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION, state, seed: 1,
      bySeat: { [required[0].seat]: ['Ah'] } });
    assert.equal(blocked.status, 'unavailable');
    const deadState = { ...state, deadCards: ['Tc', 'Td'] };
    for (let seed = 0; seed < 30; seed++) {
      const dead = randomizeHandPendingDraft({ schemaVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION, state: deadState, seed });
      assert.equal(dead.status, 'available');
      assert.ok(Object.values(dead.bySeat).flat().every(card => !deadState.deadCards.includes(card)));
    }
    const result = randomizeHandPendingDraft({ schemaVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION, state, seed: 1 });
    for (const p of required) assert.ok(c.revealHoleCards(p.playerId, result.bySeat[p.seat]));
    assert.equal(c.getState().showdown.status, 'ready');
  }
});

test('a terminal fold winner needs no private reveal randomization', () => {
  const c = createCanonicalLiveController({ enabled: true });
  c.initialize({ tableSize: 2, gameMode: GAME_MODES.HOME, stackBb: 10, heroPosition: 'BTN' });
  c.dealObservedHoleCards({ [c.getHeroPlayerId()]: ['As', 'Ad'] });
  c.applyAction({ type: ACTION_TYPES.FOLD });
  const result = randomizeHandPendingDraft({ schemaVersion: HAND_PENDING_RANDOMIZATION_REQUEST_VERSION, state: c.getState(), seed: 1 });
  assert.equal(result.status, 'unavailable');
});

test('Ah6d versus 7h5s on 7dQhAd improves to two pair but loses the lead on remaining sevens', () => {
  const facts = createExactEnteredHandOutcomeFacts({ players: [{ id: 'hero', cards: ['Ah', '6d'] }, { id: 'villain', cards: ['7h', '5s'] }], board: ['7d', 'Qh', 'Ad'] });
  const hero = facts.players[0];
  assert.equal(hero.currentStanding, 'leading');
  assert.deepEqual([...hero.structuralImprovementsLosingLead.cards].sort(), ['7c', '7s']);
  assert.equal(hero.structuralImprovementsStillBehind.count, 0);
  for (const card of ['7c', '7s']) {
    const transition = hero.nextCardTransitions.find(row => row.card === card);
    assert.equal(transition.handClassImproved, true);
    assert.equal(transition.resultCategory, 'two_pair');
    assert.equal(transition.standingBefore, 'leading'); assert.equal(transition.standingAfter, 'behind');
    assert.ok(!hero.winningOuts.cards.includes(card)); assert.ok(!hero.tieOuts.cards.includes(card));
  }
});

test('thousands of deterministic scenarios respect readiness across 2–10 players, streets and Keep masks', () => {
  for (let tableSize = 2; tableSize <= 10; tableSize++) for (const board of [[], ['2c','7d','Th'], ['2c','7d','Th','9s'], ['2c','7d','Th','9s','Qh']]) {
    const scenario = { tableSize, heroPosition: 'BTN', street: ({0:'preflop',3:'flop',4:'turn',5:'river'})[board.length], heroCards: ['As','Kd'], board,
      deadCards: ['Jc'], stackBb: 100, stackMode: 'hero', potBb: board.length ? 6 : 1.5,
      lastAction: board.length ? 'check' : 'unopened', facingSizeBb: 0, rakeMode: 'off', anteBb: 0, straddleBb: 0 };
    for (let seed = 0; seed < 96; seed++) {
      const keeps = Object.fromEntries(['hero','board','position','stack','betting_context'].map((key,i) => [key, Boolean(seed & (1<<i))]));
      const request = { schemaVersion: ANALYZE_RANDOMIZATION_REQUEST_VERSION, scenario, target: 'spot', seed, keeps };
      const result = randomizeAnalyzeScenario(request); assert.equal(result.status, 'available');
      assert.equal(validatePlaybookScenarioReadiness(result.scenario).ready, true);
      assert.deepEqual(randomizeAnalyzeScenario(request), result);
      for (const target of ['hero','board','position','stack','betting_context']) {
        if (seed % 16 || target === 'board' && !board.length) continue;
        const changed = randomizeAnalyzeScenario({ ...request, keeps: {}, target });
        assert.equal(changed.status, 'available');
        assert.equal(validatePlaybookScenarioReadiness(changed.scenario).ready, true);
      }
    }
  }
});
