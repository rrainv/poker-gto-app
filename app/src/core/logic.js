

/* Riverline application logic

 * Solver trees are used only where their metadata matches the current decision.

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

// The current ONNX models expose six position features. Full-ring positions
// are mapped explicitly to the closest existing positional band so they never
// fall through to an accidental index-zero/UTG default.
const MODEL_POSITION_VOCABULARY = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const MODEL_POSITION_COMPATIBILITY = {
  'UTG': 'UTG',
  'UTG+1': 'UTG',
  'UTG+2': 'UTG',
  'MP': 'HJ',
  'LJ': 'HJ',
  'HJ': 'HJ',
  'CO': 'CO',
  'BTN': 'BTN',
  'SB': 'SB',
  'BB': 'BB'
};

function modelPositionIndex(position) {
  const compatiblePosition = MODEL_POSITION_COMPATIBILITY[position];
  if (!compatiblePosition) throw new RangeError(`Unsupported position: ${position}`);
  return MODEL_POSITION_VOCABULARY.indexOf(compatiblePosition);
}

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
  settings: { tightness: 0, useOnnx: true, fourColorDeck: true },

  gto: { hero: [], board: [], dead: [] },

  equity: {

    board: [],

    dead: [],

    players: [

      { name: 'Hero', cards: [] },

      { name: 'Opponent 1', cards: [] }

    ]

  },

  training: {

    hero: [],

    board: [],

    stats: { totalHands: 0, correct: 0, streak: 0 },

    showSolutionImmediately: false,

    currentHand: null,

    currentSolution: null

  },

  playbookHandDraft: { bySeat: {}, board: [] },

  picker: null,

  chartStreet: 'preflop',

  selectedHand: null,

  solver: null,

  lastContextKey: '',

  cachedStrategy: null,

  lastApiContext: null,

  decisionContext: null,

  strategyResult: null,

  playbookMode: PLAYBOOK_MODES.SCENARIO,

  playbookResolution: null,

  playbookViewModel: null,

  onnxSession: null,

  useOnnx: false

};

window.app = app;

// Narrow classic-script boundary to the opt-in ESM canonical development
// controller. Bridge failures are observational only and never interrupt the
// authoritative legacy Playbook path.
function callCanonicalDevelopmentBridge(method, ...args) {
  try {
    const bridge = window.RiverlineCanonicalDev;
    if (!bridge || typeof bridge[method] !== 'function') return null;
    return bridge[method](...args);
  } catch (error) {
    if (window.RiverlineCanonicalDev?.isEnabled?.()) {
      console.debug('[Riverline canonical shadow] bridge error', error);
    }
    return null;
  }
}

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

function notifyCanonicalConfigurationChanged() {
  return callCanonicalDevelopmentBridge('configurationChanged');
}

function notifyCanonicalHeroCardsChanged() {
  return callCanonicalDevelopmentBridge('heroCardsChanged', app.gto.hero.filter(Boolean));
}

function notifyCanonicalBoardCardsChanged() {
  return callCanonicalDevelopmentBridge('boardCardsChanged', app.gto.board.filter(Boolean));
}



const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => [...document.querySelectorAll(selector)];

const allDeck = () => SUITS.flatMap((suit) => RANKS.map((rank) => rank + suit.id));

const getSuit = (card) => SUITS.find((suit) => suit.id === (card && card[1]));

const displayCard = (card) => card ? card[0] + getSuit(card).symbol : '';

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
  return `<span class="rank s-${suit.id}">${card[0]}</span><span class="suit s-${suit.id}">${suit.symbol}</span><span class="corner-rank s-${suit.id}">${card[0]}</span>`;

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
    return `<button type="button" class="card-slot card--${state}${card ? ' filled' : ''}${suitClass}" data-card-state="${state}" data-group="${group}" data-index="${index}" aria-label="${card ? 'Replace ' + displayCard(card) + (state === 'dead' ? ', dead card' : '') : 'Choose card ' + (index + 1)}">${cardMarkup(card)}</button>`;

  }).join('');

}



function renderEquityPlayers() {

  const root = $('#equityPlayers');

  if (!root) return;

  root.innerHTML = '';

  app.equity.players.forEach((player, playerIndex) => {

    const row = document.createElement('div');

    row.className = 'player-card';

    const playerLabelText = playerIndex === 0 ? t('Hero') : (t('Opponent') + ' ' + playerIndex);

    const removeText = t('Remove') || 'Remove';

    // Each player row includes card slots + an inline outs panel (hidden until calculated)
    row.innerHTML = `
      <div class="player-label">
        <strong>${playerLabelText}</strong>
        ${playerIndex > 1 ? `<button type="button" class="remove-player ui-button ui-button--quiet ui-button--destructive" data-remove-player="${playerIndex}">${removeText}</button>` : ''}
      </div>
      <div style="display:flex; flex-direction:row; gap:16px; align-items:stretch;">
        <div class="card-slots" data-slots="player-${playerIndex}" style="flex-shrink:0;"></div>
        <div id="outsPanel-${playerIndex}" style="display:none; flex:1; background:rgba(56,189,248,0.07); border:1px solid rgba(56,189,248,0.18); border-radius:8px; padding:10px 12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:7px;">
          <span style="font-size:0.78rem; font-weight:700; color:var(--accent,#38bdf8); letter-spacing:0.04em; text-transform:uppercase;" data-i18n="Outs">Outs</span>
          <span id="outsCount-${playerIndex}" style="font-size:0.78rem; font-weight:800; background:rgba(56,189,248,0.15); color:var(--accent,#38bdf8); padding:2px 8px; border-radius:20px;"></span>
        </div>
        <div id="outsSummary-${playerIndex}" style="font-size:0.77rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4;"></div>
        <div id="outsCards-${playerIndex}" style="display:flex; flex-wrap:wrap; gap:3px;"></div>
      </div>
      </div>`;

    root.appendChild(row);

    renderSlots(`player-${playerIndex}`, 2);

  });



  const add = document.createElement('button');

  add.type = 'button';
  add.className = 'add-player ui-button ui-button--secondary';

  add.innerHTML = '<span>' + (t('+ Add Opponent') || '+ Add Opponent') + '</span>';

  add.addEventListener('click', () => {

    if (app.equity.players.length >= 8) return toast('Maximum of eight players.', 'warning');

    // Edge case: Check if adding too many players would break equity calculation
    if (app.equity.players.length >= 7) {
      const confirmAdd = confirm('Adding more than 7 players may slow down equity calculations. Continue?');
      if (!confirmAdd) return;
    }

    app.equity.players.push({ name: `Opponent ${app.equity.players.length}`, cards: [] });

    renderAllCards();

    setEquityPending();

  });

  root.appendChild(add);

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

  updateActionOptions();

}



function openPicker(group, index) {

  if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
    return toast('These cards come from the canonical hand in Hand mode.', 'warning');
  }

  app.picker = { group, index };

  const current = groupCards(group)[index];

  const modalTitle = $('#modalTitle');

  if (modalTitle) modalTitle.textContent = current ? 'Replace card' : t('Choose a card');

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
        return `<button type="button" class="deck-card card--suit-${suit.id}${isSelected ? ' is-selected' : ''}" aria-label="Choose ${card}${isUnavailable ? ', unavailable' : ''}" aria-pressed="${isSelected}" data-suit="${suit.id}" data-rank="${rank}" data-deck-card="${card}" ${isUnavailable ? 'disabled' : ''}><span class="rank s-${suit.id}">${rank}</span><span class="symbol s-${suit.id}">${suit.symbol}</span></button>`;
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

  if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
    closePicker();
    return toast('These cards come from the canonical hand in Hand mode.', 'warning');
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

  } else {

    target[index] = card;

  }



  if (group === 'hero') {
    app.selectedHand = null;
    notifyCanonicalHeroCardsChanged();
  }
  if (group === 'board') notifyCanonicalBoardCardsChanged();

  if (window.SoundFX) SoundFX.playCardDeal();

  closePicker();

  renderAllCards();

  if (isEquityGroup(group)) setEquityPending();

  else if (group.startsWith('hand-')) renderCanonicalHandWorkspace();

  else if (group.startsWith('training')) {

    if (app.training.hero.length === 2 && app.training.hero[0] && app.training.hero[1]) {
      const heroPos = $('#trainingHeroPos')?.value || 'UTG';
      const lastAction = $('#trainingLastAction')?.value || 'unopened';
      const tableSize = numericValue('#trainingPlayers', 6);
      const stack = numericValue('#trainingStack', 30);
      const facingSize = defaultTrainingFacingSize(lastAction);
      const potSize = (lastAction === 'unopened' ? 1.5 : facingSize > 0 ? facingSize * 1.5 : 1.5);
      
      app.training.currentHand = [...app.training.hero];
      const trainingBoard = (app.training && app.training.board) ? app.training.board : [];
      const activeStreet = trainingBoard.length === 5 ? 'RIVER' : trainingBoard.length === 4 ? 'TURN' : trainingBoard.length === 3 ? 'FLOP' : 'PREFLOP';
      const streetLabel = $('#trainingStreetLabel');
      if (streetLabel) streetLabel.textContent = activeStreet;

      app.training.currentSolution = getTrainingStrategy({
        table_size: tableSize,
        stack: stack,
        ...strategyAccountingContext('off', tableSize, 0),
        hero_pos: heroPos,
        lastAction: lastAction,
        potSize: potSize,
        facingSize: facingSize,
        board: trainingBoard
      }, app.training.currentHand);

      const feedbackDiv = $('#trainingFeedback');
      if (feedbackDiv) feedbackDiv.style.display = 'none';
      const solutionDiv = $('#trainingSolution');
      if (solutionDiv) solutionDiv.style.display = 'none';
      const scoreBadge = $('#trainingScoreBadge');
      if (scoreBadge) scoreBadge.style.display = 'none';
      const guessButtons = $('#trainingGuessButtons');
      if (guessButtons) guessButtons.style.display = 'flex';
    }

  } else updateContext('Cards changed');

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

  if (group === 'hero') app.selectedHand = null;

  groupCards(group).length = 0;

  if (group === 'hero') notifyCanonicalHeroCardsChanged();
  if (group === 'board') notifyCanonicalBoardCardsChanged();

  renderAllCards();

  if (isEquityGroup(group)) setEquityPending();

  else if (group.startsWith('hand-')) renderCanonicalHandWorkspace();

  else if (group.startsWith('training')) {

    // Training group - no context update needed

  } else updateContext('Cards cleared');

}



// ---------------------------------------------------------------------------

// Context and solver tree

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



function defaultTrainingFacingSize(lastAction) {

  const defaults = { raise: 2.5, '3bet': 7.5, '4bet': 18.0 };

  return normalizeFacingSize(lastAction, defaults[lastAction] || 0);

}



const CLUBGG_FORCED_CONTRIBUTION_PER_PLAYER_BB = 0.1;
const DECISION_CONTEXT_SCHEMA_VERSION = 'decision-context/v1';

function strategyAccountingContext(rakeMode, seatedPlayerCount, legacyRakeValue = 0) {

  const mode = rakeMode || 'off';
  const players = Math.max(0, Math.trunc(Number(seatedPlayerCount) || 0));
  const isClubGg = mode === 'fixed';
  const forcedContributionPerPlayerBb = isClubGg ? CLUBGG_FORCED_CONTRIBUTION_PER_PLAYER_BB : 0;
  const totalForcedContributionBb = Math.round(players * forcedContributionPerPlayerBb * 10) / 10;

  // The existing model/API `rake` feature means percentage rake. A fixed
  // per-player hand contribution is not semantically compatible, so Home and
  // ClubGG contexts explicitly adapt that legacy feature to zero.
  const legacyValue = Number(legacyRakeValue);
  const rake = (mode === 'percent' || mode === 'cap') && Number.isFinite(legacyValue)
    ? Math.max(0, legacyValue)
    : 0;

  return {
    rakeMode: mode,
    forcedContributionPerPlayerBb,
    totalForcedContributionBb,
    rake
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
  const legacyRakeValue = numericValue('#rakeValue', 0);
  const accounting = strategyAccountingContext(rakeMode, tableSize, legacyRakeValue);
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
    legacyRakePercent: accounting.rake,
    legacyRakeValue,
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
  'rakeMode', 'rakeValue', 'rakeValueNum', 'rakeUnit', 'rakePot',
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
    return `<button type="button" class="card-slot card--${state}${card ? ' filled' : ''}${suitClass}" data-card-state="${state}" data-group="${group}" data-index="${index}" data-playbook-canonical-display disabled aria-label="${label}">${cardMarkup(card)}</button>`;
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
    rakeMode: decisionContext.rakeMode,
    rakeValue: decisionContext.legacyRakePercent,
    rakeValueNum: decisionContext.legacyRakePercent
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
  else app.playbookHandDraft.board = [];
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
  const supportedRakeModes = ['off', 'percent', 'fixed', 'cap'];
  const rakeMode = supportedRakeModes.includes(snapshot.rakeMode) ? snapshot.rakeMode : 'off';
  const accounting = strategyAccountingContext(rakeMode, tableSize, snapshot.legacyRakeValue);

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
    rakeMode: accounting.rakeMode,
    forcedContributionPerPlayerBb: accounting.forcedContributionPerPlayerBb,
    totalForcedContributionBb: accounting.totalForcedContributionBb,
    legacyRakePercent: accounting.rake
  };

}



function decisionContextToLegacyStrategyContext(context) {

  if (!context || context.schemaVersion !== DECISION_CONTEXT_SCHEMA_VERSION) {
    throw new TypeError('Expected DecisionContext decision-context/v1');
  }

  return {
    table_size: context.tableSize,
    stack: context.stackBb,
    rakeMode: context.rakeMode,
    forcedContributionPerPlayerBb: context.forcedContributionPerPlayerBb,
    totalForcedContributionBb: context.totalForcedContributionBb,
    rake: context.legacyRakePercent,
    hero_pos: context.heroPosition,
    lastAction: context.lastAction,
    potSize: context.potBb,
    facingSize: context.facingSizeBb,
    board: context.board.slice()
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
    decisionContext.stackBb
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



function normalizeTree(data, fileName) {

  if (!data || typeof data !== 'object' || !data.positions) throw new Error('This JSON does not contain a positions solver tree.');

  const stackMatch = String(data.title || fileName).match(/(\d+)\s*bb/i);

  return {

    title: data.title || fileName,

    positions: data.positions,

    strategy: data.strategy,

    stack: stackMatch ? Number(stackMatch[1]) : null,

    fileName

  };

}



function treeContext(decisionContext = null) {

  if (!app.solver) return { available: false, reason: 'Load a local preflop tree to show solver frequencies.' };

  const context = requireDecisionContext(decisionContext);

  if (context.street !== 'preflop') return { available: false, reason: 'The loaded file has no postflop tree.' };

  

  // If we have API/ONNX strategy data, it's available for any context

  if (app.solver.strategy) {
    return { 

      available: true, 

      reason: 'AI solver matches this decision context.',

      isApiStrategy: true

    };

  }

  

  // Local tree restrictions only apply to local trees

  if (context.tableSize !== 6) return { available: false, reason: 'The loaded tree is six-max; current table size does not match.' };

  

  if (context.lastAction !== 'unopened') return { available: false, reason: 'The loaded tree is RFI-only; this action branch is not in the file.' };

  

  if (app.solver.stack && Math.abs(context.stackBb - app.solver.stack) > 1) {

    return { available: false, reason: `Loaded tree is ${app.solver.stack}bb; current stack does not match.` };

  }

  

  const heroPos = context.heroPosition;

  if (Array.isArray(app.solver.positions)) {

    if (!app.solver.positions.includes(heroPos)) return { available: false, reason: 'This hero position is not included in the loaded tree.' };

  } else {

    if (!app.solver.positions[heroPos]) return { available: false, reason: 'This hero position is not included in the loaded tree.' };

  }

  

  return { available: true, reason: 'Loaded local tree matches this decision context.' };

}



function isAllInActionName(name) {

  return /\b(?:all(?:[-\s]+in)?|jam)\b/.test(String(name || '').toLowerCase());

}



function classifyAction(name) {

  const normalized = name.toLowerCase();

  if (/raise|open|bet/.test(normalized) || isAllInActionName(normalized)) return 'aggressive';

  if (/fold/.test(normalized)) return 'fold';

  return 'passive';

}



function standardActionName(name) {

  const normalized = name.toLowerCase();

  if (/raise|open/.test(normalized)) return 'Open';

  if (/bet/.test(normalized)) return 'Bet';

  if (isAllInActionName(normalized)) return 'All-in';

  if (/call/.test(normalized)) return 'Call';

  if (/check/.test(normalized)) return 'Check';

  if (/fold/.test(normalized)) return 'Fold';

  return name;

}



const STRATEGY_RESULT_SCHEMA_VERSION = 'strategy-result/v1';

const STRATEGY_SOURCES = Object.freeze({
  HEURISTIC_PREFLOP: 'heuristic_preflop',
  HEURISTIC_POSTFLOP: 'heuristic_postflop',
  LOCAL_TREE: 'local_tree',
  ONNX_MODEL: 'onnx_model',
  API: 'api',
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

  if (!label || label === 'â€”' || /impossible|unavailable|solver tree|needed/.test(normalized)) type = 'unavailable';
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



function localTreeToStrategyResult(actions, presentation = {}) {

  return createStrategyResult({
    source: STRATEGY_SOURCES.LOCAL_TREE,
    actions,
    recommendedLabel: presentation.recommendedLabel || null,
    explanation: presentation.explanation || null
  });

}



function modelStrategyToStrategyResult(entry, presentation = {}) {

  const source = presentation.source === STRATEGY_SOURCES.API
    ? STRATEGY_SOURCES.API
    : STRATEGY_SOURCES.ONNX_MODEL;
  const actions = Object.entries(entry || {})
    .map(([name, value]) => ({ label: name, value }))
    .sort((a, b) => Number(b.value) - Number(a.value));

  return createStrategyResult({
    source,
    actions,
    recommendedLabel: presentation.recommendedLabel || null,
    explanation: presentation.explanation || null,
    confidence: presentation.confidence,
    coverage: presentation.coverage,
    modelVersion: presentation.modelVersion,
    warnings: presentation.warnings
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
      : result.source === STRATEGY_SOURCES.LOCAL_TREE ? 'LOCAL TREE'
        : result.source;

  return {
    actions,
    best: result.recommendation ? String(result.recommendation.label) : 'LOAD SOLVER TREE',
    reason: result.explanation || '',
    source: legacySource,
    provenance: result.source,
    context: result.details
  };

}



function parseSolverEntry(entry) {

  const detail = String((entry && entry.detail) || '').replace(/Â·/g, '·');

  const extracted = [];

  const matcher = /(raise|open|bet|call|check|fold|jam|all[- ]?in)\s*(\d+(?:\.\d+)?)\s*%/gi;

  let match;

  while ((match = matcher.exec(detail))) {

    extracted.push({ name: standardActionName(match[1]), value: Number(match[2]), kind: classifyAction(match[1]) });

  }

  if (!extracted.length && (entry && entry.type)) {

    const name = standardActionName(entry.type);

    extracted.push({ name, value: 100, kind: classifyAction(name) });

  }

  const total = extracted.reduce((sum, action) => sum + action.value, 0);

  if (total < 100) extracted.push({ name: 'Fold', value: 100 - total, kind: 'fold' });

  return extracted.slice(0, 3);

}





function parseCard(cardStr) {

  if (!cardStr) return null;

  const suits = { 's': 0, 'h': 1, 'd': 2, 'c': 3 };

  return { rank: RANK_VALUE[cardStr[0]], suit: suits[cardStr[1]] };

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



function calculatePreflopFallbackStrategy(r1str, r2str, isPair, isSuited, pos = 'UTG', action = 'unopened', facingSize = 0, potSize = 1.5, stack = 30) {
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
    const spr = stack > 0 ? stack / (potSize + facingSize) : 20;
    if (spr < 5) {
        // Shallow stacks - favor high cards and pairs
        if (isPair || highRank >= 10) posModifier += 0.5;
        else posModifier -= 0.3; // Speculative hands lose value
    } else if (spr > 20) {
        // Deep stacks - favor suited connectors and speculative hands
        if (isSuited && connected && lowRank >= 5) posModifier += 0.8;
        if (isPair && highRank <= 8) posModifier += 0.3; // Small pairs gain set-mining value
    }

    const commitment = stack > 0 ? facingSize / stack : 1.0;
    let actionTightness = 0.0;
    if (action === 'raise') actionTightness = Math.min(3.0, commitment * 8.0);
    else if (action === '3bet') actionTightness = Math.min(6.0, 3.0 + commitment * 10.0);
    else if (action === '4bet') actionTightness = Math.min(10.0, 6.0 + commitment * 15.0);

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

    if (facingSize > 0) {

        // Calculate Pot Odds & MDF across all positions

        const potOdds = (potSize + facingSize) > 0 ? (facingSize / (potSize + facingSize)) : 0.3;

        const mdf = (potSize + facingSize) > 0 ? (potSize / (potSize + facingSize)) : 0.7;



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

function noTreeProfile(reason, decisionContext = null) {

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

      const potOdds = potSize > 0 ? facingSize / (potSize + facingSize) : 0;

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

  return unavailableStrategyResult(
    t(reason),
    app.solver ? t('TREE UNAVAILABLE') : t('LOAD SOLVER TREE')
  );

}



function actionProfile(hand = null, decisionContext = null) {

  const strategyContext = requireDecisionContext(decisionContext);
  hand = hand === null ? handClass(strategyContext.heroCards) : hand;

  console.log('actionProfile - hero cards:', strategyContext.heroCards);

  console.log('actionProfile - handClass result:', hand);

  

  if (!hand) return noTreeProfile('Choose two hero cards to look up a hand class.', strategyContext);

  if (strategyContext.street === 'invalid') return noTreeProfile('Complete the current board street: 0, 3, 4, or 5 board cards.', strategyContext);

  // === POSTFLOP: bypass solver tree, use ONNX if available else JS heuristic ===
  if (strategyContext.street !== 'preflop') {
    const deadCards = strategyContext.deadCards;

    // TIER 1: If ONNX is loaded and has postflop support, use it
    // (ONNX model is trained on all streets; app.solver.strategy is set after load)
    if (app.useOnnx && app.onnxSession && app.solver && app.solver.strategy && window.ONNX_POSTFLOP_READY) {
      // ONNX result flows through the existing solver strategy path below
      // Fall through to the solver strategy block at the bottom of actionProfile
    } else {
      // TIER 2: JS deterministic postflop math (Monte Carlo + heuristic)
      const sim = simulateEquity(strategyContext.heroCards, strategyContext.board, deadCards, 800, strategyContext);
      const eq = sim ? sim.eq : 0.5;
      setTimeout(() => { const el = document.getElementById('mEquity'); if (el) el.textContent = (eq*100).toFixed(1)+'%'; }, 10);

      const contextObj = decisionContextToLegacyPostflopContext(strategyContext);

      const stratObj = calculateUnifiedPostflopStrategy(contextObj, strategyContext.heroCards, deadCards, strategyContext);
      const entries = Object.entries(stratObj).sort((a,b) => b[1]-a[1]);

      const a1name = entries[0] ? entries[0][0] : 'Check';
      const street = strategyContext.street;
      const rangePct = street === 'flop' ? 'Top 40%' : street === 'turn' ? 'Top 25%' : 'Top 15%';

      return postflopHeuristicToStrategyResult(stratObj, {
        recommendedLabel: t(a1name).toUpperCase(),
        explanation: `${t('Mathematical Fallback suggests')} ${(eq*100).toFixed(1)}% ${t('vs Villain')} ${t(rangePct)} ${t('range')}.`
      });
    }
  }

  const context = treeContext(strategyContext);

  if (!context.available) return noTreeProfile(context.reason, strategyContext);

  

  const heroPos = strategyContext.heroPosition;

  

  console.log('actionProfile - hand:', hand, 'heroPos:', heroPos, 'app.solver:', app.solver);

  

  if (app.solver.strategy) {

    const entry = (app.solver.strategy[hand] || {})[heroPos];

    console.log('strategy entry for hand:', hand, 'pos:', heroPos, 'entry:', entry);

    if (!entry) {

      console.log('Hand not found in strategy:', hand, 'Position:', heroPos);

      return noTreeProfile('This hand is not present in the matched solver file.', strategyContext);

    }

    // Use the ONNX/API strategy directly without converting to chart format

    const actions = [];

    for (const [key, val] of Object.entries(entry)) {

        let kind = 'unavailable';

        const name = key.toLowerCase();

        if (name.includes('fold') || name.includes('impossible')) kind = 'fold';

        else if (name.includes('call') || name.includes('check')) kind = 'passive';

        else kind = 'aggressive';

        

        actions.push({ name: key, value: val || 0, kind: kind });

    }

    actions.sort((a, b) => b.value - a.value);

    const best = actions[0];

    

    let bestFormatted = best.name.toUpperCase();

    let lastAction = strategyContext.lastAction.toLowerCase();

    

    if (bestFormatted === 'OPEN') {

      if (lastAction.includes('unopened')) {

        bestFormatted = 'OPEN 3 BB';

      } else {

        bestFormatted = 'RAISE 3x';

      }

    }

    

    const strategySource = app.solver.strategySource === STRATEGY_SOURCES.API
      ? STRATEGY_SOURCES.API
      : app.solver.strategySourceByHand && app.solver.strategySourceByHand[hand]
        ? app.solver.strategySourceByHand[hand]
        : STRATEGY_SOURCES.ONNX_MODEL;
    const modelVersion = app.solver.modelVersion || app.solver.model_version
      || (app.solver.metadata && (app.solver.metadata.modelVersion || app.solver.metadata.model_version))
      || null;

    if (strategySource === STRATEGY_SOURCES.HEURISTIC_PREFLOP) {
      return createStrategyResult({
        source: STRATEGY_SOURCES.HEURISTIC_PREFLOP,
        actions,
        recommendedLabel: bestFormatted,
        explanation: t('Preflop heuristic fallback after model inference failure'),
        warnings: ['onnx_inference_failed']
      });
    }

    return modelStrategyToStrategyResult(entry, {
      source: strategySource,
      recommendedLabel: bestFormatted,
      explanation: strategySource === STRATEGY_SOURCES.API ? t('API strategy output') : t('ONNX model strategy output'),
      modelVersion
    });

  } else {

    const entry = (app.solver.positions[heroPos] || {})[hand];

    if (!entry) return noTreeProfile('This hand is not present in the matched solver file.', strategyContext);

    const actions = parseSolverEntry(entry);

    const best = [...actions].sort((a, b) => b.value - a.value)[0];

    return localTreeToStrategyResult(actions, {
      recommendedLabel: best.name.toUpperCase(),
      explanation: t('Local solver tree') + ` · ${app.solver.title}. ` + t('Action sizing is not stored in this file.')
    });

  }

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
  const stack = context ? context.stackBb : numericValue('#stack', 100);
  const rakeMode = context?.rakeMode || selectedValue('#rakeMode');
  const rake = context ? context.legacyRakePercent : numericValue('#rakeValue');
  const accounting = context || strategyAccountingContext(rakeMode, numericValue('#players', 6), rake);

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
    } else if (lastAction === 'unopened' || !facing) {
      mPotOdds.textContent = '—';
    } else {
      mPotOdds.textContent = (facing / (pot + facing) * 100).toFixed(1) + '%';
    }
  }

  const mSPR = $('#mSPR');
  if (mSPR) mSPR.textContent = (stack / Math.max(.5, pot)).toFixed(1);

  const mRake = $('#mRake');
  if (mRake) {
    if (rakeMode === 'off') mRake.textContent = t('Off');
    else if (rakeMode === 'fixed') {
      mRake.textContent = `${accounting.forcedContributionPerPlayerBb.toFixed(1)} bb/player · ${accounting.totalForcedContributionBb.toFixed(1)} bb total`;
    } else mRake.textContent = rake + ' ' + selectedValue('#rakeUnit');
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



function renderChart() {

  const grid = $('#strategyGrid');

  if (!grid) return;

  const positions = selectedValue('#heroPos');

  const context = treeContext();

  if (grid.children.length === 0) {
    grid.innerHTML = '';
    RANKS.forEach((_, row) => RANKS.forEach((__, col) => {
      const btn = document.createElement('button');
      btn.className = 'hand-cell';
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

  const currentHeroClass = handClass(app.gto.hero);

  

  let previewHTML = '';

  

  const isPostFlop = currentStreet() !== 'preflop';

  const boardCount = app.gto.board.filter(Boolean).length;

  const useEquityFallback = !context.available && isPostFlop && boardCount >= 3;

  const currentBoard = app.gto.board.filter(Boolean);

  RANKS.forEach((_, row) => RANKS.forEach((__, column) => {

    const hand = handCode(row, column);

    

    let entry = null;

    if (context.available && app.solver) {

        if (app.solver.strategy) {

            entry = (app.solver.strategy[hand] || {})[positions];

        } else if (app.solver.positions) {

            entry = (app.solver.positions[positions] || {})[hand];

        }

    }

    

    let actions = [];

    if (entry) {

        if (app.solver.strategy) {

            // API Format

            for (const [key, val] of Object.entries(entry)) {

                let kind = 'unavailable';

                const name = key.toLowerCase();

                if (name.includes('fold') || name.includes('impossible')) kind = 'fold';

                else if (name.includes('call') || name.includes('check')) kind = 'passive';

                else kind = 'aggressive';

                actions.push({ name: key, value: val || 0, kind: kind });

            }

            actions.sort((a, b) => b.value - a.value);

        } else {

            // Local Tree Format

            actions = parseSolverEntry(entry);

        }

    } else if (isPostFlop && useEquityFallback) {

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

    } else if (!isPostFlop && !context.available) {
        // Unified preflop mathematical fallback when no solver tree is loaded
        const heroPos = positions;
        const r1str = RANKS[row], r2str = RANKS[column];
        const isPair = row === column;
        const isSuited = hand.length === 3 && hand[2] === 's';
        const facingSize = numericValue('#facingSize', 0);
        const potSize = numericValue('#potSize', 1.5);
        const stack = numericValue('#stack', 30);
        const actionEl = $('#lastAction');
        const lastAction = actionEl ? actionEl.value : 'unopened';

        const fb = calculatePreflopFallbackStrategy(
          r1str, r2str, isPair, isSuited,
          heroPos, lastAction, facingSize, potSize, stack
        );

        const openVal = Math.round(fb.open * 100);
        const callVal = Math.round(fb.call * 100);
        const foldVal = Math.round(fb.fold * 100);

        actions = [];
        if (openVal > 0) actions.push({ name: facingSize === 0 ? 'Raise' : '3-Bet', value: openVal, kind: 'aggressive' });
        if (callVal > 0) actions.push({ name: 'Call', value: callVal, kind: 'passive' });
        if (foldVal > 0) actions.push({ name: 'Fold', value: foldVal, kind: 'fold' });
        actions.sort((a, b) => b.value - a.value);

    } else if (!isPostFlop && context.available) {

        // Missing preflop hand in the solver file is implicitly folded

        actions = [{ name: 'Fold', value: 100, kind: 'fold' }];

    }

    

    const type = (actions[0] && actions[0].kind) || 'unavailable';
    const handKind = row === column ? 'pair' : hand.endsWith('s') ? 'suited' : 'offsuit';

    const detail = actions.length ? actions.map((action) => `${action.name} ${action.value}%`).join(' · ') : (useEquityFallback ? 'Blocked by Board' : context.reason);

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



    if (chartMode === 'ev') {

      const r1str = RANKS[row], r2str = RANKS[column];

      const isPair = row === column;

      const isSuited = hand.length === 3 && hand[2] === 's';

      const facingSize = numericValue('#facingSize', 0);

      const potSize = numericValue('#potSize', 1.5);

      const stack = numericValue('#stack', 30);

      const actionEl = $('#lastAction');

      const lastAction = actionEl ? actionEl.value : 'unopened';



      const fb = calculatePreflopFallbackStrategy(r1str, r2str, isPair, isSuited, positions, lastAction, facingSize, potSize, stack);

      const openPct = (actions.find(a => a.kind === 'aggressive')?.value || (fb.open * 100)) / 100;

      const callPct = (actions.find(a => a.kind === 'passive')?.value || (fb.call * 100)) / 100;

      

      const score = Math.max(RANK_VALUE[r1str] || 0, RANK_VALUE[r2str] || 0) + (isPair ? 6 : 0) + (isSuited ? 1.5 : 0);

      const estEV = Math.max(0, (score - 4.0) * 0.22 * potSize * (openPct * 1.2 + callPct * 0.8));

      cellSubtext = `+${estEV.toFixed(1)}bb`;

      const intensity = Math.min(1.0, estEV / 3.5);

      cellBg = `color-mix(in srgb, var(--ev-positive) ${(15 + intensity * 75).toFixed(1)}%, transparent)`;

    } else if (chartMode === 'equity') {

      const r1str = RANKS[row], r2str = RANKS[column];

      const isPair = row === column;

      const isSuited = hand.length === 3 && hand[2] === 's';

      const score = Math.max(RANK_VALUE[r1str] || 0, RANK_VALUE[r2str] || 0) + (isPair ? 8 : 0) + (isSuited ? 2 : 0);

      const estEq = Math.min(88, Math.max(25, Math.round(30 + score * 2.8)));

      cellSubtext = `${estEq}%`;

      const intensity = (estEq - 25) / 63;

      cellBg = `color-mix(in srgb, var(--equity-primary) ${(15 + intensity * 75).toFixed(1)}%, transparent)`;

    } else if (chartMode === 'raise') {

      const val = Math.round(actions.find(a => a.kind === 'aggressive')?.value || 0);

      cellSubtext = `${val}%`;

      cellBg = `color-mix(in srgb, var(--action-aggressive) ${val}%, transparent)`;

    } else if (chartMode === 'call') {

      const val = Math.round(actions.find(a => a.kind === 'passive')?.value || 0);

      cellSubtext = `${val}%`;

      cellBg = `color-mix(in srgb, var(--action-passive) ${val}%, transparent)`;

    } else if (chartMode === 'fold') {

      const val = Math.round(actions.find(a => a.kind === 'fold')?.value || 0);

      cellSubtext = `${val}%`;

      cellBg = `color-mix(in srgb, var(--action-fold) ${val}%, transparent)`;

    }



    if (cellSubtext) {

      button.innerHTML = `<span class="matrix-hand-label">${hand}</span><div class="matrix-cell-subtext">${cellSubtext}</div>`;

    } else {

      button.innerHTML = `<span class="matrix-hand-label">${hand}</span>`;

    }



    button.dataset.hand = hand;

    button.setAttribute('aria-label', hand + ': ' + detail);



    if (cellBg) {

      button.style.background = cellBg;

    } else if (actions.length > 0) {
      button.insertAdjacentHTML('beforeend', `<span class="matrix-mix-bar" aria-hidden="true">${actions.map((action) => `<i data-action-kind="${visualActionKind(action)}" style="width:${action.value}%"></i>`).join('')}</span>`);
    }



    if (isSelected && actions.length > 0) {

        previewHTML = `<strong class="matrix-preview-hand">${hand}</strong> ` + actions.map(a => `<span class="matrix-preview-action" data-action-kind="${visualActionKind(a)}">${a.name.toUpperCase()} ${(a.value % 1 === 0 ? a.value : Number(a.value).toFixed(1))}%</span>`).join(' · ');

        $('#selectedHand').textContent = hand;

        $('#selectedMix').innerHTML = `<span>${detail}</span><div class="alloc" role="img" aria-label="${detail}">${actions.map((action) => `<i data-action-kind="${visualActionKind(action)}" style="width:${action.value}%"></i>`).join('')}</div>`;

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



  const stackTag = (app.solver && app.solver.stack) ? app.solver.stack + 'bb tree' : t('no tree');

  if (useEquityFallback) {

      $('#chartSummary').textContent = `${positions} · ${numericValue('#stack')} bb · Postflop Monte Carlo Equity Fallback`;

  } else {

      $('#chartSummary').textContent = `${positions} · ${numericValue('#stack')} bb · ${stackTag} · ${context.available ? t('matched') : context.reason}`;

  }

}




function setStrategySourceStatus(state, label) {
  const control = $('#connectApiBtn');
  const dot = $('#apiStatusDot');
  const text = $('#apiStatusText');
  if (!control || !dot || !text) return;

  control.dataset.status = state;
  control.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
  control.setAttribute('aria-label', `${t('Strategy source')}: ${t(label)}`);
  dot.style.background = '';
  text.textContent = t(label);
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
    local_tree: 'Local tree',
    onnx_model: 'ONNX model',
    api: 'API',
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

function renderLoadingStrategy() {
  setRecommendationState('loading');
  if ($('#bestAction')) $('#bestAction').textContent = 'Loading strategy';
  if ($('#bestReason')) $('#bestReason').textContent = 'Checking the selected strategy source.';
  if ($('#bestSizing')) $('#bestSizing').hidden = true;
  if ($('#strategyMeta')) {
    $('#strategyMeta').textContent = '';
    $('#strategyMeta').hidden = true;
  }
  if ($('#strategyWarnings')) {
    $('#strategyWarnings').textContent = '';
    $('#strategyWarnings').hidden = true;
  }
  if ($('#sourceBadge')) {
    $('#sourceBadge').textContent = 'Loading';
    $('#sourceBadge').className = 'badge status-badge status-badge--loading';
  }
  const emptyActions = Array.from({ length: 3 }, () => ({ name: '—', value: 0, kind: 'unavailable' }));
  emptyActions.forEach((action, index) => setFrequency(index + 1, action));
  renderFrequencyStack($('#actionFrequencyStack'), emptyActions);
  if ($('#actionWheel')) $('#actionWheel').style.background = 'var(--surface-interactive)';
  if ($('#wheelCenterText')) $('#wheelCenterText').textContent = '—';
}

function setApiStatus(status) {

  if (status === 'connected') {
    setStrategySourceStatus('available', 'API strategy available');

  } else if (status === 'querying') {
    setStrategySourceStatus('loading', 'Loading strategy source');

  } else if (status === 'error' || status === 'offline') {
    setStrategySourceStatus('unavailable', 'Source unavailable · heuristic');

  }

}



async function fetchWithTimeout(resource, options = {}) {

  const { timeout = 8000 } = options;

  const controller = new AbortController();

  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {

    ...options,

    signal: controller.signal  

  });

  clearTimeout(id);

  return response;

}



async function pollTrainingStatus() {
  // Training status polling removed - training no longer needed
  return;
}



async function updateContext(reason = 'Context updated') {

  syncSliderPair('players', 'playersNum');

  syncSliderPair('stack', 'stackNum');

  syncSliderPair('rakeValue', 'rakeValueNum');
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
  const legacyStrategyContext = decisionContextToLegacyStrategyContext(decisionContext);
  app.decisionContext = decisionContext;
  if (playbookResolution.mode === 'scenario') {
    try {
      globalThis.RiverlineCanonicalDev?.compare?.();
    } catch (error) {
      // Shadow diagnostics are non-authoritative and must never interrupt Playbook.
    }
  }

  if (playbookResolution.mode === 'hand' && typeof syncCanonicalDecisionDisplay === 'function') {
    syncCanonicalDecisionDisplay(decisionContext);
  }
  if (typeof renderPlaybookModeStatus === 'function') renderPlaybookModeStatus(playbookResolution);
  
  if (decisionContext.street === 'preflop' && decisionContext.lastAction === 'unopened') {
    if ($('#facingSize')) $('#facingSize').value = decisionContext.facingSizeBb;
    if ($('#facingSizeNum')) $('#facingSizeNum').value = decisionContext.facingSizeBb;
  }
  
  // Try ONNX first if available
  if (app.useOnnx && app.onnxSession) {
     if (typeof renderLoadingStrategy === 'function') renderLoadingStrategy();
     const apiContext = legacyStrategyContext;

     const contextKey = JSON.stringify(apiContext);

     

     if (contextKey !== app.lastApiContext) {

       try {

         const liveContextText = $('#liveContextText');

         if (liveContextText) liveContextText.textContent = 'Local · computing...';

         

         const data = await generateStrategyWithOnnx(apiContext);

         console.log('ONNX Response:', data);

         app.solver = { ...data, strategySource: STRATEGY_SOURCES.ONNX_MODEL };

         app.cachedStrategy = data.strategy;

         app.lastApiContext = contextKey;

         

         if (liveContextText) liveContextText.textContent = 'Local · ONNX';

       } catch (err) {

         console.error("ONNX Error:", err);

         app.useOnnx = false;

         // Show user-friendly error message
         const liveContextText = $('#liveContextText');
         if (liveContextText) {
           liveContextText.textContent = 'Local · JS Fallback';
           liveContextText.style.color = 'var(--orange)';
         }

         // Fallback to JS math
         console.log("Falling back to enhanced JS math system");

       }

     } else {

       if (app.cachedStrategy) {

         app.solver = { ...app.solver, strategy: app.cachedStrategy };

       }

     }

  } else if (app.useApi) {
     if (typeof renderLoadingStrategy === 'function') renderLoadingStrategy();
     // Fallback to API if ONNX not available
     const apiContext = legacyStrategyContext;

     const contextKey = JSON.stringify(apiContext);

    

     if (contextKey !== app.lastApiContext) {

       try {

         const liveContextText = $('#liveContextText');

         if (liveContextText) liveContextText.textContent = 'Live · querying AI...';

         setApiStatus('querying');

        

         const res = await fetchWithTimeout('http://127.0.0.1:5000/solve_all', {

           method: 'POST',

           headers: { 'Content-Type': 'application/json' },

           timeout: 5000,

           body: JSON.stringify(apiContext)

         });

         if (res.ok) {

           const data = await res.json();

           console.log('API Response:', data);

           app.solver = { ...data, strategySource: STRATEGY_SOURCES.API };

           app.cachedStrategy = data.strategy;

           app.lastApiContext = contextKey;

           setApiStatus('connected');

         }

       } catch (err) {

         console.error("API Error", err);

         setApiStatus('error');

         app.useApi = false;

       }

     } else {

       if (app.cachedStrategy) {

         app.solver = { ...app.solver, strategy: app.cachedStrategy };

       }

     }

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

  

  if (typeof generateTeacherText === 'function') {

    const teacherContent = $('#teacherContent');

    if (teacherContent) {

      teacherContent.innerHTML = generateTeacherText(profile);

      if (typeof updateDomTranslations === 'function') updateDomTranslations();

    }

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
    const sourceTone = strategyResult.source.startsWith('heuristic_') ? 'heuristic'
      : strategyResult.source === 'local_tree' ? 'experimental'
      : strategyResult.source === 'onnx_model' || strategyResult.source === 'api' ? 'available'
      : 'info';
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

// ONNX Runtime Web Integration

// ---------------------------------------------------------------------------



async function loadOnnxModel() {

  try {

    console.log('Loading ONNX model...');

    

    // Update status to loading

    setStrategySourceStatus('loading', 'Loading model');

    

    if (typeof ort === 'undefined') {

      console.error('ONNX Runtime not loaded - ort is undefined');

      toast('ONNX Runtime library not loaded', 'error');

      setStrategySourceStatus('unavailable', 'Model unavailable · heuristic');

      return false;

    }

    

    console.log('ORT available, configuring WASM backend...');

    

    // Configure ONNX Runtime for single-threaded mode (no cross-origin isolation)

    ort.env.wasm.numThreads = 1;  // Single thread to avoid cross-origin issues
    ort.env.wasm.wasmPaths = './';

    

    console.log('Attempting to load embedded ONNX model...');

    

    // Try loading embedded model first (no external data files)

    const modelPaths = [
    'model.onnx',
    '/model.onnx',
    'solver-model/model_embedded.onnx',
  ]

    

    for (const modelPath of modelPaths) {

      try {

        console.log(`Trying to load model from: ${modelPath}`);

        const response = await fetch(modelPath);

        if (!response.ok) throw new Error(`Model file not found at ${modelPath}`);

        const arrayBuffer = await response.arrayBuffer();

        const session = await ort.InferenceSession.create(arrayBuffer);

        app.onnxSession = session;

        app.useOnnx = true;

        console.log(`ONNX model loaded successfully from ${modelPath}`);

        toast('ONNX model loaded successfully', 'success');

        

        // Update status to connected

        setStrategySourceStatus('available', 'ONNX model');

        

        return true;

      } catch (fetchError) {

        console.log(`Failed to load from ${modelPath}:`, fetchError.message);

        continue;

      }

    }

    

    throw new Error('All model paths failed');

  } catch (err) {

    console.error('Failed to load ONNX model:', err);

    toast('Failed to load ONNX: ' + err.message, 'error');

    app.useOnnx = false;

    

    // Update status to offline

    setStrategySourceStatus('unavailable', 'Model unavailable · heuristic');

    

    return false;

  }

}



function encodeCardsForOnnx(cards, tensor) {

  // Card encoding: 52 one-hot features (13 ranks * 4 suits)

  const RANKS = '23456789TJQKA';

  const SUITS = ['s', 'h', 'd', 'c'];

  

  for (const card of cards) {

    if (!card || card.length < 2) continue;

    const rank = card[0];

    const suit = card[1];

    const rankIdx = RANKS.indexOf(rank);

    const suitIdx = SUITS.indexOf(suit);

    

    if (rankIdx >= 0 && suitIdx >= 0) {

      const idx = rankIdx * 4 + suitIdx;

      tensor[idx] = 1.0;

    }

  }

}



async function runOnnxInference(inputs) {
  if (!app.useOnnx) return null;

  try {
    const street = currentStreet() || 'flop';
    const session = await window.onnxLazyLoader.getSession(street, 'student');
    const inputTensor = new ort.Tensor('float32', new Float32Array(inputs), [1, 121]);
    const outputs = await session.run({ input: inputTensor });
    return outputs.output.data;
  } catch (err) {

    console.error('ONNX inference error:', err);

    return null;

  }

}



async function computeVillainPriorWithPreflopONNX(context) {
    let session;
    try {
        session = await window.onnxLazyLoader.getSession('preflop', 'student');
    } catch(e) {
        return []; // fail gracefully if preflop model isn't available
    }
    const RANKS = '23456789TJQKA';
    const weights = [];
    const dummyInputs = new Float32Array(121);
    
    for (let i = 0; i < 13; i++) {
        for (let j = 0; j < 13; j++) {
            const r1 = RANKS[i], r2 = RANKS[j];
            let hand = i===j ? r1+r2 : (i>j ? r1+r2+'o' : r2+r1+'s');
            
            const inputTensor = new ort.Tensor('float32', dummyInputs, [1, 121]);
            const posTensor = new ort.Tensor('int64', BigInt64Array.from([1n]), [1]); // villain dummy pos
            try {
                // Try different input combinations similar to logic.js main flow
                let out;
                try {
                    out = await session.run({ state_features: inputTensor, relative_pos: posTensor });
                } catch(e) {
                    out = await session.run({ input: inputTensor });
                }
                const p = out.policy ? out.policy.data : out.output.data;
                const playProb = 1.0 - p[0]; // Assuming index 0 is fold
                weights.push({ hand, weight: Math.max(0.01, playProb) });
            } catch (e) {
                weights.push({ hand, weight: 1.0 }); // Uniform prior if failure
            }
        }
    }
    return weights;
}

function getEquityWithWorker(heroHandStr, board, iterations, villainWeights) {
    return new Promise((resolve) => {
        const worker = new Worker('equity.worker.js');
        worker.onmessage = (e) => {
            if (e.data.type === 'EQUITY_RESULT') {
                resolve(e.data.payload.heroEquity / 100.0);
                worker.terminate();
            }
        };
        const heroHand = [
            heroHandStr[0] + (heroHandStr.length === 3 && heroHandStr[2] === 's' ? 's' : 's'), 
            heroHandStr[1] + (heroHandStr.length === 3 && heroHandStr[2] === 's' ? 's' : 'h')
        ];
        worker.postMessage({
            type: 'SIMULATE_EQUITY',
            heroHand: heroHand,
            board: board || [],
            iterations: iterations,
            villainWeights: villainWeights
        });
    });
}

let onnxAbortController = null;

async function generateStrategyWithOnnx(context) {
  if (onnxAbortController) {
    onnxAbortController.abort();
  }
  onnxAbortController = new AbortController();
  const signal = onnxAbortController.signal;
  
  try {
  const street = currentStreet(context.board) || 'flop';
  const session = await window.onnxLazyLoader.getSession(street, 'student');

  const RANKS = '23456789TJQKA';
  const ACTIONS = ['unopened', 'raise', '3bet', '4bet', 'bet', 'check'];

  const posIdx = modelPositionIndex(context.hero_pos);
  const rawAct = ACTIONS.indexOf(context.lastAction);
  const actionIdx = rawAct !== -1 ? rawAct : 0;

  const strategyMap = {};
  const strategySourceByHand = {};
  const handOrder = [];
  const batchInputs = new Float32Array(169 * 121);
  let handCount = 0;

  // Encode all 169 hand combinations into a single batch buffer for zero-lag 1-pass ONNX inference
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const r1 = RANKS[i], r2 = RANKS[j];
      let hand, hole;

      if (i === j) {
        hand = r1 + r2;
        hole = [r1 + 's', r2 + 'h'];
      } else if (i > j) {
        hand = r1 + r2 + 'o';
        hole = [r1 + 's', r2 + 'h'];
      } else {
        hand = r2 + r1 + 's';
        hole = [r2 + 's', r1 + 's'];
      }

      // Check board conflict
      const conflict = context.board && context.board.some(c => hole.includes(c));
      if (conflict) {
        strategyMap[hand] = { [context.hero_pos]: { "impossible": 100 } };
        continue;
      }

      handOrder.push(hand);
      const offset = handCount * 121;
      handCount++;

      // Encode single hand features (121 dimensions)
      // Model.onnx feature x[56] was trained with 0.0 for unopened preflop spots.
      const inputFacing = normalizeFacingSize(context.lastAction, context.facingSize);
      batchInputs[offset + 52] = context.table_size / 9.0;
      batchInputs[offset + 53] = context.stack / 200.0;
      batchInputs[offset + 54] = context.rake / 10.0;
      batchInputs[offset + 55] = Math.min(1.0, context.potSize / 200.0);
      batchInputs[offset + 56] = Math.min(1.0, inputFacing / 200.0);
      batchInputs[offset + 57 + posIdx] = 1.0;
      batchInputs[offset + 63 + actionIdx] = 1.0;

      // Encode cards
      for (const card of hole) {
        const rankIdx = RANKS.indexOf(card[0]);
        const suitIdx = ['s', 'h', 'd', 'c'].indexOf(card[1]);
        if (rankIdx >= 0 && suitIdx >= 0) {
          batchInputs[offset + rankIdx * 4 + suitIdx] = 1.0;
        }
      }
      // Encode board cards
      if (context.board) {
        for (const card of context.board) {
          if (!card) continue;
          const rankIdx = RANKS.indexOf(card[0]);
          const suitIdx = ['s', 'h', 'd', 'c'].indexOf(card[1]);
          if (rankIdx >= 0 && suitIdx >= 0) {
            batchInputs[offset + 69 + rankIdx * 4 + suitIdx] = 1.0;
          }
        }
      }

    }
  }

  // Process each hand individually due to WASM static batch shape limitations
  for (let idx = 0; idx < handOrder.length; idx++) {
    if (idx % 20 === 0) await new Promise(r => requestAnimationFrame(r));
    const hand = handOrder[idx];
    try {
      const subBuffer = batchInputs.subarray(idx * 121, (idx + 1) * 121);
      const inputTensor = new ort.Tensor('float32', subBuffer, [1, 121]);
      
      // Create position tensor as required by the model
      const posTensor = new ort.Tensor('int64', BigInt64Array.from([BigInt(posIdx)]), [1]);
      
      // Try different input combinations for compatibility
      let output;
      try {
        // Try combined single input first
        output = await session.run({ input: inputTensor });
      } catch (inputErr) {
        try {
          // Try separate state_features and relative_position inputs
          output = await session.run({ 
            state_features: inputTensor,
            relative_pos: posTensor
          });
        } catch (altErr) {
          // Try just state_features alone
          try {
            output = await session.run({ state_features: inputTensor });
          } catch (stateErr) {
            throw new Error(`All input combinations failed: ${inputErr.message}, ${altErr.message}, ${stateErr.message}`);
          }
        }
      }
      
      const p = output.policy ? output.policy.data : output.output.data;
      
      // Calculate Entropy of ONNX policy output (Confidence Metric)
      let entropy = 0;
      for (let i = 0; i < p.length; i++) {
        if (p[i] > 0) entropy -= p[i] * Math.log2(p[i]);
      }
      
      // Flat if entropy is close to max. For 5 actions, max is ~2.32
      const isFlat = entropy > 2.2;
      const isPotCommitted = (context.stack / Math.max(context.potSize, 1)) < 1.5;
      
      let actions;
      if (isFlat || isPotCommitted) {
        // Bypass ML and use Fallback Math Engine with NN-Weighted Monte Carlo
        if (!context.villainWeightsCache) {
          // Mocking the query to preflop prior distribution
          context.villainWeightsCache = await computeVillainPriorWithPreflopONNX(context);
        }
        
        // Wait for equity simulation from worker
        const equity = await getEquityWithWorker(hand, context.board, 2000, context.villainWeightsCache);
        
        // Pot Commitment Thresholds
        if (isPotCommitted && equity > 0.65) {
          actions = { "raise": 100 }; // Default to high-frequency All-In push
        } else {
          // Standard heuristic math fallback
          actions = applyHeuristicToPrediction(p, context, posIdx, actionIdx, hand);
          // (Can apply equity mathematically to adjust actions, but heuristic works for now)
        }
      } else {
        actions = applyHeuristicToPrediction(p, context, posIdx, actionIdx, hand);
      }
      
      strategyMap[hand] = { [context.hero_pos]: actions };
    } catch (innerErr) {
      console.error(`ONNX Inference Error for hand ${hand}:`, innerErr);
      // Ultimate Failsafe: If even individual ONNX inference fails, use JS math
      let fbActions = { "fold": 100 };
      if (!context.board || context.board.length === 0) {
        const r1 = hand[0];
        const r2 = hand[1];
        const isSuited = hand.length === 3 && hand[2] === 's';
        const isPair = r1 === r2;
        const facingSize = normalizeFacingSize(context.lastAction, context.facingSize);
        const fb = calculatePreflopFallbackStrategy(r1, r2, isPair, isSuited, [context.hero_pos], context.lastAction, facingSize, context.potSize || 1.5, context.stack || 30);
        if (fb && fb[context.hero_pos]) {
          fbActions = fb[context.hero_pos];
        }
      }
      strategyMap[hand] = { [context.hero_pos]: fbActions };
      strategySourceByHand[hand] = STRATEGY_SOURCES.HEURISTIC_PREFLOP;
    }
  }

  return {
    title: "Local ONNX Strategy",
    positions: [context.hero_pos],
    strategy: strategyMap,
    strategySource: STRATEGY_SOURCES.ONNX_MODEL,
    strategySourceByHand
  };
  } finally {
    // We don't reset the controller here because a new one might have been created
  }
}

function getHandTier(hand) {
  if (!hand) return 5;
  const rank1 = hand[0];
  const rank2 = hand[1];
  const suited = hand.length === 3 && hand[2] === 's';
  const pair = rank1 === rank2;

  const R = '23456789TJQKA';
  const v1 = R.indexOf(rank1);
  const v2 = R.indexOf(rank2);

  // Tier 1: Monster (AA-TT, AKs, AKo, AQs)
  if (pair && v1 >= 8) return 1;
  if (hand === 'AKs' || hand === 'AKo' || hand === 'AQs') return 1;

  // Tier 2: Strong (99-77, AQo, AJs, AJo, ATs, KQs, KQo, KJs)
  if (pair && v1 >= 5) return 2;
  if (hand === 'AQo' || hand === 'AJs' || hand === 'AJo' || hand === 'ATs' || hand === 'KQs' || hand === 'KQo' || hand === 'KJs') return 2;

  // Tier 3: Medium (66-22, ATo, KTs, QJs, QTs, JTs, 98s, 87s)
  if (pair) return 3;
  if (v1 >= 9 && v2 >= 8) return 3;
  if (suited && Math.abs(v1 - v2) === 1 && v2 >= 3) return 3;

  // Tier 4: Speculative
  if (suited && (v1 >= 8 || v2 >= 8)) return 4;
  return 5;
}

function applyHeuristicToPrediction(p, context, posIdx, actionIdx, hand) {
  // Model output vector:
  // p[0]: Open / Raise, p[1]: Call, p[2]: Fold, p[3]: Check, p[4]: Jam / All-In
  const raiseVal = (p[0] || 0) + (p[4] || 0);
  const passiveVal = (p[1] || 0) + (p[3] || 0);
  const foldVal = p[2] || 0;

  const total = raiseVal + passiveVal + foldVal || 1.0;

  let openPct = Math.round((raiseVal / total) * 100);
  let callPct = Math.round((passiveVal / total) * 100);
  let foldPct = 100 - openPct - callPct;

    // Incorporate Playstyle (Tightness) Slider extrapolation
    const L = (typeof app !== "undefined" && app.settings && app.settings.tightness !== undefined) ? app.settings.tightness / 100.0 : 0.0;
    if (L > 0 && foldPct > 0) {
      // Extrapolate outputs for "loose" playstyles by converting folds to calls/raises
      const foldReduction = foldPct * (0.4 * L); // Max 40% reduction of folds
      foldPct -= foldReduction;
      callPct += foldReduction * 0.75; // Most goes to passive calling (typical loose behavior)
      openPct += foldReduction * 0.25; 
    }

    // Incorporate Opponent Playstyle (Tightness) Slider extrapolation (Exploitative Adjustments)
    const oppL = (typeof app !== "undefined" && app.settings && app.settings.oppTightness !== undefined) ? app.settings.oppTightness / 100.0 : 0.0;
    if (oppL > 0 && hand) {
      const tier = getHandTier(hand);
      if (tier <= 2) {
        // Value hands: Exploit loose opponents by raising more, calling less.
        const callShift = callPct * (0.3 * oppL);
        callPct -= callShift;
        openPct += callShift;
      } else if (tier >= 4) {
        // Bluffs / Trash: Exploit loose opponents by bluffing less (folding more).
        const bluffReduction = openPct * (0.5 * oppL);
        openPct -= bluffReduction;
        foldPct += bluffReduction;
      }
    }

    openPct = Math.round(openPct);
    callPct = Math.round(callPct);
    foldPct = 100 - openPct - callPct;

  // GTO Monotonicity & Rationality Guard
  if (hand) {
    const tier = getHandTier(hand);
    const pot = context.potSize || 1.5;
    const facing = context.facingSize || 0;
    const potOdds = facing > 0 ? (facing / (pot + facing)) : 0;

    // Never fold when facing 0bb (you can check and stay in the game for free)
    if (facing === 0) {
      if (foldPct > 0) {
        callPct += foldPct;
        foldPct = 0;
      }
    }

    if (tier === 1) { // Monster hands: AA, KK, QQ, JJ, TT, AKs, AKo, AQs
      // Tier 1 hands MUST NEVER fold preflop unopened or in standard pots!
      foldPct = 0;
      openPct = Math.max(85, openPct);
      callPct = 100 - openPct;
    } else if (tier <= 2 && facing > 0 && potOdds <= 0.44) {
      const maxFold = 15;
      if (foldPct > maxFold) {
        const excessFold = foldPct - maxFold;
        foldPct = maxFold;
        const continueSum = openPct + callPct || 1;
        openPct += Math.round(excessFold * (openPct / continueSum));
        callPct = 100 - openPct - foldPct;
      }
    } else if (tier <= 2 && facing === 0) { // Unopened RFI
      const maxFold = 0; // facing 0bb means checking is free, handled above, but just in case
      if (foldPct > maxFold) {
        const excessFold = foldPct - maxFold;
        foldPct = maxFold;
        openPct += excessFold;
      }
    }
  }

  return {
    "open": Math.max(0, openPct),
    "call": Math.max(0, callPct),
    "fold": Math.max(0, foldPct)
  };
}



// ---------------------------------------------------------------------------

// Correct Hold'em evaluator and equity calculation

// ---------------------------------------------------------------------------



function combinations(items, size) {

  const output = [];

  const choose = (start, chosen) => {

    if (chosen.length === size) {

      output.push([...chosen]);

      return;

    }

    for (let index = start; index <= items.length - (size - chosen.length); index += 1) {

      chosen.push(items[index]);

      choose(index + 1, chosen);

      chosen.pop();

    }

  };

  choose(0, []);

  return output;

}



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



function shuffled(cards) {

  const result = [...cards];

  for (let index = result.length - 1; index > 0; index -= 1) {

    const picked = Math.floor(Math.random() * (index + 1));

    [result[index], result[picked]] = [result[picked], result[index]];

  }

  return result;

}



function calculateEquity() {

  const players = app.equity.players;

  const deck = allDeck().filter((card) => !new Set(usedCards('equity')).has(card));

  const blankHoleCards = players.reduce((sum, player) => sum + Math.max(0, 2 - player.cards.filter(Boolean).length), 0);

  const missingBoard = 5 - app.equity.board.filter(Boolean).length;

  const needed = blankHoleCards + missingBoard;

  if (deck.length < needed) return toast('Not enough cards remain in the deck.', 'warning');



  const requestedMethod = selectedValue('#calcStyle');

  const exact = requestedMethod !== 'sim' && blankHoleCards === 0 && missingBoard <= 2;

  const deals = exact

    ? (needed === 0 ? [[]] : needed === 1 ? deck.map((card) => [card]) : combinations(deck, 2))

    : Array.from({ length: numericValue('#trials', 10000) }, () => shuffled(deck).slice(0, needed));



  const wins = players.map(() => 0);

  const ties = players.map(() => 0);

  const equityShares = players.map(() => 0);

  let splitPotRunouts = 0;

  
  // Refactored to prevent main thread spin-lock and UI freezing
  // using an asynchronous chunked loop
  let i = 0;
  const CHUNK_SIZE = 500;
  
  function processChunk() {
      const end = Math.min(i + CHUNK_SIZE, deals.length);
      for (; i < end; i++) {
        let deal = deals[i];
        let dealIndex = 0;
        const hands = players.map((player) => {
          const cards = player.cards.filter(Boolean).slice();
          while (cards.length < 2) cards.push(deal[dealIndex++]);
          return cards;
        });
        const board = app.equity.board.filter(Boolean).slice();
        while (board.length < 5) board.push(deal[dealIndex++]);
        const scores = hands.map((hand) => scoreSeven([...hand, ...board]));
        const best = Math.max(...scores);
        const winners = scores.map((score, index) => score === best ? index : -1).filter((index) => index >= 0);
        if (winners.length === 1) {
          wins[winners[0]] += 1;
          equityShares[winners[0]] += 1;
        } else {
          splitPotRunouts += 1;
          winners.forEach((index) => {
            ties[index] += 1;
            equityShares[index] += 1 / winners.length;
          });
        }
      }
      
      if (i < deals.length) {
          requestAnimationFrame(processChunk);
      } else {
          const total = deals.length;
          const result = players.map((player, index) => ({
            name: player.name,
            win: wins[index] / total * 100,
            tie: ties[index] / total * 100,
            equity: equityShares[index] / total * 100
          }));
          renderEquityResult(result, exact, total, splitPotRunouts / total * 100);
      }
  }
  
  requestAnimationFrame(processChunk);
  return; // Early return, renderEquityResult is called asynchronously now





}



function renderEquityResult(result, exact, total, splitRate) {

  $('#headlineEquity').textContent = result[0].equity.toFixed(1) + '%';

  $('#equityStatus').textContent = `${exact ? 'Exact enumeration' : 'Monte Carlo'} · ${total.toLocaleString()} conditional runouts · ${remainingCards('equity')} cards available`;

  $('#methodBadge').textContent = exact ? 'EXACT' : 'SIMULATED';

  $('#equityBars').innerHTML = result.map((player, index) => `

    <div class="equity-row" data-player-series="${index % 8}">
      <span class="equity-player-label"><i class="series-marker" aria-hidden="true"></i><span>${player.name}<small>Win ${player.win.toFixed(1)}% · Tie ${player.tie.toFixed(1)}%</small></span></span>
      <div class="eqbar" role="progressbar" aria-label="${player.name} equity" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${player.equity.toFixed(1)}"><div class="eqfill player-series" style="width:${player.equity}%"></div></div>
      <b>${player.equity.toFixed(1)}%</b>
    </div>

  `).join('') + `<div class="equity-row equity-row--tie"><span class="equity-player-label"><i class="series-marker" aria-hidden="true"></i><span>Split pots</span></span><div class="eqbar" role="progressbar" aria-label="Split pots" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${splitRate.toFixed(1)}"><div class="eqfill tie" style="width:${splitRate}%"></div></div><b>${splitRate.toFixed(1)}%</b></div>`;

  toast('Win probability updated', 'success');

  // === OUTS CALCULATION (per-player, shown inline beside each player's cards) ===
  // Available on Flop (3 cards) or Turn (4 cards) when both player hands are known
    (function renderAllOuts() {
    const board = app.equity.board.filter(Boolean);
    const deadCards = app.equity.dead || [];
    const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };
    const suitColors  = { s: '#94a3b8', h: '#f87171', d: '#fb923c', c: '#4ade80' };

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

      panel.style.display = 'block';

      if (outsResult.ahead) {
        if (countEl) { countEl.textContent = 'Ahead'; countEl.style.background = 'rgba(74,222,128,0.15)'; countEl.style.color = '#4ade80'; }
        if (summEl)  summEl.textContent = 'Currently winning — no outs needed.';
        if (cardsEl) cardsEl.innerHTML = '';
      } else if (outsResult.count === 0) {
        if (countEl) { countEl.textContent = 'Drawing Dead'; countEl.style.background = 'rgba(248,113,113,0.15)'; countEl.style.color = '#f87171'; }
        if (summEl)  summEl.textContent = 'No outs — drawing dead.';
        if (cardsEl) cardsEl.innerHTML = '';
      } else {
        if (countEl) { countEl.textContent = outsResult.count + ' outs'; countEl.style.background = 'rgba(56,189,248,0.15)'; countEl.style.color = 'var(--accent,#38bdf8)'; }
        if (summEl)  summEl.innerHTML = ''; // We will put categories in cardsEl directly for a cleaner layout
        if (cardsEl) {
          let html = '';
          outsResult.categories.forEach(cat => {
            html += `<div style="width:100%; margin-bottom: 6px;">`;
            html += `<div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">${cat.name} (${cat.cards.length} outs)</div>`;
            html += `<div style="display:flex; flex-wrap:wrap; gap:3px;">`;
            html += cat.cards.map(card => {
              const rank = card[0], suit = card[1];
              const color = suitColors[suit] || '#fff';
              return `<span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:42px;border-radius:5px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);font-size:0.78rem;font-weight:700;color:${color};cursor:default;">${rank}${suitSymbols[suit]||suit}</span>`;
            }).join('');
            html += `</div></div>`;
          });
          cardsEl.innerHTML = html;
        }
      }
    });
  })();

}



function setEquityPending() {

  $('#equityStatus').textContent = 'Inputs changed. Calculate to refresh the result.';

  $('#methodBadge').textContent = 'READY';

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

    if (window.SoundFX) SoundFX.playChip();

    callback();

  });

  number.addEventListener('input', () => {

    syncSliderPair(rangeId, numberId);

    if (window.SoundFX) SoundFX.playChip();

    callback();

  });

}



function loadSolverFile(file) {

  const reader = new FileReader();

  reader.onload = () => {

    try {

      app.solver = normalizeTree(JSON.parse(reader.result), file.name);

      if (app.solver.stack) {

        $('#stack').value = app.solver.stack;

        $('#stackNum').value = app.solver.stack;

      }

      $('#sourceBadge').textContent = 'LOCAL TREE';

      toast(`Loaded ${app.solver.title}`, 'success');

      updateContext('Solver tree loaded');

    } catch (error) {

      app.solver = null;

      toast(error.message || 'Could not parse solver JSON.', 'error');

      updateContext('Solver import failed');

    }

  };

  reader.readAsText(file);

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

    const slot = event.target.closest('.card-slot');

    if (slot) {

      const group = slot.dataset.group;

      if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
        return toast('These cards come from the canonical hand in Hand mode.', 'warning');
      }

      const index = Number(slot.dataset.index);

      const current = groupCards(group)[index];

      if (current) {

        groupCards(group)[index] = null;

        if (group === 'hero') notifyCanonicalHeroCardsChanged();
        if (group === 'board') notifyCanonicalBoardCardsChanged();

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

      app.equity.players.splice(Number(removePlayer.dataset.removePlayer), 1);

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



  bindSliderPair('players', 'playersNum', () => {
    updatePositions();
    notifyCanonicalConfigurationChanged();
    updateContext('Table size changed');
  });

  bindSliderPair('stack', 'stackNum', () => {
    notifyCanonicalConfigurationChanged();
    updateContext('Stack changed');
  });

  bindSliderPair('rakeValue', 'rakeValueNum', () => updateContext('Rake changed'));

  bindSliderPair('ante', 'anteNum', () => {
    notifyCanonicalConfigurationChanged();
    updateContext('Ante changed');
  });

  bindSliderPair('facingSize', 'facingSizeNum', () => updateContext('Sizing changed'));

  bindSliderPair('potSize', 'potSizeNum', () => updateContext('Sizing changed'));

  ['rakeMode', 'stackMode', 'heroPos', 'straddle'].forEach((id) => {

    if ($('#' + id)) $('#' + id).addEventListener('change', () => {
      notifyCanonicalConfigurationChanged();
      updateContext('Configuration changed');
    });

  });

  ['rakeUnit', 'lastAction'].forEach((id) => {

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

  if ($('#rakePot')) $('#rakePot').addEventListener('click', () => {

    $('#rakePot').classList.toggle('on');

    $('#rakePot').setAttribute('aria-pressed', $('#rakePot').classList.contains('on'));

    updateContext('Rake setting changed');

  });

  if ($('#toggleAdvanced')) $('#toggleAdvanced').addEventListener('click', () => {

    const enabled = $('#toggleAdvanced').classList.toggle('on');

    $('#toggleAdvanced').setAttribute('aria-pressed', enabled);

    if ($('#advancedRules')) $('#advancedRules').classList.toggle('hidden', !enabled);

  });

  if ($('#rakeMode')) $('#rakeMode').addEventListener('change', () => {
    if ($('#rakeValueWrapper')) $('#rakeValueWrapper').classList.toggle('hidden', ['off', 'fixed'].includes($('#rakeMode').value));
  });



  if ($('#solverFile')) $('#solverFile').addEventListener('change', (event) => {

    const [file] = event.target.files;

    if (file) {

      app.useApi = false;

      loadSolverFile(file);

    }

    event.target.value = '';

  });

  

  // Wire both topbar & settings ONNX buttons to toggleOnnxModel

  if ($('#connectApiBtn')) $('#connectApiBtn').addEventListener('click', toggleOnnxModel);

  if ($('#useOnnxToggle')) $('#useOnnxToggle').addEventListener('click', toggleOnnxModel);

  

  // Training status polling removed - training no longer needed

  if ($('#calculate')) $('#calculate').addEventListener('click', calculateEquity);

  if ($('#trials')) $('#trials').addEventListener('change', setEquityPending);

  if ($('#calcStyle')) $('#calcStyle').addEventListener('change', setEquityPending);



  if ($('#openSettings')) $('#openSettings').addEventListener('click', () => { if ($('#settingsModal')) $('#settingsModal').classList.add('show'); });

  if ($('#closeSettingsModal')) $('#closeSettingsModal').addEventListener('click', () => { if ($('#settingsModal')) $('#settingsModal').classList.remove('show'); });

  if ($('#settingsModal')) $('#settingsModal').addEventListener('click', (event) => { if (event.target === $('#settingsModal')) $('#settingsModal').classList.remove('show'); });

  if ($('#fourColorDeckToggle')) $('#fourColorDeckToggle').addEventListener('click', () => applyDeckStyle(!app.settings.fourColorDeck));

  if ($('#toggleTableBtn')) {
    $('#toggleTableBtn').addEventListener('click', (e) => {
      const wrapper = $('#table-wrapper');
      if (wrapper) {
        wrapper.classList.toggle('collapsed');
        e.target.textContent = wrapper.classList.contains('collapsed') ? 'Expand Table' : 'Collapse Table';
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

  if ($('#autoConnectApi')) $('#autoConnectApi').addEventListener('click', () => {

    const enabled = $('#autoConnectApi').classList.toggle('on');

    $('#autoConnectApi').setAttribute('aria-pressed', enabled);

    localStorage.setItem('autoConnectApi', enabled);

    if (enabled && !app.useApi && $('#connectApiBtn')) $('#connectApiBtn').click();

  });

  

  if (localStorage.getItem('autoConnectApi') === 'true') {

      if ($('#autoConnectApi')) {

        $('#autoConnectApi').classList.add('on');

        $('#autoConnectApi').setAttribute('aria-pressed', 'true');

      }

      setTimeout(() => { if ($('#connectApiBtn')) $('#connectApiBtn').click(); }, 500);

  }

  

  // Fix Rake Value initial state bug

  if ($('#rakeMode')) $('#rakeMode').dispatchEvent(new Event('change'));

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



async function toggleOnnxConnection() {

  await toggleOnnxModel();

}



async function toggleOnnxModel() {
  const useBtn = $('#useOnnxBtn');

  

  if (app.useOnnx) {

    app.useOnnx = false;

    setStrategySourceStatus('fallback', 'Heuristic fallback');

    if (useBtn) {

      useBtn.textContent = '⚡ ' + t('Use Local ONNX');

      useBtn.classList.remove('active');

    }

    toast(t('ONNX Neural Net disabled'), 'info');

    updateContext('ONNX Disabled');

  } else {

    setStrategySourceStatus('loading', 'Loading model');

    if (useBtn) useBtn.textContent = '⏳ ' + t('Loading ONNX...');

    const loaded = await loadOnnxModel();

    if (loaded) {

      app.useOnnx = true;

      app.useApi = false;

      setStrategySourceStatus('available', 'ONNX model');

      if (useBtn) {

        useBtn.textContent = '⚡ ' + t('ONNX Active');

        useBtn.classList.add('active');

      }

      toast(t('ONNX Neural Net connected'), 'success');

      updateContext('Switched to ONNX');

    } else {

      setStrategySourceStatus('unavailable', 'Model unavailable · heuristic');

      if (useBtn) {

        useBtn.textContent = '⚡ ' + t('Use Local ONNX');

        useBtn.classList.remove('active');

      }

      toast(t('Failed to load ONNX model'), 'error');

    }

  }

}



// Re-apply all programmatically-set translated text when the user changes language.
// updateDomTranslations() only handles data-i18n attributes on DOM elements.
// This function covers text set via t() calls in JS that won't auto-refresh.
function refreshDynamicTranslations() {
  // --- ONNX status bar ---
  const useBtn = $('#useOnnxBtn');
  setStrategySourceStatus(app.useOnnx ? 'available' : 'fallback', app.useOnnx ? 'ONNX model' : 'Heuristic fallback');
  if (useBtn) {
    if (app.useOnnx) {
      useBtn.textContent = '⚡ ' + t('ONNX Active');
    } else {
      useBtn.textContent = '⚡ ' + t('Use Local ONNX');
    }
  }

  // --- Training mode display ---
  const handDisplay = $('#trainingHandDisplay');
  const instruction = $('#trainingInstruction');
  const nextBtn = $('#trainingNewHand') || $('#trainingNextBtn');
  if (handDisplay && (!app.training || !app.training.hero || app.training.hero.length === 0)) {
    handDisplay.textContent = t('READY TO TRAIN?');
  }
  if (instruction && (!app.training || !app.training.hero || app.training.hero.length === 0)) {
    instruction.textContent = t("Click 'Start Training' to generate a scenario, or select cards manually.");
  }
  if (nextBtn && (!app.training || !app.training.hero || app.training.hero.length === 0)) {
    nextBtn.textContent = t('Start Training →');
  }

  // --- Action path flowchart ---
  const boardCards = app.gto && app.gto.board ? app.gto.board.filter(Boolean).length : 0;
  let street = 'preflop';
  if (boardCards >= 5) street = 'river';
  else if (boardCards === 4) street = 'turn';
  else if (boardCards >= 3) street = 'flop';
  renderPath(street);

  // --- Theme swatches (they contain translated names) ---
  initThemeSwatches();

  // --- Re-run GTO context for action recommendation text ---
  updateContext('Language refreshed');

  // --- Refresh Betting Tree ---
  renderBettingTree();
}

// Expose to i18n.js so setLanguage() can call it
window.refreshDynamicTranslations = refreshDynamicTranslations;


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

    SoundFX.initBtn();

    // Bypassing browser form-fill cache on reload

    if ($('#players')) $('#players').value = '8';

    if ($('#playersNum')) $('#playersNum').value = '8';

    if ($('#stackMode')) $('#stackMode').value = 'hero';

    if ($('#stack')) $('#stack').value = '30';

    if ($('#stackNum')) $('#stackNum').value = '30';

    if ($('#rakeMode')) $('#rakeMode').value = 'off';

    if ($('#rakePot')) {

      $('#rakePot').setAttribute('aria-pressed', 'false');

      $('#rakePot').classList.remove('on');

    }

    if ($('#heroPos')) $('#heroPos').value = 'UTG';

    if ($('#lastAction')) $('#lastAction').value = 'unopened';

    if ($('#potSize')) $('#potSize').value = '1.5';

    if ($('#facingSize')) $('#facingSize').value = '0';

    

    // Reset language and API defaults while preserving a valid saved visual theme.
    const defaultLang = 'en';
    window.appLang = defaultLang;
    localStorage.setItem('appLang', defaultLang);
    document.documentElement.lang = defaultLang;
    document.documentElement.dir = 'ltr';
    if ($('#langToggle')) $('#langToggle').value = defaultLang;

    const defaultTheme = 'midnight';
    const persistedTheme = localStorage.getItem('appTheme');
    const selectedTheme = THEME_PREVIEWS.some(theme => theme.id === persistedTheme)
      ? persistedTheme
      : defaultTheme;
    if (selectedTheme !== persistedTheme) localStorage.setItem('appTheme', selectedTheme);
    document.documentElement.dataset.theme = selectedTheme;
    if ($('#themeColor')) $('#themeColor').value = selectedTheme;

    const defaultAutoConnect = 'true';
    localStorage.setItem('autoConnectApi', defaultAutoConnect);
    if ($('#autoConnectApi')) {
      $('#autoConnectApi').classList.add('on');
      $('#autoConnectApi').setAttribute('aria-pressed', 'true');
    }

    

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

// Preflop ranges by position (used for range advantage comparison)

// Return the first valid combo of a hand class that isn't blocked by the board

const PREFLOP_RANGES = {

  // Approximate GTO opening/defending ranges by position (percentage of hands)

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



// Score a hand on the board: returns 0–4 (0=air,1=marginal,2=strong,3=nuts, -1=not in range)

function scoreRangeHand(handCode, boardCards, range) {

  if (!range.has(handCode)) return -1;

  const combo = getValidComboForRange(handCode, boardCards);

  if (!combo) return -1; // blocked by board



  const score = scoreSevenJs(combo, boardCards);

  const cat   = Math.floor(score / 10000000000);



  if      (cat >= 4)  return 3; // nuts  (straight+)

  else if (cat >= 2)  return 2; // strong (two pair+)

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
  if (!grid) return { nuts:0, strong:0, marginal:0, air:0, total:0 };
  
  const stats = { nuts:0, strong:0, marginal:0, air:0, total:0 };
  const COLOR = { 3:'var(--primary)', 2:'#8bc34a', 1:'var(--orange)', 0:'var(--red)' };
  const LABEL = { 3: t('Nuts'), 2: t(t('Strong (10%+)')), 1: t(t('Marginal (5%+)')), 0: t(t('Air')), [-1]: t(t('Not in range')) };

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
    btn.title = LABEL[tier] || t(t('Not in range'));

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
      stats[['air','marginal','strong','nuts'][tier]]++;
      stats.total++;
    }
  }));



  if (statIds) {

    const pct = v => stats.total ? (v/stats.total*100).toFixed(0)+'%' : '0%';

    if ($('#'+statIds.nuts))     $('#'+statIds.nuts).textContent     = `${stats.nuts} (${pct(stats.nuts)})`;

    if ($('#'+statIds.strong))   $('#'+statIds.strong).textContent   = `${stats.strong} (${pct(stats.strong)})`;

    if ($('#'+statIds.marginal)) $('#'+statIds.marginal).textContent = `${stats.marginal} (${pct(stats.marginal)})`;

    if ($('#'+statIds.air))      $('#'+statIds.air).textContent      = `${stats.air} (${pct(stats.air)})`;

  }

  return stats;

}



function renderRangeAdvantage() {

  const board = app.gto.board.filter(Boolean);

  const heroPos    = selectedValue('#heroPos');

  const villainSel = $('#rangeAdvVillainPos');

  const villainPos = villainSel ? villainSel.value : 'BB';



  const heroRange    = PREFLOP_RANGES[heroPos]    || PREFLOP_RANGES['BTN'];

  const villainRange = PREFLOP_RANGES[villainPos] || PREFLOP_RANGES['BB'];



  // Update titles

  if ($('#heroRangeTitle'))    $('#heroRangeTitle').textContent    = `${t('Hero')} (${heroPos})`;

  if ($('#villainRangeTitle')) $('#villainRangeTitle').textContent = `${t('Villain')} (${villainPos})`;



  if (board.length < 3) {

    if ($('#rangeConclusion')) $('#rangeConclusion').innerHTML = t('Waiting for board...');

    // Render empty grids to show ranges

    renderRangeGrid('heroRangeGrid',    'heroHoverInfo',    heroRange,    [], { nuts:'heroStatNuts', strong:'heroStatStrong', marginal:'heroStatMarginal', air:'heroStatAir' });

    renderRangeGrid('villainRangeGrid', 'villainHoverInfo', villainRange, [], { nuts:'vilStatNuts',  strong:'vilStatStrong',  marginal:'vilStatMarginal',  air:'vilStatAir' });

    if ($('#heroAdvBar'))    $('#heroAdvBar').style.width    = '50%';

    if ($('#villainAdvBar')) $('#villainAdvBar').style.transform = 'scaleX(0.5)';

    if ($('#heroRangeScore'))    $('#heroRangeScore').textContent    = t('Preflop range');

    if ($('#villainRangeScore')) $('#villainRangeScore').textContent = t('Preflop range');

    return;

  }



  const heroStats    = renderRangeGrid('heroRangeGrid',    'heroHoverInfo',    heroRange,    board, { nuts:'heroStatNuts', strong:'heroStatStrong', marginal:'heroStatMarginal', air:'heroStatAir' });

  const villainStats = renderRangeGrid('villainRangeGrid', 'villainHoverInfo', villainRange, board, { nuts:'vilStatNuts',  strong:'vilStatStrong',  marginal:'vilStatMarginal',  air:'vilStatAir' });



  // Advantage bar

  const heroNutsPct = heroStats.total    ? heroStats.nuts    / heroStats.total    : 0;

  const vilNutsPct  = villainStats.total ? villainStats.nuts / villainStats.total : 0;

  const totalNuts   = heroNutsPct + vilNutsPct || 1;

  const heroShare   = Math.round(heroNutsPct / totalNuts * 100);



  if ($('#heroAdvBar'))    $('#heroAdvBar').style.width    = heroShare + '%';

  if ($('#villainAdvBar')) $('#villainAdvBar').style.width = (100 - heroShare) + '%';

  if ($('#heroRangeScore'))    $('#heroRangeScore').textContent    = `${(heroNutsPct*100).toFixed(1)}% ${t('Nuts')}`;

  if ($('#villainRangeScore')) $('#villainRangeScore').textContent = `${(vilNutsPct*100).toFixed(1)}% ${t('Nuts')}`;



  // Conclusion

  let conclusion = '', color = 'var(--primary)';

  const nutDiff   = heroNutsPct - vilNutsPct;

  const heroStrong = heroStats.total ? (heroStats.nuts+heroStats.strong)/heroStats.total : 0;

  const vilStrong  = villainStats.total ? (villainStats.nuts+villainStats.strong)/villainStats.total : 0;



  if (nutDiff > 0.08) {

    conclusion = `<strong>${t('Significant Nut Advantage')}</strong><br>${t('Hero has a high concentration of nutted hands compared to Villain. This allows Hero to use large bet sizes and overbets, as Villain will struggle to defend.')}`;

    color = 'var(--primary)';

  } else if (heroStrong - vilStrong > 0.10) {

    conclusion = `<strong>${t('Range Advantage')}</strong><br>${t('Hero connects much better with this board overall. Hero can bet very frequently (using smaller bet sizes) to apply maximum pressure.')}`;

    color = '#8bc34a';

  } else if (nutDiff < -0.08) {

    conclusion = `<strong>${t('Villain Nut Advantage')}</strong><br>${t("The board favors the opponent's range. Hero must proceed with caution and play more passively (check/calling), avoiding large bluffs.")}`;

    color = 'var(--red)';

  } else {

    conclusion = `<strong>${t('Neutral Board')}</strong><br>${t('The board is relatively neutral, distributing equity evenly. Play should be mixed, relying on individual hand strength rather than broad range bets.')}`;

    color = 'var(--orange)';

  }



  if ($('#rangeConclusion')) {

    $('#rangeConclusion').innerHTML = conclusion;

    $('#rangeConclusion').style.borderLeftColor = color;

  }

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



function initTrainingMode() {

  console.log('[Training] initTrainingMode called');

  // Attach button listeners exactly once using dataset.bound
  const foldBtn = $('#trainingFoldBtn');
  const callBtn = $('#trainingCallBtn');
  const raiseBtn = $('#trainingRaiseBtn');
  const resetBtn = $('#trainingResetStats');
  const newBtn = $('#trainingNewHand');
  const nextBtn = $('#trainingNextHandBtn');

  if (foldBtn && !foldBtn.dataset.bound) {
    foldBtn.dataset.bound = 'true';
    foldBtn.addEventListener('click', function() { handleTrainingGuess(this.dataset.action || 'fold'); });
  }
  if (callBtn && !callBtn.dataset.bound) {
    callBtn.dataset.bound = 'true';
    callBtn.addEventListener('click', function() { handleTrainingGuess(this.dataset.action || 'call'); });
  }
  if (raiseBtn && !raiseBtn.dataset.bound) {
    raiseBtn.dataset.bound = 'true';
    raiseBtn.addEventListener('click', function() { handleTrainingGuess(this.dataset.action || 'raise'); });
  }
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.dataset.bound = 'true';
    resetBtn.addEventListener('click', resetTrainingStats);
  }
  if (newBtn && !newBtn.dataset.bound) {
    newBtn.dataset.bound = 'true';
    newBtn.addEventListener('click', newRandomTrainingHand);
  }
  if (nextBtn && !nextBtn.dataset.bound) {
    nextBtn.dataset.bound = 'true';
    nextBtn.addEventListener('click', newRandomTrainingHand);
  }

  const showSolBtn = $('#trainingShowSolution');
  if (showSolBtn && !showSolBtn.dataset.bound) {
    showSolBtn.dataset.bound = 'true';
    showSolBtn.addEventListener('click', function() {
      const isPressed = this.classList.contains('on') || this.getAttribute('aria-pressed') === 'true';
      const nextState = !isPressed;
      this.classList.toggle('on', nextState);
      this.setAttribute('aria-pressed', String(nextState));
      if (!app.training) app.training = { hero: [], board: [], stats: { totalHands: 0, correct: 0, streak: 0 }, showSolutionImmediately: false };
      app.training.showSolutionImmediately = nextState;
      console.log('[Training] Show solution immediately toggled:', nextState);

      if (nextState && app.training.currentSolution) {
        showTrainingSolution(app.training.currentSolution);
      } else if (!nextState && $('#trainingGuessButtons')?.style.display !== 'none') {
        const solutionDiv = $('#trainingSolution');
        if (solutionDiv) solutionDiv.style.display = 'none';
      }
    });
  }

  const diffSelect = $('#trainingDifficulty');
  if (diffSelect && !diffSelect.dataset.bound) {
    diffSelect.dataset.bound = 'true';
    diffSelect.addEventListener('change', function() {
      console.log('[Training] Assistance level changed to:', this.value);
      updateAssistanceDisplay();
    });
  }

  $('#trainingHeroPos')?.addEventListener('change', function() {
    console.log('[Training] Hero position changed to:', this.value);
    if (app.training && app.training.hero && app.training.hero.length === 2) {
      updateContext('Training position changed');
    }
  });

  $('#trainingLastAction')?.addEventListener('change', function() {
    console.log('[Training] Last action changed to:', this.value);
    if (app.training && app.training.hero && app.training.hero.length === 2) {
      updateContext('Training action changed');
    }
  });

  // Training mode sliders
  $('#trainingPlayers')?.addEventListener('input', function() {
    $('#trainingPlayersNum').value = this.value;
    updateTrainingPositions();
  });
  $('#trainingPlayersNum')?.addEventListener('input', function() {
    $('#trainingPlayers').value = this.value;
    updateTrainingPositions();
  });
  $('#trainingStack')?.addEventListener('input', function() {
    $('#trainingStackNum').value = this.value;
  });
  $('#trainingStackNum')?.addEventListener('input', function() {
    $('#trainingStack').value = this.value;
  });

  updateTrainingPositions();

  // Show clean initial state (no auto-generated hand)
  const handDisplay = $('#trainingHandDisplay');
  if (handDisplay && (!app.training.hero || app.training.hero.length === 0)) {
    handDisplay.textContent = t('READY TO TRAIN?') || 'READY TO TRAIN?';
  }
  const instruction = $('#trainingInstruction');
  if (instruction && (!app.training.hero || app.training.hero.length === 0)) {
    instruction.textContent = t("Click 'Start Training' to generate a scenario, or select cards manually.") || "Click 'Start Training' to generate a scenario, or select cards manually.";
  }
  if (nextBtn && (!app.training.hero || app.training.hero.length === 0)) {
    nextBtn.style.display = 'inline-flex';
    nextBtn.textContent = t('Start Training →') || 'Start Training →';
  }
}



// Initialize app.training object

if (!app.training) {

  app.training = {

    hero: [],

    board: [],

    stats: {

      totalHands: 0,

      correct: 0,

      streak: 0

    },

    showSolutionImmediately: false,

    currentHand: null,

    currentSolution: null

  };

}



// Hook renderAllCards to update training UI

(function() {

  const _origRender = renderAllCards;

  renderAllCards = function() {

    _origRender();

    

    // Check if we're in training mode

    const trainingMode = document.getElementById('trainingMode');

    if (!trainingMode || trainingMode.style.display === 'none') return;

    

    const heroCards = app.training.hero || [];

    const guessButtons = document.getElementById('trainingGuessButtons');

    const handDisplay = document.getElementById('trainingHandDisplay');

    const instruction = document.getElementById('trainingInstruction');

    

    if (heroCards.length === 2 && heroCards[0] && heroCards[1]) {

      const card1 = `<button class="card-slot filled animate-deal" data-group="trainingHero" data-index="0">${cardMarkup(heroCards[0])}</button>`;
      const card2 = `<button class="card-slot filled animate-deal" data-group="trainingHero" data-index="1">${cardMarkup(heroCards[1])}</button>`;
      const heroLabel = t('HERO HOLE CARDS') || 'HERO HOLE CARDS';
      const boardCards = app.training.board || [];
      const streetName = boardCards.length === 3 ? 'FLOP' : boardCards.length === 4 ? 'TURN' : 'RIVER';
      const commKey = `COMMUNITY BOARD (${streetName})`;
      const commLabel = t(commKey) || (t('COMMUNITY BOARD') + ` (${streetName})`);

      const heroGroup = `<div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
        <span style="font-size:10px; font-weight:800; color:var(--primary); letter-spacing:1.5px;" data-i18n="HERO HOLE CARDS">${heroLabel}</span>
        <div style="display:flex; gap:8px;">${card1}${card2}</div>
      </div>`;

      let boardGroup = '';
      if (boardCards.length > 0) {
        const boardSlots = boardCards.map((c, i) =>
          `<button class="card-slot filled animate-deal" data-group="trainingBoard" data-index="${i}">${cardMarkup(c)}</button>`
        ).join('');
        boardGroup = `<div style="display:flex; flex-direction:column; gap:4px; align-items:center;">
          <span style="font-size:10px; font-weight:800; color:var(--orange); letter-spacing:1.5px;" data-i18n="${commKey}">${commLabel}</span>
          <div style="display:flex; gap:8px;">${boardSlots}</div>
        </div>`;
      }

      if (handDisplay) handDisplay.innerHTML = `<div style="display:flex; gap:24px; align-items:center; flex-wrap:wrap;">${heroGroup}${boardGroup}</div>`;

      if (instruction) instruction.textContent = t('Choose your action:') || 'Choose your action:';

      if (guessButtons && (!app.training.currentSolution || $('#trainingSolution')?.style.display === 'none')) {
        guessButtons.style.display = 'flex';
      }

    } else {
      if (handDisplay) handDisplay.innerHTML = t('READY TO TRAIN?') || 'READY TO TRAIN?';
      if (instruction) instruction.textContent = t("Click 'Start Training' to generate a scenario, or select cards manually.") || "Click 'Start Training' to generate a scenario, or select cards manually.";
    }
  }
})();

const ACTION_PASSIVE_TO_AGGRESSIVE_ORDER = {
  'fold': 0,
  'check': 1,
  'call': 2,
  'bet': 3,
  'raise': 4,
  '3-bet': 5,
  '3bet': 5,
  '4-bet': 6,
  '4bet': 6,
  'all-in': 7,
  'shove': 7
};

function getActionAggressionRank(actName) {
  const norm = normalizeActionName(actName).toLowerCase();
  if (ACTION_PASSIVE_TO_AGGRESSIVE_ORDER[norm] !== undefined) {
    return ACTION_PASSIVE_TO_AGGRESSIVE_ORDER[norm];
  }
  if (norm.includes('fold')) return 0;
  if (norm.includes('check')) return 1;
  if (norm.includes('call')) return 2;
  if (norm.includes('bet')) return 3;
  if (norm.includes('raise')) return 4;
  if (norm.includes('3')) return 5;
  if (norm.includes('4')) return 6;
  if (norm.includes('all') || norm.includes('shove')) return 7;
  return 3;
}

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

function getActionPct(solution, action) {
  if (!solution || typeof solution !== 'object') return 0;
  const targetNorm = normalizeActionName(action);
  let maxVal = 0;
  for (const [k, v] of Object.entries(solution)) {
    const kNorm = normalizeActionName(k);
    if (kNorm === targetNorm) {
      maxVal = Math.max(maxVal, Number(v) || 0);
    }
  }
  return maxVal;
}

function updateTrainingButtons(solution) {
  const container = $('#trainingGuessButtons');
  if (!container) return;

  container.innerHTML = '';

  const facing = app.training?.currentContext?.facingSize || 0;
  const lastAction = app.training?.currentContext?.lastAction || '';
  const street = app.training?.currentContext?.street || (app.training?.board && app.training.board.length >= 3 ? 'postflop' : 'preflop');
  const heroPos = app.training?.currentContext?.hero_pos || 'UTG';

  const isPreflopUnopened = (street === 'preflop') && (lastAction === 'unopened') && (facing === 0) && (heroPos !== 'BB');

  let rawKeys = (solution && typeof solution === 'object' && Object.keys(solution).length > 0)
    ? [...Object.keys(solution)]
    : [];

  let solKeys = [];

  if (isPreflopUnopened) {
    // Preflop unopened spots outside BB (UTG, HJ, CO, BTN, SB):
    // Hero CANNOT Check in poker rules. The only legal choices are FOLD and OPEN.
    solKeys = ['Fold', 'Open'];
  } else if (facing === 0) {
    // Postflop OR preflop BB facing 0: Check is free. FOLD is NEVER an option when facing 0.0 bet!
    // The legal choices are CHECK and BET/RAISE.
    const nonFoldKeys = rawKeys.filter(k => normalizeActionName(k) !== 'fold');
    const existingNorms = new Set(nonFoldKeys.map(k => normalizeActionName(k)));

    solKeys = [...nonFoldKeys];
    if (!existingNorms.has('check')) {
      solKeys.unshift('Check');
    }
    if (!existingNorms.has('bet') && !existingNorms.has('raise')) {
      solKeys.push('Bet');
    }
  } else {
    // Facing a bet (> 0 bb): FOLD, CALL, RAISE/3-BET/4-BET
    const existingNorms = new Set(rawKeys.map(k => normalizeActionName(k)));
    solKeys = [...rawKeys];

    if (!existingNorms.has('fold')) {
      solKeys.push('Fold');
    }
    if (!existingNorms.has('call')) {
      solKeys.push('Call');
    }
    if (!existingNorms.has('raise') && !existingNorms.has('3-bet') && !existingNorms.has('4-bet') && !existingNorms.has('all-in')) {
      let aggAction = 'Raise';
      if (lastAction === 'raise' || lastAction === 'open') aggAction = '3-Bet';
      else if (lastAction === '3bet') aggAction = '4-Bet';
      solKeys.push(aggAction);
    }
  }

  // Sort buttons strictly from Passive (Left) to Aggressive (Right)
  solKeys.sort((a, b) => getActionAggressionRank(a) - getActionAggressionRank(b));

  const colorMap = {
    'fold': 'var(--red)',
    'check': 'var(--matrix-call)',
    'call': 'var(--matrix-call)',
    'open': 'var(--matrix-open)',
    'raise': 'var(--matrix-open)',
    'bet': 'var(--matrix-open)',
    '3-bet': 'var(--orange)',
    '3bet': 'var(--orange)',
    '4-bet': 'var(--orange)',
    '4bet': 'var(--orange)',
    'all-in': 'var(--red)',
    'shove': 'var(--red)'
  };

  solKeys.forEach(key => {
    const norm = normalizeActionName(key);
    const bg = colorMap[norm] || colorMap[key.toLowerCase()] || 'var(--primary)';

    const btn = document.createElement('button');
    btn.className = 'cta animate-deal';
    btn.style.background = bg;
    btn.setAttribute('data-action', norm);
    btn.setAttribute('data-i18n', key);
    btn.textContent = t(key) || key;

    btn.addEventListener('click', function() {
      handleTrainingGuess(this.getAttribute('data-action') || key);
    });

    container.appendChild(btn);
  });

  container.style.display = 'flex';
}

function generateFeedback(userAction, bestAction, solution) {
  const userPct = getActionPct(solution, userAction);
  const bestPct = getActionPct(solution, bestAction);

  const heroPos = $('#trainingHeroPos')?.value || 'UTG';
  const lastAction = $('#trainingLastAction')?.value || 'unopened';
  const stack = numericValue('#trainingStack', 30);
  const heroCards = app.training?.hero || [];
  const board = app.training?.board || [];

  const uNorm = normalizeActionName(userAction);
  const bNorm = normalizeActionName(bestAction);

  const bestActionTrans = t(bestAction) || bestAction;
  const userActionTrans = t(userAction) || userAction;

  let isCorrect = uNorm === bNorm || userPct >= bestPct || (bestPct - userPct) < 15;

  let madeHandForImplications = '';
  let drawsForImplications = [];
  if (board.length >= 3 && typeof evaluatePostflopHand === 'function') {
    const evalRes = evaluatePostflopHand(heroCards, board);
    if (evalRes) {
      madeHandForImplications = evalRes.madeHand;
      drawsForImplications = evalRes.draws;
    }
  }

  let gameState = null;
  if (typeof analyzeGameState === 'function') {
    gameState = analyzeGameState({best: bNorm.toUpperCase()}, board, handClass(heroCards) || '', madeHandForImplications, drawsForImplications);
  }

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  let text = '';
  let title = '';

  if (isCorrect) {
    const perfectTitles = [
      t('Perfect! Optimal GTO Decision') || 'Perfect! Optimal GTO Decision',
      t('Spot On! High-EV Line') || 'Spot On! High-EV Line',
      t('Excellent! Textbook GTO Play') || 'Excellent! Textbook GTO Play'
    ];
    title = pickRandom(perfectTitles);
    
    if (gameState && board.length >= 3) {
      text = pickRandom([
        `${t('Great read.')} ${t('With')} ${gameState.madeHand} ${t('on this')} ${gameState.boardTexture} ${t('texture,')} ${bestActionTrans.toUpperCase()} ${t('is mathematically optimal.')}`,
        `${t('Spot on.')} ${t('Playing')} ${gameState.madeHand} ${t('aggressively/passively here maximizes EV.')}`
      ]);
    } else {
      text = t('Solver heavily favors {action} ({pct}%).').replace('{action}', bestActionTrans.toUpperCase()).replace('{pct}', bestPct.toFixed(0));
    }
  } else {
    const actionAggression = (act) => {
      const a = normalizeActionName(act).toLowerCase();
      if (a.includes('fold')) return 0;
      if (a.includes('call') || a.includes('check')) return 1;
      return 2;
    };
    const userRank = actionAggression(userAction);
    const bestRank = actionAggression(bestAction);

    if (userRank < bestRank) {
      title = pickRandom([
        t('Too Passive / Tight! Surrendering EV') || 'Too Passive / Tight! Surrendering EV',
        t('Overly Cautious! Surrendering Equity') || 'Overly Cautious! Surrendering Equity'
      ]);
      if (gameState && board.length >= 3) {
         text = pickRandom([
           `${t('Ouch.')} ${t('Folding')} ${gameState.madeHand} ${t('here is way too tight.')} ${t('We need to defend our MDF.')}`,
           `${t('Too passive.')} ${t('With')} ${gameState.madeHand} ${t('on a')} ${gameState.boardTexture} ${t('board, we must')} ${bestActionTrans.toUpperCase()} ${t('to realize equity.')}`
         ]);
      } else {
         text = pickRandom([
           t('GTO strongly prefers {bestAction} ({bestPct}%) over {userAction} ({userPct}%).') || 'GTO strongly prefers {bestAction} ({bestPct}%) over {userAction} ({userPct}%).'
         ]).replace('{bestAction}', bestActionTrans.toUpperCase()).replace('{bestPct}', bestPct.toFixed(0)).replace('{userAction}', userActionTrans.toUpperCase()).replace('{userPct}', userPct.toFixed(0));
      }
    } else {
      title = pickRandom([
        t('Too Loose / Aggressive! Over-elevating risk') || 'Too Loose / Aggressive! Over-elevating risk',
        t('Overly Aggressive! Over-bluffing Spot') || 'Overly Aggressive! Over-bluffing Spot'
      ]);
      if (gameState && board.length >= 3) {
         text = pickRandom([
           `${t('Overplaying')} ${gameState.madeHand} ${t('on a')} ${gameState.boardTexture} ${t('board is how we bleed chips. Respect the aggression.')}`,
           `${t('Too aggressive.')} ${t('Without a strong draw or blocker,')} ${userActionTrans.toUpperCase()} ${t('is mathematically losing EV.')}`
         ]);
      } else {
         text = pickRandom([
           t('GTO strongly prefers {bestAction} ({bestPct}%) over {userAction} ({userPct}%).') || 'GTO strongly prefers {bestAction} ({bestPct}%) over {userAction} ({userPct}%).'
         ]).replace('{bestAction}', bestActionTrans.toUpperCase()).replace('{bestPct}', bestPct.toFixed(0)).replace('{userAction}', userActionTrans.toUpperCase()).replace('{userPct}', userPct.toFixed(0));
      }
    }
  }

  return { title, text };
}



function updateAssistanceDisplay() {
  const diffSelect = $('#trainingDifficulty');
  const level = diffSelect ? diffSelect.value : 'hard';

  const details = document.querySelectorAll('.pot-math-detail');
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
        const odds = ctx.potOdds ? ctx.potOdds.toFixed(1) : '0.0';
        const mdf = ctx.mdf ? ctx.mdf.toFixed(1) : '100.0';

        if (facing > 0) {
          hintText.textContent = `Facing a ${facing.toFixed(1)}bb bet/raise in ${heroPos}. Pot Odds require at least ${odds}% equity to call. MDF target is ${mdf}%. Consider your position and blocker strength before choosing your action.`;
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

  

  if (titleEl) {
    titleEl.textContent = feedback.title;
    titleEl.style.color = isCorrect ? 'var(--primary)' : 'var(--orange)';
  }

  if (textEl) textEl.textContent = feedback.text;

  

  if (feedbackDiv) {
    feedbackDiv.style.display = 'block';
    feedbackDiv.classList.remove('animate-feedback');
    void feedbackDiv.offsetWidth;
    feedbackDiv.classList.add('animate-feedback');
  }

}



function showTrainingSolution(solution) {

  console.log('[Training] showTrainingSolution called with:', solution);

  const solutionDiv = $('#trainingSolution');

  const wheel = $('#trainingWheel');

  const centerText = $('#trainingWheelCenterText');

  if (!solutionDiv || !wheel || !centerText) return;

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

  // Render conic-gradient wheel slices in descending sorted order!
  let cumulative = 0;
  const slices = [];
  actionsList.forEach(act => {
    const start = cumulative;
    cumulative += act.pct;
    slices.push(`${act.color} ${start}% ${cumulative}%`);
  });

  wheel.style.background = slices.length > 0
    ? `conic-gradient(${slices.join(', ')})`
    : `var(--card-bg)`;

  if (typeof renderFrequencyStack === 'function') {
    renderFrequencyStack($('#trainingFrequencyStack'), actionsList.map((action) => ({
      name: action.name,
      value: action.pct,
      kind: action.kind
    })));
  }

  // Show highest frequency action in center text
  const bestAction = actionsList.length > 0 ? actionsList[0].name.toUpperCase() : '-';
  centerText.textContent = bestAction;

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

  solutionDiv.style.display = 'block';
  solutionDiv.classList.remove('animate-solution');
  void solutionDiv.offsetWidth;
  solutionDiv.classList.add('animate-solution');

}



function updateTrainingStats() {

  const totalEl = $('#trainingTotalHands');

  const correctEl = $('#trainingCorrect');

  const accuracyEl = $('#trainingAccuracy');

  const streakEl = $('#trainingStreak');

  

  if (totalEl) totalEl.textContent = app.training.stats.totalHands;

  if (correctEl) correctEl.textContent = app.training.stats.correct;

  

  const accuracy = app.training.stats.totalHands > 0

    ? (app.training.stats.correct / app.training.stats.totalHands * 100).toFixed(1)

    : '0';

  if (accuracyEl) accuracyEl.textContent = accuracy + '%';

  if (streakEl) streakEl.textContent = app.training.stats.streak;

  console.log('[Training] updateTrainingStats:', app.training.stats, 'accuracy:', accuracy + '%');
}



function resetTrainingStats() {

  console.log('[Training] resetTrainingStats called');

  app.training.stats = { totalHands: 0, correct: 0, streak: 0 };

  updateTrainingStats();

  const scoreBadge = $('#trainingScoreBadge');

  if (scoreBadge) scoreBadge.style.display = 'none';

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
  
  let mdf = facingSize > 0 ? (potSize / (potSize + facingSize)) : 1.0;
  mdf = mdf * (1.0 - (0.15 * L));
  
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
    } else if (realizedEquity >= (1.0 - mdf)) {
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

function calculatePostflopFallbackStrategy(context, heroCards) {

  return calculateUnifiedPostflopStrategy(context, heroCards, app.gto ? app.gto.dead : []);

}

function getTrainingStrategy(context, heroCards) {

  if (!heroCards || heroCards.length !== 2) return { "Fold": 100 };

  const r1str = heroCards[0][0];

  const r2str = heroCards[1][0];

  const isPair = r1str === r2str;

  const isSuited = heroCards[0][1] === heroCards[1][1];

  const handStr = formatHand(heroCards);

  console.log('[Training] getTrainingStrategy for hand:', handStr, 'cards:', heroCards, 'pos:', context.hero_pos);

  

  // 1. Check loaded solver tree / ONNX strategy cache first
  if (app.solver) {
    let entry = null;
    if (app.solver.strategy) {
      entry = (app.solver.strategy[handStr] || {})[context.hero_pos];
    } else if (app.solver.positions) {
      entry = (app.solver.positions[context.hero_pos] || {})[handStr];
    }

    if (entry) {
      console.log('[Training] Found solver/ONNX entry for', handStr, ':', entry);
      const res = {};
      for (const [k, val] of Object.entries(entry)) {
        const num = Number(val) || 0;
        res[k] = num <= 1.0 ? Math.round(num * 100) : Math.round(num);
      }

      // Universal Poker Guard: Never fold when facing 0.0 bet in check-legal spots
      const facing = Number(context.facingSize) || 0;
      const isPreflop = !context.board || context.board.length < 3;
      const isPreflopUnopened = isPreflop && context.lastAction === 'unopened' && facing === 0 && context.hero_pos !== 'BB';

      if (facing === 0 && !isPreflopUnopened) {
        if (res['Fold'] || res['fold']) {
          const foldPct = (res['Fold'] || 0) + (res['fold'] || 0);
          delete res['Fold'];
          delete res['fold'];
          res['Check'] = (res['Check'] || 0) + foldPct;
        }
      }

      return res;
    }
  }

  // 2. Check if postflop (board cards >= 3)
  if (context.board && context.board.length >= 3) {
    const postRes = calculatePostflopFallbackStrategy(context, heroCards);
    console.log('[Training] Postflop fallback strategy generated:', postRes);
    return postRes;
  }

  // 3. Fallback to unified preflop mathematical strategy

  const fb = calculatePreflopFallbackStrategy(

    r1str, r2str, isPair, isSuited,

    context.hero_pos, context.lastAction,

    context.facingSize, context.potSize, context.stack

  );

  

  const openName = context.facingSize === 0 ? 'Raise' : '3-Bet';

  const openVal = Math.round(fb.open * 100);

  const callVal = Math.round(fb.call * 100);

  const foldVal = Math.round(fb.fold * 100);

  

  const res = {};

  if (openVal > 0) res[openName] = openVal;

  if (callVal > 0) res['Call'] = callVal;

  if (foldVal > 0) res['Fold'] = foldVal;

  if (Object.keys(res).length === 0) res['Fold'] = 100;

  console.log('[Training] Preflop fallback strategy generated:', res);

  return res;

}



// Hook renderRangeAdvantage into updateContext and villain pos changes

(function() {

  const _orig = updateContext;

  updateContext = async function(reason) {

    const result = await _orig(reason);

    if ($('#rangeView') && $('#rangeView').style.display !== 'none') {

      renderRangeAdvantage();

    }

    // Refresh training strategy if ONNX or context changed
    if (app.training && app.training.currentHand && app.training.currentHand.length === 2) {
      const heroPos = $('#trainingHeroPos')?.value || 'UTG';
      const lastAction = $('#trainingLastAction')?.value || 'unopened';
      const tableSize = numericValue('#trainingPlayers', 6);
      const stack = numericValue('#trainingStack', 30);
      const facingSize = defaultTrainingFacingSize(lastAction);
      const potSize = (lastAction === 'unopened' ? 1.5 : facingSize > 0 ? facingSize * 1.5 : 1.5);
      
      app.training.currentSolution = getTrainingStrategy({
        table_size: tableSize,
        stack: stack,
        ...strategyAccountingContext('off', tableSize, 0),
        hero_pos: heroPos,
        lastAction: lastAction,
        potSize: potSize,
        facingSize: facingSize,
        board: []
      }, app.training.currentHand);
    }

    return result;

  };

})();



function sampleRealisticTrainingHand(heroPos) {
  const isEarly = ['UTG', 'HJ'].includes(heroPos);
  const ranksEarly = ['A', 'K', 'Q', 'J', 'T', '9', '8'];
  const suits = ['h', 'd', 'c', 's'];
  const deck = allDeck();

  let c1, c2;
  if (isEarly && Math.random() < 0.65) {
    c1 = ranksEarly[Math.floor(Math.random() * ranksEarly.length)] + suits[Math.floor(Math.random() * suits.length)];
    c2 = ranksEarly[Math.floor(Math.random() * ranksEarly.length)] + suits[Math.floor(Math.random() * suits.length)];
    while (c2 === c1) {
      c2 = ranksEarly[Math.floor(Math.random() * ranksEarly.length)] + suits[Math.floor(Math.random() * suits.length)];
    }
  } else {
    c1 = deck[Math.floor(Math.random() * deck.length)];
    const avail = deck.filter(c => c !== c1);
    c2 = avail[Math.floor(Math.random() * avail.length)];
  }
  return [c1, c2];
}

function sampleRealisticBoard(heroCards, boardCount) {
  if (boardCount === 0) return [];

  const deck = allDeck().filter(c => !heroCards.includes(c));
  const r1 = heroCards[0][0];
  const r2 = heroCards[1][0];
  const s1 = heroCards[0][1];
  const s2 = heroCards[1][1];

  const roll = Math.random();
  const board = [];

  if (roll < 0.45) {
    // Made hand (top pair/set/two pair) scenario
    const matchRank = Math.random() < 0.5 ? r1 : r2;
    const matchingCard = deck.find(c => c[0] === matchRank);
    if (matchingCard) board.push(matchingCard);
  } else if (roll < 0.75) {
    // Flush / Straight draw scenario
    const matchingSuit = s1 === s2 ? s1 : Math.random() < 0.5 ? s1 : s2;
    const suitedCards = deck.filter(c => c[1] === matchingSuit);
    if (suitedCards.length >= 2) {
      board.push(suitedCards[0], suitedCards[1]);
    }
  }

  while (board.length < boardCount) {
    const card = deck[Math.floor(Math.random() * deck.length)];
    if (!board.includes(card)) board.push(card);
  }

  return board.slice(0, boardCount);
}

let trainingToken = 0;

function randomTrainingTableSize() {
  return Math.floor(Math.random() * 9) + 2;
}

function randomTrainingPosition(tableSize) {
  const positions = POSITIONS[tableSize];
  if (!positions) throw new RangeError(`Unsupported training table size: ${tableSize}`);
  return positions[Math.floor(Math.random() * positions.length)];
}

function newRandomTrainingHand() {

  console.log('[Training] newRandomTrainingHand called');

  // Randomize Street (60% preflop, 25% flop, 10% turn, 5% river)
  const streetRoll = Math.random();
  let street = 'preflop';
  let boardCount = 0;
  if (streetRoll > 0.95) { street = 'river'; boardCount = 5; }
  else if (streetRoll > 0.85) { street = 'turn'; boardCount = 4; }
  else if (streetRoll > 0.60) { street = 'flop'; boardCount = 3; }

  // Randomize Table Size (2 to 10 players)
  const tableSize = randomTrainingTableSize();
  const playersEl = $('#trainingPlayers');
  const playersNumEl = $('#trainingPlayersNum');
  if (playersEl) playersEl.value = tableSize;
  if (playersNumEl) playersNumEl.value = tableSize;
  updateTrainingPositions();

  // Randomize Starting Stack (15, 20, 30, 50, 100bb)
  const stacks = [15, 20, 30, 50, 100];
  const stack = stacks[Math.floor(Math.random() * stacks.length)];
  const stackEl = $('#trainingStack');
  const stackNumEl = $('#trainingStackNum');
  if (stackEl) stackEl.value = stack;
  if (stackNumEl) stackNumEl.value = stack;

  // Randomize Hero Position (based on table size)
  const heroPos = randomTrainingPosition(tableSize);
  const posSelect = $('#trainingHeroPos');
  if (posSelect) posSelect.value = heroPos;

  // Randomize Action Context
  const preflopActions = ['unopened', 'raise', '3bet'];
  const postflopActions = ['check', 'bet', 'raise'];
  const availActions = street === 'preflop' ? preflopActions : postflopActions;
  const lastAction = availActions[Math.floor(Math.random() * availActions.length)];
  const actionSelect = $('#trainingLastAction');
  if (actionSelect) actionSelect.value = lastAction;

  // Sample realistic hero cards and board cards
  const heroCards = sampleRealisticTrainingHand(heroPos);
  const boardCards = sampleRealisticBoard(heroCards, boardCount);

  // Calculate realistic facing size and pot size in bb
  let facingSize = 0;
  let potSize = 1.5;

  if (street === 'preflop') {
    if (lastAction === 'raise') {
      facingSize = Math.round((Math.random() * 0.5 + 2.25) * 10) / 10;
      potSize = Math.round((facingSize + 1.5) * 10) / 10;
    } else if (lastAction === '3bet') {
      facingSize = Math.round((Math.random() * 1.5 + 6.75) * 10) / 10;
      potSize = Math.round((facingSize + 4.0) * 10) / 10;
    } else {
      facingSize = 0;
      potSize = 1.5;
    }
  } else {
    const basePot = boardCount === 3 ? 6.5 : boardCount === 4 ? 16.0 : 35.0;
    potSize = Math.round((basePot + (Math.random() * 4 - 2)) * 10) / 10;
    if (lastAction === 'bet') {
      const betPct = [0.33, 0.50, 0.66][Math.floor(Math.random() * 3)];
      facingSize = Math.round((potSize * betPct) * 10) / 10;
    } else if (lastAction === 'raise') {
      facingSize = Math.round((potSize * 0.75) * 10) / 10;
    } else {
      facingSize = 0;
    }
  }

  facingSize = normalizeFacingSize(lastAction, facingSize);

  // Calculate Pot Odds & MDF
  const potOdds = facingSize > 0 ? (facingSize / (potSize + facingSize) * 100) : 0;
  const mdf = facingSize > 0 ? (potSize / (potSize + facingSize) * 100) : 100;

  // Update Pot Info Strip
  const potInfo = $('#trainingPotInfo');
  const potVal = $('#trainingPotVal');
  const facingVal = $('#trainingFacingVal');
  const potOddsVal = $('#trainingPotOddsVal');
  const mdfVal = $('#trainingMdfVal');

  if (potInfo) potInfo.style.display = 'flex';
  if (potVal) potVal.textContent = potSize.toFixed(1) + ' bb';
  const isPreflop = street === 'preflop';
  const isUnopenedPreflop = isPreflop && facingSize === 0 && heroPos !== 'BB';

  if (facingVal) {
    if (isUnopenedPreflop) {
      facingVal.textContent = '0.0 bb (Unopened)';
    } else if (facingSize > 0) {
      facingVal.textContent = facingSize.toFixed(1) + ' bb';
    } else {
      facingVal.textContent = '0.0 bb (Free Check)';
    }
  }
  if (potOddsVal) potOddsVal.textContent = potOdds.toFixed(1) + '%';
  if (mdfVal) mdfVal.textContent = mdf.toFixed(1) + '%';

  if (!app.training) app.training = { hero: [], board: [], stats: { totalHands: 0, correct: 0, streak: 0 }, showSolutionImmediately: false };

  app.training.hero = heroCards;
  app.training.board = boardCards;

  const context = {
    table_size: tableSize,
    stack: stack,
    ...strategyAccountingContext('off', tableSize, 0),
    hero_pos: heroPos,
    lastAction: lastAction,
    potSize: potSize,
    facingSize: facingSize,
    potOdds: potOdds,
    mdf: mdf,
    board: boardCards
  };

  const currentToken = Date.now();
  trainingToken = currentToken;
  
  // Convert to async handling
  Promise.resolve(getTrainingStrategy(context, heroCards)).then(solution => {
      if (trainingToken !== currentToken) {
          console.log('[Training] Stale result discarded due to desync.');
          return;
      }
      app.training.currentSolution = solution;
      updateTrainingButtons(solution);
  });

  app.training.currentHand = heroCards;
  app.training.currentContext = context;
  console.log('[Training] Dealt spot:', street.toUpperCase(), heroPos, lastAction, heroCards, boardCards, 'Pot:', potSize, 'Facing:', facingSize);

  // Update Street label and assistance display
  const streetLabel = $('#trainingStreetLabel');
  if (streetLabel) streetLabel.textContent = street.toUpperCase();
  updateAssistanceDisplay();

  // Reset UI
  const feedbackDiv = $('#trainingFeedback');
  if (feedbackDiv) feedbackDiv.style.display = 'none';
  const solutionDiv = $('#trainingSolution');
  if (solutionDiv) solutionDiv.style.display = 'none';
  const scoreBadge = $('#trainingScoreBadge');
  if (scoreBadge) scoreBadge.style.display = 'none';

  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.style.display = 'flex';

  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) nextBtn.style.display = 'none';

  if (app.training.showSolutionImmediately) {
    console.log('[Training] showSolutionImmediately is true, revealing solution now.');
    showTrainingSolution(solution);
  }

  renderAllCards();

}



function handleTrainingGuess(userAction) {

  console.log('[Training] handleTrainingGuess called with:', userAction);

  if (!app.training.currentSolution || !app.training.currentHand) {
    console.error('[Training] Cannot handle guess - missing currentSolution or currentHand');
    return;
  }

  

  const solution = app.training.currentSolution;

  const actions = Object.entries(solution).sort((a, b) => b[1] - a[1]);

  const bestAction = actions.length > 0 ? actions[0][0] : 'Fold';

  

  const uLower = (userAction || '').toLowerCase();

  const bLower = (bestAction || '').toLowerCase();

  

  let isCorrect = uLower === bLower;

  if (!isCorrect) {

    if ((uLower.includes('raise') || uLower.includes('open') || uLower.includes('bet')) &&

        (bLower.includes('raise') || bLower.includes('open') || bLower.includes('bet') || bLower.includes('3-bet') || bLower.includes('4-bet'))) {

      isCorrect = true;

    } else if ((uLower.includes('call') || uLower.includes('check')) &&

               (bLower.includes('call') || bLower.includes('check'))) {

      isCorrect = true;

    } else if (uLower.includes('fold') && bLower.includes('fold')) {

      isCorrect = true;

    }

  }

  

  app.training.stats.totalHands++;

  if (isCorrect) {

    app.training.stats.correct++;

    app.training.stats.streak++;
        if(window.SoundFX) window.SoundFX.play('success_chime');

    SoundFX.playCorrect();

  } else {

    app.training.stats.streak = 0;
        if(window.SoundFX) window.SoundFX.play('error_buzz');

    SoundFX.playWrong();

  }

  updateTrainingStats();

  

  const scoreBadge = $('#trainingScoreBadge');

  if (scoreBadge) {

    scoreBadge.style.display = 'flex';

    scoreBadge.textContent = (isCorrect ? '✓ ' : '✗ ') + app.training.stats.correct + '/' + app.training.stats.totalHands + ' (' + ((app.training.stats.correct / app.training.stats.totalHands) * 100).toFixed(0) + '%)';

    scoreBadge.style.color = isCorrect ? 'var(--primary)' : 'var(--red)';

  }

  

  const feedback = generateFeedback(userAction, bestAction, solution);

  showTrainingFeedback(feedback, isCorrect);

  showTrainingSolution(solution);

  

  const guessButtons = $('#trainingGuessButtons');

  if (guessButtons) guessButtons.style.display = 'none';

  // Reveal Next Hand CTA button
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.style.display = 'inline-flex';
    nextBtn.textContent = t('Next Hand →') || 'Next Hand →';
  }

}

// Expose training functions globally for HTML onclick handlers
window.handleTrainingGuess = handleTrainingGuess;
window.newRandomTrainingHand = newRandomTrainingHand;
window.resetTrainingStats = resetTrainingStats;



document.addEventListener('DOMContentLoaded', () => {
  // Training progress polling removed - training no longer needed
});



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

// Remove summarizeOuts as it's no longer needed, but let's keep it as dummy or delete it.
function summarizeOuts(outs) { return ""; }


// ================================================================
// CENTRALIZED ACTION RECOMMENDATION HIERARCHY
// ================================================================

/**
 * generateActionRecommendation: Central truth hierarchy for action decisions.
 * Priority: ONNX (if confident) > Postflop Math > Preflop Fallback
 */
async function generateActionRecommendation(context) {
  if (!context) return { 'Check': 100 };

  // Tier 1: ONNX model (if available and confident)
  if (app.useApi && app.onnxAvailable && typeof runOnnxInference !== 'undefined') {
    try {
      const onnxResult = await runOnnxInference(context);
      if (onnxResult && onnxResult.confidence > 0.80) return onnxResult;
    } catch(e) {}
  }

  

  // Tier 3: Preflop fallback heuristic
  if (context.heroCards && context.heroCards.length >= 2) {
    if (typeof calculatePreflopFallbackStrategy !== 'undefined') {
      const h = context.heroCards;
      const r1 = h[0] ? h[0][0] : '2';
      const r2 = h[1] ? h[1][0] : '2';
      const isSuited = h[0] && h[1] && h[0][1] === h[1][1];
      const isPair = r1 === r2;
      return calculatePreflopFallbackStrategy(r1, r2, isPair, isSuited,
        context.hero_pos, context.lastAction, context.facingSize, context.potSize, context.stack);
    }
  }

  return { 'Fold': 100 };
}


// Progress polling
setInterval(async () => {
    try {
        const res = await fetch('progress.json');
        const data = await res.json();
        const pbar = document.getElementById('trainProgress');
        const ptext = document.getElementById('trainProgressText');
        if (pbar && ptext) {
            let pct = Math.min(100, Math.max(0, (data.elapsed_hours / 9.0) * 100));
            if (data.status === 'done') pct = 100;
            pbar.style.width = pct + '%';
            ptext.textContent = `STATUS: ${data.status.toUpperCase()} | TIME: ${data.elapsed_hours.toFixed(2)}h (ETA ${data.eta_hours.toFixed(1)}h) | LOSS: ${data.loss.toFixed(4)} | EPOCH: ${data.epoch} | BATCH: ${data.iteration.toLocaleString()}`;
            if (data.status === 'done') {
                ptext.style.color = '#00ff00';
            }
        }
    } catch(e) {}
}, 2000);

// Expose all globals to window for ES6 module compatibility
window.RANKS = RANKS;
window.SUITS = SUITS;
window.POSITIONS = POSITIONS;
window.ACTION_COLORS = ACTION_COLORS;
window.RANK_VALUE = RANK_VALUE;
window.app = app;
window.allDeck = allDeck;
window.getSuit = getSuit;
window.displayCard = displayCard;
window.selectedValue = selectedValue;
window.groupCards = groupCards;
window.isEquityGroup = isEquityGroup;
window.usedCards = usedCards;
window.remainingCards = remainingCards;
window.cardMarkup = cardMarkup;
window.renderSlots = renderSlots;
window.renderEquityPlayers = renderEquityPlayers;
window.updateActionOptions = updateActionOptions;
window.renderAllCards = renderAllCards;
window.openPicker = openPicker;
window.renderDeck = renderDeck;
window.firstEmptyIndex = firstEmptyIndex;
window.selectCard = selectCard;
window.closePicker = closePicker;
window.clearGroup = clearGroup;
window.currentStreet = currentStreet;
window.handClass = handClass;
window.numericValue = numericValue;
window.updatePositions = updatePositions;
window.normalizeTree = normalizeTree;
window.treeContext = treeContext;
window.classifyAction = classifyAction;
window.standardActionName = standardActionName;
window.parseSolverEntry = parseSolverEntry;
window.parseCard = parseCard;
window.simulateEquity = simulateEquity;
window.calculatePreflopFallbackStrategy = calculatePreflopFallbackStrategy;
window.noTreeProfile = noTreeProfile;
window.actionProfile = actionProfile;
window.setFrequency = setFrequency;
window.preflopBasePot = preflopBasePot;
window.updateMetrics = updateMetrics;
window.renderPath = renderPath;
window.handCode = handCode;
window.getFirstValidCombo = getFirstValidCombo;
window.renderChart = renderChart;
window.setApiStatus = setApiStatus;
window.encodeCardsForOnnx = encodeCardsForOnnx;
window.onnxAbortController = onnxAbortController;
window.getHandTier = getHandTier;
window.applyHeuristicToPrediction = applyHeuristicToPrediction;
window.combinations = combinations;
window.JS_EVAL_COUNTS = JS_EVAL_COUNTS;
window.JS_EVAL_RANKS = JS_EVAL_RANKS;
window.JS_EVAL_SUITS = JS_EVAL_SUITS;
window.JS_EVAL_5 = JS_EVAL_5;
window.scoreFive = scoreFive;
window.scoreSeven = scoreSeven;
window.shuffled = shuffled;
window.calculateEquity = calculateEquity;
window.renderEquityResult = renderEquityResult;
window.setEquityPending = setEquityPending;
window.syncSliderPair = syncSliderPair;
window.bindSliderPair = bindSliderPair;
window.loadSolverFile = loadSolverFile;
window.applyDeckStyle = applyDeckStyle;
window.toast = toast;
window.bindEvents = bindEvents;
window.THEME_PREVIEWS = THEME_PREVIEWS;
window.initThemeSwatches = initThemeSwatches;
window.refreshDynamicTranslations = refreshDynamicTranslations;
window.init = init;
window.PREFLOP_RANGES = PREFLOP_RANGES;
window.scoreSevenJs = scoreSevenJs;
window.getValidComboForRange = getValidComboForRange;
window.scoreRangeHand = scoreRangeHand;
window.renderRangeGrid = renderRangeGrid;
window.renderRangeAdvantage = renderRangeAdvantage;
window.renderBettingTree = renderBettingTree;
window.initTrainingMode = initTrainingMode;
window.ACTION_PASSIVE_TO_AGGRESSIVE_ORDER = ACTION_PASSIVE_TO_AGGRESSIVE_ORDER;
window.getActionAggressionRank = getActionAggressionRank;
window.normalizeActionName = normalizeActionName;
window.getActionPct = getActionPct;
window.updateTrainingButtons = updateTrainingButtons;
window.generateFeedback = generateFeedback;
window.updateAssistanceDisplay = updateAssistanceDisplay;
window.showTrainingFeedback = showTrainingFeedback;
window.showTrainingSolution = showTrainingSolution;
window.updateTrainingStats = updateTrainingStats;
window.resetTrainingStats = resetTrainingStats;
window.formatHand = formatHand;
window.evaluatePostflopHand = evaluatePostflopHand;
window.evaluatePostflopHandStrength = evaluatePostflopHandStrength;
window.calculateUnifiedPostflopStrategy = calculateUnifiedPostflopStrategy;
window.calculatePostflopFallbackStrategy = calculatePostflopFallbackStrategy;
window.getTrainingStrategy = getTrainingStrategy;
window.sampleRealisticTrainingHand = sampleRealisticTrainingHand;
window.sampleRealisticBoard = sampleRealisticBoard;
window.trainingToken = trainingToken;
window.newRandomTrainingHand = newRandomTrainingHand;
window.handleTrainingGuess = handleTrainingGuess;
window.calculateOuts = calculateOuts;
window.summarizeOuts = summarizeOuts;
