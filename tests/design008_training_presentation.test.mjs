import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRAINING_PRESENTATION_SCHEMA_VERSION,
  createTrainingPresentationModel,
} from '../app/src/application/training-presentation.mjs';

function fixtureExercise() {
  return {
    schemaVersion: 'training-exercise/v1',
    id: 'training-fixture',
    seed: 424242,
    heroPlayerId: 'hero',
    decisionContext: {
      schemaVersion: 'decision-context/v1',
      tableSize: 3,
      heroPosition: 'BTN',
      street: 'flop',
      heroCards: ['As', 'Kh'],
      board: ['Qs', 'Jh', '2c'],
      stackBb: 96,
      potBb: 8,
      lastAction: 'raise',
      facingSizeBb: 6,
    },
    pokerState: {
      actingPlayerId: 'hero',
      players: [
        { playerId: 'villain', position: 'SB' },
        { playerId: 'hero', position: 'BTN' },
        { playerId: 'third', position: 'BB' },
      ],
      actionHistory: [
        {
          sequence: 0,
          street: 'preflop',
          playerId: 'villain',
          submittedAction: { type: 'raise', amountToMilliBb: 3000 },
          committedMilliBb: 2500,
          currentBetAfterMilliBb: 3000,
        },
        {
          sequence: 1,
          street: 'preflop',
          playerId: 'hero',
          submittedAction: { type: 'call', amountToMilliBb: null },
          committedMilliBb: 3000,
          currentBetAfterMilliBb: 3000,
        },
      ],
    },
    legalActions: {
      fold: { available: true },
      check: { available: false },
      call: { available: true, commitMilliBb: 6000 },
      bet: { available: false },
      raise: { available: true, minToMilliBb: 12000, maxToMilliBb: 96000 },
      allIn: { available: true, amountToMilliBb: 96000 },
    },
    strategyResult: { schemaVersion: 'strategy-result/v1', source: 'heuristic_postflop', actions: [] },
    generationMetadata: {
      attempts: 3,
      trajectoryLength: 2,
      targetReason: 'postflop_facing_raise',
      policy: 'bounded_legal_trajectory_v1',
      curriculum: {
        street: 'flop', heroPosition: 'BTN', tableSize: 3,
        actionCategory: 'postflop_facing_raise', potType: 'reraised', stackBucket: 'standard',
      },
    },
  };
}

test('Training presentation is a read-only projection of canonical exercise facts', () => {
  const exercise = fixtureExercise();
  const model = createTrainingPresentationModel(exercise);

  assert.equal(model.schemaVersion, TRAINING_PRESENTATION_SCHEMA_VERSION);
  assert.equal(model.exerciseId, exercise.id);
  assert.equal(model.seed, 424242);
  assert.deepEqual(model.heroCards, ['As', 'Kh']);
  assert.deepEqual(model.board, ['Qs', 'Jh', '2c']);
  assert.equal(model.currentActor.label, 'Hero');
  assert.deepEqual(model.tags, ['FLOP', 'BTN', '3-MAX', 'FACING RAISE', 'STANDARD STACK']);
  assert.ok(Object.isFrozen(model));
  assert.ok(Object.isFrozen(model.actionHistory));
});

test('Training presentation includes realized sizing-family metadata when a planned exercise has it', () => {
  const exercise = fixtureExercise();
  exercise.generationMetadata.scenarioRequest = {
    request: { requestedSizingFamily: 'large' },
    sizing: { realizedSizingFamily: 'large' },
  };

  assert.ok(createTrainingPresentationModel(exercise).tags.includes('LARGE SIZING'));
});

test('Training presentation uses chronological ActionRecords without inventing history', () => {
  const model = createTrainingPresentationModel(fixtureExercise());

  assert.deepEqual(model.actionHistory.map((entry) => ({
    sequence: entry.sequence,
    street: entry.street,
    actor: entry.actorLabel,
    action: entry.actionLabel,
    amount: entry.amountLabel,
  })), [
    { sequence: 0, street: 'preflop', actor: 'SB', action: 'Raise to', amount: '3bb' },
    { sequence: 1, street: 'preflop', actor: 'Hero', action: 'Call', amount: '3bb' },
  ]);
});

test('Training presentation exposes only available canonical actions and honest bounds', () => {
  const model = createTrainingPresentationModel(fixtureExercise());

  assert.deepEqual(model.legalActions.map((action) => action.type), ['fold', 'call', 'raise', 'all_in']);
  assert.equal(model.legalActions.find((action) => action.type === 'call').amountLabel, '6bb');
  assert.equal(model.legalActions.find((action) => action.type === 'raise').boundsLabel, '12–96bb to');
  assert.equal(model.legalActions.find((action) => action.type === 'all_in').amountLabel, '96bb');
  assert.equal(model.legalActions.some((action) => action.type === 'check'), false);
});

test('Training presentation rejects incompatible exercise shapes', () => {
  assert.throws(() => createTrainingPresentationModel(null), /TrainingExercise v1/);
  assert.throws(
    () => createTrainingPresentationModel({ schemaVersion: 'training-exercise/v0' }),
    /TrainingExercise v1/,
  );
});
