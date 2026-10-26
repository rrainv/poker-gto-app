# Mockup QA checklist (from bugs the owner found on the phone, 2026-10-22)

Apply to every future mockup or prototype before publishing. Also a good starting checklist for real screens.

1. **Transitions never leave stale content.** When content swaps (stepping, tabs, sheets), the new content sits on top, the old one is removed by a timeout as well as by its animation (never rely only on `animation.finished`: mobile browsers can pause or skip animations), and quick repeated taps cancel the previous swap. Header text and content must always describe the same thing.
2. **Nothing overflows at phone width (390 px) or 1366 px.** Card rows, felts, tables and chips scale (clamp sizes) or wrap; never clip a hero card off-screen. Check the narrowest layout explicitly.
3. **No spoilers.** Hidden information stays hidden in every element, labels included (e.g. villain cards are face-down backs with "shown at showdown", not names in a label).
4. **Markers never cover text.** Position markers ("you" on a mix bar) go outside the bar (a tick below it), never across a label.
5. **Navigation states are honest.** Previous/Next disabled at the ends; current item highlighted in exactly one place.
6. **Numbers are computed, not invented.** Recompute pots, prices, SPR, equities for the example before publishing; label illustrative ones.
7. **Touch works.** Hover-only features have a tap equivalent; tap targets ≥ 40 px.
8. **Motion follows the spec.** Durations/curves from MOTION_SPEC.md; transform/opacity/clip-path only.
9. **Unique class names per component.** A label inside a seat must never reuse a control's class (the Training prototype's seat text used `.act`, so it rendered as an action card and was treated as a control).
10. **Hero at the bottom of every table**, other seats rotated around; cards and labels never overlap seats.
11. **No dead space above docked controls on the phone.** Controls follow the content (sticky at the bottom only when the page is long), never a fixed bar with an empty gap above it.
12. **Check the phone screenshot before publishing** (390 × 844), not only the code.
13. **Two cards in an illustration = one face up in front, one face down behind** (card back with the brass edge), for contrast (P1-14). Check every new graphic.
14. **Before designing any screen, re-read the earlier PC layouts for it** (kit screens, earlier canvases, the all-mockups hub) and list what they contained; carry over everything still wanted, and note anything deliberately dropped with the reason. Content first, then layout.
15. **PC first.** Screen mockups are fixed 1920×1080 canvases with the real shell, scaled to fit on other screens; phone versions are separate and later (P1-28).
