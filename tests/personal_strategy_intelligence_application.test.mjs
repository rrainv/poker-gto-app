import test from 'node:test';
import assert from 'node:assert/strict';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { qualitativeEvidenceHeads } from '../app/src/personal-strategy/qualitative-evidence.mjs';
import { createPersonalRangeLanguageFacts, renderPersonalRangeComparison } from '../app/src/personal-strategy/range-language-facts.mjs';
import { choosePersonalTeachingNext, comparePersonalStrategyWithSource } from '../app/src/application/personal-strategy-intelligence.mjs';

function harness({ lifecycleScope = null, ownerRef = null } = {}) {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)) };
  const database = createMemoryPersonalStrategyDatabase();
  let next = 0, tick = 0;
  const make = (options = {}) => createRangeCalibrationApplication({ storage, database,
    clock: () => new Date(Date.parse('2026-09-05T12:00:00Z') + tick++ * 1000),
    idFactory: (prefix) => `${prefix}-application-${++next}`, lifecycleScope, ownerRef, ...options });
  return { make, database, storage, app: make() };
}
const selection = { environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
  decisionFamily: 'preflop_rfi', actionAware: true, collectionBb: 0.25, anteType: 'none', anteBb: 0 };
async function configured(options = {}) {
  const h = harness(options);
  const bundle = await h.app.createProfile({ displayName: 'Tuesday private game, 100bb', modeNames: ['Usual'],
    setupAssumptions: { ...selection, description: 'User-defined poker environment' } });
  const scope = { profileId: bundle.profile.id, modeId: bundle.modes[0].id, context: createContextFromSelection(selection) };
  return { ...h, bundle, scope };
}

test('application creates arbitrary custom setups and more than three Approaches, with persistent names and setup assumptions', async () => {
  const { app, make, bundle } = await configured();
  for (const displayName of ['Against Alex', 'Deep table', 'Passive table', 'Experiment', 'Friday plan']) {
    await app.addApproach(bundle.profile.id, { displayName });
  }
  await app.createProfile({ displayName: 'MTT short-stack', modeNames: ['Early', 'Bubble', 'Final table', 'Satellite'],
    setupAssumptions: { format: 'tournament', stack: '20bb', rake: 'user stated' } });
  const loaded = await make().readWorkspace();
  assert.equal(loaded.profiles.length, 2);
  const first = loaded.profiles.find((p) => p.profile.id === bundle.profile.id);
  assert.equal(first.modes.length, 6);
  assert.equal(first.profile.modeIds.length, 6);
  assert.equal(first.profile.setupAssumptions.collectionBb, 0.25);
  assert.ok(first.modes.every((m) => !('styleValue' in m) && !('interpolationCoordinate' in m)));
  const short = loaded.profiles.find((p) => p.profile.displayName === 'MTT short-stack');
  assert.equal(short.modes.length, 4);
  assert.equal(short.profile.setupAssumptions.format, 'tournament');
});

test('setup metadata edits and one Approach rename preserve unrelated Approach versions', async () => {
  const { app, bundle } = await configured();
  const added = await app.addApproach(bundle.profile.id, { displayName: 'Independent plan' });
  await app.updateProfileConfiguration(bundle.profile.id, { displayName: 'Renamed setup', description: '',
    setupAssumptions: { format: 'cash', defaultContext: selection } });
  let entry = (await app.readWorkspace()).profiles[0];
  assert.deepEqual(entry.modes.map((mode) => mode.approachVersion), [1, 1]);
  await app.updateProfileConfiguration(bundle.profile.id, { displayName: entry.profile.displayName,
    description: '', modeNames: ['Renamed intention', 'Independent plan'] });
  entry = (await app.readWorkspace()).profiles[0];
  assert.equal(entry.modes[0].approachVersion, 2);
  assert.equal(entry.modes[0].versionHistory[0].displayName, 'Usual');
  assert.equal(entry.modes.find((mode) => mode.id === added.id).approachVersion, 1);
});

test('five-question quick RFI loop preserves dominant actions and stops with an incomplete initial understanding', async () => {
  const { app, scope } = await configured();
  let state = await app.startOrResumeSession({ selectedProfileId: scope.profileId, activeModeId: scope.modeId, context: selection, intent: 'quick' });
  const hands = [];
  for (let i = 0; i < 5; i += 1) {
    assert.ok(state.prompt, `Question ${i + 1} remains available`);
    hands.push(state.prompt.handClass);
    state = await app.answerCalibrationQuestion(state, { actionType: i % 2 ? 'fold' : 'raise' });
    assert.equal(state.acceptedObservation.hasExplicitFrequencies, false);
    assert.equal(state.acceptedObservation.frequencies, null);
  }
  assert.equal(new Set(hands).size, 5);
  assert.ok(hands.some((h) => h.endsWith('s')) && hands.some((h) => h.endsWith('o')) && hands.some((h) => h.length === 2), `Broad structural families: ${hands}`);
  assert.equal(state.prompt, null);
  const evidence = await app.getEvidenceView(scope);
  assert.equal(evidence.points.filter((p) => p.resolution === 'direct_dominant').length, 5);
  assert.ok(evidence.points.filter((p) => p.resolution === 'unanswered').length >= 164);
  assert.equal(createPersonalRangeLanguageFacts({ evidenceView: evidence }).regions.some((r) => r.quantitative), false);
});

test('qualitative preview is ephemeral; confirmation, grouped correction and reload preserve immutable history', async () => {
  const { app, make, scope } = await configured();
  const originalText = "I defend wide but I don't like weak offsuit hands.";
  const preview = await app.previewQualitativeIntent(scope, { text: originalText, language: 'en' });
  assert.equal((await app.getQualitativeEvidence(scope)).length, 0);
  assert.equal((await make().getQualitativeEvidence(scope)).length, 0);
  assert.equal(preview.followupTopic, 'offsuit_boundary');
  assert.ok(preview.propositions.every((p) => p.frequencies === null && p.action === null));
  const confirmed = await app.confirmQualitativeIntent(preview);
  assert.equal(confirmed.confirmation.state, 'confirmed');
  assert.equal(confirmed.provenance.source, 'user_intent');
  await assert.rejects(app.confirmQualitativeIntent(preview), /stale|preview|current/i);
  const correction = await app.previewQualitativeIntent(scope, { text: 'Only against small opens; weak offsuit hands remain unresolved.',
    language: 'en', scopeDescription: 'Against small opens only', supersedesEvidenceIds: [confirmed.id] });
  assert.equal((await app.getQualitativeEvidence(scope)).length, 1);
  const updated = await app.confirmQualitativeIntent(correction);
  const history = await make().getQualitativeEvidence(scope);
  assert.equal(history.length, 2);
  assert.equal(history.find((r) => r.id === confirmed.id).originalWording, originalText);
  assert.deepEqual(updated.supersedesEvidenceIds, [confirmed.id]);
  assert.ok(updated.correctionGroupId);
  assert.deepEqual(qualitativeEvidenceHeads(history).map((r) => r.id), [updated.id]);
  assert.equal((await app.getEvidenceView(scope)).summary.directlyAnsweredHandCount, 0);
});

test('renamed Approach or modified Setup invalidates pending interpretation previews', async () => {
  const { app, bundle, scope } = await configured();
  const preview = await app.previewQualitativeIntent(scope, { text: 'I prefer suited hands' });
  await app.updateProfileConfiguration(bundle.profile.id, { displayName: bundle.profile.displayName, modeNames: ['Revised approach'] });
  await assert.rejects(app.confirmQualitativeIntent(preview), /stale|preview|current/i);
  const next = await app.previewQualitativeIntent(scope, { text: 'I prefer pairs' });
  await app.updateProfileConfiguration(bundle.profile.id, { displayName: bundle.profile.displayName, setupAssumptions: { ...selection, effectiveStackBb: 200 } });
  await assert.rejects(app.confirmQualitativeIntent(next), /stale|preview|current/i);
  assert.equal((await app.getQualitativeEvidence(scope)).length, 0);
});

test('two corrections to the same head cannot silently overwrite one another', async () => {
  const { app, scope } = await configured();
  const original = await app.confirmQualitativeIntent(await app.previewQualitativeIntent(scope, { text: 'Usually raise' }));
  const one = await app.previewQualitativeIntent(scope, { text: 'Usually call', supersedesEvidenceIds: [original.id] });
  const two = await app.previewQualitativeIntent(scope, { text: 'Usually fold', supersedesEvidenceIds: [original.id] });
  const accepted = await app.confirmQualitativeIntent(one);
  await assert.rejects(app.confirmQualitativeIntent(two), /current|changed|stale/i);
  const history = await app.getQualitativeEvidence(scope);
  assert.deepEqual(qualitativeEvidenceHeads(history).map((r) => r.id), [accepted.id]);
  assert.equal(history.length, 2);
});

test('opaque drafts cannot cross application instances and owner invalidation blocks all pending writes', async () => {
  let current = true;
  const lifecycleScope = { assertCurrent() { if (!current) throw new Error('Owner generation changed'); } };
  const { app, make, scope } = await configured({ lifecycleScope });
  const draft = await app.previewQualitativeIntent(scope, { text: 'I do not bluff this player' });
  await assert.rejects(make().confirmQualitativeIntent(draft), /stale|preview|current/i);
  const cloned = structuredClone(draft);
  await assert.rejects(app.confirmQualitativeIntent(cloned), /stale|preview|current/i);
  current = false;
  assert.throws(() => app.confirmQualitativeIntent(draft), /Owner generation/);
  const reloaded = make({ lifecycleScope: null });
  assert.equal((await reloaded.getQualitativeEvidence(scope)).length, 0);
});

test('Teach Next projects canonical mapping order without a second selector or poker-action recommendation', async () => {
  const { app, scope } = await configured();
  for (const focus of ['offsuit_boundary', 'pair_boundary', null]) {
    const mapping = await app.getRangeMappingProjection(scope, { focus });
    const next = choosePersonalTeachingNext({ candidates: mapping.candidates, userTopic: focus });
    assert.equal(next.candidate, mapping.candidates[0]);
    if (focus === 'offsuit_boundary') assert.ok(next.candidate.handClass.endsWith('o'));
    if (focus === 'pair_boundary') assert.equal(next.candidate.handClass.length, 2);
    assert.equal('frequencies' in next, false);
    assert.doesNotMatch(next.reasonKey, /optimal information|EV|GTO|AA [|]/);
  }
  assert.equal(choosePersonalTeachingNext({ candidates: [{ handClass: 'K9s', questionKind: 'conflict_resolution' }] }).action, 'inspect');
});

test('actual comparison application uses custom canonical v2 states and shared baseline truth without changing intended evidence', async () => {
  const { app, scope } = await configured();
  let state = await app.startOrResumeSession({ selectedProfileId: scope.profileId, activeModeId: scope.modeId, context: selection, intent: 'quick', forcedHandClass: 'AA' });
  state = await app.answerCalibrationQuestion(state, { actionType: 'fold' });
  const before = await app.repository.loadSnapshot();
  const facts = createPersonalRangeLanguageFacts({ evidenceView: await app.getEvidenceView(scope) });
  const comparison = await comparePersonalStrategyWithSource({ facts, selection, scope });
  assert.equal(comparison.compatible, true);
  const pairs = comparison.regions.find((r) => r.id === 'pairs');
  assert.equal(pairs.permission.comparison, true);
  assert.equal(pairs.permission.normative, false);
  assert.match(renderPersonalRangeComparison(comparison).join(' '), /heuristic baseline/);
  assert.deepEqual(await app.repository.loadSnapshot(), before);
});

test('source comparison invalidates a delayed result when owner/context generation changes', async () => {
  const { app, scope } = await configured();
  const facts = createPersonalRangeLanguageFacts({ evidenceView: await app.getEvidenceView(scope) });
  let resolveCalls = 0, active = true;
  const provider = { async resolve() { resolveCalls += 1; active = false; return null; } };
  await assert.rejects(comparePersonalStrategyWithSource({ facts, selection, scope, provider,
    assertCurrent() { if (!active) throw new Error('Comparison scope changed'); } }), /scope changed/);
  assert.equal(resolveCalls, 1);
  assert.equal((await app.getQualitativeEvidence(scope)).length, 0);
});
