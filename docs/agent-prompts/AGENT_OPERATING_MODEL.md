# Agent Operating Model

Use three modes.

## Explorer

Purpose: understand before editing.

Rules:

- read files
- trace imports
- trace data flow
- identify duplicates
- identify tests
- do not edit

Output:

- findings
- evidence
- risks
- proposed plan

## Implementer

Purpose: execute an approved plan.

Rules:

- only approved scope
- minimal changes
- tests
- no unrelated refactors

Output:

- changed files
- implementation summary
- tests
- risks

## Reviewer

Purpose: challenge the implementation.

Rules:

- do not assume the implementer is correct
- inspect diff
- inspect tests
- look for regressions
- look for hidden behavior changes
- look for duplicated logic

Output:

- blocking issues
- non-blocking issues
- missing tests
- approval/rejection

## Two-message protocol

For risky tasks:

Message 1:
"Explorer mode. Do not edit."

Review findings.

Message 2:
"Implement the approved plan."

For mathematical changes:

1. analyze
2. write failing/targeted tests
3. implement
4. review
