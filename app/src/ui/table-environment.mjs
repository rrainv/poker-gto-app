import { tableSeatAnchors, createTableGeometryProfile } from '../application/table-presentation.mjs';
import { bindDisclosureDismissal } from './study-disclosure.mjs';

// Fictional appearance only. No policy presets, seeds, cards, storage or grading.
const COPY = {
  cast: ['Table cast', 'Участники стола', 'דמויות בשולחן'],
  seats: ['Seats', 'Места', 'מושבים'],
  actor: ['To act', 'Ходит', 'בתור'],
  dealer: ['Dealer button', 'Баттон дилера', 'כפתור הדילר'],
  hero: ['Hero', 'Hero', 'Hero'],
  seat: ['Seat', 'Место', 'מושב'],
  appearance: ['Fictional identities for this session. Appearance only; behavior comes from Opponent settings.',
    'Вымышленные персонажи на эту сессию. Образ меняется здесь, поведение, в настройках соперника.',
    'דמויות בדיוניות למפגש זה. המראה משתנה כאן; ההתנהגות נקבעת בהגדרות היריב.'],
  mika: ['Mika · Notebook collector', 'Мика · Коллекционер блокнотов', 'מיקה · אוספת מחברות'],
  pip: ['Pip · Puzzle fan', 'Пип · Любитель головоломок', 'פיפ · חובב חידות'],
  nova: ['Nova · Night owl', 'Нова · Ночная сова', 'נובה · ציפור לילה'],
  remy: ['Remy · Coffee enthusiast', 'Реми · Ценитель кофе', 'רמי · חובב קפה'],
  cleo: ['Cleo · Sketchbook regular', 'Клео · Любитель скетчей', 'קליאו · חובבת איור'],
  otto: ['Otto · Vinyl collector', 'Отто · Коллекционер винила', 'אוטו · אספן תקליטים'],
  luma: ['Luma · Stargazer', 'Лума · Любитель звёзд', 'לומה · צופה בכוכבים'],
  zig: ['Zig · Weekend cyclist', 'Зиг · Велосипедист выходного дня', 'זיג · רוכב בסופי שבוע'],
  fern: ['Fern · Plant keeper', 'Ферн · Любитель растений', 'פרן · חובבת צמחים'],
  sol: ['Sol · Sunday baker', 'Сол · Пекарь по воскресеньям', 'סול · אופה בימי ראשון'],
};
export const tableEnvironmentCopy = (key, language = 'en') => COPY[key]?.[{ en: 0, ru: 1, he: 2 }[language] ?? 0] ?? key;
export const OPPONENT_IDENTITIES = Object.freeze(['mika', 'pip', 'nova', 'remy', 'cleo', 'otto', 'luma', 'zig', 'fern', 'sol']);
const PORTRAITS = Object.freeze(Object.fromEntries(OPPONENT_IDENTITIES.map(id =>
  [id, new URL(`./assets/opponents/${id}-seat.webp`, import.meta.url).href])));
const PORTRAIT_PREVIEWS = Object.freeze(Object.fromEntries(OPPONENT_IDENTITIES.map(id =>
  [id, new URL(`./assets/opponents/${id}-preview.webp`, import.meta.url).href])));
const SUBTITLES = {
  mika: ['Archivist', 'Архивист', 'ארכיונאית'], pip: ['Puzzler', 'Загадочник', 'חובב חידות'],
  nova: ['Night owl', 'Ночная сова', 'ציפור לילה'], remy: ['Coffee fan', 'Кофеман', 'חובב קפה'],
  cleo: ['Sketcher', 'Художница', 'מאיירת'], otto: ['Vinyl fan', 'Меломан', 'אספן תקליטים'],
  luma: ['Stargazer', 'Звездочёт', 'צופה בכוכבים'], zig: ['Cyclist', 'Велогонщик', 'רוכב אופניים'],
  fern: ['Gardener', 'Садовница', 'גננית'], sol: ['Baker', 'Пекарь', 'אופה'],
};
export const opponentPortrait = (id, size = 'seat') => (size === 'preview' ? PORTRAIT_PREVIEWS[id] : PORTRAITS[id]) || '';
export const opponentSubtitle = (id, language = 'en') => SUBTITLES[id]?.[{ en: 0, ru: 1, he: 2 }[language] ?? 0] || '';

export function createTableCast() {
  const assignments = new Map();
  let roster = '', enabled = false;
  return Object.freeze({
    sync(seats, synthetic) {
      const ordered = seats.slice().sort((a, b) => a.seat - b.seat);
      const key = JSON.stringify(ordered.map(({ seat, isHero }) => [seat, isHero]));
      if (!synthetic || key !== roster) assignments.clear();
      roster = key; enabled = synthetic;
      if (enabled) ordered.filter(player => !player.isHero).forEach((player, index) => {
        if (!assignments.has(player.seat)) assignments.set(player.seat, OPPONENT_IDENTITIES[index % OPPONENT_IDENTITIES.length]);
      });
    },
    identity(seat) { return enabled ? assignments.get(seat) ?? null : null; },
    select(seat, identity) {
      if (!enabled || !assignments.has(seat) || !OPPONENT_IDENTITIES.includes(identity)) return false;
      assignments.set(seat, identity); return true;
    },
  });
}

export function mountTableEnvironment({ root, language = () => 'en', onChange = () => {} }) {
  const doc = root.ownerDocument, life = new AbortController(), cast = createTableCast();
  const el = (tag, text, className) => {
    const node = doc.createElement(tag); if (text !== undefined) node.textContent = text;
    if (className) node.className = className; return node;
  };
  const t = key => tableEnvironmentCopy(key, language());
  const facts = el('div', undefined, 'table-environment-facts');
  const details = el('details', undefined, 'study-disclosure table-cast');
  const summary = el('summary'), note = el('p', undefined, 'study-note'), list = el('div', undefined, 'table-cast-list');
  details.append(summary, note, list); root.append(facts, details);
  root.className = 'table-environment'; root.hidden = true;
  bindDisclosureDismissal(details, { signal: life.signal });
  let signature = '', renderLife = new AbortController(), currentSeats = [];
  const identity = player => player?.isHero ? null : cast.identity(player?.seat);
  const name = player => {
    const id = identity(player);
    return id ? t(id).split(' · ')[0] : player.isHero ? t('hero') : player.suppliedName || `${t('seat')} ${player.seat + 1}`;
  };
  function renderFacts() {
    facts.replaceChildren();
    for (const [key, player] of [['actor', currentSeats.find(seat => seat.isCurrentActor)], ['dealer', currentSeats.find(seat => seat.isButton)]]) {
      if (!player) continue;
      const chip = el('span', undefined, `table-context-chip table-context-chip--${key}`);
      chip.append(el('span', t(key)), el('bdi', `${name(player)} · ${player.position || `${t('seat')} ${player.seat + 1}`}`));
      facts.append(chip);
    }
  }
  function update(state, { synthetic = false } = {}) {
    const seats = state?.seats ?? [];
    currentSeats = seats;
    cast.sync(seats, synthetic);
    if (synthetic) for (const player of seats.filter(player => !player.isHero)) {
      const selected = doc.defaultView?.RiverlineTrainingLineup?.character(player.seat);
      if (selected) cast.select(player.seat, selected);
    }
    root.hidden = !seats.length || state.empty === true;
    root.dir = language() === 'he' ? 'rtl' : 'ltr';
    details.hidden = !synthetic;
    if (!synthetic) details.open = false;
    renderFacts();
    const key = JSON.stringify([synthetic, language(), seats.map(({ seat, isHero, position }) => [seat, isHero, position])]);
    if (key === signature) return;
    signature = key; renderLife.abort(); renderLife = new AbortController(); list.replaceChildren();
    summary.textContent = t('cast'); note.textContent = t('appearance');
    if (!synthetic) return;
    for (const player of seats.filter(player => !player.isHero)) {
      const row = el('label', undefined, 'table-cast-seat'), badge = el('img', undefined, 'table-cast-avatar');
      badge.decoding = 'async'; badge.loading = 'lazy';
      badge.alt = ''; badge.width = 52; badge.height = 52; badge.decoding = 'async';
      badge.ariaHidden = 'true';
      const label = el('span', `${t('seat')} ${player.seat + 1} · ${player.position || '-'}`, 'table-cast-position');
      const select = el('select'); select.className = 'control-select'; select.dataset.castSeat = String(player.seat);
      for (const id of OPPONENT_IDENTITIES) { const option = el('option', t(id)); option.value = id; select.append(option); }
      const paint = () => { const id = cast.identity(player.seat); badge.src = opponentPortrait(id); badge.dataset.identity = id; };
      select.value = cast.identity(player.seat); paint(); row.append(badge, label, select); list.append(row);
      select.addEventListener('change', () => {
        if (!cast.select(player.seat, select.value)) return;
        doc.defaultView?.RiverlineTrainingLineup?.setCharacter?.(player.seat, select.value);
        paint(); renderFacts(); onChange();
        // Native appearance selection only; never a projected poker event.
        if (typeof SoundFX !== 'undefined') SoundFX.playClick();
      }, { signal: renderLife.signal });
    }
  }
  return Object.freeze({ update, identity, name,
    portrait: player => opponentPortrait(identity(player)),
    subtitle: player => opponentSubtitle(identity(player), language()),
    dispose() { life.abort(); renderLife.abort(); cast.sync([], false); root.replaceChildren(); } });
}

if (typeof window !== 'undefined') window.RiverlineTableEnvironment = Object.freeze({ mount: mountTableEnvironment, anchors: tableSeatAnchors, layout: createTableGeometryProfile });
