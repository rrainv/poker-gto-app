from __future__ import annotations

import unittest

from riverline_solver.validation.kuhn import KuhnCfrSanityTrainer, expected_value, nash_conv


class KuhnSanityTests(unittest.TestCase):
    def test_independent_kuhn_cfr_converges_toward_known_game_value(self) -> None:
        profile = KuhnCfrSanityTrainer().train(20_000)
        value = expected_value(profile)
        conv, exploitability = nash_conv(profile)
        self.assertAlmostEqual(value, -1 / 18, delta=0.01)
        self.assertLess(exploitability, 0.03)
        self.assertAlmostEqual(conv, exploitability * 2)


if __name__ == "__main__":
    unittest.main()

