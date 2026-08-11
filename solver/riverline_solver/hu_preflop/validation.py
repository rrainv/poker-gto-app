"""Finite strategy-profile, best-response, and exploitability validation boundary."""

from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from typing import Mapping, Protocol, Sequence

from .actions import AbstractAction
from .cards import DECK, all_combos, canonical_combo, validate_disjoint_combos
from .game import HuPreflopGame, PublicState
from .infosets import infoset_key
from .tree import enumerate_public_tree
from .utility import LeafValueProvider, terminal_utilities


ORDERED_PRIVATE_DEAL_COUNT = 1_624_350


@dataclass(frozen=True, slots=True)
class ChanceDeal:
    private_cards: tuple[tuple[str, str], tuple[str, str]]
    weight: float

    def __post_init__(self) -> None:
        validate_disjoint_combos(*self.private_cards)
        if not isinstance(self.weight, (int, float)) or self.weight <= 0:
            raise ValueError("chance-deal weight must be positive")


def iter_ordered_private_deals():
    """Yield every ordered disjoint combo assignment without materializing it."""

    weight = 1.0 / ORDERED_PRIVATE_DEAL_COUNT
    combos = all_combos()
    for first in combos:
        blocked = set(first)
        remaining = tuple(card for card in DECK if card not in blocked)
        for second in combinations(remaining, 2):
            yield ChanceDeal((first, canonical_combo(second)), weight)


class StrategyProfile(Protocol):
    def probabilities(
        self,
        game: HuPreflopGame,
        state: PublicState,
        player: int,
        private_combo: tuple[str, str],
    ) -> Mapping[str, float]: ...


def _first_matching(actions: tuple[AbstractAction, ...], types: tuple[str, ...]) -> AbstractAction:
    for action_type in types:
        for action in actions:
            if action.type == action_type:
                return action
    return actions[0]


@dataclass(frozen=True, slots=True)
class BaselineProfile:
    """Deliberately weak deterministic/uniform profiles for harness tests."""

    name: str

    def probabilities(
        self,
        game: HuPreflopGame,
        state: PublicState,
        player: int,
        private_combo: tuple[str, str],
    ) -> Mapping[str, float]:
        canonical_combo(private_combo)
        if state.acting_player != player:
            raise ValueError("baseline queried for the wrong actor")
        actions = game.legal_actions(state)
        if self.name == "uniform":
            probability = 1.0 / len(actions)
            return {action.action_id: probability for action in actions}
        if self.name == "always_fold":
            chosen = _first_matching(actions, ("fold", "check", "call", "raise", "all_in"))
        elif self.name == "always_call_check":
            chosen = _first_matching(actions, ("check", "call", "fold", "raise", "all_in"))
        elif self.name == "first_aggressive":
            chosen = _first_matching(actions, ("raise", "all_in", "call", "check", "fold"))
        else:
            raise ValueError(f"unsupported baseline profile: {self.name}")
        return {chosen.action_id: 1.0}


BASELINE_PROFILES = {
    name: BaselineProfile(name)
    for name in ("always_fold", "always_call_check", "first_aggressive", "uniform")
}


@dataclass(frozen=True, slots=True)
class TableStrategyProfile:
    strategies: Mapping[str, Mapping[str, float]]

    def probabilities(
        self,
        game: HuPreflopGame,
        state: PublicState,
        player: int,
        private_combo: tuple[str, str],
    ) -> Mapping[str, float]:
        return self.strategies[infoset_key(state, player, private_combo)]


def _normalized_probabilities(
    profile: StrategyProfile,
    game: HuPreflopGame,
    state: PublicState,
    player: int,
    combo: tuple[str, str],
) -> dict[str, float]:
    legal_ids = {action.action_id for action in game.legal_actions(state)}
    raw = dict(profile.probabilities(game, state, player, combo))
    if not raw or any(action_id not in legal_ids for action_id in raw):
        raise ValueError("strategy profile contains a missing or illegal action")
    probabilities = {action_id: float(value) for action_id, value in raw.items()}
    if any(value < 0 for value in probabilities.values()) or abs(sum(probabilities.values()) - 1) > 1e-9:
        raise ValueError("strategy probabilities must be nonnegative and sum to one")
    return probabilities


def _value_from_state(
    game: HuPreflopGame,
    state: PublicState,
    private_cards: tuple[tuple[str, str], tuple[str, str]],
    profiles: tuple[StrategyProfile, StrategyProfile],
    leaf_value_provider: LeafValueProvider,
    perspective: int,
) -> float:
    if state.is_terminal:
        return terminal_utilities(state, private_cards, leaf_value_provider)[perspective]
    actor = state.acting_player
    assert actor is not None
    probabilities = _normalized_probabilities(
        profiles[actor], game, state, actor, private_cards[actor],
    )
    action_by_id = {action.action_id: action for action in game.legal_actions(state)}
    return sum(
        probability * _value_from_state(
            game,
            game.apply_action(state, action_by_id[action_id]),
            private_cards,
            profiles,
            leaf_value_provider,
            perspective,
        )
        for action_id, probability in probabilities.items()
        if probability > 0
    )


def expected_value(
    profile_zero: StrategyProfile,
    profile_one: StrategyProfile,
    deals: Sequence[ChanceDeal],
    leaf_value_provider: LeafValueProvider,
    game: HuPreflopGame | None = None,
) -> tuple[float, float]:
    target = game if game is not None else HuPreflopGame()
    if not deals:
        raise ValueError("expected-value evaluation requires at least one chance deal")
    total_weight = sum(deal.weight for deal in deals)
    if total_weight <= 0:
        raise ValueError("chance-deal weights must have positive total mass")
    value_zero = sum(
        deal.weight * _value_from_state(
            target,
            target.initial_state(),
            deal.private_cards,
            (profile_zero, profile_one),
            leaf_value_provider,
            0,
        )
        for deal in deals
    ) / total_weight
    return value_zero, -value_zero


@dataclass(frozen=True, slots=True)
class BestResponseProfile:
    player: int
    choices: Mapping[str, str]

    def probabilities(
        self,
        game: HuPreflopGame,
        state: PublicState,
        player: int,
        private_combo: tuple[str, str],
    ) -> Mapping[str, float]:
        if player != self.player:
            raise ValueError("best-response profile queried for the wrong player")
        key = infoset_key(state, player, private_combo)
        return {self.choices[key]: 1.0}


@dataclass(frozen=True, slots=True)
class BestResponseResult:
    player: int
    utility_milli_bb: float
    profile: BestResponseProfile


def _opponent_reach_to_state(
    game: HuPreflopGame,
    target_state: PublicState,
    private_cards: tuple[tuple[str, str], tuple[str, str]],
    responding_player: int,
    opponent_profile: StrategyProfile,
) -> float:
    state = game.initial_state()
    reach = 1.0
    for target_entry in target_state.history:
        actor = state.acting_player
        assert actor is not None
        if actor != responding_player:
            probabilities = _normalized_probabilities(
                opponent_profile, game, state, actor, private_cards[actor],
            )
            reach *= probabilities.get(target_entry.action.action_id, 0.0)
        state = game.apply_action(state, target_entry.action)
    if state.node_id != target_state.node_id:
        raise ValueError("target history replay did not reproduce the public node")
    return reach


def exact_best_response(
    opponent_profile: StrategyProfile,
    responding_player: int,
    deals: Sequence[ChanceDeal],
    leaf_value_provider: LeafValueProvider,
    game: HuPreflopGame | None = None,
) -> BestResponseResult:
    """Exact over the supplied finite chance fixture.

    Passing all 1,624,350 deals and an exact equity cache is supported by the
    interface but intentionally not a unit-test workload.
    """

    if responding_player not in {0, 1}:
        raise ValueError("responding_player must be 0 or 1")
    if not deals:
        raise ValueError("best response requires at least one chance deal")
    target = game if game is not None else HuPreflopGame()
    tree = enumerate_public_tree(target)
    decision_states = sorted(
        (
            node.state for node in tree.decision_nodes
            if node.state.acting_player == responding_player
        ),
        key=lambda state: len(state.history),
        reverse=True,
    )
    choices: dict[str, str] = {}

    class PartialBestResponse:
        def probabilities(self, game, state, player, private_combo):
            return {choices[infoset_key(state, player, private_combo)]: 1.0}

    partial = PartialBestResponse()
    profiles: tuple[StrategyProfile, StrategyProfile] = (
        (partial, opponent_profile)
        if responding_player == 0
        else (opponent_profile, partial)
    )

    own_combos = sorted({
        canonical_combo(deal.private_cards[responding_player]) for deal in deals
    })
    for state in decision_states:
        legal = target.legal_actions(state)
        for own_combo in own_combos:
            matching_deals = [
                deal for deal in deals
                if canonical_combo(deal.private_cards[responding_player]) == own_combo
            ]
            if not matching_deals:
                continue
            best_action = legal[0]
            best_value = float("-inf")
            for action in legal:
                weighted_value = 0.0
                reach_weight = 0.0
                continuation = target.apply_action(state, action)
                for deal in matching_deals:
                    opponent_reach = _opponent_reach_to_state(
                        target, state, deal.private_cards, responding_player, opponent_profile,
                    )
                    weight = deal.weight * opponent_reach
                    if weight == 0:
                        continue
                    weighted_value += weight * _value_from_state(
                        target,
                        continuation,
                        deal.private_cards,
                        profiles,
                        leaf_value_provider,
                        responding_player,
                    )
                    reach_weight += weight
                candidate_value = weighted_value / reach_weight if reach_weight > 0 else 0.0
                if candidate_value > best_value:
                    best_value = candidate_value
                    best_action = action
            choices[infoset_key(state, responding_player, own_combo)] = best_action.action_id

    response_profile = BestResponseProfile(responding_player, choices)
    if responding_player == 0:
        utility = expected_value(
            response_profile, opponent_profile, deals, leaf_value_provider, target,
        )[0]
    else:
        utility = expected_value(
            opponent_profile, response_profile, deals, leaf_value_provider, target,
        )[1]
    return BestResponseResult(responding_player, utility, response_profile)


@dataclass(frozen=True, slots=True)
class ExploitabilityResult:
    profile_value_milli_bb: tuple[float, float]
    best_response_values_milli_bb: tuple[float, float]
    nash_conv_milli_bb: float
    exploitability_milli_bb: float


def exploitability(
    profile_zero: StrategyProfile,
    profile_one: StrategyProfile,
    deals: Sequence[ChanceDeal],
    leaf_value_provider: LeafValueProvider,
    game: HuPreflopGame | None = None,
) -> ExploitabilityResult:
    target = game if game is not None else HuPreflopGame()
    profile_value = expected_value(
        profile_zero, profile_one, deals, leaf_value_provider, target,
    )
    response_zero = exact_best_response(
        profile_one, 0, deals, leaf_value_provider, target,
    )
    response_one = exact_best_response(
        profile_zero, 1, deals, leaf_value_provider, target,
    )
    nash_conv = (
        response_zero.utility_milli_bb - profile_value[0]
        + response_one.utility_milli_bb - profile_value[1]
    )
    if nash_conv < -1e-7:
        raise ValueError("NashConv cannot be negative")
    return ExploitabilityResult(
        profile_value,
        (response_zero.utility_milli_bb, response_one.utility_milli_bb),
        max(0.0, nash_conv),
        max(0.0, nash_conv / 2),
    )

