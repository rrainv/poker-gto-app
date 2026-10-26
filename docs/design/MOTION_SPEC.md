# Riverline motion spec (draft from the motion catalog, owner-approved direction 2026-10-18/19)

Source canvases: part 1 https://claude.ai/artifact/57zRYjjv2nqpX67cyPrbzw · part 2 https://claude.ai/artifact/6oSKHkdTMWx6UXu6gvRSa4 · part 3 https://claude.ai/artifact/4nNsyDcBCr1Aigbws7CZEC. Rules: PHASE1_DECISIONS P1-06…P1-10. Durations below are at Standard; "tempo" is the playback factor chosen by the owner (Snappy 1.0, Balanced 0.7, Fluid 0.5), so real duration = base ÷ tempo.

## Global rules
- Frequency decides motion; anything keyboard-triggered is instant.
- One global Motion setting scales everything: Instant / Faster (×1.6 speed) / Standard / Reduced (opacity fades ≤200 ms only; follows the system setting by default).
- Curves: ease-out `cubic-bezier(.23,1,.32,1)` for entrances and responses; ease-in-out `cubic-bezier(.77,0,.175,1)` for things moving on screen; drawer `cubic-bezier(.32,.72,0,1)` for sheets and toasts; spring `cubic-bezier(.34,1.36,.64,1)` only for small confirmations (checks, bumps). Never ease-in for entrances.
- Exits faster than entrances; press = scale .97; popovers grow from their trigger; hover only for fine pointers.
- 60 fps: transform, opacity, clip-path only; no animated layout properties or box-shadow; no per-frame JS; profile in Firefox.

## Moments
| # | Moment | Where | Choreography (base durations) | Tempo |
|---|---|---|---|---|
| 1 | Choosing an action | Drills, Analyze, table | border draws around in action colour (420), glow breathes once (900), others dim to .5 (220), check springs (320, +180 delay) | 0.7 |
| 2 | Confirming | Drills | button morphs to round jade check: label blur-out, width/radius (360 io), check rises (+180) | 0.7 |
| 3 | Answer reveal | Drills, Review | verdict rises (260); mix segments fill in turn (360 io, 140 apart); "you" marker drops with spring (420); reason fades (+900) | 0.7 |
| 4 | Changing numbers | Pot, stacks, counts | digits roll per column (520, 60 apart) | 0.7 |
| 5 | Chips to pot | Table | chips arc to pot (520, 70 apart), pot label bumps (260 spring) and rolls | 0.7 |
| 6 | Dealing the board | Table, Hand, Review | drop face down then 3D flip (620, 120 apart) | 0.7 |
| 7 | "All details" | Deep data | height to content (360 io), chevron turns, rows fade in (45 apart) | 0.7 |
| 8 | Tabs | Workspaces | underline glides (380 io); content slides from the direction of travel (340) | 0.7 |
| 9 | Saving | Anywhere | bookmark fills brass + spring; token arcs to Library (560); count bumps | 0.7 |
| 10 | Painting a range | Personal Strategy | colour change ripples outward by distance (38 per cell) with a small pop | 0.7 |
| 11 | Session progress / finish | Drills | dot fills per answer (spring); finish ring draws (900 io) and counts up | 0.7 |
| 12 | Toast | Anywhere | in on drawer curve (420), out faster (220) | 0.7 |
| 13 | Sidebar | Shell | active highlight glides (380 io); hovered icon nudges | ≈0.85 |
| 14 | Workspace switch | Shell | old: fade + scale .98 + blur (160); new: rise 10 px + blur bridge (340, +90) | 0.5 |
| 15/25 | Whose turn | Table | **A** halo + lift + timer bar, or **C** quiet "…" pill; action lands in the pill; fold dims | 0.7 (pick at PC) |
| 16 | Showdown | Table | hole cards turn; winning five lift with brass edge (spring), rest dim; result line | 0.7 |
| 17 | History rail | Hand, Replay, Full Hand | new row slides in (300), others ease up (320), current row highlighted | 0.5 |
| 18 | Equity updating | Equity, Review | new card flips in; bars resize together (520 io); numbers roll | ≈0.6 |
| 19 | Filtering a list | Library | FLIP: survivors glide (340), removed shrink (160), new grow (260) | 0.5 |
| 20 | Invalid input | Forms | short sideways nudge (320), warm edge, message opens below | ≈0.85 |
| 21 | Loading | Anywhere | shaped shimmer; content crossfades line by line (60 apart) | 0.5 |
| 22 | Theme change | Settings | circular reveal from the chosen swatch (700 io) | 0.5 |
| 23 | Game night settle | Game night | gate brass → jade with check; transfer arrows draw one by one (520 io) | 0.7 |
| 24 | Building the plan | Personal Strategy | spot map cells fill (600 io, staggered); conflict pulses twice in brass | 0.7 |
| 26 | Review stepping | Review | marker glides (420 io); card slides from step direction (360) | 0.7 |
| 27 | Luck moment | Review | equity line draws by street (1100 io); river drop turns brass; marker pulse; figure counts | ≈0.6 |
| 28 | Learning path | Learn | node fills, path draws to next (700 io), next node pops open | ≈0.6 |
| 29 | Trainer answer | Learn | true value slides from your guess (460); gap shades brass; result fades | 0.7 |
| 30 | Opening Home | Home | cards arrive in reading order (420, 70 apart); one sheen on Continue | ≈0.6 |
| 31 | Motion setting | Settings | live preview of Instant / Faster / Standard / Reduced | — |

## Part 4 (Settings, Learn, Library) — https://claude.ai/artifact/YBRHGvTJhQb8nD38Akgiqy (owner: "great, lovely direction, keep such work up", 2026-10-22)
| # | Moment | Where | Choreography | Tempo |
|---|---|---|---|---|
| 32 | Settings categories | Settings | highlight glides (380 io); page slides from direction of travel with blur bridge (320) | 0.7 |
| 33 | Switches | everywhere | knob stretches on press, springs across (360 spring); track fills | ≈0.85 |
| 34 | Sliders with live preview | Settings | value bubble rides the thumb; preview updates live | ≈0.85 |
| 35 | Rebinding a shortcut | Settings › Shortcuts | keycap pulses while listening; new key drops in (spring); clash = nudge + message | ≈0.85 |
| 36 | Switching language | Settings | text crossfade with blur; layout mirrors with a short slide for Hebrew; poker notation stays LTR | 0.5 |
| 37 | Opening a lesson | Learn | card grows from its place into the lesson (FLIP, 420); others fade | ≈0.6 |
| 38 | Lesson steps + quick check | Learn | steps fill (420 io); exact-maths answer confirms with a soft jade fill and small spring; a miss nudges | 0.7 |
| 39 | Library inspector | Library | selection swaps the inspector with a quick blur bridge (130 out / 260 in) | 0.7 |
| 40 | Archive with undo | Library | row folds out (200), list closes the gap (320), undo toast on the drawer curve | 0.7 |
| 41 | Search as you type | Library | survivors stay, removed fade (120), new fade in with 35 ms stagger; matches highlighted | ≈0.85 |
