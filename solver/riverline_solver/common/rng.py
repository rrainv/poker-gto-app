"""Deterministic local random-number utilities.

Solver code receives or owns an RNG instance. It never depends on the module-level
``random`` state used by legacy training prototypes.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import MutableSequence, TypeVar


T = TypeVar("T")


@dataclass
class SeededRng:
    """A reproducible RNG whose mutable state is private to this instance."""

    seed: int
    _random: random.Random = field(init=False, repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self.seed, int):
            raise TypeError("seed must be an integer")
        self._random = random.Random(self.seed)

    def shuffle(self, values: MutableSequence[T]) -> None:
        self._random.shuffle(values)

    def sample(self, population: list[T] | tuple[T, ...], count: int) -> list[T]:
        return self._random.sample(population, count)

    def randrange(self, stop: int) -> int:
        return self._random.randrange(stop)

