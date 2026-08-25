import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
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
} from '../app/src/application/card-presentation.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
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
  for (const id of Object.keys(CARD_FACE_STYLES)) {
    assert.match(html, new RegExp(`data-card-face-style="${id}"`));
    assert.match(css, new RegExp(`data-card-face-style="${id}"`));
  }
  for (const id of Object.keys(CARD_BACK_STYLES)) {
    assert.match(html, new RegExp(`data-card-back-style="${id}"`));
    assert.match(css, new RegExp(`data-card-back-style="${id}"`));
  }
  assert.doesNotMatch(html, /Classic Mirrored|Tournament|Clean Corner|Clarity Corner/);
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
  assert.doesNotMatch(logic, /card\[0\]\s*=|card\[1\]\s*=/);
  assert.equal(CARD_RANK_GEOMETRY.tenScaleX, 0.82);
  assert.match(css, /--card-rank-ten-scale-x:\s*\.82/);
  assert.match(css, /rank--ten[\s\S]*?scaleX\(var\(--card-rank-ten-scale-x\)\)/);
  assert.doesNotMatch(css, /rank--ten[^}]*scaleY/);
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
  assert.match(css, /\.card-corner--bottom\s*\{[^}]*transform:\s*rotate\(180deg\)/s);
  assert.match(css, /\.riverline-card\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.card-slot\.facedown,[\s\S]*?\.riverline-card-back\s*\{[^}]*overflow:\s*hidden/s);
  assert.doesNotMatch(css, /table-card-corner--top\s+\.table-card-corner-(?:rank|suit)/);

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
  assert.match(css, /\.card-corner\[data-card-rank-width="wide"\]::before\s*\{[^}]*letter-spacing:\s*normal[^}]*scaleX\(var\(--card-rank-ten-scale-x\)\)/s);
  assert.match(css, /\.card-center \.rank--ten\s*\{[^}]*inline-size:\s*var\(--card-rank-ten-inline-size\)[^}]*place-items:\s*center[^}]*letter-spacing:\s*normal[^}]*text-align:\s*center/s);
  assert.doesNotMatch(css, /(?:rank--ten|card-rank-width="wide")[^}]*letter-spacing:\s*-/s);

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
  const previewMatches = [...html.matchAll(/<span class="settings-card-face[^>]*data-card-preview-face-style="([^"]+)"[^>]*><\/span>/g)];
  assert.deepEqual(previewMatches.map((match) => match[1]), Object.keys(CARD_FACE_STYLES));
  assert.doesNotMatch(previewMatches.map((match) => match[0]).join(''), /card-corner|card-center|class="rank|class="suit/);
  assert.match(cardPresentationSource, /querySelector\?\.\('\[data-card-preview-face-style\]'\)[\s\S]*?appendCardFaceContents\(preview/);
  assert.match(css, /riverline-card:not\(\[data-card-preview-face-style\]\)/);
  assert.match(css, /riverline-card-back:not\(\[data-card-preview-back-style\]\)/);
  assert.doesNotMatch(css, /html \[data-card-preview-back-style=/);
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
  for (const token of ['mini', 'result', 'table', 'picker', 'compact', 'slot', 'standard', 'representative', 'full']) {
    assert.match(css, new RegExp(`--card-size-${token}-width`));
    assert.match(css, new RegExp(`--card-size-${token}-height`));
  }
});

test('runtime slot, board, and SVG clipping contracts use the shared geometry layers', () => {
  assert.match(css, /\.riverline-card\.card-slot\[data-card-size="slot"\]\s*\{[^}]*width:\s*var\(--poker-card-width\) !important[^}]*height:\s*var\(--poker-card-height\) !important/s);
  assert.match(css, /\.card-slots\s*\{[^}]*overflow:\s*visible/s);
  assert.match(css, /\.card-slot\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.poker-card-svg\s*\{[^}]*overflow:\s*visible/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.card-slot\s*\{[^}]*--poker-card-width:\s*var\(--card-size-compact-width\)[^}]*--poker-card-height:\s*var\(--card-size-compact-height\)/);
  assert.ok(
    css.indexOf('.riverline-card.card-slot[data-card-size="slot"]')
      > css.indexOf('.card-slot.filled {\n\n  width: 48px'),
    'shared slot authority follows and overrides the legacy filled-card dimensions',
  );
  assert.match(logic, /data-card-size="slot" data-group="\$\{group\}"/);
  assert.match(css, /\.equity-board-layout\s*\{[^}]*grid-template-rows:\s*auto var\(--poker-card-height,\s*68px\)/s);

  const tableTen = tableCardSvgMarkup({ rank: 'T', suit: 's', rankStyle: 'full-ten', faceStyle: 'classic' });
  assert.match(tableTen, /width="40" height="57" rx="5" ry="5"/);
  assert.match(tableTen, /translate\(40 57\) rotate\(180\)/);
  assert.doesNotMatch(tableTen, /foreignObject|overflow="hidden"/);
});

test('major workspaces consume the shared face and back renderers', () => {
  assert.match(logic, /function cardMarkup\(card\)[\s\S]*?presentation\.cardFaceMarkup/);
  assert.match(logic, /data-card-size="slot"/);
  assert.match(logic, /data-card-size="picker"/);
  assert.match(logic, /data-card-size="standard"/);
  assert.match(logic, /data-card-size="result"/);
  assert.match(table, /presentation\.tableCardSvgMarkup/);
  assert.match(table, /presentation\.tableCardBackSvgMarkup/);
  assert.match(rangeWorkspace, /appendCardFaceContents/);
  assert.match(rangeWorkspace, /cardSize = 'representative'/);
  assert.match(teacher, /presentation\.appendCardFaceContents/);
  assert.match(teacher, /cardSize = 'mini'/);
  assert.match(logic, /renderTrainingCards/);
  assert.match(logic, /equityReadOnlyCardsMarkup/);
  assert.match(logic, /hand-card-backs[\s\S]*?riverline-card-back/);
});

test('picker accessibility, four-color semantics, RTL, and reduced motion remain explicit', () => {
  assert.match(logic, /class="deck-suit-row" data-picker-suit="\$\{suit\.id\}"/);
  assert.match(logic, /aria-pressed="\$\{isSelected\}"/);
  assert.match(logic, /data-deck-card="\$\{card\}" \$\{isUnavailable \? 'disabled' : ''\}/);
  assert.match(logic, /t\('\{card\}, unavailable'/);
  assert.match(logic, /t\('Choose \{card\}'/);
  assert.match(css, /html\[data-four-color="false"\][\s\S]*?--suit-diamond:\s*var\(--suit-heart\)[\s\S]*?--suit-club:\s*var\(--suit-spade\)/);
  for (const [suit, token] of Object.entries({ h: 'heart', d: 'diamond', c: 'club', s: 'spade' })) {
    assert.match(css, new RegExp(`card--suit-${suit}[\\s\\S]*?var\\(--suit-${token}\\)`));
  }
  assert.match(css, /\.riverline-card[\s\S]*?direction:\s*ltr[\s\S]*?unicode-bidi:\s*isolate/);
  assert.match(css, /\.deck-card:focus-visible[\s\S]*?outline:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  for (const key of ['Four-color deck', 'Card face style', 'Card-back style', 'High Contrast', 'Geometric']) {
    assert.ok(translations.split(`"${key}"`).length >= 3, `${key} must exist in EN/RU/HE catalogs`);
  }
});

test('runtime DOM, Settings, SVG, and Replay consume one canonical suit-color path', () => {
  for (const [suit, token] of Object.entries({ h: 'heart', d: 'diamond', c: 'club', s: 'spade' })) {
    assert.match(css, new RegExp(`data-card-suit-id="${suit}"[^}]*--riverline-card-suit-color:\\s*var\\(--suit-${token}\\)`));
    const face = cardFaceMarkup({ rank: 'A', suit });
    assert.equal(occurrenceCount(face, new RegExp(`data-card-suit-id="${suit}"`, 'g')), 3);
    assert.match(tableCardSvgMarkup({ rank: 'A', suit }), new RegExp(`data-card-suit-id="${suit}"`));
  }
  assert.match(css, /\.riverline-card \[data-card-suit-id\] :is\(\.rank, \.suit\)[\s\S]*?color:\s*var\(--riverline-card-suit-color\) !important/);
  assert.doesNotMatch(css, /\.poker-card-svg\.card--suit-[hdcs]\s*\{/);
  assert.match(logic, /cardSuitPresentation\(card\.suit\)[\s\S]*?replay-transition-card[\s\S]*?dataset\.cardSuitId/);
  assert.doesNotMatch(logic, /replay-transition-card--\$\{card\.tone\}/);
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
  assert.match(css, /html\[data-four-color="false"\]\s*\{[^}]*--suit-diamond:\s*var\(--suit-heart\)[^}]*--suit-club:\s*var\(--suit-spade\)/s);
  assert.match(css, /--heart:\s*var\(--suit-heart\)/);
  assert.match(css, /--diamond:\s*var\(--suit-diamond\)/);
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
  for (const theme of ['midnight', 'daylight', 'graphite']) {
    const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
    assert.doesNotMatch(block, /--suit-(?:heart|diamond|club|spade)/);
  }
});
