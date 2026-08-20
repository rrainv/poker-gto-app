import {
  SAVED_SPOT_DERIVATIONS,
  SAVED_STUDY_CLASSIFICATIONS,
  SAVED_STUDY_KINDS,
  SAVED_STUDY_LIFECYCLE_STATES,
  SAVED_STUDY_SOURCE_SURFACES,
} from '../saved-study-objects/index.mjs';

export const SAVED_STUDY_SOURCE_CONTROLLER_SCHEMA_VERSION = 'saved-study-source-controller/v1';
export const SAVED_STUDY_SOURCE_REFERENCE_KEY_PREFIX = 'riverline.savedStudyObjects.sourceRef.v1:';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  for (const character of String(value)) {
    hash ^= BigInt(character.codePointAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function scenarioIdentityInput(scenarioInput) {
  if (!scenarioInput || !['playbook-scenario/v1', 'playbook-scenario/v2']
    .includes(scenarioInput.schemaVersion)) {
    throw new TypeError('A canonical Playbook Scenario input is required');
  }
  // lastActionLabel is localized presentation copy; the canonical action value owns identity.
  const { lastActionLabel: _localizedLabel, ...identityInput } = scenarioInput;
  return identityInput;
}

export function createSavedStudySourceIdentity({
  mode,
  pokerState = null,
  handSourceId = null,
  scenarioInput = null,
} = {}) {
  if (mode === 'hand') {
    const handId = pokerState?.handId;
    if (typeof handId !== 'string' || !handId.trim()) return null;
    const sourceId = typeof handSourceId === 'string' && handSourceId.trim()
      ? handSourceId
      : handId;
    const key = `hand:${sourceId}`;
    return deepFreeze({
      kind: SAVED_STUDY_KINDS.HAND,
      key,
      sourceId,
      canonicalHandId: handId,
      operationId: `saved-hand-${fnv1a64(key)}`,
    });
  }
  if (mode === 'scenario') {
    const canonicalInput = scenarioIdentityInput(scenarioInput);
    const fingerprint = fnv1a64(stableJson(canonicalInput));
    return deepFreeze({
      kind: SAVED_STUDY_KINDS.SPOT,
      key: `scenario:${fingerprint}`,
      sourceId: `scenario-${fingerprint}`,
      operationId: `saved-spot-${fingerprint}`,
    });
  }
  return null;
}

function requireStorage(storage) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function'
    || typeof storage.removeItem !== 'function') {
    throw new TypeError('Saved Study source identity requires a Storage-compatible adapter');
  }
  return storage;
}

function sourceReferenceKey(identity) {
  return `${SAVED_STUDY_SOURCE_REFERENCE_KEY_PREFIX}${encodeURIComponent(identity.key)}`;
}

function referenceFromStorage(storage, identity) {
  const key = sourceReferenceKey(identity);
  const encoded = storage.getItem(key);
  if (!encoded) return null;
  try {
    const reference = JSON.parse(encoded);
    if (reference?.schemaVersion !== 'saved-study-source-reference/v1'
      || reference.sourceKey !== identity.key
      || typeof reference.objectId !== 'string'
      || typeof reference.createdAt !== 'string') {
      throw new TypeError('Invalid source reference');
    }
    return reference;
  } catch (_) {
    storage.removeItem(key);
    return null;
  }
}

function establishReference(storage, identity, clock) {
  const existing = referenceFromStorage(storage, identity);
  if (existing) return existing;
  const timestamp = clock();
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Saved Study source clock returned an invalid date');
  const reference = {
    schemaVersion: 'saved-study-source-reference/v1',
    sourceKey: identity.key,
    objectId: identity.operationId,
    createdAt: date.toISOString(),
  };
  storage.setItem(sourceReferenceKey(identity), JSON.stringify(reference));
  return reference;
}

function clearReference(storage, identity) {
  storage.removeItem(sourceReferenceKey(identity));
}

function objectMatchesIdentity(object, identity) {
  if (!object || object.lifecycle?.state !== SAVED_STUDY_LIFECYCLE_STATES.ACTIVE) return false;
  if (object.kind !== identity.kind || object.source?.sourceId !== identity.sourceId) return false;
  if (identity.kind === SAVED_STUDY_KINDS.HAND) {
    return object.payload?.pokerState?.handId === identity.canonicalHandId;
  }
  return object.payload?.derivation === SAVED_SPOT_DERIVATIONS.SCENARIO;
}

function status(state, details = {}) {
  return deepFreeze({
    schemaVersion: SAVED_STUDY_SOURCE_CONTROLLER_SCHEMA_VERSION,
    state,
    identity: null,
    object: null,
    ...details,
  });
}

export function createSavedStudyObjectSourceController({
  application,
  storage,
  getPlaybookBridge,
  clock = () => new Date(),
} = {}) {
  if (!application || typeof application.saveHand !== 'function'
    || typeof application.saveScenarioDerivedSpot !== 'function') {
    throw new TypeError('Saved Study source controller requires the application service');
  }
  const durableStorage = requireStorage(storage);
  if (typeof getPlaybookBridge !== 'function' || typeof clock !== 'function') {
    throw new TypeError('Saved Study source controller requires bridge and clock functions');
  }
  const inFlightSaves = new Map();
  const objectCache = new Map();

  function currentIdentity({ mode, scenarioInput = null } = {}) {
    if (mode === 'hand') {
      const bridge = getPlaybookBridge();
      return createSavedStudySourceIdentity({
        mode,
        pokerState: bridge?.getState?.() ?? null,
        handSourceId: bridge?.getCanonicalHandSourceId?.() ?? null,
      });
    }
    if (mode === 'scenario') return createSavedStudySourceIdentity({ mode, scenarioInput });
    return null;
  }

  async function resolve(identity) {
    if (!identity) return status('unavailable');
    const cached = objectCache.get(identity.key);
    if (objectMatchesIdentity(cached, identity)) return status('saved', { identity, object: cached });
    const reference = referenceFromStorage(durableStorage, identity);
    if (!reference) return status('unsaved', { identity });
    const object = await application.getById(reference.objectId);
    if (!objectMatchesIdentity(object, identity)) {
      clearReference(durableStorage, identity);
      objectCache.delete(identity.key);
      return status('unsaved', { identity });
    }
    objectCache.set(identity.key, object);
    return status('saved', { identity, object });
  }

  async function saveHand(identity) {
    const bridge = getPlaybookBridge();
    const pokerState = bridge?.getState?.() ?? null;
    const heroPlayerId = bridge?.getHeroPlayerId?.() ?? null;
    const replaySource = bridge?.createCanonicalHandReplaySource?.() ?? null;
    const projection = bridge?.createReplayProjectionViewModel?.() ?? null;
    if (!pokerState || !heroPlayerId || !replaySource) {
      throw new RangeError('A canonical Hand and replay source are required before saving');
    }
    const reference = establishReference(durableStorage, identity, clock);
    return application.saveHand({
      pokerState,
      heroPlayerId,
      replaySource,
      sourceSurface: projection?.readOnly
        ? SAVED_STUDY_SOURCE_SURFACES.REPLAY
        : SAVED_STUDY_SOURCE_SURFACES.HAND,
      sourceId: identity.sourceId,
      operation: { id: reference.objectId, createdAt: reference.createdAt },
    });
  }

  async function saveScenario(identity, scenarioInput, decisionContext) {
    if (decisionContext?.schemaVersion !== 'decision-context/v1') {
      throw new RangeError('A resolved Scenario decision is required before saving');
    }
    const reference = establishReference(durableStorage, identity, clock);
    return application.saveScenarioDerivedSpot({
      scenarioInput,
      decisionContext,
      rulesSnapshot: scenarioInput.schemaVersion === 'playbook-scenario/v2'
        ? scenarioInput.rulesSnapshot
        : null,
      sourceSurface: SAVED_STUDY_SOURCE_SURFACES.PLAYBOOK,
      sourceId: identity.sourceId,
      operation: { id: reference.objectId, createdAt: reference.createdAt },
    });
  }

  return Object.freeze({
    schemaVersion: SAVED_STUDY_SOURCE_CONTROLLER_SCHEMA_VERSION,

    getCurrentStatus(input = {}) {
      try {
        return resolve(currentIdentity(input));
      } catch (error) {
        return Promise.reject(error);
      }
    },

    async saveCurrent({ mode, scenarioInput = null, decisionContext = null } = {}) {
      const identity = currentIdentity({ mode, scenarioInput });
      if (!identity) throw new RangeError('The current source is not saveable');
      const existingFlight = inFlightSaves.get(identity.key);
      if (existingFlight) return existingFlight;
      const operation = (async () => {
        const existing = await resolve(identity);
        if (existing.state === 'saved') return deepFreeze({ object: existing.object, created: false });
        const result = mode === 'hand'
          ? await saveHand(identity)
          : await saveScenario(identity, scenarioInput, decisionContext);
        objectCache.set(identity.key, result.object);
        return deepFreeze({ object: result.object, created: result.created });
      })();
      inFlightSaves.set(identity.key, operation);
      try {
        return await operation;
      } finally {
        if (inFlightSaves.get(identity.key) === operation) inFlightSaves.delete(identity.key);
      }
    },

    async updateAnnotations(id, changes, options = {}) {
      const result = await application.updateAnnotations(id, changes, options);
      for (const [key, object] of objectCache) {
        if (object.id === id) objectCache.set(key, result.object);
      }
      return result;
    },

    async archiveCurrent({ mode, scenarioInput = null, expectedRevision = null } = {}) {
      const identity = currentIdentity({ mode, scenarioInput });
      if (!identity) throw new RangeError('The current source is not saveable');
      const current = await resolve(identity);
      if (current.state !== 'saved') throw new RangeError('The current source is not saved');
      const result = await application.archive(current.object.id, {
        expectedRevision: expectedRevision ?? current.object.revision,
      });
      clearReference(durableStorage, identity);
      objectCache.delete(identity.key);
      return result;
    },

    classificationsWithMistake(object, selected) {
      const values = new Set(object?.annotations?.classifications || []);
      if (selected) values.add(SAVED_STUDY_CLASSIFICATIONS.MISTAKE);
      else values.delete(SAVED_STUDY_CLASSIFICATIONS.MISTAKE);
      return [...values].sort();
    },
  });
}
