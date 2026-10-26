# DOCS-PHASE1-001: owner decisions and research into the repo

Execution class: Product Contract First (docs) · Tier: T0 + doc tests · Agent: Claude Code (Opus 5.5) · Base: `codex/stabilization` @ `a9b2578`

## Outcome

- The owner's decision logs (P1-01 … P1-30, PS-01 … 08, HAND-01 … 07, MOB-01 … 06, LT-01 … 07 with D-30 … D-33 and the 2026-10-21/23/26 answers, the consistency check, the session summary) are recorded **unchanged** in `docs/design/decisions/` with an index.
- The living docs carry every decision with its reason and date: NORTH_STAR (§1, §2, §3.2–3.4, §4.5, §6.1, §6.4, new §6.5 shell and hubs, §7.1, §7.2, §7.4–7.6, §7.8–7.13, §7.15–7.17, new §7.19 phone, §8, §9, §10, §11, §11c, §12, §13), DESIGN_SYSTEM (PC first, contrast tokens, Slate, Rubik, source/tier label, mix bar + Hebrew legend, card back, select + confirm + one-time prompt, decision controls, Training panels, seats, shell variant 4, motion rewritten from P1-06 … P1-10, sound, new sections Illustration and empty states, Chippy, Sticker book, voice, phone, mockup QA, open decisions), STATE (rewritten: decisions table, M1 queue from M1_BUILD_PLAN with real statuses, open decisions with whose turn, design canvases incl. the all-mockups hub, research R-01 … R-10).
- New: `docs/BRIEF.md` (linked from AGENTS.md and README.md; AGENTS.md is 9,063 bytes), `docs/THIRD_PARTY.md` (sourcing policy LT-04; everything in the repo plus planned items, unknowns marked), `docs/design/` references (MOTION_SPEC, VOICE_GUIDE, MOCKUP_QA, ACHIEVEMENTS_CATALOGUE), `docs/research/` (all reports with dated names and an index; the master synthesis filed as research only).
- IDEA_BANK merged (ideas 1–37 with milestones). Register rows added from the Gemini mockup review. The riverline-design skill points at `docs/design/`.

## Where each incoming file went

Byte-identical copies unless noted.

| Incoming | Placed at |
|---|---|
| PHASE1_DECISIONS, PS_DESIGN_DECISIONS, HAND_DESIGN_DECISIONS, MOBILE_DESIGN_DECISIONS, LONG_TERM_NOTES, CONSISTENCY_CHECK, SESSION_SUMMARY_2026-10-18_21 | `docs/design/decisions/` (+ new README) |
| MOTION_SPEC, VOICE_GUIDE, MOCKUP_QA, ACHIEVEMENTS_CATALOGUE | `docs/design/` |
| RESEARCH_TICKETS | `docs/research/RESEARCH_TICKETS.md` |
| RESEARCH_ROUND3_ANALYSIS | `docs/research/2026-10-23_RESEARCH_ROUND3_ANALYSIS.md` |
| MOCKUP_REVIEW_GEMINI_2026-10-26 | `docs/research/` |
| research/*.pdf, *.docx, *.md (13 reports) | `docs/research/` (same dated names) |
| research/README.md | rewritten as `docs/research/README.md` (paths and R-09 status added) |
| IDEA_BANK | merged into `docs/IDEA_BANK.md` (repo header kept; two table breaks repaired) |
| RIVERLINE_BRIEF | `docs/BRIEF.md` (edited: trailing `EOF / echo ok` shell residue removed; round-3 changes; links); original kept in `docs/archive/2026-10/manager-pack/` |
| MANAGER_PACK, RETURN_QUEUE, RETURN_PLAN, M1_BUILD_PLAN, M1_PLAN, AWAY_BATCH_2026-10-17, DESIGN_LANGUAGE_V2 | `docs/archive/2026-10/manager-pack/` (+ README saying where the content went) |
| riverline-design-SKILL.md | `docs/archive/2026-10/manager-pack/riverline-design-SKILL.draft.md` (superseded by the reviewed `.agents/skills/riverline-design/SKILL.md`) |
| MOCKUP_REVIEW_LOG | replaced `docs/archive/2026-10/MOCKUP_REVIEW_LOG.md` (newer: adds entry 23) |

`docs/_incoming/` was deleted after the placement check (checksums matched for every unchanged copy).

## Replaced passages (older text contradicted by a newer owner decision)

NORTH_STAR:
1. §1 "probably free; open vs closed undecided" → LT-02 business and source model; "Desktop-first" → PC first (P1-28); product name line → D-30 kept + name watch; testers → LT-05.
2. §2 added the study-tool rule, Quick spot lookup and the four hard limits (MOB-01, D-33; consistency #10).
3. §3.2 "one tier label in a fixed place" → one combined source + tier + scope label (D-31; consistency #5).
4. §3.3 item 1 "measure against reputable public charts" → free measurement harness, never downloading charts (R-01); new item 5 "measure before changing the baseline" (round 3).
5. §3.3b → R-08 contexts, the owner's "don't focus on one preset" caution, limped multiway importance.
6. §3.4 → free-first solver path (LT-03/06/07, R-01; consistency #13); the 2026-10-12 findings marked superseded where they differ; "optional compute budget ≈ US$75" → no spending committed (LT-07).
7. §6.4 "Audio & Motion" → Sound & motion with separate controls; My poker "decided with the sidebar rework" → Library hub (P1-01).
8. §7.1 "Bulk-confirm extremes", the hand-groupings research item, the edge-sweep "decided on a prototype", "Always / Sometimes / Never + optional %" → PS-01 … PS-08 (consistency #8).
9. §7.2 Orbit "rebuys only when busted, optional top-up threshold" → P1-16 offer to top up to the starting stack, auto top-up setting (consistency #7).
10. §7.4 "rows not seats" (twice) → B look with A density (P1-30).
11. §7.5 "Shorthand text entry [Out]; narrow phone-note paste" → HAND-04/06/07 capture syntax (consistency #3; see Disagreements).
12. §7.9 added D-32 money mode kept and "banker" wording kept (consistency #2).
13. §7.10 Learn layout → P1-30 mix leaning to B; first five minutes → P1-19 A → C → B → D (consistency #6); R-10 curriculum draft.
14. §7.11 added storage status, QR (both cameras), named-copy conflicts, notices, anonymised sharing; "Free project" → mostly free (LT-02); "CC0 sound provenance" → THIRD_PARTY incl. CC-BY credits.
15. §7.12 "skill milestones (high-confidence tier only)" removed → activity only, sticker book (P1-20/22; consistency #1).
16. §7.13 "light idle personality" and the "premium-toy" look → calm-teacher brief (P1-15b; consistency #9).
17. §7.15 "M1: one good sound set", "CC0 full-quality originals", "study cues stay synthesized tones, made nicer" → P1-11 real recordings only, licences, listening page, sound/motion separate (consistency #11).
18. §7.16 motion scale and "in-app reduced-motion toggle" → P1-06 … P1-10; "display typeface tested" → Rubik; illustration "geometric-abstract (provisional)" → soft depth + fine line, two-card rule.
19. §7.18 "mobile (intentional adaptation)" → new §7.19 phone version (MOB-01 … 06; consistency #4).
20. §9 M1 "decide the shell direction", "first sound set" → variant 4 decided, listening page first; Welcome/Home and notices added; M2 "onboarding" moved to M1 (WELCOME-001); M3 achievements → sticker book.
21. §10 "Claude Code stays the only writer on the repo" → Gemini Argon may implement in its own worktree (AGENT-POLICY-001 in AGENTS.md is newer).
22. §11 "shorthand text hand entry" narrowed to a general free-form mode; new rejected items listed; §11c two items annotated as refined/updated.
23. §13 open questions: decided items removed and listed; new open items added.

DESIGN_SYSTEM:
24. Heading face *provisional* (D-10) → Rubik, self-hosted. 25. Card back (D-11) → "R" monogram. 26. Mix bar "Hebrew direction decided on the PC (D-13)" → bar LTR, legend follows. 27. Tier badge → combined source/tier label. 28. Decision controls *provisional* → P1-04 both exist; select + confirm and the one-time prompt added. 29. Training panels (three) → five (P1-05). 30. Empty states "later an illustration or Chippy" → P1-12. 31. Target shell options → variant 4 decided. 32. The whole "Motion, feedback and sound" section (four-level scale; "study cues are neutral synthesized tones") → P1-06 … P1-11. 33. "Phone views (M3)" → MOB-01. 34. Open design decisions list. 35. Ticket names DS-TOKENS-V4 / DS-COMPONENTS-V4 / MOTION-001 / SOUND-001 → DS-TOKENS-001 / COMPONENTS-001 / MOTION-FOUNDATION-001 / listening page (also in four register rows).

STATE: Phase 1 DES-* rows, the 2026-10-15 phases and D-03, D-04, D-06, D-07, D-08, D-09, D-10, D-11, D-13, D-17 moved to Resolved; new open D-23 … D-29.

Skill: `docs/_incoming/...` paths → `docs/design/...`; "mix bar direction is open (D-13)" → decided rule; D-13 example → D-23.

## Contradictions with code (flagged, not changed)

- **Sound:** `app/assets/audio/foley/` holds CC0 Freesound **Ogg previews** (PROVENANCE.md says so), not full-quality originals; `app/src/core/SoundFX.js:386` synthesizes study cues with an oscillator. Both contradict P1-11 (noted in NORTH_STAR §7.15, DESIGN_SYSTEM and THIRD_PARTY). `docs/project/AUDIO_MOTION_001_SPEC.md` describes the current code and was not changed.
- **Themes:** the review's Slate preset does not exist in code (Midnight, Graphite, Daylight only); the Daylight contrast failure is in the kit draft (#2f8a5f), while code uses #256044. Recorded in DS-THEME-SLATE / DS-CONTRAST-TOKENS.
- **Equity worker:** the review asks to move equity into a Web Worker; `equity-controller.mjs` already starts `equity-worker.mjs`. Recorded as Partial (PERF-EQUITY-WORKER).
- **Heading font:** `--font-display` is still the system stack (Rubik not yet added).
- **Character portraits:** AI-generated with an unrecorded tool and terms (THIRD_PARTY marks UNKNOWN).

## Register

New rows: DS-CONTRAST-TOKENS, DS-THEME-SLATE, DS-FONT-RUBIK, PERF-EQUITY-WORKER (§B), I18N-HE-MIXBAR-LEGEND (§C Settings/i18n), KIT-REDRAW-001 (§D). Updated notes: QA-ANALYZE-COMPOSITION-004 (D-13 decided), DS-FOUNDATION-005, MOTION-DEBT, the listening-debt row, RET-HPR-CUSTOMIZATION-001 (renamed tickets). I18N-HE-FOLD already existed (not duplicated). Not turned into rows (Manager hub work, not repo): review items 1, 2 and 6 (hub viewer scaling, Equity PC in phone mode, old prototype headers).

## Disagreements and open questions

1. **Capture syntax scope:** consistency row 3 proposed "the narrow, phone-only exception"; HAND-07 (later) makes the short-notes syntax work typed into Hand on the PC too. I followed HAND-07 (newer) and kept only a *general free-form* text mode as rejected. Owner to confirm.
2. **Sound timing:** NORTH_STAR and STATE had the first sound set in M1; M1_BUILD_PLAN and P1-17 ("sound later") put the real set after the listening session / M1 gate. I followed the newer plan; confirm whether M1 still needs any sound build.
3. **Onboarding milestone:** NORTH_STAR had onboarding in M2; M1_BUILD_PLAN has WELCOME-001 in M1 Phase 2. Followed the plan.
4. **B5 cross-review (Phase 0.6):** no separate report exists; MERGE-002 merged B5 with follow-ups. Status recorded as "not recorded"; the Manager decides whether a dedicated maths review is still owed.
5. **D-31 vocabulary** is decided in principle only; recorded as D-28 (worker proposes).
6. The R-08 percentage inconsistency and the "1/k^1.4" formula are noted as unsourced; nothing adopted from them.
7. VOICE_GUIDE's RU examples are still in «вы» form despite the «ты» decision (the file is copied unchanged; noted in NORTH_STAR §4.5).
8. Binary research reports (~10 MB of PDF/DOCX) are now in git as the ticket asked; if repo size matters, a later move to an external archive is possible.

## Verification

- `node --test tests/docs_integrity001_governance.test.mjs tests/docs_capability_dossiers001_integrity.test.mjs tests/l10n001_native_terminology.test.mjs tests/token_tuning001.test.mjs tests/truth_surfaces002.test.mjs tests/training_composition001_final_hardening.test.mjs tests/account001_identity_foundation.test.mjs tests/account002a_authentication.test.mjs` → 51 pass, 0 fail (every test file that reads docs).
- Markdown link check (relative files and `#anchors`, GitHub slug rules; scratch script) over AGENTS.md, README.md, `.agents/skills/`, `docs/`: **0 problems in live docs and every new or changed file**. Remaining hits are pre-existing: archived files under `docs/archive/2026-10/` and `agent-reports/` (moved paths, allowed by the archive README) and the vendored better-accessibility skill's six reference files (known, listed in SOURCES.md).
- `git diff --check` clean; no CRLF in any written file; `git diff --stat` shows no line-ending churn. AGENTS.md 9,063 bytes (< 10 KB). Secret scan of the placed text files: nothing found.
- No browser check (docs only, T0).
