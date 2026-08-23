# Riverline Checkpoint Return Queue

Last refreshed: August 23, 2026 (`FULL-HAND-REVIEW-001` implementation checkpoint).

This is the prioritized **must-return** companion to `PRODUCT_BACKLOG.md` and `QA_BACKLOG.md`.

Use it for work that was intentionally checkpointed with known unfinished acceptance, known defects, explicit temporary limitations, or release-blocking external validation. It exists so accepted checkpoints do not become forgotten debt.

`QA_BACKLOG.md` remains the detailed issue-level source. `PRODUCT_BACKLOG.md` remains the full capability backlog. This file is the compact prioritized return queue.

## Queue vocabulary

- **RETURN-SOON** — should be absorbed by the current/next product phase when practical.
- **RETURN-BEFORE-SUBSYSTEM-DONE** — the subsystem is accepted as a foundation but is not actually finished.
- **RETURN-BEFORE-BETA** — cannot be ignored before a serious external beta/public release.
- **RETURN-WHEN-DEPENDENCY-READY** — real unfinished work whose next step depends on a later authority/payload/reference.
- **WATCH / CONDITIONAL** — investigate only if measured/user-observed behavior justifies it.

## Current prioritized return queue

| ID | Priority | Subsystem | What is still unfinished / known debt | Next owner / trigger |
|---|---|---|---|---|
| RET-TABLE-001 | RETURN-SOON | Hand / Table Presence | `TABLE-PRESENCE-002` implemented adaptive player-count geometry, table identity/stack/card hierarchy, legal action composition, live-vs-complete projections, and timeline/direct seek. Independent human Firefox interaction and remaining visual acceptance are still open; implementation is not visual sign-off. | `TABLE-PRESENCE-002` human Firefox acceptance + `PREMIUM-CLOSEOUT-001` |
| RET-FULLHAND-001 | RETURN-SOON | Full Hand / Replay | `FULL-HAND-REVIEW-001` implemented one shared Hand/Training decision review, pre-action Replay synchronization, source-gated comparison, provenance/limitations, Analyze, existing-schema Save Spot/Hand, Repeat/Next/Return, responsive/i18n/RTL/accessibility structure, and automated coverage. Exact independent human Firefox states A–H at 1920×1080, 2560×1440, and 2560×1600 in Midnight/Daylight remain open. | `FULL-HAND-REVIEW-001` human Firefox acceptance |
| RET-PREMIUM-001 | RETURN-SOON | Global UI | Open/partial Core Flow and premium QA remain: long-page composition, low/disconnected tabs, Betting Context density, View-all alignment, status pills, Settings small-viewport safety, near-black inset surfaces, utility-icon alignment, action-color consistency. | `PREMIUM-CLOSEOUT-001`; absorb table-owned items earlier |
| RET-CARDS-THEMES-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Cards / Themes / Layout / Density | Premium Card System, named custom themes, picker, layout presets and density are implemented but still carry human Firefox composition/visual lifecycle acceptance. Do not add more variants before closing this. | `TABLE-PRESENCE-002` integration + `PREMIUM-CLOSEOUT-001` |
| RET-AUDIO-001 | RETURN-SOON | Audio / Motion | Basic cues and reduced-motion support exist; subjective Firefox audibility remains unverified and the semantic poker-world vs app-motion architecture is not finished. | `AUDIO-MOTION-001` |
| RET-REFERENCE-UI-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Strategy source authority | Claim-policy semantics and Full Hand Review source-gated comparison/provenance/limitations are automated, but Training pre/post answer wording, Full Hand comparison copy, high-risk notes, Playbook provenance, Matrix precision, Daylight/Midnight, and HE RTL still need independent human Firefox acceptance. | Reference-authority / `FULL-HAND-REVIEW-001` human acceptance; premium closeout where appropriate |
| RET-PREFLOP-001 | RETURN-WHEN-DEPENDENCY-READY | Preflop strategy | v4 structural calibration is intentionally narrow: BB vs BTN, six-max, roughly 80–120bb and 2–3bb opens. Other roles/configurations remain generalized legacy fallbacks; exact rake/sizing and neighboring validation are missing. | first trusted reference-pack program / future bounded calibration |
| RET-POSTFLOP-001 | RETURN-WHEN-DEPENDENCY-READY | Postflop strategy | Known debt remains: coarse opponent ranges, strong-made-hand aggression saturation, no trustworthy sizing strategy, limited action-history/range conditioning, no equilibrium multiway strategy. | trusted postflop reference/calibration after preflop reference path proves itself |
| RET-BENCH-001 | RETURN-WHEN-DEPENDENCY-READY | Reference benchmark tooling | v1 cannot directly encode handless whole-node observations, is intentionally conservative when rake is unknown, cannot compare exact sizing when Riverline is unsized, and lacks equivalent weighted range-vs-range Equity semantics. | extend only when next reference work is blocked by these limitations |
| RET-TRAIN-001 | RETURN-WHEN-DEPENDENCY-READY | Training coverage | Current Training does not generate the exact calibrated BB-vs-BTN node; dedicated cold-4bet/opener-facing-cold-4bet targets are also not established. Do not fabricate families just to cover them. | Training Memory/reference-informed curriculum tickets |
| RET-PERSONAL-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Personal Strategy | Calibration/Matrix/Builder/Teacher are automated checkpoints, not final product acceptance. They still require human Firefox matrices and the independent `002R` real-user review before more inference machinery/provider integration. | `PERSONAL-STRATEGY-002R` + remaining human acceptance |
| RET-MATRIX-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Matrix / Range UX | Postflop unavailable state still should not render a useless 169-cell inactive grid; range comparison remains too long/stacked; final Matrix live acceptance remains. | premium/Matrix follow-up; competitor-reference gate before redesign |
| RET-ANALYSIS-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Analysis / Bluff | Range Analysis and Bluff facts are structurally checkpointed; final viewport/theme/language human acceptance remains, and weighted range-vs-range/value-bluff work is intentionally future. | human acceptance now; richer analysis only after approved range/reference boundaries |
| RET-EQUITY-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Equity UX | Core Equity math is canonical, but workspace composition still feels panel-like; label spacing/wrapping and final live renderer acceptance remain. | `PREMIUM-CLOSEOUT-001` / dedicated Equity polish if still visible |
| RET-HOME-001 | RETURN-BEFORE-SUBSYSTEM-DONE | My Riverline | `HOME-002A` is a bounded dashboard checkpoint with Firefox acceptance still open; full Saved Study Library/search/filter/master-detail does not exist yet. | human acceptance; `HOME-002B` after Training/session payloads |
| RET-HOMEGAME-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Home Game Organizer | `HOME-GAME-001A` foundation is accepted, but saved-player edit/archive, visible correction history, archive/delete confirmation, richer management UX, import/export decision and Firefox acceptance remain. | `HOME-GAME-001B` |
| RET-ACCOUNT-001 | RETURN-BEFORE-BETA | Accounts / auth | Auth/profile/Guest semantics are implemented structurally, but live Supabase migration/provider validation and real lifecycle acceptance remain. Legacy claim must be proven non-destructive on real data. | live Supabase + Firefox acceptance |
| RET-ACCOUNT-002 | RETURN-BEFORE-BETA | Saved sync | Saved Hand/Spot sync needs live migration, cross-user RLS/idempotency/stale-revision verification, offline/reconnect/conflict lifecycle and two-profile Firefox acceptance. | `ACCOUNT-002B-A` live acceptance |
| RET-ACCOUNT-003 | RETURN-BEFORE-BETA | Personal Strategy sync | Personal Strategy/Calibration sync needs live relational migration/RLS/idempotency/append-only verification plus two-profile contradiction/conflict/resume Firefox lifecycle. | `ACCOUNT-002B-B` live acceptance |
| RET-ACCOUNT-004 | WATCH / CONDITIONAL | Username login | Secure username/password adapter is not shipped. If username login remains a release requirement, it must be implemented behind a trusted rate-limited server/Edge Function; never client-side username→email lookup. | `ACCOUNT-002A2` if product decision remains yes |
| RET-I18N-001 | RETURN-BEFORE-BETA | EN/RU/HE / RTL | Automated/static/rendered coverage is strong, but human linguistic/visual acceptance remains across several checkpointed surfaces. New visible tickets must own their own translations so this does not grow into another catch-up epic. | each visible ticket + final premium/release acceptance |
| RET-RESP-001 | RETURN-BEFORE-BETA | Desktop responsiveness | Automated desktop matrix is strong, but human Firefox acceptance across representative 1080p/1440p/1600p/4K, themes, zoom and RTL remains. | table/premium closeout + release gate |
| RET-GUIDE-001 | RETURN-BEFORE-SUBSYSTEM-DONE | Guide / tutorials | Guide refresh and tutorials are structurally present; human Guide review and visible-feature tutorial updates remain required. | each feature ticket + final Guide review |
| RET-PERF-001 | WATCH / CONDITIONAL | Matrix performance | Visible Matrix DOM mutation should be browser-profiled only if real interaction still feels sluggish; do not invent a performance project without measurement. | measured regression/user complaint |
| RET-SAVED-PROV-001 | RETURN-WHEN-DEPENDENCY-READY | Saved historical analysis | Saved Hand/Spot does not freeze historical `StrategyResult` provenance. If durable historical analysis/review is persisted later, source ID/version/authority/coverage/capabilities/limitations must be snapshotted. | future Saved review/history payload |
| RET-ARCH-001 | RETURN-WHEN-DEPENDENCY-READY | Frontend architecture | `logic.js` remains a major orchestration chokepoint. Continue incremental extraction behind existing seams when touched by substantial features; do not launch a rewrite or React migration. | bounded extraction tickets when current work touches the seam |

## Release gates

Before a serious public beta, at minimum all **RETURN-BEFORE-BETA** rows must be either closed or explicitly removed from release scope by a product decision. In addition:

- no unresolved security/data-isolation issue may be hidden behind local fake-adapter tests;
- the major Hand/Training/Analyze/Equity/Personal Strategy flows need human Firefox acceptance in the supported desktop matrix;
- source/strategy limitations must remain truthful;
- no release may depend on private GTOW benchmark data;
- critical `REGRESSION` items in `QA_BACKLOG.md` block release even if absent from this summary.

## Dynamic update rule

This file is not a one-time audit. It must move with the project.

At every accepted ticket/checkpoint:

1. If the ticket ends **CHECKPOINTED / INTENTIONALLY INCOMPLETE**, create or update at least one return item unless the report proves there is literally no unfinished acceptance/debt.
2. Any known bug accepted at checkpoint gets a return item or a referenced `QA_BACKLOG.md` owner.
3. Any manual/browser/live-provider validation that was unavailable stays open here when it matters to subsystem completion or release.
4. Any deliberate temporary strategy/reference approximation stays here only if a future owner/trigger is known.
5. When a return item becomes active work, update its owner/priority rather than duplicating it.
6. Close a return item only with concrete evidence: accepted implementation, manual acceptance, live-provider validation, or explicit product-scope removal.
7. Reconcile this queue against `QA_BACKLOG.md`, `CURRENT_PHASE.md`, and `PRODUCT_BACKLOG.md` at every roadmap sync and before beta/release planning.

The queue should stay prioritized and compact. `QA_BACKLOG.md` may contain many low-level issues; this file contains the debts we are unwilling to forget.
