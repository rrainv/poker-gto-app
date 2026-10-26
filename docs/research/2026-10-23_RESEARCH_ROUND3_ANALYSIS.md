# Research round 3: analysis (R-06 to R-10 + master synthesis), 2026-10-23

Five Gemini reports. Read in full; claims treated as "to verify". Each section: what it says, how trustworthy it is, what conflicts with owner decisions, what to adopt.

## Overall verdict
| Report | Value | Trust | Main use |
|---|---|---|---|
| R-08 Home & live games | **Very high** | Medium: real sources (Hand2Note live database, coaching sites) mixed with Reddit and [Judgement] estimates; one data error found | Baseline priorities, the spot generator, golden spots, Learn |
| R-07 Accounts & sync | **High** | Good: MDN/WebKit/Supabase docs, concrete and current | Data-safety ticket, phone↔PC transfer, later sync |
| R-06 Sound | **High** | Good: licences quoted per source, files named | The listening page; choose sounds by ear |
| R-10 Learn path | **High** | Good for structure; **its RU/HE terms are wrong** for us | Learn hub map and first lessons |
| Master synthesis | **Low as a brief, medium as an index** | Mixes outdated repo facts and invented precision; **contradicts several owner decisions** | Do not adopt as a brief; mine for 3 ideas |

## R-08 · What home and live games look like
**Key findings (with sources):**
- Live low stakes: ~55% of flops are multiway in a large tracked live database (Hand2Note, ~239k postflop hands); online 80–88% heads-up. Home games likely more multiway ([Judgement] 65–80%).
- 55–75% of unopened live hands have at least one limper; recreational players run 35–50%+ VPIP with 5–15% PFR.
- Live opens 4–7.5x bb; isolation over limpers often 6–10x bb. The owner's 30–60 bb game with 3–5x opens lands at **the same postflop SPR as a 100 bb live game with 5–6x opens** (SPR ~2.8–5.5): one baseline context can serve both.
- 20-spot ranked list of the most common home/live spots, each with an honest tier (most multiway and limp spots stay Estimated; heads-up single-raised, blind-vs-blind and low-SPR 3-bet pots can become Verified later).
- **Four failure modes of a heuristic baseline in these games:** (1) multiway c-betting and defence (equity share overstates playability; bluffs need each opponent to fold far more: 33% HU → ~58% each 3-way → ~69% each 4-way); (2) iso-raise vs over-limp over limpers (an off-tree, model-dependent decision; over-isolates offsuit broadways, under-overlimps small pairs and suited aces); (3) check-raises and donk leads (generic ranges ignore that live check-raises are strong and small donk bets are weak); (4) set-mining at 30–60 bb (needs an implied-odds gate: effective stack ÷ call ≥ ~15).

**Trust notes:** the database percentages are internally inconsistent (it prints "24% 3-way (71k), 31% 4+ (59k)": the hand counts imply ~30% and ~25%; the 45% heads-up figure is consistent). Spot frequencies are the researcher's estimates. The proposed "c-bet brake 1/k^1.4" formula is invented, not sourced. "ClubGG 0.1 bb per seat" and "3 user-named modes" come from old repo docs.

**Adopt (proposed):**
1. The 20-spot list as the **priority list** for golden spots, the spot generator's home-game scope, and baseline measurement contexts.
2. Four **baseline improvement candidates**, each as a separate ticket after the measurement harness exists (a heuristic change drops affected spots to Estimated until re-measured): implied-odds gate for set-mining and small suited hands; multiway caution for c-bets and calls (sourced rule, not the invented formula); action-conditioned opponent ranges (check-raise strong, small donk weak); iso-vs-overlimp rules with an explicit limper model.
3. A Learn lesson: "Why multiway is different" (compound fold maths: exact, nice to teach).

## R-07 · Accounts, sync and phone ↔ PC
**Key findings:**
- iOS Safari can **wipe all site data after 7 days without a visit** when Riverline runs in a normal tab; installing to the Home Screen and requesting persistent storage avoids it. Firefox shows a permission prompt for persistent storage; Chrome/Android grant it silently for installed apps.
- Split storage in two: small user data (hands, plan, settings, drill history; ~1–10 MB) vs large read-only solver packs later (OPFS / Cache, never in backups or sync).
- Moving data without accounts: one hand fits in a QR code (compressed into a link opened by the phone camera); sessions via share sheet / file; optional passphrase encryption with the browser's built-in crypto (no libraries).
- Later sync: Supabase (client already in the repo) with row-level security, client-side encryption, append-only hands and versioned plan snapshots; avoid WASM-heavy CRDT libraries; free tier pauses after 7 days idle.
- Privacy: stay accountless in M1/M2; before accounts, Israeli privacy notice (Section 11) + GDPR basics + one-click account deletion.

**Conflicts / cautions:** proposes new storage records (UUIDv7, revision hashes) → that is a **schema change and needs explicit owner approval** (AGENTS rule). Its storage-durability code is a sketch, not to paste.

**Adopt (proposed):** honest storage status in M1 (persisted / temporary tab with a calm "install or back up" note) inside DATA-SAFETY; one-file export early M2 (already planned) with optional passphrase; single-hand QR transfer in M2 with Game night/Hand capture; sync stays Later.
**Its questions for the owner:** QR scanning on the PC webcam too (adds a small MIT/Apache decoder) or phone camera only? On conflicting plan edits from two devices, keep the incoming version as a named copy (never merge silently)? Solver packs later: download on demand or bundled?

## R-06 · Real sound candidates
**Key findings:** 13 events × 5 candidates, quoted licences. Four sets: (1) Kenney CC0 dry studio; (2) Freesound close-mic home-game foley, CC0 + two CC-BY; (3) high-res Sonniss + OpenGameArt; (4) Zapsplat/Mixkit (packaged builds only). **BBC and Freesound CC-BY-NC are out** (no commercial use). Sonniss/Zapsplat/Mixkit/Pixabay forbid shipping raw files with source code: a trap if Riverline ever goes open source.
**Recommendation in the report:** a **Set 1 + Set 2 hybrid** (all CC0 / CC-BY): Kenney cards; Freesound clay chips, finger knock, soft clicks, latch confirm, warm brass chime for session finish. Mastering: trim, gentle low-pass, level targets; whole palette ~1.5 MB WAV or ~0.7 MB OGG+M4A (iOS needs M4A/WAV).
**Conflicts:** it ties sound to the Motion setting (e.g. "Instant" mutes table sounds). Our design keeps **sound and motion as separate settings**; only keyboard repeats stay silent. Its code is a sketch.
**Adopt (proposed):** prefer CC0, allow CC-BY with a credit line in About & legal; never Set 3B/4 files in the repo; Argon's AUDIO-RESEARCH ticket builds the listening page from these candidates (Set 1, Set 2, hybrid) for the owner to judge by ear.

## R-10 · Learn path
**Key findings:** a 58-concept map (beginner → advanced) with prerequisites, a typical mistake, an exercise idea and "exact maths / judgement / hybrid" per concept; first 8 lessons tied to Riverline's workspaces (positions & effective stack; price of a call; outs and the rule of 4 and 2 vs exact; implied odds at 40 vs 100 bb; ranges & combos & unknowns; building your preflop plan; …), each showing the source/tier labels.
**Conflicts:** its RU/HE terminology table **contradicts TERMINOLOGY.md** (e.g. RU «Проверено», «Оценка» vs our «Подтверждено», «Оценочно»; HE «טווח ידיים», «חוסמים», «מוערך» vs our «ריינג'», «בלוקרים», «משוער»; «бб» instead of Latin bb). Our sheet wins. Also mentions "Verified · Rule of 4/2": a mental shortcut compared with exact maths is better labelled as an approximation, not "Verified".
**Adopt (proposed):** the 58-concept map as the Learn hub's backbone draft (M2), the first 8 lessons as the starter set (they fit the planned 5–8 starter lessons), every lesson ending in a Riverline workspace and using golden numbers.

## Master synthesis ("Extended Brief v2.0")
**Do not adopt as our brief.** It reads old repo documents (CURRENT_PHASE, ClubGG, tickets from September) and turns suggestions into rules that **contradict owner decisions**: points-only Game night with no currency (owner kept money mode, D-32); mandatory brand change (owner kept Riverline, D-30); specific renames of the quick lookup; ClubGG accounting and tournament-like rules (dropped); invented tolerances ("ΔEV ≤ 2 mbb, ≥ 98% agreement") presented as certifications.
**Worth keeping (proposed ideas):** (1) **anonymise shared hands** automatically (Hero / BTN / BB instead of screen names or real friends' names); (2) a short **fair-play line** in the first-run confirmation (study tool, not for use during real-money play); (3) the optional desktop self-lock when poker clients run (already noted under D-33).

## Proposed changes to plans (owner to confirm)
1. **M1 plan:** GOLDEN-SPOTS uses R-08's 20-spot list; BASELINE-MEASURE adds the home-game contexts; four baseline improvements become M2 tickets after measurement (implied-odds gate first: simplest, highest value at 30–60 bb).
2. **DATA-SAFETY (Argon B6):** add the honest storage status and the iOS install note.
3. **AUDIO-RESEARCH (Argon B12):** build the listening page from R-06's sets.
4. **Learn (M2):** the 58-concept map + first 8 lessons as the draft curriculum, with our terminology.
5. **Brief:** add "anonymise shared hands" and the fair-play line to RIVERLINE_BRIEF.md; sound and motion remain separate settings.

## Questions for the owner
1. Adopt the five plan changes above?
2. Sound: CC0 only, or CC0 + CC-BY with a credit line (unlocks two of the best recordings)?
3. QR transfer: phone camera only, or also scanning on the PC webcam?
4. Two devices edited the same plan spot: keep the incoming one as a named copy (recommended), or ask every time?
