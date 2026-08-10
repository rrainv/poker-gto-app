export const CANONICAL_DEV_CHANGE_EVENT = 'riverline:canonical-dev-change';

const ACTION_ORDER = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function bb(milliBb) {
  return Number.isFinite(milliBb) ? milliBb / 1000 : null;
}

function displayBb(milliBb) {
  const value = bb(milliBb);
  return value === null ? '—' : `${Number(value.toFixed(3))}bb`;
}

function actionView(type, option) {
  if (!option?.available) return null;
  if (type === 'call') {
    return {
      type,
      label: `Call ${displayBb(option.commitMilliBb)}${option.allIn ? ' (all-in)' : ''}`,
      minToBb: null,
      maxToBb: null,
    };
  }
  if (type === 'bet' || type === 'raise') {
    return {
      type,
      label: type === 'bet' ? 'Bet' : 'Raise',
      minToBb: bb(option.minToMilliBb),
      maxToBb: bb(option.maxToMilliBb),
    };
  }
  if (type === 'all_in') {
    return {
      type,
      label: `All-in ${displayBb(option.amountToMilliBb)}`,
      minToBb: null,
      maxToBb: null,
    };
  }
  return {
    type,
    label: type[0].toUpperCase() + type.slice(1),
    minToBb: null,
    maxToBb: null,
  };
}

function diagnosticView(diagnostics) {
  if (!diagnostics) return { tone: 'muted', label: 'Unavailable', details: [] };
  if (diagnostics.status === 'disabled') {
    return { tone: 'muted', label: 'Disabled', details: [] };
  }
  if (diagnostics.status === 'unavailable') {
    return {
      tone: 'muted',
      label: `Unavailable · ${diagnostics.reason || 'unknown'}`,
      details: [],
    };
  }
  if (diagnostics.status === 'error') {
    return {
      tone: 'error',
      label: 'Error',
      details: [diagnostics.error?.message || 'Unknown canonical error'],
    };
  }
  if (diagnostics.status === 'compared' && diagnostics.matches) {
    return { tone: 'match', label: 'Match', details: [] };
  }
  return {
    tone: 'mismatch',
    label: 'Mismatch',
    details: (diagnostics.comparison?.mismatches || []).map((entry) => (
      `${entry.field}: legacy ${JSON.stringify(entry.legacyValue)} · canonical ${JSON.stringify(entry.canonicalValue)}`
    )),
  };
}

export function buildCanonicalHarnessViewModel({
  enabled,
  state,
  heroPlayerId,
  diagnostics,
  legalActions,
} = {}) {
  const players = state?.players?.map((player) => ({
    playerId: player.playerId,
    seat: player.seat,
    position: player.position,
    currentStackBb: bb(player.currentStackMilliBb),
    folded: player.folded,
    allIn: !player.folded && player.dealtIn && player.currentStackMilliBb === 0,
    isButton: player.seat === state.buttonSeat,
    isHero: player.playerId === heroPlayerId,
    isActor: player.playerId === state.actingPlayerId,
    holeCards: player.holeCards ? [...player.holeCards] : null,
  })) || [];
  const actions = legalActions
    ? ACTION_ORDER.map((type) => actionView(
      type,
      legalActions[type === 'all_in' ? 'allIn' : type],
    )).filter(Boolean)
    : [];
  const handRanks = Object.entries(state?.showdown?.handRanksByPlayer || {}).map(
    ([playerId, rank]) => ({
      playerId,
      category: rank.category,
      bestFiveCards: [...rank.bestFiveCards],
    }),
  );

  return Object.freeze({
    enabled: enabled === true,
    hasSession: Boolean(state),
    schemaVersion: state?.schemaVersion ?? null,
    street: state?.street ?? null,
    phase: state?.phase ?? null,
    potBb: bb(state?.potMilliBb),
    currentBetBb: bb(state?.currentBetMilliBb),
    currentActorId: state?.actingPlayerId ?? null,
    pendingChance: state?.pendingChance?.type ?? null,
    pendingCardCount: state?.pendingChance?.cardCount ?? 0,
    deductionBb: bb(state?.deductionTotalMilliBb),
    terminalReason: state?.terminal?.reason ?? null,
    terminalWinners: [...(state?.terminal?.winnerPlayerIds || [])],
    payouts: Object.entries(state?.terminal?.payoutsMilliBbByPlayer || {})
      .map(([playerId, amountMilliBb]) => ({ playerId, amountBb: bb(amountMilliBb) })),
    refunds: Object.entries(state?.terminal?.refundsMilliBbByPlayer || {})
      .map(([playerId, amountMilliBb]) => ({ playerId, amountBb: bb(amountMilliBb) })),
    handRanks,
    board: [...(state?.board || [])],
    players,
    actions,
    diagnostics: diagnosticView(diagnostics),
    actionHistory: (state?.actionHistory || []).slice(-5).map((record) => ({
      sequence: record.sequence,
      playerId: record.playerId,
      type: record.submittedAction.type,
      amountToBb: bb(record.submittedAction.amountToMilliBb),
    })),
  });
}

function options(minimum, maximum, selected) {
  return Array.from({ length: maximum - minimum + 1 }, (_, index) => index + minimum)
    .map((value) => `<option value="${value}"${value === Number(selected) ? ' selected' : ''}>${value}</option>`)
    .join('');
}

function sessionMarkup(draft) {
  const maxSeat = Math.max(1, Number(draft.tableSize) - 1);
  return `
    <section class="canonical-harness-section">
      <h4>Session</h4>
      <div class="canonical-harness-form">
        <label>Players<select data-canonical-config="tableSize">${options(2, 10, draft.tableSize)}</select></label>
        <label>Mode<select data-canonical-config="gameMode">
          <option value="home"${draft.gameMode === 'home' ? ' selected' : ''}>Home</option>
          <option value="clubgg"${draft.gameMode === 'clubgg' ? ' selected' : ''}>ClubGG</option>
        </select></label>
        <label>Stack (bb)<input type="number" min="0.1" max="500" step="0.1" value="${escapeHtml(draft.stackBb)}" data-canonical-config="stackBb"></label>
        <label>Button seat<select data-canonical-config="buttonSeat">${options(0, maxSeat, draft.buttonSeat)}</select></label>
        <label>Hero seat<select data-canonical-config="heroSeat">${options(0, maxSeat, draft.heroSeat)}</select></label>
        <label>Ante type<select data-canonical-config="anteType">
          <option value="none"${draft.anteType === 'none' ? ' selected' : ''}>None</option>
          <option value="per_player"${draft.anteType === 'per_player' ? ' selected' : ''}>Per player</option>
          <option value="big_blind"${draft.anteType === 'big_blind' ? ' selected' : ''}>Big blind</option>
        </select></label>
        <label>Ante (bb)<input type="number" min="0" max="20" step="0.1" value="${escapeHtml(draft.anteBb)}" data-canonical-config="anteBb"></label>
      </div>
      <div class="canonical-harness-buttons">
        <button type="button" class="btn-action" data-canonical-command="start">Start / reset hand</button>
        <button type="button" class="secondary" data-canonical-command="clear">Clear session</button>
      </div>
    </section>`;
}

function seatsMarkup(view) {
  if (!view.hasSession) return '<p class="canonical-harness-empty">No canonical session.</p>';
  return `<div class="canonical-seat-list">${view.players.map((player) => {
    const flags = [
      player.isButton ? 'BTN' : null,
      player.isHero ? 'HERO' : null,
      player.isActor ? 'ACTOR' : null,
      player.folded ? 'FOLDED' : null,
      player.allIn ? 'ALL-IN' : null,
    ].filter(Boolean);
    return `<div class="canonical-seat-row${player.isActor ? ' is-actor' : ''}">
      <span>Seat ${player.seat} · ${escapeHtml(player.position)}</span>
      <span>${escapeHtml(player.playerId)} · ${player.currentStackBb}bb</span>
      <small>${flags.length ? flags.join(' · ') : 'active'}</small>
    </div>`;
  }).join('')}</div>`;
}

function cardsMarkup(view, holeDraft, boardDraft) {
  const awaitingHole = view.pendingChance === 'deal_hole';
  const boardChance = ['deal_flop', 'deal_turn', 'deal_river'].includes(view.pendingChance);
  const privateRows = view.players.map((player) => {
    const values = player.holeCards || holeDraft[player.playerId] || ['', ''];
    return `<div class="canonical-card-row">
      <span>Seat ${player.seat} · ${escapeHtml(player.position)}</span>
      <input maxlength="2" pattern="[2-9TJQKA][shdc]" value="${escapeHtml(values[0])}" data-canonical-hole-player="${escapeHtml(player.playerId)}" data-card-index="0"${awaitingHole ? '' : ' disabled'}>
      <input maxlength="2" pattern="[2-9TJQKA][shdc]" value="${escapeHtml(values[1])}" data-canonical-hole-player="${escapeHtml(player.playerId)}" data-card-index="1"${awaitingHole ? '' : ' disabled'}>
    </div>`;
  }).join('');
  const boardInputs = boardChance
    ? Array.from({ length: view.pendingCardCount }, (_, index) => (
      `<input maxlength="2" pattern="[2-9TJQKA][shdc]" value="${escapeHtml(boardDraft[index] || '')}" data-canonical-board-index="${index}">`
    )).join('')
    : '';
  return `
    <section class="canonical-harness-section">
      <h4>Cards</h4>
      ${privateRows || '<p class="canonical-harness-empty">Start a session to enter cards.</p>'}
      ${awaitingHole ? '<button type="button" class="btn-action" data-canonical-command="deal-hole">Deal complete private cards</button>' : ''}
      <div class="canonical-board-control">
        <span>Board: ${view.board.length ? view.board.join(' ') : '—'}</span>
        ${boardInputs}
        ${boardChance ? `<button type="button" class="btn-action" data-canonical-command="deal-board">${escapeHtml(view.pendingChance.replace('_', ' '))}</button>` : ''}
      </div>
    </section>`;
}

function actionsMarkup(view, amountToBb) {
  if (view.phase === 'showdown') {
    return `<section class="canonical-harness-section"><h4>Action</h4>
      <button type="button" class="btn-action" data-canonical-command="showdown">Settle showdown</button>
    </section>`;
  }
  if (view.actions.length === 0) {
    return `<section class="canonical-harness-section"><h4>Action</h4><p class="canonical-harness-empty">No player action is currently legal.</p></section>`;
  }
  const sized = view.actions.find((action) => action.type === 'bet' || action.type === 'raise');
  const boundedAmount = sized
    ? Math.min(sized.maxToBb, Math.max(sized.minToBb, Number(amountToBb) || sized.minToBb))
    : null;
  return `<section class="canonical-harness-section"><h4>Action</h4>
    <p class="canonical-harness-note">Actor: ${escapeHtml(view.currentActorId)}</p>
    ${sized ? `<label class="canonical-size-input">Amount to (bb)
      <input type="number" min="${sized.minToBb}" max="${sized.maxToBb}" step="0.1" value="${boundedAmount}" data-canonical-action-amount>
      <small>min ${sized.minToBb} · max ${sized.maxToBb}</small>
    </label>` : ''}
    <div class="canonical-harness-buttons">${view.actions.map((action) => (
      `<button type="button" class="${action.type === 'fold' ? 'secondary' : 'btn-action'}" data-canonical-action="${action.type}">${escapeHtml(action.label)}</button>`
    )).join('')}</div>
  </section>`;
}

function stateMarkup(view) {
  const summary = view.hasSession ? [
    ['Street', view.street], ['Phase', view.phase], ['Pot', `${view.potBb}bb`],
    ['Current bet', `${view.currentBetBb}bb`], ['Actor', view.currentActorId || '—'],
    ['Pending', view.pendingChance || '—'], ['Deductions', `${view.deductionBb}bb`],
    ['Terminal', view.terminalReason || 'no'],
  ] : [];
  const history = view.actionHistory.length
    ? `<ol class="canonical-action-history">${view.actionHistory.map((entry) => (
      `<li>${entry.sequence}: ${escapeHtml(entry.playerId)} · ${escapeHtml(entry.type)}${entry.amountToBb === null ? '' : ` to ${entry.amountToBb}bb`}</li>`
    )).join('')}</ol>`
    : '';
  return `<section class="canonical-harness-section"><h4>State</h4>
    <div class="canonical-state-grid">${summary.map(([label, value]) => (
      `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`
    )).join('')}</div>${history}</section>`;
}

function diagnosticsMarkup(view, localError) {
  const details = [localError, ...view.diagnostics.details].filter(Boolean);
  return `<section class="canonical-harness-section"><h4>Shadow diagnostics</h4>
    <div class="canonical-diagnostic is-${escapeHtml(view.diagnostics.tone)}">${escapeHtml(view.diagnostics.label)}</div>
    ${details.length ? `<ul class="canonical-diagnostic-details">${details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function terminalMarkup(view) {
  if (!view.terminalReason) return '';
  const entries = [
    ...view.payouts.map((entry) => `Payout ${entry.playerId}: ${entry.amountBb}bb`),
    ...view.refunds.map((entry) => `Refund ${entry.playerId}: ${entry.amountBb}bb`),
    ...view.handRanks.map((entry) => (
      `${entry.playerId}: ${entry.category.replaceAll('_', ' ')} · ${entry.bestFiveCards.join(' ')}`
    )),
  ];
  return `<section class="canonical-harness-section canonical-terminal"><h4>Terminal · ${escapeHtml(view.terminalReason)}</h4>
    <p>Winner(s): ${escapeHtml(view.terminalWinners.join(', ') || '—')}</p>
    ${entries.length ? `<ul>${entries.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>` : ''}
  </section>`;
}

export function renderCanonicalHarnessMarkup(view, {
  configurationDraft,
  holeDraft = {},
  boardDraft = [],
  amountToBb = '',
  localError = null,
} = {}) {
  return `<div class="canonical-harness-grid">
    <div>${sessionMarkup(configurationDraft)}<section class="canonical-harness-section"><h4>Seats</h4>${seatsMarkup(view)}</section></div>
    <div>${cardsMarkup(view, holeDraft, boardDraft)}${actionsMarkup(view, amountToBb)}</div>
    <div>${stateMarkup(view)}${diagnosticsMarkup(view, localError)}${terminalMarkup(view)}</div>
  </div>`;
}

export function installCanonicalHandHarness(browserWindow, bridge) {
  const documentObject = browserWindow?.document;
  const panel = documentObject?.getElementById('canonicalDevHarness');
  const body = documentObject?.getElementById('canonicalDevHarnessBody');
  if (!panel || !body || !bridge) return null;

  const configurationDraft = {
    tableSize: 2,
    gameMode: 'home',
    stackBb: 100,
    buttonSeat: 0,
    heroSeat: 0,
    anteType: 'none',
    anteBb: 0,
  };
  let holeDraft = {};
  let boardDraft = [];
  let amountToBb = '';
  let localError = null;

  const render = () => {
    const enabled = bridge.isEnabled();
    panel.hidden = !enabled;
    panel.setAttribute('aria-hidden', String(!enabled));
    if (!enabled) {
      body.innerHTML = '';
      return;
    }
    const view = buildCanonicalHarnessViewModel({
      enabled,
      state: bridge.getState(),
      heroPlayerId: bridge.getHeroPlayerId(),
      diagnostics: bridge.getDiagnostics(),
      legalActions: bridge.getLegalActions(),
    });
    body.innerHTML = renderCanonicalHarnessMarkup(view, {
      configurationDraft,
      holeDraft,
      boardDraft,
      amountToBb,
      localError,
    });
  };

  const recordFailure = () => {
    localError = bridge.getDiagnostics()?.error?.message || null;
  };

  body.addEventListener('input', (event) => {
    const target = event.target;
    if (target?.dataset?.canonicalConfig) {
      configurationDraft[target.dataset.canonicalConfig] = target.value;
    } else if (target?.dataset?.canonicalHolePlayer) {
      const playerId = target.dataset.canonicalHolePlayer;
      const index = Number(target.dataset.cardIndex);
      const cards = holeDraft[playerId] ? [...holeDraft[playerId]] : ['', ''];
      cards[index] = target.value.trim();
      holeDraft[playerId] = cards;
    } else if (target?.dataset?.canonicalBoardIndex !== undefined) {
      boardDraft[Number(target.dataset.canonicalBoardIndex)] = target.value.trim();
    } else if (target?.hasAttribute?.('data-canonical-action-amount')) {
      amountToBb = target.value;
    }
  });

  body.addEventListener('change', (event) => {
    const target = event.target;
    if (!target?.dataset?.canonicalConfig) return;
    configurationDraft[target.dataset.canonicalConfig] = target.value;
    if (target.dataset.canonicalConfig === 'tableSize') {
      const maximumSeat = Number(target.value) - 1;
      configurationDraft.buttonSeat = Math.min(Number(configurationDraft.buttonSeat), maximumSeat);
      configurationDraft.heroSeat = Math.min(Number(configurationDraft.heroSeat), maximumSeat);
      render();
    }
  });

  body.addEventListener('click', (event) => {
    const command = event.target?.closest?.('[data-canonical-command]')?.dataset?.canonicalCommand;
    const action = event.target?.closest?.('[data-canonical-action]')?.dataset?.canonicalAction;
    if (!command && !action) return;

    localError = null;
    if (command === 'start') {
      const state = bridge.initialize({
        tableSize: Number(configurationDraft.tableSize),
        gameMode: configurationDraft.gameMode,
        stackBb: Number(configurationDraft.stackBb),
        stackMode: 'hero',
        buttonSeat: Number(configurationDraft.buttonSeat),
        heroSeat: Number(configurationDraft.heroSeat),
        anteType: configurationDraft.anteType,
        anteBb: configurationDraft.anteType === 'none' ? 0 : Number(configurationDraft.anteBb),
        straddleBb: 0,
      });
      if (state) {
        holeDraft = {};
        boardDraft = [];
        amountToBb = '';
      } else recordFailure();
    } else if (command === 'clear') {
      bridge.reset();
      holeDraft = {};
      boardDraft = [];
      amountToBb = '';
    } else if (command === 'deal-hole') {
      const state = bridge.getState();
      const cardsByPlayer = Object.fromEntries(
        (state?.players || []).map((player) => [player.playerId, holeDraft[player.playerId] || []]),
      );
      if (!bridge.dealHoleCards(cardsByPlayer)) recordFailure();
    } else if (command === 'deal-board') {
      if (!bridge.dealBoardCards([...boardDraft])) recordFailure();
      else boardDraft = [];
    } else if (command === 'showdown') {
      if (!bridge.resolveShowdown()) recordFailure();
    } else if (action) {
      const option = bridge.getLegalActions()?.[action] || null;
      const amount = action === 'bet' || action === 'raise'
        ? (amountToBb === '' ? option?.minToMilliBb / 1000 : Number(amountToBb))
        : null;
      if (!bridge.applyAction(action, amount)) recordFailure();
    }
    render();
  });

  browserWindow.addEventListener?.(CANONICAL_DEV_CHANGE_EVENT, render);
  render();
  return Object.freeze({ render });
}
