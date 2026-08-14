import {
  CALIBRATION_ENVIRONMENTS,
  RANGE_CALIBRATION_STACK_LIMITS,
  RFI_CALIBRATION_ACTIONS,
  countCurrentDirectObservations,
  createContextFromSelection,
  createRangeCalibrationApplication,
  normalizeRfiContextSelection,
  profileDefaultEnvironment,
  rfiPositionsForTableSize,
  tableSizesForEnvironment,
} from './range-calibration-service.mjs';

let mountedWorkspace = null;

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
  if (error?.code === 'corrupt_record') return translated('Stored Personal Strategy data is malformed and was left untouched.');
  if (error?.code === 'unsupported_schema') return translated('Stored Personal Strategy data uses an unsupported version and was left untouched.');
  if (error?.code === 'owner_mismatch') return translated('Stored Personal Strategy data belongs to a different local owner and was left untouched.');
  if (error?.code === 'read_failed') return translated('Personal Strategy data could not be read.');
  if (error?.code === 'write_failed') return translated('Your changes could not be saved. The previous data remains intact.');
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
  let workspace = initialWorkspace;
  let selection = initialSelection(workspace);
  let calibrationState = null;
  let editorMode = 'create';
  let focusBeforeModal = null;
  let focusBeforeMix = null;
  let educationVisible = true;
  let lastAnswerError = null;
  const interactionSamples = [];
  const activationReads = application.getStorageMetrics();
  const metrics = {
    activationMs: 0,
    profileLoadMs,
    profileCount: workspace.profiles.length,
    repositoryReadsDuringActivation: activationReads.readsByKey[application.repository.storageKey] || 0,
    domNodes: 0,
  };

  function activeEntry() {
    return selection ? selectedEntry(workspace, selection.profileId) : null;
  }

  function activeMode() {
    const entry = activeEntry();
    return entry?.modes.find((mode) => mode.id === selection.modeId) || entry?.modes[0] || null;
  }

  function setState(state) {
    root.dataset.calibrationState = state;
    root.setAttribute('aria-busy', String(state === 'loading'));
    query('#calibrationLoadingState').hidden = state !== 'loading';
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

  function showWorkspaceError(error) {
    setState('error');
    query('#calibrationErrorMessage').textContent = friendlyError(error);
  }

  function persistSelection() {
    if (!selection) return;
    application.saveWorkspaceSelection({
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
    if (controls) renderContextControls();
    renderDerivedContext();
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

    const { prompt, progress, previousAnswer } = calibrationState;
    const complete = prompt === null;
    query('#calibrationActiveQuestion').hidden = complete;
    query('#calibrationCompleteState').hidden = !complete;
    if (!complete) {
      query('#calibrationQuestionTitle').textContent = prompt.handClass;
      const kindKey = prompt.handClass.length === 2 ? 'Pair' : (prompt.handClass.endsWith('s') ? 'Suited' : 'Offsuit');
      setTranslatedText(query('#calibrationQuestionKind'), kindKey);
      query('#calibrationAnswerError').textContent = '';
    }
    query('#calibrationQuestionProgress').textContent = `${progress.answered} / ${progress.total}`;
    setTranslatedText(query('#calibrationQuestionRemaining'), '{count} remaining', { count: progress.remaining });
    query('#calibrationProgressBar').value = progress.answered;
    query('#calibrationProgressBar').max = progress.total;
    query('#calibrationProgressBar').setAttribute('aria-valuetext', translated('{answered} of {total} directly answered', progress));
    query('#calibrationPreviousAnswer').hidden = !previousAnswer;
    if (previousAnswer) {
      query('#calibrationPreviousHand').textContent = previousAnswer.handClass;
      query('#calibrationPreviousAction').textContent = previousAnswerLabel(previousAnswer);
    }
  }

  function setAnswerControlsDisabled(disabled) {
    query('#calibrationActionFold').disabled = disabled;
    query('#calibrationActionRaise').disabled = disabled;
    query('#calibrationOpenMix').disabled = disabled;
    query('#calibrationUndoAnswer').disabled = disabled;
  }

  function enterQuestions() {
    if (!validateAndSaveStack()) return;
    try {
      calibrationState = application.startOrResumeSession({
        selectedProfileId: selection.profileId,
        activeModeId: selection.modeId,
        context: selection.context,
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

  function acceptAnswer({ actionType = null, mix = null } = {}) {
    if (!calibrationState?.prompt) return false;
    const startedAt = now();
    setAnswerControlsDisabled(true);
    try {
      lastAnswerError = null;
      const nextState = application.answerCalibrationQuestion(calibrationState, { actionType, mix });
      calibrationState = nextState;
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
      query('#calibrationAnswerError').textContent = friendlyError(error);
      return false;
    } finally {
      setAnswerControlsDisabled(false);
    }
  }

  function undoAnswer() {
    if (!calibrationState?.previousAnswer) return;
    setAnswerControlsDisabled(true);
    try {
      calibrationState = application.undoPreviousAnswer(calibrationState);
      syncSnapshot(calibrationState.snapshot);
      renderQuestion();
      window.requestAnimationFrame(() => query('#calibrationQuestionRegion')?.focus?.({ preventScroll: true }));
    } catch (error) {
      query('#calibrationAnswerError').textContent = friendlyError(error);
    } finally {
      setAnswerControlsDisabled(false);
    }
  }

  function pauseQuestions() {
    if (!calibrationState) return;
    try {
      calibrationState = application.pauseSession(calibrationState);
      syncSnapshot(calibrationState.snapshot);
      calibrationState = null;
      renderConfigured();
      query('#calibrationStartQuestions')?.focus?.({ preventScroll: true });
    } catch (error) {
      query('#calibrationAnswerError').textContent = friendlyError(error);
    }
  }

  function mixFocusableElements() {
    return [...query('#calibrationMixDialog').querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.offsetParent !== null);
  }

  function openMixEditor() {
    if (!calibrationState?.prompt) return;
    focusBeforeMix = document.activeElement;
    query('#calibrationMixForm').reset();
    query('#calibrationMixError').textContent = '';
    setTranslatedText(query('#calibrationMixTitle'), 'Set frequencies for {hand}', { hand: calibrationState.prompt.handClass });
    query('#calibrationMixDialog').hidden = false;
    document.body.classList.add('has-modal-open');
    window.requestAnimationFrame(() => query('#calibrationMixFold').focus());
  }

  function closeMixEditor({ restoreFocus = true } = {}) {
    if (query('#calibrationMixDialog').hidden) return;
    query('#calibrationMixDialog').hidden = true;
    document.body.classList.remove('has-modal-open');
    if (restoreFocus) focusBeforeMix?.focus?.({ preventScroll: true });
  }

  function submitMix(event) {
    event.preventDefault();
    const mix = {
      fold: Number(query('#calibrationMixFold').value),
      raise: Number(query('#calibrationMixRaise').value),
    };
    if (acceptAnswer({ mix })) closeMixEditor({ restoreFocus: false });
    else query('#calibrationMixError').textContent = query('#calibrationAnswerError').textContent;
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

  function refreshWorkspace(preferredProfileId = selection?.profileId) {
    workspace = application.readWorkspace();
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

  function changeProfile(profileId) {
    const entry = selectedEntry(workspace, profileId);
    if (!entry) return;
    const preference = workspace.preferences.byProfile[profileId];
    selection = {
      profileId,
      modeId: entry.modes.find((mode) => mode.id === preference?.activeModeId)?.id || entry.modes[0].id,
      context: normalizeRfiContextSelection(preference?.context, {
        environmentDefault: profileDefaultEnvironment(entry.profile),
      }),
    };
    persistSelection();
    renderConfigured();
  }

  function updateContextFromControls({ announceCorrection = false } = {}) {
    const previousPosition = selection.context.heroPosition;
    const candidate = {
      environment: query('#calibrationEnvironment').value,
      tableSize: Number(query('#calibrationTableSize').value),
      heroPosition: query('#calibrationHeroPosition').value,
      effectiveStackBb: Number(query('#calibrationEffectiveStack').value),
    };
    selection.context = normalizeRfiContextSelection(candidate, {
      environmentDefault: selection.context.environment,
    });
    persistSelection();
    renderContextControls();
    renderDerivedContext();
    if (announceCorrection && previousPosition !== selection.context.heroPosition) {
      query('#calibrationPositionNotice').textContent = translated(
        '{previous} is not available at this table size. Position changed to {position}.',
        { previous: previousPosition, position: selection.context.heroPosition },
      );
    } else query('#calibrationPositionNotice').textContent = '';
  }

  function validateAndSaveStack() {
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
    updateContextFromControls();
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

  function submitProfile(event) {
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
        application.updateProfileConfiguration(profileId, input);
        notify(translated('Profile changes saved.'), 'success');
      } else {
        const bundle = application.createProfile(input);
        profileId = bundle.profile.id;
        selection = {
          profileId,
          modeId: bundle.modes[0].id,
          context: normalizeRfiContextSelection({}, { environmentDefault: profileDefaultEnvironment(bundle.profile) }),
        };
        notify(translated('Profile created.'), 'success');
      }
      closeProfileEditor({ restoreFocus: false });
      refreshWorkspace(profileId);
      persistSelection();
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
    query('#calibrationRetry').addEventListener('click', () => {
      try { refreshWorkspace(); } catch (error) { showWorkspaceError(error); }
    });
    query('#calibrationStartQuestions').addEventListener('click', enterQuestions);
    query('#calibrationPauseQuestions').addEventListener('click', pauseQuestions);
    query('#calibrationReturnToContext').addEventListener('click', pauseQuestions);
    query('#calibrationActionFold').addEventListener('click', () => acceptAnswer({ actionType: 'fold' }));
    query('#calibrationActionRaise').addEventListener('click', () => acceptAnswer({ actionType: 'raise' }));
    query('#calibrationUndoAnswer').addEventListener('click', undoAnswer);
    query('#calibrationOpenMix').addEventListener('click', openMixEditor);
    query('#calibrationMixForm').addEventListener('submit', submitMix);
    query('#calibrationMixClose').addEventListener('click', () => closeMixEditor());
    query('#calibrationMixCancel').addEventListener('click', () => closeMixEditor());
    query('#calibrationMixDialog').addEventListener('click', (event) => {
      if (event.target === query('#calibrationMixDialog')) closeMixEditor();
    });
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
    query('#calibrationProfileSelect').addEventListener('change', (event) => changeProfile(event.target.value));
    query('#calibrationModeOptions').addEventListener('click', (event) => {
      const button = event.target.closest('[data-mode-id]');
      if (!button) return;
      selection.modeId = button.dataset.modeId;
      persistSelection();
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
    query('#calibrationEnvironment').addEventListener('change', () => {
      const environment = query('#calibrationEnvironment').value;
      const sizes = tableSizesForEnvironment(environment);
      const requested = Number(query('#calibrationTableSize').value);
      const tableSize = sizes.includes(requested) ? requested : sizes[0];
      selection.context = normalizeRfiContextSelection({ ...selection.context, environment, tableSize }, { environmentDefault: environment });
      persistSelection();
      renderContextControls();
      renderDerivedContext();
      query('#calibrationPositionNotice').textContent = '';
    });
    query('#calibrationTableSize').addEventListener('change', () => updateContextFromControls({ announceCorrection: true }));
    query('#calibrationHeroPosition').addEventListener('change', () => updateContextFromControls());
    query('#calibrationEffectiveStack').addEventListener('change', validateAndSaveStack);
    query('#calibrationEffectiveStack').addEventListener('input', () => {
      query('#calibrationEffectiveStack').removeAttribute('aria-invalid');
      query('#calibrationStackError').textContent = '';
    });
    root.addEventListener('click', (event) => {
      const preset = event.target.closest('[data-calibration-stack]');
      if (!preset) return;
      query('#calibrationEffectiveStack').value = preset.dataset.calibrationStack;
      validateAndSaveStack();
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
    });
    window.addEventListener('riverline:languagechange', () => {
      if (calibrationState) renderQuestion();
      else if (root.dataset.calibrationState === 'configured') {
        renderContextControls();
        renderDerivedContext();
      }
    });
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
    getPerformanceReport: () => ({
      ...metrics,
      hiddenWorkspaceDomMounted: root.isConnected && query('#calibrationMode')?.style.display === 'none',
      storage: application.getStorageMetrics(),
      interactions: interactionSamples.map((entry) => ({ ...entry })),
    }),
    getState: () => ({
      workspace,
      selection,
      calibrationState,
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
  const activationStartedAt = now();
  const root = cloneCalibrationDom();
  try {
    const application = createRangeCalibrationApplication();
    const profileLoadStartedAt = now();
    const initialWorkspace = application.readWorkspace();
    const profileLoadMs = now() - profileLoadStartedAt;
    mountedWorkspace = createController(root, application, initialWorkspace, activationStartedAt, profileLoadMs);
    window.RiverlineRangeCalibration = mountedWorkspace;
    return mountedWorkspace;
  } catch (error) {
    root.setAttribute('aria-busy', 'false');
    root.dataset.calibrationState = 'error';
    document.querySelector('#calibrationLoadingState').hidden = true;
    document.querySelector('#calibrationErrorState').hidden = false;
    document.querySelector('#calibrationErrorMessage').textContent = friendlyError(error);
    console.error('[Riverline Range Calibration]', error);
    throw error;
  }
}
