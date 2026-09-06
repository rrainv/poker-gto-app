import test from 'node:test';
import assert from 'node:assert/strict';
import { getHoldemCombosForHandClass, serializeHoldemWeightedRange, deserializeHoldemWeightedRange,
  createNormalizedHoldemDistribution } from '../shared/poker-domain/index.js';
import { createRangeObservation, createRfiCalibrationContext } from '../app/src/personal-strategy/domain.mjs';
import { createPersonalStrategyEvidenceView } from '../app/src/personal-strategy/evidence-view.mjs';
import { createPersonalActionFamilyRange, validatePersonalActionFamilyRange } from '../app/src/application/personal-strategy-weighted-range.mjs';
import { createRangeContinuationFacts } from '../app/src/application/range-continuation-foundation.mjs';
import { createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';

const context = createRfiCalibrationContext({ gameRulesId: 'range-coach-test', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 });
let serial = 0;
function observation(handClass, probability = null, extra = {}) {
  return createRangeObservation({ id: `bridge-${++serial}`, profileId: 'p', modeId: 'a', context, handClass,
    dominantAction: probability === 0.5 ? null : { type: probability === null || probability > 0.5 ? 'raise' : 'fold' },
    frequencies: probability === null ? null : [{ action: { type: 'raise' }, probability }, { action: { type: 'fold' }, probability: 1 - probability }],
    createdAt: '2026-09-05T12:00:00Z', ...extra });
}
const view = (observations) => createPersonalStrategyEvidenceView({ profileId: 'p', modeId: 'a', context, rangeObservations: observations });
const bridge = (observations = []) => createPersonalActionFamilyRange({ evidenceView: view(observations), actionType: 'raise', setupVersion: 2, approachVersion: 3 });
const entries = (result, hand) => result.range.entries.filter((entry) => getHoldemCombosForHandClass(hand).some((combo) => combo.id === entry.comboId));

test('exact direct class mix alone supplies mass; dominant, missing, estimates and qualitative remain unknown', () => {
  const result = bridge([observation('AA', 0.5), observation('AKs', 0), observation('KK')]);
  assert.ok(entries(result, 'AA').every((entry) => entry.weight === 0.5));
  assert.ok(entries(result, 'AKs').every((entry) => entry.state === 'known' && entry.weight === 0));
  for (const hand of ['KK', '72o']) assert.ok(entries(result, hand).every((entry) => entry.state === 'unknown' && !Object.hasOwn(entry, 'weight')));
  assert.equal(result.coverage.totalKnownWeight, 3);
  assert.equal(result.coverage.unknownCombos, 1316);
  assert.equal(result.exactActionConditioning.permitted, false);
  assert.equal(result.action.amountBb, null);
  assert.equal(result.estimates.availability, 'unavailable');
  assert.throws(() => createNormalizedHoldemDistribution(result.range), /partial|complete|unknown/i);
});

test('production action-aware RFI scope preserves exact class mass without collapsing its action set', () => {
  const productionContext = createContextFromSelection({ environment: 'custom', tableSize: 6, heroPosition: 'BTN',
    effectiveStackBb: 100, decisionFamily: 'preflop_rfi', actionAware: true, collectionBb: 0.25, anteType: 'none', anteBb: 0 });
  assert.equal(productionContext.schemaVersion, 'calibration-context/v2');
  const evidenceView = createPersonalStrategyEvidenceView({ profileId: 'p', modeId: 'a', context: productionContext,
    rangeObservations: [observation('AKs', 0.75, { context: productionContext })] });
  const result = createPersonalActionFamilyRange({ evidenceView, actionType: 'raise' });
  assert.equal(result.scope.context.stack.valueBb, 99.75);
  assert.ok(entries(result, 'AKs').every((entry) => entry.weight === 0.75));
  assert.equal(result.coverage.totalKnownWeight, 3);
  assert.equal(result.exactActionConditioning.permitted, false);
});

test('conflicts and retractions remove numeric authority without erasing lineage', () => {
  const first = observation('AA', 0.75), conflicting = observation('AA', 0.25);
  const result = bridge([first, conflicting]);
  assert.ok(entries(result, 'AA').every((entry) => entry.state === 'unknown'));
  assert.deepEqual(result.provenance.lineage.find((entry) => entry.handClass === 'AA').evidenceRefs.toSorted(), [first.id, conflicting.id].sort());
  const correction = observation('AA', null, { supersedesObservationId: first.id });
  assert.ok(entries(bridge([first, correction]), 'AA').every((entry) => entry.state === 'unknown'));
  const retracted = observation('AA', null, { dominantAction: null, state: 'retracted', supersedesObservationId: first.id });
  assert.ok(entries(bridge([first, retracted]), 'AA').every((entry) => entry.state === 'unknown'));
});

test('range provenance survives serialization and identity includes version, evidence, action and exact context', () => {
  const answer = observation('AKs', 0.25), result = bridge([answer]);
  const restored = deserializeHoldemWeightedRange(serializeHoldemWeightedRange(result.range));
  assert.deepEqual(restored, result.range);
  assert.equal(restored.provenance.sources[0].sourceId, answer.id);
  assert.equal(result.versions.setupVersion, 2);
  assert.equal(result.versions.approachVersion, 3);
  assert.equal(validatePersonalActionFamilyRange(JSON.parse(JSON.stringify(result))).fingerprint, result.fingerprint);
  assert.notEqual(result.fingerprint, bridge([observation('AKs', 0.5)]).fingerprint);
  const changed = structuredClone(result); changed.action.type = 'fold';
  assert.throws(() => validatePersonalActionFamilyRange(changed), /fingerprint/);
});

test('malformed exact weights, unknown provenance and illegal action types fail closed', () => {
  for (const probability of [NaN, -0.5, 1.5]) {
    const evidenceView = structuredClone(view([observation('AA', 0.5)]));
    evidenceView.points.find((entry) => entry.handClass === 'AA').strategyValue.exactFrequencies[0].probability = probability;
    assert.throws(() => createPersonalActionFamilyRange({ evidenceView, actionType: 'raise' }));
  }
  assert.throws(() => createPersonalActionFamilyRange({ evidenceView: view([]), actionType: 'bet' }), /unavailable/);
  const evidenceView = structuredClone(view([observation('AA', 0.5)])); evidenceView.directEvidence = [];
  assert.throws(() => createPersonalActionFamilyRange({ evidenceView, actionType: 'raise' }), /provenance/);
  const dominant = structuredClone(view([observation('AA')]));
  const point = dominant.points.find((entry) => entry.handClass === 'AA');
  point.resolution = 'direct_exact';
  point.strategyValue.exactFrequencies = [{ action: { type: 'raise' }, probability: 1 }, { action: { type: 'fold' }, probability: 0 }];
  assert.throws(() => createPersonalActionFamilyRange({ evidenceView: dominant, actionType: 'raise' }), /exact claims/);
  const wrongHand = structuredClone(view([observation('AA', 0.5)])); wrongHand.directEvidence[0].target.id = 'KK';
  assert.throws(() => createPersonalActionFamilyRange({ evidenceView: wrongHand, actionType: 'raise' }), /provenance/);
  const conflict = structuredClone(view([observation('AA', 0.5)]));
  conflict.points.find((entry) => entry.handClass === 'AA').strategyValue.exactFrequencies = [
    { action: { type: 'raise' }, probability: 0.8 }, { action: { type: 'fold' }, probability: 0.2 }];
  assert.throws(() => createPersonalActionFamilyRange({ evidenceView: conflict, actionType: 'raise' }), /exact claims/);
});

test('board-only removal cannot prove an action or flop range; unknown coverage is retained', () => {
  const result = createRangeContinuationFacts({ priorRange: bridge([observation('AA', 0.5)]), board: ['As', 'Kh', '2d'] });
  assert.equal(result.street, 'flop');
  assert.equal(result.availability, 'unavailable');
  assert.equal(result.conditionedRange, null);
  assert.ok(result.unavailableReasons.includes('exact_action_missing'));
  assert.equal(result.coverage.eligibleCombos, 1176);
  assert.equal(result.coverage.knownEligibleCombos, 3);
  assert.equal(result.coverage.totalEligibleWeight, 1.5);
  assert.equal(result.coverage.unknownEligibleCombos, 1173);
  assert.equal(result.boardRemoval.basis, 'physical_removal_only_not_action_history');
});

test('continuation rejects incompatible action/size, board, source, subject and prior node', () => {
  const priorRange = bridge([observation('AA', 1)]);
  const action = { type: 'raise', semantics: 'exact_action', amountSemantics: 'street_total_to', amountBb: 2.5 };
  const valid = createRangeContinuationFacts({ priorRange, action });
  assert.equal(valid.availability, 'unavailable');
  for (const extra of [{ action: { ...action, semantics: 'action_family' } }, { action: { ...action, amountSemantics: 'incremental_call' } },
    { action: { ...action, amountBb: null } }, { action: { ...action, type: 'bet' } }, { board: ['As', 'As', '2d'] },
    { sourceRole: 'opponent_policy' }, { subject: { profileId: 'p', modeId: 'other' } }, { priorNode: valid },
    { decisionContext: { schemaVersion: 'decision-context/v1', derivation: { source: 'scenario' } } }]) {
    assert.throws(() => createRangeContinuationFacts({ priorRange, ...extra }));
  }
});
