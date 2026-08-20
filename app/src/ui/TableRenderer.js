const TABLE_SUIT_PRESENTATION = Object.freeze({
  h: { id: 'h', symbol: '♥' },
  '♥': { id: 'h', symbol: '♥' },
  d: { id: 'd', symbol: '♦' },
  '♦': { id: 'd', symbol: '♦' },
  c: { id: 'c', symbol: '♣' },
  '♣': { id: 'c', symbol: '♣' },
  s: { id: 's', symbol: '♠' },
  '♠': { id: 's', symbol: '♠' },
});

function tableMessage(key, fallback, values = {}) {
  const runtime = globalThis.RiverlineI18n;
  if (runtime && typeof runtime.resolveTranslation === 'function') {
    const resolution = runtime.resolveTranslation(key);
    if (!resolution.missing && typeof globalThis.t === 'function') return globalThis.t(key, values);
  }
  return String(fallback || '').replace(/\{([A-Za-z0-9_]+)\}/g, (token, name) => (
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : token
  ));
}

function tableContributionPoint({ centerX, centerY, seatX, seatY }) {
  const radialFraction = 0.5;
  const idealX = centerX + ((seatX - centerX) * radialFraction);
  const idealY = centerY + ((seatY - centerY) * radialFraction);
  const rayX = centerX - seatX;
  const rayY = centerY - seatY;
  const rayLength = Math.hypot(rayX, rayY);
  const unitX = rayLength ? rayX / rayLength : 0;
  const unitY = rayLength ? rayY / rayLength : 0;
  const intersectsHoleCards = (candidateX, candidateY) => (
    candidateX + 38 >= seatX - 33
    && candidateX - 38 <= seatX + 33
    && candidateY + 10 >= seatY - 94
    && candidateY - 10 <= seatY - 36
  );

  // Keep the ideal seat-to-pot ray. If it reaches the shared card box, move only
  // as many SVG units inward on that same ray as are required to clear it.
  for (let inwardCorrection = 0; inwardCorrection <= Math.ceil(rayLength); inwardCorrection += 1) {
    const point = {
      x: idealX + (unitX * inwardCorrection),
      y: idealY + (unitY * inwardCorrection),
    };
    if (!intersectsHoleCards(point.x, point.y)) return point;
  }

  return { x: idealX, y: idealY };
}

class TableRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.currentActivePlayers = 10;
    this.lastState = null;
    this.renderedCardSignatures = new Map();
    this.pendingReplayMotion = null;
    this.lastReplayMotionToken = null;
    this.replayMotionGeneration = 0;
    this.activeReplayAnimations = [];
    this.replayMotionFallbackCleanups = [];
    this.initSVG();
    window.addEventListener('riverline:replay-motion', (event) => {
      this.pendingReplayMotion = event.detail?.schemaVersion === 'replay-motion/v1'
        ? event.detail
        : null;
      if (!this.pendingReplayMotion) this.lastReplayMotionToken = null;
    });
    window.addEventListener('gameStateUpdate', (event) => this.renderState(event.detail));
    window.addEventListener('riverlineCardRankStyleChanged', () => {
      if (this.lastState) this.renderState(this.lastState);
    });
    window.addEventListener('riverlineCardStyleChanged', () => {
      if (this.lastState) this.renderState(this.lastState);
    });
    window.addEventListener('riverline:languagechange', () => {
      if (this.lastState) this.renderState(this.lastState);
      else this.initSVG();
    });
  }

  initSVG() {
    this.container.innerHTML = `
      <svg id="poker-table-svg" class="riverline-poker-table" viewBox="0 -80 800 600" width="100%" role="img" aria-labelledby="poker-table-title" aria-describedby="poker-table-description" preserveAspectRatio="xMidYMid meet">
        <title id="poker-table-title">${tableMessage('table.title', 'Riverline poker table')}</title>
        <desc id="poker-table-description"></desc>
        <defs>
          <linearGradient id="riverlineTableRail" x1="0" y1="0" x2="0" y2="1">
            <stop class="table-rail-start" offset="0%" />
            <stop class="table-rail-end" offset="100%" />
          </linearGradient>
          <radialGradient id="riverlineTableSurface" cx="50%" cy="45%" r="62%">
            <stop class="table-surface-start" offset="0%" />
            <stop class="table-surface-end" offset="100%" />
          </radialGradient>
          <filter id="riverlineTableShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow class="table-shadow-effect" dx="0" dy="7" stdDeviation="8" flood-opacity="0.28" />
          </filter>
          <filter id="riverlineCardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.22" />
          </filter>
        </defs>

        <rect class="table-rail" x="50" y="50" width="700" height="400" rx="200" ry="200" aria-hidden="true" />
        <rect class="table-surface" x="70" y="70" width="660" height="360" rx="180" ry="180" aria-hidden="true" />
        <rect class="table-betting-line" x="100" y="100" width="600" height="300" rx="150" ry="150" aria-hidden="true" />
        <path class="table-riverline-mark" d="M286 176 C342 146 458 146 514 176" aria-hidden="true" />

        <text id="table-phase-status" class="table-phase-status" x="400" y="194" text-anchor="middle"></text>
        ${this.pokerTableAmountMarkup({
          id: 'table-pot', className: 'table-pot', size: 'normal', x: 400, y: 213,
          prefix: tableMessage('table.potLabel', 'Pot'), value: '0', unit: 'bb', ariaHidden: true,
        })}
        <g id="community-cards" class="table-community-cards" transform="translate(400, 240)"></g>
        <g id="table-contributions-layer" class="table-contributions-layer"></g>
        <g id="seats-layer" class="table-seats-layer"></g>
      </svg>
    `;
    this.drawSeats();
  }

  drawSeats(activePlayers = 10) {
    const seatsLayer = this.container.querySelector('#seats-layer');
    const contributionsLayer = this.container.querySelector('#table-contributions-layer');
    if (!seatsLayer || !contributionsLayer) return;

    const centerX = 400;
    const centerY = 250;
    const rx = 340;
    const ry = 210;
    let seatsHtml = '';
    let contributionsHtml = '';
    seatsLayer.dataset.tableSize = String(activePlayers);
    contributionsLayer.dataset.tableSize = String(activePlayers);

    for (let i = 0; i < activePlayers; i++) {
      // Visual index zero is the stable Hero anchor. Turn order is supplied by the model.
      const angle = (Math.PI / 2) + (i * (2 * Math.PI / activePlayers));
      const x = Math.round(centerX + rx * Math.cos(angle));
      const y = Math.round(centerY + ry * Math.sin(angle));
      // Contributions sit halfway along the shared radial line from seat to pot.
      // Any card-box correction remains on that line and moves inward only.
      const contributionPoint = tableContributionPoint({
        centerX, centerY, seatX: x, seatY: y,
      });

      seatsHtml += `
        <g id="seat-${i}" class="table-seat table-player-unit${i === 0 ? ' is-hero' : ''}" data-seat-index="${i}" data-card-anchor="center" transform="translate(${x}, ${y})">
          <g id="hole-cards-${i}" class="table-hole-cards" transform="translate(0, -94)" aria-hidden="true">${i === 0 ? '' : `${this.renderCardBack(0)}${this.renderCardBack(1)}`}</g>
          <g class="table-seat-info">
            <rect class="table-seat-surface" x="-50" y="-34" width="100" height="70" rx="10" aria-hidden="true" />
            <path class="table-actor-indicator" d="M-40 -28 H40" aria-hidden="true" />
            <text class="table-seat-name" x="0" y="-19" text-anchor="middle">${i === 0 ? tableMessage('Hero', 'Hero') : `P${i + 1}`}</text>
            <text id="seat-position-${i}" class="table-seat-meta table-seat-position" x="0" y="-7" text-anchor="middle"></text>
            ${this.pokerAmountMarkup({
              id: `seat-stack-${i}`, className: 'table-seat-meta table-seat-stack',
              size: 'small', x: -38, y: -1, unit: '', ariaHidden: true,
            })}
            <text id="seat-status-${i}" class="table-seat-meta table-seat-status" x="0" y="19" text-anchor="middle" hidden></text>
          </g>
          <g id="dealer-${i}" class="table-dealer-button" transform="translate(43, -27)" hidden>
            <circle r="10" aria-hidden="true" />
            <text id="dealer-txt-${i}" x="0" y="3.5" text-anchor="middle" aria-hidden="true">D</text>
          </g>
          <g id="action-${i}" class="table-action-badge" transform="translate(0, 27)" hidden aria-hidden="true">
            <rect class="table-action-surface" x="-44" y="-9" width="88" height="18" rx="9" aria-hidden="true" />
            <text class="table-action-label" x="0" y="3" text-anchor="middle"></text>
          </g>
        </g>
      `;
      contributionsHtml += this.pokerTableAmountMarkup({
        id: `contribution-${i}`,
        className: 'table-contribution',
        size: 'small',
        x: contributionPoint.x,
        y: contributionPoint.y,
        value: '',
        unit: 'bb',
        ariaHidden: true,
        hidden: true,
      });
    }
    seatsLayer.innerHTML = seatsHtml;
    contributionsLayer.innerHTML = contributionsHtml;
  }

  renderCard(rank, suit, index, totalCards = 1, isCommunity = false, isDealing = false) {
    const presentation = TABLE_SUIT_PRESENTATION[suit] || { id: 'unknown', symbol: suit || '?' };
    const visualRank = rank === 'T' && document.documentElement.dataset.cardRankStyle === 'full-ten' ? '10' : rank;
    const rankClass = visualRank === '10' ? ' table-card-rank--ten' : '';
    const cardStyle = ['classic-mirrored', 'tournament', 'clean-corner', 'clarity-corner'].includes(document.documentElement.dataset.cardStyle)
      ? document.documentElement.dataset.cardStyle
      : 'tournament';
    const cardStep = isCommunity ? 50 : 45;
    const finalX = ((index - ((totalCards - 1) / 2)) * cardStep) - 20;
    const cornerText = `
          <text class="riverline-card-corner-rank table-card-corner-rank${rankClass}" x="10" y="14" text-anchor="middle">${visualRank}</text>
          <text class="riverline-card-corner-suit table-card-corner-suit" x="10" y="27" text-anchor="middle">${presentation.symbol}</text>`;
    const secondaryCorner = cardStyle === 'clean-corner' ? '' : `
        <g class="table-card-corner table-card-corner--bottom table-card-corner--${cardStyle === 'clarity-corner' ? 'subdued' : 'full'}" aria-hidden="true" transform="translate(40 57) rotate(180)">${cornerText}
        </g>`;
    const cornerMarkup = cardStyle === 'tournament' ? '' : `
        <g class="table-card-corner table-card-corner--top" aria-hidden="true">${cornerText}
        </g>${secondaryCorner}`;

    return `
      <g class="card-group poker-card-svg riverline-card card--known card--style-${cardStyle} card--suit-${presentation.id}${isDealing ? ' is-card-dealt' : ''}" data-card-state="known" data-card-style="${cardStyle}" style="--card-final-x:${finalX}px; --card-deal-order:${Math.min(index, 4)}; transform:translate(${finalX}px, 0px);">
        <rect class="riverline-card-face table-card-face" x="0" y="0" width="40" height="57" rx="5" ry="5" />
        ${cornerMarkup}
        <g class="table-card-tournament" aria-hidden="true">
          <text class="riverline-card-tournament-rank${rankClass}" x="20" y="25" text-anchor="middle">${visualRank}</text>
          <text class="riverline-card-tournament-suit" x="20" y="42" text-anchor="middle">${presentation.symbol}</text>
        </g>
      </g>
    `;
  }

  pokerAmountMarkup(options) {
    const primitives = globalThis.RiverlinePokerPrimitives;
    if (!primitives) throw new Error('RiverlinePokerPrimitives must load before TableRenderer');
    return primitives.pokerAmountSvg(options);
  }

  pokerChipVisualMarkup(options) {
    const primitives = globalThis.RiverlinePokerPrimitives;
    if (!primitives) throw new Error('RiverlinePokerPrimitives must load before TableRenderer');
    return primitives.pokerChipVisualSvg(options);
  }

  pokerTableAmountMarkup(options) {
    const primitives = globalThis.RiverlinePokerPrimitives;
    if (!primitives) throw new Error('RiverlinePokerPrimitives must load before TableRenderer');
    return primitives.pokerTableAmountSvg(options);
  }

  setPokerAmount(element, options) {
    globalThis.RiverlinePokerPrimitives?.setPokerAmount(element, options);
  }

  renderCardBack(index) {
    const finalX = ((index - 0.5) * 25) - 20;
    return `
      <g class="table-card-back poker-card-svg poker-card-back" data-card-state="unknown" transform="translate(${finalX}, 0)">
        <rect class="table-card-back-face" x="0" y="0" width="40" height="58" rx="4" ry="4" />
        <path class="table-card-back-line" d="M7 17 C15 11 25 11 33 17 M7 41 C15 47 25 47 33 41" />
        <text class="table-card-back-mark" x="20" y="34" text-anchor="middle">R</text>
      </g>
    `;
  }

  renderKnownCards(container, cards, key, isCommunity = false, replayDealCardIds = null) {
    const signatures = cards.map((card) => `${card.rank}${card.suit}`);
    const previous = this.renderedCardSignatures.get(key) || [];
    const trustedReplayDealCards = replayDealCardIds === null
      ? null
      : new Set(replayDealCardIds);
    container.innerHTML = cards
      .map((card, index) => this.renderCard(
        card.rank,
        card.suit,
        index,
        cards.length,
        isCommunity,
        trustedReplayDealCards === null
          ? previous[index] !== signatures[index]
          : trustedReplayDealCards.has(card.id),
      ))
      .join('');
    this.renderedCardSignatures.set(key, signatures);
  }

  formatMilliBb(milliBb) {
    if (!Number.isSafeInteger(milliBb) || milliBb < 0) return '';
    const value = Number((milliBb / 1000).toFixed(3));
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      maximumFractionDigits: 3,
    }).format(value);
  }

  presenceSeatIdentity(player) {
    const fallback = player.isHero
      ? tableMessage('Hero', 'Hero')
      : tableMessage('Player {number}', 'Player {number}', { number: player.seat + 1 });
    if (!player.suppliedName) return fallback;
    return player.isHero ? `${tableMessage('Hero', 'Hero')} · ${player.suppliedName}` : player.suppliedName;
  }

  presenceStatus(player) {
    if (player.isCurrentActor) return tableMessage('table.status.toAct', 'To act');
    if (player.isFolded) return tableMessage('table.status.folded', 'Folded');
    if (player.isAllIn) return tableMessage('table.status.allIn', 'All-in');
    return '';
  }

  presenceAction(action) {
    if (!action) return '';
    const value = this.formatMilliBb(action.amountMilliBb);
    const messages = {
      fold: ['table.action.fold', 'Fold'],
      check: ['table.action.check', 'Check'],
      call: ['table.action.call', 'Call {value} bb'],
      bet: ['table.action.betTo', 'Bet to {value} bb'],
      raise: ['table.action.raiseTo', 'Raise to {value} bb'],
      all_in: ['table.action.allInTo', 'All-in to {value} bb'],
    };
    const [key, fallback] = messages[action.type] || ['table.action.unknown', 'Action'];
    return tableMessage(key, fallback, { value });
  }

  presencePhase(state) {
    if (state.empty) return tableMessage('table.empty.startHand', 'Start a hand');
    if (state.status === 'awaiting_private_cards') {
      return tableMessage('table.phase.awaitingPrivateCards', 'Awaiting private cards');
    }
    if (state.status === 'awaiting_board') {
      const nextStreet = String(state.pendingChance?.type || '').replace('deal_', '');
      const street = tableMessage(`table.street.${nextStreet}`, nextStreet, {});
      return tableMessage('table.phase.awaitingStreet', 'Waiting for {street}', { street });
    }
    if (state.status === 'showdown') return tableMessage('table.phase.showdown', 'Showdown');
    if (state.status === 'terminal') return tableMessage('table.phase.terminal', 'Hand complete');
    return tableMessage(`table.street.${state.street}`, state.street || '', {});
  }

  presenceSeatDescription(player) {
    const parts = [
      this.presenceSeatIdentity(player),
      player.position,
      tableMessage('table.a11y.stack', 'Stack {value} bb', {
        value: this.formatMilliBb(player.currentStackMilliBb),
      }),
    ].filter(Boolean);
    if (player.isButton) parts.push(tableMessage('table.a11y.dealer', 'Dealer button'));
    const status = this.presenceStatus(player);
    if (status) parts.push(status);
    if (player.streetContributionMilliBb > 0) {
      parts.push(tableMessage('table.a11y.contribution', 'Current-street contribution {value} bb', {
        value: this.formatMilliBb(player.streetContributionMilliBb),
      }));
    }
    const action = this.presenceAction(player.latestAction);
    if (action) parts.push(action);
    if (player.cardVisibility === 'known') {
      parts.push(tableMessage('table.a11y.cardsKnownValue', 'Cards {cards}', {
        cards: player.cards.map((card) => card.id).join(' '),
      }));
    } else {
      const cardsKey = player.cardVisibility === 'hidden'
        ? 'table.a11y.cardsHidden' : 'table.a11y.cardsUndealt';
      const cardsFallback = player.cardVisibility === 'hidden' ? 'Cards hidden' : 'Cards not dealt';
      parts.push(tableMessage(cardsKey, cardsFallback));
    }
    return parts.join(' · ');
  }

  clearReplayMotionClasses({ cancelAnimations = true } = {}) {
    this.replayMotionGeneration += 1;
    this.replayMotionFallbackCleanups.forEach((cleanup) => cleanup());
    this.replayMotionFallbackCleanups = [];
    if (cancelAnimations) {
      this.activeReplayAnimations.forEach((animation) => animation.cancel());
    }
    this.activeReplayAnimations = [];
    const motionClasses = [
      'is-replay-action-motion', 'is-replay-next-actor-motion',
      'is-replay-value-motion', 'is-replay-fold-motion',
      'is-replay-all-in-motion', 'is-replay-pot-motion',
      'is-replay-showdown-motion',
    ];
    this.container.querySelectorAll(`.${motionClasses.join(',.')}`)
      .forEach((element) => element.classList.remove(...motionClasses));
    this.container.querySelectorAll('.is-replay-card-motion').forEach((element) => {
      element.classList.remove('is-replay-card-motion', 'is-card-dealt');
    });
    delete this.container.dataset.replayMotionCycle;
    delete this.container.dataset.replayTransition;
  }

  settleReplayMotionWithEvents(generation) {
    if (typeof window.getComputedStyle !== 'function') {
      this.clearReplayMotionClasses({ cancelAnimations: false });
      return;
    }
    const animatedElements = [...this.container.querySelectorAll('*')].filter((element) => {
      const animationNames = window.getComputedStyle(element).animationName
        .split(',')
        .map((name) => name.trim());
      return animationNames.some((name) => name.startsWith('replay-')
        || name === 'riverline-card-deal');
    });
    if (animatedElements.length === 0) {
      this.clearReplayMotionClasses({ cancelAnimations: false });
      return;
    }

    const pending = new Set(animatedElements);
    this.replayMotionFallbackCleanups = animatedElements.map((element) => {
      const settleElement = (event) => {
        if (event.target !== element
          || (!event.animationName?.startsWith('replay-')
            && event.animationName !== 'riverline-card-deal')) return;
        pending.delete(element);
        element.removeEventListener('animationend', settleElement);
        element.removeEventListener('animationcancel', settleElement);
        if (pending.size === 0 && generation === this.replayMotionGeneration) {
          this.clearReplayMotionClasses({ cancelAnimations: false });
        }
      };
      element.addEventListener('animationend', settleElement);
      element.addEventListener('animationcancel', settleElement);
      return () => {
        element.removeEventListener('animationend', settleElement);
        element.removeEventListener('animationcancel', settleElement);
      };
    });
  }

  settleReplayMotionWhenFinished(generation) {
    if (typeof this.container.getAnimations !== 'function') {
      this.settleReplayMotionWithEvents(generation);
      return;
    }
    this.activeReplayAnimations = this.container.getAnimations({ subtree: true })
      .filter((animation) => animation.animationName?.startsWith('replay-')
        || animation.animationName === 'riverline-card-deal');
    if (this.activeReplayAnimations.length === 0) {
      this.clearReplayMotionClasses({ cancelAnimations: false });
      return;
    }
    Promise.allSettled(this.activeReplayAnimations.map((animation) => animation.finished))
      .then(() => {
        if (generation === this.replayMotionGeneration) {
          this.clearReplayMotionClasses({ cancelAnimations: false });
        }
      });
  }

  applyReplayMotion(state, motion) {
    this.clearReplayMotionClasses();
    if (!motion?.active || motion.token === this.lastReplayMotionToken) return;
    this.lastReplayMotionToken = motion.token;
    const motionGeneration = this.replayMotionGeneration;
    this.container.dataset.replayMotionCycle = motion.token % 2 === 0 ? 'a' : 'b';
    this.container.dataset.replayTransition = motion.transitionKind;
    this.container.querySelectorAll('.card-group.is-card-dealt, .table-hole-cards.is-card-dealt')
      .forEach((card) => card.classList.add('is-replay-card-motion'));

    const seatForPlayer = (playerId) => {
      const player = state.seats.find((candidate) => candidate.playerId === playerId);
      return Number.isInteger(player?.visualSeatIndex)
        ? this.container.querySelector(`#seat-${player.visualSeatIndex}`)
        : null;
    };
    const actingSeat = seatForPlayer(motion.actorPlayerId);
    actingSeat?.classList.add('is-replay-action-motion');
    actingSeat?.querySelector('.table-action-badge')?.classList.add('is-replay-action-motion');
    seatForPlayer(motion.nextActorPlayerId)?.classList.add('is-replay-next-actor-motion');

    motion.seatChanges.forEach((change) => {
      const seat = seatForPlayer(change.playerId);
      if (!seat) return;
      if (change.stack.changed) seat.querySelector('.table-seat-stack')?.classList.add('is-replay-value-motion');
      if (change.contribution.changed && Number.isInteger(change.visualSeatIndex)) {
        this.container.querySelector(`#contribution-${change.visualSeatIndex}`)
          ?.classList.add('is-replay-value-motion');
      }
      if (change.foldedChanged) seat.classList.add('is-replay-fold-motion');
      if (change.allInChanged) seat.classList.add('is-replay-all-in-motion');
    });
    const contributionsCollected = motion.transitionKind === 'action'
      && state.showStreetContributions === false
      && state.status === 'awaiting_board';
    if (motion.pot.changed || contributionsCollected) {
      this.container.querySelector('#table-pot')?.classList.add('is-replay-pot-motion');
    }
    if (motion.transitionKind === 'showdown_resolution') {
      this.container.querySelector('#poker-table-svg')?.classList.add('is-replay-showdown-motion');
    }
    this.settleReplayMotionWhenFinished(motionGeneration);
  }

  renderPresenceState(state, replayMotion = null) {
    const activePlayers = state.seats.length;
    if (activePlayers !== this.currentActivePlayers) {
      this.currentActivePlayers = activePlayers;
      this.drawSeats(activePlayers);
    }

    const phase = this.container.querySelector('#table-phase-status');
    const pot = this.container.querySelector('#table-pot');
    const description = this.container.querySelector('#poker-table-description');
    if (phase) phase.textContent = this.presencePhase(state);
    if (pot) {
      const value = this.formatMilliBb(state.potMilliBb);
      this.setPokerAmount(pot, {
        prefix: tableMessage('table.potLabel', 'Pot'), value, unit: 'bb', ariaHidden: true,
      });
      pot.toggleAttribute('hidden', state.empty);
    }

    const community = this.container.querySelector('#community-cards');
    if (community) {
      const replayProjected = this.container.closest('.table-wrapper')?.dataset.replayMode === 'replay';
      const replayBoardCards = replayProjected ? replayMotion?.boardCards || [] : null;
      this.renderKnownCards(community, state.board, 'community', true, replayBoardCards);
      community.setAttribute('role', 'group');
      community.setAttribute('aria-label', state.board.length
        ? tableMessage('table.a11y.boardCards', 'Board {cards}', {
          cards: state.board.map((card) => card.id).join(' '),
        })
        : tableMessage('table.a11y.boardEmpty', 'Board not dealt'));
    }

    if (description) {
      description.textContent = [
        this.presencePhase(state),
        state.empty ? null : tableMessage('table.pot', 'Pot {value} bb', {
          value: this.formatMilliBb(state.potMilliBb),
        }),
        ...state.seats.map((player) => this.presenceSeatDescription(player)),
      ].filter(Boolean).join('. ');
    }

    for (const player of state.seats) {
      const i = player.visualSeatIndex;
      const seat = this.container.querySelector(`#seat-${i}`);
      if (!seat) continue;
      const dealer = this.container.querySelector(`#dealer-${i}`);
      const name = seat.querySelector('.table-seat-name');
      const position = this.container.querySelector(`#seat-position-${i}`);
      const stack = this.container.querySelector(`#seat-stack-${i}`);
      const status = this.container.querySelector(`#seat-status-${i}`);
      const contribution = this.container.querySelector(`#contribution-${i}`);
      const action = this.container.querySelector(`#action-${i}`);
      const holeCards = this.container.querySelector(`#hole-cards-${i}`);
      const isHero = player.isHero;
      const isDealer = player.isButton;
      const isActor = player.isCurrentActor;

      seat.dataset.canonicalSeat = String(player.seat);
      seat.dataset.playerId = player.playerId;
      seat.setAttribute('role', 'group');
      seat.setAttribute('aria-label', this.presenceSeatDescription(player));
      seat.classList.toggle('is-hero', isHero);
      seat.classList.toggle('is-dealer', isDealer);
      seat.classList.toggle('is-actor', isActor);
      seat.classList.toggle('is-folded', player.isFolded);
      seat.classList.toggle('is-all-in', player.isAllIn);

      if (name) {
        name.textContent = this.presenceSeatIdentity(player);
        if (name.textContent.length > 15) {
          name.setAttribute('textLength', '96');
          name.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        } else {
          name.removeAttribute('textLength');
          name.removeAttribute('lengthAdjust');
        }
      }
      if (position) position.textContent = player.position || '';
      if (stack) this.setPokerAmount(stack, {
        value: this.formatMilliBb(player.currentStackMilliBb), unit: 'bb', ariaHidden: true,
      });
      if (status) {
        status.textContent = this.presenceStatus(player);
        status.toggleAttribute('hidden', !status.textContent);
      }
      if (dealer) {
        dealer.toggleAttribute('hidden', !isDealer);
        dealer.setAttribute('role', 'img');
        dealer.setAttribute('aria-label', tableMessage('table.a11y.dealer', 'Dealer button'));
      }
      if (contribution) {
        const isVisible = state.showStreetContributions === true
          && player.streetContributionMilliBb > 0;
        contribution.toggleAttribute('hidden', !isVisible);
        const amount = isVisible ? this.formatMilliBb(player.streetContributionMilliBb) : '';
        this.setPokerAmount(contribution, {
          value: amount,
          unit: isVisible ? 'bb' : '',
          ariaHidden: !isVisible,
          ariaLabel: isVisible
            ? tableMessage(
              'table.a11y.contribution',
              'Current-street contribution {value} bb',
              { value: amount },
            )
            : '',
        });
      }
      if (action) {
        const actionLabel = this.presenceAction(player.latestAction);
        action.toggleAttribute('hidden', !actionLabel);
        action.setAttribute('aria-hidden', String(!actionLabel));
        action.classList.remove(
          'is-action-fold', 'is-action-check', 'is-action-call',
          'is-action-bet', 'is-action-raise', 'is-action-all-in',
        );
        if (actionLabel) {
          const actionType = player.latestAction.type.replace('_', '-');
          action.classList.add(`is-action-${actionType}`);
          action.dataset.actionType = player.latestAction.type;
          const actionText = action.querySelector('.table-action-label');
          actionText.textContent = actionLabel;
          if (actionLabel.length > 17) {
            actionText.setAttribute('textLength', '80');
            actionText.setAttribute('lengthAdjust', 'spacingAndGlyphs');
          } else {
            actionText.removeAttribute('textLength');
            actionText.removeAttribute('lengthAdjust');
          }
          action.setAttribute('role', 'group');
          action.setAttribute('aria-label', actionLabel);
        } else {
          delete action.dataset.actionType;
        }
      }
      if (holeCards) {
        const replayProjected = this.container.closest('.table-wrapper')?.dataset.replayMode === 'replay';
        const cardChange = replayMotion?.seatChanges?.find((change) => change.playerId === player.playerId);
        const privateCardTransition = ['private_deal', 'private_reveal'].includes(replayMotion?.transitionKind);
        const privateCardsChanged = cardChange?.cardsChanged || cardChange?.cardVisibilityChanged;
        holeCards.classList.remove('is-card-dealt');
        if (player.cardVisibility === 'known') {
          const replayPrivateCards = replayProjected
            ? (privateCardTransition && privateCardsChanged
              ? player.cards.map((card) => card.id)
              : [])
            : null;
          this.renderKnownCards(holeCards, player.cards, `hole-${player.seat}`, false, replayPrivateCards);
        } else {
          const hiddenCardsDealt = replayProjected
            && replayMotion?.transitionKind === 'private_deal'
            && player.cardVisibility === 'hidden'
            && cardChange?.cardVisibilityChanged;
          holeCards.classList.toggle('is-card-dealt', hiddenCardsDealt);
          holeCards.innerHTML = player.cardVisibility === 'hidden'
            ? `${this.renderCardBack(0)}${this.renderCardBack(1)}`
            : '';
          this.renderedCardSignatures.set(`hole-${player.seat}`, []);
        }
      }
    }
    this.applyReplayMotion(state, replayMotion);
  }

  renderScenarioState(state) {
    this.clearReplayMotionClasses();
    this.lastReplayMotionToken = null;
    if (state.activePlayers && state.activePlayers !== this.currentActivePlayers) {
      this.currentActivePlayers = state.activePlayers;
      this.drawSeats(this.currentActivePlayers);
    }
    const phase = this.container.querySelector('#table-phase-status');
    if (phase) phase.textContent = tableMessage('table.phase.scenario', 'Scenario');
    const description = this.container.querySelector('#poker-table-description');
    if (description) description.textContent = tableMessage('table.a11y.scenario', 'Lossy Scenario table presentation');
    const potText = this.container.querySelector('#table-pot');
    if (potText && state.pot !== undefined) {
      potText.removeAttribute('hidden');
      this.setPokerAmount(potText, {
        prefix: tableMessage('table.potLabel', 'Pot'), value: state.pot, unit: 'bb', ariaHidden: true,
      });
    }

    for (let i = 0; i < this.currentActivePlayers; i++) {
      const seat = this.container.querySelector(`#seat-${i}`);
      const dealer = this.container.querySelector(`#dealer-${i}`);
      const name = seat?.querySelector('.table-seat-name');
      const position = this.container.querySelector(`#seat-position-${i}`);
      const stack = this.container.querySelector(`#seat-stack-${i}`);
      const status = this.container.querySelector(`#seat-status-${i}`);
      const contribution = this.container.querySelector(`#contribution-${i}`);
      const action = this.container.querySelector(`#action-${i}`);
      const holeCards = this.container.querySelector(`#hole-cards-${i}`);
      const playerState = Array.isArray(state.players)
        ? state.players.find((player) => player?.seat === i || player?.seatIndex === i)
        : null;
      const isDealer = state.dealerPos === i;
      const isActor = false;
      const isHero = playerState ? Boolean(playerState.isHero) : i === 0;

      if (dealer) dealer.toggleAttribute('hidden', !isDealer);
      if (name) name.textContent = playerState?.name || (isHero ? tableMessage('Hero', 'Hero') : `P${i + 1}`);
      if (position) position.textContent = '';
      if (stack) this.setPokerAmount(stack, {
        value: Number.isFinite(playerState?.stackBb) ? playerState.stackBb : '',
        unit: Number.isFinite(playerState?.stackBb) ? 'bb' : '',
        ariaHidden: true,
      });
      if (status) status.setAttribute('hidden', '');
      if (contribution) contribution.setAttribute('hidden', '');
      if (action) action.setAttribute('hidden', '');
      if (seat) {
        seat.removeAttribute('aria-label');
        seat.classList.toggle('is-hero', isHero);
        seat.classList.toggle('is-dealer', isDealer);
        seat.classList.toggle('is-actor', isActor);
        seat.classList.toggle('is-folded', false);
        seat.classList.toggle('is-all-in', false);
      }
      if (holeCards) {
        if (isHero && Array.isArray(state.heroCards)) {
          this.renderKnownCards(holeCards, state.heroCards, `scenario-hole-${i}`, false);
        } else {
          holeCards.innerHTML = playerState?.hasCards
            ? `${this.renderCardBack(0)}${this.renderCardBack(1)}`
            : '';
        }
      }
    }

    const community = this.container.querySelector('#community-cards');
    if (community && state.board) this.renderKnownCards(community, state.board, 'community', true);
  }

  renderState(state) {
    // Presentation-only state: no betting order or poker semantics are inferred here.
    if (!state) return;
    this.lastState = state;
    const title = this.container.querySelector('#poker-table-title');
    if (title) title.textContent = tableMessage('table.title', 'Riverline poker table');
    const replayMotion = this.pendingReplayMotion;
    this.pendingReplayMotion = null;
    if (state.schemaVersion === 'table-presence/v1') this.renderPresenceState(state, replayMotion);
    else this.renderScenarioState(state);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.tableRenderer = new TableRenderer('visual-table-container');
});

window.TableRenderer = TableRenderer;
