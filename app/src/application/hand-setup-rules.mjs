import {
  NO_RAKE_CASH_GAME_RULES_PRESET,
  FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET,
  createGameRulesSnapshot,
  createGameRulesSnapshotFromLegacyGameConfiguration,
} from '../../../shared/poker-domain/index.js';

// Setup choices select existing canonical definitions; legacy names are input aliases only.
export function handSetupRulesDefinition(configuration = {}) {
  const type = configuration.collectionType ?? ({ home: 'none', clubgg: 'fixed_per_seated_player' })[configuration.gameMode ?? 'home'];
  if (type === 'none') return NO_RAKE_CASH_GAME_RULES_PRESET.definition;
  if (type === 'fixed_per_seated_player') return FIXED_PER_SEATED_PLAYER_LEGACY_GAME_RULES_PRESET.definition;
  throw new RangeError('Unsupported Hand collection choice');
}

export function createHandSetupRulesSnapshot(configuration, ante) {
  if (configuration.collectionType == null && configuration.gameMode != null) {
    return createGameRulesSnapshotFromLegacyGameConfiguration({
      mode: configuration.gameMode,
      ...NO_RAKE_CASH_GAME_RULES_PRESET.definition.blinds,
      ante,
    }, configuration.tableSize);
  }
  return createGameRulesSnapshot({
    definition: { ...handSetupRulesDefinition(configuration), ante },
    setup: { seatedPlayers: configuration.tableSize },
    source: { kind: 'direct' },
  });
}
