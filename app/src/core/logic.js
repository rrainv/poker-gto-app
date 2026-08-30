

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

let applicationExperienceSequence = 0;
function emitStudyExperience(type, {
  origin = 'live',
  source = 'application',
  payload = {},
} = {}) {
  const authority = window.RiverlineExperienceEvents;
  if (!authority?.emitStudy) return null;
  applicationExperienceSequence += 1;
  return authority.emitStudy({
    type,
    origin,
    source,
    token: applicationExperienceSequence,
    payload,
  });
}

function emitTrainingDecisionResultExperience({
  comparisonState,
  feedbackSemantics,
  accepted,
  chosenActionType,
} = {}) {
  const authority = window.RiverlineExperienceEvents;
  if (!authority?.emitTrainingDecisionResult) return null;
  applicationExperienceSequence += 1;
  return authority.emitTrainingDecisionResult({
    origin: 'live',
    source: 'training_decision',
    token: applicationExperienceSequence,
    comparisonState,
    feedbackSemantics,
    accepted,
    chosenActionType,
  });
}





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
const PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION = 'playbook-scenario/v2';
const PLAYBOOK_MODES = Object.freeze({ SCENARIO: 'scenario', HAND: 'hand' });



const app = {
  settings: {
    tightness: 0,
    fourColorDeck: true,
    cardRankStyle: 'poker',
    cardStyle: 'minimal',
    cardBackStyle: 'riverline'
  },

  gto: { hero: [], board: [], dead: [] },

  equity: {

    board: [],

    dead: [],

    nextPlayerId: 2,

    players: [

      { id: 'equity-player-0', name: '', cards: [], handMode: 'known' },

      { id: 'equity-player-1', name: '', cards: [], handMode: 'unknown' }

    ],

    lifecycle: 'idle',

    lastRequest: null,

    lastResult: null,

    staleResult: null,

    lastAnalysis: null,

    staleAnalysis: null,

    lastAnalysisLabels: null,

    staleAnalysisLabels: null,

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

    currentAttemptKind: 'primary',

    replaySourceRecordPromise: null,

    lifecycle: 'idle',

    nextSeed: Date.now() >>> 0,

    sessionMode: 'varied',

    practiceSession: null,

    fullHandSnapshot: null,

    fullHandReviewIndex: 0,

    fullHandSizedAction: null,

    memorySessionPromise: null,

    memoryWritePromise: Promise.resolve(),

    memoryCurrentRecordPromise: null,

    memoryCurrentRecordId: null,

    memoryFullHandDecisionRecords: new Map(),

    memoryPendingOrigin: null,

    memoryPendingOriginPromise: null,

    memoryView: 'review',

    memoryLastItems: [],

    memoryRedrillNote: ''

  },

  playbookHandDraft: {
    bySeat: {}, board: [], sizedAction: null, actionSubmissionLocked: false
  },

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

  playbookViewModel: null,

  handReview: {
    source: null,
    selectedDecisionIndex: null,
    model: null,
    savedDecisionIds: new Set()
  }

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

function callTrainingMemoryBridge(method, ...args) {
  try {
    const bridge = window.RiverlineTrainingMemory;
    if (!bridge || typeof bridge[method] !== 'function') return null;
    return bridge[method](...args);
  } catch (error) {
    console.error('[Riverline Training Memory]', error);
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

function requireHandReviewBridge() {
  const bridge = globalThis.RiverlineHandReview;
  if (!bridge || bridge.schemaVersion !== 'hand-review/v1'
    || typeof bridge.createProjector !== 'function') {
    throw new Error('Riverline Hand Review bridge is unavailable');
  }
  return bridge;
}

let handReviewProjector = null;

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

const displayCardRank = (rank) => globalThis.RiverlineCardPresentation
  ? globalThis.RiverlineCardPresentation.displayCardRank(rank, app.settings.cardRankStyle)
  : rank;

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

  const equityPlayer = equityPlayerFromHandGroup(group);

  if (equityPlayer) return equityPlayer.cards;

  return [];

}



function isEquityGroup(group) {

  return group.startsWith('eq') || isEquityPrivateHandGroup(group);

}

function equityHandGroup(playerId) {
  return `equity-hand-${playerId}`;
}

function equityPlayerFromHandGroup(group) {
  if (!isEquityPrivateHandGroup(group)) return null;
  const playerId = group.slice('equity-hand-'.length);
  return app.equity.players.find((player) => player.id === playerId) || null;
}

function isEquityPrivateHandGroup(group) {
  return String(group || '').startsWith('equity-hand-');
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

  const presentation = globalThis.RiverlineCardPresentation;
  if (!presentation) throw new Error('Riverline card presentation must initialize before cards render');
  return presentation.cardFaceMarkup({
    rank: card[0],
    suit: card[1],
    rankStyle: app.settings.cardRankStyle
  });

}

function cardVisualState(group, card) {
  if (!card) return 'empty';
  if (group.includes('dead')) return 'dead';
  return 'known';
}

function isPrivateHandCardSetGroup(group) {
  return group === 'hero' || group.startsWith('hand-seat-') || isEquityPrivateHandGroup(group);
}

function privateHandSetEditorMarkup(group, cards) {
  const ownerLabel = privateHandOwnerLabel(group);
  const cardMarkupSet = Array.from({ length: 2 }, (_, index) => {
    const card = cards[index];
    const suitClass = card ? ` card--suit-${card[1]}` : '';
    return `<span class="card-slot card--${card ? 'known filled' : 'empty'}${suitClass} riverline-card" data-card-state="${card ? 'known' : 'empty'}" data-card-size="slot" aria-hidden="true">${cardMarkup(card)}</span>`;
  }).join('');
  return `<button type="button" class="private-hand-set-editor" data-card-set-edit="${group}" aria-label="${escapeEquityMarkup(t('Edit {player} hand', { player: ownerLabel }))}">${cardMarkupSet}</button>`;
}

function boardCardSetEditorsMarkup(group, count, cards) {
  const entries = group === 'hand-board-chance'
    ? [{ originIndex: 0, cardCount: count }]
    : [
        { originIndex: 0, cardCount: 3 },
        { originIndex: 3, cardCount: 1 },
        { originIndex: 4, cardCount: 1 }
      ];
  return entries.map(({ originIndex, cardCount }) => {
    const definition = boardStreetCardSetDefinition(group, originIndex);
    const slots = Array.from({ length: cardCount }, (_, offset) => {
      const card = cards[originIndex + offset];
      const suitClass = card ? ` card--suit-${card[1]}` : '';
      return `<span class="card-slot card--${card ? 'known filled' : 'empty'}${suitClass} riverline-card" data-card-state="${card ? 'known' : 'empty'}" data-card-size="slot" aria-hidden="true">${cardMarkup(card)}</span>`;
    }).join('');
    const setClass = cardCount === 3 ? ' board-card-set-editor--flop' : ' board-card-set-editor--single';
    return `<button type="button" class="board-card-set-editor${setClass}" data-card-set-edit="${group}" data-card-set-index="${originIndex}" data-index="${originIndex}" aria-label="${escapeEquityMarkup(definition.title)}">${slots}</button>`;
  }).join('');
}



function renderSlots(group, count) {

  const target = document.querySelector(`[data-slots="${group}"]`);

  if (!target) return;

  const cards = groupCards(group);

  if (isPrivateHandCardSetGroup(group)) {
    target.innerHTML = privateHandSetEditorMarkup(group, cards);
    return;
  }

  if (['board', 'eqboard', 'hand-board-chance'].includes(group)) {
    target.innerHTML = boardCardSetEditorsMarkup(group, count, cards);
    return;
  }

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
    const boardDefinition = boardStreetCardSetDefinition(group, index);
    const ariaLabel = boardDefinition
      ? boardDefinition.title
      : card
        ? t('Replace {card}{dead}', { card: displayCard(card), dead: state === 'dead' ? `, ${t('dead card')}` : '' })
        : t('Choose a card');
    return `<button type="button" class="card-slot card--${state}${card ? ' filled' : ''}${suitClass} riverline-card" data-card-state="${state}" data-card-size="slot" data-group="${group}" data-index="${index}" aria-label="${ariaLabel}">${cardMarkup(card)}</button>`;

  }).join('');

}



function equityDefaultPlayerLabel(playerIndex) {
  return playerIndex === 0 ? t('Hero') : t('Player {number}', { number: playerIndex + 1 });
}

function equityPlayerLabel(playerIndex) {
  const customName = String(app.equity.players[playerIndex]?.name || '').trim();
  return customName || equityDefaultPlayerLabel(playerIndex);
}

function escapeEquityMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

const EQUITY_MADE_HAND_TRANSLATION_KEYS = Object.freeze({
  high_card: 'analysis.value.highCard',
  one_pair: 'analysis.value.onePair',
  two_pair: 'analysis.value.twoPair',
  three_of_a_kind: 'analysis.value.threeOfAKind',
  straight: 'analysis.value.straight',
  flush: 'analysis.value.flush',
  full_house: 'analysis.value.fullHouse',
  four_of_a_kind: 'analysis.value.fourOfAKind',
  straight_flush: 'analysis.value.straightFlush'
});

const EQUITY_FACT_TRANSLATION_KEYS = Object.freeze({
  board_pair: 'analysis.value.boardPair',
  overpair: 'analysis.value.overpair',
  pocket_pair: 'analysis.value.pocketPair',
  pairs_board_rank: 'analysis.value.pairsBoardRank',
  top_pair: 'analysis.value.topPair',
  middle_pair: 'analysis.value.middlePair',
  lower_pair: 'analysis.value.lowerPair',
  board_two_pair: 'analysis.value.boardTwoPair',
  set: 'analysis.value.set',
  trips: 'analysis.value.trips',
  board_trips: 'analysis.value.boardTrips',
  plays_board: 'analysis.value.playsBoard',
  rainbow: 'analysis.value.rainbow',
  two_tone: 'analysis.value.twoTone',
  monotone: 'analysis.value.monotone',
  multi_suit: 'analysis.value.multiSuit',
  connected: 'analysis.value.connected',
  coordinated: 'analysis.value.coordinated',
  disconnected: 'analysis.value.disconnected',
  three_flush: 'analysis.value.threeFlush',
  four_flush: 'analysis.value.fourFlush',
  board_flush: 'analysis.value.boardFlush',
  none: 'analysis.value.flushStateNone'
});

function equityFactLabel(value) {
  const key = EQUITY_FACT_TRANSLATION_KEYS[value];
  return key ? t(key) : String(value || '').replaceAll('_', ' ');
}

function equityRankLabel(value) {
  const ranks = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  return displayCardRank(ranks[value] || String(value || ''));
}

function equityRankPluralLabel(value) {
  const ranks = {
    14: 'Aces', 13: 'Kings', 12: 'Queens', 11: 'Jacks', 10: 'Tens', 9: 'Nines',
    8: 'Eights', 7: 'Sevens', 6: 'Sixes', 5: 'Fives', 4: 'Fours', 3: 'Threes', 2: 'Twos'
  };
  return t(ranks[value] || equityRankLabel(value));
}

function equityMadeHandLabel(exactHand) {
  if (exactHand?.street === 'preflop' && exactHand.preflopHandClass) {
    const kindKeys = {
      pair: 'analysis.value.pocketPair',
      suited: 'analysis.value.suitedHand',
      offsuit: 'analysis.value.offsuitHand'
    };
    return `${exactHand.preflopHandClass} · ${t(kindKeys[exactHand.preflopKind])}`;
  }
  const key = EQUITY_MADE_HAND_TRANSLATION_KEYS[exactHand?.primaryCategory];
  if (!key) return null;
  if (exactHand.primaryCategory === 'straight_flush' && exactHand.madeHandSubtype === 'royal') {
    return t('analysis.value.royalFlush');
  }
  if (exactHand.primaryCategory === 'straight' && exactHand.madeHandSubtype === 'wheel') {
    return t('analysis.value.wheelStraight');
  }
  if (exactHand.primaryCategory === 'straight' && exactHand.madeHandSubtype === 'broadway') {
    return t('analysis.value.broadwayStraight');
  }
  if (exactHand.primaryCategory === 'straight_flush' && exactHand.madeHandSubtype === 'wheel') {
    return t('analysis.value.wheelStraightFlush');
  }
  if (['straight', 'flush', 'straight_flush'].includes(exactHand.primaryCategory)
    && Number.isInteger(exactHand.canonicalRank?.tiebreakers?.[0])) {
    return t('{rank}-high {hand}', {
      rank: equityRankLabel(exactHand.canonicalRank.tiebreakers[0]),
      hand: t(key)
    });
  }
  const category = t(key);
  const relationship = exactHand.relationship && exactHand.relationship !== exactHand.primaryCategory
    ? equityFactLabel(exactHand.relationship) : null;
  const tiebreakers = exactHand.canonicalRank?.tiebreakers || [];
  const structure = exactHand.primaryCategory === 'four_of_a_kind'
    ? equityRankPluralLabel(tiebreakers[0])
    : exactHand.primaryCategory === 'full_house'
      ? t('{trips} full of {pair}', { trips: equityRankPluralLabel(tiebreakers[0]), pair: equityRankPluralLabel(tiebreakers[1]) })
      : exactHand.primaryCategory === 'three_of_a_kind'
        ? equityRankPluralLabel(tiebreakers[0])
        : exactHand.primaryCategory === 'two_pair'
          ? t('{first} and {second}', { first: equityRankPluralLabel(tiebreakers[0]), second: equityRankPluralLabel(tiebreakers[1]) })
          : exactHand.primaryCategory === 'one_pair'
            ? equityRankPluralLabel(tiebreakers[0]) : null;
  return [category, structure, relationship].filter(Boolean).join(' — ');
}

function equityStraightDrawLabel(subtype) {
  const keys = {
    gutshot: 'analysis.value.gutshot',
    open_ended: 'analysis.value.openEndedDraw',
    double_gutshot: 'analysis.value.doubleGutshot'
  };
  return t(keys[subtype] || 'analysis.outs.straight');
}

function equityStructuralOutsMarkup(playerProjection) {
  const facts = playerProjection?.facts;
  const drawOuts = facts?.exactHand?.drawOuts;
  if (!drawOuts?.available || !['flop', 'turn'].includes(drawOuts.street)
    || drawOuts.semantics !== 'structural_direct_improvement_cards') return '';
  const families = [
    { key: 'flush', label: t('analysis.value.flushDraw'), fact: drawOuts.flush },
    { key: 'straight', label: equityStraightDrawLabel(drawOuts.straight?.subtype), fact: drawOuts.straight },
    { key: 'straight-flush', label: t('analysis.value.straightFlushDraw'), fact: drawOuts.straightFlush }
  ].filter(({ fact }) => fact?.available && fact.count > 0);
  if (!families.length) return '';

  const familyMarkup = families.map(({ key, label, fact }) => `
    <div class="equity-direct-fact" data-direct-family="${key}"><span>${escapeEquityMarkup(label)}</span><strong>${fact.count === 1 ? t('1 direct card') : t('{count} direct cards', { count: fact.count })}</strong></div>`).join('');
  const detailMarkup = `<details class="equity-direct-details" data-equity-disclosure="structural" data-player-id="${playerProjection.id}"><summary>${t('Exact structural completion cards')}</summary><div data-equity-lazy-detail></div></details>`;

  return `
    <section class="equity-dossier-section equity-outs" data-range-analysis-schema="${facts.schemaVersion}" data-direct-semantics="${drawOuts.semantics}">
      <h3>${t('Structural draws / completions')}</h3>
      <div class="equity-direct-summary">
        ${familyMarkup}
        <div class="equity-direct-fact equity-direct-fact--unique"><span>${t('Unique direct completion cards')}</span><strong>${drawOuts.uniqueCompletionCardCount}</strong></div>
      </div>
      <p class="equity-direct-note">${t('Structural direct completions — not guaranteed winning outs')}</p>
      ${detailMarkup}
    </section>`;
}

function equityCurrentHandMarkup(playerProjection) {
  const cards = playerProjection?.cards;
  const facts = playerProjection?.facts;
  if (cards === null) {
    return `<section class="equity-dossier-section" data-dossier-section="current-hand"><h3>${t('Current hand')}</h3><p class="muted">${t('Exact hand facts are unavailable for an unknown hand.')}</p></section>`;
  }
  if (cards.length !== 2) {
    return `<section class="equity-dossier-section" data-dossier-section="current-hand"><h3>${t('Current hand')}</h3><p class="muted">${t('Choose two known cards to inspect this player.')}</p></section>`;
  }
  const exactHand = facts?.exactHand;
  if (!exactHand?.available) {
    return `<section class="equity-dossier-section" data-dossier-section="current-hand"><h3>${t('Current hand')}</h3><div class="equity-dossier-cards">${equityReadOnlyCardsMarkup(cards, t('Player cards'))}</div><p class="muted">${t('Complete the flop to inspect postflop hand facts.')}</p></section>`;
  }
  const madeHand = equityMadeHandLabel(exactHand);
  const bestFive = playerProjection.bestFivePresentationCards || [];
  const contribution = exactHand.street === 'preflop'
    ? ''
    : `<div class="equity-fact-row"><span>${t('Private cards contribute')}</span><strong>${t(exactHand.usesHeroCards ? 'Yes' : 'No')}</strong></div>`;
  const overcards = exactHand.draws?.overcardCount > 0
    ? `<div class="equity-fact-row"><span>${t('analysis.value.overcardsShort')}</span><strong>${exactHand.draws.overcardCount}</strong></div>` : '';
  return `<section class="equity-dossier-section equity-current-hand" data-dossier-section="current-hand" data-street="${exactHand.street}">
    <h3>${t('Current hand')}</h3>
    <div class="equity-current-hand-title"><strong>${escapeEquityMarkup(madeHand || t('Unavailable'))}</strong><span>${equityReadOnlyCardsMarkup(cards, t('Player cards'))}</span></div>
    ${bestFive.length ? `<details class="equity-best-five" data-equity-disclosure="best-five" data-player-id="${playerProjection.id}"><summary>${t('Best five')}</summary><div data-equity-lazy-detail></div></details>` : ''}
    <div class="equity-fact-list">${contribution}${overcards}${exactHand.draws?.madeHandAndDraw ? `<div class="equity-fact-row"><span>${t('Made hand + draw')}</span><strong>${t('Yes')}</strong></div>` : ''}</div>
  </section>`;
}

function equityBoardAnalysisMarkup(projection) {
  const board = projection?.globalFacts?.board;
  if (!board?.available) return '';
  const pairing = board.quads ? t('Four of a kind') : board.tripled ? t('Trips') : board.doublePaired ? t('Double paired') : board.paired ? t('Paired') : t('Unpaired');
  return `<section class="equity-dossier-section equity-board-analysis" data-dossier-section="board-analysis">
    <div class="equity-board-analysis-heading"><h3>${t('Board Analysis')}</h3>${equityReadOnlyCardsMarkup(projection.board, t('Board'))}</div>
    <div class="equity-board-analysis-facts">
      <div><span>${t('Pairing')}</span><strong>${pairing}</strong></div>
      <div><span>${t('Suit texture')}</span><strong>${t(EQUITY_FACT_TRANSLATION_KEYS[board.suitTexture])}</strong></div>
      <div><span>${t('Connectivity')}</span><strong>${t(EQUITY_FACT_TRANSLATION_KEYS[board.connectivity])}</strong></div>
    </div>
  </section>`;
}

function equityBoardTechnicalMarkup(facts) {
  const board = facts?.board;
  if (!board?.available) return '';
  const straightRanks = board.straightCompletionRanks?.length
    ? board.straightCompletionRanks.map(equityRankLabel).join(', ') : t('None');
  return `<section class="equity-technical-board" data-dossier-section="board-technical">
    <h3>${t('Board technical facts')}</h3>
    <div class="equity-fact-list">
      <div class="equity-fact-row"><span>${t('Flush state')}</span><strong>${t(EQUITY_FACT_TRANSLATION_KEYS[board.flushCompletionState])}</strong></div>
      <div class="equity-fact-row"><span>${t('Board straight completion ranks')}</span><strong class="poker-data-token">${straightRanks}</strong></div>
    </div>
  </section>`;
}

function equityCardRemovalMarkup(facts) {
  if (facts?.blockers?.heroCards?.length !== 2) return '';
  return `<details class="equity-dossier-section equity-card-removal" data-dossier-section="card-removal">
    <summary><span>${t('Card removal')}</span><strong>${t('{count} raw combos removed', { count: facts.blockers.rawCombosRemovedByHeroCards })}</strong></summary>
    <div class="equity-fact-list">${facts.blockers.heroCardEffects.map((effect) => `<div class="equity-fact-row"><span class="poker-data-token">${displayCard(effect.card)}</span><strong>${t('{count} containing combos', { count: effect.rawComboCountContainingCard })}</strong></div>`).join('')}</div>
    <p class="muted">${t('Raw structural card removal only — no range or strategy meaning.')}</p>
  </details>`;
}

function equityEvidenceFactsMarkup(facts) {
  if (!facts) return `<p class="muted">${t('Structural analysis service unavailable.')}</p>`;
  return `<details class="equity-provenance-details">
    <summary>${t('Fact sources and limitations')}</summary>
    <div class="equity-fact-list">
      <div class="equity-fact-row"><span>${t('Exact hand')}</span><strong>${escapeEquityMarkup(t(facts.provenance.exactHand.label))}</strong></div>
      <div class="equity-fact-row"><span>${t('Board')}</span><strong>${escapeEquityMarkup(t(facts.provenance.board.label))}</strong></div>
      <div class="equity-fact-row"><span>${t('Dead Cards')}</span><strong>${escapeEquityMarkup(t(facts.provenance.deadCards.label))}</strong></div>
    </div>
    <p class="muted">${t('Structural hand and board facts only. No weighted range is supplied. Direct completions are not Equity or guaranteed winning outs.')}</p>
  </details>`;
}

function equityOutcomeGroupMarkup(label, group, playerId, outcomeKind) {
  if (!group?.count) return '';
  const summaries = group.groups.map(({ resultCategory, count }) => `<div class="equity-direct-fact"><span>${escapeEquityMarkup(t(EQUITY_MADE_HAND_TRANSLATION_KEYS[resultCategory] || resultCategory))}</span><strong>${count === 1 ? t('1 card') : t('{count} cards', { count })}</strong></div>`).join('');
  return `<div class="equity-outcome-group"><h4>${label}</h4>${summaries}<details class="equity-direct-details" data-equity-disclosure="outcome" data-outcome-kind="${outcomeKind}" data-player-id="${playerId}"><summary>${t('Exact cards')}</summary><div data-equity-lazy-detail></div></details></div>`;
}

function equityExactOutcomeMarkup(playerProjection, exactOutcomes) {
  if (playerProjection.cards === null) return '';
  if (!exactOutcomes?.available) {
    if (exactOutcomes?.reason !== 'unknown_opponent') return '';
    return `<section class="equity-dossier-section equity-entered-outcomes" data-outcome-state="unknown"><div class="equity-unknown-outcome"><strong>${t('Opponent unknown')}</strong><span>${t('Exact catch-up analysis unavailable')}</span></div></section>`;
  }
  const outcome = exactOutcomes.players.find(({ id }) => id === playerProjection.id);
  if (!outcome) return '';
  const standing = outcome.currentStanding === 'leading' ? t('Leading')
    : outcome.currentStanding === 'tied' ? t('Tied') : t('Behind');
  const winningLabel = outcome.currentStanding === 'tied' ? t('Cards that put this player ahead') : t('Catch-up cards');
  const winning = equityOutcomeGroupMarkup(winningLabel, outcome.winningOuts, playerProjection.id, 'winningOuts');
  const ties = equityOutcomeGroupMarkup(t('Tie cards'), outcome.tieOuts, playerProjection.id, 'tieOuts');
  const stillBehind = equityOutcomeGroupMarkup(t('Other improvements — still behind'), outcome.structuralImprovementsStillBehind, playerProjection.id, 'structuralImprovementsStillBehind');
  const leadingCopy = exactOutcomes.nextCardAvailable && outcome.currentStanding === 'leading' ? `<div class="equity-outcome-empty">${t('No catch-up needed')}</div>` : '';
  const noCatchUp = exactOutcomes.nextCardAvailable && outcome.currentStanding !== 'leading' && !outcome.winningOuts.count
    ? `<div class="equity-outcome-empty">${t('No next card puts this player strictly ahead of every entered exact opponent.')}</div>` : '';
  const hasNextCardClaims = outcome.winningOuts.count || outcome.tieOuts.count || outcome.structuralImprovementsStillBehind.count;
  const scope = hasNextCardClaims && exactOutcomes.nextCardMeaning === 'ahead_after_next_card_not_guaranteed_final_pot'
    ? t('Catch-up cards: ahead after this turn card; River remains.')
    : hasNextCardClaims && exactOutcomes.nextCardMeaning === 'final_one_card_runout'
      ? t('River cards that win at showdown.') : '';
  return `<section class="equity-dossier-section equity-entered-outcomes" data-outcome-state="${outcome.currentStanding}">
    <div class="equity-status-row"><span>${t('Status')}</span><strong class="equity-standing" data-standing="${outcome.currentStanding}">${standing}</strong></div>${leadingCopy}${noCatchUp}${winning}${ties}${stillBehind}${scope ? `<p class="equity-direct-note">${scope}</p>` : ''}
  </section>`;
}

function equityProjectionLabel(playerId) {
  const labels = app.equity.lifecycle === 'complete' ? app.equity.lastAnalysisLabels : app.equity.staleAnalysisLabels;
  if (labels?.[playerId]) return labels[playerId];
  const index = app.equity.players.findIndex((player) => player.id === playerId);
  return index >= 0 ? equityPlayerLabel(index) : playerId;
}

function equityAnalysisResultForPlayer(playerId) {
  const result = app.equity.lifecycle === 'complete' ? app.equity.lastResult : app.equity.staleResult;
  return result?.players?.find((player) => player.id === playerId) || null;
}

function equityAnalysisEquityMarkup(playerId) {
  const result = equityAnalysisResultForPlayer(playerId);
  if (!result) return '';
  const equityPercent = Math.max(0, Math.min(100, result.equity * 100));
  const equityLabel = `${equityPercent.toFixed(1)}%`;
  return `<span class="equity-analysis-equity"><span>${t('Equity')}</span><strong class="poker-data-token">${equityLabel}</strong><span class="equity-analysis-bar" aria-hidden="true"><span style="--equity-percent: ${equityPercent.toFixed(3)}%"></span></span></span>`;
}

function equityAnalysisSecondaryMetricsMarkup(playerId) {
  const result = equityAnalysisResultForPlayer(playerId);
  if (!result) return '';
  return `<div class="equity-analysis-secondary-metrics" aria-label="${escapeEquityMarkup(t('Win and tie probabilities'))}">
    <div><span>${t('Win')}</span><strong class="poker-data-token">${(result.winProbability * 100).toFixed(1)}%</strong></div>
    <div><span>${t('Tie')}</span><strong class="poker-data-token">${(result.tieProbability * 100).toFixed(1)}%</strong></div>
  </div>`;
}

function equityPlayerAnalysisBody(playerProjection, projection) {
  return [
    equityAnalysisSecondaryMetricsMarkup(playerProjection.id),
    equityCurrentHandMarkup(playerProjection),
    equityExactOutcomeMarkup(playerProjection, projection.exactOutcomes),
    equityStructuralOutsMarkup(playerProjection)
  ].filter(Boolean).join('');
}

function equityPlayerAnalysisMarkup(playerProjection, playerIndex, projection, collapsePlayers) {
  const label = equityProjectionLabel(playerProjection.id);
  const body = collapsePlayers ? '' : equityPlayerAnalysisBody(playerProjection, projection);
  const heading = `<span class="equity-player-analysis-title"><i class="series-marker" aria-hidden="true"></i><strong>${escapeEquityMarkup(label)}</strong></span>${equityAnalysisEquityMarkup(playerProjection.id)}`;
  return collapsePlayers
    ? `<details class="equity-player-analysis" data-equity-disclosure="player" data-player-id="${playerProjection.id}" data-player-series="${playerIndex}"><summary>${heading}</summary><div data-equity-lazy-detail></div></details>`
    : `<section class="equity-player-analysis" data-player-id="${playerProjection.id}" data-player-series="${playerIndex}" aria-labelledby="equityAnalysisPlayer-${playerProjection.id}"><h3 id="equityAnalysisPlayer-${playerProjection.id}">${heading}</h3>${body}</section>`;
}

function equityAnalysisEmptyMarkup() {
  return `<section class="equity-dossier-section equity-analysis-empty"><h3>${t('Hand Analysis')}</h3><p class="muted">${t('Calculate Equity to inspect entered-hand outcomes and detailed hand facts.')}</p></section>`;
}

function equityAnalysisProjection() {
  return app.equity.lifecycle === 'complete' ? app.equity.lastAnalysis : app.equity.staleAnalysis;
}

function equityLazyDisclosureMarkup(details, projection) {
  const player = projection?.players.find(({ id }) => id === details.dataset.playerId);
  if (!player) return '';
  const disclosure = details.dataset.equityDisclosure;
  if (disclosure === 'player') return equityPlayerAnalysisBody(player, projection);
  if (disclosure === 'best-five') return equityReadOnlyCardsMarkup(player.bestFivePresentationCards, t('Best five'));
  if (disclosure === 'structural') {
    const drawOuts = player.facts?.exactHand?.drawOuts;
    const families = [
      ['flush', t('analysis.value.flushDraw'), drawOuts?.flush],
      ['straight', equityStraightDrawLabel(drawOuts?.straight?.subtype), drawOuts?.straight],
      ['straight-flush', t('analysis.value.straightFlushDraw'), drawOuts?.straightFlush]
    ].filter(([, , fact]) => fact?.available && fact.count > 0);
    return families.map(([key, label, fact]) => `<div class="equity-direct-card-row" data-direct-family="${key}"><span>${escapeEquityMarkup(label)}</span>${equityReadOnlyCardsMarkup(fact.completionCards, label)}</div>`).join('');
  }
  if (disclosure === 'outcome') {
    const outcome = projection.exactOutcomes?.players?.find(({ id }) => id === player.id);
    const family = outcome?.[details.dataset.outcomeKind];
    return family?.groups?.map(({ resultCategory, cards }) => {
      const label = t(EQUITY_MADE_HAND_TRANSLATION_KEYS[resultCategory] || resultCategory);
      return `<div class="equity-direct-card-row"><span>${escapeEquityMarkup(label)}</span>${equityReadOnlyCardsMarkup(cards, label)}</div>`;
    }).join('') || '';
  }
  return '';
}

function bindEquityAnalysisDisclosures(content) {
  if (!content || content.dataset.disclosureBound === 'true') return;
  content.dataset.disclosureBound = 'true';
  content.addEventListener('toggle', (event) => {
    const details = event.target.closest?.('details[data-equity-disclosure]');
    if (!details?.open) return;
    const target = details.querySelector(':scope > [data-equity-lazy-detail]');
    if (!target || target.dataset.rendered === 'true') return;
    target.innerHTML = equityLazyDisclosureMarkup(details, equityAnalysisProjection());
    target.dataset.rendered = 'true';
  }, true);
}

function equityDisclosureKey(details) {
  return [details.dataset.equityDisclosure, details.dataset.playerId, details.dataset.outcomeKind || ''].join('|');
}

function openEquityDisclosureKeys(content) {
  return [...(content?.querySelectorAll?.('details[data-equity-disclosure][open]') || [])]
    .map(equityDisclosureKey);
}

function restoreEquityDisclosureKeys(content, keys, projection) {
  const orderedKeys = [...keys].sort((left, right) => Number(!left.startsWith('player|')) - Number(!right.startsWith('player|')));
  orderedKeys.forEach((key) => {
    const details = [...content.querySelectorAll('details[data-equity-disclosure]')]
      .find((candidate) => equityDisclosureKey(candidate) === key);
    if (!details) return;
    details.open = true;
    const target = details.querySelector(':scope > [data-equity-lazy-detail]');
    if (target && target.dataset.rendered !== 'true') {
      target.innerHTML = equityLazyDisclosureMarkup(details, projection);
      target.dataset.rendered = 'true';
    }
  });
}

function renderEquityHandAnalysis() {
  const content = $('#equityHandAnalysisContent');
  const openDisclosures = openEquityDisclosureKeys(content);
  const projection = equityAnalysisProjection();
  const stale = app.equity.lifecycle !== 'complete' && Boolean(projection);
  const panel = $('#equityHandAnalysis');
  if (panel) panel.dataset.analysisState = projection ? (stale ? 'stale' : 'current') : 'setup';
  if (!projection) {
    if (content) content.innerHTML = equityAnalysisEmptyMarkup();
    if ($('#equityEvidenceFacts')) $('#equityEvidenceFacts').innerHTML = '';
    if ($('#equityFurtherAnalysisContent')) $('#equityFurtherAnalysisContent').innerHTML = '';
    if (document.querySelector('[data-future-analysis-home]')) document.querySelector('[data-future-analysis-home]').hidden = true;
    return;
  }
  const collapsePlayers = projection.players.length >= 5;
  if (content) {
    content.innerHTML = `${stale ? `<div class="equity-analysis-stale" role="status"><strong>${t('Analysis is out of date')}</strong><span>${t('Inputs changed. Recalculate to update these results.')}</span></div>` : ''}${[
      equityBoardAnalysisMarkup(projection),
      `<div class="equity-player-analysis-list" data-player-count="${projection.players.length}">${projection.players.map((player, playerIndex) => equityPlayerAnalysisMarkup(player, playerIndex, projection, collapsePlayers)).join('')}</div>`
    ].filter(Boolean).join('')}`;
    bindEquityAnalysisDisclosures(content);
    restoreEquityDisclosureKeys(content, openDisclosures, projection);
  }
  if ($('#equityEvidenceFacts')) $('#equityEvidenceFacts').innerHTML = equityEvidenceFactsMarkup(projection.globalFacts);
  const boardTechnical = equityBoardTechnicalMarkup(projection.globalFacts);
  const removal = projection.players.map((player) => {
    const markup = equityCardRemovalMarkup(player.facts);
    return markup ? `<section class="equity-technical-player"><h3>${escapeEquityMarkup(equityProjectionLabel(player.id))}</h3>${markup}</section>` : '';
  }).filter(Boolean).join('');
  const furtherAnalysis = boardTechnical + removal;
  if ($('#equityFurtherAnalysisContent')) $('#equityFurtherAnalysisContent').innerHTML = furtherAnalysis;
  if (document.querySelector('[data-future-analysis-home]')) document.querySelector('[data-future-analysis-home]').hidden = !furtherAnalysis;
}

function createEquityPlayer() {
  return {
    id: `equity-player-${app.equity.nextPlayerId++}`,
    name: '',
    cards: [],
    handMode: 'unknown'
  };
}

function equityPlayerResultMarkup(player, playerIndex) {
  const current = app.equity.lastResult?.players?.find(({ id }) => id === player.id);
  const stale = app.equity.staleResult?.players?.find(({ id }) => id === player.id);
  const complete = app.equity.lifecycle === 'complete' && current;
  const running = app.equity.lifecycle === 'running';
  const result = complete ? current : stale;
  const state = complete ? 'complete' : (result ? 'stale' : (running ? 'running' : 'setup'));
  const pendingValue = running ? '&hellip;' : '&mdash;';
  const equityValue = result ? `${(result.equity * 100).toFixed(1)}%` : pendingValue;
  const winValue = result ? `${(result.winProbability * 100).toFixed(1)}%` : pendingValue;
  const tieValue = result ? `${(result.tieProbability * 100).toFixed(1)}%` : pendingValue;
  const status = state === 'complete' ? t('Calculated')
    : state === 'running' ? t('Calculating…')
      : state === 'stale' ? t('Stale')
        : (player.handMode === 'unknown' ? t('Unknown hand') : t('{count} / 2 cards', { count: player.cards.filter(Boolean).length }));
  return `
    <footer class="equity-player-footer" data-result-state="${state}" aria-live="polite">
      <div class="equity-player-footer-state">${status}</div>
      <div class="equity-result-metrics" aria-label="${escapeEquityMarkup(t('{player} equity', { player: equityPlayerLabel(playerIndex) }))}">
        <div class="equity-result-primary"><span>${t('Equity')}</span><strong class="poker-data-token">${equityValue}</strong></div>
        <div><span>${t('Win')}</span><strong class="poker-data-token">${winValue}</strong></div>
        <div><span>${t('Tie')}</span><strong class="poker-data-token">${tieValue}</strong></div>
      </div>
    </footer>`;
}

function equityOverviewPlayerMarkup(player, playerIndex) {
  const result = app.equity.lastResult?.players?.find(({ id }) => id === player.id);
  if (app.equity.lifecycle !== 'complete' || !result) return '';
  const equityWidth = result.equity * 100;
  const label = equityPlayerLabel(playerIndex);
  const equityAriaLabel = escapeEquityMarkup(t('{player} equity', { player: label }));
  return `<div class="equity-overview-player" data-player-series="${playerIndex}">
    <span><i class="series-marker" aria-hidden="true"></i><strong>${escapeEquityMarkup(label)}</strong></span>
    <strong class="poker-data-token">${equityWidth.toFixed(1)}%</strong>
    <div class="eqbar" role="progressbar" aria-label="${equityAriaLabel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${equityWidth.toFixed(1)}"><div class="eqfill player-series" style="width:${equityWidth}%"></div></div>
  </div>`;
}

function syncEquityPlayerNamePresentation(playerIndex) {
  const player = app.equity.players[playerIndex];
  if (!player) return;
  const label = equityPlayerLabel(playerIndex);
  if (app.equity.lastAnalysisLabels?.[player.id]) app.equity.lastAnalysisLabels[player.id] = label;
  if (app.equity.staleAnalysisLabels?.[player.id]) app.equity.staleAnalysisLabels[player.id] = label;
  renderEquityComparison();
  document.querySelectorAll(`[data-player-id="${player.id}"] .equity-player-analysis-title strong, .equity-current-matchup [data-player-id="${player.id}"] span`).forEach((node) => {
    node.textContent = label;
  });
  const tile = document.querySelector(`#equityPlayers [data-player-id="${player.id}"]`);
  const labelControl = tile?.querySelector('[data-equity-player-name-label]');
  if (labelControl) {
    labelControl.textContent = label;
    labelControl.setAttribute('aria-label', t('{player} name', { player: label }));
  }
  tile?.querySelector('.equity-result-metrics')?.setAttribute('aria-label', t('{player} equity', { player: label }));
}

function finishEquityPlayerNameEdit(input, { cancel = false } = {}) {
  const playerId = input?.dataset.playerId;
  const playerIndex = app.equity.players.findIndex((candidate) => candidate.id === playerId);
  const player = app.equity.players[playerIndex];
  const editor = input?.closest('.equity-player-name-editor');
  const labelControl = editor?.querySelector('[data-equity-player-name-label]');
  if (!player || !editor || !labelControl || input.hidden) return;
  if (!cancel) {
    player.name = input.value.trim().slice(0, 40);
    syncEquityPlayerNamePresentation(playerIndex);
  }
  input.value = player.name;
  input.hidden = true;
  labelControl.hidden = false;
  labelControl.focus({ preventScroll: true });
}

function beginEquityPlayerNameEdit(labelControl) {
  const editor = labelControl?.closest('.equity-player-name-editor');
  const input = editor?.querySelector('[data-equity-player-name]');
  if (!input) return;
  labelControl.hidden = true;
  input.hidden = false;
  input.focus({ preventScroll: true });
  input.select();
}

function renderEquityComparison() {
  const root = $('#equityComparison');
  if (!root) return;
  root.dataset.playerCount = String(app.equity.players.length);
  root.innerHTML = app.equity.players
    .map((player, playerIndex) => equityOverviewPlayerMarkup(player, playerIndex))
    .join('');
}

function renderEquityPlayerResults() {
  document.querySelectorAll('#equityPlayers .equity-player-card').forEach((tile, playerIndex) => {
    const footer = tile.querySelector('.equity-player-footer');
    const player = app.equity.players[playerIndex];
    if (footer && player) footer.outerHTML = equityPlayerResultMarkup(player, playerIndex);
  });
  renderEquityComparison();
}

function setEquityPlayerCount(requestedCount) {
  const count = Math.max(2, Math.min(10, Number(requestedCount) || 2));
  while (app.equity.players.length < count) app.equity.players.push(createEquityPlayer());
  if (app.equity.players.length > count) app.equity.players.splice(count);
  setEquityPending({ renderInputs: 'players' });
}

function setEquityHandMode(playerId, handMode) {
  const player = app.equity.players.find((candidate) => candidate.id === playerId);
  if (!player || !['known', 'unknown'].includes(handMode)) return;
  if (app.picker?.group === equityHandGroup(player.id)) closePicker({ restoreFocus: false });
  player.handMode = handMode;
  if (handMode === 'unknown') player.cards = [];
  setEquityPending({ renderInputs: 'players' });
}

function equityHandEditorMarkup(player, playerIndex, label) {
  const cards = Array.from({ length: 2 }, (_, cardIndex) => {
    const card = player.cards[cardIndex];
    const state = card ? cardVisualState(equityHandGroup(player.id), card) : 'empty';
    const suitClass = card ? ` card--suit-${card[1]}` : '';
    const content = card ? cardMarkup(card) : '';
    return `<span class="card-slot card--${state}${card ? ' filled' : ''}${suitClass} riverline-card" data-card-state="${state}" data-card-size="standard"${card ? ` data-card-id="${card}"` : ''} aria-hidden="true">${content}</span>`;
  }).join('');
  return `<button type="button" class="equity-hand-editor" data-equity-edit-hand="${player.id}" aria-label="${escapeEquityMarkup(t('Edit {player} hand', { player: label }))}"><span class="equity-hand-editor-cards">${cards}</span><span class="equity-hand-editor-action">${t(player.cards.filter(Boolean).length ? 'Edit hand' : 'Choose hand')}</span></button>`;
}

function renderEquityPlayers() {
  const root = $('#equityPlayers');
  if (!root) return;
  root.dataset.playerCount = String(app.equity.players.length);

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
          <span class="equity-player-identity"><i class="series-marker" aria-hidden="true"></i><span class="equity-player-name-editor"><button type="button" class="equity-player-name-label" data-equity-player-name-label="${playerIndex}" aria-label="${escapeEquityMarkup(t('{player} name', { player: label }))}">${escapeEquityMarkup(label)}</button><input class="equity-player-name" data-equity-player-name="${playerIndex}" data-player-id="${player.id}" maxlength="40" value="${escapeEquityMarkup(player.name)}" placeholder="${escapeEquityMarkup(equityDefaultPlayerLabel(playerIndex))}" aria-label="${escapeEquityMarkup(t('{player} name', { player: label }))}" hidden></span><small>${status}</small></span>
          ${playerIndex > 1 ? `<button type="button" class="remove-player ui-button ui-button-ghost" data-remove-player="${playerIndex}" aria-label="${t('Remove {player}', { player: label })}">${t('Remove')}</button>` : ''}
        </header>
        <div class="equity-player-body">
          <div class="equity-hand-mode" role="group" aria-label="${t('{player} hand type', { player: label })}">
            <button type="button" data-equity-hand-mode="known" data-player-id="${player.id}" aria-pressed="${mode === 'known'}">${t('Known')}</button>
            <button type="button" data-equity-hand-mode="unknown" data-player-id="${player.id}" aria-pressed="${mode === 'unknown'}">${t('Unknown')}</button>
          </div>
          ${mode === 'known'
            ? equityHandEditorMarkup(player, playerIndex, label)
            : `<div class="equity-unknown-hand" aria-label="${t('{player} unknown cards', { player: label })}"><span class="poker-card-back riverline-card-back" data-card-size="standard" aria-hidden="true"></span><span class="poker-card-back riverline-card-back" data-card-size="standard" aria-hidden="true"></span><span>${t('Random legal hand')}</span></div>`}
        </div>
        <div class="equity-hand-message" id="equityHandMessage-${playerIndex}">${status}</div>
        ${equityPlayerResultMarkup(player, playerIndex)}
      </article>`;
  }).join('');

  const add = $('#equityAddPlayer');
  if (add) {
    const atMaximum = app.equity.players.length >= 10;
    const addLabel = atMaximum ? '10 player maximum' : '+ Add player';
    add.disabled = atMaximum;
    add.dataset.i18n = addLabel;
    add.textContent = t(addLabel);
    add.onclick = () => {
      if (app.equity.players.length >= 10) return;
      app.equity.players.push(createEquityPlayer());
      setEquityPending({ renderInputs: 'players' });
    };
  }

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
  root.querySelectorAll('[data-equity-player-name-label]').forEach((labelControl) => {
    labelControl.addEventListener('click', (event) => {
      event.stopPropagation();
      beginEquityPlayerNameEdit(labelControl);
    });
  });
  root.querySelectorAll('[data-equity-player-name]').forEach((input) => {
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        finishEquityPlayerNameEdit(input);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finishEquityPlayerNameEdit(input, { cancel: true });
      }
    });
    input.addEventListener('blur', () => finishEquityPlayerNameEdit(input));
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

function activeNavigationDestination() {
  const shell = $('.riverline-shell');
  return shell?.dataset.activeDestination || shell?.dataset.activeMode || 'home';
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

function renderEquityCardCounts() {
  const deckCount = $('#eqDeckCount');
  if (deckCount) deckCount.textContent = remainingCards('equity');
  const boardCount = $('#equityBoardCount');
  if (boardCount) boardCount.textContent = `${app.equity.board.filter(Boolean).length} / 5`;
  const deadCount = $('#equityDeadCount');
  if (deadCount) deadCount.textContent = String(app.equity.dead.filter(Boolean).length);
}

function renderEquitySharedCards() {
  renderSlots('eqboard', 5);
  renderSlots('eqdead', 52);
  renderEquityCardCounts();
}

function renderEquityCards() {
  renderEquitySharedCards();
  if (app.equity.players.length > 0) renderEquityPlayers();
}

function renderAllCards({ mode = activeWorkspaceMode() } = {}) {
  if (mode === 'gto') renderPlaybookCards();
  else if (mode === 'equity') renderEquityCards();
  else if (mode === 'training' && typeof renderTrainingCards === 'function') renderTrainingCards();
}

function openEquityHandPicker(playerId) {
  const player = app.equity.players.find((candidate) => candidate.id === playerId);
  if (!player || player.handMode !== 'known') return false;
  openPicker(equityHandGroup(player.id), 0);
  return true;
}

function privateHandOwnerLabel(group) {
  if (group === 'hero') return t('Hero');
  const equityPlayer = equityPlayerFromHandGroup(group);
  if (equityPlayer) return equityPlayerLabel(app.equity.players.indexOf(equityPlayer));
  if (group.startsWith('hand-seat-')) {
    const seat = Number(group.slice('hand-seat-'.length));
    const state = callPlaybookStateBridge('getState');
    const player = state?.players?.find((candidate) => candidate.seat === seat);
    return canonicalPlayerLabel(player, callPlaybookStateBridge('getHeroPlayerId'));
  }
  return t('Player hand');
}

function boardStreetCardSetDefinition(group, originIndex) {
  if (group === 'hand-board-chance') {
    const state = callPlaybookStateBridge('getState');
    const requiredCount = Math.max(1, Number(state?.pendingChance?.cardCount) || 1);
    const street = String(state?.pendingChance?.type || '').replace('deal_', '');
    const streetLabel = t(street ? street.charAt(0).toUpperCase() + street.slice(1) : 'Board');
    return {
      kind: requiredCount === 3 ? 'flop' : 'board_street',
      requiredCount,
      targetIndices: Array.from({ length: requiredCount }, (_, index) => index),
      title: t('Edit {street}', { street: streetLabel }),
      kindLabel: t('Board cards'),
      ownerLabel: streetLabel,
      selectionLabel: t('Selected cards')
    };
  }
  if (!['board', 'eqboard'].includes(group)) return null;
  if (originIndex <= 2) {
    return {
      kind: 'flop',
      requiredCount: 3,
      targetIndices: [0, 1, 2],
      title: t('Edit Flop'),
      kindLabel: t('Board cards'),
      ownerLabel: t('Flop'),
      selectionLabel: t('Selected flop')
    };
  }
  const streetLabel = t(originIndex === 3 ? 'Turn' : 'River');
  return {
    kind: 'board_street',
    requiredCount: 1,
    targetIndices: [originIndex],
    title: t('Edit {street}', { street: streetLabel }),
    kindLabel: t('Board card'),
    ownerLabel: streetLabel,
    selectionLabel: t('Selected card')
  };
}

function cardSetPickerDefinition(group, originIndex) {
  const cards = groupCards(group);
  const privateHand = isPrivateHandCardSetGroup(group);
  if (privateHand) {
    const ownerLabel = privateHandOwnerLabel(group);
    return {
      kind: 'private_hand',
      requiredCount: 2,
      targetIndices: [0, 1],
      title: t('Edit {player} hand', { player: ownerLabel }),
      kindLabel: t('Player hand'),
      ownerLabel,
      selectionLabel: t('Selected hand'),
      committed: cards.slice(0, 2).filter(Boolean)
    };
  }
  const boardDefinition = boardStreetCardSetDefinition(group, originIndex);
  if (boardDefinition) {
    return {
      ...boardDefinition,
      committed: boardDefinition.targetIndices.map((index) => cards[index]).filter(Boolean)
    };
  }
  const deadCard = group.includes('dead');
  return {
    kind: deadCard ? 'dead_card' : 'single_card',
    requiredCount: 1,
    targetIndices: [originIndex],
    title: t(deadCard ? 'Choose a dead card' : 'Choose a card'),
    kindLabel: t(deadCard ? 'Dead card' : 'Card'),
    ownerLabel: '',
    selectionLabel: t('Selected card'),
    committed: cards[originIndex] ? [cards[originIndex]] : []
  };
}

function renderCardSetPickerContext() {
  const context = $('#cardSetPickerContext');
  const picker = app.picker;
  if (!context) return;
  context.hidden = !picker;
  if (!picker) return;
  if ($('#cardSetPickerKind')) $('#cardSetPickerKind').textContent = picker.ownerLabel ? picker.kindLabel : '';
  if ($('#cardSetPickerOwner')) $('#cardSetPickerOwner').textContent = picker.ownerLabel || picker.kindLabel;
  if ($('#cardSetPickerLabel')) $('#cardSetPickerLabel').textContent = picker.selectionLabel;
  if ($('#cardSetPickerCount')) $('#cardSetPickerCount').textContent = t('{selected} / {required} selected', {
    selected: picker.draft.length,
    required: picker.requiredCount
  });
  const cards = $('#cardSetPickerCards');
  if (cards) {
    cards.setAttribute('aria-label', picker.selectionLabel);
    cards.innerHTML = Array.from({ length: picker.requiredCount }, (_, index) => {
      const card = picker.draft[index];
      if (!card) {
        return '<span class="card-set-picker-card card-set-picker-card--empty card-slot card--empty riverline-card" data-card-state="empty" data-card-size="standard" aria-hidden="true"></span>';
      }
      return `<button type="button" class="card-set-picker-card card-slot card--known filled card--suit-${card[1]} riverline-card" data-card-state="known" data-card-size="standard" data-card-set-preview-card="${card}" aria-label="${escapeEquityMarkup(t('Deselect {card}', { card: displayCard(card) }))}">${cardMarkup(card)}</button>`;
    }).join('');
  }
  const clear = $('#cardSetPickerClear');
  if (clear) {
    clear.hidden = picker.kind !== 'private_hand';
    clear.disabled = picker.draft.length === 0;
  }
  const apply = $('#cardSetPickerApply');
  if (apply) apply.disabled = picker.draft.length !== picker.requiredCount;
}



function openPicker(group, index) {

  if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
    return toast('These cards come from the canonical hand in Hand mode.', 'warning');
  }

  if (group.startsWith('training')) {
    return toast('Training cards come from the canonical generated hand.', 'warning');
  }

  const originIndex = Number.isInteger(Number(index)) ? Number(index) : 0;
  const definition = cardSetPickerDefinition(group, originIndex);
  app.picker = {
    group,
    originIndex,
    ...definition,
    committed: definition.committed.slice(),
    draft: definition.committed.slice()
  };
  if (group === 'hand-board-chance') {
    const canonicalAvailable = callPlaybookStateBridge('getAvailableChanceCards', []);
    if (Array.isArray(canonicalAvailable)) {
      const available = new Set(canonicalAvailable);
      const legalCommitted = app.picker.committed.filter((card) => available.has(card));
      if (legalCommitted.length !== app.picker.committed.length) {
        groupCards(group).splice(0, groupCards(group).length, ...legalCommitted);
        app.picker.committed = legalCommitted.slice();
        app.picker.draft = legalCommitted.slice();
      }
    }
  }

  const modalTitle = $('#modalTitle');
  if (modalTitle) modalTitle.textContent = definition.title;

  const modalCopy = $('#modalCopy');
  if (modalCopy) modalCopy.textContent = group.includes('dead')
    ? t('Choose a card known to be out of play, then Apply.')
    : t('Select or deselect cards, then Apply. Cards committed elsewhere are unavailable.');

  const burnControl = $('#burnControl');

  if (burnControl) burnControl.style.display = group === 'dead' || group === 'eqdead' ? 'flex' : 'none';

  const markBurn = $('#markBurn');

  if (markBurn) markBurn.checked = group === 'dead' || group === 'eqdead';

  renderCardSetPickerContext();

  renderDeck();

  const cardModal = $('#cardModal');

  window.RiverlineTutorials?.cancelForOverlay?.('card-picker');
  if (cardModal) cardModal.classList.add('show');

  const deck = $('#deck');
  const pickerFocusTarget = deck?.querySelector?.(
    app.picker.draft[0] ? `[data-deck-card="${app.picker.draft[0]}"]` : 'button:not([disabled])'
  ) || $('#closeModal');
  pickerFocusTarget?.focus?.({ preventScroll: true });

}



function renderDeck() {

  const { draft } = app.picker;
  const unavailable = unavailableCardsForPicker(app.picker);

  const deck = $('#deck');

  if (deck) {
    deck.innerHTML = SUITS.map((suit) => {
      const cards = RANKS.map((rank) => {
        const card = rank + suit.id;
        const isSelected = draft.includes(card);
        const isUnavailable = !isSelected && unavailable.has(card);
        const visualRank = displayCardRank(rank);
        const accessibleCard = `${visualRank}${suit.symbol}`;
        const accessibleLabel = isSelected
          ? t('Deselect {card}', { card: accessibleCard })
          : isUnavailable
            ? t('{card}, unavailable', { card: accessibleCard })
            : t('Select {card}', { card: accessibleCard });
        return `<button type="button" class="deck-card card--suit-${suit.id}${isSelected ? ' is-selected' : ''} riverline-card" data-card-size="picker" aria-label="${accessibleLabel}" aria-pressed="${isSelected}" data-suit="${suit.id}" data-rank="${rank}" data-deck-card="${card}" ${isUnavailable ? 'disabled' : ''}>${globalThis.RiverlineCardPresentation.cardFaceMarkup({ rank, suit: suit.id, rankStyle: app.settings.cardRankStyle })}</button>`;
      }).join('');
      return `<div class="deck-suit-row" data-picker-suit="${suit.id}"><div class="deck-suit-label s-${suit.id}" aria-hidden="true">${suit.symbol}</div><div class="deck-ranks">${cards}</div></div>`;
    }).join('');
  }

}



function updateDeckCardStates(changedCards) {
  const picker = app.picker;
  const deck = $('#deck');
  if (!picker || !deck || !Array.isArray(changedCards) || changedCards.length === 0) return;

  const unavailable = unavailableCardsForPicker(picker);
  const controls = changedCards
    .map((card) => document.querySelector(`[data-deck-card="${card}"]`))
    .filter(Boolean);
  controls.forEach((control) => {
    const card = control.dataset.deckCard;
    const isSelected = picker.draft.includes(card);
    const isUnavailable = !isSelected && unavailable.has(card);
    const suit = getSuit(card);
    const accessibleCard = `${displayCardRank(card[0])}${suit?.symbol || ''}`;
    const accessibleLabel = isSelected
      ? t('Deselect {card}', { card: accessibleCard })
      : isUnavailable
        ? t('{card}, unavailable', { card: accessibleCard })
        : t('Select {card}', { card: accessibleCard });

    control.classList.toggle('is-selected', isSelected);
    control.disabled = isUnavailable;
    control.setAttribute('aria-pressed', String(isSelected));
    control.setAttribute('aria-label', accessibleLabel);
  });
}



function cardSetPickerScope(group) {
  return group.startsWith('hand-') ? 'hand'
    : group.startsWith('training') ? 'training'
      : isEquityGroup(group) ? 'equity' : 'gto';
}

function unavailableCardsForPicker(picker) {
  if (picker.group === 'hand-board-chance') {
    const canonicalAvailable = callPlaybookStateBridge(
      'getAvailableChanceCards',
      picker.draft.slice()
    );
    if (Array.isArray(canonicalAvailable)) {
      const allowed = new Set([...canonicalAvailable, ...picker.draft]);
      return new Set(RANKS.flatMap((rank) => (
        SUITS.map((suit) => rank + suit.id)
      )).filter((card) => !allowed.has(card)));
    }
  }
  const used = usedCards(cardSetPickerScope(picker.group)).slice();
  picker.committed.forEach((card) => {
    const ownCardIndex = used.indexOf(card);
    if (ownCardIndex >= 0) used.splice(ownCardIndex, 1);
  });
  return new Set(used);
}



function firstEmptyIndex(cards, limit) {
  for (let index = 0; index < limit; index += 1) if (!cards[index]) return index;
  return -1;
}



function selectCard(card) {
  const picker = app.picker;
  if (!picker) return false;
  const { group } = picker;

  if (isHandMode() && PLAYBOOK_DECISION_CARD_GROUPS.includes(group)) {
    closePicker();
    return toast('These cards come from the canonical hand in Hand mode.', 'warning');
  }


  if (group.startsWith('training')) {
    closePicker();
    return toast('Training cards come from the canonical generated hand.', 'warning');
  }
  const selectedIndex = picker.draft.indexOf(card);
  if (selectedIndex >= 0) picker.draft.splice(selectedIndex, 1);
  else {
    const unavailable = unavailableCardsForPicker(picker);
    if (unavailable.has(card)) return false;
    if (picker.draft.length >= picker.requiredCount) {
      toast(t('Deselect a card before choosing another.'), 'warning');
      return false;
    }
    picker.draft.push(card);
  }
  renderCardSetPickerContext();
  updateDeckCardStates([card]);
  const selectedControl = document.querySelector(`[data-deck-card="${card}"]`);
  if (selectedControl && document.activeElement !== selectedControl) selectedControl.focus?.({ preventScroll: true });
  return true;
}

function cardSetPickerFocusTarget(picker) {
  if (!picker) return null;
  const equityPlayer = equityPlayerFromHandGroup(picker.group);
  if (equityPlayer) return document.querySelector(`[data-equity-edit-hand="${equityPlayer.id}"]`);
  if (isPrivateHandCardSetGroup(picker.group)) {
    return document.querySelector(`[data-card-set-edit="${picker.group}"]`);
  }
  return document.querySelector(`[data-slots="${picker.group}"] [data-index="${picker.originIndex}"]`);
}

function replaceCardSetTarget(picker, cards) {
  const target = groupCards(picker.group);
  if (picker.kind === 'private_hand' || picker.group === 'hand-board-chance') {
    target.splice(0, target.length, ...cards);
    return;
  }
  const next = target.slice();
  picker.targetIndices.forEach((targetIndex, draftIndex) => {
    next[targetIndex] = cards[draftIndex];
  });
  target.splice(0, target.length, ...next);
}

function renderCommittedCardSet(picker) {
  if (picker.group === 'hero') app.selectedHand = null;
  if (isEquityGroup(picker.group)) {
    setEquityPending({ renderInputs: equityPlayerFromHandGroup(picker.group) ? 'players' : 'shared' });
  } else if (picker.group.startsWith('hand-')) renderCanonicalHandWorkspace();
  else {
    renderAllCards();
    updateContext('Cards changed');
  }
}

function finishCardSetCommit(picker) {
  closePicker({ restoreFocus: false });
  renderCommittedCardSet(picker);
  const focusTarget = cardSetPickerFocusTarget(picker);
  focusTarget?.classList?.add('is-card-dealt');
  focusTarget?.focus?.({ preventScroll: true });
}

function applyCardSetPicker() {
  const picker = app.picker;
  if (!picker || picker.draft.length !== picker.requiredCount) return false;
  replaceCardSetTarget(picker, picker.draft.slice());
  finishCardSetCommit(picker);
  return true;
}

function clearPrivateHandPicker() {
  const picker = app.picker;
  if (!picker || picker.kind !== 'private_hand') return false;
  const changedCards = picker.draft.slice();
  picker.draft = [];
  renderCardSetPickerContext();
  updateDeckCardStates(changedCards);
  $('#deck')?.querySelector?.('button:not([disabled])')?.focus?.({ preventScroll: true });
  return true;
}



function cardPickerFocusableElements() {
  return $$('#cardModal button:not([disabled]), #cardModal input:not([disabled])')
    .filter((element) => (
      !element.hidden
      && element.getAttribute('aria-hidden') !== 'true'
      && element.getClientRects().length > 0
    ));
}



function handleCardPickerKeydown(event) {
  if (!$('#cardModal')?.classList.contains('show')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closePicker();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = cardPickerFocusableElements();
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
}



function closePicker(options) {

  const restoreFocus = options?.restoreFocus !== false;

  const picker = app.picker;

  const focusTarget = cardSetPickerFocusTarget(picker);

  app.picker = null;

  const cardModal = $('#cardModal');

  const focusWasInsidePicker = Boolean(cardModal?.contains?.(document.activeElement));

  if (cardModal) cardModal.classList.remove('show');

  if ($('#cardSetPickerContext')) $('#cardSetPickerContext').hidden = true;

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

  if (isEquityGroup(group)) {
    setEquityPending({ renderInputs: equityPlayerFromHandGroup(group) ? 'players' : 'shared' });
  }

  else if (group.startsWith('hand-')) renderCanonicalHandWorkspace();

  else if (group.startsWith('training')) {

    // Training group - no context update needed

  } else {
    renderAllCards();
    updateContext('Cards cleared');
  }

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
const DECISION_CONTEXT_CONTRACT_VERSION = 'decision-context/v1.1';
const DECISION_CONTEXT_DERIVATION_SCHEMA_VERSION = 'decision-context-derivation/v1';

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
    return `<button type="button" class="card-slot card--${state}${card ? ' filled' : ''}${suitClass} riverline-card" data-card-state="${state}" data-card-size="slot" data-group="${group}" data-index="${index}" data-playbook-canonical-display disabled aria-label="${label}">${cardMarkup(card)}</button>`;
  }).join('');
}

function syncCanonicalDecisionDisplay(decisionContext) {
  if (!decisionContext) return null;
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
  return decisionContext;
}

function coreDecisionDerivationEvent(field, quality, code, value, rawValue) {
  const event = { field, quality, code };
  if (rawValue !== undefined && (typeof rawValue !== 'number' || Number.isFinite(rawValue))) {
    event.rawValue = rawValue;
  }
  if (value !== undefined) event.value = value;
  return event;
}

function coreDecisionUnavailableField(field, code, value = null) {
  return coreDecisionDerivationEvent(field, 'unavailable', code, value);
}

function coreNormalizedDecisionNumber(value, fallback, min, max, field, events, integer = false) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    events.push(coreDecisionDerivationEvent(
      field, 'defaulted', 'non_finite_default', fallback, value
    ));
    return fallback;
  }
  const clamped = normalizedDecisionNumber(numeric, fallback, min, max);
  if (clamped !== numeric) {
    events.push(coreDecisionDerivationEvent(
      field, 'clamped', 'supported_range_clamp', clamped, numeric
    ));
  }
  const normalized = integer ? Math.trunc(clamped) : clamped;
  if (normalized !== clamped) {
    events.push(coreDecisionDerivationEvent(
      field, 'normalized', 'integer_truncation', normalized, clamped
    ));
  }
  return normalized;
}

function coreScenarioCurrentPotBb(value, events) {
  if (value === undefined || value === null || value === '') {
    events.push(coreDecisionUnavailableField(
      'currentPotBb', 'scenario_current_pot_unavailable'
    ));
    return null;
  }
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0) {
    events.push(coreDecisionDerivationEvent(
      'currentPotBb', 'unavailable', 'scenario_current_pot_invalid', null, value
    ));
    return null;
  }
  events.push(coreDecisionDerivationEvent(
    'currentPotBb',
    typeof value === 'number' ? 'exact' : 'normalized',
    typeof value === 'number'
      ? 'scenario_current_pot_explicit'
      : 'scenario_current_pot_numeric_parse',
    numeric,
    typeof value === 'number' ? undefined : value
  ));
  return numeric;
}

function coreScenarioPriorActionSummary(street, lastAction) {
  const action = String(lastAction || '').toLowerCase();
  const actionFamilies = {
    unopened: 'none', check: 'check', bet: 'bet', raise: 'raise',
    '3bet': 'raise', '4bet': 'raise', limp: 'limp', call: 'call'
  };
  const lastActionFamily = actionFamilies[action] || 'unknown';
  let aggressionFamily = 'none';
  let aggressionCount = 0;
  if (street === 'preflop') {
    if (action === 'raise') { aggressionFamily = 'open'; aggressionCount = 1; }
    else if (action === '3bet') { aggressionFamily = 'three_bet'; aggressionCount = 2; }
    else if (action === '4bet') { aggressionFamily = 'four_bet_or_more'; aggressionCount = null; }
    else if (lastActionFamily === 'unknown') { aggressionFamily = 'unknown'; aggressionCount = null; }
  } else if (action === 'bet') {
    aggressionFamily = 'bet'; aggressionCount = 1;
  } else if (action === 'raise') {
    aggressionFamily = 'raise'; aggressionCount = 2;
  } else if (action === '3bet' || action === '4bet') {
    aggressionFamily = 'raise'; aggressionCount = null;
  } else if (lastActionFamily === 'unknown') {
    aggressionFamily = 'unknown'; aggressionCount = null;
  }
  return {
    lastActionFamily,
    lastActorPosition: null,
    facingActionFamily: actionFamilies[action] || 'unknown',
    aggressionFamily,
    aggressionCount,
    limperCount: street === 'preflop' && action === 'unopened' ? 0 : null,
    aggressorPosition: null
  };
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
    syncPlaybookNavigationDestination(mode);
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
    syncPlaybookNavigationDestination(previousMode);
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
  syncPlaybookNavigationDestination(mode);
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

function setSavedStudyBookmarkState(button, saved) {
  if (!button) return;
  button.classList.add('saved-study-bookmark-action');
  button.dataset.bookmarkState = saved ? 'saved' : 'unsaved';
  button.setAttribute('aria-pressed', String(saved));
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
    setSavedStudyBookmarkState(saveButton, saved);
    saveButton.setAttribute('aria-busy', String(busy));
    saveButton.disabled = saved || busy || !canSave;
  }
  const completedSaveButton = $('#handCompletedSaveButton');
  if (completedSaveButton && hand) {
    completedSaveButton.textContent = saved ? t('Saved') : t('Save hand');
    completedSaveButton.disabled = saved || busy || !canSave;
    setSavedStudyBookmarkState(completedSaveButton, saved);
  }
  const reviewSaveHandButton = $('#handReviewSaveHand');
  if (reviewSaveHandButton && hand) {
    reviewSaveHandButton.textContent = saved ? t('Saved') : t('Save hand');
    reviewSaveHandButton.disabled = saved || busy || !canSave;
    setSavedStudyBookmarkState(reviewSaveHandButton, saved);
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
  const amount = `${value.toFixed(digits).replace(/\.0$/, '')} bb`;
  return document.documentElement.dir === 'rtl' ? `\u2066${amount}\u2069` : amount;
}

function canonicalPlayerLabel(player, heroPlayerId) {
  if (!player) return '—';
  const hero = player.playerId === heroPlayerId ? `${t('Hero')} · ` : '';
  return `${hero}${player.position || t('Seat {number}', { number: player.seat + 1 })}`;
}

function canonicalHandTableSizeValidation() {
  const tableControl = $('#handTableSize');
  const gameMode = selectedValue('#handGameMode') || 'home';
  const minimum = gameMode === 'clubgg' ? 7 : 2;
  const raw = String(tableControl?.value ?? '').trim();
  const value = Number(raw);
  const valid = raw !== '' && Number.isInteger(value) && value >= minimum && value <= 10;
  return { valid, value, minimum, maximum: 10, gameMode };
}

function syncHandSeatSelectors() {
  const tableControl = $('#handTableSize');
  if (!tableControl) return;
  const validation = canonicalHandTableSizeValidation();
  const { gameMode, minimum } = validation;
  tableControl.min = String(minimum);
  tableControl.setAttribute('aria-invalid', String(!validation.valid));
  const error = $('#handTableSizeError');
  if (error) {
    error.hidden = validation.valid;
    error.textContent = gameMode === 'clubgg'
      ? t('ClubGG currently supports 7 to 10 players. Enter a whole number in that range.')
      : t('Hand tables support 2 to 10 players. Enter a whole number in that range.');
  }

  if (validation.valid) {
    ['handButtonSeat', 'handHeroSeat'].forEach((id) => {
      const select = $('#' + id);
      if (!select) return;
      const previous = Number(select.value);
      select.innerHTML = Array.from({ length: validation.value }, (_, seat) => (
        `<option value="${seat}">${t('Seat {number}', { number: seat + 1 })}</option>`
      )).join('');
      select.value = String(Number.isInteger(previous) && previous < validation.value ? previous : 0);
    });
  }

  const anteType = selectedValue('#handAnteType') || 'none';
  const ante = $('#handAnteBb');
  if (ante) {
    ante.disabled = anteType === 'none';
    if (anteType === 'none') ante.value = '0';
  }
  const preview = $('#handAccountingPreview');
  if (preview) preview.textContent = !validation.valid
    ? t('Fix the player count before starting the hand.')
    : gameMode === 'clubgg'
      ? t('ClubGG · 0.1 bb per seated player · {total} bb total deduction', { total: (validation.value * 0.1).toFixed(1) })
      : t('Home · no rake or forced deduction');
  const start = $('#handStartButton');
  if (start && !callPlaybookStateBridge('getState')) start.disabled = !validation.valid;
  return validation;
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
  app.playbookHandDraft.actionSubmissionLocked = false;
}

function canonicalHandFailureMessage() {
  const diagnostics = callPlaybookStateBridge('getDiagnostics');
  return diagnostics?.error?.message || t('The canonical hand could not be updated.');
}

function startCanonicalPlaybookHand() {
  if (callPlaybookStateBridge('getState')) {
    toast(t('End the current hand before changing its setup.'), 'warning');
    return null;
  }
  const tableSizeValidation = syncHandSeatSelectors();
  if (!tableSizeValidation?.valid) {
    toast(t('Enter a supported player count before starting the hand.'), 'warning');
    $('#handTableSize')?.focus();
    return null;
  }
  if (app.handReview.source === 'canonical_hand') {
    closeActiveHandReview({ returnToEndpoint: false });
  }
  resetCanonicalHandDraft();
  const state = callPlaybookStateBridge('initializeHand', readCanonicalHandConfiguration());
  if (!state) toast(canonicalHandFailureMessage(), 'error');
  else clearToast();
  renderCanonicalHandWorkspace();
  return state;
}

function resetCanonicalPlaybookHand() {
  if (callPlaybookStateBridge('getState')
    && !window.confirm(t('Abort this hand? Unsaved current live progress will be discarded. Saved hands and spots will not be changed.'))) return null;
  if (app.handReview.source === 'canonical_hand') {
    closeActiveHandReview({ returnToEndpoint: false });
  }
  if (app.picker?.group?.startsWith('hand-')) closePicker({ restoreFocus: false });
  callPlaybookStateBridge('resetHand');
  resetCanonicalHandDraft();
  renderCanonicalHandWorkspace();
  $('#handSetupDisclosure')?.setAttribute('open', '');
  $('#handStartButton')?.focus();
  return null;
}

function prepareCanonicalNewHand() {
  const state = callPlaybookStateBridge('getState');
  if (!state || (state.phase !== 'terminal' && state.terminal?.isTerminal !== true)) return null;
  if (app.handReview.source === 'canonical_hand') {
    closeActiveHandReview({ returnToEndpoint: false });
  }
  const transition = callPlaybookStateBridge('prepareNewHand');
  if (!transition) {
    toast(t('The completed Hand could not transition to fresh setup.'), 'error');
    return null;
  }
  resetCanonicalHandDraft();
  renderCanonicalHandWorkspace();
  const setup = $('#handSetupDisclosure');
  if (setup) setup.open = true;
  $('#handStartButton')?.focus();
  toast(t('Fresh setup is ready. The completed Hand was not changed.'), 'success');
  return transition;
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
  }
  renderCanonicalHandWorkspace();
  return next;
}

function canonicalActionPresentation(type, option) {
  const labels = { fold: 'Fold', check: 'Check', bet: 'Bet', raise: 'Raise' };
  const label = t(type === 'all_in' ? 'All-in' : type === 'call' ? 'Call' : labels[type] || type);
  const amount = type === 'all_in'
    ? formatCanonicalBb(option.amountToMilliBb)
    : type === 'call'
      ? formatCanonicalBb(option.commitMilliBb)
      : '';
  return { label, amount, accessibleLabel: amount ? `${label}, ${amount}` : label };
}

function syncCanonicalSizedActionCommitState() {
  const input = $('#handActionAmountBb');
  const commit = $('#handCommitSizedAction');
  if (!input || !commit) return false;
  const value = Number(input.value);
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const step = Number(input.step) || 0.1;
  const aligned = Number.isFinite(value)
    && Math.abs(((value - minimum) / step) - Math.round((value - minimum) / step)) < 1e-7;
  const valid = Number.isFinite(value) && value >= minimum && value <= maximum && aligned;
  input.setAttribute('aria-invalid', String(!valid));
  commit.disabled = app.playbookHandDraft.actionSubmissionLocked || !valid;
  return valid;
}

function chooseCanonicalSizedAction(type, option) {
  if (app.playbookHandDraft.actionSubmissionLocked) return;
  app.playbookHandDraft.sizedAction = type;
  const sizing = $('#handActionSizing');
  const input = $('#handActionAmountBb');
  const range = $('#handActionAmountRange');
  const label = $('#handActionSizingLabel');
  const bounds = $('#handActionAmountBounds');
  if (!sizing || !input) return;
  const min = Number(option.minToMilliBb) / 1000;
  const max = Number(option.maxToMilliBb) / 1000;
  const step = Number(callPlaybookStateBridge('getState')?.game?.chipUnitMilliBb || 100) / 1000;
  sizing.hidden = false;
  input.disabled = false;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(min);
  if (range) {
    range.disabled = false;
    range.min = String(min);
    range.max = String(max);
    range.step = String(step);
    range.value = String(min);
    range.hidden = max <= min;
  }
  const minimumPreset = $('#handSizingMinPreset');
  const maximumPreset = $('#handSizingMaxPreset');
  if (minimumPreset) {
    minimumPreset.disabled = false;
    minimumPreset.dataset.amountToBb = String(min);
    minimumPreset.textContent = `${t('Minimum')} · ${formatCanonicalBb(option.minToMilliBb)}`;
  }
  if (maximumPreset) {
    maximumPreset.disabled = false;
    maximumPreset.dataset.amountToBb = String(max);
    maximumPreset.textContent = `${t('Maximum non-all-in')} · ${formatCanonicalBb(option.maxToMilliBb)}`;
    maximumPreset.hidden = max === min;
  }
  if (label) label.textContent = t(type === 'bet' ? 'Bet to' : 'Raise to');
  if (bounds) bounds.textContent = t('{min}–{max} bb · amount-to', { min, max });
  if ($('#handCommitSizedAction')) {
    $('#handCommitSizedAction').hidden = false;
    $('#handCommitSizedAction').disabled = false;
  }
  $$('#handLegalActions [data-canonical-action]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.canonicalAction === type));
  });
  syncCanonicalSizedActionCommitState();
}

function applyCanonicalHandAction(type, amountToBb = null) {
  if (app.playbookHandDraft.actionSubmissionLocked) return null;
  app.playbookHandDraft.actionSubmissionLocked = true;
  renderCanonicalLegalActions(
    callPlaybookStateBridge('getState') || { players: [] },
    callPlaybookStateBridge('getLegalActions')
  );
  let next = null;
  try {
    next = callPlaybookStateBridge('applyAction', type, amountToBb);
    if (!next) toast(canonicalHandFailureMessage(), 'error');
    else {
      clearToast();
    }
  } finally {
    app.playbookHandDraft.sizedAction = null;
    app.playbookHandDraft.actionSubmissionLocked = false;
    renderCanonicalHandWorkspace();
  }
  return next;
}

function commitCanonicalSizedAction() {
  const type = app.playbookHandDraft.sizedAction;
  if (!type) return toast(t('Choose Bet or Raise first.'), 'warning');
  if (!syncCanonicalSizedActionCommitState()) {
    return toast(t('Enter an amount within the canonical legal range.'), 'warning');
  }
  return applyCanonicalHandAction(type, Number(selectedValue('#handActionAmountBb')));
}

function renderCanonicalLegalActions(state, legalActionSpec = undefined) {
  const root = $('#handLegalActions');
  const section = $('#handActionSection');
  if (!root || !section) return;
  const spec = legalActionSpec === undefined
    ? callPlaybookStateBridge('getLegalActions')
    : legalActionSpec;
  section.hidden = !spec;
  root.innerHTML = '';
  if (!spec) return;

  const actor = state.players.find((player) => player.playerId === state.actingPlayerId);
  const hero = state.players.find((player) => (
    player.playerId === callPlaybookStateBridge('getHeroPlayerId')
  ));
  if ($('#handActionActor')) $('#handActionActor').textContent = t('{player} to act', {
    player: canonicalPlayerLabel(actor, callPlaybookStateBridge('getHeroPlayerId'))
  });
  if ($('#handActionPot')) $('#handActionPot').textContent = formatCanonicalBb(state.potMilliBb);
  if ($('#handActionCall')) $('#handActionCall').textContent = formatCanonicalBb(
    spec.call.available ? spec.call.commitMilliBb : 0
  );
  if ($('#handActionHeroStack')) $('#handActionHeroStack').textContent = hero
    ? formatCanonicalBb(hero.currentStackMilliBb)
    : t('Unavailable');
  section.setAttribute('aria-busy', String(app.playbookHandDraft.actionSubmissionLocked));
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
    button.disabled = app.playbookHandDraft.actionSubmissionLocked;
    button.setAttribute('aria-pressed', 'false');
    const presentation = canonicalActionPresentation(type, option);
    const label = document.createElement('span');
    label.className = 'hand-action-label';
    label.textContent = presentation.label;
    button.appendChild(label);
    if (presentation.amount) {
      const amount = document.createElement('span');
      amount.className = 'hand-action-amount poker-data-token';
      amount.dir = 'ltr';
      amount.textContent = presentation.amount;
      button.appendChild(amount);
    }
    button.setAttribute('aria-label', `${presentation.accessibleLabel}${type === 'bet' || type === 'raise' ? `, ${t('choose amount-to sizing')}` : ''}`);
    if (type === 'bet' || type === 'raise') {
      button.addEventListener('click', () => chooseCanonicalSizedAction(type, option));
    } else {
      // A queued second click on the same detached control must not advance a
      // newly rendered decision after the canonical transition completes.
      button.addEventListener('click', () => applyCanonicalHandAction(type), { once: true });
    }
    root.appendChild(button);
  });

  const commit = $('#handCommitSizedAction');
  if (commit) {
    commit.disabled = app.playbookHandDraft.actionSubmissionLocked;
    commit.hidden = true;
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

function canonicalHandStageKey(state, replayProjection) {
  if (replayProjection?.readOnly) return 'replay';
  if (!state) return 'setup';
  if (state.terminal?.isTerminal || state.phase === 'terminal') return 'complete';
  if (state.showdown?.status === 'awaiting_private_reveal') return 'reveal';
  if (state.phase === 'showdown') return 'showdown';
  if (state.pendingChance?.type === 'deal_hole') return 'private-cards';
  if (state.phase === 'chance') return 'chance';
  if (state.phase === 'betting') return 'action';
  return 'active';
}

function canonicalActionHistoryLabel(record, state, heroPlayerId) {
  if (!record) return t('No action yet');
  const player = state?.players?.find((candidate) => candidate.playerId === record.playerId);
  const type = record.submittedAction?.type || record.type;
  const actionKey = {
    fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise', all_in: 'All-in'
  }[type] || type || 'Action';
  let action = t(actionKey);
  if (type === 'call' && Number.isFinite(record.committedMilliBb)) {
    action = `${action} · ${formatCanonicalBb(record.committedMilliBb)}`;
  } else if (['bet', 'raise', 'all_in'].includes(type)
    && Number.isFinite(record.currentBetAfterMilliBb)) {
    action = `${action} · ${t('to')} ${formatCanonicalBb(record.currentBetAfterMilliBb)}`;
  }
  return t('{player}: {action}', {
    player: canonicalPlayerLabel(player, heroPlayerId),
    action
  });
}

function setCanonicalTableExpanded(expanded) {
  const wrapper = $('#table-wrapper');
  const button = $('#toggleTableBtn');
  if (!wrapper || !button) return;
  wrapper.classList.toggle('collapsed', !expanded);
  button.closest('.playbook-decision-workspace')?.classList.toggle('is-table-collapsed', !expanded);
  button.setAttribute('aria-expanded', String(expanded));
  const labelKey = expanded ? 'Collapse Table' : 'Expand Table';
  button.dataset.i18n = labelKey;
  button.textContent = t(labelKey);
  if (expanded) playbookSurfaceInvalidator.renderIfNeeded('table');
}

function renderCanonicalHandSetupState(state, stage, replayProjection) {
  const disclosure = $('#handSetupDisclosure');
  const workspace = $('#playbookHandWorkspace');
  const savedViewer = replayProjection?.viewerContext?.kind === 'saved_hand';
  const immutable = Boolean(state) || savedViewer;
  const previousStage = workspace?.dataset.handStage || null;

  if (workspace) workspace.dataset.handStage = stage;
  if ($('#gtoMode')) $('#gtoMode').dataset.handStage = stage;
  if (disclosure && previousStage !== stage) {
    if (stage === 'setup') disclosure.open = true;
    else if (previousStage === 'setup' || previousStage === null) disclosure.open = false;
  }
  if (previousStage === 'setup' && stage !== 'setup') setCanonicalTableExpanded(true);

  const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
  const hero = state?.players?.find((player) => player.playerId === heroPlayerId);
  const compactSummary = state
    ? t('{count} players · Hero {position} · {stack}', {
      count: state.players.length,
      position: hero?.position || t('Seat {number}', { number: (hero?.seat ?? 0) + 1 }),
      stack: formatCanonicalBb(hero?.startingStackMilliBb)
    })
    : t('Configure before the hand starts');
  if ($('#handSetupCompactSummary')) $('#handSetupCompactSummary').textContent = compactSummary;
  if ($('#handSetupDisclosureState')) {
    $('#handSetupDisclosureState').textContent = t(immutable ? 'Locked for this hand' : 'Configure');
    $('#handSetupDisclosureState').className = `badge status-badge status-badge--${immutable ? 'neutral' : 'info'}`;
  }

  ['handTableSize', 'handGameMode', 'handStackBb', 'handButtonSeat', 'handHeroSeat', 'handAnteType', 'handAnteBb']
    .forEach((id) => {
      const control = $('#' + id);
      if (control) control.disabled = immutable;
    });
  if (!immutable && $('#handAnteBb')) {
    $('#handAnteBb').disabled = selectedValue('#handAnteType') === 'none';
  }
  const start = $('#handStartButton');
  if (start) {
    start.hidden = immutable;
    start.disabled = immutable || !canonicalHandTableSizeValidation().valid;
  }
  const reset = $('#handResetButton');
  if (reset) {
    const abortable = Boolean(state
      && !savedViewer
      && state.phase !== 'terminal'
      && state.terminal?.isTerminal !== true);
    reset.hidden = !abortable;
    reset.disabled = !abortable;
    reset.textContent = t('Abort hand');
    reset.dataset.i18n = 'Abort hand';
  }
}

function renderCanonicalHandStage(state, legalActions, replayProjection) {
  const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
  const stage = canonicalHandStageKey(state, replayProjection);
  const actor = state?.players?.find((player) => player.playerId === state.actingPlayerId);
  const actorLabel = actor ? canonicalPlayerLabel(actor, heroPlayerId) : '—';
  const status = canonicalHandStatus(state);
  const stageHeader = $('#handLiveStageHeader');
  const stageDock = $('#handStageDock');
  const timelineStage = $('#handTimelineStage');
  const timeline = $('#handActionHistory');
  const terminal = Boolean(state?.terminal?.isTerminal || state?.phase === 'terminal');

  renderCanonicalHandSetupState(state, stage, replayProjection);
  if ($('#handStateSection')) $('#handStateSection').hidden = !state;
  if ($('#handHistorySection')) $('#handHistorySection').hidden = !state;
  if (timelineStage) {
    timelineStage.hidden = !state;
    timelineStage.dataset.timelineMode = replayProjection?.readOnly || terminal ? 'review' : 'compact';
  }
  if (timeline) {
    timeline.classList.toggle('replay-timeline--compact', !replayProjection?.readOnly && !terminal);
    timeline.classList.toggle('replay-timeline--review', replayProjection?.readOnly || terminal);
  }
  if (stageHeader) {
    stageHeader.hidden = false;
    stageHeader.dataset.handStage = stage;
  }
  if (stageDock) stageDock.dataset.handStage = stage;

  let title = t('Configure a hand');
  if (stage === 'replay') title = t(replayProjection?.viewerContext?.kind === 'saved_hand'
    ? 'Reviewing saved hand'
    : 'Reviewing earlier hand state');
  else if (terminal) title = t('Hand complete');
  else if (state?.showdown?.status === 'awaiting_private_reveal') title = t('Reveal hands');
  else if (state?.phase === 'showdown') title = t('Resolve showdown');
  else if (state?.pendingChance?.type === 'deal_hole') title = t('Set Hero cards');
  else if (state?.phase === 'chance') {
    const street = String(state.pendingChance?.type || 'deal_board').replace('deal_', '');
    title = t('Deal {street}', {
      street: t(street.charAt(0).toUpperCase() + street.slice(1))
    });
  }
  else if (actor) title = actor.playerId === heroPlayerId
    ? t('Hero to act')
    : t('{player} to act', { player: actorLabel });

  if ($('#handLiveStageTitle')) $('#handLiveStageTitle').textContent = title;
  if ($('#handLiveStageProgress')) $('#handLiveStageProgress').textContent = stage === 'replay'
    ? t('Replay is read-only; the canonical live Hand is unchanged.')
    : status.summary;
  if ($('#handLiveStageLastAction')) {
    $('#handLiveStageLastAction').textContent = canonicalActionHistoryLabel(
      state?.actionHistory?.at(-1),
      state,
      heroPlayerId
    );
  }
  if ($('#handLiveActor')) $('#handLiveActor').textContent = actorLabel;
  if ($('#handLivePot')) $('#handLivePot').textContent = state ? formatCanonicalBb(state.potMilliBb) : '—';
  if ($('#handLiveFacing')) $('#handLiveFacing').textContent = legalActions
    ? formatCanonicalBb(state.currentBetMilliBb)
    : '—';
  if ($('#handLiveCall')) $('#handLiveCall').textContent = legalActions
    ? formatCanonicalBb(legalActions.call.available ? legalActions.call.commitMilliBb : 0)
    : '—';

  const historyCount = replayProjection?.timeline?.entryCount || 0;
  if ($('#handHistoryCompactSummary')) $('#handHistoryCompactSummary').textContent = t('{count} actions', {
    count: historyCount
  });
  const historyDisclosure = $('#handHistoryDisclosure');
  const historyDisclosureAction = $('#handHistoryDisclosureAction');
  if (historyDisclosureAction) {
    const key = historyDisclosure?.open === false ? 'Expand' : 'Collapse';
    historyDisclosureAction.textContent = t(key);
    historyDisclosureAction.dataset.i18n = key;
  }

  const completed = $('#handCompletedSection');
  if (completed) completed.hidden = !terminal || replayProjection?.readOnly === true;
  const replayButton = $('#handCompletedReplayButton');
  if (replayButton) replayButton.disabled = !replayProjection?.canPlayback;
  const analysisButton = $('#handCompletedAnalysisButton');
  const journal = state ? callPlaybookStateBridge('getHeroDecisionJournal') : null;
  const completedResult = terminal ? callPlaybookStateBridge('getCompletedHandResult') : null;
  const heroDelta = completedResult?.stackDeltasMilliBbByPlayer?.[heroPlayerId];
  if ($('#handCompletedResult')) {
    const result = Number.isSafeInteger(heroDelta)
      ? `${heroDelta > 0 ? '+' : ''}${formatCanonicalBb(heroDelta)}`
      : t('Unavailable');
    $('#handCompletedResult').textContent = completedResult?.terminalReason === 'showdown'
      ? t('Showdown complete. Hero result: {result}.', { result })
      : t('Hand ended by fold. Hero result: {result}.', { result });
  }
  if ($('#handCompletedDecisionCount')) {
    $('#handCompletedDecisionCount').textContent = String(journal?.decisions?.length || 0);
  }
  if (analysisButton) analysisButton.disabled = !(journal?.decisions?.length > 0);
  const completionSave = $('#handCompletedSaveButton');
  const canonicalSave = $('#savedStudySaveButton');
  if (completionSave) {
    completionSave.disabled = !canonicalSave || canonicalSave.disabled;
    completionSave.textContent = t(canonicalSave?.getAttribute('aria-pressed') === 'true' ? 'Saved' : 'Save hand');
  }
  if (stageDock) {
    const hasVisibleMainStage = Boolean(stageDock.querySelector('.hand-control-section:not([hidden])'));
    stageDock.hidden = !state || replayProjection?.readOnly === true || !hasVisibleMainStage;
  }
}

function renderCanonicalPrivateDeal(state) {
  const section = $('#handDealSection');
  const root = $('#handPrivateCards');
  const isHoleDeal = state?.pendingChance?.type === 'deal_hole';
  const isAwaitingReveal = state?.showdown?.status === 'awaiting_private_reveal';
  if (!section || !root) return;
  const knownOpponentsOpen = root.querySelector('.hand-known-opponents')?.open === true;
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
      <div class="hand-hidden-summary" role="status"><span class="hand-card-backs" aria-hidden="true"><i class="riverline-card-back" data-card-size="mini"></i><i class="riverline-card-back" data-card-size="mini"></i></span><strong>${t('{count} opponents hidden by default', { count: opponents.length })}</strong></div>
      <details class="hand-known-opponents"><summary>${t('Set known opponent cards (optional)')}</summary>
        <div class="hand-known-opponent-list">${opponents.map((player) => privateRow(player, t('Optional · otherwise Hidden'))).join('')}</div>
      </details>`;
    const knownOpponents = root.querySelector('.hand-known-opponents');
    if (knownOpponents) knownOpponents.open = knownOpponentsOpen;
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

function seekCanonicalReplayFrame(frameIndex) {
  if (!Number.isInteger(frameIndex)) return null;
  emitStudyExperience('review_decision_selected', {
    origin: 'direct_seek',
    source: 'canonical_replay',
    payload: { frameIndex },
  });
  const projection = callPlaybookStateBridge('selectReplayFrame', frameIndex);
  const selected = [...$$('#handActionHistory .replay-timeline-seek[data-frame-index]')]
    .find((control) => Number(control.dataset.frameIndex) === frameIndex);
  selected?.focus();
  return projection;
}

function createReplayActionEntry(entry) {
  const reviewDecision = app.handReview.model?.decisions?.find((decision) => (
    decision.replayFrameTarget.actionSequence === entry.sequence
  )) || null;
  const selectedReviewDecision = reviewDecision?.decisionId
    === app.handReview.model?.selectedDecision?.decisionId;
  const item = document.createElement('li');
  item.className = `replay-action-entry replay-action-entry--${entry.actionFamily} is-replay-${entry.presentationState}${entry.isHero ? ' is-hero' : ''}${entry.wasAllIn ? ' is-all-in' : ''}${reviewDecision ? ' is-review-decision' : ''}${selectedReviewDecision ? ' is-selected-review-decision' : ''}`;
  item.dataset.actionType = entry.actionType;
  item.dataset.amountKind = entry.amountKind;
  item.dataset.sequence = String(entry.sequence);
  item.dataset.frameIndex = String(entry.frameIndex);
  item.dataset.replayProgress = entry.presentationState;
  if (reviewDecision) {
    item.dataset.reviewDecisionId = reviewDecision.decisionId;
    item.dataset.reviewComparison = reviewDecision.comparison.state;
  }
  item.value = entry.sequence + 1;
  if (entry.presentationState === 'current') item.setAttribute('aria-current', 'step');

  const body = document.createElement('button');
  body.type = 'button';
  body.className = 'replay-action-body replay-timeline-seek';
  body.dataset.frameIndex = String(entry.frameIndex);
  body.setAttribute('aria-label', reviewDecision
    ? t('Hero Decision {number}: {action}, {comparison}. Replay action frame {frame}.', {
      number: reviewDecision.decisionNumber,
      action: reviewActionCopy(reviewDecision.chosenAction, reviewDecision),
      comparison: reviewComparisonLabel(reviewDecision.comparison),
      frame: entry.frameIndex + 1
    })
    : t('Review replay frame {current}', { current: entry.frameIndex + 1 }));
  body.addEventListener('click', () => seekCanonicalReplayFrame(entry.frameIndex));
  if (entry.presentationState === 'current') body.setAttribute('aria-current', 'step');
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
  const item = document.createElement('button');
  item.type = 'button';
  item.className = `replay-transition-entry replay-timeline-seek replay-transition-entry--${event.transitionKind.replaceAll('_', '-')} is-replay-${event.presentationState}`;
  item.dataset.transitionKind = event.transitionKind;
  item.dataset.replayProgress = event.presentationState;
  item.dataset.frameIndex = String(event.frameIndex);
  item.setAttribute('aria-label', t('Review replay frame {current}', {
    current: event.frameIndex + 1
  }));
  item.addEventListener('click', () => seekCanonicalReplayFrame(event.frameIndex));
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
      const suit = globalThis.RiverlineCardPresentation?.cardSuitPresentation(card.suit);
      token.className = 'replay-transition-card';
      token.dataset.cardSuitId = suit?.id ?? 's';
      token.textContent = `${displayCardRank(card.rank)}${suit?.symbol ?? card.suit}`;
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
    const liveState = callPlaybookStateBridge('getState');
    const liveHandInProgress = Boolean(liveState
      && liveState.phase !== 'terminal'
      && liveState.terminal?.isTerminal !== true);
    const canExitReplayToLive = projection.mode === 'replay'
      && projection.canReturnToLive === true
      && liveHandInProgress;
    const endpointKey = 'replay.control.returnToLive';
    live.textContent = t(endpointKey);
    live.dataset.i18n = endpointKey;
    live.setAttribute('aria-label', t(endpointKey));
    live.hidden = !canExitReplayToLive;
    live.disabled = !canExitReplayToLive;
  }
  if (focusedControl?.disabled) {
    [playbackButton, previous, next, live]
      .find((button) => button && !button.hidden && !button.disabled)?.focus();
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
  const priorStreetDisclosure = new Map(
    [...root.querySelectorAll('.replay-street-group')].map((group) => [
      group.dataset.replayStreet,
      group.open,
    ]),
  );
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
    const section = document.createElement('details');
    section.className = `replay-street-group${group.isSelectedStreet ? ' is-current-street' : ''}`;
    section.dataset.replayStreet = group.street;
    section.dataset.replayGroupState = group.isSelectedStreet
      ? 'current'
      : group.items.every((item) => item.presentationState === 'completed')
        ? 'completed'
        : 'future';
    section.open = group.isSelectedStreet || priorStreetDisclosure.get(group.street) === true;

    const summary = document.createElement('summary');
    summary.className = 'replay-street-summary';
    const heading = document.createElement('span');
    heading.className = 'replay-street-heading';
    heading.id = `replay-street-${group.street}`;
    heading.textContent = t(group.headingKey);
    summary.appendChild(heading);
    const itemCount = document.createElement('span');
    itemCount.className = 'replay-street-count poker-data-token';
    itemCount.textContent = String(group.items.length);
    itemCount.setAttribute('aria-hidden', 'true');
    summary.appendChild(itemCount);
    section.appendChild(summary);

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
  const historyCount = $('#handHistoryCompactSummary');
  if (historyCount) historyCount.textContent = t('{count} actions', { count: model.entryCount });
  const selectedSummary = $('#handHistorySelectionSummary');
  if (selectedSummary) {
    if (model.selectedAction) {
      const amount = model.selectedAction.amountKind !== 'none'
        && Number.isSafeInteger(model.selectedAction.amountMilliBb)
        ? ` · ${formatCanonicalBb(model.selectedAction.amountMilliBb)}`
        : '';
      selectedSummary.textContent = `${replayActorLabel(model.selectedAction)} · ${t(model.selectedAction.actionLabelKey)}${amount}`;
    } else if (model.selectedTransition) {
      selectedSummary.textContent = t(model.selectedTransition.labelKey);
    } else {
      selectedSummary.textContent = replayMarkerLabel(model.currentMarker);
    }
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

function setCanonicalReplayReadOnly(projection, state = callPlaybookStateBridge('getState')) {
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
    if (savedViewer || state) setup.setAttribute('aria-disabled', 'true');
    else setup.removeAttribute('aria-disabled');
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
  const analyzeProjection = $('#gtoMode')?.dataset.productDestination === 'analyze';
  const tableModel = callPlaybookStateBridge('createTablePresentationViewModel', {
    projection: analyzeProjection ? 'analyze' : null,
    interaction: analyzeProjection ? 'passive' : null,
    submissionLocked: app.playbookHandDraft.actionSubmissionLocked
  }) || projection?.tablePresence
    || callPlaybookStateBridge('createTablePresenceViewModel');
  if (!tableModel) return;
  const wrapper = $('#table-wrapper');
  if (wrapper) {
    wrapper.classList.toggle('is-replay-projection', projection?.readOnly === true);
    wrapper.dataset.replayMode = projection?.mode || 'live';
    wrapper.dataset.tableProjection = tableModel.projection || 'play';
    wrapper.dataset.tableVisualState = tableModel.visualState || 'setup';
    wrapper.dataset.tableGeometryFamily = tableModel.geometryFamily || 'empty';
    if (projection?.readOnly) wrapper.setAttribute('aria-describedby', 'handReplayStatus');
    else wrapper.removeAttribute('aria-describedby');
  }
  window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: tableModel }));
}

function renderCanonicalHandWorkspace() {
  const workspace = $('#playbookHandWorkspace');
  if (!workspace) return;
  const state = callPlaybookStateBridge('getState');
  const replayProjection = callPlaybookStateBridge('createReplayProjectionViewModel');
  if (app.handReview.source === 'canonical_hand') refreshActiveHandReviewModel();
  const legalActions = state ? callPlaybookStateBridge('getLegalActions') : null;
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
  if ($('#handStateStreet')) $('#handStateStreet').textContent = state?.street
    ? t(`replay.street.${state.street}`)
    : '—';
  const actor = state?.players?.find((player) => player.playerId === state.actingPlayerId);
  if ($('#handStateActor')) $('#handStateActor').textContent = actor ? canonicalPlayerLabel(actor, heroPlayerId) : '—';
  if ($('#handStatePot')) $('#handStatePot').textContent = state ? formatCanonicalBb(state.potMilliBb) : '—';
  if ($('#handStateDeduction')) $('#handStateDeduction').textContent = state ? formatCanonicalBb(state.deductionTotalMilliBb) : '—';
  if ($('#handStartButton')) $('#handStartButton').textContent = t('Start hand');

  const seats = $('#handSeatList');
  if (seats) seats.innerHTML = state?.players?.map((player) => `
    <div class="hand-seat-row${player.playerId === state.actingPlayerId ? ' is-actor' : ''}${player.folded ? ' is-folded' : ''}">
      <div><strong>${canonicalPlayerLabel(player, heroPlayerId)}</strong><small>${t('Seat {number}', { number: player.seat + 1 })}${player.currentStackMilliBb === 0 && !player.folded ? ` · ${t('All-in')}` : ''}${player.folded ? ` · ${t('Folded')}` : ''}</small></div>
      <div class="hand-seat-values poker-data-token">${formatCanonicalBb(player.currentStackMilliBb)}<br>${t('street')} ${formatCanonicalBb(player.streetContributionMilliBb)} · ${t('hand')} ${formatCanonicalBb(player.totalPotContributionMilliBb)}</div>
    </div>`).join('') || `<p class="panel-note">${t('No players yet.')}</p>`;

  renderCanonicalPrivateDeal(state);
  renderCanonicalChance(state);
  renderCanonicalLegalActions(state || { players: [] }, legalActions);
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
  setCanonicalReplayReadOnly(replayProjection, state);
  renderCanonicalHandStage(state, legalActions, replayProjection);
  dispatchCanonicalTableState();
  if (app.handReview.source === 'canonical_hand') renderActiveHandReview();
}

function activeHandReviewInput() {
  if (app.handReview.source === 'canonical_hand') {
    const journal = callPlaybookStateBridge('getHeroDecisionJournal');
    const completedHandResult = callPlaybookStateBridge('getCompletedHandResult');
    const heroPlayerId = callPlaybookStateBridge('getHeroPlayerId');
    if (!journal || journal.status !== 'complete' || !completedHandResult || !heroPlayerId) return null;
    return {
      source: 'canonical_hand',
      handId: journal.handId,
      heroPlayerId,
      decisions: journal.decisions,
      completedHandResult,
      replayProjection: callPlaybookStateBridge('createReplayProjectionViewModel'),
      providerCacheKey: JSON.stringify({
        provider: strategyProvider.schemaVersion,
        options: readHeuristicOptions()
      }),
      actions: {
        analyze: true,
        saveHand: true,
        saveSpot: true,
        returnToCompleted: true
      }
    };
  }
  if (app.handReview.source === 'training_full_hand') {
    const review = callTrainingServiceBridge('getFullHandReview');
    const snapshot = app.training.fullHandSnapshot
      || callTrainingServiceBridge('getFullHandSnapshot');
    if (!review || review.status !== 'ready' || !snapshot?.completedHandResult) return null;
    return {
      source: 'training_full_hand',
      handId: review.handId,
      heroPlayerId: review.heroPlayerId || snapshot.heroPlayerId,
      decisions: review.decisions,
      completedHandResult: snapshot.completedHandResult,
      replayProjection: callTrainingServiceBridge('getFullHandReviewReplayProjection'),
      providerCacheKey: 'training-resolved-results',
      actions: {
        analyze: true,
        saveHand: false,
        saveSpot: true,
        repeat: true,
        next: true,
        returnToCompleted: true
      }
    };
  }
  return null;
}

function refreshActiveHandReviewModel() {
  const input = activeHandReviewInput();
  if (!input) {
    app.handReview.model = null;
    return null;
  }
  try {
    if (!handReviewProjector) {
      handReviewProjector = requireHandReviewBridge().createProjector({
        resolveStrategy: (decisionContext) => strategyProvider.resolve(decisionContext)
      });
    }
    const model = handReviewProjector.project({
      ...input,
      selectedDecisionIndex: app.handReview.selectedDecisionIndex
    });
    app.handReview.model = model;
    app.handReview.selectedDecisionIndex = model.selectedDecisionIndex;
    return model;
  } catch (error) {
    console.error('[Riverline Hand Review]', error);
    app.handReview.model = null;
    return null;
  }
}

function activeHandReviewReplayOperation(operation, ...args) {
  if (app.handReview.source === 'canonical_hand') {
    const methods = {
      select: 'selectReplayFrame',
      previous: 'previousReplayFrame',
      next: 'nextReplayFrame',
      endpoint: 'returnReplayToEndpoint'
    };
    return callPlaybookStateBridge(methods[operation], ...args);
  }
  if (app.handReview.source === 'training_full_hand') {
    const methods = {
      select: 'selectFullHandReviewFrame',
      previous: 'previousFullHandReviewFrame',
      next: 'nextFullHandReviewFrame',
      endpoint: 'returnFullHandReviewToEndpoint'
    };
    return callTrainingServiceBridge(methods[operation], ...args);
  }
  return null;
}

function mountActiveHandReview() {
  const surface = $('#handReviewSurface');
  const mount = app.handReview.source === 'training_full_hand'
    ? $('#trainingHandReviewMount')
    : $('#handReviewMount');
  if (!surface || !mount) return null;
  const history = $('#handHistorySection');
  const reviewRail = $('#handReviewReplayRailMount');
  const liveRail = $('#handInteractionRail');
  const handMode = app.handReview.source === 'canonical_hand';
  if (handMode && history && reviewRail && history.parentElement !== reviewRail) {
    reviewRail.appendChild(history);
  } else if (!handMode && history && liveRail && history.parentElement !== liveRail) {
    liveRail.appendChild(history);
  }
  $('#gtoMode')?.classList.toggle('is-hand-review-open', handMode);
  if (surface.parentElement !== mount) mount.appendChild(surface);
  surface.hidden = false;
  surface.dataset.reviewSource = app.handReview.source;
  return surface;
}

function closeActiveHandReview({ returnToEndpoint = true } = {}) {
  const priorSource = app.handReview.source;
  if (returnToEndpoint) activeHandReviewReplayOperation('endpoint');
  app.handReview.source = null;
  app.handReview.selectedDecisionIndex = null;
  app.handReview.model = null;
  const surface = $('#handReviewSurface');
  if (surface) surface.hidden = true;
  $('#gtoMode')?.classList.remove('is-hand-review-open');
  const history = $('#handHistorySection');
  const liveRail = $('#handInteractionRail');
  if (history && liveRail && history.parentElement !== liveRail) liveRail.appendChild(history);
  if (priorSource === 'training_full_hand') {
    setFullHandTrainingPhase('complete');
    dispatchFullHandTrainingTable(app.training.fullHandSnapshot);
    if ($('#trainingExerciseSurface')) $('#trainingExerciseSurface').hidden = true;
    $('#trainingReviewHand')?.setAttribute('aria-expanded', 'false');
    $('#trainingFullHandCompletion')?.scrollIntoView?.({ behavior: 'auto', block: 'nearest' });
  }
}

function reviewStreetLabel(street) {
  const normalized = String(street || 'preflop');
  return t(normalized.charAt(0).toUpperCase() + normalized.slice(1));
}

function reviewActionLabel(type, decisionContext) {
  return t(trainingActionLabel(type, decisionContext));
}

function reviewActionCopy(action, decision) {
  if (!action) return t('Unavailable');
  const label = reviewActionLabel(action.type, decision?.durable?.decisionContext || {});
  if (Number.isSafeInteger(action.amountMilliBb)) {
    return action.amountKind === 'amount_to'
      ? t('{action} to {amount}', { action: label, amount: formatCanonicalBb(action.amountMilliBb) })
      : t('{action} {amount}', { action: label, amount: formatCanonicalBb(action.amountMilliBb) });
  }
  return label;
}

function reviewComparisonLabel(comparison) {
  if (!comparison || comparison.state === 'unavailable') return t('Reference unavailable');
  if (comparison.semantics === 'normative') {
    return {
      matches: t('Correct'),
      close: t('Acceptable'),
      differs: t('Mistake')
    }[comparison.state] || t('Review');
  }
  return {
    matches: t('Matches Riverline reference'),
    close: t('Close to Riverline reference'),
    differs: t('Differs from Riverline reference')
  }[comparison.state] || t('Reference unavailable');
}

function reviewComparisonTone(comparison) {
  return {
    matches: 'success',
    close: 'info',
    differs: 'warning',
    unavailable: 'neutral'
  }[comparison?.state] || 'neutral';
}

function reviewContextCopy(decision) {
  const context = decision.context;
  const actor = decision.durable.heroPosition || t('position unavailable');
  if (Number.isFinite(context.callAmountBb) && context.callAmountBb > 0) {
    return t('{position} facing {facing} · {call} to call', {
      position: actor,
      facing: Number.isFinite(context.facingSizeBb) ? `${context.facingSizeBb} bb` : t('action'),
      call: `${context.callAmountBb} bb`
    });
  }
  const family = String(context.facingActionFamily || 'none').replaceAll('_', ' ');
  return t('{position} · {context}', { position: actor, context: t(family) });
}

function renderHandReviewCards(target, cards, emptyKey) {
  if (!target) return;
  target.replaceChildren();
  if (!Array.isArray(cards) || cards.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'hand-review-no-cards';
    empty.textContent = t(emptyKey);
    target.appendChild(empty);
    return;
  }
  cards.forEach((card) => {
    const item = document.createElement('span');
    item.className = 'hand-review-card training-readonly-card riverline-card';
    item.dataset.cardSize = 'standard';
    item.setAttribute('role', 'img');
    item.setAttribute('aria-label', displayCard(card));
    item.innerHTML = cardMarkup(card);
    target.appendChild(item);
  });
}

function formatReviewFrequency(probability) {
  const percent = Number(probability) * 100;
  if (!Number.isFinite(percent)) return t('Unavailable');
  if (percent > 0 && percent < 0.1) return '<0.1%';
  const rounded = Math.round(percent * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function renderHandReviewFrequencyComparison(decision) {
  const stack = $('#handReviewFrequencyStack');
  const rows = $('#handReviewFrequencyRows');
  if (!stack || !rows) return;
  stack.replaceChildren();
  rows.replaceChildren();
  const distribution = [...decision.distribution].sort((left, right) => (
    right.probability - left.probability
  ));
  if (distribution.length === 0) {
    stack.classList.add('is-empty');
    stack.setAttribute('aria-label', t('Strategy frequencies unavailable'));
    const unavailable = document.createElement('p');
    unavailable.className = 'hand-review-reference-unavailable';
    unavailable.textContent = t('The hand and chosen action remain available even though this reference cannot compare the decision.');
    rows.appendChild(unavailable);
    return;
  }
  stack.classList.remove('is-empty');
  const highestProbability = Math.max(...distribution.map((entry) => entry.probability));
  const accessible = [];
  distribution.forEach((entry) => {
    const chosen = entry.type === decision.chosenAction.type;
    const highest = Math.abs(entry.probability - highestProbability) <= Number.EPSILON;
    const label = t(entry.label || trainingActionLabel(entry.type, decision.durable.decisionContext));
    const frequency = formatReviewFrequency(entry.probability);
    const kind = visualActionKind({ action: { type: entry.type } });
    accessible.push(`${label} ${frequency}${chosen ? `, ${t('chosen action')}` : ''}${highest ? `, ${t('highest frequency')}` : ''}`);

    const segment = document.createElement('span');
    segment.className = 'hand-review-frequency-segment';
    segment.dataset.actionKind = kind;
    segment.style.width = `${entry.probability * 100}%`;
    stack.appendChild(segment);

    const row = document.createElement('div');
    row.className = 'hand-review-frequency-row';
    row.dataset.actionKind = kind;
    row.classList.toggle('is-chosen', chosen);
    row.classList.toggle('is-highest', highest);
    const name = document.createElement('span');
    name.className = 'hand-review-frequency-name';
    name.textContent = label;
    const markers = document.createElement('span');
    markers.className = 'hand-review-frequency-markers';
    if (chosen) {
      const marker = document.createElement('em');
      marker.textContent = t('Chosen');
      markers.appendChild(marker);
    }
    if (highest) {
      const marker = document.createElement('em');
      marker.textContent = t('Highest');
      markers.appendChild(marker);
    }
    const track = document.createElement('span');
    track.className = 'hand-review-frequency-track';
    const fill = document.createElement('i');
    fill.style.width = `${entry.probability * 100}%`;
    track.appendChild(fill);
    const value = document.createElement('strong');
    value.textContent = frequency;
    row.setAttribute('aria-label', accessible.at(-1));
    row.append(name, markers, track, value);
    rows.appendChild(row);
  });
  stack.setAttribute('aria-label', accessible.join(', '));
}

function reviewLimitationLabel(code, decision) {
  const policyEntry = decision.claimPolicy?.limitations?.find((entry) => entry.code === code);
  if (policyEntry) return t(policyEntry.messageKey || policyEntry.message);
  const keys = {
    reference_unavailable: 'Reference unavailable for this decision.',
    generalized_context: 'This is a generalized reference for the current context.',
    missing_exact_call_price: 'Exact call price is unavailable.',
    sizing_not_compared: 'The action-family comparison does not evaluate the exact bet or raise size.',
    legal_action_not_represented: 'The selected source does not represent this legal action family.',
    multiway_effective_stacks: 'Multiway effective stacks are shown per opponent; no single effective stack is implied.'
  };
  return t(keys[code] || code.replaceAll('_', ' '));
}

function renderHandReviewDecisionList(model) {
  const list = $('#handReviewDecisionList');
  if (!list) return;
  const focusedDecisionId = document.activeElement?.dataset?.reviewDecisionId || null;
  list.replaceChildren();
  model.decisions.forEach((decision, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hand-review-decision-button';
    button.dataset.reviewDecisionId = decision.decisionId;
    button.dataset.reviewDecisionIndex = String(index);
    button.dataset.comparison = decision.comparison.state;
    const selected = index === model.selectedDecisionIndex;
    const priority = index === model.priorityDecisionIndex;
    button.classList.toggle('is-selected', selected);
    button.classList.toggle('is-review-priority', priority);
    button.setAttribute('aria-current', selected ? 'true' : 'false');
    const number = document.createElement('span');
    number.className = 'hand-review-decision-number';
    number.textContent = String(decision.decisionNumber);
    const copy = document.createElement('span');
    copy.className = 'hand-review-decision-copy';
    const street = document.createElement('strong');
    street.textContent = reviewStreetLabel(decision.street);
    const context = document.createElement('span');
    context.textContent = reviewContextCopy(decision);
    const action = document.createElement('span');
    action.textContent = reviewActionCopy(decision.chosenAction, decision);
    copy.append(street, context, action);
    const state = document.createElement('span');
    state.className = 'hand-review-decision-state';
    state.textContent = reviewComparisonLabel(decision.comparison);
    if (priority) {
      const priorityLabel = document.createElement('small');
      priorityLabel.textContent = t('Review priority');
      state.appendChild(priorityLabel);
    }
    button.setAttribute('aria-label', t('Decision {number}: {street}, {context}, Hero chose {action}, {comparison}', {
      number: decision.decisionNumber,
      street: reviewStreetLabel(decision.street),
      context: reviewContextCopy(decision),
      action: reviewActionCopy(decision.chosenAction, decision),
      comparison: reviewComparisonLabel(decision.comparison)
    }));
    button.addEventListener('click', () => selectActiveHandReviewDecision(index, { preserveFocus: true }));
    button.append(number, copy, state);
    list.appendChild(button);
  });
  if (focusedDecisionId) {
    list.querySelector(`[data-review-decision-id="${CSS.escape(focusedDecisionId)}"]`)?.focus({ preventScroll: true });
  }
}

function renderActiveHandReview() {
  const model = app.handReview.model || refreshActiveHandReviewModel();
  const surface = model ? mountActiveHandReview() : null;
  if (!surface || !model?.selectedDecision) {
    if ($('#handReviewSurface')) $('#handReviewSurface').hidden = true;
    return null;
  }
  const decision = model.selectedDecision;
  surface.dataset.comparison = decision.comparison.state;
  $('#trainingReviewHand')?.setAttribute('aria-expanded', String(model.source === 'training_full_hand'));

  if ($('#handReviewProgress')) $('#handReviewProgress').textContent = `${model.selectedDecisionIndex + 1} / ${model.decisions.length}`;
  renderHandReviewCards($('#handReviewFinalBoard'), model.overview.finalBoard, 'No final board');
  const heroDelta = model.overview.heroStackDeltaMilliBb;
  const result = Number.isSafeInteger(heroDelta)
    ? `${heroDelta > 0 ? '+' : ''}${formatCanonicalBb(heroDelta)}`
    : t('Unavailable');
  if ($('#handReviewResult')) {
    $('#handReviewResult').textContent = model.overview.terminalReason === 'showdown'
      ? t('Showdown · Hero {result}', { result })
      : t('Ended by fold · Hero {result}', { result });
  }
  if ($('#handReviewDecisionCount')) $('#handReviewDecisionCount').textContent = String(model.overview.decisionCount);
  if ($('#handReviewComparableCount')) $('#handReviewComparableCount').textContent = String(model.overview.comparableDecisionCount);
  if ($('#handReviewUnavailableCount')) $('#handReviewUnavailableCount').textContent = String(model.overview.unavailableDecisionCount);
  if ($('#handReviewOverviewSource')) $('#handReviewOverviewSource').textContent = strategySourceDisplayLabel({
    source: model.overview.selectedReference?.id,
    sourceDescriptor: decision.claimPolicy.source
  });
  if ($('#handReviewAlignmentSummary')) {
    const counts = model.overview.alignmentCounts;
    $('#handReviewAlignmentSummary').textContent = model.overview.alignmentSummaryPermitted
      ? t('{matches} matches · {close} close · {differences} differences', {
        matches: counts.matches,
        close: counts.close,
        differences: counts.differs
      })
      : t('No decisions can be compared with the selected reference; canonical replay remains available.');
  }
  if ($('#handReviewPrioritySummary')) {
    const priority = model.decisions[model.priorityDecisionIndex];
    $('#handReviewPrioritySummary').textContent = priority?.reviewPriority
      ? t('Review priority: Decision {number} has the strongest probability disagreement with this reference. This is not EV loss.', {
        number: priority.decisionNumber
      })
      : t('Review priority is unavailable because this reference cannot compare the decisions.');
  }

  renderHandReviewDecisionList(model);
  if ($('#handReviewPreviousDecision')) $('#handReviewPreviousDecision').disabled = !model.navigation.canPreviousDecision;
  if ($('#handReviewNextDecision')) $('#handReviewNextDecision').disabled = !model.navigation.canNextDecision;
  if ($('#handReviewDecisionStreet')) $('#handReviewDecisionStreet').textContent = reviewStreetLabel(decision.street);
  if ($('#handReviewDecisionTitle')) $('#handReviewDecisionTitle').textContent = t('Hero Decision {number}', { number: decision.decisionNumber });
  if ($('#handReviewDecisionContext')) $('#handReviewDecisionContext').textContent = reviewContextCopy(decision);
  const comparisonBadge = $('#handReviewComparisonBadge');
  if (comparisonBadge) {
    comparisonBadge.textContent = reviewComparisonLabel(decision.comparison);
    comparisonBadge.className = `badge status-badge status-badge--${reviewComparisonTone(decision.comparison)}`;
  }
  renderHandReviewCards($('#handReviewHeroCards'), decision.durable.heroCards, 'Cards unavailable');
  renderHandReviewCards($('#handReviewBoardCards'), decision.durable.board, 'No board cards yet');
  if ($('#handReviewChosenAction')) $('#handReviewChosenAction').textContent = reviewActionCopy(decision.chosenAction, decision);
  const sourceLabel = decision.strategyResult
    ? strategySourceDisplayLabel(decision.strategyResult)
    : strategySourceDisplayLabel(decision.source.id);
  if ($('#handReviewSourceBadge')) $('#handReviewSourceBadge').textContent = sourceLabel;
  if (model.source === 'training_full_hand') {
    if ($('#trainingStrategySource')) {
      $('#trainingStrategySource').textContent = sourceLabel;
      $('#trainingStrategySource').className = 'badge status-badge status-badge--info';
    }
    if ($('#trainingReferenceSummaryValue')) {
      $('#trainingReferenceSummaryValue').textContent = sourceLabel;
    }
    if ($('#trainingReferenceSummaryNote')) {
      $('#trainingReferenceSummaryNote').textContent = [
        reviewComparisonLabel(decision.comparison),
        t({
          exact: 'Exact covered context',
          generalized: 'Generalized context',
          unsupported: 'Unsupported context',
        }[decision.source.coverage] || 'Unsupported context'),
      ].join(' · ');
    }
  }
  renderHandReviewFrequencyComparison(decision);
  if ($('#handReviewComparisonNote')) {
    $('#handReviewComparisonNote').textContent = decision.source.coverage === 'generalized'
      ? t('Riverline reference mixes are generalized for this context; they support comparison, not objective GTO truth.')
      : decision.comparison.state === 'unavailable'
        ? t('Reference comparison is unavailable. The canonical decision and replay remain fully usable.')
        : t('The chosen action is highlighted inside the full source mix; no pure strategy is implied.');
  }

  if ($('#handReviewPosition')) $('#handReviewPosition').textContent = decision.durable.heroPosition || t('Unavailable');
  if ($('#handReviewPot')) $('#handReviewPot').textContent = Number.isFinite(decision.context.potBb) ? `${decision.context.potBb} bb` : t('Unavailable');
  if ($('#handReviewStack')) $('#handReviewStack').textContent = Number.isFinite(decision.context.heroStackBb) ? `${decision.context.heroStackBb} bb` : t('Unavailable');
  if ($('#handReviewOpponents')) {
    const opponentPositions = decision.context.effectiveStackByOpponent
      .map((entry) => entry.position)
      .filter(Boolean);
    $('#handReviewOpponents').textContent = Number.isSafeInteger(decision.context.opponentCount)
      ? `${decision.context.opponentCount}${opponentPositions.length > 0 ? ` · ${opponentPositions.join(' · ')}` : ''}`
      : t('Unavailable');
  }
  if ($('#handReviewFacing')) $('#handReviewFacing').textContent = reviewContextCopy(decision);
  if ($('#handReviewCallPrice')) $('#handReviewCallPrice').textContent = Number.isFinite(decision.context.callAmountBb) ? `${decision.context.callAmountBb} bb` : t('Unavailable');
  if ($('#handReviewLegalAlternatives')) {
    $('#handReviewLegalAlternatives').textContent = decision.legalAlternatives.length > 0
      ? decision.legalAlternatives.map((entry) => reviewActionLabel(entry.type, decision.durable.decisionContext)).join(' · ')
      : t('Unavailable');
  }
  if ($('#handReviewEffectiveStack')) {
    $('#handReviewEffectiveStack').textContent = Number.isFinite(decision.context.effectiveStackBb)
      ? `${decision.context.effectiveStackBb} bb`
      : decision.context.effectiveStackByOpponent.length > 0
        ? decision.context.effectiveStackByOpponent.map((entry) => `${entry.position}: ${entry.effectiveStackBb} bb`).join(' · ')
        : t('Unavailable');
  }
  if ($('#handReviewReplayPoint')) {
    $('#handReviewReplayPoint').textContent = t('Frame {frame} · before Hero acts', {
      frame: decision.replayFrameTarget.frameIndex + 1
    });
  }
  if ($('#handReviewSourceDetail')) $('#handReviewSourceDetail').textContent = `${sourceLabel}${decision.source.version ? ` · ${decision.source.version}` : ''}`;
  if ($('#handReviewCoverage')) $('#handReviewCoverage').textContent = t({ exact: 'Exact covered context', generalized: 'Generalized context', unsupported: 'Unsupported context' }[decision.source.coverage] || 'Unsupported context');
  if ($('#handReviewPrecision')) $('#handReviewPrecision').textContent = decision.source.exactFrequencies ? t('Exact source frequencies') : decision.distribution.length > 0 ? t('Approximate source frequencies') : t('Frequencies unavailable');
  if ($('#handReviewLimitations')) $('#handReviewLimitations').textContent = decision.limitations.length > 0
    ? decision.limitations.map((code) => reviewLimitationLabel(code, decision)).join(' ')
    : t('No source limitation is declared for this covered context.');

  const replayStatus = $('#handReviewReplayStatus');
  if (replayStatus) replayStatus.textContent = model.replay.synchronizedToSelectedDecision
    ? t('Table is at the pre-action decision frame.')
    : t('Replay moved to frame {current} of {total}; the selected decision remains marked.', {
      current: model.replay.currentStep,
      total: model.replay.totalSteps
    });
  if ($('#handReviewPreviousEvent')) $('#handReviewPreviousEvent').disabled = !model.replay.canPrevious;
  if ($('#handReviewNextEvent')) $('#handReviewNextEvent').disabled = !model.replay.canNext;
  if ($('#handReviewSelectedFrame')) $('#handReviewSelectedFrame').hidden = model.replay.synchronizedToSelectedDecision;

  const actionVisibility = {
    handReviewAnalyze: model.actions.analyze,
    handReviewSaveSpot: model.actions.saveSpot,
    handReviewSaveHand: model.actions.saveHand,
    handReviewRepeat: model.actions.repeat,
    handReviewNext: model.actions.next,
    handReviewReturn: model.actions.returnToCompleted
  };
  Object.entries(actionVisibility).forEach(([id, visible]) => {
    const button = $('#' + id);
    if (button) button.hidden = !visible;
  });
  if ($('#handReviewSaveSpot')) {
    const saved = app.handReview.savedDecisionIds.has(decision.decisionId);
    $('#handReviewSaveSpot').disabled = saved;
    $('#handReviewSaveSpot').textContent = t(saved ? 'Saved decision' : 'Save this decision');
    setSavedStudyBookmarkState($('#handReviewSaveSpot'), saved);
  }
  if ($('#handReviewSaveHand') && model.actions.saveHand) {
    const canonicalSave = $('#savedStudySaveButton');
    $('#handReviewSaveHand').disabled = !canonicalSave || canonicalSave.disabled;
    $('#handReviewSaveHand').textContent = t(canonicalSave?.getAttribute('aria-pressed') === 'true' ? 'Saved' : 'Save hand');
    setSavedStudyBookmarkState(
      $('#handReviewSaveHand'),
      canonicalSave?.getAttribute('aria-pressed') === 'true',
    );
  }
  return model;
}

function selectActiveHandReviewDecision(index, { preserveFocus = false } = {}) {
  const model = app.handReview.model || refreshActiveHandReviewModel();
  if (!model || !Number.isSafeInteger(index) || index < 0 || index >= model.decisions.length) return null;
  app.handReview.selectedDecisionIndex = index;
  const target = model.decisions[index].replayFrameTarget.frameIndex;
  emitStudyExperience('review_decision_selected', {
    origin: 'review_selection',
    source: model.source || 'hand_review',
    payload: {
      decisionId: model.decisions[index].decisionId,
      decisionIndex: index,
      frameIndex: target,
    },
  });
  activeHandReviewReplayOperation('select', target);
  refreshActiveHandReviewModel();
  if (app.handReview.source === 'training_full_hand') {
    dispatchFullHandTrainingTable(app.training.fullHandSnapshot, { review: true });
    renderActiveHandReview();
  }
  if (preserveFocus) {
    $('#handReviewDecisionList')?.querySelector(`[data-review-decision-index="${index}"]`)?.focus({ preventScroll: true });
  }
  return app.handReview.model;
}

function stepActiveHandReviewDecision(delta) {
  const model = app.handReview.model || refreshActiveHandReviewModel();
  if (!model?.selectedDecision) return null;
  return selectActiveHandReviewDecision(model.selectedDecisionIndex + delta);
}

function stepActiveHandReviewReplay(operation, ...args) {
  activeHandReviewReplayOperation(operation, ...args);
  refreshActiveHandReviewModel();
  if (app.handReview.source === 'training_full_hand') {
    dispatchFullHandTrainingTable(app.training.fullHandSnapshot, { review: true });
  }
  return renderActiveHandReview();
}

function openCanonicalHandReview() {
  const journal = callPlaybookStateBridge('getHeroDecisionJournal');
  if (!journal || journal.status !== 'complete' || journal.decisions.length === 0) {
    toast(t('No recorded Hero decision is available for review.'), 'warning');
    return null;
  }
  app.handReview.source = 'canonical_hand';
  app.handReview.selectedDecisionIndex = null;
  const model = refreshActiveHandReviewModel();
  if (!model?.selectedDecision) return null;
  selectActiveHandReviewDecision(model.selectedDecisionIndex);
  const rendered = renderActiveHandReview();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  $('#handReviewSurface')?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  return rendered;
}

async function saveActiveHandReviewDecision() {
  const model = app.handReview.model || refreshActiveHandReviewModel();
  const decision = model?.selectedDecision;
  if (!decision || app.handReview.savedDecisionIds.has(decision.decisionId)) return null;
  const button = $('#handReviewSaveSpot');
  if (button) button.disabled = true;
  try {
    const result = await callSavedStudyBridge('saveReviewedDecisionSpot', {
      decisionId: decision.decisionId,
      canonicalHandId: model.handId,
      actionSequenceCount: decision.replayFrameTarget.actionSequence,
      decisionContext: decision.durable.decisionContext,
      rulesSnapshot: decision.durable.rulesSnapshot,
      savedHandObjectId: model.source === 'canonical_hand' ? savedStudyCurrentObject?.id ?? null : null,
      sourceSurface: model.source === 'training_full_hand' ? 'training' : 'replay',
      sourceId: `${model.handId}:${decision.decisionId}`,
      title: t('Hero Decision {number} · {street}', {
        number: decision.decisionNumber,
        street: reviewStreetLabel(decision.street)
      })
    });
    app.handReview.savedDecisionIds.add(decision.decisionId);
    renderActiveHandReview();
    toast(t('Saved decision.'), 'success');
    return result;
  } catch (error) {
    if (error?.code !== 'persistent_identity_cancelled') {
      console.error('[Riverline Hand Review save]', error);
      toast(t('Save failed'), 'error');
    }
    renderActiveHandReview();
    return null;
  }
}

function bindHandReviewWorkspace() {
  $('#handReviewPreviousDecision')?.addEventListener('click', () => stepActiveHandReviewDecision(-1));
  $('#handReviewNextDecision')?.addEventListener('click', () => stepActiveHandReviewDecision(1));
  $('#handReviewPreviousEvent')?.addEventListener('click', () => stepActiveHandReviewReplay('previous'));
  $('#handReviewNextEvent')?.addEventListener('click', () => stepActiveHandReviewReplay('next'));
  $('#handReviewSelectedFrame')?.addEventListener('click', () => {
    const frameIndex = app.handReview.model?.selectedDecision?.replayFrameTarget.frameIndex;
    if (Number.isSafeInteger(frameIndex)) stepActiveHandReviewReplay('select', frameIndex);
  });
  $('#handReviewAnalyze')?.addEventListener('click', () => {
    if (app.handReview.source === 'training_full_hand') openFullHandDecisionInAnalysis();
    else openCanonicalHandDecisionInAnalysis(app.handReview.model?.selectedDecisionIndex);
  });
  $('#handReviewSaveSpot')?.addEventListener('click', saveActiveHandReviewDecision);
  $('#handReviewSaveHand')?.addEventListener('click', () => $('#savedStudySaveButton')?.click());
  $('#handReviewRepeat')?.addEventListener('click', replayCurrentTrainingSeed);
  $('#handReviewNext')?.addEventListener('click', () => startConfiguredTrainingSession());
  $('#handReviewReturn')?.addEventListener('click', () => closeActiveHandReview());
}

function revealCanonicalHandHistory({ replay = false } = {}) {
  if (replay) callPlaybookStateBridge('startReplayPlayback');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  $('#handHistorySection')?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
}

function scenarioInputFromHeroDecisionRecord(record) {
  const context = record?.decisionContext;
  if (!context || !record?.rulesSnapshot) return null;
  return {
    schemaVersion: PLAYBOOK_SCENARIO_V2_SCHEMA_VERSION,
    rulesSnapshot: record.rulesSnapshot,
    tableSize: context.tableSize,
    heroPosition: context.heroPosition,
    street: context.street,
    heroCards: [...context.heroCards],
    board: [...context.board],
    deadCards: [...context.deadCards],
    stackBb: context.stackBb,
    stackMode: context.stackMode,
    potBb: context.currentPotBb ?? context.potBb,
    lastAction: context.lastAction,
    lastActionLabel: null,
    facingSizeBb: context.facingSizeBb
  };
}

async function openCanonicalHandDecisionInAnalysis(decisionIndex = null) {
  const journal = callPlaybookStateBridge('getHeroDecisionJournal');
  const record = Number.isSafeInteger(decisionIndex)
    ? journal?.decisions?.[decisionIndex] || null
    : journal?.decisions?.at(-1) || null;
  const scenarioInput = scenarioInputFromHeroDecisionRecord(record);
  if (!record || !scenarioInput) {
    toast(t('No recorded Hero decision is available for Analysis.'), 'warning');
    return null;
  }

  const result = callPlaybookStateBridge('setMode', PLAYBOOK_MODES.SCENARIO, scenarioInput);
  if (!result || result.mode !== PLAYBOOK_MODES.SCENARIO) {
    toast(t('The recorded Hero decision could not be opened.'), 'error');
    return null;
  }
  app.playbookMode = PLAYBOOK_MODES.SCENARIO;
  callPlaybookStateBridge('resolveDecisionContext', scenarioInput);
  savedPlaybookScenarioPresentation = null;
  activeSavedSpotContext = null;
  renderSavedSpotViewer(null);
  setPlaybookControlAuthority(PLAYBOOK_MODES.SCENARIO);
  restoreSavedSpotPresentation({
    scenarioInput,
    decisionContext: record.decisionContext,
    object: { annotations: { title: t('Hero Decision {number}', { number: record.decisionOrdinal + 1 }) } }
  });
  restoreSharedPokerTable();
  navigateToWorkspace('gto', 'analyze');
  await updateContext('Completed Hand decision opened', {
    schemaVersion: 'playbook-decision-resolution/v1',
    mode: PLAYBOOK_MODES.SCENARIO,
    status: 'available',
    reason: 'completed_hand_hero_decision',
    error: null,
    decisionContext: record.decisionContext
  });
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  $('#contextView')?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  return record;
}

function bindCanonicalHandWorkspace() {
  syncHandSeatSelectors();
  ['handTableSize', 'handGameMode', 'handAnteType'].forEach((id) => {
    if ($('#' + id)) $('#' + id).addEventListener('change', syncHandSeatSelectors);
  });
  if ($('#handStartButton')) $('#handStartButton').addEventListener('click', startCanonicalPlaybookHand);
  if ($('#handResetButton')) $('#handResetButton').addEventListener('click', resetCanonicalPlaybookHand);
  $('#handHistoryDisclosure')?.addEventListener('toggle', (event) => {
    const key = event.currentTarget.open ? 'Collapse' : 'Expand';
    const action = $('#handHistoryDisclosureAction');
    if (action) {
      action.textContent = t(key);
      action.dataset.i18n = key;
    }
  });
  ['handSizingMinPreset', 'handSizingMaxPreset'].forEach((id) => {
    $('#' + id)?.addEventListener('click', (event) => {
      const value = Number(event.currentTarget.dataset.amountToBb);
      const input = $('#handActionAmountBb');
      if (!input || !Number.isFinite(value)) return;
      input.value = String(value);
      if ($('#handActionAmountRange')) $('#handActionAmountRange').value = String(value);
      syncCanonicalSizedActionCommitState();
      $('#handCommitSizedAction')?.focus();
    });
  });
  $('#handActionAmountRange')?.addEventListener('input', (event) => {
    if ($('#handActionAmountBb')) $('#handActionAmountBb').value = event.currentTarget.value;
    syncCanonicalSizedActionCommitState();
  });
  $('#handActionAmountBb')?.addEventListener('input', (event) => {
    const range = $('#handActionAmountRange');
    const value = Number(event.currentTarget.value);
    if (range && Number.isFinite(value)) {
      range.value = String(Math.min(Number(range.max), Math.max(Number(range.min), value)));
    }
    syncCanonicalSizedActionCommitState();
  });
  $('#handActionAmountBb')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') commitCanonicalSizedAction();
  });
  $('#handActionSizing')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    const selectedType = app.playbookHandDraft.sizedAction;
    app.playbookHandDraft.sizedAction = null;
    event.currentTarget.hidden = true;
    const selectedAction = $$('#handLegalActions [data-canonical-action]')
      .find((button) => button.dataset.canonicalAction === selectedType);
    selectedAction?.setAttribute('aria-pressed', 'false');
    selectedAction?.focus();
  });
  $('#handCommitSizedAction')?.addEventListener('click', commitCanonicalSizedAction);
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
  $('#handCompletedReviewButton')?.addEventListener('click', openCanonicalHandReview);
  $('#handCompletedReplayButton')?.addEventListener('click', () => revealCanonicalHandHistory({ replay: true }));
  $('#handCompletedAnalysisButton')?.addEventListener('click', openCanonicalHandDecisionInAnalysis);
  $('#handCompletedSaveButton')?.addEventListener('click', () => $('#savedStudySaveButton')?.click());
  $('#handCompletedNewHandButton')?.addEventListener('click', prepareCanonicalNewHand);
  bindHandReviewWorkspace();
}



function deriveDecisionContext(snapshot = {}) {

  const derivationEvents = [];
  const tableSize = coreNormalizedDecisionNumber(
    snapshot.tableSize, 6, 2, 10, 'tableSize', derivationEvents, true
  );
  const heroPosition = typeof snapshot.heroPosition === 'string' && snapshot.heroPosition
    ? snapshot.heroPosition
    : 'BTN';
  if (heroPosition !== snapshot.heroPosition) {
    derivationEvents.push(coreDecisionDerivationEvent(
      'heroPosition', 'defaulted', 'missing_position_default', heroPosition, snapshot.heroPosition
    ));
  }
  const heroCards = normalizedDecisionCards(snapshot.heroCards);
  const board = normalizedDecisionCards(snapshot.board);
  const deadCards = normalizedDecisionCards(snapshot.deadCards);
  [
    ['heroCards', heroCards], ['board', board], ['deadCards', deadCards]
  ].forEach(([field, value]) => derivationEvents.push(coreDecisionDerivationEvent(
    field, 'normalized', 'scenario_card_array_projection', value
  )));
  const stackEventStart = derivationEvents.length;
  const stackBb = coreNormalizedDecisionNumber(
    snapshot.stackBb, 100, 10, 500, 'stackBb', derivationEvents
  );
  for (const event of derivationEvents.slice(stackEventStart)) {
    derivationEvents.push({
      ...event,
      field: 'startingStackBb',
      code: `scenario_configured_stack_${event.code}`
    });
  }
  const stackMode = typeof snapshot.stackMode === 'string' && snapshot.stackMode
    ? snapshot.stackMode
    : 'hero';
  if (stackMode !== snapshot.stackMode) {
    derivationEvents.push(coreDecisionDerivationEvent(
      'stackMode', 'defaulted', 'missing_stack_mode_default', stackMode, snapshot.stackMode
    ));
  }
  const currentPotBb = coreScenarioCurrentPotBb(snapshot.potBb, derivationEvents);
  const potBb = coreNormalizedDecisionNumber(
    snapshot.potBb, 1.5, 0.5, 200, 'potBb', derivationEvents
  );
  const lastAction = typeof snapshot.lastAction === 'string' && snapshot.lastAction
    ? snapshot.lastAction
    : 'unopened';
  if (lastAction !== snapshot.lastAction) {
    derivationEvents.push(coreDecisionDerivationEvent(
      'lastAction', 'defaulted', 'missing_prior_action_default', lastAction, snapshot.lastAction
    ));
  }
  const street = currentStreet(board);
  derivationEvents.push(coreDecisionDerivationEvent(
    'street', 'normalized', 'derived_from_board_count', street, snapshot.street
  ));
  const rawFacingSizeBb = coreNormalizedDecisionNumber(
    snapshot.facingSizeBb, 0, 0, 100, 'facingSizeBb', derivationEvents
  );
  const facingSizeBb = normalizeFacingSize(lastAction, rawFacingSizeBb);
  if (facingSizeBb !== rawFacingSizeBb) {
    derivationEvents.push(coreDecisionDerivationEvent(
      'facingSizeBb', 'normalized', 'unopened_facing_size_zeroed', facingSizeBb, rawFacingSizeBb
    ));
  }
  // Scenario mode deliberately does not reconstruct a legal betting history.
  // Only an explicit check, or the BB's unopened check option, proves a free price.
  const callAmountBb = (lastAction === 'check'
    || (lastAction === 'unopened' && heroPosition === 'BB')) ? 0 : null;
  derivationEvents.push(callAmountBb === null
    ? coreDecisionUnavailableField('callAmountBb', 'scenario_exact_call_price_unavailable')
    : coreDecisionDerivationEvent(
      'callAmountBb', 'normalized', 'scenario_free_price_category', 0
    ));
  const priorActionSummary = coreScenarioPriorActionSummary(street, lastAction);
  derivationEvents.push(
    coreDecisionUnavailableField('opponentCount', 'scenario_live_opponents_unavailable'),
    coreDecisionUnavailableField('heroStackBb', 'scenario_live_stack_unavailable'),
    coreDecisionUnavailableField('effectiveStackBb', 'scenario_effective_stack_unavailable'),
    coreDecisionUnavailableField(
      'effectiveStackByOpponent', 'scenario_opponent_stacks_unavailable', []
    ),
    coreDecisionUnavailableField(
      'heroStreetContributionBb', 'scenario_street_contribution_unavailable'
    ),
    coreDecisionUnavailableField('canRaise', 'scenario_legal_actions_unavailable'),
    coreDecisionUnavailableField('minRaiseToBb', 'scenario_legal_actions_unavailable'),
    coreDecisionUnavailableField('maxRaiseToBb', 'scenario_legal_actions_unavailable'),
    coreDecisionUnavailableField('allInToBb', 'scenario_live_stack_unavailable'),
    coreDecisionUnavailableField(
      'priorActionSummary.lastActorPosition', 'scenario_actor_position_unavailable'
    ),
    coreDecisionUnavailableField(
      'priorActionSummary.aggressorPosition', 'scenario_aggressor_position_unavailable'
    )
  );
  if (priorActionSummary.aggressionCount === null) {
    derivationEvents.push(coreDecisionUnavailableField(
      'priorActionSummary.aggressionCount', 'scenario_exact_aggression_count_unavailable'
    ));
  }
  if (priorActionSummary.limperCount === null) {
    derivationEvents.push(coreDecisionUnavailableField(
      'priorActionSummary.limperCount', 'scenario_limper_count_unavailable'
    ));
  }
  const positionRelation = street === 'preflop' ? 'not_applicable' : 'unknown';
  const aggressorPositionRelation = street === 'preflop' ? 'not_applicable' : 'unknown';
  if (positionRelation === 'unknown') {
    derivationEvents.push(
      coreDecisionUnavailableField(
        'positionRelation', 'scenario_seat_order_unavailable', 'unknown'
      ),
      coreDecisionUnavailableField(
        'aggressorPositionRelation', 'scenario_seat_order_unavailable', 'unknown'
      )
    );
  }
  const supportedRakeModes = ['off', 'fixed'];
  if (!supportedRakeModes.includes(snapshot.rakeMode)) {
    throw new RangeError(`Unsupported legacy Scenario rakeMode: ${String(snapshot.rakeMode)}`);
  }
  const rakeMode = snapshot.rakeMode;
  const accounting = strategyAccountingContext(rakeMode, tableSize);

  return {
    schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
    contractVersion: DECISION_CONTEXT_CONTRACT_VERSION,
    tableSize,
    // Scenario mode knows seated players only; it must not claim an exact live count.
    opponentCount: null,
    heroPosition,
    street,
    heroCards,
    board,
    deadCards,
    stackBb,
    stackMode,
    startingStackBb: stackBb,
    heroStackBb: null,
    effectiveStackBb: null,
    effectiveStackByOpponent: [],
    positionRelation,
    aggressorPositionRelation,
    currentPotBb,
    potBb,
    lastAction,
    priorActionSummary,
    facingSizeBb,
    callAmountBb,
    heroStreetContributionBb: null,
    canRaise: null,
    minRaiseToBb: null,
    maxRaiseToBb: null,
    allInToBb: null,
    rakeMode: accounting.rakeMode,
    forcedContributionPerPlayerBb: accounting.forcedContributionPerPlayerBb,
    totalForcedContributionBb: accounting.totalForcedContributionBb,
    derivation: {
      schemaVersion: DECISION_CONTEXT_DERIVATION_SCHEMA_VERSION,
      source: 'scenario',
      defaultQuality: 'exact',
      events: derivationEvents
    }
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

  const heroCards = (context?.heroCards || app.gto?.hero || []).filter(Boolean);
  const boardCards = (context?.board || app.gto?.board || []).filter(Boolean);
  const mEquity = $('#mEquity');
  if (mEquity) mEquity.textContent = heroCards.length
    ? (formatHand(heroCards) || heroCards.map(displayCard).join(' '))
    : t('Unknown');

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
  if (mRake) mRake.textContent = boardCards.length
    ? boardCards.map(displayCard).join(' ')
    : t('Preflop · no board');

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





function projectHandClassesAfterCardRemoval(handClasses, blockers) {
  const authority = globalThis.RiverlineRangeCardRemoval;
  if (authority?.schemaVersion !== 'range-card-removal-projection/v1'
    || typeof authority.projectHandClasses !== 'function') return null;
  return authority.projectHandClasses({ handClasses, blockers });
}


function renderMatrixCellInspector(cell) {
  if (!cell?.dataset.hand) return;
  const actions = JSON.parse(cell.dataset.strategyActions || '[]');
  if ($('#selectedHand')) $('#selectedHand').textContent = cell.dataset.hand;
  if ($('#selectedHandKind')) $('#selectedHandKind').textContent = cell.dataset.handKindLabel || t('Hand class');
  if ($('#selectedHandPrimary')) {
    $('#selectedHandPrimary').textContent = cell.dataset.primaryLabel || t('Strategy unavailable');
    $('#selectedHandPrimary').dataset.actionKind = cell.dataset.primaryAction || 'unavailable';
  }
  if ($('#selectedAvailableCombos')) $('#selectedAvailableCombos').textContent = cell.dataset.availableCombos || '—';
  if ($('#selectedRemovedCombos')) $('#selectedRemovedCombos').textContent = cell.dataset.removedCombos || '—';
  if ($('#selectedRangeSource')) $('#selectedRangeSource').textContent = cell.dataset.sourceLabel || t('Unavailable');
  if ($('#selectedMix')) {
    const detail = cell.dataset.strategyCue || t('Strategy unavailable');
    $('#selectedMix').innerHTML = actions.length
      ? `<div class="matrix-inspector-actions">${actions.map((action) => `<span class="matrix-inspector-action"><i data-action-kind="${action.kind}"></i><span>${action.name}</span><strong>${action.value % 1 === 0 ? action.value : Number(action.value).toFixed(1)}%</strong></span>`).join('')}</div><div class="alloc" role="img" aria-label="${detail}">${actions.map((action) => `<i data-action-kind="${action.kind}" style="width:${action.value}%"></i>`).join('')}</div>`
      : `<span class="matrix-inspector-unavailable">${detail}</span>`;
  }
}

function restoreSelectedMatrixInspector(grid) {
  renderMatrixCellInspector(grid?.querySelector(`[data-hand="${app.selectedHand}"]`)
    || grid?.querySelector('[aria-pressed="true"]'));
}

function bindMatrixGridInteractions(grid) {
  if (!grid || grid.dataset.delegated) return;
  grid.dataset.delegated = 'true';
  grid.addEventListener('click', (event) => {
    const cell = event.target.closest('.hand-cell');
    if (!cell || !cell.dataset.hand) return;
    app.selectedHand = cell.dataset.hand;
    const selectedHand = $('#selectedHand');
    if (selectedHand) selectedHand.textContent = app.selectedHand;
    renderChart();
  });
  grid.addEventListener('pointerover', (event) => {
    const cell = event.target.closest('.hand-cell');
    if (!cell || (event.relatedTarget && cell.contains(event.relatedTarget))) return;
    renderMatrixCellInspector(cell);
  });
  grid.addEventListener('pointerout', (event) => {
    const cell = event.target.closest('.hand-cell');
    if (!cell || (event.relatedTarget && cell.contains(event.relatedTarget))) return;
    restoreSelectedMatrixInspector(grid);
  });
  grid.addEventListener('focusin', (event) => renderMatrixCellInspector(event.target.closest('.hand-cell')));
  grid.addEventListener('focusout', () => restoreSelectedMatrixInspector(grid));
  grid.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') restoreSelectedMatrixInspector(grid);
  });
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
  const matrixClaimPolicy = matrixModel.claimPolicy;
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
    grid.replaceChildren();
    if ($('#chartSelectionPreview')) $('#chartSelectionPreview').innerHTML = `<span>${t('Exact hand only')}</span>`;
    if ($('#selectedHand')) $('#selectedHand').textContent = t('Exact hand only');
    if ($('#selectedHandKind')) $('#selectedHandKind').textContent = t('Postflop decision');
    if ($('#selectedHandPrimary')) $('#selectedHandPrimary').textContent = t('Range expansion unavailable');
    if ($('#selectedAvailableCombos')) $('#selectedAvailableCombos').textContent = '—';
    if ($('#selectedRemovedCombos')) $('#selectedRemovedCombos').textContent = '—';
    if ($('#selectedRangeSource')) $('#selectedRangeSource').textContent = t('Unavailable');
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
    const matrixCell = matrixModel.cells[row * 13 + column];
    const actions = matrixCell?.actions || [];
    const dominantAction = actions.reduce((highest, action) =>
      Number(action.value) > Number(highest?.value ?? -1) ? action : highest, null);

    const type = dominantAction?.kind || 'unavailable';
    const handKind = row === column ? 'pair' : hand.endsWith('s') ? 'suited' : 'offsuit';
    const mixState = matrixMixState(actions, dominantAction);

    const detail = matrixCell?.cardRemovalState === 'fully_removed'
      ? t('Unavailable after known-card removal')
      : actions.length
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
    button.dataset.strategyCoverage = matrixClaimPolicy?.coverage?.kind || 'unsupported';
    button.dataset.strategyPrecision = matrixClaimPolicy?.capabilities?.actionDistribution || 'none';
    button.dataset.cardRemovalState = matrixCell?.cardRemovalState || 'unavailable';
    button.dataset.strategyCue = detail;
    button.setAttribute('aria-pressed', String(isSelected));

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
    button.dataset.handKindLabel = kindLabel;
    button.dataset.primaryLabel = dominantAction
      ? t('Primary · {action} {value}%', { action: t(dominantAction.name), value: dominantAction.value })
      : t('Strategy unavailable');
    button.dataset.availableCombos = matrixCell
      ? `${matrixCell.eligibleComboCount} / ${matrixCell.physicalComboCount}`
      : '—';
    button.dataset.removedCombos = matrixCell ? String(matrixCell.blockedComboCount) : '—';
    button.dataset.sourceLabel = matrixSource ? strategySourceDisplayLabel(matrixSource) : t('Unavailable');
    button.dataset.strategyActions = JSON.stringify(actions.map((action) => ({
      kind: visualActionKind(action),
      name: t(action.name),
      value: action.value,
    })));



    if (cellBg) {

      button.style.background = cellBg;

    } else if (actions.length > 0) {
      button.insertAdjacentHTML('beforeend', `<span class="matrix-mix-bar" aria-hidden="true">${actions.map((action) => `<i data-action-kind="${visualActionKind(action)}" style="width:${action.value}%"></i>`).join('')}</span>`);
    }



    if (isSelected) {

        const primaryAction = dominantAction;
        previewHTML = `<strong class="matrix-preview-hand">${hand}</strong><span class="matrix-preview-summary">${primaryAction ? `${t(primaryAction.name)} ${primaryAction.value}%` : t('Unavailable')}</span>`;
        renderMatrixCellInspector(button);

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
        : `${positions} · ${matrixStack} bb · ${strategyPolicySummary(matrixClaimPolicy)}`;
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
  let matrixClaimPolicy = null;
  const handClasses = RANKS.flatMap((_, row) => RANKS.map((__, column) => handCode(row, column)));
  const cardRemoval = !isPostFlop && !matrixContextUnavailable
    ? projectHandClassesAfterCardRemoval(
      handClasses,
      [...decisionContext.board, ...decisionContext.deadCards],
    )
    : null;
  const cells = RANKS.flatMap((_, row) => RANKS.map((__, column) => {
    const hand = handCode(row, column);
    let actions = [];
    if (!isPostFlop && !matrixContextUnavailable) {
      const representativeCards = cardRemoval?.cells[hand]?.firstEligibleCombo ?? null;
      if (representativeCards) {
        const cellDecisionContext = {
          ...decisionContext,
          heroCards: representativeCards
        };
        const cellStrategyResult = strategyProvider.resolve(cellDecisionContext);
        matrixSource = matrixSource || cellStrategyResult.source;
        matrixClaimPolicy = matrixClaimPolicy || strategyClaimPolicy(cellStrategyResult);
        if (cellStrategyResult.source !== strategyProvider.sources.UNAVAILABLE) {
          actions = strategyResultPresentationActions(cellStrategyResult);
        }
      }
    }
    return {
      hand,
      actions,
      physicalComboCount: cardRemoval?.cells[hand]?.physicalComboCount ?? 0,
      eligibleComboCount: cardRemoval?.cells[hand]?.eligibleComboCount ?? 0,
      blockedComboCount: cardRemoval?.cells[hand]?.blockedComboCount ?? 0,
      cardRemovalState: !cardRemoval
        ? 'unavailable'
        : cardRemoval.cells[hand]?.fullyRemoved ? 'fully_removed' : 'eligible',
    };
  }));
  app.matrixModel = {
    key,
    source: matrixSource,
    claimPolicy: matrixClaimPolicy,
    isPostFlop,
    cells
  };
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
  const result = source && typeof source === 'object' ? source : null;
  const sourceId = result?.source || source;
  const descriptor = result?.sourceDescriptor
    || requireStrategyProviderBridge().sourceDescriptorFor(sourceId);
  return t(descriptor?.displayNameKey || descriptor?.displayName || String(sourceId || 'Unavailable'));
}

function strategyClaimPolicy(strategyResult) {
  return requireStrategyProviderBridge().claimsFor(strategyResult);
}

function localizedStrategyLimitation(policy) {
  const limitation = policy?.primaryLimitation;
  return limitation ? t(limitation.messageKey || limitation.message) : '';
}

function strategyPolicySummary(policy) {
  if (!policy || policy.availability !== 'available') return t('Source unavailable');
  const precision = policy.claims?.exact_frequencies
    ? t('Exact source frequencies')
    : policy.capabilities?.actionDistribution === 'qualitative'
      ? t('Qualitative strategy information')
      : t('Source frequencies');
  const coverage = policy.coverage?.kind === 'exact'
    ? t('Exact covered context')
    : t('Broad approximate coverage');
  return [
    strategySourceDisplayLabel({
      source: policy.source.id,
      sourceDescriptor: policy.source
    }),
    precision,
    coverage
  ].join(' · ');
}

function trainingGradePresentation(grade, strategyResult) {
  const semantics = strategyClaimPolicy(strategyResult).trainingSemantics;
  if (semantics === 'normative') {
    return {
      optimal: t('Correct'),
      acceptable: t('Acceptable'),
      mistake: t('Mistake')
    }[grade] || t('Review');
  }
  if (semantics === 'comparative') {
    return {
      optimal: t('Matches Riverline reference'),
      acceptable: t('Close to Riverline reference'),
      mistake: t('Differs from Riverline reference')
    }[grade] || t('Review');
  }
  return t('Reference unavailable');
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
  const claimPolicy = strategyClaimPolicy(strategyResult);
  const profile = strategyResultToLegacyProfile(strategyResult);
  const meaningfulActions = strategyResult.actions.filter((entry) => entry.probability >= 0.05).length;
  if (typeof setRecommendationState === 'function') {
    setRecommendationState(claimPolicy.primaryLimitation?.priority >= 70
      || strategyResult.warnings.length > 0
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
      bestSizing.textContent = globalThis.RiverlineAnalysisExplanation
        ?.formatSuggestedSizingBb?.(recommendationSizing.amountBb)
        ?? `${recommendationSizing.amountBb} bb`;
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
    const sourceLabel = strategySourceDisplayLabel(strategyResult);
    const sourceTone = claimPolicy.source.family === 'heuristic' ? 'heuristic' : 'info';
    const provenance = strategyPolicySummary(claimPolicy);
    sourceBadge.textContent = sourceLabel;
    sourceBadge.title = provenance;
    sourceBadge.setAttribute('aria-label', `${t('Strategy source')}: ${sourceLabel}`);
    sourceBadge.className = `badge status-badge status-badge--${sourceTone}`;
    const provenanceElement = $('#strategySourceProvenance');
    if (provenanceElement) provenanceElement.textContent = provenance;
  }

  const strategyMeta = $('#strategyMeta');
  if (strategyMeta) {
    const metadata = [
      t('Source version {version}', { version: claimPolicy.sourceVersion }),
      claimPolicy.coverage.kind === 'exact'
        ? t('Exact covered context')
        : t('Broad approximate coverage')
    ];
    strategyMeta.textContent = metadata.join(' · ');
    strategyMeta.hidden = metadata.length === 0;
  }

  const strategyWarnings = $('#strategyWarnings');
  if (strategyWarnings) {
    const warnings = [
      localizedStrategyLimitation(claimPolicy),
      ...localizedStrategyWarnings(strategyResult)
    ].filter(Boolean);
    strategyWarnings.textContent = [...new Set(warnings)].join(' · ');
    strategyWarnings.hidden = warnings.length === 0;
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

  const request = equityRequestFromCurrentInputs();
  const incompleteIndex = request.players.findIndex((player) => (
    player.cards !== null && player.cards.length !== 2
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
    estimate = callEquityServiceBridge('estimate', request);
    if (estimate?.ok === false) {
      state = 'blocked';
      message = equityFailureMessage(estimate.error);
    } else if (estimate?.ok) {
      const requestedMethod = request.method;
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

  if (!app.equity.staleAnalysis && app.equity.lifecycle !== 'complete') {
    if ($('#equityDetailRequested')) $('#equityDetailRequested').textContent = t(request.method === 'monte_carlo' ? 'Monte Carlo' : (request.method === 'exact' ? 'Exact' : 'Auto'));
    if ($('#equityDetailEstimate')) $('#equityDetailEstimate').textContent = estimate?.ok ? formatEquityCombinationCount(estimate) : '—';
    if ($('#equityDetailSamples')) $('#equityDetailSamples').textContent = request.samples.toLocaleString();
    if ($('#equityDetailSeed')) $('#equityDetailSeed').textContent = request.seed === undefined ? t('Generated at run time') : String(request.seed);
    if ($('#equityDetailUnknown')) $('#equityDetailUnknown').textContent = String(request.players.filter((player) => player.cards === null).length);
    if ($('#equityDetailBoard')) $('#equityDetailBoard').textContent = String(5 - request.board.length);
  }
  return { state, message, estimate, request };
}

function setEquityCalculationRunning(running, options) {
  const refreshReadiness = options?.refreshReadiness !== false;
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
  setEquityCompositionState(running ? 'running' : $('#equityResultsPanel')?.dataset.resultState);
  if ($('#equityDetailExecution')) $('#equityDetailExecution').textContent = running
    ? t(callEquityServiceBridge('isWorkerBacked') ? 'Web Worker' : 'In-process fallback')
    : t('Ready');
  if (!running && refreshReadiness) updateEquityReadiness();
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
  if (app.equity.lastResult) app.equity.staleResult = app.equity.lastResult;
  if (app.equity.lastAnalysis) app.equity.staleAnalysis = app.equity.lastAnalysis;
  if (app.equity.lastAnalysisLabels) app.equity.staleAnalysisLabels = app.equity.lastAnalysisLabels;
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
  renderEquityHandAnalysis();
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
    setEquityCompositionState($('#equityResultsPanel').dataset.resultState);
    renderEquityPlayerResults();
    renderEquityHandAnalysis();
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
  setEquityCompositionState('empty');
  renderEquityPlayerResults();
  renderEquityHandAnalysis();
  return true;
}

function equityReadOnlyCardsMarkup(cards, label) {
  if (cards === null) {
    return `<span class="equity-result-unknown" aria-label="${escapeEquityMarkup(t('{player}: unknown hand', { player: label }))}"><span class="poker-card-back riverline-card-back" data-card-size="result" aria-hidden="true"></span><span class="poker-card-back riverline-card-back" data-card-size="result" aria-hidden="true"></span><span>${t('Unknown hand')}</span></span>`;
  }
  if (!cards?.length) return `<span class="equity-context-empty">${t('No cards')}</span>`;
  return `<span class="equity-readonly-cards">${cards.map((card) => `<span class="training-readonly-card riverline-card" data-card-size="result" role="img" aria-label="${displayCard(card)}">${cardMarkup(card)}</span>`).join('')}</span>`;
}

function setEquityCompositionState(state) {
  const workspace = document.querySelector('.equity-workspace');
  if (!workspace) return 'empty';
  const supported = new Set(['empty', 'stale', 'running', 'complete', 'error']);
  const resolved = supported.has(state) ? state : 'empty';
  workspace.dataset.equityState = resolved;
  return resolved;
}

function clearEquityResults(state = 'empty', status = t('Results update after calculation.'), { renderPlayerFooters = true } = {}) {
  const panel = $('#equityResultsPanel');
  if (panel) panel.dataset.resultState = state;
  setEquityCompositionState(state);
  if ($('#equityStatus')) $('#equityStatus').textContent = status;
  if (!app.equity.staleResult) {
    if ($('#equitySplitSummary')) $('#equitySplitSummary').textContent = '—';
    if ($('#equityDetailActual')) $('#equityDetailActual').textContent = '—';
  }
  if (renderPlayerFooters) renderEquityPlayerResults();
}

function renderEquityResult(equityResult, request = equityRequestFromCurrentInputs(), { announce = true, rebuildAnalysis = true } = {}) {
  const bridge = globalThis.RiverlineAnalysisExplanation;
  let analysis = rebuildAnalysis ? null : app.equity.lastAnalysis;
  if (rebuildAnalysis && typeof bridge?.createEquityHandAnalysisProjection === 'function') {
    try {
      analysis = bridge.createEquityHandAnalysisProjection({
        players: request.players.map((player) => ({ id: player.id, cards: player.cards === null ? null : [...player.cards] })),
        board: [...request.board],
        deadCards: [...request.deadCards]
      });
    } catch (_error) {
      analysis = null;
    }
  }
  app.equity.lifecycle = 'complete';
  app.equity.lastResult = equityResult;
  app.equity.staleResult = null;
  app.equity.lastAnalysis = analysis;
  app.equity.staleAnalysis = null;
  app.equity.lastAnalysisLabels = Object.fromEntries(app.equity.players.map((player, playerIndex) => [player.id, equityPlayerLabel(playerIndex)]));
  app.equity.staleAnalysisLabels = null;
  app.equity.lastRequest = structuredClone(request);
  app.equity.lastError = null;
  const exact = equityResult.exact;
  const total = equityResult.trials;
  const splitRate = equityResult.metadata.splitPotTrials / total * 100;
  const requestedLabel = t(request.method === 'auto' ? 'AUTO' : (request.method === 'exact' ? 'EXACT' : 'MONTE CARLO'));
  const actualLabel = t(exact ? 'EXACT' : 'MONTE CARLO');

  $('#equityStatus').textContent = exact
    ? t('Exact enumeration · {count} outcomes', { count: total.toLocaleString() })
    : t('Monte Carlo · {count} trials', { count: total.toLocaleString() });

  $('#methodBadge').textContent = request.method === 'auto' ? `${requestedLabel} → ${actualLabel}` : actualLabel;
  if ($('#calculate')) {
    $('#calculate').dataset.i18n = 'Recalculate';
    $('#calculate').textContent = t('Recalculate');
  }

  renderEquityPlayerResults();
  renderEquityHandAnalysis();
  if ($('#equityResultsPanel')) $('#equityResultsPanel').dataset.resultState = 'complete';
  setEquityCompositionState('complete');
  if ($('#equitySplitSummary')) $('#equitySplitSummary').textContent = `${equityResult.metadata.splitPotTrials.toLocaleString()} · ${splitRate.toFixed(1)}%`;
  if ($('#equityDetailActual')) $('#equityDetailActual').textContent = t(exact ? 'Exact enumeration' : 'Monte Carlo simulation');
  if ($('#equityDetailEstimate')) $('#equityDetailEstimate').textContent = t('{count} combinations', { count: equityResult.metadata.estimatedCombinationsText });
  if ($('#equityDetailSamples')) $('#equityDetailSamples').textContent = exact ? t('Not applicable') : equityResult.metadata.samplesCompleted.toLocaleString();
  if ($('#equityDetailSeed')) $('#equityDetailSeed').textContent = exact ? t('Not applicable') : String(equityResult.metadata.seed);
  if ($('#equityDetailUnknown')) $('#equityDetailUnknown').textContent = String(equityResult.metadata.unknownPlayers);
  if ($('#equityDetailBoard')) $('#equityDetailBoard').textContent = String(equityResult.metadata.boardCardsMissing);
  if ($('#equityDetailExecution')) $('#equityDetailExecution').textContent = t(callEquityServiceBridge('isWorkerBacked') ? 'Web Worker' : 'In-process fallback');
  if (announce) toast(t('Win probability updated'), 'success');
}

function setEquityPending(options) {
  const renderInputs = options?.renderInputs;
  callEquityServiceBridge('cancel');
  equityCalculationGeneration += 1;
  setEquityCalculationRunning(false, { refreshReadiness: false });
  if (app.equity.lastResult) app.equity.staleResult = app.equity.lastResult;
  if (app.equity.lastAnalysis) app.equity.staleAnalysis = app.equity.lastAnalysis;
  if (app.equity.lastAnalysisLabels) app.equity.staleAnalysisLabels = app.equity.lastAnalysisLabels;
  app.equity.lifecycle = 'pending';
  app.equity.lastRequest = null;
  app.equity.lastResult = null;
  app.equity.lastProgress = null;
  app.equity.lastError = null;
  const hasStaleResult = Boolean(app.equity.staleResult);
  clearEquityResults(
    hasStaleResult ? 'stale' : 'empty',
    t(hasStaleResult ? 'Results are stale.' : 'Inputs changed. Calculate to refresh the result.'),
    { renderPlayerFooters: renderInputs !== 'players' }
  );
  if ($('#calculate')) {
    const calculateLabel = hasStaleResult ? 'Recalculate' : 'Calculate equity';
    $('#calculate').dataset.i18n = calculateLabel;
    $('#calculate').textContent = t(calculateLabel);
  }
  if ($('#methodBadge')) $('#methodBadge').textContent = t('AWAITING CALCULATION');
  if (renderInputs === 'players') {
    renderEquityPlayers();
    renderEquityCardCounts();
  } else if (renderInputs === 'shared') renderEquitySharedCards();
  else if (renderInputs === true) renderEquityCards();
  renderEquityHandAnalysis();
  return updateEquityReadiness();
}

function resetEquityCalculator() {
  callEquityServiceBridge('cancel');
  equityCalculationGeneration += 1;
  app.equity.board = [];
  app.equity.dead = [];
  app.equity.nextPlayerId = 2;
  app.equity.players = [
    { id: 'equity-player-0', name: '', cards: [], handMode: 'known' },
    { id: 'equity-player-1', name: '', cards: [], handMode: 'unknown' }
  ];
  if ($('#calcStyle')) $('#calcStyle').value = 'auto';
  if ($('#trials')) $('#trials').value = '10000';
  if ($('#equitySeed')) $('#equitySeed').value = '';
  setEquityCalculationRunning(false);
  renderEquityCards();
  app.equity.lifecycle = 'idle';
  app.equity.lastRequest = null;
  app.equity.lastResult = null;
  app.equity.staleResult = null;
  app.equity.lastAnalysis = null;
  app.equity.staleAnalysis = null;
  app.equity.lastAnalysisLabels = null;
  app.equity.staleAnalysisLabels = null;
  app.equity.lastProgress = null;
  app.equity.lastError = null;
  clearEquityResults('empty', t('Results update after calculation.'));
  renderEquityHandAnalysis();
  if ($('#calculate')) {
    $('#calculate').dataset.i18n = 'Calculate equity';
    $('#calculate').textContent = t('Calculate equity');
  }
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
let homeSavedExpandedId = null;
let homeSavedCategory = 'all';
let homeSavedQuickPreviewOwner = null;
let homeRefreshSequence = 0;
let homeRefreshTimer = null;
let activeSavedSpotContext = null;

function welcomeOrientationIsVisible() {
  const state = document.documentElement.dataset.welcomeOrientation;
  return state === 'unseen' || state === 'visible';
}

function activateNavigationItem(button) {
  if (!button) return false;
  if (welcomeOrientationIsVisible()) {
    $$('.mode-nav-item[data-mode][data-navigation-id]').forEach((item) => {
      item.classList.remove('active');
      item.setAttribute('aria-current', 'false');
    });
    return false;
  }
  $$('.mode-nav-item[data-mode][data-navigation-id]').forEach((item) => {
    const isActive = item === button;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  const shell = $('.riverline-shell');
  if (shell) {
    shell.dataset.activeMode = button.dataset.mode;
    shell.dataset.activeDestination = button.dataset.navigationId;
  }

  const eyebrowKey = button.dataset.workspaceEyebrow || 'Riverline';
  const titleKey = button.dataset.modeTitle || button.textContent.trim();
  const subtitleKey = button.dataset.modeSubtitle || '';
  const workspaceEyebrow = $('#workspaceEyebrow');
  const workspaceTitle = $('#workspaceTitle');
  const workspaceSubtitle = $('#workspaceSubtitle');
  if (workspaceEyebrow) {
    workspaceEyebrow.dataset.i18n = eyebrowKey;
    workspaceEyebrow.textContent = t(eyebrowKey);
  }
  if (workspaceTitle) {
    workspaceTitle.dataset.i18n = titleKey;
    workspaceTitle.textContent = t(titleKey);
  }
  if (workspaceSubtitle) {
    workspaceSubtitle.dataset.i18n = subtitleKey;
    workspaceSubtitle.textContent = t(subtitleKey);
  }
  if (button.dataset.mode === 'home') applyHomeDestinationPresentation(button.dataset.navigationId);
  if (button.dataset.mode === 'gto') applyPlaybookDestinationPresentation(button.dataset.navigationId);
  return true;
}

function resolveHomeDestinationPresentation(destination, {
  sessionMode = 'account',
  hasContinuation = false,
} = {}) {
  const normalizedDestination = destination === 'saved' ? 'saved' : 'home';
  const guest = sessionMode === 'guest';
  const visibleSections = normalizedDestination === 'saved'
    ? guest
      ? ['guest']
      : ['saved-overview', 'recent']
    : guest
      ? ['guest', 'continue', 'strategy', 'quick', 'other']
      : ['overview', 'continue', 'review', 'recent', 'strategy', 'quick', 'other'];
  return Object.freeze({
    destination: normalizedDestination,
    visibleSections: Object.freeze(visibleSections),
    guestCopy: normalizedDestination === 'saved'
      ? Object.freeze({
        eyebrow: 'Saved study',
        title: 'Saved Hands & Spots',
        primary: 'Saved study belongs to a signed-in Riverline profile. Sign in to open that profile\'s Hands and Spots.',
        secondary: 'Signing in does not enable sync or cloud backup.',
      })
      : Object.freeze({
        eyebrow: 'Guest Mode',
        title: 'Riverline is ready to use',
        primary: 'Analyze hands, train decisions, and calculate Equity without an account.',
        secondary: 'Saved study and Personal Strategy require a Riverline profile. Signing in does not enable sync or cloud backup.',
      }),
  });
}

function setTranslatedElement(element, key) {
  if (!element) return;
  element.dataset.i18n = key;
  element.textContent = t(key);
}

function applyHomeDestinationPresentation(destination = activeNavigationDestination()) {
  const content = $('#homeWorkspaceContent');
  const state = resolveHomeDestinationPresentation(destination, {
    sessionMode: content?.dataset.sessionMode || homeViewModel?.sessionMode || 'account',
    hasContinuation: content?.dataset.hasContinuation === 'true',
  });
  const homeMode = $('#homeMode');
  if (homeMode) {
    homeMode.dataset.productDestination = state.destination;
    const labelKey = state.destination === 'saved' ? 'Saved study' : 'Home dashboard';
    homeMode.dataset.i18nAriaLabel = labelKey;
    homeMode.setAttribute('aria-label', t(labelKey));
  }
  if (content) content.dataset.productDestination = state.destination;

  const sections = {
    'saved-overview': $('#homeSavedOverview'),
    overview: $('#homeAccountOverview'),
    guest: $('#homeGuestAccount'),
    continue: $('#homeContinueContent')?.closest('.home-section'),
    review: $('#homeReviewContent')?.closest('.home-section'),
    recent: $('#homeRecentContent')?.closest('.home-section'),
    strategy: $('#homeStrategyContent')?.closest('.home-section'),
    quick: $('#homeQuickStartTitle')?.closest('.home-section'),
    other: $('#homeOtherTitle')?.closest('.home-section'),
  };
  const visible = new Set(state.visibleSections);
  Object.entries(sections).forEach(([key, section]) => {
    if (section) section.hidden = !visible.has(key);
  });

  setTranslatedElement($('#homeRecentEyebrow'), state.destination === 'saved' ? 'Saved study objects' : 'Your latest saved study items');
  setTranslatedElement($('#homeRecentTitle'), state.destination === 'saved' ? 'Library' : 'Recent');
  if (state.destination !== 'saved') hideSavedQuickPreview();

  setTranslatedElement($('#homeGuestAccountEyebrow'), state.guestCopy.eyebrow);
  setTranslatedElement($('#homeGuestAccountTitle'), state.guestCopy.title);
  setTranslatedElement($('#homeGuestAccountPrimary'), state.guestCopy.primary);
  setTranslatedElement($('#homeGuestAccountSecondary'), state.guestCopy.secondary);
  return state;
}

function resolvePlaybookDestinationPresentation(destination, playbookMode) {
  const normalizedDestination = destination === 'hand' ? 'hand' : 'analyze';
  const requestedMode = normalizedDestination === 'hand'
    ? (playbookMode === PLAYBOOK_MODES.HAND ? null : PLAYBOOK_MODES.HAND)
    : (playbookMode === PLAYBOOK_MODES.SCENARIO ? null : PLAYBOOK_MODES.SCENARIO);
  return Object.freeze({
    destination: normalizedDestination,
    requestedMode,
    primarySurface: normalizedDestination === 'hand' ? 'hand-controls-and-table' : 'decision-analysis',
  });
}

function applyPlaybookDestinationPresentation(destination = activeNavigationDestination()) {
  const state = resolvePlaybookDestinationPresentation(
    destination,
    callPlaybookStateBridge('getMode') || app.playbookMode || PLAYBOOK_MODES.SCENARIO,
  );
  const modeView = $('#gtoMode');
  if (modeView) {
    modeView.dataset.productDestination = state.destination;
    const labelKey = state.destination === 'hand' ? 'Hand' : 'Analyze';
    modeView.dataset.i18nAriaLabel = labelKey;
    modeView.setAttribute('aria-label', t(labelKey));
  }
  const handDestination = state.destination === 'hand';
  setTranslatedElement($('#playbookWorkflowKicker'), handDestination ? 'Hand workflow' : 'Analysis source');
  setTranslatedElement(
    $('#playbookWorkflowTitle'),
    handDestination ? 'Play or continue the canonical Hand' : 'Analyze the current Hand or a study spot',
  );
  return state;
}

function syncPlaybookNavigationDestination(mode) {
  if (activeWorkspaceMode() !== 'gto') return;
  const destination = mode === PLAYBOOK_MODES.HAND ? 'hand' : 'analyze';
  const button = document.querySelector(`.mode-nav-item[data-navigation-id="${destination}"]`);
  activateNavigationItem(button);
}

function navigateToWorkspace(mode, destination = null) {
  const navigationId = destination || {
    gto: isHandMode() ? 'hand' : 'analyze',
    calibration: 'personal-strategy',
    homegame: 'home-game',
    info: 'guide',
  }[mode] || mode;
  document.querySelector(`.mode-nav-item[data-navigation-id="${navigationId}"]`)?.click();
}

function navigateToProductDestination(destination) {
  const route = {
    hand: ['gto', 'hand'],
    analyze: ['gto', 'analyze'],
    training: ['training', 'training'],
    'personal-strategy': ['calibration', 'personal-strategy'],
    equity: ['equity', 'equity'],
    saved: ['home', 'saved'],
    home: ['home', 'home'],
    'home-game': ['homegame', 'home-game'],
    guide: ['info', 'guide'],
  }[destination];
  if (route) navigateToWorkspace(route[0], route[1]);
}

function revealHomeDestination() {
  if (activeWorkspaceMode() !== 'home') return;
  $('#homeWorkspace')?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
}

async function returnToHomeLiveHand() {
  activeSavedSpotContext = null;
  renderSavedSpotViewer(null);
  callPlaybookStateBridge('closeSavedHand');
  navigateToWorkspace('gto', 'hand');
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

function homeEmptyAction(messageKey, actionKey, destination, { primary = false } = {}) {
  const root = document.createElement('div');
  root.className = 'home-empty-state';
  const message = document.createElement('p');
  message.textContent = t(messageKey);
  const action = document.createElement('button');
  action.type = 'button';
  action.className = `ui-button ${primary ? 'ui-button--primary' : 'ui-button--quiet'}`;
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
  const kind = item.kind === 'hand'
    ? t('Saved Hand')
    : item.kind === 'spot'
      ? t('Saved Spot')
      : t('Saved item');
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
  if (recency) facts.push(`${t('Updated')} ${recency}`);
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

function createSavedPreviewCard(card, label, size = 'mini') {
  const element = document.createElement('span');
  element.className = 'saved-preview-card riverline-card';
  element.dataset.cardSize = size;
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', card || t(label));
  const match = typeof card === 'string' ? /^([2-9TJQKA])([cdhs])$/u.exec(card) : null;
  if (!match) {
    element.className = 'saved-preview-card saved-preview-card--unknown riverline-card-back';
    return element;
  }
  const presentation = window.RiverlineCardPresentation;
  if (presentation?.appendCardFaceContents) {
    presentation.appendCardFaceContents(element, {
      rank: match[1],
      suit: match[2],
      rankStyle: document.documentElement.dataset.cardRankStyle || 'poker',
    });
  } else {
    element.textContent = card;
  }
  return element;
}

function createSavedPokerPreview(item, { variant = 'compact' } = {}) {
  const preview = document.createElement('span');
  preview.className = `saved-poker-preview saved-poker-preview--${variant}`;
  preview.dataset.savedPreviewKind = item.kind;
  preview.dataset.savedPreviewDerivation = item.derivation;
  preview.setAttribute('aria-label', t('Stored poker preview'));
  const cardSize = variant === 'detail' ? 'compact' : variant === 'quick' ? 'result' : 'mini';

  const hero = document.createElement('span');
  hero.className = 'saved-preview-group saved-preview-group--hero';
  const heroLabel = document.createElement('span');
  heroLabel.textContent = t('Hero');
  const heroCards = document.createElement('span');
  heroCards.className = 'saved-preview-cards';
  const knownHeroCards = Array.isArray(item.heroCards) ? item.heroCards : [];
  for (let index = 0; index < 2; index += 1) {
    heroCards.appendChild(createSavedPreviewCard(knownHeroCards[index] || null, 'Unknown card', cardSize));
  }
  hero.append(heroLabel, heroCards);

  const board = document.createElement('span');
  board.className = 'saved-preview-group saved-preview-group--board';
  const boardLabel = document.createElement('span');
  boardLabel.textContent = t('Board');
  const boardCards = document.createElement('span');
  boardCards.className = 'saved-preview-cards';
  (Array.isArray(item.board) ? item.board : []).forEach((card) => {
    boardCards.appendChild(createSavedPreviewCard(card, 'Unknown card', cardSize));
  });
  if (boardCards.childElementCount === 0) {
    const emptyBoard = document.createElement('span');
    emptyBoard.className = 'saved-preview-empty-board';
    emptyBoard.textContent = t('No board cards');
    boardCards.appendChild(emptyBoard);
  }
  board.append(boardLabel, boardCards);
  preview.append(hero, board);
  return preview;
}

function savedLibraryCategoryModel(items, selectedCategory = homeSavedCategory) {
  const source = Array.isArray(items) ? items : [];
  const selected = ['all', 'hands', 'spots'].includes(selectedCategory) ? selectedCategory : 'all';
  const hands = source.filter((item) => item.kind === 'hand');
  const spots = source.filter((item) => item.kind === 'spot');
  return Object.freeze({
    selected,
    counts: Object.freeze({ all: source.length, hands: hands.length, spots: spots.length }),
    items: Object.freeze(selected === 'hands' ? hands : selected === 'spots' ? spots : [...source]),
  });
}

function renderSavedLibraryCategories(model) {
  const categories = $('#savedLibraryCategories');
  if (!categories) return;
  categories.setAttribute('aria-label', t('Saved categories'));
  categories.querySelectorAll('[data-saved-category]').forEach((control) => {
    const category = control.dataset.savedCategory;
    control.setAttribute('aria-pressed', String(category === model.selected));
    const labelKey = category === 'hands' ? 'Hands' : category === 'spots' ? 'Spots' : 'All';
    setTranslatedElement(control.querySelector('span'), labelKey);
    const count = control.querySelector('[data-saved-category-count]');
    if (count) count.textContent = String(model.counts[category] ?? 0);
  });
}

function createSavedCategoryEmptyState(category) {
  const empty = document.createElement('div');
  empty.className = 'home-empty-state saved-library-category-empty';
  const title = document.createElement('strong');
  const copy = document.createElement('p');
  if (category === 'hands') {
    title.textContent = t('No saved Hands yet.');
    copy.textContent = t('Save a Hand from Hand or Review to keep it for later study.');
  } else {
    title.textContent = t('No saved Spots yet.');
    copy.textContent = t('Save a Spot from Analyze or Review to keep it for later study.');
  }
  empty.append(title, copy);
  return empty;
}

function hideSavedQuickPreview() {
  const overlay = $('#savedQuickPreviewOverlay');
  const wasVisible = Boolean(overlay && !overlay.hidden);
  homeSavedQuickPreviewOwner = null;
  if (overlay) {
    overlay.hidden = true;
    overlay.replaceChildren();
    overlay.removeAttribute('data-placement');
  }
  return wasVisible;
}

function positionSavedQuickPreview(owner, overlay) {
  const margin = 12;
  const gap = 8;
  const ownerRect = owner.getBoundingClientRect();
  overlay.style.maxWidth = `${Math.max(0, window.innerWidth - (margin * 2))}px`;
  const overlayRect = overlay.getBoundingClientRect();
  const preferredX = document.documentElement.dir === 'rtl'
    ? ownerRect.right - overlayRect.width
    : ownerRect.left;
  const left = Math.min(
    Math.max(margin, preferredX),
    Math.max(margin, window.innerWidth - overlayRect.width - margin),
  );
  const below = ownerRect.bottom + gap;
  const above = ownerRect.top - overlayRect.height - gap;
  const useAbove = below + overlayRect.height > window.innerHeight - margin && above >= margin;
  const top = useAbove
    ? above
    : Math.min(Math.max(margin, below), Math.max(margin, window.innerHeight - overlayRect.height - margin));
  overlay.style.left = `${Math.round(left)}px`;
  overlay.style.top = `${Math.round(top)}px`;
  overlay.dataset.placement = useAbove ? 'above' : 'below';
  overlay.style.visibility = 'visible';
}

function showSavedQuickPreview(owner) {
  const id = owner?.dataset.savedSelectId;
  const item = (homeViewModel?.sections?.recent?.items || []).find((candidate) => candidate.id === id);
  if (!item || (item.kind !== 'hand' && item.kind !== 'spot') || owner.getAttribute('aria-expanded') === 'true') {
    hideSavedQuickPreview();
    return;
  }
  const overlay = $('#savedQuickPreviewOverlay');
  if (!overlay) return;
  const quickLabel = document.createElement('span');
  quickLabel.className = 'saved-library-quick-label';
  quickLabel.textContent = t(item.derivation === 'scenario' ? 'Scenario snapshot' : 'Hand snapshot');
  overlay.replaceChildren(quickLabel, createSavedPokerPreview(item, { variant: 'quick' }));
  overlay.hidden = false;
  overlay.style.visibility = 'hidden';
  homeSavedQuickPreviewOwner = owner;
  positionSavedQuickPreview(owner, overlay);
}

function createSavedLibraryItemElement(item, expanded) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'saved-library-item';
  control.dataset.savedSelectId = item.id;
  control.dataset.savedKind = item.kind;
  control.setAttribute('aria-expanded', String(expanded));
  control.setAttribute('aria-controls', 'homeSavedDetail');
  control.setAttribute('aria-label', `${t('View details')}: ${homeSavedItemTitle(item)}`);
  if (expanded) control.dataset.expanded = 'true';
  if (item.kind === 'hand' || item.kind === 'spot') control.appendChild(createSavedPokerPreview(item));

  const copy = document.createElement('span');
  copy.className = 'saved-library-item-copy';
  const identity = document.createElement('span');
  identity.className = 'home-saved-item-title-row';
  const kind = document.createElement('span');
  kind.className = 'home-saved-item-kind';
  kind.textContent = t(item.kind === 'hand' ? 'Hand' : item.kind === 'spot' ? 'Spot' : 'Saved item');
  const title = document.createElement('strong');
  title.dir = 'auto';
  title.textContent = homeSavedItemTitle(item);
  identity.append(kind, title);
  const meta = document.createElement('span');
  meta.className = 'home-saved-item-meta poker-data-token';
  meta.dir = 'ltr';
  homeSavedItemFacts(item).slice(0, 4).forEach((fact) => {
    const token = document.createElement('span');
    token.textContent = fact;
    meta.appendChild(token);
  });
  copy.append(identity, meta);
  if (item.reviewState === 'review_later' || item.isMistake) {
    const review = document.createElement('span');
    review.className = 'saved-library-item-review';
    review.textContent = t(item.isMistake ? 'Mistake' : 'Review later');
    copy.appendChild(review);
  }
  control.appendChild(copy);
  return control;
}

function savedItemTruth(item) {
  if (item.kind === 'hand') return 'Canonical Hand · read-only replay';
  if (item.derivation === 'scenario') return 'Scenario study snapshot · no canonical Hand history';
  if (item.kind === 'spot') return 'Decision snapshot · Hand history unavailable';
  return 'This saved object type is unavailable in this Riverline version.';
}

function renderSavedLibraryDetail(item) {
  const detail = $('#homeSavedDetail');
  if (!detail) return;
  detail.replaceChildren();
  if (!item) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  const head = document.createElement('header');
  head.className = 'saved-library-detail-head';
  const headCopy = document.createElement('div');
  const kind = document.createElement('span');
  kind.className = 'home-saved-item-kind';
  kind.textContent = t(item.kind === 'hand' ? 'Saved Hand' : item.kind === 'spot' ? 'Saved Spot' : 'Saved item');
  const title = document.createElement('h3');
  title.id = 'homeSavedDetailTitle';
  title.dir = 'auto';
  title.textContent = homeSavedItemTitle(item);
  const truth = document.createElement('p');
  truth.className = 'saved-library-truth';
  truth.textContent = t(savedItemTruth(item));
  headCopy.append(kind, title, truth);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ui-button ui-button--quiet saved-library-detail-close';
  close.dataset.savedDetailClose = 'true';
  close.textContent = t('Close');
  close.setAttribute('aria-label', t('Close details'));
  head.append(headCopy, close);
  detail.appendChild(head);
  if (item.kind === 'hand' || item.kind === 'spot') detail.appendChild(createSavedPokerPreview(item, { variant: 'detail' }));

  const facts = document.createElement('div');
  facts.className = 'saved-library-detail-facts poker-data-token';
  facts.dir = 'ltr';
  homeSavedItemFacts(item).forEach((fact) => {
    const token = document.createElement('span');
    token.textContent = fact;
    facts.appendChild(token);
  });
  detail.appendChild(facts);

  if (item.note) {
    const note = document.createElement('section');
    note.className = 'saved-library-note';
    const noteTitle = document.createElement('h4');
    noteTitle.textContent = t('Study note');
    const noteCopy = document.createElement('p');
    noteCopy.dir = 'auto';
    noteCopy.textContent = item.note;
    note.append(noteTitle, noteCopy);
    detail.appendChild(note);
  }
  if (item.tags.length || item.reviewState === 'review_later' || item.isMistake) {
    const annotations = document.createElement('div');
    annotations.className = 'home-saved-item-badges';
    if (item.reviewState === 'review_later') {
      const review = document.createElement('span');
      review.className = 'home-saved-badge home-saved-badge--review';
      review.textContent = t('Review later');
      annotations.appendChild(review);
    }
    if (item.isMistake) {
      const mistake = document.createElement('span');
      mistake.className = 'home-saved-badge home-saved-badge--mistake';
      mistake.textContent = t('Mistake');
      annotations.appendChild(mistake);
    }
    item.tags.forEach((tag) => {
      const tagElement = document.createElement('span');
      tagElement.className = 'home-saved-badge';
      tagElement.dir = 'auto';
      tagElement.textContent = tag;
      annotations.appendChild(tagElement);
    });
    detail.appendChild(annotations);
  }

  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'ui-button ui-button--primary saved-library-open';
  action.dataset.homeSavedId = item.id;
  action.textContent = t(item.kind === 'hand' ? 'Open Hand' : item.kind === 'spot' ? 'Open Spot' : 'Unavailable');
  action.disabled = item.kind !== 'hand' && item.kind !== 'spot';
  action.setAttribute('aria-label', `${action.textContent}: ${homeSavedItemTitle(item)}`);
  detail.appendChild(action);
}

function renderSavedLibrary(section) {
  const root = $('#homeRecentContent');
  if (!root) return;
  hideSavedQuickPreview();
  root.replaceChildren();
  root.setAttribute('aria-label', t('Saved study objects'));
  const categoryModel = savedLibraryCategoryModel(section?.items || []);
  homeSavedCategory = categoryModel.selected;
  renderSavedLibraryCategories(categoryModel);
  if (section?.status === 'error') {
    root.appendChild(homeEmptyState('Saved items could not be loaded.', true));
    renderSavedLibraryDetail(null);
    return;
  }
  const allItems = section?.items || [];
  const items = categoryModel.items;
  if (!allItems.length) {
    root.appendChild(homeEmptyAction(
      'Saved Hands and Spots you intentionally keep will appear here.',
      'Analyze a Hand',
      'analyze',
      { primary: true },
    ));
    renderSavedLibraryDetail(null);
    return;
  }
  if (!items.length) {
    root.appendChild(createSavedCategoryEmptyState(homeSavedCategory));
    homeSavedExpandedId = null;
    renderSavedLibraryDetail(null);
    return;
  }
  if (!items.some((item) => item.id === homeSavedExpandedId)) homeSavedExpandedId = null;
  items.forEach((item) => root.appendChild(createSavedLibraryItemElement(item, item.id === homeSavedExpandedId)));
  renderSavedLibraryDetail(items.find((item) => item.id === homeSavedExpandedId));
}

function renderHomeContinue(section) {
  const root = $('#homeContinueContent');
  if (!root) return;
  root.replaceChildren();
  const hasContinuation = Boolean(section?.items?.length);
  setTranslatedElement($('#homeContinueEyebrow'), hasContinuation ? 'Pick up where you left off' : 'Your next action');
  setTranslatedElement($('#homeContinueTitle'), hasContinuation ? 'Continue' : 'Start study');
  if (!section?.items?.length) {
    root.appendChild(homeEmptyAction('Play or reconstruct a legal hand.', 'Start a Hand', 'hand', { primary: true }));
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
    title.textContent = t(item.kind === 'live_hand' ? 'Live Hand' : 'Personal Strategy');
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
    else resume.dataset.homeDestination = 'personal-strategy';
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
  if (activeNavigationDestination() === 'saved') {
    renderSavedLibrary(section);
    return;
  }
  root.removeAttribute('aria-label');
  renderSavedLibraryDetail(null);
  root.replaceChildren();
  if (section?.status === 'error') {
    root.appendChild(homeEmptyState('Saved items could not be loaded.', true));
    return;
  }
  if (!section?.items?.length) {
    root.appendChild(homeEmptyAction('No saved study yet.', 'Analyze a Hand', 'analyze'));
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
  if (section?.status === 'unavailable') {
    const card = document.createElement('div');
    card.className = 'home-strategy-summary';
    const copy = document.createElement('p');
    copy.textContent = t('Teach Riverline how you intend to play. A Riverline profile is required.');
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'ui-button ui-button--secondary';
    action.dataset.homeDestination = 'personal-strategy';
    action.textContent = t('Open Personal Strategy');
    card.append(copy, action);
    root.appendChild(card);
    return;
  }
  if (section?.status === 'error') {
    root.appendChild(homeEmptyState('Personal Strategy could not be loaded.', true));
    return;
  }
  const card = document.createElement('div');
  card.className = 'home-strategy-summary';
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'ui-button ui-button--secondary';
  action.dataset.homeDestination = 'personal-strategy';
  if (!section?.selectedProfile) {
    const empty = document.createElement('p');
    empty.textContent = t(section?.profileCount > 0
      ? 'Open Personal Strategy to choose a profile.'
      : 'Create a profile to start building your ranges.');
    action.textContent = t(section?.profileCount > 0
      ? 'Open Personal Strategy'
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
  action.textContent = t(section.resumable ? 'Resume calibration' : 'Open Personal Strategy');
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
    if (!['hand', 'analyze', 'training', 'equity', 'review_mistakes'].includes(destination)) return;
    if (!control.closest('.home-quick-links')) return;
    control.hidden = !allowed.has(destination);
  });
  const guest = model.sessionMode === 'guest';
  const trainingLabel = document.querySelector('.home-quick-link[data-home-destination="training"] strong');
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
    $('#homeRecentContent')?.closest('.home-section')
  ];
  restricted.forEach((section) => { if (section) section.hidden = guest; });
  const guestAccount = $('#homeGuestAccount');
  if (guestAccount) guestAccount.hidden = !guest;
  renderHomeAccountOverview(model);
  const subtitle = $('#workspaceSubtitle');
  if (activeNavigationDestination() === 'home' && subtitle) {
    const subtitleKey = guest
      ? 'Analyze and train without saving account history.'
      : 'Your saved study, review queue, and next useful action.';
    subtitle.dataset.i18n = subtitleKey;
    subtitle.textContent = t(subtitleKey);
  }
  renderHomeQuickStart(model);
  renderHomeContinue(model.sections.continue);
  renderHomePersonalStrategy(model.sections.personalStrategy);
  if (guest) {
    homeSavedExpandedId = null;
    homeSavedCategory = 'all';
    hideSavedQuickPreview();
    $('#homeRecentContent')?.replaceChildren();
    renderSavedLibraryDetail(null);
  } else {
    renderHomeRecent(model.sections.recent);
    renderHomeReview(model.sections.review);
  }
  const workspace = $('#homeWorkspace');
  const loading = $('#homeLoadingState');
  const content = $('#homeWorkspaceContent');
  if (content) content.dataset.sessionMode = guest ? 'guest' : 'account';
  if (content) content.dataset.hasContinuation = String(Boolean(model.sections.continue?.items?.length));
  if (workspace) workspace.setAttribute('aria-busy', 'false');
  if (loading) loading.hidden = true;
  if (content) content.hidden = false;
  applyHomeDestinationPresentation();
  window.requestAnimationFrame(revealHomeDestination);
  const tutorialWorkspace = activeNavigationDestination() === 'saved' ? 'saved' : 'home';
  window.RiverlineTutorials?.offerForWorkspace?.(tutorialWorkspace, workspace);
}

function beginHomeLoading() {
  const workspace = $('#homeWorkspace');
  const loading = $('#homeLoadingState');
  const content = $('#homeWorkspaceContent');
  if (workspace) workspace.setAttribute('aria-busy', 'true');
  if (loading) loading.hidden = false;
  if (content) content.hidden = true;
}

function clearSavedOwnerPresentation() {
  ++homeRefreshSequence;
  homeSavedExpandedId = null;
  homeSavedCategory = 'all';
  hideSavedQuickPreview();
  $('#homeRecentContent')?.replaceChildren();
  renderSavedLibraryDetail(null);

  const savedHandProjection = callPlaybookStateBridge('createReplayProjectionViewModel');
  const savedHandOpen = savedHandProjection?.viewerContext?.kind === 'saved_hand';
  activeSavedSpotContext = null;
  renderSavedSpotViewer(null);
  if (savedHandOpen) {
    callPlaybookStateBridge('closeSavedHand');
    renderSavedHandViewerContext(null);
    if (activeWorkspaceMode() === 'gto') renderCanonicalHandWorkspace();
  }

  ++savedStudyRefreshSequence;
  savedStudyCurrentObject = null;
  if (!$('#savedStudyModal')?.hidden) closeSavedStudyEditor();
}

async function refreshHomeWorkspace({ preserveVisible = false } = {}) {
  if (welcomeOrientationIsVisible()) return;
  const sequence = ++homeRefreshSequence;
  if (!preserveVisible || !homeViewModel) beginHomeLoading();
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
  if (clearPrivateState) clearSavedOwnerPresentation();
  if (homeRefreshTimer !== null) {
    window.clearTimeout(homeRefreshTimer);
    homeRefreshTimer = null;
  }
  if (activeWorkspaceMode() !== 'home' || welcomeOrientationIsVisible()) return;
  if (clearPrivateState) beginHomeLoading();
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
      navigateToWorkspace('gto', 'hand');
      renderCanonicalHandWorkspace();
      return;
    }

    callPlaybookStateBridge('setMode', PLAYBOOK_MODES.SCENARIO, result.scenarioInput || {});
    app.playbookMode = PLAYBOOK_MODES.SCENARIO;
    setPlaybookControlAuthority(PLAYBOOK_MODES.SCENARIO);
    restoreSavedSpotPresentation(result);
    activeSavedSpotContext = result;
    renderSavedSpotViewer(result);
    navigateToWorkspace('gto', 'analyze');
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
  return globalThis.RiverlineCardPresentation?.apply({ fourColor: Boolean(is4Color) });
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

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || activeNavigationDestination() !== 'saved') return;
    if (hideSavedQuickPreview()) {
      event.preventDefault();
      return;
    }
    if (!homeSavedExpandedId) return;
    const previousId = homeSavedExpandedId;
    homeSavedExpandedId = null;
    renderSavedLibrary(homeViewModel?.sections?.recent);
    document.querySelector(`[data-saved-select-id="${CSS.escape(previousId)}"]`)?.focus();
  });

  document.addEventListener('pointerover', (event) => {
    const owner = event.target.closest?.('[data-saved-select-id]');
    if (owner && owner !== homeSavedQuickPreviewOwner) showSavedQuickPreview(owner);
  });

  document.addEventListener('pointerout', (event) => {
    const owner = event.target.closest?.('[data-saved-select-id]');
    if (owner === homeSavedQuickPreviewOwner && !owner.contains(event.relatedTarget)) hideSavedQuickPreview();
  });

  document.addEventListener('focusin', (event) => {
    const owner = event.target.closest?.('[data-saved-select-id]');
    if (owner) showSavedQuickPreview(owner);
  });

  document.addEventListener('focusout', (event) => {
    const owner = event.target.closest?.('[data-saved-select-id]');
    if (owner === homeSavedQuickPreviewOwner && !owner.contains(event.relatedTarget)) hideSavedQuickPreview();
  });

  window.addEventListener('resize', hideSavedQuickPreview);
  window.addEventListener('scroll', hideSavedQuickPreview, true);

  document.addEventListener('click', (event) => {

    const homeDestination = event.target.closest('[data-home-destination]');
    if (homeDestination) {
      const destination = homeDestination.dataset.homeDestination;
      if (destination === 'review_mistakes') {
        $('#homeReviewContent')?.closest('.home-section')?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      } else navigateToProductDestination(destination);
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

    const savedDetailClose = event.target.closest('[data-saved-detail-close]');
    if (savedDetailClose) {
      const previousId = homeSavedExpandedId;
      homeSavedExpandedId = null;
      renderSavedLibrary(homeViewModel?.sections?.recent);
      if (previousId) document.querySelector(`[data-saved-select-id="${CSS.escape(previousId)}"]`)?.focus();
      return;
    }

    const savedCategory = event.target.closest('[data-saved-category]');
    if (savedCategory) {
      homeSavedCategory = savedCategory.dataset.savedCategory;
      homeSavedExpandedId = null;
      hideSavedQuickPreview();
      renderSavedLibrary(homeViewModel?.sections?.recent);
      return;
    }

    const savedSelection = event.target.closest('[data-saved-select-id]');
    if (savedSelection) {
      const id = savedSelection.dataset.savedSelectId;
      hideSavedQuickPreview();
      homeSavedExpandedId = homeSavedExpandedId === id ? null : id;
      renderSavedLibrary(homeViewModel?.sections?.recent);
      document.querySelector(`[data-saved-select-id="${CSS.escape(id)}"]`)?.focus();
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
        handModeControl.dataset.playerId,
        handModeControl.dataset.equityHandMode
      );
    }

    const cardSetPreviewCard = event.target.closest('[data-card-set-preview-card]');
    if (cardSetPreviewCard) return selectCard(cardSetPreviewCard.dataset.cardSetPreviewCard);

    const cardSetAction = event.target.closest('[data-card-set-action]');
    if (cardSetAction?.dataset.cardSetAction === 'apply') return applyCardSetPicker();
    if (cardSetAction?.dataset.cardSetAction === 'clear') return clearPrivateHandPicker();
    if (cardSetAction?.dataset.cardSetAction === 'cancel') return closePicker();

    const equityHandEditor = event.target.closest('[data-equity-edit-hand]');
    if (equityHandEditor) return openEquityHandPicker(equityHandEditor.dataset.equityEditHand);

    const cardSetEditor = event.target.closest('[data-card-set-edit]');
    if (cardSetEditor) return openPicker(
      cardSetEditor.dataset.cardSetEdit,
      Number(cardSetEditor.dataset.cardSetIndex) || 0
    );

    const playerCountPreset = event.target.closest('[data-equity-player-count]');
    if (playerCountPreset) return setEquityPlayerCount(playerCountPreset.dataset.equityPlayerCount);

    const playerCountStep = event.target.closest('[data-equity-player-delta]');
    if (playerCountStep) {
      return setEquityPlayerCount(app.equity.players.length + Number(playerCountStep.dataset.equityPlayerDelta));
    }

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

      setEquityPending({ renderInputs: 'players' });

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
      $('#toggleTeacher').setAttribute('aria-expanded', String(isHidden));

      t.classList.toggle('is-analysis-entering', isHidden);

      if (isHidden) playbookSurfaceInvalidator.renderIfNeeded('analysis');

    }

  });

  if ($('#cardModal')) {
    $('#cardModal').addEventListener('click', (event) => { if (event.target === $('#cardModal')) closePicker(); });
    $('#cardModal').addEventListener('keydown', handleCardPickerKeydown);
  }



  $$('.mode-nav-item[data-mode]').forEach((button) => button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    const destination = button.dataset.navigationId || mode;
    if (!activateNavigationItem(button)) return;
    clearToast();
    const tutorialWorkspace = mode === 'home' && destination === 'saved' ? 'saved' : mode;
    window.RiverlineTutorials?.workspaceChanged?.(tutorialWorkspace);
    if (mode !== 'gto') callPlaybookStateBridge('cancelReplayPlayback');
    if (mode !== 'training') restoreSharedPokerTable();
    
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
    if (mode === 'training'
      && trainingSessionMode() === 'full_hand'
      && app.training.fullHandSnapshot) {
      renderFullHandTrainingSnapshot(app.training.fullHandSnapshot);
    }
    if (mode === 'equity') updateEquityReadiness();
    if (mode === 'home') {
      applyHomeDestinationPresentation(destination);
      void refreshHomeWorkspace({ preserveVisible: Boolean(homeViewModel) });
      window.requestAnimationFrame(revealHomeDestination);
    }
    if (mode === 'gto') {
      const destinationState = resolvePlaybookDestinationPresentation(
        destination,
        callPlaybookStateBridge('getMode') || app.playbookMode || PLAYBOOK_MODES.SCENARIO,
      );
      if (destinationState.requestedMode) {
        void requestPlaybookMode(destinationState.requestedMode);
      } else {
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
      if (destination === 'analyze') {
        const decisionView = document.querySelector('[data-gto-view="context"]');
        if (decisionView) selectPlaybookAnalysisView(decisionView);
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
      window.RiverlineTutorials?.offerForWorkspace?.('settings', $('#settingsTutorialOfferHost'));
    }
  });

  const closeSettings = () => {
    if ($('#settingsModal')) $('#settingsModal').classList.remove('show');
    const shell = $('.riverline-shell');
    const workspace = shell?.dataset.activeMode === 'home' && shell?.dataset.activeDestination === 'saved'
      ? 'saved'
      : shell?.dataset.activeMode ?? null;
    window.RiverlineTutorials?.workspaceChanged?.(workspace);
  };

  if ($('#closeSettingsModal')) $('#closeSettingsModal').addEventListener('click', closeSettings);

  if ($('#settingsModal')) $('#settingsModal').addEventListener('click', (event) => { if (event.target === $('#settingsModal')) closeSettings(); });

  if (!document.documentElement.dataset.cardPresentationLogicBound) {
    document.documentElement.dataset.cardPresentationLogicBound = 'true';
    window.addEventListener('riverline:cardpresentationchange', (event) => {
      syncCardPresentationState(event.detail, { refresh: true });
    });
  }

  if ($('#toggleTableBtn')) {
    $('#toggleTableBtn').addEventListener('click', () => {
      const wrapper = $('#table-wrapper');
      if (wrapper) setCanonicalTableExpanded(wrapper.classList.contains('collapsed'));
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
      
      window.RiverlinePresentationTheme?.apply(newTheme);
      
    }

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
    const claimPolicy = strategyClaimPolicy(app.strategyResult);
    if ($('#bestAction')) $('#bestAction').textContent = t(profile.best);
    if ($('#bestReason')) $('#bestReason').textContent = profile.reason;
    const sourceLabel = strategySourceDisplayLabel(app.strategyResult);
    if ($('#sourceBadge')) {
      $('#sourceBadge').textContent = sourceLabel;
      $('#sourceBadge').title = strategyPolicySummary(claimPolicy);
      $('#sourceBadge').setAttribute('aria-label', `${t('Strategy source')}: ${sourceLabel}`);
    }
    if ($('#strategySourceProvenance')) {
      $('#strategySourceProvenance').textContent = strategyPolicySummary(claimPolicy);
    }
    if ($('#strategyMeta')) {
      $('#strategyMeta').textContent = [
        t('Source version {version}', { version: claimPolicy.sourceVersion }),
        claimPolicy.coverage.kind === 'exact'
          ? t('Exact covered context')
          : t('Broad approximate coverage')
      ].join(' · ');
    }
    if ($('#strategyWarnings')) {
      const warnings = [
        localizedStrategyLimitation(claimPolicy),
        ...localizedStrategyWarnings(app.strategyResult)
      ].filter(Boolean);
      $('#strategyWarnings').textContent = [...new Set(warnings)].join(' · ');
      $('#strategyWarnings').hidden = warnings.length === 0;
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
  renderEquityCards();
  if (['idle', 'pending'].includes(app.equity.lifecycle) && $('#equityDetailExecution')) {
    $('#equityDetailExecution').textContent = t('Ready');
  }
  if (app.equity.lifecycle === 'complete' && app.equity.lastResult && app.equity.lastRequest) {
    renderEquityResult(app.equity.lastResult, app.equity.lastRequest, { announce: false, rebuildAnalysis: false });
    return;
  }
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
    if ($('#equityStatus')) $('#equityStatus').textContent = t(app.equity.staleResult ? 'Results are stale.' : 'Inputs changed. Calculate to refresh the result.');
    if ($('#methodBadge')) $('#methodBadge').textContent = t('AWAITING CALCULATION');
  }
  renderEquityHandAnalysis();
}

function refreshLocalizedTrainingRuntime() {
  updateTrainingPositions();
  updateTrainingFilterAvailability();
  updateTrainingStats();
  updateTrainingSessionProgress();
  updateTrainingSetupSummary();
  if (app.training.practiceSession?.completed && $('#trainingSessionCompletionText')) {
    $('#trainingSessionCompletionText').textContent = t('{aligned} reference-aligned from {attempts} attempts.', {
      aligned: app.training.stats.correct,
      attempts: app.training.stats.totalHands,
    });
  }
  if ($('#trainingMemoryPanel')?.open) void refreshTrainingMemoryPanel();
  if (trainingSessionMode() === 'full_hand' && app.training.fullHandSnapshot) {
    renderFullHandTrainingSnapshot(app.training.fullHandSnapshot);
    return;
  }
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
  window.SoundFX?.refreshControls?.();
  const shell = $('.riverline-shell');
  applySidebarState(Boolean(shell?.classList.contains('is-sidebar-collapsed')));
  updateActionPathDisclosure();
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

    const cardPresentation = globalThis.RiverlineCardPresentation;
    if (!cardPresentation || cardPresentation.schemaVersion !== 'card-presentation/v1') {
      throw new Error('Riverline card presentation authority is unavailable');
    }
    syncCardPresentationState(cardPresentation.get(), { refresh: false });

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
      app.training.memorySessionPromise = null;
      app.training.memoryWritePromise = Promise.resolve();
      app.training.memoryFullHandDecisionRecords = new Map();
      resetTrainingMemoryDecisionState();
      if ($('#trainingMemoryPanel')?.open) void refreshTrainingMemoryPanel();
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

    

    if (activeWorkspaceMode() === 'home' && !welcomeOrientationIsVisible()) void refreshHomeWorkspace();
    else if (!welcomeOrientationIsVisible()) updateContext('Ready');

  } catch (error) {

    console.error('Init error:', error);

  }

}



if (document.readyState === 'loading') {

  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 10));

} else {
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



function rangeRemovalPresentation(cardRemoval) {
  const cells = Object.values(cardRemoval?.cells || {});
  return {
    affectedClasses: cells.filter((cell) => cell.blockedComboCount > 0).length,
    unavailableClasses: cells.filter((cell) => cell.fullyRemoved).length,
    removedCombos: cells.reduce((sum, cell) => sum + cell.blockedComboCount, 0),
  };
}

function representativeRangeComparisonFacts(sampleRange, board, cardRemoval) {
  const bridge = globalThis.RiverlineAnalysisExplanation;
  if (bridge?.rangeComparisonFactsSchemaVersion !== 'range-comparison-facts/v1'
    || typeof bridge.createRepresentativeRangeComparisonFacts !== 'function') return null;
  return bridge.createRepresentativeRangeComparisonFacts({
    handClasses: RANKS.flatMap((_, row) => RANKS.map((__, column) => handCode(row, column))),
    sampleHandClasses: [...sampleRange],
    board,
    cardRemoval,
  });
}

function rangeComparisonStats(facts) {
  const counts = facts?.categoryCounts || {};
  return {
    veryStrong: counts.very_strong_made || 0,
    strongMade: counts.strong_made || 0,
    marginal: counts.marginal_or_draw || 0,
    air: counts.air || 0,
    total: facts?.coverage?.eligibleRepresentativeCount || 0,
  };
}

function renderRangeCategoryBars(stats, side) {
  const mappings = [
    ['VeryStrong', 'veryStrong'], ['StrongMade', 'strongMade'],
    ['Marginal', 'marginal'], ['Air', 'air'],
  ];
  mappings.forEach(([idPart, key]) => {
    const share = stats.total ? stats[key] / stats.total * 100 : 0;
    const bar = $(`#${side}${idPart}Bar`);
    if (bar) bar.style.width = `${share.toFixed(1)}%`;
  });
}

function renderRangeGrid(gridId, hoverInfoId, comparisonFacts, statIds) {
  const grid = $('#' + gridId);
  if (!grid) return { veryStrong:0, strongMade:0, marginal:0, air:0, total:0 };
  
  const stats = rangeComparisonStats(comparisonFacts);
  const CATEGORY = {
    very_strong_made: { state: 'very-strong', label: t('Very strong made') },
    strong_made: { state: 'strong-made', label: t('Strong made') },
    marginal_or_draw: { state: 'marginal-draw', label: t('Marginal or draw') },
    air: { state: 'air', label: t('Air') },
  };

  // Init grid once
  if (grid.children.length === 0) {
    grid.innerHTML = '';
    RANKS.forEach((_, row) => RANKS.forEach((__, col) => {
      const btn = document.createElement('button');
      btn.className = 'hand-cell range-cell';
      btn.type = 'button';
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-rowindex', String(row + 1));
      btn.setAttribute('aria-colindex', String(col + 1));
      btn.dataset.hand = handCode(row, col);
      btn.dataset.index = row * 13 + col;
      grid.appendChild(btn);
    }));
    
    // Event delegation
    const inspect = (e) => {
      const btn = e.target.closest('.range-cell');
      if (btn) {
        const info = $('#' + hoverInfoId);
        if (info) info.textContent = `${btn.dataset.hand}: ${btn.title}`;
      }
    };
    const clearInspection = (e) => {
      const btn = e.target.closest('.range-cell');
      if (btn) {
        const info = $('#' + hoverInfoId);
        if (info) info.textContent = t('Focus or hover a hand to see details');
      }
    };
    grid.addEventListener('mouseover', inspect);
    grid.addEventListener('focusin', inspect);
    grid.addEventListener('mouseout', clearInspection);
    grid.addEventListener('focusout', clearInspection);
  }

  RANKS.forEach((_, row) => RANKS.forEach((__, col) => {
    const hand = handCode(row, col);
    const cell = comparisonFacts?.cells?.[hand];
    const presentation = CATEGORY[cell?.category] || null;
    const idx = row * 13 + col;
    const btn = grid.children[idx];
    const fullyRemoved = cell?.state === 'fully_removed';
    const notInSample = cell?.state === 'not_in_sample';
    const state = fullyRemoved ? 'fully-removed' : notInSample ? 'not-in-sample' : 'eligible';
    const category = presentation?.state || 'none';
    const stateLabel = fullyRemoved
      ? t('Unavailable after known-card removal')
      : notInSample ? t('Not in sample') : presentation?.label || t('Unavailable');
    
    btn.textContent = hand;
    btn.title = stateLabel;
    btn.setAttribute('aria-label', `${hand}: ${stateLabel}`);
    btn.className = `hand-cell range-cell range-state-${category} is-${state}`;
    btn.dataset.category = category;
    btn.dataset.cardRemovalState = state;
    btn.dataset.sampleState = state;
    btn.disabled = false;
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

  const decisionContext = app.decisionContext?.schemaVersion === DECISION_CONTEXT_SCHEMA_VERSION
    ? app.decisionContext
    : deriveDecisionContext(readPlaybookScenarioInput());
  const commonBlockers = [...decisionContext.board, ...decisionContext.deadCards];
  const heroCardRemoval = projectHandClassesAfterCardRemoval([...heroRange], commonBlockers);
  const villainCardRemoval = projectHandClassesAfterCardRemoval(
    [...villainRange],
    [...commonBlockers, ...decisionContext.heroCards],
  );
  if (!heroCardRemoval || !villainCardRemoval) {
    if (analysis) analysis.hidden = true;
    if (status) {
      status.dataset.state = 'unavailable';
      status.textContent = t('Range comparison is unavailable because canonical card removal could not be loaded.');
    }
    return { status: 'card_removal_unavailable', mode: PLAYBOOK_MODES.SCENARIO, heroPos, villainPos };
  }
  const heroComparisonFacts = representativeRangeComparisonFacts(heroRange, board, heroCardRemoval);
  const villainComparisonFacts = representativeRangeComparisonFacts(villainRange, board, villainCardRemoval);
  if (!heroComparisonFacts || !villainComparisonFacts) {
    if (analysis) analysis.hidden = true;
    if (status) {
      status.dataset.state = 'unavailable';
      status.textContent = t('Range comparison is unavailable because canonical analysis facts could not be loaded.');
    }
    return { status: 'analysis_facts_unavailable', mode: PLAYBOOK_MODES.SCENARIO, heroPos, villainPos };
  }

  if (analysis) analysis.hidden = false;
  if (status) {
    status.dataset.state = 'available';
    status.textContent = t('Hero and opponent sample matrices are ready.');
  }

  const statIds = {
    hero: { veryStrong:'heroStatVeryStrong', strongMade:'heroStatStrongMade', marginal:'heroStatMarginal', air:'heroStatAir' },
    villain: { veryStrong:'vilStatVeryStrong', strongMade:'vilStatStrongMade', marginal:'vilStatMarginal', air:'vilStatAir' }
  };
  const heroStats = rangeComparisonStats(heroComparisonFacts);
  const villainStats = rangeComparisonStats(villainComparisonFacts);
  renderRangeGrid('heroRangeGrid', 'heroHoverInfo', heroComparisonFacts, statIds.hero);
  renderRangeGrid('villainRangeGrid', 'villainHoverInfo', villainComparisonFacts, statIds.villain);

  const pct = (value, total) => total ? `${(value / total * 100).toFixed(0)}%` : '0%';
  Object.entries(statIds.hero).forEach(([key, id]) => {
    if ($('#' + id)) $('#' + id).textContent = `${heroStats[key]} (${pct(heroStats[key], heroStats.total)})`;
  });
  Object.entries(statIds.villain).forEach(([key, id]) => {
    if ($('#' + id)) $('#' + id).textContent = `${villainStats[key]} (${pct(villainStats[key], villainStats.total)})`;
  });
  renderRangeCategoryBars(heroStats, 'hero');
  renderRangeCategoryBars(villainStats, 'villain');

  const heroStrongShare = (heroComparisonFacts.categoryShares.very_strong_made || 0)
    + (heroComparisonFacts.categoryShares.strong_made || 0);
  const villainStrongShare = (villainComparisonFacts.categoryShares.very_strong_made || 0)
    + (villainComparisonFacts.categoryShares.strong_made || 0);
  if ($('#heroAdvBar')) $('#heroAdvBar').style.width = `${(heroStrongShare * 100).toFixed(1)}%`;
  if ($('#villainAdvBar')) $('#villainAdvBar').style.width = `${(villainStrongShare * 100).toFixed(1)}%`;
  if ($('#heroRangeScore')) $('#heroRangeScore').textContent = `${(heroStrongShare * 100).toFixed(1)}% ${t('strong made categories')}`;
  if ($('#villainRangeScore')) $('#villainRangeScore').textContent = `${(villainStrongShare * 100).toFixed(1)}% ${t('strong made categories')}`;

  const heroRemoval = rangeRemovalPresentation(heroCardRemoval);
  const villainRemoval = rangeRemovalPresentation(villainCardRemoval);
  if ($('#rangeComparisonLimitation')) $('#rangeComparisonLimitation').textContent = t('Source: heuristic fixed-range/category analysis. Uses one canonical surviving representative per eligible sampled class; its category does not describe every combo in that class. This is not solver range advantage, range-vs-range equity, or sizing/frequency evidence.');
  if ($('#heroRangeBasis')) $('#heroRangeBasis').textContent = t('Hero · fixed heuristic class sample ({position})', { position: heroPos });
  if ($('#villainRangeBasis')) $('#villainRangeBasis').textContent = t('Opponent · fixed heuristic class sample ({position})', { position: villainPos });
  if ($('#rangeCoverageBasis')) $('#rangeCoverageBasis').textContent = t('{heroEligible} of {heroSample} Hero classes and {villainEligible} of {villainSample} opponent classes have one canonical surviving representative. Shares describe those representatives only, not every combo in each class; unlisted classes are not inferred.', {
    heroEligible: heroComparisonFacts.coverage.eligibleRepresentativeCount,
    heroSample: heroComparisonFacts.coverage.suppliedSampleClassCount,
    villainEligible: villainComparisonFacts.coverage.eligibleRepresentativeCount,
    villainSample: villainComparisonFacts.coverage.suppliedSampleClassCount,
  });
  if ($('#rangeRemovalSummary')) $('#rangeRemovalSummary').textContent = t('{heroAffected} Hero classes affected ({heroUnavailable} unavailable); {villainAffected} opponent classes affected ({villainUnavailable} unavailable). Board/dead cards condition both; Hero cards additionally condition the opponent.', {
    heroAffected: heroRemoval.affectedClasses,
    heroUnavailable: heroRemoval.unavailableClasses,
    villainAffected: villainRemoval.affectedClasses,
    villainUnavailable: villainRemoval.unavailableClasses,
  });
  if ($('#rangeRemovalTechnical')) $('#rangeRemovalTechnical').textContent = t('Physical combos removed within the selected class samples: Hero {heroCombos}; opponent {villainCombos}. Known weighted mass is unavailable because these samples have no combo weights.', {
    heroCombos: heroRemoval.removedCombos,
    villainCombos: villainRemoval.removedCombos,
  });
  const pairedComparison = document.querySelector('.paired-range-comparison');
  if (pairedComparison) pairedComparison.setAttribute('aria-label', t('Hero {hero}% and opponent {villain}% strong-category shares. Independent percentages on the same zero to one hundred percent scale.', {
    hero: (heroStrongShare * 100).toFixed(1),
    villain: (villainStrongShare * 100).toFixed(1),
  }));

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
      container.querySelectorAll('.piotree-children').forEach(el => el.classList.remove('collapsed'));
      container.querySelectorAll('.piotree-chevron').forEach(el => el.classList.add('open'));
    };
  }

  if ($('#treeCollapseAll')) {
    $('#treeCollapseAll').onclick = () => {
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
  if (trainingSessionMode() === 'full_hand') {
    if ($('#trainingFilterMessage')) $('#trainingFilterMessage').textContent = '';
    return;
  }
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

function syncCardPresentationState(presentation, { refresh = true } = {}) {
  if (!presentation) return;
  app.settings.fourColorDeck = presentation.fourColor;
  app.settings.cardRankStyle = presentation.rankStyle;
  app.settings.cardStyle = presentation.faceStyle;
  app.settings.cardBackStyle = presentation.backStyle;
  if (!refresh) return;
  renderAllCards();
  if (activeWorkspaceMode() === 'home' && homeViewModel) renderHomeWorkspace(homeViewModel);
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
}

function applyCardRankStyle(style, refresh = true) {
  const presentation = globalThis.RiverlineCardPresentation?.apply(
    { rankStyle: style },
    { emit: refresh }
  );
  if (!refresh) syncCardPresentationState(presentation, { refresh: false });
  return presentation;
}

function applyCardStyle(style, refresh = true) {
  const presentation = globalThis.RiverlineCardPresentation?.apply(
    { faceStyle: style },
    { emit: refresh }
  );
  if (!refresh) syncCardPresentationState(presentation, { refresh: false });
  return presentation;
}

function applyCardBackStyle(style, refresh = true) {
  const presentation = globalThis.RiverlineCardPresentation?.apply(
    { backStyle: style },
    { emit: refresh }
  );
  if (!refresh) syncCardPresentationState(presentation, { refresh: false });
  return presentation;
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
  const seed = trainingSessionMode() === 'full_hand'
    ? app.training.fullHandSnapshot?.handSeed
    : app.training.currentExercise?.seed;
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
  if (event.key.toLowerCase() === 'r'
    && (app.training.currentExercise || app.training.fullHandSnapshot)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    replayCurrentTrainingSeed();
  }
}

function composeTrainingWorkspace() {
  const rail = document.querySelector('.training-insight-column');
  const setupColumn = document.querySelector('.training-setup-column');
  const feedbackReferenceMount = $('#trainingFeedbackReferenceMount');
  const solution = $('#trainingSolution');
  if (!rail || rail.dataset.composed === 'true') return;

  rail.dataset.composed = 'true';
  rail.classList.add('training-study-rail');
  rail.setAttribute('aria-label', t('Session and study tools'));
  if (feedbackReferenceMount && solution) feedbackReferenceMount.append(solution);
  const fullHandDock = $('#trainingFullHandActionDock');
  const fullHandLifecycle = $('#trainingFullHandCompactControls');
  if (fullHandDock && fullHandLifecycle && fullHandLifecycle.parentElement !== fullHandDock) {
    fullHandDock.insertBefore(fullHandLifecycle, fullHandDock.querySelector('.panel-body'));
  }

  const orderedRailSurfaces = [
    $('#trainingSetupPanel'),
    $('#trainingFullHandActionDock'),
    document.querySelector('.training-session-panel'),
    $('#trainingReferenceSummary'),
    $('#trainingHistoryPanel'),
    document.querySelector('.training-assistance-panel'),
    $('#trainingMemoryPanel'),
    $('#trainingAdvanced'),
  ];
  orderedRailSurfaces.forEach((surface) => {
    if (surface) rail.append(surface);
  });
  setupColumn?.remove();
}

function projectTrainingDecisionControls(fullHandActive = false) {
  const controls = $('#trainingDecisionControls');
  const destination = fullHandActive
    ? $('#trainingFullHandActionDockMount')
    : $('#trainingDecisionActionMount');
  const dock = $('#trainingFullHandActionDock');
  if (controls && destination && controls.parentElement !== destination) destination.append(controls);
  if (dock) dock.hidden = !fullHandActive;
  controls?.classList.toggle('is-full-hand-action-grammar', fullHandActive);
}

function projectTrainingContinuationControls(answered = false) {
  const row = $('#trainingContinuationRow');
  const destination = answered
    ? $('#trainingFeedbackProgressionMount')
    : $('#trainingDecisionProgressionMount');
  if (row && destination && row.parentElement !== destination) destination.append(row);
}

function selectedTrainingControlLabel(selector) {
  const control = $(selector);
  const option = control?.selectedOptions?.[0];
  return option ? t(option.dataset.i18n || option.textContent.trim()) : '';
}

function updateTrainingSetupSummary() {
  const summary = $('#trainingSetupSummary');
  if (!summary) return;
  const mode = trainingSessionMode();
  const modeLabel = t(mode === 'varied' ? 'Varied Session' : mode === 'focused' ? 'Focused Drill' : 'Full Hand');
  const assistance = selectedTrainingControlLabel('#trainingDifficulty');
  const configuration = mode === 'varied'
    ? `${$('#trainingSessionLength')?.value || 10} ${t('decisions')}`
    : mode === 'focused'
      ? [selectedTrainingControlLabel('#trainingStreet'), selectedTrainingControlLabel('#trainingDecisionTarget')].filter(Boolean).join(' / ')
      : `${$('#trainingHeroPos')?.value || 'UTG'} · ${$('#trainingPlayers')?.value || 8}-max · ${$('#trainingStack')?.value || 30} bb`;
  summary.textContent = [modeLabel, configuration, assistance].filter(Boolean).join(' · ');
}

function setTrainingSetupExpanded(expanded, { focus = false } = {}) {
  const setup = $('#trainingSetupPanel');
  if (!setup) return;
  setup.open = Boolean(expanded);
  if (!expanded || !focus) return;
  const selector = trainingSessionMode() === 'varied'
    ? '#trainingSessionLength'
    : trainingSessionMode() === 'full_hand' ? '#trainingHeroPos' : '#trainingStreet';
  $(selector)?.focus({ preventScroll: false });
}

function requestTrainingSessionModeChange(mode) {
  if (mode === trainingSessionMode()) return;
  if (trainingSessionIsActive() && !window.confirm(t(
    'Change Training mode? The active session will be marked incomplete, and its recorded decisions will remain in Training Memory.',
  ))) return;
  setTrainingSessionMode(mode);
}

function openTrainingMemoryView(view) {
  const panel = $('#trainingMemoryPanel');
  if (!panel) return;
  setTrainingMemoryView(view);
  panel.open = true;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  panel.scrollIntoView({ block: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
}

function initTrainingMode() {
  const bind = (selector, eventName, handler) => {
    const element = $(selector);
    if (!element || element.dataset.bound) return;
    element.dataset.bound = 'true';
    element.addEventListener(eventName, handler);
  };

  bind('#trainingResetStats', 'click', resetTrainingStats);
  bind('#trainingNewHand', 'click', () => startConfiguredTrainingSessionWithGuard());
  bind('#trainingNextHandBtn', 'click', () => requestNextTrainingExercise());
  bind('#trainingRetryButton', 'click', () => requestNextTrainingExercise({ retry: true }));
  document.querySelectorAll('[data-training-session-mode]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => requestTrainingSessionModeChange(button.dataset.trainingSessionMode));
  });
  bind('#trainingRestartSession', 'click', () => startConfiguredTrainingSessionWithGuard());
  bind('#trainingCompletionReview', 'click', () => openTrainingMemoryView('review'));
  bind('#trainingCompletionRecent', 'click', () => openTrainingMemoryView('recent'));
  bind('#trainingReplayBtn', 'click', replayCurrentTrainingSeed);
  bind('#trainingReplayDecisionBtn', 'click', replayCurrentTrainingDecision);
  bind('#trainingGenerateSeed', 'click', () => {
    const seed = selectedTrainingSeed();
    if (seed !== null) startConfiguredTrainingSessionWithGuard({ seed });
  });
  bind('#trainingCopySeed', 'click', copyCurrentTrainingSeed);
  bind('#trainingFullHandNewHand', 'click', () => startConfiguredTrainingSessionWithGuard());
  bind('#trainingFullHandLiveNewHand', 'click', () => startConfiguredTrainingSessionWithGuard());
  bind('#trainingFullHandEndHand', 'click', abortFullHandTraining);
  bind('#trainingReviewHand', 'click', toggleFullHandTrainingReview);
  bind('#trainingMemoryPanel', 'toggle', (event) => {
    if (event.currentTarget.open) void refreshTrainingMemoryPanel();
  });
  document.querySelectorAll('[data-memory-view]').forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => setTrainingMemoryView(button.dataset.memoryView));
    button.addEventListener('keydown', handleTrainingMemoryTabKey);
  });
  bind('#trainingMarkReview', 'click', () => toggleCurrentTrainingMemoryMetadata('review'));
  bind('#trainingMarkDifficult', 'click', () => toggleCurrentTrainingMemoryMetadata('difficult'));
  bind('#trainingAdjustDrill', 'click', () => {
    $('#trainingAdvanced')?.removeAttribute('open');
    setTrainingSetupExpanded(true, { focus: true });
  });

  bind('#trainingRevealHint', 'click', revealNextTrainingStudyHint);
  bind('#trainingDifficulty', 'change', () => {
    updateAssistanceDisplay();
    updateTrainingSetupSummary();
  });
  bind('#trainingStreet', 'change', () => {
    updateTrainingFilterAvailability();
    updateTrainingSetupSummary();
  });
  bind('#trainingDecisionTarget', 'change', () => {
    updateTrainingFilterAvailability();
    updateTrainingSetupSummary();
  });
  bind('#trainingHeroPos', 'change', () => {
    updateTrainingFilterAvailability();
    updateTrainingSetupSummary();
  });
  for (const selector of [
    '#trainingSessionLength',
    '#trainingVariedEmphasis',
    '#trainingVariedStackPreference',
  ]) bind(selector, 'change', updateTrainingSetupSummary);

  bind('#trainingPlayers', 'input', function syncTrainingPlayers() {
    $('#trainingPlayersNum').value = this.value;
    updateTrainingPositions();
    updateTrainingFilterAvailability();
    updateTrainingSetupSummary();
  });
  bind('#trainingPlayersNum', 'input', function syncTrainingPlayersNumber() {
    $('#trainingPlayers').value = this.value;
    updateTrainingPositions();
    updateTrainingFilterAvailability();
    updateTrainingSetupSummary();
  });
  bind('#trainingStack', 'input', function syncTrainingStack() {
    $('#trainingStackNum').value = this.value;
    updateTrainingSetupSummary();
  });
  bind('#trainingStackNum', 'input', function syncTrainingStackNumber() {
    $('#trainingStack').value = this.value;
    updateTrainingSetupSummary();
  });

  if (!document.documentElement.dataset.trainingKeyboardBound) {
    document.documentElement.dataset.trainingKeyboardBound = 'true';
    document.addEventListener('keydown', handleTrainingKeyboardShortcut);
  }
  composeTrainingWorkspace();
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
    `<span class="training-readonly-card riverline-card" data-card-size="standard" role="img" aria-label="${displayCard(card)}">${cardMarkup(card)}</span>`;
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
  const levelBadge = $('#trainingAssistanceLevel');
  if (levelBadge) {
    const label = level === 'guided' ? 'Guided' : level === 'easy' ? 'Easy' : 'Hard';
    levelBadge.dataset.i18n = label;
    levelBadge.textContent = t(label);
  }

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
  renderAnalysisStudyHints($('#trainingStudyHintContent'), explanation, app.training.studyHintStep, {
    street: exercise.decisionContext.street,
  });
  emitStudyExperience('reference_comparison_revealed', {
    source: 'training_hint',
    payload: { step: app.training.studyHintStep, feedbackSemantics: 'neutral_hint' },
  });
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

function renderTrainingFrequencyReference(stack, rows, solution, evaluation) {
  const actionsList = (Array.isArray(solution) ? solution : []).map((entry) => ({
    action: entry.action,
    name: entry.name,
    pct: entry.value,
    kind: visualActionKind(entry),
    color: actionVisualColor(entry)
  }));

  actionsList.sort((a, b) => b.pct - a.pct);

  if (typeof renderFrequencyStack === 'function') {
    renderFrequencyStack(stack, actionsList.map((action) => ({
      name: action.name,
      value: action.pct,
      kind: action.kind,
      action: action.action
    })));
  }

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
  return actionsList;
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
  renderFrequencyStack($('#trainingFrequencyStack'), actionsList.map((action) => ({
    name: action.name,
    value: action.pct,
    kind: action.kind,
    action: action.action
  })));
  const evaluation = app.training.currentEvaluation;
  const rows = $('#trainingFrequencyRows');
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

let fullHandPresentationOrchestrator = null;
let fullHandPresentationMotionToken = 0;

function nextTrainingSeed(seed) {
  return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0;
}

function trainingSessionMode() {
  return ['varied', 'focused', 'full_hand'].includes(app.training.sessionMode)
    ? app.training.sessionMode
    : 'varied';
}

function restoreSharedPokerTable() {
  const table = $('#visual-table-container');
  const playbookMount = $('#table-wrapper');
  if (!table || !playbookMount || table.parentElement === playbookMount) return false;
  playbookMount.appendChild(table);
  return true;
}

function renderFullHandCompactTimeline(tablePresentation) {
  const root = $('#trainingFullHandTimeline');
  const timeline = tablePresentation?.timeline;
  if (!root) return;
  root.replaceChildren();
  root.hidden = !timeline || tablePresentation?.tablePresence?.empty === true;
  if (root.hidden) return;
  root.dataset.timelineMode = tablePresentation.timelineMode;
  const reviewMode = tablePresentation.timelineMode === 'review'
    && app.handReview.source === 'training_full_hand';
  if (reviewMode) {
    root.hidden = true;
    return;
  }
  for (const group of timeline.groups || []) {
    const section = document.createElement('section');
    section.className = 'full-hand-timeline-street';
    section.dataset.street = group.street;
    const heading = document.createElement('strong');
    heading.textContent = t(group.headingKey);
    section.appendChild(heading);
    for (const entry of group.entries) {
      const token = document.createElement('span');
      token.className = `full-hand-timeline-action${entry.isHero ? ' is-hero' : ''}${entry.presentationState === 'current' ? ' is-current' : ''}`;
      token.dataset.frameIndex = String(entry.frameIndex ?? '');
      if (entry.presentationState === 'current') token.setAttribute('aria-current', 'step');
      if (entry.itemKind === 'transition') {
        const cards = (entry.cards || []).map((card) => card.token).join(' ');
        token.textContent = `${t(entry.labelKey)}${cards ? ` ${cards}` : ''}`;
      } else {
        const amount = Number.isSafeInteger(entry.amountMilliBb)
          ? ` ${formatCanonicalBb(entry.amountMilliBb)}`
          : '';
        token.textContent = `${entry.position || replayActorLabel(entry)} ${t(entry.actionLabelKey)}${amount}`;
      }
      section.appendChild(token);
    }
    root.appendChild(section);
  }
  if (timeline.showCurrentMarker) {
    const marker = document.createElement('span');
    marker.className = 'full-hand-timeline-marker';
    marker.setAttribute('aria-current', 'step');
    marker.textContent = replayMarkerLabel(timeline.currentMarker);
    root.appendChild(marker);
  }
}

function dispatchFullHandTrainingTable(snapshot, {
  previousSnapshot = null,
  event = null,
  motionEnabled = true,
  review = false,
} = {}) {
  if (activeWorkspaceMode() !== 'training' || !trainingModeIsVisible()) return false;
  const table = $('#visual-table-container');
  const mount = $('#trainingFullHandTableMount');
  if (!table || !mount || !snapshot?.state) return false;
  if (table.parentElement !== mount) mount.appendChild(table);
  mount.hidden = false;
  const reviewActive = review || app.handReview.source === 'training_full_hand';
  mount.dataset.replayMode = reviewActive ? 'review' : 'live';
  const transition = previousSnapshot && event
    ? callTrainingServiceBridge('createFullHandTableTransition', {
      previousSnapshot,
      snapshot,
      event,
      token: ++fullHandPresentationMotionToken,
      motionEnabled,
    })
    : null;
  const tablePresence = transition?.tablePresence
    || callTrainingServiceBridge('createFullHandTablePresence', snapshot);
  if (!tablePresence) return false;
  const tablePresentation = callTrainingServiceBridge('createFullHandTablePresentation', snapshot, {
    review: reviewActive,
    submissionLocked: app.training.lifecycle === 'grading'
      || app.training.lifecycle === 'automating',
    tablePresence
  }) || tablePresence;
  table.dataset.trainingHeroTurn = String(
    snapshot.status === 'awaiting_hero'
    && snapshot.state?.actingPlayerId === snapshot.heroPlayerId,
  );
  mount.dataset.presentationEvent = event?.transitionKind || 'state';
  mount.dataset.tableProjection = tablePresentation.projection || 'play';
  mount.dataset.tableVisualState = tablePresentation.visualState || 'live_decision';
  renderFullHandCompactTimeline(tablePresentation);
  window.dispatchEvent(new CustomEvent('gameStateUpdate', { detail: tablePresentation }));
  return true;
}

function invalidateFullHandPresentation() {
  fullHandPresentationOrchestrator?.invalidate();
}

function setFullHandTrainingPhase(phase = 'setup') {
  const workspace = $('#trainingWorkspace');
  if (!workspace) return;
  const nextPhase = trainingSessionMode() === 'full_hand' ? phase : 'off';
  workspace.dataset.trainingFullHandPhase = nextPhase;
  const active = ['live', 'complete', 'review'].includes(nextPhase);
  projectTrainingDecisionControls(nextPhase === 'live');
  const compact = $('#trainingFullHandCompactControls');
  if (compact) compact.hidden = !active;
  const abort = $('#trainingFullHandEndHand');
  if (abort) abort.hidden = nextPhase !== 'live';
  if ($('#trainingFullHandCompactSeed')) {
    $('#trainingFullHandCompactSeed').textContent = Number.isInteger(app.training.fullHandSnapshot?.handSeed)
      ? String(app.training.fullHandSnapshot.handSeed)
      : '—';
  }
  if ($('#trainingFullHandCompactStatus')) {
    const statusKey = nextPhase === 'live' ? 'Playing to Hero'
      : nextPhase === 'review' ? 'Post-Hand Review'
        : nextPhase === 'complete' ? 'Hand Complete' : 'Ready';
    $('#trainingFullHandCompactStatus').textContent = t(statusKey);
  }
  const history = $('#trainingHistoryPanel');
  if (history && nextPhase === 'live' && phase !== workspace.dataset.previousFullHandPhase) {
    history.open = false;
  }
  if (history && nextPhase === 'review') history.open = true;
  workspace.dataset.previousFullHandPhase = nextPhase;
  if ($('#trainingHistoryEyebrow')) {
    const key = active ? 'Recent actions' : 'Canonical replay';
    $('#trainingHistoryEyebrow').dataset.i18n = key;
    $('#trainingHistoryEyebrow').textContent = t(key);
  }
  if (!active) {
    if ($('#trainingFullHandTableMount')) $('#trainingFullHandTableMount').hidden = true;
    if ($('#trainingFullHandTimeline')) $('#trainingFullHandTimeline').hidden = true;
    restoreSharedPokerTable();
  }
}

function trainingSessionLength() {
  const value = $('#trainingSessionLength')?.value || '10';
  return value === 'open' ? null : Number.parseInt(value, 10);
}

function setTrainingMemoryStatus(messageKey, variables = {}, { error = false } = {}) {
  const status = $('#trainingMemoryStatus');
  if (!status) return;
  status.textContent = messageKey ? t(messageKey, variables) : '';
  status.dataset.error = String(error);
}

function queueTrainingMemoryWrite(operation) {
  const queued = Promise.resolve(app.training.memoryWritePromise)
    .catch(() => null)
    .then(operation);
  const handled = queued.catch((error) => {
    console.error('[Riverline Training Memory]', error);
    setTrainingMemoryStatus(
      'Training Memory is unavailable. Existing history was left untouched.',
      {},
      { error: true },
    );
    return null;
  });
  app.training.memoryWritePromise = handled;
  return handled;
}

function resetTrainingMemoryDecisionState() {
  app.training.memoryCurrentRecordPromise = null;
  app.training.memoryCurrentRecordId = null;
  app.training.memoryPendingOrigin = null;
  app.training.memoryPendingOriginPromise = null;
  const actions = $('#trainingMemoryDecisionActions');
  if (actions) actions.hidden = true;
  const review = $('#trainingMarkReview');
  const difficult = $('#trainingMarkDifficult');
  if (review) {
    review.setAttribute('aria-pressed', 'false');
    review.dataset.i18n = 'Review later';
    review.textContent = t('Review later');
    review.removeAttribute('aria-label');
  }
  if (difficult) {
    difficult.setAttribute('aria-pressed', 'false');
    difficult.dataset.i18n = 'Mark difficult';
    difficult.textContent = t('Mark difficult');
    difficult.removeAttribute('aria-label');
  }
  if ($('#trainingMemoryDecisionStatus')) $('#trainingMemoryDecisionStatus').textContent = '';
}

function updateTrainingMemoryDecisionActions(record) {
  if (!record || record.id !== app.training.memoryCurrentRecordId) return;
  const actions = $('#trainingMemoryDecisionActions');
  if (actions) actions.hidden = record.status !== 'answered';
  const toggles = [
    {
      selector: '#trainingMarkReview',
      active: Boolean(record.studyMetadata?.review),
      inactiveKey: 'Review later',
      activeKey: 'Added to review',
      undoKey: 'Remove from review',
    },
    {
      selector: '#trainingMarkDifficult',
      active: Boolean(record.studyMetadata?.difficult),
      inactiveKey: 'Mark difficult',
      activeKey: 'Marked difficult',
      undoKey: 'Clear difficult mark',
    },
  ];
  toggles.forEach(({ selector, active, inactiveKey, activeKey, undoKey }) => {
    const button = $(selector);
    if (!button) return;
    const visibleKey = active ? activeKey : inactiveKey;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', t(active ? undoKey : inactiveKey));
    button.dataset.i18n = visibleKey;
    button.textContent = t(visibleKey);
  });
}

function startTrainingMemorySession(input) {
  const priorSessionPromise = app.training.memorySessionPromise;
  resetTrainingMemoryDecisionState();
  app.training.memoryRedrillNote = '';
  app.training.memoryFullHandDecisionRecords = new Map();
  const sessionPromise = queueTrainingMemoryWrite(async () => {
    const prior = await priorSessionPromise;
    if (prior?.id) await callTrainingMemoryBridge('finishSession', prior.id, 'abandoned');
    return callTrainingMemoryBridge('startSession', input);
  });
  app.training.memorySessionPromise = sessionPromise;
  return sessionPromise;
}

function finishTrainingMemorySession(status = 'completed', finishOptions = {}) {
  const sessionPromise = app.training.memorySessionPromise;
  if (!sessionPromise) return Promise.resolve(null);
  app.training.memorySessionPromise = null;
  app.training.memoryFullHandDecisionRecords = new Map();
  return queueTrainingMemoryWrite(async () => {
    const session = await sessionPromise;
    if (!session?.id) return null;
    const finished = await callTrainingMemoryBridge(
      'finishSession',
      session.id,
      status,
      finishOptions,
    );
    if ($('#trainingMemoryPanel')?.open) void refreshTrainingMemoryPanel();
    return finished;
  });
}

function recordTrainingExerciseShown(exercise) {
  const sessionPromise = app.training.memorySessionPromise;
  if (!sessionPromise || !exercise) return null;
  const origin = app.training.memoryPendingOrigin;
  const originPromise = app.training.memoryPendingOriginPromise;
  app.training.memoryPendingOrigin = null;
  app.training.memoryPendingOriginPromise = null;
  resetTrainingMemoryDecisionState();
  const recordPromise = queueTrainingMemoryWrite(async () => {
    const session = await sessionPromise;
    if (!session?.id) return null;
    const resolvedOrigin = origin || await Promise.resolve(originPromise).catch(() => null);
    const record = await callTrainingMemoryBridge('recordExerciseShown', {
      sessionId: session.id,
      exercise,
      parentDecisionRecordId: resolvedOrigin?.parentDecisionRecordId ?? null,
      redrillKind: resolvedOrigin?.redrillKind ?? null,
    });
    if (record && app.training.currentExercise?.id === exercise.id) {
      app.training.memoryCurrentRecordId = record.id;
    }
    return record;
  });
  app.training.memoryCurrentRecordPromise = recordPromise;
  return recordPromise;
}

function recordTrainingExerciseAnswered({ evaluation, exercise, actionType, amountToMilliBb = null }) {
  const recordPromise = app.training.memoryCurrentRecordPromise;
  if (!recordPromise) return null;
  return queueTrainingMemoryWrite(async () => {
    const record = await recordPromise;
    if (!record?.id) return null;
    const answered = await callTrainingMemoryBridge('recordExerciseAnswered', {
      recordId: record.id,
      evaluation,
      strategyResult: exercise.strategyResult,
      actionType,
      amountToMilliBb,
    });
    if (answered && app.training.memoryCurrentRecordId === answered.id) {
      app.training.memoryCurrentRecordPromise = Promise.resolve(answered);
      updateTrainingMemoryDecisionActions(answered);
    }
    if ($('#trainingMemoryPanel')?.open) void refreshTrainingMemoryPanel();
    return answered;
  });
}

function recordFullHandTrainingDecisionShown(snapshot) {
  const decision = snapshot?.currentDecision;
  const sessionPromise = app.training.memorySessionPromise;
  if (!decision || !sessionPromise) return null;
  const existing = app.training.memoryFullHandDecisionRecords.get(decision.decisionId);
  if (existing) {
    app.training.memoryCurrentRecordPromise = existing;
    void existing.then((record) => {
      if (record) app.training.memoryCurrentRecordId = record.id;
    });
    return existing;
  }
  resetTrainingMemoryDecisionState();
  const recordPromise = queueTrainingMemoryWrite(async () => {
    const session = await sessionPromise;
    if (!session?.id) return null;
    const record = await callTrainingMemoryBridge('recordFullHandDecisionShown', {
      sessionId: session.id,
      decision,
      replaySource: snapshot.replaySource,
      handSeed: snapshot.handSeed,
    });
    if (record && app.training.fullHandSnapshot?.currentDecision?.decisionId === decision.decisionId) {
      app.training.memoryCurrentRecordId = record.id;
    }
    return record;
  });
  app.training.memoryFullHandDecisionRecords.set(decision.decisionId, recordPromise);
  app.training.memoryCurrentRecordPromise = recordPromise;
  return recordPromise;
}

function recordFullHandTrainingDecisionAnswered(result) {
  const decision = result?.decision;
  const recordPromise = decision
    ? app.training.memoryFullHandDecisionRecords.get(decision.decisionId)
    : null;
  if (!decision || !recordPromise) return Promise.resolve(null);
  return queueTrainingMemoryWrite(async () => {
    const record = await recordPromise;
    if (!record?.id) return null;
    const answered = await callTrainingMemoryBridge('recordFullHandDecisionAnswered', {
      recordId: record.id,
      decision,
      replaySource: result.snapshot.replaySource,
      handSeed: result.snapshot.handSeed,
    });
    if (answered && app.training.memoryCurrentRecordId === answered.id) {
      app.training.memoryCurrentRecordPromise = Promise.resolve(answered);
      updateTrainingMemoryDecisionActions(answered);
    }
    if ($('#trainingMemoryPanel')?.open) void refreshTrainingMemoryPanel();
    return answered;
  });
}

const TRAINING_MEMORY_REASON_LABELS = Object.freeze({
  differs_from_reference: 'Differs from Riverline reference',
  close_to_reference: 'Close to Riverline reference',
  source_unavailable: 'Source comparison unavailable',
  manual_review: 'Manually marked Review',
  manual_difficult: 'Manually marked Difficult',
  manual_important: 'Manually marked Important',
  manual_my_mistake: 'User label: My mistake',
});

function trainingMemoryDate(isoTimestamp) {
  try {
    return new Intl.DateTimeFormat(window.appLang || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoTimestamp));
  } catch (_) {
    return String(isoTimestamp || '');
  }
}

function trainingMemoryModeLabel(mode) {
  return t({
    varied: 'Varied',
    focused: 'Focused',
    full_hand: 'Full Hand',
    review: 'Review',
  }[mode] || mode);
}

function trainingMemoryComparisonLabel(comparison) {
  return t({
    matches_reference: 'Matches reference',
    close_to_reference: 'Close to reference',
    differs_from_reference: 'Differs from reference',
    unsupported: 'Unsupported',
    unavailable: 'Unavailable',
  }[comparison] || 'Unavailable');
}

function trainingMemoryButton(labelKey, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = t(labelKey);
  button.addEventListener('click', handler);
  return button;
}

function trainingMemoryDecisionSummary(record) {
  const context = record.decisionContext;
  const wrapper = document.createElement('div');
  wrapper.className = 'training-memory-decision-summary';
  const cards = document.createElement('strong');
  cards.className = 'poker-data-token training-memory-cards';
  cards.dir = 'ltr';
  const board = context.board?.length ? context.board.join(' ') : t('Preflop');
  cards.textContent = `${context.heroCards.join(' ')} · ${board}`;
  const spot = document.createElement('span');
  spot.textContent = [
    t(context.street.charAt(0).toUpperCase() + context.street.slice(1)),
    context.heroPosition,
    Number.isFinite(context.effectiveStackBb)
      ? `${t('Effective stack')} ${context.effectiveStackBb} bb`
      : null,
    Number.isFinite(context.currentPotBb) ? `${t('Pot')} ${context.currentPotBb} bb` : null,
    Number.isFinite(context.callAmountBb) && context.callAmountBb > 0
      ? `${t('Facing')} ${context.callAmountBb} bb`
      : null,
  ].filter(Boolean).join(' · ');
  wrapper.append(cards, spot);
  return wrapper;
}

function renderTrainingMemoryDecisionItem(record, { reviewItem = null } = {}) {
  const item = document.createElement('li');
  item.className = 'training-memory-item training-memory-decision-item';
  item.dataset.recordId = record.id;
  item.appendChild(trainingMemoryDecisionSummary(record));

  const facts = document.createElement('div');
  facts.className = 'training-memory-facts';
  const chosen = document.createElement('span');
  chosen.textContent = record.userResponse?.action?.type
    ? `${t('Chosen action')}: ${t(trainingActionLabel(record.userResponse.action.type, record.decisionContext))}`
    : t('No answer recorded');
  const source = document.createElement('span');
  source.className = 'poker-data-token';
  source.dir = 'ltr';
  const result = record.strategyEvidence?.strategyResult;
  source.textContent = result
    ? `${result.source}@${result.sourceVersion}`
    : t('Source unavailable');
  const comparison = document.createElement('span');
  comparison.textContent = trainingMemoryComparisonLabel(
    record.strategyEvidence?.comparisonState ?? 'unavailable',
  );
  const coverage = document.createElement('span');
  coverage.textContent = record.strategyEvidence?.claimPolicy?.coverage?.kind
    ? `${t('Coverage')}: ${record.strategyEvidence.claimPolicy.coverage.kind}`
    : t('Coverage unavailable');
  facts.append(chosen, source, coverage, comparison);
  item.appendChild(facts);

  if (reviewItem?.reasons?.length) {
    const reasons = document.createElement('div');
    reasons.className = 'training-memory-reasons';
    const label = document.createElement('strong');
    label.textContent = t('Review because:');
    const list = document.createElement('ul');
    reviewItem.reasons.forEach((reason) => {
      const entry = document.createElement('li');
      entry.textContent = t(TRAINING_MEMORY_REASON_LABELS[reason] || reason);
      list.appendChild(entry);
    });
    reasons.append(label, list);
    item.appendChild(reasons);
  }

  if (record.status === 'answered') {
    const actions = document.createElement('div');
    actions.className = 'training-memory-item-actions';
    if (reviewItem) {
      actions.append(
        trainingMemoryButton('Done', 'ui-button ui-button--secondary', async () => {
          await queueTrainingMemoryWrite(() => callTrainingMemoryBridge('markReviewed', record.id));
          void refreshTrainingMemoryPanel();
        }),
        trainingMemoryButton('Review tomorrow', 'ui-button ui-button-ghost', async () => {
          await queueTrainingMemoryWrite(() => callTrainingMemoryBridge('snooze', record.id, 1));
          void refreshTrainingMemoryPanel();
        }),
      );
    } else if (record.reviewState?.state !== 'pending') {
      actions.append(trainingMemoryButton('Review again', 'ui-button ui-button--secondary', async () => {
        await queueTrainingMemoryWrite(() => (
          record.studyMetadata?.review
            ? callTrainingMemoryBridge('reviewAgain', record.id)
            : callTrainingMemoryBridge('updateStudyMetadata', record.id, { review: true })
        ));
        void refreshTrainingMemoryPanel();
      }));
    }
    actions.append(
      trainingMemoryButton('Same Spot', 'ui-button ui-button--secondary', () => {
        void openTrainingMemoryRedrill(record.id, 'same_spot');
      }),
      trainingMemoryButton('Similar Spot', 'ui-button ui-button-ghost', () => {
        void openTrainingMemoryRedrill(record.id, 'similar_spot');
      }),
    );
    item.appendChild(actions);
  }
  return item;
}

async function populateTrainingMemorySessionDecisions(container, sessionId) {
  container.replaceChildren();
  const decisions = await callTrainingMemoryBridge('listSessionDecisions', sessionId, { limit: 25 });
  if (!Array.isArray(decisions) || decisions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'training-memory-empty';
    empty.textContent = t('No decisions recorded in this session.');
    container.appendChild(empty);
    return;
  }
  const list = document.createElement('ul');
  list.className = 'training-memory-session-decisions';
  decisions.forEach((record) => list.appendChild(renderTrainingMemoryDecisionItem(record)));
  container.appendChild(list);
}

function renderTrainingMemorySessionItem(entry) {
  const { session, summary } = entry;
  const item = document.createElement('li');
  item.className = 'training-memory-item training-memory-session-item';
  const details = document.createElement('details');
  const head = document.createElement('summary');
  const title = document.createElement('strong');
  title.textContent = `${trainingMemoryModeLabel(session.mode)} · ${trainingMemoryDate(session.startedAt)}`;
  const status = document.createElement('span');
  const statusKey = session.status === 'completed'
    ? 'Completed'
    : session.status === 'active' ? 'Open session' : 'Incomplete';
  status.textContent = t(statusKey);
  const counts = document.createElement('small');
  counts.textContent = t('{answered} answered; {review} review', {
    answered: summary.answeredCount,
    review: summary.reviewCount,
  });
  head.append(title, status, counts);
  const source = document.createElement('p');
  source.className = 'poker-data-token training-memory-session-source';
  source.dir = summary.sourceIds.length ? 'ltr' : 'auto';
  source.textContent = summary.sourceIds.length
    ? summary.sourceIds.join(', ')
    : t('Source unavailable');
  const comparison = document.createElement('p');
  comparison.className = 'training-memory-session-comparisons';
  comparison.textContent = Object.entries(summary.comparisonCounts)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${trainingMemoryComparisonLabel(key)}: ${count}`)
    .join(' · ') || t('No answer recorded');
  const decisions = document.createElement('div');
  decisions.className = 'training-memory-session-decision-mount';
  let loaded = false;
  details.addEventListener('toggle', () => {
    if (!details.open || loaded) return;
    loaded = true;
    void populateTrainingMemorySessionDecisions(decisions, session.id).catch((error) => {
      console.error('[Riverline Training Memory]', error);
      decisions.textContent = t('Training Memory is unavailable. Existing history was left untouched.');
    });
  });
  details.append(head, source, comparison, decisions);
  item.appendChild(details);
  return item;
}

async function refreshTrainingMemoryPanel() {
  const list = $('#trainingMemoryList');
  if (!list) return null;
  setTrainingMemoryStatus('Loading Training Memory…');
  list.replaceChildren();
  try {
    const due = await callTrainingMemoryBridge('listDueReview', { limit: 12 });
    if (!Array.isArray(due)) throw new Error('Training Memory review query is unavailable');
    const memoryPanel = $('#trainingMemoryPanel');
    if (memoryPanel) memoryPanel.dataset.memoryLoaded = 'true';
    if ($('#trainingMemoryDueBadge')) {
      $('#trainingMemoryDueBadge').textContent = String(due.length);
      $('#trainingMemoryDueBadge').hidden = due.length === 0;
    }
    let items;
    if (app.training.memoryView === 'recent') {
      items = await callTrainingMemoryBridge('listRecentSessions', { limit: 10 });
      if (!Array.isArray(items)) throw new Error('Training Memory session query is unavailable');
      items.forEach((entry) => list.appendChild(renderTrainingMemorySessionItem(entry)));
      if (items.length === 0) setTrainingMemoryStatus('No Training sessions recorded yet.');
      else setTrainingMemoryStatus('');
    } else {
      items = due;
      items.forEach((entry) => list.appendChild(
        renderTrainingMemoryDecisionItem(entry.record, { reviewItem: entry }),
      ));
      if (items.length === 0) setTrainingMemoryStatus('No decisions are due for review.');
      else setTrainingMemoryStatus('');
    }
    app.training.memoryLastItems = items;
    return items;
  } catch (error) {
    console.error('[Riverline Training Memory]', error);
    setTrainingMemoryStatus(
      'Training Memory is unavailable. Existing history was left untouched.',
      {},
      { error: true },
    );
    return null;
  }
}

function setTrainingMemoryView(view) {
  app.training.memoryView = view === 'recent' ? 'recent' : 'review';
  document.querySelectorAll('[data-memory-view]').forEach((button) => {
    const selected = button.dataset.memoryView === app.training.memoryView;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  const panel = $('#trainingMemoryList');
  if (panel) {
    panel.setAttribute('aria-labelledby', app.training.memoryView === 'recent'
      ? 'trainingMemoryRecentTab'
      : 'trainingMemoryReviewTab');
  }
  void refreshTrainingMemoryPanel();
}

function handleTrainingMemoryTabKey(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const buttons = [...document.querySelectorAll('[data-memory-view]')];
  const current = buttons.indexOf(event.currentTarget);
  if (current < 0) return;
  let next = current;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = buttons.length - 1;
  else {
    const rtl = document.documentElement.dir === 'rtl';
    const delta = event.key === 'ArrowRight' ? (rtl ? -1 : 1) : (rtl ? 1 : -1);
    next = (current + delta + buttons.length) % buttons.length;
  }
  event.preventDefault();
  setTrainingMemoryView(buttons[next].dataset.memoryView);
  buttons[next].focus();
}

async function toggleCurrentTrainingMemoryMetadata(field) {
  const recordPromise = app.training.memoryCurrentRecordPromise;
  if (!recordPromise) return null;
  const actions = $('#trainingMemoryDecisionActions');
  actions?.setAttribute('aria-busy', 'true');
  actions?.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  const operation = queueTrainingMemoryWrite(async () => {
    const record = await recordPromise;
    if (!record?.id || record.status !== 'answered') return null;
    const enabled = !record.studyMetadata[field];
    const updated = await callTrainingMemoryBridge('updateStudyMetadata', record.id, {
      [field]: enabled,
    });
    if (updated) {
      app.training.memoryCurrentRecordPromise = Promise.resolve(updated);
      app.training.memoryCurrentRecordId = updated.id;
      updateTrainingMemoryDecisionActions(updated);
      const statusKey = field === 'review'
        ? enabled
          ? 'Added to review. Training Memory review queue updated.'
          : 'Removed from review.'
        : enabled ? 'Marked difficult.' : 'Difficult mark removed.';
      if ($('#trainingMemoryDecisionStatus')) {
        $('#trainingMemoryDecisionStatus').textContent = t(statusKey);
      }
      setTrainingMemoryStatus(statusKey);
      if ($('#trainingMemoryPanel')?.open) void refreshTrainingMemoryPanel();
    }
    return updated;
  });
  return operation.finally(() => {
    actions?.setAttribute('aria-busy', 'false');
    actions?.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  });
}

async function openTrainingMemoryRedrill(recordId, kind) {
  setTrainingMemoryStatus('Loading Training Memory…');
  try {
    await app.training.memoryWritePromise;
    const result = kind === 'same_spot'
      ? await callTrainingMemoryBridge('createSameSpot', recordId)
      : await callTrainingMemoryBridge('generateSimilarSpot', recordId, {
          strategyProvider,
          attempt: 1,
        });
    if (!result || (kind === 'similar_spot' && !result.ok)) {
      setTrainingMemoryStatus('Similar Spot is unavailable for this record.', {}, { error: true });
      return null;
    }
    clearTrainingSessionState();
    setTrainingSessionMode('focused', { reset: false });
    prepareTrainingGeneration();
    startTrainingMemorySession({
      mode: 'review',
      requestedLength: 1,
      sessionSeed: result.exercise.seed,
      plannerIntent: null,
      focus: {
        redrillKind: kind,
        sourceDecisionRecordId: recordId,
        comparison: kind === 'same_spot' ? 'historical' : 'current',
        similarity: result.similarity ?? null,
      },
    });
    app.training.memoryPendingOrigin = {
      parentDecisionRecordId: recordId,
      redrillKind: kind,
    };
    const similarityLabels = {
      game_rules: 'Same game rules',
      decision_role: 'Same decision role',
      street: 'Same street',
      position_relation: 'Same position relation',
      prior_action_family: 'Same prior-action family',
      effective_stack_bucket: 'Similar effective stack',
    };
    app.training.memoryRedrillNote = kind === 'same_spot'
      ? t('Historical comparison')
      : [
          t('Similar because:'),
          ...(result.similarity?.dimensions || [])
            .filter((dimension) => dimension.quality !== 'unavailable'
              && similarityLabels[dimension.dimension])
            .map((dimension) => t(similarityLabels[dimension.dimension])),
        ].join(' ');
    const loaded = callTrainingServiceBridge('loadExercise', result.exercise);
    if (!loaded?.ok) throw new Error(loaded?.error?.message || 'Training re-drill could not load');
    renderCanonicalTrainingExercise(result.exercise);
    setTrainingMemoryStatus(kind === 'same_spot' ? 'Historical comparison' : 'Current comparison');
    $('#trainingExerciseSurface')?.scrollIntoView?.({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    return result;
  } catch (error) {
    console.error('[Riverline Training Memory re-drill]', error);
    setTrainingMemoryStatus(
      'Training Memory is unavailable. Existing history was left untouched.',
      {},
      { error: true },
    );
    return null;
  }
}

function clearTrainingSessionCompletion() {
  if (app.handReview.source === 'training_full_hand') {
    closeActiveHandReview({ returnToEndpoint: false });
  }
  app.training.practiceSession = null;
  app.training.fullHandSnapshot = null;
  if ($('#trainingSessionCompletion')) $('#trainingSessionCompletion').hidden = true;
  if ($('#trainingSessionCompletionText')) $('#trainingSessionCompletionText').textContent = '';
  if ($('#trainingFullHandCompletion')) $('#trainingFullHandCompletion').hidden = true;
  if ($('#trainingReviewHand')) $('#trainingReviewHand').setAttribute('aria-expanded', 'false');
  document.querySelector('.training-workspace')?.removeAttribute('data-training-session-complete');
  app.training.fullHandReviewIndex = 0;
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
  progress.textContent = t('Exercise {current} of {total}', {
    current: served,
    total: session.length,
  });
  progress.setAttribute('aria-label', progress.textContent);
}

function clearTrainingSessionState() {
  void finishTrainingMemorySession('abandoned');
  resetTrainingMemoryDecisionState();
  app.training.memoryRedrillNote = '';
  invalidateFullHandPresentation();
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
  app.training.currentAttemptKind = 'primary';
  app.training.replaySourceRecordPromise = null;
  app.training.currentHand = null;
  app.training.fullHandSnapshot = null;
  app.training.fullHandReviewIndex = 0;
  fullHandPresentationMotionToken = 0;
  app.training.hero = [];
  app.training.board = [];
  clearTrainingExercisePresentation();
  updateTrainingStats();
  updateTrainingSessionProgress();
  if ($('#trainingFilterMessage')) $('#trainingFilterMessage').textContent = t('Training session reset.');
  setTrainingWorkspaceState('idle');
  setTrainingSetupExpanded(true);
  setFullHandTrainingPhase(trainingSessionMode() === 'full_hand' ? 'setup' : 'off');
}

function setTrainingSessionMode(mode, { reset = true } = {}) {
  const nextMode = ['varied', 'focused', 'full_hand'].includes(mode) ? mode : 'varied';
  app.training.sessionMode = nextMode;
  document.querySelectorAll('[data-training-session-mode]').forEach((button) => {
    const selected = button.dataset.trainingSessionMode === nextMode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  if ($('#trainingVariedControls')) $('#trainingVariedControls').hidden = nextMode !== 'varied';
  if ($('#trainingFocusedControls')) $('#trainingFocusedControls').hidden = nextMode === 'varied';
  const focusedOnlyHidden = nextMode !== 'focused';
  $('#trainingStreet')?.closest('.ui-field')?.toggleAttribute('hidden', focusedOnlyHidden);
  $('#trainingDecisionTarget')?.closest('.ui-field')?.toggleAttribute('hidden', focusedOnlyHidden);
  if ($('#trainingFullHandSetupNote')) $('#trainingFullHandSetupNote').hidden = nextMode !== 'full_hand';
  if ($('#trainingSetupTitle')) {
    const key = nextMode === 'varied' ? 'Plan a varied session'
      : nextMode === 'full_hand' ? 'Configure a full hand' : 'Choose a decision family';
    $('#trainingSetupTitle').dataset.i18n = key;
    $('#trainingSetupTitle').textContent = t(key);
  }
  if ($('#trainingNewHand')) {
    const key = 'Start Training';
    $('#trainingNewHand').dataset.i18n = key;
    $('#trainingNewHand').textContent = t(key);
  }
  updateTrainingSetupSummary();
  if (reset) clearTrainingSessionState();
  else setFullHandTrainingPhase(nextMode === 'full_hand' ? 'setup' : 'off');
}

function readTrainingConfig(seed) {
  const tableSize = numericValue('#trainingPlayers', 6);
  const stackBb = numericValue('#trainingStack', 30);
  const heroPosition = $('#trainingHeroPos')?.value || POSITIONS[tableSize]?.[0] || 'BTN';
  const street = trainingSessionMode() === 'full_hand'
    ? 'any'
    : $('#trainingStreet')?.value || 'any';
  const target = trainingSessionMode() === 'full_hand'
    ? 'any'
    : $('#trainingDecisionTarget')?.value || 'any';
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
  projectTrainingContinuationControls(
    trainingSessionMode() !== 'full_hand' && state === 'feedback',
  );
  workspace.setAttribute('aria-busy', String(['generating', 'automating'].includes(state)));
  const stateBadge = $('#trainingStateBadge');
  const labels = {
    idle: 'Idle',
    generating: 'Generating',
    automating: 'Automating',
    ready: 'Decision ready',
    grading: 'Decision recorded',
    feedback: 'Feedback',
    complete: 'Session complete',
    terminal: 'Hand Complete',
    error: 'Error'
  };
  if (stateBadge) {
    stateBadge.textContent = t(labels[state] || state);
    stateBadge.className = `badge status-badge status-badge--${state === 'error' ? 'warning' : state === 'ready' ? 'available' : 'info'}`;
  }
  if ($('#trainingIdle')) $('#trainingIdle').hidden = state !== 'idle';
  if ($('#trainingGenerating')) $('#trainingGenerating').hidden = state !== 'generating';
  if ($('#trainingError')) $('#trainingError').hidden = state !== 'error';
  if ($('#trainingExerciseSurface')) {
    const activeFullHandReview = state === 'terminal'
      && app.handReview.source === 'training_full_hand';
    $('#trainingExerciseSurface').hidden = !(
      ['automating', 'ready', 'grading', 'feedback', 'complete'].includes(state)
      || activeFullHandReview
    );
  }
  if ($('#trainingFeedback')) {
    $('#trainingFeedback').hidden = trainingSessionMode() === 'full_hand' || state !== 'feedback';
  }
  const nextButton = $('#trainingNextHandBtn');
  if (nextButton && trainingSessionMode() !== 'full_hand') {
    nextButton.hidden = !['ready', 'feedback'].includes(state)
      || Boolean(app.training.practiceSession?.completed);
  }
  if ($('#trainingFullHandCompletion')) $('#trainingFullHandCompletion').hidden = state !== 'terminal';
  if (state === 'idle' || state === 'error') setTrainingSetupExpanded(true);
  const beforeSession = state === 'idle';
  for (const selector of ['#trainingHistoryPanel', '.training-assistance-panel']) {
    const panel = document.querySelector(selector);
    if (panel) panel.dataset.trainingAvailability = beforeSession ? 'before-session' : 'available';
  }
  for (const selector of ['#trainingHistoryAvailability', '#trainingAssistanceAvailability']) {
    const note = $(selector);
    if (note) note.hidden = !beforeSession;
  }
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
  if ($('#trainingDecisionNumber')) $('#trainingDecisionNumber').hidden = true;
  if ($('#trainingFullHandStacks')) $('#trainingFullHandStacks').hidden = true;
  if ($('#trainingFullHandActionStatus')) {
    $('#trainingFullHandActionStatus').hidden = true;
    $('#trainingFullHandActionStatus').textContent = '';
  }
  clearFullHandTrainingSizingControls();
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

function fullHandTrainingActionDetail(type, legalActions) {
  if (!legalActions) return '';
  if (type === 'call') return fullHandBbLabel(legalActions.call.commitMilliBb);
  if (type === 'all_in') return fullHandBbLabel(legalActions.allIn.amountToMilliBb);
  return '';
}

function fullHandBbLabel(amountMilliBb) {
  if (!Number.isSafeInteger(amountMilliBb)) return t('Unavailable');
  const value = (amountMilliBb / 1000).toFixed(3).replace(/\.?0+$/, '');
  return `${value} bb`;
}

function clearFullHandTrainingSizingControls({ clearSelection = true } = {}) {
  const surface = $('#trainingFullHandSizing');
  if (surface) surface.hidden = true;
  $('#trainingFullHandSizingActions')?.replaceChildren();
  if (clearSelection) app.training.fullHandSizedAction = null;
}

function fullHandSizingValidationCopy(validation, actionLabel, sizingModel) {
  const amount = fullHandBbLabel(validation?.amountToMilliBb);
  const messages = {
    required: () => t('Enter an amount-to.'),
    invalid_format: () => t('Use a numeric amount-to in bb.'),
    unsupported_precision: () => t('Use no more than three decimal places.'),
    action_unavailable: () => t('This action is no longer available.'),
    below_minimum: () => t('Minimum amount-to is {amount}.', {
      amount: fullHandBbLabel(sizingModel.minToMilliBb),
    }),
    above_maximum: () => t('Maximum amount-to is {amount}.', {
      amount: fullHandBbLabel(sizingModel.maxToMilliBb),
    }),
    chip_unit_misaligned: () => t('Amount-to must use {step} increments.', {
      step: `${sizingModel.stepValueBb} bb`,
    }),
  };
  if (validation?.valid) {
    return t('Legal amount-to: {amount}. Press Enter or choose {action}.', {
      amount,
      action: actionLabel,
    });
  }
  return (messages[validation?.errorCode] || messages.invalid_format)();
}

function renderFullHandTrainingSizingControls(actionType = app.training.fullHandSizedAction) {
  if (trainingSessionMode() !== 'full_hand') {
    clearFullHandTrainingSizingControls();
    return null;
  }
  const model = callTrainingServiceBridge('getFullHandSizingModel');
  const sizing = ['bet', 'raise'].includes(actionType)
    ? model?.actions?.[actionType]
    : null;
  const surface = $('#trainingFullHandSizing');
  const mount = $('#trainingFullHandSizingActions');
  if (!surface || !mount || !sizing) {
    clearFullHandTrainingSizingControls();
    return null;
  }

  mount.replaceChildren();
  app.training.fullHandSizedAction = sizing.actionType;
  actionType = sizing.actionType;
  const option = app.training.currentExercise?.legalActions?.[actionType] || {};
  const semanticLabel = trainingActionLabel(actionType, app.training.currentExercise?.decisionContext);
  const actionLabel = canonicalActionPresentation(actionType, option)?.label
    || t(semanticLabel) || semanticLabel;
  const controlId = `trainingFullHand${actionType === 'bet' ? 'Bet' : 'Raise'}AmountTo`;
  const boundsId = `${controlId}Bounds`;
  const validationId = `${controlId}Validation`;
  const action = document.createElement('div');
  action.className = 'training-full-hand-sizing-action';

  const entry = document.createElement('div');
  entry.className = 'training-full-hand-sizing-entry';
  const label = document.createElement('label');
  label.htmlFor = controlId;
  label.textContent = t('{action} to', { action: actionLabel });
  const amountControl = document.createElement('div');
  amountControl.className = 'training-full-hand-amount-control';
  const input = document.createElement('input');
  input.id = controlId;
  input.name = `${actionType}AmountToBb`;
  input.type = 'number';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.min = sizing.minValueBb;
  input.max = sizing.maxValueBb;
  input.step = sizing.stepValueBb;
  input.value = sizing.initialValueBb;
  input.setAttribute('aria-label', t('{action} amount-to in big blinds', { action: actionLabel }));
  input.setAttribute('aria-describedby', `${boundsId} ${validationId}`);
  const unit = document.createElement('span');
  unit.textContent = 'bb';
  amountControl.append(input, unit);
  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = `ui-button ui-button--primary training-full-hand-sizing-submit training-action-button--${actionType}`;
  submit.textContent = t('Apply amount-to');
  entry.append(label, amountControl, submit);

  const bounds = document.createElement('p');
  bounds.id = boundsId;
  bounds.className = 'training-full-hand-sizing-bounds';
  bounds.textContent = t('Min {min} · Max {max} · Step {step}', {
    min: fullHandBbLabel(sizing.minToMilliBb),
    max: fullHandBbLabel(sizing.maxToMilliBb),
    step: fullHandBbLabel(model.chipUnitMilliBb),
  });
  const validationStatus = document.createElement('p');
  validationStatus.id = validationId;
  validationStatus.className = 'training-full-hand-sizing-validation';
  validationStatus.setAttribute('role', 'status');
  validationStatus.setAttribute('aria-live', 'polite');

  let currentValidation = null;
  const refreshValidation = () => {
    currentValidation = callTrainingServiceBridge(
      'validateFullHandSizingInput',
      actionType,
      input.value,
    );
    const valid = currentValidation?.valid === true;
    input.setAttribute('aria-invalid', String(!valid));
    submit.disabled = !valid || app.training.lifecycle !== 'ready';
    validationStatus.dataset.valid = String(valid);
    validationStatus.textContent = fullHandSizingValidationCopy(
      currentValidation,
      actionLabel,
      sizing,
    );
    return currentValidation;
  };
  input.addEventListener('input', refreshValidation);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.repeat) return;
    if (!refreshValidation()?.valid) return;
    event.preventDefault();
    submit.click();
  });
  submit.addEventListener('click', () => {
    const validation = refreshValidation();
    if (validation?.valid) {
      handleFullHandTrainingGuess(actionType, validation.amountToMilliBb);
    }
  });

  const presets = document.createElement('div');
  presets.className = 'training-full-hand-presets';
  presets.setAttribute('aria-label', t('Quick sizing shortcuts'));
  sizing.presets.filter((preset) => preset.kind !== 'all_in').forEach((preset) => {
    const presetButton = document.createElement('button');
    presetButton.type = 'button';
    presetButton.className = 'training-full-hand-preset';
    presetButton.dataset.presetId = preset.presetId;
    presetButton.dataset.action = preset.actionType;
    presetButton.dataset.amountToMilliBb = String(preset.amountToMilliBb);
    const presetLabel = t(preset.label);
    presetButton.textContent = /\bbb\s*$/i.test(presetLabel)
      ? presetLabel
      : `${presetLabel} · ${fullHandBbLabel(preset.amountToMilliBb)}`;
    presetButton.addEventListener('click', () => {
      input.value = preset.valueBb;
      refreshValidation();
      input.focus({ preventScroll: true });
    });
    presets.appendChild(presetButton);
  });

  action.append(entry, bounds, validationStatus, presets);
  mount.appendChild(action);
  surface.hidden = false;
  refreshValidation();
  return model;
}

function chooseFullHandTrainingSizedAction(actionType) {
  if (!['bet', 'raise'].includes(actionType) || app.training.lifecycle !== 'ready') return null;
  app.training.fullHandSizedAction = actionType;
  $('#trainingGuessButtons')?.querySelectorAll('[data-action]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.action === actionType));
  });
  const model = renderFullHandTrainingSizingControls(actionType);
  $('#trainingFullHandSizingActions input')?.focus({ preventScroll: true });
  return model;
}

function clearFullHandDecisionFeedback() {
  const surface = $('#trainingFullHandDecisionFeedback');
  if (surface) surface.hidden = true;
  if ($('#trainingFullHandDecisionFeedbackTitle')) $('#trainingFullHandDecisionFeedbackTitle').textContent = '';
  if ($('#trainingFullHandDecisionFeedbackText')) $('#trainingFullHandDecisionFeedbackText').textContent = '';
  for (const selector of ['#trainingFullHandDecisionFacts', '#trainingFullHandDecisionAnalysis']) {
    const target = $(selector);
    target?.replaceChildren();
    if (selector.endsWith('Facts') && target) target.hidden = true;
  }
  $('#trainingFullHandDecisionFeedback details')?.removeAttribute('open');
}

function renderFullHandDecisionRecorded(result) {
  const decision = result?.decision;
  const surface = $('#trainingFullHandDecisionFeedback');
  if (!surface || !decision) return null;
  surface.hidden = false;
  if ($('#trainingFullHandDecisionFeedbackTitle')) {
    $('#trainingFullHandDecisionFeedbackTitle').textContent = t('Decision recorded');
  }
  if ($('#trainingFullHandDecisionFeedbackText')) {
    $('#trainingFullHandDecisionFeedbackText').textContent = t('Decision recorded. Continuing automatically.');
  }
  const facts = $('#trainingFullHandDecisionFacts');
  facts?.replaceChildren();
  if (facts) facts.hidden = true;
  $('#trainingFullHandDecisionAnalysis')?.replaceChildren();
  const explain = $('#trainingFullHandDecisionFeedback details');
  explain?.removeAttribute('open');
  if (explain) explain.hidden = true;
  return decision;
}

function updateTrainingButtons(exercise) {
  const container = $('#trainingGuessButtons');
  if (!container) return;
  container.innerHTML = '';
  const fullHand = trainingSessionMode() === 'full_hand';
  if (fullHand) clearFullHandTrainingSizingControls();
  const presentationByType = new Map((app.training.currentPresentation?.legalActions || []).map((entry) => [entry.type, entry]));
  canonicalTrainingLegalActionTypes(exercise).forEach((type) => {
    const index = container.childElementCount;
    const option = type === 'all_in' ? exercise.legalActions?.allIn : exercise.legalActions?.[type];
    const semanticLabel = trainingActionLabel(type, exercise.decisionContext);
    const actionPresentation = fullHand
      ? canonicalActionPresentation(type, option || {})
      : null;
    const label = actionPresentation?.label || t(semanticLabel) || semanticLabel;
    const sizing = presentationByType.get(type);
    const boundsLabel = sizing?.boundsLabel?.endsWith(' to')
      ? t('to {range}', { range: sizing.boundsLabel.slice(0, -3) })
      : sizing?.boundsLabel;
    const sizingLabel = fullHand
      ? ['bet', 'raise'].includes(type)
        ? t('Choose amount-to')
        : actionPresentation?.amount || fullHandTrainingActionDetail(type, exercise.legalActions)
      : boundsLabel || sizing?.amountLabel || '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `ui-button training-action-button training-action-button--${type}`;
    button.dataset.action = type;
    button.setAttribute('aria-pressed', 'false');
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
    button.addEventListener('click', () => {
      if (fullHand && ['bet', 'raise'].includes(type)) chooseFullHandTrainingSizedAction(type);
      else handleTrainingGuess(type);
    });
    container.appendChild(button);
  });
  container.dataset.actionCount = String(container.childElementCount);
  container.hidden = false;
  clearFullHandTrainingSizingControls({ clearSelection: !fullHand });
}

function renderTrainingSource(exercise) {
  const strategyResult = exercise?.strategyResult || null;
  const policy = strategyClaimPolicy(strategyResult);
  const sourceElement = $('#trainingStrategySource');
  if (!sourceElement) return;
  const label = strategySourceDisplayLabel(strategyResult || 'unavailable');
  const policyLimitation = policy.primaryLimitation?.priority >= 70
    ? localizedStrategyLimitation(policy)
    : '';
  const memoryComparison = exercise?.generationMetadata?.memoryRedrill?.comparison;
  const comparisonLabel = memoryComparison === 'historical'
    ? t('Historical comparison')
    : memoryComparison === 'current' ? t('Current comparison') : '';
  const limitation = [
    comparisonLabel,
    app.training.memoryRedrillNote,
    policyLimitation,
  ].filter(Boolean).join(' ');
  sourceElement.textContent = label;
  sourceElement.title = [
    t('Strategy source: {source}. Exercise seed {seed}.', { source: label, seed: exercise.seed }),
    strategyPolicySummary(policy),
    limitation
  ].filter(Boolean).join(' ');
  const tone = policy.source.family === 'heuristic' ? 'heuristic' : 'info';
  sourceElement.className = `badge status-badge status-badge--${tone}`;
  if ($('#trainingReferenceSummaryTitle')) {
    $('#trainingReferenceSummaryTitle').dataset.i18n = 'Reference source';
    $('#trainingReferenceSummaryTitle').textContent = t('Reference source');
  }
  const referenceValue = $('#trainingReferenceSummaryValue');
  const referenceNote = $('#trainingReferenceSummaryNote');
  if (referenceValue) {
    referenceValue.textContent = label;
    referenceValue.dataset.sourceFamily = policy.source.family;
  }
  if (referenceNote) {
    referenceNote.textContent = [strategyPolicySummary(policy), comparisonLabel].filter(Boolean).join(' · ');
  }
  const limitationElement = $('#trainingSourceLimitation');
  if (limitationElement) {
    limitationElement.textContent = limitation;
    limitationElement.hidden = !limitation;
  }
}

function renderTrainingGenerationError(error) {
  app.training.lifecycle = 'error';
  console.error('[Riverline Training generation]', error);
  app.training.currentPresentation = null;
  setTrainingWorkspaceState('error');
  if (trainingSessionMode() === 'full_hand') setFullHandTrainingPhase('setup');
  const errorCopy = {
    invalid_config: [t('Check the drill setup'), t('One or more filters are outside the supported TrainingConfig range.')],
    unsupported_rules: [t('Unsupported rules'), t('This Game Rules mode cannot generate Training exercises. Choose a supported rules mode and try again.')],
    no_eligible_candidates: [t('No eligible exercise'), t('The selected Varied Session preferences have no eligible Training candidate.')],
    impossible_focused_request: [t('No matching exercise found'), t('The Focused Drill constraints cannot be planned together. Adjust the drill and try again.')],
    unsupported_target: [t('Unsupported filter combination'), t('Choose a street and decision target that belong to the same decision family.')],
    generation_exhausted: [t('No matching exercise found'), t('The bounded generator could not reach this exact combination. Broaden a filter and try again.')],
    decision_projection_unavailable: [t('Decision context unavailable'), t('The generated hand could not be projected safely for the strategy path.')],
    strategy_unavailable: [t('Strategy reference unavailable'), t('The current strategy path did not return a gradeable StrategyResult.')],
    invalid_configuration: [t('Full Hand unavailable'), t('Check the table, stack, Hero position, and Game Rules setup.')],
    progression_failed: [t('Full Hand could not continue'), t('Canonical bot or chance progression stopped safely. Start a new Hand.')],
    strategy_evaluation_failed: [t('Decision could not be graded'), t('The Hero action was not continued without a valid StrategyProvider evaluation.')],
    service_unavailable: [t('Training service unavailable'), t('Reload Riverline and try again. The canonical Training bridge did not load.')],
    internal_error: [t('Training could not continue'), t('An internal generation error occurred. Try another seed or adjust the drill.')]
  };
  const [title, message] = errorCopy[error?.code] || [t('Exercise unavailable'), t('Try again or adjust the drill.')];
  if ($('#trainingErrorTitle')) $('#trainingErrorTitle').textContent = title;
  if ($('#trainingErrorText')) $('#trainingErrorText').textContent = message;
  if ($('#trainingInstruction')) $('#trainingInstruction').textContent = message;
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  clearFullHandTrainingSizingControls();
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
  if ($('#trainingSourceLimitation')) $('#trainingSourceLimitation').hidden = true;
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

function renderCanonicalTrainingExercise(exercise, {
  attemptKind = 'primary',
  replaySourceRecordPromise = null,
} = {}) {
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
  app.training.currentAttemptKind = attemptKind === 'replay' ? 'replay' : 'primary';
  app.training.replaySourceRecordPromise = app.training.currentAttemptKind === 'replay'
    ? replaySourceRecordPromise
    : null;
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
  const relevantFacts = $('#trainingRelevantFacts');
  if (relevantFacts) {
    relevantFacts.replaceChildren();
    relevantFacts.hidden = true;
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
  recordTrainingExerciseShown(exercise);
}

function prepareTrainingGeneration({ preserveSession = false } = {}) {
  if (!preserveSession) clearTrainingSessionCompletion();
  else if ($('#trainingSessionCompletion')) $('#trainingSessionCompletion').hidden = true;
  app.training.lifecycle = 'generating';
  setTrainingWorkspaceState('generating');
  setFullHandTrainingPhase('starting');
  setFullHandTrainingLoadingCopy('Generating exercise', 'Replaying a bounded legal hand trajectory.');
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

function setFullHandTrainingLoadingCopy(titleKey, messageKey) {
  if ($('#trainingGeneratingTitle')) {
    $('#trainingGeneratingTitle').dataset.i18n = titleKey;
    $('#trainingGeneratingTitle').textContent = t(titleKey);
  }
  if ($('#trainingGeneratingText')) {
    $('#trainingGeneratingText').dataset.i18n = messageKey;
    $('#trainingGeneratingText').textContent = t(messageKey);
  }
}

function fullHandTrainingHistory(snapshot, actionLimit = null) {
  const records = actionLimit === null
    ? snapshot?.state?.actionHistory || []
    : (snapshot?.state?.actionHistory || []).slice(0, actionLimit);
  const players = new Map((snapshot?.state?.players || []).map((player) => [player.playerId, player]));
  return records.map((record) => {
    const player = players.get(record.playerId);
    const type = record.submittedAction.type;
    const amountMilliBb = ['bet', 'raise', 'all_in'].includes(type)
      ? record.currentBetAfterMilliBb
      : type === 'call' ? record.committedMilliBb : null;
    return {
      sequence: record.sequence,
      street: record.street,
      actorLabel: record.playerId === snapshot.heroPlayerId
        ? 'Hero'
        : player?.position || t('Seat {number}', { number: (player?.seat ?? 0) + 1 }),
      position: player?.position || null,
      actionType: type,
      actionLabel: trainingActionLabel(type, {
        street: record.street,
        lastAction: null,
      }),
      amountBb: amountMilliBb === null ? null : amountMilliBb / 1000,
      amountLabel: amountMilliBb === null ? '' : fullHandBbLabel(amountMilliBb),
      isHero: record.playerId === snapshot.heroPlayerId,
    };
  });
}

function fullHandActorLabel(snapshot, playerId) {
  const player = snapshot?.state?.players?.find((candidate) => candidate.playerId === playerId);
  if (playerId === snapshot?.heroPlayerId) return t('Hero');
  return player?.position || t('Seat {number}', { number: (player?.seat ?? 0) + 1 });
}

function fullHandActionAnnouncement(snapshot) {
  const entry = fullHandTrainingHistory(snapshot).at(-1);
  if (!entry) return t('Hand continues.');
  const player = t(entry.actorLabel);
  const amount = entry.amountLabel;
  const messages = {
    fold: () => t('{player} folds', { player }),
    check: () => t('{player} checks', { player }),
    call: () => t('{player} calls {amount}', { player, amount }),
    bet: () => t('{player} bets to {amount}', { player, amount }),
    raise: () => t('{player} raises to {amount}', { player, amount }),
    all_in: () => t('{player} moves all-in to {amount}', { player, amount }),
  };
  return (messages[entry.actionType] || (() => `${player} ${t(entry.actionLabel)}`))();
}

function fullHandPresentationStatus(cue, snapshot) {
  const actorLabel = cue?.actor?.playerId
    ? fullHandActorLabel(snapshot, cue.actor.playerId)
    : null;
  const pendingCopy = {
    deal_hole: 'Dealing private cards…',
    deal_flop: 'Dealing the flop…',
    deal_turn: 'Dealing the turn…',
    deal_river: 'Dealing the river…',
  };
  const messages = {
    bot_thinking: () => t('{player} is thinking…', { player: actorLabel }),
    dealing_private_cards: () => t('Dealing private cards…'),
    dealing_street: () => t(pendingCopy[cue.pendingChanceType] || 'Dealing the next street…'),
    resolving_showdown: () => t('Resolving showdown…'),
    bot_action: () => fullHandActionAnnouncement(snapshot),
    hero_action: () => fullHandActionAnnouncement(snapshot),
    private_cards_dealt: () => t('Private cards dealt'),
    flop_dealt: () => t('Flop dealt'),
    turn_dealt: () => t('Turn dealt'),
    river_dealt: () => t('River dealt'),
    showdown_cards_revealed: () => t('{player} reveals', { player: actorLabel }),
    showdown_resolved: () => t('Showdown resolved'),
    hero_boundary: () => t('Your turn'),
    terminal_boundary: () => t('Hand complete'),
    hero_turn: () => t('Your turn · Hero ({position}) to act', {
      position: snapshot?.currentDecision?.currentActor?.position || t('position unavailable'),
    }),
    hand_complete: () => t('Hand complete'),
    error: () => t('Hand progression stopped'),
    waiting: () => t('Hand continues…'),
  };
  return (messages[cue?.kind] || messages.waiting)();
}

function setFullHandTrainingInputLocked(locked) {
  const workspace = $('#trainingWorkspace');
  if (workspace) workspace.dataset.fullHandInputState = locked ? 'automating' : 'hero';
  const actions = $('#trainingGuessButtons');
  if (actions) {
    actions.classList.toggle('is-hero-turn', !locked);
    actions.setAttribute('aria-disabled', String(locked));
    if (locked) actions.hidden = true;
  }
  actions?.querySelectorAll('button').forEach((button) => {
    button.disabled = locked;
  });
  const sizing = $('#trainingFullHandSizing');
  if (sizing) {
    sizing.setAttribute('aria-disabled', String(locked));
    if (locked) sizing.hidden = true;
  }
  sizing?.querySelectorAll('button, input').forEach((control) => {
    control.disabled = locked;
  });
  $('#trainingDecisionPrompt')?.classList.toggle('is-hero-turn', !locked);
}

function renderFullHandPresentationStatus(cue, snapshot) {
  const message = fullHandPresentationStatus(cue, snapshot);
  const actionStatus = $('#trainingFullHandActionStatus');
  if (actionStatus) {
    actionStatus.hidden = false;
    actionStatus.dataset.presentationState = cue?.kind || 'waiting';
    actionStatus.textContent = message;
  }
  if ($('#trainingCurrentActor')) $('#trainingCurrentActor').textContent = message;
  if ($('#trainingInstruction')) $('#trainingInstruction').textContent = message;
  if ($('#trainingFullHandCompactStatus')) {
    $('#trainingFullHandCompactStatus').textContent = cue?.kind === 'hero_turn'
      ? t('Your turn')
      : cue?.kind === 'hand_complete' ? t('Hand Complete') : message;
  }

  const prompt = $('#trainingDecisionPrompt');
  const promptEyebrow = prompt?.querySelector('span');
  const promptTitle = prompt?.querySelector('strong');
  const promptDetail = prompt?.querySelector('small');
  const heroTurn = cue?.kind === 'hero_turn';
  if (promptEyebrow) promptEyebrow.textContent = heroTurn ? t('Your turn') : t('Hand in progress');
  if (promptTitle) promptTitle.textContent = heroTurn ? t('Hero to act') : message;
  if (promptDetail) {
    promptDetail.textContent = heroTurn
      ? t('Choose one legal action.')
      : t('Actions unlock when it is Hero\'s turn.');
  }
}

function renderFullHandAutomationSnapshot(snapshot, {
  cue,
  previousSnapshot = null,
  event = null,
  motionEnabled = true,
} = {}) {
  app.training.fullHandSnapshot = snapshot;
  app.training.lifecycle = 'automating';
  renderFullHandTrainingHistory(snapshot);
  renderFullHandTrainingStacks(snapshot);
  renderFullHandTrainingMetadata(snapshot, null);
  renderFullHandTrainingTags(snapshot, null);
  dispatchFullHandTrainingTable(snapshot, { previousSnapshot, event, motionEnabled });
  setFullHandTrainingPhase('live');
  setTrainingWorkspaceState('automating');
  setFullHandTrainingInputLocked(true);
  if ($('#trainingFeedback')) $('#trainingFeedback').hidden = true;
  if ($('#trainingSolution')) $('#trainingSolution').hidden = true;
  if ($('#trainingFullHandCompletion')) $('#trainingFullHandCompletion').hidden = true;
  renderFullHandPresentationStatus(cue, snapshot);
}

function ensureFullHandPresentationOrchestrator() {
  if (fullHandPresentationOrchestrator) return fullHandPresentationOrchestrator;
  fullHandPresentationOrchestrator = callTrainingServiceBridge(
    'createFullHandPresentationOrchestrator',
    {
      getSnapshot: () => callTrainingServiceBridge('getFullHandSnapshot'),
      advanceOne: () => callTrainingServiceBridge('advanceFullHandOneEvent'),
      renderCue: ({ cue, snapshot }) => renderFullHandAutomationSnapshot(snapshot, { cue }),
      renderTransition: ({ cue, snapshot, previousSnapshot, event, motionEnabled }) => (
        renderFullHandAutomationSnapshot(snapshot, {
          cue,
          previousSnapshot,
          event,
          motionEnabled,
        })
      ),
      renderBoundary: ({ cue, snapshot }) => {
        renderFullHandTrainingSnapshot(snapshot);
        if (snapshot.status === 'awaiting_hero') renderFullHandPresentationStatus(cue, snapshot);
      },
      setInputLocked: (locked) => setFullHandTrainingInputLocked(locked),
      prefersReducedMotion: () => window.matchMedia?.('(prefers-reduced-motion: reduce)')
        .matches === true,
    },
  );
  return fullHandPresentationOrchestrator;
}

async function runFullHandPresentation(options = {}) {
  const orchestrator = ensureFullHandPresentationOrchestrator();
  if (!orchestrator) {
    renderTrainingGenerationError({
      code: 'service_unavailable',
      message: 'Full-Hand presentation orchestration is unavailable.',
    });
    return null;
  }
  try {
    return await orchestrator.run(options);
  } catch (error) {
    if (trainingSessionMode() === 'full_hand') {
      renderTrainingGenerationError({
        code: 'presentation_failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

function fullHandHeroActionPresentationEvent(previousSnapshot, answered) {
  const chosenAction = answered?.decision?.chosenAction;
  return Object.freeze({
    schemaVersion: 'automated-hand-visible-event/v1',
    kind: 'hero_action',
    transitionKind: 'action',
    pendingChanceType: null,
    actor: previousSnapshot?.currentDecision?.currentActor ?? null,
    chosenAction,
    streetBefore: previousSnapshot?.state?.street ?? null,
    streetAfter: answered?.snapshot?.state?.street ?? null,
    boardCardIds: [],
  });
}

function renderFullHandTrainingHistory(snapshot) {
  const history = $('#trainingActionHistory');
  if (!history) return;
  const entries = fullHandTrainingHistory(snapshot);
  history.replaceChildren();
  if (entries.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'is-empty';
    empty.textContent = t('No voluntary action precedes this decision.');
    history.appendChild(empty);
  } else {
    entries.forEach((entry, index) => {
      const item = document.createElement('li');
      item.dataset.street = entry.street;
      item.classList.toggle('is-hero', entry.isHero);
      item.classList.toggle('is-street-start', index === 0 || entries[index - 1].street !== entry.street);
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
  if ($('#trainingCurrentActor')) {
    $('#trainingCurrentActor').textContent = snapshot.status === 'terminal'
      ? t('Hand Complete')
      : snapshot.status === 'grading'
        ? t('Decision recorded. Continuing automatically.')
        : snapshot.status === 'awaiting_hero'
          ? t('Your turn · Hero ({position}) to act', {
            position: snapshot.currentDecision?.currentActor?.position || t('position unavailable'),
          })
          : snapshot.state?.actingPlayerId
            ? t('{player} is next to act.', {
              player: fullHandActorLabel(snapshot, snapshot.state.actingPlayerId),
            })
            : t('Hand continues…');
  }
}

function renderFullHandTrainingStacks(snapshot) {
  const target = $('#trainingFullHandStacks');
  if (!target) return;
  target.replaceChildren();
  (snapshot?.state?.players || []).forEach((player) => {
    const item = document.createElement('span');
    const label = document.createElement('span');
    label.textContent = player.playerId === snapshot.heroPlayerId
      ? t('Hero')
      : player.position || t('Seat {number}', { number: player.seat + 1 });
    const amount = document.createElement('strong');
    amount.textContent = `${(player.currentStackMilliBb / 1000).toFixed(1)} bb`;
    item.append(label, amount);
    target.appendChild(item);
  });
  target.hidden = false;
}

function updateFullHandTrainingStats(snapshot) {
  const decisions = snapshot?.review?.decisions || [];
  const accepted = decisions.filter((decision) => decision.grade !== 'mistake' && decision.grade !== null);
  let currentStreak = 0;
  let bestStreak = 0;
  for (const decision of decisions) {
    currentStreak = decision.grade && decision.grade !== 'mistake' ? currentStreak + 1 : 0;
    bestStreak = Math.max(bestStreak, currentStreak);
  }
  app.training.stats = {
    totalHands: snapshot?.summary?.decisionsAnswered || 0,
    correct: accepted.length,
    streak: currentStreak,
  };
  app.training.gradeStats = { ...(snapshot?.gradeCounts || { optimal: 0, acceptable: 0, mistake: 0 }) };
  app.training.bestStreak = bestStreak;
  updateTrainingStats();
}

function fullHandTrainingExercise(snapshot) {
  const decision = snapshot.currentDecision;
  if (!decision) return null;
  const strategyResult = decision.evaluation?.strategyResult || null;
  return {
    id: decision.decisionId,
    seed: snapshot.handSeed,
    decisionContext: decision.decisionContext,
    legalActions: decision.legalActions,
    strategyResult,
    presentation: {
      heroCards: [...decision.heroCards],
      board: [...decision.board],
      actionHistory: fullHandTrainingHistory(
        snapshot,
        decision.occurrence.replayPoint.actionSequence,
      ),
    },
  };
}

function renderFullHandTrainingMetadata(snapshot, decision) {
  if ($('#trainingCurrentSeed')) $('#trainingCurrentSeed').textContent = String(snapshot.handSeed);
  if ($('#trainingExerciseId')) $('#trainingExerciseId').textContent = decision?.decisionId || snapshot.state?.handId || '—';
  if ($('#trainingGenerationAttempts')) $('#trainingGenerationAttempts').textContent = '1';
  if ($('#trainingTrajectoryLength')) $('#trainingTrajectoryLength').textContent = String(snapshot.state?.actionHistory?.length || 0);
  if ($('#trainingGenerationPolicy')) {
    const assignment = snapshot.opponentAssignments?.[0];
    $('#trainingGenerationPolicy').textContent = assignment
      ? `${assignment.policyId}@${assignment.policyVersion}`
      : '—';
  }
  if ($('#trainingCopySeed')) $('#trainingCopySeed').disabled = false;
  if ($('#trainingReplayBtn')) $('#trainingReplayBtn').disabled = false;
  if ($('#trainingReplayDecisionBtn')) $('#trainingReplayDecisionBtn').hidden = true;
}

function renderFullHandTrainingTags(snapshot, decision) {
  const tags = $('#trainingExerciseTags');
  if (!tags) return;
  tags.replaceChildren();
  [
    t('Full Hand'),
    decision ? t(decision.street.charAt(0).toUpperCase() + decision.street.slice(1)) : t('Hand Complete'),
    t('analysis.value.tableSize', { count: snapshot.state?.players?.length || 0 }),
  ].forEach((label) => {
    const tag = document.createElement('span');
    tag.className = 'badge training-curriculum-tag';
    tag.textContent = label;
    tags.appendChild(tag);
  });
}

function prepareFullHandTrainingDecision(snapshot, exercise) {
  app.training.fullHandSnapshot = snapshot;
  app.training.currentExercise = exercise;
  app.training.currentStrategyResult = exercise.strategyResult;
  app.training.currentEvaluation = exercise.strategyResult
    ? snapshot.currentDecision.evaluation.answerEvaluation
    : null;
  app.training.currentPresentation = exercise.presentation;
  app.training.currentHand = [...exercise.presentation.heroCards];
  app.training.hero = [...exercise.presentation.heroCards];
  app.training.board = [...exercise.presentation.board];
  app.training.currentContext = trainingContextPresentationAdapter(exercise.decisionContext);
  app.training.currentSolution = exercise.strategyResult
    ? trainingStrategyResultToPresentation(exercise.strategyResult)
    : null;
  renderTrainingCards();
  renderTrainingDecisionContextSummary(exercise);
  renderFullHandTrainingHistory(snapshot);
  renderFullHandTrainingStacks(snapshot);
  renderFullHandTrainingMetadata(snapshot, snapshot.currentDecision);
  renderFullHandTrainingTags(snapshot, snapshot.currentDecision);
  updateAssistanceDisplay();
  dispatchFullHandTrainingTable(snapshot);
  setFullHandTrainingPhase('live');
  if ($('#trainingDecisionNumber')) {
    $('#trainingDecisionNumber').hidden = false;
    $('#trainingDecisionNumber').textContent = t('Decision {number}', {
      number: snapshot.currentDecision.decisionOrdinal + 1,
    });
  }
}

function renderFullHandAwaitingHero(snapshot) {
  const exercise = fullHandTrainingExercise(snapshot);
  if (!exercise) return renderTrainingGenerationError({ code: 'internal_error' });
  prepareFullHandTrainingDecision(snapshot, exercise);
  app.training.lifecycle = 'ready';
  setTrainingWorkspaceState('ready');
  if ($('#trainingInstruction')) {
    $('#trainingInstruction').textContent = t('Hero to act. Choose one legal action; the same Hand continues automatically.');
  }
  if ($('#trainingStrategySource')) {
    $('#trainingStrategySource').textContent = t('Hidden until review');
    $('#trainingStrategySource').className = 'badge status-badge status-badge--info';
  }
  if ($('#trainingReferenceSummaryTitle')) {
    $('#trainingReferenceSummaryTitle').dataset.i18n = 'Reference source';
    $('#trainingReferenceSummaryTitle').textContent = t('Reference source');
  }
  if ($('#trainingReferenceSummaryValue')) {
    $('#trainingReferenceSummaryValue').textContent = t('Hidden until review');
  }
  if ($('#trainingReferenceSummaryNote')) {
    $('#trainingReferenceSummaryNote').textContent = t('Comparison and source details are available after the Hand in Review.');
  }
  if ($('#trainingSourceLimitation')) $('#trainingSourceLimitation').hidden = true;
  if ($('#trainingSolution')) $('#trainingSolution').hidden = true;
  if ($('#trainingFeedback')) $('#trainingFeedback').hidden = true;
  if ($('#trainingFullHandCompletion')) $('#trainingFullHandCompletion').hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) nextBtn.hidden = true;
  updateTrainingButtons(exercise);
  setFullHandTrainingInputLocked(false);
  renderFullHandPresentationStatus({
    kind: 'hero_turn',
    actor: {
      playerId: snapshot.heroPlayerId,
      position: snapshot.currentDecision.currentActor.position,
      isHero: true,
    },
  }, snapshot);
  recordFullHandTrainingDecisionShown(snapshot);
}

function renderFullHandGrading(snapshot) {
  app.training.fullHandSnapshot = snapshot;
  app.training.lifecycle = 'grading';
  app.training.currentEvaluation = null;
  app.training.currentStrategyResult = null;
  app.training.currentSolution = null;
  renderFullHandTrainingHistory(snapshot);
  renderFullHandTrainingMetadata(snapshot, snapshot.currentDecision);
  renderFullHandTrainingTags(snapshot, snapshot.currentDecision);
  dispatchFullHandTrainingTable(snapshot);
  setFullHandTrainingPhase('live');
  setTrainingWorkspaceState('grading');
  setFullHandTrainingInputLocked(true);
  if ($('#trainingFeedback')) $('#trainingFeedback').hidden = true;
  if ($('#trainingSolution')) $('#trainingSolution').hidden = true;
  renderFullHandPresentationStatus({
    kind: 'hero_action',
    actor: snapshot.currentDecision?.currentActor ?? null,
  }, snapshot);
}

function fullHandTerminalResultCopy(snapshot) {
  const result = snapshot.completedHandResult;
  const heroDelta = result?.stackDeltasMilliBbByPlayer?.[snapshot.heroPlayerId] ?? 0;
  const signed = `${heroDelta >= 0 ? '+' : ''}${(heroDelta / 1000).toFixed(1)} bb`;
  return result?.terminalReason === 'showdown'
    ? t('Showdown complete. Hero result: {result}.', { result: signed })
    : t('Hand ended by fold. Hero result: {result}.', { result: signed });
}

function renderFullHandTerminal(snapshot) {
  app.training.fullHandSnapshot = snapshot;
  app.training.lifecycle = 'terminal';
  app.training.currentEvaluation = null;
  const hero = snapshot.state?.players?.find((player) => player.playerId === snapshot.heroPlayerId);
  app.training.hero = Array.isArray(hero?.holeCards) ? [...hero.holeCards] : [];
  app.training.board = [...(snapshot.state?.board || [])];
  renderTrainingCards();
  renderFullHandTrainingHistory(snapshot);
  renderFullHandTrainingMetadata(snapshot, null);
  renderFullHandTrainingTags(snapshot, null);
  updateFullHandTrainingStats(snapshot);
  setTrainingWorkspaceState('terminal');
  setFullHandTrainingPhase('complete');
  dispatchFullHandTrainingTable(snapshot);
  if ($('#trainingInstruction')) $('#trainingInstruction').textContent = t('The canonical Hand is complete and ready for review.');
  if ($('#trainingFullHandResult')) $('#trainingFullHandResult').textContent = fullHandTerminalResultCopy(snapshot);
  if ($('#trainingFullHandDecisionCount')) {
    $('#trainingFullHandDecisionCount').textContent = String(snapshot.summary.decisionsAnswered);
  }
  if ($('#trainingFullHandGradeSummary')) {
    const decisions = snapshot.review?.decisions || [];
    const normative = decisions.length > 0 && decisions.every((decision) => (
      strategyClaimPolicy(decision.strategyResult).trainingSemantics === 'normative'
    ));
    $('#trainingFullHandGradeSummary').textContent = normative
      ? t('{correct} correct · {acceptable} acceptable · {mistakes} mistakes', {
          correct: snapshot.gradeCounts.optimal,
          acceptable: snapshot.gradeCounts.acceptable,
          mistakes: snapshot.gradeCounts.mistake,
        })
      : t('{matches} matches · {close} close · {differences} differences', {
          matches: snapshot.gradeCounts.optimal,
          close: snapshot.gradeCounts.acceptable,
          differences: snapshot.gradeCounts.mistake,
        });
  }
  if ($('#trainingDecisionNumber')) $('#trainingDecisionNumber').hidden = true;
  if ($('#trainingNextHandBtn')) $('#trainingNextHandBtn').hidden = true;
  if ($('#trainingSolution')) $('#trainingSolution').hidden = true;
  if ($('#trainingReviewHand')) $('#trainingReviewHand').setAttribute('aria-expanded', 'false');
  app.training.fullHandReviewIndex = 0;
  void finishTrainingMemorySession('completed', {
    fullHandSource: {
      handId: snapshot.state.handId,
      heroPlayerId: snapshot.heroPlayerId,
      replaySource: snapshot.replaySource,
    },
  });
}

function renderFullHandTrainingSnapshot(snapshot) {
  if (!snapshot) return null;
  app.training.fullHandSnapshot = snapshot;
  if (snapshot.status === 'awaiting_hero') return renderFullHandAwaitingHero(snapshot);
  if (snapshot.status === 'grading') return renderFullHandGrading(snapshot);
  if (snapshot.status === 'terminal') return renderFullHandTerminal(snapshot);
  if (snapshot.status === 'error') return renderTrainingGenerationError(snapshot.error);
  return null;
}

async function startFullHandTraining(options = {}) {
  emitStudyExperience('session_started', {
    source: 'training_full_hand',
    payload: { audioSemantics: 'silent_user_gesture_prepare' },
  });
  const seed = variedSessionSeed(options);
  clearFullHandDecisionFeedback();
  clearFullHandTrainingSizingControls();
  invalidateFullHandPresentation();
  callTrainingServiceBridge('resetFullHand');
  fullHandPresentationMotionToken = 0;
  clearTrainingSessionCompletion();
  resetTrainingStats();
  app.training.lifecycle = 'generating';
  setTrainingWorkspaceState('generating');
  setFullHandTrainingLoadingCopy(
    'Starting Full Hand',
    'Dealing cards and advancing automatic opponents to Hero.',
  );
  clearTrainingExercisePresentation();
  try {
    const trainingConfig = readTrainingConfig(seed);
    startTrainingMemorySession({
      mode: 'full_hand',
      requestedLength: null,
      sessionSeed: seed,
      plannerIntent: null,
      focus: {
        tableSize: trainingConfig.tableSize,
        heroPosition: $('#trainingHeroPos')?.value || null,
        stackBb: trainingConfig.stackBb,
        rulesSnapshotVersion: trainingConfig.rulesSnapshot?.schemaVersion ?? null,
      },
    });
    const startConfiguration = callTrainingServiceBridge('createFullHandStartConfiguration', {
      trainingConfig,
      handSeed: seed,
      heroPosition: $('#trainingHeroPos')?.value || null,
    });
    const result = callTrainingServiceBridge(
      'startFullHand',
      startConfiguration,
      { strategyProvider, progressionMode: 'stepwise' },
    );
    if (!result?.ok) {
      void finishTrainingMemorySession('abandoned');
      renderTrainingGenerationError(result?.error || { code: 'service_unavailable' });
      return result;
    }
    if (result.snapshot.status === 'advancing') await runFullHandPresentation();
    else renderFullHandTrainingSnapshot(result.snapshot);
    return result;
  } catch (error) {
    void finishTrainingMemorySession('abandoned');
    renderTrainingGenerationError({
      code: 'invalid_config',
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function handleFullHandTrainingGuess(userAction, amountToMilliBb = null) {
  const snapshot = app.training.fullHandSnapshot;
  const decision = snapshot?.currentDecision;
  if (app.training.lifecycle !== 'ready' || !decision) return null;
  const concreteAmountToMilliBb = ['bet', 'raise'].includes(userAction)
    ? amountToMilliBb
    : null;
  clearFullHandTrainingSizingControls();
  app.training.lifecycle = 'grading';
  const request = callTrainingServiceBridge('answerFullHand', decision.decisionId, {
    type: userAction,
    amountToMilliBb: concreteAmountToMilliBb,
  });
  if (!request || typeof request.then !== 'function') {
    return renderTrainingGenerationError({ code: 'service_unavailable' });
  }
  const appliedSnapshot = callTrainingServiceBridge('getFullHandSnapshot');
  if (appliedSnapshot?.status === 'grading') renderFullHandGrading(appliedSnapshot);
  const result = await request;
  if (trainingSessionMode() !== 'full_hand'
    || app.training.fullHandSnapshot?.state?.handId !== snapshot.state?.handId
    || app.training.lifecycle === 'idle') return result;
  if (!result?.ok) {
    if (result?.error?.code !== 'stale_evaluation') renderTrainingGenerationError(result?.error);
    return result;
  }
  renderFullHandDecisionRecorded(result);
  await recordFullHandTrainingDecisionAnswered(result);
  if (result.snapshot.status === 'advancing') {
    await runFullHandPresentation({
      initialTransition: {
        previousSnapshot: snapshot,
        event: fullHandHeroActionPresentationEvent(snapshot, result),
      },
    });
  } else {
    dispatchFullHandTrainingTable(result.snapshot, {
      previousSnapshot: snapshot,
      event: fullHandHeroActionPresentationEvent(snapshot, result),
    });
    renderFullHandTrainingSnapshot(result.snapshot);
  }
  return result;
}

function toggleFullHandTrainingReview() {
  if (trainingSessionMode() !== 'full_hand') return;
  const review = callTrainingServiceBridge('getFullHandReview');
  if (!review || review.status !== 'ready') return;
  app.handReview.source = 'training_full_hand';
  app.handReview.selectedDecisionIndex = null;
  const model = refreshActiveHandReviewModel();
  if (!model?.selectedDecision) return null;
  selectActiveHandReviewDecision(model.selectedDecisionIndex);
  setFullHandTrainingPhase('review');
  if ($('#trainingExerciseSurface')) $('#trainingExerciseSurface').hidden = false;
  dispatchFullHandTrainingTable(app.training.fullHandSnapshot, { review: true });
  const rendered = renderActiveHandReview();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  $('#trainingRecommendation')?.scrollIntoView?.({
    behavior: reducedMotion ? 'auto' : 'smooth',
    block: 'start'
  });
  return rendered;
}

async function openFullHandDecisionInAnalysis() {
  const selectedIndex = app.handReview.source === 'training_full_hand'
    ? app.handReview.model?.selectedDecisionIndex
    : app.training.fullHandReviewIndex;
  const handoff = callTrainingServiceBridge(
    'createFullHandAnalysisHandoff',
    selectedIndex,
  );
  if (!handoff?.scenarioInput || !handoff?.decisionContext) return null;
  callPlaybookStateBridge('setMode', PLAYBOOK_MODES.SCENARIO, handoff.scenarioInput);
  app.playbookMode = PLAYBOOK_MODES.SCENARIO;
  setPlaybookControlAuthority(PLAYBOOK_MODES.SCENARIO);
  const viewerContext = {
    derivation: handoff.derivation,
    scenarioInput: handoff.scenarioInput,
    decisionContext: handoff.decisionContext,
    object: { annotations: { title: t('Full Hand · Hero Decision {number}', {
      number: handoff.decisionOrdinal + 1,
    }) } },
  };
  restoreSavedSpotPresentation(viewerContext);
  activeSavedSpotContext = viewerContext;
  renderSavedSpotViewer(viewerContext);
  restoreSharedPokerTable();
  navigateToWorkspace('gto', 'analyze');
  await updateContext('Full-Hand review decision opened', {
    schemaVersion: 'playbook-decision-resolution/v1',
    mode: PLAYBOOK_MODES.SCENARIO,
    status: 'available',
    reason: 'full_hand_review_decision',
    error: null,
    decisionContext: handoff.decisionContext,
  });
  const teacher = $('#teacherContent');
  if (teacher && teacher.style.display !== 'block') $('#toggleTeacher')?.click();
  teacher?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  return handoff;
}

function abortFullHandTraining() {
  const workspace = $('#trainingWorkspace');
  if (trainingSessionMode() !== 'full_hand'
    || workspace?.dataset.trainingFullHandPhase !== 'live'
    || !app.training.fullHandSnapshot) return false;
  if (!window.confirm(t(
    'Abort this Full Hand? The Training hand will end before completion. Recorded decisions will remain in Training Memory.',
  ))) return false;
  clearTrainingSessionState();
  if ($('#trainingFilterMessage')) {
    $('#trainingFilterMessage').textContent = t(
      'Full Hand aborted. Recorded decisions remain in Training Memory.',
    );
  }
  return true;
}

function replayCurrentTrainingSeed() {
  if (trainingSessionMode() === 'full_hand') {
    const seed = app.training.fullHandSnapshot?.handSeed;
    return Number.isInteger(seed) ? startConfiguredTrainingSession({ seed }) : null;
  }
  return app.training.currentExercise
    ? replayTrainingExercise(app.training.currentExercise.seed)
    : null;
}

function replayCurrentTrainingDecision() {
  if (trainingSessionMode() === 'full_hand') return null;
  const exercise = app.training.currentExercise;
  if (!exercise) return null;
  const sourceRecordPromise = app.training.currentAttemptKind === 'replay'
    ? app.training.replaySourceRecordPromise
    : app.training.memoryCurrentRecordPromise;
  app.training.memoryPendingOriginPromise = Promise.resolve(sourceRecordPromise)
    .then((record) => record?.id ? {
      parentDecisionRecordId: record.id,
      redrillKind: 'same_spot',
    } : null);
  const result = callTrainingServiceBridge('replayExercise', exercise);
  if (!result?.ok) {
    app.training.memoryPendingOriginPromise = null;
    renderTrainingGenerationError(result?.error || { code: 'service_unavailable' });
    return result;
  }
  renderCanonicalTrainingExercise(result.exercise, {
    attemptKind: 'replay',
    replaySourceRecordPromise: sourceRecordPromise,
  });
  return result;
}

function trainingSessionIsActive() {
  const state = document.querySelector('.training-workspace')?.dataset.trainingState;
  if (app.training.practiceSession?.completed) return false;
  return Boolean(app.training.memorySessionPromise)
    || ['generating', 'automating', 'ready', 'grading', 'feedback'].includes(state);
}

function startConfiguredTrainingSessionWithGuard(options = {}) {
  if (trainingSessionIsActive() && !window.confirm(t(
    'Start a new Training session? The active session will be marked incomplete, and its recorded decisions will remain in Training Memory.',
  ))) return null;
  return startConfiguredTrainingSession(options);
}

async function startConfiguredTrainingSession(options = {}) {
  const seed = variedSessionSeed(options);
  if ($('#trainingFilterMessage')) $('#trainingFilterMessage').textContent = '';
  setTrainingSetupExpanded(false);
  if (trainingSessionMode() === 'full_hand') return startFullHandTraining({ seed });
  if (trainingSessionMode() === 'focused') {
    startTrainingMemorySession({
      mode: 'focused',
      requestedLength: null,
      sessionSeed: seed,
      plannerIntent: null,
      focus: {
        street: $('#trainingStreet')?.value || 'any',
        targetDecisionType: $('#trainingDecisionTarget')?.value || 'any',
        heroPosition: $('#trainingHeroPos')?.value || null,
        tableSize: numericValue('#trainingPlayers', 6),
        stackBb: numericValue('#trainingStack', 30),
      },
    });
    clearTrainingSessionCompletion();
    return newRandomTrainingHand({ seed });
  }
  try {
    const session = createVariedTrainingIntent(seed);
    startTrainingMemorySession({
      mode: 'varied',
      requestedLength: session.length,
      sessionSeed: seed,
      plannerIntent: session.intent,
      focus: session.intent.focusPreferences,
    });
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
  document.querySelector('.training-workspace')?.setAttribute('data-training-session-complete', 'true');
  setTrainingWorkspaceState('complete');
  updateTrainingSessionProgress();
  if ($('#trainingSessionCompletion')) $('#trainingSessionCompletion').hidden = false;
  if ($('#trainingSessionCompletionText')) {
    $('#trainingSessionCompletionText').textContent = t('{aligned} reference-aligned from {attempts} attempts.', {
      aligned: app.training.stats.correct,
      attempts: app.training.stats.totalHands,
    });
  }
  if ($('#trainingNextHandBtn')) $('#trainingNextHandBtn').hidden = true;
  void finishTrainingMemorySession('completed');
  return true;
}

function requestNextTrainingExercise() {
  if (trainingSessionMode() === 'full_hand') {
    return startConfiguredTrainingSession();
  }
  if (trainingSessionMode() === 'varied') {
    if (app.training.practiceSession?.completed) return null;
    if (completeVariedTrainingSession()) return null;
    if (app.training.practiceSession?.mode === 'varied') return generatePlannedTrainingExercise();
    return startConfiguredTrainingSession();
  }
  return app.training.memorySessionPromise
    ? newRandomTrainingHand()
    : startConfiguredTrainingSession();
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
  const policy = strategyClaimPolicy(strategyResult);
  const source = strategySourceDisplayLabel(strategyResult);
  const chosen = t(evaluation.mappedStrategyAction?.label
    || trainingActionLabel(evaluation.chosenAction.type, app.training.currentExercise.decisionContext));
  const contextualLimitation = policy.primaryLimitation?.priority >= 70
    ? localizedStrategyLimitation(policy)
    : '';
  const withLimitation = (text) => [text, contextualLimitation].filter(Boolean).join(' ');

  if (policy.trainingSemantics === 'normative') {
    if (evaluation.grade === 'optimal') {
      return {
        title: t('Correct'),
        text: t('{action} matches the validated reference from {source}. Compare the displayed action frequencies for the full mix.', { action: chosen, source })
      };
    }
    if (evaluation.grade === 'acceptable') {
      return {
        title: t('Acceptable'),
        text: t('{action} is within the accepted mix of the validated reference from {source}.', { action: chosen, source })
      };
    }
    return {
      title: t('Mistake'),
      text: t('{action} falls outside the accepted mix of the validated reference from {source}.', { action: chosen, source })
    };
  }

  if (policy.trainingSemantics !== 'comparative') {
    return {
      title: t('Reference unavailable'),
      text: t('This source cannot support a Training comparison for the current context.')
    };
  }

  if (evaluation.grade === 'optimal') {
    return {
      title: t('Matches Riverline reference'),
      text: withLimitation(t('{action} matches the selected Riverline reference. Compare the displayed source frequencies for the full mix.', { action: chosen }))
    };
  }
  if (evaluation.grade === 'acceptable') {
    return {
      title: t('Close to Riverline reference'),
      text: withLimitation(t('{action} is close to the leading action in the selected Riverline reference. Compare the displayed source frequencies for the full mix.', { action: chosen }))
    };
  }
  return {
    title: t('Differs from Riverline reference'),
    text: withLimitation(t('{action} differs from the leading action in the selected Riverline reference. Compare the displayed source frequencies; this does not prove the play is objectively wrong, and no EV loss is implied.', { action: chosen }))
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
  if (typeof renderTrainingRelevantFacts === 'function') {
    renderTrainingRelevantFacts($('#trainingRelevantFacts'), explanation);
  }
  app.training.currentAnalysisExplanation = explanation;
  return explanation;
}

function renderTrainingEvaluationSummary(evaluation, exercise) {
  if (!evaluation || !exercise) return;
  const scoreBadge = $('#trainingScoreBadge');
  if (scoreBadge) {
    scoreBadge.hidden = false;
    scoreBadge.textContent = `${trainingGradePresentation(
      evaluation.grade,
      exercise.strategyResult,
    )} · ${app.training.stats.correct}/${app.training.stats.totalHands}`;
    scoreBadge.dataset.accepted = String(evaluation.accepted);
  }
  const chosenLabel = t(trainingActionLabel(evaluation.chosenAction.type, exercise.decisionContext));
  if ($('#trainingGradeBadge')) {
    $('#trainingGradeBadge').textContent = trainingGradePresentation(
      evaluation.grade,
      exercise.strategyResult,
    );
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
  if (trainingSessionMode() === 'full_hand') {
    handleFullHandTrainingGuess(userAction);
    return;
  }
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
  const countsTowardSession = app.training.currentAttemptKind !== 'replay';
  app.training.lifecycle = 'answered';
  app.training.currentEvaluation = evaluation;
  resetTrainingStudyHints();
  if (countsTowardSession) {
    app.training.stats.totalHands += 1;
    app.training.stats.correct += evaluation.scoreDelta;
    app.training.stats.streak = evaluation.accepted ? app.training.stats.streak + 1 : 0;
    app.training.bestStreak = Math.max(app.training.bestStreak || 0, app.training.stats.streak);
    app.training.gradeStats[evaluation.grade] = (app.training.gradeStats[evaluation.grade] || 0) + 1;
  }
  const feedbackSemantics = strategyClaimPolicy(exercise.strategyResult).trainingSemantics;
  updateTrainingStats();

  renderTrainingEvaluationSummary(evaluation, exercise);
  showTrainingFeedback(
    canonicalTrainingFeedback(evaluation, exercise.strategyResult),
    evaluation.accepted
  );
  // Schedule study feedback before the deeper synchronous analysis render so
  // the cue remains perceptually attached to the submitted answer. Study cues
  // bypass the independent poker-foley queue in riverline-audio/v1.
  emitTrainingDecisionResultExperience({
    comparisonState: evaluation.grade,
    feedbackSemantics,
    accepted: evaluation.accepted,
    chosenActionType: userAction,
  });
  renderTrainingDecisionAnalysis(exercise);
  $('#trainingAnalysisTitle')?.closest('details')?.removeAttribute('open');
  showTrainingSolution(app.training.currentSolution);
  recordTrainingExerciseAnswered({
    evaluation,
    exercise,
    actionType: userAction,
  });
  if (exercise.generationMetadata?.memoryRedrill) {
    void finishTrainingMemorySession('completed');
  }
  const guessButtons = $('#trainingGuessButtons');
  if (guessButtons) guessButtons.hidden = true;
  const nextBtn = $('#trainingNextHandBtn');
  if (nextBtn) {
    nextBtn.textContent = t('Next exercise');
  }
  app.training.lifecycle = 'feedback';
  setTrainingWorkspaceState('feedback');
  if (countsTowardSession) completeVariedTrainingSession();
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
