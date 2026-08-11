"""Zero-sum terminal utility and replaceable preflop leaf-value boundary."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .cards import validate_disjoint_combos
from .equity import EquitySource
from .game import HuPreflopGame, PublicState
from .spec import STARTING_STACK_MILLI_BB, TERMINAL_FOLD, TERMINAL_SHOWDOWN_EQUITY


class LeafValueProvider(Protocol):
    def utilities(
        self,
        state: PublicState,
        private_cards: tuple[tuple[str, str], tuple[str, str]],
    ) -> tuple[float, float]: ...


@dataclass(frozen=True, slots=True)
class ShowdownEquityLeafValue:
    equity_source: EquitySource

    def utilities(
        self,
        state: PublicState,
        private_cards: tuple[tuple[str, str], tuple[str, str]],
    ) -> tuple[float, float]:
        HuPreflopGame().validate_state(state)
        if state.terminal_reason != TERMINAL_SHOWDOWN_EQUITY:
            raise ValueError("showdown-equity utility requires a showdown-equity leaf")
        first, second = validate_disjoint_combos(*private_cards)
        first_equity = self.equity_source.equity(first, second)
        if not 0 <= first_equity <= 1:
            raise ValueError("equity source returned an invalid share")
        final_first = state.player(0).stack_milli_bb + first_equity * state.pot_milli_bb
        final_second = state.player(1).stack_milli_bb + (1 - first_equity) * state.pot_milli_bb
        utilities = (
            final_first - STARTING_STACK_MILLI_BB,
            final_second - STARTING_STACK_MILLI_BB,
        )
        if abs(utilities[0] + utilities[1]) > 1e-7:
            raise ValueError("no-rake terminal utility must be exactly zero-sum")
        return utilities


def terminal_utilities(
    state: PublicState,
    private_cards: tuple[tuple[str, str], tuple[str, str]] | None,
    leaf_value_provider: LeafValueProvider,
) -> tuple[float, float]:
    HuPreflopGame().validate_state(state)
    if not state.is_terminal:
        raise ValueError("terminal utility requires a terminal state")
    if state.terminal_reason == TERMINAL_FOLD:
        utilities = tuple(
            float(player.stack_milli_bb - STARTING_STACK_MILLI_BB)
            for player in state.players
        )
    else:
        if private_cards is None:
            raise ValueError("showdown-equity leaves require both exact private combos")
        utilities = leaf_value_provider.utilities(state, private_cards)
    if abs(sum(utilities)) > 1e-7:
        raise ValueError("terminal utility must be zero-sum")
    return utilities[0], utilities[1]

