# Product and UI Specification

## 1. Product principle

Riverline should feel like a serious poker analysis workstation.

Premium means consistency, reliability, clear hierarchy, honest provenance, and restrained interaction—not visual excess or casino-game styling.

## 2. Core surfaces

- Playbook Scenario Analysis
- canonical Hand Mode
- Range Matrix and descriptive range-category comparison
- Equity
- Training
- Guide
- Settings

## 3. Visual system

Use canonical tokens/components for:

- typography and line height
- spacing and density
- radii, borders, surfaces, and shadows
- controls, buttons, badges, pills, tabs, and focus
- status and poker-action colors
- cards and table visuals

Avoid one-off inline styles when an existing shared component can own the rule. Do not begin a stylesheet rewrite during bounded tickets.

## 4. Information hierarchy

Every workspace should make the next action and primary result obvious.

Analysis should generally present:

1. answer/verdict
2. concise reason
3. key facts/numbers
4. deeper detail
5. provenance and limitations

Do not duplicate the same strategy evidence across several equally prominent panels.

## 5. UI states

Every meaningful feature defines as applicable:

- idle/default
- loading/generating
- empty/incomplete input
- blocked/invalid
- unavailable source
- error/cancelled
- success/result

Controls must visually and accessibly reflect actual state.

## 6. Responsive behavior

Desktop repair targets:

- 1024×768
- 1280×900
- 1440×900
- 1600×900
- 1920×1080
- 2560×1440
- 2560×1600
- 4K and common zoom levels

Critical information must not disappear. Mobile will later use a distinct composition rather than merely stacking every desktop panel.

## 7. Localization and RTL

- all stable user-facing strings should enter the translation system
- dynamic errors/loading/result copy needs interpolation and unit support
- use logical CSS properties
- poker cards/matrices/amount sequences may remain naturally LTR inside RTL UI
- translation work must not alter poker logic

## 8. Accessibility

Maintain:

- semantic controls and headings
- visible focus
- keyboard workflows
- truthful ARIA state
- adequate contrast
- non-color cues
- reduced-motion support
- readable error/status announcements

## 9. UI change policy

A UI ticket must not modify poker math, StrategyProvider semantics, Training grading, Equity math, state schemas, solver, or models unless explicitly approved.

## 10. Product Lab boundary

Repair tickets fix current defects and hierarchy. Product Lab later adds layouts, themes, density modes, richer table presentation, and personalization. Feature Lab adds replay, persistence, Training review, ranges, and session tools.
