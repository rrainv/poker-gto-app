# Riverline: project brief for agents and researchers (2026-10-21)

Read this before any Riverline task. It explains what Riverline is, what has been decided, and how to work. AGENTS.md (in the repo) holds the working rules for code; this brief holds the context. The owner's judgement is final; when something here seems wrong, say so instead of working around it.

## 1. What Riverline is
- A **No-Limit Texas Hold'em study workstation**: "the honest poker coach for the hands you actually play". It connects reconstructing or playing hands, replay and review, analysis, the player's own intended strategy, training drills and learning, in one loop.
- **Local-first, browser-first, desktop-first**, with a thin Electron host; a phone version is planned (close to the full app, built on the same code first). Languages **EN, RU, HE** (Hebrew right-to-left with left-to-right poker notation).
- First user: the owner (home games 6–8 handed with 30–60 bb buy-ins and no rake; online 9-max at 100 bb+; studies a lot). Later: close friends, eventually a public release.
- Business model (planned): **mostly free**, with an optional subscription / supporter tier / paid services / donations later; a community that shares content and feedback. Source model (closed or open) is decided after the best tools' licences are known; currently treated as closed.

## 2. Principles that are never traded away
1. **Honesty is the brand.** Every number says where it comes from. Confidence tiers: **Exact** (always scoped, e.g. "Exact · price only"), **Verified** (heuristic measured against references within a tolerance), **Estimated**, **Unavailable**. No numeric confidence percentages, no fake GTO, no fake EV, no mastery theatre.
2. **Unknown is never fold, zero or excluded.** Unanswered hands stay unknown; missing information is labelled, never invented.
3. **Heuristic disagreement is never a "mistake".** Comparisons are descriptive (inside / outside the baseline's mix, close).
4. **One canonical owner per concept.** Poker maths live only in the shared domain; the UI formats, never computes.
5. **The player's plan is first-class** (Personal Strategy), separate from what they did and from the baseline. Observed play never silently becomes intent.
6. **Study tool, not real-time assistance.** A quick "live decision" mode may exist only with strong warnings; hard limits: no overlays on poker clients, no reading poker-client screens or hand histories in real time, nothing built to evade site detection, no marketing implying in-game use.
7. **Free first and always legal.** Use free software where possible, build our own for gaps, record every outside component's licence before use (sourcing policy); no spending committed yet.

## 3. Technology (today)
Plain JavaScript (no React/Vue/Tailwind): one large classic script `app/src/core/logic.js` (~14k lines) plus ES modules; one stylesheet `app/styles.css`; shared poker domain in `shared/poker-domain/`; Node's built-in test runner with a custom DOM harness (~2,750 tests); Firefox on Windows for visual checks; Supabase client exists but accounts/sync are off the critical path.

## 4. Design direction (decided)
- **Look:** dark forest / jade / brass, "calm surface, deep data" (clean first look, raw data one hover/click away), soft panels, hero answer cards, number tiles; one primary action per view; never double-signal a state; no dead space.
- **Motion:** approved "motion catalog" of 31 moments; frequency decides motion (keyboard and very frequent actions are instant); strong ease-out curves; per-moment tempos; one global Motion setting (Instant / Faster / Standard / Reduced); 60 fps, transform/opacity/clip-path only.
- **Sound:** only real, properly licensed recordings, judged by ear; study cues never sound like right/wrong.
- **Illustration:** soft-depth objects with fine jade/brass line accents; empty screens show useful real content or an illustration with one line and one action; mascot Chippy (M3) is a calm teacher-like poker chip.

## 5. Strategy engine and solvers (current understanding)
- Today: a **heuristic baseline**, mostly Estimated. Goal: make it trustworthy, tier by tier.
- Solver findings (to verify; not legal advice): **b-inary/postflop-solver** (AGPL) run offline, shipping only numerical outputs, is allowed in closed or open, free or paid apps; **HRC Pro** allows commercial use of exported results (paid, deferred); GTO+, Simple Postflop and PioSOLVER outputs are not usable without special licences; TexasSolver skipped. **Gap:** preflop and multiway for the owner's game types.

## 6. Roadmap
Core milestones: **M1** trustworthy polished base (design foundation, motion layer, truth fixes, trust package) → **M2** core reworks (Personal Strategy question flow, Hand reconstruction, Review, Equity, Learn, Game night, Table rules) → **M3** expansion (solver library, Orbit sessions, connected workspaces, achievements, Chippy, audio). Side tracks: trust & maths research, platforms (installable web app, phone views, later apps), accounts & data (phone works standalone first; optional sync later), social sharing, release readiness (official documents, hosting, legal review).

## 7. How to work on Riverline (any agent)
- Evidence first: open the actual source, quote the relevant clause or line, cite links or file:line. Mark your own judgement as **[Judgement]**. Never claim something you did not check; write UNVERIFIED instead.
- Respect the decisions above; if your findings contradict one, flag it clearly with evidence rather than silently deviating.
- Prefer free, legal, maintainable options; say what anything costs (money, effort, risk).
- Keep outputs structured: a short answer first, then the evidence table, then risks and open questions.
- Never invent numbers for poker spots; numbers come from the domain engine or a cited source.
EOF
echo ok