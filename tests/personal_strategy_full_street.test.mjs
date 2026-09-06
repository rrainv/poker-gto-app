import test from 'node:test';
import assert from 'node:assert/strict';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { continuePersonalHandNode, personalNodeActions, personalNodeContext, personalExactAmountFromBb, comparePersonalNodeStudies } from '../app/src/application/personal-hand-study.mjs';
import { createExactIntentAction } from '../app/src/personal-strategy/exact-node-intent.mjs';
import { renderPersonalRangeMutations, continuationCopy } from '../app/src/application/personal-hand-continuation-language.mjs';
import { renderNodeCoach, createNodeCoachHandoff } from '../app/src/personal-strategy/node-coach.mjs';

async function fixture({ handClass = 'AA', board = ['Qs','8c','4h'] } = {}) {
  const values = new Map(); let n = 0;
  const options = { database: createMemoryPersonalStrategyDatabase(),
    storage: { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) }, idFactory: kind => `${kind}-${++n}` };
  const app = createRangeCalibrationApplication(options);
  const profile = await app.createProfile({ displayName: 'Full street', modeNames: ['Usual', 'Other'] });
  const context = createContextFromSelection({ environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
    decisionFamily: 'preflop_rfi', actionAware: true, anteType: 'none', anteBb: 0, collectionBb: 0 });
  const scope = { profileId: profile.profile.id, modeId: profile.modes[0].id, context };
  let study = await app.getPersonalHandStudy(scope, { board });
  await app.savePersonalHandIntent(scope, { node: study.preflopNode, approachSnapshot: study.approachSnapshot,
    subject: { kind: 'hand_class', handClass }, precision: 'exact', supersedesEvidenceIds: [],
    distribution: [{ action: study.preflopAction, probability: 0.8 }, { action: study.preflopFoldAction, probability: 0.2 }] });
  study = await app.getPersonalHandStudy(scope, { board });
  const comboId = study.study.questions.find(question => question.cards.includes('As') && question.cards.includes('Ks'))?.comboId ?? study.study.questions[0].comboId;
  const answer = async (current, action, probability = 1, supersedesEvidenceIds = [], contextNote = '') => app.savePersonalHandIntent(scope, {
    node: current.node, approachSnapshot: current.approachSnapshot, subject: { kind: 'combo', comboId }, precision: 'exact', supersedesEvidenceIds, contextNote,
    distribution: [{ action, probability }, ...(probability < 1 ? [{ action: current.actions.find(item => item.action.type === 'check' || item.action.type === 'fold'), probability: 1 - probability }] : [])] });
  return { app, options, scope, study, comboId, answer };
}

test('flop → turn → river preserves exact products, histories, correction and reload without derived persistence', async () => {
  const f = await fixture();
  const bet = createExactIntentAction(f.study.node, 'bet', 1817);
  await f.answer(f.study, bet, 0.5);
  const turnNode = continuePersonalHandNode({ node: f.study.node, action: bet, card: '2d' }).node;
  let turn = await f.app.getPersonalHandStudy(f.scope, { node: turnNode });
  assert.equal(turn.node.street, 'turn'); assert.equal(turn.contextFacts.potBb, 9.134);
  assert.equal(turn.contextFacts.heroStackBb, 95.683);
  assert.equal(turn.study.entries.length, 1);
  assert.equal(turn.study.entries[0].priorWeight, 0.4);
  assert.equal(turn.trajectory.normalization.available, false);
  const turnBet = createExactIntentAction(turn.node, 'bet', 4001);
  const first = await f.answer(turn, turnBet, 0.25, [], 'Worse pairs may call; reconsider against a raise.');
  const riverNode = continuePersonalHandNode({ node: turn.node, action: turnBet, card: '3c', opponentBetMilliBb: 2500 }).node;
  let river = await f.app.getPersonalHandStudy(f.scope, { node: riverNode });
  assert.equal(river.node.street, 'river'); assert.equal(river.study.entries[0].priorWeight, 0.1);
  assert.equal(river.study.questions[0].questionKind, 'call_boundary');
  assert.equal(river.study.questions[0].decisionContext.callAmountBb, 2.5);
  assert.ok(personalNodeActions(river.node).some(action => action.action.type === 'raise'));
  assert.ok(river.contextFacts.history.some(action => action.amountMilliBb === 4001));
  await f.answer(river, river.actions.find(action => action.action.type === 'call'));
  const reloaded = await createRangeCalibrationApplication(f.options).getPersonalHandStudy(f.scope);
  assert.equal(reloaded.node.fingerprint, river.node.fingerprint);
  assert.equal(reloaded.study.facts.exactCombos, 1);
  assert.equal(reloaded.trajectory.fingerprint, river.trajectory.fingerprint);
  const corrected = await f.answer(turn, turnBet, 0.5, [first.id]);
  river = await f.app.getPersonalHandStudy(f.scope);
  assert.equal(river.study.entries[0].priorWeight, 0.2);
  assert.equal(river.study.facts.exactCombos, 1);
  assert.ok(river.trajectory.lineage.find(entry => entry.comboId === f.comboId).evidenceRefs.includes(first.id) === false);
  const snapshot = await f.app.repository.loadSnapshot();
  assert.equal(snapshot.trajectoryNodes, undefined); assert.equal(snapshot.exactNodeIntents.length, 5);
  assert.match(snapshot.exactNodeIntents.find(record => record.id === first.id).provenance.contextNote, /Worse pairs/);
  for (const language of ['en','ru','he']) {
    const lines = renderPersonalRangeMutations(river.mutations, language);
    assert.ok(lines.length >= 3); assert.ok(lines.every(line => !line.includes('undefined')));
    const coach = renderNodeCoach(river.coach, { language });
    assert.equal(coach.direction, language === 'he' ? 'rtl' : 'ltr');
    assert.equal(coach.lessons.some(item => item.kind === 'scare_card_reasoning'), river.study.facts.structuralTransitionCombos > 0);
    assert.ok(continuationCopy('call_boundary', language).includes('?'));
  }
  for (const destination of ['same_spot','similar_spot','controlled_perturbation','full_hand']) {
    const handoff = createNodeCoachHandoff(river.coach, destination);
    assert.equal(handoff.availability, 'unavailable'); assert.equal(handoff.assessment, 'none');
    assert.equal(handoff.nodeFingerprint, river.node.fingerprint);
  }
  await f.answer(turn, turnBet, 0, [corrected.id]);
  const dormant = await f.app.getPersonalHandStudy(f.scope);
  assert.equal(dormant.study.entries.length, 0);
  assert.equal(dormant.study.facts.intentWithoutKnownReachCombos, 1);
  assert.ok(dormant.coach.opportunities.some(item => item.kind === 'action_conditioned_range_inconsistency'));
  assert.ok(dormant.study.facts.evidenceRefs.includes(snapshot.exactNodeIntents.find(record => record.node.street === 'river').id));
  const other = await f.app.getPersonalHandStudy({ ...f.scope, modeId: dormant.comparisonApproaches[0].id }, { node: dormant.node });
  assert.equal(comparePersonalNodeStudies(dormant, other).comparableCombos, 0);
});

test('preferences cannot create turn reach; card removal and illegal/terminal branches fail truthfully', async () => {
  const f = await fixture(), action = f.study.actions.find(item => item.action.type === 'bet');
  await f.app.savePersonalHandIntent(f.scope, { node: f.study.node, approachSnapshot: f.study.approachSnapshot,
    subject: { kind: 'combo', comboId: f.comboId }, precision: 'dominant', preferredAction: action, supersedesEvidenceIds: [] });
  const next = continuePersonalHandNode({ node: f.study.node, action, card: '2d' }).node;
  const turn = await f.app.getPersonalHandStudy(f.scope, { node: next });
  assert.equal(turn.study.entries.length, 0); assert.ok(turn.study.facts.unknownReachCombos > 0);
  await assert.rejects(f.answer(turn, turn.actions[0]), /known positive/);
  assert.throws(() => continuePersonalHandNode({ node: f.study.node, action, card: 'Qs' }));
  assert.throws(() => continuePersonalHandNode({ node: f.study.node, action, card: '2d', opponentBetMilliBb: 123.4 }));
  assert.equal(continuePersonalHandNode({ node: f.study.node, action: f.study.actions.find(item => item.action.type === 'all_in'), card: '2d' }).available, false);
  assert.ok(Number.isFinite(personalNodeContext(f.study.node).heroStackBb));
});

test('new card can remove the one known reached combo without normalizing or generalizing unknown mass', async () => {
  const f = await fixture(), bet = createExactIntentAction(f.study.node, 'bet', 2000);
  await f.answer(f.study, bet);
  const card = f.study.study.entries.find(entry => entry.comboId === f.comboId).cards[0];
  const next = continuePersonalHandNode({ node: f.study.node, action: bet, card }).node;
  const turn = await f.app.getPersonalHandStudy(f.scope, { node: next });
  assert.equal(turn.study.entries.length, 0);
  assert.equal(turn.mutations.cardRemoval.removedKnownMass, 0.8);
  assert.ok(turn.mutations.cardRemoval.removedUnknownCombos > 0);
  assert.equal(turn.trajectory.normalization.available, false);
  assert.equal(turn.trajectory.range.entries.find(entry => entry.comboId === f.comboId).weight, 0.8);
});

test('river missed-draw questions use actual turn completion cards and never assign a bluff role', async () => {
  const f = await fixture({ handClass: 'AKs', board: ['Qs','8s','4h'] });
  const check = f.study.actions.find(action => action.action.type === 'check');
  await f.answer(f.study, check);
  const turnNode = continuePersonalHandNode({ node: f.study.node, action: check, card: '2d' }).node;
  const turn = await f.app.getPersonalHandStudy(f.scope, { node: turnNode, board: f.study.node.board });
  assert.equal(turn.study.questions[0].handFacts.draws.flushDraw, true);
  const turnCheck = turn.actions.find(action => action.action.type === 'check');
  await f.answer(turn, turnCheck);
  for (const [card, missed] of [['3c',true], ['3s',false]]) {
    const node = continuePersonalHandNode({ node: turn.node, action: turnCheck, card }).node;
    const river = await f.app.getPersonalHandStudy(f.scope, { node, board: f.study.node.board });
    assert.equal(river.study.questions[0].missedDraw, missed);
    assert.equal(river.study.questions[0].questionKind, missed ? 'missed_draw' : 'value_boundary');
    assert.equal(river.study.questions[0].assessment, 'none');
    assert.equal(river.study.questions[0].role, undefined);
    assert.ok(river.coach.opportunities.some(item => item.kind === 'scare_card_reasoning'));
    assert.equal(river.mutations.missedDrawCombos, missed ? 1 : 0);
  }
  assert.equal((await f.app.repository.loadSnapshot()).exactNodeIntents.length, 3, 'exploration never adopts a hypothetical answer');
});

test('exact decimal bb parsing preserves legal thousandths without float rounding or extra precision leakage', () => {
  for (const [text, amount] of [['4.001',4001],['1.817',1817],['0.001',1],['100',100000]]) assert.equal(personalExactAmountFromBb(text), amount);
  for (const value of ['', ' ', '-1', 'NaN', '0', '1.0001']) assert.throws(() => personalExactAmountFromBb(value));
});
