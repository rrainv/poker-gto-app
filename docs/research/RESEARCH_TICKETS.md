# Riverline research tickets (R-01 to R-03, 2026-10-21)

How to run: one Gemini chat per ticket, browsing on (Argon if available). **First paste RIVERLINE_BRIEF.md, then the ticket.** Bring the report back to the Manager chat.

---
## R-01 · Free preflop and multiway solving

```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above).
Rules: open the actual sources (repos, papers, licence files, docs); quote and cite links;
mark your own reasoning as [Judgement]; write UNVERIFIED for anything you could not check.

WHY THIS MATTERS
Riverline wants trustworthy strategy for the spots its owner actually plays, without spending
money yet. Heads-up postflop is covered (b-inary/postflop-solver offline, outputs shipped as
data). The GAP is preflop and multiway No-Limit Hold'em:
- Home game: 6–8 handed, 30–60 bb deep, NO rake, often limped or multiway pots.
- Online: 6-max 100 bb (raked), 9-max 100 bb+ (raked).
Without a solution these stay "Estimated" in Riverline. Exact push/fold for very short stacks
is planned as Riverline's own model.

QUESTIONS
1. Free or open-source tools that solve or approximate PREFLOP (incl. multiway) for these
   formats. For each: what exactly it solves (players, depth, rake, sizes), quality and known
   accuracy, maintenance status, hardware needs, licence, and whether its outputs may be
   shipped in a closed or open app, free or paid (quote the clause).
2. Free tools or libraries for MULTIWAY POSTFLOP (3+ players): same details.
3. Published research and open implementations (CFR, CFR+, DCFR, MCCFR, abstraction /
   bucketing, deep CFR, Pluribus-style approaches): what a small team (one developer plus AI
   agents) could realistically build for (a) simplified preflop trees with fixed sizes
   (single-raised, 3-bet, 4-bet pots) at 6–8 players, (b) full multiway preflop. Estimate effort
   and expected quality versus commercial solvers.
4. Middle paths and their accuracy: exact push/fold (Nash), simplified preflop equilibria,
   equity-realisation models, using published free range charts only for MEASUREMENT (never
   shipped or copied).
5. How to MEASURE Riverline's heuristic preflop baseline without paid tools: method, sample
   size, tolerances per spot type, what "Verified" could honestly mean for the owner's no-rake
   30–60 bb game (it may be unreachable; say so if so).
6. Licence traps: tools whose outputs or methods we must NOT use.

DELIVERABLE
- Short answer first (the best free path in 5 lines).
- Options table: tool/approach · coverage · quality evidence · effort/hardware · licence ·
  outputs shippable (closed/open × free/paid) · confidence.
- A phased plan for Riverline (now / M2 / M3) with risks.
- Open questions and anything that needs a lawyer.
STOP after the report.
```

---
## R-02 · Legal and app-store landscape

```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Not legal advice:
clearly flag every point that needs a lawyer. Quote and cite official sources (laws, regulator
pages, store guidelines, site terms); mark [Judgement].

WHAT RIVERLINE DOES (relevant features)
- Free poker STUDY app: drills, analysis, hand review, personal strategy, learning content.
  No real-money play, no gambling, no chips that can be bought or cashed out.
- "Game night" organiser: records buy-ins, rebuys and cash-outs between friends in a private
  home game and suggests settle-up transfers (fewest transfers or via a banker). The app moves
  no money and processes no payments. Points/chips-only mode is planned too.
- Optional "live decision" mode, strongly discouraged during real games, with warnings.
- Later: optional paid tier (subscription / supporter / services / donations); accounts and
  sync optional; sharing hands; community feedback.
- Developer based in Israel; languages EN/RU/HE; users possibly worldwide.
- Platforms: web and desktop now; installable web app; maybe Apple App Store and Google Play
  later.

QUESTIONS
1. Apple App Store and Google Play: rules for poker study / gambling-adjacent apps without real
   money (simulated gambling, age ratings, regional restrictions, content rules, wording to
   avoid). Anything specific to recording money owed between friends?
2. Israel: legality and risk of (a) a poker study tool, (b) a home-game money tracker, (c) the
   paid tier. Recommended wording, disclaimers, and features to avoid.
3. Russia, EU and US: the same at a high level (main risks only).
4. Online poker sites' terms on real-time assistance (RTA) and prohibited software (e.g. major
   sites' published lists): what exactly is banned, and what Riverline must avoid or state to
   remain clearly a study tool.
5. Required documents for a free app with an optional paid tier and no analytics: privacy
   policy, cookie/local-storage notice, terms, licences/third-party notices, study-tool
   disclaimer, accessibility statement, contact. What changes when accounts/sync or payments
   are added (e.g. GDPR, Israeli privacy law, payment providers' rules).
6. Age: should Riverline be 18+ (or 21+ in places)? How do stores and laws treat poker study
   content for minors?

DELIVERABLE
- Short answer first: the three biggest risks and how to handle them.
- Findings per question with risk level (low / medium / high) and sources.
- Three checklists: before sharing with friends; before a public web release; before an
  app-store release. Include exact disclaimer wording suggestions.
- Points requiring a lawyer, listed separately.
STOP after the report.
```

---
## R-03 · Name and brand check

```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Cite sources; mark
[Judgement]; not legal advice.

Check the name "Riverline" (Russian «Риверлайн», Hebrew «ריברליין») for a poker study app:
1. Registered or pending trademarks (USPTO, EUIPO, UK IPO, Israel trademark register, WIPO
   Global Brand Database), especially in classes 9 (software), 41 (education, games) and 42.
2. Existing products, companies or apps named Riverline or very similar, especially in poker,
   gaming, gambling, education or software; app-store listings.
3. Domain availability (.com, .app, .io, .poker, .co.il, .ru) and social handles (X, Instagram,
   YouTube, Reddit, Discord, TikTok).
4. Search clutter: how hard it would be to find the app by name; poker meaning of "river" is a
   plus or a confusion?
5. Pronunciation and meaning in Russian and Hebrew: any unfortunate readings?
DELIVERABLE: findings table (item · status · source · risk), overall risk verdict
(low / medium / high) with reasons, and only if risk is medium or high: 8 alternative names in
the same spirit (calm, honest, poker-aware, works in EN/RU/HE) with a quick availability check.
STOP after the report.
```

---
## R-04 · Coming back without streaks

```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Cite sources (studies,
design write-ups, app reviews); mark [Judgement].

WHY: Riverline dropped streaks on purpose (no guilt, no pressure, no engagement theatre), but it
still wants people to come back and study regularly because it helps them. It has: short
drills, a review queue, a personal plan, a learning path, a sticker book with tiered stickers
(activity-based, never "you're good"), game-night features, and a phone version. No ads, no
analytics, local-first.

QUESTIONS
1. How do respected learning apps without (or beyond) streaks build healthy habits: chess
   (chess.com, lichess), language (Duolingo alternatives, Anki, Clozemaster), music
   (Simply Piano, Yousician, Melodics), maths/puzzles (Brilliant), fitness (Strava, Apple
   Fitness rings)? What works, what backfires (studies where available)?
2. Spaced repetition and "due" queues: designs that motivate without anxiety (limits, catch-up,
   vacations, gentle reminders).
3. Notifications: when they help and when they annoy; opt-in patterns; local-only reminders.
4. Progress visualisation that feels rewarding but honest (rings, maps, books, levels).
5. Social motivation without pressure (friends, shared goals) for later.
6. Ethical guidelines on persuasive design / dark patterns to avoid (cite frameworks).
DELIVERABLE: findings by question, a list of 10 concrete patterns ranked for Riverline (with
risk of becoming manipulative, and how to keep it honest), and 5 things to never do. STOP.
```

---
## R-05 · What other poker study tools do well (competitive reference pass)

```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Cite sources (official
sites, reviews, forum threads, videos); mark [Judgement]. Never copy proprietary content; we
want ideas and lessons, not their data.

Survey current poker study/training products (e.g. GTO Wizard, GTOBase, DTO, Postflop+,
Preflop+, Simple GTO Trainer, Range Trainer Pro, Flopzilla, PokerSnowie, Upswing Lab, RIO,
Hold'em Manager/Hand2Note review features, poker coaching apps, phone trainer apps) and, for
contrast, two non-poker study apps praised for UX (e.g. chess.com lessons, Brilliant).
For each: core features, what users love, what users complain about (reviews/forums),
pricing model, phone vs desktop, how they present uncertainty/accuracy, how they handle
home-game or live players, and design quality.
DELIVERABLE: a comparison table; then for Riverline a list of ideas sorted into ADOPT (fits our
principles), ADAPT (needs changes to stay honest/free/local-first), DIFFERENTIATE (where we
should deliberately do the opposite), REJECT (with reasons). Highlight unmet needs of
home-game and live players. STOP.
```

## R-06 · Real sound candidates (for the listening page)

```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Open every page you
cite and quote its licence.

GOAL: find real recorded sounds (not synthesized) with licences allowing use in a free app with
a possible paid tier: CC0 first; CC-BY acceptable if attribution is simple; no "non-commercial".
Sources to search: freesound.org (filter CC0), Kenney.nl audio packs, Sonniss GDC bundles
(check licence), OpenGameArt (CC0), BBC Sound Effects (check licence: likely personal use only,
flag it), Zapsplat (check terms), Pixabay sounds (check licence), Mixkit (check licence).
Events needed: card dealt / slid, board card placed, card flip, check knock on felt, chips bet
(small/medium/large stacks), all-in push, pot pushed to winner, fold (cards tossed), soft UI
tick, confirm, gentle error, session finish (short, warm), toast/notification (subtle).
Character: real, crisp, lightly softened; card-room foley, not casino slot machines.
DELIVERABLE: per event 3–5 candidates with direct link, author, licence (quoted), duration,
format/sample rate, a one-line description of the sound, and whether redistribution in an app
is allowed. Group into 3–4 coherent "sets" (same room/mic character). STOP.
```

---
## R-07 · Accounts, sync and phone ↔ PC (free, local-first)
```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Cite sources; mark [Judgement].
Riverline is local-first (browser storage + thin Electron host); a phone version is planned as an
installable web app (PWA). Decided: phone works standalone first; hands move by share sheet / file /
QR; optional cloud sync later. A Supabase client already exists in the code (unused path).
QUESTIONS: 1) PWA install, offline storage limits and eviction on iOS Safari / Android Chrome in 2026;
how to request persistent storage. 2) Options for optional sync: Supabase (free tier limits, row-level
security), CRDT/local-first libraries (Automerge, Yjs, ElectricSQL, PowerSync, Triplit…) with licences
and free tiers, plain encrypted file export/import. 3) Moving data phone↔PC without accounts: QR,
share sheet, local network, file; size limits. 4) Privacy/security basics for each (GDPR, Israeli
privacy law), what changes once accounts exist. 5) Recommended path for a one-developer project.
DELIVERABLE: comparison table, recommended phased plan, risks. STOP.
```

## R-08 · What home and live games actually look like (to prioritise the baseline)
```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Cite sources; mark
[Judgement]; no copying of paid content.
Find published data and well-sourced descriptions of low-stakes live and home NLHE cash games:
limp frequency, typical open sizes after limps, average players per flop, multiway frequency,
stack-depth distribution (incl. 30–60 bb buy-ins), common mistakes of recreational players,
differences from online 6-max/9-max. Also: which preflop and flop spots occur most often there.
DELIVERABLE: findings with numbers and sources, a ranked list of the 20 most common spot types
in home/live games, and which of them are hardest for a heuristic baseline. STOP.
```

## R-09 · Accessible poker interfaces
```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Cite sources (WCAG 2.2,
platform guides, accessible card/poker apps).
Topics: colour-blind-safe suits (four-colour decks), action colours vs colour blindness,
screen-reader patterns for cards/boards/ranges/13×13 matrices, keyboard play, reduced motion,
text scaling, RTL (Hebrew) with LTR poker notation, touch targets on phone.
DELIVERABLE: concrete rules for Riverline (do/don't), a checklist per component (card, felt,
matrix, mix bar, action buttons), and examples of apps doing it well. STOP.
```

## R-10 · A learning path for poker concepts
```text
ROLE: INDEPENDENT RESEARCHER for Riverline (context: the brief above). Cite sources (books,
coaching curricula, courses); summarise in your own words, never copy lesson content.
Riverline's Learn hub will have a concept path (pot odds → equity → ranges → blockers → bluffing,
plus position, SPR, value betting, reading a session). Propose a complete beginner→advanced map of
40–60 concepts for live/home and online cash players: prerequisites, order, one-line definition,
a typical mistake, a quick exercise idea (no copied content), and which concepts need exact maths
vs judgement. DELIVERABLE: the map as a table + a suggested first 8 lessons. STOP.
```
