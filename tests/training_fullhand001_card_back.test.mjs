import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  CARD_BACK_ASSET_PATH,
  CARD_BACK_SIZES,
  CARD_BACK_VIEWBOX,
  cardBackHeight,
  cardBackSvgImageMarkup,
  createCardBackImage,
} from '../app/src/ui/card-back-art.mjs';
import { tableCardBackSvgMarkup } from '../app/src/application/card-presentation.mjs';
import { bootApp } from './helpers/app-under-test.mjs';

// TRAINING-FULLHAND-001: one original card-back SVG in three sizes.

const root = new URL('../app/', import.meta.url);
const svg = fs.readFileSync(new URL(CARD_BACK_ASSET_PATH, root), 'utf8');
const css = fs.readFileSync(new URL('styles.css', root), 'utf8');

test('the card back is one SVG file with the card ratio and three size tiers', () => {
  assert.match(svg, /viewBox="0 0 82 116"/);
  assert.deepEqual(CARD_BACK_VIEWBOX, { width: 82, height: 116 });
  // The file switches detail on its own rendered width: inline <= 30 px, table >= 70 px.
  assert.match(svg, /@media \(max-width: 30px\)/);
  assert.match(svg, /@media \(min-width: 70px\)/);
  // Original art, no external references or embedded raster images.
  assert.doesNotMatch(svg, /<image|href="http|xlink:href|<script|<foreignObject/);
  // Octagon frame and the lettered monogram exist.
  assert.match(svg, /<polygon[^>]+points="18,10 64,10 72,18/);
  assert.match(svg, /class="letter"/);
});

test('sizes are inline 20, standard 58 and table 82 px, all on the card ratio', () => {
  assert.deepEqual({ ...CARD_BACK_SIZES }, { inline: 20, standard: 58, table: 82 });
  assert.equal(cardBackHeight(58), 82);
  assert.equal(cardBackHeight(82), 116);
  assert.equal(cardBackHeight(20), 28);
});

test('createCardBackImage makes a decorative image for each named size and refuses others', async () => {
  const app = await bootApp();
  const doc = app.window.document;
  for (const [name, width] of Object.entries(CARD_BACK_SIZES)) {
    const image = createCardBackImage(doc, name);
    assert.equal(image.getAttribute('src'), CARD_BACK_ASSET_PATH);
    assert.equal(image.width, width);
    assert.equal(image.height, cardBackHeight(width));
    assert.equal(image.getAttribute('aria-hidden'), 'true');
    assert.equal(image.getAttribute('alt'), '');
  }
  assert.throws(() => createCardBackImage(doc, 'huge'), RangeError);
});

test('the table back embeds the art as one image and the Riverline style shows only it', () => {
  const markup = tableCardBackSvgMarkup({ index: 0 });
  assert.match(markup, /class="table-card-back-art"/);
  assert.ok(markup.includes(CARD_BACK_ASSET_PATH));
  assert.equal(cardBackSvgImageMarkup({ width: 40, height: 57 }).includes('width="40" height="57"'), true);
  assert.match(css, /html\[data-card-back-style="riverline"\] \.table-card-back-art \{ display: block; \}/);
  assert.match(css, /html\[data-card-back-style="riverline"\] \.table-card-back-face,/);
});

test('the Riverline style paints the art everywhere a card is face down; Solid and Geometric stay', () => {
  // DOM backs (.card-slot.facedown, .riverline-card-back) use the one file, with no "R" glyph overlay.
  assert.match(css, /background-image: url\("assets\/riverline-card-back\.svg"\) !important;/);
  assert.doesNotMatch(css, /\)::after \{\n  content: "R";/);
  // The Settings card-back choice stays.
  assert.match(css, /data-card-back-style="solid"/);
  assert.match(css, /data-card-back-style="geometric"/);
});
