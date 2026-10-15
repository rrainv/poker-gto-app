# Invariant ledger (DOCS-RESET-001)

Every rule or invariant found in the documents that DOCS-RESET-001 archives, replaces or slims, with where it now lives (file › heading) or why it was dropped. Nothing silently disappears. Written in Part 1, completed in Part 2 (2026-10-15); see [Part 2 notes](#part-2-notes) at the end.

Abbreviations: **NS** = `docs/NORTH_STAR.md` · **AG** = `AGENTS.md` (new; the old one is archived as `AGENTS.2026-10-15.md`) · **ST** = `docs/STATE.md` · **IR** = `docs/ISSUE_REGISTER.md` · **TM** = `docs/TERMINOLOGY.md` · **DS** = `docs/project/DESIGN_SYSTEM.md` (new; the old one is archived as `DESIGN_SYSTEM.2026-10-03.md`) · **IG** = `docs/project/INTERACTION_GRAMMAR.md` · **IG+** = IG › "Workspace behaviour invariants" · **AC** = `docs/project/ARCHITECTURE_CONTRACT.md` · **AC+** = AC additions (§2 versions, §11.1 presentation rules, "Research, data and model rules" after §12) · **CG** = `docs/project/CAPABILITY_GUARDRAILS.md` · **QR** = `docs/project/QA_AND_REGRESSION_SPEC.md`.

**Dropped** means superseded by an owner decision (cited) or obsolete process; each drop says why.

---

## Summary

| Source group | Where its rules went | Superseded by an owner decision | Dropped as obsolete process/status |
|---|---|---|---|
| Agent docs (old AGENTS + 16 agent-prompts) | AG; AC+ §12 (research/data/model rules) | verification levels → tiers; hands-on cadence; Equity no-auto-calc; Home Game freeze | model/chat guide, ticket templates, status snapshots, parallel-agent detail |
| Core project docs (charter, product spec, DoD, git, governance) | NS, AG, DS, IG+ | generic rake (Table rules v1); alternate visible vs strategy work (M1 design-first); layout presets/density | owner's staging procedure, governance hierarchy, acceptance-level vocabulary |
| Live planning (current phase, roadmap, backlog, QA backlog, return queue) | ST, IR (every issue ID), NS, IG+ | XP/achievements rejection; polish-later sequencing; hands-on cadence | status vocabularies, dated snapshots |
| Old DESIGN_SYSTEM | DS | token-tuning colours (mockup palette, Style v4) | Analyze amendment-2 pixel specs (archived) |
| Capability dossiers (13 + index + legacy index) | CG (all authority rules and non-goals), NS / IDEA_BANK (intent) | XP/achievements; Game night freeze | dossier governance README |
| Reports, research, master plan | NS, CG, IG+, AC+, TM, kept specs | three fixed modes; old house-style terms; horizontal timeline / old table geometry | decision-state vocabulary |
| Kept reference specs (37) | in place (slim removes narrative only) | IG Equity auto-calc line | — |

No invariant about poker maths, money exactness, identity/lifecycle fencing, versioned schemas, PERF-001, Replay, Saved, Training Memory, Equity semantics, import rules or truth/claim rules was dropped.

---

## 1. Old `AGENTS.md`

| Rule | Now lives in |
|---|---|
| Read order (master context, workflow, current phase, spec, QA backlog, backlog, return queue, governance) | **Dropped (superseded):** minimum read set = AGENTS + ticket-named files (NS §10 Reading rules; AG › What to read) |
| Canonical architecture diagram and authorities list | AG › Architecture in one screen; AC §2; NS §5 |
| Deliberately absent: production ONNX/model runtime, remote strategy API, arbitrary solver-tree upload, synthetic legacy Training, second production Equity engine | AG › Architecture; NS §3.4; CG › Reference strategy evolution; AC §12 |
| 1 Inspect before editing; identify the canonical implementation | AG › Tickets / Architecture |
| 2 One ticket = one bounded outcome; no unrelated cleanup | AG › Tickets |
| 3 No duplicate poker, Equity, Training, strategy or state authorities | AG › Architecture; NS §5 |
| 4 UI never implements poker maths | AG › Architecture; AC §3 |
| 5 Poker-maths changes need invariant-focused tests | AG › Verification tiers |
| 6 Heuristic output is not GTO/CFR/Nash/exploitability evidence | AG › Architecture; NS §2; TM › Style rules |
| 7 Solver/model/data experiments isolated | AG › Architecture; AC §12, AC+ |
| 8 Preserve versioned contracts unless a ticket owns a migration | AG › Architecture; NS §5 |
| 9 Preserve PERF-001 in UI work | AG › Architecture; AC §11; NS §5 |
| 10 Use the QA backlog; don't silently forget, close or absorb unrelated IDs | AG › Tickets (register) |
| 11 Report missing browser/manual verification honestly | AG › Verification tiers, Report |
| 12 Don't stage or commit unless authorized | AG › Git and file safety |
| 13 Don't touch `.codex/config.toml`, `repo_dump.py`, `repo_dump.txt` | AG › Git and file safety (protected list) |
| 14 Stop if a change needs an unapproved migration, architecture rewrite or big scope growth | AG › Tickets (Stop and report) |
| 15 Tiny patches need no roadmap churn; accepted checkpoints update every affected live doc | AG › Docs you may touch; ST › Update rule |
| Ticket lifecycle: new ticket = new chat; regression of current ticket = same chat; reviewer/new subsystem = new chat; agent inspects, implements, tests, reports, stops; human reviews, accepts, stages, commits | AG › Roles, Report |

## 2. `docs/agent-prompts/`

### AGENT_MASTER_CONTEXT.md

| Rule | Now lives in |
|---|---|
| Canonical authorities (Game Rules, poker domain, DecisionContext v1/v1.1 → StrategyProvider → StrategyResult → ClaimPolicy; strong authority never self-declared; heuristic is comparative only; Training planner/generator/Memory roles; RangeAnalysisFacts and range-comparison-facts; presentation and experience contracts are ephemeral; Saved v1 authority and preview facts; Personal Strategy sparse immutable evidence; Home Game separate) | AC §2, §5, §6, §9, §10, §11.1; NS §5 |
| Scenario lossy, Hand canonical | AC §4; NS §2 |
| Randomization is shared interaction language, not a universal generator; no strategic/frequency/GTO claim | IG › Randomize and lock; CG › Random spot generator |
| New live Hands use snapshot-authoritative `poker-state/v2`; v1 historical | AC §2, §4.1 |
| `facingSizeBb` wager-to; `callAmountBb` exact incremental price | AC §5; NS §5 |
| Exact pot/SPR uses `currentPotBb`; live stack uses Hero/effective fields, never compatibility `potBb`/`stackBb` | AC §5; CG › Bluff and exploit |
| Exact preflop decision role distinct from fallback calibration | `DECISION_CONTEXT_SPEC.md` (kept) |
| v4 BB-vs-BTN policy is comparative, not validated reference truth | IR › RET-PREFLOP-001; `STRATEGY_SOURCE_AUTHORITY_SPEC.md` (kept) |
| Source identity, provenance, authority, coverage, capabilities, claims are distinct | AC §6; CG › Reference strategy evolution |
| Heuristic agreement/disagreement is not skill, accuracy, mastery, correctness, GTO or remediation; probability gap to the modal action is not a normative rule | AC §6, §9; NS §2, §4.4; CG › Training intelligence |
| Personal dominant-only evidence never fake 100% | NS §2; CG › Personal Strategy |
| Structural tests don't replace visual acceptance | AG › Verification tiers; DS › Mockups and acceptance |
| Natural-language north star (facts → explanation facts → claim permission → rendering; never authority; no fake certainty; keep claim strength) | AC §10.1; NS §7.14; CG › Natural language |
| Hand never randomizes committed history or opponent private cards; Equity never randomizes player count or dead cards | IG+ › Hand, Equity |
| Equity "never calculates automatically" | **Superseded:** NS §7.4 and §12 (auto when cheap, click when heavy); stale cancellation and no hidden heavy work kept (IG+ › Equity) |
| Accepted checkpoint behaviours (Scenario readiness, card clear semantics, Guide truth boundaries, Replay rail model, Home first use/Continue, Full Hand embargo, Same Spot, min-raise verification, all-in runout) | IG+; IG › Transactional card-set editing; AC §3–§4; NS §7.5–§7.8 |
| Home Game expansion freezes after safety fixes | **Superseded:** NS §7.9 (Game night rework in M2) |
| Hands-on workflow: after 2–3 visible tickets, a whole-product hands-on pass | **Superseded:** NS §9–§10 (owner QA per screen, monthly "use it by choice" check, owner design pass before M1 closes) |
| Deliberately retired list (ONNX inference, native strategy IPC, remote API, solver-tree upload, root legacy prototypes, duplicate Equity, synthetic Training, drag/drop layout editing) | AG › Architecture; NS §3.4, §11; DS › Identity (layout editor rejected); AC §12 |
| Budget ≈ US$75; no paid/cloud experiment without cap, runtime, artifact, success and stop criteria | NS §3.4 (Spend); AG › Git and file safety; AC+ §12 (Paid compute) |
| Dated status snapshots, execution order, read routes | **Dropped (obsolete status):** replaced by ST |

### CODEX_WORKFLOW.md

| Rule | Now lives in |
|---|---|
| One ticket, one bounded outcome; use register IDs | AG › Tickets |
| Chat lifecycle (new ticket new chat; regression same chat; review new chat; retire after commit) | AG › Roles |
| Execution classes (Mechanical Fast, Product Contract First, Correctness/Architecture, Heavy Future Design) and their meaning | AG › Tickets; NS §10 |
| Ask one to four questions before materially ambiguous product choices; not when specs answer it | AG › Tickets |
| Fast / normal / checkpoint verification levels | **Superseded:** tiers T0–T3 (NS §10; AG › Verification tiers) |
| Implementation loop: inspect, confirm canonical path, implement approved scope, focused tests, verify, report, stop | AG › Tickets, Report |
| No staging/committing; don't revert unrelated changes; no broad formatters | AG › Git and file safety |
| Protected files incl. `.gitignore` and helper artifacts | AG › Git and file safety |
| Inspect `git status --short` / `git diff --stat` before and after; report ticket vs pre-existing files | AG › Report (3, 7) |
| Windows/Git Bash pitfalls: LF-only, file-write tools not heredocs, never convert line endings, check `git diff --stat`, `git ls-files --eol` | AG › Git and file safety |
| Full gate commands and solver suite command | AG › Verification tiers (commands) |
| Don't silently skip a required command; report why | AG › Report (4) |
| Manual/browser acceptance: mark `UNVERIFIED`/`PARTIAL`/`STRUCTURAL ONLY`; never close a visual item on CSS tests | AG › Verification tiers; DS › Mockups and acceptance |
| Owner reports only failures from a checklist → unmentioned checks pass unless later changes create risk | NS §10 Acceptance |
| Maths work prefers invariant/property tests | AG › Verification tiers |
| Stop conditions (unapproved migration, conflicting canonical implementations, ambiguous poker rule, architecture replacement, paid/cloud action, unrelated work) | AG › Tickets (Stop and report) |
| New issue joins the ticket only if caused or blocking; else route it | AG › Tickets |
| Completion report items | AG › Report |
| Multi-agent: one writer; independent reviewers only when risk justifies; parallel writes only with disjoint files or worktrees; no competing heavy jobs | AG › Roles (one writer, Review when risk justifies); **parallel-agent detail dropped** as obsolete (NS §10: Claude Code is the only writer, never concurrent) |
| Reasoning economy; ~2 same-cause rejections → reassess; batch cheap related fixes | AG › Tickets; NS §10 Acceptance |
| Prompt efficiency: repo docs own invariants; tickets name only at-risk invariants | AG › What to read ("Tickets carry their own context") |

### Other agent prompts

| Source › rule | Now lives in |
|---|---|
| AGENT_OPERATING_MODEL › Explorer / Implementer / Reviewer roles | AG › Roles (Work, Review) |
| AGENT_OPERATING_MODEL › Repair loop stays in the same ticket chat; rerun gates | AG › Roles |
| AGENT_OPERATING_MODEL › Mathematics workflow; never tune strategy % from intuition without reference data | AC+ §12 (Maths workflow) |
| MODEL_AND_CHAT_GUIDE › GPT model table, `.codex/config.toml` edits per ticket | **Dropped (obsolete):** NS §10 (Claude Code work sessions; each ticket states suggested model/effort). `.codex/config.toml` stays protected (AG) |
| README (agent-prompts) › prompt-size policy; maintenance rules for live docs | AG › What to read, Docs you may touch; ST › Update rule |
| REVIEW_PROMPT › 12-point review checklist (scope, unrelated changes, second authority, UI maths, maths semantics, provenance honesty, behavioural tests, test discovery shrink, PERF, visual verification, a11y/RTL/states, protected files) | AG › Roles (Review) and Report; the checklist items are each covered by AG rules. **Checklist text itself dropped** (reviewers apply AG + ticket) |
| TICKET_TEMPLATE / TASK_TEMPLATE / MASTER_AGENT_PROMPT / SESSION_START_PROMPT | **Dropped (obsolete templates):** NS §10 Tickets + AG |
| CLOUD_BENCHMARK_PROMPT › approval, workload/commit/baseline/hardware/max time/max spend/artifacts/criteria; identical short workloads; never unbounded or auto-scaling | AC+ §12 (Paid compute); NS §3.4 |
| DATA_PIPELINE_PROMPT › trace targets; heuristic ≠ CFR; generator requirements; no training before validity | AC+ §12 (Data) |
| I18N_AUDIT_PROMPT › diagnostics first; translation never changes DecisionContext/StrategyResult/Equity/grading | TM › Style rules (translation never changes meaning); **phase procedure dropped** (process, not a rule) |
| PREFLOP_MODEL_PROMPT › model requirements; never GTO without evidence; ONNX optional | AC+ §12 (Models); NS §3.4 |
| PRELFLOP_SOLVER_DESIGN › read existing solver first; 11 documentation items; no extrapolation; isolation | AC+ §12 (Solver extensions) |
| UI_STABILIZATION_PROMPT › repair before adding; no poker/schema changes in UI tickets; PERF-001; prefer shared tokens, no stylesheet rewrite; 1366 minimum + representative widths; 1024 future; HE/RTL and long copy; no visual closure without live check | AG; DS › Mockups and acceptance, Cascade contract; NS §5 (no whole-stylesheet rewrite) |

## 3. Core project docs

### PROJECT_CHARTER.md

| Rule | Now lives in |
|---|---|
| Personal learning workstation, not "smaller GTO Wizard" | NS §1 |
| Selectively dense; the job owns the hierarchy (Play, Review, Analyze, Saved, Calibration) | DS › Identity and principles (state-aware compositions) |
| No GTO/CFR/Nash/EV/optimality claims without evidence and capability; source identity grants no authority | NS §2–§3; AC §6 |
| Preflop gets the most accuracy effort; postflop transparent approximation; multiway separates correct Equity from approximate strategy | NS §3 (tiers, baseline priority) |
| Competitive Reference Gate (ADOPT/ADAPT/DIFFERENTIATE/REJECT); evidence not authority; never copy proprietary charts, matrices, branding, text or assets; manual observations stay private research | NS §7.18 (competitive pass, never copy); CG › Reference strategy evolution; IR › WANT-COMPETITIVE-PASS |
| Supported environments: 2–10 players; stacks 10–500 bb; Home no rake; ClubGG 0.1 bb per seated player outside the contestable pot; no generic percentage/capped rake unless a new rules decision | `GAME_RULES_V1_SPEC.md` › Product rules for setup and legality; **generic rake superseded by decision:** NS §6.1 (Table rules v1 with rake %, cap, preflop rule, M2) |
| Runtime: vanilla JS/CSS; browser without Python; thin Electron; no model loader/remote API/tree upload | NS §1, §3.4; AG › Architecture |
| Engineering principles (truth first; one authority; small reversible tickets; invariant tests; no unrelated cleanup; no UI maths; provenance; Scenario/Hand; structural ≠ visual; sloppy composition not finished; git history is the archive; progressive disclosure; alternate visible quality with strategy work) | AG; NS §5; DS › Identity; archive README (git history). "Alternate visible quality with strategy work" **superseded** by NS §9 (M1 design-first, polish before heavy features) |
| Long-term branches (play/review, reference, training, Personal Strategy, opponents, Saved, analysis, accounts, Home Game, platform, PLO) | NS §7, §9, §7.18 |
| Budget ≈ US$75 and paid-experiment criteria | NS §3.4 |

### PRODUCT_SPEC.md

| Rule | Now lives in |
|---|---|
| Premium = consistency, hierarchy, honest provenance, restraint; functionally correct but sloppy is a defect | DS › Identity and principles |
| Current product surfaces list | ST › What exists today |
| State-aware projection model; projections never authority | DS › Identity; AC §11.1 |
| Theme resolved before visible content; prepaint cache derivative only, canonical fallback; custom colours keep source values | DS › Themes › Custom themes and the table |
| Portraits optimized; temporary art replaceable | DS › Identity (TEMPORARY BETA ART) |
| `setup_preview` content and Start as creation boundary | IG+ › Hand |
| Rake/collection choices; presets never rules authority; legacy `gameMode` aliases | `GAME_RULES_V1_SPEC.md` › Product rules for setup and legality |
| Ante contribution markers from the ledger | IG+ › Hand |
| Public-card and showdown randomization are draft-only; committed streets never re-randomized | IG+ › Hand |
| Use canonical tokens/components; no one-off inline styles; no stylesheet rewrite in a bounded ticket | DS › Cascade contract; NS §5 |
| No-casino aesthetic; portraits are appearance, never behaviour or real-person evidence | DS › Identity; NS §7.13 |
| Shared study presentation grammar; colour never grants strategy authority | DS › Identity (colour never grants authority) |
| Table cast session-local, separate from policy | IG › Fictional table identities (kept); CG › Opponent intelligence |
| Ranges & runouts disclosure never starts computation on opening | IG › Expandable detail (kept); IG+ › Equity |
| Incomplete Analyze shows readiness reason and an input action | IG+ › Analyze |
| Training feedback/focus transfer; Full Hand embargo | IG+ › Training |
| Review foregrounds observed action, intent, actual comparison role; heuristic never labelled reference | IG+ › Replay and Review |
| Personal Understanding: one Tab stop + arrow keys; no completion % or inferred exact frequency | NS §7.1 (no fake % complete); `PERSONAL_STRATEGY_INTELLIGENCE_V1_SPEC.md` (kept) |
| Primary job/next action/result obvious; answer → reason → facts → detail → provenance; no duplicate evidence panels | DS › Composition principles (9) |
| Composition failure list | DS › Comfort contract |
| Progressive explanation depth Facts / Explain / Coach | IG › Facts, Explain, and Coach (kept) |
| Shared interaction integrity (one semantic owner; applicable / deferred / not applicable) | IG › Core rule (kept) |
| Durable visible-product invariants: card picker readable at 1080p; transactional editing; Scenario readiness; board one row; card identity; sizing precision; tutorial no nag; Save bookmark non-colour; layout preset must improve its task; Table Focus improves readability; density modes coherent; Settings one category per preference; Training hint relevant; control grid no orphan rows | IG+ (Hand, Analyze, Training, Home/Saved/Settings); IG › Transactional card-set editing, Card identity (kept); DS › Comfort contract (control grid). Layout presets/density: **superseded** by NS §11 (Comfortable/Compact rejected) and DS (only useful presets survive; IR QA-HANDSON-005) |
| Review teardown; every feature defines its states | IG+ › Replay and Review; IG+ › Home, Saved, Settings |
| Responsive: 1366 minimum; target widths; 1024 future; mobile distinct; Hand grid reserved columns | DS › Mockups and acceptance; Hand grid detail **dropped** (implementation detail superseded by the Hand foundation pass; code keeps it) |
| L10n/RTL/a11y list | DS › Languages, RTL and accessibility; TM |
| UI tickets never change poker maths/rules/strategy/Training/Equity/schemas/solver; visible features own tutorial, i18n, a11y, responsive, reduced motion, visual acceptance | AG › Architecture, Verification tiers |

### DEFINITION_OF_DONE.md

| Rule | Now lives in |
|---|---|
| Outcome matches ticket and owned IDs; no unrelated work; authorities intact; schema changes approved/versioned/migrated | AG › Tickets, Architecture |
| Focused tests; required gates; explain test-count changes; invariant tests for maths; PERF-001; report failures honestly | AG › Verification tiers, Report |
| UI states, keyboard/focus/ARIA/RTL/long copy; requested viewports; review hierarchy, whitespace, density, balance; structural tests never close visual issues | DS › Comfort contract, Languages, Mockups and acceptance; IG+ (states) |
| ~2 same-reason rejections → reassess (simplify, remove, merge, change concept, accept with debt) | AG › Tickets; NS §10 |
| Acceptance levels: foundation vs product vs polish debt; foundation acceptance isn't product acceptance | NS §10 Acceptance ("human acceptance is its own evidence"); IR legend (Pending acceptance vs Fixed). **Three-level vocabulary dropped** (simplified status set in IR) |
| Localization: new copy uses translation keys; no claim of full localization without EN/RU/HE rendering | DS › Languages; AG › Verification tiers |
| Performance tickets report invocation reduction; no brittle timing thresholds; no hidden duplicate work | AC §11; IR › RET-TEST-INFRA-001 |
| Models/solver: data, abstraction, reproducibility, convergence, versioned metadata, runtime agreement, spend; no GTO claims | AC+ §12 |
| Checkpoint/return-queue discipline (unfinished work durable and owned; known bugs stay open; unavailable validation never disappears; close only with evidence) | IR header ("Close only with evidence"; pending-acceptance section G) |
| Report and git: files, verification, manual result, ID statuses, limitations, git status, nothing staged | AG › Report |

### GIT_WORKFLOW.md

| Rule | Now lives in |
|---|---|
| One ticket, one reviewable commit; agent never stages/commits; human commits after acceptance | AG › Git and file safety; NS §10 |
| Never `git add .`/`-A`/`--all`; stage exact ticket paths; no exclusion-based broad add | AG › Git and file safety |
| Protected files; identify pre-existing dirty paths | AG › Git and file safety, Report |
| Human staging inspection commands, protected-file check, commit message style | **Dropped (owner's own procedure)**; the owner commits per NS §10. Archived file keeps the commands |
| Regressions before commit fixed in the same chat; after commit a named repair ticket | AG › Roles |

### DOCUMENTATION_GOVERNANCE.md

| Rule | Now lives in |
|---|---|
| Authority hierarchy (code/tests → stable contracts → live state → dossiers → agent context → history) | NS header (order of reference); code-vs-doc rule: NS ("If code contradicts an invariant, report it as a likely defect") |
| File names grant no authority | Archive README (archived material is never an instruction) |
| Ownership of each planning doc | **Superseded:** ST (status), IR (issues), NS (direction) |
| Coordinated updates on accepted checkpoints | ST › Update rule; AG › Docs you may touch |
| Historical material must be labelled with a date and current authorities | Archive README |
| No second roadmap/backlog/QA list/Saved model/architecture authority in a prompt, report, README or chat | AG › Docs you may touch |
| Capability recovery is not automatic revival; only the backlog accepts and only current phase sequences | IDEA_BANK › How ideas move; ST (queue) |

## 4. Live planning docs

| Source › rule | Now lives in |
|---|---|
| CURRENT_PHASE › status vocabulary | **Dropped (simplified):** IR legend; ST tables |
| CURRENT_PHASE › immediate execution order, resume map | **Superseded:** ST › Ordered queue (from the M1 plan) |
| CURRENT_PHASE › Accepted foundation (architecture that must not be duplicated) | AC §2–§11; NS §5; AG |
| CURRENT_PHASE › accepted checkpoint behaviours (Core Flow, Replay rail, Training composition, Equity composition, Range UX, First-use Home, Saved visual, all-in runout, Guide, foundational gates 1–13) | IG+; IG; AC; NS §7; CG; `HOME_GAME_ORGANIZER_SPEC.md` + `GAME_RULES_V1_SPEC.md` additions |
| CURRENT_PHASE › min-raise verification examples | `GAME_RULES_V1_SPEC.md` › Product rules for setup and legality |
| CURRENT_PHASE › Home Game hard delete/import deferred; Guest runtime-only | IR › RET-HOMEGAME-001; NS §7.9; `HOME_GAME_ORGANIZER_SPEC.md` (kept) |
| CURRENT_PHASE › Controls First and Comfortable/Compact removed | NS §11; DS › Identity |
| CURRENT_PHASE › Accounts: live Supabase/RLS and two-profile acceptance before beta | IR › RET-ACCOUNT-001…003; NS §7.11 |
| CURRENT_PHASE › Cross-cutting acceptance (visible features own tutorial/i18n/a11y/reduced motion/responsive/visual; structural ≠ visual; IG semantics; PERF-001; rejection → reassess) | AG › Verification tiers, Tickets |
| CURRENT_PHASE › hands-on pass after 2–3 visible tickets | **Superseded:** NS §9–§10 |
| ROADMAP › learning loop and distinct roles | NS §1, §2 |
| ROADMAP › sequencing principles (bounded-provider gate before normative Training; durable evidence before longitudinal claims; repair before expanding; opponents after foundations; release/mobile/PLO later) | NS §3, §4, §9 (M1 → M3), §7.18 |
| ROADMAP › don't repeatedly polish intermediate surfaces ahead of reference/learning work | **Superseded:** NS §9 (M1 design-first; polish before heavy features, owner 2026-10-14) |
| ROADMAP › security/data-integrity blockers may interrupt the sequence | NS §9 scope rule (P0/P1 fixes allowed); IR gate 1 |
| ROADMAP › mobile distinct composition; PLO separate domain | DS › Mockups and acceptance; NS §7.18 |
| ROADMAP › priority rule (documentation alone never creates priority; subjective polish can't be an endless loop) | IDEA_BANK › How ideas move; AG › Tickets (rethink after ~2 rejections) |
| PRODUCT_BACKLOG › permanent rules (distinct roles; UI/NL never invent maths; claims need authority; sloppy = defect) | NS §2; AC; DS |
| PRODUCT_BACKLOG › capability status per domain | ST › What exists today; IR §G, §H |
| PRODUCT_BACKLOG › open product decisions | ST › Open decisions (D-22 and others); NS §13 |
| PRODUCT_BACKLOG › "XP/badges/levels/achievements rejected by default"; restrained goals/streaks | **Superseded:** NS §7.12, §11c, §12 (achievements and progression reopened with guardrails; streaks dropped) |
| PRODUCT_BACKLOG › Home never invents accuracy, mastery, streaks or history | IG+ › Home; NS §7.8 |
| PRODUCT_BACKLOG › authentication never silently enables upload; useful offline | CG › Saved knowledge; NS §7.11 |
| PRODUCT_BACKLOG › current settlement is deterministic, not a selected Fewest Transfers/Banker preference | CG › Game night evolution; NS §7.9 (fewest transfers chosen for M2) |
| PRODUCT_BACKLOG › pull-forward rule | IDEA_BANK › How ideas move |
| QA_BACKLOG › every row | IR (all ~280 IDs present; open rows in A–H, closed in I) |
| QA_BACKLOG › update rules (stable IDs, evidence, close only with evidence) | IR header |
| RETURN_QUEUE › every RET row | IR (open rows A–H; closed rows in I) |
| RETURN_QUEUE › release gates (RETURN-BEFORE-BETA closed or removed; no hidden security issue behind fake adapters; human Firefox acceptance of major flows; truthful limitations; no release on private GTOW benchmark data; critical regressions block release) | NS §9 gates and §7.11 (legal documents before sharing); IR §H (accounts); CG › Reference strategy evolution (no proprietary data). "No release may depend on private GTOW benchmark data": CG (no copying proprietary strategy data) + `REFERENCE_BENCHMARK_SPEC.md` §13 (kept) |
| RETURN_QUEUE › dynamic update rule | IR header; ST › Update rule |

## 5. Old `DESIGN_SYSTEM.md`

| Rule | Now lives in |
|---|---|
| Owner decisions: themes customizable, role tokens only, one accent primary per view, selection by underline not fill, existing icons/cards/felt unchanged by restyling, provenance distinct from aggressive action | DS › Themes and colour, Components, Identity; NS §8 |
| Cascade contract (token block, component layer, surface sections, relocated section; primitives directly; no `!important`; no static `data-i18n` on rewritten text) | DS › Cascade contract |
| Type scale, 12 px floor, exclusions | DS › Type › Scale |
| Accent never a text-hierarchy colour; verdict sentence case primary colour; action text roles | DS › Themes (colour use); Type (hierarchy) |
| Weight roles (code values) | DS › Type › Weights (target 650 vs code 600 stated) |
| Font family; tabular numbers; mono for technical strings only | DS › Type |
| Spacing, radius, elevation, control geometry tokens | DS › Layout › Spacing and geometry |
| Colour roles table; contrast rules | DS › Themes › Role tokens |
| Midnight = mockup palette values; pinned roles; status bases; Graphite/Daylight accent facts | DS › Themes › Midnight, Daylight |
| Token tuning (B colours, deeper accents, C headings) | **Dropped (superseded history):** Midnight replaced by the mockup palette (old DS itself), Style v4 (NS §8). Custom-theme derivation numbers and "preset text roles measured against painted surfaces" kept: DS › Custom themes |
| Prepaint cache version bump | DS › Custom themes (startup) |
| Components table | DS › Components › Code inventory |
| Shell (SHELL-001) contract | DS › Shell (SHELL-001) |
| List and inspector (SAVED-COMPOSITION-002) | DS › List and inspector |
| Composition principles 1–8 | DS › Composition principles |
| Analyze (ANALYZE-COMPOSITION-001) containers, rail, Hand context, header, decision view, fact table, Explain, source badge once, matrix, spot table | DS › Analyze (summarised; Explain collapsed by default kept) |
| Analyze amendment 2 pixel patterns (mix rows 74/1fr/48, 92 px value column, rail card sizes, stepper geometry, disclosure row style) | **Dropped from the live contract (implementation detail of a screen being re-done in Style v4, NS §8):** kept in code and in the archived `DESIGN_SYSTEM.2026-10-03.md`. Fact-cell omission rule and calm loading kept (DS › Analyze) |
| Verdict dominance (20 points / 5%, two states, ties by provider order) | DS › Verdict dominance; NS §7.3 |
| Component sheet (dev only) | DS › Component sheet |
| Migration status | DS › Components (pointer to IR DS-FOUNDATION-005) |

## 6. Kept specs: changes only

| Spec | Change |
|---|---|
| `INTERACTION_GRAMMAR.md` | all rules kept; preambles folded; "Equity … no automatic calculation" **superseded** by NS §7.4 (marked in place); shell help-panel/tab order moved to DS › Shell; workspace behaviour invariants added (IG+) |
| `ARCHITECTURE_CONTRACT.md` | all rules kept; version list corrected to code (PokerState v3, Game Rules v2, Replay source v3: verified 2026-10-15); AC+ additions |
| All other kept specs (see MOVE_PLAN §5) | rules stay in place under their headings; slim removes only narrative, inventories, measurements and dated preambles |

## 7. Capability dossiers

| Dossier | Rules (authority/provenance and non-goals) | Product intent / ideas / open questions |
|---|---|---|
| LEARNING_EVIDENCE_FOUNDATION | CG › Shared, Learning evidence | NS §4.2 (evidence sources); archived |
| NATURAL_LANGUAGE_INTELLIGENCE | CG › Natural language; AC §10.1 | NS §4.5, §7.14 |
| REFERENCE_STRATEGY_EVOLUTION (incl. accepted REFERENCE-PACK-001 decisions) | CG › Reference strategy evolution; `REFERENCE_PACK_V1_SPEC.md` (kept) | NS §3 |
| EQUITY_HAND_ANALYSIS | CG › Equity and hand analysis | NS §7.4; IDEA_BANK |
| BLUFF_EXPLOIT_ANALYSIS | CG › Bluff and exploit analysis | NS §7.3 (bluff teaching M3) |
| OPPONENT_INTELLIGENCE | CG › Opponent intelligence and bots | NS §7.13 |
| DEEP_HAND_REVIEW | CG › Deep hand review | NS §7.6 |
| TRAINING_INTELLIGENCE | CG › Training intelligence ("no XP/badges/achievements by default" **superseded**, NS §7.12/§12) | NS §7.2 |
| PERSONAL_STRATEGY_INTELLIGENCE | CG › Personal Strategy intelligence (+ 002R integration prerequisites) | NS §7.1 |
| RANGE_EVOLUTION | CG › Range evolution | NS §7.18 (Range Evolution later) |
| SAVED_KNOWLEDGE_AND_SHARING | CG › Saved knowledge and sharing | NS §7.7, §7.18 |
| HOME_GAME_EVOLUTION | CG › Game night evolution ("expansion freezes" **superseded**, NS §7.9) | NS §7.9 |
| RANDOM_SPOT_GENERATOR (incl. bounded stack randomization rule) | CG › Random spot generator | NS §6.2 |
| capabilities/README (dossier vs backlog roles) | **Dropped (obsolete governance)**: dossiers archived | — |
| LEGACY_ID_INDEX (PROD-* recovery map) | archived intact; searchable at `docs/archive/2026-10/capabilities/LEGACY_ID_INDEX.md` (test retargeted) | — |

"Preserved interactions and microfeatures", "Suggested implementation slices", "Competitive lessons" and "Open questions" sections are product ideas, not rules: covered by NS §7 and IDEA_BANK in direction, full text archived.

## 8. Reports, research and historical plans

| Source › rule | Now lives in |
|---|---|
| HANDS_ON_PRODUCT_REVIEW › product principles learned (space by importance; rails as first-class interaction space; no unnecessary recomposition; controls near their object; copy earns its space; hierarchy and icons for text-heavy surfaces; shared randomization; no raw enums; broad evidence before boundary refinement; outputs dominate after an action; transitions must be understandable) | DS › Layout (Structure), Stability, Copy, Composition principles; IG (kept) › Importance, proximity; CG › Personal Strategy |
| HANDS_ON_PRODUCT_REVIEW › 59 findings and dispositions | IR (open ones via RET-HPR-*, QA-HANDSON-*); archived for evidence |
| HANDS_ON_PRODUCT_REVIEW › open design questions | **Superseded** by later owner decisions in NS §7 and the mockup rounds (ST › Open decisions) |
| MASTER PLAN › LOCKED Personal Strategy: per-profile calibration; multiple named profiles; dominant ≠ 100%; mixed entry available; Training evidence opt-in per session with separate provenance; conflicts preserved and clarified; RFI first; local-first private exportable | NS §2, §4.3, §7.1; CG › Personal Strategy |
| MASTER PLAN › "start with exactly 3 named modes per profile" | **Superseded** (already in PERSONAL-STRATEGY-INTELLIGENCE-001): arbitrary Games and Approaches (NS §7.1; CG "don't force exactly three Approaches") |
| MASTER PLAN › protect the polished baseline; additive isolated subsystems; failed experiments removable | NS §5 (bounded extractions, no rewrite); AG (one bounded outcome) |
| MASTER PLAN › performance budgets (§15.1) | `PERSONAL_STRATEGY_FOUNDATION_SPEC.md` › Isolation, activation and performance (locked smoothness rules) |
| MASTER PLAN › integration gates 1–6 (Personal Strategy becomes a provider only after domain, workflow, durability, inference, mode-relationship gates) | CG › Personal Strategy (002R integration prerequisites) |
| MASTER PLAN › tutorial policy (every visible feature owns its tutorial) | AG › Verification tiers; DS |
| MASTER PLAN › decision-state vocabulary (LOCKED/PLANNED/…) | **Dropped (obsolete)**: NS milestone tags |
| PERSONAL_STRATEGY_002R_REVIEW › architecture corrections P0–P2 | CG › Personal Strategy (integration prerequisites) |
| TABLE_PRESENCE brief › presentation never authority; application decides projection; never in Saved/Replay; renderer never manufactures actions; Bet/Raise never submits silently; chip count decorative; no fake empty seats; important facts never hidden for cleanliness; motion never owns truth; transient states never artificial waits; mute never removes visual change | AC §11.1 + AC+; IG+ › Hand; DS › Motion |
| TABLE_PRESENCE brief › geometry numbers, seat hierarchy weights, horizontal timeline | **Superseded:** vertical rail accepted (NS §5, §7.6); table size per DS (Style v4 kit); numbers archived |
| L10N_001 research › evidence table | archived (evidence); decisions in TM |
| LOCALIZATION_STYLE_GUIDE › house style (рендж, Фолд, велью, контбет; Разбор/ניתוח) | **Superseded** by the owner's terminology sheet (TM; decided 2026-10-07); conflicts listed in TM › Applying this sheet; Analyze naming → ST D-19 |
| LOCALIZATION_STYLE_GUIDE › voice, invariant tokens, Hebrew punctuation, numbers, theme names, examples | TM › Style rules kept |
| CURRENT_REPO_AUDIT › deliberately absent list | AG › Architecture; NS §3.4; DS › Identity |
| BETA_BLOCKER_REPAIR001 report › AUD-01 accounting compatibility | `GAME_RULES_V1_SPEC.md`, `SAVED_STUDY_OBJECTS_SPEC.md`, `TRAINING_MEMORY_V1_SPEC.md` AUD-01 sections (kept, folded) |
| RANGE_CAL_002A/B/C reports › accepted limitations | `ADAPTIVE_RANGE_CALIBRATION_SPEC.md`, `RANGE_INFERENCE_SPEC.md` (kept) › Limitations |
| REFERENCE_INTEGRITY_RECOVERY001 report › never rebuild a renamed fake reference; acceptance never self-declared; hash ≠ rights; historical records keep answer-time evidence | NS §2; IR › RET-REFERENCE-PACK-001; ST › D-20 |
| REFERENCE_SOURCE_ACQUISITION research › HRC licensing finding; acquisition and validation gate | NS §3.4 (solver findings, licence that clearly allows redistribution); `REFERENCE_SOURCE_FOUNDATION_V1_SPEC.md` (kept) |
| REFERENCE_BENCHMARK_FIRST_CAPTURE_PLAN › capture rules (diagnostic cases only; no copying outputs) | `REFERENCE_BENCHMARK_SPEC.md` §9, §13 (kept) |

## 9. Incoming drafts

| Draft | Now lives in |
|---|---|
| NORTH_STAR | `docs/NORTH_STAR.md` (decisions unchanged; only references/paths adapted) |
| M1_PLAN | ST › Ordered queue, Owner answers |
| TERMINOLOGY_SHEET | TM (all rows unchanged) |
| DESIGN_LANGUAGE_V2 | DS (all sections: §0 kit, §0b Style v4, §1 identity, §2 themes, §3 type, §4 layout, §5 shell, §6 components, §7 motion, §8 copy, §9 languages, §10 room for later, §11 mockups, §12 open decisions) |
| ISSUE_REGISTER_DRAFT | IR (every row; statuses adjusted only where verified, marked *(verified 2026-10-15)*) |
| IDEA_BANK | `docs/IDEA_BANK.md` |
| MOCKUP_REVIEW_LOG | ST › Open decisions (D-03…D-13); independent review corrections → IR › REVIEW-MATH-01; full log archived |

## Part 2 notes

What Part 2 actually did, including where it differed from `MOVE_PLAN.md`:

- **Additions merged:** IG › "Workspace behaviour invariants" and "Equity analysis and study continuity" (from the old IG preamble); IG's dated "Presentation refinement" paragraph became a "Layout ownership" note under Stable state transitions; the shell help-panel and Tab-order rules moved to DS › Shell. AC preambles folded into §2 (hand-history import), §7/§8 (weighted Equity), §10 (bluff/exploit teacher); AC §2 versions corrected; AC §11.1 and "Research, data and model rules" added. `GAME_RULES_V1_SPEC.md` › Product rules for setup and legality; `HOME_GAME_ORGANIZER_SPEC.md` › Canonical ledger and corrections (Core Flow rules, HG-002/HG-003 status); `PERSONAL_STRATEGY_FOUNDATION_SPEC.md` §16 locked smoothness rules; `QA_AND_REGRESSION_SPEC.md` pointers.
- **Slimming was conservative** (rule: "if unsure, keep it"). Removed only: sentences that state acceptance status, browser inventory or sequencing ("human acceptance pending", "General sequencing is unchanged", "Nothing staged or committed"); ticket file inventories/maps; verification run counts; measurement tables. Each removed section that held a rule kept it in a short replacement section: ADVANCED_EQUITY › Limits and computation bounds; AUDIO_MOTION › Rejected directions; BLUFF_EXPLOIT_TEACHER › Not provided; HAND_HISTORY_IMPORT › Fixtures; OPPONENT_POLICY_V2 › Known limits; PERSONAL_STRATEGY_COACH › Supported adapter limits; PERSONAL_STRATEGY_SYNC › Performance, Live acceptance; SAVED_OBJECT_SYNC › Payload size; RANGE_CORE §18 Performance; RANGE_TEACHER › Performance; SAVED_STUDY_OBJECTS › Performance; ADR › Performance budget (median < 50 ms, p95 < 100 ms); REFERENCE_SOURCE_FOUNDATION › Guardrail. "Sweep C", "Beta coherence" and "September 8 … (AUD-01)" sections were retitled, not removed.
- **Deviation:** `UNIFIED_RANGE_INTELLIGENCE_SPEC.md` was slimmed less than planned: only §2.1 (accepted-ticket history table, a status record) was removed. §11–§16 were kept intact because verifying every rule against the implementation specs was not done; they remain "normative design constraints" as the spec itself says.
- **Deviation:** `PERSONAL_STRATEGY_FOUNDATION_SPEC.md` legacy narrative was not cut (it documents v1 compatibility shapes, which are rules for historical readers).
- The old `AGENTS.md` was archived as `AGENTS.2026-10-15.md` (the plan said "replace"; archiving keeps it searchable).
- Links in kept specs that pointed at archived documents were re-pointed (CAPABILITY_GUARDRAILS anchors, archive paths, `docs/ISSUE_REGISTER.md` for QA ownership).
