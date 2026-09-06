import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { importHandHistory, fingerprintHandHistory } from '../app/src/application/hand-history-import.mjs';
import { parsePokerStarsHistory } from '../app/src/application/hand-history-pokerstars.mjs';
import { reconstructCanonicalHandReplaySource, validateCanonicalHandReplaySource } from '../app/src/application/canonical-hand-replay-source.mjs';
import { createHandImportController } from '../app/src/application/hand-history-import-bootstrap.mjs';
import { importDiagnosticLanguage } from '../app/src/application/hand-import-language.mjs';
import { createSavedHandSnapshot, validateSavedHandSnapshot } from '../app/src/saved-study-objects/index.mjs';
import { installPlaybookStateSourceBridge } from '../app/src/application/playbook-mode-bootstrap.mjs';
import { createHandReviewProjector } from '../app/src/application/hand-review.mjs';
import { createSavedStudyObjectApplication } from '../app/src/application/saved-study-object-service.mjs';
import { createSavedStudyObjectSourceController } from '../app/src/application/saved-study-object-source-controller.mjs';
import { createMemorySavedStudyDatabase, createSavedStudyOwnerRef } from '../app/src/saved-study-objects/index.mjs';
const fixture = name => readFileSync(new URL(`./fixtures/hand-history/${name}.txt`, import.meta.url), 'utf8');
const source = fixture('HeroName');
// Public spectator histories lack Dealt-to. These explicitly labelled test derivatives
// supply Hero cards to exercise complete reconstruction, never parser defaults.
const withHero = (name, hero, cards) => fixture(name).replace('*** HOLE CARDS ***', `*** HOLE CARDS ***\nDealt to ${hero} [${cards}]`);
const basic = withHero('BasicHand', 'H6U5r', 'Js Jd');
const allin = withHero('AllInHandWithShowdown', 'matze1987', '8h 8c');
const fold = withHero('FoldedPreflop', 'idirabotai', 'As Kd');
const reraise = withHero('3BetHand', 'H6U5r', 'As Kd');
const sidepot = withHero('SidePot', 'T_Leroy', 'Kc Ks');

test('public PokerStars cash fixture reconstructs exact EUR settlement and canonical Hero journal', async () => {
  const r = await importHandHistory(source);
  assert.equal(r.status, 'complete', JSON.stringify(r.diagnostics));
  const state = r.pokerState;
  assert.equal(state.schemaVersion, 'poker-state/v3');
  assert.equal(state.recordedSettlement.grossPotMilliBb, 18500);
  assert.equal(state.recordedSettlement.rakeMilliBb, 1200);
  assert.equal(state.recordedSettlement.netAwardedMilliBb, 17300);
  assert.equal(r.journal.decisions.length, 1);
  assert.equal(r.journal.decisions[0].chosenAction.type, 'fold');
  assert.deepEqual(reconstructCanonicalHandReplaySource(r.replaySource).finalState, state);
  assert.deepEqual(await importHandHistory(source), r);
  assert.deepEqual(parsePokerStarsHistory(source), parsePokerStarsHistory(source));
  assert.equal(await fingerprintHandHistory(source), r.importProvenance.rawTextFingerprint);
  assert.notEqual(await fingerprintHandHistory(source + '\n'), r.importProvenance.rawTextFingerprint);
});

for (const [name, raw] of Object.entries({ fold, basic, allin, reraise })) {
  test(`canonical replay, exact sizing and card visibility: ${name}`, async () => {
    const r = await importHandHistory(raw);
    assert.equal(r.status, 'complete', JSON.stringify(r.diagnostics));
    const replay = reconstructCanonicalHandReplaySource(r.replaySource);
    assert.deepEqual(replay.finalState, r.pokerState);
    assert.ok(replay.frames.filter(f => f.operation === 'deal_hole_observed').every(f => f.state.players.filter(p => Array.isArray(p.holeCards)).length === 1));
    for (const event of r.parsed.events.filter(e => e.type === 'raise')) {
      const record = r.pokerState.actionHistory.find(a => a.sequence === r.parsed.events.filter(e => e.kind === 'action').indexOf(event));
      assert.equal(record.streetContributionAfterMilliBb, Math.round(Number(event.amount.replace(/[$€£]/, '')) / Number(r.parsed.blinds.big.replace(/[$€£]/, '')) * 1000));
    }
    const p = structuredClone(r.replaySource); p.events.at(-1).payload.evidence.rakeMilliBb++;
    assert.throws(() => validateCanonicalHandReplaySource(p));
  });
}

test('missing, malformed, ambiguous, duplicate and unsupported evidence fails closed', async () => {
  const cases = [
    ['', 'input_size'], [fixture('BasicHand'), 'missing_hero'],
    [source.replace('Rake €2.40', 'Rake unknown'), 'unsupported_line'],
    [source.replace('[4s 7h]', '[6d 7h]'), 'duplicate_or_invalid_cards'],
    [source.replace('raises €4 to €6', 'raises €5 to €6'), 'raise_amount'],
    [basic.replace('calls $0.22', 'calls $0.23'), 'call_amount'],
    [source.replace('Player6: raises €4 to €6', 'Player6: posts straddle €4'), 'unsupported_line'],
    [source.replace('Seat 2: PS_Hero (€198 in chips)', 'Seat 2: PS_Hero (unknown in chips)'), 'unsupported_line'],
    [source.replace('Player4: folds', 'Player5: folds'), 'canonical_legality'],
    [source.replace('Player6: shows [As 9d]', 'Player6: shows [As As]'), 'duplicate_or_invalid_cards'],
    [source + '\n' + source, 'format_or_multiple_hands'],
    [source.replace('Hold\'em No Limit', 'Omaha Pot Limit'), 'format_or_multiple_hands'],
    [source.replace('Rake €2.40', 'Rake €2.41'), 'canonical_legality'],
    [sidepot, 'missing_showdown_cards'],
    [source.replace('PS_Hero (small blind) folded before Flop', 'PS_Hero (small blind) folded on the Turn'), 'summary_action'],
  ];
  for (const [raw, code] of cases) {
    const result = await importHandHistory(raw);
    assert.equal(result.status, 'partial', code);
    assert.equal(result.pokerState, null, code);
    assert.equal(result.replaySource, null, code);
    assert.ok(result.diagnostics.some(d => d.code === code), `${code}: ${JSON.stringify(result.diagnostics)}`);
    for (const d of result.diagnostics) assert.equal(importDiagnosticLanguage(d).envelope.facts.code, d.code);
  }
});

test('Saved v3 roundtrip retains provenance, validates strict fields and cold shared Review', async () => {
  const r = await importHandHistory(basic);
  const payload = createSavedHandSnapshot(r);
  const cold = JSON.parse(JSON.stringify(payload)); validateSavedHandSnapshot(cold);
  assert.equal(cold.schemaVersion, 'saved-hand-snapshot/v3');
  assert.equal(cold.importProvenance.rawTextRetention, 'not_stored');
  assert.ok(!JSON.stringify(cold).includes('*** HOLE CARDS ***'));
  for (const field of ['canonicalHandId', 'rawTextFingerprint', 'reconstructionStatus']) {
    const bad = structuredClone(cold); bad.importProvenance[field] = 'invalid'; assert.throws(() => validateSavedHandSnapshot(bad));
  }
  const window = { CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, dispatchEvent() {} };
  const bridge = installPlaybookStateSourceBridge(window);
  bridge.openSavedHand({ objectId: 'saved-fixture', ...cold });
  assert.deepEqual(bridge.getHeroDecisionJournal(), r.journal);
  const model = createHandReviewProjector().project({ source: 'canonical_hand', handId: r.pokerState.handId,
    heroPlayerId: r.heroPlayerId, decisions: bridge.getHeroDecisionJournal().decisions,
    completedHandResult: bridge.getCompletedHandResult(), replayProjection: bridge.createReplayProjectionViewModel() });
  assert.equal(model.decisions.length, r.journal.decisions.length);
  assert.ok(model.decisions.every(d => d.truth.state === 'unassessed'));
  assert.deepEqual(bridge.getImportProvenance(), cold.importProvenance);
});

test('owner changes, typing and cancellation fence slow file/hash results before adoption', async () => {
  let owner = 1, adopted = 0, release;
  const controller = createHandImportController({ captureScope: async () => { const id = owner; return { assertCurrent() { if (id !== owner) throw new Error('owner_changed'); } }; },
    parse: async () => ({ status: 'complete' }), adopt: () => adopted++ });
  const slow = controller.preview(() => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setTimeout(resolve, 0)); owner++; release(source);
  await assert.rejects(slow); assert.throws(() => controller.open()); assert.equal(adopted, 0);
  await controller.preview(() => source); controller.reset(); assert.throws(() => controller.open());
  await controller.preview(() => source); owner++; assert.throws(() => controller.open()); assert.equal(adopted, 0);
});

test('owner-local Saved repository and source controller deduplicate imports across reload and preserve export', async () => {
  const r = await importHandHistory(source);
  const db = createMemorySavedStudyDatabase(), ownerRef = createSavedStudyOwnerRef('import-owner');
  const application = createSavedStudyObjectApplication({ database: db, ownerRef });
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const bridge = { getState: () => r.pokerState, getHeroPlayerId: () => r.heroPlayerId,
    createCanonicalHandReplaySource: () => r.replaySource, getCanonicalHandSourceId: () => r.pokerState.handId,
    getImportProvenance: () => r.importProvenance, createReplayProjectionViewModel: () => ({ readOnly: true }) };
  const controller = () => createSavedStudyObjectSourceController({ application, storage, getPlaybookBridge: () => bridge });
  const saved = await controller().saveCurrent({ mode: 'hand' });
  await application.updateAnnotations(saved.object.id, { reviewState: 'review_later', tags: ['situational'] });
  const again = await controller().saveCurrent({ mode: 'hand' });
  assert.equal(again.created, false); assert.equal(again.object.id, saved.object.id);
  const reopened = createSavedStudyObjectApplication({ database: db, ownerRef });
  const cold = await reopened.getById(saved.object.id);
  assert.deepEqual(cold.payload.importProvenance, r.importProvenance);
  assert.equal(cold.annotations.reviewState, 'review_later');
  assert.deepEqual(reconstructCanonicalHandReplaySource(cold.payload.replaySource).finalState, r.pokerState);
  const exported = await reopened.exportLibrary(); assert.ok(JSON.stringify(exported).includes('hand-import-provenance/v1'));
  const wrongOwner = createSavedStudyObjectApplication({ database: db, ownerRef: createSavedStudyOwnerRef('other-import-owner') });
  await assert.rejects(wrongOwner.getById(saved.object.id), error => error.code === 'owner_mismatch');
  const decision = r.journal.decisions[0];
  const spot = await application.saveReviewedDecisionSpot({ decisionId: decision.decisionId, canonicalHandId: r.pokerState.handId,
    actionSequenceCount: decision.occurrence.replayPoint.actionSequence, decisionContext: decision.decisionContext,
    rulesSnapshot: decision.rulesSnapshot, savedHandObjectId: saved.object.id, reviewState: 'review_later' });
  assert.equal(spot.object.payload.handReference.savedHandObjectId, saved.object.id);
});

test('imported Review keeps heuristic truth, opponent abstention and provider invocation counts', async () => {
  const r = await importHandHistory(basic); let calls = 0;
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const projector = createHandReviewProjector({ resolveStrategy: context => { calls++; return provider.resolve(context); } });
  const input = { source: 'canonical_hand', handId: r.pokerState.handId, heroPlayerId: r.heroPlayerId,
    decisions: r.journal.decisions, completedHandResult: r.completedHandResult };
  const model = projector.project(input);
  for (const decision of model.decisions) {
    assert.ok(['heuristic_comparison', 'unassessed'].includes(decision.truth.state));
    assert.equal(decision.truth.claimPolicy.claims?.normative_grading ?? false, false);
    assert.equal(decision.exploitReview?.roles?.opponentPolicy?.availability ?? 'unavailable', 'unavailable');
  }
  for (let i = 0; i < 10; i++) projector.project({ ...input, selectedDecisionIndex: i % model.decisions.length, replayProjection: { selectedFrameIndex: i } });
  assert.equal(calls, r.journal.decisions.length);
});

test('Saved capture remains bound to the clicked Hand while another source opens', async () => {
  const first = await importHandHistory(source), second = await importHandHistory(fold); let current = first;
  const application = createSavedStudyObjectApplication({ database: createMemorySavedStudyDatabase(), ownerRef: createSavedStudyOwnerRef('source-race-owner') });
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const bridge = { getState: () => current.pokerState, getHeroPlayerId: () => current.heroPlayerId,
    createCanonicalHandReplaySource: () => current.replaySource, getCanonicalHandSourceId: () => current.pokerState.handId,
    getImportProvenance: () => current.importProvenance };
  const controller = createSavedStudyObjectSourceController({ application, storage, getPlaybookBridge: () => bridge });
  const saving = controller.saveCurrent({ mode: 'hand' }); current = second;
  const saved = await saving;
  assert.equal(saved.object.payload.pokerState.handId, first.pokerState.handId);
  assert.deepEqual(saved.object.payload.importProvenance, first.importProvenance);
});

test('import errors and review messaging have explicit EN/RU/HE coverage and RTL-safe source entry', () => {
  const browser = {};
  vm.runInNewContext(readFileSync(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'), { window: browser });
  const catalog = browser.riverlineTutorialTranslations;
  const keys = ['Import hand history', 'Open in Review', 'Gross pot', 'Recorded rake', 'Awarded', 'Import evidence',
    'Inspect personal intent', 'Mark as situational', 'Recorded settlement', 'Imported decision practice has no compatible Training request.'];
  for (const code of ['input_size', 'missing_hero', 'missing_settlement', 'canonical_legality', 'unsupported_line', 'duplicate_or_invalid_cards', 'money_precision', 'other']) keys.push(importDiagnosticLanguage({ code, line: 1, classification: 'missing' }).messageKey);
  for (const key of keys) for (const language of ['en', 'ru', 'he']) assert.ok(catalog[language][key], `${language}: ${key}`);
  const ui = readFileSync(new URL('../app/src/application/hand-history-import-bootstrap.mjs', import.meta.url), 'utf8');
  assert.match(ui, /input\.dir = 'ltr'/); assert.match(ui, /showModal\(\)/); assert.match(ui, /role', 'status'/);
  assert.ok(!ui.includes('innerHTML'));
});
