# Riverline Project Charter

Last refreshed: August 23, 2026 (`ROADMAP-SYNC-003`).

## 1. Product

Riverline is a browser-first Texas Hold'em analysis, training, and personal-study application for personal use, friends, and a possible future public release.

The north star is not "a smaller GTO Wizard" and not "a homemade solver UI". Riverline should become a **personal poker learning workstation** that connects:

- playing complete hands;
- trustworthy selected references where available;
- transparent generalized fallback strategy elsewhere;
- post-hand review and replay;
- deliberate Analysis and Matrix/range work;
- Personal Strategy: what the user intends to play;
- observed behavior: what the user actually did;
- opponent policies / recognizable player archetypes;
- persistent Saved/Training study memory;
- targeted re-drilling and long-term learning.

Primary current product areas include:

- canonical Hand / full-hand play;
- Scenario / Analyze;
- Training;
- Personal Strategy / Range Calibration / Matrix / Builder / Teacher;
- Equity / win probability;
- Saved Study and My Riverline;
- Guide and Settings;
- Home Game Organizer as a separate domain;
- thin Electron desktop wrapper.

The product should feel like a serious, coherent analytical poker workstation. Premium means calm, fast, deliberate, readable, and state-aware, not visually excessive or casino-like.

## 2. Product experience principle

Riverline should be **selectively dense** rather than always dense.

The current job owns the hierarchy:

- **Playing:** table, actor, legal decision, pot/stack/card state dominate.
- **Post-hand review:** hand timeline, important decisions, learning actions dominate.
- **Analyze:** ranges, explanation, evidence, provenance, and comparisons dominate.
- **Saved inspection:** dense library plus compact selected-object preview.
- **Calibration/Builder:** strategy evidence and editing dominate.

Do not force one compromise composition to serve every state.

## 3. Strategy scope and truthfulness

Riverline does not currently solve full 2–10-player Hold'em to exact equilibrium.

Current production strategy is a deterministic generalized heuristic fallback behind versioned contracts. It has mathematical-integrity, role, calibration, authority, and benchmarking infrastructure, but no validated general Hold'em strategy reference.

Current priorities:

- preflop receives the highest strategy-accuracy effort;
- postflop remains a transparent approximation until stronger data exists;
- multiway support must distinguish correct Equity from approximate strategy;
- no GTO, CFR, Nash, exploitability, EV-loss, model-accuracy, or optimality claim without reproducible evidence and an authorized source capability.

The production strategy path is:

`DecisionContext` → `StrategyProvider` → `StrategyResult` → `StrategyClaimPolicy`.

A source's identity does not grant authority. Coverage, validation, provenance, and declared capabilities determine what Riverline may claim.

## 4. Reference and competitive-learning rule

Riverline should learn aggressively from strong poker products and public/legitimate poker references.

For every substantial user-facing or strategy capability, perform a bounded **Competitive Reference Gate** before material implementation when it can improve the decision.

The gate should identify relevant products/references and record:

- **ADOPT** — mature patterns worth using substantially as-is;
- **ADAPT** — good patterns that need Riverline-specific treatment;
- **DIFFERENTIATE** — opportunities Riverline should push beyond competitors;
- **REJECT** — patterns that do not fit Riverline.

GTO Wizard is the default high-end benchmark for many solver/training/matrix/full-hand UX questions, with DTO, PokerSnowie, Advanced Poker Training, and specialized tools used where relevant.

Competitor/reference behavior is evidence, not authority. Do not copy proprietary charts, solver matrices, branding, text, visual assets, or reconstruct paid databases. Manual observations may be used as private research benchmarks with explicit context/provenance and must remain separate from production reference packs.

## 5. Supported study environments

- 2–10 seated players where the workspace supports it;
- current exposed strategy/training stack controls: 10–500bb;
- Home: no rake or forced deduction;
- ClubGG-style: exactly 0.1bb per seated player once per hand, outside the contestable pot where that mode is supported;
- no generic percentage/capped-rake product assumption unless explicitly introduced through a new rules/reference decision.

Accuracy is not uniform across configurations. Configuration support is not a solver-accuracy claim.

## 6. Runtime

- Vanilla JavaScript/CSS frontend;
- browser runtime works without Python;
- Electron is a thin host for the same application;
- no production model loader, ONNX runtime, remote strategy API, or arbitrary solver-tree upload;
- future reference/model providers enter only through validated, versioned provider contracts;
- solver/model/data experiments stay isolated from production runtime.

## 7. Engineering principles

- correctness and truthfulness before convenience;
- one canonical authority per concept;
- small, reviewable, reversible tickets;
- behavior and mathematical-invariant tests;
- no unrelated cleanup during scoped work;
- no UI-implemented poker mathematics;
- explicit provenance and limitations;
- Scenario remains a lossy snapshot; Hand remains canonical history;
- structural tests do not replace human visual acceptance;
- Git history is the archive; obsolete runtime paths are removed rather than kept as misleading legacy;
- user-facing complexity should be progressively disclosed;
- visible premium work and strategy quality should alternate deliberately so the project does not become an endless infrastructure program.

## 8. Current development priority

The immediate strategy-integrity burst is complete through `PREFLOP-CALIBRATION-001`.

The next priority is a **visible full-hand/table experience burst**:

1. competitive-reference/design brief for Table Presence;
2. adaptive Table Presence / Full-Hand implementation;
3. post-hand/timeline closeout where not already covered;
4. restrained audio/motion event architecture and first implementation;
5. whole-app premium/Core Flow closeout.

After that visible burst, return to **trusted bounded reference strategy**, then persistent Training learning, Personal Strategy integration, and Saved/Home study continuity.

Accounts/live sync hardening, Home Game Organizer follow-up, and architecture decomposition remain important but must not displace the active product sequence unless they become a release/security blocker.

## 9. Overall long-term scope

Riverline's long-term product branches are:

1. **Full-hand play and post-hand learning** — state-aware table, timeline, replay, review, similar-spot actions.
2. **Strategy/reference quality** — bounded validated reference packs, solver-owned data, later model/interpolation only if evidence justifies it.
3. **Training intelligence** — persistent mistakes, re-drilling, spaced/adaptive review, filters, sessions, progress, Home integration.
4. **Personal Strategy** — intended strategy, sparse evidence, three contextual modes, reference comparison, observed-play comparison.
5. **Opponent policies / bots** — archetypes, environment-specific opponents, custom opponent models, eventually full-hand practice against them.
6. **Saved Study / Home** — hands, spots, ranges, drills, reviews, sessions, searchable master-detail knowledge workspace.
7. **Analysis and range tools** — combo-aware range-vs-range work, blockers, value/bluff composition, Compare Spots, richer postflop propagation.
8. **Accounts/sync/sharing** — local-first identity and opt-in sync first; sharing/social only after privacy/versioning foundations.
9. **Home Game Organizer** — separate accounting/session domain, not StrategyProfile or PokerState.
10. **Platform/release** — desktop/web packaging, offline/cache, privacy/legal, observability as approved, deliberate mobile later.
11. **Future game domains** — PLO only as a separate domain with its own evaluation/ranges/reference pipeline.

## 10. Budget

Optional compute/services should stay within approximately US$75 total unless explicitly changed.

Every paid experiment requires:

- maximum spend;
- maximum runtime;
- reproducible configuration;
- artifact path;
- success criteria;
- stop criteria.

Public deployment is not the immediate focus. Product quality and trustworthy learning behavior come first.
