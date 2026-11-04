// EXTRACT-ANALYZE-001: the Analyze decision panel (#recommendation).
//
// Owns the verdict and truth line, the strategy mix bar and wheel, the caution
// callout, the fact table (with its omission rule), Explain, Teach, Provenance
// and the "Complete this decision" gate. It renders what the orchestrator hands
// it and never resolves strategy: logic.js keeps the one strategyProvider.resolve
// per decision update (PERF-001) and passes an immutable view model down.
//
// Controller: mount(container, deps) -> { dispose, refreshLanguage, handleKey,
// setVisible, ...panel methods }. Everything the panel needs from the page is
// injected (see `deps` below); it never reaches for window.app.

export const ANALYZE_DECISION_PANEL_SCHEMA_VERSION = 'analyze-decision-panel/v1';

// Invisible word joiners fence the placeholders inside the translated
// "Close mix" sentence so the shares can be wrapped in their own elements.
const WORD_JOINER = '⁠';
const MARK_PATTERN = /(⁠[FfSs]⁠)/;

const FACT_METRIC_IDS = Object.freeze(['mPosition', 'mPot', 'mFacing', 'mStack', 'mEquity', 'mPotOdds', 'mSPR', 'mRake']);

function setSizing(element, recommendationAction, deps, { refresh = false } = {}) {
  if (!element) return;
  if (Number.isFinite(recommendationAction?.amountBb)) {
    element.textContent = deps.formatSuggestedSizing?.(recommendationAction.amountBb)
      ?? (refresh ? `${deps.formatFixed(recommendationAction.amountBb, 1)} bb` : `${recommendationAction.amountBb} bb`);
    element.hidden = false;
  } else if (Number.isFinite(recommendationAction?.potFraction)) {
    element.textContent = deps.translate('{value}% pot', { value: deps.formatFixed(recommendationAction.potFraction * 100, 0) });
    element.hidden = false;
  } else if (!refresh) {
    element.textContent = '';
    element.hidden = true;
  }
}

// Verdict dominance (analyze-verdict/v1). Presentation only: it never changes
// the recommendation, frequencies or claim policy.
export function renderVerdict({ element, closeNote, document: doc }, strategyResult, deps) {
  if (!element) return null;
  const t = deps.translate;
  const verdict = deps.describeVerdict?.(strategyResult) || null;
  const shares = strategyResult?.actions ? deps.presentationActions(strategyResult) : [];
  const share = (entry) => {
    const matched = shares.find((item) => item.name === entry.label && item.action?.type === entry.type) || shares[entry.index];
    return `${matched?.value ?? Math.round(entry.probability * 20) * 5}%`;
  };
  if (!verdict || verdict.kind === 'unavailable') {
    element.textContent = t(strategyResult?.recommendation?.label || 'Unavailable');
    element.dataset.verdictKind = 'unavailable';
    if (closeNote) closeNote.hidden = true;
    return verdict;
  }
  element.dataset.verdictKind = verdict.kind;
  if (verdict.kind === 'close') {
    element.textContent = t('{first} or {second}', { first: t(verdict.primary.label), second: t(verdict.secondary.label) });
    if (closeNote) {
      // Secondary text; the action colors appear only as small dots.
      const marks = {
        first: `${WORD_JOINER}F${WORD_JOINER}`,
        firstShare: `${WORD_JOINER}f${WORD_JOINER}`,
        second: `${WORD_JOINER}S${WORD_JOINER}`,
        secondShare: `${WORD_JOINER}s${WORD_JOINER}`,
      };
      const template = t('Close mix · {first} {firstShare} · {second} {secondShare}', marks);
      const entries = { F: verdict.primary, S: verdict.secondary };
      const nodes = template.split(MARK_PATTERN).filter(Boolean).map((part) => {
        const key = part.length === 3 && part[0] === WORD_JOINER ? part[1] : null;
        if (!key) return doc.createTextNode(part);
        const entry = entries[key.toUpperCase()];
        const span = doc.createElement('span');
        if (key === key.toUpperCase()) {
          span.className = 'verdict-share';
          const dot = doc.createElement('i');
          dot.className = 'verdict-dot';
          dot.dataset.actionKind = entry.kind;
          dot.setAttribute('aria-hidden', 'true');
          span.append(dot, doc.createTextNode(t(entry.label)));
        } else {
          span.className = 'verdict-share-value';
          span.textContent = share(entry);
        }
        return span;
      });
      closeNote.replaceChildren(...nodes);
      closeNote.hidden = false;
    }
  } else {
    element.textContent = t(verdict.primary.label);
    if (closeNote) closeNote.hidden = true;
  }
  return verdict;
}

// The mix bar is shared with Training, so it is a pure helper as well.
export function renderFrequencyStack(container, actions, deps) {
  if (!container) return;
  const t = deps.translate;
  const populated = actions.filter((action) => Number(action.value) > 0);
  container.innerHTML = populated.map((action) => {
    const kind = deps.actionKind(action);
    return `<span class="frequency-stack-segment" data-action-kind="${kind}" style="width:${action.value}%" title="${t(action.name)}: ${action.value}%"></span>`;
  }).join('');
  const label = populated.length
    ? populated.map((action) => `${t(action.name)} ${action.value}%`).join(', ')
    : t('Strategy frequencies unavailable');
  container.setAttribute('aria-label', label);
  container.classList.toggle('is-empty', populated.length === 0);
}

function analyzeFactIsUnavailable(id, text, context) {
  const value = String(text || '').trim();
  if (!value || value === '-' || value.startsWith('—') || value.startsWith('- (')) return true;
  if (id === 'mToCall') return !context || !Number.isFinite(context.callAmountBb);
  return false;
}

function mountAnalyzeDecisionPanel(container, deps) {
  const t = (key, values) => deps.translate(key, values);
  const doc = container.ownerDocument;
  const el = (id) => container.querySelector(`#${id}`);

  let visible = true;
  let explainOpen = false;
  let lastResultView = null;
  let disposed = false;

  // --- Mix bar and wheel -------------------------------------------------

  function setFrequency(index, action) {
    const nameEl = el(`f${index}name`);
    const barEl = el(`f${index}`);
    const numEl = el(`f${index}num`);
    if (nameEl) nameEl.textContent = t(action.name);
    if (barEl) {
      barEl.style.width = `${action.value}%`;
      barEl.dataset.actionKind = deps.actionKind(action);
      barEl.setAttribute('aria-label', `${t(action.name)}: ${action.value}%`);
      if (barEl.closest('.frequency')) barEl.closest('.frequency').dataset.actionKind = deps.actionKind(action);
    }
    if (numEl) numEl.textContent = action.value ? `${action.value}%` : '-';
    // The mix card lists only actions present in the mix.
    const row = (barEl || nameEl)?.closest('.frequency');
    if (row) row.hidden = !(Number(action.value) > 0);
  }

  function paintMix(displayActions, { wheel }) {
    displayActions.forEach((action, index) => setFrequency(index + 1, action));
    renderFrequencyStack(el('actionFrequencyStack'), displayActions, deps);
    const wheelElement = el('actionWheel');
    const centerText = el('wheelCenterText');
    if (wheel === 'unavailable') {
      if (wheelElement) wheelElement.style.background = 'var(--surface-interactive)';
      if (centerText) centerText.textContent = '-';
      return;
    }
    const [a, b, c] = displayActions;
    if (wheelElement && wheel === 'full') {
      wheelElement.style.background = `conic-gradient(${deps.actionColor(a)} 0% ${a.value}%, ${deps.actionColor(b)} ${a.value}% ${a.value + b.value}%, ${deps.actionColor(c)} ${a.value + b.value}% 100%)`;
    }
    if (centerText) {
      centerText.textContent = a.value
        ? `${deps.formatNumber(a.value, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`
        : '-';
    }
  }

  function paddedActions(profile) {
    const displayActions = [...profile.actions];
    while (displayActions.length < 3) displayActions.push({ name: '-', value: 0, kind: 'unavailable' });
    return displayActions;
  }

  // --- State and gate ----------------------------------------------------

  function setRecommendationState(state) {
    container.dataset.recommendationState = state;
    const teach = el('analysisTeachDecision');
    if (teach) teach.hidden = !['ready', 'mixed', 'warning'].includes(state);
    container.setAttribute('aria-busy', String(state === 'loading'));
    const inputState = el('analysisInputState');
    if (!inputState) return;
    inputState.hidden = !['waiting', 'unavailable', 'loading'].includes(state);
    el('analysisInputMessage').textContent = state === 'loading' ? t('Loading…') : t('Check the cards and decision context to continue.');
    const edit = el('analysisEditInputs');
    edit.hidden = state === 'loading';
    const editLabel = deps.isHandMode() ? 'Return to hand' : 'Edit decision inputs';
    edit.dataset.i18n = editLabel;
    edit.textContent = t(editLabel);
  }

  // The gate for a decision that cannot be resolved yet. `message` is already
  // localized by the orchestrator; the panel shows it and clears the result.
  function renderUnavailable({ message, waiting }) {
    lastResultView = null;
    setRecommendationState(waiting ? 'waiting' : 'unavailable');
    const inputMessage = el('analysisInputMessage');
    if (inputMessage) inputMessage.textContent = message;
    const best = el('bestAction');
    if (best) {
      best.textContent = t('Unavailable');
      best.dataset.verdictKind = 'unavailable';
    }
    if (el('bestActionClose')) el('bestActionClose').hidden = true;
    const sizing = el('bestSizing');
    if (sizing) {
      sizing.textContent = '';
      sizing.hidden = true;
    }
    if (el('bestReason')) el('bestReason').textContent = message;
    const badge = el('sourceBadge');
    if (badge) {
      badge.textContent = t('Unavailable');
      badge.className = 'badge status-badge status-badge--unavailable';
      badge.hidden = true;
    }
    if (el('strategyMeta')) el('strategyMeta').hidden = true;
    const warnings = el('strategyWarnings');
    if (warnings) {
      warnings.textContent = message;
      warnings.hidden = false;
    }
    paintMix(Array.from({ length: 3 }, () => ({ name: '-', value: 0, kind: 'unavailable' })), { wheel: 'unavailable' });
    FACT_METRIC_IDS.forEach((id) => {
      if (el(id)) el(id).textContent = '-';
    });
  }

  // --- Verdict, truth, provenance ----------------------------------------

  function paintVerdict(strategyResult) {
    return renderVerdict({ element: el('bestAction'), closeNote: el('bestActionClose'), document: doc }, strategyResult, deps);
  }

  function paintTruth(strategyResult, decisionContext) {
    const truth = deps.truthFor({ strategyResult, decisionContext });
    const presentation = deps.truthPresentation(truth);
    const heading = el('strategyTruthHeading');
    if (heading) {
      if (truth.state === 'accepted_reference_comparison') {
        const sourceLabel = deps.sourceLabel(strategyResult)
          || truth.selectedReference?.manifest?.source?.displayName
          || presentation.sourceLabel;
        heading.textContent = sourceLabel;
        delete heading.dataset.i18n;
      } else {
        heading.dataset.i18n = presentation.sourceLabel;
        heading.textContent = t(presentation.sourceLabel);
      }
    }
    // One provenance indicator per surface (OWNER-19): source + tier above the verdict.
    const tier = el('strategyTier');
    if (tier) tier.hidden = truth.state !== 'heuristic_comparison';
    const note = el('strategyTruthNote');
    if (note) { note.dataset.i18n = presentation.description; note.textContent = t(presentation.description); }
    if (truth.state === 'accepted_reference_comparison') {
      container.dataset.strategyAuthority = 'comparative_reference';
    } else {
      delete container.dataset.strategyAuthority;
    }
    container.dataset.truthState = truth.state;
    return truth;
  }

  // Technical source id/version lives in Provenance & limitations (monospace only there).
  function paintMeta(claimPolicy) {
    const meta = el('strategyMeta');
    if (!meta) return;
    const marker = '⁣';
    const [before = '', after = ''] = t('Source version {version}', { version: marker }).split(marker);
    const version = doc.createElement('code');
    version.className = 'technical-id';
    version.textContent = claimPolicy.sourceVersion;
    meta.replaceChildren(
      doc.createTextNode(before),
      version,
      doc.createTextNode(`${after} · ${claimPolicy.coverage.kind === 'exact'
        ? t('Exact covered context')
        : t('Broad approximate coverage')}`),
    );
    meta.hidden = false;
  }

  function paintSourceBadge(strategyResult, claimPolicy) {
    const badge = el('sourceBadge');
    if (!badge) return;
    const sourceLabel = deps.sourceLabel(strategyResult);
    const isReference = claimPolicy.authority === 'comparative_reference';
    const tone = claimPolicy.source.family === 'heuristic' ? 'heuristic' : isReference ? 'reference' : 'info';
    const provenance = deps.policySummary(claimPolicy);
    badge.textContent = sourceLabel;
    badge.title = provenance;
    badge.setAttribute('aria-label', `${t('Strategy source')}: ${sourceLabel}`);
    badge.className = `badge status-badge status-badge--${tone}`;
    // The header badge names the production source; the body repeats a source
    // only when it differs (comparative reference).
    badge.hidden = !isReference;
    if (isReference) badge.dataset.strategyAuthority = 'comparative_reference';
    else delete badge.dataset.strategyAuthority;
    const provenanceElement = el('strategySourceProvenance');
    if (provenanceElement) provenanceElement.textContent = provenance;
  }

  function paintWarnings(strategyResult, claimPolicy) {
    const warnings = el('strategyWarnings');
    if (!warnings) return;
    const list = [deps.limitationFor(claimPolicy), ...deps.warningsFor(strategyResult)].filter(Boolean);
    warnings.textContent = [...new Set(list)].join(' · ');
    warnings.hidden = list.length === 0;
  }

  // The resolved decision. view = { decisionContext, strategyResult,
  // claimPolicy, state } (frozen by the orchestrator). `refresh` repaints the
  // same view in the current language and leaves state and wheel alone.
  function paintResult(view, { refresh }) {
    const { decisionContext, strategyResult, claimPolicy } = view;
    const profile = deps.profileFor(strategyResult);
    if (!refresh) setRecommendationState(view.state);
    lastResultView = view;
    paintVerdict(strategyResult);
    paintTruth(strategyResult, decisionContext);
    setSizing(el('bestSizing'), strategyResult.recommendation?.action, deps, { refresh });
    if (el('bestReason')) el('bestReason').textContent = profile.reason;
    if (!refresh) container.dataset.actionKind = deps.actionKind(profile.actions[0]);
    paintSourceBadge(strategyResult, claimPolicy);
    const streetLabel = el('streetLabel');
    if (streetLabel && decisionContext.street) {
      streetLabel.textContent = t(decisionContext.street.charAt(0).toUpperCase() + decisionContext.street.slice(1));
    }
    paintMeta(claimPolicy);
    paintWarnings(strategyResult, claimPolicy);
    paintMix(paddedActions(profile), { wheel: refresh ? 'center' : 'full' });
  }

  // --- Facts -------------------------------------------------------------

  function facingFact(context, facing) {
    const summary = context && deps.describeFacing?.(context);
    const kinds = deps.facingKinds || {};
    const wording = summary && {
      [kinds.UNOPENED]: 'Unopened',
      [kinds.LIMPED]: 'Limped',
      [kinds.OPTION]: 'Option',
      [kinds.CHECK_AVAILABLE]: 'Check available',
    }[summary.kind];
    return wording ? t(wording) : `${deps.formatFixed(facing, 1)} bb`;
  }

  // To call is the exact canonical price; Scenario contexts never fabricate it.
  function toCallFact(context) {
    if (!context) return '-';
    if (!Number.isFinite(context.callAmountBb)) return t('facing.price.unavailable');
    const call = `${deps.formatFixed(context.callAmountBb, 1)} bb`;
    const allIn = Number.isFinite(context.heroStackBb) && context.callAmountBb > 0 && context.callAmountBb >= context.heroStackBb;
    return allIn ? `${call} · ${t('All-in')}` : call;
  }

  // Fact-cell omission rule. A fact that is unavailable for this context (no
  // exact price, no SPR, not applicable when unopened) is not shown as a bare
  // dash: its cell is omitted, the table reflows evenly, and the omitted facts
  // are listed in Provenance & limitations.
  function applyFactOmission(context) {
    const strip = container.querySelector('.analyze-facts');
    if (!strip) return;
    const omitted = [];
    let shown = 0;
    strip.querySelectorAll('.metric').forEach((cell) => {
      const value = cell.querySelector('b');
      const label = cell.querySelector('span')?.textContent?.trim() || '';
      const unavailable = Boolean(context) && analyzeFactIsUnavailable(value?.id, value?.textContent, context);
      cell.hidden = unavailable;
      if (unavailable) {
        // "— (Price unavailable)" -> "Price unavailable"; a bare dash carries no reason.
        const reason = String(value?.textContent || '').replace(/^[—-]\s*\(?/, '').replace(/\)$/, '').trim();
        omitted.push(reason ? `${label} (${reason})` : label);
      } else shown += 1;
    });
    strip.style.setProperty('--fact-cols', String(Math.max(1, shown)));
    strip.style.setProperty('--fact-cols-narrow', String(Math.max(1, Math.ceil(shown / 2))));
    const note = el('analyzeOmittedFacts');
    if (note) {
      note.hidden = omitted.length === 0;
      note.textContent = omitted.length ? t('Not shown for this decision: {facts}', { facts: omitted.join(' · ') }) : '';
    }
  }

  // facts = { context, heroPosition, lastAction, pot, facing, stack, heroCards,
  // boardCards, isPreflopOpenDecision }. Returns the formatted headline values
  // so the orchestrator can reuse them (Analyze header context).
  function renderFacts(facts) {
    const { context, heroPosition, lastAction, pot, facing, stack, heroCards, boardCards, isPreflopOpenDecision } = facts;
    const callAmount = context ? context.callAmountBb : null;

    const hand = el('mEquity');
    if (hand) hand.textContent = heroCards.length
      ? (deps.formatHand(heroCards) || heroCards.map(deps.displayCard).join(' '))
      : t('Unknown');

    const potOdds = el('mPotOdds');
    if (potOdds) {
      if (isPreflopOpenDecision) {
        potOdds.textContent = t('— (Unopened)');
      } else if (!Number.isFinite(callAmount)) {
        potOdds.textContent = t('— (Price unavailable)');
      } else if (lastAction === 'unopened' || callAmount === 0) {
        potOdds.textContent = '-';
      } else {
        potOdds.textContent = Number.isFinite(context.requiredRawEquity)
          ? `${deps.formatFixed(context.requiredRawEquity * 100, 1)}%`
          : '-';
      }
    }

    const spr = el('mSPR');
    if (spr) {
      const ratio = deps.stackToPotRatio(context);
      spr.textContent = Number.isFinite(ratio) ? deps.formatFixed(ratio, 1) : '-';
    }

    const board = el('mRake');
    if (board) board.textContent = boardCards.length
      ? boardCards.map(deps.displayCard).join(' ')
      : t('Preflop · no board');

    const values = {
      mPosition: heroPosition || '-',
      mPot: `${deps.formatFixed(pot, 1)} bb`,
      mFacing: facingFact(context, facing),
      mToCall: toCallFact(context),
      mStack: `${deps.formatFixed(stack, 0)} bb`,
    };
    Object.entries(values).forEach(([id, value]) => {
      if (el(id)) el(id).textContent = value;
    });
    applyFactOmission(context);
    return Object.freeze(values);
  }

  // --- Explain -----------------------------------------------------------

  function syncExplainDepthControls() {
    el('toggleTeacher')?.setAttribute('aria-pressed', String(explainOpen));
    el('analyzeExplainFacts')?.setAttribute('aria-pressed', String(!explainOpen));
  }

  function toggleExplain() {
    const content = el('teacherContent');
    if (!content) return;
    explainOpen = !explainOpen;
    content.style.display = explainOpen ? 'block' : 'none';
    el('toggleTeacher')?.setAttribute('aria-expanded', String(explainOpen));
    syncExplainDepthControls();
    content.classList.toggle('is-analysis-entering', explainOpen);
    if (explainOpen) deps.renderExplainIfNeeded();
  }

  // view = { decisionContext, strategyResult, resolution, unavailableReason }.
  function renderExplain(view) {
    const { decisionContext, strategyResult, resolution, unavailableReason = null } = view;
    return deps.renderDecisionAnalysis(el('teacherContent'), {
      decisionContext,
      strategyResult: strategyResult?.schemaVersion === deps.resultSchemaVersion ? strategyResult : null,
      trustedFacts: deps.explainFacts(resolution),
      authority: resolution?.mode === 'hand' ? 'hand' : 'scenario',
      depth: 'detailed',
      unavailableReason,
      surface: 'playbook',
    });
  }

  // --- Bindings ----------------------------------------------------------

  const onClick = (event) => {
    const target = event.target?.closest?.('button');
    if (!target || !container.contains(target)) return;
    if (target.id === 'toggleTeacher') toggleExplain();
    else if (target.id === 'analyzeExplainFacts') { if (explainOpen) toggleExplain(); }
    else if (target.id === 'analysisEditInputs') deps.editInputs();
    else if (target.id === 'analysisTeachDecision') deps.teachDecision();
    else if (target.id === 'toggleFrequencyAlternate') {
      const wheel = el('actionWheelContainer');
      if (!wheel) return;
      const expanded = target.getAttribute('aria-expanded') === 'true';
      target.setAttribute('aria-expanded', String(!expanded));
      wheel.hidden = expanded;
    }
  };
  container.addEventListener('click', onClick);
  syncExplainDepthControls();

  return {
    schemaVersion: ANALYZE_DECISION_PANEL_SCHEMA_VERSION,
    renderResult: (view) => paintResult(view, { refresh: false }),
    renderUnavailable,
    renderFacts,
    renderVerdict: paintVerdict,
    renderTruth: paintTruth,
    setRecommendationState,
    setFrequency,
    applyFactOmission,
    facingFact,
    toCallFact,
    renderExplain,
    toggleExplain,
    isExplainOpen: () => explainOpen,
    // Visibility is pushed in by the orchestrator, never read from the DOM.
    setVisible(next) { visible = Boolean(next); },
    isVisible: () => visible,
    // Explain renders only while it is open and the workspace is visible.
    isExplainVisible: () => visible && explainOpen,
    // Repaint the resolved decision in the current language. The orchestrator
    // passes the view built from its current state; without one the last
    // rendered view is used. Returns false when there is nothing to repaint.
    refreshLanguage(view = lastResultView) {
      if (disposed || !view) return false;
      paintResult(view, { refresh: true });
      return true;
    },
    // T toggles Explain. Returns true when the key was handled.
    handleKey(event) {
      if (event?.key !== 't' && event?.key !== 'T') return false;
      toggleExplain();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lastResultView = null;
      container.removeEventListener('click', onClick);
    },
  };
}

export { mountAnalyzeDecisionPanel as mount };

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineAnalyzeDecisionPanel', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: ANALYZE_DECISION_PANEL_SCHEMA_VERSION,
      mount: mountAnalyzeDecisionPanel,
      renderFrequencyStack,
      renderVerdict,
    }),
    writable: false,
  });
}
