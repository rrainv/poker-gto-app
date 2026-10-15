# Riverline mockup review log (October 2026)

Exploratory design canvases made in the manager chat while the owner was away from the PC. They narrow research; they are not approved designs. Final decisions happen on the PC with full-size review. Owner judgement is final.

General feedback (all mockups):
- Padding and text alignment are flawed throughout; production work fixes them against the comfort contract.
- The mockups approximate the app shell; final mockups must match the real shell (sidebar, header, icons) unless the shell itself is being redesigned.

## 1. Training drill (https://claude.ai/artifact/9DNvuK1BP95FhHXNbwmEhG)
Screens: decision state; after-answer state (feedback strip replaces the answer buttons in place; "You chose X · Baseline: Y · close", Verified tier with reason, mix bar with "you" marker, one-line why, Next as the only accent action).
Owner feedback:
- Answer/decision area too small and too low; must be bigger and more prominent.
- Open: should single-decision drills show a table at all, or an abstract table-less spot ("a decision in a vacuum")? A table everywhere requires heavy table and animation investment. Options to compare on PC: full table, compact spot view without table, small table + big decision area. Possibly a user preference if both look good.

Training modes (same canvas, second row, 1920×1080, sidebar 4 with Training active):
- Quick refresher (no table): progress dots for 10 spots in the header; large hole cards; one-line situation ("CO raises to 2.5 bb. Folded to you.") with action chips; the colour-tinted decision cards (Fold / Call "needs 38.5% · price only" / 3-bet with sizes inside); Unsure; confirm button carrying the amount.
- Long session (table): atmospheric felt with semi-abstract bots, the seat-style decision buttons with a size chip bar and one cost line; right rail with session progress (spot 4 of 20, time, playing as, feedback timing) and this hand's history.
Owner feedback: direction liked but unpolished: too big in places, unbalanced. The long-session table is too big; the current app's table sizes look better and more like real tables. The quick refresher is too empty; Training needs more useful panels or features to make the mode viable. The shell is again invented. Approving decisions needs reasonably realistic design, not just direction.

## 2. Personal Strategy (https://claude.ai/artifact/QJSHwD9MKXBuwrytU2ajWo)
Screens:
1. Question flow: spot map (positions × first in / vs open / vs 3-bet with state), "Continue where it matters", current question with an edge-family strip (54s→KQs, Never/Sometimes/Always, markers), in-context conflict card (KTo plan vs Training 7/9), edge map, small three-state matrix ("not asked yet is unknown, never fold").
2. Answer methods for a 3-action spot (BTN vs late open, suited connectors): action brush, thresholds, buckets, table question.
3. Your style: plan vs played vs baseline (VPIP, PFR, 3-bet vs late open, calling 3-bets OOP; plan shown as bounds when hands are unasked; played with samples; baseline with tier), opening width by position, "what stands out" (plan-vs-play notes and one labelled hypothesis). Example data.
Owner feedback and manager analysis:
- The flow separates spots, questions and stats well; it must capture enough to picture a playstyle. Missing pieces identified: multi-action mixes (3-bet/call/fold split), sizing preferences, stack-depth variants, postflop tendencies (M3 rules), and a computed style readout.
- Small matrix is right; make it expandable.
- Hand categories need deeper thought: research a two-layer taxonomy (structural families for asking; strategic roles such as wheel aces, set-mining pairs, dominated offsuit hands for teaching/style), whether roles are spot-dependent, and how coaching sites group hands (reference pass, no copying).
- Answer methods are not ideal yet; compare and possibly combine (structure via brush or thresholds + table questions for edges). Table-style spot questions may have a place.

## 3. Full Hand / Orbit table (https://claude.ai/artifact/7u8MoEspbtCGn3gQRDatb5)
Screen: Orbit hand 3 of 12, flop decision; premium felt/rail with lighting and shadows; semi-abstract bot characters (Astra, Orion, Vega, Lyra, Nebula) with geometric avatars; 64px action buttons + custom size slider; right rail with Orbit session (playing as, stack carry, feedback at end, running result, end early), hand history by street, exact facts (pot, effective, SPR).
Owner feedback:
- Likes the table direction and the abstract characters; seat positioning and fold dimming need tuning.
- Abstract characters must integrate with bot playstyle management (OpponentPolicy presets, per-seat assignment, lineups); needs substantial design work.
- Decision controls (Training and Full Hand) unresolved: the problems are generic-form feel, clumsy sizing, unclear costs, clutter, visual style, and placement. None of the concept directions (poker-client buttons with sizing tray, cost preview, controls at the seat, choice cards) made it look better. Treat as a visual exploration on the PC: collect reference apps the owner likes, then build 3–4 visually different variants that fix the functional issues.
- Open: should Play mode show a running result?

## 4. Home (https://claude.ai/artifact/Ec2hY4gurv8oBoEjrZfk3c)
Screen: primary Continue (Orbit resume, only accent action), Suggested for you (each with evidence and a tag: plan vs play, plan gap, session), Recent, Start something; right rail Due and flagged, What Riverline noticed, Plan coverage mini map, Home Game status.
Owner feedback: looks good mostly. Wants Chippy or other design touches on Home later (M2–M3). Main concern: users may not open Home because every mode is reachable from the sidebar; its summaries have a hard job being useful enough. The "Suggested for you" panel feels phone-like (its larger type contrasts with the rest of the page), though making it identical to the other panels would look boring.
Manager ideas to test: give Home something only Home has, e.g. a one-click "today's session" (a ready 15-minute plan built from due items, suggestions and recent hands), game-night hands from the last session, and visible skill progress (evidence-based motivator); give "Suggested for you" emphasis through mini-visuals (cards, a tiny range, a small trend) rather than bigger type.
Home v2 (same canvas, 1920×1080, sidebar 4 with Home as the Study hub): a one-click "Today's session" (about 15 minutes: revisit 3 unsure spots, drill BB defence, review 2 hands from Thursday) with Start as the only accent action; "From Thursday's game night" hands with results; "Your progress" with three honest trends and samples (no streaks); "Also worth your time" suggestions with mini visuals at normal type size; right rail Continue (Orbit), Due, plan coverage. Owner feedback: likes it very much: the screen's dynamics and the more graphical displays. Prefers some v1 panels, especially the labelled plan coverage table (positions × first in / vs open / vs 3-bet). The trend graphs are not useful enough. Every panel must earn its place; no dead space, no needlessly long or tall bars. With sidebar 4, Home stays a separate entity with room for future content; the Study hub gets its own screen (not Home).

## 5. Equity (https://claude.ai/artifact/QZ4J2TQiNhjsbUEgnZpoHo)
Screens:
1. Matchup: board row (flop + empty turn/river slots), dead cards, Random hands / Random board / Clear; one players table with rows (Player, typed input Cards/Range/Random, hand or range with live validation and combo count after card removal, "Pick from your plan" link, equity bar, win, tie, combos); "+ Add player" (rows stay the same size, up to 10); method badge (Simulated ±0.3% · 200,000 runouts) with Calculate as the only accent action because multiway-with-range is heavy; note that heads-up exact results update as you type. Example data.
2. Runouts: heads-up A♥K♥ vs Q♠Q♣ on Q♥7♣2♥; Hero-now equity; perspective toggle (Hero/Villain); every turn card in a suit × rank grid coloured by Hero's equity after it (cards in play struck through), Exact badge; "What the turn does" grouped outs in plain language (hearts = dirty flush outs, J/T gutshot, A/K pair still behind, board pairs give Villain a full house); hover a group highlights its cards. Example data.
Owner feedback:
- Fresh, modern look, but the realization is lacking. Straighten out the basics first (maths, then runouts) before advanced Equity features.
- Do not mix Random with undecided. Undecided cards are unknown (every available card counts); Random is a generator action that deals specific cards when pressed. Input types become Cards / Range / Unknown, with a Random button beside them.
- App-wide: represent states visually, not only in words (e.g. two face-down card backs for an unknown hand, not just "Any two cards"). Words may stay as support.
- Not convinced by the rows layout. Try other designs before deciding; rows may remain as one candidate. Controls need rethinking. Shell still inaccurate.
- Runouts should focus on each player: how each player improves and how the board plays out (e.g. per-player chances of reaching each hand category by the river). The per-card grid is useful at a glance but secondary.

### Equity option B (same canvas, second row)
3. Matchup B: board on felt at the top (dashed turn/river slots, dice button for a random board, dead cards); players as columns (Hero, Villain 1 range, Villain 2 Unknown shown as two face-down card backs); each column has its own dice button (deals specific random cards), a Cards / Range / Unknown switch, an equity ring with win/tie; an "Add player" column drawn as card backs. Calculate stays the only accent action.
4. Runouts B, per player: each player's column shows "by the river, this player makes" (hand-category probabilities) and the equity range after the turn (now / best turn / worst turn), plus a one-line story; a "How the board plays out" panel lists the scenarios that decide the hand; the per-card grid is behind "Show every turn card". Example data.
Owner feedback: both options look good; choose on the PC.

## 6. Review (https://claude.ai/artifact/MkdkDSTN5WY7mc1vWsP7Zs)
Hand: BTN A♠K♦ vs BB 3-bet, flop K♠8♥4♥ call, turn 2♣ all-in call, river 9♥ (BB Q♥J♥), lost 100 bb. Example data, maths checked.
Layout: left the street-grouped history rail (Hero decisions emphasised, selected decision highlighted, coloured key-moment dots); centre the selected decision (2 of 3) with prev/next, a felt strip showing cards and board at that moment (villain cards dimmed as "shown later"), "You called 7 bb · Baseline: Raise · leans" with the Estimated tier, mix bar with "you" marker, one-paragraph why, exact facts (to call, required equity 19.2%, SPR before 4.0, after 2.2), actions Next decision (only accent) / Explain / Open in Analyze / Save spot; right Key moments (biggest deviation, commitment point, highest stakes; "possible reading, not a verdict") and Decisions vs luck (luck moment river 9♥, result −100 bb, expected at the all-in +60 bb, run-out luck −160 bb, Exact, with the formula).
Owner feedback: likes the idea and design. The left rail wasted space (rows spread actor and action to opposite edges, leaving dead space in the middle) and half its rows rendered white (unstyled button backgrounds). Corrected: compact three-column rows (marker, actor, action), transparent backgrounds, narrower rail. Text alignment problems remain throughout (mockup-level; fix in production).

## 7. Hand reconstruction (https://claude.ai/artifact/KWaXJUnCPCE6rsMVcT2aHy)
State: preflop, UTG raised to 3 bb, HJ to act, Hero on the BTN with A♣Q♣ entered, Table rules chip "Home game · 100 bb".
Layout: table with the current actor highlighted and empty board slots; action input under it: Fold / Call 3 bb / Raise, "Everyone else folds to you", a Raise-to tray with presets (3x 9 bb, 3.5x 10.5 bb, 4x 12 bb, Pot 10.5 bb, All-in) plus exact amount and "I don't remember exactly, mark as approximate"; confirm button carries the amount ("Raise to 10.5 bb", only accent action). Right rail: hand so far (compact rows, Undo, Replay), cards (yours; opponents as face-down backs, "unknown cards stay unknown"), Faster (paste a hand history, key hints).
Owner feedback: very promising; some things to tighten. Similar features across the app (hand history and others) must be reworked to look and behave the same.

## 8. Home Game (https://claude.ai/artifact/HnM2fLZBjgT64sg7wpMy47)
State: ending the night, Thursday group, chips mode (₪200 = 10,000 chips), Eli's cash-out being entered in chips. Example data, sums checked.
Layout: ledger table (player, bought in incl. per-player starting buy-in and rebuys, cash out in money with chips beneath, net, row actions Rebuy / Cash out / Correct), totals row (₪1,700 in, ₪1,500 out, ₪200 off); right rail: balance gate ("₪200 more went in than came out; exactly one buy-in: a missed cash-out or a rebuy entered twice?" with Review Eli / Show all entries), settlement with Fewest transfers / Banker switch and a transfer preview, "Settle the night" disabled until balanced; session card (date, preset, chip rate, blinds recorded, notes). Note that every change stays in history and corrections can be corrected again.
Owner feedback: good enough, but listing each rebuy as text cannot fit many rebuys. Corrected: the bought-in column shows the total plus a count ("₪400 · 2 buy-ins") and an "entries" button that opens the individual buy-ins; production should handle any number of rebuys without widening the row. Follow-up: rebuys can be different amounts; the total stays correct, and the opened entries list shows each buy-in with its time and amount (example: Dan ₪200 + ₪100 + ₪100) with "Correct an entry". The Rebuy action asks for the amount, defaulting to the preset.
Further owner feedback (2026-10-11): mostly perfect. Text tweaks: drop the "entries" label on every row and make the bought-in cell look expandable instead (e.g. a chevron); "Correct" should read "Edit" (history still keeps every change underneath). Should be ready for future links with Hand, history, Saved and other workspaces.

## 9. Learn hub (https://claude.ai/artifact/HBhMraUpUw3SKkunukRt9z)
Layout: Continue learning (next starter lesson, ends with a short drill in Training; Start lesson is the only accent action); Starter lessons 2 of 6 done (pot odds, position, ranges, confidence tiers, Games and Approaches, reading a session report) with done / next / not-started marks; Tutorials per workspace with state (completed, skipped, updated, not started) and Start / Restart; right rail Poker glossary (search, term card with definition, RU/HE term from the terminology sheet, where it's used, quick term chips), How Riverline works (guide articles), What's new.
Owner feedback on option A: decent, but needs more standalone value to be a reasonable addition, and it looks too similar to Home (both a big CTA card plus lists in a rail).
Direction: Home = your personal state (resume, due, noticed); Learn = a place to explore and practise concepts, with its own visual language.
Option B (same canvas): a learning path map (Pot odds → Equity → Ranges → Blockers → Bluffing, with Position, SPR and commitment, Value betting, Reading a session; states done / in progress / ready / locked; the path suggests an order but any concept can be picked); a selected-concept panel (Ranges: one-line explanation, mini range picture, Continue lesson as the only accent action, its trainer, Drill it in Training, linked glossary terms); four quick trainers that only live in Learn, each with an honest record (pot odds 6 into 12 → 25%, count the outs 8♥7♥ on 6♥5♣K♥ → 15, equity guess AK vs QQ with a slider, read the range on a mini matrix); glossary, tutorials, guide and what's new demoted to a link row. Example data, answers checked.
Owner feedback on A vs B: A looks basic but works very well (order, style, execution). B is very unique and fun to look at. Direction: a mix, keeping B's concept path and quick trainers with A's order and features (lesson list, tutorial states, glossary). General rule: a playful design is only worth it when it does the job as well as, or better than, the serious alternative.

## 10. Settings (https://claude.ai/artifact/NvWWdHFscXVyonHi7mSGhZ)
Layout: three columns. Categories (Appearance, Audio & Motion, Language, Help & guide, Shortcuts, Account & Data) with one-line descriptions; Appearance content: theme cards with colour swatches (Midnight in use, Daylight, Felt, Slate; theme names other than Midnight/Daylight are placeholders), "Duplicate and customise" (built-ins stay immutable), cards (four/two suit colours, T or 10, card back choice), text size (Default/Larger); live preview panel (felt with cards, verdict line, mix bar, primary/secondary buttons, note that contrast is checked for every theme). Opened from the sidebar gear, which shows as active.
Owner feedback: loves the new identity. Never double-signal a state: no "In use" label on a slot already marked by the accent; rethink this app-wide. Shell and card backs were again invented; the real card backs are good and must be used. The mockup shell itself looks fresh and modern, even compared with the updated real design, so a shell refresh toward it is a candidate for M1.

### Settings sub-screens (same canvas)
"In use" label removed from the Appearance theme card (no double-signal).
- Audio & Motion: per-category volume sliders (master, cards, chips, study cues, system errors only) with a play-sample button each; study cues switch ("never sounds like right or wrong"); reduced motion Follow system / On / Off ("keeps short pauses so you can follow"); card and chip animations Smooth / Minimal.
- Language: three language cards each showing a real sample string in that language (Hebrew card right-to-left); number format from language or fixed; poker terms note linking the glossary; note that switching language keeps everything open where it is.
- Help & guide: offer tutorials on first visit, link to Learn for restarting, glossary definitions on hover, keyboard hints on buttons (off by default, keys always work), Chippy switch (coming later).
- Shortcuts: grouped key tables (Everywhere, Training, Hand, Review and Replay) with key caps; same keys wherever the action exists. Owner: shortcuts must be configurable. Added: click a key to rebind, a rebinding state with clash check, Reset to defaults.
- Account & Data: guest status (sign-in and sync later, disabled), what is stored on this device with counts, backup export/import (coming later, disabled), delete all local data (danger styling).
Owner feedback: no real notes on the Settings sub-screens for now; improvements later. App-wide design rules apply here too. Theme preview should be extended with a table preview (or a separate table theme picker), later also Chippy, bot characters and chips. Legal and official documents (privacy, cookies, terms, licences, disclaimers) are needed in the future; see NORTH_STAR §7.11.

## Status
All mockups are exploratory. They narrow research and show options; final choices are made on the PC with full-size review.

## 11. My poker (https://claude.ai/artifact/4jx3ekEbqMNud57cdRwgyL)
Working name "My poker" (owner decides the name after seeing it). One sidebar entry (RIVERLINE section) gathering everything set up once and reused, with five tabs:
1. Table rules: your rules and built-ins (Online 9-max, Private table, Short-stacked home, Heads-up) with a detail view (players, blinds and optional straddle, antes, rake, stacks as a range, amounts in bb with ₪ typing), where it is used, and version history (saved hands keep their version).
2. Games & Approaches: each Game with its Table rules and Approaches (default marked by text, decisions and taught-hands counts, last used, Open plan).
3. People & groups: Game night people (nights played, last seen) and groups (rosters, usual preset).
4. Game night presets: money side of a night (buy-in, blinds recorded, chips or points mode, chip rate, settlement).
5. Bot tables (preview of an M3 feature): saved lineups with semi-abstract characters and visible playstyles, plus your custom playstyles.
Owner feedback: looks good and reasonable; likes the design, the standalone page and the placement for now. Open commitments: does it deserve a sidebar slot (it sits low, and users may never click it unless workspaces offer "Save as…" / "Manage…" entry points everywhere); the sidebar may need a general rework (with the shell refresh); a possible merge with Saved into one "Library" of things you keep.

## 12. Sidebar variants (on the My poker canvas, https://claude.ai/artifact/4jx3ekEbqMNud57cdRwgyL)
Five rail options for the M1 shell refresh, Training active in each:
1. Current, refreshed: CORE STUDY (Hand, Analyze, Training, Personal Strategy, Equity, Saved) + RIVERLINE (Home, Game night, Learn, My poker).
2. Home first, grouped by job: Home; STUDY (Training, Personal Strategy, Learn); TOOLS (Hand, Analyze, Equity); YOURS (Library = Saved + My poker, Game night).
3. Compact icon rail: icons only, labels on hover, widens on demand.
4. Hubs with sub-items: Home, Study (opens Training, Personal Strategy, Learn), Tools, Library, then Game night.
5. The learning loop: Home, then numbered steps Play or record → Analyze → Plan → Train, then Equity, Library, Learn, Game night.
All share a footer with language, sound, settings and an About & legal link.
Owner feedback: variants 2 (Home first, grouped by job) and 4 (hubs with sub-items) look best; the current refreshed rail (1) stays in consideration. If 4 is chosen, "Study" and "Tools" might be screens of their own (no clear idea yet for their content).

## 13. Language and theme check (https://claude.ai/artifact/WDNVjr9NcmRuuwEz76jJsu)
1920×1080. The Training feedback panel for one spot (K♠Q♦ on the button vs a CO open) in four settings: English Midnight, Russian Midnight, Hebrew Midnight (right-to-left), English Daylight. Uses the terminology sheet (колл, 3-бет, пас; קול, 3-בט, פולד; tier Подтверждено / מאומת). Poker data (cards, bb amounts, percentages, CO) stays left-to-right inside Hebrew text; the mix bar is kept left-to-right as a data island (to confirm). Hebrew buttons use the masculine imperative where natural (הסבר, שמור ספוט). Daylight palette is a first draft.
Owner feedback: good, works as intended. Viewer note: the fixed 1920×1080 board could only be viewed with "fill" on the owner's device, not zoomed freely.

## 14. Shell refresh (https://claude.ai/artifact/JGdFYsoCKu2QSz4vQVkVsc)
1920×1080, Home in the refreshed shell with three sidebars for comparison: 2 "Home first, grouped by job" (entry board), 4 "hubs with sub-items" (Study expanded), 1 "current, refreshed". Footer: language, sound, settings, About & legal.
Owner feedback: prefers sidebar 4 if at least some hubs get real sub-screens; without them it's a tough choice between 2 and 4.

## 15. Decision controls (same canvas, second row)
One decision (K♠Q♦ on the button vs a CO open to 2.5 bb, 100 bb) in four looks, all fixing the functional issues (sizing in one place, visible costs, little clutter): 1 Slabs (three large action slabs with amount and cost, size chips, confirm button); 2 Command bar (floating pill bar with a size slider showing bb, multiple and stack share; costs on hover); 3 Choice cards (each action as a card with amount, price or stack after; confirm); 4 At your seat (round action buttons on the felt near your cards, size chips). Numbers checked (38.5% to call, 3.2× open, 92 bb after 3-betting to 8).
Owner feedback: either a mix of 1 (Slabs) and 3 (Choice cards), using the bigger cards but with action accent colours and raise-size choices, or 4 (At your seat) with some tweaking. Both directions look good.

## 16. Decision controls round 2 and Tools hub (shell refresh canvas, second row)
- Controls round 2 (1920×1080): A "cards with colour and sizes" (big cards tinted by action colour, selected card checked, raise sizes inside the 3-bet card, confirm button carrying the amount); B "at your seat, tweaked" (larger round buttons on the felt, size chips above them, one cost line, click again to confirm).
- Tools hub screen with sidebar 4 (Tools expanded): three columns Hand / Analyze / Equity, each with a New button and its recent work (hands with result, spots, calculations), plus quick actions (paste a hand history, hands from Friday's game night, random spot, random hands).
Owner feedback: likes round 2 more than round 1 (both control directions and the Tools hub); not committing to a single option yet.

## 17. Display typeface test (https://claude.ai/artifact/Rrk5RWfj1u2nxxj9PzbtPh)
1920×1080. Headings only (body stays the UI font). Four candidates, each showing a workspace title, a verdict, a section heading, Russian and Hebrew headings and numbers: current UI font (Segoe UI Variable, heavy); Rubik (Latin, Cyrillic, Hebrew in one family); Fraunces (display serif, Latin only, RU/HE fall back); Noto Serif Display with Noto Serif Hebrew. Script coverage should be confirmed on the PC; fonts load from Google Fonts and fall back if blocked.
Owner feedback: the two serif options look bad and unprofessional; it is between the current UI font and Rubik, leaning to Rubik for its bolder headings. Both acceptable for now.

## 18. Home v3 and Study hub (shell refresh canvas, third row)
Testing the split "Home = what's happening in my poker, Study = where my learning stands" with sidebar 4.
- Home v3: Continue (Orbit resume, the one accent action); Today's session as a compact invitation (chips: 3 reviews, 6 BB defence spots, 2 hands) with Start session / Open Study; Thursday's game night (status plus its hands with results); What Riverline noticed (two patterns with samples and mini visuals). No trend graphs. Room left for later app-wide content.
- Study hub: the plan coverage table (positions × first in / vs open / vs 3-bet, clickable cells, "no spot" for impossible cells, "Continue where it matters"); drill launcher with the two modes (quick refresher / long session) and focus chips; review queue with why each item is due; learning path chips with Continue.
Owner feedback: reasonable for now and better, though far from perfect; some visual issues (not critical for a mockup). The split is not a commitment yet; more feedback later.

## 19. Design kit (https://claude.ai/artifact/SStpE2d5pkehonTDTfWadu)
The canonical base for every future mockup, built from the canvases the owner liked (the redesign's target look, not the current app):
1. Shell template (1920×1080): sidebar 4, 56 px header with one context line and a context chip, 28 px content padding, primary area plus a 340 px right rail, 12 px panel radius, 20 px panel padding, 24 px gaps, content max ~1600 px.
2. Components: buttons (40 px, one primary per view), tabs, segmented control, switch, field, chips, fact grid, tier badges, mix bar, history rail rows, seats, ledger row, cards by context (inline 22×30, mini 30×42, standard 46×64, table 58×82; dashed slots mark where the real card back goes), type scale with Rubik headings.
3. Table at a realistic size: table block 900×470 (felt 780×356) inside the shell, standard cards on the table, compact seats, a reserved decision area under it, This hand and Facts in the rail.
Real card backs, icons and the current table's measurements come from MOCKUP-ASSETS-001.
Owner feedback: decent; issues are not big. Needs the real card back from the app or a modernised one, better text formatting, and fixes for text bleeding out of panels. Applied: a modernised card back proposal (forest lattice with a brass inner border and the leaf mark), flexible columns in the ledger, history and fact grid, wrapping seats, long words wrap inside panels.

## 20. All screens on the kit (https://claude.ai/artifact/T3AFKWngjB7Wwt16S4Ghts)
Eleven screens re-drawn on the design kit (sidebar 4, same shell, sizes and components): Home, Study, Training quick refresher (with opener range, session results and an after-answer panel), Training long session (realistic table, seat buttons), Review, Hand, Equity (players as columns), Personal Strategy, Game night (gate counts only committed entries), Library (Saved + My poker), Settings (with table and card-back choices and a live preview).
Owner feedback: decent. The owner has many corrections still to give on these screens; collect them in a dedicated review pass later (Manager to bring it up).

## 21. Analyze on the kit (screens-on-the-kit canvas, boards 12 and 13)
Same spot (K♠Q♦ on the button vs a CO open to 2.5 bb, 100 bb) in two layouts. A: two columns, the spot panel left (position, cards, action before you, stacks, street stepper, history rows) and the result right (verdict "3-bet or call · close" with the Verified tier, mix bar 55/40/5, facts incl. "38.5% · price only", short why with "Explain in more depth", Save spot / Drill similar spots / Open in Equity, source and limitations) plus the baseline range for the spot with K♠Q♦ outlined. B: the spot as a felt strip on top (cards, one-line situation, action chips, street stepper, Edit spot), result and range below.
Owner feedback: both options forget the design principles. Biggest issue: pseudo dead space (long strips whose content fits in a fraction of the space: wide fields with short values, history rows with actor far left and action far right, a lone badge at the end of a line); use that space for something useful. A large matrix of unlabelled coloured squares looks goofy; small matrices are fine but must show the hand and combos on hover. Keep every principle in mind: no real or pseudo dead space, raw info plus friendliness, good colour accents and panels, modern, slick, smooth, animations and sound, strong pointer reactions (hover, click, hold).
Board 14, Analyze v3: the spot as one row of content-sized editable chips (you, cards, before, stacks, players) with the street stepper and Random spot; result as a compact band (verdict with tier next to it, mix bar beside it, four facts incl. equity vs the CO range marked Estimated, a short why, Drill similar spots as the primary action); freed space used for "You in this spot" (your plan, your Training record, saved hands); a large labelled matrix (hand names in every cell, mixed cells split by action colour, hero hand outlined, a hover card with combos left and the mix, Baseline / Your plan switch).
Feedback on v3: much better, but in places it reads as raw info rather than a clean, friendly interface with Apple-level smoothness. Goal: a mix: nearly all raw data available, while the screen looks clean, not empty, and smooth.
Board 15, Analyze v4 ("calm surface, deep data"): the spot as one friendly sentence with large hole cards and an underline street stepper; a hero verdict card (large verdict, "close call" and Verified pills next to it, a thick mix bar with labels inside the segments, one plain-language sentence, Drill similar spots as the primary action, "All details ›" for the raw data); three soft number tiles (equity needed, equity vs CO's range marked estimated, pot); "You here" as three clickable pills (your plan, Training record, saved hands); the labelled matrix with softer labels, a Baseline / Your plan / Compare switch and a hover card. Softer panels (16 px radius, gentle gradient and shadow), fewer overline labels. Owner feedback: much better, close to perfect; buttons could pop a little more with accent colour. This becomes the style for the app: screens, mockups, polish and ideas are based on it. All screens on the kit were then rebuilt in this style (soft panels, sentence-case titles, labelled thick mix bars, pill chips, tier pills with dots, gradient primary buttons, tinted secondary buttons) and the kit got a "Style v4" board.

## 22. Motion prototype (https://claude.ai/artifact/KAVPFd47pgvoMVdPfREQNJ)
A working quick drill in Style v4 (three spots: BTN vs CO open, BB vs BTN open, CO first in). Real interactions: cards deal in; action cards lift on hover, press down, tint and check when chosen; raise-size pills; the confirm button carries the amount and can confirm by click or by hold (a fill sweeps across); the decision area and the feedback swap in place (reserved height, no layout jump); the mix bar grows into place with labels and a "you" marker, hover tooltips on segments; neutral "inside / outside the baseline's mix" wording (not right or wrong); the session panel and the after-answer reveal update live; progress bars fill; soft synthesised sounds (tick, select, neutral chime, card swish) with a sound switch; Smooth / Reduced motion switch; keys F, C, R, 1–5, U, Enter.
Owner: will refine smoothness and polish on the PC; wants a very high level of polish before the heavy feature work.
Owner feedback: the concept looks much better; the layout is a bit wonky on the phone (it is built for desktop).

## Independent review corrections (2026-10)
Mockup numbers are illustrative; these were checked by exact enumeration and are wrong in the canvases:
- Equity runouts (A♥K♥ vs Q♠Q♣ on Q♥7♣2♥): Hero now 25.6% (not 26.2%); 7♥ turn 0% (pairs board, Villain full house); 7/2 non-heart turns 0%; A/K 18.2%; J/T 22.7%; blanks 15.9%; Hero worst turn 0%, Villain best 100%. Grouped outs: A or K is 6 cards (−7.4 pts); board pairs −25.6 pts; after a paired turn a flush never wins. Q♦ and blanks were not grouped. Option B must add "non-heart turn, heart river" (~43% of Hero's wins); Hero's by-river split is 36.4 / 0.9 / 19.7 / 43.0.
- Style: "Call 3-bet OOP played 38% · 14 spots" contradicts "11 of 14" (79%). Plan point values are impossible with unweighted Sometimes; show bounds.
- Learn B: "UTG opens, then 3-bets a 4-bet" should be "4-bets a 3-bet"; pot-odds wording must say "pot before the bet".
- Home Game: recorded cash-outs total ₪1,300 (gap ₪400) until Eli's entry is committed; the gate must use committed entries only.
- Orbit: stacks shown at 100 bb despite "stacks carry over" and +3.5 bb.
- Review: verdict "leans" is not a valid state; 58/38 is dominant under the 20-point rule.
- Training: "Required equity 38.5% · Exact" should read "Exact · price only" and show that SB and BB are still to act.
