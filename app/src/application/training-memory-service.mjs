import {
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import {
  riverlineOwnershipRefForIdentity,
} from '../account-identity/domain.mjs';
import {
  TRAINING_DECISION_RECORD_SCHEMA_VERSION,
  TRAINING_DECISION_STATUSES,
  TRAINING_GENERATOR_REPLAY_IDENTITY_SCHEMA_VERSION,
  TRAINING_REVIEW_LIFECYCLE_STATES,
  TRAINING_SESSION_RECORD_SCHEMA_VERSION,
  TRAINING_SESSION_STATUSES,
  cloneTrainingMemoryData,
  createTrainingReviewState,
  createTrainingStrategyEvidence,
  createTrainingStudyMetadata,
  deriveTrainingSimilarity,
  reviewReasonsForDecision,
  sameTrainingMemoryOwner,
  trainingMemoryOwnerKey,
  transitionTrainingReview,
  updateTrainingStudyMetadata,
  validateTrainingDecisionRecord,
  validateTrainingSessionRecord,
} from '../training-memory/domain.mjs';
import {
  createIndexedDbTrainingMemoryDatabase,
} from '../training-memory/indexeddb-storage.mjs';
import { createTrainingMemoryRepository } from '../training-memory/repository.mjs';
import {
  reconstructCanonicalHandReplaySource,
} from './canonical-hand-replay-source.mjs';
import { resolveStrategyClaimPolicy } from './strategy-claim-policy.mjs';
import {
  TRAINING_EXERCISE_V2_SCHEMA_VERSION,
  generateTrainingExerciseFromScenarioRequest,
  resolveTrainingRulesCapability,
} from './training-generator.mjs';
import {
  TRAINING_PRACTICE_MODES,
  TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  TRAINING_SESSION_INTENT_SCHEMA_VERSION,
  createTrainingPracticePlannerState,
  createTrainingSessionIntent,
  planTrainingScenario,
} from './training-practice-planner.mjs';

export const TRAINING_MEMORY_SERVICE_SCHEMA_VERSION = 'training-memory-service/v1';
export const TRAINING_MEMORY_SAME_SPOT_SCHEMA_VERSION = 'training-same-spot/v1';
export const TRAINING_MEMORY_SIMILAR_SPOT_SCHEMA_VERSION = 'training-similar-spot-result/v1';

function timestampFrom(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Training Memory clock is invalid');
  return date.toISOString();
}

function defaultIdFactory(prefix) {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function requireSessionMode(mode) {
  if (typeof mode !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(mode)) {
    throw new RangeError('Training Memory mode is invalid');
  }
  return mode;
}

function requireUint32(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`${label} must be uint32${nullable ? ' or null' : ''}`);
  }
  return value >>> 0;
}

function nullablePositiveInteger(value, label) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive safe integer or null`);
  }
  return value;
}

function sessionIntentId(intent) {
  if (!intent) return null;
  const request = intent.schemaVersion === 'training-session-intent/v1' ? intent : null;
  if (!request) throw new TypeError('Training Memory planner intent is incompatible');
  const canonical = JSON.stringify(request);
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `training-intent-${hash.toString(16).padStart(8, '0')}`;
}

function createSessionRecord({
  id,
  ownerRef,
  mode,
  requestedLength = null,
  sessionSeed = null,
  plannerIntent = null,
  focus = null,
  selectedSourceId = null,
  startedAt,
} = {}) {
  const plannerId = sessionIntentId(plannerIntent);
  const record = {
    schemaVersion: TRAINING_SESSION_RECORD_SCHEMA_VERSION,
    id,
    ownerRef: cloneTrainingMemoryData(ownerRef),
    mode: requireSessionMode(mode),
    startedAt,
    endedAt: null,
    status: TRAINING_SESSION_STATUSES.ACTIVE,
    requestedLength: nullablePositiveInteger(requestedLength, 'Training requested length'),
    sessionSeed: requireUint32(sessionSeed, 'Training session seed', { nullable: true }),
    planner: plannerIntent === null ? null : {
      intentId: plannerId,
      intent: cloneTrainingMemoryData(plannerIntent),
    },
    focus: focus === null ? null : cloneTrainingMemoryData(focus),
    comparisonSelection: {
      kind: 'provider_runtime',
      selectedSourceId: selectedSourceId === null ? null : String(selectedSourceId),
    },
    decisionRecordIds: [],
    fullHandSource: null,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
  validateTrainingSessionRecord(record);
  return Object.freeze(record);
}

function generatorReplayIdentity(exercise) {
  const metadata = exercise.generationMetadata ?? {};
  const scenario = metadata.scenarioRequest?.request
    ?? null;
  return {
    schemaVersion: TRAINING_GENERATOR_REPLAY_IDENTITY_SCHEMA_VERSION,
    seed: requireUint32(exercise.seed, 'Training exercise seed'),
    generatorVersion: exercise.schemaVersion,
    policyVersion: String(metadata.scenarioRequest?.policyVersions?.generator
      ?? metadata.policy
      ?? 'bounded_legal_trajectory_v1'),
    scenarioRequest: scenario === null ? null : cloneTrainingMemoryData(scenario),
  };
}

function generatedDecisionSource(exercise, { parentDecisionRecordId = null, redrillKind = null } = {}) {
  validatePokerState(exercise.pokerState);
  return {
    kind: 'generated_exercise',
    pokerState: cloneTrainingMemoryData(exercise.pokerState),
    heroPlayerId: exercise.heroPlayerId,
    replayIdentity: generatorReplayIdentity(exercise),
    parentDecisionRecordId,
    redrillKind,
  };
}

function fullHandDecisionSource(decision, handSeed, {
  parentDecisionRecordId = null,
  redrillKind = null,
} = {}) {
  return {
    kind: 'full_hand_replay_point',
    handId: decision.handId,
    heroPlayerId: decision.currentActor.playerId,
    replayPoint: cloneTrainingMemoryData(decision.occurrence?.replayPoint ?? decision.replayPoint),
    handSeed: requireUint32(handSeed, 'Full-Hand Training seed'),
    parentDecisionRecordId,
    redrillKind,
  };
}

function createShownDecisionRecord({
  id,
  ownerRef,
  session,
  exerciseId,
  decisionContext,
  legalActions,
  decisionSource,
  shownAt,
} = {}) {
  const record = {
    schemaVersion: TRAINING_DECISION_RECORD_SCHEMA_VERSION,
    id,
    ownerRef: cloneTrainingMemoryData(ownerRef),
    sessionId: session.id,
    exerciseId,
    ordinal: session.decisionRecordIds.length,
    shownAt,
    answeredAt: null,
    status: TRAINING_DECISION_STATUSES.SHOWN,
    mode: session.mode,
    plannerIntentId: session.planner?.intentId ?? null,
    decisionSource: cloneTrainingMemoryData(decisionSource),
    decisionContext: cloneTrainingMemoryData(decisionContext),
    legalActions: cloneTrainingMemoryData(legalActions),
    userResponse: null,
    strategyEvidence: null,
    studyMetadata: cloneTrainingMemoryData(createTrainingStudyMetadata()),
    reviewState: cloneTrainingMemoryData(createTrainingReviewState()),
    createdAt: shownAt,
    updatedAt: shownAt,
  };
  validateTrainingDecisionRecord(record);
  return Object.freeze(record);
}

function actionResponse(actionType, amountToMilliBb = null) {
  return {
    kind: 'action',
    action: {
      type: actionType,
      amountToMilliBb: Number.isSafeInteger(amountToMilliBb) ? amountToMilliBb : null,
    },
    submission: 'normal',
  };
}

function answeredDecisionRecord(record, {
  strategyResult,
  evaluation,
  actionType,
  amountToMilliBb = null,
  answeredAt,
} = {}) {
  const claimPolicy = resolveStrategyClaimPolicy(strategyResult);
  const next = cloneTrainingMemoryData(record);
  next.status = TRAINING_DECISION_STATUSES.ANSWERED;
  next.answeredAt = answeredAt;
  next.updatedAt = answeredAt;
  next.userResponse = actionResponse(actionType, amountToMilliBb);
  next.strategyEvidence = cloneTrainingMemoryData(createTrainingStrategyEvidence({
    strategyResult,
    claimPolicy,
    evaluation,
  }));
  validateTrainingDecisionRecord(next);
  if (reviewReasonsForDecision(next).length > 0) {
    next.reviewState = cloneTrainingMemoryData(createTrainingReviewState({
      state: TRAINING_REVIEW_LIFECYCLE_STATES.PENDING,
    }));
  }
  validateTrainingDecisionRecord(next);
  return Object.freeze(next);
}

function fullHandSource(replaySource, handId, heroPlayerId) {
  return {
    handId,
    heroPlayerId,
    replaySource: cloneTrainingMemoryData(replaySource),
  };
}

function presentationFromContext(context) {
  return {
    heroCards: [...context.heroCards],
    board: [...context.board],
    position: context.heroPosition,
    potBb: context.potBb,
    stackBb: context.stackBb,
    facingBb: context.facingSizeBb,
    callBb: context.callAmountBb,
    street: context.street,
    lastAction: context.lastAction,
    assistanceMode: 'hard',
  };
}

function historicalSameSpotExercise(record, state, id) {
  const strategyResult = record.strategyEvidence?.strategyResult;
  if (!strategyResult) {
    throw new RangeError('Same Spot requires an answered decision with frozen strategy evidence');
  }
  const seed = record.decisionSource.kind === 'generated_exercise'
    ? record.decisionSource.replayIdentity.seed
    : record.decisionSource.handSeed;
  return Object.freeze({
    schemaVersion: TRAINING_EXERCISE_V2_SCHEMA_VERSION,
    id,
    seed,
    pokerState: cloneTrainingMemoryData(state),
    heroPlayerId: record.decisionSource.heroPlayerId,
    decisionContext: cloneTrainingMemoryData(record.decisionContext),
    strategyResult: cloneTrainingMemoryData(strategyResult),
    legalActions: cloneTrainingMemoryData(record.legalActions),
    presentation: presentationFromContext(record.decisionContext),
    generationMetadata: {
      attempts: 1,
      trajectoryLength: state.actionHistory?.length ?? 0,
      eventCount: null,
      targetReason: deriveTrainingSimilarity(record).targetDecisionType,
      trainingConfig: null,
      initialConfiguration: null,
      events: [],
      curriculum: {
        street: record.decisionContext.street,
        heroPosition: record.decisionContext.heroPosition,
        tableSize: record.decisionContext.tableSize,
        decisionRole: strategyResult.details?.decisionRole ?? 'unknown',
        fallbackCalibration: strategyResult.details?.fallbackCalibration ?? null,
        stackBucket: deriveTrainingSimilarity(record).dimensions
          .find((entry) => entry.dimension === 'effective_stack_bucket')?.value ?? null,
      },
      policy: 'training-memory-same-spot/v1',
      policyIsStrategy: false,
      memoryRedrill: {
        schemaVersion: TRAINING_MEMORY_SAME_SPOT_SCHEMA_VERSION,
        sourceDecisionRecordId: record.id,
        comparison: 'historical',
        sourceVersion: strategyResult.sourceVersion,
      },
    },
  });
}

function stateForRecord(record, session) {
  if (record.decisionSource.kind === 'generated_exercise') {
    return record.decisionSource.pokerState;
  }
  const replay = session?.fullHandSource?.replaySource;
  if (!replay) throw new RangeError('Full-Hand Same Spot replay evidence is unavailable');
  const reconstruction = reconstructCanonicalHandReplaySource(replay);
  const frame = reconstruction.frames.find((entry) => (
    entry.sequence === record.decisionSource.replayPoint.eventSequence
  ));
  if (!frame) throw new RangeError('Full-Hand Same Spot replay point is unavailable');
  return frame.state;
}

function mixSeed(seed, text, attempt) {
  let hash = (seed ^ 0x9e3779b9 ^ attempt) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x85ebca6b) >>> 0;
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

function sameCards(left, right) {
  return JSON.stringify(left?.decisionContext?.heroCards)
      === JSON.stringify(right?.decisionContext?.heroCards)
    && JSON.stringify(left?.decisionContext?.board)
      === JSON.stringify(right?.decisionContext?.board);
}

export function createTrainingMemoryService({
  identityProvider,
  database = null,
  repositoryFactory = createTrainingMemoryRepository,
  clock = () => new Date(),
  idFactory = defaultIdFactory,
  generateSimilarExercise = generateTrainingExerciseFromScenarioRequest,
} = {}) {
  if (!identityProvider || typeof identityProvider.getActiveIdentity !== 'function') {
    throw new TypeError('Training Memory requires the Riverline identity authority');
  }
  const sharedDatabase = database ?? createIndexedDbTrainingMemoryDatabase();
  const repositories = new Map();

  async function context() {
    const identity = await identityProvider.getActiveIdentity();
    const ownerRef = riverlineOwnershipRefForIdentity(identity);
    const key = trainingMemoryOwnerKey(ownerRef);
    if (!repositories.has(key)) {
      repositories.set(key, repositoryFactory({
        ownerRef,
        database: sharedDatabase,
        clock,
      }));
    }
    return { ownerRef, repository: repositories.get(key) };
  }

  async function getOwnedSession(repository, ownerRef, id) {
    const session = await repository.getSession(id);
    if (!session) throw new RangeError(`Unknown Training session: ${id}`);
    if (!sameTrainingMemoryOwner(session.ownerRef, ownerRef)) {
      throw new RangeError('Training session belongs to another Riverline profile');
    }
    return session;
  }

  async function getOwnedDecision(repository, ownerRef, id) {
    const decision = await repository.getDecision(id);
    if (!decision) throw new RangeError(`Unknown Training decision: ${id}`);
    if (!sameTrainingMemoryOwner(decision.ownerRef, ownerRef)) {
      throw new RangeError('Training decision belongs to another Riverline profile');
    }
    return decision;
  }

  const service = {
    schemaVersion: TRAINING_MEMORY_SERVICE_SCHEMA_VERSION,

    async startSession({
      mode,
      requestedLength = null,
      sessionSeed = null,
      plannerIntent = null,
      focus = null,
      selectedSourceId = null,
    } = {}) {
      const { ownerRef, repository } = await context();
      const startedAt = timestampFrom(clock);
      const session = createSessionRecord({
        id: idFactory('training-session'),
        ownerRef,
        mode,
        requestedLength,
        sessionSeed,
        plannerIntent,
        focus,
        selectedSourceId,
        startedAt,
      });
      return repository.createSession(session);
    },

    async finishSession(sessionId, status = TRAINING_SESSION_STATUSES.COMPLETED, {
      fullHandSource: suppliedFullHandSource = null,
    } = {}) {
      if (![TRAINING_SESSION_STATUSES.COMPLETED, TRAINING_SESSION_STATUSES.ABANDONED]
        .includes(status)) {
        throw new RangeError('Training session may finish as completed or abandoned');
      }
      const { ownerRef, repository } = await context();
      const session = await getOwnedSession(repository, ownerRef, sessionId);
      if (session.status !== TRAINING_SESSION_STATUSES.ACTIVE) return session;
      const at = timestampFrom(clock);
      const next = cloneTrainingMemoryData(session);
      next.status = status;
      next.endedAt = at;
      next.updatedAt = at;
      if (suppliedFullHandSource !== null) {
        next.fullHandSource = cloneTrainingMemoryData(suppliedFullHandSource);
      }
      validateTrainingSessionRecord(next);
      return repository.replaceSession(next);
    },

    async recordExerciseShown({
      sessionId,
      exercise,
      parentDecisionRecordId = null,
      redrillKind = null,
    } = {}) {
      const { ownerRef, repository } = await context();
      const session = await getOwnedSession(repository, ownerRef, sessionId);
      if (session.status !== TRAINING_SESSION_STATUSES.ACTIVE) {
        throw new RangeError('Cannot append a decision to a finished Training session');
      }
      const shownAt = timestampFrom(clock);
      const record = createShownDecisionRecord({
        id: idFactory('training-decision'),
        ownerRef,
        session,
        exerciseId: exercise.id,
        decisionContext: exercise.decisionContext,
        legalActions: exercise.legalActions,
        decisionSource: generatedDecisionSource(exercise, {
          parentDecisionRecordId,
          redrillKind,
        }),
        shownAt,
      });
      return repository.addShownDecision(record);
    },

    async recordExerciseAnswered({
      recordId,
      evaluation,
      strategyResult,
      actionType,
      amountToMilliBb = null,
    } = {}) {
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      if (record.status === TRAINING_DECISION_STATUSES.ANSWERED) return record;
      const answered = answeredDecisionRecord(record, {
        strategyResult,
        evaluation,
        actionType,
        amountToMilliBb,
        answeredAt: timestampFrom(clock),
      });
      return repository.replaceDecision(answered);
    },

    async recordFullHandDecisionShown({
      sessionId,
      decision,
      replaySource,
      handSeed,
    } = {}) {
      const { ownerRef, repository } = await context();
      const session = await getOwnedSession(repository, ownerRef, sessionId);
      if (session.status !== TRAINING_SESSION_STATUSES.ACTIVE) {
        throw new RangeError('Cannot append a decision to a finished Training session');
      }
      const shownAt = timestampFrom(clock);
      const record = createShownDecisionRecord({
        id: idFactory('training-decision'),
        ownerRef,
        session,
        exerciseId: decision.decisionId,
        decisionContext: decision.decisionContext,
        legalActions: decision.legalActions,
        decisionSource: fullHandDecisionSource(decision, handSeed),
        shownAt,
      });
      const source = fullHandSource(
        replaySource,
        decision.handId,
        decision.currentActor.playerId,
      );
      return repository.addShownDecision(record, { fullHandSource: source });
    },

    async recordFullHandDecisionAnswered({ recordId, decision, replaySource, handSeed } = {}) {
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      if (record.status === TRAINING_DECISION_STATUSES.ANSWERED) return record;
      const strategyResult = decision.evaluation?.strategyResult;
      const evaluation = decision.evaluation?.answerEvaluation;
      if (!strategyResult || !evaluation || !decision.chosenAction) {
        throw new TypeError('Full-Hand Training answer evidence is incomplete');
      }
      const answered = answeredDecisionRecord(record, {
        strategyResult,
        evaluation,
        actionType: decision.chosenAction.type,
        amountToMilliBb: decision.chosenAction.amountToMilliBb,
        answeredAt: timestampFrom(clock),
      });
      const source = fullHandSource(
        replaySource,
        decision.handId,
        decision.currentActor.playerId,
      );
      if (record.decisionSource.handSeed !== requireUint32(handSeed, 'Full-Hand Training seed')) {
        throw new RangeError('Full-Hand Training seed changed within a session');
      }
      return repository.replaceDecision(answered, { fullHandSource: source });
    },

    async updateStudyMetadata(recordId, changes) {
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      return repository.replaceDecision(updateTrainingStudyMetadata(
        record,
        changes,
        timestampFrom(clock),
      ));
    },

    async markReviewed(recordId) {
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      return repository.replaceDecision(transitionTrainingReview(record, {
        state: TRAINING_REVIEW_LIFECYCLE_STATES.REVIEWED,
        at: timestampFrom(clock),
      }));
    },

    async reviewAgain(recordId) {
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      return repository.replaceDecision(transitionTrainingReview(record, {
        state: TRAINING_REVIEW_LIFECYCLE_STATES.PENDING,
        at: timestampFrom(clock),
      }));
    },

    async snooze(recordId, days = 1) {
      if (!Number.isSafeInteger(days) || days < 1 || days > 30) {
        throw new RangeError('Training review snooze must be 1 through 30 days');
      }
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      const at = timestampFrom(clock);
      const dueAt = new Date(Date.parse(at) + days * 86_400_000).toISOString();
      return repository.replaceDecision(transitionTrainingReview(record, {
        state: TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED,
        dueAt,
        at,
      }));
    },

    async getDecision(recordId) {
      const { ownerRef, repository } = await context();
      return getOwnedDecision(repository, ownerRef, recordId);
    },

    async listRecentSessions(options) {
      const { repository } = await context();
      return repository.listRecentSessions(options);
    },

    async listSessionDecisions(sessionId, options) {
      const { repository } = await context();
      return repository.listSessionDecisions(sessionId, options);
    },

    async listDueReview(options) {
      const { repository } = await context();
      return repository.listDueReview(options);
    },

    async createSameSpot(recordId) {
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      const session = await getOwnedSession(repository, ownerRef, record.sessionId);
      const state = stateForRecord(record, session);
      return Object.freeze({
        schemaVersion: TRAINING_MEMORY_SAME_SPOT_SCHEMA_VERSION,
        sourceDecisionRecordId: record.id,
        comparison: 'historical',
        historicalClaimPolicy: cloneTrainingMemoryData(record.strategyEvidence?.claimPolicy ?? null),
        exercise: historicalSameSpotExercise(
          record,
          state,
          idFactory('training-same-spot-exercise'),
        ),
      });
    },

    async generateSimilarSpot(recordId, { strategyProvider, attempt = 1 } = {}) {
      if (!strategyProvider?.resolve) throw new TypeError('Similar Spot requires StrategyProvider');
      if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 1000) {
        throw new RangeError('Similar Spot attempt must be 1 through 1000');
      }
      const { ownerRef, repository } = await context();
      const record = await getOwnedDecision(repository, ownerRef, recordId);
      const session = await getOwnedSession(repository, ownerRef, record.sessionId);
      const similarity = deriveTrainingSimilarity(record);
      if (!similarity.available) {
        return Object.freeze({
          schemaVersion: TRAINING_MEMORY_SIMILAR_SPOT_SCHEMA_VERSION,
          ok: false,
          similarity,
          error: { code: similarity.unavailableReason },
        });
      }
      const sourceState = stateForRecord(record, session);
      const rulesSnapshot = sourceState.rulesSnapshot;
      const capability = resolveTrainingRulesCapability(rulesSnapshot, {
        tableSize: similarity.generationConstraints.tableSize,
      });
      const sourceSeed = record.decisionSource.kind === 'generated_exercise'
        ? record.decisionSource.replayIdentity.seed
        : record.decisionSource.handSeed;
      let generated = null;
      let request = null;
      for (let offset = 0; offset < 4; offset += 1) {
        const sessionSeed = mixSeed(sourceSeed, record.id, attempt + offset);
        const intent = createTrainingSessionIntent({
          schemaVersion: TRAINING_SESSION_INTENT_SCHEMA_VERSION,
          mode: TRAINING_PRACTICE_MODES.FOCUSED,
          sessionSeed,
          sessionLength: 1,
          difficulty: 'hard',
          focusPreferences: {
            tableSize: similarity.generationConstraints.tableSize,
            heroPosition: similarity.generationConstraints.heroPosition,
            startingStackBb: similarity.generationConstraints.startingStackBb,
            street: similarity.generationConstraints.street,
            targetDecisionType: similarity.targetDecisionType,
            requestedSizingFamily: similarity.generationConstraints.requestedSizingFamily,
          },
          rulesSnapshot,
          rulesCapability: capability,
          plannerPolicyVersion: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
        });
        const planned = planTrainingScenario(intent, createTrainingPracticePlannerState(intent), 0);
        if (!planned.ok) {
          return Object.freeze({
            schemaVersion: TRAINING_MEMORY_SIMILAR_SPOT_SCHEMA_VERSION,
            ok: false,
            similarity,
            error: cloneTrainingMemoryData(planned.error),
          });
        }
        request = planned.request;
        const result = await Promise.resolve(generateSimilarExercise(request, {
          rulesSnapshot,
          strategyProvider,
        }));
        if (!result?.ok) {
          generated = result;
          continue;
        }
        generated = result;
        if (!sameCards(record, result.exercise)) break;
      }
      if (!generated?.ok) {
        return Object.freeze({
          schemaVersion: TRAINING_MEMORY_SIMILAR_SPOT_SCHEMA_VERSION,
          ok: false,
          similarity,
          error: cloneTrainingMemoryData(generated?.error ?? { code: 'generation_failed' }),
        });
      }
      const resultSimilarity = cloneTrainingMemoryData(similarity);
      resultSimilarity.generatedRequest = cloneTrainingMemoryData(request);
      resultSimilarity.comparison = 'current';
      resultSimilarity.changedDimensions = [
        'hero_cards',
        ...(JSON.stringify(record.decisionContext.board)
          === JSON.stringify(generated.exercise.decisionContext.board) ? [] : ['board']),
      ];
      const exercise = cloneTrainingMemoryData(generated.exercise);
      exercise.generationMetadata.memoryRedrill = {
        schemaVersion: TRAINING_MEMORY_SIMILAR_SPOT_SCHEMA_VERSION,
        sourceDecisionRecordId: record.id,
        comparison: 'current',
        similarityPolicyVersion: similarity.policyVersion,
      };
      return Object.freeze({
        schemaVersion: TRAINING_MEMORY_SIMILAR_SPOT_SCHEMA_VERSION,
        ok: true,
        similarity: Object.freeze(resultSimilarity),
        exercise: Object.freeze(exercise),
      });
    },

    async close() {
      await sharedDatabase.close?.();
      repositories.clear();
    },
  };

  return Object.freeze(service);
}
