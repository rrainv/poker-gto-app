import {
  ACTION_TYPES,
  PREFLOP_HAND_CLASSES,
  isPreflopHandClass,
} from '../../../shared/poker-domain/index.js';
import {
  DIRECT_EVIDENCE_SOURCES,
  RANGE_OBSERVATION_STATES,
  calibrationContextKey,
  createRangeObservation,
  validateCalibrationContext,
} from '../personal-strategy/index.mjs';

export const RANGE_BUILDER_SERVICE_SCHEMA_VERSION = 'personal-strategy-range-builder/v1';

export const RANGE_BUILDER_OPERATION_KINDS = Object.freeze({
  DOMINANT_FOLD: 'dominant_fold',
  DOMINANT_RAISE: 'dominant_raise',
  PURE_FOLD: 'pure_fold',
  PURE_RAISE: 'pure_raise',
  EXACT_MIX: 'exact_mix',
  CLEAR_BUILDER_EDIT: 'clear_builder_edit',
});

const HAND_INDEX = new Map(PREFLOP_HAND_CLASSES.map((handClass, index) => [handClass, index]));

function cloneData(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function timestampFrom(clock, floor = null) {
  const supplied = clock();
  const date = supplied instanceof Date ? supplied : new Date(supplied);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Range Builder clock returned an invalid date');
  const timestamp = date.toISOString();
  return floor !== null && Date.parse(timestamp) < Date.parse(floor) ? floor : timestamp;
}

function validateScope(scope) {
  if (typeof scope?.profileId !== 'string' || !scope.profileId.trim()) {
    throw new TypeError('Range Builder profileId is required');
  }
  if (typeof scope.modeId !== 'string' || !scope.modeId.trim()) {
    throw new TypeError('Range Builder modeId is required');
  }
  validateCalibrationContext(scope.context);
  return scope;
}

function canonicalHands(handClasses, { allowEmpty = false } = {}) {
  if (!Array.isArray(handClasses) || (!allowEmpty && handClasses.length === 0)) {
    throw new RangeError('Range Builder requires at least one selected hand');
  }
  if (handClasses.some((handClass) => !isPreflopHandClass(handClass))) {
    throw new RangeError('Range Builder selection must use canonical preflop hand classes');
  }
  return [...new Set(handClasses)].sort((left, right) => HAND_INDEX.get(left) - HAND_INDEX.get(right));
}

function exactMix({ fold, raise } = {}) {
  const values = [Number(fold), Number(raise)];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    throw new RangeError('Fold and Raise frequencies must each be from 0 through 100');
  }
  if (Math.abs(values[0] + values[1] - 100) > 1e-9) {
    throw new RangeError('Fold and Raise frequencies must total 100%');
  }
  return {
    dominantAction: values[0] === values[1]
      ? null
      : { type: values[0] > values[1] ? ACTION_TYPES.FOLD : ACTION_TYPES.RAISE },
    frequencies: [
      { action: { type: ACTION_TYPES.FOLD }, probability: values[0] },
      { action: { type: ACTION_TYPES.RAISE }, probability: values[1] },
    ],
  };
}

function strategyForOperation(operationKind, mix) {
  if (operationKind === RANGE_BUILDER_OPERATION_KINDS.DOMINANT_FOLD) {
    return { dominantAction: { type: ACTION_TYPES.FOLD }, frequencies: null };
  }
  if (operationKind === RANGE_BUILDER_OPERATION_KINDS.DOMINANT_RAISE) {
    return { dominantAction: { type: ACTION_TYPES.RAISE }, frequencies: null };
  }
  if (operationKind === RANGE_BUILDER_OPERATION_KINDS.PURE_FOLD) {
    return exactMix({ fold: 100, raise: 0 });
  }
  if (operationKind === RANGE_BUILDER_OPERATION_KINDS.PURE_RAISE) {
    return exactMix({ fold: 0, raise: 100 });
  }
  if (operationKind === RANGE_BUILDER_OPERATION_KINDS.EXACT_MIX) return exactMix(mix);
  if (operationKind === RANGE_BUILDER_OPERATION_KINDS.CLEAR_BUILDER_EDIT) return null;
  throw new RangeError(`Unsupported Range Builder operation: ${operationKind}`);
}

function restoreStrategy(previous) {
  if (!previous || previous.state === RANGE_OBSERVATION_STATES.RETRACTED) {
    return { state: RANGE_OBSERVATION_STATES.RETRACTED, dominantAction: null, frequencies: null };
  }
  return {
    state: RANGE_OBSERVATION_STATES.ACTIVE,
    dominantAction: previous.dominantAction,
    frequencies: previous.frequencies,
  };
}

function sourceSummary(matrixProjection, handClasses) {
  const cells = new Map(matrixProjection.cells.map((cell) => [cell.handClass, cell]));
  const summary = { direct: 0, inferred: 0, uncertain: 0, conflicting: 0, unknown: 0 };
  handClasses.forEach((handClass) => {
    const status = cells.get(handClass)?.status;
    if (status === 'directly_known') summary.direct += 1;
    else if (status === 'inferred_high' || status === 'inferred_medium' || status === 'transferred') {
      summary.inferred += 1;
    }
    else if (status === 'uncertain') summary.uncertain += 1;
    else if (status === 'conflicting') summary.conflicting += 1;
    else summary.unknown += 1;
  });
  return summary;
}

export function getRangeBuilderSelectionSummary(matrixProjection, handClasses = []) {
  if (!matrixProjection?.cells) throw new TypeError('Range Builder summary requires a Matrix projection');
  const selected = canonicalHands(handClasses, { allowEmpty: true });
  return deepFreeze({
    schemaVersion: 'range-builder-selection-summary/v1',
    selectedCount: selected.length,
    ...sourceSummary(matrixProjection, selected),
  });
}

export function createRangeBuilderPreview(matrixProjection, handClasses, operationKind, mix = null) {
  const selected = canonicalHands(handClasses);
  const strategy = strategyForOperation(operationKind, mix);
  return deepFreeze({
    schemaVersion: 'range-builder-preview/v1',
    selectedHandClasses: selected,
    operationKind,
    strategy: cloneData(strategy),
    evidenceWrites: 0,
    matrixFingerprint: matrixProjection?.evidenceRevision?.fingerprint
      ?? matrixProjection?.source?.evidenceFingerprint
      ?? null,
  });
}

export function createPersonalStrategyRangeBuilder({
  repository,
  projectionService,
  clock = () => new Date(),
  idFactory,
  onCommitted = null,
} = {}) {
  if (!repository?.saveRangeObservationBatch
    || !repository?.loadRangeHeadsScope
    || !repository?.loadEvidenceScope) {
    throw new TypeError('Range Builder requires the canonical Personal Strategy repository');
  }
  if (!projectionService?.getProjectionBundle || !projectionService?.invalidateScope) {
    throw new TypeError('Range Builder requires the canonical projection service');
  }
  if (typeof idFactory !== 'function') throw new TypeError('Range Builder idFactory is required');
  if (onCommitted !== null && typeof onCommitted !== 'function') {
    throw new TypeError('Range Builder onCommitted must be a function');
  }

  async function commit(scope, observations) {
    const metadata = await repository.saveRangeObservationBatch(observations);
    projectionService.invalidateScope(scope);
    if (onCommitted) await onCommitted(observations);
    const projectionBundle = await projectionService.getProjectionBundle(scope);
    return { metadata, projectionBundle };
  }

  async function apply(scopeValue, {
    handClasses,
    operationKind,
    mix = null,
    actionGroupId = null,
  } = {}) {
    const scope = validateScope(scopeValue);
    const selected = canonicalHands(handClasses);
    const strategy = strategyForOperation(operationKind, mix);
    const [source, heads] = await Promise.all([
      repository.loadEvidenceScope(scope),
      repository.loadRangeHeadsScope(scope),
    ]);
    const current = new Map(heads.current.map((entry) => [entry.handClass, entry]));
    const ambiguous = new Set(heads.conflicting.map((entry) => entry.handClass));
    const history = new Map(source.rangeObservations.map((entry) => [entry.id, entry]));
    const skippedConflictHandClasses = [];
    const skippedUnsupportedHandClasses = [];
    const accepted = [];
    const operationItems = [];
    const groupId = actionGroupId ?? idFactory('range-builder-action');

    for (const handClass of selected) {
      const previous = current.get(handClass) ?? null;
      if (ambiguous.has(handClass)) {
        skippedConflictHandClasses.push(handClass);
        continue;
      }
      let nextStrategy = strategy;
      if (operationKind === RANGE_BUILDER_OPERATION_KINDS.CLEAR_BUILDER_EDIT) {
        if (previous?.provenance?.source !== DIRECT_EVIDENCE_SOURCES.RANGE_BUILDER) {
          skippedUnsupportedHandClasses.push(handClass);
          continue;
        }
        nextStrategy = restoreStrategy(history.get(previous.revision.supersedesObservationId) ?? null);
      }
      const createdAt = timestampFrom(clock, previous?.updatedAt ?? null);
      const observation = createRangeObservation({
        id: idFactory('range-observation'),
        profileId: scope.profileId,
        modeId: scope.modeId,
        context: scope.context,
        handClass,
        dominantAction: nextStrategy.dominantAction,
        frequencies: nextStrategy.frequencies,
        state: nextStrategy.state ?? RANGE_OBSERVATION_STATES.ACTIVE,
        evidenceSource: DIRECT_EVIDENCE_SOURCES.RANGE_BUILDER,
        actionGroupId: groupId,
        supersedesObservationId: previous?.id ?? null,
        createdAt,
      });
      accepted.push(observation);
      operationItems.push({ handClass, evidenceId: observation.id, beforeObservation: cloneData(previous) });
    }

    if (accepted.length === 0) {
      const projectionBundle = await projectionService.getProjectionBundle(scope);
      return deepFreeze({
        schemaVersion: 'range-builder-result/v1',
        actionGroupId: groupId,
        operationKind,
        acceptedObservations: [],
        updatedHandClasses: [],
        skippedConflictHandClasses,
        skippedUnsupportedHandClasses,
        metadata: null,
        operation: null,
        projectionBundle,
      });
    }
    const committed = await commit(scope, accepted);
    return deepFreeze({
      schemaVersion: 'range-builder-result/v1',
      actionGroupId: groupId,
      operationKind,
      acceptedObservations: cloneData(accepted),
      updatedHandClasses: accepted.map((entry) => entry.handClass),
      skippedConflictHandClasses,
      skippedUnsupportedHandClasses,
      metadata: cloneData(committed.metadata),
      operation: {
        schemaVersion: 'range-builder-operation/v1',
        actionGroupId: groupId,
        operationKind,
        scope: cloneData(scope),
        items: operationItems,
      },
      projectionBundle: committed.projectionBundle,
    });
  }

  async function undo(scopeValue, operation, { actionGroupId = null } = {}) {
    const scope = validateScope(scopeValue);
    if (operation?.schemaVersion !== 'range-builder-operation/v1'
      || operation.actionGroupId === undefined
      || calibrationContextKey(operation.scope?.context) !== calibrationContextKey(scope.context)
      || operation.scope.profileId !== scope.profileId
      || operation.scope.modeId !== scope.modeId) {
      throw new RangeError('Range Builder undo operation does not match the selected scope');
    }
    const heads = await repository.loadRangeHeadsScope(scope);
    const current = new Map(heads.current.map((entry) => [entry.handClass, entry]));
    for (const item of operation.items) {
      if (current.get(item.handClass)?.id !== item.evidenceId) {
        throw new RangeError('Range Builder action can no longer be undone because its evidence changed');
      }
    }
    const undoGroupId = actionGroupId ?? idFactory('range-builder-undo');
    const observations = operation.items.map((item) => {
      const previous = item.beforeObservation;
      const strategy = restoreStrategy(previous);
      return createRangeObservation({
        id: idFactory('range-observation'),
        profileId: scope.profileId,
        modeId: scope.modeId,
        context: scope.context,
        handClass: item.handClass,
        dominantAction: strategy.dominantAction,
        frequencies: strategy.frequencies,
        state: strategy.state,
        evidenceSource: DIRECT_EVIDENCE_SOURCES.RANGE_BUILDER,
        actionGroupId: undoGroupId,
        undoesActionGroupId: operation.actionGroupId,
        supersedesObservationId: item.evidenceId,
        createdAt: timestampFrom(clock, current.get(item.handClass).updatedAt),
      });
    });
    const committed = await commit(scope, observations);
    return deepFreeze({
      schemaVersion: 'range-builder-undo-result/v1',
      actionGroupId: undoGroupId,
      undoneActionGroupId: operation.actionGroupId,
      acceptedObservations: cloneData(observations),
      updatedHandClasses: observations.map((entry) => entry.handClass),
      metadata: cloneData(committed.metadata),
      projectionBundle: committed.projectionBundle,
    });
  }

  return Object.freeze({
    schemaVersion: RANGE_BUILDER_SERVICE_SCHEMA_VERSION,
    apply,
    undo,
  });
}
