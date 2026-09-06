import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importHandHistory } from '../app/src/application/hand-history-import.mjs';
import { reconstructCanonicalHandReplaySource } from '../app/src/application/canonical-hand-replay-source.mjs';
import { projectHandImportStudy, readHandImportStudy, createHandReviewDecisionSaver } from '../app/src/application/hand-import-study.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createMemorySavedStudyDatabase, createSavedStudyOwnerRef } from '../app/src/saved-study-objects/index.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';
import { createCanonicalPreflopStateFromSelection, createRangeCalibrationApplication } from '../app/src/application/range-calibration-service.mjs';
import { createLocalOwnerRef, createRangeObservation } from '../app/src/personal-strategy/domain.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';

const selection = { environment: 'home', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  decisionFamily: 'preflop_rfi', actionAware: true, collectionBb: 0, anteType: 'none', anteBb: 0 };
const canonical = () => createCanonicalPreflopStateFromSelection(selection, { handClass: 'AKo' });
const input = value => ({ pokerState: value.state, heroPlayerId: value.heroPlayerId, chosenAction: { type: 'fold' } });

test('study reads selected existing Personal evidence without writing observed behavior or inventing frequencies', async () => {
  const memory = new Map();
  const application = createRangeCalibrationApplication({ database: createMemoryPersonalStrategyDatabase(),
    storage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) },
    ownerRef: createLocalOwnerRef('study-owner') });
  const bundle = await application.createProfile({ displayName: 'Study setup', description: '', modeNames: ['Usual'] });
  const profileId = bundle.profile.id, modeId = bundle.modes[0].id;
  const value = canonical();
  await application.saveWorkspaceSelection({ selectedProfileId: profileId, activeModeId: modeId, context: selection });
  await application.repository.saveRangeObservation(createRangeObservation({ id: 'intent', profileId, modeId,
    context: value.context, handClass: 'AKo', dominantAction: { type: 'raise' }, createdAt: '2026-09-01T00:00:00.000Z' }));
  const before = await application.repository.loadSnapshot();
  const facts = await readHandImportStudy(input(value), { application });
  assert.equal(facts.personalStatus, 'available');
  assert.equal(facts.actionTypeRelationship, 'different_action_type');
  assert.equal(facts.intendedAction, 'raise');
  assert.equal(facts.frequency, null);
  assert.equal(facts.normativeAssessment, 'unavailable');
  assert.deepEqual(facts.evidenceIds, ['intent']);
  assert.deepEqual(await application.repository.loadSnapshot(), before);
});

test('context mismatch fails closed and stale lifecycle cannot adopt personal evidence', async () => {
  const value = canonical();
  const other = createCanonicalPreflopStateFromSelection({ ...selection, effectiveStackBb: 50 }, { handClass: 'AKo' });
  assert.match(projectHandImportStudy({ ...input(value), scope: { profileId: 'p', modeId: 'm', context: other.context } }).reason, /does not match/);
  let current = true;
  const lifecycleScope = { assertCurrent() { if (!current) throw new Error('stale owner'); } };
  await assert.rejects(readHandImportStudy(input(value), { lifecycleScope,
    application: { async readWorkspace() { current = false; return {}; } } }), /stale owner/);
});

test('recorded rake remains incompatible with known no-rake Personal context and triggers no evidence read', async () => {
  const imported = await importHandHistory(await readFile(new URL('./fixtures/hand-history/HeroName.txt', import.meta.url), 'utf8'));
  assert.equal(imported.status, 'complete');
  const decision = imported.journal.decisions[0];
  const state = reconstructCanonicalHandReplaySource(imported.replaySource).frames[decision.occurrence.replayPoint.eventSequence].state;
  const facts = await readHandImportStudy({ pokerState: state, heroPlayerId: imported.heroPlayerId, chosenAction: decision.chosenAction },
    { application: { readWorkspace() { assert.fail('Unknown rake rules must not acquire Personal evidence'); } } });
  assert.match(facts.reason, /rake model/);
  assert.equal(facts.personalStatus, 'unavailable');
});

test('Review later and situational annotations repeat idempotently through the actual Saved service', async () => {
  const value = canonical();
  const application = createSavedStudyObjectApplication({ database: createMemorySavedStudyDatabase(), ownerRef: createSavedStudyOwnerRef('review-owner') });
  let creates = 0, ownerGeneration = 1;
  const saver = createHandReviewDecisionSaver({ saveReviewedDecisionSpot: input => { creates += 1; return application.saveReviewedDecisionSpot(input); },
    getById: application.getById, updateAnnotations: application.updateAnnotations, getOwnerGeneration: () => ownerGeneration });
  const decision = { canonicalHandId: value.state.handId, decisionId: 'decision-0', actionSequenceCount: value.state.actionHistory.length,
    decisionContext: deriveDecisionContextFromPokerState(value.state, value.heroPlayerId), rulesSnapshot: value.state.rulesSnapshot,
    sourceId: `${value.state.handId}:decision-0`, note: 'Keep my note', tags: ['existing'] };
  const first = await saver.save(decision, { reviewState: 'review_later' });
  const [second, third] = await Promise.all([saver.save(decision, { situational: true }), saver.save(decision, { reviewState: 'review_later' })]);
  const repeated = await saver.save(decision, { situational: true });
  assert.equal(creates, 1);
  assert.equal(first.object.id, repeated.object.id);
  assert.deepEqual(repeated.object.annotations.tags.map(tag => tag.key), ['existing', 'situational']);
  assert.equal(repeated.object.annotations.note, 'Keep my note');
  assert.equal(repeated.object.annotations.reviewState, 'review_later');
  assert.equal(repeated.object.revision, second.object.revision);
  assert.equal(third.object.revision, second.object.revision);
  const coldSaver = createHandReviewDecisionSaver({ saveReviewedDecisionSpot: input => { creates += 1; return application.saveReviewedDecisionSpot(input); },
    getById: application.getById, updateAnnotations: application.updateAnnotations, getOwnerGeneration: () => ownerGeneration });
  const coldRepeated = await coldSaver.save(decision, { situational: true });
  assert.equal(coldRepeated.object.id, first.object.id);
  assert.equal(coldRepeated.object.revision, repeated.object.revision);
  assert.equal(creates, 1);
  const queued = saver.save(decision, { reviewState: 'resolved' });
  ownerGeneration += 1;
  await assert.rejects(queued, /Stale/);
});
