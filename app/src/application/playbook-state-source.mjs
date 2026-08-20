import {
  ANTE_TYPES,
  GAME_MODES,
  GAME_RULES_COLLECTION_TYPES,
  PHASES,
  POKER_STATE_V2_SCHEMA_VERSION,
  bbToMilliBb,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  playerById,
  validateGameRulesSnapshot,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from './decision-context-from-poker-state.mjs';

export const PLAYBOOK_MODES = Object.freeze({
  SCENARIO: 'scenario',
  HAND: 'hand',
});

export const PLAYBOOK_SCENARIO_V1_SCHEMA_VERSION = 'playbook-scenario/v1';
export const PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION = 'playbook-scenario/v2';
// Compatibility alias retained for existing v1 imports and historical fixtures.
export const PLAYBOOK_SCENARIO_SCHEMA_VERSION = PLAYBOOK_SCENARIO_V1_SCHEMA_VERSION;
export const PLAYBOOK_SCENARIO_SCHEMA_VERSIONS = Object.freeze([
  PLAYBOOK_SCENARIO_V1_SCHEMA_VERSION,
  PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
]);
export const PLAYBOOK_RESOLUTION_SCHEMA_VERSION = 'playbook-decision-resolution/v1';
export const PLAYBOOK_VIEW_MODEL_SCHEMA_VERSION = 'playbook-view-model/v1';

const LEGACY_SCENARIO_ACCOUNTING_MODES = Object.freeze(new Set(['off', 'fixed']));
const LEGACY_FIXED_COLLECTION_PER_PLAYER_BB = 0.1;
const NORMALIZED_SCENARIO_INPUTS = new WeakSet();
const SCENARIO_V2_KEYS = Object.freeze([
  'schemaVersion',
  'rulesSnapshot',
  'tableSize',
  'heroPosition',
  'street',
  'heroCards',
  'board',
  'deadCards',
  'stackBb',
  'stackMode',
  'potBb',
  'lastAction',
  'lastActionLabel',
  'facingSizeBb',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function serializedError(error) {
  return deepFreeze({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  });
}

function resolution(mode, status, details = {}) {
  return deepFreeze({
    schemaVersion: PLAYBOOK_RESOLUTION_SCHEMA_VERSION,
    mode,
    status,
    reason: null,
    decisionContext: null,
    error: null,
    ...details,
  });
}

function copyCards(cards) {
  return Array.isArray(cards) ? cards.filter(Boolean).slice() : [];
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    throw new RangeError(`${label} must contain exactly: ${wanted.join(', ')}`);
  }
}

function normalizedScenario(input) {
  const frozen = deepFreeze(input);
  NORMALIZED_SCENARIO_INPUTS.add(frozen);
  return frozen;
}

function createPlaybookScenarioV1(input) {
  return normalizedScenario({
    schemaVersion: PLAYBOOK_SCENARIO_V1_SCHEMA_VERSION,
    tableSize: input.tableSize,
    heroPosition: input.heroPosition,
    street: input.street,
    heroCards: copyCards(input.heroCards),
    board: copyCards(input.board),
    deadCards: copyCards(input.deadCards),
    stackBb: input.stackBb,
    stackMode: input.stackMode,
    potBb: input.potBb,
    lastAction: input.lastAction,
    lastActionLabel: input.lastActionLabel ?? null,
    facingSizeBb: input.facingSizeBb,
    rakeMode: input.rakeMode,
    forcedContributionPerPlayerBb: input.forcedContributionPerPlayerBb ?? 0,
    totalForcedContributionBb: input.totalForcedContributionBb ?? 0,
    anteBb: input.anteBb ?? 0,
    straddleBb: input.straddleBb ?? 0,
  });
}

function createPlaybookScenarioV2(input) {
  requireExactKeys(input, SCENARIO_V2_KEYS, 'PlaybookScenario v2');
  const rulesSnapshot = validateGameRulesSnapshot(input.rulesSnapshot);
  if (!Number.isInteger(input.tableSize) || input.tableSize !== rulesSnapshot.setup.seatedPlayers) {
    throw new RangeError('PlaybookScenario v2 tableSize must match GameRulesSnapshot setup');
  }
  return normalizedScenario({
    schemaVersion: PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
    rulesSnapshot,
    tableSize: input.tableSize,
    heroPosition: input.heroPosition,
    street: input.street,
    heroCards: copyCards(input.heroCards),
    board: copyCards(input.board),
    deadCards: copyCards(input.deadCards),
    stackBb: input.stackBb,
    stackMode: input.stackMode,
    potBb: input.potBb,
    lastAction: input.lastAction,
    lastActionLabel: input.lastActionLabel ?? null,
    facingSizeBb: input.facingSizeBb,
  });
}

/**
 * Application-only, intentionally lossy snapshot of the manual Playbook spot.
 * This is not a PokerState and cannot establish that a legal hand history exists.
 */
export function createPlaybookScenarioInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('ScenarioInput must be an object');
  }
  if (NORMALIZED_SCENARIO_INPUTS.has(input)) return input;
  if (input.schemaVersion === PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION) {
    return createPlaybookScenarioV2(input);
  }
  if (input.schemaVersion === undefined
    || input.schemaVersion === PLAYBOOK_SCENARIO_V1_SCHEMA_VERSION) {
    return createPlaybookScenarioV1(input);
  }
  throw new TypeError(`Unsupported PlaybookScenario version: ${String(input.schemaVersion)}`);
}

/** Resolve the current legacy Scenario controls once into snapshot-authoritative v2. */
export function createPlaybookScenarioInputFromLegacyCompatibility(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Legacy Scenario compatibility input must be an object');
  }
  const tableSize = Number(input.tableSize);
  if (!Number.isInteger(tableSize)) throw new RangeError('Scenario tableSize must be an integer');
  if (!LEGACY_SCENARIO_ACCOUNTING_MODES.has(input.rakeMode)) {
    throw new RangeError(`Unsupported legacy Scenario rakeMode: ${String(input.rakeMode)}`);
  }
  const straddleBb = Number(input.straddleBb ?? 0);
  if (!Number.isFinite(straddleBb) || straddleBb !== 0) {
    throw new RangeError('Game Rules v1 does not support a nonzero Scenario straddle');
  }
  const anteBb = Number(input.anteBb ?? 0);
  const anteMilliBb = bbToMilliBb(anteBb, 'Scenario anteBb');
  const rulesSnapshot = createGameRulesSnapshotFromLegacyGameConfiguration({
    mode: input.rakeMode === 'fixed' ? GAME_MODES.CLUBGG : GAME_MODES.HOME,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: {
      type: anteMilliBb === 0 ? ANTE_TYPES.NONE : ANTE_TYPES.PER_PLAYER,
      amountMilliBb: anteMilliBb,
    },
  }, tableSize);
  return createPlaybookScenarioInput({
    schemaVersion: PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
    rulesSnapshot,
    tableSize,
    heroPosition: input.heroPosition,
    street: input.street,
    heroCards: copyCards(input.heroCards),
    board: copyCards(input.board),
    deadCards: copyCards(input.deadCards),
    stackBb: input.stackBb,
    stackMode: input.stackMode,
    potBb: input.potBb,
    lastAction: input.lastAction,
    lastActionLabel: input.lastActionLabel ?? null,
    facingSizeBb: input.facingSizeBb,
  });
}

function normalizedDecisionNumber(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  const finite = Number.isFinite(numeric) ? numeric : fallback;
  return Math.min(maximum, Math.max(minimum, finite));
}

function scenarioStreet(board) {
  const count = copyCards(board).length;
  if (count === 0) return 'preflop';
  if (count === 3) return 'flop';
  if (count === 4) return 'turn';
  if (count === 5) return 'river';
  return 'invalid';
}

function scenarioFacingSize(lastAction, value) {
  if (lastAction === 'unopened') return 0;
  return normalizedDecisionNumber(value, 0, 0, 100);
}

function legacyScenarioAccounting(input) {
  if (!LEGACY_SCENARIO_ACCOUNTING_MODES.has(input.rakeMode)) {
    throw new RangeError(`Unsupported legacy Scenario rakeMode: ${String(input.rakeMode)}`);
  }
  const fixed = input.rakeMode === 'fixed';
  const expectedPerPlayerBb = fixed ? LEGACY_FIXED_COLLECTION_PER_PLAYER_BB : 0;
  const expectedTotalBb = Number((input.tableSize * expectedPerPlayerBb).toFixed(10));
  if (Number(input.forcedContributionPerPlayerBb) !== expectedPerPlayerBb
    || Number(input.totalForcedContributionBb) !== expectedTotalBb) {
    throw new RangeError('Legacy Scenario accounting facts do not match rakeMode');
  }
  return {
    rakeMode: input.rakeMode,
    forcedContributionPerPlayerBb: expectedPerPlayerBb,
    totalForcedContributionBb: expectedTotalBb,
  };
}

function snapshotScenarioAccounting(input) {
  const policy = input.rulesSnapshot.definition.collectionPolicy;
  if (policy.type === GAME_RULES_COLLECTION_TYPES.NONE) {
    return {
      rakeMode: 'off',
      forcedContributionPerPlayerBb: 0,
      totalForcedContributionBb: 0,
    };
  }
  if (policy.type === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER) {
    const perPlayerBb = policy.amountMilliBb / 1000;
    return {
      rakeMode: 'fixed',
      forcedContributionPerPlayerBb: perPlayerBb,
      totalForcedContributionBb: (policy.amountMilliBb * input.tableSize) / 1000,
    };
  }
  throw new RangeError(`Unsupported Scenario collection policy: ${String(policy.type)}`);
}

/**
 * Project compatibility accounting vocabulary from the Scenario's authority.
 * V1 is an explicit legacy reader; v2 reads only its immutable rules snapshot.
 */
export function deriveDecisionContextFromPlaybookScenario(scenarioInput) {
  const input = createPlaybookScenarioInput(scenarioInput);
  const tableSize = Math.trunc(normalizedDecisionNumber(input.tableSize, 6, 2, 10));
  const heroPosition = typeof input.heroPosition === 'string' && input.heroPosition
    ? input.heroPosition
    : 'BTN';
  const heroCards = copyCards(input.heroCards);
  const board = copyCards(input.board);
  const deadCards = copyCards(input.deadCards);
  const stackBb = normalizedDecisionNumber(input.stackBb, 100, 10, 500);
  const stackMode = typeof input.stackMode === 'string' && input.stackMode
    ? input.stackMode
    : 'hero';
  const potBb = normalizedDecisionNumber(input.potBb, 1.5, 0.5, 200);
  const lastAction = typeof input.lastAction === 'string' && input.lastAction
    ? input.lastAction
    : 'unopened';
  const facingSizeBb = scenarioFacingSize(lastAction, input.facingSizeBb);
  const callAmountBb = lastAction === 'check'
    || (lastAction === 'unopened' && heroPosition === 'BB') ? 0 : null;
  const accounting = input.schemaVersion === PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION
    ? snapshotScenarioAccounting(input)
    : legacyScenarioAccounting(input);

  return deepFreeze({
    schemaVersion: 'decision-context/v1',
    tableSize,
    opponentCount: null,
    heroPosition,
    street: scenarioStreet(board),
    heroCards,
    board,
    deadCards,
    stackBb,
    stackMode,
    potBb,
    lastAction,
    facingSizeBb,
    callAmountBb,
    heroStreetContributionBb: null,
    // These are DecisionContext v1 compatibility facts, not rules authority.
    rakeMode: accounting.rakeMode,
    forcedContributionPerPlayerBb: accounting.forcedContributionPerPlayerBb,
    totalForcedContributionBb: accounting.totalForcedContributionBb,
  });
}

export function createPlaybookScenarioFromPokerState(state, heroPlayerId, options = {}) {
  validatePokerState(state);
  if (state.schemaVersion !== POKER_STATE_V2_SCHEMA_VERSION) {
    throw new TypeError('Hand to Scenario v2 conversion requires poker-state/v2');
  }
  const context = deriveDecisionContextFromPokerState(state, heroPlayerId, options);
  return createPlaybookScenarioInput({
    schemaVersion: PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
    rulesSnapshot: state.rulesSnapshot,
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    street: context.street,
    heroCards: context.heroCards,
    board: context.board,
    deadCards: context.deadCards,
    stackBb: context.stackBb,
    stackMode: context.stackMode,
    potBb: context.potBb,
    lastAction: context.lastAction,
    lastActionLabel: null,
    facingSizeBb: context.facingSizeBb,
  });
}

export function handModeCompatibility(scenarioInput) {
  const input = createPlaybookScenarioInput(scenarioInput);
  if (input.schemaVersion === PLAYBOOK_SCENARIO_V1_SCHEMA_VERSION
    && Number(input.straddleBb) !== 0) {
    return resolution(PLAYBOOK_MODES.SCENARIO, 'unavailable', {
      reason: 'canonical_straddle_unsupported',
    });
  }
  if (input.schemaVersion === PLAYBOOK_SCENARIO_V1_SCHEMA_VERSION
    && input.rakeMode === 'fixed' && Number(input.tableSize) < 7) {
    return resolution(PLAYBOOK_MODES.SCENARIO, 'unavailable', {
      reason: 'clubgg_requires_7_to_10_players',
    });
  }
  return resolution(PLAYBOOK_MODES.HAND, 'available');
}

function handUnavailableReason(state, heroPlayerId) {
  if (!state) return 'canonical_session_not_initialized';
  if (state.phase === PHASES.CHANCE || state.pendingChance !== null) return 'canonical_chance_state';
  if (state.phase === PHASES.SHOWDOWN) return 'canonical_showdown_state';
  if (state.phase === PHASES.TERMINAL || state.terminal?.isTerminal) return 'canonical_terminal_state';
  if (state.phase !== PHASES.BETTING) return 'canonical_not_betting';
  const hero = playerById(state, heroPlayerId);
  if (!hero) return 'canonical_hero_unknown';
  if (state.actingPlayerId !== heroPlayerId) return 'canonical_hero_not_actor';
  if (!Array.isArray(hero.holeCards) || hero.holeCards.length !== 2) {
    return 'canonical_hero_cards_unknown';
  }
  return null;
}

/** Resolve exactly one authoritative state source. No cross-mode fallback occurs. */
export function resolvePlaybookDecisionContext({
  mode,
  scenarioInput = null,
  canonicalSession = null,
  heroPlayerId = null,
  projectionOptions = {},
  deriveScenarioDecisionContext = null,
} = {}) {
  if (mode === PLAYBOOK_MODES.SCENARIO) {
    try {
      const input = createPlaybookScenarioInput(scenarioInput || {});
      const projector = typeof deriveScenarioDecisionContext === 'function'
        ? deriveScenarioDecisionContext
        : deriveDecisionContextFromPlaybookScenario;
      const decisionContext = projector(input);
      if (decisionContext?.schemaVersion !== 'decision-context/v1') {
        throw new TypeError('Scenario projection did not return DecisionContext v1');
      }
      return resolution(mode, 'available', { decisionContext });
    } catch (error) {
      return resolution(mode, 'error', {
        reason: 'scenario_projection_failed',
        error: serializedError(error),
      });
    }
  }

  if (mode !== PLAYBOOK_MODES.HAND) {
    return resolution(String(mode ?? ''), 'error', {
      reason: 'unsupported_playbook_mode',
      error: serializedError(new RangeError(`Unsupported Playbook mode: ${mode}`)),
    });
  }

  const state = canonicalSession?.getState?.() ?? null;
  const unavailableReason = handUnavailableReason(state, heroPlayerId);
  if (unavailableReason) return resolution(mode, 'unavailable', { reason: unavailableReason });

  try {
    validatePokerState(state);
    const decisionContext = deriveDecisionContextFromPokerState(
      state,
      heroPlayerId,
      projectionOptions,
    );
    return resolution(mode, 'available', { decisionContext });
  } catch (error) {
    return resolution(mode, 'error', {
      reason: 'canonical_projection_failed',
      error: serializedError(error),
    });
  }
}

export function createPlaybookViewModel({ resolution: current, strategyResult = null } = {}) {
  const safeResolution = current || resolution(PLAYBOOK_MODES.SCENARIO, 'unavailable', {
    reason: 'decision_context_not_resolved',
  });
  return deepFreeze({
    schemaVersion: PLAYBOOK_VIEW_MODEL_SCHEMA_VERSION,
    mode: safeResolution.mode,
    status: safeResolution.status,
    reason: safeResolution.reason,
    error: safeResolution.error,
    decisionContext: safeResolution.decisionContext,
    strategyResult,
    source: strategyResult?.source ?? null,
  });
}

export function createPlaybookModeController({ canonicalController } = {}) {
  let mode = PLAYBOOK_MODES.SCENARIO;
  let lastScenarioInput = null;
  let lastResolution = resolution(mode, 'unavailable', {
    reason: 'decision_context_not_resolved',
  });

  return Object.freeze({
    getMode() {
      return mode;
    },

    setMode(nextMode, scenarioInput = lastScenarioInput) {
      if (!Object.values(PLAYBOOK_MODES).includes(nextMode)) {
        return resolution(mode, 'error', {
          reason: 'unsupported_playbook_mode',
          error: serializedError(new RangeError(`Unsupported Playbook mode: ${nextMode}`)),
        });
      }
      if (nextMode === PLAYBOOK_MODES.HAND) {
        const preservedScenarioInput = createPlaybookScenarioInput(scenarioInput || {});
        const compatibility = handModeCompatibility(preservedScenarioInput);
        if (compatibility.status !== 'available') return compatibility;
        lastScenarioInput = preservedScenarioInput;
      }
      mode = nextMode;
      lastResolution = resolution(mode, 'unavailable', {
        reason: mode === PLAYBOOK_MODES.HAND
          ? 'canonical_session_not_initialized'
          : 'decision_context_not_resolved',
      });
      return lastResolution;
    },

    resolve({ scenarioInput, deriveScenarioDecisionContext } = {}) {
      if (scenarioInput && mode === PLAYBOOK_MODES.SCENARIO) {
        lastScenarioInput = createPlaybookScenarioInput(scenarioInput);
      }
      lastResolution = resolvePlaybookDecisionContext({
        mode,
        scenarioInput: lastScenarioInput,
        canonicalSession: canonicalController,
        heroPlayerId: canonicalController?.getHeroPlayerId?.() ?? null,
        projectionOptions: canonicalController?.getProjectionOptions?.() ?? {},
        deriveScenarioDecisionContext,
      });
      return lastResolution;
    },

    getLastScenarioInput() {
      return lastScenarioInput;
    },

    getResolution() {
      return lastResolution;
    },
  });
}
