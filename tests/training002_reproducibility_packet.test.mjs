import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TRAINING_REPLAY_STYLE_CAVEAT,
  TRAINING_REPRODUCIBILITY_PACKET_SCHEMA_VERSION,
  generateTrainingReproducibilityPacket,
} from './tooling/training-reproducibility-packet.mjs';

const config = Object.freeze({
  schemaVersion: 'training-config/v1',
  tableSize: 8,
  stackBb: 30,
  streets: ['turn'],
  gameMode: 'home',
  heroPositions: ['UTG'],
  allowedDecisionTypes: ['postflop_facing_bet'],
  difficulty: 'hard',
  seed: 60,
});

test('Training anomaly inspection captures one full resolution-time reproducibility packet', () => {
  const result = generateTrainingReproducibilityPacket(config, {
    heuristicOptions: { playStyle: 0.25, opponentStyle: 0.75 },
  });
  assert.equal(result.ok, true, result.error?.message);
  const { packet } = result;
  assert.equal(packet.schemaVersion, TRAINING_REPRODUCIBILITY_PACKET_SCHEMA_VERSION);
  assert.equal(packet.seed, 60);
  assert.equal(packet.trainingConfig.seed, 60);
  assert.match(packet.exerciseId, /^training-/);
  assert.equal(packet.pokerState.schemaVersion, 'poker-state/v1');
  assert.deepEqual(packet.actionHistory, packet.pokerState.actionHistory);
  assert.equal(packet.decisionContext.schemaVersion, 'decision-context/v1');
  assert.equal(packet.strategyResult.schemaVersion, 'strategy-result/v1');
  assert.deepEqual(packet.strategyDetails, packet.strategyResult.details);
  assert.deepEqual(packet.heuristicOptions, {
    playStyle: 0.25,
    opponentStyle: 0.75,
    flatDropBb: 0,
  });
});

test('inspection tooling records the seed-only replay caveat without changing replay behavior', () => {
  assert.match(TRAINING_REPLAY_STYLE_CAVEAT, /Seed replay/);
  assert.match(TRAINING_REPLAY_STYLE_CAVEAT, /style options/);
});
