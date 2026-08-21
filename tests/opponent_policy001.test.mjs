import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
} from '../shared/poker-domain/index.js';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import {
  BASELINE_OPPONENT_POLICY_ID,
  BASELINE_OPPONENT_POLICY_VERSION,
  OPPONENT_POLICY_DECISION_SCHEMA_VERSION,
  OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
  OPPONENT_POLICY_SCHEMA_VERSION,
  OPPONENT_POLICY_SELECTION_SCHEMA_VERSION,
  OPPONENT_POLICY_TRANSITION_SCHEMA_VERSION,
  applyOpponentPolicyAction,
  chooseOpponentAction,
  createBasicOpponentPolicy,
  createOpponentPolicy,
} from '../app/src/application/opponent-policy.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);

function configuration({
  handId = 'opponent-policy-001',
  playerCount = 2,
  startingStackMilliBb = 100_000,
} = {}) {
  return {
    handId,
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    }, playerCount),
    buttonSeat: 0,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb,
    })),
  };
}

function dealtSession(options = {}) {
  const session = createCanonicalHandSession();
  session.initializeFromGameRulesSnapshot(configuration(options));
  session.applyChance({
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(
      session.getState().players.map((player, index) => [player.playerId, HOLE_CARDS[index]]),
    ),
  });
  return session;
}

function actorSeat(state) {
  return state.players.find((player) => player.playerId === state.actingPlayerId).seat;
}

function choose(state, seed, policy = createBasicOpponentPolicy()) {
  return chooseOpponentAction({
    policy,
    pokerState: state,
    actorSeat: actorSeat(state),
    decisionSeed: seed,
  });
}

function findDecision(state, type, policy = createBasicOpponentPolicy()) {
  for (let seed = 0; seed < 50_000; seed += 1) {
    const decision = choose(state, seed, policy);
    if (decision.action.type === type) return decision;
  }
  throw new Error(`No ${type} decision found in bounded seed search`);
}

function heuristicProvenance(description = 'Focused test heuristic archetype.') {
  return {
    schemaVersion: OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
    kind: 'heuristic_archetype',
    description,
    solverBacked: false,
    equilibriumClaim: false,
    populationModelClaim: false,
  };
}

test('OpponentPolicy v1 requires the exact current actor and rejects StrategyProvider-shaped input', () => {
  const state = dealtSession().getState();
  const policy = createBasicOpponentPolicy();
  assert.equal(policy.schemaVersion, OPPONENT_POLICY_SCHEMA_VERSION);
  assert.throws(() => chooseOpponentAction({
    policy,
    pokerState: state,
    actorSeat: actorSeat(state) + 1,
    decisionSeed: 1,
  }), /current actor/);
  assert.throws(() => chooseOpponentAction({
    policy: { schemaVersion: 'strategy-provider/v1', resolve() {} },
    pokerState: state,
    actorSeat: actorSeat(state),
    decisionSeed: 1,
  }), /unsupported fields|Expected opponent-policy\/v1/);
});

test('baseline choices are legal canonical actions and never mutate PokerState', () => {
  const state = dealtSession().getState();
  const snapshot = structuredClone(state);
  for (let seed = 0; seed < 250; seed += 1) {
    const decision = choose(state, seed);
    assert.doesNotThrow(() => applyAction(state, decision.action));
    assert.equal(decision.action.playerId, state.actingPlayerId);
  }
  assert.deepEqual(state, snapshot);
  assert.equal(Object.isFrozen(state), true);
});

test('canonical legality rejects an illegal action returned by a policy selector', () => {
  const state = dealtSession().getState();
  const illegalPolicy = createOpponentPolicy({
    policyId: 'focused.illegal-policy',
    policyVersion: 'v1',
    provenance: heuristicProvenance(),
    select({ actor }) {
      return {
        schemaVersion: OPPONENT_POLICY_SELECTION_SCHEMA_VERSION,
        action: createAction(actor.playerId, ACTION_TYPES.CHECK),
        selectionMetadata: {},
        sizingMetadata: {},
      };
    },
  });
  assert.throws(() => choose(state, 10, illegalPolicy), /Illegal check action/);
});

test('same state, policy, and seed reproduce the exact frozen decision and provenance', () => {
  const state = dealtSession().getState();
  const policy = createBasicOpponentPolicy();
  const first = choose(state, 0xdecafbad, policy);
  const second = choose(state, 0xdecafbad, policy);

  assert.deepEqual(second, first);
  assert.equal(first.schemaVersion, OPPONENT_POLICY_DECISION_SCHEMA_VERSION);
  assert.equal(first.policyId, BASELINE_OPPONENT_POLICY_ID);
  assert.equal(first.policyVersion, BASELINE_OPPONENT_POLICY_VERSION);
  assert.deepEqual(first.provenance, {
    schemaVersion: OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
    kind: 'heuristic_archetype',
    description: 'Small deterministic legal-action baseline for full-hand Training.',
    solverBacked: false,
    equilibriumClaim: false,
    populationModelClaim: false,
  });
  assert.equal(first.deterministicMetadata.decisionSeed, 0xdecafbad);
  assert.match(first.deterministicMetadata.stateFingerprint, /^poker-state-fnv1a32:[0-9a-f]{8}$/);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.action), true);
});

test('different seeds produce bounded fold, call, and minimum-raise variation when legal', () => {
  const state = dealtSession().getState();
  const legal = getLegalActionSpec(state);
  const fold = findDecision(state, ACTION_TYPES.FOLD);
  const call = findDecision(state, ACTION_TYPES.CALL);
  const raise = findDecision(state, ACTION_TYPES.RAISE);

  assert.notEqual(fold.deterministicMetadata.decisionSeed, call.deterministicMetadata.decisionSeed);
  assert.deepEqual(new Set([fold.action.type, call.action.type, raise.action.type]), new Set([
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CALL,
    ACTION_TYPES.RAISE,
  ]));
  assert.equal(raise.action.amountToMilliBb, legal.raise.minToMilliBb);
  assert.equal(raise.sizingMetadata.source, 'canonical_legal_action_spec');
  assert.equal(raise.sizingMetadata.mode, 'minimum_legal_to');
  assert.equal(raise.sizingMetadata.minimumToMilliBb, legal.raise.minToMilliBb);
  assert.equal(raise.sizingMetadata.maximumToMilliBb, legal.raise.maxToMilliBb);
});

test('check path heavily checks but can make a canonical minimum bet', () => {
  const session = dealtSession({ handId: 'opponent-policy-check' });
  let state = session.getState();
  session.applyAction(createAction(state.actingPlayerId, ACTION_TYPES.CALL));
  state = session.getState();
  session.applyAction(createAction(state.actingPlayerId, ACTION_TYPES.CHECK));
  session.applyChance({ type: CHANCE_TYPES.DEAL_FLOP, cards: ['2c', '3d', '4s'] });
  state = session.getState();
  const legal = getLegalActionSpec(state);
  const check = findDecision(state, ACTION_TYPES.CHECK);
  const bet = findDecision(state, ACTION_TYPES.BET);

  assert.equal(legal.check.available, true);
  assert.equal(check.selectionMetadata.reason, 'check_available');
  assert.equal(bet.action.amountToMilliBb, legal.bet.minToMilliBb);
  assert.doesNotThrow(() => applyAction(state, check.action));
  assert.doesNotThrow(() => applyAction(state, bet.action));
});

test('heads-up, multiway, and stack-capped short-stack calls remain canonical', () => {
  const headsUp = dealtSession({ handId: 'opponent-policy-hu' }).getState();
  const multiway = dealtSession({ handId: 'opponent-policy-multiway', playerCount: 6 }).getState();
  for (const state of [headsUp, multiway]) {
    const decision = choose(state, 77);
    assert.equal(decision.action.playerId, state.actingPlayerId);
    assert.doesNotThrow(() => applyAction(state, decision.action));
  }

  const shortStack = dealtSession({
    handId: 'opponent-policy-short-stack',
    startingStackMilliBb: 1_000,
  }).getState();
  const legal = getLegalActionSpec(shortStack);
  const call = findDecision(shortStack, ACTION_TYPES.CALL);
  const next = applyAction(shortStack, call.action);
  assert.equal(legal.call.allIn, true);
  assert.equal(call.action.amountToMilliBb, null);
  assert.equal(call.sizingMetadata.callCommitMilliBb, 500);
  assert.equal(call.sizingMetadata.callIsStackCappedAllIn, true);
  assert.equal(call.selectionMetadata.explicitAllInSelected, false);
  assert.equal(next.actionHistory.at(-1).wasAllIn, true);
});

test('session seam applies an opponent action as a normal canonical event, not an opponent HeroDecisionRecord', () => {
  const session = dealtSession({ handId: 'opponent-policy-session-seam' });
  session.configureHero({ heroPlayerId: 'P1', decisionContextOptions: { stackMode: 'hero' } });
  const before = session.getState();
  assert.equal(before.actingPlayerId, 'P0');
  assert.equal(session.getHeroDecisionJournal().decisions.length, 0);
  const call = findDecision(before, ACTION_TYPES.CALL);

  const transition = applyOpponentPolicyAction({
    session,
    policy: createBasicOpponentPolicy(),
    decisionSeed: call.deterministicMetadata.decisionSeed,
  });
  const journal = session.getHeroDecisionJournal();
  assert.equal(transition.schemaVersion, OPPONENT_POLICY_TRANSITION_SCHEMA_VERSION);
  assert.strictEqual(transition.state, session.getState());
  assert.equal(transition.state.actionHistory.at(-1).submittedAction.playerId, 'P0');
  assert.deepEqual(transition.state.actionHistory.at(-1).submittedAction, transition.decision.action);
  assert.equal(transition.state.phase, PHASES.BETTING);
  assert.equal(transition.state.actingPlayerId, 'P1');
  assert.equal(journal.decisions.length, 1);
  assert.equal(journal.decisions[0].currentActor.playerId, 'P1');
  assert.equal(journal.decisions[0].chosenAction, null);
  assert.equal(journal.decisions.some((record) => record.currentActor.playerId === 'P0'), false);
  assert.equal(session.createCanonicalHandReplaySource().events.at(-1).operation, 'action');
});

test('session seam requires configured Hero and refuses to act for Hero', () => {
  const session = dealtSession({ handId: 'opponent-policy-hero-guard' });
  assert.throws(() => applyOpponentPolicyAction({
    session,
    policy: createBasicOpponentPolicy(),
    decisionSeed: 1,
  }), /configure Hero/);
  session.configureHero({ heroPlayerId: session.getState().actingPlayerId });
  assert.throws(() => applyOpponentPolicyAction({
    session,
    policy: createBasicOpponentPolicy(),
    decisionSeed: 1,
  }), /cannot act for the configured Hero/);
});
