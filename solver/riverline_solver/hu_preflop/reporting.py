"""Correct combo-weighted projection from 1,326 combos to 169 classes."""

from __future__ import annotations

from collections.abc import Mapping

from .cards import canonical_combo, hand_class


def aggregate_strategy_to_169(
    combo_strategies: Mapping[tuple[str, str], Mapping[str, float]],
    legal_combos: set[tuple[str, str]] | None = None,
) -> dict[str, dict[str, float | int | dict[str, float]]]:
    """Average physical-combo strategies, weighting each legal combo once."""

    grouped: dict[str, list[Mapping[str, float]]] = {}
    normalized_legal = None if legal_combos is None else {
        canonical_combo(combo) for combo in legal_combos
    }
    for raw_combo, strategy in combo_strategies.items():
        combo = canonical_combo(raw_combo)
        if normalized_legal is not None and combo not in normalized_legal:
            continue
        if not isinstance(strategy, Mapping) or not strategy:
            raise ValueError("each exact combo requires a nonempty action strategy")
        total = sum(float(probability) for probability in strategy.values())
        if abs(total - 1.0) > 1e-9 or any(float(value) < 0 for value in strategy.values()):
            raise ValueError("each combo strategy must be nonnegative and normalized")
        grouped.setdefault(hand_class(combo), []).append(strategy)

    result: dict[str, dict[str, float | int | dict[str, float]]] = {}
    for class_name, strategies in sorted(grouped.items()):
        action_names = sorted({action for strategy in strategies for action in strategy})
        probabilities = {
            action: sum(float(strategy.get(action, 0)) for strategy in strategies) / len(strategies)
            for action in action_names
        }
        result[class_name] = {
            "comboCount": len(strategies),
            "actions": probabilities,
        }
    return result

