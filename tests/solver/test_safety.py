from __future__ import annotations

import unittest
from pathlib import Path
import re


PACKAGE_ROOT = Path(__file__).parents[2] / "solver" / "riverline_solver"


class SolverIsolationTests(unittest.TestCase):
    def test_solver_package_has_no_runtime_ml_ui_or_legacy_solver_dependency(self) -> None:
        source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in PACKAGE_ROOT.rglob("*.py")
        ).lower()
        for forbidden in (
            "import torch",
            "import onnx",
            "from training",
            "from solver-model",
            "app.src",
            "clubgg",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)
        self.assertIsNone(re.search(r"\brake\s*(?:=|:)|\.rake\b", source))

    def test_solver_package_contains_no_gto_or_deep_cfr_provenance_claim(self) -> None:
        source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in PACKAGE_ROOT.rglob("*.py")
        )
        self.assertNotIn("Deep CFR", source)
        self.assertNotIn("solved GTO", source)


if __name__ == "__main__":
    unittest.main()
