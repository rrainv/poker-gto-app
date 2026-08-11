from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from riverline_solver.hu_preflop.cards import (
    DECK,
    all_combos,
    combos_by_hand_class,
    deal_private_cards,
    hand_class,
    validate_disjoint_combos,
)
from riverline_solver.hu_preflop.equity import EquityRecord, PreflopEquityCache
from riverline_solver.hu_preflop.evaluator import evaluate_seven


class CardAndEquityTests(unittest.TestCase):
    def test_deck_combo_counts_and_class_multiplicities(self) -> None:
        self.assertEqual(len(DECK), 52)
        self.assertEqual(len(set(DECK)), 52)
        self.assertEqual(len(all_combos()), 1_326)
        classes = combos_by_hand_class()
        self.assertEqual(len(classes), 169)
        self.assertEqual(len(classes["AA"]), 6)
        self.assertEqual(len(classes["AKs"]), 4)
        self.assertEqual(len(classes["AKo"]), 12)

    def test_strict_combo_mapping_and_overlap_rejection(self) -> None:
        self.assertEqual(hand_class(("As", "Ah")), "AA")
        self.assertEqual(hand_class(("As", "Ks")), "AKs")
        self.assertEqual(hand_class(("Kh", "Ac")), "AKo")
        with self.assertRaises(ValueError):
            validate_disjoint_combos(("As", "Kh"), ("As", "Qd"))
        with self.assertRaises(ValueError):
            hand_class(("as", "Kh"))

    def test_seeded_dealing_is_local_reproducible_and_disjoint(self) -> None:
        first = deal_private_cards(0x12345678)
        self.assertEqual(first, deal_private_cards(0x12345678))
        self.assertNotEqual(first, deal_private_cards(0x12345679))
        self.assertEqual(len(set((*first[0], *first[1]))), 4)

    def test_seven_card_evaluator_known_hands(self) -> None:
        straight_flush = evaluate_seven(["As", "Ks", "Qs", "Js", "Ts", "2d", "3c"])
        quads = evaluate_seven(["As", "Ah", "Ad", "Ac", "Ks", "2d", "3c"])
        wheel = evaluate_seven(["As", "2h", "3d", "4c", "5s", "Kd", "Qd"])
        pair = evaluate_seven(["As", "Ah", "Kd", "Qc", "9s", "3d", "2c"])
        self.assertGreater(straight_flush, quads)
        self.assertEqual(wheel, (4, 5))
        self.assertEqual(pair[:2], (1, 14))
        with self.assertRaises(ValueError):
            evaluate_seven(["As"] * 7)

    def test_sparse_equity_cache_is_symmetric_tie_aware_and_persistable(self) -> None:
        first = ("As", "Ah")
        second = ("Ks", "Kh")
        cache = PreflopEquityCache()
        cache.put_record(first, second, EquityRecord(wins_first=7, ties=2, trials=10))
        self.assertAlmostEqual(cache.equity(first, second), 0.8)
        self.assertAlmostEqual(cache.equity(second, first), 0.2)
        self.assertEqual(cache.get_record(second, first), EquityRecord(1, 2, 10))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "equity.json"
            cache.save(path)
            restored = PreflopEquityCache.load(path)
            self.assertAlmostEqual(restored.equity(first, second), 0.8)
        with self.assertRaises(ValueError):
            cache.get_record(("As", "Kh"), ("As", "Qd"))


if __name__ == "__main__":
    unittest.main()

