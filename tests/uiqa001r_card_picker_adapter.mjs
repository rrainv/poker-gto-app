import fs from 'node:fs';
import vm from 'node:vm';

import * as RiverlineCardPresentation from '../app/src/application/card-presentation.mjs';

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

function extractEquityLifecycleState() {
  const match = logic.match(
    /let equityCalculationGeneration = 0;\s*let equityCalculationRunning = false;\s*let equityProgressRevealTimer = null;/,
  );
  if (!match) throw new Error('Missing production Equity lifecycle state');
  return match[0];
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

function deckControlsFor(deck) {
  return [...deck.innerHTML.matchAll(/<button[^>]*data-deck-card="([A-Z0-9][shdc])"[^>]*>/g)].map((match) => {
    const card = match[1];
    const updateOpeningTag = (mutator) => {
      const pattern = new RegExp(`<button[^>]*data-deck-card="${card}"[^>]*>`);
      deck.updateMarkup((markup) => markup.replace(pattern, (openingTag) => mutator(openingTag)));
    };
    return {
      dataset: { deckCard: card },
      classList: {
        toggle(name, force) {
          updateOpeningTag((openingTag) => openingTag.replace(/class="([^"]*)"/, (_attribute, value) => {
            const names = new Set(value.split(/\s+/).filter(Boolean));
            if (force) names.add(name);
            else names.delete(name);
            return `class="${[...names].join(' ')}"`;
          }));
        },
      },
      set disabled(value) {
        updateOpeningTag((openingTag) => {
          const withoutDisabled = openingTag.replace(/\sdisabled(?=[\s>])/g, '');
          return value ? withoutDisabled.replace(/>$/, ' disabled>') : withoutDisabled;
        });
      },
      setAttribute(name, value) {
        updateOpeningTag((openingTag) => {
          const attribute = new RegExp(`\\s${name}="[^"]*"`);
          const withoutAttribute = openingTag.replace(attribute, '');
          return withoutAttribute.replace(/>$/, ` ${name}="${String(value)}">`);
        });
      },
    };
  });
}

function trackDeckBuilds(deck) {
  let markup = String(deck.innerHTML || '');
  let buildCount = 0;
  Object.defineProperty(deck, 'innerHTML', {
    configurable: true,
    get() { return markup; },
    set(value) { markup = String(value); buildCount += 1; },
  });
  deck.updateMarkup = (mutator) => { markup = String(mutator(markup)); };
  deck.deckBuildCount = () => buildCount;
}

export function delegatedCardSlotClick(group = 'hero', index = 0) {
  const listeners = {};
  const calls = { picker: [] };
  const sandbox = {
    console,
    RiverlineCardPresentation,
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
    const app = { equity: { players: [{ id: 'equity-player-0', cards: [] }, { id: 'equity-player-1', cards: [] }] } };
    const PLAYBOOK_DECISION_CARD_GROUPS = Object.freeze(['hero', 'board', 'dead']);
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    function isHandMode() { return false; }
    function groupCards() { return []; }
    function openPicker(nextGroup, nextIndex) { globalThis.__calls.picker.push([nextGroup, nextIndex]); }
    function setEquityHandMode() {}
    function openEquityHandPicker() {}
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
    hidden: false,
    disabled: false,
    setAttribute(name, value) { this[name] = String(value); },
    focus() {},
    contains() { return true; },
    replaceChildren() { this.innerHTML = ''; },
    querySelectorAll() { return []; },
    getClientRects() { return [{}]; },
    ...overrides,
  });

  for (const id of [
    'deck', 'cardModal', 'modalTitle', 'modalCopy', 'burnControl', 'markBurn',
    'deckCount', 'deadCardCount', 'eqDeckCount', 'equityBoardCount', 'equityDeadCount',
    'cardSetPickerContext', 'cardSetPickerKind', 'cardSetPickerOwner', 'cardSetPickerLabel',
    'cardSetPickerCount', 'cardSetPickerCards', 'cardSetPickerClear', 'cardSetPickerApply',
  ]) {
    elements.set(`#${id}`, makeElement());
  }
  trackDeckBuilds(elements.get('#deck'));
  elements.get('#deck').querySelectorAll = () => deckControlsFor(elements.get('#deck'));
  const groups = [
    'hero', 'board', 'dead', 'eqboard', 'eqdead', 'equity-hand-equity-player-0', 'hand-board-chance',
    ...Array.from({ length: 10 }, (_, seat) => `hand-seat-${seat}`),
  ];
  groups.forEach((group) => slotElements.set(`[data-slots="${group}"]`, makeElement()));

  const sandbox = {
    console,
    RiverlineCardPresentation,
    CustomEvent: class CustomEvent {},
    localStorage: { getItem() { return null; }, setItem() {} },
    document: {
      documentElement: { dataset: { cardRankStyle: rankStyle } },
      querySelector(selector) {
        const deckCard = selector.match(/^\[data-deck-card="([A-Z0-9][shdc])"\]$/)?.[1];
        if (deckCard) return deckControlsFor(elements.get('#deck')).find((control) => control.dataset.deckCard === deckCard) || null;
        return elements.get(selector) || slotElements.get(selector) || null;
      },
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
      equity: { board: [], dead: [], players: [{ id: 'equity-player-0', name: 'Hero', cards: [], handMode: 'known' }, { id: 'equity-player-1', name: 'Opponent 1', cards: [], handMode: 'unknown' }] },
      training: { hero: [], board: [] },
      playbookHandDraft: { bySeat: {}, board: [] },
      playbookMode: ${handMode ? 'PLAYBOOK_MODES.HAND' : 'PLAYBOOK_MODES.SCENARIO'},
      picker: null,
      selectedHand: null
    };
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const getSuit = (card) => SUITS.find((suit) => suit.id === (card && card[1]));
    const displayCardRank = (rank) => globalThis.RiverlineCardPresentation.displayCardRank(rank, app.settings.cardRankStyle);
    const displayCard = (card) => card ? displayCardRank(card[0]) + getSuit(card).symbol : '';
    const t = (value, variables = {}) => String(value).replace(/\\{(\\w+)\\}/g, (_, key) => variables[key] ?? '{' + key + '}');
    function isHandMode() { return app.playbookMode === PLAYBOOK_MODES.HAND; }
    function equityPlayerLabel(index) { return index === 0 ? 'Hero' : 'Player ' + (index + 1); }
    function callPlaybookStateBridge(method) {
      if (method === 'getHeroPlayerId') return 'player-0';
      if (method === 'getState') return {
        pendingChance: { type: 'deal_flop', cardCount: 3 },
        players: Array.from({ length: 10 }, (_, seat) => ({ playerId: 'player-' + seat, seat, position: 'Seat ' + (seat + 1) }))
      };
      return null;
    }
    function canonicalPlayerLabel(player) { return player?.position || 'Player'; }
    function toast() {}
    function notifyCanonicalHeroCardsChanged() {}
    function notifyCanonicalBoardCardsChanged() {}
    function setEquityPending() { renderEquityCards(); }
    function renderCanonicalHandWorkspace() {
      for (let seat = 0; seat < 10; seat += 1) renderSlots('hand-seat-' + seat, 2);
      renderSlots('hand-board-chance', 3);
    }
    function updateContext() {}
    function updateActionOptions() {}
    function updateEquityReadiness() {}
    function renderCanonicalDecisionCards() {}
    function renderEquityPlayers() {}
    function escapeEquityMarkup(value) { return String(value ?? ''); }
    ${extractFunction('equityHandGroup')}
    ${extractFunction('isEquityPrivateHandGroup')}
    ${extractFunction('equityPlayerFromHandGroup')}
    ${extractFunction('groupCards')}
    ${extractFunction('isEquityGroup')}
    ${extractFunction('usedCards')}
    ${extractFunction('remainingCards')}
    ${extractFunction('cardMarkup')}
    ${extractFunction('cardVisualState')}
    ${extractFunction('isPrivateHandCardSetGroup')}
    ${extractFunction('privateHandSetEditorMarkup')}
    ${extractFunction('boardCardSetEditorsMarkup')}
    ${extractFunction('renderSlots')}
    ${extractFunction('renderPlaybookCardStateSummary')}
    ${extractFunction('renderPlaybookCards')}
    function renderEquityCards() {
      renderSlots('eqboard', 5); renderSlots('eqdead', 52);
      renderSlots(equityHandGroup('equity-player-0'), 2);
    }
    function renderAllCards() {
      renderPlaybookCards();
      renderEquityCards();
      renderCanonicalHandWorkspace();
    }
    ${extractFunction('privateHandOwnerLabel')}
    ${extractFunction('boardStreetCardSetDefinition')}
    ${extractFunction('cardSetPickerDefinition')}
    ${extractFunction('renderCardSetPickerContext')}
    ${extractFunction('openPicker')}
    ${extractFunction('cardSetPickerScope')}
    ${extractFunction('unavailableCardsForPicker')}
    ${extractFunction('renderDeck')}
    ${extractFunction('updateDeckCardStates')}
    ${extractFunction('selectCard')}
    ${extractFunction('cardSetPickerFocusTarget')}
    ${extractFunction('replaceCardSetTarget')}
    ${extractFunction('renderCommittedCardSet')}
    ${extractFunction('finishCardSetCommit')}
    ${extractFunction('applyCardSetPicker')}
    ${extractFunction('clearPrivateHandPicker')}
    ${extractFunction('handleCardPickerKeydown')}
    ${extractFunction('closePicker')}
    globalThis.__pickerApi = {
      app,
      openPicker,
      selectCard,
      apply: applyCardSetPicker,
      clearPrivateHand: clearPrivateHandPicker,
      escape() { handleCardPickerKeydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); },
      closePicker,
      renderAllCards,
      groupCards,
      slotMarkup(group) { return document.querySelector('[data-slots="' + group + '"]').innerHTML; },
      deckMarkup() { return document.querySelector('#deck').innerHTML; },
      deckBuildCount() { return document.querySelector('#deck').deckBuildCount(); },
      contextMarkup() { return document.querySelector('#cardSetPickerCards').innerHTML; },
      applyDisabled() { return document.querySelector('#cardSetPickerApply').disabled; },
      cardStateSummary() {
        return {
          available: String(document.querySelector('#deckCount').textContent),
          dead: String(document.querySelector('#deadCardCount').textContent),
        };
      },
      modalOpen() { return document.querySelector('#cardModal').classList.contains('show'); }
    };
    renderAllCards();
  `, sandbox);
  return sandbox.__pickerApi;
}

export function createEquityHandEntryHarness() {
  const elements = new Map();
  const makeElement = (overrides = {}) => ({
    classList: classList(), dataset: {}, style: {}, innerHTML: '', textContent: '',
    hidden: false, disabled: false, checked: false, value: '',
    setAttribute(name, value) { this[name] = String(value); },
    focus() {}, contains() { return true; }, replaceChildren() { this.innerHTML = ''; },
    querySelectorAll() { return []; },
    querySelector() { return { focus() {} }; },
    ...overrides,
  });
  for (const id of [
    'deck', 'cardModal', 'modalTitle', 'modalCopy', 'burnControl', 'markBurn',
    'cardSetPickerContext', 'cardSetPickerKind', 'cardSetPickerOwner', 'cardSetPickerLabel',
    'cardSetPickerCount', 'cardSetPickerCards', 'cardSetPickerClear', 'cardSetPickerApply',
    'calculate', 'equityReadiness', 'equityEstimate', 'equitySeed', 'calcStyle', 'trials',
    'equityDetailRequested', 'equityDetailEstimate', 'equityDetailSamples', 'equityDetailSeed',
    'equityDetailUnknown', 'equityDetailBoard', 'cancelEquity', 'progress',
    'equityResultsPanel', 'equityStatus', 'equitySplitSummary', 'equityDetailActual',
    'equityDetailExecution', 'methodBadge',
  ]) elements.set(`#${id}`, makeElement());
  trackDeckBuilds(elements.get('#deck'));
  elements.get('#deck').querySelectorAll = () => deckControlsFor(elements.get('#deck'));
  elements.get('#calcStyle').value = 'auto';
  elements.get('#trials').value = '10000';
  const tile = makeElement();
  const editor = makeElement();

  const sandbox = {
    console,
    RiverlineCardPresentation,
    structuredClone,
    document: {
      activeElement: elements.get('#deck'),
      documentElement: { dataset: { cardRankStyle: 'poker' } },
      querySelector(selector) {
        if (selector.startsWith('[data-equity-edit-hand=')) return editor;
        const deckCard = selector.match(/^\[data-deck-card="([A-Z0-9][shdc])"\]$/)?.[1];
        if (deckCard) return deckControlsFor(elements.get('#deck')).find((control) => control.dataset.deckCard === deckCard) || null;
        return elements.get(selector) || null;
      },
      querySelectorAll() { return []; },
    },
    window: { RiverlineTutorials: null, clearTimeout() {}, setTimeout() {} },
  };
  sandbox.globalThis = sandbox;
  sandbox.__tile = tile;
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
      settings: { cardRankStyle: 'poker' },
      gto: { hero: [], board: [], dead: [] },
      equity: {
        board: [], dead: [], lifecycle: 'idle', lastResult: null, staleResult: null,
        players: [
          { id: 'equity-player-0', name: '', cards: [], handMode: 'known' },
          { id: 'equity-player-1', name: '', cards: [], handMode: 'unknown' }
        ]
      },
      training: { hero: [], board: [] },
      playbookHandDraft: { bySeat: {}, board: [] },
      picker: null, selectedHand: null, playbookMode: PLAYBOOK_MODES.SCENARIO
    };
    ${extractEquityLifecycleState()}
    const lifecycleTrace = [];
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const selectedValue = (selector) => $(selector)?.value;
    const numericValue = (selector, fallback) => Number($(selector)?.value || fallback);
    const getSuit = (card) => SUITS.find((suit) => suit.id === (card && card[1]));
    const displayCardRank = (rank) => globalThis.RiverlineCardPresentation.displayCardRank(rank, app.settings.cardRankStyle);
    const displayCard = (card) => card ? displayCardRank(card[0]) + getSuit(card).symbol : '';
    const t = (value, variables = {}) => String(value).replace(/\\{(\\w+)\\}/g, (_, key) => variables[key] ?? '{' + key + '}');
    function isHandMode() { return false; }
    function callPlaybookStateBridge() { return null; }
    function canonicalPlayerLabel() { return 'Player'; }
    function callEquityServiceBridge(method) {
      if (method === 'cancel') { lifecycleTrace.push('invalidate'); return false; }
      if (method !== 'estimate') return null;
      lifecycleTrace.push('estimate');
      return { ok: true, exactFeasible: true, exceedsSafeInteger: false, combinations: 100, combinationsText: '100' };
    }
    function equityFailureMessage() { return 'Unavailable'; }
    function toast() {}
    function renderCanonicalHandWorkspace() {}
    function updateContext() {}
    function renderAllCards() {}
    function setEquityCompositionState() {}
    function renderEquityPlayerResults() {}
    function renderEquityPlayers() { renderEquityCards(); }
    function renderEquityCardCounts() {}
    function renderEquitySharedCards() { renderEquityCards(); }
    function renderEquityHandAnalysis() {}
    function clearEquityResults() { lifecycleTrace.push('clear-results'); }
    ${extractFunction('equityHandGroup')}
    ${extractFunction('isEquityPrivateHandGroup')}
    ${extractFunction('equityPlayerFromHandGroup')}
    ${extractFunction('groupCards')}
    ${extractFunction('isEquityGroup')}
    ${extractFunction('usedCards')}
    ${extractFunction('remainingCards')}
    ${extractFunction('cardMarkup')}
    ${extractFunction('cardVisualState')}
    ${extractFunction('isPrivateHandCardSetGroup')}
    ${extractFunction('equityDefaultPlayerLabel')}
    ${extractFunction('equityPlayerLabel')}
    function escapeEquityMarkup(value) { return String(value ?? ''); }
    function equityHandEditorMarkup(player, _playerIndex, label) {
      return '<button data-equity-edit-hand="' + player.id + '" aria-label="Edit ' + label + ' hand">'
        + player.cards.map((card) => '<span data-card-id="' + card + '">' + cardMarkup(card) + '</span>').join('') + '</button>';
    }
    function renderEquityCards() {
      lifecycleTrace.push('render-inputs');
      globalThis.__tile.innerHTML = equityHandEditorMarkup(app.equity.players[0], 0, equityPlayerLabel(0));
    }
    ${extractFunction('openEquityHandPicker')}
    ${extractFunction('privateHandOwnerLabel')}
    ${extractFunction('boardStreetCardSetDefinition')}
    ${extractFunction('cardSetPickerDefinition')}
    ${extractFunction('renderCardSetPickerContext')}
    ${extractFunction('openPicker')}
    ${extractFunction('cardSetPickerScope')}
    ${extractFunction('unavailableCardsForPicker')}
    ${extractFunction('renderDeck')}
    ${extractFunction('updateDeckCardStates')}
    ${extractFunction('selectCard')}
    ${extractFunction('cardSetPickerFocusTarget')}
    ${extractFunction('replaceCardSetTarget')}
    ${extractFunction('renderCommittedCardSet')}
    ${extractFunction('finishCardSetCommit')}
    ${extractFunction('applyCardSetPicker')}
    ${extractFunction('clearPrivateHandPicker')}
    ${extractFunction('closePicker')}
    ${extractFunction('setEquityHandMode')}
    ${extractFunction('equityRequestFromCurrentInputs')}
    function formatEquityCombinationCount(estimate) { return estimate.combinationsText; }
    ${extractFunction('updateEquityReadiness')}
    ${extractFunction('setEquityCalculationRunning')}
    ${extractFunction('setEquityPending')}
    globalThis.__equityHandApi = {
      app,
      openHand: openEquityHandPicker,
      selectCard,
      apply: applyCardSetPicker,
      clearHand: clearPrivateHandPicker,
      cancel: closePicker,
      setMode: setEquityHandMode,
      request: equityRequestFromCurrentInputs,
      readiness: updateEquityReadiness,
      render() { renderEquityCards(); return globalThis.__tile.innerHTML; },
      deckMarkup() { return $('#deck').innerHTML; },
      deckBuildCount() { return $('#deck').deckBuildCount(); },
      contextMarkup() { return $('#cardSetPickerCards').innerHTML; },
      modalOpen() { return $('#cardModal').classList.contains('show'); },
      applyDisabled() { return $('#cardSetPickerApply').disabled; },
      calculateDisabled() { return $('#calculate').disabled; },
      readinessMessage() { return $('#equityReadiness').textContent; },
      trace({ clear = false } = {}) {
        const entries = lifecycleTrace.slice();
        if (clear) lifecycleTrace.length = 0;
        return entries;
      },
      sync() { renderEquityCards(); return updateEquityReadiness(); }
    };
    renderEquityCards();
    updateEquityReadiness();
  `, sandbox);
  return sandbox.__equityHandApi;
}
