# ♠️ Riverline — Poker GTO Workstation & AI Coach

![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)
![Languages](https://img.shields.io/badge/Languages-EN%20%7C%20RU%20%7C%20HE-blue.svg)
![Tech](https://img.shields.io/badge/Tech-HTML5%20%7C%20JS%20ES6%20%7C%20CSS3-orange.svg)

**Riverline** is a state-of-the-art, web-based Game Theory Optimal (GTO) Poker Workstation, Strategy Matrix Explorer, and AI Coaching Assistant. Designed for serious poker players, game-theory strategists, and poker analysts, Riverline combines preflop solver trees, multi-street strategy flowcharts, procedural audio feedback, and human-readable situational coaching with practical exploitative adjustments.

---

## 🎯 Mission & Core Features

Standard poker GTO solvers present complex frequency tables without explaining the underlying strategic rationale. When gameplay strays off the preflop explored decision tree, traditional solver software fails or returns undefined results.

**Riverline solves this by providing:**

1. **Instant, Accessible GTO Guidance:** Clear bottom-line action recommendations for every spot.
2. **13x13 Interactive Strategy Matrix:** Real-time matrix displaying frequencies (Raise, Call, Fold), EV heatmaps, and Equity % overlays for all 169 starting hands.
3. **Multi-Street Betting Tree Explorer:** Visual flowchart mapping hand strategies from Preflop to River with strategy mixes and board runouts.
4. **Contextual Explanations:** A "Smart Teacher" engine that breaks down hand strength, board texture, flush/straight draw threats, and opponent blockers in plain language.
5. **GTO Training Flashcards:** Practice mode with instant feedback on user decisions, correctly classifying errors into **Too Passive** vs. **Too Aggressive**.
6. **Authentic Slang i18n Engine:** Multilingual support across English, Russian (*Пот*, *Игрок*, *Фолд*, *Рейз*, *Бет*), and Hebrew (*פוט*, *שחקן*, *פולד*, *רייז*, *בט*).
7. **Procedural Web Audio Engine:** Realistic card deal, chip stack, and answer feedback SFX with auto-resume gesture unlocking.
8. **Dynamic Visual Themes:** 8 curated dark environments (Emerald Felt, Midnight Blue, Royal Purple, Amber Sunset, Cyberpunk Neon, Crimson Darkroom, Serious Pio, Monochrome).

---

## 🤖 DeepCFR Model & Mathematical Foundation

Riverline utilizes a hybrid decision engine powered by pre-computed solver trees and Deep Counterfactual Regret Minimization (DeepCFR) algorithms.

### 1. Counterfactual Regret Minimization (CFR)
Preflop solution matrices are generated using iterative CFR algorithms that compute Nash Equilibrium frequencies across all 169 starting hand combinations ($13 \times 13$ matrix). For each decision node, the expected value ($EV$) of each pure strategy (Raise, Call, Fold) is computed:

$$EV(a) = \sum_{s \in S} P(s) \cdot U(a, s)$$

Where $P(s)$ represents opponent strategy probability distributions and $U(a, s)$ is the utility payoff.

### 2. Off-Tree Fallback & Equity Realization (R-Factor)
When action strays outside the pre-computed solver tree, Riverline activates a dynamic Monte Carlo fallback engine:
* **Pot Odds:** Computes exact pot odds required to call:

$$\text{Pot Odds} = \frac{\text{Bet Size}}{\text{Current Pot} + \text{Bet Size}}$$

* **Minimum Defense Frequency (MDF):** Calculates the percentage of Hero's range that must defend to prevent Villain from profitably bluffing:

$$\text{MDF} = \frac{\text{Pot Size}}{\text{Pot Size} + \text{Bet Size}}$$

* **Equity Realization ($R$):** Adjusts raw equity based on position, hand connectivity, and board dynamics. In-position hands realize $>100\%$ equity ($R > 1.0$), while out-of-position capped ranges realize less ($R < 1.0$).

---

## 🎨 UI Design System & Aesthetic Architecture

Riverline features a modern, premium **Glassmorphism UI** tailored for high-focus poker analysis.

* **Curated Color Palettes:** Tailored HSL tokens for 8 distinct environments with full surface morphing.
* **Typography:** Clean sans-serif system stacks with monospace numeric readouts for exact percentages and stack sizes.
* **Responsive Multi-Tab Layout:** Dual-panel architecture featuring configuration controls on the left and dynamic tabbed analysis views on the right (Decision, Full Range Chart, Range Advantage, Betting Tree, AI Coach).
* **Single-Deck Picker Engine:** Visual card selector with support for 2-Color (Classic) and 4-Color (Pro) deck modes.

---

## 🏗️ Workspace Organization

```
poker-gto-app/
├── index.html            # Main HTML5 application markup and layout
├── styles.css            # Custom CSS token design system & visual theme variables
├── logic.js              # Core application controller, matrix renderer & solver math
├── teacher.js            # Explanatory reasoning engine & board texture parser
├── i18n.js               # Multi-language dictionary (EN / RU / HE) & slang engine
├── equity.worker.js      # Web Worker for async Monte Carlo equity calculations
├── trees/                # Pre-calculated GTO preflop solver JSON files
└── scripts/              # Python automation & audit tools
```

---

## 🚀 Getting Started

### Installation & Development
```bash
# Install dependencies
npm install

# Launch local Vite dev server
npm run dev

# Build production bundle
npm run build
```

---

## 📜 License

This project is released under the **MIT License**. Feel free to use, modify, and build upon this workstation for personal study or commercial applications.
