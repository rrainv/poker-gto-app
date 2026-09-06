import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { exactContext, syntheticPack } from './fixtures/reference-pack-synthetic.mjs';
import { attachReferencePackIntegrity } from '../app/src/application/reference-pack-v1.mjs';
import { createReferenceCoverageMap, queryReferenceCoverage, selectedReferenceFacts } from '../app/src/application/reference-coverage.mjs';
import { validateReferenceSourceIntake, importPrivateReferenceSource, createSourceHealthLedger,
  REFERENCE_SOURCE_MAX_BYTES } from '../app/src/application/reference-source-intake.mjs';
import { createStrategySourceAcceptanceRegistry } from '../app/src/application/strategy-source-authority.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveStrategyClaimPolicy, STRATEGY_CLAIMS } from '../app/src/application/strategy-claim-policy.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { projectStrategyTruth, historicalStrategyTruth } from '../app/src/application/strategy-truth.mjs';
import { evaluateTrainingAnswer } from '../app/src/application/training-answer-evaluation.mjs';
import { createTrainingStrategyEvidence } from '../app/src/training-memory/domain.mjs';
import { createAnalysisExplanation } from '../app/src/application/analysis-explanation.mjs';
import { referenceCoveragePresentation, REFERENCE_COVERAGE_COPY } from '../app/src/application/reference-source-language.mjs';

function envelope() {
  return { schemaVersion: 'reference-source-intake/v1', sourceClass: 'synthetic_benchmark',
    visibility: 'private_local', displayName: 'Synthetic inspection fixture',
    localUse: { status: 'permitted', evidence: 'Riverline-owned synthetic test data only' }, pack: syntheticPack() };
}
async function publicIntake() {
  const raw = envelope(); raw.visibility = 'redistributable';
  return validateReferenceSourceIntake(raw);
}
function registry(intake, changes = {}) {
  const d = intake.pack.manifest.sourceDescriptor;
  return createStrategySourceAcceptanceRegistry([{ sourceId: d.id, allowedFamily: d.family,
    acceptedAuthority: d.authority, acceptedVersion: d.version, acceptedFingerprint: intake.fingerprint,
    acceptedCapabilities: intake.pack.manifest.capabilities, acceptedCoverageCeiling: 'exact',
    acceptedCoverageIdentity: intake.coverage.nodes[0].nodeIdentity,
    acceptedClaimClasses: Object.values(STRATEGY_CLAIMS), validationStatus: 'synthetic_test_only',
    independentValidationStatus: 'not_reviewed', acceptanceDecisionId: 'synthetic-review-only', ...changes }]);
}
function provider(intake, acceptance = registry(intake)) {
  return createStrategyProvider({ referenceSourceIntake: intake, sourceAcceptanceRegistry: acceptance,
    allowTestReferencePack: true, fallbackResolver: resolveHeuristicStrategy });
}
const canonical = (v) => v && typeof v === 'object' ? Array.isArray(v)
  ? `[${v.map(canonical).join(',')}]` : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);

test('intake SHA-256 binds all bytes of semantic data, identities, rights and exact coverage', async () => {
  const raw = envelope(); const intake = await validateReferenceSourceIntake(raw);
  assert.equal(intake.fingerprint, `sha256:${createHash('sha256').update(canonical(raw)).digest('hex')}`);
  assert.equal(intake.coverage.nodes.length, 1);
  assert.equal(intake.coverage.nodes[0].handClasses.length, 169);
  assert.equal(intake.coverage.nodes[0].effectiveStackSemantics, 'chips_behind_at_decision');
  for (const mutate of [r => r.pack.manifest.sourceDescriptor.version += '.2',
    r => r.pack.manifest.sourceDescriptor.id += '.2', r => r.pack.manifest.identity.packVersion += '.2',
    r => r.pack.manifest.source.license.name += ' revised', r => r.localUse.status = 'unknown',
    r => r.pack.manifest.gameAssumptions.startingStackBb = 101,
    r => { r.pack.representation.rows[0].actions[0].probability += 0.01; r.pack.representation.rows[0].actions[1].probability -= 0.01; }]) {
    const changed = envelope(); mutate(changed); changed.pack = attachReferencePackIntegrity(changed.pack);
    assert.notEqual((await validateReferenceSourceIntake(changed)).fingerprint, intake.fingerprint);
  }
  raw.displayName = 'mutated'; assert.equal(intake.displayName, 'Synthetic inspection fixture');
  assert.ok(Object.isFrozen(intake.coverage.nodes[0]));
});

test('coverage delegates exact matching and never substitutes neighboring stacks, sizes, rake or cards', () => {
  const pack = syntheticPack();
  const map = createReferenceCoverageMap(pack);
  assert.equal(map.summary.postflopNodes, 0);
  assert.equal(queryReferenceCoverage(pack, exactContext()).state, 'exact');
  for (const mutate of [c => c.startingStackBb = 75, c => c.facingSizeBb = 3,
    c => c.heroPosition = 'SB', c => c.street = 'flop', c => c.deadCards = ['2c'],
    c => c.board = ['2c', '3d', '4h'], c => c.gameRules.definition.collectionPolicy = { type: 'unknown' }]) {
    const dc = structuredClone(exactContext()); mutate(dc);
    assert.equal(queryReferenceCoverage(pack, dc).state, 'incompatible');
  }
  assert.equal(queryReferenceCoverage(pack, null).state, 'unavailable');
  const lossy = structuredClone(exactContext()); lossy.derivation.source = 'scenario';
  assert.equal(queryReferenceCoverage(pack, lossy).state, 'unavailable');
});

test('manifest declarations, copied validation tokens and forged registries cannot self-authorize', async () => {
  const intake = await publicIntake();
  const unaccepted = provider(intake, null).resolve(exactContext());
  assert.equal(projectStrategyTruth({ strategyResult: unaccepted }).claims.reference, false);
  assert.equal(resolveStrategyClaimPolicy(unaccepted).claims.exact_frequencies, false);
  assert.throws(() => provider(structuredClone(intake)), /validated source intake/);
  const forged = provider(intake, { acceptanceFor: () => ({ acceptedAuthority: 'validated_reference',
    acceptedCoverageIdentity: intake.coverage.nodes[0].nodeIdentity }) }).resolve(exactContext());
  assert.equal(resolveStrategyClaimPolicy(forged).authority, 'exploratory');
  const raw = envelope(); raw.accepted = true;
  await assert.rejects(validateReferenceSourceIntake(raw), /fields/);
});

test('acceptance binds SHA-256, version, exact coverage and claim ceiling; assessment remains separate', async () => {
  const intake = await publicIntake();
  const resolved = provider(intake).resolve(exactContext());
  assert.equal(resolved.provenance.contentHash, intake.fingerprint);
  assert.equal(resolveStrategyClaimPolicy(resolved).claims.exact_frequencies, true);
  assert.equal(resolveStrategyClaimPolicy(resolved).claims.normative_grading, false);
  assert.equal(selectedReferenceFacts({ ...resolved, provenance: null, details: null },
    resolveStrategyClaimPolicy(resolved)).state, 'unavailable');
  for (const changes of [{ acceptedVersion: 'wrong' }, { acceptedFingerprint: `sha256:${'0'.repeat(64)}` },
    { acceptedCoverageIdentity: `sha256:${'0'.repeat(64)}` }]) {
    assert.equal(resolveStrategyClaimPolicy(provider(intake, registry(intake, changes)).resolve(exactContext())).claims.exact_frequencies, false);
  }
  const limited = provider(intake, registry(intake, { acceptedClaimClasses: ['strategy_presentation'] })).resolve(exactContext());
  const policy = resolveStrategyClaimPolicy(limited);
  assert.equal(policy.claims.exact_frequencies, false); assert.equal(policy.claims.reference_match, false);
  assert.equal(policy.trainingSemantics, 'unavailable');
  assert.equal(projectStrategyTruth({ strategyResult: limited }).claims.reference, false);
  const denied = provider(intake, registry(intake, { acceptedClaimClasses: [] })).resolve(exactContext());
  assert.equal(projectStrategyTruth({ strategyResult: denied }).state, 'unassessed');
  assert.equal(referenceCoveragePresentation(projectStrategyTruth({ strategyResult: denied }).selectedReference).key, 'restricted');
  assert.throws(() => registry(intake, { acceptedCoverageIdentity: null }), /exact coverage/);
  assert.throws(() => registry(intake, { acceptedAuthority: 'validated_reference' }), /independent validation/);
  assert.throws(() => registry(intake, { acceptedFingerprint: 'sha256:short' }), /full SHA-256/);
  assert.throws(() => registry(intake, { acceptedClaimClasses: ['reference_match', 'reference_match'] }), /unique/);
});

test('local import is bounded, stays in memory, and cannot activate or upgrade rights', async () => {
  let calls = 0; const raw = envelope();
  const body = JSON.stringify(raw);
  const file = { size: new TextEncoder().encode(body).length, text: async () => { calls += 1; return body; } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Private import attempted network access'); };
  try {
    const intake = await importPrivateReferenceSource(file);
    assert.equal(calls, 1); assert.equal(intake.cloudUploadPermitted, false);
    assert.equal(intake.activation, 'preview_only');
    assert.throws(() => provider(intake), /preview-only/);
    await assert.rejects(importPrivateReferenceSource('https://example.invalid/source.json'));
    await assert.rejects(importPrivateReferenceSource({ ...file, size: REFERENCE_SOURCE_MAX_BYTES + 1 }));
    assert.equal(calls, 1);
    await assert.rejects(importPrivateReferenceSource({ size: 1, text: async () => ' '.repeat(REFERENCE_SOURCE_MAX_BYTES + 1) }));
  } finally { globalThis.fetch = originalFetch; }
  raw.sourceClass = 'private_solver_export';
  await assert.rejects(validateReferenceSourceIntake(raw), /Synthetic/);
  const forbidden = envelope(); forbidden.visibility = 'redistributable';
  forbidden.pack.manifest.source.redistribution = { status: 'prohibited', repositoryInclusionPermitted: false };
  forbidden.pack = attachReferencePackIntegrity(forbidden.pack);
  await assert.rejects(validateReferenceSourceIntake(forbidden), /permission/);
});

test('health observations preserve old identity, review evidence and failed validation without minting trust', async () => {
  const intake = await publicIntake(); const ledger = createSourceHealthLedger({ now: () => '2026-09-06T00:00:00.000Z' });
  const first = await ledger.inspect(intake, { decisionContext: exactContext() });
  assert.equal(first.acceptanceStatus, 'pending_review'); assert.equal(first.independentValidationStatus, 'not_reviewed');
  const dc = structuredClone(exactContext()); dc.startingStackBb = 75;
  const second = await ledger.inspect(intake, { decisionContext: dc, sourceAcceptanceRegistry: registry(intake) });
  assert.equal(second.acceptanceStatus, 'accepted'); assert.equal(second.coverage.state, 'incompatible');
  assert.ok(second.incompatibleAssumptions.includes('stack'));
  const raw = envelope(); raw.pack.representation.rows.pop();
  const rejected = await ledger.inspect(raw);
  assert.equal(rejected.validationStatus, 'rejected'); assert.equal(rejected.integrityStatus, 'failed');
  assert.match(rejected.source.fingerprint, /^sha256:/);
  assert.ok(rejected.missingFilesOrNodes.length);
  assert.equal(rejected.coverageSummary.state, 'partial');
  assert.equal(rejected.coverageSummary.exactNodes, 0);
  assert.equal(ledger.snapshot().length, 3); assert.equal(first.acceptanceStatus, 'pending_review');
  assert.ok(Object.isFrozen(ledger.snapshot()));
});

test('unsafe keys, excessive nesting, stale checksum and malformed JSON reject local intake', async () => {
  const unsafe = JSON.parse(JSON.stringify(envelope()));
  unsafe.pack.manifest.source.license = JSON.parse('{"__proto__":{"accepted":true}}');
  await assert.rejects(validateReferenceSourceIntake(unsafe), /Unsafe source key/);
  const deep = envelope(); let nested = deep;
  for (let i = 0; i < 45; i += 1) { nested.child = {}; nested = nested.child; }
  await assert.rejects(validateReferenceSourceIntake(deep), /nesting/);
  const altered = envelope(); altered.pack.manifest.sourceDescriptor.version += '-changed';
  await assert.rejects(validateReferenceSourceIntake(altered), /contentHash/);
  await assert.rejects(importPrivateReferenceSource({ size: 1, text: async () => '{' }), SyntaxError);
});

test('consumer diagnostics keep incompatible selected source distinct from generalized fallback', async () => {
  const intake = await publicIntake(); let calls = 0;
  const p = createStrategyProvider({ referenceSourceIntake: intake, allowTestReferencePack: true,
    sourceAcceptanceRegistry: registry(intake), fallbackResolver: dc => { calls += 1; return resolveHeuristicStrategy(dc); } });
  p.resolve(exactContext()); assert.equal(calls, 0);
  const dc = structuredClone(exactContext()); dc.facingSizeBb = 3;
  const result = p.resolve(dc); assert.equal(calls, 1);
  assert.equal(result.source, 'heuristic_preflop');
  const facts = selectedReferenceFacts(result, resolveStrategyClaimPolicy(result));
  assert.equal(facts.state, 'incompatible'); assert.equal(facts.available, false);
  assert.equal(facts.source.fingerprint, intake.fingerprint);
  assert.equal(resolveStrategyClaimPolicy(result).coverage.kind, 'generalized');
  const explain = createAnalysisExplanation({ decisionContext: dc, strategyResult: result });
  assert.equal(explain.warnings.find(w => w.code === 'selected_reference_coverage').message,
    REFERENCE_COVERAGE_COPY.sizing);
});

test('durable Training/Review evidence retains old source and exact coverage after registry replacement', async () => {
  const intake = await publicIntake(); const result = provider(intake).resolve(exactContext());
  const evaluation = evaluateTrainingAnswer({ exerciseId: 'source-history', chosenActionType: 'call', strategyResult: result, decisionContext: exactContext() });
  const evidence = JSON.parse(JSON.stringify(createTrainingStrategyEvidence({ strategyResult: result,
    claimPolicy: evaluation.truth.claimPolicy, evaluation })));
  const before = JSON.stringify(evidence);
  provider(intake, createStrategySourceAcceptanceRegistry([])).resolve(exactContext());
  const historical = historicalStrategyTruth(evidence);
  assert.equal(historical.source.fingerprint, intake.fingerprint);
  assert.equal(historical.selectedReference.available, true);
  assert.equal(historical.claims.correct, false);
  assert.equal(JSON.stringify(evidence), before);
  assert.equal(resolveStrategyClaimPolicy(evidence.strategyResult).claims.exact_frequencies, false);
});

test('EN/RU/HE coverage language follows structured facts and exposes Hebrew RTL', () => {
  const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(new URL('../app/src/locales/analysis-translations.js', import.meta.url), 'utf8'), sandbox);
  const catalog = sandbox.window.riverlineAnalysisTranslations;
  for (const locale of ['en', 'ru', 'he']) {
    for (const [state, available, expected] of [['exact', true, 'exact'], ['exact', false, 'pending'],
      ['incompatible', false, 'sizing'], ['generalized', false, 'generalized'], ['partial', false, 'partial'], ['unavailable', false, 'unavailable']]) {
      const view = referenceCoveragePresentation({ state, available, incompatibleDimensions: ['sizing'] }, { locale, translate: k => catalog[locale][k] });
      assert.equal(view.key, expected); assert.ok(view.text); assert.equal(view.dir, locale === 'he' ? 'rtl' : 'ltr');
      if (locale !== 'en') { assert.notEqual(view.text, view.messageKey); assert.doesNotMatch(view.text, /\?{3}|\uFFFD/); }
      assert.doesNotMatch(view.text, /reference_pack_|sha256|accepted_validated/);
    }
    for (const key of Object.values(REFERENCE_COVERAGE_COPY)) assert.ok(catalog[locale][key]);
  }
});
