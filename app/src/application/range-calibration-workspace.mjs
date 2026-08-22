import {
  CALIBRATION_ENVIRONMENTS,
  PREFLOP_CALIBRATION_DECISION_FAMILIES,
  RANGE_CALIBRATION_STACK_LIMITS,
  RFI_CALIBRATION_ACTIONS,
  RFI_CALIBRATION_INTENTS,
  RFI_CALIBRATION_STOP_REASONS,
  complementaryRfiMixFromFold,
  countCurrentDirectObservations,
  createContextFromSelection,
  createIdentityScopedRangeCalibrationApplication,
  isInvalidRfiMixError,
  normalizeRfiMix,
  normalizeRfiContextSelection,
  profileDefaultEnvironment,
  positionsForPreflopCalibrationFamily,
  tableSizesForEnvironment,
} from './range-calibration-service.mjs';
import { representativeCardsForHandClass } from '../ui/representative-hand-cards.mjs';
import { appendCardFaceContents } from './card-presentation.mjs';
import { createPersonalStrategyScopeLifecycle } from './personal-strategy-scope-lifecycle.mjs';
import {
  RIVERLINE_OWNED_DOMAINS,
} from '../account-identity/index.mjs';
import {
  CALIBRATION_DECISION_FAMILIES,
  RANGE_TEACHER_SESSION_PRESETS,
} from '../personal-strategy/index.mjs';

let mountedWorkspace = null;

const MATRIX_STATUS_KEYS = Object.freeze({
  directly_known: 'Direct',
  inferred_high: 'Inferred high',
  inferred_medium: 'Inferred medium',
  transferred: 'Transferred',
  uncertain: 'Uncertain',
  conflicting: 'Conflict',
  unknown: 'Unknown',
});

const MATRIX_REASON_KEYS = Object.freeze({
  direct_dominant_observation: 'Direct dominant action recorded',
  direct_exact_frequency_observation: 'Direct exact mix recorded',
  direct_tied_exact_mix: 'Direct tied exact mix recorded',
  conflicting_direct_evidence: 'Active direct answers conflict',
  multiple_consistent_neighbors: 'Multiple consistent direct neighbors',
  adjacent_same_family_support: 'Supported by nearby hands in the same family',
  pair_neighbor_support: 'Supported by nearby pairs',
  suited_run_support: 'Supported by nearby suited hands',
  connectivity_shift_support: 'Supported by nearby connected hands',
  suited_offsuit_counterpart_support: 'Supported by the suited or offsuit counterpart',
  bounded_regional_interpolation: 'Supported by an evidence-consistent regional run',
  observed_regional_action_boundary: 'Between observed Raise/Fold boundaries',
  regional_order_discontinuity: 'Direct answers reveal an unusual gap',
  boundary_nearby: 'Near a Raise/Fold boundary',
  conflicting_neighbor: 'Conflicting nearby answers',
  scope_locally_unstable: 'Nearby direct answers are locally unstable',
  insufficient_support: 'Not enough nearby direct evidence',
  no_structurally_relevant_evidence: 'No relevant direct evidence yet',
  unsupported_direct_action: 'The direct action is outside this Fold/Raise model',
  additional_first_in_actions_unmodeled: 'Fold/Raise is modeled here; Limp and All-in remain unmodeled.',
  training_evidence_excluded_from_002b_inference: 'Training evidence is shown separately and does not drive this inference',
  direct_donor_evidence: 'Transferred from direct evidence in a compatible nearby RFI context',
  multiple_agreeing_donor_contexts: 'Multiple compatible donor contexts agree',
  exact_donor_preserved_but_target_transfer_is_qualitative: 'Exact donor mix is preserved at its source; this target transfer stays qualitative',
  cold_start_anchor: 'Samples a new hand family',
  uncertainty_reduction: 'Reduces uncertainty here',
  near_action_boundary: 'Near a Raise/Fold boundary',
  pair_boundary: 'High-value pair boundary',
  transferred_estimate_check: 'Checks a transferred estimate',
  transfer_disagreement: 'Checks a transferred estimate that disagrees locally',
  unknown_pair_region: 'Maps an unknown pocket-pair region',
  offsuit_broadway_boundary: 'Clarifies your offsuit Broadway boundary',
  modeled_region_redundancy_penalty: 'Already modeled by a supported regional run',
});

const MATRIX_FILTER_STATUSES = Object.freeze({
  all: null,
  direct: new Set(['directly_known']),
  inferred: new Set(['inferred_high', 'inferred_medium', 'transferred']),
  uncertain: new Set(['uncertain', 'unknown']),
  conflicts: new Set(['conflicting']),
});

const DECISION_FAMILY_LABELS = Object.freeze({
  [CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI]: 'First in / Unopened pot',
  [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_LIMP]: 'Facing limp',
  [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_OPEN]: 'Facing open',
  [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_3BET]: 'Facing 3-bet',
  [CALIBRATION_DECISION_FAMILIES.PREFLOP_FACING_4BET]: 'Facing 4-bet',
  [CALIBRATION_DECISION_FAMILIES.PREFLOP_BB_OPTION]: 'BB option',
});

function decisionFamilyLabel(decisionFamily) {
  return translated(DECISION_FAMILY_LABELS[decisionFamily] ?? decisionFamily);
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function translated(key, parameters) {
  return window.t?.(key, parameters) ?? key;
}

function setTranslatedText(element, key, parameters) {
  if (!element) return;
  element.dataset.i18n = key;
  if (parameters) delete element.dataset.i18n;
  element.textContent = translated(key, parameters);
}

export function rebalanceCalibrationMixPercentages(currentValues, changedAction, rawValue) {
  const actions = Object.keys(currentValues ?? {});
  if (actions.length < 3 || !actions.includes(changedAction)) {
    throw new RangeError('Multi-action mix rebalancing requires at least three legal actions');
  }
  const changedValue = Math.max(0, Math.min(100, Number(rawValue) || 0));
  const others = actions.filter((action) => action !== changedAction);
  const remaining = 100 - changedValue;
  const otherTotal = others.reduce((sum, action) => {
    const value = Number(currentValues[action]);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
  const result = { [changedAction]: Number(changedValue.toFixed(6)) };
  let assigned = 0;
  others.forEach((action, index) => {
    const next = index === others.length - 1
      ? remaining - assigned
      : otherTotal > 0
        ? remaining * Math.max(0, Number(currentValues[action]) || 0) / otherTotal
        : remaining / others.length;
    const rounded = Number(next.toFixed(6));
    result[action] = rounded;
    assigned += rounded;
  });
  return Object.freeze(Object.fromEntries(actions.map((action) => [action, result[action]])));
}

export async function openCalibrationProfileReview({
  leaveCheckpoint,
  openMatrix,
  matrixPanel = null,
  matrixTab = null,
} = {}) {
  const leftCheckpoint = await leaveCheckpoint({ restoreFocus: false });
  if (!leftCheckpoint) return false;
  await openMatrix('matrix');
  matrixPanel?.scrollIntoView?.({ block: 'start' });
  matrixTab?.focus?.({ preventScroll: true });
  return true;
}

function cloneCalibrationDom() {
  const mount = document.querySelector('#rangeCalibrationMount');
  const workspaceTemplate = document.querySelector('#rangeCalibrationTemplate');
  if (!mount || !workspaceTemplate) throw new Error('Range Calibration workspace template is unavailable');
  if (!mount.firstElementChild) mount.append(workspaceTemplate.content.cloneNode(true));

  if (!document.querySelector('#calibrationProfileModal')) {
    const modalTemplate = document.querySelector('#calibrationProfileModalTemplate');
    if (!modalTemplate) throw new Error('Range Calibration profile editor template is unavailable');
    document.body.append(modalTemplate.content.cloneNode(true));
  }
  window.RiverlineI18n?.translateNode?.(mount);
  window.RiverlineI18n?.translateNode?.(document.querySelector('#calibrationProfileModal'));
  return document.querySelector('#rangeCalibrationWorkspace');
}

function friendlyError(error) {
  if (error?.code === 'identity_unavailable') return translated('Your account identity is still becoming available. Try again.');
  if (error?.code === 'corrupt_record') return translated('Stored Personal Strategy data is malformed and was left untouched.');
  if (error?.code === 'unsupported_schema') return translated('Stored Personal Strategy data uses an unsupported version and was left untouched.');
  if (error?.code === 'owner_mismatch') return translated('Stored Personal Strategy data belongs to a different local owner and was left untouched.');
  if (error?.code === 'read_failed') return translated('Personal Strategy data could not be read.');
  if (error?.code === 'write_failed') return translated('Your changes could not be saved. The previous data remains intact.');
  if (error?.code === 'open_failed') return translated('Personal Strategy storage could not be opened. Try again.');
  if (error?.code === 'unsupported_database_version') return translated('Personal Strategy storage uses a newer unsupported version and was left untouched.');
  if (error?.code === 'migration_failed') return translated('Personal Strategy migration did not finish. Your previous data remains intact; try again.');
  if (error?.code === 'transaction_failed') return translated('Your answer was not confirmed. Your previous data remains intact; retry the save.');
  const message = String(error?.message || '');
  if (/must be different/i.test(message)) return translated('Give each mode a different name.');
  if (/characters or fewer/i.test(message)) return translated('Use a shorter name or description.');
  if (/required/i.test(message)) return translated('Complete the profile name and all three mode names.');
  if (/frequencies must total 100/i.test(message)) return translated('Fold and Raise frequencies must total 100%.');
  if (/frequencies must each be from 0 through 100/i.test(message)) return translated('Fold and Raise frequencies must each be from 0 through 100.');
  if (/stack/i.test(message)) return translated('Enter an effective stack from {min} to {max} bb.', RANGE_CALIBRATION_STACK_LIMITS);
  return translated('Something went wrong. Your previous data remains intact.');
}

function notify(message, tone = 'info') {
  if (typeof window.toast === 'function') window.toast(message, tone, 'calibration');
}

function selectedEntry(workspace, profileId) {
  return workspace.profiles.find((entry) => entry.profile.id === profileId) || null;
}

function initialSelection(workspace) {
  const preferredProfile = selectedEntry(workspace, workspace.preferences.selectedProfileId);
  const entry = preferredProfile || workspace.profiles[0] || null;
  if (!entry) return null;
  const preference = workspace.preferences.byProfile[entry.profile.id];
  const activeMode = entry.modes.find((mode) => mode.id === preference?.activeModeId) || entry.modes[0];
  const context = normalizeRfiContextSelection({ ...preference?.context, actionAware: true }, {
    environmentDefault: profileDefaultEnvironment(entry.profile),
  });
  return { profileId: entry.profile.id, modeId: activeMode.id, context };
}

function createController(root, application, initialWorkspace, activationStartedAt, profileLoadMs) {
  const query = (selector) => document.querySelector(selector);
  const lifecycle = new AbortController();
  let workspace = initialWorkspace;
  let selection = initialSelection(workspace);
  let calibrationState = null;
  let editorMode = 'create';
  let focusBeforeModal = null;
  let focusBeforeMix = null;
  let educationVisible = true;
  let lastAnswerError = null;
  let answerPending = false;
  let answerPendingGeneration = null;
  let failedAnswer = null;
  let calibrationIntent = RFI_CALIBRATION_INTENTS.STANDARD;
  let matrixProjection = null;
  let matrixScopeKey = null;
  let pendingMatrixScopeSwitchStartedAt = null;
  let matrixSelectedHand = null;
  let matrixFilter = 'all';
  let matrixFollowQuestion = true;
  let matrixWritePending = false;
  let matrixWritePendingGeneration = null;
  let personalStrategySubview = 'matrix';
  let rangeTeacherView = null;
  let teacherSelectedHand = null;
  let dismissedTeacherSuggestions = new Set();
  let builderActive = false;
  let builderBrush = 'select';
  let builderSelection = new Set();
  let builderSelectionAnchor = null;
  let builderGesture = null;
  let builderPreviewAction = null;
  let suppressBuilderClick = false;
  const builderHistory = [];
  let mixTarget = null;
  const interactionSamples = [];
  let personalStrategyScopeLifecycle = null;
  const activationReads = application.getStorageMetrics();
  const metrics = {
    activationMs: 0,
    profileLoadMs,
    profileCount: workspace.profiles.length,
    repositoryReadsDuringActivation: activationReads.readsByKey[application.repository.storageKey] || 0,
    domNodes: 0,
    matrix: {
      projectionLoads: 0,
      projectionPreparationMs: [],
      selectionMs: [],
      correctionToRecomputeMs: [],
      scopeSwitchMs: [],
    },
    teacher: {
      viewLoads: 0,
      viewPreparationMs: [],
      actionToQuestionMs: [],
    },
  };

  function activeEntry() {
    return selection ? selectedEntry(workspace, selection.profileId) : null;
  }

  function activeMode() {
    const entry = activeEntry();
    return entry?.modes.find((mode) => mode.id === selection.modeId) || entry?.modes[0] || null;
  }

  function matchingCalibrationSession() {
    if (!selection) return null;
    const contextScope = createContextFromSelection(selection.context);
    return workspace.snapshot.calibrationSessions
      .filter((session) => session.profileId === selection.profileId
        && session.modeId === selection.modeId
        && JSON.stringify(session.contextScope) === JSON.stringify(contextScope))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
  }

  function currentMatrixScope() {
    if (!selection) return null;
    return {
      profileId: selection.profileId,
      modeId: selection.modeId,
      context: createContextFromSelection(selection.context),
    };
  }

  function currentMatrixScopeKey() {
    const scope = currentMatrixScope();
    return scope ? `${scope.profileId}|${scope.modeId}|${JSON.stringify(scope.context)}` : null;
  }

  function clearPersonalStrategyPresentation() {
    calibrationState = null;
    answerPending = false;
    answerPendingGeneration = null;
    failedAnswer = null;
    lastAnswerError = null;
    matrixProjection = null;
    matrixScopeKey = null;
    matrixSelectedHand = null;
    matrixWritePending = false;
    matrixWritePendingGeneration = null;
    rangeTeacherView = null;
    teacherSelectedHand = null;
    dismissedTeacherSuggestions = new Set();
    builderActive = false;
    builderSelection = new Set();
    builderSelectionAnchor = null;
    builderGesture = null;
    builderPreviewAction = null;
    builderHistory.splice(0);
    if (mixTarget) {
      closeMixEditor({ restoreFocus: false });
    }
    query('#calibrationPersonalStrategyGrid')?.replaceChildren();
    query('#calibrationTeacherRecommendation').hidden = true;
    query('#calibrationTeacherScope').textContent = '';
    query('#calibrationTeacherStatus').textContent = '';
    for (const id of [
      'calibrationTeacherBoundaries',
      'calibrationTeacherConflicts',
      'calibrationTeacherSparse',
      'calibrationTeacherMix',
    ]) query(`#${id}`)?.replaceChildren();
    setMatrixLoading(true);
    query('#calibrationTeacherPanel').setAttribute('aria-busy', 'true');
  }

  function activateCurrentPersonalStrategyScope() {
    const scope = currentMatrixScope();
    if (!scope) {
      personalStrategyScopeLifecycle.invalidate();
      return null;
    }
    return personalStrategyScopeLifecycle.activate(scope);
  }

  function currentPersonalStrategyToken(scope = currentMatrixScope()) {
    return scope ? personalStrategyScopeLifecycle.capture(scope) : null;
  }

  function beginPersonalStrategyMutation(scope) {
    return personalStrategyScopeLifecycle.revise(scope);
  }

  function matrixCell(handClass) {
    return matrixProjection?.cells.find((cell) => cell.handClass === handClass) ?? null;
  }

  function matrixStatusLabel(status) {
    return translated(MATRIX_STATUS_KEYS[status] ?? 'Unknown');
  }

  function matrixActionDescription(cell) {
    if (cell.action.exactFrequencies) {
      return cell.action.exactFrequencies.map((entry) => (
        `${actionLabel(entry.action.type)} ${Number((entry.probability * 100).toFixed(1))}%`
      )).join(' · ');
    }
    if (cell.action.dominantAction) {
      return `${translated('Dominant action')}: ${actionLabel(cell.action.dominantAction)}`;
    }
    if (cell.status === 'conflicting') return translated('Conflicting direct answers');
    return translated('No modeled action');
  }

  function matrixFilterMatches(cell) {
    const statuses = MATRIX_FILTER_STATUSES[matrixFilter];
    return statuses === null || statuses.has(cell.status);
  }

  function setMatrixLoading(loading, error = null) {
    query('#calibrationMatrixLoading').hidden = !loading;
    query('#calibrationMatrixLayout').hidden = loading || Boolean(error);
    query('#calibrationMatrixError').hidden = !error;
    query('#calibrationMatrixError').textContent = error ? friendlyError(error) : '';
    query('#calibrationMatrixPanel').setAttribute('aria-busy', String(loading));
  }

  function matrixActionToken(cell) {
    if (cell.action.precision === 'tied_exact_mix') return translated('Mix');
    if (cell.action.dominantAction === 'fold') return 'F';
    if (cell.action.dominantAction === 'check') return 'K';
    if (cell.action.dominantAction === 'call') return 'C';
    if (cell.action.dominantAction === 'raise') return 'R';
    if (cell.action.dominantAction === 'all_in') return 'A';
    return '—';
  }

  function renderMatrixGrid() {
    if (!matrixProjection) return;
    const grid = query('#calibrationPersonalStrategyGrid');
    const fragment = document.createDocumentFragment();
    matrixProjection.cells.forEach((cell, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calibration-matrix-cell';
      button.dataset.handClass = cell.handClass;
      button.dataset.matrixStatus = cell.status;
      button.dataset.action = cell.action.kind;
      button.dataset.precision = cell.action.precision;
      button.dataset.filtered = String(!matrixFilterMatches(cell));
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-rowindex', String(cell.row + 1));
      button.setAttribute('aria-colindex', String(cell.column + 1));
      const selected = builderActive
        ? builderSelection.has(cell.handClass)
        : cell.handClass === matrixSelectedHand;
      button.setAttribute('aria-selected', String(selected));
      button.setAttribute('aria-label', `${cell.handClass}, ${matrixStatusLabel(cell.status)}, ${matrixActionDescription(cell)}${builderActive ? `, ${selected ? translated('Selected') : translated('Not selected')}` : ''}`);
      button.title = `${cell.handClass} · ${matrixStatusLabel(cell.status)} · ${matrixActionDescription(cell)}`;
      button.tabIndex = cell.handClass === matrixSelectedHand || (!matrixSelectedHand && index === 0) ? 0 : -1;
      button.classList.toggle('is-primary-selected', cell.handClass === matrixSelectedHand);
      if (builderActive && builderPreviewAction && selected) button.dataset.builderPreview = builderPreviewAction;
      const hand = document.createElement('span');
      hand.className = 'calibration-matrix-hand';
      hand.textContent = cell.handClass;
      const action = document.createElement('span');
      action.className = 'calibration-matrix-action';
      action.textContent = matrixActionToken(cell);
      const marker = document.createElement('span');
      marker.className = 'calibration-matrix-marker';
      marker.textContent = cell.statusMarker;
      marker.setAttribute('aria-hidden', 'true');
      button.append(hand, action, marker);
      if (cell.action.exactFrequencies) {
        const band = document.createElement('span');
        band.className = 'calibration-matrix-mix-band';
        band.setAttribute('aria-hidden', 'true');
        cell.action.exactFrequencies.forEach((entry) => {
          const segment = document.createElement('i');
          segment.dataset.action = entry.action.type;
          segment.style.setProperty('--mix-share', `${entry.probability * 100}%`);
          band.append(segment);
        });
        button.append(band);
      }
      if (cell.hasComboOverrides) {
        const override = document.createElement('span');
        override.className = 'calibration-matrix-combo-override';
        override.textContent = '+';
        override.setAttribute('aria-label', translated('Contains combo overrides'));
        button.append(override);
      }
      fragment.append(button);
    });
    grid.replaceChildren(fragment);
  }

  function evidenceActionDescription(evidence) {
    const value = evidence.claim?.value;
    if (!value) return translated('Retracted');
    if (value.exactFrequencies) {
      return value.exactFrequencies.map((entry) => (
        `${actionLabel(entry.action.type)} ${Number((entry.probability * 100).toFixed(1))}%`
      )).join(' · ');
    }
    if (value.dominantAction?.type) return `${translated('Dominant')} ${actionLabel(value.dominantAction.type)}`;
    if (value.chosenAction?.type) return actionLabel(value.chosenAction.type);
    return translated('Unknown');
  }

  function evidenceSourceLabel(evidence) {
    if (evidence.source.kind === 'training') return translated('Training evidence');
    if (evidence.source.kind === 'range_builder') return translated('Builder edit');
    if (evidence.source.kind === 'matrix') return translated('Matrix correction');
    return evidence.source.sessionId
      ? translated('Calibration session')
      : translated('Matrix correction');
  }

  function evidenceNode(evidence, { history = false } = {}) {
    const item = document.createElement(history ? 'li' : 'div');
    item.className = history ? 'calibration-history-item' : 'calibration-direct-item';
    const heading = document.createElement('strong');
    heading.textContent = evidenceActionDescription(evidence);
    const meta = document.createElement('span');
    const date = new Date(evidence.occurredAt);
    const dateLocale = { en: 'en-US', ru: 'ru-RU', he: 'he-IL' }[document.documentElement.lang] ?? 'en-US';
    const state = history && evidence.headState !== 'active'
      ? ` · ${translated(evidence.headState === 'superseded' ? 'Superseded' : 'Retracted')}` : '';
    meta.textContent = `${evidenceSourceLabel(evidence)} · ${Number.isNaN(date.getTime()) ? evidence.occurredAt : date.toLocaleDateString(dateLocale)}${state}`;
    item.append(heading, meta);
    return item;
  }

  function renderMatrixInspector() {
    const cell = matrixCell(matrixSelectedHand);
    query('#calibrationInspectorEmpty').hidden = Boolean(cell);
    query('#calibrationInspectorContent').hidden = !cell;
    if (!cell) return;
    query('#calibrationInspectorHand').textContent = cell.handClass;
    const status = query('#calibrationInspectorStatus');
    status.textContent = `${cell.statusMarker} ${matrixStatusLabel(cell.status)}`;
    status.dataset.matrixStatus = cell.status;
    query('#calibrationInspectorAction').textContent = matrixActionDescription(cell);

    let explanationKey = 'Riverline does not have enough direct evidence for this hand yet.';
    let parameters;
    if (cell.status === 'directly_known') {
      explanationKey = 'This hand comes from direct evidence you recorded.';
    } else if (cell.status === 'inferred_high' || cell.status === 'inferred_medium') {
      explanationKey = 'Riverline inferred {action} from nearby direct answers.';
      parameters = { action: actionLabel(cell.action.dominantAction) };
    } else if (cell.status === 'transferred') {
      explanationKey = 'Riverline transferred {action} from {count} compatible nearby RFI contexts. This is derived, not direct evidence.';
      parameters = {
        action: actionLabel(cell.action.dominantAction),
        count: cell.transfer?.donorContributions.length ?? 0,
      };
    } else if (cell.status === 'uncertain') {
      explanationKey = 'Nearby evidence exists, but Riverline is abstaining here.';
    } else if (cell.status === 'conflicting') {
      explanationKey = 'Active direct answers disagree. Riverline is not averaging them.';
    }
    setTranslatedText(query('#calibrationInspectorExplanation'), explanationKey, parameters);
    query('#calibrationInspectorProvenance').textContent = matrixStatusLabel(cell.status);
    query('#calibrationInspectorEvidenceCount').textContent = translated('{count} records', {
      count: cell.status === 'transferred'
        ? cell.sourceEvidenceCount
        : cell.evidence.directHistory.length + cell.evidence.training.length,
    });
    query('#calibrationInspectorBoundary').textContent = translated(
      cell.support.boundaryLikelihood === 'high' ? 'High boundary likelihood'
        : cell.support.boundaryLikelihood === 'medium' ? 'Medium boundary likelihood'
          : cell.support.boundaryLikelihood === 'low' ? 'Low boundary likelihood' : 'Unknown',
    );
    query('#calibrationInspectorQuestionRank').textContent = cell.question
      ? `${translated('Rank')} #${cell.question.rank}${cell.question.isHighValue ? ` · ${translated('Recommended clarification')}` : ''}`
      : translated('Not ranked');

    const reasons = query('#calibrationInspectorReasons');
    const reasonKeys = [...new Set([
      ...cell.reasons.map((code) => MATRIX_REASON_KEYS[code] ?? code),
      ...(cell.question?.priorityReasons ?? []).map((code) => MATRIX_REASON_KEYS[code] ?? code),
      ...(cell.support.boundaryLikelihood === 'high' ? ['Near a Raise/Fold boundary'] : []),
      ...(cell.support.evidenceDensity === 'sparse' ? ['Sparse evidence in this region'] : []),
    ])];
    reasons.replaceChildren(...reasonKeys.map((key) => {
      const item = document.createElement('li');
      item.textContent = translated(key);
      return item;
    }));
    query('#calibrationInspectorWhySection').hidden = reasonKeys.length === 0;

    const neighbors = query('#calibrationInspectorNeighbors');
    neighbors.replaceChildren(...cell.support.selectedNeighbors.slice(0, 8).map((neighbor) => {
      const item = document.createElement('li');
      const action = neighbor.observedDominantAction?.type
        ? actionLabel(neighbor.observedDominantAction.type)
        : translated(neighbor.pointResolution === 'conflicting' ? 'Conflict' : 'Exact boundary');
      item.textContent = `${neighbor.handClass} — ${action} · ${translated(neighbor.relationType.replaceAll('_', ' '))}`;
      item.dir = 'ltr';
      return item;
    }));
    query('#calibrationInspectorNeighborsSection').hidden = cell.support.selectedNeighbors.length === 0;

    const direct = query('#calibrationInspectorDirect');
    const visibleDirect = [...cell.evidence.activeDirect, ...cell.evidence.training].slice(0, 8);
    direct.replaceChildren(...(visibleDirect.length
      ? visibleDirect.map((entry) => evidenceNode(entry))
      : [Object.assign(document.createElement('p'), { textContent: translated('No direct evidence for this hand.') })]));
    const history = cell.evidence.directHistory.slice(0, 12);
    query('#calibrationInspectorHistory').hidden = history.length <= cell.evidence.activeDirect.length;
    query('#calibrationInspectorHistoryList').replaceChildren(...history.map((entry) => evidenceNode(entry, { history: true })));

    const conflictNote = query('#calibrationInspectorConflictNote');
    conflictNote.hidden = cell.status !== 'conflicting';
    if (cell.status === 'conflicting') {
      setTranslatedText(conflictNote, 'Keep both leaves the contradiction unresolved. A change corrects one active branch and preserves the other evidence.');
    }
    const inferred = cell.status === 'inferred_high'
      || cell.status === 'inferred_medium'
      || cell.status === 'transferred';
    query('#calibrationMatrixConfirm').hidden = !inferred || !cell.action.dominantAction;
    query('#calibrationMatrixAskNext').hidden = true;
    const legalActions = new Set(matrixProjection.actionUniverse.map((action) => action.type));
    query('#calibrationMatrixFold').hidden = !legalActions.has('fold');
    query('#calibrationMatrixRaise').hidden = !legalActions.has('raise');
    query('#calibrationMatrixContextActions').replaceChildren(...['check', 'call', 'all_in']
      .filter((actionType) => legalActions.has(actionType))
      .map((actionType) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ui-button ui-button--secondary';
        button.dataset.matrixAction = actionType;
        button.textContent = translated('Change to {action}', { action: actionLabel(actionType) });
        button.disabled = matrixWritePending;
        return button;
      }));
    [
      '#calibrationMatrixConfirm',
      '#calibrationMatrixFold',
      '#calibrationMatrixRaise',
      '#calibrationMatrixMix',
      '#calibrationMatrixAskNext',
    ].forEach((selector) => { query(selector).disabled = matrixWritePending; });
  }

  function selectedBuilderHands() {
    return matrixProjection?.cells
      .filter((cell) => builderSelection.has(cell.handClass))
      .map((cell) => cell.handClass) ?? [];
  }

  function renderBuilderHistory() {
    query('#calibrationBuilderHistory').replaceChildren(...builderHistory.map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry.text;
      return item;
    }));
    query('#calibrationBuilderUndo').disabled = matrixWritePending
      || !builderHistory.some((entry) => entry.operation && !entry.undone);
  }

  function renderBuilderSummary() {
    if (!matrixProjection) return;
    const selected = selectedBuilderHands();
    const counts = { direct: 0, inferred: 0, uncertain: 0, conflict: 0, unknown: 0 };
    selected.forEach((handClass) => {
      const status = matrixCell(handClass)?.status;
      if (status === 'directly_known') counts.direct += 1;
      else if (status === 'inferred_high' || status === 'inferred_medium' || status === 'transferred') {
        counts.inferred += 1;
      }
      else if (status === 'uncertain') counts.uncertain += 1;
      else if (status === 'conflicting') counts.conflict += 1;
      else counts.unknown += 1;
    });
    query('#calibrationBuilderSelectionSummary').textContent = selected.length
      ? translated('{count} hands selected · {direct} direct · {inferred} inferred · {uncertain} uncertain · {unknown} unknown · {conflict} conflict', {
        count: selected.length,
        ...counts,
      })
      : translated('No hands selected');
    query('#calibrationBuilderToolbar').querySelectorAll('[data-builder-operation], #calibrationBuilderMix')
      .forEach((button) => { button.disabled = matrixWritePending || selected.length === 0; });
    query('#calibrationBuilderClearSelection').disabled = matrixWritePending || selected.length === 0;
    renderBuilderHistory();
  }

  function syncBuilderSelectionDom() {
    const grid = query('#calibrationPersonalStrategyGrid');
    grid.querySelectorAll('[data-hand-class]').forEach((button, index) => {
      const selected = builderActive
        ? builderSelection.has(button.dataset.handClass)
        : button.dataset.handClass === matrixSelectedHand;
      button.setAttribute('aria-selected', String(selected));
      button.classList.toggle('is-primary-selected', button.dataset.handClass === matrixSelectedHand);
      button.tabIndex = button.dataset.handClass === matrixSelectedHand
        || (!matrixSelectedHand && index === 0) ? 0 : -1;
      if (builderActive && builderPreviewAction && selected) {
        button.dataset.builderPreview = builderPreviewAction;
      } else delete button.dataset.builderPreview;
    });
    if (builderActive) renderBuilderSummary();
  }

  function setBuilderSelection(handClasses, { primary = null } = {}) {
    builderSelection = new Set(handClasses.filter((handClass) => matrixCell(handClass)));
    if (primary && matrixCell(primary)) {
      matrixSelectedHand = primary;
      builderSelectionAnchor = primary;
    } else if (!matrixCell(matrixSelectedHand) && builderSelection.size) {
      matrixSelectedHand = selectedBuilderHands()[0];
    }
    syncBuilderSelectionDom();
    renderMatrixInspector();
  }

  function rectangleHands(firstHand, secondHand) {
    const first = matrixCell(firstHand);
    const second = matrixCell(secondHand);
    if (!first || !second) return [];
    const minRow = Math.min(first.row, second.row);
    const maxRow = Math.max(first.row, second.row);
    const minColumn = Math.min(first.column, second.column);
    const maxColumn = Math.max(first.column, second.column);
    return matrixProjection.cells.filter((cell) => (
      cell.row >= minRow && cell.row <= maxRow
      && cell.column >= minColumn && cell.column <= maxColumn
    )).map((cell) => cell.handClass);
  }

  function clearBuilderGesturePreview() {
    query('#calibrationPersonalStrategyGrid').querySelectorAll('[data-builder-touched]')
      .forEach((button) => delete button.dataset.builderTouched);
  }

  function suppressNextBuilderGridClick() {
    suppressBuilderClick = true;
    window.setTimeout(() => { suppressBuilderClick = false; }, 0);
  }

  function renderBuilderMode() {
    const builderSupported = matrixProjection?.actionUniverse?.length === 2
      && matrixProjection.actionUniverse[0]?.type === 'fold'
      && matrixProjection.actionUniverse[1]?.type === 'raise';
    if (!builderSupported) builderActive = false;
    query('#calibrationBuilderToggle').disabled = !builderSupported;
    query('#calibrationBuilderToggle').title = builderSupported
      ? '' : translated('Builder is unavailable for this action family; use Matrix corrections or Calibration.');
    query('#calibrationTeacherOpenBuilder').disabled = !builderSupported;
    query('#calibrationBuilderToggle').setAttribute('aria-pressed', String(builderActive));
    query('#calibrationBuilderToolbar').hidden = !builderActive;
    query('#calibrationMatrixFollow').hidden = builderActive;
    query('#calibrationBuilderToolbar').querySelectorAll('[data-builder-brush]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.builderBrush === builderBrush));
    });
    syncBuilderSelectionDom();
  }

  function updateMatrixSelectionDom(previousHand, nextHand) {
    void previousHand;
    void nextHand;
    syncBuilderSelectionDom();
  }

  function selectMatrixHand(handClass, { manual = false, focus = false } = {}) {
    if (!matrixCell(handClass)) return;
    const startedAt = now();
    const previous = matrixSelectedHand;
    matrixSelectedHand = handClass;
    teacherSelectedHand = handClass;
    if (manual) matrixFollowQuestion = false;
    query('#calibrationMatrixFollow').setAttribute('aria-pressed', String(matrixFollowQuestion));
    updateMatrixSelectionDom(previous, handClass);
    renderMatrixInspector();
    if (focus) query(`#calibrationPersonalStrategyGrid [data-hand-class="${handClass}"]`)?.focus?.({ preventScroll: true });
    metrics.matrix.selectionMs.push(now() - startedAt);
  }

  function renderMatrix() {
    if (!matrixProjection) return;
    setMatrixLoading(false);
    const entry = activeEntry();
    const mode = activeMode();
    query('#calibrationMatrixScope').textContent = entry && mode
      ? `${entry.profile.displayName} · ${mode.displayName} · ${contextSpotLabel()}`
      : '';
    const summary = matrixProjection.summary;
    renderConfiguredReadiness(matrixProjection.profileReadiness);
    query('#calibrationMatrixSummary').textContent = translated(
      '{direct} direct · {high} inferred high · {medium} inferred medium · {uncertain} uncertain · {unknown} unknown · {conflicting} conflicting',
      {
        direct: summary.directlyKnownCount,
        high: summary.inferredHighCount,
        medium: summary.inferredMediumCount,
        uncertain: summary.uncertainCount,
        unknown: summary.unknownCount,
        conflicting: summary.conflictingCount,
      },
    );
    query('#calibrationMatrixActionLegend').replaceChildren(
      ...matrixProjection.actionUniverse.flatMap((action) => {
        const swatch = document.createElement('span');
        const label = document.createElement('span');
        swatch.className = 'calibration-action-swatch';
        swatch.dataset.action = action.type;
        swatch.setAttribute('aria-hidden', 'true');
        label.textContent = actionLabel(action.type);
        return [swatch, label];
      }),
    );
    renderMatrixGrid();
    renderMatrixInspector();
    renderBuilderMode();
    query('#calibrationMatrixFilters').querySelectorAll('[data-matrix-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.matrixFilter === matrixFilter));
    });
    query('#calibrationMatrixFollow').setAttribute('aria-pressed', String(matrixFollowQuestion));
  }

  function adoptCalibrationMatrix({ scopeChanged = false } = {}) {
    if (!calibrationState?.personalStrategyMatrixProjection) return;
    matrixProjection = calibrationState.personalStrategyMatrixProjection;
    matrixScopeKey = currentMatrixScopeKey();
    if (scopeChanged) matrixSelectedHand = null;
    if (matrixFollowQuestion && calibrationState.prompt) matrixSelectedHand = calibrationState.prompt.handClass;
    renderMatrix();
  }

  async function loadMatrixProjection({ force = false, scopeSwitchStartedAt = null } = {}) {
    const scope = currentMatrixScope();
    const scopeKey = currentMatrixScopeKey();
    if (!scope || (!force && matrixProjection && matrixScopeKey === scopeKey)) {
      if (matrixProjection) renderMatrix();
      return matrixProjection;
    }
    if (matrixWritePending) return matrixProjection;
    const lifecycleToken = currentPersonalStrategyToken(scope);
    if (!lifecycleToken) return null;
    const scopeChanged = matrixScopeKey !== scopeKey;
    if (scopeChanged) {
      matrixProjection = null;
      matrixSelectedHand = null;
      builderSelection = new Set();
      builderSelectionAnchor = null;
      builderHistory.splice(0);
    }
    matrixScopeKey = scopeKey;
    setMatrixLoading(true);
    const startedAt = now();
    try {
      const projection = await application.getPersonalStrategyMatrixProjection(scope, {
        session: matchingCalibrationSession(),
      });
      const adopted = personalStrategyScopeLifecycle.adopt(lifecycleToken, scope, () => {
        matrixProjection = projection;
        metrics.matrix.projectionLoads += 1;
        metrics.matrix.projectionPreparationMs.push(now() - startedAt);
        if (scopeSwitchStartedAt !== null) metrics.matrix.scopeSwitchMs.push(now() - scopeSwitchStartedAt);
        if (matrixFollowQuestion && calibrationState?.prompt) matrixSelectedHand = calibrationState.prompt.handClass;
        renderMatrix();
      });
      if (!adopted) return null;
      return projection;
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        setMatrixLoading(false, error);
      }
      return null;
    }
  }

  function teacherActionLabel(action) {
    return {
      ask_next: 'Ask next',
      explore_boundary: 'Explore this boundary',
      explore_sparse_region: 'Explore this region',
      inspect_conflict: 'Inspect',
      inspect_transfer: 'Inspect',
      refine_exact_mix: 'Refine exact mix',
    }[action?.kind] ?? 'Open';
  }

  function teacherItem({ title, reason, hands, action }) {
    const item = document.createElement('article');
    item.className = 'calibration-teacher-item';
    const heading = document.createElement('strong');
    heading.textContent = title;
    const copy = document.createElement('p');
    copy.textContent = reason;
    if (hands) {
      const tokens = document.createElement('span');
      tokens.className = 'poker-data-token';
      tokens.dir = 'ltr';
      tokens.textContent = hands;
    copy.append(' · ', tokens);
    }
    item.append(heading, copy);
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ui-button ui-button--tertiary';
      button.dataset.teacherAction = action.kind;
      if (action.handClass) button.dataset.teacherHand = action.handClass;
      if (action.preset) button.dataset.teacherPreset = action.preset;
      button.textContent = translated(teacherActionLabel(action));
      button.setAttribute('aria-label', `${translated(teacherActionLabel(action))}: ${hands || title}`);
      item.append(button);
    }
    return item;
  }

  function teacherEmpty(key) {
    const empty = document.createElement('p');
    empty.className = 'calibration-teacher-empty';
    empty.textContent = translated(key);
    return empty;
  }

  function renderRangeTeacher() {
    if (!rangeTeacherView) return;
    const entry = activeEntry();
    const mode = activeMode();
    query('#calibrationTeacherScope').textContent = entry && mode
      ? `${entry.profile.displayName} · ${mode.displayName} · ${contextSpotLabel()}`
      : '';
    const summary = rangeTeacherView.summary;
    renderConfiguredReadiness({
      state: summary.readinessState,
      profileReady: summary.profileReady,
    });
    query('#calibrationTeacherDirect').textContent = String(summary.directCount);
    query('#calibrationTeacherHigh').textContent = String(summary.inferredHighCount);
    query('#calibrationTeacherMedium').textContent = String(summary.inferredMediumCount);
    query('#calibrationTeacherTransferred').textContent = String(summary.transferredCount);
    query('#calibrationTeacherUncertain').textContent = String(summary.uncertainCount);
    query('#calibrationTeacherUnknown').textContent = String(summary.unknownCount);
    query('#calibrationTeacherConflicting').textContent = String(summary.conflictingCount);

    const recommendation = rangeTeacherView.recommendedAction;
    const recommendationCard = query('#calibrationTeacherRecommendation');
    recommendationCard.hidden = !recommendation;
    if (recommendation) {
      setTranslatedText(query('#calibrationTeacherRecommendationTitle'), recommendation.titleKey);
      setTranslatedText(
        query('#calibrationTeacherRecommendationWhy'),
        recommendation.whyKey,
        recommendation.whyParameters,
      );
      query('#calibrationTeacherRecommendationHand').textContent = recommendation.handClass ?? '';
      const action = query('#calibrationTeacherRecommendationAction');
      action.textContent = translated(teacherActionLabel(recommendation));
      action.dataset.teacherAction = recommendation.kind;
      action.dataset.teacherHand = recommendation.handClass ?? '';
      action.dataset.teacherPreset = recommendation.preset ?? '';
      action.dataset.teacherSuggestion = recommendation.suggestionId;
      query('#calibrationTeacherRecommendationDismiss').dataset.teacherSuggestion = recommendation.suggestionId;
      teacherSelectedHand = recommendation.handClass ?? teacherSelectedHand;
    }

    const boundaries = rangeTeacherView.importantBoundaries.map((cluster) => teacherItem({
      title: translated(cluster.labelKey, cluster.labelParameters),
      reason: translated(cluster.whyKey),
      hands: cluster.handClasses.join(' '),
      action: cluster.suggestedAction,
    }));
    query('#calibrationTeacherBoundaries').replaceChildren(...(boundaries.length
      ? boundaries : [teacherEmpty('No important boundary is supported yet.') ]));

    const conflicts = rangeTeacherView.contradictionHotspots.map((hotspot) => teacherItem({
        title: `${hotspot.handClass} · ${translated('Conflicting answers')}`,
      reason: translated(hotspot.whyKey),
      hands: hotspot.evidence.map((entry) => (
        entry.dominantAction ? actionLabel(entry.dominantAction) : translated('Exact mix')
      )).join(' / '),
      action: hotspot.suggestedActions[0],
    }));
    query('#calibrationTeacherConflicts').replaceChildren(...(conflicts.length
      ? conflicts : [teacherEmpty('No unresolved direct conflicts here.') ]));

    const transferred = rangeTeacherView.transferredInsights.slice(0, 6).map((insight) => teacherItem({
      title: `${insight.handClass} · ${actionLabel(insight.dominantAction.type)}`,
      reason: translated(insight.whyKey),
      hands: `${translated(insight.transferBand)} · ${insight.donorContextKeys.length} ${translated('donor contexts')}`,
      action: { kind: 'inspect_transfer', handClass: insight.handClass },
    }));
    query('#calibrationTeacherTransferredList').replaceChildren(...(transferred.length
      ? transferred : [teacherEmpty('No compatible nearby context is transferring here.') ]));

    const sparse = rangeTeacherView.sparseRegions.map((region) => teacherItem({
      title: translated(region.familyLabel),
      reason: translated(region.whyKey, region.whyParameters),
      hands: region.handClasses.slice(0, 6).join(' '),
      action: region.suggestedAction,
    }));
    query('#calibrationTeacherSparse').replaceChildren(...(sparse.length
      ? sparse : [teacherEmpty('No sparse region needs attention right now.') ]));

    const exactMix = rangeTeacherView.exactMixRefinementCandidates.map((candidate) => teacherItem({
        title: `${candidate.handClass} · ${translated('Refine exact mix')}`,
      reason: translated(candidate.whyKey),
      hands: candidate.handClass,
      action: candidate.suggestedAction,
    }));
    query('#calibrationTeacherMix').replaceChildren(...(exactMix.length
      ? exactMix : [teacherEmpty('No exact-mix refinement stands out right now.') ]));
  }

  function adoptCalibrationTeacher() {
    if (!calibrationState?.rangeTeacherView) return false;
    rangeTeacherView = calibrationState.rangeTeacherView;
    teacherSelectedHand = rangeTeacherView.selectedHand?.handClass ?? teacherSelectedHand;
    renderRangeTeacher();
    return true;
  }

  async function loadRangeTeacher({ force = false } = {}) {
    const scope = currentMatrixScope();
    if (!scope) return null;
    if (!force && dismissedTeacherSuggestions.size === 0 && adoptCalibrationTeacher()) {
      return rangeTeacherView;
    }
    if (matrixWritePending) return rangeTeacherView;
    const lifecycleToken = currentPersonalStrategyToken(scope);
    if (!lifecycleToken) return null;
    const startedAt = now();
    query('#calibrationTeacherPanel').setAttribute('aria-busy', 'true');
    try {
      const view = await application.getRangeTeacherView(scope, {
        session: calibrationState?.session ?? matchingCalibrationSession(),
        selectedHandClass: teacherSelectedHand,
        dismissedSuggestionIds: [...dismissedTeacherSuggestions],
      });
      const adopted = personalStrategyScopeLifecycle.adopt(lifecycleToken, scope, () => {
        rangeTeacherView = view;
        metrics.teacher.viewLoads += 1;
        metrics.teacher.viewPreparationMs.push(now() - startedAt);
        renderRangeTeacher();
      });
      if (!adopted) return null;
      return view;
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationTeacherStatus').textContent = friendlyError(error);
      }
      return null;
    } finally {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationTeacherPanel').setAttribute('aria-busy', 'false');
      }
    }
  }

  function renderPersonalStrategySubview() {
    const teacherActive = personalStrategySubview === 'teacher';
    query('#calibrationTeacherTab').setAttribute('aria-selected', String(teacherActive));
    query('#calibrationTeacherTab').tabIndex = teacherActive ? 0 : -1;
    query('#calibrationMatrixTab').setAttribute('aria-selected', String(!teacherActive));
    query('#calibrationMatrixTab').tabIndex = teacherActive ? -1 : 0;
    query('#calibrationTeacherPanel').hidden = !teacherActive;
    query('#calibrationMatrixPanel').hidden = teacherActive;
  }

  async function setPersonalStrategySubview(view, { handClass = null } = {}) {
    personalStrategySubview = view === 'teacher' ? 'teacher' : 'matrix';
    if (handClass) teacherSelectedHand = handClass;
    renderPersonalStrategySubview();
    if (personalStrategySubview === 'teacher') await loadRangeTeacher({ force: true });
    else {
      await loadMatrixProjection();
      if (handClass) selectMatrixHand(handClass);
    }
  }

  function renderIntentOptions() {
    const sessionIntent = matchingCalibrationSession()?.cursor?.calibrationIntent;
    if (Object.values(RFI_CALIBRATION_INTENTS).includes(sessionIntent)
      && sessionIntent !== RFI_CALIBRATION_INTENTS.EXHAUSTIVE) {
      calibrationIntent = sessionIntent;
    }
    document.querySelectorAll('#calibrationIntentOptions input[name="calibration-intent"]').forEach((input) => {
      input.checked = input.value === calibrationIntent;
    });
  }

  function setState(state) {
    root.dataset.calibrationState = state;
    root.setAttribute('aria-busy', String(state === 'loading'));
    query('#calibrationLoadingState').hidden = state !== 'loading';
    query('#calibrationGuestState').hidden = state !== 'guest';
    query('#calibrationErrorState').hidden = state !== 'error';
    query('#calibrationEmptyState').hidden = state !== 'empty';
    query('#calibrationConfiguredState').hidden = state !== 'configured';
  }

  function syncSnapshot(snapshot) {
    workspace = Object.freeze({ ...workspace, snapshot });
  }

  function setSessionView(view) {
    root.dataset.sessionView = view;
    query('#calibrationQuestionView').hidden = view !== 'questions';
  }

  async function persistSelection() {
    if (!selection) return;
    await application.saveWorkspaceSelection({
      selectedProfileId: selection.profileId,
      activeModeId: selection.modeId,
      context: selection.context,
    });
  }

  function renderProfile() {
    const entry = activeEntry();
    if (!entry) return;
    const mode = activeMode();
    if (mode && mode.id !== selection.modeId) selection.modeId = mode.id;

    const profileSelect = query('#calibrationProfileSelect');
    profileSelect.replaceChildren(...workspace.profiles.map((candidate) => {
      const option = document.createElement('option');
      option.value = candidate.profile.id;
      option.textContent = candidate.profile.displayName;
      option.dir = 'auto';
      option.selected = candidate.profile.id === entry.profile.id;
      return option;
    }));
    query('#calibrationProfileName').textContent = entry.profile.displayName;
    query('#calibrationProfileDescription').textContent = entry.profile.description
      || translated('A named poker environment with three ways you play.');

    const modeContainer = query('#calibrationModeOptions');
    modeContainer.replaceChildren(...entry.modes.map((candidate) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calibration-mode-option';
      button.dataset.modeId = candidate.id;
      button.setAttribute('role', 'radio');
      button.dir = 'auto';
      const checked = candidate.id === selection.modeId;
      button.setAttribute('aria-checked', String(checked));
      button.tabIndex = checked ? 0 : -1;
      button.textContent = candidate.displayName;
      return button;
    }));
  }

  function renderContextControls() {
    const context = selection.context;
    const environment = query('#calibrationEnvironment');
    const family = query('#calibrationDecisionFamily');
    const table = query('#calibrationTableSize');
    const position = query('#calibrationHeroPosition');
    const stack = query('#calibrationEffectiveStack');
    environment.value = context.environment;
    family.value = context.decisionFamily;

    table.replaceChildren(...tableSizesForEnvironment(context.environment).map((size) => {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = translated('analysis.value.tableSize', { count: size });
      option.selected = size === context.tableSize;
      return option;
    }));
    position.replaceChildren(...positionsForPreflopCalibrationFamily(
      context.tableSize,
      context.decisionFamily,
    ).map((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      option.selected = name === context.heroPosition;
      return option;
    }));
    stack.value = String(context.effectiveStackBb);
    stack.removeAttribute('aria-invalid');
    query('#calibrationStackError').textContent = '';
  }

  function contextSpotLabel(contextSelection = selection.context) {
    return `${contextSelection.tableSize}-max · ${contextSelection.heroPosition} · ${contextSelection.effectiveStackBb}bb · ${decisionFamilyLabel(contextSelection.decisionFamily)}`;
  }

  function contextFact(label, value) {
    const item = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = translated(label);
    detail.textContent = value;
    item.append(term, detail);
    return item;
  }

  function priorAggressionLabel(aggression) {
    const key = {
      open: 'Open to {size}bb',
      three_bet: '3-bet to {size}bb',
      four_bet: '4-bet to {size}bb',
    }[aggression.level] ?? '{level} to {size}bb';
    return translated(key, {
      level: aggression.level,
      size: aggression.raiseToBb,
    });
  }

  function renderContextFacts(context, target = '#calibrationContextFacts') {
    const facts = [
      contextFact('Table size', translated('analysis.value.tableSize', { count: context.tableSize })),
      contextFact('Hero position', context.heroPosition),
      contextFact('Effective stack', `${context.stack.valueBb}bb`),
      contextFact('Decision family', decisionFamilyLabel(context.decisionFamily)),
    ];
    if (context.priorAction.lastAggression) {
      facts.push(contextFact('Prior aggression', priorAggressionLabel(
        context.priorAction.lastAggression,
      )));
      facts.push(contextFact('Facing size', `${context.facing.sizeBb}bb`));
    }
    if (context.facing.callAmountBb > 0) {
      facts.push(contextFact('Call amount', `${context.facing.callAmountBb}bb`));
    }
    query(target).replaceChildren(...facts);
  }

  function renderDerivedContext() {
    const entry = activeEntry();
    const mode = activeMode();
    if (!entry || !mode) return;
    const context = createContextFromSelection(selection.context);
    const totalDeduction = context.gameRules.collection.amountPerPlayerBb * context.tableSize;
    query('#calibrationAccounting').textContent = selection.context.environment === CALIBRATION_ENVIRONMENTS.CLUBGG
      ? translated('ClubGG · 0.1 bb per seated player · {total} bb total deduction', { total: totalDeduction.toFixed(1) })
      : translated('Home · no rake or deduction');
    query('#calibrationPreviewIdentity').textContent = `${entry.profile.displayName} · ${mode.displayName}`;
    query('#calibrationPreviewSpot').textContent = contextSpotLabel();
    renderContextFacts(context);
    query('#calibrationProfileCount').textContent = String(workspace.profiles.length);
    query('#calibrationProgressMode').textContent = mode.displayName;
    const observationCount = countCurrentDirectObservations(workspace.snapshot, {
      profileId: entry.profile.id,
      modeId: mode.id,
      context,
    });
    query('#calibrationObservationCount').textContent = String(observationCount);
    setTranslatedText(query('#calibrationStartQuestions'), observationCount > 0
      ? 'Resume questions'
      : 'Start questions');
    setTranslatedText(query('#calibrationProfileReadiness'), 'Checking profile');
    const noteKey = observationCount === 0
      ? 'No direct answers have been recorded for this range yet.'
      : '{count} direct answers are already recorded for this range.';
    setTranslatedText(query('#calibrationObservationNote'), noteKey, { count: observationCount });
  }

  function readinessStateKey(readiness) {
    if (readiness?.state === 'conflicted') return 'Profile needs conflict review';
    if (readiness?.state === 'refining') return 'Refining your profile';
    if (readiness?.profileReady || readiness?.state === 'ready') return 'Profile ready';
    return 'Building your profile';
  }

  function renderConfiguredReadiness(readiness) {
    if (!readiness) return;
    setTranslatedText(query('#calibrationProfileReadiness'), readinessStateKey(readiness));
    if (readiness.profileReady || readiness.state === 'ready' || readiness.state === 'refining') {
      setTranslatedText(query('#calibrationStartQuestions'), 'Continue refining');
    }
  }

  function renderConfigured({ controls = true } = {}) {
    setState('configured');
    setSessionView('configuration');
    renderProfile();
    renderIntentOptions();
    if (controls) renderContextControls();
    renderDerivedContext();
    const scopeSwitchStartedAt = pendingMatrixScopeSwitchStartedAt;
    pendingMatrixScopeSwitchStartedAt = null;
    renderPersonalStrategySubview();
    if (personalStrategySubview === 'teacher') void loadRangeTeacher({ force: true });
    else void loadMatrixProjection({ scopeSwitchStartedAt });
  }

  function actionLabel(
    actionType,
    decisionFamily = selection?.context?.decisionFamily,
    heroPosition = selection?.context?.heroPosition,
  ) {
    const key = actionType === 'call'
      && decisionFamily === CALIBRATION_DECISION_FAMILIES.PREFLOP_RFI
      ? heroPosition === 'SB' ? 'Complete' : 'Limp'
      : {
        fold: 'Fold',
        check: 'Check',
        call: 'Call',
        raise: 'Raise',
        all_in: 'All-in',
      }[actionType] ?? actionType;
    return translated(key);
  }

  function renderQuestionActions() {
    const actions = calibrationState?.availableActions ?? RFI_CALIBRATION_ACTIONS;
    const grid = query('#calibrationActionGrid');
    grid.style.setProperty('--calibration-action-count', String(actions.length));
    grid.replaceChildren(...actions.map((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `calibration-action-button calibration-action-button--${action.type.replace('_', '-')}`;
      button.dataset.calibrationAction = action.type;
      const label = document.createElement('span');
      label.textContent = actionLabel(action.type);
      const shortcut = document.createElement('kbd');
      shortcut.textContent = action.shortcut;
      button.append(label, shortcut);
      return button;
    }));
  }

  function previousAnswerLabel(observation) {
    if (observation.dominantAction) return actionLabel(observation.dominantAction.type);
    return observation.frequencies.map((entry) => (
      `${Number((entry.probability * 100).toFixed(6))}% ${actionLabel(entry.action.type)}`
    )).join(' \u00b7 ');
  }

  function completionCopy(assessment) {
    if (assessment.profileReadiness.state === 'conflicted') {
      return {
        title: 'Profile needs conflict review',
        summary: 'Direct answers conflict; review them before relying on this approximation.',
      };
    }
    if (assessment.profileReadiness.profileReady
      || assessment.stopReason === RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE) {
      return {
        title: 'Your starter profile is ready',
        summary: 'Review this useful approximation, continue with a bounded clarification batch, or stop for now.',
      };
    }
    if (assessment.stopReason === RFI_CALIBRATION_STOP_REASONS.NO_USEFUL_CANDIDATES) {
      return {
        title: 'Building your profile',
        summary: 'You can review this range or continue later after the evidence changes.',
      };
    }
    return {
      title: 'Building your profile',
      summary: 'Your answers are saved. Continue questions for broader evidence, or stop for now.',
    };
  }

  function renderQuestion() {
    if (!calibrationState) return;
    const entry = activeEntry();
    const mode = activeMode();
    if (!entry || !mode) return;
    setState('configured');
    setSessionView('questions');
    root.dataset.sessionState = calibrationState.session.state;
    query('#calibrationQuestionIdentity').textContent = `${entry.profile.displayName} · ${mode.displayName}`;
    query('#calibrationQuestionSpot').textContent = contextSpotLabel();
    renderContextFacts(calibrationState.session.contextScope, '#calibrationQuestionContextFacts');
    const contextChanged = query('#calibrationContextChanged');
    const transition = calibrationState.contextTransition;
    contextChanged.hidden = !transition;
    if (transition) {
      query('#calibrationContextChangedFacts').textContent = contextSpotLabel(transition.toSelection);
      query('#calibrationContextChangedReason').textContent = translated(
        transition.reasonKey ?? 'Checking whether your range differs in this context.',
        transition.reasonParameters,
      );
    }
    query('#calibrationFirstUseEducation').hidden = !educationVisible;

    const {
      prompt,
      previousAnswer,
      progressAssessment,
      questionExplanation,
    } = calibrationState;
    const complete = prompt === null;
    query('#calibrationActiveQuestion').hidden = complete;
    query('#calibrationCompleteState').hidden = !complete;
    if (!complete) {
      renderQuestionActions();
      query('#calibrationQuestionTitle').textContent = prompt.handClass;
      renderQuestionCards(prompt.handClass);
      const kindKey = prompt.handClass.length === 2 ? 'Pair' : (prompt.handClass.endsWith('s') ? 'Suited' : 'Offsuit');
      setTranslatedText(query('#calibrationQuestionKind'), kindKey);
      setTranslatedText(
        query('#calibrationQuestionReason'),
        questionExplanation?.messageKey ?? 'Reduces uncertainty here',
      );
      query('#calibrationAnswerError').textContent = '';
    }
    const readiness = progressAssessment.profileReadiness;
    setTranslatedText(query('#calibrationReadinessState'), readinessStateKey(readiness));
    const readinessReason = readiness.state === 'conflicted'
      ? 'Direct answers conflict; review them before relying on this approximation.'
      : readiness.partialActionModel
        ? 'Fold/Raise patterns are modeled; Limp/Complete and All-in remain uncertain unless answered directly.'
      : readiness.profileReady && readiness.state === 'refining'
        ? 'Your profile is usable; questions now target uncertainty, boundaries, and conflicts.'
        : readiness.profileReady
          ? 'Riverline has a useful first approximation.'
          : readiness.reasons[0]?.messageKey
            ?? 'Riverline still needs evidence across a few important regions.';
    setTranslatedText(query('#calibrationReadinessReason'), readinessReason);
    setTranslatedText(query('#calibrationQuestionProgress'), '{direct} direct · {modeled} modeled hands', {
      direct: progressAssessment.directCount,
      modeled: progressAssessment.modeledHandCount,
    });
    setTranslatedText(query('#calibrationRecommendedClarifications'), '{count} recommended clarifications', {
      count: progressAssessment.recommendedClarificationCount,
    });
    query('#calibrationDirectCount').textContent = String(progressAssessment.directCount);
    query('#calibrationLocallyInferredCount').textContent = String(progressAssessment.locallyInferredCount);
    query('#calibrationTransferredCount').textContent = String(progressAssessment.transferredCount);
    query('#calibrationUncertainCount').textContent = String(progressAssessment.uncertainCount);
    query('#calibrationUnknownCount').textContent = String(progressAssessment.visibleUnknownCount);
    query('#calibrationConflictingCount').textContent = String(progressAssessment.conflictingCount);
    query('#calibrationPreviousAnswer').hidden = !previousAnswer;
    if (previousAnswer) {
      query('#calibrationPreviousHand').textContent = previousAnswer.handClass;
      query('#calibrationPreviousAction').textContent = previousAnswerLabel(previousAnswer);
    }
    if (complete) {
      const copy = completionCopy(progressAssessment);
      setTranslatedText(query('#calibrationCompleteTitle'), copy.title);
      setTranslatedText(query('#calibrationCompleteSummary'), copy.summary, copy.parameters);
      query('#calibrationCompleteDirectCount').textContent = String(progressAssessment.directCount);
      query('#calibrationCompleteModeledCount').textContent = String(progressAssessment.modeledHandCount);
      query('#calibrationCompleteUncertainRegionCount').textContent = String(
        readiness.uncertainRegionCount,
      );
      query('#calibrationCompleteClarificationCount').textContent = String(
        progressAssessment.recommendedClarificationCount,
      );
      const canContinue = readiness.profileReady
        ? calibrationState.candidateRanking.some((candidate) => (
          candidate.ordinaryQuestionEligible && candidate.recommendedClarification
        ))
        : calibrationState.candidateRanking.some((candidate) => candidate.ordinaryQuestionEligible);
      query('#calibrationAskAnother').hidden = !canContinue;
      setTranslatedText(
        query('#calibrationAskAnother'),
        readiness.profileReady ? 'Continue refining' : 'Continue questions',
      );
    }
    if (personalStrategySubview === 'teacher') {
      if (dismissedTeacherSuggestions.size) void loadRangeTeacher({ force: true });
      else adoptCalibrationTeacher();
    }
    else adoptCalibrationMatrix();
  }

  function renderQuestionCards(handClass) {
    const target = query('#calibrationQuestionCards');
    const rankStyle = document.documentElement.dataset.cardRankStyle ?? 'poker';
    if (target.dataset.handClass === handClass && target.dataset.rankStyle === rankStyle) return;
    const representative = representativeCardsForHandClass(handClass);
    const cards = representative.cards.map((card) => {
      const element = document.createElement('span');
      element.className = `training-readonly-card riverline-card card--suit-${card.suitId}`;
      element.dataset.cardSize = 'representative';
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', card.accessibleLabel);
      appendCardFaceContents(element, {
        rank: card.rank,
        suit: card.suitId,
        rankStyle,
      });
      return element;
    });
    target.dataset.handClass = handClass;
    target.dataset.rankStyle = rankStyle;
    target.setAttribute('aria-label', representative.accessibleLabel);
    target.replaceChildren(...cards);
  }

  function renderUserDirectedQuestionPreview(handClass) {
    query('#calibrationActiveQuestion').hidden = false;
    query('#calibrationCompleteState').hidden = true;
    query('#calibrationQuestionTitle').textContent = handClass;
    renderQuestionCards(handClass);
    const kindKey = handClass.length === 2 ? 'Pair' : (handClass.endsWith('s') ? 'Suited' : 'Offsuit');
    setTranslatedText(query('#calibrationQuestionKind'), kindKey);
    setTranslatedText(query('#calibrationQuestionReason'), 'Selected from your Matrix');
    query('#calibrationAnswerError').textContent = '';
  }

  function setAnswerControlsDisabled(disabled) {
    query('#calibrationActionGrid').querySelectorAll('[data-calibration-action]')
      .forEach((button) => { button.disabled = disabled; });
    query('#calibrationOpenMix').disabled = disabled;
    query('#calibrationSkipQuestion').disabled = disabled;
    query('#calibrationNotSure').disabled = disabled;
    query('#calibrationUndoAnswer').disabled = disabled;
  }

  function setAnswerPending(pending, generation = null) {
    if (!pending && generation !== null && answerPendingGeneration !== generation) return;
    answerPending = pending;
    answerPendingGeneration = pending ? generation : null;
    setAnswerControlsDisabled(pending || Boolean(failedAnswer));
    query('#calibrationRetryAnswer').disabled = pending;
    query('#calibrationMixRetry').disabled = pending;
    query('#calibrationMixSave').disabled = pending || Boolean(failedAnswer);
    query('#calibrationMixSlider').disabled = pending || Boolean(failedAnswer);
    query('#calibrationMultiMix').querySelectorAll('input').forEach((input) => {
      input.disabled = pending || Boolean(failedAnswer);
    });
    query('#calibrationQuestionRegion')?.setAttribute('aria-busy', String(pending));
    root.dataset.persistenceState = pending ? 'pending' : (failedAnswer ? 'failed' : 'ready');
  }

  async function enterQuestions() {
    if (!await validateAndSaveStack({ reloadPersonalStrategy: false })) return;
    const scope = currentMatrixScope();
    if (!scope) return;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    try {
      failedAnswer = null;
      query('#calibrationRetryAnswer').hidden = true;
      const nextState = await application.startOrResumeSession({
        selectedProfileId: selection.profileId,
        activeModeId: selection.modeId,
        context: selection.context,
        intent: calibrationIntent,
        continueAfterStop: true,
      });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      calibrationState = nextState;
      syncSnapshot(calibrationState.snapshot);
      educationVisible = calibrationState.progressAssessment.directCount === 0;
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        notify(friendlyError(error), 'error');
      }
    }
  }

  async function openTeacherMatrix(handClass, { builder = false } = {}) {
    await setPersonalStrategySubview('matrix', { handClass });
    if (!handClass && rangeTeacherView?.selectedHand?.handClass) {
      selectMatrixHand(rangeTeacherView.selectedHand.handClass);
    }
    if (builder) {
      builderActive = true;
      const selected = handClass ?? matrixSelectedHand;
      if (selected) setBuilderSelection([selected], { primary: selected });
      renderBuilderMode();
      query('#calibrationBuilderToolbar').focus?.({ preventScroll: true });
    } else query('#calibrationMatrixPanel').focus?.({ preventScroll: true });
  }

  async function enterTeacherSession(preset, handClass = null) {
    if (preset === RANGE_TEACHER_SESSION_PRESETS.CONFLICTS) {
      const conflictHand = handClass ?? rangeTeacherView?.contradictionHotspots[0]?.handClass;
      if (conflictHand) await openTeacherMatrix(conflictHand);
      else query('#calibrationTeacherStatus').textContent = translated('No unresolved direct conflicts here.');
      return;
    }
    if (!await validateAndSaveStack({ reloadPersonalStrategy: false })) return;
    const scope = currentMatrixScope();
    if (!scope) return;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    const startedAt = now();
    try {
      let nextState;
      if (calibrationState) {
        nextState = await application.requestRangeTeacherSession(calibrationState, {
          preset,
          handClass,
        });
      } else {
        nextState = await application.startOrResumeSession({
          selectedProfileId: selection.profileId,
          activeModeId: selection.modeId,
          context: selection.context,
          rangeTeacherPreset: preset,
          forcedHandClass: handClass,
          continueAfterStop: true,
        });
      }
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      calibrationState = nextState;
      syncSnapshot(calibrationState.snapshot);
      educationVisible = calibrationState.progressAssessment.directCount === 0;
      metrics.teacher.actionToQuestionMs.push(now() - startedAt);
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationTeacherStatus').textContent = friendlyError(error);
      }
    }
  }

  async function performTeacherAction({ kind, handClass = null, preset = null } = {}) {
    teacherSelectedHand = handClass ?? teacherSelectedHand;
    if (kind === 'inspect_conflict' || kind === 'inspect_transfer') {
      await openTeacherMatrix(handClass);
      return;
    }
    if (kind === 'refine_exact_mix') {
      await openTeacherMatrix(handClass);
      openMixEditor('matrix');
      return;
    }
    if (['ask_next', 'explore_boundary', 'explore_sparse_region'].includes(kind)) {
      await enterTeacherSession(preset ?? RANGE_TEACHER_SESSION_PRESETS.QUICK_PROFILE, handClass);
    }
  }

  function recordInteractionSample(startedAt, renderStartedAt) {
    const operation = calibrationState?.operationMetrics || {};
    interactionSamples.push({
      inputHandlerMs: operation.totalOperationMs ?? 0,
      repositoryTransactionMs: operation.repositoryTransactionMs ?? 0,
      nextQuestionResolutionMs: operation.nextQuestionResolutionMs ?? 0,
      renderUpdateMs: now() - renderStartedAt,
      totalInputToNextPromptMs: now() - startedAt,
    });
  }

  async function acceptAnswer({ actionType = null, mix = null } = {}, { retry = false } = {}) {
    if (!calibrationState?.prompt || answerPending) return false;
    const scope = currentMatrixScope();
    if (!scope) return false;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    const startedAt = now();
    const command = retry && failedAnswer
      ? failedAnswer
      : {
        state: calibrationState,
        input: { actionType, mix },
        operation: application.createAnswerOperation(calibrationState),
      };
    setAnswerPending(true, lifecycleToken.generation);
    try {
      lastAnswerError = null;
      const nextState = await application.answerCalibrationQuestion(command.state, {
        ...command.input,
        ...command.operation,
      });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return false;
      calibrationState = nextState;
      failedAnswer = null;
      query('#calibrationRetryAnswer').hidden = true;
      query('#calibrationMixRetry').hidden = true;
      syncSnapshot(nextState.snapshot);
      educationVisible = false;
      const renderStartedAt = now();
      renderQuestion();
      recordInteractionSample(startedAt, renderStartedAt);
      if (!nextState.prompt) {
        window.requestAnimationFrame(() => query('#calibrationReturnToContext')?.focus?.({ preventScroll: true }));
      }
      return true;
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        lastAnswerError = error;
        const invalidDistribution = isInvalidRfiMixError(error);
        failedAnswer = invalidDistribution ? null : command;
        query('#calibrationAnswerError').textContent = friendlyError(error);
        const mixVisible = !query('#calibrationMixDialog').hidden;
        query('#calibrationRetryAnswer').hidden = invalidDistribution || mixVisible;
        query('#calibrationMixRetry').hidden = invalidDistribution || !mixVisible;
      }
      return false;
    } finally {
      setAnswerPending(false, lifecycleToken.generation);
    }
  }

  async function undoAnswer() {
    if (!calibrationState?.previousAnswer || answerPending) return;
    const scope = currentMatrixScope();
    if (!scope) return;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    setAnswerPending(true, lifecycleToken.generation);
    try {
      const nextState = await application.undoPreviousAnswer(calibrationState, {
        operationId: application.createAnswerOperation(calibrationState).operationId,
      });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      calibrationState = nextState;
      syncSnapshot(calibrationState.snapshot);
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationAnswerError').textContent = friendlyError(error);
      }
    } finally {
      setAnswerPending(false, lifecycleToken.generation);
    }
  }

  async function pauseQuestions({ restoreFocus = true } = {}) {
    if (!calibrationState || answerPending) return false;
    const scope = currentMatrixScope();
    const lifecycleToken = scope ? beginPersonalStrategyMutation(scope) : null;
    if (!lifecycleToken) return false;
    try {
      const nextState = await application.pauseSession(calibrationState);
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return false;
      syncSnapshot(nextState.snapshot);
      calibrationState = null;
      renderConfigured();
      if (restoreFocus) query('#calibrationStartQuestions')?.focus?.({ preventScroll: true });
      return true;
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationAnswerError').textContent = friendlyError(error);
      }
      return false;
    }
  }

  function reviewCompletedProfile() {
    return openCalibrationProfileReview({
      leaveCheckpoint: pauseQuestions,
      openMatrix: setPersonalStrategySubview,
      matrixPanel: query('#calibrationMatrixPanel'),
      matrixTab: query('#calibrationMatrixTab'),
    });
  }

  async function stopQuestions() {
    if (!calibrationState || answerPending) return;
    const scope = currentMatrixScope();
    const lifecycleToken = scope ? beginPersonalStrategyMutation(scope) : null;
    if (!lifecycleToken) return;
    try {
      const nextState = await application.stopSession(calibrationState);
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      syncSnapshot(nextState.snapshot);
      calibrationState = null;
      renderConfigured();
      query('#calibrationStartQuestions')?.focus?.({ preventScroll: true });
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationAnswerError').textContent = friendlyError(error);
      }
    }
  }

  async function skipQuestion(notSure = false) {
    if (!calibrationState?.prompt || answerPending) return;
    const scope = currentMatrixScope();
    if (!scope) return;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    setAnswerPending(true, lifecycleToken.generation);
    try {
      const nextState = await application.skipCalibrationQuestion(calibrationState, { notSure });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      calibrationState = nextState;
      syncSnapshot(calibrationState.snapshot);
      educationVisible = false;
      renderQuestion();
      if (calibrationState.prompt) {
        window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
      }
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationAnswerError').textContent = friendlyError(error);
      }
    } finally {
      setAnswerPending(false, lifecycleToken.generation);
    }
  }

  async function askAnotherQuestion() {
    if (!calibrationState || answerPending) return;
    const scope = currentMatrixScope();
    if (!scope) return;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    setAnswerPending(true, lifecycleToken.generation);
    try {
      const nextState = await application.requestAdditionalQuestion(calibrationState);
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      calibrationState = nextState;
      syncSnapshot(calibrationState.snapshot);
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        notify(friendlyError(error), 'error');
      }
    } finally {
      setAnswerPending(false, lifecycleToken.generation);
    }
  }

  function patchWorkspaceWithObservations(acceptedObservations, metadata) {
    const observations = [...workspace.snapshot.rangeObservations];
    acceptedObservations.forEach((observation) => {
      const logicalIndex = observations.findIndex((entry) => (
        entry.profileId === observation.profileId
        && entry.modeId === observation.modeId
        && entry.handClass === observation.handClass
        && JSON.stringify(entry.context) === JSON.stringify(observation.context)
      ));
      if (logicalIndex >= 0) observations[logicalIndex] = observation;
      else observations.push(observation);
    });
    workspace = Object.freeze({
      ...workspace,
      snapshot: Object.freeze({
        ...workspace.snapshot,
        revision: metadata.revision,
        updatedAt: metadata.updatedAt,
        rangeObservations: Object.freeze(observations),
      }),
    });
  }

  function setMatrixWritePending(pending, generation = null) {
    if (!pending && generation !== null && matrixWritePendingGeneration !== generation) return;
    matrixWritePending = pending;
    matrixWritePendingGeneration = pending ? generation : null;
    query('#calibrationMatrixInspector').setAttribute('aria-busy', String(pending));
    renderMatrixInspector();
    if (builderActive) renderBuilderSummary();
  }

  async function recordMatrixAnswer({ actionType = null, mix = null } = {}) {
    const cell = matrixCell(matrixSelectedHand);
    const scope = currentMatrixScope();
    if (!cell || !scope || matrixWritePending) return false;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    const startedAt = now();
    setMatrixWritePending(true, lifecycleToken.generation);
    try {
      const result = await application.recordPersonalStrategyMatrixEvidence(calibrationState, {
        ...scope,
        handClass: cell.handClass,
        actionType,
        mix,
      });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return false;
      patchWorkspaceWithObservations([result.acceptedObservation], result.metadata);
      if (result.calibrationState) {
        calibrationState = result.calibrationState;
        syncSnapshot(calibrationState.snapshot);
        renderQuestion();
      } else {
        matrixProjection = result.matrixProjection;
        renderDerivedContext();
        renderMatrix();
      }
      selectMatrixHand(cell.handClass);
      metrics.matrix.correctionToRecomputeMs.push(now() - startedAt);
      notify(translated('Personal Strategy updated.'), 'success');
      return true;
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationMatrixError').hidden = false;
        query('#calibrationMatrixError').textContent = friendlyError(error);
      }
      return false;
    } finally {
      setMatrixWritePending(false, lifecycleToken.generation);
    }
  }

  function builderOperationLabel(operationKind) {
    return translated({
      dominant_fold: 'Dominant Fold',
      dominant_raise: 'Dominant Raise',
      pure_fold: 'Pure Fold',
      pure_raise: 'Pure Raise',
      exact_mix: 'Exact Mix',
      clear_builder_edit: 'Clear Builder edit',
    }[operationKind] ?? operationKind);
  }

  function adoptBuilderResult(result) {
    if (result.calibrationState) {
      calibrationState = result.calibrationState;
      workspace = Object.freeze({ ...workspace, snapshot: calibrationState.snapshot });
      syncSnapshot(calibrationState.snapshot);
      renderQuestion();
    } else if (result.metadata) {
      patchWorkspaceWithObservations(result.acceptedObservations, result.metadata);
    }
    matrixProjection = result.matrixProjection;
    renderDerivedContext();
    renderMatrix();
  }

  async function applyBuilderOperation(operationKind, { mix = null, handClasses = null } = {}) {
    const scope = currentMatrixScope();
    const selected = handClasses ?? selectedBuilderHands();
    if (!scope || !selected.length || matrixWritePending) return false;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    setMatrixWritePending(true, lifecycleToken.generation);
    query('#calibrationBuilderFeedback').textContent = '';
    try {
      const result = await application.applyRangeBuilderOperation(calibrationState, scope, {
        handClasses: selected,
        operationKind,
        mix,
      });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return false;
      adoptBuilderResult(result);
      const updated = result.updatedHandClasses.length;
      const skipped = result.skippedConflictHandClasses.length;
      const unsupported = result.skippedUnsupportedHandClasses.length;
      query('#calibrationBuilderFeedback').textContent = skipped
        ? translated('{count} hands updated · {skipped} conflicts skipped', { count: updated, skipped })
        : unsupported
          ? translated('{count} hands updated · {skipped} unsupported edits skipped', { count: updated, skipped: unsupported })
          : translated('{count} hands updated', { count: updated });
      if (result.operation) {
        builderHistory.unshift({
          operation: result.operation,
          undone: false,
          text: translated('{operation} on {count} hands', {
            operation: builderOperationLabel(operationKind),
            count: updated,
          }),
        });
        builderHistory.splice(20);
      }
      renderBuilderSummary();
      return updated > 0;
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationBuilderFeedback').textContent = friendlyError(error);
      }
      return false;
    } finally {
      setMatrixWritePending(false, lifecycleToken.generation);
    }
  }

  async function undoBuilderOperation() {
    const entry = builderHistory.find((item) => item.operation && !item.undone);
    const scope = currentMatrixScope();
    if (!entry || !scope || matrixWritePending) return;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    setMatrixWritePending(true, lifecycleToken.generation);
    try {
      const result = await application.undoRangeBuilderOperation(
        calibrationState,
        scope,
        entry.operation,
      );
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      entry.undone = true;
      adoptBuilderResult(result);
      builderHistory.unshift({
        operation: null,
        undone: true,
        text: translated('Undid {count}-hand Builder edit', { count: result.updatedHandClasses.length }),
      });
      builderHistory.splice(20);
      query('#calibrationBuilderFeedback').textContent = translated('Undid {count}-hand Builder edit', {
        count: result.updatedHandClasses.length,
      });
      renderBuilderSummary();
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        query('#calibrationBuilderFeedback').textContent = friendlyError(error);
      }
    } finally {
      setMatrixWritePending(false, lifecycleToken.generation);
    }
  }

  async function askSelectedMatrixHandNext(handClass = matrixSelectedHand) {
    if (!calibrationState || !handClass || matrixWritePending) return;
    const scope = currentMatrixScope();
    if (!scope) return;
    const lifecycleToken = beginPersonalStrategyMutation(scope);
    setMatrixWritePending(true, lifecycleToken.generation);
    setAnswerControlsDisabled(true);
    query('#calibrationQuestionRegion').setAttribute('aria-busy', 'true');
    renderUserDirectedQuestionPreview(handClass);
    try {
      const nextState = await application.requestPersonalStrategyMatrixQuestion(
        calibrationState,
        handClass,
      );
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) return;
      calibrationState = nextState;
      syncSnapshot(calibrationState.snapshot);
      matrixFollowQuestion = true;
      renderQuestion();
      query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true });
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        renderQuestion();
        query('#calibrationMatrixError').hidden = false;
        query('#calibrationMatrixError').textContent = friendlyError(error);
      }
    } finally {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, scope)) {
        setAnswerControlsDisabled(answerPending || Boolean(failedAnswer));
        query('#calibrationQuestionRegion').setAttribute('aria-busy', String(answerPending));
      }
      setMatrixWritePending(false, lifecycleToken.generation);
    }
  }

  async function switchCalibrationContext(context, {
    reasonKey = 'Checking whether your range differs in this context.',
    reasonParameters = null,
  } = {}) {
    if (!calibrationState || answerPending || matrixWritePending) return false;
    const fromScope = currentMatrixScope();
    if (!fromScope) return false;
    const lifecycleToken = beginPersonalStrategyMutation(fromScope);
    try {
      const nextState = await application.switchCalibrationContext(calibrationState, {
        context,
        reasonKey,
        reasonParameters,
      });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, fromScope)) return false;
      await application.saveWorkspaceSelection({
        selectedProfileId: selection.profileId,
        activeModeId: selection.modeId,
        context: nextState.contextTransition.toSelection,
      });
      if (!personalStrategyScopeLifecycle.isCurrent(lifecycleToken, fromScope)) return false;
      selection.context = { ...nextState.contextTransition.toSelection };
      activateCurrentPersonalStrategyScope();
      calibrationState = nextState;
      syncSnapshot(nextState.snapshot);
      renderContextControls();
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
      return true;
    } catch (error) {
      if (personalStrategyScopeLifecycle.isCurrent(lifecycleToken, fromScope)) {
        notify(friendlyError(error), 'error');
      }
      return false;
    }
  }

  function percentageLabel(value) {
    return `${Number(Number(value).toFixed(6))}%`;
  }

  function currentMixActions() {
    const actions = calibrationState?.availableActions
      ?? matrixProjection?.actionUniverse?.map((action) => ({ type: action.type, shortcut: '' }))
      ?? RFI_CALIBRATION_ACTIONS;
    return actions.map((action) => action.type);
  }

  function multiMixValues() {
    return Object.fromEntries([...query('#calibrationMultiMix').querySelectorAll('[data-mix-action]')]
      .map((input) => [input.dataset.mixAction, Number(input.value)]));
  }

  function setMultiMixValue(actionType, rawValue) {
    const inputs = [...query('#calibrationMultiMix').querySelectorAll('[data-mix-action]')];
    const changed = inputs.find((input) => input.dataset.mixAction === actionType);
    if (!changed) return;
    const nextValues = rebalanceCalibrationMixPercentages(multiMixValues(), actionType, rawValue);
    inputs.forEach((input) => {
      const value = nextValues[input.dataset.mixAction];
      input.value = String(value);
      input.closest('label').querySelector('output').textContent = percentageLabel(value);
    });
    query('#calibrationMixError').textContent = '';
  }

  function renderMultiMix(actions, initial = null) {
    const defaultShare = 100 / actions.length;
    const values = Object.fromEntries(actions.map((action) => [
      action,
      initial?.[action] ?? defaultShare,
    ]));
    const total = Object.values(values).reduce((sum, value) => sum + value, 0);
    if (total !== 100) {
      actions.forEach((action) => { values[action] = values[action] * 100 / total; });
    }
    const rows = actions.map((action, index) => {
      const label = document.createElement('label');
      const name = document.createElement('span');
      const input = document.createElement('input');
      const output = document.createElement('output');
      name.textContent = actionLabel(action);
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.inputMode = 'decimal';
      input.dataset.mixAction = action;
      const value = index === actions.length - 1
        ? 100 - actions.slice(0, -1).reduce((sum, type) => sum + Number(values[type].toFixed(6)), 0)
        : Number(values[action].toFixed(6));
      input.value = String(value);
      output.textContent = percentageLabel(value);
      label.append(name, input, output);
      return label;
    });
    query('#calibrationMultiMix').replaceChildren(...rows);
  }

  function setMixSliderFold(value) {
    const mix = complementaryRfiMixFromFold(value);
    query('#calibrationMixSlider').value = String(mix.fold);
    query('#calibrationMixFoldValue').textContent = percentageLabel(mix.fold);
    query('#calibrationMixRaiseValue').textContent = percentageLabel(mix.raise);
    query('#calibrationMixSlider').setAttribute(
      'aria-valuetext',
      `Fold ${percentageLabel(mix.fold)}, Raise ${percentageLabel(mix.raise)}`,
    );
    query('#calibrationMixError').textContent = '';
    return mix;
  }

  function mixFocusableElements() {
    return [...query('#calibrationMixDialog').querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.offsetParent !== null);
  }

  function openMixEditor(target = 'question') {
    const handClass = target === 'matrix' ? matrixSelectedHand
      : target === 'builder' ? selectedBuilderHands()[0]
        : calibrationState?.prompt?.handClass;
    if (!handClass || (target === 'builder' && builderSelection.size === 0)) return;
    mixTarget = { kind: target, handClass };
    focusBeforeMix = document.activeElement;
    query('#calibrationMixForm').reset();
    query('#calibrationMixError').textContent = '';
    query('#calibrationMixRetry').hidden = true;
    const actions = currentMixActions();
    const multiAction = actions.length > 2;
    let initialFold = 50;
    let initialDistribution = null;
    let initialError = '';
    const selectedCell = target === 'builder' ? null : matrixCell(handClass);
    if (selectedCell?.action.exactFrequencies) {
      const byAction = Object.fromEntries(selectedCell.action.exactFrequencies.map((entry) => [
        entry.action.type,
        Number((entry.probability * 100).toFixed(6)),
      ]));
      initialDistribution = byAction;
      try {
        const savedMix = { fold: byAction.fold ?? 0, raise: byAction.raise ?? 0 };
        normalizeRfiMix(savedMix);
        initialFold = savedMix.fold;
      } catch (error) {
        initialError = friendlyError(error);
      }
    }
    query('#calibrationTwoActionMix').hidden = multiAction;
    query('#calibrationMultiMix').hidden = !multiAction;
    if (multiAction) {
      renderMultiMix(actions, initialDistribution);
      setTranslatedText(query('#calibrationMixHelp'), 'Adjust any action; the remaining actions rebalance so the total stays 100%.');
    } else {
      setMixSliderFold(initialFold);
      setTranslatedText(query('#calibrationMixHelp'), 'Move one slider to set Fold; Raise updates automatically so the exact mix always totals 100%.');
    }
    query('#calibrationMixError').textContent = initialError;
    if (target === 'builder') {
      setTranslatedText(query('#calibrationMixTitle'), 'Set exact mix for {count} selected hands', {
        count: builderSelection.size,
      });
    } else setTranslatedText(query('#calibrationMixTitle'), 'Set frequencies for {hand}', { hand: handClass });
    setTranslatedText(query('#calibrationMixSave'), target === 'question' ? 'Save mix and continue' : 'Save exact mix');
    query('#calibrationMixDialog').hidden = false;
    document.body.classList.add('has-modal-open');
    window.requestAnimationFrame(() => (multiAction
      ? query('#calibrationMultiMix [data-mix-action]')
      : query('#calibrationMixSlider')).focus());
  }

  function closeMixEditor({ restoreFocus = true } = {}) {
    if (query('#calibrationMixDialog').hidden) return;
    query('#calibrationMixDialog').hidden = true;
    if (failedAnswer) {
      query('#calibrationMixRetry').hidden = true;
      query('#calibrationRetryAnswer').hidden = false;
    }
    document.body.classList.remove('has-modal-open');
    mixTarget = null;
    if (restoreFocus) focusBeforeMix?.focus?.({ preventScroll: true });
  }

  async function submitMix(event) {
    event.preventDefault();
    let mix;
    try {
      if (!query('#calibrationMultiMix').hidden) {
        mix = Object.entries(multiMixValues()).map(([type, percentage]) => ({
          action: { type },
          probability: percentage / 100,
        }));
      } else mix = setMixSliderFold(query('#calibrationMixSlider').value);
    }
    catch (error) {
      query('#calibrationMixError').textContent = friendlyError(error);
      return;
    }
    const saved = mixTarget?.kind === 'matrix'
      ? await recordMatrixAnswer({ mix })
      : mixTarget?.kind === 'builder'
        ? await applyBuilderOperation('exact_mix', { mix })
        : await acceptAnswer({ mix });
    if (saved) closeMixEditor({ restoreFocus: false });
    else query('#calibrationMixError').textContent = mixTarget?.kind === 'matrix'
      ? query('#calibrationMatrixError').textContent
      : mixTarget?.kind === 'builder'
        ? query('#calibrationBuilderFeedback').textContent
        : query('#calibrationAnswerError').textContent;
  }

  function render() {
    if (!workspace.profiles.length) {
      selection = null;
      if (personalStrategyScopeLifecycle.capture()) activateCurrentPersonalStrategyScope();
      setState('empty');
      return;
    }
    if (!selection || !activeEntry()) {
      selection = initialSelection(workspace);
      activateCurrentPersonalStrategyScope();
    }
    renderConfigured();
  }

  async function refreshWorkspace(preferredProfileId = selection?.profileId) {
    const previousScopeKey = currentMatrixScopeKey();
    workspace = await application.readWorkspace();
    const entry = selectedEntry(workspace, preferredProfileId) || workspace.profiles[0] || null;
    if (!entry) selection = null;
    else if (!selection || selection.profileId !== entry.profile.id) {
      const preference = workspace.preferences.byProfile[entry.profile.id];
      selection = {
        profileId: entry.profile.id,
        modeId: entry.modes.find((mode) => mode.id === preference?.activeModeId)?.id || entry.modes[0].id,
        context: normalizeRfiContextSelection({ ...preference?.context, actionAware: true }, {
          environmentDefault: profileDefaultEnvironment(entry.profile),
        }),
      };
    }
    const nextScope = currentMatrixScope();
    if (currentMatrixScopeKey() !== previousScopeKey
      || (nextScope && !currentPersonalStrategyToken(nextScope))) {
      activateCurrentPersonalStrategyScope();
    }
    metrics.profileCount = workspace.profiles.length;
    render();
  }

  async function changeProfile(profileId) {
    const entry = selectedEntry(workspace, profileId);
    if (!entry) return;
    pendingMatrixScopeSwitchStartedAt = now();
    const preference = workspace.preferences.byProfile[profileId];
    selection = {
      profileId,
      modeId: entry.modes.find((mode) => mode.id === preference?.activeModeId)?.id || entry.modes[0].id,
      context: normalizeRfiContextSelection({ ...preference?.context, actionAware: true }, {
        environmentDefault: profileDefaultEnvironment(entry.profile),
      }),
    };
    activateCurrentPersonalStrategyScope();
    await persistSelection();
    renderConfigured();
  }

  async function updateContextFromControls({
    announceCorrection = false,
    reloadPersonalStrategy = true,
  } = {}) {
    const previousPosition = selection.context.heroPosition;
    const previousScopeKey = currentMatrixScopeKey();
    pendingMatrixScopeSwitchStartedAt = now();
    const candidate = {
      environment: query('#calibrationEnvironment').value,
      actionAware: true,
      decisionFamily: query('#calibrationDecisionFamily').value,
      tableSize: Number(query('#calibrationTableSize').value),
      heroPosition: query('#calibrationHeroPosition').value,
      effectiveStackBb: Number(query('#calibrationEffectiveStack').value),
    };
    selection.context = normalizeRfiContextSelection(candidate, {
      environmentDefault: selection.context.environment,
    });
    if (currentMatrixScopeKey() !== previousScopeKey) activateCurrentPersonalStrategyScope();
    await persistSelection();
    renderContextControls();
    if (reloadPersonalStrategy) renderConfigured({ controls: false });
    else renderDerivedContext();
    if (announceCorrection && previousPosition !== selection.context.heroPosition) {
      query('#calibrationPositionNotice').textContent = translated(
        '{previous} is not available at this table size. Position changed to {position}.',
        { previous: previousPosition, position: selection.context.heroPosition },
      );
    } else query('#calibrationPositionNotice').textContent = '';
  }

  async function validateAndSaveStack({ reloadPersonalStrategy = true } = {}) {
    const input = query('#calibrationEffectiveStack');
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < RANGE_CALIBRATION_STACK_LIMITS.min || value > RANGE_CALIBRATION_STACK_LIMITS.max) {
      input.setAttribute('aria-invalid', 'true');
      query('#calibrationStackError').textContent = translated(
        'Enter an effective stack from {min} to {max} bb.',
        RANGE_CALIBRATION_STACK_LIMITS,
      );
      return false;
    }
    input.removeAttribute('aria-invalid');
    query('#calibrationStackError').textContent = '';
    await updateContextFromControls({ reloadPersonalStrategy });
    return true;
  }

  function modalFocusableElements() {
    return [...query('#calibrationProfileModal').querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.offsetParent !== null);
  }

  function openProfileEditor(mode) {
    editorMode = mode;
    focusBeforeModal = document.activeElement;
    const entry = activeEntry();
    const modal = query('#calibrationProfileModal');
    const form = query('#calibrationProfileForm');
    form.reset();
    query('#calibrationProfileFormError').hidden = true;
    query('#calibrationProfileFormError').textContent = '';
    const editing = mode === 'edit' && entry;
    const titleKey = editing ? 'Edit strategy profile' : 'Create a strategy profile';
    const submitKey = editing ? 'Save changes' : 'Create profile';
    setTranslatedText(query('#calibrationProfileModalTitle'), titleKey);
    setTranslatedText(query('#calibrationProfileSubmit'), submitKey);
    query('#calibrationProfileEnvironmentField').hidden = Boolean(editing);
    if (editing) {
      query('#calibrationProfileDisplayName').value = entry.profile.displayName;
      query('#calibrationProfileDescription').value = entry.profile.description || '';
      entry.modes.forEach((candidate, index) => { query(`#calibrationModeName${index + 1}`).value = candidate.displayName; });
    } else {
      query('#calibrationProfileEnvironment').value = CALIBRATION_ENVIRONMENTS.HOME;
    }
    modal.classList.add('show');
    document.body.classList.add('has-modal-open');
    window.requestAnimationFrame(() => query('#calibrationProfileDisplayName').focus());
  }

  function closeProfileEditor({ restoreFocus = true } = {}) {
    const modal = query('#calibrationProfileModal');
    if (!modal.classList.contains('show')) return;
    modal.classList.remove('show');
    document.body.classList.remove('has-modal-open');
    if (restoreFocus) focusBeforeModal?.focus?.({ preventScroll: true });
  }

  async function submitProfile(event) {
    event.preventDefault();
    const error = query('#calibrationProfileFormError');
    error.hidden = true;
    try {
      const input = {
        displayName: query('#calibrationProfileDisplayName').value,
        description: query('#calibrationProfileDescription').value,
        environment: query('#calibrationProfileEnvironment').value,
        modeNames: [1, 2, 3].map((index) => query(`#calibrationModeName${index}`).value),
      };
      let profileId;
      if (editorMode === 'edit') {
        profileId = selection.profileId;
        await application.updateProfileConfiguration(profileId, input);
        notify(translated('Profile changes saved.'), 'success');
      } else {
        const bundle = await application.createProfile(input);
        profileId = bundle.profile.id;
        selection = {
          profileId,
          modeId: bundle.modes[0].id,
          context: normalizeRfiContextSelection({ actionAware: true }, { environmentDefault: profileDefaultEnvironment(bundle.profile) }),
        };
        notify(translated('Profile created.'), 'success');
      }
      closeProfileEditor({ restoreFocus: false });
      await refreshWorkspace(profileId);
      await persistSelection();
      query('#calibrationProfileSelect')?.focus?.({ preventScroll: true });
    } catch (caught) {
      error.textContent = friendlyError(caught);
      error.hidden = false;
      query('#calibrationProfileDisplayName').focus();
    }
  }

  function bindEvents() {
    query('#calibrationCreateFirstProfile').addEventListener('click', () => openProfileEditor('create'));
    query('#calibrationCreateProfile').addEventListener('click', () => openProfileEditor('create'));
    query('#calibrationEditProfile').addEventListener('click', () => openProfileEditor('edit'));
    query('#calibrationStartQuestions').addEventListener('click', enterQuestions);
    query('#calibrationTeacherTab').addEventListener('click', () => setPersonalStrategySubview('teacher'));
    query('#calibrationMatrixTab').addEventListener('click', () => setPersonalStrategySubview('matrix'));
    query('.calibration-personal-tabs').addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = personalStrategySubview === 'teacher' ? 'matrix' : 'teacher';
      void setPersonalStrategySubview(next).then(() => query(`#calibration${next === 'teacher' ? 'Teacher' : 'Matrix'}Tab`).focus());
    });
    query('#calibrationTeacherPanel').addEventListener('click', (event) => {
      const preset = event.target.closest('[data-teacher-preset]:not([data-teacher-action])');
      if (preset) {
        void enterTeacherSession(preset.dataset.teacherPreset);
        return;
      }
      const action = event.target.closest('[data-teacher-action]');
      if (!action) return;
      void performTeacherAction({
        kind: action.dataset.teacherAction,
        handClass: action.dataset.teacherHand || null,
        preset: action.dataset.teacherPreset || null,
      });
    });
    query('#calibrationTeacherRecommendationDismiss').addEventListener('click', () => {
      const suggestionId = query('#calibrationTeacherRecommendationDismiss').dataset.teacherSuggestion;
      if (!suggestionId) return;
      dismissedTeacherSuggestions.add(suggestionId);
      void loadRangeTeacher({ force: true });
    });
    query('#calibrationTeacherOpenMatrix').addEventListener('click', () => {
      void openTeacherMatrix(teacherSelectedHand);
    });
    query('#calibrationTeacherOpenBuilder').addEventListener('click', () => {
      void openTeacherMatrix(teacherSelectedHand, { builder: true });
    });
    query('#calibrationTeacherContinue').addEventListener('click', enterQuestions);
    query('#calibrationTeacherStop').addEventListener('click', async () => {
      if (calibrationState) await stopQuestions();
      query('#calibrationTeacherStatus').textContent = translated('Your evidence is saved. Return whenever you want to refine it.');
    });
    query('#calibrationPauseQuestions').addEventListener('click', pauseQuestions);
    query('#calibrationStopQuestions').addEventListener('click', stopQuestions);
    query('#calibrationReturnToContext').addEventListener('click', pauseQuestions);
    query('#calibrationAskAnother').addEventListener('click', askAnotherQuestion);
    query('#calibrationCompleteOpenMatrix').addEventListener('click', () => {
      void reviewCompletedProfile();
    });
    query('#calibrationActionGrid').addEventListener('click', (event) => {
      const button = event.target.closest('[data-calibration-action]');
      if (button) acceptAnswer({ actionType: button.dataset.calibrationAction });
    });
    query('#calibrationRetryAnswer').addEventListener('click', () => acceptAnswer({}, { retry: true }));
    query('#calibrationUndoAnswer').addEventListener('click', undoAnswer);
    query('#calibrationSkipQuestion').addEventListener('click', () => skipQuestion(false));
    query('#calibrationNotSure').addEventListener('click', () => skipQuestion(true));
    query('#calibrationOpenMix').addEventListener('click', () => openMixEditor('question'));
    query('#calibrationMixForm').addEventListener('submit', submitMix);
    query('#calibrationMixRetry').addEventListener('click', async () => {
      if (await acceptAnswer({}, { retry: true })) closeMixEditor({ restoreFocus: false });
      else query('#calibrationMixError').textContent = query('#calibrationAnswerError').textContent;
    });
    query('#calibrationMixClose').addEventListener('click', () => closeMixEditor());
    query('#calibrationMixCancel').addEventListener('click', () => closeMixEditor());
    query('#calibrationMixDialog').addEventListener('click', (event) => {
      if (event.target === query('#calibrationMixDialog')) closeMixEditor();
    });
    query('#calibrationMixDialog').addEventListener('click', (event) => {
      const preset = event.target.closest('[data-mix-fold]');
      if (!preset) return;
      setMixSliderFold(preset.dataset.mixFold);
      query('#calibrationMixSlider').focus();
    });
    query('#calibrationMixSlider').addEventListener('input', (event) => {
      setMixSliderFold(event.target.value);
    });
    query('#calibrationMultiMix').addEventListener('input', (event) => {
      const input = event.target.closest('[data-mix-action]');
      if (input) setMultiMixValue(input.dataset.mixAction, input.value);
    });
    query('#calibrationMixSlider').addEventListener('keydown', (event) => {
      const current = Number(event.currentTarget.value);
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? 100
          : ['ArrowRight', 'ArrowUp'].includes(event.key) ? current + 1
            : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? current - 1
              : event.key === 'PageUp' ? current + 10
                : event.key === 'PageDown' ? current - 10 : null;
      if (next === null) return;
      event.preventDefault();
      setMixSliderFold(Math.max(0, Math.min(100, next)));
    });
    query('#calibrationBuilderToggle').addEventListener('click', () => {
      builderActive = !builderActive;
      matrixFollowQuestion = !builderActive && matrixFollowQuestion;
      if (builderActive && matrixSelectedHand && builderSelection.size === 0) {
        builderSelection.add(matrixSelectedHand);
        builderSelectionAnchor = matrixSelectedHand;
      }
      renderBuilderMode();
      if (builderActive) query('#calibrationBuilderToolbar').focus?.({ preventScroll: true });
    });
    query('#calibrationBuilderToolbar').addEventListener('click', (event) => {
      const brush = event.target.closest('[data-builder-brush]');
      if (brush) {
        builderBrush = brush.dataset.builderBrush;
        renderBuilderMode();
        return;
      }
      const helper = event.target.closest('[data-builder-select]');
      if (helper) {
        const hands = matrixProjection.cells.filter((cell) => (
          helper.dataset.builderSelect === 'all'
          || (helper.dataset.builderSelect === 'pairs' && cell.handClass.length === 2)
          || (helper.dataset.builderSelect === 'suited' && cell.handClass.endsWith('s'))
          || (helper.dataset.builderSelect === 'offsuit' && cell.handClass.endsWith('o'))
        )).map((cell) => cell.handClass);
        setBuilderSelection(hands, { primary: hands[0] ?? null });
        return;
      }
      const operation = event.target.closest('[data-builder-operation]');
      if (operation) {
        const mix = operation.dataset.builderFold === undefined ? null : {
          fold: Number(operation.dataset.builderFold),
          raise: Number(operation.dataset.builderRaise),
        };
        applyBuilderOperation(operation.dataset.builderOperation, { mix });
      }
    });
    query('#calibrationBuilderToolbar').addEventListener('pointerover', (event) => {
      const operation = event.target.closest('[data-builder-operation]');
      if (!operation || operation.contains(event.relatedTarget)) return;
      builderPreviewAction = operation.dataset.builderOperation.includes('fold') ? 'fold'
        : operation.dataset.builderOperation.includes('raise') ? 'raise'
          : operation.dataset.builderOperation === 'exact_mix' ? 'mix' : null;
      syncBuilderSelectionDom();
    });
    query('#calibrationBuilderToolbar').addEventListener('pointerout', (event) => {
      const operation = event.target.closest('[data-builder-operation]');
      if (!operation || operation.contains(event.relatedTarget)) return;
      builderPreviewAction = null;
      syncBuilderSelectionDom();
    });
    query('#calibrationBuilderClearSelection').addEventListener('click', () => {
      setBuilderSelection([]);
      query('#calibrationBuilderFeedback').textContent = '';
    });
    query('#calibrationBuilderMix').addEventListener('click', () => openMixEditor('builder'));
    query('#calibrationBuilderUndo').addEventListener('click', undoBuilderOperation);
    query('#calibrationPersonalStrategyGrid').addEventListener('click', (event) => {
      const cell = event.target.closest('[data-hand-class]');
      if (!cell) return;
      if (!builderActive) {
        selectMatrixHand(cell.dataset.handClass);
        void askSelectedMatrixHandNext(cell.dataset.handClass);
        return;
      }
      if (suppressBuilderClick) {
        suppressBuilderClick = false;
        return;
      }
      const handClass = cell.dataset.handClass;
      if (event.shiftKey && builderSelectionAnchor) {
        const next = new Set(builderSelection);
        rectangleHands(builderSelectionAnchor, handClass).forEach((hand) => next.add(hand));
        setBuilderSelection([...next], { primary: handClass });
      } else if (event.ctrlKey || event.metaKey) {
        const next = new Set(builderSelection);
        if (next.has(handClass)) next.delete(handClass);
        else next.add(handClass);
        setBuilderSelection([...next], { primary: handClass });
      } else setBuilderSelection([handClass], { primary: handClass });
    });
    query('#calibrationPersonalStrategyGrid').addEventListener('pointerdown', (event) => {
      const cell = event.target.closest('[data-hand-class]');
      if (!builderActive || !cell || event.button !== 0 || matrixWritePending) return;
      builderGesture = {
        startHand: cell.dataset.handClass,
        currentHand: cell.dataset.handClass,
        touched: new Set([cell.dataset.handClass]),
        moved: false,
      };
      cell.dataset.builderTouched = 'true';
    });
    query('#calibrationPersonalStrategyGrid').addEventListener('pointerover', (event) => {
      const cell = event.target.closest('[data-hand-class]');
      if (!builderGesture || !cell || event.buttons !== 1) return;
      const handClass = cell.dataset.handClass;
      if (handClass !== builderGesture.currentHand) builderGesture.moved = true;
      builderGesture.currentHand = handClass;
      clearBuilderGesturePreview();
      if (builderBrush === 'select') {
        builderGesture.touched = new Set(rectangleHands(builderGesture.startHand, handClass));
      } else builderGesture.touched.add(handClass);
      builderGesture.touched.forEach((hand) => {
        const button = query(`#calibrationPersonalStrategyGrid [data-hand-class="${hand}"]`);
        if (button) button.dataset.builderTouched = 'true';
      });
    });
    query('#calibrationPersonalStrategyGrid').addEventListener('keydown', (event) => {
      const cell = event.target.closest('[data-hand-class]');
      if (!cell || !matrixProjection) return;
      const current = matrixCell(cell.dataset.handClass);
      if (!current) return;
      if (builderActive && event.key === ' ') {
        event.preventDefault();
        const next = new Set(builderSelection);
        if (next.has(current.handClass)) next.delete(current.handClass);
        else next.add(current.handClass);
        setBuilderSelection([...next], { primary: current.handClass });
        return;
      }
      if (builderActive && ['f', 'r'].includes(event.key.toLowerCase())
        && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (!builderSelection.size) setBuilderSelection([current.handClass], { primary: current.handClass });
        applyBuilderOperation(event.key.toLowerCase() === 'f' ? 'dominant_fold' : 'dominant_raise');
        return;
      }
      const activatesMatrixCell = event.key === 'Enter' || event.key === ' ';
      if (activatesMatrixCell && (!builderActive || event.key === 'Enter')) {
        event.preventDefault();
        selectMatrixHand(current.handClass);
        if (!builderActive) void askSelectedMatrixHandNext(current.handClass);
        return;
      }
      const movements = {
        ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0],
      };
      const movement = movements[event.key];
      if (!movement) return;
      event.preventDefault();
      const row = Math.max(0, Math.min(12, current.row + movement[0]));
      const column = Math.max(0, Math.min(12, current.column + movement[1]));
      selectMatrixHand(matrixProjection.cells[row * 13 + column].handClass, {
        manual: true,
        focus: true,
      });
    });
    query('#calibrationMatrixFilters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-matrix-filter]');
      if (!button || !Object.hasOwn(MATRIX_FILTER_STATUSES, button.dataset.matrixFilter)) return;
      matrixFilter = button.dataset.matrixFilter;
      renderMatrix();
    });
    query('#calibrationMatrixFollow').addEventListener('click', () => {
      matrixFollowQuestion = !matrixFollowQuestion;
      query('#calibrationMatrixFollow').setAttribute('aria-pressed', String(matrixFollowQuestion));
      if (matrixFollowQuestion && calibrationState?.prompt) {
        selectMatrixHand(calibrationState.prompt.handClass);
      }
    });
    query('#calibrationMatrixConfirm').addEventListener('click', () => {
      const cell = matrixCell(matrixSelectedHand);
      if (cell?.action.dominantAction) recordMatrixAnswer({ actionType: cell.action.dominantAction });
    });
    query('#calibrationMatrixFold').addEventListener('click', () => recordMatrixAnswer({ actionType: 'fold' }));
    query('#calibrationMatrixRaise').addEventListener('click', () => recordMatrixAnswer({ actionType: 'raise' }));
    query('#calibrationMatrixContextActions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-matrix-action]');
      if (button) recordMatrixAnswer({ actionType: button.dataset.matrixAction });
    });
    query('#calibrationMatrixMix').addEventListener('click', () => openMixEditor('matrix'));
    query('#calibrationMatrixAskNext').addEventListener('click', askSelectedMatrixHandNext);
    root.addEventListener('keydown', (event) => {
      if (!calibrationState?.prompt || !query('#calibrationMixDialog').hidden) return;
      const target = event.target;
      if (!query('#calibrationQuestionView').contains(target)
        || target.matches('input, textarea, select, [contenteditable="true"]')
        || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const action = calibrationState.availableActions.find((entry) => (
        entry.shortcut.toLowerCase() === event.key.toLowerCase()
      ));
      if (!action) return;
      event.preventDefault();
      acceptAnswer({ actionType: action.type });
    });
    query('#calibrationProfileSelect').addEventListener('change', async (event) => {
      try { await changeProfile(event.target.value); } catch (error) { notify(friendlyError(error), 'error'); }
    });
    query('#calibrationIntentOptions').addEventListener('change', (event) => {
      const input = event.target.closest('input[name="calibration-intent"]');
      if (!input) return;
      calibrationIntent = input.value;
    });
    query('#calibrationModeOptions').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-mode-id]');
      if (!button) return;
      pendingMatrixScopeSwitchStartedAt = now();
      selection.modeId = button.dataset.modeId;
      activateCurrentPersonalStrategyScope();
      try { await persistSelection(); } catch (error) { notify(friendlyError(error), 'error'); }
      renderConfigured({ controls: false });
    });
    query('#calibrationModeOptions').addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const buttons = [...query('#calibrationModeOptions').querySelectorAll('[data-mode-id]')];
      const index = buttons.indexOf(event.target);
      if (index < 0) return;
      event.preventDefault();
      const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
      const next = buttons[(index + step + buttons.length) % buttons.length];
      next.click();
      next.focus();
    });
    query('#calibrationEnvironment').addEventListener('change', async () => {
      pendingMatrixScopeSwitchStartedAt = now();
      const environment = query('#calibrationEnvironment').value;
      const sizes = tableSizesForEnvironment(environment);
      const requested = Number(query('#calibrationTableSize').value);
      const tableSize = sizes.includes(requested) ? requested : sizes[0];
      selection.context = normalizeRfiContextSelection({ ...selection.context, environment, tableSize }, { environmentDefault: environment });
      activateCurrentPersonalStrategyScope();
      try { await persistSelection(); } catch (error) { notify(friendlyError(error), 'error'); }
      renderContextControls();
      renderConfigured({ controls: false });
      query('#calibrationPositionNotice').textContent = '';
    });
    query('#calibrationDecisionFamily').addEventListener('change', async () => {
      try {
        await updateContextFromControls({ announceCorrection: true });
      } catch (error) {
        notify(friendlyError(error), 'error');
      }
    });
    query('#calibrationTableSize').addEventListener('change', async () => {
      try { await updateContextFromControls({ announceCorrection: true }); } catch (error) { notify(friendlyError(error), 'error'); }
    });
    query('#calibrationHeroPosition').addEventListener('change', async () => {
      try { await updateContextFromControls(); } catch (error) { notify(friendlyError(error), 'error'); }
    });
    query('#calibrationEffectiveStack').addEventListener('change', async () => {
      try { await validateAndSaveStack(); } catch (error) { notify(friendlyError(error), 'error'); }
    });
    query('#calibrationEffectiveStack').addEventListener('input', () => {
      query('#calibrationEffectiveStack').removeAttribute('aria-invalid');
      query('#calibrationStackError').textContent = '';
    });
    root.addEventListener('click', async (event) => {
      const preset = event.target.closest('[data-calibration-stack]');
      if (!preset) return;
      query('#calibrationEffectiveStack').value = preset.dataset.calibrationStack;
      try { await validateAndSaveStack(); } catch (error) { notify(friendlyError(error), 'error'); }
    });
    query('#calibrationProfileForm').addEventListener('submit', submitProfile);
    query('#calibrationProfileModalClose').addEventListener('click', () => closeProfileEditor());
    query('#calibrationProfileCancel').addEventListener('click', () => closeProfileEditor());
    query('#calibrationProfileModal').addEventListener('click', (event) => {
      if (event.target === query('#calibrationProfileModal')) closeProfileEditor();
    });
    document.addEventListener('pointerup', async () => {
      if (!builderGesture) return;
      const gesture = builderGesture;
      builderGesture = null;
      clearBuilderGesturePreview();
      if (builderBrush === 'select') {
        if (gesture.moved) {
          suppressNextBuilderGridClick();
          setBuilderSelection([...gesture.touched], { primary: gesture.currentHand });
        }
        return;
      }
      suppressNextBuilderGridClick();
      setBuilderSelection([...gesture.touched], { primary: gesture.currentHand });
      await applyBuilderOperation(
        builderBrush === 'fold' ? 'dominant_fold' : 'dominant_raise',
        { handClasses: [...gesture.touched] },
      );
    }, { signal: lifecycle.signal });
    document.addEventListener('keydown', (event) => {
      const mixDialog = query('#calibrationMixDialog');
      if (mixDialog && !mixDialog.hidden) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMixEditor();
          return;
        }
        if (event.key === 'Tab') {
          const focusable = mixFocusableElements();
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (builderActive && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z'
        && !event.altKey && !event.shiftKey
        && !event.target.matches('input, textarea, select, [contenteditable="true"]')) {
        event.preventDefault();
        undoBuilderOperation();
        return;
      }
      if (builderActive && event.key === 'Escape'
        && !event.target.matches('input, textarea, select, [contenteditable="true"]')) {
        event.preventDefault();
        if (builderGesture) {
          builderGesture = null;
          clearBuilderGesturePreview();
        } else setBuilderSelection([]);
        return;
      }
      const modal = query('#calibrationProfileModal');
      if (!modal?.classList.contains('show')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeProfileEditor();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = modalFocusableElements();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }, { signal: lifecycle.signal });
    window.addEventListener('riverline:languagechange', () => {
      if (calibrationState) renderQuestion();
      else if (root.dataset.calibrationState === 'configured') {
        renderContextControls();
        renderDerivedContext();
        if (personalStrategySubview === 'teacher') renderRangeTeacher();
        else renderMatrix();
      }
    }, { signal: lifecycle.signal });
    window.addEventListener('riverline:cardpresentationchange', () => {
      if (calibrationState?.prompt) renderQuestionCards(calibrationState.prompt.handClass);
    }, { signal: lifecycle.signal });
  }

  personalStrategyScopeLifecycle = createPersonalStrategyScopeLifecycle({
    onInvalidate: clearPersonalStrategyPresentation,
  });
  if (currentMatrixScope()) activateCurrentPersonalStrategyScope();

  bindEvents();
  render();
  if (workspace.preferenceWarning) {
    notify(translated('Your previous Range Calibration selection could not be read, so safe defaults are shown.'), 'warning');
  }
  metrics.activationMs = now() - activationStartedAt;
  metrics.domNodes = root.querySelectorAll('*').length + 1 + query('#calibrationProfileModal').querySelectorAll('*').length + 1;

  return Object.freeze({
    render,
    openCreateProfile: () => openProfileEditor('create'),
    switchCalibrationContext,
    async dispose() {
      lifecycle.abort();
      personalStrategyScopeLifecycle.invalidate();
      await application.repository?.close?.();
      document.querySelector('#rangeCalibrationMount')?.replaceChildren();
      document.querySelector('#calibrationProfileModal')?.remove();
      mountedWorkspace = null;
      window.RiverlineRangeCalibration = null;
    },
    getPerformanceReport: () => ({
      ...metrics,
      matrix: Object.fromEntries(Object.entries(metrics.matrix).map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value] : value,
      ])),
      hiddenWorkspaceDomMounted: root.isConnected && query('#calibrationMode')?.style.display === 'none',
      storage: application.getStorageMetrics(),
      interactions: interactionSamples.map((entry) => ({ ...entry })),
    }),
    getState: () => ({
      workspace,
      selection,
      calibrationState,
      matrixProjection,
      matrixSelectedHand,
      matrixFilter,
      personalStrategySubview,
      rangeTeacherView,
      personalStrategyScopeGeneration: personalStrategyScopeLifecycle.getGeneration(),
      lastAnswerError: lastAnswerError ? {
        name: lastAnswerError.name,
        code: lastAnswerError.code ?? null,
        message: lastAnswerError.message,
      } : null,
    }),
  });
}

export async function mountRangeCalibrationWorkspace() {
  if (mountedWorkspace) return mountedWorkspace;
  await window.RiverlineAuthentication?.ready?.();
  const activationStartedAt = now();
  const root = cloneCalibrationDom();
  let application = null;
  try {
    if (window.RiverlineAuthentication?.getState?.().status !== 'signed_in') {
      const error = new RangeError('A signed-in Account Profile is required');
      error.code = 'persistent_identity_required';
      throw error;
    }
    const accountIdentity = window.RiverlineAccountIdentity;
    const binding = accountIdentity?.getDomainOwnership
      ? await accountIdentity.getDomainOwnership(RIVERLINE_OWNED_DOMAINS.PERSONAL_STRATEGY)
      : null;
    if (!binding) {
      const error = new RangeError('The authenticated Personal Strategy owner is unavailable');
      error.code = 'identity_unavailable';
      throw error;
    }
    application = createIdentityScopedRangeCalibrationApplication(binding);
    const profileLoadStartedAt = now();
    const initialWorkspace = await application.readWorkspace();
    const profileLoadMs = now() - profileLoadStartedAt;
    mountedWorkspace = createController(root, application, initialWorkspace, activationStartedAt, profileLoadMs);
    window.RiverlineRangeCalibration = mountedWorkspace;
    return mountedWorkspace;
  } catch (error) {
    await application?.repository?.close?.();
    root.setAttribute('aria-busy', 'false');
    root.dataset.calibrationState = 'error';
    document.querySelector('#calibrationLoadingState').hidden = true;
    document.querySelector('#calibrationGuestState').hidden = true;
    document.querySelector('#calibrationErrorState').hidden = false;
    document.querySelector('#calibrationEmptyState').hidden = true;
    document.querySelector('#calibrationConfiguredState').hidden = true;
    document.querySelector('#calibrationErrorMessage').textContent = friendlyError(error);
    console.error('[Riverline Range Calibration]', error);
    throw error;
  }
}

export async function remountRangeCalibrationWorkspace() {
  if (mountedWorkspace) await mountedWorkspace.dispose();
  return mountRangeCalibrationWorkspace();
}

export async function disposeRangeCalibrationWorkspace() {
  if (mountedWorkspace) await mountedWorkspace.dispose();
}
