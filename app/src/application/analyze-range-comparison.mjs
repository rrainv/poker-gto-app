// EXTRACT-ANALYZE-002: the Analyze Range Category Comparison tab (#rangeView).
//
// Renders the two fixed heuristic preflop samples (Hero and opponent) as
// 13x13 category grids with shares, bars, coverage and card-removal copy. All
// classification comes from the canonical comparison facts the page hands in
// (deps.comparisonFacts); the module has no evaluator, no strategy provider
// and no equity of its own.
//
// Controller: mount(container, deps) -> { dispose, refreshLanguage, handleKey,
// setVisible, render, ... }. Everything the page provides is injected; the
// module never reaches for window.app.

import {
  buildMatrixGridCells,
  bindMatrixGridKeyboard,
  matrixGridCells,
  syncMatrixTabStop,
} from './analyze-matrix.mjs';

export const ANALYZE_RANGE_COMPARISON_SCHEMA_VERSION = 'analyze-range-comparison/v1';

const STAT_IDS = Object.freeze({
  hero: Object.freeze({ veryStrong: 'heroStatVeryStrong', strongMade: 'heroStatStrongMade', marginal: 'heroStatMarginal', air: 'heroStatAir' }),
  villain: Object.freeze({ veryStrong: 'vilStatVeryStrong', strongMade: 'vilStatStrongMade', marginal: 'vilStatMarginal', air: 'vilStatAir' }),
});

export function rangeRemovalPresentation(cardRemoval) {
  const cells = Object.values(cardRemoval?.cells || {});
  return {
    affectedClasses: cells.filter((cell) => cell.blockedComboCount > 0).length,
    unavailableClasses: cells.filter((cell) => cell.fullyRemoved).length,
    removedCombos: cells.reduce((sum, cell) => sum + cell.blockedComboCount, 0),
  };
}

export function rangeComparisonStats(facts) {
  const counts = facts?.categoryCounts || {};
  return {
    veryStrong: counts.very_strong_made || 0,
    strongMade: counts.strong_made || 0,
    marginal: counts.marginal_or_draw || 0,
    air: counts.air || 0,
    total: facts?.coverage?.eligibleRepresentativeCount || 0,
  };
}

/*
deps (all late-bound functions supplied by the page):
  translate(key, values), formatFixed(value, digits)
  ranks(), handCode(row, column)
  isHandMode()                 -> true when the workspace is in Hand mode
  modes: { HAND, SCENARIO }    -> the mode strings returned in the result
  board()                      -> the Scenario board cards (non-empty only)
  decisionContext()            -> the validated DecisionContext or null
  preflopRanges()              -> the fixed heuristic samples by position
  cardRemoval(classes, blockers)  -> range-card-removal projection or null
  comparisonFacts(range, board, cardRemoval) -> canonical comparison facts or null
*/
export function mountAnalyzeRangeComparison(container, deps) {
  const t = (key, values) => deps.translate(key, values);
  const byId = (id) => container.querySelector(`#${id}`);
  let visible = false;
  let disposed = false;

  function renderCategoryBars(stats, side) {
    [['VeryStrong', 'veryStrong'], ['StrongMade', 'strongMade'], ['Marginal', 'marginal'], ['Air', 'air']]
      .forEach(([idPart, key]) => {
        const share = stats.total ? stats[key] / stats.total * 100 : 0;
        const bar = byId(`${side}${idPart}Bar`);
        if (bar) bar.style.width = `${share.toFixed(1)}%`;
      });
  }

  function renderGrid(gridId, hoverInfoId, comparisonFacts, statIds) {
    const grid = byId(gridId);
    if (!grid) return { veryStrong: 0, strongMade: 0, marginal: 0, air: 0, total: 0 };

    const ranks = deps.ranks();
    const stats = rangeComparisonStats(comparisonFacts);
    const CATEGORY = {
      very_strong_made: { state: 'very-strong', label: t('Very strong made') },
      strong_made: { state: 'strong-made', label: t('Strong made') },
      marginal_or_draw: { state: 'marginal-draw', label: t('Marginal or draw') },
      air: { state: 'air', label: t('Air') },
    };

    // Init grid once
    if (grid.children.length === 0) {
      buildMatrixGridCells(grid, 'hand-cell range-cell', (btn, row, col) => {
        btn.dataset.hand = deps.handCode(row, col);
        btn.dataset.index = row * 13 + col;
      }, ranks);
      bindMatrixGridKeyboard(grid, ranks.length);

      // Event delegation
      const inspect = (e) => {
        const btn = e.target.closest('.range-cell');
        if (btn) {
          const info = byId(hoverInfoId);
          if (info) info.textContent = `${btn.dataset.hand}: ${btn.title}`;
        }
      };
      const clearInspection = (e) => {
        const btn = e.target.closest('.range-cell');
        if (btn) {
          const info = byId(hoverInfoId);
          if (info) info.textContent = t('Focus or hover a hand to see details');
        }
      };
      grid.addEventListener('mouseover', inspect);
      grid.addEventListener('focusin', inspect);
      grid.addEventListener('mouseout', clearInspection);
      grid.addEventListener('focusout', clearInspection);
    }

    const gridCells = matrixGridCells(grid);
    ranks.forEach((_, row) => ranks.forEach((__, col) => {
      const hand = deps.handCode(row, col);
      const cell = comparisonFacts?.cells?.[hand];
      const presentation = CATEGORY[cell?.category] || null;
      const btn = gridCells[row * 13 + col];
      const fullyRemoved = cell?.state === 'fully_removed';
      const notInSample = cell?.state === 'not_in_sample';
      const state = fullyRemoved ? 'fully-removed' : notInSample ? 'not-in-sample' : 'eligible';
      const category = presentation?.state || 'none';
      const stateLabel = fullyRemoved
        ? t('Unavailable after known-card removal')
        : notInSample ? t('Not in sample') : presentation?.label || t('Unavailable');

      btn.textContent = hand;
      btn.title = stateLabel;
      btn.setAttribute('aria-label', `${hand}: ${stateLabel}`);
      btn.className = `hand-cell range-cell range-state-${category} is-${state}`;
      btn.dataset.category = category;
      btn.dataset.cardRemovalState = state;
      btn.dataset.sampleState = state;
      btn.disabled = false;
    }));
    syncMatrixTabStop(grid);

    if (statIds) {
      const pct = (v) => stats.total ? `${deps.formatFixed(v / stats.total * 100, 0)}%` : '0%';
      Object.entries(statIds).forEach(([key, id]) => {
        const element = byId(id);
        if (element) element.textContent = `${stats[key]} (${pct(stats[key])})`;
      });
    }
    return stats;
  }

  function unavailable(status, message, state, extra) {
    const analysis = byId('rangeAdvantageAnalysis');
    const statusElement = byId('rangeAdvantageStatus');
    if (analysis) analysis.hidden = true;
    if (statusElement) {
      statusElement.dataset.state = state;
      statusElement.textContent = message;
    }
    return { status, ...extra };
  }

  function render() {
    const heroPos = byId('rangeAdvHeroPos')?.value || 'BTN';
    const villainPos = byId('rangeAdvVilPos')?.value || 'BB';
    const status = byId('rangeAdvantageStatus');
    const analysis = byId('rangeAdvantageAnalysis');
    const positions = { heroPos, villainPos };

    const heroTitle = byId('heroRangeTitle');
    const villainTitle = byId('villainRangeTitle');
    if (heroTitle) heroTitle.textContent = `${t('Hero sample')} (${heroPos})`;
    if (villainTitle) villainTitle.textContent = `${t('Villain sample')} (${villainPos})`;

    if (deps.isHandMode()) {
      return unavailable('unavailable', t('Unavailable in Hand Mode. Canonical hand history does not establish weighted ranges, so Scenario cards and manual range assumptions are not used.'),
        'unavailable', { mode: deps.modes.HAND, ...positions });
    }

    const samples = deps.preflopRanges();
    const heroRange = samples[heroPos] || samples.BTN;
    const villainRange = samples[villainPos] || samples.BB;
    const board = deps.board();
    if (board.length < 3) {
      return unavailable('waiting_for_board', t('Add at least a flop to compare the manually selected heuristic range samples.'),
        'waiting', { mode: deps.modes.SCENARIO, ...positions });
    }

    const decisionContext = deps.decisionContext();
    if (!decisionContext) {
      return unavailable('decision_context_unavailable', t('Range comparison is unavailable because the canonical decision context could not be resolved.'),
        'unavailable', { mode: deps.modes.SCENARIO, ...positions });
    }
    const commonBlockers = [...decisionContext.board, ...decisionContext.deadCards];
    const heroCardRemoval = deps.cardRemoval([...heroRange], commonBlockers);
    const villainCardRemoval = deps.cardRemoval(
      [...villainRange],
      [...commonBlockers, ...decisionContext.heroCards],
    );
    if (!heroCardRemoval || !villainCardRemoval) {
      return unavailable('card_removal_unavailable', t('Range comparison is unavailable because canonical card removal could not be loaded.'),
        'unavailable', { mode: deps.modes.SCENARIO, ...positions });
    }
    const heroFacts = deps.comparisonFacts(heroRange, board, heroCardRemoval);
    const villainFacts = deps.comparisonFacts(villainRange, board, villainCardRemoval);
    if (!heroFacts || !villainFacts) {
      return unavailable('analysis_facts_unavailable', t('Range comparison is unavailable because canonical analysis facts could not be loaded.'),
        'unavailable', { mode: deps.modes.SCENARIO, ...positions });
    }

    if (analysis) analysis.hidden = false;
    if (status) {
      status.dataset.state = 'available';
      status.textContent = t('Hero and opponent sample matrices are ready.');
    }

    const heroStats = rangeComparisonStats(heroFacts);
    const villainStats = rangeComparisonStats(villainFacts);
    renderGrid('heroRangeGrid', 'heroHoverInfo', heroFacts, STAT_IDS.hero);
    renderGrid('villainRangeGrid', 'villainHoverInfo', villainFacts, STAT_IDS.villain);
    renderCategoryBars(heroStats, 'hero');
    renderCategoryBars(villainStats, 'villain');

    const setText = (id, text) => { const element = byId(id); if (element) element.textContent = text; };
    const heroStrongShare = (heroFacts.categoryShares.very_strong_made || 0)
      + (heroFacts.categoryShares.strong_made || 0);
    const villainStrongShare = (villainFacts.categoryShares.very_strong_made || 0)
      + (villainFacts.categoryShares.strong_made || 0);
    const heroBar = byId('heroAdvBar');
    const villainBar = byId('villainAdvBar');
    if (heroBar) heroBar.style.width = `${(heroStrongShare * 100).toFixed(1)}%`;
    if (villainBar) villainBar.style.width = `${(villainStrongShare * 100).toFixed(1)}%`;
    setText('heroRangeScore', `${deps.formatFixed(heroStrongShare * 100, 1)}% ${t('strong made categories')}`);
    setText('villainRangeScore', `${deps.formatFixed(villainStrongShare * 100, 1)}% ${t('strong made categories')}`);

    const heroRemoval = rangeRemovalPresentation(heroCardRemoval);
    const villainRemoval = rangeRemovalPresentation(villainCardRemoval);
    setText('rangeComparisonLimitation', t('Source: heuristic fixed-range/category analysis. Uses one canonical surviving representative per eligible sampled class; its category does not describe every combo in that class. This is not solver range advantage, range-vs-range equity, or sizing/frequency evidence.'));
    setText('heroRangeBasis', t('Hero · fixed heuristic class sample ({position})', { position: heroPos }));
    setText('villainRangeBasis', t('Opponent · fixed heuristic class sample ({position})', { position: villainPos }));
    setText('rangeCoverageBasis', t('{heroEligible} of {heroSample} Hero classes and {villainEligible} of {villainSample} opponent classes have one canonical surviving representative. Shares describe those representatives only, not every combo in each class; unlisted classes are not inferred.', {
      heroEligible: heroFacts.coverage.eligibleRepresentativeCount,
      heroSample: heroFacts.coverage.suppliedSampleClassCount,
      villainEligible: villainFacts.coverage.eligibleRepresentativeCount,
      villainSample: villainFacts.coverage.suppliedSampleClassCount,
    }));
    setText('rangeRemovalSummary', t('{heroAffected} Hero classes affected ({heroUnavailable} unavailable); {villainAffected} opponent classes affected ({villainUnavailable} unavailable). Board/dead cards condition both; Hero cards additionally condition the opponent.', {
      heroAffected: heroRemoval.affectedClasses,
      heroUnavailable: heroRemoval.unavailableClasses,
      villainAffected: villainRemoval.affectedClasses,
      villainUnavailable: villainRemoval.unavailableClasses,
    }));
    setText('rangeRemovalTechnical', t('Physical combos removed within the selected class samples: Hero {heroCombos}; opponent {villainCombos}. Known weighted mass is unavailable because these samples have no combo weights.', {
      heroCombos: heroRemoval.removedCombos,
      villainCombos: villainRemoval.removedCombos,
    }));
    const paired = container.querySelector('.paired-range-comparison');
    if (paired) paired.setAttribute('aria-label', t('Hero {hero}% and opponent {villain}% strong-category shares. Independent percentages on the same zero to one hundred percent scale.', {
      hero: deps.formatFixed(heroStrongShare * 100, 1),
      villain: deps.formatFixed(villainStrongShare * 100, 1),
    }));

    let title = t('Similar sampled categories');
    let description = t('The sampled made-hand and draw categories are similar.');
    let color = 'var(--orange)';
    if (heroStrongShare - villainStrongShare > 0.10) {
      title = t('Hero sample contains more strong made categories');
      description = t('This heuristic range sample contains a higher share of strong and very strong made-hand categories for Hero.');
      color = 'var(--primary)';
    } else if (villainStrongShare - heroStrongShare > 0.10) {
      title = t('Villain sample contains more strong made categories');
      description = t("Villain's sampled range contains a higher share of strong and very strong made-hand categories.");
      color = 'var(--red)';
    }

    const conclusion = byId('rangeConclusion');
    if (conclusion) {
      conclusion.replaceChildren();
      const heading = container.ownerDocument.createElement('strong');
      heading.textContent = title;
      const copy = container.ownerDocument.createElement('span');
      copy.textContent = description;
      conclusion.append(heading, container.ownerDocument.createElement('br'), copy);
      conclusion.style.borderLeftColor = color;
    }

    return {
      status: 'available',
      mode: deps.modes.SCENARIO,
      heroPos,
      villainPos,
      heroStrongShare,
      villainStrongShare,
    };
  }

  // Idle copy for a comparison that never rendered (language refresh while the
  // tab is hidden). Never builds a grid and never computes facts.
  function renderIdleCopy() {
    if (byId('heroRangeGrid')?.children.length) return;
    const setText = (id, text) => { const element = byId(id); if (element) element.textContent = text; };
    setText('rangeAdvantageStatus', t('Add at least a flop to compare the manually selected heuristic range samples.'));
    setText('heroRangeTitle', t('Hero sample'));
    setText('villainRangeTitle', t('Villain sample'));
  }

  return {
    schemaVersion: ANALYZE_RANGE_COMPARISON_SCHEMA_VERSION,
    render,
    renderGrid,
    // Never renders a hidden surface (PERF-001): the page marks it dirty and
    // repaints a visible comparison through the same render path as any update.
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

export { mountAnalyzeRangeComparison as mount };

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'RiverlineAnalyzeRangeComparison', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({
      schemaVersion: ANALYZE_RANGE_COMPARISON_SCHEMA_VERSION,
      mount: mountAnalyzeRangeComparison,
      rangeComparisonStats,
      rangeRemovalPresentation,
    }),
    writable: false,
  });
}
