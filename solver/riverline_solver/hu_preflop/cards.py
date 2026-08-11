"""Strict card/combo utilities for solver chance and reporting."""

from __future__ import annotations

from itertools import combinations

from riverline_solver.common.rng import SeededRng


RANKS = "23456789TJQKA"
SUITS = "shdc"
DECK = tuple(f"{rank}{suit}" for rank in RANKS for suit in SUITS)
CARD_INDEX = {card: index for index, card in enumerate(DECK)}


def validate_card(card: str) -> str:
    if not isinstance(card, str) or len(card) != 2 or card not in CARD_INDEX:
        raise ValueError("cards must use strict two-character strings such as As or Kh")
    return card


def canonical_combo(cards: tuple[str, str] | list[str]) -> tuple[str, str]:
    if not isinstance(cards, (tuple, list)) or len(cards) != 2:
        raise ValueError("a private combo requires exactly two cards")
    first, second = (validate_card(card) for card in cards)
    if first == second:
        raise ValueError("a private combo cannot contain a duplicate card")
    return tuple(sorted((first, second), key=CARD_INDEX.__getitem__))


def validate_disjoint_combos(
    first: tuple[str, str] | list[str],
    second: tuple[str, str] | list[str],
) -> tuple[tuple[str, str], tuple[str, str]]:
    left = canonical_combo(first)
    right = canonical_combo(second)
    overlap = set(left).intersection(right)
    if overlap:
        raise ValueError(f"private combos overlap: {sorted(overlap)}")
    return left, right


def all_combos() -> tuple[tuple[str, str], ...]:
    return tuple(combinations(DECK, 2))


def deal_private_cards(seed: int) -> tuple[tuple[str, str], tuple[str, str]]:
    deck = list(DECK)
    SeededRng(seed).shuffle(deck)
    return canonical_combo(deck[:2]), canonical_combo(deck[2:4])


def hand_class(combo: tuple[str, str] | list[str]) -> str:
    first, second = canonical_combo(combo)
    rank_first, rank_second = first[0], second[0]
    value_first, value_second = RANKS.index(rank_first), RANKS.index(rank_second)
    if value_first == value_second:
        return rank_first * 2
    high, low = (
        (rank_first, rank_second)
        if value_first > value_second
        else (rank_second, rank_first)
    )
    suffix = "s" if first[1] == second[1] else "o"
    return f"{high}{low}{suffix}"


def combos_by_hand_class() -> dict[str, tuple[tuple[str, str], ...]]:
    grouped: dict[str, list[tuple[str, str]]] = {}
    for combo in all_combos():
        grouped.setdefault(hand_class(combo), []).append(combo)
    return {name: tuple(combos) for name, combos in grouped.items()}

