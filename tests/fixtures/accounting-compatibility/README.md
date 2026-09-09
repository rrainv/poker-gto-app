# AUD-01 historical compatibility fixture

`pre-fix.json` was generated on September 8, 2026 **before** editing canonical
accounting, from `createCanonicalHandSession` and the Saved factories in the
working tree based on `b36999b`. It is synthetic, contains no personal data, and
must not be regenerated with current accounting.

It contains genuine pre-fix PokerState/Saved/Replay v1 and v2 HU BBA initial and
terminal snapshots, old exact decision contexts (25% threshold), metadata and
same-owner Hand references. The old terminal values are SB101 / BB99 with a 1bb
BBA refund. Current canonical reconstruction must produce SB102 / BB98 without
changing source cards/actions/amounts or annotations. Ordinary no-ante and the
existing synthetic imported recorded-settlement v3 history are controls.

There is no legacy poker implementation in the fixture or migration adapter.
