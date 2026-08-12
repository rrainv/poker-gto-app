# QA and Regression Specification

## 1. Goal

Protect poker correctness, architecture contracts, performance, and user-facing stability from agent-driven changes.

## 2. Required categories

### Poker/domain

- evaluator known answers
- exact and Monte Carlo Equity
- multiway ties
- pot/stack/contribution accounting
- legal actions and street transitions
- dead/duplicate/impossible cards
- Home and ClubGG deductions

### Strategy/application

- DecisionContext pricing semantics
- StrategyProvider/StrategyResult validation and normalization
- Playbook/Training/Matrix authority convergence
- source/provenance truthfulness
- deterministic heuristic behavior
- Scenario versus Hand isolation

### Training

- deterministic generation/replay
- 2–10 players and valid positions
- legal trajectory replay
- grading and stale/double/illegal protection
- no pre-answer leakage except explicit Study Preview

### UI/UX

- primary workspaces load and switch
- card picker replace/cancel behavior
- notifications do not cross workflows
- keyboard/focus/ARIA truthfulness
- empty/loading/error/unavailable/result states
- themes and Daylight contrast
- RTL and translation-length geometry
- requested desktop widths and zoom
- Product UI owned QA IDs

### Performance

- one main strategy resolution per decision update
- input coalescing
- hidden Matrix does not compute
- dirty surface renders on reveal
- no forced-layout restart
- single Training init and Equity readiness update

### Future model/provider

Only when present:

- versioned metadata
- input/output schemas
- normalization
- runtime agreement
- coverage/uncertainty
- source/reference validation

## 3. E2E smoke

At minimum:

1. open app
2. Playbook Scenario cards/context/recommendation
3. canonical Hand start/deal/action/chance
4. Matrix selection
5. Equity calculate/cancel/result
6. Training generate/answer/replay
7. Settings/theme/deck preference
8. language switch and RTL smoke
9. reload/persistence

## 4. Visual acceptance

For visual tickets, record:

- viewport
- theme
- language/direction
- state exercised
- screenshot or exact observation where practical

No browser means no claim of visual closure.

## 5. Agent rule

An agent must not claim completion if required tests were not run or if visual acceptance is unavailable and the issue is inherently visual. Report the exact limitation.
