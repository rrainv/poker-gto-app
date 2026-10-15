# Riverline documentation

Executable code and passing tests are final implementation truth. If code contradicts a documented invariant, report it as a likely defect. Agents start at [AGENTS.md](../AGENTS.md) (minimum read set: that file plus the files a ticket names).

## Live set

- [North Star](NORTH_STAR.md): product direction, decisions, principles, milestones, workflow.
- [State](STATE.md): the one live status file (milestone, gates, ordered queue, recent work, open decisions).
- [Issue register](ISSUE_REGISTER.md): bugs, debt, pending acceptance and small wants (search by ID).
- [Terminology](TERMINOLOGY.md): EN/RU/HE terms, the i18n source of truth.
- [Idea bank](IDEA_BANK.md): ideas, not commitments; never required reading.

## Reference specs (read when a ticket names them)

- [Design system](project/DESIGN_SYSTEM.md): Style v4, tokens, components, composition, stability and acceptance.
- [Architecture contract](project/ARCHITECTURE_CONTRACT.md): canonical authorities and dependency direction.
- [Interaction grammar](project/INTERACTION_GRAMMAR.md): cross-surface interaction semantics and workspace behaviour invariants.
- [Capability guardrails](project/CAPABILITY_GUARDRAILS.md): authority rules and non-goals for future capabilities.
- [QA and regression](project/QA_AND_REGRESSION_SPEC.md): required test categories and smoke flow.
- Subsystem contracts in [project/](project/): Game Rules, DecisionContext, strategy source authority, Reference Pack and sources, Range Core and analysis, bluff/exploit, Equity, Training (planner, memory, intelligence), Review/Study Inbox, hand-history import, opponent policy, Saved and sync, accounts and authentication, Personal Strategy and ranges, Home, Home Game, audio/motion, tutorials.

## History

- [Archive](archive/README.md): superseded planning, agent prompts, capability dossiers, reports and research; never required reading. `archive/2026-10/INVARIANT_LEDGER.md` maps every archived rule to its current home.

Claims of GTO, equilibrium, CFR provenance, model accuracy, or exploitability require reproducible evidence and an authorized source capability.
