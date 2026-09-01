import {
  CARD_RANKS,
  CARD_SUITS,
  assertUniqueKnownCards,
} from '../../../shared/poker-domain/cards.js';
import {
  HEURISTIC_RANK_VALUES,
  evaluatePostflopHandStrength,
  scoreHeuristicSeven,
} from './heuristic-evaluator.mjs';

export const POSTFLOP_HEURISTIC_SAMPLES = 250;

const FULL_DECK = Object.freeze(
  [...CARD_RANKS].flatMap((rank) => [...CARD_SUITS].map((suit) => `${rank}${suit}`)),
);

function clampUnit(value) {
  return Math.min(1, Math.max(0, Number(value)));
}

function sampleIndex(rng, length) {
  if (!Number.isInteger(length) || length <= 0) throw new RangeError('Cannot sample an empty set');
  const randomValue = Number(rng());
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new RangeError('Injected heuristic RNG must return values in [0, 1)');
  }
  return Math.floor(randomValue * length);
}

function opponentCountFor({ opponentCount, tableSize }) {
  if (Number.isInteger(opponentCount) && opponentCount >= 1 && opponentCount <= 9) {
    return { count: opponentCount, source: 'decision_context_exact' };
  }
  const seatedPlayers = Number.isInteger(tableSize)
    ? Math.min(10, Math.max(2, tableSize))
    : 2;
  return { count: seatedPlayers - 1, source: 'table_size_approximation' };
}

export function postflopOpponentRangeAssumption({
  facingSizeBb,
  lastAction,
  priorActionSummary,
} = {}) {
  const aggressionFamily = String(priorActionSummary?.aggressionFamily || '').toLowerCase();
  return ['bet', 'raise'].includes(aggressionFamily)
    || Number(facingSizeBb) > 0
    || ['bet', 'raise'].includes(String(lastAction || '').toLowerCase())
    ? 'aggression_conditioned'
    : 'unconditioned';
}

function preflopComboScore(card1, card2) {
  const rank1 = HEURISTIC_RANK_VALUES[card1[0]] || 0;
  const rank2 = HEURISTIC_RANK_VALUES[card2[0]] || 0;
  const highRank = Math.max(rank1, rank2);
  const lowRank = Math.min(rank1, rank2);
  if (rank1 === rank2) return highRank * 5 + 30;
  let points = highRank * 3 + lowRank;
  if (card1[1] === card2[1]) points += 8;
  const gap = highRank - lowRank;
  if (gap === 1) points += 4;
  else if (gap === 2) points += 2;
  else if (gap === 3) points += 1;
  return points;
}

function buildOpponentCandidateRange(deck, {
  opponentStyle,
  rangeAssumption,
  totalPlayers,
}) {
  const allCombos = [];
  for (let first = 0; first < deck.length; first += 1) {
    for (let second = first + 1; second < deck.length; second += 1) {
      const hand = [deck[first], deck[second]];
      allCombos.push({ hand, points: preflopComboScore(...hand) });
    }
  }
  allCombos.sort((left, right) => (
    right.points - left.points
    || left.hand[0].localeCompare(right.hand[0])
    || left.hand[1].localeCompare(right.hand[1])
  ));

  // This is deliberately a crude, uniform candidate range rather than a
  // weighted or solved range. A higher opponentStyle means a looser range.
  let targetFraction = 0.15 + 0.3 * clampUnit(opponentStyle);
  if (rangeAssumption === 'aggression_conditioned') {
    targetFraction *= 0.7;
  }
  if (totalPlayers >= 6) targetFraction *= 0.9;
  targetFraction = Math.max(0.05, Math.min(1, targetFraction));
  const selectedCount = Math.max(1, Math.floor(allCombos.length * targetFraction));
  return {
    combos: allCombos.slice(0, selectedCount),
    selectedCount,
    totalCount: allCombos.length,
    actualFraction: selectedCount / allCombos.length,
    targetFraction,
  };
}

function allocateOpponentHands(candidateCombos, opponentCount, initialUsedCards, rng) {
  const usedCards = new Set(initialUsedCards);
  const hands = [];
  for (let opponent = 0; opponent < opponentCount; opponent += 1) {
    const legal = candidateCombos.filter(({ hand }) => (
      !usedCards.has(hand[0]) && !usedCards.has(hand[1])
    ));
    if (legal.length === 0) return null;
    const selected = legal[sampleIndex(rng, legal.length)].hand;
    hands.push(selected);
    usedCards.add(selected[0]);
    usedCards.add(selected[1]);
  }
  return { hands, usedCards };
}

function sampleRunout(deck, usedCards, neededRunout, rng) {
  const available = deck.filter((card) => !usedCards.has(card));
  if (available.length < neededRunout) return null;
  for (let index = 0; index < neededRunout; index += 1) {
    const selected = index + sampleIndex(rng, available.length - index);
    [available[index], available[selected]] = [available[selected], available[index]];
  }
  return available.slice(0, neededRunout);
}

/**
 * Range-conditioned sampled showdown share used only by the heuristic strategy
 * fallback. This is not the canonical Equity service or an equilibrium range.
 */
export function simulateHeuristicEquity({
  heroCards,
  board,
  deadCards = [],
  tableSize,
  opponentCount = null,
  facingSizeBb,
  lastAction,
  priorActionSummary = null,
  opponentStyle = 0,
  iterations = POSTFLOP_HEURISTIC_SAMPLES,
  rng,
  observeTrial = null,
}) {
  if (typeof rng !== 'function') throw new TypeError('Heuristic equity requires an injected RNG');
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new RangeError('Heuristic sample count must be a positive integer');
  }
  const filteredHeroCards = Array.isArray(heroCards) ? heroCards.filter(Boolean) : [];
  const boardCards = Array.isArray(board) ? board.filter(Boolean) : [];
  const excludedDeadCards = Array.isArray(deadCards) ? deadCards.filter(Boolean) : [];
  if (filteredHeroCards.length !== 2 || boardCards.length < 3 || boardCards.length > 5) {
    throw new RangeError('Heuristic postflop sampling requires two Hero cards and a valid board street');
  }
  assertUniqueKnownCards([
    { label: 'heroCards', cards: filteredHeroCards },
    { label: 'board', cards: boardCards },
    { label: 'deadCards', cards: excludedDeadCards },
  ]);

  const excluded = new Set([...filteredHeroCards, ...boardCards, ...excludedDeadCards]);
  const deck = FULL_DECK.filter((card) => !excluded.has(card));
  const opponents = opponentCountFor({ opponentCount, tableSize });
  const neededRunout = 5 - boardCards.length;
  if (deck.length < opponents.count * 2 + neededRunout) {
    throw new RangeError('Heuristic sample cannot allocate every opponent and board card');
  }
  const range = buildOpponentCandidateRange(deck, {
    opponentStyle,
    rangeAssumption: postflopOpponentRangeAssumption({
      facingSizeBb,
      lastAction,
      priorActionSummary,
    }),
    totalPlayers: opponents.count + 1,
  });

  let equityShare = 0;
  let soleWins = 0;
  let splitPotTrials = 0;
  let attemptedSamples = 0;
  let completedSamples = 0;
  const maximumAttempts = iterations * 25;

  while (completedSamples < iterations && attemptedSamples < maximumAttempts) {
    attemptedSamples += 1;
    const allocation = allocateOpponentHands(range.combos, opponents.count, excluded, rng);
    if (!allocation) continue;
    const runout = sampleRunout(deck, allocation.usedCards, neededRunout, rng);
    if (!runout) continue;

    const finalBoard = [...boardCards, ...runout];
    const scores = [
      scoreHeuristicSeven([...filteredHeroCards, ...finalBoard]),
      ...allocation.hands.map((hand) => scoreHeuristicSeven([...hand, ...finalBoard])),
    ];
    const bestScore = Math.max(...scores);
    const winnerIndexes = scores
      .map((score, index) => (score === bestScore ? index : -1))
      .filter((index) => index >= 0);
    if (winnerIndexes.includes(0)) {
      equityShare += 1 / winnerIndexes.length;
      if (winnerIndexes.length === 1) soleWins += 1;
      else splitPotTrials += 1;
    }

    completedSamples += 1;
    if (typeof observeTrial === 'function') {
      observeTrial({
        heroCards: [...filteredHeroCards],
        opponentHands: allocation.hands.map((hand) => [...hand]),
        board: finalBoard,
        runout: [...runout],
        deadCards: [...excludedDeadCards],
        winnerIndexes: [...winnerIndexes],
      });
    }
  }

  if (completedSamples !== iterations) {
    throw new RangeError(
      `Heuristic allocation completed ${completedSamples}/${iterations} samples after ${attemptedSamples} attempts`,
    );
  }

  return {
    eq: equityShare / completedSamples,
    pct: range.actualFraction,
    provenance: 'heuristic_conditional_sample',
    requestedSamples: iterations,
    attemptedSamples,
    completedSamples,
    opponentCount: opponents.count,
    opponentCountSource: opponents.source,
    rangeComboCount: range.selectedCount,
    unblockedComboCount: range.totalCount,
    rangeFraction: range.actualFraction,
    rangeTargetFraction: range.targetFraction,
    rangeDistribution: 'uniform_over_selected_legal_combos',
    sharedRangeAssumption: true,
    opponentRangeAssumption: postflopOpponentRangeAssumption({
      facingSizeBb,
      lastAction,
      priorActionSummary,
    }),
    soleWins,
    splitPotTrials,
  };
}

function linearAt(value, anchors) {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [rightX, rightY] = anchors[index];
    const [leftX, leftY] = anchors[index - 1];
    if (value <= rightX) {
      const progress = (value - leftX) / (rightX - leftX);
      return leftY + (rightY - leftY) * progress;
    }
  }
  return anchors[anchors.length - 1][1];
}

function smoothBoundary(value, center, halfWidth = 0.1) {
  const progress = clampUnit((value - (center - halfWidth)) / (halfWidth * 2));
  return progress * progress * (3 - 2 * progress);
}

function closedHeadsUpMix(aggressiveName, passiveName, aggressivePercent) {
  const aggressive = Math.min(100, Math.max(0, aggressivePercent));
  return {
    [aggressiveName]: aggressive,
    [passiveName]: 100 - aggressive,
  };
}

export function postflopContextFacesWager(decisionContext, trustedCallAmount = undefined) {
  const resolvedCallAmount = trustedCallAmount === undefined
    ? Number.isFinite(decisionContext?.callAmountBb) && decisionContext.callAmountBb >= 0
      ? decisionContext.callAmountBb
      : null
    : trustedCallAmount;
  if (resolvedCallAmount === 0) return false;
  const facingActionFamily = String(
    decisionContext?.priorActionSummary?.facingActionFamily || '',
  ).toLowerCase();
  if (['bet', 'raise'].includes(facingActionFamily)) return true;
  return Number(decisionContext.facingSizeBb) > 0
    || ['bet', 'raise'].includes(String(decisionContext.lastAction || '').toLowerCase());
}

function exactCurrentPotBb(decisionContext) {
  return decisionContext?.contractVersion === 'decision-context/v1.1'
    && Number.isFinite(decisionContext.currentPotBb)
    && decisionContext.currentPotBb >= 0
    ? decisionContext.currentPotBb
    : null;
}

function postflopDecisionPotFacts(decisionContext) {
  const exact = exactCurrentPotBb(decisionContext);
  if (exact !== null) {
    return { value: exact, kind: 'decision_context_v1.1_current_pot' };
  }
  if (decisionContext?.contractVersion !== 'decision-context/v1.1'
    && Number.isFinite(decisionContext?.potBb)
    && decisionContext.potBb >= 0) {
    return { value: decisionContext.potBb, kind: 'base_v1_compatibility_pot' };
  }
  return { value: null, kind: 'exact_current_pot_unavailable_no_compatibility_fallback' };
}

export function postflopEffectiveSprFacts(decisionContext) {
  const potFacts = postflopDecisionPotFacts(decisionContext);
  const actorContestableAfterCall = Number(
    decisionContext?.actorContestablePotAfterCallBb,
  );
  const callAmountBb = Number(decisionContext?.callAmountBb);
  const actorContestableBeforeAction = potFacts.kind === 'decision_context_v1.1_current_pot'
    && Number.isFinite(actorContestableAfterCall)
    && Number.isFinite(callAmountBb)
    && actorContestableAfterCall >= callAmountBb
    ? actorContestableAfterCall - callAmountBb
    : null;
  const currentPotBb = potFacts.kind === 'decision_context_v1.1_current_pot'
    ? actorContestableBeforeAction
    : potFacts.value;
  if (!(currentPotBb > 0)) {
    return {
      kind: 'unavailable',
      scalar: null,
      minimum: null,
      maximum: null,
      currentPotBb,
      adjustmentEnabled: false,
      reason: 'exact_current_pot_unavailable',
    };
  }
  if (potFacts.kind === 'base_v1_compatibility_pot') {
    const compatibilityStackBb = Number.isFinite(decisionContext?.stackBb)
      && decisionContext.stackBb >= 0
      ? decisionContext.stackBb
      : null;
    const scalar = compatibilityStackBb === null
      ? null
      : compatibilityStackBb / currentPotBb;
    return {
      kind: scalar === null ? 'unavailable' : 'base_v1_compatibility_spr',
      scalar,
      minimum: scalar,
      maximum: scalar,
      currentPotBb: null,
      compatibilityPotBb: currentPotBb,
      compatibilityStackBb,
      adjustmentEnabled: false,
      reason: scalar === null
        ? 'base_v1_compatibility_stack_unavailable'
        : 'base_v1_legacy_score_adjustment_only',
    };
  }
  if (Number(decisionContext?.opponentCount) === 1
    && Number.isFinite(decisionContext?.effectiveStackBb)
    && decisionContext.effectiveStackBb >= 0) {
    const scalar = decisionContext.effectiveStackBb / currentPotBb;
    return {
      kind: 'heads_up_exact_effective_spr',
      scalar,
      minimum: scalar,
      maximum: scalar,
      currentPotBb,
      potSemantics: actorContestableBeforeAction === null
        ? potFacts.kind
        : 'actor_contestable_pot_before_action',
      effectiveStackBb: decisionContext.effectiveStackBb,
      adjustmentEnabled: true,
      reason: null,
    };
  }
  const perOpponent = Array.isArray(decisionContext?.effectiveStackByOpponent)
    ? decisionContext.effectiveStackByOpponent
      .map((entry) => Number(entry?.effectiveStackBb))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map((value) => value / currentPotBb)
    : [];
  if (Number(decisionContext?.opponentCount) > 1 && perOpponent.length > 0) {
    return {
      kind: 'multiway_per_opponent_spr_range',
      scalar: null,
      minimum: Math.min(...perOpponent),
      maximum: Math.max(...perOpponent),
      currentPotBb,
      potSemantics: actorContestableBeforeAction === null
        ? potFacts.kind
        : 'actor_contestable_pot_before_action',
      perOpponent,
      adjustmentEnabled: false,
      reason: 'multiway_scalar_adjustment_disabled',
    };
  }
  return {
    kind: 'unavailable',
    scalar: null,
    minimum: null,
    maximum: null,
    currentPotBb,
    potSemantics: actorContestableBeforeAction === null
      ? potFacts.kind
      : 'actor_contestable_pot_before_action',
    adjustmentEnabled: false,
    reason: 'live_effective_stack_unavailable',
  };
}

function postflopPositionAdjustment(decisionContext, facesWager) {
  const relation = String(decisionContext?.positionRelation || 'unknown');
  const aggressorRelation = String(
    decisionContext?.aggressorPositionRelation || 'unknown',
  );
  // One shared bounded reallocation rule changes only aggression versus the
  // corresponding passive continuation. It does not claim equilibrium
  // positional frequencies, and mixed/unknown relations never inherit a
  // full IP or OOP adjustment.
  let rate = relation === 'in_position' ? 0.05
    : relation === 'out_of_position' ? -0.08
      : 0;
  if (relation === 'mixed' && facesWager) {
    if (aggressorRelation === 'in_position') rate += 0.015;
    if (aggressorRelation === 'out_of_position') rate -= 0.02;
  }
  return {
    relation,
    aggressorRelation,
    rate,
    applied: rate !== 0,
    semantics: relation === 'unknown'
      ? 'unknown_relation_no_adjustment'
      : relation === 'mixed'
        ? 'mixed_relation_not_collapsed_to_ip_or_oop'
        : 'bounded_aggression_passive_reallocation',
  };
}

function postflopSprAdjustment(evaluation, sprFacts) {
  if (!sprFacts.adjustmentEnabled || !Number.isFinite(sprFacts.scalar)) {
    return { rate: 0, applied: false, reason: sprFacts.reason };
  }
  // Exact HU effective SPR only. Smooth shallow/deep weights avoid stack
  // bucket discontinuities; multiway contexts are explicitly disabled above.
  const shallowWeight = 1 - smoothBoundary(sprFacts.scalar, 2.75, 1.25);
  const deepWeight = smoothBoundary(sprFacts.scalar, 9, 3);
  const strongMade = ['monster', 'two_pair', 'overpair', 'top_pair']
    .includes(evaluation.strategicCategory);
  const onePair = ['overpair', 'top_pair', 'middle_pair', 'bottom_pair', 'weak_pair']
    .includes(evaluation.strategicCategory);
  let rate = strongMade ? 0.06 * shallowWeight : 0;
  if (onePair) rate -= 0.06 * deepWeight;
  return {
    rate,
    applied: rate !== 0,
    shallowWeight,
    deepWeight,
    reason: rate === 0 ? 'category_has_no_stack_adjustment' : null,
  };
}

function baseV1CompatibilityScoreAdjustment(evaluation, sprFacts) {
  if (sprFacts.kind !== 'base_v1_compatibility_spr'
    || !Number.isFinite(sprFacts.scalar)) return 0;
  if (sprFacts.scalar < 2
    && ['monster', 'two_pair', 'overpair', 'top_pair'].includes(
      evaluation.strategicCategory,
    )) return 0.03;
  if (sprFacts.scalar > 10
    && evaluation.isWetBoard
    && evaluation.strategicCategory === 'top_pair') return -0.03;
  return 0;
}

function postflopHistoryAdjustment(decisionContext) {
  const summaryFamily = String(
    decisionContext?.priorActionSummary?.aggressionFamily || '',
  ).toLowerCase();
  const legacyFamily = String(decisionContext?.lastAction || '').toLowerCase();
  const family = ['bet', 'raise'].includes(summaryFamily) ? summaryFamily
    : ['bet', 'raise'].includes(legacyFamily) ? legacyFamily
      : 'none';
  return {
    family,
    rate: family === 'raise' ? -0.04 : 0,
    applied: family === 'raise',
    semantics: family === 'raise'
      ? 'postflop_raise_reallocates_aggression_to_passive_continuation'
      : 'no_raise_pressure_adjustment',
  };
}

function postflopMultiwayAdjustment(decisionContext) {
  const opponentCount = Number(decisionContext?.opponentCount);
  if (!Number.isInteger(opponentCount) || opponentCount <= 1) {
    return { rate: 0, applied: false, opponentCount: opponentCount || null };
  }
  // Keep genuine multiway sensitivity independent from SPR so a per-opponent
  // stack vector is never collapsed into a fake exact scalar.
  const rate = -Math.min(0.16, (opponentCount - 1) * 0.06);
  return {
    rate,
    applied: true,
    opponentCount,
    semantics: 'bounded_multiway_aggression_reallocation_separate_from_spr',
  };
}

function reallocateAggressiveMass(strategy, facesWager, rawRate) {
  const aggressiveName = facesWager ? 'Raise' : 'Bet';
  const passiveName = facesWager ? 'Call' : 'Check';
  const rate = Math.min(0.12, Math.max(-0.18, rawRate));
  const adjusted = { ...strategy };
  const aggressive = Math.max(0, Number(adjusted[aggressiveName]) || 0);
  const passive = Math.max(0, Number(adjusted[passiveName]) || 0);
  if (rate > 0) {
    const shift = passive * rate;
    adjusted[aggressiveName] = aggressive + shift;
    adjusted[passiveName] = passive - shift;
  } else if (rate < 0) {
    const shift = aggressive * -rate;
    adjusted[aggressiveName] = aggressive - shift;
    adjusted[passiveName] = passive + shift;
  }
  return adjusted;
}

function legalAggressionMode(decisionContext) {
  if (decisionContext?.canRaise === false) return 'unavailable';
  if (decisionContext?.canRaise === true
    && decisionContext.minRaiseToBb === null
    && Number.isFinite(decisionContext.maxRaiseToBb)) {
    return 'short_all_in_only';
  }
  if (decisionContext?.canRaise === true) return 'regular';
  return 'unknown';
}

function normalizePercentStrategy(strategy, fallbackAction) {
  const positive = Object.entries(strategy).filter(([, value]) => (
    Number.isFinite(Number(value)) && Number(value) > 0
  ));
  const total = positive.reduce((sum, [, value]) => sum + Number(value), 0);
  if (!(total > 0)) return { [fallbackAction]: 100 };
  const normalized = Object.fromEntries(positive.map(([name, value]) => (
    [name, Number(value) * 100 / total]
  )));
  const names = Object.keys(normalized);
  normalized[names.at(-1)] += 100 - Object.values(normalized)
    .reduce((sum, value) => sum + value, 0);
  return normalized;
}

function projectLegalAggression(strategy, decisionContext, facesWager) {
  const mode = legalAggressionMode(decisionContext);
  const aggressiveName = facesWager ? 'Raise' : 'Bet';
  const passiveName = facesWager ? 'Call' : 'Check';
  const aggressivePercent = Math.max(0, Number(strategy[aggressiveName]) || 0);
  if (mode === 'unavailable') {
    const { [aggressiveName]: _removed, ...passiveOnly } = strategy;
    return {
      strategy: normalizePercentStrategy(passiveOnly, passiveName),
      mode,
      removedAggressionPercent: aggressivePercent,
      shortAllInProjectionApplied: false,
    };
  }
  if (mode === 'short_all_in_only') {
    const { [aggressiveName]: _removed, ...withAllIn } = strategy;
    if (aggressivePercent > 0) withAllIn.AllIn = aggressivePercent;
    return {
      strategy: normalizePercentStrategy(withAllIn, passiveName),
      mode,
      removedAggressionPercent: 0,
      shortAllInProjectionApplied: aggressivePercent > 0,
    };
  }
  return {
    strategy: normalizePercentStrategy(strategy, passiveName),
    mode,
    removedAggressionPercent: 0,
    shortAllInProjectionApplied: false,
  };
}

function handClassificationDetails(evaluation) {
  const draws = [];
  if (evaluation.drawFeatures?.flushDraw) {
    draws.push(evaluation.drawFeatures.nutFlushDraw ? 'Nut Flush Draw' : 'Flush Draw');
  }
  if (evaluation.drawFeatures?.isOESD) draws.push('OESD');
  else if (evaluation.drawFeatures?.isDoubleGutshot) draws.push('Double Gutshot');
  else if (evaluation.drawFeatures?.isGutshot) draws.push('Gutshot');
  return {
    canonicalCategory: evaluation.canonicalRank?.category ?? null,
    canonicalScore: evaluation.canonicalRank?.score ?? null,
    strategicCategory: evaluation.strategicCategory,
    madeHand: evaluation.madeHand,
    madeHandLabel: evaluation.madeHandLabel,
    draws,
    drawFeatures: evaluation.drawFeatures,
    boardTexture: evaluation.boardTexture,
    tripsType: evaluation.tripsType,
    usesHeroCards: evaluation.usesHeroCards,
    playsBoard: evaluation.playsBoard,
    source: 'heuristic_postflop_classifier',
  };
}

export function calculatePostflopHeuristicStrategy(decisionContext, options, rng) {
  const heroCards = decisionContext.heroCards;
  const board = decisionContext.board;
  if (!heroCards || heroCards.length !== 2 || !board || board.length < 3) {
    return { Check: 100 };
  }

  const simulation = simulateHeuristicEquity({
    heroCards,
    board,
    deadCards: decisionContext.deadCards,
    tableSize: decisionContext.tableSize,
    opponentCount: decisionContext.opponentCount,
    facingSizeBb: decisionContext.facingSizeBb,
    lastAction: decisionContext.lastAction,
    priorActionSummary: decisionContext.priorActionSummary,
    opponentStyle: options.opponentStyle,
    iterations: POSTFLOP_HEURISTIC_SAMPLES,
    rng,
  });
  return calculatePostflopStrategyFromSample(decisionContext, options, simulation);
}

export function calculatePostflopStrategyFromSample(decisionContext, options, simulation) {
  const heroCards = decisionContext.heroCards;
  const board = decisionContext.board;
  if (!heroCards || heroCards.length !== 2 || !board || board.length < 3) {
    return { Check: 100 };
  }
  const evaluation = evaluatePostflopHandStrength(heroCards, board);
  const sampledEquity = clampUnit(simulation.eq);
  if (!Number.isFinite(sampledEquity)) throw new RangeError('Heuristic sample equity must be finite');

  const potFacts = postflopDecisionPotFacts(decisionContext);
  const decisionPotBb = potFacts.value;
  const trustedCallAmount = Number.isFinite(decisionContext.callAmountBb)
    && decisionContext.callAmountBb >= 0
    ? decisionContext.callAmountBb
    : null;
  const effectiveSpr = postflopEffectiveSprFacts(decisionContext);
  const playStyle = clampUnit(options.playStyle);

  // These offsets are explicit strategic heuristics, not equity corrections.
  const categoryOffsets = {
    monster: 0.12,
    two_pair: 0.07,
    overpair: 0.05,
    top_pair: 0.04,
    middle_pair: 0.01,
    bottom_pair: -0.01,
    weak_pair: -0.03,
    flush_draw: 0.03,
    air: -0.02,
  };
  let aggressionScore = sampledEquity + (categoryOffsets[evaluation.strategicCategory] || 0);
  if (evaluation.drawFeatures?.isOESD) aggressionScore += 0.04;
  else if (evaluation.drawFeatures?.isGutshot) aggressionScore += 0.015;
  if (evaluation.drawFeatures?.nutFlushDraw) aggressionScore += 0.02;
  if (evaluation.isWetBoard && evaluation.strategicCategory === 'top_pair') aggressionScore -= 0.04;
  const baseV1StackScoreAdjustment = baseV1CompatibilityScoreAdjustment(
    evaluation,
    effectiveSpr,
  );
  aggressionScore += baseV1StackScoreAdjustment;
  aggressionScore = clampUnit(aggressionScore + playStyle * 0.05);

  const requiredRawEquity = trustedCallAmount !== null
    && trustedCallAmount > 0
    && Number.isFinite(decisionContext.requiredRawEquity)
    && decisionContext.requiredRawEquity >= 0
    && decisionContext.requiredRawEquity <= 1
    ? decisionContext.requiredRawEquity
    : null;
  const facesWager = postflopContextFacesWager(decisionContext, trustedCallAmount);
  if (facesWager && (trustedCallAmount === null || requiredRawEquity === null)) {
    throw new RangeError(
      'Postflop facing-wager strategy requires exact actor-relative call economics',
    );
  }
  let strategy;

  if (!facesWager) {
    let betPercent = linearAt(aggressionScore, [
      [0, 0], [0.35, 0], [0.5, 25], [0.65, 75], [0.85, 100], [1, 100],
    ]);
    const categoryFloor = {
      monster: 95,
      two_pair: 75,
      overpair: 60,
      top_pair: 60,
      middle_pair: 20,
      bottom_pair: 15,
      weak_pair: 10,
      flush_draw: 25,
    }[evaluation.strategicCategory] || 0;
    betPercent = Math.max(categoryFloor, betPercent);
    strategy = closedHeadsUpMix('Bet', 'Check', betPercent);
  } else {
    const continueBoundary = requiredRawEquity;
    const defendPercent = smoothBoundary(sampledEquity, continueBoundary, 0.1) * 100;
    const raiseShare = linearAt(aggressionScore, [
      [0, 0], [0.6, 0], [0.75, 0.25], [0.9, 1], [1, 1],
    ]);
    const raisePercent = defendPercent * raiseShare;
    const callPercent = defendPercent - raisePercent;
    strategy = {
      Raise: raisePercent,
      Call: callPercent,
      Fold: 100 - defendPercent,
    };
  }

  const positionAdjustment = postflopPositionAdjustment(decisionContext, facesWager);
  const sprAdjustment = postflopSprAdjustment(evaluation, effectiveSpr);
  const historyAdjustment = postflopHistoryAdjustment(decisionContext);
  const multiwayAdjustment = postflopMultiwayAdjustment(decisionContext);
  const combinedAggressionReallocationRate = positionAdjustment.rate
    + sprAdjustment.rate
    + historyAdjustment.rate
    + multiwayAdjustment.rate;
  strategy = reallocateAggressiveMass(
    strategy,
    facesWager,
    combinedAggressionReallocationRate,
  );
  const legalProjection = projectLegalAggression(strategy, decisionContext, facesWager);
  strategy = legalProjection.strategy;

  strategy.context = {
    heuristicSample: {
      ...simulation,
      eq: sampledEquity,
      provenance: 'heuristic_conditional_sample',
    },
    handClassification: handClassificationDetails(evaluation),
    aggressionScore,
    sampledEquity,
    requiredRawEquity,
    actorContestablePotAfterCallBbUsed: requiredRawEquity === null
      ? null
      : decisionContext.actorContestablePotAfterCallBb,
    priceSource: trustedCallAmount === null
      ? 'unavailable_scenario_price'
      : decisionPotBb === null && trustedCallAmount > 0
        ? 'unavailable_current_pot'
      : trustedCallAmount === 0 ? 'trusted_free_action' : 'trusted_call_amount',
    priceDependentAdjustmentApplied: requiredRawEquity !== null,
    facesWager,
    currentPotBbUsed: potFacts.kind === 'decision_context_v1.1_current_pot'
      ? decisionPotBb
      : null,
    compatibilityPotBbUsed: potFacts.kind === 'base_v1_compatibility_pot'
      ? decisionPotBb
      : null,
    potSemantics: potFacts.kind,
    effectiveSpr,
    stackSemantics: effectiveSpr.kind === 'heads_up_exact_effective_spr'
      ? 'decision_context_v1.1_heads_up_effective_stack'
      : effectiveSpr.kind === 'multiway_per_opponent_spr_range'
        ? 'per_opponent_multiway_range_scalar_adjustment_disabled'
        : effectiveSpr.kind === 'base_v1_compatibility_spr'
          ? 'base_v1_compatibility_stack_not_live_or_effective'
          : 'live_effective_stack_unavailable_no_compatibility_fallback',
    playStyle,
    opponentStyle: clampUnit(options.opponentStyle),
    playStyleSemantics: 'continuous_aggression_bias',
    opponentStyleSemantics: 'higher_value_samples_a_looser_assumed_range',
    positionAdjustment,
    positionAdjustmentApplied: positionAdjustment.applied,
    sprAdjustment,
    baseV1StackScoreAdjustment,
    historyAdjustment,
    multiwayAdjustment,
    combinedAggressionReallocationRate: Math.min(
      0.12,
      Math.max(-0.18, combinedAggressionReallocationRate),
    ),
    legalAggression: {
      mode: legalProjection.mode,
      canRaise: decisionContext.canRaise ?? null,
      minRaiseToBb: Number.isFinite(decisionContext.minRaiseToBb)
        ? decisionContext.minRaiseToBb
        : null,
      maxRaiseToBb: Number.isFinite(decisionContext.maxRaiseToBb)
        ? decisionContext.maxRaiseToBb
        : null,
      allInToBb: Number.isFinite(decisionContext.allInToBb)
        ? decisionContext.allInToBb
        : null,
      removedAggressionPercent: legalProjection.removedAggressionPercent,
      shortAllInProjectionApplied: legalProjection.shortAllInProjectionApplied,
    },
    flatDropApplied: false,
    flatDropBbIgnored: Number.isFinite(Number(options.flatDropBb))
      ? Math.max(0, Number(options.flatDropBb))
      : 0,
    sizingSemantics: legalProjection.shortAllInProjectionApplied
      ? 'all_in_action_family_only_legal_bounds_are_not_strategy_sizing'
      : 'generic_aggressive_action_legal_bounds_are_not_strategy_sizing',
  };
  return strategy;
}
