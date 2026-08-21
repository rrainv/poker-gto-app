import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import {
  NO_RAKE_CASH_GAME_RULES_PRESET,
  createGameRulesSnapshot,
} from '../../shared/poker-domain/game-rules.js';
import { resolveTrainingRulesCapability } from '../../app/src/application/training-generator.mjs';
import {
  TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  TRAINING_SESSION_INTENT_SCHEMA_VERSION,
  createTrainingPracticePlannerState,
  createTrainingSessionIntent,
  planTrainingScenario,
  recordServedTrainingScenario,
  trainingScenarioExactFingerprint,
  trainingScenarioStructuralFingerprint,
} from '../../app/src/application/training-practice-planner.mjs';

const BENCHMARK_SCHEMA_VERSION = 'training-sampler-benchmark/v1';
const SUPPORTED_COUNTS = new Set([1000, 10000, 100000]);

function parseArguments(argv) {
  let count = 1000;
  let verifyDeterminism = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--verify-determinism') {
      verifyDeterminism = true;
      continue;
    }
    if (argument === '--count') {
      count = Number(argv[index + 1]);
      index += 1;
      continue;
    }
    if (argument.startsWith('--count=')) {
      count = Number(argument.slice('--count='.length));
      continue;
    }
    throw new RangeError(`Unknown argument: ${argument}`);
  }
  if (!SUPPORTED_COUNTS.has(count)) {
    throw new RangeError('--count must be exactly 1000, 10000, or 100000');
  }
  return { count, verifyDeterminism };
}

function defaultIntent(count) {
  const preset = NO_RAKE_CASH_GAME_RULES_PRESET;
  const rulesSnapshot = createGameRulesSnapshot({
    source: {
      kind: 'preset',
      presetId: preset.id,
      presetRevision: preset.revision,
    },
    setup: { seatedPlayers: 6 },
    definition: preset.definition,
  });
  return createTrainingSessionIntent({
    schemaVersion: TRAINING_SESSION_INTENT_SCHEMA_VERSION,
    mode: 'varied',
    sessionSeed: 0x5eed002a,
    sessionLength: count,
    difficulty: 'hard',
    focusPreferences: {
      profile: 'balanced',
      streetEmphasis: null,
      stackPreference: 'balanced',
      allowedTableSizeFamilies: ['heads_up', 'short_handed', 'full_ring'],
    },
    rulesSnapshot,
    rulesCapability: resolveTrainingRulesCapability(rulesSnapshot),
    plannerPolicyVersion: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
  });
}

function increment(distribution, key) {
  distribution.set(String(key), (distribution.get(String(key)) ?? 0) + 1);
}

function sortedObject(distribution) {
  return Object.fromEntries([...distribution.entries()].sort(([left], [right]) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
    return left < right ? -1 : left > right ? 1 : 0;
  }));
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
}

function digestRequest(digest, request) {
  digest.update(JSON.stringify([
    request.sessionOrdinal,
    request.exerciseSeed,
    request.tableSize,
    request.heroPosition,
    request.startingStackBb,
    request.street,
    request.targetDecisionType,
    request.rulesSemanticFingerprint,
    request.plannerPolicyVersion,
  ]));
  digest.update('\n');
}

function executeSampler(count) {
  const intent = defaultIntent(count);
  let state = createTrainingPracticePlannerState(intent);
  const distributions = {
    street: new Map(),
    target: new Map(),
    tableSize: new Map(),
    heroPosition: new Map(),
    stackBucket: new Map(),
  };
  const digest = createHash('sha256');
  const selectionDurationsMs = [];
  let recentExactRepeats = 0;
  let recentStructuralRepeats = 0;
  let relaxationCount = 0;
  let unsupportedOrImpossibleCandidateCount = null;
  const memoryBefore = process.memoryUsage().heapUsed;
  const startedAt = performance.now();

  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    const selectionStartedAt = performance.now();
    const result = planTrainingScenario(intent, state, ordinal);
    selectionDurationsMs.push(performance.now() - selectionStartedAt);
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
    const { request } = result;
    const exactFingerprint = trainingScenarioExactFingerprint(request);
    const structuralFingerprint = trainingScenarioStructuralFingerprint(request);
    if (state.recentExactFingerprints.includes(exactFingerprint)) recentExactRepeats += 1;
    if (state.recentStructuralRecords.some(
      (record) => record.structuralFingerprint === structuralFingerprint,
    )) recentStructuralRepeats += 1;
    if (request.planning.relaxations.length > 0) relaxationCount += 1;
    if (unsupportedOrImpossibleCandidateCount === null) {
      unsupportedOrImpossibleCandidateCount = request.planning.excludedStructuralPairCount;
    }
    increment(distributions.street, request.street);
    increment(distributions.target, request.targetDecisionType);
    increment(distributions.tableSize, request.tableSize);
    increment(distributions.heroPosition, request.heroPosition);
    increment(distributions.stackBucket, request.stackBucket);
    digestRequest(digest, request);
    state = recordServedTrainingScenario(state, request);
  }

  const runtimeMs = performance.now() - startedAt;
  const memoryAfter = process.memoryUsage().heapUsed;
  return {
    intent,
    state,
    report: {
      schemaVersion: BENCHMARK_SCHEMA_VERSION,
      plannerPolicyVersion: TRAINING_PRACTICE_PLANNER_POLICY_VERSION,
      count,
      runtimeMs: Number(runtimeMs.toFixed(3)),
      selectionsPerSecond: Number(((count / runtimeMs) * 1000).toFixed(2)),
      selectionLatencyMs: {
        p50: Number(percentile(selectionDurationsMs, 0.50).toFixed(4)),
        p95: Number(percentile(selectionDurationsMs, 0.95).toFixed(4)),
        p99: Number(percentile(selectionDurationsMs, 0.99).toFixed(4)),
        maximum: Number(Math.max(...selectionDurationsMs).toFixed(4)),
      },
      state: {
        serializedBytes: Buffer.byteLength(JSON.stringify(state)),
        recentStructuralRecordCount: state.recentStructuralRecords.length,
        recentExactFingerprintCount: state.recentExactFingerprints.length,
        heapDeltaBytes: memoryAfter - memoryBefore,
      },
      distributions: Object.fromEntries(Object.entries(distributions).map(([key, value]) => [
        key,
        sortedObject(value),
      ])),
      repeatMetrics: {
        recentExactRepeatCount: recentExactRepeats,
        recentExactRepeatRate: Number((recentExactRepeats / count).toFixed(8)),
        recentStructuralRepeatCount: recentStructuralRepeats,
        recentStructuralRepeatRate: Number((recentStructuralRepeats / count).toFixed(8)),
      },
      unsupportedOrImpossibleCandidateCount: unsupportedOrImpossibleCandidateCount ?? 0,
      relaxationCount,
      deterministicSequenceDigest: digest.digest('hex'),
    },
  };
}

export function runTrainingSamplerBenchmark(count, { verifyDeterminism = false } = {}) {
  if (!SUPPORTED_COUNTS.has(count)) {
    throw new RangeError('count must be exactly 1000, 10000, or 100000');
  }
  const first = executeSampler(count).report;
  if (!verifyDeterminism) return first;
  const verification = executeSampler(count).report;
  return {
    ...first,
    deterministicVerification: {
      repeatedDigest: verification.deterministicSequenceDigest,
      matches: verification.deterministicSequenceDigest === first.deterministicSequenceDigest,
    },
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const { count, verifyDeterminism } = parseArguments(process.argv.slice(2));
  const report = runTrainingSamplerBenchmark(count, { verifyDeterminism });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
