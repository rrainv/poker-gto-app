import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / logic.js / styles.css assertions are
// behavioural: parsed markup, the cascade over rendered cards, and the booted
// app's renderers. Other module sources keep their existing checks.
const app = await bootApp();
const css = appStyleSheet();
// Imported after boot: the card presentation module self-installs on the page.
const {
  CARD_BACK_STYLES,
  CARD_FACE_STYLES,
  CARD_GEOMETRY,
  CARD_RANK_GEOMETRY,
  CARD_PRESENTATION_SCHEMA_VERSION,
  CARD_PRESENTATION_STORAGE_KEY,
  DEFAULT_CARD_PRESENTATION,
  cardFaceMarkup,
  createCardPresentationController,
  loadCardPresentation,
  normalizeCardPresentation,
  tableCardBackSvgMarkup,
  tableCardSvgMarkup,
} = await import('../app/src/application/card-presentation.mjs');

const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const rangeWorkspace = fs.readFileSync(
  new URL('../app/src/application/range-calibration-workspace.mjs', import.meta.url),
  'utf8',
);
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const translations = fs.readFileSync(
  new URL('../app/src/locales/product-translations.js', import.meta.url),
  'utf8',
);
const cardPresentationSource = fs.readFileSync(
  new URL('../app/src/application/card-presentation.mjs', import.meta.url),
  'utf8',
);
const visualHarness = fs.readFileSync(
  new URL('./tooling/premium_card_system_v1_visual_harness.html', import.meta.url),
  'utf8',
);

const root = app.document.documentElement;

/** Render markup into a scratch host on the booted page. */
function rendered(markup) {
  const host = app.document.createElement('div');
  host.dataset.testHost = 'premium-card';
  host.innerHTML = markup;
  app.document.body.appendChild(host);
  return host;
}

/** Run with root datasets temporarily set. */
function withRoot(dataset, run) {
  const previous = {};
  for (const [key, value] of Object.entries(dataset)) {
    previous[key] = root.dataset[key];
    root.dataset[key] = value;
  }
  try { return run(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete root.dataset[key];
      else root.dataset[key] = value;
    }
  }
}

/** A live slot card exactly as the page's slot renderer emits it. */
function slotCard(card = 'Th', group = 'hero') {
  return rendered(`<button type="button" class="card-slot card--known filled card--suit-${card[1]} riverline-card" data-card-state="known" data-card-size="slot" data-group="${group}">${app.call('cardMarkup', card)}</button>`).firstElementChild;
}

function occurrenceCount(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function control(dataset = {}) {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  return {
    dataset,
    classList: { toggle(name, active) { active ? classes.add(name) : classes.delete(name); } },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    addEventListener(name, handler) { listeners.set(name, handler); },
    click() { listeners.get('click')?.({ currentTarget: this }); },
    classes,
    attributes,
  };
}

function controllerFixture({ stored, rootDataset = {} } = {}) {
  const storage = new MemoryStorage(stored ? { [CARD_PRESENTATION_STORAGE_KEY]: stored } : {});
  const root = { dataset: { ...rootDataset } };
  const fourColorToggle = control();
  const faceStyleButtons = Object.keys(CARD_FACE_STYLES).map((faceStyle) => control({ cardFaceStyle: faceStyle }));
  const backStyleButtons = Object.keys(CARD_BACK_STYLES).map((backStyle) => control({ cardBackStyle: backStyle }));
  const rankStyleButtons = ['poker', 'full-ten'].map((rankStyle) => control({ cardRankStyle: rankStyle }));
  const events = [];
  class FixtureCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const eventTarget = {
    CustomEvent: FixtureCustomEvent,
    dispatchEvent(event) { events.push(event); },
  };
  const controller = createCardPresentationController({
    root,
    storage,
    eventTarget,
    fourColorToggle,
    faceStyleButtons,
    backStyleButtons,
    rankStyleButtons,
  }).init();
  return {
    controller,
    storage,
    root,
    events,
    fourColorToggle,
    faceStyleButtons,
    backStyleButtons,
    rankStyleButtons,
  };
}

test('Premium Card System v1 exposes exactly three curated faces and backs', () => {
  assert.deepEqual(Object.keys(CARD_FACE_STYLES), ['classic', 'minimal', 'high-contrast']);
  assert.deepEqual(Object.keys(CARD_BACK_STYLES), ['riverline', 'solid', 'geometric']);
  // Was: each id appears in index.html and styles.css. Protects: Settings
  // offers exactly these choices and each one restyles live cards.
  const doc = indexDocument();
  assert.deepEqual(
    doc.querySelectorAll('button[data-card-face-style]').map((button) => button.getAttribute('data-card-face-style')),
    Object.keys(CARD_FACE_STYLES),
  );
  assert.deepEqual(
    doc.querySelectorAll('button[data-card-back-style]').map((button) => button.getAttribute('data-card-back-style')),
    Object.keys(CARD_BACK_STYLES),
  );
  const face = slotCard('Ah');
  const faceRules = (style) => withRoot({ cardFaceStyle: style }, () => css.matchingRules(face)
    .filter((rule) => rule.selectors.some((selector) => selector.includes(`data-card-face-style="${style}"`))).length);
  for (const id of Object.keys(CARD_FACE_STYLES)) assert.ok(faceRules(id) > 0, `${id} face style applies`);
  const back = rendered('<i class="riverline-card-back" data-card-size="mini"></i>').firstElementChild;
  const backImages = Object.keys(CARD_BACK_STYLES)
    .map((style) => withRoot({ cardBackStyle: style }, () => css.cascaded(back, 'background-image')));
  assert.equal(new Set(backImages).size, backImages.length, 'each back style paints a distinct back');
  // Retired style names stay out of the shipped markup (text and attributes).
  assert.doesNotMatch(doc.documentElement.outerHTML, /Classic Mirrored|Tournament|Clean Corner|Clarity Corner/);
});

test('face and back controls apply immediately and persist one validated record', () => {
  const view = controllerFixture();
  view.faceStyleButtons.find((button) => button.dataset.cardFaceStyle === 'high-contrast').click();
  assert.equal(view.root.dataset.cardFaceStyle, 'high-contrast');
  assert.equal(view.controller.get().faceStyle, 'high-contrast');
  view.backStyleButtons.find((button) => button.dataset.cardBackStyle === 'geometric').click();
  assert.equal(view.root.dataset.cardBackStyle, 'geometric');
  view.fourColorToggle.click();
  assert.equal(view.root.dataset.fourColor, 'false');
  view.rankStyleButtons.find((button) => button.dataset.cardRankStyle === 'full-ten').click();
  const stored = JSON.parse(view.storage.getItem(CARD_PRESENTATION_STORAGE_KEY));
  assert.deepEqual(stored, {
    schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
    faceStyle: 'high-contrast',
    backStyle: 'geometric',
    rankStyle: 'full-ten',
    fourColor: false,
  });
  assert.equal(view.events.length, 4);
  assert.ok(view.events.every((event) => event.type === 'riverline:cardpresentationchange'));
});

test('invalid v1 and legacy values repair to safe defaults without leaking old keys', () => {
  const invalid = new MemoryStorage({
    [CARD_PRESENTATION_STORAGE_KEY]: JSON.stringify({
      schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
      faceStyle: 'uploaded-casino-deck',
      backStyle: 'photo',
      rankStyle: 'emoji',
      fourColor: 'sometimes',
    }),
  });
  assert.deepEqual(loadCardPresentation(invalid), DEFAULT_CARD_PRESENTATION);
  assert.deepEqual(JSON.parse(invalid.getItem(CARD_PRESENTATION_STORAGE_KEY)), DEFAULT_CARD_PRESENTATION);

  const legacy = new MemoryStorage({
    riverline_card_style: 'classic-mirrored',
    riverline_card_rank_style: 'full-ten',
    riverline_4color: 'false',
  });
  assert.deepEqual(loadCardPresentation(legacy), {
    schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
    faceStyle: 'classic',
    backStyle: 'riverline',
    rankStyle: 'full-ten',
    fourColor: false,
  });
  assert.equal(legacy.getItem('riverline_card_style'), null);
  assert.equal(legacy.getItem('riverline_card_rank_style'), null);
  assert.equal(legacy.getItem('riverline_4color'), null);
  assert.deepEqual(normalizeCardPresentation(null), DEFAULT_CARD_PRESENTATION);
});

test('all ranks, suits, and full-ten geometry remain presentation-only', () => {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const suits = { h: '♥', d: '♦', c: '♣', s: '♠' };
  for (const rank of ranks) {
    for (const [suit, symbol] of Object.entries(suits)) {
      const poker = cardFaceMarkup({ rank, suit, rankStyle: 'poker' });
      const full = cardFaceMarkup({ rank, suit, rankStyle: 'full-ten' });
      assert.match(poker, new RegExp(`s-${suit}`));
      assert.ok(poker.includes(symbol));
      if (rank === 'T') {
        assert.ok(poker.includes('>T<'));
        assert.ok(full.includes('>10<'));
        assert.match(full, /rank rank--ten/);
      } else {
        assert.ok(full.includes(`>${rank}<`));
        assert.doesNotMatch(full, /rank--ten/);
      }
    }
  }
  assert.equal(CARD_RANK_GEOMETRY.tenScaleX, 0.82);
  // Was: --card-rank-ten-scale-x: .82 and a scaleX-only rank--ten transform.
  // Protects: the CSS ten treatment matches the geometry authority and only
  // narrows the glyph horizontally.
  const ten = rendered(`<span class="riverline-card" data-card-size="slot">${cardFaceMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' })}</span>`);
  assert.equal(css.cascaded(ten.firstElementChild, '--card-rank-ten-scale-x'), String(CARD_RANK_GEOMETRY.tenScaleX).replace(/^0/, ''));
  const tenTransform = css.cascaded(ten.querySelector('.card-center .rank--ten'), 'transform');
  assert.equal(tenTransform, 'scaleX(var(--card-rank-ten-scale-x))');
  assert.doesNotMatch(tenTransform, /scaleY/);
});

test('full-ten is presentation-only: the canonical Hand keeps its T cards', async () => {
  // Was: logic.js never assigns card[0] / card[1]. Protects: switching the
  // rank style re-renders labels without rewriting canonical card ids.
  await app.startHand(['Th', '9h']);
  const heroCards = () => {
    const state = app.call('callPlaybookStateBridge', 'getState');
    const heroId = app.call('callPlaybookStateBridge', 'getHeroPlayerId');
    return state.players.find((player) => player.playerId === heroId).holeCards;
  };
  assert.deepEqual(heroCards(), ['Th', '9h']);
  const previous = app.evaluate('app.settings.cardRankStyle');
  await app.click('#openSettings');
  try {
    await app.click('button[data-card-rank-style="full-ten"]');
    assert.equal(app.evaluate('app.settings.cardRankStyle'), 'full-ten');
    app.call('renderCanonicalHandWorkspace');
    assert.deepEqual(heroCards(), ['Th', '9h']);
    assert.equal(app.call('cardMarkup', 'Th').includes('>10<'), true);
  } finally {
    await app.click(`button[data-card-rank-style="${previous}"]`);
    await app.click('#closeSettingsModal');
  }
  assert.deepEqual(heroCards(), ['Th', '9h']);
});

test('all faces contain one rank/suit node pair and two empty mirrored corner units', () => {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  for (const rank of ranks) {
    for (const suit of ['h', 'd', 'c', 's']) {
      for (const rankStyle of ['poker', 'full-ten']) {
        const face = cardFaceMarkup({ rank, suit, rankStyle });
        const visualRank = rank === 'T' && rankStyle === 'full-ten' ? '10' : rank;
        assert.equal(occurrenceCount(face, /class="card-corner /g), 2, `${visualRank}${suit} corners`);
        assert.equal(occurrenceCount(face, /class="rank(?: |")/g), 1, `${visualRank}${suit} rank nodes`);
        assert.equal(occurrenceCount(face, /class="suit /g), 1, `${visualRank}${suit} suit nodes`);
        assert.equal(occurrenceCount(face, new RegExp(`data-card-suit-id="${suit}"`, 'g')), 3, `${visualRank}${suit} suit metadata`);
        const top = face.match(/card-corner--top[^>]*data-card-rank="([^"]+)"[^>]*data-card-suit="([^"]+)"[^>]*><\/span>/);
        const bottom = face.match(/card-corner--bottom[^>]*data-card-rank="([^"]+)"[^>]*data-card-suit="([^"]+)"[^>]*><\/span>/);
        assert.ok(top, `${visualRank}${suit} top corner structure`);
        assert.ok(bottom, `${visualRank}${suit} bottom corner structure`);
        assert.deepEqual(bottom.slice(1), top.slice(1), `${visualRank}${suit} complete mirrored unit`);
        assert.equal(top[1], visualRank);
        assert.doesNotMatch(face, /card-corner[^>]*>\s*<span/, `${visualRank}${suit} has no fragment children`);
        if (visualRank === '10') {
          assert.equal(occurrenceCount(face, /data-card-rank-width="wide"/g), 3);
          assert.match(face, /rank rank--ten/);
        } else {
          assert.doesNotMatch(face, /data-card-rank-width="wide"|rank--ten/);
        }
      }
    }
  }
});

test('Classic HTML and all table styles keep complete, symmetric corner geometry in bounds', () => {
  // Was: .card-corner--bottom rotate(180deg), .riverline-card and
  // facedown/back overflow: hidden, and no top-corner-only SVG text rule.
  // Protects: the bottom corner mirrors the top, faces and backs clip to the
  // card, and both SVG corners share one text treatment.
  const classic = slotCard('Ah');
  assert.equal(css.cascaded(classic.querySelector('.card-corner--bottom'), 'transform'), 'rotate(180deg)');
  assert.equal(css.cascaded(classic, 'overflow'), 'hidden');
  const backs = rendered('<span class="card-slot facedown" data-card-size="slot"></span><i class="riverline-card-back" data-card-size="mini"></i>');
  for (const back of backs.children) assert.equal(css.cascaded(back, 'overflow'), 'hidden', back.className);
  const svg = rendered(tableCardSvgMarkup({ rank: 'A', suit: 'h', rankStyle: 'poker', faceStyle: 'classic' }));
  for (const part of ['rank', 'suit']) {
    const [top, bottom] = svg.querySelectorAll(`.table-card-corner-${part}`);
    const props = (node) => css.matchingRules(node).map((rule) => rule.order);
    assert.deepEqual(props(top), props(bottom), `${part}: both SVG corners match the same rules`);
  }

  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  for (const faceStyle of Object.keys(CARD_FACE_STYLES)) {
    for (const rank of ranks) {
      for (const suit of ['h', 'd', 'c', 's']) {
        const face = tableCardSvgMarkup({ rank, suit, rankStyle: 'full-ten', faceStyle });
        const corner = faceStyle === 'high-contrast'
          ? CARD_RANK_GEOMETRY.tableCornerHighContrast
          : CARD_RANK_GEOMETRY.tableCorner;
        assert.equal(occurrenceCount(face, /class="table-card-corner /g), 2);
        assert.equal(occurrenceCount(face, /table-card-corner-rank/g), 2);
        assert.equal(occurrenceCount(face, /table-card-corner-suit/g), 2);
        assert.match(face, /table-card-corner--bottom" aria-hidden="true" transform="translate\(40 57\) rotate\(180\)"/);
        assert.match(face, new RegExp(`data-card-suit-id="${suit}"`));
        assert.match(face, new RegExp(`table-card-corner-rank[^>]*x="0" y="0" transform="translate\\(${corner.x} ${corner.rankY}\\)`));
        assert.match(face, new RegExp(`table-card-corner-suit[^>]*x="${corner.x}" y="${corner.suitY}"`));
      }
    }
  }
});

test('full-ten uses one symmetric wide-rank treatment in DOM and coordinate-anchored SVG', () => {
  // Was: the wide-corner ::before and .card-center .rank--ten rule text.
  // Protects: both the corner and centre ten narrow with the shared scaleX,
  // centre in a fixed inline size, and never use negative letter-spacing.
  for (const faceStyle of Object.keys(CARD_FACE_STYLES)) {
    const card = rendered(`<span class="riverline-card" data-card-size="slot">${cardFaceMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' })}</span>`);
    withRoot({ cardFaceStyle: faceStyle }, () => {
      for (const corner of card.querySelectorAll('.card-corner[data-card-rank-width="wide"]')) {
        assert.equal(css.cascaded(corner, 'letter-spacing', { pseudoElement: 'before' }), 'normal', faceStyle);
        assert.match(css.cascaded(corner, 'transform', { pseudoElement: 'before' }) || '', /scaleX\(var\(--card-rank-ten-scale-x\)\)/, faceStyle);
      }
      const centre = card.querySelector('.card-center .rank--ten');
      assert.equal(css.cascaded(centre, 'inline-size'), 'var(--card-rank-ten-inline-size)', faceStyle);
      assert.equal(css.cascaded(centre, 'place-items'), 'center', faceStyle);
      assert.equal(css.cascaded(centre, 'letter-spacing'), 'normal', faceStyle);
      assert.equal(css.cascaded(centre, 'text-align'), 'center', faceStyle);
    });
  }

  for (const faceStyle of Object.keys(CARD_FACE_STYLES)) {
    const face = tableCardSvgMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten', faceStyle });
    const corner = faceStyle === 'high-contrast'
      ? CARD_RANK_GEOMETRY.tableCornerHighContrast
      : CARD_RANK_GEOMETRY.tableCorner;
    assert.equal(occurrenceCount(face, /data-card-rank-width="wide"/g), 3, faceStyle);
    assert.equal(occurrenceCount(face, new RegExp(`transform="translate\\(${corner.x} ${corner.rankY}\\) scale\\(0\\.82 1\\)"`, 'g')), 2, faceStyle);
    assert.equal(occurrenceCount(face, /transform="translate\(20 25\) scale\(0\.82 1\)"/g), 1, faceStyle);
    assert.doesNotMatch(face, /table-card-rank--ten[^>]*(?:x="8"|x="20")/, faceStyle);
  }
});

test('Settings previews use the shared renderer without selected-style leakage', () => {
  // Was: preview <span> regex over index.html plus the two :not(preview)
  // selectors and no `html [data-card-preview-back-style=` rule. Protects:
  // one empty preview per face style, filled by the shared renderer, and the
  // selected root style never leaks into the previews.
  const doc = indexDocument();
  const staticPreviews = doc.querySelectorAll('span.settings-card-face[data-card-preview-face-style]');
  assert.deepEqual(staticPreviews.map((preview) => preview.getAttribute('data-card-preview-face-style')), Object.keys(CARD_FACE_STYLES));
  assert.ok(staticPreviews.every((preview) => preview.childNodes.length === 0), 'previews ship empty');
  assert.match(cardPresentationSource, /querySelector\?\.\('\[data-card-preview-face-style\]'\)[\s\S]*?appendCardFaceContents\(preview/);
  const livePreviews = app.$$('span.settings-card-face[data-card-preview-face-style]');
  assert.ok(livePreviews.every((preview) => preview.querySelector('.card-corner--top') && preview.querySelector('.card-center')));

  const classicPreview = livePreviews.find((preview) => preview.dataset.cardPreviewFaceStyle === 'classic');
  const liveCard = slotCard('Ah');
  withRoot({ cardFaceStyle: 'high-contrast' }, () => {
    assert.equal(css.cascaded(liveCard.querySelector('.card-corner--bottom'), 'display'), 'none');
    assert.notEqual(css.cascaded(classicPreview.querySelector('.card-corner--bottom'), 'display'), 'none');
  });
  const riverlineBackPreview = app.$('.riverline-card-back[data-card-preview-back-style="riverline"]');
  const previewBack = (style) => withRoot({ cardBackStyle: style }, () => css.cascaded(riverlineBackPreview, 'background-image'));
  assert.equal(previewBack('solid'), previewBack('geometric'));
  assert.equal(previewBack('solid'), previewBack('riverline'));
  assert.match(visualHarness, /import \{ appendCardFaceContents(?:, [^}]+)? \}/);
  assert.match(visualHarness, /appendCardFaceContents\(card/);
});

test('named sizes share a coherent ratio and table SVG uses the geometry authority', () => {
  for (const [name, geometry] of Object.entries(CARD_GEOMETRY)) {
    if (name === 'ratio') continue;
    assert.ok(Math.abs((geometry.width / geometry.height) - CARD_GEOMETRY.ratio) < 0.012, name);
    assert.ok(geometry.radius >= 4 && geometry.radius <= 7, name);
  }
  const face = tableCardSvgMarkup({ rank: 'T', suit: 'd', rankStyle: 'full-ten', faceStyle: 'high-contrast' });
  assert.match(face, /data-card-size="table"/);
  assert.match(face, /width="40" height="57" rx="5" ry="5"/);
  assert.match(face, /card--style-high-contrast/);
  assert.match(face, /table-card-rank--ten/);
  const back = tableCardBackSvgMarkup({ index: 1 });
  assert.match(back, /data-card-state="unknown"/);
  assert.match(back, /table-card-back-river/);
  assert.match(back, /table-card-back-geometric/);
  assert.doesNotMatch(back, /data-card-state="known"/);
  // Was: each --card-size-* token appears in styles.css. Protects: every
  // named size resolves to a pixel token on the root.
  for (const token of ['mini', 'result', 'table', 'picker', 'compact', 'slot', 'standard', 'representative', 'full']) {
    assert.match(css.cascaded(root, `--card-size-${token}-width`) || '', /^\d+(?:\.\d+)?px$/, `${token} width`);
    assert.match(css.cascaded(root, `--card-size-${token}-height`) || '', /^\d+(?:\.\d+)?px$/, `${token} height`);
  }
});

test('runtime slot, board, and SVG clipping contracts use the shared geometry layers', async () => {
  // Was: slot / card-slots / card-slot / poker-card-svg rule text, the
  // compact ≤768px slot tokens, rule order over the legacy 48px filled slot,
  // the slot renderer's data attributes and the Equity board row track.
  // Protects: live slots size from the shared tokens (beating the legacy
  // filled size), clip their face while the row and SVG do not clip, and
  // shrink to the compact size on narrow layouts.
  await app.startHand(['As', 'Kd']);
  const slots = app.$$('[data-slots="hero"] .riverline-card.card-slot');
  assert.ok(
    slots.length > 0 && slots.every((slot) => slot.dataset.cardSize === 'slot' && slot.dataset.group === 'hero'),
    'the slot renderer tags size and group',
  );
  const filled = slots.find((slot) => slot.classList.contains('filled'));
  assert.ok(filled, 'a filled live slot exists');
  for (const [property, token] of [['width', 'width'], ['min-width', 'width'], ['height', 'height'], ['min-height', 'height']]) {
    assert.equal(css.cascaded(filled, property), `var(--poker-card-${token})`, property);
  }
  assert.equal(css.cascaded(filled, 'overflow'), 'hidden');
  assert.equal(css.cascaded(filled, '--poker-card-width', { width: 768 }), 'var(--card-size-compact-width)');
  assert.equal(css.cascaded(filled, '--poker-card-height', { width: 768 }), 'var(--card-size-compact-height)');
  const row = app.$('.card-slots');
  assert.ok(row);
  assert.equal(css.cascaded(row, 'overflow'), 'visible');
  const svg = rendered(tableCardSvgMarkup({ rank: 'A', suit: 's', rankStyle: 'poker', faceStyle: 'classic' })).firstElementChild;
  assert.ok(svg.classList.contains('poker-card-svg'));
  assert.equal(css.cascaded(svg, 'overflow'), 'visible');
  const board = app.$('.equity-board-layout');
  assert.ok(board);
  assert.equal(css.cascaded(board, 'grid-template-rows'), 'auto var(--poker-card-height, 68px)');

  const tableTen = tableCardSvgMarkup({ rank: 'T', suit: 's', rankStyle: 'full-ten', faceStyle: 'classic' });
  assert.match(tableTen, /width="40" height="57" rx="5" ry="5"/);
  assert.match(tableTen, /translate\(40 57\) rotate\(180\)/);
  assert.doesNotMatch(tableTen, /foreignObject|overflow="hidden"/);
});

test('major workspaces consume the shared face and back renderers', async () => {
  // Was: logic.js source names (cardMarkup -> presentation.cardFaceMarkup,
  // data-card-size slot/picker/standard/result, renderTrainingCards,
  // equityReadOnlyCardsMarkup, hand-card-backs -> riverline-card-back).
  // Protects: the page's card renderers emit the shared face markup at the
  // named sizes, and hidden opponents render shared backs.
  const rankStyle = app.evaluate('app.settings.cardRankStyle');
  assert.equal(app.call('cardMarkup', 'Ah'), cardFaceMarkup({ rank: 'A', suit: 'h', rankStyle }));
  const result = rendered(app.call('equityReadOnlyCardsMarkup', ['Ah', 'Kd'], 'Hero'));
  const resultCards = result.querySelectorAll('.riverline-card[data-card-size="result"]');
  assert.equal(resultCards.length, 2);
  assert.equal(resultCards[0].innerHTML, cardFaceMarkup({ rank: 'A', suit: 'h', rankStyle }));
  const unknown = rendered(app.call('equityReadOnlyCardsMarkup', null, 'Villain'));
  assert.equal(unknown.querySelectorAll('.riverline-card-back[data-card-size="result"]').length, 2);
  assert.equal(app.evaluate('typeof renderTrainingCards'), 'function');

  await app.startHand(['As', 'Kd']);
  assert.ok(app.$$('[data-slots="hero"] [data-card-size="slot"]').length > 0);
  assert.equal(app.$$('.hand-card-backs .riverline-card-back').length, 2);
  // The card picker, opened from a shown editor (Analyze board).
  await app.navigate('analyze');
  await app.click('#gtoMode [data-card-set-edit="board"]');
  const deck = app.$$('[data-deck-card]');
  assert.equal(deck.length, 52);
  assert.ok(deck.every((card) => card.dataset.cardSize === 'picker' && card.classList.contains('riverline-card')));
  assert.ok(deck[0].querySelector('.card-corner--top'), 'deck cards use the shared face');
  assert.ok(app.$$('.card-set-picker-card[data-card-size="standard"]').length > 0, 'the picker preview uses the standard size');
  await app.key('#cardModal', 'Escape');

  assert.match(table, /presentation\.tableCardSvgMarkup/);
  assert.match(table, /presentation\.tableCardBackSvgMarkup/);
  assert.match(rangeWorkspace, /appendCardFaceContents/);
  assert.match(rangeWorkspace, /cardSize = 'representative'/);
  assert.match(teacher, /presentation\.appendCardFaceContents/);
  assert.match(teacher, /cardSize = 'mini'/);
});

test('picker accessibility, four-color semantics, RTL, and reduced motion remain explicit', async () => {
  // Was: renderDeck template text (suit rows, aria-pressed, disabled
  // unavailable cards, Select / unavailable labels). Protects: the picker
  // groups cards by suit and exposes selection and availability to AT.
  // Hero holds As: opening the board picker shows it unavailable.
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await app.click('#gtoMode [data-card-set-edit="board"]');
  assert.deepEqual(app.$$('.deck-suit-row[data-picker-suit]').map((row) => row.dataset.pickerSuit), ['h', 's', 'd', 'c']);
  const deckCard = (card) => app.$(`[data-deck-card="${card}"]`);
  const unavailable = deckCard('As');
  assert.equal(unavailable.disabled, true);
  assert.equal(unavailable.getAttribute('aria-label'), app.call('t', '{card}, unavailable', { card: 'A♠' }));
  assert.equal(deckCard('2c').disabled, false);
  assert.equal(deckCard('2c').getAttribute('aria-pressed'), 'false');
  assert.equal(deckCard('2c').getAttribute('aria-label'), app.call('t', 'Select {card}', { card: '2♣' }));
  await app.click(deckCard('2c'));
  assert.equal(deckCard('2c').getAttribute('aria-pressed'), 'true');

  // Was: .deck-card:focus-visible { outline } text. Protects: keyboard focus
  // on a deck card draws an outline.
  const focusTarget = deckCard('3c');
  assert.notEqual(css.cascaded(focusTarget, 'outline-offset', { states: ['focus-visible'] }), '3px', 'unfocused');
  focusTarget.focus();
  assert.match(css.cascaded(focusTarget, 'outline', { states: ['focus-visible'] }) || '', /\d+px solid/);
  assert.equal(css.cascaded(focusTarget, 'outline-offset', { states: ['focus-visible'] }), '3px');
  await app.key('#cardModal', 'Escape');

  // Was: html[data-four-color="false"] diamond/club remap and per-suit
  // card--suit-* colour text. Protects: two-colour mode maps diamonds to
  // hearts and clubs to spades; each suit class colours from its token.
  withRoot({ fourColor: 'false' }, () => {
    assert.equal(css.cascaded(root, '--suit-diamond'), 'var(--suit-heart)');
    assert.equal(css.cascaded(root, '--suit-club'), 'var(--suit-spade)');
  });
  for (const [suit, token] of Object.entries({ h: 'heart', d: 'diamond', c: 'club', s: 'spade' })) {
    const card = rendered(`<span class="riverline-card card--suit-${suit}"></span>`).firstElementChild;
    assert.equal(css.cascaded(card, '--riverline-card-suit-color'), `var(--suit-${token})`, suit);
  }

  // Was: .riverline-card direction / unicode-bidi text. Protects: cards stay
  // LTR-isolated inside RTL pages.
  const isolated = slotCard('Ah');
  assert.equal(css.cascaded(isolated, 'direction'), 'ltr');
  assert.equal(css.cascaded(isolated, 'unicode-bidi'), 'isolate');

  // Was: a prefers-reduced-motion media block exists. Protects: dealt-card
  // motion is removed under reduced motion.
  const dealt = rendered('<span class="card-slot is-card-dealt"></span>').firstElementChild;
  assert.notEqual(css.cascaded(dealt, 'animation'), 'none');
  assert.equal(css.cascaded(dealt, 'animation', { reducedMotion: true }), 'none');
  for (const key of ['Four-color deck', 'Card face style', 'Card-back style', 'High Contrast', 'Geometric']) {
    assert.ok(translations.split(`"${key}"`).length >= 3, `${key} must exist in EN/RU/HE catalogs`);
  }
});

test('runtime DOM, Settings, SVG, and Replay consume one canonical suit-color path', () => {
  for (const [suit, token] of Object.entries({ h: 'heart', d: 'diamond', c: 'club', s: 'spade' })) {
    // Was: [data-card-suit-id] colour-token rule text. Protects: every
    // renderer's suit metadata resolves the suit colour from one token.
    const tagged = rendered(`<span data-card-suit-id="${suit}"></span>`).firstElementChild;
    assert.equal(css.cascaded(tagged, '--riverline-card-suit-color'), `var(--suit-${token})`, suit);
    const face = cardFaceMarkup({ rank: 'A', suit });
    assert.equal(occurrenceCount(face, new RegExp(`data-card-suit-id="${suit}"`, 'g')), 3);
    assert.match(tableCardSvgMarkup({ rank: 'A', suit }), new RegExp(`data-card-suit-id="${suit}"`));
  }
  // Was: the rank/suit !important colour rule. Protects: face glyphs take
  // the suit token colour over legacy suit classes.
  const face = slotCard('Ad');
  for (const glyph of face.querySelectorAll('.card-center .rank, .card-center .suit')) {
    assert.equal(css.cascaded(glyph, 'color'), 'var(--riverline-card-suit-color)');
  }
  // SOURCE-SHAPE: policy lint over parsed rules - no `.poker-card-svg.card--suit-*`
  // rule may reintroduce a second SVG suit-colour path (absence of a rule has
  // no behavioural observable short of enumerating every possible element).
  for (const suit of ['h', 'd', 'c', 's']) {
    assert.equal(css.rulesFor(`.poker-card-svg.card--suit-${suit}`, { anyCondition: true }).length, 0, suit);
  }
  // Was: logic.js replay-transition-card source. Protects: Replay board
  // tokens carry the canonical suit id (no tone class).
  const entry = app.call('createReplayTransitionEntry', {
    transitionKind: 'deal_flop',
    presentationState: 'current',
    frameIndex: 0,
    labelKey: 'Flop',
    cardVisibility: 'public_board',
    cards: [{ rank: 'A', suit: 'h' }, { rank: 'T', suit: 'c' }],
  });
  const tokens = entry.querySelectorAll('.replay-transition-card');
  assert.deepEqual(tokens.map((token) => token.dataset.cardSuitId), ['h', 'c']);
  assert.ok(tokens.every((token) => token.className === 'replay-transition-card'));
});

test('two-color and four-color preference changes apply live through root suit tokens', () => {
  const view = controllerFixture();
  const initialEventCount = view.events.length;
  assert.equal(view.root.dataset.fourColor, 'true');
  view.fourColorToggle.click();
  assert.equal(view.root.dataset.fourColor, 'false');
  assert.equal(view.controller.get().fourColor, false);
  view.fourColorToggle.click();
  assert.equal(view.root.dataset.fourColor, 'true');
  assert.equal(view.controller.get().fourColor, true);
  assert.equal(view.events.length, initialEventCount + 2);
  // Was: html[data-four-color="false"] block and --heart/--diamond alias
  // text. Protects: the root dataset the controller writes remaps the suit
  // tokens, and the legacy aliases follow them.
  withRoot({ fourColor: 'false' }, () => {
    assert.equal(css.cascaded(root, '--suit-diamond'), 'var(--suit-heart)');
    assert.equal(css.cascaded(root, '--suit-club'), 'var(--suit-spade)');
  });
  withRoot({ fourColor: 'true' }, () => {
    assert.match(css.cascaded(root, '--suit-diamond'), /^#/);
  });
  assert.equal(css.cascaded(root, '--heart'), 'var(--suit-heart)');
  assert.equal(css.cascaded(root, '--diamond'), 'var(--suit-diamond)');
});

test('card presentation preserves theme, density, and layout datasets in every supported combination', () => {
  const themes = ['midnight', 'daylight', 'graphite', 'custom-river'];
  const densities = ['comfortable', 'compact'];
  const layouts = ['balanced', 'table-focus', 'analysis-focus'];
  for (const theme of themes) {
    for (const density of densities) {
      for (const layoutPreset of layouts) {
        const view = controllerFixture({ rootDataset: { theme, density, layoutPreset } });
        view.controller.apply({ faceStyle: 'high-contrast', backStyle: 'solid' });
        assert.equal(view.root.dataset.theme, theme);
        assert.equal(view.root.dataset.density, density);
        assert.equal(view.root.dataset.layoutPreset, layoutPreset);
      }
    }
  }
  // Was: theme blocks never declare --suit-* tokens. Protects: suit colours
  // are theme-independent.
  const suitTokens = () => ['heart', 'diamond', 'club', 'spade'].map((suit) => css.cascaded(root, `--suit-${suit}`));
  const baseline = withRoot({ theme: 'midnight' }, suitTokens);
  for (const theme of ['daylight', 'graphite']) {
    assert.deepEqual(withRoot({ theme }, suitTokens), baseline, theme);
  }
});
