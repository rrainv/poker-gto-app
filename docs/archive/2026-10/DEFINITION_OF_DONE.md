# Definition of Done

A ticket is complete only when all applicable items are satisfied.

## Scope and architecture

- outcome matches the ticket and owned backlog IDs
- no unrelated cleanup/features were introduced
- canonical authorities and dependency direction remain intact
- schema changes are explicitly approved, versioned, documented, and migrated
- future Product/Feature backlog remains possible

## Behavior and tests

- behavior changes have focused tests
- relevant full Node/Python/static gates were run
- test discovery/count changes are explained
- poker math uses invariant/property tests and preserves exact semantics
- UI work preserves PERF-001 invocation/invalidation contracts
- failures and unavailable tooling are reported honestly

## UI and accessibility

- changed states cover default/loading/empty/error/unavailable/result as applicable
- keyboard, focus, ARIA, RTL/logical properties, and long-copy behavior were considered when owned
- requested viewports/themes/languages were inspected when browser tooling exists
- visible work explicitly reviews hierarchy, whitespace, control grouping, orphan rows, density, scanability, task emphasis, information priority, visual balance, and obvious aesthetic regressions
- named layout/density modes prove useful composition rather than merely redistributing empty space
- structural CSS tests alone do not close a visual issue
- no-overlap and responsive-geometry checks cannot close hierarchy, balance, legibility, density, or aesthetic acceptance alone
- human/real-browser acceptance remains required wherever visual judgment matters
- when browser/manual QA is unavailable, status is `UNVERIFIED`, `PARTIAL`, or `STRUCTURAL ONLY`
- reusable semantic interactions follow `INTERACTION_GRAMMAR.md`, including keyboard/pointer equivalence and truthful hypothetical, unknown, unavailable, provenance, and uncertainty states where applicable

## Human acceptance and correction loops

Repeated human rejection can reveal a product-concept problem rather than another isolated implementation defect.

After approximately two rejections for the same underlying reason, explicitly reassess before another correction pass. Consider whether to simplify, remove a weak option, merge concepts, change the concept, split the true root cause, or accept a useful checkpoint with explicit Return Queue debt. This is a reassessment trigger, not a hard maximum on correction passes.

Report acceptance at the correct level:

- **Foundation acceptance:** architecture, correctness, or a reusable seam is useful.
- **Product acceptance:** the core interaction is genuinely useful to the user.
- **Polish debt:** the direction is worth preserving, but remaining refinement should not keep a bounded ticket open forever.

Foundation acceptance alone must not be reported as product acceptance. Accepted polish debt remains owned by `PRODUCT_RETURN_QUEUE.md` and, where issue-level evidence is required, `QA_BACKLOG.md`.

## Localization

- new user-facing copy uses or prepares stable translation keys where practical
- hardcoded copy added outside an i18n ticket is reported for the I18N backlog
- no ticket claims full localization unless EN/RU/HE rendering was verified

## Performance

- performance tickets report invocation/work reduction and credible measurements
- avoid brittle CI timing thresholds
- no hidden duplicate strategy/Equity/Training work is introduced

## Models/solver/experiments

When applicable:

- source data and game abstraction are documented
- seed/configuration/artifact/commit are reproducible
- convergence/reference quality is reported
- model/provider metadata is versioned
- exported runtime is compared with training runtime if an export exists
- compute time and spend are recorded
- no unsupported GTO/equilibrium claim is made

## Checkpoint / return-queue discipline

A checkpoint may be accepted before a subsystem is fully finished, but unfinished work must be durable and owned.

- any `CHECKPOINTED / INTENTIONALLY INCOMPLETE` outcome must create or update a row in `PRODUCT_RETURN_QUEUE.md` unless the report explicitly proves there is no remaining acceptance/debt
- known bugs accepted at checkpoint must stay open in `QA_BACKLOG.md` and be summarized in the return queue when they materially affect subsystem completion or release
- unavailable manual/browser/live-provider validation must not disappear from planning simply because structural tests are green
- deliberate temporary strategy/reference limitations need an explicit future owner/trigger when they matter to product quality
- the return queue is reconciled against `QA_BACKLOG.md`, `CURRENT_PHASE.md`, and `PRODUCT_BACKLOG.md` at roadmap syncs and before beta/release planning
- return items close only with accepted implementation, human/manual acceptance, live-provider validation, or explicit product-scope removal

## Report and Git

- significant files changed are listed
- focused and full verification results are listed
- manual/browser result is listed
- backlog IDs are marked closed/partial/deferred/regressed
- known limitations and next owner are stated
- checkpoint/return-queue items are created, updated, closed, or explicitly declared unaffected
- Git diff/status distinguishes ticket and pre-existing changes
- nothing was staged or committed by the agent unless explicitly authorized
