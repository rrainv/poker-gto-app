import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCanonicalLiveController } from '../app/src/application/canonical-live-controller.mjs';
import { createTablePresenceViewModel } from '../app/src/application/table-presence-view-model.mjs';
import { createReplayTimelineViewModel } from '../app/src/application/replay-timeline-view-model.mjs';
import { canRandomizeHandPublicChance, randomizeHandPendingDraft, HAND_PENDING_RANDOMIZATION_REQUEST_VERSION } from '../app/src/application/hand-pending-randomization.mjs';
import { createHandSetupRulesSnapshot, handSetupRulesDefinition } from '../app/src/application/hand-setup-rules.mjs';
import { createGameRulesSnapshotFromLegacyGameConfiguration } from '../shared/poker-domain/index.js';

function controller(overrides = {}, deal = false) {
  const c = createCanonicalLiveController({ enabled: true });
  assert.ok(c.initialize({tableSize: 3, collectionType: 'none', stackBb: 10, heroSeat: 0, buttonSeat: 0, ...overrides}), c.getDiagnostics().error?.message);
  if (deal) assert.ok(c.dealHoleCards({'seat-0':['As','Ah'],'seat-1':['Ks','Kh'],'seat-2':['Qs','Qh']}));
  return c;
}
function action(c, type, amountToBb) {
  assert.ok(c.applyAction({type, amountToBb}), c.getDiagnostics().error?.message);
}
function closeRound(c) {
  for(let n=0; n<12 && !c.getState().pendingChance && !c.getState().terminal.isTerminal; n++) action(c, c.getLegalActions().check.available ? 'check' : 'call');
}
function available(c, overrides = {}) {
  const state=c.getState();
  return canRandomizeHandPublicChance({state, availableCards:state.pendingChance ? c.getAvailableChanceCards() : [], ...overrides});
}

test('BBA and per-player antes remain distinct ledger presentation, never voluntary actions', () => {
  for (const anteType of ['big_blind', 'per_player']) {
    const c=controller({tableSize:5,anteType,anteBb:1});
    const state=c.getState();
    const vm=createTablePresenceViewModel({state,heroPlayerId:c.getHeroPlayerId()});
    assert.equal(state.potMilliBb, anteType==='big_blind' ? 2500 : 6500);
    const bb=vm.seats.find(p=>p.position==='BB');
    assert.deepEqual(bb.forcedContributions, [{kind:'ante',amountMilliBb:1000},{kind:'big_blind',amountMilliBb:1000}]);
    assert.equal(bb.streetContributionMilliBb,1000);
    assert.equal(bb.voluntaryStreetContributionMilliBb,0);
    assert.equal(bb.currentStackMilliBb,8000);
    assert.equal(vm.seats.filter(p=>p.forcedContributions.some(e=>e.kind==='ante')).length,anteType==='big_blind'?1:5);
    assert.equal(createReplayTimelineViewModel({state,heroPlayerId:c.getHeroPlayerId()}).entryCount,0);
  }
  const c=controller({},true);
  action(c,'call'); action(c,'call');
  const vm=createTablePresenceViewModel({state:c.getState(),heroPlayerId:c.getHeroPlayerId()});
  const sb=vm.seats.find(p=>p.position==='SB');
  assert.deepEqual(sb.forcedContributions,[{kind:'small_blind',amountMilliBb:500}]);
  assert.equal(sb.voluntaryStreetContributionMilliBb,500);
  assert.equal(sb.streetContributionMilliBb,1000);
});

test('explicit setup uses canonical definitions and old setup values preserve the same rules', () => {
  for(const [gameMode,collectionType,tableSize] of [['home','none',5],['clubgg','fixed_per_seated_player',7]]) {
    const ante={type:'big_blind',amountMilliBb:1000};
    const legacy=createGameRulesSnapshotFromLegacyGameConfiguration({mode:gameMode,smallBlindMilliBb:500,bigBlindMilliBb:1000,chipUnitMilliBb:100,ante},tableSize);
    const explicit=createHandSetupRulesSnapshot({collectionType,tableSize},ante);
    const restored=createHandSetupRulesSnapshot({gameMode,tableSize},ante);
    assert.deepEqual(explicit.definition,legacy.definition);
    assert.equal(explicit.semanticFingerprint,legacy.semanticFingerprint);
    assert.deepEqual(restored,legacy);
    assert.equal(explicit.source.kind,'direct');
  }
  assert.equal(handSetupRulesDefinition({collectionType:'none',gameMode:'clubgg'}).collectionPolicy.type,'none');
  assert.throws(()=>handSetupRulesDefinition({collectionType:'percentage'}),/Unsupported/);
  assert.throws(()=>createHandSetupRulesSnapshot({collectionType:'fixed_per_seated_player',tableSize:6},{type:'none',amountMilliBb:0}));
  const html=fs.readFileSync(new URL('../app/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="handGameMode"/);
  assert.match(html,/id="handCollectionType"/);
  assert.match(html,/data-i18n="Fixed collection"/);
});

test('public chance availability follows legal pending cards for active, folded, and all-in Hero', () => {
  const c=controller({},true);
  closeRound(c);
  assert.equal(available(c),true,'active Hero');
  assert.equal(available(c,{readOnly:true}),false);
  assert.equal(available(c,{busy:true}),false);
  assert.equal(available(c,{availableCards:[]}),false);
  assert.ok(c.dealBoardCards(['2c','3d','4h']));
  action(c,'bet',1); action(c,'call'); action(c,'fold');
  assert.equal(c.getState().players[0].folded,true);
  assert.ok(c.dealBoardCards(['8s']));
  action(c,'all_in'); action(c,'call');
  assert.equal(c.getState().players.filter(p=>!p.folded && p.currentStackMilliBb===0).length,2);
  assert.equal(available(c),true,'folded Hero, two all-in opponents, pending river');
  const before=c.getState(), serialized=JSON.stringify(before);
  const result=randomizeHandPendingDraft({schemaVersion:HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,state:before,availableCards:c.getAvailableChanceCards(),seed:47});
  assert.equal(result.status,'available');
  assert.equal(result.target,'river');
  assert.equal(JSON.stringify(c.getState()),serialized,'randomization does not commit anything');
  assert.ok(!before.board.includes(result.cards[0]));
  assert.ok(c.dealBoardCards(result.cards));
  assert.deepEqual(c.getState().board.slice(0,4),before.board);
  assert.deepEqual(c.getState().actionHistory,before.actionHistory);
  assert.equal(available(c),false,'committed river cannot be rerandomized');
  const allIn=controller({},true);
  action(allIn,'all_in'); action(allIn,'call'); action(allIn,'call');
  assert.equal(allIn.getState().players[0].currentStackMilliBb,0);
  assert.equal(available(allIn),true,'all-in Hero');
  const terminal=controller({},true);
  action(terminal,'fold'); action(terminal,'fold');
  assert.equal(terminal.getState().terminal.isTerminal,true);
  assert.equal(available(terminal),false);
  assert.equal(randomizeHandPendingDraft({schemaVersion:HAND_PENDING_RANDOMIZATION_REQUEST_VERSION,state:terminal.getState(),availableCards:[],seed:1}).status,'unavailable');
});
