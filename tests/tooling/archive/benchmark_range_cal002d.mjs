#!/usr/bin/env node

import { performance } from 'node:perf_hooks';

import { ACTION_TYPES } from '../../shared/poker-domain/index.js';
import { createRangeCalibrationApplication } from '../../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../../app/src/personal-strategy/indexeddb-storage.mjs';
import { createRfiCalibrationContext } from '../../app/src/personal-strategy/domain.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

let nextId = 0;
let tick = 0;
const application = createRangeCalibrationApplication({
  storage: memoryStorage(),
  database: createMemoryPersonalStrategyDatabase({ name: 'range-cal002d-benchmark' }),
  idFactory: (prefix) => `${prefix}-${++nextId}`,
  clock: () => new Date(Date.parse('2026-08-18T22:00:00.000Z') + tick++ * 1000),
});
const bundle = await application.createProfile({
  displayName: '002D benchmark',
  description: '',
  environment: 'home',
  modeNames: ['Standard', 'Cautious', 'Pressure'],
});
const scope = {
  profileId: bundle.profile.id,
  modeId: bundle.modes[0].id,
  context: createRfiCalibrationContext({
    gameRulesId: 'riverline-home-v1', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  }),
};

const beforeProjection = application.getProjectionCacheMetrics();
const projectionStartedAt = performance.now();
const projection = await application.getPersonalStrategyMatrixProjection(scope);
const projectionPreparationMs = performance.now() - projectionStartedAt;
const afterProjection = application.getProjectionCacheMetrics();

const selectionIterations = 20_000;
const selectionStartedAt = performance.now();
let selected = null;
for (let index = 0; index < selectionIterations; index += 1) {
  selected = projection.cells[(index * 37) % projection.cells.length];
}
const selectionMeanMs = (performance.now() - selectionStartedAt) / selectionIterations;

const correctionStartedAt = performance.now();
const corrected = await application.recordPersonalStrategyMatrixEvidence(null, {
  ...scope,
  handClass: selected.handClass,
  actionType: ACTION_TYPES.RAISE,
});
const correctionToRecomputeMs = performance.now() - correctionStartedAt;

const scopeSwitchStartedAt = performance.now();
const otherMode = await application.getPersonalStrategyMatrixProjection({
  ...scope,
  modeId: bundle.modes[1].id,
});
const scopeSwitchMs = performance.now() - scopeSwitchStartedAt;

const report = {
  schemaVersion: 'range-cal002d-benchmark/v1',
  cellCount: projection.cells.length,
  projectionPreparationMs: Number(projectionPreparationMs.toFixed(3)),
  selectionMeanMs: Number(selectionMeanMs.toFixed(6)),
  correctionToRecomputeMs: Number(correctionToRecomputeMs.toFixed(3)),
  scopeSwitchMs: Number(scopeSwitchMs.toFixed(3)),
  projectionEvidenceLoadDelta: afterProjection.evidenceLoads - beforeProjection.evidenceLoads,
  projectionSnapshotBuildDelta: afterProjection.snapshotBuilds - beforeProjection.snapshotBuilds,
  correctedStatus: corrected.matrixProjection.cells.find((cell) => cell.handClass === selected.handClass).status,
  isolatedOtherModeUnknownCount: otherMode.summary.unknownCount,
  finalCacheMetrics: application.getProjectionCacheMetrics(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (report.cellCount !== 169
  || report.projectionEvidenceLoadDelta !== 1
  || report.projectionSnapshotBuildDelta !== 1
  || report.correctedStatus !== 'directly_known'
  || report.isolatedOtherModeUnknownCount !== 169) process.exitCode = 2;
