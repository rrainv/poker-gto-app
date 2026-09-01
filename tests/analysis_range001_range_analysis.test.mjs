import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  HOLDEM_COMBOS,
  PREFLOP_HAND_CLASSES,
  createFullyUnknownHoldemRange,
  createHoldemRangeProvenanceSource,
  createHoldemWeightedRangeFromEntries,
  createHoldemWeightedRangeFromHandClassWeights,
  holdemComboIdForCards,
} from '../shared/poker-domain/index.js';
import {
  RANGE_ANALYSIS_FACTS_SCHEMA_VERSION,
  RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION,
  createRangeAnalysisFacts,
  createRangeAnalysisRequest,
  deriveBoardStructureFacts,
  deriveExactHandFacts,
} from '../app/src/application/range-analysis.mjs';

const RANGE_ANALYSIS_SOURCE = fs.readFileSync(
  new URL('../app/src/application/range-analysis.mjs', import.meta.url),
  'utf8',
);

function exact(heroCards, board, deadCards = []) {
  return deriveExactHandFacts({ heroCards, board, deadCards });
}

function provenanceSource(kind = 'manual', id = kind) {
  return createHoldemRangeProvenanceSource({ id, kind, sourceId: `${id}-fixture` });
}

function fullRange(kind = 'manual') {
  const source = provenanceSource(kind);
  return createHoldemWeightedRangeFromHandClassWeights({
    rangeId: `complete-${kind}`,
    provenanceSources: [source],
    handClassWeights: Object.fromEntries(PREFLOP_HAND_CLASSES.map((handClass) => [
      handClass,
      { weight: 1, provenanceId: source.id },
    ])),
  });
}

function partialRange(kind = 'personal_direct') {
  const source = provenanceSource(kind);
  return createHoldemWeightedRangeFromHandClassWeights({
    rangeId: `partial-${kind}`,
    provenanceSources: [source],
    handClassWeights: {
      AA: { weight: 1, provenanceId: source.id },
      AKs: { weight: 0.5, provenanceId: source.id },
      '76s': { weight: 0.25, provenanceId: source.id },
    },
  });
}

function singleComboRange(cards, weight = 1) {
  const source = provenanceSource('manual', `manual-${cards.join('-')}`);
  return createHoldemWeightedRangeFromEntries({
    rangeId: `single-${cards.join('-')}`,
    provenanceSources: [source],
    entries: [{
      comboId: holdemComboIdForCards(cards),
      state: 'known',
      weight,
      provenanceId: source.id,
    }],
  });
}

function decisionContext(overrides = {}) {
  return {
    schemaVersion: 'decision-context/v1',
    tableSize: 6,
    opponentCount: null,
    heroPosition: 'BTN',
    street: 'flop',
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c'],
    deadCards: [],
    stackBb: 100,
    stackMode: 'hero',
    potBb: 8,
    lastAction: 'bet',
    facingSizeBb: 4,
    callAmountBb: null,
    heroStreetContributionBb: null,
    rakeMode: 'off',
    forcedContributionPerPlayerBb: 0,
    totalForcedContributionBb: 0,
    ...overrides,
  };
}

test('RangeAnalysisRequest v1 derives canonical cards from DecisionContext and is deeply immutable', () => {
  const context = decisionContext();
  const request = createRangeAnalysisRequest({
    decisionContext: context,
    provenance: {
      exactHand: { kind: 'scenario', label: 'Scenario cards' },
      board: { kind: 'scenario', label: 'Scenario board' },
    },
  });

  assert.equal(request.schemaVersion, RANGE_ANALYSIS_REQUEST_SCHEMA_VERSION);
  assert.deepEqual(request.heroCards, context.heroCards);
  assert.deepEqual(request.board, context.board);
  assert.equal(request.provenance.exactHand.kind, 'scenario');
  assert.ok(Object.isFrozen(request));
  assert.ok(Object.isFrozen(request.decisionContext));
  assert.throws(() => request.board.push('3s'), TypeError);
  assert.throws(() => createRangeAnalysisRequest({
    decisionContext: context,
    heroCards: ['Qs', 'Qh'],
  }), /must match/);
});

test('exact-hand facts reuse canonical rankings and add deterministic structural relationships', () => {
  const fixtures = [
    { hero: ['As', 'Kd'], board: ['Qc', '7h', '2s'], primary: 'high_card', relationship: 'high_card' },
    { hero: ['As', 'Ad'], board: ['Kc', '7d', '2h'], primary: 'one_pair', relationship: 'overpair' },
    { hero: ['As', 'Kd'], board: ['Ah', '7d', '2c'], primary: 'one_pair', relationship: 'top_pair' },
    { hero: ['As', '8s'], board: ['Kh', '8d', '2c'], primary: 'one_pair', relationship: 'middle_pair' },
    { hero: ['As', '2s'], board: ['Kh', '8d', '2c'], primary: 'one_pair', relationship: 'lower_pair' },
    { hero: ['As', '7s'], board: ['Ah', '7d', '2c'], primary: 'two_pair', relationship: 'two_pair' },
    { hero: ['7s', '7d'], board: ['7c', 'Kh', '2d'], primary: 'three_of_a_kind', relationship: 'set' },
    { hero: ['As', '7s'], board: ['7c', '7d', 'Kh'], primary: 'three_of_a_kind', relationship: 'trips' },
    { hero: ['8s', '9d'], board: ['6c', '7h', 'Ts'], primary: 'straight', relationship: 'straight' },
    { hero: ['As', '5s'], board: ['Ks', '9s', '2s'], primary: 'flush', relationship: 'flush' },
    { hero: ['7s', '7d'], board: ['7c', 'Kh', 'Kd'], primary: 'full_house', relationship: 'full_house' },
    { hero: ['7s', '7d'], board: ['7c', '7h', 'Kd'], primary: 'four_of_a_kind', relationship: 'four_of_a_kind' },
    { hero: ['8s', '9s'], board: ['6s', '7s', 'Ts'], primary: 'straight_flush', relationship: 'straight_flush' },
  ];

  for (const fixture of fixtures) {
    const facts = exact(fixture.hero, fixture.board);
    assert.equal(facts.primaryCategory, fixture.primary, `${fixture.hero} / ${fixture.board}`);
    assert.equal(facts.relationship, fixture.relationship, `${fixture.hero} / ${fixture.board}`);
    assert.equal(facts.canonicalRank.category, fixture.primary);
  }
});

test('board-made river strength is explicit and does not attribute the board to Hero', () => {
  const facts = exact(['2c', '3d'], ['As', 'Ks', 'Qs', 'Js', 'Ts']);
  assert.equal(facts.primaryCategory, 'straight_flush');
  assert.equal(facts.relationship, 'plays_board');
  assert.equal(facts.playsBoard, true);
  assert.equal(facts.usesHeroCards, false);
  assert.ok(facts.components.includes('plays_board'));
});

test('plays-board relationship composition counts each known combo and its mass exactly once', () => {
  const analysis = createRangeAnalysisFacts({
    board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    ranges: {
      hero: { role: 'hero', range: singleComboRange(['2c', '3d'], 0.5) },
    },
  }).ranges.hero;
  const playsBoard = analysis.composition.postflop.relationships.plays_board;
  assert.equal(playsBoard.knownComboCount, 1);
  assert.equal(playsBoard.positiveWeightComboCount, 1);
  assert.equal(playsBoard.knownComboMass, 0.5);
  assert.equal(playsBoard.normalizedShare, null);
});

test('draw facts support flush, nut flush, OESD, gutshot, double-gutshot, and made-hand coexistence', () => {
  const nutFlush = exact(['As', '5s'], ['2s', '9s', 'Kd']);
  assert.equal(nutFlush.draws.flushDraw, true);
  assert.equal(nutFlush.draws.nutFlushDraw, true);

  const nonNut = exact(['Qs', '5s'], ['2s', '9s', 'Kd']);
  assert.equal(nonNut.draws.flushDraw, true);
  assert.equal(nonNut.draws.nutFlushDraw, false);

  const oesd = exact(['8s', '9d'], ['6c', '7h', 'Ks']);
  assert.equal(oesd.draws.openEndedStraightDraw, true);
  assert.deepEqual(oesd.draws.straightOutRankSymbols, ['5', 'T']);

  const gutshot = exact(['9s', 'Td'], ['7c', 'Jh', 'As']);
  assert.equal(gutshot.draws.gutshot, true);
  assert.equal(gutshot.draws.doubleGutshot, false);

  const doubleGutshot = exact(['2s', '4s'], ['5s', '6s', '8h']);
  assert.equal(doubleGutshot.draws.doubleGutshot, true);
  assert.deepEqual(doubleGutshot.draws.straightOutRankSymbols, ['3', '7']);

  const madePlusDraw = exact(['As', 'Ks'], ['Ah', 'Qs', 'Js']);
  assert.equal(madePlusDraw.relationship, 'top_pair');
  assert.equal(madePlusDraw.draws.flushDraw, true);
  assert.equal(madePlusDraw.draws.gutshot, true);
  assert.equal(madePlusDraw.draws.madeHandAndDraw, true);
});

test('direct wheel straight-flush draw exposes one exact out and overlapping completion families', () => {
  const facts = exact(['Ah', '4h'], ['2h', '3h', '9s']);
  assert.equal(facts.draws.nutFlushDraw, true);
  assert.equal(facts.draws.gutshot, true);
  assert.equal(facts.draws.straightFlushDraw, true);
  assert.equal(facts.draws.royalFlushDraw, false);
  assert.equal(facts.draws.wheelStraightFlushDraw, true);
  assert.equal(facts.draws.straightFlushDrawSubtype, 'gutshot');
  assert.equal(facts.draws.straightFlushCompletionSubtype, 'wheel');
  assert.equal(facts.draws.straightFlushDrawType, 'gutshot_straight_flush_draw');
  assert.deepEqual(facts.draws.straightFlushCompletions, [{ card: '5h', subtype: 'wheel' }]);
  assert.deepEqual(facts.draws.straightFlushOutCards, ['5h']);
  assert.equal(facts.draws.straightFlushOutCount, 1);
  assert.deepEqual(facts.draws.straightCompletionCards, ['5s', '5h', '5d', '5c']);
  assert.ok(facts.draws.flushCompletionCards.includes('5h'));
  assert.deepEqual(facts.draws.overlappingCompletionCards, ['5h']);
  assert.equal(facts.drawOuts, facts.draws.drawOuts);
  assert.equal(facts.drawOuts.semantics, 'structural_direct_improvement_cards');
  assert.deepEqual(facts.drawOuts.straight, {
    available: true,
    subtype: 'gutshot',
    completionRanks: [5],
    completionCards: ['5s', '5h', '5d', '5c'],
    count: 4,
  });
  assert.deepEqual(facts.drawOuts.straightFlush.completionResults, [
    { card: '5h', subtype: 'wheel' },
  ]);
  assert.deepEqual(facts.drawOuts.overlaps, [{
    card: '5h', families: ['flush', 'straight', 'straight_flush'],
  }]);
  assert.equal(facts.drawOuts.uniqueCompletionCardCount, 12);
  assert.equal(new Set(facts.drawOuts.uniqueCompletionCards).size, 12);
  assert.equal(facts.drawOuts.uniqueCompletionCards.filter((card) => card === '5h').length, 1);
  assert.equal(facts.drawOuts.equityCalculated, false);

  const blocked = exact(['Ah', '4h'], ['2h', '3h', '9s'], ['5h']);
  assert.equal(blocked.draws.straightFlushDraw, false);
  assert.equal(blocked.draws.straightFlushOutCount, 0);
  assert.deepEqual(blocked.draws.straightFlushCompletions, []);
  assert.equal(blocked.drawOuts.flush.completionCards.includes('5h'), false);
  assert.equal(blocked.drawOuts.straight.completionCards.includes('5h'), false);
  assert.equal(blocked.drawOuts.uniqueCompletionCards.includes('5h'), false);
  assert.deepEqual(blocked.drawOuts.overlaps, []);
});

test('suited four-card sequence exposes a direct open-ended straight-flush draw', () => {
  const facts = exact(['6h', '7h'], ['8h', '9h', '2s']);
  assert.equal(facts.draws.openEndedStraightDraw, true);
  assert.equal(facts.draws.straightFlushDrawSubtype, 'open_ended');
  assert.equal(facts.draws.straightFlushDrawType, 'open_ended_straight_flush_draw');
  assert.deepEqual(facts.drawOuts.straightFlush.completionCards, ['5h', 'Th']);
  assert.equal(facts.drawOuts.straightFlush.count, 2);
  assert.deepEqual(facts.drawOuts.overlaps, [
    { card: '5h', families: ['flush', 'straight', 'straight_flush'] },
    { card: 'Th', families: ['flush', 'straight', 'straight_flush'] },
  ]);
});

test('genuine turn double-gutshot straight-flush geometry remains explicit', () => {
  const facts = exact(['7h', 'Jh'], ['5h', '8h', '9h', '2c']);
  assert.equal(facts.primaryCategory, 'flush');
  assert.equal(facts.draws.doubleGutshot, true);
  assert.equal(facts.draws.straightFlushDrawSubtype, 'double_gutshot');
  assert.equal(facts.draws.straightFlushDrawType, 'double_gutshot_straight_flush_draw');
  assert.deepEqual(facts.drawOuts.straightFlush.completionCards, ['6h', 'Th']);
});

test('four-to-royal state reports one shared direct royal-flush completion', () => {
  const facts = exact(['As', 'Ks'], ['Qs', 'Js', '2d']);
  assert.equal(facts.draws.straightFlushDraw, true);
  assert.equal(facts.draws.royalFlushDraw, true);
  assert.equal(facts.draws.straightFlushDrawSubtype, 'gutshot');
  assert.equal(facts.draws.straightFlushCompletionSubtype, 'royal');
  assert.equal(facts.draws.straightFlushDrawType, 'royal_flush_draw');
  assert.deepEqual(facts.draws.straightFlushCompletions, [{ card: 'Ts', subtype: 'royal' }]);
  assert.equal(facts.draws.straightFlushOutCount, 1);
  assert.deepEqual(facts.draws.overlappingCompletionCards, ['Ts']);
  assert.deepEqual(facts.drawOuts.straightFlush.completionResults, [
    { card: 'Ts', subtype: 'royal' },
  ]);
});

test('canonical straight and straight-flush ranks gain deterministic structural subtypes', () => {
  const wheel = exact(['As', '4d'], ['2c', '3h', '5s']);
  assert.equal(wheel.primaryCategory, 'straight');
  assert.equal(wheel.madeHandSubtype, 'wheel');

  const broadway = exact(['As', 'Kd'], ['Qc', 'Jh', 'Ts']);
  assert.equal(broadway.primaryCategory, 'straight');
  assert.equal(broadway.madeHandSubtype, 'broadway');

  const wheelStraightFlush = exact(['Ah', '4h'], ['2h', '3h', '5h']);
  assert.equal(wheelStraightFlush.primaryCategory, 'straight_flush');
  assert.equal(wheelStraightFlush.madeHandSubtype, 'wheel');

  const royal = exact(['As', 'Ks'], ['Qs', 'Js', 'Ts']);
  assert.equal(royal.primaryCategory, 'straight_flush');
  assert.equal(royal.madeHandSubtype, 'royal');

  const ordinary = exact(['8s', '9s'], ['6s', '7s', 'Ts']);
  assert.equal(ordinary.primaryCategory, 'straight_flush');
  assert.equal(ordinary.madeHandSubtype, 'ordinary');
});

test('overlapping flush and straight outs do not imply a false straight-flush draw', () => {
  const facts = exact(['Ah', '4h'], ['Kh', '2h', '3c']);
  assert.equal(facts.draws.flushDraw, true);
  assert.equal(facts.draws.gutshot, true);
  assert.deepEqual(facts.draws.overlappingCompletionCards, ['5h']);
  assert.equal(facts.draws.straightFlushDraw, false);
  assert.deepEqual(facts.draws.straightFlushCompletions, []);
  assert.equal(facts.drawOuts.overlaps.find((entry) => entry.card === '5h').families.includes('straight_flush'), false);
});

test('river suppresses draw labels while retaining made royal and wheel taxonomy', () => {
  const royal = exact(['As', 'Ks'], ['Qs', 'Js', 'Ts', '2d', '3c']);
  assert.equal(royal.primaryCategory, 'straight_flush');
  assert.equal(royal.madeHandSubtype, 'royal');
  assert.equal(royal.draws.available, false);
  assert.deepEqual(royal.draws.tags, []);
  assert.equal(royal.drawOuts.available, false);
  assert.deepEqual(royal.drawOuts.uniqueCompletionCards, []);

  const wheel = exact(['Ah', '4h'], ['2h', '3h', '5h', 'Kd', 'Qc']);
  assert.equal(wheel.primaryCategory, 'straight_flush');
  assert.equal(wheel.madeHandSubtype, 'wheel');
  assert.equal(wheel.draws.available, false);
  assert.equal(wheel.drawOuts.uniqueCompletionCardCount, 0);
});

test('made hand and draw retain first-class structural completion cards', () => {
  const facts = exact(['As', 'Ks'], ['Ah', 'Qs', 'Js']);
  assert.equal(facts.primaryCategory, 'one_pair');
  assert.equal(facts.draws.madeHandAndDraw, true);
  assert.equal(facts.drawOuts.flush.count, 9);
  assert.equal(facts.drawOuts.straight.count, 4);
  assert.deepEqual(facts.drawOuts.straightFlush.completionResults, [
    { card: 'Ts', subtype: 'royal' },
  ]);
});

test('draw facts prevent board-only, monotone, pocket-pair, and river false positives', () => {
  const boardOnlyStraightDraw = exact(['2s', '2d'], ['6c', '7h', '8s', '9d']);
  assert.equal(boardOnlyStraightDraw.draws.openEndedStraightDraw, false);
  assert.equal(boardOnlyStraightDraw.draws.gutshot, false);

  const monotoneWithoutSuit = exact(['Ah', 'Kd'], ['2s', '7s', 'Ts']);
  assert.equal(monotoneWithoutSuit.draws.flushDraw, false);

  const pocketPair = exact(['As', 'Ad'], ['Kc', '7d', '2h']);
  assert.equal(pocketPair.draws.overcardCount, 0);

  const river = exact(['As', '5s'], ['2s', '9s', 'Kd', '4c', 'Jh']);
  assert.equal(river.draws.available, false);
  assert.deepEqual(river.draws.tags, []);
});

test('opponent effective nut-flush draws account for exact Hero blockers without self-blocking Hero ranges', () => {
  const range = singleComboRange(['Ks', 'Qs']);
  const withHeroAce = createRangeAnalysisFacts({
    heroCards: ['As', 'Kd'],
    board: ['2s', '7s', 'Jh'],
    ranges: { villain: { role: 'opponent', range } },
  }).ranges.villain;
  assert.equal(withHeroAce.composition.postflop.draws.flush_draw.knownComboMass, 1);
  assert.equal(withHeroAce.composition.postflop.draws.nut_flush_draw.knownComboMass, 1);

  const withoutHeroAce = createRangeAnalysisFacts({
    heroCards: ['Ah', 'Kd'],
    board: ['2s', '7s', 'Jh'],
    ranges: { villain: { role: 'opponent', range } },
  }).ranges.villain;
  assert.equal(withoutHeroAce.composition.postflop.draws.flush_draw.knownComboMass, 1);
  assert.equal(withoutHeroAce.composition.postflop.draws.nut_flush_draw.knownComboMass, 0);

  const heroAlternatives = createRangeAnalysisFacts({
    heroCards: ['As', 'Kd'],
    board: ['2s', '7s', 'Jh'],
    ranges: { hero: { role: 'hero', range } },
  }).ranges.hero;
  assert.equal(heroAlternatives.composition.postflop.draws.flush_draw.knownComboMass, 1);
  assert.equal(heroAlternatives.composition.postflop.draws.nut_flush_draw.knownComboMass, 0);
});

test('board structure exposes pairing, suits, connectivity, and completion states without strategic claims', () => {
  const doublePaired = deriveBoardStructureFacts(['Ah', 'Ad', 'Kc', 'Kd']);
  assert.equal(doublePaired.paired, true);
  assert.equal(doublePaired.doublePaired, true);

  const rainbow = deriveBoardStructureFacts(['Ah', '7d', '2c']);
  assert.equal(rainbow.suitTexture, 'rainbow');
  assert.equal(rainbow.connectivity, 'disconnected');

  const twoTone = deriveBoardStructureFacts(['9h', '8h', '7c']);
  assert.equal(twoTone.suitTexture, 'two_tone');
  assert.equal(twoTone.connectivity, 'connected');

  const monotone = deriveBoardStructureFacts(['As', '9s', '2s']);
  assert.equal(monotone.suitTexture, 'monotone');
  assert.equal(monotone.flushCompletionState, 'three_flush');

  const completion = deriveBoardStructureFacts(['6s', '7d', '8c', '9h']);
  assert.deepEqual(completion.straightCompletionRanks, [5, 10]);
  assert.equal(completion.straightCompletedOnBoard, false);

  assert.equal(deriveBoardStructureFacts(['Ah', 'Ah', '2c']).available, false);
});

test('complete supplied range is blocker-conditioned exactly and normalized only after valid completeness', () => {
  const facts = createRangeAnalysisFacts({
    decisionContext: decisionContext(),
    ranges: {
      villain: {
        role: 'opponent',
        subjectId: 'villain-seat-3',
        label: 'Manual Villain range',
        range: fullRange(),
        source: { kind: 'manual', label: 'Manual range fixture' },
      },
    },
  });
  const villain = facts.ranges.villain;

  assert.equal(facts.schemaVersion, RANGE_ANALYSIS_FACTS_SCHEMA_VERSION);
  assert.equal(facts.blockers.rawCombosRemovedByHeroCards, 101);
  assert.equal(villain.eligibility.eligibleComboCount, 1081);
  assert.equal(villain.eligibility.knownEligibleComboMass, 1081);
  assert.equal(villain.blockers.boardAndDeadRemovedComboCount, 150);
  assert.equal(villain.blockers.physicalEligibleComboCountBeforeHero, 1176);
  assert.equal(villain.blockers.physicalEligibleComboCountAfterHero, 1081);
  assert.equal(villain.blockers.heroRemovedComboCount, 95);
  assert.equal(villain.blockers.heroRemovedKnownComboMass, 95);
  assert.deepEqual(
    villain.blockers.perHeroCard.map((entry) => entry.incrementalComboCount),
    [48, 47],
  );
  assert.equal(villain.blockers.perCardDirectEffectsMayOverlap, true);
  assert.ok(villain.blockers.mostAffectedClasses.length > 0);
  assert.equal(villain.normalization.available, true);

  const primaryMass = Object.values(villain.composition.postflop.primary)
    .reduce((sum, metric) => sum + metric.knownComboMass, 0);
  const primaryShare = Object.values(villain.composition.postflop.primary)
    .reduce((sum, metric) => sum + metric.normalizedShare, 0);
  assert.equal(primaryMass, 1081);
  assert.ok(Math.abs(primaryShare - 1) < 1e-12);
  assert.equal(villain.composition.postflop.drawAttributesOverlap, true);
  assert.equal(villain.blockers.heroConditioningApplied, true);
  assert.equal(facts.blockers.interpretation, 'structural_only');
});

test('range composition keeps straight flush primary mass exclusive and draw mass overlapping', () => {
  const facts = createRangeAnalysisFacts({
    board: ['Ks', '2h', '3h'],
    ranges: {
      hero: { role: 'hero', range: singleComboRange(['Ah', '4h']) },
    },
  }).ranges.hero.composition.postflop;
  const primaryMass = Object.values(facts.primary)
    .reduce((sum, metric) => sum + metric.knownComboMass, 0);
  assert.equal(primaryMass, 1);
  assert.equal(facts.primary.high_card.knownComboMass, 1);
  assert.equal(facts.primary.straight.knownComboMass, 0);
  assert.equal(facts.primary.flush.knownComboMass, 0);
  assert.equal(facts.primary.straight_flush.knownComboMass, 0);
  assert.equal(facts.draws.flush_draw.knownComboMass, 1);
  assert.equal(facts.draws.gutshot.knownComboMass, 1);
  assert.equal(facts.draws.straight_flush_draw.knownComboMass, 1);
  assert.equal(facts.draws.wheel_straight_flush_draw.knownComboMass, 1);

  const made = createRangeAnalysisFacts({
    board: ['6s', '7s', 'Ts'],
    ranges: {
      hero: { role: 'hero', range: singleComboRange(['8s', '9s']) },
    },
  }).ranges.hero.composition.postflop;
  assert.equal(made.primary.straight_flush.knownComboMass, 1);
  assert.equal(made.primary.straight.knownComboMass, 0);
  assert.equal(made.primary.flush.knownComboMass, 0);
  assert.equal(Object.values(made.primary)
    .reduce((sum, metric) => sum + metric.knownComboMass, 0), 1);
});

test('Hero range is conditioned by board/dead cards but not by the exact Hero alternative', () => {
  const facts = createRangeAnalysisFacts({
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c'],
    ranges: {
      hero: { role: 'hero', label: 'Manual Hero range', range: fullRange() },
    },
  });
  const hero = facts.ranges.hero;
  assert.equal(hero.eligibility.eligibleComboCount, 1176);
  assert.equal(hero.blockers.heroConditioningApplied, false);
  assert.equal(hero.blockers.heroRemovedComboCount, 0);
});

test('partial and fully unknown ranges preserve unknown semantics and never expose whole-range normalization', () => {
  const partialFacts = createRangeAnalysisFacts({
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c'],
    ranges: {
      villain: {
        role: 'opponent',
        range: partialRange(),
        source: { kind: 'personal_direct', label: 'Direct personal fixture' },
      },
    },
  }).ranges.villain;

  assert.equal(partialFacts.inspection.state, 'partial');
  assert.ok(partialFacts.eligibility.unknownEligibleComboCount > 0);
  assert.equal(partialFacts.normalization.available, false);
  assert.equal(partialFacts.normalization.unavailableReason, 'partial_range');
  for (const metric of Object.values(partialFacts.composition.postflop.primary)) {
    assert.equal(metric.normalizedShare, null);
  }
  assert.equal(partialFacts.source.kind, 'personal_direct');
  assert.equal(partialFacts.rangeProvenance.sources[0].kind, 'personal_direct');

  const unknown = createRangeAnalysisFacts({
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c'],
    ranges: { villain: { role: 'opponent', range: createFullyUnknownHoldemRange() } },
  }).ranges.villain;
  assert.equal(unknown.inspection.fullyUnknown, true);
  assert.equal(unknown.eligibility.knownEligibleComboMass, 0);
  assert.equal(unknown.normalization.available, false);
  assert.equal(unknown.source.kind, 'unknown');
});

test('range provenance keeps direct, inferred, and unknown sources distinct', () => {
  const direct = partialRange('personal_direct');
  const inferred = partialRange('personal_inferred');
  const facts = createRangeAnalysisFacts({
    heroCards: ['Qs', 'Jh'],
    ranges: {
      direct: { role: 'hero', range: direct },
      inferred: { role: 'opponent', range: inferred },
      unknown: { role: 'opponent', range: createFullyUnknownHoldemRange() },
    },
  });

  assert.equal(facts.ranges.direct.source.kind, 'personal_direct');
  assert.equal(facts.ranges.inferred.source.kind, 'personal_inferred');
  assert.equal(facts.ranges.unknown.source.kind, 'unknown');
  assert.equal(facts.provenance.ranges.inferred.kind, 'personal_inferred');
});

test('facts retain decision economics needed by BLUFF-001 without calculating bluff profitability', () => {
  const facts = createRangeAnalysisFacts({ decisionContext: decisionContext() });
  assert.deepEqual(facts.decision, {
    sourceSchemaVersion: 'decision-context/v1',
    street: 'flop',
    potBb: 8,
    currentPotBb: null,
    callAmountBb: null,
    actorContestablePotAfterCallBb: null,
    actorIneligiblePotAfterCallBb: null,
    requiredRawEquity: null,
    facingSizeBb: 4,
    heroStreetContributionBb: null,
    stackBb: 100,
    opponentCount: null,
    tableSize: 6,
  });
  assert.equal(facts.rangeAvailability, 'unavailable');
  assert.ok(facts.limitations.includes('no_action_ev'));
  assert.doesNotMatch(JSON.stringify(facts.blockers), /good|bad|profitable|optimal/i);
});

test('range analysis remains DOM-free, strategy-free, Equity-free, and bounded for 1,326 combos', () => {
  assert.doesNotMatch(RANGE_ANALYSIS_SOURCE, /globalThis\.document|globalThis\.window|HTMLElement|querySelector/);
  assert.doesNotMatch(RANGE_ANALYSIS_SOURCE, /strategy-provider|createStrategyProvider|\.resolve\(/i);
  assert.doesNotMatch(RANGE_ANALYSIS_SOURCE, /calculateEquity|equity-request|Monte Carlo/i);
  assert.match(RANGE_ANALYSIS_SOURCE, /evaluateFive/);
  assert.match(RANGE_ANALYSIS_SOURCE, /conditionHoldemRange/);

  const range = fullRange();
  const started = performance.now();
  const facts = createRangeAnalysisFacts({
    heroCards: ['As', 'Kd'],
    board: ['Ah', '7d', '2c', '4s', '9h'],
    ranges: { villain: { role: 'opponent', range } },
  });
  const elapsed = performance.now() - started;
  assert.equal(facts.ranges.villain.composition.postflop.classifiedKnownCombos, 990);
  assert.ok(elapsed < 2_000, `range analysis took ${elapsed.toFixed(1)} ms`);
  assert.equal(HOLDEM_COMBOS.length, 1326);
});
