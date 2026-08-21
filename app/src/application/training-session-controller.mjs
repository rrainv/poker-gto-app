import { ACTION_TYPES } from '../../../shared/poker-domain/index.js';
import { evaluateTrainingAnswer } from './training-answer-evaluation.mjs';
import {
  generateTrainingExercise,
  generateTrainingExerciseFromScenarioRequest,
} from './training-generator.mjs';
import {
  createTrainingPracticePlannerState,
  createTrainingSessionIntent,
  planTrainingScenario,
  recordServedTrainingScenario,
} from './training-practice-planner.mjs';

export const TRAINING_SESSION_SCHEMA_VERSION = 'training-session/v1';
export const TRAINING_SESSION_ERROR_SCHEMA_VERSION = 'training-session-error/v1';

export const TRAINING_SESSION_ERROR_CODES = Object.freeze({
  NOT_READY: 'not_ready',
  STALE_GENERATION: 'stale_generation',
  STALE_EXERCISE: 'stale_exercise',
  ALREADY_ANSWERED: 'already_answered',
  ILLEGAL_ANSWER: 'illegal_answer',
  GENERATION_FAILED: 'generation_failed',
  EVALUATION_FAILED: 'evaluation_failed',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function sessionFailure(code, message, details = {}) {
  return deepFreeze({
    ok: false,
    error: {
      schemaVersion: TRAINING_SESSION_ERROR_SCHEMA_VERSION,
      code,
      message,
      details: { ...details },
    },
  });
}

function initialSnapshot() {
  return deepFreeze({
    schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
    status: 'idle',
    requestId: null,
    exercise: null,
    evaluation: null,
    error: null,
  });
}

function legalAnswerTypes(exercise) {
  const spec = exercise?.legalActions;
  if (!spec) return [];
  return [
    ACTION_TYPES.FOLD,
    ACTION_TYPES.CHECK,
    ACTION_TYPES.CALL,
    ACTION_TYPES.BET,
    ACTION_TYPES.RAISE,
    ACTION_TYPES.ALL_IN,
  ].filter((type) => (
    type === ACTION_TYPES.ALL_IN ? spec.allIn?.available : spec[type]?.available
  ));
}

export function createTrainingSessionController({
  generateExercise = generateTrainingExercise,
  generateScenarioRequestExercise = generateTrainingExerciseFromScenarioRequest,
  evaluateAnswer = evaluateTrainingAnswer,
} = {}) {
  let sequence = 0;
  let snapshot = initialSnapshot();
  let practiceSession = null;

  const controller = {
    async generate(config, { strategyProvider } = {}) {
      practiceSession = null;
      const requestId = `training-request-${++sequence}`;
      snapshot = deepFreeze({
        schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
        status: 'generating',
        requestId,
        exercise: null,
        evaluation: null,
        error: null,
      });

      let result;
      try {
        result = await Promise.resolve().then(() => (
          generateExercise(config, { strategyProvider })
        ));
      } catch (error) {
        result = sessionFailure(
          TRAINING_SESSION_ERROR_CODES.GENERATION_FAILED,
          'Training generation failed unexpectedly.',
          { message: error instanceof Error ? error.message : String(error) },
        );
      }

      if (snapshot.requestId !== requestId || snapshot.status !== 'generating') {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.STALE_GENERATION,
          'A newer Training request replaced this generation.',
          { requestId },
        );
      }

      if (!result?.ok) {
        snapshot = deepFreeze({
          schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
          status: 'error',
          requestId,
          exercise: null,
          evaluation: null,
          error: result?.error ?? null,
        });
        return result;
      }

      snapshot = deepFreeze({
        schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
        status: 'ready',
        requestId,
        exercise: result.exercise,
        evaluation: null,
        error: null,
      });
      return result;
    },

    startPracticeSession(intent) {
      const normalizedIntent = createTrainingSessionIntent(intent);
      sequence += 1;
      snapshot = initialSnapshot();
      practiceSession = Object.freeze({
        intent: normalizedIntent,
        plannerState: createTrainingPracticePlannerState(normalizedIntent),
      });
      return practiceSession.plannerState;
    },

    async generatePlanned({ strategyProvider } = {}) {
      if (!practiceSession) {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.NOT_READY,
          'No Training practice session has been started.',
        );
      }

      const activePracticeSession = practiceSession;
      const requestId = `training-request-${++sequence}`;
      snapshot = deepFreeze({
        schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
        status: 'generating',
        requestId,
        exercise: null,
        evaluation: null,
        error: null,
      });

      let planned;
      try {
        planned = planTrainingScenario(
          activePracticeSession.intent,
          activePracticeSession.plannerState,
          activePracticeSession.plannerState.servedCount,
        );
      } catch (error) {
        planned = sessionFailure(
          TRAINING_SESSION_ERROR_CODES.GENERATION_FAILED,
          'Training practice planning failed unexpectedly.',
          { message: error instanceof Error ? error.message : String(error) },
        );
      }

      if (!planned?.ok) {
        if (snapshot.requestId === requestId && snapshot.status === 'generating') {
          snapshot = deepFreeze({
            schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
            status: 'error',
            requestId,
            exercise: null,
            evaluation: null,
            error: planned?.error ?? null,
          });
        }
        return planned;
      }

      let result;
      try {
        result = await Promise.resolve().then(() => (
          generateScenarioRequestExercise(planned.request, {
            rulesSnapshot: activePracticeSession.intent.rulesSnapshot,
            strategyProvider,
          })
        ));
      } catch (error) {
        result = sessionFailure(
          TRAINING_SESSION_ERROR_CODES.GENERATION_FAILED,
          'Training generation failed unexpectedly.',
          { message: error instanceof Error ? error.message : String(error) },
        );
      }

      if (snapshot.requestId !== requestId
        || snapshot.status !== 'generating'
        || practiceSession !== activePracticeSession) {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.STALE_GENERATION,
          'A newer Training request replaced this generation.',
          { requestId },
        );
      }

      if (!result?.ok) {
        snapshot = deepFreeze({
          schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
          status: 'error',
          requestId,
          exercise: null,
          evaluation: null,
          error: result?.error ?? null,
        });
        return result;
      }

      let plannerState;
      try {
        plannerState = recordServedTrainingScenario(
          activePracticeSession.plannerState,
          planned.request,
        );
      } catch (error) {
        const failed = sessionFailure(
          TRAINING_SESSION_ERROR_CODES.GENERATION_FAILED,
          'The served Training exercise could not update planner coverage.',
          { message: error instanceof Error ? error.message : String(error) },
        );
        snapshot = deepFreeze({
          schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
          status: 'error',
          requestId,
          exercise: null,
          evaluation: null,
          error: failed.error,
        });
        return failed;
      }

      practiceSession = Object.freeze({
        intent: activePracticeSession.intent,
        plannerState,
      });
      snapshot = deepFreeze({
        schemaVersion: TRAINING_SESSION_SCHEMA_VERSION,
        status: 'ready',
        requestId,
        exercise: result.exercise,
        evaluation: null,
        error: null,
      });
      return result;
    },

    answer(exerciseId, chosenActionType) {
      if (snapshot.status === 'answered') {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.ALREADY_ANSWERED,
          'This Training exercise has already been answered.',
          { exerciseId },
        );
      }
      if (snapshot.status !== 'ready' || !snapshot.exercise) {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.NOT_READY,
          'No Training exercise is ready for an answer.',
        );
      }
      if (snapshot.exercise.id !== exerciseId) {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.STALE_EXERCISE,
          'The answer belongs to an older Training exercise.',
          { expectedExerciseId: snapshot.exercise.id, exerciseId },
        );
      }
      if (!legalAnswerTypes(snapshot.exercise).includes(chosenActionType)) {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.ILLEGAL_ANSWER,
          'The selected action is not legal in the canonical poker state.',
          { chosenActionType, legalActionTypes: legalAnswerTypes(snapshot.exercise) },
        );
      }

      let evaluation;
      try {
        evaluation = evaluateAnswer({
          exerciseId,
          chosenActionType,
          strategyResult: snapshot.exercise.strategyResult,
          decisionContext: snapshot.exercise.decisionContext,
        });
      } catch (error) {
        return sessionFailure(
          TRAINING_SESSION_ERROR_CODES.EVALUATION_FAILED,
          'The answer could not be compared with the Training reference.',
          { message: error instanceof Error ? error.message : String(error) },
        );
      }

      snapshot = deepFreeze({
        ...snapshot,
        status: 'answered',
        evaluation,
      });
      return deepFreeze({ ok: true, evaluation });
    },

    getSnapshot() {
      return snapshot;
    },

    getPracticePlannerState() {
      return practiceSession?.plannerState ?? null;
    },

    reset() {
      sequence += 1;
      practiceSession = null;
      snapshot = initialSnapshot();
      return snapshot;
    },
  };

  return Object.freeze(controller);
}
