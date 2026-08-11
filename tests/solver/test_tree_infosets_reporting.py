from __future__ import annotations

import unittest

from riverline_solver.hu_preflop.cards import combos_by_hand_class
from riverline_solver.hu_preflop.game import HuPreflopGame
from riverline_solver.hu_preflop.infosets import infoset_key, parse_infoset_key
from riverline_solver.hu_preflop.reporting import aggregate_strategy_to_169
from riverline_solver.hu_preflop.tree import enumerate_public_tree, infoset_size_estimate


class TreeInfosetReportingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.game = HuPreflopGame()
        self.tree = enumerate_public_tree(self.game)

    def test_public_tree_is_deterministic_bounded_and_acyclic(self) -> None:
        summary = self.tree.summary()
        self.assertEqual(summary, {
            "publicNodes": 46,
            "terminalNodes": 30,
            "decisionNodes": 16,
            "maximumBettingDepth": 6,
            "actionEntries": 45,
            "averageActionsPerDecision": 2.8125,
            "actionsPerNodeDistribution": {"4": 5, "3": 3, "2": 8},
        })
        ids = [node.state.node_id for node in self.tree.nodes]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue(all(node.action_ids for node in self.tree.decision_nodes))
        self.assertTrue(all(not node.action_ids for node in self.tree.terminal_nodes))
        self.assertEqual(enumerate_public_tree(self.game).dump(), self.tree.dump())

    def test_infoset_key_contains_own_combo_history_and_position_but_not_opponent(self) -> None:
        state = self.game.replay(["raise_to_2500"])
        key = infoset_key(state, 1, ("As", "Kh"))
        payload = parse_infoset_key(key)
        self.assertEqual(payload["playerId"], "P1")
        self.assertEqual(payload["privateCards"], ["Kh", "As"])
        self.assertEqual(payload["publicNodeId"], state.node_id)
        self.assertNotIn("opponent", key.lower())
        self.assertNotIn("Qd", key)
        other_history = infoset_key(self.game.replay(["call"]), 1, ("As", "Kh"))
        other_combo = infoset_key(state, 1, ("As", "Qh"))
        self.assertNotEqual(key, other_history)
        self.assertNotEqual(key, other_combo)
        self.assertEqual(key, infoset_key(state, 1, ("Kh", "As")))

    def test_exact_combo_infoset_and_memory_estimate(self) -> None:
        estimate = infoset_size_estimate(self.tree)
        self.assertEqual(estimate["btnInfosets"], 10_608)
        self.assertEqual(estimate["bbInfosets"], 10_608)
        self.assertEqual(estimate["totalInfosets"], 21_216)
        self.assertEqual(estimate["regretEntries"], 59_670)
        self.assertEqual(estimate["float64RegretPlusAverageBytes"], 954_720)
        self.assertEqual(estimate["float32RegretPlusAverageBytes"], 477_360)

    def test_169_aggregation_weights_physical_combos_and_remaining_blockers(self) -> None:
        classes = combos_by_hand_class()
        strategies = {}
        for index, combo in enumerate(classes["AA"]):
            strategies[combo] = {"raise_to_2500": index / 5, "call": 1 - index / 5}
        for combo in classes["AKs"]:
            strategies[combo] = {"raise_to_2500": 1.0}
        for combo in classes["AKo"]:
            strategies[combo] = {"call": 1.0}
        report = aggregate_strategy_to_169(strategies)
        self.assertEqual(report["AA"]["comboCount"], 6)
        self.assertAlmostEqual(report["AA"]["actions"]["raise_to_2500"], 0.5)
        self.assertEqual(report["AKs"]["comboCount"], 4)
        self.assertEqual(report["AKo"]["comboCount"], 12)

        remaining = set(classes["AA"][:2])
        blocked_report = aggregate_strategy_to_169(strategies, remaining)
        self.assertEqual(blocked_report["AA"]["comboCount"], 2)
        self.assertAlmostEqual(blocked_report["AA"]["actions"]["raise_to_2500"], 0.1)
        self.assertNotIn("AKs", blocked_report)


if __name__ == "__main__":
    unittest.main()
