"""Pure public betting engine for the bounded heads-up preflop game."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, replace

from .actions import AbstractAction
from .spec import (
    BIG_BLIND_MILLI_BB,
    CHIP_UNIT_MILLI_BB,
    GAME_SPEC_VERSION,
    PLAYER_IDS,
    POSITIONS,
    PUBLIC_STATE_SCHEMA_VERSION,
    RAISE_TO_BY_BRANCH_AND_AGGRESSION,
    SMALL_BLIND_MILLI_BB,
    STARTING_STACK_MILLI_BB,
    TERMINAL_FOLD,
    TERMINAL_SHOWDOWN_EQUITY,
)


@dataclass(frozen=True, slots=True)
class PublicPlayerState:
    player_id: str
    position: str
    starting_stack_milli_bb: int
    stack_milli_bb: int
    contribution_milli_bb: int
    folded: bool = False


@dataclass(frozen=True, slots=True)
class HistoryEntry:
    sequence: int
    player_id: str
    action: AbstractAction
    committed_milli_bb: int

    def structural_record(self) -> dict[str, object]:
        return {
            "sequence": self.sequence,
            "playerId": self.player_id,
            "action": self.action.as_record(),
            "committedMilliBb": self.committed_milli_bb,
        }


@dataclass(frozen=True, slots=True)
class PublicState:
    schema_version: str
    game_spec_version: str
    players: tuple[PublicPlayerState, PublicPlayerState]
    acting_player: int | None
    pot_milli_bb: int
    current_bet_milli_bb: int
    last_full_raise_increment_milli_bb: int
    aggression_count: int
    branch: str | None
    acted_since_aggression: tuple[int, ...]
    history: tuple[HistoryEntry, ...]
    terminal_reason: str | None = None
    winner: int | None = None
    refunds_milli_bb: tuple[int, int] = (0, 0)

    @property
    def is_terminal(self) -> bool:
        return self.terminal_reason is not None

    @property
    def node_id(self) -> str:
        payload = [entry.structural_record() for entry in self.history]
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return f"hp100-v1:{hashlib.sha256(encoded).hexdigest()[:20]}"

    def player(self, index: int) -> PublicPlayerState:
        return self.players[index]


class HuPreflopGame:
    """Finite public game; private cards enter only utility and infoset calls."""

    spec_version = GAME_SPEC_VERSION

    def initial_state(self) -> PublicState:
        players = (
            PublicPlayerState(
                PLAYER_IDS[0], POSITIONS[0], STARTING_STACK_MILLI_BB,
                STARTING_STACK_MILLI_BB - SMALL_BLIND_MILLI_BB,
                SMALL_BLIND_MILLI_BB,
            ),
            PublicPlayerState(
                PLAYER_IDS[1], POSITIONS[1], STARTING_STACK_MILLI_BB,
                STARTING_STACK_MILLI_BB - BIG_BLIND_MILLI_BB,
                BIG_BLIND_MILLI_BB,
            ),
        )
        state = PublicState(
            schema_version=PUBLIC_STATE_SCHEMA_VERSION,
            game_spec_version=GAME_SPEC_VERSION,
            players=players,
            acting_player=0,
            pot_milli_bb=SMALL_BLIND_MILLI_BB + BIG_BLIND_MILLI_BB,
            current_bet_milli_bb=BIG_BLIND_MILLI_BB,
            last_full_raise_increment_milli_bb=BIG_BLIND_MILLI_BB,
            aggression_count=0,
            branch=None,
            acted_since_aggression=(),
            history=(),
        )
        self.validate_state(state)
        return state

    def current_player(self, state: PublicState) -> int | None:
        self.validate_state(state)
        return state.acting_player

    def is_terminal(self, state: PublicState) -> bool:
        self.validate_state(state)
        return state.is_terminal

    @staticmethod
    def amount_to_call(state: PublicState, player_index: int) -> int:
        return max(0, state.current_bet_milli_bb - state.player(player_index).contribution_milli_bb)

    @staticmethod
    def maximum_amount_to(state: PublicState, player_index: int) -> int:
        player = state.player(player_index)
        return player.contribution_milli_bb + player.stack_milli_bb

    def minimum_raise_to(self, state: PublicState) -> int:
        return state.current_bet_milli_bb + state.last_full_raise_increment_milli_bb

    @staticmethod
    def _opponent_can_respond(state: PublicState, actor: int) -> bool:
        opponent = state.player(1 - actor)
        return not opponent.folded and opponent.stack_milli_bb > 0

    def _configured_raise_to(self, state: PublicState) -> int | None:
        if state.aggression_count >= 3:
            return None
        if state.aggression_count == 0:
            branch = "limp" if state.history else "open"
        else:
            branch = state.branch
        if branch not in RAISE_TO_BY_BRANCH_AND_AGGRESSION:
            return None
        return RAISE_TO_BY_BRANCH_AND_AGGRESSION[branch][state.aggression_count]

    def legal_actions(self, state: PublicState) -> tuple[AbstractAction, ...]:
        self.validate_state(state)
        if state.is_terminal:
            return ()
        actor = state.acting_player
        assert actor is not None
        player = state.player(actor)
        to_call = self.amount_to_call(state, actor)
        maximum_to = self.maximum_amount_to(state, actor)
        actions: list[AbstractAction] = []

        if to_call > 0:
            actions.extend((AbstractAction("fold"), AbstractAction("call")))
        else:
            actions.append(AbstractAction("check"))

        can_aggress = (
            self._opponent_can_respond(state, actor)
            and maximum_to > state.current_bet_milli_bb
        )
        if can_aggress:
            configured_to = self._configured_raise_to(state)
            minimum_to = self.minimum_raise_to(state)
            maximum_non_all_in_to = maximum_to - CHIP_UNIT_MILLI_BB
            # Abstraction sizes that are not naturally legal are omitted. They
            # are never rounded, clamped, or turned into a different bucket.
            if configured_to is not None and minimum_to <= configured_to <= maximum_non_all_in_to:
                actions.append(AbstractAction("raise", configured_to))
            actions.append(AbstractAction("all_in", maximum_to))
        return tuple(actions)

    @staticmethod
    def _replace_player(
        players: tuple[PublicPlayerState, PublicPlayerState],
        index: int,
        player: PublicPlayerState,
    ) -> tuple[PublicPlayerState, PublicPlayerState]:
        values = list(players)
        values[index] = player
        return values[0], values[1]

    @staticmethod
    def _settle_fold(state: PublicState, winner: int) -> PublicState:
        loser = 1 - winner
        winner_player = state.player(winner)
        loser_player = state.player(loser)
        unmatched = max(
            0,
            winner_player.contribution_milli_bb - loser_player.contribution_milli_bb,
        )
        contestable = state.pot_milli_bb - unmatched
        settled_winner = replace(
            winner_player,
            stack_milli_bb=winner_player.stack_milli_bb + unmatched + contestable,
        )
        players = HuPreflopGame._replace_player(state.players, winner, settled_winner)
        refunds = [0, 0]
        refunds[winner] = unmatched
        return replace(
            state,
            players=players,
            acting_player=None,
            pot_milli_bb=0,
            terminal_reason=TERMINAL_FOLD,
            winner=winner,
            refunds_milli_bb=(refunds[0], refunds[1]),
        )

    @staticmethod
    def _close_to_showdown_equity(state: PublicState) -> PublicState:
        first, second = state.players
        if first.contribution_milli_bb == second.contribution_milli_bb:
            return replace(
                state,
                acting_player=None,
                terminal_reason=TERMINAL_SHOWDOWN_EQUITY,
            )
        high = 0 if first.contribution_milli_bb > second.contribution_milli_bb else 1
        low = 1 - high
        excess = state.player(high).contribution_milli_bb - state.player(low).contribution_milli_bb
        refunded = replace(
            state.player(high),
            stack_milli_bb=state.player(high).stack_milli_bb + excess,
        )
        players = HuPreflopGame._replace_player(state.players, high, refunded)
        refunds = [0, 0]
        refunds[high] = excess
        return replace(
            state,
            players=players,
            acting_player=None,
            pot_milli_bb=state.pot_milli_bb - excess,
            terminal_reason=TERMINAL_SHOWDOWN_EQUITY,
            refunds_milli_bb=(refunds[0], refunds[1]),
        )

    def apply_action(self, state: PublicState, action: AbstractAction) -> PublicState:
        self.validate_state(state)
        if action not in self.legal_actions(state):
            raise ValueError(f"illegal action {action.action_id} at {state.node_id}")
        actor = state.acting_player
        assert actor is not None
        player = state.player(actor)
        committed = 0
        next_player = player
        current_bet = state.current_bet_milli_bb
        last_increment = state.last_full_raise_increment_milli_bb
        aggression_count = state.aggression_count
        branch = state.branch
        acted = state.acted_since_aggression

        if action.type == "fold":
            next_player = replace(player, folded=True)
        elif action.type == "call":
            committed = min(self.amount_to_call(state, actor), player.stack_milli_bb)
            next_player = replace(
                player,
                stack_milli_bb=player.stack_milli_bb - committed,
                contribution_milli_bb=player.contribution_milli_bb + committed,
            )
            acted = tuple(dict.fromkeys((*acted, actor)))
        elif action.type == "check":
            acted = tuple(dict.fromkeys((*acted, actor)))
        else:
            assert action.amount_to_milli_bb is not None
            committed = action.amount_to_milli_bb - player.contribution_milli_bb
            next_player = replace(
                player,
                stack_milli_bb=player.stack_milli_bb - committed,
                contribution_milli_bb=action.amount_to_milli_bb,
            )
            raise_increment = action.amount_to_milli_bb - current_bet
            if raise_increment >= last_increment:
                last_increment = raise_increment
            current_bet = action.amount_to_milli_bb
            if aggression_count == 0:
                branch = "limp" if state.history else "open"
            aggression_count += 1
            acted = (actor,)

        players = self._replace_player(state.players, actor, next_player)
        entry = HistoryEntry(len(state.history), player.player_id, action, committed)
        next_state = replace(
            state,
            players=players,
            acting_player=1 - actor,
            pot_milli_bb=state.pot_milli_bb + committed,
            current_bet_milli_bb=current_bet,
            last_full_raise_increment_milli_bb=last_increment,
            aggression_count=aggression_count,
            branch=branch,
            acted_since_aggression=acted,
            history=(*state.history, entry),
        )

        if action.type == "fold":
            next_state = self._settle_fold(next_state, 1 - actor)
        elif action.type in {"call", "check"}:
            contributions = tuple(p.contribution_milli_bb for p in next_state.players)
            if len(acted) == 2 and (
                contributions[0] == contributions[1]
                or next_state.player(actor).stack_milli_bb == 0
            ):
                next_state = self._close_to_showdown_equity(next_state)

        self.validate_state(next_state)
        return next_state

    def replay(self, action_ids: list[str] | tuple[str, ...]) -> PublicState:
        from .actions import action_from_id

        state = self.initial_state()
        for action_id in action_ids:
            state = self.apply_action(state, action_from_id(action_id))
        return state

    def validate_state(self, state: PublicState) -> PublicState:
        if not isinstance(state, PublicState):
            raise TypeError("state must be a PublicState")
        if state.schema_version != PUBLIC_STATE_SCHEMA_VERSION or state.game_spec_version != GAME_SPEC_VERSION:
            raise ValueError("state schema/game version mismatch")
        if len(state.players) != 2:
            raise ValueError("the v1 game requires exactly two players")
        if state.acting_player not in {None, 0, 1}:
            raise ValueError("acting_player must be 0, 1, or None")
        if state.is_terminal != (state.acting_player is None):
            raise ValueError("terminal states have no actor and nonterminals require one")
        if state.pot_milli_bb < 0 or state.current_bet_milli_bb < 0:
            raise ValueError("pot and current bet must be nonnegative")
        if any(value % CHIP_UNIT_MILLI_BB for value in (
            state.pot_milli_bb,
            state.current_bet_milli_bb,
            state.last_full_raise_increment_milli_bb,
            *state.refunds_milli_bb,
        )):
            raise ValueError("all accounting must align to the 100 milliBb chip unit")
        for index, player in enumerate(state.players):
            if player.player_id != PLAYER_IDS[index] or player.position != POSITIONS[index]:
                raise ValueError("player identity and position are fixed by the game")
            if player.starting_stack_milli_bb != STARTING_STACK_MILLI_BB:
                raise ValueError("each player starts with exactly 100bb before blinds")
            if player.stack_milli_bb < 0 or player.contribution_milli_bb < 0:
                raise ValueError("stack and contribution cannot be negative")
            if (player.stack_milli_bb % CHIP_UNIT_MILLI_BB
                    or player.contribution_milli_bb % CHIP_UNIT_MILLI_BB):
                raise ValueError("player accounting must align to the chip unit")
        for index, entry in enumerate(state.history):
            if entry.sequence != index or entry.player_id != PLAYER_IDS[index % 2]:
                raise ValueError("history must be contiguous and follow heads-up action order")
            if entry.committed_milli_bb < 0 or entry.committed_milli_bb % CHIP_UNIT_MILLI_BB:
                raise ValueError("history commitments must be nonnegative aligned integers")
        if state.acting_player is not None and state.acting_player != len(state.history) % 2:
            raise ValueError("actor must follow the deterministic heads-up action order")
        if any(index not in {0, 1} for index in state.acted_since_aggression):
            raise ValueError("acted_since_aggression contains an invalid player")
        aggressive_history = sum(
            entry.action.type in {"raise", "all_in"} for entry in state.history
        )
        if state.aggression_count != aggressive_history:
            raise ValueError("aggression_count must be derived from structural history")
        total_stacks = sum(player.stack_milli_bb for player in state.players)
        if total_stacks + state.pot_milli_bb != 2 * STARTING_STACK_MILLI_BB:
            raise ValueError("chips must be conserved across live stacks and unsettled pot")
        if state.terminal_reason not in {None, TERMINAL_FOLD, TERMINAL_SHOWDOWN_EQUITY}:
            raise ValueError("unsupported terminal reason")
        if state.terminal_reason == TERMINAL_FOLD and state.pot_milli_bb != 0:
            raise ValueError("fold settlement must consume the public pot")
        if state.terminal_reason == TERMINAL_SHOWDOWN_EQUITY and state.pot_milli_bb <= 0:
            raise ValueError("showdown-equity leaves require a contestable pot")
        if state.terminal_reason != TERMINAL_FOLD:
            if state.pot_milli_bb != (
                sum(player.contribution_milli_bb for player in state.players)
                - sum(state.refunds_milli_bb)
            ):
                raise ValueError("unsettled pot must equal gross contributions less refunds")
            for index, player in enumerate(state.players):
                if (player.stack_milli_bb + player.contribution_milli_bb
                        - state.refunds_milli_bb[index] != STARTING_STACK_MILLI_BB):
                    raise ValueError("player stack, gross contribution, and refund must reconcile")
            if state.current_bet_milli_bb != max(
                player.contribution_milli_bb for player in state.players
            ):
                raise ValueError("current bet must equal the greatest gross contribution")
        if state.terminal_reason is None and any(player.folded for player in state.players):
            raise ValueError("fold immediately terminates the heads-up game")
        if state.terminal_reason != TERMINAL_FOLD and state.winner is not None:
            raise ValueError("only fold terminals have a public winner")
        if state.terminal_reason == TERMINAL_FOLD:
            if state.winner not in {0, 1} or not state.player(1 - state.winner).folded:
                raise ValueError("fold terminal must identify one winner and one folded player")
        return state

    def snapshot(self, state: PublicState) -> dict[str, object]:
        self.validate_state(state)
        return {
            "nodeId": state.node_id,
            "actor": None if state.acting_player is None else PLAYER_IDS[state.acting_player],
            "potMilliBb": state.pot_milli_bb,
            "stacksMilliBb": [player.stack_milli_bb for player in state.players],
            "contributionsMilliBb": [player.contribution_milli_bb for player in state.players],
            "currentBetMilliBb": state.current_bet_milli_bb,
            "legalActionIds": [action.action_id for action in self.legal_actions(state)],
            "terminal": state.is_terminal,
            "terminalReason": state.terminal_reason,
            "winner": None if state.winner is None else PLAYER_IDS[state.winner],
            "refundsMilliBb": list(state.refunds_milli_bb),
        }
