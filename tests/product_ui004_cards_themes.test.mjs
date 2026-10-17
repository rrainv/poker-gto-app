import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_BACK_STYLES,
  CARD_FACE_STYLES,
  cardFaceMarkup,
  tableCardSvgMarkup,
} from '../app/src/application/card-presentation.mjs';
import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, Settings controls in the running app, cascade on
// rendered cards). Module and renderer sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const root = app.document.documentElement;
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const themes = fs.readFileSync(
  new URL('../app/src/application/presentation-theme.mjs', import.meta.url),
  'utf8',
);

function renderedFace(card = 'Th') {
  const host = app.document.createElement('span');
  host.className = 'training-readonly-card riverline-card';
  host.dataset.cardSize = 'standard';
  host.innerHTML = app.call('cardMarkup', card);
  app.byId('trainingMode').appendChild(host);
  return host;
}

test('curated card faces, backs, and rank notation are independent presentation controls', async () => {
  // Protects: Settings exposes independent face/back/rank/four-colour
  // controls; choosing a face or back style applies it to the document and
  // the stylesheet styles cards for every curated style.
  for (const id of ['cardFaceStyleControl', 'cardBackStyleControl', 'cardRankStyleControl', 'fourColorDeckToggle']) {
    assert.ok(markup.getElementById(id), id);
  }
  // Equity renders the unknown villain's hand as DOM card backs.
  await app.navigate('equity');
  await app.click('#openSettings');
  const face = renderedFace('As');
  for (const style of Object.keys(CARD_FACE_STYLES)) {
    await app.click(`[data-card-face-style="${style}"]`);
    assert.equal(root.dataset.cardFaceStyle, style);
    assert.equal(app.window.app.settings.cardStyle, style, 'syncCardPresentationState records the face');
    const styled = [face, ...face.querySelectorAll('*')].some((node) => css.matchingRules(node)
      .some((rule) => rule.selectorText.includes(`data-card-face-style="${style}"`)));
    assert.ok(styled, `${style} faces are styled`);
  }
  for (const style of Object.keys(CARD_BACK_STYLES)) {
    await app.click(`button[data-card-back-style="${style}"]`);
    assert.equal(root.dataset.cardBackStyle, style);
    const back = app.$('#equityPlayers .poker-card-back');
    assert.ok(back, 'a card back is rendered');
    const styled = css.matchingRules(back).some((rule) => rule.selectorText.includes(`data-card-back-style="${style}"`))
      || css.matchingRules(back, { pseudoElement: 'after' }).some((rule) => rule.selectorText.includes(`data-card-back-style="${style}"`));
    assert.ok(styled, `${style} backs are styled`);
  }
  face.remove();
  app.byId('settingsModal')?.classList.remove('show');
  assert.match(table, /riverline:cardpresentationchange/);
});

test('DOM cards share one face markup and full-ten uses horizontal geometry only', () => {
  const ten = cardFaceMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' });
  assert.match(ten, /card-corner--top/);
  assert.match(ten, /card-corner--bottom/);
  assert.match(ten, /card-center/);
  assert.match(ten, /rank rank--ten/);
  // Protects: the full-ten rank is narrowed horizontally only, in every face style.
  const previous = { rank: root.dataset.cardRankStyle, face: root.dataset.cardFaceStyle };
  const host = app.document.createElement('span');
  host.className = 'riverline-card';
  host.innerHTML = ten;
  app.byId('trainingMode').appendChild(host);
  try {
    root.dataset.cardRankStyle = 'full-ten';
    for (const style of Object.keys(CARD_FACE_STYLES)) {
      root.dataset.cardFaceStyle = style;
      for (const rank of host.querySelectorAll('.rank--ten')) {
        const transform = css.cascaded(rank, 'transform') || '';
        assert.match(transform, /scaleX\(var\(--card-rank-ten-scale-x\)\)/, style);
        assert.doesNotMatch(transform, /scaleY\s*\(|\bscale\s*\(/, style);
      }
    }
  } finally {
    host.remove();
    root.dataset.cardRankStyle = previous.rank;
    root.dataset.cardFaceStyle = previous.face;
  }
  // Protects: DOM cards render through the shared card-presentation authority.
  const presentation = app.window.RiverlineCardPresentation;
  assert.equal(app.call('cardMarkup', 'Th'), presentation.cardFaceMarkup({ rank: 'T', suit: 'h', rankStyle: app.window.app.settings.cardRankStyle }));
});

test('table cards delegate to the same authority without changing 40 by 57 geometry', () => {
  const classic = tableCardSvgMarkup({ rank: 'A', suit: 's', faceStyle: 'classic' });
  const minimal = tableCardSvgMarkup({ rank: 'T', suit: 'h', faceStyle: 'minimal', rankStyle: 'full-ten' });
  const contrast = tableCardSvgMarkup({ rank: 'K', suit: 'c', faceStyle: 'high-contrast' });
  for (const markup of [classic, minimal, contrast]) {
    assert.match(markup, /width="40" height="57" rx="5" ry="5"/);
    assert.match(markup, /table-card-corner--top/);
    assert.match(markup, /table-card-center/);
  }
  assert.match(minimal, /table-card-rank--ten/);
  assert.match(table, /presentation\.tableCardSvgMarkup/);
  assert.match(table, /presentation\.tableCardBackSvgMarkup/);
});

test('Analysis hero cards now consume the premium mini-card family', () => {
  assert.match(teacher, /analysisCardTokenElement\(card\)/);
  assert.match(teacher, /analysis-mini-card riverline-card card--suit-/);
  assert.match(teacher, /token\.dataset\.cardSize = 'mini'/);
  assert.match(teacher, /presentation\.appendCardFaceContents/);
  const token = app.document.createElement('span');
  token.className = 'analysis-card-token';
  token.innerHTML = '<span class="analysis-mini-card riverline-card card--suit-h" data-card-size="mini"></span>';
  app.byId('gtoMode').appendChild(token);
  const mini = token.firstElementChild;
  assert.equal(css.cascaded(mini, 'position'), 'relative');
  assert.match(css.cascaded(mini, 'background'), /var\(--riverline-card-face/);
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(token, 'direction'), 'ltr');
  root.setAttribute('dir', 'ltr');
  token.remove();
});

test('four-color semantics and Daylight controls retain their semantic tokens', () => {
  // Protects: suit colours; two-colour mode maps diamonds to hearts (and clubs
  // to spades); native selects and number inputs use the Field tokens in every theme.
  const previousFour = root.dataset.fourColor;
  root.dataset.fourColor = 'true';
  for (const [suit, color] of Object.entries({ heart: '#c83e48', spade: '#18201c', diamond: '#326fb5', club: '#328755' })) {
    assert.equal(css.cascaded(root, `--suit-${suit}`).toLowerCase(), color, suit);
  }
  root.dataset.fourColor = 'false';
  assert.equal(css.cascaded(root, '--suit-diamond'), 'var(--suit-heart)');
  root.dataset.fourColor = previousFour;
  const previousTheme = root.dataset.theme;
  // DS-FOUNDATION-001: the Field component owns native selects/number inputs in every theme.
  for (const theme of ['midnight', 'graphite', 'daylight']) {
    root.dataset.theme = theme;
    for (const control of [app.byId('handButtonSeat'), app.byId('handTableSize')]) {
      assert.equal(css.cascaded(control, 'color'), 'var(--text-primary)', `${theme} ${control.id}`);
      assert.equal(css.cascaded(control, 'background-color'), 'var(--surface-inset)', `${theme} ${control.id}`);
    }
  }
  root.dataset.theme = previousTheme;
});

test('theme names remain curated and card identity tokens stay outside theme overrides', () => {
  assert.doesNotMatch(themes, /name: '[^']*\(0px\)|legacy:\s*true/);
  assert.doesNotMatch(themes, /Discord|Terminal|Brutalist|Casino|Cyberpunk|Luxury/);
  assert.match(themes, /name: 'Riverline Midnight'/);
  assert.match(themes, /name: 'Riverline Graphite'/);
  assert.match(themes, /name: 'Riverline Daylight'/);
  // Protects: themes never override the card identity (suit) tokens.
  const previousTheme = root.dataset.theme;
  root.dataset.theme = 'midnight';
  const baseline = ['heart', 'spade', 'diamond', 'club'].map((suit) => css.cascaded(root, `--suit-${suit}`));
  for (const theme of ['midnight', 'graphite', 'daylight']) {
    root.dataset.theme = theme;
    assert.deepEqual(['heart', 'spade', 'diamond', 'club'].map((suit) => css.cascaded(root, `--suit-${suit}`)), baseline, theme);
    const themeRules = css.matchingRules(root).filter((rule) => rule.selectorText.includes(`data-theme="${theme}"`));
    assert.ok(themeRules.every((rule) => rule.declarations.every((declaration) => !/^--suit-(?:heart|spade|diamond|club)$/.test(declaration.property))), theme);
  }
  root.dataset.theme = previousTheme;
});
