import fs from 'node:fs';
import vm from 'node:vm';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = logic.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing production function ${name}`);
  const brace = logic.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = brace; index < logic.length; index += 1) {
    const character = logic[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return logic.slice(start, index + 1);
    }
  }
  throw new Error(`Unterminated production function ${name}`);
}

function classList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    toggle(name, force) {
      if (force === true) values.add(name);
      else if (force === false) values.delete(name);
      else if (values.has(name)) values.delete(name);
      else values.add(name);
      return values.has(name);
    },
  };
}

export function delegatedCardSlotClick(group = 'hero', index = 0) {
  const listeners = {};
  const calls = { picker: [], rankStyle: [] };
  const sandbox = {
    console,
    localStorage: { getItem() { return null; }, setItem() {} },
    window: { addEventListener() {} },
    document: {
      documentElement: { dataset: { cardRankStyle: 'poker' } },
      addEventListener(type, listener) { listeners[type] = listener; },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`
    const app = { equity: { players: [{ cards: [] }, { cards: [] }] } };
    const PLAYBOOK_DECISION_CARD_GROUPS = Object.freeze(['hero', 'board', 'dead']);
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    function isHandMode() { return false; }
    function groupCards() { return []; }
    function applyCardRankStyle(style) { globalThis.__calls.rankStyle.push(style); }
    function openPicker(nextGroup, nextIndex) { globalThis.__calls.picker.push([nextGroup, nextIndex]); }
    function setEquityHandMode() {}
    function setEquityPlayerCount() {}
    function notifyCanonicalHeroCardsChanged() {}
    function notifyCanonicalBoardCardsChanged() {}
    function renderAllCards() {}
    function setEquityPending() {}
    function renderCanonicalHandWorkspace() {}
    function updateContext() {}
    function clearGroup() {}
    function bindSliderPair() {}
    function initTrainingMode() {}
    function renderPath() {}
    function initThemeSwatches() {}
    function renderBettingTree() {}
    const street = 'preflop';
    globalThis.__calls = ${JSON.stringify(calls)};
    ${extractFunction('bindEvents')}
    bindEvents();
  `, sandbox);

  const slot = { dataset: { group, index: String(index) } };
  const target = {
    closest(selector) {
      if (selector === '[data-card-rank-style]') return sandbox.document.documentElement;
      if (selector === 'button[data-card-rank-style]') return null;
      if (selector === '.card-slot') return slot;
      return null;
    },
  };
  listeners.click({ target });
  return sandbox.__calls;
}

export function createProductionPickerHarness({ handMode = false, rankStyle = 'poker' } = {}) {
  const elements = new Map();
  const slotElements = new Map();
  const makeElement = (overrides = {}) => ({
    classList: classList(),
    dataset: {},
    style: {},
    innerHTML: '',
    textContent: '',
    checked: false,
    ...overrides,
  });

  for (const id of ['deck', 'cardModal', 'modalTitle', 'modalCopy', 'burnControl', 'markBurn', 'deckCount', 'eqDeckCount', 'equityBoardCount', 'equityDeadCount']) {
    elements.set(`#${id}`, makeElement());
  }
  const groups = ['hero', 'board', 'dead', 'eqboard', 'eqdead', 'player-0', 'hand-seat-0'];
  groups.forEach((group) => slotElements.set(`[data-slots="${group}"]`, makeElement()));

  const sandbox = {
    console,
    CustomEvent: class CustomEvent {},
    localStorage: { getItem() { return null; }, setItem() {} },
    document: {
      documentElement: { dataset: { cardRankStyle: rankStyle } },
      querySelector(selector) { return elements.get(selector) || slotElements.get(selector) || null; },
      querySelectorAll() { return []; },
    },
    window: { SoundFX: null, dispatchEvent() {} },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`
    const PLAYBOOK_MODES = Object.freeze({ SCENARIO: 'scenario', HAND: 'hand' });
    const PLAYBOOK_DECISION_CARD_GROUPS = Object.freeze(['hero', 'board', 'dead']);
    const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
    const SUITS = [
      { id: 's', symbol: '♠' }, { id: 'h', symbol: '♥' },
      { id: 'd', symbol: '♦' }, { id: 'c', symbol: '♣' }
    ];
    const app = {
      settings: { cardRankStyle: ${JSON.stringify(rankStyle)} },
      gto: { hero: [], board: [], dead: [] },
      equity: { board: [], dead: [], players: [{ name: 'Hero', cards: [], handMode: 'known' }, { name: 'Opponent 1', cards: [], handMode: 'unknown' }] },
      training: { hero: [], board: [] },
      playbookHandDraft: { bySeat: {}, board: [] },
      playbookMode: ${handMode ? 'PLAYBOOK_MODES.HAND' : 'PLAYBOOK_MODES.SCENARIO'},
      picker: null,
      selectedHand: null
    };
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const getSuit = (card) => SUITS.find((suit) => suit.id === (card && card[1]));
    const displayCardRank = (rank) => rank === 'T' && app.settings.cardRankStyle === 'full-ten' ? '10' : rank;
    const displayCard = (card) => card ? displayCardRank(card[0]) + getSuit(card).symbol : '';
    const t = (value, variables = {}) => String(value).replace(/\\{(\\w+)\\}/g, (_, key) => variables[key] ?? '{' + key + '}');
    function isHandMode() { return app.playbookMode === PLAYBOOK_MODES.HAND; }
    function equityPlayerLabel(index) { return index === 0 ? 'Hero' : 'Player ' + (index + 1); }
    function callPlaybookStateBridge() { return null; }
    function toast() {}
    function notifyCanonicalHeroCardsChanged() {}
    function notifyCanonicalBoardCardsChanged() {}
    function setEquityPending() {}
    function renderCanonicalHandWorkspace() {}
    function updateContext() {}
    function updateActionOptions() {}
    function updateEquityReadiness() {}
    function renderCanonicalDecisionCards() {}
    function renderEquityPlayers() {}
    ${extractFunction('groupCards')}
    ${extractFunction('isEquityGroup')}
    ${extractFunction('usedCards')}
    ${extractFunction('remainingCards')}
    ${extractFunction('cardMarkup')}
    ${extractFunction('cardVisualState')}
    ${extractFunction('renderSlots')}
    function renderAllCards() {
      renderSlots('hero', 2); renderSlots('board', 5); renderSlots('dead', 52);
      renderSlots('eqboard', 5); renderSlots('eqdead', 52); renderSlots('player-0', 2);
      renderSlots('hand-seat-0', 2);
    }
    ${extractFunction('openPicker')}
    ${extractFunction('renderDeck')}
    ${extractFunction('firstEmptyIndex')}
    ${extractFunction('selectCard')}
    ${extractFunction('closePicker')}
    globalThis.__pickerApi = {
      app,
      openPicker,
      selectCard,
      closePicker,
      renderAllCards,
      groupCards,
      slotMarkup(group) { return document.querySelector('[data-slots="' + group + '"]').innerHTML; },
      modalOpen() { return document.querySelector('#cardModal').classList.contains('show'); }
    };
    renderAllCards();
  `, sandbox);
  return sandbox.__pickerApi;
}
