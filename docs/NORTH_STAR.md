# Riverline North Star

Status: the shared guide for product direction, drafted by the Manager on 2026-10-05 from the full manager-chat history (migration bundle of 2026-09-29, all tickets and QA since, and three rounds of owner design interviews); installed by DOCS-RESET-001 (2026-10-15). It replaces older vision/roadmap text where they conflict. Items marked *provisional* are decided in direction but get their final form at mockup or ticket time.

This is a rail guide, not an ultimatum. **The owner's judgement is always final**, and any decision here can be revisited when there is a good reason. Agents follow it so work stays consistent; when something here seems wrong or blocks a better outcome, raise it rather than silently working around it. Order of reference when sources disagree: the owner's current instructions → this file → [STATE.md](STATE.md) (live status) → [DESIGN_SYSTEM.md](project/DESIGN_SYSTEM.md) (visual contract) → subsystem reference specs in [project/](project/) (including [CAPABILITY_GUARDRAILS.md](project/CAPABILITY_GUARDRAILS.md)) → archived history in [archive/](archive/README.md). Issues live in [ISSUE_REGISTER.md](ISSUE_REGISTER.md), terms in [TERMINOLOGY.md](TERMINOLOGY.md), ideas in [IDEA_BANK.md](IDEA_BANK.md). If code contradicts an invariant here, report it as a likely defect instead of quietly reinterpreting the rule.

Milestone tags used below: **[M1]** trustworthy polished base, **[M2]** core feature reworks, **[M3]** expansion, **[Later]** preserved direction with no milestone, **[Out]** deliberately not pursued. "Releases" are internal milestones in one continuous development flow; the only real release is when Riverline is first shared with other people.

---

## 1. What Riverline is

Riverline is a personal No-Limit Texas Hold'em learning workstation. It is a **coach that learns how you play and honestly teaches you toward better poker**. It connects play/reconstruction, analysis, an intended personal strategy, training and review into one loop instead of disconnected charts, quizzes and notes.

The learning loop:

> Reconstruct or play → Replay and Review → Analyze and Explain → compare with the baseline and your plan → teach Riverline your intended strategy → train (drills, Full Hand, Orbit) → Riverline notices patterns → targeted teaching → apply it at the table.

Audience and character:
- First user is the owner; friends later, only when it is close to done; strangers not planned. Riverline will probably be **free**. Open-source vs closed is **undecided**.
- Serious recreational and improving players. Desktop-first, browser-first, **local-first**. Electron is a thin host; ordinary browser use needs no Python.
- Home/club/private games matter alongside online cash. Operator names never decide mathematical rules.
- Languages: **EN, RU, HE** (including RTL), first-class.
- Product names: Riverline / Риверлайн / ריברליין.

What makes Riverline different (protect these):
1. **Honesty is the brand.** Every number says where it came from. Unknown is never fold or zero. No fake GTO, mastery, EV or certainty.
2. **Your plan is first-class.** Riverline learns your intended strategy (Personal Strategy) and your real tendencies, and teaches from them.
3. **Adaptive teaching.** Riverline adapts *what and how it teaches*, never silently the advice itself.
4. **Natural-language explanation.** A neutral coach voice that explains why, built from structured facts (no LLM).
5. **A calm, premium study workstation**: dark forest / jade / brass, dense but composed, never a casino.
6. **Local-first and multilingual**, plus a real-world Home Game organizer for the owner's group.

---

## 2. The truth model (never merge these roles)

| Role | Answers | Must never silently become |
|---|---|---|
| Observed action | What happened? | What the user intended, or proof of good play |
| Personal Strategy (intent) | What do I intend here? | Solver truth, or a frequency the user never gave |
| Accepted reference | What does an independently accepted source say, within its exact coverage? | Coverage outside its exact assumptions |
| Heuristic baseline | Estimated guidance | GTO, correctness or EV-loss evidence (beyond its confidence tier) |
| Calculated facts | What rules/cards/accounting/equity establish | A strategic recommendation on their own |
| Opponent assumption | How a synthetic policy is configured | Knowledge of a real person or a real range |
| Normative assessment | What may be called correct/incorrect | An automatic consequence of having any reference |

Hard rules:
- **Unknown is not Fold, zero or excluded.** Unasked hands stay unknown. Unknown × known zero is not known exclusion.
- A preferred action is **not** a 100% frequency. Exact frequencies only when the user enters them.
- **Scenario** (Analyze editable inputs) is deliberately lossy. **Hand** has canonical legal history and is the strongest context.
- **Review** explains decisions; **Replay** shows chronology. They share history but not cursors or stores.
- Character appearance (name, portrait, abstract art) never implies opponent behaviour. Behaviour comes from policy.
- Observed actions never become intent automatically; intent requires explicit confirmation.
- No personality inference from range shape or play. Tendencies are stated as actions in spots, with sample sizes.
- Source acceptance is never self-declared: provider claims ("licensed", "exact", "validated") are evidence to inspect, not permission. A hash proves identity, not rights or correctness. Acceptance binds exact source ID, version, fingerprint and coverage.
- Reference coverage must match exactly (rules, rake, positions, live players, stacks, history, sizing tree, units). "Nearby" is not exact. Null equality never grants coverage.
- Historical records keep their answer-time evidence as history and never silently acquire newer authority.
- Lesson of the 2026-09 HRC pilot: a generated, self-accepted "reference" with invented frequencies/EVs and widened coverage was removed (REFERENCE-INTEGRITY-RECOVERY-001). Never rebuild a renamed fake reference. Pilot-era Training exposure was checked: zero affected records found on the owner's origins (field-path control not run).

---

## 3. Trust and the baseline

### 3.1 Direction
- Long term, the **baseline should become reliable enough to be the teaching target everywhere**. Baseline accuracy is a **core strategic track**, not a side project.
- Until then, teaching is **tiered by confidence**: firm where the baseline is trustworthy, reasoning-based where it is approximate. The firm area grows as accuracy improves.
- Owner's trust ranking: (1) solver-backed spots, (2) accuracy checked against references (preflop first), (3) exact math, (4) visible confidence, (5) consistency.
- Trust and polish are the two things stopping the owner from using Riverline today.

### 3.2 Confidence tiers (owner-approved)
| Tier | Meaning | Examples |
|---|---|---|
| **Exact** | Correct by construction given inputs | push/fold, equity, pot odds |
| **Verified** | Heuristic measured against references within a documented tolerance | most preflop after the audit |
| **Estimated** | Heuristic, not verified | most postflop |
| **Unavailable** | No supported answer; say so instead of guessing | unusual multiway lines |

- Shown as **one tier label in a fixed place**, with a **one-line reason on demand**. **No numeric confidence percentages** (uncalibrated percentages would be dishonest).
- Tolerances for "Verified" are defined per spot type **before** measurement (worker proposes, owner approves). Any later heuristic change drops affected spots back to Estimated until re-measured.

### 3.3 Trust package [M1, a milestone gate]
1. **Internal measurement** of the preflop baseline against reputable public charts. Measurement only; **no chart data ships**.
2. **Exact push/fold** computed by Riverline itself (short stacks); shippable; firm tier, labelled "Exact · push/fold model". **Moved to M2** (owner, 2026-10 scope review).
3. **Exact math everywhere it applies** (owner: "exact wherever possible; the math isn't hard"):
   - equity (exact, or simulated with stated margin);
   - pot odds and required equity;
   - break-even fold % for bluffs and minimum defense frequency;
   - combos, card removal, blockers;
   - all-in luck analysis (expected vs actual; single hands with the M2 Review, sessions with Orbit in M3);
   - SPR and effective stack per street.
   Each labelled with its scope so "Exact" never implies a recommendation: e.g. "Exact · price only" (pot odds; shows who is still to act), "Exact · push/fold model" (a simplified game, not full NLHE), "Exact · known cards" (equity and luck need both hands; if an opponent's cards are unknown the luck analysis is Unavailable or range-based and Estimated; raked pots use the pot after rake). Monte Carlo margins state their confidence level (e.g. ±0.3% at 95%).
4. **Disagreement policy**: fix clear, explainable heuristic errors through poker reasoning (never by copying chart values, which would be disguised copying); keep debatable spots Estimated; document every change in a readable **baseline audit report**.

### 3.3b Baseline targeting (owner, 2026-10)
No target game is privileged. The baseline is parameterised by Table rules, and "Verified" is earned **per context** once that context is measured against references. Contexts with reliable public references (mostly online 6-max, 100 bb) can earn Verified first because they are verifiable; others, including the owner's live home game, stay honestly Estimated until a way to verify them exists.

### 3.4 Solver and reference track
- Solver-backed library: **[M3]** (owner moved it out of M1). The research spike may start earlier.
- Own full preflop solving (6-max): **[M3]** solver track, gated by research and licensing.
- Postflop library approach: offline generation on the owner's PC with an open-source solver (e.g. postflop-solver), heads-up common lines first; output labelled solver-backed with full provenance (tree, settings, convergence, repeatability). Reference contract is preflop-shaped today and needs extension for postflop.
- **No AGPL code inside the app** until the open-source question is decided. Offline solver use to generate data is fine.
- Solves are only as good as their input ranges: label "solution given these ranges".
- Interpolation/extrapolation and learned estimates: **[Later]**, only after a trustworthy corpus with held-out validation; always labelled estimates, never "exact reference".
- **Own solvers as an option (owner, 2026-10-11):** building Riverline's own solving capability (research, possibly GPU or rented compute) is on the table alongside licensing someone else's data. Manager notes: postflop solvers such as postflop-solver run on CPU and the owner's PC can start offline generation without new hardware; GPUs matter mainly for very large trees or learned models; rented cloud compute fits short bursts; buying or licensing data needs a licence that clearly allows redistribution in the app (the 2026-09 HRC pilot shows the cost of getting this wrong). A research spike compares cost, quality, licensing and effort before any purchase.
- **Solver research findings (independent report, 2026-10-12, doc: https://claude.ai/artifact/PdNJrKcCYvzbXgiNS5EARY):** the cheapest legal route is b-inary's postflop-solver run **offline** on the owner's PC (AGPL code never ships; only its output files do), with the free PioSOLVER edition as an independent internal cross-check, and every result labelled "solution for these ranges and this tree". That can make heads-up postflop and push/fold Verified or Exact within two stages at about $0; stage 1 is SOLVER-PILOT-001, which also settles how accurate the heuristic is. Multiway postflop stays Estimated (no one solves it well; commercial tools stop at 3-way). Pio's terms forbid shipping its results as an on-demand lookup, so commercial tools are cross-checks only. An own opponent model applied as node-locks could make exploit advice Verified per model. Later routes: rented high-memory CPU machines (cheap per hour) for deeper trees; abstraction-based multiway preflop (MIT code, days of compute, Estimated); a value-network experiment within the cloud credits (research only). Buying a GPU: not yet. Unconfirmed: GTO Wizard, GTO+ and HRC output terms, HRC's price, and whether postflop-solver supports node-locking. **Timing (owner, 2026-10-12):** flexible; stage 1 runs whenever resources allow and can be pushed back. The polished app comes first; the M1 trust package (references, exact maths, honest labels) still stands.
- No production ONNX/model runtime, remote strategy API or solver runtime in the app today.
- Hardware: Ryzen 7 5700X, GTX 1660 Super, 16 GB RAM. The existing solver benchmark is a 46-node preflop toy tree and proves nothing about postflop cost.
- Spend: last recorded optional compute budget ≈ US$75 unless changed; ~US$90 of cloud session credits are unused and reserved for work that genuinely benefits from cloud. Every paid experiment needs approved max spend, runtime, artifacts, success and stop criteria.
- Known debt before any real reference is registered: Analyze's reference heading can fall back to a provider-declared display name and drops localization; must be fixed first.

---

## 4. How Riverline teaches

### 4.1 Adaptive teaching
- "Advice adapts to me" means **adaptive teaching**: Riverline notices tendencies and adapts what it teaches, which spots it drills and how it explains. It does **not** silently change the baseline recommendation.
- Teaching target: the baseline (tiered by confidence). The user's plan is context.
- **Evidence gate** (independent review): a minimum sample before anything is shown as "noticed"; every pattern names its source (drills vs dealt or real hands). Frequency statistics such as VPIP/PFR are computed only from dealt hands (Full Hand, Orbit, reconstructed, imported), never from drills, whose spot mix is chosen by the generator.
- Tendencies are always concrete, spot-scoped and sample-aware ("you fold the BB vs small opens more than the baseline: 14 of 18"). Never personality labels.

### 4.2 Evidence sources (eventually all)
Training answers; Personal Strategy plan; hands played or recorded in Hand; imported hand histories; things the user flags (Review later, Unsure, Mistake); and decisions the user explicitly marks **"this is how I usually play"**.

### 4.3 Approaches (play contexts)
- Every piece of evidence belongs to an **Approach** under a Personal Strategy **Game** (e.g. Serious, Fun, Tilted). Patterns are tracked per Approach and never mixed silently.
- Assignment: sessions default to the **last-used Approach, shown visibly with one click to change**; imports go to **Unassigned**; anything can be reassigned later.
- Marking a decision "how I usually play" asks which Approach it belongs to.

### 4.4 Feedback and "why"
- Training feedback compares against the **baseline as target** with the **user's plan shown as context** [M3]. Where the plan itself differs from the baseline is a key teaching signal.
- "Why" analysis has three labelled types:
  1. **Measurable** facts (including luck vs decisions via all-in expectation);
  2. **Comparative** (vs baseline or plan, with confidence tier and sample size);
  3. **Hypotheses**, clearly labelled, limited to the best-supported, with evidence.
- Encouragement praises process ("you checked the price before calling"), never "you matched the heuristic, well done".
- Neutral comparison must never look or sound like correct/incorrect.

### 4.5 Voice
- Default voice: **neutral coach**: facts first, lightly encouraging, no hype.
- Architecture: **what is said (facts, claim strength) is separate from how it is phrased (voice)**, so personas can never strengthen a claim.
- Personas: tone/depth personas (e.g. Calm coach, Blunt pro, Patient teacher) **[M3/Later]**; character coaches with art **[Later]** (shared art pipeline with Chippy).

---

## 5. Architecture invariants

- **One canonical owner per concept**; consumers project. Never fix a missing field by building a second domain implementation in a renderer.
  - Rules/maths identity: versioned GameRulesDefinition + immutable GameRulesSnapshot in `shared/poker-domain/` (cards, actions, legality, accounting, evaluator, Equity, combos, weighted ranges).
  - Strategy selection: StrategyProvider; claims: application-owned source acceptance + StrategyClaimPolicy.
  - Training targets: TrainingPracticePlanner; generation/session/grading: canonical Training modules; durable encountered evidence: `training-memory/v1`.
  - Personal intended strategy: sparse immutable intended evidence with explicit corrections (supersession lineage, never rewriting originals).
  - Saved: versioned SavedStudyObject (`saved-study-object/v1`, kinds Hand and Spot).
  - Explanations: AnalysisExplanation and canonical factual projections.
  - Table/Review/Decision Delta/Study Inbox: ephemeral projections, not new stores.
  - Audio/motion: experience events and presentation consequences only.
  - Identity: existing owner/generation/disposal authorities; one Supabase browser client.
  - Home Game: separate exact-money organizer domain.
- No UI poker maths; no duplicate Equity/Training/strategy/state engines.
- **Versioned contracts** (PokerState v1/v2/v3, Game Rules v1/v2, Saved payload versions, Replay v3); never flatten or migrate casually. Schema/persistence migrations need explicit approval.
- Correcting derived accounting is not rewriting source evidence. Imported recorded pot/rake/awards stay immutable.
- Exact decision economics: `facingSizeBb` is wager-to; `callAmountBb` is the exact incremental, stack-capped price; contestable vs ineligible money differs; ante is dead money (BBA regression: 100bb, 0.5/1, 1bb BBA, SB call → pot 3bb, threshold 1/6, SB-win settlement 102/98).
- Range maths: inclusion weight, action probability, conditioned reach and epistemic uncertainty are different values. Known-only Equity is conditional; combo coverage is not probability-mass coverage. Joint sampling rejects colliding tuples (no sequential renormalization).
- **PERF-001**: one primary strategy resolution per decision update; coalesced rapid inputs; no hidden 169-cell Matrix work; keyed reuse; dirty/visible invalidation; language and presentation changes reuse facts; no hidden Equity/strategy work (now: Equity auto-calc only when cheap, see §7.4).
- **Lifecycle and privacy**: generation/disposal fences across sign-out/account switch/async work; stale callbacks never repopulate another owner's state. Language switch is presentation-only (never an identity event). Bots see only actor-allowed facts; replay reveals never leak backward; active Full Hand evidence stays embargoed.
- **Reuse principle (owner)**: reuse or extend an existing system before building a new one (e.g. the action "ribbon" reuses Replay's vertical street-grouped history rail; the rejected horizontal action path stays rejected).
- Architecture evolves through bounded extractions with explicit mount/owner/generation/disposal seams (first done: Saved library). No React/Redux rewrite, whole-stylesheet rewrite or class-hierarchy conversion for its own sake.
- Local-first: meaningful without sign-in. Device Guest and accounts are isolated. Home Game Guest sessions are runtime-only.

---

## 6. Shared systems

### 6.1 Table rules v1 [M2] (named "Game Profiles" in earlier discussion)
- One shared, versioned definition of the table's rules and setup for **Hand, Analyze, Training**. User-facing name: **Table rules** (RU «Правила стола», HE «חוקי שולחן»). It is distinct from a Personal Strategy **Game** (RU «Игра», HE «משחק»), which holds Approaches. Home Game keeps its own presets for now (may reference Table rules later).
- Contents: **table size; blinds + straddle; antes; rake (%, cap, preflop rule); default stacks (depth + varied/equal); name + label.** Cash games only. No currency.
- **Each workspace remembers its own Table rules**, shown as a chip in its header.
- **Versioned**: editing creates a new version; saved hands keep theirs (never retroactive).
- Built-ins (read-only, duplicable): **Online 9-max (100 bb, rake), Online 6-max (100 bb, rake), Private table (no rake), Short-stacked home (6–8 players, 40 bb usual, 30–60 bb range, no rake), Heads-up**. They replace the arbitrary "Home / ClubGG" choices and cover the owner's real formats. Rake values described generically, not as a named site's structure.
- Amounts: shown in bb; typing money is allowed and converted with the blinds (money-mode input, M2).
- Bet-size presets: fixed sensible defaults first; **per-Table-rules presets later**.
- Central home in "My poker" plus in-place editing from workspaces (same object, never copies).

### 6.2 Spot generator [M1 coherence, shared]
- **Plausible** spots now (actions follow sensible baseline ranges); evolve toward table-type realism later (Table axis).
- **Target-first**: choose the target spot (Hero cards, board, street, decision), then build **the most plausible legal path** to reach it. Unusual targets stay possible but never via an absurd history (e.g. 72o on AKQ reaches it via a checked big blind).
- Hero's earlier actions follow the same most-plausible path. (Plan-driven Hero lines: later, with plan context.)
- **Spot variety** setting: Realistic / **Balanced (default)** / Wide; detailed controls under Advanced. Unusual spots get a short note explaining why they are rare.
- Stacks: **configurable**; default leans to realistic varied stacks with an "equal stacks" option; effective stack always shown.
- History shown in **full detail** by reusing Replay's history rail.
- A generated spot **is a real canonical hand**: Analyze opens it in Hand context; "Edit as Scenario" still available. Fixes "pot 6bb while everyone shows 100bb".
- One generator for Analyze randomize, Training drills and Full Hand setup.
- **M1 scope:** randomisers (cards, boards, hands) in full; generated spots have believable preflop lines and legal, fully consistent postflop lines from simple rules; believable postflop lines arrive with the M3 opponent model.

### 6.3 Connected workspaces [M3]
Any poker object (hand, spot, decision, range) can be sent to any tool that understands it, with context preserved and a way back ("send to Equity", Analyze → Review, Orbit report → hand review, etc.). One shared system, not per-screen patches. Existing handoffs (Review → Analyze, Saved reopen) keep working meanwhile.

### 6.4 Configuration homes
- **Settings** = app preferences only: Appearance (app theme, table preview / table theme, cards, text size), Audio & Motion, Language, Help & guide, Chippy (own category, M3), Shortcuts, Account & Data, About & legal.
- **Reusable setups** (Table rules, Games and Approaches, Game night people, groups and presets, later bot tables and coach/target style) have one central page (working name **"My poker"**, mocked up 2026-10-11) **and** in-place editing in the workspaces that use them. It only earns its place through "Save as…" / "Manage…" entry points in every workspace; whether it keeps a sidebar slot or merges with Saved into a "Library" is decided with the sidebar rework.

---

## 7. Feature direction by area

### 7.1 Personal Strategy
Jobs, ranked: (1) store my plan; (2) adaptive teaching from what Riverline notices; (3) drill my plan; (4) compare plan / baseline / actual play.

Plan scope:
- Preflop first-in (exists) · preflop vs an open (3-bet/call/fold) · preflop vs a 3-bet (4-bet/call/fold) **[M2]**
- Postflop rules by hand category ("as PFR on dry flops bet top pair+") **[M3]**
- Exact postflop ranges per node/texture: **[Out]** of current scope (owner: very heavy; long-term aspiration only)

Building the plan (ranked): question flow → paint the matrix → describe in words (rule-based, confirmed) → templates/copy → text import. Templates come late on purpose: they would anchor the user on the baseline and hide how they really think.

Question flow [M2] (*provisional details*):
- **Spot map** as home (grid of positions × situations with state: empty, in progress, done, conflicts) + **"Continue where it matters"** guided path + free picking.
- **Grouped spots** as the base (opener groups early/middle/late/blinds, standard size from the profile), **splittable** where it matters; Riverline suggests splits from evidence.
- **Bulk-confirm extremes** (obvious top "always" / obvious bottom "never"), confirmed by the user, never assumed.
- **Hand groupings (owner, 2026-10-11, provisional):** prototype two groupings side by side: *rows for asking* (ordered families such as suited aces A2s→AKs, pairs, suited connectors, swept quickly) and *roles for teaching* (what a hand is good for: premium value, wheel-ace bluffs, set-mining pairs, dominated offsuit hands…). Research item: whether roles should change with the spot, and how coaching sites group hands (reference pass, no copying).
- **Edge-family sweeps**: suited connectors, 1–2 gappers, offsuit connectors, low suited K/Q/J, weak offsuit broadways, small pairs, suited/offsuit aces, laid out on a strip. Interaction: a drag-for-shape + tap/keyboard-for-exceptions mix, decided on a prototype.
- Single-hand questions only where something is unclear (gaps, conflicts, plan vs play).
- **Edge map** shows families done / open / conflicting. No fake "% complete".
- Mixed play: **Always / Sometimes / Never + optional exact %**. Plan statistics treat Sometimes as an open interval (0–100%) unless a % was entered, so plan figures are shown as bounds; point values only when every contributing hand has an entered %.
- The spot map is **derived from Table rules** (no impossible cells: UTG faces an open only with a straddle; BB has no first-in spot; SB limp where relevant). Opener groups must be defined explicitly (which group HJ belongs to).
- **Conflicts**: ask, never auto-change; remember confirmed exceptions.
- **Three-state matrix**: yours / heuristic / undefined (never shown as fold) **[M2]**.
- Existing preserved behaviour: Game → Approach organization (user-named Games, many Approaches; formerly "Game Setup"); "What Riverline understands" (read projection), Matrix Edit (precision editor), "Teach Riverline next", "What I've taught" (inspect/correct independently of scheduling); teaching rhythm question → answer → what this tells Riverline → why next; corrections preserve originals; Duplicate Approach freezes source evidence; Teach-through-a-Hand (bounded BTN/BB flop–river path) exists.
- Range recall quiz (paint from memory vs your plan, weak areas re-served): **[M3]**, highest-value later feature.

### 7.2 Training
Format priority: **(1) Orbit sessions, (2) single-decision drills, (3) Full Hand vs bots, (4) range recall, (5) review queue / spaced repetition.** Orbit is built on Full Hand, so Full Hand quality comes first.

- **[M1]**: coherent generated spots + history; **Full Hand quality pass** (bots, Watch Rest speed/skip, visual bugs); full Training **layout redesign** (the oversized post-answer panel is a design defect).
- **[M3]**: feedback with plan context; Orbit; range recall; spaced repetition; difficulty by size grouping; frequency answer mode; saved bot lineups; "Another like this"; learning paths; intuition training (see Equity).
- What to train: **Riverline proposes with evidence, you decide**, free practice always available. Same engine feeds Home and a future "spot of the day".
- **Orbit stacks and length (owner, 2026-10-11):** stacks carry over between hands; by default a player rebuys only when busted (0 bb), with an optional top-up threshold; bots follow the same rule. Session length is a chosen number of orbits (default 2, so every position is played equally), with a hands or time-box option. Rebuys are shown neutrally in the session report next to decisions vs luck; feedback targets decisions, never outcomes.
- **Orbit sessions [M3]**: N hands or a time box, rotating positions, stack carry, chosen lineup, "playing as" Approach. Feedback cadence chosen per session (Play = session report only; Hand-by-hand; Coach = all layers). Three review layers: decision (drill feedback strip), hand (Review), session (new **session report**).
- **Session report** contains: ranked key decisions with reasons; deviations from plan and baseline; tendencies with samples; positional and spot-type breakdown; results with a variance caveat; suggested next study; **all raw data reachable**; "why" analysis (measurable, comparative, labelled hypotheses), including luck vs decisions.
- Preserved Training rules: no answer leaks before submission; Varied/Focused reveal comparison after submit; Full Hand records neutrally, Hero fold pauses at `hero_complete` with summary and optional Watch Rest; Same Spot is historical and stat-neutral; Similar Spot names what changed; Unsure marker and 24h Revisit exist; no streak or stat inflation from repeats.

### 7.3 Analyze and the strategy engine
- Analyze composition (two panels, tabs + street stepper, verdict block with dominance rule, fact table, inline Explain, Provenance disclosure) delivered in ANALYZE-COMPOSITION-001; remaining polish in M1.
- **Verdict dominance rule**: exactly two states. *Dominant* (top action leads the next by **≥20 points**, or no other action reaches 5%): full display size. *Close* (anything else): e.g. "3-Bet or Call · close" at smaller size. No third state ("leans" is not used). Estimated mixes are rounded to 5% and actions under 5% are not shown as part of the mix. Verdict in sentence case, primary text colour (action colour lives in the mix card).
- Fact omission rule: unavailable facts are omitted from the fact table (no bare dashes) and listed in Provenance & limitations.
- **Strategy adjustment axes [M3]**: **Table** (pool/game type), **Opponent** (tendencies), **my Style**. They change both recommendation and explanation, always labelled against the unadjusted baseline. Style is for **exploration in Analyze first**; a chosen **target style** that Training teaches toward comes later. **Until the engine exists the sliders are hidden** (no controls that do nothing).
- Hover number derivations ("pot = blinds + open + call") **[M3]**; side-by-side spot comparison **[Later]**.
- Explain [M1/M2]: remove noise and fix language quality everywhere; coach-voice quality for a set of spots sized by available resources.
- Bluff/non-standard-play teaching architecture to be improved with the range/teacher work **[M3]**. Preserved: blocker explanations name cards, removed combos, affected region and source; "which worse hands call / better hands fold" requires supported ranges or explicit hypotheses.

### 7.4 Equity
Jobs, ranked: (1) matchup (hand vs hand/random, multiway); (2) runout analysis; (3) equity intuition training; (4) hand vs range; (5) range vs range on a board.

- Inputs per player: **Cards / Range / Unknown** (unknown = every available card). **Random is a separate generator button** that deals specific cards when pressed; never mix random with unknown (owner, 2026-10).
- Layout *provisional*: rows not seats was mocked up; the owner is not convinced, so compare other layouts before deciding.
- Runouts focus **per player** (how each player improves, how the board plays out); the per-card grid is secondary.
- Basics first: maths, then runouts; advanced Equity features later.
- **[M2] rework**: rows not seats (2–10 players, stable layout), **typed inputs per player (Cards / Range / Unknown, with Random as a separate deal button)**, **one results table** (equity, win, tie, combos, input type), method badge (Exact / Simulated ± margin), linked highlighting between hand classes and matrix.
- **Runouts [M2]**: card grid coloured by equity change **linked** to grouped outs in plain language (clean/dirty outs); hover a group highlights its cards; **selectable perspective** (default Hero). The card-outcome hover preview (best five emphasised, labelled hypothetical) is preserved.
- **Range input [M2]**: text with live validation guaranteed; picking ranges from your plan or the baseline if resources allow; **visual range grid in M2** (owner, 2026-10-12), reusing the Personal Strategy matrix component right after Personal Strategy builds it.
- **Calculation**: automatic when cheap (e.g. exact heads-up), click for heavy (multiway simulation). This **supersedes** the old "Calculate is always explicit" rule; stale-result cancellation and no hidden heavy work still hold.
- Intuition training (guess, then see) as a **Training format** on the Equity engine **[M3]**.
- Where equity appears (eventually): standalone (main for now), inline in Hand/Replay/Review street by street when cards are known, "send to Equity" from anywhere, inline in Training feedback **[M3]**. Inline equity is always explicit and labelled.
- Preserved semantics: win/tie/equal-share distinctions; nonzero equity with zero wins possible; equity is not EV; unknown ≠ excluded; known-only results are conditional; seeded Monte Carlo; collapsed panels do no hidden work.

### 7.5 Hand (reconstruction workstation)
Jobs, ranked: (1) **reconstruct real hands**; (2) build a specific situation; (3) record home-game hands live; (4) play vs bots (moves to Training).
- Input [M2]: table clicks + keyboard + **bet-size presets** + **"everyone else folds"**; hand-history import (PokerStars English NLHE cash exists, strict fail-closed; **GGPoker [M3]**); **partial reconstruction** (approximate sizes, unknowns, skipped streets; always labelled estimates, never invented). Shorthand text entry as a general input: **[Out]**; a narrow phone-note paste is planned (§11c).
- Showdown result line (who won, with what, best five highlighted) and keyboard actions [M2].
- Preserved: setup preview shows only what the draft establishes; Start is the creation boundary; stable 2–10 seat footprint with Hero bottom; chance actions via pending drafts and explicit Deal/Reveal; folded Hero can still enter board/showdown; transactional card editors (Apply once; Cancel/Escape restores); clear rules (Hero clear ≠ board clear; Flop clear removes later streets); Dead Cards whole-set editor; local named Table presets (superseded by Table rules in M2).
- Hand left column may stay wide only if it shows more useful information (e.g. hand ledger: stacks, effective stack, contributions, SPR by street, pot build, condensed log).

### 7.6 Review and Replay
Review priorities: (1) decision walkthrough (baseline target, plan context, why); (2) **key moments**; (3) notes and marks on any decision (feeds "how I usually play"); (4) equity line + luck vs decisions; (5) hand story.
- **[M2]**: walkthrough + key moments. Layout: a blend of Replay rail, step-through and list (*provisional*, decided on mockup).
- **Key moments**: several typed markers, none "the" verdict: biggest deviation × pot size; commitment point (SPR/price); highest stakes (share of stack); **luck moment** (biggest equity swing) shown separately from decisions. All labelled hypotheses with evidence.
- Back to Review after Explain **[M3]**; notes on hands/decisions **[M3]**.
- Preserved: vertical street-grouped Replay rail with direct seeking and return-to-live (and return-to-completed-hand); Replay facts come from the frame (domain legal-action selector), never live values; Analyze handoff uses the exact pre-action decision; leaving Review tears down its ephemeral state.

### 7.7 Saved and study library
- Built: independent bounded library (200 most recent, disclosed), search/filters/sort, list + sticky inspector, typed rows, fact-only auto-titles (user titles win), Archive (not delete), modal editing (transactional), Training history view as read-only Training Memory projection with Same Spot / Similar Spot / Save as Spot.
- Organization (ranked): **automatic poker-fact filters** (position, street, pot type, depth) → **tags rework** (suggestions) → collections (an item can be in several) → smart filters. No folders. **[M2]** for facts + tags.
- Hover/inspector must add real information; search should cover auto-titles; inspector felt preview.
- Paging beyond 200, poker-dimension filters on top of facts, Saved Training Experience / Saved Equity Snapshot payloads: **[M3/Later]**.

### 7.8 Home
- Home answers "what should I study now?" **[M2]**:
  - Primary: **Resume**, **Due and flagged** (revisits, Review later, Unsure), **grounded suggestions** (from the "Riverline proposes" engine).
  - Secondary blocks: plan coverage snapshot (mini spot map), "what Riverline noticed" (patterns + evidence), recent items, quick starts, last Home Game session.
  - Hierarchy decided on mockup; no fake priority, mastery or global dashboard.
- **Home vs Study (owner, 2026-10-12):** Home is "what's happening in my poker": continue, today's session, last game night's hands, what Riverline noticed, Game night status, and later app-wide things that only make sense there (Chippy, news, achievements and similar). Study material lives **mostly** in the Study hub (plan coverage, drill launcher with quick and long modes, review queue, learning path, weak spots); Home still invites the player to study.
- **A reason to open Home first** (owner concern 2026-10-11: every mode is one click away in the sidebar): ideas to test: a one-click **"Today's session"** (a ready 15-minute plan from due items, the top suggestion and last game night's hands); **hands from the last game night**; honest **skill progress** with samples (no streaks). "Suggested for you" stands out through mini visuals (cards, a tiny range, a small trend), not bigger type; Chippy or other design touches later (M2–M3).
- Destinations panel removed (done). Home Personal Strategy card question resolved inside the Home redesign.
- Study Inbox remains an owner-projected view with Full Hand embargo.

### 7.9 Game night (Home Game organizer) [M2 rework]
- User-facing name **Game night** (RU «Покерный вечер», HE «ערב פוקר»); internal name Home Game. Framed as "keep score and settle up with friends"; a points-only mode exists; no rake or house-cut fields. Game nights happen on phones, so a phone-friendly view is planned (M3, with the capture page).
- Separate exact-money domain; supports the group's real poker nights.
- **Sessions independent.** **Per-player starting buy-ins.** Persistent objects: **saved people**, **groups (rosters)**, **presets (money, blinds, optional chip rate)**; groups and presets stay separate and are combined at session start.
- **Blinds recorded only.** Reconstructed hands can be attached to a game night and surface on Home the next day (game night → hands → review link, **M2**).
- Ledger: append-only, exact integer money; empty/invalid amounts never record (done); 0 buy-in rejected; typed 0 cash-out is a real correctable fact (approved option B record); edits can be edited again (UI says "Edit"; the ledger stays append-only underneath); **balance gate** before settlement explaining any difference (e.g. "equals one buy-in, missing rebuy?").
- **First (M2):** fewest-transfers settlement, session notes and history, the balance gate (counts committed entries only).
- **Later:** reopening settled sessions (every later change visibly marked, prior settlements kept), banker settlement, chips-vs-money with a chip rate, live-night helpers.
- Rebuys can be any amount: Rebuy asks for the amount (default from the preset); the ledger shows total bought in plus a count, with each entry (time, amount) one click away and correctable.
- Session history with **date and notes** [M2]; share results as text/image **[M3]**; per-person lifetime stats **[Later, low priority]**; **tournament mode [Out]**; hard delete/import remain gated.
- Guest sessions are runtime-only and say so.

### 7.10 Learn hub, onboarding, help
- One **Learn hub** replaces the Guide workspace and Learn Riverline, plus rich contextual help everywhere (tooltips, Help panels, tutorials offered when relevant) linking into it **[M2]**.
- Quick trainers shown in Learn (pot odds, outs, equity guess, range reading) are **Training formats surfaced in Learn**, with one store and one record in Training (one canonical owner).
- Layout direction: a mix of the two mockups: Learn B's concept path and quick trainers with Learn A's order and features (lesson list, tutorial states, glossary).
- Hub contents [M2]: tutorials index + progress; **poker glossary** (EN/RU/HE, powers tooltips); guide articles (how Riverline works: honesty labels, tiers, Games and Approaches, Table rules); what's new; **5–8 starter concept lessons** (pot odds/required equity, position, ranges, confidence tiers, Approaches). Larger learning paths **[M3]**.
- First five minutes (ranked): brief explanation → **"Where do you play?"** (home game 30–60 bb / live casino / online) → light personalization (language, theme, Approach) → **first short drill: high-confidence preflop opens** → "what Riverline learned" + next suggestion → start your plan. Everything skippable; Chippy hosts later.
- Preserved: completed/skipped tutorial versions don't nag; overlays handle focus, isolation, Escape and teardown; every tour step lands on a visible correct target.

### 7.11 Accounts, data, privacy
- **M1/M2 are local-only**: sync hidden or labelled experimental; account debt off the critical path. Friends/sharing **[Later]** on real verified accounts (local auth test stack, RLS/two-profile verification RET-ACCOUNT-002, Personal Strategy sync schema decision RET-ACCOUNT-003).
- Data safety (owner, 2026-10 middle ground): **M1** requests persistent browser storage and strongly guards "Delete all data" (type to confirm, clear warning); **early M2** one-file export; **M3** import, then sync. Not a milestone gate.
- Free project; licensing, cookies and privacy obligations handled when sharing becomes real. No analytics.
- **Official documents before sharing with anyone outside the owner [Later, a gate for the first real release]** (owner, 2026-10): privacy policy, cookie / local storage notice, terms of use, open-source licences and third-party notices (incl. CC0 sound provenance and any solver output terms), a study-tool disclaimer (education only, not gambling advice, no real-money play), contact details, and an accessibility statement. They live in a Settings category **About & legal** (version, licences, privacy, terms, contact) **and** a small link in the sidebar footer; first launch links to them once (owner, 2026-10-11). Drafts must be reviewed for the jurisdictions involved; the manager is not a lawyer. Local-first with no analytics keeps the scope small; Supabase sign-in and sync, if shipped, add data-processing disclosures.
- Never invent credentials, print secrets or copy local auth config. Username login, if ever, needs a trusted rate-limited server path.

### 7.12 Achievements and progression [M3]
- Achievements: study milestones; plan coverage; skill milestones (high-confidence tier only, sample shown); cosmetic unlocks. Streaks dropped (owner, 2026-10-10).
- **Progression system** with cosmetics measures **effort/study**, honestly labelled; rewards meaningful study with diminishing returns (no farming); skill shown separately; can be hidden entirely; no time pressure, no loot boxes; cosmetics never affect study.
- (This reopens the old "no achievements/XP" rejection, which the owner declared stale.)

### 7.13 Chippy and characters [M3]
- **Chippy**: a chip with a face; a **guide, never a judge**; never interrupts; can be disabled; original design.
- Placements: onboarding & tutorials; empty states; optional Explain intros; session-report presenter; light idle personality (lowest priority).
- Settings: Chippy gets **his own Settings category** (on/off, where he appears, how talkative) (owner, 2026-10-11).
- Look: **his own concrete, friendly style**, between a soft-rendered premium-toy look and flat vector (clean vector shapes, soft shading, subtle glossy chip edge), Riverline palette, a few clear expressions. Never resembles an existing mascot.
- Bots and minor personalities: **semi-abstract art and names** (e.g. "Nebula", "Astra"), coexisting with the existing human portraits (Cleo, Fern, Luma, Mika, Nova, Otto, Pip, Remy, Sol, Zig). Appearance never implies behaviour.
- **Bot management (owner interview, 2026-10) [M3, with Orbit]:**
  - Each character has a **default playstyle that is always shown and can be changed**; looks never imply behaviour. A "randomise playstyles" option prevents memorising pairings.
  - Playstyles: **named presets first** (e.g. tight-passive, tight-aggressive, loose-aggressive, calling station, maniac, balanced) with one-line observable descriptions, **sliders underneath** ("Adjust"); an adjusted preset shows as "… · adjusted" and can be saved under its own name.
  - Bots become **card-aware by style**: preflop ranges per style plus postflop behaviour by hand-strength category. Built as **one opponent model shared with Analyze's Opponent axis** (no second opponent engine).
  - Table setup: **table type** (a realistic mix of styles for a pool; shares the Table axis), **saved lineups** (central in My poker, editable at the table), **seat by seat**, and **random table**.
  - During play: playstyle labels shown by default; optional **"read the table" mode** hides them, shows observed session stats with sample sizes (HUD-like), and the session report reveals the real styles and how well you read them.
- Preserved opponent model: OpponentPolicy with bounded aggression/calling/folding/sizing, presets/custom, per-seat; policy randomness separate from deal randomness; card-independent synthetic assumptions; Personal-Strategy-as-bot and real-person models **[Later]** (privacy, consent, deletion rules required).

### 7.14 Natural language (rule-based, no LLM)
Priorities: (1) explanation quality (coach-like, spot-specific, natural EN/RU/HE); (2) narrative summaries (session/hand stories); (3) follow-up questions; (4) depth on demand (one line → paragraph → full reasoning); (5) language input (describe plan in words).
- Follow-up questions are a **known, displayed set** ("why not call?", "why this size?", what-ifs) answered from facts and templates; never a fake free-text box.
- Explanations must be traceable to structured facts, omit irrelevant boilerplate, explain uncertainty without warning walls, and preserve claim strength across phrasing.
- No em/en dashes in user-facing product sentences; don't alter technical IDs or user text.

### 7.15 Audio [first sound set M1; full mixer later]
- **M1:** one good sound set with master volume and mute, as part of the design refresh. Everything below (per-category mixer, variants, System category) comes later.
- Mixer first: master gain stage, per-category gains, gentle limiter, dB-based volume slider, fold quieter than bet, turn/river play one card, hole cards per count, new **System** category (errors only; no success-toast sounds; independent of the Study toggle).
- Assets: **CC0 full-quality originals** (not previews), curated by a worker, downloaded by the owner, trimmed/resampled 48 kHz/loudness-normalized/encoded Ogg with full provenance; 3–5 variants per family.
- Character: **between realistic card-room foley and soft/understated**: real, crisp, lightly softened, moderate level; per-category volume in Settings.
- Study cues stay **synthesized tones, made nicer** (softer attacks, harmonics, light tail, calmer note set); still neutral for heuristic comparison.
- Preserved: audio follows canonical events; seek/hydration never replays world effects; listening quality is a human gate.

### 7.16 Motion and visual craft
- Motion scale: **smooth and visible by default**; **reduced/quiet** for repeated high-frequency actions and under reduced motion; **expressive only for rare big moments** (session/orbit completion, milestones, Chippy, onboarding). Frequent poker events (showdown, runouts, pot push) get smooth, satisfying motion, never fireworks.
- [M1] functional motion layer done well (transitions, feedback strip, chips to pot, deal/flip, counters, skeleton fades, hover and press micro-interactions; no layout shift; reduced motion respected). The owner rates animation as a top priority of the M1 design refresh. In-app reduced-motion toggle [M1, small]. Delight layer [M3].
- Visual craft: richer table/felt (lighting, texture, shadows) and refined consistent icons (keep current set) [M1]; a display typeface for big headings **tested** on mockups [M1]; illustrated empty states/onboarding and wider character art [M3]. Illustration style default: geometric-abstract with fine line accents (*provisional*).

### 7.17 Language and terminology
- EN/RU/HE are first-class; i18n is an **app-wide product requirement**, not page patching: no missing strings/keys, no clipping, RU length, HE RTL with LTR poker islands (cards, ranges, amounts, abbreviations), matrix never mirrored.
- Terminology **decided** ([TERMINOLOGY.md](TERMINOLOGY.md), from the owner's sheet): general UI terms use standard translations; poker terms follow real player usage (Russian loanwords except fold = пас; Hebrew loanwords throughout); Latin abbreviations and position codes; button style follows each language (RU infinitive, HE masculine imperative, conventional nouns where normal); Hebrew masculine default. Riverline should never stand out linguistically. Owner is fluent in RU and HE and judges UI naturalness.
- M1 bar: complete and natural enough; native-level polish later.

### 7.18 Bigger directions [Later or Out]
Sharing (private-by-default, read-only first) and friends; Riverline Parties (real-time rooms); PWA/offline packaging; hosting/public beta; mobile (intentional adaptation); PLO (separate domain); learned estimates; Range Evolution expansions; advanced runout concepts (nuts vulnerability, locked wins); Saved payload kinds; shortcuts sheet [M2/M3] and command palette [M3]; printable strategy sheet, leak report, spot of the day, focus mode, glossary tooltips (some [M2]), guided first week [M3]; competitive reference pass for feature ideas (adopt/adapt/differentiate/reject, never copy proprietary content).

---

## 8. Design language

- **Identity**: dark forest shell, jade/mint accents, brass/gold for provenance, rich felt, restrained depth, calm but not bland. **Rejected**: casino neon, jackpot imagery, fake cinematic 3D, confetti/reward theatre, decorative gradients, generic admin dashboards.
- **Structure over boxes**: at most two containment levels; group by spacing and hairlines; no decorative accent/brass borders; colour only where it carries meaning (active step, selection underline, slider fill, the one primary action, status callouts, poker-action data).
- **One accent-filled primary action per view**; selected tabs/segments use underline, not fill. Accent is whatever the theme sets.
- **Themes stay fully customizable** (role tokens only, presets plus custom; contrast rules apply to custom themes).
- **Midnight preset = mockup palette**: canvas #101311, shell #151a17, panel #1a201d, elevated #202824, interactive #222a26, hover #2a342f, inset #171c19; lines #303a35/#46524c; text #f2f5f1/#c1c8c3/#8f9a94; accent #42ad7b (hover #58c18f, on-accent #07120d); brass #cdb67e; poker actions fold #68716c, passive #4f8f99, aggressive #b27e4d, all-in #a85f70; felt #2f6c52→#1d4636, rail #b9a777→#6f6447.
- **Typography**: Segoe UI Variable Text on Windows (stack "Avenir Next", "Segoe UI Variable Text", "Segoe UI", system-ui). Type scale: body 14, small 12.5, label 11 (overline, small caps), heading 15, title 20, display 40; fact values 15. **Weights: owner prefers 650 for labels, controls and fact values**; body 400; headings 650; titles 700; workspace/section titles 750; verdict/display 800. Numbers use tabular digits in the UI font; monospace only for technical source IDs. Nothing below 12px except overlines.
- **Keep the existing icon set** (mockup icons rejected); make it consistent.
- **One poker-action key contract everywhere** (independent review, adopted as the default proposal): F fold, C check/call, B/R bet or raise, A all-in, digits = size presets; study actions on distinct letters (U unsure, L review later, S save, E explain). Every workspace lists its keys in Settings › Shortcuts.
- **Keyboard shortcuts are configurable** (owner, 2026-10): rebind any key, clashes on the same screen are shown before saving, reset to defaults; one key per action across every screen where it exists.
- **Same feature, same component, same behaviour everywhere** (owner, 2026-10): hand history rails, card displays, action inputs, fact grids, tier badges, mix bars, seats and player rows are shared components that look and behave identically in Hand, Review, Analyze, Training, Full Hand, Equity and Saved. Rework diverging copies rather than adding new ones.
- **No placeholder controls**: features that don't exist yet are not shown as disabled controls ("coming later"); they appear when they work. Exception: About & legal is always present once legal documents exist.
- **Quiet copy** (owner, 2026-10-11): don't state what the user already assumes the app does or knows (no "Every change is kept…", no labels on every row when the affordance can show it, e.g. an expand chevron instead of "entries"). Prefer plain everyday labels ("Edit", not "Correct"), even when the data model is append-only underneath. Say only what helps the next action or prevents a mistake.
- **Playful only when it works** (owner, 2026-10-11): a unique or quirky design is welcome only when it does the job as well as, or better than, a serious design would. Otherwise choose the clear, orderly version.
- **Never double-signal a state** (owner, 2026-10): if selection is already shown by the accent (border, fill, underline), don't also label it ("In use", "Selected", "Active"). One clear signal per state, app-wide; rethink existing screens with this in mind.
- **Style v4 is the app style** (owner, 2026-10-14): soft panels, a hero answer card, number tiles, pills, sentence-case titles, buttons with a little more accent (see [DESIGN_SYSTEM.md › Style v4](project/DESIGN_SYSTEM.md#style-v4-the-app-style) and the design kit). All screens, mockups and polish follow it.
- **Calm surface, deep data** (owner, 2026-10-14): each screen should feel clean, friendly and smooth (the goal is close to Apple-level polish), yet nearly all raw data stays reachable. The first look shows the answer and what matters; numbers and sources live one hover, click or expand away. Not empty, not a wall of raw numbers.
- **No pseudo dead space** (owner, 2026-10-14, a top priority): besides empty areas, avoid long strips whose content could fit in a fraction of the space (wide inputs holding a short value, rows with a label far left and a value far right, a lone badge at the end of a long line). Size elements to their content, group related values tightly, and use the freed space for something useful.
- **Matrices:** small matrices may be plain coloured cells, but every cell shows its hand and mix on hover; large matrices must show hand labels in the cells (and mixed cells split by action), never a field of unlabelled squares.
- **Interaction feel** (owner): every control reacts to the pointer (hover, press, hold, drag) with smooth feedback; motion and sound support it.
- **Rows never stretch content to opposite edges with dead space in between** (history rails, ledgers, lists): keep related values close, use compact columns.
- **Rows must cope with any number of entries** (e.g. many rebuys of different amounts): show totals plus a count, with the entries one click away.
- **Show states visually, not only in words** (owner, 2026-10): e.g. an unknown hand is two face-down card backs, not just "Any two cards". Words may stay as support. Applies app-wide.
- **Composition principles**: spacing over boxes; three depths (summary → hover/focus → disclosure, nothing lost); one action colour language everywhere; mini-visuals beside numbers; ledger numbers (tabular, right-aligned, muted units); one object, one look; free space shows only already-available context (never hidden computation or filler); calm loading (skeletons, ~150ms transitions, no layout jumps).
- **Comfort contract** (every redesign): size follows content; no dead zones (>~160×160px) while useful info exists elsewhere; focal object and primary action above the fold at 1920×1080 and 1366×768; information preserved; clicks/scrolls never worse; one spacing rhythm; values never truncate; RTL correct; fidelity differences listed with reasons.
- **Stability rules** [M1 foundation]: fixed workspace skeleton; reserved heights for changing regions; no reflow on input changes; one app-ready moment (no asset pop-in or flicker); hover never changes layout; card size scale by context (inline/mini/standard/table, hero = board = dead within a context); one status/provenance indicator per surface (no repeated "Heuristic fallback").
- **Space**: avoid both extremes: no oversized near-empty panels and no over-compressed tabs/rails; use horizontal space, put related content side by side. Technical/semantic correctness beats mockup fidelity.
- **Mockups are a visual reference, never a numeric spec**: every number in a mockup, demo, lesson or test comes from the domain engine ("golden spots"); mockup figures are illustrative and were found wrong in places (independent review 2026-10).
- **Mockups are the visual base** (VISUAL-DESIGN-REVIEW-2026-10 Saved/Analyze/Hand mockups), measured as a spec, adapted to Riverline's requirements. Screens without mockups get a mockup approved **before** they are built.
- Visual acceptance: Firefox 1920×1080 at 100% primary; 1366×768 functional; EN/RU/HE; Midnight + Daylight; never "zoom out" as a fix.

---

## 9. Milestones and gates

Milestones are approximate checkpoints in one continuous flow, not releases; there is no deadline. The only real release is the first time Riverline is shared with people other than the owner (close-friend testers first, a public release only after the official documents exist).

### M1: trustworthy, beautiful base
**M1 is design-first (owner, 2026-10-15):** first of all a very good design refresh, so the app looks and feels as imagined, before exciting features; the owner will QA heavily on the PC. Feature work in M1 stays limited to honesty and usability (truth fixes, trust package, data safety, i18n). Ordered plan: the queue in [STATE.md](STATE.md#ordered-queue-m1-design-first). Ideas keep flowing alongside polish and are collected in [IDEA_BANK.md](IDEA_BANK.md) so the project stays exciting.
**Foundation and truth**
- WIP safety backup; **docs and workflow reset** (this document's first job).
- Truth fixes: hide strategy sliders; spot table shows only real facts; reject 0 buy-in; apply 650 weights.
- Trust package (§3.3; exact push/fold moved to M2).
- Randomisers in full; spot generator in its M1 scope (§6.2).
- Data safety: persistent browser storage + strongly guarded "Delete all data".
- Maintenance: issue register consolidation, flaky Saved keyboard test, test hygiene, archive recovery evidence, Game night zero cash-out record + editable edits.

**Design refresh (big, owner priority)**
- Layout and stability foundation + Design Language v2 + automated audit (overflow, clipping, reflow; dead space where reliable).
- The look of the 2026-10 canvases as the reference, adapted to the real icons and card backs.
- **Shell refresh and sidebar rework** (five variants mocked up; owner favours 2 "Home first, grouped by job" and 4 "hubs with sub-items"; the current rail stays in consideration). Decide the shell direction before starting M1 screen work.
- **Motion layer done well** (owner rates animation highly), richer felt/table, display-typeface test.
- **First sound set** with master volume and mute.
- **Built for what comes next:** the design revamp plans space and patterns for M2/M3 features (Orbit, bot tables, plan context, inline equity, Chippy, achievements, phone views) so they slot in without another redesign: shared components, reserved regions, and pre-dependency versions of each screen.
- Screens: Saved and Analyze (finish), **Training and Settings full redesign** (Settings incl. a table preview in Appearance; shortcut rebinding in M2), **full foundation passes** on Equity, Personal Strategy, Home, Hand, Review, Game night and Guide (token/layout-level so their M2 reworks don't redo them).
- Full Hand quality pass incl. its table visual pass in Style v4 (bugs + Watch Rest skip; speed controls M2); i18n completeness.
- **Screen order:** by the logical time axis: screens whose big reworks or feature reworks come later get light foundation passes now, so nothing is redone; the order is managed by the Manager ([STATE.md](STATE.md#ordered-queue-m1-design-first)).
- **Owner design pass** over every screen before M1 closes; app-wide rules (§8) apply everywhere, Settings included.

### M2: core feature reworks
Personal Strategy question flow + three-state matrix + preflop layers 2–3 (both hand groupings prototyped); Equity rework + runouts + equity intuition drills; Hand input + phone-note paste + money-mode input; Review walkthrough + key moments (signature screen) incl. single-hand luck analysis; Home continuity (incl. a reason to open Home first); Learn hub + onboarding ("Where do you play?"); Table rules v1 + "My poker" decision; Game night rework + session history + game night → hands → review link; Saved fact filters + tags; Explain quality; exact push/fold (model-labelled); shortcut rebinding; early one-file export; Full Hand speed controls. Late M2/M3: review queue, range recall.

### M3: expansion
Solver library; plan context in feedback; Orbit (stack carry, rebuys, orbits) + session reports; strategy adjustment engine + shared opponent model + card-aware bots + bot tables; NL narratives and follow-ups; inline equity and connected workspaces; GGPoker import; import + sync groundwork; full audio mixer; Chippy; progression and achievements (no streaks); delight motion; share a hand as text/image; phone-friendly capture page and Game night view.

### Gates (apply at every milestone unless noted)
1. No open P0/P1 issues (data loss, wrong money, false strategy claims, broken core flows).
2. Every in-scope screen meets the design standard and passes the automated audit.
3. Clean hands-on QA sweep (an independent Claude Code review after the M1 foundation lands).
4. Trust package delivered (from M1). Not a hard gate (owner, 2026-10-15): exact maths and honest labels land in M1; the reference measurement may trail into early M2.
5. i18n complete and natural enough (native polish later).
6. **"I use it by choice"**: checked monthly from now on; as a gate, a few real study sessions a week for about a month (meaningful after M2).
Data safety is planned work, **not** a gate. Gates are checkpoints for judgement, not hard blockers; the owner decides.

**Polish before heavy features (owner, 2026-10-14):** reach a very high level of smoothness, reactivity and visual polish (the M1 design refresh, finished on the PC) before starting the resource-heavy feature work of M2/M3.

Scope rule: anything new goes to a later milestone unless it fixes a P0/P1 or is tiny and inside a screen already being redesigned. A big design milestone must not also grow new features. No deadline; quality-gated; the Manager flags drift.

---

## 10. How work is done

### Roles
- **Manager**: this persistent Claude Project chat. Priorities, decisions, design interviews, tickets, report review, acceptance interpretation, continuity. Read-only investigation allowed; no repository edits.
- **Work**: one Claude Code session per ticket. Implements, verifies at the ticket's tier, reports, stops. Same-ticket corrections and interruptions continue in the **same session** (resume from files; never start a duplicate session for the same ticket).
- **Review**: independent read-only Claude Code session when risk justifies it (maths, money, identity, persistence, migrations, source authority). No extra QA pass by default.
- The owner carries tickets and reports between chats. Chats don't share live context. The Manager says explicitly: "open a separate Claude Code work session for this ticket, then return here with its report."

### Tickets
- One bounded outcome; stable ID; goal, scope, invariants at risk, acceptance, stop conditions.
- Every ticket states: **execution class**, **verification tier**, **suggested model/effort**.
- **Approved design before building** for any redesign (mockup sign-off; mockup-as-spec with measured fidelity).
- Execution classes: Mechanical Fast, Product Contract First, Correctness/Architecture, Heavy Future Design.

### Verification tiers
| Tier | For | Tests | Browser | Full suite | Beta smoke |
|---|---|---|---|---|---|
| T0 | docs, mechanical, read-only | touched only | none | no | no |
| T1 | fixes, small features | focused | 1 config (1920 EN Midnight); HE if layout/direction affected | only if shared modules changed | no |
| T2 | redesigns, big features | focused | mockup comparison: 1920+1366 EN, 1920 HE, one Daylight shot | once, at the end | no |
| T3 | milestones only | all | full matrix | yes | yes |

### Reading rules
Minimum read set: AGENTS.md, then only ticket-named files. No whole-file reads of giant files (logic.js, styles.css, QA register): search by ID/function/heading. No re-reading unchanged files during same-session corrections. Tickets carry their own essential context.

### Git and files
- Workers never stage, commit, push, reset, clean or stash unless explicitly authorized. Never broad-stage (`git add .`, `-A`, `--all`). The owner commits after acceptance with exact-file lists.
- Protected: `.codex/config.toml`, `.gitignore` (unless ticket-owned), `repo_dump.py`, `repo_dump.txt`, local auth config, helper/backup artifacts.
- Repo is **LF-only** via `.gitattributes`; `core.autocrlf=false`; never convert line endings; check `git diff --stat` for churn.
- Windows/Git Bash: write scripts with file-write tools, not heredocs.
- Node: engines ≥22, `.nvmrc` 24 (CI Node 24).
- Dev server: `node tools/dev-web-server.mjs` (keep it in its own window); dev-only component sheet at `/__dev/component-sheet.html`.
- Cloud sessions only with explicit authorization, a pushed base, a separate branch and a spend limit.

### External reviewer (Gemini Argon)
- Google's Gemini 4 Argon (available to the owner in the Gemini app and Antigravity) is used for **independent second opinions** (maths and number checks, design critique, research, plan sanity checks), **one-off read-only whole-repo audits** in Antigravity, and as a second reader for RU/HE wording and later legal drafts. It does not implement tickets or manage: Claude Code stays the only writer on the repo, never concurrently with another tool, under the same git safety rules.

### Acceptance
- Human acceptance is its own evidence; tests and commit titles cannot create it.
- If the owner reports only failures from a requested checklist, unmentioned checks pass unless later changes create regression risk.
- After ~2 same-cause rejected corrections, rethink the concept instead of patching again.
- Worker reports stay detailed: outcome, root causes, files (ticket vs pre-existing), exact verification incl. failures and reruns, limitations, debt with owners, Git status.

---

## 11. Rejected or out of scope (do not revive without the owner)
Arbitrary layout editors; Comfortable/Compact density toggle; Controls First; global Beginner/Expert switch; casino neon, confetti, fake 3D; numeric confidence percentages; templates as the primary plan-building path; shorthand text hand entry; tournament mode in Home Game; exact postflop ranges per node (current scope); LLM-based natural language; AGPL code inside the app (until openness is decided); grading heuristic disagreement as a mistake outside its confidence tier; mockup-replacement icons.

## 11b. Owner decisions, 2026-10-10
- **Naming:** things that are not grouped together must not share a name. Rename proposal pending owner confirmation (see §13).
- **Money-mode input:** reconstruction and Home Game accept amounts in money or in bb; stored in bb with the blinds as the conversion (many live players think in money, online players in bb). [M2]
- **No schedule pressure:** milestones are approximate gates in one continuous flow; duration does not matter.
- **Short stacks:** the owner's home game buys in for 30–60 bb and plays normal (not push/fold) poker. The baseline must handle realistic 30–60 bb cash play; push/fold stays a separate model for very short stacks. Research item: how to reference-check 30–60 bb cash ("Verified" may not be reachable there; Estimated is honest).
- **Rare baseline actions in feedback:** mention briefly only when the frequency is low *and* there is a reason worth teaching; otherwise don't mention it.
- **Drills have two modes:** a quick refresher (fast, minimal) and a long atmospheric session (to start a study session). This also answers the table question: both exist, for different moods.
- **Input priority:** mouse-first; the app must look and feel good before keyboard behaviour is polished. The key contract stands but is low priority. Both mouse and keyboard should feel rewarding (hover and press micro-interactions).
- **Visual direction:** the owner wants the app to move toward the look of the 2026-10 design canvases (clean, useful, beautiful, smooth), with tweaks for preference. That style is the reference for the M1 design rework and for the decision-control exploration (no external reference apps needed). Common problems to remove everywhere: dead space from over-wide layouts, outdated features, missing settings and documentation.

## 11c. Owner decisions after the market research review (2026-10-10)
- **Confidence tiers renamed:** Exact / **Verified** (was Checked; "checked" collides with the poker action in EN, RU «чек», HE «צ'ק») / **Estimated** (was Approximate) / Unavailable. RU: Точно / Подтверждено / Оценочно / Недоступно. HE: מדויק / מאומת / משוער / לא זמין.
- **Positioning:** "The honest poker coach for the hands you actually play." Explanations that never invent facts are the differentiator; never position as "GTO trainer" or "AI coach".
- **Review (decisions vs luck) is the signature screen.**
- **Baseline priority:** multiway, 30–60 bb, rake-free spots, ordered by how often they occur in the owner's recorded hands.
- **First run asks "Where do you play?"** (home game 30–60 bb / live casino / online 6-max) before the first drill, which then uses that format.
- **Game night framing:** "keep score and settle up with friends"; a points / chips-only mode; legal read before any public RU/HE release; no rake/house-cut fields.
- **Monthly "would I use it by choice?" check** from now on, not only as a late gate.
- **Streaks dropped.** Chippy and achievements stay (M3).
- **Approaches stay a structural layer for now**, revisited once Personal Strategy is in real use.
- **Hand capture from the phone (both):** (1) a narrow **phone-note paste** in Hand that turns the owner's own shorthand into a draft hand with every guess labelled [M2, with Hand input; partly reverses the earlier "no shorthand entry" decision]; (2) a **phone-friendly capture page** reachable on the local network [M3; needs a privacy and security check before serving on a LAN].
- **Equity intuition drills move earlier** (M2); the review queue and range recall stay late M2 / M3.
- **Personal Strategy starts question-first**, but not as a strict rule; a baseline-based starting plan (marked "not yet yours") can be reconsidered later.
- **Share a hand as text or image** (no account; for friends' chats): M3.
- **Game night → hands → review link** moves to **M2**: reconstructed hands can be attached to a game night; Home surfaces them next day ("2 hands from Friday") → Review → drill.
- **Audio trimmed:** first one good sound set + master volume and mute; the full per-category mixer and variants later (M3+).
- **Game night extras later:** banker mode, chip-rate mode, reopening settled sessions and live-night helpers wait; fewest-transfers settlement, notes, history and the balance gate come first.
- **Who uses it:** the owner as tester now; close friends as testers when interested; a public release is the eventual wish (legal documents first).
- **Game night happens on phones** (usually no laptop at the table). The desktop stays first-class, but Game night (and hand capture) need a phone-friendly view, planned with the M3 capture page.
- **The owner's poker:** home games 6–8 handed, short to mid stacks (30–60 bb buy-ins); online **9-max** with 100+ bb; and plenty of study. Built-in Table rules and the baseline priority should cover these contexts: add an online 9-max preset and a short-stacked 6–8-max home preset (replacing "Short-stacked 20–40 bb").
- Kept as planned (owner declined the trims): Equity full M2 redesign; full bot configuration depth in M3 (sliders, lineups, read the table).

## 12. Decisions that changed recently (read before trusting older docs)
- Achievements/XP: **reopened** (was rejected) with honesty guardrails; streaks dropped.
- "Heuristic disagreement is never a mistake" → refined: the baseline is the **teaching target, tiered by confidence**; disagreement outside a firm tier is still not called a mistake.
- Confidence tiers renamed: Checked → **Verified**, Approximate → **Estimated**.
- Equity "Calculate always explicit" → **auto when cheap, click when heavy**; Equity inputs are Cards / Range / Unknown with Random as a separate deal button.
- Verdict in action colour → **sentence case, primary colour; action colour in the mix card**; exactly two verdict states (dominant / close).
- Hand is a **reconstruction workstation**; bot play belongs to Training. Shorthand entry is out except a narrow phone-note paste.
- Releases → **milestones M1/M2/M3** in continuous development.
- Home "Destinations" panel removed; Guide workspace and Learn Riverline merge into the Learn hub (M2).
- Home Game → user-facing **Game night**; per-player buy-ins, independent sessions; banker, chip rates and reopening moved later.
- Game settings: Home/ClubGG presets → versioned **Table rules** (separate from Personal Strategy **Games**); built-ins cover online 9-max, online 6-max, private table, short-stacked home, heads-up.
- Strategy sliders: hidden until the M3 adjustment engine (Table / Opponent / Style).
- Data safety: persistent storage + guarded delete in M1, export early M2, import M3; not a gate.
- Weights: 650 for labels/controls/fact values (owner preference after comparing with the mockup).
- Mockups are visual references only; numbers come from the engine.

## 13. Open questions
- **Shell and sidebar direction** (decide before M1 screen work; the owner can do most shell work on the phone via mockups, with PC fixes afterwards): refresh toward the canvas shell; rail variant 2 or 4 (or the current one); whether "Tools"/"Study" hubs become screens (Tools = recent work per tool; owner, 2026-10-12: Home stays its own screen with room for future content, and a Study hub would be a separate screen, not Home).
- **"My poker"**: sidebar slot vs merging with Saved into a "Library"; final name (owner decides after real use).
- **Mockup choices (see [STATE.md › Open decisions](STATE.md#open-decisions); full mockup log archived at `docs/archive/2026-10/MOCKUP_REVIEW_LOG.md`):** drill table vs table-less (both modes exist: quick refresher and atmospheric session); decision controls narrowed to a Slabs + Choice cards mix (big cards with action colours and raise sizes) or the at-your-seat look, tweaked; sidebar 4 if hub sub-screens exist, otherwise 2 vs 4; Personal Strategy answer methods; Equity A (rows) vs B (columns); the Learn A/B mix.
- **Game night workspace name**: "Game night" applied; the owner may revisit.
- **Hand groupings research:** do roles change with the spot; how coaching sites group hands.
- **Baseline for 30–60 bb multiway home play:** how to reference-check it (may stay Estimated).
- **Mix bar in Hebrew:** keep left-to-right as a data island, or mirror (owner decides on the PC; Manager leans left-to-right).
- **Design kit (owner, 2026-10-13):** the redesign's target is the look of the 2026-10 canvases (smoother and more modern than the current app), not the current app. The Manager keeps one canonical design kit built from the best mockups (shell, spacing, components, table at a realistic size) and builds every new mockup on it, so mockups stay consistent and balanced. A small PC ticket supplies only the real assets the mockups must not invent: card backs, icons, and the current table's measurements for reference.
- **Training needs more than the decision:** useful panels for drill modes (e.g. session results by spot type, the opener's likely range, your plan for the spot revealed after answering, recent mistakes) without leaking answers before submission.
- Pre-dependency versions of screens (an M1/M2 screen never relies on an M3 feature); Manager handles this when writing redesign tickets.
- Open-source vs closed (keeps AGPL out until decided).
- Exact tolerances for "Verified" per spot type (worker proposes, owner approves).
- Display typeface: narrowed to the current UI font or **Rubik** (owner leans Rubik for bolder headings; serifs rejected); final choice on the PC.
