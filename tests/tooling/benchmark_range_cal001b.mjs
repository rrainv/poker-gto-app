import { performance } from 'node:perf_hooks';

import { ACTION_TYPES, PREFLOP_HAND_CLASSES } from '../../shared/poker-domain/index.js';
import {
  CALIBRATION_ENVIRONMENTS,
  RANGE_CALIBRATION_OWNER_KEY,
  createRangeCalibrationApplication,
} from '../../app/src/application/range-calibration-service.mjs';
import {
  PERSONAL_STRATEGY_STORAGE_KEY,
  createLocalOwnerRef,
  createMemoryPersonalStrategyDatabase,
  createPersonalStrategyRepository,
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  validatePersonalStrategyStore,
} from '../../app/src/personal-strategy/index.mjs';

const OWNER_ID = 'range-cal001c-benchmark-owner';
const OWNER = createLocalOwnerRef(OWNER_ID);
const T0 = '2026-08-14T12:00:00.000Z';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function percentile(sorted, fraction) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    medianMs: Number(percentile(sorted, 0.5).toFixed(3)),
    p95Ms: Number(percentile(sorted, 0.95).toFixed(3)),
    worstMs: Number((sorted.at(-1) ?? 0).toFixed(3)),
  };
}

function timed(operation) {
  const startedAt = performance.now();
  return Promise.resolve(operation()).then((value) => ({ value, durationMs: performance.now() - startedAt }));
}

function fixture({ currentKeys, revisionsPerKey = 1 }) {
  const profiles = [];
  const modes = [];
  const rangeObservations = [];
  let remainingKeys = currentKeys;
  let profileIndex = 0;
  let observationNumber = 0;
  let sampleQuery = null;

  while (remainingKeys > 0) {
    const profileId = `fixture-profile-${profileIndex}`;
    const modeIds = [0, 1, 2].map((modeIndex) => `fixture-mode-${profileIndex}-${modeIndex}`);
    const profileBundle = createStrategyProfileBundle({
      profileId,
      ownerRef: OWNER,
      displayName: `Fixture profile ${profileIndex}`,
      modes: ['Normal', 'Cautious', 'Pressure'],
      modeIds,
      createdAt: T0,
    });
    profiles.push(profileBundle.profile);
    modes.push(...profileBundle.modes);
    for (const mode of profileBundle.modes) {
      for (let contextIndex = 0; contextIndex < 20 && remainingKeys > 0; contextIndex += 1) {
        const context = createRfiCalibrationContext({
          gameRulesId: 'riverline-home-v1',
          tableSize: 6,
          heroPosition: 'BTN',
          effectiveStackBb: 20 + contextIndex,
        });
        for (const [handIndex, handClass] of PREFLOP_HAND_CLASSES.entries()) {
          if (remainingKeys <= 0) break;
          let supersedesObservationId = null;
          for (let revisionIndex = 0; revisionIndex < revisionsPerKey; revisionIndex += 1) {
            observationNumber += 1;
            const id = `fixture-observation-${observationNumber}`;
            rangeObservations.push(createRangeObservation({
              id,
              profileId,
              modeId: mode.id,
              context,
              handClass,
              dominantAction: {
                type: (handIndex + revisionIndex) % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE,
              },
              supersedesObservationId,
              createdAt: T0,
            }));
            supersedesObservationId = id;
          }
          sampleQuery ??= { profileId, modeId: mode.id, context, handClass };
          remainingKeys -= 1;
        }
      }
    }
    profileIndex += 1;
  }

  const benchmarkBundle = createStrategyProfileBundle({
    profileId: 'benchmark-profile',
    ownerRef: OWNER,
    displayName: 'Benchmark profile',
    modes: ['Normal', 'Cautious', 'Pressure'],
    modeIds: ['benchmark-mode-0', 'benchmark-mode-1', 'benchmark-mode-2'],
    createdAt: T0,
  });
  profiles.push(benchmarkBundle.profile);
  modes.push(...benchmarkBundle.modes);
  const store = {
    schemaVersion: 'personal-strategy-store/v1',
    revision: 1,
    ownerRef: OWNER,
    updatedAt: T0,
    profiles,
    modes,
    rangeObservations,
    trainingObservations: [],
    calibrationSessions: [],
  };
  validatePersonalStrategyStore(store);
  return {
    store,
    sampleQuery,
    exportProfileId: profiles[0]?.id ?? benchmarkBundle.profile.id,
    benchmarkProfileId: benchmarkBundle.profile.id,
    benchmarkModeId: benchmarkBundle.modes[0].id,
  };
}

async function runScenario(name, dimensions, trials = 30) {
  const built = fixture(dimensions);
  const serialized = JSON.stringify(built.store);
  const storage = new MemoryStorage({
    [RANGE_CALIBRATION_OWNER_KEY]: OWNER_ID,
    [PERSONAL_STRATEGY_STORAGE_KEY]: serialized,
  });
  const database = createMemoryPersonalStrategyDatabase({ name: `benchmark-${name}` });
  const migration = await timed(() => createPersonalStrategyRepository({
    database,
    legacyStorage: storage,
    ownerRef: OWNER,
    clock: () => T0,
  }).initialize());

  const openLoadTimes = [];
  for (let index = 0; index < 5; index += 1) {
    const repo = createPersonalStrategyRepository({ database, legacyStorage: storage, ownerRef: OWNER, clock: () => T0 });
    const measured = await timed(() => repo.loadWorkspaceSnapshot());
    openLoadTimes.push(measured.durationMs);
  }

  const queryTimes = [];
  if (built.sampleQuery) {
    const repo = createPersonalStrategyRepository({ database, legacyStorage: storage, ownerRef: OWNER, clock: () => T0 });
    for (let index = 0; index < trials; index += 1) {
      const measured = await timed(() => repo.getCurrentRangeObservation(built.sampleQuery));
      queryTimes.push(measured.durationMs);
    }
  }

  const exportTimes = [];
  let exportBytes = 0;
  for (let index = 0; index < 3; index += 1) {
    const repo = createPersonalStrategyRepository({ database, legacyStorage: storage, ownerRef: OWNER, clock: () => T0 });
    const measured = await timed(() => repo.exportPortable({
      profileIds: [built.exportProfileId],
      exportedAt: T0,
    }));
    exportTimes.push(measured.durationMs);
    exportBytes = new TextEncoder().encode(JSON.stringify(measured.value)).byteLength;
  }

  let id = 0;
  let tick = 0;
  const application = createRangeCalibrationApplication({
    storage,
    database,
    idFactory: (prefix) => `${prefix}-${name}-${++id}`,
    clock: () => new Date(Date.parse(T0) + (++tick * 1000)),
  });
  let state = await application.startOrResumeSession({
    selectedProfileId: built.benchmarkProfileId,
    activeModeId: built.benchmarkModeId,
    context: {
      environment: CALIBRATION_ENVIRONMENTS.HOME,
      tableSize: 6,
      heroPosition: 'BTN',
      effectiveStackBb: 500,
    },
  });
  const repositoryTimes = [];
  const resolutionTimes = [];
  const operationTimes = [];
  for (let trial = 0; trial < trials; trial += 1) {
    state = await application.answerCalibrationQuestion(state, {
      actionType: trial % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE,
    });
    repositoryTimes.push(state.operationMetrics.repositoryTransactionMs);
    resolutionTimes.push(state.operationMetrics.nextQuestionResolutionMs);
    operationTimes.push(state.operationMetrics.totalOperationMs);
  }

  return {
    name,
    currentLeaves: dimensions.currentKeys,
    historyRecords: built.store.rangeObservations.length,
    legacyBytes: new TextEncoder().encode(serialized).byteLength,
    databaseBytesAfterAnswers: database.estimateBytes(),
    migrationMs: Number(migration.durationMs.toFixed(3)),
    openWorkspace: summarize(openLoadTimes),
    answerTransaction: summarize(repositoryTimes),
    nextQuestionResolution: summarize(resolutionTimes),
    acceptedAnswerPath: summarize(operationTimes),
    currentLeafQuery: queryTimes.length ? summarize(queryTimes) : null,
    profileExport: summarize(exportTimes),
    profileExportBytes: exportBytes,
    trials,
  };
}

const report = {
  schemaVersion: 'range-cal001c-persistence-performance/v1',
  generatedAt: new Date().toISOString(),
  adapter: 'asynchronous transactional in-memory adapter; real IndexedDB is measured by browser QA',
  scenarios: [
    await runScenario('empty', { currentKeys: 0 }),
    await runScenario('one-169-hand-mode', { currentKeys: 169 }),
    await runScenario('approximately-1000', { currentKeys: 1014 }),
    await runScenario('approximately-3000', { currentKeys: 3042 }),
    await runScenario('approximately-10000', { currentKeys: 10140 }, 20),
    await runScenario('revision-heavy', { currentKeys: 169, revisionsPerKey: 10 }),
  ],
};

console.log(JSON.stringify(report, null, 2));
