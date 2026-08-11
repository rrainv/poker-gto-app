export const TRAINING_PRESENTATION_SCHEMA_VERSION = 'training-presentation/v1';

const ACTION_ORDER = Object.freeze(['fold', 'check', 'call', 'bet', 'raise', 'all_in']);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function bbLabel(milliBb) {
  if (!Number.isSafeInteger(milliBb) || milliBb < 0) return null;
  return `${Number((milliBb / 1000).toFixed(3))}bb`;
}

function words(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function playerLabel(player, heroPlayerId) {
  if (player?.playerId === heroPlayerId) return 'Hero';
  return player?.position || player?.playerId || 'Unknown player';
}

function historyActionLabel(type) {
  return {
    fold: 'Fold',
    check: 'Check',
    call: 'Call',
    bet: 'Bet to',
    raise: 'Raise to',
    all_in: 'All-in to',
  }[type] || words(type);
}

function historyAmountLabel(record) {
  const type = record?.submittedAction?.type;
  if (type === 'fold' || type === 'check') return null;
  if (type === 'call') return bbLabel(record.committedMilliBb);
  return bbLabel(record?.submittedAction?.amountToMilliBb ?? record?.currentBetAfterMilliBb);
}

function legalActionPresentation(type, legalActions) {
  const source = type === 'all_in' ? legalActions?.allIn : legalActions?.[type];
  if (!source?.available) return null;
  const base = {
    type,
    label: type === 'all_in' ? 'All-in' : words(type),
    amountLabel: null,
    boundsLabel: null,
  };
  if (type === 'call') base.amountLabel = bbLabel(source.commitMilliBb);
  if (type === 'all_in') base.amountLabel = bbLabel(source.amountToMilliBb);
  if (type === 'bet' || type === 'raise') {
    const minimum = bbLabel(source.minToMilliBb);
    const maximum = bbLabel(source.maxToMilliBb);
    if (minimum && maximum) base.boundsLabel = `${minimum.replace('bb', '')}–${maximum} to`;
  }
  return base;
}

function curriculumTags(exercise) {
  const context = exercise.decisionContext;
  const curriculum = exercise.generationMetadata?.curriculum || {};
  const targetLabels = {
    preflop_unopened: 'UNOPENED',
    preflop_facing_open: 'FACING OPEN',
    preflop_facing_3bet: 'FACING 3-BET',
    preflop_facing_4bet: 'FACING 4-BET',
    preflop_bb_option: 'CHECK OPTION',
    postflop_first_action: 'FIRST ACTION',
    postflop_facing_bet: 'FACING BET',
    postflop_facing_raise: 'FACING RAISE',
  };
  const facing = targetLabels[exercise.generationMetadata?.targetReason]
    || (context.facingSizeBb > 0
      ? `FACING ${String(context.lastAction || 'ACTION').replaceAll('_', ' ').toUpperCase()}`
      : context.street === 'preflop' && context.heroPosition === 'BB'
        ? 'CHECK OPTION'
        : context.street === 'preflop' ? 'UNOPENED' : 'FIRST ACTION');
  return [
    String(context.street || '').toUpperCase(),
    context.heroPosition,
    `${context.tableSize}-MAX`,
    facing,
    curriculum.stackBucket ? `${String(curriculum.stackBucket).toUpperCase()} STACK` : null,
  ].filter(Boolean);
}

export function createTrainingPresentationModel(exercise) {
  if (exercise?.schemaVersion !== 'training-exercise/v1') {
    throw new TypeError('Expected TrainingExercise v1');
  }
  const context = exercise.decisionContext;
  const state = exercise.pokerState;
  if (!context || !state || !Array.isArray(state.players) || !Array.isArray(state.actionHistory)) {
    throw new TypeError('TrainingExercise v1 is missing canonical presentation facts');
  }
  const playersById = new Map(state.players.map((player) => [player.playerId, player]));
  const actionHistory = [...state.actionHistory]
    .sort((left, right) => left.sequence - right.sequence)
    .map((record) => ({
      sequence: record.sequence,
      street: record.street,
      actorLabel: playerLabel(playersById.get(record.playerId), exercise.heroPlayerId),
      position: playersById.get(record.playerId)?.position || null,
      actionType: record.submittedAction?.type || 'unknown',
      actionLabel: historyActionLabel(record.submittedAction?.type),
      amountLabel: historyAmountLabel(record),
      isHero: record.playerId === exercise.heroPlayerId,
    }));
  const actor = playersById.get(state.actingPlayerId);
  const metadata = exercise.generationMetadata || {};

  return deepFreeze({
    schemaVersion: TRAINING_PRESENTATION_SCHEMA_VERSION,
    exerciseId: exercise.id,
    seed: exercise.seed,
    heroCards: [...context.heroCards],
    board: [...context.board],
    tags: curriculumTags(exercise),
    currentActor: {
      playerId: state.actingPlayerId,
      label: playerLabel(actor, exercise.heroPlayerId),
      position: actor?.position || null,
    },
    legalActions: ACTION_ORDER
      .map((type) => legalActionPresentation(type, exercise.legalActions))
      .filter(Boolean),
    actionHistory,
    metadata: {
      attempts: Number.isInteger(metadata.attempts) ? metadata.attempts : null,
      trajectoryLength: Number.isInteger(metadata.trajectoryLength) ? metadata.trajectoryLength : null,
      targetReason: metadata.targetReason || null,
      policy: metadata.policy || null,
      curriculum: metadata.curriculum ? structuredClone(metadata.curriculum) : null,
    },
  });
}
