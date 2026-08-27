# Hands-On Product Review — August 2026

Status: **COMPLETED / CONFIRMED PRODUCT EVIDENCE CAPTURED**

Planning consequence: `HANDS-ON-DEFECTS-001` is **COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT**. `CORE-FLOW-CORRECTNESS-001` is **IMPLEMENTATION COMPLETE / FINAL HUMAN ACCEPTANCE REQUIRED** after human-QA correction #1. Replay rail remains planned next but blocked on that acceptance, followed by Training composition, `PERSONAL-STRATEGY-003A`, and a whole-app mini-pass.

This is the durable evidence and triage artifact for `HANDS-ON-PRODUCT-REVIEW-001`. It is not another roadmap, backlog, QA system, or implementation specification. Current status and sequence remain owned by [Current Phase](CURRENT_PHASE.md), [Roadmap](ROADMAP.md), and [Product Backlog](PRODUCT_BACKLOG.md). Issue routing and deferred checkpoint debt remain owned by [QA Backlog](QA_BACKLOG.md) and [Product Return Queue](PRODUCT_RETURN_QUEUE.md).

## Source and validation

An independent outside-user review originated the 59 findings below. The Riverline product owner subsequently reproduced and confirmed every finding manually in the current build.

Therefore, **all 59 findings are accepted hands-on product evidence**. Their underlying user problems and desired product outcomes are binding planning inputs. A proposed implementation mechanism may change after focused design and inspection; the finding itself may not be dismissed because it is visual, subjective, inconvenient, broad, or non-blocking.

This ticket changes documentation and planning only. It does not claim that any finding is fixed, accepted visually, or implemented.

## Executive assessment

Riverline's domain foundations remain credible, but the confirmed product experience gives supporting configuration and text too much space while under-prioritizing the poker object, primary controls, and principal results. Several accepted implementation checkpoints are useful foundations, not proof that their visible surfaces are complete.

The most urgent work is a bounded repair pass over clear correctness, legibility, feedback, and state-transition failures. Larger composition changes require explicit design owners rather than being absorbed into that repair ticket. Personal Strategy still warrants the accepted first-value reset, now with stronger evidence that broad sparse coverage must precede fine boundary refinement. Premium Closeout remains a later pre-release gate, not the sole owner or evidence store for this review.

## Systemic findings

| Theme | Confirmed evidence | Product consequence |
|---|---|---|
| Poor space utilization | #8, #17, #19, #28, #34, #46, #54, #56–57 | Allocate space by task and output importance rather than panel count. |
| Oversized controls and fields | #3, #8–9, #19, #34, #54 | Establish bounded control sizing and density appropriate to the job. |
| Weak padding and spacing consistency | #3, #9, #43–44 | Treat spacing as a system, including empty and result states. |
| Underuse of side rails | #28–29, #46, #56 | Use rails when controls must remain operable beside the central poker object. |
| Inconsistent state-to-state composition | #21, #33, #43, #46, #57 | Preserve coherent geometry and clearly communicate state transitions. |
| Controls or details too far from their object | #26, #28, #36, #41, #53 | Keep controls, inspection, legends, and results near the state they affect. |
| Text-heavy surfaces | #15, #18, #22–24 | Replace walls of text with hierarchy, progressive detail, and meaningful visual structure. |
| Insufficient iconography and visual hierarchy | #15, #18, #22, #59 | Use professional semantic icons and compact visual previews, not decorative emoji. |
| Robotic or over-explanatory copy | #6–7, #14, #24 | Explanatory copy must earn its space and should not sell obvious invariants as features. |
| Inconsistent typography and casing | #27, #31, #44, #52 | User-facing language must be deliberate, readable, and free of raw implementation labels. |
| Weak first and empty states | #1–5, #16–17, #43, #54 | First use must orient the user, show value, and avoid broken-looking placeholders. |
| Weak transition feedback | #21, #33, #45–46, #48 | Destructive or state-changing actions require visible outcomes, guards, and error feedback. |
| Rigid game and environment configuration | #25–26, #35, #49–50 | Evolve examples into reusable, inspectable setups and more physical configuration. |
| Missing exploration and randomization | #30 | Provide shared legal Randomize/Lock behavior where manual construction is not the user job. |
| Personal Strategy first-value restrictions | #49–50, #54–55 | Reduce setup tax and make each surface earn its product complexity. |
| Premature Personal Strategy boundary refinement | #51 | Seek broad sparse/high-information evidence before fine boundary calibration. |
| Primary outputs and facts under-prioritized | #37, #41–42, #46, #53, #57 | Results and decision facts should dominate supporting configuration after an action completes. |

## Confirmed findings

Classification uses the established product meanings: **BUG / CORRECTNESS**, **USABILITY**, **INFORMATION ARCHITECTURE**, **LAYOUT / COMPOSITION**, **INTERACTION DESIGN**, **CONTENT / COPY**, **ACCESSIBILITY**, **VISUAL POLISH**, **CUSTOMIZATION**, and **FUTURE PRODUCT CAPABILITY**. Priority is triage order, not a claim that lower-priority evidence is optional: **P0** is the bounded active repair cluster, **P1** is a named redesign or accepted next product slice, and **P2** is durable global-quality/customization debt.

| ID | Normalized finding | Product area | Classification | Severity | Underlying user problem | Desired outcome | Recommended owner / ticket | Priority | Dependencies / notes |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Intro title appears unintentionally selected or focused on entry. | Intro | VISUAL POLISH; ACCESSIBILITY | Low | The first frame looks accidental and unfinished. | A deliberate, calm entry state with focus shown only when meaningful. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Preserve keyboard focus visibility while removing accidental-looking initial treatment. |
| 2 | Intro spade mark reads as an upside-down heart because its stem is missing. | Intro / brand | VISUAL POLISH | Medium | The primary mark is visually ambiguous. | A complete, recognizable, restrained Riverline spade mark. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Visual correction only; no brand-system expansion implied. |
| 3 | Welcome, buttons, and green-link treatments use inconsistent or excessive padding. | Global UI | LAYOUT / COMPOSITION; VISUAL POLISH | Medium | Similar controls do not share a coherent rhythm. | Consistent spacing tokens and compact control geometry. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Coordinate with #9 rather than applying isolated margins. |
| 4 | Intro falsely shows Hand as the selected main destination. | Intro / navigation | BUG / CORRECTNESS; USABILITY | High | Navigation communicates a state the user has not entered. | Main navigation reflects the actual current destination. | `FIRST-USE-HOME-001` | P1 | Two bounded repair attempts failed; resolve launch/sidebar/active-workspace semantics structurally. |
| 5 | The start experience is awkward inside the normal sidebar shell. | Launch / home | INFORMATION ARCHITECTURE; FUTURE PRODUCT CAPABILITY | Medium | First use lacks a useful launch model and clear destinations. | Explore a recurring start/home menu with relevant destinations and settings. | `FIRST-USE-HOME-001` | P1 | Preserve the outcome; exact shell/menu mechanism remains open. |
| 6 | The Settings “THIS DEVICE” box adds little value. | Settings | CONTENT / COPY; INFORMATION ARCHITECTURE | Low | Low-value explanation consumes attention and space. | Remove or replace it with information needed for an actual decision. | `GUIDE-CONTENT-001` | P1 | Coordinate with the global copy audit. |
| 7 | Defensive copy explains obvious invariants such as not changing study results. | Settings / global copy | CONTENT / COPY | Medium | The product sounds uncertain and makes users read unnecessary assurances. | Concise copy that explains only non-obvious effects and risks. | `GUIDE-CONTENT-001` | P1 | Preserve true safety boundaries without overselling them. |
| 8 | Card Rank Style occupies disproportionate horizontal space. | Settings | LAYOUT / COMPOSITION; USABILITY | Medium | A compact preference displaces more important settings. | A compact, readable selector proportional to its complexity. | `CUSTOMIZATION-UX-001` | P2 | Must remain accessible and previewable. |
| 9 | Text-to-box padding varies across the application. | Global UI | LAYOUT / COMPOSITION; VISUAL POLISH | Medium | Inconsistent spacing reduces scanability and perceived quality. | A systemic content-box spacing audit and shared rhythm. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Cross-surface token/component work, not one-off fixes. |
| 10 | Card-back customization is too limited and the selector is weak. | Cards / Settings | CUSTOMIZATION; FUTURE PRODUCT CAPABILITY | Medium | Users cannot meaningfully personalize a prominent poker object. | More high-quality, legally safe poker-like backs with a better selector. | `CUSTOMIZATION-UX-001` | P2 | Preserve default quality and IP/licensing safety. |
| 11 | Creating a custom theme is confusing because editing appears to begin from a built-in. | Themes / Settings | USABILITY; INTERACTION DESIGN; CUSTOMIZATION | Medium | Users cannot form a clear mental model of create versus edit. | Explicit Create New Theme and duplicate-current-theme entry points before editing. | `CUSTOMIZATION-UX-001` | P2 | Existing transactional save/cancel behavior remains useful but is not sufficient discovery. |
| 12 | Daylight remains slightly too bright and fatiguing. | Themes | VISUAL POLISH; ACCESSIBILITY; CUSTOMIZATION | Medium | The light theme is uncomfortable for sustained study. | Refine Daylight luminance while preserving contrast and semantic tokens. | `CUSTOMIZATION-UX-001` | P2 | Requires human visual acceptance. |
| 13 | OS reduced-motion preference cannot be manually overridden in Riverline. | Settings / motion | ACCESSIBILITY; CUSTOMIZATION | Medium | Users lack product-level control when OS preference does not match their need. | A clear Riverline override with truthful precedence and reset behavior. | `CUSTOMIZATION-UX-001` | P2 | Requires an explicit preference contract; do not misstate system status. |
| 14 | Settings explanation boxes are verbose, robotic, and often unnecessary. | Settings | CONTENT / COPY; LAYOUT / COMPOSITION | Medium | Copy density obscures actual controls. | Short, human copy with progressive detail only where needed. | `GUIDE-CONTENT-001` | P1 | Part of the global content-design owner. |
| 15 | Signed-in Account/Profile UI is visually cluttered plain text. | Account / profile | LAYOUT / COMPOSITION; VISUAL POLISH | Medium | Identity and account actions are hard to scan and group. | Clear hierarchy, grouping, contrast, separators, or cards. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Preserve account authority and error semantics. |
| 16 | “Don’t show welcome again” conflicts with a useful recurring start/home model. | Launch / onboarding | INFORMATION ARCHITECTURE; INTERACTION DESIGN | Medium | One-time onboarding and recurring navigation are conflated. | Separate optional orientation from a useful recurring launch destination. | `FIRST-USE-HOME-001` | P1 | Tutorial persistence remains a separate authority. |
| 17 | Guest Home uses only a small fraction of the available canvas. | Home | LAYOUT / COMPOSITION; INFORMATION ARCHITECTURE | High | The main destination looks empty and provides weak first value. | A purposeful Guest Home with useful density and clear next actions. | `FIRST-USE-HOME-001` | P1 | Must remain truthful about unavailable account-backed data. |
| 18 | Text-only surfaces lack meaningful professional iconography and visual structure. | Global UI | VISUAL POLISH; INFORMATION ARCHITECTURE | Medium | Users must parse undifferentiated text to find actions and concepts. | A restrained semantic icon and visual-hierarchy system without decorative emoji. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | `GUIDE-CONTENT-001` applies the system to Guide/content surfaces. |
| 19 | Home Game fields and output regions are too long and sparse. | Home Game | LAYOUT / COMPOSITION; USABILITY | Medium | Organizer work requires excessive scanning and pointer travel. | Denser task-oriented forms and summaries. | `HOME-GAME-PRESENTATION-001` | P1 | Accounting authority remains unchanged. |
| 20 | Home Game feels visually detached from Riverline and underuses table-oriented presentation. | Home Game | LAYOUT / COMPOSITION; FUTURE PRODUCT CAPABILITY | Medium | The organizer does not reflect the physical group/session it manages. | Investigate a Riverline-integrated, useful table/session representation. | `HOME-GAME-PRESENTATION-001` | P1 | Presentation must not become PokerState or accounting authority. |
| 21 | Complete Session changes or clears fields without sufficiently explaining the result. | Home Game | USABILITY; INTERACTION DESIGN | High | A consequential transition feels like data disappeared. | Guarded completion with clear feedback, toast/summary, and visible resulting state. | `HANDS-ON-DEFECTS-001` | P0 | Broader lifecycle presentation remains `HOME-GAME-PRESENTATION-001`. |
| 22 | Guide is static, text-heavy, and unengaging. | Guide | INFORMATION ARCHITECTURE; FUTURE PRODUCT CAPABILITY | High | Users cannot learn Riverline effectively from a wall of text. | Interactive, visual, task-oriented teaching. | `GUIDE-CONTENT-001` | P1 | Reuse current tutorial/help authority; do not create another help system. |
| 23 | Guide content is stale relative to the application. | Guide | BUG / CORRECTNESS; CONTENT / COPY | High | Help directs users using outdated product truth. | Current, version-aware Guide content aligned with supported surfaces. | `GUIDE-CONTENT-001` | P1 | Existing `QA-HANDSON-007` evidence remains open. |
| 24 | Guide copy reads as robotic and over-explains obvious points. | Guide | CONTENT / COPY | Medium | The Guide is tiring and less trustworthy than the product deserves. | Concise human writing that teaches real tasks and concepts. | `GUIDE-CONTENT-001` | P1 | Coordinate with #6–7 and #14. |
| 25 | Hand game-mode setup is stale and restricted to Home/ClubGG-like choices. | Hand setup | INFORMATION ARCHITECTURE; FUTURE PRODUCT CAPABILITY | High | Users cannot represent their real game assumptions or reuse them naturally. | Configurable, inspectable, reusable game setups and presets. | `GAME-SETUP-EVOLUTION-001` | P1 | Examples may seed templates but must not become future product identity. |
| 26 | Button and Hero seat setup is awkward and abstract. | Hand setup | INTERACTION DESIGN; USABILITY | High | Users translate physical seating into disconnected controls. | Explore direct table interaction, dragging, preview, or another physical setup model. | `GAME-SETUP-EVOLUTION-001` | P1 | Preserve canonical seat/button facts and keyboard accessibility. |
| 27 | User-facing capitalization and labels are inconsistent. | Global copy | CONTENT / COPY; VISUAL POLISH | Medium | Mixed casing and code-derived terms reduce clarity and polish. | One deliberate terminology and casing system across surfaces. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Raw enum leakage is separately in the P0 defect scope. |
| 28 | Current Legal Actions competes vertically with the table and is uncomfortable to operate. | Hand / Replay | LAYOUT / COMPOSITION; USABILITY | High | Users cannot keep the poker object and decision controls visible together. | A bounded immediate placement correction if local; otherwise first-class side-rail operation. | `HANDS-ON-DEFECTS-001` then `REPLAY-RAIL-NAV-001` if redesign is required | P0 / P1 | Do not absorb the full rail redesign into the repair ticket. |
| 29 | The horizontal Action Timeline is a poor fit for Riverline. | Replay / Review | INFORMATION ARCHITECTURE; INTERACTION DESIGN | High | Long chronological histories are hard to scan and group. | Seriously evaluate a vertical scrollable chronology with collapsible street groups. | `REPLAY-RAIL-NAV-001` | P1 | Preserve one canonical Replay cursor/history and keyboard/RTL behavior. |
| 30 | Card- and spot-driven features lack shared random generation. | Cross-surface study setup | FUTURE PRODUCT CAPABILITY; INTERACTION DESIGN | High | Exploration requires manually constructing every card state. | Shared legal Randomize/Lock behavior that respects known, dead, burned, and excluded cards. | `RANDOM-SPOT-GENERATOR-001` | P1 | Later deterministic reproduction; no second deck/state authority. |
| 31 | Action-bar text uses unreadable decoration and poor vertical alignment. | Hand action bar | BUG / CORRECTNESS; ACCESSIBILITY; VISUAL POLISH | High | The primary decision controls are hard to read. | Plain, aligned, readable action labels across states and languages. | `HANDS-ON-DEFECTS-001` | P0 | Bounded typography/alignment repair with browser acceptance. |
| 32 | Poker sounds overlap and mask one another. | Audio | BUG / CORRECTNESS; USABILITY | High | Audio consequences become confusing rather than informative. | Deterministic sequencing/priority so meaningful poker sounds remain audible. | `HANDS-ON-DEFECTS-001` | P0 | Later subjective non-poker sound quality remains `GLOBAL-PRODUCT-QUALITY-001`. |
| 33 | Replay Hand visibly changes table, rail, and title geometry. | Replay | BUG / CORRECTNESS; LAYOUT / COMPOSITION | High | Entering Replay feels like a different workspace and disrupts orientation. | Preserve coherent geometry through the existing play/replay transition. | `HANDS-ON-DEFECTS-001` | P0 | Only bounded regression repair; broader navigation/composition is `REPLAY-RAIL-NAV-001`. |
| 34 | Current Hand Stage is excessively large and horizontal. | Hand / Replay | LAYOUT / COMPOSITION; USABILITY | Medium | Low-information stage chrome consumes prime space. | A compact stage indicator appropriate to live/review composition. | `REPLAY-RAIL-NAV-001` | P1 | Coordinate with timeline and rail design. |
| 35 | Analyze Spot seating does not physically represent the actual table, Dealer, or empty seats well. | Analyze setup | INTERACTION DESIGN; LAYOUT / COMPOSITION | High | Users cannot verify configuration spatially. | A more physical, inspectable table/setup representation. | `GAME-SETUP-EVOLUTION-001` | P1 | Analyze remains a consumer of canonical setup facts. |
| 36 | Matrix selection detail appears far from the selected hand. | Analyze / Matrix | INTERACTION DESIGN; USABILITY | Medium | Inspection requires large eye movement and loses object context. | Place selected-hand detail near the matrix or selected object. | `ANALYZE-RANGE-UX-001` | P1 | Preserve keyboard focus and exact combo/class facts. |
| 37 | Strong-category-share comparison is difficult to interpret. | Analyze / Range comparison | INFORMATION ARCHITECTURE; LAYOUT / COMPOSITION | High | Users cannot form an intuitive relative-composition comparison. | A clearer, truthful relative-composition visualization with visible basis. | `ANALYZE-RANGE-UX-001` | P1 | Do not infer strategic advantage from visual shape. |
| 38 | Range comparison can ignore burned/dead cards and show impossible holdings. | Analyze / Range comparison | BUG / CORRECTNESS | High | The UI can contradict physical card legality. | All range comparison consumers condition through canonical card-removal truth. | `HANDS-ON-DEFECTS-001` | P0 | Use Range Core/canonical card facts; systemic UX remains `ANALYZE-RANGE-UX-001`. |
| 39 | Range Matrix does not consistently adapt to card-removal facts. | Analyze / Matrix | BUG / CORRECTNESS | High | Matrix summaries can display physically unavailable combos as possible. | Consistent blocker/dead-card-aware Matrix projection and inspection. | `HANDS-ON-DEFECTS-001` | P0 | Preserve unknown ≠ zero and exact combo provenance. |
| 40 | Bottom Analyze text boxes clip or trim content. | Analyze | BUG / CORRECTNESS; ACCESSIBILITY | High | Important analysis becomes unreadable. | Content-sized or scrollable panels with complete accessible text. | `HANDS-ON-DEFECTS-001` | P0 | Verify long EN/RU/HE content and representative viewports. |
| 41 | “What goes into this decision” is too hidden. | Analyze | INFORMATION ARCHITECTURE; USABILITY | High | Strategically important facts are hard to discover. | Make key decision facts visibly available near the result. | `ANALYZE-RANGE-UX-001` | P1 | Preserve provenance and canonical facts. |
| 42 | Expanded decision-detail content becomes too large. | Analyze | INFORMATION ARCHITECTURE; LAYOUT / COMPOSITION | High | Users must choose between hidden facts and overwhelming detail. | Progressive information depth such as Facts / Explain / Coach with concise defaults. | `ANALYZE-RANGE-UX-001` | P1 | Do not assume a literal global Beginner/Advanced switch. |
| 43 | Training pre-session assistance and memory regions look empty or broken. | Training | BUG / CORRECTNESS; USABILITY; LAYOUT / COMPOSITION | High | Users cannot tell whether features are unavailable, idle, or failed. | Intentional pre-session states with clear availability and next action. | `HANDS-ON-DEFECTS-001` | P0 | Preserve Training Memory authority and truthfulness. |
| 44 | Session Progress text wraps severely. | Training | BUG / CORRECTNESS; ACCESSIBILITY | High | Important progress labels become difficult to scan. | Stable, readable progress labels across supported widths/locales. | `HANDS-ON-DEFECTS-001` | P0 | Includes “Close to reference” wrapping. |
| 45 | Start New Session is unguarded during an active drill. | Training | BUG / CORRECTNESS; INTERACTION DESIGN | High | Users can abandon active state unintentionally. | Explicit confirmation or safe transition semantics for active sessions. | `HANDS-ON-DEFECTS-001` | P0 | Do not invent new Training session authority. |
| 46 | Answering a Training decision drastically recomposes the layout and pushes useful panels below the fold. | Training | LAYOUT / COMPOSITION; USABILITY | High | Feedback interrupts orientation and wastes available rail space. | Bounded state-transition stability now; fuller rail/result composition in a dedicated design pass. | `HANDS-ON-DEFECTS-001` then `TRAINING-COMPOSITION-001` | P0 / P1 | Repair ticket must not redesign the whole Training workspace. |
| 47 | Non-poker sounds provide weak learning feedback. | Training / UI audio | USABILITY; FUTURE PRODUCT CAPABILITY | Medium | Feedback feels low quality and does not reinforce serious study. | Restrained, satisfying, distinguishable learning/UI feedback. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Preserve existing event/audio authority; requires subjective acceptance. |
| 48 | Authentication failures are not visibly reported. | Account / authentication | BUG / CORRECTNESS; ACCESSIBILITY | High | Users cannot tell why sign-in failed or what to correct. | Clear, accessible wrong-password, mismatch, and nonexistent-account feedback. | `HANDS-ON-DEFECTS-001` | P0 | Preserve provider privacy/security wording and live-provider follow-up. |
| 49 | Personal Strategy setup does not match how users organize strategy. | Personal Strategy | INFORMATION ARCHITECTURE; USABILITY | High | Environment, exactly-three, and exact-RFI setup tax delays first value. | One named Game setup, one initial Approach, and a lightweight supported first-value path. | `PERSONAL-STRATEGY-003A` | P1 | Strengthens the accepted `002R` direction. |
| 50 | Home/ClubGG-style Personal Strategy environments are insufficient. | Personal Strategy | INFORMATION ARCHITECTURE; FUTURE PRODUCT CAPABILITY | High | Examples masquerade as the setup identity model. | User-named setups with inspectable rules; examples remain templates only. | `PERSONAL-STRATEGY-003A` | P1 | Preserve legacy identity through the approved migration. |
| 51 | Personal Strategy question selection refines narrow boundaries before broad useful coverage. | Personal Strategy | USABILITY; INFORMATION ARCHITECTURE | High | Users answer many low-leverage questions while large regions remain unknown. | Seek broad sparse/high-information coverage first, then refine boundaries after useful coverage exists. | `PERSONAL-STRATEGY-003A` | P1 | Question ranking remains derived, versioned, and evidence-safe. |
| 52 | Raw internal strings such as `sparse_region` and `inferred_high_*` reach users. | Personal Strategy / Matrix | BUG / CORRECTNESS; CONTENT / COPY | High | Implementation identifiers undermine comprehension and trust. | Stable localized product vocabulary with no raw enum/state identifiers. | `HANDS-ON-DEFECTS-001` | P0 | Accepted vocabulary remains Specified/Supported/Tentative/Unknown/Conflict. |
| 53 | Matrix legend is not persistently or locally available. | Analyze / Matrix | USABILITY; INFORMATION ARCHITECTURE | Medium | Users lose the meaning of colors/states while inspecting the matrix. | Keep the legend visible or easily available beside the matrix. | `ANALYZE-RANGE-UX-001` | P1 | Do not consume central space needed by the matrix itself. |
| 54 | Range Teacher retains the Personal Strategy menu above it and wastes space. | Personal Strategy | LAYOUT / COMPOSITION; INFORMATION ARCHITECTURE | High | The continuation task is buried under redundant product chrome. | Consolidate into Teach Riverline Next with compact, task-focused composition. | `PERSONAL-STRATEGY-003A` | P1 | Preserve one evidence authority and Matrix Edit consolidation. |
| 55 | Range Teacher does not yet earn a teaching-oriented name. | Personal Strategy | INFORMATION ARCHITECTURE; FUTURE PRODUCT CAPABILITY | High | Conflict/unknown reporting is presented as teaching without concepts or reasoning. | Teach Riverline Next eventually teaches through evidence-grounded concepts, reference comparison, and explanation. | `PERSONAL-STRATEGY-TEACHING-001` | P1 | Do not claim this capability exists today; reference availability remains explicit. |
| 56 | Equity player tiles dominate and push Board/Method controls away. | Equity | LAYOUT / COMPOSITION; USABILITY | High | Input tiles displace the central calculation workflow. | Bounded/stacked player composition, consistent optional names, and central Board/Dead/Method access. | `EQUITY-COMPOSITION-001` | P1 | Preserve canonical Equity request/result and compact multi-player support. |
| 57 | The Equity result is visually weak and expansion worsens composition. | Equity | LAYOUT / COMPOSITION; INFORMATION ARCHITECTURE | High | The main output receives less emphasis than supporting inputs. | Make the result dominant after calculation without expanding every player tile. | `EQUITY-COMPOSITION-001` | P1 | Preserve input/running/result continuity and exact method facts. |
| 58 | Royal Flush lacks a premium user-facing presentation. | Cards / results | VISUAL POLISH | Medium | A rare, meaningful result feels identical to an ordinary Straight Flush. | A restrained premium Royal Flush presentation while evaluator semantics remain unchanged. | `GLOBAL-PRODUCT-QUALITY-001` | P2 | Presentation only; no new evaluator category or poker math. |
| 59 | Saved Spots lack a rich visual preview. | Saved / Home | FUTURE PRODUCT CAPABILITY; VISUAL POLISH | Medium | Users cannot recognize a spot quickly from text alone. | A payload-owned miniature table/board/Hero/pot preview on focus, hover, or detail. | `SAVED-VISUAL-KNOWLEDGE-001` | P1 | Maintain keyboard/touch access, observer safety, and Saved authority. |

## Immediate repair cluster — `HANDS-ON-DEFECTS-001`

Status: **COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT STRUCTURAL AND NEWLY DISCOVERED DEBT**

This ticket owns a bounded correctness/usability repair pass, not a workspace redesign:

- Intro navigation truth: #4.
- Home Game completion feedback and state clarity: #21.
- Primary-control legibility and sound sequencing: #31–32.
- Canonical dead/burned-card conditioning and impossible Matrix/range combinations: #38–39.
- Analyze content clipping: #40.
- Training pre-session state, progress wrapping, and active-session transition safety: #43–45.
- Authentication error feedback: #48.
- Raw internal user-facing labels: #52.
- Bounded state-transition geometry repair for Replay and Training: #33 and the regression-sized part of #46.
- Current Legal Actions: the local placement/usability part of #28 only if inspection proves it can be corrected without reopening rail/workspace architecture.

The ticket must preserve canonical poker, Range Core card removal and unknown semantics, Training/session authority, authentication security semantics, Replay cursor/history, experience-event/audio authority, localization, accessibility, and PERF-001. It does not own the vertical Replay timeline, full side-rail design, full Training result composition, Guide rewrite, global spacing system, Equity redesign, or any schema migration.

If #28 or the broad part of #46 cannot be solved inside that boundary, the finding remains open under its named design owner; it is not forced into a cosmetic patch.

Implementation checkpoint, August 26, 2026: the bounded repairs are implemented with focused automated coverage. Replay table-size continuity and Training explanation flow received local stabilization; Current Legal Actions (#28), broader Replay composition (#33), and broader Training result composition (#46) remain assigned to their named owners. Firefox automation was unavailable in the agent environment. Every referenced finding remains open pending product-owner hands-on acceptance; this checkpoint does not mark any review row closed or advance `PERSONAL-STRATEGY-003A`.

### Final human-evidence correction addendum — August 27, 2026

The first acceptance attempt did not pass. A deeper product-owner Firefox pass with screenshots at 100% zoom refined the evidence instead of reopening every accepted repair.

The final local correction remains bounded to: zero selected Core Study destinations and no programmatic title focus ring while Welcome is open; prominent exact imbalance feedback beside Home Game completion; unobscured full rank+suit identity for legitimately known opponent cards; an obvious return-to-live action only while an in-progress canonical Hand is replayed; Saved-specific tutorial identity; and truthful Guest copy that says Saved belongs to a signed-in Riverline profile and that sign-in alone does not enable sync or cloud backup.

The correction does not reopen accepted card-removal parity, Analyze clipping, Personal Strategy vocabulary, bounded Replay geometry improvement, Training state repairs, audio sequencing, or authentication feedback except for regression. It also does not cosmetically patch the horizontal Action Flow, Current Legal Actions placement, full Replay rail, Training pre/post composition, Equity composition, `PERSONAL-STRATEGY-003A`, Guide/Home content, or global audio.

The structural evidence is now directional rather than an open comparison:

- `REPLAY-RAIL-NAV-001` owns vertical street-grouped history, first-class rail actions and Current Legal Actions, compact Hand Stage, table/history/action integration, and timeline typography.
- `TRAINING-COMPOSITION-001` owns one primary start CTA, a stable pre/post-answer skeleton, top-packed useful content, Action History, Assistance, Training Memory, setup/status, and progressive Facts → Explain → Coach depth.
- supported desktop acceptance uses 1920×1080 at 100% zoom as the primary state, 2560×1440 and 2560×1600 coverage, and functional 1366×768 support; reducing zoom is not an acceptance workaround.

At that checkpoint, one short final acceptance remained required before advancing. The resulting second-pass disposition is recorded below.

### Second human disposition and anti-loop closeout — August 27, 2026

The second product-owner acceptance pass completes `HANDS-ON-DEFECTS-001` as a bounded repair checkpoint. No third correction cycle is authorized, and the checkpoint is not full HPR, Hand-composition, Training-composition, or whole-product visual acceptance.

Human-accepted repairs are: removal of the Welcome title focus/selection rectangle; correct Escape dismissal; materially clearer Home Game completion state; working Return to live; intended authentication failure feedback; preserved dead-card/range parity; preserved Analyze clipping; stable user-facing Personal Strategy vocabulary; and materially improved Replay geometry.

Repeated or structural failures remain open:

- Hand still appears selected on Welcome; `FIRST-USE-HOME-001` owns launch/sidebar/active-workspace semantics and first- versus returning-launch behavior.
- Home Game imbalance is visible but insufficiently proximate/prominent; `HOME-GAME-PRESENTATION-001` owns stronger presentation.
- Fully visible opponent cards can overlap player identity/stack. `REPLAY-RAIL-NAV-001` owns one coherent cards/seat/player/action grammar across HU through full ring, folded-seat readability, physical Dealer/gap treatment, and the table/rail/timeline relationship. No further isolated z-index/card-offset patch is accepted.
- The dotted lines are the existing seat → street-contribution → pot lanes. Their semantic intent is real, but their unexplained-artifact appearance is valid UX debt; the Hand redesign must clarify, simplify, or remove them according to comprehension.
- Home and Saved remain under-composed and visually stale under `FIRST-USE-HOME-001` and `SAVED-VISUAL-KNOWLEDGE-001`.

New functional evidence activates `CORE-FLOW-CORRECTNESS-001`: provide an obvious fresh-Hand lifecycle after terminal state without mutating completed history; expose the canonical append-only Home Game correction/reversal flow after accidental cash-out; keep known-opponent-card entry open through two legal selections or explicit dismissal; and reconstruct the reported min-raise history before any legality change. A 7bb → 13bb reraise may be exactly legal because the last full raise increment can be 6bb. Verification must cover opening bet, ordinary raise, reraise, short all-in, and action reopening.

Human-QA correction #1 checkpoint, August 27, 2026: the bounded Core Flow repair is implementation complete and requires final human acceptance. Review and `Start new hand` now share primary terminal priority without lifecycle changes; `Correct entries` exposes the existing immutable reversal/replacement workflow at session level across eligible buy-in, rebuy, add-on, and cash-out facts, with optional reason stored as `null` when absent and no invented placeholder note; first Escape dismisses only the nested opponent-card picker while preserving the disclosure, first card, and focus; and canonical minimum-raise/reopening behavior remains closed with no canonical defect or poker-domain change. Focused Node and Firefox 154 EN/RU/HE/RTL interaction checks pass with no page errors. This evidence does not checkpoint final acceptance or activate Replay rail.

## Near-term redesign owners

These are accepted owners, not permission to start every ticket automatically. Exact order is reassessed at the whole-app mini-pass after Core Flow correctness, Replay rail, Training composition, and `PERSONAL-STRATEGY-003A`.

| Owner | Durable scope | Review evidence |
|---|---|---|
| `FIRST-USE-HOME-001` | Recurring launch/home model, separation from one-time onboarding, sidebar/active-workspace semantics, first- versus returning-launch behavior, useful Guest Home density. | #4–5, #16–17 plus second-pass Welcome evidence |
| `REPLAY-RAIL-NAV-001` | Vertical chronological timeline exploration, collapsible streets, first-class side-rail controls, compact Hand Stage, live/replay geometry, coherent card/seat/player ownership, folded-seat readability, physical Dealer treatment, and contribution-line clarity. | #28–29, #33–34 plus second-pass table evidence |
| `TRAINING-COMPOSITION-001` | Stable answer transition, useful rail allocation, feedback hierarchy, above-fold practice controls and results. | #46 |
| `EQUITY-COMPOSITION-001` | Bounded player tiles, optional player naming, central Board/Dead/Method, dominant result composition. | #56–57 |
| `GUIDE-CONTENT-001` | Interactive/visual Guide, current content, human copy, content hierarchy, removal of obvious/defensive filler. | #6–7, #14, #22–24 |
| `GAME-SETUP-EVOLUTION-001` | Reusable configurable game setups/presets plus direct physical seat, button, Dealer, and empty-seat interactions. | #25–26, #35 |
| `HOME-GAME-PRESENTATION-001` | Denser Riverline-integrated organizer, useful table/session representation, and stronger proximate imbalance/toast feedback beyond the accepted bounded clarity repair. | #19–21 plus second-pass warning evidence |
| `RANDOM-SPOT-GENERATOR-001` | Shared legal randomization and locks for supported consumers, card-removal truth, and later deterministic reproduction. | #30 |
| `ANALYZE-RANGE-UX-001` | Matrix locality, comparison visualization, card-removal presentation, persistent legend, explanation discoverability/depth, supporting panels. | #36–42, #53 |
| `PERSONAL-STRATEGY-003A` | First-value reset plus broad sparse/high-information question selection before fine boundary refinement. | #49–51, #54 |
| `PERSONAL-STRATEGY-TEACHING-001` | Future evidence-grounded concept/reference/reasoning instruction; no claim that current Teacher already teaches. | #55 |
| `SAVED-VISUAL-KNOWLEDGE-001` | Observer-safe, payload-owned visual previews for Saved Spots and later approved objects. | #59 |

## Longer-term quality and customization debt

| Owner | Durable scope | Review evidence |
|---|---|---|
| `GLOBAL-PRODUCT-QUALITY-001` | Intro/logo polish, spacing and control sizing, typography/casing, semantic iconography, Account/Profile hierarchy, non-poker sound quality, Royal Flush presentation. | #1–3, #9, #15, #18, #27, #47, #58 |
| `CUSTOMIZATION-UX-001` | Compact rank-style control, richer card backs, clear custom-theme creation, Daylight comfort, manual reduced-motion override. | #8, #10–13 |

These are real accepted debts. `PREMIUM-CLOSEOUT-001` may verify or finish applicable work before release, but it is not their only evidence source or current design owner.

## Personal Strategy consequences

The review strengthens, rather than replaces, the accepted `PERSONAL-STRATEGY-002R` disposition:

- exactly-three and Home/ClubGG-like restrictions are confirmed first-value pain, not merely theoretical concerns;
- `PERSONAL-STRATEGY-003A` remains bounded to the Game setup/Approach migration and local-first supported RFI experience;
- initial question selection should seek broad sparse/high-information coverage across useful regions before repeatedly refining narrow boundaries;
- fine boundary and exact-mix refinement follows only after broad useful coverage or an explicit user request;
- standalone Builder/Teacher-like product surfaces must earn their complexity; Matrix Edit and Teach Riverline Next remain the accepted consolidation;
- `PERSONAL-STRATEGY-TEACHING-001` preserves the future goal of teaching concepts and reasoning with evidence and compatible reference comparison, without claiming it exists today.

Selected reference, intended Personal Strategy, source-labelled observed behavior, and opponent policy remain separate. Dominant-only evidence remains non-quantitative, and Training Memory remains the current observed Training authority.

## Product principles learned

| Principle | Durable owner |
|---|---|
| Allocate space according to information/action importance, not equal panel weight. | [Product Specification §5](PRODUCT_SPEC.md#5-information-hierarchy-and-composition) |
| Side rails are first-class interaction space when they keep the central poker object visible. | [Interaction Grammar](INTERACTION_GRAMMAR.md) |
| State changes should not unnecessarily recompose the workspace. | [Interaction Grammar](INTERACTION_GRAMMAR.md) |
| Keep controls, results, and inspection near the object or state they affect. | [Interaction Grammar](INTERACTION_GRAMMAR.md) |
| Explanatory copy must earn its space; obvious invariants are not product features. | [Product Specification §5](PRODUCT_SPEC.md#5-information-hierarchy-and-composition) and `GUIDE-CONTENT-001` |
| Text-heavy surfaces need hierarchy, semantic visual structure, and meaningful icons. | [Product Specification §5](PRODUCT_SPEC.md#5-information-hierarchy-and-composition) |
| Exploration workflows should support shared legal randomization where manual entry is not the job. | [Interaction Grammar](INTERACTION_GRAMMAR.md) and [Random Spot Generator](capabilities/RANDOM_SPOT_GENERATOR.md) |
| Raw enum/state identifiers never belong in user-facing copy. | [Interaction Grammar](INTERACTION_GRAMMAR.md) |
| First value should gather broad useful evidence before fine boundary calibration. | [Personal Strategy Intelligence](capabilities/PERSONAL_STRATEGY_INTELLIGENCE.md) |
| Primary outputs should dominate secondary configuration after an action completes. | [Product Specification §5](PRODUCT_SPEC.md#5-information-hierarchy-and-composition) |
| A functionally correct feature remains product-incomplete when its transitions make the workflow hard to understand. | [Interaction Grammar](INTERACTION_GRAMMAR.md) and [Definition of Done](DEFINITION_OF_DONE.md) |

## Roadmap consequences

The confirmed review and second human disposition set the immediate sequence to:

1. `HANDS-ON-DEFECTS-001` — **COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT DEBT**.
2. `CORE-FLOW-CORRECTNESS-001` — **IMPLEMENTATION COMPLETE / FINAL HUMAN ACCEPTANCE REQUIRED**.
3. `REPLAY-RAIL-NAV-001` — **PLANNED NEXT / BLOCKED ON CORE FLOW HUMAN ACCEPTANCE**.
4. `TRAINING-COMPOSITION-001` — **PLANNED NEXT**.
5. `PERSONAL-STRATEGY-003A` — **PLANNED NEXT**.
6. Human whole-app mini-pass.
7. Likely `EQUITY-COMPOSITION-001`, `ANALYZE-RANGE-UX-001`, and `GAME-SETUP-EVOLUTION-001`, with exact order reassessed at that mini-pass.

Later work remains preserved: Personal Strategy provider/reference/observed integration, Guide/content, Home Game presentation, Random Spot Generator, launch/home evolution, Saved visual knowledge, customization, audio design, global product quality, and `PREMIUM-CLOSEOUT-001` as the later pre-release quality gate.

The workflow lesson is binding for user-facing work:

```text
agent implementation
  -> automated verification
  -> human hands-on use
  -> product discussion
  -> correction or acceptance
  -> checkpoint
```

After roughly two or three substantial user-facing tickets, Riverline should perform a short freeform whole-product hands-on pass even when each ticket passed automated checks. Backend/foundation tickets with no meaningful visible surface may be checkpointed without artificial browser QA.

## Traceability and ownership

Every confirmed finding has a row-level owner in this artifact. [QA Backlog](QA_BACKLOG.md) routes the evidence by owner and status, while [Product Return Queue](PRODUCT_RETURN_QUEUE.md) keeps deferred redesign and quality debt returnable. Capability dossiers preserve only durable future direction; they do not own current status.

There are **no orphan findings**. No finding is closed by this documentation ticket, and no implementation suggestion is treated as a frozen specification.

## Open product-design questions

- Which launch/home composition provides recurring value without reviving a nagging Welcome flow?
- Can Current Legal Actions receive a bounded P0 placement correction, or does it require the full rail owner?
- Which vertical Replay chronology best supports street grouping, direct seeking, long hands, keyboard navigation, localization, and RTL?
- How should Training distribute result, explanation, progress, assistance, and history without destabilizing the decision frame?
- Which comparison visualization makes relative range composition intuitive without implying unsupported advantage?
- Should explanation depth be remembered globally, per surface, or selected ad hoc?
- Which first supported Randomize/Lock consumer proves the shared contract with the least scope?
- What table-oriented Home Game projection materially improves session operation without conflating accounting and PokerState?
- Which Personal Strategy selection policy best balances broad coverage, user relevance, and later boundary refinement?
- What evidence and reference capabilities are required before Teach Riverline Next can genuinely teach concepts?
- Which compact Saved Spot preview remains readable, observer-safe, keyboard/touch accessible, and cheap to render?
- Which quality/customization items should be completed before versus inside Premium Closeout?
