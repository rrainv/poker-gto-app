import test from 'node:test';
import assert from 'node:assert/strict';
import { CHANCE_TYPES, HOLDEM_DECK, createAction, applyAction, getLegalActionSpec,
  createGameRulesSnapshotFromLegacyGameConfiguration } from '../shared/poker-domain/index.js';
import { createCanonicalHandSession } from '../app/src/application/canonical-hand-session.mjs';
import { chooseOpponentAction, createOpponentPolicy, createBasicOpponentPolicy } from '../app/src/application/opponent-policy.mjs';
import { createOpponentActorInformation } from '../app/src/application/opponent-actor-information.mjs';
import { createSyntheticConfiguration, createSyntheticOpponentPolicy, SYNTHETIC_PRESETS,
  createOpponentPracticeRequest, validateOpponentPracticeRequest } from '../app/src/application/synthetic-opponent-policy.mjs';
import { createAutomatedHandProgression, createBasicOpponentAssignments,
  createConfiguredOpponentAssignments } from '../app/src/application/automated-hand-progression.mjs';
import { createSeededRandom } from '../app/src/application/deterministic-random.mjs';
import { createOpponentPolicyLanguageFacts, describeOpponentDecision, describeOpponentPolicy,
  OPPONENT_POLICY_COPY } from '../app/src/application/opponent-policy-language.mjs';
import { createFullHandTrainingSessionController } from '../app/src/application/full-hand-training-session-controller.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { createReplayProjectionController } from '../app/src/application/replay-projection-controller.mjs';
import { reconstructCanonicalHandReplaySource } from '../app/src/application/canonical-hand-replay-source.mjs';

function configuration(count = 2, stack = 20000) {
  return { handId: 'actor-safe-fixture', buttonSeat: 0,
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({ mode: 'home', smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000, chipUnitMilliBb: 100, ante: { type: 'none', amountMilliBb: 0 } }, count),
    players: Array.from({ length: count }, (_, seat) => ({ playerId: `P${seat}`, seat, startingStackMilliBb: stack })) };
}
function session(count = 2) { const value = createCanonicalHandSession(); value.initializeFromGameRulesSnapshot(configuration(count)); return value; }
function dealt({ other = ['Kh', 'Kd'], own = ['As', 'Ad'], dead = [] } = {}) {
  const value = session();
  value.applyChance({ type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: { P0: own, P1: other } });
  return { ...structuredClone(value.getState()), deadCards: dead };
}
function choose(state, policy, seed = 17) {
  return chooseOpponentAction({ policy, pokerState: state, actorSeat: state.players.find(player => player.playerId === state.actingPlayerId).seat, decisionSeed: seed });
}
function request(parameters = SYNTHETIC_PRESETS['calling-heavy'], tableSize = 2) {
  return createOpponentPracticeRequest({ configuration: createSyntheticConfiguration(parameters), tableSize, policySeed: 908 });
}
function asRecord(decision) {
  return { policyConfiguration: decision.policyConfiguration, deterministicMetadata: decision.deterministicMetadata,
    policyId: decision.policyId, policyVersion: decision.policyVersion,
    selectionProvenance: decision.selectionMetadata, chosenAction: decision.action,
    actor: { seat: decision.actorInformation.actorSeat }, actorInformation: decision.actorInformation };
}

test('counterfactual hidden cards, unknown dead cards and private IDs cannot cross the actor allowlist', () => {
  const a = dealt(); const b = dealt({ other: ['2c', '3c'], dead: ['4h'] });
  b.handId = 'private-deal-seed-917';
  for (const base of [createBasicOpponentPolicy(), ...Object.values(SYNTHETIC_PRESETS).map(p => createSyntheticOpponentPolicy(createSyntheticConfiguration(p)))]) {
    const inputs = [];
    const spy = createOpponentPolicy({ ...base, select(input) { inputs.push(input); return base.select(input); } });
    const cache = new Map();
    for (let seed = 0; seed < 32; seed++) {
      const first = choose(a, spy, seed); const second = choose(b, spy, seed);
      assert.deepEqual(inputs.at(-1), inputs.at(-2));
      assert.deepEqual(second, first);
      assert.equal(inputs.at(-1).pokerState, undefined);
      assert.equal(inputs.at(-1).information.players[1].holeCards, undefined);
      assert.equal(inputs.at(-1).information.deadCards, undefined);
      assert.equal(Object.isFrozen(inputs.at(-1).information.players), true);
      cache.set(first.deterministicMetadata.cacheKey, first);
      assert.deepEqual(cache.get(second.deterministicMetadata.cacheKey), second);
      if (base.configuration) for (const locale of ['en', 'ru', 'he']) {
        assert.equal(describeOpponentDecision(asRecord(first), locale), describeOpponentDecision(asRecord(second), locale));
      }
    }
  }
  assert.notDeepEqual(createOpponentActorInformation({ pokerState: a, actorSeat: 0 }),
    createOpponentActorInformation({ pokerState: dealt({ own: ['Qs', 'Qd'] }), actorSeat: 0 }));
});

test('public board changes information; inaccessible future schedule changes neither current input nor RNG', () => {
  const initial = session().getState();
  const seen = new Map(); let pair;
  for (let seed = 0; seed < 2000 && !pair; seed++) {
    const deck = createSeededRandom(seed).shuffle(HOLDEM_DECK);
    const own = [deck[1], deck[3]]; // HU round-robin: BB then BTN.
    const key = own.join(',');
    if (seen.has(key)) pair = [seen.get(key), seed]; else seen.set(key, seed);
  }
  assert.ok(pair, 'deterministic fixture must find identical actor cards with different remaining decks');
  const run = chanceSeed => {
    const progression = createAutomatedHandProgression({ initialConfiguration: configuration(), heroPlayerId: 'P1',
      handSeed: 77, chanceSeed, opponentPractice: request() });
    progression.advanceUntilHeroOrTerminal();
    return progression.getBotDecisionJournal().decisions[0];
  };
  const [first, second] = pair.map(run);
  assert.deepEqual(first.actorInformation, second.actorInformation);
  assert.deepEqual(first.deterministicMetadata, second.deterministicMetadata);
  assert.deepEqual(first.chosenAction, second.chosenAction);
  assert.deepEqual(first.selectionProvenance, second.selectionProvenance);
  const assignments = seed => createBasicOpponentAssignments({ pokerState: initial, heroPlayerId: 'P1', handSeed: seed });
  assert.deepEqual(assignments(1), assignments(987654321));
  const toFlop = board => {
    const value = session(); value.applyChance({ type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer: { P0: ['As', 'Ad'], P1: ['Kh', 'Kd'] } });
    value.applyAction(createAction('P0', 'call')); value.applyAction(createAction('P1', 'check'));
    value.applyChance({ type: CHANCE_TYPES.DEAL_FLOP, cards: board }); return value.getState();
  };
  assert.notEqual(choose(toFlop(['2s', '3h', '4d']), createBasicOpponentPolicy()).deterministicMetadata.stateFingerprint,
    choose(toFlop(['2s', '3h', '5d']), createBasicOpponentPolicy()).deterministicMetadata.stateFingerprint);
});

test('explicit parameters, not labels, own legal weights; unavailable raises redistribute honestly', () => {
  const state = dealt();
  const policies = Object.values(SYNTHETIC_PRESETS).map(p => createSyntheticOpponentPolicy(createSyntheticConfiguration(p)));
  const actions = policies.map(policy => choose(state, policy));
  assert.equal(new Set(actions.map(item => JSON.stringify(item.selectionMetadata.weights))).size, 3);
  for (const policy of policies) for (let seed = 0; seed < 100; seed++) assert.doesNotThrow(() => applyAction(state, choose(state, policy, seed).action));
  const initial = session().getState();
  const assignments = createConfiguredOpponentAssignments({ pokerState: initial, heroPlayerId: 'P1', handSeed: 1, request: request() });
  const run = archetype => {
    const progression = createAutomatedHandProgression({ initialConfiguration: configuration(), heroPlayerId: 'P1', handSeed: 1,
      opponentAssignments: assignments.map(item => ({ ...item, archetype })) });
    progression.advanceUntilHeroOrTerminal(); return progression.getBotDecisionJournal().decisions[0];
  };
  const a = run('Calling-heavy'); const b = run('a misleading friendly label');
  assert.deepEqual(a.chosenAction, b.chosenAction); assert.deepEqual(a.deterministicMetadata, b.deterministicMetadata);
  const renamedVersion = createOpponentPolicy({ ...policies[0], policyVersion: 'future/v3' });
  assert.notEqual(choose(state, renamedVersion).deterministicMetadata.cacheKey, actions[0].deterministicMetadata.cacheKey);
  assert.throws(() => createSyntheticConfiguration({ label: 'Aggressive' }), /Four explicit/);
  assert.throws(() => createSyntheticConfiguration({ ...SYNTHETIC_PRESETS.aggressive, facingRaisePercent: 101 }), /percentages/);
  assert.throws(() => validateOpponentPracticeRequest({ ...request(), policyVersion: 'v999' }), /Unsupported/);
  assert.throws(() => validateOpponentPracticeRequest({ ...request(), allowedContext: 'omaha' }), /Unsupported/);
  assert.throws(() => createConfiguredOpponentAssignments({ pokerState: initial, heroPlayerId: 'P1', handSeed: 1,
    request: createOpponentPracticeRequest({ target: 'BB' }) }), /non-Hero/);
});

test('several full Hands across presets and table sizes retain exact actor evidence and replay', async () => {
  for (const [name, parameters] of Object.entries(SYNTHETIC_PRESETS)) for (const count of [2, 6]) {
    for (const handSeed of [11, 22, 33]) {
      let calls = 0;
      const provider = createStrategyProvider({ fallbackResolver() {
        calls++; return { source: 'heuristic_preflop', modelVersion: 'test/v1', actions: [
          { action: { type: 'call' }, label: 'Call', probability: 1 } ] };
      } });
      const controller = createFullHandTrainingSessionController();
      const input = { handConfiguration: configuration(count), heroSeat: 0, handSeed, opponentPractice: request(parameters, count) };
      const play = async () => {
        let result = controller.start(input, { strategyProvider: provider });
        assert.equal(result.ok, true, `${name}: ${JSON.stringify(result.error)}`);
        let answers = 0;
        while (result.snapshot.status === 'awaiting_hero' && answers++ < 128) {
          const decision = result.snapshot.currentDecision; const legal = decision.legalActions;
          result = await controller.answer(decision.decisionId, { type: legal.check.available ? 'check' : 'call' });
          assert.equal(result.ok, true, JSON.stringify(result.error));
        }
        assert.equal(result.snapshot.status, 'terminal'); return result.snapshot;
      };
      const first = await play();
      assert.equal(calls, first.summary.decisionsAnswered, 'one provider invocation per Hero answer only');
      assert.deepEqual(first.opponentPractice, input.opponentPractice);
      const second = await play();
      assert.deepEqual(second.botDecisionJournal, first.botDecisionJournal);
      assert.deepEqual(second.replaySource, first.replaySource);
      const replay = createReplayProjectionController();
      assert.doesNotThrow(() => replay.replaceFromCanonicalHandReplaySource(first.replaySource, { readOnly: true }));
      assert.ok(first.automatedCompletedHandResult.botDecisionJournal.decisions.length);
      for (const record of first.botDecisionJournal.decisions) {
        assert.equal(record.actorInformation.ownCards.length, 2);
        assert.ok(record.actorInformation.players.every(player => !Object.hasOwn(player, 'holeCards')));
        assert.equal(record.selectionProvenance.normativeAssessment, false);
        const decision = chooseOpponentAction({ policy: createSyntheticOpponentPolicy(record.policyConfiguration),
          pokerState: replayStateBefore(first.replaySource, record), actorSeat: record.actor.seat,
          decisionSeed: record.decisionSeed, ownCards: record.actorInformation.ownCards });
        assert.deepEqual(decision.action, record.chosenAction);
        assert.deepEqual(decision.deterministicMetadata, record.deterministicMetadata);
      }
      controller.reset(); assert.equal(controller.getSnapshot().botDecisionJournal, null);
    }
  }
});

function replayStateBefore(source, record) {
  return reconstructCanonicalHandReplaySource(source).frames[record.replayReference.replayEventSequence - 1].state;
}

test('language is parameter-backed, descriptive, locale-complete and never creates range or personal authority', () => {
  const configuration = createSyntheticConfiguration();
  const facts = createOpponentPolicyLanguageFacts(configuration);
  assert.equal(facts.claimClass, 'factual');
  assert.equal(facts.subject.role, 'synthetic_opponent_policy');
  assert.equal(facts.permission, null);
  assert.equal(facts.facts.configuration.normativeAssessment, false);
  assert.equal(facts.facts.configuration.quantitativeRangeResponse, 'unavailable_no_combo_likelihood_contract');
  for (const locale of ['en', 'ru', 'he']) {
    assert.deepEqual(Object.keys(OPPONENT_POLICY_COPY[locale]).sort(), Object.keys(OPPONENT_POLICY_COPY.en).sort());
    const text = describeOpponentPolicy(configuration, locale);
    assert.ok(text.includes('90')); assert.ok(!text.includes('{'));
    if (locale !== 'en') assert.notEqual(text, describeOpponentPolicy(configuration, 'en'));
    if (locale === 'he') assert.ok(text.includes('\u2066'));
  }
});

test('500bb always-raise practice completes beyond the old baseline transition cap', () => {
  const parameters = { smallPriceCallPercent: 100, largePriceCallPercent: 100, freeAggressionPercent: 100, facingRaisePercent: 100 };
  const progression = createAutomatedHandProgression({ initialConfiguration: configuration(3, 500000),
    heroPlayerId: 'P0', handSeed: 43, opponentPractice: request(parameters, 3) });
  let result = progression.advanceUntilHeroOrTerminal(); let answers = 0;
  while (result.status === 'hero_decision' && answers++ < 600) {
    const legal = getLegalActionSpec(result.state);
    progression.applyHeroAction(createAction('P0', legal.fold.available ? 'fold' : 'check'));
    result = progression.advanceUntilHeroOrTerminal();
  }
  assert.equal(result.status, 'terminal', JSON.stringify(result.error));
  assert.ok(result.automatedTransitionCount > 256);
});

test('extreme parameters retain exact small/large-price and unavailable-raise semantics', () => {
  const parameters = { smallPriceCallPercent: 100, largePriceCallPercent: 0, freeAggressionPercent: 0, facingRaisePercent: 0 };
  const policy = createSyntheticOpponentPolicy(createSyntheticConfiguration(parameters));
  const small = choose(dealt(), policy);
  assert.equal(small.action.type, 'call'); assert.equal(small.selectionMetadata.reason, 'small_call_price');
  const large = applyAction(dealt(), createAction('P0', 'raise', 10000));
  assert.equal(choose(large, policy).action.type, 'fold');
  const allIn = applyAction(dealt(), createAction('P0', 'all_in'));
  const caller = createSyntheticOpponentPolicy(createSyntheticConfiguration({ ...parameters, largePriceCallPercent: 100, facingRaisePercent: 100 }));
  const call = choose(allIn, caller);
  assert.equal(call.action.type, 'call');
  assert.deepEqual(call.selectionMetadata.weights, [{ type: 'fold', weight: 0 }, { type: 'call', weight: 10000 }]);
  assert.throws(() => validateOpponentPracticeRequest({ ...request(), configuration: undefined }), /parameters/);
  assert.throws(() => validateOpponentPracticeRequest({ ...request(), configuration: { ...request().configuration, parameters: undefined } }), /parameters/);
});
