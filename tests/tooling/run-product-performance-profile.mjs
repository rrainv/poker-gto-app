import { performance } from 'node:perf_hooks';

import {
  PLAYBOOK_MODES,
  createPlaybookScenarioInput,
  resolvePlaybookDecisionContext,
} from '../../app/src/application/playbook-state-source.mjs';
import {
  TRAINING_CONFIG_SCHEMA_VERSION,
  generateTrainingExercise,
} from '../../app/src/application/training-generator.mjs';
import {
  PREFLOP_HAND_CLASSES,
  calibrationDecisionContext,
  representativeCardsForClass,
} from './strategy-calibration-corpora.mjs';
import { createCalibrationStrategyProvider } from './strategy-calibration-harness.mjs';

const PROFILE_SCHEMA_VERSION = 'riverline-product-performance-profile/v1';

function numericFlag(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix));
  const numeric = Number(raw?.slice(prefix.length));
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function rounded(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

function measure(name, iterations, operation, warmup = Math.min(10, iterations)) {
  for (let index = 0; index < warmup; index += 1) operation(index);
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    operation(index);
    samples.push(performance.now() - startedAt);
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    name,
    iterations,
    unit: 'milliseconds_per_operation',
    medianMs: rounded(percentile(sorted, 0.5)),
    meanMs: rounded(total / samples.length),
    p95Ms: rounded(percentile(sorted, 0.95)),
    minMs: rounded(sorted[0]),
    maxMs: rounded(sorted.at(-1)),
  });
}

const provider = createCalibrationStrategyProvider();
const preflopContext = calibrationDecisionContext({
  tableSize: 8,
  opponentCount: null,
  heroPosition: 'UTG',
  heroCards: ['As', 'Ks'],
  stackBb: 30,
});
const postflopContext = calibrationDecisionContext({
  tableSize: 6,
  opponentCount: 5,
  heroPosition: 'BTN',
  heroCards: ['As', 'Kd'],
  board: ['2c', '7d', 'Th'],
  street: 'flop',
  potBb: 10,
  lastAction: 'check',
  facingSizeBb: 0,
  callAmountBb: 0,
  heroStreetContributionBb: 0,
});
const scenarioInput = createPlaybookScenarioInput({
  ...preflopContext,
  schemaVersion: 'playbook-scenario/v1',
});

function resolveScenario() {
  const result = resolvePlaybookDecisionContext({
    mode: PLAYBOOK_MODES.SCENARIO,
    scenarioInput,
    deriveScenarioDecisionContext: (input) => calibrationDecisionContext({
      ...input,
      schemaVersion: 'decision-context/v1',
    }),
  });
  if (result.status !== 'available') throw new Error('Scenario profile resolution failed');
}

function preparePreflopMatrix() {
  for (const handClass of PREFLOP_HAND_CLASSES) {
    provider.resolve({
      ...preflopContext,
      heroCards: representativeCardsForClass(handClass),
    });
  }
}

function trainingConfig(seed, { postflop = false } = {}) {
  return {
    schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
    tableSize: 6,
    stackBb: 100,
    streets: [postflop ? 'flop' : 'preflop'],
    gameMode: 'home',
    heroPositions: ['BTN'],
    allowedDecisionTypes: [postflop ? 'postflop_first_action' : 'preflop_unopened'],
    difficulty: 'hard',
    seed: seed >>> 0,
  };
}

function generateTraining(index, options) {
  const result = generateTrainingExercise(trainingConfig(0x12340000 + index, options), {
    strategyProvider: provider,
  });
  if (!result.ok) throw new Error(result.error?.message || 'Training profile generation failed');
}

const quick = process.argv.includes('--quick');
const scale = quick ? 0.2 : 1;
const count = (name, fallback) => numericFlag(name, Math.max(1, Math.round(fallback * scale)));
const operations = [
  measure('scenario_application_resolution', count('context-runs', 2_000), resolveScenario),
  measure('preflop_provider_resolution', count('preflop-runs', 2_000), () => provider.resolve(preflopContext)),
  measure('postflop_250_trial_provider_resolution', count('postflop-runs', 60), () => provider.resolve(postflopContext), 2),
  measure('preflop_matrix_169_resolution_preparation', count('matrix-runs', 30), preparePreflopMatrix, 1),
  measure('training_generation_preflop', count('training-runs', 100), (index) => generateTraining(index, { postflop: false }), 2),
  measure('training_generation_flop', count('training-postflop-runs', 20), (index) => generateTraining(index, { postflop: true }), 1),
];

const report = {
  schemaVersion: PROFILE_SCHEMA_VERSION,
  harness: 'Node performance.now; synchronous production application/strategy/training modules; no DOM or browser timing',
  node: process.version,
  operations,
};

process.stdout.write(`${JSON.stringify(report, null, process.argv.includes('--pretty') ? 2 : 0)}\n`);
