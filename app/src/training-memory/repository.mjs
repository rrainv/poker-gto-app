import {
  TRAINING_COMPARISON_STATES,
  TRAINING_DECISION_RECORD_SCHEMA_VERSION,
  TRAINING_DECISION_STATUSES,
  TRAINING_REVIEW_LIFECYCLE_STATES,
  TRAINING_SESSION_RECORD_SCHEMA_VERSION,
  cloneTrainingMemoryData,
  deriveTrainingReviewItem,
  deriveTrainingSimilarity,
  reviewReasonsForDecision,
  sameTrainingMemoryOwner,
  trainingMemoryOwnerKey,
  validateTrainingDecisionRecord,
  validateTrainingSessionRecord,
} from './domain.mjs';
import {
  TRAINING_MEMORY_BACKEND_SCHEMA_VERSION,
  TRAINING_MEMORY_DATABASE_VERSION,
  TRAINING_MEMORY_INDEXES,
  TRAINING_MEMORY_STORES,
  createIndexedDbTrainingMemoryDatabase,
} from './indexeddb-storage.mjs';

const METADATA_KEY = 'state';
const MAX_QUERY_LIMIT = 200;
const STRING_FLOOR = '';
const STRING_CEILING = '\uffff';
const NUMBER_FLOOR = 0;
const NUMBER_CEILING = Number.MAX_SAFE_INTEGER;
const ISO_FLOOR = '0000-01-01T00:00:00.000Z';
const ISO_CEILING = '9999-12-31T23:59:59.999Z';

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function timestampFrom(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Training Memory clock is invalid');
  return date.toISOString();
}

function queryLimit(value) {
  const limit = value ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_QUERY_LIMIT) {
    throw new RangeError(`Training Memory query limit must be 1 through ${MAX_QUERY_LIMIT}`);
  }
  return limit;
}

function emptySummaryCache() {
  return {
    schemaVersion: 'training-session-summary-cache/v1',
    shownCount: 0,
    answeredCount: 0,
    comparisonCounts: Object.fromEntries(
      Object.values(TRAINING_COMPARISON_STATES).map((state) => [state, 0]),
    ),
    sourceIds: [],
    reviewCount: 0,
  };
}

function sessionRecord(session, summaryCache = emptySummaryCache()) {
  return {
    id: session.id,
    ownerKey: trainingMemoryOwnerKey(session.ownerRef),
    status: session.status,
    startedAt: session.startedAt,
    summaryCache: cloneTrainingMemoryData(summaryCache),
    value: cloneTrainingMemoryData(session),
  };
}

function similarityKeyFor(record) {
  const similarity = deriveTrainingSimilarity(record);
  if (!similarity.available) return 'unavailable';
  return similarity.dimensions
    .filter((entry) => entry.quality !== 'unavailable')
    .map((entry) => `${entry.dimension}:${String(entry.value)}`)
    .join('|');
}

function decisionRecord(record) {
  return {
    id: record.id,
    ownerKey: trainingMemoryOwnerKey(record.ownerRef),
    sessionId: record.sessionId,
    ordinal: record.ordinal,
    createdAt: record.createdAt,
    reviewState: record.reviewState.state,
    reviewDueAt: record.reviewState.dueAt ?? ISO_FLOOR,
    similarityKey: similarityKeyFor(record),
    answeredAtIndex: record.answeredAt ?? ISO_FLOOR,
    value: cloneTrainingMemoryData(record),
  };
}

function metadata(timestamp) {
  return {
    key: METADATA_KEY,
    backendSchemaVersion: TRAINING_MEMORY_BACKEND_SCHEMA_VERSION,
    databaseVersion: TRAINING_MEMORY_DATABASE_VERSION,
    decisionSchemaVersion: TRAINING_DECISION_RECORD_SCHEMA_VERSION,
    sessionSchemaVersion: TRAINING_SESSION_RECORD_SCHEMA_VERSION,
    revision: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function validateMetadata(value) {
  requireObject(value, 'Training Memory metadata');
  if (value.key !== METADATA_KEY
    || value.backendSchemaVersion !== TRAINING_MEMORY_BACKEND_SCHEMA_VERSION
    || value.databaseVersion !== TRAINING_MEMORY_DATABASE_VERSION) {
    throw new TrainingMemoryStorageError(
      'unsupported_database_version',
      'Training Memory uses an unsupported database version and was left untouched.',
    );
  }
  if (value.decisionSchemaVersion !== TRAINING_DECISION_RECORD_SCHEMA_VERSION
    || value.sessionSchemaVersion !== TRAINING_SESSION_RECORD_SCHEMA_VERSION) {
    throw new TrainingMemoryStorageError(
      'unsupported_schema',
      'Training Memory uses an unsupported record schema and was left untouched.',
    );
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) {
    throw new TrainingMemoryStorageError('invalid_metadata', 'Training Memory metadata is invalid.');
  }
  return value;
}

function nextMetadata(value, clock) {
  const timestamp = timestampFrom(clock);
  return {
    ...cloneTrainingMemoryData(value),
    revision: value.revision + 1,
    updatedAt: timestamp < value.updatedAt ? value.updatedAt : timestamp,
  };
}

function sameData(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function ensureOwner(record, ownerRef, label) {
  if (!sameTrainingMemoryOwner(record.ownerRef, ownerRef)) {
    throw new TrainingMemoryStorageError(
      'owner_mismatch',
      `${label} belongs to a different Riverline profile and was left untouched.`,
    );
  }
}

function requireSessionDecisionMembership(session, decision) {
  if (decision.sessionId !== session.id) {
    throw new RangeError('Training decision belongs to a different session');
  }
  if (decision.ordinal !== session.decisionRecordIds.length) {
    throw new RangeError('Training decision ordinal must extend the ordered session record');
  }
}

function cacheAfterShown(cache, record) {
  const next = cloneTrainingMemoryData(cache);
  next.shownCount += 1;
  if (reviewReasonsForDecision(record).length > 0) next.reviewCount += 1;
  return next;
}

function cacheAfterAnswer(cache, before, after) {
  const next = cloneTrainingMemoryData(cache);
  if (before.status !== TRAINING_DECISION_STATUSES.ANSWERED
    && after.status === TRAINING_DECISION_STATUSES.ANSWERED) {
    next.answeredCount += 1;
    const comparison = after.strategyEvidence.comparisonState;
    next.comparisonCounts[comparison] += 1;
    const result = after.strategyEvidence.strategyResult;
    const source = `${result.source}@${result.sourceVersion}`;
    next.sourceIds = [...new Set([...next.sourceIds, source])].sort();
  }
  const priorReview = reviewReasonsForDecision(before).length > 0;
  const nextReview = reviewReasonsForDecision(after).length > 0;
  if (priorReview !== nextReview) next.reviewCount += nextReview ? 1 : -1;
  return next;
}

export class TrainingMemoryStorageError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = 'TrainingMemoryStorageError';
    this.code = code;
  }
}

export function createTrainingMemoryRepository({
  ownerRef,
  database = null,
  clock = () => new Date(),
} = {}) {
  trainingMemoryOwnerKey(ownerRef);
  if (typeof clock !== 'function') throw new TypeError('Training Memory repository clock is required');
  const durableDatabase = database ?? createIndexedDbTrainingMemoryDatabase();
  const ownerKey = trainingMemoryOwnerKey(ownerRef);
  let initializationPromise = null;

  async function initialize() {
    if (!initializationPromise) {
      initializationPromise = durableDatabase.runTransaction(
        [TRAINING_MEMORY_STORES.METADATA],
        'readwrite',
        async (transaction) => {
          const existing = await transaction.get(TRAINING_MEMORY_STORES.METADATA, METADATA_KEY);
          if (existing) return validateMetadata(existing);
          const created = metadata(timestampFrom(clock));
          await transaction.add(TRAINING_MEMORY_STORES.METADATA, created);
          return created;
        },
      ).catch((error) => {
        initializationPromise = null;
        throw error;
      });
    }
    return initializationPromise;
  }

  async function withRead(stores, operation) {
    await initialize();
    return durableDatabase.runTransaction(stores, 'readonly', operation);
  }

  async function withWrite(
    stores,
    operation,
    { authorizationGuard = null, authorizationSignal = null } = {},
  ) {
    await initialize();
    const names = [...new Set([...stores, TRAINING_MEMORY_STORES.METADATA])];
    return durableDatabase.runTransaction(names, 'readwrite', async (transaction) => {
      authorizationGuard?.();
      const currentMetadata = validateMetadata(
        await transaction.get(TRAINING_MEMORY_STORES.METADATA, METADATA_KEY),
      );
      authorizationGuard?.();
      const result = await operation(transaction);
      authorizationGuard?.();
      await transaction.put(
        TRAINING_MEMORY_STORES.METADATA,
        nextMetadata(currentMetadata, clock),
      );
      authorizationGuard?.();
      return result;
    }, { signal: authorizationSignal });
  }

  return Object.freeze({
    ownerRef: cloneTrainingMemoryData(ownerRef),
    database: durableDatabase,
    initialize,

    async createSession(session, {
      authorizationGuard = null,
      authorizationSignal = null,
    } = {}) {
      validateTrainingSessionRecord(session);
      ensureOwner(session, ownerRef, 'Training session');
      return withWrite([TRAINING_MEMORY_STORES.SESSIONS], async (transaction) => {
        const existing = await transaction.get(TRAINING_MEMORY_STORES.SESSIONS, session.id);
        if (existing) {
          if (existing.ownerKey !== ownerKey) ensureOwner(existing.value, ownerRef, 'Training session');
          if (sameData(existing.value, session)) return cloneTrainingMemoryData(session);
          throw new TrainingMemoryStorageError(
            'conflicting_id',
            'A different Training session already uses this ID.',
          );
        }
        await transaction.add(TRAINING_MEMORY_STORES.SESSIONS, sessionRecord(session));
        return cloneTrainingMemoryData(session);
      }, { authorizationGuard, authorizationSignal });
    },

    async getSession(id) {
      return withRead([TRAINING_MEMORY_STORES.SESSIONS], async (transaction) => {
        const stored = await transaction.get(TRAINING_MEMORY_STORES.SESSIONS, id);
        if (!stored) return null;
        ensureOwner(stored.value, ownerRef, 'Training session');
        return cloneTrainingMemoryData(stored.value);
      });
    },

    async getDecision(id) {
      return withRead([TRAINING_MEMORY_STORES.DECISIONS], async (transaction) => {
        const stored = await transaction.get(TRAINING_MEMORY_STORES.DECISIONS, id);
        if (!stored) return null;
        ensureOwner(stored.value, ownerRef, 'Training decision');
        return cloneTrainingMemoryData(stored.value);
      });
    },

    async addShownDecision(decision, {
      fullHandSource = null,
      authorizationGuard = null,
      authorizationSignal = null,
    } = {}) {
      validateTrainingDecisionRecord(decision);
      ensureOwner(decision, ownerRef, 'Training decision');
      if (decision.status !== TRAINING_DECISION_STATUSES.SHOWN) {
        throw new RangeError('addShownDecision requires a shown decision');
      }
      return withWrite(
        [TRAINING_MEMORY_STORES.SESSIONS, TRAINING_MEMORY_STORES.DECISIONS],
        async (transaction) => {
          const sessionStored = await transaction.get(
            TRAINING_MEMORY_STORES.SESSIONS,
            decision.sessionId,
          );
          if (!sessionStored) throw new TrainingMemoryStorageError('missing_session', 'Training session is missing.');
          const session = sessionStored.value;
          ensureOwner(session, ownerRef, 'Training session');
          const existing = await transaction.get(TRAINING_MEMORY_STORES.DECISIONS, decision.id);
          if (existing) {
            ensureOwner(existing.value, ownerRef, 'Training decision');
            if (sameData(existing.value, decision)) return cloneTrainingMemoryData(decision);
            throw new TrainingMemoryStorageError('conflicting_id', 'Training decision ID is already in use.');
          }
          requireSessionDecisionMembership(session, decision);
          const nextSession = cloneTrainingMemoryData(session);
          nextSession.decisionRecordIds.push(decision.id);
          nextSession.updatedAt = decision.updatedAt;
          if (fullHandSource !== null) nextSession.fullHandSource = cloneTrainingMemoryData(fullHandSource);
          validateTrainingSessionRecord(nextSession);
          const nextCache = cacheAfterShown(sessionStored.summaryCache, decision);
          await transaction.add(TRAINING_MEMORY_STORES.DECISIONS, decisionRecord(decision));
          await transaction.put(
            TRAINING_MEMORY_STORES.SESSIONS,
            sessionRecord(nextSession, nextCache),
          );
          return cloneTrainingMemoryData(decision);
        },
        { authorizationGuard, authorizationSignal },
      );
    },

    async replaceDecision(decision, {
      fullHandSource = null,
      authorizationGuard = null,
      authorizationSignal = null,
    } = {}) {
      validateTrainingDecisionRecord(decision);
      ensureOwner(decision, ownerRef, 'Training decision');
      return withWrite(
        [TRAINING_MEMORY_STORES.SESSIONS, TRAINING_MEMORY_STORES.DECISIONS],
        async (transaction) => {
          const stored = await transaction.get(TRAINING_MEMORY_STORES.DECISIONS, decision.id);
          if (!stored) throw new TrainingMemoryStorageError('missing_decision', 'Training decision is missing.');
          const before = stored.value;
          ensureOwner(before, ownerRef, 'Training decision');
          if (before.sessionId !== decision.sessionId || before.ordinal !== decision.ordinal
            || before.exerciseId !== decision.exerciseId || before.shownAt !== decision.shownAt) {
            throw new TrainingMemoryStorageError(
              'immutable_identity_mismatch',
              'Training decision immutable identity cannot change.',
            );
          }
          const sessionStored = await transaction.get(
            TRAINING_MEMORY_STORES.SESSIONS,
            decision.sessionId,
          );
          if (!sessionStored) throw new TrainingMemoryStorageError('missing_session', 'Training session is missing.');
          ensureOwner(sessionStored.value, ownerRef, 'Training session');
          const nextSession = cloneTrainingMemoryData(sessionStored.value);
          if (fullHandSource !== null) nextSession.fullHandSource = cloneTrainingMemoryData(fullHandSource);
          nextSession.updatedAt = decision.updatedAt;
          validateTrainingSessionRecord(nextSession);
          const nextCache = cacheAfterAnswer(sessionStored.summaryCache, before, decision);
          await transaction.put(TRAINING_MEMORY_STORES.DECISIONS, decisionRecord(decision));
          await transaction.put(
            TRAINING_MEMORY_STORES.SESSIONS,
            sessionRecord(nextSession, nextCache),
          );
          return cloneTrainingMemoryData(decision);
        },
        { authorizationGuard, authorizationSignal },
      );
    },

    async replaceSession(session, {
      authorizationGuard = null,
      authorizationSignal = null,
    } = {}) {
      validateTrainingSessionRecord(session);
      ensureOwner(session, ownerRef, 'Training session');
      return withWrite([TRAINING_MEMORY_STORES.SESSIONS], async (transaction) => {
        const stored = await transaction.get(TRAINING_MEMORY_STORES.SESSIONS, session.id);
        if (!stored) throw new TrainingMemoryStorageError('missing_session', 'Training session is missing.');
        ensureOwner(stored.value, ownerRef, 'Training session');
        if (stored.value.startedAt !== session.startedAt
          || !sameData(stored.value.decisionRecordIds, session.decisionRecordIds)) {
          throw new TrainingMemoryStorageError(
            'immutable_identity_mismatch',
            'Training session immutable identity or decision order cannot change.',
          );
        }
        await transaction.put(
          TRAINING_MEMORY_STORES.SESSIONS,
          sessionRecord(session, stored.summaryCache),
        );
        return cloneTrainingMemoryData(session);
      }, { authorizationGuard, authorizationSignal });
    },

    async listRecentSessions({ limit = 10 } = {}) {
      const bounded = queryLimit(limit);
      return withRead([TRAINING_MEMORY_STORES.SESSIONS], async (transaction) => {
        const records = await transaction.getAllByIndexRange(
          TRAINING_MEMORY_STORES.SESSIONS,
          TRAINING_MEMORY_INDEXES.OWNER_STARTED_AT,
          {
            lower: [ownerKey, STRING_FLOOR],
            upper: [ownerKey, STRING_CEILING],
            direction: 'prev',
            limit: bounded,
          },
        );
        return records.map((record) => ({
          session: cloneTrainingMemoryData(record.value),
          summary: cloneTrainingMemoryData(record.summaryCache),
        }));
      });
    },

    async listSessionDecisions(sessionId, { limit = 50, afterOrdinal = -1 } = {}) {
      const bounded = queryLimit(limit);
      if (!Number.isSafeInteger(afterOrdinal) || afterOrdinal < -1) {
        throw new RangeError('Training decision page cursor is invalid');
      }
      const session = await withRead(
        [TRAINING_MEMORY_STORES.SESSIONS],
        async (transaction) => {
          const stored = await transaction.get(TRAINING_MEMORY_STORES.SESSIONS, sessionId);
          if (!stored) return null;
          ensureOwner(stored.value, ownerRef, 'Training session');
          return cloneTrainingMemoryData(stored.value);
        },
      );
      if (session === null) return [];
      return withRead([TRAINING_MEMORY_STORES.DECISIONS], async (transaction) => {
        const records = await transaction.getAllByIndexRange(
          TRAINING_MEMORY_STORES.DECISIONS,
          TRAINING_MEMORY_INDEXES.OWNER_SESSION_ORDINAL,
          {
            lower: [ownerKey, sessionId, afterOrdinal + 1],
            upper: [ownerKey, sessionId, NUMBER_CEILING],
            direction: 'next',
            limit: bounded,
          },
        );
        return records.map((record) => cloneTrainingMemoryData(record.value));
      });
    },

    async listDueReview({ limit = 20, now = new Date() } = {}) {
      const bounded = queryLimit(limit);
      const nowIso = timestampFrom(() => now);
      return withRead([TRAINING_MEMORY_STORES.DECISIONS], async (transaction) => {
        const pending = await transaction.getAllByIndexRange(
          TRAINING_MEMORY_STORES.DECISIONS,
          TRAINING_MEMORY_INDEXES.OWNER_REVIEW_STATE_DUE_AT,
          {
            lower: [ownerKey, TRAINING_REVIEW_LIFECYCLE_STATES.PENDING, ISO_FLOOR],
            upper: [ownerKey, TRAINING_REVIEW_LIFECYCLE_STATES.PENDING, ISO_CEILING],
            direction: 'next',
            limit: bounded,
          },
        );
        const snoozed = await transaction.getAllByIndexRange(
          TRAINING_MEMORY_STORES.DECISIONS,
          TRAINING_MEMORY_INDEXES.OWNER_REVIEW_STATE_DUE_AT,
          {
            lower: [ownerKey, TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED, ISO_FLOOR],
            upper: [ownerKey, TRAINING_REVIEW_LIFECYCLE_STATES.SNOOZED, nowIso],
            direction: 'next',
            limit: bounded,
          },
        );
        return [...pending, ...snoozed]
          .map((record) => deriveTrainingReviewItem(record.value, { now }))
          .filter((item) => item.due && item.reasons.length > 0)
          .sort((left, right) => right.priority - left.priority
            || left.record.shownAt.localeCompare(right.record.shownAt)
            || left.recordId.localeCompare(right.recordId))
          .slice(0, bounded);
      });
    },

    async listSimilarHistory(similarityKey, { limit = 20 } = {}) {
      const bounded = queryLimit(limit);
      if (typeof similarityKey !== 'string' || !similarityKey) {
        throw new TypeError('Training similarity key is required');
      }
      return withRead([TRAINING_MEMORY_STORES.DECISIONS], async (transaction) => {
        const records = await transaction.getAllByIndexRange(
          TRAINING_MEMORY_STORES.DECISIONS,
          TRAINING_MEMORY_INDEXES.OWNER_SIMILARITY_ANSWERED_AT,
          {
            lower: [ownerKey, similarityKey, ISO_FLOOR],
            upper: [ownerKey, similarityKey, ISO_CEILING],
            direction: 'prev',
            limit: bounded,
          },
        );
        return records.map((record) => cloneTrainingMemoryData(record.value));
      });
    },

    async close() {
      await durableDatabase.close?.();
    },
  });
}
