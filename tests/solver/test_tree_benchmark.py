from __future__ import annotations

import gc
from pathlib import Path
import sys
import time
import tracemalloc
import unittest

# Ensure solver root is discoverable when run directly or via discover
SOLVER_ROOT = Path(__file__).resolve().parents[2] / "solver"
if str(SOLVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SOLVER_ROOT))

from riverline_solver.hu_preflop.game import HuPreflopGame
from riverline_solver.hu_preflop.tree import enumerate_public_tree, infoset_size_estimate


class LocalSolverTreeBenchmarkTests(unittest.TestCase):
    """
    Benchmark and boundary verification for local solver tree construction
    and memory constraints on developer hardware (e.g. Ryzen 7 5700X, 16GB RAM).
    """

    def setUp(self) -> None:
        self.game = HuPreflopGame()

    def test_tree_building_latency_and_throughput(self) -> None:
        """Benchmark public tree building latency and assert strict execution time limit."""
        iterations = 50
        start = time.perf_counter()
        for _ in range(iterations):
            tree = enumerate_public_tree(self.game)
        elapsed = time.perf_counter() - start

        avg_latency_ms = (elapsed / iterations) * 1000.0
        # In this environment, tree enumeration is typically < 2ms per build.
        # Enforce an upper bound threshold of 50ms to catch algorithmic regressions.
        self.assertLess(
            avg_latency_ms,
            50.0,
            f"Tree enumeration took {avg_latency_ms:.2f}ms on average, exceeding 50ms threshold",
        )
        self.assertEqual(len(tree.nodes), 46)

    def test_tree_structural_constraints(self) -> None:
        """Verify structural tree constraints: max betting depth, node count bounds, and branching."""
        tree = enumerate_public_tree(self.game)
        summary = tree.summary()

        # Maximum betting depth constraint (prevent infinite/exponential depth)
        self.assertLessEqual(
            summary["maximumBettingDepth"],
            6,
            "Maximum betting depth exceeds safe bound of 6",
        )
        # Decision node constraint
        self.assertEqual(summary["decisionNodes"], 16)
        self.assertEqual(summary["terminalNodes"], 30)
        self.assertEqual(summary["publicNodes"], 46)

        # Branching factor constraints (average actions per decision must be bounded)
        self.assertLessEqual(
            summary["averageActionsPerDecision"],
            4.0,
            "Average branching factor per decision node must not exceed 4.0",
        )

        # All decision nodes must have at least 2 actions; terminals must have 0
        for node in tree.decision_nodes:
            self.assertGreaterEqual(len(node.action_ids), 2)
            self.assertLessEqual(len(node.action_ids), 4)
        for node in tree.terminal_nodes:
            self.assertEqual(len(node.action_ids), 0)

    def test_memory_limits_and_infoset_budget(self) -> None:
        """Verify exact preflop infoset footprint and table memory bounds."""
        tree = enumerate_public_tree(self.game)
        estimate = infoset_size_estimate(tree, combo_count=1326)

        # Check total infoset counts across the 1,326 Hold'em combo universe
        self.assertEqual(estimate["totalInfosets"], 16 * 1326)  # 21,216 infosets
        self.assertEqual(estimate["regretEntries"], 45 * 1326)  # 59,670 entries

        # Memory limits for float32 / float64 CFR tables
        float32_bytes = estimate["float32RegretPlusAverageBytes"]
        float64_bytes = estimate["float64RegretPlusAverageBytes"]

        # Assert pilot tree memory is well within < 2 MB budget
        self.assertLess(
            float32_bytes,
            1 * 1024 * 1024,
            f"Float32 tables require {float32_bytes} bytes, exceeding 1MB limit",
        )
        self.assertLess(
            float64_bytes,
            2 * 1024 * 1024,
            f"Float64 tables require {float64_bytes} bytes, exceeding 2MB limit",
        )

    def test_host_memory_headroom_projection(self) -> None:
        """
        Verify host memory safety boundary:
        Project memory requirements under scaled abstractions against a 4GB/16GB solver memory ceiling.
        """
        tree = enumerate_public_tree(self.game)
        # Pilot baseline: 45 action entries per combo * 1326 combos
        baseline_entries = tree.action_entry_count * 1326

        # Suppose a solver memory ceiling of 4GB allocated out of the host's 16GB RAM:
        max_solver_memory_bytes = 4 * 1024 * 1024 * 1024  # 4 GiB
        bytes_per_entry_f32 = 8  # 4 bytes regret + 4 bytes cumulative strategy

        max_allowable_action_entries = max_solver_memory_bytes // bytes_per_entry_f32
        headroom_ratio = max_allowable_action_entries / baseline_entries

        # We must have at least 1000x headroom above the pilot tree on this host
        self.assertGreater(
            headroom_ratio,
            1000.0,
            f"Insufficient headroom ratio: {headroom_ratio:.1f}x",
        )

    def test_tree_construction_memory_leak_and_allocation(self) -> None:
        """Verify that repeated tree construction produces no memory leaks and bounded allocations."""
        gc.collect()
        tracemalloc.start()

        snapshot_start = tracemalloc.take_snapshot()
        for _ in range(30):
            _ = enumerate_public_tree(self.game)
        gc.collect()
        snapshot_end = tracemalloc.take_snapshot()

        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        # Peak memory allocated during 30 tree builds should not exceed 5 MB
        self.assertLess(
            peak,
            5 * 1024 * 1024,
            f"Peak memory allocation during tree builds was {peak / 1024:.1f} KB, exceeding 5MB limit",
        )

        # Net memory growth after GC should be negligible (< 100 KB)
        top_stats = snapshot_end.compare_to(snapshot_start, "lineno")
        net_growth = sum(stat.size_diff for stat in top_stats if stat.size_diff > 0)
        self.assertLess(
            net_growth,
            100 * 1024,
            f"Net memory leak detected: {net_growth / 1024:.1f} KB growth",
        )


if __name__ == "__main__":
    unittest.main()
