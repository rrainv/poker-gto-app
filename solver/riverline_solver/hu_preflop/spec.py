"""Authoritative constants for ``riverline-hu-preflop-100bb/v1``."""

from __future__ import annotations

from types import MappingProxyType


GAME_SPEC_VERSION = "riverline-hu-preflop-100bb/v1"
PUBLIC_STATE_SCHEMA_VERSION = "riverline-hu-preflop-public-state/v1"
INFOSET_SCHEMA_VERSION = "riverline-hu-preflop-infoset/v1"
EQUITY_CACHE_SCHEMA_VERSION = "riverline-hu-preflop-equity-cache/v1"
STRATEGY_PROFILE_SCHEMA_VERSION = "riverline-hu-preflop-strategy-profile/v1"

MILLI_BB_PER_BB = 1_000
CHIP_UNIT_MILLI_BB = 100
STARTING_STACK_MILLI_BB = 100_000
SMALL_BLIND_MILLI_BB = 500
BIG_BLIND_MILLI_BB = 1_000
PLAYER_IDS = ("P0", "P1")
POSITIONS = ("BTN", "BB")

# The first key is the branch opened by BTN. Values are raise-to amounts. The
# final all-in action is generated independently from the live stack cap.
RAISE_TO_BY_BRANCH_AND_AGGRESSION = MappingProxyType({
    "open": (2_500, 8_000, 20_000),
    "limp": (4_000, 12_000, 30_000),
})

TERMINAL_FOLD = "fold"
TERMINAL_SHOWDOWN_EQUITY = "showdown_equity"
LEAF_VALUE_MODEL = "preflop_showdown_equity_terminal/v1"

