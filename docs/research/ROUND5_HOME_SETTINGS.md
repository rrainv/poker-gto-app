# Research round 5: Home dashboards (R-14) and Settings (R-15), Manager analysis

Reports: riverline_home_dashboard_research.pdf (8 p.), riverline_settings_research.pdf (11 p.). Binaries stay outside git (Riverline_archive); this summary is what goes into the repo.

## R-14 Home (trust: good structure, a few errors)
**Adopt (proposed, owner to confirm):**
1. One screen at 1920×1080, bounded grid, no page scroll at 1920; at 1366 Continue and the one primary action stay above the fold.
2. **Exactly one solid primary button on Home.** If something is in progress, "Resume …" is primary and "Start today's session" is secondary; otherwise "Start today's session" is primary. (The earlier Home mockup had two primaries: fix.)
3. At most 6 cards, at most 3 data rows per card (5 compact rows for Recent); fixed row heights; no in-place vertical expansion (it creates uneven columns and voids): details open the target workspace or a side drawer.
4. Adaptive slot merging: with no Continue item, its band merges into the session card so the row keeps its height with no blank placeholder.
5. Honest "nothing due" state with a calm unscored option; no streak or urgency copy.
6. Night-after card: two separate axes, luck (exact, scoped, unknown villain cards say Unknown) and plan alignment / baseline mix (never "blunder"); anonymised by position.
7. "What Riverline noticed": at most 2–3 patterns, each with a sample-size badge. **Dual threshold:** plan-vs-played comparisons from n ≥ 8 (deterministic against the user's own rule), statistical drift against a mixed Estimated baseline only from n ≥ 20. Played hands only (evidence rule).
8. Format context: default to the latest session's format (home game 40 bb vs online 100 bb); the toggle arrives with Table rules (M2). Until then Home shows the current context chip read-only.
9. Build as a mounted module in app/src/application/ (not app/src/views/…), logic.js only shrinks.

**Corrections to the report:** primary CTA colour is our jade accent (the report says brass; brass is provenance); content width is 1640 (DS-TOKENS), not 1680; its "Verified postflop reference" copy example is illustrative (we have none); Orbit, night-debrief data, stickers and Chippy do not exist yet, so Home v1 shows only real data (see HOME-INVENTORY-001).

## R-15 Settings (trust: good, concrete)
**Adopt (proposed):**
1. **Three zones:** category rail (~220) · searchable controls stream (~640) · sticky live preview (~400): no opaque modal hiding the study screen.
2. **Instant apply, no Save button;** a modified row gets a 3 px inline-start accent bar, a "modified" filter, and a per-row reset.
3. Themes: built-ins immutable, "Duplicate & customise" creates a user copy; live preview on hover/arrow keys (matches P1-30 / Slate decision).
4. Motion (4 states, already built) and sound stay separate settings; sound: master + category sliders, a neutral sample on release or a Test button, never right/wrong buzzers.
5. Language/RTL: root dir + logical CSS; poker notation as LTR islands; text size via rem scale.
6. **Shortcuts (M2 rebinding):** bind by physical key (KeyboardEvent.code) so F/C/R work on EN, RU and HE keyboards, with localized keycap labels; clashes scoped per view with a "show same keybindings" filter.
7. Data: exact local entity counts + the browser's storage estimate; guarded delete (already built: typed word). Pre-wipe export button once export exists (M2).
8. About & legal: 18+, fair-play line, tier legend, CC-BY credits from THIRD_PARTY.md.

**Open questions with recommendations:** (1) physical-key binding everywhere with localized labels: yes. (2) Selective vs total wipe: keep the total wipe built in M1; offer "also reset settings and themes" (default off) in M2 with the export.
**Risks it names (real):** legacy physical CSS (left/right) breaks Hebrew mirroring; IndexedDB deletion blocked by open connections (already handled in DATA-SAFETY-001).
