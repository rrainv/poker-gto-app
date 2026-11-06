// EXTRACT-ANALYZE-003: the Analyze Spot rail (#playbookSpotPanel).
//
// Owns the Scenario setup surface: the randomize button with its keep /
// change-only menu, the action, table and accounting controls (slider pairs,
// selects, Advanced rules switch), the rail disclosure summaries, the Scenario
// control authority (read-only while Hand is authoritative) and the readiness
// gate's focus target. The page keeps what is shared with other workspaces:
// the update scheduler (PERF-001), the slider-pair kit, the card picker and
// the single strategy resolution.
//
// Controller: mount(container, deps) -> { dispose, refreshLanguage, handleKey,
// setVisible, ... }. Everything the page provides is injected; the module never
// reaches for window.app and never queries outside its container.

export const ANALYZE_SPOT_SETUP_SCHEMA_VERSION = 'analyze-spot-setup/v1';

// Readiness reasons name canonical Scenario fields; each maps to the control
// whose label the readiness message uses.
export const SCENARIO_READINESS_FIELD_CONTROLS = Object.freeze({
  facingSizeBb: '#facingSizeNum',
  potBb: '#potSizeNum',
  stackBb: '#stackNum',
  tableSize: '#playersNum',
  anteBb: '#anteNum',
  lastAction: '#lastAction',
  heroPosition: '#heroPos',
  heroCards: '[data-card-set-edit="hero"]',
  board: '[data-card-set-edit="board"]',
  street: '[data-card-set-edit="board"]',
  deadCards: '[data-card-set-edit="dead"]',
});

export function scenarioReadinessFocusTarget(resolution, scenarioMode) {
  if (resolution?.mode !== scenarioMode || resolution?.reason !== 'scenario_not_ready') return null;
  const field = resolution.readiness?.reasons?.[0]?.fields?.[0];
  return SCENARIO_READINESS_FIELD_CONTROLS[field] || null;
}

export function scenarioRandomizationFailureMessage(result, target) {
  if (result.code === 'target_locked') {
    return 'Turn off Keep for this item before changing it.';
  }
  if (result.code === 'board_not_applicable') return 'There is no board to change preflop.';
  if (result.code === 'kept_hero_incomplete') return 'Choose two Hero cards or turn off Keep Hero.';
  if (result.code === 'kept_cards_invalid') return 'The kept cards conflict with each other.';
  if (result.code === 'kept_position_unavailable') return 'The kept position does not fit the current rules.';
  if (result.code === 'kept_stack_invalid') return 'Choose a valid stack or turn off Keep Stack.';
  if (result.code === 'kept_context_incompatible') return 'The kept board and betting context do not fit together.';
  if (result.code === 'spot_constraints_unavailable') return 'These Keep settings leave no supported random spot.';
  if (result.code === 'insufficient_available_cards') {
    return target === 'hero'
      ? 'No legal Hero hand is available with the current cards and exclusions.'
      : 'The kept and dead cards leave no legal board.';
  }
  if (result.code === 'betting_context_unavailable') {
    return "Riverline couldn't create a supported betting context without changing the rest of this spot.";
  }
  if (result.code === 'no_alternative_position') return 'No different position is available at this table size.';
  if (result.code === 'scenario_not_ready') return result.readiness?.message || 'Complete this Scenario before randomizing it.';
  return 'Riverline could not create another legal version of this Scenario.';
}

/*
deps (all late-bound functions supplied by the page):
  translate(key, values), isHandMode(), currentStreet()
  modes: { HAND, SCENARIO }
  controlIds                     -> ids of the Scenario-only controls
  randomizationBridge()          -> the playbook-state bridge (randomizeScenario, randomizationRequestVersion)
  randomization: { keeps(), pending() / setPending(v), recipe() / setRecipe(v) }
  readScenarioInput()            -> the lossy Scenario input snapshot
  newSeed()                      -> randomization seed
  applyScenario(scenario)        -> writes a generated Scenario into the controls
  requestRandomize(target)       -> page entry point (spied by tests); calls randomize()
  updateContext(reason)          -> the page orchestrator (one strategy resolve)
  schedulePlaybookUpdate(reason), commitPlaybookUpdate(reason)   -> PERF-001 scheduler
  bindSliderPair(rangeId, numberId, { onInput, onChange })       -> slider-pair kit
  updatePositions(), reconcileActionDependencies()
  expandContext()                -> opens a collapsed Spot rail
  handContext()                  -> the Hand handoff slot (or null)
  savedSpotContext()             -> the open Saved spot (or null)
  closeSavedSpot()               -> the page's "close saved context" action
  navigate(destination)          -> product navigation (Back to Hand / Training)
  streetLabel(street), displayCard(card), formatFixed(value, digits)
*/
export function mountAnalyzeSpotSetup(container, deps) {
  const t = (key, values) => deps.translate(key, values);
  const byId = (id) => container.querySelector(`#${id}`);
  const all = (selector) => Array.from(container.querySelectorAll(selector));
  const doc = container.ownerDocument;
  let visible = false;
  let disposed = false;
  const cleanups = [];
  const listen = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };

  /* ---------------------------------------------------------- randomize */

  function setRandomizationStatus(message) {
    const status = byId('scenarioRandomizeStatus');
    if (status) status.textContent = message ? t(message) : '';
  }

  function randomizationTargetLabel(target) {
    return t({
      spot: 'Complete spot',
      hero: 'Hero hand',
      board: 'Board',
      position: 'Position',
      stack: 'Stack',
      betting_context: 'Betting context',
    }[target] || target);
  }

  function renderRandomizationRecipe(recipe = deps.randomization.recipe()) {
    const details = byId('scenarioRandomizationDetails');
    if (!details) return;
    details.hidden = !recipe;
    if (!recipe) return;
    if (byId('scenarioRecipeTarget')) {
      byId('scenarioRecipeTarget').textContent = randomizationTargetLabel(recipe.target);
    }
    if (byId('scenarioRecipeSeed')) byId('scenarioRecipeSeed').textContent = String(recipe.seed);
    if (byId('scenarioRecipeVersion')) byId('scenarioRecipeVersion').textContent = recipe.generatorVersion;
  }

  function renderRandomizationControls() {
    const keeps = deps.randomization.keeps();
    all('[data-scenario-keep]').forEach((button) => {
      button.setAttribute('aria-pressed', String(keeps[button.dataset.scenarioKeep] === true));
    });
    all('[data-scenario-randomize-target]').forEach((button) => {
      const target = button.dataset.scenarioRandomizeTarget;
      button.disabled = keeps[target] === true
        || (target === 'board' && deps.currentStreet() === 'preflop');
      if (button.disabled) {
        button.title = t(keeps[target]
          ? 'Turn off Keep for this item before changing it.'
          : 'There is no board to change preflop.');
      } else {
        button.removeAttribute('title');
      }
    });
    renderRandomizationRecipe();
  }

  function randomizationSuccessMessage(result) {
    if (result.recipe.target === 'spot') {
      const kept = Object.entries(result.recipe.keeps)
        .filter(([, value]) => value)
        .map(([group]) => t({
          hero: 'Hero', board: 'board / street', position: 'position',
          stack: 'stack', betting_context: 'betting context',
        }[group]));
      const streetLabel = t(result.scenario.street.charAt(0).toUpperCase() + result.scenario.street.slice(1));
      return kept.length
        ? t('New {street} spot. Kept {groups}.', { street: streetLabel, groups: kept.join(', ') })
        : t('New {table}-max {street} spot.', { table: result.scenario.tableSize, street: streetLabel });
    }
    const changed = result.changedGroups[0];
    if (changed === 'hero') return 'Changed only Hero.';
    if (changed === 'board') return 'Changed only the board.';
    if (changed === 'position') return 'Changed only the position.';
    if (changed === 'stack') return 'Changed only the stack.';
    if (changed === 'betting_context') {
      return 'Changed only the betting context.';
    }
    return 'New random spot.';
  }

  async function randomize(target = 'spot') {
    if (disposed || deps.isHandMode() || deps.randomization.pending()) return false;
    const bridge = deps.randomizationBridge();
    if (!bridge?.randomizeScenario || !bridge?.randomizationRequestVersion) {
      setRandomizationStatus('Randomization is unavailable right now.');
      return false;
    }
    deps.randomization.setPending(true);
    const primary = byId('scenarioRandomizeButton');
    if (primary) {
      primary.disabled = true;
      primary.setAttribute('aria-busy', 'true');
    }
    try {
      const result = bridge.randomizeScenario({
        schemaVersion: bridge.randomizationRequestVersion,
        scenario: deps.readScenarioInput(),
        target,
        keeps: { ...deps.randomization.keeps() },
        seed: deps.newSeed(),
      });
      if (result.status !== 'available') {
        setRandomizationStatus(scenarioRandomizationFailureMessage(result, target));
        return false;
      }
      deps.applyScenario(result.scenario);
      deps.randomization.setRecipe(result.recipe);
      renderRandomizationRecipe(result.recipe);
      setRandomizationStatus(randomizationSuccessMessage(result));
      await deps.updateContext('Scenario randomized');
      return true;
    } catch (error) {
      console.error('[Riverline Analyze randomization]', error);
      setRandomizationStatus('Riverline could not create another legal version of this Scenario.');
      return false;
    } finally {
      deps.randomization.setPending(false);
      if (primary) {
        primary.disabled = false;
        primary.removeAttribute('aria-busy');
      }
      const menu = byId('scenarioRandomizationMenu');
      if (menu) menu.open = false;
      renderRandomizationControls();
    }
  }

  async function copyRandomizationRecipe() {
    const recipe = deps.randomization.recipe();
    if (!recipe) return false;
    try {
      await deps.writeClipboard(JSON.stringify(recipe, null, 2));
      setRandomizationStatus('Randomization recipe copied.');
      return true;
    } catch (error) {
      setRandomizationStatus('The randomization recipe could not be copied.');
      return false;
    }
  }

  function bindRandomization() {
    listen(byId('scenarioRandomizeButton'), 'click', () => {
      void deps.requestRandomize('spot');
    });
    all('[data-scenario-keep]').forEach((button) => {
      listen(button, 'click', () => {
        const group = button.dataset.scenarioKeep;
        const keeps = deps.randomization.keeps();
        keeps[group] = !keeps[group];
        renderRandomizationControls();
      });
    });
    all('[data-scenario-randomize-target]').forEach((button) => {
      listen(button, 'click', () => {
        void deps.requestRandomize(button.dataset.scenarioRandomizeTarget);
      });
    });
    listen(byId('scenarioCopyRecipe'), 'click', () => {
      void copyRandomizationRecipe();
    });
    const menu = byId('scenarioRandomizationMenu');
    listen(menu, 'keydown', (event) => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault();
      menu.open = false;
      menu.querySelector('summary')?.focus({ preventScroll: true });
    });
    listen(doc, 'click', (event) => {
      if (menu?.open
        && !menu.contains(event.target)
        && event.target !== byId('scenarioRandomizeButton')) {
        menu.open = false;
      }
    });
  }

  /* ------------------------------------------------- setup controls (PERF-001) */

  // The scheduler stays on the page: each control only says which update it
  // asks for. Drag/typing is coalesced to the latest frame; the final change
  // flushes at once.
  function bindSetupControls() {
    deps.bindSliderPair('players', 'playersNum', {
      onInput: () => {
        deps.updatePositions();
        deps.schedulePlaybookUpdate('Table size changed');
      },
      onChange: () => {
        deps.updatePositions();
        deps.commitPlaybookUpdate('Table size changed');
      },
    });
    [
      ['stack', 'stackNum', 'Stack changed'],
      ['ante', 'anteNum', 'Ante changed'],
      ['facingSize', 'facingSizeNum', 'Facing size changed'],
      ['potSize', 'potSizeNum', 'Pot size changed'],
    ].forEach(([rangeId, numberId, reason]) => {
      deps.bindSliderPair(rangeId, numberId, {
        onInput: () => deps.schedulePlaybookUpdate(reason),
        onChange: () => deps.commitPlaybookUpdate(reason),
      });
    });
    ['rakeMode', 'stackMode', 'heroPos', 'straddle'].forEach((id) => {
      listen(byId(id), 'change', () => {
        deps.updateContext('Configuration changed');
      });
    });
    listen(byId('lastAction'), 'change', () => {
      deps.reconcileActionDependencies();
      deps.updateContext('Configuration changed');
    });
    const advanced = byId('toggleAdvanced');
    listen(advanced, 'click', () => {
      const enabled = advanced.classList.toggle('on');
      advanced.setAttribute('aria-pressed', enabled);
      if (byId('advancedRules')) byId('advancedRules').classList.toggle('hidden', !enabled);
    });
  }

  /* ------------------------------------------------- disclosure summaries */

  // Collapsed rail disclosures summarize their current values (no computation).
  function syncDisclosureSummaries() {
    const adjustment = byId('playbookStrategyAdjustmentSummary');
    if (adjustment) {
      adjustment.textContent = [byId('tightnessLabel')?.textContent, byId('oppTightnessLabel')?.textContent]
        .map((value) => String(value || '').trim()).filter(Boolean).join(' · ');
    }
    const accounting = byId('playbookGameAccountingSummary');
    const rake = byId('rakeMode');
    if (accounting && rake) accounting.textContent = rake.selectedOptions?.[0]?.textContent?.trim() || '';
  }

  function bindDisclosureSummaries() {
    ['tightnessSlider', 'oppTightnessSlider', 'rakeMode'].forEach((id) => {
      listen(byId(id), 'input', () => queueMicrotask(syncDisclosureSummaries));
      listen(byId(id), 'change', () => queueMicrotask(syncDisclosureSummaries));
    });
  }

  /* ------------------------------------------- Scenario control authority */

  // Scenario controls are read-only while the canonical Hand is authoritative.
  // The shell parts (mode buttons, section visibility) stay on the page.
  function setControlAuthority(mode) {
    const handMode = mode === deps.modes.HAND;
    deps.controlIds.forEach((id) => {
      const control = byId(id);
      if (!control) return;
      control.disabled = handMode;
      control.toggleAttribute('data-scenario-only', handMode);
      if (handMode) {
        control.setAttribute('aria-describedby', 'playbookModeStatus');
        control.title = t('Scenario-only control; ignored while the canonical hand is authoritative.');
      } else {
        control.removeAttribute('aria-describedby');
        control.removeAttribute('title');
      }
    });
    all('[data-card-clear-surface="scenario"]').forEach((button) => {
      button.disabled = handMode;
      button.toggleAttribute('data-scenario-only', handMode);
    });
  }

  /* ------------------------------------------------------ readiness gate */

  function focusReadinessField(resolution) {
    const selector = scenarioReadinessFocusTarget(resolution, deps.modes.SCENARIO);
    const control = selector ? container.querySelector(selector) : null;
    if (!control) return false;
    if (control.matches('[data-card-set-edit]')) {
      if (!control.getClientRects().length) return false;
      control.click();
      return true;
    }
    for (let node = control.parentElement; node && node !== container.parentElement; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    deps.expandContext();
    const advancedRules = byId('advancedRules');
    if (advancedRules?.contains(control) && advancedRules.classList.contains('hidden')) {
      byId('toggleAdvanced')?.click();
    }
    if (control.disabled || !control.getClientRects().length) return false;
    control.scrollIntoView({ block: 'center', behavior: 'instant' });
    control.focus({ preventScroll: true });
    if (control.tagName === 'INPUT') {
      try { control.select(); } catch { /* Selection is optional for numeric inputs. */ }
    }
    return true;
  }

  /* ------------------------------------------------ Hand-context banner */

  // A decision handed off from a completed Hand (or Full Hand review) shows its
  // exact facts read-only, with the existing route back. Editing any Scenario
  // control turns it into a lossy Scenario. The handoff slot itself stays on the
  // page (three handoffs and updateContext write it); this renders it.
  const workspace = () => container.closest('#gtoMode');

  function renderHandContext() {
    const section = byId('analyzeHandContext');
    const mode = workspace();
    if (!section) return;
    const context = deps.handContext();
    section.hidden = !context;
    if (mode) {
      if (context) mode.dataset.analyzeContext = 'hand';
      else {
        delete mode.dataset.analyzeContext;
        delete mode.dataset.analyzeHandEditing;
      }
    }
    const edit = byId('analyzeHandContextEdit');
    if (edit) edit.setAttribute('aria-expanded', String(Boolean(context && mode?.dataset.analyzeHandEditing === 'true')));
    if (!context) return;
    const decision = context.decisionContext;
    const name = byId('analyzeHandContextName');
    if (name) name.textContent = context.titleKey ? t(context.titleKey, context.titleValues || {}) : '';
    const back = byId('analyzeHandContextReturn');
    if (back) {
      back.dataset.i18n = context.returnLabelKey;
      back.textContent = t(context.returnLabelKey);
    }
    const facts = byId('analyzeHandContextFacts');
    if (!facts || !decision) return;
    const bb = (value) => (Number.isFinite(value) ? `${deps.formatFixed(value, 1)} bb` : t('Unavailable'));
    const cards = (list) => (list || []).filter(Boolean).map(deps.displayCard).join(' ');
    const rows = [
      ['Position', decision.heroPosition || '-'],
      ['Street', deps.streetLabel(decision.street)],
      ['Hero hand', cards(decision.heroCards) || t('Unknown'), true],
      ['Board', cards(decision.board) || t('Preflop · no board'), Boolean(cards(decision.board))],
      ['Pot', bb(decision.currentPotBb ?? decision.potBb), true],
      ['To call', Number.isFinite(decision.callAmountBb) ? bb(decision.callAmountBb) : t('facing.price.unavailable'), Number.isFinite(decision.callAmountBb)],
      ['Stack', bb(decision.heroStackBb ?? decision.stackBb), true],
    ];
    facts.replaceChildren(...rows.map(([label, value, island]) => {
      const row = doc.createElement('div');
      const term = doc.createElement('dt');
      term.dataset.i18n = label;
      term.textContent = t(label);
      const detail = doc.createElement('dd');
      if (island) {
        detail.dir = 'ltr';
        detail.classList.add('poker-island');
      }
      detail.textContent = value;
      row.append(term, detail);
      return row;
    }));
    renderHandContextStackNote(decision, bb);
  }

  // ANALYZE-HANDOFF-STACK-001: the Scenario model is deliberately lossy. Its Stack
  // control is the configured STARTING stack, and a Scenario never carries the Hero
  // or effective stack at a decision (DecisionContext marks both unavailable). So
  // when the Hand decision was made with a different stack, the panel says so
  // instead of leaving the facts (Hero stack) and the controls (starting stack)
  // to disagree silently.
  function renderHandContextStackNote(decision, bb) {
    const note = byId('analyzeHandContextStackNote');
    if (!note) return;
    // Unknown is never zero: null stays NaN, never 0.
    const known = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : NaN);
    const starting = known(decision.startingStackBb ?? decision.stackBb);
    const hero = known(decision.heroStackBb);
    const effective = known(decision.effectiveStackBb);
    const differs = (value) => Number.isFinite(value) && Number.isFinite(starting) && Math.abs(value - starting) > 1e-9;
    const show = Number.isFinite(hero) && (differs(hero) || differs(effective));
    note.hidden = !show;
    if (!show) {
      note.textContent = '';
      return;
    }
    const key = Number.isFinite(effective)
      ? 'Stack at this decision: Hero {hero}, effective {effective}. Edit as Scenario starts from the starting stack ({starting}) and cannot keep these, so SPR and pot odds can change.'
      : 'Stack at this decision: Hero {hero}. Edit as Scenario starts from the starting stack ({starting}) and cannot keep it, so SPR and pot odds can change.';
    note.textContent = t(key, { hero: bb(hero), effective: bb(effective), starting: bb(starting) });
  }

  function bindHandContext() {
    listen(byId('analyzeHandContextReturn'), 'click', () => {
      const destination = deps.handContext()?.returnDestination;
      if (destination) deps.navigate(destination);
    });
    listen(byId('analyzeHandContextEdit'), 'click', (event) => {
      const mode = workspace();
      if (!mode) return;
      const editing = mode.dataset.analyzeHandEditing !== 'true';
      if (editing) mode.dataset.analyzeHandEditing = 'true';
      else delete mode.dataset.analyzeHandEditing;
      event.currentTarget.setAttribute('aria-expanded', String(editing));
    });
  }

  /* ------------------------------------------------------- Saved banner */

  function renderSavedBanner(result = deps.savedSpotContext()) {
    const banner = byId('savedSpotViewerBanner');
    if (!banner) return;
    banner.hidden = !result;
    if (!result) return;
    const title = result.object.annotations.title || t('Saved study spot');
    byId('savedSpotViewerTitle').textContent = title;
    byId('savedSpotViewerTruth').textContent = t(result.derivation === 'scenario'
      ? 'Scenario-derived · history unavailable'
      : 'Hand-derived · canonical decision context; history unavailable');
  }

  function bindSavedBanner() {
    listen(byId('savedSpotCloseButton'), 'click', () => deps.closeSavedSpot());
  }

  bindRandomization();
  bindSetupControls();
  bindDisclosureSummaries();
  bindHandContext();
  bindSavedBanner();
  syncDisclosureSummaries();

  return {
    schemaVersion: ANALYZE_SPOT_SETUP_SCHEMA_VERSION,
    randomize,
    renderRandomizationControls,
    setControlAuthority,
    focusReadinessField,
    readinessFocusTarget: (resolution) => scenarioReadinessFocusTarget(resolution, deps.modes.SCENARIO),
    syncDisclosureSummaries,
    renderHandContext,
    renderSavedBanner,
    refreshLanguage() {
      if (disposed) return;
      renderHandContext();
      renderSavedBanner();
      if (!deps.savedSpotContext()) {
        if (byId('savedSpotViewerTitle')) byId('savedSpotViewerTitle').textContent = t('Saved study spot');
        if (byId('savedSpotViewerTruth')) byId('savedSpotViewerTruth').textContent = t('History unavailable');
      }
      syncDisclosureSummaries();
    },
    // The orchestrator pushes visibility; the module never reads display.
    setVisible(next) { visible = Boolean(next); },
    isVisible() { return visible; },
    handleKey() { return false; },
    dispose() {
      if (disposed) return;
      disposed = true;
      visible = false;
      cleanups.splice(0).forEach((cleanup) => cleanup());
    },
  };
}

export { mountAnalyzeSpotSetup as mount };

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineAnalyzeSpotSetup', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: ANALYZE_SPOT_SETUP_SCHEMA_VERSION,
      mount: mountAnalyzeSpotSetup,
      scenarioReadinessFocusTarget,
      scenarioRandomizationFailureMessage,
    }),
    writable: false,
  });
}
