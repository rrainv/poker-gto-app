import { ACTION_TYPES } from '../../../shared/poker-domain/index.js';
import { isStrategyResultV1 } from './strategy-result.mjs';
import { projectStrategyTruth, historicalStrategyTruth } from './strategy-truth.mjs';

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
  const candidates = strategyResult.actions
    .filter((entry) => strategyType(entry) === canonicalActionType)
    .sort((left, right) => right.probability - left.probability);
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
  chosenAction = null,
  historicalEvidence = null,
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


  const chosenProbability = best ? mapped?.probability ?? 0 : null;
  const bestProbability = best?.probability ?? null;
  const probabilityGap = Math.max(0, bestProbability - chosenProbability);
  const grade = !best ? null : probabilityGap <= OPTIMAL_PROBABILITY_GAP
    ? 'optimal'
    : chosenProbability > 0
      && probabilityGap <= ACCEPTABLE_PROBABILITY_GAP + Number.EPSILON
      ? 'acceptable'
      : 'mistake';
  const action = { type: chosenActionType, amountBb: Number.isSafeInteger(chosenAction?.amountToMilliBb)
    ? chosenAction.amountToMilliBb / 1000 : chosenAction?.amountBb ?? null };
  const truth = historicalEvidence
    ? historicalStrategyTruth(historicalEvidence, { chosenAction: action, decisionContext })
    : projectStrategyTruth({ strategyResult, chosenAction: action, decisionContext });
  const accepted = truth.state === 'normative_assessment' && truth.outcome === 'supported' && truth.claims.correct;

  return deepFreeze({
    schemaVersion: TRAINING_ANSWER_EVALUATION_SCHEMA_VERSION,
    truth,
    comparisonAccepted: grade !== null && grade !== 'mistake',
    comparisonGrade: grade,
    exerciseId,
    chosenAction: { type: chosenActionType },
    mappedStrategyAction: mapped,
    chosenProbability,
    bestProbability,
    bestStrategyAction: {
      type: strategyType(best),
      label: best?.label ?? null,
    },
    grade: truth.state === 'normative_assessment' ? truth.outcome === 'supported' ? 'optimal' : 'mistake' : grade,
    accepted,
    scoreDelta: accepted ? 1 : 0,
    explanationData: {
      probabilityGap,
      source: strategyResult.source,
      chosenEvBb: mapped?.evBb ?? null,
      bestEvBb: Number.isFinite(best?.evBb) ? Number(best.evBb) : null,
      evAvailable: Number.isFinite(mapped?.evBb) && Number.isFinite(best?.evBb),
    },
  });
}
