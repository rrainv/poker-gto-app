import {
  applyAction as applyPokerAction,
  applyChance as applyPokerChance,
  initializeHand,
} from '../../../shared/poker-domain/index.js';

function requireState(state) {
  if (state === null) throw new RangeError('CanonicalHandSession is not initialized');
  return state;
}

export function createCanonicalHandSession(initialConfiguration) {
  let state = null;

  const session = {
    getState() {
      return state;
    },

    initialize(configuration) {
      const nextState = initializeHand(configuration);
      state = nextState;
      return state;
    },

    applyChance(chanceEvent) {
      const nextState = applyPokerChance(requireState(state), chanceEvent);
      state = nextState;
      return state;
    },

    applyAction(action) {
      const nextState = applyPokerAction(requireState(state), action);
      state = nextState;
      return state;
    },

    reset(configuration) {
      state = null;
      if (configuration !== undefined) return session.initialize(configuration);
      return state;
    },
  };

  Object.freeze(session);
  if (initialConfiguration !== undefined) session.initialize(initialConfiguration);
  return session;
}
