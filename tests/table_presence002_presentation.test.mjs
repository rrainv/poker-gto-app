import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TABLE_GEOMETRY_ANCHORS,
  TABLE_GEOMETRY_FAMILIES,
  TABLE_INTERACTIONS,
  TABLE_PRESENTATION_SCHEMA_VERSION,
  TABLE_PROJECTIONS,
  TABLE_VISUAL_STATES,
  createTablePresentation,
  tableGeometryFamily,
} from '../app/src/application/table-presentation.mjs';

function tablePresence(playerCount = 6, {
  actorIndex = 0,
  buttonIndex = 1,
  folded = [],
  known = [0],
  aggressorIndex = null,
  board = [],
} = {}) {
  return {
    schemaVersion: 'table-presence/v1',
    mode: 'hand',
    empty: false,
    status: 'active',
    street: board.length > 0 ? 'flop' : 'preflop',
    phase: 'betting',
    pendingChance: null,
    showStreetContributions: true,
    board: board.map((id) => ({ id, rank: id.slice(0, -1), suit: id.slice(-1) })),
    potMilliBb: 12_300,
    buttonSeat: buttonIndex,
    currentActorSeat: actorIndex,
    heroSeat: 0,
    seats: Array.from({ length: playerCount }, (_, visualSeatIndex) => ({
      playerId: `P${visualSeatIndex}`,
      seat: visualSeatIndex,
      visualSeatIndex,
      suppliedName: null,
      identity: visualSeatIndex === 0 ? 'Hero' : `P${visualSeatIndex}`,
      position: visualSeatIndex === 0 ? 'BTN' : `S${visualSeatIndex}`,
      isHero: visualSeatIndex === 0,
      isButton: visualSeatIndex === buttonIndex,
      isCurrentActor: visualSeatIndex === actorIndex,
      isWaitingToAct: visualSeatIndex === actorIndex,
      isFolded: folded.includes(visualSeatIndex),
      isAllIn: false,
      isDealtIn: true,
      currentStackMilliBb: 100_000 - (visualSeatIndex * 1_000),
      startingStackMilliBb: 100_000,
      streetContributionMilliBb: visualSeatIndex === 0 ? 2_000 : 1_000,
      totalPotContributionMilliBb: visualSeatIndex === 0 ? 2_000 : 1_000,
      cardVisibility: known.includes(visualSeatIndex) ? 'known' : 'hidden',
      hasCards: true,
      cards: known.includes(visualSeatIndex)
        ? [{ id: 'As', rank: 'A', suit: 's' }, { id: 'Kd', rank: 'K', suit: 'd' }]
        : [],
      latestAction: visualSeatIndex === aggressorIndex
        ? {
          sequence: 4,
          street: board.length > 0 ? 'flop' : 'preflop',
          type: 'raise',
          amountKind: 'amount_to',
          amountMilliBb: 8_000,
          wasAllIn: false,
        }
        : null,
    })),
  };
}

function legalActionSpec() {
  return {
    fold: { available: true },
    check: { available: false },
    call: { available: true, commitMilliBb: 2_500 },
    bet: { available: false },
    raise: { available: true, minToMilliBb: 7_500, maxToMilliBb: 98_000 },
    allIn: { available: true, amountToMilliBb: 100_000 },
  };
}

function assertDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeeplyFrozen(child);
}

test('table-presentation/v1 selects deliberate geometry for every player count', () => {
  const expectedFamilies = {
    2: TABLE_GEOMETRY_FAMILIES.HU,
    3: TABLE_GEOMETRY_FAMILIES.SPARSE,
    4: TABLE_GEOMETRY_FAMILIES.SPARSE,
    5: TABLE_GEOMETRY_FAMILIES.SPARSE,
    6: TABLE_GEOMETRY_FAMILIES.SIX_MAX,
    7: TABLE_GEOMETRY_FAMILIES.FULL_RING,
    8: TABLE_GEOMETRY_FAMILIES.FULL_RING,
    9: TABLE_GEOMETRY_FAMILIES.FULL_RING,
    10: TABLE_GEOMETRY_FAMILIES.FULL_RING,
  };

  for (let playerCount = 2; playerCount <= 10; playerCount += 1) {
    const presentation = createTablePresentation({
      tablePresence: tablePresence(playerCount),
      projection: TABLE_PROJECTIONS.PLAY,
      visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
      interaction: TABLE_INTERACTIONS.DECISION,
      legalActionSpec: legalActionSpec(),
      chipUnitMilliBb: 100,
    });
    assert.equal(tableGeometryFamily(playerCount), expectedFamilies[playerCount]);
    assert.equal(presentation.geometryFamily, expectedFamilies[playerCount]);
    assert.equal(presentation.geometryTemplate, `${expectedFamilies[playerCount]}-${playerCount}`);
    assert.equal(presentation.seats.length, playerCount);
    assert.deepEqual(
      presentation.seats.map((seat) => [seat.anchor.x, seat.anchor.y]),
      TABLE_GEOMETRY_ANCHORS[playerCount],
    );
  }
});

test('all normalized anchors are safe, unique, and keep Hero at the bottom', () => {
  for (let playerCount = 2; playerCount <= 10; playerCount += 1) {
    const presentation = createTablePresentation({
      tablePresence: tablePresence(playerCount),
      projection: TABLE_PROJECTIONS.PLAY,
      visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
    });
    const anchorKeys = new Set();
    for (const seat of presentation.seats) {
      assert.ok(seat.anchor.x >= 0.05 && seat.anchor.x <= 0.95);
      assert.ok(seat.anchor.y >= 0.05 && seat.anchor.y <= 0.95);
      anchorKeys.add(`${seat.anchor.x}:${seat.anchor.y}`);
    }
    assert.equal(anchorKeys.size, playerCount);
    assert.deepEqual(presentation.seats[0].anchor, {
      x: 0.5,
      y: playerCount <= 6 ? 0.85 : 0.84,
    });
  }
});

test('seat prominence resolves Hero, actor, relevant aggressor, live, and folded roles', () => {
  const presentation = createTablePresentation({
    tablePresence: tablePresence(6, {
      actorIndex: 0,
      aggressorIndex: 3,
      folded: [4],
    }),
    projection: TABLE_PROJECTIONS.PLAY,
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
    legalActionSpec: legalActionSpec(),
  });

  assert.equal(presentation.seats[0].prominence, 'hero');
  assert.equal(presentation.seats[0].actorCue, true);
  assert.equal(presentation.seats[3].prominence, 'relevant');
  assert.equal(presentation.seats[4].prominence, 'folded');
  assert.equal(presentation.seats[4].opacity, 1);
  assert.equal(presentation.seats[4].detail, 'compact');
  assert.equal(presentation.seats[2].prominence, 'live');

  const actorNotHero = createTablePresentation({
    tablePresence: tablePresence(6, { actorIndex: 2, aggressorIndex: 3 }),
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
  });
  assert.equal(actorNotHero.seats[2].prominence, 'actor');
});

test('dealer, contribution, board, and pot presentation retain canonical mapping', () => {
  const canonical = tablePresence(9, { actorIndex: 2, buttonIndex: 7, board: ['As', 'Kd', 'Qc'] });
  const presentation = createTablePresentation({
    tablePresence: canonical,
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
  });

  assert.equal(presentation.seats.filter((seat) => seat.dealer).length, 1);
  assert.equal(presentation.seats.find((seat) => seat.dealer).canonicalSeat, 7);
  assert.equal(presentation.geometry.potAnchor.y, 0.43);
  assert.deepEqual(presentation.geometry.physicality, {
    baseDepth: 12,
    railInnerInset: 9,
    cushionInset: 20,
    feltInset: 30,
    bettingLineInset: 52,
  });
  assert.equal(presentation.tablePresence.potMilliBb, canonical.potMilliBb);
  for (const seat of presentation.seats) {
    assert.equal(seat.showContribution, true);
    assert.ok(seat.contributionAnchor.x >= Math.min(seat.anchor.x, 0.5));
    assert.ok(seat.contributionAnchor.x <= Math.max(seat.anchor.x, 0.5));
    assert.ok(seat.contributionAnchor.y >= Math.min(seat.anchor.y, 0.43));
    assert.ok(seat.contributionAnchor.y <= Math.max(seat.anchor.y, 0.43));
    const distanceToPot = (anchor) => Math.hypot(anchor.x - 0.5, anchor.y - 0.43);
    assert.ok(distanceToPot(seat.dealerAnchor) < distanceToPot(seat.anchor));
    assert.ok(distanceToPot(seat.dealerAnchor) > distanceToPot(seat.contributionAnchor));
  }
});

test('decision dock exposes canonical legal actions and sizing bounds only in a live decision', () => {
  const live = createTablePresentation({
    tablePresence: tablePresence(),
    projection: TABLE_PROJECTIONS.PLAY,
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
    interaction: TABLE_INTERACTIONS.DECISION,
    legalActionSpec: legalActionSpec(),
    chipUnitMilliBb: 100,
    submissionLocked: true,
  });
  assert.deepEqual(live.decisionDock.actions.map((action) => action.type), [
    'fold', 'call', 'raise', 'all_in',
  ]);
  assert.deepEqual(live.decisionDock.actions.find((action) => action.type === 'raise'), {
    type: 'raise',
    minToMilliBb: 7_500,
    maxToMilliBb: 98_000,
  });
  assert.equal(live.decisionDock.chipUnitMilliBb, 100);
  assert.equal(live.decisionDock.locked, true);

  const complete = createTablePresentation({
    tablePresence: { ...tablePresence(), status: 'terminal', phase: 'terminal' },
    projection: TABLE_PROJECTIONS.REVIEW,
    visualState: TABLE_VISUAL_STATES.HAND_COMPLETE,
    interaction: TABLE_INTERACTIONS.PASSIVE,
    legalActionSpec: legalActionSpec(),
  });
  assert.equal(complete.completed, true);
  assert.equal(complete.decisionDock.available, false);
  assert.deepEqual(complete.decisionDock.actions, []);
});

test('timeline is reused, projection targets differ, and poker geometry is direction-stable', () => {
  const timeline = Object.freeze({
    schemaVersion: 'replay-projection/v1.timeline',
    groups: Object.freeze([]),
  });
  const canonical = Object.freeze(tablePresence(2));
  const play = createTablePresentation({
    tablePresence: canonical,
    timeline,
    projection: TABLE_PROJECTIONS.PLAY,
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
  });
  const review = createTablePresentation({
    tablePresence: canonical,
    timeline,
    projection: TABLE_PROJECTIONS.REVIEW,
    visualState: TABLE_VISUAL_STATES.POST_HAND_REVIEW,
    interaction: TABLE_INTERACTIONS.REPLAY,
  });
  const analyze = createTablePresentation({
    tablePresence: canonical,
    projection: TABLE_PROJECTIONS.ANALYZE,
    visualState: TABLE_VISUAL_STATES.POST_HAND_REVIEW,
    interaction: TABLE_INTERACTIONS.PASSIVE,
  });
  const savedPreview = createTablePresentation({
    tablePresence: canonical,
    projection: TABLE_PROJECTIONS.SAVED_PREVIEW,
    visualState: TABLE_VISUAL_STATES.POST_HAND_REVIEW,
    interaction: TABLE_INTERACTIONS.PASSIVE,
  });

  assert.strictEqual(play.timeline, timeline);
  assert.strictEqual(review.timeline, timeline);
  assert.equal(play.timelineMode, 'compact');
  assert.equal(review.timelineMode, 'review');
  assert.equal(play.sizingTarget.maxInlinePx, 1320);
  assert.equal(review.sizingTarget.maxInlinePx, 980);
  assert.equal(analyze.sizingTarget.maxInlinePx, 760);
  assert.equal(savedPreview.sizingTarget.maxInlinePx, 520);
  assert.equal(play.geometryDirection, 'poker_ltr');
  assert.deepEqual(play.seats.map((seat) => seat.anchor), review.seats.map((seat) => seat.anchor));
});

test('presentation output is deterministic, deeply frozen, and does not mutate inputs', () => {
  const canonical = tablePresence(10, { actorIndex: 8, folded: [2, 3] });
  const timeline = { groups: [{ street: 'preflop', items: [] }] };
  const canonicalSnapshot = structuredClone(canonical);
  const timelineSnapshot = structuredClone(timeline);
  const input = {
    tablePresence: canonical,
    timeline,
    projection: TABLE_PROJECTIONS.PLAY,
    visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
  };
  const first = createTablePresentation(input);
  const second = createTablePresentation(input);

  assert.equal(first.schemaVersion, TABLE_PRESENTATION_SCHEMA_VERSION);
  assert.deepEqual(first, second);
  assert.deepEqual(canonical, canonicalSnapshot);
  assert.deepEqual(timeline, timelineSnapshot);
  assert.equal(Object.isFrozen(canonical), false);
  assert.equal(Object.isFrozen(timeline), false);
  assertDeeplyFrozen(first);
});

test('unsupported player counts and non-presentation inputs fail explicitly', () => {
  assert.throws(() => tableGeometryFamily(1), /2 through 10/);
  assert.throws(() => tableGeometryFamily(11), /2 through 10/);
  assert.throws(() => createTablePresentation({ tablePresence: {} }), /Table Presence v1/);
  assert.throws(() => createTablePresentation({ projection: 'casino' }), /Unsupported table projection/);
});
