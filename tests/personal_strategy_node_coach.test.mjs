import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeCoach, renderNodeCoach, createNodeCoachHandoff, assertNodeCoachHandoffCurrent } from '../app/src/personal-strategy/node-coach.mjs';
import { createPersonalHandBranch } from '../app/src/application/personal-hand-study.mjs';

function input(overrides = {}) {
  return {
    studyFacts: { eligibleCombos: 1176, knownPositiveCombos: 60, unknownReachCombos: 1100,
      mappedCombos: 4, exactCombos: 2, dominantCombos: 1, conflictingCombos: 1, unknownPolicyCombos: 1172,
      blockedCombos: 150, regions: [{ id: 'pair', eligibleCombos: 100, mappedCombos: 1,
        exactCombos: 1, dominantCombos: 0, unknownPolicyCombos: 99 }], evidenceRefs: ['intent:a', 'intent:b'], fingerprint: 'facts:1' },
    node: { street: 'flop', board: ['Qs', '8c', '4h'], fingerprint: 'node:1', decisionContext: { street: 'flop' } },
    approachSnapshot: { ownerId: 'guest:a', profileId: 'setup:a', modeId: 'approach:a', version: 1 }, ...overrides,
  };
}

test('postflop Coach describes sparse evidence without granting strategy authority', () => {
  const coach = createNodeCoach(input());
  assert.deepEqual(coach.opportunities.map((item) => item.kind), ['unmapped_postflop_region',
    'mixed_frequency_ambiguity', 'internal_inconsistency', 'uncertain_value_boundary', 'uncertain_bluff_boundary',
    'small_bet_gap', 'check_raise_gap', 'sizing_ambiguity', 'action_conditioned_range_uncertainty', 'turn_river_continuation_gap', 'value_targeting_question']);
  assert.equal(coach.studyFacts.unknownReachCombos, 1100);
  assert.equal(coach.studyFacts.dominantCombos, 1);
  for (const opportunity of coach.opportunities) {
    assert.equal(opportunity.permissions.normative, false);
    assert.equal(opportunity.permissions.wholeRangeFrequency, false);
    assert.equal(opportunity.permissions.representativeImpliesRegion, false);
    assert.equal(opportunity.envelope.claimClass, 'interpretive');
    assert.ok(opportunity.envelope.evidenceRefs.includes('intent:a'));
  }
  const language = renderNodeCoach(coach);
  assert.match(language.coverage, /4\/1176/);
  assert.match(language.coverage, /1100.*unknown reach/);
  assert.match(language.coverage, /150/);
  assert.match(language.regions[0].coverage, /1\/100/);
  assert.match(language.summary, /only to its stated combinations/);
  assert.match(language.caution, /not treated as zero/);
});

test('all concepts distinguish questions, stronger claims, reference comparison and normative permission', () => {
  const coach = createNodeCoach(input());
  assert.deepEqual(coach.concepts.map((item) => item.id), ['value', 'thin_value', 'when_not_to_bet', 'semibluff',
    'bluff', 'bluff_catch', 'blocker_quality', 'check_raise', 'small_block_bet', 'polarization', 'value_bluff_composition', 'exploit', 'scare_card', 'multiway']);
  for (const concept of coach.concepts) {
    assert.equal(concept.question.availability, 'available');
    assert.equal(concept.strongerClaim.availability, 'unavailable');
    assert.ok(concept.strongerClaim.missing.length > 0);
    assert.equal(Object.keys(concept.dependencies).length, 8);
    assert.equal(concept.dependencies.handFacts.availability, 'available');
    assert.equal(concept.dependencies.acceptedReference.purpose, 'reference_comparison_only');
    assert.equal(concept.dependencies.normativeAssessment.purpose, 'normative_verdict_only');
    assert.equal(concept.referenceComparison.availability, 'unavailable');
    assert.equal(concept.normativeAssessment.availability, 'unavailable');
  }
  const injected = input();
  injected.studyFacts.permissions = { normative: true };
  injected.node.acceptedReference = { accepted: true };
  assert.equal(createNodeCoach(injected).fingerprint, coach.fingerprint);
});

test('an exact answered mix is not ambiguity and a fully specified river does not invent a continuation gap', () => {
  const data = input();
  data.node.street = 'river';
  data.node.board.push('2d', '3d');
  Object.assign(data.studyFacts, { knownPositiveCombos: 1176, unknownReachCombos: 0, mappedCombos: 1176,
    exactCombos: 1176, dominantCombos: 0, conflictingCombos: 0, unknownPolicyCombos: 0,
    regions: [{ id: 'pair', eligibleCombos: 100, mappedCombos: 100, exactCombos: 100, dominantCombos: 0, unknownPolicyCombos: 0 }] });
  const coach = createNodeCoach(data);
  assert.deepEqual(coach.opportunities.map((item) => item.kind), ['value_targeting_question']);
  assert.equal(coach.concepts[0].strongerClaim.availability, 'unavailable');
});

test('EN/RU/HE lessons and dependency availability preserve numbers, questions and RTL', () => {
  const coach = createNodeCoach(input());
  for (const language of ['en', 'ru', 'he']) {
    const view = renderNodeCoach(coach, { language });
    assert.equal(view.direction, language === 'he' ? 'rtl' : 'ltr');
    assert.match(view.coverage, /4\/1176/);
    assert.match(view.coverage, /1172/);
    assert.match(view.coverage, /1100/);
    assert.equal(view.concepts.length, 14);
    for (const lesson of [...view.lessons, ...view.concepts]) {
      for (const key of ['why', 'question', 'explanation', 'whatChanges', 'next', 'unavailable']) {
        assert.equal(typeof lesson[key], 'string');
        assert.ok(lesson[key].length > 8);
        if (language !== 'en') assert.match(lesson[key], language === 'ru' ? /[а-яё]/i : /[א-ת]/);
      }
    }
    for (const handoff of view.handoffs.filter((item) => item.availability === 'unavailable')) {
      assert.ok(handoff.unavailableReason.length > 10);
      if (language !== 'en') assert.match(handoff.unavailableReason, language === 'ru' ? /[а-яё]/i : /[א-ת]/);
    }
  }
});

test('versioned handoffs preserve node and Approach evidence without generating Training or grading', () => {
  const coach = createNodeCoach(input());
  for (const destination of ['teach_riverline', 'concept_lesson']) {
    const request = createNodeCoachHandoff(coach, destination);
    assert.equal(request.availability, 'available');
    assert.equal(request.assessment, 'none');
    assert.equal(request.scope.approachSnapshot.ownerId, 'guest:a');
    assert.equal(request.nodeFingerprint, 'node:1');
    assert.equal(request.evidenceFingerprint, 'facts:1');
    assert.equal(assertNodeCoachHandoffCurrent(request, coach), request);
    assert.ok(!Object.hasOwn(request, 'pokerState'));
  }
  const reasons = { matrix: 'matrix_preflop_only', same_spot: 'training_memory_record_required',
    similar_spot: 'planner_node_target_unsupported', controlled_perturbation: 'planner_node_target_unsupported',
    full_hand: 'full_hand_transfer_unsupported' };
  for (const [destination, reason] of Object.entries(reasons)) {
    const request = createNodeCoachHandoff(coach, destination);
    assert.equal(request.availability, 'unavailable');
    assert.equal(request.unavailableReason, reason);
    assert.equal(request.generatorOwner, 'canonical_training');
  }
  assert.throws(() => createNodeCoachHandoff(coach, 'invent_drill'), /Unsupported/);
});

test('stale evidence, node, owner or Approach version cannot reuse a Coach handoff', () => {
  const coach = createNodeCoach(input());
  const request = createNodeCoachHandoff(coach, 'teach_riverline');
  for (const mutate of [
    (data) => { data.studyFacts.fingerprint = 'facts:2'; },
    (data) => { data.node.fingerprint = 'node:2'; },
    (data) => { data.approachSnapshot.ownerId = 'account:b'; },
    (data) => { data.approachSnapshot.version = 2; },
  ]) {
    const changed = input(); mutate(changed);
    assert.throws(() => assertNodeCoachHandoffCurrent(request, createNodeCoach(changed)), /stale_node_coach_request/);
  }
});

test('Coach projection is immutable, deterministic and excludes extraneous hidden opponent data', () => {
  const data = input();
  const first = createNodeCoach(data);
  data.node.hiddenOpponentCards = ['As', 'Ad'];
  data.studyFacts.hiddenOpponentCards = ['As', 'Ad'];
  data.node.decisionContext.hiddenOpponentCards = ['As', 'Ad'];
  data.studyFacts.evidenceRefs.reverse();
  data.approachSnapshot = Object.fromEntries(Object.entries(data.approachSnapshot).reverse());
  const second = createNodeCoach(data);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.ok(!JSON.stringify(second).includes('hiddenOpponentCards'));
  assert.throws(() => { second.studyFacts.mappedCombos = 600; }, TypeError);
  assert.throws(() => second.scope.board.push('As'), TypeError);
  data.studyFacts.mappedCombos = 600;
  assert.equal(first.studyFacts.mappedCombos, 4);
});

test('missing or invalid facts fail closed instead of becoming zero evidence', () => {
  assert.throws(() => createNodeCoach(), /required/);
  for (const invalid of [null, undefined, -1, NaN, 1.2, 1177]) {
    const data = input(); data.studyFacts.unknownReachCombos = invalid;
    assert.throws(() => createNodeCoach(data), /count/);
  }
  const data = input(); data.studyFacts.regions[0].unknownPolicyCombos = 101;
  assert.throws(() => createNodeCoach(data), /count/);
});

test('canonical range nodes keep per-combo DecisionContext rather than selecting one representative for the range', () => {
  const branch = createPersonalHandBranch();
  assert.equal(branch.flopNode.decisionContext, null);
  const coach = createNodeCoach(input({ node: branch.flopNode }));
  assert.equal(coach.scope.decisionContextAvailability, 'per_physical_combo');
  assert.equal(coach.scope.nodeFingerprint, branch.flopNode.fingerprint);
  assert.equal(Object.hasOwn(coach.scope, 'heroCards'), false);
  const corrupt = structuredClone(branch.flopNode);
  corrupt.board = ['As', 'Ad', 'Ac'];
  assert.throws(() => createNodeCoach(input({ node: corrupt })), /Stale or incompatible/);
});
