import { ACTION_TYPES } from '../../../shared/poker-domain/index.js';
import { isStrategyResultV1 } from './strategy-result.mjs';

export const TRAINING_ANSWER_EVALUATION_SCHEMA_VERSION =
  'training-answer-evaluation/v1';

const CANONICAL_ACTION_TYPES = Object.freeze(new Set(Object.values(ACTION_TYPES)));
const OPTIMAL_PROBABILITY_GAP = 0.05;
const ACCEPTABLE_PROBABILITY_GAP = 0.15;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function strategyType(entry) {
  return entry?.action?.type ?? null;
}

/**
 * Explicit lossy boundary from canonical Action v1 types to StrategyResult
 * buckets. Bet and raise remain distinct; preflop Open/3-Bet/4-Bet labels all
 * map to the canonical raise family. Model action indices never enter here.
 */
export function mapCanonicalActionToStrategyAction(
  canonicalActionType,
  strategyResult,
  decisionContext = null,
) {
  if (!CANONICAL_ACTION_TYPES.has(canonicalActionType)) {
    throw new RangeError(`Unsupported canonical training action: ${canonicalActionType}`);
  }
  if (!isStrategyResultV1(strategyResult)) {
    throw new TypeError('Training grading requires StrategyResult v1');
  }
  let candidates = strategyResult.actions
    .filter((entry) => strategyType(entry) === canonicalActionType)
    .sort((left, right) => right.probability - left.probability);
  // The current preflop heuristic predates Action v1 and stores the BB's free
  // check in its passive `call` bucket. Keep that compatibility rule explicit
  // at this adapter boundary instead of changing either source contract.
  if (candidates.length === 0
    && canonicalActionType === ACTION_TYPES.CHECK
    && decisionContext?.street === 'preflop'
    && decisionContext?.heroPosition === 'BB'
    && decisionContext?.facingSizeBb === 0) {
    candidates = strategyResult.actions
      .filter((entry) => strategyType(entry) === ACTION_TYPES.CALL)
      .sort((left, right) => right.probability - left.probability);
  }
  const selected = candidates[0] ?? null;
  return selected === null ? null : deepFreeze({
    type: strategyType(selected),
    label: selected.label,
    probability: selected.probability,
    evBb: Number.isFinite(selected.evBb) ? Number(selected.evBb) : null,
  });
}

export function evaluateTrainingAnswer({
  exerciseId,
  chosenActionType,
  strategyResult,
  decisionContext = null,
} = {}) {
  if (typeof exerciseId !== 'string' || !exerciseId) {
    throw new TypeError('exerciseId is required');
  }
  const mapped = mapCanonicalActionToStrategyAction(
    chosenActionType,
    strategyResult,
    decisionContext,
  );
  const gradeableActions = strategyResult.actions.filter((entry) => (
    CANONICAL_ACTION_TYPES.has(strategyType(entry))
  ));
  const best = gradeableActions.reduce(
    (current, entry) => (!current || entry.probability > current.probability ? entry : current),
    null,
  );
  if (!best) throw new RangeError('StrategyResult has no gradeable actions');

  const chosenProbability = mapped?.probability ?? 0;
  const bestProbability = best.probability;
  const probabilityGap = Math.max(0, bestProbability - chosenProbability);
  const grade = probabilityGap <= OPTIMAL_PROBABILITY_GAP
    ? 'optimal'
    : chosenProbability > 0
      && probabilityGap <= ACCEPTABLE_PROBABILITY_GAP + Number.EPSILON
      ? 'acceptable'
      : 'mistake';
  const accepted = grade !== 'mistake';

  return deepFreeze({
    schemaVersion: TRAINING_ANSWER_EVALUATION_SCHEMA_VERSION,
    exerciseId,
    chosenAction: { type: chosenActionType },
    mappedStrategyAction: mapped,
    chosenProbability,
    bestProbability,
    bestStrategyAction: {
      type: strategyType(best),
      label: best.label,
    },
    grade,
    accepted,
    scoreDelta: accepted ? 1 : 0,
    explanationData: {
      probabilityGap,
      source: strategyResult.source,
      chosenEvBb: mapped?.evBb ?? null,
      bestEvBb: Number.isFinite(best.evBb) ? Number(best.evBb) : null,
      evAvailable: Number.isFinite(mapped?.evBb) && Number.isFinite(best.evBb),
    },
  });
}
