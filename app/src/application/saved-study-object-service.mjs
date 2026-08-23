import {
  POKER_STATE_V2_SCHEMA_VERSION,
  validatePokerState,
} from '../../../shared/poker-domain/index.js';
import {
  SAVED_SPOT_DERIVATIONS,
  SAVED_STUDY_CLASSIFICATIONS,
  SAVED_STUDY_KINDS,
  SAVED_STUDY_REVIEW_STATES,
  SAVED_STUDY_SOURCE_SURFACES,
  createSavedHandReference,
  createSavedHandSnapshot,
  createSavedSpotSnapshot,
  createSavedStudyAnnotations,
  createSavedStudyBrowserStorage,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudyRepository,
  createSavedStudySource,
  parseSavedStudyLibraryExport,
  savedStudyOwnerKey,
} from '../saved-study-objects/index.mjs';
import { LEGACY_SAVED_STUDY_OWNER_KEY } from '../account-identity/legacy-ownership.mjs';
import { deriveDecisionContextFromPokerState } from './decision-context-from-poker-state.mjs';

export const SAVED_STUDY_LOCAL_OWNER_KEY = LEGACY_SAVED_STUDY_OWNER_KEY;

function defaultIdFactory(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  const random = Math.random().toString(36).slice(2, 14);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function timestampFrom(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Saved Study clock returned an invalid date');
  return date.toISOString();
}

function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('Saved Study requires a Storage-compatible adapter');
  }
  return storage;
}

function getOrCreateOwnerRef(storage, idFactory) {
  let id = storage.getItem(SAVED_STUDY_LOCAL_OWNER_KEY);
  if (typeof id !== 'string' || !id.trim()) {
    id = idFactory('local-owner');
    storage.setItem(SAVED_STUDY_LOCAL_OWNER_KEY, id);
  }
  return createSavedStudyOwnerRef(id);
}

function operationIdentity(operation, idFactory, clock) {
  const supplied = operation ?? {};
  return Object.freeze({
    id: supplied.id ?? idFactory('saved-study'),
    createdAt: supplied.createdAt ?? timestampFrom(clock),
  });
}

function annotationInput(input = {}) {
  return {
    title: input.title ?? null,
    note: input.note ?? null,
    tags: input.tags ?? [],
    reviewState: input.reviewState ?? SAVED_STUDY_REVIEW_STATES.NONE,
    classifications: input.classifications ?? [],
  };
}

/**
 * Lazy application boundary for all Saved / Noted Study Object work.
 * Creating this service performs no Web Storage or IndexedDB work.
 */
export function createSavedStudyObjectApplication({
  storage = null,
  database = null,
  repository = null,
  ownerRef = null,
  activationResolver = null,
  onLocalMutation = null,
  clock = () => new Date(),
  idFactory = defaultIdFactory,
} = {}) {
  if (typeof clock !== 'function' || typeof idFactory !== 'function') {
    throw new TypeError('Saved Study clock and idFactory must be functions');
  }
  if (activationResolver !== null && typeof activationResolver !== 'function') {
    throw new TypeError('Saved Study activationResolver must be a function');
  }
  if (onLocalMutation !== null && typeof onLocalMutation !== 'function') {
    throw new TypeError('Saved Study onLocalMutation must be a function');
  }
  let fixedActivationPromise = null;
  const scopedActivations = new Map();
  const reviewedDecisionOperations = new Map();

  async function activateFixed() {
    if (fixedActivationPromise) return fixedActivationPromise;
    fixedActivationPromise = Promise.resolve().then(async () => {
      if (repository) {
        await repository.initialize();
        return Object.freeze({ repository, ownerRef: repository.ownerRef });
      }
      const storageAdapter = ownerRef === null
        ? requireStorage(storage ?? createSavedStudyBrowserStorage())
        : storage;
      const resolvedOwnerRef = ownerRef ?? getOrCreateOwnerRef(storageAdapter, idFactory);
      const durableRepository = createSavedStudyRepository({ database, ownerRef: resolvedOwnerRef, clock });
      await durableRepository.initialize();
      return Object.freeze({ repository: durableRepository, ownerRef: resolvedOwnerRef });
    });
    try {
      return await fixedActivationPromise;
    } catch (error) {
      fixedActivationPromise = null;
      throw error;
    }
  }

  async function activate() {
    if (!activationResolver) return activateFixed();
    const resolved = await activationResolver();
    if (!resolved) return activateFixed();
    const resolvedOwnerRef = resolved.ownerRef;
    const resolvedDatabase = resolved.database ?? null;
    const key = `${resolvedDatabase?.name ?? 'default'}:${savedStudyOwnerKey(resolvedOwnerRef)}`;
    if (!scopedActivations.has(key)) {
      const activation = Promise.resolve().then(async () => {
        const durableRepository = createSavedStudyRepository({
          database: resolvedDatabase,
          ownerRef: resolvedOwnerRef,
          clock,
        });
        await durableRepository.initialize();
        return Object.freeze({ repository: durableRepository, ownerRef: resolvedOwnerRef });
      }).catch((error) => {
        scopedActivations.delete(key);
        throw error;
      });
      scopedActivations.set(key, activation);
    }
    return scopedActivations.get(key);
  }

  async function saveObject({ kind, payload, source, annotations, operation }) {
    const activated = await activate();
    const identity = operationIdentity(operation, idFactory, clock);
    const object = createSavedStudyObject({
      id: identity.id,
      ownerRef: activated.ownerRef,
      kind,
      createdAt: identity.createdAt,
      annotations,
      source,
      payload,
    });
    const result = await activated.repository.save(object);
    if (!result.idempotent) await notifyLocalMutation('upsert', result.object);
    return result;
  }

  async function notifyLocalMutation(type, object) {
    if (!onLocalMutation) return;
    try {
      await onLocalMutation(Object.freeze({
        schemaVersion: 'saved-study-local-mutation/v1',
        type,
        object,
      }));
    } catch {
      // The canonical local write already committed. Sync reports its own durable
      // sidecar failure and must never make an ordinary Saved action appear lost.
    }
  }

  async function saveHand({
    pokerState,
    heroPlayerId,
    replaySource,
    sourceSurface = SAVED_STUDY_SOURCE_SURFACES.HAND,
    sourceId = pokerState?.handId ?? null,
    operation = null,
    ...annotations
  } = {}) {
    const payload = createSavedHandSnapshot({ pokerState, heroPlayerId, replaySource });
    return saveObject({
      kind: SAVED_STUDY_KINDS.HAND,
      payload,
      source: createSavedStudySource({ surface: sourceSurface, sourceId }),
      annotations: createSavedStudyAnnotations(annotationInput(annotations)),
      operation,
    });
  }

  async function saveHandDerivedSpot({
    pokerState,
    heroPlayerId,
    projectionOptions = {},
    savedHandObjectId = null,
    sourceSurface = SAVED_STUDY_SOURCE_SURFACES.PLAYBOOK,
    sourceId = pokerState?.handId ?? null,
    operation = null,
    ...annotations
  } = {}) {
    validatePokerState(pokerState);
    const decisionContext = deriveDecisionContextFromPokerState(
      pokerState,
      heroPlayerId,
      projectionOptions,
    );
    const payload = createSavedSpotSnapshot({
      derivation: SAVED_SPOT_DERIVATIONS.HAND,
      decisionContext,
      rulesSnapshot: pokerState.schemaVersion === POKER_STATE_V2_SCHEMA_VERSION
        ? pokerState.rulesSnapshot
        : null,
      handReference: createSavedHandReference({
        savedHandObjectId,
        canonicalHandId: pokerState.handId,
        actionSequenceCount: pokerState.actionHistory.length,
      }),
    });
    return saveObject({
      kind: SAVED_STUDY_KINDS.SPOT,
      payload,
      source: createSavedStudySource({
        surface: sourceSurface,
        sourceId,
        parentObjectId: savedHandObjectId,
      }),
      annotations: createSavedStudyAnnotations(annotationInput(annotations)),
      operation,
    });
  }

  async function saveReviewedDecisionSpot({
    decisionId,
    canonicalHandId,
    actionSequenceCount,
    decisionContext,
    rulesSnapshot = null,
    savedHandObjectId = null,
    sourceSurface = SAVED_STUDY_SOURCE_SURFACES.REPLAY,
    sourceId = null,
    operation = null,
    ...annotations
  } = {}) {
    if (typeof decisionId !== 'string' || !decisionId.trim()) {
      throw new TypeError('A reviewed Hero decision ID is required');
    }
    if (typeof canonicalHandId !== 'string' || !canonicalHandId.trim()) {
      throw new TypeError('A reviewed canonical Hand ID is required');
    }
    if (!Number.isSafeInteger(actionSequenceCount) || actionSequenceCount < 0) {
      throw new RangeError('A reviewed action sequence count must be nonnegative');
    }
    const operationKey = `${sourceSurface}:${canonicalHandId}:${decisionId}`;
    if (!reviewedDecisionOperations.has(operationKey)) {
      reviewedDecisionOperations.set(
        operationKey,
        operationIdentity(operation, idFactory, clock),
      );
    }
    const payload = createSavedSpotSnapshot({
      derivation: SAVED_SPOT_DERIVATIONS.HAND,
      decisionContext,
      rulesSnapshot,
      handReference: createSavedHandReference({
        savedHandObjectId,
        canonicalHandId,
        actionSequenceCount,
      }),
    });
    return saveObject({
      kind: SAVED_STUDY_KINDS.SPOT,
      payload,
      source: createSavedStudySource({
        surface: sourceSurface,
        sourceId: sourceId ?? `${canonicalHandId}:${decisionId}`,
        parentObjectId: savedHandObjectId,
      }),
      annotations: createSavedStudyAnnotations(annotationInput(annotations)),
      operation: reviewedDecisionOperations.get(operationKey),
    });
  }

  async function saveScenarioDerivedSpot({
    scenarioInput,
    decisionContext,
    rulesSnapshot = null,
    sourceSurface = SAVED_STUDY_SOURCE_SURFACES.PLAYBOOK,
    sourceId = null,
    operation = null,
    ...annotations
  } = {}) {
    const durableRulesSnapshot = rulesSnapshot
      ?? (scenarioInput?.schemaVersion === 'playbook-scenario/v2'
        ? scenarioInput.rulesSnapshot
        : null);
    const payload = createSavedSpotSnapshot({
      derivation: SAVED_SPOT_DERIVATIONS.SCENARIO,
      decisionContext,
      scenarioInput,
      rulesSnapshot: durableRulesSnapshot,
    });
    return saveObject({
      kind: SAVED_STUDY_KINDS.SPOT,
      payload,
      source: createSavedStudySource({ surface: sourceSurface, sourceId }),
      annotations: createSavedStudyAnnotations(annotationInput(annotations)),
      operation,
    });
  }

  return Object.freeze({
    activate,
    saveHand,
    saveSpot(input = {}) {
      if (input.derivation === SAVED_SPOT_DERIVATIONS.HAND) return saveHandDerivedSpot(input);
      if (input.derivation === SAVED_SPOT_DERIVATIONS.SCENARIO) return saveScenarioDerivedSpot(input);
      throw new RangeError(`Unsupported saved spot derivation: ${input.derivation}`);
    },
    saveHandDerivedSpot,
    saveReviewedDecisionSpot,
    saveScenarioDerivedSpot,
    async updateAnnotations(id, changes, options = {}) {
      const activated = await activate();
      const result = await activated.repository.updateAnnotations(id, changes, options);
      await notifyLocalMutation('upsert', result.object);
      return result;
    },
    async getById(id, options = {}) {
      return (await activate()).repository.getById(id, options);
    },
    async listRecent(options = {}) {
      return (await activate()).repository.listRecent(options);
    },
    async listByKind(kind, options = {}) {
      return (await activate()).repository.listByKind(kind, options);
    },
    async listForReview(options = {}) {
      return (await activate()).repository.listForReview(options);
    },
    async listByTag(tag, options = {}) {
      return (await activate()).repository.listByTag(tag, options);
    },
    async listMistakes(options = {}) {
      return (await activate()).repository.listByClassification(
        SAVED_STUDY_CLASSIFICATIONS.MISTAKE,
        options,
      );
    },
    async archive(id, options = {}) {
      const result = await (await activate()).repository.archive(id, options);
      if (!result.idempotent) await notifyLocalMutation('tombstone', result.object);
      return result;
    },
    async exportLibrary(options = {}) {
      return (await activate()).repository.exportLibrary(options);
    },
    async importLibrary(value, options = {}) {
      const activated = await activate();
      const portable = parseSavedStudyLibraryExport(value);
      const absentIds = [];
      for (const object of portable.objects) {
        if (!await activated.repository.getById(object.id)) absentIds.push(object.id);
      }
      const result = await activated.repository.importLibrary(value, options);
      for (const id of absentIds) {
        const object = await activated.repository.getById(id);
        await notifyLocalMutation(
          object.lifecycle.state === 'archived' ? 'tombstone' : 'upsert',
          object,
        );
      }
      return result;
    },
    async listAllForSync() {
      return (await activate()).repository.listAllForSync();
    },
    async applySyncedObject(object, options = {}) {
      return (await activate()).repository.applySyncedObject(object, options);
    },
    async close() {
      const activations = [
        ...(fixedActivationPromise ? [fixedActivationPromise] : []),
        ...scopedActivations.values(),
      ];
      const resolved = await Promise.all(activations);
      await Promise.all(resolved.map((entry) => entry.repository.close()));
      fixedActivationPromise = null;
      scopedActivations.clear();
    },
  });
}
