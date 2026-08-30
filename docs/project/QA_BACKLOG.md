# Riverline persistent QA backlog

Last consolidated: August 31, 2026 (`CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` is **COMPLETED / HUMAN ACCEPTED**; the cheap Saved global-preview console guard is active next, followed by `GUIDE-CONTENT-001` and September Alpha closure/audit preparation; no perfect-polish or public-beta closure is implied).

This is the authoritative issue-routing file for historical and current QA. Code/tests/latest accepted ticket reports determine actual closure.

## Status vocabulary

- `OPEN`: not addressed
- `ACTIVE`: owned by the current ticket
- `PARTIAL`: structural or incomplete fix; requires more work or live acceptance
- `CLOSED`: accepted behavior fix
- `REMOVED`: feature/control intentionally retired
- `DEFERRED`: accepted future owner exists
- `REGRESSION`: previously better/closed behavior broke

A visual issue is not `CLOSED` without manual/browser confirmation.

## Global Node baseline and CI

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-NODE-BASELINE-001 | CLOSED | The canonical global Node suite remains the correctness baseline. Strategy authority, DecisionContext v1.1, exact preflop roles, benchmark tooling, bounded structural calibration, Core Flow, Premium Cards, Personal Strategy metadata, account/Guest semantics, localization, Table Presence, and Full Hand Review invariants remain represented. Machine-sensitive macro runtime reporting stays separate from correctness and operation-level interaction thresholds. | Global Node baseline checkpoint |
| QA-CI-001 | CLOSED | Minimal GitHub Actions automation runs canonical syntax checks and the full Node suite on Node 24 for pushes, pull requests, and manual dispatches. Hosted-run state remains externally observable rather than inferred locally. | `.github/workflows/node-ci.yml` |

## Strategy / reference / calibration

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-REFERENCE-AUTHORITY-001 | PARTIAL | Additive source descriptors, structured coverage/capabilities, central claim policy, comparative heuristic Training language, high-risk limitation path, Playbook/Analyze provenance, Matrix precision, AnalysisExplanation consumption, and EN/RU/HE semantics are automated. FULL-HAND-REVIEW-001 adds source-gated comparison, exact recorded frequencies, compact provenance, limitations, and unavailable/generalized continuity without changing authority. Remaining human Firefox acceptance includes Training pre/after-answer, Full Hand comparison copy, high-risk context notes, Playbook Details/provenance, Matrix precision, Daylight/Midnight, and HE RTL. | REFERENCE-AUTHORITY-001 / FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-REFERENCE-AUTHORITY-002 | DEFERRED | Saved Hand/Spot preserve canonical/scenario state but not frozen historical StrategyResult metadata. If durable historical analysis is added, its payload must snapshot source ID/version, authority, coverage, capabilities and limitations rather than reinterpret against today's registry. | future Saved historical-analysis payload |
| QA-STRATEGY-REPAIR-001A | CLOSED | Table-family preflop structure, causal postflop sampling seed, missing-price abstention, unreachable shove cleanup, apples-to-apples physical-combo diagnostics and quality corpus accepted. | STRATEGY-REPAIR-001A |
| QA-DECISION-CONTEXT-001A | CLOSED | v1.1 live/current stack, unclamped current pot, effective stack, position relation, canonical legal sizing, bounded prior-action facts, Scenario lossiness and derivation provenance accepted; legacy compatibility stack/pot remain explicitly non-live. | DECISION-CONTEXT-001A |
| QA-STRATEGY-REPAIR-001B | CLOSED | Live SPR, exact price, legality, bounded position/history and separated response-family structure accepted without authority upgrade; known postflop saturation remains explicit reference debt. | STRATEGY-REPAIR-001B |
| QA-REFERENCE-BENCH-001 | CLOSED | Source-agnostic private/manual benchmark schema, context gate, raw/normalized action projections, TVD/bias/equity semantics, CLI and proprietary-data boundary accepted. | REFERENCE-BENCH-001 |
| QA-REFERENCE-PACK-001 | PARTIAL / ACCEPTED FOUNDATION CHECKPOINT | `reference-pack/v1` now validates exact assumptions, complete 169-class structure, legality, probability mass, capabilities, source/license/redistribution fields, validation identity, and deterministic integrity; strict canonical matching, provider selection, truthful fallback, claim policy, and generic Playbook/Training/Matrix/Analyze/Review paths are automated. No production-safe corpus was available, synthetic fixtures are test-gated, and browser discovery exposed no Firefox/browser for manual covered/near-miss acceptance. | `RET-REFERENCE-PACK-001` production source acquisition/review; later Firefox acceptance when a real pack exists |
| QA-PREFLOP-ROLE-001 | CLOSED | Canonical histories now preserve exact preflop decision role, Hero prior voluntary action, initial/latest aggressors, distinct aggressor count and cold-action semantics; actual role remains distinct from fallback calibration. | PREFLOP-ROLE-001 |
| QA-PREFLOP-CALIBRATION-001 | CLOSED | Bounded six-max BB-vs-BTN cold-response policy now separates continue value, passive realization and aggression suitability; all non-target role distributions and postflop corpus remain byte-stable; source remains generalized comparative v4. | PREFLOP-CALIBRATION-001 |
| QA-PREFLOP-REFERENCE-001 | PARTIAL / DEPENDENCY-GATED | The preferred six-max BB-versus-BTN 2.5bb no-rake/no-ante family now has an exact contract/matcher and synthetic architecture coverage, but no production frequencies, accepted sizing tree, independently reviewed validation corpus, or production-safe provenance/licensing. Neighboring positions/stacks/open sizes remain unsupported rather than inferred. | `RET-REFERENCE-PACK-001` / future bounded source review |
| QA-POSTFLOP-REFERENCE-001 | DEFERRED | Strong-made-hand aggression saturation, coarse opponent-range construction and unsized postflop strategy remain known generalized-heuristic debt. | future trusted postflop reference/calibration |

## Active Table Presence / full-hand vNext

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-TABLE-VNEXT-001 | COMPLETED / HUMAN ACCEPTED WITH MINOR TABLE-PHYSICALITY DEBT | Pure deterministic tests still cover all 2–10 player templates, normalized anchors, Hero-bottom invariance, geometry families, seat prominence, layered physical table facts, projection sizing targets, RTL-stable poker geometry, and deep immutability. Final hands-on use accepts the enlarged table, attached Hero/HU panels, immediately inward no-dongle cards, outward contributions, and inward Dealer button. Dense/10-max lower side panels remain slightly too far inward and the top player slightly too far outward/high. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` / `QA-HANDSON-021` |
| QA-TABLE-VNEXT-002 | PARTIAL | Hand and Full Hand Training share the presentation and derived review contracts; direct pre-action frame seeking, complete/review states, decision navigation, canonical source semantics, and exact Analyze/Save routes are structurally covered. Independent human interaction and requested Firefox A–H visual acceptance remain open. | FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-FULL-HAND-REVIEW-001 | PARTIAL | One shared review surface now covers the hand overview, every recorded Hero decision, mixed-reference comparison only when source capabilities permit it, provenance/limitations, exact Replay synchronization, Analyze, existing-schema Save Spot/Hand, Repeat/Next/Return, multiway facts, accessibility, responsive rules, EN/RU/HE, RTL, themes, cards, and provider-result caching. Focused automated coverage is present; independent human Firefox acceptance of exact states A–H at 1920×1080, 2560×1440, and 2560×1600 in Midnight and Daylight remains open. | FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-REVIEW-NAV-001 | CLOSED / HUMAN ACCEPTED STRUCTURE; HISTORY MICRO-POLISH DEFERRED | The table-first desktop workspace, distinct Replay, one bounded vertical whole-Hand History, exact seeking, Return to live, and three-region Review are human accepted. Remaining History padding, font weight, contrast, density, and event-row polish stays routed debt and does not reopen chronology architecture. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-REVIEW-NAV-001` / `GLOBAL-PRODUCT-QUALITY-001` |
| QA-REPLAY-RAIL-CORRECTION-001 | CLOSED / HUMAN ACCEPTED | Legal Raise and exact all-in board commits remain re-derived from canonical live facts; invalid 2–10 inputs remain visible and block start; RU/HE and LTR amount islands remain intact. Abort is live-only in Current Hand and Daylight contributions use explicit semantic surface/text/halo/border/chip roles with measured 13.23:1 text contrast. | accepted `REPLAY-RAIL-NAV-001` checkpoint |
| QA-REPLAY-RAIL-HARDENING-001 | COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT | Final hands-on use accepts the left compact Hand context/state, center primary table, and right legal/chance + distinct Replay + bounded vertical History model, including table-first hierarchy, stable live/Replay, chronology, collapse/scroll, seeking, actions, no-dongle cards, contributions, EN/RU/HE/RTL, Daylight, and Review. Non-blocking debt remains for dense/10-max seat placement, an optional ownership-safe hidden-card tuck, full-ring Dealer-presence explainability, and History micro-polish; none reopens the accepted architecture. | accepted `REPLAY-RAIL-NAV-001` checkpoint; `RET-TABLE-001` / `RET-CARDS-THEMES-001` / `RET-REVIEW-NAV-001` / `RET-PREMIUM-001` |
| QA-TABLE-VNEXT-003 | COMPLETED / HUMAN ACCEPTED HAND PRESENTATION; AUDIO LISTENING DEBT REMAINS | Existing experience events retain stack-to-contribution lanes, contribution-to-pot/pot-to-winner paths, seat-relative deals, table-interior folds, street/actor/hand-complete consequences, direct-seek suppression, and reduced-motion safety. Replay rail removes unexplained always-visible dotted contribution paths while preserving exact contribution amounts and transient motion. Hand comprehension is accepted; subjective audio listening remains separate debt. | accepted `REPLAY-RAIL-NAV-001` checkpoint; later audio acceptance under `RET-AUDIO-001` |
| QA-AUDIO-MOTION-001 | PARTIAL / ACCEPTED IMPLEMENTATION WITH LISTENING DEBT | The event/audio boundary, physical foley, and bounded poker-event sequencing remain implemented foundations. The final human disposition did not establish subjective listening acceptance; do not claim perfection. | conditional bounded `AUDIO-DESIGN-001` according to time/impact, otherwise later `GLOBAL-PRODUCT-QUALITY-001` / `RET-AUDIO-001` |

## August 26 confirmed hands-on product review

The detailed evidence is [Hands-On Product Review — August 2026](HANDS_ON_PRODUCT_REVIEW_2026_08.md). An independent outside-user review originated the findings, and the product owner manually reproduced and confirmed all 59 in the current build. The rows below route evidence without duplicating the full descriptions. Split references distinguish a bounded active repair from a larger design owner; no row is `CLOSED`.

| Evidence reference | Status | Routed outcome | Owner |
|---|---|---|---|
| HPR-2026-08 #4, #21, #28, #31–33, #38–40, #43–46, #48, #52 plus final Saved/table evidence | COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT DEBT | Human acceptance preserves Welcome title focus/Escape, clearer Home Game completion state, Return to live, auth feedback, dead-card/range parity, Analyze clipping, Personal Strategy vocabulary, and Replay geometry. The later accepted First Use/Home checkpoint resolves Welcome navigation selection; warning prominence remains separately owned. The former card/seat overlap and Hand composition debt reached the accepted Replay checkpoint with named minor physicality debt. | accepted `HANDS-ON-DEFECTS-001`, `FIRST-USE-HOME-001`, and `REPLAY-RAIL-NAV-001` checkpoints; remaining owners below |
| HPR-2026-08 #4–5, #16–17 | COMPLETED / HUMAN ACCEPTED | Optional Welcome orientation is separate from the permanent recurring Home route, defaults to shown/unchecked, suppresses only itself, and selects no sidebar destination. Active navigation is truthful; Guest Home is useful without sign-in; explicit live Hand or active/paused Personal Strategy contracts alone produce Continue, otherwise Home provides Start without fabricated recency. | accepted `FIRST-USE-HOME-001` checkpoint |
| HPR-2026-08 #6–7, #14, #22–24 | PLANNED NEXT / AFTER CHEAP SAVED GLOBAL-PREVIEW CONSOLE GUARD | Current interactive/visual Guide plus concise human content design. | `GUIDE-CONTENT-001` |
| HPR-2026-08 #1 | COMPLETED / HUMAN ACCEPTED | One canonical geometric Riverline brand-spade serves the rail, Welcome, and current identity surfaces with context-appropriate contrast; poker-card suit rendering remains separate. | accepted `FIRST-USE-HOME-001` checkpoint |
| HPR-2026-08 #2–3, #9, #15, #18, #27, #47, #58 | BOUNDED SECONDARY POLISH / ACCEPTED QUALITY DEBT | Remaining intro/systemic spacing and sizing, semantic iconography, Account/Profile hierarchy, typography/casing, non-poker audio, and Royal Flush presentation. | `GLOBAL-PRODUCT-QUALITY-001` |
| HPR-2026-08 #8, #10–13 | BOUNDED SECONDARY POLISH / ACCEPTED CUSTOMIZATION DEBT | Compact control, richer card backs, clear custom-theme creation, Daylight comfort, and manual reduced-motion override. | `CUSTOMIZATION-UX-001` |
| HPR-2026-08 #19–20; #21 after accepted bounded clarity repair | CONDITIONAL / BOUNDED BY TIME AND IMPACT | Denser Riverline-integrated Home Game presentation, useful table/session representation, stronger proximate imbalance/toast feedback, and broader lifecycle presentation. | `HOME-GAME-PRESENTATION-001` |
| HPR-2026-08 #25–26, #35 | PRESERVED MAJOR FEATURE / POST-AUDIT ACTIVATION CANDIDATE | Reusable game setups/presets and physical Hero/button/Dealer/empty-seat configuration. | `GAME-SETUP-EVOLUTION-001` |
| HPR-2026-08 #29, #34; #28 and #33 after bounded repair; final hardening evidence | COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT | The left context / center table / right interaction composition, attached Hero/HU card physicality, enlarged table use, outward contributions, inward Dealer button, rail-isolated known-opponent editor, live-only Abort, and accessible Daylight contributions are human accepted. Dense/10-max seat placement, possible ownership-safe hidden-back tuck, full-ring Dealer-presence explainability, and History micro-polish remain explicitly deferred without reopening Replay/History architecture. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` / `RET-REVIEW-NAV-001` |
| HPR-2026-08 #30 | DEFERRED / NAMED OWNER | Shared legal Randomize/Lock behavior with card-removal truth and later reproduction. | `RANDOM-SPOT-GENERATOR-001` |
| HPR-2026-08 #36–37, #41–42, #53; #38–40 after bounded repair | CLOSED / HUMAN ACCEPTED | Matrix-local selected-hand inspection and legend, canonical card-removal presentation, primary complete comparison matrices, truthful independent shared-scale percentages, representative-sample limits, and Facts → Explain progressive depth are accepted. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| HPR-2026-08 #46 after bounded repair | COMPLETED / HUMAN ACCEPTED | The accepted normal decision/study-rail skeleton, Correction #1, and final hardening remain intact. Lean closeout evidence proves exact same-decision replay with unchanged headline session/planner statistics and one-step Next progression; terminal Full Hand Review retains 1183×769px versus 1184×770px live shared-table geometry, vertical canonical History, source/comparison evidence, and no horizontal timeline at Firefox 154 / 1920×1080. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| HPR-2026-08 #49–51, #54 | PRESERVED MAJOR FEATURE / ACTIVATE ONLY AFTER SEPTEMBER ALPHA AUDIT AND HUMAN TRIAGE | Game setup/Approach first value, broad sparse/high-information coverage before boundary refinement, and Teach Riverline Next/Matrix Edit consolidation. It is not immediately next. | `PERSONAL-STRATEGY-003A` |
| HPR-2026-08 #55 | DEFERRED / NAMED OWNER | Evidence-grounded concepts/reference/reasoning that genuinely teach; no claim this exists today. | `PERSONAL-STRATEGY-TEACHING-001` |
| HPR-2026-08 #56–57 | CLOSED / HUMAN ACCEPTED | Bounded 2–10-player composition, presentation-only inline naming, adjacent Board/Dead/Method controls, compact empty/running output, separate dominant completed comparison, transactional card-set input, and truthful exact-entered-hand outcome presentation are human accepted. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| HPR-2026-08 #59 | CLOSED / HUMAN ACCEPTED | The compact Saved grid uses DOM-free observer-safe Hand and visibly lossy Scenario Spot previews, visible zero-count All / Hands / Spots categories, a viewport-bounded hover/focus overlay, explicit bounded detail, shared card presentation, unsupported unknown-kind states, privacy clearing, and unchanged reopen/persistence boundaries. | accepted `SAVED-VISUAL-KNOWLEDGE-001` checkpoint |

## Second acceptance findings — Core Flow completed and human accepted

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-CORE-FLOW-NEW-HAND-001 | CLOSED / HUMAN ACCEPTED | The completed state keeps Review/Replay/Analysis/Save and explicit `Start new hand`; Review and Start new hand are the two primary actions without changing lifecycle. Fresh setup/focus/transient clearing/new identity and frozen completion remain verified and human accepted. | accepted `CORE-FLOW-CORRECTNESS-001` checkpoint |
| QA-HOME-GAME-CORRECTION-001 | CLOSED / HUMAN ACCEPTED | Active sessions expose `Correct entries` across uncorrected buy-in, rebuy, add-on, and cash-out entries, retain the direct cash-out shortcut, and accept an optional reason as `null` when absent without invented ledger prose. Existing immutable reversal/replacement, operable confirmation, and completed-session reopen semantics remain unchanged and human accepted. | accepted `CORE-FLOW-CORRECTNESS-001` checkpoint |
| QA-KNOWN-CARD-PICKER-001 | CLOSED / HUMAN ACCEPTED | Hand private-card selection advances continuously through the second slot; first Escape closes only the nested picker while preserving the expanded known-opponent disclosure, first card, and logical second-slot focus. Cross-seat duplicate exclusion, multiple opponents, and HU through 10-handed remain verified and human accepted. | accepted `CORE-FLOW-CORRECTNESS-001` checkpoint |
| QA-MIN-RAISE-VERIFY-001 | CLOSED / NO CANONICAL DEFECT | No poker-math defect was found. Canonical tests prove 1→3→minimum 5, 1→7→minimum 13, 1→3→8→minimum 13, postflop bet 5/raise 15→minimum 25, one short all-in without premature reopening, cumulative short-all-in reopening, unacted-player rights, and stack-bounded all-in-only legality. UI consumes canonical `minToMilliBb`/`maxToMilliBb` and retains explicit amount-to labels; no domain rule changed. | verified by `CORE-FLOW-CORRECTNESS-001` |
| QA-ALL-IN-RUNOUT-REGRESSION-001 | CLOSED / HUMAN ACCEPTED | Canonical `PokerState` semantics were correct. Application/UI defects mislabeled fully known hole deals as hidden/observed Replay events; Replay transition rejection then left a stale committed flop draft that allowed an already-consumed board card to reappear as a later chance candidate. The canonical available-card query now excludes current board, known hole cards, dead cards, and pending selections, and stale consumed draft cards are removed before the chance picker opens. Explicit Turn → River → Showdown remains intact; Replay/live terminal states agree and runout events occur exactly once. | accepted `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` checkpoint; Hand composition remains closed |

## August 24 hands-on product findings

These IDs are durable hands-on findings: open rows are current product defects or accepted polish debt, while closed rows preserve repaired invariants. They are not a generic “premium polish” bucket and may close only with the named owner plus appropriate real-browser/human acceptance.

| ID | Status | Issue / durable invariant | Owner |
|---|---|---|---|
| QA-HANDSON-001 | CLOSED | Default picker cards now use a readable 42×60 target with prominent rank/suit and comfortable hit areas; Firefox verified all 52 cards without extreme shrink or viewport overflow. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-002 | CLOSED | One presentation authority rounds generated/suggested strategy sizing to human 0.5bb increments while canonical, historical, user-entered, legal, and accounting amounts remain exact. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-003 | CLOSED | Controls First was removed and no longer exists as a broken product option. Balanced Hand remains state-aware: setup is prominent before play, live/completion controls precede the large table, and Replay gives review navigation priority. | `WORKSPACE-COMPOSITION-002` accepted implementation checkpoint |
| QA-HANDSON-004 | CLOSED | Five board cards remain one horizontal LTR poker-order row with semantic Flop/Turn/River guides across supported desktop presets, including 1024px and HE RTL chrome. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-005 | PARTIAL / ACCEPTED CHECKPOINT | Weak presets were removed and the exposed system is simplified: only Hand Table Focus and Analyze Analysis Focus survive beside Balanced; one-layout workspaces hide the selector and removed preferences repair safely. Final subjective polish/acceptance of the two surviving specialized layouts may be revisited without reopening Controls First. | `RET-COMPOSITION-002` later composition acceptance |
| QA-HANDSON-006 | CLOSED | The released tutorial version no longer re-nags after skip or completion; reload/navigation persistence, manual restart, and intentional version re-offer remain covered. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-007 | OPEN / CONFIRMED | Guide needs a current-product content review; HPR-2026-08 #22–24 further confirms stale, static, text-heavy, and robotic presentation. | `GUIDE-CONTENT-001`; later release acceptance in `PREMIUM-CLOSEOUT-001` |
| QA-HANDSON-008 | CLOSED | Home Game Create binds only after its authentication dependency is ready, stays in the Organizer, and opens the intended active session; broader organizer work remains `HOME-GAME-001B`. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-009 | PARTIAL | Audio volume is implemented by `AUDIO-MOTION-001`; retain subjective Study/UI/Check/fatigue/Firefox polish debt without reopening accepted architecture. | `RET-AUDIO-001` later polish |
| QA-HANDSON-010 | PARTIAL / ACCEPTED IMPLEMENTATION CHECKPOINT | The Settings god menu is replaced by four focused categories with a tested one-category-per-preference inventory, shared authorities, keyboard/RTL structure, and secondary Guide/tutorial discovery. Browser discovery exposed no available browser, so the requested EN/RU/HE, Midnight/Daylight, 1920×1080, 1366×768, and narrow/small-height real Firefox matrix remains open. | later `PREMIUM-CLOSEOUT-001` pre-release human Firefox closeout / `RET-PREMIUM-001` |
| QA-HANDSON-011 | CLOSED | Human Firefox/manual acceptance confirmed that the labelled `Learn Riverline` action is genuinely obvious outside Settings and that first-use/manual orientation routes cleanly to Guide and existing contextual tutorial affordances. Welcome remains separate from tutorial persistence and Guide content. | `WELCOME-INTRO-001` accepted checkpoint |
| QA-HANDSON-012 | CLOSED / INVARIANT PRESERVED | Built-ins are immutable and custom themes use explicit Edit, Save, Cancel, Duplicate, and Save as New transactions; draft changes do not persist or mutate the source before commit. HPR-2026-08 #11 is distinct open discovery/creation-flow debt: users still need an obvious Create New Theme / duplicate-current entry before editing. | accepted safety checkpoint; discovery debt under `CUSTOMIZATION-UX-001` |
| QA-HANDSON-013 | CLOSED | The ineffective Comfortable/Compact user-facing control is removed rather than represented as useful. Internal density tokens/controller compatibility remain, and bootstrap repairs old Compact preferences to the stable Comfortable default. | `WORKSPACE-COMPOSITION-002` accepted implementation checkpoint |
| QA-HANDSON-014 | COMPLETED / HUMAN ACCEPTED | The accepted normal Training skeleton, Correction #1, and final hardening are preserved. Focused Firefox 154 / 1920×1080 closeout evidence adds exact replay identity, replay-stat exclusion, exact one-step Next progression, and terminal Review continuity on the live-scale shared table with open vertical History and current source/comparison evidence. No Training console or page errors occurred. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-HANDSON-015 | COMPLETED / HUMAN ACCEPTED WITH MINOR TABLE-PHYSICALITY DEBT | The table scale and HU/full-ring geometry, increased table occupancy, attached Hero, no-dongle card ownership, outward contributions, and inward Dealer button are human accepted. Dense/10-max lower side panels remain slightly too far inward and the top player slightly too far outward/high. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` |
| QA-HANDSON-016 | CLOSED | Existing durable Save actions share an accessible outline/filled bookmark state backed by exact SavedStudyObject detection; repeated exact saves remain idempotent and no unsupported unsave/delete was invented. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-017 | CLOSED / HUMAN ACCEPTED | Player inputs use one bounded scroll region with presentation-only inline names, Board/Dead/Method stay readily adjacent, and calculated values live in a dedicated dominant result comparison rather than inside input tiles. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-HANDSON-018 | CLOSED | Four legal Training actions render as a balanced 2×2 constrained-desktop grid or readable 4×1 wide grid, preserving source/keyboard order and avoiding an orphan row. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-019 | CLOSED | Hint selection is street-aware: preflop uses starting-hand/position concepts and cannot select postflop made-hand/draw/board prompts; postflop may use those existing facts. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-020 | CLOSED | Table Focus materially increases the presentation target over Balanced while retaining canonical HU/sparse/6-max/full-ring geometry, usable timeline/action dock, and density-independent layout. Broader composition is now human accepted under Replay; named minor physicality debt remains separately routed. | `UX-REGRESSION-001` and `REPLAY-RAIL-NAV-001` accepted checkpoints |
| QA-HANDSON-021 | COMPLETED / HUMAN ACCEPTED WITH EXPLICIT HIDDEN-CARD PHYSICALITY DEBT | Known-card rendering preserves rank+suit identity and hidden-card privacy. One responsive radial felt grammar keeps attached panels, immediately inward no-dongle cards, outward contributions, and inward Dealer-button positions mutually readable through full ring. Hidden backs may later tuck under/behind their owner only while privacy, ownership, inspectability, known-card readability, and non-obstruction remain intact. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` / `RET-CARDS-THEMES-001` |

## Home / My Riverline

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-002A-001 | PARTIAL | Guest privacy/usefulness, authenticated identity/sync composition, truthful Continue, bounded Saved/Review/Mistakes, Personal Strategy evidence facts, account switching, coalesced invalidation, performance boundaries, EN/RU/HE structure, and accessibility are automated; requested Firefox viewport/theme/language visual acceptance remains open. | HOME-002A human Firefox acceptance |
| QA-HOME-002A-002 | DEFERRED | Full Saved Study View all/library, search, filters, tag drilldowns and master-detail inspector do not yet exist; HOME-002A intentionally provides bounded previews. | HOME-002B |
| QA-HOME-002A-003 | DEFERRED | Persistent Training history/re-drill intelligence and recent Analysis history remain unsupported; Home exposes seams but no fabricated statistics. | dedicated Training/Analysis persistence tickets |

## Home Game Organizer

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-GAME-001A-001 | PARTIAL / ACCEPTED IMPLEMENTATION CHECKPOINT | Standalone/accounting boundaries plus 001B player/group/session management, atomic correction/replacement projection, lifecycle/archive/export behavior, Guest restrictions, EN/RU/HE structure, RTL/logical CSS and accessible dialogs/forms are automated. Browser discovery exposed no available browser, so the requested real Firefox matrix and real authenticated provider path remain open. | dedicated Home Game human Firefox/provider acceptance / `RET-HOMEGAME-001` |
| QA-HOME-GAME-001A-002 | CLOSED / BOUNDED DECISION | Saved-player edit/archive/restore, ordered group management, visible reversal/replacement history, session archive/restore confirmation, and richer organizer UX are implemented. Hard delete is not exposed; import is deferred because safe retention, validation, version, ownership-adoption and conflict semantics do not exist. Canonical account-only export is implemented. | `HOME-GAME-001B` accepted implementation checkpoint |

## Product UI / shared presentation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-UI-001 | PARTIAL | Action Path nodes/connector must share one axis in LTR/RTL; glow must not clip | PRODUCT-UI-002R manual acceptance |
| QA-UI-002 | PARTIAL | ordinary status pills must remain one-line, content-sized, centered | PRODUCT-UI-002R manual acceptance |
| QA-UI-003 | PARTIAL | Betting Context still needs confirmed meaningful height reduction/alignment | PRODUCT-UI-002R manual acceptance |
| QA-UI-004 | PARTIAL | `View all hands` must align with Position/Prior action row | PRODUCT-UI-002R manual acceptance |
| QA-UI-005 | COMPLETED / HUMAN ACCEPTED WITH MINOR PHYSICALITY DEBT | `table-presentation/v1` still preserves name, position, stack, action, prominence, and exact card facts. The Hand renderer places cards in a natural seat-to-felt gap with no holder, connector, panel overlap, or contribution overlap; known cards remain inspectable and hidden cards private. A later hidden-back tuck is constrained by those accepted invariants. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `QA-HANDSON-021` / `RET-CARDS-THEMES-001` |
| QA-UI-006 | PARTIAL / ACCEPTED IMPLEMENTATION CHECKPOINT | Settings now uses a bounded modal with one independently scrolling category panel and responsive horizontal category navigation at narrow widths; real Firefox centering, clipping, and small-height acceptance remain open. | later `PREMIUM-CLOSEOUT-001` pre-release gate / `QA-HANDSON-010` |

## Next: shared analysis presentation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ANALYSIS-001 | PARTIAL | Playbook analysis retains its full Decision-grid row; R2 readability needs final manual acceptance | PRODUCT-UI-003R2 |
| QA-ANALYSIS-002 | PARTIAL | Shared Hero/board, economics, reasons, and context hierarchy refined; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-ANALYSIS-RANGE-001 | PARTIAL | exact-hand, board, blocker, supplied-range, provenance, tutorial, and EN/RU/HE integration are structurally tested; final live viewport/theme/language acceptance remains pending | ANALYSIS-RANGE-001 human acceptance |
| QA-ANALYSIS-BLUFF-001 | PARTIAL | Bluff & Pressure risk/reward, unavailable sizing, semibluff structure, multiway wording, river reference, range-removal boundaries, tutorial, and EN/RU/HE/RTL integration are structurally tested; final human viewport/theme/language acceptance remains pending | BLUFF-001 human acceptance |
| QA-TRAIN-ANALYSIS-001 | COMPLETED / HUMAN ACCEPTED | Varied/Focused immediate Facts still select authoritative made-hand/draw/board/economics evidence and keep generic card-removal detail under Explain. Full Hand now withholds verdict/source/Facts/deep analysis during live play and exposes recorded evidence only through shared terminal Review; no analysis or poker authority changed. Firefox and structural evidence pass. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-ANALYSIS-002 | PARTIAL | Pre-answer assistance is now one-at-a-time coaching hints; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-TRAIN-ANALYSIS-003 | PARTIAL | Post-answer reference remains one canonical frequency panel; the shared completed-hand review now reuses recorded StrategyResults and gates mixed comparison by source capability. Final manual acceptance remains pending. | FULL-HAND-REVIEW-001 human Firefox acceptance / premium closeout |

## August 13 live audit IDs

These identifiers remain the historical live-audit baseline; current tickets may supersede their owner.

| ID | Status | Issue | Owner |
|---|---|---|---|
| RL-05 | OPEN | Playbook long-page / analysis-location composition | premium closeout |
| RL-06 | OPEN | 169 unavailable postflop Matrix cells | future Matrix/premium closeout |
| RL-07 | OPEN | Range comparison stacking / long-page comparison | future Analysis/premium closeout |
| RL-12 | PARTIAL | supported theme catalog exposes polished product labels; human visual acceptance pending | theme acceptance |
| RL-13 | PARTIAL | One-at-a-time coaching hints replace pre-answer reference disclosure; manual acceptance pending | Training acceptance |
| RL-14 | PARTIAL | Training result uses refined Hero/board-first hierarchy; manual acceptance pending | Training acceptance |
| RL-16 | CLOSED / HUMAN ACCEPTED | Bounded setup and dedicated completed-result composition are product-owner accepted; future capability depth remains separately preserved rather than treated as renderer debt. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| RL-17 | PARTIAL | Guide terminology/content refresh implemented; final human review pending | Guide human review |
| RL-18 | CLOSED | hidden picker deck detaches on close while Matrix/Range caches retain PERF behavior | PERF-RL18 |
| RL-20 | PARTIAL | semantic theme authority and Daylight contrast checks implemented; human visual acceptance pending | theme acceptance |

## Cards, themes, density, layouts, and micro-polish

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-POLISH-001 | PARTIAL | PRELABS-FIX-001 established the lazy Firefox AudioContext seam and `AUDIO-MOTION-001` is now an accepted implementation checkpoint. Remaining subjective Study/UI and Check refinement plus unperformed Firefox audio/visual acceptance stay open as later polish debt rather than blocking the next ticket. | `RET-AUDIO-001` / later prioritized polish |
| QA-CARD-001 | PARTIAL | Premium Card System v1 remains the shared face authority and now scales inside the adaptive 2–10 player-unit geometry; Firefox visual acceptance at 1920×1080 remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-CARD-002 | PARTIAL | `10` keeps its explicit optical-width treatment in the scaled table-card family across all three styles; Firefox visual acceptance remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-CARD-003 | PARTIAL | DOM and SVG cards still share one presentation authority, named geometry, face semantics, and back variants; structural tests cover TablePresentation integration, while representative workspace/theme visual acceptance remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-THEME-001 | PARTIAL | Daylight controls now use semantic light surfaces; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-002 | PARTIAL | Daylight muted text passes structural contrast checks; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-003 | PARTIAL | legacy/experimental labels are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-004 | PARTIAL | duplicate Discord entries are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-005 | PARTIAL | Luxury Gold is retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-006 | PARTIAL | Named custom-theme lifecycle and independence remain automated; TABLE-PRESENCE-002 adds token-driven felt texture, two-band rail, betting line, seat prominence, and projection sizing without changing persisted theme records. Remaining acceptance: the existing custom-theme lifecycle plus Midnight/Daylight table legibility and Compact + Table Focus composition in Firefox. | PRODUCT-THEME-002 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-MICRO-001 | OPEN | Settings/current utility icon alignment needs final pass | PRODUCT-UI-004 |
| QA-MICRO-002 | OPEN | action-color palette needs final restrained consistency review | PRODUCT-UI-004 |
| QA-MICRO-003 | OPEN | awkward near-black inset surfaces need final token review | PRODUCT-UI-004 |

Do not expand theme/layout/density/card variant catalogs during the active table phase.

## Account identity / sync

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ACCOUNT-001 | PARTIAL | Legacy local data remains claimable behind Guest boundary; final migration acceptance must prove existing objects survive and IDs remain stable when claimed. | ACCOUNT compatibility acceptance |
| QA-ACCOUNT-002A | PARTIAL | Supabase email/password auth, profile/RLS migration, claim/start-separate, Guest fail-closed semantics, durable-action resume gate, switching/sign-out, no-sync copy, i18n/RTL/focus are structurally implemented. Remaining: live migration/provider validation and human Firefox lifecycle. | ACCOUNT-002A/AR live/manual acceptance |
| QA-ACCOUNT-002B-A | PARTIAL | Saved Hand/Spot opt-in sync, outbox/retry, stable IDs, conflict choices, tombstones, isolation, cold remote Replay and RLS/RPC structure are deterministic-test covered. Remaining: live migration/RLS and two-profile Firefox lifecycle. | ACCOUNT-002B-A live acceptance |
| QA-ACCOUNT-002B-B | PARTIAL | Personal Strategy/Calibration separate opt-in, stable IDs, immutable evidence, divergent-history preservation, metadata conflicts, session merge and RLS/RPC structure are deterministic-test covered. Remaining: live migration/RLS and two-profile Firefox lifecycle. | ACCOUNT-002B-B live acceptance |
| QA-ACCOUNT-002A2 | DEFERRED | Secure username/password adapter remains a separate trusted-server/Edge Function ticket if username login is still desired before release. | ACCOUNT-002A2 |

## Personal Strategy / Range Calibration

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-RANGE-CAL-002C | PARTIAL | Adaptive selection, boundary/uncertainty/sparsity ranking, deterministic resume, stopping, Skip/Not sure, category progress, i18n/RTL, sync-safe facts, validation and performance are automated; human Firefox acceptance remains. | RANGE-CAL-002C human acceptance |
| QA-PLAYSTYLE-QUICK-PROFILE-001 | PARTIAL | Bounded regional interpolation, starter checkpoint, clarification batches, abstention/conflict safety and EN/RU/HE are automated; human Firefox experience acceptance remains. | PLAYSTYLE-QUICK-PROFILE / ACTIVE-CLARIFICATION human acceptance |
| QA-RANGE-CAL-002D | PARTIAL | Snapshot-derived Matrix, truthful statuses, filters, evidence/history inspector, conflict preservation, corrections, adaptive follow/selection, keyboard/RTL and performance are automated; human Firefox matrix acceptance remains. | RANGE-CAL-002D human acceptance |
| QA-RANGE-BUILDER-001 | PARTIAL | Builder selection/painting, grouped direct/exact edits, conflict-safe commits, undo, adaptive reranking, i18n and tutorial are automated; human Firefox editing acceptance remains. | RANGE-BUILDER-001 human acceptance |
| QA-RANGE-TEACHER-001 | PARTIAL | Boundary/sparse/conflict/exact-mix recommendations, focused Calibration routing, scope isolation, i18n/tutorial and performance are automated; human Firefox compactness/truthfulness acceptance remains. | RANGE-TEACHER-001 human acceptance |
| QA-PERSONAL-002R | PARTIAL | The [independent product/architecture review and human disposition](PERSONAL_STRATEGY_002R_REVIEW.md) are complete and accepted. HPR-2026-08 #49–55 adds confirmed hands-on evidence for the accepted Game setup/Approach reset, broad coverage before boundary refinement, raw-label repair, surface consolidation, and a later genuine teaching owner. `003A` is preserved but waits for visible closure, the September Alpha audits, and human triage rather than following Training directly. Existing and future-migrated EN/HE/RU visual/real-user acceptance remains unperformed. | `PERSONAL-STRATEGY-003A`; `PERSONAL-STRATEGY-TEACHING-001` |

## Workspace composition and responsive fit

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-LAYOUT-001 | OPEN | Decision/Matrix/Range tabs sit too low and feel disconnected | PRODUCT-UI-005 |
| QA-LAYOUT-002 | PARTIAL | Active Hand now uses a primary compact timeline → adaptive table → Hero action dock sequence before secondary details, while setup remains a bounded rail and Analysis remains separate; Firefox passed the ticket's 1920×1080, 2560×1440, and 2560×1600 capture matrix, while 1024×768, 1366×768, representative zoom, and independent interaction acceptance remain open | TABLE-PRESENCE-002 human Firefox acceptance / PRODUCT-UI-005 |
| QA-LAYOUT-003 | PARTIAL | TABLE-PRESENCE-002 resolves active play and review as table/card-first while retaining configuration-first setup before a Hand starts; HU, 6-max, and 10-max Firefox captures passed target-width, dock-visibility, overflow, and collision checks, while independent human validation remains open | TABLE-PRESENCE-002 human Firefox acceptance / Product Lab follow-up if rejected |
| QA-LAYOUT-PRESETS-001 | PARTIAL / ACCEPTED CHECKPOINT | Workspace-specific preset authority remains, but the exposed model is deliberately simplified: Balanced everywhere, Hand-only Table Focus, Analyze-only Analysis Focus, no Controls First, and no user-facing density selector. Automated Firefox coverage passed the retained modes; any remaining subjective specialized-layout polish stays with `RET-COMPOSITION-002`. | `WORKSPACE-COMPOSITION-002` checkpoint / `RET-COMPOSITION-002` |
| QA-MATRIX-001 | CLOSED / HUMAN ACCEPTED | Canonical card-removal parity remains intact; selected-hand detail and the compact legend are local to the Matrix, and comparison semantics are accepted. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| QA-MATRIX-002 | CLOSED / HUMAN ACCEPTED | Postflop unavailable presentation uses the accepted compact truthful state instead of 169 inactive cells. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| QA-RANGE-001 | CLOSED / HUMAN ACCEPTED | Complete Hero/opponent matrices are the primary comparison objects without internal Matrix scrolling; category bars and basis continue below in normal page flow. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| QA-EQUITY-001 | CLOSED / HUMAN ACCEPTED | One bounded 2–10-player input region sits with readily reachable Board/Dead/Method controls; the no-result/running surface stays compact and completed results become the primary comparison. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-002 | CLOSED / HUMAN ACCEPTED | Presentation-only inline names and dedicated player comparison rows provide consistent labels and readable Equity/Win/Tie values without expanding input tiles or changing canonical request identity. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-003 | CLOSED / HUMAN ACCEPTED | Flop/Turn/River guides and live board slots share one five-column LTR grid; accepted Equity geometry preserves poker order across the supported localized desktop composition. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-001 | COMPLETED / HUMAN ACCEPTED | At Firefox 1920×1080 / 100%, normal active/answered Training preserves accepted columns and keeps actions/result/Next operable. The one primary progression row projects immediately below the verdict and above study labels, Facts, reference, and Explain; expanding Explain does not move Next. 1366×768 remains functional and large desktops remain bounded. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-002 | COMPLETED / HUMAN ACCEPTED | Pre-session still exposes expanded Setup, one Start Training CTA, and compact lazy Memory/diagnostics only. Sparse Varied/Focused ready states are content-height (Focused measured 744px at 1920×1080) rather than inheriting a Full Hand/table reserve; the 265px idle main remains preserved. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-003 | COMPLETED / HUMAN ACCEPTED | Full Hand retains one shared `TableRenderer`/`table-presentation` table at 1184×770px live and 1183×769px in terminal Review at Firefox 1920×1080. Review opens on the same table-first workspace, suppresses the horizontal timeline, opens vertical canonical History, and retains selected decision/source/comparison/Facts/Explain evidence. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-004 | COMPLETED / HUMAN ACCEPTED | A distinct live-only Abort hand control sits outside poker actions, requires confirmation, leaves cancel unchanged, and on confirm returns to expanded Full Hand setup with no terminal/showdown UI. The abandoned Memory session remains visible as Incomplete; focused domain evidence proves answered decision records remain preserved. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| FQA-002 | CLOSED | Training context values use the real grid, reflow to two columns at 1024, and remain atomic in Firefox EN/RU/HE with no global overflow or inaccessible action controls | PRELABS-FIX-001 |
| FQA-004 | CLOSED / SUPERSEDED | The former all-at-once multi-column Settings composition was removed by `SETTINGS-IA-001`; any remaining live viewport issue belongs to the new category IA acceptance matrix rather than the retired column layout. | `SETTINGS-IA-001` accepted implementation checkpoint / `QA-HANDSON-010` |
| QA-TABLE-001 | COMPLETED / HUMAN ACCEPTED WITH MINOR TABLE-PHYSICALITY DEBT | The active Hand continues to render canonical facts through `table-presentation/v1`. The no-dongle radial grammar, larger table body, attached Hero, outward exact contributions, inward Dealer button, and stable table-first action/history relationship are human accepted. Dense/10-max seat geometry and full-ring human Dealer-presence explainability remain later debt. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `QA-HANDSON-021` / `RET-TABLE-001` |
| QA-COLLAPSE-001 | PARTIAL | Starting a Hand restores the table to expanded state and keeps the collapse control integrated; Firefox compact-state acceptance remains open | CORE-FLOW-001B Firefox acceptance / UI-005 |

## Equity UX

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-EQUITY-ETA-001 | CLOSED / HUMAN ACCEPTED | Real Monte Carlo throughput and conservative ETA remain accepted within the canonical calculation lifecycle. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-PROGRESS-001 | CLOSED / HUMAN ACCEPTED | Indeterminate preparation and real determinate counters remain accepted within the canonical calculation lifecycle. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-NARROW-001 | CLOSED / HUMAN ACCEPTED | Per-hand Equity/Win/Tie presentation and responsive context hierarchy are accepted as part of the final Equity composition. | accepted `EQUITY-COMPOSITION-001` checkpoint |

## Guide, localization, responsive, mobile

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-GUIDE-001 | PARTIAL / CONFIRMED DEBT | Prior terminology/content refresh remains a structural foundation; HPR-2026-08 confirms the Guide is still stale, static, text-heavy, and robotic. | `GUIDE-CONTENT-001` / final human review |
| QA-I18N-001 | PARTIAL | Rendered-visible RU/HE audit is structurally clean across representative surfaces; FULL-HAND-REVIEW-001 adds complete EN/RU/HE review vocabulary and structural audits. Human linguistic acceptance remains pending. | i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-I18N-002 | PARTIAL | Live locale switching preserves state and re-renders without cross-locale leakage; shared review content is translated through the canonical runtime. Human acceptance remains pending. | i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-I18N-003 | PARTIAL | Static diagnostics report no missing visible keys, mojibake, or cross-locale contamination under the narrow whitelist, including Full Hand Review keys. Human acceptance remains pending. | i18n human acceptance |
| QA-I18N-004 | PARTIAL | RTL and poker-data LTR islands are structurally tested, including the shared review surface and cards/action values; human visual acceptance remains. | responsive/i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-RESP-001 | PARTIAL | Automated desktop renderer and structural responsive checks cover existing workspaces; Full Hand Review adds two-column-to-single-column convergence and Compact rules. Human Firefox acceptance remains pending at the ticket viewports/themes. | FULL-HAND-REVIEW-001 / premium closeout human acceptance |
| QA-MOBILE-001 | DEFERRED | Mobile needs a distinct composition, not stacked desktop panels. | MOBILE-001 |

## Training intelligence / Saved study future QA

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-TRAINING-MEMORY-001 | COMPLETED / HUMAN ACCEPTED | Owner-scoped durable evidence remains authoritative. Review later/Difficult behavior remains persisted and reversible. Confirmed Full Hand Abort finishes the Memory session as abandoned while preserving recorded decision/replay evidence; focused domain and Firefox Incomplete-session evidence pass. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAINING-REDRILL-001 | COMPLETED / HUMAN ACCEPTED V1 FOUNDATION | Same Spot remains exact historical reproduction and Similar Spot remains planner/generator-backed current practice. Firefox loaded canonical Memory actions and preserved the incomplete aborted Full Hand session; sophisticated scheduling, Saved Drill presets, richer filters, and cross-surface continuity remain future. | Future `TRAINING-MEMORY-002` when prioritized |
| QA-SAVED-LIBRARY-001 | DEFERRED | Full dense master-detail Saved Study Library and Hand/Spot/Range/Drill/Review/Session taxonomy are not implemented. | HOME-002B + payload tickets |

## Opponent policy / bots future QA

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-OPPONENT-POLICY-001 | DEFERRED | Opponent archetypes/custom policies/full-hand bot Training require a separate provenance-aware behavior contract and must not be conflated with reference strategy or real-person certainty. | OPPONENT-POLICY-ARCH-001 |

## Performance and DOM follow-up

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-PERF-001 | CLOSED | duplicate slider/context updates and hidden Matrix computation | PERF-001 |
| QA-PERF-002 | CLOSED | hidden picker deck removed on close; remaining heavy grids are intentional visible/cached work | PERF-RL18 |
| QA-PERF-003 | OPEN | visible Matrix DOM mutation needs browser profiling only if still measured sluggish | later PERF follow-up |
| QA-PERF-004 | DEFERRED / TEST INFRASTRUCTURE | The default highly parallel full Node invocation can trip the existing Range Calibration `<100ms` wall-clock assertion under machine saturation. The test passes alone, and the complete suite passes 1,792/1,792 with bounded concurrency. This is not a Workspace Composition product failure; do not loosen the threshold without a dedicated test-infrastructure decision. | `RET-TEST-INFRA-001` if reproduced in clean CI or the canonical developer environment |

## Closed or intentionally removed historical QA

| ID | Status | Outcome |
|---|---|---|
| QA-HIST-001 | CLOSED | collapsible vertical sidebar and utilities moved into rail |
| QA-HIST-002 | CLOSED | flags/full language names and persisted RTL direction |
| QA-HIST-003 | REMOVED | broken arbitrary layout-lock/drag editor removed |
| QA-HIST-004 | CLOSED | table-collapse empty-region bug |
| QA-HIST-005 | CLOSED | card picker root event interception regression |
| QA-HIST-006 | CLOSED | card typography/proportions restored and shared card system introduced |
| QA-HIST-007 | CLOSED | spade/outside-suit contrast refinement |
| QA-HIST-008 | CLOSED | T/10 visual preference added |
| QA-HIST-009 | CLOSED | basic deal/action/training sounds and reduced-motion support |
| QA-HIST-010 | CLOSED | Matrix fixed grid/no hover expansion and selected-hand inspector |
| QA-HIST-011 | REMOVED | fake Matrix EV heatmap |
| QA-HIST-012 | REMOVED | fake Matrix Equity heatmap |
| QA-HIST-013 | CLOSED | Range controls use dedicated selectors and unsupported prescriptions removed |
| QA-HIST-014 | CLOSED | Scenario/Hand pricing semantics and truthful pot odds |
| QA-HIST-015 | CLOSED | AJo/pure-fold implementation cliff and per-hand MDF/fake preflop SPR |
| QA-HIST-016 | CLOSED | postflop multiway split/allocation/evaluator/sample consistency |
| QA-HIST-017 | CLOSED | one StrategyProvider/StrategyResult authority across surfaces |
| QA-HIST-018 | CLOSED | Equity board horizontal and 2–10 player controls |
| QA-HIST-019 | REMOVED | useless Total Equity summary |
| QA-HIST-020 | CLOSED | Outs visual grouping and raw-card cleanup |
| QA-HIST-021 | REMOVED | Training circular answer wheel |
| QA-HIST-022 | CLOSED | Training chosen/highest markers, muted action palette, session dividers |
| QA-HIST-023 | CLOSED | Replace-card semantics, scoped toasts, sidebar truthfulness, View-all destination reveal |
| QA-HIST-024 | CLOSED | Hand pre-start state isolation and showdown prerequisite |
| QA-HIST-025 | CLOSED | Training Strategy Preview versus After-answer copy truthfulness |
| QA-HIST-026 | REMOVED | local solver-tree/model upload control until a validated import contract exists |

## Update rules

Every UI/product ticket report must list owned IDs as `CLOSED`, `PARTIAL`, `DEFERRED` with next owner, or `REGRESSION`.

Do not close an issue merely because source-level tests pass. Add newly reported issues here rather than relying on chat memory.
