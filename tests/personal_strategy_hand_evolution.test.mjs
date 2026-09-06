import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLDEM_COMBOS, conditionHoldemRange, createNormalizedHoldemDistribution,
  getHoldemComboForCards, getHoldemComboById, createHoldemWeightedRangeFromEntries,
  applyAction, applyChance, createAction } from '../shared/poker-domain/index.js';
import { multiplyHoldemRangeByActionFrequencies } from '../shared/poker-domain/holdem-range-action.js';
import { createExactNodeIntent, createExactIntentAction, exactNodeState, createExactRangeNode,
  validateExactNodeIntent, exactIntentFingerprint } from '../app/src/personal-strategy/exact-node-intent.mjs';
import { createPersonalHandBranch, createPersonalRangePrior, createExactNodeActionRange,
  conditionPersonalRangeAction, advancePersonalRangeToNode, createPersonalRangeNodeStudy,
  personalRangeNormalizationAvailability } from '../app/src/application/personal-hand-study.mjs';
import { createCanonicalHandReplaySource, deriveCanonicalHandReplayEvent } from '../app/src/application/canonical-hand-replay-source.mjs';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { createNodeCoach, renderNodeCoach } from '../app/src/personal-strategy/node-coach.mjs';

const branch = createPersonalHandBranch(), snapshot = { profileId:'p',modeId:'m',setupVersion:1,approachVersion:1 };
const idFor = cards => getHoldemComboForCards(cards).id;
const aa = idFor(['As','Ad']), qqBlocked = idFor(['Qs','Qd']);
function intent({ node = branch.preflopNode, subject = {kind:'hand_class',handClass:'AA'}, id='open-aa', probability=0.75, ...overrides } = {}) {
  return createExactNodeIntent({ ...snapshot, id, node, subject, createdAt:'2026-09-05T12:00:00.000Z',precision:'exact',
    distribution:[{action:createExactIntentAction(node,node.street === 'preflop' ? 'raise':'bet',node.street === 'preflop'?2500:1815),probability},
      {action:createExactIntentAction(node,node.street === 'preflop'?'fold':'check'),probability:1-probability}],...overrides });
}
function trajectory(records = [intent()]) {
  const prior = createPersonalRangePrior({node:branch.preflopNode,approachSnapshot:snapshot});
  const policy = createExactNodeActionRange({node:branch.preflopNode,action:branch.preflopAction,records,approachSnapshot:snapshot});
  const conditioned = conditionPersonalRangeAction({prior,policy});
  return {prior,policy,conditioned,flop:advancePersonalRangeToNode({prior:conditioned,nextNode:branch.flopNode})};
}
test('exact preflop frequency becomes reached mass once; unknown and preferred stay unknown',()=>{
  const records = [intent(),intent({id:'kk-preferred',subject:{kind:'hand_class',handClass:'KK'},precision:'dominant',distribution:null,preferredAction:branch.preflopAction})];
  const result = trajectory(records);
  assert.equal(result.flop.range.entries.find(e=>e.comboId===aa).weight,0.75);
  assert.equal(result.flop.range.entries.find(e=>e.comboId===idFor(['Ks','Kd'])).state,'unknown');
  assert.equal(result.flop.range.entries.find(e=>e.comboId===idFor(['Js','Jd'])).state,'unknown');
  assert.equal(result.flop.normalization.available,false);
  assert.throws(()=>conditionPersonalRangeAction({prior:result.conditioned,policy:result.policy}),/Incompatible/);
});
test('unknown operand remains unknown even when other operand is zero',()=>{
  const known = createHoldemWeightedRangeFromEntries({entries:[{comboId:aa,state:'known',weight:0}]});
  const unknown = createHoldemWeightedRangeFromEntries();
  for (const [prior,policy] of [[known,unknown],[unknown,known]]) assert.equal(multiplyHoldemRangeByActionFrequencies(prior,policy).entries.find(e=>e.comboId===aa).state,'unknown');
});
test('blocking the only unknown does not advertise normalization forbidden by Range Core',()=>{
  const range=createHoldemWeightedRangeFromEntries({entries:HOLDEM_COMBOS.filter(combo=>combo.id!==qqBlocked)
    .map(combo=>({comboId:combo.id,state:'known',weight:1}))});
  const removal=conditionHoldemRange(range,branch.flopNode.board);
  assert.equal(removal.facts.completeAfterConditioning,true);
  assert.equal(personalRangeNormalizationAvailability(range,removal).available,false);
  assert.throws(()=>createNormalizedHoldemDistribution(range,{blockers:branch.flopNode.board}),/incomplete/);
});
test('multiplication preserves exact numeric product and per-combo operand references',()=>{
  const range = (weight,id)=>createHoldemWeightedRangeFromEntries({entries:[{comboId:aa,state:'known',weight,provenanceId:id}],provenanceSources:[{id,kind:'personal_direct',sourceId:id}]});
  const result = multiplyHoldemRangeByActionFrequencies(range(0.4,'prior-evidence'),range(0.7,'policy-evidence'));
  const entry = result.entries.find(e=>e.comboId===aa);
  assert.ok(Math.abs(entry.weight-0.28)<1e-12);
  assert.deepEqual(JSON.parse(result.provenance.sources.find(s=>s.id===entry.provenanceId).sourceId),{prior:'prior:prior-evidence',policy:'policy:policy-evidence'});
});
test('different exact node, size, action and snapshot conditioning fail closed',()=>{
  const {prior,policy} = trajectory();
  assert.throws(()=>conditionPersonalRangeAction({prior,policy,action:createExactIntentAction(branch.preflopNode,'raise',3000)}),/Incompatible/);
  assert.throws(()=>conditionPersonalRangeAction({prior,policy,action:branch.preflopFoldAction}),/Incompatible/);
  assert.throws(()=>createExactNodeActionRange({node:branch.flopNode,action:branch.actions[0],records:[intent()],approachSnapshot:snapshot}),/Incompatible/);
  assert.throws(()=>createExactNodeActionRange({node:branch.preflopNode,action:branch.preflopAction,records:[intent()],approachSnapshot:{...snapshot,approachVersion:2}}),/Incompatible/);
  const changed = createPersonalHandBranch({stackBb:120});
  assert.throws(()=>advancePersonalRangeToNode({prior:trajectory().conditioned,nextNode:changed.flopNode}),/mismatch/);
});
test('card removal removes physical combos without turning blocked unknown into known zero',()=>{
  const result=trajectory();
  assert.equal(result.flop.boardRemoval.blockedEntries.length,150);
  assert.equal(result.flop.boardRemoval.blockedEntries.find(e=>e.comboId===qqBlocked).state,'unknown');
  assert.equal(result.flop.range.entries.find(e=>e.comboId===qqBlocked).state,'unknown');
  for(const entry of result.flop.boardRemoval.eligibleEntries) assert.ok(!getHoldemComboById(entry.comboId).cards.some(card=>branch.flopNode.board.includes(card)));
  assert.equal(result.flop.coverage.totalEligibleWeight,4.5);
  assert.deepEqual(result.flop,trajectory().flop);
});
test('node study selects only known-positive physical combos and does not generalize answers',()=>{
  const {flop}=trajectory();
  const answer=intent({node:branch.flopNode,subject:{kind:'combo',comboId:aa},id:'flop-aa',probability:0.7});
  const study=createPersonalRangeNodeStudy({trajectory:flop,records:[answer]});
  assert.equal(study.facts.knownPositiveCombos,6);
  assert.equal(study.facts.mappedCombos,1);
  assert.equal(study.facts.unknownPolicyCombos,5);
  for(const question of study.questions) {
    assert.equal(question.handClass,'AA'); assert.equal(question.applicability,'this_combo_only');
    assert.equal(question.assessment,'none'); assert.ok(question.decisionContext);
    assert.ok(!question.cards.some(card=>branch.flopNode.board.includes(card)));
  }
  assert.throws(()=>intent({node:branch.flopNode,subject:{kind:'hand_class',handClass:'AA'}}),/combo required/);
  assert.throws(()=>intent({node:branch.flopNode,subject:{kind:'combo',comboId:qqBlocked}}),/Blocked/);
  assert.equal(answer.grade,undefined);
});
test('conflicting heads and exact-size preferences remain unresolved until corrected',()=>{
  const first=intent(),other=intent({id:'other',probability:0.2});
  assert.equal(trajectory([first,other]).policy.lineage.find(e=>e.comboId===aa).precision,'conflict');
  assert.equal(trajectory([first,other]).flop.range.entries.find(e=>e.comboId===aa).state,'unknown');
  const corrected=intent({id:'corrected',supersedesEvidenceIds:['open-aa','other'],probability:0.8});
  assert.equal(trajectory([first,other,corrected]).flop.range.entries.find(e=>e.comboId===aa).weight,0.8);
});
test('flop action conditioning retains preflop lineage and advances a real canonical turn path',()=>{
  const {flop}=trajectory(),bet=createExactIntentAction(branch.flopNode,'bet',1815);
  const answer=intent({node:branch.flopNode,subject:{kind:'combo',comboId:aa},id:'flop-aa',probability:0.7});
  const policy=createExactNodeActionRange({node:branch.flopNode,action:bet,records:[answer],approachSnapshot:snapshot});
  const conditioned=conditionPersonalRangeAction({prior:flop,policy});
  assert.ok(Math.abs(conditioned.range.entries.find(e=>e.comboId===aa).weight-0.525)<1e-12);
  assert.deepEqual(conditioned.lineage.find(e=>e.comboId===aa).evidenceRefs,['flop-aa','open-aa']);
  let state=exactNodeState(branch.flopNode);const events=[...branch.flopNode.replaySource.events];
  const push=(operation,next)=>{events.push(deriveCanonicalHandReplayEvent({sequence:events.length,operation,previousState:state,state:next}));state=next;};
  push('action',applyAction(state,bet.action));push('action',applyAction(state,createAction(state.actingPlayerId,'call')));
  push('deal_board',applyChance(state,{type:'deal_turn',cards:['2d']}));push('action',applyAction(state,createAction(state.actingPlayerId,'check')));
  const nextNode=createExactRangeNode({replaySource:createCanonicalHandReplaySource({heroPlayerId:branch.flopNode.actorId,events})});
  const turn=advancePersonalRangeToNode({prior:conditioned,nextNode});
  assert.equal(turn.node.street,'turn');assert.ok(turn.coverage.unknownEligibleCombos>0);
});
test('fingerprints and structured summaries match sparse facts in EN/RU/HE',()=>{
  const {flop}=trajectory();const study=createPersonalRangeNodeStudy({trajectory:flop});
  const coach=createNodeCoach({studyFacts:study.facts,node:branch.flopNode,approachSnapshot:snapshot});
  for(const language of ['en','ru','he']) {
    const rendered=renderNodeCoach(coach,{language});
    assert.ok(JSON.stringify(rendered).includes('6'));assert.ok(JSON.stringify(rendered).includes('1170'));
    assert.equal(rendered.direction,language==='he'?'rtl':'ltr');
  }
  const corrupted=structuredClone(intent());corrupted.distribution[0].probability=0.6;
  assert.throws(()=>validateExactNodeIntent(corrupted));
  const {fingerprint,...content}=corrupted;corrupted.fingerprint=exactIntentFingerprint(content);
  assert.throws(()=>validateExactNodeIntent(corrupted),/sum to one/);
});

test('real application teaches exact preflop, reloads flop answers and rejects stale scope/unknown combos',async()=>{
  const values=new Map(),database=createMemoryPersonalStrategyDatabase();let n=0;
  const options={database,storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},idFactory:kind=>`${kind}-${++n}`};
  const app=createRangeCalibrationApplication(options),bundle=await app.createProfile({displayName:'Hand study',modeNames:['Usual']});
  const context=createContextFromSelection({environment:'custom',tableSize:6,heroPosition:'BTN',effectiveStackBb:100,decisionFamily:'preflop_rfi',actionAware:true,anteType:'none',anteBb:0,collectionBb:0});
  const scope={profileId:bundle.profile.id,modeId:bundle.modes[0].id,context};
  let study=await app.getPersonalHandStudy(scope);assert.equal(study.available,true);assert.equal(study.study.questions.length,0);
  await app.savePersonalHandIntent(scope,{node:study.preflopNode,approachSnapshot:study.approachSnapshot,subject:{kind:'hand_class',handClass:'AA'},precision:'exact',supersedesEvidenceIds:[],
    distribution:[{action:study.preflopAction,probability:0.75},{action:study.preflopFoldAction,probability:0.25}]});
  study=await app.getPersonalHandStudy(scope);assert.equal(study.study.questions.length,6);
  const input={node:study.flopNode,approachSnapshot:study.approachSnapshot,subject:{kind:'combo',comboId:aa},precision:'dominant',preferredAction:study.actions[0],supersedesEvidenceIds:[]};
  const answer=await app.savePersonalHandIntent(scope,input);assert.equal(answer.precision,'dominant');
  await assert.rejects(app.savePersonalHandIntent(scope,input),/changed since teaching/);
  await assert.rejects(app.savePersonalHandIntent(scope,{...input,subject:{kind:'combo',comboId:idFor(['Ks','Kd'])}}),/known positive/);
  const reloaded=await createRangeCalibrationApplication(options).getPersonalHandStudy(scope);
  assert.equal(reloaded.study.facts.mappedCombos,1);assert.equal(reloaded.study.facts.dominantCombos,1);
  assert.equal((await app.repository.loadSnapshot()).exactNodeIntents.length,2);
  assert.equal((await app.repository.loadSnapshot()).trajectoryNodes,undefined);
  assert.equal((await app.getPersonalHandStudy({...scope,context:{...context,heroPosition:'CO'}})).available,false);
});
