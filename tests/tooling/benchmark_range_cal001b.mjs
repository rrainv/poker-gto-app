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
  createRangeObservation,
  createRfiCalibrationContext,
  createStrategyProfileBundle,
  validatePersonalStrategyStore,
} from '../../app/src/personal-strategy/index.mjs';

const OWNER_ID = 'range-cal001b-benchmark-owner';
const OWNER = createLocalOwnerRef(OWNER_ID);
const T0 = '2026-08-14T12:00:00.000Z';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
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

function fixture({ profileCount, contextsPerMode, modesFilled = 3 }) {
  const profiles = [];
  const modes = [];
  const rangeObservations = [];
  let observationNumber = 0;
  for (let profileIndex = 0; profileIndex < profileCount; profileIndex += 1) {
    const profileId = `fixture-profile-${profileIndex}`;
    const modeIds = [0, 1, 2].map((modeIndex) => `fixture-mode-${profileIndex}-${modeIndex}`);
    const bundle = createStrategyProfileBundle({
      profileId,
      ownerRef: OWNER,
      displayName: `Fixture profile ${profileIndex}`,
      modes: ['Normal', 'Cautious', 'Pressure'],
      modeIds,
      createdAt: T0,
    });
    profiles.push(bundle.profile);
    modes.push(...bundle.modes);
    for (const mode of bundle.modes.slice(0, modesFilled)) {
      for (let contextIndex = 0; contextIndex < contextsPerMode; contextIndex += 1) {
        const context = createRfiCalibrationContext({
          gameRulesId: 'riverline-home-v1',
          tableSize: 6,
          heroPosition: 'BTN',
          effectiveStackBb: 20 + contextIndex,
        });
        for (const [handIndex, handClass] of PREFLOP_HAND_CLASSES.entries()) {
          observationNumber += 1;
          rangeObservations.push(createRangeObservation({
            id: `fixture-observation-${observationNumber}`,
            profileId,
            modeId: mode.id,
            context,
            handClass,
            dominantAction: { type: handIndex % 2 ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE },
            createdAt: T0,
          }));
        }
      }
    }
  }

  const benchmarkProfileId = 'benchmark-profile';
  const benchmarkModeIds = ['benchmark-mode-0', 'benchmark-mode-1', 'benchmark-mode-2'];
  const benchmarkBundle = createStrategyProfileBundle({
    profileId: benchmarkProfileId,
    ownerRef: OWNER,
    displayName: 'Benchmark profile',
    modes: ['Normal', 'Cautious', 'Pressure'],
    modeIds: benchmarkModeIds,
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
  return { store, benchmarkProfileId, benchmarkModeId: benchmarkModeIds[0] };
}

function runScenario(name, dimensions, trials = 30) {
  const built = fixture(dimensions);
  const initialSerialized = JSON.stringify(built.store);
  const seedStorage = new MemoryStorage({
    [RANGE_CALIBRATION_OWNER_KEY]: OWNER_ID,
    [PERSONAL_STRATEGY_STORAGE_KEY]: initialSerialized,
  });
  let id = 0;
  let clockTick = 0;
  const application = createRangeCalibrationApplication({
    storage: seedStorage,
    idFactory: (prefix) => `${prefix}-benchmark-seed-${++id}`,
    clock: () => new Date(Date.parse(T0) + (++clockTick * 1000)),
  });
  const selection = {
    selectedProfileId: built.benchmarkProfileId,
    activeModeId: built.benchmarkModeId,
    context: { environment: CALIBRATION_ENVIRONMENTS.HOME, tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 500 },
  };
  application.startOrResumeSession(selection);
  const trialBase = seedStorage.getItem(PERSONAL_STRATEGY_STORAGE_KEY);
  const repositoryTimes = [];
  const resolutionTimes = [];
  const operationTimes = [];
  const measuredTotals = [];

  for (let trial = 0; trial < trials; trial += 1) {
    const storage = new MemoryStorage({
      [RANGE_CALIBRATION_OWNER_KEY]: OWNER_ID,
      [PERSONAL_STRATEGY_STORAGE_KEY]: trialBase,
    });
    let trialId = 0;
    const trialApplication = createRangeCalibrationApplication({
      storage,
      idFactory: (prefix) => `${prefix}-${name}-${trial}-${++trialId}`,
      clock: () => new Date(Date.parse(T0) + (trial + 100) * 1000),
    });
    const state = trialApplication.startOrResumeSession(selection);
    const startedAt = performance.now();
    const answered = trialApplication.answerCalibrationQuestion(state, { actionType: ACTION_TYPES.RAISE });
    measuredTotals.push(performance.now() - startedAt);
    repositoryTimes.push(answered.operationMetrics.repositoryTransactionMs);
    resolutionTimes.push(answered.operationMetrics.nextQuestionResolutionMs);
    operationTimes.push(answered.operationMetrics.totalOperationMs);
  }

  return {
    name,
    observations: built.store.rangeObservations.length,
    storeBytesBeforeSession: Buffer.byteLength(initialSerialized),
    storeBytesWithSession: Buffer.byteLength(trialBase),
    trials,
    repositoryTransaction: summarize(repositoryTimes),
    nextQuestionResolution: summarize(resolutionTimes),
    applicationOperation: summarize(operationTimes),
    measuredAnswerCall: summarize(measuredTotals),
  };
}

const report = {
  schemaVersion: 'range-cal001b-performance-audit/v1',
  generatedAt: new Date().toISOString(),
  scenarios: [
    runScenario('minimal', { profileCount: 0, contextsPerMode: 0 }),
    runScenario('one-complete-mode', { profileCount: 1, contextsPerMode: 1, modesFilled: 1 }),
    runScenario('several-thousand', { profileCount: 2, contextsPerMode: 3 }),
    runScenario('upper-stress', { profileCount: 3, contextsPerMode: 5 }, 20),
  ],
};

console.log(JSON.stringify(report, null, 2));
