import {
  PHASES,
  playerById,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from './decision-context-from-poker-state.mjs';

export const PLAYBOOK_MODES = Object.freeze({
  SCENARIO: 'scenario',
  HAND: 'hand',
});

export const PLAYBOOK_SCENARIO_SCHEMA_VERSION = 'playbook-scenario/v1';
export const PLAYBOOK_RESOLUTION_SCHEMA_VERSION = 'playbook-decision-resolution/v1';
export const PLAYBOOK_VIEW_MODEL_SCHEMA_VERSION = 'playbook-view-model/v1';

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

/**
 * Application-only, intentionally lossy snapshot of the manual Playbook spot.
 * This is not a PokerState and cannot establish that a legal hand history exists.
 */
export function createPlaybookScenarioInput(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('ScenarioInput must be an object');
  }
  return deepFreeze({
    schemaVersion: PLAYBOOK_SCENARIO_SCHEMA_VERSION,
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

export function handModeCompatibility(scenarioInput) {
  const input = createPlaybookScenarioInput(scenarioInput);
  if (Number(input.straddleBb) !== 0) {
    return resolution(PLAYBOOK_MODES.SCENARIO, 'unavailable', {
      reason: 'canonical_straddle_unsupported',
    });
  }
  if (input.rakeMode === 'fixed' && Number(input.tableSize) < 7) {
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
      if (typeof deriveScenarioDecisionContext !== 'function') {
        throw new TypeError('Scenario mode requires deriveScenarioDecisionContext');
      }
      const decisionContext = deriveScenarioDecisionContext(input);
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
