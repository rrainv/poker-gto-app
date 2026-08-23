# Riverline Product and Feature Backlog

Last consolidated: August 23, 2026 (`ROADMAP-SYNC-003`, current through `PREFLOP-CALIBRATION-001`).

This file preserves accepted future capability so it does not depend on chat memory and is not implemented opportunistically. `CURRENT_PHASE.md` is the authoritative checkpoint/resume map and delivery order; subsystem specifications own implementation semantics.

## Status vocabulary

- **COMPLETED**
- **CHECKPOINTED / INTENTIONALLY INCOMPLETE**
- **ACTIVE NEXT**
- **PLANNED NEXT**
- **PRESERVED FUTURE**
- **SHELVED FOR LATER**
- **OPEN PRODUCT DECISION**

## Product north star

Riverline should become a personal poker learning workstation that connects:

```text
Full-hand play
  -> post-hand review
  -> selected-reference comparison
  -> Personal Strategy comparison
  -> Saved study object
  -> targeted / spaced re-drill
  -> recurring-pattern learning
  -> improved future play
```

Reference strategy, intended Personal Strategy, and observed behavior remain distinct semantic roles.

## Permanent product rules

1. **Truthful strategy claims.** No GTO/Nash/EV/exploitability/optimality claim without source capability and exact enough coverage.
2. **One authority per concept.** UI consumes canonical facts; it does not invent poker math.
3. **Local-first.** Cloud/sync is opt-in and cannot become a prerequisite for core study.
4. **State-aware UI.** Playing, reviewing, analyzing, and browsing Saved objects may project the same Hand differently.
5. **Competitive Reference Gate.** Substantial user-facing or strategy work should study relevant strong products/references first and record ADOPT / ADAPT / DIFFERENTIATE / REJECT.
6. **Competitors are evidence, not authority.** No copying proprietary strategy data, paid solver matrices, text, branding, or visual assets.
7. **Alternate visible progress with foundation work.** Do not let strategy infrastructure or UI polish become endless.
8. **Preserved capability is not active scope.** Pull forward only through an explicit bounded ticket.

## Current delivery ordering

| Order | Status | Ticket / outcome |
|---:|---|---|
| 1 | COMPLETED | Global Node baseline + minimal Node 24 CI |
| 2 | COMPLETED | Core Flow / coherent navigation / table-centered Hand workspace |
| 3 | COMPLETED | Premium workspace composition, density, layout presets, themes/custom themes, Premium Card System v1 |
| 4 | COMPLETED | `REFERENCE-AUTHORITY-001` — source descriptors, coverage/capability, one claim policy |
| 5 | COMPLETED | `STRATEGY-REPAIR-001A` — table-family preflop repair, causal postflop RNG, missing-price honesty, quality corpus |
| 6 | COMPLETED | `DECISION-CONTEXT-001A` — live stacks, current pot, effective stack, position relation, legal sizing, action summary, provenance |
| 7 | COMPLETED | `STRATEGY-REPAIR-001B` — live-fact consumption, role-family structure, exact-price response, legality, bounded position/SPR effects |
| 8 | COMPLETED | `REFERENCE-BENCH-001` — source-agnostic private/manual external benchmarking harness |
| 9 | COMPLETED | `PREFLOP-ROLE-001` — exact preflop decision-role semantics and honest fallback mapping |
| 10 | COMPLETED | `PREFLOP-CALIBRATION-001` — richer BB-vs-BTN hand representation / structural cold-response policy |
| 11 | ACTIVE NEXT | `TABLE-PRESENCE-REF-001` — competitor/reference design brief for the next full-hand/table experience |
| 12 | PLANNED NEXT | `TABLE-PRESENCE-002` — adaptive table geometry, stronger table presence, seat/chip/card hierarchy, decision dock, live/completed states |
| 13 | PLANNED NEXT | `FULL-HAND-REVIEW-001` if needed after 002 — timeline and concise post-hand learning entry |
| 14 | PLANNED NEXT | `AUDIO-MOTION-001` — semantic poker-world sounds/motion + reduced-motion-safe application motion |
| 15 | PLANNED NEXT | `PREMIUM-CLOSEOUT-001` — whole-app Core Flow/premium/desktop/i18n closeout |
| 16 | PLANNED NEXT | first bounded trusted reference-pack architecture + validated provider |
| 17 | PLANNED NEXT | Training Memory / re-drill intelligence |
| 18 | PLANNED NEXT | Personal Strategy integration into reference/review/Training |
| 19 | PLANNED NEXT | Home/Saved Study Library knowledge workspace |
| 20 | PRESERVED FUTURE | Opponent policies / bots / environment models / full-hand bot learning |

The next substantial visible implementation is **`TABLE-PRESENCE-002`**, immediately after the short reference/design ticket.

## Strategy / reference / benchmark program

| Capability | Status | Preserved scope |
|---|---|---|
| `REFERENCE-AUTHORITY-001` | COMPLETED | Source identity/provenance/authority/coverage/capabilities separated; one application claim policy; heuristic cannot authorize GTO, exact frequency, EV-loss or objective correctness |
| `STRATEGY-REPAIR-001A` | COMPLETED | Structural preflop table-family repair, causal sampling seed, missing-price abstention, unreachable shove cleanup, permanent calibration corpus |
| `DECISION-CONTEXT-001A` | COMPLETED | Additive v1.1 live/current stack, unclamped current pot, per-opponent/effective stack, IP/OOP/mixed, legal raise/all-in bounds, bounded action summary, derivation quality |
| `STRATEGY-REPAIR-001B` | COMPLETED | Heuristic consumes live SPR, legal actions, price, bounded position/history; response families structurally separated; generalized authority retained |
| `REFERENCE-BENCH-001` | COMPLETED | Local/manual/public/licensed/solver observation schema, context gate, raw + normalized actions, TVD/bias/equity diagnosis, CLI; no production dependency |
| `PREFLOP-ROLE-001` | COMPLETED | Distinguishes unopened, isolation, BB option, cold response, blind-vs-blind, opened-facing-3bet, cold-4bet opportunity, opener-facing-cold-4bet, limper-facing-isolation, etc. |
| `PREFLOP-CALIBRATION-001` | COMPLETED | Confirms legacy single-scalar limitation; adds reusable structural hand features and role-specific `continueValue` / `passiveRealization` / `aggressionSuitability` policy for bounded BB-vs-BTN region; v4 remains generalized |
| first trusted reference pack | PLANNED NEXT after visible burst | Exact bounded assumptions, versioning, validation, legal/licensing review, context coverage; likely compact HU or tightly controlled preflop family first |
| validated reference provider | PLANNED NEXT | Exact covered contexts gain stronger capabilities; fallback elsewhere; no source-ID UI branching |
| broader preflop reference expansion | PRESERVED FUTURE | Expand only with measurable validation across stack/sizing/rake/position families |
| postflop reference quality | PRESERVED FUTURE | Board/range/action/SPR/position reference families after preflop path proves itself |
| learned model/interpolation | PRESERVED FUTURE | Only after trustworthy datasets show a measurable win; never train on heuristic labels and call it GTO |
| benchmark UI | PRESERVED FUTURE | Internal/research visualization of discrepancies only if CLI becomes a bottleneck; not user-facing priority |

### Known strategy limitations to preserve honestly

- current heuristic remains approximate and generalized;
- postflop opponent-range construction remains coarse;
- strong made-hand aggression saturation still needs trusted evidence;
- exact preflop/postflop sizing strategy is not generally supported;
- generic percentage rake is not a normal production rules assumption;
- multiway equilibrium is not solved;
- benchmark observations from paid products remain private research evidence, not production data.

## Full-hand / table / replay / post-hand experience

| Capability | Status | Preserved scope |
|---|---|---|
| canonical Table Presence / Replay foundation | COMPLETED | Canonical seats/state, read-only action/chance timeline, deterministic step projection, current-street contributions, contribution-to-pot transitions, poker-chip primitive, reduced-motion-safe motion |
| `TABLE-PRESENCE-REF-001` | ACTIVE NEXT | Research GTO Wizard primarily plus DTO/PokerSnowie/APT where useful; ADOPT/ADAPT/DIFFERENTIATE/REJECT; implementation-grade geometry/hierarchy/action-dock/timeline/post-hand brief |
| `TABLE-PRESENCE-002` | PLANNED NEXT | Purpose-built HU / 3–4 / 6-max / 9–10-max geometries; table scale; restrained felt/rail; Hero/current-opponent hierarchy; dealer marker; chip/contribution/pot visuals; card-seat integration; action dock; live/completed distinction |
| `FULL-HAND-REVIEW-001` | PLANNED NEXT if needed | Visual canonical timeline; concise completed-hand summary; Review/Replay/Repeat/Save/Next; source identity and truthful limitations; important-decision markers through existing seams |
| richer dealing/chip trajectories | PRESERVED FUTURE | Physical deal paths, stack-to-bet, pot collection, showdown/reveal; only if restrained and reduced-motion-safe |
| deeper table depth/3D | PRESERVED FUTURE | Analytical physicality, not casino realism; validate against clarity/performance before expanding |
| dealer/avatar richness | PRESERVED FUTURE | Only after table hierarchy works without it |

### State projections

- **Play:** large table + current decision.
- **Post-hand review:** medium table + timeline/learning decisions.
- **Analyze:** supporting table + ranges/explanations/evidence.
- **Saved inspector:** compact table preview in master-detail library.

The same canonical Hand/state should feed all projections.

## Audio and motion

| Capability | Status | Preserved scope |
|---|---|---|
| existing basic sound/reduced-motion support | CHECKPOINTED | Existing cues remain; subjective Firefox audibility acceptance still tracked |
| `AUDIO-MOTION-001` | PLANNED NEXT | Separate poker-world events from app-navigation motion; card/chip/action/street/hand-complete semantic cues; independent controls; reduced-motion; restrained timing |
| richer ambience | PRESERVED FUTURE | Optional and subtle; no casino noise, celebration loops, or engagement manipulation |

## Training intelligence

| Capability | Status | Preserved scope |
|---|---|---|
| canonical deterministic Training base | COMPLETED | Legal canonical trajectories, StrategyProvider resolution, seeded replay, grading/presentation authority |
| persistent DecisionRecord / mistake history | PLANNED NEXT after reference phase | Canonical history of what was shown/answered/source/version/context, compatible with source authority |
| Review Mistakes | PLANNED NEXT | Dedicated queue and filters; no fake objective mistake if source is merely comparative |
| same-spot re-drill | PLANNED NEXT | Reproduce exact durable decision where possible |
| similar-spot re-drill | PLANNED NEXT | Versioned similarity dimensions; no arbitrary opaque matching |
| spaced/adaptive review | PLANNED NEXT | Review scheduling based on durable records and source semantics |
| expanded filters / saved drill presets | PLANNED NEXT | Position/role/stack/street/action/source/profile filters |
| session summaries / performance trends | PLANNED NEXT | Derived from canonical records; distinguish reference alignment from objective accuracy |
| Concept Mastery | PRESERVED FUTURE | Only after concept taxonomy and history prove useful; no fake mastery score |
| Home/Replay integration | PLANNED NEXT | Continue/review/re-drill from My Riverline and Hand review |
| profile-aware Training | PRESERVED FUTURE | Selected Personal Strategy/environment context where semantically valid |
| Training evidence -> Personal Strategy | PRESERVED FUTURE | Explicit per-session opt-in; immutable provenance; cannot silently overwrite direct intended strategy |

## Personal Strategy / Range Intelligence

| Capability | Status | Preserved scope |
|---|---|---|
| Calibration through 002C | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Adaptive questions, direct evidence, exact optional mixes, contradictions, uncertainty, stopping, sparse inference |
| Matrix 002D | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Shared 169-estimate snapshot with truthful statuses and evidence inspector; Firefox visual acceptance remains |
| Range Builder | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Grouped direct editing/paint/exact mix/undo over same evidence authority; visual acceptance remains |
| Range Teacher | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Boundary/sparsity/conflict/exact-mix recommendations and focused Calibration routing; visual acceptance remains |
| `002R` independent review | PLANNED NEXT after Training/reference burst | Validate unified system with real user behavior; no new inference machinery before this review |
| StrategyProvider adapter | PLANNED NEXT later | Personal Strategy has personal/intended authority, not objective normative truth |
| selected reference vs intended vs observed | PLANNED NEXT later | Three explicit semantic roles in review/analysis/training |
| mode relationships/interpolation | PRESERVED FUTURE | Only evidence-backed relationships; do not force Tight/Baseline/Loose axis |
| postflop Personal Strategy | PRESERVED FUTURE | Separate evidence/model work; no naïve preflop extension |
| combo overrides | PRESERVED FUTURE | Sparse exact combo overrides over class baseline if use cases justify it |
| richer Teacher history/conflict resolution | PRESERVED FUTURE | Writable conflict tools only through canonical evidence semantics |

Profiles remain recognizable poker environments/identities, with exactly three user-named modes. Quick answers mean dominant/preferred action, never implicit 100% frequency.

## Range / Matrix / Analysis tools

| Capability | Status | Preserved scope |
|---|---|---|
| `RANGE-CORE-001` | COMPLETED | 52 cards -> 1,326 unordered combos -> HoldemWeightedRange v1 -> derived Matrix; unknown != zero |
| `ANALYSIS-RANGE-001` | CHECKPOINTED | Made/draw/board/blocker/supplied-range structural facts; no invented range/nut advantage or EV |
| `BLUFF-001` | CHECKPOINTED | Risk/reward, BE folds, semibluff/outs, neutral removal, simplified heads-up river reference; no inferred opponent fold frequency or strategic blocker verdict without authority |
| Matrix current presentation | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Dominant-action tint + mix band + selected-hand inspector; postflop unavailable-state and long-page QA remain |
| Matrix premium redesign | PRESERVED FUTURE | Learn from GTOW/DTO: dense cells, action color, secondary metrics where source supports them, whole-node totals, selected-hand details; no fake EV heatmap |
| weighted Hero vs Villain ranges | PRESERVED FUTURE | Legitimate weighted range-vs-range Equity/analysis through approved contract |
| action-conditioned ranges | PRESERVED FUTURE | Valid only from known prior inclusion range + exact action frequencies |
| richer blocker/unblocker | PRESERVED FUTURE | Needs trustworthy continuing/value/bluff partitions |
| Compare Spots | PRESERVED FUTURE | Position/stack/pot/price/board/blockers/opponents/range/profile comparison with supported explanations only |
| Saved Ranges | PRESERVED FUTURE | Versioned SavedStudyObject payload, compare/export/import, later sharing |

## Saved Study / Home knowledge workspace

| Capability | Status | Preserved scope |
|---|---|---|
| Saved Hand / Spot | COMPLETED | Versioned local-first objects, annotations/tags/review/mistake metadata, archive, canonical Replay source |
| My Riverline `HOME-002A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Guest/account composition, truthful Continue, bounded Saved/Review/Mistakes, Personal Strategy facts, sync state; Firefox acceptance remains |
| `HOME-002B` Saved Study Library | PLANNED NEXT after Training persistence | Dense master-detail library; search/filter/tags; selected-object inspector; explicit Study/Open; Hands/Spots first, other types as payloads arrive |
| Saved Range | PRESERVED FUTURE | Versioned payload + ownership/versioning |
| Saved Drill | PRESERVED FUTURE | Drill definition + source/version/context |
| Saved Session / Review | PRESERVED FUTURE | Training/session review payloads |
| revisions/history | PRESERVED FUTURE | Preserve ownership/version/conflict semantics |
| folders/collections | OPEN PRODUCT DECISION | Only if real usage justifies them |
| sharing/forking | PRESERVED FUTURE | After account/privacy/versioning maturity |

Home remains a consumer of user domains, never their owner. Do not invent analytics merely to make Home busy.

## Opponent policies / bots / environment learning

| Capability | Status | Preserved scope |
|---|---|---|
| `OPPONENT-POLICY-ARCH-001` | PRESERVED FUTURE, high strategic value | Versioned opponent-behavior contract separate from StrategyProvider/reference authority |
| generic archetypes | PRESERVED FUTURE | Calling Station, Nit, TAG, Maniac etc. as transparent policies, not difficulty labels |
| environment archetypes | PRESERVED FUTURE | e.g. loose ClubGG freeroll environment; explicit provenance/assumptions |
| custom opponent policies | PRESERVED FUTURE | User-defined opponent identity/behavior within privacy/safety boundaries |
| Personal Strategy as opponent | PRESERVED FUTURE | Practice against one of user's intended modes without conflating it with a real opponent |
| full-hand bot Training | PRESERVED FUTURE | Complete legal hand, record Hero decisions, post-hand review, selected reference, Personal Strategy comparison, save/re-drill |
| observed opponent learning | PRESERVED FUTURE | Only with sufficient user-supplied evidence; uncertainty explicit; no false claims about real people |

Competition research should study GTO Wizard Profiles/Full Hand Drills and Advanced Poker Training heavily when this branch activates.

## Account, sync, privacy, social

| Capability | Status | Preserved scope |
|---|---|---|
| `ACCOUNT-001` + `002A/AR` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Persistent identity, Supabase email/password auth/profile, Guest semantics, claim/start-separate, switching/sign-out, durable-feature gate |
| `ACCOUNT-002A2` username/password adapter | PLANNED NEXT only if still desired before release | Rate-limited trusted server/Edge Function username resolution; enumeration-resistant; no client secret/public directory |
| Saved sync `002B-A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Local-first outbox/retry, RLS/RPC, tombstones, conflict UX; live migration/two-browser acceptance open |
| Personal Strategy sync `002B-B` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Separate consent, relational evidence/session sync, contradictions preserved; live migration/two-browser acceptance open |
| cross-device preferences | PRESERVED FUTURE | After core sync stability |
| account deletion/local forgetting/recovery | PRESERVED FUTURE | Explicit lifecycle/privacy tickets |
| sharing/social | PRESERVED FUTURE | Friends/study groups/comments/range sharing only after privacy/versioning; no opportunistic social layer |

Riverline remains useful offline and local-first.

## Home Game Organizer

This is a separate top-level tab/domain, not `PokerState`, StrategyProfile, Saved Study, or Personal Strategy.

| Ticket | Status | Scope |
|---|---|---|
| `HOME-GAME-001A` | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Players/groups/sessions, exact minor-unit ledger, append-only corrections, chip snapshots, lifecycle, balance rejection, deterministic settlement, account-scoped persistence, Guest memory, bounded EN/RU/HE workspace |
| `HOME-GAME-001B` | PLANNED NEXT when branch resumes | Player reuse/edit/archive, visible correction history, session archive/delete confirmation, group/session management polish, Firefox acceptance, import/export decision |
| richer organizer tools | PRESERVED FUTURE | blind timer/button advance, richer chip tools, player history, recurring games, payment links, tournament mode only behind separate accounting semantics |
| live/mobile sharing | PRESERVED FUTURE | much later |

## Product Lab / customization

| Capability | Status | Preserved scope |
|---|---|---|
| layout presets | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Balanced/Table Focus/Analysis Focus/Controls First; freeze expansion |
| density | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Comfortable/Compact; freeze variants and finish acceptance |
| themes | CHECKPOINTED / INTENTIONALLY INCOMPLETE | Midnight/Daylight/Graphite + named local custom themes and exact semantic overrides; freeze expansion |
| card presentation | COMPLETED / visual acceptance tracked | Classic/Minimal/High Contrast, Riverline/Solid/Geometric backs, 2/4-color suit modes, T/10 behavior |
| beginner/expert presentation | PRESERVED FUTURE | Guided versus denser provenance/keyboard workflow after core surfaces stabilize |
| expert keyboard workflow | PRESERVED FUTURE | Deliberate shortcuts for study speed |
| export/import themes/preferences | PRESERVED FUTURE | Only if useful |
| arbitrary layout editor | REMOVED / REJECTED | Do not revive |

## Localization, accessibility, responsive, mobile

- EN/RU/HE remain first-class current locales.
- Hebrew RTL uses logical CSS with poker-data LTR islands where appropriate.
- Firefox is primary browser acceptance target.
- Desktop targets include 1920×1080, 2560×1440, 2560×1600 and 4K; 1024/1366 remain important constrained-desktop checks where applicable.
- Reduced motion is mandatory.
- Mobile is a separate future composition, not stacked desktop.
- Every meaningful visible feature owns its tutorial/i18n/accessibility update.

## Release / platform / operations

| Capability | Status | Preserved scope |
|---|---|---|
| browser dev/runtime | COMPLETED foundation | dependency-free Node dev server; no Python needed |
| Electron | thin-host foundation | Same app; no strategy IPC/model runtime |
| CI | COMPLETED baseline | Node 24 syntax + full Node suite |
| targeted architecture decomposition | PRESERVED MAINTENANCE | Extract `logic.js` seams when touched by real tickets; no rewrite program |
| live Supabase verification | PLANNED maintenance/release gate | Apply migrations, RLS, multi-profile Firefox lifecycle |
| packaging/installer/hosting | PRESERVED FUTURE | After product quality |
| offline/cache policy | PRESERVED FUTURE | Before public web/PWA claims |
| privacy/legal | PRESERVED FUTURE | Before public accounts/sharing/telemetry |
| telemetry | OPEN PRODUCT DECISION | Only explicit approval, privacy-first |
| observability/crash diagnostics | PRESERVED FUTURE | Release-quality bounded implementation |

## PLO and other game domains

| Branch | Status | Preserved path |
|---|---|---|
| PLO | PRESERVED FUTURE | Separate four-card domain, exactly-two-hole evaluation, dedicated ranges/Equity/Training/reference/UI; never a Hold'em toggle |
| tournament/ICM depth | PRESERVED FUTURE | Only with explicit tournament assumptions/reference pipeline |
| other variants | OPEN PRODUCT DECISION | No generic variant framework until a real product need exists |

## Optional gamification

| Capability | Status | Rule |
|---|---|---|
| study streaks / daily goals | OPEN PRODUCT DECISION | Useful only if based on real study activity and not manipulative |
| mastery/progress | OPEN PRODUCT DECISION | Requires valid concept/history semantics |
| XP/badges/levels | REJECT BY DEFAULT | Do not add merely for engagement |

## Explicit open product decisions

- exact first trusted reference-pack family;
- whether username/password login is needed before public release;
- final Training-evidence opt-in UX/default;
- when Personal Strategy gets a StrategyProvider adapter;
- first OpponentPolicy shipped archetypes and custom-policy UX;
- Saved folders/collections;
- sharing/forking permissions and study groups;
- restrained gamification approval;
- mobile timing;
- public release/monetization timing;
- PLO priority;
- telemetry approval;
- touch/click semantics for reusable card outcome preview.

## Pull-forward rule

A preserved item moves earlier only when explicitly reprioritized or when its dependencies are ready and a bounded ticket owns it. Do not absorb future capability merely because a touched file makes it convenient.
