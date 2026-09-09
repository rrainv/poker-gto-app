# Riverline Product and UI Specification

Last refreshed: August 30, 2026 (`EQUITY-COMPOSITION-001` human-accepted interaction closeout).

## 1. Product principle

Riverline is a serious personal poker learning workstation. Premium means consistency, reliability, clear hierarchy, honest provenance, restrained interaction, and excellent composition—not visual excess or casino-game styling.

**Functionally correct but visibly sloppy is a product defect.** No clipping, no overlap, and valid responsive geometry are necessary but do not by themselves establish product quality.

## 2. Current product surfaces

- **Home:** account/Guest-aware study hub, Continue, Saved/Recent/Review/Mistakes, Personal Strategy facts, and quick starts.
- **Hand:** canonical legal full-hand play, Table Presence, action dock, timeline, completion, and Replay.
- **Review:** shared decision-by-decision Hand and Full Hand Training review over canonical history.
- **Analyze:** Scenario or Hand decision analysis, explanation, evidence, provenance, Matrix, ranges, and structural board/blocker facts.
- **Training:** Varied, Focused, and Full Hand practice over canonical legal generation and source-aware comparison/presentation, with local-first encountered-decision history, review, and re-drill. The current heuristic is an exploratory/comparative baseline; agreement/disagreement is not skill, accuracy, mastery, correctness, GTO, or automatic remediation.
- **Personal Strategy:** profile/mode Calibration, Matrix, Range Builder, and Range Teacher over one sparse evidence authority.
- **Equity:** canonical exact or seeded Monte Carlo Hold'em outcomes.
- **Saved:** local-first versioned Hand/Spot objects, annotations, review state, and detached Replay reopening.
- **Home Game:** separate exact-money cash-game organizer.
- **Guide:** durable current-product help.
- **Settings:** four focused categories—Appearance, Audio & Motion, Language & Help, and Account & Data—over the existing layout, card, theme, audio, localization, tutorial, and account/profile authorities.

## 3. State-aware projection model

One canonical Hand/state may support different ephemeral compositions:

- **Play:** table, actor, legal decision, pot, stacks, and card state dominate.
- **Review:** timeline, selected Hero decision, comparison, and learning actions dominate.
- **Analyze:** ranges, explanation, evidence, provenance, and limitations dominate; table is supporting context.
- **Saved inspection:** compact passive preview supports a dense library/inspector workflow.
- **Calibration/Builder:** Personal Strategy evidence, uncertainty, editing, and correction dominate.

Presentation projections never become poker state, legality, accounting, strategy, Training, Replay, or persistence authority.

Before a canonical Hand exists, valid draft setup projects a clearly labeled
`setup_preview`: player count, Hero/button seats and starting stacks only.
It contains no dealt cards, actor, pot history, forced contributions or actions.
Changes project immediately, including after renderer startup; Start Hand remains
the canonical creation boundary. A live or Saved Hand continues to project its
canonical state and ignores setup drafts.

Hand setup exposes actual **Rake / collection** choices: none, or the supported
fixed 0.1 bb per seated player collected outside the pot (currently 7-10 seats).
Existing canonical GameRulesDefinition presets supply the definitions and limits;
new setup creates a direct immutable snapshot. Legacy `gameMode` setup inputs
remain compatibility aliases. Future setup presets may group these controls but
must never become rules authority (`BETA-HAND-PRE-QA-CORRECTION-001`).

For ante Hands, preflop contribution markers expose posted blind and ante amounts
from the canonical ledger, with voluntary action payments separately labeled.
The Players and contributions disclosure retains the forced-payment breakdown;
Replay initialization carries these facts without adding voluntary actions.
Public-card randomization follows legal pending chance state regardless of Hero
participation. It edits only the pending draft; Deal commits it. Historical Replay
remains read-only and a committed public street cannot be rerandomized.

## 4. Visual system

Use canonical tokens and components for typography, spacing, density, radii, borders, surfaces, shadows, controls, buttons, badges, focus, poker actions, cards, and table visuals. Avoid one-off inline styles when an existing component owns the rule. Do not begin a stylesheet rewrite during a bounded ticket.

The no-casino aesthetic rejects spectacle, confetti, fake cinematic 3D, reward loops, and decorative casino clutter. The human-requested bold correction of `BETA-DESIGN-REFRESH-001` permits original illustrated fictional portraits and short character descriptors in synthetic Full Hand practice. They are appearance, never behavioral or real-person evidence.

### Shared study presentation

The September 7 `BETA-DESIGN-REFRESH-001` implementation uses one theme-token
grammar: primary headings/questions, readable factual blocks, blue assumption
edges, neutral method badges, visible amber limitations, subdued supporting
notes and native disclosures. Color accompanies wording and structure; it never
grants strategy authority. Explain, Personal understanding/node teaching,
Opponent setup/review and Study Inbox consume this grammar without changing
their evidence, actions or scheduling. Existing panel and button components
remain the shared foundation. After human visual rejection of the first pass,
`src/ui/riverline-design.css` adds the forest/jade/brass shell, contrasting study
desk and felt stage, tactile controls and stronger insight hierarchy. Midnight's
built-in palette/preview change together; custom theme values remain authoritative.

Canonical tables share adaptive seat/card geometry and show projected actor and
dealer context beneath the felt. Full Hand Training adds a collapsed **Table
cast** selector with independently selectable fictional identities per canonical
opponent seat. Ordinary Hand/Scenario and imported players do not acquire these
identities. Ten original PNG portraits, names and localized short archetypes
are visible on opponent seats and in the selector. Appearance remains
session-local and separate from policy settings. A neutral selection click uses
existing SoundFX category/volume/mute gating; the table renderer remains silent.

Equity's **Ranges & runouts** occupies a full-width row after the matchup and
Hand Analysis. Within it, setup and results share space at sufficient component
width; Runout Explorer follows beneath, initially expanded inside the still-lazy
outer disclosure. It never starts computation on opening. Embedded Personal/Exploit instances
stack by their own available width. Known cards use the existing shared card
faces, including best-five emphasis, suit colors and T/10 preference.

The bold direction is accepted. The follow-up `BETA-FEATURE-SURFACE-REFRESH-001`
derives game, analysis and learning roles in `presentation-theme.mjs`, including
custom live previews and contrast-safe felt gradients. Hand and Scenario share
seat anchors with more top clearance, wider lower-side spacing and a tighter HU
felt. Training's idle Full Hand roster derives positions without creating a Hand.
Personal Understanding uses full width unless an active question needs the other
column; its small read-only map counts existing evidence statuses, not frequencies
or confidence. Welcome reuses the portraits as an explicitly decorative table,
offers four compact study paths, and makes Enter Riverline → Home the primary
action. Existing startup, suppression and manual-reopen behavior remain intact.

The final `BETA-DESIGN-CORRECTION-002` keeps rich green for game space, derives
charcoal analysis, active primary result, warmer learning and neutral evidence
roles from the existing theme owner, and uses restrained navigation/identity
edges. Hand and Scenario consume the same per-count geometry profile; felt has
no construction ellipses. Understanding groups original sentences by their
existing insight kind; its small map separately counts directly specified
pure/exact-mix evidence, excluding estimates and dominant-only answers. Home
auto-flows existing truthful sections upward. Portraits are **TEMPORARY BETA ART**
behind the existing asset lookup seam; appearance is not final art acceptance.
The accepted design direction is frozen pending independent Human Beta QA.

Detailed acceptance remains under `QA-BETA-DESIGN-CORRECTION-002`,
`QA-BETA-FEATURE-SURFACE-REFRESH-001` and
`QA-BETA-DESIGN-REFRESH-001`. This does not close earlier table, cards, audio,
composition, Personal, Opponent or Advanced Equity acceptance owners.

## 5. Information hierarchy and composition

Every workspace must make its primary job, next action, and principal result obvious. Analysis should generally present answer/verdict, concise reason, key facts, deeper detail, then provenance/limitations. Do not duplicate the same evidence across equally prominent panels.

A visible composition may fail acceptance despite technically valid geometry when it has obvious:

- orphan controls or almost-empty second rows;
- giant unexplained dead space;
- tiny controls inside oversized regions;
- poor visual balance or awkward alignment;
- unnecessary wrapping;
- weak information hierarchy or task emphasis;
- excessive equal-weight dark boxes;
- low-information panels consuming excessive area;
- dense critical information rendered too small;
- a layout preset that is materially worse than the default.

Whitespace must express hierarchy, not merely consume canvas. Density must materially change useful information rhythm or be simplified. A named layout preset must materially improve its named task.

### 5.1 Progressive explanation depth

Where a surface supports explanation, use one coherent depth model:

- **Facts:** dense structured facts, statistics, provenance, and uncertainty for direct inspection.
- **Explain:** concise, supported interpretation of what matters and why.
- **Coach / Summary:** cross-decision, cross-session, cross-range, or cross-profile synthesis only when enough structured evidence exists.

Advanced users may prefer a facts-only presentation. Natural-language explanation must not become mandatory filler, hide the underlying statistic, or imply evidence that the source does not supply. Changing depth changes presentation, never poker, strategy, Equity, range, opponent-model, or grading truth.

### 5.2 Shared interaction integrity

A reusable semantic feature has one semantic owner and one interaction language across every surface where it meaningfully applies. Each surface classifies the feature as applicable, intentionally deferred with an owner, or not applicable with a reason; consistency does not mean placing every feature everywhere.

Hover/focus inspection, hypothetical states, Save/bookmark, Randomize/Lock, card identity, Facts/Explain/Coach, provenance/uncertainty, unknown/unavailable, and expandable detail follow the [Interaction Grammar](INTERACTION_GRAMMAR.md). Consumers may adapt composition to their job but must not redefine the concept or reimplement poker mathematics.

## 6. Durable visible-product invariants

- **Card picker:** default cards are readable at 1080p without browser zoom; fix the default before adding micro-settings.
- **Transactional card-set editing:** supported Hand/Scenario and Equity card sets edit as a draft and commit once through Apply; Cancel/Escape/X/backdrop restores the prior set, and only a committed legal change reaches the owning surface's existing invalidation/readiness path. Analyze and Equity Dead Cards use one whole-set multi-select/toggle editor; `Clear all` changes only its draft until Apply. Resting Dead Cards retain ordinary Riverline slots without nested scrolling, and the overlay does not change underlying workspace geometry.
- **Analyze Scenario readiness:** Scenario remains an editable lossy draft, but only centrally validated coherent inputs reach `StrategyProvider`. Invalid chronology, action/facing dependencies, duplicate known cards, and basic numeric readiness fail closed with natural guidance; clearing later-street cards preserves only valid earlier state, and Scenario does not fabricate exact actor-relative economics.
- **Board:** five board cards remain one horizontal row on supported desktop layouts. Street grouping labels may sit above slots.
- **Card identity:** every visible known card exposes rank and suit identity across Hero/opponent cards, 2/4-color modes, T/10, themes, and RTL.
- **Sizing display:** presentation uses human poker precision rather than leaking internal floating-point decimals; canonical stored amounts remain exact.
- **Tutorial:** a completed/skipped tutorial version does not nag again unless explicitly restarted or intentionally versioned.
- **Save:** durable Save actions use one accessible bookmark affordance and an active saved state that is not color-only.
- **Layout preset:** each preset must improve task hierarchy; weak presets may be redesigned, renamed, consolidated, or removed.
- **Table Focus:** materially improves table and decision-relevant readability over Balanced; extra empty canvas around a small table is not success.
- **Density:** each mode has coherent visible value; do not add more modes to avoid fixing the existing choice.
- **Settings:** every actual preference appears in exactly one focused category; preview/test actions and system-derived status are not represented as stored preferences, and Learn Riverline remains the primary global help entry.
- **Training hint:** content is relevant to the actual street and state.
- **Control grid:** avoid orphan near-empty rows; four readable controls prefer 4×1 or 2×2 over 3+1.

## 7. UI states

Review is ephemeral presentation over a canonical Hand. Analyze handoff, leaving
its owning workspace, and an unavailable Review model use the shared Review
teardown: clear Review selection/model, restore History to the Hand rail, remove
Review visibility state, and preserve the canonical Hand. Returning to Hand
therefore restores its normal live/completed presentation without a hybrid mode.

Every meaningful feature defines default, loading/generating, empty/incomplete, blocked/invalid, unavailable-source, error/cancelled, and success/result states as applicable. Controls must visually and accessibly reflect actual state.

## 8. Responsive behavior

The minimum supported desktop viewport is 1366×768. Current repair/acceptance targets include that baseline, 1440×900, 1600×900, 1920×1080, 2560×1440, 2560×1600, 4K, and representative zoom. Existing 1024×768 findings are preserved as compact/mobile-responsive future evidence rather than current blockers. Mobile later receives a distinct composition rather than stacked desktop panels.

Structural CSS/no-overlap checks are evidence, not visual acceptance. Real-browser/human review remains required where hierarchy, balance, density, legibility, or aesthetics require judgment.

The supported Hand desktop grid reserves separate table and interaction-rail
columns; rail content scrolls within its own size containment. Stage facts wrap
according to available width rather than imposing a fixed internal minimum.

## 9. Localization, RTL, and accessibility

- stable visible copy enters the EN/RU/HE translation system;
- dynamic copy supports interpolation and units;
- use logical CSS properties while keeping deliberate poker-data LTR islands;
- preserve semantic controls/headings, visible focus, keyboard workflows, truthful ARIA state, contrast, non-color cues, reduced motion, and readable status/error announcements;
- translation/presentation code never alters poker logic.

## 10. Change boundary

A UI ticket must not modify poker math, Game Rules, StrategyProvider semantics, Training generation/grading, Equity math, state schemas, solver, or models unless explicitly approved. Visible feature tickets own their tutorial, localization, accessibility, responsive, reduced-motion, and visual-acceptance updates.
