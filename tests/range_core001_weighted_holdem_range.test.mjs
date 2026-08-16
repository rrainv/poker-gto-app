import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import {
  ACTION_TYPES,
  HOLDEM_COMBOS,
  HOLDEM_COMBO_ID_PREFIX,
  HOLDEM_DECK,
  HOLDEM_RANGE_ENTRY_STATES,
  HOLDEM_RANGE_PROVENANCE_KINDS,
  HOLDEM_RANGE_UNLISTED_POLICIES,
  HOLDEM_WEIGHTED_RANGE_SCHEMA_VERSION,
  PREFLOP_HAND_CLASSES,
  conditionHoldemRange,
  createEmptyCompleteHoldemRange,
  createFullyUnknownHoldemRange,
  createHoldemRangeProvenanceSource,
  createHoldemWeightedRangeFromEntries,
  createHoldemWeightedRangeFromHandClassWeights,
  createNormalizedHoldemDistribution,
  deserializeHoldemWeightedRange,
  getHoldemComboById,
  getHoldemComboForCards,
  getHoldemCombosForHandClass,
  holdemComboIdForCards,
  inspectHoldemWeightedRange,
  isCard,
  preflopHandClassForCards,
  projectHoldemRangeToMatrix,
  serializeHoldemWeightedRange,
  validateHoldemWeightedRange,
  withHoldemComboOverrides,
} from '../shared/poker-domain/index.js';
import {
  createRangeObservation,
  createRfiCalibrationContext,
} from '../app/src/personal-strategy/domain.mjs';

const DIRECT_SOURCE = createHoldemRangeProvenanceSource({
  id: 'personal-direct',
  kind: HOLDEM_RANGE_PROVENANCE_KINDS.PERSONAL_DIRECT,
  sourceId: 'observation-1',
  sourceSchemaVersion: 'range-observation/v1',
  createdAt: '2026-08-16T00:00:00.000Z',
});

const INFERRED_SOURCE = createHoldemRangeProvenanceSource({
  id: 'personal-inferred',
  kind: HOLDEM_RANGE_PROVENANCE_KINDS.PERSONAL_INFERRED,
  sourceId: 'future-inference-1',
  sourceSchemaVersion: 'future-inferred-range/v1',
});

const MANUAL_SOURCE = createHoldemRangeProvenanceSource({
  id: 'manual',
  kind: HOLDEM_RANGE_PROVENANCE_KINDS.MANUAL,
  sourceId: 'range-builder-draft',
});

function allClassWeights(weight) {
  return Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [handClass, weight]));
}

function completeUniformRange(weight = 1) {
  return createHoldemWeightedRangeFromHandClassWeights({
    rangeId: `uniform-${weight}`,
    handClassWeights: allClassWeights(weight),
    unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
  });
}

function mutableCopy(value) {
  return structuredClone(value);
}

function matrixCell(projection, handClass) {
  return projection.cells.find((cell) => cell.handClass === handClass);
}

test('canonical Holdem deck and unordered combo registry are exhaustive and deterministic', () => {
  assert.equal(HOLDEM_DECK.length, 52);
  assert.equal(new Set(HOLDEM_DECK).size, 52);
  assert.ok(HOLDEM_DECK.every(isCard));
  assert.deepEqual(HOLDEM_DECK.slice(0, 5), ['2s', '2h', '2d', '2c', '3s']);
  assert.deepEqual(HOLDEM_DECK.slice(-4), ['As', 'Ah', 'Ad', 'Ac']);

  assert.equal(HOLDEM_COMBOS.length, 1326);
  assert.equal(new Set(HOLDEM_COMBOS.map((combo) => combo.id)).size, 1326);
  assert.equal(new Set(HOLDEM_COMBOS.map((combo) => combo.cards.join('|'))).size, 1326);
  assert.equal(HOLDEM_COMBOS[0].id, `${HOLDEM_COMBO_ID_PREFIX}2s:2h`);
  assert.equal(HOLDEM_COMBOS.at(-1).id, `${HOLDEM_COMBO_ID_PREFIX}Ad:Ac`);

  for (const combo of HOLDEM_COMBOS) {
    assert.equal(combo.cards.length, 2);
    assert.notEqual(combo.cards[0], combo.cards[1]);
    assert.equal(combo.handClass, preflopHandClassForCards(combo.cards));
    assert.equal(getHoldemComboById(combo.id), combo);
    assert.ok(Object.isFrozen(combo));
    assert.ok(Object.isFrozen(combo.cards));
  }

  const forward = getHoldemComboForCards(['Ah', 'Kh']);
  const reverse = getHoldemComboForCards(['Kh', 'Ah']);
  assert.equal(forward, reverse);
  assert.equal(holdemComboIdForCards(['Ah', 'Kh']), holdemComboIdForCards(['Kh', 'Ah']));
  assert.throws(() => getHoldemComboForCards(['As', 'As']), /cannot repeat/i);
  assert.throws(() => getHoldemComboForCards(['AS', 'Kh']), /strict two-character/i);
});

test('all 1,326 combos map exactly to the canonical 169 hand classes and physical counts', () => {
  assert.equal(PREFLOP_HAND_CLASSES.length, 169);
  assert.equal(new Set(PREFLOP_HAND_CLASSES).size, 169);

  let total = 0;
  let pairCells = 0;
  let suitedCells = 0;
  let offsuitCells = 0;
  for (const handClass of PREFLOP_HAND_CLASSES) {
    const combos = getHoldemCombosForHandClass(handClass);
    const expected = handClass.length === 2 ? 6 : handClass.endsWith('s') ? 4 : 12;
    assert.equal(combos.length, expected, handClass);
    assert.ok(combos.every((combo) => combo.handClass === handClass));
    total += combos.length;
    if (handClass.length === 2) pairCells += 1;
    else if (handClass.endsWith('s')) suitedCells += 1;
    else offsuitCells += 1;
  }
  assert.deepEqual({ pairCells, suitedCells, offsuitCells, total }, {
    pairCells: 13,
    suitedCells: 78,
    offsuitCells: 78,
    total: 1326,
  });
});

test('known zero remains structurally different from unknown coverage', () => {
  const empty = createEmptyCompleteHoldemRange({ rangeId: 'empty' });
  const unknown = createFullyUnknownHoldemRange({ rangeId: 'unknown' });
  const emptyFacts = inspectHoldemWeightedRange(empty);
  const unknownFacts = inspectHoldemWeightedRange(unknown);

  assert.deepEqual({
    state: emptyFacts.state,
    known: emptyFacts.knownCombos,
    unknown: emptyFacts.unknownCombos,
    coverage: emptyFacts.coverageRatio,
    mass: emptyFacts.totalKnownWeight,
    emptyComplete: emptyFacts.emptyComplete,
  }, {
    state: 'complete', known: 1326, unknown: 0, coverage: 1, mass: 0, emptyComplete: true,
  });
  assert.deepEqual({
    state: unknownFacts.state,
    known: unknownFacts.knownCombos,
    unknown: unknownFacts.unknownCombos,
    coverage: unknownFacts.coverageRatio,
    mass: unknownFacts.totalKnownWeight,
    fullyUnknown: unknownFacts.fullyUnknown,
  }, {
    state: 'partial', known: 0, unknown: 1326, coverage: 0, mass: 0, fullyUnknown: true,
  });
  assert.equal(empty.entries[0].state, HOLDEM_RANGE_ENTRY_STATES.KNOWN);
  assert.equal(empty.entries[0].weight, 0);
  assert.equal(unknown.entries[0].state, HOLDEM_RANGE_ENTRY_STATES.UNKNOWN);
  assert.equal(Object.hasOwn(unknown.entries[0], 'weight'), false);
});

test('class weights expand across physical combos and combo mass is not normalized probability', () => {
  const range = createHoldemWeightedRangeFromHandClassWeights({
    handClassWeights: { AA: 1, AKs: 0.5, AKo: 0.25 },
    unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
  });
  const facts = inspectHoldemWeightedRange(range);
  assert.equal(facts.complete, true);
  assert.equal(facts.totalKnownWeight, 11); // 6 + 4*.5 + 12*.25
  assert.equal(getHoldemCombosForHandClass('AA').reduce(
    (sum, combo) => sum + range.entries.find((entry) => entry.comboId === combo.id).weight,
    0,
  ), 6);
  assert.equal(getHoldemCombosForHandClass('AKs').reduce(
    (sum, combo) => sum + range.entries.find((entry) => entry.comboId === combo.id).weight,
    0,
  ), 2);
  assert.equal(getHoldemCombosForHandClass('AKo').reduce(
    (sum, combo) => sum + range.entries.find((entry) => entry.comboId === combo.id).weight,
    0,
  ), 3);
});

test('weights fail closed outside finite [0, 1] and malformed entry states are rejected', () => {
  for (const weight of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => createHoldemWeightedRangeFromHandClassWeights({ handClassWeights: { AA: weight } }),
      /finite and within \[0, 1\]/i,
    );
  }
  for (const weight of [0, 0.375, 1]) {
    assert.doesNotThrow(
      () => createHoldemWeightedRangeFromHandClassWeights({ handClassWeights: { AA: weight } }),
    );
  }
  const comboId = HOLDEM_COMBOS[0].id;
  assert.throws(() => createHoldemWeightedRangeFromEntries({
    entries: [{ comboId, state: 'unknown', weight: 0, provenanceId: null }],
  }), /unknown combo entry must not assert weight/i);
  assert.throws(() => createHoldemWeightedRangeFromEntries({
    entries: [
      { comboId, state: 'known', weight: 0, provenanceId: null },
      { comboId, state: 'known', weight: 1, provenanceId: null },
    ],
  }), /duplicate combo entry/i);
});

test('per-combo provenance supports direct, inferred, and unresolved Personal Strategy facts', () => {
  const directRange = createHoldemWeightedRangeFromHandClassWeights({
    rangeId: 'personal-rfi',
    handClassWeights: {
      AA: { weight: 1, provenanceId: DIRECT_SOURCE.id },
    },
    provenanceSources: [INFERRED_SOURCE, DIRECT_SOURCE],
  });
  const inferredComboId = holdemComboIdForCards(['Kh', 'Qh']);
  const range = withHoldemComboOverrides(directRange, [{
    comboId: inferredComboId,
    state: HOLDEM_RANGE_ENTRY_STATES.KNOWN,
    weight: 0.6,
    provenanceId: INFERRED_SOURCE.id,
  }]);

  for (const combo of getHoldemCombosForHandClass('AA')) {
    const entry = range.entries.find((candidate) => candidate.comboId === combo.id);
    assert.deepEqual(
      { state: entry.state, weight: entry.weight, provenanceId: entry.provenanceId },
      { state: 'known', weight: 1, provenanceId: DIRECT_SOURCE.id },
    );
  }
  assert.equal(range.entries.find((entry) => entry.comboId === inferredComboId).provenanceId, INFERRED_SOURCE.id);
  const unresolved = range.entries.find((entry) => getHoldemComboById(entry.comboId).handClass === '72o');
  assert.equal(unresolved.state, HOLDEM_RANGE_ENTRY_STATES.UNKNOWN);
  assert.equal(Object.hasOwn(unresolved, 'weight'), false);
  assert.deepEqual(range.provenance.sources.map((source) => source.id), ['personal-direct', 'personal-inferred']);
  assert.equal(Object.hasOwn(INFERRED_SOURCE, 'confidence'), false);
});

test('manual provenance remains source metadata rather than confidence or strategy frequency', () => {
  const comboId = holdemComboIdForCards(['As', 'Ks']);
  const range = createHoldemWeightedRangeFromEntries({
    rangeId: 'manual-range',
    provenanceSources: [MANUAL_SOURCE],
    entries: [{ comboId, state: 'known', weight: 0.4, provenanceId: MANUAL_SOURCE.id }],
  });
  const entry = range.entries.find((candidate) => candidate.comboId === comboId);
  assert.deepEqual(entry, {
    comboId,
    state: 'known',
    weight: 0.4,
    provenanceId: 'manual',
  });
  assert.equal(range.provenance.sources[0].kind, 'manual');
  assert.equal(Object.hasOwn(range.provenance.sources[0], 'confidence'), false);
  assert.equal(Object.hasOwn(range.provenance.sources[0], 'actionFrequency'), false);
});

test('an explicit direct RFI mix can supply an asserted class weight without treating dominant-only answers as pure', () => {
  const context = createRfiCalibrationContext({
    gameRulesId: 'riverline-holdem/v1',
    tableSize: 6,
    heroPosition: 'BTN',
    effectiveStackBb: 100,
  });
  const explicit = createRangeObservation({
    id: 'direct-explicit-aa',
    profileId: 'profile-1',
    modeId: 'mode-1',
    context,
    handClass: 'AA',
    dominantAction: { type: ACTION_TYPES.RAISE },
    frequencies: [{ action: { type: ACTION_TYPES.RAISE }, probability: 1 }],
    createdAt: '2026-08-16T00:00:00.000Z',
  });
  const dominantOnly = createRangeObservation({
    id: 'direct-dominant-aks',
    profileId: 'profile-1',
    modeId: 'mode-1',
    context,
    handClass: 'AKs',
    dominantAction: { type: ACTION_TYPES.RAISE },
    createdAt: '2026-08-16T00:00:01.000Z',
  });
  assert.equal(explicit.hasExplicitFrequencies, true);
  assert.equal(explicit.frequencies[0].probability, 1);
  assert.equal(dominantOnly.hasExplicitFrequencies, false);
  assert.equal(dominantOnly.frequencies, null);

  const range = createHoldemWeightedRangeFromHandClassWeights({
    handClassWeights: [{
      handClass: explicit.handClass,
      weight: explicit.frequencies[0].probability,
      provenanceId: DIRECT_SOURCE.id,
    }],
    provenanceSources: [DIRECT_SOURCE],
  });
  assert.equal(getHoldemCombosForHandClass('AA').every((combo) => (
    range.entries.find((entry) => entry.comboId === combo.id).weight === 1
  )), true);
  assert.equal(getHoldemCombosForHandClass('AKs').every((combo) => (
    range.entries.find((entry) => entry.comboId === combo.id).state === 'unknown'
  )), true, 'dominant-only action evidence must not become an implicit pure range weight');
});

test('blocker conditioning removes exact combos, retains semantics/provenance, and never mutates source', () => {
  const range = completeUniformRange(1);
  const beforeJson = serializeHoldemWeightedRange(range);
  const one = conditionHoldemRange(range, ['As']);
  assert.deepEqual({
    eligible: one.facts.eligibleCombos,
    blocked: one.facts.blockedCombos,
    massBefore: one.facts.totalKnownWeightBefore,
    massAfter: one.facts.totalEligibleWeight,
    blockedMass: one.facts.blockedKnownWeight,
  }, { eligible: 1275, blocked: 51, massBefore: 1326, massAfter: 1275, blockedMass: 51 });
  assert.ok(one.blockedEntries.every((entry) => getHoldemComboById(entry.comboId).cards.includes('As')));
  assert.ok(one.eligibleEntries.every((entry) => !getHoldemComboById(entry.comboId).cards.includes('As')));
  assert.equal(one.derivationProvenance.kind, HOLDEM_RANGE_PROVENANCE_KINDS.DERIVED_FILTER);
  assert.equal(one.derivationProvenance.operation, 'blocker_conditioning');

  const two = conditionHoldemRange(range, ['Kd', 'As']);
  assert.deepEqual(two.blockers, ['Kd', 'As']);
  assert.equal(two.facts.blockedCombos, 101);
  assert.equal(two.facts.eligibleCombos, 1225);
  const board = conditionHoldemRange(range, ['2c', '3d', '4h']);
  assert.equal(board.facts.blockedCombos, 150);
  assert.equal(board.facts.eligibleCombos, 1176);

  assert.equal(serializeHoldemWeightedRange(range), beforeJson);
  assert.ok(Object.isFrozen(one));
  assert.ok(Object.isFrozen(one.eligibleEntries));
  assert.throws(() => conditionHoldemRange(range, ['As', 'As']), /duplicate known card/i);
  assert.throws(() => conditionHoldemRange(range, ['AS']), /strict two-character/i);
});

test('every individual blocker removes exactly the other 51 physical-card combos', () => {
  const range = completeUniformRange(1);
  for (const card of HOLDEM_DECK) {
    const conditioned = conditionHoldemRange(range, [card]);
    assert.equal(conditioned.facts.blockedCombos, 51, card);
    assert.equal(conditioned.facts.eligibleCombos, 1275, card);
  }
});

test('conditioning keeps unknown entries unknown instead of silently assigning zero', () => {
  const range = createHoldemWeightedRangeFromHandClassWeights({
    handClassWeights: { AA: { weight: 1, provenanceId: DIRECT_SOURCE.id } },
    provenanceSources: [DIRECT_SOURCE],
  });
  const conditioned = conditionHoldemRange(range, ['2c']);
  assert.equal(conditioned.facts.completeBefore, false);
  assert.equal(conditioned.facts.completeAfterConditioning, false);
  assert.ok(conditioned.eligibleEntries.some((entry) => entry.state === 'unknown'));
  assert.ok(conditioned.eligibleEntries.filter((entry) => entry.state === 'unknown')
    .every((entry) => !Object.hasOwn(entry, 'weight')));
  assert.ok(conditioned.eligibleEntries.filter((entry) => entry.state === 'known')
    .every((entry) => entry.provenanceId === DIRECT_SOURCE.id));
});

test('normalized distribution is derived only from complete positive eligible mass', () => {
  const complete = createHoldemWeightedRangeFromHandClassWeights({
    handClassWeights: { AA: 1 },
    unlistedState: HOLDEM_RANGE_UNLISTED_POLICIES.KNOWN_ZERO,
  });
  const unblocked = createNormalizedHoldemDistribution(complete);
  assert.equal(unblocked.totalEligibleWeight, 6);
  assert.ok(Math.abs(unblocked.probabilityTotal - 1) < 1e-12);
  assert.equal(unblocked.entries.filter((entry) => entry.probability > 0).length, 6);
  assert.ok(unblocked.entries.filter((entry) => entry.probability > 0)
    .every((entry) => entry.probability === 1 / 6));

  const blocked = createNormalizedHoldemDistribution(complete, { blockers: ['As'] });
  assert.equal(blocked.totalEligibleWeight, 3);
  assert.ok(Math.abs(blocked.probabilityTotal - 1) < 1e-12);
  assert.equal(blocked.entries.filter((entry) => entry.probability > 0).length, 3);
  assert.ok(blocked.entries.filter((entry) => entry.probability > 0)
    .every((entry) => entry.probability === 1 / 3));

  assert.throws(
    () => createNormalizedHoldemDistribution(createFullyUnknownHoldemRange()),
    /incomplete Holdem range/i,
  );
  assert.throws(
    () => createNormalizedHoldemDistribution(createEmptyCompleteHoldemRange()),
    /zero-mass Holdem range/i,
  );
});

test('DOM-free Matrix projection reports exact class structure and preserves intra-class variation', () => {
  const partial = createHoldemWeightedRangeFromHandClassWeights({
    handClassWeights: {
      AA: 1,
      AKs: 0.5,
    },
  });
  const partialProjection = projectHoldemRangeToMatrix(partial);
  assert.deepEqual(partialProjection.facts, {
    totalCells: 169,
    pairCells: 13,
    suitedCells: 78,
    offsuitCells: 78,
  });
  assert.deepEqual(partialProjection.composition.pair, {
    classCount: 13,
    physicalComboCount: 78,
    knownComboCount: 6,
    unknownComboCount: 72,
    totalKnownWeight: 6,
  });
  assert.deepEqual(matrixCell(partialProjection, 'AA'), {
    ...matrixCell(partialProjection, 'AA'),
    physicalComboCount: 6,
    knownComboCount: 6,
    unknownComboCount: 0,
    knownCoverageFraction: 1,
    totalKnownWeight: 6,
    derivedAverageKnownWeight: 1,
    derivedUniformWeight: 1,
    complete: true,
    state: 'complete',
    hasIntraClassVariation: false,
  });
  const aks = matrixCell(partialProjection, 'AKs');
  assert.deepEqual({
    count: aks.physicalComboCount,
    known: aks.knownComboCount,
    mass: aks.totalKnownWeight,
    average: aks.derivedAverageKnownWeight,
    uniform: aks.derivedUniformWeight,
  }, { count: 4, known: 4, mass: 2, average: 0.5, uniform: 0.5 });
  const ako = matrixCell(partialProjection, 'AKo');
  assert.deepEqual({
    count: ako.physicalComboCount,
    known: ako.knownComboCount,
    unknown: ako.unknownComboCount,
    average: ako.derivedAverageKnownWeight,
    uniform: ako.derivedUniformWeight,
  }, { count: 12, known: 0, unknown: 12, average: null, uniform: null });

  const aksCombos = getHoldemCombosForHandClass('AKs');
  const varied = withHoldemComboOverrides(createEmptyCompleteHoldemRange(), [
    { comboId: aksCombos[0].id, state: 'known', weight: 1, provenanceId: null },
    { comboId: aksCombos[1].id, state: 'known', weight: 0.25, provenanceId: null },
  ]);
  const variedCell = matrixCell(projectHoldemRangeToMatrix(varied), 'AKs');
  assert.equal(variedCell.complete, true);
  assert.equal(variedCell.hasIntraClassVariation, true);
  assert.equal(variedCell.derivedUniformWeight, null);
  assert.deepEqual(variedCell.comboEntries.map((entry) => entry.weight), [1, 0.25, 0, 0]);

  const partiallyKnown = withHoldemComboOverrides(createFullyUnknownHoldemRange(), [
    { comboId: aksCombos[0].id, state: 'known', weight: 1, provenanceId: null },
    { comboId: aksCombos[1].id, state: 'known', weight: 0.25, provenanceId: null },
  ]);
  const partialCell = matrixCell(projectHoldemRangeToMatrix(partiallyKnown), 'AKs');
  assert.deepEqual({
    known: partialCell.knownComboCount,
    unknown: partialCell.unknownComboCount,
    coverage: partialCell.knownCoverageFraction,
    mass: partialCell.totalKnownWeight,
    average: partialCell.derivedAverageKnownWeight,
    uniform: partialCell.derivedUniformWeight,
    state: partialCell.state,
    varies: partialCell.hasIntraClassVariation,
  }, {
    known: 2,
    unknown: 2,
    coverage: 0.5,
    mass: 1.25,
    average: 0.625,
    uniform: null,
    state: 'partial',
    varies: true,
  });
  assert.deepEqual(partialCell.comboEntries.map((entry) => entry.state), [
    'known', 'known', 'unknown', 'unknown',
  ]);
});

test('serialization is deterministic, portable, immutable after parse, and rejects malformed data', () => {
  const range = createHoldemWeightedRangeFromHandClassWeights({
    rangeId: 'portable-range',
    handClassWeights: {
      AA: { weight: 1, provenanceId: DIRECT_SOURCE.id },
      AKs: { weight: 0.5, provenanceId: INFERRED_SOURCE.id },
    },
    provenanceSources: [INFERRED_SOURCE, DIRECT_SOURCE],
  });
  const serialized = serializeHoldemWeightedRange(range);
  const roundTrip = deserializeHoldemWeightedRange(serialized);
  assert.deepEqual(roundTrip, range);
  assert.equal(serializeHoldemWeightedRange(roundTrip), serialized);
  assert.ok(Object.isFrozen(roundTrip));
  assert.ok(Object.isFrozen(roundTrip.entries));
  assert.ok(Object.isFrozen(roundTrip.entries[0]));

  const wrongSchema = mutableCopy(range);
  wrongSchema.schemaVersion = 'holdem-weighted-range/v2';
  assert.throws(() => validateHoldemWeightedRange(wrongSchema), /Expected holdem-weighted-range\/v1/);
  const wrongGame = mutableCopy(range);
  wrongGame.game = 'omaha';
  assert.throws(() => validateHoldemWeightedRange(wrongGame), /game must be holdem/i);
  const missing = mutableCopy(range);
  missing.entries.pop();
  assert.throws(() => validateHoldemWeightedRange(missing), /exactly 1326/i);
  const outOfOrder = mutableCopy(range);
  [outOfOrder.entries[0], outOfOrder.entries[1]] = [outOfOrder.entries[1], outOfOrder.entries[0]];
  assert.throws(() => validateHoldemWeightedRange(outOfOrder), /canonical deterministic combo order/i);
  const duplicate = mutableCopy(range);
  duplicate.entries[1] = { ...duplicate.entries[0] };
  assert.throws(() => validateHoldemWeightedRange(duplicate), /duplicate combo entry/i);
  const invalidCombo = mutableCopy(range);
  invalidCombo.entries[0].comboId = 'holdem-combo/v1:As:As';
  assert.throws(() => validateHoldemWeightedRange(invalidCombo), /not a canonical Holdem combo ID/i);
  const badReference = mutableCopy(range);
  badReference.entries[0].provenanceId = 'missing-source';
  assert.throws(() => validateHoldemWeightedRange(badReference), /must reference range provenance/i);
  const fakeConfidence = mutableCopy(range);
  fakeConfidence.provenance.sources[0].confidence = 0.9;
  assert.throws(() => validateHoldemWeightedRange(fakeConfidence), /must contain exactly/i);
  const badWeight = mutableCopy(createEmptyCompleteHoldemRange());
  badWeight.entries[0].weight = Number.POSITIVE_INFINITY;
  assert.throws(() => validateHoldemWeightedRange(badWeight), /finite and within/i);
  assert.throws(() => deserializeHoldemWeightedRange('{not json'), SyntaxError);
});

test('construction, conditioning, projection, and normalization remain comfortably interactive', (t) => {
  const timings = {};
  let started = performance.now();
  const range = completeUniformRange(0.5);
  timings.constructionMs = performance.now() - started;

  started = performance.now();
  conditionHoldemRange(range, ['As', 'Kd', '7h', '2c', '3d']);
  timings.conditioningMs = performance.now() - started;

  started = performance.now();
  projectHoldemRangeToMatrix(range);
  timings.projectionMs = performance.now() - started;

  started = performance.now();
  createNormalizedHoldemDistribution(range, { blockers: ['As', 'Kd', '7h'] });
  timings.normalizationMs = performance.now() - started;

  t.diagnostic(JSON.stringify(timings));
  for (const [operation, milliseconds] of Object.entries(timings)) {
    assert.ok(milliseconds < 1000, `${operation} took ${milliseconds.toFixed(1)}ms`);
  }
});
