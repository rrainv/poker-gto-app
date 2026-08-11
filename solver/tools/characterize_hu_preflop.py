"""Local-only deterministic performance characterization for SOLVER-001."""

from __future__ import annotations

import json
from time import perf_counter

from riverline_solver.hu_preflop.equity import EquityRecord, FixedEquitySource, PreflopEquityCache
from riverline_solver.hu_preflop.game import HuPreflopGame
from riverline_solver.hu_preflop.tree import enumerate_public_tree, infoset_size_estimate
from riverline_solver.hu_preflop.utility import ShowdownEquityLeafValue
from riverline_solver.hu_preflop.validation import (
    BASELINE_PROFILES,
    ChanceDeal,
    exact_best_response,
    expected_value,
)


def timed_per_call(function, calls: int) -> float:
    started = perf_counter()
    for _ in range(calls):
        function()
    return (perf_counter() - started) / calls


def main() -> None:
    game = HuPreflopGame()
    tree = enumerate_public_tree(game)
    active_states = [node.state for node in tree.decision_nodes]
    cache = PreflopEquityCache()
    cache.put_record(("As", "Ah"), ("Ks", "Kh"), EquityRecord(8, 1, 10))
    deals = (
        ChanceDeal((("As", "Ah"), ("Ks", "Kh")), 0.5),
        ChanceDeal((("2s", "3s"), ("Ac", "Kd")), 0.5),
    )
    leaf = ShowdownEquityLeafValue(FixedEquitySource({
        (("As", "Ah"), ("Ks", "Kh")): 1.0,
        (("2s", "3s"), ("Ac", "Kd")): 0.0,
    }))
    state_index = 0

    def generate_legal() -> None:
        nonlocal state_index
        game.legal_actions(active_states[state_index % len(active_states)])
        state_index += 1

    report = {
        "schemaVersion": "riverline-hu-preflop-characterization/v1",
        "tree": tree.summary(),
        "infosets": infoset_size_estimate(tree),
        "secondsPerCall": {
            "publicTreeEnumeration": timed_per_call(lambda: enumerate_public_tree(game), 200),
            "legalActionGeneration": timed_per_call(generate_legal, 100_000),
            "sparseEquityLookup": timed_per_call(
                lambda: cache.equity(("As", "Ah"), ("Ks", "Kh")), 100_000,
            ),
            "twoDealProfileEvaluation": timed_per_call(
                lambda: expected_value(
                    BASELINE_PROFILES["uniform"],
                    BASELINE_PROFILES["uniform"],
                    deals,
                    leaf,
                    game,
                ),
                20,
            ),
            "twoDealBestResponse": timed_per_call(
                lambda: exact_best_response(
                    BASELINE_PROFILES["uniform"], 0, deals, leaf, game,
                ),
                5,
            ),
        },
        "warning": "Fixture timings do not include full 1,624,350-deal or exact-board equity enumeration.",
    }
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

