class TableRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;
    this.initSVG();
    window.addEventListener('gameStateUpdate', (e) => this.renderState(e.detail));
  }

  initSVG() {
    this.container.innerHTML = `
      <svg id="poker-table-svg" viewBox="0 0 800 500" width="100%" height="auto" style="background: transparent;">
        <defs>
          <radialGradient id="tableGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" style="stop-color:#1e4c31;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0d2617;stop-opacity:1" />
          </radialGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="5" stdDeviation="5" flood-opacity="0.5"/>
          </filter>
        </defs>
        
        <!-- Table Base -->
        <rect x="50" y="50" width="700" height="400" rx="200" ry="200" fill="#3a1e04" filter="url(#shadow)" />
        <rect x="70" y="70" width="660" height="360" rx="180" ry="180" fill="url(#tableGradient)" />
        
        <!-- Inner Table Line -->
        <rect x="100" y="100" width="600" height="300" rx="150" ry="150" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" />
        
        <!-- Pot text -->
        <text id="table-pot" x="400" y="220" font-family="Arial" font-size="24" font-weight="bold" fill="#fff" text-anchor="middle">Pot: 0</text>
        
        <!-- Community Cards Anchor -->
        <g id="community-cards" transform="translate(250, 240)"></g>
        
        <!-- Seats and Hole Cards Anchors -->
        <g id="seats-layer"></g>
      </svg>
    `;

    this.drawSeats();
  }

  drawSeats() {
    const seatsLayer = this.container.querySelector('#seats-layer');
    // Positions for 10-max around an oval
    // Center is (400, 250), Radii are ~380, 240
    const positions = [
      { x: 400, y: 460 }, // 0: Bottom Center (Hero typically)
      { x: 200, y: 440 }, // 1: Bottom Left
      { x: 60, y: 250 },  // 2: Left Center
      { x: 200, y: 60 },  // 3: Top Left
      { x: 340, y: 30 },  // 4: Top Center Left
      { x: 460, y: 30 },  // 5: Top Center Right
      { x: 600, y: 60 },  // 6: Top Right
      { x: 740, y: 250 }, // 7: Right Center
      { x: 600, y: 440 }, // 8: Bottom Right
      { x: 500, y: 460 }  // 9: Bottom Center Right
    ];

    let html = '';
    positions.forEach((pos, i) => {
      html += `
        <g id="seat-${i}" transform="translate(${pos.x}, ${pos.y})">
          <circle cx="0" cy="0" r="25" fill="#2b2d31" stroke="#5865f2" stroke-width="2" filter="url(#shadow)"/>
          <text x="0" y="5" font-family="Arial" font-size="12" font-weight="bold" fill="#fff" text-anchor="middle">P${i+1}</text>
          <!-- Dealer Button Placeholder -->
          <circle id="dealer-${i}" cx="-30" cy="-20" r="10" fill="#fff" stroke="#000" stroke-width="1" style="display:none;" />
          <text id="dealer-txt-${i}" x="-30" y="-16" font-family="Arial" font-size="10" font-weight="bold" fill="#000" text-anchor="middle" style="display:none;">D</text>
          
          <!-- Hole Cards Anchors -->
          <g id="hole-cards-${i}" transform="translate(0, -60)"></g>
        </g>
      `;
    });
    seatsLayer.innerHTML = html;
  }

  renderCard(rank, suit, index, isCommunity = false) {
    const w = 40, h = 60;
    const colors = { '♥': '#e74c3c', '♦': '#3498db', '♣': '#2ecc71', '♠': '#f2f3f5' };
    const color = colors[suit] || '#fff';
    // Starting position for animation (center of table)
    let startX = isCommunity ? 150 : 400;
    let startY = isCommunity ? 0 : 250;
    
    // Target position
    let targetX = isCommunity ? index * 50 : (index * 45) - 22;
    let targetY = 0;
    
    return `
      <g class="card-group" style="transform: translate(${startX}px, ${startY}px); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 0.1}s;">
        <rect x="0" y="0" width="${w}" height="${h}" rx="4" ry="4" fill="#fff" stroke="#ccc" filter="url(#shadow)"/>
        <text x="5" y="15" font-family="Arial" font-size="14" font-weight="bold" fill="${color}">${rank}</text>
        <text x="5" y="30" font-family="Arial" font-size="16" fill="${color}">${suit}</text>
      </g>
    `;
  }

  renderState(state) {
    // state = { pot: number, board: [{rank, suit}], heroCards: [{rank, suit}], dealerPos: number, activePlayers: number }
    if (!state) return;

    // 1. Update Pot
    const potText = this.container.querySelector('#table-pot');
    if (potText && state.pot !== undefined) {
      potText.textContent = `Pot: ${state.pot}`;
    }

    // 2. Update Dealer Button
    for (let i = 0; i < 10; i++) {
      const d = this.container.querySelector(`#dealer-${i}`);
      const dTxt = this.container.querySelector(`#dealer-txt-${i}`);
      if (d && dTxt) {
        if (state.dealerPos === i) {
          d.style.display = 'block';
          dTxt.style.display = 'block';
        } else {
          d.style.display = 'none';
          dTxt.style.display = 'none';
        }
      }
    }

    // 3. Render Hero Cards (Assuming Hero is always seat 0 for visual top-down representation)
    const heroHole = this.container.querySelector('#hole-cards-0');
    if (heroHole && state.heroCards) {
      let html = '';
      state.heroCards.forEach((card, idx) => {
        html += this.renderCard(card.rank, card.suit, idx, false);
      });
      heroHole.innerHTML = html;
      
      // Trigger animation after DOM update
      setTimeout(() => {
        const cards = heroHole.querySelectorAll('.card-group');
        cards.forEach((c, idx) => {
          c.style.transform = `translate(${(idx * 45) - 22}px, 0px)`;
        });
      }, 50);
    }

    // 4. Render Community Cards
    const community = this.container.querySelector('#community-cards');
    if (community && state.board) {
      let html = '';
      state.board.forEach((card, idx) => {
        html += this.renderCard(card.rank, card.suit, idx, true);
      });
      community.innerHTML = html;

      // Trigger animation
      setTimeout(() => {
        const cards = community.querySelectorAll('.card-group');
        cards.forEach((c, idx) => {
          c.style.transform = `translate(${idx * 50}px, 0px)`;
        });
      }, 50);
    }
  }
}

// Initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
  window.tableRenderer = new TableRenderer('visual-table-container');
});

window.TableRenderer = TableRenderer;
