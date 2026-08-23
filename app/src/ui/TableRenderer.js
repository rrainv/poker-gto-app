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

const TABLE_FALLBACK_ANCHORS = Object.freeze({
  2: [[0.50, 0.91], [0.50, 0.09]],
  3: [[0.50, 0.91], [0.18, 0.20], [0.82, 0.20]],
  4: [[0.50, 0.91], [0.12, 0.48], [0.50, 0.09], [0.88, 0.48]],
  5: [[0.50, 0.91], [0.16, 0.62], [0.22, 0.18], [0.78, 0.18], [0.84, 0.62]],
  6: [[0.50, 0.91], [0.17, 0.66], [0.17, 0.23], [0.50, 0.09], [0.83, 0.23], [0.83, 0.66]],
  7: [[0.50, 0.91], [0.22, 0.76], [0.10, 0.45], [0.24, 0.14], [0.76, 0.14], [0.90, 0.45], [0.78, 0.76]],
  8: [[0.50, 0.91], [0.22, 0.76], [0.10, 0.47], [0.24, 0.15], [0.50, 0.07], [0.76, 0.15], [0.90, 0.47], [0.78, 0.76]],
  9: [[0.50, 0.91], [0.25, 0.79], [0.09, 0.56], [0.12, 0.27], [0.34, 0.09], [0.66, 0.09], [0.88, 0.27], [0.91, 0.56], [0.75, 0.79]],
  10: [[0.50, 0.91], [0.26, 0.80], [0.09, 0.59], [0.09, 0.33], [0.27, 0.13], [0.50, 0.06], [0.73, 0.13], [0.91, 0.33], [0.91, 0.59], [0.74, 0.80]],
});

function tableContributionPoint({ centerX, centerY, seatX, seatY, radialFraction = 0.5 }) {
  const idealX = seatX + ((centerX - seatX) * radialFraction);
  const idealY = seatY + ((centerY - seatY) * radialFraction);
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
    this.currentGeometrySignature = null;
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
    window.addEventListener('riverline:cardpresentationchange', () => {
      if (this.lastState) this.renderState(this.lastState);
      else this.drawSeats(this.currentActivePlayers);
    });
    window.addEventListener('riverline:languagechange', () => {
      if (this.lastState) this.renderState(this.lastState);
      else this.initSVG();
    });
  }

  initSVG() {
    this.container.innerHTML = `
      <svg id="poker-table-svg" class="riverline-poker-table" viewBox="0 0 1000 650" width="100%" role="img" aria-labelledby="poker-table-title" aria-describedby="poker-table-description" preserveAspectRatio="xMidYMid meet" dir="ltr">
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
          <pattern id="riverlineFeltTexture" width="12" height="12" patternUnits="userSpaceOnUse">
            <path class="table-felt-texture-mark" d="M1 2 L2 1 M8 10 L10 8" />
          </pattern>
          <filter id="riverlineTableShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow class="table-shadow-effect" dx="0" dy="7" stdDeviation="8" flood-opacity="0.28" />
          </filter>
          <filter id="riverlineCardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.22" />
          </filter>
        </defs>

        <rect id="table-rail-outer" class="table-rail table-rail--outer" x="90" y="98" width="820" height="416" rx="208" ry="208" aria-hidden="true" />
        <rect id="table-rail-inner" class="table-rail table-rail--inner" x="102" y="110" width="796" height="392" rx="196" ry="196" aria-hidden="true" />
        <rect id="table-surface" class="table-surface" x="114" y="122" width="772" height="368" rx="184" ry="184" aria-hidden="true" />
        <rect id="table-felt-texture" class="table-felt-texture" x="114" y="122" width="772" height="368" rx="184" ry="184" aria-hidden="true" />
        <rect id="table-betting-line" class="table-betting-line" x="146" y="154" width="708" height="304" rx="152" ry="152" aria-hidden="true" />
        <path id="table-riverline-mark" class="table-riverline-mark" d="M360 210 C418 180 582 180 640 210" aria-hidden="true" />

        <text id="table-phase-status" class="table-phase-status" x="500" y="238" text-anchor="middle"></text>
        ${this.pokerTableAmountMarkup({
          id: 'table-pot', className: 'table-pot', size: 'normal', x: 500, y: 286,
          prefix: tableMessage('table.potLabel', 'Pot'), value: '0', unit: 'bb', ariaHidden: true,
        })}
        <g id="community-cards" class="table-community-cards" transform="translate(500, 330)"></g>
        <g id="table-contributions-layer" class="table-contributions-layer"></g>
        <g id="seats-layer" class="table-seats-layer"></g>
      </svg>
    `;
    this.drawSeats();
  }

  drawSeats(activePlayers = 10, presentation = null) {
    const seatsLayer = this.container.querySelector('#seats-layer');
    const contributionsLayer = this.container.querySelector('#table-contributions-layer');
    if (!seatsLayer || !contributionsLayer) return;

    const centerX = (presentation?.geometry?.potAnchor?.x ?? 0.5) * 1000;
    const centerY = (presentation?.geometry?.potAnchor?.y ?? 0.48) * 650;
    const fallbackAnchors = TABLE_FALLBACK_ANCHORS[activePlayers] || TABLE_FALLBACK_ANCHORS[10];
    const unit = presentation?.geometry?.playerUnit || { width: activePlayers >= 7 ? 104 : 122, height: activePlayers >= 7 ? 62 : 70 };
    const cardScale = presentation?.geometry?.cardScale || (activePlayers < 3 ? 1.25 : activePlayers >= 7 ? 0.88 : 1);
    const cardOverlapUnits = Math.max(8, Math.round(unit.height * (presentation?.geometry?.cardOverlap ?? 0.24)));
    let seatsHtml = '';
    let contributionsHtml = '';
    seatsLayer.dataset.tableSize = String(activePlayers);
    contributionsLayer.dataset.tableSize = String(activePlayers);

    for (let i = 0; i < activePlayers; i++) {
      // Visual index zero is the stable Hero anchor. Turn order and the deliberate
      // 2-10 geometry are supplied by TablePresentation v1.
      const seatPresentation = presentation?.seats?.find((seat) => seat.visualSeatIndex === i);
      const normalizedAnchor = seatPresentation?.anchor || {
        x: fallbackAnchors[i][0], y: fallbackAnchors[i][1],
      };
      const x = Math.round(normalizedAnchor.x * 1000);
      const y = Math.round(normalizedAnchor.y * 650);
      const suppliedContribution = seatPresentation?.contributionAnchor;
      const contributionPoint = suppliedContribution
        ? { x: suppliedContribution.x * 1000, y: suppliedContribution.y * 650 }
        : tableContributionPoint({ centerX, centerY, seatX: x, seatY: y });
      const halfWidth = unit.width / 2;
      const halfHeight = unit.height / 2;
      const holeCardY = Math.round(-halfHeight - (57 * cardScale) + cardOverlapUnits);
      const dealerX = Math.round(halfWidth + 12);
      const actionY = Math.round(halfHeight + 12);

      seatsHtml += `
        <g id="seat-${i}" class="table-seat table-player-unit${i === 0 ? ' is-hero' : ''}" data-seat-index="${i}" data-card-anchor="integrated" transform="translate(${x}, ${y})">
          <g id="hole-cards-${i}" class="table-hole-cards" transform="translate(0, ${holeCardY}) scale(${cardScale})" aria-hidden="true">${i === 0 ? '' : `${this.renderCardBack(0)}${this.renderCardBack(1)}`}</g>
          <g class="table-seat-info">
            <rect class="table-seat-surface" x="${-halfWidth}" y="${-halfHeight}" width="${unit.width}" height="${unit.height}" rx="12" aria-hidden="true" />
            <path class="table-actor-indicator" d="M${Math.round(-halfWidth + 10)} ${Math.round(-halfHeight + 7)} H${Math.round(halfWidth - 10)}" aria-hidden="true" />
            <text class="table-seat-name" x="0" y="${Math.round(-halfHeight + 18)}" text-anchor="middle">${i === 0 ? tableMessage('Hero', 'Hero') : `P${i + 1}`}</text>
            <text id="seat-position-${i}" class="table-seat-meta table-seat-position" x="0" y="${Math.round(-halfHeight + 31)}" text-anchor="middle"></text>
            ${this.pokerAmountMarkup({
              id: `seat-stack-${i}`, className: 'table-seat-meta table-seat-stack',
              size: 'small', x: -38, y: Math.round(-halfHeight + 34), unit: '', ariaHidden: true,
            })}
            <text id="seat-status-${i}" class="table-seat-meta table-seat-status" x="0" y="${Math.round(halfHeight - 7)}" text-anchor="middle" hidden></text>
          </g>
          <g id="dealer-${i}" class="table-dealer-button" transform="translate(${dealerX}, 0)" hidden>
            <circle r="12" aria-hidden="true" />
            <circle class="table-dealer-button-inner" r="8.5" aria-hidden="true" />
            <text id="dealer-txt-${i}" x="0" y="3.5" text-anchor="middle" aria-hidden="true">D</text>
          </g>
          <g id="action-${i}" class="table-action-badge" transform="translate(0, ${actionY})" hidden aria-hidden="true">
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
    const presentation = globalThis.RiverlineCardPresentation;
    if (!presentation) throw new Error('Riverline card presentation must load before TableRenderer');
    return presentation.tableCardSvgMarkup({
      rank,
      suit,
      index,
      totalCards,
      isCommunity,
      isDealing,
      rankStyle: document.documentElement.dataset.cardRankStyle,
      faceStyle: document.documentElement.dataset.cardFaceStyle,
    });
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
    const presentation = globalThis.RiverlineCardPresentation;
    if (!presentation) throw new Error('Riverline card presentation must load before TableRenderer');
    return presentation.tableCardBackSvgMarkup({ index });
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

  setTableRoundedRect(selector, rect, inset = 0) {
    const element = this.container.querySelector(selector);
    if (!element) return;
    const x = rect.x + inset;
    const y = rect.y + inset;
    const width = Math.max(0, rect.width - (inset * 2));
    const height = Math.max(0, rect.height - (inset * 2));
    const radius = height / 2;
    element.setAttribute('x', String(x));
    element.setAttribute('y', String(y));
    element.setAttribute('width', String(width));
    element.setAttribute('height', String(height));
    element.setAttribute('rx', String(radius));
    element.setAttribute('ry', String(radius));
  }

  resetTableGeometry() {
    this.setTableRoundedRect('#table-rail-outer', { x: 90, y: 98, width: 820, height: 416 });
    this.setTableRoundedRect('#table-rail-inner', { x: 102, y: 110, width: 796, height: 392 });
    this.setTableRoundedRect('#table-surface', { x: 114, y: 122, width: 772, height: 368 });
    this.setTableRoundedRect('#table-felt-texture', { x: 114, y: 122, width: 772, height: 368 });
    this.setTableRoundedRect('#table-betting-line', { x: 146, y: 154, width: 708, height: 304 });
    const phase = this.container.querySelector('#table-phase-status');
    phase?.setAttribute('x', '500');
    phase?.setAttribute('y', '238');
    this.container.querySelector('#table-pot')?.setAttribute('transform', 'translate(500 286)');
    this.container.querySelector('#community-cards')?.setAttribute('transform', 'translate(500, 330)');
    this.container.querySelector('#table-riverline-mark')
      ?.setAttribute('d', 'M360 210 C418 180 582 180 640 210');
  }

  applyPresentationGeometry(presentation) {
    if (!presentation) return;
    this.container.dataset.tableProjection = presentation.projection;
    this.container.dataset.tableVisualState = presentation.visualState;
    this.container.dataset.tableInteraction = presentation.interaction;
    this.container.dataset.tableCompleted = String(presentation.completed);
    if (!presentation.geometry) {
      this.resetTableGeometry();
      delete this.container.dataset.tableGeometryFamily;
      return;
    }
    const { geometry } = presentation;
    const bounds = geometry.tableBounds;
    const potX = geometry.potAnchor.x * 1000;
    const potY = geometry.potAnchor.y * 650;
    this.setTableRoundedRect('#table-rail-outer', bounds);
    this.setTableRoundedRect('#table-rail-inner', bounds, 10);
    this.setTableRoundedRect('#table-surface', bounds, 20);
    this.setTableRoundedRect('#table-felt-texture', bounds, 20);
    this.setTableRoundedRect('#table-betting-line', bounds, 50);
    const phase = this.container.querySelector('#table-phase-status');
    if (phase) {
      phase.setAttribute('x', String(potX));
      phase.setAttribute('y', String(Math.max(bounds.y + 44, potY - 72)));
    }
    this.container.querySelector('#table-pot')
      ?.setAttribute('transform', `translate(${potX} ${potY})`);
    this.container.querySelector('#community-cards')
      ?.setAttribute('transform', `translate(${potX}, ${potY + 34}) scale(${geometry.boardScale})`);
    const mark = this.container.querySelector('#table-riverline-mark');
    if (mark) {
      const left = potX - (bounds.width * 0.15);
      const right = potX + (bounds.width * 0.15);
      const y = bounds.y + (bounds.height * 0.28);
      mark.setAttribute('d', `M${left} ${y} C${potX - 52} ${y - 24} ${potX + 52} ${y - 24} ${right} ${y}`);
    }
    this.container.dataset.tableGeometryFamily = presentation.geometryFamily;
  }

  renderPresenceState(state, replayMotion = null, presentation = null) {
    const activePlayers = state.seats.length;
    const geometrySignature = presentation
      ? `${presentation.geometryTemplate}:${presentation.geometry?.potAnchor?.y}`
      : `legacy:${activePlayers}`;
    if (activePlayers !== this.currentActivePlayers
      || geometrySignature !== this.currentGeometrySignature) {
      this.currentActivePlayers = activePlayers;
      this.currentGeometrySignature = geometrySignature;
      this.drawSeats(activePlayers, presentation);
      if (!presentation) this.resetTableGeometry();
    }
    this.applyPresentationGeometry(presentation);
    const presentationSeats = new Map(
      (presentation?.seats || []).map((seat) => [seat.playerId, seat]),
    );
    const replayProjected = presentation
      ? presentation.interaction === 'replay'
      : this.container.closest('.table-wrapper')?.dataset.replayMode === 'replay';

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
      const seatPresentation = presentationSeats.get(player.playerId) || null;
      const prominence = seatPresentation?.prominence || (
        isHero ? 'hero' : isActor ? 'actor' : player.isFolded ? 'folded' : 'live'
      );

      seat.dataset.canonicalSeat = String(player.seat);
      seat.dataset.playerId = player.playerId;
      seat.setAttribute('role', 'group');
      seat.setAttribute('aria-label', this.presenceSeatDescription(player));
      seat.classList.toggle('is-hero', isHero);
      seat.classList.toggle('is-dealer', isDealer);
      seat.classList.toggle('is-actor', isActor);
      seat.classList.toggle('is-folded', player.isFolded);
      seat.classList.toggle('is-all-in', player.isAllIn);
      for (const role of ['hero', 'actor', 'relevant', 'live', 'folded', 'empty']) {
        seat.classList.toggle(`is-prominence-${role}`, prominence === role);
      }
      seat.dataset.prominence = prominence;
      seat.dataset.seatDetail = seatPresentation?.detail || 'standard';
      seat.style.setProperty('--seat-prominence-opacity', String(seatPresentation?.opacity ?? 1));
      seat.dataset.cardEmphasis = seatPresentation?.cardEmphasis || 'standard';
      seat.dataset.contributionEmphasis = seatPresentation?.contributionEmphasis || 'standard';

      if (name) {
        name.textContent = this.presenceSeatIdentity(player);
        if (name.textContent.length > 15) {
          name.setAttribute('textLength', String(Math.max(82, (presentation?.geometry?.playerUnit?.width ?? 104) - 12)));
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
        contribution.dataset.prominence = prominence;
        contribution.style.setProperty('--contribution-prominence-opacity', String(
          prominence === 'folded' ? 0.5 : prominence === 'hero' || prominence === 'actor' ? 1 : 0.86
        ));
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
    const scenarioGeometrySignature = `scenario:${state.activePlayers || this.currentActivePlayers}`;
    if (state.activePlayers && (state.activePlayers !== this.currentActivePlayers
      || scenarioGeometrySignature !== this.currentGeometrySignature)) {
      this.currentActivePlayers = state.activePlayers;
      this.currentGeometrySignature = scenarioGeometrySignature;
      this.drawSeats(this.currentActivePlayers);
      this.resetTableGeometry();
    }
    for (const key of [
      'tableProjection', 'tableVisualState', 'tableGeometryFamily',
      'tableInteraction', 'tableCompleted',
    ]) delete this.container.dataset[key];
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
    if (state.schemaVersion === 'table-presentation/v1') {
      this.renderPresenceState(state.tablePresence, replayMotion, state);
    } else if (state.schemaVersion === 'table-presence/v1') {
      this.renderPresenceState(state, replayMotion);
    }
    else this.renderScenarioState(state);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.tableRenderer = new TableRenderer('visual-table-container');
});

window.TableRenderer = TableRenderer;
