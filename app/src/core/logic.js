

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

// Preserve the existing six-max modifiers while giving full-ring seats an
// explicit, monotonic progression between UTG and HJ.
const PREFLOP_FALLBACK_POSITION_MODIFIERS = Object.freeze({
  'UTG': -4.0,
  'UTG+1': -3.6,
  'UTG+2': -3.2,
  'MP': -2.8,
  'LJ': -2.4,
  'HJ': -2.0,
  'CO': -0.5,
  'BTN': 1.0,
  'SB': 1.5,
  'BB': 3.0
});

const PLAYBOOK_SCENARIO_SCHEMA_VERSION = 'playbook-scenario/v1';
const PLAYBOOK_MODES = Object.freeze({ SCENARIO: 'scenario', HAND: 'hand' });



const app = {
  settings: { tightness: 0, fourColorDeck: true, cardRankStyle: 'poker' },

  gto: { hero: [], board: [], dead: [] },

  equity: {

    board: [],

    dead: [],

    nextPlayerId: 2,

    players: [

      { id: 'equity-player-0', name: 'Hero', cards: [], handMode: 'known' },

      { id: 'equity-player-1', name: 'Opponent 1', cards: [], handMode: 'unknown' }

    ]

  },

  training: {

    hero: [],

    board: [],

    stats: { totalHands: 0, correct: 0, streak: 0 },

    gradeStats: { optimal: 0, acceptable: 0, mistake: 0 },

    bestStreak: 0,

    showSolutionImmediately: false,

    currentHand: null,

    currentSolution: null,

    currentExercise: null,

    currentStrategyResult: null,

    currentEvaluation: null,

    currentPresentation: null,

    currentAnalysisExplanation: null,

    lifecycle: 'idle',

    nextSeed: Date.now() >>> 0

  },

  playbookHandDraft: { bySeat: {}, board: [] },

  picker: null,

  chartStreet: 'preflop',

  selectedHand: null,

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
  
  // Enhanced card markup with better visual hierarchy
  const rank = displayCardRank(card[0]);
  const rankClass = rank === '10' ? ' rank--ten' : '';
  return `<span class="rank${rankClass} s-${suit.id}">${rank}</span><span class="suit s-${suit.id}">${suit.symbol}</span><span class="corner-rank${rankClass} s-${suit.id}">${rank}</span>`;

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
    return `<button type="button" class="card-slot card--${state}${card ? ' filled' : ''}${suitClass} riverline-card" data-card-state="${state}" data-group="${group}" data-index="${index}" aria-label="${card ? 'Replace ' + displayCard(card) + (state === 'dead' ? ', dead card' : '') : 'Choose card ' + (index + 1)}">${cardMarkup(card)}</button>`;

  }).join('');

}



function equityPlayerLabel(playerIndex) {
  return playerIndex === 0 ? t('Hero') : `${t('Player')} ${playerIndex + 1}`;
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
      ? 'Random hand from the remaining deck'
      : (cardCount === 2 ? 'Known two-card hand' : `Known hand incomplete · ${cardCount} / 2 cards`);
    return `
      <article class="equity-player-card" data-player-id="${player.id}" data-player-series="${playerIndex}" data-hand-state="${handState}">
        <header class="equity-player-head">
          <span class="equity-player-identity"><i class="series-marker" aria-hidden="true"></i><strong>${label}</strong><small>${status}</small></span>
          <span class="equity-player-result" id="equityPlayerResult-${playerIndex}">—</span>
          ${playerIndex > 1 ? `<button type="button" class="remove-player ui-button ui-button-ghost" data-remove-player="${playerIndex}" aria-label="Remove ${label}">${t('Remove')}</button>` : ''}
        </header>
        <div class="equity-player-body">
          <div class="equity-hand-mode" role="group" aria-label="${label} hand type">
            <button type="button" data-equity-hand-mode="known" data-player-index="${playerIndex}" aria-pressed="${mode === 'known'}">Known</button>
            <button type="button" data-equity-hand-mode="unknown" data-player-index="${playerIndex}" aria-pressed="${mode === 'unknown'}">Unknown</button>
          </div>
          ${mode === 'known'
            ? `<div class="card-slots equity-known-hand" data-slots="player-${playerIndex}"></div>`
            : `<div class="equity-unknown-hand" aria-label="${label} unknown cards"><span class="poker-card-back" aria-hidden="true"></span><span class="poker-card-back" aria-hidden="true"></span><span>Random legal hand</span></div>`}
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
  add.textContent = app.equity.players.length >= 10 ? '10 player maximum' : '+ Add player';
  add.addEventListener('click', () => {
    if (app.equity.players.length >= 10) return toast('Maximum of ten players.', 'warning');
    app.equity.players.push(createEquityPlayer());
    renderAllCards();
    setEquityPending();
  });
  root.appendChild(add);

  const playerCount = $('#equityPlayerCount');
  if (playerCount) playerCount.textContent = `${app.equity.players.length} players`;
  const decrease = $('#equityDecreasePlayers');
  const increase = $('#equityIncreasePlayers');
  if (decrease) decrease.disabled = app.equity.players.length <= 2;
  if (increase) increase.disabled = app.equity.players.length >= 10;
  document.querySelectorAll('[data-equity-player-count]').forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.equityPlayerCount) === app.equity.players.length);
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



function renderAllCards() {

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

  renderSlots('trainingHero', 2);

  renderSlots('trainingBoard', 5);

  renderSlots('eqboard', 5);

  renderSlots('eqdead', 52);

  if (app.equity.players.length > 0) renderEquityPlayers();

  $('#deckCount').textContent = remainingCards('gto');

  $('#eqDeckCount').textContent = remainingCards('equity');

  const boardCount = $('#equityBoardCount');
  if (boardCount) boardCount.textContent = `${app.equity.board.filter(Boolean).length} / 5`;

  const deadCount = $('#equityDeadCount');
  if (deadCount) deadCount.textContent = String(app.equity.dead.filter(Boolean).length);

  updateActionOptions();

  if (typeof updateEquityReadiness === 'function') updateEquityReadiness();

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
    if (group === 'eqboard') targetLabel = `board card ${index + 1}`;
    else if (group === 'eqdead') targetLabel = `dead card ${index + 1}`;
    else if (group.startsWith('player-')) targetLabel = `${equityPlayerLabel(Number(group.split('-')[1]))} card ${index + 1}`;
    modalTitle.textContent = targetLabel
      ? `${current ? 'Replace' : 'Choose'} ${targetLabel}`
      : (current ? 'Replace card' : t('Choose a card'));
  }

  const modalCopy = $('#modalCopy');

  if (modalCopy) modalCopy.textContent = group.includes('dead')

    ? 'Choose a card known to be out of play.'

    : t('Cards already used in this scenario are unavailable.');

  const burnControl = $('#burnControl');

  if (burnControl) burnControl.style.display = group === 'dead' || group === 'eqdead' ? 'flex' : 'none';

  const markBurn = $('#markBurn');

  if (markBurn) markBurn.checked = group === 'dead' || group === 'eqdead';

  renderDeck();

  const cardModal = $('#cardModal');

  if (cardModal) cardModal.classList.add('show');

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
        return `<button type="button" class="deck-card card--suit-${suit.id}${isSelected ? ' is-selected' : ''} riverline-card" aria-label="Choose ${visualRank}${suit.symbol}${isUnavailable ? ', unavailable' : ''}" aria-pressed="${isSelected}" data-suit="${suit.id}" data-rank="${rank}" data-deck-card="${card}" ${isUnavailable ? 'disabled' : ''}><span class="rank${rankClass} s-${suit.id}">${visualRank}</span><span class="symbol s-${suit.id}">${suit.symbol}</span></button>`;
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

  closePicker();

  renderAllCards();

  if (isEquityGroup(group)) setEquityPending();

  else if (group.startsWith('hand-')) renderCanonicalHandWorkspace();

  else updateContext('Cards changed');

  const appearedCard = document.querySelector(`[data-slots="${appearanceGroup}"] [data-index="${appearanceIndex}"]`);
  if (appearedCard) appearedCard.classList.add('is-card-dealt');

}



function closePicker() {

  app.picker = null;

  const cardModal = $('#cardModal');

  if (cardModal) cardModal.classList.remove('show');

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



function normalizeFacingSize(lastAction, facingSize = 0) {

  if (lastAction === 'unopened') return 0;

  const value = Number(facingSize);

  return Number.isFinite(value) ? Math.max(0, value) : 0;

}



const CLUBGG_FORCED_CONTRIBUTION_PER_PLAYER_BB = 0.1;
const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';

function strategyAccountingContext(rakeMode, seatedPlayerCount) {

  const mode = rakeMode || 'off';
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

  const bridged = typeof callPlaybookStateBridge === 'function'
    ? callPlaybookStateBridge('createScenarioInput', rawInput)
    : null;
  if (bridged) return bridged;
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
      control.title = 'Scenario-only control; ignored while the canonical hand is authoritative.';
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
  if (!resolution) return 'Playbook state has not been resolved.';
  if (resolution.status === 'available') {
    return resolution.mode === PLAYBOOK_MODES.HAND
      ? 'Hand facts come from the canonical hand. Scenario controls are read-only.'
      : 'Scenario controls are authoritative. This spot does not claim a legal hand history.';
  }
  const reasons = {
    unsupported_canonical_rake_mode: 'Hand mode does not support percentage or capped rake.',
    canonical_straddle_unsupported: 'Hand mode does not support a nonzero straddle.',
    clubgg_requires_7_to_10_players: 'ClubGG hand mode requires 7 to 10 seated players.',
    canonical_session_not_initialized: 'Hand mode is unavailable until a canonical hand is initialized.',
    canonical_chance_state: 'The canonical hand is waiting for explicit chance cards.',
    canonical_showdown_state: 'The canonical hand is at showdown; there is no hero decision.',
    canonical_terminal_state: 'The canonical hand is complete; there is no hero decision.',
    canonical_not_betting: 'The canonical hand does not currently have a betting decision.',
    canonical_hero_unknown: 'The canonical hand has no configured hero.',
    canonical_hero_not_actor: 'The canonical hand is waiting for another player to act.',
    canonical_hero_cards_unknown: 'Deal the hero two cards before requesting strategy.',
    scenario_projection_failed: 'The Scenario input could not be converted to a decision context.',
    canonical_projection_failed: 'The canonical hand could not be converted to a decision context.'
  };
  return reasons[resolution.reason] || 'This Playbook state is unavailable.';
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
    const label = card ? `${displayCard(card)}, canonical hand card` : `No canonical card ${index + 1}`;
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
  if ($('#deckCount')) $('#deckCount').textContent = 52
    - decisionContext.heroCards.length
    - decisionContext.board.length
    - decisionContext.deadCards.length;
}

function renderUnavailableStrategy(resolution) {
  const message = playbookResolutionMessage(resolution);
  const waiting = resolution?.mode === 'hand' && String(resolution?.reason || '').startsWith('canonical_');
  setRecommendationState(waiting ? 'waiting' : 'unavailable');
  if ($('#bestAction')) $('#bestAction').textContent = 'Unavailable';
  if ($('#bestSizing')) {
    $('#bestSizing').textContent = '';
    $('#bestSizing').hidden = true;
  }
  if ($('#bestReason')) $('#bestReason').textContent = message;
  if ($('#sourceBadge')) {
    $('#sourceBadge').textContent = 'unavailable';
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
  if (resolution?.mode === 'hand' && $('#pathList')) {
    $('#pathList').innerHTML = `<div class="panel-note">${message}</div>`;
  }
  renderPlaybookDecisionAnalysis(
    null,
    unavailableStrategyResult(message),
    resolution,
    analysisUnavailableReasonForResolution(resolution)
  );
  renderPlaybookModeStatus(resolution);
}

async function requestPlaybookMode(mode) {
  const previousMode = callPlaybookStateBridge('getMode') || PLAYBOOK_MODES.SCENARIO;
  if (mode === previousMode) return updateContext('Playbook mode unchanged');

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
  if (mode === PLAYBOOK_MODES.SCENARIO) {
    restorePlaybookScenarioPresentation(savedPlaybookScenarioPresentation);
    savedPlaybookScenarioPresentation = null;
  }
  return updateContext(mode === PLAYBOOK_MODES.HAND ? 'Hand workflow selected' : 'Scenario workflow selected');
}

function bindPlaybookModeControl() {
  $$('#playbookModeControl [data-playbook-mode]').forEach((button) => {
    button.addEventListener('click', () => requestPlaybookMode(button.dataset.playbookMode));
  });
  window.addEventListener('riverline:playbook-state-change', (event) => {
    if (event.detail?.operation !== 'mode' && isHandMode()) {
      renderCanonicalHandWorkspace();
      updateContext('Canonical hand updated');
    }
  });
  setPlaybookControlAuthority(PLAYBOOK_MODES.SCENARIO);
}



function formatCanonicalBb(milliBb, digits = 1) {
  const value = Number(milliBb) / 1000;
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits).replace(/\.0$/, '')} bb`;
}

function canonicalPlayerLabel(player, heroPlayerId) {
  if (!player) return '—';
  const hero = player.playerId === heroPlayerId ? 'Hero · ' : '';
  return `${hero}${player.position || `Seat ${player.seat + 1}`}`;
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
      `<option value="${seat}">Seat ${seat + 1}</option>`
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
    ? `ClubGG · 0.1 bb per seated player · ${(tableSize * 0.1).toFixed(1)} bb total deduction`
    : 'Home · no rake or forced deduction';
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
  return diagnostics?.error?.message || 'The canonical hand could not be updated.';
}

function startCanonicalPlaybookHand() {
  syncHandSeatSelectors();
  resetCanonicalHandDraft();
  const state = callPlaybookStateBridge('initializeHand', readCanonicalHandConfiguration());
  if (!state) toast(canonicalHandFailureMessage(), 'error');
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
  if (!state?.players?.length) return toast('Start a canonical hand first.', 'warning');
  const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
  const cardsByPlayer = {};
  for (const player of state.players) {
    const cards = normalizedDecisionCards(app.playbookHandDraft.bySeat[player.seat]);
    if (cards.length === 1) return toast('Private cards must be empty or contain exactly two cards.', 'warning');
    if (player.playerId === heroPlayerId && cards.length !== 2) {
      return toast('Choose both Hero cards before starting betting.', 'warning');
    }
    if (cards.length === 2) cardsByPlayer[player.playerId] = cards;
  }
  const next = callPlaybookStateBridge('dealObservedHoleCards', cardsByPlayer);
  if (!next) toast(canonicalHandFailureMessage(), 'error');
  else if (window.SoundFX) window.SoundFX.playCardDeal(Math.max(2, Object.keys(cardsByPlayer).length * 2));
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
    if (cards.length !== 2) return toast('Choose both cards for every live hand that must be revealed.', 'warning');
    next = callPlaybookStateBridge('revealHoleCards', playerId, cards);
    if (!next) {
      toast(canonicalHandFailureMessage(), 'error');
      break;
    }
  }
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
    return toast(`Choose exactly ${expected || 'the required'} board cards.`, 'warning');
  }
  const next = callPlaybookStateBridge('dealBoardCards', cards);
  if (!next) toast(canonicalHandFailureMessage(), 'error');
  else {
    app.playbookHandDraft.board = [];
    if (window.SoundFX) window.SoundFX.playCardDeal(expected);
  }
  renderCanonicalHandWorkspace();
  return next;
}

function canonicalActionLabel(type, option) {
  if (type === 'all_in') return `All-in · ${formatCanonicalBb(option.amountToMilliBb)}`;
  if (type === 'call') return `Call · ${formatCanonicalBb(option.commitMilliBb)}`;
  return type.charAt(0).toUpperCase() + type.slice(1);
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
  if (label) label.textContent = type === 'bet' ? 'Bet to' : 'Raise to';
  if (bounds) bounds.textContent = `${min}–${max} bb · amount-to`;
  if ($('#handCommitSizedAction')) $('#handCommitSizedAction').hidden = false;
  $$('#handLegalActions [data-canonical-action]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.canonicalAction === type));
  });
}

function applyCanonicalHandAction(type, amountToBb = null) {
  const next = callPlaybookStateBridge('applyAction', type, amountToBb);
  if (!next) toast(canonicalHandFailureMessage(), 'error');
  else if (window.SoundFX) window.SoundFX.playPokerAction(type);
  app.playbookHandDraft.sizedAction = null;
  renderCanonicalHandWorkspace();
  return next;
}

function commitCanonicalSizedAction() {
  const type = app.playbookHandDraft.sizedAction;
  if (!type) return toast('Choose Bet or Raise first.', 'warning');
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
  if ($('#handActionActor')) $('#handActionActor').textContent = `${canonicalPlayerLabel(actor, callPlaybookStateBridge('getHeroPlayerId'))} to act`;
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
    button.setAttribute('aria-label', `${button.textContent}${type === 'bet' || type === 'raise' ? ', choose amount-to sizing' : ''}`);
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
    commit.textContent = 'Apply amount-to';
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
  if (!state) return { label: 'Not started', tone: 'info', summary: 'Configure and start a canonical hand.' };
  if (state.terminal?.isTerminal || state.phase === 'terminal') return { label: 'Complete', tone: 'available', summary: 'The canonical hand is complete.' };
  if (state.showdown?.status === 'awaiting_private_reveal') return { label: 'Reveal hands', tone: 'warning', summary: 'Reveal the remaining live hands to settle this showdown exactly.' };
  if (state.phase === 'showdown') return { label: 'Showdown', tone: 'warning', summary: 'Betting is complete. Resolve the canonical showdown.' };
  if (state.pendingChance?.type === 'deal_hole') return { label: 'Set Hero cards', tone: 'loading', summary: 'Choose Hero cards. Opponents may remain hidden.' };
  if (state.phase === 'chance') return { label: 'Board chance', tone: 'loading', summary: `Waiting for ${state.pendingChance?.type?.replace('deal_', '') || 'board cards'}.` };
  return { label: 'In progress', tone: 'available', summary: 'Only canonical legal actions can advance this hand.' };
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
      <div><strong>${canonicalPlayerLabel(player, heroPlayerId)}</strong><small>Seat ${player.seat + 1} · ${note}</small></div>
      <div class="card-slots" data-slots="hand-seat-${player.seat}"></div>
    </div>`;
  let renderedPlayers;
  if (isAwaitingReveal) {
    renderedPlayers = state.showdown.requiredRevealPlayerIds
      .map((playerId) => state.players.find((player) => player.playerId === playerId));
    if ($('#handDealTitle')) $('#handDealTitle').textContent = 'Reveal remaining hands';
    if ($('#handDealHelp')) $('#handDealHelp').textContent = 'Exact settlement needs the two cards held by each remaining live player.';
    if ($('#handDealHoleButton')) $('#handDealHoleButton').textContent = 'Reveal hands';
    root.innerHTML = renderedPlayers.map((player) => privateRow(player, 'Reveal for showdown')).join('');
  } else {
    const hero = state.players.find((player) => player.playerId === heroPlayerId);
    const opponents = state.players.filter((player) => player.playerId !== heroPlayerId);
    renderedPlayers = state.players;
    if ($('#handDealTitle')) $('#handDealTitle').textContent = 'Set private cards';
    if ($('#handDealHelp')) $('#handDealHelp').textContent = "Choose Hero's cards. Opponents remain hidden unless you set them explicitly.";
    if ($('#handDealHoleButton')) $('#handDealHoleButton').textContent = 'Start betting';
    root.innerHTML = `${privateRow(hero, 'Required')}
      <div class="hand-hidden-summary" role="status"><span class="hand-card-backs" aria-hidden="true"><i></i><i></i></span><strong>${opponents.length} opponent${opponents.length === 1 ? '' : 's'} hidden by default</strong></div>
      <details class="hand-known-opponents"><summary>Set known opponent cards (optional)</summary>
        <div class="hand-known-opponent-list">${opponents.map((player) => privateRow(player, 'Optional · otherwise Hidden')).join('')}</div>
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
  if ($('#handChanceTitle')) $('#handChanceTitle').textContent = `Deal ${chanceName}`;
  if ($('#handChanceHelp')) $('#handChanceHelp').textContent = `Choose the next ${expected} legal board card${expected === 1 ? '' : 's'}.`;
  renderSlots('hand-board-chance', expected);
  if ($('#handDealBoardButton')) $('#handDealBoardButton').disabled = normalizedDecisionCards(app.playbookHandDraft.board).length !== expected;
}

function renderCanonicalActionHistory(state) {
  const root = $('#handActionHistory');
  if (!root) return;
  const records = state?.actionHistory || [];
  root.innerHTML = records.length ? records.map((record) => {
    const player = state.players.find((entry) => entry.playerId === record.playerId);
    const action = record.submittedAction;
    const amount = action.amountToMilliBb === null ? '' : ` to ${formatCanonicalBb(action.amountToMilliBb)}`;
    return `<li><span><strong>${record.street}</strong> · ${canonicalPlayerLabel(player, callPlaybookStateBridge('getHeroPlayerId'))} · ${action.type.replace('_', ' ')}${amount}</span></li>`;
  }).join('') : '<li><span>No actions yet</span></li>';
}

function dispatchCanonicalTableState(state) {
  if (!state) return;
  const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
  const hero = state.players.find((player) => player.playerId === heroPlayerId);
  const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
  window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: {
    mode: 'hand',
    pot: (state.potMilliBb / 1000).toFixed(1),
    board: state.board.map((card) => ({ rank: card.slice(0, -1), suit: card.slice(-1) })),
    heroCards: (Array.isArray(hero?.holeCards) ? hero.holeCards : []).map((card) => ({ rank: card.slice(0, -1), suit: card.slice(-1) })),
    dealerPos: state.buttonSeat,
    actorPos: actor?.seat ?? null,
    heroSeat: hero?.seat ?? null,
    activePlayers: state.players.length,
    players: state.players.map((player) => ({
      seat: player.seat,
      name: player.playerId === heroPlayerId ? 'Hero' : player.position,
      position: player.position,
      isHero: player.playerId === heroPlayerId,
      stackBb: player.currentStackMilliBb / 1000,
      streetContributionBb: player.streetContributionMilliBb / 1000,
      totalContributionBb: player.totalPotContributionMilliBb / 1000,
      folded: player.folded,
      allIn: player.currentStackMilliBb === 0 && !player.folded,
      hasCards: player.holeCards !== null
    }))
  }}));
}

function renderCanonicalHandWorkspace() {
  const workspace = $('#playbookHandWorkspace');
  if (!workspace) return;
  const state = callPlaybookStateBridge('getState');
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
  if ($('#handStartButton')) $('#handStartButton').textContent = state ? 'Start new hand' : 'Start hand';

  const seats = $('#handSeatList');
  if (seats) seats.innerHTML = state?.players?.map((player) => `
    <div class="hand-seat-row${player.playerId === state.actingPlayerId ? ' is-actor' : ''}${player.folded ? ' is-folded' : ''}">
      <div><strong>${canonicalPlayerLabel(player, heroPlayerId)}</strong><small>Seat ${player.seat + 1}${player.currentStackMilliBb === 0 && !player.folded ? ' · all-in' : ''}${player.folded ? ' · folded' : ''}</small></div>
      <div class="hand-seat-values">${formatCanonicalBb(player.currentStackMilliBb)}<br>street ${formatCanonicalBb(player.streetContributionMilliBb)} · hand ${formatCanonicalBb(player.totalPotContributionMilliBb)}</div>
    </div>`).join('') || '<p class="panel-note">No players yet.</p>';

  renderCanonicalPrivateDeal(state);
  renderCanonicalChance(state);
  renderCanonicalLegalActions(state || { players: [] });
  renderCanonicalActionHistory(state);
  if ($('#handResolveShowdownButton')) {
    $('#handResolveShowdownButton').hidden = state?.phase !== 'showdown'
      || state?.showdown?.status !== 'ready';
  }
  if (state) dispatchCanonicalTableState(state);
  else window.dispatchEvent(new CustomEvent('gameStateUpdate', {
    detail: { mode: 'hand', empty: true, board: [], heroCards: [] }
  }));
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
  const rakeMode = supportedRakeModes.includes(snapshot.rakeMode) ? snapshot.rakeMode : 'off';
  const accounting = strategyAccountingContext(rakeMode, tableSize);

  return {
    schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
    tableSize,
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



function decisionContextToLegacyPostflopContext(context) {

  const decisionContext = requireDecisionContext(context);
  const heroPosition = decisionContext.heroPosition;

  return {
    board: decisionContext.board.slice(),
    heroCards: decisionContext.heroCards.slice(),
    deadCards: decisionContext.deadCards.slice(),
    hero_pos: heroPosition,
    villain_pos: ['BTN', 'CO', 'HJ'].includes(heroPosition) ? 'BB' : 'SB',
    facingSize: decisionContext.facingSizeBb,
    potSize: decisionContext.potBb,
    stack: decisionContext.stackBb
  };

}



function calculatePreflopFallbackForDecisionContext(context) {

  const decisionContext = requireDecisionContext(context);
  const cards = decisionContext.heroCards;

  if (cards.length !== 2 || !cards[0] || !cards[1]) return null;

  const r1str = cards[0][0];
  const r2str = cards[1][0];

  return calculatePreflopFallbackStrategy(
    r1str,
    r2str,
    r1str === r2str,
    cards[0][1] === cards[1][1],
    decisionContext.heroPosition,
    decisionContext.lastAction,
    decisionContext.facingSizeBb,
    decisionContext.potBb,
    decisionContext.stackBb,
    decisionContext.callAmountBb
  );

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



function isAllInActionName(name) {

  return /\b(?:all(?:[-\s]+in)?|jam)\b/.test(String(name || '').toLowerCase());

}



const STRATEGY_RESULT_SCHEMA_VERSION = 'strategy-result/v1';

const STRATEGY_SOURCES = Object.freeze({
  HEURISTIC_PREFLOP: 'heuristic_preflop',
  HEURISTIC_POSTFLOP: 'heuristic_postflop',
  EQUITY_FALLBACK: 'equity_fallback',
  UNAVAILABLE: 'unavailable'
});

const STRATEGY_SOURCE_VALUES = Object.freeze(Object.values(STRATEGY_SOURCES));



function structuralActionFromName(name) {

  const label = String(name || '');
  const normalized = label.toLowerCase();
  const amountMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*bb\b/);
  const potFractionMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?pot\b/);
  let type = 'unknown';

  if (!label || label === 'â€”' || /impossible|unavailable|needed/.test(normalized)) type = 'unavailable';
  else if (isAllInActionName(normalized)) type = 'all_in';
  else if (/\bfold\b/.test(normalized)) type = 'fold';
  else if (/\bcheck\b/.test(normalized)) type = 'check';
  else if (/\bcall\b/.test(normalized)) type = 'call';
  else if (/\bbet\b/.test(normalized) && !/\d\s*-?\s*bet\b/.test(normalized)) type = 'bet';
  else if (/\b(?:open|raise|3\s*-?\s*bet|4\s*-?\s*bet)\b/.test(normalized)) type = 'raise';

  return {
    type,
    amountBb: amountMatch ? Number(amountMatch[1]) : null,
    potFraction: potFractionMatch ? Number(potFractionMatch[1]) / 100 : null
  };

}



function normalizedStrategyActions(entries) {

  const prepared = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      label: String(entry && (entry.label || entry.name) || ''),
      value: Math.max(0, Number(entry && (entry.probability ?? entry.value)) || 0),
      evBb: Number.isFinite(entry && entry.evBb) ? Number(entry.evBb) : null
    }))
    .filter((entry) => entry.value > 0 && entry.label && entry.label !== 'â€”');
  const total = prepared.reduce((sum, entry) => sum + entry.value, 0);

  if (!(total > 0)) return [];

  return prepared.map((entry) => ({
    action: structuralActionFromName(entry.label),
    label: entry.label,
    probability: entry.value / total,
    evBb: entry.evBb
  }));

}



function nullableStrategyMetric(value) {

  return Number.isFinite(value) ? Math.min(1, Math.max(0, Number(value))) : null;

}



function createStrategyResult({
  source,
  actions = [],
  recommendedLabel = null,
  explanation = null,
  confidence = null,
  coverage = null,
  modelVersion = null,
  warnings = [],
  details = null
}) {

  if (!STRATEGY_SOURCE_VALUES.includes(source)) {
    throw new TypeError(`Unsupported StrategyResult source: ${source}`);
  }

  const normalizedActions = normalizedStrategyActions(actions);
  const bestAction = normalizedActions.length
    ? normalizedActions.reduce((best, entry) => entry.probability > best.probability ? entry : best)
    : null;

  return {
    schemaVersion: STRATEGY_RESULT_SCHEMA_VERSION,
    source,
    actions: normalizedActions,
    recommendation: bestAction ? {
      action: { ...bestAction.action },
      label: recommendedLabel || bestAction.label
    } : recommendedLabel ? {
      action: structuralActionFromName(recommendedLabel),
      label: recommendedLabel
    } : null,
    explanation: explanation === null ? null : String(explanation),
    confidence: nullableStrategyMetric(confidence),
    coverage: nullableStrategyMetric(coverage),
    modelVersion: modelVersion === null || modelVersion === undefined ? null : String(modelVersion),
    warnings: Array.isArray(warnings) ? warnings.map(String) : [],
    details: details === undefined ? null : details
  };

}



function preflopHeuristicToStrategyResult(fallback, presentation = {}) {

  const values = {
    open: Number(fallback && fallback.open) || 0,
    call: Number(fallback && fallback.call) || 0,
    fold: Number(fallback && fallback.fold) || 0
  };
  const labels = { open: 'Open', call: 'Call', fold: 'Fold' };
  const requestedOrder = Array.isArray(presentation.actionOrder) ? presentation.actionOrder : [];
  const order = [...requestedOrder, 'open', 'call', 'fold'].filter((key, index, all) => labels[key] && all.indexOf(key) === index);
  const actions = order.map((key) => ({
    label: key === 'open' && presentation.openLabel ? presentation.openLabel : labels[key],
    value: values[key]
  }));

  return createStrategyResult({
    source: STRATEGY_SOURCES.HEURISTIC_PREFLOP,
    actions,
    recommendedLabel: presentation.recommendedLabel || null,
    explanation: presentation.explanation || null
  });

}



function postflopHeuristicToStrategyResult(strategy, presentation = {}) {

  const actions = Object.entries(strategy || {})
    .filter(([name, value]) => name !== 'context' && Number.isFinite(Number(value)))
    .map(([name, value]) => ({ label: name, value: Number(value) }))
    .sort((a, b) => b.value - a.value);

  return createStrategyResult({
    source: STRATEGY_SOURCES.HEURISTIC_POSTFLOP,
    actions,
    recommendedLabel: presentation.recommendedLabel || (actions[0] && actions[0].label) || null,
    explanation: presentation.explanation || null,
    details: strategy && strategy.context ? strategy.context : null
  });

}



function unavailableStrategyResult(reason, recommendedLabel) {

  return createStrategyResult({
    source: STRATEGY_SOURCES.UNAVAILABLE,
    actions: [],
    recommendedLabel: recommendedLabel || null,
    explanation: reason || null,
    warnings: reason ? [String(reason)] : []
  });

}



function strategyResultToLegacyProfile(result) {

  if (!result || result.schemaVersion !== STRATEGY_RESULT_SCHEMA_VERSION) {
    throw new TypeError('Expected StrategyResult strategy-result/v1');
  }

  let actions = result.actions.map((entry) => ({
    name: entry.label,
    value: result.source === STRATEGY_SOURCES.HEURISTIC_PREFLOP
      ? Math.round(entry.probability * 100)
      : Math.round(entry.probability * 10000) / 100,
    kind: entry.action.type === 'fold' ? 'fold'
      : (entry.action.type === 'check' || entry.action.type === 'call') ? 'passive'
        : entry.action.type === 'unavailable' ? 'unavailable' : 'aggressive'
  }));

  if (result.source === STRATEGY_SOURCES.HEURISTIC_PREFLOP) actions = actions.slice(0, 2);

  const legacySource = result.source === STRATEGY_SOURCES.HEURISTIC_PREFLOP ? 'MATH FALLBACK'
    : result.source === STRATEGY_SOURCES.HEURISTIC_POSTFLOP ? 'MONTE CARLO'
      : result.source;

  return {
    actions,
    best: result.recommendation ? String(result.recommendation.label) : 'STRATEGY UNAVAILABLE',
    reason: result.explanation || '',
    source: legacySource,
    provenance: result.source,
    context: result.details
  };

}



// evaluateHand removed
function simulateEquity(heroStr, boardStr, deadStr = [], iterations = 800, decisionContext = null) {
  let exclude = heroStr.concat(boardStr).concat(deadStr || []).filter(c => c);
  let heroCards = heroStr.filter(c => c);
  let boardCards = boardStr.filter(c => c);
  
  let deck = [];
  const ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
  const suits = ['s','h','d','c'];
  for (let r of ranks) {
    for (let s of suits) {
      if (!exclude.includes(r+s)) deck.push(r+s);
    }
  }

  

  let wins = 0, ties = 0;

  let neededRunout = Math.max(0, 5 - boardCards.length);

  

  // 1. Generate all possible villain hole-card combinations
  let villainCombos = [];
  for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
          let c1 = deck[i], c2 = deck[j];
          let r1 = RANK_VALUE[c1[0]] || 0;
          let r2 = RANK_VALUE[c2[0]] || 0;
          let maxR = Math.max(r1, r2);
          let minR = Math.min(r1, r2);
          let isPair = r1 === r2;
          let isSuited = c1[1] === c2[1];
          
          let pts = 0;
          if (isPair) pts = maxR * 5 + 30;
          else {
              pts = maxR * 3 + minR;
              if (isSuited) pts += 8;
              let gap = maxR - minR;
              if (gap === 1) pts += 4;
              else if (gap === 2) pts += 2;
              else if (gap === 3) pts += 1;
          }
          villainCombos.push({ hand: [c1, c2], pts });
      }
  }

  

  // 2. Sort by preflop strength and filter by street

  villainCombos.sort((a, b) => b.pts - a.pts);

  

  // Bayesian Range Widening: scales from top 15% (GTO) to top 45% (Loose) based on Opponent Tightness
  const oppL_sim = (app.settings && app.settings.oppTightness !== undefined) ? app.settings.oppTightness / 100.0 : 0.0;
  const opponent_range_percent = 0.15 + (0.30 * oppL_sim);

  let facing;
  let actionText;
  let players;
  if (decisionContext) {
    const context = requireDecisionContext(decisionContext);
    facing = context.facingSizeBb;
    actionText = context.lastAction.toLowerCase();
    players = context.tableSize;
  } else {
    const facingEl = document.getElementById('facingSize');
    facing = facingEl ? (parseFloat(facingEl.value) || 0) : 0;
    const actionEl = document.getElementById('lastAction');
    actionText = (actionEl && actionEl.selectedOptions && actionEl.selectedOptions[0]) ? actionEl.selectedOptions[0].text.toLowerCase() : 'unopened';
    const playersEl = document.getElementById('players');
    players = playersEl ? (parseInt(playersEl.value) || 6) : 6;
  }

  let basePct = opponent_range_percent;
  if (facing > 0 || actionText.includes('raise')) basePct *= 0.7;
  if (players >= 6) basePct *= 0.9;

  let pct = Math.max(0.05, Math.min(1.0, basePct));
  let cutoff = Math.max(1, Math.floor(villainCombos.length * pct));
  villainCombos = villainCombos.slice(0, cutoff);

  

  let numVillains = Math.max(1, players - 1);
  for (let i = 0; i < iterations; i++) {
    // Pick random villain hands
    let villainHands = [];
    let usedCards = [...heroCards, ...boardCards];
    for(let v = 0; v < numVillains; v++) {
        let vComboObj;
        let valid = false;
        let attempts = 0;
        while(!valid && attempts < 20) {
            vComboObj = villainCombos[Math.floor(Math.random() * villainCombos.length)];
            if (!usedCards.includes(vComboObj.hand[0]) && !usedCards.includes(vComboObj.hand[1])) {
                valid = true;
            }
            attempts++;
        }
        if (valid) {
            villainHands.push(vComboObj.hand);
            usedCards.push(vComboObj.hand[0], vComboObj.hand[1]);
        }
    }
    
    // Pick runout
    let runoutDeck = deck.filter(c => !usedCards.includes(c));
    let runout = [];
    let dLen = runoutDeck.length;
    for (let j = 0; j < neededRunout; j++) {
      let rIdx = j + Math.floor(Math.random() * (dLen - j));
      let temp = runoutDeck[j];
      runoutDeck[j] = runoutDeck[rIdx];
      runoutDeck[rIdx] = temp;
      runout.push(runoutDeck[j]);
    }
    
    let finalBoard = boardCards.concat(runout);
    let heroScore = scoreSeven([...heroCards, ...finalBoard]);
    
    let maxVillainScore = 0;
    for (let vh of villainHands) {
        let vScore = scoreSeven([...vh, ...finalBoard]);
        if (vScore > maxVillainScore) maxVillainScore = vScore;
    }
    
    if (heroScore > maxVillainScore) wins++;
    else if (heroScore === maxVillainScore) ties++;
  }

  return { eq: (wins + ties / 2) / iterations, pct: pct };

}



function calculatePreflopFallbackStrategy(r1str, r2str, isPair, isSuited, pos = 'UTG', action = 'unopened', facingSize = 0, potSize = 1.5, stack = 30, callAmountBb = null) {
    const r1 = RANK_VALUE[r1str] || 0;
    const r2 = RANK_VALUE[r2str] || 0;
    const highRank = Math.max(r1, r2);
    const lowRank = Math.min(r1, r2);
    const gap = highRank - lowRank;
    const hasAce = highRank === 14;
    const hasKing = highRank === 13;
    const bothBroadway = highRank >= 8 && lowRank >= 8;
    const connected = gap <= 1 && !isPair;
    const oneGap = gap === 2 && !isPair;

    let score = Math.max(r1, r2);
    if (isPair) score += 6.0;
    if (gap > 4) score -= (gap - 4.0);

    // Universal unsuited penalty to brutally punish trash hands (e.g. 86o, 92o, T4o)
    if (!isPair && !isSuited) {
        score -= 3.0; // Base penalty for being offsuit
        if (gap >= 3) score -= (gap - 2.0); // Big gap penalty
        if (highRank <= 11) score -= (12 - highRank) * 0.8; // High card weakness
        if (lowRank <= 7) score -= (8 - lowRank) * 0.5; // Low kicker weakness
    }

    const positionModifier = PREFLOP_FALLBACK_POSITION_MODIFIERS[pos];
    let posModifier = positionModifier !== undefined
        ? positionModifier
        : PREFLOP_FALLBACK_POSITION_MODIFIERS.UTG;

    // Enhanced position-aware adjustments
    // Steal position bonuses for BTN/SB when unopened
    if (action === 'unopened' && (pos === 'BTN' || pos === 'SB')) {
        posModifier += 0.5; // Steal equity
    }
    
    // 3-bet position dynamics
    if (action === 'raise' || action === '3bet' || action === '4bet') {
        if (pos === 'SB') posModifier = -3.5; // SB is the worst position to call raises
        if (pos === 'BB') posModifier = -1.0; // BB closes action but plays postflop OOP
        
        // In-position 3-betting bonus
        if (['BTN', 'CO', 'HJ'].includes(pos)) {
            posModifier += 0.8; // IP 3-bets are more profitable
        }
    }
    
    // Stack depth considerations
    const trustedCallAmount = Number.isFinite(callAmountBb) && callAmountBb >= 0
        ? callAmountBb
        : null;
    const spr = trustedCallAmount === null ? 20 : (stack > 0 ? stack / (potSize + trustedCallAmount) : 20);
    if (spr < 5) {
        // Shallow stacks - favor high cards and pairs
        if (isPair || highRank >= 10) posModifier += 0.5;
        else posModifier -= 0.3; // Speculative hands lose value
    } else if (spr > 20) {
        // Deep stacks - favor suited connectors and speculative hands
        if (isSuited && connected && lowRank >= 5) posModifier += 0.8;
        if (isPair && highRank <= 8) posModifier += 0.3; // Small pairs gain set-mining value
    }

    const commitment = trustedCallAmount === null
        ? null
        : (stack > 0 ? trustedCallAmount / stack : 1.0);
    let actionTightness = 0.0;
    // Scenario price can be unknown. Preserve the existing action-category
    // baseline, but omit only the price-dependent increment instead of
    // coercing an unknown call commitment to zero.
    if (action === 'raise') {
        actionTightness = commitment === null ? 0.0 : Math.min(3.0, commitment * 8.0);
    } else if (action === '3bet') {
        actionTightness = commitment === null ? 3.0 : Math.min(6.0, 3.0 + commitment * 10.0);
    } else if (action === '4bet') {
        actionTightness = commitment === null ? 6.0 : Math.min(10.0, 6.0 + commitment * 15.0);
    }

    let handStrength = score + posModifier - actionTightness;

    if (isSuited) {
        handStrength += 1.5;
        if (hasAce) handStrength += 1.2;
        else if (connected && highRank >= 5) handStrength += 1.2;
    } else if (connected && highRank >= 7) {
        handStrength += 0.5;
    }

    if (bothBroadway && !isPair) handStrength += 1.0;
    if (hasAce && actionTightness > 0) handStrength += 1.0;
    else if (hasKing && actionTightness > 0) handStrength += 0.5;

    let anchors = [];
    if (isPair) {
        anchors = [
            [16, [0.90, 0.08, 0.02]],
            [14, [0.80, 0.15, 0.05]],
            [10, [0.55, 0.35, 0.10]],
            [6,  [0.10, 0.65, 0.25]],
            [3,  [0.05, 0.50, 0.45]],
            [0,  [0.00, 0.00, 1.00]]
        ];
    } else {
        anchors = [
            [14, [0.85, 0.10, 0.05]],
            [11, [0.65, 0.25, 0.10]],
            [9,  [0.45, 0.35, 0.20]],
            [7,  [0.20, 0.40, 0.40]],
            [5,  [0.05, 0.25, 0.70]],
            [3,  [0.00, 0.00, 1.00]],
            [0,  [0.00, 0.00, 1.00]]
        ];
    }

    let base = anchors[anchors.length - 1][1].slice();
    for (let k = 0; k < anchors.length - 1; k++) {
        let hiThresh = anchors[k][0], hiStrat = anchors[k][1];
        let loThresh = anchors[k+1][0], loStrat = anchors[k+1][1];
        if (handStrength >= hiThresh) {
            base = hiStrat.slice();
            break;
        } else if (handStrength >= loThresh) {
            let tRaw = (handStrength - loThresh) / (hiThresh - loThresh);
            let t = 1 / (1 + Math.exp(-6 * (tRaw - 0.5)));
            base = [
                loStrat[0] + t * (hiStrat[0] - loStrat[0]),
                loStrat[1] + t * (hiStrat[1] - loStrat[1]),
                loStrat[2] + t * (hiStrat[2] - loStrat[2])
            ];
            break;
        }
    }

    // In unopened pots outside SB/BB, remove limping (calling 1bb)
    if (facingSize === 0 && pos !== 'SB' && pos !== 'BB') {
        if (base[0] >= 0.25) {
            base[0] = Math.min(1.0, base[0] + base[1]);
            base[1] = 0.0;
            base[2] = 1.0 - base[0];
        } else {
            base[0] = 0.0;
            base[1] = 0.0;
            base[2] = 1.0;
        }
    }

    if (hasAce && isSuited && lowRank <= 3 && actionTightness > 0) {
        base = [0.35, 0.30, 0.35];
    } else if (hasAce && isSuited && lowRank <= 7 && actionTightness > 0) {
        base = [0.20, 0.50, 0.30];
    }

    if (facingSize > 0 && trustedCallAmount !== null) {

        // Calculate Pot Odds & MDF across all positions

        const potOdds = (potSize + trustedCallAmount) > 0 ? (trustedCallAmount / (potSize + trustedCallAmount)) : 0.3;

        const mdf = (potSize + trustedCallAmount) > 0 ? (potSize / (potSize + trustedCallAmount)) : 0.7;



        // When Pot Odds are cheap (small raise/pot ratio), defending range expands dynamically!

        let cheapOddsDefenseBoost = 0.0;

        if (potOdds <= 0.10) cheapOddsDefenseBoost = 0.80;      // Extremely cheap (e.g. 2bb into 50bb pot) -> 80% fold reduction!

        else if (potOdds <= 0.20) cheapOddsDefenseBoost = 0.55;

        else if (potOdds <= 0.28) cheapOddsDefenseBoost = 0.35;

        else if (potOdds <= 0.35) cheapOddsDefenseBoost = 0.15;



        // Apply position multiplier (In Position vs Out of Position)

        const isIP = ['BTN', 'CO', 'HJ'].includes(pos);

        if (isIP) cheapOddsDefenseBoost = Math.min(0.90, cheapOddsDefenseBoost * 1.15);



        // Shift folds (base[2]) into calls (base[1]) based on cheap pot odds

        if (cheapOddsDefenseBoost > 0 && base[2] > 0) {

            let shift = base[2] * cheapOddsDefenseBoost;

            base[2] -= shift;

            base[1] += shift;

        }



        // Enforce Minimum Defense Frequency (MDF)

        let defenseTotal = base[0] + base[1];

        let requiredDefense = Math.min(0.85, mdf * 0.75);

        if (defenseTotal < requiredDefense) {

            let defBoost = requiredDefense - defenseTotal;

            base[1] += defBoost;

            base[2] = Math.max(0, base[2] - defBoost);

        }

    }

    if (isPair && score >= 14) {
        base[2] = Math.min(base[2], 0.05);
    } else if (score >= 12) {
        base[2] = Math.min(base[2], 0.10);
    }

    if (pos === 'BB' && facingSize === 0) {
        base[1] += base[2];
        base[2] = 0.0;
    }

    return {
        open: base[0],
        call: base[1],
        fold: base[2]
    };
}

function fallbackStrategyResult(reason, decisionContext = null) {

  const context = requireDecisionContext(decisionContext);

  if (context.street === 'preflop' && context.heroCards.length === 2 && context.heroCards[0] && context.heroCards[1]) {

    const pos = context.heroPosition;

    const facingSize = context.facingSizeBb;

    const potSize = context.potBb;

    const stack = context.stackBb;

    const fb = calculatePreflopFallbackForDecisionContext(context);

    let a1, a2;

    let open = fb.open, call = fb.call, fold = fb.fold;

    // Advanced bet sizing logic based on pot size, stack depth, and hand strength

    let betSize = 0;

    if (open > call && open > fold) {

      // Calculate realistic bet size

      const stackToPot = stack > 0 ? stack / potSize : 20;

      

      if (facingSize === 0) {

        // Opening bet sizing

        if (stackToPot >= 20) {

          betSize = 2.5; // Standard open

        } else if (stackToPot >= 10) {

          betSize = 2.2; // Slightly smaller with shorter stack

        } else {

          betSize = Math.min(stack * 0.6, 2.0); // Short stack sizing

        }

      } else {

        // 3-bet sizing

        const raiseAmount = facingSize + potSize;

        if (stackToPot >= 15) {

          betSize = raiseAmount * 2.5; // Standard 3-bet

        } else if (stackToPot >= 8) {

          betSize = raiseAmount * 2.2; // Slightly smaller

        } else {

          betSize = Math.min(stack * 0.8, raiseAmount * 2.0); // Short stack

        }

      }

      

      a1 = 'Open';

      if (call > fold) { a2 = 'Call'; }

      else { a2 = 'Fold'; }

    } else if (call > open && call > fold) {

      a1 = 'Call';

      if (open > fold) { a2 = 'Open'; }

      else { a2 = 'Fold'; }

    } else {

      a1 = 'Fold';

      if (open > call) { a2 = 'Open'; }

      else { a2 = 'Call'; }

    }

    

    // Add bet size to action label if applicable

    if (betSize > 0 && a1 === 'Open') {

      a1 = `Open ${betSize}bb`;

    }

    

    const actionKey = (name) => name.startsWith('Open') ? 'open' : name === 'Call' ? 'call' : 'fold';

    return preflopHeuristicToStrategyResult(fb, {
      actionOrder: [actionKey(a1), actionKey(a2)],
      openLabel: a1.startsWith('Open') ? a1 : a2.startsWith('Open') ? a2 : 'Open',
      recommendedLabel: t(a1).toUpperCase(),
      explanation: `${t('Mathematical Fallback suggests')} ${t(a1)} ${t('based on hand playability & position.')}`
    });

  } else if (context.street !== 'preflop' && context.heroCards.length === 2 && context.heroCards[0] && context.heroCards[1]) {

    let deadCards = context.deadCards;

    let sim = simulateEquity(context.heroCards, context.board, deadCards, 800, context);

    let eq = sim.eq;



    setTimeout(() => {

      let eqEl = document.getElementById('mEquity');

      if (eqEl) eqEl.textContent = (eq * 100).toFixed(1) + '%';

    }, 10);



    const contextObj = decisionContextToLegacyPostflopContext(context);



    const stratObj = calculateUnifiedPostflopStrategy(contextObj, context.heroCards, deadCards, context);

    const entries = Object.entries(stratObj);

    entries.sort((a, b) => b[1] - a[1]);



    const a1 = entries[0] ? entries[0][0] : 'Check';

    let street = context.street;

    let rangePct = street === 'flop' ? 'Top 40%' : street === 'turn' ? 'Top 25%' : 'Top 15%';



    return postflopHeuristicToStrategyResult(stratObj, {
      recommendedLabel: t(a1).toUpperCase(),
      explanation: `${t('Mathematical Fallback suggests')} ${(eq*100).toFixed(1)}% ${t('vs Villain')} ${t(rangePct)} ${t('range')}.`
    });

  }

  return unavailableStrategyResult(t(reason), t('STRATEGY UNAVAILABLE'));

}



function actionProfile(hand = null, decisionContext = null) {

  const strategyContext = requireDecisionContext(decisionContext);
  const resolvedHand = hand === null ? handClass(strategyContext.heroCards) : hand;

  if (!resolvedHand) {
    return fallbackStrategyResult('Choose two hero cards to calculate a heuristic strategy.', strategyContext);
  }

  if (strategyContext.street === 'invalid') {
    return fallbackStrategyResult('Complete the current board street: 0, 3, 4, or 5 board cards.', strategyContext);
  }

  return fallbackStrategyResult('Heuristic fallback', strategyContext);

}


function setFrequency(index, action) {

  const nameEl = $('#f' + index + 'name');

  const barEl = $('#f' + index);

  const numEl = $('#f' + index + 'num');

  if (nameEl) nameEl.textContent = t(action.name);

  if (barEl) {

    barEl.style.width = action.value + '%';

    barEl.dataset.actionKind = visualActionKind(action);

    barEl.setAttribute('aria-label', `${action.name}: ${action.value}%`);

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
      mPotOdds.textContent = '— (Unopened)';
    } else if (!Number.isFinite(callAmount)) {
      mPotOdds.textContent = '— (Price unavailable)';
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
      mRake.textContent = `${accounting.forcedContributionPerPlayerBb.toFixed(1)} bb/player · ${accounting.totalForcedContributionBb.toFixed(1)} bb total`;
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
      facingSizeOut.textContent = '0.0 bb (Unopened)';
    } else if (facing > 0) {
      facingSizeOut.textContent = facing.toFixed(1) + ' bb';
    } else {
      facingSizeOut.textContent = '0.0 bb (Free Check)';
    }
  }

  const potSizeOut = $('#potSizeOut');
  if (potSizeOut) potSizeOut.textContent = pot.toFixed(1) + ' bb';
}



function renderPath(street) {

  const pathList = $('#pathList');

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

  let activeIdx = 0;

  if (streetCount >= 5) activeIdx = 3;

  else if (streetCount === 4) activeIdx = 2;

  else if (streetCount >= 3) activeIdx = 1;

  

  const stages = [

    { key: 'preflop', label: t('Preflop') },

    { key: 'flop', label: t('Flop') },

    { key: 'turn', label: t('Turn') },

    { key: 'river', label: t('River') }

  ];



  pathList.innerHTML = stages.map((stage, idx) => {

    let statusClass = 'upcoming';

    let statusIcon = '<span class="node-dot"></span>';

    let textContent = '';



    if (idx < activeIdx) {

      statusClass = 'completed';

      statusIcon = '<span class="node-check">✓</span>';

    } else if (idx === activeIdx) {

      statusClass = 'active';

      statusIcon = '<span class="node-active"></span>';

    }



    if (idx === 0) {

      textContent = `${heroPos} · ${t(lastActionText)}`;

    } else if (idx === 1) {

      textContent = streetCount >= 3 ? boardCards.slice(0, 3).join(' ') : t('Waiting for flop...');

    } else if (idx === 2) {

      textContent = streetCount >= 4 ? boardCards[3] : t('Waiting for turn...');

    } else if (idx === 3) {

      textContent = streetCount >= 5 ? boardCards[4] : t('Waiting for river...');

    }



    return `

      <div class="path-step ${statusClass}">

        <div class="path-node">${statusIcon}</div>

        <div class="path-body">

          <b>${stage.label}</b>

          <span>${textContent}</span>

        </div>

      </div>

    `;

  }).join('');

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



function normalizedMatrixActions(entries) {
  const prepared = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      ...entry,
      rawValue: Math.max(0, Number(entry?.value) || 0)
    }))
    .filter((entry) => entry.rawValue > 0)
    .map((entry, index) => ({ ...entry, index }));
  const total = prepared.reduce((sum, entry) => sum + entry.rawValue, 0);
  if (!(total > 0)) return [];

  const allocations = prepared.map((entry) => {
    const exact = entry.rawValue / total * 100;
    const value = Math.floor(exact);
    return { ...entry, value, remainder: exact - value };
  });
  let pointsLeft = 100 - allocations.reduce((sum, entry) => sum + entry.value, 0);
  [...allocations]
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
    .forEach((entry) => {
      if (pointsLeft <= 0) return;
      allocations[entry.index].value += 1;
      pointsLeft -= 1;
    });

  return allocations.map(({ index, rawValue, remainder, ...entry }) => entry);
}


function renderChart() {

  const grid = $('#strategyGrid');

  if (!grid) return;

  const handMode = app.playbookMode === PLAYBOOK_MODES.HAND;
  const decisionContext = handMode
    && app.decisionContext?.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION
    ? app.decisionContext
    : null;
  const matrixContextUnavailable = handMode && !decisionContext;
  const positions = decisionContext?.heroPosition || selectedValue('#heroPos');
  const matrixFacingSize = decisionContext?.facingSizeBb ?? numericValue('#facingSize', 0);
  const matrixPotSize = decisionContext?.potBb ?? numericValue('#potSize', 1.5);
  const matrixStack = decisionContext?.stackBb ?? numericValue('#stack', 30);
  const matrixLastAction = decisionContext?.lastAction || $('#lastAction')?.value || 'unopened';
  const matrixCallAmount = decisionContext?.callAmountBb ?? null;

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
    grid.dataset.delegated = 'true';
    grid.addEventListener('click', (event) => {
      const cell = event.target.closest('.hand-cell');
      if (!cell || !cell.dataset.hand) return;
      if (window.SoundFX) SoundFX.playClick();
      app.selectedHand = cell.dataset.hand;
      const selHand = document.querySelector('#selectedHand');
      if (selHand) selHand.textContent = app.selectedHand;
      renderChart();
    });
  }

  const currentHeroClass = matrixContextUnavailable
    ? '' : handClass(decisionContext?.heroCards || app.gto.hero);

  

  let previewHTML = '';

  

  const isPostFlop = !matrixContextUnavailable
    && (decisionContext?.street || currentStreet()) !== 'preflop';

  const currentBoard = matrixContextUnavailable
    ? [] : (decisionContext?.board || app.gto.board).filter(Boolean);

  const boardCount = currentBoard.length;

  const useEquityFallback = isPostFlop && boardCount >= 3;

  RANKS.forEach((_, row) => RANKS.forEach((__, column) => {

    const hand = handCode(row, column);
    let actions = [];

    

    if (isPostFlop && useEquityFallback) {

        // Fast Postflop Heuristic Grid Fallback (0ms latency, zero main-thread lag)

        const validCombo = getFirstValidCombo(hand, currentBoard);

        if (validCombo) {

            const hEval = evaluatePostflopHandStrength(validCombo, currentBoard);

            if (hEval.category === 'monster' || hEval.category === 'two_pair' || hEval.category === 'top_pair' || hEval.category === 'overpair') {

               actions = [{ name: 'Raise', value: 70, kind: 'aggressive' }, { name: 'Call', value: 30, kind: 'passive' }];

            } else if (hEval.category === 'middle_pair' || hEval.category === 'flush_draw') {

               actions = [{ name: 'Call', value: 70, kind: 'passive' }, { name: 'Fold', value: 30, kind: 'fold' }];

            } else {

               actions = [{ name: 'Fold', value: 85, kind: 'fold' }, { name: 'Call', value: 15, kind: 'passive' }];

            }

        }

    } else if (!isPostFlop && !matrixContextUnavailable) {
        // Unified deterministic preflop fallback.
        const heroPos = positions;
        const r1str = RANKS[row], r2str = RANKS[column];
        const isPair = row === column;
        const isSuited = hand.length === 3 && hand[2] === 's';
        const fb = calculatePreflopFallbackStrategy(
          r1str, r2str, isPair, isSuited,
          heroPos, matrixLastAction, matrixFacingSize, matrixPotSize, matrixStack, matrixCallAmount
        );

        const openVal = fb.open * 100;
        const callVal = fb.call * 100;
        const foldVal = fb.fold * 100;

        if (openVal > 0) actions.push({ name: matrixFacingSize === 0 ? 'Raise' : '3-Bet', value: openVal, kind: 'aggressive' });
        if (callVal > 0) actions.push({ name: 'Call', value: callVal, kind: 'passive' });
        if (foldVal > 0) actions.push({ name: 'Fold', value: foldVal, kind: 'fold' });
        actions.sort((a, b) => b.value - a.value);

    }

    actions = normalizedMatrixActions(actions);

    const type = (actions[0] && actions[0].kind) || 'unavailable';
    const handKind = row === column ? 'pair' : hand.endsWith('s') ? 'suited' : 'offsuit';

    const detail = actions.length
      ? actions.map((action) => `${action.name} ${action.value}%`).join(' · ')
      : (useEquityFallback ? 'Unavailable · no representative combo' : 'Strategy unavailable');

    const idx = row * 13 + column;
    const button = grid.children[idx];

    const isSelected = app.selectedHand === hand || (!app.selectedHand && currentHeroClass === hand);

    button.className = `hand-cell hand-${handKind} action-${type} ${isSelected ? 'selected ' : ''}${type}`;
    button.dataset.handKind = handKind;
    button.dataset.primaryAction = visualActionKind(actions[0]);
    button.dataset.state = actions.length ? 'available' : 'unavailable';
    button.setAttribute('aria-pressed', String(isSelected));

    const chartMode = $('#chartAction')?.value || 'strategy';

    let cellSubtext = '';

    let cellBg = '';
    button.style.removeProperty('background');



    if (chartMode === 'raise') {

      const val = actions.find(a => a.kind === 'aggressive')?.value;

      cellSubtext = actions.length ? `${val || 0}%` : 'Unavailable';

      if (actions.length) cellBg = `color-mix(in srgb, var(--action-aggressive) ${val || 0}%, transparent)`;

    } else if (chartMode === 'call') {

      const val = actions.find(a => a.kind === 'passive')?.value;

      cellSubtext = actions.length ? `${val || 0}%` : 'Unavailable';

      if (actions.length) cellBg = `color-mix(in srgb, var(--action-passive) ${val || 0}%, transparent)`;

    } else if (chartMode === 'fold') {

      const val = actions.find(a => a.kind === 'fold')?.value;

      cellSubtext = actions.length ? `${val || 0}%` : 'Unavailable';

      if (actions.length) cellBg = `color-mix(in srgb, var(--action-fold) ${val || 0}%, transparent)`;

    }



    if (cellSubtext) {

      button.innerHTML = `<span class="matrix-hand-label">${hand}</span><div class="matrix-cell-subtext">${cellSubtext}</div>`;

    } else {

      button.innerHTML = `<span class="matrix-hand-label">${hand}</span>`;

    }



    button.dataset.hand = hand;

    button.setAttribute('aria-label', `${hand}, ${handKind}: ${detail}`);



    if (cellBg) {

      button.style.background = cellBg;

    } else if (actions.length > 0) {
      button.insertAdjacentHTML('beforeend', `<span class="matrix-mix-bar" aria-hidden="true">${actions.map((action) => `<i data-action-kind="${visualActionKind(action)}" style="width:${action.value}%"></i>`).join('')}</span>`);
    }



    if (isSelected) {

        const kindLabel = handKind === 'pair' ? 'Pair' : handKind === 'suited' ? 'Suited' : 'Offsuit';
        const primaryAction = actions[0];
        previewHTML = `<strong class="matrix-preview-hand">${hand}</strong><span class="matrix-preview-summary">${primaryAction ? `${primaryAction.name} ${primaryAction.value}%` : 'Unavailable'}</span>`;

        $('#selectedHand').textContent = hand;
        if ($('#selectedHandKind')) $('#selectedHandKind').textContent = kindLabel;
        if ($('#selectedHandPrimary')) {
          $('#selectedHandPrimary').textContent = primaryAction
            ? `Primary · ${primaryAction.name} ${primaryAction.value}%`
            : 'Strategy unavailable';
          $('#selectedHandPrimary').dataset.actionKind = visualActionKind(primaryAction);
        }

        $('#selectedMix').innerHTML = actions.length
          ? `<div class="matrix-inspector-actions">${actions.map((action) => `<span class="matrix-inspector-action"><i data-action-kind="${visualActionKind(action)}"></i><span>${action.name}</span><strong>${action.value % 1 === 0 ? action.value : Number(action.value).toFixed(1)}%</strong></span>`).join('')}</div><div class="alloc" role="img" aria-label="${detail}">${actions.map((action) => `<i data-action-kind="${visualActionKind(action)}" style="width:${action.value}%"></i>`).join('')}</div>`
          : `<span class="matrix-inspector-unavailable">${detail || 'Strategy unavailable for this hand.'}</span>`;

    }



    /* grid.appendChild(button) removed for recycling */

  }));

  /**
   * Performance Optimization: Event Delegation
   * Instead of attaching 169 individual 'click' event listeners to each hand cell
   * (which bloats memory and slows down rendering), we attach a single listener
   * to the parent `#strategyGrid`. The `event.target.closest` method efficiently
   * resolves the clicked child cell. This drastically reduces the DOM node memory footprint.
   */
  if (grid && !grid.dataset.delegated) {
    grid.dataset.delegated = 'true';
    grid.addEventListener('click', (event) => {
      const cell = event.target.closest('.hand-cell');
      if (!cell || !cell.dataset.hand) return;
      if (window.SoundFX) SoundFX.playClick();
      app.selectedHand = cell.dataset.hand;
      const selHand = $('#selectedHand');
      if (selHand) selHand.textContent = app.selectedHand;
      renderChart();
    });
  }

  

  const previewContainer = $('#chartSelectionPreview');

  if (previewContainer) {

      previewContainer.innerHTML = previewHTML || `<span>${t('Select a hand')}</span>`;

  }



  const chartSummary = $('#chartSummary');
  if (chartSummary) {
    chartSummary.textContent = matrixContextUnavailable
      ? 'Hand Mode · Strategy unavailable for the current canonical state'
      : `${positions} · ${matrixStack} bb · Heuristic fallback`;
  }

}


function visualActionKind(action) {
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
    return `<span class="frequency-stack-segment" data-action-kind="${kind}" style="width:${action.value}%" title="${action.name}: ${action.value}%"></span>`;
  }).join('');
  const label = populated.length
    ? populated.map((action) => `${action.name} ${action.value}%`).join(', ')
    : 'Strategy frequencies unavailable';
  container.setAttribute('aria-label', label);
  container.classList.toggle('is-empty', populated.length === 0);
}

function strategySourceDisplayLabel(source) {
  const labels = {
    heuristic_preflop: 'Heuristic',
    heuristic_postflop: 'Heuristic',
    equity_fallback: 'Equity fallback',
    unavailable: 'Unavailable'
  };
  return labels[source] || String(source || 'Unavailable');
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

function trustedHandClassificationForAnalysis(decisionContext) {
  if (!decisionContext || decisionContext.street === 'preflop'
    || decisionContext.heroCards.length !== 2 || decisionContext.board.length < 3
    || typeof evaluatePostflopHand !== 'function') return null;
  const classification = evaluatePostflopHand(decisionContext.heroCards, decisionContext.board);
  if (!classification) return null;
  return {
    madeHand: classification.madeHand || null,
    draws: Array.isArray(classification.draws) ? classification.draws.slice() : [],
    source: 'legacy_postflop_classifier'
  };
}

function canonicalActionHistoryForAnalysis(resolution) {
  if (resolution?.mode !== 'hand') return [];
  const bridge = globalThis.RiverlinePlaybookState;
  const state = bridge && typeof bridge.getState === 'function' ? bridge.getState() : null;
  if (!state || !Array.isArray(state.actionHistory) || !Array.isArray(state.players)) return [];
  const heroPlayerId = typeof bridge.getHeroPlayerId === 'function' ? bridge.getHeroPlayerId() : null;
  const playersById = new Map(state.players.map((player) => [player.playerId, player]));
  const labels = {
    fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet to', raise: 'Raise to', all_in: 'All-in to'
  };
  return state.actionHistory.map((record, index) => {
    const action = record.submittedAction || {};
    const player = playersById.get(record.playerId);
    const amountMilliBb = action.type === 'call'
      ? record.committedMilliBb
      : action.type === 'fold' || action.type === 'check' ? null : action.amountToMilliBb;
    return {
      sequence: Number.isInteger(record.sequence) ? record.sequence : index,
      street: record.street,
      actorLabel: record.playerId === heroPlayerId ? 'Hero' : (player?.position || record.playerId),
      position: player?.position || null,
      actionType: action.type || 'unknown',
      actionLabel: labels[action.type] || String(action.type || 'Action').replaceAll('_', ' '),
      amountBb: Number.isSafeInteger(amountMilliBb) ? amountMilliBb / 1000 : null,
      isHero: record.playerId === heroPlayerId
    };
  });
}

function trustedAnalysisFacts(decisionContext, _strategyResult, actionHistory = []) {
  const facts = { actionHistory: Array.isArray(actionHistory) ? actionHistory : [] };
  const handClassification = trustedHandClassificationForAnalysis(decisionContext);
  if (handClassification) facts.handClassification = handClassification;
  return facts;
}

function renderDecisionAnalysis(container, {
  decisionContext,
  strategyResult,
  trustedFacts,
  authority,
  depth,
  unavailableReason = null
}) {
  if (!container) return null;
  const bridge = globalThis.RiverlineAnalysisExplanation;
  if (!bridge || typeof bridge.create !== 'function' || typeof renderAnalysisExplanation !== 'function') {
    container.textContent = 'Decision analysis is unavailable.';
    return null;
  }
  const explanation = bridge.create({
    decisionContext,
    strategyResult,
    trustedFacts,
    authority,
    depth,
    unavailableReason
  });
  renderAnalysisExplanation(container, explanation, { depth });
  return explanation;
}

function renderPlaybookDecisionAnalysis(decisionContext, strategyResult, resolution, unavailableReason = null) {
  const authority = resolution?.mode === 'hand' ? 'hand' : 'scenario';
  const result = strategyResult?.schemaVersion === STRATEGY_RESULT_SCHEMA_VERSION
    ? strategyResult
    : unavailableStrategyResult(playbookResolutionMessage(resolution));
  const explanation = renderDecisionAnalysis($('#teacherContent'), {
    decisionContext,
    strategyResult: result,
    trustedFacts: trustedAnalysisFacts(
      decisionContext,
      result,
      canonicalActionHistoryForAnalysis(resolution)
    ),
    authority,
    depth: 'detailed',
    unavailableReason
  });
  app.analysisExplanation = explanation;
  return explanation;
}

async function updateContext(reason = 'Context updated') {

  syncSliderPair('players', 'playersNum');

  syncSliderPair('stack', 'stackNum');

  syncSliderPair('ante', 'anteNum');

  const inputSnapshot = readPlaybookInputSnapshot();
  const playbookBridge = globalThis.RiverlinePlaybookState;
  const playbookResolution = playbookBridge && typeof playbookBridge.resolveDecisionContext === 'function'
    ? playbookBridge.resolveDecisionContext(inputSnapshot, deriveDecisionContext)
    : {
        schemaVersion: 'playbook-decision-resolution/v1',
        mode: 'scenario',
        status: 'available',
        reason: null,
        error: null,
        decisionContext: deriveDecisionContext(inputSnapshot)
      };
  app.playbookMode = playbookResolution.mode;
  app.playbookResolution = playbookResolution;

  if (playbookResolution.status !== 'available' || !playbookResolution.decisionContext) {
    app.decisionContext = null;
    app.strategyResult = null;
    app.playbookViewModel = playbookBridge && typeof playbookBridge.createViewModel === 'function'
      ? playbookBridge.createViewModel(null)
      : null;
    if (typeof renderUnavailableStrategy === 'function') renderUnavailableStrategy(playbookResolution);
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
  
  const strategyResult = actionProfile(null, decisionContext);
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

  console.log('Strategy result:', strategyResult);

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
      bestSizing.textContent = `${(recommendationSizing.potFraction * 100).toFixed(0)}% pot`;
      bestSizing.hidden = false;
    } else {
      bestSizing.textContent = '';
      bestSizing.hidden = true;
    }
  }

  const bestReason = $('#bestReason');

  if (bestReason) bestReason.textContent = t(profile.reason);

  const recommendation = $('#recommendation');
  if (recommendation) recommendation.dataset.actionKind = visualActionKind(profile.actions[0]);

  

  if (typeof renderPlaybookDecisionAnalysis === 'function') {
    renderPlaybookDecisionAnalysis(decisionContext, strategyResult, playbookResolution);
  }

  

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
    sourceBadge.textContent = typeof strategySourceDisplayLabel === 'function'
      ? strategySourceDisplayLabel(strategyResult.source)
      : strategyResult.source;
    const sourceTone = strategyResult.source.startsWith('heuristic_') ? 'heuristic' : 'info';
    sourceBadge.className = `badge status-badge status-badge--${sourceTone}`;
  }

  const strategyMeta = $('#strategyMeta');
  if (strategyMeta) {
    const metadata = [];
    if (strategyResult.confidence !== null) metadata.push(`Confidence ${(strategyResult.confidence * 100).toFixed(0)}%`);
    if (strategyResult.coverage !== null) metadata.push(`Coverage ${(strategyResult.coverage * 100).toFixed(0)}%`);
    if (strategyResult.modelVersion !== null) metadata.push(`Model ${strategyResult.modelVersion}`);
    strategyMeta.textContent = metadata.join(' · ');
    strategyMeta.hidden = metadata.length === 0;
  }

  const strategyWarnings = $('#strategyWarnings');
  if (strategyWarnings) {
    strategyWarnings.textContent = strategyResult.warnings.join(' · ');
    strategyWarnings.hidden = strategyResult.warnings.length === 0;
  }

  const streetLabel = $('#streetLabel');

  if (streetLabel) streetLabel.textContent = street.toUpperCase();

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

  const chartGrid = $('#strategyGrid');

  if (chartGrid) {

    renderChart();

    app.chartUpdatePending = false;

  } else {

    app.chartUpdatePending = true;

  }

  

  // Update range view & decision tree if visible
  const rangeView = $('#rangeView');
  if (rangeView && rangeView.style.display !== 'none') {
    renderRangeAdvantage();
  }
  renderBettingTree();



  if (contextKey !== app.lastContextKey) {

    app.lastContextKey = contextKey;

    const recommendation = $('#recommendation');

    if (recommendation) {

      recommendation.classList.remove('wobble');

      void recommendation.offsetWidth;

      recommendation.classList.add('wobble');

    }

    const liveContextText = $('#liveContextText');

    if (liveContextText) {

      liveContextText.textContent = 'Live · updated';

      window.clearTimeout(updateContext.timer);

      updateContext.timer = window.setTimeout(() => { 

        if ($('#liveContextText')) $('#liveContextText').textContent = 'Live'; 

      }, 1400);

    }

  }

  // Trigger the presentation-only table. Hand mode supplies canonical player
  // facts; Scenario mode retains the established simplified projection.
  if (playbookResolution.mode === 'hand' && typeof dispatchCanonicalTableState === 'function') {
    dispatchCanonicalTableState(playbookBridge?.getState?.());
  } else {
    const activePlayers = decisionContext.tableSize;
    const allPos = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];
    const currentPosArr = POSITIONS[activePlayers] || POSITIONS[6];
    const sortedPos = currentPosArr.slice().sort((a,b) => allPos.indexOf(a) - allPos.indexOf(b));
    const heroIdx = sortedPos.indexOf(decisionContext.heroPosition);
    const btnIdx = sortedPos.indexOf('BTN');
    const dealerPos = (heroIdx !== -1 && btnIdx !== -1) ? (btnIdx - heroIdx + activePlayers) % activePlayers : 0;
    const parsedBoard = decisionContext.board.map(c => ({ rank: c.slice(0,-1), suit: c.slice(-1) }));
    const parsedHero = decisionContext.heroCards.map(c => ({ rank: c.slice(0,-1), suit: c.slice(-1) }));

    window.dispatchEvent(new CustomEvent('gameStateUpdate', {
      detail: {
        pot: Number(decisionContext.potBb).toFixed(1),
        board: parsedBoard,
        heroCards: parsedHero,
        dealerPos: dealerPos,
        activePlayers: decisionContext.tableSize
      }
    }));
  }
}



// ---------------------------------------------------------------------------

// Legacy fast evaluator retained for Playbook heuristics and the outs display.
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
  if (!estimate?.ok) return 'Unavailable';
  if (estimate.exceedsSafeInteger) {
    const digits = estimate.combinationsText;
    const leading = digits.length > 1 ? `${digits[0]}.${digits.slice(1, 3)}` : digits;
    return `≈ ${leading}e+${digits.length - 1} combinations`;
  }
  return `${Number(estimate.combinations).toLocaleString()} combinations`;
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
  let message = 'Ready to calculate.';
  let estimate = null;

  if (incompleteIndex >= 0) {
    state = 'blocked';
    message = `${equityPlayerLabel(incompleteIndex)} is marked known and needs exactly two cards.`;
  } else if (seedNumber !== null && (!Number.isInteger(seedNumber) || seedNumber < 0 || seedNumber > 0xffffffff)) {
    state = 'blocked';
    message = 'Seed must be a whole number from 0 through 4,294,967,295.';
  } else {
    estimate = callEquityServiceBridge('estimate', equityRequestFromCurrentInputs());
    if (estimate?.ok === false) {
      state = 'blocked';
      message = equityFailureMessage(estimate.error);
    } else if (estimate?.ok) {
      const requestedMethod = equityRequestFromCurrentInputs().method;
      if (requestedMethod === 'exact' && !estimate.exactFeasible) {
        state = 'warning';
        message = 'Exact enumeration exceeds the safe workload limit. Choose Auto or Monte Carlo.';
      } else {
        const actual = requestedMethod === 'auto'
          ? (estimate.exactFeasible ? 'exact enumeration' : 'Monte Carlo')
          : (requestedMethod === 'exact' ? 'exact enumeration' : 'Monte Carlo');
        message = `Ready · ${actual} · ${formatEquityCombinationCount(estimate)}`;
      }
    } else {
      message = 'Ready. Calculation details will be confirmed when the Equity service loads.';
    }
  }

  readiness.dataset.state = state;
  readiness.textContent = message;
  calculate.disabled = equityCalculationRunning || state === 'blocked' || state === 'warning';
  if (estimateCopy) estimateCopy.textContent = estimate?.ok
    ? `Estimated workload: ${formatEquityCombinationCount(estimate)}. Auto will use ${estimate.exactFeasible ? 'exact enumeration' : 'Monte Carlo'}.`
    : 'Workload estimate appears when all known hands are complete.';

  const request = equityRequestFromCurrentInputs();
  if ($('#equityDetailRequested')) $('#equityDetailRequested').textContent = request.method === 'monte_carlo' ? 'Monte Carlo' : (request.method === 'exact' ? 'Exact' : 'Auto');
  if ($('#equityDetailEstimate')) $('#equityDetailEstimate').textContent = estimate?.ok ? formatEquityCombinationCount(estimate) : '—';
  if ($('#equityDetailSamples')) $('#equityDetailSamples').textContent = request.samples.toLocaleString();
  if ($('#equityDetailSeed')) $('#equityDetailSeed').textContent = request.seed === undefined ? 'Generated at run time' : String(request.seed);
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
  if (progress) progress.hidden = !running;
  if ($('#equityResultsPanel')) $('#equityResultsPanel').dataset.resultState = running ? 'running' : $('#equityResultsPanel').dataset.resultState;
  if ($('#equityDetailExecution')) $('#equityDetailExecution').textContent = running
    ? (callEquityServiceBridge('isWorkerBacked') ? 'Web Worker' : 'In-process fallback')
    : 'Ready';
  if (!running) updateEquityReadiness();
}

function renderEquityProgress(progress) {
  const fill = document.querySelector('#progress .progress-fill');
  const track = document.querySelector('#progress .progress-track');
  const status = document.querySelector('#progress .progress-status');
  const percent = document.querySelector('#progress .progress-percent');
  const fraction = Math.min(1, Math.max(0, Number(progress?.fraction) || 0));
  if (fill) fill.style.width = `${fraction * 100}%`;
  if (track) track.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
  if (status) status.textContent = `${Number(progress?.completed || 0).toLocaleString()} / ${Number(progress?.total || 0).toLocaleString()} trials`;
  if (percent) percent.textContent = `${(fraction * 100).toFixed(0)}%`;
}

function equityFailureMessage(error) {
  if (!error) return 'Equity calculation failed.';
  const messages = {
    invalid_request: 'Complete each known hand with exactly two valid cards.',
    duplicate_card: 'That card is already in use.',
    impossible_deck: 'Not enough unseen cards remain for this setup.',
    exact_limit_exceeded: 'This exact calculation is too large. Use Auto or Monte Carlo.',
    aborted: 'Equity calculation cancelled.',
    internal_error: 'The Equity service could not complete this calculation.'
  };
  return messages[error.code] || 'Equity calculation failed.';
}

async function calculateEquity() {
  const readiness = updateEquityReadiness();
  if (!readiness || readiness.state !== 'ready') {
    if (readiness?.message) toast(readiness.message, 'warning');
    return null;
  }
  const generation = ++equityCalculationGeneration;
  const request = readiness.request;
  const calculation = callEquityServiceBridge('calculate', request, {
    onProgress(progress) {
      if (generation === equityCalculationGeneration) renderEquityProgress(progress);
    }
  });
  if (!calculation || typeof calculation.then !== 'function') {
    return toast('The canonical Equity service is unavailable.', 'error');
  }

  clearEquityResults('running', 'Calculating conditional equity…');
  setEquityCalculationRunning(true);
  $('#methodBadge').textContent = 'RUNNING';
  const response = await calculation;
  if (generation !== equityCalculationGeneration) return response;
  setEquityCalculationRunning(false);

  if (response?.ok === false) {
    const message = equityFailureMessage(response.error);
    $('#equityStatus').textContent = message;
    $('#methodBadge').textContent = response.error.code === 'aborted' ? 'CANCELLED' : 'ERROR';
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
  $('#equityStatus').textContent = 'Equity calculation cancelled.';
  $('#methodBadge').textContent = 'CANCELLED';
  if ($('#equityResultsPanel')) $('#equityResultsPanel').dataset.resultState = 'empty';
  return true;
}

function clearEquityResults(state = 'empty', status = 'Results update after calculation.') {
  const panel = $('#equityResultsPanel');
  if (panel) panel.dataset.resultState = state;
  if ($('#headlineEquity')) $('#headlineEquity').textContent = '—';
  if ($('#equityStatus')) $('#equityStatus').textContent = status;
  if ($('#equitySplitSummary')) $('#equitySplitSummary').textContent = '—';
  if ($('#equityDetailActual')) $('#equityDetailActual').textContent = '—';
  if ($('#equityBars')) {
    $('#equityBars').innerHTML = app.equity.players.map((player, index) => `
      <div class="equity-row" data-player-series="${index}">
        <span class="equity-player-label"><i class="series-marker" aria-hidden="true"></i><span>${equityPlayerLabel(index)}<small>Win — · Tie —</small></span></span>
        <div class="eqbar" role="progressbar" aria-label="${equityPlayerLabel(index)} equity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="eqfill player-series" style="width:0%"></div></div>
        <b>—</b>
      </div>`).join('');
  }
  app.equity.players.forEach((player, index) => {
    const playerResult = $(`#equityPlayerResult-${index}`);
    if (playerResult) playerResult.textContent = '—';
  });
}

function renderEquityResult(equityResult, request = equityRequestFromCurrentInputs()) {
  const namesById = new Map(app.equity.players.map((player, index) => [player.id, equityPlayerLabel(index)]));
  const result = equityResult.players.map((player) => ({
    name: namesById.get(player.id) || player.id,
    win: player.winProbability * 100,
    tie: player.tieProbability * 100,
    equity: player.equity * 100
  }));
  const exact = equityResult.exact;
  const total = equityResult.trials;
  const splitRate = equityResult.metadata.splitPotTrials / total * 100;
  const leadingEquity = Math.max(...result.map((player) => player.equity));
  const requestedLabel = request.method === 'auto' ? 'AUTO' : (request.method === 'exact' ? 'EXACT' : 'MONTE CARLO');
  const actualLabel = exact ? 'EXACT' : 'MONTE CARLO';

  $('#headlineEquity').textContent = leadingEquity.toFixed(1) + '%';

  $('#equityStatus').textContent = `${exact ? 'Exact enumeration' : 'Monte Carlo simulation'} · ${total.toLocaleString()} conditional trials`;

  $('#methodBadge').textContent = request.method === 'auto' ? `${requestedLabel} → ${actualLabel}` : actualLabel;

  $('#equityBars').innerHTML = result.map((player, index) => `

    <div class="equity-row" data-player-series="${index}">
      <span class="equity-player-label"><i class="series-marker" aria-hidden="true"></i><span>${player.name}<small>Win ${player.win.toFixed(1)}% · Tie ${player.tie.toFixed(1)}%</small></span></span>
      <div class="eqbar" role="progressbar" aria-label="${player.name} equity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${player.equity.toFixed(1)}"><div class="eqfill player-series" style="width:${player.equity}%"></div></div>
      <b>${player.equity.toFixed(1)}%</b>
    </div>

  `).join('') + `<div class="equity-row equity-row--tie"><span class="equity-player-label"><i class="series-marker" aria-hidden="true"></i><span>Split pots</span></span><div class="eqbar" role="progressbar" aria-label="Split pots" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${splitRate.toFixed(1)}"><div class="eqfill tie" style="width:${splitRate}%"></div></div><b>${splitRate.toFixed(1)}%</b></div>`;

  if ($('#equityResultsPanel')) $('#equityResultsPanel').dataset.resultState = 'complete';
  if ($('#equitySplitSummary')) $('#equitySplitSummary').textContent = `${equityResult.metadata.splitPotTrials.toLocaleString()} · ${splitRate.toFixed(1)}%`;
  if ($('#equityDetailActual')) $('#equityDetailActual').textContent = exact ? 'Exact enumeration' : 'Monte Carlo simulation';
  if ($('#equityDetailEstimate')) $('#equityDetailEstimate').textContent = `${equityResult.metadata.estimatedCombinationsText} combinations`;
  if ($('#equityDetailSamples')) $('#equityDetailSamples').textContent = exact ? 'Not applicable' : equityResult.metadata.samplesCompleted.toLocaleString();
  if ($('#equityDetailSeed')) $('#equityDetailSeed').textContent = exact ? 'Not applicable' : String(equityResult.metadata.seed);
  if ($('#equityDetailUnknown')) $('#equityDetailUnknown').textContent = String(equityResult.metadata.unknownPlayers);
  if ($('#equityDetailBoard')) $('#equityDetailBoard').textContent = String(equityResult.metadata.boardCardsMissing);
  if ($('#equityDetailExecution')) $('#equityDetailExecution').textContent = callEquityServiceBridge('isWorkerBacked') ? 'Web Worker' : 'In-process fallback';
  result.forEach((player, index) => {
    const playerResult = $(`#equityPlayerResult-${index}`);
    if (playerResult) playerResult.textContent = `${player.equity.toFixed(1)}%`;
  });

  toast('Win probability updated', 'success');

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
        if (countEl) countEl.textContent = 'Ahead';
        if (summEl)  summEl.textContent = 'Currently winning — no outs needed.';
        if (cardsEl) cardsEl.innerHTML = '';
      } else if (outsResult.count === 0) {
        panel.dataset.outsState = 'drawing-dead';
        if (countEl) countEl.textContent = '0 total';
        if (summEl)  summEl.textContent = 'No outs — drawing dead.';
        if (cardsEl) cardsEl.innerHTML = '';
      } else {
        panel.dataset.outsState = 'drawing';
        if (countEl) countEl.textContent = outsResult.count + ' total';
        if (summEl) summEl.textContent = 'Cards that improve this hand against the entered known opponents.';
        if (cardsEl) {
          let html = '';
          outsResult.categories.forEach(cat => {
            html += '<div class="outs-group">';
            html += `<div class="outs-group-head"><strong>${cat.name}</strong><span>${cat.cards.length} ${cat.cards.length === 1 ? 'out' : 'outs'}</span></div>`;
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
  clearEquityResults('empty', 'Inputs changed. Calculate to refresh the result.');
  if ($('#methodBadge')) $('#methodBadge').textContent = 'AWAITING CALCULATION';
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
  clearEquityResults('empty', 'Results update after calculation.');
  if ($('#methodBadge')) $('#methodBadge').textContent = 'AWAITING INPUT';
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

  range.addEventListener('input', () => {

    number.value = range.value;

    callback();

  });

  number.addEventListener('input', () => {

    syncSliderPair(rangeId, numberId);

    callback();

  });

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



function toast(message, tone = 'info') {

  const element = $('#toast');

  if (!element) return;

  element.textContent = message;

  element.dataset.tone = ['info', 'success', 'warning', 'error'].includes(tone) ? tone : 'info';

  element.classList.add('show');

  window.clearTimeout(toast.timer);

  toast.timer = window.setTimeout(() => element.classList.remove('show'), 2200);

}





function bindEvents() {

  document.addEventListener('click', (event) => {

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

      const current = groupCards(group)[index];

      if (current) {

        groupCards(group)[index] = null;

        renderAllCards();

        if (isEquityGroup(group)) setEquityPending();

        else if (group.startsWith('hand-')) renderCanonicalHandWorkspace();

        else updateContext('Cards changed');

        return;

      }

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
    
    const infoEl = $('#infoMode') || $('#guideMode');
    if (infoEl) {
      const isInfo = (mode === 'info' || mode === 'guide');
      infoEl.classList.toggle('active', isInfo);
      infoEl.style.display = isInfo ? 'block' : 'none';
    }
  }));

  $$('.sub-tab').forEach((button) => button.addEventListener('click', () => {

    const view = button.dataset.gtoView;

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

      if (app.chartUpdatePending) {

        renderChart();

        app.chartUpdatePending = false;

      } else {

        renderChart();

      }

    }

    if (view === 'range') renderRangeAdvantage();

    if (view === 'tree') renderBettingTree();

  }));

  if ($('#openCharts')) $('#openCharts').addEventListener('click', () => { const el = document.querySelector('[data-gto-view="chart"]'); if (el) el.click(); });

  if ($('#backContext')) $('#backContext').addEventListener('click', () => { const el = document.querySelector('[data-gto-view="context"]'); if (el) el.click(); });

  

  if ($('#chartAction')) $('#chartAction').addEventListener('change', renderChart);

  ['rangeAdvHeroPos', 'rangeAdvVilPos'].forEach((id) => {
    if ($('#' + id)) $('#' + id).addEventListener('change', renderRangeAdvantage);
  });



  bindSliderPair('players', 'playersNum', () => {
    updatePositions();
    updateContext('Table size changed');
  });

  bindSliderPair('stack', 'stackNum', () => {
    updateContext('Stack changed');
  });

  bindSliderPair('ante', 'anteNum', () => {
    updateContext('Ante changed');
  });

  bindSliderPair('facingSize', 'facingSizeNum', () => updateContext('Sizing changed'));

  bindSliderPair('potSize', 'potSizeNum', () => updateContext('Sizing changed'));

  ['rakeMode', 'stackMode', 'heroPos', 'straddle'].forEach((id) => {

    if ($('#' + id)) $('#' + id).addEventListener('change', () => {
      updateContext('Configuration changed');
    });

  });

  ['lastAction'].forEach((id) => {

    if ($('#' + id)) $('#' + id).addEventListener('change', () => updateContext('Configuration changed'));

  });

  // Debounce slider inputs to prevent lag - reduced to 50ms for faster response

  let sliderDebounce;

  ['facingSize', 'potSize'].forEach((id) => {

    if ($('#' + id)) {
      $('#' + id).addEventListener('input', () => {

        clearTimeout(sliderDebounce);

        sliderDebounce = setTimeout(() => updateContext('Sizing changed'), 50);

      });
    }

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



  if ($('#openSettings')) $('#openSettings').addEventListener('click', () => { if ($('#settingsModal')) $('#settingsModal').classList.add('show'); });

  if ($('#closeSettingsModal')) $('#closeSettingsModal').addEventListener('click', () => { if ($('#settingsModal')) $('#settingsModal').classList.remove('show'); });

  if ($('#settingsModal')) $('#settingsModal').addEventListener('click', (event) => { if (event.target === $('#settingsModal')) $('#settingsModal').classList.remove('show'); });

  if ($('#fourColorDeckToggle')) $('#fourColorDeckToggle').addEventListener('click', () => applyDeckStyle(!app.settings.fourColorDeck));

  if ($('#toggleTableBtn')) {
    $('#toggleTableBtn').addEventListener('click', (e) => {
      const wrapper = $('#table-wrapper');
      if (wrapper) {
        wrapper.classList.toggle('collapsed');
        const collapsed = wrapper.classList.contains('collapsed');
        e.currentTarget.setAttribute('aria-expanded', String(!collapsed));
        e.currentTarget.textContent = collapsed ? 'Expand Table' : 'Collapse Table';
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

    updateContext('Theme changed');

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
  const flatDropEl = document.getElementById('flatDrop');
  if (flatDropEl) {
    flatDropEl.addEventListener('change', () => updateContext('Flat Drop changed'));
    flatDropEl.addEventListener('input', () => updateContext('Flat Drop changed'));
  }

  // Initialize training mode

  initTrainingMode();



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
      
      updateContext(`Switched to ${newTheme} theme`);
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
  { id: 'luxury', name: 'Luxury Gold', color: '#e94560', bg: '#1a1a2e', sharp: false, legacy: true },
  { id: 'discord-0px', name: 'Discord Dark (0px)', color: '#5865f2', bg: '#1e1f22', sharp: true, legacy: true },
  { id: 'serious-pio', name: 'PioSolver Sharp (0px)', color: '#6a8c7a', bg: '#12161a', sharp: true, legacy: true },
  { id: 'terminal', name: 'Terminal Dark CRT (0px)', color: '#00ff66', bg: '#040906', sharp: true, legacy: true },
  { id: 'brutalist-slate', name: 'Brutalist Slate (0px)', color: '#94a3b8', bg: '#0f172a', sharp: true, legacy: true },
  { id: 'brutalist-cyan', name: 'Brutalist Cyan (0px)', color: '#06b6d4', bg: '#0a1a1a', sharp: true, legacy: true },
  { id: 'brutalist-purple', name: 'Brutalist Purple (0px)', color: '#a855f7', bg: '#1a0a1a', sharp: true, legacy: true },
  { id: 'brutalist-amber', name: 'Brutalist Amber (0px)', color: '#f59e0b', bg: '#140c04', sharp: true, legacy: true },
  { id: 'brutalist-emerald', name: 'Brutalist Emerald (0px)', color: '#10b981', bg: '#051410', sharp: true, legacy: true },
  { id: 'brutalist-rose', name: 'Brutalist Rose (0px)', color: '#f43f5e', bg: '#1a0a10', sharp: true, legacy: true },
  { id: 'brutalist-red', name: 'Brutalist Red (0px)', color: '#ef4444', bg: '#1a0a0a', sharp: true, legacy: true }

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

        ${tItem.sharp ? `<span class="theme-swatch-sharp">0px</span>` : ''}

      </button>

    `;

  };



  grid.innerHTML = `

    <div class="theme-swatch-heading">Riverline Themes</div>

    ${riverlineThemes.map(renderBtn).join('')}

    <div class="theme-swatch-heading theme-swatch-heading--legacy">Legacy / Experimental</div>

    ${legacyThemes.map(renderBtn).join('')}

  `;

  

  $$('.theme-swatch-btn').forEach(btn => {

    btn.addEventListener('click', () => {

      const themeId = btn.dataset.themeId;

      document.documentElement.dataset.theme = themeId;

      localStorage.setItem('appTheme', themeId);

      if ($('#themeColor')) $('#themeColor').value = themeId;

      initThemeSwatches();

      updateContext('Theme changed');

    });

  });

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

    initSidebar();

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

    bindPlaybookModeControl();

    

    updateContext('Ready');

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

  const profile = strategyResultToLegacyProfile(actionProfile());
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
    toast('Enter a whole-number seed from 0 through 4294967295.', 'warning');
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
    if (message) message.textContent = 'Hero moved to BB because the check-option target requires the big blind.';
  } else if (target.value === TRAINING_TARGETS.PREFLOP_UNOPENED && position?.value === 'BB') {
    const alternatives = [...position.options].map((option) => option.value).filter((value) => value !== 'BB');
    position.value = alternatives.includes('BTN') ? 'BTN' : alternatives[0];
    if (message) message.textContent = 'Hero moved out of BB because an unopened RFI is not a BB check option.';
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
  window.dispatchEvent(new CustomEvent('riverlineCardRankStyleChanged', { detail: { style: nextStyle } }));
}

function applySidebarState(collapsed) {
  const shell = $('.riverline-shell');
  const rail = $('#modeRail');
  const button = $('#sidebarCollapseBtn');
  if (!shell || !rail || !button) return;
  shell.classList.toggle('is-sidebar-collapsed', collapsed);
  rail.dataset.collapsed = String(collapsed);
  button.setAttribute('aria-expanded', String(!collapsed));
  button.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
  button.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
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
    toast('Training seed copied.', 'success');
  } catch (error) {
    const input = $('#trainingSeedInput');
    if (input) {
      input.value = String(seed);
      input.select();
    }
    toast('Seed placed in the field. Copy it from there.', 'info');
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
  bind('#trainingNewHand', 'click', () => newRandomTrainingHand());
  bind('#trainingNextHandBtn', 'click', () => newRandomTrainingHand());
  bind('#trainingRetryButton', 'click', () => newRandomTrainingHand());
  bind('#trainingReplayBtn', 'click', () => app.training.currentExercise
    && replayTrainingExercise(app.training.currentExercise.seed));
  bind('#trainingReplayDecisionBtn', 'click', () => app.training.currentExercise
    && replayTrainingExercise(app.training.currentExercise.seed));
  bind('#trainingGenerateSeed', 'click', () => {
    const seed = selectedTrainingSeed();
    if (seed !== null) newRandomTrainingHand({ seed });
  });
  bind('#trainingCopySeed', 'click', copyCurrentTrainingSeed);
  bind('#trainingAdjustDrill', 'click', () => {
    $('#trainingAdvanced')?.removeAttribute('open');
    $('#trainingStreet')?.focus({ preventScroll: false });
  });

  bind('#trainingShowSolution', 'click', function toggleStudyMode() {
    const nextState = this.getAttribute('aria-pressed') !== 'true';
    this.classList.toggle('on', nextState);
    this.setAttribute('aria-pressed', String(nextState));
    app.training.showSolutionImmediately = nextState;
    if (nextState && app.training.currentSolution && app.training.lifecycle === 'ready') {
      showTrainingSolution(app.training.currentSolution);
    } else if (!nextState && app.training.lifecycle === 'ready' && $('#trainingSolution')) {
      $('#trainingSolution').hidden = true;
    }
  });
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
  setTrainingWorkspaceState('idle');
  updateTrainingStats();
}




// Keep Training cards as a read-only projection of the generated exercise.
(function installTrainingCardProjection() {
  const originalRenderAllCards = renderAllCards;
  renderAllCards = function renderAllCardsWithTrainingProjection() {
    originalRenderAllCards();
    const trainingMode = $('#trainingMode');
    if (!trainingMode || trainingMode.style.display === 'none') return;

    const heroCards = app.training.hero || [];
    const boardCards = app.training.board || [];
    const readOnlyCard = (card) =>
      `<span class="training-readonly-card riverline-card" role="img" aria-label="${displayCard(card)}">${cardMarkup(card)}</span>`;
    const heroTarget = $('#trainingHeroCards');
    const boardTarget = $('#trainingBoardCards');
    if (heroTarget) heroTarget.innerHTML = heroCards.map(readOnlyCard).join('');
    if (boardTarget) {
      boardTarget.innerHTML = boardCards.length
        ? boardCards.map(readOnlyCard).join('')
        : '<span class="training-no-board">No board cards</span>';
    }
    if ($('#trainingHandDisplay')) {
      $('#trainingHandDisplay').textContent = heroCards.length === 2
        ? formatHand(heroCards) || heroCards.map(displayCard).join(' ')
        : '—';
    }
  };
})();


function normalizeActionName(act) {
  const a = (act || '').toLowerCase();
  if (a.includes('3-bet') || a.includes('3bet')) return '3-bet';
  if (a.includes('4-bet') || a.includes('4bet')) return '4-bet';
  if (a.includes('raise') || a.includes('open')) return 'raise';
  if (a.includes('bet')) return 'bet';
  if (a.includes('check')) return 'check';
  if (a.includes('call')) return 'call';
  if (a.includes('fold')) return 'fold';
  return a;
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
          hintText.textContent = `The nominal wager is ${facing.toFixed(1)}bb; Hero must call ${callAmount.toFixed(1)}bb in ${heroPos}. Pot odds require at least ${odds}% raw equity to call. MDF (${mdf}%) is a range-level reference, not a threshold for this hand. Consider position and blockers before choosing.`;
        } else {
          hintText.textContent = `Unopened/Checked spot in ${heroPos}. Consider positional advantage and range-building when deciding between opening/betting or checking.`;
        }
      }
    }
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
    feedbackDiv.classList.remove('animate-feedback');
    void feedbackDiv.offsetWidth;
    feedbackDiv.classList.add('animate-feedback');
  }

}



function showTrainingSolution(solution) {

  console.log('[Training] showTrainingSolution called with:', solution);

  const solutionDiv = $('#trainingSolution');

  if (!solutionDiv) return;

  // Build normalized list of actions with color and percentage
  const actionsList = [];
  for (const [name, rawPct] of Object.entries(solution)) {
    const val = Number(rawPct) || 0;
    if (val <= 0) continue;
    const lower = name.toLowerCase();
    const kind = visualActionKind({ name, kind: lower.includes('fold') ? 'fold' : lower.includes('call') || lower.includes('check') ? 'passive' : 'aggressive' });

    actionsList.push({
      name: name,
      pct: val,
      kind,
      color: ACTION_COLORS[kind] || ACTION_COLORS.unavailable
    });
  }

  // Sort actions strictly by descending percentage chance!
  actionsList.sort((a, b) => b.pct - a.pct);

  // Normalize percentages to sum to 100%
  const total = actionsList.reduce((acc, cur) => acc + cur.pct, 0);
  if (total > 0) {
    let rem = 100;
    actionsList.forEach((act, i) => {
      if (i === actionsList.length - 1) {
        act.pct = Math.max(0, rem);
      } else {
        act.pct = Math.round((act.pct / total) * 100);
        rem -= act.pct;
      }
    });
  }

  if (typeof renderFrequencyStack === 'function') {
    renderFrequencyStack($('#trainingFrequencyStack'), actionsList.map((action) => ({
      name: action.name,
      value: action.pct,
      kind: action.kind
    })));
  }

  const rows = $('#trainingFrequencyRows');
  const evaluation = app.training.currentEvaluation;
  if (rows) {
    rows.innerHTML = '';
    actionsList.forEach((action) => {
      const isChosen = evaluation && normalizeActionName(action.name) === normalizeActionName(
        evaluation.mappedStrategyAction?.label || evaluation.chosenAction?.type
      );
      const isBest = evaluation && normalizeActionName(action.name) === normalizeActionName(
        evaluation.bestStrategyAction?.label
      );
      const row = document.createElement('div');
      row.className = 'training-frequency-row';
      row.dataset.actionKind = action.kind;
      row.classList.toggle('is-chosen', Boolean(isChosen));
      row.classList.toggle('is-best', Boolean(isBest));
      const label = document.createElement('span');
      label.className = 'training-frequency-label';
      const name = document.createElement('span');
      name.className = 'training-frequency-name';
      name.textContent = action.name;
      const markers = document.createElement('span');
      markers.className = 'training-frequency-markers';
      if (isChosen) markers.append(Object.assign(document.createElement('em'), {
        className: 'training-frequency-marker training-frequency-marker--chosen',
        textContent: 'Chosen'
      }));
      if (isBest) markers.append(Object.assign(document.createElement('em'), {
        className: 'training-frequency-marker training-frequency-marker--highest',
        textContent: 'Highest'
      }));
      label.append(name, markers);
      const track = document.createElement('span');
      track.className = 'training-frequency-track';
      const fill = document.createElement('i');
      fill.style.width = `${action.pct}%`;
      track.appendChild(fill);
      const value = document.createElement('strong');
      value.textContent = `${action.pct}%`;
      row.setAttribute('aria-label', `${action.name}: ${action.pct}%${isChosen ? ', chosen action' : ''}${isBest ? ', highest frequency' : ''}`);
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
      if (nameEl) nameEl.textContent = item.name;
      if (fillEl) {
        fillEl.style.width = item.pct + '%';
        fillEl.style.removeProperty('background');
        fillEl.dataset.actionKind = item.kind;
        fillEl.setAttribute('aria-label', `${item.name}: ${item.pct}%`);
      }
      if (numEl) numEl.textContent = item.pct + '%';
      if (nameEl?.parentElement) nameEl.parentElement.style.display = 'flex';
    } else {
      if (nameEl?.parentElement) nameEl.parentElement.style.display = 'none';
    }
  }

  solutionDiv.hidden = false;
  solutionDiv.classList.remove('animate-solution');
  void solutionDiv.offsetWidth;
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




function evaluatePostflopHand(heroCards, boardCards) {
  if (!heroCards || heroCards.length !== 2 || !boardCards || boardCards.length < 3) {
    return { madeHand: t('High Card'), draws: [] };
  }

  const allCards = [...heroCards, ...boardCards];
  const hRanks = heroCards.map(c => RANK_VALUE[c[0]] !== undefined ? RANK_VALUE[c[0]] : 0);
  const bRanks = boardCards.map(c => RANK_VALUE[c[0]] !== undefined ? RANK_VALUE[c[0]] : 0);
  
  const rankCounts = {};
  allCards.forEach(c => {
    const r = RANK_VALUE[c[0]];
    if (r !== undefined) rankCounts[r] = (rankCounts[r] || 0) + 1;
  });
  
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const maxRankCount = counts[0] || 0;
  const secondRankCount = counts[1] || 0;

  let isFlush = false, isFlushDraw = false;
  const handSuitCounts = {};
  allCards.forEach(c => { handSuitCounts[c[1]] = (handSuitCounts[c[1]] || 0) + 1; });
  Object.values(handSuitCounts).forEach(cnt => {
    if (cnt >= 5) isFlush = true;
    if (cnt === 4) isFlushDraw = true;
  });

  const uniqueRanks = Array.from(new Set(allCards.map(c => RANK_VALUE[c[0]]))).sort((a, b) => b - a);
  if (uniqueRanks.includes(12)) uniqueRanks.push(-1);
  let isStraight = false, isOESD = false;
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) isStraight = true;
  }
  for (let i = 0; i <= uniqueRanks.length - 4; i++) {
    if (uniqueRanks[i] - uniqueRanks[i + 3] === 3) isOESD = true;
  }

  let madeHand = t('High Card');
  if (maxRankCount >= 4) madeHand = t('Quads');
  else if (maxRankCount >= 3 && secondRankCount >= 2) madeHand = t('Full House');
  else if (isFlush) madeHand = t('Flush');
  else if (isStraight) madeHand = t('Straight');
  else if (maxRankCount >= 3) madeHand = t('Three of a Kind');
  else if (maxRankCount === 2 && secondRankCount === 2) madeHand = t('Two Pair');
  else if (maxRankCount === 2) {
    const maxBoardRank = Math.max(...bRanks);
    const matchedBoardRanks = hRanks.filter(r => bRanks.includes(r));
    if (hRanks[0] === hRanks[1]) {
      madeHand = hRanks[0] > maxBoardRank ? t('Overpair') : t('Pocket Pair');
    } else if (matchedBoardRanks.includes(maxBoardRank)) {
      madeHand = t('Top Pair');
    } else if (matchedBoardRanks.length > 0) {
      madeHand = Math.max(...matchedBoardRanks) === Math.min(...bRanks) ? t('Bottom Pair') : t('Middle Pair');
    } else {
      madeHand = t('Pair on Board');
    }
  }

  const draws = [];
  if (isFlushDraw && !isFlush) draws.push(t('Flush Draw'));
  if (isOESD && !isStraight) draws.push(t('OESD'));
  
  return { madeHand, draws };
}
function evaluatePostflopHandStrength(heroCards, boardCards) {

  if (!heroCards || heroCards.length !== 2 || !boardCards || boardCards.length < 3) {

    return { category: 'air', score: 0, tripsType: null, tripsStrength: 1.0, isBoardPaired: false, isWetBoard: false, boardTexture: null };

  }



  const allCards = [...heroCards, ...boardCards];

  const hRanks = heroCards.map(c => RANK_VALUE[c[0]] !== undefined ? RANK_VALUE[c[0]] : 0);

  const bRanks = boardCards.map(c => RANK_VALUE[c[0]] !== undefined ? RANK_VALUE[c[0]] : 0);



  const maxBoardRank = Math.max(...bRanks);

  const matchedBoardRanks = hRanks.filter(r => bRanks.includes(r));

  const isPocketPair = hRanks[0] === hRanks[1];



  // Board texture analysis for vulnerability
  const boardRankCounts = {};
  bRanks.forEach(r => { boardRankCounts[r] = (boardRankCounts[r] || 0) + 1; });
  const isBoardPaired = Object.values(boardRankCounts).some(c => c >= 2);
  
  // Check for wet board (3 connected cards or 3 of same suit)
  const boardSuits = boardCards.map(c => c[1]);
  const boardSuitCounts = {};
  boardSuits.forEach(s => { boardSuitCounts[s] = (boardSuitCounts[s] || 0) + 1; });
  const isFlushyBoard = Object.values(boardSuitCounts).some(c => c >= 3);
  
  const sortedBoardRanks = [...new Set(bRanks)].sort((a, b) => a - b);
  let maxConsecutive = 1, cur = 1;
  for (let i = 1; i < sortedBoardRanks.length; i++) {
    if (sortedBoardRanks[i] - sortedBoardRanks[i-1] <= 2) { cur++; maxConsecutive = Math.max(maxConsecutive, cur); }
    else cur = 1;
  }
  const isConnectedBoard = maxConsecutive >= 3;
  const isWetBoard = isFlushyBoard || isConnectedBoard;

  // Enhanced board texture analysis
  const heroSuits = heroCards.map(c => c[1]);
  const heroSuitsSet = new Set(heroSuits);
  
  // Flush draw completion: Hero has 2 of same suit when board has 2 of that suit
  let flushDrawCompletion = false;
  let flushDrawSuit = null;
  for (const [suit, count] of Object.entries(boardSuitCounts)) {
    if (count === 2 && heroSuits.filter(s => s === suit).length >= 2) {
      flushDrawCompletion = true;
      flushDrawSuit = suit;
      break;
    }
  }
  
  // Backdoor flush draw: Hero has 2 of same suit when board has 1 of that suit
  let backdoorFlushDraw = false;
  for (const [suit, count] of Object.entries(boardSuitCounts)) {
    if (count === 1 && heroSuits.filter(s => s === suit).length >= 2) {
      backdoorFlushDraw = true;
      break;
    }
  }
  
  // Straight draw completion analysis
  const heroRanksSet = new Set(hRanks);
  const boardRanksSet = new Set(bRanks);
  const combinedRanks = [...new Set([...hRanks, ...bRanks])].sort((a, b) => a - b);
  
  // Check if hero completes straight connectivity
  let straightDrawCompletion = false;
  let straightCompletionCount = 0;
  
  // Count consecutive sequences including hero cards
  let maxConsecutiveWithHero = 1, curHero = 1;
  for (let i = 1; i < combinedRanks.length; i++) {
    if (combinedRanks[i] - combinedRanks[i-1] <= 2) { 
      curHero++; 
      maxConsecutiveWithHero = Math.max(maxConsecutiveWithHero, curHero);
    } else curHero = 1;
  }
  
  // If hero adds to connectivity that board didn't have
  if (maxConsecutiveWithHero > maxConsecutive && maxConsecutiveWithHero >= 3) {
    straightDrawCompletion = true;
    straightCompletionCount = maxConsecutiveWithHero - maxConsecutive;
  }
  
  // Open-ended straight draw (OESD) vs gutshot
  let isOESD = false;
  let isGutshot = false;
  
  // Check for OESD (4 consecutive ranks with gap at ends)
  for (let i = 0; i <= combinedRanks.length - 4; i++) {
    if (combinedRanks[i + 3] - combinedRanks[i] === 3) {
      isOESD = true;
      break;
    }
  }
  
  // Check for gutshot (gap of 1 in middle of 4-rank sequence)
  for (let i = 0; i <= combinedRanks.length - 4; i++) {
    const seq = combinedRanks.slice(i, i + 4);
    const gaps = [];
    for (let j = 1; j < 4; j++) {
      gaps.push(seq[j] - seq[j-1]);
    }
    if (gaps.filter(g => g === 1).length === 2 && gaps.filter(g => g === 2).length === 1) {
      isGutshot = true;
      break;
    }
  }

  // Board texture categorization
  const boardTexture = {
    isPaired: isBoardPaired,
    isFlushy: isFlushyBoard,
    isConnected: isConnectedBoard,
    isWet: isWetBoard,
    flushDrawCompletion,
    flushDrawSuit,
    backdoorFlushDraw,
    straightDrawCompletion,
    straightCompletionCount,
    isOESD,
    isGutshot,
    monotone: Object.values(boardSuitCounts).some(c => c >= 3) && new Set(boardSuits).size === 1,
    twoTone: new Set(boardSuits).size === 2,
    rainbow: new Set(boardSuits).size === 3
  };

  // Rank occurrence counts (Hero + Board)

  const rankCounts = {};

  allCards.forEach(c => {

    const r = RANK_VALUE[c[0]];

    if (r !== undefined) rankCounts[r] = (rankCounts[r] || 0) + 1;

  });



  const counts = Object.values(rankCounts).sort((a, b) => b - a);

  const maxRankCount = counts[0] || 0;

  const secondRankCount = counts[1] || 0;
  
  // Determine three of a kind type (Set vs Trips)
  let tripsType = null;
  let tripsStrength = 1.0; // EV modifier
  
  if (maxRankCount >= 3) {
    const tripRank = Object.keys(rankCounts).find(r => rankCounts[r] === 3);
    if (tripRank && isPocketPair) {
      // Check if hero's pocket pair matched the board (Set)
      if (hRanks[0] === parseInt(tripRank)) {
        tripsType = 'set';
        tripsStrength = 1.4; // Massive EV multiplier for disguised sets
      } else {
        tripsType = 'trips';
        // Check kicker strength
        const kickerRank = hRanks.find(r => r !== parseInt(tripRank));
        if (kickerRank >= 12) { // Ace or King kicker
          tripsStrength = 1.0; // Strong trips
        } else if (kickerRank < 10) { // Weak kicker (less than Jack)
          tripsStrength = 0.7; // Vulnerable trips - recommend pot control
        } else {
          tripsStrength = 0.85; // Medium strength trips
        }
      }
    } else if (!isPocketPair) {
      tripsType = 'trips';
      const kickerRank = hRanks.find(r => r !== parseInt(tripRank));
      if (kickerRank >= 12) {
        tripsStrength = 1.0;
      } else if (kickerRank < 10) {
        tripsStrength = 0.7;
      } else {
        tripsStrength = 0.85;
      }
    }
  }



  // Flush detection

  let isFlush = false;

  let isFlushDraw = false;

  const allSuitCounts = {};

  allCards.forEach(c => { allSuitCounts[c[1]] = (allSuitCounts[c[1]] || 0) + 1; });

  Object.values(allSuitCounts).forEach(cnt => {

    if (cnt >= 5) isFlush = true;

    if (cnt === 4) isFlushDraw = true;

  });



  // Straight detection

  const uniqueRanks = Array.from(new Set(allCards.map(c => RANK_VALUE[c[0]]))).sort((a, b) => b - a);

  if (uniqueRanks.includes(12)) uniqueRanks.push(-1); // Ace low straight (5-4-3-2-A)

  let isStraight = false;

  for (let i = 0; i <= uniqueRanks.length - 5; i++) {

    if (uniqueRanks[i] - uniqueRanks[i + 4] === 4) {

      isStraight = true;

      break;

    }

  }



  // 1. Quads / Full House / Flush / Straight / Trips (Three of a Kind) -> MONSTER

  if (maxRankCount >= 4) return { category: 'monster', score: 10, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (maxRankCount >= 3 && secondRankCount >= 2) return { category: 'monster', score: 9.8, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (isFlush) return { category: 'monster', score: 9.5, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (isStraight) return { category: 'monster', score: 9.0, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (maxRankCount >= 3) return { category: 'monster', score: 8.8, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture }; // Trips (e.g. 5d As on 5h Qs Td 5s)



  // 2. Two Pair / Overpair / Top Pair

  if (matchedBoardRanks.length === 2 && !isPocketPair) return { category: 'two_pair', score: 8.0, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (counts.filter(c => c >= 2).length >= 2) return { category: 'two_pair', score: 7.8, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (isPocketPair && hRanks[0] > maxBoardRank) return { category: 'overpair', score: 7.5, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (matchedBoardRanks.includes(maxBoardRank)) return { category: 'top_pair', score: 7.0, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };



  // 3. Middle Pair / Weak Pair / Flush Draw

  if (matchedBoardRanks.length === 1 || isPocketPair) return { category: 'middle_pair', score: 4.5, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

  if (isFlushDraw) return { category: 'flush_draw', score: 5.5, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };



  return { category: 'air', score: 1.0, tripsType, tripsStrength, isBoardPaired, isWetBoard, boardTexture };

}

function calculateUnifiedPostflopStrategy(context, heroCards, deadCards = [], decisionContext = null) {
  if (!heroCards || heroCards.length !== 2 || !context || !context.board || context.board.length < 3) return { 'Check': 100 };
  const evalRes = evaluatePostflopHandStrength(heroCards, context.board);
  const sim = simulateEquity(heroCards, context.board, deadCards, 250, decisionContext);
  let eq = sim.eq;
  
  // Legacy manual postflop heuristic only: this is not the ClubGG forced
  // contribution and it never mutates the context pot or accounting fields.
  const flatDrop = Number(document.getElementById('flatDrop') ? document.getElementById('flatDrop').value : 0) || 0;
  const potSize = (Number(context.potSize) || 1.5) + flatDrop;
  const facingSize = Number(context.facingSize) || 0;
  const trustedCallAmount = Number.isFinite(decisionContext?.callAmountBb)
    && decisionContext.callAmountBb >= 0
    ? decisionContext.callAmountBb
    : null;
  const stack = Number(context.stack) || 100;
  const spr = stack / (potSize || 1);
  const L = (app.settings && app.settings.tightness !== undefined) ? app.settings.tightness / 100.0 : 0.0;
  const bleedDiscount = flatDrop * 0.15;
  
  // Extract new contextual variables from evalRes
  const tripsType = evalRes.tripsType || null;
  const tripsStrength = evalRes.tripsStrength || 1.0;
  const isBoardPaired = evalRes.isBoardPaired || false;
  const isWetBoard = evalRes.isWetBoard || false;
  const boardTexture = evalRes.boardTexture || {};
  
  // Enhanced board texture equity adjustments
  if (boardTexture.flushDrawCompletion) {
    // Hero has nut flush draw - significant equity boost
    eq *= 1.15;
  }
  
  if (boardTexture.backdoorFlushDraw && evalRes.category === 'middle_pair') {
    // Backdoor flush draw adds value to marginal hands
    eq *= 1.05;
  }
  
  if (boardTexture.isOESD) {
    // Open-ended straight draw is very valuable
    eq *= 1.12;
  } else if (boardTexture.isGutshot) {
    // Gutshot still adds some value
    eq *= 1.04;
  }
  
  if (boardTexture.monotone && evalRes.category === 'air') {
    // Air on monotone board is even weaker
    eq *= 0.85;
  }
  
  // Apply trips/set EV modifier
  if (tripsType && tripsStrength !== 1.0) {
    eq *= tripsStrength;
  }
  
  // Board vulnerability discounts
  if (isBoardPaired && (evalRes.category === 'monster' && !tripsType)) {
    // Paired board with non-trips monster (flush/straight) - discount equity
    eq *= 0.8;
  }
  
  if (isWetBoard && evalRes.category === 'top_pair') {
    // Top pair on wet board without suit blocker - heavy discount
    const heroSuits = heroCards.map(c => c[1]);
    const boardSuits = context.board.map(c => c[1]);
    const hasSuitBlocker = heroSuits.some(s => boardSuits.includes(s));
    if (!hasSuitBlocker) {
      eq *= 0.75;
    }
  }
  
  // Dynamic SPR guardrails
  if (spr < 2) {
    // Shallow stacks - committed with top pair or better
    if (evalRes.category === 'top_pair' || evalRes.category === 'two_pair' || tripsType) {
      // Ignore weak kicker penalties in shallow SPR
      if (tripsType && tripsStrength < 1.0) {
        eq /= tripsStrength; // Remove the trips penalty
        eq *= 1.0; // Neutral multiplier
      }
    }
  } else if (spr > 10) {
    // Deep stacks - pot control with weak hands
    if (tripsType === 'trips' && tripsStrength < 1.0) {
      // Force pot control for vulnerable trips in deep stacks
      eq *= 0.8; // Additional discount to encourage checking/calling
    }
    if (evalRes.category === 'top_pair' && isWetBoard) {
      eq *= 0.7; // Stronger pot control recommendation
    }
  }
  
  const isSuited = heroCards[0][1] === heroCards[1][1];
  const r1 = RANK_VALUE[heroCards[0][0]]; const r2 = RANK_VALUE[heroCards[1][0]];
  const isKxQx = r1 >= 10 || r2 >= 10;
  if (isSuited || isKxQx) eq *= (1.0 + (0.15 * L));
  
  if (typeof calculateBoardWetness !== 'undefined' && calculateBoardWetness(context.board) > 0.7 && evalRes.category !== 'monster') eq *= 0.85;
  
  const requiredRawEquity = trustedCallAmount !== null && trustedCallAmount > 0
    ? trustedCallAmount / (potSize + trustedCallAmount)
    : null;
  
  let rFactor = 1.0;
  const heroPos = context.hero_pos || context.positions || 'BTN';
  const villainPos = context.villain_pos || (['BTN', 'CO', 'HJ'].includes(heroPos) ? 'BB' : 'SB');
  const isIP = (['BTN', 'CO', 'HJ'].includes(heroPos) && ['BB', 'SB'].includes(villainPos));

  if (isIP) rFactor += 0.15;
  else rFactor -= 0.10;

  const isConnected = Math.abs(r1 - r2) <= 2;
  if (isSuited) rFactor += 0.10;
  if (isConnected) rFactor += 0.05;

  let realizedEquity = eq * rFactor;
  if (evalRes.category === 'monster') {
    realizedEquity = Math.max(realizedEquity, 0.90);
  }
  realizedEquity = Math.min(1.0, realizedEquity);

  let strategy = {};
  let openThreshold = 0.85 - bleedDiscount;
  let betThreshold = 0.65 - bleedDiscount;
  let callRaiseThreshold = 0.75 - bleedDiscount;

  if (facingSize === 0) {
    if (realizedEquity >= openThreshold || eq >= 0.95 || evalRes.category === 'monster') {
      strategy = { 'Bet': 100 };
    } else if (realizedEquity >= betThreshold || evalRes.category === 'two_pair' || evalRes.category === 'top_pair') {
      strategy = { 'Bet': 75, 'Check': 25 };
    } else if (realizedEquity >= 0.50 - bleedDiscount || evalRes.category === 'middle_pair') {
      strategy = { 'Bet': 25, 'Check': 75 };
    } else {
      strategy = { 'Check': 100 };
    }
  } else {
    if (realizedEquity >= 0.90 - bleedDiscount || evalRes.category === 'monster') {
      strategy = { 'Raise': 100 };
    } else if (realizedEquity >= callRaiseThreshold || evalRes.category === 'two_pair') {
      strategy = { 'Raise': 25, 'Call': 75 };
    } else if (requiredRawEquity !== null
      ? realizedEquity >= requiredRawEquity
      // Scenario has no exact call price. Keep the heuristic available using
      // its established neutral equity boundary without inventing pot odds.
      : realizedEquity >= 0.50 - bleedDiscount) {
      strategy = { 'Call': 100 };
    } else {
      strategy = { 'Fold': 100 };
    }
  }
  
  // Store contextual info for teacher engine
  strategy.context = {
    tripsType,
    tripsStrength,
    isBoardPaired,
    isWetBoard,
    spr,
    originalEquity: sim.eq,
    modifiedEquity: eq,
    boardTexture
  };
  
  return strategy;
}

const TRAINING_CONFIG_SCHEMA_VERSION = 'training-config/v1';

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
  return {
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
}

function withDeterministicTrainingStrategyRandom(seed, callback) {
  let state = (seed >>> 0) || 0x9e3779b9;
  const originalRandom = Math.random;
  Math.random = function trainingStrategyRandom() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function trainingStrategyResultToLegacySolution(strategyResult) {
  if (!strategyResult || strategyResult.schemaVersion !== STRATEGY_RESULT_SCHEMA_VERSION) {
    throw new TypeError('Training requires StrategyResult v1');
  }
  return strategyResult.actions.reduce((solution, entry) => {
    const label = entry.label || entry.action?.type || 'Unavailable';
    solution[label] = (solution[label] || 0) + (Number(entry.probability) || 0) * 100;
    return solution;
  }, {});
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
    stateBadge.textContent = labels[state] || state;
    stateBadge.className = `badge status-badge status-badge--${state === 'error' ? 'warning' : state === 'ready' ? 'available' : 'info'}`;
  }
  if ($('#trainingIdle')) $('#trainingIdle').hidden = state !== 'idle';
  if ($('#trainingGenerating')) $('#trainingGenerating').hidden = state !== 'generating';
  if ($('#trainingError')) $('#trainingError').hidden = state !== 'error';
  if ($('#trainingExerciseSurface')) $('#trainingExerciseSurface').hidden = !['ready', 'feedback'].includes(state);
  if ($('#trainingFeedback')) $('#trainingFeedback').hidden = state !== 'feedback';
}

function clearTrainingExercisePresentation() {
  if ($('#trainingExerciseTags')) $('#trainingExerciseTags').innerHTML = '';
  if ($('#trainingActionHistory')) $('#trainingActionHistory').innerHTML = '<li class="is-empty">Generating a new canonical trajectory.</li>';
  if ($('#trainingCurrentActor')) $('#trainingCurrentActor').textContent = 'No decision loaded.';
  if ($('#trainingStrategySource')) {
    $('#trainingStrategySource').textContent = 'Source pending';
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
      tag.textContent = label;
      tags.appendChild(tag);
    });
  }
  const history = $('#trainingActionHistory');
  if (history) {
    history.innerHTML = '';
    if (presentation.actionHistory.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'is-empty';
      empty.textContent = 'No voluntary action precedes this decision.';
      history.appendChild(empty);
    } else {
      presentation.actionHistory.forEach((entry) => {
        const item = document.createElement('li');
        item.dataset.street = entry.street;
        item.classList.toggle('is-hero', entry.isHero);
        const street = document.createElement('span');
        street.className = 'training-history-street';
        street.textContent = entry.street;
        const action = document.createElement('span');
        action.className = 'training-history-action';
        action.textContent = `${entry.actorLabel} · ${t(entry.actionLabel)}${entry.amountLabel ? ` ${entry.amountLabel}` : ''}`;
        item.append(street, action);
        history.appendChild(item);
      });
    }
  }
  if ($('#trainingCurrentActor')) $('#trainingCurrentActor').textContent = `${presentation.currentActor.label} (${presentation.currentActor.position || 'position unavailable'}) is next to act.`;
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
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ui-button training-action-button training-action-button--${type}`;
    button.dataset.action = type;
    button.setAttribute('aria-keyshortcuts', String(index + 1));
    button.setAttribute('aria-label', `${label}${sizing?.boundsLabel ? `, ${sizing.boundsLabel}` : sizing?.amountLabel ? `, ${sizing.amountLabel}` : ''}`);
    const copy = document.createElement('span');
    copy.className = 'training-action-copy';
    const name = document.createElement('strong');
    name.textContent = label;
    const detail = document.createElement('small');
    detail.textContent = sizing?.boundsLabel || sizing?.amountLabel || 'No size required';
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
  sourceElement.title = `Strategy source: ${label}. Exercise seed ${exercise.seed}.`;
  const tone = source.startsWith('heuristic_') ? 'heuristic' : 'info';
  sourceElement.className = `badge status-badge status-badge--${tone}`;
}

function renderTrainingGenerationError(error) {
  app.training.lifecycle = 'error';
  console.error('[Riverline Training generation]', error);
  app.training.currentPresentation = null;
  setTrainingWorkspaceState('error');
  const errorCopy = {
    invalid_config: ['Check the drill setup', 'One or more filters are outside the supported TrainingConfig range.'],
    unsupported_target: ['Unsupported filter combination', 'Choose a street and decision target that belong to the same decision family.'],
    generation_exhausted: ['No matching exercise found', 'The bounded generator could not reach this exact combination. Broaden a filter and try again.'],
    decision_projection_unavailable: ['Decision context unavailable', 'The generated hand could not be projected safely for the strategy path.'],
    strategy_unavailable: ['Strategy reference unavailable', 'The current strategy path did not return a gradeable StrategyResult.'],
    service_unavailable: ['Training service unavailable', 'Reload Riverline and try again. The canonical Training bridge did not load.'],
    internal_error: ['Training could not continue', 'An internal generation error occurred. Try another seed or adjust the drill.']
  };
  const [title, message] = errorCopy[error?.code] || ['Exercise unavailable', 'Try again or adjust the drill.'];
  if ($('#trainingErrorTitle')) $('#trainingErrorTitle').textContent = title;
  if ($('#trainingErrorText')) $('#trainingErrorText').textContent = message;
  if ($('#trainingInstruction')) $('#trainingInstruction').textContent = message;
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.textContent = 'Try again';
  }
  const sourceElement = $('#trainingStrategySource');
  if (sourceElement) {
    sourceElement.textContent = 'Source unavailable';
    sourceElement.className = 'badge status-badge status-badge--warning';
  }
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
  app.training.currentSolution = trainingStrategyResultToLegacySolution(exercise.strategyResult);
  app.training.lifecycle = 'ready';
  setTrainingWorkspaceState('ready');
  renderTrainingPresentation(exercise);

  const streetLabel = $('#trainingStreetLabel');
  if (streetLabel) streetLabel.textContent = context.street.toUpperCase();
  const potInfo = $('#trainingPotInfo');
  if (potInfo) potInfo.style.display = 'flex';
  if ($('#trainingPotVal')) $('#trainingPotVal').textContent = `${context.potBb.toFixed(1)} bb`;
  if ($('#trainingFacingVal')) {
    $('#trainingFacingVal').textContent = context.callAmountBb > 0
      ? `${context.callAmountBb.toFixed(1)} bb to call (${context.facingSizeBb.toFixed(1)} bb to)`
      : context.street === 'preflop' && context.heroPosition !== 'BB'
        ? '0.0 bb (Unopened)' : '0.0 bb (Free Check)';
  }
  if ($('#trainingPotOddsVal')) $('#trainingPotOddsVal').textContent = legacyContext.potOdds === null ? '—' : `${legacyContext.potOdds.toFixed(1)}%`;
  if ($('#trainingMdfVal')) $('#trainingMdfVal').textContent = legacyContext.mdf === null ? '— (range reference)' : `${legacyContext.mdf.toFixed(1)}% (range reference)`;
  if ($('#trainingHeroPos')) $('#trainingHeroPos').value = context.heroPosition;
  if ($('#trainingPositionVal')) $('#trainingPositionVal').textContent = context.heroPosition;
  if ($('#trainingStackVal')) $('#trainingStackVal').textContent = `${context.stackBb.toFixed(1)}bb`;
  if ($('#trainingTableVal')) $('#trainingTableVal').textContent = `${context.tableSize}-max`;

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
  const scoreBadge = $('#trainingScoreBadge');
  if (scoreBadge) scoreBadge.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.disabled = false;
    nextBtn.textContent = 'Skip / next exercise';
  }

  updateTrainingButtons(exercise);
  updateAssistanceDisplay();
  renderTrainingSource(exercise);
  renderAllCards();
  document.querySelectorAll('#trainingHeroCards .training-readonly-card, #trainingBoardCards .training-readonly-card')
    .forEach((card, index) => {
      card.classList.add('is-card-dealt');
      card.style.setProperty('--card-deal-order', String(Math.min(index, 4)));
    });
  if (window.SoundFX) window.SoundFX.playCardDeal(presentation.heroCards.length + presentation.board.length);

  if (app.training.showSolutionImmediately) {
    showTrainingSolution(app.training.currentSolution);
  }
}

async function newRandomTrainingHand(options = {}) {
  const explicitSeed = Number.isInteger(options?.seed) ? options.seed >>> 0 : null;
  const seed = explicitSeed === null ? app.training.nextSeed >>> 0 : explicitSeed;
  if (explicitSeed === null) app.training.nextSeed = nextTrainingSeed(seed);
  const config = options?.config?.schemaVersion === TRAINING_CONFIG_SCHEMA_VERSION
    ? { ...structuredClone(options.config), seed }
    : readTrainingConfig(seed);

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
  if (handDisplay) handDisplay.textContent = 'GENERATING…';
  const instruction = $('#trainingInstruction');
  if (instruction) instruction.textContent = 'Replaying a legal canonical hand trajectory.';
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) nextBtn.disabled = true;
  if ($('#trainingSolution')) $('#trainingSolution').hidden = true;
  if ($('#trainingReplayDecisionBtn')) $('#trainingReplayDecisionBtn').hidden = true;
  renderAllCards();

  const request = callTrainingServiceBridge('generate', config, {
    strategyProvider(decisionContext) {
      return withDeterministicTrainingStrategyRandom(seed, () => (
        actionProfile(null, decisionContext)
      ));
    }
  });
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
  const chosen = evaluation.mappedStrategyAction?.label
    || trainingActionLabel(evaluation.chosenAction.type, app.training.currentExercise.decisionContext);
  const best = evaluation.bestStrategyAction.label;
  const chosenPct = (evaluation.chosenProbability * 100).toFixed(0);
  const bestPct = (evaluation.bestProbability * 100).toFixed(0);
  if (evaluation.grade === 'optimal') {
    return {
      title: 'Optimal',
      text: heuristic
        ? `Within the current strategy estimate, ${chosen} receives ${chosenPct}%. The highest-frequency action is ${best} at ${bestPct}%.`
        : `${source} assigns ${chosenPct}% to ${chosen}. The highest-frequency action is ${best} at ${bestPct}%.`
    };
  }
  if (evaluation.grade === 'acceptable') {
    return {
      title: 'Acceptable',
      text: heuristic
        ? `Acceptable mixed-strategy choice. Within the current strategy estimate, ${chosen} has ${chosenPct}%, within 15 percentage points of ${best} at ${bestPct}%.`
        : `Acceptable mixed-strategy choice: ${source} mixes ${chosen} at ${chosenPct}%, within 15 percentage points of ${best} at ${bestPct}%.`
    };
  }
  return {
    title: 'Mistake',
    text: heuristic
      ? `Within the current strategy estimate, ${chosen} has ${chosenPct}%, compared with ${bestPct}% for ${best}. No EV estimate is available unless the strategy source supplies one.`
      : `${source} assigns ${chosenPct}% to ${chosen}, compared with ${bestPct}% for ${best}. No EV estimate is available unless the strategy source supplies one.`
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
    trustedFacts: trustedAnalysisFacts(exercise.decisionContext, exercise.strategyResult, history),
    authority: 'training',
    depth: 'concise'
  });
  container.hidden = !explanation;
  app.training.currentAnalysisExplanation = explanation;
  return explanation;
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
  app.training.stats.totalHands += 1;
  app.training.stats.correct += evaluation.scoreDelta;
  app.training.stats.streak = evaluation.accepted ? app.training.stats.streak + 1 : 0;
  app.training.bestStreak = Math.max(app.training.bestStreak || 0, app.training.stats.streak);
  app.training.gradeStats[evaluation.grade] = (app.training.gradeStats[evaluation.grade] || 0) + 1;
  if (window.SoundFX) window.SoundFX.playTrainingResult(evaluation.grade);
  updateTrainingStats();

  const scoreBadge = $('#trainingScoreBadge');
  if (scoreBadge) {
    scoreBadge.hidden = false;
    scoreBadge.textContent = `${evaluation.accepted ? 'Accepted' : 'Review'} · ${app.training.stats.correct}/${app.training.stats.totalHands}`;
    scoreBadge.dataset.accepted = String(evaluation.accepted);
  }
  showTrainingFeedback(
    canonicalTrainingFeedback(evaluation, exercise.strategyResult),
    evaluation.accepted
  );
  const chosenLabel = trainingActionLabel(evaluation.chosenAction.type, exercise.decisionContext);
  if ($('#trainingGradeBadge')) {
    $('#trainingGradeBadge').textContent = evaluation.grade.charAt(0).toUpperCase() + evaluation.grade.slice(1);
    $('#trainingGradeBadge').className = `badge training-grade-badge training-grade-badge--${evaluation.grade}`;
  }
  if ($('#trainingFeedback')) $('#trainingFeedback').dataset.grade = evaluation.grade;
  if ($('#trainingChosenAction')) $('#trainingChosenAction').textContent = chosenLabel;
  if ($('#trainingChosenProbability')) $('#trainingChosenProbability').textContent = `${(evaluation.chosenProbability * 100).toFixed(0)}%`;
  if ($('#trainingBestProbability')) $('#trainingBestProbability').textContent = `${evaluation.bestStrategyAction.label} · ${(evaluation.bestProbability * 100).toFixed(0)}%`;
  const evAvailable = evaluation.explanationData.evAvailable;
  if ($('#trainingEvFact')) $('#trainingEvFact').hidden = !evAvailable;
  if (evAvailable && $('#trainingEvValue')) {
    $('#trainingEvValue').textContent = `${evaluation.explanationData.chosenEvBb.toFixed(2)}bb vs ${evaluation.explanationData.bestEvBb.toFixed(2)}bb`;
  }
  renderTrainingDecisionAnalysis(exercise);
  showTrainingSolution(app.training.currentSolution);
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.textContent = 'Next exercise';
  }
  app.training.lifecycle = 'feedback';
  setTrainingWorkspaceState('feedback');
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
