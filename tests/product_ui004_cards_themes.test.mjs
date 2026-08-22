import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_BACK_STYLES,
  CARD_FACE_STYLES,
  cardFaceMarkup,
  tableCardSvgMarkup,
} from '../app/src/application/card-presentation.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const teacher = fs.readFileSync(new URL('../app/src/ui/teacher.js', import.meta.url), 'utf8');
const themes = fs.readFileSync(
  new URL('../app/src/application/presentation-theme.mjs', import.meta.url),
  'utf8',
);

test('curated card faces, backs, and rank notation are independent presentation controls', () => {
  assert.match(html, /id="cardFaceStyleControl"/);
  assert.match(html, /id="cardBackStyleControl"/);
  assert.match(html, /id="cardRankStyleControl"/);
  assert.match(html, /id="fourColorDeckToggle"/);
  for (const style of Object.keys(CARD_FACE_STYLES)) {
    assert.match(html, new RegExp(`data-card-face-style="${style}"`));
    assert.match(css, new RegExp(`data-card-face-style="${style}"`));
  }
  for (const style of Object.keys(CARD_BACK_STYLES)) {
    assert.match(html, new RegExp(`data-card-back-style="${style}"`));
    assert.match(css, new RegExp(`data-card-back-style="${style}"`));
  }
  assert.match(logic, /syncCardPresentationState/);
  assert.match(table, /riverline:cardpresentationchange/);
});

test('DOM cards share one face markup and full-ten uses horizontal geometry only', () => {
  const ten = cardFaceMarkup({ rank: 'T', suit: 'h', rankStyle: 'full-ten' });
  assert.match(ten, /card-corner--top/);
  assert.match(ten, /card-corner--bottom/);
  assert.match(ten, /card-center/);
  assert.match(ten, /rank rank--ten/);
  assert.match(css, /rank--ten[\s\S]*?scaleX\(var\(--card-rank-ten-scale-x\)\)/);
  for (const [, selector, declarations] of css.matchAll(/(?:^|})([^{}]*rank--ten[^{}]*)\{([^{}]*)\}/g)) {
    assert.doesNotMatch(declarations, /scaleY\s*\(|\bscale\s*\(/, selector);
  }
  assert.match(logic, /function cardMarkup\(card\)[\s\S]*?presentation\.cardFaceMarkup/);
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
  assert.match(css, /\.analysis-mini-card\s*\{[^}]*position:\s*relative[^}]*background:\s*var\(--riverline-card-face/);
  assert.match(css, /\[dir="rtl"\] \.analysis-card-token \{[^}]*direction:\s*ltr/);
});

test('four-color semantics and Daylight controls retain their semantic tokens', () => {
  for (const [suit, color] of Object.entries({ heart: '#c83e48', spade: '#18201c', diamond: '#326fb5', club: '#328755' })) {
    assert.match(css, new RegExp(`--suit-${suit}:\\s*${color}`, 'i'));
  }
  assert.match(css, /html\[data-four-color="false"\][\s\S]*?--suit-diamond:\s*var\(--suit-heart\)/);
  assert.match(css, /select, input\[type=number\] \{[\s\S]*?background:\s*var\(--surface-interactive\)[\s\S]*?color:\s*var\(--text-primary\)/);
});

test('theme names remain curated and card identity tokens stay outside theme overrides', () => {
  assert.doesNotMatch(themes, /name: '[^']*\(0px\)|legacy:\s*true/);
  assert.doesNotMatch(themes, /Discord|Terminal|Brutalist|Casino|Cyberpunk|Luxury/);
  assert.match(themes, /name: 'Riverline Midnight'/);
  assert.match(themes, /name: 'Riverline Graphite'/);
  assert.match(themes, /name: 'Riverline Daylight'/);
  for (const theme of ['midnight', 'graphite', 'daylight']) {
    const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
    assert.doesNotMatch(block, /--suit-(?:heart|spade|diamond|club)/);
  }
});
