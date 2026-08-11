from __future__ import annotations

import unittest
from dataclasses import replace

from riverline_solver.hu_preflop.actions import AbstractAction, strategy_result_action
from riverline_solver.hu_preflop.equity import FixedEquitySource
from riverline_solver.hu_preflop.game import HuPreflopGame
from riverline_solver.hu_preflop.spec import (
    GAME_SPEC_VERSION,
    STARTING_STACK_MILLI_BB,
    TERMINAL_FOLD,
    TERMINAL_SHOWDOWN_EQUITY,
)
from riverline_solver.hu_preflop.utility import ShowdownEquityLeafValue, terminal_utilities


CARDS = (("As", "Ah"), ("Ks", "Kh"))


class HuPreflopGameTests(unittest.TestCase):
    def setUp(self) -> None:
        self.game = HuPreflopGame()

    def test_exact_initial_game_and_btn_action_order(self) -> None:
        state = self.game.initial_state()
        self.assertEqual(state.game_spec_version, GAME_SPEC_VERSION)
        self.assertEqual(state.acting_player, 0)
        self.assertEqual([player.position for player in state.players], ["BTN", "BB"])
        self.assertEqual([player.stack_milli_bb for player in state.players], [99_500, 99_000])
        self.assertEqual([player.contribution_milli_bb for player in state.players], [500, 1_000])
        self.assertEqual(state.pot_milli_bb, 1_500)
        self.assertEqual(state.current_bet_milli_bb, 1_000)
        self.assertEqual(
            [action.action_id for action in self.game.legal_actions(state)],
            ["fold", "call", "raise_to_2500", "all_in_to_100000"],
        )

    def test_limp_preserves_bb_check_option_and_limp_branch_size(self) -> None:
        state = self.game.replay(["call"])
        self.assertEqual(state.acting_player, 1)
        self.assertEqual(state.pot_milli_bb, 2_000)
        self.assertEqual(
            [action.action_id for action in self.game.legal_actions(state)],
            ["check", "raise_to_4000", "all_in_to_100000"],
        )
        self.assertNotIn("fold", [action.action_id for action in self.game.legal_actions(state)])

    def test_bounded_open_and_limp_raise_trees_use_amount_to(self) -> None:
        fixtures = [
            (["raise_to_2500"], ["fold", "call", "raise_to_8000", "all_in_to_100000"]),
            (["raise_to_2500", "raise_to_8000"], ["fold", "call", "raise_to_20000", "all_in_to_100000"]),
            (["raise_to_2500", "raise_to_8000", "raise_to_20000"], ["fold", "call", "all_in_to_100000"]),
            (["call", "raise_to_4000"], ["fold", "call", "raise_to_12000", "all_in_to_100000"]),
            (["call", "raise_to_4000", "raise_to_12000"], ["fold", "call", "raise_to_30000", "all_in_to_100000"]),
            (["call", "raise_to_4000", "raise_to_12000", "raise_to_30000"], ["fold", "call", "all_in_to_100000"]),
        ]
        for history, expected in fixtures:
            with self.subTest(history=history):
                state = self.game.replay(history)
                self.assertEqual(
                    [action.action_id for action in self.game.legal_actions(state)], expected,
                )
                for action in self.game.legal_actions(state):
                    if action.type in {"raise", "all_in"}:
                        self.assertGreater(action.amount_to_milli_bb, state.current_bet_milli_bb)

    def test_fold_payoff_golden_fixtures(self) -> None:
        leaf = ShowdownEquityLeafValue(FixedEquitySource({(CARDS[0], CARDS[1]): 1.0}))
        fixtures = [
            (["fold"], (-500.0, 500.0)),
            (["raise_to_2500", "fold"], (1_000.0, -1_000.0)),
            (["raise_to_2500", "raise_to_8000", "fold"], (-2_500.0, 2_500.0)),
            (["raise_to_2500", "raise_to_8000", "raise_to_20000", "fold"], (8_000.0, -8_000.0)),
        ]
        for history, expected in fixtures:
            with self.subTest(history=history):
                state = self.game.replay(history)
                self.assertEqual(state.terminal_reason, TERMINAL_FOLD)
                self.assertEqual(state.pot_milli_bb, 0)
                self.assertEqual(terminal_utilities(state, None, leaf), expected)
                self.assertAlmostEqual(sum(expected), 0.0)

    def test_non_all_in_and_called_all_in_close_to_showdown_equity(self) -> None:
        fixtures = [
            (["call", "check"], 2_000),
            (["raise_to_2500", "call"], 5_000),
            (["raise_to_2500", "raise_to_8000", "call"], 16_000),
            (["all_in_to_100000", "call"], 200_000),
        ]
        for history, pot in fixtures:
            with self.subTest(history=history):
                state = self.game.replay(history)
                self.assertEqual(state.terminal_reason, TERMINAL_SHOWDOWN_EQUITY)
                self.assertEqual(state.pot_milli_bb, pot)
                self.assertEqual(self.game.legal_actions(state), ())

    def test_showdown_utility_is_zero_sum_for_win_loss_and_tie(self) -> None:
        state = self.game.replay(["raise_to_2500", "call"])
        for equity, expected in [
            (1.0, (2_500.0, -2_500.0)),
            (0.0, (-2_500.0, 2_500.0)),
            (0.5, (0.0, 0.0)),
        ]:
            with self.subTest(equity=equity):
                leaf = ShowdownEquityLeafValue(FixedEquitySource({(CARDS[0], CARDS[1]): equity}))
                utilities = terminal_utilities(state, CARDS, leaf)
                self.assertEqual(utilities, expected)
                self.assertAlmostEqual(utilities[0], -utilities[1])

    def test_unmatched_called_leaf_accounting_refunds_before_utility(self) -> None:
        # This state is not reachable with equal 100bb stacks, but exercises the
        # leaf boundary needed by a future stack-general adapter.
        state = self.game.initial_state()
        players = (
            replace(state.player(0), stack_milli_bb=97_000, contribution_milli_bb=3_000),
            replace(state.player(1), stack_milli_bb=98_000, contribution_milli_bb=2_000),
        )
        unequal = replace(
            state,
            players=players,
            acting_player=0,
            pot_milli_bb=5_000,
            current_bet_milli_bb=3_000,
            acted_since_aggression=(0, 1),
        )
        closed = self.game._close_to_showdown_equity(unequal)
        self.game.validate_state(closed)
        self.assertEqual(closed.pot_milli_bb, 4_000)
        self.assertEqual(closed.refunds_milli_bb, (1_000, 0))
        self.assertEqual([player.stack_milli_bb for player in closed.players], [98_000, 98_000])
        leaf = ShowdownEquityLeafValue(FixedEquitySource({(CARDS[0], CARDS[1]): 0.5}))
        self.assertEqual(terminal_utilities(closed, CARDS, leaf), (0.0, 0.0))

    def test_illegal_actions_stack_cap_and_terminal_safety(self) -> None:
        state = self.game.initial_state()
        with self.assertRaises(ValueError):
            self.game.apply_action(state, AbstractAction("check"))
        with self.assertRaises(ValueError):
            self.game.apply_action(state, AbstractAction("raise", 1_500))
        with self.assertRaises(ValueError):
            self.game.apply_action(state, AbstractAction("raise", 100_000))
        terminal = self.game.replay(["fold"])
        with self.assertRaises(ValueError):
            self.game.apply_action(terminal, AbstractAction("call"))
        self.assertTrue(all(player.stack_milli_bb >= 0 for player in terminal.players))
        self.assertEqual(
            sum(player.stack_milli_bb for player in terminal.players) + terminal.pot_milli_bb,
            2 * STARTING_STACK_MILLI_BB,
        )

    def test_node_ids_are_structural_and_strategy_result_mapping_preserves_sizes(self) -> None:
        first = self.game.replay(["raise_to_2500", "raise_to_8000"])
        second = self.game.replay(["raise_to_2500", "raise_to_8000"])
        other = self.game.replay(["call", "raise_to_4000"])
        self.assertEqual(first.node_id, second.node_id)
        self.assertNotEqual(first.node_id, other.node_id)
        self.assertEqual(strategy_result_action(AbstractAction("raise", 2_500)), {
            "type": "raise", "amountBb": 2.5, "potFraction": None,
        })
        self.assertEqual(strategy_result_action(AbstractAction("all_in", 100_000)), {
            "type": "all_in", "amountBb": 100.0, "potFraction": None,
        })


if __name__ == "__main__":
    unittest.main()
