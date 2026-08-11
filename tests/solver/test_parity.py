from __future__ import annotations

import json
import unittest
from pathlib import Path

from riverline_solver.hu_preflop.game import HuPreflopGame
from riverline_solver.hu_preflop.spec import TERMINAL_FOLD, TERMINAL_SHOWDOWN_EQUITY


FIXTURE_PATH = Path(__file__).parents[2] / "solver" / "fixtures" / "hu_preflop_parity_v1.json"


def solver_action_id(action: dict[str, object]) -> str:
    action_type = action["type"]
    if action_type == "raise":
        return f"raise_to_{action['amountToMilliBb']}"
    if action_type == "all_in":
        return "all_in_to_100000"
    return str(action_type)


class CanonicalParityTests(unittest.TestCase):
    def test_neutral_fixtures_match_python_betting_and_fold_settlement(self) -> None:
        fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
        self.assertEqual(
            fixtures["schemaVersion"],
            "riverline-hu-preflop-parity-fixtures/v1",
        )
        game = HuPreflopGame()
        for fixture in fixtures["cases"]:
            with self.subTest(case=fixture["name"]):
                state = game.replay([
                    solver_action_id(action) for action in fixture["actions"]
                ])
                common = {
                    "actor": None if state.acting_player is None else f"P{state.acting_player}",
                    "potMilliBb": state.pot_milli_bb,
                    "stacksMilliBb": [player.stack_milli_bb for player in state.players],
                    "contributionsMilliBb": [
                        player.contribution_milli_bb for player in state.players
                    ],
                    "currentBetMilliBb": state.current_bet_milli_bb,
                    "boundaryStatus": (
                        "fold_terminal" if state.terminal_reason == TERMINAL_FOLD
                        else "preflop_closed"
                        if state.terminal_reason == TERMINAL_SHOWDOWN_EQUITY
                        else "decision"
                    ),
                }
                legal_families = list(dict.fromkeys(
                    action.type for action in game.legal_actions(state)
                ))
                implementation = {
                    "terminal": state.is_terminal,
                    "terminalReason": state.terminal_reason,
                    "legalFamilies": legal_families,
                    "nodeId": state.node_id,
                }
                self.assertEqual(common, fixture["expectedCommon"])
                self.assertEqual(implementation, fixture["expectedSolver"])


if __name__ == "__main__":
    unittest.main()

