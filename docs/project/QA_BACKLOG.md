# Riverline persistent QA backlog

## BETA-REPAIR-SWEEP-B - September 10, 2026

**IMPLEMENTED; HUMAN VISUAL/LISTENING ACCEPTANCE PENDING.** Bounded presentation,
interaction, copy, delivery assets, sound and pacing repair. Frozen forest/jade
direction and canonical poker/strategy/Training authorities are retained. Pass C
has not begun. Existing QA IDs and accepted checkpoints keep their owners.

- Startup applies a revision/library-validated prepaint derivative, with the
  canonical theme owner as fallback. Unsaved previews never enter the startup
  cache. Firefox observed the selected default, Daylight and saved custom theme
  on first visible frames after reload and cache-disabled reload, plus remembered
  Home startup and Welcome startup.
- Custom theme derivation preserves user source colors, bounds dependent
  surfaces and derives text, support, status and focus roles against actual
  backgrounds. Follow-up CSS fixes cover raw-accent labels, selected runouts,
  disabled controls, transparent Home context and tinted Equity warnings.
  Firefox passed 280 settled rendered text/outline probes covering actual
  Home/sidebar/Explain nodes and production-class Equity fixtures across
  default, Daylight and six extreme/midtone custom surfaces. Text meets 4.5:1
  and the selected runout outline meets 3:1 in that exercised set; this does not
  claim an exhaustive WCAG audit of every product state.
- Welcome has a framed three-line hero. Home merges redundant destination
  panels, retains current truthful next-action/Review/Recent data, and flows its
  main sections independently of the compact Destinations rail. No new Home
  intelligence or Saved authority was introduced.
- Hand uses balanced seat anchors, a bottom Hero, restrained actor/fold cues and
  larger pot/name/position/stack/action typography. The nested table frame and
  height-based width cap are removed. Measured outer-rail widths across
  2/3/4/6/8/10 players are 824–862 px at 1920 and 519–543 px at 1366, under 5%
  spread per viewport. Pot capsule geometry fits the larger amount typography.
- Review gives the decision explanation 1126/736 px and the context rail
  484/320 px at the two viewports. Its full board fits 284 px without overflow.
  Context, navigation and Replay share stable column ownership; deeper study
  stays with the explanation. Replay changes scroll only the internal history
  (654/655 px content in 408/290 px viewports), with document scroll unchanged.
- Explain title/subtitle and reasoning use consistent logical insets. Equity
  roster growth uses available width, with six desktop players in one row and
  aligned header/cards/mode/results zones. Known Hero plus unknown opponents and
  calculated six-player results were exercised at both viewports. Weighted
  input remains in its existing optional Advanced Equity surface.
- Product formatting localizes Riverline to Риверлайн / ריברליין and removes
  em/en dashes from translated prose before user-value interpolation. Direct
  prose and unavailable markers were cleaned up without changing technical IDs.
  Copy retains uncertainty, unavailable states and heuristic truth limitations.
- Twenty WebP derivatives total 174,474 bytes; all original PNGs are preserved.
  Welcome loads three small derivatives. Existing lazy seat/preview loading and
  the portrait selection seam remain. This addresses delivery sizing from
  AUD-11, not final-art replacement or every possible cause of browser lag.
- Six Study meanings use distinct profiles with authority-gated normative
  outcomes, explicit Settings previews, and preserved category/master controls.
  Check retains its CC0 recording with a softer gain and longer natural tail.
  Full Hand uses action/street-specific comprehension pauses. Firefox observed
  five automatic opponents before Hero under normal and native reduced motion;
  reduced motion suppressed travel and retained readable pauses.
- Reproduction: `node tools/dev-web-server.mjs`, then
  `tests/tooling/verify_beta_repair_sweep_b_firefox.mjs` and
  `tests/tooling/verify_beta_repair_sweep_b_contrast_firefox.mjs` with Puppeteer
  supplied by `RIVERLINE_PUPPETEER_MODULE`. Firefox 155.0.1, 100% zoom,
  1920×1080 and 1366×768, disposable profiles. Welcome and Explain EN/RU/HE,
  Home, table counts, five-card/multiple-decision Review, internal replay scroll,
  2/3/4/6/10-player Equity and results, startup themes and live Training passed
  the scripted matrix with no page errors. Settings category switches disabled
  only their matching previews; Tab reached the expected next sound control
  with a visible focus outline, and seven preview gestures ran without page
  errors. These gestures are not listening acceptance. Screenshots were inspected for
  representative desktop/laptop/RTL layouts. This is not human sign-off.
- Validation closeout: focused tests and changed JS/MJS syntax passed;
  `git diff --check` passed. Exact full gate
  `node --test tests/*.test.js tests/*.test.mjs` passed: **2,545 tests, 2,545
  passed, 0 failed, 0 skipped**, 296.5 seconds. The final rerun includes the
  updated Training size-label expectation for the requested hyphen style.
- Retained acceptance: subjective sound distinguishability/volume/fatigue,
  Check feel, Full Hand pace, custom-theme visual preference and overall Beta
  composition require product-owner review. Existing `QA-AUDIO-MOTION-001`,
  `RET-AUDIO-001`, `QA-BETA-DESIGN-CORRECTION-002` and table/card Return IDs are
  not silently closed. No solver suite was needed; poker-domain files are
  unchanged. Pre-existing Pass A work and `.codex/config.toml` were preserved.

## BETA-REPAIR-SWEEP-A — September 10, 2026

**BOUNDED REPAIR IMPLEMENTED; EXACT FULL GATE AND FIREFOX CHECKS PASSED.** The prior audit
and combined two-human QA are complete and supplied this ticket's evidence.
This pass owns behavioral/semantic repairs only; B/C presentation and convenience
items, unrelated QA IDs and release/provider acceptance remain with their owners.

- Home/Explain shared root: card-preference selectors matched `<html>` and bound
  settings handlers to all bubbling clicks. Restricting them to buttons stops
  three preference events and downstream Home/Explain rebuilding on inert clicks.
  Deliberate Home navigation owns document-top reset; routine rendering never scrolls.
- Tutorial uses its existing capture-scroll/RAF owner without interpolated
  spotlight geometry. Active-only mutation/resize observation handles hidden,
  removed and moved targets and disposes on exit. Manual Learn reuses Welcome
  as a fixed modal with background inertness, scroll lock and restored focus/scroll.
- Analyze applies generated action/facing pairs after old-street reconciliation.
  The validated deterministic recipe is unchanged. Required showdown private
  drafts follow canonical reveal IDs regardless of Hero participation.
- Explain's native disclosures now retain their mounted nodes; shared Escape
  dismissal complements Enter/Space. Replay runtime labels have no static
  translation key that can overwrite them after reparenting (AUD-07).
- Advanced Equity shows the active exact/unknown/range input (AUD-08), clearing
  stale results on edits. Exact entered-hand outcomes separately expose category
  improvement and standing transitions; Ah6d/7h5s on 7dQhAd places remaining
  sevens under "Hand improves — loses lead", not "still behind" or winning outs.
- Strategy Truth intersects source claim ceilings and assessment permissions,
  including legacy normative grade output and historical re-drill (AUD-12).
  Heuristic semantics and production source registration remain unchanged.
- Auth diagnosis: local ignored public configuration exists; the required local
  Supabase SDK was missing. Restored pinned runtime dependencies without changing
  credentials/configuration. Missing SDK and missing config now have distinct
  notices with unavailable credential forms disabled. Real account sign-in/create
  remains unverified; no safe test account credentials were supplied or invented.

- Firefox 155.0.1 at 1920x1080 / 100%, plus 1366x768 for tutorial geometry:
  startup/navigation, inert Home clicks with/without tutorial at top/partial scroll,
  wheel/internal scroll, resize, target hide/removal, next/back and teardown passed.
  Learn bounds, background lock and workspace/scroll/focus restoration passed;
  final Learn and tutorial screenshots were inspected.
- Mounted browser checks passed for 120 applied Analyze seeds across all streets;
  all three Explain disclosures with click/Enter/Space/Escape; folded-Hero multiway
  private draft then explicit reveal; live/completed/imported Review Replay with
  reparenting, Previous/Next, route return and EN/RU/HE changes; exact Equity QA case;
  and separate missing-SDK/config auth paths. No page errors. Reproduce with
  `tests/tooling/verify_beta_repair_sweep_a_firefox.mjs`; report/screenshots:
  `C:/Users/sjzns/AppData/Local/Temp/riverline-beta-repair-a-x05UlD/`.
- Focused behavioral tests passed, including 3,456 deterministic complete Analyze
  spots over 2-10 players, all streets and Keep masks, change-only requests, private
  reveal blockers/partial drafts, mounted Advanced Equity active-input transitions,
  independent Strategy Truth ceilings and unavailable-auth service behavior.
  All 19 changed/new JS/MJS syntax checks and `git diff --check` passed.
- Exact final command `node --test tests/*.test.js tests/*.test.mjs` passed:
  **2540 passed / 0 failed / 0 skipped**, 289187.731ms, default concurrency.
  The initial run exposed a missing ignored Electron test runtime and a stale
  Replay assertion requiring the removed static translation key. Restored the
  local runtime and replaced that assertion with runtime label behavior coverage.
  Electron required execution outside the sandbox; the final exact gate passed
  in that environment. No shared poker-domain math changed; no solver gate run.
  Full log and exact 25-file manifest are in the browser artifact directory under
  `tooling/full-node-final.log` and `tooling/changed-files.txt`.
- Nothing staged or committed. The pre-existing `.codex/config.toml` modification
  is untouched; ignored local auth configuration and tracked dependency manifests
  are unchanged. This is bounded repair verification, not release acceptance.

## HAND-PREQA-001 - full-gate correction, September 9, 2026

**EXACT FULL NODE GATE GREEN.** This continuation corrects the five reported
failures after `BETA-HAND-PRE-QA-CORRECTION-001`. It does not close independent
human Beta QA, reopen accepted accounting, or change presentation direction.

- Classification before fixes: `ui_poker_primitives001` **B, stale source shape**;
  `table_physicality003` **B, stale source shape** (both asserted the old lane
  visibility expression); `replay_rail_nav001_correction` **B, stale source shape**
  (hard-coded maximum instead of canonical definition maximum);
  `explain_panel_interaction001` **D, environment-sensitive input harness**;
  `i18n001_runtime_integrity` **E, missing product localization**.
- Contribution tests execute renderer updates and verify exact amount writes,
  nonzero/zero visibility, ante-only lanes, separate blind/ante/voluntary labels,
  collection hiding, and reset removal. Physicality tests execute the shared
  primitives and retain distinct restrained remaining-stack/contribution/pot
  groups and one amount per group. Accepted product rendering is unchanged.
- Player-count tests execute the owning validation, selector synchronization and
  Start functions against the canonical controller. Invalid raw input is retained,
  marked invalid, disables Start and never reaches initialization. No-collection
  2-10 and fixed-collection 7-10 limits remain canonical; no clamping was added.
- Explain failed the unchanged isolation test four times. Temporary probes showed
  real overflow (758px scroll height / 298px client height), owned hit targets and
  working nested clicks, but no wheel event from native Electron sendInputEvent
  in its hidden Windows window. Mouse movement, unthrottling, wheel fields and
  offscreen probes did not restore delivery; Chromium Input.dispatchMouseEvent
  delivered a real wheel event and scrolled the same fixture by 180px. The worker
  now uses that browser input path with scroll/toggle completion events and bounded
  failure deadlines, not fixed sleeps. It asserts wheel delivery and actual panel
  scrolling. Missing worker evidence now fails rather than passing CSS assertions.
  Three consecutive corrected isolation runs passed, followed by the focused set
  and default-concurrency full gate. No product Explain CSS was changed.
- The new voluntary contribution caption in `TableRenderer.js` calls the existing
  translation system for `Action`. Added Russian and Hebrew translations; the
  catalog generates the English entry from its existing key union. Runtime tests
  verify EN/RU/HE. The bounded accepted fallback list was not expanded.
- Verification: all five affected files together **44 passed / 0 failed**; syntax
  checks passed for all seven changed JS/MJS/CJS files; `git diff --check` passed.
  Exact command `node --test tests/*.test.js tests/*.test.mjs` finished with
  **2533 passed / 0 failed / 0 skipped**, 223410.2502ms, default concurrency.
  Explain passed inside that run (3426.6979ms). Log:
  `C:/Users/sjzns/AppData/Local/Temp/riverline-hand-preqa-fullgate-correction.log`.
- Correction files (8): `app/src/locales/product-translations.js`;
  `tests/ui_poker_primitives001.test.mjs`, `tests/table_physicality003.test.mjs`,
  `tests/replay_rail_nav001_correction.test.mjs`,
  `tests/explain_panel_interaction001.test.mjs`,
  `tests/i18n001_runtime_integrity.test.mjs`,
  `tests/tooling/explain_panel_interaction001_worker.cjs`; this backlog.
  All unrelated prior work is preserved. Nothing staged or committed.

## BETA-HAND-PRE-QA-CORRECTION-001 - September 8, 2026

**IMPLEMENTED / FOCUSED FIREFOX VERIFIED; INDEPENDENT HUMAN BETA QA REMAINS SEPARATE.**
This correction does not reopen the accepted BETA-BLOCKER repair or close other QA IDs.

- Ante Hands show canonical posted blind/ante amounts on the existing contribution
  anchors; voluntary street payments have a separate Action caption. No-ante felt
  markers retain their existing presentation. Players and contributions exposes
  the forced-payment breakdown. Replay initialization remains a transition, with
  no invented voluntary ante action. Canonical accounting files are unchanged.
- Hand's Home/ClubGG Game mode selector is replaced by Rake / collection: none or
  fixed collection, with the existing 0.1 bb/player outside-pot contract and 7-10
  seat limit read from canonical definitions. Ante controls remain explicit.
  Old gameMode inputs use the existing compatibility adapter without data migration.
- The reported Hero-fold disable condition was **not reproduced in the current
  live path before edits**: Firefox already enabled the pending river randomizer
  with Hero folded and both opponents all-in. No Hero-dependent root cause is
  claimed. Availability now has an explicit pending-public-chance/card-pool/busy
  projection, the button visibly says Random River, and invocation rejects
  read-only Replay. Unit and mounted checks protect folded/all-in Hero runouts,
  terminal/no-chance rejection, draft-only changes, and committed board/history.
  If the human issue recurs, the next QA owner should retain its exact interaction
  path and Replay/live state; this ticket does not claim that unidentified path fixed.
- Verification: 87 focused tests passed; changed JS/MJS syntax and git diff --check
  passed. No full Node suite or solver run. Firefox at 1920x1080, 100%, Daylight:
  actual setup/start with fixed collection, initialized five-seat BBA, folded-Hero
  Random River -> Commit, Replay read-only and return-to-live all passed, zero page
  errors. Final screenshots were inspected; artifacts:
  `C:/Users/sjzns/AppData/Local/Temp/riverline-hand-preqa-AVnaKr/`.
  Reproduce with `node tests/tooling/verify_hand_preqa001_firefox.mjs`.
- Ticket files (16): `app/index.html`; application `canonical-live-controller.mjs`,
  `hand-setup-rules.mjs`, `hand-pending-randomization.mjs`,
  `playbook-mode-bootstrap.mjs`, `table-presence-view-model.mjs`; `core/logic.js`;
  `ui/TableRenderer.js`, `ui/riverline-design.css`; `locales/product-translations.js`;
  tests `hand_preqa001_correction.test.mjs`, `beta_design_correction002.test.mjs`,
  `design006_playbook_workspace.test.mjs`, `tooling/verify_hand_preqa001_firefox.mjs`;
  this backlog and `PRODUCT_SPEC.md`. All prior work outside this list is preserved.
  Nothing staged or committed.

## BETA-BLOCKER-REPAIR-001 — September 8, 2026

**COMPLETE FOR THIS BOUNDED REPAIR; BROADER HUMAN BETA ACCEPTANCE REMAINS SEPARATE.**
This bounded repair owns only AUD-01/02/03/04/05/13. It does not close the prior
design-refresh owners, live cloud/RLS gates, or the later Beta Repair Sweep.

- **AUD-01 P0 ? IMPLEMENTED:** approved correctness-first compatibility preserves
  historical source inputs and rederives accounting centrally. The HU reproduction
  is 3bb / 16.67% / SB102 / BB98 with no ante refund. Independent money tests cover
  BBA, individual/short antes, folds, all-ins, side pots, ties and ordinary refunds.
  Saved Hand v1/v2/v3 uses a pure current-Replay adapter; legacy exact Spots require
  same-owner lineage or return unavailable. Current ante Spots use nested v3.
  Recorded source settlement is immutable. Training frozen evidence remains raw
  and incompatible exact reuse fails closed. No alternate old accounting engine.
- **AUD-02 — IMPLEMENTED:** stack-exhausting calls remain canonical calls; exact
  amount, all-in marker and raise-to checks still fail closed.
- **AUD-03 — IMPLEMENTED:** Analyze/workspace exit and invalid Review models reuse
  the existing teardown. Mounted Firefox verifies completed Review and imported
  Review over a retained live Hand, direct and via Training, preserving exact Hand
  state. Incomplete live Hands have no direct Review entry in the current product.
- **AUD-04 — IMPLEMENTED / HUMAN ACCEPTANCE PENDING:** contained in-flow rail,
  adaptive stage facts and laptop column reservations. Mounted Firefox checks
  Daylight 2/6/10-max at 1366×768 and 1920×1080, 100%, with optional tutorial
  skipped. Vertical page/rail scrolling remains available; no core horizontal
  overflow. This does not certify broader subjective table physicality.
- **AUD-05 — IMPLEMENTED:** bounded scheduled continuation and truthful completion;
  executing scheduler covers upload 0/1/24/25/26/49/50/51/76 and download
  0/1/499/500/501/999/1000/1001, fences, failures/retry and duplicate-run protection.
- **AUD-13 — BASELINE EXPECTATIONS RECONCILED:** all seven audited failures were
  stale implementation/visual expectations (B), including shared anchor ownership,
  accepted Advanced Equity, inherited Personal grid, removed debug oval and
  count-specific HU geometry. Distinct panels and opposing HU ownership replace
  obsolete universal widths/gaps; exact full-suite evidence is in the ticket report.

Reproduction/verification: `tests/beta_blocker_accounting.test.mjs`,
`tests/beta_blocker_import.test.mjs`,
`tests/beta_blocker_sync.test.mjs`, and
`tests/tooling/verify_beta_blocker001_firefox.mjs` (real mounted app, temporary
profile, local loopback server, screenshots). No real account/cloud interaction.

## QA-BETA-DESIGN-CORRECTION-002

**IMPLEMENTED / INDEPENDENT HUMAN BETA QA PENDING**, September 7, 2026.
Owner: final broad design correction; remaining subjective polish and reproduced
defects move to the bounded Beta Repair Sweep. **Design direction is frozen.**
No earlier QA or Return owner is closed. Enabled browser/app inventory was empty;
no running-app screenshots, viewport validation or visual acceptance are claimed.

Implemented corrections: draft Hand projection plus renderer-ready handshake;
shared per-count Hand/Scenario geometry and removal of inner construction guides;
active Analyze result versus unavailable state; neutral analysis/evidence and
warmer learning roles through the existing theme owner; subtle Equity identity
edges, compact Matchup editing and card-first inspection; grouped Personal
sentences and explicit exact-frequency evidence count; auto-flow Home, Welcome
contrast/wrapping and quieter active navigation. Portraits remain **TEMPORARY
BETA ART**, with a clean `opponentPortrait` asset seam and consistent framing.

### Exact independent human checklist

Use **Firefox, 1920×1080, 100% zoom**. Repeat the structural/overflow pass at
**1366×768, 100%**; optional 1440×900 and 2560×1440. Capture full-window evidence
and record language, theme, viewport, steps, expected/actual result for failures.

| Surface | States / acceptance checks |
|---|---|
| Hand | Reload with Players=2 before Start: exactly Hero + one opponent, explicit preview, no cards/actions/pot. Change 2→6→10, Hero, button and stack: immediate preview, no Hand created. Start live 2-, 6-, 10-max; also inspect 3-, 4-, 8-max geometry. Hero/lower/top clearance, seat-owned cards, separate contributions/pot, dealer, fold/all-in/actor and accepted three-region layout. No dotted inner ellipse or center guide. |
| Analyze | Unavailable/readiness and valid heuristic recommendation; active result/mix/qualification, structured facts, open/closed Explain, quiet provenance. Inspect 2- and 8-max table. Valid heuristic warning must not look disabled or imply solved/success evidence. |
| Training | Full Hand idle lineup, change player count/Hero position; start live 8-max, change a portrait, advance and fold a player, then review. Identities readable, folded seats subdued, no preview cards/pot/actions or behavior changes from appearance. |
| Equity | Empty 2-player input; calculate 3-player result. Resting identity edges versus keyboard/edit focus. Expand Ranges & runouts, edit an exact hand/range through its local disclosure, calculate, inspect every supported next-card group and focus/hover/click details. Partial/unknown labels remain visible. Check Ah after Hero As Ad / opponent Jh Th / board Kh Qh 3c 2h: category improves while Equity falls. Cancel/edit during scan and inspect turn→river; no stale output/internal IDs. |
| Personal | Normal and long Understanding without a question use available width. Active Mapping question remains primary. Check grouped boundaries/patterns/unknowns/precision/conflicts and small coverage map; exact-frequency count includes explicit pure/exact mix, excludes dominant-only/estimates. Original sentences and Matrix editing remain accessible. |
| Home | Empty Guest and existing real Recent/Saved content: sections pack upward, Recent adjacent/below study, no stranded lower-right section or invented continuation. |
| Welcome | Fresh startup and manual reopen: headline/illustration/four paths, Enter Riverline → Home, suppression applies only to Welcome. Check secondary text, path contrast and RU/HE wrapping; close/Escape correctly. |
| Themes / access | Repeat surface checks in Midnight, Daylight and a custom surface/accent/felt preview→save→edit→cancel→reload flow. Test EN/RU/HE/RTL; card/numeric tokens LTR. Tab/Enter/Space/Escape, focus return, unclipped rings/popovers, warnings/errors/disabled states, independent card suit/T/10 settings and reduced motion. Portrait duplicates remain decorative; identity controls have names. |

### Bounded performance evidence and return path

Reproduce CPU/asset inventory with `node tests/tooling/profile_beta_design002.mjs`.
Node v26.5.1, median of seven 2,000-call batches after warmup:

| Work | Measured time / size |
|---|---|
| Built-in feature-role derivation | 0.1412 ms/call |
| Custom feature-role derivation | 0.3618 ms/call |
| 10-seat idle lineup projection | 0.0160 ms/call |
| Ten original PNGs, each 1254×1254 | 20,501,764 compressed bytes; 62,900,640 bytes decoded RGBA estimate (~60 MiB), excluding browser overhead |

These are CPU measurements and an asset-size estimate, **not browser latency**.
Read-only mounted-DOM audit found 49 detail nodes recreated on each same-card
focus/hover/click (147 across three events). The correction reuses that detail;
card-preference changes force refresh. Repeated identical SVG portrait `href`
writes are removed; HTML lineup/picker images use async decode/lazy loading.
This does not prove image decoding or reported intermittent lag is resolved.
Geometry/lineup signatures, inactive Training guards, cancellation/stale fences
and PERF-001 remain intact. No speculative theme/render scheduling rewrite.

Beta Repair Sweep: record Firefox Performance traces with cold then warm assets
for workspace switches, Hand count slider and action progression, Full Hand
8/10-max roster/progression, live theme changes, Equity card edit/recalculate and
Ranges opening/group/focus, Personal Understanding↔Mapping, Welcome→Home.
Compare scripting, style/layout, paint and image decode; record long-task stacks
and repeated listeners/work per action. Profile with and without the portrait
requests in a local diagnostic session to isolate asset cost. Smaller delivery
assets and final art replacement remain explicit follow-up, not accepted art.

Verification: **203/203 focused tests**, then **27/27 affected checks** after the
final geometry-parity/precision assertions and dead-guide cleanup (groups overlap).
All **30** changed/new app/test JS/MJS files pass `node --check`; normal
`git diff --check` passes. Coverage includes draft reload/input/canonical boundary,
2–10 seat clearance, theme/custom lifecycle and contrast, mounted Equity/Personal,
Welcome/Home, EN/RU/HE, focus, audio/reduced motion and PERF-001. No solver or
full-repository suite; nothing staged or committed. Structural tests do not
establish Firefox viewport fit or visual acceptance.

### Earlier Beta acceptance owners

`QA-BETA-FEATURE-SURFACE-REFRESH-001` — **IMPLEMENTED / HUMAN VISUAL QA PENDING**,
owner `BETA-FEATURE-SURFACE-REFRESH-001` + theme hardening + `WELCOME-REFRESH-002`
+ visual bug sweep. The preceding bold identity is directionally accepted;
this follow-up preserves it. Browser inventory has no enabled surfaces, so no
running-app screenshot, viewport, pointer or visual acceptance is claimed.

Run every row at **1920×1080 and 1366×768, 100% zoom**; optional 1440×900 and
2560×1440. Repeat in Midnight, Daylight and a saved custom theme, EN/RU/HE with
Hebrew RTL. Keep poker/card geometry LTR and localized UI in document direction.

| Surface | Exact states and checks |
|---|---|
| Hand | 2-, 6-, 10-max, setup/live/review: Hero bottom; top and lower-side clearance; owned card backs; distinct pot, contributions, dealer, stack and action; all three Hand regions remain usable. Also inspect 3-, 4-, 8-max seat geometry. |
| Analyze | 2- and 8-max recommendation + table; action/mix/source/qualification primary, facts secondary, Explain open/closed, range reachable. |
| Training | Idle Full Hand at 8-max, then change Hero position, player count, stack, assistance and opponent target/preset/focus. Preview contains no cards/pot/actions. Start live 8-max, choose different portraits per seat, advance/fold/review; appearance does not alter policy. |
| Equity | Empty 2-player input; 3-player result; expanded Ranges & runouts. Rename a player; inspect exact and known-only partial results, all next cards, every group, card focus/hover/click, and selected turn→river sequences. Ah after Hero As Ad / opponent Jh Th / board Kh Qh 3c 2h improves Hero's category while losing Equity. Cancel/edit during scan; no stale result or internal player IDs. |
| Personal | Normal Understanding and long report without active mapping: use full available width. Active mapping: question left, understanding right, stacked when constrained. Coverage map labels known/estimated/unknown/conflict evidence; no fabricated frequencies/confidence. Coach has one primary question; context and exact Matrix editing remain available. |
| Welcome | Fresh startup, Enter Riverline → Home, four explicit study paths, secondary Equity/Guide; checkbox affects only Welcome. Manual reopen/close/Escape returns correctly; no silent workspace selection or fake continuity. Home retains real data/empty states. |
| Controls/themes | Tab/Enter/Space/Escape, disclosure focus return, portrait selects, next-card focus, long labels and popovers. Preview custom surface/accent/felt, duplicate/save/cancel/reload. Check card T/10 and suit themes independently. Reduced motion removes travel/lift; appearance has only the existing gated selection tick. |

Automated follow-up: **180/180 focused tests** (including 219 feature-theme color
combinations, 2–10 seat clearance, canonical lineup identity, mounted labels/map/
idle behavior, Welcome, i18n, audio/motion and PERF-001). Structural evidence is
not browser acceptance. All **24** changed/new JS/MJS files pass `node --check`;
normal `git diff --check` passes. No full-repository or solver suite was run.
Nothing staged or committed. Previous QA/Return IDs remain open with their owners.

`QA-BETA-DESIGN-REFRESH-001` — **FIRST PASS REJECTED / BOLD DIRECTION ACCEPTED / DETAILED QA PENDING**,
owner `BETA-DESIGN-REFRESH-001`. [Presentation scope](PRODUCT_SPEC.md): shared
panel/readability grammar, projected actor/dealer context, fictional per-seat
cast in Full Hand Training, full-width Ranges & runouts, shared card faces,
Explain/Coach/Personal/Inbox hierarchy and restrained focus/motion states.
September 7 browser inventory returned no enabled apps/browsers. No visual
acceptance is claimed. Mounted tests cover EN/RU/HE cast selection, canonical
seat binding, unchanged policy requests, stale-result cancellation, disclosure
Escape/focus and existing Personal/Training/Hand/Equity flows. The correction
adds forest/jade/brass identity, distinct game/study surfaces, stronger controls,
ten original illustrated portraits, localized seat subtitles, prominent coaching
and result hierarchy, and initially expanded Runout Explorer. All ten image
assets were visually inspected; the running application was not.

Bold-pass automated evidence: **50/50** initial table/component checks;
**90/90** mounted portrait/Equity/localization/tutorial/theme/audio/motion/PERF
checks after keeping the renderer free of audio calls; **45/45** final mounted
portrait/table/integration/shell/components checks. Groups overlap. All **13**
ticket JS/MJS files pass `node --check`; `git diff --check` passes with the
repository's normal CRLF handling. These are not screenshot acceptance.

Earlier structural-pass evidence: main affected regression group **293/293**; localization
and tutorial group **31/31**; additional shell/components/opponent/Training
group **58/58**; final mounted refresh/Advanced Equity/Exploit/documentation
group **21/21** after corrections. These groups overlap. The unchanged 500bb
always-raise stress case was explicitly excluded from the extra opponent run;
the ordinary complete-hand replay and hidden-card counterfactuals passed.
All **12** changed/new JS/MJS files passed `node --check`; `git diff --check`
passed. No full-repository or solver suite was run. Nothing staged or committed.

Exact visual QA, **1920×1080, 100% browser zoom**, Midnight, Balanced layout,
comfortable density, expanded navigation. Capture one full-window screenshot
per row; compare with the rejected pass. The new identity and game/study
separation should be apparent immediately, within five seconds.

| Workspace | Steps | Visual acceptance |
|---|---|---|
| Analyze | Open an existing decision, show its matrix and Explain; expand evidence/caveats, then Escape. | Large primary conclusion, recognizable active navigation, clear range/category colors, quieter caveats; no clipping or text/border collisions; Escape returns focus to the summary. |
| Hand | Open a 6-max hand; deal/advance an action, inspect actor and dealer, then replay a folded/all-in state. | Rich felt and substantial rim; pot, stacks, action badges and dealer remain distinct; no card/label overlap or private-card disclosure; real/imported player identities remain intact; primary actions remain reachable. |
| Training Full Hand | Start 6-max; open Table cast, assign Mika, Nova and Otto to different opponent seats; close it and play an action. Repeat at HU and 10-max; fold a seat and enter review. | Different faces, names and short subtitles coexist and survive actions; position, stack, current action and actor/fold state remain readable; Hero is excluded; portrait changes do not change behavior settings or grading. |
| Equity | Enter Hero As Ad, opponent Kh Kd, board Qh Jh 2c; calculate. Open Ranges & runouts, change opponent to explicit range KK:1, calculate; inspect available turns and best five. Cancel a new run, then reopen the disclosure. | Hands/board/dead-card zones are distinct; main Equity is prominent with method/partial truth visible; Runout Explorer is expanded and feels like a focused workspace; selected cards/best five are clear; cancellation clears stale output and preserves the draft; opening alone does not calculate. |
| Personal Strategy | Open an existing taught node and Coach prompt; inspect range insights, open supporting evidence, then enter the hand-teaching stage. | Primary question stands out; insight categories are recognizable; support/evidence is quieter; teaching controls and Matrix remain reachable without cropped text or a wall of equivalent cards. |

Repeat representative rows at **1366×768** and a **1100px-wide desktop window**;
table plus primary actions should fit without horizontal page scrolling. Check
EN/RU/HE, RTL, Daylight and a custom theme; poker geometry stays LTR. Tab through
navigation, cast selects, range controls and disclosures; verify visible focus,
native Enter/Space and Escape return. Switch T/10 and two/four-color cards.
With reduced motion enabled, verify no travel, hover lift or disclosure animation.
With sound enabled, a character change has one neutral tick; mute, Study off or
volume zero suppress it. Existing deals/actions retain their original foley;
this correction adds no reward sounds. Portraits remain runtime appearance,
not policy configuration or durable replay evidence. All other QA/Return IDs
retain their status and owners.

`QA-ADVANCED-EQUITY-001` — **PARTIAL / HUMAN ACCEPTANCE PENDING**, owner
`ADVANCED-EQUITY-001` + `WEIGHTED-RANGE-EQUITY-001` + `RUNOUT-EXPLORER-001`.
[Advanced Equity v1 and human matrix](ADVANCED_EQUITY_V1_SPEC.md): weighted joint
sampling/enumeration, unknown-preserving partial results, bounded runout/card
previews, Personal trajectories and explicit Exploit range hypotheses.
September 7 browser inventory had no enabled apps/browsers. Verify the compact
disclosure/results, cancellation/input edits, keyboard/hover/tap preview,
source facts, Personal/candidate changes, EN/RU/HE/RTL and desktop themes.
Existing Equity/Personal/Exploit QA owners keep their statuses and scope.

`QA-REFERENCE-STRATEGY-002` — **PARTIAL / HUMAN ACCEPTANCE PENDING**.
[Source foundation and human matrix](REFERENCE_SOURCE_FOUNDATION_V1_SPEC.md):
SHA-256 identities, exact/incompatible coverage, claim ceilings, private local
preview, immutable health/history and EN/RU/HE messages are automated. Browser
inventory was empty September 6; visual/keyboard/RTL acceptance is unverified.
Check Analyze Limits & caveats with no source and development-only exact,
unaccepted and stack/size/rake mismatch injection. There is no import UI or
production source. `QA-REFERENCE-PACK-001`, `QA-PREFLOP-REFERENCE-001` and
`RET-REFERENCE-PACK-001` retain their existing acquisition/acceptance ownership.

`QA-DEEP-STUDY-001` — **PARTIAL / HUMAN ACCEPTANCE PENDING**, owner
`DEEP-REVIEW-001` + `STUDY-INBOX-001` + `DECISION-DELTA-FOUNDATION`.
[Scope and human matrix](DEEP_REVIEW_STUDY_INBOX_V1_SPEC.md): separate roles,
deterministic reasons, owner-projected Inbox, Saved annotation/parent continuity,
import uncertainty, current intent inspection and existing Training routes.
Behavioral and mounted EN/RU/HE checks are structural only; browser inventory was
empty September 6. Verify played/imported/policy completion, exact seeking,
Review later → Inbox → reload, notes/Situational, intent changes, due/re-drill and
active-session guards, policy setup, partial sources, Guest/account transitions,
keyboard/focus/RTL, narrow desktop and both themes. Earlier Review priority,
Import, Personal, Opponent and Saved QA IDs retain their owners and statuses.

`QA-HAND-HISTORY-IMPORT-001` — **PARTIAL / HUMAN ACCEPTANCE PENDING**, owner
`HAND-HISTORY-IMPORT-001`; [scope/acceptance](HAND_HISTORY_IMPORT_V1_SPEC.md).
Source/reconstruction/settlement/Replay/Saved/owner/intent boundaries are automated.
September 6 browser inventory is empty. Human QA: paste/file, warnings and disabled
unsafe Open, gross/rake/net result, shared Review/Analyze, Save/reload/deduplication,
repeated Review later/Situational, intent/practice unavailability, owner changes,
keyboard/Escape, EN/RU/HE/RTL, Midnight/Daylight and constrained desktop. Earlier
QA owners are unchanged.

`QA-EXPLOIT-ANALYSIS-001` — **PARTIAL / HUMAN ACCEPTANCE PENDING**, owner `EXPLOIT-ANALYSIS-001`. [Exploit Analysis v1](EXPLOIT_ANALYSIS_V1_SPEC.md) adds behavioral response/authority/Personal/Training/Review and EN/RU/HE/RTL mounted checks. Browser inventory on September 6 was empty. Human QA: same Hero node/size across three policy explanations; facing-call partial model; Personal check evidence, region teaching, candidate inspection and Keep; unsupported Practice feedback; completed policy Full Hand Review with separate roles and Replay navigation; keyboard/focus, language/RTL, 1366×768/narrow desktop and Midnight/Daylight compactness. Structural checks do not close this gate or earlier Bluff/Personal/Opponent/Review issue IDs.

`QA-BLUFF-EXPLOIT-TEACHER-001` — **PARTIAL / HUMAN ACCEPTANCE PENDING**, owner `BLUFF-EXPLOIT-TEACHER-001` + `OPPONENT-AWARE-COACHING-001`. [Teacher v1](BLUFF_EXPLOIT_TEACHER_V1_SPEC.md) has focused facts/authority/economics/request/locale/RTL/mounted lifecycle coverage. September 6 browser inventory returned no enabled apps/browsers. Human QA: postflop Analyze Explain and selected Teach-through-a-Hand combo; same-size policy comparison; facing-call/raise and invalid input; combo/Approach changes; lesson usefulness/compactness; keyboard, EN/RU/HE/RTL, narrow desktop and Midnight/Daylight. Exact semantic drills, quantitative role/Equity outputs and one-click/source-node continuation remain unavailable. Existing issue IDs retain their status and owners.

Additional evidence for existing `QA-PERSONAL-COACH-001`: CONTINUATION-001C consolidates the duplicate Coach introduction into the hand-study guidance and restores `calibration.setup` to the tested seven-step bound. Tutorial inventory and EN/RU/HE completeness now pass. This structural fix does not close human product acceptance.

Last consolidated: September 5, 2026 (`MASSIVE-FOUNDATION-CHECKPOINT-001` closes the accepted automated foundation; named browser/live-provider acceptance debt remains open).

This is the authoritative issue-routing file for historical and current QA. Code/tests/latest accepted ticket reports determine actual closure.

The massive foundation checkpoint accepts the automated Identity Lifecycle A/B/C, heuristic/reference/normative truth separation, assessment-policy, first Training Intelligence, and Personal Strategy Intelligence foundations. The detailed `OPEN`/`PARTIAL` rows below continue to track unperformed human browser, RTL, accessibility, and live-provider acceptance; any earlier row-level note about known whole-suite failures is superseded by this checkpoint's final global gate.

## Status vocabulary

- `OPEN`: not addressed
- `ACTIVE`: owned by the current ticket
- `PARTIAL`: structural or incomplete fix; requires more work or live acceptance
- `CLOSED`: accepted behavior fix
- `REMOVED`: feature/control intentionally retired
- `DEFERRED`: accepted future owner exists
- `REGRESSION`: previously better/closed behavior broke

A visual issue is not `CLOSED` without manual/browser confirmation.

The current minimum supported desktop viewport remains **1366×768**. Findings observed only at 1024×768 or similarly compact layouts remain useful compact/mobile-responsive future evidence, but they are not promoted to current blockers without a separate product decision.

## September Alpha audit foundation owners

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-AUTH-TRAINING-MEMORY-001 | COMPLETED / ACCEPTED | Training Memory now resolves authentication-aware owner scope rather than raw AccountIdentity storage routing. Auth/owner generation invalidates queued and in-flight reads/writes; explicit sign-out revokes local access before provider cleanup, provider failure cannot restore it, and A → Guest → B / A → Guest → A isolation is covered without deleting account bytes. | `AUTH-TRAINING-MEMORY-001`; human/security accepted August 31, 2026 |
| QA-DECISION-ECONOMICS-001 | COMPLETED / ACCEPTED | Canonical pot accounting was correct; the defect was actor-relative strategic pricing. `deriveActorCallEconomics(state, actorPlayerId)` is the canonical selector; exact incremental stack-capped call, actor-contestable/ineligible pot-after-call, and raw-equity facts remain unavailable rather than falling back to total pot when evidence is absent. Legacy contexts remain readable and distinguishable from actor-exact pricing. | `DECISION-ECONOMICS-001`; human accepted August 31, 2026 |
| QA-STRATEGY-TRUST-001 | COMPLETED / ACCEPTED | Strong strategy authority can no longer be self-declared. Provider declarations pass structural/source validation and then an application-owned acceptance gate before bounded authority reaches StrategyResult and StrategyClaimPolicy. Reference acceptance binds exact source ID, version, and content fingerprint; changed bytes, mismatches, and revoked/superseded registry state fail closed. Live opaque acceptance is not persisted as trust, while historical evidence freezes durable answer-time authority metadata and ClaimPolicy. | `STRATEGY-TRUST-001`; accepted August 31, 2026 |
| QA-DECISION-CONTEXT-SINGLE-AUTHORITY-001 | COMPLETED / ACCEPTED | Scenario now projects only through `deriveDecisionContextFromPlaybookScenario()`, Hand through `deriveDecisionContextFromPokerState()`, and `resolvePlaybookDecisionContext()` selects the authority. The classic `logic.js` projector, local reconstruction/injection seams, and synthetic missing-projection StrategyResult are removed; missing or failed canonical dependencies clear stale state, render unavailable/error truthfully, and recover when restored. | `DECISION-CONTEXT-SINGLE-AUTHORITY-001`; accepted August 31, 2026 |
| QA-CARD-CLEAR-SEMANTICS-001 | COMPLETED / HUMAN ACCEPTED | One shared DOM-free owner defines `CLEAR_HERO`, `CLEAR_PLAYER_HAND`, `CLEAR_FLOP`, `CLEAR_TURN`, `CLEAR_RIVER`, `CLEAR_BOARD`, `CLEAR_DEAD_SET`, `CLEAR_DEAD_CARD`, `CLEAR_ALL_EDITABLE`, and `CLEAR_PENDING_CARD_SET`. Hero/private clears preserve board/dead; Flop clears Flop+Turn+River; Turn clears Turn+River; River clears only River; dead single/set clears remain distinct; empty clears are no-ops; canonical Hand history is protected. Analyze and Equity share whole-set Dead Cards draft/toggle/Apply/cancel semantics, slot-style resting presentation, and overlay geometry isolation. | Preserve `CARD-CLEAR-SEMANTICS-001` and focused regression coverage; human accepted September 1, 2026 |
| QA-LIGHT-WINS-BATCH-001 | COMPLETED / HUMAN ACCEPTED | Analyze Scenario, top-level Hand / Analyze Hand Mode, and Equity passed human browser QA. Analyze whole-spot generation is atomic and readiness-valid under `analyze-whole-spot-policy/v2`; Hand rerolls only the pending uncommitted chance draft and preserves canonical commit/history; Equity preserves matchup structure, board/dead cards, and explicit calculation while rerolling only requested Known hands or board streets. EN/RU/HE, RTL, restrained utility presentation, and concise factual feedback are accepted. | Preserve `LIGHT-WINS-BATCH-001` and focused regression coverage; human accepted September 4, 2026 |
| QA-IDENTITY-LIFECYCLE-001 | OPEN / HUMAN ACCEPTANCE PENDING | Slices A/B/C implement lifecycle isolation, durable Guest work, bounded meaningful-data detection, explicit Move/Keep/Cancel, and journaled promotion/recovery. Automated checks cover domain-byte preservation, stable Training ownership, restart/idempotency, cancellation and sync consent isolation. Browser inventory was empty and in-app browser launch unavailable. Human QA: EN/RU/HE including RTL, keyboard trap/restoration, Move then sign-out to fresh Guest, Keep then sign-out to original Guest, Cancel/provider cleanup failure, already-bound A/B isolation, and live Supabase interruption/restart/recovery sign-in. No umbrella acceptance is claimed. | `IDENTITY-LIFECYCLE-001` |
| QA-HEURISTIC-BASELINE-TRUTH-001 | PARTIAL / HUMAN QA PENDING | Shared truth projection constrains heuristic authority to exploratory baseline comparison; neutral feedback/audio, categorized metrics, frozen Memory/revisit semantics and primary Analyze qualification implemented. Focused behavioral/localization checks pass; browser visual acceptance unverified. | Human: EN/RU/HE + RTL Analyze/Training/Review/Same Spot and neutral audio acceptance |
| QA-TRAINING-INTELLIGENCE-001 | OPEN / HUMAN ACCEPTANCE PENDING | Optional pre-reveal uncertainty, explicit 24-hour exact revisit, why-returned projection, overrides, historical answer embargo and owner/request fences are implemented. Browser inventory was empty and in-app browser unavailable. Human QA: Varied/Focused uncertainty then request/reload, idle Practice now/due revisit, earlier answer and hints hidden, R cannot replace the exercise, completion versus Back before answer, active-session block, Snooze/Stop, owner change, EN/RU/HE/RTL and keyboard. No retention/transfer/correctness acceptance is implied. | `TRAINING-INTELLIGENCE-001`; contract in `TRAINING_INTELLIGENCE_V1_SPEC.md` |
| QA-TRAINING-NORMATIVE-001 | PARTIAL / HUMAN QA PENDING | Explicit application-owned action-set assessment policy is separate from source acceptance. Exact source/context/capability/sizing gates and minority supported actions are tested; no production normative registry or accuracy/EV/retention/transfer claim. | Human review of gate contract and presentation; future source acceptance is separate |
| QA-BROWSER-TEST-PLATFORM-001 | OPEN / FOUNDATIONAL | Riverline needs portable mounted-browser lifecycle tests that exercise real mounting, focus, modals, account changes, inactive workspaces, generation cancellation, and disposal rather than source-pattern substitutes alone. | `BROWSER-TEST-PLATFORM-001` |
| QA-UI-COMPOSITION-ROOT-001 | OPEN / FOUNDATIONAL | Root UI orchestration and lifecycle ownership remain concentrated in `logic.js`. Define a bounded composition root, then prove one workspace extraction pilot without a React/Redux/framework rewrite. | `UI-COMPOSITION-ROOT-001` |
| QA-DOCS-CONTINUITY-001 | CLOSED / AUDIT TRIAGE | Live planning authorities now share the post-audit order and stable product truths; historical reviews are prominently labelled and Home Game, Guest lifecycle, Training Memory, Saved retrieval, OpponentPolicy, heuristic, and viewport contradictions are corrected without inventing a new planning authority. | `AUDIT-TRIAGE-001`; preserve through `DOCUMENTATION_GOVERNANCE.md` |

## September Alpha blind findings — disposition in progress

Accepted bounded tickets close only their exact rows below. Remaining rows retain their explicit reproduction or implementation owner; acceptance of one repair does not close unrelated findings.

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-AUDIT-EQUITY-EXACT-OPPONENT-001 | COMPLETED / ACCEPTED | Specific structural completion-card identities exclude the complete entered known-card set: all known hole cards, board, and dead cards. Exact entered-hand outcome authority remains unchanged. | Preserve `AUDIT-CHEAP-FIX-BATCH-001` and focused regression coverage |
| QA-AUDIT-FULL-HAND-MEMORY-LEAK-001 | COMPLETED / ACCEPTED | Live Full Hand may persist evidence internally, but Training Memory presentation redacts answer, source, comparison, and review information until terminal Review; Review unlocks normal presentation without rewriting evidence. | Preserve `AUDIT-CHEAP-FIX-BATCH-001` and focused regression coverage |
| QA-AUDIT-SAME-SPOT-COHERENCE-001 | COMPLETED / HUMAN ACCEPTED | Same Spot is a standalone idle-only Training Memory re-drill, not Focused or planner-backed. Active Varied, Focused, or Full Hand blocks entry with explanatory copy; no suspend/restore path exists; frozen Earlier/This try and Baseline then/Reference then evidence remains distinct; ordinary headline statistics and planner progress are unchanged. | Accepted `SAME-SPOT-COHERENCE-001R`; preserve focused interaction/lifecycle coverage |
| QA-TRAINING-MEMORY-AVAILABILITY-001 | COMPLETED / HUMAN ACCEPTED | Training Memory bridge installation survives Authentication/AccountIdentity bootstrap ordering. Signed-in local Memory works in idle, Varied, Focused, and Full Hand without Supabase sync, while authentication-aware owner isolation remains intact. | Accepted `TRAINING-MEMORY-AVAILABILITY-001`; preserve bootstrap/recovery and owner-isolation coverage |
| QA-AUDIT-NON-HERO-CONTEXT-001 | COMPLETED / ACCEPTED | The Hand action dock context and stack are current-actor-relative. Hero remains distinct identity but is not used as another player’s decision-context label. | Preserve `AUDIT-CHEAP-FIX-BATCH-001` and focused regression coverage |
| QA-AUDIT-HAND-ANALYZE-STACK-001 | OPEN / NEEDS REPRODUCTION | Hand → Analyze may transfer the wrong stack/economics snapshot. | `AUDIT-HIGH-RISK-REPRO-001` |
| QA-AUDIT-ANALYZE-CHRONOLOGY-001 | COMPLETED / HUMAN ACCEPTED | Scenario remains an editable lossy draft, while central readiness validation admits only coherent provider-ready inputs to `StrategyProvider`. Card/street chronology, action/street consistency, facing/action dependencies, uniqueness, and basic numeric readiness fail closed as `scenario_not_ready` with natural guidance. Later-street clears preserve only valid earlier state, and Scenario never invents exact actor-relative economics. | Preserve `ANALYZE-SCENARIO-READINESS-001` and focused regression coverage; human accepted September 1, 2026 |
| QA-AUDIT-HOME-COMPLETED-HAND-001 | COMPLETED / HUMAN ACCEPTED | Home exposes Continue only for a non-terminal canonical Hand. Completed showdown, fold, and all-in Hands are not presented as live or continuable. | Accepted `HOME-HAND-LIFECYCLE-001`; preserve canonical resumability coverage |
| QA-AUDIT-AUTH-CLIENT-DUPLICATE-001 | COMPLETED / ACCEPTED | The duplicate Supabase/GoTrue client condition is resolved. One browser-runtime owner supplies the same client to Authentication, Account/Profile, Saved sync, and Personal Strategy sync; equivalent normalized configuration is idempotent, materially different in-runtime configuration fails closed, and auth/identity transitions do not recreate the client. Missing or invalid configuration remains Guest/local-only. | Preserve `AUTH-SUPABASE-SINGLETON-001` and focused regression coverage |
| QA-AUDIT-BROWSER-A11Y-001 | OPEN / NEEDS REPRODUCTION | Real-browser Tab order, modal containment/restoration, and inactive-workspace accessibility may diverge from structural tests. | `AUDIT-HIGH-RISK-REPRO-001` |
| QA-AUDIT-RANGE-COMPARISON-INTERACTION-001 | OPEN / NEEDS REPRODUCTION | Range comparison hover/focus behavior may be inconsistent or inaccessible. | `AUDIT-HIGH-RISK-REPRO-001` |
| QA-AUDIT-HAND-REVIEW-PRIORITY-001 | OPEN / NEEDS REPRODUCTION | Hand Review priority metrics may disagree across displayed values or projections. | `AUDIT-HIGH-RISK-REPRO-001` |

## Global Node baseline and CI

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-NODE-BASELINE-001 | CLOSED | The canonical global Node suite remains the correctness baseline. Strategy authority, DecisionContext v1.1, exact preflop roles, benchmark tooling, bounded structural calibration, Core Flow, Premium Cards, Personal Strategy metadata, account/Guest semantics, localization, Table Presence, and Full Hand Review invariants remain represented. Machine-sensitive macro runtime reporting stays separate from correctness and operation-level interaction thresholds. | Global Node baseline checkpoint |
| QA-CI-001 | CLOSED | Minimal GitHub Actions automation runs canonical syntax checks and the full Node suite on Node 24 for pushes, pull requests, and manual dispatches. Hosted-run state remains externally observable rather than inferred locally. | `.github/workflows/node-ci.yml` |

## Strategy / reference / calibration

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-REFERENCE-AUTHORITY-001 | PARTIAL | Additive source descriptors, structured coverage/capabilities, central claim policy, comparative heuristic Training language, high-risk limitation path, Playbook/Analyze provenance, Matrix precision, AnalysisExplanation consumption, and EN/RU/HE semantics are automated. FULL-HAND-REVIEW-001 adds source-gated comparison, exact recorded frequencies, compact provenance, limitations, and unavailable/generalized continuity without changing authority. Remaining human Firefox acceptance includes Training pre/after-answer, Full Hand comparison copy, high-risk context notes, Playbook Details/provenance, Matrix precision, Daylight/Midnight, and HE RTL. | REFERENCE-AUTHORITY-001 / FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-REFERENCE-AUTHORITY-002 | DEFERRED | Saved Hand/Spot preserve canonical/scenario state but not frozen historical StrategyResult metadata. If durable historical analysis is added, its payload must snapshot source ID/version, authority, coverage, capabilities and limitations rather than reinterpret against today's registry. | future Saved historical-analysis payload |
| QA-STRATEGY-REPAIR-001A | CLOSED | Table-family preflop structure, causal postflop sampling seed, missing-price abstention, unreachable shove cleanup, apples-to-apples physical-combo diagnostics and quality corpus accepted. | STRATEGY-REPAIR-001A |
| QA-DECISION-CONTEXT-001A | CLOSED | v1.1 live/current stack, unclamped current pot, effective stack, position relation, canonical legal sizing, bounded prior-action facts, Scenario lossiness and derivation provenance accepted; legacy compatibility stack/pot remain explicitly non-live. | DECISION-CONTEXT-001A |
| QA-STRATEGY-REPAIR-001B | CLOSED | Live SPR, exact price, legality, bounded position/history and separated response-family structure accepted without authority upgrade; known postflop saturation remains explicit reference debt. | STRATEGY-REPAIR-001B |
| QA-REFERENCE-BENCH-001 | CLOSED | Source-agnostic private/manual benchmark schema, context gate, raw/normalized action projections, TVD/bias/equity semantics, CLI and proprietary-data boundary accepted. | REFERENCE-BENCH-001 |
| QA-REFERENCE-PACK-001 | PARTIAL / ACCEPTED FOUNDATION CHECKPOINT | `reference-pack/v1` now validates exact assumptions, complete 169-class structure, legality, probability mass, capabilities, source/license/redistribution fields, validation identity, and deterministic integrity; strict canonical matching, provider selection, truthful fallback, claim policy, and generic Playbook/Training/Matrix/Analyze/Review paths are automated. No production-safe corpus was available, synthetic fixtures are test-gated, and browser discovery exposed no Firefox/browser for manual covered/near-miss acceptance. | `RET-REFERENCE-PACK-001` production source acquisition/review; later Firefox acceptance when a real pack exists |
| QA-PREFLOP-ROLE-001 | CLOSED | Canonical histories now preserve exact preflop decision role, Hero prior voluntary action, initial/latest aggressors, distinct aggressor count and cold-action semantics; actual role remains distinct from fallback calibration. | PREFLOP-ROLE-001 |
| QA-PREFLOP-CALIBRATION-001 | CLOSED | Bounded six-max BB-vs-BTN cold-response policy now separates continue value, passive realization and aggression suitability; all non-target role distributions and postflop corpus remain byte-stable; source remains generalized comparative v4. | PREFLOP-CALIBRATION-001 |
| QA-PREFLOP-REFERENCE-001 | PARTIAL / DEPENDENCY-GATED | The preferred six-max BB-versus-BTN 2.5bb no-rake/no-ante family now has an exact contract/matcher and synthetic architecture coverage, but no production frequencies, accepted sizing tree, independently reviewed validation corpus, or production-safe provenance/licensing. Neighboring positions/stacks/open sizes remain unsupported rather than inferred. | `RET-REFERENCE-PACK-001` / future bounded source review |
| QA-POSTFLOP-REFERENCE-001 | DEFERRED | Strong-made-hand aggression saturation, coarse opponent-range construction and unsized postflop strategy remain known generalized-heuristic debt. | future trusted postflop reference/calibration |

## Active Table Presence / full-hand vNext

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-TABLE-VNEXT-001 | COMPLETED / HUMAN ACCEPTED WITH MINOR TABLE-PHYSICALITY DEBT | Pure deterministic tests still cover all 2–10 player templates, normalized anchors, Hero-bottom invariance, geometry families, seat prominence, layered physical table facts, projection sizing targets, RTL-stable poker geometry, and deep immutability. Final hands-on use accepts the enlarged table, attached Hero/HU panels, immediately inward no-dongle cards, outward contributions, and inward Dealer button. Dense/10-max lower side panels remain slightly too far inward and the top player slightly too far outward/high. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` / `QA-HANDSON-021` |
| QA-TABLE-VNEXT-002 | PARTIAL | Hand and Full Hand Training share the presentation and derived review contracts; direct pre-action frame seeking, complete/review states, decision navigation, canonical source semantics, and exact Analyze/Save routes are structurally covered. Independent human interaction and requested Firefox A–H visual acceptance remain open. | FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-FULL-HAND-REVIEW-001 | PARTIAL | One shared review surface now covers the hand overview, every recorded Hero decision, mixed-reference comparison only when source capabilities permit it, provenance/limitations, exact Replay synchronization, Analyze, existing-schema Save Spot/Hand, Repeat/Next/Return, multiway facts, accessibility, responsive rules, EN/RU/HE, RTL, themes, cards, and provider-result caching. Focused automated coverage is present; independent human Firefox acceptance of exact states A–H at 1920×1080, 2560×1440, and 2560×1600 in Midnight and Daylight remains open. | FULL-HAND-REVIEW-001 human Firefox acceptance |
| QA-REVIEW-NAV-001 | CLOSED / HUMAN ACCEPTED STRUCTURE; HISTORY MICRO-POLISH DEFERRED | The table-first desktop workspace, distinct Replay, one bounded vertical whole-Hand History, exact seeking, Return to live, and three-region Review are human accepted. Remaining History padding, font weight, contrast, density, and event-row polish stays routed debt and does not reopen chronology architecture. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-REVIEW-NAV-001` / `GLOBAL-PRODUCT-QUALITY-001` |
| QA-REPLAY-RAIL-CORRECTION-001 | CLOSED / HUMAN ACCEPTED | Legal Raise and exact all-in board commits remain re-derived from canonical live facts; invalid 2–10 inputs remain visible and block start; RU/HE and LTR amount islands remain intact. Abort is live-only in Current Hand and Daylight contributions use explicit semantic surface/text/halo/border/chip roles with measured 13.23:1 text contrast. | accepted `REPLAY-RAIL-NAV-001` checkpoint |
| QA-REPLAY-RAIL-HARDENING-001 | COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT | Final hands-on use accepts the left compact Hand context/state, center primary table, and right legal/chance + distinct Replay + bounded vertical History model, including table-first hierarchy, stable live/Replay, chronology, collapse/scroll, seeking, actions, no-dongle cards, contributions, EN/RU/HE/RTL, Daylight, and Review. Non-blocking debt remains for dense/10-max seat placement, an optional ownership-safe hidden-card tuck, full-ring Dealer-presence explainability, and History micro-polish; none reopens the accepted architecture. | accepted `REPLAY-RAIL-NAV-001` checkpoint; `RET-TABLE-001` / `RET-CARDS-THEMES-001` / `RET-REVIEW-NAV-001` / `RET-PREMIUM-001` |
| QA-TABLE-VNEXT-003 | COMPLETED / HUMAN ACCEPTED HAND PRESENTATION; AUDIO LISTENING DEBT REMAINS | Existing experience events retain stack-to-contribution lanes, contribution-to-pot/pot-to-winner paths, seat-relative deals, table-interior folds, street/actor/hand-complete consequences, direct-seek suppression, and reduced-motion safety. Replay rail removes unexplained always-visible dotted contribution paths while preserving exact contribution amounts and transient motion. Hand comprehension is accepted; subjective audio listening remains separate debt. | accepted `REPLAY-RAIL-NAV-001` checkpoint; later audio acceptance under `RET-AUDIO-001` |
| QA-AUDIO-MOTION-001 | PARTIAL / ACCEPTED IMPLEMENTATION WITH LISTENING DEBT | The event/audio boundary, physical foley, and bounded poker-event sequencing remain implemented foundations. The final human disposition did not establish subjective listening acceptance; do not claim perfection. | conditional bounded `AUDIO-DESIGN-001` according to time/impact, otherwise later `GLOBAL-PRODUCT-QUALITY-001` / `RET-AUDIO-001` |

## August 26 confirmed hands-on product review

The detailed evidence is [Hands-On Product Review — August 2026](HANDS_ON_PRODUCT_REVIEW_2026_08.md). An independent outside-user review originated the findings, and the product owner manually reproduced and confirmed all 59 in the current build. The rows below route evidence without duplicating the full descriptions. Split references distinguish a bounded active repair from a larger design owner; no row is `CLOSED`.

| Evidence reference | Status | Routed outcome | Owner |
|---|---|---|---|
| HPR-2026-08 #4, #21, #28, #31–33, #38–40, #43–46, #48, #52 plus final Saved/table evidence | COMPLETED / ACCEPTED BOUNDED REPAIR CHECKPOINT WITH EXPLICIT DEBT | Human acceptance preserves Welcome title focus/Escape, clearer Home Game completion state, Return to live, auth feedback, dead-card/range parity, Analyze clipping, Personal Strategy vocabulary, and Replay geometry. The later accepted First Use/Home checkpoint resolves Welcome navigation selection; warning prominence remains separately owned. The former card/seat overlap and Hand composition debt reached the accepted Replay checkpoint with named minor physicality debt. | accepted `HANDS-ON-DEFECTS-001`, `FIRST-USE-HOME-001`, and `REPLAY-RAIL-NAV-001` checkpoints; remaining owners below |
| HPR-2026-08 #4–5, #16–17 | COMPLETED / HUMAN ACCEPTED | Optional Welcome orientation is separate from the permanent recurring Home route, defaults to shown/unchecked, suppresses only itself, and selects no sidebar destination. Active navigation is truthful; Guest Home is useful without sign-in; explicit live Hand or active/paused Personal Strategy contracts alone produce Continue, otherwise Home provides Start without fabricated recency. | accepted `FIRST-USE-HOME-001` checkpoint |
| HPR-2026-08 #6–7, #14, #22–24 | COMPLETED / HUMAN ACCEPTED | Guide is now a concise workflow-first durable product reference with progressive depth and direct routes to current work. Welcome / Learn Riverline remains orientation and existing workspace tutorials remain contextual teaching; no duplicate authority was introduced. | accepted `GUIDE-CONTENT-001` checkpoint |
| HPR-2026-08 #1 | COMPLETED / HUMAN ACCEPTED | One canonical geometric Riverline brand-spade serves the rail, Welcome, and current identity surfaces with context-appropriate contrast; poker-card suit rendering remains separate. | accepted `FIRST-USE-HOME-001` checkpoint |
| HPR-2026-08 #2–3, #9, #15, #18, #27, #47, #58 | BOUNDED SECONDARY POLISH / ACCEPTED QUALITY DEBT | Remaining intro/systemic spacing and sizing, semantic iconography, Account/Profile hierarchy, typography/casing, non-poker audio, and Royal Flush presentation. | `GLOBAL-PRODUCT-QUALITY-001` |
| HPR-2026-08 #8, #10–13 | BOUNDED SECONDARY POLISH / ACCEPTED CUSTOMIZATION DEBT | Compact control, richer card backs, clear custom-theme creation, Daylight comfort, and manual reduced-motion override. | `CUSTOMIZATION-UX-001` |
| HPR-2026-08 #19–20; #21 after accepted bounded clarity repair | CONDITIONAL / BOUNDED BY TIME AND IMPACT | Denser Riverline-integrated Home Game presentation, useful table/session representation, stronger proximate imbalance/toast feedback, and broader lifecycle presentation. | `HOME-GAME-PRESENTATION-001` |
| HPR-2026-08 #25–26, #35 | PRESERVED MAJOR FEATURE / POST-AUDIT ACTIVATION CANDIDATE | Reusable game setups/presets and physical Hero/button/Dealer/empty-seat configuration. | `GAME-SETUP-EVOLUTION-001` |
| HPR-2026-08 #29, #34; #28 and #33 after bounded repair; final hardening evidence | COMPLETED / HUMAN ACCEPTED HAND-REPLAY COMPOSITION CHECKPOINT WITH MINOR TABLE-PHYSICALITY DEBT | The left context / center table / right interaction composition, attached Hero/HU card physicality, enlarged table use, outward contributions, inward Dealer button, rail-isolated known-opponent editor, live-only Abort, and accessible Daylight contributions are human accepted. Dense/10-max seat placement, possible ownership-safe hidden-back tuck, full-ring Dealer-presence explainability, and History micro-polish remain explicitly deferred without reopening Replay/History architecture. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` / `RET-REVIEW-NAV-001` |
| HPR-2026-08 #30 | COMPLETED / HUMAN ACCEPTED BOUNDED FOUNDATION | Shared restrained randomization language is accepted in Analyze Scenario, top-level Hand / Analyze Hand Mode, and Equity without a universal state generator or Training bypass. Broader Lock & Perturb, recipe lifecycle, Saved/Training integrations, controlled transfer, and runout exploration remain future capability extensions rather than open QA for this slice. | accepted `LIGHT-WINS-BATCH-001`; future extensions under `RANDOM-SPOT-GENERATOR-001` |
| HPR-2026-08 #36–37, #41–42, #53; #38–40 after bounded repair | CLOSED / HUMAN ACCEPTED | Matrix-local selected-hand inspection and legend, canonical card-removal presentation, primary complete comparison matrices, truthful independent shared-scale percentages, representative-sample limits, and Facts → Explain progressive depth are accepted. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| HPR-2026-08 #46 after bounded repair | COMPLETED / HUMAN ACCEPTED | The accepted normal decision/study-rail skeleton, Correction #1, and final hardening remain intact. Lean closeout evidence proves exact same-decision replay with unchanged headline session/planner statistics and one-step Next progression; terminal Full Hand Review retains 1183×769px versus 1184×770px live shared-table geometry, vertical canonical History, source/comparison evidence, and no horizontal timeline at Firefox 154 / 1920×1080. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| HPR-2026-08 #49–51, #54 | PLANNED / ORDERED AFTER FOUNDATION AND LEARNING-LOOP GATES | Game setup/Approach first value, broad sparse/high-information coverage before boundary refinement, and Teach Riverline Next/Matrix Edit consolidation. It is item 17 in the binding order and does not jump the preceding gates. | `PERSONAL-STRATEGY-003A` |
| HPR-2026-08 #55 | DEFERRED / NAMED OWNER | Evidence-grounded concepts/reference/reasoning that genuinely teach; no claim this exists today. | `PERSONAL-STRATEGY-TEACHING-001` |
| HPR-2026-08 #56–57 | CLOSED / HUMAN ACCEPTED | Bounded 2–10-player composition, presentation-only inline naming, adjacent Board/Dead/Method controls, compact empty/running output, separate dominant completed comparison, transactional card-set input, and truthful exact-entered-hand outcome presentation are human accepted. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| HPR-2026-08 #59 | CLOSED / HUMAN ACCEPTED | The compact Saved grid uses DOM-free observer-safe Hand and visibly lossy Scenario Spot previews, visible zero-count All / Hands / Spots categories, a viewport-bounded hover/focus overlay, explicit bounded detail, shared card presentation, unsupported unknown-kind states, privacy clearing, and unchanged reopen/persistence boundaries. | accepted `SAVED-VISUAL-KNOWLEDGE-001` checkpoint |

## Second acceptance findings — Core Flow completed and human accepted

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-CORE-FLOW-NEW-HAND-001 | CLOSED / HUMAN ACCEPTED | The completed state keeps Review/Replay/Analysis/Save and explicit `Start new hand`; Review and Start new hand are the two primary actions without changing lifecycle. Fresh setup/focus/transient clearing/new identity and frozen completion remain verified and human accepted. | accepted `CORE-FLOW-CORRECTNESS-001` checkpoint |
| QA-HOME-GAME-CORRECTION-001 | CLOSED / HUMAN ACCEPTED | Active sessions expose `Correct entries` across uncorrected buy-in, rebuy, add-on, and cash-out entries, retain the direct cash-out shortcut, and accept an optional reason as `null` when absent without invented ledger prose. Existing immutable reversal/replacement, operable confirmation, and completed-session reopen semantics remain unchanged and human accepted. | accepted `CORE-FLOW-CORRECTNESS-001` checkpoint |
| QA-KNOWN-CARD-PICKER-001 | CLOSED / HUMAN ACCEPTED | Hand private-card selection advances continuously through the second slot; first Escape closes only the nested picker while preserving the expanded known-opponent disclosure, first card, and logical second-slot focus. Cross-seat duplicate exclusion, multiple opponents, and HU through 10-handed remain verified and human accepted. | accepted `CORE-FLOW-CORRECTNESS-001` checkpoint |
| QA-MIN-RAISE-VERIFY-001 | CLOSED / NO CANONICAL DEFECT | No poker-math defect was found. Canonical tests prove 1→3→minimum 5, 1→7→minimum 13, 1→3→8→minimum 13, postflop bet 5/raise 15→minimum 25, one short all-in without premature reopening, cumulative short-all-in reopening, unacted-player rights, and stack-bounded all-in-only legality. UI consumes canonical `minToMilliBb`/`maxToMilliBb` and retains explicit amount-to labels; no domain rule changed. | verified by `CORE-FLOW-CORRECTNESS-001` |
| QA-ALL-IN-RUNOUT-REGRESSION-001 | CLOSED / HUMAN ACCEPTED | Canonical `PokerState` semantics were correct. Application/UI defects mislabeled fully known hole deals as hidden/observed Replay events; Replay transition rejection then left a stale committed flop draft that allowed an already-consumed board card to reappear as a later chance candidate. The canonical available-card query now excludes current board, known hole cards, dead cards, and pending selections, and stale consumed draft cards are removed before the chance picker opens. Explicit Turn → River → Showdown remains intact; Replay/live terminal states agree and runout events occur exactly once. | accepted `CORE-FLOW-ALLIN-RUNOUT-REGRESSION-001` checkpoint; Hand composition remains closed |

## August 24 hands-on product findings

These IDs are durable hands-on findings: open rows are current product defects or accepted polish debt, while closed rows preserve repaired invariants. They are not a generic “premium polish” bucket and may close only with the named owner plus appropriate real-browser/human acceptance.

| ID | Status | Issue / durable invariant | Owner |
|---|---|---|---|
| QA-HANDSON-001 | CLOSED | Default picker cards now use a readable 42×60 target with prominent rank/suit and comfortable hit areas; Firefox verified all 52 cards without extreme shrink or viewport overflow. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-002 | CLOSED | One presentation authority rounds generated/suggested strategy sizing to human 0.5bb increments while canonical, historical, user-entered, legal, and accounting amounts remain exact. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-003 | CLOSED | Controls First was removed and no longer exists as a broken product option. Balanced Hand remains state-aware: setup is prominent before play, live/completion controls precede the large table, and Replay gives review navigation priority. | `WORKSPACE-COMPOSITION-002` accepted implementation checkpoint |
| QA-HANDSON-004 | CLOSED | Five board cards remain one horizontal LTR poker-order row with semantic Flop/Turn/River guides across supported desktop presets, including 1024px and HE RTL chrome. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-005 | PARTIAL / ACCEPTED CHECKPOINT | Weak presets were removed and the exposed system is simplified: only Hand Table Focus and Analyze Analysis Focus survive beside Balanced; one-layout workspaces hide the selector and removed preferences repair safely. Final subjective polish/acceptance of the two surviving specialized layouts may be revisited without reopening Controls First. | `RET-COMPOSITION-002` later composition acceptance |
| QA-HANDSON-006 | CLOSED | The released tutorial version no longer re-nags after skip or completion; reload/navigation persistence, manual restart, and intentional version re-offer remain covered. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-007 | CLOSED / HUMAN ACCEPTED | The workflow-first Guide covers current Hand, Analyze, Training, Equity, and Personal Strategy work; progressive disclosures preserve authority and limitation distinctions without becoming a manual or second onboarding/tutorial system. | accepted `GUIDE-CONTENT-001` checkpoint |
| QA-HANDSON-008 | CLOSED | Home Game Create binds only after its authentication dependency is ready, stays in the Organizer, and opens the intended active session; broader organizer work remains `HOME-GAME-001B`. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-009 | PARTIAL | Audio volume is implemented by `AUDIO-MOTION-001`; retain subjective Study/UI/Check/fatigue/Firefox polish debt without reopening accepted architecture. | `RET-AUDIO-001` later polish |
| QA-HANDSON-010 | PARTIAL / ACCEPTED IMPLEMENTATION CHECKPOINT | The Settings god menu is replaced by four focused categories with a tested one-category-per-preference inventory, shared authorities, keyboard/RTL structure, and secondary Guide/tutorial discovery. Browser discovery exposed no available browser, so the requested EN/RU/HE, Midnight/Daylight, 1920×1080, 1366×768, and narrow/small-height real Firefox matrix remains open. | later `PREMIUM-CLOSEOUT-001` pre-release human Firefox closeout / `RET-PREMIUM-001` |
| QA-HANDSON-011 | CLOSED | Human Firefox/manual acceptance confirmed that the labelled `Learn Riverline` action is genuinely obvious outside Settings and that first-use/manual orientation routes cleanly to Guide and existing contextual tutorial affordances. Welcome remains separate from tutorial persistence and Guide content. | `WELCOME-INTRO-001` accepted checkpoint |
| QA-HANDSON-012 | CLOSED / INVARIANT PRESERVED | Built-ins are immutable and custom themes use explicit Edit, Save, Cancel, Duplicate, and Save as New transactions; draft changes do not persist or mutate the source before commit. HPR-2026-08 #11 is distinct open discovery/creation-flow debt: users still need an obvious Create New Theme / duplicate-current entry before editing. | accepted safety checkpoint; discovery debt under `CUSTOMIZATION-UX-001` |
| QA-HANDSON-013 | CLOSED | The ineffective Comfortable/Compact user-facing control is removed rather than represented as useful. Internal density tokens/controller compatibility remain, and bootstrap repairs old Compact preferences to the stable Comfortable default. | `WORKSPACE-COMPOSITION-002` accepted implementation checkpoint |
| QA-HANDSON-014 | COMPLETED / HUMAN ACCEPTED | The accepted normal Training skeleton, Correction #1, and final hardening are preserved. Focused Firefox 154 / 1920×1080 closeout evidence adds exact replay identity, replay-stat exclusion, exact one-step Next progression, and terminal Review continuity on the live-scale shared table with open vertical History and current source/comparison evidence. No Training console or page errors occurred. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-HANDSON-015 | COMPLETED / HUMAN ACCEPTED WITH MINOR TABLE-PHYSICALITY DEBT | The table scale and HU/full-ring geometry, increased table occupancy, attached Hero, no-dongle card ownership, outward contributions, and inward Dealer button are human accepted. Dense/10-max lower side panels remain slightly too far inward and the top player slightly too far outward/high. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` |
| QA-HANDSON-016 | CLOSED | Existing durable Save actions share an accessible outline/filled bookmark state backed by exact SavedStudyObject detection; repeated exact saves remain idempotent and no unsupported unsave/delete was invented. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-017 | CLOSED / HUMAN ACCEPTED | Player inputs use one bounded scroll region with presentation-only inline names, Board/Dead/Method stay readily adjacent, and calculated values live in a dedicated dominant result comparison rather than inside input tiles. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-HANDSON-018 | CLOSED | Four legal Training actions render as a balanced 2×2 constrained-desktop grid or readable 4×1 wide grid, preserving source/keyboard order and avoiding an orphan row. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-019 | CLOSED | Hint selection is street-aware: preflop uses starting-hand/position concepts and cannot select postflop made-hand/draw/board prompts; postflop may use those existing facts. | `UX-REGRESSION-001` accepted checkpoint |
| QA-HANDSON-020 | CLOSED | Table Focus materially increases the presentation target over Balanced while retaining canonical HU/sparse/6-max/full-ring geometry, usable timeline/action dock, and density-independent layout. Broader composition is now human accepted under Replay; named minor physicality debt remains separately routed. | `UX-REGRESSION-001` and `REPLAY-RAIL-NAV-001` accepted checkpoints |
| QA-HANDSON-021 | COMPLETED / HUMAN ACCEPTED WITH EXPLICIT HIDDEN-CARD PHYSICALITY DEBT | Known-card rendering preserves rank+suit identity and hidden-card privacy. One responsive radial felt grammar keeps attached panels, immediately inward no-dongle cards, outward contributions, and inward Dealer-button positions mutually readable through full ring. Hidden backs may later tuck under/behind their owner only while privacy, ownership, inspectability, known-card readability, and non-obstruction remain intact. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `RET-TABLE-001` / `RET-CARDS-THEMES-001` |

## Home / My Riverline

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-002A-001 | PARTIAL | Guest privacy/usefulness, authenticated identity/sync composition, truthful Continue, bounded Saved/Review/Mistakes, Personal Strategy evidence facts, account switching, coalesced invalidation, performance boundaries, EN/RU/HE structure, and accessibility are automated; requested Firefox viewport/theme/language visual acceptance remains open. | HOME-002A human Firefox acceptance |
| QA-HOME-002A-002 | DEFERRED | Full Saved Study View all/library, search, filters, tag drilldowns and master-detail inspector do not yet exist; HOME-002A intentionally provides bounded previews. | HOME-002B |
| QA-HOME-002A-003 | DEFERRED | Persistent Training history/re-drill intelligence and recent Analysis history remain unsupported; Home exposes seams but no fabricated statistics. | dedicated Training/Analysis persistence tickets |

## Home Game Organizer

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-HOME-GAME-001A-001 | PARTIAL / ACCEPTED IMPLEMENTATION CHECKPOINT | Standalone/accounting boundaries plus 001B player/group/session management, atomic correction/replacement projection, lifecycle/archive/export behavior, Guest restrictions, EN/RU/HE structure, RTL/logical CSS and accessible dialogs/forms are automated. Browser discovery exposed no available browser, so the requested real Firefox matrix and real authenticated provider path remain open. | dedicated Home Game human Firefox/provider acceptance / `RET-HOMEGAME-001` |
| QA-HOME-GAME-001A-002 | CLOSED / BOUNDED DECISION | Saved-player edit/archive/restore, ordered group management, visible reversal/replacement history, session archive/restore confirmation, and richer organizer UX are implemented. Hard delete is not exposed; import is deferred because safe retention, validation, version, ownership-adoption and conflict semantics do not exist. Canonical account-only export is implemented. | `HOME-GAME-001B` accepted implementation checkpoint |

## Product UI / shared presentation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-UI-001 | PARTIAL | Action Path nodes/connector must share one axis in LTR/RTL; glow must not clip | PRODUCT-UI-002R manual acceptance |
| QA-UI-002 | PARTIAL | ordinary status pills must remain one-line, content-sized, centered | PRODUCT-UI-002R manual acceptance |
| QA-UI-003 | PARTIAL | Betting Context still needs confirmed meaningful height reduction/alignment | PRODUCT-UI-002R manual acceptance |
| QA-UI-004 | PARTIAL | `View all hands` must align with Position/Prior action row | PRODUCT-UI-002R manual acceptance |
| QA-UI-005 | COMPLETED / HUMAN ACCEPTED WITH MINOR PHYSICALITY DEBT | `table-presentation/v1` still preserves name, position, stack, action, prominence, and exact card facts. The Hand renderer places cards in a natural seat-to-felt gap with no holder, connector, panel overlap, or contribution overlap; known cards remain inspectable and hidden cards private. A later hidden-back tuck is constrained by those accepted invariants. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `QA-HANDSON-021` / `RET-CARDS-THEMES-001` |
| QA-UI-006 | PARTIAL / ACCEPTED IMPLEMENTATION CHECKPOINT | Settings now uses a bounded modal with one independently scrolling category panel and responsive horizontal category navigation at narrow widths; real Firefox centering, clipping, and small-height acceptance remain open. | later `PREMIUM-CLOSEOUT-001` pre-release gate / `QA-HANDSON-010` |

## Next: shared analysis presentation

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ANALYSIS-001 | PARTIAL | Playbook analysis retains its full Decision-grid row; R2 readability needs final manual acceptance | PRODUCT-UI-003R2 |
| QA-ANALYSIS-002 | PARTIAL | Shared Hero/board, economics, reasons, and context hierarchy refined; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-ANALYSIS-RANGE-001 | PARTIAL | exact-hand, board, blocker, supplied-range, provenance, tutorial, and EN/RU/HE integration are structurally tested; final live viewport/theme/language acceptance remains pending | ANALYSIS-RANGE-001 human acceptance |
| QA-ANALYSIS-BLUFF-001 | PARTIAL | Bluff & Pressure risk/reward, unavailable sizing, semibluff structure, multiway wording, river reference, range-removal boundaries, tutorial, and EN/RU/HE/RTL integration are structurally tested; final human viewport/theme/language acceptance remains pending | BLUFF-001 human acceptance |
| QA-TRAIN-ANALYSIS-001 | COMPLETED / HUMAN ACCEPTED | Varied/Focused immediate Facts still select authoritative made-hand/draw/board/economics evidence and keep generic card-removal detail under Explain. Full Hand now withholds verdict/source/Facts/deep analysis during live play and exposes recorded evidence only through shared terminal Review; no analysis or poker authority changed. Firefox and structural evidence pass. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-ANALYSIS-002 | PARTIAL | Pre-answer assistance is now one-at-a-time coaching hints; final manual acceptance pending | PRODUCT-UI-003R2 |
| QA-TRAIN-ANALYSIS-003 | PARTIAL | Post-answer reference remains one canonical frequency panel; the shared completed-hand review now reuses recorded StrategyResults and gates mixed comparison by source capability. Final manual acceptance remains pending. | FULL-HAND-REVIEW-001 human Firefox acceptance / premium closeout |

## August 13 live audit IDs

These identifiers remain the historical live-audit baseline; current tickets may supersede their owner.

| ID | Status | Issue | Owner |
|---|---|---|---|
| RL-05 | OPEN | Playbook long-page / analysis-location composition | premium closeout |
| RL-06 | OPEN | 169 unavailable postflop Matrix cells | future Matrix/premium closeout |
| RL-07 | OPEN | Range comparison stacking / long-page comparison | future Analysis/premium closeout |
| RL-12 | PARTIAL | supported theme catalog exposes polished product labels; human visual acceptance pending | theme acceptance |
| RL-13 | PARTIAL | One-at-a-time coaching hints replace pre-answer reference disclosure; manual acceptance pending | Training acceptance |
| RL-14 | PARTIAL | Training result uses refined Hero/board-first hierarchy; manual acceptance pending | Training acceptance |
| RL-16 | CLOSED / HUMAN ACCEPTED | Bounded setup and dedicated completed-result composition are product-owner accepted; future capability depth remains separately preserved rather than treated as renderer debt. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| RL-17 | PARTIAL | Guide terminology/content refresh implemented; final human review pending | Guide human review |
| RL-18 | CLOSED | hidden picker deck detaches on close while Matrix/Range caches retain PERF behavior | PERF-RL18 |
| RL-20 | PARTIAL | semantic theme authority and Daylight contrast checks implemented; human visual acceptance pending | theme acceptance |

## Cards, themes, density, layouts, and micro-polish

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-POLISH-001 | PARTIAL | PRELABS-FIX-001 established the lazy Firefox AudioContext seam and `AUDIO-MOTION-001` is now an accepted implementation checkpoint. Remaining subjective Study/UI and Check refinement plus unperformed Firefox audio/visual acceptance stay open as later polish debt rather than blocking the next ticket. | `RET-AUDIO-001` / later prioritized polish |
| QA-CARD-001 | PARTIAL | Premium Card System v1 remains the shared face authority and now scales inside the adaptive 2–10 player-unit geometry; Firefox visual acceptance at 1920×1080 remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-CARD-002 | PARTIAL | `10` keeps its explicit optical-width treatment in the scaled table-card family across all three styles; Firefox visual acceptance remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-CARD-003 | PARTIAL | DOM and SVG cards still share one presentation authority, named geometry, face semantics, and back variants; structural tests cover TablePresentation integration, while representative workspace/theme visual acceptance remains | PREMIUM-CARD-001 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-THEME-001 | PARTIAL | Daylight controls now use semantic light surfaces; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-002 | PARTIAL | Daylight muted text passes structural contrast checks; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-003 | PARTIAL | legacy/experimental labels are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-004 | PARTIAL | duplicate Discord entries are retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-005 | PARTIAL | Luxury Gold is retired from the supported theme catalog; human visual acceptance pending | PRODUCT-THEME-001 |
| QA-THEME-006 | PARTIAL | Named custom-theme lifecycle and independence remain automated; TABLE-PRESENCE-002 adds token-driven felt texture, two-band rail, betting line, seat prominence, and projection sizing without changing persisted theme records. Remaining acceptance: the existing custom-theme lifecycle plus Midnight/Daylight table legibility and Compact + Table Focus composition in Firefox. | PRODUCT-THEME-002 / TABLE-PRESENCE-002 human Firefox acceptance |
| QA-MICRO-001 | OPEN | Settings/current utility icon alignment needs final pass | PRODUCT-UI-004 |
| QA-MICRO-002 | OPEN | action-color palette needs final restrained consistency review | PRODUCT-UI-004 |
| QA-MICRO-003 | OPEN | awkward near-black inset surfaces need final token review | PRODUCT-UI-004 |

Do not expand theme/layout/density/card variant catalogs during the active table phase.

## Account identity / sync

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-ACCOUNT-001 | PARTIAL | Legacy local data remains claimable behind Guest boundary; final migration acceptance must prove existing objects survive and IDs remain stable when claimed. | ACCOUNT compatibility acceptance |
| QA-ACCOUNT-002A | PARTIAL | Supabase email/password auth, profile/RLS migration, claim/start-separate, Guest fail-closed semantics, durable-action resume gate, switching/sign-out, no-sync copy, i18n/RTL/focus are structurally implemented. Remaining: live migration/provider validation and human Firefox lifecycle. | ACCOUNT-002A/AR live/manual acceptance |
| QA-ACCOUNT-002B-A | PARTIAL | Saved Hand/Spot opt-in sync, outbox/retry, stable IDs, conflict choices, tombstones, isolation, cold remote Replay and RLS/RPC structure are deterministic-test covered. Remaining: live migration/RLS and two-profile Firefox lifecycle. | ACCOUNT-002B-A live acceptance |
| QA-ACCOUNT-002B-B | PARTIAL | Personal Strategy/Calibration separate opt-in, stable IDs, immutable evidence, divergent-history preservation, metadata conflicts, session merge and RLS/RPC structure are deterministic-test covered. Remaining: live migration/RLS and two-profile Firefox lifecycle. | ACCOUNT-002B-B live acceptance |
| QA-ACCOUNT-002A2 | DEFERRED | Secure username/password adapter remains a separate trusted-server/Edge Function ticket if username login is still desired before release. | ACCOUNT-002A2 |

## Personal Strategy / Range Calibration

`QA-PERSONAL-COACH-001` - **PARTIAL / HUMAN ACCEPTANCE PENDING**, owner `PERSONAL-STRATEGY-CONTINUATION-001C` extending the original Coach/Range Evolution owner. [Current full-street scope](PERSONAL_STRATEGY_COACH_V1_SPEC.md) includes exact node/sizing, flop?turn?river navigation, partial reach, mutation summaries, intent corrections/reload, concept routing and policy/Approach exploration. September 6 browser inventory returned no enabled apps/browsers. Focused verification passed 71/71 tests; all 11 changed/new JavaScript files passed syntax checks and diff hygiene passed. Mounted application tests are structural only. Human QA: complete a bet and a check line through river, face a river bet, teach preferred/exact/custom sizes, inspect unknown/removed combos, correct an upstream answer, reload, vary an earlier card, compare Approaches/policies, and inspect truthful Training unavailability. Assess compactness/usefulness, focus/keyboard, EN/RU/HE/RTL, narrow desktop and Midnight/Daylight. Existing unrelated issue IDs remain unchanged.

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-PERSONAL-INTELLIGENCE-001 | PARTIAL / HUMAN ACCEPTANCE PENDING | [Intelligence v1](PERSONAL_STRATEGY_INTELLIGENCE_V1_SPEC.md): arbitrary setups and 4+ Approaches, confirmed qualitative intent, immutable correction/reload/fork histories, deterministic range/Approach/source language and shared claim envelope. Focused integration passed 305/305 tests; final targeted verification after self-found fixes passed 104/104 (overlapping suites). Persistence/domain passes 38, Understanding event/DOM passes 12, Personal EN/RU/HE/tutorial coverage passes 3. Separate whole-tutorial checks retain two unrelated Home locale/Training copy assertion failures detailed in the owning spec; existing i18n/Training owners retain them. Browser inventory exposed no apps/browsers at inspection, so visual acceptance is unperformed. Human QA: setup/create 4+, adaptive family/boundary mapping and early stop, preview/confirm/correct/narrow/exception, dominant/exact/Matrix Edit, sparse abstention and comparative-only claims, reload/history/fork independence, owner transitions, EN/RU/HE keyboard/RTL. Existing Personal Strategy issue IDs remain open under their named owners. | `PERSONAL-STRATEGY-INTELLIGENCE-001` human acceptance |
| QA-RANGE-CAL-002C | PARTIAL | Adaptive selection, boundary/uncertainty/sparsity ranking, deterministic resume, stopping, Skip/Not sure, category progress, i18n/RTL, sync-safe facts, validation and performance are automated; human Firefox acceptance remains. | RANGE-CAL-002C human acceptance |
| QA-PLAYSTYLE-QUICK-PROFILE-001 | PARTIAL | Bounded regional interpolation, starter checkpoint, clarification batches, abstention/conflict safety and EN/RU/HE are automated; human Firefox experience acceptance remains. | PLAYSTYLE-QUICK-PROFILE / ACTIVE-CLARIFICATION human acceptance |
| QA-RANGE-CAL-002D | PARTIAL | Snapshot-derived Matrix, truthful statuses, filters, evidence/history inspector, conflict preservation, corrections, adaptive follow/selection, keyboard/RTL and performance are automated; human Firefox matrix acceptance remains. | RANGE-CAL-002D human acceptance |
| QA-RANGE-BUILDER-001 | PARTIAL | Builder selection/painting, grouped direct/exact edits, conflict-safe commits, undo, adaptive reranking, i18n and tutorial are automated; human Firefox editing acceptance remains. | RANGE-BUILDER-001 human acceptance |
| QA-RANGE-TEACHER-001 | PARTIAL | Boundary/sparse/conflict/exact-mix recommendations, focused Calibration routing, scope isolation, i18n/tutorial and performance are automated; human Firefox compactness/truthfulness acceptance remains. | RANGE-TEACHER-001 human acceptance |
| QA-PERSONAL-002R | PARTIAL | The [independent product/architecture review and human disposition](PERSONAL_STRATEGY_002R_REVIEW.md) are complete and accepted. HPR-2026-08 #49–55 adds confirmed hands-on evidence for the accepted Game setup/Approach reset, broad coverage before boundary refinement, raw-label repair, surface consolidation, and a later genuine teaching owner. `003A` is item 16 after the binding foundation, extraction, Saved/Home, reference-source, and learning-loop gates. Existing and future-migrated EN/HE/RU visual/real-user acceptance remains unperformed. | `PERSONAL-STRATEGY-003A`; `PERSONAL-STRATEGY-TEACHING-001` |

## Workspace composition and responsive fit

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-LAYOUT-001 | OPEN | Decision/Matrix/Range tabs sit too low and feel disconnected | PRODUCT-UI-005 |
| QA-LAYOUT-002 | PARTIAL | Active Hand now uses a primary compact timeline → adaptive table → Hero action dock sequence before secondary details, while setup remains a bounded rail and Analysis remains separate; Firefox passed the ticket's 1920×1080, 2560×1440, and 2560×1600 capture matrix, while the supported 1366×768 baseline, representative zoom, and independent interaction acceptance remain open. Prior 1024×768 findings are preserved as future compact/mobile-responsive evidence, not current blockers. | TABLE-PRESENCE-002 human Firefox acceptance / PRODUCT-UI-005 |
| QA-LAYOUT-003 | PARTIAL | TABLE-PRESENCE-002 resolves active play and review as table/card-first while retaining configuration-first setup before a Hand starts; HU, 6-max, and 10-max Firefox captures passed target-width, dock-visibility, overflow, and collision checks, while independent human validation remains open | TABLE-PRESENCE-002 human Firefox acceptance / Product Lab follow-up if rejected |
| QA-LAYOUT-PRESETS-001 | PARTIAL / ACCEPTED CHECKPOINT | Workspace-specific preset authority remains, but the exposed model is deliberately simplified: Balanced everywhere, Hand-only Table Focus, Analyze-only Analysis Focus, no Controls First, and no user-facing density selector. Automated Firefox coverage passed the retained modes; any remaining subjective specialized-layout polish stays with `RET-COMPOSITION-002`. | `WORKSPACE-COMPOSITION-002` checkpoint / `RET-COMPOSITION-002` |
| QA-MATRIX-001 | CLOSED / HUMAN ACCEPTED | Canonical card-removal parity remains intact; selected-hand detail and the compact legend are local to the Matrix, and comparison semantics are accepted. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| QA-MATRIX-002 | CLOSED / HUMAN ACCEPTED | Postflop unavailable presentation uses the accepted compact truthful state instead of 169 inactive cells. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| QA-RANGE-001 | CLOSED / HUMAN ACCEPTED | Complete Hero/opponent matrices are the primary comparison objects without internal Matrix scrolling; category bars and basis continue below in normal page flow. | accepted `ANALYZE-RANGE-UX-001` checkpoint |
| QA-EQUITY-001 | CLOSED / HUMAN ACCEPTED | One bounded 2–10-player input region sits with readily reachable Board/Dead/Method controls; the no-result/running surface stays compact and completed results become the primary comparison. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-002 | CLOSED / HUMAN ACCEPTED | Presentation-only inline names and dedicated player comparison rows provide consistent labels and readable Equity/Win/Tie values without expanding input tiles or changing canonical request identity. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-003 | CLOSED / HUMAN ACCEPTED | Flop/Turn/River guides and live board slots share one five-column LTR grid; accepted Equity geometry preserves poker order across the supported localized desktop composition. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-001 | COMPLETED / HUMAN ACCEPTED | At Firefox 1920×1080 / 100%, normal active/answered Training preserves accepted columns and keeps actions/result/Next operable. The one primary progression row projects immediately below the verdict and above study labels, Facts, reference, and Explain; expanding Explain does not move Next. 1366×768 remains functional and large desktops remain bounded. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-002 | COMPLETED / HUMAN ACCEPTED | Pre-session still exposes expanded Setup, one Start Training CTA, and compact lazy Memory/diagnostics only. Sparse Varied/Focused ready states are content-height (Focused measured 744px at 1920×1080) rather than inheriting a Full Hand/table reserve; the 265px idle main remains preserved. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-003 | COMPLETED / HUMAN ACCEPTED | Full Hand retains one shared `TableRenderer`/`table-presentation` table at 1184×770px live and 1183×769px in terminal Review at Firefox 1920×1080. Review opens on the same table-first workspace, suppresses the horizontal timeline, opens vertical canonical History, and retains selected decision/source/comparison/Facts/Explain evidence. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| QA-TRAIN-LAYOUT-004 | COMPLETED / HUMAN ACCEPTED | A distinct live-only Abort hand control sits outside poker actions, requires confirmation, leaves cancel unchanged, and on confirm returns to expanded Full Hand setup with no terminal/showdown UI. The abandoned Memory session remains visible as Incomplete; focused domain evidence proves answered decision records remain preserved. | accepted `TRAINING-COMPOSITION-001` checkpoint |
| FQA-002 | CLOSED | Training context values use the real grid, reflow to two columns at 1024, and remain atomic in Firefox EN/RU/HE with no global overflow or inaccessible action controls | PRELABS-FIX-001 |
| FQA-004 | CLOSED / SUPERSEDED | The former all-at-once multi-column Settings composition was removed by `SETTINGS-IA-001`; any remaining live viewport issue belongs to the new category IA acceptance matrix rather than the retired column layout. | `SETTINGS-IA-001` accepted implementation checkpoint / `QA-HANDSON-010` |
| QA-TABLE-001 | COMPLETED / HUMAN ACCEPTED WITH MINOR TABLE-PHYSICALITY DEBT | The active Hand continues to render canonical facts through `table-presentation/v1`. The no-dongle radial grammar, larger table body, attached Hero, outward exact contributions, inward Dealer button, and stable table-first action/history relationship are human accepted. Dense/10-max seat geometry and full-ring human Dealer-presence explainability remain later debt. | accepted `REPLAY-RAIL-NAV-001` checkpoint / `QA-HANDSON-021` / `RET-TABLE-001` |
| QA-COLLAPSE-001 | PARTIAL | Starting a Hand restores the table to expanded state and keeps the collapse control integrated; Firefox compact-state acceptance remains open | CORE-FLOW-001B Firefox acceptance / UI-005 |

## Equity UX

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-EQUITY-ETA-001 | CLOSED / HUMAN ACCEPTED | Real Monte Carlo throughput and conservative ETA remain accepted within the canonical calculation lifecycle. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-PROGRESS-001 | CLOSED / HUMAN ACCEPTED | Indeterminate preparation and real determinate counters remain accepted within the canonical calculation lifecycle. | accepted `EQUITY-COMPOSITION-001` checkpoint |
| QA-EQUITY-NARROW-001 | CLOSED / HUMAN ACCEPTED | Per-hand Equity/Win/Tie presentation and responsive context hierarchy are accepted as part of the final Equity composition. | accepted `EQUITY-COMPOSITION-001` checkpoint |

## Guide, localization, responsive, mobile

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-GUIDE-001 | CLOSED / HUMAN ACCEPTED | Guide is the durable workflow-first product reference; actions reuse navigation authority, Welcome / Learn Riverline remains orientation, workspace tutorials remain contextual interactive teaching, and current product truth boundaries remain explicit. | accepted `GUIDE-CONTENT-001` checkpoint |
| QA-I18N-001 | PARTIAL | Rendered-visible RU/HE audit is structurally clean across representative surfaces; FULL-HAND-REVIEW-001 adds complete EN/RU/HE review vocabulary and structural audits. Human linguistic acceptance remains pending. | i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-I18N-002 | PARTIAL | Live locale switching preserves state and re-renders without cross-locale leakage; shared review content is translated through the canonical runtime. Human acceptance remains pending. | i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-I18N-003 | PARTIAL | Static diagnostics report no missing visible keys, mojibake, or cross-locale contamination under the narrow whitelist, including Full Hand Review keys. Human acceptance remains pending. | i18n human acceptance |
| QA-I18N-004 | PARTIAL | RTL and poker-data LTR islands are structurally tested, including the shared review surface and cards/action values; human visual acceptance remains. | responsive/i18n / FULL-HAND-REVIEW-001 human acceptance |
| QA-RESP-001 | PARTIAL | Automated desktop renderer and structural responsive checks cover existing workspaces; Full Hand Review adds two-column-to-single-column convergence and Compact rules. Human Firefox acceptance remains pending at the ticket viewports/themes. | FULL-HAND-REVIEW-001 / premium closeout human acceptance |
| QA-MOBILE-001 | DEFERRED | Mobile needs a distinct composition, not stacked desktop panels. | MOBILE-001 |

## Training intelligence / Saved study future QA

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-TRAINING-MEMORY-001 | COMPLETED / AUTH ISOLATION ACCEPTED | Durable decision/session evidence, review controls, exact Same Spot, Similar Spot, abandoned Full Hand preservation, authentication-gated owner isolation, and sign-out inaccessibility are accepted bounded behavior. Advanced scheduling and cross-surface continuation remain future product work rather than QA closure debt. | Accepted `TRAINING-MEMORY-001` + `AUTH-TRAINING-MEMORY-001` foundations |
| QA-TRAINING-REDRILL-001 | COMPLETED / HUMAN ACCEPTED V1 + STANDALONE CLOSEOUT | Same Spot remains exact historical reproduction as a standalone idle-only Memory re-drill, separate from Focused/planner progress and ordinary headline stats; active ordinary Training blocks entry without suspend/restore. Similar Spot remains planner/generator-backed current practice. Sophisticated scheduling, Saved Drill presets, richer filters, and cross-surface continuity remain future. | Future `TRAINING-MEMORY-002` when prioritized |
| QA-SAVED-LIBRARY-001 | OPEN / REOPENED FOUNDATIONAL RETRIEVAL | The accepted Saved grid filters only an already-bounded result set. Full retrieval/search/filter/sort/pagination for current Hand/Spot objects is not implemented. New payload kinds remain explicitly out of scope. | `SAVED-LIBRARY-001` |

## Opponent policy / bots QA

Human correction for `QA-OPPONENT-POLICY-002`: bot/policy functionality is accepted. The remaining bounded setup-composition issue now uses Opponent + concise summary, Study focus, Apply to, and collapsed Advanced (seed, parameters, comparison and full limitations). Policy semantics and supported targets are unchanged. Browser inventory remains empty; compact right-rail/Start Training visibility needs human visual confirmation. Other requested policy functionality is not reopened.

`QA-OPPONENT-POLICY-002` — **PARTIAL / HUMAN ACCEPTANCE PENDING**, owner `OPPONENT-INTELLIGENCE-002` + policy-conditioned Training + opponent-review foundation. Automated invariants cover frozen intent/request matching, unchanged provider/grader inputs, deterministic replay, actor provenance, descriptive custom-parameter NL, read-only Personal coverage and mounted locale/reset behavior. September 6 browser inventory returned no apps/browsers. Human QA: select Calling-heavy/Aggressive/Tight-passive and each reflection theme; compare custom settings; finish a hand and expand actor inputs/active settings/seeds; change setup then Replay seed; reset and switch language; inspect My Approach under opponent assumptions and Teach this region next; inspect Bluff/Exploit comparison questions. Check compactness, keyboard/focus, EN/RU/HE/RTL, 1366×768 and Midnight/Daylight. Questions must not imply guaranteed thin-value/bluff-catching/check-raise drills or normative policy grading. Earlier Opponent/Bluff/Personal and `RET-FULLHAND-HERO-FOLD-001` owners remain unchanged. No human acceptance or durable policy review is claimed.

Stress evidence for `QA-OPPONENT-POLICY-001`: the configured three-handed 500bb always-raise path completes after Hero folds, beyond the old fixed event guard. The final focused run including that path took about 160 seconds. Long minimum-raise sequences therefore remain a performance limitation to assess in human use; the existing Hero-fold lifecycle return owner is not closed or absorbed by this ticket.

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-OPPONENT-POLICY-001 | PARTIAL / HUMAN ACCEPTANCE PENDING | [Opponent Policy v2](OPPONENT_POLICY_V2_SPEC.md) adds actor-input allowlisting, independent policy RNG, hidden/future-card counterfactual tests, three parameter-backed card-independent presets/custom controls, all-opponents/BB targeting, and terminal policy review. Canonical complete-hand replay and mounted EN/RU/HE/reset checks pass. September 6 browser inventory returned no enabled apps/browsers. Human QA must play multiple full Hands against at least two presets, inspect custom parameters and BB-only rejection when Hero is BB, Replay seed, post-hand explanations, keyboard/focus, EN/RU/HE/RTL, normal/narrow desktop and Midnight/Daylight. Persistent policy review, quantitative ranges and real-person models are not claimed. Existing Full Hand/identity QA remains with its owners. | `OPPONENT-INTELLIGENCE-001` + `OPPONENT-ACTOR-INFORMATION-001` + `ACTOR-SAFE-BOTS-001` human acceptance |

## Performance and DOM follow-up

| ID | Status | Issue | Owner |
|---|---|---|---|
| QA-PERF-001 | CLOSED | duplicate slider/context updates and hidden Matrix computation | PERF-001 |
| QA-PERF-002 | CLOSED | hidden picker deck removed on close; remaining heavy grids are intentional visible/cached work | PERF-RL18 |
| QA-PERF-003 | OPEN | visible Matrix DOM mutation needs browser profiling only if still measured sluggish | later PERF follow-up |
| QA-PERF-004 | DEFERRED / TEST INFRASTRUCTURE | The default highly parallel full Node invocation can trip the existing Range Calibration `<100ms` wall-clock assertion under machine saturation while the focused test and bounded-concurrency suite pass. This is not a Workspace Composition product failure; do not loosen the threshold without a dedicated test-infrastructure decision. | `RET-TEST-INFRA-001` if reproduced in clean CI or the canonical developer environment |

## Closed or intentionally removed historical QA

| ID | Status | Outcome |
|---|---|---|
| QA-HIST-001 | CLOSED | collapsible vertical sidebar and utilities moved into rail |
| QA-HIST-002 | CLOSED | flags/full language names and persisted RTL direction |
| QA-HIST-003 | REMOVED | broken arbitrary layout-lock/drag editor removed |
| QA-HIST-004 | CLOSED | table-collapse empty-region bug |
| QA-HIST-005 | CLOSED | card picker root event interception regression |
| QA-HIST-006 | CLOSED | card typography/proportions restored and shared card system introduced |
| QA-HIST-007 | CLOSED | spade/outside-suit contrast refinement |
| QA-HIST-008 | CLOSED | T/10 visual preference added |
| QA-HIST-009 | CLOSED | basic deal/action/training sounds and reduced-motion support |
| QA-HIST-010 | CLOSED | Matrix fixed grid/no hover expansion and selected-hand inspector |
| QA-HIST-011 | REMOVED | fake Matrix EV heatmap |
| QA-HIST-012 | REMOVED | fake Matrix Equity heatmap |
| QA-HIST-013 | CLOSED | Range controls use dedicated selectors and unsupported prescriptions removed |
| QA-HIST-014 | CLOSED | Scenario/Hand pricing semantics and truthful pot odds |
| QA-HIST-015 | CLOSED | AJo/pure-fold implementation cliff and per-hand MDF/fake preflop SPR |
| QA-HIST-016 | CLOSED | postflop multiway split/allocation/evaluator/sample consistency |
| QA-HIST-017 | CLOSED | one StrategyProvider/StrategyResult authority across surfaces |
| QA-HIST-018 | CLOSED | Equity board horizontal and 2–10 player controls |
| QA-HIST-019 | REMOVED | useless Total Equity summary |
| QA-HIST-020 | CLOSED | Outs visual grouping and raw-card cleanup |
| QA-HIST-021 | REMOVED | Training circular answer wheel |
| QA-HIST-022 | CLOSED | Training chosen/highest markers, muted action palette, session dividers |
| QA-HIST-023 | CLOSED | Replace-card semantics, scoped toasts, sidebar truthfulness, View-all destination reveal |
| QA-HIST-024 | CLOSED | Hand pre-start state isolation and showdown prerequisite |
| QA-HIST-025 | CLOSED | Training Strategy Preview versus After-answer copy truthfulness |
| QA-HIST-026 | REMOVED | local solver-tree/model upload control until a validated import contract exists |

## Update rules

Every UI/product ticket report must list owned IDs as `CLOSED`, `PARTIAL`, `DEFERRED` with next owner, or `REGRESSION`.

Do not close an issue merely because source-level tests pass. Add newly reported issues here rather than relying on chat memory.
