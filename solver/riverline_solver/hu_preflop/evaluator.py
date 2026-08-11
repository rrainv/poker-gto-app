"""Solver adapter for Riverline's existing verified Python evaluator."""

from __future__ import annotations

from scripts.backend_logic.evaluator import (
    EvaluatorLookupTable,
    evaluate7,
    make_card_int,
)

from .cards import validate_card


_LOOKUP = EvaluatorLookupTable()


def evaluate_seven(cards: tuple[str, ...] | list[str]) -> tuple[int, ...]:
    """Adapt the backend evaluator's ``(category, list)`` rank to a tuple.

    The evaluator itself remains in ``scripts/backend_logic/evaluator.py`` and
    is already cross-characterized against the browser/canonical evaluators.
    """

    if not isinstance(cards, (tuple, list)) or len(cards) != 7:
        raise ValueError("Hold'em showdown evaluation requires exactly seven cards")
    normalized = tuple(validate_card(card) for card in cards)
    if len(set(normalized)) != 7:
        raise ValueError("showdown cards must be physically unique")
    card_ints = [make_card_int(card) for card in normalized]
    category, tiebreakers = evaluate7(*card_ints, _LOOKUP)
    return category, *tiebreakers

