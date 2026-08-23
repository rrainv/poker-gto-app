# Table Presence competitive reference and implementation brief

Ticket: `TABLE-PRESENCE-REF-001`

Status: research and design brief for `TABLE-PRESENCE-002`

Research date: August 23, 2026

Product boundary: presentation only; no poker, strategy, Training-grading, Equity, or persistence changes

## 1. Outcome

Riverline should not make one table composition serve every job. The next implementation should keep one canonical Hand and one canonical Table Presence/Replay path, then project them differently:

- **Play:** the table, current actor, Hero, and legal decision own the screen.
- **Post-hand review:** the chronological hand story and Hero decisions own the screen; the table supports the selected event.
- **Deep analyze:** strategy, ranges, explanation, evidence, provenance, and limitations own the screen; the table is a compact orientation aid.
- **Saved inspection:** the selected saved Hand is a compact preview inside a future master-detail library; it is not a miniature Play workspace.

`TABLE-PRESENCE-002` should deliver the Play projection and the first post-hand/review projection, while establishing a non-persisted visual-projection seam for Analyze and Saved. It must reuse `PokerState`, `table-presence/v1`, `replay-projection/v1`, the current legal-action spec, Premium Card System v1, poker-chip primitives, presentation themes/density/layout presets, and reduced-motion handling.

Premium means a calm analytical workstation with strong physical relationships, not a casino simulation. The design target is a large, legible table; deliberate player-count geometry; clear seat hierarchy; chips and cards attached to poker meaning; a decision dock visually connected to Hero; and a post-hand composition that answers what happened before offering deeper study.

## 2. Evidence boundary and sources

This is a bounded product-design comparison, not a market survey and not a strategy benchmark.

Evidence used:

1. The explicit GTO Wizard observations supplied with this ticket for Full Hand Drill, Heads-Up Play, Analyze/Hand Library, and Matrix. These are the strongest direct interaction evidence in this brief.
2. Public first-party product material accessed August 23, 2026:
   - [GTO Wizard](https://gtowizard.com/) product overview: Analyze, Study, Practice, instant feedback, Heads-Up PokerArena, streamlined table layouts, bet sliders, hotkeys, and hand-history analysis.
   - [DTO Poker Cash](https://www.dtopoker.com/cash) and [DTO Poker Tournament](https://www.dtopoker.com/tournament): browser trainers, instant feedback, full-range evaluation, Explorer, drills, reports, and public product screenshots.
   - [PokerSnowie Features](https://www.pokersnowie.com/features) and [PokerSnowie Manual](https://www.pokersnowie.com/online-manual): Play/Analyze/Learn loop, live advice, scenarios, import-and-analyze, range advice, training, GTO Balance, and evolution tracking.
   - [Advanced Poker Training](https://www.pokertraining.com/): rapid play against AI opponents, targeted repetition, advice, reports, weekly plans, and public table/report screenshots.
3. Current Riverline source, tests, project specifications, and QA records on the same date.

Limits:

- No authenticated competitor session, automated login, scraping, bulk export, or proprietary strategy capture was performed.
- The in-app browser was unavailable. Public first-party HTML, promotional screenshots, and the user's direct GTO Wizard observations were inspected instead.
- Public promotional screenshots may show a curated or older state of a product. They support broad interaction and hierarchy findings, not pixel-accurate claims about a current authenticated build.
- Competitor claims about optimality, EV, or AI are recorded only as product positioning. They are not evidence that Riverline may make the same claims.

## 3. Competitor findings

### 3.1 GTO Wizard

Strongest lessons from the supplied direct observations:

- Full Hand Drill treats the timeline as the hand's readable spine. The table remains central but quiet, inactive seats recede, and completion changes the composition instead of leaving a dead action dock in place.
- Heads-Up Play is a purpose-built two-player layout. Hero and Villain form a strong vertical axis, their cards belong to their player regions, contributions sit between player and pot, and controls belong to Hero's decision region.
- Analyze/Hand Library uses master-detail continuity. The list keeps its place, the selected hand gets a compact inspector, deeper study is an explicit transition, and unavailable solutions are stated without visual alarm.
- Matrix presentation lets action color carry the dense comparison while whole-node and selected-hand facts stay available. Density is useful because hierarchy is strict.

Corroborating public product material emphasizes three distinct jobs: Analyze hand histories, Study a selected spot, and Practice through a trainer. It also explicitly promotes streamlined table layouts, customizable bet sliders, action hotkeys, instant feedback, and post-game review. The lesson is not to copy its appearance; it is to let the current job determine composition and control density.

Patterns Riverline should not import from the broader GTO Wizard ecosystem:

- unsupported exact EV/GTO scoring language for Riverline's generalized heuristic;
- branding, colors, assets, wording, or a pixel-for-pixel layout;
- competitive rating, leaderboard, or game-like progression in the table ticket;
- a solver-first information load during a live decision.

### 3.2 DTO Poker

Public material and screenshots show a direct loop between a playable table, immediate result, full evaluation, range grid, and retry/continue actions. Useful lessons:

- Practice and Explore are distinct but adjacent. The player can act at a table, then inspect the full strategy without making the table itself carry the entire analysis.
- Decision controls are large and unambiguous. The exact sizing is included in the action label, and feedback gives clear next actions such as retry, continue, or evaluation.
- The full-range grid uses action colors and selected-hand details to make a dense surface readable.
- Spot selection, performance tracking, and repeated drills reinforce continuity beyond a single answer.

Adaptation required for Riverline:

- DTO's public table screenshot uses a more game-like oval, visible side panels, and a right-side action column. Riverline should keep the useful clarity but attach the decision dock to Hero and reduce frame/chrome noise.
- Strong `MISTAKE`, score, and EV-loss treatment is valid only when the source has that authority. Riverline must continue using `StrategyClaimPolicy v1` and comparative language for the heuristic.

### 3.3 PokerSnowie

Current first-party material defines a coherent Play, Analyze, Learn, Improve loop. It promotes real-time feedback, what-if scenarios, imported-hand analysis, range advice for the player to act, summary balance, and change over time.

Useful lessons:

- A table interaction becomes more valuable when the user can immediately branch into a scenario or analysis of the same decision.
- The product distinguishes live advice, imported-hand analysis, and longer-term evolution rather than placing all of them beside every decision.
- Range advice is scoped to the actor and exposed as a dedicated grid, not painted indiscriminately over the table.

Adaptation required:

- Riverline must not reproduce broad balance/exploitability or outcome claims without a trusted source.
- Scenario and canonical Hand must remain distinct; a convenient what-if transition cannot silently turn lossy Scenario state into canonical history.

### 3.4 Advanced Poker Training

Current first-party material centers repeated play, immediate advice, high hand volume, targeted spots, reports, and a weekly training plan. Its public table screenshot is more casino-like and visually dated, while its report screenshot demonstrates plain-language coaching around a small number of measures.

Useful lessons:

- Learning-by-playing needs fast repetition and a short feedback loop.
- Reports should translate measures into an understandable question and explanation rather than expose raw telemetry alone.
- The table can be operationally clear even when the visual style is not a fit for Riverline.

Patterns to reject:

- avatar-heavy casino presentation, saturated felt, decorative rail realism, and game-room chrome;
- generic recommended ranges or coaching claims without Riverline source/provenance support;
- placing long-form coaching copy inside the live decision surface.

## 4. Adopt / Adapt / Differentiate / Reject

`ADOPT` means the mature interaction pattern can be used substantially as-is. `ADAPT` means the principle is sound but the Riverline implementation must respect its architecture and identity. `DIFFERENTIATE` identifies a Riverline opportunity. `REJECT` records a deliberate mismatch.

| Topic | Classification | Riverline decision |
|---|---|---|
| Table scale | ADOPT | In Play, allocate the majority of the stage to the table and cap it by available height as well as width. |
| Seat hierarchy | ADAPT | Use Hero, actor, relevant opponent, live, folded, and empty prominence roles derived by an application projection; never by renderer poker inference. |
| Heads-up geometry | ADOPT | Use a dedicated Hero-bottom/Villain-top composition with larger seats and cards and no empty-seat suggestion. |
| 3-4 handed geometry | ADAPT | Use sparse templates with larger player units; do not stretch a full-ring ellipse. |
| 6-max geometry | ADOPT | Make six-max the primary balanced desktop template with three seats per side of the Hero/top axis. |
| 9/10-max geometry | ADAPT | Use deliberate full-ring anchors and reduced secondary detail, not the sparse seat scale squeezed onto one oval. |
| Cards | ADAPT | Reuse Premium Card System v1 and its styles/rank settings; apply projection-owned scale and overlap only. |
| Contributions | ADOPT | Keep each contribution on the player-to-pot ray and show chips plus the exact numerical amount. |
| Pot | ADAPT | Make the chip cluster and exact pot a single central object; chip count remains decorative and must not imply denomination. |
| Dealer/button | ADOPT | Keep a compact physical button attached to its seat; increase legibility and avoid a floating metadata badge. |
| Current actor | ADOPT | Use a stable focus treatment and `To act` status, with a non-color cue. No pulsing loop is required. |
| Action dock | ADAPT | Attach the dock compositionally to Hero below the table. Legal actions remain canonical; the renderer never manufactures actions. |
| Sizing controls | ADAPT | Reveal presets, range input, and exact amount only after Bet/Raise selection. Use canonical min/max/chip unit; add no pot-size semantics that do not exist. |
| Hand timeline | ADOPT | Give the chronological street/action story a first-class horizontal composition and a more detailed review form. |
| Completed-hand transition | ADOPT | Remove legal controls, keep the resolved table, and replace the decision dock with a concise result/next-step layer. |
| Post-hand feedback | ADAPT | Show only supported result, decision count, comparison summary, source, and review actions. Do not fabricate a most-important mistake. |
| Replay | ADAPT | Reuse the canonical frame projection and add bounded direct seeking; do not rewrite playback or store renderer frames. |
| Analysis projection | ADOPT | Shrink the table and let explanation/ranges/evidence lead. |
| Saved preview projection | ADOPT (future integration) | Specify a compact passive preview for `HOME-002B`; do not redesign Saved in `TABLE-PRESENCE-002`. |
| Information density | DIFFERENTIATE | Change density by job and prominence, while retaining truthful provenance and uncertainty. |
| Borders/panels/chrome | ADAPT | Use one stage surface and spacing first. Reserve borders for controls, selected states, and true groups. |
| Motion | ADAPT | Expose semantic poker events and use short spatial transitions only where state change benefits comprehension. |
| Sound affordances | DIFFERENTIATE (later) | Keep event seams independent from playback; no new audio in the next ticket. |
| Responsive behavior | ADAPT | Design for current desktop targets with height-aware scale and deliberate reflow; mobile remains a separate future composition. |
| Casino realism | REJECT | No avatars, glossy 3D chips, wood/leather imitation, particle wins, dealer character, or ornamental table clutter. |
| One universal layout | REJECT | A single compromise table/dock/panel arrangement is not the product model. |
| Unsupported correctness theater | REJECT | No fake GTO score, EV loss, optimal label, or confident mistake ranking from the heuristic. |

## 5. Current Riverline gap analysis

The following findings are supported by current source and project QA; they are not inferred from competitor appearance alone.

### 5.1 What is already canonical and reusable

- `app/src/application/table-presence-view-model.mjs` projects validated `PokerState` into immutable `table-presence/v1` facts: Hero-relative seat order, board, pot, dealer, actor, stacks, contributions, cards, folded/all-in state, and latest current-street action.
- `app/src/ui/TableRenderer.js` is the shared visual consumer for Playbook Hand, Scenario, Replay, Saved detached Replay, and Full-Hand Training. It does not calculate legality or poker math.
- `app/src/application/replay-projection-controller.mjs` already joins immutable canonical frames, table projection, street/action/chance timeline items, replay position, and semantic motion facts.
- `app/src/application/replay-timeline-view-model.mjs` already exposes exact canonical actions grouped by street with Hero, position, amount semantics, all-in state, and current marker.
- `app/src/ui/PokerPrimitives.js` already provides reusable chips, chip stacks, poker amounts, and table amounts. Contributions and pot values are exact even though the visual chip count is decorative.
- `app/src/application/card-presentation.mjs` is the shared card authority for face/back/rank styles and fixed named geometries.
- Canonical Hand legal controls already use the legal-action specification. Bet/Raise reveals canonical amount-to min/max and exact input.
- Full-Hand Training already reuses the shared table, exposes semantic presentation cues, separates live/grading/terminal/review phases, and has a concise completion summary plus per-Hero-decision review.
- Balanced/Table Focus/Controls First, Comfortable/Compact, built-in/custom themes, card preferences, responsive rules, RTL, and reduced motion already have application boundaries and must survive unchanged.

### 5.2 Concrete gaps

1. **Every player count uses one geometry algorithm.** `TableRenderer.drawSeats()` places 2-10 seats on the same fixed `rx=340`, `ry=210` ellipse. Heads-up therefore reads as a mostly empty full-ring table instead of a deliberate duel, and sparse tables do not gain larger player units.
2. **The table body is also fixed.** The same 700x400 rail, 660x360 surface, 600x300 betting line, and 800x600 viewBox serve every player count and job.
3. **Seat hierarchy is mostly stroke-based.** Hero, actor, folded, and all-in states change fill/stroke/opacity, but seat dimensions and information density remain the same. Other live players have essentially equal visual weight.
4. **Folded seats remain relatively prominent.** A folded seat surface retains `.68` opacity and its unit remains full-size. The cards dim to `.58`, but the overall seat still competes with live opponents.
5. **Cards sit near seats rather than belonging to them.** Every hole-card group uses one fixed offset above a fixed 100x70 seat panel. HU does not get larger connected player/card regions; full ring does not get a denser variant.
6. **The table is prominent but conservatively capped.** Normal Hand caps at 900px and Table Focus at 1120px, even inside a dense 1680px frame. This is sensible for Analyze but leaves unused presence at 2560px and 4K Play targets.
7. **Play controls are a separate panel before the table.** The stage dock is ordered ahead of the table in the current presets, so the legal decision reads as a neighboring form rather than an extension of Hero's table region.
8. **Sizing is subordinate in behavior but not yet spatially integrated.** The current disclosure-after-Bet/Raise behavior is correct. The three-column sizing row, separate panel border, and generic exact input need to become a compact secondary tray under the action family buttons.
9. **Timeline data is stronger than its placement.** Replay already has canonical action and chance items, but the timeline lives inside a collapsed Hand-details disclosure. It is not the live hand's glanceable spine and its items are not direct seek controls.
10. **Live and terminal table composition remain too similar.** The action panel is replaced by generic completion actions, but the resolved table does not gain a central result layer and the timeline does not become primary automatically.
11. **Review is split across surfaces.** Canonical Hand has Replay plus a latest-decision Analysis action; Full-Hand Training has per-decision review. The brief must align their composition without merging their different data authorities.
12. **One DOM table is physically moved between Playbook and Training mounts.** This reuse is valuable, but the renderer currently learns only the nearest wrapper's replay state. It needs an explicit visual-projection input so mount context is deliberate rather than selector-driven.
13. **Panel chrome is still doing hierarchy work.** Table wrapper, stage dock, live header, Hand rail, history disclosure, and completed actions can all appear together. Spacing and projection state should remove or demote containers before adding stronger borders.
14. **Saved inspection is detached Replay, not master-detail.** This is truthful and reusable, but it is not yet the compact Saved library projection described by the target. That integration belongs to `HOME-002B`, not this implementation.

### 5.3 QA traceability

The design directly informs future work on `QA-TABLE-001`, `QA-UI-005`, and `QA-LAYOUT-002`. `TABLE-PRESENCE-002` must preserve rather than silently absorb `QA-COLLAPSE-001`, `QA-LAYOUT-PRESETS-001`, `QA-CARD-001` through `003`, `QA-THEME-006`, and `QA-RESP-001`. This research ticket changes none of their statuses.

## 6. Presentation architecture

### 6.1 Locked authority chain

```text
PokerState / Scenario facts
          -> table-presence/v1
          + replay-projection/v1 when canonical history exists
          + legal-action spec at a live decision
          + surface/job context
          -> TablePresentation v1 (immutable, DOM-free, non-persisted)
          -> shared TableRenderer + timeline/dock renderers
```

`TablePresentation v1` is a view composition, not a second poker state. It may choose geometry, scale, prominence, detail level, and surrounding composition. It must not derive legality, pot accounting, winners, hand strength, strategy, or reference agreement.

Recommended shape:

```js
{
  schemaVersion: 'table-presentation/v1',
  projection: 'play' | 'review' | 'analyze' | 'saved_preview',
  visualState: 'setup' | 'live_decision' | 'action_resolution' |
    'street_transition' | 'hand_complete' | 'post_hand_review',
  geometryFamily: 'hu' | 'sparse' | 'six_max' | 'full_ring',
  interaction: 'decision' | 'replay' | 'passive',
  tablePresence,       // unchanged table-presence/v1 authority
  timeline,            // replay-projection/v1 timeline or null
  seats: [{
    visualSeatIndex,
    prominence: 'hero' | 'actor' | 'relevant' | 'live' | 'folded' | 'empty',
    detail: 'full' | 'standard' | 'compact' | 'minimal'
  }]
}
```

The application layer supplies `projection` and `visualState`. A DOM renderer must not decide that a table is Review because it happens to sit in a particular panel. The presentation object is ephemeral and must not enter Saved payloads or canonical Replay sources.

### 6.2 Projection inputs

- Playbook canonical Hand live endpoint: `play` plus the current Hand stage.
- Playbook earlier frame or detached Saved Hand: `review` plus `replay` interaction.
- Full-Hand Training awaiting Hero/advancing: `play`.
- Full-Hand Training terminal/review: `review`.
- Playbook Analyze: `analyze` and passive interaction.
- Future Saved library inspector: `saved_preview` and passive interaction.
- Scenario keeps its truthful lossy facts. It may use `analyze` or a compact setup preview, but it must not gain canonical timeline claims.

## 7. Adaptive table geometry

### 7.1 Coordinate contract

Use one internal normalized coordinate space of `1000 x 650`. Geometry templates own the table body, player anchors, contribution rays, card scale, and seat detail. `visualSeatIndex=0` remains the stable Hero anchor at bottom. Canonical seat/turn order remains unchanged.

Anchors below are `(x, y)` fractions of the normalized viewBox. They are exact starting templates for `TABLE-PRESENCE-002`; visual QA may tune values within +/- 0.02 without changing the contract.

| Players | Family | Hero-relative player anchors in order |
|---:|---|---|
| 2 | HU | `(0.50,0.91)`, `(0.50,0.09)` |
| 3 | sparse | `(0.50,0.91)`, `(0.18,0.20)`, `(0.82,0.20)` |
| 4 | sparse | `(0.50,0.91)`, `(0.12,0.48)`, `(0.50,0.09)`, `(0.88,0.48)` |
| 5 | sparse | `(0.50,0.91)`, `(0.16,0.62)`, `(0.22,0.18)`, `(0.78,0.18)`, `(0.84,0.62)` |
| 6 | six-max | `(0.50,0.91)`, `(0.17,0.66)`, `(0.17,0.23)`, `(0.50,0.09)`, `(0.83,0.23)`, `(0.83,0.66)` |
| 7 | full-ring | `(0.50,0.91)`, `(0.22,0.76)`, `(0.10,0.45)`, `(0.24,0.14)`, `(0.76,0.14)`, `(0.90,0.45)`, `(0.78,0.76)` |
| 8 | full-ring | `(0.50,0.91)`, `(0.22,0.76)`, `(0.10,0.47)`, `(0.24,0.15)`, `(0.50,0.07)`, `(0.76,0.15)`, `(0.90,0.47)`, `(0.78,0.76)` |
| 9 | full-ring | `(0.50,0.91)`, `(0.25,0.79)`, `(0.09,0.56)`, `(0.12,0.27)`, `(0.34,0.09)`, `(0.66,0.09)`, `(0.88,0.27)`, `(0.91,0.56)`, `(0.75,0.79)` |
| 10 | full-ring | `(0.50,0.91)`, `(0.26,0.80)`, `(0.09,0.59)`, `(0.09,0.33)`, `(0.27,0.13)`, `(0.50,0.06)`, `(0.73,0.13)`, `(0.91,0.33)`, `(0.91,0.59)`, `(0.74,0.80)` |

These arrays are deliberate templates, not points sampled from a generic ellipse.

### 7.2 Family specifications

| Family | Table-body bounds `(x,y,w,h)` | Player unit | Hole cards | Board | Notes |
|---|---|---|---|---|---|
| HU | `(0.13,0.18,0.74,0.58)` | 150x78 equivalent | 1.25x table-card scale, 18% overlap | 1.12x | Strong vertical Hero/Villain axis; contributions close to their player-to-pot line. |
| sparse 3-4 | `(0.11,0.16,0.78,0.62)` | 138x74 | 1.15x, 22% overlap | 1.08x | Broad negative space is intentional, not an empty-seat artifact. |
| sparse 5 / six-max | `(0.09,0.15,0.82,0.64)` | 122x70 | 1.00x, 28% overlap | 1.00x | Primary desktop balance. Five-handed uses sparse anchors; six-handed uses the six-max template. |
| full-ring 7-10 | `(0.07,0.13,0.86,0.67)` | 104x62 | 0.88x, 34% overlap | 0.94x | Stack/name/position remain legible; secondary statuses compress. |

Dimensions are presentation equivalents inside the normalized SVG; they do not add card-size preferences. Premium Card System v1 still owns the card face, rank, suit, back, and base geometry.

### 7.3 Contribution and pot geometry

- Continue placing each current-street contribution on the ray between player anchor and pot center.
- Target point is 46% of the distance from player to pot for HU/sparse, 50% for six-max, and 54% for full ring.
- Collision resolution may move a contribution inward along the same ray only. It may not jump to a generic list or imply a different player.
- Pot center is `(0.50,0.48)` pre-board and `(0.50,0.43)` once community cards exist, with the board centered immediately below it. The pot and board may trade vertical positions during visual QA, but must remain one central poker cluster.
- Chips are a physical cue; the adjacent exact amount is authoritative. Do not derive denomination, chip count, or stack height from the amount in this ticket.

## 8. Seat hierarchy specification

Prominence resolution happens in the application presentation builder. A player can have several facts but receives one highest-priority prominence role.

Priority:

1. Hero
2. current actor when not Hero
3. relevant opponent: latest live aggressor on the current street, or a non-folded known-card/showdown opponent in completion/review
4. other live/dealt-in player
5. folded/inactive player
6. empty seat

Hero who is also the actor keeps the Hero unit and adds the actor indicator; no duplicate role is needed.

| Role | Unit opacity | Information | Cards | Contribution | Status treatment |
|---|---:|---|---|---|---|
| Hero | 1.00 | identity, position, exact stack, action/status | always show canonical visibility; largest family scale | exact current contribution always | accent edge plus `Hero`; actor cue if applicable |
| Actor | 1.00 | identity, position, exact stack, `To act` | canonical visibility | exact current contribution | warning/focus edge, top rule, and text; not color-only |
| Relevant | 0.98 | identity, position, exact stack, latest action | canonical visibility | exact contribution | restrained emphasis; never brighter than actor |
| Other live | 0.86 | identity/position and exact stack | canonical visibility | exact contribution if nonzero | no glow; standard edge |
| Folded | 0.42 overall; text >= 0.58 contrast | compact identity/position and `Folded`; stack remains available | 0.28 opacity or hidden back only after fold if redundant | retain only while canonical current-street contribution is shown | strike or fold icon plus text; no dashed casino effect required |
| Empty | hidden by default | none | none | none | never reserve a fake empty seat in HU/sparse |

Strategically important facts must not be hidden to create visual cleanliness:

- all live stacks remain visible;
- the actor and amount to call remain visible near the decision dock;
- current-street contributions remain attached to players;
- folded action history remains available in the timeline even after the seat recedes;
- known showdown cards remain visible in completion/review;
- all-in remains a text/icon state in addition to color.

Long supplied names continue to fit or truncate accessibly, with the full identity in the seat's accessible label/title. Full ring may use a shorter visible name but not a different identity.

## 9. Restrained table physicality

### 9.1 Implement now

- **Felt:** a two-layer radial/linear tone plus a very low-opacity, theme-derived noise/pattern (`0.025-0.045`). It must remain calm in Daylight and custom felt themes.
- **Rail:** two restrained bands (outer edge and inner lip), 2-4px equivalent depth, no wood/leather texture.
- **Depth:** one broad table shadow and one tighter inner edge. Avoid multiple floating shadows on every object.
- **Seat integration:** seat surface, cards, identity, and stack form one player unit. Cards overlap the top edge of the seat by 8-14 SVG units depending on family.
- **Dealer:** reuse the current canonical button fact; render a 22-24px-equivalent physical disc with `D` and an accessible label.
- **Contributions:** reuse `poker-table-amount` chip stack plus exact amount, with family-specific scale.
- **Pot:** reuse the chip stack primitive, allow a fixed three-chip visual variant if needed, and keep `Pot N bb` visually inseparable.
- **Actor focus:** stable edge/top-rule and subtle outer focus; at most one short transition on actor change. No continuous glow loop.
- **Showdown/reveal:** known cards gain full opacity and a small vertical lift; non-relevant folded units stay muted.

### 9.2 Expose a seam, implement later

- chips traveling from player to contribution and contribution to pot;
- cards traveling from a deck/dealer origin;
- denomination-aware or amount-proportional chip stacks;
- side-pot-specific clusters;
- richer showdown card fan or pot-award travel;
- restrained ambience or action audio expansion.

### 9.3 Reject

- fake 3D camera perspective;
- photoreal felt, leather, wood, dealer trays, or casino-room backgrounds;
- avatars or decorative empty chairs;
- particle effects, bouncing chips, win flashes, or celebration sound;
- visual chip counts that claim exact monetary composition.

## 10. Action dock specification

### 10.1 Relationship to the table

The Play stage is one composition:

```text
compact timeline / stage status
large table
Hero seat
decision dock aligned to Hero/table center
secondary sizing tray (only when selected)
```

The dock is DOM UI immediately below the SVG, not poker controls embedded in SVG. It shares the table's center line and uses `width: min(100%, 900px)` at desktop. A 10-16px visual gap makes it feel attached without overlapping cards or the Hero accessible group.

### 10.2 Primary action row

- Render only canonical legal actions in canonical family order: Fold, Check, Call, Bet, Raise, All-in.
- Minimum button height: 52px Comfortable, 48px Compact. Compact changes rhythm, not action availability or hit-target semantics.
- Fold: quiet neutral/destructive treatment, not a saturated red block.
- Check/Call: strong neutral buttons; Call includes the exact incremental amount when supplied.
- Bet/Raise: accent treatment and amount-selection affordance.
- All-in: distinct outline/text cue; no alarm animation.
- Disabled controls appear only for a transient submission lock. Normally unavailable actions are omitted because the legal-action spec already distinguishes availability.
- Actor, pot, amount to call, Hero stack, and resulting amount-to remain in a one-line/two-line context strip above the buttons. Do not repeat the entire live-facts panel.

### 10.3 Secondary sizing tray

The tray opens only after Bet or Raise is chosen and must remain subordinate to the action-family row.

- Keep current canonical minimum, maximum non-all-in, and exact amount-to input.
- Add a range input synchronized with the exact input only when `max > min`; its step is the canonical chip unit.
- Keep Minimum and Maximum non-all-in presets. Do not add 25%/50%/pot presets until a trusted sizing policy supplies those semantics.
- Show `Raise to N bb` or `Bet to N bb` and, where already available without new math, the chips committed/resulting stack.
- Commit is explicit. Selecting Bet/Raise must not submit the minimum silently.
- `Escape` closes the sizing tray and returns focus to the selected action. Arrow keys operate the native range input; Tab/Shift+Tab, Enter, and Space follow native semantics.
- Do not add global one-key action shortcuts in this ticket. Preserve `data-canonical-action`/semantic hooks so a later expert-keyboard ticket can bind them deliberately.

### 10.4 After submission

- Lock the dock immediately to prevent duplicate actions.
- Show a short non-blocking `Hero - Raise to 6.5 bb` resolution label from the submitted canonical action.
- Render the canonical state update immediately. Do not delay poker state for animation.
- On the next Hero decision, replace the actions and restore focus to the dock heading or first legal action according to the existing focus policy.
- When another player acts automatically in Full-Hand Training, hide/lock the Hero dock and promote the acting seat.
- On terminal state, remove the dock entirely and mount the post-hand layer in the same compositional slot.

## 11. Play visual state model

The visual state is presentation state around canonical transitions; it is not a new poker phase.

| Visual state | Entry evidence | Dominant region | Visible supporting UI | Exit |
|---|---|---|---|---|
| `setup` | no canonical Hand or private-card setup | setup plus useful table preview | player count, game/stack/button/Hero configuration; collapsed details when locked | Hand starts/private cards committed |
| `live_decision` | canonical betting phase and live legal spec | table, Hero/actor, legal actions | compact timeline, pot/call/stack context; analysis minimized | legal action submitted |
| `action_resolution` | successful canonical action event | table state change and action label | dock locked/hidden; contribution/action badge updates | next canonical state rendered |
| `street_transition` | canonical chance event | board/pot continuity | timeline street segment updates; no decision controls | next betting/showdown/terminal state |
| `hand_complete` | terminal canonical state | result layer over/under resolved table | timeline and concise next actions; no legal controls | Review, Replay, Repeat/Next, Save, or Analyze |
| `post_hand_review` | review/replay selected | timeline and selected decision/event | medium table projected to selected frame; review facts/source | event selection or return/next action |

Rules:

- `action_resolution` and `street_transition` may last only one render cycle with reduced motion. They must never become artificial waits.
- Setup can collapse after Hand start; the current immutable setup summary remains available.
- Live analysis panels do not automatically open during a decision.
- Completion does not immediately open a large Analysis surface.
- Replay remains read-only and never replaces the live canonical Hand.

## 12. Canonical visual hand timeline

### 12.1 Source seam

The timeline must consume `replay-projection/v1.timeline`. It must not rebuild actions from DOM labels or save presentation frames.

Stable presentation targets:

- action item: `action:<canonical action sequence>` with `frameIndex` from Replay;
- chance/street item: `frame:<frameIndex>` with public board cards from the canonical replay frame;
- current decision/result marker: the existing current marker plus selected frame;
- Hero decision: existing `isHero` action fact;
- replay position: existing `presentationState` and `selectedFrameIndex`.

`TABLE-PRESENCE-002` should add a bounded `selectFrame(frameIndex)` operation to the existing Replay projection controller so a timeline item can seek directly without repeated Previous/Next calls. Validation must reject non-integer/out-of-range indices. This is navigation over existing frames, not a Replay rewrite.

### 12.2 Visual forms

**Live compact timeline**

- One horizontal band above the table.
- Street segments: Preflop, Flop, Turn, River, Result.
- Each segment contains compact action tokens such as `BTN Raise 2.5`, `BB Call`.
- Street reveal token includes board cards, for example `FLOP A♠ 9♦ 3♣`.
- Current item has a position marker and `aria-current="step"`.
- Overflow scrolls horizontally with the current item kept in view; it never wraps into several table-height rows.

**Review timeline**

- Becomes the primary band or left/top review column.
- Shows all action and chance items with more spacing and marker slots.
- Items are buttons that seek the existing Replay frame.
- Playback controls remain compact and adjacent; Play/Pause/Previous/Next/Return are not duplicated elsewhere.

### 12.3 Future marker seam

Do not bake source-specific booleans into canonical actions. Future annotations attach through a separate keyed overlay:

```js
{
  schemaVersion: 'hand-timeline-markers/v1',
  handId,
  markers: [{
    target: { actionSequence: 4 }, // or frameIndex for chance/result
    kind: 'hero_decision' | 'reference_disagreement' |
      'personal_strategy_disagreement' | 'reference_unavailable' |
      'saved_note' | 'review_marker',
    tone: 'neutral' | 'info' | 'warning',
    source: null,       // StrategySourceDescriptor/provenance summary when relevant
    labelKey,
    available: true
  }]
}
```

The marker overlay is derived/non-persisted unless a future Saved schema explicitly owns notes or historical analysis. Unknown or unavailable reference is a first-class marker, not silently omitted.

### 12.4 First-pass marker scope for `TABLE-PRESENCE-002`

Implement only:

- Hero action/decision cue from existing `isHero` facts;
- current/selected Replay position;
- street/chance cards;
- terminal/result position;
- a neutral reserved marker slot/non-source-specific DOM seam.

Defer reference disagreement, Personal Strategy disagreement, notes, mistake ranking, and review-later markers.

## 13. Post-hand experience

The first layer answers: **What happened, and what can I do next?**

### 13.1 Composition

- Keep the resolved table visible at medium scale.
- Replace legal actions with a compact result card in the Hero/dock region.
- Promote the timeline from compact-live to review-ready.
- Use one short headline, one summary row, and one action row. Do not mount the full Analysis stack automatically.

### 13.2 Supported information

Canonical Hand may show:

- terminal reason and exact Hero stack delta/result when the canonical terminal result supplies it;
- final pot where meaningful;
- number of recorded Hero decisions from the existing decision journal;
- current strategy source identity only for a displayed evaluated decision, with claim-policy limitations.

Full-Hand Training may additionally show its existing:

- decisions answered;
- Matches/Close/Differs summary for generalized comparative sources, or normative wording only when claim policy permits it;
- source identity/limitations within decision review.

Do not show in the first layer unless a future authority supplies it:

- largest EV loss;
- most important mistake;
- GTO score;
- exploitability;
- a fabricated reference-alignment percentage for canonical Hands that were not graded;
- a claim that the final chip result measures decision quality.

### 13.3 Actions

Canonical Hand:

- Primary: `Review hand`.
- Secondary: `Replay`, `Analyze latest Hero decision` when one exists, `Save hand`.
- Keep `End hand`/new setup outside the result card to avoid accidental loss of the completed context.

Full-Hand Training:

- Primary: `Review decisions`.
- Secondary: existing `Repeat hand` and `Next hand`.
- `Replay` may use the existing canonical Replay source only when a bounded Training-to-Replay route is present; do not invent it in this ticket.

Future, not `TABLE-PRESENCE-002`: `Practice similar`, targeted re-drill, persistent mistake history, and Training Memory.

## 14. Four projections of the same Hand

| Projection | Table target | Primary content | Interaction | Surrounding density |
|---|---|---|---|---|
| Play | 900-1320px inline, height-aware | table, actor, Hero, legal decision | canonical actions; compact timeline can enter Replay | minimal panels; setup/details collapsed |
| Post-hand review | 720-980px | timeline, selected event/Hero decision, result | direct Replay seeking and existing playback | medium; review facts and source visible on demand |
| Deep analyze | 520-760px | strategy, range/Matrix, explanation, evidence, provenance | table passive; selected node/decision controls analysis | high information density but strict hierarchy |
| Saved library inspector | 320-520px | selected saved-object metadata and continuity actions | passive preview; explicit Open/Study enters full workspace | compact master-detail; no live action dock |

All projections consume the same canonical state/replay source. They may differ in table size, seat detail, timeline form, controls, and surrounding composition. They may not disagree about cards, actions, pot, stacks, dealer, actor, or history.

`TABLE-PRESENCE-002` implements Play and Post-hand Review. It adds projection-ready Analyze/Saved renderer variants and tests but does not redesign Analyze, Matrix, Home, or Saved library topology.

## 15. Riverline differentiation roadmap

### NOW - `TABLE-PRESENCE-002`

- truthful source identity and limitation remain available when review shows strategy feedback;
- unavailable/unsupported analysis remains calm and explicit;
- same Hand moves continuously from Play to Replay/Review without renderer-frame persistence;
- job-specific projection and uncertainty-ready marker seam are established;
- Hero decision cues and exact canonical event continuity are visible in the timeline.

### NEXT

- reference disagreement markers only where `StrategyClaimPolicy` permits comparison;
- Personal Strategy comparison as intended strategy, never relabeled as objective reference;
- Saved decision/note continuity through approved Saved metadata;
- direct opening of any reviewed Hero decision in Analysis without losing the completed Hand;
- similar-spot re-drilling after canonical Training persistence/planning exists.

### LATER

- intended versus observed play over durable evidence;
- opponent policy/personality identity where an explicit opponent-policy contract exists;
- environment/profile identity across Personal Strategy and Training;
- uncertainty-aware recommendations and unavailable-reference navigation;
- longitudinal mistake/review markers and spaced practice;
- richer but still restrained semantic motion/audio.

The differentiation is provenance and continuity, not more table decoration.

## 16. Motion and audio seams

`TABLE-PRESENCE-002` does not add a motion or audio system. It should normalize presentation events so later consumers do not inspect CSS classes or poker state diffs independently.

Recommended semantic event vocabulary:

| Event | Existing evidence | Payload minimum |
|---|---|---|
| `private_cards_dealt` | Replay/Full-Hand `private_deal` | player IDs/card visibility changes, frame index |
| `board_revealed` | `flop_deal`, `turn_deal`, `river_deal` | street, public card IDs, frame index |
| `chips_committed` | canonical action transition | actor, action family/type, exact committed/amount-to values |
| `pot_collected` | street boundary/pot change | exact pot before/after, contributing players |
| `actor_changed` | table-presence actor change | prior/next actor IDs and seats |
| `fold` / `call` / `raise` / `all_in` | canonical action | action sequence, actor, exact trusted amounts |
| `street_advanced` | chance transition | from/to street, frame index |
| `showdown_revealed` | `private_reveal` | newly known cards/player IDs |
| `hand_completed` | terminal frame/cue | terminal reason and canonical result reference |
| `review_marker_selected` | Replay direct seek | frame index/action sequence and marker kind |

Rules:

- Poker-world motion consumes these events; app-navigation motion consumes route/panel events. Do not mix them.
- Canonical state updates first. Motion never owns or delays poker truth.
- Reduced motion preserves immediate state, focus, selected marker, and announcements with duration effectively zero.
- Audio consumers, if later approved, subscribe independently. Muting sound must not disable visual state change.
- No celebration event exists in the vocabulary.

## 17. Responsive expectations

Desktop-first acceptance targets for this branch are 1920x1080, 2560x1440, 2560x1600, and 3840x2160 in Firefox, in EN/RU/HE, Midnight/Daylight, Comfortable/Compact, and every supported Hand/Training layout preset.

### 17.1 Height-aware Play scale

Use both available inline and block size. A suitable starting rule is conceptually:

```css
inline-size: min(
  100%,
  1320px,
  calc((100dvh - var(--play-stage-reserve)) * 1.54)
);
```

`--play-stage-reserve` covers app chrome, compact timeline/status, and the decision dock; start at 300px Comfortable and 268px Compact. The exact implementation may use container queries, but must prove the same constraint.

Targets:

- **1920x1080:** Play table approximately 1000-1180px; table, Hero, primary legal actions, and call/pot/stack context visible without scrolling at a live Hero decision in Balanced and Table Focus. Supporting rails may scroll independently or follow below.
- **2560x1440:** Play table approximately 1180-1320px; no excessive empty center; dock remains aligned to Hero.
- **2560x1600:** same maximum family scale with more breathing room for timeline/review, not inflated controls.
- **4K:** cap the table around 1440px only if a dedicated large-canvas token is added inside the ticket; otherwise retain 1320px and use balanced whitespace. Do not scale all typography proportionally to the viewport.

### 17.2 Reflow rules

- At main-stage inline size below about 980px, reduce table family scale before hiding facts.
- At about 820px, context rails follow the stage; the decision dock remains directly after the table/Hero region.
- Horizontal timeline overflow scrolls; it does not wrap into a long column during Play.
- Full-ring secondary seat detail reduces before card/stack legibility does.
- RTL mirrors app chrome and logical layout, but poker seat order, cards, board, amounts, and timeline chronology remain deliberate LTR islands where already specified.
- Test 90%, 110%, and 125% zoom for no global horizontal overflow, unreachable legal action, clipped Hero cards, or hidden selected timeline item.
- Mobile remains a separate future composition. The projection contract and normalized geometry must avoid desktop-only state assumptions, but no mobile CSS or acceptance is part of this ticket.

## 18. Exact scope for `TABLE-PRESENCE-002`

### 18.1 Owned outcome

Implement an adaptive, task-aware Table Presence v2 presentation for canonical Hand and Full-Hand Training, plus a first-pass canonical timeline and completion/review composition, without changing poker or strategy semantics.

### 18.2 Required implementation

1. Add the immutable, DOM-free, non-persisted `table-presentation/v1` composition described in section 6. Keep `table-presence/v1` and Replay/Saved canonical contracts compatible.
2. Replace the generic 2-10 ellipse in the shared renderer with the exact HU, sparse, six-max, and full-ring templates in section 7.
3. Add projection/family tokens or classes for player-unit/card scale and detail; reuse Premium Card System v1 rather than adding card preferences.
4. Implement the prominence resolver and exact role treatments from section 8 using existing canonical facts. Renderer code consumes resolved roles and does no poker inference.
5. Apply the restrained felt, rail, depth, seat integration, dealer, pot/contribution, actor, and showdown changes listed as `Implement now` in section 9. Reuse/enhance poker primitives without denomination claims.
6. Recompose Play so the shared table and Hero-aligned decision dock form one stage. Keep legal actions canonical and implement the secondary sizing tray, synchronized canonical range/exact input, focus behavior, and submission lock from section 10.
7. Map current canonical Hand stages and Full-Hand presentation cues to the visual states in section 11. Legal actions disappear at terminal state.
8. Add the compact horizontal timeline backed by `replay-projection/v1.timeline`, the bounded Replay `selectFrame(frameIndex)` navigation operation, Hero/current/result cues, and review form in section 12. Do not create a second action-history model.
9. Implement the concise canonical Hand and Full-Hand Training completion layers in section 13 using only data each surface already supports.
10. Route live Hand/Training to Play projection and earlier/saved/terminal review states to Review projection. Add renderer-level passive Analyze/Saved projection variants, but do not redesign those workspaces.
11. Preserve table collapse, all current layout presets, both density modes, built-in/custom themes, all card customization, EN/RU/HE/RTL, accessibility, reduced motion, and PERF-001 invalidation/invocation guarantees.
12. Update tutorial anchors/copy only where the visible Hand/Replay/Full-Hand flow changes, as required by the tutorial policy.

### 18.3 Focused automated acceptance

- DOM-free table-presentation contract tests for projection mapping, geometry family, role priority, immutability, and no poker derivation.
- Exact anchor-template tests for 2 through 10 players and stable Hero index zero.
- TableRenderer structure tests for family/projection classes, seat detail, cards, dealer, contributions, pot, actor, folded, all-in, and accessibility labels.
- Action-dock tests for legal-only actions, canonical amounts, Bet/Raise disclosure, range/exact synchronization, submit lock, Escape/focus, terminal removal, and no added sizing semantics.
- Replay tests for validated direct frame seek, compact/review timeline using the existing item source, selected position, and read-only live-Hand preservation.
- Full-Hand tests for Play -> terminal -> review composition and existing Matches/Close/Differs versus normative claim-policy wording.
- Regression tests for one shared table renderer/mount, Saved canonical Replay source, layout/density/theme/card preference independence, collapse, RTL/LTR poker islands, and reduced motion.
- PERF-001 checks: no additional StrategyProvider or Equity resolution; hidden Analyze/Matrix surfaces remain lazy; table projection is derived from already available state.

### 18.4 Manual Firefox acceptance

At 1920x1080, 2560x1440, 2560x1600, and 4K:

- HU, 3-handed, 4-handed, 6-max, 9-max, and 10-max live decisions;
- preflop, flop, turn/river, all-in, folded field, showdown, terminal, and replay-selected states;
- canonical Hand and Full-Hand Training;
- Balanced, Table Focus, Controls First; Comfortable and Compact;
- Midnight, Daylight, and one custom felt theme;
- EN, RU, HE/RTL; keyboard-only; 90/110/125% zoom; reduced motion;
- no clipped cards/names/contributions, no table/action overlap, no global overflow, no inaccessible actions, and no unsupported claim text.

Structural tests do not close the visual QA items. Screenshot evidence may support review but human Firefox acceptance remains required.

### 18.5 Expected implementation touchpoints

Likely owned files include:

- a new application `table-presentation` view-model module;
- `app/src/ui/TableRenderer.js`;
- `app/src/ui/PokerPrimitives.js` only if a fixed decorative pot variant is needed;
- `app/src/application/replay-projection-controller.mjs` for direct seek only;
- Playbook/Training presentation integration in `app/src/core/logic.js` and existing bootstraps;
- bounded Hand/Training markup in `app/index.html`;
- table/dock/timeline/projection rules in `app/styles.css` using existing tokens;
- focused tests and tutorial/localization files required by the visible change.

The implementer must inspect current HEAD again. This list identifies seams, not permission for unrelated cleanup or a stylesheet rewrite.

## 19. Explicit non-goals

`TABLE-PRESENCE-002` does not include:

- any poker rule, legality, accounting, evaluator, Equity, strategy, reference, solver, grading, Personal Strategy, or Training-generation change;
- new persisted schemas or changes to Saved canonical Replay payloads;
- a full Replay rewrite, renderer-frame storage, or a new history authority;
- full Saved/Home library redesign or master-detail implementation;
- Matrix/Range/Analysis redesign;
- Training Memory, mistake history, similar-spot practice, spaced review, or session trends;
- opponent personalities, avatars, bot-policy redesign, or profile integration;
- audio additions;
- a general animation system or physical chip/card travel;
- denomination-aware chips, side-pot visualization, or 3D casino graphics;
- mobile composition;
- new themes, layout presets, density modes, card styles, card sizes, or customization controls;
- GTO Wizard branding, exact colors, assets, layouts, or wording;
- unsupported GTO/EV/exploitability/mistake claims;
- opportunistic closure of unrelated QA backlog items.

## 20. Implementation readiness

The ticket is ready for implementation after human review of this brief. The canonical data seams needed for adaptive table facts, exact legal actions, current contributions, Replay frames/timeline, Full-Hand phase cues, cards, chips, themes, density, layouts, and reduced motion already exist.

No schema migration or architecture rewrite is required. The only new contract is an ephemeral application presentation model, and the only Replay extension is bounded direct frame navigation over already canonical frames.

## 21. `FULL-HAND-REVIEW-001` bounded workflow delta

The Table Presence brief remained the primary competitive reference. No additional market survey was needed: current Head already contained the GTO Wizard Full Hand Drill observations required to choose the review workflow.

### ADOPT

- A chronological, decision-by-decision post-hand path with an obvious optional Review entry after completion.
- One compact Hero-decision navigator, a selected-decision comparison, and direct movement through the surrounding canonical Replay.
- Mixed action frequencies kept visible, with both the observed action and the source's highest-frequency action clearly marked.

### ADAPT

- Use Riverline's immutable Hero decision journal and pre-action Replay event sequence instead of reconstructing decisions from presentation text.
- Treat the strongest source-probability disagreement as a transparent review priority only. It is neither monetary importance nor EV loss.
- Keep the table as supporting context while the decision navigator and comparison remain the learning hierarchy.

### DIFFERENTIATE

- Preserve a useful canonical Hand, context, chosen action, and Replay when the selected strategy source is unavailable or generalized.
- Keep source identity, coverage, precision, and limitations accessible in compact progressive disclosure.
- Reuse the same Review projection and presentation for normal Hand and Full-Hand Training, with source-specific terminal actions rather than duplicate review implementations.

### REJECT

- Solver-score, hand-grade, exploitability, accuracy, `bb`-loss, or “biggest mistake” theater without an authority that can support it.
- `Correct`, `Mistake`, or objective-GTO wording for generalized comparative heuristic results.
- A second timeline, Replay cursor, poker-state authority, Saved schema, or Analysis implementation.
