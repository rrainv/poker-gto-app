# Poker Engine Specification

## 1. Goal

Provide deterministic, testable Texas Hold'em state transitions and calculations.

## 2. State requirements

A canonical state must represent:

- street
- board cards
- hole cards
- number of players
- active/folded/all-in status
- position
- acting player
- individual stacks
- effective stack
- player contributions
- pot
- current bet
- action history
- legal actions
- blind/ante configuration
- game type
- fixed per-hand deduction when applicable

## 3. Card invariants

At all times:

- no duplicate physical card exists
- hole cards and board cards are disjoint
- card count matches the street
- invalid card strings/encodings are rejected

## 4. Pot and stack invariants

For every action:

```text
stack_after = stack_before - chips_committed
contribution_after = contribution_before + chips_committed
```

The total pot must equal the sum of contributions plus any explicitly modeled deductions.

All-in status must be explicit.

## 5. Rake/deduction

Home games:

```text
deduction = 0
```

ClubGG-style game (once per seated player, outside the contestable pot):

```text
deduction = 0.1bb × seated player count per hand
```

Do not model this as a percentage.

The deduction must be applied exactly once.

## 6. Equity

Equity must support:

- heads-up
- multiway
- exact enumeration where feasible
- Monte Carlo where required
- ties
- known opponent cards
- opponent ranges where supported

For every equity result:

```text
0 <= equity <= 1
```

and all player equities must obey the chosen tie/equity convention.

## 7. Evaluator

The evaluator must be tested against known hands:

- high card
- pair
- two pair
- trips
- straight
- flush
- full house
- quads
- straight flush
- board-made hands
- ties

Performance optimizations must never change evaluator output.

## 8. Betting actions

Actions must be represented structurally rather than as arbitrary strings.

Conceptually:

```text
fold
check
call
raise(amount)
bet(amount)
all_in
```

The final internal representation can differ, but semantic meaning must remain explicit.

## 9. Terminal states

A state is terminal when:

- only one player remains
- all required betting is complete and showdown occurs
- all remaining players are all-in and board runout is complete
- another explicit Hold'em terminal condition is met

Do not use arbitrary history length as a production terminal condition.

## 10. Testing

Every engine change requires regression tests for both normal and edge cases.
