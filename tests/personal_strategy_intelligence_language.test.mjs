import test from 'node:test';
import assert from 'node:assert/strict';
import { getHoldemCombosForHandClass } from '../shared/poker-domain/index.js';
import { createRangeObservation, createRfiCalibrationContext, createTrainingObservation } from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import { createPersonalStrategySnapshot } from '../app/src/personal-strategy/rfi-inference.mjs';
import { previewPersonalStrategyIntent, renderIntentInterpretation } from '../app/src/personal-strategy/intent-interpretation.mjs';
import { PERSONAL_RANGE_REGIONS, createPersonalRangeLanguageFacts, comparePersonalRangeLanguageFacts,
  createStrategyRangeLanguageFacts, renderPersonalRangeLanguageFacts, renderPersonalRangeComparison,
  personalRangeRegionEnvelope } from '../app/src/personal-strategy/range-language-facts.mjs';
import { createNaturalLanguageEnvelope } from '../app/src/application/natural-language-envelope.mjs';
import { createPersonalCoach } from '../app/src/personal-strategy/coach.mjs';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';
import { resolveHeuristicStrategy } from '../app/src/strategy/heuristic-strategy.mjs';
import { deriveDecisionContextFromPlaybookScenario } from '../app/src/application/playbook-state-source.mjs';
import { createStrategySourceDescriptor, createStrategySourceAcceptanceRegistry } from '../app/src/application/strategy-source-authority.mjs';
import { createCanonicalPreflopStateFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { deriveDecisionContextFromPokerState } from '../app/src/application/decision-context-from-poker-state.mjs';

const ctx = createRfiCalibrationContext({ gameRulesId: 'rules', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 });
const timestamp = '2026-09-05T12:00:00.000Z';
let serial = 0;
function observation(handClass, action = 'raise', { modeId = 'a', exact = false, participation = 0.75, context = ctx } = {}) {
  const frequencies = exact ? [{ action: { type: 'raise' }, probability: participation }, { action: { type: 'fold' }, probability: 1 - participation }] : null;
  return createRangeObservation({ id: `language-${++serial}`, profileId: 'p', modeId, context, handClass,
    dominantAction: { type: exact ? participation > 0.5 ? 'raise' : 'fold' : action }, frequencies, createdAt: timestamp });
}
function view(observations, { modeId = 'a', context = ctx, trainingObservations = [] } = {}) {
  return createPersonalStrategyEvidenceView({ profileId: 'p', modeId, context, rangeObservations: observations, trainingObservations });
}
const factsFor = (observations, opts = {}) => createPersonalRangeLanguageFacts({ evidenceView: view(observations, opts) });
test('insight presentation labels preserve every accepted sentence and its order across locales', () => {
  const cases = [factsFor([]), factsFor([observation('K9s'), observation('K7s', 'fold'), observation('AA')]),
    factsFor([observation('AA'), observation('AA', 'fold')])];
  for (const facts of cases) for (const language of ['en', 'ru', 'he']) {
    const rows = renderPersonalRangeLanguageFacts(facts, { language, withPresentation: true });
    assert.deepEqual(rows.map(row => row.text), renderPersonalRangeLanguageFacts(facts, { language }));
    assert.ok(rows.every(row => row.label && ['conflict', 'boundary', 'pattern', 'unresolved', 'precision'].includes(row.kind)));
  }
  const rows = renderPersonalRangeLanguageFacts(cases[1], { withPresentation: true });
  assert.ok(rows.some(row => row.kind === 'boundary' && row.text.includes('K9s')));
  assert.ok(rows.some(row => row.kind === 'precision' && row.text.includes('not exact play frequencies')));
  assert.ok(rows.some(row => row.kind === 'precision' && row.text.includes('unasked hands')));
  assert.ok(renderPersonalRangeLanguageFacts(cases[2], { withPresentation: true }).some(row => row.kind === 'conflict'));
});
const region = (facts, id) => facts.regions.find((r) => r.id === id);

test('EN/RU/HE negation and original wording survive preview without action or frequency invention', () => {
  for (const [language, text] of [['en', "I defend pretty wide but I don't like weak offsuit hands."],
    ['ru', 'Я защищаюсь широко но не люблю слабые разномастные руки.'],
    ['he', 'אני מגן רחב אבל אני לא אוהב ידיים חלשות אוף סוט.']]) {
    const preview = previewPersonalStrategyIntent({ text, language, scope: { approachId: 'a' } });
    assert.equal(preview.originalText, text);
    assert.equal(preview.confirmationState, 'provisional');
    assert.equal(preview.followupTopic, 'offsuit_boundary');
    assert.ok(preview.propositions.some((p) => p.negationPresent));
    assert.ok(preview.propositions.every((p) => p.action === null && p.frequencies === null));
    assert.deepEqual(preview.inferredScope, {});
    const rendered = renderIntentInterpretation(preview, language);
    assert.ok(rendered.statements.some((line) => line.includes(preview.propositions.at(-1).wording)));
    assert.ok(rendered.uncertainty && rendered.followup);
    assert.equal(preview.envelope.wordingStrength, 'provisional');
    assert.ok(Object.isFrozen(preview.propositions));
  }
});

test('unsupported wording, explicit numbers, history and self-assessment remain unresolved qualitative statements', () => {
  for (const text of ['blue moons for this range', 'Usually raise 70%', 'I overfold rivers', 'Yesterday I folded']) {
    const preview = previewPersonalStrategyIntent({ text });
    assert.ok(preview.unresolvedTerms.includes('exact_frequencies'));
    assert.equal(preview.propositions[0].frequencies, null);
  }
  assert.ok(previewPersonalStrategyIntent({ text: 'I overfold rivers' }).unresolvedTerms.includes('self_assessment_not_validated'));
  assert.ok(previewPersonalStrategyIntent({ text: 'Yesterday I folded' }).unresolvedTerms.includes('observed_or_intended_role'));
});

test('canonical structural regions have deterministic inspectable memberships', () => {
  assert.equal(PERSONAL_RANGE_REGIONS.suited.length, 78);
  assert.equal(PERSONAL_RANGE_REGIONS.offsuit.length, 78);
  assert.equal(PERSONAL_RANGE_REGIONS.pairs.length, 13);
  assert.equal(PERSONAL_RANGE_REGIONS.broadway.length, 20);
  assert.equal(PERSONAL_RANGE_REGIONS.suited_connectors.length, 12);
  assert.ok(PERSONAL_RANGE_REGIONS.suited_connectors.includes('T9s'));
  assert.ok(!PERSONAL_RANGE_REGIONS.suited_connectors.includes('T8s'));
  assert.ok(PERSONAL_RANGE_REGIONS.suited_one_gappers.includes('T8s'));
  assert.ok(PERSONAL_RANGE_REGIONS.kx.includes('AKo'));
  assert.ok(!PERSONAL_RANGE_REGIONS.ax.includes('AA'));
});

test('sparse dominant evidence yields poker examples, never whole-region frequency claims', () => {
  const facts = factsFor([observation('T9s'), observation('98s'), observation('54s', 'fold'), observation('KJo', 'fold')]);
  const connectors = region(facts, 'suited_connectors');
  assert.equal(connectors.directClasses, 3);
  assert.equal(connectors.exactClasses, 0);
  assert.equal(connectors.quantitative, null);
  assert.equal(connectors.permission.wholeRegionFrequency, false);
  const text = renderPersonalRangeLanguageFacts(facts).join('\n');
  assert.match(text, /suited connectors preference changes/);
  assert.match(text, /98s/); assert.match(text, /54s/);
  assert.match(text, /boundary between them is unresolved/);
  assert.doesNotMatch(text, /too tight|too loose|inconsistent|polarized/);
  assert.equal(personalRangeRegionEnvelope(facts, 'suited_connectors').claimClass, 'interpretive');
});

test('stated neighboring Kx actions locate one boundary without repeating it across overlapping regions', () => {
  const facts = factsFor([observation('KTs'), observation('K9s'), observation('K8s', 'fold')]);
  const boundaries = region(facts, 'suited_kx').structure.transitions;
  assert.deepEqual(boundaries.map((b) => [b.upperHandClass, b.lowerHandClass, b.kind]), [['K9s', 'K8s', 'adjacent_stated_transition']]);
  assert.equal(region(facts, 'suited_kx').quantitative, null);
  for (const language of ['en', 'ru', 'he']) {
    const lines = renderPersonalRangeLanguageFacts(facts, { language });
    const transitionLines = lines.filter((line) => line.includes('K9s') && line.includes('K8s'));
    assert.equal(transitionLines.length, 1);
    assert.doesNotMatch(lines.join(' '), /100%|polarized|too tight|too loose|optimal/i);
  }
  assert.match(renderPersonalRangeLanguageFacts(facts).join(' '), /adjacent answers locate one stated boundary/);
});

test('nonadjacent pair answers leave intervening hands unresolved and conflict blocks boundary inference', () => {
  const observations = [observation('77'), observation('55'), observation('33', 'fold')];
  const facts = factsFor(observations);
  const boundary = region(facts, 'small_pairs').structure.transitions[0];
  assert.equal(boundary.kind, 'unresolved_bracket');
  assert.deepEqual(boundary.unresolvedBetween, ['44']);
  assert.match(renderPersonalRangeLanguageFacts(facts).join(' '), /44.*needs clarification/);
  const conflicted = factsFor([...observations, observation('44'), observation('44', 'fold')]);
  assert.equal(region(conflicted, 'small_pairs').structure.transitions.length, 0);
  assert.deepEqual(region(conflicted, 'small_pairs').structure.conflictingHandClasses, ['44']);
  assert.match(renderPersonalRangeLanguageFacts(conflicted).join(' '), /active answers conflict at/);
});

test('consistent medium-pair examples describe sampled preference while lower boundary remains open', () => {
  const facts = factsFor([observation('JJ'), observation('TT'), observation('99')]);
  const pattern = region(facts, 'medium_pairs').structure;
  assert.equal(pattern.consistentSelectedAction, 'raise');
  assert.equal(pattern.completePreferredCoverage, false);
  assert.ok(pattern.unresolvedLowerNeighbors.includes('88'));
  const text = renderPersonalRangeLanguageFacts(facts).join(' ');
  assert.match(text, /medium pocket pairs you specified share a Raise preference/);
  assert.match(text, /lower boundary still needs evidence at.*88/);
  assert.match(text, /not enough direct evidence yet to characterize weaker disconnected suited hands/);
  assert.equal(region(facts, 'medium_pairs').permission.wholeRegionFrequency, false);
});

test('an explicit tied mix inside a boundary remains known evidence rather than an unanswered hand', () => {
  const tied = createRangeObservation({ id: `language-${++serial}`, profileId: 'p', modeId: 'a', context: ctx,
    handClass: '44', dominantAction: null, frequencies: [{ action: { type: 'fold' }, probability: 0.5 },
      { action: { type: 'raise' }, probability: 0.5 }], createdAt: timestamp });
  const facts = factsFor([observation('55'), tied, observation('33', 'fold')]);
  const boundary = region(facts, 'small_pairs').structure.transitions[0];
  assert.equal(boundary.kind, 'explicit_mixed_transition');
  assert.deepEqual(boundary.unresolvedBetween, []);
  assert.deepEqual(boundary.mixedBetween, ['44']);
  const line = renderPersonalRangeLanguageFacts(facts).find((text) => text.includes('55') && text.includes('33'));
  assert.match(line, /explicitly specified tied mixes:.*44/);
  assert.doesNotMatch(line, /unresolved|needs clarification/);
  assert.ok(boundary.evidenceRefs.includes(tied.id));
});

test('full preferred-action coverage permits categorical majority but not frequency or a wider style axis', () => {
  const hands = PERSONAL_RANGE_REGIONS.weak_offsuit_high_card;
  const facts = factsFor(hands.map((hand, index) => observation(hand, index < 2 ? 'raise' : 'fold')));
  const regionFacts = region(facts, 'weak_offsuit_high_card');
  assert.equal(regionFacts.structure.wholeRegionMajorityAction, 'fold');
  assert.equal(regionFacts.quantitative, null);
  assert.match(renderPersonalRangeLanguageFacts(facts).join(' '), /Fold is your preferred response across most offsuit high cards with low kickers/);
  const sparse = factsFor(hands.slice(0, 3).map((hand) => observation(hand, 'fold')));
  assert.equal(region(sparse, 'weak_offsuit_high_card').structure.wholeRegionMajorityAction, null);
  assert.doesNotMatch(renderPersonalRangeLanguageFacts(sparse).join(' '), /across most offsuit high cards/);
});

test('aggression concentration is grounded only in specified action preferences', () => {
  const facts = factsFor(['AA', 'KK', 'QQ', 'AKs', 'A5s'].map((hand) => observation(hand)));
  assert.equal(facts.actionConcentration.majorityInPremiumPairsAndBroadways, true);
  assert.deepEqual(new Set(facts.actionConcentration.coreAggressiveHandClasses), new Set(['AA', 'KK', 'QQ', 'AKs']));
  assert.match(renderPersonalRangeLanguageFacts(facts).join(' '), /Among the hands you specified, most aggressive preferences/);
  const sparse = factsFor([observation('AA')]);
  assert.equal(sparse.actionConcentration.majorityInPremiumPairsAndBroadways, false);
});

test('Approach comparisons locate removed offsuit continues and preserved connector preferences independently', () => {
  const aRows = [...PERSONAL_RANGE_REGIONS.offsuit_broadway.map((hand) => observation(hand, 'fold')),
    ...PERSONAL_RANGE_REGIONS.suited_connectors.map((hand) => observation(hand, 'raise'))];
  const bRows = [...PERSONAL_RANGE_REGIONS.offsuit_broadway.map((hand) => observation(hand, 'raise', { modeId: 'b' })),
    ...PERSONAL_RANGE_REGIONS.suited_connectors.map((hand) => observation(hand, 'raise', { modeId: 'b' }))];
  const comparison = comparePersonalRangeLanguageFacts(factsFor(aRows), factsFor(bRows, { modeId: 'b' }));
  const broadway = region(comparison, 'offsuit_broadway');
  assert.equal(broadway.preferredParticipation.completeRegion, true);
  assert.equal(broadway.preferredParticipation.removedContinues.length, 10);
  assert.equal(broadway.quantitative, null);
  assert.equal(region(comparison, 'suited_connectors').preferredParticipation.preservedContinues.length, 12);
  const english = renderPersonalRangeComparison(comparison, { leftName: 'Cash', rightName: 'Home' }).join(' ');
  assert.match(english, /offsuit Broadways.*replaces preferred continues/);
  assert.match(english, /keeps the preferred continues from Home through most suited connectors/);
  for (const language of ['en', 'ru', 'he']) {
    const text = renderPersonalRangeComparison(comparison, { language }).join(' ');
    assert.doesNotMatch(text, /too tight|too loose|mistake|100%/i);
    assert.ok(text.includes('KQo') || text.includes('KJo'));
  }
});

test('complete dominant answers do not unlock exact region participation', () => {
  const facts = factsFor(PERSONAL_RANGE_REGIONS.pairs.map((hand) => observation(hand)));
  assert.equal(region(facts, 'pairs').directClasses, 13);
  assert.equal(region(facts, 'pairs').quantitative, null);
});

test('complete exact suited and offsuit regions produce canonical-weighted participation summaries', () => {
  const facts = factsFor([...PERSONAL_RANGE_REGIONS.suited.map((h) => observation(h, 'raise', { exact: true, participation: 0.8 })),
    ...PERSONAL_RANGE_REGIONS.offsuit.map((h) => observation(h, 'fold', { exact: true, participation: 0.2 }))]);
  assert.ok(Math.abs(region(facts, 'suited').quantitative.participation - 0.8) < 1e-10);
  assert.ok(Math.abs(region(facts, 'offsuit').quantitative.participation - 0.2) < 1e-10);
  assert.equal(region(facts, 'suited').quantitative.totalCombos, 312);
  assert.match(renderPersonalRangeLanguageFacts(facts)[0], /suited hands 80% and offsuit hands 20%/);
});

test('estimates cannot fill missing exact coverage and stale snapshots fail closed', () => {
  const evidenceView = view([observation('AA')]);
  const snapshot = createPersonalStrategySnapshot(evidenceView);
  const facts = createPersonalRangeLanguageFacts({ evidenceView, snapshot });
  assert.equal(region(facts, 'pairs').exactClasses, 0);
  assert.equal(region(facts, 'pairs').quantitative, null);
  assert.throws(() => createPersonalRangeLanguageFacts({ evidenceView: view([observation('KK')]), snapshot }), /stale/);
});

test('observed actions never become intended range facts', () => {
  const training = createTrainingObservation({ id: 'observed-only', profileId: 'p', modeId: 'a', context: ctx,
    handClass: 'AA', chosenAction: { type: 'fold' }, createdAt: timestamp,
    trainingSessionId: 'session', trainingExerciseId: 'exercise' });
  const facts = createPersonalRangeLanguageFacts({ evidenceView: view([], { trainingObservations: [training] }) });
  assert.equal(region(facts, 'pairs').directClasses, 0);
  assert.equal(region(facts, 'pairs').permission.sampleDescription, false);
});

test('Approach comparisons retain independent suited and offsuit changes without a style axis', () => {
  const a = factsFor([observation('T9s', 'raise'), observation('KJo', 'fold')]);
  const b = factsFor([observation('T9s', 'fold', { modeId: 'b' }), observation('KJo', 'raise', { modeId: 'b' })], { modeId: 'b' });
  const comparison = comparePersonalRangeLanguageFacts(a, b);
  assert.equal(comparison.compatible, true);
  assert.equal(region(comparison, 'suited').differences[0].leftAction, 'raise');
  assert.equal(region(comparison, 'offsuit').differences[0].leftAction, 'fold');
  assert.equal(region(comparison, 'offsuit').quantitative, null);
  for (const language of ['en', 'ru', 'he']) assert.ok(renderPersonalRangeComparison(comparison, { language }).length);
  assert.equal('styleAxis' in comparison, false);
  const otherContext = createRfiCalibrationContext({ gameRulesId: 'rules', tableSize: 6, heroPosition: 'CO', effectiveStackBb: 100 });
  const incompatible = factsFor([], { context: otherContext });
  assert.equal(comparePersonalRangeLanguageFacts(a, incompatible).compatible, false);
});

function sourceEntries(hands, provider) {
  return hands.map((handClass) => {
    const decisionContext = deriveDecisionContextFromPlaybookScenario({ tableSize: 6, heroPosition: 'BTN',
      heroCards: [...getHoldemCombosForHandClass(handClass)[0].cards], board: [], deadCards: [], stackBb: 100,
      stackMode: 'hero', potBb: 1.5, lastAction: 'unopened', facingSizeBb: 0, rakeMode: 'off', ante: 0 });
    return { handClass, decisionContext, strategyResult: provider.resolve(decisionContext) };
  });
}
test('heuristic source comparison requires full region coverage and stays comparative', () => {
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const facts = factsFor([observation('AA', 'fold')]);
  const entries = sourceEntries(PERSONAL_RANGE_REGIONS.pairs, provider);
  const full = createStrategyRangeLanguageFacts({ personalFacts: facts, entries, expectedRole: 'heuristic' });
  assert.equal(region(full, 'pairs').permission.comparison, true);
  assert.equal(region(full, 'pairs').permission.normative, false);
  assert.equal(region(full, 'pairs').quantitative, null);
  assert.match(renderPersonalRangeComparison(full).join(' '), /heuristic baseline/);
  const sparse = createStrategyRangeLanguageFacts({ personalFacts: facts, entries: entries.slice(0, 1), expectedRole: 'heuristic' });
  assert.equal(region(sparse, 'pairs').permission.comparison, false);
  const disguised = createStrategyRangeLanguageFacts({ personalFacts: facts, entries, expectedRole: 'reference' });
  assert.equal(region(disguised, 'pairs').permission.comparison, false);
});

test('accepted reference source still needs region coverage and cannot grant normative range language', () => {
  const descriptor = createStrategySourceDescriptor({ id: 'range-language-test', version: 'v1', displayName: 'Synthetic test', family: 'reference_pack',
    authority: 'validated_reference', capabilities: { actionDistribution: 'exact', actionSizing: 'complete', grading: 'normative', actionEv: false, optimality: false }, defaultCoverage: 'unsupported' });
  const sourceAcceptanceRegistry = createStrategySourceAcceptanceRegistry([{ sourceId: descriptor.id, allowedFamily: descriptor.family,
    acceptedVersion: 'v1', acceptedFingerprint: 'fixture', acceptedAuthority: descriptor.authority,
    acceptedCapabilities: descriptor.capabilities, acceptedCoverageCeiling: 'exact', validationStatus: 'test-only' }]);
  const provider = createStrategyProvider({ sourceAcceptanceRegistry, fallbackResolver: () => ({ source: descriptor.id,
    sourceDescriptor: descriptor, provenance: { contentHash: 'fixture' }, contextCoverage: { kind: 'exact' },
    actions: [{ action: { type: 'raise', amountBb: 3 }, probability: 1 }] }) });
  const evidenceView = view([observation('AA', 'fold')]);
  const facts = createPersonalRangeLanguageFacts({ evidenceView });
  const entries = sourceEntries(PERSONAL_RANGE_REGIONS.pairs, provider);
  const comparison = createStrategyRangeLanguageFacts({ personalFacts: facts, entries, expectedRole: 'reference' });
  assert.equal(region(comparison, 'pairs').permission.comparison, true);
  assert.equal(region(comparison, 'pairs').permission.normative, false);
  assert.match(renderPersonalRangeComparison(comparison).join(' '), /selected reference/);
  const sparse = createStrategyRangeLanguageFacts({ personalFacts: facts, entries: entries.slice(0, 1), expectedRole: 'reference' });
  assert.equal(region(sparse, 'pairs').permission.comparison, false);
  const coach = createPersonalCoach({ evidenceView, comparison });
  const referenceCard = coach.opportunities.find((entry) => entry.kind === 'accepted_reference_difference');
  assert.ok(referenceCard);
  assert.equal(referenceCard.permission.normative, false);
  assert.equal(referenceCard.envelope.wordingStrength, 'comparative');
  assert.ok(referenceCard.evidenceRefs.some((ref) => ref.startsWith('source:')));
  assert.ok(createPersonalCoach({ evidenceView, comparison: sparse }).opportunities.every((entry) => entry.kind !== 'accepted_reference_difference'));
});

test('source comparison rejects hand relabels, duplicate rows, changed stacks and prior-action scopes', () => {
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  const facts = factsFor([observation('AA', 'fold')]);
  const entries = sourceEntries(PERSONAL_RANGE_REGIONS.pairs, provider);
  const changed = [
    [...entries, entries[0]],
    entries.map((e, i) => i ? e : { ...e, handClass: 'AKs' }),
    entries.map((e, i) => i ? e : { ...e, decisionContext: { ...e.decisionContext, stackBb: 200 } }),
    entries.map((e, i) => i ? e : { ...e, decisionContext: { ...e.decisionContext,
      priorActionSummary: { ...e.decisionContext.priorActionSummary, limperCount: 1 } } }),
  ];
  for (const rows of changed) {
    const result = createStrategyRangeLanguageFacts({ personalFacts: facts, entries: rows, expectedRole: 'heuristic' });
    assert.equal(region(result, 'pairs').permission.comparison, false);
  }
});

test('real custom canonical v2 RFI scope supports baseline comparison and preserves collection-adjusted stack semantics', () => {
  const provider = createStrategyProvider({ fallbackResolver: resolveHeuristicStrategy });
  for (const collectionBb of [0, 1]) {
    const selection = { environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
      decisionFamily: 'preflop_rfi', actionAware: true, collectionBb, anteType: 'none', anteBb: 0 };
    const entries = PERSONAL_RANGE_REGIONS.pairs.map((handClass) => {
      const generated = createCanonicalPreflopStateFromSelection(selection, { handClass });
      const decisionContext = deriveDecisionContextFromPokerState(generated.state, generated.heroPlayerId);
      return { handClass, calibrationContext: generated.context, decisionContext, strategyResult: provider.resolve(decisionContext) };
    });
    const context = entries[0].calibrationContext;
    assert.equal(context.schemaVersion, 'calibration-context/v2');
    assert.equal(context.stack.valueBb, 100 - collectionBb);
    assert.equal(entries[0].decisionContext.stackBb, 100);
    const personalFacts = factsFor([observation('AA', 'fold', { context })], { context });
    const comparison = createStrategyRangeLanguageFacts({ personalFacts, entries, sourceContext: context, expectedRole: 'heuristic' });
    assert.equal(region(comparison, 'pairs').permission.comparison, true);
    assert.match(renderPersonalRangeComparison(comparison).join(' '), /heuristic baseline/);
    const missingBinding = entries.map(({ calibrationContext, ...entry }) => entry);
    assert.equal(region(createStrategyRangeLanguageFacts({ personalFacts, entries: missingBinding, expectedRole: 'heuristic' }), 'pairs').permission.comparison, false);
  }
});

test('typed language envelope rejects unsupported claims and action-level normative promotion', () => {
  const input = { claimClass: 'strategic_normative', subject: { role: 'personal_intent' }, evidenceRefs: ['e1'],
    permission: { comparison: true, normative: false, criterion: 'explicit-region-comparison/v1' }, wordingStrength: 'comparative' };
  assert.equal(createNaturalLanguageEnvelope(input).wordingStrength, 'comparative');
  assert.throws(() => createNaturalLanguageEnvelope({ ...input, wordingStrength: 'normative', permission: { ...input.permission, normative: true } }), /separately accepted/);
  assert.throws(() => createNaturalLanguageEnvelope({ ...input, evidenceRefs: [] }), /evidence/);
  assert.throws(() => createNaturalLanguageEnvelope({ ...input, claimClass: 'user_intent_inference', basis: 'current' }), /provisional/);
  assert.throws(() => createNaturalLanguageEnvelope({ ...input, claimClass: 'interpretive' }), /criterion/);
});
