import {
  ACTION_TYPES,
  GAME_RULES_COLLECTION_TYPES,
  GAME_MODES,
  POKER_STATE_V2_SCHEMA_VERSION,
  getLegalActionSpec,
  maximumAmountToMilliBb,
  PHASES,
  STREETS,
  isPlayerLive,
  playerById,
  playersClockwiseAfterSeat,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';

export const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';
export const DECISION_CONTEXT_CONTRACT_VERSION = 'decision-context/v1.1';
export const DECISION_CONTEXT_DERIVATION_SCHEMA_VERSION =
  'decision-context-derivation/v1';

const STACK_MODES = Object.freeze(new Set(['hero', 'effective', 'custom']));
const PREFLOP_AGGRESSION_ACTIONS = Object.freeze(['raise', '3bet', '4bet']);

function derivationEvent(field, quality, code, value, rawValue = undefined) {
  const event = { field, quality, code };
  if (rawValue !== undefined && (typeof rawValue !== 'number' || Number.isFinite(rawValue))) {
    event.rawValue = rawValue;
  }
  if (value !== undefined) event.value = value;
  return event;
}

export function createDecisionContextDerivation(source, events = []) {
  return {
    schemaVersion: DECISION_CONTEXT_DERIVATION_SCHEMA_VERSION,
    source,
    defaultQuality: 'exact',
    events: events.map((event) => ({ ...event })),
  };
}

export function unavailableDecisionContextField(field, code, value = null) {
  return derivationEvent(field, 'unavailable', code, value);
}

function normalizedDecisionNumber(value, fallback, min, max, field, events) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    events.push(derivationEvent(
      field,
      'defaulted',
      'non_finite_default',
      fallback,
      value,
    ));
    return fallback;
  }
  const normalized = Math.min(max, Math.max(min, numeric));
  if (normalized !== numeric) {
    events.push(derivationEvent(
      field,
      'clamped',
      'supported_range_clamp',
      normalized,
      numeric,
    ));
  }
  return normalized;
}

function currentStreetRecords(state) {
  return state.actionHistory.filter((record) => record.street === state.street);
}

function isAggressiveRecord(record) {
  return record.currentBetAfterMilliBb > record.currentBetBeforeMilliBb;
}

function classifyLastAction(state) {
  const records = currentStreetRecords(state);
  const aggressiveRecords = records.filter(isAggressiveRecord);

  if (aggressiveRecords.length > 0) {
    if (state.street === STREETS.PREFLOP) {
      return PREFLOP_AGGRESSION_ACTIONS[Math.min(aggressiveRecords.length - 1, 2)];
    }
    const latest = aggressiveRecords[aggressiveRecords.length - 1];
    return latest.currentBetBeforeMilliBb === 0 ? 'bet' : 'raise';
  }

  // Legacy v1 compatibility: passive actions retain the historical `check`
  // projection. The additive priorActionSummary below preserves limp/call facts.
  const hasPassiveAction = records.some((record) => (
    record.submittedAction.type !== ACTION_TYPES.FOLD
  ));
  if (hasPassiveAction) return 'check';
  return state.street === STREETS.PREFLOP ? 'unopened' : 'check';
}

function semanticActionFamily(record, aggressionBefore) {
  if (!record) return 'none';
  const type = record.submittedAction.type;
  if (type === ACTION_TYPES.CALL) {
    return record.street === STREETS.PREFLOP && aggressionBefore === 0
      ? 'limp'
      : 'call';
  }
  if (type === ACTION_TYPES.ALL_IN) return 'all_in';
  return type;
}

function aggressionFamily(street, count) {
  if (street === STREETS.PREFLOP) {
    if (count === 0) return 'none';
    if (count === 1) return 'open';
    if (count === 2) return 'three_bet';
    return 'four_bet_or_more';
  }
  if (count === 0) return 'none';
  if (count === 1) return 'bet';
  return 'raise';
}

function priorActionSummary(state, legalActions) {
  const records = currentStreetRecords(state);
  let aggressionCount = 0;
  let limperCount = 0;
  let latestAggressive = null;
  let lastFamily = 'none';

  for (const record of records) {
    const aggressionBefore = aggressionCount;
    if (isAggressiveRecord(record)) {
      aggressionCount += 1;
      latestAggressive = record;
    }
    if (record.street === STREETS.PREFLOP
      && record.submittedAction.type === ACTION_TYPES.CALL
      && aggressionBefore === 0) {
      limperCount += 1;
    }
    lastFamily = semanticActionFamily(record, aggressionBefore);
  }

  const latestRecord = records.at(-1) ?? null;
  let facingActionFamily = 'none';
  if (legalActions.call.commitMilliBb > 0 && aggressionCount > 0) {
    facingActionFamily = state.street === STREETS.PREFLOP
      ? 'raise'
      : aggressionCount === 1 ? 'bet' : 'raise';
  } else if (latestRecord
    && (lastFamily === 'check' || lastFamily === 'limp' || lastFamily === 'call')) {
    facingActionFamily = lastFamily;
  }

  return {
    lastActionFamily: lastFamily,
    lastActorPosition: latestRecord
      ? playerById(state, latestRecord.playerId)?.position ?? null
      : null,
    facingActionFamily,
    aggressionFamily: aggressionFamily(state.street, aggressionCount),
    aggressionCount,
    limperCount: state.street === STREETS.PREFLOP ? limperCount : null,
    aggressorPosition: latestAggressive
      ? playerById(state, latestAggressive.playerId)?.position ?? null
      : null,
  };
}

function relationToOpponent(order, heroPlayerId, opponentPlayerId) {
  const heroIndex = order.findIndex((player) => player.playerId === heroPlayerId);
  const opponentIndex = order.findIndex((player) => player.playerId === opponentPlayerId);
  if (heroIndex < 0 || opponentIndex < 0 || heroIndex === opponentIndex) return 'unknown';
  return heroIndex > opponentIndex ? 'in_position' : 'out_of_position';
}

function postflopPositionFacts(state, hero, liveOpponents) {
  if (state.street === STREETS.PREFLOP) {
    return {
      positionRelation: 'not_applicable',
      aggressorPositionRelation: 'not_applicable',
    };
  }

  const button = state.players.find((player) => player.seat === state.buttonSeat);
  const order = playersClockwiseAfterSeat(state.players, state.buttonSeat)
    .concat(button)
    .filter(isPlayerLive);
  const relations = liveOpponents.map((opponent) => (
    relationToOpponent(order, hero.playerId, opponent.playerId)
  ));
  const relationSet = new Set(relations);
  const positionRelation = relationSet.has('unknown')
    ? 'unknown'
    : relationSet.size > 1
      ? 'mixed'
      : relations[0] ?? 'unknown';
  const aggressor = state.lastAggressorPlayerId === null
    ? null
    : liveOpponents.find((opponent) => opponent.playerId === state.lastAggressorPlayerId) ?? null;

  return {
    positionRelation,
    aggressorPositionRelation: aggressor
      ? relationToOpponent(order, hero.playerId, aggressor.playerId)
      : 'not_applicable',
  };
}

function requireActorDecision(state, heroPlayerId) {
  validatePokerState(state);
  if (state.phase !== PHASES.BETTING || state.pendingChance !== null
    || state.terminal.isTerminal || state.showdown.status !== 'not_reached') {
    throw new RangeError('DecisionContext projection requires an active betting decision');
  }
  const hero = playerById(state, heroPlayerId);
  if (!hero) throw new RangeError(`Unknown heroPlayerId: ${heroPlayerId}`);
  if (!isPlayerLive(hero)) throw new RangeError('DecisionContext hero must be live and not folded');
  if (hero.playerId !== state.actingPlayerId) {
    throw new RangeError('DecisionContext hero must be the current acting player');
  }
  if (!Array.isArray(hero.holeCards) || hero.holeCards.length !== 2) {
    throw new RangeError('DecisionContext hero requires two known hole cards');
  }
  return hero;
}

function accountingFromPokerState(state) {
  if (state.schemaVersion !== POKER_STATE_V2_SCHEMA_VERSION) {
    const amountMilliBb = state.game.forcedContributionPerPlayerMilliBb;
    return {
      rakeMode: state.game.mode === GAME_MODES.CLUBGG ? 'fixed' : 'off',
      forcedContributionPerPlayerBb: amountMilliBb / 1000,
      totalForcedContributionBb: (state.players.length * amountMilliBb) / 1000,
    };
  }

  const policy = state.rulesSnapshot.definition.collectionPolicy;
  const amountMilliBb = policy.type
    === GAME_RULES_COLLECTION_TYPES.FIXED_PER_SEATED_PLAYER
    ? policy.amountMilliBb
    : 0;
  return {
    rakeMode: amountMilliBb > 0 ? 'fixed' : 'off',
    forcedContributionPerPlayerBb: amountMilliBb / 1000,
    totalForcedContributionBb: (state.players.length * amountMilliBb) / 1000,
  };
}

/**
 * Project an actor-only application strategy snapshot from canonical PokerState.
 * All integer milliBb -> bb conversion remains at this boundary. Additive v1.1
 * facts preserve v1 compatibility while exposing canonical live state, bounded
 * history, postflop seat-order relation, and legal aggression bounds.
 */
export function deriveDecisionContextFromPokerState(state, heroPlayerId, options = {}) {
  const hero = requireActorDecision(state, heroPlayerId);
  const stackMode = options.stackMode ?? 'hero';
  if (!STACK_MODES.has(stackMode)) throw new RangeError(`Unsupported stackMode: ${stackMode}`);

  const derivationEvents = [];
  const lastAction = classifyLastAction(state);
  derivationEvents.push(derivationEvent(
    'lastAction',
    'normalized',
    'legacy_bounded_history_projection',
    lastAction,
  ));
  const hasCompatibleAggression = PREFLOP_AGGRESSION_ACTIONS.includes(lastAction)
    || lastAction === 'bet';
  // `facingSizeBb` remains the legacy nominal wager-to compatibility field.
  const facingSizeBb = hasCompatibleAggression ? state.currentBetMilliBb / 1000 : 0;
  const legalActions = getLegalActionSpec(state);
  const callAmountBb = legalActions.call.commitMilliBb / 1000;
  const heroStreetContributionBb = hero.streetContributionMilliBb / 1000;
  const accounting = accountingFromPokerState(state);
  const currentPotBb = state.potMilliBb / 1000;
  derivationEvents.push(derivationEvent(
    'currentPotBb',
    'exact',
    'canonical_current_pot',
    currentPotBb,
  ));
  const liveOpponents = state.players.filter((player) => (
    player.playerId !== hero.playerId && isPlayerLive(player)
  ));
  const opponentCount = liveOpponents.length;
  const startingStackBb = hero.startingStackMilliBb / 1000;
  const heroStackBb = hero.currentStackMilliBb / 1000;
  const effectiveStackByOpponent = [...liveOpponents]
    .sort((left, right) => left.seat - right.seat)
    .map((opponent) => ({
      position: opponent.position,
      opponentStackBb: opponent.currentStackMilliBb / 1000,
      effectiveStackBb: Math.min(
        hero.currentStackMilliBb,
        opponent.currentStackMilliBb,
      ) / 1000,
    }));
  const effectiveStackBb = effectiveStackByOpponent.length === 1
    ? effectiveStackByOpponent[0].effectiveStackBb
    : null;
  if (effectiveStackBb === null) {
    derivationEvents.push(unavailableDecisionContextField(
      'effectiveStackBb',
      'multiway_effective_stack_scalar_ambiguous',
    ));
  }
  const position = postflopPositionFacts(state, hero, liveOpponents);
  const regularAggression = legalActions.bet.available
    ? legalActions.bet
    : legalActions.raise.available ? legalActions.raise : null;
  const canRaise = regularAggression !== null || legalActions.allIn.available;
  const minRaiseToBb = regularAggression === null
    ? null
    : regularAggression.minToMilliBb / 1000;
  const maxRaiseToBb = canRaise ? legalActions.allIn.amountToMilliBb / 1000 : null;
  if (!canRaise) {
    derivationEvents.push(
      unavailableDecisionContextField('minRaiseToBb', 'legal_raise_unavailable'),
      unavailableDecisionContextField('maxRaiseToBb', 'legal_raise_unavailable'),
    );
  } else if (minRaiseToBb === null) {
    derivationEvents.push(unavailableDecisionContextField(
      'minRaiseToBb',
      'short_all_in_only_no_full_raise_minimum',
    ));
  }

  return {
    schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    tableSize: state.players.length,
    opponentCount,
    heroPosition: hero.position,
    street: state.street,
    heroCards: [...hero.holeCards],
    board: [...state.board],
    deadCards: [...state.deadCards],
    // Legacy configured-depth compatibility field; never reinterpret as live.
    stackBb: normalizedDecisionNumber(
      startingStackBb,
      100,
      10,
      500,
      'stackBb',
      derivationEvents,
    ),
    stackMode,
    startingStackBb,
    heroStackBb,
    effectiveStackBb,
    effectiveStackByOpponent,
    positionRelation: position.positionRelation,
    aggressorPositionRelation: position.aggressorPositionRelation,
    currentPotBb,
    potBb: normalizedDecisionNumber(
      currentPotBb,
      1.5,
      0.5,
      200,
      'potBb',
      derivationEvents,
    ),
    lastAction,
    priorActionSummary: priorActionSummary(state, legalActions),
    facingSizeBb,
    callAmountBb,
    heroStreetContributionBb,
    canRaise,
    minRaiseToBb,
    maxRaiseToBb,
    allInToBb: maximumAmountToMilliBb(state, hero.playerId) / 1000,
    rakeMode: accounting.rakeMode,
    forcedContributionPerPlayerBb: accounting.forcedContributionPerPlayerBb,
    totalForcedContributionBb: accounting.totalForcedContributionBb,
    derivation: createDecisionContextDerivation('canonical_hand', derivationEvents),
  };
}
