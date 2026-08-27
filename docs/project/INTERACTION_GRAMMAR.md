# Riverline interaction grammar

This document defines durable cross-surface interaction integrity. It is a semantic product contract, not poker, strategy, Equity, range, Training, persistence, implementation-status, or execution-priority authority.

## Core rule

A reusable semantic feature has **one semantic owner and one interaction language** across every surface where the concept meaningfully applies.

This does not mean every feature appears everywhere. Each consumer classifies the concept as:

- **APPLICABLE NOW:** the existing surface can consume the shared meaning today;
- **DEFERRED — owner:** the concept is meaningful, but a named future capability must supply its data or interaction;
- **NOT APPLICABLE — reason:** the concept would not serve that surface's job.

A consumer may adapt composition, density, and disclosure to its job. It may not redefine the concept, create a parallel store, or reimplement poker mathematics.

### Importance, proximity, and interaction space

Space follows the importance of the information, action, or result; panels do not receive equal weight merely because they exist. Primary results and decision controls remain near the poker object or state they affect. Supporting configuration yields space after the primary action completes.

Side rails are first-class interaction space when they let users operate while preserving the central poker object. A rail is not automatically correct: it must keep controls readable, logically ordered, keyboard accessible, and useful at supported widths rather than becoming a narrow filing cabinet.

Useful content follows an upside-down-gravity rule: pack the primary object, current state, and next meaningful action toward the top before distributing secondary explanation or empty support regions below. The primary object appears before its supporting controls and prose in both visual and logical reading order.

One conceptual action has one primary call to action. Repeated buttons that start the same Training session, complete the same workflow, or submit the same state do not become more discoverable by competing with one another. Secondary routes may remain available, but they must be visibly secondary and preserve the same authority.

Inputs and results have separate spatial roles. Inputs stay coherent while work is being configured; after an action produces an output, the output gains hierarchy without destroying the user's input context. Broad information gathering comes before boundary precision: establish useful coverage and the main result before spending central space on narrow refinements.

Desktop acceptance uses browser zoom at 100%, not zoom reduction as a layout workaround. The primary acceptance viewport is 1920×1080, with 2560×1440 and 2560×1600 coverage and functional 1366×768 support. A specialized composition may adapt across those sizes, but it may not require sub-100% zoom to expose the primary object or action.

### Stable state transitions

Entering Replay, answering a Training decision, completing a Home Game session, expanding explanation, or producing an Equity result should preserve orientation and coherent geometry wherever the user job has not changed. A state change must make its effect visible through the resulting state, guarded confirmation, status, error, toast, or summary as appropriate.

Functionally correct state mutation is product-incomplete when the user cannot understand what changed, loses the primary object or controls, or experiences an unnecessary workspace recomposition.

### User-facing language

Explanatory copy must earn its space. Do not present obvious invariants as product benefits, use defensive filler to compensate for unclear interaction, or expose raw enum, schema, state, or code-derived identifiers to users. Stable product vocabulary, capitalization, localization, and accessible error language are part of the interaction contract.

## Shared semantic vocabulary

### Hover, focus, tap, and inspect

Meaningful mouse hover normally has a keyboard-focus equivalent. Touch receives an explicit tap/disclosure model rather than depending on hover emulation. An inspection affordance must not hide essential facts behind a pointer-only state.

### Hypothetical state

A hypothetical state is visibly and semantically distinct from actual canonical state. It identifies the changed assumption or card, preserves the actual context for orientation, and cannot silently mutate the source Hand, Scenario, range, or Saved object.

### Save and bookmark

Durable Save uses the `SavedStudyObject` application authority and the shared accessible bookmark language. A surface may offer Save only for a supported payload. It must not invent a parallel bookmark, note, review, or unsave model.

### Randomize and lock

`Lock` means preserve that exact known component while a requested randomization changes only unlocked components. Randomization respects canonical card identity, exclusions, visibility, and legality. A consumer cannot interpret Lock as persistence, Saved state, or a strategy constraint.

### Card identity and inspectability

Known cards retain one rank-plus-suit identity across DOM cards, SVG cards, text, previews, themes, 2/4-color choices, `T`/`10`, localization, and RTL. When a private card is legitimately known or revealed, its full rank+suit identity remains comfortably inspectable and is not substantially covered by seat panels, action treatments, card cradles, or other local chrome. Equivalent known-card consumers preserve that inspection floor while adapting composition to their surface. Hidden private cards remain hidden; presentation debt never weakens privacy. Internal IDs may travel through contracts but should not normally be raw user-facing prose.

### Facts, Explain, and Coach / Summary

- **Facts:** dense structured facts, statistics, provenance, and uncertainty.
- **Explain:** concise supported interpretation of what matters and why.
- **Coach / Summary:** cross-decision, cross-session, cross-range, or cross-profile synthesis only when sufficient structured evidence exists.

Facts-only use remains available. Explanation depth changes presentation, not underlying truth or authority.

When all three depths are available, they progress spatially from Facts to Explain to Coach rather than appearing as equal competing panels. The concise factual result stays closest to the primary object; deeper narrative and cross-context synthesis yield space and use explicit disclosure.

### Provenance and uncertainty

Reference, Personal Strategy, observed behavior, opponent model, inference, and canonical facts use consistent role names. Source identity, version, coverage, evidence quality, and uncertainty remain available in proportionate disclosure. A confidence-looking badge must not silently grant authority.

### Unknown and unavailable

`Unknown` means evidence has not established a value. `Unavailable` means the current source or contract cannot produce it. Neither becomes zero, false, empty, folded, excluded, or safe by presentation default.

### Expandable detail

Result summaries remain concise, with deeper supported facts available through a consistent disclosure pattern. Essential next actions, errors, provenance warnings, and accessibility information cannot be hidden merely to reduce visual density.

## Cross-surface applicability

| Shared concept | Hand / Replay | Analyze | Training | Equity | Personal Strategy | Saved / Home | Home Game |
|---|---|---|---|---|---|---|---|
| Hover/focus/inspect equivalence | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW |
| Hypothetical-state language | DEFERRED — Deep Hand Review | APPLICABLE NOW for explicit Scenario assumptions; deeper card outcomes deferred | DEFERRED — post-answer analysis | DEFERRED — Equity and Hand Analysis | NOT APPLICABLE to ordinary Matrix editing; explicit comparison previews may define their own owner | DEFERRED — approved study preview | NOT APPLICABLE to exact ledger edits |
| Shared Save/bookmark | APPLICABLE NOW for supported Hand/Spot payloads | APPLICABLE NOW for supported Spot payloads | DEFERRED — Saved Drill/Session payload owners | NOT APPLICABLE until an approved Equity-study payload exists | DEFERRED — Saved Range/Profile payload owner | APPLICABLE NOW for supported objects | NOT APPLICABLE; Home Game has its own session lifecycle |
| Randomize/Lock | DEFERRED — Random Spot Generator for study setup, never live canonical history | DEFERRED — Random Spot Generator | NOT APPLICABLE to the canonical Training generator's private curriculum contract | DEFERRED — Random Spot Generator | NOT APPLICABLE to ordinary evidence editing | NOT APPLICABLE to passive inspection | NOT APPLICABLE to money/session records |
| Card identity | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW when exact combos/cards appear | APPLICABLE NOW for supported previews | NOT APPLICABLE to the ledger; deferred to any approved linked-Hand preview |
| Facts / Explain / Coach | DEFERRED — Deep Hand Review | APPLICABLE NOW at factual/explanation foundation; richer synthesis deferred | DEFERRED — Training Intelligence summaries | DEFERRED — Equity and Hand Analysis | DEFERRED — Personal Strategy Intelligence | DEFERRED — Saved synthesis | APPLICABLE NOW for exact accounting explanation only; poker coaching is not applicable |
| Provenance/uncertainty | APPLICABLE NOW for source-aware review | APPLICABLE NOW | APPLICABLE NOW for source-aware feedback | APPLICABLE NOW for method/result provenance | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW for ledger/correction provenance |
| Unknown/unavailable | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW |
| Progressive detail | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW | APPLICABLE NOW |

The table describes semantic applicability, not implementation completeness or roadmap order.

## Card Outcome Preview example

The preserved `CARD-OUTCOME-PREVIEW-001` interaction demonstrates why shared grammar matters.

**Semantic owner:** shared hypothetical-card outcome analysis and presentation contract over the canonical evaluator. It is not owned independently by any renderer.

The shared behavior is:

1. Hover or keyboard focus a concrete out or hypothetical card.
2. Build a hypothetical canonical card state without mutating the actual state.
3. Show every available Hero card in that state, up to seven total cards.
4. Visually emphasize the evaluator-selected canonical best five.
5. Dim or de-emphasize unused cards without hiding relevant context.
6. Show the exact resulting hand and kicker structure.
7. Mark the preview as hypothetical and identify the added card.
8. Make keyboard focus functionally equivalent to mouse hover; define touch/click semantics before shipping on touch.
9. Do not imply Equity unless canonical Equity is separately calculated for that hypothetical state.

| Consumer | Classification | Reason / owner |
|---|---|---|
| Equity | DEFERRED — applicable | Primary concrete-out and runout consumer; owned by [Equity and Hand Analysis](capabilities/EQUITY_HAND_ANALYSIS.md). |
| Analyze | DEFERRED — applicable when concrete outs/runouts exist | Reuses the same outcome contract; no renderer ranking logic. |
| Deep Hand Review | DEFERRED — applicable | Supports selected hypothetical runout inspection without rewriting Replay. |
| Training post-answer analysis | DEFERRED — applicable | Available only after an answer when supported facts expose concrete outs. |
| Runout Explorer | DEFERRED — applicable | Natural full consumer of the same hypothetical-state contract. |
| Personal Strategy Matrix | NOT APPLICABLE | Ordinary preflop evidence inspection has no concrete board/runout outcome to preview. |

## Ownership and extension checklist

Before adding a reusable interaction to another surface:

1. identify the canonical semantic owner;
2. confirm the surface's classification and user job;
3. reuse the shared domain/application result instead of recomputing it;
4. define keyboard, focus, tap, RTL, localization, reduced-motion, loading, error, unknown, and unavailable behavior as applicable;
5. preserve logical DOM and assistive-technology meaning even when composition differs;
6. update the owning tutorial when the visible interaction is meaningful;
7. add cross-surface contract tests and perform real-browser/human acceptance where presentation judgment matters.

Related intent is preserved in the [capability index](capabilities/README.md). Current status and sequencing remain in the [Product Backlog](PRODUCT_BACKLOG.md), [Current Phase](CURRENT_PHASE.md), and [Roadmap](ROADMAP.md).
