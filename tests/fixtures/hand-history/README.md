# PokerStars English cash fixtures

Public representative histories retrieved from HHSmithy/PokerHandHistoryParser,
`HandHistories.Parser.UnitTests/SampleHandHistories/PokerStars/CashGame/`:

- `GeneralHands/HeroName.txt`
- `GeneralHands/SidePot.txt`
- `HandActionTests/FoldedPreflop.txt`
- `HandActionTests/BasicHand.txt`
- `HandActionTests/3BetHand.txt`
- `HandActionTests/AllInHandWithShowdown.txt`

Source: https://github.com/HHSmithy/PokerHandHistoryParser

Retrieved September 6, 2026. UTF-8 BOM removed; source facts unchanged.
Only HeroName identifies Hero. The other originals are tested as incomplete.
Tests explicitly create derivatives adding a Dealt-to line for coverage; these
are labelled test inputs and are never parser inference or production evidence.

`AllInCall.txt` is a synthetic, zero-rake heads-up regression fixture authored
for `BETA-BLOCKER-REPAIR-001` (September 8). It tests exact-stack calls; labelled
test derivatives cover ordinary/short calls and an all-in bet. It is not a
source-attributed played hand or strategy evidence.
