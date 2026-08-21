

/* Riverline application logic

 * Production recommendations use the deterministic heuristic fallback.

 * Equity uses complete seven-card hand ordering, including kickers and split pots.

 */



const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const SUITS = [

  { id: 'h', symbol: '♥' },

  { id: 's', symbol: '♠' },

  { id: 'd', symbol: '♦' },

  { id: 'c', symbol: '♣' }

];


window.SoundFX = SoundFX;





const POSITIONS = {

  2: ['BTN', 'BB'],

  3: ['BTN', 'SB', 'BB'],

  4: ['BTN', 'CO', 'SB', 'BB'],

  5: ['BTN', 'HJ', 'CO', 'SB', 'BB'],

  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],

  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],

  8: ['UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],

  9: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],

  10: ['UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']

};

const ACTION_COLORS = {

  aggressive: 'var(--action-aggressive)',

  passive: 'var(--action-passive)',

  check: 'var(--action-passive)',

  fold: 'var(--action-fold)',

  'all-in': 'var(--action-all-in)',

  unavailable: 'var(--border-strong)'

};

const RANK_VALUE = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };

const PLAYBOOK_SCENARIO_SCHEMA_VERSION = 'playbook-scenario/v1';
const PLAYBOOK_MODES = Object.freeze({ SCENARIO: 'scenario', HAND: 'hand' });



const app = {
  settings: { tightness: 0, fourColorDeck: true, cardRankStyle: 'poker', cardStyle: 'tournament' },

  gto: { hero: [], board: [], dead: [] },

  equity: {

    board: [],

    dead: [],

    nextPlayerId: 2,

    players: [

      { id: 'equity-player-0', name: 'Hero', cards: [], handMode: 'known' },

      { id: 'equity-player-1', name: 'Opponent 1', cards: [], handMode: 'unknown' }

    ],

    lifecycle: 'idle',

    lastRequest: null,

    lastResult: null,

    lastProgress: null,

    lastError: null

  },

  training: {

    hero: [],

    board: [],

    stats: { totalHands: 0, correct: 0, streak: 0 },

    gradeStats: { optimal: 0, acceptable: 0, mistake: 0 },

    bestStreak: 0,

    studyHintStep: 0,

    studyHintExplanation: null,

    currentHand: null,

    currentSolution: null,

    currentExercise: null,

    currentStrategyResult: null,

    currentEvaluation: null,

    currentPresentation: null,

    currentAnalysisExplanation: null,

    lifecycle: 'idle',

    nextSeed: Date.now() >>> 0,

    sessionMode: 'varied',

    practiceSession: null

  },

  playbookHandDraft: { bySeat: {}, board: [] },

  picker: null,

  chartStreet: 'preflop',

  selectedHand: null,

  matrixModel: null,

  lastContextKey: '',

  decisionContext: null,

  strategyResult: null,

  analysisExplanation: null,

  playbookMode: PLAYBOOK_MODES.SCENARIO,

  playbookResolution: null,

  playbookViewModel: null

};

window.app = app;

function callPlaybookStateBridge(method, ...args) {
  try {
    const bridge = window.RiverlinePlaybookState;
    if (!bridge || typeof bridge[method] !== 'function') return null;
    return bridge[method](...args);
  } catch (error) {
    console.error('[Riverline Playbook state source]', error);
    return null;
  }
}

function callSavedStudyBridge(method, ...args) {
  const bridge = window.RiverlineSavedStudyObjects;
  if (!bridge || typeof bridge[method] !== 'function') {
    return Promise.reject(new Error('Riverline Saved Study Objects bridge is unavailable'));
  }
  try {
    return Promise.resolve(bridge[method](...args));
  } catch (error) {
    return Promise.reject(error);
  }
}

function callHomeBridge(method, ...args) {
  const bridge = window.RiverlineHome;
  if (!bridge || typeof bridge[method] !== 'function') {
    return Promise.reject(new Error('Riverline Home bridge is unavailable'));
  }
  try {
    return Promise.resolve(bridge[method](...args));
  } catch (error) {
    return Promise.reject(error);
  }
}

function callEquityServiceBridge(method, ...args) {
  try {
    const bridge = window.RiverlineEquity;
    if (!bridge || typeof bridge[method] !== 'function') return null;
    return bridge[method](...args);
  } catch (error) {
    console.error('[Riverline Equity service]', error);
    return null;
  }
}

function callTrainingServiceBridge(method, ...args) {
  try {
    const bridge = window.RiverlineTraining;
    if (!bridge || typeof bridge[method] !== 'function') return null;
    return bridge[method](...args);
  } catch (error) {
    console.error('[Riverline Training service]', error);
    return null;
  }
}

function callTrainingPresentationBridge(method, ...args) {
  try {
    const bridge = window.RiverlineTrainingPresentation;
    if (!bridge || typeof bridge[method] !== 'function') return null;
    return bridge[method](...args);
  } catch (error) {
    console.error('[Riverline Training presentation]', error);
    return null;
  }
}

function requireStrategyProviderBridge() {
  const bridge = globalThis.RiverlineStrategy;
  if (!bridge || bridge.schemaVersion !== 'strategy-provider/v1'
    || typeof bridge.createProvider !== 'function') {
    throw new Error('Riverline StrategyProvider bridge is unavailable');
  }
  return bridge;
}

function requireProductPerformanceBridge() {
  const bridge = globalThis.RiverlineProductPerformance;
  if (!bridge || bridge.schemaVersion !== 'product-performance/v1'
    || typeof bridge.createLatestFrameScheduler !== 'function'
    || typeof bridge.createSurfaceInvalidator !== 'function') {
    throw new Error('Riverline product-performance bridge is unavailable');
  }
  return bridge;
}


const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

const allDeck = () => SUITS.flatMap((suit) => RANKS.map((rank) => rank + suit.id));

const getSuit = (card) => SUITS.find((suit) => suit.id === (card && card[1]));

const displayCardRank = (rank) => rank === 'T' && app.settings.cardRankStyle === 'full-ten' ? '10' : rank;

const displayCard = (card) => card ? displayCardRank(card[0]) + getSuit(card).symbol : '';

const selectedValue = (id) => ($(id) || {}).value;



// ---------------------------------------------------------------------------

// Card entry

// ---------------------------------------------------------------------------



function groupCards(group) {

  if (group === 'hero') return app.gto.hero;

  if (group === 'board') return app.gto.board;

  if (group === 'dead') return app.gto.dead;

  if (group === 'trainingHero') return app.training.hero;

  if (group === 'trainingBoard') return app.training.board;

  if (group === 'eqboard') return app.equity.board;

  if (group === 'eqdead') return app.equity.dead;

  if (group === 'hand-board-chance') return app.playbookHandDraft.board;

  if (group.startsWith('hand-seat-')) {

    const seat = Number(group.slice('hand-seat-'.length));

    if (!app.playbookHandDraft.bySeat[seat]) app.playbookHandDraft.bySeat[seat] = [];

    return app.playbookHandDraft.bySeat[seat];

  }

  if (group.startsWith('player-')) return app.equity.players[Number(group.slice(7))].cards;

  return [];

}



function isEquityGroup(group) {

  return group.startsWith('eq') || group.startsWith('player-');

}



function usedCards(scope) {

  const s = String(scope || '');

  const equity = s === 'equity' || isEquityGroup(s);

  const training = s === 'training' || s.startsWith('training');

  const canonicalHand = s === 'hand' || s.startsWith('hand-');
  const canonicalState = canonicalHand ? callPlaybookStateBridge('getState') : null;

  const cards = canonicalHand

    ? [
        ...Object.values(app.playbookHandDraft.bySeat).flat(),
        ...app.playbookHandDraft.board,
        ...(canonicalState?.board || []),
        ...(canonicalState?.deadCards || []),
        ...(canonicalState?.players || []).flatMap((player) => (
          Array.isArray(player.holeCards) ? player.holeCards : []
        ))
      ]

    : equity

    ? [...app.equity.board, ...app.equity.dead, ...app.equity.players.flatMap((player) => player.cards)]

    : training

    ? [...(app.training?.hero || []), ...(app.training?.board || [])]

    : [...app.gto.hero, ...app.gto.board, ...app.gto.dead];

  return cards.filter(Boolean);

}



function remainingCards(scope) {

  return 52 - new Set(usedCards(scope)).size;

}



function cardMarkup(card) {

  if (!card) return '';

  const suit = getSuit(card);
  
  const rank = displayCardRank(card[0]);
  const rankClass = rank === '10' ? ' rank--ten' : '';
  const face = `<span class="rank${rankClass} s-${suit.id}">${rank}</span><span class="suit s-${suit.id}">${suit.symbol}</span>`;
  return `<span class="card-corner card-corner--top" aria-hidden="true">${face}</span><span class="card-corner card-corner--bottom" aria-hidden="true">${face}</span>`;

}

function cardVisualState(group, card) {
  if (!card) return 'empty';
  if (group.includes('dead')) return 'dead';
  return 'known';
}



function renderSlots(group, count) {

  const target = document.querySelector(`[data-slots="${group}"]`);

  if (!target) return;

  const cards = groupCards(group);

  let renderCount = count;

  // Auto-collapse dead cards to save space

  if (group.includes('dead')) {

      const filledCount = cards.filter(Boolean).length;

      renderCount = Math.min(count, filledCount + 1);

  }

  

  target.innerHTML = Array.from({ length: renderCount }, (_, index) => {

    const card = cards[index];

    const state = cardVisualState(group, card);
    const suitClass = card ? ` card--suit-${card[1]}` : '';
    const ariaLabel = card
      ? t('Replace {card}{dead}', { card: displayCard(card), dead: state === 'dead' ? `, ${t('dead card')}` : '' })
      : t('Choose card {number}', { number: index + 1 });
    return `<button type="button" class="card-slot card--${state}${card ? ' filled' : ''}${suitClass} riverline-card" data-card-state="${state}" data-group="${group}" data-index="${index}" aria-label="${ariaLabel}">${cardMarkup(card)}</button>`;

  }).join('');

}



function equityPlayerLabel(playerIndex) {
  return playerIndex === 0 ? t('Hero') : t('Player {number}', { number: playerIndex + 1 });
}

function createEquityPlayer() {
  const playerNumber = app.equity.players.length + 1;
  return {
    id: `equity-player-${app.equity.nextPlayerId++}`,
    name: `Player ${playerNumber}`,
    cards: [],
    handMode: 'unknown'
  };
}

function setEquityPlayerCount(requestedCount) {
  const count = Math.max(2, Math.min(10, Number(requestedCount) || 2));
  while (app.equity.players.length < count) app.equity.players.push(createEquityPlayer());
  if (app.equity.players.length > count) app.equity.players.splice(count);
  renderAllCards();
  setEquityPending();
}

function setEquityHandMode(playerIndex, handMode) {
  const player = app.equity.players[playerIndex];
  if (!player || !['known', 'unknown'].includes(handMode)) return;
  player.handMode = handMode;
  if (handMode === 'unknown') player.cards = [];
  renderAllCards();
  setEquityPending();
}

function renderEquityPlayers() {
  const root = $('#equityPlayers');
  if (!root) return;

  root.innerHTML = app.equity.players.map((player, playerIndex) => {
    const mode = player.handMode || (player.cards.filter(Boolean).length ? 'known' : 'unknown');
    player.handMode = mode;
    const cardCount = player.cards.filter(Boolean).length;
    const handState = mode === 'unknown' ? 'unknown' : (cardCount === 2 ? 'known' : 'incomplete');
    const label = equityPlayerLabel(playerIndex);
    const status = mode === 'unknown'
      ? t('Random hand from the remaining deck')
      : (cardCount === 2
        ? t('Known two-card hand')
        : t('Known hand incomplete · {count} / 2 cards', { count: cardCount }));
    return `
      <article class="equity-player-card" data-player-id="${player.id}" data-player-series="${playerIndex}" data-hand-state="${handState}">
        <header class="equity-player-head">
          <span class="equity-player-identity"><i class="series-marker" aria-hidden="true"></i><strong>${label}</strong><small>${status}</small></span>
          ${playerIndex > 1 ? `<button type="button" class="remove-player ui-button ui-button-ghost" data-remove-player="${playerIndex}" aria-label="${t('Remove {player}', { player: label })}">${t('Remove')}</button>` : ''}
        </header>
        <div class="equity-player-body">
          <div class="equity-hand-mode" role="group" aria-label="${t('{player} hand type', { player: label })}">
            <button type="button" data-equity-hand-mode="known" data-player-index="${playerIndex}" aria-pressed="${mode === 'known'}">${t('Known')}</button>
            <button type="button" data-equity-hand-mode="unknown" data-player-index="${playerIndex}" aria-pressed="${mode === 'unknown'}">${t('Unknown')}</button>
          </div>
          ${mode === 'known'
            ? `<div class="card-slots equity-known-hand" data-slots="player-${playerIndex}"></div>`
            : `<div class="equity-unknown-hand" aria-label="${t('{player} unknown cards', { player: label })}"><span class="poker-card-back riverline-card-back" aria-hidden="true"></span><span class="poker-card-back riverline-card-back" aria-hidden="true"></span><span>${t('Random legal hand')}</span></div>`}
        </div>
        <div class="equity-hand-message" id="equityHandMessage-${playerIndex}">${status}</div>
        <section id="outsPanel-${playerIndex}" class="equity-player-outs" aria-label="Outs" aria-live="polite">
          <div class="outs-panel-head"><span class="outs-panel-title" data-i18n="Outs">Outs</span><span id="outsCount-${playerIndex}" class="outs-total"></span></div>
          <div id="outsSummary-${playerIndex}" class="outs-summary"></div>
          <div id="outsCards-${playerIndex}" class="outs-groups"></div>
        </section>
      </article>`;
  }).join('');

  app.equity.players.forEach((player, playerIndex) => {
    if (player.handMode === 'known') renderSlots(`player-${playerIndex}`, 2);
  });

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-player ui-button ui-button--secondary';
  add.disabled = app.equity.players.length >= 10;
  add.textContent = app.equity.players.length >= 10 ? t('10 player maximum') : t('+ Add player');
  add.addEventListener('click', () => {
    if (app.equity.players.length >= 10) return toast(t('Maximum of ten players.'), 'warning');
    app.equity.players.push(createEquityPlayer());
    renderAllCards();
    setEquityPending();
  });
  root.appendChild(add);

  const playerCount = $('#equityPlayerCount');
  if (playerCount) playerCount.textContent = t('{count} players', { count: app.equity.players.length });
  const decrease = $('#equityDecreasePlayers');
  const increase = $('#equityIncreasePlayers');
  if (decrease) decrease.disabled = app.equity.players.length <= 2;
  if (increase) increase.disabled = app.equity.players.length >= 10;
  document.querySelectorAll('[data-equity-player-count]').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.equityPlayerCount) === app.equity.players.length);
    button.setAttribute('aria-label', t('Set {count} players', { count: button.dataset.equityPlayerCount }));
  });
  if (typeof updateDomTranslations === 'function') updateDomTranslations();
}



function updateActionOptions() {

  const isPreflop = currentStreet() === 'preflop';

  const sel = $('#lastAction');

  if (!sel) return;

  Array.from(sel.options).forEach(opt => {

    if (opt.value === 'bet' || opt.value === 'check') {

      opt.style.display = isPreflop ? 'none' : '';

      opt.disabled = isPreflop;

    }

  });

  

  if (sel.selectedOptions.length && sel.selectedOptions[0].disabled) {

    sel.value = isPreflop ? 'unopened' : 'check';

  }

}



function activeWorkspaceMode() {
  return $('.riverline-shell')?.dataset.activeMode || 'gto';
}

function renderPlaybookCards() {
  if (typeof isHandMode === 'function' && isHandMode()) {
    const canonicalState = callPlaybookStateBridge('getState');
    const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
    const canonicalHero = canonicalState?.players?.find((player) => player.playerId === heroPlayerId);
    renderCanonicalDecisionCards('hero', canonicalHero?.holeCards || [], 2);
    renderCanonicalDecisionCards('board', canonicalState?.board || [], 5);
    renderCanonicalDecisionCards(
      'dead',
      canonicalState?.deadCards || [],
      Math.min(52, (canonicalState?.deadCards?.length || 0) + 1)
    );
  } else {
    renderSlots('hero', 2);

    renderSlots('board', 5);

    renderSlots('dead', 52);
  }

  renderPlaybookCardStateSummary(remainingCards(isHandMode() ? 'hand' : 'gto'));
  updateActionOptions();
}

function renderPlaybookCardStateSummary(availableCount) {
  const handMode = isHandMode();
  const canonicalState = handMode ? callPlaybookStateBridge('getState') : null;
  const deadCards = handMode ? (canonicalState?.deadCards || []) : app.gto.dead;
  const deckCount = $('#deckCount');
  const deadCardCount = $('#deadCardCount');

  // Hand mode reads the canonical PokerState through the existing deck authority.
  if (deckCount) deckCount.textContent = availableCount ?? remainingCards(handMode ? 'hand' : 'gto');
  if (deadCardCount) deadCardCount.textContent = String(deadCards.filter(Boolean).length);
}

function renderEquityCards() {
  renderSlots('eqboard', 5);

  renderSlots('eqdead', 52);

  if (app.equity.players.length > 0) renderEquityPlayers();

  const deckCount = $('#eqDeckCount');
  if (deckCount) deckCount.textContent = remainingCards('equity');

  const boardCount = $('#equityBoardCount');
  if (boardCount) boardCount.textContent = `${app.equity.board.filter(Boolean).length} / 5`;

  const deadCount = $('#equityDeadCount');
  if (deadCount) deadCount.textContent = String(app.equity.dead.filter(Boolean).length);

  renderEquityScenarioContext();

}

function renderAllCards({ mode = activeWorkspaceMode() } = {}) {
  if (mode === 'gto') renderPlaybookCards();
  else if (mode === 'equity') renderEquityCards();
  else if (mode === 'training' && typeof renderTrainingCards === 'function') renderTrainingCards();
}



function openPicker(group, index) {

  if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
    return toast('These cards come from the canonical hand in Hand mode.', 'warning');
  }

  if (group.startsWith('training')) {
    return toast('Training cards come from the canonical generated hand.', 'warning');
  }

  app.picker = { group, index };

  const current = groupCards(group)[index];

  const modalTitle = $('#modalTitle');

  if (modalTitle) {
    let targetLabel = '';
    if (group === 'eqboard') targetLabel = t('board card {number}', { number: index + 1 });
    else if (group === 'eqdead') targetLabel = t('dead card {number}', { number: index + 1 });
    else if (group.startsWith('player-')) targetLabel = t('{player} card {number}', {
      player: equityPlayerLabel(Number(group.split('-')[1])),
      number: index + 1
    });
    modalTitle.textContent = targetLabel
      ? t(current ? 'Replace {target}' : 'Choose {target}', { target: targetLabel })
      : (current ? t('Replace card') : t('Choose a card'));
  }

  const modalCopy = $('#modalCopy');

  if (modalCopy) modalCopy.textContent = group.includes('dead')

    ? t('Choose a card known to be out of play.')

    : t('Cards already used in this scenario are unavailable.');

  const burnControl = $('#burnControl');

  if (burnControl) burnControl.style.display = group === 'dead' || group === 'eqdead' ? 'flex' : 'none';

  const markBurn = $('#markBurn');

  if (markBurn) markBurn.checked = group === 'dead' || group === 'eqdead';

  renderDeck();

  const cardModal = $('#cardModal');

  window.RiverlineTutorials?.cancelForOverlay?.('card-picker');
  if (cardModal) cardModal.classList.add('show');

  const deck = $('#deck');
  const pickerFocusTarget = deck?.querySelector?.(
    current ? `[data-deck-card="${current}"]` : 'button:not([disabled])'
  ) || $('#closeModal');
  pickerFocusTarget?.focus?.({ preventScroll: true });

}



function renderDeck() {

  const { group, index } = app.picker;

  const current = groupCards(group)[index];

  const scope = group.startsWith('hand-') ? 'hand'
    : group.startsWith('training') ? 'training'
      : isEquityGroup(group) ? 'equity' : 'gto';

  const unavailable = new Set(usedCards(scope));

  if (current) unavailable.delete(current);

  const deck = $('#deck');

  if (deck) {
    deck.innerHTML = SUITS.map((suit) => {
      const cards = RANKS.map((rank) => {
        const card = rank + suit.id;
        const isUnavailable = unavailable.has(card);
        const isSelected = current === card;
        const visualRank = rank === 'T'
          && typeof document !== 'undefined'
          && document.documentElement?.dataset?.cardRankStyle === 'full-ten'
          ? '10'
          : rank;
        const rankClass = visualRank === '10' ? ' rank--ten' : '';
        const face = `<span class="rank${rankClass} s-${suit.id}">${visualRank}</span><span class="suit s-${suit.id}">${suit.symbol}</span>`;
        return `<button type="button" class="deck-card card--suit-${suit.id}${isSelected ? ' is-selected' : ''} riverline-card" aria-label="Choose ${visualRank}${suit.symbol}${isUnavailable ? ', unavailable' : ''}" aria-pressed="${isSelected}" data-suit="${suit.id}" data-rank="${rank}" data-deck-card="${card}" ${isUnavailable ? 'disabled' : ''}><span class="card-corner card-corner--top" aria-hidden="true">${face}</span><span class="card-corner card-corner--bottom" aria-hidden="true">${face}</span></button>`;
      }).join('');
      return `<div class="deck-suit-row" data-picker-suit="${suit.id}"><div class="deck-suit-label s-${suit.id}" aria-hidden="true">${suit.symbol}</div><div class="deck-ranks">${cards}</div></div>`;
    }).join('');
  }

}



function firstEmptyIndex(cards, limit) {

  for (let index = 0; index < limit; index += 1) if (!cards[index]) return index;

  return -1;

}



function selectCard(card) {

  const { group, index } = app.picker;
  let appearanceGroup = group;
  let appearanceIndex = index;

  if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
    closePicker();
    return toast('These cards come from the canonical hand in Hand mode.', 'warning');
  }


  if (group.startsWith('training')) {
    closePicker();
    return toast('Training cards come from the canonical generated hand.', 'warning');
  }

  const target = groupCards(group);

  const markBurn = $('#markBurn').checked;



  if (markBurn && !group.includes('dead')) {

    const destination = isEquityGroup(group) ? 'eqdead' : 'dead';

    const deadCards = groupCards(destination);

    const freeIndex = firstEmptyIndex(deadCards, 52);

    if (freeIndex < 0) return toast('No empty burned-card slot.', 'warning');

    target[index] = null;

    deadCards[freeIndex] = card;
    appearanceGroup = destination;
    appearanceIndex = freeIndex;

  } else {

    target[index] = card;

  }



  if (group === 'hero') app.selectedHand = null;

  if (window.SoundFX) SoundFX.playCardDeal();

  closePicker({ restoreFocus: false });

  renderAllCards();

  if (isEquityGroup(group)) setEquityPending();

  else if (group.startsWith('hand-')) renderCanonicalHandWorkspace();

  else updateContext('Cards changed');

  const appearedCard = document.querySelector(`[data-slots="${appearanceGroup}"] [data-index="${appearanceIndex}"]`);
  if (appearedCard) {
    appearedCard.classList.add('is-card-dealt');
    appearedCard.focus({ preventScroll: true });
  }

}



function closePicker(options) {

  const restoreFocus = options?.restoreFocus !== false;

  const picker = app.picker;

  const focusTarget = picker
    ? document.querySelector(`[data-slots="${picker.group}"] [data-index="${picker.index}"]`)
    : null;

  app.picker = null;

  const cardModal = $('#cardModal');

  const focusWasInsidePicker = Boolean(cardModal?.contains?.(document.activeElement));

  if (cardModal) cardModal.classList.remove('show');

  // The deck is rebuilt on every open already. Detach its 52 hidden controls
  // after close so an inactive picker does not retain a large subtree.
  $('#deck')?.replaceChildren?.();

  if (restoreFocus && focusWasInsidePicker) focusTarget?.focus?.({ preventScroll: true });

}



function clearGroup(group) {

  if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
    return toast('These cards come from the canonical hand in Hand mode.', 'warning');
  }

  if (group.startsWith('training')) {
    return toast('Training cards come from the canonical generated hand.', 'warning');
  }

  if (group === 'hero') app.selectedHand = null;

  groupCards(group).length = 0;

  renderAllCards();

  if (isEquityGroup(group)) setEquityPending();

  else if (group.startsWith('hand-')) renderCanonicalHandWorkspace();

  else if (group.startsWith('training')) {

    // Training group - no context update needed

  } else updateContext('Cards cleared');

}



// ---------------------------------------------------------------------------

// Decision context and fallback strategy contracts

// ---------------------------------------------------------------------------



function currentStreet(board) {
  let b = board;
  if (!b) {
    const trainingMode = document.getElementById('trainingMode');
    const isTraining = trainingMode && trainingMode.classList.contains('active') && trainingMode.style.display !== 'none';
    if (isTraining && app.training && app.training.board) {
      b = app.training.board;
    } else {
      b = (app.gto && app.gto.board) || [];
    }
  }
  const count = b.filter(Boolean).length;
  if (count === 0) return 'preflop';
  if (count === 3) return 'flop';
  if (count === 4) return 'turn';
  if (count === 5) return 'river';
  return 'invalid';
}



function handClass(cards) {

  if (!cards || !Array.isArray(cards)) return null;

  const validCards = cards.filter(c => c && typeof c === 'string' && c.length >= 2);

  if (validCards.length !== 2) return null;

  const [first, second] = validCards;

  const firstRank = RANKS.indexOf(first[0]);

  const secondRank = RANKS.indexOf(second[0]);

  if (firstRank === -1 || secondRank === -1) return null;

  if (firstRank === secondRank) return first[0] + second[0];

  const high = firstRank < secondRank ? first : second;

  const low = firstRank < secondRank ? second : first;

  return high[0] + low[0] + (first[1] === second[1] ? 's' : 'o');

}



function numericValue(id, fallback = 0) {

  const value = Number(selectedValue(id));

  return Number.isFinite(value) ? value : fallback;

}

function clearToast() {
  const element = $('#toast');
  window.clearTimeout(toast.timer);
  toast.sequence = (toast.sequence || 0) + 1;
  if (!element) return;
  element.classList.remove('show');
  element.textContent = '';
  delete element.dataset.scope;
}



function normalizeFacingSize(lastAction, facingSize = 0) {

  if (lastAction === 'unopened') return 0;

  const value = Number(facingSize);

  return Number.isFinite(value) ? Math.max(0, value) : 0;

}



const CLUBGG_FORCED_CONTRIBUTION_PER_PLAYER_BB = 0.1;
const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';

function strategyAccountingContext(rakeMode, seatedPlayerCount) {

  const mode = rakeMode;
  if (!['off', 'fixed'].includes(mode)) {
    throw new RangeError(`Unsupported legacy rakeMode: ${String(rakeMode)}`);
  }
  const players = Math.max(0, Math.trunc(Number(seatedPlayerCount) || 0));
  const isClubGg = mode === 'fixed';
  const forcedContributionPerPlayerBb = isClubGg ? CLUBGG_FORCED_CONTRIBUTION_PER_PLAYER_BB : 0;
  const totalForcedContributionBb = Math.round(players * forcedContributionPerPlayerBb * 10) / 10;

  return {
    rakeMode: isClubGg ? 'fixed' : 'off',
    forcedContributionPerPlayerBb,
    totalForcedContributionBb
  };

}



function normalizedDecisionNumber(value, fallback, min, max) {

  const numeric = Number(value);
  const finite = Number.isFinite(numeric) ? numeric : fallback;

  return Math.min(max, Math.max(min, finite));

}



function normalizedDecisionCards(cards) {

  return Array.isArray(cards) ? cards.filter(Boolean).slice() : [];

}



function readPlaybookScenarioInput() {
  const lastActionControl = $('#lastAction');
  const tableSize = numericValue('#players', 6);
  const board = normalizedDecisionCards(app.gto && app.gto.board);
  const rakeMode = selectedValue('#rakeMode');
  const accounting = strategyAccountingContext(rakeMode, tableSize);
  const rawInput = {
    schemaVersion: typeof PLAYBOOK_SCENARIO_SCHEMA_VERSION === 'string'
      ? PLAYBOOK_SCENARIO_SCHEMA_VERSION
      : 'playbook-scenario/v1',
    tableSize,
    heroPosition: selectedValue('#heroPos'),
    street: currentStreet(board),
    heroCards: normalizedDecisionCards(app.gto && app.gto.hero),
    board,
    deadCards: normalizedDecisionCards(app.gto && app.gto.dead),
    stackBb: numericValue('#stack', 100),
    stackMode: selectedValue('#stackMode'),
    potBb: numericValue('#potSize', 1.5),
    lastAction: selectedValue('#lastAction'),
    lastActionLabel: lastActionControl && lastActionControl.selectedOptions && lastActionControl.selectedOptions[0]
      ? lastActionControl.selectedOptions[0].text
      : 'Unopened',
    facingSizeBb: numericValue('#facingSize', 0),
    rakeMode,
    forcedContributionPerPlayerBb: accounting.forcedContributionPerPlayerBb,
    totalForcedContributionBb: accounting.totalForcedContributionBb,
    anteBb: numericValue('#ante', 0),
    straddleBb: numericValue('#straddle', 0)
  };

  const hasRulesCompatibilityBridge = Boolean(
    globalThis.RiverlinePlaybookState
    && typeof globalThis.RiverlinePlaybookState.createScenarioInputFromLegacyCompatibility === 'function'
  );
  const bridged = typeof callPlaybookStateBridge === 'function'
    ? callPlaybookStateBridge('createScenarioInputFromLegacyCompatibility', rawInput)
    : null;
  if (bridged) return bridged;
  if (hasRulesCompatibilityBridge) {
    // The adapter already rejected this live input. Preserve it only as an
    // explicit unsupported v1 read so no renderer path can reinterpret it as Home.
    rawInput.rakeMode = 'unsupported_rules_compatibility_input';
  }
  rawInput.heroCards = Object.freeze(rawInput.heroCards);
  rawInput.board = Object.freeze(rawInput.board);
  rawInput.deadCards = Object.freeze(rawInput.deadCards);
  return Object.freeze(rawInput);
}

// Compatibility name retained for the existing characterization harnesses.
function readPlaybookInputSnapshot() {
  return readPlaybookScenarioInput();

}



const PLAYBOOK_SCENARIO_CONTROL_IDS = Object.freeze([
  'players', 'playersNum', 'stack', 'stackNum', 'stackMode',
  'rakeMode',
  'ante', 'anteNum', 'straddle', 'heroPos', 'lastAction',
  'facingSize', 'facingSizeNum', 'potSize', 'potSizeNum'
]);

const PLAYBOOK_DECISION_CARD_GROUPS = Object.freeze(['hero', 'board', 'dead']);
let savedPlaybookScenarioPresentation = null;

function isHandMode() {
  return callPlaybookStateBridge('getMode') === PLAYBOOK_MODES.HAND;
}

function capturePlaybookScenarioPresentation() {
  const controls = {};
  PLAYBOOK_SCENARIO_CONTROL_IDS.forEach((id) => {
    const control = document.getElementById(id);
    if (control) controls[id] = control.value;
  });
  return {
    controls,
    hero: normalizedDecisionCards(app.gto && app.gto.hero),
    board: normalizedDecisionCards(app.gto && app.gto.board),
    dead: normalizedDecisionCards(app.gto && app.gto.dead)
  };
}

function restorePlaybookScenarioPresentation(snapshot) {
  if (!snapshot) return;
  Object.entries(snapshot.controls || {}).forEach(([id, value]) => {
    const control = document.getElementById(id);
    if (control) control.value = value;
  });
  updatePositions();
  if (snapshot.controls && snapshot.controls.heroPos && $('#heroPos')) {
    $('#heroPos').value = snapshot.controls.heroPos;
  }
  app.gto.hero = normalizedDecisionCards(snapshot.hero);
  app.gto.board = normalizedDecisionCards(snapshot.board);
  app.gto.dead = normalizedDecisionCards(snapshot.dead);
  renderAllCards();
}

function setPlaybookControlAuthority(mode) {
  const handMode = mode === PLAYBOOK_MODES.HAND;
  const modeView = $('#gtoMode');
  if (modeView) modeView.dataset.playbookMode = mode;
  if (handMode && modeView) modeView.classList.remove('is-context-collapsed');
  if (handMode && $('#togglePlaybookContext')) {
    $('#togglePlaybookContext').setAttribute('aria-expanded', 'true');
  }

  $$('#playbookModeControl [data-playbook-mode]').forEach((button) => {
    const active = button.dataset.playbookMode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  PLAYBOOK_SCENARIO_CONTROL_IDS.forEach((id) => {
    const control = document.getElementById(id);
    if (!control) return;
    control.disabled = handMode;
    control.toggleAttribute('data-scenario-only', handMode);
    if (handMode) {
      control.setAttribute('aria-describedby', 'playbookModeStatus');
      control.title = t('Scenario-only control; ignored while the canonical hand is authoritative.');
    } else {
      control.removeAttribute('aria-describedby');
      control.removeAttribute('title');
    }
  });

  $$('[data-clear="hero"], [data-clear="board"], [data-clear="dead"]').forEach((button) => {
    button.disabled = handMode;
    button.toggleAttribute('data-scenario-only', handMode);
  });

  $$('[data-playbook-scenario]').forEach((element) => {
    element.hidden = handMode;
    element.setAttribute('aria-hidden', String(handMode));
  });
  $$('[data-playbook-hand]').forEach((element) => {
    element.hidden = !handMode;
    element.setAttribute('aria-hidden', String(!handMode));
  });
  if (handMode) renderCanonicalHandWorkspace();
}

function playbookResolutionMessage(resolution) {
  if (!resolution) return t('Playbook state has not been resolved.');
  if (resolution.status === 'available') {
    if (resolution.reason === 'saved_scenario_spot') {
      return t('Saved Scenario facts are restored. Canonical hand history is unavailable.');
    }
    if (resolution.reason === 'saved_hand_derived_spot') {
      return t('Saved canonical decision facts are authoritative. Hand history is unavailable.');
    }
    return t(resolution.mode === PLAYBOOK_MODES.HAND
      ? 'Hand facts come from the canonical hand. Scenario controls are read-only.'
      : 'Scenario controls are authoritative. This spot does not claim a legal hand history.');
  }
  const reasons = {
    unsupported_canonical_rake_mode: t('Hand mode does not support percentage or capped rake.'),
    canonical_straddle_unsupported: t('Hand mode does not support a nonzero straddle.'),
    clubgg_requires_7_to_10_players: t('ClubGG hand mode requires 7 to 10 seated players.'),
    canonical_session_not_initialized: t('Hand mode is unavailable until a canonical hand is initialized.'),
    canonical_chance_state: t('The canonical hand is waiting for explicit chance cards.'),
    canonical_showdown_state: t('The canonical hand is at showdown; there is no hero decision.'),
    canonical_terminal_state: t('The canonical hand is complete; there is no hero decision.'),
    canonical_not_betting: t('The canonical hand does not currently have a betting decision.'),
    canonical_hero_unknown: t('The canonical hand has no configured hero.'),
    canonical_hero_not_actor: t('The canonical hand is waiting for another player to act.'),
    canonical_hero_cards_unknown: t('Deal the hero two cards before requesting strategy.'),
    saved_hand_read_only: t('Read-only saved hand. Replay controls do not change your live hand.'),
    scenario_projection_failed: t('The Scenario input could not be converted to a decision context.'),
    canonical_projection_failed: t('The canonical hand could not be converted to a decision context.')
  };
  return reasons[resolution.reason] || t('This Playbook state is unavailable.');
}

function renderPlaybookModeStatus(resolution) {
  const status = $('#playbookModeStatus');
  if (!status) return;
  status.textContent = playbookResolutionMessage(resolution);
  status.dataset.status = resolution?.status || 'unavailable';
}

function renderCanonicalDecisionCards(group, cards, count) {
  const target = document.querySelector(`[data-slots="${group}"]`);
  if (!target) return;
  const values = normalizedDecisionCards(cards);
  target.innerHTML = Array.from({ length: count }, (_, index) => {
    const card = values[index];
    const state = cardVisualState(group, card);
    const suitClass = card ? ` card--suit-${card[1]}` : '';
    const label = card
      ? t('{card}, canonical hand card', { card: displayCard(card) })
      : t('No canonical card {number}', { number: index + 1 });
    return `<button type="button" class="card-slot card--${state}${card ? ' filled' : ''}${suitClass} riverline-card" data-card-state="${state}" data-group="${group}" data-index="${index}" data-playbook-canonical-display disabled aria-label="${label}">${cardMarkup(card)}</button>`;
  }).join('');
}

function syncCanonicalDecisionDisplay(decisionContext) {
  if (!decisionContext) return;
  const values = {
    players: decisionContext.tableSize,
    playersNum: decisionContext.tableSize,
    stack: decisionContext.stackBb,
    stackNum: decisionContext.stackBb,
    stackMode: decisionContext.stackMode,
    heroPos: decisionContext.heroPosition,
    potSize: decisionContext.potBb,
    potSizeNum: decisionContext.potBb,
    lastAction: decisionContext.lastAction,
    facingSize: decisionContext.facingSizeBb,
    facingSizeNum: decisionContext.facingSizeBb,
    rakeMode: decisionContext.rakeMode
  };
  Object.entries(values).forEach(([id, value]) => {
    const control = document.getElementById(id);
    if (control && value !== undefined && value !== null) control.value = String(value);
  });
  updatePositions();
  if ($('#heroPos')) $('#heroPos').value = decisionContext.heroPosition;
  renderCanonicalDecisionCards('hero', decisionContext.heroCards, 2);
  renderCanonicalDecisionCards('board', decisionContext.board, 5);
  renderCanonicalDecisionCards('dead', decisionContext.deadCards, Math.min(52, decisionContext.deadCards.length + 1));
  renderPlaybookCardStateSummary(remainingCards('hand'));
}

function renderUnavailableStrategy(resolution) {
  const message = playbookResolutionMessage(resolution);
  const waiting = resolution?.mode === 'hand' && String(resolution?.reason || '').startsWith('canonical_');
  setRecommendationState(waiting ? 'waiting' : 'unavailable');
  if ($('#bestAction')) $('#bestAction').textContent = t('Unavailable');
  if ($('#bestSizing')) {
    $('#bestSizing').textContent = '';
    $('#bestSizing').hidden = true;
  }
  if ($('#bestReason')) $('#bestReason').textContent = message;
  if ($('#sourceBadge')) {
    $('#sourceBadge').textContent = t('Unavailable');
    $('#sourceBadge').className = 'badge status-badge status-badge--unavailable';
  }
  if ($('#strategyMeta')) $('#strategyMeta').hidden = true;
  if ($('#strategyWarnings')) {
    $('#strategyWarnings').textContent = message;
    $('#strategyWarnings').hidden = false;
  }
  const unavailableActions = Array.from({ length: 3 }, () => ({
    name: '—', value: 0, kind: 'unavailable'
  }));
  unavailableActions.forEach((action, index) => setFrequency(index + 1, action));
  if (typeof renderFrequencyStack === 'function') {
    renderFrequencyStack($('#actionFrequencyStack'), unavailableActions);
  }
  if ($('#actionWheel')) $('#actionWheel').style.background = 'var(--surface-interactive)';
  if ($('#wheelCenterText')) $('#wheelCenterText').textContent = '—';
  ['mPosition', 'mPot', 'mFacing', 'mStack', 'mEquity', 'mPotOdds', 'mSPR', 'mRake'].forEach((id) => {
    if ($('#' + id)) $('#' + id).textContent = '—';
  });
  if (resolution?.mode === 'hand') {
    renderUnavailableActionPath(message, waiting ? 'waiting' : 'unavailable');
  }
  app.strategyResult = strategyProvider.resolve(null);
  playbookSurfaceInvalidator.renderIfNeeded('analysis');
  renderPlaybookModeStatus(resolution);
}

async function requestPlaybookMode(mode) {
  const previousMode = callPlaybookStateBridge('getMode') || PLAYBOOK_MODES.SCENARIO;
  if (mode === previousMode) {
    if (mode === PLAYBOOK_MODES.HAND) syncHandSeatSelectors();
    return updateContext('Playbook mode unchanged');
  }

  const scenarioInput = readPlaybookScenarioInput();
  if (mode === PLAYBOOK_MODES.HAND) {
    savedPlaybookScenarioPresentation = capturePlaybookScenarioPresentation();
  }
  const modeResult = callPlaybookStateBridge('setMode', mode, scenarioInput);
  if (!modeResult || modeResult.mode !== mode) {
    renderPlaybookModeStatus(modeResult);
    if (mode === PLAYBOOK_MODES.HAND) savedPlaybookScenarioPresentation = null;
    return modeResult;
  }

  app.playbookMode = mode;
  setPlaybookControlAuthority(mode);
  if (mode === PLAYBOOK_MODES.HAND) syncHandSeatSelectors();
  if (mode === PLAYBOOK_MODES.SCENARIO) {
    restorePlaybookScenarioPresentation(savedPlaybookScenarioPresentation);
    savedPlaybookScenarioPresentation = null;
  }
  const result = await updateContext(mode === PLAYBOOK_MODES.HAND ? 'Hand workflow selected' : 'Scenario workflow selected');
  window.RiverlineTutorials?.offerForWorkspace?.('gto', $('#gtoMode'));
  return result;
}

function bindPlaybookModeControl() {
  $$('#playbookModeControl [data-playbook-mode]').forEach((button) => {
    button.addEventListener('click', () => requestPlaybookMode(button.dataset.playbookMode));
  });
  window.addEventListener('riverline:playbook-state-change', (event) => {
    if (event.detail?.operation !== 'mode' && isHandMode()) {
      renderCanonicalHandWorkspace();
      if (event.detail?.operation?.startsWith('replay_')
        || event.detail?.operation?.startsWith('saved_hand_')) return;
      updateContext('Canonical hand updated');
    }
  });
  setPlaybookControlAuthority(PLAYBOOK_MODES.SCENARIO);
}

let savedStudyCurrentObject = null;
let savedStudySourceState = 'unavailable';
let savedStudyRefreshSequence = 0;
let savedStudyDialogLastFocus = null;

function currentSavedStudyInput() {
  const mode = isHandMode() ? PLAYBOOK_MODES.HAND : PLAYBOOK_MODES.SCENARIO;
  return {
    mode,
    scenarioInput: mode === PLAYBOOK_MODES.SCENARIO ? readPlaybookScenarioInput() : null,
    decisionContext: mode === PLAYBOOK_MODES.SCENARIO
      && app.playbookResolution?.status === 'available'
      ? app.playbookResolution.decisionContext
      : null
  };
}

function savedStudySourceCanSave(input = currentSavedStudyInput()) {
  if (input.mode === PLAYBOOK_MODES.HAND) return Boolean(callPlaybookStateBridge('getState'));
  return input.decisionContext?.schemaVersion === 'decision-context/v1';
}

function placeSavedStudySourceActions(replayProjection = null) {
  const actions = $('#savedStudySourceActions');
  if (!actions) return;
  const projection = replayProjection
    || (isHandMode() ? callPlaybookStateBridge('createReplayProjectionViewModel') : null);
  actions.hidden = projection?.viewerContext?.kind === 'saved_hand';
  if (actions.hidden) return;
  let mount = $('#scenarioSavedStudyActionMount');
  if (isHandMode()) {
    mount = projection?.readOnly
      ? $('#replaySavedStudyActionMount')
      : $('#handSavedStudyActionMount');
  }
  if (mount && actions.parentElement !== mount) mount.appendChild(actions);
}

function savedStudySourceCopy(state, mode) {
  const hand = mode === PLAYBOOK_MODES.HAND;
  if (state === 'saved') return t(hand ? 'Saved hand.' : 'Saved study spot.');
  if (state === 'saving') return t('Saving…');
  if (state === 'checking') return t('Checking saved state…');
  if (state === 'failed') return t('Save failed');
  if (state === 'unavailable') return t(hand
    ? 'Start a canonical hand before saving.'
    : 'Complete a valid study spot before saving.');
  return t(hand ? 'This hand is not saved.' : 'This spot is not saved.');
}

function renderSavedStudySourceState(state, object = savedStudyCurrentObject) {
  savedStudySourceState = state;
  savedStudyCurrentObject = state === 'saved' ? object : null;
  const input = currentSavedStudyInput();
  placeSavedStudySourceActions();
  const hand = input.mode === PLAYBOOK_MODES.HAND;
  const saveButton = $('#savedStudySaveButton');
  const editButton = $('#savedStudyEditButton');
  const status = $('#savedStudySourceStatus');
  const saved = state === 'saved';
  const busy = state === 'saving' || state === 'checking';
  const canSave = savedStudySourceCanSave(input);
  if (saveButton) {
    const label = state === 'saving'
      ? t('Saving…')
      : saved ? t('Saved') : t(hand ? 'Save hand' : 'Save spot');
    saveButton.textContent = label;
    saveButton.dataset.i18n = state === 'saving'
      ? 'Saving…'
      : saved ? 'Saved' : hand ? 'Save hand' : 'Save spot';
    saveButton.dataset.saveState = state;
    saveButton.setAttribute('aria-pressed', String(saved));
    saveButton.setAttribute('aria-busy', String(busy));
    saveButton.disabled = saved || busy || !canSave;
  }
  if (editButton) editButton.hidden = !saved;
  if (status) status.textContent = savedStudySourceCopy(state, input.mode);
}

async function refreshSavedStudySource() {
  const input = currentSavedStudyInput();
  const sequence = ++savedStudyRefreshSequence;
  if (!savedStudySourceCanSave(input) && input.mode === PLAYBOOK_MODES.SCENARIO) {
    renderSavedStudySourceState('unavailable', null);
    return;
  }
  renderSavedStudySourceState('checking', null);
  try {
    const result = await callSavedStudyBridge('getCurrentStatus', input);
    if (sequence !== savedStudyRefreshSequence) return;
    renderSavedStudySourceState(result.state, result.object);
  } catch (error) {
    if (sequence !== savedStudyRefreshSequence) return;
    if (error?.code === 'persistent_identity_cancelled') {
      renderSavedStudySourceState('unsaved', null);
      return;
    }
    console.error('[Riverline Saved Study Objects]', error);
    renderSavedStudySourceState('failed', null);
  }
}

async function saveCurrentStudySource() {
  const input = currentSavedStudyInput();
  if (!savedStudySourceCanSave(input) || savedStudySourceState === 'saving') return;
  const sequence = ++savedStudyRefreshSequence;
  renderSavedStudySourceState('saving', null);
  try {
    const result = await callSavedStudyBridge('saveCurrent', input);
    if (sequence !== savedStudyRefreshSequence) return;
    renderSavedStudySourceState('saved', result.object);
    toast(t('Saved'), 'success');
  } catch (error) {
    if (sequence !== savedStudyRefreshSequence) return;
    if (error?.code === 'persistent_identity_cancelled') {
      renderSavedStudySourceState('unsaved', null);
      return;
    }
    console.error('[Riverline Saved Study Objects]', error);
    renderSavedStudySourceState('failed', null);
    toast(t('Save failed'), 'error');
  }
}

function savedStudyDialogFocusableElements() {
  const modal = $('#savedStudyModal');
  if (!modal) return [];
  return [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.closest('[hidden]'));
}

function hideSavedStudyArchiveConfirmation() {
  const confirmation = $('#savedStudyArchiveConfirmation');
  if (confirmation) confirmation.hidden = true;
}

function closeSavedStudyEditor() {
  const modal = $('#savedStudyModal');
  if (!modal || modal.hidden) return;
  modal.classList.remove('show');
  modal.hidden = true;
  hideSavedStudyArchiveConfirmation();
  const focusTarget = savedStudyDialogLastFocus;
  savedStudyDialogLastFocus = null;
  if (focusTarget?.isConnected && typeof focusTarget.focus === 'function') focusTarget.focus();
}

function openSavedStudyEditor() {
  const object = savedStudyCurrentObject;
  const modal = $('#savedStudyModal');
  if (!object || !modal) return;
  savedStudyDialogLastFocus = document.activeElement;
  $('#savedStudyTitle').value = object.annotations.title || '';
  $('#savedStudyNote').value = object.annotations.note || '';
  $('#savedStudyTags').value = object.annotations.tags.map((tag) => tag.display).join(', ');
  $('#savedStudyReviewLater').checked = object.annotations.reviewState === 'review_later';
  $('#savedStudyMistake').checked = object.annotations.classifications.includes('mistake');
  $('#savedStudyEditorStatus').textContent = '';
  hideSavedStudyArchiveConfirmation();
  window.RiverlineTutorials?.cancelForOverlay?.('saved-study-editor');
  modal.hidden = false;
  modal.classList.add('show');
  window.requestAnimationFrame(() => $('#savedStudyTitle')?.focus());
}

function setSavedStudyEditorBusy(busy) {
  ['savedStudyTitle', 'savedStudyNote', 'savedStudyTags', 'savedStudyReviewLater',
    'savedStudyMistake', 'savedStudyArchiveButton', 'savedStudyArchiveConfirmButton',
    'savedStudyArchiveKeepButton', 'savedStudyCancelButton', 'savedStudySubmitButton',
    'savedStudyCloseButton'].forEach((id) => {
    if ($('#' + id)) $('#' + id).disabled = busy;
  });
  if ($('#savedStudySubmitButton')) $('#savedStudySubmitButton').setAttribute('aria-busy', String(busy));
}

function savedStudyTagsFromEditor() {
  return $('#savedStudyTags').value.split(/[,\n]/u).map((tag) => tag.trim()).filter(Boolean);
}

async function saveSavedStudyAnnotations(event) {
  event.preventDefault();
  const object = savedStudyCurrentObject;
  if (!object) return;
  const originalReviewState = object.annotations.reviewState;
  const reviewState = $('#savedStudyReviewLater').checked
    ? 'review_later'
    : originalReviewState === 'resolved' ? 'resolved' : 'none';
  const classifications = window.RiverlineSavedStudyObjects.classificationsWithMistake(
    object,
    $('#savedStudyMistake').checked
  );
  setSavedStudyEditorBusy(true);
  $('#savedStudyEditorStatus').textContent = t('Saving…');
  try {
    const result = await callSavedStudyBridge('updateAnnotations', object.id, {
      title: $('#savedStudyTitle').value,
      note: $('#savedStudyNote').value,
      tags: savedStudyTagsFromEditor(),
      reviewState,
      classifications
    }, { expectedRevision: object.revision });
    savedStudyCurrentObject = result.object;
    renderSavedStudySourceState('saved', result.object);
    closeSavedStudyEditor();
    toast(t('Changes saved'), 'success');
  } catch (error) {
    console.error('[Riverline Saved Study Objects]', error);
    $('#savedStudyEditorStatus').textContent = t('Changes could not be saved.');
    toast(t('Changes could not be saved.'), 'error');
  } finally {
    setSavedStudyEditorBusy(false);
  }
}

async function archiveSavedStudyObjectFromEditor() {
  const object = savedStudyCurrentObject;
  if (!object) return;
  setSavedStudyEditorBusy(true);
  $('#savedStudyEditorStatus').textContent = t('Archiving…');
  try {
    await callSavedStudyBridge('archiveCurrent', {
      ...currentSavedStudyInput(),
      expectedRevision: object.revision
    });
    ++savedStudyRefreshSequence;
    savedStudyCurrentObject = null;
    renderSavedStudySourceState('unsaved', null);
    closeSavedStudyEditor();
    toast(t('Archived'), 'success');
  } catch (error) {
    console.error('[Riverline Saved Study Objects]', error);
    $('#savedStudyEditorStatus').textContent = t('Archive failed');
    toast(t('Archive failed'), 'error');
  } finally {
    setSavedStudyEditorBusy(false);
  }
}

function bindSavedStudyObjectsUx() {
  $('#savedStudySaveButton')?.addEventListener('click', saveCurrentStudySource);
  $('#savedStudyEditButton')?.addEventListener('click', openSavedStudyEditor);
  $('#savedStudyForm')?.addEventListener('submit', saveSavedStudyAnnotations);
  ['savedStudyCancelButton', 'savedStudyCloseButton'].forEach((id) => {
    $('#' + id)?.addEventListener('click', closeSavedStudyEditor);
  });
  $('#savedStudyArchiveButton')?.addEventListener('click', () => {
    const confirmation = $('#savedStudyArchiveConfirmation');
    if (!confirmation) return;
    confirmation.hidden = false;
    $('#savedStudyArchiveConfirmButton')?.focus();
  });
  $('#savedStudyArchiveKeepButton')?.addEventListener('click', () => {
    hideSavedStudyArchiveConfirmation();
    $('#savedStudyArchiveButton')?.focus();
  });
  $('#savedStudyArchiveConfirmButton')?.addEventListener('click', archiveSavedStudyObjectFromEditor);
  $('#savedStudyModal')?.addEventListener('click', (event) => {
    if (event.target === $('#savedStudyModal')) closeSavedStudyEditor();
  });
  $('#savedStudyModal')?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSavedStudyEditor();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = savedStudyDialogFocusableElements();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}



function formatCanonicalBb(milliBb, digits = 1) {
  const value = Number(milliBb) / 1000;
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits).replace(/\.0$/, '')} bb`;
}

function canonicalPlayerLabel(player, heroPlayerId) {
  if (!player) return '—';
  const hero = player.playerId === heroPlayerId ? `${t('Hero')} · ` : '';
  return `${hero}${player.position || t('Seat {number}', { number: player.seat + 1 })}`;
}

function syncHandSeatSelectors() {
  const tableControl = $('#handTableSize');
  if (!tableControl) return;
  const gameMode = selectedValue('#handGameMode') || 'home';
  const minimum = gameMode === 'clubgg' ? 7 : 2;
  const tableSize = Math.min(10, Math.max(minimum, Math.trunc(Number(tableControl.value) || minimum)));
  tableControl.min = String(minimum);
  tableControl.value = String(tableSize);

  ['handButtonSeat', 'handHeroSeat'].forEach((id) => {
    const select = $('#' + id);
    if (!select) return;
    const previous = Number(select.value);
    select.innerHTML = Array.from({ length: tableSize }, (_, seat) => (
      `<option value="${seat}">${t('Seat {number}', { number: seat + 1 })}</option>`
    )).join('');
    select.value = String(Number.isInteger(previous) && previous < tableSize ? previous : 0);
  });

  const anteType = selectedValue('#handAnteType') || 'none';
  const ante = $('#handAnteBb');
  if (ante) {
    ante.disabled = anteType === 'none';
    if (anteType === 'none') ante.value = '0';
  }
  const preview = $('#handAccountingPreview');
  if (preview) preview.textContent = gameMode === 'clubgg'
    ? t('ClubGG · 0.1 bb per seated player · {total} bb total deduction', { total: (tableSize * 0.1).toFixed(1) })
    : t('Home · no rake or forced deduction');
}

function readCanonicalHandConfiguration() {
  return {
    tableSize: Number(selectedValue('#handTableSize')),
    gameMode: selectedValue('#handGameMode') || 'home',
    stackBb: Number(selectedValue('#handStackBb')),
    stackMode: 'hero',
    heroSeat: Number(selectedValue('#handHeroSeat')),
    buttonSeat: Number(selectedValue('#handButtonSeat')),
    anteType: selectedValue('#handAnteType') || 'none',
    anteBb: Number(selectedValue('#handAnteBb')) || 0,
    straddleBb: 0
  };
}

function resetCanonicalHandDraft() {
  app.playbookHandDraft.bySeat = {};
  app.playbookHandDraft.board = [];
  app.playbookHandDraft.sizedAction = null;
}

function canonicalHandFailureMessage() {
  const diagnostics = callPlaybookStateBridge('getDiagnostics');
  return diagnostics?.error?.message || t('The canonical hand could not be updated.');
}

function startCanonicalPlaybookHand() {
  syncHandSeatSelectors();
  resetCanonicalHandDraft();
  const state = callPlaybookStateBridge('initializeHand', readCanonicalHandConfiguration());
  if (!state) toast(canonicalHandFailureMessage(), 'error');
  else clearToast();
  renderCanonicalHandWorkspace();
  return state;
}

function resetCanonicalPlaybookHand() {
  callPlaybookStateBridge('resetHand');
  resetCanonicalHandDraft();
  renderCanonicalHandWorkspace();
}

function commitCanonicalHoleDeal() {
  const state = callPlaybookStateBridge('getState');
  if (!state?.players?.length) return toast(t('Start a canonical hand first.'), 'warning');
  const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
  const cardsByPlayer = {};
  for (const player of state.players) {
    const cards = normalizedDecisionCards(app.playbookHandDraft.bySeat[player.seat]);
    if (cards.length === 1) return toast(t('Private cards must be empty or contain exactly two cards.'), 'warning');
    if (player.playerId === heroPlayerId && cards.length !== 2) {
      return toast(t('Choose both Hero cards before starting betting.'), 'warning');
    }
    if (cards.length === 2) cardsByPlayer[player.playerId] = cards;
  }
  const next = callPlaybookStateBridge('dealObservedHoleCards', cardsByPlayer);
  if (!next) toast(canonicalHandFailureMessage(), 'error');
  else {
    clearToast();
    if (window.SoundFX) window.SoundFX.playCardDeal(Math.max(2, Object.keys(cardsByPlayer).length * 2));
  }
  renderCanonicalHandWorkspace();
  return next;
}

function commitCanonicalPrivateReveals() {
  const state = callPlaybookStateBridge('getState');
  const required = state?.showdown?.requiredRevealPlayerIds || [];
  if (required.length === 0) return null;
  let next = state;
  for (const playerId of required) {
    const player = state.players.find((candidate) => candidate.playerId === playerId);
    const cards = normalizedDecisionCards(app.playbookHandDraft.bySeat[player?.seat]);
    if (cards.length !== 2) return toast(t('Choose both cards for every live hand that must be revealed.'), 'warning');
    next = callPlaybookStateBridge('revealHoleCards', playerId, cards);
    if (!next) {
      toast(canonicalHandFailureMessage(), 'error');
      break;
    }
  }
  if (next && next.showdown?.status !== 'awaiting_private_reveal') clearToast();
  renderCanonicalHandWorkspace();
  return next;
}

function commitCanonicalPrivateCards() {
  const state = callPlaybookStateBridge('getState');
  return state?.showdown?.status === 'awaiting_private_reveal'
    ? commitCanonicalPrivateReveals()
    : commitCanonicalHoleDeal();
}

function commitCanonicalBoardDeal() {
  const state = callPlaybookStateBridge('getState');
  const expected = Number(state?.pendingChance?.cardCount) || 0;
  const cards = normalizedDecisionCards(app.playbookHandDraft.board);
  if (!expected || cards.length !== expected) {
    return toast(t('Choose exactly {count} board cards.', { count: expected || t('the required') }), 'warning');
  }
  const next = callPlaybookStateBridge('dealBoardCards', cards);
  if (!next) toast(canonicalHandFailureMessage(), 'error');
  else {
    clearToast();
    app.playbookHandDraft.board = [];
    if (window.SoundFX) window.SoundFX.playCardDeal(expected);
  }
  renderCanonicalHandWorkspace();
  return next;
}

function canonicalActionLabel(type, option) {
  if (type === 'all_in') return `${t('All-in')} · ${formatCanonicalBb(option.amountToMilliBb)}`;
  if (type === 'call') return `${t('Call')} · ${formatCanonicalBb(option.commitMilliBb)}`;
  const labels = { fold: 'Fold', check: 'Check', bet: 'Bet', raise: 'Raise' };
  return t(labels[type] || type);
}

function chooseCanonicalSizedAction(type, option) {
  app.playbookHandDraft.sizedAction = type;
  const sizing = $('#handActionSizing');
  const input = $('#handActionAmountBb');
  const label = $('#handActionSizingLabel');
  const bounds = $('#handActionAmountBounds');
  if (!sizing || !input) return;
  const min = Number(option.minToMilliBb) / 1000;
  const max = Number(option.maxToMilliBb) / 1000;
  const step = Number(callPlaybookStateBridge('getState')?.game?.chipUnitMilliBb || 100) / 1000;
  sizing.hidden = false;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(min);
  if (label) label.textContent = t(type === 'bet' ? 'Bet to' : 'Raise to');
  if (bounds) bounds.textContent = t('{min}–{max} bb · amount-to', { min, max });
  if ($('#handCommitSizedAction')) $('#handCommitSizedAction').hidden = false;
  $$('#handLegalActions [data-canonical-action]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.canonicalAction === type));
  });
}

function applyCanonicalHandAction(type, amountToBb = null) {
  const next = callPlaybookStateBridge('applyAction', type, amountToBb);
  if (!next) toast(canonicalHandFailureMessage(), 'error');
  else {
    clearToast();
    if (window.SoundFX) window.SoundFX.playPokerAction(type);
  }
  app.playbookHandDraft.sizedAction = null;
  renderCanonicalHandWorkspace();
  return next;
}

function commitCanonicalSizedAction() {
  const type = app.playbookHandDraft.sizedAction;
  if (!type) return toast(t('Choose Bet or Raise first.'), 'warning');
  return applyCanonicalHandAction(type, Number(selectedValue('#handActionAmountBb')));
}

function renderCanonicalLegalActions(state) {
  const root = $('#handLegalActions');
  const section = $('#handActionSection');
  if (!root || !section) return;
  const spec = callPlaybookStateBridge('getLegalActions');
  section.hidden = !spec;
  root.innerHTML = '';
  if (!spec) return;

  const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
  if ($('#handActionActor')) $('#handActionActor').textContent = t('{player} to act', {
    player: canonicalPlayerLabel(actor, callPlaybookStateBridge('getHeroPlayerId'))
  });
  const options = [
    ['fold', spec.fold], ['check', spec.check], ['call', spec.call],
    ['bet', spec.bet], ['raise', spec.raise], ['all_in', spec.allIn]
  ].filter(([, option]) => option?.available);

  options.forEach(([type, option]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = type === 'bet' || type === 'raise'
      ? 'ui-button ui-button--primary'
      : 'ui-button ui-button--secondary';
    button.dataset.canonicalAction = type;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = canonicalActionLabel(type, option);
    button.setAttribute('aria-label', `${button.textContent}${type === 'bet' || type === 'raise' ? `, ${t('choose amount-to sizing')}` : ''}`);
    button.addEventListener('click', () => {
      if (type === 'bet' || type === 'raise') chooseCanonicalSizedAction(type, option);
      else applyCanonicalHandAction(type);
    });
    root.appendChild(button);
  });

  if (spec.bet.available || spec.raise.available) {
    const commit = document.createElement('button');
    commit.id = 'handCommitSizedAction';
    commit.type = 'button';
    commit.className = 'ui-button ui-button--primary';
    commit.textContent = t('Apply amount-to');
    commit.hidden = true;
    commit.addEventListener('click', commitCanonicalSizedAction);
    root.appendChild(commit);
  }
  const currentType = app.playbookHandDraft.sizedAction;
  const currentOption = currentType === 'bet' ? spec.bet : currentType === 'raise' ? spec.raise : null;
  if (currentOption?.available) chooseCanonicalSizedAction(currentType, currentOption);
  else if ($('#handActionSizing')) $('#handActionSizing').hidden = true;
}

function canonicalHandStatus(state) {
  if (!state) return { label: t('Not started'), tone: 'info', summary: t('Configure and start a canonical hand.') };
  if (state.terminal?.isTerminal || state.phase === 'terminal') return { label: t('Complete'), tone: 'available', summary: t('The canonical hand is complete.') };
  if (state.showdown?.status === 'awaiting_private_reveal') return { label: t('Reveal hands'), tone: 'warning', summary: t('Reveal the remaining live hands to settle this showdown exactly.') };
  if (state.phase === 'showdown') return { label: t('Showdown'), tone: 'warning', summary: t('Betting is complete. Resolve the canonical showdown.') };
  if (state.pendingChance?.type === 'deal_hole') return { label: t('Set Hero cards'), tone: 'loading', summary: t('Choose Hero cards. Opponents may remain hidden.') };
  if (state.phase === 'chance') return { label: t('Board chance'), tone: 'loading', summary: t('Waiting for {cards}.', { cards: t(state.pendingChance?.type?.replace('deal_', '') || 'board cards') }) };
  return { label: t('In progress'), tone: 'available', summary: t('Only canonical legal actions can advance this hand.') };
}

function renderCanonicalPrivateDeal(state) {
  const section = $('#handDealSection');
  const root = $('#handPrivateCards');
  const isHoleDeal = state?.pendingChance?.type === 'deal_hole';
  const isAwaitingReveal = state?.showdown?.status === 'awaiting_private_reveal';
  if (!section || !root) return;
  section.hidden = !isHoleDeal && !isAwaitingReveal;
  if (!isHoleDeal && !isAwaitingReveal) return;
  const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
  const privateRow = (player, note) => `
    <div class="hand-private-row">
      <div><strong>${canonicalPlayerLabel(player, heroPlayerId)}</strong><small>${t('Seat {number}', { number: player.seat + 1 })} · ${note}</small></div>
      <div class="card-slots" data-slots="hand-seat-${player.seat}"></div>
    </div>`;
  let renderedPlayers;
  if (isAwaitingReveal) {
    renderedPlayers = state.showdown.requiredRevealPlayerIds
      .map((playerId) => state.players.find((player) => player.playerId === playerId));
    if ($('#handDealTitle')) $('#handDealTitle').textContent = t('Reveal remaining hands');
    if ($('#handDealHelp')) $('#handDealHelp').textContent = t('Exact settlement needs the two cards held by each remaining live player.');
    if ($('#handDealHoleButton')) $('#handDealHoleButton').textContent = t('Reveal hands');
    root.innerHTML = renderedPlayers.map((player) => privateRow(player, t('Reveal for showdown'))).join('');
  } else {
    const hero = state.players.find((player) => player.playerId === heroPlayerId);
    const opponents = state.players.filter((player) => player.playerId !== heroPlayerId);
    renderedPlayers = state.players;
    if ($('#handDealTitle')) $('#handDealTitle').textContent = t('Set private cards');
    if ($('#handDealHelp')) $('#handDealHelp').textContent = t("Choose Hero's cards. Opponents remain hidden unless you set them explicitly.");
    if ($('#handDealHoleButton')) $('#handDealHoleButton').textContent = t('Start betting');
    root.innerHTML = `${privateRow(hero, t('Required'))}
      <div class="hand-hidden-summary" role="status"><span class="hand-card-backs" aria-hidden="true"><i></i><i></i></span><strong>${t('{count} opponents hidden by default', { count: opponents.length })}</strong></div>
      <details class="hand-known-opponents"><summary>${t('Set known opponent cards (optional)')}</summary>
        <div class="hand-known-opponent-list">${opponents.map((player) => privateRow(player, t('Optional · otherwise Hidden'))).join('')}</div>
      </details>`;
  }
  renderedPlayers.forEach((player) => renderSlots(`hand-seat-${player.seat}`, 2));
  const complete = isAwaitingReveal
    ? renderedPlayers.every((player) => normalizedDecisionCards(app.playbookHandDraft.bySeat[player.seat]).length === 2)
    : renderedPlayers.every((player) => {
      const length = normalizedDecisionCards(app.playbookHandDraft.bySeat[player.seat]).length;
      return player.playerId === heroPlayerId ? length === 2 : length !== 1;
    });
  if ($('#handDealHoleButton')) $('#handDealHoleButton').disabled = !complete;
}

function renderCanonicalChance(state) {
  const section = $('#handChanceSection');
  const isBoardChance = state?.phase === 'chance' && state?.pendingChance?.type !== 'deal_hole';
  if (!section) return;
  section.hidden = !isBoardChance;
  if (!isBoardChance) return;
  const chanceName = state.pendingChance.type.replace('deal_', '');
  const expected = Number(state.pendingChance.cardCount) || 0;
  if ($('#handChanceTitle')) $('#handChanceTitle').textContent = t('Deal {street}', { street: t(chanceName.charAt(0).toUpperCase() + chanceName.slice(1)) });
  if ($('#handChanceHelp')) $('#handChanceHelp').textContent = t('Choose the next {count} legal board cards.', { count: expected });
  renderSlots('hand-board-chance', expected);
  if ($('#handDealBoardButton')) $('#handDealBoardButton').disabled = normalizedDecisionCards(app.playbookHandDraft.board).length !== expected;
}

function replayActorLabel(actor) {
  if (!actor) return '—';
  if (actor.suppliedName) {
    return actor.isHero ? `${t('Hero')} · ${actor.suppliedName}` : actor.suppliedName;
  }
  return actor.isHero ? t('Hero') : t('Player {number}', { number: actor.seat + 1 });
}

function replayMarkerLabel(marker) {
  if (marker?.targetStreet) {
    return t(marker.labelKey, { street: t(`replay.street.${marker.targetStreet}`) });
  }
  return t(marker?.labelKey || 'replay.marker.unavailable');
}

function createReplayIdentity(actor, className) {
  const identity = document.createElement('span');
  identity.className = className;

  const name = document.createElement('strong');
  name.className = 'replay-actor-name';
  name.textContent = replayActorLabel(actor);
  identity.appendChild(name);

  if (actor?.position) {
    const position = document.createElement('span');
    position.className = 'replay-position poker-data-token';
    position.textContent = actor.position;
    identity.appendChild(position);
  }
  return identity;
}

function createReplayCurrentMarker(marker) {
  const current = document.createElement('div');
  current.className = `replay-current-marker replay-current-marker--${marker.kind.replaceAll('_', '-')}${marker.actor?.isHero ? ' is-hero' : ''}`;
  current.dataset.markerKind = marker.kind;
  current.setAttribute('aria-current', 'true');
  current.setAttribute('role', 'status');
  current.setAttribute('aria-live', 'polite');
  current.setAttribute('aria-atomic', 'true');

  const eyebrow = document.createElement('span');
  eyebrow.className = 'replay-current-eyebrow';
  eyebrow.textContent = replayMarkerLabel(marker);
  current.appendChild(eyebrow);

  if (marker.kind === 'current_decision' && marker.actor) {
    current.appendChild(createReplayIdentity(marker.actor, 'replay-current-identity'));
    const toAct = document.createElement('strong');
    toAct.className = 'replay-current-action';
    toAct.textContent = t('replay.marker.toAct');
    current.appendChild(toAct);
  }
  return current;
}

function createReplayActionEntry(entry) {
  const item = document.createElement('li');
  item.className = `replay-action-entry replay-action-entry--${entry.actionFamily} is-replay-${entry.presentationState}${entry.isHero ? ' is-hero' : ''}${entry.wasAllIn ? ' is-all-in' : ''}`;
  item.dataset.actionType = entry.actionType;
  item.dataset.amountKind = entry.amountKind;
  item.dataset.sequence = String(entry.sequence);
  item.dataset.replayProgress = entry.presentationState;
  item.value = entry.sequence + 1;
  if (entry.presentationState === 'current') item.setAttribute('aria-current', 'step');

  const body = document.createElement('div');
  body.className = 'replay-action-body';
  body.appendChild(createReplayIdentity(entry, 'replay-action-identity'));

  const semantics = document.createElement('div');
  semantics.className = 'replay-action-semantics';
  const action = document.createElement('strong');
  action.className = 'replay-action-label';
  action.textContent = t(entry.actionLabelKey);
  semantics.appendChild(action);

  if (entry.amountKind !== 'none' && Number.isSafeInteger(entry.amountMilliBb)) {
    const amount = document.createElement('span');
    amount.className = 'replay-action-amount poker-data-token';
    amount.textContent = formatCanonicalBb(entry.amountMilliBb);
    semantics.appendChild(amount);
  }
  if (entry.wasAllIn) {
    const allIn = document.createElement('span');
    allIn.className = 'replay-all-in-status';
    allIn.textContent = t('replay.status.allIn');
    semantics.appendChild(allIn);
  }

  body.appendChild(semantics);
  item.appendChild(body);
  return item;
}

function createReplayTransitionEntry(event) {
  const item = document.createElement('div');
  item.className = `replay-transition-entry replay-transition-entry--${event.transitionKind.replaceAll('_', '-')} is-replay-${event.presentationState}`;
  item.dataset.transitionKind = event.transitionKind;
  item.dataset.replayProgress = event.presentationState;
  item.dataset.frameIndex = String(event.frameIndex);
  if (event.presentationState === 'current') item.setAttribute('aria-current', 'step');

  const label = document.createElement('strong');
  label.className = 'replay-transition-event-label';
  label.textContent = t(event.labelKey);
  item.appendChild(label);

  if (event.cardVisibility === 'public_board' && event.cards.length > 0) {
    const cards = document.createElement('span');
    cards.className = 'replay-transition-cards poker-data-token';
    cards.dir = 'ltr';
    event.cards.forEach((card) => {
      const token = document.createElement('span');
      token.className = `replay-transition-card replay-transition-card--${card.tone}`;
      token.textContent = card.token;
      cards.appendChild(token);
    });
    item.appendChild(cards);
  }
  return item;
}

function appendReplayTimelineItems(section, heading, items) {
  let actionList = null;
  items.forEach((item) => {
    if (item.itemKind === 'transition') {
      actionList = null;
      section.appendChild(createReplayTransitionEntry(item));
      return;
    }
    if (!actionList) {
      actionList = document.createElement('ol');
      actionList.className = 'replay-action-list';
      actionList.start = item.sequence + 1;
      actionList.setAttribute('aria-labelledby', heading.id);
      section.appendChild(actionList);
    }
    actionList.appendChild(createReplayActionEntry(item));
  });
}

function keepReplaySelectionVisible(root) {
  const selected = root.querySelector('[aria-current="step"], .replay-current-marker[aria-current]');
  if (!selected) return;
  selected.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
}

function renderCanonicalReplayControls(projection) {
  if (!projection || projection.schemaVersion !== 'replay-projection/v1') return;
  const controls = $('#handReplayControls');
  const modeBadge = $('#handReplayModeBadge');
  const progress = $('#handReplayProgress');
  const transition = $('#handReplayTransition');
  const status = $('#handReplayStatus');
  const readOnlyNote = $('#handReplayReadOnlyNote');
  const playbackButton = $('#handReplayPlaybackButton');
  const previous = $('#handReplayPreviousButton');
  const next = $('#handReplayNextButton');
  const live = $('#handReplayLiveButton');
  const transitionLabel = t(projection.selectedFrame?.labelKey || 'replay.marker.empty');
  const playback = callPlaybookStateBridge('createReplayPlaybackViewModel');
  const isPlaying = playback?.playing === true;
  const modeLabel = t(projection.modeLabelKey);
  const progressLabel = t('replay.progress', {
    current: projection.currentStep,
    total: projection.totalSteps
  });

  if (controls) {
    controls.dataset.replayMode = projection.mode;
    controls.dataset.playbackState = isPlaying ? 'playing' : 'paused';
  }
  if (modeBadge) {
    modeBadge.textContent = modeLabel;
    modeBadge.className = `badge replay-mode-badge replay-mode-badge--${projection.mode}`;
  }
  if (progress) progress.textContent = progressLabel;
  if (transition) transition.textContent = transitionLabel;
  if (status) {
    status.setAttribute('aria-live', isPlaying ? 'off' : 'polite');
    status.textContent = t('replay.status.announcement', {
      mode: modeLabel,
      current: projection.currentStep,
      total: projection.totalSteps,
      transition: transitionLabel
    });
  }
  if (readOnlyNote) readOnlyNote.hidden = !projection.readOnly;
  if (readOnlyNote && projection.viewerContext?.kind === 'saved_hand') {
    readOnlyNote.textContent = t('Read-only saved hand. Replay controls do not change your live hand.');
  } else if (readOnlyNote) {
    readOnlyNote.textContent = t('replay.readOnlyHelp');
  }

  const focusedControl = document.activeElement;
  if (playbackButton) {
    const labelKey = isPlaying ? 'replay.control.pause' : 'replay.control.play';
    const label = t(labelKey);
    playbackButton.textContent = label;
    playbackButton.dataset.i18n = labelKey;
    playbackButton.setAttribute('aria-label', label);
    playbackButton.setAttribute('aria-pressed', String(isPlaying));
    playbackButton.disabled = !isPlaying
      && !(projection.canPlayback && (projection.atEndpoint || projection.canPlaybackAdvance));
  }
  if (previous) previous.disabled = !projection.canPrevious;
  if (next) next.disabled = !projection.canNext;
  if (live) {
    const endpointKey = projection.endpointLabelKey || 'replay.control.returnToLive';
    live.textContent = t(endpointKey);
    live.dataset.i18n = endpointKey;
    live.setAttribute('aria-label', t(endpointKey));
    live.disabled = !projection.canReturnToEndpoint;
  }
  if (focusedControl?.disabled) {
    [playbackButton, previous, next, live]
      .find((button) => button && !button.disabled)?.focus();
  }
}

function renderCanonicalReplayTimeline() {
  const root = $('#handActionHistory');
  if (!root) return;
  if (!isHandMode()) {
    root.replaceChildren();
    root.removeAttribute('data-replay-state');
    root.removeAttribute('data-replay-mode');
    return;
  }

  const projection = callPlaybookStateBridge('createReplayProjectionViewModel');
  const model = projection?.timeline;
  if (!model || projection?.schemaVersion !== 'replay-projection/v1') return;
  root.replaceChildren();
  root.dataset.replayState = model.status;
  root.dataset.replayMode = projection.mode;
  const motionToken = projection.motion?.active ? String(projection.motion.token) : null;
  const shouldAnimateReplayTimeline = motionToken !== null
    && root.dataset.replayLastMotionToken !== motionToken;
  if (shouldAnimateReplayTimeline) {
    root.dataset.replayMotionCycle = projection.motion.token % 2 === 0 ? 'a' : 'b';
    root.dataset.replayTransition = projection.motion.transitionKind;
    root.dataset.replayMotionToken = motionToken;
    root.dataset.replayLastMotionToken = motionToken;
  } else {
    delete root.dataset.replayMotionCycle;
    delete root.dataset.replayTransition;
    delete root.dataset.replayMotionToken;
    if (motionToken === null) delete root.dataset.replayLastMotionToken;
  }
  let markerAttached = false;

  for (const group of model.groups) {
    const section = document.createElement('section');
    section.className = `replay-street-group${group.isSelectedStreet ? ' is-current-street' : ''}`;
    section.dataset.replayStreet = group.street;

    const heading = document.createElement('h3');
    heading.className = 'replay-street-heading';
    heading.id = `replay-street-${group.street}`;
    heading.textContent = t(group.headingKey);
    section.appendChild(heading);

    if (group.items.length > 0) {
      appendReplayTimelineItems(section, heading, group.items);
    } else if (model.emptyState === 'no_voluntary_actions') {
      const empty = document.createElement('p');
      empty.className = 'replay-empty-state';
      empty.textContent = t('replay.empty.noVoluntaryActions');
      section.appendChild(empty);
    }

    if (model.showCurrentMarker && model.currentMarkerGroup === group.street) {
      section.appendChild(createReplayCurrentMarker(model.currentMarker));
      markerAttached = true;
    }
    root.appendChild(section);
  }

  if (model.showCurrentMarker && !markerAttached) {
    root.appendChild(createReplayCurrentMarker(model.currentMarker));
  }
  if (shouldAnimateReplayTimeline) {
    const current = root.querySelector('[aria-current="step"]');
    if (current) {
      current.classList.add('is-replay-motion-current');
      const animations = typeof current.getAnimations === 'function' ? current.getAnimations() : [];
      const settleTimelineMotion = () => {
        if (current.isConnected && root.dataset.replayMotionToken === motionToken) {
          current.classList.remove('is-replay-motion-current');
          delete root.dataset.replayMotionCycle;
          delete root.dataset.replayTransition;
          delete root.dataset.replayMotionToken;
        }
      };
      if (animations.length === 0) settleTimelineMotion();
      else Promise.allSettled(animations.map((animation) => animation.finished))
        .then(settleTimelineMotion);
    }
  }
  keepReplaySelectionVisible(root);
}

function setCanonicalReplayReadOnly(projection) {
  const workspace = $('#playbookHandWorkspace');
  if (!workspace) return;
  const readOnly = projection?.readOnly === true;
  workspace.classList.toggle('is-replay-readonly', readOnly);
  workspace.dataset.replayMode = projection?.mode || 'empty';
  ['handDealSection', 'handChanceSection', 'handActionSection'].forEach((id) => {
    const section = $('#' + id);
    if (!section) return;
    if (readOnly) section.setAttribute('aria-disabled', 'true');
    else section.removeAttribute('aria-disabled');
    if (readOnly) {
      section.querySelectorAll('button, input, select').forEach((control) => {
        control.disabled = true;
      });
    }
  });
  const savedViewer = projection?.viewerContext?.kind === 'saved_hand';
  const setup = $('#handSetupSection');
  if (setup) {
    if (savedViewer) setup.setAttribute('aria-disabled', 'true');
    else setup.removeAttribute('aria-disabled');
    setup.querySelectorAll('button, input, select').forEach((control) => {
      control.disabled = savedViewer;
    });
  }
  if (readOnly && $('#handResolveShowdownButton')) $('#handResolveShowdownButton').disabled = true;
}

function renderSavedHandViewerContext(projection) {
  const context = projection?.viewerContext?.kind === 'saved_hand'
    ? projection.viewerContext
    : null;
  const banner = $('#savedHandViewerBanner');
  if (!banner) return;
  banner.hidden = !context;
  if (!context) return;
  const title = $('#savedHandViewerTitle');
  if (title) title.textContent = context.title || t('Saved hand replay');
  const returnLive = $('#savedHandReturnLiveButton');
  if (returnLive) returnLive.hidden = !context.hasLiveHand;
}

function dispatchCanonicalTableState() {
  const projection = callPlaybookStateBridge('createReplayProjectionViewModel');
  const tableModel = projection?.tablePresence
    || callPlaybookStateBridge('createTablePresenceViewModel');
  if (!tableModel) return;
  const wrapper = $('#table-wrapper');
  if (wrapper) {
    wrapper.classList.toggle('is-replay-projection', projection?.readOnly === true);
    wrapper.dataset.replayMode = projection?.mode || 'live';
    if (projection?.readOnly) wrapper.setAttribute('aria-describedby', 'handReplayStatus');
    else wrapper.removeAttribute('aria-describedby');
  }
  window.dispatchEvent(new CustomEvent('riverline:replay-motion', {
    detail: projection?.motion?.active ? projection.motion : null
  }));
  window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: tableModel }));
}

function renderCanonicalHandWorkspace() {
  const workspace = $('#playbookHandWorkspace');
  if (!workspace) return;
  const state = callPlaybookStateBridge('getState');
  const replayProjection = callPlaybookStateBridge('createReplayProjectionViewModel');
  placeSavedStudySourceActions(replayProjection);
  renderSavedHandViewerContext(replayProjection);
  workspace.classList.toggle('is-hand-in-progress', Boolean(state));
  const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
  const status = canonicalHandStatus(state);
  const badge = $('#handSessionBadge');
  if (badge) {
    badge.textContent = status.label;
    badge.className = `badge status-badge status-badge--${status.tone}`;
  }
  if ($('#handStateSummary')) $('#handStateSummary').textContent = status.summary;
  if ($('#handStateStreet')) $('#handStateStreet').textContent = state?.street || '—';
  const actor = state?.players?.find((player) => player.playerId === state.actingPlayerId);
  if ($('#handStateActor')) $('#handStateActor').textContent = actor ? canonicalPlayerLabel(actor, heroPlayerId) : '—';
  if ($('#handStatePot')) $('#handStatePot').textContent = state ? formatCanonicalBb(state.potMilliBb) : '—';
  if ($('#handStateDeduction')) $('#handStateDeduction').textContent = state ? formatCanonicalBb(state.deductionTotalMilliBb) : '—';
  if ($('#handStartButton')) $('#handStartButton').textContent = t(state ? 'Start new hand' : 'Start hand');

  const seats = $('#handSeatList');
  if (seats) seats.innerHTML = state?.players?.map((player) => `
    <div class="hand-seat-row${player.playerId === state.actingPlayerId ? ' is-actor' : ''}${player.folded ? ' is-folded' : ''}">
      <div><strong>${canonicalPlayerLabel(player, heroPlayerId)}</strong><small>${t('Seat {number}', { number: player.seat + 1 })}${player.currentStackMilliBb === 0 && !player.folded ? ` · ${t('All-in')}` : ''}${player.folded ? ` · ${t('Folded')}` : ''}</small></div>
      <div class="hand-seat-values poker-data-token">${formatCanonicalBb(player.currentStackMilliBb)}<br>${t('street')} ${formatCanonicalBb(player.streetContributionMilliBb)} · ${t('hand')} ${formatCanonicalBb(player.totalPotContributionMilliBb)}</div>
    </div>`).join('') || `<p class="panel-note">${t('No players yet.')}</p>`;

  renderCanonicalPrivateDeal(state);
  renderCanonicalChance(state);
  renderCanonicalLegalActions(state || { players: [] });
  ['handDealSection', 'handChanceSection', 'handActionSection'].forEach((id) => {
    const section = $('#' + id);
    if (section) section.classList.toggle('is-current-hand-step', !section.hidden);
  });
  renderCanonicalReplayControls(replayProjection);
  renderCanonicalReplayTimeline();
  if ($('#handResolveShowdownButton')) {
    const canResolveShowdown = state?.phase === 'showdown' && state?.showdown?.status === 'ready';
    $('#handResolveShowdownButton').hidden = !canResolveShowdown;
    $('#handResolveShowdownButton').disabled = !canResolveShowdown;
  }
  setCanonicalReplayReadOnly(replayProjection);
  dispatchCanonicalTableState();
}

function bindCanonicalHandWorkspace() {
  syncHandSeatSelectors();
  ['handTableSize', 'handGameMode', 'handAnteType'].forEach((id) => {
    if ($('#' + id)) $('#' + id).addEventListener('change', syncHandSeatSelectors);
  });
  if ($('#handStartButton')) $('#handStartButton').addEventListener('click', startCanonicalPlaybookHand);
  if ($('#handResetButton')) $('#handResetButton').addEventListener('click', resetCanonicalPlaybookHand);
  if ($('#handDealHoleButton')) $('#handDealHoleButton').addEventListener('click', commitCanonicalPrivateCards);
  if ($('#handDealBoardButton')) $('#handDealBoardButton').addEventListener('click', commitCanonicalBoardDeal);
  if ($('#handReplayPlaybackButton')) $('#handReplayPlaybackButton').addEventListener('click', () => {
    const playback = callPlaybookStateBridge('createReplayPlaybackViewModel');
    callPlaybookStateBridge(playback?.playing ? 'pauseReplayPlayback' : 'startReplayPlayback');
  });
  if ($('#handReplayPreviousButton')) $('#handReplayPreviousButton').addEventListener('click', () => {
    callPlaybookStateBridge('previousReplayFrame');
  });
  if ($('#handReplayNextButton')) $('#handReplayNextButton').addEventListener('click', () => {
    callPlaybookStateBridge('nextReplayFrame');
  });
  if ($('#handReplayLiveButton')) $('#handReplayLiveButton').addEventListener('click', () => {
    callPlaybookStateBridge('returnReplayToEndpoint');
  });
  $('#savedHandBackHomeButton')?.addEventListener('click', () => navigateToWorkspace('home'));
  $('#savedHandReturnLiveButton')?.addEventListener('click', () => {
    callPlaybookStateBridge('closeSavedHand');
    renderCanonicalHandWorkspace();
    updateContext('Returned to live hand');
  });
  $('#savedSpotCloseButton')?.addEventListener('click', () => {
    activeSavedSpotContext = null;
    renderSavedSpotViewer(null);
    updateContext('Saved context closed');
  });
  const replayTimeline = $('#handActionHistory');
  const pauseForTimelineInteraction = () => {
    if (callPlaybookStateBridge('createReplayPlaybackViewModel')?.playing) {
      callPlaybookStateBridge('pauseReplayPlayback');
    }
  };
  replayTimeline?.addEventListener('pointerdown', pauseForTimelineInteraction);
  replayTimeline?.addEventListener('wheel', pauseForTimelineInteraction, { passive: true });
  if ($('#handResolveShowdownButton')) $('#handResolveShowdownButton').addEventListener('click', () => {
    const next = callPlaybookStateBridge('resolveShowdown');
    if (!next) toast(canonicalHandFailureMessage(), 'error');
    renderCanonicalHandWorkspace();
  });
}



function deriveDecisionContext(snapshot = {}) {

  const tableSize = Math.trunc(normalizedDecisionNumber(snapshot.tableSize, 6, 2, 10));
  const heroPosition = typeof snapshot.heroPosition === 'string' && snapshot.heroPosition
    ? snapshot.heroPosition
    : 'BTN';
  const heroCards = normalizedDecisionCards(snapshot.heroCards);
  const board = normalizedDecisionCards(snapshot.board);
  const deadCards = normalizedDecisionCards(snapshot.deadCards);
  const stackBb = normalizedDecisionNumber(snapshot.stackBb, 100, 10, 500);
  const stackMode = typeof snapshot.stackMode === 'string' && snapshot.stackMode
    ? snapshot.stackMode
    : 'hero';
  const potBb = normalizedDecisionNumber(snapshot.potBb, 1.5, 0.5, 200);
  const lastAction = typeof snapshot.lastAction === 'string' && snapshot.lastAction
    ? snapshot.lastAction
    : 'unopened';
  const rawFacingSizeBb = normalizedDecisionNumber(snapshot.facingSizeBb, 0, 0, 100);
  const facingSizeBb = normalizeFacingSize(lastAction, rawFacingSizeBb);
  // Scenario mode deliberately does not reconstruct a legal betting history.
  // Only an explicit check, or the BB's unopened check option, proves a free price.
  const callAmountBb = (lastAction === 'check'
    || (lastAction === 'unopened' && heroPosition === 'BB')) ? 0 : null;
  const supportedRakeModes = ['off', 'fixed'];
  if (!supportedRakeModes.includes(snapshot.rakeMode)) {
    throw new RangeError(`Unsupported legacy Scenario rakeMode: ${String(snapshot.rakeMode)}`);
  }
  const rakeMode = snapshot.rakeMode;
  const accounting = strategyAccountingContext(rakeMode, tableSize);

  return {
    schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
    tableSize,
    // Scenario mode knows seated players only; it must not claim an exact live count.
    opponentCount: null,
    heroPosition,
    street: currentStreet(board),
    heroCards,
    board,
    deadCards,
    stackBb,
    stackMode,
    potBb,
    lastAction,
    facingSizeBb,
    callAmountBb,
    heroStreetContributionBb: null,
    rakeMode: accounting.rakeMode,
    forcedContributionPerPlayerBb: accounting.forcedContributionPerPlayerBb,
    totalForcedContributionBb: accounting.totalForcedContributionBb
  };

}



function requireDecisionContext(context) {

  if (context !== null && context !== undefined) {
    if (context.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION) return context;
    throw new TypeError('Expected DecisionContext decision-context/v1');
  }

  if (app.decisionContext && app.decisionContext.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION) {
    return app.decisionContext;
  }

  return deriveDecisionContext(readPlaybookInputSnapshot());

}



function updatePositionSelect(playersSelector, positionSelector) {

  const players = numericValue(playersSelector, 6);

  const positions = POSITIONS[players] || POSITIONS[6];

  const hero = $(positionSelector);

  if (!hero) return;

  const oldHero = hero.value;

  hero.innerHTML = positions.map((position) => `<option value="${position}">${position}</option>`).join('');

  hero.value = positions.includes(oldHero) ? oldHero : (positions.includes('BTN') ? 'BTN' : positions[0]);

}



function updatePositions() {

  updatePositionSelect('#playersNum', '#heroPos');

}



function updateTrainingPositions() {

  updatePositionSelect('#trainingPlayersNum', '#trainingHeroPos');

}



function strategyResultPresentationActions(result) {
  if (!result || !Array.isArray(result.actions)) throw new TypeError('Expected StrategyResult v1');
  const allocations = result.actions.map((entry, index) => {
    const exact = entry.probability * 100;
    return {
      entry,
      index,
      value: Math.floor(exact),
      remainder: exact - Math.floor(exact)
    };
  });
  let pointsLeft = 100 - allocations.reduce((sum, entry) => sum + entry.value, 0);
  [...allocations]
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((entry) => {
      if (pointsLeft <= 0) return;
      allocations[entry.index].value += 1;
      pointsLeft -= 1;
    });
  return allocations.map(({ entry, value }) => ({
    action: entry.action,
    name: entry.label,
    value,
    kind: entry.action.type === 'fold' ? 'fold'
      : entry.action.type === 'check' || entry.action.type === 'call' ? 'passive'
        : entry.action.type === 'all_in' ? 'all-in' : 'aggressive'
  }));
}

function strategyResultToLegacyProfile(result) {
  const actions = strategyResultPresentationActions(result);

  return {
    actions,
    best: result.recommendation ? String(result.recommendation.label) : 'STRATEGY UNAVAILABLE',
    reason: localizedStrategyExplanation(result),
    source: result.source,
    provenance: result.source,
    context: result.details
  };

}

function localizedStrategyExplanation(result) {
  if (!result) return '';
  if (result.source === 'heuristic_preflop') {
    return t('strategy.heuristic.preflopExplanation', {
      action: t(result.recommendation?.label || 'Unavailable')
    });
  }
  if (result.source === 'heuristic_postflop') {
    const sample = result.details?.heuristicSample || null;
    const sampledPercent = Number.isFinite(sample?.eq) ? (sample.eq * 100).toFixed(1) : '—';
    const candidatePercent = Number.isFinite(sample?.rangeFraction)
      ? (sample.rangeFraction * 100).toFixed(1)
      : '—';
    return t('strategy.heuristic.postflopExplanation', { sampledPercent, candidatePercent });
  }
  return t(result.explanation || '');
}

function localizedStrategyWarnings(result) {
  return (result?.warnings || []).map((warning) => (
    warning === result.explanation ? localizedStrategyExplanation(result) : t(warning)
  ));
}



// evaluateHand removed
function readHeuristicOptions() {

  const playStyle = Number(app.settings && app.settings.tightness);
  const opponentStyle = Number(app.settings && app.settings.oppTightness);

  return {
    playStyle: Number.isFinite(playStyle) ? Math.min(100, Math.max(0, playStyle)) / 100 : 0,
    opponentStyle: Number.isFinite(opponentStyle) ? Math.min(100, Math.max(0, opponentStyle)) / 100 : 0
  };

}



const strategyProvider = requireStrategyProviderBridge().createProvider({
  heuristicOptionsResolver: readHeuristicOptions
});

const productPerformance = requireProductPerformanceBridge();
const PLAYBOOK_DERIVED_SURFACES = Object.freeze(['matrix', 'range', 'tree', 'analysis', 'table']);
const playbookUpdateScheduler = productPerformance.createLatestFrameScheduler({
  requestFrame: window.requestAnimationFrame.bind(window),
  cancelFrame: window.cancelAnimationFrame.bind(window),
  run: (reason) => updateContext(reason)
});
const playbookSurfaceInvalidator = productPerformance.createSurfaceInvalidator({
  surfaceNames: PLAYBOOK_DERIVED_SURFACES,
  isVisible: playbookSurfaceIsVisible,
  render: renderPlaybookDerivedSurface
});

function playbookModeIsVisible() {
  const mode = $('#gtoMode');
  return Boolean(activeWorkspaceMode() === 'gto' && mode && mode.style.display !== 'none' && !mode.hidden);
}

function playbookSurfaceIsVisible(surface) {
  if (!playbookModeIsVisible()) return false;
  if (surface === 'matrix') return $('#chartView')?.style.display !== 'none';
  if (surface === 'range') return $('#rangeView')?.style.display !== 'none';
  if (surface === 'tree') return Boolean($('#treeView') && $('#treeView').style.display !== 'none');
  if (surface === 'analysis') return $('#teacherContent')?.style.display === 'block';
  if (surface === 'table') return !$('#table-wrapper')?.classList.contains('collapsed');
  return false;
}

function renderPlaybookDerivedSurface(surface) {
  if (surface === 'matrix') {
    renderChart();
    app.chartUpdatePending = false;
  } else if (surface === 'range') {
    renderRangeAdvantage();
  } else if (surface === 'tree') {
    renderBettingTree();
  } else if (surface === 'analysis') {
    renderPlaybookDecisionAnalysis(
      app.decisionContext,
      app.strategyResult,
      app.playbookResolution,
      app.playbookResolution?.status === 'available'
        ? null
        : analysisUnavailableReasonForResolution(app.playbookResolution)
    );
  } else if (surface === 'table') {
    renderPlaybookTableProjection();
  }
}

function invalidatePlaybookDerivedSurfaces() {
  playbookSurfaceInvalidator.mark();
  app.chartUpdatePending = true;
}

function renderVisiblePlaybookDerivedSurfaces() {
  PLAYBOOK_DERIVED_SURFACES.forEach((surface) => playbookSurfaceInvalidator.renderIfNeeded(surface));
}

function schedulePlaybookUpdate(reason) {
  playbookUpdateScheduler.schedule(reason);
}

function commitPlaybookUpdate(reason) {
  playbookUpdateScheduler.schedule(reason);
  playbookUpdateScheduler.flush();
}

function setFrequency(index, action) {

  const nameEl = $('#f' + index + 'name');

  const barEl = $('#f' + index);

  const numEl = $('#f' + index + 'num');

  if (nameEl) nameEl.textContent = t(action.name);

  if (barEl) {

    barEl.style.width = action.value + '%';

    barEl.dataset.actionKind = visualActionKind(action);

    barEl.setAttribute('aria-label', `${t(action.name)}: ${action.value}%`);

    if (barEl.closest('.frequency')) barEl.closest('.frequency').dataset.actionKind = visualActionKind(action);

  }

  if (numEl) numEl.textContent = action.value ? action.value + '%' : '—';

}



function preflopBasePot() {

  return 1.5 + numericValue('#ante') * numericValue('#players', 6) + numericValue('#straddle');

}



function updateMetrics() {
  const decisionContext = arguments.length > 0 ? arguments[0] : null;
  const context = decisionContext?.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION
    ? decisionContext
    : null;
  const lastAction = context?.lastAction || selectedValue('#lastAction');
  const heroPos = context?.heroPosition || selectedValue('#heroPos');
  const street = context?.street || currentStreet();
  const pot = context ? context.potBb : numericValue('#potSize', preflopBasePot());
  let facing = context ? context.facingSizeBb : numericValue('#facingSize');
  const callAmount = context ? context.callAmountBb : null;
  const stack = context ? context.stackBb : numericValue('#stack', 100);
  const rakeMode = context?.rakeMode || selectedValue('#rakeMode');
  const accounting = context || strategyAccountingContext(rakeMode, numericValue('#players', 6));

  const isPreflopUnopened = (street === 'preflop') && (lastAction === 'unopened');
  const isPreflopOpenDecision = isPreflopUnopened && heroPos !== 'BB';

  // Blinds are forced contributions, not a voluntary wager facing the hero.
  if (isPreflopUnopened) {
    facing = normalizeFacingSize(lastAction, facing);
    const facingSlider = $('#facingSize');
    const facingNum = $('#facingSizeNum');
    if (facingSlider) facingSlider.value = '0';
    if (facingNum) facingNum.value = '0';
  }

  const mEquity = $('#mEquity');
  if (mEquity) mEquity.textContent = t('Range needed');

  const mPotOdds = $('#mPotOdds');
  if (mPotOdds) {
    if (isPreflopOpenDecision) {
      mPotOdds.textContent = t('— (Unopened)');
    } else if (!Number.isFinite(callAmount)) {
      mPotOdds.textContent = t('— (Price unavailable)');
    } else if (lastAction === 'unopened' || callAmount === 0) {
      mPotOdds.textContent = '—';
    } else {
      mPotOdds.textContent = (callAmount / (pot + callAmount) * 100).toFixed(1) + '%';
    }
  }

  const mSPR = $('#mSPR');
  if (mSPR) mSPR.textContent = (stack / Math.max(.5, pot)).toFixed(1);

  const mRake = $('#mRake');
  if (mRake) {
    if (rakeMode === 'off') mRake.textContent = t('Off');
    else if (rakeMode === 'fixed') {
      mRake.textContent = t('{perPlayer} bb/player · {total} bb total', {
        perPlayer: accounting.forcedContributionPerPlayerBb.toFixed(1),
        total: accounting.totalForcedContributionBb.toFixed(1)
      });
    } else mRake.textContent = t('Off');
  }

  const metricValues = {
    mPosition: heroPos || '—',
    mPot: `${Number(pot).toFixed(1)} bb`,
    mFacing: `${Number(facing).toFixed(1)} bb`,
    mStack: `${Number(stack).toFixed(0)} bb`
  };
  Object.entries(metricValues).forEach(([id, value]) => {
    if ($('#' + id)) $('#' + id).textContent = value;
  });

  const facingSizeOut = $('#facingSizeOut');
  if (facingSizeOut) {
    if (isPreflopOpenDecision) {
      facingSizeOut.textContent = t('0.0 bb (Unopened)');
    } else if (facing > 0) {
      facingSizeOut.textContent = facing.toFixed(1) + ' bb';
    } else {
      facingSizeOut.textContent = t('0.0 bb (Free Check)');
    }
  }

  const potSizeOut = $('#potSizeOut');
  if (potSizeOut) potSizeOut.textContent = pot.toFixed(1) + ' bb';
}



const ACTION_PATH_COMPACT_MEDIA = '(max-width: 1499px), (max-height: 900px)';
let actionPathCompactExpanded = false;
let actionPathMediaQuery = null;

function escapeActionPathMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function updateActionPathDisclosure() {
  const panel = $('#playbookDecisionPathPanel');
  const toggle = $('#actionPathDetailsToggle');
  if (!panel || !toggle) return;
  const compact = panel.dataset.actionPathPresentation === 'compact';
  const expanded = compact ? actionPathCompactExpanded : true;
  panel.classList.toggle('is-expanded', expanded);
  toggle.hidden = !compact;
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.textContent = t(expanded ? 'Collapse details' : 'Expand details');
}

function applyActionPathPresentation(compact) {
  const panel = $('#playbookDecisionPathPanel');
  const compactMount = $('#playbookCompactActionPathMount');
  const fullMount = $('#playbookActionPathRailMount');
  if (!panel || !compactMount || !fullMount) return;
  const target = compact ? compactMount : fullMount;
  if (panel.parentElement !== target) target.append(panel);
  panel.dataset.actionPathPresentation = compact ? 'compact' : 'full';
  updateActionPathDisclosure();
}

function initActionPathPresentation() {
  const toggle = $('#actionPathDetailsToggle');
  if (!toggle || !window.matchMedia) return applyActionPathPresentation(false);
  actionPathMediaQuery = window.matchMedia(ACTION_PATH_COMPACT_MEDIA);
  const syncPresentation = () => applyActionPathPresentation(actionPathMediaQuery.matches);
  if (typeof actionPathMediaQuery.addEventListener === 'function') {
    actionPathMediaQuery.addEventListener('change', syncPresentation);
  } else if (typeof actionPathMediaQuery.addListener === 'function') {
    actionPathMediaQuery.addListener(syncPresentation);
  }
  toggle.addEventListener('click', () => {
    if ($('#playbookDecisionPathPanel')?.dataset.actionPathPresentation !== 'compact') return;
    actionPathCompactExpanded = !actionPathCompactExpanded;
    updateActionPathDisclosure();
  });
  syncPresentation();
}

function renderUnavailableActionPath(message, state = 'unavailable') {
  const pathList = $('#pathList');
  const panel = $('#playbookDecisionPathPanel');
  if (!pathList) return;
  if (panel) panel.dataset.actionPathState = state;
  pathList.innerHTML = `<div class="action-path-unavailable" role="status">${escapeActionPathMarkup(message)}</div>`;
}

function renderPath(street) {
  const pathList = $('#pathList');
  const panel = $('#playbookDecisionPathPanel');
  if (!pathList) return;

  const context = app.decisionContext?.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION
    ? app.decisionContext
    : null;
  const boardCards = (context?.board || app.gto.board).filter(Boolean).map(displayCard);
  const heroPos = context?.heroPosition || selectedValue('#heroPos') || 'BTN';
  const lastActionEl = $('#lastAction');
  const lastActionText = context?.lastAction
    || (lastActionEl && lastActionEl.selectedOptions && lastActionEl.selectedOptions[0]
      ? lastActionEl.selectedOptions[0].text : 'Unopened');
  const streetCount = boardCards.length;
  const stages = [
    { key: 'preflop', label: t('Preflop') },
    { key: 'flop', label: t('Flop') },
    { key: 'turn', label: t('Turn') },
    { key: 'river', label: t('River') }
  ];
  const requestedStreet = String(context?.street || street || '').toLowerCase();
  let activeIdx = stages.findIndex((stage) => stage.key === requestedStreet);
  if (activeIdx < 0) {
    activeIdx = streetCount >= 5 ? 3 : streetCount === 4 ? 2 : streetCount >= 3 ? 1 : 0;
  }
  const branchSummary = `${heroPos} · ${t(lastActionText)}`;
  const stageDetails = [
    branchSummary,
    streetCount >= 3 ? boardCards.slice(0, 3).join(' ') : t('Waiting for flop...'),
    streetCount >= 4 ? boardCards[3] : t('Waiting for turn...'),
    streetCount >= 5 ? boardCards[4] : t('Waiting for river...')
  ];
  const activeSummary = activeIdx === 0
    ? branchSummary
    : `${stages[activeIdx].label} · ${stageDetails[activeIdx]} · ${branchSummary}`;

  if (panel) panel.dataset.actionPathState = 'available';
  pathList.innerHTML = `
    <div class="path-progress" role="list" aria-label="${escapeActionPathMarkup(t('Street progression'))}">
      ${stages.map((stage, idx) => {
        const statusClass = idx < activeIdx ? 'completed' : idx === activeIdx ? 'active' : 'upcoming';
        const statusIcon = idx < activeIdx
          ? '<span class="node-check" aria-hidden="true">✓</span>'
          : idx === activeIdx
            ? '<span class="node-active" aria-hidden="true"></span>'
            : '<span class="node-dot" aria-hidden="true"></span>';
        const currentAttribute = idx === activeIdx ? ' aria-current="step"' : '';
        const currentPrefix = idx === activeIdx
          ? `<span class="sr-only">${escapeActionPathMarkup(t('Current street'))}: </span>`
          : '';
        return `<div class="path-step ${statusClass}" role="listitem"${currentAttribute}>
          <div class="path-node">${statusIcon}</div>
          <div class="path-body"><b>${currentPrefix}${escapeActionPathMarkup(stage.label)}</b><span>${escapeActionPathMarkup(stageDetails[idx])}</span></div>
        </div>`;
      }).join('')}
    </div>
    <p class="path-current-summary"><span>${escapeActionPathMarkup(t('Current branch'))}</span><strong>${escapeActionPathMarkup(activeSummary)}</strong></p>
  `;
}



function handCode(row, column) {

  if (row === column) return RANKS[row] + RANKS[column];

  return row < column ? RANKS[row] + RANKS[column] + 's' : RANKS[column] + RANKS[row] + 'o';

}





function getFirstValidCombo(handClassStr, excludeCards) {

  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];

  const suits = ['s','h','d','c'];

  

  if (!handClassStr) return null;

  

  const r1 = handClassStr[0];

  const r2 = handClassStr[1];

  const isPair = r1 === r2;

  const isSuited = handClassStr.length === 3 && handClassStr[2] === 's';

  const isOffsuit = handClassStr.length === 3 && handClassStr[2] === 'o';

  

  if (isPair) {

    for (let i = 0; i < suits.length; i++) {

      for (let j = i + 1; j < suits.length; j++) {

        const c1 = r1 + suits[i];

        const c2 = r2 + suits[j];

        if (!excludeCards.includes(c1) && !excludeCards.includes(c2)) return [c1, c2];

      }

    }

  } else if (isSuited) {

    for (let s of suits) {

      const c1 = r1 + s;

      const c2 = r2 + s;

      if (!excludeCards.includes(c1) && !excludeCards.includes(c2)) return [c1, c2];

    }

  } else {

    for (let i = 0; i < suits.length; i++) {

      for (let j = 0; j < suits.length; j++) {

        if (i === j) continue;

        const c1 = r1 + suits[i];

        const c2 = r2 + suits[j];

        if (!excludeCards.includes(c1) && !excludeCards.includes(c2)) return [c1, c2];

      }

    }

  }

  return null;

}



function hideMatrixCellCue() {
  const cue = $('#matrixCellCue');
  if (!cue) return;
  cue.hidden = true;
  cue.removeAttribute('data-input');
  cue.style.removeProperty('--matrix-cue-x');
  cue.style.removeProperty('--matrix-cue-y');
}

function showMatrixCellCue(cell, pointerEvent = null) {
  const cue = $('#matrixCellCue');
  if (!cue || !cell?.dataset.hand) return;

  const hand = $('#matrixCellCueHand');
  const mix = $('#matrixCellCueMix');
  if (hand) hand.textContent = cell.dataset.hand;
  if (mix) mix.textContent = cell.dataset.strategyCue || t('Strategy unavailable');
  cue.dataset.input = pointerEvent ? 'pointer' : 'keyboard';
  if (pointerEvent) {
    cue.style.setProperty('--matrix-cue-x', `${pointerEvent.clientX}px`);
    cue.style.setProperty('--matrix-cue-y', `${pointerEvent.clientY}px`);
  } else {
    cue.style.removeProperty('--matrix-cue-x');
    cue.style.removeProperty('--matrix-cue-y');
  }
  cue.hidden = false;
}

function bindMatrixGridInteractions(grid) {
  if (!grid || grid.dataset.delegated) return;
  grid.dataset.delegated = 'true';
  grid.addEventListener('click', (event) => {
    const cell = event.target.closest('.hand-cell');
    if (!cell || !cell.dataset.hand) return;
    if (window.SoundFX) SoundFX.playClick();
    app.selectedHand = cell.dataset.hand;
    const selectedHand = $('#selectedHand');
    if (selectedHand) selectedHand.textContent = app.selectedHand;
    renderChart();
  });
  grid.addEventListener('pointerover', (event) => {
    const cell = event.target.closest('.hand-cell');
    if (!cell || (event.relatedTarget && cell.contains(event.relatedTarget))) return;
    showMatrixCellCue(cell, event);
  });
  grid.addEventListener('pointerout', (event) => {
    const cell = event.target.closest('.hand-cell');
    if (!cell || (event.relatedTarget && cell.contains(event.relatedTarget))) return;
    hideMatrixCellCue();
  });
  grid.addEventListener('focusin', (event) => showMatrixCellCue(event.target.closest('.hand-cell')));
  grid.addEventListener('focusout', hideMatrixCellCue);
  grid.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideMatrixCellCue();
  });
  grid.closest('.matrix-wrap')?.addEventListener('scroll', hideMatrixCellCue, { passive: true });
}

function matrixMixState(actions, dominantAction) {
  const meaningfulActions = actions.filter((action) => Number(action.value) >= 0.5);
  return meaningfulActions.length <= 1 || Number(dominantAction?.value) >= 99.5 ? 'pure' : 'mixed';
}

function renderChart() {

  const grid = $('#strategyGrid');

  if (!grid) return;

  const decisionContext = app.decisionContext?.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION
    ? app.decisionContext
    : null;
  const matrixContextUnavailable = !decisionContext;
  const positions = decisionContext?.heroPosition || '—';
  const matrixStack = decisionContext?.stackBb ?? 0;
  const matrixModel = prepareMatrixStrategyModel(decisionContext);
  const currentHeroClass = matrixContextUnavailable
    ? '' : handClass(decisionContext?.heroCards || app.gto.hero);
  const isPostFlop = matrixModel.isPostFlop;
  const matrixSource = matrixModel.source;
  const matrixLayout = document.querySelector('.range-matrix-layout');
  const matrixEmptyState = $('#postflopMatrixEmpty');
  const matrixToolbar = document.querySelector('.range-matrix-toolbar');
  const matrixDescription = $('#matrixPanelDescription');

  if (matrixLayout) matrixLayout.hidden = isPostFlop;
  if (matrixEmptyState) matrixEmptyState.hidden = !isPostFlop;
  if (matrixToolbar) matrixToolbar.hidden = isPostFlop;
  if (matrixDescription) {
    matrixDescription.textContent = t(isPostFlop
      ? 'Range expansion is not available yet; use Decision for exact-hand postflop strategy.'
      : 'All 169 hand classes · click any square for its current mix.');
  }

  if (isPostFlop) {
    hideMatrixCellCue();
    grid.replaceChildren();
    if ($('#chartSelectionPreview')) $('#chartSelectionPreview').innerHTML = `<span>${t('Exact hand only')}</span>`;
    if ($('#selectedHand')) $('#selectedHand').textContent = t('Exact hand only');
    if ($('#selectedHandKind')) $('#selectedHandKind').textContent = t('Postflop decision');
    if ($('#selectedHandPrimary')) $('#selectedHandPrimary').textContent = t('Range expansion unavailable');
    if ($('#selectedMix')) $('#selectedMix').innerHTML = `<span class="matrix-inspector-unavailable">${t('Use Decision for the exact-hand strategy.')}</span>`;
    if ($('#chartSummary')) $('#chartSummary').textContent = t('Use Decision for exact-hand postflop strategy.');
    return;
  }

  if (grid.children.length === 0) {
    grid.innerHTML = '';
    RANKS.forEach((_, row) => RANKS.forEach((__, col) => {
      const btn = document.createElement('button');
      btn.className = 'hand-cell';
      btn.type = 'button';
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-rowindex', String(row + 1));
      btn.setAttribute('aria-colindex', String(col + 1));
      grid.appendChild(btn);
    }));
  }

  bindMatrixGridInteractions(grid);

  

  let previewHTML = '';

  

  RANKS.forEach((_, row) => RANKS.forEach((__, column) => {

    const hand = handCode(row, column);
    const actions = matrixModel.cells[row * 13 + column]?.actions || [];
    const dominantAction = actions.reduce((highest, action) =>
      Number(action.value) > Number(highest?.value ?? -1) ? action : highest, null);

    const type = dominantAction?.kind || 'unavailable';
    const handKind = row === column ? 'pair' : hand.endsWith('s') ? 'suited' : 'offsuit';
    const mixState = matrixMixState(actions, dominantAction);

    const detail = actions.length
      ? actions.map((action) => `${t(action.name)} ${action.value}%`).join(' · ')
      : isPostFlop
        ? t('Unavailable · provider-backed postflop Matrix deferred')
        : t('Strategy unavailable');

    const idx = row * 13 + column;
    const button = grid.children[idx];

    const isSelected = app.selectedHand === hand || (!app.selectedHand && currentHeroClass === hand);

    button.className = `hand-cell hand-${handKind} action-${type} matrix-${mixState} ${isSelected ? 'selected ' : ''}${type}`;
    button.dataset.handKind = handKind;
    button.dataset.primaryAction = visualActionKind(dominantAction);
    button.dataset.mixState = mixState;
    button.dataset.state = actions.length ? 'available' : 'unavailable';
    button.dataset.strategySource = matrixSource || 'unavailable';
    button.dataset.strategyCue = detail;
    button.setAttribute('aria-pressed', String(isSelected));
    button.setAttribute('aria-describedby', 'matrixCellCue');

    const chartMode = $('#chartAction')?.value || 'strategy';

    let cellSubtext = '';

    let cellBg = '';
    button.style.removeProperty('background');



    if (chartMode === 'raise') {

      const val = actions.find(a => a.kind === 'aggressive')?.value;

      cellSubtext = actions.length ? `${val || 0}%` : t('Unavailable');

      if (actions.length) cellBg = `color-mix(in srgb, var(--action-aggressive) ${val || 0}%, transparent)`;

    } else if (chartMode === 'call') {

      const val = actions.find(a => a.kind === 'passive')?.value;

      cellSubtext = actions.length ? `${val || 0}%` : t('Unavailable');

      if (actions.length) cellBg = `color-mix(in srgb, var(--action-passive) ${val || 0}%, transparent)`;

    } else if (chartMode === 'fold') {

      const val = actions.find(a => a.kind === 'fold')?.value;

      cellSubtext = actions.length ? `${val || 0}%` : t('Unavailable');

      if (actions.length) cellBg = `color-mix(in srgb, var(--action-fold) ${val || 0}%, transparent)`;

    }



    if (cellSubtext) {

      button.innerHTML = `<span class="matrix-hand-label">${hand}</span><div class="matrix-cell-subtext">${cellSubtext}</div>`;

    } else {

      button.innerHTML = `<span class="matrix-hand-label">${hand}</span>`;

    }



    button.dataset.hand = hand;

    const kindLabel = t(handKind === 'pair' ? 'Pair' : handKind === 'suited' ? 'Suited' : 'Offsuit');
    button.setAttribute('aria-label', `${hand}, ${kindLabel}: ${detail}`);



    if (cellBg) {

      button.style.background = cellBg;

    } else if (actions.length > 0) {
      button.insertAdjacentHTML('beforeend', `<span class="matrix-mix-bar" aria-hidden="true">${actions.map((action) => `<i data-action-kind="${visualActionKind(action)}" style="width:${action.value}%"></i>`).join('')}</span>`);
    }



    if (isSelected) {

        const primaryAction = dominantAction;
        previewHTML = `<strong class="matrix-preview-hand">${hand}</strong><span class="matrix-preview-summary">${primaryAction ? `${t(primaryAction.name)} ${primaryAction.value}%` : t('Unavailable')}</span>`;

        $('#selectedHand').textContent = hand;
        if ($('#selectedHandKind')) $('#selectedHandKind').textContent = kindLabel;
        if ($('#selectedHandPrimary')) {
          $('#selectedHandPrimary').textContent = primaryAction
            ? t('Primary · {action} {value}%', { action: t(primaryAction.name), value: primaryAction.value })
            : t('Strategy unavailable');
          $('#selectedHandPrimary').dataset.actionKind = visualActionKind(primaryAction);
        }

        $('#selectedMix').innerHTML = actions.length
          ? `<div class="matrix-inspector-actions">${actions.map((action) => `<span class="matrix-inspector-action"><i data-action-kind="${visualActionKind(action)}"></i><span>${t(action.name)}</span><strong>${action.value % 1 === 0 ? action.value : Number(action.value).toFixed(1)}%</strong></span>`).join('')}</div><div class="alloc" role="img" aria-label="${detail}">${actions.map((action) => `<i data-action-kind="${visualActionKind(action)}" style="width:${action.value}%"></i>`).join('')}</div>`
          : `<span class="matrix-inspector-unavailable">${detail || t('Strategy unavailable for this hand.')}</span>`;

    }



    /* grid.appendChild(button) removed for recycling */

  }));

  const previewContainer = $('#chartSelectionPreview');

  if (previewContainer) {

      previewContainer.innerHTML = previewHTML || `<span>${t('Select a hand')}</span>`;

  }



  const chartSummary = $('#chartSummary');
  if (chartSummary) {
    chartSummary.textContent = matrixContextUnavailable
      ? t('Strategy unavailable for the current decision context')
      : isPostFlop
        ? t('Use Decision for exact-hand postflop strategy.')
        : `${positions} · ${matrixStack} bb · ${strategySourceDisplayLabel(matrixSource)}`;
  }

}


function matrixStrategyKey(decisionContext) {
  if (!decisionContext) return 'unavailable';
  return JSON.stringify({
    decisionContext: { ...decisionContext, heroCards: null },
    providerOptions: readHeuristicOptions()
  });
}

function prepareMatrixStrategyModel(decisionContext) {
  const key = matrixStrategyKey(decisionContext);
  if (app.matrixModel?.key === key) return app.matrixModel;

  const matrixContextUnavailable = !decisionContext;
  const isPostFlop = !matrixContextUnavailable
    && (decisionContext.street || currentStreet()) !== 'preflop';
  let matrixSource = null;
  const cells = RANKS.flatMap((_, row) => RANKS.map((__, column) => {
    const hand = handCode(row, column);
    let actions = [];
    if (!isPostFlop && !matrixContextUnavailable) {
      const representativeCards = getFirstValidCombo(
        hand,
        [...decisionContext.board, ...decisionContext.deadCards]
      );
      if (representativeCards) {
        const cellDecisionContext = {
          ...decisionContext,
          heroCards: representativeCards
        };
        const cellStrategyResult = strategyProvider.resolve(cellDecisionContext);
        matrixSource = matrixSource || cellStrategyResult.source;
        if (cellStrategyResult.source !== strategyProvider.sources.UNAVAILABLE) {
          actions = strategyResultPresentationActions(cellStrategyResult);
        }
      }
    }
    return { hand, actions };
  }));
  app.matrixModel = { key, source: matrixSource, isPostFlop, cells };
  return app.matrixModel;
}


function visualActionKind(action) {
  const type = action?.action?.type;
  if (type === 'all_in') return 'all-in';
  if (type === 'fold') return 'fold';
  if (type === 'check' || type === 'call') return 'passive';
  if (type === 'bet' || type === 'raise') return 'aggressive';
  // Presentation-only compatibility for non-StrategyResult UI structures.
  const name = String(action?.name || '').toLowerCase();
  if (name.includes('all-in') || name.includes('all in') || name.includes('jam')) return 'all-in';
  if (action?.kind === 'fold' || name.includes('fold')) return 'fold';
  if (action?.kind === 'passive' || action?.kind === 'check' || name.includes('call') || name.includes('check')) return 'passive';
  if (action?.kind === 'aggressive') return 'aggressive';
  return 'unavailable';
}

function actionVisualColor(action) {
  return ACTION_COLORS[visualActionKind(action)] || ACTION_COLORS.unavailable;
}

function renderFrequencyStack(container, actions) {
  if (!container) return;
  const populated = actions.filter((action) => Number(action.value) > 0);
  container.innerHTML = populated.map((action) => {
    const kind = visualActionKind(action);
    return `<span class="frequency-stack-segment" data-action-kind="${kind}" style="width:${action.value}%" title="${t(action.name)}: ${action.value}%"></span>`;
  }).join('');
  const label = populated.length
    ? populated.map((action) => `${t(action.name)} ${action.value}%`).join(', ')
    : t('Strategy frequencies unavailable');
  container.setAttribute('aria-label', label);
  container.classList.toggle('is-empty', populated.length === 0);
}

function strategySourceDisplayLabel(source) {
  const labels = {
    heuristic_preflop: 'Heuristic fallback',
    heuristic_postflop: 'Heuristic fallback',
    equity_fallback: 'Equity fallback',
    unavailable: 'Unavailable'
  };
  return t(labels[source] || String(source || 'Unavailable'));
}

function setRecommendationState(state) {
  const recommendation = $('#recommendation');
  if (!recommendation) return;
  recommendation.dataset.recommendationState = state;
  recommendation.setAttribute('aria-busy', String(state === 'loading'));
}

function analysisUnavailableReasonForResolution(resolution) {
  const reason = String(resolution?.reason || '');
  if (reason === 'canonical_hero_cards_unknown') return 'missing_hero_cards';
  if (reason === 'canonical_hero_not_actor') return 'hero_not_actor';
  if (reason === 'canonical_chance_state') return 'waiting_for_board';
  if (reason === 'canonical_terminal_state' || reason === 'canonical_showdown_state') return 'terminal_hand';
  if (resolution?.mode === 'scenario') return 'invalid_scenario';
  return 'strategy_unavailable';
}

function canonicalActionHistoryForAnalysis(resolution) {
  if (resolution?.mode !== 'hand') return [];
  const timeline = callPlaybookStateBridge('createReplayTimelineViewModel');
  if (!timeline || timeline.schemaVersion !== 'replay-timeline/v1') return [];
  const labels = {
    fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet to', raise: 'Raise to', all_in: 'All-in to'
  };
  return timeline.groups.flatMap((group) => group.entries).map((entry) => {
    return {
      sequence: entry.sequence,
      street: entry.street,
      actorLabel: entry.isHero ? 'Hero' : (entry.position || entry.identity),
      position: entry.position,
      actionType: entry.actionType,
      actionLabel: labels[entry.actionType] || 'Action',
      amountBb: Number.isSafeInteger(entry.amountMilliBb) ? entry.amountMilliBb / 1000 : null,
      isHero: entry.isHero
    };
  });
}

function trustedAnalysisFacts(actionHistory = []) {
  return { actionHistory: Array.isArray(actionHistory) ? actionHistory : [] };
}

const EMPTY_RANGE_ANALYSIS_INPUTS = Object.freeze({});
let rangeAnalysisMemo = null;
let bluffAnalysisMemo = null;

function rangeAnalysisFactsForDecision(
  decisionContext,
  authority,
  ranges = EMPTY_RANGE_ANALYSIS_INPUTS
) {
  const bridge = globalThis.RiverlineAnalysisExplanation;
  if (!decisionContext || !bridge
    || typeof bridge.createRangeAnalysisRequest !== 'function'
    || typeof bridge.createRangeAnalysisFacts !== 'function') return null;
  if (rangeAnalysisMemo
    && rangeAnalysisMemo.decisionContext === decisionContext
    && rangeAnalysisMemo.authority === authority
    && rangeAnalysisMemo.ranges === ranges) return rangeAnalysisMemo.facts;
  const sourceLabels = {
    scenario: 'Scenario cards',
    hand: 'Canonical PokerState cards',
    training: 'Canonical Training cards'
  };
  const source = {
    kind: authority,
    label: sourceLabels[authority] || 'DecisionContext cards',
    sourceSchemaVersion: decisionContext.schemaVersion
  };
  const request = bridge.createRangeAnalysisRequest({
    decisionContext,
    ranges,
    provenance: {
      exactHand: source,
      board: source,
      deadCards: source
    }
  });
  const facts = bridge.createRangeAnalysisFacts(request);
  rangeAnalysisMemo = { decisionContext, authority, ranges, facts };
  return facts;
}

function bluffAnalysisFactsForDecision(rangeAnalysisFacts, decisionContext, strategyResult) {
  const bridge = globalThis.RiverlineAnalysisExplanation;
  if (!rangeAnalysisFacts || !decisionContext || !bridge
    || typeof bridge.createBluffAnalysisFacts !== 'function') return null;
  if (bluffAnalysisMemo
    && bluffAnalysisMemo.rangeAnalysisFacts === rangeAnalysisFacts
    && bluffAnalysisMemo.decisionContext === decisionContext
    && bluffAnalysisMemo.strategyResult === strategyResult) return bluffAnalysisMemo.facts;
  const facts = bridge.createBluffAnalysisFacts({
    decisionContext,
    strategyResult,
    rangeAnalysisFacts
  });
  bluffAnalysisMemo = { rangeAnalysisFacts, decisionContext, strategyResult, facts };
  return facts;
}

function renderDecisionAnalysis(container, {
  decisionContext,
  strategyResult,
  trustedFacts,
  authority,
  depth,
  unavailableReason = null,
  surface = 'playbook',
  rangeInputs = EMPTY_RANGE_ANALYSIS_INPUTS
}) {
  if (!container) return null;
  const bridge = globalThis.RiverlineAnalysisExplanation;
  if (!bridge || typeof bridge.create !== 'function' || typeof renderAnalysisExplanation !== 'function') {
    container.textContent = t('Decision analysis is unavailable.');
    return null;
  }
  const rangeAnalysisFacts = rangeAnalysisFactsForDecision(decisionContext, authority, rangeInputs);
  const bluffAnalysisFacts = bluffAnalysisFactsForDecision(
    rangeAnalysisFacts,
    decisionContext,
    strategyResult
  );
  const explanation = bridge.create({
    decisionContext,
    strategyResult,
    trustedFacts,
    rangeAnalysisFacts,
    bluffAnalysisFacts,
    authority,
    depth,
    unavailableReason
  });
  renderAnalysisExplanation(container, explanation, { depth, surface });
  return explanation;
}

function renderPlaybookDecisionAnalysis(decisionContext, strategyResult, resolution, unavailableReason = null) {
  const authority = resolution?.mode === 'hand' ? 'hand' : 'scenario';
  const result = strategyResult?.schemaVersion === strategyProvider.resultSchemaVersion
    ? strategyResult
    : null;
  const explanation = renderDecisionAnalysis($('#teacherContent'), {
    decisionContext,
    strategyResult: result,
    trustedFacts: trustedAnalysisFacts(canonicalActionHistoryForAnalysis(resolution)),
    authority,
    depth: 'detailed',
    unavailableReason,
    surface: 'playbook'
  });
  app.analysisExplanation = explanation;
  return explanation;
}

function renderPlaybookTableProjection() {
  const decisionContext = app.decisionContext;
  const playbookResolution = app.playbookResolution;
  if (!decisionContext || !playbookResolution) return;
  const playbookBridge = globalThis.RiverlinePlaybookState;
  if (playbookResolution.mode === 'hand' && typeof dispatchCanonicalTableState === 'function') {
    dispatchCanonicalTableState();
    return;
  }

  const activePlayers = decisionContext.tableSize;
  const allPos = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];
  const currentPosArr = POSITIONS[activePlayers] || POSITIONS[6];
  const sortedPos = currentPosArr.slice().sort((a, b) => allPos.indexOf(a) - allPos.indexOf(b));
  const heroIdx = sortedPos.indexOf(decisionContext.heroPosition);
  const btnIdx = sortedPos.indexOf('BTN');
  const dealerPos = heroIdx !== -1 && btnIdx !== -1
    ? (btnIdx - heroIdx + activePlayers) % activePlayers : 0;
  const parsedBoard = decisionContext.board.map((card) => ({ rank: card.slice(0, -1), suit: card.slice(-1) }));
  const parsedHero = decisionContext.heroCards.map((card) => ({ rank: card.slice(0, -1), suit: card.slice(-1) }));
  const scenarioPlayers = Array.from({ length: activePlayers }, (_, seat) => ({
    seat,
    name: seat === 0 ? 'Hero' : sortedPos[(heroIdx + seat) % activePlayers] || `P${seat + 1}`,
    isHero: seat === 0,
    stackBb: Number(decisionContext.stackBb),
  }));

  window.dispatchEvent(new CustomEvent('gameStateUpdate', {
    detail: {
      mode: 'scenario',
      pot: Number(decisionContext.potBb).toFixed(1),
      board: parsedBoard,
      heroCards: parsedHero,
      dealerPos: dealerPos,
      activePlayers: decisionContext.tableSize,
      players: scenarioPlayers,
    }
  }));
}

async function updateContext(reason = 'Context updated') {
  const resolutionOverride = arguments[1] || null;

  if (!resolutionOverride
    && typeof activeSavedSpotContext !== 'undefined'
    && activeSavedSpotContext) {
    activeSavedSpotContext = null;
    renderSavedSpotViewer(null);
  }

  if (playbookUpdateScheduler.isPending()) playbookUpdateScheduler.cancel();

  syncSliderPair('players', 'playersNum');

  syncSliderPair('stack', 'stackNum');

  syncSliderPair('ante', 'anteNum');

  const inputSnapshot = readPlaybookInputSnapshot();
  const playbookBridge = globalThis.RiverlinePlaybookState;
  const playbookResolution = resolutionOverride || (playbookBridge && typeof playbookBridge.resolveDecisionContext === 'function'
    ? playbookBridge.resolveDecisionContext(inputSnapshot)
    : {
        schemaVersion: 'playbook-decision-resolution/v1',
        mode: 'scenario',
        status: 'available',
        reason: null,
        error: null,
        decisionContext: deriveDecisionContext(inputSnapshot)
      });
  app.playbookMode = playbookResolution.mode;
  app.playbookResolution = playbookResolution;

  if (playbookResolution.status !== 'available' || !playbookResolution.decisionContext) {
    app.decisionContext = null;
    app.strategyResult = null;
    app.playbookViewModel = playbookBridge && typeof playbookBridge.createViewModel === 'function'
      ? playbookBridge.createViewModel(null)
      : null;
    invalidatePlaybookDerivedSurfaces();
    if (typeof renderUnavailableStrategy === 'function') renderUnavailableStrategy(playbookResolution);
    renderVisiblePlaybookDerivedSurfaces();
    if (window.RiverlineSavedStudyObjects) void refreshSavedStudySource();
    return playbookResolution;
  }

  const decisionContext = playbookResolution.decisionContext;
  app.decisionContext = decisionContext;
  if (playbookResolution.mode === 'hand' && typeof syncCanonicalDecisionDisplay === 'function') {
    syncCanonicalDecisionDisplay(decisionContext);
  }
  if (typeof renderPlaybookModeStatus === 'function') renderPlaybookModeStatus(playbookResolution);
  
  if (decisionContext.street === 'preflop' && decisionContext.lastAction === 'unopened') {
    if ($('#facingSize')) $('#facingSize').value = decisionContext.facingSizeBb;
    if ($('#facingSizeNum')) $('#facingSizeNum').value = decisionContext.facingSizeBb;
  }
  
  const strategyResult = strategyProvider.resolve(decisionContext);
  const profile = strategyResultToLegacyProfile(strategyResult);
  const meaningfulActions = strategyResult.actions.filter((entry) => entry.probability >= 0.05).length;
  if (typeof setRecommendationState === 'function') {
    setRecommendationState(strategyResult.warnings.length > 0
      ? 'warning'
      : meaningfulActions > 1 ? 'mixed' : 'ready');
  }
  app.strategyResult = strategyResult;
  app.playbookViewModel = playbookBridge && typeof playbookBridge.createViewModel === 'function'
    ? playbookBridge.createViewModel(strategyResult)
    : null;
  invalidatePlaybookDerivedSurfaces();

  const street = decisionContext.street;

  const hero = decisionContext.heroPosition;

  const lastAction = playbookResolution.mode === 'hand'
    ? decisionContext.lastAction
    : inputSnapshot.lastActionLabel;

  const hand = decisionContext.heroCards.map(displayCard).join(' ');

  const board = decisionContext.board.map(displayCard).join(' ');

  const contextKey = [profile.best, hero, street, lastAction, hand, board, decisionContext.tableSize, decisionContext.stackBb, decisionContext.facingSizeBb, decisionContext.potBb].join('|');



  const bestAction = $('#bestAction');

  if (bestAction) bestAction.textContent = t(profile.best);

  const recommendationSizing = strategyResult.recommendation?.action;
  const bestSizing = $('#bestSizing');
  if (bestSizing) {
    if (Number.isFinite(recommendationSizing?.amountBb)) {
      bestSizing.textContent = `${recommendationSizing.amountBb} bb`;
      bestSizing.hidden = false;
    } else if (Number.isFinite(recommendationSizing?.potFraction)) {
      bestSizing.textContent = t('{value}% pot', { value: (recommendationSizing.potFraction * 100).toFixed(0) });
      bestSizing.hidden = false;
    } else {
      bestSizing.textContent = '';
      bestSizing.hidden = true;
    }
  }

  const bestReason = $('#bestReason');

  if (bestReason) bestReason.textContent = profile.reason;

  const recommendation = $('#recommendation');
  if (recommendation) recommendation.dataset.actionKind = visualActionKind(profile.actions[0]);

  

  // Dynamically disable irrelevant street tabs on the chart page

  $$('.street-tab').forEach((button) => {

      const isCurrent = button.dataset.chartStreet === street;

      button.classList.toggle('active', isCurrent);
      button.setAttribute('aria-selected', String(isCurrent));

      button.disabled = !isCurrent;

      button.style.opacity = isCurrent ? '1' : '0.3';

      button.style.cursor = isCurrent ? 'default' : 'not-allowed';

  });

  const sourceBadge = $('#sourceBadge');

  if (sourceBadge) {
    const sourceLabel = typeof strategySourceDisplayLabel === 'function'
      ? strategySourceDisplayLabel(strategyResult.source)
      : strategyResult.source;
    const sourceTone = strategyResult.source.startsWith('heuristic_') ? 'heuristic' : 'info';
    const provenance = sourceTone === 'heuristic'
      ? t('Heuristic guidance is active unless another source is named above. Canonical hand state does not imply solved strategy.')
      : `${t('Strategy source')}: ${sourceLabel}`;
    sourceBadge.textContent = sourceLabel;
    sourceBadge.title = provenance;
    sourceBadge.setAttribute('aria-label', `${t('Strategy source')}: ${sourceLabel}`);
    sourceBadge.className = `badge status-badge status-badge--${sourceTone}`;
    const provenanceElement = $('#strategySourceProvenance');
    if (provenanceElement) provenanceElement.textContent = provenance;
  }

  const strategyMeta = $('#strategyMeta');
  if (strategyMeta) {
    const metadata = [];
    if (strategyResult.confidence !== null) metadata.push(t('Confidence {value}%', { value: (strategyResult.confidence * 100).toFixed(0) }));
    if (strategyResult.coverage !== null) metadata.push(t('Coverage {value}%', { value: (strategyResult.coverage * 100).toFixed(0) }));
    if (strategyResult.modelVersion !== null) metadata.push(t('Model {version}', { version: strategyResult.modelVersion }));
    strategyMeta.textContent = metadata.join(' · ');
    strategyMeta.hidden = metadata.length === 0;
  }

  const strategyWarnings = $('#strategyWarnings');
  if (strategyWarnings) {
    strategyWarnings.textContent = localizedStrategyWarnings(strategyResult).join(' · ');
    strategyWarnings.hidden = strategyResult.warnings.length === 0;
  }

  const streetLabel = $('#streetLabel');

  if (streetLabel) streetLabel.textContent = t(street.charAt(0).toUpperCase() + street.slice(1));

  const displayActions = [...profile.actions];

  while (displayActions.length < 3) displayActions.push({ name: '—', value: 0, kind: 'unavailable' });

  displayActions.forEach((action, index) => setFrequency(index + 1, action));

  if (typeof renderFrequencyStack === 'function') {
    renderFrequencyStack($('#actionFrequencyStack'), displayActions);
  }

  const [a, b] = displayActions;

  const actionWheel = $('#actionWheel');

  if (actionWheel) {

    actionWheel.style.background = `conic-gradient(${actionVisualColor(a)} 0% ${a.value}%, ${actionVisualColor(b)} ${a.value}% ${a.value + b.value}%, ${actionVisualColor(displayActions[2])} ${a.value + b.value}% 100%)`;

  }

  

  // Format center text safely

  const val = a.value;

  let formattedVal = '—';

  if (val) {

      formattedVal = (val % 1 === 0 ? val : Number(val).toFixed(1)) + '%';

  }

  const wheelCenterText = $('#wheelCenterText');

  if (wheelCenterText) wheelCenterText.textContent = formattedVal;

  

  updateMetrics(decisionContext);

  renderPath(street);

  renderVisiblePlaybookDerivedSurfaces();



  if (contextKey !== app.lastContextKey) {

    app.lastContextKey = contextKey;

    const liveContextText = $('#liveContextText');

    if (liveContextText) {

      liveContextText.textContent = t('Live · updated');

      window.clearTimeout(updateContext.timer);

      updateContext.timer = window.setTimeout(() => { 

    if ($('#liveContextText')) $('#liveContextText').textContent = t('Live');

      }, 1400);

    }

  }

  if (window.RiverlineSavedStudyObjects) void refreshSavedStudySource();

}



// ---------------------------------------------------------------------------

// Legacy fast evaluator retained for the existing Outs display only.
// Canonical Equity calculation lives in shared/poker-domain/equity.js.

// ---------------------------------------------------------------------------

// Static TypedArray buffers for zero-GC hand evaluation in main thread
const JS_EVAL_COUNTS = new Uint8Array(15);
const JS_EVAL_RANKS = new Int32Array(5);
const JS_EVAL_SUITS = new Uint8Array(5);
const JS_EVAL_5 = new Array(5);

/**
 * Fast zero-allocation 5-card score calculation.
 * 
 * @param {Array<string>} cards Array of 5 card strings (e.g. ['As', 'Kh', 'Td', '9c', '2s'])
 * @returns {number} Packed numerical hand score
 */
function scoreFive(cards) {
  for (let i = 0; i < 5; i++) {
    const cardStr = cards[i];
    JS_EVAL_RANKS[i] = RANK_VALUE[cardStr[0]] || 2;
    JS_EVAL_SUITS[i] = cardStr[1] === 's' ? 1 : cardStr[1] === 'h' ? 2 : cardStr[1] === 'd' ? 4 : 8;
  }

  const isFlush = (JS_EVAL_SUITS[0] & JS_EVAL_SUITS[1] & JS_EVAL_SUITS[2] & JS_EVAL_SUITS[3] & JS_EVAL_SUITS[4]) !== 0;

  // In-place bubble sort of 5 rank integers descending
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 5; j++) {
      if (JS_EVAL_RANKS[j] > JS_EVAL_RANKS[i]) {
        const tmp = JS_EVAL_RANKS[i];
        JS_EVAL_RANKS[i] = JS_EVAL_RANKS[j];
        JS_EVAL_RANKS[j] = tmp;
      }
    }
  }

  let rankMask = 0;
  for (let i = 0; i < 5; i++) rankMask |= (1 << (JS_EVAL_RANKS[i] - 2));

  const isWheel = rankMask === 0x100f;
  let isStraight = isWheel;
  let straightHigh = isWheel ? 5 : JS_EVAL_RANKS[0];
  if (!isWheel) {
    for (let r = 14; r >= 6; r--) {
      const mask = 0x1f << (r - 6);
      if ((rankMask & mask) === mask) {
        isStraight = true;
        straightHigh = r;
        break;
      }
    }
  }

  const pack = (cat, t0, t1 = 0, t2 = 0, t3 = 0, t4 = 0) =>
    cat * 1e10 + t0 * 50625 + t1 * 3375 + t2 * 225 + t3 * 15 + t4;

  if (isFlush && isStraight) return pack(8, straightHigh);

  JS_EVAL_COUNTS.fill(0);
  for (let i = 0; i < 5; i++) JS_EVAL_COUNTS[JS_EVAL_RANKS[i]]++;

  let fourRank = 0, threeRank = 0, pair1 = 0, pair2 = 0;
  for (let r = 14; r >= 2; r--) {
    const cnt = JS_EVAL_COUNTS[r];
    if (cnt === 4) fourRank = r;
    else if (cnt === 3) threeRank = r;
    else if (cnt === 2) {
      if (pair1 === 0) pair1 = r;
      else pair2 = r;
    }
  }

  if (fourRank > 0) {
    let kicker = 0;
    for (let i = 0; i < 5; i++) {
      if (JS_EVAL_RANKS[i] !== fourRank) { kicker = JS_EVAL_RANKS[i]; break; }
    }
    return pack(7, fourRank, kicker);
  }

  if (threeRank > 0 && pair1 > 0) return pack(6, threeRank, pair1);
  if (isFlush) return pack(5, JS_EVAL_RANKS[0], JS_EVAL_RANKS[1], JS_EVAL_RANKS[2], JS_EVAL_RANKS[3], JS_EVAL_RANKS[4]);
  if (isStraight) return pack(4, straightHigh);

  if (threeRank > 0) {
    let k1 = 0, k2 = 0;
    for (let i = 0; i < 5; i++) {
      if (JS_EVAL_RANKS[i] !== threeRank) {
        if (k1 === 0) k1 = JS_EVAL_RANKS[i];
        else { k2 = JS_EVAL_RANKS[i]; break; }
      }
    }
    return pack(3, threeRank, k1, k2);
  }

  if (pair1 > 0 && pair2 > 0) {
    let kicker = 0;
    for (let i = 0; i < 5; i++) {
      if (JS_EVAL_RANKS[i] !== pair1 && JS_EVAL_RANKS[i] !== pair2) { kicker = JS_EVAL_RANKS[i]; break; }
    }
    return pack(2, pair1, pair2, kicker);
  }

  if (pair1 > 0) {
    let k1 = 0, k2 = 0, k3 = 0;
    for (let i = 0; i < 5; i++) {
      if (JS_EVAL_RANKS[i] !== pair1) {
        if (k1 === 0) k1 = JS_EVAL_RANKS[i];
        else if (k2 === 0) k2 = JS_EVAL_RANKS[i];
        else { k3 = JS_EVAL_RANKS[i]; break; }
      }
    }
    return pack(1, pair1, k1, k2, k3);
  }

  return pack(0, JS_EVAL_RANKS[0], JS_EVAL_RANKS[1], JS_EVAL_RANKS[2], JS_EVAL_RANKS[3], JS_EVAL_RANKS[4]);
}

/**
 * Fast zero-allocation 7-card evaluator.
 *
 * @param {Array<string>} cards 5, 6, or 7 card array
 * @returns {number} Maximum 5-card score combination
 */
function scoreSeven(cards) {
  if (!cards || cards.length < 5) return 0;
  if (cards.length === 5) return scoreFive(cards);

  let best = 0;
  const n = cards.length;
  if (n === 6) {
    for (let i = 0; i < 6; i++) {
      let idx = 0;
      for (let k = 0; k < 6; k++) {
        if (k !== i) JS_EVAL_5[idx++] = cards[k];
      }
      const sc = scoreFive(JS_EVAL_5);
      if (sc > best) best = sc;
    }
    return best;
  }

  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 7; j++) {
      let idx = 0;
      for (let k = 0; k < 7; k++) {
        if (k !== i && k !== j) JS_EVAL_5[idx++] = cards[k];
      }
      const sc = scoreFive(JS_EVAL_5);
      if (sc > best) best = sc;
    }
  }
  return best;
}



let equityCalculationGeneration = 0;
let equityCalculationRunning = false;
let equityProgressRevealTimer = null;
const EQUITY_PROGRESS_REVEAL_DELAY_MS = 140;

function equityRequestFromCurrentInputs() {
  const methodByControl = { auto: 'auto', exact: 'exact', sim: 'monte_carlo' };
  const seedInput = $('#equitySeed')?.value?.trim();
  const request = {
    schemaVersion: 'equity-request/v1',
    players: app.equity.players.map((player) => {
      const cards = player.cards.filter(Boolean);
      return {
        id: player.id,
        cards: player.handMode === 'unknown' ? null : cards.slice()
      };
    }),
    board: app.equity.board.filter(Boolean).slice(),
    deadCards: app.equity.dead.filter(Boolean).slice(),
    method: methodByControl[selectedValue('#calcStyle')] || 'auto',
    samples: numericValue('#trials', 10000)
  };
  if (seedInput !== undefined && seedInput !== '') request.seed = Number(seedInput);
  return request;
}

function formatEquityCombinationCount(estimate) {
  if (!estimate?.ok) return t('Unavailable');
  if (estimate.exceedsSafeInteger) {
    const digits = estimate.combinationsText;
    const leading = digits.length > 1 ? `${digits[0]}.${digits.slice(1, 3)}` : digits;
    return t('≈ {value} combinations', { value: `${leading}e+${digits.length - 1}` });
  }
  return t('{count} combinations', { count: Number(estimate.combinations).toLocaleString() });
}

function updateEquityReadiness() {
  const calculate = $('#calculate');
  const readiness = $('#equityReadiness');
  const estimateCopy = $('#equityEstimate');
  if (!calculate || !readiness) return null;

  const incompleteIndex = app.equity.players.findIndex((player) => (
    player.handMode !== 'unknown' && player.cards.filter(Boolean).length !== 2
  ));
  const seedValue = $('#equitySeed')?.value?.trim() || '';
  const seedNumber = seedValue === '' ? null : Number(seedValue);
  let state = 'ready';
  let message = t('Ready to calculate.');
  let estimate = null;

  if (incompleteIndex >= 0) {
    state = 'blocked';
    message = t('{player} is marked known and needs exactly two cards.', { player: equityPlayerLabel(incompleteIndex) });
  } else if (seedNumber !== null && (!Number.isInteger(seedNumber) || seedNumber < 0 || seedNumber > 0xffffffff)) {
    state = 'blocked';
    message = t('Seed must be a whole number from 0 through 4,294,967,295.');
  } else {
    estimate = callEquityServiceBridge('estimate', equityRequestFromCurrentInputs());
    if (estimate?.ok === false) {
      state = 'blocked';
      message = equityFailureMessage(estimate.error);
    } else if (estimate?.ok) {
      const requestedMethod = equityRequestFromCurrentInputs().method;
      if (requestedMethod === 'exact' && !estimate.exactFeasible) {
        state = 'warning';
        message = t('Exact enumeration exceeds the safe workload limit. Choose Auto or Monte Carlo.');
      } else {
        const actual = t(requestedMethod === 'auto'
          ? (estimate.exactFeasible ? 'exact enumeration' : 'Monte Carlo')
          : (requestedMethod === 'exact' ? 'exact enumeration' : 'Monte Carlo'));
        message = t('Ready · {method} · {workload}', { method: actual, workload: formatEquityCombinationCount(estimate) });
      }
    } else {
      message = t('Ready. Calculation details will be confirmed when the Equity service loads.');
    }
  }

  readiness.dataset.state = state;
  readiness.textContent = message;
  calculate.disabled = equityCalculationRunning || state === 'blocked' || state === 'warning';
  if (estimateCopy) estimateCopy.textContent = estimate?.ok
    ? t('Estimated workload: {workload}. Auto will use {method}.', {
      workload: formatEquityCombinationCount(estimate),
      method: t(estimate.exactFeasible ? 'exact enumeration' : 'Monte Carlo')
    })
    : t('Workload estimate appears when all known hands are complete.');

  const request = equityRequestFromCurrentInputs();
  if ($('#equityDetailRequested')) $('#equityDetailRequested').textContent = t(request.method === 'monte_carlo' ? 'Monte Carlo' : (request.method === 'exact' ? 'Exact' : 'Auto'));
  if ($('#equityDetailEstimate')) $('#equityDetailEstimate').textContent = estimate?.ok ? formatEquityCombinationCount(estimate) : '—';
  if ($('#equityDetailSamples')) $('#equityDetailSamples').textContent = request.samples.toLocaleString();
  if ($('#equityDetailSeed')) $('#equityDetailSeed').textContent = request.seed === undefined ? t('Generated at run time') : String(request.seed);
  if ($('#equityDetailUnknown')) $('#equityDetailUnknown').textContent = String(request.players.filter((player) => player.cards === null).length);
  if ($('#equityDetailBoard')) $('#equityDetailBoard').textContent = String(5 - request.board.length);
  return { state, message, estimate, request };
}

function setEquityCalculationRunning(running) {
  equityCalculationRunning = running;
  const calculate = $('#calculate');
  const cancel = $('#cancelEquity');
  const progress = $('#progress');
  if (calculate) calculate.disabled = running;
  if (cancel) cancel.hidden = !running;
  if (equityProgressRevealTimer !== null) {
    window.clearTimeout(equityProgressRevealTimer);
    equityProgressRevealTimer = null;
  }
  if (progress) {
    progress.hidden = true;
    if (running) {
      equityProgressRevealTimer = window.setTimeout(() => {
        equityProgressRevealTimer = null;
        if (equityCalculationRunning) progress.hidden = false;
      }, EQUITY_PROGRESS_REVEAL_DELAY_MS);
    }
  }
  if ($('#equityResultsPanel')) $('#equityResultsPanel').dataset.resultState = running ? 'running' : $('#equityResultsPanel').dataset.resultState;
  if ($('#equityDetailExecution')) $('#equityDetailExecution').textContent = running
    ? t(callEquityServiceBridge('isWorkerBacked') ? 'Web Worker' : 'In-process fallback')
    : t('Ready');
  if (!running) updateEquityReadiness();
}

function renderEquityProgress(progress) {
  app.equity.lastProgress = progress ? { ...progress } : null;
  const wrap = $('#progress');
  const fill = document.querySelector('#progress .progress-fill');
  const track = document.querySelector('#progress .progress-track');
  const method = document.querySelector('#progress .progress-method');
  const status = document.querySelector('#progress .progress-status');
  const percent = document.querySelector('#progress .progress-percent');
  const telemetry = document.querySelector('#progress .progress-telemetry');
  const determinate = progress?.mode === 'determinate';
  const isExact = progress?.method === 'exact';
  const methodLabel = t(isExact ? 'Exact calculation' : 'Monte Carlo');
  if (wrap) wrap.dataset.progressMode = determinate ? 'determinate' : 'indeterminate';
  if (method) method.textContent = methodLabel;
  if (track) {
    track.setAttribute('aria-label', t('{method} progress', { method: methodLabel }));
    if (determinate) {
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', String(Math.round(progress.percentage)));
    } else {
      track.removeAttribute('aria-valuemin');
      track.removeAttribute('aria-valuemax');
      track.removeAttribute('aria-valuenow');
    }
  }
  if (!determinate) {
    if (fill) fill.style.width = '';
    if (status) status.textContent = t('Preparing calculation…');
    if (percent) {
      percent.hidden = true;
      percent.textContent = '';
    }
    if (telemetry) {
      telemetry.hidden = true;
      telemetry.textContent = '';
    }
    return;
  }

  const fraction = Math.min(1, Math.max(0, Number(progress.fraction) || 0));
  const unit = isExact ? 'outcomes' : 'trials';
  if (fill) fill.style.width = `${fraction * 100}%`;
  if (status) status.textContent = `${Number(progress.completed).toLocaleString()} / ${Number(progress.total).toLocaleString()} ${t(unit)}`;
  if (percent) {
    percent.hidden = false;
    percent.textContent = `${Math.round(progress.percentage)}%`;
  }
  if (telemetry) {
    const details = [];
    if (!isExact && Number.isFinite(progress.throughputPerSecond)) {
      details.push(t('{rate} trials/s', { rate: formatEquityThroughput(progress.throughputPerSecond) }));
    }
    if (!isExact && Number.isFinite(progress.etaSeconds)) {
      details.push(t('{duration} remaining', { duration: formatEquityDuration(progress.etaSeconds) }));
    }
    telemetry.hidden = details.length === 0;
    telemetry.textContent = details.join(' · ');
  }
}

function formatEquityThroughput(rate) {
  if (!Number.isFinite(rate) || rate <= 0) return '';
  if (rate >= 1000) {
    const thousands = rate / 1000;
    return `~${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k`;
  }
  return `~${Math.max(1, Math.round(rate))}`;
}

function formatEquityDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 1) return '<1s';
  const rounded = Math.max(1, Math.round(seconds));
  if (rounded < 60) return `~${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder ? `~${minutes}m ${remainder}s` : `~${minutes}m`;
}

function equityFailureMessage(error) {
  if (!error) return t('Equity calculation failed.');
  const messages = {
    invalid_request: t('Complete each known hand with exactly two valid cards.'),
    duplicate_card: t('That card is already in use.'),
    impossible_deck: t('Not enough unseen cards remain for this setup.'),
    exact_limit_exceeded: t('This exact calculation is too large. Use Auto or Monte Carlo.'),
    aborted: t('Equity calculation cancelled.'),
    internal_error: t('The Equity service could not complete this calculation.')
  };
  return messages[error.code] || t('Equity calculation failed.');
}

async function calculateEquity() {
  const readiness = updateEquityReadiness();
  if (!readiness || readiness.state !== 'ready') {
    if (readiness?.message) toast(readiness.message, 'warning');
    return null;
  }
  const generation = ++equityCalculationGeneration;
  const request = readiness.request;
  app.equity.lifecycle = 'running';
  app.equity.lastRequest = structuredClone(request);
  app.equity.lastResult = null;
  app.equity.lastError = null;
  const calculation = callEquityServiceBridge('calculate', request, {
    onProgress(progress) {
      if (generation === equityCalculationGeneration) renderEquityProgress(progress);
    }
  });
  if (!calculation || typeof calculation.then !== 'function') {
    app.equity.lifecycle = 'error';
    return toast(t('The canonical Equity service is unavailable.'), 'error');
  }

  clearEquityResults('running', t('Calculating conditional equity…'));
  setEquityCalculationRunning(true);
  $('#methodBadge').textContent = t('RUNNING');
  const response = await calculation;
  if (generation !== equityCalculationGeneration) return response;
  setEquityCalculationRunning(false);

  if (response?.ok === false) {
    app.equity.lifecycle = response.error.code === 'aborted' ? 'cancelled' : 'error';
    app.equity.lastError = response.error;
    const message = equityFailureMessage(response.error);
    $('#equityStatus').textContent = message;
    $('#methodBadge').textContent = t(response.error.code === 'aborted' ? 'CANCELLED' : 'ERROR');
    $('#equityResultsPanel').dataset.resultState = response.error.code === 'aborted' ? 'empty' : 'error';
    toast(message, response.error.code === 'aborted' ? 'info' : 'warning');
    return response;
  }
  renderEquityResult(response, request);
  return response;
}

function cancelEquityCalculation() {
  if (!callEquityServiceBridge('cancel')) return false;
  equityCalculationGeneration += 1;
  setEquityCalculationRunning(false);
  app.equity.lifecycle = 'cancelled';
  app.equity.lastError = { code: 'aborted' };
  $('#equityStatus').textContent = t('Equity calculation cancelled.');
  $('#methodBadge').textContent = t('CANCELLED');
  if ($('#equityResultsPanel')) $('#equityResultsPanel').dataset.resultState = 'empty';
  return true;
}

function equityStreetLabel(boardCount) {
  const labels = { 0: 'Preflop', 3: 'Flop', 4: 'Turn', 5: 'River' };
  return labels[boardCount] ? t(labels[boardCount]) : t('Partial board · {count} / 5 cards', { count: boardCount });
}

function equityReadOnlyCardsMarkup(cards, label) {
  if (cards === null) {
    return `<span class="equity-result-unknown" aria-label="${t('{player}: unknown hand', { player: label })}"><span class="poker-card-back riverline-card-back" aria-hidden="true"></span><span class="poker-card-back riverline-card-back" aria-hidden="true"></span><span>${t('Unknown hand')}</span></span>`;
  }
  if (!cards?.length) return `<span class="equity-context-empty">${t('No cards')}</span>`;
  return `<span class="equity-readonly-cards">${cards.map((card) => `<span class="training-readonly-card riverline-card" role="img" aria-label="${displayCard(card)}">${cardMarkup(card)}</span>`).join('')}</span>`;
}

function renderEquityScenarioContext(request = equityRequestFromCurrentInputs()) {
  const root = $('#equityScenarioContext');
  if (!root) return;
  const board = request.board || [];
  const handRows = request.players.map((player, index) => {
    const label = equityPlayerLabel(index);
    return `<div class="equity-context-row"><span class="equity-context-label">${label}</span>${equityReadOnlyCardsMarkup(player.cards, label)}</div>`;
  }).join('');
  const boardMarkup = board.length
    ? equityReadOnlyCardsMarkup(board, t('Board'))
    : `<span class="equity-context-empty">${t('No board cards')}</span>`;
  const deadMarkup = request.deadCards?.length
    ? `<div class="equity-context-row equity-context-row--dead"><span class="equity-context-label">${t('Dead')}</span>${equityReadOnlyCardsMarkup(request.deadCards, t('Dead cards'))}</div>`
    : '';
  root.innerHTML = `
    <div class="equity-context-street"><span>${t('Street')}</span><strong>${equityStreetLabel(board.length)}</strong></div>
    <div class="equity-context-hands">${handRows}</div>
    <div class="equity-context-row"><span class="equity-context-label">${t('Board')}</span>${boardMarkup}</div>
    ${deadMarkup}`;
}

function equityResultCardMarkup(player, index, requestPlayer) {
  const hasResult = Number.isFinite(player?.equity);
  const name = player?.name || equityPlayerLabel(index);
  const equity = hasResult ? `${player.equity.toFixed(1)}%` : '—';
  const win = Number.isFinite(player?.win) ? `${player.win.toFixed(1)}%` : '—';
  const tie = Number.isFinite(player?.tie) ? `${player.tie.toFixed(1)}%` : '—';
  const hand = requestPlayer?.cards === null ? null : (requestPlayer?.cards || []);
  const ariaValue = hasResult ? player.equity.toFixed(1) : '0';
  return `
    <article class="equity-result-card" data-player-series="${index}">
      <header class="equity-result-player">
        <span class="equity-result-identity"><i class="series-marker" aria-hidden="true"></i><strong>${name}</strong></span>
        ${equityReadOnlyCardsMarkup(hand, name)}
      </header>
      <div class="equity-result-metrics">
        <div class="equity-result-primary"><span>${t('Equity')}</span><strong class="poker-data-token">${equity}</strong></div>
        <div><span>${t('Win')}</span><strong class="poker-data-token">${win}</strong></div>
        <div><span>${t('Tie')}</span><strong class="poker-data-token">${tie}</strong></div>
      </div>
      <div class="eqbar" role="progressbar" aria-label="${t('{player} equity', { player: name })}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ariaValue}"><div class="eqfill player-series" style="width:${hasResult ? player.equity : 0}%"></div></div>
    </article>`;
}

function clearEquityResults(state = 'empty', status = t('Results update after calculation.')) {
  const panel = $('#equityResultsPanel');
  if (panel) panel.dataset.resultState = state;
  if ($('#headlineEquity')) $('#headlineEquity').textContent = '—';
  if ($('#equityStatus')) $('#equityStatus').textContent = status;
  if ($('#equitySplitSummary')) $('#equitySplitSummary').textContent = '—';
  if ($('#equityDetailActual')) $('#equityDetailActual').textContent = '—';
  if ($('#equityBars')) {
    $('#equityBars').innerHTML = app.equity.players.map((player, index) => equityResultCardMarkup(
      { name: equityPlayerLabel(index) },
      index,
      { cards: player.handMode === 'unknown' ? null : player.cards.filter(Boolean) },
    )).join('');
  }
  renderEquityScenarioContext();
}

function renderEquityResult(equityResult, request = equityRequestFromCurrentInputs(), { announce = true } = {}) {
  app.equity.lifecycle = 'complete';
  app.equity.lastResult = equityResult;
  app.equity.lastRequest = structuredClone(request);
  app.equity.lastError = null;
  const namesById = new Map(app.equity.players.map((player, index) => [player.id, equityPlayerLabel(index)]));
  const requestById = new Map(request.players.map((player) => [player.id, player]));
  const result = equityResult.players.map((player) => ({
    id: player.id,
    name: namesById.get(player.id) || player.id,
    win: player.winProbability * 100,
    tie: player.tieProbability * 100,
    equity: player.equity * 100
  }));
  const exact = equityResult.exact;
  const total = equityResult.trials;
  const splitRate = equityResult.metadata.splitPotTrials / total * 100;
  const leadingEquity = Math.max(...result.map((player) => player.equity));
  const requestedLabel = t(request.method === 'auto' ? 'AUTO' : (request.method === 'exact' ? 'EXACT' : 'MONTE CARLO'));
  const actualLabel = t(exact ? 'EXACT' : 'MONTE CARLO');

  const leaders = result.filter((player) => Math.abs(player.equity - leadingEquity) < 0.05);
  $('#headlineEquity').textContent = leaders.length === 1
    ? t('{player} leads', { player: leaders[0].name })
    : t('{count}-way equity tie', { count: leaders.length });

  $('#equityStatus').textContent = exact
    ? t('Exact enumeration · {count} outcomes', { count: total.toLocaleString() })
    : t('Monte Carlo · {count} trials', { count: total.toLocaleString() });

  $('#methodBadge').textContent = request.method === 'auto' ? `${requestedLabel} → ${actualLabel}` : actualLabel;

  $('#equityBars').innerHTML = result.map((player, index) => equityResultCardMarkup(
    player,
    index,
    requestById.get(player.id),
  )).join('');
  renderEquityScenarioContext(request);

  if ($('#equityResultsPanel')) $('#equityResultsPanel').dataset.resultState = 'complete';
  if ($('#equitySplitSummary')) $('#equitySplitSummary').textContent = `${equityResult.metadata.splitPotTrials.toLocaleString()} · ${splitRate.toFixed(1)}%`;
  if ($('#equityDetailActual')) $('#equityDetailActual').textContent = t(exact ? 'Exact enumeration' : 'Monte Carlo simulation');
  if ($('#equityDetailEstimate')) $('#equityDetailEstimate').textContent = t('{count} combinations', { count: equityResult.metadata.estimatedCombinationsText });
  if ($('#equityDetailSamples')) $('#equityDetailSamples').textContent = exact ? t('Not applicable') : equityResult.metadata.samplesCompleted.toLocaleString();
  if ($('#equityDetailSeed')) $('#equityDetailSeed').textContent = exact ? t('Not applicable') : String(equityResult.metadata.seed);
  if ($('#equityDetailUnknown')) $('#equityDetailUnknown').textContent = String(equityResult.metadata.unknownPlayers);
  if ($('#equityDetailBoard')) $('#equityDetailBoard').textContent = String(equityResult.metadata.boardCardsMissing);
  if ($('#equityDetailExecution')) $('#equityDetailExecution').textContent = t(callEquityServiceBridge('isWorkerBacked') ? 'Web Worker' : 'In-process fallback');
  if (announce) toast(t('Win probability updated'), 'success');

  // === OUTS CALCULATION (per-player, shown inline beside each player's cards) ===
  // Available on Flop (3 cards) or Turn (4 cards) when both player hands are known
    (function renderAllOuts() {
    const board = app.equity.board.filter(Boolean);
    const deadCards = app.equity.dead || [];
    const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };

    app.equity.players.forEach((player, playerIndex) => {
      const panel   = document.getElementById(`outsPanel-${playerIndex}`);
      const countEl = document.getElementById(`outsCount-${playerIndex}`);
      const summEl  = document.getElementById(`outsSummary-${playerIndex}`);
      const cardsEl = document.getElementById(`outsCards-${playerIndex}`);
      if (!panel) return;

      const myCards = player.cards.filter(Boolean);

      if (myCards.length !== 2 || board.length < 3 || board.length > 4) {
        panel.style.display = 'none';
        return;
      }

      // Collect ALL opponents who have 2 known cards
      const allOpponentsCards = [];
      app.equity.players.forEach((p, i) => {
        if (i !== playerIndex) {
          const c = p.cards.filter(Boolean);
          if (c.length === 2) allOpponentsCards.push(c);
        }
      });

      if (allOpponentsCards.length === 0) { panel.style.display = 'none'; return; }

      const outsResult = calculateOuts(myCards, allOpponentsCards, board, deadCards);

      if (!outsResult) { panel.style.display = 'none'; return; }

      panel.style.display = 'grid';

      if (outsResult.ahead) {
        panel.dataset.outsState = 'ahead';
        if (countEl) countEl.textContent = t('Ahead');
        if (summEl)  summEl.textContent = t('Currently winning — no outs needed.');
        if (cardsEl) cardsEl.innerHTML = '';
      } else if (outsResult.count === 0) {
        panel.dataset.outsState = 'drawing-dead';
        if (countEl) countEl.textContent = t('0 total');
        if (summEl)  summEl.textContent = t('No outs — drawing dead.');
        if (cardsEl) cardsEl.innerHTML = '';
      } else {
        panel.dataset.outsState = 'drawing';
        if (countEl) countEl.textContent = t('{count} total', { count: outsResult.count });
        if (summEl) summEl.textContent = t('Cards that improve this hand against the entered known opponents.');
        if (cardsEl) {
          let html = '';
          outsResult.categories.forEach(cat => {
            html += '<div class="outs-group">';
            html += `<div class="outs-group-head"><strong>${t(cat.name)}</strong><span>${t(cat.cards.length === 1 ? '{count} out' : '{count} outs', { count: cat.cards.length })}</span></div>`;
            html += '<div class="outs-card-list">';
            html += cat.cards.map(card => {
              const rank = displayCardRank(card[0]), suit = card[1];
              const label = displayCard(card);
              return `<span class="outs-card riverline-card card--suit-${suit}" role="img" aria-label="${label}"><strong>${rank}</strong><span aria-hidden="true">${suitSymbols[suit] || suit}</span></span>`;
            }).join('');
            html += '</div></div>';
          });
          cardsEl.innerHTML = html;
        }
      }
    });
  })();

}



function setEquityPending() {
  callEquityServiceBridge('cancel');
  equityCalculationGeneration += 1;
  setEquityCalculationRunning(false);
  app.equity.lifecycle = 'pending';
  app.equity.lastRequest = null;
  app.equity.lastResult = null;
  app.equity.lastProgress = null;
  app.equity.lastError = null;
  clearEquityResults('empty', t('Inputs changed. Calculate to refresh the result.'));
  if ($('#methodBadge')) $('#methodBadge').textContent = t('AWAITING CALCULATION');
  updateEquityReadiness();
}

function resetEquityCalculator() {
  callEquityServiceBridge('cancel');
  equityCalculationGeneration += 1;
  app.equity.board = [];
  app.equity.dead = [];
  app.equity.nextPlayerId = 2;
  app.equity.players = [
    { id: 'equity-player-0', name: 'Hero', cards: [], handMode: 'known' },
    { id: 'equity-player-1', name: 'Opponent 1', cards: [], handMode: 'unknown' }
  ];
  if ($('#calcStyle')) $('#calcStyle').value = 'auto';
  if ($('#trials')) $('#trials').value = '10000';
  if ($('#equitySeed')) $('#equitySeed').value = '';
  setEquityCalculationRunning(false);
  renderAllCards();
  app.equity.lifecycle = 'idle';
  app.equity.lastRequest = null;
  app.equity.lastResult = null;
  app.equity.lastProgress = null;
  app.equity.lastError = null;
  clearEquityResults('empty', t('Results update after calculation.'));
  if ($('#methodBadge')) $('#methodBadge').textContent = t('AWAITING INPUT');
  updateEquityReadiness();
}



// ---------------------------------------------------------------------------

// UI utilities and event wiring

// ---------------------------------------------------------------------------



function syncSliderPair(rangeId, numberId) {

  const range = $('#' + rangeId);

  const number = $('#' + numberId);

  if (!range || !number) return;

  if (document.activeElement === number) {

    const value = Math.min(Number(range.max), Math.max(Number(range.min), Number(number.value) || Number(range.min)));

    range.value = value;

    number.value = value;

  } else {

    number.value = range.value;

  }

}



function bindSliderPair(rangeId, numberId, callback) {

  const range = $('#' + rangeId);

  const number = $('#' + numberId);

  const { onInput, onChange = onInput } = callback || {};

  if (!range || !number || typeof onInput !== 'function') return;

  range.addEventListener('input', () => {

    number.value = range.value;

    onInput();

  });

  number.addEventListener('input', () => {

    syncSliderPair(rangeId, numberId);

    onInput();

  });

  range.addEventListener('change', () => {
    number.value = range.value;
    onChange();
  });

  number.addEventListener('change', () => {
    syncSliderPair(rangeId, numberId);
    onChange();
  });

}

let homeViewModel = null;
let homeRefreshSequence = 0;
let homeRefreshTimer = null;
let activeSavedSpotContext = null;

function navigateToWorkspace(mode) {
  document.querySelector(`.mode-nav-item[data-mode="${mode}"]`)?.click();
}

async function returnToHomeLiveHand() {
  activeSavedSpotContext = null;
  renderSavedSpotViewer(null);
  callPlaybookStateBridge('closeSavedHand');
  navigateToWorkspace('gto');
  await requestPlaybookMode(PLAYBOOK_MODES.HAND);
  renderCanonicalHandWorkspace();
  await updateContext('Returned to live hand');
}

function homeEmptyState(messageKey, error = false) {
  const message = document.createElement('p');
  message.className = error ? 'home-error-state' : 'home-empty-state';
  message.textContent = t(messageKey);
  return message;
}

function homeEmptyAction(messageKey, actionKey, destination) {
  const root = document.createElement('div');
  root.className = 'home-empty-state';
  const message = document.createElement('p');
  message.textContent = t(messageKey);
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'ui-button ui-button--quiet';
  action.dataset.homeDestination = destination;
  action.textContent = t(actionKey);
  root.append(message, action);
  return root;
}

function homeRecency(isoTimestamp) {
  const timestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestamp)) return '';
  const elapsedDays = Math.round((timestamp - Date.now()) / 86400000);
  try {
    if (Math.abs(elapsedDays) <= 7) {
      return new Intl.RelativeTimeFormat(window.appLang || 'en', { numeric: 'auto' })
        .format(elapsedDays, 'day');
    }
    return new Intl.DateTimeFormat(window.appLang || 'en', {
      year: 'numeric', month: 'short', day: 'numeric'
    }).format(new Date(timestamp));
  } catch (_) {
    return new Date(timestamp).toLocaleDateString();
  }
}

function homeSavedItemTitle(item) {
  if (item.title) return item.title;
  const kind = item.kind === 'hand' ? t('Saved Hand') : t('Saved Spot');
  const facts = [item.heroPosition, item.street && t(item.street[0].toUpperCase() + item.street.slice(1))]
    .filter(Boolean);
  return facts.length ? `${kind} · ${facts.join(' · ')}` : kind;
}

function homeSavedItemFacts(item) {
  const facts = [];
  if (Number.isInteger(item.tableSize)) facts.push(t('{count}-handed', { count: item.tableSize }));
  if (item.heroPosition) facts.push(item.heroPosition);
  if (item.street) facts.push(t(item.street[0].toUpperCase() + item.street.slice(1)));
  if (Number.isFinite(item.stackBb)) facts.push(`${item.stackBb} bb`);
  if (Number.isFinite(item.potBb)) facts.push(`${t('Pot')} ${item.potBb} bb`);
  if (item.kind === 'spot') {
    facts.push(item.derivation === 'scenario' ? t('Scenario') : t('Hand-derived'));
  }
  const recency = homeRecency(item.updatedAt);
  if (recency) facts.push(recency);
  return facts;
}

function createHomeSavedItemElement(item, { compact = false } = {}) {
  const row = document.createElement('article');
  row.className = 'home-saved-item';
  const main = document.createElement('div');
  main.className = 'home-saved-item-main';
  const titleRow = document.createElement('div');
  titleRow.className = 'home-saved-item-title-row';
  const kind = document.createElement('span');
  kind.className = 'home-saved-item-kind';
  kind.textContent = t(item.kind === 'hand' ? 'Saved Hand' : 'Saved Spot');
  const title = document.createElement('strong');
  title.dir = 'auto';
  title.textContent = homeSavedItemTitle(item);
  titleRow.append(kind, title);
  main.appendChild(titleRow);

  const meta = document.createElement('div');
  meta.className = 'home-saved-item-meta poker-data-token';
  meta.dir = 'ltr';
  homeSavedItemFacts(item).forEach((fact) => {
    const token = document.createElement('span');
    token.textContent = fact;
    meta.appendChild(token);
  });
  main.appendChild(meta);

  const badges = document.createElement('div');
  badges.className = 'home-saved-item-badges';
  if (item.hasNote) {
    const note = document.createElement('span');
    note.className = 'home-saved-badge';
    note.textContent = t('Note');
    badges.appendChild(note);
  }
  if (item.reviewState === 'review_later') {
    const review = document.createElement('span');
    review.className = 'home-saved-badge home-saved-badge--review';
    review.textContent = t('Review later');
    badges.appendChild(review);
  }
  if (item.isMistake) {
    const mistake = document.createElement('span');
    mistake.className = 'home-saved-badge home-saved-badge--mistake';
    mistake.textContent = t('Mistake');
    badges.appendChild(mistake);
  }
  if (item.tags.length > 0) {
    const tags = document.createElement('span');
    tags.className = 'home-saved-badge';
    tags.dir = 'auto';
    tags.textContent = item.tags.slice(0, 2).join(' · ');
    badges.appendChild(tags);
  }
  if (badges.childElementCount > 0) main.appendChild(badges);

  const open = document.createElement('button');
  open.type = 'button';
  open.className = `ui-button ${compact ? 'ui-button--quiet' : 'ui-button--secondary'} home-open-button`;
  open.dataset.homeSavedId = item.id;
  const action = t(item.kind === 'hand' ? 'Open replay' : 'Open spot');
  open.textContent = action;
  open.setAttribute('aria-label', `${action}: ${homeSavedItemTitle(item)}`);
  row.append(main, open);
  return row;
}

function renderHomeContinue(section) {
  const root = $('#homeContinueContent');
  if (!root) return;
  root.replaceChildren();
  if (!section?.items?.length) {
    root.appendChild(homeEmptyState('Nothing to continue right now.'));
    return;
  }
  const list = document.createElement('div');
  list.className = 'home-continue-list';
  section.items.forEach((item) => {
    const card = document.createElement('div');
    card.className = item.kind === 'live_hand'
      ? 'home-calibration-card home-live-hand-card'
      : 'home-calibration-card';
    const title = document.createElement('strong');
    title.textContent = t(item.kind === 'live_hand' ? 'Live Hand' : 'Range Calibration');
    const context = document.createElement('p');
    context.dir = 'auto';
    if (item.kind === 'live_hand') {
      context.textContent = t('Your current in-memory hand is ready to continue.');
    } else {
      const facts = [item.profileName, item.modeName];
      if (Number.isInteger(item.context?.tableSize)) {
        facts.push(t('{count}-handed', { count: item.context.tableSize }));
      }
      context.textContent = facts.join(' · ');
    }
    const progress = document.createElement('p');
    if (item.kind === 'range_calibration') {
      progress.textContent = t('{answered} of {total} directly answered', {
        answered: item.answeredCount, total: item.totalCount
      });
    }
    const actions = document.createElement('div');
    actions.className = 'home-calibration-actions';
    const resume = document.createElement('button');
    resume.type = 'button';
    resume.className = 'ui-button ui-button--primary';
    if (item.kind === 'live_hand') resume.dataset.homeAction = 'return-live-hand';
    else resume.dataset.homeDestination = 'calibration';
    resume.textContent = t(item.kind === 'live_hand' ? 'Return to live hand' : 'Resume calibration');
    actions.appendChild(resume);
    card.append(title, context);
    if (progress.textContent) card.appendChild(progress);
    card.appendChild(actions);
    list.appendChild(card);
  });
  root.appendChild(list);
}

function renderHomeRecent(section) {
  const root = $('#homeRecentContent');
  if (!root) return;
  root.replaceChildren();
  if (section?.status === 'error') {
    root.appendChild(homeEmptyState('Saved items could not be loaded.', true));
    return;
  }
  if (!section?.items?.length) {
    root.appendChild(homeEmptyAction('No saved study yet.', 'Analyze a Hand', 'gto'));
    return;
  }
  section.items.forEach((item) => root.appendChild(createHomeSavedItemElement(item)));
}

function renderHomeReviewGroup(root, titleKey, section, emptyKey) {
  const group = document.createElement('section');
  group.className = 'home-review-group';
  const heading = document.createElement('h3');
  heading.textContent = t(titleKey);
  const list = document.createElement('div');
  list.className = 'home-review-list';
  if (section?.status === 'error') list.appendChild(homeEmptyState('Saved items could not be loaded.', true));
  else if (!section?.items?.length) list.appendChild(homeEmptyAction(emptyKey, 'Start Training', 'training'));
  else section.items.forEach((item) => list.appendChild(createHomeSavedItemElement(item, { compact: true })));
  group.append(heading, list);
  root.appendChild(group);
}

function renderHomeReview(section) {
  const root = $('#homeReviewContent');
  if (!root) return;
  root.replaceChildren();
  renderHomeReviewGroup(root, 'Review later', section?.reviewLater, 'Nothing marked for review.');
  renderHomeReviewGroup(root, 'Mistake', section?.mistakes, 'No mistakes marked.');
}

function renderHomePersonalStrategy(section) {
  const root = $('#homeStrategyContent');
  if (!root) return;
  root.replaceChildren();
  if (section?.status === 'error') {
    root.appendChild(homeEmptyState('Personal Strategy could not be loaded.', true));
    return;
  }
  const card = document.createElement('div');
  card.className = 'home-strategy-summary';
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'ui-button ui-button--secondary';
  action.dataset.homeDestination = 'calibration';
  if (!section?.selectedProfile) {
    const empty = document.createElement('p');
    empty.textContent = t(section?.profileCount > 0
      ? 'Open Personal Strategy to choose a profile.'
      : 'Create a profile to start building your ranges.');
    action.textContent = t(section?.profileCount > 0
      ? 'Open Range Calibration'
      : 'Create your first strategy profile');
    card.append(empty, action);
    root.appendChild(card);
    return;
  }
  const title = document.createElement('strong');
  title.dir = 'auto';
  title.textContent = `${section.selectedProfile.displayName} · ${section.selectedMode.displayName}`;
  const progress = document.createElement('p');
  progress.textContent = t('{answered} of {total} directly answered', {
    answered: section.answeredCount, total: section.totalCount
  });
  const facts = document.createElement('div');
  facts.className = 'home-strategy-facts';
  const factValues = [
    t('{count} strategy profiles', { count: section.profileCount }),
    t('{count} direct evidence records', { count: section.directEvidenceCount })
  ];
  factValues.forEach((value) => {
    const fact = document.createElement('span');
    fact.className = 'home-strategy-fact';
    fact.textContent = value;
    facts.appendChild(fact);
  });
  if (section.contradictionCount > 0) {
    const contradiction = document.createElement('span');
    contradiction.className = 'home-strategy-fact home-strategy-fact--warning';
    contradiction.textContent = t('{count} contradictory evidence records', {
      count: section.contradictionCount
    });
    facts.appendChild(contradiction);
  }
  action.textContent = t(section.resumable ? 'Resume calibration' : 'Open Range Calibration');
  card.append(title, progress, facts, action);
  root.appendChild(card);
}

function homeSyncCopy(sync) {
  if (sync?.status === 'error') return ['Sync issue', 'Study data remains available on this device.'];
  if (!sync || sync.status === 'unavailable') return ['Saved on this device', 'Cloud study sync is unavailable.'];
  if (sync.state === 'conflict') return ['Conflict needs attention', '{count} conflicts need review.'];
  if (sync.state === 'error') return ['Sync issue', 'Study data remains available on this device.'];
  if (sync.state === 'syncing') return ['Syncing', 'Updating your enabled study domains.'];
  if (sync.state === 'offline') {
    return sync.pendingCount > 0
      ? ['Offline', '{count} changes waiting. They will sync when Riverline is online.']
      : ['Offline', 'Study data remains available on this device.'];
  }
  if (sync.state === 'synced') return ['Synced', 'Enabled study data is up to date.'];
  if (sync.state === 'auth_paused') return ['Sync paused', 'Sign in again to continue study sync.'];
  return ['Saved on this device', 'Cloud study sync is not enabled.'];
}

function renderHomeAccountOverview(model) {
  const overview = $('#homeAccountOverview');
  if (!overview) return;
  const guest = model.sessionMode === 'guest';
  overview.hidden = guest;
  if (guest) return;
  const profile = model.identity?.profile;
  const displayName = $('#homeIdentityDisplayName');
  const username = $('#homeIdentityUsername');
  displayName.textContent = profile?.displayName || t('Riverline player');
  username.textContent = profile?.username ? `@${profile.username}` : '';
  username.hidden = !profile?.username;
  const syncRoot = $('#homeSyncStatus');
  const [labelKey, detailKey] = homeSyncCopy(model.sync);
  syncRoot.dataset.state = model.sync?.state || 'unavailable';
  $('#homeSyncStatusLabel').textContent = t(labelKey);
  $('#homeSyncStatusDetail').textContent = t(detailKey, {
    count: model.sync?.conflictCount || model.sync?.pendingCount || 0
  });
  $('#homeSyncReview').hidden = !['conflict', 'error'].includes(model.sync?.state);
}

function renderHomeQuickStart(model) {
  const allowed = new Set(model.sections.quickStart?.destinations || []);
  document.querySelectorAll('[data-home-destination]').forEach((control) => {
    const destination = control.dataset.homeDestination;
    if (!['gto', 'training', 'equity', 'calibration', 'review_mistakes'].includes(destination)) return;
    if (!control.closest('.home-quick-links')) return;
    control.hidden = !allowed.has(destination);
  });
  const guest = model.sessionMode === 'guest';
  const playbookLabel = document.querySelector('.home-quick-link[data-home-destination="gto"] strong');
  const trainingLabel = document.querySelector('.home-quick-link[data-home-destination="training"] strong');
  if (playbookLabel) {
    const key = guest ? 'Playbook' : 'Analyze a Hand';
    playbookLabel.dataset.i18n = key;
    playbookLabel.textContent = t(key);
  }
  if (trainingLabel) {
    const key = guest ? 'Training' : 'Train';
    trainingLabel.dataset.i18n = key;
    trainingLabel.textContent = t(key);
  }
}

function renderHomeWorkspace(model) {
  homeViewModel = model;
  const guest = model.sessionMode === 'guest';
  const restricted = [
    $('#homeReviewContent')?.closest('.home-section'),
    $('#homeRecentContent')?.closest('.home-section'),
    $('#homeStrategyContent')?.closest('.home-section')
  ];
  restricted.forEach((section) => { if (section) section.hidden = guest; });
  const guestAccount = $('#homeGuestAccount');
  if (guestAccount) guestAccount.hidden = !guest;
  renderHomeAccountOverview(model);
  const subtitle = $('#workspaceSubtitle');
  if (activeWorkspaceMode() === 'home' && subtitle) {
    const subtitleKey = guest
      ? 'Analyze and train without saving account history.'
      : 'Your saved study, review queue, and next useful action.';
    subtitle.dataset.i18n = subtitleKey;
    subtitle.textContent = t(subtitleKey);
  }
  renderHomeQuickStart(model);
  renderHomeContinue(model.sections.continue);
  if (!guest) {
    renderHomeRecent(model.sections.recent);
    renderHomeReview(model.sections.review);
    renderHomePersonalStrategy(model.sections.personalStrategy);
  }
  const workspace = $('#homeWorkspace');
  const loading = $('#homeLoadingState');
  const content = $('#homeWorkspaceContent');
  if (content) content.dataset.sessionMode = guest ? 'guest' : 'account';
  if (content) content.dataset.hasContinuation = String(Boolean(model.sections.continue?.items?.length));
  const continueSection = $('#homeContinueContent')?.closest('.home-section');
  if (continueSection) continueSection.hidden = guest && !model.sections.continue?.items?.length;
  if (workspace) workspace.setAttribute('aria-busy', 'false');
  if (loading) loading.hidden = true;
  if (content) content.hidden = false;
  window.RiverlineTutorials?.offerForWorkspace?.('home', workspace);
}

function beginHomeLoading() {
  const workspace = $('#homeWorkspace');
  const loading = $('#homeLoadingState');
  const content = $('#homeWorkspaceContent');
  if (workspace) workspace.setAttribute('aria-busy', 'true');
  if (loading) loading.hidden = false;
  if (content) content.hidden = true;
}

async function refreshHomeWorkspace() {
  const sequence = ++homeRefreshSequence;
  beginHomeLoading();
  try {
    const model = await callHomeBridge('load');
    if (sequence !== homeRefreshSequence || activeWorkspaceMode() !== 'home') return;
    renderHomeWorkspace(model);
  } catch (error) {
    if (sequence !== homeRefreshSequence) return;
    console.error('[Riverline Home]', error);
    const fallback = {
      sections: {
        continue: { status: 'ready', items: [] },
        recent: { status: 'error' },
        review: { reviewLater: { status: 'error' }, mistakes: { status: 'error' } },
        personalStrategy: { status: 'error' }
      }
    };
    renderHomeWorkspace(fallback);
  }
}

function scheduleHomeRefresh({ clearPrivateState = false } = {}) {
  homeViewModel = null;
  if (activeWorkspaceMode() !== 'home') return;
  if (clearPrivateState) beginHomeLoading();
  if (homeRefreshTimer !== null) window.clearTimeout(homeRefreshTimer);
  homeRefreshTimer = window.setTimeout(() => {
    homeRefreshTimer = null;
    void refreshHomeWorkspace();
  }, 80);
}

function restoreSavedSpotPresentation(result) {
  const source = result.scenarioInput || result.decisionContext;
  const context = result.decisionContext;
  const rulesDefinition = result.scenarioInput?.rulesSnapshot?.definition
    || result.object?.payload?.rulesSnapshot?.definition
    || null;
  const values = {
    players: source.tableSize,
    playersNum: source.tableSize,
    stack: source.stackBb,
    stackNum: source.stackBb,
    stackMode: source.stackMode,
    rakeMode: source.rakeMode ?? context.rakeMode,
    ante: source.anteBb ?? (rulesDefinition?.ante?.amountMilliBb ?? 0) / 1000,
    anteNum: source.anteBb ?? (rulesDefinition?.ante?.amountMilliBb ?? 0) / 1000,
    straddle: source.straddleBb ?? 0,
    lastAction: source.lastAction,
    facingSize: source.facingSizeBb,
    facingSizeNum: source.facingSizeBb,
    potSize: source.potBb,
    potSizeNum: source.potBb,
  };
  Object.entries(values).forEach(([id, value]) => {
    const control = $('#' + id);
    if (control && value !== undefined && value !== null) control.value = String(value);
  });
  updatePositions();
  if ($('#heroPos')) $('#heroPos').value = context.heroPosition;
  app.gto.hero = normalizedDecisionCards(context.heroCards);
  app.gto.board = normalizedDecisionCards(context.board);
  app.gto.dead = normalizedDecisionCards(context.deadCards);
  renderAllCards({ mode: 'gto' });
}

function renderSavedSpotViewer(result = activeSavedSpotContext) {
  const banner = $('#savedSpotViewerBanner');
  if (!banner) return;
  banner.hidden = !result;
  if (!result) return;
  const title = result.object.annotations.title || t('Saved study spot');
  $('#savedSpotViewerTitle').textContent = title;
  $('#savedSpotViewerTruth').textContent = t(result.derivation === 'scenario'
    ? 'Scenario-derived · history unavailable'
    : 'Hand-derived · canonical decision context; history unavailable');
}

async function openHomeSavedItem(id, control) {
  if (!id || control?.disabled) return;
  if (control) {
    control.disabled = true;
    control.setAttribute('aria-busy', 'true');
  }
  try {
    const result = await callHomeBridge('openSavedItem', id);
    if (result.kind === 'hand') {
      activeSavedSpotContext = null;
      renderSavedSpotViewer(null);
      app.playbookMode = PLAYBOOK_MODES.HAND;
      app.playbookResolution = {
        schemaVersion: 'playbook-decision-resolution/v1',
        mode: PLAYBOOK_MODES.HAND,
        status: 'unavailable',
        reason: 'saved_hand_read_only',
        error: null,
        decisionContext: null
      };
      app.decisionContext = null;
      app.strategyResult = null;
      setPlaybookControlAuthority(PLAYBOOK_MODES.HAND);
      renderUnavailableStrategy(app.playbookResolution);
      navigateToWorkspace('gto');
      renderCanonicalHandWorkspace();
      return;
    }

    callPlaybookStateBridge('setMode', PLAYBOOK_MODES.SCENARIO, result.scenarioInput || {});
    app.playbookMode = PLAYBOOK_MODES.SCENARIO;
    setPlaybookControlAuthority(PLAYBOOK_MODES.SCENARIO);
    restoreSavedSpotPresentation(result);
    activeSavedSpotContext = result;
    renderSavedSpotViewer(result);
    navigateToWorkspace('gto');
    await updateContext('Saved spot opened', {
      schemaVersion: 'playbook-decision-resolution/v1',
      mode: PLAYBOOK_MODES.SCENARIO,
      status: 'available',
      reason: result.derivation === 'scenario' ? 'saved_scenario_spot' : 'saved_hand_derived_spot',
      error: null,
      decisionContext: result.decisionContext
    });
  } catch (error) {
    console.error('[Riverline Home saved item]', error);
    toast(t('Saved item could not be opened.'), 'error', 'home');
  } finally {
    if (control?.isConnected) {
      control.disabled = false;
      control.removeAttribute('aria-busy');
    }
  }
}



function applyDeckStyle(is4Color) {
  if (typeof is4Color === 'string') is4Color = (is4Color === '4-color' || is4Color === 'true');
  app.settings.fourColorDeck = is4Color;
  localStorage.setItem('riverline_4color', is4Color);
  document.documentElement.style.setProperty('--heart', '#ff0000');
  document.documentElement.style.setProperty('--spade', '#111827');
  document.documentElement.style.setProperty('--diamond', is4Color ? '#0044ff' : '#ff0000');
  document.documentElement.style.setProperty('--club', is4Color ? '#00b300' : '#111827');
  document.documentElement.dataset.fourColor = is4Color;
  const toggle = document.getElementById('fourColorDeckToggle');
  if (toggle) {
    if (is4Color) { toggle.classList.add('on'); toggle.setAttribute('aria-pressed', 'true'); }
    else { toggle.classList.remove('on'); toggle.setAttribute('aria-pressed', 'false'); }
  }
}



function toast(message, tone = 'info', scope = activeWorkspaceMode()) {

  const element = $('#toast');

  if (!element) return;

  const sequence = (toast.sequence || 0) + 1;
  toast.sequence = sequence;
  window.clearTimeout(toast.timer);

  element.textContent = message;

  element.dataset.tone = ['info', 'success', 'warning', 'error'].includes(tone) ? tone : 'info';
  element.dataset.scope = scope;

  element.classList.add('show');

  toast.timer = window.setTimeout(() => {
    if (toast.sequence === sequence) clearToast();
  }, 3200);

}





function bindEvents() {

  document.addEventListener('click', (event) => {

    const homeDestination = event.target.closest('[data-home-destination]');
    if (homeDestination) {
      const destination = homeDestination.dataset.homeDestination;
      if (destination === 'review_mistakes') {
        $('#homeReviewContent')?.closest('.home-section')?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      } else navigateToWorkspace(destination);
      return;
    }

    const homeAction = event.target.closest('[data-home-action]');
    if (homeAction?.dataset.homeAction === 'return-live-hand') {
      void returnToHomeLiveHand();
      return;
    }
    if (homeAction?.dataset.homeAction === 'review-sync') {
      window.RiverlineAuthentication?.openAccount?.();
      return;
    }

    const homeSavedItem = event.target.closest('[data-home-saved-id]');
    if (homeSavedItem) {
      void openHomeSavedItem(homeSavedItem.dataset.homeSavedId, homeSavedItem);
      return;
    }

    const handModeControl = event.target.closest('[data-equity-hand-mode]');
    if (handModeControl) {
      return setEquityHandMode(
        Number(handModeControl.dataset.playerIndex),
        handModeControl.dataset.equityHandMode
      );
    }

    const playerCountPreset = event.target.closest('[data-equity-player-count]');
    if (playerCountPreset) return setEquityPlayerCount(playerCountPreset.dataset.equityPlayerCount);

    const playerCountStep = event.target.closest('[data-equity-player-delta]');
    if (playerCountStep) {
      return setEquityPlayerCount(app.equity.players.length + Number(playerCountStep.dataset.equityPlayerDelta));
    }

    // The root element also carries the active presentation preference. Limit
    // routing to the actual Settings buttons so unrelated clicks continue to
    // their production handlers.
    const cardRankStyle = event.target.closest('button[data-card-rank-style]');
    if (cardRankStyle) return applyCardRankStyle(cardRankStyle.dataset.cardRankStyle);

    const slot = event.target.closest('.card-slot');

    if (slot) {

      const group = slot.dataset.group;

      if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
        return toast('These cards come from the canonical hand in Hand mode.', 'warning');
      }

      if (group.startsWith('training')) {
        return toast('Training cards come from the canonical generated hand.', 'warning');
      }

      const index = Number(slot.dataset.index);

      return openPicker(group, index);

    }

    const clear = event.target.closest('[data-clear]');

    if (clear) return clearGroup(clear.dataset.clear);

    const removePlayer = event.target.closest('[data-remove-player]');

    if (removePlayer) {
      const playerIndex = Number(removePlayer.dataset.removePlayer);
      if (playerIndex < 2 || playerIndex >= app.equity.players.length) return;
      app.equity.players.splice(playerIndex, 1);

      renderAllCards();

      setEquityPending();

    }

  });



  if ($('#deck')) $('#deck').addEventListener('click', (event) => {

    const card = event.target.closest('[data-deck-card]');

    if (card && !card.disabled) selectCard(card.dataset.deckCard);

  });

  if ($('#closeModal')) $('#closeModal').addEventListener('click', closePicker);

  if ($('#toggleTeacher')) $('#toggleTeacher').addEventListener('click', () => {

    const t = $('#teacherContent');

    if (t) {

      const isHidden = t.style.display === 'none' || t.style.display === '';

      t.style.display = isHidden ? 'block' : 'none';

      t.classList.toggle('is-analysis-entering', isHidden);

      if (isHidden) playbookSurfaceInvalidator.renderIfNeeded('analysis');

    }

  });

  if ($('#cardModal')) $('#cardModal').addEventListener('click', (event) => { if (event.target === $('#cardModal')) closePicker(); });

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePicker(); });



  $$('.mode-nav-item[data-mode]').forEach((button) => button.addEventListener('click', () => {
    $$('.mode-nav-item[data-mode]').forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('active', isActive);
      item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    const mode = button.dataset.mode;
    clearToast();
    window.RiverlineTutorials?.workspaceChanged?.(mode);
    if (mode !== 'gto') callPlaybookStateBridge('cancelReplayPlayback');

    const shell = $('.riverline-shell');
    if (shell) shell.dataset.activeMode = mode;

    const modeTitle = button.dataset.modeTitle || button.textContent.trim();
    const modeSubtitle = button.dataset.modeSubtitle || '';
    const workspaceTitle = $('#workspaceTitle');
    const workspaceSubtitle = $('#workspaceSubtitle');
    if (workspaceTitle) {
      workspaceTitle.dataset.i18n = modeTitle;
      workspaceTitle.textContent = t(modeTitle);
    }
    if (workspaceSubtitle) {
      workspaceSubtitle.dataset.i18n = modeSubtitle;
      workspaceSubtitle.textContent = t(modeSubtitle);
    }
    
    // Explicitly hide all mode views
    $$('.mode-view').forEach(view => {
      view.classList.remove('active');
      view.style.display = 'none';
    });
    
    // Explicitly show the active mode view
    const activeView = $(`#${mode}Mode`);
    if (activeView) {
      activeView.classList.add('active');
      activeView.style.display = 'block';
    }

    if (mode !== 'home') window.RiverlineTutorials?.offerForWorkspace?.(mode, activeView);

    if (mode !== 'gto') playbookUpdateScheduler.cancel();
    renderAllCards({ mode });
    if (mode === 'equity') updateEquityReadiness();
    if (mode === 'home') void refreshHomeWorkspace();
    if (mode === 'gto') {
      const savedHandProjection = callPlaybookStateBridge('createReplayProjectionViewModel');
      if (savedHandProjection?.viewerContext?.kind === 'saved_hand') {
        renderCanonicalHandWorkspace();
        renderVisiblePlaybookDerivedSurfaces();
      } else if (!app.playbookResolution && !activeSavedSpotContext) {
        void updateContext('Playbook opened');
      } else {
        renderVisiblePlaybookDerivedSurfaces();
      }
    }
    
    const infoEl = $('#infoMode') || $('#guideMode');
    if (infoEl) {
      const isInfo = (mode === 'info' || mode === 'guide');
      infoEl.classList.toggle('active', isInfo);
      infoEl.style.display = isInfo ? 'block' : 'none';
    }
  }));

  const revealPlaybookDestination = (view, control) => {
    const destination = view === 'context' ? $('#contextView') : $(`#${view === 'chart' ? 'chart' : view === 'range' ? 'range' : 'tree'}View`);
    if (!destination) return;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    destination.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    control?.focus?.({ preventScroll: true });
  };

  const selectPlaybookAnalysisView = (button, reveal = false) => {

    const view = button.dataset.gtoView;

    const destination = view === 'context' ? $('#contextView') : $(`#${view === 'chart' ? 'chart' : view === 'range' ? 'range' : 'tree'}View`);

    $$('.gto-view').forEach((item) => item.classList.toggle('is-view-entering', item === destination));

    $$('.sub-tab').forEach((item) => {
      const isSelected = item === button;
      item.classList.toggle('active', isSelected);
      item.setAttribute('aria-selected', String(isSelected));
    });

    if ($('#contextView')) $('#contextView').style.display = view === 'context' ? 'block' : 'none';

    if ($('#chartView')) $('#chartView').style.display = view === 'chart' ? 'block' : 'none';

    if ($('#rangeView')) $('#rangeView').style.display = view === 'range' ? 'block' : 'none';

    if ($('#treeView')) $('#treeView').style.display = view === 'tree' ? 'block' : 'none';

    if ($('#sharedControls')) $('#sharedControls').style.display = 'block';

    if (view === 'chart') {
      if (!playbookSurfaceInvalidator.renderIfNeeded('matrix')) renderChart();
    }

    if (view === 'range') playbookSurfaceInvalidator.renderIfNeeded('range');

    if (view === 'tree') playbookSurfaceInvalidator.renderIfNeeded('tree');

    if (reveal) revealPlaybookDestination(view, button);
  };

  $$('.sub-tab').forEach((button) => button.addEventListener('click', () => selectPlaybookAnalysisView(button)));

  if ($('#openCharts')) $('#openCharts').addEventListener('click', () => {
    const el = document.querySelector('[data-gto-view="chart"]');
    if (el) selectPlaybookAnalysisView(el, true);
  });

  ['backContext', 'postflopMatrixBack'].forEach((id) => {
    if ($('#' + id)) $('#' + id).addEventListener('click', () => {
      const el = document.querySelector('[data-gto-view="context"]');
      if (el) selectPlaybookAnalysisView(el, true);
    });
  });

  

  if ($('#chartAction')) $('#chartAction').addEventListener('change', () => {
    if (!playbookSurfaceInvalidator.renderIfNeeded('matrix')) renderChart();
  });

  ['rangeAdvHeroPos', 'rangeAdvVilPos'].forEach((id) => {
    if ($('#' + id)) $('#' + id).addEventListener('change', renderRangeAdvantage);
  });



  bindSliderPair('players', 'playersNum', {
    onInput: () => {
      updatePositions();
      schedulePlaybookUpdate('Table size changed');
    },
    onChange: () => {
      updatePositions();
      commitPlaybookUpdate('Table size changed');
    }
  });

  bindSliderPair('stack', 'stackNum', {
    onInput: () => schedulePlaybookUpdate('Stack changed'),
    onChange: () => commitPlaybookUpdate('Stack changed')
  });

  bindSliderPair('ante', 'anteNum', {
    onInput: () => schedulePlaybookUpdate('Ante changed'),
    onChange: () => commitPlaybookUpdate('Ante changed')
  });

  bindSliderPair('facingSize', 'facingSizeNum', {
    onInput: () => schedulePlaybookUpdate('Facing size changed'),
    onChange: () => commitPlaybookUpdate('Facing size changed')
  });

  bindSliderPair('potSize', 'potSizeNum', {
    onInput: () => schedulePlaybookUpdate('Pot size changed'),
    onChange: () => commitPlaybookUpdate('Pot size changed')
  });

  ['rakeMode', 'stackMode', 'heroPos', 'straddle'].forEach((id) => {

    if ($('#' + id)) $('#' + id).addEventListener('change', () => {
      updateContext('Configuration changed');
    });

  });

  ['lastAction'].forEach((id) => {

    if ($('#' + id)) $('#' + id).addEventListener('change', () => updateContext('Configuration changed'));

  });

  if ($('#toggleAdvanced')) $('#toggleAdvanced').addEventListener('click', () => {

    const enabled = $('#toggleAdvanced').classList.toggle('on');

    $('#toggleAdvanced').setAttribute('aria-pressed', enabled);

    if ($('#advancedRules')) $('#advancedRules').classList.toggle('hidden', !enabled);

  });



  if ($('#calculate')) $('#calculate').addEventListener('click', calculateEquity);

  if ($('#cancelEquity')) $('#cancelEquity').addEventListener('click', cancelEquityCalculation);

  if ($('#trials')) $('#trials').addEventListener('change', setEquityPending);

  if ($('#calcStyle')) $('#calcStyle').addEventListener('change', setEquityPending);

  if ($('#equitySeed')) $('#equitySeed').addEventListener('input', setEquityPending);

  if ($('#rerollEquitySeed')) $('#rerollEquitySeed').addEventListener('click', () => {
    const seed = window.crypto?.getRandomValues
      ? window.crypto.getRandomValues(new Uint32Array(1))[0]
      : Date.now() >>> 0;
    $('#equitySeed').value = String(seed);
    setEquityPending();
  });

  if ($('#resetEquity')) $('#resetEquity').addEventListener('click', resetEquityCalculator);



  if ($('#openSettings')) $('#openSettings').addEventListener('click', () => {
    clearToast();
    if ($('#settingsModal')) {
      $('#settingsModal').classList.add('show');
      window.RiverlineTutorials?.workspaceChanged?.('settings');
      window.RiverlineTutorials?.offerForWorkspace?.('settings', $('#settingsModal .settings-grid'));
    }
  });

  const closeSettings = () => {
    if ($('#settingsModal')) $('#settingsModal').classList.remove('show');
    const workspace = $('.riverline-shell')?.dataset.activeMode ?? null;
    window.RiverlineTutorials?.workspaceChanged?.(workspace);
  };

  if ($('#closeSettingsModal')) $('#closeSettingsModal').addEventListener('click', closeSettings);

  if ($('#settingsModal')) $('#settingsModal').addEventListener('click', (event) => { if (event.target === $('#settingsModal')) closeSettings(); });

  if ($('#fourColorDeckToggle')) $('#fourColorDeckToggle').addEventListener('click', () => applyDeckStyle(!app.settings.fourColorDeck));

  if ($('#cardStyleSelect')) $('#cardStyleSelect').addEventListener('change', (event) => applyCardStyle(event.target.value));

  if ($('#toggleTableBtn')) {
    $('#toggleTableBtn').addEventListener('click', (e) => {
      const wrapper = $('#table-wrapper');
      if (wrapper) {
        wrapper.classList.toggle('collapsed');
        const collapsed = wrapper.classList.contains('collapsed');
        e.currentTarget.closest('.playbook-decision-workspace')?.classList.toggle('is-table-collapsed', collapsed);
        e.currentTarget.setAttribute('aria-expanded', String(!collapsed));
        e.currentTarget.textContent = collapsed ? 'Expand Table' : 'Collapse Table';
        if (!collapsed) playbookSurfaceInvalidator.renderIfNeeded('table');
      }
    });
  }

  if ($('#toggleFrequencyAlternate')) {
    $('#toggleFrequencyAlternate').addEventListener('click', (event) => {
      const container = $('#actionWheelContainer');
      if (!container) return;
      const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
      event.currentTarget.setAttribute('aria-expanded', String(!expanded));
      container.hidden = expanded;
    });
  }

  if ($('#togglePlaybookContext')) {
    $('#togglePlaybookContext').addEventListener('click', (event) => {
      const mode = $('#gtoMode');
      if (!mode) return;
      const collapsed = mode.classList.toggle('is-context-collapsed');
      event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  if ($('#themeColor')) $('#themeColor').addEventListener('change', (event) => {

    document.documentElement.dataset.theme = event.target.value;

    localStorage.setItem('appTheme', event.target.value);

    initThemeSwatches();

  });

  // === TIGHTNESS SLIDER ===
  const tightnessSlider = document.getElementById('tightnessSlider');
  const tightnessLabel = document.getElementById('tightnessLabel');
  if (tightnessSlider) {
    tightnessSlider.addEventListener('input', () => {
      const val = Number(tightnessSlider.value);
      if (!app.settings) app.settings = {};
      app.settings.tightness = val;
      if (tightnessLabel) {
        tightnessLabel.textContent = val <= 25 ? 'Baseline' : val <= 75 ? 'Loose Online' : 'Splashy Home Game';
      }
    });
    tightnessSlider.addEventListener('change', () => updateContext('Tightness changed'));
  }

  // === OPPONENT TIGHTNESS SLIDER ===
  const oppTightnessSlider = document.getElementById('oppTightnessSlider');
  const oppTightnessLabel = document.getElementById('oppTightnessLabel');
  if (oppTightnessSlider) {
    oppTightnessSlider.addEventListener('input', () => {
      const val = Number(oppTightnessSlider.value);
      if (!app.settings) app.settings = {};
      app.settings.oppTightness = val;
      if (oppTightnessLabel) {
        oppTightnessLabel.textContent = val <= 25 ? 'Baseline' : val <= 75 ? 'Loose Online' : 'Splashy Home Game';
      }
    });
    oppTightnessSlider.addEventListener('change', () => updateContext('Opponent Tightness changed'));
  }

  // Initialize slider values
  if (tightnessSlider) tightnessSlider.dispatchEvent(new Event('input'));
  if (oppTightnessSlider) oppTightnessSlider.dispatchEvent(new Event('input'));
  document.addEventListener('keydown', (e) => {

    // Ignore if typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }

    if (trainingModeIsVisible()) return;

    if (e.key === 'Escape') {

      app.gto.hero = [null, null];

      app.gto.board = [null, null, null, null, null];

      app.gto.dead = [];

      updateContext('Cleared all via Escape key');

      renderAllCards();

    }

    // C - Clear current selection
    if (e.key === 'c' || e.key === 'C') {
      const heroSlot = document.querySelector('.card-slot[data-group="hero"][data-index="0"]');
      if (heroSlot && app.gto.hero[0]) {
        app.gto.hero = [null, null];
        renderAllCards();
        updateContext('Cleared hero cards');
      }
    }

    // H - Open hero card picker
    if (e.key === 'h' || e.key === 'H') {
      const heroSlot = document.querySelector('.card-slot[data-group="hero"][data-index="0"]');
      if (heroSlot) heroSlot.click();
    }

    // B - Open board card picker
    if (e.key === 'b' || e.key === 'B') {
      const boardSlot = document.querySelector('.card-slot[data-group="board"][data-index="0"]');
      if (boardSlot) boardSlot.click();
    }

    // S - Calculate equity
    if (e.key === 's' || e.key === 'S') {
      const calcBtn = document.getElementById('calculate');
      if (calcBtn) calcBtn.click();
    }

    // T - Toggle teacher
    if (e.key === 't' || e.key === 'T') {
      const teacherBtn = document.getElementById('toggleTeacher');
      if (teacherBtn) teacherBtn.click();
    }

    // 1-5 - Navigate tabs
    if (e.key >= '1' && e.key <= '5') {
      const tabIndex = parseInt(e.key) - 1;
      const tabs = document.querySelectorAll('.sub-tab');
      if (tabs[tabIndex]) tabs[tabIndex].click();
    }

    // L - Toggle dark/light mode
    if (e.key === 'l' || e.key === 'L') {
      const currentTheme = document.documentElement.dataset.theme || 'midnight';
      const newTheme = currentTheme === 'daylight' ? 'midnight' : 'daylight';
      
      document.documentElement.dataset.theme = newTheme;
      localStorage.setItem('appTheme', newTheme);
      
      if ($('#themeColor')) $('#themeColor').value = newTheme;
      
    }

  });

}



const THEME_PREVIEWS = [
  { id: 'midnight', name: 'Riverline Midnight', color: '#42ad7b', bg: '#101311', sharp: false, legacy: false },
  { id: 'graphite', name: 'Riverline Graphite', color: '#4aa77b', bg: '#151716', sharp: false, legacy: false },
  { id: 'daylight', name: 'Riverline Daylight', color: '#2f8b65', bg: '#f2eee6', sharp: false, legacy: false },

  // Preserved for existing preferences; these are not part of the new supported visual foundation.
  { id: 'discord', name: 'Discord Dark', color: '#5865f2', bg: '#1e1f22', sharp: false, legacy: true },
  { id: 'monochrome', name: 'Carbon Slate', color: '#94a3b8', bg: '#121824', sharp: false, legacy: true },
  { id: 'blue', name: 'Riverline Blue', color: '#3b82f6', bg: '#0b1329', sharp: false, legacy: true },
  { id: 'green', name: 'Matrix Green', color: '#10b981', bg: '#061912', sharp: false, legacy: true },
  { id: 'purple', name: 'Solver Purple', color: '#8b5cf6', bg: '#160d29', sharp: false, legacy: true },
  { id: 'red', name: 'Action Red', color: '#ef4444', bg: '#1a0b0b', sharp: false, legacy: true },
  { id: 'orange', name: 'Home Game Orange', color: '#f97316', bg: '#18110c', sharp: false, legacy: true },
  { id: 'legacy-midnight-cyan', name: 'Midnight Cyan', color: '#06b6d4', bg: '#08171e', sharp: false, legacy: true },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', color: '#ec4899', bg: '#1a0916', sharp: false, legacy: true },
  { id: 'felt', name: 'Casino Felt', color: '#4caf50', bg: '#0a2e1a', sharp: false, legacy: true },
  { id: 'luxury', name: 'Rose Luxe', color: '#e94560', bg: '#1a1a2e', sharp: false, legacy: true },
  { id: 'discord-0px', name: 'Discord Sharp', color: '#5865f2', bg: '#1e1f22', sharp: true, legacy: true },
  { id: 'serious-pio', name: 'PioSolver Sharp', color: '#6a8c7a', bg: '#12161a', sharp: true, legacy: true },
  { id: 'terminal', name: 'Terminal Dark CRT', color: '#00ff66', bg: '#040906', sharp: true, legacy: true },
  { id: 'brutalist-slate', name: 'Brutalist Slate', color: '#94a3b8', bg: '#0f172a', sharp: true, legacy: true },
  { id: 'brutalist-cyan', name: 'Brutalist Cyan', color: '#06b6d4', bg: '#0a1a1a', sharp: true, legacy: true },
  { id: 'brutalist-purple', name: 'Brutalist Purple', color: '#a855f7', bg: '#1a0a1a', sharp: true, legacy: true },
  { id: 'brutalist-amber', name: 'Brutalist Amber', color: '#f59e0b', bg: '#140c04', sharp: true, legacy: true },
  { id: 'brutalist-emerald', name: 'Brutalist Emerald', color: '#10b981', bg: '#051410', sharp: true, legacy: true },
  { id: 'brutalist-rose', name: 'Brutalist Rose', color: '#f43f5e', bg: '#1a0a10', sharp: true, legacy: true },
  { id: 'brutalist-red', name: 'Brutalist Red', color: '#ef4444', bg: '#1a0a0a', sharp: true, legacy: true }

];



function initThemeSwatches() {

  const grid = $('#themeSwatchGrid');

  if (!grid) return;

  const currentTheme = document.documentElement.dataset.theme || 'midnight';

  

  const riverlineThemes = THEME_PREVIEWS.filter(t => !t.legacy);

  const legacyThemes = THEME_PREVIEWS.filter(t => t.legacy);



  const renderBtn = (tItem) => {

    const isSelected = currentTheme === tItem.id;

    return `

      <button type="button" class="theme-swatch-btn ${isSelected ? 'active' : ''}" data-theme-id="${tItem.id}" aria-pressed="${isSelected}"

        style="--swatch-bg:${tItem.bg}; --swatch-accent:${tItem.color}; --swatch-radius:${tItem.sharp ? '0px' : 'var(--radius-cell)'}; --swatch-border-width:${isSelected ? '2px' : '1px'};">

        <div class="theme-swatch-copy">

          <span class="theme-swatch-dot"></span>

          <span class="theme-swatch-name">${t(tItem.name)}</span>

        </div>

      </button>

    `;

  };



  grid.innerHTML = `

    <div class="theme-swatch-heading">${t('Riverline Themes')}</div>

    ${riverlineThemes.map(renderBtn).join('')}

    <div class="theme-swatch-heading theme-swatch-heading--legacy">${t('Legacy / Experimental')}</div>

    ${legacyThemes.map(renderBtn).join('')}

  `;

  

  $$('.theme-swatch-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      const themeId = btn.dataset.themeId;

      document.documentElement.dataset.theme = themeId;

      localStorage.setItem('appTheme', themeId);

      if ($('#themeColor')) $('#themeColor').value = themeId;

      initThemeSwatches();

    });

  });

}



const localizedStrategyProfile = strategyResultToLegacyProfile;

function refreshLocalizedPlaybookRuntime() {
  if (app.playbookResolution) renderPlaybookModeStatus(app.playbookResolution);
  renderSavedStudySourceState(savedStudySourceState, savedStudyCurrentObject);
  if (isHandMode()) {
    syncHandSeatSelectors();
    renderCanonicalHandWorkspace();
  }
  if (app.decisionContext && app.strategyResult) {
    const profile = localizedStrategyProfile(app.strategyResult);
    if ($('#bestAction')) $('#bestAction').textContent = t(profile.best);
    if ($('#bestReason')) $('#bestReason').textContent = profile.reason;
    if ($('#sourceBadge')) $('#sourceBadge').textContent = strategySourceDisplayLabel(app.strategyResult.source);
    if ($('#strategyWarnings')) {
      $('#strategyWarnings').textContent = localizedStrategyWarnings(app.strategyResult).join(' · ');
    }
    const displayActions = [...profile.actions];
    while (displayActions.length < 3) displayActions.push({ name: '—', value: 0, kind: 'unavailable' });
    displayActions.forEach((action, index) => setFrequency(index + 1, action));
    renderFrequencyStack($('#actionFrequencyStack'), displayActions);
    updateMetrics(app.decisionContext);
    renderPath(app.decisionContext.street);
  }
  if (playbookSurfaceIsVisible('matrix')) renderChart();
  if (playbookSurfaceIsVisible('range')) renderRangeAdvantage();
  if (playbookSurfaceIsVisible('tree')) renderBettingTree();
  if (playbookSurfaceIsVisible('analysis')) {
    renderPlaybookDecisionAnalysis(
      app.decisionContext,
      app.strategyResult,
      app.playbookResolution,
      app.playbookResolution?.status === 'available'
        ? null
        : analysisUnavailableReasonForResolution(app.playbookResolution)
    );
  }
}

function refreshLocalizedEquityRuntime() {
  renderEquityPlayers();
  renderEquityCards();
  if (['idle', 'pending'].includes(app.equity.lifecycle) && $('#equityDetailExecution')) {
    $('#equityDetailExecution').textContent = t('Ready');
  }
  if (app.equity.lifecycle === 'complete' && app.equity.lastResult && app.equity.lastRequest) {
    renderEquityResult(app.equity.lastResult, app.equity.lastRequest, { announce: false });
    return;
  }
  renderEquityScenarioContext(app.equity.lastRequest || equityRequestFromCurrentInputs());
  updateEquityReadiness();
  if (app.equity.lifecycle === 'running') {
    if (app.equity.lastProgress) renderEquityProgress(app.equity.lastProgress);
    if ($('#methodBadge')) $('#methodBadge').textContent = t('RUNNING');
  } else if (app.equity.lifecycle === 'cancelled') {
    if ($('#equityStatus')) $('#equityStatus').textContent = t('Equity calculation cancelled.');
    if ($('#methodBadge')) $('#methodBadge').textContent = t('CANCELLED');
  } else if (app.equity.lifecycle === 'error') {
    if ($('#equityStatus')) $('#equityStatus').textContent = equityFailureMessage(app.equity.lastError);
    if ($('#methodBadge')) $('#methodBadge').textContent = t('ERROR');
  } else if (app.equity.lifecycle === 'pending') {
    if ($('#equityStatus')) $('#equityStatus').textContent = t('Inputs changed. Calculate to refresh the result.');
    if ($('#methodBadge')) $('#methodBadge').textContent = t('AWAITING CALCULATION');
  }
}

function refreshLocalizedTrainingRuntime() {
  updateTrainingPositions();
  updateTrainingFilterAvailability();
  updateTrainingStats();
  renderTrainingCards();
  const exercise = app.training.currentExercise;
  if (!exercise) return;
  renderTrainingPresentation(exercise);
  renderTrainingDecisionContextSummary(exercise);
  renderTrainingSource(exercise);
  updateAssistanceDisplay();
  if (app.training.lifecycle === 'ready') updateTrainingButtons(exercise);
  if (app.training.lifecycle === 'feedback' && app.training.currentEvaluation) {
    renderTrainingEvaluationSummary(app.training.currentEvaluation, exercise);
    showTrainingFeedback(
      canonicalTrainingFeedback(app.training.currentEvaluation, exercise.strategyResult),
      app.training.currentEvaluation.accepted
    );
    showTrainingSolution(app.training.currentSolution);
    renderTrainingDecisionAnalysis(exercise);
  }
}

function refreshLocalizedRuntime() {
  const shell = $('.riverline-shell');
  applySidebarState(Boolean(shell?.classList.contains('is-sidebar-collapsed')));
  updateActionPathDisclosure();
  initThemeSwatches();
  updatePositions();
  renderAllCards();
  if (activeWorkspaceMode() === 'home' && homeViewModel) renderHomeWorkspace(homeViewModel);
  refreshLocalizedPlaybookRuntime();
  refreshLocalizedEquityRuntime();
  refreshLocalizedTrainingRuntime();
}

function init() {

  try {
    
    // Explicitly hide all inactive mode-views on load to prevent bleeding
    $$('.mode-view').forEach(view => {
      if (!view.classList.contains('active')) {
        view.style.display = 'none';
      } else {
        view.style.display = 'block';
      }
    });

    const saved4Color = localStorage.getItem('riverline_4color');
    applyDeckStyle(saved4Color !== 'false'); // true by default

    const savedCardRankStyle = localStorage.getItem('riverline_card_rank_style');
    applyCardRankStyle(savedCardRankStyle, false);

    const savedCardStyle = localStorage.getItem('riverline_card_style');
    applyCardStyle(savedCardStyle, false);

    initSidebar();

    initActionPathPresentation();

    SoundFX.initBtn();

    // Bypassing browser form-fill cache on reload

    if ($('#players')) $('#players').value = '8';

    if ($('#playersNum')) $('#playersNum').value = '8';

    if ($('#stackMode')) $('#stackMode').value = 'hero';

    if ($('#stack')) $('#stack').value = '30';

    if ($('#stackNum')) $('#stackNum').value = '30';

    if ($('#rakeMode')) $('#rakeMode').value = 'off';

    if ($('#heroPos')) $('#heroPos').value = 'UTG';

    if ($('#lastAction')) $('#lastAction').value = 'unopened';

    if ($('#potSize')) $('#potSize').value = '1.5';

    if ($('#facingSize')) $('#facingSize').value = '0';

    

    // Preserve the translation system's existing language preference.
    const savedLanguage = localStorage.getItem('language') || localStorage.getItem('appLang');
    const selectedLanguage = ['en', 'ru', 'he'].includes(savedLanguage) ? savedLanguage : (window.appLang || 'en');
    window.appLang = selectedLanguage;
    document.documentElement.lang = selectedLanguage;
    document.documentElement.dir = selectedLanguage === 'he' ? 'rtl' : 'ltr';
    if ($('#langToggle')) $('#langToggle').value = selectedLanguage;

    const defaultTheme = 'midnight';
    const persistedTheme = localStorage.getItem('appTheme');
    const selectedTheme = THEME_PREVIEWS.some(theme => theme.id === persistedTheme)
      ? persistedTheme
      : defaultTheme;
    if (selectedTheme !== persistedTheme) localStorage.setItem('appTheme', selectedTheme);
    document.documentElement.dataset.theme = selectedTheme;
    if ($('#themeColor')) $('#themeColor').value = selectedTheme;

    initThemeSwatches();

    initTrainingMode();

    updatePositions();

    renderAllCards();

    bindEvents();

    bindCanonicalHandWorkspace();

    bindSavedStudyObjectsUx();

    bindPlaybookModeControl();

    window.addEventListener('riverline:languagechange', refreshLocalizedRuntime);
    window.addEventListener('riverline:identitychange', () => {
      scheduleHomeRefresh({ clearPrivateState: true });
    });
    window.addEventListener('riverline:authchange', () => {
      scheduleHomeRefresh({ clearPrivateState: true });
      if (activeWorkspaceMode() === 'gto') void refreshSavedStudySource();
    });
    window.addEventListener('riverline:savedstudychange', () => {
      scheduleHomeRefresh();
      if (activeWorkspaceMode() === 'gto') void refreshSavedStudySource();
    });
    window.addEventListener('riverline:personalstrategychange', () => {
      scheduleHomeRefresh();
    });
    window.addEventListener('riverline:studysyncchange', () => scheduleHomeRefresh());

    

    if (activeWorkspaceMode() === 'home') void refreshHomeWorkspace();
    else updateContext('Ready');

  } catch (error) {

    console.error('Init error:', error);

  }

}



if (document.readyState === 'loading') {

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 10));

} else {
  const audioToggle = $('#audioToggle');
  if (audioToggle) {
    audioToggle.addEventListener('change', (e) => {
      if(window.SoundFX) window.SoundFX.enabled = e.target.checked;
    });
  }


  setTimeout(init, 10);

}



// ── Range Advantage ──────────────────────────────────────────────────────────

// Fixed, approximate preflop hand-class samples used for descriptive comparison.

// Return the first valid combo of a hand class that isn't blocked by the board

const PREFLOP_RANGES = {

  // These are unweighted analytical assumptions, not solver-derived ranges.

  'UTG': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','KQs','KJs','KTs','K9s','QJs','QTs','JTs','J9s','T9s','98s','87s','AKo','AQo','AJo','ATo','KQo','KJo','QJo']), // ~17%

  'HJ':  new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','QJs','QTs','Q9s','JTs','J9s','T9s','98s','87s','76s','65s','AKo','AQo','AJo','ATo','A9o','KQo','KJo','KTo','QJo','JTo']), // ~20%

  'CO':  new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','QJs','QTs','Q9s','Q8s','JTs','J9s','T9s','T8s','98s','97s','87s','76s','65s','54s','AKo','AQo','AJo','ATo','A9o','A8o','KQo','KJo','KTo','K9o','QJo','QTo','JTo','J9o','T9o']), // ~27%

  'BTN': new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s','QJs','QTs','Q9s','Q8s','Q7s','Q6s','JTs','J9s','J8s','J7s','T9s','T8s','T7s','98s','97s','87s','86s','76s','75s','65s','54s','43s','AKo','AQo','AJo','ATo','A9o','A8o','A7o','A6o','A5o','A4o','A3o','A2o','KQo','KJo','KTo','K9o','K8o','QJo','QTo','Q9o','Q8o','JTo','J9o','J8o','T9o','T8o','98o']), // ~42%

  'SB':  new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','QJs','QTs','Q9s','Q8s','JTs','J9s','J8s','T9s','T8s','98s','97s','87s','76s','65s','54s','AKo','AQo','AJo','ATo','A9o','A8o','A7o','A5o','KQo','KJo','KTo','K9o','QJo','QTo','Q9o','JTo','J9o','T9o']), // ~42% (playing tight/aggro)

  'BB':  new Set(['AA','KK','QQ','JJ','TT','99','88','77','66','55','44','33','22','AKs','AQs','AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s','KQs','KJs','KTs','K9s','K8s','K7s','K6s','K5s','K4s','K3s','K2s','QJs','QTs','Q9s','Q8s','Q7s','Q6s','Q5s','JTs','J9s','J8s','J7s','T9s','T8s','T7s','98s','97s','87s','76s','65s','54s','43s','AKo','AQo','AJo','ATo','A9o','A8o','A7o','A6o','A5o','A4o','KQo','KJo','KTo','K9o','QJo','QTo','Q9o','JTo','J9o','T9o','98o']) // ~60% (wide defend)

};



function scoreSevenJs(hole, board) {

    if (!hole || !hole.length) return 0;

    const cards = [...hole, ...board];

    if (cards.length < 5) return 0;

    

    // Evaluate 5 card combinations

    const getCombinations = (arr, k) => {

        let i, j, combs, head, tailcombs;

        if (k > arr.length || k <= 0) return [];

        if (k === arr.length) return [arr];

        if (k === 1) return arr.map(a => [a]);

        combs = [];

        for (i = 0; i < arr.length - k + 1; i++) {

            head = arr.slice(i, i + 1);

            tailcombs = getCombinations(arr.slice(i + 1), k - 1);

            for (j = 0; j < tailcombs.length; j++) combs.push(head.concat(tailcombs[j]));

        }

        return combs;

    };

    

    const RANK_VAL = { '2':2, '3':3, '4':4, '5':5, '6':6, '7':7, '8':8, '9':9, 'T':10, 'J':11, 'Q':12, 'K':13, 'A':14 };

    

    let maxScore = 0;

    const combos5 = getCombinations(cards, 5);

    for (let c of combos5) {

        let values = c.map(card => RANK_VAL[card[0]]).sort((a, b) => b - a);

        let suits = c.map(card => card[1]);

        

        let counts = {};

        values.forEach(v => counts[v] = (counts[v] || 0) + 1);

        let groups = Object.keys(counts).map(k => [parseInt(k), counts[k]]).sort((a, b) => {

            if (b[1] !== a[1]) return b[1] - a[1];

            return b[0] - a[0];

        });

        

        let unique = [...new Set(values)];

        let isWheel = (unique.length === 5 && unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2);

        let isStraight = (unique.length === 5 && unique[0] - unique[4] === 4) || isWheel;

        let strHigh = isWheel ? 5 : (isStraight ? unique[0] : 0);

        let isFlush = new Set(suits).size === 1;

        

        let pack = (cat, tiebreakers) => {

            let s = cat * 10000000000;

            for (let i = 0; i < tiebreakers.length; i++) {

                s += tiebreakers[i] * Math.pow(15, 4 - i);

            }

            return s;

        };

        

        let score = 0;

        if (isFlush && isStraight) score = pack(8, [strHigh]);

        else if (groups[0][1] === 4) score = pack(7, [groups[0][0], groups[1][0]]);

        else if (groups[0][1] === 3 && groups[1][1] === 2) score = pack(6, [groups[0][0], groups[1][0]]);

        else if (isFlush) score = pack(5, values);

        else if (isStraight) score = pack(4, [strHigh]);

        else if (groups[0][1] === 3) score = pack(3, [groups[0][0], ...groups.filter(g => g[1]===1).map(g=>g[0])]);

        else if (groups[0][1] === 2 && groups[1][1] === 2) score = pack(2, [groups[0][0], groups[1][0], groups[2][0]]);

        else if (groups[0][1] === 2) score = pack(1, [groups[0][0], ...groups.filter(g => g[1]===1).map(g=>g[0])]);

        else score = pack(0, values);

        

        if (score > maxScore) maxScore = score;

    }

    

    // Heuristic draw boost

    let suits = cards.map(c => c[1]);

    let hasFd = ['s','h','d','c'].some(s => suits.filter(x => x === s).length >= 4);

    

    let ranks = [...new Set(cards.map(c => RANK_VAL[c[0]]))].sort((a, b) => a - b);

    if (ranks.includes(14)) ranks.unshift(1); // Ace low

    let oesd = false, gutshot = false;

    for (let k = 0; k < ranks.length - 3; k++) {

        let r1 = ranks[k], r4 = ranks[k+3];

        if (r4 - r1 === 3) {

            if (r1 > 1 && r4 < 14) oesd = true;

            else gutshot = true;

        } else if (r4 - r1 === 4) {

            gutshot = true;

        }

    }

    

    if (maxScore < 20000000000) {

        if (hasFd && oesd) maxScore = Math.max(maxScore, 35000000000);

        else if (hasFd) maxScore = Math.max(maxScore, 25000000000);

        else if (oesd) maxScore = Math.max(maxScore, 15000000000);

        else if (gutshot) maxScore = Math.max(maxScore, 5000000000);

    }

    return maxScore;

}



function getValidComboForRange(handCode, boardCards) {

  const boardSet = new Set(boardCards);

  const SUITS = ['s','h','d','c'];

  const r1 = handCode[0], r2 = handCode[1];

  const isSuited = handCode[2] === 's';

  const isPair   = handCode.length === 2;



  if (isPair) {

    for (let i = 0; i < SUITS.length; i++)

      for (let j = i+1; j < SUITS.length; j++) {

        const c1 = r1+SUITS[i], c2 = r2+SUITS[j];

        if (!boardSet.has(c1) && !boardSet.has(c2)) return [c1, c2];

      }

  } else if (isSuited) {

    for (const s of SUITS) {

      const c1 = r1+s, c2 = r2+s;

      if (!boardSet.has(c1) && !boardSet.has(c2)) return [c1, c2];

    }

  } else {

    for (const s1 of SUITS) for (const s2 of SUITS) {

      if (s1 === s2) continue;

      const c1 = r1+s1, c2 = r2+s2;

      if (!boardSet.has(c1) && !boardSet.has(c2)) return [c1, c2];

    }

  }

  return null;

}



// Categorize one representative available combo: 0=air, 1=marginal/draw,
// 2=strong made, 3=very strong made, -1=not in the fixed sample.

function scoreRangeHand(handCode, boardCards, range) {

  if (!range.has(handCode)) return -1;

  const combo = getValidComboForRange(handCode, boardCards);

  if (!combo) return -1; // blocked by board



  const score = scoreSevenJs(combo, boardCards);

  const cat   = Math.floor(score / 10000000000);



  if      (cat >= 4)  return 3; // very strong made (straight+)

  else if (cat >= 2)  return 2; // strong made (two pair / trips)

  else if (cat >= 1)  return 1; // marginal (pair)

  else {

    // Check for strong draws as "marginal"

    const cards = [...combo, ...boardCards];

    const suits  = cards.map(c=>c[1]);

    const hasFD  = ['s','h','d','c'].some(s => suits.filter(x=>x===s).length >= 4);

    const RANK_VAL = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14};

    let ranks = [...new Set(cards.map(c=>RANK_VAL[c[0]]))].sort((a,b)=>a-b);

    if (ranks.includes(14)) ranks.unshift(1);

    let hasSD = false;

    for (let k=0; k<ranks.length-3; k++) if (ranks[k+3]-ranks[k] <= 4) { hasSD=true; break; }

    if (hasFD || hasSD) return 1;

    return 0;

  }

}



function renderRangeGrid(gridId, hoverInfoId, range, board, statIds) {
  const grid = $('#' + gridId);
  if (!grid) return { veryStrong:0, strongMade:0, marginal:0, air:0, total:0 };
  
  const stats = { veryStrong:0, strongMade:0, marginal:0, air:0, total:0 };
  const COLOR = { 3:'var(--primary)', 2:'#8bc34a', 1:'var(--orange)', 0:'var(--red)' };
  const LABEL = {
    3: t('Very strong made'),
    2: t('Strong made'),
    1: t('Marginal or draw'),
    0: t('Air'),
    [-1]: t('Not in sample')
  };

  // Init grid once
  if (grid.children.length === 0) {
    grid.innerHTML = '';
    RANKS.forEach((_, row) => RANKS.forEach((__, col) => {
      const btn = document.createElement('button');
      btn.className = 'hand-cell range-cell';
      btn.dataset.hand = handCode(row, col);
      btn.dataset.index = row * 13 + col;
      grid.appendChild(btn);
    }));
    
    // Event delegation
    grid.addEventListener('mouseover', (e) => {
      const btn = e.target.closest('.range-cell');
      if (btn) {
        const info = $('#' + hoverInfoId);
        if (info) info.textContent = `${btn.dataset.hand}: ${btn.title}`;
      }
    });
    grid.addEventListener('mouseout', (e) => {
      const btn = e.target.closest('.range-cell');
      if (btn) {
        const info = $('#' + hoverInfoId);
        if (info) info.textContent = t('Hover over a hand to see details');
      }
    });
  }

  RANKS.forEach((_, row) => RANKS.forEach((__, col) => {
    const hand = handCode(row, col);
    const tier = scoreRangeHand(hand, board, range);
    const idx = row * 13 + col;
    const btn = grid.children[idx];
    
    btn.textContent = hand;
    btn.title = LABEL[tier] || t('Not in sample');

    if (tier === -1) {
      btn.style.background = 'transparent';
      btn.style.border = '1px solid #1e293b';
      btn.style.color = '#334155';
      btn.style.opacity = '1';
    } else {
      btn.style.background = COLOR[tier];
      btn.style.border = 'none';
      btn.style.color = '#ffffff';
      btn.style.opacity = '0.88';
      stats[['air','marginal','strongMade','veryStrong'][tier]]++;
      stats.total++;
    }
  }));



  if (statIds) {

    const pct = v => stats.total ? (v/stats.total*100).toFixed(0)+'%' : '0%';

    if ($('#'+statIds.veryStrong)) $('#'+statIds.veryStrong).textContent = `${stats.veryStrong} (${pct(stats.veryStrong)})`;

    if ($('#'+statIds.strongMade)) $('#'+statIds.strongMade).textContent = `${stats.strongMade} (${pct(stats.strongMade)})`;

    if ($('#'+statIds.marginal)) $('#'+statIds.marginal).textContent = `${stats.marginal} (${pct(stats.marginal)})`;

    if ($('#'+statIds.air))      $('#'+statIds.air).textContent      = `${stats.air} (${pct(stats.air)})`;

  }

  return stats;

}



function renderRangeAdvantage() {
  const heroPos = $('#rangeAdvHeroPos')?.value || 'BTN';
  const villainPos = $('#rangeAdvVilPos')?.value || 'BB';
  const status = $('#rangeAdvantageStatus');
  const analysis = $('#rangeAdvantageAnalysis');

  if ($('#heroRangeTitle')) $('#heroRangeTitle').textContent = `${t('Hero sample')} (${heroPos})`;
  if ($('#villainRangeTitle')) $('#villainRangeTitle').textContent = `${t('Villain sample')} (${villainPos})`;

  if (app.playbookMode === PLAYBOOK_MODES.HAND) {
    if (analysis) analysis.hidden = true;
    if (status) {
      status.dataset.state = 'unavailable';
      status.textContent = t('Unavailable in Hand Mode. Canonical hand history does not establish weighted ranges, so Scenario cards and manual range assumptions are not used.');
    }
    return { status: 'unavailable', mode: PLAYBOOK_MODES.HAND, heroPos, villainPos };
  }

  const heroRange = PREFLOP_RANGES[heroPos] || PREFLOP_RANGES.BTN;
  const villainRange = PREFLOP_RANGES[villainPos] || PREFLOP_RANGES.BB;
  const board = app.gto.board.filter(Boolean);
  if (board.length < 3) {
    if (analysis) analysis.hidden = true;
    if (status) {
      status.dataset.state = 'waiting';
      status.textContent = t('Add at least a flop to compare the manually selected heuristic range samples.');
    }
    return { status: 'waiting_for_board', mode: PLAYBOOK_MODES.SCENARIO, heroPos, villainPos };
  }

  if (analysis) analysis.hidden = false;
  if (status) {
    status.dataset.state = 'available';
    status.textContent = t('Source: heuristic fixed-range/category analysis. Fixed approximate preflop ranges; one representative available combo per hand class; no combo weights. This is not solver range advantage, range-vs-range equity, or support for a betting size or frequency.');
  }

  const statIds = {
    hero: { veryStrong:'heroStatVeryStrong', strongMade:'heroStatStrongMade', marginal:'heroStatMarginal', air:'heroStatAir' },
    villain: { veryStrong:'vilStatVeryStrong', strongMade:'vilStatStrongMade', marginal:'vilStatMarginal', air:'vilStatAir' }
  };
  const heroStats = renderRangeGrid('heroRangeGrid', 'heroHoverInfo', heroRange, board, statIds.hero);
  const villainStats = renderRangeGrid('villainRangeGrid', 'villainHoverInfo', villainRange, board, statIds.villain);

  const heroStrongShare = heroStats.total
    ? (heroStats.veryStrong + heroStats.strongMade) / heroStats.total : 0;
  const villainStrongShare = villainStats.total
    ? (villainStats.veryStrong + villainStats.strongMade) / villainStats.total : 0;
  const combinedShare = heroStrongShare + villainStrongShare;
  const heroBarShare = combinedShare > 0 ? Math.round(heroStrongShare / combinedShare * 100) : 50;

  if ($('#heroAdvBar')) $('#heroAdvBar').style.width = `${heroBarShare}%`;
  if ($('#villainAdvBar')) $('#villainAdvBar').style.width = `${100 - heroBarShare}%`;
  if ($('#heroRangeScore')) $('#heroRangeScore').textContent = `${(heroStrongShare * 100).toFixed(1)}% ${t('strong made categories')}`;
  if ($('#villainRangeScore')) $('#villainRangeScore').textContent = `${(villainStrongShare * 100).toFixed(1)}% ${t('strong made categories')}`;

  let title = t('Similar sampled categories');
  let description = t('The sampled made-hand and draw categories are similar.');
  let color = 'var(--orange)';
  if (heroStrongShare - villainStrongShare > 0.10) {
    title = t('Hero sample contains more strong made categories');
    description = t('This heuristic range sample contains a higher share of strong and very strong made-hand categories for Hero.');
    color = 'var(--primary)';
  } else if (villainStrongShare - heroStrongShare > 0.10) {
    title = t('Villain sample contains more strong made categories');
    description = t("Villain's sampled range contains a higher share of strong and very strong made-hand categories.");
    color = 'var(--red)';
  }

  if ($('#rangeConclusion')) {
    $('#rangeConclusion').replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = title;
    const copy = document.createElement('span');
    copy.textContent = description;
    $('#rangeConclusion').append(heading, document.createElement('br'), copy);
    $('#rangeConclusion').style.borderLeftColor = color;
  }

  return {
    status: 'available',
    mode: PLAYBOOK_MODES.SCENARIO,
    heroPos,
    villainPos,
    heroStrongShare,
    villainStrongShare
  };

}



function renderBettingTree() {
  const container = $('#pioTreeContainer');
  if (!container) return;

  const currentStrategyResult = app.strategyResult || strategyProvider.resolve(null);
  const profile = strategyResultToLegacyProfile(currentStrategyResult);
  const board = app.gto ? app.gto.board.filter(Boolean) : [];
  const pos = $('#heroPos') ? $('#heroPos').value : 'BTN';
  const pot = typeof getPotBeforeAction === 'function' ? getPotBeforeAction() : 1.5;
  const facing = numericValue('#facingSize', 0);
  const street = currentStreet();

  let foldPct = 0, callPct = 0, raisePct = 0;
  if (profile && profile.actions) {
    profile.actions.forEach(a => {
      if (a.kind === 'fold') foldPct += a.value || 0;
      else if (a.kind === 'passive') callPct += a.value || 0;
      else if (a.kind === 'aggressive') raisePct += a.value || 0;
    });
  }

  const roundedFold = Math.round(foldPct);
  const roundedCall = Math.round(callPct);
  const roundedRaise = Math.round(raisePct);

  const raiseActionLabel = facing > 0 ? `3-Bet / Raise (${facing}bb)` : 'Raise / Bet';

  const treeData = {
    id: 'root',
    label: `${t('Root Node')} (${pos} - ${street.toUpperCase()})`,
    street: street,
    pot: pot.toFixed(1) + ' bb',
    board: board.join(' ') || '-',
    fold: roundedFold, call: roundedCall, raise: roundedRaise,
    children: [
      {
        id: 'node_fold',
        label: t('Fold') + ` (${roundedFold}%)`,
        street: street,
        pot: pot.toFixed(1) + ' bb',
        board: board.join(' ') || '-',
        fold: 100, call: 0, raise: 0,
        children: []
      },
      {
        id: 'node_call',
        label: (facing > 0 ? t('Call') : t('Check')) + ` (${roundedCall}%)`,
        street: street,
        pot: pot.toFixed(1) + ' bb',
        board: board.join(' ') || '-',
        fold: 0, call: 100, raise: 0,
        children: board.length >= 3 ? [
          {
            id: 'node_next_street',
            label: `${t('COMMUNITY BOARD')} [${board.join(' ')}]`,
            street: street,
            pot: (pot + facing).toFixed(1) + ' bb',
            board: board.join(' '),
            fold: roundedFold, call: roundedCall, raise: roundedRaise,
            children: []
          }
        ] : []
      },
      {
        id: 'node_raise',
        label: t(raiseActionLabel) + ` (${roundedRaise}%)`,
        street: street,
        pot: (pot + (facing > 0 ? facing * 2.5 : 2.5)).toFixed(1) + ' bb',
        board: board.join(' ') || '-',
        fold: 0, call: 0, raise: 100,
        children: []
      }
    ]
  };

  function buildNodeHTML(node, isRoot = false) {
    const hasChildren = node.children && node.children.length > 0;
    const chevronClass = hasChildren ? 'piotree-chevron open' : 'piotree-chevron';
    const chevronSymbol = hasChildren ? '▸' : '•';

    let html = `<div class="piotree-item ${isRoot ? 'root' : ''}">
      <div class="piotree-node-row" data-piotree-id="${node.id}">
        <span class="${chevronClass}" data-piotree-toggle="${node.id}">${chevronSymbol}</span>
        <span class="piotree-label">${node.label}</span>
        <div class="piotree-bars-inline">
          <div style="width:${node.fold}%; background:var(--red, #ef4444);"></div>
          <div style="width:${node.call}%; background:var(--blue, #3b82f6);"></div>
          <div style="width:${node.raise}%; background:var(--green, #10b981);"></div>
        </div>
      </div>`;

    if (hasChildren) {
      html += `<div class="piotree-children" id="child_${node.id}">`;
      node.children.forEach(child => {
        html += buildNodeHTML(child, false);
      });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  container.innerHTML = buildNodeHTML(treeData, true);

  function selectNode(node) {
    container.querySelectorAll('.piotree-node-row').forEach(row => row.classList.remove('selected'));
    const row = container.querySelector(`[data-piotree-id="${node.id}"]`);
    if (row) row.classList.add('selected');

    if ($('#pioInspectorTitle')) $('#pioInspectorTitle').textContent = node.label;
    if ($('#pioInspectorStreet')) $('#pioInspectorStreet').textContent = node.street.toUpperCase();
    if ($('#pioInspectorPot')) $('#pioInspectorPot').textContent = node.pot;
    if ($('#pioInspectorBoard')) $('#pioInspectorBoard').textContent = node.board;

    if ($('#pioValFold')) $('#pioValFold').textContent = node.fold + '%';
    if ($('#pioValCall')) $('#pioValCall').textContent = node.call + '%';
    if ($('#pioValRaise')) $('#pioValRaise').textContent = node.raise + '%';

    if ($('#pioBarFold')) $('#pioBarFold').style.width = node.fold + '%';
    if ($('#pioBarCall')) $('#pioBarCall').style.width = node.call + '%';
    if ($('#pioBarRaise')) $('#pioBarRaise').style.width = node.raise + '%';
  }

  selectNode(treeData);

  function bindTreeEvents(node) {
    const row = container.querySelector(`[data-piotree-id="${node.id}"]`);
    if (row) {
      row.addEventListener('click', () => {
        if (window.SoundFX) SoundFX.playClick();
        selectNode(node);
      });
    }
    if (node.children) node.children.forEach(child => bindTreeEvents(child));
  }
  bindTreeEvents(treeData);

  container.querySelectorAll('[data-piotree-toggle]').forEach(chev => {
    chev.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = chev.getAttribute('data-piotree-toggle');
      const childContainer = $('#child_' + id);
      if (childContainer) {
        childContainer.classList.toggle('collapsed');
        chev.classList.toggle('open');
      }
    });
  });

  if ($('#treeExpandAll')) {
    $('#treeExpandAll').onclick = () => {
      if (window.SoundFX) SoundFX.playClick();
      container.querySelectorAll('.piotree-children').forEach(el => el.classList.remove('collapsed'));
      container.querySelectorAll('.piotree-chevron').forEach(el => el.classList.add('open'));
    };
  }

  if ($('#treeCollapseAll')) {
    $('#treeCollapseAll').onclick = () => {
      if (window.SoundFX) SoundFX.playClick();
      container.querySelectorAll('.piotree-children').forEach(el => el.classList.add('collapsed'));
      container.querySelectorAll('.piotree-chevron').forEach(el => el.classList.remove('open'));
    };
  }
}
// ---------------------------------------------------------------------------

// Training Mode

// ---------------------------------------------------------------------------



function trainingModeIsVisible() {
  const mode = $('#trainingMode');
  return Boolean(mode && mode.style.display !== 'none' && !mode.hidden);
}

function selectedTrainingSeed() {
  const input = $('#trainingSeedInput');
  const numeric = Number(input?.value);
  if (!input?.value || !Number.isInteger(numeric) || numeric < 0 || numeric > 0xffffffff) {
    if (input) input.setAttribute('aria-invalid', 'true');
    toast(t('Enter a whole-number seed from 0 through 4294967295.'), 'warning');
    return null;
  }
  input.removeAttribute('aria-invalid');
  return numeric >>> 0;
}

function updateTrainingFilterAvailability() {
  const street = $('#trainingStreet')?.value || 'any';
  const target = $('#trainingDecisionTarget');
  if (!target) return;
  const preflop = new Set([
    TRAINING_TARGETS.PREFLOP_UNOPENED, TRAINING_TARGETS.PREFLOP_FACING_OPEN,
    TRAINING_TARGETS.PREFLOP_FACING_3BET, TRAINING_TARGETS.PREFLOP_FACING_4BET,
    TRAINING_TARGETS.PREFLOP_BB_OPTION
  ]);
  [...target.options].forEach((option) => {
    if (option.value === 'any') return;
    option.disabled = street === 'preflop'
      ? !preflop.has(option.value)
      : street === 'any' ? false : preflop.has(option.value);
  });
  if (target.selectedOptions[0]?.disabled) target.value = 'any';

  const position = $('#trainingHeroPos');
  const message = $('#trainingFilterMessage');
  if (target.value === TRAINING_TARGETS.PREFLOP_BB_OPTION && position?.value !== 'BB') {
    position.value = 'BB';
    if (message) message.textContent = t('Hero moved to BB because the check-option target requires the big blind.');
  } else if (target.value === TRAINING_TARGETS.PREFLOP_UNOPENED && position?.value === 'BB') {
    const alternatives = [...position.options].map((option) => option.value).filter((value) => value !== 'BB');
    position.value = alternatives.includes('BTN') ? 'BTN' : alternatives[0];
    if (message) message.textContent = t('Hero moved out of BB because an unopened RFI is not a BB check option.');
  } else if (message) {
    message.textContent = '';
  }
}

function applyCardRankStyle(style, refresh = true) {
  const nextStyle = style === 'full-ten' ? 'full-ten' : 'poker';
  app.settings.cardRankStyle = nextStyle;
  localStorage.setItem('riverline_card_rank_style', nextStyle);
  document.documentElement.dataset.cardRankStyle = nextStyle;
  $$('button[data-card-rank-style]').forEach((button) => {
    const selected = button.dataset.cardRankStyle === nextStyle;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if (!refresh) return;
  renderAllCards();
  if (activeWorkspaceMode() === 'gto' && playbookSurfaceIsVisible('analysis')) {
    renderPlaybookDecisionAnalysis(
      app.decisionContext,
      app.strategyResult,
      app.playbookResolution,
      app.playbookResolution?.status === 'available'
        ? null
        : analysisUnavailableReasonForResolution(app.playbookResolution)
    );
  }
  if (activeWorkspaceMode() === 'training' && app.training.currentExercise && !$('#trainingAnalysis')?.hidden) {
    renderTrainingDecisionAnalysis(app.training.currentExercise);
  }
  window.dispatchEvent(new CustomEvent('riverlineCardRankStyleChanged', { detail: { style: nextStyle } }));
}

const CARD_STYLES = Object.freeze(['classic-mirrored', 'tournament', 'clean-corner', 'clarity-corner']);

function applyCardStyle(style, refresh = true) {
  const nextStyle = CARD_STYLES.includes(style) ? style : 'tournament';
  app.settings.cardStyle = nextStyle;
  localStorage.setItem('riverline_card_style', nextStyle);
  document.documentElement.dataset.cardStyle = nextStyle;
  if ($('#cardStyleSelect')) $('#cardStyleSelect').value = nextStyle;
  if (!refresh) return;
  renderAllCards();
  window.dispatchEvent(new CustomEvent('riverlineCardStyleChanged', { detail: { style: nextStyle } }));
}

function applySidebarState(collapsed) {
  const shell = $('.riverline-shell');
  const rail = $('#modeRail');
  const button = $('#sidebarCollapseBtn');
  if (!shell || !rail || !button) return;
  shell.classList.toggle('is-sidebar-collapsed', collapsed);
  shell.dataset.sidebarState = collapsed ? 'collapsed' : 'expanded';
  rail.dataset.collapsed = String(collapsed);
  rail.dataset.expanded = String(!collapsed);
  button.setAttribute('aria-expanded', String(!collapsed));
  button.setAttribute('aria-label', t(collapsed ? 'Expand sidebar' : 'Collapse sidebar'));
  button.title = t(collapsed ? 'Expand sidebar' : 'Collapse sidebar');
}

function initSidebar() {
  const button = $('#sidebarCollapseBtn');
  if (!button) return;
  const saved = localStorage.getItem('riverline_sidebar_collapsed');
  const compactDefault = window.matchMedia?.('(max-width: 1180px)').matches === true;
  applySidebarState(saved === null ? compactDefault : saved === 'true');
  button.addEventListener('click', () => {
    const shell = $('.riverline-shell');
    const collapsed = !shell?.classList.contains('is-sidebar-collapsed');
    localStorage.setItem('riverline_sidebar_collapsed', String(collapsed));
    applySidebarState(collapsed);
  });
}

async function copyCurrentTrainingSeed() {
  const seed = app.training.currentExercise?.seed;
  if (!Number.isInteger(seed)) return;
  try {
    await navigator.clipboard.writeText(String(seed));
    toast(t('Training seed copied.'), 'success');
  } catch (error) {
    const input = $('#trainingSeedInput');
    if (input) {
      input.value = String(seed);
      input.select();
    }
    toast(t('Seed placed in the field. Copy it from there.'), 'info');
  }
}

function handleTrainingKeyboardShortcut(event) {
  if (!trainingModeIsVisible() || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const target = event.target;
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
  if ($('#cardModal')?.classList.contains('show')) return;

  if (/^[1-6]$/.test(event.key) && app.training.lifecycle === 'ready') {
    const buttons = [...document.querySelectorAll('#trainingGuessButtons button:not([hidden])')];
    const button = buttons[Number(event.key) - 1];
    if (button) {
      event.preventDefault();
      event.stopImmediatePropagation();
      button.click();
    }
    return;
  }
  if (event.key === 'Enter' && app.training.lifecycle === 'feedback' && target?.tagName !== 'BUTTON') {
    event.preventDefault();
    event.stopImmediatePropagation();
    $('#trainingNextHandBtn')?.click();
    return;
  }
  if (event.key.toLowerCase() === 'r' && app.training.currentExercise) {
    event.preventDefault();
    event.stopImmediatePropagation();
    replayTrainingExercise(app.training.currentExercise.seed);
  }
}

function initTrainingMode() {
  const bind = (selector, eventName, handler) => {
    const element = $(selector);
    if (!element || element.dataset.bound) return;
    element.dataset.bound = 'true';
    element.addEventListener(eventName, handler);
  };

  bind('#trainingResetStats', 'click', resetTrainingStats);
  bind('#trainingNewHand', 'click', () => startConfiguredTrainingSession());
  bind('#trainingNextHandBtn', 'click', () => requestNextTrainingExercise());
  bind('#trainingRetryButton', 'click', () => requestNextTrainingExercise({ retry: true }));
  document.querySelectorAll('[data-training-session-mode]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => setTrainingSessionMode(button.dataset.trainingSessionMode));
  });
  bind('#trainingRestartSession', 'click', () => startConfiguredTrainingSession());
  bind('#trainingReplayBtn', 'click', () => app.training.currentExercise
    && replayTrainingExercise(app.training.currentExercise.seed));
  bind('#trainingReplayDecisionBtn', 'click', () => app.training.currentExercise
    && replayTrainingExercise(app.training.currentExercise.seed));
  bind('#trainingGenerateSeed', 'click', () => {
    const seed = selectedTrainingSeed();
    if (seed !== null) startConfiguredTrainingSession({ seed });
  });
  bind('#trainingCopySeed', 'click', copyCurrentTrainingSeed);
  bind('#trainingAdjustDrill', 'click', () => {
    $('#trainingAdvanced')?.removeAttribute('open');
    const selector = trainingSessionMode() === 'varied'
      ? '#trainingSessionLength'
      : '#trainingStreet';
    $(selector)?.focus({ preventScroll: false });
  });

  bind('#trainingRevealHint', 'click', revealNextTrainingStudyHint);
  bind('#trainingDifficulty', 'change', updateAssistanceDisplay);
  bind('#trainingStreet', 'change', updateTrainingFilterAvailability);
  bind('#trainingDecisionTarget', 'change', updateTrainingFilterAvailability);
  bind('#trainingHeroPos', 'change', updateTrainingFilterAvailability);

  bind('#trainingPlayers', 'input', function syncTrainingPlayers() {
    $('#trainingPlayersNum').value = this.value;
    updateTrainingPositions();
    updateTrainingFilterAvailability();
  });
  bind('#trainingPlayersNum', 'input', function syncTrainingPlayersNumber() {
    $('#trainingPlayers').value = this.value;
    updateTrainingPositions();
    updateTrainingFilterAvailability();
  });
  bind('#trainingStack', 'input', function syncTrainingStack() {
    $('#trainingStackNum').value = this.value;
  });
  bind('#trainingStackNum', 'input', function syncTrainingStackNumber() {
    $('#trainingStack').value = this.value;
  });

  if (!document.documentElement.dataset.trainingKeyboardBound) {
    document.documentElement.dataset.trainingKeyboardBound = 'true';
    document.addEventListener('keydown', handleTrainingKeyboardShortcut);
  }
  updateTrainingPositions();
  updateTrainingFilterAvailability();
  setTrainingSessionMode('varied', { reset: false });
  setTrainingWorkspaceState('idle');
  updateTrainingStats();
}




// Keep Training cards as a read-only projection of the generated exercise.
function renderTrainingCards() {
  if (!trainingModeIsVisible()) return;

  const heroCards = app.training.hero || [];
  const boardCards = app.training.board || [];
  const readOnlyCard = (card) =>
    `<span class="training-readonly-card riverline-card" role="img" aria-label="${displayCard(card)}">${cardMarkup(card)}</span>`;
  const heroTarget = $('#trainingHeroCards');
  const boardTarget = $('#trainingBoardCards');
  const tableSummary = document.querySelector('.training-table-summary');
  if (tableSummary) tableSummary.dataset.boardState = boardCards.length ? 'board' : 'empty';
  if (heroTarget) heroTarget.innerHTML = heroCards.map(readOnlyCard).join('');
  if (boardTarget) {
    boardTarget.innerHTML = boardCards.length
      ? boardCards.map(readOnlyCard).join('')
      : `<span class="training-no-board">${t('No board cards')}</span>`;
  }
  if ($('#trainingHandDisplay')) {
    $('#trainingHandDisplay').textContent = heroCards.length === 2
      ? formatHand(heroCards) || heroCards.map(displayCard).join(' ')
      : '—';
  }
}


function updateAssistanceDisplay() {
  const diffSelect = $('#trainingDifficulty');
  const level = diffSelect ? diffSelect.value : 'hard';

  const details = document.querySelectorAll('#trainingMode .pot-math-detail');
  const hintBox = $('#trainingHintBox');
  const hintText = $('#trainingHintText');

  if (level === 'hard') {
    details.forEach(el => el.style.display = 'none');
    if (hintBox) hintBox.style.display = 'none';
  } else if (level === 'easy') {
    details.forEach(el => el.style.display = 'inline-block');
    if (hintBox) hintBox.style.display = 'none';
  } else if (level === 'guided') {
    details.forEach(el => el.style.display = 'inline-block');
    if (hintBox) {
      hintBox.style.display = 'block';
      if (hintText && app.training?.currentContext) {
        const ctx = app.training.currentContext;
        const heroPos = ctx.hero_pos || 'UTG';
        const facing = ctx.facingSize || 0;
        const callAmount = ctx.callAmount;
        const odds = ctx.potOdds === null ? null : ctx.potOdds.toFixed(1);
        const mdf = ctx.mdf === null ? null : ctx.mdf.toFixed(1);

        if (callAmount !== null && callAmount > 0) {
          hintText.textContent = t('The nominal wager is {facing} bb; Hero must call {call} bb in {position}. Pot odds require at least {odds}% raw equity to call. MDF ({mdf}%) is a range-level reference, not a threshold for this hand. Consider position and blockers before choosing.', {
            facing: facing.toFixed(1), call: callAmount.toFixed(1), position: heroPos, odds, mdf
          });
        } else {
          hintText.textContent = t('Unopened/Checked spot in {position}. Consider positional advantage and range-building when deciding between opening/betting or checking.', { position: heroPos });
        }
      }
    }
  }
}

function resetTrainingStudyHints(exercise = null) {
  app.training.studyHintStep = 0;
  app.training.studyHintExplanation = null;
  const region = $('#trainingStudyHints');
  const content = $('#trainingStudyHintContent');
  const button = $('#trainingRevealHint');
  if (content) content.replaceChildren();
  if (region) region.hidden = !exercise;
  if (button) {
    button.hidden = !exercise;
    button.disabled = !exercise;
    button.textContent = t('Get a hint');
  }
}

function trainingStudyHintExplanation(exercise) {
  const bridge = globalThis.RiverlineAnalysisExplanation;
  if (!exercise || !bridge || typeof bridge.create !== 'function') return null;
  const history = trainingActionHistoryForAnalysis(app.training.currentPresentation || exercise.presentation);
  return bridge.create({
    decisionContext: exercise.decisionContext,
    strategyResult: exercise.strategyResult,
    trustedFacts: trustedAnalysisFacts(history),
    authority: 'training',
    depth: 'concise'
  });
}

function revealNextTrainingStudyHint() {
  const exercise = app.training.currentExercise;
  if (app.training.lifecycle !== 'ready' || !exercise || typeof renderAnalysisStudyHints !== 'function') return;
  const explanation = app.training.studyHintExplanation || trainingStudyHintExplanation(exercise);
  if (!explanation) return;
  app.training.studyHintExplanation = explanation;
  app.training.studyHintStep = Math.min(3, app.training.studyHintStep + 1);
  renderAnalysisStudyHints($('#trainingStudyHintContent'), explanation, app.training.studyHintStep);
  if (window.SoundFX) window.SoundFX.playHint();
  const button = $('#trainingRevealHint');
  if (button) {
    const complete = app.training.studyHintStep >= 3;
    button.disabled = complete;
    button.textContent = t(complete ? 'All hints viewed' : 'Another hint');
  }
}

function showTrainingFeedback(feedback, isCorrect) {

  const feedbackDiv = $('#trainingFeedback');

  const titleEl = $('#feedbackTitle');

  const textEl = $('#feedbackText');

  

  if (titleEl) titleEl.textContent = feedback.title;

  if (textEl) textEl.textContent = feedback.text;

  

  if (feedbackDiv) {
    feedbackDiv.hidden = false;
    feedbackDiv.dataset.accepted = String(Boolean(isCorrect));
    feedbackDiv.classList.add('animate-feedback');
  }

}



function showTrainingSolution(solution) {

  console.log('[Training] showTrainingSolution called with:', solution);

  const solutionDiv = $('#trainingSolution');

  if (!solutionDiv) return;

  const eyebrow = $('#trainingSolutionEyebrow');
  if (eyebrow) {
    eyebrow.textContent = t('After-answer reference');
    eyebrow.dataset.i18n = 'After-answer reference';
  }
  const note = solutionDiv.querySelector?.('.training-reference-note');
  if (note) note.textContent = t('Probabilities from the displayed strategy source; no EV is implied.');

  const actionsList = (Array.isArray(solution) ? solution : []).map((entry) => ({
    action: entry.action,
    name: entry.name,
    pct: entry.value,
    kind: visualActionKind(entry),
    color: actionVisualColor(entry)
  }));

  actionsList.sort((a, b) => b.pct - a.pct);

  if (typeof renderFrequencyStack === 'function') {
    renderFrequencyStack($('#trainingFrequencyStack'), actionsList.map((action) => ({
      name: action.name,
      value: action.pct,
      kind: action.kind,
      action: action.action
    })));
  }

  const rows = $('#trainingFrequencyRows');
  const evaluation = app.training.currentEvaluation;
  if (rows) {
    rows.innerHTML = '';
    actionsList.forEach((action) => {
      const isChosen = evaluation
        && action.action?.type === evaluation.mappedStrategyAction?.type;
      const isBest = evaluation
        && action.action?.type === evaluation.bestStrategyAction?.type;
      const row = document.createElement('div');
      row.className = 'training-frequency-row';
      row.dataset.actionKind = action.kind;
      row.classList.toggle('is-chosen', Boolean(isChosen));
      row.classList.toggle('is-best', Boolean(isBest));
      const label = document.createElement('span');
      label.className = 'training-frequency-label';
      const name = document.createElement('span');
      name.className = 'training-frequency-name';
      name.textContent = t(action.name);
      const markers = document.createElement('span');
      markers.className = 'training-frequency-markers';
      if (isChosen) markers.append(Object.assign(document.createElement('em'), {
        className: 'training-frequency-marker training-frequency-marker--chosen',
        textContent: t('Chosen')
      }));
      if (isBest) markers.append(Object.assign(document.createElement('em'), {
        className: 'training-frequency-marker training-frequency-marker--highest',
        textContent: t('Highest')
      }));
      label.append(name, markers);
      const track = document.createElement('span');
      track.className = 'training-frequency-track';
      const fill = document.createElement('i');
      fill.style.width = `${action.pct}%`;
      track.appendChild(fill);
      const value = document.createElement('strong');
      value.textContent = `${action.pct}%`;
      row.setAttribute('aria-label', `${t(action.name)}: ${action.pct}%${isChosen ? `, ${t('chosen action')}` : ''}${isBest ? `, ${t('highest frequency')}` : ''}`);
      row.append(label, track, value);
      rows.appendChild(row);
    });
  }

  // Render frequency bars in descending sorted order!
  for (let i = 1; i <= 3; i++) {
    const item = actionsList[i - 1];
    const nameEl = $(`#tf${i}name`);
    const fillEl = $(`#tf${i}`);
    const numEl = $(`#tf${i}num`);

    if (item) {
      if (nameEl) nameEl.textContent = t(item.name);
      if (fillEl) {
        fillEl.style.width = item.pct + '%';
        fillEl.style.removeProperty('background');
        fillEl.dataset.actionKind = item.kind;
        fillEl.setAttribute('aria-label', `${t(item.name)}: ${item.pct}%`);
      }
      if (numEl) numEl.textContent = item.pct + '%';
      if (nameEl?.parentElement) nameEl.parentElement.style.display = 'flex';
    } else {
      if (nameEl?.parentElement) nameEl.parentElement.style.display = 'none';
    }
  }

  solutionDiv.hidden = false;
  solutionDiv.classList.add('animate-solution');

}



function updateTrainingStats() {

  const totalEl = $('#trainingTotalHands');

  const correctEl = $('#trainingCorrect');

  const accuracyEl = $('#trainingAccuracy');

  const streakEl = $('#trainingStreak');
  const bestStreakEl = $('#trainingBestStreak');

  

  if (totalEl) totalEl.textContent = app.training.stats.totalHands;

  if (correctEl) correctEl.textContent = app.training.stats.correct;

  

  const accuracy = app.training.stats.totalHands > 0

    ? (app.training.stats.correct / app.training.stats.totalHands * 100).toFixed(1)

    : '0';

  if (accuracyEl) accuracyEl.textContent = accuracy + '%';

  if (streakEl) streakEl.textContent = app.training.stats.streak;
  if (bestStreakEl) bestStreakEl.textContent = app.training.bestStreak || 0;
  if ($('#trainingOptimalCount')) $('#trainingOptimalCount').textContent = app.training.gradeStats?.optimal || 0;
  if ($('#trainingAcceptableCount')) $('#trainingAcceptableCount').textContent = app.training.gradeStats?.acceptable || 0;
  if ($('#trainingMistakeCount')) $('#trainingMistakeCount').textContent = app.training.gradeStats?.mistake || 0;

  console.log('[Training] updateTrainingStats:', app.training.stats, 'accuracy:', accuracy + '%');
}



function resetTrainingStats() {

  console.log('[Training] resetTrainingStats called');

  app.training.stats = { totalHands: 0, correct: 0, streak: 0 };
  app.training.gradeStats = { optimal: 0, acceptable: 0, mistake: 0 };
  app.training.bestStreak = 0;

  updateTrainingStats();

  const scoreBadge = $('#trainingScoreBadge');

  if (scoreBadge) scoreBadge.hidden = true;

}



function formatHand(cards) {

  if (!cards || cards.length !== 2) return '';

  const [c1, c2] = cards;

  const r1 = c1[0], r2 = c2[0];

  const s1 = c1[1], s2 = c2[1];

  const val1 = RANK_VALUE[r1] || 0;

  const val2 = RANK_VALUE[r2] || 0;

  

  if (r1 === r2) {

    return r1 + r2;

  }

  const suitedChar = (s1 === s2) ? 's' : 'o';

  return val1 >= val2 ? (r1 + r2 + suitedChar) : (r2 + r1 + suitedChar);

}




const TRAINING_CONFIG_SCHEMA_VERSION = 'training-config/v1';
const TRAINING_CONFIG_V2_SCHEMA_VERSION = 'training-config/v2';

const TRAINING_TARGETS = Object.freeze({
  PREFLOP_UNOPENED: 'preflop_unopened',
  PREFLOP_FACING_OPEN: 'preflop_facing_open',
  PREFLOP_FACING_3BET: 'preflop_facing_3bet',
  PREFLOP_FACING_4BET: 'preflop_facing_4bet',
  PREFLOP_BB_OPTION: 'preflop_bb_option',
  POSTFLOP_FIRST_ACTION: 'postflop_first_action',
  POSTFLOP_FACING_BET: 'postflop_facing_bet',
  POSTFLOP_FACING_RAISE: 'postflop_facing_raise'
});

function nextTrainingSeed(seed) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

function trainingSessionMode() {
  return app.training.sessionMode === 'focused' ? 'focused' : 'varied';
}

function trainingSessionLength() {
  const value = $('#trainingSessionLength')?.value || '10';
  return value === 'open' ? null : Number.parseInt(value, 10);
}

function clearTrainingSessionCompletion() {
  app.training.practiceSession = null;
  if ($('#trainingSessionCompletion')) $('#trainingSessionCompletion').hidden = true;
  if ($('#trainingSessionCompletionText')) $('#trainingSessionCompletionText').textContent = '';
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) nextBtn.hidden = false;
}

function updateTrainingSessionProgress() {
  const progress = $('#trainingSessionProgress');
  const session = app.training.practiceSession;
  if (!progress || !session || session.mode !== 'varied' || session.isOpen) {
    if (progress) progress.hidden = true;
    return;
  }
  const plannerState = callTrainingServiceBridge('getPracticePlannerState');
  const served = plannerState?.servedCount || 0;
  progress.hidden = false;
  progress.textContent = `${served} / ${session.length}`;
}

function clearTrainingSessionState() {
  callTrainingServiceBridge('reset');
  clearTrainingSessionCompletion();
  app.training.stats = { totalHands: 0, correct: 0, streak: 0 };
  app.training.gradeStats = { optimal: 0, acceptable: 0, mistake: 0 };
  app.training.bestStreak = 0;
  app.training.currentExercise = null;
  app.training.currentStrategyResult = null;
  app.training.currentEvaluation = null;
  app.training.currentPresentation = null;
  app.training.currentSolution = null;
  app.training.currentHand = null;
  app.training.hero = [];
  app.training.board = [];
  clearTrainingExercisePresentation();
  updateTrainingStats();
  updateTrainingSessionProgress();
  if ($('#trainingFilterMessage')) $('#trainingFilterMessage').textContent = t('Training session reset.');
  setTrainingWorkspaceState('idle');
}

function setTrainingSessionMode(mode, { reset = true } = {}) {
  const nextMode = mode === 'focused' ? 'focused' : 'varied';
  app.training.sessionMode = nextMode;
  document.querySelectorAll('[data-training-session-mode]').forEach((button) => {
    const selected = button.dataset.trainingSessionMode === nextMode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if ($('#trainingVariedControls')) $('#trainingVariedControls').hidden = nextMode !== 'varied';
  if ($('#trainingFocusedControls')) $('#trainingFocusedControls').hidden = nextMode !== 'focused';
  if ($('#trainingSetupTitle')) {
    const key = nextMode === 'varied' ? 'Plan a varied session' : 'Choose a decision family';
    $('#trainingSetupTitle').dataset.i18n = key;
    $('#trainingSetupTitle').textContent = t(key);
  }
  if ($('#trainingNewHand')) {
    const key = nextMode === 'varied' ? 'Start varied session' : 'Generate exercise';
    $('#trainingNewHand').dataset.i18n = key;
    $('#trainingNewHand').textContent = t(key);
  }
  if (reset) clearTrainingSessionState();
}

function readTrainingConfig(seed) {
  const tableSize = numericValue('#trainingPlayers', 6);
  const stackBb = numericValue('#trainingStack', 30);
  const heroPosition = $('#trainingHeroPos')?.value || POSITIONS[tableSize]?.[0] || 'BTN';
  const street = $('#trainingStreet')?.value || 'any';
  const target = $('#trainingDecisionTarget')?.value || 'any';
  const streets = street === 'any' ? ['preflop', 'flop', 'turn', 'river'] : [street];
  const preflopTargets = [
    TRAINING_TARGETS.PREFLOP_UNOPENED,
    TRAINING_TARGETS.PREFLOP_FACING_OPEN,
    TRAINING_TARGETS.PREFLOP_FACING_3BET,
    TRAINING_TARGETS.PREFLOP_FACING_4BET,
    TRAINING_TARGETS.PREFLOP_BB_OPTION
  ];
  const postflopTargets = [
    TRAINING_TARGETS.POSTFLOP_FIRST_ACTION,
    TRAINING_TARGETS.POSTFLOP_FACING_BET,
    TRAINING_TARGETS.POSTFLOP_FACING_RAISE
  ];
  const allowedDecisionTypes = target !== 'any'
    ? [target]
    : street === 'preflop'
      ? preflopTargets
      : street === 'any' ? [...preflopTargets, ...postflopTargets] : postflopTargets;
  const legacyCompatibilityInput = {
    schemaVersion: TRAINING_CONFIG_SCHEMA_VERSION,
    tableSize,
    stackBb,
    streets,
    gameMode: 'home',
    heroPositions: [heroPosition],
    allowedDecisionTypes,
    difficulty: $('#trainingDifficulty')?.value || 'hard',
    seed: seed >>> 0
  };
  return callTrainingServiceBridge(
    'createConfigFromLegacyCompatibility',
    legacyCompatibilityInput
  ) || legacyCompatibilityInput;
}

function trainingStrategyResultToPresentation(strategyResult) {
  if (!strategyResult || strategyResult.schemaVersion !== strategyProvider.resultSchemaVersion) {
    throw new TypeError('Training requires StrategyResult v1');
  }
  return strategyResultPresentationActions(strategyResult);
}

function trainingContextPresentationAdapter(decisionContext) {
  const facingSize = decisionContext.facingSizeBb;
  const callAmount = Number.isFinite(decisionContext.callAmountBb)
    ? decisionContext.callAmountBb
    : null;
  const potSize = decisionContext.potBb;
  return {
    table_size: decisionContext.tableSize,
    stack: decisionContext.stackBb,
    hero_pos: decisionContext.heroPosition,
    street: decisionContext.street,
    lastAction: decisionContext.lastAction,
    potSize,
    facingSize,
    callAmount,
    potOdds: callAmount !== null && callAmount > 0 ? callAmount / (potSize + callAmount) * 100 : null,
    mdf: callAmount !== null && callAmount > 0 ? potSize / (potSize + callAmount) * 100 : null,
    board: [...decisionContext.board],
    rakeMode: decisionContext.rakeMode,
    forcedContributionPerPlayerBb: decisionContext.forcedContributionPerPlayerBb,
    totalForcedContributionBb: decisionContext.totalForcedContributionBb
  };
}

function formatTrainingFacingCopy(context) {
  const callAmount = Number(context?.callAmountBb);
  const facingSize = Number(context?.facingSizeBb);
  if (Number.isFinite(callAmount) && callAmount > 0) {
    const callCopy = t('{value} bb to call', { value: callAmount.toFixed(1) });
    return Number.isFinite(facingSize) && Math.abs(facingSize - callAmount) > 0.001
      ? t('Facing {value} bb · {callCopy}', { value: facingSize.toFixed(1), callCopy })
      : callCopy;
  }
  return context?.street === 'preflop' && context?.heroPosition !== 'BB'
    ? t('0.0 bb (Unopened)')
    : t('0.0 bb (Free Check)');
}

function trainingActionLabel(type, decisionContext) {
  if (type === 'all_in') return 'All-in';
  if (type === 'raise' && decisionContext.street === 'preflop') {
    if (decisionContext.lastAction === 'unopened') return 'Open';
    if (decisionContext.lastAction === 'raise') return '3-Bet';
    if (decisionContext.lastAction === '3bet') return '4-Bet';
    if (decisionContext.lastAction === '4bet') return '5-Bet';
  }
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function canonicalTrainingLegalActionTypes(exercise) {
  const spec = exercise?.legalActions;
  if (!spec) return [];
  return ['fold', 'check', 'call', 'bet', 'raise', 'all_in'].filter((type) => (
    type === 'all_in' ? spec.allIn?.available : spec[type]?.available
  ));
}

function setTrainingWorkspaceState(state) {
  const workspace = document.querySelector('.training-workspace');
  if (!workspace) return;
  workspace.dataset.trainingState = state;
  workspace.setAttribute('aria-busy', String(state === 'generating'));
  const stateBadge = $('#trainingStateBadge');
  const labels = { idle: 'Idle', generating: 'Generating', ready: 'Decision ready', feedback: 'Feedback', error: 'Error' };
  if (stateBadge) {
    stateBadge.textContent = t(labels[state] || state);
    stateBadge.className = `badge status-badge status-badge--${state === 'error' ? 'warning' : state === 'ready' ? 'available' : 'info'}`;
  }
  if ($('#trainingIdle')) $('#trainingIdle').hidden = state !== 'idle';
  if ($('#trainingGenerating')) $('#trainingGenerating').hidden = state !== 'generating';
  if ($('#trainingError')) $('#trainingError').hidden = state !== 'error';
  if ($('#trainingExerciseSurface')) $('#trainingExerciseSurface').hidden = !['ready', 'feedback'].includes(state);
  if ($('#trainingFeedback')) $('#trainingFeedback').hidden = state !== 'feedback';
}

function clearTrainingExercisePresentation() {
  resetTrainingStudyHints();
  if ($('#trainingExerciseTags')) $('#trainingExerciseTags').innerHTML = '';
  if ($('#trainingActionHistory')) $('#trainingActionHistory').innerHTML = `<li class="is-empty">${t('Generating a new canonical trajectory.')}</li>`;
  if ($('#trainingCurrentActor')) $('#trainingCurrentActor').textContent = t('No decision loaded.');
  if ($('#trainingStrategySource')) {
    $('#trainingStrategySource').textContent = t('Source pending');
    $('#trainingStrategySource').className = 'badge status-badge status-badge--info';
  }
  ['#trainingCurrentSeed', '#trainingExerciseId', '#trainingGenerationAttempts', '#trainingTrajectoryLength', '#trainingGenerationPolicy']
    .forEach((selector) => { if ($(selector)) $(selector).textContent = '—'; });
  if ($('#trainingCopySeed')) $('#trainingCopySeed').disabled = true;
  if ($('#trainingReplayBtn')) $('#trainingReplayBtn').disabled = true;
}

function renderTrainingPresentation(exercise) {
  const presentation = callTrainingPresentationBridge('createViewModel', exercise);
  app.training.currentPresentation = presentation;
  if (!presentation) return;
  const tags = $('#trainingExerciseTags');
  if (tags) {
    tags.innerHTML = '';
    presentation.tags.forEach((label) => {
      const tag = document.createElement('span');
      tag.className = 'badge training-curriculum-tag';
      const tableSizeMatch = String(label).match(/^(\d+)-MAX$/);
      tag.textContent = tableSizeMatch
        ? t('analysis.value.tableSize', { count: tableSizeMatch[1] })
        : t(label);
      tags.appendChild(tag);
    });
  }
  const history = $('#trainingActionHistory');
  if (history) {
    history.innerHTML = '';
    if (presentation.actionHistory.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'is-empty';
      empty.textContent = t('No voluntary action precedes this decision.');
      history.appendChild(empty);
    } else {
      presentation.actionHistory.forEach((entry) => {
        const item = document.createElement('li');
        item.dataset.street = entry.street;
        item.classList.toggle('is-hero', entry.isHero);
        const street = document.createElement('span');
        street.className = 'training-history-street';
        street.textContent = t(entry.street.charAt(0).toUpperCase() + entry.street.slice(1));
        const action = document.createElement('span');
        action.className = 'training-history-action';
        action.textContent = `${t(entry.actorLabel)} · ${t(entry.actionLabel)}${entry.amountLabel ? ` ${entry.amountLabel}` : ''}`;
        item.append(street, action);
        history.appendChild(item);
      });
    }
  }
  if ($('#trainingCurrentActor')) $('#trainingCurrentActor').textContent = t('{player} ({position}) is next to act.', {
    player: presentation.currentActor.isHero ? t('Hero') : t(presentation.currentActor.label),
    position: presentation.currentActor.position || t('position unavailable')
  });
  if ($('#trainingCurrentSeed')) $('#trainingCurrentSeed').textContent = String(presentation.seed);
  if ($('#trainingExerciseId')) $('#trainingExerciseId').textContent = presentation.exerciseId;
  if ($('#trainingGenerationAttempts')) $('#trainingGenerationAttempts').textContent = presentation.metadata.attempts ?? '—';
  if ($('#trainingTrajectoryLength')) $('#trainingTrajectoryLength').textContent = presentation.metadata.trajectoryLength ?? '—';
  if ($('#trainingGenerationPolicy')) $('#trainingGenerationPolicy').textContent = presentation.metadata.policy ?? '—';
  if ($('#trainingCopySeed')) $('#trainingCopySeed').disabled = false;
  if ($('#trainingReplayBtn')) $('#trainingReplayBtn').disabled = false;
  if ($('#trainingReplayDecisionBtn')) $('#trainingReplayDecisionBtn').hidden = false;
}

function updateTrainingButtons(exercise) {
  const container = $('#trainingGuessButtons');
  if (!container) return;
  container.innerHTML = '';
  const presentationByType = new Map((app.training.currentPresentation?.legalActions || []).map((entry) => [entry.type, entry]));
  canonicalTrainingLegalActionTypes(exercise).forEach((type, index) => {
    const semanticLabel = trainingActionLabel(type, exercise.decisionContext);
    const label = t(semanticLabel) || semanticLabel;
    const sizing = presentationByType.get(type);
    const boundsLabel = sizing?.boundsLabel?.endsWith(' to')
      ? t('to {range}', { range: sizing.boundsLabel.slice(0, -3) })
      : sizing?.boundsLabel;
    const sizingLabel = boundsLabel || sizing?.amountLabel || '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ui-button training-action-button training-action-button--${type}`;
    button.dataset.action = type;
    button.setAttribute('aria-keyshortcuts', String(index + 1));
    button.setAttribute('aria-label', `${label}${sizingLabel ? `, ${sizingLabel}` : ''}`);
    const copy = document.createElement('span');
    copy.className = 'training-action-copy';
    const name = document.createElement('strong');
    name.textContent = label;
    const detail = document.createElement('small');
    detail.textContent = sizingLabel || t('No size required');
    copy.append(name, detail);
    const shortcut = document.createElement('kbd');
    shortcut.textContent = String(index + 1);
    button.append(copy, shortcut);
    button.addEventListener('click', () => handleTrainingGuess(type));
    container.appendChild(button);
  });
  container.hidden = false;
}

function renderTrainingSource(exercise) {
  const source = exercise?.strategyResult?.source || 'unavailable';
  const sourceElement = $('#trainingStrategySource');
  if (!sourceElement) return;
  const label = strategySourceDisplayLabel(source);
  sourceElement.textContent = label;
  sourceElement.title = t('Strategy source: {source}. Exercise seed {seed}.', { source: label, seed: exercise.seed });
  const tone = source.startsWith('heuristic_') ? 'heuristic' : 'info';
  sourceElement.className = `badge status-badge status-badge--${tone}`;
}

function renderTrainingGenerationError(error) {
  app.training.lifecycle = 'error';
  console.error('[Riverline Training generation]', error);
  app.training.currentPresentation = null;
  setTrainingWorkspaceState('error');
  const errorCopy = {
    invalid_config: [t('Check the drill setup'), t('One or more filters are outside the supported TrainingConfig range.')],
    unsupported_rules: [t('Unsupported rules'), t('This Game Rules mode cannot generate Training exercises. Choose a supported rules mode and try again.')],
    no_eligible_candidates: [t('No eligible exercise'), t('The selected Varied Session preferences have no eligible Training candidate.')],
    impossible_focused_request: [t('No matching exercise found'), t('The Focused Drill constraints cannot be planned together. Adjust the drill and try again.')],
    unsupported_target: [t('Unsupported filter combination'), t('Choose a street and decision target that belong to the same decision family.')],
    generation_exhausted: [t('No matching exercise found'), t('The bounded generator could not reach this exact combination. Broaden a filter and try again.')],
    decision_projection_unavailable: [t('Decision context unavailable'), t('The generated hand could not be projected safely for the strategy path.')],
    strategy_unavailable: [t('Strategy reference unavailable'), t('The current strategy path did not return a gradeable StrategyResult.')],
    service_unavailable: [t('Training service unavailable'), t('Reload Riverline and try again. The canonical Training bridge did not load.')],
    internal_error: [t('Training could not continue'), t('An internal generation error occurred. Try another seed or adjust the drill.')]
  };
  const [title, message] = errorCopy[error?.code] || [t('Exercise unavailable'), t('Try again or adjust the drill.')];
  if ($('#trainingErrorTitle')) $('#trainingErrorTitle').textContent = title;
  if ($('#trainingErrorText')) $('#trainingErrorText').textContent = message;
  if ($('#trainingInstruction')) $('#trainingInstruction').textContent = message;
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.textContent = t('Try again');
  }
  const sourceElement = $('#trainingStrategySource');
  if (sourceElement) {
    sourceElement.textContent = t('Source unavailable');
    sourceElement.className = 'badge status-badge status-badge--warning';
  }
}

function renderTrainingDecisionContextSummary(exercise) {
  const context = exercise?.decisionContext;
  if (!context) return;
  const legacyContext = trainingContextPresentationAdapter(context);
  const streetLabel = $('#trainingStreetLabel');
  if (streetLabel) streetLabel.textContent = t(context.street.charAt(0).toUpperCase() + context.street.slice(1));
  const potInfo = $('#trainingPotInfo');
  if (potInfo) potInfo.style.removeProperty('display');
  if ($('#trainingPotVal')) $('#trainingPotVal').textContent = `${context.potBb.toFixed(1)} bb`;
  if ($('#trainingFacingVal')) $('#trainingFacingVal').textContent = formatTrainingFacingCopy(context);
  if ($('#trainingPotOddsVal')) $('#trainingPotOddsVal').textContent = legacyContext.potOdds === null ? '—' : `${legacyContext.potOdds.toFixed(1)}%`;
  if ($('#trainingMdfVal')) $('#trainingMdfVal').textContent = legacyContext.mdf === null
    ? t('— (range reference)')
    : t('{value}% (range reference)', { value: legacyContext.mdf.toFixed(1) });
  if (trainingSessionMode() === 'focused' && $('#trainingHeroPos')) {
    $('#trainingHeroPos').value = context.heroPosition;
  }
  if ($('#trainingPositionVal')) $('#trainingPositionVal').textContent = context.heroPosition;
  if ($('#trainingStackVal')) $('#trainingStackVal').textContent = `${context.stackBb.toFixed(1)}bb`;
  if ($('#trainingTableVal')) $('#trainingTableVal').textContent = t('analysis.value.tableSize', { count: context.tableSize });
}

function renderCanonicalTrainingExercise(exercise) {
  const context = exercise.decisionContext;
  const presentation = exercise.presentation;
  const legacyContext = trainingContextPresentationAdapter(context);
  app.training.currentExercise = exercise;
  app.training.currentStrategyResult = exercise.strategyResult;
  app.training.currentEvaluation = null;
  app.training.currentHand = [...presentation.heroCards];
  app.training.hero = [...presentation.heroCards];
  app.training.board = [...presentation.board];
  app.training.currentContext = legacyContext;
  app.training.currentSolution = trainingStrategyResultToPresentation(exercise.strategyResult);
  app.training.lifecycle = 'ready';
  setTrainingWorkspaceState('ready');
  renderTrainingPresentation(exercise);
  renderTrainingDecisionContextSummary(exercise);

  const feedbackDiv = $('#trainingFeedback');
  if (feedbackDiv) feedbackDiv.hidden = true;
  const trainingAnalysis = $('#trainingAnalysis');
  if (trainingAnalysis) {
    trainingAnalysis.replaceChildren();
    trainingAnalysis.hidden = true;
  }
  app.training.currentAnalysisExplanation = null;
  const solutionDiv = $('#trainingSolution');
  if (solutionDiv) solutionDiv.hidden = true;
  if ($('#trainingSolutionEyebrow')) {
    $('#trainingSolutionEyebrow').textContent = t('After-answer reference');
    $('#trainingSolutionEyebrow').dataset.i18n = 'After-answer reference';
  }
  const scoreBadge = $('#trainingScoreBadge');
  if (scoreBadge) scoreBadge.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.textContent = t('Skip / next exercise');
  }

  updateTrainingButtons(exercise);
  updateAssistanceDisplay();
  resetTrainingStudyHints(exercise);
  renderTrainingSource(exercise);
  updateTrainingSessionProgress();
  renderAllCards();
  document.querySelectorAll('#trainingHeroCards .training-readonly-card, #trainingBoardCards .training-readonly-card')
    .forEach((card, index) => {
      card.classList.add('is-card-dealt');
      card.style.setProperty('--card-deal-order', String(Math.min(index, 4)));
    });
  if (window.SoundFX) window.SoundFX.playCardDeal(presentation.heroCards.length + presentation.board.length);

}

function prepareTrainingGeneration({ preserveSession = false } = {}) {
  if (!preserveSession) clearTrainingSessionCompletion();
  else if ($('#trainingSessionCompletion')) $('#trainingSessionCompletion').hidden = true;
  app.training.lifecycle = 'generating';
  setTrainingWorkspaceState('generating');
  clearTrainingExercisePresentation();
  app.training.currentExercise = null;
  app.training.currentStrategyResult = null;
  app.training.currentEvaluation = null;
  app.training.currentPresentation = null;
  app.training.currentSolution = null;
  app.training.currentHand = null;
  app.training.hero = [];
  app.training.board = [];
  const handDisplay = $('#trainingHandDisplay');
  if (handDisplay) handDisplay.textContent = t('GENERATING…');
  const instruction = $('#trainingInstruction');
  if (instruction) instruction.textContent = t('Replaying a legal canonical hand trajectory.');
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) nextBtn.disabled = true;
  if ($('#trainingSolution')) $('#trainingSolution').hidden = true;
  if ($('#trainingReplayDecisionBtn')) $('#trainingReplayDecisionBtn').hidden = true;
  renderAllCards();
}

function variedSessionSeed(options = {}) {
  const explicitSeed = Number.isInteger(options?.seed) ? options.seed >>> 0 : null;
  const seed = explicitSeed === null ? app.training.nextSeed >>> 0 : explicitSeed;
  if (explicitSeed === null) app.training.nextSeed = nextTrainingSeed(seed);
  return seed;
}

function createVariedTrainingIntent(seed) {
  const config = readTrainingConfig(seed);
  if (!config || config.schemaVersion !== TRAINING_CONFIG_V2_SCHEMA_VERSION || !config.rulesSnapshot) {
    throw new Error('The canonical Training rules snapshot is unavailable.');
  }
  const length = trainingSessionLength();
  const rulesCapability = callTrainingServiceBridge('resolveRulesCapability', config.rulesSnapshot);
  const intent = callTrainingServiceBridge('createPracticeIntent', {
    schemaVersion: 'training-session-intent/v1',
    mode: 'varied',
    sessionSeed: seed,
    sessionLength: length === null ? 100000 : length,
    difficulty: $('#trainingDifficulty')?.value || 'hard',
    focusPreferences: {
      profile: $('#trainingVariedEmphasis')?.value || 'balanced',
      streetEmphasis: null,
      stackPreference: $('#trainingVariedStackPreference')?.value || 'balanced',
      allowedTableSizeFamilies: ['heads_up', 'short_handed', 'full_ring'],
    },
    rulesSnapshot: config.rulesSnapshot,
    rulesCapability,
    plannerPolicyVersion: 'training-practice-planner-policy/v2',
  });
  if (!intent) throw new Error('The canonical Training planner is unavailable.');
  return { intent, isOpen: length === null, length };
}

async function generatePlannedTrainingExercise() {
  prepareTrainingGeneration({ preserveSession: true });
  const request = callTrainingServiceBridge('generatePlanned', { strategyProvider });
  if (!request || typeof request.then !== 'function') {
    renderTrainingGenerationError({
      code: 'service_unavailable',
      message: 'The canonical Training service is unavailable.',
    });
    return null;
  }
  const result = await request;
  if (!result?.ok) {
    if (result?.error?.code !== 'stale_generation') renderTrainingGenerationError(result?.error);
    return result;
  }
  renderCanonicalTrainingExercise(result.exercise);
  updateTrainingSessionProgress();
  return result;
}

async function startConfiguredTrainingSession(options = {}) {
  const seed = variedSessionSeed(options);
  if ($('#trainingFilterMessage')) $('#trainingFilterMessage').textContent = '';
  if (trainingSessionMode() === 'focused') {
    clearTrainingSessionCompletion();
    return newRandomTrainingHand({ seed });
  }
  try {
    const session = createVariedTrainingIntent(seed);
    const plannerState = callTrainingServiceBridge('startPracticeSession', session.intent);
    if (!plannerState) throw new Error('The canonical Training planner session could not start.');
    app.training.practiceSession = {
      mode: 'varied',
      sessionSeed: seed,
      length: session.length,
      isOpen: session.isOpen,
      completed: false,
    };
    resetTrainingStats();
    updateTrainingSessionProgress();
    return generatePlannedTrainingExercise();
  } catch (error) {
    renderTrainingGenerationError({
      code: 'invalid_config',
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function completeVariedTrainingSession() {
  const session = app.training.practiceSession;
  if (!session || session.mode !== 'varied' || session.isOpen || session.completed) return false;
  const plannerState = callTrainingServiceBridge('getPracticePlannerState');
  if ((plannerState?.servedCount || 0) < session.length) return false;
  session.completed = true;
  updateTrainingSessionProgress();
  if ($('#trainingSessionCompletion')) $('#trainingSessionCompletion').hidden = false;
  if ($('#trainingSessionCompletionText')) {
    $('#trainingSessionCompletionText').textContent = t('{accepted} accepted from {attempts} attempts.', {
      accepted: app.training.stats.correct,
      attempts: app.training.stats.totalHands,
    });
  }
  if ($('#trainingNextHandBtn')) $('#trainingNextHandBtn').hidden = true;
  return true;
}

function requestNextTrainingExercise() {
  if (trainingSessionMode() === 'varied') {
    if (app.training.practiceSession?.completed) return null;
    if (completeVariedTrainingSession()) return null;
    if (app.training.practiceSession?.mode === 'varied') return generatePlannedTrainingExercise();
    return startConfiguredTrainingSession();
  }
  return newRandomTrainingHand();
}

async function newRandomTrainingHand(options = {}) {
  const explicitSeed = Number.isInteger(options?.seed) ? options.seed >>> 0 : null;
  const seed = explicitSeed === null ? app.training.nextSeed >>> 0 : explicitSeed;
  if (explicitSeed === null) app.training.nextSeed = nextTrainingSeed(seed);
  const config = [TRAINING_CONFIG_SCHEMA_VERSION, TRAINING_CONFIG_V2_SCHEMA_VERSION]
    .includes(options?.config?.schemaVersion)
    ? { ...structuredClone(options.config), seed }
    : readTrainingConfig(seed);

  prepareTrainingGeneration();

  const request = callTrainingServiceBridge('generate', config, { strategyProvider });
  if (!request || typeof request.then !== 'function') {
    renderTrainingGenerationError({
      code: 'service_unavailable',
      message: 'The canonical Training service is unavailable.'
    });
    return null;
  }

  const result = await request;
  if (!result?.ok) {
    if (result?.error?.code !== 'stale_generation') renderTrainingGenerationError(result?.error);
    return result;
  }
  renderCanonicalTrainingExercise(result.exercise);
  return result;
}

function canonicalTrainingFeedback(evaluation, strategyResult) {
  const source = strategySourceDisplayLabel(strategyResult.source);
  const heuristic = String(strategyResult.source || '').startsWith('heuristic_');
  const chosen = t(evaluation.mappedStrategyAction?.label
    || trainingActionLabel(evaluation.chosenAction.type, app.training.currentExercise.decisionContext));
  if (evaluation.grade === 'optimal') {
    return {
      title: t('Correct'),
      text: heuristic
        ? t('{action} matches Riverline\'s current reference. Compare the displayed action frequencies for the full mix.', { action: chosen })
        : t('{action} matches the current reference from {source}. Compare the displayed action frequencies for the full mix.', { source, action: chosen })
    };
  }
  if (evaluation.grade === 'acceptable') {
    return {
      title: t('Acceptable'),
      text: heuristic
        ? t('Acceptable mixed-strategy choice. Within the current strategy estimate, {action} remains close enough to the leading action.', { action: chosen })
        : t('Acceptable mixed-strategy choice from {source}. Compare the displayed reference for the full mix.', { source })
    };
  }
  return {
    title: t('Mistake'),
    text: heuristic
      ? t('Within the current strategy estimate, {action} is not the highest-frequency action. Compare the displayed action frequencies before the next decision. No EV estimate is available unless the strategy source supplies one.', { action: chosen })
      : t('{source} does not make {action} the highest-frequency action in the current reference. Compare the displayed action frequencies before the next decision. No EV estimate is available unless the strategy source supplies one.', { source, action: chosen })
  };
}

function trainingActionHistoryForAnalysis(presentation) {
  return (presentation?.actionHistory || []).map((entry) => {
    const parsedAmount = Number.parseFloat(String(entry.amountLabel || '').replace('bb', ''));
    return {
      sequence: entry.sequence,
      street: entry.street,
      actorLabel: entry.actorLabel,
      position: entry.position,
      actionType: entry.actionType,
      actionLabel: entry.actionLabel,
      amountBb: Number.isFinite(parsedAmount) ? parsedAmount : null,
      amountLabel: entry.amountLabel,
      isHero: entry.isHero
    };
  });
}

function renderTrainingDecisionAnalysis(exercise) {
  const container = $('#trainingAnalysis');
  if (!container || !exercise) return null;
  const history = trainingActionHistoryForAnalysis(app.training.currentPresentation || exercise.presentation);
  const explanation = renderDecisionAnalysis(container, {
    decisionContext: exercise.decisionContext,
    strategyResult: exercise.strategyResult,
    trustedFacts: trustedAnalysisFacts(history),
    authority: 'training',
    depth: 'concise',
    surface: 'training'
  });
  container.hidden = !explanation;
  app.training.currentAnalysisExplanation = explanation;
  return explanation;
}

function renderTrainingEvaluationSummary(evaluation, exercise) {
  if (!evaluation || !exercise) return;
  const scoreBadge = $('#trainingScoreBadge');
  if (scoreBadge) {
    scoreBadge.hidden = false;
    scoreBadge.textContent = `${t(evaluation.accepted ? 'Accepted' : 'Review')} · ${app.training.stats.correct}/${app.training.stats.totalHands}`;
    scoreBadge.dataset.accepted = String(evaluation.accepted);
  }
  const chosenLabel = t(trainingActionLabel(evaluation.chosenAction.type, exercise.decisionContext));
  if ($('#trainingGradeBadge')) {
    const publicGradeLabels = {
      optimal: 'Correct',
      acceptable: 'Acceptable',
      mistake: 'Mistake'
    };
    $('#trainingGradeBadge').textContent = t(publicGradeLabels[evaluation.grade] || 'Review');
    $('#trainingGradeBadge').className = `badge training-grade-badge training-grade-badge--${evaluation.grade}`;
  }
  if ($('#trainingFeedback')) $('#trainingFeedback').dataset.grade = evaluation.grade;
  if ($('#trainingChosenAction')) $('#trainingChosenAction').textContent = chosenLabel;
  if ($('#trainingChosenProbability')) $('#trainingChosenProbability').textContent = `${(evaluation.chosenProbability * 100).toFixed(0)}%`;
  if ($('#trainingBestProbability')) $('#trainingBestProbability').textContent = `${t(evaluation.bestStrategyAction.label)} · ${(evaluation.bestProbability * 100).toFixed(0)}%`;
  const evAvailable = evaluation.explanationData.evAvailable;
  if ($('#trainingEvFact')) $('#trainingEvFact').hidden = !evAvailable;
  if (evAvailable && $('#trainingEvValue')) {
    $('#trainingEvValue').textContent = `${evaluation.explanationData.chosenEvBb.toFixed(2)} bb ${t('vs')} ${evaluation.explanationData.bestEvBb.toFixed(2)} bb`;
  }
}

function handleTrainingGuess(userAction) {
  const exercise = app.training.currentExercise;
  if (app.training.lifecycle !== 'ready' || !exercise) return;
  const result = callTrainingServiceBridge('answer', exercise.id, userAction);
  if (!result?.ok) {
    if (result?.error?.code !== 'already_answered') {
      console.warn('[Riverline Training answer]', result?.error);
    }
    return;
  }

  const evaluation = result.evaluation;
  app.training.lifecycle = 'answered';
  app.training.currentEvaluation = evaluation;
  resetTrainingStudyHints();
  app.training.stats.totalHands += 1;
  app.training.stats.correct += evaluation.scoreDelta;
  app.training.stats.streak = evaluation.accepted ? app.training.stats.streak + 1 : 0;
  app.training.bestStreak = Math.max(app.training.bestStreak || 0, app.training.stats.streak);
  app.training.gradeStats[evaluation.grade] = (app.training.gradeStats[evaluation.grade] || 0) + 1;
  if (window.SoundFX) window.SoundFX.playTrainingResult(evaluation.grade);
  updateTrainingStats();

  renderTrainingEvaluationSummary(evaluation, exercise);
  showTrainingFeedback(
    canonicalTrainingFeedback(evaluation, exercise.strategyResult),
    evaluation.accepted
  );
  renderTrainingDecisionAnalysis(exercise);
  showTrainingSolution(app.training.currentSolution);
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.textContent = t('Next exercise');
  }
  app.training.lifecycle = 'feedback';
  setTrainingWorkspaceState('feedback');
  completeVariedTrainingSession();
}

function replayTrainingExercise(seed) {
  if (!Number.isInteger(Number(seed)) || Number(seed) < 0 || Number(seed) > 0xffffffff) {
    throw new RangeError('Training replay seed must be an unsigned 32-bit integer');
  }
  const numericSeed = Number(seed) >>> 0;
  const currentExercise = app.training.currentExercise;
  const config = currentExercise?.seed === numericSeed
    ? currentExercise.generationMetadata?.trainingConfig
    : null;
  if (trainingSessionMode() === 'varied' && config) {
    prepareTrainingGeneration({ preserveSession: true });
    const request = callTrainingServiceBridge('replay', config, { strategyProvider });
    if (!request || typeof request.then !== 'function') {
      renderTrainingGenerationError({ code: 'service_unavailable' });
      return null;
    }
    return request.then((result) => {
      if (!result?.ok) {
        if (result?.error?.code !== 'stale_generation') renderTrainingGenerationError(result?.error);
        return result;
      }
      renderCanonicalTrainingExercise(result.exercise);
      return result;
    });
  }
  return newRandomTrainingHand({ seed: numericSeed, config });
}

// ================================================================
// OUTS CALCULATOR
// ================================================================

/**
 * calculateOuts: Given hero cards, villain cards, and current board,
 * returns the list of cards that improve hero's hand to beat villain.
 * Only valid on flop (3 cards) or turn (4 cards).
 */
function calculateOuts(myCards, allOpponentsCards, boardCards, deadCards = []) {
  if (!myCards || myCards.length !== 2) return null;
  if (!allOpponentsCards || allOpponentsCards.length === 0) return null;
  if (!boardCards || boardCards.length < 3 || boardCards.length > 4) return null;

  const allUsed = new Set([...myCards, ...boardCards, ...deadCards].filter(Boolean));
  allOpponentsCards.forEach(cards => cards.forEach(c => { if (c) allUsed.add(c); }));
  
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const suits = ['s','h','d','c'];
  const deck = [];
  for (let r of ranks) for (let s of suits) { if (!allUsed.has(r + s)) deck.push(r + s); }

  const myCurrentScore = scoreSeven([...myCards, ...boardCards]);
  let maxOppCurrentScore = 0;
  for (let oppCards of allOpponentsCards) {
    if (oppCards && oppCards.length === 2) {
      const oppScore = scoreSeven([...oppCards, ...boardCards]);
      if (oppScore > maxOppCurrentScore) maxOppCurrentScore = oppScore;
    }
  }

  // If hero is already strictly ahead of all opponents
  if (myCurrentScore > maxOppCurrentScore) return { ahead: true };

  const CATEGORY_NAMES = {
    8: "Straight Flush",
    7: "Four of a Kind",
    6: "Full House",
    5: "Flush",
    4: "Straight",
    3: "Three of a Kind",
    2: "Two Pair",
    1: "Pair",
    0: "High Card"
  };

  const categoriesMap = {};
  let totalOuts = 0;

  for (let card of deck) {
    const testBoard = [...boardCards, card];
    const myFutureScore = scoreSeven([...myCards, ...testBoard]);
    
    let maxOppFutureScore = 0;
    for (let oppCards of allOpponentsCards) {
      if (oppCards && oppCards.length === 2) {
        const oppScore = scoreSeven([...oppCards, ...testBoard]);
        if (oppScore > maxOppFutureScore) maxOppFutureScore = oppScore;
      }
    }
    
    // Only count as an out if it strictly wins
    if (myFutureScore > maxOppFutureScore) {
      const cat = Math.floor(myFutureScore / 1e10);
      const catName = CATEGORY_NAMES[cat] || "Improved Hand";
      
      if (!categoriesMap[catName]) categoriesMap[catName] = { rank: cat, name: catName, cards: [] };
      categoriesMap[catName].cards.push(card);
      totalOuts++;
    }
  }

  const categories = Object.values(categoriesMap).sort((a, b) => b.rank - a.rank);

  return { ahead: false, count: totalOuts, categories: categories };
}
