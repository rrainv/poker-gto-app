# 🚀 DeepCFR Neural Solver Optimization & Retraining Blueprint

This document contains the complete mathematical and algorithmic specifications to optimize and retrain Riverline's DeepCFR Neural Solver on a single GPU (e.g. NVIDIA GTX 1660 Super / RTX series).

---

## 📊 Target Specs & Capability Projections (50-Hour Training Run)

| Parameter | Optimized Value |
| :--- | :--- |
| **Preflop Accuracy** | **100% Solved Nash Equilibrium** (169 hands, 2–8 max tables, 0–150bb continuous stack depth). |
| **Flop Coverage** | **1,755 Canonical Flop Classes** (maps to all 22,100 raw 3-card flops with suit isomorphism). |
| **Turn Card Runout Coverage** | **~88–92% Neural Generalization** across 85,995 canonical turn board textures. |
| **Model Size** | **~4.8 MB to 8 MB `.onnx` model binary** running at 60 FPS in web client. |

---

## 🛠️ Architectural & Algorithmic Optimizations

### 1. Suit Isomorphism Canonization (12.6× Scale Reduction)
- Map 22,100 raw 3-card flops into 1,755 canonical suit classes:
  - $A\spades K\spades Q\spades \equiv A\heartsuit K\heartsuit Q\heartsuit \equiv A\clubsuit K\clubsuit Q\clubsuit$
- Project canonical strategy outputs back to raw game states seamlessly.

### 2. Continuous Input Feature Embeddings (Zero Sudden Falloff Bugs)
- All features are continuous floats normalized in $[0, 1]$:
  $$\text{norm\_stack} = \frac{\text{stack}}{150.0}, \quad \text{norm\_spr} = \frac{\text{stack}}{\text{pot}}, \quad \text{norm\_facing} = \frac{\text{facing\_size}}{\text{pot}}$$
- Eliminates step-function bugs (`< 20bb` vs `> 20bb`).

### 3. Discounted Counterfactual Regret Minimization (DCFR)
- Decay parameters: $\alpha = 1.5, \beta = 0.5, \gamma = 2.0$.
- Speeds up convergence by **5× to 10×** over standard CFR.

### 4. GTO Monotonicity & MDF Regularization Losses
- `pot_commitment_loss`: Enforce calls/shoves when SPR $< 0.5$ or equity $> 80\%$.
- `mdf_floor_loss`: Prevent defense frequency from dropping below Minimum Defense Frequency ($\text{MDF} = \frac{\text{Pot}}{\text{Pot} + \text{Bet}}$).
- `monotonicity_loss`: Stronger hand combos preserve higher or equal aggression ranks.

---

## 🚀 Master Execution Agent Prompt

```markdown
# ULTIMATE AGENT PROMPT: DEEPCFR NEURAL SOLVER OPTIMIZATION & RETRAINING

You are tasked with executing a complete mathematical and algorithmic upgrade to the DeepCFR Poker Solver training pipeline (`solver-model/train.py`).

## MISSION OBJECTIVE
Optimize and retrain the DeepCFR PyTorch neural network to achieve continuous, high-accuracy strategy inference across all 1,755 canonical flop classes, 169 starting hands, and continuous parameter ranges (0-150bb stack depth, 2-8 max tables, all positions, continuous bet sizes) with ZERO sudden strategy falloff bugs.

## MATHEMATICAL & CODE OPTIMIZATIONS TO IMPLEMENT

1. Suit Isomorphism Engine (1,755 Canonical Flops):
   - Implement canonicalize_flop(cards): Map all 22,100 raw 3-card flops to the 1,755 unique canonical classes.
   - Implement suit-permutation mappings to project canonical outputs back to raw game states seamlessly.

2. Continuous Input Feature Embeddings (Zero Falloffs):
   - Normalize all inputs as continuous floats: norm_stack = stack / 150.0, norm_spr = stack / pot, norm_facing = facing_size / pot.
   - Use Continuous Softmax / Sigmoid output heads with Smooth L1 + Cross Entropy Loss to guarantee smooth strategy transitions without step-function bugs.

3. Discounted Counterfactual Regret Minimization (DCFR):
   - Implement DCFR algorithm in cfr.py with decay parameters alpha=1.5, beta=0.5, gamma=2.0.
   - Maintain cumulative positive regrets (R+) and average strategies (sigma_bar) per node.

4. Monotonicity & GTO Constraint Loss Regularization:
   - Implement custom loss functions in model.py:
     - pot_commitment_loss: Enforce call/shove when SPR < 0.5 or equity > 80%.
     - mdf_floor_loss: Prevent range defense frequency from dropping below MDF.
     - monotonicity_loss: Ensure strictly stronger hand combos preserve higher or equal aggression ranks.

5. Unified Action Schema Fix:
   - Standardize action indices across all modules:
     - Index 0 = Fold
     - Index 1 = Call / Check
     - Index 2 = Raise / Bet
   - Fix target tensor indexing in train.py and export.py so neural network outputs map cleanly to frontend actions.

6. Vectorized PyTorch CUDA Batching:
   - Refactor generate_preflop_data() and training loops to compute tensor mini-batches on GPU/CPU in parallel tensor operations (torch.Tensor).

7. ONNX & Web Model Export:
   - Update export_onnx.py and export.py to generate updated gto_export.json and quantized model.onnx binaries for onnxruntime-web client execution.

## VERIFICATION REQUIREMENTS
- Run python train.py and verify continuous loss convergence without spikes.
- Run python export_onnx.py and verify .onnx model generation.
- Run npm run build to verify frontend client integration.
```
