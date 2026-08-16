function normalizeDefinitions(definitions) {
  const map = new Map();
  for (const definition of definitions ?? []) {
    if (map.has(definition.id)) throw new RangeError(`Duplicate tutorial definition: ${definition.id}`);
    map.set(definition.id, definition);
  }
  return map;
}

export function createTutorialController({
  definitions,
  persistence,
  anchorRegistry,
  surface,
  getWorkspace,
  preconditions = {},
} = {}) {
  const catalog = normalizeDefinitions(definitions);
  let run = null;
  let lastResult = Object.freeze({ status: 'idle', reason: null });

  function snapshot() {
    if (!run) return lastResult;
    return Object.freeze({
      status: 'active',
      reason: null,
      tutorialId: run.definition.id,
      tutorialVersion: run.definition.version,
      workspace: run.definition.workspace,
      stepId: run.definition.steps[run.index].id,
      stepIndex: run.index,
      stepNumber: run.index + 1,
      stepCount: run.definition.steps.length,
      manualRestart: run.manualRestart,
    });
  }

  function stepAllowed(step) {
    if (!step.precondition) return true;
    const predicate = preconditions[step.precondition];
    return typeof predicate === 'function' && Boolean(predicate());
  }

  function availableStep(startIndex, direction) {
    if (!run) return null;
    for (let index = startIndex; index >= 0 && index < run.definition.steps.length; index += direction) {
      const step = run.definition.steps[index];
      if (!stepAllowed(step)) continue;
      const target = anchorRegistry.resolve(step.anchor);
      if (target.status === 'ready') return { index, step, target: target.element };
    }
    return null;
  }

  function deactivate(status, reason, persistAction = null) {
    if (!run) return lastResult;
    const definition = run.definition;
    if (persistAction) persistence[persistAction]?.(definition);
    run = null;
    surface.hide({ restoreFocus: true });
    lastResult = Object.freeze({ status, reason, tutorialId: definition.id, tutorialVersion: definition.version });
    return lastResult;
  }

  function showResolved(resolved) {
    if (!run) return lastResult;
    run.index = resolved.index;
    persistence.progress(run.definition, resolved.step.id);
    surface.show({
      definition: run.definition,
      step: resolved.step,
      stepIndex: resolved.index,
      stepCount: run.definition.steps.length,
      target: resolved.target,
      onNext: next,
      onBack: back,
      onSkip: skip,
      onFinish: finish,
      onTargetLost: targetLost,
    });
    return snapshot();
  }

  function start(tutorialId, { restart = false, resume = false } = {}) {
    const definition = catalog.get(tutorialId);
    if (!definition) throw new RangeError(`Unknown tutorial: ${tutorialId}`);
    if (definition.workspace !== getWorkspace()) {
      lastResult = Object.freeze({ status: 'not_started', reason: 'workspace_mismatch', tutorialId });
      return lastResult;
    }
    if (restart && definition.restartPolicy === 'never') {
      lastResult = Object.freeze({ status: 'not_started', reason: 'restart_not_allowed', tutorialId });
      return lastResult;
    }
    if (run) deactivate('cancelled', 'replaced', 'cancel');
    const stored = persistence.getRecord(definition);
    let index = 0;
    if (resume && stored?.lastStepId) {
      const storedIndex = definition.steps.findIndex((step) => step.id === stored.lastStepId);
      if (storedIndex >= 0) index = storedIndex;
    }
    run = { definition, index, manualRestart: restart };
    const resolved = availableStep(index, 1);
    if (!resolved) return deactivate('cancelled', 'targets_unavailable', 'cancel');
    persistence.begin(definition, {
      manualRestart: restart,
      resume,
      stepId: resolved.step.id,
    });
    return showResolved(resolved);
  }

  function advance({ interactionSatisfied = false } = {}) {
    if (!run) return lastResult;
    const currentStep = run.definition.steps[run.index];
    if (currentStep.interactionRequired && !interactionSatisfied) return snapshot();
    const resolved = availableStep(run.index + 1, 1);
    return resolved ? showResolved(resolved) : finish();
  }

  function next() {
    return advance();
  }

  function back() {
    if (!run) return lastResult;
    const resolved = availableStep(run.index - 1, -1);
    return resolved ? showResolved(resolved) : snapshot();
  }

  function skip() {
    return deactivate('skipped', 'user_skipped', 'skip');
  }

  function finish() {
    return deactivate('completed', 'user_finished', 'complete');
  }

  function cancel(reason = 'cancelled') {
    return deactivate('cancelled', reason, 'cancel');
  }

  function targetLost() {
    return cancel('stale_target');
  }

  function workspaceChanged(workspace) {
    if (run && workspace !== run.definition.workspace) return cancel('workspace_changed');
    return snapshot();
  }

  function handlePresentationEvent(name) {
    if (!run) return lastResult;
    const step = run.definition.steps[run.index];
    if (step.completionTrigger && step.completionTrigger === name) return advance({ interactionSatisfied: true });
    return snapshot();
  }

  function definitionsForWorkspace(workspace) {
    return [...catalog.values()].filter((definition) => definition.workspace === workspace);
  }

  function refresh() {
    if (!run) return lastResult;
    const resolved = availableStep(run.index, 1);
    return resolved ? showResolved(resolved) : cancel('targets_unavailable');
  }

  return Object.freeze({
    schemaVersion: 'tutorial-controller/v1',
    start,
    restart: (tutorialId) => start(tutorialId, { restart: true }),
    next,
    back,
    skip,
    finish,
    cancel,
    targetLost,
    workspaceChanged,
    handlePresentationEvent,
    refresh,
    getState: snapshot,
    getDefinition: (tutorialId) => catalog.get(tutorialId) ?? null,
    getDefinitionsForWorkspace: definitionsForWorkspace,
    getDefinitionForWorkspace: (workspace) => (
      definitionsForWorkspace(workspace)[0] ?? null
    ),
  });
}
