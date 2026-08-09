# Product and UI Specification

## 1. Product principle

Riverline should feel like a serious poker analysis application.

Premium means consistency and reliability, not visual excess.

## 2. Core surfaces

- Playbook
- Win Probability / Equity
- Training
- Settings
- Hand/state analysis where present

## 3. Design system

Establish canonical tokens for:

- typography
- font sizes
- line heights
- spacing
- border radii
- surfaces
- borders
- primary/secondary actions
- status states
- shadows
- poker-specific colors

Do not invent one-off styles when an existing component/token exists.

## 4. UI states

Every meaningful feature should define:

- default
- loading
- empty
- invalid input
- calculation error
- unavailable model
- success/result

## 5. Responsive behavior

Test:

- desktop
- narrow desktop
- tablet
- mobile portrait

Do not allow critical strategy information to disappear on narrow screens.

## 6. Localization

All user-facing strings should use the translation system.

Avoid hardcoded text in components.

Translation changes must not modify poker logic.

## 7. Accessibility

Maintain:

- keyboard navigation
- visible focus
- adequate contrast
- semantic controls
- labels for inputs
- readable error states

## 8. UI change policy

A UI ticket should not modify:

- poker mathematics
- model training
- state representation
- evaluator
- equity engine

unless explicitly required and separately approved.
