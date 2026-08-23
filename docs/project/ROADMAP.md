# Riverline Roadmap

Last refreshed: August 23, 2026 (`ROADMAP-SYNC-003`).

This roadmap is directional, not a rigid waterfall. `CURRENT_PHASE.md` is the authoritative current checkpoint/resume map; `PRODUCT_BACKLOG.md` preserves detailed future capability; code, tests, accepted ticket reports, manual QA, and explicit product decisions override planning prose.

## Product north star

Riverline is becoming a **personal poker learning workstation** rather than a generic solver shell.

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

### Phase A — visible full-hand / table experience burst — ACTIVE NEXT

1. **`TABLE-PRESENCE-REF-001` — ACTIVE NEXT**
   - bounded competitive-reference/design pass;
   - GTO Wizard primary benchmark, DTO/PokerSnowie/APT secondary where useful;
   - ADOPT / ADAPT / DIFFERENTIATE / REJECT decisions;
   - implementation-grade design for adaptive HU/short-handed/6-max/full-ring table projection, action dock, hand timeline, completed-hand state, and post-hand review entry.

2. **`TABLE-PRESENCE-002` — PLANNED NEXT / FUN BUILD**
   - adaptive table geometry by player count;
   - stronger table scale/presence and seat hierarchy;
   - restrained felt/rail physicality;
   - improved card-seat integration;
   - dealer/button and contribution/pot chip presentation;
   - clearer legal-action dock and sizing hierarchy;
   - distinct live versus completed-hand composition;
   - first-pass timeline integration where canonical seams already support it.

3. **`FULL-HAND-REVIEW-001` — PLANNED NEXT if not fully absorbed by 002**
   - promote canonical hand timeline;
   - concise hand-complete state;
   - review/replay/repeat/save/next actions;
   - selected-reference identity and truthful limitations;
   - no fake EV or unsupported correctness.

4. **`AUDIO-MOTION-001` — PLANNED NEXT**
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

**The next "fun stuff" starts immediately after `TABLE-PRESENCE-REF-001`.** The reference ticket is intentionally short; `TABLE-PRESENCE-002` is the next substantial visible implementation.

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
