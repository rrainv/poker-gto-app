import test from 'node:test';
import vm from 'node:vm';
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
import { appStyleSheet, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: styles.css assertions are resolved through the cascade
// on table-structure probes (renderer/primitives sources are outside this
// ticket).
const css = appStyleSheet();
const markup = indexDocument();
function probe(html, parent = markup.body) {
  const host = markup.createElement('div');
  host.innerHTML = html;
  parent.appendChild(host);
  return host.firstElementChild;
}

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
  assert.equal(css.rulesMentioning('.table-seat-connector').length + css.rulesMentioning('.table-card-cradle').length, 0);
  const table = probe('<svg class="riverline-poker-table"><path class="table-base"></path><path class="table-cushion"></path></svg>');
  assert.match(css.cascaded(table.querySelector('.table-base'), 'filter'), /^drop-shadow\(/);
  assert.match(css.cascaded(table.querySelector('.table-cushion'), 'filter'), /^drop-shadow\(/);
});

test('Balanced Hand consumes its allocated table region without a viewport-height cap', () => {
  // The Hand play table fills its region with no viewport-height cap, with
  // or without a layout preset. (Superseded literal: the
  // min(100%, var(--table-inline-max)) cap became a full-region fill.)
  const gto = markup.getElementById('gtoMode');
  gto.dataset.productDestination = 'hand';
  const wrapper = markup.getElementById('table-wrapper');
  wrapper.dataset.tableProjection = 'play';
  const container = markup.getElementById('visual-table-container');
  const root = markup.documentElement;
  const preset = root.dataset.layoutPreset;
  for (const layout of [preset, undefined]) {
    if (layout === undefined) delete root.dataset.layoutPreset; else root.dataset.layoutPreset = layout;
    for (const width of [1280, 1920]) {
      const size = css.cascaded(container, 'inline-size', { width });
      assert.doesNotMatch(size, /d?vh/, `${layout} ${width}: ${size}`);
    }
  }
  if (preset !== undefined) root.dataset.layoutPreset = preset;
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
  const context = {};
  vm.runInNewContext(primitives, context);
  const chip = context.RiverlinePokerPrimitives;
  const remaining = chip.pokerAmountSvg({ chipStyle: 'stack', value: '98' });
  const contribution = chip.pokerTableAmountSvg({ visualVariant: 'contribution', value: '1' });
  const pot = chip.pokerTableAmountSvg({ visualVariant: 'pot', prefix: 'Pot', value: '2.5' });
  assert.match(remaining, /poker-chip-stack--remaining/);
  assert.match(contribution, /poker-table-amount--contribution/);
  assert.match(pot, /poker-table-amount--pot/);
  for (const [markup, count] of [[remaining, 3], [contribution, 2], [pot, 4]]) {
    assert.equal((markup.match(/class="poker-chip-body"/g) || []).length, count, 'distinct bounded chip groups');
    assert.equal((markup.match(/class="poker-amount-value"/g) || []).length, 1, 'one amount per group');
  }
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
  assert.equal(css.rulesMentioning('.table-contribution-lane-path').length, 0);
  const amount = probe('<svg><g class="poker-table-amount poker-table-amount--contribution"><rect class="poker-table-amount-surface"></rect></g></svg>').querySelector('rect');
  assert.equal(css.cascaded(amount, 'fill'), 'var(--poker-table-contribution-surface)');
  assert.equal(css.cascaded(amount, 'filter'), 'none');
});

test('dealer, seat states, contribution lanes, and motion stay semantic and accessible', () => {
  assert.match(renderer, /const isDealer = player.isButton/);
  assert.match(renderer, /data-anchor="table-seat-shoulder"/);
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
  // Card deals start from a per-card offset; chip flights vanish under
  // reduced motion.
  const deals = [...css.keyframes.values()].flat().flatMap((frame) => frame.declarations).filter(({ value }) => value.includes('--card-deal-from-x'));
  assert.ok(deals.length >= 1);
  const flight = probe('<div class="table-chip-flight"></div>');
  assert.equal(css.cascaded(flight, 'display', { reducedMotion: true }), 'none');
  assert.notEqual(css.cascaded(flight, 'display'), 'none');
});

test('themes and RTL change paint and chrome without mirroring poker geometry', () => {
  // Every theme defines the table paint tokens (themes change paint only).
  const root = markup.documentElement;
  const previous = root.dataset.theme;
  const tokens = ['--poker-table-base-start', '--poker-table-rail-start', '--poker-table-cushion-start', '--poker-table-surface-start'];
  for (const theme of ['midnight', 'daylight', 'graphite']) {
    root.dataset.theme = theme;
    for (const token of tokens) assert.ok(css.cascaded(root, token), `${theme} ${token}`);
  }
  root.dataset.theme = previous;
  // RTL never mirrors table geometry; stacks are isolated.
  const table = probe('<svg class="riverline-poker-table"><text class="table-seat-stack">100 bb</text></svg>');
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(table, 'direction'), 'ltr');
  assert.equal(css.cascaded(table.querySelector('.table-seat-stack'), 'unicode-bidi'), 'isolate');
  root.setAttribute('dir', 'ltr');
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
