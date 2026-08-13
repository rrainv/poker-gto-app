import { createStrategyProvider } from '../../app/src/application/strategy-provider.mjs';
import { generateTrainingExercise } from '../../app/src/application/training-generator.mjs';
import {
  normalizeHeuristicOptions,
  resolveHeuristicStrategy,
} from '../../app/src/strategy/heuristic-strategy.mjs';

export const TRAINING_REPRODUCIBILITY_PACKET_SCHEMA_VERSION =
  'training-reproducibility-packet/v1';
export const TRAINING_REPLAY_STYLE_CAVEAT =
  'Seed replay is not a complete strategy replay when live heuristic style options have changed.';

function clone(value) {
  return structuredClone(value);
}

export function captureTrainingReproducibilityPacket(exercise, {
  heuristicOptions,
} = {}) {
  if (!exercise || exercise.schemaVersion !== 'training-exercise/v1') {
    throw new TypeError('A generated TrainingExercise v1 is required');
  }
  const resolvedOptions = normalizeHeuristicOptions(heuristicOptions);
  return Object.freeze({
    schemaVersion: TRAINING_REPRODUCIBILITY_PACKET_SCHEMA_VERSION,
    seed: exercise.seed,
    trainingConfig: clone(exercise.generationMetadata?.trainingConfig || null),
    exerciseId: exercise.id,
    pokerState: clone(exercise.pokerState),
    actionHistory: clone(exercise.pokerState?.actionHistory || []),
    decisionContext: clone(exercise.decisionContext),
    strategyResult: clone(exercise.strategyResult),
    strategyDetails: clone(exercise.strategyResult?.details || null),
    heuristicOptions: clone(resolvedOptions),
  });
}

export function generateTrainingReproducibilityPacket(config, {
  heuristicOptions = {},
} = {}) {
  let activeOptions = null;
  const strategyProvider = createStrategyProvider({
    fallbackResolver(decisionContext) {
      activeOptions = normalizeHeuristicOptions(heuristicOptions);
      return resolveHeuristicStrategy(decisionContext, activeOptions);
    },
  });
  const result = generateTrainingExercise(config, { strategyProvider });
  if (!result.ok) return result;
  return Object.freeze({
    ok: true,
    packet: captureTrainingReproducibilityPacket(result.exercise, {
      heuristicOptions: activeOptions,
    }),
  });
}
