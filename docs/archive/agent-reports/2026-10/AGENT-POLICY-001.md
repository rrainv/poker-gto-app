# AGENT-POLICY-001 Report

## 1. Outcome
Added the `## Multi-agent work` section to `AGENTS.md` defining agent roles (Claude Code default implementer, Gemini Argon in Antigravity batch implementer and independent reviewer, Manager in Claude chat for planning and review), one writer per folder/worktree and branch isolation, merge policy, cross-agent independent review requirements for high-risk tiers (money, persistence schemas, identity/lifecycle, truth-model or claim changes), and the report location (`docs/archive/agent-reports/<yyyy-mm>/<TICKET-ID>.md`). Kept `AGENTS.md` at 8,524 bytes (well under 10 KB). Updated `docs/STATE.md` Phase 0 queue.

## 2. Decisions Made
- Placed `## Multi-agent work` immediately after `## Roles` in `AGENTS.md` and replaced the superseded single-writer bullet in `## Roles` with the new section so there is no internal contradiction inside `AGENTS.md`.
- Noted that `docs/NORTH_STAR.md` §10 ("External reviewer (Gemini Argon)") still describes the pre-batch single-writer rule; left `docs/NORTH_STAR.md` untouched because B0 scoped edits to `AGENTS.md` (and `docs/STATE.md` queue per batch rules).

## 3. Files Changed
- `AGENTS.md`
- `docs/STATE.md`
- `docs/archive/agent-reports/2026-10/AGENT-POLICY-001.md`

Pre-existing dirty files: none.

## 4. Verification
- `node --test tests/docs_integrity001_governance.test.mjs tests/docs_capability_dossiers001_integrity.test.mjs`: 10/10 passed.
- `(Get-Item AGENTS.md).Length`: `8524` bytes (< 10 KB limit).
- `git diff --check`: clean (0 output).
- Browser check: N/A (T0 docs-only ticket).

## 5. Limitations and Risks
- None.
