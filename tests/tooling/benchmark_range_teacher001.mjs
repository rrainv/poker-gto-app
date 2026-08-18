#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

import { ACTION_TYPES } from '../../shared/poker-domain/index.js';
import {
  createContextFromSelection,
  createRangeCalibrationApplication,
} from '../../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../../app/src/personal-strategy/indexeddb-storage.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

let sequence = 0;
let tick = 0;
const application = createRangeCalibrationApplication({
  storage: memoryStorage(),
  database: createMemoryPersonalStrategyDatabase({ name: 'range-teacher001-benchmark' }),
  idFactory: (prefix) => `${prefix}-${++sequence}`,
  clock: () => new Date(Date.parse('2026-08-18T22:00:00.000Z') + tick++ * 1000),
});
const bundle = await application.createProfile({
  displayName: 'Teacher benchmark',
  description: '',
  environment: 'home',
  modeNames: ['Standard', 'Cautious', 'Pressure'],
});
const scope = {
  profileId: bundle.profile.id,
  modeId: bundle.modes[0].id,
  context: createContextFromSelection({
    environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  }),
};

const coldStartedAt = performance.now();
const cold = await application.getRangeTeacherView(scope);
const coldViewMs = performance.now() - coldStartedAt;

const cachedStartedAt = performance.now();
const cached = await application.getRangeTeacherView(scope);
const cachedViewMs = performance.now() - cachedStartedAt;

await application.recordPersonalStrategyMatrixEvidence(null, {
  ...scope, handClass: 'K9s', actionType: ACTION_TYPES.RAISE,
});
const recomputeStartedAt = performance.now();
const recomputed = await application.getRangeTeacherView(scope);
const evidenceChangeRecomputeMs = performance.now() - recomputeStartedAt;

await application.recordPersonalStrategyMatrixEvidence(null, {
  ...scope, handClass: 'K7s', actionType: ACTION_TYPES.FOLD,
});

const clusterIterations = 1_000;
const clusterStartedAt = performance.now();
let clustered = null;
for (let index = 0; index < clusterIterations; index += 1) {
  clustered = await application.getRangeTeacherView(scope);
}
const boundaryClusterMeanMs = (performance.now() - clusterStartedAt) / clusterIterations;

const report = {
  schemaVersion: 'range-teacher001-benchmark/v1',
  coldViewMs: Number(coldViewMs.toFixed(3)),
  cachedViewMs: Number(cachedViewMs.toFixed(3)),
  evidenceChangeRecomputeMs: Number(evidenceChangeRecomputeMs.toFixed(3)),
  boundaryClusterMeanMs: Number(boundaryClusterMeanMs.toFixed(6)),
  coldUnknownCount: cold.summary.unknownCount,
  stableCachedView: JSON.stringify(cold) === JSON.stringify(cached),
  recomputedDirectCount: recomputed.summary.directCount,
  boundaryClusterCount: clustered.importantBoundaries.length,
  cacheMetrics: application.getProjectionCacheMetrics(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.coldUnknownCount !== 169
  || !report.stableCachedView
  || report.recomputedDirectCount !== 1
  || report.boundaryClusterCount < 1) process.exitCode = 2;
