// Shared Saved card-tile preview (Hero cards + board) used by the Saved library and
// Saved Training history. Presentation only: it renders already-stored card strings
// through card-presentation/v1 and computes no poker, strategy, or Equity.
// Card rows are poker data islands: they read left-to-right in every locale.

export const SAVED_POKER_PREVIEW_SCHEMA_VERSION = 'saved-poker-preview/v1';

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pokerIsland(doc, className) {
  const node = el(doc, 'span', `${className} poker-island`);
  node.dir = 'ltr';
  return node;
}

export function createSavedPreviewCard(doc, card, label, {
  size = 'mini',
  translate = (value) => value,
  getCardPresentation = null,
  getCardRankStyle = null,
} = {}) {
  const element = el(doc, 'span', 'saved-preview-card riverline-card');
  element.dataset.cardSize = size;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', card || translate(label));
  const match = typeof card === 'string' ? /^([2-9TJQKA])([cdhs])$/u.exec(card) : null;
  if (!match) {
    element.className = 'saved-preview-card saved-preview-card--unknown riverline-card-back';
    return element;
  }
  const presentation = getCardPresentation?.();
  if (presentation?.appendCardFaceContents) {
    presentation.appendCardFaceContents(element, {
      rank: match[1],
      suit: match[2],
      rankStyle: getCardRankStyle?.() || 'poker',
    });
  } else {
    element.textContent = card;
  }
  return element;
}

// `item` needs only { kind, derivation, heroCards, board }.
// Variants: compact (labelled mini cards), row (dense list rows: mini cards, the
// Hero/Board labels stay for assistive technology only), detail, quick.
export function createSavedPokerPreview(doc, item, { variant = 'compact', ...options } = {}) {
  const t = options.translate ?? ((value) => value);
  const preview = el(doc, 'span', `saved-poker-preview saved-poker-preview--${variant}`);
  preview.dataset.savedPreviewKind = item.kind;
  preview.dataset.savedPreviewDerivation = item.derivation;
  preview.setAttribute('aria-label', t('Stored poker preview'));
  const size = variant === 'detail' ? 'compact' : variant === 'quick' ? 'result' : 'mini';
  const cardOptions = { ...options, size };
  const hero = el(doc, 'span', 'saved-preview-group saved-preview-group--hero');
  const heroCards = pokerIsland(doc, 'saved-preview-cards');
  const knownHeroCards = Array.isArray(item.heroCards) ? item.heroCards : [];
  for (let index = 0; index < 2; index += 1) {
    heroCards.appendChild(createSavedPreviewCard(doc, knownHeroCards[index] || null, 'Unknown card', cardOptions));
  }
  const labelClass = variant === 'row' ? 'sr-only' : '';
  hero.append(el(doc, 'span', labelClass, t('Hero')), heroCards);
  const board = el(doc, 'span', 'saved-preview-group saved-preview-group--board');
  const boardCards = pokerIsland(doc, 'saved-preview-cards');
  (Array.isArray(item.board) ? item.board : []).forEach((card) => {
    boardCards.appendChild(createSavedPreviewCard(doc, card, 'Unknown card', cardOptions));
  });
  if (boardCards.childElementCount === 0) boardCards.appendChild(el(doc, 'span', 'saved-preview-empty-board', t('No board cards')));
  board.append(el(doc, 'span', labelClass, t('Board')), boardCards);
  preview.append(hero, board);
  return preview;
}
