# First external-reference capture plan

This is a 42-observation design for the first user-collected GTO Wizard benchmark.
It specifies diagnostic cases, not GTO Wizard outputs. Use only solution families
legitimately visible to the collector. Record missing coverage as unsupported and
do not substitute an undisclosed nearby tree.

## Capture rules

- Prefer one internally consistent game family before broadening: same format,
  rake, blinds/ante, and nominal depth where possible.
- Record the visible presolved solution label, available sizes, and exact action
  tree before any hand values.
- If the original spot maps to a nearby stack or size, keep both values and mark
  it mapped. Never silently call it exact.
- For every postflop combo, capture both hand equity and action frequencies when
  visible. They are the main signal for separating sampling/range errors from
  policy errors.
- Capture range weight, EV by action, and EQR only when visible. Missing is valid.
- Use exact cards postflop. The listed suit choices are capture targets; if the
  solution's suit is impossible, choose and record one legitimate exact combo
  with the same intended structural property.

## Preflop: 24 observations

Capture four hands at each of six nodes. The set deliberately includes pure-value,
mixed/boundary, passive-candidate, and likely-fold regions; it is not a claim about
the reference action.

| IDs | Exact node to capture | Hands | Diagnostic value |
|---|---|---|---|
| P01-P04 | HU BTN first action | `AA`, `A5s`, `K9o`, `72o` | Baseline HU RFI shape, limp support, suited-wheel and bottom boundary. |
| P05-P08 | 6-max UTG RFI | `AA`, `AQs`, `99`, `76s` | Early-position table/position sensitivity and suited/pair boundaries. |
| P09-P12 | 6-max BTN RFI | `AA`, `A5s`, `K8s`, `Q9o` | Late-position width versus the UTG node without conflating table format. |
| P13-P16 | BB versus BTN open | `AA`, `A5s`, `KTo`, `72o` | Fold/call/3-bet split and response to the exact recorded open size. |
| P17-P20 | BTN versus BB 3-bet | `AA`, `AKs`, `JJ`, `A5s` | Call/4-bet/fold policy and exact prior-size mapping. |
| P21-P24 | BTN versus BB 4-bet | `AA`, `KK`, `AKs`, `QQ` | Shallow resulting SPR, jam/call/fold support, and premium dominated-action checks. |

For the BB/BTN response nodes, record every action as total-to versus raise-by
unambiguously. If GTO Wizard's available open/3-bet/4-bet size differs from the
Riverline node, capture it as a mapping and do not use level-3 sizing metrics.

## Postflop: 18 observations

Choose exact nodes available in the same solution family. “Small/medium/large”
describes the selection goal; the capture file must contain the exact visible size,
pot, call amount, and effective stack.

| ID | Property and exact combo/board target | Position / street / price / SPR target | Main diagnostic question |
|---|---|---|---|
| F01 | Dry top pair: `AsKd` on `Ah7d2c` | IP flop, checked to, medium SPR | If equity is close, does Riverline over/under-aggress top pair? |
| F02 | Dry weaker top pair: `A8s` on `Ah7d2c` with a legal exact suit | OOP flop, small price, medium SPR | Kicker sensitivity versus range/sampler sensitivity. |
| F03 | Weak pair: `8s8d` on `Jh7c2d` | OOP flop, large price, medium SPR | Price response and excessive continuation/folding. |
| F04 | Weak pair: `7s6s` on `Kh7d2c` | IP flop, checked to, deep SPR | Policy at low showdown value without price pressure. |
| F05 | Overpair: `KsKd` on `Qh7d2c` | IP flop, checked to, deep SPR | Value aggression independent of sampled-equity error. |
| F06 | Overpair: `JsJd` on `9h8d2c` | OOP flop, medium price, shallow SPR | Board texture plus commitment sensitivity. |
| F07 | Two pair: `As7s` on `Ah7d2c` with legal suits | IP flop, checked to, medium SPR | Strong-made-hand aggression floor. |
| F08 | Set or better: `7s7c` on `Ah7d2c` | OOP flop, large price, shallow SPR | Raise/call support and Riverline's absent postflop sizing. |
| F09 | Nut flush draw: `AsQs` on `Ks7s2d` | IP flop, checked to, deep SPR | Semibluff policy when draw equity is high. |
| F10 | Nut flush draw: `As5s` on `Ks8s2d` | OOP flop, large price, medium SPR | Sampler range construction versus continue/raise policy. |
| F11 | OESD: `9s8d` on `7h6c2d` | IP flop, checked to, deep SPR | Draw aggression without flush-draw overlap. |
| F12 | OESD: `9s8d` on `7h6cKd` | OOP turn, medium price, medium SPR | Turn sampling/runout and price policy. |
| F13 | Air with backdoors: `QsJs` on `Ah7s2d` | IP flop, checked to, deep SPR | Bluff aggression versus reference range interaction. |
| F14 | Low air: `9s4d` on `Kh7c2d` | OOP flop, small price, medium SPR | Cheap-price continuation/fold bias. |
| F15 | Air after missed draw: choose exact missed OESD | IP river, checked to, shallow SPR | River bluff policy where equity is near zero. |
| T01 | Dry top pair carried to turn | IP turn, checked to, medium SPR | Whether the flop policy difference persists after one runout. |
| T02 | Two pair or better facing a turn raise | OOP turn, large price, shallow SPR | Action-support and commitment transformation. |
| R01 | Bluff-catcher weak pair facing river bet | OOP river, large price, shallow SPR | Exact price threshold with no future-card sampling. |

The exact combo must not collide with the board. For rows with “legal suits,” pick
one physical combo exposed by the reference and store those cards; do not collapse
the result back to a hand-class label.

## Recommended capture order

1. P01-P04 and P13-P16 establish HU action vocabulary and size mappings.
2. F01, F03, F09, F11, F13, and R01 create the first equity-versus-policy
   diagnostic cross-section.
3. P05-P12 establish 6-max position sensitivity.
4. P17-P24 cover 3-bet/4-bet response trees after prior sizes are verified.
5. Complete the remaining postflop price, position, SPR, and street pairs.

After the first 12 observations, run the benchmark before collecting the rest.
This catches schema or solution-mapping mistakes while they are still cheap to fix.
Do not tune Riverline from the partial result.

## Interpretation priorities

- Comparable equity close, strategy far across several hands in one node: inspect
  policy thresholds and action transformation.
- Equity far in the same direction across made hands, draws, and air: inspect the
  assumed opponent range, weighting, dead-card removal, evaluator parity, and seed/
  sampling behavior.
- Divergence only at large price or shallow SPR: inspect exact call-price and live-
  stack consumption before broad strategy changes.
- Divergence only in IP/OOP pairs: inspect position adjustment.
- Level-1/2 agreement with blocked level 3: record an action-support/sizing gap, not
  exact strategy agreement.
- A single observation never establishes GTO correctness, exploitability, EV loss,
  or a production reference-pack authority.

