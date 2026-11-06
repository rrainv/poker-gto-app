// TRAINING-FULLHAND-001: the Riverline card back. One original SVG file
// (app/assets/riverline-card-back.svg) serves every size; the file switches its
// own detail tier on its rendered width, so there is no second drawing.
// Sizes (width in px): inline 20, standard 58, table 82. Height follows the
// card ratio. The Settings card-back choice stays: this art is the "riverline"
// style; "solid" and "geometric" keep their CSS looks.

export const CARD_BACK_ASSET_PATH = 'assets/riverline-card-back.svg';
export const CARD_BACK_VIEWBOX = Object.freeze({ width: 82, height: 116 });
export const CARD_BACK_SIZES = Object.freeze({ inline: 20, standard: 58, table: 82 });

export function cardBackHeight(width) {
  return Math.round((width * CARD_BACK_VIEWBOX.height) / CARD_BACK_VIEWBOX.width);
}

/** An <img> of the back at a named size ("inline", "standard", "table"). */
export function createCardBackImage(doc, size = 'standard', { className = '' } = {}) {
  const width = CARD_BACK_SIZES[size];
  if (!width) throw new RangeError(`Unknown card back size: ${size}`);
  const image = doc.createElement('img');
  image.className = `riverline-card-back-art ${className}`.trim();
  image.src = CARD_BACK_ASSET_PATH;
  image.alt = '';
  image.width = width;
  image.height = cardBackHeight(width);
  image.setAttribute('aria-hidden', 'true');
  image.setAttribute('draggable', 'false');
  image.dataset.cardSize = size;
  return image;
}

/** The back as an SVG <image> that fills a table card's rectangle. */
export function cardBackSvgImageMarkup({ width, height }) {
  return `<image class="table-card-back-art" href="${CARD_BACK_ASSET_PATH}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" aria-hidden="true"/>`;
}
