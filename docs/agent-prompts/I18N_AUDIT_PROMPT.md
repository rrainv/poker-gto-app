# I18N audit prompt

This work is diagnostics-first. Do not begin with a giant translation rewrite.

## Phase 1: runtime observability

Find:

- keys that exist but are not applied
- hardcoded user-facing strings
- missing-key fallbacks
- duplicate/conflicting keys
- dynamic copy that bypasses i18n
- incorrect language persistence
- RTL direction or logical-property failures
- malformed encoding/mojibake

Add development-time diagnostics where practical:

- missing-key reporting
- unused-key inventory
- current-language fallback reporting
- optional translation-length stress mode

Report before broad copy changes.

## Phase 2: architecture fixes

Fix key application, interpolation, units, dynamic errors/loading states, and RTL behavior without modifying poker logic.

## Phase 3: translation content

Perform bounded EN/RU/HE passes by workspace. Preserve poker notation where intentional. Validate real rendering after each workspace rather than editing every key at once.

Do not let translation work change DecisionContext, StrategyResult, Equity, Training grading, or poker semantics.
