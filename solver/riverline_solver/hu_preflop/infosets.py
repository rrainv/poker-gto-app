"""Stable exact-combo information-set identities."""

from __future__ import annotations

import json

from .cards import canonical_combo
from .game import HuPreflopGame, PublicState
from .spec import INFOSET_SCHEMA_VERSION, PLAYER_IDS


def infoset_key(state: PublicState, player: int, private_combo: tuple[str, str]) -> str:
    HuPreflopGame().validate_state(state)
    if state.is_terminal or state.acting_player != player:
        raise ValueError("an infoset key requires that player's current decision node")
    if player not in {0, 1}:
        raise ValueError("player must be 0 or 1")
    cards = canonical_combo(private_combo)
    payload = {
        "schemaVersion": INFOSET_SCHEMA_VERSION,
        "playerId": PLAYER_IDS[player],
        "privateCards": list(cards),
        "publicNodeId": state.node_id,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def parse_infoset_key(key: str) -> dict[str, object]:
    payload = json.loads(key)
    if payload.get("schemaVersion") != INFOSET_SCHEMA_VERSION:
        raise ValueError("infoset version mismatch")
    expected = {"schemaVersion", "playerId", "privateCards", "publicNodeId"}
    if set(payload) != expected:
        raise ValueError("infoset key has unexpected fields")
    canonical_combo(payload["privateCards"])
    if payload["playerId"] not in PLAYER_IDS:
        raise ValueError("infoset player is invalid")
    if not isinstance(payload["publicNodeId"], str):
        raise ValueError("infoset public node id is invalid")
    return payload

