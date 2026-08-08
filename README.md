<h1 align="center">Riverline Poker GTO Workstation</h1>

<p align="center">
  <strong>An open-source, dual-engine poker strategy workstation powered by PyTorch and Vanilla JS.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" />
  <img src="https://img.shields.io/badge/ONNX-005CED?style=for-the-badge&logo=onnx&logoColor=white" />
  <img src="https://img.shields.io/badge/Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" />
</p>

![App Screenshot](assets/screenshot1.png)

## Architecture Overview
Riverline Poker GTO Workstation operates on a powerful dual-engine design:
1. **Python/PyTorch CFR Backend:** A high-performance Counterfactual Regret Minimization engine that solves multi-way poker situations and exports lightweight ONNX models.
2. **Vanilla JS Frontend:** A zero-build-step, hyper-optimized frontend that leverages `ort-wasm` to run the neural net locally within the browser/Electron wrapper. It relies heavily on Web Workers and typed arrays to guarantee a Zero-GC footprint and buttery smooth 60fps UX.

## Features
- **Multi-Way Pot Logic:** Fully evaluates hero against multiple active villains to detect split pots and multi-way equity properly.
- **Zero-GC Web Workers:** The Monte Carlo equity simulation relies on surgically overwritten `Int32Array` buffers, completely eliminating JavaScript heap allocation and garbage collection stalls.
- **JS Fallback Heuristics:** The UI operates elegantly even when neural networks aren't loaded, falling back to a deterministic 0ms latency preflop/postflop hand strength evaluator.
- **Audio Feedback & Premium Polish:** Complete HTML5 Audio SoundManager, GPU-composited CSS transforms, and pristine layout styling.
- **Native Localization:** Authentic transliterated poker slang and grammatically perfect pluralizations built on `Intl.PluralRules` for global languages.

## Installation

### Prerequisites
- Node.js (v18+)
- Python 3.10+

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Riverline-Poker/GTO-Workstation.git
   cd GTO-Workstation
   ```

2. Install JavaScript dependencies:
   ```bash
   npm install
   ```

3. Setup the Python environment and run the local server:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   pip install -r requirements.txt
   python server.py
   ```

4. Launch the application (in a separate terminal):
   ```bash
   npm start
   ```

## Contributing
Please see `CONTRIBUTING.md` for our Conventional Commits workflow and branching strategies.
