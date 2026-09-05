import {
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import {
  RIVERLINE_IDENTITY_KINDS,
  RIVERLINE_OWNED_DOMAINS,
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
import { withTrainingLearningEvidence, UNCERTAIN_REVISIT_POLICY_VERSION } from '../training-memory/learning-evidence.mjs';
import { deriveTrainingSchedulingProposal, projectTrainingRevisits, requireTrainingRevisitProposal } from './training-intelligence.mjs';
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

export class TrainingMemoryAuthorizationError extends Error {
  constructor(code = 'training_memory_owner_unavailable') {
    super('Training Memory is unavailable without a current local workspace owner.');
    this.name = 'TrainingMemoryAuthorizationError';
    this.code = code;
  }
}

export function createTrainingMemoryOwnerResolver({ authentication, identityProvider } = {}) {
  if (!authentication?.ready || !authentication?.getState || !authentication?.subscribe) {
    throw new TypeError('Training Memory owner resolution requires AuthenticationService');
  }
  if (!identityProvider?.getActiveIdentity) {
    throw new TypeError('Training Memory owner resolution requires AccountIdentity');
  }
  let authState = authentication.getState();
  let activeIdentityId = null;
  let generation = 0;
  let generationController = new AbortController();

  function invalidateGeneration() {
    generationController.abort();
    generationController = new AbortController();
    generation += 1;
  }

  authentication.subscribe((nextState) => {
    authState = nextState;
    invalidateGeneration();
  });
  identityProvider.subscribe?.(({ identity }) => {
    activeIdentityId = identity?.identityId ?? null;
    invalidateGeneration();
  });

  function reject(code) {
    throw new TrainingMemoryAuthorizationError(code);
  }

  function assertCurrent(snapshot) {
    if (!snapshot || snapshot.generation !== generation) reject('training_memory_generation_stale');
    if (snapshot.lifecycleScope) {
      snapshot.lifecycleScope.assertCurrent();
      if (snapshot.lifecycleScope.identityKind === RIVERLINE_IDENTITY_KINDS.DEVICE_GUEST) {
        if (authState?.status === 'signed_in') reject('training_memory_owner_mismatch');
        return snapshot;
      }
    }
    if (authState?.status !== 'signed_in') reject('training_memory_auth_required');
    if (activeIdentityId !== null && activeIdentityId !== (snapshot.lifecycleScope?.identityId ?? snapshot.ownerRef.ownerId)) {
      reject('training_memory_owner_changed');
    }
    const profileOwnerId = authState.profile?.riverlineIdentityId ?? null;
    if (profileOwnerId !== null && profileOwnerId !== (snapshot.lifecycleScope?.identityId ?? snapshot.ownerRef.ownerId)) {
      reject('training_memory_owner_mismatch');
    }
    return snapshot;
  }

  return Object.freeze({
    async capture() {
      const requestedGeneration = generation;
      await authentication.ready();
      if (requestedGeneration !== generation) reject('training_memory_generation_stale');
      const expectedGeneration = generation;
      const lifecycleScope = identityProvider.captureLifecycleScope
        ? await identityProvider.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.TRAINING_MEMORY)
        : null;
      const identity = lifecycleScope ? null : await identityProvider.getActiveIdentity();
      if (!lifecycleScope && (authState?.status !== 'signed_in'
        || identity.kind !== RIVERLINE_IDENTITY_KINDS.AUTHENTICATED_ACCOUNT)) {
        reject('training_memory_auth_required');
      }
      const snapshot = Object.freeze({
        authStatus: authState.status,
        generation: expectedGeneration,
        lifecycleScope,
        ownerRef: lifecycleScope ? lifecycleScope.domainOwnerBinding.domainOwnerRef
          : riverlineOwnershipRefForIdentity(identity),
        signal: generationController.signal,
      });
      if (activeIdentityId === null) activeIdentityId = lifecycleScope?.identityId ?? identity.identityId;
      return assertCurrent(snapshot);
    },
    assertCurrent,
    getState: () => Object.freeze({
      authStatus: authState?.status ?? 'initializing',
      generation,
      ownerId: ['guest_active', 'account_active'].includes(identityProvider.getLifecycleState?.().status)
        || authState?.status === 'signed_in' ? activeIdentityId : null,
    }),
  });
}

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
  const claimPolicy = evaluation?.truth?.claimPolicy ?? resolveStrategyClaimPolicy(strategyResult);
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
    historicalStrategyEvidence: cloneTrainingMemoryData(record.strategyEvidence),
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
  ownerProvider,
  database = null,
  repositoryFactory = createTrainingMemoryRepository,
  clock = () => new Date(),
  idFactory = defaultIdFactory,
  generateSimilarExercise = generateTrainingExerciseFromScenarioRequest,
} = {}) {
  if (!ownerProvider?.capture || !ownerProvider?.assertCurrent) {
    throw new TypeError('Training Memory requires an authenticated owner provider');
  }
  const sharedDatabase = database ?? createIndexedDbTrainingMemoryDatabase();
  const repositories = new Map();

  async function context() {
    const authorization = await ownerProvider.capture();
    const ownerRef = authorization.ownerRef;
    const key = trainingMemoryOwnerKey(ownerRef);
    if (!repositories.has(key)) {
      repositories.set(key, repositoryFactory({
        ownerRef,
        database: sharedDatabase,
        clock,
      }));
    }
    ownerProvider.assertCurrent(authorization);
    return { authorization, ownerRef, repository: repositories.get(key) };
  }

  function authorizationOptions(operationContext) {
    return {
      authorizationGuard: () => ownerProvider.assertCurrent(operationContext.authorization),
      authorizationSignal: operationContext.authorization.signal ?? null,
    };
  }

  async function getOwnedSession(operationContext, id) {
    const { repository, ownerRef } = operationContext;
    const session = await repository.getSession(id);
    ownerProvider.assertCurrent(operationContext.authorization);
    if (!session) throw new RangeError(`Unknown Training session: ${id}`);
    if (!sameTrainingMemoryOwner(session.ownerRef, ownerRef)) {
      throw new RangeError('Training session belongs to another Riverline profile');
    }
    return session;
  }

  async function getOwnedDecision(operationContext, id) {
    const { repository, ownerRef } = operationContext;
    const decision = await repository.getDecision(id);
    ownerProvider.assertCurrent(operationContext.authorization);
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
      const operationContext = await context();
      const { ownerRef, repository } = operationContext;
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
      const created = await repository.createSession(session, {
        ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return created;
    },

    async finishSession(sessionId, status = TRAINING_SESSION_STATUSES.COMPLETED, {
      fullHandSource: suppliedFullHandSource = null,
    } = {}) {
      if (![TRAINING_SESSION_STATUSES.COMPLETED, TRAINING_SESSION_STATUSES.ABANDONED]
        .includes(status)) {
        throw new RangeError('Training session may finish as completed or abandoned');
      }
      const operationContext = await context();
      const { repository } = operationContext;
      const session = await getOwnedSession(operationContext, sessionId);
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
      const replaced = await repository.replaceSession(next, {
        ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async recordExerciseShown({
      sessionId,
      exercise,
      parentDecisionRecordId = null,
      redrillKind = null,
      revisit = null,
    } = {}) {
      const operationContext = await context();
      const { ownerRef, repository } = operationContext;
      const session = await getOwnedSession(operationContext, sessionId);
      if (session.status !== TRAINING_SESSION_STATUSES.ACTIVE) {
        throw new RangeError('Cannot append a decision to a finished Training session');
      }
      const shownAt = timestampFrom(clock);
      let record = createShownDecisionRecord({
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
      if (revisit) {
        const parent = await getOwnedDecision(operationContext, parentDecisionRecordId);
        const proposal = deriveTrainingSchedulingProposal(parent, clock());
        if (!proposal || proposal.handoff.requestedAt !== revisit.requestedAt
          || proposal.dueAt !== revisit.dueAt || revisit.sourceDecisionRecordId !== parent.id) {
          throw new RangeError('The revisit request changed; reopen it from review.');
        }
        if (exercise.generationMetadata?.memoryRedrill?.sourceDecisionRecordId !== parent.id
          || exercise.generationMetadata?.memoryRedrill?.comparison !== 'historical'
          || ['decisionContext', 'legalActions'].some((key) => JSON.stringify(exercise[key]) !== JSON.stringify(parent[key]))
          || JSON.stringify(exercise.pokerState) !== JSON.stringify(parent.decisionSource.pokerState)
          || JSON.stringify(exercise.strategyResult) !== JSON.stringify(parent.strategyEvidence.strategyResult)) {
          throw new RangeError('Exact revisit evidence does not match its historical source.');
        }
        record = withTrainingLearningEvidence(record);
        record.learningEvidence.revisit = {
          sourceDecisionRecordId: parent.id,
          requestedAt: revisit.requestedAt, dueAt: revisit.dueAt, startedAt: shownAt,
        };
        validateTrainingDecisionRecord(record);
      }
      const added = await repository.addShownDecision(record, {
        ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return added;
    },

    async recordExerciseAnswered({
      recordId,
      evaluation,
      strategyResult,
      actionType,
      amountToMilliBb = null,
      uncertainty = null,
    } = {}) {
      const operationContext = await context();
      const { repository } = operationContext;
      const record = await getOwnedDecision(operationContext, recordId);
      if (record.status === TRAINING_DECISION_STATUSES.ANSWERED) return record;
      let answered = answeredDecisionRecord(record, {
        strategyResult,
        evaluation,
        actionType,
        amountToMilliBb,
        answeredAt: timestampFrom(clock),
      });
      if (uncertainty !== null) {
        answered = withTrainingLearningEvidence(answered);
        answered.learningEvidence.uncertainty = cloneTrainingMemoryData(uncertainty);
        validateTrainingDecisionRecord(answered);
      }
      const replaced = await repository.replaceDecision(answered, {
        expectedRecord: record,
        resolveRevisit: true,
        ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async requestUncertainRevisit(recordId) {
      const operationContext = await context();
      const record = await getOwnedDecision(operationContext, recordId);
      if (!record.learningEvidence?.uncertainty) throw new RangeError('No pre-reveal uncertainty was recorded.');
      const at = timestampFrom(clock);
      const next = withTrainingLearningEvidence(record);
      next.learningEvidence.revisitRequest = { requestedAt: at, policyVersion: UNCERTAIN_REVISIT_POLICY_VERSION };
      next.reviewState = cloneTrainingMemoryData(createTrainingReviewState({
        ...record.reviewState, state: 'snoozed', dueAt: new Date(Date.parse(at) + 86_400_000).toISOString(),
      }));
      next.updatedAt = at;
      const replaced = await operationContext.repository.replaceDecision(next, {
        expectedRecord: record, ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async changeLearningRevisit(handoff, action) {
      if (!['snooze', 'dismiss'].includes(action)) throw new TypeError('Unsupported revisit action');
      const operationContext = await context();
      const record = await getOwnedDecision(operationContext, handoff?.sourceDecisionRecordId);
      const at = timestampFrom(clock);
      requireTrainingRevisitProposal(record, handoff, at);
      const next = transitionTrainingReview(record, { at,
        state: action === 'snooze' ? 'snoozed' : 'reviewed',
        dueAt: action === 'snooze' ? new Date(Date.parse(at) + 86400000).toISOString() : null,
      });
      const result = await operationContext.repository.replaceDecision(next, {
        expectedRecord: record, ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return result;
    },

    async listLearningRevisits() {
      const operationContext = await context();
      const now = clock();
      const records = await operationContext.repository.listRevisitCandidates({ now, limit: 50 });
      ownerProvider.assertCurrent(operationContext.authorization);
      return { schemaVersion: 'training-revisit-page/v1', proposals: projectTrainingRevisits(records, now),
        coverage: 'bounded_page', scanned: records.length, limit: 50 };
    },

    async recordFullHandDecisionShown({
      sessionId,
      decision,
      replaySource,
      handSeed,
    } = {}) {
      const operationContext = await context();
      const { ownerRef, repository } = operationContext;
      const session = await getOwnedSession(operationContext, sessionId);
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
      const added = await repository.addShownDecision(record, {
        fullHandSource: source,
        ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return added;
    },

    async recordFullHandDecisionAnswered({ recordId, decision, replaySource, handSeed } = {}) {
      const operationContext = await context();
      const { repository } = operationContext;
      const record = await getOwnedDecision(operationContext, recordId);
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
      const replaced = await repository.replaceDecision(answered, {
        fullHandSource: source,
        ...authorizationOptions(operationContext),
      });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async updateStudyMetadata(recordId, changes) {
      const operationContext = await context();
      const { repository } = operationContext;
      const record = await getOwnedDecision(operationContext, recordId);
      const replaced = await repository.replaceDecision(updateTrainingStudyMetadata(
        record,
        changes,
        timestampFrom(clock),
      ), { expectedRecord: record, ...authorizationOptions(operationContext) });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async markReviewed(recordId) {
      const operationContext = await context();
      const { repository } = operationContext;
      const record = await getOwnedDecision(operationContext, recordId);
      const replaced = await repository.replaceDecision(transitionTrainingReview(record, {
        state: TRAINING_REVIEW_LIFECYCLE_STATES.REVIEWED,
        at: timestampFrom(clock),
      }), { expectedRecord: record, ...authorizationOptions(operationContext) });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async reviewAgain(recordId) {
      const operationContext = await context();
      const { repository } = operationContext;
      const record = await getOwnedDecision(operationContext, recordId);
      const replaced = await repository.replaceDecision(transitionTrainingReview(record, {
        state: TRAINING_REVIEW_LIFECYCLE_STATES.PENDING,
        at: timestampFrom(clock),
      }), { expectedRecord: record, ...authorizationOptions(operationContext) });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async snooze(recordId, days = 1) {
      if (!Number.isSafeInteger(days) || days < 1 || days > 30) {
        throw new RangeError('Training review snooze must be 1 through 30 days');
      }
      const operationContext = await context();
      const { repository } = operationContext;
      const record = await getOwnedDecision(operationContext, recordId);
      const at = timestampFrom(clock);
      const dueAt = new Date(Date.parse(at) + days * 86_400_000).toISOString();
      const replaced = await repository.replaceDecision(transitionTrainingReview(record, {
        state: TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED,
        dueAt,
        at,
      }), { expectedRecord: record, ...authorizationOptions(operationContext) });
      ownerProvider.assertCurrent(operationContext.authorization);
      return replaced;
    },

    async getDecision(recordId) {
      const operationContext = await context();
      return getOwnedDecision(operationContext, recordId);
    },

    async listRecentSessions(options) {
      const operationContext = await context();
      const result = await operationContext.repository.listRecentSessions(options);
      ownerProvider.assertCurrent(operationContext.authorization);
      return result;
    },

    async listSessionDecisions(sessionId, options) {
      const operationContext = await context();
      const result = await operationContext.repository.listSessionDecisions(sessionId, options);
      ownerProvider.assertCurrent(operationContext.authorization);
      return result;
    },

    async listDueReview(options) {
      const operationContext = await context();
      const result = await operationContext.repository.listDueReview(options);
      ownerProvider.assertCurrent(operationContext.authorization);
      return result;
    },

    async createSameSpot(recordId, { handoff = null } = {}) {
      const operationContext = await context();
      const record = await getOwnedDecision(operationContext, recordId);
      const session = await getOwnedSession(operationContext, record.sessionId);
      const state = stateForRecord(record, session);
      let revisit = null;
      if (handoff) {
        requireTrainingRevisitProposal(record, handoff, clock());
        revisit = { sourceDecisionRecordId: record.id, requestedAt: handoff.requestedAt,
          dueAt: handoff.dueAt, startedAt: timestampFrom(clock) };
      }
      return Object.freeze({
        schemaVersion: TRAINING_MEMORY_SAME_SPOT_SCHEMA_VERSION,
        sourceDecisionRecordId: record.id,
        comparison: 'historical',
        revisit,
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
      const operationContext = await context();
      const record = await getOwnedDecision(operationContext, recordId);
      const session = await getOwnedSession(operationContext, record.sessionId);
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
        ownerProvider.assertCurrent(operationContext.authorization);
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
      exercise.strategyResult = generated.exercise.strategyResult;
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
