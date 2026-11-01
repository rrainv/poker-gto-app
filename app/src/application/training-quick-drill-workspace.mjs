// EXTRACT-QUICKDRILL-001: the quick drill workspace (TRAINING-QUICK-001),
// moved out of core/logic.js as a mounted controller. Rendering, answer
// selection and confirm, the feedback swap, the rail panels, session end,
// the Feel popover and the drill keys all live here. The drill does no poker
// maths and owns no strategy or Training Memory call: it renders what the
// view model (training-quick-drill.mjs) projects and hands answers back to
// Training through injected callbacks. Its session state stays on
// app.training.quick (read through deps.training()), as before the move.
//
// mount(container, deps) returns { dispose, refreshLanguage, handleKey,
// setVisible } plus the hooks Training calls on every state change.
//
// deps (all injected, never the whole window.app):
//   training()            the live app.training object (accessor, not a copy)
//   translate(key, vars)  UI translation
//   formatBb, formatInteger, formatPercent   locale number formatting
//   storage()             the answer-mode localStorage, or null
//   verdictApi()          window.RiverlineAnalyzeVerdict, or undefined
//   toast(message)        transient notice
//   sessionMode(), sameSpotActive()          Training mode lookups
//   actionLabel(type, decisionContext), facingCopy(context)
//   truth(evaluation, exercise), truthPresentation(truth), term(key)
//   displayCard(card), cardMarkup(card), formatHand(cards), handCode(row, column)
//   ranks(), preflopRanges()   the fixed class sample the Analyze range uses
//   motionTravelAllowed()
//   chooseAnswer(type), nextExercise()       hand control back to Training
//   openMemory(view), setSetupExpanded(expanded, options)
//   projectDecisionControls(fullHandActive)  re-places the decision controls
import * as view from './training-quick-drill.mjs';
import * as components from '../ui/drill-components.mjs';

// Amounts inside a sentence stay one left-to-right island in Hebrew
// (LRI ... PDI), like the poker islands built as elements.
export function isolateAmounts(text) {
  return String(text).replace(/\d[\d.,]*(?: | )?bb/g, (amount) => `⁦${amount}⁩`);
}

export function mount(container, deps) {
  const document = container.ownerDocument;
  const $ = (selector) => document.querySelector(selector);
  const { formatBb } = deps;
  const t = (key, values) => deps.translate(key, values);
  const app = { get training() { return deps.training(); } };
  const trainingSessionMode = () => deps.sessionMode();
  const trainingSameSpotIsActive = () => deps.sameSpotActive();
  const trainingActionLabel = (type, context) => deps.actionLabel(type, context);
  const formatTrainingFacingCopy = (context) => deps.facingCopy(context);
  const trainingTruth = (evaluation, exercise) => deps.truth(evaluation, exercise);
  const truthPresentation = (truth) => deps.truthPresentation(truth);
  const trainingTerm = (key) => deps.term(key);
  const formatUiInteger = (value) => deps.formatInteger(value);
  const formatUiPercent = (value, digits) => deps.formatPercent(value, digits);
  const displayCard = (card) => deps.displayCard(card);
  const cardMarkup = (card) => deps.cardMarkup(card);
  const formatHand = (cards) => deps.formatHand(cards);
  const handCode = (row, column) => deps.handCode(row, column);
  const motionTravelAllowed = () => deps.motionTravelAllowed();
  const handleTrainingGuess = (type) => deps.chooseAnswer(type);
  const requestNextTrainingExercise = () => deps.nextExercise();
  const openTrainingMemoryView = (name) => deps.openMemory(name);
  const setTrainingSetupExpanded = (expanded, options) => deps.setSetupExpanded(expanded, options);
  const projectTrainingDecisionControls = (fullHandActive) => deps.projectDecisionControls(fullHandActive);
  const toast = (message) => deps.toast(message);
  const RANKS = deps.ranks();
  const PREFLOP_RANGES = deps.preflopRanges();

  // Every listener the drill adds goes through here so dispose() can remove
  // them all. Entries for nodes the drill has since replaced are dropped.
  const listeners = [];
  let disposed = false;
  function listen(target, type, handler) {
    if (!target) return;
    if (listeners.length > 64) {
      for (let index = listeners.length - 1; index >= 0; index -= 1) {
        const entry = listeners[index];
        if (entry.target !== document && entry.target.isConnected === false) listeners.splice(index, 1);
      }
    }
    target.addEventListener(type, handler);
    listeners.push({ target, type, handler });
  }

  const QUICK_DRILL_PANEL_IDS = ['glance', 'range', 'session', 'plan', 'similar'];
  const QUICK_DRILL_PANEL_TITLES = {
    glance: 'Spot at a glance',
    range: "Opponent's range",
    session: 'This session',
    plan: 'Your plan',
    similar: 'Similar spots',
  };
  const QUICK_DRILL_SPOT_TYPE_LABELS = {
    preflop_unopened: 'First in',
    preflop_facing_open: 'Facing an open',
    preflop_facing_3bet: 'Facing a 3-bet',
    preflop_facing_4bet: 'Facing a 4-bet',
    preflop_bb_option: "Big blind's option",
    postflop_first_action: 'First to act after the flop',
    postflop_facing_bet: 'Facing a bet',
    postflop_facing_raise: 'Facing a raise',
  };

  function quickDrillApi() {
    return { view, components };
  }

  function quickDrillState() {
    app.training.quick ||= {
      selected: null,
      exerciseId: null,
      answer: null,
      results: [],
      openPanels: new Set(['glance', 'range']),
      answerMode: null,
      finishPending: false,
      previousFacts: {},
    };
    return app.training.quick;
  }

  function quickDrillApplies() {
    return Boolean(quickDrillApi()) && (trainingSessionMode() !== 'full_hand' || trainingSameSpotIsActive());
  }

  // Amounts never break between the number and its unit.
  function quickDrillFormatBb(value) {
    return formatBb(value).replace(' bb', '\u00a0bb');
  }

  // Amounts inside a sentence stay one left-to-right island in Hebrew
  // (LRI ... PDI), like the poker islands built as elements.
  function quickDrillInlineBb(value) {
    return quickDrillIsolateAmounts(quickDrillFormatBb(value));
  }

  const quickDrillIsolateAmounts = isolateAmounts;

  let unsubscribeAnswerMode = null;

  function quickDrillAnswerStore() {
    const state = quickDrillState();
    if (!state.answerMode && quickDrillApi()) {
      let storage = null;
      try { storage = deps.storage(); } catch { storage = null; }
      state.answerMode = quickDrillApi().components.createAnswerModeStore({ storage });
    }
    return state.answerMode;
  }

  function quickDrillLabel(label) {
    return label === 'Open' ? t('quickDrill.action.open') : t(label);
  }

  function quickDrillActionName(type, decisionContext) {
    return quickDrillLabel(trainingActionLabel(type, decisionContext));
  }

  function quickDrillElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function quickDrillIsland(text) {
    return quickDrillApi().components.pokerIsland(document, text);
  }

  // Places the setup, the decision controls and the rail panels for the
  // current mode and state. Runs on every Training state change.
  function syncQuickDrillComposition(state = document.querySelector('.training-workspace')?.dataset.trainingState) {
    const workspace = $('#trainingWorkspace');
    if (!workspace) return;
    const on = quickDrillApplies();
    workspace.dataset.trainingQuick = on ? 'true' : 'false';
    setVisible(on);
    const panels = $('#quickDrillPanels');
    if (panels) panels.hidden = !on || ['idle', 'error'].includes(state);
    const setup = $('#trainingSetupPanel');
    const mount = $('#quickDrillSetupMount');
    if (setup && mount && panels) {
      if (on && setup.parentElement !== mount) mount.append(setup);
      if (!on && setup.parentElement === mount) panels.after(setup);
    }
    if (!on) delete workspace.dataset.quickDetails;
    const next = $('#trainingNextHandBtn');
    const continuation = $('#trainingContinuationRow');
    if (next && continuation && (!on || state !== 'feedback') && next.parentElement !== continuation) {
      continuation.prepend(next);
      next.classList.remove('quick-drill-next');
      delete next.dataset.i18n;
      next.textContent = t(state === 'feedback' ? 'Next exercise' : 'Skip / next exercise');
    }
    projectTrainingDecisionControls(workspace.dataset.trainingFullHandPhase === 'live');
  }

  function renderQuickDrill(exercise) {
    if (!quickDrillApplies() || !exercise) return;
    const state = quickDrillState();
    const roll = state.exerciseId !== null;
    state.exerciseId = exercise.id;
    state.selected = null;
    state.answer = null;
    state.finishPending = false;
    const confirm = $('#quickDrillConfirm');
    if (confirm) quickDrillApi().components.markConfirmed(confirm, false);
    const workspace = $('#trainingWorkspace');
    if (workspace) delete workspace.dataset.quickDetails;
    const presentation = app.training.currentPresentation || exercise.presentation;
    renderQuickDrillSpotLine(exercise);
    renderQuickDrillSource(exercise);
    renderQuickDrillDots();
    renderQuickDrillFelt(exercise, presentation);
    renderQuickDrillFacts(exercise, { answered: false, roll });
    setQuickDrillZone('actions');
    renderQuickDrillPanels();
  }

  function renderQuickDrillSpotLine(exercise) {
    const context = exercise.decisionContext;
    const title = $('#quickDrillSpotTitle');
    const sub = $('#quickDrillSpotSub');
    if (title) {
      title.replaceChildren(quickDrillIsland(context.heroPosition || '-'), document.createTextNode(` · ${quickDrillIsolateAmounts(formatTrainingFacingCopy(context))}`));
    }
    if (sub) {
      const street = t(String(context.street || 'preflop').charAt(0).toUpperCase() + String(context.street || 'preflop').slice(1));
      sub.textContent = t('{table} · {stack} effective · {street}', {
        table: t('analysis.value.tableSize', { count: context.tableSize }),
        stack: quickDrillInlineBb(context.effectiveStackBb ?? context.stackBb),
        street,
      });
    }
  }

  // One combined source/tier label per surface (D-31), in the drill head.
  function renderQuickDrillSource(exercise) {
    const mount = $('#quickDrillSource');
    if (!mount) return;
    const truth = trainingTruth(app.training.currentEvaluation, exercise);
    const presentation = truthPresentation(truth);
    const heuristic = truth.state === 'heuristic_comparison';
    const text = heuristic
      ? t('{source} · {tier}', { source: t(trainingTerm(presentation.sourceLabel)), tier: t('Estimated') })
      : t(trainingTerm(presentation.sourceLabel));
    mount.replaceChildren(quickDrillApi().components.createSourceTierLabel(document, {
      text,
      tier: heuristic ? 'estimated' : 'unavailable',
      reason: t(presentation.description),
    }));
  }

  function renderQuickDrillDots() {
    const mount = $('#quickDrillDots');
    if (!mount || !quickDrillApi()) return;
    const state = quickDrillState();
    const session = app.training.practiceSession;
    const total = session?.mode === 'varied' && !session.isOpen ? session.length : null;
    const answered = state.results.length;
    mount.replaceChildren(quickDrillApi().components.createSessionDots(document, {
      total,
      results: state.results.map((result) => result.inside),
      countText: t('{count} answered', { count: formatUiInteger(answered) }),
      ariaLabel: total
        ? t('Decision {current} of {total}', { current: formatUiInteger(Math.min(answered + 1, total)), total: formatUiInteger(total) })
        : t('{count} answered', { count: formatUiInteger(answered) }),
    }));
  }

  function renderQuickDrillFelt(exercise, presentation) {
    const felt = $('#quickDrillFelt');
    if (!felt) return;
    const { view } = quickDrillApi();
    const context = exercise.decisionContext;
    const seats = view.projectQuickDrillSeats(exercise, presentation);
    const facts = view.projectQuickDrillFacts(context);
    const nodes = seats.map((seat, index) => {
      const node = quickDrillElement('div', 'quick-drill-seat');
      node.dataset.hero = String(seat.isHero);
      node.dataset.folded = String(seat.folded);
      node.style.setProperty('--seat-x', `${seat.slot.x}%`);
      node.style.setProperty('--seat-y', `${seat.slot.y}%`);
      node.style.setProperty('--seat-index', String(index));
      const name = quickDrillElement('strong', 'quick-drill-seat-name');
      if (seat.isHero) name.textContent = t('You · {position}', { position: seat.position || '-' });
      else name.append(quickDrillIsland(seat.position || '-'));
      const detail = quickDrillElement('span', 'quick-drill-seat-detail');
      if (seat.folded) detail.textContent = t('Folded');
      else if (seat.action) {
        detail.dataset.action = seat.action.type;
        detail.textContent = seat.action.amountBb === null
          ? t(seat.action.label)
          : t('{action} {amount}', { action: t(seat.action.label), amount: quickDrillInlineBb(seat.action.amountBb) });
      } else if (seat.isHero) detail.textContent = t('To act');
      else detail.append(quickDrillIsland(quickDrillFormatBb(seat.stackBb)));
      node.append(name, detail);
      return node;
    });
    const center = quickDrillElement('div', 'quick-drill-center');
    const pot = quickDrillElement('span', 'quick-drill-pot');
    pot.textContent = facts.facingPrice
      ? t('Pot {pot} · to call {call}', { pot: quickDrillInlineBb(facts.potBb), call: quickDrillInlineBb(facts.toCallBb) })
      : t('Pot {pot}', { pot: quickDrillInlineBb(facts.potBb) });
    center.append(pot);
    const board = app.training.board || [];
    if (board.length) {
      const row = quickDrillElement('div', 'quick-drill-board');
      row.setAttribute('aria-label', t('Board cards'));
      board.forEach((card, index) => {
        const face = quickDrillElement('span', 'training-readonly-card riverline-card quick-drill-board-card');
        face.dataset.cardSize = 'compact';
        face.setAttribute('role', 'img');
        face.setAttribute('aria-label', displayCard(card));
        face.style.setProperty('--deal-index', String(index));
        face.innerHTML = cardMarkup(card);
        row.append(face);
      });
      center.append(row);
    }
    const hole = quickDrillElement('div', 'quick-drill-hole');
    hole.setAttribute('aria-label', t('Hero cards'));
    (app.training.hero || []).forEach((card, index) => {
      const face = quickDrillElement('span', 'training-readonly-card riverline-card quick-drill-hole-card');
      face.dataset.cardSize = 'standard';
      face.setAttribute('role', 'img');
      face.setAttribute('aria-label', displayCard(card));
      face.style.setProperty('--deal-index', String(index));
      face.innerHTML = cardMarkup(card);
      hole.append(face);
    });
    felt.dataset.seatCount = String(seats.length);
    felt.dataset.board = String(board.length > 0);
    felt.replaceChildren(...nodes, center, hole);
    // A new spot plays the felt's blur bridge (a/b restarts the animation).
    if (felt.dataset.spotId !== String(exercise.id)) {
      felt.dataset.spotId = String(exercise.id);
      felt.dataset.swap = felt.dataset.swap === 'a' ? 'b' : 'a';
    }
  }

  // Pot, to call and equity needed (Exact · price only), with derivations.
  // Hard assistance keeps the price locked until the answer.
  function renderQuickDrillFacts(exercise, { answered = false, roll = false } = {}) {
    const mount = $('#quickDrillFacts');
    if (!mount) return;
    const { view, components } = quickDrillApi();
    const facts = view.projectQuickDrillFacts(exercise.decisionContext);
    const hard = ($('#trainingDifficulty')?.value || 'hard') === 'hard';
    const lockPrice = hard && !answered && facts.facingPrice;
    const state = quickDrillState();
    const tiles = [
      {
        name: 'pot',
        value: quickDrillFormatBb(facts.potBb),
        label: t('Pot'),
        derivation: t('Blinds and bets so far'),
      },
      {
        name: 'call',
        value: quickDrillFormatBb(facts.toCallBb),
        label: t('To call'),
        derivation: facts.facingPrice ? t('What it costs to call the bet you face') : t('Nothing to call'),
      },
      {
        name: 'equity',
        value: facts.equityNeededPercent === null ? '-' : formatUiPercent(facts.equityNeededPercent, 1),
        label: t('Equity needed · Exact · price only'),
        derivation: facts.facingPrice && facts.potAfterCallBb !== null
          ? t('{call} ÷ {potAfterCall}: your call over the pot after your call', {
            call: quickDrillInlineBb(facts.toCallBb),
            potAfterCall: quickDrillInlineBb(facts.potAfterCallBb),
          })
          : t('No price to call'),
        locked: lockPrice,
        lockedText: t('After you answer'),
      },
    ];
    mount.replaceChildren(...tiles.map((tile) => {
      const node = components.createFactTile(document, tile);
      const value = node.querySelector('.rl-fact-tile__value bdi');
      if (value && roll && !tile.locked) {
        value.dataset.rollValue = state.previousFacts[tile.name] ?? '';
        components.setRollingText(document, value, tile.value, { roll: state.previousFacts[tile.name] !== undefined });
      }
      if (!tile.locked) state.previousFacts[tile.name] = tile.value;
      return node;
    }));
  }

  function renderQuickDrillActionCards(container, exercise) {
    const { view, components } = quickDrillApi();
    const context = exercise.decisionContext;
    const facts = view.projectQuickDrillFacts(context);
    const hard = ($('#trainingDifficulty')?.value || 'hard') === 'hard';
    const actions = view.projectQuickDrillActions(exercise, app.training.currentPresentation);
    container.replaceChildren(...actions.map((action) => {
      const name = quickDrillActionName(action.type, context);
      const amountText = action.amountBb !== null
        ? quickDrillFormatBb(action.amountBb)
        : action.range
          ? t('{min} to {max}', { min: quickDrillInlineBb(action.range.minBb), max: quickDrillInlineBb(action.range.maxBb) })
          : '';
      const detail = action.type === 'call' && !hard && facts.equityNeededPercent !== null
        ? t('Needs {percent}', { percent: formatUiPercent(facts.equityNeededPercent, 1) })
        : action.range ? t('Size is not graded') : '';
      const card = components.createActionCard(document, {
        type: action.type,
        kind: action.kind,
        name,
        amountText,
        detail,
        keyLabel: action.key,
        ariaLabel: amountText ? `${name}, ${amountText}` : name,
      });
      listen(card, 'click', () => chooseQuickDrillAction(action.type));
      return card;
    }));
    container.dataset.hasSelection = 'false';
    container.style.setProperty('--quick-drill-actions', String(actions.length));
    ensureQuickDrillConfirmRow(container);
    updateQuickDrillConfirm();
  }

  // The Confirm row outlives a controller (it is built once), so a new mount
  // binds it again.
  function bindConfirmRow() {
    listen($('#quickDrillConfirm'), 'click', () => submitQuickDrillAnswer());
    listen($('#quickDrillSkip'), 'click', () => {
      if (app.training.lifecycle === 'ready' && !$('#trainingNextHandBtn')?.hidden) requestNextTrainingExercise();
    });
  }

  function ensureQuickDrillConfirmRow(container) {
    let row = $('#quickDrillConfirmRow');
    if (!row) {
      const { components } = quickDrillApi();
      row = quickDrillElement('div', 'quick-drill-confirm-row');
      row.id = 'quickDrillConfirmRow';
      const confirm = components.createConfirmButton(document, { label: t('Choose an action') });
      confirm.id = 'quickDrillConfirm';
      const prompt = quickDrillElement('div', 'quick-drill-answer-prompt-mount');
      prompt.id = 'quickDrillAnswerPrompt';
      const footer = quickDrillElement('div', 'quick-drill-footer');
      footer.id = 'quickDrillFooter';
      const skip = quickDrillElement('button', 'ui-button ui-button--quiet quick-drill-skip', t('Skip'));
      skip.type = 'button';
      skip.id = 'quickDrillSkip';
      footer.append(skip);
      row.append(confirm, prompt);
      container.after(row);
      row.after(footer);
      bindConfirmRow();
    }
    if (row.previousElementSibling !== container) container.after(row);
    const footer = $('#quickDrillFooter');
    const unsure = $('#trainingUncertaintyControl');
    if (footer && unsure && unsure.parentElement !== footer) footer.prepend(unsure);
    const help = $('#trainingShortcutHelp');
    if (footer && help && help.parentElement !== footer) footer.append(help);
  }

  function updateQuickDrillConfirm() {
    const confirm = $('#quickDrillConfirm');
    const exercise = app.training.currentExercise;
    if (!confirm || !exercise || !quickDrillApi()) return;
    const state = quickDrillState();
    const store = quickDrillAnswerStore();
    const oneClick = store?.mode() === 'one_click';
    confirm.hidden = oneClick;
    const selected = state.selected;
    const action = selected
      ? quickDrillApi().view.projectQuickDrillActions(exercise, app.training.currentPresentation).find((entry) => entry.type === selected)
      : null;
    const name = action ? quickDrillActionName(action.type, exercise.decisionContext) : '';
    const label = !action ? t('Choose an action')
      : action.amountBb !== null && action.type !== 'fold'
        ? t('Confirm {action} {amount}', { action: name, amount: quickDrillInlineBb(action.amountBb) })
        : t('Confirm {action}', { action: name });
    quickDrillApi().components.updateConfirmButton(confirm, { label, disabled: !action || app.training.lifecycle !== 'ready' });
    const skip = $('#quickDrillSkip');
    if (skip) skip.hidden = Boolean($('#trainingNextHandBtn')?.hidden) || app.training.lifecycle !== 'ready';
    renderQuickDrillAnswerPrompt();
  }

  // P1-03 one-time prompt after two confirmed answers.
  function renderQuickDrillAnswerPrompt() {
    const mount = $('#quickDrillAnswerPrompt');
    const store = quickDrillAnswerStore();
    if (!mount || !store) return;
    const show = store.shouldPrompt() && app.training.lifecycle === 'ready';
    if (!show) {
      mount.replaceChildren();
      return;
    }
    if (mount.childElementCount) return;
    const prompt = quickDrillApi().components.createAnswerModePrompt(document, {
      text: t("Don't want to confirm?"),
      acceptLabel: t('Answer with one click'),
      keepLabel: t('Keep confirming'),
    });
    listen(prompt.querySelector('[data-answer-prompt="one_click"]'), 'click', () => {
      store.setMode('one_click', { fromPrompt: true });
      toast(t('One click is on. Change it any time under Feel or in Settings.'));
    });
    listen(prompt.querySelector('[data-answer-prompt="keep"]'), 'click', () => store.dismissPrompt());
    mount.replaceChildren(prompt);
  }

  function syncQuickDrillAnswerModeControls() {
    const mode = quickDrillState().answerMode?.mode() || 'select';
    document.querySelectorAll('[data-answer-mode-option]').forEach((button) => {
      const on = button.dataset.answerModeOption === mode;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('active', on);
    });
    if (app.training.currentExercise && app.training.lifecycle === 'ready') updateQuickDrillConfirm();
  }

  function chooseQuickDrillAction(type) {
    if (!quickDrillApplies() || app.training.lifecycle !== 'ready') return;
    const container = $('#trainingGuessButtons');
    if (!container?.querySelector(`.rl-action-card[data-action="${type}"]`)) return;
    const state = quickDrillState();
    state.selected = type;
    quickDrillApi().components.selectActionCard(container, type);
    updateQuickDrillConfirm();
    if (quickDrillAnswerStore()?.mode() === 'one_click') submitQuickDrillAnswer();
  }

  function submitQuickDrillAnswer() {
    const state = quickDrillState();
    if (!state.selected || app.training.lifecycle !== 'ready') return;
    const store = quickDrillAnswerStore();
    if (store?.mode() === 'select') store.recordConfirm();
    const confirm = $('#quickDrillConfirm');
    if (confirm && !confirm.hidden) quickDrillApi().components.markConfirmed(confirm);
    handleTrainingGuess(state.selected);
  }

  function setQuickDrillZone(zoneState) {
    const zone = $('#quickDrillZone');
    if (!zone) return;
    zone.dataset.zoneState = zoneState;
    const actions = $('#quickDrillActionLayer');
    const feedback = $('#quickDrillFeedbackLayer');
    actions?.toggleAttribute('inert', zoneState !== 'actions');
    feedback?.toggleAttribute('inert', zoneState !== 'feedback');
    const completion = $('#trainingSessionCompletion');
    if (completion && quickDrillApplies() && zoneState === 'finish' && completion.parentElement !== zone) zone.append(completion);
  }

  // The answer reveal (moment 3): verdict, inside/outside pill, mix fill with
  // the "you" tick, one quiet line, then Next / Explain / Review later / Your plan.
  function renderQuickDrillAnswer(evaluation, exercise, chosenActionType, { record = true } = {}) {
    const layer = $('#quickDrillFeedbackLayer');
    const verdictApi = deps.verdictApi();
    if (!layer || !verdictApi || !quickDrillApplies()) return;
    const { view, components } = quickDrillApi();
    const state = quickDrillState();
    const mix = verdictApi.presentMixActions(exercise.strategyResult);
    const answer = view.projectQuickDrillAnswer({
      chosenType: evaluation.mappedStrategyAction?.type ?? chosenActionType,
      mix,
      verdict: verdictApi.describe(exercise.strategyResult),
    });
    state.answer = answer;
    const truth = trainingTruth(evaluation, exercise);
    const heuristic = truth.state === 'heuristic_comparison';
    const verdictText = answer.verdict.kind === 'close'
      ? t('{first} or {second} · close', { first: quickDrillLabel(answer.verdict.primary), second: quickDrillLabel(answer.verdict.secondary) })
      : answer.verdict.kind === 'dominant' ? quickDrillLabel(answer.verdict.primary) : t('Mix unavailable');
    const chosenName = quickDrillActionName(chosenActionType, exercise.decisionContext);
    const pillKey = answer.inside
      ? (heuristic ? "You: {action} · inside the baseline's mix" : "You: {action} · inside the source's mix")
      : (heuristic ? "You: {action} · not in the baseline's mix" : "You: {action} · not in the source's mix");
    const top = quickDrillElement('div', 'quick-drill-feedback-top');
    const pill = quickDrillElement('span', 'quick-drill-answer-pill', t(pillKey, { action: chosenName }));
    pill.dataset.inside = String(answer.inside);
    top.append(components.createVerdict(document, { kind: answer.verdict.kind, text: verdictText }), pill);
    const segmentLabel = (segment) => t('{action} {percent}', { action: quickDrillLabel(segment.name), percent: formatUiPercent(segment.value, 0) });
    const bar = components.createMixBar(document, {
      segments: answer.segments.map((segment) => ({
        kind: segment.kind,
        value: segment.value,
        label: segmentLabel(segment),
        name: quickDrillLabel(segment.name),
        valueText: formatUiPercent(segment.value, 0),
        title: segmentLabel(segment),
      })),
      youAtPercent: answer.youAtPercent,
      youLabel: t('you'),
      ariaLabel: answer.segments.map(segmentLabel).join(', '),
    });
    const reason = quickDrillElement('p', 'quick-drill-reason', t(truthPresentation(truth).description));
    const row = quickDrillElement('div', 'quick-drill-feedback-actions');
    // The one canonical Next control moves into the feedback row (no duplicate).
    const next = $('#trainingNextHandBtn');
    next?.classList.add('quick-drill-next');
    const explain = quickDrillElement('button', 'ui-button ui-button--secondary', t('Explain'));
    explain.type = 'button';
    explain.id = 'quickDrillExplain';
    explain.setAttribute('aria-expanded', 'false');
    explain.setAttribute('aria-controls', 'trainingFeedback');
    explain.setAttribute('aria-keyshortcuts', 'E');
    listen(explain, 'click', () => toggleQuickDrillDetails());
    const review = quickDrillElement('button', 'ui-button ui-button--secondary', t('Review later'));
    review.type = 'button';
    review.id = 'quickDrillReviewLater';
    review.setAttribute('aria-keyshortcuts', 'L');
    listen(review, 'click', () => $('#trainingMarkReview')?.click());
    const plan = quickDrillElement('button', 'ui-button ui-button--secondary', t('Your plan'));
    plan.type = 'button';
    listen(plan, 'click', () => openQuickDrillPanel('plan'));
    row.append(...[next, explain, review, plan].filter(Boolean));
    const card = quickDrillElement('div', 'quick-drill-feedback');
    card.dataset.inside = String(answer.inside);
    card.append(top, bar, reason, row);
    layer.replaceChildren(card);
    syncQuickDrillFeedbackControls();
    renderQuickDrillFacts(exercise, { answered: true });
    setQuickDrillZone('feedback');
    if (record && app.training.currentAttemptKind === 'primary' && !trainingSameSpotIsActive()) {
      state.results.push({
        exerciseId: exercise.id,
        spotType: view.quickDrillSpotType(exercise),
        inside: answer.inside,
        hand: formatHand(app.training.hero || []) || '',
        position: exercise.decisionContext.heroPosition || '',
        actionName: chosenName,
      });
    }
    renderQuickDrillDots();
    renderQuickDrillPanels();
    if (record && next && !next.hidden) next.focus({ preventScroll: true });
  }

  // Mirrors the existing controls the feedback row stands in for.
  function syncQuickDrillFeedbackControls() {
    const next = $('#trainingNextHandBtn');
    if (next && quickDrillApplies() && next.closest('#quickDrillFeedbackLayer')) {
      const state = quickDrillState();
      if (state.finishPending) next.hidden = false;
      const label = state.finishPending ? 'Finish session' : 'Next spot';
      next.dataset.i18n = label;
      next.replaceChildren(quickDrillElement('span', 'quick-drill-next-label', t(label)), quickDrillElement('kbd', 'rl-key rl-key--on-accent', 'Enter'));
    }
    const review = $('#quickDrillReviewLater');
    const source = $('#trainingMarkReview');
    if (review && source) {
      review.hidden = Boolean($('#trainingMemoryDecisionActions')?.hidden);
      review.setAttribute('aria-pressed', source.getAttribute('aria-pressed') || 'false');
      review.textContent = source.textContent;
    }
  }

  function advanceQuickDrill() {
    const state = quickDrillState();
    if (state.finishPending) {
      showQuickDrillFinish();
      return;
    }
    requestNextTrainingExercise();
  }

  function toggleQuickDrillDetails(force) {
    const workspace = $('#trainingWorkspace');
    if (!workspace) return;
    const open = force ?? workspace.dataset.quickDetails !== 'open';
    if (open) workspace.dataset.quickDetails = 'open';
    else delete workspace.dataset.quickDetails;
    $('#quickDrillExplain')?.setAttribute('aria-expanded', String(open));
    if (open) {
      const region = document.querySelector('.training-analysis-region');
      if (region) region.open = true;
      $('#trainingFeedback')?.scrollIntoView({ block: 'nearest', behavior: motionTravelAllowed() ? 'smooth' : 'auto' });
    }
  }

  // Moment 11: the finish ring draws to the inside share and counts up.
  function showQuickDrillFinish() {
    const state = quickDrillState();
    const mount = $('#quickDrillFinishRing');
    const completion = $('#trainingSessionCompletion');
    if (!completion) return;
    const total = state.results.length;
    const inside = state.results.filter((result) => result.inside).length;
    if (mount) {
      mount.replaceChildren(quickDrillApi().components.createFinishRing(document, {
        inside,
        total,
        label: t("{inside} of {total} inside the baseline's mix", { inside: formatUiInteger(inside), total: formatUiInteger(total) }),
      }));
    }
    const text = $('#trainingSessionCompletionText');
    if (text) text.textContent = t("{inside} of {total} inside the baseline's mix", { inside: formatUiInteger(inside), total: formatUiInteger(total) });
    state.finishPending = false;
    completion.hidden = false;
    if ($('#trainingNextHandBtn')) $('#trainingNextHandBtn').hidden = true;
    setQuickDrillZone('finish');
    $('#trainingRestartSession')?.focus({ preventScroll: true });
  }

  function openQuickDrillPanel(id) {
    const state = quickDrillState();
    state.openPanels.add(id);
    const card = document.querySelector(`[data-panel="quick-drill-${id}"]`);
    if (!card) return;
    quickDrillApi().components.setPanelCardOpen(card, true);
    card.scrollIntoView({ block: 'nearest', behavior: motionTravelAllowed() ? 'smooth' : 'auto' });
    card.querySelector('.rl-panel-card__toggle')?.focus({ preventScroll: true });
  }

  function quickDrillRows(rows) {
    const list = quickDrillElement('dl', 'quick-drill-rows');
    rows.forEach(([label, value], index) => {
      const item = quickDrillElement('div', 'quick-drill-row');
      item.style.setProperty('--rl-row-index', String(index));
      const valueNode = quickDrillElement('dd');
      if (value instanceof Node) valueNode.append(value);
      else valueNode.textContent = value;
      const labelNode = quickDrillElement('dt');
      if (label instanceof Node) labelNode.append(label);
      else labelNode.textContent = label;
      item.append(labelNode, valueNode);
      list.append(item);
    });
    return list;
  }

  // The opener (last aggressor this street) for the opponent-range panel.
  function quickDrillOpenerPosition(presentation) {
    const rows = (presentation?.actionHistory || []).filter((row) => row.street === 'preflop'
      && !row.isHero && ['raise', 'bet', 'all_in'].includes(row.actionType));
    return rows.length ? rows[rows.length - 1].position : null;
  }

  function quickDrillPanelBody(id, exercise) {
    const { view } = quickDrillApi();
    const answered = ['feedback', 'complete'].includes(app.training.lifecycle) || Boolean(quickDrillState().answer);
    const context = exercise.decisionContext;
    const body = quickDrillElement('div', 'quick-drill-panel-body');
    if (id === 'glance') {
      const facts = view.projectQuickDrillFacts(context);
      const hard = ($('#trainingDifficulty')?.value || 'hard') === 'hard';
      const priceLocked = hard && !answered && facts.facingPrice;
      const rows = [
        [t('Pot'), quickDrillIsland(quickDrillFormatBb(facts.potBb))],
        [t('To call'), quickDrillIsland(quickDrillFormatBb(facts.toCallBb))],
        [t('Equity needed'), priceLocked ? t('After you answer')
          : quickDrillIsland(facts.equityNeededPercent === null ? '-' : formatUiPercent(facts.equityNeededPercent, 1))],
        [t('Effective stack'), quickDrillIsland(quickDrillFormatBb(facts.effectiveStackBb))],
        [t('Players'), t('analysis.value.tableSize', { count: context.tableSize })],
      ];
      const mdf = app.training.currentContext?.mdf;
      if (!hard && Number.isFinite(mdf)) rows.push([t('MDF (range reference)'), quickDrillIsland(formatUiPercent(mdf, 1))]);
      body.append(quickDrillRows(rows));
      return body;
    }
    if (id === 'range') {
      const opener = context.street === 'preflop' ? quickDrillOpenerPosition(app.training.currentPresentation) : null;
      const sample = opener ? PREFLOP_RANGES[opener] : null;
      if (!sample) {
        body.append(quickDrillElement('p', 'quick-drill-panel-note', context.street === 'preflop'
          ? t('No opener in this spot yet.')
          : t('No range estimate for this street yet.')));
        return body;
      }
      const matrix = quickDrillElement('div', 'quick-drill-mini-matrix');
      matrix.setAttribute('dir', 'ltr');
      matrix.setAttribute('role', 'img');
      matrix.setAttribute('aria-label', t('{position} opening sample', { position: opener }));
      RANKS.forEach((_, row) => RANKS.forEach((__, column) => {
        const cell = quickDrillElement('i');
        cell.dataset.in = String(sample.has(handCode(row, column)));
        matrix.append(cell);
      }));
      const caption = quickDrillElement('p', 'quick-drill-panel-note');
      caption.append(
        document.createTextNode(t('{position} opening sample · Estimated', { position: opener })),
        document.createElement('br'),
        document.createTextNode(t('The fixed class sample Analyze uses; not adjusted to this action.')),
      );
      body.append(matrix, caption);
      return body;
    }
    if (id === 'session') {
      const summary = view.summarizeQuickDrillSession(quickDrillState().results);
      const rows = [[t('Inside the mix'), t('{inside} of {answered}', { inside: formatUiInteger(summary.inside), answered: formatUiInteger(summary.answered) })]];
      summary.groups.forEach((group) => rows.push([
        t(QUICK_DRILL_SPOT_TYPE_LABELS[group.spotType] || 'Other spots'),
        t('{inside} of {answered}', { inside: formatUiInteger(group.inside), answered: formatUiInteger(group.answered) }),
      ]));
      body.append(quickDrillRows(rows));
      const reset = quickDrillElement('button', 'ui-button ui-button--quiet quick-drill-panel-action', t('Reset session stats'));
      reset.type = 'button';
      listen(reset, 'click', () => $('#trainingResetStats')?.click());
      body.append(reset);
      return body;
    }
    if (id === 'plan') {
      if (!answered) {
        body.append(quickDrillElement('p', 'quick-drill-lock', t('Shown after you answer, so it never hints at the decision.')));
        return body;
      }
      const mix = deps.verdictApi()?.presentMixActions(exercise.strategyResult) || [];
      const mixText = mix.filter((entry) => entry.value > 0)
        .map((entry) => t('{action} {percent}', { action: quickDrillLabel(entry.name), percent: formatUiPercent(entry.value, 0) }))
        .join(' · ');
      body.append(quickDrillRows([
        [t("Baseline's mix"), quickDrillIsland(mixText || '-')],
        [t('Your plan here'), t('Not mapped yet')],
      ]));
      const teach = quickDrillElement('button', 'ui-button ui-button--quiet quick-drill-panel-action', t('Teach from this decision'));
      teach.type = 'button';
      listen(teach, 'click', () => $('#trainingTeachDecision')?.click());
      body.append(teach);
      return body;
    }
    // similar
    const spotType = view.quickDrillSpotType(exercise);
    const similar = quickDrillState().results
      .filter((result) => result.spotType === spotType && result.exerciseId !== exercise.id)
      .slice(-3).reverse();
    if (!similar.length) body.append(quickDrillElement('p', 'quick-drill-panel-note', t('No similar spots yet this session.')));
    else {
      body.append(quickDrillRows(similar.map((result) => [
        quickDrillIsland(`${result.hand} · ${result.position}`),
        t(result.inside ? '{action} · inside' : '{action} · outside', { action: result.actionName }),
      ])));
    }
    const memory = quickDrillElement('button', 'ui-button ui-button--quiet quick-drill-panel-action', t('Open Training Memory'));
    memory.type = 'button';
    listen(memory, 'click', () => openTrainingMemoryView('recent'));
    body.append(memory);
    return body;
  }

  // Matches the rail container query that puts the panels side by side.
  const QUICK_DRILL_WIDE_RAIL_PX = 560;

  function renderQuickDrillPanels() {
    const mount = $('#quickDrillPanels');
    const exercise = app.training.currentExercise;
    if (!mount || !exercise || !quickDrillApplies()) return;
    const { components } = quickDrillApi();
    const state = quickDrillState();
    const answered = Boolean(state.answer);
    const focusedPanel = document.activeElement?.closest?.('#quickDrillPanels [data-panel]')?.dataset.panel || null;
    // A wide rail (panels side by side) has room for every panel: open them all
    // until the learner chooses otherwise, so no space sits empty next to closed ones.
    if (!state.panelsTouched && mount.getBoundingClientRect().width >= QUICK_DRILL_WIDE_RAIL_PX) {
      QUICK_DRILL_PANEL_IDS.forEach((id) => state.openPanels.add(id));
      // The action line too, once; after that it keeps whatever the learner chose.
      const history = $('#trainingHistoryPanel');
      if (history && !state.historyAutoOpened) history.open = true;
      state.historyAutoOpened = true;
    }
    mount.replaceChildren(...QUICK_DRILL_PANEL_IDS.map((id) => {
      const card = components.createPanelCard(document, {
        id: `quick-drill-${id}`,
        title: t(QUICK_DRILL_PANEL_TITLES[id]),
        summary: id === 'plan' && !answered ? t('After you answer') : '',
        open: state.openPanels.has(id),
        locked: id === 'plan' && !answered,
        body: quickDrillPanelBody(id, exercise),
      });
      listen(card.querySelector('.rl-panel-card__toggle'), 'click', () => {
        const open = card.dataset.open !== 'true';
        state.panelsTouched = true;
        if (open) state.openPanels.add(id);
        else state.openPanels.delete(id);
        components.setPanelCardOpen(card, open);
      });
      // The plan unlocks once per answered spot (rows arrive, the card glows once).
      if (id === 'plan' && answered && state.planUnlockedFor !== state.exerciseId) card.classList.add('is-unlocking');
      return card;
    }));
    if (answered) state.planUnlockedFor = state.exerciseId;
    if (focusedPanel) mount.querySelector(`[data-panel="${focusedPanel}"] .rl-panel-card__toggle`)?.focus({ preventScroll: true });
  }

  // Language change: rebuild the drill's text without recording anything again.
  function refreshQuickDrillLanguage(exercise) {
    if (!quickDrillApplies() || !exercise || !quickDrillApi()) return;
    const presentation = app.training.currentPresentation || exercise.presentation;
    renderQuickDrillSpotLine(exercise);
    renderQuickDrillSource(exercise);
    renderQuickDrillDots();
    renderQuickDrillFelt(exercise, presentation);
    const answered = Boolean(quickDrillState().answer) && app.training.currentEvaluation;
    renderQuickDrillFacts(exercise, { answered: Boolean(answered) });
    if (answered) {
      renderQuickDrillAnswer(app.training.currentEvaluation, exercise, app.training.currentEvaluation.chosenAction.type, { record: false });
    } else renderQuickDrillPanels();
    const keys = $('#quickDrillKeys');
    if (keys) keys.textContent = t('Keys: F fold · C check or call · B or R bet or raise · A all-in · Enter confirm, then next · U unsure · E explain · L review later');
  }

  function resetQuickDrillSession() {
    const state = quickDrillState();
    state.results = [];
    state.finishPending = false;
    state.answer = null;
    state.previousFacts = {};
    const completion = $('#trainingSessionCompletion');
    const zone = $('#quickDrillZone');
    if (completion && zone && completion.parentElement === zone) {
      $('#trainingDecisionProgressionMount')?.before(completion);
    }
    if ($('#quickDrillFinishRing')) $('#quickDrillFinishRing').replaceChildren();
    setQuickDrillZone('actions');
    renderQuickDrillDots();
  }

  function setQuickDrillFeelOpen(open) {
    const button = $('#quickDrillFeelButton');
    const popover = $('#quickDrillFeel');
    if (!button || !popover) return;
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  function initQuickDrill() {
    document.documentElement.dataset.quickDrillBound = 'true';
    const store = quickDrillAnswerStore();
    unsubscribeAnswerMode = store.subscribe(syncQuickDrillAnswerModeControls);
    document.querySelectorAll('[data-answer-mode-option]').forEach((button) => {
      listen(button, 'click', () => store?.setMode(button.dataset.answerModeOption));
    });
    syncQuickDrillAnswerModeControls();
    if ($('#quickDrillConfirmRow')) bindConfirmRow();
    listen($('#quickDrillFeelButton'), 'click', (event) => {
      event.stopPropagation();
      setQuickDrillFeelOpen($('#quickDrillFeel')?.hidden !== false);
    });
    listen(document, 'click', (event) => {
      if (!event.target?.closest?.('.quick-drill-feel')) setQuickDrillFeelOpen(false);
    });
    listen(document, 'keydown', (event) => {
      if (event.key === 'Escape' && $('#quickDrillFeel') && !$('#quickDrillFeel').hidden) {
        setQuickDrillFeelOpen(false);
        $('#quickDrillFeelButton')?.focus();
      }
    });
    listen($('#quickDrillAdjust'), 'click', () => {
      const setup = $('#trainingSetupPanel');
      setTrainingSetupExpanded(!setup?.open, { focus: !setup?.open });
    });
    const keys = $('#quickDrillKeys');
    if (keys) keys.textContent = t('Keys: F fold · C check or call · B or R bet or raise · A all-in · Enter confirm, then next · U unsure · E explain · L review later');
  }

  // Quick drill keys (DESIGN_SYSTEM keyboard contract). Returns true when handled.
  function handleQuickDrillKey(event) {
    if (!quickDrillApplies() || !app.training.currentExercise) return false;
    const key = event.key.toLowerCase();
    const lifecycle = app.training.lifecycle;
    const { view } = quickDrillApi();
    if (lifecycle === 'ready') {
      const types = [...document.querySelectorAll('#trainingGuessButtons .rl-action-card')].map((card) => card.dataset.action);
      const type = view.quickDrillActionForKey(key, types);
      if (type) {
        chooseQuickDrillAction(type);
        return true;
      }
      if (event.key === 'Enter' && event.target?.tagName !== 'BUTTON' && quickDrillState().selected) {
        submitQuickDrillAnswer();
        return true;
      }
      if (key === 'u' && $('#trainingUncertain') && !$('#trainingUncertaintyControl')?.hidden) {
        $('#trainingUncertain').click();
        return true;
      }
      return false;
    }
    if (['feedback', 'complete'].includes(lifecycle) || $('#quickDrillZone')?.dataset.zoneState === 'feedback') {
      if (event.key === 'Enter' && event.target?.tagName !== 'BUTTON' && !$('#trainingNextHandBtn')?.hidden) {
        advanceQuickDrill();
        return true;
      }
      if (key === 'e') {
        toggleQuickDrillDetails();
        return true;
      }
      if (key === 'l' && !$('#quickDrillReviewLater')?.hidden) {
        $('#quickDrillReviewLater')?.click();
        return true;
      }
    }
    return false;
  }

  // Shown with the quick refresher, hidden for Full Hand's own table.
  function setVisible(visible) {
    container.hidden = !visible;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const { target, type, handler } of listeners.splice(0)) target.removeEventListener(type, handler);
    unsubscribeAnswerMode?.();
    unsubscribeAnswerMode = null;
    delete document.documentElement.dataset.quickDrillBound;
  }

  initQuickDrill();

  return {
    dispose,
    refreshLanguage: refreshQuickDrillLanguage,
    handleKey: handleQuickDrillKey,
    setVisible,
    applies: quickDrillApplies,
    render: renderQuickDrill,
    renderAnswer: renderQuickDrillAnswer,
    renderActionCards: renderQuickDrillActionCards,
    syncComposition: syncQuickDrillComposition,
    syncFeedbackControls: syncQuickDrillFeedbackControls,
    resetSession: resetQuickDrillSession,
    showFinish: showQuickDrillFinish,
    markFinishPending() { quickDrillState().finishPending = true; },
  };
}
