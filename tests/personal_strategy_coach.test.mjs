import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRangeObservation, createRfiCalibrationContext } from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import { createPersonalStrategySnapshot } from '../app/src/personal-strategy/rfi-inference.mjs';
import { rankCalibrationCandidates } from '../app/src/personal-strategy/rfi-question-selection.mjs';
import { createPersonalRangeLanguageFacts, comparePersonalRangeLanguageFacts } from '../app/src/personal-strategy/range-language-facts.mjs';
import { createPersonalCoach, createPersonalCoachRequest, assertPersonalCoachRequestCurrent, renderPersonalCoachLesson } from '../app/src/personal-strategy/coach.mjs';

const context = createRfiCalibrationContext({ gameRulesId: 'coach-test', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 });
let serial = 0;
function observation(handClass, action = 'raise', extra = {}) {
  return createRangeObservation({ id: `coach-${++serial}`, profileId: 'p', modeId: 'a', context, handClass,
    dominantAction: { type: action }, createdAt: '2026-09-05T12:00:00Z', ...extra });
}
function setup(observations = [], focus = null, modeId = 'a') {
  const evidenceView = createPersonalStrategyEvidenceView({ profileId: 'p', modeId, context, rangeObservations: observations });
  const candidates = rankCalibrationCandidates(createPersonalStrategySnapshot(evidenceView), {
    intent: 'mapping', mappingFocus: focus, mappingEvidenceView: evidenceView });
  return { evidenceView, candidates };
}

test('sparse opportunities preserve canonical order and bound every sentence to coverage facts', () => {
  const input = setup([observation('AA')]);
  const coach = createPersonalCoach(input);
  assert.equal(coach.opportunities[0].region.handClass, input.candidates[0].handClass);
  for (const opportunity of coach.opportunities) {
    assert.equal(opportunity.permission.normative, false);
    assert.equal(opportunity.permission.wholeRegionFrequency, false);
    assert.ok(opportunity.evidenceRefs.includes(`evidence-view:${input.evidenceView.evidenceFingerprint}`));
    assert.ok(opportunity.uncertainty.includes('partial_region'));
    assert.ok(opportunity.density.directClasses < opportunity.density.totalClasses);
    assert.doesNotMatch(renderPersonalCoachLesson(opportunity).explanation, /too tight|optimal|mostly mapped|mistake|100%/);
  }
});

test('boundary gives exact K8s question and same-context variation; stale request is rejected', () => {
  const input = setup([observation('K9s'), observation('K7s', 'fold')], 'suited_kx');
  const opportunity = createPersonalCoach(input).opportunities[0];
  assert.equal(opportunity.kind, 'unmapped_boundary');
  assert.equal(opportunity.region.handClass, 'K8s');
  const options = { scope: input.evidenceView.scope, evidenceFingerprint: input.evidenceView.evidenceFingerprint };
  assert.equal(createPersonalCoachRequest(opportunity, options).target.handClass, 'K8s');
  assert.equal(createPersonalCoachRequest(opportunity, { ...options, variation: true }).target.handClass,
    opportunity.lesson.variation.handClass);
  assert.throws(() => createPersonalCoachRequest(opportunity, { ...options, evidenceFingerprint: 'old' }), /stale/);
  assert.throws(() => createPersonalCoachRequest(opportunity, { ...options, scope: { ...options.scope, modeId: 'b' } }), /stale/);
  const training = createPersonalCoachRequest(opportunity, { ...options, destination: 'training' });
  assert.equal(training.availability, 'unavailable');
  assert.equal(training.unavailableReason, 'planner_has_no_hand_region_target');
  assert.equal(training.assessment, 'none');
  assert.equal(training.generatorOwner, 'canonical_training');
  assert.equal(Object.hasOwn(training, 'pokerState'), false);
});

test('conflicting heads are inspectable inconsistency; exact tied mixes are never ambiguity', () => {
  const input = setup([observation('K9s'), observation('K7s', 'fold'), observation('K8s'), observation('K8s', 'fold')], 'suited_kx');
  const opportunity = createPersonalCoach(input).opportunities.find((entry) => entry.region.handClass === 'K8s');
  assert.equal(opportunity.kind, 'internal_inconsistency');
  assert.equal(opportunity.suggestedAction.destination, 'matrix');
  assert.ok(opportunity.evidenceRefs.length >= 3);
  const tied = observation('AA', 'raise', { dominantAction: null,
    frequencies: [{ action: { type: 'raise' }, probability: 0.5 }, { action: { type: 'fold' }, probability: 0.5 }] });
  const exact = setup([tied], 'premium_pairs');
  assert.ok(createPersonalCoach(exact).opportunities.every((entry) => entry.region.handClass !== 'AA'));
});

test('optional dominant-only mix refinement remains reachable when ordinary mapping has no candidate', () => {
  const { evidenceView } = setup([observation('AA')]);
  const coach = createPersonalCoach({ evidenceView, candidates: [] });
  assert.equal(coach.opportunities.length, 1);
  assert.equal(coach.opportunities[0].kind, 'mixed_frequency_ambiguity');
  assert.equal(coach.opportunities[0].suggestedAction.destination, 'matrix');
  assert.equal(coach.opportunities[0].lesson.question, 'mix');
  assert.equal(coach.opportunities[0].region.handClass, 'AA');
});

test('Approach comparison stays comparative and rejects stale or incompatible comparison scope', () => {
  const input = setup([observation('AKo')]);
  const other = setup([observation('AKo', 'fold', { modeId: 'b' })], null, 'b');
  const comparison = comparePersonalRangeLanguageFacts(createPersonalRangeLanguageFacts(input), createPersonalRangeLanguageFacts(other));
  const coach = createPersonalCoach({ ...input, comparison });
  const opportunity = coach.opportunities.find((entry) => entry.kind === 'approach_difference');
  assert.ok(opportunity);
  assert.equal(opportunity.envelope.wordingStrength, 'comparative');
  assert.equal(opportunity.region.handClass, 'AKo');
  const options = { scope: input.evidenceView.scope, evidenceFingerprint: input.evidenceView.evidenceFingerprint,
    comparisonEvidenceFingerprint: other.evidenceView.evidenceFingerprint };
  const request = createPersonalCoachRequest(opportunity, options);
  assert.equal(request.comparisonEvidence.fingerprint, other.evidenceView.evidenceFingerprint);
  assert.throws(() => createPersonalCoachRequest(opportunity, { ...options, comparisonEvidenceFingerprint: 'new-right-evidence' }), /stale/);
  const changedStack = createRfiCalibrationContext({ gameRulesId: 'coach-test', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 200 });
  assert.throws(() => assertPersonalCoachRequestCurrent(request, { ...options,
    scope: { ...options.scope, context: changedStack } }), /stale/);
  for (const bad of [{ ...comparison, compatible: false }, { ...comparison, leftEvidenceFingerprint: 'stale' },
    { ...comparison, leftScope: { ...comparison.leftScope, modeId: 'other' } }]) {
    assert.ok(createPersonalCoach({ ...input, comparison: bad }).opportunities.every((entry) => entry.kind !== 'approach_difference'));
  }
});

test('Coach lesson catalog has complete EN/RU/HE translations and matching substitution fields', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8'), sandbox);
  const catalog = sandbox.window.riverlineRangeCalibrationTranslations;
  const sample = createPersonalCoach(setup()).opportunities[0];
  const placeholders = (text) => [...text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
  for (const language of ['en', 'ru', 'he']) {
    const t = (key, fields = {}) => {
      assert.equal(typeof catalog[language][key], 'string', `${language}: ${key}`);
      assert.deepEqual(placeholders(key), placeholders(catalog[language][key]));
      return catalog[language][key].replace(/\{([^}]+)\}/g, (all, field) => fields[field] ?? all);
    };
    for (const kind of ['unmapped_boundary', 'sparse_hand_family', 'internal_inconsistency', 'mixed_frequency_ambiguity',
      'approach_difference', 'heuristic_difference', 'accepted_reference_difference']) {
      const rendered = renderPersonalCoachLesson({ ...sample, kind }, { t, language });
      assert.ok(rendered.explanation && rendered.question && rendered.whatChanges);
      assert.doesNotMatch(rendered.coverage, /\{direct\}|\{total\}/);
    }
  }
});
