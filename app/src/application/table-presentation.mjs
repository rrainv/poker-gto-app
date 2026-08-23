export const TABLE_PRESENTATION_SCHEMA_VERSION = 'table-presentation/v1';

export const TABLE_PROJECTIONS = Object.freeze({
  PLAY: 'play',
  REVIEW: 'review',
  ANALYZE: 'analyze',
  SAVED_PREVIEW: 'saved_preview',
});

export const TABLE_VISUAL_STATES = Object.freeze({
  SETUP: 'setup',
  LIVE_DECISION: 'live_decision',
  ACTION_RESOLUTION: 'action_resolution',
  STREET_TRANSITION: 'street_transition',
  HAND_COMPLETE: 'hand_complete',
  POST_HAND_REVIEW: 'post_hand_review',
});

export const TABLE_INTERACTIONS = Object.freeze({
  DECISION: 'decision',
  REPLAY: 'replay',
  PASSIVE: 'passive',
});

export const TABLE_GEOMETRY_FAMILIES = Object.freeze({
  HU: 'hu',
  SPARSE: 'sparse',
  SIX_MAX: 'six_max',
  FULL_RING: 'full_ring',
});

const COORDINATE_SPACE = Object.freeze({ width: 1000, height: 650 });
const ACTION_ORDER = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);
const AGGRESSIVE_ACTIONS = new Set(['bet', 'raise', 'all_in']);

const ANCHORS_BY_PLAYER_COUNT = Object.freeze({
  2: Object.freeze([[0.50, 0.91], [0.50, 0.09]]),
  3: Object.freeze([[0.50, 0.91], [0.18, 0.20], [0.82, 0.20]]),
  4: Object.freeze([[0.50, 0.91], [0.12, 0.48], [0.50, 0.09], [0.88, 0.48]]),
  5: Object.freeze([[0.50, 0.91], [0.16, 0.62], [0.22, 0.18], [0.78, 0.18], [0.84, 0.62]]),
  6: Object.freeze([[0.50, 0.91], [0.17, 0.66], [0.17, 0.23], [0.50, 0.09], [0.83, 0.23], [0.83, 0.66]]),
  7: Object.freeze([[0.50, 0.91], [0.22, 0.76], [0.10, 0.45], [0.24, 0.14], [0.76, 0.14], [0.90, 0.45], [0.78, 0.76]]),
  8: Object.freeze([[0.50, 0.91], [0.22, 0.76], [0.10, 0.47], [0.24, 0.15], [0.50, 0.07], [0.76, 0.15], [0.90, 0.47], [0.78, 0.76]]),
  9: Object.freeze([[0.50, 0.91], [0.25, 0.79], [0.09, 0.56], [0.12, 0.27], [0.34, 0.09], [0.66, 0.09], [0.88, 0.27], [0.91, 0.56], [0.75, 0.79]]),
  10: Object.freeze([[0.50, 0.91], [0.26, 0.80], [0.09, 0.59], [0.09, 0.33], [0.27, 0.13], [0.50, 0.06], [0.73, 0.13], [0.91, 0.33], [0.91, 0.59], [0.74, 0.80]]),
});

const FAMILY_SPECIFICATIONS = Object.freeze({
  [TABLE_GEOMETRY_FAMILIES.HU]: Object.freeze({
    tableBounds: Object.freeze([0.13, 0.18, 0.74, 0.58]),
    playerUnit: Object.freeze({ width: 150, height: 78 }),
    cardScale: 1.25,
    cardOverlap: 0.18,
    boardScale: 1.12,
    contributionFraction: 0.46,
  }),
  sparse_large: Object.freeze({
    tableBounds: Object.freeze([0.11, 0.16, 0.78, 0.62]),
    playerUnit: Object.freeze({ width: 138, height: 74 }),
    cardScale: 1.15,
    cardOverlap: 0.22,
    boardScale: 1.08,
    contributionFraction: 0.46,
  }),
  sparse_five: Object.freeze({
    tableBounds: Object.freeze([0.09, 0.15, 0.82, 0.64]),
    playerUnit: Object.freeze({ width: 122, height: 70 }),
    cardScale: 1,
    cardOverlap: 0.28,
    boardScale: 1,
    contributionFraction: 0.46,
  }),
  [TABLE_GEOMETRY_FAMILIES.SIX_MAX]: Object.freeze({
    tableBounds: Object.freeze([0.09, 0.15, 0.82, 0.64]),
    playerUnit: Object.freeze({ width: 122, height: 70 }),
    cardScale: 1,
    cardOverlap: 0.28,
    boardScale: 1,
    contributionFraction: 0.50,
  }),
  [TABLE_GEOMETRY_FAMILIES.FULL_RING]: Object.freeze({
    tableBounds: Object.freeze([0.07, 0.13, 0.86, 0.67]),
    playerUnit: Object.freeze({ width: 104, height: 62 }),
    cardScale: 0.88,
    cardOverlap: 0.34,
    boardScale: 0.94,
    contributionFraction: 0.54,
  }),
});

const PROJECTION_SIZING = Object.freeze({
  [TABLE_PROJECTIONS.PLAY]: Object.freeze({ minInlinePx: 900, targetInlinePx: 1180, maxInlinePx: 1320 }),
  [TABLE_PROJECTIONS.REVIEW]: Object.freeze({ minInlinePx: 720, targetInlinePx: 860, maxInlinePx: 980 }),
  [TABLE_PROJECTIONS.ANALYZE]: Object.freeze({ minInlinePx: 520, targetInlinePx: 640, maxInlinePx: 760 }),
  [TABLE_PROJECTIONS.SAVED_PREVIEW]: Object.freeze({ minInlinePx: 320, targetInlinePx: 420, maxInlinePx: 520 }),
});

const ROLE_PRESENTATION = Object.freeze({
  hero: Object.freeze({ opacity: 1, detail: 'full', cardEmphasis: 'primary', contributionEmphasis: 'primary' }),
  actor: Object.freeze({ opacity: 1, detail: 'full', cardEmphasis: 'strong', contributionEmphasis: 'strong' }),
  relevant: Object.freeze({ opacity: 0.98, detail: 'standard', cardEmphasis: 'standard', contributionEmphasis: 'strong' }),
  live: Object.freeze({ opacity: 0.86, detail: 'standard', cardEmphasis: 'standard', contributionEmphasis: 'standard' }),
  folded: Object.freeze({ opacity: 0.42, detail: 'minimal', cardEmphasis: 'quiet', contributionEmphasis: 'quiet' }),
  empty: Object.freeze({ opacity: 0, detail: 'minimal', cardEmphasis: 'hidden', contributionEmphasis: 'hidden' }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isDeeplyFrozen(value) {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeeplyFrozen);
}

function immutableInputReference(value) {
  if (value === null || value === undefined || isDeeplyFrozen(value)) return value;
  return structuredClone(value);
}

function requireEnum(value, supported, name) {
  if (!Object.values(supported).includes(value)) {
    throw new RangeError(`Unsupported ${name}: ${String(value)}`);
  }
}

export function tableGeometryFamily(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 10) {
    throw new RangeError('Table presentation supports exactly 2 through 10 players');
  }
  if (playerCount === 2) return TABLE_GEOMETRY_FAMILIES.HU;
  if (playerCount <= 5) return TABLE_GEOMETRY_FAMILIES.SPARSE;
  if (playerCount === 6) return TABLE_GEOMETRY_FAMILIES.SIX_MAX;
  return TABLE_GEOMETRY_FAMILIES.FULL_RING;
}

function familySpecification(playerCount, family) {
  if (family === TABLE_GEOMETRY_FAMILIES.SPARSE) {
    return playerCount <= 4 ? FAMILY_SPECIFICATIONS.sparse_large : FAMILY_SPECIFICATIONS.sparse_five;
  }
  return FAMILY_SPECIFICATIONS[family];
}

function absoluteBounds(bounds) {
  return {
    x: bounds[0] * COORDINATE_SPACE.width,
    y: bounds[1] * COORDINATE_SPACE.height,
    width: bounds[2] * COORDINATE_SPACE.width,
    height: bounds[3] * COORDINATE_SPACE.height,
  };
}

function latestRelevantPlayerId(tablePresence, visualState) {
  const liveAggressors = tablePresence.seats
    .filter((seat) => !seat.isHero && !seat.isFolded && AGGRESSIVE_ACTIONS.has(seat.latestAction?.type))
    .sort((left, right) => (right.latestAction?.sequence ?? -1) - (left.latestAction?.sequence ?? -1));
  if (liveAggressors.length > 0) return liveAggressors[0].playerId;
  if (![TABLE_VISUAL_STATES.HAND_COMPLETE, TABLE_VISUAL_STATES.POST_HAND_REVIEW].includes(visualState)) {
    return null;
  }
  return tablePresence.seats.find((seat) => (
    !seat.isHero && !seat.isFolded && seat.cardVisibility === 'known'
  ))?.playerId ?? null;
}

function prominenceForSeat(seat, relevantPlayerId) {
  if (seat.isHero) return 'hero';
  if (seat.isCurrentActor) return 'actor';
  if (seat.playerId === relevantPlayerId) return 'relevant';
  if (seat.isDealtIn && !seat.isFolded) return 'live';
  if (seat.isFolded || !seat.isDealtIn) return 'folded';
  return 'empty';
}

function detailForSeat(role, family) {
  if (role === 'hero' || role === 'actor') return 'full';
  if (role === 'relevant') return family === TABLE_GEOMETRY_FAMILIES.FULL_RING ? 'compact' : 'standard';
  if (role === 'live') return family === TABLE_GEOMETRY_FAMILIES.FULL_RING ? 'compact' : 'standard';
  return 'minimal';
}

function contributionAnchor(anchor, potAnchor, fraction) {
  return {
    x: anchor.x + ((potAnchor.x - anchor.x) * fraction),
    y: anchor.y + ((potAnchor.y - anchor.y) * fraction),
  };
}

function decisionActions(legalActionSpec) {
  if (!legalActionSpec) return [];
  const actionOptions = {
    fold: legalActionSpec.fold,
    check: legalActionSpec.check,
    call: legalActionSpec.call,
    bet: legalActionSpec.bet,
    raise: legalActionSpec.raise,
    all_in: legalActionSpec.allIn,
  };
  return ACTION_ORDER.flatMap((type) => {
    const option = actionOptions[type];
    if (option?.available !== true) return [];
    const presentation = { type };
    if (type === 'call') presentation.commitMilliBb = option.commitMilliBb;
    if (type === 'all_in') presentation.amountToMilliBb = option.amountToMilliBb;
    if (type === 'bet' || type === 'raise') {
      presentation.minToMilliBb = option.minToMilliBb;
      presentation.maxToMilliBb = option.maxToMilliBb;
    }
    return [presentation];
  });
}

function defaultInteraction(projection, visualState) {
  if (projection === TABLE_PROJECTIONS.PLAY && visualState === TABLE_VISUAL_STATES.LIVE_DECISION) {
    return TABLE_INTERACTIONS.DECISION;
  }
  if (projection === TABLE_PROJECTIONS.REVIEW) return TABLE_INTERACTIONS.REPLAY;
  return TABLE_INTERACTIONS.PASSIVE;
}

function emptyPresentation({ projection, visualState, interaction, timeline, tablePresence }) {
  return deepFreeze({
    schemaVersion: TABLE_PRESENTATION_SCHEMA_VERSION,
    projection,
    visualState,
    geometryFamily: null,
    geometryTemplate: null,
    geometryDirection: 'poker_ltr',
    interaction,
    completed: visualState === TABLE_VISUAL_STATES.HAND_COMPLETE
      || visualState === TABLE_VISUAL_STATES.POST_HAND_REVIEW,
    timelineMode: projection === TABLE_PROJECTIONS.REVIEW ? 'review' : 'compact',
    timeline: immutableInputReference(timeline),
    sizingTarget: PROJECTION_SIZING[projection],
    decisionDock: { available: false, locked: false, actions: [], chipUnitMilliBb: null },
    tablePresence: immutableInputReference(tablePresence),
    seats: [],
  });
}

/**
 * Compose immutable presentation facts around existing canonical table, Replay,
 * and legal-action authorities. This model owns geometry and hierarchy only.
 */
export function createTablePresentation({
  projection = TABLE_PROJECTIONS.PLAY,
  visualState = TABLE_VISUAL_STATES.SETUP,
  interaction = null,
  tablePresence = null,
  timeline = null,
  legalActionSpec = null,
  chipUnitMilliBb = null,
  submissionLocked = false,
} = {}) {
  requireEnum(projection, TABLE_PROJECTIONS, 'table projection');
  requireEnum(visualState, TABLE_VISUAL_STATES, 'table visual state');
  const resolvedInteraction = interaction ?? defaultInteraction(projection, visualState);
  requireEnum(resolvedInteraction, TABLE_INTERACTIONS, 'table interaction');

  if (tablePresence === null || tablePresence?.empty === true) {
    return emptyPresentation({
      projection,
      visualState,
      interaction: resolvedInteraction,
      timeline,
      tablePresence,
    });
  }
  if (tablePresence?.schemaVersion !== 'table-presence/v1') {
    throw new TypeError('TablePresentation v1 requires Table Presence v1 facts');
  }

  const immutableTablePresence = immutableInputReference(tablePresence);
  const immutableTimeline = immutableInputReference(timeline);

  const playerCount = tablePresence.seats.length;
  const family = tableGeometryFamily(playerCount);
  const specification = familySpecification(playerCount, family);
  const anchors = ANCHORS_BY_PLAYER_COUNT[playerCount];
  const potAnchor = {
    x: 0.50,
    y: tablePresence.board.length > 0 ? 0.43 : 0.48,
  };
  const relevantPlayerId = latestRelevantPlayerId(tablePresence, visualState);
  const seats = tablePresence.seats.map((seat) => {
    const anchorValues = anchors[seat.visualSeatIndex];
    if (!anchorValues) {
      throw new RangeError(`Missing geometry anchor for visual seat ${seat.visualSeatIndex}`);
    }
    const anchor = { x: anchorValues[0], y: anchorValues[1] };
    const prominence = prominenceForSeat(seat, relevantPlayerId);
    const rolePresentation = ROLE_PRESENTATION[prominence];
    return {
      playerId: seat.playerId,
      canonicalSeat: seat.seat,
      visualSeatIndex: seat.visualSeatIndex,
      prominence,
      detail: detailForSeat(prominence, family),
      opacity: rolePresentation.opacity,
      cardEmphasis: rolePresentation.cardEmphasis,
      contributionEmphasis: rolePresentation.contributionEmphasis,
      anchor,
      contributionAnchor: contributionAnchor(
        anchor,
        potAnchor,
        specification.contributionFraction,
      ),
      dealer: seat.isButton === true,
      actorCue: seat.isCurrentActor === true,
      showContribution: tablePresence.showStreetContributions === true
        && seat.streetContributionMilliBb > 0,
    };
  });
  const decisionAvailable = resolvedInteraction === TABLE_INTERACTIONS.DECISION
    && visualState === TABLE_VISUAL_STATES.LIVE_DECISION
    && legalActionSpec !== null;

  return deepFreeze({
    schemaVersion: TABLE_PRESENTATION_SCHEMA_VERSION,
    projection,
    visualState,
    geometryFamily: family,
    geometryTemplate: `${family}-${playerCount}`,
    geometryDirection: 'poker_ltr',
    interaction: resolvedInteraction,
    completed: visualState === TABLE_VISUAL_STATES.HAND_COMPLETE
      || visualState === TABLE_VISUAL_STATES.POST_HAND_REVIEW,
    timelineMode: projection === TABLE_PROJECTIONS.REVIEW ? 'review' : 'compact',
    timeline: immutableTimeline,
    sizingTarget: PROJECTION_SIZING[projection],
    geometry: {
      coordinateSpace: COORDINATE_SPACE,
      tableBounds: absoluteBounds(specification.tableBounds),
      playerUnit: specification.playerUnit,
      cardScale: specification.cardScale,
      cardOverlap: specification.cardOverlap,
      boardScale: specification.boardScale,
      contributionFraction: specification.contributionFraction,
      potAnchor,
    },
    decisionDock: {
      available: decisionAvailable,
      locked: decisionAvailable && submissionLocked === true,
      actions: decisionAvailable ? decisionActions(legalActionSpec) : [],
      chipUnitMilliBb: decisionAvailable && Number.isSafeInteger(chipUnitMilliBb)
        ? chipUnitMilliBb
        : null,
    },
    tablePresence: immutableTablePresence,
    seats,
  });
}

export const TABLE_GEOMETRY_ANCHORS = ANCHORS_BY_PLAYER_COUNT;
