import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  applyChance,
  createAction,
  initializeHand,
} from '../shared/poker-domain/index.js';
import {
  DECISION_CONTEXT_CONTRACT_VERSION,
  deriveDecisionContextFromPokerState,
} from '../app/src/application/decision-context-from-poker-state.mjs';
import {
  createPlaybookScenarioInput,
  deriveDecisionContextFromPlaybookScenario,
} from '../app/src/application/playbook-state-source.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import {
  SAVED_SPOT_DERIVATIONS,
  createSavedSpotSnapshot,
} from '../app/src/saved-study-objects/index.mjs';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const FLOP = Object.freeze(['2c', '3d', '4s']);

function createDealtState({
  playerCount = 2,
  stacksMilliBb = Array(playerCount).fill(100_000),
  buttonSeat = 0,
} = {}) {
  const initialized = initializeHand({
    handId: 'decision-context-001a',
    game: {
      mode: GAME_MODES.HOME,
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
  return applyAction(state, createAction(state.actingPlayerId, type, amountToMilliBb));
}

function context(state) {
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId);
}

function canonicalStateWithPotBb(potBb) {
  let state = createDealtState({ stacksMilliBb: [500_000, 500_000] });
  state = act(state, ACTION_TYPES.RAISE, (potBb - 1) * 1000);
  assert.equal(state.potMilliBb / 1000, potBb);
  return state;
}

function dealFlop(state) {
  assert.equal(state.phase, PHASES.CHANCE);
  return applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
}

function reachHeadsUpFlop() {
  let state = createDealtState();
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  return dealFlop(state);
}

function reachThreeWayFlop() {
  let state = createDealtState({ playerCount: 3 });
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  return dealFlop(state);
}

function scenario(overrides = {}) {
  return createPlaybookScenarioInput({
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'preflop',
    heroCards: ['As', 'Kd'],
    board: [],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 1.5,
    lastAction: 'unopened',
    lastActionLabel: 'Unopened',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
    ...overrides,
  });
}

function withoutV11Fields(value) {
  const omitted = new Set([
    'contractVersion',
    'startingStackBb',
    'heroStackBb',
    'effectiveStackBb',
    'effectiveStackByOpponent',
    'positionRelation',
    'aggressorPositionRelation',
    'currentPotBb',
    'priorActionSummary',
    'canRaise',
    'minRaiseToBb',
    'maxRaiseToBb',
    'allInToBb',
    'derivation',
  ]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

function strategyProvider() {
  return createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
}

test('v1.1 is additive and legacy v1 provider/saved readers remain compatible', () => {
  const extended = deriveDecisionContextFromPlaybookScenario(scenario());
  const legacy = withoutV11Fields(extended);
  const provider = strategyProvider();
  assert.equal(extended.schemaVersion, 'decision-context/v1');
  assert.equal(extended.contractVersion, DECISION_CONTEXT_CONTRACT_VERSION);
  assert.deepEqual(provider.resolve(extended), provider.resolve(legacy));

  const legacySnapshot = createSavedSpotSnapshot({
    derivation: SAVED_SPOT_DERIVATIONS.SCENARIO,
    decisionContext: legacy,
    scenarioInput: scenario(),
  });
  const extendedSnapshot = createSavedSpotSnapshot({
    derivation: SAVED_SPOT_DERIVATIONS.SCENARIO,
    decisionContext: extended,
    scenarioInput: scenario(),
  });
  assert.equal(legacySnapshot.decisionContext.contractVersion, undefined);
  assert.equal(extendedSnapshot.decisionContext.contractVersion, DECISION_CONTEXT_CONTRACT_VERSION);
});

test('configured, starting, live, and HU effective stacks stay distinct', () => {
  const projected = context(createDealtState({ stacksMilliBb: [600_000, 80_000] }));
  assert.equal(projected.stackBb, 500, 'legacy configured depth remains clamped');
  assert.equal(projected.startingStackBb, 600);
  assert.equal(projected.heroStackBb, 599.5);
  assert.equal(projected.effectiveStackBb, 79);
  assert.deepEqual(projected.effectiveStackByOpponent, [{
    position: 'BB', opponentStackBb: 79, effectiveStackBb: 79,
  }]);
  assert.deepEqual(
    projected.derivation.events.find((event) => event.field === 'stackBb'),
    {
      field: 'stackBb', quality: 'clamped', code: 'supported_range_clamp',
      rawValue: 600, value: 500,
    },
  );
});

test('current pot remains exact while legacy pot compatibility clamps independently', () => {
  const canonicalForty = context(canonicalStateWithPotBb(40));
  assert.equal(canonicalForty.currentPotBb, 40);
  assert.equal(canonicalForty.potBb, 40);
  assert.deepEqual(
    canonicalForty.derivation.events.find((event) => event.field === 'currentPotBb'),
    {
      field: 'currentPotBb', quality: 'exact', code: 'canonical_current_pot', value: 40,
    },
  );

  const canonicalDeep = context(canonicalStateWithPotBb(275));
  assert.equal(canonicalDeep.currentPotBb, 275);
  assert.equal(canonicalDeep.potBb, 200);
  assert.ok(canonicalDeep.derivation.events.some((event) => (
    event.field === 'potBb'
      && event.quality === 'clamped'
      && event.rawValue === 275
      && event.value === 200
  )));

  const explicitScenario = deriveDecisionContextFromPlaybookScenario(scenario({ potBb: 275 }));
  assert.equal(explicitScenario.currentPotBb, 275);
  assert.equal(explicitScenario.potBb, 200);
  assert.deepEqual(
    explicitScenario.derivation.events.find((event) => event.field === 'currentPotBb'),
    {
      field: 'currentPotBb', quality: 'exact',
      code: 'scenario_current_pot_explicit', value: 275,
    },
  );

  const parsedScenario = deriveDecisionContextFromPlaybookScenario(scenario({ potBb: '275' }));
  assert.equal(parsedScenario.currentPotBb, 275);
  assert.equal(parsedScenario.potBb, 200);
  assert.deepEqual(
    parsedScenario.derivation.events.find((event) => event.field === 'currentPotBb'),
    {
      field: 'currentPotBb', quality: 'normalized',
      code: 'scenario_current_pot_numeric_parse', rawValue: '275', value: 275,
    },
  );

  const missingScenario = deriveDecisionContextFromPlaybookScenario(scenario({ potBb: undefined }));
  assert.equal(missingScenario.currentPotBb, null);
  assert.equal(missingScenario.potBb, 1.5);
  assert.ok(missingScenario.derivation.events.some((event) => (
    event.field === 'currentPotBb'
      && event.quality === 'unavailable'
      && event.code === 'scenario_current_pot_unavailable'
  )));
  assert.ok(missingScenario.derivation.events.some((event) => (
    event.field === 'potBb' && event.quality === 'defaulted'
  )));

  assert.equal(JSON.stringify(canonicalDeep), JSON.stringify(
    context(canonicalStateWithPotBb(275)),
  ));
  assert.equal(JSON.stringify(explicitScenario), JSON.stringify(
    deriveDecisionContextFromPlaybookScenario(scenario({ potBb: 275 })),
  ));
});

test('multiway effective stack is per opponent and excludes folded players', () => {
  const multiway = context(createDealtState({
    playerCount: 3,
    stacksMilliBb: [100_000, 80_000, 40_000],
  }));
  assert.equal(multiway.effectiveStackBb, null);
  assert.equal(multiway.effectiveStackByOpponent.length, 2);
  assert.deepEqual(
    multiway.effectiveStackByOpponent.map((entry) => entry.position),
    ['SB', 'BB'],
  );
  assert.ok(multiway.derivation.events.some((event) => (
    event.field === 'effectiveStackBb'
      && event.code === 'multiway_effective_stack_scalar_ambiguous'
  )));

  let folded = createDealtState({ playerCount: 3 });
  folded = act(folded, ACTION_TYPES.FOLD);
  const afterFold = context(folded);
  assert.equal(afterFold.opponentCount, 1);
  assert.deepEqual(
    afterFold.effectiveStackByOpponent.map((entry) => entry.position),
    ['BB'],
  );
  assert.equal(afterFold.effectiveStackBb, 99);
});

test('postflop position relation covers HU IP/OOP, multiway mixed, and folded exclusion', () => {
  let headsUp = reachHeadsUpFlop();
  assert.equal(context(headsUp).heroPosition, 'BB');
  assert.equal(context(headsUp).positionRelation, 'out_of_position');
  headsUp = act(headsUp, ACTION_TYPES.CHECK);
  assert.equal(context(headsUp).heroPosition, 'BTN');
  assert.equal(context(headsUp).positionRelation, 'in_position');

  let threeWay = reachThreeWayFlop();
  threeWay = act(threeWay, ACTION_TYPES.CHECK);
  assert.equal(context(threeWay).heroPosition, 'BB');
  assert.equal(context(threeWay).positionRelation, 'mixed');

  let folded = createDealtState({ playerCount: 3 });
  folded = act(folded, ACTION_TYPES.FOLD);
  folded = act(folded, ACTION_TYPES.CALL);
  folded = act(folded, ACTION_TYPES.CHECK);
  folded = dealFlop(folded);
  folded = act(folded, ACTION_TYPES.CHECK);
  const foldedProjection = context(folded);
  assert.equal(foldedProjection.positionRelation, 'in_position');
  assert.deepEqual(
    foldedProjection.effectiveStackByOpponent.map((entry) => entry.position),
    ['SB'],
  );
  assert.equal(context(createDealtState()).positionRelation, 'not_applicable');
});

test('aggressor position relation comes from canonical postflop seat order', () => {
  let state = reachHeadsUpFlop();
  state = act(state, ACTION_TYPES.BET, 1000);
  const projected = context(state);
  assert.equal(projected.heroPosition, 'BTN');
  assert.equal(projected.priorActionSummary.aggressorPosition, 'BB');
  assert.equal(projected.aggressorPositionRelation, 'in_position');
});

test('canonical legal aggressive-to bounds cover unopened, facing raise, short all-in, and no-raise states', () => {
  const unopened = context(createDealtState());
  assert.deepEqual({
    call: unopened.callAmountBb,
    canRaise: unopened.canRaise,
    min: unopened.minRaiseToBb,
    max: unopened.maxRaiseToBb,
    allIn: unopened.allInToBb,
  }, { call: 0.5, canRaise: true, min: 2, max: 100, allIn: 100 });

  let facingOpen = createDealtState();
  facingOpen = act(facingOpen, ACTION_TYPES.RAISE, 2500);
  assert.deepEqual({
    call: context(facingOpen).callAmountBb,
    min: context(facingOpen).minRaiseToBb,
    max: context(facingOpen).maxRaiseToBb,
  }, { call: 1.5, min: 4, max: 100 });

  const shortAllIn = context(createDealtState({ stacksMilliBb: [1500, 100_000] }));
  assert.equal(shortAllIn.canRaise, true);
  assert.equal(shortAllIn.minRaiseToBb, null);
  assert.equal(shortAllIn.maxRaiseToBb, 1.5);
  assert.equal(shortAllIn.allInToBb, 1.5);
  assert.ok(shortAllIn.derivation.events.some((event) => (
    event.code === 'short_all_in_only_no_full_raise_minimum'
  )));

  let noRaise = createDealtState({ stacksMilliBb: [100_000, 2000] });
  noRaise = act(noRaise, ACTION_TYPES.RAISE, 2500);
  const noRaiseProjection = context(noRaise);
  assert.equal(noRaiseProjection.canRaise, false);
  assert.equal(noRaiseProjection.minRaiseToBb, null);
  assert.equal(noRaiseProjection.maxRaiseToBb, null);
  assert.equal(noRaiseProjection.allInToBb, 2);
  assert.equal(noRaiseProjection.callAmountBb, 1);
});

test('bounded prior-action summary preserves limp, call, aggressor, and raise depth', () => {
  let limped = createDealtState({ playerCount: 3 });
  limped = act(limped, ACTION_TYPES.CALL);
  limped = act(limped, ACTION_TYPES.CALL);
  const limpProjection = context(limped);
  assert.equal(limpProjection.lastAction, 'check', 'legacy field remains compatible');
  assert.deepEqual(limpProjection.priorActionSummary, {
    lastActionFamily: 'limp',
    lastActorPosition: 'SB',
    facingActionFamily: 'limp',
    aggressionFamily: 'none',
    aggressionCount: 0,
    limperCount: 2,
    aggressorPosition: null,
  });

  let threeBet = createDealtState();
  threeBet = act(threeBet, ACTION_TYPES.RAISE, 2500);
  assert.equal(context(threeBet).priorActionSummary.aggressionFamily, 'open');
  assert.equal(context(threeBet).priorActionSummary.aggressorPosition, 'BTN');
  threeBet = act(threeBet, ACTION_TYPES.RAISE, 8000);
  assert.equal(context(threeBet).priorActionSummary.aggressionFamily, 'three_bet');
  assert.equal(context(threeBet).priorActionSummary.aggressionCount, 2);
  assert.equal(context(threeBet).priorActionSummary.aggressorPosition, 'BB');

  let called = reachThreeWayFlop();
  called = act(called, ACTION_TYPES.BET, 1000);
  called = act(called, ACTION_TYPES.CALL);
  const callProjection = context(called);
  assert.equal(callProjection.priorActionSummary.lastActionFamily, 'call');
  assert.equal(callProjection.priorActionSummary.facingActionFamily, 'bet');
  assert.notEqual(callProjection.priorActionSummary.lastActionFamily, 'limp');
});

test('Scenario preserves missing exact price, live facts, position, and legal bounds as unavailable', () => {
  const projected = deriveDecisionContextFromPlaybookScenario(scenario({
    board: ['2c', '3d', '4s'],
    street: 'flop',
    lastAction: 'bet',
    lastActionLabel: 'Bet',
    facingSizeBb: 5,
  }));
  assert.equal(projected.callAmountBb, null);
  assert.equal(projected.heroStackBb, null);
  assert.equal(projected.effectiveStackBb, null);
  assert.deepEqual(projected.effectiveStackByOpponent, []);
  assert.equal(projected.positionRelation, 'unknown');
  assert.equal(projected.canRaise, null);
  assert.equal(projected.minRaiseToBb, null);
  assert.equal(projected.maxRaiseToBb, null);
  assert.equal(projected.allInToBb, null);
  assert.equal(projected.priorActionSummary.aggressorPosition, null);
  assert.ok(projected.derivation.events.some((event) => (
    event.field === 'callAmountBb'
      && event.code === 'scenario_exact_call_price_unavailable'
  )));
});

test('Scenario explicit call remains call and is never fabricated as limp', () => {
  const projected = deriveDecisionContextFromPlaybookScenario(scenario({
    lastAction: 'call',
    lastActionLabel: 'Call',
  }));
  assert.equal(projected.priorActionSummary.lastActionFamily, 'call');
  assert.equal(projected.priorActionSummary.facingActionFamily, 'call');
  assert.equal(projected.priorActionSummary.limperCount, null);
  assert.equal(projected.callAmountBb, null);
});

test('provenance records defaults/clamps and serialization is deterministic', () => {
  const lossy = deriveDecisionContextFromPlaybookScenario(scenario({
    tableSize: 99,
    heroPosition: '',
    stackBb: -20,
    stackMode: '',
    potBb: Number.NaN,
    lastAction: '',
    facingSizeBb: 999,
  }));
  const eventsByField = new Map(lossy.derivation.events.map((event) => [event.field, event]));
  assert.equal(eventsByField.get('tableSize').quality, 'clamped');
  assert.equal(eventsByField.get('heroPosition').quality, 'defaulted');
  assert.equal(eventsByField.get('stackBb').quality, 'clamped');
  assert.equal(eventsByField.get('startingStackBb').quality, 'clamped');
  assert.equal(
    eventsByField.get('startingStackBb').code,
    'scenario_configured_stack_supported_range_clamp',
  );
  assert.equal(eventsByField.get('stackMode').quality, 'defaulted');
  assert.equal(eventsByField.get('potBb').quality, 'defaulted');
  assert.equal(eventsByField.get('currentPotBb').quality, 'unavailable');
  assert.ok(lossy.derivation.events.some((event) => (
    event.field === 'facingSizeBb' && event.quality === 'clamped'
  )));
  assert.ok(lossy.derivation.events.some((event) => (
    event.field === 'facingSizeBb' && event.code === 'unopened_facing_size_zeroed'
  )));

  const state = createDealtState();
  assert.equal(JSON.stringify(context(state)), JSON.stringify(context(state)));
  assert.equal(JSON.stringify(lossy), JSON.stringify(
    deriveDecisionContextFromPlaybookScenario(scenario({
      tableSize: 99,
      heroPosition: '',
      stackBb: -20,
      stackMode: '',
      potBb: Number.NaN,
      lastAction: '',
      facingSizeBb: 999,
    })),
  ));
});

test('existing heuristic probabilities remain unchanged when v1.1 fields are ignored', () => {
  const provider = strategyProvider();
  const preflop = context(createDealtState());
  assert.deepEqual(provider.resolve(preflop), provider.resolve(withoutV11Fields(preflop)));

  let postflop = reachHeadsUpFlop();
  postflop = act(postflop, ACTION_TYPES.CHECK);
  const postflopContext = context(postflop);
  assert.deepEqual(
    provider.resolve(postflopContext),
    provider.resolve(withoutV11Fields(postflopContext)),
  );
});
