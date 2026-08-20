import {
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
  GAME_RULES_DEFINITION_SCHEMA_VERSION,
  GAME_RULES_SNAPSHOT_SOURCE_KINDS,
  NO_RAKE_CASH_GAME_RULES_PRESET,
  createGameRulesSnapshot,
} from './game-rules.js';
import { GAME_MODES } from './schema.js';
import { validateGameConfiguration } from './validate.js';

const LEGACY_GAME_KEYS = Object.freeze([
  'mode',
  'smallBlindMilliBb',
  'bigBlindMilliBb',
  'chipUnitMilliBb',
  'ante',
]);

function requireLegacyGameConfiguration(game) {
  if (!game || typeof game !== 'object' || Array.isArray(game)) {
    throw new TypeError('Legacy game configuration must be an object');
  }
  const actual = Object.keys(game).sort();
  const expected = [...LEGACY_GAME_KEYS].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    throw new RangeError(`Legacy game configuration must contain exactly: ${expected.join(', ')}`);
  }
  if (![GAME_MODES.HOME, GAME_MODES.CLUBGG].includes(game.mode)) {
    throw new RangeError(`Unsupported legacy game mode: ${String(game.mode)}`);
  }
  return game;
}

/**
 * Copy a current PokerState v1 initialization game configuration into an
 * immutable GameRulesSnapshot v1 without changing the legacy runtime path.
 */
export function createGameRulesSnapshotFromLegacyGameConfiguration(game, tableSize) {
  requireLegacyGameConfiguration(game);
  validateGameConfiguration(game, tableSize);

  const preset = game.mode === GAME_MODES.CLUBGG
    ? FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET
    : NO_RAKE_CASH_GAME_RULES_PRESET;

  return createGameRulesSnapshot({
    source: {
      kind: GAME_RULES_SNAPSHOT_SOURCE_KINDS.LEGACY_COMPATIBILITY,
      presetId: preset.id,
      presetRevision: preset.revision,
      legacyMode: game.mode,
    },
    setup: { seatedPlayers: tableSize },
    definition: {
      ...preset.definition,
      schemaVersion: GAME_RULES_DEFINITION_SCHEMA_VERSION,
      blinds: {
        smallBlindMilliBb: game.smallBlindMilliBb,
        bigBlindMilliBb: game.bigBlindMilliBb,
        chipUnitMilliBb: game.chipUnitMilliBb,
      },
      ante: {
        type: game.ante.type,
        amountMilliBb: game.ante.amountMilliBb,
      },
    },
  });
}
