import json
import pathlib
import sys


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "backend_logic"))

from evaluator import evaluate_hand  # noqa: E402


def main():
    hands = json.load(sys.stdin)
    results = []
    for cards in hands:
        try:
            category, tiebreakers = evaluate_hand(cards)
            results.append({
                "category": category,
                "tiebreakers": tiebreakers,
                "error": None,
            })
        except Exception as exc:  # The adapter must expose, not hide, implementation errors.
            results.append({
                "category": None,
                "tiebreakers": None,
                "error": f"{type(exc).__name__}: {exc}",
            })
    json.dump(results, sys.stdout)


if __name__ == "__main__":
    main()
