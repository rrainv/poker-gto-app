import { createTutorialAnchorRegistry } from '../tutorial/anchors.mjs';
import { createCoachMarkSurface } from '../tutorial/coach-mark.mjs';
import { createTutorialController } from '../tutorial/controller.mjs';
import { CURRENT_APP_TUTORIAL_DEFINITIONS } from '../tutorial/current-app-tutorials.mjs';
import { HOME_TUTORIAL_DEFINITION } from '../tutorial/home-tutorial.mjs';
import { SAVED_TUTORIAL_DEFINITION } from '../tutorial/saved-tutorial.mjs';
import { createTutorialPersistence } from '../tutorial/persistence.mjs';

const DEFINITIONS = Object.freeze([
  HOME_TUTORIAL_DEFINITION,
  SAVED_TUTORIAL_DEFINITION,
  ...CURRENT_APP_TUTORIAL_DEFINITIONS,
]);

export function installTutorialBridge(browserWindow, options = {}) {
  if (!browserWindow?.document) return null;
  const document = browserWindow.document;
  const persistence = options.persistence ?? createTutorialPersistence({
    storage: options.storage ?? browserWindow.localStorage,
  });
  const surface = options.surface ?? createCoachMarkSurface({
    document,
    window: browserWindow,
    translate: (key, parameters) => browserWindow.t?.(key, parameters) ?? key,
  });
  const elementShown = (selector) => {
    const element = document.querySelector(selector);
    return Boolean(element && !element.hidden && element.getAttribute?.('aria-hidden') !== 'true');
  };
  const defaultPreconditions = {
    'saved-spot-open': () => elementShown('#savedSpotViewerBanner'),
    'saved-hand-open': () => elementShown('#savedHandViewerBanner'),
    'hand-action-ready': () => elementShown('#handDealSection') || elementShown('#handChanceSection') || elementShown('#handActionSection'),
    'hand-review-ready': () => elementShown('#handReviewSurface'),
    'hand-save-ready': () => Boolean(document.querySelector('#handSavedStudyActionMount button')),
    'training-question-ready': () => elementShown('#trainingExerciseSurface'),
    'training-answered': () => elementShown('#trainingFeedback'),
    'calibration-empty': () => elementShown('#calibrationEmptyState'),
    'calibration-configured': () => elementShown('#calibrationConfiguredState'),
    'calibration-question-ready': () => elementShown('#calibrationQuestionView'),
    'saved-library-ready': () => elementShown('#homeSavedOverview'),
  };
  const currentWorkspace = () => (
    document.querySelector('#settingsModal.show') ? 'settings'
      : document.querySelector('.riverline-shell')?.dataset.activeMode === 'home'
        && document.querySelector('.riverline-shell')?.dataset.activeDestination === 'saved'
        ? 'saved'
        : document.querySelector('.riverline-shell')?.dataset.activeMode ?? null
  );
  const controller = createTutorialController({
    definitions: options.definitions ?? DEFINITIONS,
    persistence,
    anchorRegistry: options.anchorRegistry ?? createTutorialAnchorRegistry({
      root: document,
      getComputedStyle: browserWindow.getComputedStyle.bind(browserWindow),
    }),
    surface,
    getWorkspace: currentWorkspace,
    preconditions: { ...defaultPreconditions, ...(options.preconditions ?? {}) },
  });
  let offer = null;
  let chooser = null;
  let chooserInvoker = null;

  const playbookMode = () => document.querySelector('#gtoMode')?.dataset.playbookMode ?? 'scenario';
  const definitionAvailability = {
    'playbook.scenario-basics': () => playbookMode() === 'scenario',
    'playbook.hand-mode': () => playbookMode() === 'hand',
    'playbook.replay': () => playbookMode() === 'hand'
      && (elementShown('#savedHandViewerBanner') || document.querySelector('#handReplayPreviousButton:not([disabled])')),
    'training.feedback': () => elementShown('#trainingFeedback'),
    'calibration.answers': () => elementShown('#calibrationQuestionView'),
    'settings.preferences': () => currentWorkspace() === 'settings',
    ...(options.definitionAvailability ?? {}),
  };

  function availableDefinitions(workspace) {
    return controller.getDefinitionsForWorkspace(workspace).filter((definition) => {
      const predicate = definitionAvailability[definition.id];
      return typeof predicate !== 'function' || Boolean(predicate());
    });
  }

  function removeOffer() {
    offer?.remove?.();
    offer = null;
  }

  function closeChooser({ restoreFocus = true } = {}) {
    chooser?.remove?.();
    chooser = null;
    if (restoreFocus) chooserInvoker?.focus?.({ preventScroll: true });
    chooserInvoker = null;
  }

  function openChooser(workspace, invoker = document.querySelector('#workspaceTutorialButton')) {
    closeChooser({ restoreFocus: false });
    const definitions = availableDefinitions(workspace)
      .filter((definition) => definition.restartPolicy !== 'never');
    if (definitions.length === 0) return false;
    if (definitions.length === 1) {
      removeOffer();
      controller.restart(definitions[0].id);
      return true;
    }
    chooserInvoker = invoker;
    const panel = document.createElement('section');
    panel.className = 'tutorial-chooser';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'tutorialChooserTitle');
    const header = document.createElement('div');
    header.className = 'tutorial-chooser-head';
    const heading = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'tutorialChooserTitle';
    title.textContent = browserWindow.t?.('Tutorials') ?? 'Tutorials';
    const description = document.createElement('p');
    description.textContent = browserWindow.t?.('Choose a tutorial for this workspace.') ?? 'Choose a tutorial for this workspace.';
    heading.append(title, description);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ui-button ui-button--icon';
    close.setAttribute('aria-label', browserWindow.t?.('Close tutorials') ?? 'Close tutorials');
    close.textContent = '×';
    close.addEventListener('click', () => closeChooser());
    header.append(heading, close);
    const list = document.createElement('div');
    list.className = 'tutorial-chooser-list';
    definitions.forEach((definition) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tutorial-chooser-option';
      const optionTitle = document.createElement('strong');
      optionTitle.textContent = browserWindow.t?.(definition.titleKey) ?? definition.titleKey;
      const optionDescription = document.createElement('span');
      optionDescription.textContent = browserWindow.t?.(definition.descriptionKey) ?? definition.descriptionKey;
      button.append(optionTitle, optionDescription);
      button.addEventListener('click', () => {
        const tutorialInvoker = chooserInvoker;
        closeChooser({ restoreFocus: false });
        tutorialInvoker?.focus?.({ preventScroll: true });
        removeOffer();
        controller.restart(definition.id);
      });
      list.append(button);
    });
    panel.append(header, list);
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChooser();
      }
    });
    document.body.append(panel);
    chooser = panel;
    list.querySelector('button')?.focus?.();
    return true;
  }

  function updateManualAction(workspace) {
    const button = document.querySelector('#workspaceTutorialButton');
    if (!button) return;
    const definitions = availableDefinitions(workspace).filter((definition) => definition.restartPolicy !== 'never');
    button.hidden = definitions.length === 0 || workspace === 'settings';
    button.dataset.tutorialWorkspace = definitions.length ? workspace : '';
    button.dataset.tutorialId = definitions.length === 1 ? definitions[0].id : '';
    button.setAttribute('aria-label', browserWindow.t?.('Restart tutorial') ?? 'Restart tutorial');
    button.title = browserWindow.t?.('Tutorial') ?? 'Tutorial';
    const settingsButton = document.querySelector('#settingsTutorialButton');
    if (settingsButton) {
      settingsButton.setAttribute('aria-label', browserWindow.t?.('Restart Settings tour') ?? 'Restart Settings tour');
      settingsButton.title = browserWindow.t?.('Restart Settings tour') ?? 'Restart Settings tour';
    }
  }

  function createOffer(definition, container) {
    removeOffer();
    const record = persistence.getRecord(definition);
    const region = document.createElement('section');
    region.className = 'tutorial-offer';
    region.dataset.tutorialOffer = definition.id;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-labelledby', 'tutorialOfferTitle');
    const copy = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'tutorial-offer-eyebrow';
    eyebrow.textContent = browserWindow.t?.('Guided tour available') ?? 'Guided tour available';
    const title = document.createElement('h2');
    title.id = 'tutorialOfferTitle';
    title.textContent = browserWindow.t?.(definition.titleKey) ?? definition.titleKey;
    const description = document.createElement('p');
    description.textContent = browserWindow.t?.(definition.descriptionKey) ?? definition.descriptionKey;
    copy.append(eyebrow, title, description);
    const actions = document.createElement('div');
    actions.className = 'tutorial-offer-actions';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'ui-button ui-button--quiet';
    skip.textContent = browserWindow.t?.('Skip') ?? 'Skip';
    const start = document.createElement('button');
    start.type = 'button';
    start.className = 'ui-button ui-button--primary';
    const resume = record?.firstUseStatus === 'in_progress';
    start.textContent = browserWindow.t?.(resume ? 'Continue tutorial' : 'Start tutorial')
      ?? (resume ? 'Continue tutorial' : 'Start tutorial');
    skip.addEventListener('click', () => {
      persistence.skip(definition);
      removeOffer();
    }, { once: true });
    start.addEventListener('click', () => {
      removeOffer();
      controller.start(definition.id, { resume });
    }, { once: true });
    actions.append(skip, start);
    region.append(copy, actions);
    container.prepend(region);
    offer = region;
  }

  function offerForWorkspace(workspace, container = document.querySelector(`#${workspace}Mode`)) {
    updateManualAction(workspace);
    const definition = availableDefinitions(workspace).find((candidate) => (
      candidate.firstUsePolicy === 'prompt' && persistence.shouldOffer(candidate)
    ));
    if (!definition || !container || !persistence.shouldOffer(definition) || controller.getState().status === 'active') {
      removeOffer();
      return false;
    }
    if (offer?.dataset.tutorialOffer === definition.id && offer.isConnected) return true;
    createOffer(definition, container);
    return true;
  }

  function workspaceChanged(workspace) {
    controller.workspaceChanged(workspace);
    removeOffer();
    closeChooser({ restoreFocus: false });
    updateManualAction(workspace);
  }

  const manualButton = document.querySelector('#workspaceTutorialButton');
  manualButton?.addEventListener('click', () => {
    openChooser(manualButton.dataset.tutorialWorkspace, manualButton);
  });

  const settingsButton = document.querySelector('#settingsTutorialButton');
  settingsButton?.addEventListener('click', () => openChooser('settings', settingsButton));

  browserWindow.addEventListener('riverline:languagechange', () => {
    const workspace = currentWorkspace();
    closeChooser({ restoreFocus: false });
    updateManualAction(workspace);
    const offerContainer = offer?.parentElement ?? null;
    if (offerContainer) {
      removeOffer();
      offerForWorkspace(workspace, offerContainer);
    }
    if (controller.getState().status === 'active') controller.refresh();
  });

  const bridge = Object.freeze({
    schemaVersion: 'tutorial-system/v1',
    offerForWorkspace,
    workspaceChanged,
    updateManualAction,
    openDiscovery: openChooser,
    getDefinitionsForWorkspace: (workspace) => availableDefinitions(workspace),
    notify: (eventName) => controller.handlePresentationEvent(eventName),
    cancel: (reason = 'cancelled') => controller.cancel(reason),
    cancelForOverlay: () => {
      closeChooser({ restoreFocus: false });
      return controller.cancel('overlay_opened');
    },
    start: (tutorialId, options_) => controller.start(tutorialId, options_),
    restart: (tutorialId) => controller.restart(tutorialId),
    getState: () => controller.getState(),
    getPersistenceRecord: (tutorialId) => {
      const definition = controller.getDefinition(tutorialId);
      return definition ? persistence.getRecord(definition) : null;
    },
    getDiagnostics: () => ({
      persistence: persistence.diagnostics(),
      surface: surface.diagnostics?.() ?? null,
      definitionCount: DEFINITIONS.length,
      chooserMounted: Boolean(chooser),
    }),
  });
  Object.defineProperty(browserWindow, 'RiverlineTutorials', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  updateManualAction(currentWorkspace());
  return bridge;
}

if (typeof window !== 'undefined') installTutorialBridge(window);
