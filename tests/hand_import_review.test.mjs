import test from 'node:test';
import assert from 'node:assert/strict';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { createHandReviewProjector } from '../app/src/application/hand-review.mjs';

function browser() {
  return { CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent() {} };
}
function completedSource() {
  const bridge = installPlaybookStateSourceBridge(browser());
  bridge.setMode('hand', { tableSize: 2, rakeMode: 'off', straddleBb: 0 });
  bridge.initializeHand({ tableSize: 2, gameMode: 'home', stackBb: 100, stackMode: 'hero',
    heroSeat: 0, buttonSeat: 0, anteType: 'none', anteBb: 0, straddleBb: 0 });
  bridge.dealObservedHoleCards({ 'seat-0': ['As', 'Kh'] });
  bridge.applyAction('fold');
  return bridge;
}
function input(bridge) {
  return { pokerState: bridge.getState(), heroPlayerId: bridge.getHeroPlayerId(),
    replaySource: bridge.createCanonicalHandReplaySource(), importProvenance: {
      schemaVersion: 'hand-import-provenance/v1', canonicalHandId: bridge.getState().handId,
      sourceFormat: 'pokerstars-english-nlhe-cash/v1', sourceHandId: '123', rawTextRetention: 'not_stored',
    } };
}
function review(bridge) {
  const journal = bridge.getHeroDecisionJournal();
  return createHandReviewProjector().project({ source: 'canonical_hand', handId: journal.handId,
    heroPlayerId: bridge.getHeroPlayerId(), decisions: journal.decisions,
    completedHandResult: bridge.getCompletedHandResult(), replayProjection: bridge.createReplayProjectionViewModel() });
}

test('imported and cold Saved Hand reuse the canonical Hero journal and shared Review', () => {
  const original = completedSource(), source = input(original);
  const bridge = installPlaybookStateSourceBridge(browser());
  const opened = bridge.openImportedHand(source);
  assert.equal(opened.viewerContext.kind, 'imported_hand');
  assert.equal(opened.viewerContext.objectId, null);
  assert.equal(opened.readOnly, true);
  assert.deepEqual(bridge.getHeroDecisionJournal(), original.getHeroDecisionJournal());
  assert.deepEqual(bridge.getCompletedHandResult(), original.getCompletedHandResult());
  assert.deepEqual(bridge.createCanonicalHandReplaySource(), source.replaySource);
  assert.equal(bridge.getCanonicalHandSourceId(), source.pokerState.handId);
  const beforeSave = review(bridge);
  const selected = beforeSave.selectedDecision;
  assert.equal(selected.durable.decisionContext.derivation.source, 'canonical_hand');
  assert.equal(bridge.applyAction('call'), null, 'read-only import cannot mutate the Hand');

  bridge.closeSavedHand();
  assert.equal(bridge.getImportProvenance(), null);
  assert.equal(bridge.getHeroDecisionJournal(), null);
  bridge.openSavedHand({ ...source, objectId: 'saved-import' });
  assert.deepEqual(bridge.getHeroDecisionJournal(), original.getHeroDecisionJournal());
  assert.deepEqual(review(bridge).selectedDecision, selected);
  assert.deepEqual(bridge.getImportProvenance(), source.importProvenance);
  assert.equal(bridge.createCanonicalHandReplaySource(), null, 'Saved view does not create another save source');
});

test('rejected imported snapshot leaves the prior viewer and provenance intact', () => {
  const source = input(completedSource()), bridge = installPlaybookStateSourceBridge(browser());
  bridge.openImportedHand(source);
  const badState = structuredClone(source.pokerState);
  badState.handId = 'different';
  assert.throws(() => bridge.openImportedHand({ ...source, pokerState: badState }), /reconstruct/);
  assert.equal(bridge.getState().handId, source.pokerState.handId);
  const exposed = bridge.getImportProvenance();
  exposed.sourceHandId = 'changed';
  assert.equal(bridge.getImportProvenance().sourceHandId, '123');
});
