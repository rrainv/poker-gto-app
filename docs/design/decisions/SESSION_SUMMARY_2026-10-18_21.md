# Manager session summary while the owner was away (2026-10-18 → 2026-10-21)

Read this first on return. Details live in the decision logs listed below; every entry keeps its reason and date.

## Repo state (unchanged since 2026-10-18)
- codex/stabilization includes: Analyze (4e3e11a), docs reset (d1c826e), owner decisions (f18b6be), truth fixes (51c115d), RU/HE terminology (5503f16), test hygiene + fix (merged; suite green on Windows: 2750 pass, 6 honest todos).
- argon/m1-batch-1: B0–B3 committed and pushed (agent policy, mockup assets, i18n residue, cleanup prep); **B4 half-done, uncommitted** in ..\poker-gto-app-argon. Argon quota resets around 2026-10-24/25.
- Known product bugs from test hygiene: **F12 (P1)** Varied session restart hides answer buttons; **F13** Adjust drill focus.

## Decisions made (files)
- PHASE1_DECISIONS.md: P1-01..P1-15b (shell/hubs, drill confirm mode + one-time prompt, decision controls, Training panels, motion tempo + catalog approval + per-moment tempos + global Motion setting, smoothness requirement, sound from real recordings only, empty states, illustration style, Chippy brief).
- MOTION_SPEC.md: all 31 approved moments with choreography, durations and tempos.
- PS_DESIGN_DECISIONS.md: PS-01..PS-05 (thresholds + brush + table questions; mixes with optional %; families in / roles out; base plan + differences per depth/size; three building paces).
- HAND_DESIGN_DECISIONS.md: HAND-01..HAND-05 (table-first entry shown as data rail; 8 combined strengths incl. suggest-don't-assume and adjustable "about"; exact/about/unknown + gap rows with useful advice; phone capture format with labelled guesses; result card + careful one-line takeaway).
- MOBILE_DESIGN_DECISIONS.md: MOB-01..MOB-06 (near-full app on phone incl. Analyze, chess.com/Duolingo-style study; live mode allowed with strong warnings + four hard limits; build approach decided by prototypes; drill = mix of variants 2 and 3).
- LONG_TERM_NOTES.md: roadmap tracks, LT-01..LT-07 (phone↔PC: phone standalone then optional sync; business model; source model decided after solver needs; sourcing policy approved; testers when near public-ready; solver licensing results; free-first, no spending yet).

## Research received
- Agent skills report (Gemini): adopt riverline-design (own), better-accessibility, review-animations, break-ui; vet ponytail and humanizer. Ticket SKILLS-001 ready.
- Solver licensing report (Gemini): postflop-solver outputs shippable; HRC Pro explicit commercial outputs (deferred, free-first); avoid GTO+/Simple/Pio data; skip TexasSolver.

## On return (RETURN_QUEUE.md)
MERGE-001 → TRAINING-F12-001 (+ commit) → SKILLS-001 → DOCS-PHASE1-001 (all decision files into the repo with reasons) → Argon batch 2 (B4–B6) → AUDIO-RESEARCH-001 → Phase 2 design build tickets.
PC-only decisions still open: whose-turn A or C; card back; heading font; Hebrew mix bar; Equity A/B; Learn A/B; kit text corrections; competing versions (PS sweep, families/roles, phone drill mix).
