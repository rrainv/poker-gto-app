# DOCS-RESET-001 move plan (Part 2, after approval)

Nothing below has been moved, deleted or archived yet. Part 1 only created new files. Archive layout is **flat**: former `docs/project/*.md` go to `docs/archive/2026-10/`, dossiers to `docs/archive/2026-10/capabilities/`, agent prompts to `docs/archive/2026-10/agent-prompts/`. Moves use `git mv` so history follows the file (no staging beyond what `git mv` implies is done; if `git mv` is not allowed, plain moves).

> Note on `git mv`: it updates the index. If the owner wants a zero-index-change Part 2, use plain file moves instead and let the owner stage. **Default: plain moves** (AGENTS rule: no staging).

## 1. New live set (created in Part 1)

| File | Status after Part 1 | Part 2 action |
|---|---|---|
| `docs/NORTH_STAR.md` | written (draft content, paths adapted) | keep |
| `docs/STATE.md` | written | keep; mark DOCS-RESET-001 done |
| `docs/ISSUE_REGISTER.md` | written | keep; close REPO-AUDIT-005…008/016 with Part 2 evidence |
| `docs/TERMINOLOGY.md` | written | keep |
| `docs/IDEA_BANK.md` | written (links adapted) | keep |
| `docs/project/CAPABILITY_GUARDRAILS.md` | written (new reference spec) | keep |
| `docs/archive/README.md` | written | keep |
| `docs/_incoming/AGENTS.new.md` | written | **replace** `AGENTS.md` with it, then delete |
| `docs/_incoming/DESIGN_SYSTEM.new.md` | written | **replace** `docs/project/DESIGN_SYSTEM.md` with it (old file archived first), then delete |
| `docs/_incoming/REFERENCE_SPEC_ADDITIONS.md` | written | merge into the named specs, then delete |
| `docs/_incoming/INVARIANT_LEDGER.md` | written | move to `docs/archive/2026-10/INVARIANT_LEDGER.md` |
| `docs/_incoming/MOVE_PLAN.md` | this file | move to `docs/archive/2026-10/MOVE_PLAN.md` |

## 2. Replace / rewrite in place

| File | Action | Notes |
|---|---|---|
| `AGENTS.md` | replace with `AGENTS.new.md` | ~8 KB rulebook |
| `docs/project/DESIGN_SYSTEM.md` | archive current as `docs/archive/2026-10/DESIGN_SYSTEM.2026-10-03.md`, then replace with `DESIGN_SYSTEM.new.md` | Current file carries uncommitted ANALYZE-COMPOSITION-001 edits (backup `956ca6e`); see decision D-21 |
| `docs/README.md` | rewrite as a short index of the new set | test `docs_integrity001_governance` updated (below) |
| `README.md` (root) | update the stale status paragraph (line ~25) to point to `docs/STATE.md`; fix links to archived docs (Project charter, Current phase) | links only plus one status sentence |

## 3. Archive (move unchanged)

| From | To | Why |
|---|---|---|
| `docs/project/CURRENT_PHASE.md` | `docs/archive/2026-10/` | status owner replaced by STATE.md (carries uncommitted Analyze edits: D-21) |
| `docs/project/ROADMAP.md` | same | replaced by NORTH_STAR §9 + STATE |
| `docs/project/PRODUCT_BACKLOG.md` | same | replaced by STATE ("What exists today") + NORTH_STAR |
| `docs/project/QA_BACKLOG.md` | same | merged into ISSUE_REGISTER (carries uncommitted Analyze edits: D-21) |
| `docs/project/PRODUCT_RETURN_QUEUE.md` | same | merged into ISSUE_REGISTER |
| `docs/project/DOCUMENTATION_GOVERNANCE.md` | same | replaced by NORTH_STAR order of reference + AGENTS "Docs you may touch" |
| `docs/project/DEFINITION_OF_DONE.md` | same | folded into AGENTS (tickets, tiers, report) + DESIGN_SYSTEM (acceptance) |
| `docs/project/GIT_WORKFLOW.md` | same | folded into AGENTS › Git and file safety |
| `docs/project/PROJECT_CHARTER.md` | same | superseded by NORTH_STAR §1–§5 |
| `docs/project/PRODUCT_SPEC.md` | same | visual parts → DESIGN_SYSTEM; behaviour → INTERACTION_GRAMMAR additions |
| `docs/project/CURRENT_REPO_AUDIT.md` | same | dated evidence snapshot |
| `docs/project/HANDS_ON_PRODUCT_REVIEW_2026_08.md` | same | completed evidence; open rows in ISSUE_REGISTER |
| `docs/project/BETA_BLOCKER_REPAIR001_REPORT.md` | same | ticket report |
| `docs/project/RANGE_CAL_002A_HOLDOUT_REPORT.md`, `RANGE_CAL_002B_VALIDATION_REPORT.md`, `RANGE_CAL_002C_VALIDATION_REPORT.md` | same | validation reports (specs keep the accepted limitations) |
| `docs/project/REFERENCE_INTEGRITY_RECOVERY001_REPORT.md` | same | ticket report (lesson in NORTH_STAR §2) |
| `docs/project/REFERENCE_SOURCE_ACQUISITION_2026_09.md` | same | research; superseded by NORTH_STAR §3.4 solver findings |
| `docs/project/REFERENCE_BENCHMARK_FIRST_CAPTURE_PLAN.md` | same | research plan |
| `docs/project/RIVERLINE_MASTER_PRODUCT_STRATEGY_PLAN.md` | same | already historical |
| `docs/project/PERSONAL_STRATEGY_002R_REVIEW.md` | same | completed review |
| `docs/project/TABLE_PRESENCE_COMPETITIVE_REFERENCE.md` | same | research brief; rules moved to ARCHITECTURE_CONTRACT §11.1 / INTERACTION_GRAMMAR |
| `docs/project/L10N_001_TERMINOLOGY_RESEARCH.md` | same | evidence; superseded by TERMINOLOGY |
| `docs/project/LOCALIZATION_STYLE_GUIDE.md` | same | superseded by TERMINOLOGY (non-conflicting rules kept there) |
| `docs/project/capabilities/*.md` (15 files incl. README, LEGACY_ID_INDEX) | `docs/archive/2026-10/capabilities/` | intent → NORTH_STAR / IDEA_BANK; rules → CAPABILITY_GUARDRAILS |
| `docs/agent-prompts/*.md` (15 files) | `docs/archive/2026-10/agent-prompts/` | replaced by AGENTS; research rules → ARCHITECTURE_CONTRACT §12 |
| `docs/_incoming/MOCKUP_REVIEW_LOG.md` | `docs/archive/2026-10/MOCKUP_REVIEW_LOG.md` | owner feedback history; open questions summarised in STATE |

## 4. Delete (content in place)

| File | Content now in |
|---|---|
| `docs/_incoming/NORTH_STAR.md` | `docs/NORTH_STAR.md` |
| `docs/_incoming/IDEA_BANK.md` | `docs/IDEA_BANK.md` |
| `docs/_incoming/ISSUE_REGISTER_DRAFT.md` | `docs/ISSUE_REGISTER.md` |
| `docs/_incoming/TERMINOLOGY_SHEET.md` | `docs/TERMINOLOGY.md` |
| `docs/_incoming/DESIGN_LANGUAGE_V2.md` | `docs/project/DESIGN_SYSTEM.md` |
| `docs/_incoming/M1_PLAN.md` | `docs/STATE.md` queue |
| `docs/_incoming/AGENTS.new.md`, `DESIGN_SYSTEM.new.md`, `REFERENCE_SPEC_ADDITIONS.md` | swapped / merged |

Then remove the empty `docs/_incoming/` and `docs/agent-prompts/`, `docs/project/capabilities/` folders.

## 5. Keep and slim (reference specs stay in `docs/project/`)

Slimming removes dated status preambles, ticket file inventories, verification/acceptance narratives, performance **measurements** (budgets stay), and "historical" sections; it re-titles "Sweep C" / "Beta coherence" sections as normal sections. It never removes a rule. Links to archived docs are re-pointed. Doc-reading tests are kept green.

| File (size) | Slim scope |
|---|---|
| `ARCHITECTURE_CONTRACT.md` (24 KB) | fold 3 preambles; additions §2, §11.1, §12 from REFERENCE_SPEC_ADDITIONS |
| `INTERACTION_GRAMMAR.md` (24 KB) | fold preambles; add "Workspace behaviour invariants"; Equity auto-calc supersession; pointers |
| `QA_AND_REGRESSION_SPEC.md` (4 KB) | pointer updates only |
| `GAME_RULES_V1_SPEC.md` (20 KB) | merge "Sweep C" and "AUD-01" sections into body; add min-raise examples + rake/collection rule |
| `DECISION_CONTEXT_SPEC.md` (21 KB) | status line only |
| `STRATEGY_SOURCE_AUTHORITY_SPEC.md` (26 KB) | fold preamble into §14; trim §9 audit narrative to resulting semantics |
| `REFERENCE_PACK_V1_SPEC.md` (13 KB) | fold preamble; §10 keep limitations + resume point only |
| `REFERENCE_SOURCE_FOUNDATION_V1_SPEC.md` (14 KB) | drop "Verification and human acceptance"; re-point acquisition link |
| `REFERENCE_BENCHMARK_SPEC.md` (14 KB) | drop §11 synthetic example; re-point capture-plan link |
| `RANGE_CORE_SPEC.md` (16 KB) | drop §18 measurements |
| `ANALYSIS_RANGE_SPEC.md`, `BLUFF_ANALYSIS_SPEC.md` | status lines only |
| `BLUFF_EXPLOIT_TEACHER_V1_SPEC.md`, `EXPLOIT_ANALYSIS_V1_SPEC.md`, `ADVANCED_EQUITY_V1_SPEC.md`, `DEEP_REVIEW_STUDY_INBOX_V1_SPEC.md`, `HAND_HISTORY_IMPORT_V1_SPEC.md`, `TRAINING_INTELLIGENCE_V1_SPEC.md`, `OPPONENT_POLICY_V2_SPEC.md` | drop "Verification and acceptance", "Ticket file inventory" / "file map"; fold dated preambles |
| `PERSONAL_STRATEGY_INTELLIGENCE_V1_SPEC.md`, `PERSONAL_STRATEGY_COACH_V1_SPEC.md` | same, plus "September 5 foundation verification (historical)" and continuation inventories |
| `TRAINING_MEMORY_V1_SPEC.md`, `TRAINING_PRACTICE_PLANNER_SPEC.md` | re-title Sweep C; drop measurements |
| `SAVED_STUDY_OBJECTS_SPEC.md` (40 KB) | fold AUD-01 section; drop performance evidence and deferred-UX narrative (keep rules) |
| `SAVED_OBJECT_SYNC_SPEC.md`, `PERSONAL_STRATEGY_SYNC_SPEC.md`, `AUTHENTICATION_SPEC.md` | drop measurements and verification boundary narrative (keep "live acceptance not done" fact) |
| `ACCOUNT_IDENTITY_SPEC.md` (28 KB) | light; **keep the persisted-domain inventory table rows asserted by `account001`/`account002a` tests** |
| `PERSONAL_STRATEGY_FOUNDATION_SPEC.md` (34 KB) | drop superseded legacy narrative only where a newer spec owns it; add §16 budgets |
| `UNIFIED_RANGE_INTELLIGENCE_SPEC.md` (70 KB) | heaviest: keep decision summary and §3–§10 (authority, evidence, action model, representation, Range Core, context/key, uncertainty, corrections); replace §2 checkpoint and the per-ticket plans §11–§16 with pointers to their implementation specs after checking each rule exists there (any rule found only here stays) |
| `ADAPTIVE_RANGE_CALIBRATION_SPEC.md`, `RANGE_INFERENCE_SPEC.md`, `RANGE_CONTEXT_TRANSFER_SPEC.md`, `RANGE_BUILDER_SPEC.md`, `RANGE_TEACHER_SPEC.md`, `PERSONAL_STRATEGY_ACTION_CONTRACT_SPEC.md`, `PERSONAL_STRATEGY_MATRIX_SPEC.md` | drop performance evidence and validation numbers; keep limits |
| `ADR_PERSONAL_STRATEGY_PERSISTENCE.md` | keep (decision record); drop performance evidence |
| `HOME_DASHBOARD_SPEC.md`, `HOME_GAME_ORGANIZER_SPEC.md` | status lines; Game night additions |
| `AUDIO_MOTION_001_SPEC.md` | drop "Competitive reference decision" and "Verification boundary" narrative |
| `TUTORIAL_ONBOARDING_SPEC.md` | status line; keep inventory |

## 6. Tests that read docs (Part 2 changes; behavioural assertions kept)

| Test | Change | Reason |
|---|---|---|
| `tests/docs_integrity001_governance.test.mjs` | (1) index test → asserts `docs/README.md` links NORTH_STAR, STATE, ISSUE_REGISTER, TERMINOLOGY, DESIGN_SYSTEM, ARCHITECTURE_CONTRACT, INTERACTION_GRAMMAR, CAPABILITY_GUARDRAILS, archive README. (2) master-plan header test → archived path, same assertions. (3) Git-workflow test → reads `AGENTS.md`: no executable broad-stage example; requires "exact file lists". (4) "live planning defers to Current Phase" → replaced by "STATE.md declares itself the one live status file". (5) Product Backlog 14-heading test → removed | the documents they assert are archived; (3) keeps the same safety assertion on the new owner |
| `tests/docs_capability_dossiers001_integrity.test.mjs` | dossier-existence/disclaimer and legacy-ID tests → archived paths; link-resolution test → the new live set (`AGENTS.md`, `README.md`, `docs/README.md`, NORTH_STAR, STATE, ISSUE_REGISTER, TERMINOLOGY, IDEA_BANK, archive README, all `docs/project/*.md`); index-navigation test → `docs/README.md` links INTERACTION_GRAMMAR and CAPABILITY_GUARDRAILS | archived docs may hold moved links; live docs must resolve |
| `tests/l10n001_native_terminology.test.mjs` | research path → archive; style-guide assertions → `docs/TERMINOLOGY.md` (invariant tokens, "Hebrew punctuation and direction", "never call heuristic output solved GTO", an "Actions" table) | TERMINOLOGY supersedes the guide; same invariants asserted |
| `tests/training_composition001_final_hardening.test.mjs` | dossier path → `docs/archive/2026-10/capabilities/RANDOM_SPOT_GENERATOR.md` | path only (the rule also lives in CAPABILITY_GUARDRAILS) |
| `tests/account001_identity_foundation.test.mjs`, `tests/account002a_authentication.test.mjs` | none (ACCOUNT_IDENTITY_SPEC stays; asserted rows preserved) | |
| `tests/repo_dump_filter.test.py` | none (AUTHENTICATION_SPEC stays) | protected tooling not touched |

Verification (T0): run exactly these six tests plus a markdown link check over `docs/` (live set must resolve; archived set reported, not fixed).
