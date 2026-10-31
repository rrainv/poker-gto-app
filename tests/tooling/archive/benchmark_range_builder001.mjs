import { performance } from 'node:perf_hooks';

import { PREFLOP_HAND_CLASSES } from '../../shared/poker-domain/index.js';
import { createMemoryPersonalStrategyDatabase } from '../../app/src/personal-strategy/indexeddb-storage.mjs';
import {
  createContextFromSelection,
  createRangeCalibrationApplication,
} from '../../app/src/application/range-calibration-service.mjs';
import { RANGE_BUILDER_OPERATION_KINDS } from '../../app/src/application/range-builder-service.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

async function measure(handCount) {
  let sequence = 0;
  let tick = 0;
  const mutations = [];
  const application = createRangeCalibrationApplication({
    storage: memoryStorage(),
    database: createMemoryPersonalStrategyDatabase({ name: `range-builder-benchmark-${handCount}` }),
    idFactory: (prefix) => `${prefix}-${++sequence}`,
    clock: () => new Date(Date.parse('2026-08-18T22:00:00.000Z') + tick++ * 1000),
    onLocalMutation: (mutation) => mutations.push(mutation),
  });
  const bundle = await application.createProfile({
    displayName: `Benchmark ${handCount}`,
    description: '',
    environment: 'home',
    modeNames: ['Normal', 'Cautious', 'Pressure'],
  });
  mutations.length = 0;
  const scope = {
    profileId: bundle.profile.id,
    modeId: bundle.modes[0].id,
    context: createContextFromSelection({
      environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
    }),
  };
  await application.getStrategySnapshot(scope);
  const before = application.getProjectionCacheMetrics();
  const startedAt = performance.now();
  const result = await application.applyRangeBuilderOperation(null, scope, {
    handClasses: PREFLOP_HAND_CLASSES.slice(0, handCount),
    operationKind: RANGE_BUILDER_OPERATION_KINDS.EXACT_MIX,
    mix: { fold: 30, raise: 70 },
  });
  const elapsedMs = performance.now() - startedAt;
  const after = application.getProjectionCacheMetrics();
  return {
    handCount,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    evidenceRows: result.acceptedObservations.length,
    actionGroups: new Set(result.acceptedObservations.map((entry) => entry.provenance.actionGroupId)).size,
    mutationNotifications: mutations.length,
    invalidations: after.invalidations - before.invalidations,
    snapshotRecomputes: after.snapshotBuilds - before.snapshotBuilds,
  };
}

const results = [];
for (const handCount of [1, 10, 50, 169]) results.push(await measure(handCount));
console.log(JSON.stringify({ schemaVersion: 'range-builder-benchmark/v1', results }, null, 2));
