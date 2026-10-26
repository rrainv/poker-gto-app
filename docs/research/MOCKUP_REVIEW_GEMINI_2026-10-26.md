# Gemini deep review of the 89 mockups: Manager triage (2026-10-26)

Source: riverline_mockup_deep_review.pdf (headless Chromium audit of the hub). Mostly accurate; triaged below.

## Accept (fix in mockups now, or carry into the build)
1. **Hub viewer:** static 1920 boards clip in 1366/Phone (the viewer resizes the iframe, not the board). Fix: scale boards in every size, or disable 1366/Phone for boards. (Hub fix.)
2. **Equity PC in Phone mode** shrinks to 0.2×: the PC layout is PC-only by design (P1-28); the hub should show it at 1920 only. A phone Equity is Equity C.
3. **Hebrew mix bar vs. legend:** the legend inherits RTL while the bar is LTR, so their order contradicts. Rule: legend follows the bar (both LTR) → DESIGN_SYSTEM + register row.
4. **Contrast:** Daylight primary button (#ffffff on #2f8a5f = 4.27:1) and Midnight fold accent (#68716c = 3.29:1) and muted hint text miss WCAG AA for small text. Proposed tokens: Daylight button #287a53 (5.1:1), fold #828c86 (4.65:1). Into DS-TOKENS-001.
5. **Theme presets:** keep Slate as a built-in; "Your copy" is a separate slot/action (the kit Settings board overwrote Slate).
6. **Prototype headers** (drill v2/v4) overflow at phone width: header needs wrapping. Low priority (old prototypes).
7. **Kit unification:** Learn, Full Hand/Orbit, the five Settings sub-pages and the five My poker pages still exist only as 1440×900 "Sidebar 1" canvases; redraw them on Style v4 + hub sidebar at 1920×1080 before their build tickets.
8. **Production rules** (already planned): one token stylesheet with theme scopes; logical CSS; one poker-token component for LTR isolation + tabular numbers; move equity simulation into a Web Worker so animations stay at 60 fps; self-host the Rubik font (no Google Fonts at runtime).

## Reject / correct
- **"Standardise Russian Fold on Фолд":** rejected. Owner decision in TERMINOLOGY.md: RU fold = **пас** (Hebrew uses פולד). The glossary may gloss «пас (фолд)».
- **Gender-neutral Hebrew rewrites:** not needed; masculine singular is the decided convention.
- Scores (9.3/10 etc.) are the reviewer's opinion, not acceptance.
