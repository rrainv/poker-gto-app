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
  STREETS,
  createAction,
} from '../shared/poker-domain/index.js';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import {
  DECISION_CONTEXT_V1_FIELDS,
  compareDecisionContexts,
} from '../app/src/application/decision-context-comparator.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import {
  DECISION_CONTEXT_SHADOW_DEFAULT_ENABLED,
  runDecisionContextShadowComparison,
} from '../app/src/application/decision-context-shadow.mjs';

const require = createRequire(import.meta.url);
const legacy = require('./qa002_adapters.js');

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const FLOP = Object.freeze(['2c', '3d', '4s']);
const TURN = Object.freeze(['9c']);
const RIVER = Object.freeze(['Tc']);

function configuration({
  playerCount = 2,
  mode = GAME_MODES.HOME,
  stacksMilliBb = Array(playerCount).fill(100_000),
  buttonSeat = 0,
} = {}) {
  return {
    handId: 'integration-003',
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
  };
}

function holeChance(state) {
  return {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      state.players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
    ),
  };
}

function createDealtSession(options = {}) {
  const session = createCanonicalHandSession(configuration(options));
  session.applyChance(holeChance(session.getState()));
  return session;
}

function act(session, type, amountToMilliBb = null) {
  const state = session.getState();
  return session.applyAction(createAction(state.actingPlayerId, type, amountToMilliBb));
}

function canonicalContext(session, options = {}) {
  const state = session.getState();
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
    legacyRakeValue: projected.legacyRakePercent,
  });
}

function assertParity(session, projectionOptions = {}) {
  const canonical = canonicalContext(session, projectionOptions);
  const legacyContext = legacyEquivalent(canonical);
  assert.deepEqual(compareDecisionContexts(legacyContext, canonical), {
    matches: true,
    mismatches: [],
  });
  return canonical;
}

function reachFlopSession() {
  const session = createDealtSession();
  act(session, ACTION_TYPES.CALL);
  act(session, ACTION_TYPES.CHECK);
  session.applyChance({ type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
  return session;
}

function reachTurnSession() {
  const session = reachFlopSession();
  act(session, ACTION_TYPES.CHECK);
  act(session, ACTION_TYPES.CHECK);
  session.applyChance({ type: CHANCE_TYPES.DEAL_TURN, cards: TURN });
  return session;
}

function reachRiverSession() {
  const session = reachTurnSession();
  act(session, ACTION_TYPES.CHECK);
  act(session, ACTION_TYPES.CHECK);
  session.applyChance({ type: CHANCE_TYPES.DEAL_RIVER, cards: RIVER });
  return session;
}

function isDeeplyFrozen(value) {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) return false;
  return Object.values(value).every((entry) => (
    !entry || typeof entry !== 'object' || isDeeplyFrozen(entry)
  ));
}

function baseContext(overrides = {}) {
  return {
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
    ...overrides,
  };
}

test('CanonicalHandSession initializes Home HU and multiway states', () => {
  const hu = createCanonicalHandSession(configuration());
  assert.equal(Object.isFrozen(hu), true);
  assert.equal(hu.getState().game.tableSize, 2);
  assert.equal(hu.getState().game.mode, GAME_MODES.HOME);
  assert.equal(hu.getState().phase, PHASES.CHANCE);
  assert.equal(hu.getState().potMilliBb, 1500);
  assert.equal(isDeeplyFrozen(hu.getState()), true);

  const multiway = createCanonicalHandSession(configuration({ playerCount: 6 }));
  assert.equal(multiway.getState().players.length, 6);
  assert.equal(multiway.getState().deductionTotalMilliBb, 0);
  assert.equal(isDeeplyFrozen(multiway.getState()), true);
});

test('CanonicalHandSession initializes exact ClubGG 7, 9, and 10-player deductions', () => {
  for (const playerCount of [7, 9, 10]) {
    const session = createCanonicalHandSession(configuration({
      playerCount,
      mode: GAME_MODES.CLUBGG,
    }));
    const state = session.getState();
    assert.equal(state.game.forcedContributionPerPlayerMilliBb, 100);
    assert.equal(state.deductionTotalMilliBb, playerCount * 100);
    assert.equal(state.potMilliBb, 1500);
    assert.equal(isDeeplyFrozen(state), true);
  }
});

test('deterministic chance replaces the owned state with a frozen successor', () => {
  const session = createCanonicalHandSession(configuration());
  const before = session.getState();
  const after = session.applyChance(holeChance(before));
  assert.notEqual(after, before);
  assert.equal(session.getState(), after);
  assert.deepEqual(after.players.map((player) => player.holeCards), HOLE_CARDS.slice(0, 2));
  assert.equal(after.phase, PHASES.BETTING);
  assert.equal(isDeeplyFrozen(after), true);
});

test('canonical actions and chance events advance streets through state replacement', () => {
  const session = createDealtSession();
  const dealt = session.getState();
  const called = act(session, ACTION_TYPES.CALL);
  assert.notEqual(called, dealt);
  const awaitingFlop = act(session, ACTION_TYPES.CHECK);
  assert.equal(awaitingFlop.phase, PHASES.CHANCE);
  const flop = session.applyChance({ type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
  assert.equal(flop.phase, PHASES.BETTING);
  assert.equal(flop.street, STREETS.FLOP);
  assert.deepEqual(flop.board, FLOP);
  assert.equal(session.getState(), flop);
  assert.equal(isDeeplyFrozen(flop), true);
});

test('failed transitions do not replace the session state', () => {
  const session = createDealtSession();
  const before = session.getState();
  assert.throws(
    () => session.applyAction(createAction('not-the-actor', ACTION_TYPES.FOLD)),
    /current actor/,
  );
  assert.equal(session.getState(), before);
});

test('reset clears or explicitly reinitializes the owned state', () => {
  const session = createDealtSession();
  assert.equal(session.reset(), null);
  assert.equal(session.getState(), null);
  assert.throws(() => session.applyChance({ type: CHANCE_TYPES.DEAL_HOLE }), /not initialized/);

  const resetState = session.reset(configuration({ playerCount: 3 }));
  assert.equal(resetState.players.length, 3);
  assert.equal(resetState.phase, PHASES.CHANCE);
  assert.equal(session.getState(), resetState);
  assert.equal(isDeeplyFrozen(resetState), true);
});

test('DecisionContext comparator reports exact matches and is deeply frozen', () => {
  const value = baseContext();
  const result = compareDecisionContexts(value, structuredClone(value));
  assert.deepEqual(result, { matches: true, mismatches: [] });
  assert.equal(isDeeplyFrozen(result), true);
  assert.equal(DECISION_CONTEXT_V1_FIELDS.length, 16);
});

test('DecisionContext comparator reports one field with directional values', () => {
  const result = compareDecisionContexts(baseContext(), baseContext({ stackBb: 80 }));
  assert.deepEqual(result, {
    matches: false,
    mismatches: [{ field: 'stackBb', legacyValue: 100, canonicalValue: 80 }],
  });
});

test('DecisionContext comparator handles multiple numeric and card-array mismatches', () => {
  const legacyContext = baseContext({ board: ['2c', '3d', '4s'], potBb: 4 });
  const canonical = baseContext({
    heroCards: ['As', 'Kd'],
    board: ['2c', '3d', '5s'],
    potBb: 5.5,
  });
  const legacyBefore = structuredClone(legacyContext);
  const canonicalBefore = structuredClone(canonical);
  const result = compareDecisionContexts(legacyContext, canonical);
  assert.deepEqual(result.mismatches.map((entry) => entry.field), [
    'heroCards', 'board', 'potBb',
  ]);
  assert.deepEqual(result.mismatches[0].legacyValue, ['As', 'Ad']);
  assert.deepEqual(result.mismatches[0].canonicalValue, ['As', 'Kd']);
  assert.deepEqual(legacyContext, legacyBefore);
  assert.deepEqual(canonical, canonicalBefore);
});

test('canonical and legacy contexts match for required preflop scenarios', () => {
  const unopened = createDealtSession();
  assert.equal(assertParity(unopened).lastAction, 'unopened');

  const raised = createDealtSession();
  act(raised, ACTION_TYPES.RAISE, 2500);
  assert.deepEqual(
    { action: assertParity(raised).lastAction, facing: canonicalContext(raised).facingSizeBb },
    { action: 'raise', facing: 2.5 },
  );

  act(raised, ACTION_TYPES.RAISE, 7500);
  assert.deepEqual(
    { action: assertParity(raised).lastAction, facing: canonicalContext(raised).facingSizeBb },
    { action: '3bet', facing: 7.5 },
  );

  const limped = createDealtSession({ playerCount: 3 });
  act(limped, ACTION_TYPES.CALL);
  act(limped, ACTION_TYPES.CALL);
  const bbOption = assertParity(limped);
  assert.equal(bbOption.heroPosition, 'BB');
  assert.equal(bbOption.lastAction, 'check');
  assert.equal(bbOption.facingSizeBb, 0);
});

test('canonical and legacy contexts match from flop through river', () => {
  const flop = reachFlopSession();
  assert.equal(assertParity(flop).street, 'flop');

  act(flop, ACTION_TYPES.BET, 2000);
  const facingBet = assertParity(flop);
  assert.equal(facingBet.lastAction, 'bet');
  assert.equal(facingBet.facingSizeBb, 2);

  const turn = reachTurnSession();
  assert.equal(assertParity(turn).street, 'turn');

  const river = reachRiverSession();
  assert.equal(assertParity(river).street, 'river');
});

test('Home and ClubGG shadow parity preserves accounting semantics', () => {
  const home = assertParity(createDealtSession({ playerCount: 6 }));
  assert.equal(home.rakeMode, 'off');
  assert.equal(home.totalForcedContributionBb, 0);

  for (const playerCount of [7, 9, 10]) {
    const club = assertParity(createDealtSession({
      playerCount,
      mode: GAME_MODES.CLUBGG,
    }));
    assert.equal(club.rakeMode, 'fixed');
    assert.equal(club.forcedContributionPerPlayerBb, 0.1);
    assert.equal(club.totalForcedContributionBb, playerCount / 10);
    assert.equal(club.legacyRakePercent, 0);
  }
});

test('shadow comparison defaults off and contains enabled failures', () => {
  assert.equal(DECISION_CONTEXT_SHADOW_DEFAULT_ENABLED, false);
  const disabled = runDecisionContextShadowComparison({
    session: { getState() { throw new Error('must not run'); } },
  });
  assert.deepEqual(disabled, { status: 'disabled', comparison: null, error: null });

  const failed = runDecisionContextShadowComparison({
    enabled: true,
    session: createCanonicalHandSession(),
    legacyContext: baseContext(),
    heroPlayerId: 'P0',
  });
  assert.equal(failed.status, 'error');
  assert.equal(failed.comparison, null);
  assert.match(failed.error.message, /active betting decision|Expected poker-state\/v1/);
});

test('shadow mismatches cannot alter the legacy context or actionProfile result', () => {
  const session = createDealtSession();
  const canonical = canonicalContext(session);
  const legacyContext = { ...legacyEquivalent(canonical), potBb: canonical.potBb + 1 };
  const solver = { strategy: { AA: { BTN: { Open: 100 } } } };
  const beforeContext = structuredClone(legacyContext);
  const beforeProfile = legacy.strategyProfile(legacyContext, solver);

  const shadow = runDecisionContextShadowComparison({
    enabled: true,
    session,
    legacyContext,
    heroPlayerId: session.getState().actingPlayerId,
  });
  const afterProfile = legacy.strategyProfile(legacyContext, solver);

  assert.equal(shadow.status, 'compared');
  assert.equal(shadow.comparison.matches, false);
  assert.deepEqual(shadow.comparison.mismatches.map((entry) => entry.field), ['potBb']);
  assert.deepEqual(legacyContext, beforeContext);
  assert.deepEqual(afterProfile, beforeProfile);
});

test('production path resolves one Playbook state source before the shared strategy path', () => {
  const logicSource = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
  assert.doesNotMatch(
    logicSource,
    /canonical-hand-session|decision-context-shadow|runDecisionContextShadowComparison/,
  );
  assert.match(logicSource, /playbookBridge\.resolveDecisionContext\(inputSnapshot, deriveDecisionContext\)/);
  assert.match(logicSource, /const decisionContext = playbookResolution\.decisionContext;/);
  assert.match(logicSource, /const strategyResult = actionProfile\(null, decisionContext\);/);

  const applicationFiles = [
    'canonical-hand-session.mjs',
    'decision-context-comparator.mjs',
    'decision-context-shadow.mjs',
  ];
  for (const file of applicationFiles) {
    const source = fs.readFileSync(new URL(`../app/src/application/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\b(?:document|window|globalThis)\b|querySelector/);
  }

  const domainFiles = fs.readdirSync(new URL('../shared/poker-domain/', import.meta.url));
  for (const file of domainFiles.filter((name) => name.endsWith('.js'))) {
    const source = fs.readFileSync(new URL(`../shared/poker-domain/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*app\//, file);
  }
});
