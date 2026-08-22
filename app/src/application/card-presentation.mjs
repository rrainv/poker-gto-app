export const CARD_PRESENTATION_SCHEMA_VERSION = 'card-presentation/v1';
export const CARD_PRESENTATION_STORAGE_KEY = 'riverline_card_presentation';

export const LEGACY_CARD_PRESENTATION_STORAGE_KEYS = Object.freeze({
  fourColor: 'riverline_4color',
  rankStyle: 'riverline_card_rank_style',
  faceStyle: 'riverline_card_style',
});

export const CARD_FACE_STYLES = Object.freeze({
  classic: Object.freeze({ id: 'classic', label: 'Classic' }),
  minimal: Object.freeze({ id: 'minimal', label: 'Minimal' }),
  'high-contrast': Object.freeze({ id: 'high-contrast', label: 'High Contrast' }),
});

export const CARD_BACK_STYLES = Object.freeze({
  riverline: Object.freeze({ id: 'riverline', label: 'Riverline' }),
  solid: Object.freeze({ id: 'solid', label: 'Solid' }),
  geometric: Object.freeze({ id: 'geometric', label: 'Geometric' }),
});

export const CARD_RANK_STYLES = Object.freeze(['poker', 'full-ten']);

export const CARD_GEOMETRY = Object.freeze({
  ratio: 40 / 57,
  mini: Object.freeze({ width: 28, height: 40, radius: 4 }),
  result: Object.freeze({ width: 38, height: 54, radius: 5 }),
  table: Object.freeze({ width: 40, height: 57, radius: 5 }),
  picker: Object.freeze({ width: 36, height: 51, radius: 5 }),
  compact: Object.freeze({ width: 42, height: 60, radius: 5 }),
  slot: Object.freeze({ width: 48, height: 68, radius: 6 }),
  standard: Object.freeze({ width: 52, height: 74, radius: 7 }),
  representative: Object.freeze({ width: 52, height: 74, radius: 7 }),
  full: Object.freeze({ width: 56, height: 80, radius: 7 }),
});

export const CARD_RANK_GEOMETRY = Object.freeze({
  tenScaleX: 0.82,
  tableCorner: Object.freeze({ x: 8, rankY: 11, suitY: 21 }),
  tableCornerHighContrast: Object.freeze({ x: 10, rankY: 18, suitY: 36 }),
  tableCenter: Object.freeze({ x: 20, rankY: 25, suitY: 43 }),
});

export const DEFAULT_CARD_PRESENTATION = Object.freeze({
  schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
  faceStyle: 'minimal',
  backStyle: 'riverline',
  rankStyle: 'poker',
  fourColor: true,
});

const FACE_STYLE_ALIASES = Object.freeze({
  'classic-mirrored': 'classic',
  tournament: 'minimal',
  'clean-corner': 'minimal',
  'clarity-corner': 'high-contrast',
});

const SUITS = Object.freeze({
  h: Object.freeze({ id: 'h', symbol: '♥', name: 'hearts' }),
  '♥': Object.freeze({ id: 'h', symbol: '♥', name: 'hearts' }),
  d: Object.freeze({ id: 'd', symbol: '♦', name: 'diamonds' }),
  '♦': Object.freeze({ id: 'd', symbol: '♦', name: 'diamonds' }),
  c: Object.freeze({ id: 'c', symbol: '♣', name: 'clubs' }),
  '♣': Object.freeze({ id: 'c', symbol: '♣', name: 'clubs' }),
  s: Object.freeze({ id: 's', symbol: '♠', name: 'spades' }),
  '♠': Object.freeze({ id: 's', symbol: '♠', name: 'spades' }),
});
const CARD_SUIT_IDS = Object.freeze(['h', 'd', 'c', 's']);

function escapeMarkup(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function supportedFaceStyle(value) {
  const candidate = FACE_STYLE_ALIASES[value] ?? value;
  return Object.prototype.hasOwnProperty.call(CARD_FACE_STYLES, candidate)
    ? candidate
    : DEFAULT_CARD_PRESENTATION.faceStyle;
}

function supportedBackStyle(value) {
  return Object.prototype.hasOwnProperty.call(CARD_BACK_STYLES, value)
    ? value
    : DEFAULT_CARD_PRESENTATION.backStyle;
}

function supportedRankStyle(value) {
  return CARD_RANK_STYLES.includes(value) ? value : DEFAULT_CARD_PRESENTATION.rankStyle;
}

export function normalizeCardPresentation(value = {}) {
  const candidate = value && typeof value === 'object' ? value : {};
  return Object.freeze({
    schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
    faceStyle: supportedFaceStyle(candidate.faceStyle),
    backStyle: supportedBackStyle(candidate.backStyle),
    rankStyle: supportedRankStyle(candidate.rankStyle),
    fourColor: typeof candidate.fourColor === 'boolean'
      ? candidate.fourColor
      : DEFAULT_CARD_PRESENTATION.fourColor,
  });
}

function readStorage(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(storage, key) {
  try {
    storage?.removeItem?.(key);
  } catch {
    // Presentation remains usable when browser storage is unavailable.
  }
}

function legacyCardPresentation(storage) {
  const legacyFourColor = readStorage(storage, LEGACY_CARD_PRESENTATION_STORAGE_KEYS.fourColor);
  return normalizeCardPresentation({
    faceStyle: readStorage(storage, LEGACY_CARD_PRESENTATION_STORAGE_KEYS.faceStyle),
    rankStyle: readStorage(storage, LEGACY_CARD_PRESENTATION_STORAGE_KEYS.rankStyle),
    fourColor: legacyFourColor === null ? DEFAULT_CARD_PRESENTATION.fourColor : legacyFourColor !== 'false',
  });
}

export function loadCardPresentation(storage) {
  const serialized = readStorage(storage, CARD_PRESENTATION_STORAGE_KEY);
  let presentation = null;
  if (serialized !== null) {
    try {
      const parsed = JSON.parse(serialized);
      if (parsed?.schemaVersion === CARD_PRESENTATION_SCHEMA_VERSION) {
        presentation = normalizeCardPresentation(parsed);
      }
    } catch {
      presentation = null;
    }
  }
  if (!presentation) presentation = legacyCardPresentation(storage);
  writeStorage(storage, CARD_PRESENTATION_STORAGE_KEY, JSON.stringify(presentation));
  Object.values(LEGACY_CARD_PRESENTATION_STORAGE_KEYS).forEach((key) => removeStorage(storage, key));
  return presentation;
}

export function displayCardRank(rank, rankStyle = DEFAULT_CARD_PRESENTATION.rankStyle) {
  return rank === 'T' && supportedRankStyle(rankStyle) === 'full-ten' ? '10' : rank;
}

export function cardSuitPresentation(suit) {
  return SUITS[suit] ?? Object.freeze({ id: 'unknown', symbol: String(suit || '?'), name: 'unknown suit' });
}

function cardRankClass(displayRank, prefix = '') {
  return displayRank === '10' ? ` ${prefix}rank--ten` : '';
}

function cardRankWidthAttribute(displayRank) {
  return displayRank === '10' ? ' data-card-rank-width="wide"' : '';
}

function cardCornerMarkup(position, visualRank, presentation) {
  const rankWidth = cardRankWidthAttribute(visualRank);
  return `<span class="card-corner card-corner--${position}" aria-hidden="true" data-card-rank="${escapeMarkup(visualRank)}" data-card-suit="${escapeMarkup(presentation.symbol)}" data-card-suit-id="${escapeMarkup(presentation.id)}"${rankWidth}></span>`;
}

export function cardFaceMarkup({ rank, suit, rankStyle = DEFAULT_CARD_PRESENTATION.rankStyle } = {}) {
  const presentation = cardSuitPresentation(suit);
  const visualRank = displayCardRank(rank, rankStyle);
  const rankClass = cardRankClass(visualRank);
  const rankWidth = cardRankWidthAttribute(visualRank);
  return `${cardCornerMarkup('top', visualRank, presentation)}${cardCornerMarkup('bottom', visualRank, presentation)}<span class="card-center" aria-hidden="true" data-card-suit-id="${escapeMarkup(presentation.id)}"><span class="rank${rankClass} s-${escapeMarkup(presentation.id)}"${rankWidth}>${escapeMarkup(visualRank)}</span><span class="suit s-${escapeMarkup(presentation.id)}">${escapeMarkup(presentation.symbol)}</span></span>`;
}

export function appendCardFaceContents(element, { rank, suit, rankStyle = DEFAULT_CARD_PRESENTATION.rankStyle } = {}) {
  if (!element?.ownerDocument) return element;
  const presentation = cardSuitPresentation(suit);
  const visualRank = displayCardRank(rank, rankStyle);
  const documentRef = element.ownerDocument;
  element.dataset.cardSuitId = presentation.id;
  element.classList?.remove?.(...CARD_SUIT_IDS.map((suitId) => `card--suit-${suitId}`));
  element.classList?.add?.(`card--suit-${presentation.id}`);
  const configureCorner = (container) => {
    container.dataset.cardRank = visualRank;
    container.dataset.cardSuit = presentation.symbol;
    container.dataset.cardSuitId = presentation.id;
    if (visualRank === '10') container.dataset.cardRankWidth = 'wide';
  };
  const top = documentRef.createElement('span');
  top.className = 'card-corner card-corner--top';
  top.setAttribute('aria-hidden', 'true');
  configureCorner(top);
  const bottom = documentRef.createElement('span');
  bottom.className = 'card-corner card-corner--bottom';
  bottom.setAttribute('aria-hidden', 'true');
  configureCorner(bottom);
  const center = documentRef.createElement('span');
  center.className = 'card-center';
  center.setAttribute('aria-hidden', 'true');
  center.dataset.cardSuitId = presentation.id;
  const rankElement = documentRef.createElement('span');
  rankElement.className = `rank${cardRankClass(visualRank)} s-${presentation.id}`;
  if (visualRank === '10') rankElement.dataset.cardRankWidth = 'wide';
  rankElement.textContent = visualRank;
  const suitElement = documentRef.createElement('span');
  suitElement.className = `suit s-${presentation.id}`;
  suitElement.textContent = presentation.symbol;
  center.append(rankElement, suitElement);
  element.replaceChildren(top, bottom, center);
  return element;
}

export function tableCardSvgMarkup({
  rank,
  suit,
  index = 0,
  totalCards = 1,
  isCommunity = false,
  isDealing = false,
  rankStyle = DEFAULT_CARD_PRESENTATION.rankStyle,
  faceStyle = DEFAULT_CARD_PRESENTATION.faceStyle,
} = {}) {
  const geometry = CARD_GEOMETRY.table;
  const presentation = cardSuitPresentation(suit);
  const visualRank = displayCardRank(rank, rankStyle);
  const style = supportedFaceStyle(faceStyle);
  const rankClass = cardRankClass(visualRank, 'table-card-');
  const rankWidth = cardRankWidthAttribute(visualRank);
  const step = isCommunity ? 50 : 45;
  const finalX = ((index - ((totalCards - 1) / 2)) * step) - (geometry.width / 2);
  const tenScale = visualRank === '10' ? ` scale(${CARD_RANK_GEOMETRY.tenScaleX} 1)` : '';
  const corner = style === 'high-contrast'
    ? CARD_RANK_GEOMETRY.tableCornerHighContrast
    : CARD_RANK_GEOMETRY.tableCorner;
  const center = CARD_RANK_GEOMETRY.tableCenter;
  const cornerText = `<text class="riverline-card-corner-rank table-card-corner-rank${rankClass}"${rankWidth} x="0" y="0" transform="translate(${corner.x} ${corner.rankY})${tenScale}" text-anchor="middle">${escapeMarkup(visualRank)}</text><text class="riverline-card-corner-suit table-card-corner-suit" x="${corner.x}" y="${corner.suitY}" text-anchor="middle">${escapeMarkup(presentation.symbol)}</text>`;
  return `
    <g class="card-group poker-card-svg riverline-card card--known card--style-${style} card--suit-${escapeMarkup(presentation.id)}${isDealing ? ' is-card-dealt' : ''}" data-card-state="known" data-card-size="table" data-card-face-style="${style}" data-card-suit-id="${escapeMarkup(presentation.id)}" style="--card-final-x:${finalX}px; --card-deal-order:${Math.min(index, 4)}; transform:translate(${finalX}px, 0px);" dir="ltr">
      <rect class="riverline-card-face table-card-face" x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="${geometry.radius}" ry="${geometry.radius}" />
      <g class="table-card-corner table-card-corner--top" aria-hidden="true">${cornerText}</g>
      <g class="table-card-corner table-card-corner--bottom" aria-hidden="true" transform="translate(${geometry.width} ${geometry.height}) rotate(180)">${cornerText}</g>
      <g class="table-card-center" aria-hidden="true">
        <text class="table-card-center-rank${rankClass}"${rankWidth} x="0" y="0" transform="translate(${center.x} ${center.rankY})${tenScale}" text-anchor="middle">${escapeMarkup(visualRank)}</text>
        <text class="table-card-center-suit" x="${center.x}" y="${center.suitY}" text-anchor="middle">${escapeMarkup(presentation.symbol)}</text>
      </g>
    </g>`;
}

export function tableCardBackSvgMarkup({ index = 0 } = {}) {
  const geometry = CARD_GEOMETRY.table;
  const finalX = ((index - 0.5) * 25) - (geometry.width / 2);
  return `
    <g class="table-card-back poker-card-svg poker-card-back" data-card-state="unknown" data-card-size="table" transform="translate(${finalX}, 0)" dir="ltr">
      <rect class="table-card-back-face" x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="${geometry.radius}" ry="${geometry.radius}" />
      <rect class="table-card-back-inner" x="4" y="4" width="32" height="49" rx="3" ry="3" />
      <path class="table-card-back-river" d="M7 17 C15 11 25 11 33 17 M7 40 C15 46 25 46 33 40" />
      <path class="table-card-back-geometric" d="M20 7 L33 20 L20 33 L7 20 Z M20 24 L31 35 L20 46 L9 35 Z" />
      <text class="table-card-back-mark" x="20" y="34" text-anchor="middle">R</text>
    </g>`;
}

function dispatchPresentationEvent(eventTarget, state) {
  const EventConstructor = eventTarget?.CustomEvent ?? globalThis.CustomEvent;
  if (!eventTarget?.dispatchEvent || typeof EventConstructor !== 'function') return;
  eventTarget.dispatchEvent(new EventConstructor('riverline:cardpresentationchange', {
    detail: { ...state },
  }));
}

export function createCardPresentationController({
  root,
  storage,
  eventTarget = globalThis,
  fourColorToggle = null,
  faceStyleButtons = [],
  backStyleButtons = [],
  rankStyleButtons = [],
} = {}) {
  if (!root?.dataset) throw new TypeError('Card presentation requires a root element');
  let state = DEFAULT_CARD_PRESENTATION;

  function syncControls() {
    if (fourColorToggle) {
      fourColorToggle.classList?.toggle?.('on', state.fourColor);
      fourColorToggle.setAttribute?.('aria-pressed', String(state.fourColor));
    }
    [...faceStyleButtons].forEach((button) => {
      const selected = button.dataset.cardFaceStyle === state.faceStyle;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
      const preview = button.querySelector?.('[data-card-preview-face-style]');
      if (preview) appendCardFaceContents(preview, {
        rank: preview.dataset.cardPreviewRank,
        suit: preview.dataset.cardPreviewSuit,
        rankStyle: state.rankStyle,
      });
    });
    [...backStyleButtons].forEach((button) => {
      const selected = button.dataset.cardBackStyle === state.backStyle;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
    [...rankStyleButtons].forEach((button) => {
      const selected = button.dataset.cardRankStyle === state.rankStyle;
      button.classList?.toggle?.('active', selected);
      button.setAttribute?.('aria-pressed', String(selected));
    });
  }

  function applyRoot() {
    root.dataset.cardFaceStyle = state.faceStyle;
    root.dataset.cardStyle = state.faceStyle;
    root.dataset.cardBackStyle = state.backStyle;
    root.dataset.cardRankStyle = state.rankStyle;
    root.dataset.fourColor = String(state.fourColor);
  }

  function apply(next, { persist = true, emit = true } = {}) {
    state = normalizeCardPresentation({ ...state, ...next });
    applyRoot();
    syncControls();
    if (persist) writeStorage(storage, CARD_PRESENTATION_STORAGE_KEY, JSON.stringify(state));
    if (emit) dispatchPresentationEvent(eventTarget, state);
    return state;
  }

  function init() {
    state = loadCardPresentation(storage);
    applyRoot();
    syncControls();
    fourColorToggle?.addEventListener?.('click', () => apply({ fourColor: !state.fourColor }));
    [...faceStyleButtons].forEach((button) => button.addEventListener?.('click', () => (
      apply({ faceStyle: button.dataset.cardFaceStyle })
    )));
    [...backStyleButtons].forEach((button) => button.addEventListener?.('click', () => (
      apply({ backStyle: button.dataset.cardBackStyle })
    )));
    [...rankStyleButtons].forEach((button) => button.addEventListener?.('click', () => (
      apply({ rankStyle: button.dataset.cardRankStyle })
    )));
    return controller;
  }

  const controller = Object.freeze({
    schemaVersion: CARD_PRESENTATION_SCHEMA_VERSION,
    faceStyles: CARD_FACE_STYLES,
    backStyles: CARD_BACK_STYLES,
    geometry: CARD_GEOMETRY,
    init,
    apply,
    get: () => state,
    displayCardRank,
    cardSuitPresentation,
    cardFaceMarkup,
    appendCardFaceContents,
    tableCardSvgMarkup,
    tableCardBackSvgMarkup,
  });
  return controller;
}
