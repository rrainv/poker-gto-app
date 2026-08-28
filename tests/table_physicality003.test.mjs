import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  TABLE_VISUAL_STATES,
  createTablePresentation,
} from '../app/src/application/table-presentation.mjs';
import {
  tableCardBackSvgMarkup,
  tableCardSvgMarkup,
} from '../app/src/application/card-presentation.mjs';

const renderer = readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const primitives = readFileSync(new URL('../app/src/ui/PokerPrimitives.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

function tablePresence(playerCount) {
  return {
    schemaVersion: 'table-presence/v1',
    mode: 'hand',
    empty: false,
    status: 'active',
    street: 'preflop',
    phase: 'betting',
    pendingChance: null,
    showStreetContributions: true,
    board: [],
    potMilliBb: 1_500,
    buttonSeat: 0,
    currentActorSeat: 1,
    heroSeat: 0,
    seats: Array.from({ length: playerCount }, (_, visualSeatIndex) => ({
      playerId: `P${visualSeatIndex}`,
      seat: visualSeatIndex,
      visualSeatIndex,
      suppliedName: null,
      identity: visualSeatIndex === 0 ? 'Hero' : `P${visualSeatIndex}`,
      position: visualSeatIndex === 0 ? 'BTN' : `S${visualSeatIndex}`,
      isHero: visualSeatIndex === 0,
      isButton: visualSeatIndex === 0,
      isCurrentActor: visualSeatIndex === 1,
      isWaitingToAct: visualSeatIndex === 1,
      isFolded: false,
      isAllIn: false,
      isDealtIn: true,
      currentStackMilliBb: 100_000,
      startingStackMilliBb: 100_000,
      streetContributionMilliBb: visualSeatIndex < 2 ? 500 + (visualSeatIndex * 500) : 0,
      totalPotContributionMilliBb: visualSeatIndex < 2 ? 500 + (visualSeatIndex * 500) : 0,
      cardVisibility: visualSeatIndex === 0 ? 'known' : 'hidden',
      hasCards: true,
      cards: visualSeatIndex === 0
        ? [{ id: 'Ts', rank: 'T', suit: 's' }, { id: '9h', rank: '9', suit: 'h' }]
        : [],
      latestAction: null,
    })),
  };
}

test('HU through 10-max share one bounded physicality contract over adaptive geometry', () => {
  for (const playerCount of [2, 3, 6, 9, 10]) {
    const presentation = createTablePresentation({
      tablePresence: tablePresence(playerCount),
      visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
    });
    assert.equal(presentation.seats.length, playerCount);
    assert.equal(presentation.geometry.physicality.baseDepth, 12);
    assert.ok(presentation.geometry.physicality.railInnerInset
      < presentation.geometry.physicality.cushionInset);
    assert.ok(presentation.geometry.physicality.cushionInset
      < presentation.geometry.physicality.feltInset);
    for (const seat of presentation.seats) {
      const pot = presentation.geometry.potAnchor;
      const distance = (anchor) => Math.hypot(anchor.x - pot.x, anchor.y - pot.y);
      assert.ok(distance(seat.anchor) > distance(seat.dealerAnchor));
      assert.ok(distance(seat.dealerAnchor) > distance(seat.contributionAnchor));
    }
  }
});

test('felt, rail, depth, seats, cards, and the center pot render as one layered table world', () => {
  const orderedLayers = [
    'id="table-base"',
    'id="table-rail-outer"',
    'id="table-rail-inner"',
    'id="table-cushion"',
    'id="table-surface"',
    'id="table-felt-texture"',
    'id="table-betting-line"',
    'id="table-pot-zone"',
    "id: 'table-pot'",
    'id="table-contributions-layer"',
    'id="seats-layer"',
  ];
  let cursor = -1;
  for (const hook of orderedLayers) {
    const next = renderer.indexOf(hook);
    assert.ok(next > cursor, `${hook} must preserve physical layer order`);
    cursor = next;
  }
  for (const hook of [
    'table-seat-base', 'table-seat-surface', 'table-hole-cards',
  ]) assert.match(renderer, new RegExp(hook));
  assert.doesNotMatch(renderer, /table-seat-connector|table-card-cradle/);
  assert.doesNotMatch(css, /\.table-seat-connector|\.table-card-cradle/);
  assert.match(css, /\.table-base\s*\{[\s\S]*?drop-shadow/);
  assert.match(css, /\.table-cushion\s*\{[\s\S]*?drop-shadow/);
});

test('Balanced Hand consumes its allocated table region without a viewport-height cap', () => {
  assert.match(css, /#gtoMode\[data-product-destination="hand"\] \.table-wrapper\[data-table-projection="play"\] #visual-table-container \{\s*inline-size: min\(100%, var\(--table-inline-max\)\);\s*\}/);
  assert.match(css, /html\[data-layout-preset\] #gtoMode\[data-product-destination="hand"\] \.table-wrapper\[data-table-projection="play"\] #visual-table-container \{\s*inline-size: min\(100%, var\(--table-inline-max\)\);/);
  for (const playerCount of [2, 6, 10]) {
    const presentation = createTablePresentation({
      tablePresence: tablePresence(playerCount),
      visualState: TABLE_VISUAL_STATES.LIVE_DECISION,
    });
    assert.ok(presentation.geometry.tableBounds.width >= 0.86);
    assert.ok(presentation.geometry.tableBounds.height >= 0.66);
  }
});

test('known cards retain rank and suit hooks while hidden private cards remain backs', () => {
  const known = tableCardSvgMarkup({ rank: 'T', suit: 's', rankStyle: 'full-ten' });
  const hidden = tableCardBackSvgMarkup({ index: 0 });
  assert.match(known, /data-card-state="known"/);
  assert.match(known, /table-card-corner-rank/);
  assert.match(known, /table-card-corner-suit/);
  assert.match(known, /data-card-suit-id="s"/);
  assert.match(known, />10<\/text>/);
  assert.match(hidden, /data-card-state="unknown"/);
  assert.doesNotMatch(hidden, /table-card-corner-rank|table-card-corner-suit/);
  assert.match(renderer, /player\.cardVisibility === 'known'[\s\S]*?renderKnownCards/);
  assert.match(renderer, /player\.cardVisibility === 'hidden'[\s\S]*?renderCardBack\(0\)[\s\S]*?renderCardBack\(1\)/);
});

test('remaining stacks, contributions, and the central pot use distinct restrained chip groups', () => {
  assert.match(renderer, /id: `seat-stack-\$\{i\}`[\s\S]*?chipStyle: 'stack'/);
  assert.match(renderer, /id: `contribution-\$\{i\}`[\s\S]*?visualVariant: 'contribution'/);
  assert.match(renderer, /id: 'table-pot'[\s\S]*?visualVariant: 'pot'/);
  assert.equal((renderer.match(/id: `contribution-\$\{i\}`/g) || []).length, 1);
  assert.match(renderer, /contributionLane\?\.toggleAttribute\('hidden', !isVisible\)/);
  assert.match(renderer, /player\.streetContributionMilliBb > 0/);
  assert.match(primitives, /poker-chip-stack--\$\{supportedVariant\}/);
  assert.match(primitives, /poker-table-amount-surface/);
  assert.match(primitives, /poker-amount-value/);
  assert.match(primitives, /poker-amount-unit/);
  assert.doesNotMatch(primitives, /denomination|chipset|casino/i);
});

test('cards sit naturally in a radial felt lane and contributions use exact anchored amounts', () => {
  assert.match(renderer, /const cardCenterDistance = Math\.max\([\s\S]*?seatVector\.radialExtent \+ cardRadialExtent \+ cardSeatGap,[\s\S]*?feltEntryDistance \+ 1/);
  assert.match(renderer, /const cardCenterX = Math\.round\(seatVector\.unitX \* cardCenterDistance\)/);
  assert.match(renderer, /const cardCenterY = Math\.round\(seatVector\.unitY \* cardCenterDistance\)/);
  assert.match(renderer, /data-card-lane="radial-felt"/);
  assert.doesNotMatch(renderer, /table-seat-connector|table-card-cradle/);
  assert.match(renderer, /class="table-contribution-lane table-contribution-anchor"/);
  assert.doesNotMatch(renderer, /table-contribution-lane-path/);
  assert.doesNotMatch(css, /\.table-contribution-lane-path/);
  assert.match(css, /\.poker-table-amount--contribution \.poker-table-amount-surface\s*\{[\s\S]*?fill:\s*var\(--poker-table-contribution-surface\)/);
  assert.match(css, /\.poker-table-amount--contribution \.poker-table-amount-surface\s*\{[\s\S]*?filter:\s*none/);
});

test('dealer, seat states, contribution lanes, and motion stay semantic and accessible', () => {
  assert.match(renderer, /dealerAnchor/);
  assert.match(renderer, /data-anchor="table-felt-near-seat"/);
  assert.match(renderer, /dealer\.setAttribute\('aria-label'/);
  for (const stateHook of ['is-hero', 'is-actor', 'is-folded', 'is-all-in']) {
    assert.match(renderer, new RegExp(stateHook));
  }
  assert.match(renderer, /id="contribution-lane-\$\{i\}"/);
  assert.match(renderer, /motion\.kind === 'chips_commit'/);
  assert.match(renderer, /motion\.kind === 'pot_collect'/);
  assert.match(renderer, /motion\.kind === 'pot_award'/);
  assert.match(renderer, /motion\.kind === 'fold_retreat'/);
  assert.match(renderer, /--fold-retreat-x/);
  assert.match(css, /--card-deal-from-x/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.table-chip-flight \{ display: none !important; \}/);
});

test('themes and RTL change paint and chrome without mirroring poker geometry', () => {
  for (const theme of ['midnight', 'daylight', 'graphite']) {
    assert.match(css, new RegExp(`\\[data-theme="${theme}"\\]`));
  }
  for (const token of [
    '--poker-table-base-start', '--poker-table-rail-start',
    '--poker-table-cushion-start', '--poker-table-surface-start',
  ]) assert.match(css, new RegExp(token));
  assert.match(css, /\[dir="rtl"\] :is\(\.riverline-poker-table[\s\S]*?direction:\s*ltr/);
  assert.match(css, /\[dir="rtl"\] \.table-seat-stack,[\s\S]*?unicode-bidi:\s*isolate/);
});

test('physical presentation adds no poker, strategy, or accounting authority', () => {
  assert.doesNotMatch(renderer, /^\s*import\s/m);
  assert.doesNotMatch(renderer, /shared\/poker-domain|StrategyProvider|calculateEquity|getLegalActionSpec/);
  assert.doesNotMatch(
    renderer,
    /potMilliBb\s*[-+*/]|streetContributionMilliBb\s*[-+*/]|currentStackMilliBb\s*[-+*/]/,
  );
  assert.doesNotMatch(primitives, /PokerState|TablePresence|applyAction|potMilliBb|streetContributionMilliBb/);
});
