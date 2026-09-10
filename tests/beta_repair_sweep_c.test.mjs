import test from 'node:test';
import assert from 'node:assert/strict';
import { createTablePresetRepository, tablePresetConfiguration, handSetupPositions } from '../app/src/application/table-presets.mjs';
import { createTrainingLineup } from '../app/src/application/training-lineup.mjs';
import { createTrainingLineupPreview } from '../app/src/ui/training-lineup-preview.mjs';
import { createFullHandTrainingSessionController, createFullHandTrainingStartConfigurationFromTrainingConfig } from '../app/src/application/full-hand-training-session-controller.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { createTrainingConfig } from '../app/src/application/training-generator.mjs';
import { createHandSetupRulesSnapshot } from '../app/src/application/hand-setup-rules.mjs';
import { personalTeacherLearning } from '../app/src/application/personal-teacher-learning.mjs';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';

const draft = { tableSize: 6, stackBb: 100, collectionType: 'none', anteType: 'none', anteBb: 0 };
const memoryStorage = () => { const data = new Map(); return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

test('table presets reload by owner, load as copies, and change only on explicit update', () => {
  const storage = memoryStorage(); let id = 0;
  const repo = ownerId => createTablePresetRepository({ storage, ownerId, idFactory: () => `preset-${++id}` });
  const saved = repo('guest').save({ name: '  My   Home Game  ', configuration: { ...draft, heroSeat: 4, board: ['As'], actionHistory: [] } });
  assert.equal(saved.name, 'My Home Game'); assert.deepEqual(saved.configuration, draft);
  const loaded = { ...repo('guest').list()[0].configuration, tableSize: 2 };
  assert.equal(repo('guest').list()[0].configuration.tableSize, 6);
  repo('guest').save({ id: saved.id, name: saved.name, configuration: loaded });
  assert.equal(repo('guest').list()[0].configuration.tableSize, 2);
  assert.deepEqual(repo('account').list(), []);
  const duplicate = repo('guest').save({ name: saved.name, configuration: loaded });
  assert.notEqual(saved.id, duplicate.id); // duplicate names are permitted, IDs disambiguate.
  repo('guest').save({ ...duplicate, name: 'Heads Up' });
  repo('guest').remove(saved.id); assert.equal(loaded.tableSize, 2);
  assert.equal(repo('guest').list()[0].name, 'Heads Up');
  for (const name of ['', '  ', 'x'.repeat(61)]) assert.throws(() => repo('guest').save({ name, configuration: draft }));
  assert.throws(() => tablePresetConfiguration({ ...draft, tableSize: 3, collectionType: 'fixed_per_seated_player' }));
  assert.throws(() => tablePresetConfiguration({ ...draft, anteType: 'per_player', anteBb: 0 }));
  assert.throws(() => tablePresetConfiguration({ ...draft, stackBb: -1 }));
  storage.setItem('riverline:table-presets:v1:guest', JSON.stringify({ schemaVersion: 'table-presets/v1', items: [{ ...saved, configuration: { ...draft, tableSize: 99 } }] }));
  assert.equal(repo('guest').list()[0].available, false);
});

test('Dealer and Hero use canonical positions at every supported size and HU BTN is SB', () => {
  for (let size = 2; size <= 10; size++) for (let button = 0; button < size; button++) {
    const seats = handSetupPositions(size, button);
    assert.equal(new Set(seats.map(seat => seat.position)).size, size);
    assert.equal(seats.find(seat => seat.position === 'BTN').seat, button);
    for (const position of ['BTN', 'BB']) {
      const next = handSetupPositions(size, (button + 1) % size).find(seat => seat.position === position);
      assert.equal(next.seat, (seats.find(seat => seat.position === position).seat + 1) % size);
    }
    if (size === 2) assert.equal(seats.find(seat => seat.position === 'BTN').isSmallBlind, true);
  }
});

function configuredHand(seed = 17) {
  const rulesSnapshot = createHandSetupRulesSnapshot(draft, { type: 'none', amountMilliBb: 0 });
  const trainingConfig = createTrainingConfig({ schemaVersion: 'training-config/v2', rulesSnapshot, tableSize: 6, stackBb: 100, heroPositions: ['UTG'], streets: ['preflop', 'flop', 'turn', 'river'], allowedDecisionTypes: [], difficulty: 'hard', seed });
  return createFullHandTrainingStartConfigurationFromTrainingConfig({ trainingConfig, handSeed: seed, heroPosition: 'UTG' });
}
const provider = () => createStrategyProvider({ fallbackResolver: () => ({ source: 'heuristic_preflop', modelVersion: 'sweep-c-test/v1', actions: [{ action: { type: 'fold' }, label: 'Fold', probability: 1 }] }) });

test('per-seat policies and characters stay independent, bulk affects only policy, roster removes departed seats', () => {
  const lineup = createTrainingLineup(), seats = createTrainingLineupPreview({ playerCount: 6, heroPosition: 'UTG' }); lineup.sync(seats);
  const opponents = seats.filter(seat => !seat.isHero);
  for (const [i, preset] of ['tight-passive', 'aggressive', 'calling-heavy'].entries()) lineup.policy(opponents[i].seat, preset);
  const before = lineup.requests(71); lineup.character(opponents[0].seat, 'cleo'); lineup.character(opponents[1].seat, 'cleo');
  assert.deepEqual(lineup.requests(71), before);
  assert.notDeepEqual(before[0].request.configuration, before[1].request.configuration);
  lineup.applyAll(opponents[1].seat);
  assert.equal(lineup.get(opponents[0].seat).character, 'cleo');
  assert.ok(lineup.requests(71).every(entry => entry.request.configuration.parameters.freeAggressionPercent === 65));
  lineup.sync(createTrainingLineupPreview({ playerCount: 2, heroPosition: 'BTN' }));
  assert.equal(lineup.requests().length, 1); assert.equal(lineup.get(5), null);
  lineup.reset(); assert.deepEqual(lineup.requests(), []);
});

test('Hero fold pauses immediately, Watch Rest retains replay and assignments, reset cancels continuation', async () => {
  const controller = createFullHandTrainingSessionController();
  const start = controller.start(configuredHand(), { strategyProvider: provider() });
  assert.equal(start.ok, true, JSON.stringify(start.error));
  const before = start.snapshot;
  assert.equal(before.status, 'awaiting_hero');
  const result = await controller.answer(before.currentDecision.decisionId, { type: 'fold' });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  assert.equal(result.snapshot.status, 'hero_complete'); assert.notEqual(result.snapshot.state.phase, 'terminal');
  assert.equal(result.snapshot.state.actionHistory.length, before.state.actionHistory.length + 1);
  assert.equal(result.snapshot.summary.decisionsAnswered, 1); assert.equal(result.snapshot.completedHandResult, null);
  assert.equal(controller.advanceOneAutomatedEvent().ok, false);
  const prefix = result.snapshot.replaySource.events, assignments = result.snapshot.opponentAssignments;
  const watched = controller.watchRest(); assert.equal(watched.ok, true); assert.equal(watched.snapshot.status, 'terminal');
  assert.deepEqual(watched.snapshot.replaySource.events.slice(0, prefix.length), prefix);
  assert.deepEqual(watched.snapshot.opponentAssignments, assignments); assert.equal(watched.snapshot.summary.decisionsAnswered, 1);
  assert.equal(controller.watchRest().ok, false); controller.reset(); assert.equal(controller.watchRest().ok, false);
});

test('canonical Full Hand starts with distinct configured policies at each requested seat', () => {
  const lineup = createTrainingLineup(); lineup.sync(createTrainingLineupPreview({ playerCount: 6, heroPosition: 'UTG' }));
  lineup.policy(0, 'tight-passive'); lineup.policy(1, 'aggressive'); lineup.policy(2, 'calling-heavy');
  const controller = createFullHandTrainingSessionController();
  const result = controller.start({ ...configuredHand(), opponentSeats: lineup.requests(812) }, { strategyProvider: provider() });
  assert.equal(result.ok, true, JSON.stringify(result.error));
  const assignments = result.snapshot.opponentAssignments;
  assert.equal(assignments.length, 5);
  assert.deepEqual(assignments.slice(0, 3).map(item => item.config.parameters.freeAggressionPercent), [10, 65, 15]);
  assert.equal(new Set(assignments.map(item => item.baseSeed)).size, 5);
  assert.ok(assignments.every(item => !Object.hasOwn(item, 'character')));
});

test('learning interpretation preserves qualitative, exact and uncertainty semantics without assessment', () => {
  const qualitative = personalTeacherLearning({ handClass: 'K8s', actionType: 'raise' });
  assert.equal(qualitative.precision, 'dominant'); assert.equal(qualitative.mix, null);
  const exact = personalTeacherLearning({ handClass: 'K8s', mix: { raise: 70, fold: 30 } });
  assert.deepEqual(exact.mix, { raise: 70, fold: 30 });
  const multiAction = personalTeacherLearning({ handClass: 'K8s', mix: [{ action: { type: 'fold' }, probability: 0.25 }, { action: { type: 'call' }, probability: 0.5 }, { action: { type: 'raise' }, probability: 0.25 }] });
  assert.deepEqual(multiAction.mix, { fold: 25, call: 50, raise: 25 });
  const uncertain = personalTeacherLearning({ handClass: 'K7s', notSure: true, actionType: 'fold', mix: { fold: 100 } });
  assert.equal(uncertain.actionType, null); assert.equal(uncertain.mix, null); assert.equal(uncertain.assessment, 'none');
});

test('saved exact evidence remains correctable after upstream reach disappears; immutable lineage and Approach isolation survive reload', async () => {
  const storage = memoryStorage(), database = createMemoryPersonalStrategyDatabase(); let id = 0;
  const make = () => createRangeCalibrationApplication({ storage, database, idFactory: prefix => `${prefix}-c-${++id}` });
  const app = make();
  const setup = { environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100, decisionFamily: 'preflop_rfi', actionAware: true, anteType: 'none', anteBb: 0, collectionBb: 0 };
  const bundle = await app.createProfile({ displayName: 'My game', modeNames: ['A', 'B'], setupAssumptions: setup });
  const scope = { profileId: bundle.profile.id, modeId: bundle.modes[0].id, context: createContextFromSelection(setup) };
  let study = await app.getPersonalHandStudy(scope);
  const opening = await app.savePersonalHandIntent(scope, { approachSnapshot: study.approachSnapshot, node: study.preflopNode, subject: { kind: 'hand_class', handClass: 'AA' }, precision: 'exact',
    preferredAction: null, distribution: [{ action: study.preflopAction, probability: 1 }, { action: study.preflopFoldAction, probability: 0 }], supersedesEvidenceIds: [] });
  study = await app.getPersonalHandStudy(scope);
  const combo = study.study.questions[0];
  const original = await app.savePersonalHandIntent(scope, { approachSnapshot: study.approachSnapshot, node: study.node, subject: { kind: 'combo', comboId: combo.comboId }, precision: 'exact', preferredAction: null,
    distribution: [{ action: study.actions[0], probability: 1 }], supersedesEvidenceIds: [] });
  await app.savePersonalHandIntent(scope, { approachSnapshot: study.approachSnapshot, node: study.preflopNode, subject: opening.subject, precision: 'exact', preferredAction: null,
    distribution: [{ action: study.preflopAction, probability: 0 }, { action: study.preflopFoldAction, probability: 1 }], supersedesEvidenceIds: [opening.id] });
  assert.equal((await app.getPersonalHandStudy(scope)).study.entries.length, 0);
  const corrected = await app.correctPersonalHandEvidence(scope, { recordId: original.id, expectedHeadIds: [original.id], precision: 'dominant', preferredAction: study.actions[0], distribution: null });
  assert.deepEqual(corrected.supersedesEvidenceIds, [original.id]);
  const history = await make().getApproachHistory(scope);
  assert.deepEqual(history.exactNodeIntents.find(record => record.id === original.id), original);
  assert.equal(history.exactNodeIntents.find(record => record.id === corrected.id).distribution, null);
  const other = { ...scope, modeId: bundle.modes[1].id };
  assert.deepEqual((await app.getApproachHistory(other)).exactNodeIntents, []);
  await assert.rejects(app.correctPersonalHandEvidence(other, { recordId: original.id, expectedHeadIds: [corrected.id], precision: 'dominant', preferredAction: study.actions[0] }));
});
