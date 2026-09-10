import { createEquityController } from './equity-controller.mjs';
import { asWeightedEquityRequest, groupRunouts } from './runout-explorer.mjs';
import { parseExplicitEquityRange, weightedRangePlayer } from './weighted-equity-consumers.mjs';
import { advancedEquityCopy as copy, weightedEquityLanguage } from './advanced-equity-language.mjs';
import { bindDisclosureDismissal } from '../ui/study-disclosure.mjs';
import { appendCardFaceContents } from './card-presentation.mjs';

export function mountAdvancedEquity({ root, getRequest, language = () => 'en', signal = null,
  getPlayerLabel = () => null,
  controller = createEquityController(), forcedRangeIds = [], rangeSourceRole = 'user_supplied',
  rangeSourceId = 'explicit-user-range', hypothesis = null }) {
  const doc = root.ownerDocument, lifecycle = new AbortController();
  let inputLife = new AbortController(), cardLife = new AbortController();
  let generation = 0, rows = [], sourceKey = null, draftRequest = null, runoutAvailable = false, inspectedRow = null;
  const drafts = new Map();
  const t = key => copy(key, language());
  let displayPlayers = [];
  const playerLabel = id => {
    const index = displayPlayers.findIndex(player => player.id === id);
    return getPlayerLabel(id, index) || displayPlayers[index]?.displayName || (index === 0 ? t('hero') : `${t('player')} ${index < 0 ? '' : index + 1}`.trim());
  };
  function named(tag, id) { const node = el(tag, playerLabel(id)); node.dataset.displayPlayer = id; return node; }
  function refreshLabels() { for (const node of root.querySelectorAll('[data-display-player]')) node.textContent = playerLabel(node.dataset.displayPlayer); }
  function el(tag, text, className) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function cardToken(card, emphasized = false) {
    const token = el(emphasized ? 'strong' : 'span', undefined, 'riverline-card advanced-mini-card');
    token.dataset.cardSize = 'mini'; token.setAttribute('role', 'img'); token.setAttribute('aria-label', card);
    appendCardFaceContents(token, { rank: card.slice(0, -1), suit: card.slice(-1),
      rankStyle: doc.documentElement?.dataset.cardRankStyle || 'poker' });
    return token;
  }
  function listen(node, event, callback, eventSignal = lifecycle.signal) { node.addEventListener(event, callback, { signal: eventSignal }); }
  const panel = el('details', undefined, 'advanced-equity study-disclosure'), summary = el('summary', t('title'));
  bindDisclosureDismissal(panel, { signal: lifecycle.signal });
  const body = el('div', undefined, 'advanced-equity-body'), inputs = el('div', undefined, 'advanced-equity-inputs');
  const intro = el('p', t('intro'), 'study-note'), tutorial = el('p', t('tutorial'), 'study-note');
  if (hypothesis) intro.textContent = hypothesis;
  const status = el('p', '', 'study-status'); status.role = 'status';
  const setStatus = (message, state = 'idle') => { status.textContent = message; status.dataset.state = state; };
  const output = el('div', undefined, 'advanced-equity-output');
  output.ariaLive = 'polite';
  const run = el('button', t('calculate'), 'ui-button ui-button--primary'), cancel = el('button', t('cancel'), 'ui-button ui-button--secondary');
  run.type = cancel.type = 'button';
  const controls = el('div', undefined, 'advanced-equity-controls');
  const partialLabel = el('label', undefined, 'advanced-equity-partial'), partial = el('input'); partial.type = 'checkbox';
  partialLabel.append(partial, el('span', t('conditional')));
  const seedLabel = el('label', t('seed')), seed = el('input');
  seed.type = 'number'; seed.min = '0'; seed.max = '4294967295'; seed.step = '1'; seed.value = '1'; seedLabel.append(seed);
  controls.append(run, cancel);
  const explorer = el('details', undefined, 'advanced-equity-explorer study-disclosure'), explorerTitle = el('summary', t('explorer'));
  explorer.open = true;
  bindDisclosureDismissal(explorer, { signal: lifecycle.signal });
  const pathsLabel = el('label', t('paths')), paths = el('input'); paths.dir = 'ltr'; pathsLabel.append(paths);
  const all = el('button', t('all'), 'ui-button'), selected = el('button', t('selected'), 'ui-button');
  all.type = selected.type = 'button';
  const group = el('select'), groupLabel = el('label', t('group'));
  for (const value of ['rank', 'suit', 'category', 'equityChange', 'handChange', 'completion']) { const option = el('option', t(value)); option.value = value; group.append(option); }
  groupLabel.append(group);
  const cardsOutput = el('div', undefined, 'advanced-equity-runout-results'), preview = el('div', undefined, 'advanced-equity-preview');
  preview.ariaLive = 'polite';
  const explorerControls = el('div', undefined, 'advanced-equity-runout-controls');
  explorerControls.append(all, groupLabel);
  const sequences = el('details', undefined, 'study-disclosure advanced-equity-sequences');
  sequences.append(el('summary', t('paths')), pathsLabel, selected);
  bindDisclosureDismissal(sequences, { signal: lifecycle.signal });
  const inspection = el('div', undefined, 'advanced-equity-inspection'); inspection.append(cardsOutput, preview);
  explorer.append(explorerTitle, el('p', t('streets'), 'study-note'), explorerControls, sequences, inspection);
  const help = el('details', undefined, 'study-disclosure advanced-equity-help'); help.append(el('summary', t('help')), intro, tutorial, el('p', t('nextNote'), 'study-note'), seedLabel);
  bindDisclosureDismissal(help, { signal: lifecycle.signal });
  const setup = el('section', undefined, 'advanced-equity-setup'), resultPanel = el('section', undefined, 'advanced-equity-result');
  setup.append(el('h3', t('matchup')), inputs, partialLabel, controls);
  resultPanel.append(el('h3', t('result')), status, output);
  if (hypothesis) body.append(el('p', hypothesis, 'study-note'));
  body.append(setup, resultPanel, explorer, help);
  panel.append(summary, body); root.replaceChildren(panel); root.dir = language() === 'he' ? 'rtl' : 'ltr';
  function invalidate() {
    generation++; controller.cancel(); rows = []; draftRequest = null; inspectedRow = null;
    cardLife.abort(); cardLife = new AbortController();
    output.replaceChildren(el('p', t('resultEmpty'), 'study-empty')); cardsOutput.replaceChildren();
    preview.replaceChildren(el('p', t('previewEmpty'), 'study-note'));
    run.disabled = false; cancel.hidden = true; all.disabled = selected.disabled = !runoutAvailable; setStatus('');
  }
  function refresh() {
    if (!panel.open) { invalidate(); sourceKey = null; return; }
    const source = getRequest(), key = JSON.stringify(source);
    if (sourceKey === key) return;
    sourceKey = key; runoutAvailable = [3, 4].includes(source?.board?.length);
    invalidate(); drafts.clear(); inputs.replaceChildren();
    inputLife.abort(); inputLife = new AbortController();
    if (!source) { setStatus(t('empty'), 'unavailable'); return; }
    displayPlayers = source.players;
    seed.value = String(source.seed ?? 1);
    for (const player of source.players) {
      const field = el('fieldset'), legend = named('legend', player.id); field.append(legend);
      const activeSummary = el('div', undefined, 'advanced-equity-active-input');
      field.append(activeSummary);
      if (!forcedRangeIds.includes(player.id) && player.cards?.length) {
        const cards = el('div', undefined, 'advanced-equity-current-cards advanced-equity-cards'); cards.dir = 'ltr';
        cards.append(...player.cards.map(card => cardToken(card))); activeSummary.append(cards);
      } else activeSummary.append(el('p', forcedRangeIds.includes(player.id) ? t('range') : player.kind === 'range' ? t('range') : t('uniform')));
      if (player.kind === 'range') {
        field.append(el('p', `${t(player.sourceRole)} · ${t('range')}`));
        inputs.append(field); continue;
      }
      const mode = el('select'), current = el('option', t('current')), ranged = el('option', t('range'));
      current.value = 'current'; ranged.value = 'range'; mode.append(current, ranged);
      mode.value = 'current';
      if (forcedRangeIds.includes(player.id)) { mode.value = 'range'; mode.disabled = true; }
      const modeLabel = el('label', t('current')); modeLabel.append(mode);
      const text = el('textarea'); text.rows = 2; text.dir = 'ltr'; text.placeholder = 'AA:1, AKs:0.5';
      const textLabel = el('label', t('weights')); textLabel.append(text, el('small', t('syntax'), 'study-note'));
      const missing = el('select');
      for (const [value, key] of [['unknown', 'unknown'], ['known_zero', 'zero']]) { const option = el('option', t(key)); option.value = value; missing.append(option); }
      missing.value = 'unknown';
      const missingLabel = el('label', t('unlisted')); missingLabel.append(missing);
      textLabel.hidden = missingLabel.hidden = mode.value !== 'range';
      const currentSummary = [...activeSummary.children];
      listen(mode, 'change', () => {
        textLabel.hidden = missingLabel.hidden = mode.value !== 'range';
        activeSummary.replaceChildren(...(mode.value === 'range' ? [el('p', t('range'))] : currentSummary));
        invalidate();
      }, inputLife.signal);
      listen(text, 'input', invalidate, inputLife.signal); listen(missing, 'change', invalidate, inputLife.signal);
      const editor = el('details', undefined, 'study-disclosure advanced-equity-range-editor');
      editor.open = forcedRangeIds.includes(player.id);
      editor.append(el('summary', t('editRange')), modeLabel, textLabel, missingLabel);
      bindDisclosureDismissal(editor, { signal: inputLife.signal });
      drafts.set(player.id, { mode, text, missing }); field.append(editor); inputs.append(field);
    }
  }
  function request() {
    const source = getRequest(); if (!source) throw Error('missing');
    if (!seed.value.trim()) throw Error('seed_required');
    const value = asWeightedEquityRequest(source);
    value.seed = Number(seed.value); value.partialPolicy = partial.checked ? 'known_only' : 'reject';
    value.players = value.players.map(player => {
      const draft = drafts.get(player.id);
      return draft?.mode.value === 'range' ? weightedRangePlayer(player.id,
        parseExplicitEquityRange(draft.text.value, draft.missing.value), rangeSourceRole, rangeSourceId) : player;
    });
    return value;
  }
  function showResult(result) {
    output.replaceChildren();
    if (!result.players?.length) setStatus(t('error'), 'unavailable');
    else {
      const languageFacts = weightedEquityLanguage(result, language());
      languageFacts.lines.forEach((line, index) => output.append(el('p', line,
        index === 0 ? result.conditionalOnKnownMass ? 'study-warning' : 'study-badge' : 'study-note')));
      const values = el('div', undefined, 'advanced-equity-values');
      for (const player of result.players) {
        const row = el('div', undefined, 'advanced-equity-value');
        const label = named('bdi', player.id), value = el('strong', `Equity ${(player.equity * 100).toFixed(2)}%`);
        value.dir = 'ltr'; row.append(label, value); values.append(row);
      }
      output.append(values);
    }
    const details = el('details'); details.append(el('summary', t('evidence')));
    const standing = result.presentation?.currentStanding;
    if (standing) details.append(el('p', `${t('standing')}: ${[standing.ahead, standing.tied, standing.behind].map(value => `${(value * 100).toFixed(1)}%`).join(' / ')}`));
    for (const coverage of result.coverage ?? []) {
      const heading = el('p'); heading.append(named('bdi', coverage.playerId), el('span', ` · ${t('coverage')}: ${coverage.knownCombos} / ${coverage.eligibleCombos}`));
      details.append(heading,
        el('p', `${t('mass')}: ${coverage.knownMass.toFixed(3)} / [${coverage.unknownMassBounds.join(', ')}] / ${coverage.blockedKnownMass.toFixed(3)}`));
    }
    details.append(el('p', `${t('seed')}: ${seed.value}`, 'study-note'));
    output.append(details);
  }
  function inspect(row, { force = false } = {}) {
    if (row === inspectedRow && !force) return;
    inspectedRow = row;
    preview.replaceChildren(el('p', t('hypothetical'), 'study-badge'));
    const hero = draftRequest.players[0], hand = row.resultingHand;
    if (hand) {
      const cards = el('div', undefined, 'advanced-equity-cards'); cards.dir = 'ltr';
      for (const card of [...hero.cards, ...draftRequest.board, ...row.cards]) {
        const selectedCard = hand.bestFiveCards.includes(card);
        const token = cardToken(card, selectedCard);
        if (!selectedCard) token.className += ' unused';
        cards.append(token);
      }
      preview.append(cards, el('h4', t(hand.category)));
    }
    if (row.categoryImproved) preview.append(el('p', t('improved')));
    if (row.enteredStanding) preview.append(el('p', t(row.enteredStanding)));
    if (row.deltaEstimated) preview.append(el('p', t('noise')));
    if (row.equity !== null) preview.append(el('strong', `Equity ${(row.equity * 100).toFixed(1)}%`, 'runout-detail-equity'));
    const detail = el('details'); detail.append(el('summary', t('evidence')), el('p', t('nextNote'), 'study-note'));
    for (const removal of row.removal ?? []) {
      const line = el('p'); line.append(named('bdi', removal.playerId), el('span', ` · ${t('coverage')}: ${removal.after?.knownEligibleCombos ?? '-'} / ${removal.after?.eligibleCombos ?? '-'}`)); detail.append(line);
    }
    preview.append(detail);
    for (const node of cardsOutput.querySelectorAll('button')) node.setAttribute('aria-pressed', String(node.dataset.runout === row.cards.join(' ')));
  }
  function renderCards() {
    cardLife.abort(); cardLife = new AbortController();
    cardsOutput.replaceChildren();
    const buckets = ['rank', 'suit', 'category'].includes(group.value) ? groupRunouts(rows, group.value) : groupPresentedRunouts(rows, group.value);
    for (const bucket of buckets) {
      const section = el('section'), list = el('div', undefined, 'advanced-equity-next-grid');
      section.append(el('h4', `${t(bucket.key)} · ${bucket.rows.length}`));
      for (const row of bucket.rows) {
        const button = el('button', undefined, 'ui-button runout-card');
        button.dataset.runout = row.cards.join(' '); button.setAttribute('aria-pressed', String(inspectedRow === row));
        button.dataset.equityChange = row.equityDelta === null ? 'unknown' : row.equityDelta > 0 ? 'up' : row.equityDelta < 0 ? 'down' : 'same';
        const faces = el('span', undefined, 'runout-card-faces'); faces.append(...row.cards.map(card => cardToken(card)));
        button.append(faces, el('strong', row.equity === null ? '-' : `${(row.equity * 100).toFixed(1)}%`),
          el('small', row.equityDelta === null ? t('unavailable') : `${row.deltaEstimated ? '≈ ' : ''}${row.equityDelta > 0 ? '+' : ''}${(row.equityDelta * 100).toFixed(1)} ${t('deltaUnit')}`),
          el('span', row.resultingHand ? `${t(row.resultingHand.category)}${row.categoryImproved ? ` · ${t('improved')}` : ''}` : t('range'), 'runout-card-category'));
        button.type = 'button'; button.dir = language() === 'he' ? 'rtl' : 'ltr';
        listen(button, 'focus', () => inspect(row), cardLife.signal); listen(button, 'mouseenter', () => inspect(row), cardLife.signal); listen(button, 'click', () => inspect(row), cardLife.signal); list.append(button);
      }
      section.append(list); cardsOutput.append(section);
    }
  }
  async function calculate(runouts = false, every = false) {
    invalidate(); const token = generation;
    try {
      const input = request(); draftRequest = input;
      output.replaceChildren();
      run.disabled = all.disabled = selected.disabled = true; cancel.hidden = false; setStatus(t('running'), 'running');
      const sequences = every ? null : paths.value.split(';').map(path => path.trim().split(/\s+/)).filter(path => path[0]);
      const result = await controller.calculate(runouts ? { schemaVersion: 'runout-request/v1', request: input,
        options: { sequences, samples: 500 } } : input, { onProgress(progress) {
        if (token === generation) setStatus(`${t('running')} ${progress.completed} / ${progress.total}`, 'running');
      } });
      if (token !== generation || lifecycle.signal.aborted) return;
      setStatus('');
      if (runouts && result.rows) { showResult(result.baseline); rows = result.rows; renderCards(); }
      else showResult(result);
    } catch { if (token === generation) setStatus(t('error'), 'unavailable'); }
    finally { if (token === generation) { run.disabled = false; cancel.hidden = true; all.disabled = selected.disabled = !runoutAvailable; } }
  }
  listen(panel, 'toggle', () => { if (panel.open) refresh(); else invalidate(); });
  listen(run, 'click', () => calculate()); listen(all, 'click', () => calculate(true, true));
  listen(selected, 'click', () => calculate(true));
  listen(cancel, 'click', () => { invalidate(); run.focus(); });
  listen(partial, 'change', invalidate); listen(seed, 'input', invalidate); listen(paths, 'input', invalidate);
  listen(group, 'change', renderCards);
  doc.defaultView?.addEventListener('riverline:cardpresentationchange', () => {
    for (const cards of inputs.querySelectorAll('.advanced-equity-current-cards')) {
      for (const token of cards.children) {
        const card = token.getAttribute('aria-label');
        appendCardFaceContents(token, { rank: card.slice(0, -1), suit: card.slice(-1),
          rankStyle: doc.documentElement?.dataset.cardRankStyle || 'poker' });
      }
    }
    renderCards();
    if (inspectedRow) inspect(inspectedRow, { force: true });
  }, { signal: lifecycle.signal });
  const dispose = () => { invalidate(); lifecycle.abort(); inputLife.abort(); cardLife.abort(); controller.dispose(); root.replaceChildren(); };
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose(); else refresh();
  return { invalidate, refresh, refreshLabels, dispose };
}

// Group existing result facts only; no new hand classification or Equity work.
export function groupPresentedRunouts(rows, by) {
  const buckets = new Map();
  for (const row of rows) {
    const key = by === 'equityChange' ? row.equityDelta === null ? 'unavailable' : row.equityDelta > 0 ? 'raisesEquity' : row.equityDelta < 0 ? 'lowersEquity' : 'sameEquity'
      : by === 'handChange' ? row.categoryImproved == null ? 'unavailable' : row.categoryImproved ? 'improved' : 'sameCategory'
        : !row.resultingHand ? 'unavailable' : row.completion?.category ?? 'noCompletion';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets].map(([key, rows]) => ({ key, rows }));
}

export function installAdvancedEquityWorkspace(browserWindow) {
  const root = browserWindow.document.getElementById('advancedEquityWorkspace');
  if (!root) return null;
  let source = browserWindow.equityRequestFromCurrentInputs?.() ?? null;
  const language = () => browserWindow.document.documentElement.lang.split('-')[0] || 'en';
  const getPlayerLabel = (_id, index) => index >= 0 ? browserWindow.equityPlayerLabel?.(index) : null;
  let workspace = mountAdvancedEquity({ root, getRequest: () => source, language, getPlayerLabel });
  const bridge = { setSource(request) { source = structuredClone(request); workspace.refresh(); }, refreshLabels() { workspace.refreshLabels(); }, invalidate() { workspace.invalidate(); } };
  browserWindow.addEventListener('riverline:languagechange', () => { workspace.dispose(); workspace = mountAdvancedEquity({ root, getRequest: () => source, language, getPlayerLabel }); });
  Object.defineProperty(browserWindow, 'RiverlineAdvancedEquity', { configurable: true, value: bridge });
  browserWindow.addEventListener('riverline:equity-source', event => bridge.setSource(event.detail));
  const mode = browserWindow.document.getElementById('equityMode');
  if (mode && browserWindow.MutationObserver) {
    const observer = new browserWindow.MutationObserver(() => {
      if (mode.hidden || mode.style.display === 'none') workspace.invalidate();
    });
    observer.observe(mode, { attributes: true, attributeFilter: ['style', 'hidden'] });
    browserWindow.addEventListener('pagehide', () => { observer.disconnect(); workspace.dispose(); }, { once: true });
  }
  return bridge;
}
if (typeof window !== 'undefined') installAdvancedEquityWorkspace(window);
