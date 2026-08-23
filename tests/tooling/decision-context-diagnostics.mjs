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
} from '../../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from '../../app/src/application/decision-context-from-poker-state.mjs';
import {
  createPlaybookScenarioInput,
  deriveDecisionContextFromPlaybookScenario,
} from '../../app/src/application/playbook-state-source.mjs';

export const DECISION_CONTEXT_DIAGNOSTICS_SCHEMA_VERSION =
  'riverline-decision-context-diagnostics/v1';

const HOLE_CARDS = Object.freeze([
  ['As', 'Ad'], ['Kh', 'Kd'], ['Qh', 'Qd'], ['Jh', 'Jd'], ['Th', 'Td'],
  ['9h', '9d'], ['8h', '8d'], ['7h', '7d'], ['6h', '6d'], ['5h', '5d'],
]);
const FLOP = Object.freeze(['2c', '3d', '4s']);

function createDealtState({
  playerCount = 2,
  stacksMilliBb = Array(playerCount).fill(100_000),
} = {}) {
  const initialized = initializeHand({
    handId: 'decision-context-diagnostics',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
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

function project(state) {
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId);
}

function dealFlop(state) {
  if (state.phase !== PHASES.CHANCE) throw new RangeError('Diagnostic state is not ready for flop');
  return applyChance(state, { type: CHANCE_TYPES.DEAL_FLOP, cards: FLOP });
}

function headsUpFlop() {
  let state = createDealtState();
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  return dealFlop(state);
}

function threeWayFlop() {
  let state = createDealtState({ playerCount: 3 });
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CALL);
  state = act(state, ACTION_TYPES.CHECK);
  return dealFlop(state);
}

function lossyFacingBetScenario() {
  return deriveDecisionContextFromPlaybookScenario(createPlaybookScenarioInput({
    tableSize: 2,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['As', 'Ad'],
    board: [...FLOP],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 275,
    lastAction: 'bet',
    lastActionLabel: 'Bet',
    facingSizeBb: 2,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  }));
}

function diagnostic(id, label, decisionContext) {
  return Object.freeze({
    id,
    label,
    evidence: decisionContext.derivation.source,
    facts: Object.freeze({
      startingStackBb: decisionContext.startingStackBb,
      heroStackBb: decisionContext.heroStackBb,
      effectiveStackBb: decisionContext.effectiveStackBb,
      effectiveStackByOpponent: structuredClone(decisionContext.effectiveStackByOpponent),
      positionRelation: decisionContext.positionRelation,
      aggressorPositionRelation: decisionContext.aggressorPositionRelation,
      potBb: decisionContext.potBb,
      currentPotBb: decisionContext.currentPotBb,
      callAmountBb: decisionContext.callAmountBb,
      canRaise: decisionContext.canRaise,
      minRaiseToBb: decisionContext.minRaiseToBb,
      maxRaiseToBb: decisionContext.maxRaiseToBb,
      allInToBb: decisionContext.allInToBb,
      priorActionSummary: structuredClone(decisionContext.priorActionSummary),
    }),
    derivation: structuredClone(decisionContext.derivation),
  });
}

export function buildDecisionContextDiagnostics() {
  const fixtures = [];

  fixtures.push(diagnostic(
    'hu_100_unopened',
    'HU 100bb unopened',
    project(createDealtState()),
  ));
  fixtures.push(diagnostic(
    'six_max_unopened',
    '6-max unopened',
    project(createDealtState({ playerCount: 6 })),
  ));

  let limped = createDealtState({ playerCount: 3 });
  limped = act(limped, ACTION_TYPES.CALL);
  limped = act(limped, ACTION_TYPES.CALL);
  fixtures.push(diagnostic('limped_pot', 'Limped pot', project(limped)));

  let facingOpen = createDealtState();
  facingOpen = act(facingOpen, ACTION_TYPES.RAISE, 2500);
  fixtures.push(diagnostic('facing_open', 'Facing open', project(facingOpen)));

  let facingThreeBet = facingOpen;
  facingThreeBet = act(facingThreeBet, ACTION_TYPES.RAISE, 8000);
  fixtures.push(diagnostic('facing_3bet', 'Facing 3-bet', project(facingThreeBet)));

  let ip = headsUpFlop();
  const oop = ip;
  ip = act(ip, ACTION_TYPES.CHECK);
  fixtures.push(diagnostic('postflop_hu_ip', 'Postflop HU IP', project(ip)));
  fixtures.push(diagnostic('postflop_hu_oop', 'Postflop HU OOP', project(oop)));

  let mixed = threeWayFlop();
  mixed = act(mixed, ACTION_TYPES.CHECK);
  fixtures.push(diagnostic(
    'postflop_multiway_mixed',
    'Postflop multiway mixed position',
    project(mixed),
  ));

  fixtures.push(diagnostic(
    'short_stack_legal_all_in',
    'Short-stack legal all-in',
    project(createDealtState({ stacksMilliBb: [1500, 100_000] })),
  ));
  fixtures.push(diagnostic(
    'scenario_missing_exact_call_price',
    'Scenario with missing exact call price',
    lossyFacingBetScenario(),
  ));

  let exactCall = headsUpFlop();
  exactCall = act(exactCall, ACTION_TYPES.BET, 2000);
  fixtures.push(diagnostic(
    'canonical_hand_exact_call_price',
    'Canonical Hand with exact call price',
    project(exactCall),
  ));

  return Object.freeze({
    schemaVersion: DECISION_CONTEXT_DIAGNOSTICS_SCHEMA_VERSION,
    scope: 'context_fact_diagnostics_not_strategy_truth',
    potFieldSemantics: Object.freeze({
      potBb: 'legacy_compatibility_projection',
      currentPotBb: 'v1.1_current_pot_fact',
    }),
    fixtures: Object.freeze(fixtures),
  });
}
