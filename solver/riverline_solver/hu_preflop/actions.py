"""Structural solver actions; model indices deliberately do not exist here."""

from __future__ import annotations

from dataclasses import dataclass


ACTION_TYPES = frozenset({"fold", "check", "call", "raise", "all_in"})


@dataclass(frozen=True, slots=True)
class AbstractAction:
    """One legal action in the bounded game.

    ``amount_to_milli_bb`` is a total street contribution target. It is present
    for raise and all-in actions. Calls derive their capped commitment from the
    state, so they intentionally carry no amount.
    """

    type: str
    amount_to_milli_bb: int | None = None

    def __post_init__(self) -> None:
        if self.type not in ACTION_TYPES:
            raise ValueError(f"unsupported action type: {self.type}")
        sized = self.type in {"raise", "all_in"}
        if sized:
            if not isinstance(self.amount_to_milli_bb, int) or self.amount_to_milli_bb <= 0:
                raise ValueError(f"{self.type} requires a positive amount-to")
        elif self.amount_to_milli_bb is not None:
            raise ValueError(f"{self.type} must not carry an amount-to")

    @property
    def action_id(self) -> str:
        if self.type == "raise":
            return f"raise_to_{self.amount_to_milli_bb}"
        if self.type == "all_in":
            return f"all_in_to_{self.amount_to_milli_bb}"
        return self.type

    def as_record(self) -> dict[str, int | str | None]:
        return {
            "type": self.type,
            "amountToMilliBb": self.amount_to_milli_bb,
        }


def action_from_id(action_id: str) -> AbstractAction:
    if action_id in {"fold", "check", "call"}:
        return AbstractAction(action_id)
    if action_id.startswith("raise_to_"):
        return AbstractAction("raise", int(action_id.removeprefix("raise_to_")))
    if action_id.startswith("all_in_to_"):
        return AbstractAction("all_in", int(action_id.removeprefix("all_in_to_")))
    raise ValueError(f"unsupported action id: {action_id}")


def strategy_result_action(action: AbstractAction) -> dict[str, float | str | None]:
    """Future UI adapter target; no StrategyResult is emitted by SOLVER-001."""

    return {
        "type": action.type,
        "amountBb": (
            None
            if action.amount_to_milli_bb is None
            else action.amount_to_milli_bb / 1000
        ),
        "potFraction": None,
    }
