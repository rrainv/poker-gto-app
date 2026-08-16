import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  applyPrivateReveal,
  createAction,
  initializeHand,
  isHiddenHoleCards,
  resolveShowdown,
} from '../shared/poker-domain/index.js';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';
import {
  reconstructCanonicalHandReplaySource,
} from '../app/src/application/canonical-hand-replay-source.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import {
  createMemorySavedStudyDatabase,
  createSavedStudyOwnerRef,
  parseSavedStudyLibraryExport,
  serializeSavedStudyLibraryExport,
  validateSavedHandSnapshot,
} from '../app/src/saved-study-objects/index.mjs';

const T0 = '2026-08-16T12:00:00.000Z';
const T1 = '2026-08-16T12:01:00.000Z';
const HERO_CARDS = Object.freeze(['As', 'Kh']);
const VILLAIN_CARDS = Object.freeze(['Qd', 'Qc']);
const BOARD = Object.freeze(['2s', '3h', '4d', '5c', '9s']);
const OWNER = createSavedStudyOwnerRef('saved-objects-001r-owner');

function configuration(handId) {
  return {
    handId,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [
      { playerId: 'Hero', seat: 0, startingStackMilliBb: 100_000 },
      { playerId: 'Villain', seat: 1, startingStackMilliBb: 100_000 },
    ],
  };
}

function checkedThroughHand({ observed }) {
  let state = initializeHand(configuration('saved-objects-001r-complete-hand'));
  const originalFrames = [];
  const replay = createReplayProjectionController({
    getLiveState: () => state,
    getHeroPlayerId: () => 'Hero',
  });
  const replace = () => {
    replay.replaceHand({
      state,
      heroPlayerId: 'Hero',
      operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND,
    });
    originalFrames.push({ operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND, state });
  };
  const transition = (nextState, operation) => {
    state = nextState;
    replay.recordTransition({ state, heroPlayerId: 'Hero', operation });
    originalFrames.push({ operation, state });
  };
  const act = (type) => transition(
    applyAction(state, createAction(state.actingPlayerId, type)),
    REPLAY_FRAME_OPERATIONS.ACTION,
  );
  const dealBoard = (type, cards) => transition(
    applyChance(state, { type, cards }),
    REPLAY_FRAME_OPERATIONS.DEAL_BOARD,
  );

  replace();
  transition(applyChance(state, observed ? {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: HERO_CARDS },
    hiddenPlayerIds: ['Villain'],
  } : {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: { Hero: HERO_CARDS, Villain: VILLAIN_CARDS },
  }), observed
    ? REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED
    : REPLAY_FRAME_OPERATIONS.DEAL_HOLE);

  act(ACTION_TYPES.CALL);
  act(ACTION_TYPES.CHECK);
  for (const [type, cards] of [
    [CHANCE_TYPES.DEAL_FLOP, BOARD.slice(0, 3)],
    [CHANCE_TYPES.DEAL_TURN, [BOARD[3]]],
    [CHANCE_TYPES.DEAL_RIVER, [BOARD[4]]],
  ]) {
    dealBoard(type, cards);
    act(ACTION_TYPES.CHECK);
    act(ACTION_TYPES.CHECK);
  }
  if (observed) {
    transition(
      applyPrivateReveal(state, { playerId: 'Villain', cards: VILLAIN_CARDS }),
      REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
    );
  }
  transition(resolveShowdown(state), REPLAY_FRAME_OPERATIONS.SHOWDOWN);

  return {
    finalState: state,
    originalFrames,
    replaySource: replay.createCanonicalHandReplaySource(),
  };
}

test('terminal PokerState alone is ambiguous about private deal and reveal history', () => {
  const knownFromDeal = checkedThroughHand({ observed: false });
  const observedThenRevealed = checkedThroughHand({ observed: true });

  assert.deepEqual(observedThenRevealed.finalState, knownFromDeal.finalState);
  assert.deepEqual(
    observedThenRevealed.finalState.actionHistory,
    knownFromDeal.finalState.actionHistory,
  );
  assert.notDeepEqual(
    observedThenRevealed.replaySource.events.map((event) => event.operation),
    knownFromDeal.replaySource.events.map((event) => event.operation),
  );
  assert.equal(
    observedThenRevealed.replaySource.events.some(
      (event) => event.operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
    ),
    true,
  );
  assert.equal(
    knownFromDeal.replaySource.events.some(
      (event) => event.operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
    ),
    false,
  );
});

test('saved Hand persists, cold-restores, and reconstructs the complete canonical Replay source', async () => {
  const original = checkedThroughHand({ observed: true });
  const database = createMemorySavedStudyDatabase();
  const liveApplication = createSavedStudyObjectApplication({
    database,
    ownerRef: OWNER,
    clock: () => T0,
  });
  const saved = await liveApplication.saveHand({
    pokerState: original.finalState,
    heroPlayerId: 'Hero',
    replaySource: original.replaySource,
    operation: { id: 'saved-hand-001r-cold-roundtrip', createdAt: T0 },
  });
  const portable = await liveApplication.exportLibrary({ exportedAt: T1 });
  const serialized = serializeSavedStudyLibraryExport(portable);
  assert.deepEqual(parseSavedStudyLibraryExport(serialized), portable);

  await liveApplication.close();
  database.reopen();
  const coldApplication = createSavedStudyObjectApplication({
    database,
    ownerRef: OWNER,
    clock: () => T1,
  });
  const restored = await coldApplication.getById(saved.object.id);
  validateSavedHandSnapshot(restored.payload);
  assert.deepEqual(
    restored.payload.replaySource.events,
    original.replaySource.events,
  );
  const incomplete = JSON.parse(JSON.stringify(restored.payload));
  incomplete.replaySource.events.pop();
  assert.throws(
    () => validateSavedHandSnapshot(incomplete),
    /must reconstruct its canonical PokerState exactly/,
  );

  const reconstruction = reconstructCanonicalHandReplaySource(restored.payload.replaySource);
  assert.deepEqual(reconstruction.finalState, original.finalState);
  assert.deepEqual(
    reconstruction.frames.map(({ operation, state }) => ({ operation, state })),
    original.originalFrames,
  );

  const privateDeal = restored.payload.replaySource.events.find(
    (event) => event.operation === REPLAY_FRAME_OPERATIONS.DEAL_HOLE_OBSERVED,
  );
  assert.deepEqual(privateDeal.payload.chanceEvent.cardsByPlayer, { Hero: HERO_CARDS });
  assert.deepEqual(privateDeal.payload.chanceEvent.hiddenPlayerIds, ['Villain']);
  const revealIndex = reconstruction.frames.findIndex(
    (frame) => frame.operation === REPLAY_FRAME_OPERATIONS.REVEAL_HOLE,
  );
  assert.ok(revealIndex > 0);
  for (const frame of reconstruction.frames.slice(1, revealIndex)) {
    const villain = frame.state.players.find((player) => player.playerId === 'Villain');
    assert.equal(isHiddenHoleCards(villain.holeCards), true);
  }
  assert.deepEqual(
    reconstruction.frames[revealIndex].state.players
      .find((player) => player.playerId === 'Villain').holeCards,
    VILLAIN_CARDS,
  );

  const coldReplay = createReplayProjectionController();
  let projection = coldReplay.replaceFromCanonicalHandReplaySource(
    restored.payload.replaySource,
  );
  assert.equal(projection.totalFrameCount, original.originalFrames.length);
  projection = coldReplay.beginPlayback();
  const playbackMeaning = [];
  while (true) {
    playbackMeaning.push({
      operation: projection.selectedFrame.operation,
      kind: projection.selectedFrame.kind,
      street: projection.selectedFrame.street,
      phase: projection.selectedFrame.phase,
    });
    if (!projection.canPlaybackAdvance) break;
    projection = coldReplay.advancePlayback();
  }
  assert.deepEqual(
    playbackMeaning.map((frame) => frame.operation),
    restored.payload.replaySource.events.map((event) => event.operation),
  );
  assert.deepEqual(
    playbackMeaning.filter((frame) => frame.kind.endsWith('_deal')).map((frame) => frame.kind),
    ['private_deal', 'flop_deal', 'turn_deal', 'river_deal'],
  );
  assert.equal(playbackMeaning.at(-2).kind, 'private_reveal');
  assert.equal(playbackMeaning.at(-1).kind, 'showdown_resolution');
  assert.doesNotMatch(
    serialized,
    /className|cssClass|animation|playbackTimer|replayCursor|selectedFrameIndex/u,
  );

  await coldApplication.close();

  const importedApplication = createSavedStudyObjectApplication({
    database: createMemorySavedStudyDatabase(),
    ownerRef: OWNER,
    clock: () => T1,
  });
  assert.deepEqual(
    await importedApplication.importLibrary(serialized, { ownerPolicy: 'require_match' }),
    { importedCount: 1, skippedCount: 0, repositoryRevision: 1 },
  );
  const imported = await importedApplication.getById(saved.object.id);
  assert.deepEqual(
    reconstructCanonicalHandReplaySource(imported.payload.replaySource).finalState,
    original.finalState,
  );
  await importedApplication.close();
});
