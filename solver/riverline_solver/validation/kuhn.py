"""Independent Kuhn Poker CFR sanity environment for SOLVER-002."""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import permutations, product


CARDS = (0, 1, 2)  # J, Q, K
ACTIONS = ("p", "b")  # pass/check/fold, bet/call


def is_terminal(history: str) -> bool:
    return history in {"pp", "bp", "bb", "pbp", "pbb"}


def terminal_utility_for_player_zero(cards: tuple[int, int], history: str) -> float:
    if not is_terminal(history):
        raise ValueError("Kuhn utility requires a terminal history")
    if history == "bp":
        return 1.0
    if history == "pbp":
        return -1.0
    stakes = 2.0 if history in {"bb", "pbb"} else 1.0
    return stakes if cards[0] > cards[1] else -stakes


def infoset(card: int, history: str) -> str:
    return f"{card}|{history}"


@dataclass
class Node:
    regret_sum: list[float] = field(default_factory=lambda: [0.0, 0.0])
    strategy_sum: list[float] = field(default_factory=lambda: [0.0, 0.0])

    def strategy(self, realization_weight: float) -> tuple[float, float]:
        positive = [max(value, 0.0) for value in self.regret_sum]
        total = sum(positive)
        current = (
            (positive[0] / total, positive[1] / total)
            if total > 0
            else (0.5, 0.5)
        )
        for index, probability in enumerate(current):
            self.strategy_sum[index] += realization_weight * probability
        return current

    def average(self) -> tuple[float, float]:
        total = sum(self.strategy_sum)
        return (
            (self.strategy_sum[0] / total, self.strategy_sum[1] / total)
            if total > 0
            else (0.5, 0.5)
        )


class KuhnCfrSanityTrainer:
    def __init__(self) -> None:
        self.nodes: dict[str, Node] = {}

    def _cfr(self, cards: tuple[int, int], history: str, p0: float, p1: float) -> float:
        plays = len(history)
        player = plays % 2
        if is_terminal(history):
            utility_zero = terminal_utility_for_player_zero(cards, history)
            return utility_zero if player == 0 else -utility_zero

        key = infoset(cards[player], history)
        node = self.nodes.setdefault(key, Node())
        strategy = node.strategy(p0 if player == 0 else p1)
        utilities = [0.0, 0.0]
        node_utility = 0.0
        for index, action in enumerate(ACTIONS):
            next_history = history + action
            if player == 0:
                utilities[index] = -self._cfr(cards, next_history, p0 * strategy[index], p1)
            else:
                utilities[index] = -self._cfr(cards, next_history, p0, p1 * strategy[index])
            node_utility += strategy[index] * utilities[index]
        opponent_reach = p1 if player == 0 else p0
        for index in range(2):
            node.regret_sum[index] += opponent_reach * (utilities[index] - node_utility)
        return node_utility

    def train(self, iterations: int) -> dict[str, tuple[float, float]]:
        if not isinstance(iterations, int) or iterations <= 0:
            raise ValueError("iterations must be positive")
        deals = tuple(permutations(CARDS, 2))
        for _ in range(iterations):
            for cards in deals:
                self._cfr(cards, "", 1.0, 1.0)
        return {key: node.average() for key, node in self.nodes.items()}


def profile_probability(profile: dict[str, tuple[float, float]], card: int, history: str, action: str) -> float:
    strategy = profile.get(infoset(card, history), (0.5, 0.5))
    return strategy[ACTIONS.index(action)]


def expected_value(profile: dict[str, tuple[float, float]]) -> float:
    def recurse(cards: tuple[int, int], history: str) -> float:
        if is_terminal(history):
            return terminal_utility_for_player_zero(cards, history)
        player = len(history) % 2
        return sum(
            profile_probability(profile, cards[player], history, action)
            * recurse(cards, history + action)
            for action in ACTIONS
        )

    return sum(recurse(cards, "") for cards in permutations(CARDS, 2)) / 6


def _player_infosets(player: int) -> tuple[str, ...]:
    histories = ("", "pb") if player == 0 else ("p", "b")
    return tuple(infoset(card, history) for card in CARDS for history in histories)


def _pure_profile(player: int, action_bits: tuple[int, ...]) -> dict[str, tuple[float, float]]:
    return {
        key: ((1.0, 0.0) if bit == 0 else (0.0, 1.0))
        for key, bit in zip(_player_infosets(player), action_bits, strict=True)
    }


def _merge_profiles(
    first: dict[str, tuple[float, float]],
    second: dict[str, tuple[float, float]],
) -> dict[str, tuple[float, float]]:
    return {**first, **second}


def nash_conv(profile: dict[str, tuple[float, float]]) -> tuple[float, float]:
    player_zero_keys = set(_player_infosets(0))
    player_one_keys = set(_player_infosets(1))
    fixed_zero = {key: value for key, value in profile.items() if key in player_zero_keys}
    fixed_one = {key: value for key, value in profile.items() if key in player_one_keys}
    best_zero = max(
        expected_value(_merge_profiles(_pure_profile(0, bits), fixed_one))
        for bits in product((0, 1), repeat=len(player_zero_keys))
    )
    worst_against_one = min(
        expected_value(_merge_profiles(fixed_zero, _pure_profile(1, bits)))
        for bits in product((0, 1), repeat=len(player_one_keys))
    )
    conv = best_zero - worst_against_one
    return conv, conv / 2

