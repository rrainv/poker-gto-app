from __future__ import annotations

import unittest

from riverline_solver.hu_preflop.equity import FixedEquitySource
from riverline_solver.hu_preflop.utility import ShowdownEquityLeafValue
from riverline_solver.hu_preflop.validation import (
    BASELINE_PROFILES,
    ChanceDeal,
    ORDERED_PRIVATE_DEAL_COUNT,
    exact_best_response,
    expected_value,
    exploitability,
)


DEALS = (
    ChanceDeal((("As", "Ah"), ("Ks", "Kh")), 0.5),
    ChanceDeal((("2s", "3s"), ("Ac", "Kd")), 0.5),
)
LEAF = ShowdownEquityLeafValue(FixedEquitySource({
    (("As", "Ah"), ("Ks", "Kh")): 1.0,
    (("2s", "3s"), ("Ac", "Kd")): 0.0,
}))


class ValidationHarnessTests(unittest.TestCase):
    def test_ordered_exact_deal_universe_count_is_explicit(self) -> None:
        self.assertEqual(ORDERED_PRIVATE_DEAL_COUNT, 1_624_350)

    def test_baseline_profile_values_are_deterministic_and_zero_sum(self) -> None:
        fixtures = [
            ("always_fold", "always_call_check", (-500.0, 500.0)),
            ("always_call_check", "always_call_check", (0.0, -0.0)),
            ("first_aggressive", "always_fold", (1_000.0, -1_000.0)),
        ]
        for first, second, expected in fixtures:
            with self.subTest(first=first, second=second):
                value = expected_value(
                    BASELINE_PROFILES[first], BASELINE_PROFILES[second], DEALS, LEAF,
                )
                self.assertEqual(value, expected)
                self.assertAlmostEqual(value[0], -value[1])

    def test_uniform_profile_and_best_responses_are_finite(self) -> None:
        uniform = BASELINE_PROFILES["uniform"]
        value = expected_value(uniform, uniform, DEALS, LEAF)
        self.assertTrue(all(abs(item) <= 100_000 for item in value))
        response_zero = exact_best_response(uniform, 0, DEALS, LEAF)
        response_one = exact_best_response(uniform, 1, DEALS, LEAF)
        self.assertGreaterEqual(response_zero.utility_milli_bb + 1e-9, value[0])
        self.assertGreaterEqual(response_one.utility_milli_bb + 1e-9, value[1])
        self.assertTrue(response_zero.profile.choices)
        self.assertTrue(response_one.profile.choices)

    def test_exploitability_metric_is_nonnegative_and_consistent(self) -> None:
        result = exploitability(
            BASELINE_PROFILES["always_call_check"],
            BASELINE_PROFILES["always_call_check"],
            DEALS,
            LEAF,
        )
        self.assertGreaterEqual(result.nash_conv_milli_bb, 0)
        self.assertAlmostEqual(
            result.exploitability_milli_bb,
            result.nash_conv_milli_bb / 2,
        )
        self.assertAlmostEqual(sum(result.profile_value_milli_bb), 0.0)


if __name__ == "__main__":
    unittest.main()

