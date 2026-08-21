import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  GAME_MODES,
  PHASES,
  applyAction,
  createAction,
  createGameRulesSnapshotFromLegacyGameConfiguration,
  getLegalActionSpec,
} from '../shared/poker-domain/index.js';
import {
  AUTOMATED_COMPLETED_HAND_RESULT_SCHEMA_VERSION,
  AUTOMATED_HAND_PROGRESSION_ERROR_CODES,
  AUTOMATED_HAND_PROGRESSION_STATUSES,
  AUTOMATED_OPPONENT_ASSIGNMENT_SCHEMA_VERSION,
  BOT_DECISION_JOURNAL_SCHEMA_VERSION,
  BOT_DECISION_RECORD_SCHEMA_VERSION,
  advanceAutomatedHandUntilHeroOrTerminal,
  createAutomatedHandProgression,
  createBasicOpponentAssignments,
} from '../app/src/application/automated-hand-progression.mjs';
import { reconstructCanonicalHandReplaySource } from '../app/src/application/canonical-hand-replay-source.mjs';
import {
  OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
  OPPONENT_POLICY_SELECTION_SCHEMA_VERSION,
  createOpponentPolicy,
} from '../app/src/application/opponent-policy.mjs';

function configuration({
  handId = 'bot-opponents-001a',
  playerCount = 2,
  buttonSeat = 0,
  startingStackMilliBb = 100_000,
} = {}) {
  return {
    handId,
    rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    }, playerCount),
    buttonSeat,
    players: Array.from({ length: playerCount }, (_, seat) => ({
      playerId: `P${seat}`,
      seat,
      startingStackMilliBb,
    })),
  };
}

function heuristicPolicy(policyId, selectType) {
  return createOpponentPolicy({
    policyId,
    policyVersion: 'focused-test/v1',
    provenance: {
      schemaVersion: OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
      kind: 'heuristic_archetype',
      description: 'Focused deterministic test policy.',
      solverBacked: false,
      equilibriumClaim: false,
      populationModelClaim: false,
    },
    select({ actor, legalActionSpec }) {
      const type = selectType(legalActionSpec);
      return {
        schemaVersion: OPPONENT_POLICY_SELECTION_SCHEMA_VERSION,
        action: createAction(actor.playerId, type),
        selectionMetadata: { focusedTest: true },
        sizingMetadata: {
          source: 'focused_test',
          mode: 'not_sized',
        },
      };
    },
  });
}

const passivePolicy = heuristicPolicy('focused.passive-opponent', (spec) => (
  spec.check.available ? ACTION_TYPES.CHECK
    : spec.call.available ? ACTION_TYPES.CALL : ACTION_TYPES.FOLD
));

const foldFacingPolicy = heuristicPolicy('focused.fold-facing-opponent', (spec) => (
  spec.fold.available ? ACTION_TYPES.FOLD
    : spec.check.available ? ACTION_TYPES.CHECK : ACTION_TYPES.CALL
));

function assignmentsFor(state, heroPlayerId, policy, handSeed = 1) {
  return state.players
    .filter((player) => player.playerId !== heroPlayerId)
    .map((player) => ({
      schemaVersion: AUTOMATED_OPPONENT_ASSIGNMENT_SCHEMA_VERSION,
      playerId: player.playerId,
      seat: player.seat,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      archetype: 'focused_test',
      config: null,
      baseSeed: (handSeed + player.seat * 997) >>> 0,
    }));
}

function progressionWithPolicy({
  handId,
  playerCount = 2,
  heroPlayerId = 'P0',
  handSeed = 1,
  policy = passivePolicy,
  maxAutomatedTransitions,
  policyResolver = () => policy,
} = {}) {
  const initialConfiguration = configuration({ handId, playerCount });
  const initial = createAutomatedHandProgression({
    initialConfiguration,
    heroPlayerId,
    handSeed,
    opponentAssignments: assignmentsFor(
      // Assignments use the same player IDs/seats that the public start seam
      // will initialize canonically from this configuration.
      { players: initialConfiguration.players },
      heroPlayerId,
      policy,
      handSeed,
    ),
    policyResolver,
    ...(maxAutomatedTransitions === undefined ? {} : { maxAutomatedTransitions }),
  });
  return initial;
}

function applyPassiveHeroAction(progression, state) {
  const spec = getLegalActionSpec(state);
  const type = spec.check.available ? ACTION_TYPES.CHECK
    : spec.call.available ? ACTION_TYPES.CALL : ACTION_TYPES.FOLD;
  return progression.applyHeroAction(createAction(state.actingPlayerId, type));
}

function completePassively(progression) {
  for (let boundary = 0; boundary < 16; boundary += 1) {
    const result = advanceAutomatedHandUntilHeroOrTerminal(progression);
    if (result.status !== AUTOMATED_HAND_PROGRESSION_STATUSES.HERO_DECISION) return result;
    applyPassiveHeroAction(progression, result.state);
  }
  throw new Error('Focused passive Hand did not terminate within 16 Hero boundaries');
}

test('basic hand-level assignments cover every non-Hero seat with stable independent base seeds', () => {
  const progression = createAutomatedHandProgression({
    initialConfiguration: configuration({ handId: 'bot-assignment', playerCount: 6 }),
    heroPlayerId: 'P0',
    handSeed: 0x12345678,
  });
  const state = progression.getSession().getState();
  const first = createBasicOpponentAssignments({
    pokerState: state,
    heroPlayerId: 'P0',
    handSeed: 0x12345678,
  });
  const second = createBasicOpponentAssignments({
    pokerState: state,
    heroPlayerId: 'P0',
    handSeed: 0x12345678,
  });

  assert.deepEqual(second, first);
  assert.equal(first.length, 5);
  assert.equal(first.some((assignment) => assignment.playerId === 'P0'), false);
  assert.equal(new Set(first.map((assignment) => assignment.playerId)).size, 5);
  assert.equal(new Set(first.map((assignment) => assignment.seat)).size, 5);
  assert.equal(new Set(first.map((assignment) => assignment.baseSeed)).size, 5);
  assert.equal(first.every((assignment) => assignment.archetype === 'basic'), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first[0]), true);
});

test('HU stops exactly at Hero and repeated boundary projection applies no duplicate event', () => {
  const progression = createAutomatedHandProgression({
    initialConfiguration: configuration({ handId: 'bot-hu-boundary' }),
    heroPlayerId: 'P0',
    handSeed: 11,
  });
  const first = progression.advanceUntilHeroOrTerminal();
  const eventCount = first.session.createCanonicalHandReplaySource().events.length;
  const repeated = progression.advanceUntilHeroOrTerminal();

  assert.equal(first.status, AUTOMATED_HAND_PROGRESSION_STATUSES.HERO_DECISION);
  assert.equal(first.state.phase, PHASES.BETTING);
  assert.equal(first.state.actingPlayerId, 'P0');
  assert.equal(first.state.players.find((player) => player.playerId === 'P0').holeCards.length, 2);
  assert.equal(first.state.players.find((player) => player.playerId === 'P1').holeCards.status, 'hidden');
  assert.equal(first.botDecisionJournal.decisions.length, 0);
  assert.equal(repeated.session.createCanonicalHandReplaySource().events.length, eventCount);
  assert.equal(repeated.automatedTransitionCount, first.automatedTransitionCount);
});

test('multiway progression crosses multiple assigned bots and records legal replay-linked provenance', () => {
  const progression = progressionWithPolicy({
    handId: 'bot-multiway',
    playerCount: 6,
    heroPlayerId: 'P0',
    handSeed: 22,
  });
  const result = progression.advanceUntilHeroOrTerminal();
  const journal = result.botDecisionJournal;
  const replay = reconstructCanonicalHandReplaySource(
    result.session.createCanonicalHandReplaySource(),
  );

  assert.equal(result.status, AUTOMATED_HAND_PROGRESSION_STATUSES.HERO_DECISION);
  assert.equal(result.state.actingPlayerId, 'P0');
  assert.deepEqual(journal.decisions.map((record) => record.actor.playerId), ['P3', 'P4', 'P5']);
  assert.equal(journal.schemaVersion, BOT_DECISION_JOURNAL_SCHEMA_VERSION);
  assert.equal(journal.decisions.every((record) => (
    record.schemaVersion === BOT_DECISION_RECORD_SCHEMA_VERSION
      && record.policyId === passivePolicy.policyId
      && record.sizingProvenance.source === 'focused_test'
  )), true);
  for (const record of journal.decisions) {
    const before = replay.frames[record.replayReference.replayEventSequence - 1].state;
    const after = replay.frames[record.replayReference.replayEventSequence].state;
    assert.deepEqual(applyAction(before, record.chosenAction), after);
    assert.equal(
      after.actionHistory[record.replayReference.canonicalActionHistoryIndex]
        .submittedAction.playerId,
      record.actor.playerId,
    );
  }
});

test('same Hand seed reproduces the full bot/chance sequence while another seed changes it', () => {
  const run = (handSeed) => completePassively(progressionWithPolicy({
    handId: 'bot-determinism',
    handSeed,
  }));
  const first = run(0xdecafbad);
  const second = run(0xdecafbad);
  const different = run(0xdecafbae);

  assert.equal(first.status, AUTOMATED_HAND_PROGRESSION_STATUSES.TERMINAL);
  assert.deepEqual(second.botDecisionJournal, first.botDecisionJournal);
  assert.deepEqual(
    second.completedHand.canonicalResult.replay.events,
    first.completedHand.canonicalResult.replay.events,
  );
  assert.deepEqual(
    second.completedHand.canonicalResult.finalBoard,
    first.completedHand.canonicalResult.finalBoard,
  );
  assert.notEqual(different.chanceProvenance.chanceSeed, first.chanceProvenance.chanceSeed);
  assert.notDeepEqual(
    different.completedHand.canonicalResult.replay.events,
    first.completedHand.canonicalResult.replay.events,
  );
});

test('policy-local random work cannot consume or shift another seat decision seed', () => {
  const localWorkPolicy = (workCount) => createOpponentPolicy({
    policyId: 'focused.isolated-seed-opponent',
    policyVersion: 'focused-test/v1',
    provenance: {
      schemaVersion: OPPONENT_POLICY_PROVENANCE_SCHEMA_VERSION,
      kind: 'heuristic_archetype',
      description: 'Focused isolated-seed test policy.',
      solverBacked: false,
      equilibriumClaim: false,
      populationModelClaim: false,
    },
    select({ actor, legalActionSpec, mixedSeed }) {
      let local = mixedSeed;
      for (let index = 0; index < workCount; index += 1) {
        local = Math.imul(local ^ index, 0x45d9f3b) >>> 0;
      }
      const type = legalActionSpec.check.available ? ACTION_TYPES.CHECK
        : legalActionSpec.call.available ? ACTION_TYPES.CALL : ACTION_TYPES.FOLD;
      return {
        schemaVersion: OPPONENT_POLICY_SELECTION_SCHEMA_VERSION,
        action: createAction(actor.playerId, type),
        selectionMetadata: {
          focusedTest: true,
          selectedFromMixedSeed: mixedSeed >>> 0,
          localWorkDigest: local,
        },
        sizingMetadata: { source: 'focused_test', mode: 'not_sized' },
      };
    },
  });
  const shortWork = localWorkPolicy(1);
  const longWork = localWorkPolicy(100);
  const first = progressionWithPolicy({
    handId: 'bot-isolated-decision-seeds',
    playerCount: 6,
    handSeed: 77,
    policy: shortWork,
  }).advanceUntilHeroOrTerminal();
  const second = progressionWithPolicy({
    handId: 'bot-isolated-decision-seeds',
    playerCount: 6,
    handSeed: 77,
    policy: longWork,
  }).advanceUntilHeroOrTerminal();

  assert.deepEqual(
    second.botDecisionJournal.decisions.map((record) => record.decisionSeed),
    first.botDecisionJournal.decisions.map((record) => record.decisionSeed),
  );
  assert.deepEqual(
    second.botDecisionJournal.decisions.map((record) => record.chosenAction),
    first.botDecisionJournal.decisions.map((record) => record.chosenAction),
  );
  assert.deepEqual(second.state.actionHistory, first.state.actionHistory);
});

test('passive Hero resume reaches deterministic flop, turn, river, reveal, showdown, and completed Hand', () => {
  const progression = progressionWithPolicy({ handId: 'bot-showdown', handSeed: 33 });
  const terminal = completePassively(progression);
  const completed = terminal.completedHand;
  const replayOperations = completed.canonicalResult.replay.events.map((event) => event.operation);
  const heroJournal = terminal.session.getHeroDecisionJournal();

  assert.equal(terminal.status, AUTOMATED_HAND_PROGRESSION_STATUSES.TERMINAL);
  assert.equal(completed.schemaVersion, AUTOMATED_COMPLETED_HAND_RESULT_SCHEMA_VERSION);
  assert.equal(completed.canonicalResult.terminalReason, 'showdown');
  assert.equal(completed.canonicalResult.finalBoard.length, 5);
  assert.deepEqual(heroJournal.decisions.map((record) => record.street), [
    'preflop', 'flop', 'turn', 'river',
  ]);
  assert.deepEqual(
    replayOperations.filter((operation) => operation === 'deal_board'),
    ['deal_board', 'deal_board', 'deal_board'],
  );
  assert.equal(replayOperations.includes('reveal_hole'), true);
  assert.equal(replayOperations.at(-1), 'showdown');
  assert.equal(completed.botDecisionJournal.status, 'complete');
  assert.equal(completed.botDecisionJournal.decisions.length, 4);
  assert.equal(
    completed.botDecisionJournal.decisions.some((record) => record.actor.playerId === 'P0'),
    false,
  );
  assert.equal(
    heroJournal.decisions.every((record) => record.currentActor.playerId === 'P0'),
    true,
  );
});

test('bot fold terminal is canonical and bot provenance never becomes a HeroDecisionRecord', () => {
  const progression = progressionWithPolicy({
    handId: 'bot-fold-terminal',
    handSeed: 44,
    policy: foldFacingPolicy,
    policyResolver: () => foldFacingPolicy,
  });
  const boundary = progression.advanceUntilHeroOrTerminal();
  const spec = getLegalActionSpec(boundary.state);

  assert.throws(() => progression.applyHeroAction(
    createAction('P1', ACTION_TYPES.RAISE, spec.raise.minToMilliBb),
  ), /configured Hero/);
  progression.applyHeroAction(createAction('P0', ACTION_TYPES.RAISE, spec.raise.minToMilliBb));
  const terminal = progression.advanceUntilHeroOrTerminal();
  const botRecord = terminal.botDecisionJournal.decisions[0];
  const heroJournal = terminal.session.getHeroDecisionJournal();

  assert.equal(terminal.status, AUTOMATED_HAND_PROGRESSION_STATUSES.TERMINAL);
  assert.equal(terminal.completedHand.canonicalResult.terminalReason, 'fold');
  assert.equal(botRecord.actor.playerId, 'P1');
  assert.equal(botRecord.chosenAction.type, ACTION_TYPES.FOLD);
  assert.equal(heroJournal.decisions.length, 1);
  assert.equal(heroJournal.decisions[0].currentActor.playerId, 'P0');
  assert.equal(heroJournal.decisions[0].chosenAction.type, ACTION_TYPES.RAISE);
  assert.throws(() => progression.applyHeroAction(
    createAction('P0', ACTION_TYPES.CHECK),
  ), /after terminal/);
  assert.strictEqual(progression.advanceUntilHeroOrTerminal(), terminal);
});

test('policy mismatch returns a stable explicit error without applying a wrong-actor action', () => {
  const progression = progressionWithPolicy({
    handId: 'bot-policy-mismatch',
    handSeed: 55,
    policy: passivePolicy,
    policyResolver: () => foldFacingPolicy,
  });
  const boundary = progression.advanceUntilHeroOrTerminal();
  applyPassiveHeroAction(progression, boundary.state);
  const beforeActionCount = progression.getSession().getState().actionHistory.length;
  const error = progression.advanceUntilHeroOrTerminal();

  assert.equal(error.status, AUTOMATED_HAND_PROGRESSION_STATUSES.ERROR);
  assert.equal(error.error.code, AUTOMATED_HAND_PROGRESSION_ERROR_CODES.POLICY_RESOLUTION_FAILED);
  assert.equal(error.botDecisionJournal.status, 'error');
  assert.equal(error.botDecisionJournal.decisions.length, 0);
  assert.equal(error.state.actionHistory.length, beforeActionCount);
  assert.strictEqual(progression.advanceUntilHeroOrTerminal(), error);
});

test('cumulative automated transition limit latches an explicit bounded-loop failure', () => {
  const progression = progressionWithPolicy({
    handId: 'bot-transition-limit',
    handSeed: 66,
    maxAutomatedTransitions: 1,
  });
  const boundary = progression.advanceUntilHeroOrTerminal();
  assert.equal(boundary.status, AUTOMATED_HAND_PROGRESSION_STATUSES.HERO_DECISION);
  assert.equal(boundary.automatedTransitionCount, 1);
  applyPassiveHeroAction(progression, boundary.state);
  const actionCount = progression.getSession().getState().actionHistory.length;
  const error = progression.advanceUntilHeroOrTerminal();

  assert.equal(error.status, AUTOMATED_HAND_PROGRESSION_STATUSES.ERROR);
  assert.equal(error.error.code, AUTOMATED_HAND_PROGRESSION_ERROR_CODES.TRANSITION_LIMIT_EXCEEDED);
  assert.equal(error.botDecisionJournal.status, 'error');
  assert.equal(error.state.actionHistory.length, actionCount);
  assert.equal(error.botDecisionJournal.decisions.length, 0);
  assert.strictEqual(progression.advanceUntilHeroOrTerminal(), error);
  assert.throws(() => progression.applyHeroAction(
    createAction('P0', ACTION_TYPES.CHECK),
  ), /progression failed/);
});
