import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  PHASES,
  assertCardArray,
  assertUniqueKnownCards,
  bbToMilliBb,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
} from '../../../shared/poker-domain/index.js';
import { createCanonicalHandSession } from './canonical-hand-session.mjs';

export const CANONICAL_LIVE_DEFAULT_ENABLED = false;

const SUPPORTED_ACTIONS = Object.freeze(new Set(Object.values(ACTION_TYPES)));
const SUPPORTED_STACK_MODES = Object.freeze(new Set(['hero', 'effective', 'custom']));
let liveHandSequence = 0;

function defaultLiveHandIdFactory() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `canonical-hand-${uuid}`;
  liveHandSequence += 1;
  return `canonical-hand-${Date.now().toString(36)}-${liveHandSequence.toString(36)}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function diagnostic(status, details = {}) {
  return deepFreeze({
    status,
    reason: null,
    matches: null,
    comparison: null,
    error: null,
    ...details,
  });
}

function serializedError(error) {
  return deepFreeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  });
}

function requireInteger(value, minimum, maximum, label) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} through ${maximum}`);
  }
  return numeric;
}

function normalizeConfiguration(configuration, handIdFactory) {
  if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
    throw new TypeError('Canonical Playbook configuration is required');
  }

  const tableSize = requireInteger(configuration.tableSize, 2, 10, 'tableSize');
  const handId = configuration.handId ?? handIdFactory();
  if (typeof handId !== 'string' || !handId.trim()) {
    throw new TypeError('handId must be a non-empty string');
  }
  const gameMode = configuration.gameMode ?? GAME_MODES.HOME;

  const hasHeroSeat = configuration.heroSeat !== undefined
    && configuration.heroSeat !== null
    && configuration.heroSeat !== '';
  const heroSeat = hasHeroSeat
    ? requireInteger(configuration.heroSeat, 0, tableSize - 1, 'heroSeat')
    : null;
  const heroPosition = typeof configuration.heroPosition === 'string'
    && configuration.heroPosition
    ? configuration.heroPosition
    : null;
  if (heroSeat === null && heroPosition === null) {
    throw new TypeError('heroSeat or heroPosition is required');
  }
  const stackMode = configuration.stackMode ?? 'hero';
  if (!SUPPORTED_STACK_MODES.has(stackMode)) {
    throw new RangeError(`Unsupported stackMode: ${stackMode}`);
  }

  const startingStackMilliBb = bbToMilliBb(Number(configuration.stackBb), 'stackBb');
  if (startingStackMilliBb === 0) throw new RangeError('stackBb must be positive');

  const anteType = configuration.anteType ?? ANTE_TYPES.NONE;
  if (!Object.values(ANTE_TYPES).includes(anteType)) {
    throw new RangeError(`Unsupported anteType: ${anteType}`);
  }
  const anteMilliBb = bbToMilliBb(Number(configuration.anteBb ?? 0), 'anteBb');
  if (anteType === ANTE_TYPES.NONE && anteMilliBb !== 0) {
    throw new RangeError('anteBb must be zero when anteType is none');
  }
  if (anteType !== ANTE_TYPES.NONE && anteMilliBb === 0) {
    throw new RangeError('A configured ante must be positive');
  }

  const straddleMilliBb = bbToMilliBb(Number(configuration.straddleBb ?? 0), 'straddleBb');
  if (straddleMilliBb !== 0) {
    throw new RangeError('Canonical Playbook sessions do not yet support straddles');
  }

  const buttonSeat = requireInteger(
    configuration.buttonSeat ?? 0,
    0,
    tableSize - 1,
    'buttonSeat',
  );
  const players = Array.from({ length: tableSize }, (_, seat) => ({
    playerId: `seat-${seat}`,
    seat,
    startingStackMilliBb,
  }));
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: gameMode,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: anteType, amountMilliBb: anteMilliBb },
  }, tableSize);
  const pokerConfiguration = {
    handId,
    rulesSnapshot,
    buttonSeat,
    players,
  };

  return {
    pokerConfiguration,
    projectionOptions: { stackMode },
    requestedHeroPosition: heroPosition,
    requestedHeroSeat: heroSeat,
  };
}

function validateStagedCards(cards) {
  const normalized = assertCardArray(cards, 'heroCards');
  if (normalized.length > 2) throw new RangeError('heroCards may contain at most two cards');
  assertUniqueKnownCards([{ label: 'heroCards', cards: normalized }]);
  return Object.freeze([...normalized]);
}

export function createCanonicalLiveController({
  enabled = CANONICAL_LIVE_DEFAULT_ENABLED,
  handIdFactory = defaultLiveHandIdFactory,
} = {}) {
  if (typeof handIdFactory !== 'function') throw new TypeError('handIdFactory must be a function');
  const session = createCanonicalHandSession();
  let featureEnabled = enabled === true;
  let heroPlayerId = null;
  let projectionOptions = Object.freeze({ stackMode: 'hero' });
  let stagedHeroCards = Object.freeze([]);
  let diagnostics = featureEnabled
    ? diagnostic('unavailable', { reason: 'session_not_initialized' })
    : diagnostic('disabled', { reason: 'feature_flag_off' });

  const setUnavailable = (reason) => {
    diagnostics = diagnostic('unavailable', { reason });
    return diagnostics;
  };

  const setError = (error) => {
    diagnostics = diagnostic('error', { error: serializedError(error) });
    return null;
  };

  const requireEnabledState = () => {
    if (!featureEnabled) {
      diagnostics = diagnostic('disabled', { reason: 'feature_flag_off' });
      return null;
    }
    const state = session.getState();
    if (!state) {
      setUnavailable('session_not_initialized');
      return null;
    }
    return state;
  };

  const controller = {
    isEnabled() {
      return featureEnabled;
    },

    setEnabled(nextEnabled) {
      featureEnabled = nextEnabled === true;
      if (!featureEnabled) {
        session.reset();
        heroPlayerId = null;
        stagedHeroCards = Object.freeze([]);
        diagnostics = diagnostic('disabled', { reason: 'feature_flag_off' });
      } else {
        diagnostics = diagnostic('unavailable', { reason: 'session_not_initialized' });
      }
      return diagnostics;
    },

    initialize(configuration) {
      if (!featureEnabled) {
        diagnostics = diagnostic('disabled', { reason: 'feature_flag_off' });
        return null;
      }

      session.reset();
      heroPlayerId = null;
      stagedHeroCards = Object.freeze([]);
      try {
        const normalized = normalizeConfiguration(configuration, handIdFactory);
        const state = session.initializeFromGameRulesSnapshot(normalized.pokerConfiguration);
        const hero = normalized.requestedHeroSeat === null
          ? state.players.find((player) => (
            player.position === normalized.requestedHeroPosition
          ))
          : state.players.find((player) => player.seat === normalized.requestedHeroSeat);
        if (!hero) {
          session.reset();
          throw new RangeError(
            normalized.requestedHeroSeat === null
              ? `heroPosition ${normalized.requestedHeroPosition} is invalid for ${state.players.length} players`
              : `heroSeat ${normalized.requestedHeroSeat} is invalid for ${state.players.length} players`,
          );
        }
        heroPlayerId = hero.playerId;
        projectionOptions = Object.freeze({ ...normalized.projectionOptions });
        session.configureHero({
          heroPlayerId,
          decisionContextOptions: projectionOptions,
        });
        setUnavailable('awaiting_hole_cards');
        return state;
      } catch (error) {
        session.reset();
        heroPlayerId = null;
        return setError(error);
      }
    },

    reset(configuration) {
      if (configuration !== undefined) return controller.initialize(configuration);
      session.reset();
      heroPlayerId = null;
      stagedHeroCards = Object.freeze([]);
      diagnostics = featureEnabled
        ? diagnostic('unavailable', { reason: 'session_not_initialized' })
        : diagnostic('disabled', { reason: 'feature_flag_off' });
      return null;
    },

    getState() {
      return session.getState();
    },

    getHeroPlayerId() {
      return heroPlayerId;
    },

    getStagedHeroCards() {
      return stagedHeroCards;
    },

    getProjectionOptions() {
      return projectionOptions;
    },

    getDiagnostics() {
      return diagnostics;
    },

    getHeroDecisionJournal() {
      return session.getHeroDecisionJournal();
    },

    evaluateHeroDecision(options) {
      try {
        return session.evaluateHeroDecision(options);
      } catch (error) {
        return setError(error);
      }
    },

    createCanonicalHandReplaySource() {
      try {
        return session.createCanonicalHandReplaySource();
      } catch (error) {
        return setError(error);
      }
    },

    getCompletedHandResult() {
      return session.getCompletedHandResult();
    },

    getLegalActions() {
      if (!featureEnabled || session.getState()?.phase !== PHASES.BETTING) return null;
      try {
        return getLegalActionSpec(session.getState());
      } catch (error) {
        return setError(error);
      }
    },

    setHeroHoleCards(cards) {
      const state = requireEnabledState();
      if (!state) return null;
      try {
        const nextHeroCards = validateStagedCards(cards);
        if (state.pendingChance?.type !== CHANCE_TYPES.DEAL_HOLE) {
          const dealtHeroCards = state.players.find(
            (player) => player.playerId === heroPlayerId,
          )?.holeCards;
          const isUnchanged = nextHeroCards.length === 2
            && dealtHeroCards?.every((card, index) => card === nextHeroCards[index]);
          if (!isUnchanged) {
            throw new RangeError('Hero hole cards cannot change after the canonical deal');
          }
        }
        stagedHeroCards = nextHeroCards;
        setUnavailable(stagedHeroCards.length === 2
          ? 'awaiting_complete_hole_deal'
          : 'awaiting_hero_hole_cards');
        return stagedHeroCards;
      } catch (error) {
        return setError(error);
      }
    },

    applyChance(chanceEvent) {
      if (!requireEnabledState()) return null;
      try {
        if (chanceEvent?.type === CHANCE_TYPES.DEAL_HOLE && stagedHeroCards.length === 2) {
          const suppliedHeroCards = chanceEvent.cardsByPlayer?.[heroPlayerId];
          if (!Array.isArray(suppliedHeroCards)
            || suppliedHeroCards.length !== 2
            || suppliedHeroCards.some((card, index) => card !== stagedHeroCards[index])) {
            throw new RangeError('Complete hole deal must match the staged hero cards');
          }
        }
        const state = session.applyChance(chanceEvent);
        setUnavailable(state.phase === PHASES.BETTING ? 'active_decision' : 'chance_state');
        return state;
      } catch (error) {
        return setError(error);
      }
    },

    dealHoleCards(cardsByPlayer) {
      return controller.applyChance({ type: CHANCE_TYPES.DEAL_HOLE, cardsByPlayer });
    },

    dealObservedHoleCards(cardsByPlayer) {
      const state = requireEnabledState();
      if (!state) return null;
      const knownCardsByPlayer = cardsByPlayer && typeof cardsByPlayer === 'object'
        && !Array.isArray(cardsByPlayer) ? cardsByPlayer : {};
      const hiddenPlayerIds = state.players
        .filter((player) => !Object.hasOwn(knownCardsByPlayer, player.playerId))
        .map((player) => player.playerId);
      return controller.applyChance({
        type: CHANCE_TYPES.DEAL_HOLE,
        cardsByPlayer: knownCardsByPlayer,
        hiddenPlayerIds,
      });
    },

    revealHoleCards(playerId, cards) {
      const state = requireEnabledState();
      if (!state) return null;
      try {
        const nextState = session.revealPrivateCards({ playerId, cards });
        setUnavailable(nextState.showdown.status === 'ready'
          ? 'showdown_ready'
          : nextState.phase === PHASES.BETTING ? 'comparison_pending' : 'awaiting_private_reveal');
        return nextState;
      } catch (error) {
        return setError(error);
      }
    },

    dealBoardCards(cards) {
      const state = requireEnabledState();
      if (!state) return null;
      if (state.phase !== PHASES.CHANCE || !state.pendingChance) {
        return setError(new RangeError('No canonical board chance event is pending'));
      }
      if (state.pendingChance.type === CHANCE_TYPES.DEAL_HOLE) {
        return setError(new RangeError('Complete hole cards must be dealt before board cards'));
      }
      return controller.applyChance({ type: state.pendingChance.type, cards });
    },

    applyAction({ type, amountToBb = null } = {}) {
      const state = requireEnabledState();
      if (!state) return null;
      try {
        if (!SUPPORTED_ACTIONS.has(type)) throw new RangeError(`Unsupported action type: ${type}`);
        const amountToMilliBb = amountToBb === null
          ? null
          : bbToMilliBb(Number(amountToBb), 'amountToBb');
        const action = createAction(state.actingPlayerId, type, amountToMilliBb);
        const nextState = session.applyAction(action);
        setUnavailable(nextState.phase === PHASES.BETTING
          ? 'active_decision'
          : nextState.phase === PHASES.TERMINAL ? 'terminal_state' : 'chance_state');
        return nextState;
      } catch (error) {
        return setError(error);
      }
    },

    resolveShowdown() {
      const state = requireEnabledState();
      if (!state) return null;
      if (state.showdown?.status === 'awaiting_private_reveal') {
        setUnavailable('awaiting_private_reveal');
        return null;
      }
      try {
        const nextState = session.resolveShowdown();
        setUnavailable('terminal_state');
        return nextState;
      } catch (error) {
        return setError(error);
      }
    },

  };

  return Object.freeze(controller);
}
