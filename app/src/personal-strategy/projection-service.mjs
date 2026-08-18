import { isPreflopHandClass } from '../../../shared/poker-domain/index.js';
import { calibrationContextKey, validateCalibrationContext } from './domain.mjs';
import { createPersonalStrategyEvidenceView } from './evidence-view.mjs';
import {
  createPersonalStrategySnapshot,
  estimatePersonalStrategyHand,
} from './rfi-inference.mjs';

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
      metrics.cacheHits += 1;
      return current;
    }
    metrics.evidenceViewBuilds += 1;
    const next = { evidenceView: view, estimates: new Map(), snapshot: null };
    cache.set(key, next);
    return next;
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
    entry.snapshot = createPersonalStrategySnapshot(entry.evidenceView);
    entry.snapshot.estimates.forEach((estimate) => entry.estimates.set(estimate.handClass, estimate));
    metrics.snapshotBuilds += 1;
    return entry.snapshot;
  }

  function invalidateScope(scope) {
    const deleted = cache.delete(scopeCacheKey(scope));
    if (deleted) metrics.invalidations += 1;
    return deleted;
  }

  return Object.freeze({
    schemaVersion: PERSONAL_STRATEGY_PROJECTION_SERVICE_SCHEMA_VERSION,
    getEvidenceView,
    getStrategyEstimate,
    getStrategySnapshot,
    async getInferenceSupport(scope, handClass) {
      return (await getStrategyEstimate(scope, handClass)).support;
    },
    invalidateScope,
    getCacheMetrics() {
      return Object.freeze({ ...metrics, cachedScopeCount: cache.size });
    },
  });
}
