import {
  CHANCE_TYPES,
  applyAction as applyPokerAction,
  applyChance as applyPokerChance,
  applyPrivateReveal as applyPokerPrivateReveal,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
  initializeRecordedHand,
  applyRecordedSettlement,
  resolveShowdown as resolvePokerShowdown,
} from '../../../shared/poker-domain/index.js';
import {
  REPLAY_FRAME_OPERATIONS,
} from './canonical-hand-replay-source.mjs';
import { createCanonicalHandLifecycleRecorder } from './canonical-hand-lifecycle.mjs';

function requireState(state) {
  if (state === null) throw new RangeError('CanonicalHandSession is not initialized');
  return state;
}

export function createCanonicalHandSession(initialConfiguration) {
  let state = null;
  const lifecycle = createCanonicalHandLifecycleRecorder();

  const replaceState = (nextState, previousState, operation) => {
    lifecycle.recordTransition({ previousState, state: nextState, operation });
    state = nextState;
    return state;
  };

  const session = {
    getState() {
      return state;
    },

    initialize(configuration) {
      const nextState = initializeHand(configuration);
      lifecycle.start(nextState);
      state = nextState;
      return state;
    },

    initializeFromGameRulesSnapshot(configuration) {
      const nextState = initializeHandFromGameRulesSnapshot(configuration);
      lifecycle.start(nextState);
      state = nextState;
      return state;
    },

    configureHero(options) {
      return lifecycle.configureHero(requireState(state), options);
    },

    initializeRecordedHand(configuration) {
      const nextState = initializeRecordedHand(configuration);
      lifecycle.start(nextState);
      state = nextState;
      return state;
    },

    applyRecordedSettlement(evidence) {
      const previousState = requireState(state);
      const nextState = applyRecordedSettlement(previousState, evidence);
      return replaceState(nextState, previousState, REPLAY_FRAME_OPERATIONS.RECORDED_SETTLEMENT);
    },

    captureCurrentHeroDecision() {
      return lifecycle.captureCurrentHeroDecision(requireState(state));
    },

    applyChance(chanceEvent) {
      const previousState = requireState(state);
      lifecycle.captureCurrentHeroDecision(previousState);
      const nextState = applyPokerChance(previousState, chanceEvent);
      const operation = chanceEvent?.type === CHANCE_TYPES.DEAL_HOLE
        ? ((chanceEvent.hiddenPlayerIds?.length ?? 0) > 0
          ? REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED
          : REPLAY_FRAME_OPERATIONS.DEAL_HOLE)
        : REPLAY_FRAME_OPERATIONS.DEAL_BOARD;
      return replaceState(nextState, previousState, operation);
    },

    applyAction(action) {
      const previousState = requireState(state);
      lifecycle.captureCurrentHeroDecision(previousState);
      const nextState = applyPokerAction(previousState, action);
      return replaceState(nextState, previousState, REPLAY_FRAME_OPERATIONS.ACTION);
    },

    revealPrivateCards(revealEvent) {
      const previousState = requireState(state);
      const nextState = applyPokerPrivateReveal(previousState, revealEvent);
      return replaceState(nextState, previousState, REPLAY_FRAME_OPERATIONS.REVEAL_HOLE);
    },

    resolveShowdown() {
      const previousState = requireState(state);
      const nextState = resolvePokerShowdown(previousState);
      return replaceState(nextState, previousState, REPLAY_FRAME_OPERATIONS.SHOWDOWN);
    },

    getHeroDecisionJournal() {
      return state === null ? null : lifecycle.getHeroDecisionJournal(state);
    },

    evaluateHeroDecision(options) {
      return lifecycle.evaluateHeroDecision(requireState(state), options);
    },

    attachHeroDecisionEvaluation(options) {
      return lifecycle.attachHeroDecisionEvaluation(requireState(state), options);
    },

    createCanonicalHandReplaySource() {
      return lifecycle.createCanonicalHandReplaySource();
    },

    getCompletedHandResult() {
      return lifecycle.getCompletedHandResult();
    },

    reset(configuration) {
      state = null;
      lifecycle.reset();
      if (configuration !== undefined) return session.initialize(configuration);
      return state;
    },
  };

  Object.freeze(session);
  if (initialConfiguration !== undefined) session.initialize(initialConfiguration);
  return session;
}
