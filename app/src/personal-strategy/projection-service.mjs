import { isPreflopHandClass } from '../../../shared/poker-domain/index.js';
import { calibrationContextKey, validateCalibrationContext } from './domain.mjs';
import { createPersonalStrategyEvidenceView } from './evidence-view.mjs';
import {
  createPersonalStrategySnapshot,
  estimatePersonalStrategyHand,
} from './rfi-inference.mjs';
import {
  MAX_RFI_TRANSFER_DONOR_CONTEXTS,
  createRfiContextTransferProjection,
  createRfiContextTransferRelationship,
} from './rfi-context-transfer.mjs';

export const PERSONAL_STRATEGY_PROJECTION_SERVICE_SCHEMA_VERSION = 'personal-strategy-projection-service/v1';

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

function scopeCacheKey({ profileId, modeId, context } = {}) {
  requireString(profileId, 'Personal Strategy scope profileId');
  requireString(modeId, 'Personal Strategy scope modeId');
  validateCalibrationContext(context);
  return `${profileId}|${modeId}|${calibrationContextKey(context)}`;
}

export function createPersonalStrategyProjectionService({ repository } = {}) {
  if (!repository || typeof repository.loadEvidenceScope !== 'function') {
    throw new TypeError('Personal Strategy projection service requires a scope-aware repository');
  }
  const cache = new Map();
  const metrics = {
    evidenceLoads: 0,
    evidenceViewBuilds: 0,
    estimateBuilds: 0,
    snapshotBuilds: 0,
    transferCatalogLoads: 0,
    transferRelationshipBuilds: 0,
    transferDonorScopeLoads: 0,
    transferProjectionBuilds: 0,
    transferCacheHits: 0,
    cacheHits: 0,
    invalidations: 0,
  };

  async function entryFor(scope) {
    const key = scopeCacheKey(scope);
    metrics.evidenceLoads += 1;
    const source = await repository.loadEvidenceScope(scope);
    const view = createPersonalStrategyEvidenceView({
      profileId: scope.profileId,
      modeId: scope.modeId,
      context: scope.context,
      rangeObservations: source.rangeObservations,
      trainingObservations: source.trainingObservations,
    });
    const current = cache.get(key);
    if (current?.evidenceView.evidenceFingerprint === view.evidenceFingerprint) {
      current.source = source;
      metrics.cacheHits += 1;
      return current;
    }
    metrics.evidenceViewBuilds += 1;
    const next = {
      evidenceView: view,
      estimates: new Map(),
      snapshot: null,
      transferProjection: null,
      transferInputs: null,
      transferCatalogFingerprint: null,
      source,
    };
    cache.set(key, next);
    return next;
  }

  function ensureSnapshot(entry) {
    if (!entry.snapshot) {
      entry.snapshot = createPersonalStrategySnapshot(entry.evidenceView);
      entry.snapshot.estimates.forEach((estimate) => entry.estimates.set(estimate.handClass, estimate));
      metrics.snapshotBuilds += 1;
    }
    return entry.snapshot;
  }

  async function transferProjectionFor(scope, entry) {
    const targetSnapshot = ensureSnapshot(entry);
    if (typeof repository.loadEvidenceScopeCatalog !== 'function') {
      if (entry.transferProjection) {
        metrics.transferCacheHits += 1;
        return entry.transferProjection;
      }
      entry.transferProjection = createRfiContextTransferProjection({ targetSnapshot });
      metrics.transferProjectionBuilds += 1;
      return entry.transferProjection;
    }
    const inputs = await transferInputsFor(scope, entry);
    if (entry.transferProjection
      && entry.transferCatalogFingerprint === inputs.donorCatalogFingerprint) {
      metrics.transferCacheHits += 1;
      return entry.transferProjection;
    }
    entry.transferProjection = createRfiContextTransferProjection({
      targetSnapshot,
      ...inputs,
    });
    entry.transferCatalogFingerprint = inputs.donorCatalogFingerprint;
    metrics.transferProjectionBuilds += 1;
    return entry.transferProjection;
  }

  async function transferInputsFor(scope, entry) {
    const catalog = await repository.loadEvidenceScopeCatalog({
      profileId: scope.profileId,
      modeId: scope.modeId,
    });
    metrics.transferCatalogLoads += 1;
    if (entry.transferInputs
      && entry.transferInputs.donorCatalogFingerprint === catalog.catalogFingerprint) {
      metrics.transferCacheHits += 1;
      return entry.transferInputs;
    }
    const relationships = catalog.scopes.map((candidate) => createRfiContextTransferRelationship({
      profileId: scope.profileId,
      modeId: scope.modeId,
      context: candidate.context,
    }, scope));
    metrics.transferRelationshipBuilds += relationships.length;
    const eligible = relationships.filter((relationship) => relationship.eligible)
      .sort((left, right) => (
        right.transferStrength - left.transferStrength
        || left.donorScope.contextKey.localeCompare(right.donorScope.contextKey, 'en')
      )).slice(0, MAX_RFI_TRANSFER_DONOR_CONTEXTS);
    const contextByKey = new Map(catalog.scopes.map((candidate) => [candidate.contextKey, candidate.context]));
    const donors = await Promise.all(eligible.map(async (relationship) => {
      const donorScope = {
        profileId: scope.profileId,
        modeId: scope.modeId,
        context: contextByKey.get(relationship.donorScope.contextKey),
      };
      const donorEntry = await entryFor(donorScope);
      metrics.transferDonorScopeLoads += 1;
      return {
        relationship,
        snapshot: ensureSnapshot(donorEntry),
      };
    }));
    entry.transferInputs = Object.freeze({
      relationships,
      donors,
      donorCatalogFingerprint: catalog.catalogFingerprint,
    });
    return entry.transferInputs;
  }

  async function getEvidenceView(scope) {
    return (await entryFor(scope)).evidenceView;
  }

  async function getStrategyEstimate(scope, handClass) {
    if (!isPreflopHandClass(handClass)) {
      throw new RangeError(`Unsupported preflop hand class: ${handClass}`);
    }
    const entry = await entryFor(scope);
    if (entry.estimates.has(handClass)) {
      metrics.cacheHits += 1;
      return entry.estimates.get(handClass);
    }
    const estimate = estimatePersonalStrategyHand(entry.evidenceView, handClass);
    entry.estimates.set(handClass, estimate);
    metrics.estimateBuilds += 1;
    return estimate;
  }

  async function getStrategySnapshot(scope) {
    const entry = await entryFor(scope);
    if (entry.snapshot) {
      metrics.cacheHits += 1;
      return entry.snapshot;
    }
    return ensureSnapshot(entry);
  }

  async function getProjectionBundle(scope) {
    const entry = await entryFor(scope);
    if (entry.snapshot) metrics.cacheHits += 1;
    const snapshot = ensureSnapshot(entry);
    const transferProjection = await transferProjectionFor(scope, entry);
    return Object.freeze({
      evidenceView: entry.evidenceView,
      snapshot,
      transferProjection,
      source: Object.freeze({
        rangeObservations: Object.freeze([...entry.source.rangeObservations]),
        trainingObservations: Object.freeze([...entry.source.trainingObservations]),
      }),
    });
  }

  async function previewStrategySnapshot(scope, {
    additionalRangeObservations = [],
    additionalTrainingObservations = [],
    source: suppliedSource = null,
  } = {}) {
    const source = suppliedSource ?? await repository.loadEvidenceScope(scope);
    const view = createPersonalStrategyEvidenceView({
      profileId: scope.profileId,
      modeId: scope.modeId,
      context: scope.context,
      rangeObservations: [...source.rangeObservations, ...additionalRangeObservations],
      trainingObservations: [...source.trainingObservations, ...additionalTrainingObservations],
    });
    return createPersonalStrategySnapshot(view);
  }

  async function previewProjectionBundle(scope, options = {}) {
    const entry = cache.get(scopeCacheKey(scope)) ?? await entryFor(scope);
    const snapshot = await previewStrategySnapshot(scope, {
      ...options,
      source: options.source ?? entry.source,
    });
    const transferProjection = typeof repository.loadEvidenceScopeCatalog === 'function'
      ? createRfiContextTransferProjection({
        targetSnapshot: snapshot,
        ...(entry.transferInputs ?? await transferInputsFor(scope, entry)),
      })
      : createRfiContextTransferProjection({ targetSnapshot: snapshot });
    metrics.transferProjectionBuilds += 1;
    return Object.freeze({ snapshot, transferProjection });
  }

  function invalidateScope(scope) {
    const deleted = cache.delete(scopeCacheKey(scope));
    if (deleted) metrics.invalidations += 1;
    return deleted;
  }

  return Object.freeze({
    schemaVersion: PERSONAL_STRATEGY_PROJECTION_SERVICE_SCHEMA_VERSION,
    getEvidenceView,
    async getEvidenceSource(scope) {
      const entry = await entryFor(scope);
      return Object.freeze({
        rangeObservations: Object.freeze([...entry.source.rangeObservations]),
        trainingObservations: Object.freeze([...entry.source.trainingObservations]),
      });
    },
    getStrategyEstimate,
    getStrategySnapshot,
    getProjectionBundle,
    async getTransferProjection(scope) {
      const entry = await entryFor(scope);
      return transferProjectionFor(scope, entry);
    },
    previewStrategySnapshot,
    previewProjectionBundle,
    async getInferenceSupport(scope, handClass) {
      return (await getStrategyEstimate(scope, handClass)).support;
    },
    invalidateScope,
    getCacheMetrics() {
      return Object.freeze({ ...metrics, cachedScopeCount: cache.size });
    },
  });
}
