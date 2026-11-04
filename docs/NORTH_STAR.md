# Riverline North Star

Status: the shared guide for product direction, drafted by the Manager on 2026-10-05 from the full manager-chat history (migration bundle of 2026-09-29, all tickets and QA since, and three rounds of owner design interviews); installed by DOCS-RESET-001 (2026-10-15); updated by DOCS-PHASE1-001 (2026-10-26) with the owner's Phase 1, Personal Strategy, Hand, phone and long-term decisions of 2026-10-18 → 26 (logs with reasons in [design/decisions/](design/decisions/README.md); project context in [BRIEF.md](BRIEF.md)). It replaces older vision/roadmap text where they conflict. Items marked *provisional* are decided in direction but get their final form at mockup or ticket time.

DOCS-RESET-002 (2026-10-31): the per-area detail of §7 moved verbatim to [project/AREA_DIRECTION.md](project/AREA_DIRECTION.md), and §11b, §11c and §12 moved verbatim to the single [decision log](design/decisions/OWNER_DECISIONS.md); their headings stay here as pointers. §10 duplicates AGENTS.md; AGENTS.md wins.

This is a rail guide, not an ultimatum. **The owner's judgement is always final**, and any decision here can be revisited when there is a good reason. Agents follow it so work stays consistent; when something here seems wrong or blocks a better outcome, raise it rather than silently working around it. Order of reference when sources disagree: the owner's current instructions → this file → [STATE.md](STATE.md) (live status) → [DESIGN_SYSTEM.md](project/DESIGN_SYSTEM.md) (visual contract) → subsystem reference specs in [project/](project/) (including [CAPABILITY_GUARDRAILS.md](project/CAPABILITY_GUARDRAILS.md)) → archived history in [archive/](archive/README.md). Issues live in [ISSUE_REGISTER.md](ISSUE_REGISTER.md), terms in [TERMINOLOGY.md](TERMINOLOGY.md), ideas in [IDEA_BANK.md](IDEA_BANK.md). If code contradicts an invariant here, report it as a likely defect instead of quietly reinterpreting the rule.

Milestone tags used below: **[M1]** trustworthy polished base, **[M2]** core feature reworks, **[M3]** expansion, **[Later]** preserved direction with no milestone, **[Out]** deliberately not pursued. "Releases" are internal milestones in one continuous development flow; the only real release is when Riverline is first shared with other people.

---

## 1. What Riverline is

Riverline is a personal No-Limit Texas Hold'em learning workstation. It is a **coach that learns how you play and honestly teaches you toward better poker**. It connects play/reconstruction, analysis, an intended personal strategy, training and review into one loop instead of disconnected charts, quizzes and notes.

The learning loop:

> Reconstruct or play → Replay and Review → Analyze and Explain → compare with the baseline and your plan → teach Riverline your intended strategy → train (drills, Full Hand, Orbit) → Riverline notices patterns → targeted teaching → apply it at the table.

Audience and character:
- First user is the owner; friends later, only when it is close to done; a public release is the eventual wish (official documents first). **When others test (LT-05, 2026-10-21):** no fixed date; working criterion: M1 and M2 gates met, the owner's month-long "I use it by choice" check passed, official documents in place; close friends first.
- **Business model (LT-02, 2026-10-20):** mostly free; money later, if ever, from an optional subscription / supporter tier / paid services (the word "donations" only fits a non-profit, R-02), like learning apps that give most content free; a community that shares content and says what it wants next. **Source model:** quality first, legality always: get the best solvers and tools, use them lawfully, and choose closed vs open source *after* seeing what the best options require (if the best solver required AGPL, open-sourcing Riverline would be acceptable). Treated as closed until decided. Consequences: no AGPL code inside the app; every outside licence recorded in [THIRD_PARTY.md](THIRD_PARTY.md) (sourcing policy LT-04); anything in a paid tier needs licences that allow commercial use; professional legal review before any paid offering.
- Serious recreational and improving players. **PC first** (owner correction P1-28, 2026-10-23: PC is the priority and harder to get right; phone versions come after), browser-first, **local-first**. Electron is a thin host; ordinary browser use needs no Python. A phone version close to the full app is designed now and built later (§7.19).
- Home/club/private games matter alongside online cash. Operator names never decide mathematical rules.
- Languages: **EN, RU, HE** (including RTL), first-class.
- Product names: Riverline / Риверлайн / ריברליין. **Name kept (D-30, owner 2026-10-21)**: it is the owner's favourite and none of the alternatives sound as good, although the name check (R-03) found an active real-money crypto poker room called "Riverline Poker", a "Riverline AI" app with a pending mark, and the main domains taken. So a **name watch** tracks trademarks, domains, store listings and the poker room (NAME-WATCH-001, repeated before launch); mitigations for later: a distinct domain/handle, a descriptive store name (e.g. "Riverline: poker study"), clear "not a poker site" copy, a trademark check before any public launch. Backup names if a launch-time check forces a change: see LONG_TERM_NOTES (e.g. "Riverframe" keeps the River root).

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
- **Study tool, not real-time assistance** (MOB-01, D-33, owner 2026-10-21). Using Riverline for live help during a real game is cheating, and poker sites ban real-time assistance even on another device (R-02). A **"Quick spot lookup"** (renamed from "live decision" mode) may exist for quick study on the go, strongly discouraged during real games, with a clear warning every time it opens and in the disclaimer. **Four hard limits** (Manager recommendation; the owner raised no objection, LT-07): (1) no overlays on poker clients; (2) no reading poker-client screens or hand histories in real time; (3) nothing built to evade site detection; (4) no marketing implying in-game use. An optional desktop self-lock while poker clients run stays a possible extra (D-33 options; master synthesis idea). The first-run confirmation carries the 18+ notice and a short fair-play line (§7.11).
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

- **Every number shows what it is based on and how sure it is (D-31, owner 2026-10-21):** in plain words, a **source** (exact maths, solver, model, heuristic baseline, assumption/guess) plus the **tier** (Exact / Verified / Estimated / Unavailable) and a **scope** where useful, shown as **one combined label in a fixed place** per surface (e.g. "Model · Estimated · multiway", "Exact · price only", "Heuristic baseline · Estimated"), with a **one-line reason on demand** and details in "Source". When there is no data, say so; fallbacks are allowed but always labelled. The exact vocabulary is the worker's proposal for the owner ("pick a vocabulary that describes the data well enough; not a big deal"). This replaces the earlier "one tier label" wording, which named the tier only. **No numeric confidence percentages** (uncalibrated percentages would be dishonest).
- The solver-research finding that the owner's multiway, limped 30–60 bb game **can never be "Verified" in a strict sense** (R-01) is accepted: those contexts stay honestly Estimated (or Model · Estimated) unless a real verification route appears.
- Tolerances for "Verified" are defined per spot type **before** measurement (worker proposes, owner approves). Any later heuristic change drops affected spots back to Estimated until re-measured.

### 3.3 Trust package [M1, a milestone gate]
1. **Internal measurement** of the baseline with a **free measurement harness** (BASELINE-MEASURE-001; R-01, owner 2026-10-21/23): invariant tests (monotonicity, blockers, sizes), exact preflop best response where possible, multiway local best response and AIVAT-style variance reduction, boundary checks; results per context. **No third-party charts are downloaded or copied, not even for measurement** (stricter than the earlier "measure against reputable public charts, ship nothing" plan, which this replaces: downloading free charts is itself a licence and copying risk, R-01). "Verified" only where the per-context tolerances are met. Measurement contexts include the home/live contexts (R-08) alongside online 6-max/9-max.
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
5. **Measure before changing the baseline** (research round 3, adopted 2026-10-26): baseline improvements come as separate tickets **after** the measurement harness exists, so each change can be measured; a heuristic change drops the affected spots to Estimated until re-measured. Four candidates from R-08's failure modes, in order: (1) an **implied-odds gate** for set-mining and small suited hands (effective stack ÷ call ≥ about 15; first because it is the simplest and matters most at 30–60 bb); (2) **multiway caution** for c-bets and calls (a sourced rule, not R-08's invented "1/k^1.4" formula; the exact compound fold maths, e.g. a bluff needing each of two opponents to fold about 58% instead of 33% heads-up, is exact and teachable); (3) **action-conditioned opponent ranges** (live check-raises strong, small donk bets weak); (4) **iso-raise vs over-limp** rules with an explicit limper model.

### 3.3b Baseline targeting (owner, 2026-10)
No target game is privileged. The baseline is parameterised by Table rules, and "Verified" is earned **per context** once that context is measured. Contexts that can be verified (mostly heads-up and online 6-max/9-max, 100 bb; R-08 adds heads-up single-raised, blind-vs-blind and low-SPR 3-bet pots) can earn Verified first; others, including the owner's live home game, stay honestly Estimated until a way to verify them exists.
- **Home and live contexts (R-08, adopted 2026-10-26 with a caution):** R-08's 20 most common home/live spots are the priority list for golden spots (GOLDEN-SPOTS-001), the spot generator's home-game scope and the measurement contexts. Useful facts: about 55% of live low-stakes flops are multiway (online 80–88% heads-up); limps are common; a 30–60 bb game with 3–5x opens lands at about the same postflop SPR as a 100 bb live game with 5–6x opens, so one context can serve both. **Owner caution (2026-10-26): don't focus heavily on one game preset**; home/live contexts get attention alongside online 6-max/9-max, not instead of them.
- **Limped multiway pots (owner, 2026-10-23):** important, not a declared priority: in the spot generator's M1 scope where cheap; drills, Analyze labels and measurement contexts in M2.

### 3.4 Solver and reference track
- Solver-backed library: **[M3]** (owner moved it out of M1). The research spike may start earlier.
- Own full preflop solving (6-max): **[M3]** solver track, gated by research and licensing.
- **Free-first solver path (LT-03, LT-06, LT-07, R-01; owner 2026-10-20 → 23).** The owner's rule: use free software wherever possible and develop our own to fill gaps; **no spending is committed** (HRC Pro deferred); full coverage of every home-game and online context is not expected in one go ("poker is complex"); solvers are built step by step. The plan, in order:
  1. **Postflop: b-inary/postflop-solver run offline** on the owner's PC; only its numerical output ships, converted to Riverline's own data format, labelled solver-backed with full provenance (tree, settings, convergence, repeatability) and "solution for these ranges and this tree". Research (LT-06, to verify): AGPL does not reach output data, so shipping is allowed in closed or open, free or paid builds; quality comparable to commercial tools; development suspended in 2023 but functionally complete. Its code may only go inside the app if Riverline itself becomes AGPL open source.
  2. **Exact N-player push/fold** computed by Riverline (M2), then an **own fixed-tree preflop solver** (limp, iso, open, 3-bet, 4-bet, jam) built in a separate tool on permissive (MIT/BSD/Apache) foundations, with heads-up postflop leaves from postflop-solver value tables; multiway leaves via a calibrated equity-realisation model (Estimated); multiway blueprints later. The researcher's effort and accuracy estimates are likely optimistic.
  3. **Pilot first:** SOLVER-PILOT-001 is internal measurement only (nothing ships) until the licence quotes are verified ourselves (HRC EULA clause, FSF FAQ, postflop-solver licence). It needs the Rust toolchain (open decision).
  4. **Avoid:** shipping GTO+ (personal non-commercial), Simple Postflop (written permission needed) or PioSOLVER data (on-demand lookup needs a business licence); TexasSolver (accuracy doubts, contradictory licence claims); GPL/AGPL code in the app; unlicensed repos and opaque binaries; **downloading or copying any third-party charts, even for measurement**. HRC Pro (commercial export allowed via its own export functions) stays a possible later purchase for preflop/multiway if the owner decides to buy.
  5. **Long-term fallback:** Riverline's own clean-room solver from published papers (turn/river first; full flop and multiway/preflop are long efforts), giving full control of data and licensing (M3+).
- Reference contract is preflop-shaped today and needs extension for postflop.
- **No AGPL code inside the app** (LT-02); offline solver use to generate data is fine. Every outside solver, dataset and building block gets a row in [THIRD_PARTY.md](THIRD_PARTY.md) before use (LT-04).
- Solves are only as good as their input ranges: label "solution given these ranges".
- Interpolation/extrapolation and learned estimates: **[Later]**, only after a trustworthy corpus with held-out validation; always labelled estimates, never "exact reference".
- **Own solvers as an option (owner, 2026-10-11):** building Riverline's own solving capability (research, possibly GPU or rented compute) is on the table alongside licensing someone else's data. Manager notes: postflop solvers such as postflop-solver run on CPU and the owner's PC can start offline generation without new hardware; GPUs matter mainly for very large trees or learned models; rented cloud compute fits short bursts; buying or licensing data needs a licence that clearly allows redistribution in the app (the 2026-09 HRC pilot shows the cost of getting this wrong). A research spike compares cost, quality, licensing and effort before any purchase.
- **Earlier solver research findings (independent report, 2026-10-12, doc: https://claude.ai/artifact/PdNJrKcCYvzbXgiNS5EARY; superseded where the free-first path above differs, e.g. the licensing details and the HRC terms, which LT-06 later found):** the cheapest legal route is b-inary's postflop-solver run **offline** on the owner's PC (AGPL code never ships; only its output files do), with the free PioSOLVER edition as an independent internal cross-check, and every result labelled "solution for these ranges and this tree". That can make heads-up postflop and push/fold Verified or Exact within two stages at about $0; stage 1 is SOLVER-PILOT-001, which also settles how accurate the heuristic is. Multiway postflop stays Estimated (no one solves it well; commercial tools stop at 3-way). Pio's terms forbid shipping its results as an on-demand lookup, so commercial tools are cross-checks only. An own opponent model applied as node-locks could make exploit advice Verified per model. Later routes: rented high-memory CPU machines (cheap per hour) for deeper trees; abstraction-based multiway preflop (MIT code, days of compute, Estimated); a value-network experiment within the cloud credits (research only). Buying a GPU: not yet. Unconfirmed: GTO Wizard, GTO+ and HRC output terms, HRC's price, and whether postflop-solver supports node-locking. **Timing (owner, 2026-10-12):** flexible; stage 1 runs whenever resources allow and can be pushed back. The polished app comes first; the M1 trust package (references, exact maths, honest labels) still stands.
- No production ONNX/model runtime, remote strategy API or solver runtime in the app today.
- Hardware: Ryzen 7 5700X, GTX 1660 Super, 16 GB RAM. The existing solver benchmark is a 46-node preflop toy tree and proves nothing about postflop cost.
- Spend: **free first, no spending committed (LT-07, owner 2026-10-21)**; this replaces the earlier "optional compute budget ≈ US$75". ~US$90 of cloud session credits are unused and reserved for work that genuinely benefits from cloud. Every paid experiment still needs explicit owner approval with max spend, runtime, artifacts, success and stop criteria.
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
- The working voice rules, patterns, takeaway-line formula and banned words are in [design/VOICE_GUIDE.md](design/VOICE_GUIDE.md) (draft 2026-10-22: "a calm, honest coach"). **Russian uses the casual «ты»** (owner, 2026-10-23), consistent with the Hebrew masculine singular; the guide's RU examples are still to be rewritten in «ты» form, and the owner reviews RU/HE wording.

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
- Contents: **table size; blinds + straddle; antes; rake (%, cap, preflop rule); default stacks (depth + varied/equal, and uneven per seat); name + label.** Cash games only. No currency.
- **Uneven stacks per seat (idea 27, from R-05 / R-08; M2):** a first-class option (home games put 40 bb next to 250 bb), so drills, Analyze and the baseline see the real effective stacks.
- **Each workspace remembers its own Table rules**, shown as a chip in its header.
- **Versioned**: editing creates a new version; saved hands keep theirs (never retroactive).
- Built-ins (read-only, duplicable): **Online 9-max (100 bb, rake), Online 6-max (100 bb, rake), Private table (no rake), Short-stacked home (6–8 players, 40 bb usual, 30–60 bb range, no rake), Heads-up**. They replace the arbitrary "Home / ClubGG" choices and cover the owner's real formats (checked 2026-10-26 against §11c: the online 9-max and short-stacked 6–8-handed home presets are in the list). Rake values described generically, not as a named site's structure. No preset is the privileged one (owner caution 2026-10-26, §3.3b).
- Amounts: shown in bb; typing money is allowed and converted with the blinds (money-mode input, M2).
- Bet-size presets: fixed sensible defaults first; **per-Table-rules presets later**.
- Central home in "My poker" plus in-place editing from workspaces (same object, never copies).
- **Context chip:** every workspace header shows the context chip "Table rules · approach" (P1-26, Home and later screens).

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
- **Settings** = app preferences only: Appearance (app theme, table preview / table theme, cards, text size), Sound & motion (the global Motion setting, P1-09, and sound as **separate** controls), Language, Help & guide, Chippy (own category, M3), Shortcuts, Account & data, About & legal. Training preferences such as the answer mode (select + confirm / Instant / Hold, P1-03) live in Settings › Training.
- **Reusable setups** (Table rules, Games and Approaches, Game night people, groups and presets, later bot tables and coach/target style) have one central page (working name **"My poker"**, mocked up 2026-10-11) **and** in-place editing in the workspaces that use them. It only earns its place through "Save as…" / "Manage…" entry points in every workspace. **Placement decided (P1-01, 2026-10-18):** My poker sits with Saved in the **Library** hub (the earlier "own sidebar slot vs merge" question is closed; the name stays a working name).

### 6.5 Shell and hubs (P1-01, P1-02; decided 2026-10-18)
- **Sidebar variant 4:** Home, then three hubs, each with its own hub screen: **Study** (Training, Personal Strategy, Learn), **Tools** (Hand, Analyze, Equity), **Library** (Saved, My poker); **Game night** separate below; a footer with language, sound, settings and About & legal. This closes the shell and sidebar question (earlier options: variant 2, the current rail).
- **Hub content (a working split; details may change at the PC):** **Home** is app-wide: continue, a short "today's session" invitation, last game night, what Riverline noticed (later Chippy, news, achievements). **Study hub:** plan coverage table, drill launcher (quick / long), review queue with why each item is due, learning path. **Tools hub:** recent hands / spots / Equity calculations with New buttons and quick actions (paste a hand history, last game night's hands, random spot). **Library hub:** Saved hands and spots (filters, inspector) plus the My poker setups (Table rules, games, people, presets).
- Visual rules for the shell: [DESIGN_SYSTEM › Shell](project/DESIGN_SYSTEM.md#shell-shell-001). Built by SHELL-002 (M1).

---

## 7. Feature direction by area

The per-area detail now lives in [project/AREA_DIRECTION.md](project/AREA_DIRECTION.md) (moved verbatim by DOCS-RESET-002, 2026-10-31). The headings stay here so existing links keep working.

### 7.1 Personal Strategy

Moved: [AREA_DIRECTION.md › 7.1 Personal Strategy](project/AREA_DIRECTION.md#71-personal-strategy).

### 7.2 Training

Moved: [AREA_DIRECTION.md › 7.2 Training](project/AREA_DIRECTION.md#72-training).

### 7.3 Analyze and the strategy engine

Moved: [AREA_DIRECTION.md › 7.3 Analyze and the strategy engine](project/AREA_DIRECTION.md#73-analyze-and-the-strategy-engine).

### 7.4 Equity

Moved: [AREA_DIRECTION.md › 7.4 Equity](project/AREA_DIRECTION.md#74-equity).

### 7.5 Hand (reconstruction workstation)

Moved: [AREA_DIRECTION.md › 7.5 Hand (reconstruction workstation)](project/AREA_DIRECTION.md#75-hand-reconstruction-workstation).

### 7.6 Review and Replay

Moved: [AREA_DIRECTION.md › 7.6 Review and Replay](project/AREA_DIRECTION.md#76-review-and-replay).

### 7.7 Saved and study library

Moved: [AREA_DIRECTION.md › 7.7 Saved and study library](project/AREA_DIRECTION.md#77-saved-and-study-library).

### 7.8 Home

Moved: [AREA_DIRECTION.md › 7.8 Home](project/AREA_DIRECTION.md#78-home).

### 7.9 Game night (Home Game organizer) [M2 rework]

Moved: [AREA_DIRECTION.md › 7.9 Game night (Home Game organizer)](project/AREA_DIRECTION.md#79-game-night-home-game-organizer-m2-rework).

### 7.10 Learn hub, onboarding, help

Moved: [AREA_DIRECTION.md › 7.10 Learn hub, onboarding, help](project/AREA_DIRECTION.md#710-learn-hub-onboarding-help).

### 7.11 Accounts, data, privacy

Moved: [AREA_DIRECTION.md › 7.11 Accounts, data, privacy](project/AREA_DIRECTION.md#711-accounts-data-privacy).

### 7.12 Achievements and progression [M3]

Moved: [AREA_DIRECTION.md › 7.12 Achievements and progression](project/AREA_DIRECTION.md#712-achievements-and-progression-m3).

### 7.13 Chippy and characters [M3]

Moved: [AREA_DIRECTION.md › 7.13 Chippy and characters](project/AREA_DIRECTION.md#713-chippy-and-characters-m3).

### 7.14 Natural language (rule-based, no LLM)

Moved: [AREA_DIRECTION.md › 7.14 Natural language (rule-based, no LLM)](project/AREA_DIRECTION.md#714-natural-language-rule-based-no-llm).

### 7.15 Audio [listening page in the M1 window; first real sound set after the owner picks by ear; full mixer later]

Moved: [AREA_DIRECTION.md › 7.15 Audio](project/AREA_DIRECTION.md#715-audio-listening-page-in-the-m1-window-first-real-sound-set-after-the-owner-picks-by-ear-full-mixer-later).

### 7.16 Motion and visual craft

Moved: [AREA_DIRECTION.md › 7.16 Motion and visual craft](project/AREA_DIRECTION.md#716-motion-and-visual-craft).

### 7.17 Language and terminology

Moved: [AREA_DIRECTION.md › 7.17 Language and terminology](project/AREA_DIRECTION.md#717-language-and-terminology).

### 7.18 Bigger directions [Later or Out]

Moved: [AREA_DIRECTION.md › 7.18 Bigger directions](project/AREA_DIRECTION.md#718-bigger-directions-later-or-out).

### 7.19 Phone version (MOB-01 … MOB-06; owner 2026-10-21) [design now, build after M2]

Moved: [AREA_DIRECTION.md › 7.19 Phone version (MOB-01 … MOB-06; owner 2026-10-21)](project/AREA_DIRECTION.md#719-phone-version-mob-01--mob-06-owner-2026-10-21-design-now-build-after-m2).

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
- **PC first (P1-28, owner correction 2026-10-23):** recent mockups had drifted into phone-first layouts. PC stays the priority and is harder to get right: keep the aesthetics, animation, design and colours, but design **1920×1080 PC layouts first**, thinking about what each PC layout needs and could add; phone versions come after. Every screen mockup is a fixed 1920×1080 canvas with the real shell. **Content inventory first (P1-26):** before designing a screen, re-read its earlier PC layouts and list what they contained; carry over what is still wanted and write down what is dropped and why. Mockup checklist: [design/MOCKUP_QA.md](design/MOCKUP_QA.md).
- The Phase 1 visual decisions (decision controls, select + confirm, Training panels, empty states, illustration, motion tempos, sound, Chippy, stickers, card back, heading face, Hebrew mix bar) are specified in [DESIGN_SYSTEM.md](project/DESIGN_SYSTEM.md).

---

## 9. Milestones and gates

Milestones are approximate checkpoints in one continuous flow, not releases; there is no deadline. The only real release is the first time Riverline is shared with people other than the owner (close-friend testers first, a public release only after the official documents exist).

### M1: trustworthy, beautiful base
**M1 is design-first (owner, 2026-10-15):** first of all a very good design refresh, so the app looks and feels as imagined, before exciting features; the owner will QA heavily on the PC. Feature work in M1 stays limited to honesty and usability (truth fixes, trust package, data safety, i18n). Ordered plan: the queue in [STATE.md](archive/2026-10/STATE_SNAPSHOT_2026-10-31.md#ordered-queue-m1-design-first). Ideas keep flowing alongside polish and are collected in [IDEA_BANK.md](IDEA_BANK.md) so the project stays exciting.
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
- **Shell refresh and sidebar rework: variant 4 with hub screens** (decided P1-01, 2026-10-18; §6.5), built as SHELL-002.
- **Motion layer done well** (owner rates animation highly): the motion foundation and the Motion setting (§7.16), richer felt/table, Rubik headings.
- **Welcome and Home redesigned** (owner's new priority, P1-17 / M1_BUILD_PLAN): onboarding A → C → B → D (§7.10) and the Home draft (§7.8).
- **Sound:** the listening page (AUDIO-RESEARCH-001) in the M1 window; the first real sound set after the owner's listening session (§7.15; replaces "first sound set with master volume and mute" as an M1 build item).
- **Notices** (18+, study tool, fair-play line, Quick spot lookup rename) before anyone else tests (NOTICES-001).
- **Built for what comes next:** the design revamp plans space and patterns for M2/M3 features (Orbit, bot tables, plan context, inline equity, Chippy, achievements, phone views) so they slot in without another redesign: shared components, reserved regions, and pre-dependency versions of each screen.
- Screens: Saved and Analyze (finish), **Training and Settings full redesign** (Settings incl. a table preview in Appearance; shortcut rebinding in M2), **full foundation passes** on Equity, Personal Strategy, Home, Hand, Review, Game night and Guide (token/layout-level so their M2 reworks don't redo them).
- Full Hand quality pass incl. its table visual pass in Style v4 (bugs + Watch Rest skip; speed controls M2); i18n completeness.
- **Screen order:** by the logical time axis: screens whose big reworks or feature reworks come later get light foundation passes now, so nothing is redone; the order is managed by the Manager ([STATE.md](archive/2026-10/STATE_SNAPSHOT_2026-10-31.md#ordered-queue-m1-design-first)).
- **Owner design pass** over every screen before M1 closes; app-wide rules (§8) apply everywhere, Settings included.

### M2: core feature reworks
Personal Strategy question flow + three-state matrix + preflop layers 2–3 (both hand groupings prototyped); Equity rework + runouts + equity intuition / estimation training; Hand input (HAND-01 … 07: table-first entry, short-notes capture syntax, gaps) + money-mode input; Review walkthrough + key moments (signature screen) incl. single-hand luck analysis and retry before reveal; Home continuity beyond the M1 Home redesign; Learn hub (58-concept draft map, first 8 lessons; onboarding itself moved to M1 as WELCOME-001); Table rules v1 + "My poker" decision; Game night rework + session history + game night → hands → review link; Saved fact filters + tags; Explain quality; exact push/fold (model-labelled); shortcut rebinding; early one-file export; Full Hand speed controls. Late M2/M3: review queue, range recall.

### M3: expansion
Solver library; plan context in feedback; Orbit (stack carry, rebuys, orbits) + session reports; strategy adjustment engine + shared opponent model + card-aware bots + bot tables; NL narratives and follow-ups; inline equity and connected workspaces; GGPoker import; import + sync groundwork; full audio mixer; Chippy (calm-teacher art); the sticker book (activity-only achievements, no streaks); delight motion; share a hand as text/image; phone-friendly capture page and Game night view.

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
Authoritative copy: [WORKFLOW.md](WORKFLOW.md). The full suite is a gate, not a habit; CI is the merge gate.

| Tier | For | Tests | Browser | Full suite | Beta smoke |
|---|---|---|---|---|---|
| T0 | docs, mechanical, read-only | the doc tests | none | no | no |
| T1 | fixes, small features | `node --check` + the ticket's TEST SET | 1 config (1920 EN Midnight); HE if layout/direction affected | no | no |
| T2 | redesigns, big features | TEST SET + CSS guard group if `styles.css` changed | mockup comparison: 1920+1366 EN, 1920 HE, one Daylight shot | only if shared harness, tokens or core paths changed | no |
| T3 | milestones, `main` | all (one full suite, `--test-concurrency=2`) | full matrix + browser smoke | yes | yes |

Rebase: TEST SET only. Merge into stabilization: CI. Flake fix: 20 runs alone + TEST SET. Never two suites at once.

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
- Google's Gemini 4 Argon (available to the owner in the Gemini app and Antigravity) is used for **independent second opinions** (maths and number checks, design critique, research, plan sanity checks), **one-off read-only whole-repo audits** in Antigravity, as a second reader for RU/HE wording and later legal drafts, and **as a batch implementer** in its own git worktree and branch (AGENT-POLICY-001, see [AGENTS.md › Multi-agent work](../AGENTS.md#roles)): one writer per folder, never the same folder as another agent, the owner merges after Manager review, and risk-tier work gets a cross-review by a different agent. This replaces the earlier "Claude Code stays the only writer on the repo" rule, which the multi-agent policy superseded.

### Tooling (R-13, owner's notes 2026-10-27)
No Claude Code add-ons are installed. RTK may come later, for git output only; anything else needs the owner's yes and a [THIRD_PARTY](THIRD_PARTY.md) row first.

### Acceptance
- Human acceptance is its own evidence; tests and commit titles cannot create it.
- If the owner reports only failures from a requested checklist, unmentioned checks pass unless later changes create regression risk.
- After ~2 same-cause rejected corrections, rethink the concept instead of patching again.
- Worker reports stay detailed: outcome, root causes, files (ticket vs pre-existing), exact verification incl. failures and reruns, limitations, debt with owners, Git status.

---

## 11. Rejected or out of scope (do not revive without the owner)
Arbitrary layout editors; Comfortable/Compact density toggle; Controls First; global Beginner/Expert switch; casino neon, confetti, fake 3D; numeric confidence percentages; templates as the primary plan-building path; a general free-form shorthand text-entry mode for hands (the defined short-notes capture syntax with labelled guesses is adopted, HAND-04/07, §7.5; free text stays only as a capture backup); tournament mode in Home Game; exact postflop ranges per node (current scope); LLM-based natural language; AGPL code inside the app (LT-02); grading heuristic disagreement as a mistake outside its confidence tier; mockup-replacement icons.

Added by the 2026-10-18 → 26 decisions: synthesized sounds, study cues included (P1-11); the "felt and flat" illustration style (P1-13); skill-based "you're good at poker" achievements (P1-20); buckets as a Personal Strategy answer method (PS-01); downloading or copying third-party charts, even for measurement (R-01); shipping GTO+ / Simple Postflop / PioSOLVER data or using TexasSolver (LT-06); tying sound to the Motion setting (round 3); the research "master synthesis" as a brief (it contradicts D-30 / D-32; three of its ideas are kept); phone-first screen design (P1-28).

## 11b. Owner decisions, 2026-10-10

Moved to the decision log: [Owner decisions, 2026-10-10](design/decisions/OWNER_DECISIONS.md#owner-decisions-2026-10-10-from-north_star-11b) (DOCS-RESET-002, 2026-10-31). Kept verbatim, with dates and reasons.

## 11c. Owner decisions after the market research review (2026-10-10)

Moved to the decision log: [After the market research review](design/decisions/OWNER_DECISIONS.md#owner-decisions-after-the-market-research-review-2026-10-10-from-north_star-11c) (DOCS-RESET-002, 2026-10-31). Kept verbatim, with dates and reasons.

## 12. Decisions that changed recently (read before trusting older docs)

Moved to the decision log: [Decisions that changed recently](design/decisions/OWNER_DECISIONS.md#decisions-that-changed-recently-from-north_star-12) (DOCS-RESET-002, 2026-10-31). Kept verbatim, with dates and reasons.

## 13. Open questions

Decided on 2026-10-18 → 26 and removed from this list (reasons in the logs): shell and sidebar (P1-01), My poker placement (P1-01), drill with or without a table (both modes; panels P1-05), Personal Strategy answer methods and hand groupings (PS-01 … PS-03), Equity layout (P1-30), the Learn mix (P1-30), the Hebrew mix bar (P1-30), the display typeface (Rubik, P1-30), open vs closed source as a blocker (LT-02: decided after the best tools' licences are known; treated as closed until then).

- **Whose turn at the table:** A (halo + timer) or C (quiet pill), possibly A in normal play and C in fast/quiet modes; needs further review (P1-10, P1-30).
- **Decision controls per mode:** both exist; which mode uses cards and which uses seat buttons is provisional (P1-04).
- **Card back details:** an "R" monogram in a special font, more like a real card back (P1-30); final art at the PC.
- **Kit text notes** (owner: none yet) and the **Equity PC visual bug list** (later).
- **Rust toolchain** for the solver pilot: yes or no (SOLVER-PILOT-001).
- **HRC Pro:** whether and when to buy (deferred by LT-07).
- **Tier vocabulary:** the worker proposes the exact source words for D-31; owner approves.
- Exact tolerances for "Verified" per spot type (worker proposes, owner approves); the owner's multiway 30–60 bb game may never be strictly Verified (R-01).
- **Game night:** the workspace name ("Game night" applied; the owner may revisit) and wording alternatives to "banker" / buy-in (owner may propose later); points-only wording for a store build, decided when a store release is planned (D-32).
- **Phone build approach:** dedicated layouts on the same web app vs a native app, decided by phone prototypes (MOB-02).
- **Solver packs later:** download on demand or bundled (M3).
- Pre-dependency versions of screens (an M1/M2 screen never relies on an M3 feature); Manager handles this when writing redesign tickets.
