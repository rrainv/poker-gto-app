---
name: riverline-design
description: Riverline's design, motion, copy and RTL rules. Use for ANY work that touches UI, CSS (app/styles.css), DOM rendering (app/src/core/logic.js or UI modules), layout, animation, sound hooks, user-facing text, or EN/RU/HE localisation in Riverline.
license: Adapted in part from MIT-licensed skills by Emil Kowalski and Jakub Krehel; see LICENSE.md.
---

# Riverline design skill

Riverline is a calm, premium No-Limit Hold'em study workstation: dark forest / jade / brass, "calm surface, deep data", honest numbers. This file is a working summary. Authorities, in order: docs/NORTH_STAR.md (direction), docs/project/DESIGN_SYSTEM.md (visual contract), docs/TERMINOLOGY.md (terms). The owner's decision logs, with reasons and dates, are in docs/design/decisions/ (PHASE1_DECISIONS, PS/HAND/MOBILE_DESIGN_DECISIONS, LONG_TERM_NOTES); the design references are docs/design/MOTION_SPEC.md, docs/design/VOICE_GUIDE.md, docs/design/MOCKUP_QA.md and docs/design/ACHIEVEMENTS_CATALOGUE.md. When something here conflicts with those, they win; flag the conflict in your report.

## 1. Before you design or change a screen
1. Redesigns need an approved mockup before building (AGENTS.md). Read the earlier PC layouts for that screen (design kit, canvases, the all-mockups hub) and list what they contained. Carry over what is still wanted; write down anything dropped and why. Content first, then layout.
2. Check the screen's decisions in the logs (e.g. Training panels P1-05, select + confirm P1-03) and open decisions in docs/STATE.md (e.g. D-05 which mode uses cards or seat buttons, D-23 whose turn).
3. Build for 1920×1080 and 1366×768 (the minimum desktop) first. Phone views are their own designed layouts, not squeezed desktop (mockups check 390×844; phone builds wait for MOB-02).

## 2. Surface and tokens
- Use role tokens from app/styles.css only; no raw hex in component rules. Midnight is the reference theme; every theme, custom ones included, must pass contrast (text 4.5:1, non-text 3:1).
- Calm surface, deep data: the first look is clean; raw data is one hover, click or expand away ("All details", derivations on hover).
- At most two containment levels; group with spacing first (gap between groups ≥ 2× gap within). Style v4: soft panels (radius 16, padding 22), hero answer cards, number tiles, pills.
- One accent-filled primary action per view. Selection is an underline, thumb or tint, never an accent fill.
- Never double-signal a state (accent border AND an "In use" label = wrong).
- No dead space and no pseudo-dead space (long strips whose content would fit in less). Reserve heights for changing regions so nothing jumps; hover never changes layout.
- Rows never push related values to opposite edges with a gap between; rows must cope with any number of entries (totals + count, details one click away).
- Show states visually, not only in words (unknown hand = two face-down backs).
- Two cards in an illustration: one face up in front, one face down behind.
- No placeholder controls for features that don't exist yet.
- `minmax(0,1fr)` on grid tracks, `min-width:0` on flex children, `overscroll-behavior: contain` on inner scrollers.

## 3. Motion (docs/design/MOTION_SPEC.md lists all 41 moments)
- Frequency decides motion. Anything keyboard-triggered is instant. 100+/day actions are near-instant.
- Every moment has its own tempo; one global Motion setting scales all of them: Instant / Faster / Standard / Reduced (Reduced = opacity fades ≤ 200 ms only; follows the system setting by default; keeps short pauses so changes can be followed and never shortens Full Hand comprehension pauses).
- Curves: ease-out `cubic-bezier(.23,1,.32,1)` (entrances, responses); ease-in-out `cubic-bezier(.77,0,.175,1)` (things moving on screen); drawer `cubic-bezier(.32,.72,0,1)` (sheets, toasts); spring `cubic-bezier(.34,1.36,.64,1)` only for small confirmations. Never ease-in for entrances.
- Exits faster than entrances. Press = `scale(.97)` on `:active` (not on disabled). Entrances from `scale(.95)` + opacity, never `scale(0)`.
- Popovers grow from their trigger (`transform-origin`); dialogs stay centred.
- Crossfades get a 2 px blur bridge. Group entrances stagger 30–80 ms without blocking input.
- No motion shifts layout, and motion never owns or delays poker truth (canonical state updates first).
- 60 fps: animate transform, opacity, clip-path only. Never `transition: all`. No animated layout properties, no animated box-shadow (fade a pre-blurred layer), no per-frame JS, no animating an inherited CSS variable on a parent. `will-change` only on active elements. Profile in Firefox.
- Hover effects only for fine pointers: `@media (hover:hover) and (pointer:fine)`. Touch gets a tap equivalent; hover gets a keyboard-focus equivalent.
- Swaps must never leave stale content: new content on top, old removed by timeout as well as by animation end; repeated taps cancel the previous swap.

## 4. Honest numbers and typography
- Every number says what it is based on and how sure it is: source + tier (Exact / Verified / Estimated / Unavailable) + scope where useful ("Exact · price only", "Heuristic baseline · Estimated"). One combined label in a fixed place per surface; details in "Source". Production strategy today is the heuristic baseline: never label it GTO, solver, solved or "correct".
- No numeric confidence percentages. Unknown is never fold, zero or excluded. Heuristic disagreement is never a "mistake"; use inside / outside the baseline's mix, close.
- Verdicts: dominant (top action leads by ≥ 20 points or nothing else reaches 5%) or "A or B · close"; no other states. Estimated mixes rounded to 5% and actions under 5% not shown in the mix (target; not yet in code, REVIEW-MATH-03).
- The UI never computes poker maths: it formats values from shared/poker-domain. Never parse numbers back out of display text.
- `font-variant-numeric: tabular-nums` on all numbers; never truncate numbers, percentages, amounts or hand notation. Format with Intl.NumberFormat per language; guard NaN/undefined/float noise.
- Weight roles: body 400; controls, labels, fact values and headings 650; titles 700; workspace/section titles 750; verdicts and display values 800. Surface CSS uses the `--weight-*` roles, never literal weights. Nothing below 12 px except overline labels.
- Mockup numbers are never facts: examples use engine-computed "golden spots".

## 5. Copy, i18n and RTL
- Voice: docs/design/VOICE_GUIDE.md (calm honest coach; banned verdict words; takeaway formula).
- Quiet copy: don't state what users already assume; verb-first buttons; sentence case. No em/en dashes in product sentences. Raw enum, schema or state identifiers never reach users.
- Terms come from docs/TERMINOLOGY.md (RU пас, диапазон, валью, си-бет; HE ריינג', הירו, ואליו; Latin abbreviations BTN, SPR, EV, bb).
- Whole-string templates only: never build sentences from fragments around variables; plurals via Intl.PluralRules (Russian has three forms).
- Logical CSS only (`margin-inline-start`, `inset-inline-end`, `text-align: start`); explicit `[dir="rtl"]` handling for `translateX` and directional icons.
- In Hebrew, every poker token (cards, boards, positions, sizes, ranges, percentages) is an LTR island: `<bdi dir="ltr">` or the existing `.poker-island` class. The 13×13 matrix is never mirrored; mix bars stay LTR and their legend follows the bar (P1-30).
- Size controls for the longest language (Russian short labels can grow 200–300%): min-width, flexible width, no fixed text boxes; rows wrap gracefully.
- Mandatory notices are present but never nagging: 18+ / study tool / no real-money play (first run once, About & legal once it exists, one line where relevant).

## 6. Tables, cards, controls
- Hero always at the bottom of the table; seats rotate around; nothing overlaps seats.
- Select + confirm by default (Confirm carries the action and amount); one-time inline prompt offers one-click answering (P1-03). Keys per the DESIGN_SYSTEM keyboard contract (F fold, C check/call, B/R bet or raise, A all-in, digits = size presets, Enter confirms); keys never animate.
- No interactive elements nested inside buttons.
- Unique class names per component; a label never reuses a control's class.

## 7. Self-check before you report
| Grep / look for | Required |
|---|---|
| `transition: all`, `scale(0)`, `ease-in` on entrances | remove |
| `:focus` without `:focus-visible` | use `:focus-visible` with 3:1 contrast |
| `<div onclick>` or clickable non-buttons | real `<button>` |
| numbers without `tabular-nums` | add |
| `left`/`right`/`margin-left` in layout rules | logical properties |
| poker notation in HE text without isolation | wrap in LTR isolate |
| fixed-width text boxes | flexible sizing |
| hover-only affordances | add tap/keyboard path |
| missing reduced-motion handling | fades only |
| stale-content swaps, overlaps at 390 px | fix, then re-check |
| raw hex / ad hoc font sizes or weights | tokens |
| invented numbers in examples | golden spots |
Then: run the focused tests (`node --test …`), check Firefox at 1920 EN Midnight (HE if layout or direction changed), and for motion changes run `/review-animations` on your diff. Without a real browser check, report visual status as `UNVERIFIED`, `PARTIAL` or `STRUCTURAL ONLY`.
