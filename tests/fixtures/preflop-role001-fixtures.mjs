import {
  ACTION_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  initializeHandFromGameRulesSnapshot,
} from '../../shared/poker-domain/index.js';

const GAME = Object.freeze({
  mode: GAME_MODES.HOME,
  smallBlindMilliBb: 500,
  bigBlindMilliBb: 1000,
  chipUnitMilliBb: 100,
  ante: { type: 'none', amountMilliBb: 0 },
});

const HOLE_CARDS = Object.freeze({
  P0: ['As', 'Kd'],
  P1: ['Qs', 'Jd'],
  P2: ['Ts', '9d'],
  P3: ['8s', '7d'],
  P4: ['6s', '5d'],
  P5: ['4s', '3d'],
});

function dealtState(id) {
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration(GAME, 6);
  const state = initializeHandFromGameRulesSnapshot({
    handId: `preflop-role001-${id}`,
    rulesSnapshot,
    buttonSeat: 5,
    players: Array.from({ length: 6 }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb: 100_000,
    })),
  });
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: HOLE_CARDS,
  });
}

function actingPosition(state) {
  return state.players.find((player) => player.playerId === state.actingPlayerId)?.position;
}

function act(state, expectedPosition, type, amountToBb = null) {
  const actualPosition = actingPosition(state);
  if (actualPosition !== expectedPosition) {
    throw new RangeError(`Expected ${expectedPosition} to act, received ${actualPosition}`);
  }
  return applyAction(
    state,
    createAction(
      state.actingPlayerId,
      type,
      amountToBb === null ? null : amountToBb * 1000,
    ),
  );
}

function foldTo(state, targetPosition) {
  let next = state;
  let guard = 0;
  while (actingPosition(next) !== targetPosition) {
    next = act(next, actingPosition(next), ACTION_TYPES.FOLD);
    guard += 1;
    if (guard > 6 || next.terminal.isTerminal) {
      throw new RangeError(`Could not reach ${targetPosition}`);
    }
  }
  return next;
}

function rfi() {
  return dealtState('rfi');
}

function bbVersusButtonOpen() {
  let state = foldTo(dealtState('bb-vs-btn-open'), 'BTN');
  state = act(state, 'BTN', ACTION_TYPES.RAISE, 2.5);
  return act(state, 'SB', ACTION_TYPES.FOLD);
}

function bbVersusSmallBlindOpen() {
  let state = foldTo(dealtState('bb-vs-sb-open'), 'SB');
  return act(state, 'SB', ACTION_TYPES.RAISE, 3.5);
}

function openerFacingThreeBet() {
  let state = foldTo(dealtState('opener-facing-three-bet'), 'BTN');
  state = act(state, 'BTN', ACTION_TYPES.RAISE, 2.5);
  state = act(state, 'SB', ACTION_TYPES.FOLD);
  return act(state, 'BB', ACTION_TYPES.RAISE, 11);
}

function coldThreeBetOpportunity() {
  return act(dealtState('cold-three-bet-opportunity'), 'UTG', ACTION_TYPES.RAISE, 2.5);
}

function openerFacingColdFourBet() {
  let state = foldTo(dealtState('opener-facing-cold-four-bet'), 'BTN');
  state = act(state, 'BTN', ACTION_TYPES.RAISE, 2.5);
  state = act(state, 'SB', ACTION_TYPES.RAISE, 11);
  return act(state, 'BB', ACTION_TYPES.RAISE, 24);
}

function threeBettorFacingOrdinaryFourBet() {
  let state = foldTo(dealtState('three-bettor-facing-four-bet'), 'BTN');
  state = act(state, 'BTN', ACTION_TYPES.RAISE, 2.5);
  state = act(state, 'SB', ACTION_TYPES.FOLD);
  state = act(state, 'BB', ACTION_TYPES.RAISE, 11);
  return act(state, 'BTN', ACTION_TYPES.RAISE, 24);
}

function coldFourBetOpportunity() {
  let state = foldTo(dealtState('cold-four-bet-opportunity'), 'BTN');
  state = act(state, 'BTN', ACTION_TYPES.RAISE, 2.5);
  return act(state, 'SB', ACTION_TYPES.RAISE, 11);
}

function oneLimpIsolationOpportunity() {
  return act(dealtState('one-limp-isolation'), 'UTG', ACTION_TYPES.CALL);
}

function limperFacingIsolation() {
  let state = foldTo(dealtState('limper-facing-isolation'), 'SB');
  state = act(state, 'SB', ACTION_TYPES.CALL);
  return act(state, 'BB', ACTION_TYPES.RAISE, 3.5);
}

function multipleLimpers() {
  let state = act(dealtState('multiple-limpers'), 'UTG', ACTION_TYPES.CALL);
  return act(state, 'HJ', ACTION_TYPES.CALL);
}

function bbOptionAfterLimps() {
  let state = act(dealtState('bb-option-after-limps'), 'UTG', ACTION_TYPES.CALL);
  state = act(state, 'HJ', ACTION_TYPES.FOLD);
  state = act(state, 'CO', ACTION_TYPES.FOLD);
  state = act(state, 'BTN', ACTION_TYPES.FOLD);
  return act(state, 'SB', ACTION_TYPES.FOLD);
}

export function canonicalPreflopActionHistory(state) {
  return state.actionHistory.map((record) => ({
    actorPosition: state.players.find((player) => player.playerId === record.playerId)?.position,
    actionType: record.submittedAction.type,
    amountToBb: Number.isFinite(record.submittedAction.amountToMilliBb)
      ? record.submittedAction.amountToMilliBb / 1000
      : null,
  }));
}

export function createPreflopRoleAuditFixtures() {
  return Object.freeze({
    rfi: rfi(),
    bbVsButtonOpen: bbVersusButtonOpen(),
    bbVsSmallBlindOpen: bbVersusSmallBlindOpen(),
    openerFacingThreeBet: openerFacingThreeBet(),
    coldThreeBetOpportunity: coldThreeBetOpportunity(),
    openerFacingColdFourBet: openerFacingColdFourBet(),
    threeBettorFacingOrdinaryFourBet: threeBettorFacingOrdinaryFourBet(),
    coldFourBetOpportunity: coldFourBetOpportunity(),
    oneLimpIsolationOpportunity: oneLimpIsolationOpportunity(),
    limperFacingIsolation: limperFacingIsolation(),
    multipleLimpers: multipleLimpers(),
    bbOptionAfterLimps: bbOptionAfterLimps(),
  });
}

export function createReferenceBenchmarkRoleFixtures() {
  const fixtures = createPreflopRoleAuditFixtures();
  return Object.freeze({
    bbVsButtonOpen25: fixtures.bbVsButtonOpen,
    bbVsSmallBlindOpen35: fixtures.bbVsSmallBlindOpen,
    buttonOpenSmallBlindThreeBetBigBlindDecision: fixtures.coldFourBetOpportunity,
    buttonOpenSmallBlindThreeBetBigBlindColdFourBetButtonDecision:
      fixtures.openerFacingColdFourBet,
    smallBlindLimpBigBlindIsolateSmallBlindDecision: fixtures.limperFacingIsolation,
  });
}
