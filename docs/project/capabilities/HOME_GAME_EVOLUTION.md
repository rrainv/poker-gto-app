# Home Game Evolution

> This capability dossier preserves long-term product intent and design direction. It does not own execution priority or current implementation truth. See PRODUCT_BACKLOG.md for capability status and CURRENT_PHASE.md / ROADMAP.md for sequencing. Current implemented contracts remain in subsystem specs/code.

Planning authority remains in the [Product Backlog](../PRODUCT_BACKLOG.md), [Current Phase](../CURRENT_PHASE.md), and [Roadmap](../ROADMAP.md).

## Product purpose

Riverline's Home Game Organizer should help a real group run and reconcile a poker night with exact, auditable accounting. It is a separate product domain from poker strategy and from the canonical Hand engine. Its future evolution may improve player reuse, session management, settlement planning, history, and carefully bounded Hand linkage, while keeping money facts, chip snapshots, and poker-state facts distinct.

Home Game is useful supporting capability. This dossier does not imply that it outranks Riverline's central play → review → learn loop or alter its execution sequence.

## User jobs / why it matters

- Reuse regular players and groups without recreating a roster each session.
- Record buy-ins, rebuys, add-ons, cash-outs, corrections, and chip-count observations exactly.
- See a visible audit trail rather than silently editing past money facts.
- Complete a balanced session and understand who should pay whom.
- Choose a practical settlement plan for the group, including a possible preferred banker workflow.
- Track which transfers are pending or paid without rewriting the underlying results.
- Reopen a completed session and preserve what changed.
- Review recurring games and player/session history without turning financial outcomes into poker-skill claims.
- Optionally relate canonical Hands to a Home Game session without double-applying accounting.
- Reconcile sessions when some real-world hands were not tracked in Riverline.

## Existing foundation

- [Home Game Organizer Specification](../HOME_GAME_ORGANIZER_SPEC.md) owns the current standalone domain, exact minor-unit ledger, immutable transactions, append-only corrections, optional chip snapshots, lifecycle, balance checks, deterministic settlement, ownership, persistence, and bounded workspace.
- `HOME-GAME-001B` adds account-scoped player edit/nickname/notes/archive/restore, ordered group management, reusable New Session rosters with blinds metadata, completed-session archive/restore, visible linked correction history, lifecycle-event history, and canonical account-only JSON export. Guest remains runtime-only with no durable library or export claim.
- Hard delete is not exposed because v1 has no safe retention semantics for referenced players/groups or immutable financial history. Import is also deferred because validation, version adoption, owner adoption, conflict, and duplicate-ledger behavior are not accepted. These are deliberate safety decisions, not invitations for a renderer-side workaround.
- Current settlement is a deterministic stable-order debtor-to-creditor two-pointer pass. It is not an exposed “Fewest Transfers” versus “Banker” preference system.
- [Account Identity](../ACCOUNT_IDENTITY_SPEC.md) owns opaque Riverline identity. Home Game does not derive ownership from username, email, display name, or provider subject.
- [Architecture Contract](../ARCHITECTURE_CONTRACT.md) keeps poker mathematics, PokerState, strategy, Equity, Training, Saved Study, and Home Game accounting under separate authorities.

The current Home Game specification explicitly has no PokerState or Saved Study dependency. Any future Hand linkage must be an approved application-level relation; it cannot be inferred from matching names, times, seats, or amounts.

## Desired future behavior

### Organizer composition and session feedback

The organizer should use available space according to the active session job rather than stretching low-information inputs and outputs across the canvas. A table-oriented roster/session projection is worth investigating when it makes seats, participants, activity, or completion easier to understand, but it remains a presentation over Home Game facts and never becomes PokerState.

Lifecycle actions such as Complete, Reopen, Recomplete, Archive, and Restore must communicate their effect through deliberate confirmation and a clear resulting summary/state. Fields should not merely clear or change in a way that resembles lost data. This presentation requirement complements, and does not replace, the immutable ledger and lifecycle history.

### Players, groups, and sessions

- Extend the accepted player/group/session management only when recurring-game defaults, richer templates, or factual history materially improve the organizer.
- Define hard-delete retention semantics before any destructive session/player/group deletion is introduced; archive remains the accepted safe default.
- Show player and recurring-game history as factual accounting/session history, not a skill rating.
- Keep account identity, Home Game player identity, and a poker Hand seat/actor identity separate unless an explicit mapping exists.

### Visible correction and lifecycle history

- Show the original ledger fact and its append-only correction together.
- Explain replacement as reversal plus a new transaction rather than mutable editing.
- Preserve completion, reopen, and recompletion history with revisions and timestamps.
- Make late adjustments explicit and prevent edits to completed sessions until deliberate reopen.
- Distinguish financial transactions from chip-count snapshots and operational notes.

### Settlement planning

Settlement planning should derive obligations from the exact balanced ledger and then project a payment plan. Desired future choices include:

- retain the current deterministic direct debtor-to-creditor plan;
- define a user-facing **Fewest Transfers** option only after its optimization objective and tie-breaking are specified and tested;
- define a **Banker** option in which eligible obligations route through one selected participant;
- optionally remember or suggest a preferred banker for a group, with explicit per-session confirmation;
- show a concise settlement summary plus exact transfers;
- track each planned transfer as pending, paid, waived, replaced, or otherwise explicitly resolved under an approved payment-history contract;
- preserve settlement-plan and payment history across reopen/recompletion;
- recalculate deliberately when the underlying ledger changes, while retaining prior plan history where promised.

Choosing a banker changes the transfer plan, not player net results or the canonical ledger. “Fewest” must not be claimed merely because a deterministic plan uses a bounded number of transfers.

### Blind timer and button advancement

A later live-session utility may support a blind timer, level schedule, break state, dealer-button tracking, and deliberate button advancement. These are operational projections, not tournament/ICM strategy, PokerState action authority, or real-money accounting. Cash-game and tournament assumptions must not be mixed silently.

### Canonical Hand linkage

A future Hand ↔ Home Game relation should be explicit, versioned, and idempotent:

- a stable canonical Hand ID may be linked to one Home Game session under a defined relation contract;
- applying any Hand-derived session event must use a stable operation/link ID and succeed exactly once;
- retries must be idempotent, and a Hand must not be applied twice after reload, sync, reopen, or conflict resolution;
- unlink/correction behavior must preserve audit history rather than erase the earlier application;
- the Home Game session may reference a Hand, but it does not become PokerState authority;
- the Hand may reference its Home Game context, but its cards, actions, legality, pot, and contributions remain canonical poker-domain facts;
- private or hidden cards must not leak into group-facing Home Game views;
- only explicitly approved facts may cross the boundary.

Poker table chips and pot contributions are not automatically real-money ledger entries. A tracked Hand may help explain activity, but buy-ins, rebuys, add-ons, cash-outs, corrections, and final balance remain Home Game ledger facts.

### Reconciliation for untracked real-world hands

Riverline must assume that a physical game can continue while the application is closed or that only some Hands are recorded. Reconciliation should therefore:

- compare explicit financial facts and optional observed chip totals;
- identify unexplained differences without fabricating missing Hands;
- let an authorized user add a labelled reconciliation/correction fact through the ledger's audit rules;
- retain who entered it, when, why, and what observation supported it;
- never reconstruct strategic actions or player winnings from insufficient chip-count evidence;
- keep unresolved discrepancies visible until explicitly handled.

### Mobile and live sharing

Later mobile/live views may help a group enter buy-ins, confirm cash-outs, view a settlement, or acknowledge payment. They require explicit identity, permission, privacy, conflict, offline, and synchronization rules. A shared settlement must not expose unrelated study data, private cards, strategy profiles, or account credentials.

## Structured facts / evidence required

Future behavior may need structured facts such as:

- stable player, group, session, participant, transaction, correction, and chip-snapshot IDs;
- owner identity and explicit participant-to-player relations;
- currency, exact minor-unit amounts, and immutable transaction type;
- correction target, reason, author, and timestamps;
- session lifecycle, revision, started/completed/reopened timestamps, and history;
- participant active/cashed-out state and exact derived net result;
- settlement algorithm/version, input session revision, deterministic ordering, transfer list, and total-conservation evidence;
- optional settlement preference, banker participant ID, eligibility, fallback reason, and per-session confirmation;
- payment-plan item ID, referenced transfer, status, status history, actor, timestamp, and note under an approved contract;
- recurring-game/group relation and operational timer/button state where supported;
- Hand-link ID/version, stable canonical Hand ID, session ID, application operation ID, applied-at revision, and idempotency evidence;
- reconciliation observation, discrepancy, resolution relation, provenance, and remaining uncertainty;
- sharing audience/permission and privacy projection when live sharing exists.

Derived accounting totals and settlement transfers should remain recomputable from the canonical ledger where historical-plan fidelity does not require retaining a versioned plan. Renderer summaries must not become stored accounting authority.

## Authority, provenance and uncertainty rules

- Home Game owns real-world session/accounting facts. PokerState owns cards, actions, legality, pots, and poker-chip contributions.
- Chip snapshots are observations. They do not replace financial ledger facts or prove a missing sequence of Hands.
- Corrections append and point to prior facts; they do not mutate history invisibly.
- Settlement is derived only from an exactly balanced ledger. A presentation preference cannot change net results.
- The current deterministic settlement must not be called globally minimal without a specified objective and proof.
- A preferred banker is a user/group preference, not an accounting authority. Eligibility and fallback must be explicit.
- Paid/pending state is operational payment history, distinct from ledger balance and settlement calculation.
- A Hand link is an explicit relation with provenance. Similar timestamps, player names, or chip movements do not establish it.
- Applying a Hand-related operation must be exactly-once/idempotent and auditable.
- Untracked activity remains unknown. Reconciliation records the observed adjustment; it does not invent poker history.
- Player/session history is factual. It does not imply poker skill, tendencies, opponent modeling, or strategic advice.
- Sharing remains private and least-privilege by default.

## Preserved interactions and microfeatures

- Reuse, edit, and archive players while retaining stable identity in old sessions.
- Manage saved groups and recurring-session templates.
- Inspect an append-only transaction and correction history.
- Complete, reopen, and recomplete with visible lifecycle history.
- Choose a settlement presentation method only after reviewing exact balances.
- Select or confirm an optional banker with clear eligibility/fallback.
- View settlement summary and exact payer → recipient transfers.
- Mark transfer/payment progress through an explicit status history.
- Link a canonical Hand through a deliberate action and show whether the stable link was already applied.
- Reconcile an untracked discrepancy with an explicit reason and provenance.
- Run a later blind timer/button tool without mixing it with ledger math.
- Share a privacy-safe live-session or settlement view only with explicit permission.
- Keep money, chips, Hand facts, and operational state visually and semantically distinct.
- Keep the active roster/session representation compact and Riverline-integrated; use a table-oriented view only where it improves organizer understanding.
- Make completion and other lifecycle transitions visibly explain their resulting state and retained history.

## Cross-surface applicability

- **Home Game Organizer:** primary management, ledger, lifecycle, settlement, reconciliation, and operational surface.
- **Home / My Riverline:** bounded consumer for active/recent session continuity; it does not compute balances.
- **Hand:** optional explicit link/unlink or session-context action after a relation contract exists; no automatic ledger mutation.
- **Replay / Deep Review:** may show factual Home Game context through the link, without exposing private financial detail by default.
- **Accounts/sync:** identity, permissions, transport, and conflicts; not accounting authority.
- **Saved knowledge:** may relate a Saved Hand to a Home Game session only through approved relation/privacy semantics; no duplicate session store.
- **Mobile/live view:** later constrained participant actions and read-only settlement presentation.
- **Training, Strategy, Equity, Opponent Intelligence:** not accounting consumers by default. A Home Game player record is not an opponent model.

## Presentation depth

- **Facts:** exact ledger entries, corrections, balances, lifecycle, settlement inputs/transfers, payment states, Hand links, and reconciliation provenance.
- **Explain:** why the session is or is not balanced, how a selected settlement plan routes obligations, what changed after reopen, and which discrepancy remains unresolved.
- **Summary:** concise session and settlement recap grounded in exact facts. It must not become strategic coaching, a skill score, or unsupported narrative about players.

## Dependencies

- [Home Game Organizer Specification](../HOME_GAME_ORGANIZER_SPEC.md) and its exact ledger invariants.
- Account identity and ownership boundaries for durable multi-user/mobile behavior.
- Canonical Hand stable identity and an approved application relation contract before Hand linkage.
- Sync/conflict and privacy design before live/mobile sharing or payment acknowledgment.
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md) if Saved Hands expose Home Game relations.
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md) for any durable cross-surface relation or historical review evidence.
- [Interaction Grammar](../INTERACTION_GRAMMAR.md) for consistent inspect, confirmation, unknown, and unavailable behavior.

## Suggested implementation slices

These are possible future boundaries, not execution priority:

1. Player reuse/edit/archive and visible transaction/correction history.
2. Session/group archive, management, and recurring-game history.
3. Settlement-summary and lifecycle-history refinement over the existing deterministic settlement.
4. Versioned settlement-preference design and independent Fewest Transfers versus Banker evaluation.
5. Preferred-banker selection plus explicit eligibility and fallback.
6. Payment-plan pending/paid history as a separate operational contract.
7. Blind timer/button utility as an isolated operational projection.
8. Versioned Hand-link relation with stable IDs, idempotent exactly-once application, and privacy tests.
9. Reconciliation workflow for explicitly observed untracked differences.
10. Mobile/live sharing only after identity, privacy, sync, and conflict boundaries are accepted.

## Competitive/reference lessons

Current Riverline Home Game work demonstrates the value of exact minor units, balanced-ledger refusal, append-only correction, deterministic derivation, and a separate domain boundary. Practical organizer UX should make those rules understandable rather than replacing them with editable totals. Stable identities and explicit lifecycle are more valuable than visually impressive but unauditable summaries.

No new web research is introduced by this dossier.

## Failure modes / non-goals

- No strategy, Equity, opponent-model, or poker-math authority inside Home Game.
- No mutable deletion or silent edit of money history.
- No floating-point or display-string accounting.
- No settlement on an unbalanced session.
- No claim that the current deterministic transfer plan is mathematically fewest without a specified optimization contract.
- No banker routing that changes player net results.
- No treating paid/pending status as a ledger transaction unless an approved accounting rule says so.
- No automatic Hand → ledger conversion based on chips, pot contributions, names, or timestamps.
- No duplicate application of a linked Hand after retry, reload, reopen, sync, or conflict.
- No fabricated Hands or action history during reconciliation.
- No conflating Home Game players with account profiles, StrategyProfiles, or opponent models.
- No mobile/public sharing before privacy, permission, and conflict behavior exist.
- No implication that Home Game outranks Riverline's central learning workflow.

## Open product questions

- What exact objective defines **Fewest Transfers**: minimum count, stable deterministic count, fees, limits, or another constraint?
- Should the current deterministic plan remain the default even if a separate optimizer is introduced?
- How does **Banker** settlement handle the banker's own win/loss, ineligible participants, payment limits, or banker absence?
- Is preferred banker stored per group, per session, or both, and must it be reconfirmed each time?
- Are paid/pending events append-only acknowledgments, and who may change them?
- What history is retained when a completed session is reopened and its settlement plan changes?
- Which player/group/session archive or deletion semantics meet privacy needs without breaking audit history?
- Which canonical Hand identity and application event constitute an exactly-once Home Game link?
- Can one Hand relate to more than one session, and how are mistaken links corrected?
- What reconciliation evidence is sufficient, and which discrepancies must remain unresolved?
- Which blind-timer/button features belong in a cash-game organizer versus a separate tournament capability?
- Which live/mobile actions are read-only, participant-confirmed, or organizer-only?

## Legacy/recovered IDs and ideas

- `HOME-GAME-SETTLEMENT-001` — **IMPLEMENTED** as the bounded deterministic settlement foundation owned by the current specification.
- `HOME-GAME-SETTLEMENT-UX-001` — **IMPLEMENTED bounded foundation**; richer preference, payment, and history behavior remains preserved here.
- `HOME-GAME-TABLE-LINK-001` — **PRESERVED**; no current Hand/PokerState linkage should be inferred.
- Fewest Transfers versus Banker and optional preferred banker — **OPEN PRODUCT QUESTIONS**.
- Player reuse/edit/archive, visible correction history, settlement summary, paid/pending tracking, reopen history, recurring games/player history, blind timer/button advancement, exactly-once Hand linkage, reconciliation, and later live/mobile sharing — **PRESERVED**.

## Related specs/capabilities

- [Home Game Organizer Specification](../HOME_GAME_ORGANIZER_SPEC.md)
- [Account Identity](../ACCOUNT_IDENTITY_SPEC.md)
- [Architecture Contract](../ARCHITECTURE_CONTRACT.md)
- [Saved Knowledge and Sharing](SAVED_KNOWLEDGE_AND_SHARING.md)
- [Learning Evidence Foundation](LEARNING_EVIDENCE_FOUNDATION.md)
- [Deep Hand Review](DEEP_HAND_REVIEW.md)
- [Interaction Grammar](../INTERACTION_GRAMMAR.md)
