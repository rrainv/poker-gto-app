import { preflopHandClassForCards, validatePokerState } from '../../../shared/poker-domain/index.js';
import { derivePreflopCalibrationContextFromPokerState } from '../personal-strategy/preflop-context.mjs';
import { calibrationContextsEquivalent, calibrationContextKey } from '../personal-strategy/domain.mjs';
import { validatePersonalStrategyEvidenceView } from '../personal-strategy/evidence-view.mjs';
import { createContextFromSelection, createIdentityScopedRangeCalibrationApplication } from './range-calibration-service.mjs';
import { RIVERLINE_OWNED_DOMAINS } from '../account-identity/index.mjs';

export const HAND_IMPORT_STUDY_VERSION = 'hand-import-study/v1';
const result = (reason, fields = {}) => Object.freeze({ schemaVersion: HAND_IMPORT_STUDY_VERSION,
  personalStatus: 'unavailable', reason, observedAction: null, intendedAction: null,
  actionTypeRelationship: null, frequency: null, evidenceIds: [], normativeAssessment: 'unavailable',
  practice: { available: false, reason: 'Imported decision practice has no compatible Training request.' }, ...fields });

// This adapter reads canonical decision state and existing intended evidence. It never records behavior as intent.
export function projectHandImportStudy({ pokerState, heroPlayerId, chosenAction = null, scope = null, evidenceView = null } = {}) {
  validatePokerState(pokerState);
  const common = { observedAction: chosenAction?.type ?? null };
  if (pokerState.rulesSnapshot?.definition?.recordedSettlementPolicy) {
    return result('Recorded rake does not establish a compatible Personal Strategy rake model.', common);
  }
  if (pokerState.street !== 'preflop') return result('Personal intent lookup for this imported postflop decision is unavailable.', common);
  let context;
  try { context = derivePreflopCalibrationContextFromPokerState(pokerState, heroPlayerId); }
  catch { return result('This canonical decision has no supported Personal Strategy context.', common); }
  if (!scope) return result('Choose a Game Setup and Approach in Personal Strategy.', { ...common, context });
  if (!calibrationContextsEquivalent(context, scope.context)) {
    return result('The selected Personal Strategy context does not match this decision.', common);
  }
  if (!evidenceView) return result('No compatible direct personal intent is recorded.', { ...common, context });
  validatePersonalStrategyEvidenceView(evidenceView);
  if (evidenceView.scope.profileId !== scope.profileId || evidenceView.scope.modeId !== scope.modeId
    || evidenceView.scope.contextKey !== calibrationContextKey(scope.context)) {
    return result('The selected Personal Strategy context does not match this decision.', common);
  }
  const hero = pokerState.players.find(player => player.playerId === heroPlayerId);
  const handClass = preflopHandClassForCards(hero.holeCards);
  const point = evidenceView.points.find(entry => entry.handClass === handClass);
  if (!['direct_exact', 'direct_dominant'].includes(point?.resolution)) {
    return result(point?.conflict ? 'Personal intent has an unresolved conflict.' : 'No compatible direct personal intent is recorded.', common);
  }
  const intendedAction = point.strategyValue.dominantAction?.type ?? null;
  return result(null, { ...common, personalStatus: 'available', context, handClass, intendedAction,
    actionTypeRelationship: chosenAction?.type && intendedAction
      ? chosenAction.type === intendedAction ? 'same_action_type' : 'different_action_type' : null,
    precision: point.strategyValue.kind,
    evidenceIds: [...point.sourceEvidenceIds],
    frequency: point.strategyValue.exactFrequencies ? structuredClone(point.strategyValue.exactFrequencies) : null });
}

export async function readHandImportStudy(input, { identity = globalThis.window?.RiverlineAccountIdentity,
  application = null, lifecycleScope = null } = {}) {
  const base = projectHandImportStudy(input);
  if (!base.context) return base;
  let ownedApplication = null;
  try {
    const lifecycle = lifecycleScope ?? (application ? null
      : await identity?.captureLifecycleScope?.(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY));
    lifecycle?.assertCurrent();
    if (!application && !lifecycle) return result('Personal Strategy is unavailable for this owner.');
    const reader = application ?? (ownedApplication = createIdentityScopedRangeCalibrationApplication(
      lifecycle.domainOwnerBinding, { lifecycleScope: lifecycle }));
    const workspace = await reader.readWorkspace();
    lifecycle?.assertCurrent();
    const profileId = workspace.preferences.selectedProfileId;
    const preference = workspace.preferences.byProfile[profileId];
    const selected = workspace.profiles.find(entry => entry.profile.id === profileId);
    const mode = selected?.modes.find(entry => entry.id === preference?.activeModeId);
    if (!selected || !mode) return base;
    const scope = { profileId, modeId: mode.id, context: createContextFromSelection(preference.context) };
    const compatibility = projectHandImportStudy({ ...input, scope });
    if (!compatibility.context) return compatibility;
    const evidenceView = await reader.getEvidenceView(scope);
    lifecycle?.assertCurrent();
    return Object.freeze({ ...projectHandImportStudy({ ...input, scope, evidenceView }),
      selection: Object.freeze({ profileId, modeId: mode.id, setupName: selected.profile.displayName,
        approachName: mode.displayName }) });
  } finally { await ownedApplication?.repository?.close?.(); }
}

// Session-local references only; durable annotations and conflict checking stay in Saved.
export function createHandReviewDecisionSaver({ saveReviewedDecisionSpot, getById, updateAnnotations, getOwnerGeneration }) {
  const references = new Map(), flights = new Map();
  let generation = 0;
  return Object.freeze({
    clear() { generation += 1; references.clear(); flights.clear(); },
    save(input, annotationChanges = null) {
      const owner = getOwnerGeneration(), operationGeneration = generation;
      const key = `${owner}:${input.canonicalHandId}:${input.decisionId}`;
      const assertCurrent = () => {
        if (owner !== getOwnerGeneration() || operationGeneration !== generation) throw new Error('Stale reviewed decision owner');
      };
      const pending = flights.get(key) ?? Promise.resolve();
      const operation = pending.catch(() => {}).then(async () => {
        assertCurrent();
        const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${input.canonicalHandId}:${input.decisionId}`));
        assertCurrent();
        const stableId = `review-spot-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
        const id = references.get(key) ?? stableId;
        const existing = await getById(id);
        assertCurrent();
        let saved = existing ? { object: existing } : await saveReviewedDecisionSpot({ ...input, operation: { id: stableId } });
        assertCurrent();
        if (!saved?.object || saved.object.lifecycle.state !== 'active'
          || saved.object.payload.handReference?.canonicalHandId !== input.canonicalHandId
          || saved.object.source.sourceId !== input.sourceId) throw new Error('Reviewed decision source changed');
        references.set(key, saved.object.id);
        if (annotationChanges) {
          const changes = annotationChanges.situational
            ? { tags: saved.object.annotations.tags.some(tag => tag.key === 'situational')
              ? saved.object.annotations.tags : [...saved.object.annotations.tags, 'situational'] }
            : { reviewState: annotationChanges.reviewState };
          const unchanged = changes.tags
            ? changes.tags.length === saved.object.annotations.tags.length
            : changes.reviewState === saved.object.annotations.reviewState;
          if (!unchanged) saved = await updateAnnotations(saved.object.id, changes, { expectedRevision: saved.object.revision });
          assertCurrent();
        }
        return saved;
      });
      flights.set(key, operation);
      return operation.finally(() => { if (flights.get(key) === operation) flights.delete(key); });
    },
  });
}
