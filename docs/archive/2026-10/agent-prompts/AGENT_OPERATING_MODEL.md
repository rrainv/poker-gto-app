# Agent operating model

Riverline uses three roles. A single ticket may combine Explorer and Implementer when its scope is already approved.

## Explorer

Use for inspection-only audits or unresolved architecture.

Responsibilities:

- trace runtime/data flow
- identify canonical ownership
- inspect tests and current documents
- identify risks, ambiguity, and exact scope
- do not edit, stage, or commit

Output:

- evidence-backed findings
- proposed bounded plan
- missing evidence
- stop conditions

## Implementer

Use for an approved ticket.

Responsibilities:

- inspect enough to verify assumptions
- implement only ticket scope
- preserve named invariants and unrelated QA items
- add focused tests
- run required verification
- report and stop
- do not stage or commit

Do not require a separate Explorer approval when the prompt already approves implementation and no major contradiction appears.

## Reviewer

Use in a new chat for independent challenge.

Responsibilities:

- inspect the real diff and runtime path
- do not assume test count proves correctness
- look for hidden behavior changes, duplicate authority, stale code, missed edge cases, and weak tests
- distinguish blocking issues from future improvements
- do not modify files unless the review ticket explicitly becomes a repair ticket

## Repair loop

If manual QA or review finds a regression caused by the current ticket:

- remain in the same ticket chat
- provide screenshots/reproduction steps
- fix only the ticket regression
- rerun the ticket's focused and full gates
- do not create a new ticket number simply to finish acceptance

## Mathematics workflow

1. define semantics/invariants
2. characterize current behavior where needed
3. write targeted/property tests
4. implement
5. compare before/after
6. verify provenance and unsupported claims

Do not tune strategy percentages from intuition when reference data is absent.
