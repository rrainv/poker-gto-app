# DOCS-SMALL-001: batch 2 acceptance, RU «ты», research round 4, i18n text owner

Execution class: Mechanical Fast · Tier: T0 · Agent: Claude Code (Opus 5.5)

## Outcome

- **Register:** REVIEW-MATH-03 (sections A and F) and DATA-SAFETY-M1 now read "accepted (owner, 2026-10-26)"; DATA-SAFETY-M1 notes that "Delete all data" was checked in a private window. F12/F13 were already accepted and are unchanged.
- **REVIEW-BATCH2:** the report existed (untracked) and is now committed and linked from [MERGE-002](MERGE-002.md) and from STATE (queue rows 0.5 and 0.6; 0.6 changed from "not recorded as a separate report" to "Done").
- **VOICE_GUIDE:** the RU examples use «ты» (price, pattern, luck, empty state, error); lines with no address were left as they were. The "to be rewritten" note now states the rule for new copy.
- **Research round 4** from the owner's notes: R-11 (bot playstyles, M3) in NORTH_STAR §7.13, R-12 (Review) in §7.6, R-13 (no Claude Code add-ons; RTK maybe later for git output only) as a new "Tooling" note in §10. STATE's research table has R-11 … R-13 rows.
- **Open decisions D-34 … D-38** in STATE, each with the Manager's recommendation: deal policy (honest shuffle; optional labelled representative deal later), bot adaptation (fixed presets first), playstyle controls (6 presets + 2 sliders + drawer), all-in equity share scope (heads-up / equal-stack all-ins first), Review entry (overview default with "try the key decisions first").
- **QA-LANGUAGE-SWITCH-003:** approach decided (the code owns the text: no static `data-i18n` on elements code overwrites; code renders them at startup and on language switch). Recorded in DESIGN_SYSTEM › Languages, RTL and accessibility and in the register row, which stays Open until the code change lands.
- STATE "Last updated" and queue row 0.4a (this ticket) added; the MERGE-002 commit row now says accepted.

## Key choices

- D-34 … D-38 are new IDs (D-30 … D-33 were the last used). The five questions' wording is inferred from the recommendations given; the owner should check that each question reads as intended.
- R-11 wording stays close to the notes (no invented stat names or slider definitions); `BotObservationView` is described only as "what that seat may know, never hidden cards".
- `docs/research/README.md` was not changed: round 4 has no filed reports to list.

## Files

Changed by this ticket: `docs/ISSUE_REGISTER.md`, `docs/STATE.md`, `docs/NORTH_STAR.md`, `docs/design/VOICE_GUIDE.md`, `docs/project/DESIGN_SYSTEM.md`, `docs/archive/agent-reports/2026-10/MERGE-002.md`, this report; committed as-is: `docs/archive/agent-reports/2026-10/REVIEW-BATCH2.md` (pre-existing untracked, content unchanged).

Pre-existing dirty, not touched or staged: `.codex/config.toml`, `.claude/`.

## Verification

- `node --test tests/docs_integrity001_governance.test.mjs tests/docs_capability_dossiers001_integrity.test.mjs`: 10 pass, 0 fail.
- Relative-link and heading-anchor check over all eight committed docs (one-off script, not in the repo): links ok, 0 broken.
- `git diff --check`: clean; `git ls-files --eol`: all touched files LF.
- No browser check (T0, docs only).

## Limitations and debt

- QA-LANGUAGE-SWITCH-003 is decided, not fixed: the ~45 elements still carry static keys.
- RU examples are the agent's wording; the owner reviews RU per the voice guide.

## Disagreements or doc conflicts

None found.

## Git status

Committed with an exact file list and pushed to `codex/stabilization` (authorized by the ticket). `.codex/config.toml` and `.claude/` stay unstaged.
