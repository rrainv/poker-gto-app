// EXTRACT-ANALYZE-002: the Analyze Range Matrix tab (#chartView).
//
// Owns the 13x13 strategy grid, the cell inspector, the selection preview, the
// summary line, the postflop empty state and the grid keyboard (A11Y-KEYS-001:
// an ARIA grid with one Tab stop). It also owns the memoised matrix model.
//
// PERF-001 stays exactly as it was:
//   - the model is memoised by a context key that excludes the Hero cards;
//   - the 169 per-cell resolves happen only preflop, and only when render() is
//     called, which the orchestrator does only while the tab is visible (hidden
//     surfaces are marked dirty and render once when shown);
//   - the module never imports or calls the strategy provider: each cell goes
//     through the injected deps.resolveCell(decisionContext).
//
// Controller: mount(container, deps) -> { dispose, refreshLanguage, handleKey,
// setVisible, render, prepareModel, ... }. Everything the page provides is
// injected (see `deps`); the module never reaches for window.app.

export const ANALYZE_MATRIX_SCHEMA_VERSION = 'analyze-matrix/v1';

// ── Grid kit (shared with the Range Category Comparison grids) ──────────────

// A11Y-KEYS-001: 13x13 matrices are ARIA grids (row elements use
// display:contents so the CSS grid stays flat) with one Tab stop.
export function buildMatrixGridCells(grid, className, configureCell, ranks) {
  const doc = grid.ownerDocument;
  grid.replaceChildren();
  ranks.forEach((_, row) => {
    const rowElement = doc.createElement('div');
    rowElement.className = 'matrix-grid-row';
    rowElement.setAttribute('role', 'row');
    rowElement.setAttribute('aria-rowindex', String(row + 1));
    ranks.forEach((__, col) => {
      const btn = doc.createElement('button');
      btn.className = className;
      btn.type = 'button';
      btn.tabIndex = -1;
      btn.setAttribute('role', 'gridcell');
      btn.setAttribute('aria-colindex', String(col + 1));
      configureCell?.(btn, row, col);
      rowElement.appendChild(btn);
    });
    grid.appendChild(rowElement);
  });
}

export function matrixGridCells(grid) {
  return [...grid.querySelectorAll('[role="gridcell"]')];
}

export function syncMatrixTabStop(grid, preferred) {
  const cells = matrixGridCells(grid);
  const focused = cells.find((cell) => cell === grid.ownerDocument.activeElement);
  const stop = preferred || focused
    || cells.find((cell) => cell.getAttribute('aria-pressed') === 'true')
    || cells.find((cell) => cell.tabIndex === 0)
    || cells[0];
  cells.forEach((cell) => {
    const tabIndex = cell === stop ? 0 : -1;
    if (cell.tabIndex !== tabIndex) cell.tabIndex = tabIndex;
  });
}

export function bindMatrixGridKeyboard(grid, size) {
  if (grid.dataset.keyboardBound) return;
  grid.dataset.keyboardBound = 'true';
  grid.addEventListener('focusin', (event) => {
    const cell = event.target.closest('[role="gridcell"]');
    if (cell) syncMatrixTabStop(grid, cell);
  });
  grid.addEventListener('keydown', (event) => {
    const cell = event.target.closest('[role="gridcell"]');
    if (!cell) return;
    const cells = matrixGridCells(grid);
    const index = cells.indexOf(cell);
    if (index < 0) return;
    const row = Math.floor(index / size);
    const col = index % size;
    // The matrix is never mirrored (P1-30), so arrows stay physical in RTL.
    const target = {
      ArrowRight: col < size - 1 ? index + 1 : index,
      ArrowLeft: col > 0 ? index - 1 : index,
      ArrowDown: row < size - 1 ? index + size : index,
      ArrowUp: row > 0 ? index - size : index,
      Home: event.ctrlKey ? 0 : row * size,
      End: event.ctrlKey ? cells.length - 1 : row * size + size - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    syncMatrixTabStop(grid, cells[target]);
    cells[target].focus();
  });
}

// ── Pure helpers ────────────────────────────────────────────────────────────

export function matrixMixState(actions, dominantAction) {
  const meaningfulActions = actions.filter((action) => Number(action.value) >= 0.5);
  return meaningfulActions.length <= 1 || Number(dominantAction?.value) >= 99.5 ? 'pure' : 'mixed';
}

// The memo key: the whole decision context except the Hero cards, plus the
// provider options (PERF-001).
export function matrixStrategyKey(decisionContext, providerOptions) {
  if (!decisionContext) return 'unavailable';
  return JSON.stringify({
    decisionContext: { ...decisionContext, heroCards: null },
    providerOptions,
  });
}

// ── Controller ──────────────────────────────────────────────────────────────

/*
deps (all late-bound functions supplied by the page):
  translate(key, values), formatNumber(value, options)
  ranks()                      -> the 13 rank letters
  handCode(row, column)        -> 'AA' / 'AKs' / 'AKo'
  decisionContext()            -> the validated DecisionContext or null
  heroClass(decisionContext)   -> the Hero hand class ('' when unknown)
  currentStreet()              -> fallback street when the context has none
  providerOptions()            -> options folded into the memo key
  cardRemoval(classes, blockers) -> range-card-removal projection or null
  resolveCell(cellContext)     -> { source, unavailable, actions, claimPolicy() }
                                  (the page's single provider call per cell)
  visualActionKind(action), sourceLabel(source), policySummary(policy)
  selectedHand: { get(), set(handClass) }   (app.selectedHand stays on the page)
  modelCache:   { get(), set(model) }       (app.matrixModel stays on the page)
*/
export function mountAnalyzeMatrix(container, deps) {
  const t = (key, values) => deps.translate(key, values);
  const byId = (id) => container.querySelector(`#${id}`);
  let visible = false;
  let disposed = false;

  function renderInspector(cell) {
    if (!cell?.dataset.hand) return;
    const actions = JSON.parse(cell.dataset.strategyActions || '[]');
    const selectedHand = byId('selectedHand');
    const selectedKind = byId('selectedHandKind');
    const selectedPrimary = byId('selectedHandPrimary');
    const available = byId('selectedAvailableCombos');
    const removed = byId('selectedRemovedCombos');
    const source = byId('selectedRangeSource');
    const mix = byId('selectedMix');
    if (selectedHand) selectedHand.textContent = cell.dataset.hand;
    if (selectedKind) selectedKind.textContent = cell.dataset.handKindLabel || t('Hand class');
    if (selectedPrimary) {
      selectedPrimary.textContent = cell.dataset.primaryLabel || t('Strategy unavailable');
      selectedPrimary.dataset.actionKind = cell.dataset.primaryAction || 'unavailable';
    }
    if (available) available.textContent = cell.dataset.availableCombos || '-';
    if (removed) removed.textContent = cell.dataset.removedCombos || '-';
    if (source) source.textContent = cell.dataset.sourceLabel || t('Unavailable');
    if (mix) {
      const detail = cell.dataset.strategyCue || t('Strategy unavailable');
      mix.innerHTML = actions.length
        ? `<div class="matrix-inspector-actions">${actions.map((action) => `<span class="matrix-inspector-action"><i data-action-kind="${action.kind}"></i><span>${action.name}</span><strong>${deps.formatNumber(action.value, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%</strong></span>`).join('')}</div><div class="alloc" role="img" aria-label="${detail}">${actions.map((action) => `<i data-action-kind="${action.kind}" style="width:${action.value}%"></i>`).join('')}</div>`
        : `<span class="matrix-inspector-unavailable">${detail}</span>`;
    }
  }

  function restoreSelectedInspector(grid) {
    renderInspector(grid?.querySelector(`[data-hand="${deps.selectedHand.get()}"]`)
      || grid?.querySelector('[aria-pressed="true"]'));
  }

  function bindInteractions(grid) {
    if (!grid || grid.dataset.delegated) return;
    grid.dataset.delegated = 'true';
    grid.addEventListener('click', (event) => {
      const cell = event.target.closest('.hand-cell');
      if (!cell || !cell.dataset.hand) return;
      deps.selectedHand.set(cell.dataset.hand);
      const selectedHand = byId('selectedHand');
      if (selectedHand) selectedHand.textContent = cell.dataset.hand;
      render();
    });
    grid.addEventListener('pointerover', (event) => {
      const cell = event.target.closest('.hand-cell');
      if (!cell || (event.relatedTarget && cell.contains(event.relatedTarget))) return;
      renderInspector(cell);
    });
    grid.addEventListener('pointerout', (event) => {
      const cell = event.target.closest('.hand-cell');
      if (!cell || (event.relatedTarget && cell.contains(event.relatedTarget))) return;
      restoreSelectedInspector(grid);
    });
    grid.addEventListener('focusin', (event) => renderInspector(event.target.closest('.hand-cell')));
    grid.addEventListener('focusout', () => restoreSelectedInspector(grid));
    grid.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') restoreSelectedInspector(grid);
    });
    bindMatrixGridKeyboard(grid, deps.ranks().length);
  }

  function strategyKey(decisionContext) {
    return matrixStrategyKey(decisionContext, deps.providerOptions());
  }

  // The memoised model. The 169 resolveCell calls happen here and only here,
  // preflop, and only on a cache miss (the key excludes the Hero cards).
  function prepareModel(decisionContext) {
    const key = strategyKey(decisionContext);
    const cached = deps.modelCache.get();
    if (cached?.key === key) return cached;

    const ranks = deps.ranks();
    const unavailableContext = !decisionContext;
    const isPostFlop = !unavailableContext
      && (decisionContext.street || deps.currentStreet()) !== 'preflop';
    let source = null;
    let claimPolicy = null;
    const handClasses = ranks.flatMap((_, row) => ranks.map((__, column) => deps.handCode(row, column)));
    const cardRemoval = !isPostFlop && !unavailableContext
      ? deps.cardRemoval(handClasses, [...decisionContext.board, ...decisionContext.deadCards])
      : null;
    const cells = ranks.flatMap((_, row) => ranks.map((__, column) => {
      const hand = deps.handCode(row, column);
      let actions = [];
      if (!isPostFlop && !unavailableContext) {
        const representativeCards = cardRemoval?.cells[hand]?.firstEligibleCombo ?? null;
        if (representativeCards) {
          const cell = deps.resolveCell({ ...decisionContext, heroCards: representativeCards });
          source = source || cell.source;
          claimPolicy = claimPolicy || cell.claimPolicy();
          if (!cell.unavailable) actions = cell.actions;
        }
      }
      return {
        hand,
        actions,
        physicalComboCount: cardRemoval?.cells[hand]?.physicalComboCount ?? 0,
        eligibleComboCount: cardRemoval?.cells[hand]?.eligibleComboCount ?? 0,
        blockedComboCount: cardRemoval?.cells[hand]?.blockedComboCount ?? 0,
        cardRemovalState: !cardRemoval
          ? 'unavailable'
          : cardRemoval.cells[hand]?.fullyRemoved ? 'fully_removed' : 'eligible',
      };
    }));
    const model = { key, source, claimPolicy, isPostFlop, cells };
    deps.modelCache.set(model);
    return model;
  }

  function renderPostflopEmpty(grid) {
    grid.replaceChildren();
    const set = (id, text) => { const element = byId(id); if (element) element.textContent = text; };
    const preview = byId('chartSelectionPreview');
    if (preview) preview.innerHTML = `<span>${t('Exact hand only')}</span>`;
    set('selectedHand', t('Exact hand only'));
    set('selectedHandKind', t('Postflop decision'));
    set('selectedHandPrimary', t('Range expansion unavailable'));
    set('selectedAvailableCombos', '-');
    set('selectedRemovedCombos', '-');
    set('selectedRangeSource', t('Unavailable'));
    const mix = byId('selectedMix');
    if (mix) mix.innerHTML = `<span class="matrix-inspector-unavailable">${t('Use Decision for the exact-hand strategy.')}</span>`;
    set('chartSummary', t('Use Decision for exact-hand postflop strategy.'));
  }

  function render() {
    const grid = byId('strategyGrid');
    if (!grid) return;

    const decisionContext = deps.decisionContext();
    const contextUnavailable = !decisionContext;
    const positions = decisionContext?.heroPosition || '-';
    const stack = decisionContext?.stackBb ?? 0;
    const model = prepareModel(decisionContext);
    const currentHeroClass = contextUnavailable ? '' : deps.heroClass(decisionContext);
    const isPostFlop = model.isPostFlop;
    const modelSource = model.source;
    const modelClaimPolicy = model.claimPolicy;
    const layout = container.querySelector('.range-matrix-layout');
    const emptyState = byId('postflopMatrixEmpty');
    const toolbar = container.querySelector('.range-matrix-toolbar');
    const description = byId('matrixPanelDescription');

    if (layout) layout.hidden = isPostFlop;
    if (emptyState) emptyState.hidden = !isPostFlop;
    if (toolbar) toolbar.hidden = isPostFlop;
    if (description) {
      description.textContent = t(isPostFlop
        ? 'Range expansion is not available yet; use Decision for exact-hand postflop strategy.'
        : 'All 169 hand classes · click any square for its current mix.');
    }

    if (isPostFlop) {
      renderPostflopEmpty(grid);
      return;
    }

    const ranks = deps.ranks();
    if (grid.children.length === 0) buildMatrixGridCells(grid, 'hand-cell', null, ranks);

    bindInteractions(grid);
    const gridCells = matrixGridCells(grid);
    const selected = deps.selectedHand.get();
    const chartMode = byId('chartAction')?.value || 'strategy';
    const visualKind = (action) => deps.visualActionKind(action);
    let previewHTML = '';

    ranks.forEach((_, row) => ranks.forEach((__, column) => {
      const hand = deps.handCode(row, column);
      const matrixCell = model.cells[row * 13 + column];
      const actions = matrixCell?.actions || [];
      const dominantAction = actions.reduce((highest, action) =>
        Number(action.value) > Number(highest?.value ?? -1) ? action : highest, null);

      const type = dominantAction?.kind || 'unavailable';
      const handKind = row === column ? 'pair' : hand.endsWith('s') ? 'suited' : 'offsuit';
      const mixState = matrixMixState(actions, dominantAction);

      const detail = matrixCell?.cardRemovalState === 'fully_removed'
        ? t('Unavailable after known-card removal')
        : actions.length
          ? actions.map((action) => `${t(action.name)} ${action.value}%`).join(' · ')
          : isPostFlop
            ? t('Unavailable · provider-backed postflop Matrix deferred')
            : t('Strategy unavailable');

      const button = gridCells[row * 13 + column];
      const isSelected = selected === hand || (!selected && currentHeroClass === hand);

      button.className = `hand-cell hand-${handKind} action-${type} matrix-${mixState} ${isSelected ? 'selected ' : ''}${type}`;
      button.dataset.handKind = handKind;
      button.dataset.primaryAction = visualKind(dominantAction);
      button.dataset.mixState = mixState;
      button.dataset.state = actions.length ? 'available' : 'unavailable';
      button.dataset.strategySource = modelSource || 'unavailable';
      button.dataset.strategyCoverage = modelClaimPolicy?.coverage?.kind || 'unsupported';
      button.dataset.strategyPrecision = modelClaimPolicy?.capabilities?.actionDistribution || 'none';
      button.dataset.cardRemovalState = matrixCell?.cardRemovalState || 'unavailable';
      button.dataset.strategyCue = detail;
      button.setAttribute('aria-pressed', String(isSelected));

      let cellSubtext = '';
      let cellBg = '';
      button.style.removeProperty('background');

      const modeKinds = { raise: ['aggressive', '--action-aggressive'], call: ['passive', '--action-passive'], fold: ['fold', '--action-fold'] };
      if (modeKinds[chartMode]) {
        const [kind, token] = modeKinds[chartMode];
        const val = actions.find((a) => a.kind === kind)?.value;
        cellSubtext = actions.length ? `${val || 0}%` : t('Unavailable');
        if (actions.length) cellBg = `color-mix(in srgb, var(${token}) ${val || 0}%, transparent)`;
      }

      button.innerHTML = cellSubtext
        ? `<span class="matrix-hand-label">${hand}</span><div class="matrix-cell-subtext">${cellSubtext}</div>`
        : `<span class="matrix-hand-label">${hand}</span>`;

      button.dataset.hand = hand;

      const kindLabel = t(handKind === 'pair' ? 'Pair' : handKind === 'suited' ? 'Suited' : 'Offsuit');
      button.setAttribute('aria-label', `${hand}, ${kindLabel}: ${detail}`);
      button.dataset.handKindLabel = kindLabel;
      button.dataset.primaryLabel = dominantAction
        ? t('Primary · {action} {value}%', { action: t(dominantAction.name), value: dominantAction.value })
        : t('Strategy unavailable');
      button.dataset.availableCombos = matrixCell
        ? `${matrixCell.eligibleComboCount} / ${matrixCell.physicalComboCount}`
        : '-';
      button.dataset.removedCombos = matrixCell ? String(matrixCell.blockedComboCount) : '-';
      button.dataset.sourceLabel = modelSource ? deps.sourceLabel(modelSource) : t('Unavailable');
      button.dataset.strategyActions = JSON.stringify(actions.map((action) => ({
        kind: visualKind(action),
        name: t(action.name),
        value: action.value,
      })));

      if (cellBg) {
        button.style.background = cellBg;
      } else if (actions.length > 0) {
        button.insertAdjacentHTML('beforeend', `<span class="matrix-mix-bar" aria-hidden="true">${actions.map((action) => `<i data-action-kind="${visualKind(action)}" style="width:${action.value}%"></i>`).join('')}</span>`);
      }

      if (isSelected) {
        previewHTML = `<strong class="matrix-preview-hand">${hand}</strong><span class="matrix-preview-summary">${dominantAction ? `${t(dominantAction.name)} ${dominantAction.value}%` : t('Unavailable')}</span>`;
        renderInspector(button);
      }
    }));
    syncMatrixTabStop(grid);

    const previewContainer = byId('chartSelectionPreview');
    if (previewContainer) previewContainer.innerHTML = previewHTML || `<span>${t('Select a hand')}</span>`;

    const chartSummary = byId('chartSummary');
    if (chartSummary) {
      chartSummary.textContent = contextUnavailable
        ? t('Strategy unavailable for the current decision context')
        : `${positions} · ${stack} bb · ${deps.policySummary(modelClaimPolicy)}`;
    }
  }

  // Idle copy for a matrix that has never rendered (language refresh while the
  // tab is hidden). Never builds the grid and never resolves.
  function renderIdleCopy() {
    const grid = byId('strategyGrid');
    if (grid?.children.length) return;
    const set = (id, text) => { const element = byId(id); if (element) element.textContent = text; };
    set('matrixPanelDescription', t('All 169 hand classes · click any square for its current mix.'));
    set('selectedHand', t('Select a hand'));
    set('selectedHandKind', t('Hand class'));
    set('selectedHandPrimary', t('No action selected'));
  }

  return {
    schemaVersion: ANALYZE_MATRIX_SCHEMA_VERSION,
    render,
    prepareModel,
    strategyKey,
    renderInspector,
    // Language refresh never renders a hidden surface (PERF-001). The page
    // marks the surface dirty and repaints a visible matrix through the same
    // render path as any update; a matrix that never rendered only gets its
    // idle copy translated here.
    refreshLanguage() {
      if (disposed) return;
      renderIdleCopy();
    },
    // The orchestrator pushes tab visibility; the module never reads display.
    setVisible(next) { visible = Boolean(next); },
    isVisible() { return visible; },
    handleKey() { return false; },
    dispose() {
      if (disposed) return;
      disposed = true;
      visible = false;
    },
  };
}

export { mountAnalyzeMatrix as mount };

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineAnalyzeMatrix', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: ANALYZE_MATRIX_SCHEMA_VERSION,
      mount: mountAnalyzeMatrix,
      matrixMixState,
      matrixStrategyKey,
    }),
    writable: false,
  });
}
