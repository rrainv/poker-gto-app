import { evaluateTrainingAnswer } from './training-answer-evaluation.mjs';
import {
  STRATEGY_CLAIMS,
  canStrategyClaim,
  resolveStrategyClaimPolicy,
} from './strategy-claim-policy.mjs';
import { isStrategyResultV1 } from './strategy-result.mjs';

export const HAND_REVIEW_SCHEMA_VERSION = 'hand-review/v1';
export const HAND_REVIEW_FRAME_CONVENTION = 'pre_action_event_sequence';

export const HAND_REVIEW_SOURCES = Object.freeze({
  CANONICAL_HAND: 'canonical_hand',
  TRAINING_FULL_HAND: 'training_full_hand',
});

export const HAND_REVIEW_COMPARISONS = Object.freeze({
  MATCHES: 'matches',
  CLOSE: 'close',
  DIFFERS: 'differs',
  UNAVAILABLE: 'unavailable',
});

const ACTION_ORDER = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const ACTION_SPEC_KEYS = Object.freeze({ all_in: 'allIn' });
const COMPARISON_BY_GRADE = Object.freeze({
  optimal: HAND_REVIEW_COMPARISONS.MATCHES,
  acceptable: HAND_REVIEW_COMPARISONS.CLOSE,
  mistake: HAND_REVIEW_COMPARISONS.DIFFERS,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function clone(value) {
  return value === null || value === undefined ? value : structuredClone(value);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

function decisionsFrom(input) {
  const decisions = input?.decisions;
  if (!Array.isArray(decisions)) throw new TypeError('Hand Review decisions must be an array');
  return decisions;
}

function decisionReplayPoint(decision) {
  return decision?.occurrence?.replayPoint ?? decision?.replayPoint ?? null;
}

function strategyResultFromDecision(decision) {
  return decision?.strategyResult
    ?? decision?.evaluation?.strategyResult
    ?? null;
}

function answerEvaluationFromDecision(decision) {
  return decision?.evaluation?.answerEvaluation
    ?? decision?.answerEvaluation
    ?? null;
}

function validateDecision(decision, index) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new TypeError(`Hand Review decision ${index} must be an object`);
  }
  requireNonEmptyString(decision.decisionId, `decisions[${index}].decisionId`);
  if (!Number.isSafeInteger(decision.decisionOrdinal) || decision.decisionOrdinal < 0) {
    throw new RangeError(`decisions[${index}].decisionOrdinal must be nonnegative`);
  }
  if (!decision.decisionContext || decision.decisionContext.schemaVersion !== 'decision-context/v1') {
    throw new TypeError(`decisions[${index}] requires DecisionContext v1`);
  }
  const replayPoint = decisionReplayPoint(decision);
  if (!replayPoint || !Number.isSafeInteger(replayPoint.eventSequence)
    || replayPoint.eventSequence < 0) {
    throw new TypeError(`decisions[${index}] requires an exact canonical replay point`);
  }
  if (!decision.chosenAction || typeof decision.chosenAction.type !== 'string') {
    throw new TypeError(`decisions[${index}] requires a chosen canonical action`);
  }
  return replayPoint;
}

function legalAlternatives(legalActionSpec) {
  if (!legalActionSpec || typeof legalActionSpec !== 'object') return [];
  return ACTION_ORDER.flatMap((type) => {
    const spec = legalActionSpec[ACTION_SPEC_KEYS[type] ?? type];
    if (spec?.available !== true) return [];
    const action = { type };
    if (type === 'call') {
      action.commitMilliBb = Number.isSafeInteger(spec.commitMilliBb) ? spec.commitMilliBb : null;
      action.isAllIn = spec.allIn === true;
    } else if (type === 'bet' || type === 'raise') {
      action.minToMilliBb = Number.isSafeInteger(spec.minToMilliBb) ? spec.minToMilliBb : null;
      action.maxToMilliBb = Number.isSafeInteger(spec.maxToMilliBb) ? spec.maxToMilliBb : null;
    } else if (type === 'all_in') {
      action.amountToMilliBb = Number.isSafeInteger(spec.amountToMilliBb)
        ? spec.amountToMilliBb : null;
    }
    return [action];
  });
}

function chosenActionPresentation(decision) {
  const type = decision.chosenAction.type;
  const result = decision.chosenActionResult ?? null;
  let amountKind = 'none';
  let amountMilliBb = null;
  if (type === 'bet' || type === 'raise') {
    amountKind = 'amount_to';
    amountMilliBb = decision.chosenAction.amountToMilliBb;
  } else if (type === 'call') {
    amountKind = 'commit';
    amountMilliBb = result?.committedMilliBb;
  } else if (type === 'all_in') {
    amountKind = 'amount_to';
    amountMilliBb = result?.streetContributionAfterMilliBb;
  }
  return {
    type,
    amountKind,
    amountMilliBb: Number.isSafeInteger(amountMilliBb) ? amountMilliBb : null,
    committedMilliBb: Number.isSafeInteger(result?.committedMilliBb)
      ? result.committedMilliBb : null,
    wasAllIn: type === 'all_in' || result?.wasAllIn === true,
  };
}

function resolveEvaluation(decision, strategyResult) {
  const existing = answerEvaluationFromDecision(decision);
  if (existing) return existing;
  if (!isStrategyResultV1(strategyResult) || strategyResult.actions.length === 0) return null;
  try {
    return evaluateTrainingAnswer({
      exerciseId: decision.decisionId,
      chosenActionType: decision.chosenAction.type,
      strategyResult,
      decisionContext: decision.decisionContext,
    });
  } catch {
    return null;
  }
}

function distributionFor(strategyResult, policy) {
  if (!isStrategyResultV1(strategyResult)
    || !canStrategyClaim(policy, STRATEGY_CLAIMS.STRATEGY_PRESENTATION)) return [];
  return strategyResult.actions.map((entry) => ({
    type: entry.action.type,
    label: entry.label,
    probability: entry.probability,
    amountToBb: Number.isFinite(entry.action.amountToBb) ? entry.action.amountToBb : null,
  }));
}

function limitationCodes(decision, policy, distribution) {
  const codes = new Set((policy?.limitations || []).map((entry) => entry.code));
  const context = decision.decisionContext;
  const chosenType = decision.chosenAction.type;
  if (policy?.availability !== 'available') codes.add('reference_unavailable');
  if (policy?.coverage?.kind === 'generalized') codes.add('generalized_context');
  if (context.callAmountBb === null && ['call', 'fold', 'raise', 'all_in'].includes(chosenType)) {
    codes.add('missing_exact_call_price');
  }
  if (['bet', 'raise', 'all_in'].includes(chosenType)
    && !canStrategyClaim(policy, STRATEGY_CLAIMS.ACTION_SIZING)) {
    codes.add('sizing_not_compared');
  }
  if (distribution.length > 0 && !distribution.some((entry) => entry.type === chosenType)) {
    codes.add('legal_action_not_represented');
  }
  if ((context.opponentCount ?? 0) > 1 && context.effectiveStackBb === null) {
    codes.add('multiway_effective_stacks');
  }
  return [...codes];
}

function comparisonFor(policy, evaluation, limitationCodeList) {
  const permitted = canStrategyClaim(policy, STRATEGY_CLAIMS.COMPARATIVE_GRADING)
    || canStrategyClaim(policy, STRATEGY_CLAIMS.NORMATIVE_GRADING);
  if (!permitted || !evaluation) {
    return {
      state: HAND_REVIEW_COMPARISONS.UNAVAILABLE,
      semantics: 'unavailable',
      chosenProbability: null,
      highestProbability: null,
      highestActionType: null,
      probabilityGap: null,
    };
  }
  return {
    state: COMPARISON_BY_GRADE[evaluation.grade] ?? HAND_REVIEW_COMPARISONS.UNAVAILABLE,
    semantics: policy.trainingSemantics,
    chosenProbability: evaluation.chosenProbability,
    highestProbability: evaluation.bestProbability,
    highestActionType: evaluation.bestStrategyAction?.type ?? null,
    probabilityGap: evaluation.explanationData?.probabilityGap ?? null,
    actionFamilyOnly: limitationCodeList.includes('sizing_not_compared'),
  };
}

function sourcePresentation(policy) {
  return {
    id: policy.source.id,
    displayNameKey: policy.source.displayNameKey,
    version: policy.sourceVersion,
    family: policy.source.family,
    authority: policy.authority,
    coverage: policy.coverage.kind,
    coverageBasis: policy.coverage.basis,
    distributionPrecision: policy.capabilities.actionDistribution,
    exactFrequencies: canStrategyClaim(policy, STRATEGY_CLAIMS.EXACT_FREQUENCIES),
    limitationCodes: policy.limitations.map((entry) => entry.code),
    primaryLimitation: policy.primaryLimitation
      ? {
        code: policy.primaryLimitation.code,
        messageKey: policy.primaryLimitation.messageKey,
      }
      : null,
  };
}

function projectDecision(decision, strategyResult, replayPoint) {
  const policy = resolveStrategyClaimPolicy(strategyResult);
  const evaluation = resolveEvaluation(decision, strategyResult);
  const distribution = distributionFor(strategyResult, policy);
  const limitations = limitationCodes(decision, policy, distribution);
  const comparison = comparisonFor(policy, evaluation, limitations);
  const context = decision.decisionContext;
  const actionSequence = Number.isSafeInteger(decision.chosenActionResult?.actionSequence)
    ? decision.chosenActionResult.actionSequence
    : replayPoint.actionSequence;

  return {
    decisionId: decision.decisionId,
    decisionIndex: decision.decisionOrdinal,
    decisionNumber: decision.decisionOrdinal + 1,
    street: decision.street ?? context.street,
    replayFrameTarget: {
      frameIndex: replayPoint.eventSequence,
      eventSequence: replayPoint.eventSequence,
      actionSequence,
      convention: HAND_REVIEW_FRAME_CONVENTION,
    },
    durable: {
      handId: decision.handId ?? null,
      heroPosition: decision.currentActor?.position ?? context.heroPosition,
      heroCards: [...(decision.heroCards ?? context.heroCards ?? [])],
      board: [...(decision.board ?? context.board ?? [])],
      decisionContext: clone(context),
      canonicalFacts: clone(decision.canonicalFacts ?? null),
      legalActionSpec: clone(decision.legalActions ?? null),
      chosenAction: clone(decision.chosenAction),
      chosenActionResult: clone(decision.chosenActionResult ?? null),
      rulesSnapshot: clone(decision.rulesSnapshot ?? null),
    },
    context: {
      opponentCount: context.opponentCount,
      positionRelation: context.positionRelation,
      facingActionFamily: context.priorActionSummary?.facingActionFamily ?? context.lastAction,
      aggressorPosition: context.priorActionSummary?.aggressorPosition ?? null,
      potBb: context.currentPotBb ?? context.potBb,
      actorContestablePotAfterCallBb: context.actorContestablePotAfterCallBb ?? null,
      actorIneligiblePotAfterCallBb: context.actorIneligiblePotAfterCallBb ?? null,
      requiredRawEquity: context.requiredRawEquity ?? null,
      heroStackBb: context.heroStackBb,
      effectiveStackBb: context.effectiveStackBb,
      effectiveStackByOpponent: clone(context.effectiveStackByOpponent ?? []),
      callAmountBb: context.callAmountBb,
      facingSizeBb: context.facingSizeBb,
    },
    chosenAction: chosenActionPresentation(decision),
    legalAlternatives: legalAlternatives(decision.legalActions),
    strategyResult,
    claimPolicy: policy,
    source: sourcePresentation(policy),
    distribution,
    comparison,
    limitations,
    reviewPriority: Number.isFinite(comparison.probabilityGap)
      ? {
        kind: 'reference_disagreement',
        value: comparison.probabilityGap,
      }
      : null,
  };
}

function terminalOverview(completedHandResult, heroPlayerId) {
  const result = completedHandResult ?? null;
  const heroDelta = Number.isSafeInteger(result?.stackDeltasMilliBbByPlayer?.[heroPlayerId])
    ? result.stackDeltasMilliBbByPlayer[heroPlayerId]
    : null;
  return {
    terminalReason: result?.terminalReason ?? null,
    finalBoard: [...(result?.finalBoard ?? [])],
    heroStackDeltaMilliBb: heroDelta,
    awardedPotMilliBb: Number.isSafeInteger(result?.accounting?.payoutTotalMilliBb)
      ? result.accounting.payoutTotalMilliBb
      : null,
  };
}

function overviewFor(decisions, completedHandResult, heroPlayerId, selectedIndex) {
  const comparable = decisions.filter((decision) => (
    decision.comparison.state !== HAND_REVIEW_COMPARISONS.UNAVAILABLE
  ));
  const unavailableCount = decisions.length - comparable.length;
  const alignmentCounts = {
    matches: comparable.filter((decision) => decision.comparison.state === 'matches').length,
    close: comparable.filter((decision) => decision.comparison.state === 'close').length,
    differs: comparable.filter((decision) => decision.comparison.state === 'differs').length,
  };
  const sourceIds = [...new Set(decisions.map((decision) => decision.source.id))];
  return {
    ...terminalOverview(completedHandResult, heroPlayerId),
    decisionCount: decisions.length,
    comparableDecisionCount: comparable.length,
    unavailableDecisionCount: unavailableCount,
    generalizedDecisionCount: decisions.filter((decision) => (
      decision.source.coverage === 'generalized'
    )).length,
    alignmentSummaryPermitted: comparable.length > 0,
    alignmentCounts,
    sourceIds,
    selectedReference: decisions[selectedIndex]?.source ?? null,
  };
}

function priorityDecisionIndex(decisions) {
  let bestIndex = 0;
  let bestValue = -1;
  decisions.forEach((decision, index) => {
    const value = decision.reviewPriority?.value;
    if (Number.isFinite(value) && value > bestValue) {
      bestIndex = index;
      bestValue = value;
    }
  });
  return bestIndex;
}

function normalizeSelectedIndex(requestedIndex, decisions) {
  if (decisions.length === 0) return null;
  if (requestedIndex === null || requestedIndex === undefined) return priorityDecisionIndex(decisions);
  if (!Number.isSafeInteger(requestedIndex)) {
    throw new TypeError('selectedDecisionIndex must be an integer or null');
  }
  if (requestedIndex < 0 || requestedIndex >= decisions.length) {
    throw new RangeError(`Unknown Hand Review decision index: ${requestedIndex}`);
  }
  return requestedIndex;
}

function replayState(replayProjection, selectedDecision) {
  const frameIndex = replayProjection?.selectedFrameIndex ?? null;
  return {
    currentFrameIndex: frameIndex,
    currentStep: replayProjection?.currentStep ?? null,
    totalSteps: replayProjection?.totalSteps ?? null,
    canPrevious: replayProjection?.canPrevious === true,
    canNext: replayProjection?.canNext === true,
    synchronizedToSelectedDecision: frameIndex === selectedDecision?.replayFrameTarget.frameIndex,
  };
}

/**
 * Creates a deterministic, storage-neutral Review projector. Strategy work is
 * cached by durable Hand/decision identity plus the caller's provider context
 * key, and never runs merely because the Replay cursor moved.
 */
export function createHandReviewProjector({ resolveStrategy = null } = {}) {
  if (resolveStrategy !== null && typeof resolveStrategy !== 'function') {
    throw new TypeError('resolveStrategy must be a function');
  }
  const strategyCache = new Map();
  let resolutionCount = 0;

  const resolveDecisionStrategy = (handId, decision, providerCacheKey) => {
    const existing = strategyResultFromDecision(decision);
    if (existing) return existing;
    if (resolveStrategy === null) return null;
    const key = `${handId}:${decision.decisionId}:${providerCacheKey}`;
    if (strategyCache.has(key)) return strategyCache.get(key);
    const result = resolveStrategy(decision.decisionContext);
    if (!isStrategyResultV1(result)) {
      throw new TypeError('Hand Review strategy resolution requires StrategyResult v1');
    }
    strategyCache.set(key, result);
    resolutionCount += 1;
    return result;
  };

  return Object.freeze({
    schemaVersion: HAND_REVIEW_SCHEMA_VERSION,

    project({
      source,
      handId,
      heroPlayerId,
      decisions: suppliedDecisions,
      completedHandResult = null,
      replayProjection = null,
      selectedDecisionIndex = null,
      providerCacheKey = 'default',
      actions = {},
    } = {}) {
      if (!Object.values(HAND_REVIEW_SOURCES).includes(source)) {
        throw new RangeError(`Unsupported Hand Review source: ${source}`);
      }
      requireNonEmptyString(handId, 'handId');
      requireNonEmptyString(heroPlayerId, 'heroPlayerId');
      const rawDecisions = decisionsFrom({ decisions: suppliedDecisions });
      const projectedDecisions = rawDecisions.map((decision, index) => {
        const replayPoint = validateDecision(decision, index);
        const strategyResult = resolveDecisionStrategy(
          handId,
          decision,
          String(providerCacheKey),
        );
        return projectDecision(decision, strategyResult, replayPoint);
      });
      const resolvedIndex = normalizeSelectedIndex(selectedDecisionIndex, projectedDecisions);
      const selectedDecision = resolvedIndex === null ? null : projectedDecisions[resolvedIndex];
      const priorityIndex = projectedDecisions.length === 0
        ? null
        : priorityDecisionIndex(projectedDecisions);
      const review = {
        schemaVersion: HAND_REVIEW_SCHEMA_VERSION,
        source,
        handId,
        heroPlayerId,
        status: completedHandResult ? 'ready' : 'open',
        frameConvention: {
          id: HAND_REVIEW_FRAME_CONVENTION,
          description: 'Replay eventSequence identifies the immutable state before Hero acted.',
        },
        overview: overviewFor(
          projectedDecisions,
          completedHandResult,
          heroPlayerId,
          resolvedIndex,
        ),
        decisions: projectedDecisions,
        selectedDecisionIndex: resolvedIndex,
        selectedDecision,
        priorityDecisionIndex: priorityIndex,
        replay: replayState(replayProjection, selectedDecision),
        navigation: {
          canPreviousDecision: resolvedIndex !== null && resolvedIndex > 0,
          canNextDecision: resolvedIndex !== null && resolvedIndex < projectedDecisions.length - 1,
        },
        actions: {
          analyze: actions.analyze === true && selectedDecision !== null,
          saveHand: actions.saveHand === true,
          saveSpot: actions.saveSpot === true && selectedDecision !== null,
          repeat: source === HAND_REVIEW_SOURCES.TRAINING_FULL_HAND && actions.repeat === true,
          next: source === HAND_REVIEW_SOURCES.TRAINING_FULL_HAND && actions.next === true,
          returnToCompleted: actions.returnToCompleted !== false,
        },
        extensionSeam: {
          comparisonRoles: ['reference', 'personal_strategy', 'observed_action'],
          activeRoles: ['reference', 'observed_action'],
        },
      };
      return deepFreeze(review);
    },

    clear(handId = null) {
      if (handId === null) strategyCache.clear();
      else {
        const prefix = `${handId}:`;
        [...strategyCache.keys()].forEach((key) => {
          if (key.startsWith(prefix)) strategyCache.delete(key);
        });
      }
    },

    getDiagnostics() {
      return deepFreeze({
        schemaVersion: 'hand-review-diagnostics/v1',
        resolutionCount,
        cacheEntryCount: strategyCache.size,
      });
    },
  });
}

export function createHandReviewAnalysisHandoff(review, decisionIndex = review?.selectedDecisionIndex) {
  if (!review || review.schemaVersion !== HAND_REVIEW_SCHEMA_VERSION || review.status !== 'ready') {
    throw new TypeError('A ready Hand Review v1 projection is required');
  }
  if (!Number.isSafeInteger(decisionIndex) || decisionIndex < 0) {
    throw new RangeError('decisionIndex must be a nonnegative integer');
  }
  const decision = review.decisions[decisionIndex];
  if (!decision) throw new RangeError(`Unknown Hand Review decision index: ${decisionIndex}`);
  return deepFreeze({
    schemaVersion: 'hand-review-analysis-handoff/v1',
    derivation: review.source,
    historyAvailability: 'exact_replay_point_only',
    decisionId: decision.decisionId,
    decisionIndex,
    replayFrameTarget: clone(decision.replayFrameTarget),
    decisionContext: clone(decision.durable.decisionContext),
    rulesSnapshot: clone(decision.durable.rulesSnapshot),
  });
}
