# Riverline Roadmap

Last refreshed: August 23, 2026 (`FULL-HAND-REVIEW-001` implementation checkpoint).

This roadmap is directional, not a rigid waterfall. `CURRENT_PHASE.md` is the authoritative current checkpoint/resume map; `PRODUCT_BACKLOG.md` preserves detailed future capability; code, tests, accepted ticket reports, manual QA, and explicit product decisions override planning prose.

## Product north star

Riverline is becoming a **personal poker learning workstation** rather than a generic solver shell.

Its established product foundation includes:

- canonical PokerState/action/evaluator/Equity authority and Scenario-versus-Hand separation;
- `DecisionContext v1`, one `StrategyProvider v1` / `StrategyResult v1`, and an honestly labelled deterministic heuristic fallback;
- canonical Training convergence and `PERF-001`;
- Personal Strategy foundation through `RANGE-TEACHER-001`, with independent review and provider/Training integration intentionally checkpointed;
- canonical Table Presence and Replay through `REPLAY-001C`, completed `TABLE-PRESENCE-REF-001`, and the accepted `TABLE-PRESENCE-002` premium adaptive table foundation: pure `table-presentation/v1`, deliberate 2–10 geometry, integrated Hero/action composition, legal sizing, live/completed/review projections, visible timeline, deterministic direct seek, restrained physicality, and EN/RU/HE/RTL/customization compatibility;
- Saved Hand/Spot domain and visible save/note/review workflows through `SAVED-OBJECTS-002`;
- `HOME-002A` account-aware My Riverline foundation and detached Saved Hand Replay reopening;
- reusable tutorial foundation and current-app coverage;
- `RANGE-CORE-001` canonical combo-level weighted range foundation;
- `ANALYSIS-RANGE-001` range-aware Analysis/structural outs checkpoint;
- one shared decision-by-decision completed-hand review workflow through `FULL-HAND-REVIEW-001`, with exact pre-action Replay frames, source-gated comparisons, truthful limitations, and exact Analyze/Save handoffs.

The long-term loop is:

```text
Play a hand
  -> review important decisions
  -> compare with a selected reference
  -> compare with Personal Strategy
  -> preserve notes / uncertainty / provenance
  -> save useful study objects
  -> re-drill mistakes and similar spots
  -> learn recurring patterns over time
  -> return to play with better context
```

Reference strategy, Personal Strategy, and observed behavior remain distinct semantic roles.

## Established foundation — COMPLETED / CHECKPOINTED
1. **COMPLETED — `TABLE-PRESENCE-REF-001`.** Competitive reference and implementation boundaries are accepted.
2. **COMPLETED — `TABLE-PRESENCE-002` accepted implementation checkpoint.** The premium adaptive table, Hero decision composition, canonical sizing tray, completed/review foundation, Replay timeline/direct seek, localization, 1,720/1,720 Node baseline, and bounded Firefox matrix are present. Remaining visual/browser sampling stays open in QA and the return queue.
3. **COMPLETED — `FULL-HAND-REVIEW-001` implementation checkpoint.** Hand and Full Hand Training converge on one derived review model and surface with exact pre-action Replay synchronization, truthful source semantics, Analyze/Save/Repeat/Next routing, responsive EN/RU/HE/RTL presentation, and focused automated coverage. Independent human Firefox acceptance remains routed through QA and the return queue.
4. **ACTIVE NEXT — `AUDIO-MOTION-001`.** Add restrained purposeful feedback after Full Hand Review, preserving reduced motion and the analytical no-casino aesthetic.
5. **PLANNED NEXT — `PREMIUM-CLOSEOUT-001`.** Close the bounded premium-product checkpoint after Audio/Motion without silently absorbing unrelated manual QA.
6. **PLANNED NEXT — trusted bounded reference pack/provider.** Validate a narrow reference source and declared capabilities behind `StrategyProvider`.
7. **PLANNED NEXT — Training Memory / re-drill.** Establish canonical persistent learning history and targeted review.
8. **PLANNED NEXT — Personal Strategy integration.** Connect existing evidence through approved provider/Training boundaries.
9. **PLANNED NEXT — `HOME-002B` Saved Study Library.** Expand Saved Study discovery and drilldowns over the existing repository.
10. **SHELVED FOR LATER — opponent policies/bots.** Keep automated opponents behind the higher-priority learning sequence.

Reassess after every accepted checkpoint; when priority or subsystem state changes, the authoritative roadmap/resume/backlog documents move together.

The project now has a materially stronger foundation than the August 17 roadmap reflected:

- canonical PokerState/action/legality/accounting/evaluator/Equity authority;
- Scenario-versus-Hand separation;
- one `DecisionContext` / `StrategyProvider` / `StrategyResult` path;
- global Node baseline + CI;
- Core Flow navigation and table-centered Hand workspace;
- premium card presentation, themes, density and layout systems;
- source authority / claim policy through `REFERENCE-AUTHORITY-001`;
- structural heuristic repair through `STRATEGY-REPAIR-001A/001B`;
- DecisionContext v1.1 live stack, current pot, legal sizing, position and bounded prior-action facts;
- exact preflop decision-role taxonomy through `PREFLOP-ROLE-001`;
- source-agnostic external benchmark tooling through `REFERENCE-BENCH-001`;
- first real GTOW-informed private benchmark round;
- first evidence-driven preflop representation/calibration through `PREFLOP-CALIBRATION-001`;
- Personal Strategy foundation through Matrix / Builder / Teacher automated checkpoints;
- canonical Table Presence / Replay / Saved Hand and Spot foundations;
- accounts/auth/sync foundations and My Riverline checkpoint;
- canonical range core and richer Analysis/Bluff facts;
- Home Game Organizer foundation.

The deterministic heuristic remains generalized comparative fallback, not solved GTO.

## Near-term priority sequence
- **Personal Strategy — CHECKPOINTED / INTENTIONALLY INCOMPLETE:** `002B`, `002C`, `002D`, Builder, and Teacher foundations are present; resume at independent review `002R`, then the ordered Personal Strategy integration ticket after Training Memory/re-drill.
- **Training intelligence — PLANNED NEXT:** after the trusted bounded reference pack/provider, add persistent mistakes, review/re-drill, adaptive/spaced study, expanded filters, saved drills, mastery, session summaries/trends, Home/Replay integration, and opt-in profile evidence.
- **Range tools — PRESERVED FUTURE:** canonical combo-level Range Builder, sparse Range Teacher/Profiler, range-vs-range tools, Compare Spots, and Saved Ranges.
- **Accounts/cloud/social — PRESERVED FUTURE after `ACCOUNT-001`:** authentication, offline-first sync/backup, cross-device user data, then approved sharing/forking/friends/study groups.
- **Product Lab — CHECKPOINTED / INTENTIONALLY INCOMPLETE:** layout presets, density, Premium Cards, built-in/custom themes, persistence, and the adaptive table foundation are present; remaining acceptance stays in QA/return queue, while expert workflow and deliberate mobile composition remain future.
- **Reference/model — PLANNED NEXT:** after Premium Closeout, validate a bounded reference pack/provider first; model/interpolation only afterward; production integration only behind `StrategyProvider`.
- **PLO, public release, and optional gamification — PRESERVED FUTURE / OPEN PRODUCT DECISION:** separate game domain, deliberate packaging/mobile/privacy work, and restrained study mechanics only if approved.

## Premium presentation branch

The premium adaptive table, dealer/chip physicality, Hero action dock, projection foundation, and completed-hand review workflow are completed by `TABLE-PRESENCE-002` and `FULL-HAND-REVIEW-001`. `AUDIO-MOTION-001` is active next and must remain restrained and reduced-motion-safe. Physical card trajectories, stack-to-bet and pot-collection animation, detailed denominations, fake 3D table treatment, elaborate showdown/reveal motion, and ambience remain **SHELVED FOR LATER** unless a later bounded ticket explicitly approves them.

### Phase A — visible full-hand / table experience burst

1. **`TABLE-PRESENCE-REF-001` — COMPLETED**
   - bounded competitive-reference/design pass;
   - GTO Wizard primary benchmark, DTO/PokerSnowie/APT secondary where useful;
   - ADOPT / ADAPT / DIFFERENTIATE / REJECT decisions;
   - implementation-grade design for adaptive HU/short-handed/6-max/full-ring table projection, action dock, hand timeline, completed-hand state, and post-hand review entry.

2. **`TABLE-PRESENCE-002` — COMPLETED IMPLEMENTATION CHECKPOINT**
   - adaptive table geometry by player count;
   - stronger table scale/presence and seat hierarchy;
   - restrained felt/rail physicality;
   - improved card-seat integration;
   - dealer/button and contribution/pot chip presentation;
   - clearer legal-action dock and sizing hierarchy;
   - distinct live versus completed-hand composition;
   - first-pass timeline integration where canonical seams already support it.

3. **`FULL-HAND-REVIEW-001` — COMPLETED IMPLEMENTATION CHECKPOINT**
   - promote canonical hand timeline;
   - concise hand-complete state;
   - review/replay/repeat/save/next actions;
   - selected-reference identity and truthful limitations;
   - no fake EV or unsupported correctness.

4. **`AUDIO-MOTION-001` — ACTIVE NEXT**
   - semantic poker-world event layer versus application-motion layer;
   - restrained card/chip/action/street cues;
   - actor/street/hand-complete motion;
   - reduced-motion and sound-off guarantees;
   - no casino celebration effects.

5. **`PREMIUM-CLOSEOUT-001` — PLANNED NEXT**
   - whole-app hierarchy/panel/chrome review;
   - Hand → Review → Analyze → Save → Training/Personal Strategy continuity;
   - desktop responsive acceptance at 1920×1080, 2560×1440, 2560×1600, 4K;
   - EN/RU/HE + RTL + themes/density/cards;
   - resolve high-value remaining UI QA instead of introducing more customization systems.

The table/reference/review sequence is checkpointed. Remaining independent visual acceptance stays in QA and the return queue; it is not silently treated as closed.

### Phase B — trusted reference strategy

6. **`REFERENCE-PACK-ARCH-001` / first bounded reference problem**
   - choose one exact, reproducible preflop family;
   - define validation, assumptions, sizing tree, rake/rules, licensing and versioning;
   - likely start with a compact HU or tightly bounded heads-up preflop family rather than claiming general 6-max coverage.

7. **First validated production reference provider**
   - exact context coverage only;
   - fallback to heuristic outside coverage;
   - stronger claims only where source capabilities authorize them;
   - benchmark against external legitimate references without copying proprietary databases.

8. **Preflop expansion / quality program**
   - widen reference coverage only after measurable validation;
   - use REFERENCE-BENCH to diagnose role/range-composition errors;
   - no broad heuristic retuning by intuition.

### Phase C — Training becomes a persistent learning system

9. **`TRAINING-MEMORY-001`**
   - canonical DecisionRecord / session history;
   - persistent mistake/review queue;
   - no fake accuracy or mastery when source authority is comparative only.

10. **`TRAINING-REDRILL-001`**
    - same-spot and similar-spot re-drilling;
    - spaced/adaptive review;
    - filters and saved drill presets;
    - mistake clusters / leak views;
    - session summaries and trends based on canonical history.

11. **Home/Replay integration**
    - Review Mistakes / Continue / recent sessions;
    - persistent study memory feeds Home only after canonical persistence exists.

### Phase D — Personal Strategy integration

12. **`PERSONAL-STRATEGY-002R` review + visual acceptance**
    - independent review of Calibration/Matrix/Builder/Teacher;
    - preserve one evidence authority.

13. **Personal Strategy provider/comparison adapter**
    - intended strategy remains distinct from selected reference and observed behavior;
    - dominant-only evidence never becomes fake 100% frequency;
    - profile/mode context remains recognizable and user-named.

14. **Training evidence opt-in + observed play**
    - per-session opt-in;
    - contradictions preserved;
    - compare intended versus observed without silently rewriting intended strategy.

### Phase E — Saved/Home becomes the knowledge workspace

15. **`HOME-002B` / Saved Study Library**
    - dense master-detail library;
    - Hands / Spots / Ranges / Drills / Reviews / Sessions as approved payloads arrive;
    - search/filter/tags;
    - compact selected-object inspector and explicit Study/Open actions.

16. **Saved Range / Drill / Session payloads**
    - versioned objects;
    - revision/history semantics;
    - account ownership and sharing only after approved privacy/versioning boundaries.

### Phase F — opponent policies / bots / full-hand learning

17. **`OPPONENT-POLICY-ARCH-001`**
    - separate opponent behavior contract;
    - no solver/reference conflation;
    - generic archetypes, environment-specific policies, custom opponent models, and Personal Strategy-as-opponent are separate provenance roles.

18. **Full-hand bot training**
    - complete legal hands against opponent policies;
    - post-hand decision review;
    - selected-reference + Personal Strategy comparison;
    - save/re-drill continuity.

19. **Opponent learning / environment models later**
    - Calling Station / Nit / Maniac are only starting archetypes;
    - future examples: ClubGG Freeroll Player, Home Game Alex, user-defined policies;
    - never imply a bot is a real person's accurate model without evidence/consent.

## Parallel maintenance / release gates

These remain important but should not displace the active phase unless they become blockers:

- live Supabase migrations/RLS and two-profile browser acceptance;
- secure username/password adapter (`ACCOUNT-002A2`) if username login is still desired before release;
- Home Game Organizer `001B` management hardening;
- targeted `logic.js` decomposition behind stable seams when touched for real work;
- Firefox/manual QA debt consolidation;
- packaging/installer/hosting/privacy/legal before public release.

## Preserved future branches

- richer range-vs-range Analysis, blocker/value/bluff composition, Compare Spots;
- Saved Ranges / Drills / Sessions and sharing/forking;
- deliberate mobile product, not compressed desktop;
- social/friends/study groups only after account/privacy/versioning maturity;
- optional restrained gamification after explicit decision;
- PLO as a separate game domain;
- model/interpolation only after trustworthy datasets show clear value;
- public release and telemetry only after product-quality/privacy decisions.

## Competitive Reference Gate

Every substantial user-facing or strategy feature should begin with bounded study of the strongest relevant products/references when it can materially improve the design.

Use:

- ADOPT
- ADAPT
- DIFFERENTIATE
- REJECT

Competitor behavior is design/reference evidence, not authority. Never copy proprietary charts, solver databases, branding, text, or assets.

## Priority principle

Alternate visible product progress with intelligence/foundation work.

Do not allow:

- audits to replace the roadmap;
- strategy infrastructure to become endless;
- premium polish to become endless;
- a single competitor to define Riverline;
- preserved future ideas to sneak into active tickets without explicit scope.

Reassess after every clean checkpoint.

The current explicit priority is: restrained Audio/Motion, then Premium Closeout; afterward come a trusted bounded reference pack/provider, Training Memory/re-drill, Personal Strategy integration, `HOME-002B`, and only later opponent policies/bots. Detailed accepted ideas remain in `PRODUCT_BACKLOG.md` and must not depend on chat memory. This roadmap is not a parallel status system: accepted checkpoint changes must be reflected here, in `CURRENT_PHASE.md`, and in the dynamic backlog together.
