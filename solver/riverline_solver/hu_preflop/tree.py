"""Deterministic enumeration and size characterization of the public tree."""

from __future__ import annotations

from dataclasses import dataclass

from .game import HuPreflopGame, PublicState


@dataclass(frozen=True, slots=True)
class PublicNode:
    state: PublicState
    action_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PublicTree:
    nodes: tuple[PublicNode, ...]

    @property
    def terminal_nodes(self) -> tuple[PublicNode, ...]:
        return tuple(node for node in self.nodes if node.state.is_terminal)

    @property
    def decision_nodes(self) -> tuple[PublicNode, ...]:
        return tuple(node for node in self.nodes if not node.state.is_terminal)

    @property
    def maximum_depth(self) -> int:
        return max(len(node.state.history) for node in self.nodes)

    @property
    def action_entry_count(self) -> int:
        return sum(len(node.action_ids) for node in self.decision_nodes)

    @property
    def average_action_count(self) -> float:
        decisions = self.decision_nodes
        return self.action_entry_count / len(decisions) if decisions else 0.0

    def summary(self) -> dict[str, int | float | dict[str, int]]:
        distribution: dict[str, int] = {}
        for node in self.decision_nodes:
            key = str(len(node.action_ids))
            distribution[key] = distribution.get(key, 0) + 1
        return {
            "publicNodes": len(self.nodes),
            "terminalNodes": len(self.terminal_nodes),
            "decisionNodes": len(self.decision_nodes),
            "maximumBettingDepth": self.maximum_depth,
            "actionEntries": self.action_entry_count,
            "averageActionsPerDecision": self.average_action_count,
            "actionsPerNodeDistribution": distribution,
        }

    def dump(self) -> str:
        rows = []
        for node in sorted(self.nodes, key=lambda item: (len(item.state.history), item.state.node_id)):
            history = "ROOT" if not node.state.history else " / ".join(
                entry.action.action_id for entry in node.state.history
            )
            actor = "terminal" if node.state.acting_player is None else f"P{node.state.acting_player}"
            actions = ", ".join(node.action_ids) if node.action_ids else node.state.terminal_reason
            rows.append(f"{node.state.node_id} | {history} | {actor} | {actions}")
        return "\n".join(rows)


def enumerate_public_tree(game: HuPreflopGame | None = None) -> PublicTree:
    target = game if game is not None else HuPreflopGame()
    nodes: list[PublicNode] = []
    seen: set[str] = set()

    def visit(state: PublicState) -> None:
        if state.node_id in seen:
            raise ValueError(f"public tree contains a repeated/cyclic node id: {state.node_id}")
        seen.add(state.node_id)
        actions = target.legal_actions(state)
        nodes.append(PublicNode(state, tuple(action.action_id for action in actions)))
        if state.is_terminal:
            return
        if not actions:
            raise ValueError("every nonterminal public state must expose a legal action")
        for action in actions:
            visit(target.apply_action(state, action))

    visit(target.initial_state())
    return PublicTree(tuple(nodes))


def infoset_size_estimate(tree: PublicTree, combo_count: int = 1326) -> dict[str, int | float]:
    if combo_count <= 0:
        raise ValueError("combo_count must be positive")
    btn_nodes = sum(node.state.acting_player == 0 for node in tree.decision_nodes)
    bb_nodes = sum(node.state.acting_player == 1 for node in tree.decision_nodes)
    regret_entries = tree.action_entry_count * combo_count
    infosets = len(tree.decision_nodes) * combo_count
    return {
        "btnInfosets": btn_nodes * combo_count,
        "bbInfosets": bb_nodes * combo_count,
        "totalInfosets": infosets,
        "regretEntries": regret_entries,
        "averageActions": tree.average_action_count,
        "float64OneTableBytes": regret_entries * 8,
        "float32OneTableBytes": regret_entries * 4,
        "float64RegretPlusAverageBytes": regret_entries * 8 * 2,
        "float32RegretPlusAverageBytes": regret_entries * 4 * 2,
    }

