import {
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  applyChance,
  createAction,
  getLegalActionSpec,
  initializeHand,
} from '../../shared/poker-domain/index.js';

export const PRIVATE_CARDS = Object.freeze({
  P0: Object.freeze(['As', 'Ah']),
  P1: Object.freeze(['Ks', 'Kh']),
});

export function initialCanonicalState() {
  const initialized = initializeHand({
    handId: 'solver-001-parity',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'P0', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'P1', seat: 1, startingStackMilliBb: 100_000 },
    ],
  });
  return applyChance(initialized, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: PRIVATE_CARDS,
  });
}

export function replayCanonical(actions) {
  return actions.reduce((state, action) => applyAction(
    state,
    createAction(state.actingPlayerId, action.type, action.amountToMilliBb),
  ), initialCanonicalState());
}

function canonicalLegalFamilies(state) {
  if (state.phase !== PHASES.BETTING) return [];
  const spec = getLegalActionSpec(state);
  return ['fold', 'check', 'call', 'bet', 'raise', 'all_in'].filter((family) => (
    family === 'all_in' ? spec.allIn.available : spec[family].available
  ));
}

export function canonicalParitySnapshot(state) {
  const preflopClosed = state.phase === PHASES.CHANCE
    && state.street === 'preflop'
    && state.pendingChance?.type === CHANCE_TYPES.DEAL_FLOP;
  return {
    actor: state.actingPlayerId,
    potMilliBb: state.potMilliBb,
    stacksMilliBb: state.players.map((player) => player.currentStackMilliBb),
    contributionsMilliBb: state.players.map((player) => player.totalPotContributionMilliBb),
    currentBetMilliBb: state.currentBetMilliBb,
    boundaryStatus: state.terminal.isTerminal ? 'fold_terminal'
      : preflopClosed ? 'preflop_closed' : 'decision',
    terminal: state.terminal.isTerminal,
    terminalReason: state.terminal.reason,
    legalFamilies: canonicalLegalFamilies(state),
    phase: state.phase,
  };
}

