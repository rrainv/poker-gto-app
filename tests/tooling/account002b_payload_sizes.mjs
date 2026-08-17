import {
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyChance,
  initializeHand,
} from '../../shared/poker-domain/index.js';
import { createSavedStudyObjectApplication } from '../../app/src/application/saved-study-object-service.mjs';
import { createPlaybookScenarioInput } from '../../app/src/application/playbook-state-source.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../../app/src/application/replay-projection-controller.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
} from '../../app/src/saved-study-objects/index.mjs';
import { toRemoteSavedStudyObject } from '../../app/src/sync/index.mjs';

const application = createSavedStudyObjectApplication({
  database: createMemorySavedStudyDatabase({ name: 'account002b-payload-sizes' }),
  ownerRef: createSavedStudyOwnerRef('payload-size-owner'),
  clock: () => new Date('2026-08-17T12:00:00.000Z'),
});

function operation(id) {
  return { id, createdAt: '2026-08-17T12:00:00.000Z' };
}

function scenario() {
  const scenarioInput = createPlaybookScenarioInput({
    tableSize: 6,
    heroPosition: 'BTN',
    street: 'turn',
    heroCards: ['As', 'Kh'],
    board: ['Qc', '7d', '2s', 'Jh'],
    deadCards: [],
    stackBb: 94,
    stackMode: 'hero',
    potBb: 18.5,
    lastAction: 'bet',
    lastActionLabel: 'Bet 8 BB',
    facingSizeBb: 8,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    anteBb: 0,
    straddleBb: 0,
  });
  return {
    scenarioInput,
    decisionContext: {
      schemaVersion: 'decision-context/v1', tableSize: 6, opponentCount: null,
      heroPosition: 'BTN', street: 'turn', heroCards: ['As', 'Kh'],
      board: ['Qc', '7d', '2s', 'Jh'], deadCards: [], stackBb: 94,
      stackMode: 'hero', potBb: 18.5, lastAction: 'bet', facingSizeBb: 8,
      callAmountBb: null, heroStreetContributionBb: null, rakeMode: 'off',
      forcedContributionPerPlayerBb: 0, totalForcedContributionBb: 0,
    },
  };
}

function hand() {
  let state = initializeHand({
    handId: 'payload-size-hand',
    game: {
      mode: GAME_MODES.HOME, smallBlindMilliBb: 500, bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100, ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 100_000 },
    ],
  });
  const replay = createReplayProjectionController({
    getLiveState: () => state, getHeroPlayerId: () => 'Hero',
  });
  replay.replaceHand({ state, heroPlayerId: 'Hero', operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND });
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: ['As', 'Kh'] }, hiddenPlayerIds: ['Villain'],
  });
  replay.recordTransition({
    state, heroPlayerId: 'Hero', operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
  });
  return { pokerState: state, heroPlayerId: 'Hero', replaySource: replay.createCanonicalHandReplaySource() };
}

const spot = await application.saveScenarioDerivedSpot({
  ...scenario(), title: 'Turn review', note: 'Compare the pressure line after a checked flop.',
  tags: ['Turn', 'BTN vs BB'], operation: operation('payload-spot'),
});
const typicalHand = await application.saveHand({
  ...hand(), title: 'Heads-up study hand', note: 'Reopen the canonical observer replay.',
  tags: ['Replay'], operation: operation('payload-hand'),
});
const largeHand = await application.saveHand({
  ...hand(), title: 'Long-form hand review', note: 'Detailed street analysis. '.repeat(800),
  tags: Array.from({ length: 24 }, (_, index) => `Study tag ${index + 1}`),
  operation: operation('payload-large-hand'),
});

function bytes(result) {
  return new TextEncoder().encode(JSON.stringify(toRemoteSavedStudyObject(result.object))).byteLength;
}

console.log(JSON.stringify({
  measurement: 'UTF-8 bytes of remote-saved-study-object/v1 JSON before transport compression',
  typicalSavedSpotBytes: bytes(spot),
  typicalSavedHandBytes: bytes(typicalHand),
  largestRepresentativeSavedHandBytes: bytes(largeHand),
}, null, 2));
