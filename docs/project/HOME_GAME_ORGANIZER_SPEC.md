# Riverline Home Game Organizer specification

Status: `HOME-GAME-001A` implementation checkpoint  
Date: August 18, 2026

## Purpose and boundary

The Home Game Organizer is a standalone Riverline domain for running a real cash-game poker night. It records people, reusable groups, sessions/seats, exact financial facts, optional chip-count facts, results, and settlement.

It is not poker analysis. Nothing under `app/src/home-game/` depends on or contributes to PokerState, DecisionContext, StrategyProvider, Equity, Training, Personal Strategy, or Saved Study Objects. The browser workspace consumes the Home Game application service and does not implement accounting rules.

```text
Home Game form / commands
          -> Home Game application service
          -> Home Game v1 domain + repository
          -> account-scoped IndexedDB OR Guest memory adapter
```

## Versioned entities

- `HomeGameOwnerRef v1`: opaque Riverline identity ID plus `account_identity`, or runtime-only `guest_session`.
- `HomeGamePlayer v1`: stable ID, display name, optional nickname/notes, archive flag, timestamps, revision. It is not a Riverline account or strategy/tendency profile.
- `HomeGameGroup v1`: stable ID, name, ordered player IDs. Membership references rather than owns players.
- `HomeGameSession v1`: owner, title, lifecycle, currency, optional blinds, ordered participants/seats, notes, optional source group, timestamps, revision.
- `HomeGameParticipant v1`: player reference, optional positive seat, `active | inactive | cashed_out`, optional button fact, optional initial chip count.
- `HomeGameTransaction v1`: immutable `buy_in | rebuy | add_on | cash_out | correction` ledger entry.
- `HomeGameChipSnapshot v1`: optional current/final integer chip count. It is never financial authority.
- `HomeGameSettlement v1`: deterministic derived transfers, not a stored total.
- `HomeGameSessionExport v1`: serializable session/ledger/snapshot envelope; no UI yet.

All durable records have stable opaque IDs and owner references. Session/group/player records have revisions; ledger and snapshot facts are immutable.

## Exact money semantics

Money is a safe integer count of minor units plus `currency.code`, presentation `currency.label`, and `currency.minorUnit` (0–6). Decimal text is parsed as a string with integer/BigInt scaling. Binary floating-point arithmetic never derives cents, so `0.10 + 0.20` becomes exactly `10 + 20 = 30` minor units. There is no FX conversion.

Blinds are optional metadata and do not affect accounting. Chip counts are separate integers. The implementation never assumes one chip equals one currency unit.

## Canonical ledger and corrections

The append-only ledger is the only financial authority:

```text
totalIn  = buy-ins + rebuys + add-ons after corrections
totalOut = cash-outs after corrections
net      = totalOut - totalIn
```

A correction points to one earlier non-correction entry and exactly matches its session, player, and amount. It contributes the inverse of the original fact. A transaction may be corrected once; corrections cannot correct corrections. Changing an amount is a reversal followed by a replacement entry, preserving the incorrect fact for audit.

Physical storage adds repository-only ledger sequence so equal timestamps reload in append order. It is not portable domain data. External adjustments, rake, house expenses, and silently edited totals are unsupported.

## Balance, lifecycle, and settlement

`sessionBalance = total cash-outs - total money in = sum(participant net)`. A session balances only at exactly zero minor units. No tolerance is needed and no discrepancy is distributed.

Lifecycle is `draft -> active -> completed`, with deliberate `completed -> active` reopen. Completion requires every active participant to be explicitly cashed out/inactive, exact balance, and computable settlement. Completed sessions reject edits. Reopen increments revision, clears `endedAt`, and preserves history. A zero cash-out uses explicit participant state without a meaningless zero ledger entry.

Settlement orders creditors and debtors by stable participant order. A two-pointer pass transfers the smaller remaining claim/obligation and advances exhausted sides. It is deterministic and uses at most `debtors + creditors - 1` transfers. Tests prove positive debtor-to-creditor transfers, exhausted claims, conserved total, zero-result omission, and explicit `unbalanced_session` failure.

## Persistence, ownership, and Guest behavior

IndexedDB `home-game-indexeddb/v1` has versioned metadata, player, group, session, transaction, and snapshot stores with owner and owner/session indexes. Ledger append plus session revision, cash-out plus participant final state, lifecycle transitions, and repository revision commit atomically. Failed writes preserve prior state.

Authenticated ownership uses the active opaque Riverline identity ID—not username, email, display name, or provider subject. Account switches select isolated repository scopes; every query fails closed on foreign ownership. The foundation intentionally avoids changing the released account-domain binding enum; Home Game uses the same opaque identity authority directly without an unrelated account-registry migration.

Guest semantics are explicit:

- Guests may run a complete session in a runtime memory adapter.
- Guests never query a persistent identity and cannot save reusable groups.
- IndexedDB rejects a Guest owner, so there is no silent durable Guest history.
- Guest data disappears with the runtime. Sign-in selects the account scope; automatic adoption of an in-progress Guest session is not implemented.

Home Game financial data is private and local. There is no upload, telemetry, public sharing, or sync. Later sync must use an approved domain adapter behind SyncCoordinator and preserve immutable ledger/correction history.

## First usable web workspace

The top-level workspace provides Guest/account storage status; New Session with currency, ordered names/default seats, initial buy-in and optional account-only group; Saved Groups and Recent Sessions; participant Total in/Cash out/Chips plus textual Receives/Owes/Even; Rebuy, Add-on, Cash out and chip snapshots; balance status; guarded completion; settlement; and reopen.

Cards replace a wide financial table and collapse to one result column on narrower desktops. Forms are semantic and labeled; errors use an assertive live region; result meaning is not color-only; logical CSS supports RTL. Stable copy is supplied in EN/RU/HE. No delete/archive action is exposed yet.

## Performance

The domain performs deterministic integer arithmetic over one ledger. IndexedDB uses owner/session indexes; the workspace loads at most 12 recent sessions. It adds no interval polling, poker computation, Matrix/Equity/Training work, or strategy-provider call, preserving PERF-001 behavior.

## Unsupported and preserved future

- cloud sync, sharing, QR/invites, payment links, shared confirmation;
- phone participants, live multi-device updates, mobile companion composition;
- tournament accounting, blind timer, payout structures, chip denominations;
- external adjustments/rake/expenses;
- analytics, tendencies, avatars, account linkage;
- saved-player editing/archive, session archive/delete, correction-history UI;
- dealer/button advancement, photos, recurring games, group defaults;
- Guest-to-account adoption and import/export UI;
- completed Firefox visual/language acceptance.

Tournament sessions must not reuse this cash-game contract as though chip counts were money. They require separate versioned accounting semantics.

