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

class TableRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.currentActivePlayers = 10;
    this.lastState = null;
    this.initSVG();
    window.addEventListener('gameStateUpdate', (e) => this.renderState(e.detail));
    window.addEventListener('riverlineCardRankStyleChanged', () => {
      if (this.lastState) this.renderState(this.lastState);
    });
  }

  initSVG() {
    this.container.innerHTML = `
      <svg id="poker-table-svg" class="riverline-poker-table" viewBox="0 -40 800 560" width="100%" role="img" aria-labelledby="poker-table-title" preserveAspectRatio="xMidYMid meet">
        <title id="poker-table-title">Riverline poker table</title>
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
            <feDropShadow dx="0" dy="7" stdDeviation="8" flood-opacity="0.28"/>
          </filter>
          <filter id="riverlineCardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.22"/>
          </filter>
        </defs>

        <rect class="table-rail" x="50" y="50" width="700" height="400" rx="200" ry="200" />
        <rect class="table-surface" x="70" y="70" width="660" height="360" rx="180" ry="180" />
        <rect class="table-betting-line" x="100" y="100" width="600" height="300" rx="150" ry="150" />
        <path class="table-riverline-mark" d="M286 176 C342 146 458 146 514 176" />

        <text id="table-pot" class="table-pot" x="400" y="220" text-anchor="middle">Pot 0 bb</text>
        <g id="community-cards" class="table-community-cards" transform="translate(250, 240)"></g>
        <g id="seats-layer" class="table-seats-layer"></g>
      </svg>
    `;

    this.drawSeats();
  }

  drawSeats(activePlayers = 10) {
    const seatsLayer = this.container.querySelector('#seats-layer');
    if (!seatsLayer) return;

    const centerX = 400;
    const centerY = 250;
    const rx = 340;
    const ry = 210;

    let html = '';
    for (let i = 0; i < activePlayers; i++) {
      // Seat zero remains the visual hero anchor; poker turn order is not derived here.
      const angle = (Math.PI / 2) + (i * (2 * Math.PI / activePlayers));
      const x = Math.round(centerX + rx * Math.cos(angle));
      const y = Math.round(centerY + ry * Math.sin(angle));

      html += `
        <g id="seat-${i}" class="table-seat${i === 0 ? ' is-hero' : ''}" data-seat-index="${i}" transform="translate(${x}, ${y})">
          <rect class="table-seat-surface" x="-31" y="-19" width="62" height="38" rx="10" />
          <text class="table-seat-name" x="0" y="1" text-anchor="middle">${i === 0 ? 'Hero' : `P${i + 1}`}</text>
          <text id="seat-meta-${i}" class="table-seat-meta" x="0" y="12" text-anchor="middle" hidden></text>
          <g id="dealer-${i}" class="table-dealer-button" transform="translate(-30, -27)" hidden>
            <circle r="10" />
            <text id="dealer-txt-${i}" x="0" y="3.5" text-anchor="middle">D</text>
          </g>
          <g id="hole-cards-${i}" class="table-hole-cards" transform="translate(0, -67)">${i === 0 ? '' : `${this.renderCardBack(0)}${this.renderCardBack(1)}`}</g>
        </g>
      `;
    }
    seatsLayer.innerHTML = html;
  }

  renderCard(rank, suit, index, isCommunity = false) {
    const presentation = TABLE_SUIT_PRESENTATION[suit] || { id: 'unknown', symbol: suit || '?' };
    const visualRank = rank === 'T' && document.documentElement.dataset.cardRankStyle === 'full-ten' ? '10' : rank;
    const rankClass = visualRank === '10' ? ' table-card-rank--ten' : '';
    const startX = isCommunity ? 150 : 400;
    const startY = isCommunity ? 0 : 250;

    return `
      <g class="card-group poker-card-svg riverline-card card--known card--suit-${presentation.id}" data-card-state="known" style="transform: translate(${startX}px, ${startY}px); transition-delay: ${index * 70}ms;">
        <rect class="riverline-card-face table-card-face" x="0" y="0" width="40" height="57" rx="5" ry="5" />
        <text class="riverline-card-rank table-card-rank${rankClass}" x="6" y="17">${visualRank}</text>
        <text class="riverline-card-suit table-card-suit" x="6" y="35">${presentation.symbol}</text>
        <text class="riverline-card-corner-rank table-card-corner-rank${rankClass}" x="34" y="51" text-anchor="end" transform="rotate(180 34 51)">${visualRank}</text>
      </g>
    `;
  }

  renderCardBack(index) {
    return `
      <g class="table-card-back poker-card-svg poker-card-back" data-card-state="unknown" transform="translate(${(index * 25) - 20}, 0)">
        <rect class="table-card-back-face" x="0" y="0" width="40" height="58" rx="4" ry="4" />
        <path class="table-card-back-line" d="M7 17 C15 11 25 11 33 17 M7 41 C15 47 25 47 33 41" />
        <text class="table-card-back-mark" x="20" y="34" text-anchor="middle">R</text>
      </g>
    `;
  }

  renderState(state) {
    // Presentation-only state: no betting order or poker semantics are inferred here.
    if (!state) return;
    this.lastState = state;

    if (state.mode === 'hand' && state.empty) {
      this.currentActivePlayers = 0;
      this.drawSeats(0);
      const emptyPot = this.container.querySelector('#table-pot');
      const emptyBoard = this.container.querySelector('#community-cards');
      if (emptyPot) emptyPot.textContent = 'Start a hand';
      if (emptyBoard) emptyBoard.innerHTML = '';
      return;
    }

    if (state.activePlayers && state.activePlayers !== this.currentActivePlayers) {
      this.currentActivePlayers = state.activePlayers;
      this.drawSeats(this.currentActivePlayers);
    }

    const potText = this.container.querySelector('#table-pot');
    if (potText && state.pot !== undefined) {
      potText.textContent = `Pot ${state.pot} bb`;
    }

    for (let i = 0; i < this.currentActivePlayers; i++) {
      const seat = this.container.querySelector(`#seat-${i}`);
      const dealer = this.container.querySelector(`#dealer-${i}`);
      const meta = this.container.querySelector(`#seat-meta-${i}`);
      const name = seat?.querySelector('.table-seat-name');
      const holeCards = this.container.querySelector(`#hole-cards-${i}`);
      const playerState = Array.isArray(state.players)
        ? state.players.find((player) => player?.seat === i || player?.seatIndex === i)
        : null;
      const isDealer = state.dealerPos === i;
      const isActor = state.actorPos === i || state.currentActor === i;
      const isHero = playerState ? Boolean(playerState.isHero) : i === 0;

      if (dealer) dealer.toggleAttribute('hidden', !isDealer);
      if (name) name.textContent = playerState?.name || (isHero ? 'Hero' : `P${i + 1}`);
      if (meta) {
        const details = [];
        if (Number.isFinite(playerState?.stackBb)) details.push(`${playerState.stackBb} bb`);
        if (Number.isFinite(playerState?.streetContributionBb)) details.push(`street ${playerState.streetContributionBb}`);
        if (Number.isFinite(playerState?.totalContributionBb)) details.push(`hand ${playerState.totalContributionBb}`);
        meta.textContent = details.join(' · ');
        meta.toggleAttribute('hidden', details.length === 0);
      }
      if (seat) {
        seat.classList.toggle('is-hero', isHero);
        seat.classList.toggle('is-dealer', isDealer);
        seat.classList.toggle('is-actor', isActor);
        seat.classList.toggle('is-folded', Boolean(playerState?.folded));
        seat.classList.toggle('is-all-in', Boolean(playerState?.allIn || playerState?.isAllIn));
      }
      if (holeCards && state.mode === 'hand') {
        if (isHero && Array.isArray(state.heroCards)) {
          holeCards.innerHTML = state.heroCards
            .map((card, index) => this.renderCard(card.rank, card.suit, index, false))
            .join('');
          setTimeout(() => {
            holeCards.querySelectorAll('.card-group').forEach((card, index) => {
              card.style.transform = `translate(${(index * 45) - 22}px, 0px)`;
            });
          }, 50);
        } else {
          holeCards.innerHTML = playerState?.hasCards
            ? `${this.renderCardBack(0)}${this.renderCardBack(1)}`
            : '';
        }
      }
    }

    const heroSeat = Number.isInteger(state.heroSeat) ? state.heroSeat : 0;
    const heroHole = this.container.querySelector(`#hole-cards-${heroSeat}`);
    if (heroHole && state.mode !== 'hand' && state.heroCards) {
      heroHole.innerHTML = state.heroCards
        .map((card, idx) => this.renderCard(card.rank, card.suit, idx, false))
        .join('');
      setTimeout(() => {
        heroHole.querySelectorAll('.card-group').forEach((card, idx) => {
          card.style.transform = `translate(${(idx * 45) - 22}px, 0px)`;
        });
      }, 50);
    }

    const community = this.container.querySelector('#community-cards');
    if (community && state.board) {
      community.innerHTML = state.board
        .map((card, idx) => this.renderCard(card.rank, card.suit, idx, true))
        .join('');
      setTimeout(() => {
        community.querySelectorAll('.card-group').forEach((card, idx) => {
          card.style.transform = `translate(${idx * 50}px, 0px)`;
        });
      }, 50);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.tableRenderer = new TableRenderer('visual-table-container');
});

window.TableRenderer = TableRenderer;
