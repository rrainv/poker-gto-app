"""Versioned exact-combo equity boundary and persistable on-demand cache."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from itertools import combinations
from pathlib import Path
from typing import Protocol

from .cards import CARD_INDEX, DECK, canonical_combo, validate_disjoint_combos
from .evaluator import evaluate_seven
from .spec import EQUITY_CACHE_SCHEMA_VERSION


@dataclass(frozen=True, slots=True)
class EquityRecord:
    wins_first: int
    ties: int
    trials: int

    def __post_init__(self) -> None:
        if any(not isinstance(value, int) or value < 0 for value in (
            self.wins_first, self.ties, self.trials,
        )):
            raise ValueError("equity counts must be nonnegative integers")
        if self.trials <= 0 or self.wins_first + self.ties > self.trials:
            raise ValueError("equity counts are inconsistent")

    @property
    def first_share(self) -> float:
        return (self.wins_first + self.ties / 2) / self.trials

    def reversed(self) -> "EquityRecord":
        wins_second = self.trials - self.wins_first - self.ties
        return EquityRecord(wins_second, self.ties, self.trials)


class EquitySource(Protocol):
    def equity(
        self,
        hero_combo: tuple[str, str],
        villain_combo: tuple[str, str],
    ) -> float: ...


def _combo_token(combo: tuple[str, str]) -> str:
    return "".join(combo)


def _ordered_pair(
    first: tuple[str, str] | list[str],
    second: tuple[str, str] | list[str],
) -> tuple[tuple[str, str], tuple[str, str], bool]:
    left, right = validate_disjoint_combos(first, second)
    left_key = tuple(CARD_INDEX[card] for card in left)
    right_key = tuple(CARD_INDEX[card] for card in right)
    if left_key <= right_key:
        return left, right, False
    return right, left, True


class PreflopEquityCache:
    """Sparse cache; SOLVER-001 never materializes the 812,175-matchup universe."""

    def __init__(self) -> None:
        self._records: dict[str, EquityRecord] = {}

    @staticmethod
    def _key(first: tuple[str, str], second: tuple[str, str]) -> str:
        return f"{_combo_token(first)}|{_combo_token(second)}"

    def __len__(self) -> int:
        return len(self._records)

    def get_record(
        self,
        first: tuple[str, str] | list[str],
        second: tuple[str, str] | list[str],
    ) -> EquityRecord | None:
        low, high, reversed_input = _ordered_pair(first, second)
        record = self._records.get(self._key(low, high))
        if record is None:
            return None
        return record.reversed() if reversed_input else record

    def put_record(
        self,
        first: tuple[str, str] | list[str],
        second: tuple[str, str] | list[str],
        record: EquityRecord,
    ) -> None:
        low, high, reversed_input = _ordered_pair(first, second)
        stored = record.reversed() if reversed_input else record
        self._records[self._key(low, high)] = stored

    def equity(
        self,
        hero_combo: tuple[str, str],
        villain_combo: tuple[str, str],
    ) -> float:
        record = self.get_record(hero_combo, villain_combo)
        if record is None:
            raise KeyError("exact equity matchup is absent from the sparse cache")
        return record.first_share

    def save(self, path: str | Path) -> None:
        payload = {
            "schemaVersion": EQUITY_CACHE_SCHEMA_VERSION,
            "records": {key: asdict(record) for key, record in sorted(self._records.items())},
        }
        Path(path).write_text(json.dumps(payload, sort_keys=True, indent=2) + "\n", encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "PreflopEquityCache":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        if payload.get("schemaVersion") != EQUITY_CACHE_SCHEMA_VERSION:
            raise ValueError("equity cache version mismatch")
        cache = cls()
        for key, raw in payload.get("records", {}).items():
            cache._records[key] = EquityRecord(**raw)
        return cache


def enumerate_exact_preflop_equity(
    first: tuple[str, str] | list[str],
    second: tuple[str, str] | list[str],
) -> EquityRecord:
    """Enumerate all C(48, 5) boards once for one exact disjoint matchup."""

    left, right = validate_disjoint_combos(first, second)
    blocked = set((*left, *right))
    remaining = tuple(card for card in DECK if card not in blocked)
    wins = 0
    ties = 0
    trials = 0
    for board in combinations(remaining, 5):
        left_rank = evaluate_seven((*left, *board))
        right_rank = evaluate_seven((*right, *board))
        trials += 1
        if left_rank > right_rank:
            wins += 1
        elif left_rank == right_rank:
            ties += 1
    return EquityRecord(wins, ties, trials)


class ExactPreflopEquitySource:
    """Exact, lazy, and memoized; suitable for one-time cache generation jobs."""

    def __init__(self, cache: PreflopEquityCache | None = None) -> None:
        self.cache = cache if cache is not None else PreflopEquityCache()

    def equity(
        self,
        hero_combo: tuple[str, str],
        villain_combo: tuple[str, str],
    ) -> float:
        cached = self.cache.get_record(hero_combo, villain_combo)
        if cached is None:
            cached = enumerate_exact_preflop_equity(hero_combo, villain_combo)
            self.cache.put_record(hero_combo, villain_combo, cached)
        return cached.first_share


class FixedEquitySource:
    """Explicit test/fixture equity source; never used as a production fallback."""

    def __init__(self, shares: dict[tuple[tuple[str, str], tuple[str, str]], float]) -> None:
        self._shares: dict[tuple[tuple[str, str], tuple[str, str]], float] = {}
        for (first, second), share in shares.items():
            left, right = validate_disjoint_combos(first, second)
            if not isinstance(share, (int, float)) or not 0 <= float(share) <= 1:
                raise ValueError("fixture equity shares must be in [0, 1]")
            self._shares[(left, right)] = float(share)
            self._shares[(right, left)] = 1.0 - float(share)

    def equity(self, hero_combo: tuple[str, str], villain_combo: tuple[str, str]) -> float:
        left, right = validate_disjoint_combos(hero_combo, villain_combo)
        return self._shares[(left, right)]

