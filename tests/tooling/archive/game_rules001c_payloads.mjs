import { performance } from 'node:perf_hooks';

import {
  applyChance,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  initializeHand,
  initializeHandFromGameRulesSnapshot,
} from '../../shared/poker-domain/index.js';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../../app/src/application/replay-projection-controller.mjs';
import {
  reconstructCanonicalHandReplaySource,
} from '../../app/src/application/canonical-hand-replay-source.mjs';
import { createPlaybookScenarioInput } from '../../app/src/application/playbook-state-source.mjs';
import {
  createSavedHandSnapshot,
  createSavedSpotSnapshot,
  createSavedStudyAnnotations,
  createSavedStudyObject,
  createSavedStudyOwnerRef,
  createSavedStudySource,
} from '../../app/src/saved-study-objects/index.mjs';

const T0 = '2026-08-20T10:00:00.000Z';
const OWNER = createSavedStudyOwnerRef('game-rules-001c-measurement-owner');

function game(mode) {
  return {
    mode,
    smallBlindMilliBb: 500,
    bigBlindMilliBb: 1000,
    chipUnitMilliBb: 100,
    ante: { type: 'none', amountMilliBb: 0 },
  };
}

function players(count) {
  return Array.from({ length: count }, (_, seat) => ({
    playerId: `P${seat}`,
    seat,
    startingStackMilliBb: 100_000,
  }));
}

function replayFixture({ version, count, mode }) {
  const legacyGame = game(mode);
  let state = version === 1
    ? initializeHand({
      handId: `measurement-${mode}-v1`,
      game: legacyGame,
      buttonSeat: 0,
      players: players(count),
    })
    : initializeHandFromGameRulesSnapshot({
      handId: `measurement-${mode}-v2`,
      rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration(legacyGame, count),
      buttonSeat: 0,
      players: players(count),
    });
  const replay = createReplayProjectionController();
  replay.replaceHand({
    state,
    heroPlayerId: 'P0',
    operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
  });
  state = applyChance(state, {
    type: 'deal_hole',
    cardsByPlayer: { P0: ['As', 'Kh'] },
    hiddenPlayerIds: state.players.slice(1).map((player) => player.playerId),
  });
  replay.recordTransition({
    state,
    heroPlayerId: 'P0',
    operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
  });
  return { state, replaySource: replay.createCanonicalHandReplaySource() };
}

function savedHandObject(hand, id) {
  return createSavedStudyObject({
    id,
    ownerRef: OWNER,
    kind: 'hand',
    createdAt: T0,
    annotations: createSavedStudyAnnotations(),
    source: createSavedStudySource({ surface: 'hand', sourceId: hand.state.handId }),
    payload: createSavedHandSnapshot({
      pokerState: hand.state,
      heroPlayerId: 'P0',
      replaySource: hand.replaySource,
    }),
  });
}

function spotFacts() {
  const scenarioInput = createPlaybookScenarioInput({
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['As', 'Kh'],
    board: ['Qc', '7d', '2h'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 6.5,
    lastAction: 'check',
    lastActionLabel: 'Checked to Hero',
    facingSizeBb: 0,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
  return {
    scenarioInput,
    decisionContext: {
      schemaVersion: 'decision-context/v1',
      tableSize: 6,
      opponentCount: null,
      heroPosition: 'BTN',
      street: 'flop',
      heroCards: ['As', 'Kh'],
      board: ['Qc', '7d', '2h'],
      deadCards: [],
      stackBb: 100,
      stackMode: 'hero',
      potBb: 6.5,
      lastAction: 'check',
      facingSizeBb: 0,
      callAmountBb: 0,
      heroStreetContributionBb: null,
      rakeMode: 'off',
      forcedContributionPerPlayerBb: 0,
      totalForcedContributionBb: 0,
    },
  };
}

function savedSpotObject({ version, id }) {
  const facts = spotFacts();
  return createSavedStudyObject({
    id,
    ownerRef: OWNER,
    kind: 'spot',
    createdAt: T0,
    annotations: createSavedStudyAnnotations(),
    source: createSavedStudySource({ surface: 'playbook', sourceId: id }),
    payload: createSavedSpotSnapshot({
      derivation: 'scenario',
      ...facts,
      rulesSnapshot: version === 2
        ? createGameRulesSnapshotFromLegacyGameConfiguration(game('home'), 6)
        : null,
    }),
  });
}

function bytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function comparison(v1, v2) {
  return {
    v1Bytes: v1,
    v2Bytes: v2,
    increaseBytes: v2 - v1,
    increasePercent: Number((((v2 - v1) / v1) * 100).toFixed(2)),
  };
}

function benchmarkColdReplay(source, iterations = 300) {
  const serialized = JSON.stringify(source);
  for (let index = 0; index < 30; index += 1) {
    reconstructCanonicalHandReplaySource(JSON.parse(serialized));
  }
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now();
    reconstructCanonicalHandReplaySource(JSON.parse(serialized));
    samples.push(performance.now() - startedAt);
  }
  samples.sort((left, right) => left - right);
  return {
    iterations,
    averageMs: Number((samples.reduce((sum, value) => sum + value, 0) / iterations).toFixed(4)),
    medianMs: Number(samples[Math.floor(iterations / 2)].toFixed(4)),
    p95Ms: Number(samples[Math.floor(iterations * 0.95)].toFixed(4)),
  };
}

const noRakeV1 = replayFixture({ version: 1, count: 6, mode: 'home' });
const noRakeV2 = replayFixture({ version: 2, count: 6, mode: 'home' });
const fixedV1 = replayFixture({ version: 1, count: 8, mode: 'clubgg' });
const fixedV2 = replayFixture({ version: 2, count: 8, mode: 'clubgg' });
const savedHandV1 = savedHandObject(noRakeV1, 'measurement-saved-hand-v1');
const savedHandV2 = savedHandObject(noRakeV2, 'measurement-saved-hand-v2');
const savedSpotV1 = savedSpotObject({ version: 1, id: 'measurement-saved-spot-v1' });
const savedSpotV2 = savedSpotObject({ version: 2, id: 'measurement-saved-spot-v2' });

const result = {
  payloadSizes: {
    replayInitialization6MaxNoRake: comparison(
      bytes(noRakeV1.replaySource.events[0]),
      bytes(noRakeV2.replaySource.events[0]),
    ),
    replaySource6MaxNoRake: comparison(
      bytes(noRakeV1.replaySource),
      bytes(noRakeV2.replaySource),
    ),
    savedHand6MaxNoRake: comparison(bytes(savedHandV1), bytes(savedHandV2)),
    savedSpot6MaxNoRake: comparison(bytes(savedSpotV1), bytes(savedSpotV2)),
  },
  coldReplay: {
    sixMaxNoRake: {
      v1: benchmarkColdReplay(noRakeV1.replaySource),
      v2: benchmarkColdReplay(noRakeV2.replaySource),
    },
    eightMaxFixedCollection: {
      v1: benchmarkColdReplay(fixedV1.replaySource),
      v2: benchmarkColdReplay(fixedV2.replaySource),
    },
  },
};

console.log(JSON.stringify(result, null, 2));
