// SAVED-COMPOSITION-002: pure Saved item presentation (title, meta facts, fact grid).
// It formats only already-stored preview facts (home-saved-item/v1); it computes no
// poker, strategy, or Equity and never invents a fact that was not stored.
// A user title always wins; otherwise the auto-title joins the stored facts.

export const SAVED_ITEM_PRESENTATION_SCHEMA_VERSION = 'saved-item-presentation/v1';

const SUIT_GLYPHS = Object.freeze({ s: '♠', h: '♥', d: '♦', c: '♣' });
const STREET_KEYS = Object.freeze({ preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' });

const identity = (key, parameters) => (parameters
  ? String(key).replace(/\{(\w+)\}/g, (match, name) => (name in parameters ? String(parameters[name]) : match))
  : key);

function translator(translate) {
  return typeof translate === 'function' ? translate : identity;
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// "As" -> "A♠". Unknown or malformed cards are not rendered as text.
export function savedCardText(card) {
  const match = typeof card === 'string' ? /^([2-9TJQKA])([cdhs])$/u.exec(card) : null;
  return match ? `${match[1]}${SUIT_GLYPHS[match[2]]}` : null;
}

function heroCardsText(item) {
  const cards = Array.isArray(item.heroCards) ? item.heroCards.map(savedCardText) : [];
  return cards.length === 2 && cards.every(Boolean) ? cards.join('') : null;
}

function streetText(item, t) {
  return STREET_KEYS[item.street] ? t(STREET_KEYS[item.street]) : null;
}

function bbText(value) {
  return `${value} bb`;
}

export function savedItemKindLabelKey(item) {
  if (item?.kind === 'hand') return 'Saved Hand';
  if (item?.kind === 'spot') return 'Saved Spot';
  return 'Saved item';
}

// Auto-title from stored facts only, in a fixed order:
// Hero cards (both known) · position (vs the stored aggressor, Spots only) · street,
// and the stored stack when no Hero cards are known. Falls back to the kind label.
export function savedItemAutoTitle(item, translate) {
  const t = translator(translate);
  if (!item || (item.kind !== 'hand' && item.kind !== 'spot')) return t(savedItemKindLabelKey(item));
  const parts = [];
  const cards = heroCardsText(item);
  if (cards) parts.push(cards);
  const hero = text(item.heroPosition);
  const villain = item.kind === 'spot' ? text(item.aggressorPosition) : null;
  if (hero && villain && villain !== hero) parts.push(t('{hero} vs {villain}', { hero, villain }));
  else if (hero) parts.push(hero);
  const street = streetText(item, t);
  if (street) parts.push(street);
  const stack = finite(item.stackBb);
  if (!cards && stack !== null) parts.push(bbText(stack));
  return parts.length ? parts.join(' · ') : t(savedItemKindLabelKey(item));
}

export function savedItemTitle(item, translate) {
  return text(item?.title) ?? savedItemAutoTitle(item, translate);
}

export function savedItemHasUserTitle(item) {
  return text(item?.title) !== null;
}

function originKey(item) {
  if (item.kind === 'hand') return 'Canonical Hand';
  if (item.kind === 'spot') return item.derivation === 'scenario' ? 'Scenario' : 'Hand-derived';
  return null;
}

// One-line row metadata. A pot is shown only when it was stored as a live amount;
// a completed Hand stores no undistributed pot, so the fact is omitted (never "Pot 0").
export function savedItemMetaFacts(item, translate) {
  const t = translator(translate);
  const facts = [];
  if (Number.isInteger(item?.tableSize)) facts.push(t('{count}-handed', { count: item.tableSize }));
  if (text(item?.heroPosition)) facts.push(item.heroPosition);
  const street = item ? streetText(item, t) : null;
  if (street) facts.push(street);
  if (finite(item?.stackBb) !== null) facts.push(bbText(item.stackBb));
  if (finite(item?.potBb) !== null && item.potBb > 0) facts.push(`${t('Pot')} ${bbText(item.potBb)}`);
  if (item?.kind === 'spot') facts.push(t(originKey(item)));
  return facts;
}

// Inspector fact grid: label/value pairs from stored facts; absent facts are omitted.
export function savedItemFactGrid(item, translate, { updated = null } = {}) {
  const t = translator(translate);
  if (!item) return [];
  const rows = [];
  const add = (key, labelKey, value) => { if (value !== null && value !== undefined && value !== '') rows.push({ key, label: t(labelKey), value: String(value) }); };
  add('players', 'Players', Number.isInteger(item.tableSize) ? t('{count}-handed', { count: item.tableSize }) : null);
  add('position', 'Position', text(item.heroPosition));
  add('street', 'Street', streetText(item, t));
  add('stack', 'Stack', finite(item.stackBb) !== null ? bbText(item.stackBb) : null);
  add('pot', 'Pot', finite(item.potBb) !== null && item.potBb > 0 ? bbText(item.potBb) : null);
  add('result', 'Result', item.kind === 'hand' && item.handComplete === true ? t('Hand complete') : null);
  add('origin', 'Origin', originKey(item) ? t(originKey(item)) : null);
  add('updated', 'Updated', text(updated));
  return rows;
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineSavedItemPresentation', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: SAVED_ITEM_PRESENTATION_SCHEMA_VERSION,
      title: savedItemTitle,
      autoTitle: savedItemAutoTitle,
      metaFacts: savedItemMetaFacts,
      factGrid: savedItemFactGrid,
      kindLabelKey: savedItemKindLabelKey,
    }),
    writable: false,
  });
}
