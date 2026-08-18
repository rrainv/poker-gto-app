import {
  CALIBRATION_ENVIRONMENTS,
  RANGE_CALIBRATION_STACK_LIMITS,
  RFI_CALIBRATION_ACTIONS,
  RFI_CALIBRATION_INTENTS,
  RFI_CALIBRATION_STOP_REASONS,
  countCurrentDirectObservations,
  createContextFromSelection,
  createIdentityScopedRangeCalibrationApplication,
  normalizeRfiContextSelection,
  profileDefaultEnvironment,
  rfiPositionsForTableSize,
  tableSizesForEnvironment,
} from './range-calibration-service.mjs';
import {
  RIVERLINE_OWNED_DOMAINS,
} from '../account-identity/index.mjs';

let mountedWorkspace = null;

const MATRIX_STATUS_KEYS = Object.freeze({
  directly_known: 'Direct',
  inferred_high: 'Inferred high',
  inferred_medium: 'Inferred medium',
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
  boundary_nearby: 'Near a Raise/Fold boundary',
  conflicting_neighbor: 'Conflicting nearby answers',
  scope_locally_unstable: 'Nearby direct answers are locally unstable',
  insufficient_support: 'Not enough nearby direct evidence',
  no_structurally_relevant_evidence: 'No relevant direct evidence yet',
  unsupported_direct_action: 'The direct action is outside this Fold/Raise model',
  training_evidence_excluded_from_002b_inference: 'Training evidence is shown separately and does not drive this inference',
});

const MATRIX_FILTER_STATUSES = Object.freeze({
  all: null,
  direct: new Set(['directly_known']),
  inferred: new Set(['inferred_high', 'inferred_medium']),
  uncertain: new Set(['uncertain', 'unknown']),
  conflicts: new Set(['conflicting']),
});

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
  const context = normalizeRfiContextSelection(preference?.context, {
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
  let failedAnswer = null;
  let calibrationIntent = RFI_CALIBRATION_INTENTS.STANDARD;
  let matrixProjection = null;
  let matrixScopeKey = null;
  let matrixLoadToken = 0;
  let pendingMatrixScopeSwitchStartedAt = null;
  let matrixSelectedHand = null;
  let matrixFilter = 'all';
  let matrixFollowQuestion = true;
  let matrixWritePending = false;
  let mixTarget = null;
  const interactionSamples = [];
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
    if (cell.action.dominantAction === 'raise') return 'R';
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
      button.setAttribute('aria-selected', String(cell.handClass === matrixSelectedHand));
      button.setAttribute('aria-label', `${cell.handClass}, ${matrixStatusLabel(cell.status)}, ${matrixActionDescription(cell)}`);
      button.title = `${cell.handClass} · ${matrixStatusLabel(cell.status)} · ${matrixActionDescription(cell)}`;
      button.tabIndex = cell.handClass === matrixSelectedHand || (!matrixSelectedHand && index === 0) ? 0 : -1;
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
    } else if (cell.status === 'uncertain') {
      explanationKey = 'Nearby evidence exists, but Riverline is abstaining here.';
    } else if (cell.status === 'conflicting') {
      explanationKey = 'Active direct answers disagree. Riverline is not averaging them.';
    }
    setTranslatedText(query('#calibrationInspectorExplanation'), explanationKey, parameters);
    query('#calibrationInspectorProvenance').textContent = matrixStatusLabel(cell.status);
    query('#calibrationInspectorEvidenceCount').textContent = translated('{count} records', {
      count: cell.evidence.directHistory.length + cell.evidence.training.length,
    });
    query('#calibrationInspectorBoundary').textContent = translated(
      cell.support.boundaryLikelihood === 'high' ? 'High boundary likelihood'
        : cell.support.boundaryLikelihood === 'medium' ? 'Medium boundary likelihood'
          : cell.support.boundaryLikelihood === 'low' ? 'Low boundary likelihood' : 'Unknown',
    );
    query('#calibrationInspectorQuestionRank').textContent = cell.question
      ? `${translated('Rank')} #${cell.question.rank}${cell.question.isHighValue ? ` · ${translated('High value')}` : ''}`
      : translated('Not ranked');

    const reasons = query('#calibrationInspectorReasons');
    const reasonKeys = [...new Set([
      ...cell.reasons.map((code) => MATRIX_REASON_KEYS[code] ?? code),
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
    const inferred = cell.status === 'inferred_high' || cell.status === 'inferred_medium';
    query('#calibrationMatrixConfirm').hidden = !inferred || !cell.action.dominantAction;
    query('#calibrationMatrixAskNext').hidden = !(
      calibrationState && cell.question?.ordinaryQuestionEligible && cell.question?.isHighValue
    );
    [
      '#calibrationMatrixConfirm',
      '#calibrationMatrixFold',
      '#calibrationMatrixRaise',
      '#calibrationMatrixMix',
      '#calibrationMatrixAskNext',
    ].forEach((selector) => { query(selector).disabled = matrixWritePending; });
  }

  function updateMatrixSelectionDom(previousHand, nextHand) {
    const grid = query('#calibrationPersonalStrategyGrid');
    grid.querySelectorAll('[role="gridcell"]').forEach((button, index) => {
      const selected = button.dataset.handClass === nextHand;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected || (!nextHand && index === 0) ? 0 : -1;
    });
    if (previousHand && previousHand !== nextHand) {
      grid.querySelector(`[data-hand-class="${previousHand}"]`)?.classList.remove('is-selected');
    }
    if (nextHand) grid.querySelector(`[data-hand-class="${nextHand}"]`)?.classList.add('is-selected');
  }

  function selectMatrixHand(handClass, { manual = false, focus = false } = {}) {
    if (!matrixCell(handClass)) return;
    const startedAt = now();
    const previous = matrixSelectedHand;
    matrixSelectedHand = handClass;
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
      ? `${entry.profile.displayName} · ${mode.displayName} · ${selection.context.tableSize}-max · ${selection.context.heroPosition} · ${selection.context.effectiveStackBb}bb · RFI`
      : '';
    const summary = matrixProjection.summary;
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
    renderMatrixGrid();
    renderMatrixInspector();
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
    const token = ++matrixLoadToken;
    const scopeChanged = matrixScopeKey !== scopeKey;
    if (scopeChanged) {
      matrixProjection = null;
      matrixSelectedHand = null;
    }
    matrixScopeKey = scopeKey;
    setMatrixLoading(true);
    const startedAt = now();
    try {
      const projection = await application.getPersonalStrategyMatrixProjection(scope, {
        session: matchingCalibrationSession(),
      });
      if (token !== matrixLoadToken || scopeKey !== currentMatrixScopeKey()) return null;
      matrixProjection = projection;
      metrics.matrix.projectionLoads += 1;
      metrics.matrix.projectionPreparationMs.push(now() - startedAt);
      if (scopeSwitchStartedAt !== null) metrics.matrix.scopeSwitchMs.push(now() - scopeSwitchStartedAt);
      if (matrixFollowQuestion && calibrationState?.prompt) matrixSelectedHand = calibrationState.prompt.handClass;
      renderMatrix();
      return projection;
    } catch (error) {
      if (token === matrixLoadToken) setMatrixLoading(false, error);
      return null;
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
    const table = query('#calibrationTableSize');
    const position = query('#calibrationHeroPosition');
    const stack = query('#calibrationEffectiveStack');
    environment.value = context.environment;

    table.replaceChildren(...tableSizesForEnvironment(context.environment).map((size) => {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = translated('analysis.value.tableSize', { count: size });
      option.selected = size === context.tableSize;
      return option;
    }));
    position.replaceChildren(...rfiPositionsForTableSize(context.tableSize).map((name) => {
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

  function renderDerivedContext() {
    const entry = activeEntry();
    const mode = activeMode();
    if (!entry || !mode) return;
    const context = createContextFromSelection(selection.context);
    const totalDeduction = context.accounting.forcedContributionPerPlayerBb * context.tableSize;
    query('#calibrationAccounting').textContent = selection.context.environment === CALIBRATION_ENVIRONMENTS.CLUBGG
      ? translated('ClubGG · 0.1 bb per seated player · {total} bb total deduction', { total: totalDeduction.toFixed(1) })
      : translated('Home · no rake or deduction');
    query('#calibrationPreviewIdentity').textContent = `${entry.profile.displayName} · ${mode.displayName}`;
    query('#calibrationPreviewSpot').textContent = `${selection.context.tableSize}-max · ${selection.context.heroPosition} · ${selection.context.effectiveStackBb}bb · RFI`;
    query('#calibrationProfileCount').textContent = String(workspace.profiles.length);
    query('#calibrationProgressMode').textContent = mode.displayName;
    const observationCount = countCurrentDirectObservations(workspace.snapshot, {
      profileId: entry.profile.id,
      modeId: mode.id,
      context,
    });
    query('#calibrationObservationCount').textContent = String(observationCount);
    setTranslatedText(query('#calibrationStartQuestions'), observationCount > 0 && observationCount < 169
      ? 'Resume questions'
      : 'Start questions');
    const noteKey = observationCount === 0
      ? 'No direct answers have been recorded for this range yet.'
      : '{count} direct answers are already recorded for this range.';
    setTranslatedText(query('#calibrationObservationNote'), noteKey, { count: observationCount });
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
    void loadMatrixProjection({ scopeSwitchStartedAt });
  }

  function actionLabel(actionType) {
    return translated(actionType === 'raise' ? 'Raise' : 'Fold');
  }

  function previousAnswerLabel(observation) {
    if (observation.dominantAction) return actionLabel(observation.dominantAction.type);
    return observation.frequencies.map((entry) => (
      `${Number((entry.probability * 100).toFixed(6))}% ${actionLabel(entry.action.type)}`
    )).join(' \u00b7 ');
  }

  function completionCopy(assessment) {
    if (assessment.stopReason === RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE) {
      return {
        title: 'Direct RFI calibration complete for this spot.',
        summary: 'All 169 hand classes have direct answers.',
      };
    }
    if (assessment.stopReason === RFI_CALIBRATION_STOP_REASONS.CONFLICT_RESOLUTION_NEEDED) {
      return {
        title: 'Conflict review is needed',
        summary: 'Ordinary answers cannot resolve the remaining direct contradiction.',
      };
    }
    if (assessment.stopReason === RFI_CALIBRATION_STOP_REASONS.USER_TIME_BUDGET_REACHED) {
      return {
        title: 'Session goal reached',
        summary: 'Your saved answers are already part of this model. Continue now or resume later.',
      };
    }
    if (assessment.stopReason === RFI_CALIBRATION_STOP_REASONS.NO_USEFUL_CANDIDATES) {
      return {
        title: 'No useful ordinary questions remain',
        summary: 'You can review this range or continue later after the evidence changes.',
      };
    }
    return {
      title: 'Range mapped enough for this session',
      summary: 'Most of this range is mapped. {count} high-value questions remain.',
      parameters: { count: assessment.highValueQuestionCount },
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
    query('#calibrationQuestionSpot').textContent = `${selection.context.tableSize}-max · ${selection.context.heroPosition} · ${selection.context.effectiveStackBb}bb · RFI`;
    query('#calibrationFirstUseEducation').hidden = !educationVisible;

    const {
      prompt,
      progress,
      previousAnswer,
      progressAssessment,
      questionExplanation,
    } = calibrationState;
    const complete = prompt === null;
    query('#calibrationActiveQuestion').hidden = complete;
    query('#calibrationCompleteState').hidden = !complete;
    if (!complete) {
      query('#calibrationQuestionTitle').textContent = prompt.handClass;
      const kindKey = prompt.handClass.length === 2 ? 'Pair' : (prompt.handClass.endsWith('s') ? 'Suited' : 'Offsuit');
      setTranslatedText(query('#calibrationQuestionKind'), kindKey);
      setTranslatedText(
        query('#calibrationQuestionReason'),
        questionExplanation?.messageKey ?? 'Reduces uncertainty here',
      );
      query('#calibrationAnswerError').textContent = '';
    }
    setTranslatedText(query('#calibrationQuestionProgress'), '{count} direct', {
      count: progressAssessment.directCount,
    });
    setTranslatedText(query('#calibrationQuestionRemaining'), '{count} high-value questions remain', {
      count: progressAssessment.highValueQuestionCount,
    });
    query('#calibrationProgressBar').value = progress.answered;
    query('#calibrationProgressBar').max = progress.total;
    query('#calibrationProgressBar').setAttribute('aria-valuetext', translated('{answered} of {total} directly answered', progress));
    query('#calibrationDirectCount').textContent = String(progressAssessment.directCount);
    query('#calibrationInferredHighCount').textContent = String(progressAssessment.inferredHighCount);
    query('#calibrationInferredMediumCount').textContent = String(progressAssessment.inferredMediumCount);
    query('#calibrationUncertainCount').textContent = String(progressAssessment.uncertainCount);
    query('#calibrationUnknownCount').textContent = String(progressAssessment.unknownCount);
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
      query('#calibrationCompleteCounts').textContent = translated(
        '{direct} direct · {high} inferred high · {medium} inferred medium · {uncertain} uncertain · {unknown} unknown · {conflicting} conflicting',
        {
          direct: progressAssessment.directCount,
          high: progressAssessment.inferredHighCount,
          medium: progressAssessment.inferredMediumCount,
          uncertain: progressAssessment.uncertainCount,
          unknown: progressAssessment.unknownCount,
          conflicting: progressAssessment.conflictingCount,
        },
      );
      query('#calibrationAskAnother').hidden = progressAssessment.stopReason
        === RFI_CALIBRATION_STOP_REASONS.FULL_DIRECT_COVERAGE
        || !calibrationState.candidateRanking.some((candidate) => candidate.ordinaryQuestionEligible);
    }
    adoptCalibrationMatrix();
  }

  function setAnswerControlsDisabled(disabled) {
    query('#calibrationActionFold').disabled = disabled;
    query('#calibrationActionRaise').disabled = disabled;
    query('#calibrationOpenMix').disabled = disabled;
    query('#calibrationSkipQuestion').disabled = disabled;
    query('#calibrationNotSure').disabled = disabled;
    query('#calibrationUndoAnswer').disabled = disabled;
  }

  function setAnswerPending(pending) {
    answerPending = pending;
    setAnswerControlsDisabled(pending || Boolean(failedAnswer));
    query('#calibrationRetryAnswer').disabled = pending;
    query('#calibrationMixRetry').disabled = pending;
    query('#calibrationMixSave').disabled = pending || Boolean(failedAnswer);
    query('#calibrationMixFold').disabled = pending || Boolean(failedAnswer);
    query('#calibrationMixRaise').disabled = pending || Boolean(failedAnswer);
    query('#calibrationQuestionRegion')?.setAttribute('aria-busy', String(pending));
    root.dataset.persistenceState = pending ? 'pending' : (failedAnswer ? 'failed' : 'ready');
  }

  async function enterQuestions() {
    if (!await validateAndSaveStack()) return;
    try {
      failedAnswer = null;
      query('#calibrationRetryAnswer').hidden = true;
      calibrationState = await application.startOrResumeSession({
        selectedProfileId: selection.profileId,
        activeModeId: selection.modeId,
        context: selection.context,
        intent: calibrationIntent,
        continueAfterStop: true,
      });
      syncSnapshot(calibrationState.snapshot);
      educationVisible = calibrationState.progress.answered === 0;
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      notify(friendlyError(error), 'error');
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
    const startedAt = now();
    const command = retry && failedAnswer
      ? failedAnswer
      : {
        state: calibrationState,
        input: { actionType, mix },
        operation: application.createAnswerOperation(calibrationState),
      };
    setAnswerPending(true);
    try {
      lastAnswerError = null;
      const nextState = await application.answerCalibrationQuestion(command.state, {
        ...command.input,
        ...command.operation,
      });
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
      lastAnswerError = error;
      failedAnswer = command;
      query('#calibrationAnswerError').textContent = friendlyError(error);
      const mixVisible = !query('#calibrationMixDialog').hidden;
      query('#calibrationRetryAnswer').hidden = mixVisible;
      query('#calibrationMixRetry').hidden = !mixVisible;
      return false;
    } finally {
      setAnswerPending(false);
    }
  }

  async function undoAnswer() {
    if (!calibrationState?.previousAnswer || answerPending) return;
    setAnswerPending(true);
    try {
      calibrationState = await application.undoPreviousAnswer(calibrationState, {
        operationId: application.createAnswerOperation(calibrationState).operationId,
      });
      syncSnapshot(calibrationState.snapshot);
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      query('#calibrationAnswerError').textContent = friendlyError(error);
    } finally {
      setAnswerPending(false);
    }
  }

  async function pauseQuestions() {
    if (!calibrationState || answerPending) return;
    try {
      calibrationState = await application.pauseSession(calibrationState);
      syncSnapshot(calibrationState.snapshot);
      calibrationState = null;
      renderConfigured();
      query('#calibrationStartQuestions')?.focus?.({ preventScroll: true });
    } catch (error) {
      query('#calibrationAnswerError').textContent = friendlyError(error);
    }
  }

  async function stopQuestions() {
    if (!calibrationState || answerPending) return;
    try {
      calibrationState = await application.stopSession(calibrationState);
      syncSnapshot(calibrationState.snapshot);
      calibrationState = null;
      renderConfigured();
      query('#calibrationStartQuestions')?.focus?.({ preventScroll: true });
    } catch (error) {
      query('#calibrationAnswerError').textContent = friendlyError(error);
    }
  }

  async function skipQuestion(notSure = false) {
    if (!calibrationState?.prompt || answerPending) return;
    setAnswerPending(true);
    try {
      calibrationState = await application.skipCalibrationQuestion(calibrationState, { notSure });
      syncSnapshot(calibrationState.snapshot);
      educationVisible = false;
      renderQuestion();
      if (calibrationState.prompt) {
        window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
      }
    } catch (error) {
      query('#calibrationAnswerError').textContent = friendlyError(error);
    } finally {
      setAnswerPending(false);
    }
  }

  async function askAnotherQuestion() {
    if (!calibrationState || answerPending) return;
    setAnswerPending(true);
    try {
      calibrationState = await application.requestAdditionalQuestion(calibrationState);
      syncSnapshot(calibrationState.snapshot);
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      notify(friendlyError(error), 'error');
    } finally {
      setAnswerPending(false);
    }
  }

  function patchWorkspaceWithMatrixObservation(observation, metadata) {
    const observations = [...workspace.snapshot.rangeObservations];
    const parentId = observation.revision.supersedesObservationId;
    const parentIndex = parentId ? observations.findIndex((entry) => entry.id === parentId) : -1;
    if (parentIndex >= 0) observations[parentIndex] = observation;
    else observations.push(observation);
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

  function setMatrixWritePending(pending) {
    matrixWritePending = pending;
    query('#calibrationMatrixInspector').setAttribute('aria-busy', String(pending));
    renderMatrixInspector();
  }

  async function recordMatrixAnswer({ actionType = null, mix = null } = {}) {
    const cell = matrixCell(matrixSelectedHand);
    const scope = currentMatrixScope();
    if (!cell || !scope || matrixWritePending) return false;
    const startedAt = now();
    setMatrixWritePending(true);
    try {
      const result = await application.recordPersonalStrategyMatrixEvidence(calibrationState, {
        ...scope,
        handClass: cell.handClass,
        actionType,
        mix,
      });
      patchWorkspaceWithMatrixObservation(result.acceptedObservation, result.metadata);
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
      query('#calibrationMatrixError').hidden = false;
      query('#calibrationMatrixError').textContent = friendlyError(error);
      return false;
    } finally {
      setMatrixWritePending(false);
    }
  }

  async function askSelectedMatrixHandNext() {
    if (!calibrationState || !matrixSelectedHand || matrixWritePending) return;
    setMatrixWritePending(true);
    try {
      calibrationState = await application.requestPersonalStrategyMatrixQuestion(
        calibrationState,
        matrixSelectedHand,
      );
      syncSnapshot(calibrationState.snapshot);
      matrixFollowQuestion = true;
      renderQuestion();
      query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true });
    } catch (error) {
      query('#calibrationMatrixError').hidden = false;
      query('#calibrationMatrixError').textContent = friendlyError(error);
    } finally {
      setMatrixWritePending(false);
    }
  }

  function mixFocusableElements() {
    return [...query('#calibrationMixDialog').querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.offsetParent !== null);
  }

  function openMixEditor(target = 'question') {
    const handClass = target === 'matrix' ? matrixSelectedHand : calibrationState?.prompt?.handClass;
    if (!handClass) return;
    mixTarget = { kind: target, handClass };
    focusBeforeMix = document.activeElement;
    query('#calibrationMixForm').reset();
    query('#calibrationMixError').textContent = '';
    query('#calibrationMixRetry').hidden = true;
    const selectedCell = target === 'matrix' ? matrixCell(handClass) : null;
    if (selectedCell?.action.exactFrequencies) {
      const byAction = Object.fromEntries(selectedCell.action.exactFrequencies.map((entry) => [
        entry.action.type,
        Number((entry.probability * 100).toFixed(6)),
      ]));
      query('#calibrationMixFold').value = String(byAction.fold ?? 0);
      query('#calibrationMixRaise').value = String(byAction.raise ?? 0);
    }
    setTranslatedText(query('#calibrationMixTitle'), 'Set frequencies for {hand}', { hand: handClass });
    setTranslatedText(query('#calibrationMixSave'), target === 'matrix' ? 'Save exact mix' : 'Save mix and continue');
    query('#calibrationMixDialog').hidden = false;
    document.body.classList.add('has-modal-open');
    window.requestAnimationFrame(() => query('#calibrationMixFold').focus());
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
    const mix = {
      fold: Number(query('#calibrationMixFold').value),
      raise: Number(query('#calibrationMixRaise').value),
    };
    const saved = mixTarget?.kind === 'matrix'
      ? await recordMatrixAnswer({ mix })
      : await acceptAnswer({ mix });
    if (saved) closeMixEditor({ restoreFocus: false });
    else query('#calibrationMixError').textContent = mixTarget?.kind === 'matrix'
      ? query('#calibrationMatrixError').textContent
      : query('#calibrationAnswerError').textContent;
  }

  function render() {
    if (!workspace.profiles.length) {
      selection = null;
      setState('empty');
      return;
    }
    if (!selection || !activeEntry()) selection = initialSelection(workspace);
    renderConfigured();
  }

  async function refreshWorkspace(preferredProfileId = selection?.profileId) {
    workspace = await application.readWorkspace();
    const entry = selectedEntry(workspace, preferredProfileId) || workspace.profiles[0] || null;
    if (!entry) selection = null;
    else if (!selection || selection.profileId !== entry.profile.id) {
      const preference = workspace.preferences.byProfile[entry.profile.id];
      selection = {
        profileId: entry.profile.id,
        modeId: entry.modes.find((mode) => mode.id === preference?.activeModeId)?.id || entry.modes[0].id,
        context: normalizeRfiContextSelection(preference?.context, {
          environmentDefault: profileDefaultEnvironment(entry.profile),
        }),
      };
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
      context: normalizeRfiContextSelection(preference?.context, {
        environmentDefault: profileDefaultEnvironment(entry.profile),
      }),
    };
    await persistSelection();
    renderConfigured();
  }

  async function updateContextFromControls({ announceCorrection = false } = {}) {
    const previousPosition = selection.context.heroPosition;
    pendingMatrixScopeSwitchStartedAt = now();
    const candidate = {
      environment: query('#calibrationEnvironment').value,
      tableSize: Number(query('#calibrationTableSize').value),
      heroPosition: query('#calibrationHeroPosition').value,
      effectiveStackBb: Number(query('#calibrationEffectiveStack').value),
    };
    selection.context = normalizeRfiContextSelection(candidate, {
      environmentDefault: selection.context.environment,
    });
    await persistSelection();
    renderContextControls();
    renderDerivedContext();
    if (announceCorrection && previousPosition !== selection.context.heroPosition) {
      query('#calibrationPositionNotice').textContent = translated(
        '{previous} is not available at this table size. Position changed to {position}.',
        { previous: previousPosition, position: selection.context.heroPosition },
      );
    } else query('#calibrationPositionNotice').textContent = '';
  }

  async function validateAndSaveStack() {
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
    await updateContextFromControls();
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
          context: normalizeRfiContextSelection({}, { environmentDefault: profileDefaultEnvironment(bundle.profile) }),
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
    query('#calibrationPauseQuestions').addEventListener('click', pauseQuestions);
    query('#calibrationStopQuestions').addEventListener('click', stopQuestions);
    query('#calibrationReturnToContext').addEventListener('click', pauseQuestions);
    query('#calibrationAskAnother').addEventListener('click', askAnotherQuestion);
    query('#calibrationActionFold').addEventListener('click', () => acceptAnswer({ actionType: 'fold' }));
    query('#calibrationActionRaise').addEventListener('click', () => acceptAnswer({ actionType: 'raise' }));
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
      const preset = event.target.closest('[data-mix-fold][data-mix-raise]');
      if (!preset) return;
      query('#calibrationMixFold').value = preset.dataset.mixFold;
      query('#calibrationMixRaise').value = preset.dataset.mixRaise;
      query('#calibrationMixFold').focus();
    });
    query('#calibrationPersonalStrategyGrid').addEventListener('click', (event) => {
      const cell = event.target.closest('[data-hand-class]');
      if (cell) selectMatrixHand(cell.dataset.handClass, { manual: true });
    });
    query('#calibrationPersonalStrategyGrid').addEventListener('keydown', (event) => {
      const cell = event.target.closest('[data-hand-class]');
      if (!cell || !matrixProjection) return;
      const current = matrixCell(cell.dataset.handClass);
      if (!current) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectMatrixHand(current.handClass, { manual: true });
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
    query('#calibrationMatrixMix').addEventListener('click', () => openMixEditor('matrix'));
    query('#calibrationMatrixAskNext').addEventListener('click', askSelectedMatrixHandNext);
    root.addEventListener('keydown', (event) => {
      if (!calibrationState?.prompt || !query('#calibrationMixDialog').hidden) return;
      const target = event.target;
      if (!query('#calibrationQuestionView').contains(target)
        || target.matches('input, textarea, select, [contenteditable="true"]')
        || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const action = RFI_CALIBRATION_ACTIONS.find((entry) => entry.shortcut.toLowerCase() === event.key.toLowerCase());
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
      try { await persistSelection(); } catch (error) { notify(friendlyError(error), 'error'); }
      renderContextControls();
      renderDerivedContext();
      query('#calibrationPositionNotice').textContent = '';
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
        renderMatrix();
      }
    }, { signal: lifecycle.signal });
  }

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
    async dispose() {
      lifecycle.abort();
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
