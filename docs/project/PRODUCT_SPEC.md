# Riverline Product and UI Specification

Last refreshed: August 25, 2026 (`DOCS-CAPABILITY-DOSSIERS-001`).

## 1. Product principle

Riverline is a serious personal poker learning workstation. Premium means consistency, reliability, clear hierarchy, honest provenance, restrained interaction, and excellent composition—not visual excess or casino-game styling.

**Functionally correct but visibly sloppy is a product defect.** No clipping, no overlap, and valid responsive geometry are necessary but do not by themselves establish product quality.

## 2. Current product surfaces

- **Home:** account/Guest-aware study hub, Continue, Saved/Recent/Review/Mistakes, Personal Strategy facts, and quick starts.
- **Hand:** canonical legal full-hand play, Table Presence, action dock, timeline, completion, and Replay.
- **Review:** shared decision-by-decision Hand and Full Hand Training review over canonical history.
- **Analyze:** Scenario or Hand decision analysis, explanation, evidence, provenance, Matrix, ranges, and structural board/blocker facts.
- **Training:** Varied, Focused, and Full Hand practice over canonical legal generation and source-aware grading/presentation.
- **Personal Strategy:** profile/mode Calibration, Matrix, Range Builder, and Range Teacher over one sparse evidence authority.
- **Equity:** canonical exact or seeded Monte Carlo Hold'em outcomes.
- **Saved:** local-first versioned Hand/Spot objects, annotations, review state, and detached Replay reopening.
- **Home Game:** separate exact-money cash-game organizer.
- **Guide:** durable current-product help.
- **Settings:** localization, accessibility, audio/motion, themes, density, layouts, cards, and account/profile entry points.

## 3. State-aware projection model

One canonical Hand/state may support different ephemeral compositions:

- **Play:** table, actor, legal decision, pot, stacks, and card state dominate.
- **Review:** timeline, selected Hero decision, comparison, and learning actions dominate.
- **Analyze:** ranges, explanation, evidence, provenance, and limitations dominate; table is supporting context.
- **Saved inspection:** compact passive preview supports a dense library/inspector workflow.
- **Calibration/Builder:** Personal Strategy evidence, uncertainty, editing, and correction dominate.

Presentation projections never become poker state, legality, accounting, strategy, Training, Replay, or persistence authority.

## 4. Visual system

Use canonical tokens and components for typography, spacing, density, radii, borders, surfaces, shadows, controls, buttons, badges, focus, poker actions, cards, and table visuals. Avoid one-off inline styles when an existing component owns the rule. Do not begin a stylesheet rewrite during a bounded ticket.

The no-casino aesthetic rejects avatars by default, spectacle, confetti, fake cinematic 3D, reward loops, and decorative casino clutter.

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
- **Board:** five board cards remain one horizontal row on supported desktop layouts. Street grouping labels may sit above slots.
- **Card identity:** every visible known card exposes rank and suit identity across Hero/opponent cards, 2/4-color modes, T/10, themes, and RTL.
- **Sizing display:** presentation uses human poker precision rather than leaking internal floating-point decimals; canonical stored amounts remain exact.
- **Tutorial:** a completed/skipped tutorial version does not nag again unless explicitly restarted or intentionally versioned.
- **Save:** durable Save actions use one accessible bookmark affordance and an active saved state that is not color-only.
- **Layout preset:** each preset must improve task hierarchy; weak presets may be redesigned, renamed, consolidated, or removed.
- **Table Focus:** materially improves table and decision-relevant readability over Balanced; extra empty canvas around a small table is not success.
- **Density:** each mode has coherent visible value; do not add more modes to avoid fixing the existing choice.
- **Training hint:** content is relevant to the actual street and state.
- **Control grid:** avoid orphan near-empty rows; four readable controls prefer 4×1 or 2×2 over 3+1.

## 7. UI states

Every meaningful feature defines default, loading/generating, empty/incomplete, blocked/invalid, unavailable-source, error/cancelled, and success/result states as applicable. Controls must visually and accessibly reflect actual state.

## 8. Responsive behavior

Desktop repair targets include 1024×768, 1280×900, 1440×900, 1600×900, 1920×1080, 2560×1440, 2560×1600, 4K, and representative zoom. Critical information must not disappear. Mobile later receives a distinct composition rather than stacked desktop panels.

Structural CSS/no-overlap checks are evidence, not visual acceptance. Real-browser/human review remains required where hierarchy, balance, density, legibility, or aesthetics require judgment.

## 9. Localization, RTL, and accessibility

- stable visible copy enters the EN/RU/HE translation system;
- dynamic copy supports interpolation and units;
- use logical CSS properties while keeping deliberate poker-data LTR islands;
- preserve semantic controls/headings, visible focus, keyboard workflows, truthful ARIA state, contrast, non-color cues, reduced motion, and readable status/error announcements;
- translation/presentation code never alters poker logic.

## 10. Change boundary

A UI ticket must not modify poker math, Game Rules, StrategyProvider semantics, Training generation/grading, Equity math, state schemas, solver, or models unless explicitly approved. Visible feature tickets own their tutorial, localization, accessibility, responsive, reduced-motion, and visual-acceptance updates.
