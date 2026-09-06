# Hand History Import v1

`HAND-HISTORY-IMPORT-001` implements one local Import → Review → Study slice.
PokerStars English NLHE cash, recorded-rake contracts and Saved provenance were
explicitly authorized September 6, 2026. `QA-HAND-HISTORY-IMPORT-001` owns human acceptance.

## Pipeline and boundaries

`hand-history-pokerstars.mjs` parses source-labelled facts. `hand-history-import.mjs`
normalizes exact decimal money, validates evidence and submits source-neutral
requests through `CanonicalHandSession`. The parser never mutates PokerState.
Canonical actions, chance, reveals, evaluator, refunds and settlement remain
under `shared/poker-domain/`. Future formats are additive adapters.

Intake supports English PokerStars Hand/Game cash NLHE, USD/EUR/GBP, occupied
2–10-seat tables, exact button/blinds/stacks, no ante or complete equal per-player
antes, Dealt-to Hero, raises/reraises/all-ins, multiway actions, one board,
known showdown cards, explicit pot/rake/awards and reconcilable refunds.
Amounts and currency minor units must fit integer milliBB exactly. Unsupported
stakes are rejected without rounding. Sitting-out, straddles/dead posts, other
variants, tournaments, Zoom/CAP headers, multiple hands, run-it-twice and unknown
lines fail closed. Join/leave notices do not change the dealt-in roster.

Raises mean street-total-to and their increment must agree. Calls mean incremental
commitments. Explicit all-ins map to the canonical all-in command with exact size
verification. Private reveals never leak backward through Replay. Missing Hero,
unknown showdown holdings, conflicting cards/amounts/order/summary and unsupported
mechanics retain parsed evidence and structured line/code diagnostics, with no
canonical Hand/Replay available to open/save. Intermediate states stay internal.
Natural-language errors point to the shared envelope's structured evidence refs.

## Recorded settlement and versioning

Game Rules Definition/Snapshot v2 add only
`recordedSettlementPolicy: { type: 'source_recorded_rake', rakeModel: 'unknown' }`.
No rate/cap/model is inferred. Collection remains `none`, separate from fixed
per-player collection. Explicit `initializeRecordedHand()` creates PokerState v3;
ordinary live initialization and historical v1/v2 semantics remain unchanged.

Existing canonical fold/showdown accounting first verifies gross entitlement.
`applyRecordedSettlement()` then reconciles `recorded-hand-settlement/v1`:
gross pot, explicit rake and net payouts. The state retains those facts plus
evaluated gross awards distinctly. A positive rake creates one explicit
`recorded_rake` / `pot_to_recorded_rake` ledger entry; player deductions remain
unchanged. Recorded awards cannot exceed evaluated entitlement. Showdown layer
results remain **gross entitlements**, not inferred per-layer rake. Conservation
includes recorded rake separately. Identical settlement is idempotent;
conflicting replacement fails closed. Missing evidence never means zero rake.

Replay source/event v3 adds `recorded_settlement`. The lifecycle publishes a
completed v3 result only after settlement evidence. Historical readers/records
are preserved unchanged; no bulk migration or live rake behavior is introduced.

## Review, Saved and study

Successful preview opens a detached read-only Hand in existing Replay/shared
Review. Cold Saved reopen rebuilds the same canonical lifecycle journal from
commands. Hero decisions carry exact pre-action state/context and legal sizes.
Existing cached StrategyProvider/Strategy Truth own comparisons; observed play
grants no normative authority. Opponent actions create no automatic profile or
synthetic policy assignment. Unsupported Exploit assumptions remain unavailable.

SavedStudyObject v1 keeps its outer envelope/database. `saved-hand-snapshot/v3`
holds PokerState/Replay v3 and strict `hand-import-provenance/v1`: format/parser,
SHA-256 of exact raw bytes as UTF-8 text, source hand/time/table/roster, versions,
fact classifications, canonical Hand ID and `rawTextRetention: 'not_stored'`.
Raw text is ephemeral in the local dialog, cleared on close/owner change, never
saved/exported/uploaded. Structured Hand data retains existing local-first and
explicit account-sync semantics. Parse/read/hash/adoption/save use captured
owner generations. Saved source snapshots are captured before async lookups.

Same raw text resolves to the same Saved Hand within its owner. Different raw
text bytes remain distinct; semantic deduplication/session/batch work is future.
Saving an imported decision also preserves its source Hand, so its durable
provenance remains reachable after reload. Decision-save IDs are stable, and
repeated study annotation actions reuse existing Saved records across reload.
Review later and Situational use existing Saved annotations, preserve notes/tags
and remain idempotent. Exact selected Analyze handoff is reused. Personal lookup
is explicit and read-only, requiring selected Setup/Approach/context compatibility.
Current imported recorded-rake rules have no compatible Personal rake model,
even for recorded zero rake, and truthfully return unavailable. Users may open
existing Personal controls to refine/update explicitly or leave intent unresolved.
Exact imported Practice/Similar Spot has no compatible Training request today:
unavailability is explicit; no exercise is generated from text. Rake-aware intent,
Training continuation, sessions and opponent consent remain future. The first
[Study Inbox](DEEP_REVIEW_STUDY_INBOX_V1_SPEC.md) now projects Saved import/decision
references and preserves source provenance; it adds no imported Training authority.

## Verification and acceptance

Source-attributed public fixtures live under `tests/fixtures/hand-history/`.
Spectator originals without Hero remain partial; labelled test derivatives
supply a Dealt-to line for success coverage, never parser defaults. Focused tests
cover invariants/side pots/ties, deterministic parsing/fingerprints, exact sizes,
failure states, Replay privacy, cold Saved/Review, repository persistence and
deduplication, owner fences, direct intent boundaries, and EN/RU/HE copy.

Browser inventory was empty. Human QA: paste/file → preview → Review → Save →
reload; gross/rake/net display; exact seeking/Analyze; repeated Review later/
Situational; malformed/unsupported input; Guest/account transitions; keyboard,
Escape/focus, EN/RU/HE/RTL, narrow desktop and Midnight/Daylight. Structural tests
are not visual acceptance; earlier QA owners remain open.
