import { createEquityController } from './equity-controller.mjs';
import { asWeightedEquityRequest, groupRunouts } from './runout-explorer.mjs';
import { parseExplicitEquityRange, weightedRangePlayer } from './weighted-equity-consumers.mjs';
import { advancedEquityCopy as copy, weightedEquityLanguage } from './advanced-equity-language.mjs';

export function mountAdvancedEquity({ root, getRequest, language = () => 'en', signal = null,
  controller = createEquityController(), forcedRangeIds = [], rangeSourceRole = 'user_supplied',
  rangeSourceId = 'explicit-user-range', hypothesis = null }) {
  const doc = root.ownerDocument, lifecycle = new AbortController();
  let inputLife = new AbortController(), cardLife = new AbortController();
  let generation = 0, rows = [], sourceKey = null, draftRequest = null, runoutAvailable = false;
  const drafts = new Map();
  const t = key => copy(key, language());
  function el(tag, text, className) {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function listen(node, event, callback, eventSignal = lifecycle.signal) { node.addEventListener(event, callback, { signal: eventSignal }); }
  const panel = el('details', undefined, 'advanced-equity'), summary = el('summary', t('title'));
  const body = el('div', undefined, 'advanced-equity-body'), inputs = el('div', undefined, 'advanced-equity-inputs');
  const intro = el('p', t('intro')), tutorial = el('p', t('tutorial'), 'muted');
  if (hypothesis) intro.textContent = hypothesis;
  const status = el('p'); status.role = 'status';
  const output = el('div', undefined, 'advanced-equity-output');
  const run = el('button', t('calculate'), 'ui-button'), cancel = el('button', t('cancel'), 'ui-button');
  run.type = cancel.type = 'button';
  const controls = el('div', undefined, 'advanced-equity-controls');
  const partialLabel = el('label'), partial = el('input'); partial.type = 'checkbox';
  partialLabel.append(partial, el('span', t('conditional')));
  const seedLabel = el('label', t('seed')), seed = el('input');
  seed.type = 'number'; seed.min = '0'; seed.max = '4294967295'; seed.step = '1'; seed.value = '1'; seedLabel.append(seed);
  controls.append(run, cancel, seedLabel);
  const explorer = el('details'), explorerTitle = el('summary', t('explorer'));
  const pathsLabel = el('label', t('paths')), paths = el('input'); paths.dir = 'ltr'; pathsLabel.append(paths);
  const all = el('button', t('all'), 'ui-button'), selected = el('button', t('selected'), 'ui-button');
  all.type = selected.type = 'button';
  const group = el('select'), groupLabel = el('label', t('group'));
  for (const value of ['rank', 'suit', 'category']) { const option = el('option', t(value)); option.value = value; group.append(option); }
  groupLabel.append(group);
  const cardsOutput = el('div'), preview = el('div', undefined, 'advanced-equity-preview');
  preview.ariaLive = 'polite';
  explorer.append(explorerTitle, el('p', t('streets')), el('p', t('nextNote')), pathsLabel, selected, all, groupLabel, cardsOutput, preview);
  body.append(intro, tutorial, inputs, partialLabel, controls, status, output, explorer);
  panel.append(summary, body); root.replaceChildren(panel); root.dir = language() === 'he' ? 'rtl' : 'ltr';
  function invalidate() {
    generation++; controller.cancel(); rows = []; draftRequest = null;
    cardLife.abort(); cardLife = new AbortController();
    output.replaceChildren(); cardsOutput.replaceChildren(); preview.replaceChildren();
    run.disabled = false; all.disabled = selected.disabled = !runoutAvailable; status.textContent = '';
  }
  function refresh() {
    if (!panel.open) { invalidate(); sourceKey = null; return; }
    const source = getRequest(), key = JSON.stringify(source);
    if (sourceKey === key) return;
    sourceKey = key; runoutAvailable = [3, 4].includes(source?.board?.length);
    invalidate(); drafts.clear(); inputs.replaceChildren();
    inputLife.abort(); inputLife = new AbortController();
    if (!source) { status.textContent = t('empty'); return; }
    seed.value = String(source.seed ?? 1);
    for (const player of source.players) {
      const field = el('fieldset'), legend = el('legend', player.id); field.append(legend);
      field.append(el('p', forcedRangeIds.includes(player.id) ? t('range') : player.kind === 'uniform_unknown' || player.cards === null ? t('uniform') : player.cards?.join(' ') ?? ''));
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
      const textLabel = el('label', t('syntax')); textLabel.append(text);
      const missing = el('select');
      for (const [value, key] of [['unknown', 'unknown'], ['known_zero', 'zero']]) { const option = el('option', t(key)); option.value = value; missing.append(option); }
      missing.value = 'unknown';
      const missingLabel = el('label', t('unlisted')); missingLabel.append(missing);
      textLabel.hidden = missingLabel.hidden = mode.value !== 'range';
      listen(mode, 'change', () => { textLabel.hidden = missingLabel.hidden = mode.value !== 'range'; invalidate(); }, inputLife.signal);
      listen(text, 'input', invalidate, inputLife.signal); listen(missing, 'change', invalidate, inputLife.signal);
      drafts.set(player.id, { mode, text, missing }); field.append(modeLabel, textLabel, missingLabel); inputs.append(field);
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
    if (!result.players?.length) status.textContent = t('error');
    else {
      const languageFacts = weightedEquityLanguage(result, language());
      for (const line of languageFacts.lines) output.append(el('p', line));
      for (const player of result.players) output.append(el('p', `${player.id} · Equity ${(player.equity * 100).toFixed(2)}%`, 'advanced-equity-value'));
    }
    const details = el('details'); details.append(el('summary', t('evidence')));
    const standing = result.presentation?.currentStanding;
    if (standing) details.append(el('p', `${t('standing')}: ${[standing.ahead, standing.tied, standing.behind].map(value => `${(value * 100).toFixed(1)}%`).join(' / ')}`));
    for (const coverage of result.coverage ?? []) {
      details.append(el('p', `${coverage.playerId} · ${t('coverage')}: ${coverage.knownCombos} / ${coverage.eligibleCombos}`),
        el('p', `${t('mass')}: ${coverage.knownMass.toFixed(3)} / [${coverage.unknownMassBounds.join(', ')}] / ${coverage.blockedKnownMass.toFixed(3)}`));
    }
    details.append(el('pre', JSON.stringify({ status: result.status, reason: result.reason ?? result.error?.code, method: result.method, metadata: result.metadata, coverage: result.coverage }, null, 2)));
    output.append(details);
  }
  function inspect(row) {
    preview.replaceChildren(el('p', t('hypothetical')));
    const hero = draftRequest.players[0], hand = row.resultingHand;
    if (hand) {
      const cards = el('div', undefined, 'advanced-equity-cards'); cards.dir = 'ltr';
      for (const card of [...hero.cards, ...draftRequest.board, ...row.cards]) {
        const selectedCard = hand.bestFiveCards.includes(card);
        const token = el(selectedCard ? 'strong' : 'span', card, selectedCard ? 'advanced-mini-card' : 'advanced-mini-card unused');
        cards.append(token);
      }
      preview.append(cards, el('p', `${t(hand.category)} · ${hand.tiebreakers.join(' / ')}`));
    }
    if (row.categoryImproved) preview.append(el('p', t('improved')));
    if (row.enteredStanding) preview.append(el('p', t(row.enteredStanding)));
    if (row.deltaEstimated) preview.append(el('p', t('noise')));
    const detail = el('details'); detail.append(el('summary', t('evidence')), el('pre', JSON.stringify({ standing: row.standing, completion: row.completion, removal: row.removal }, null, 2))); preview.append(detail);
  }
  function renderCards() {
    cardLife.abort(); cardLife = new AbortController();
    cardsOutput.replaceChildren();
    for (const bucket of groupRunouts(rows, group.value)) {
      const section = el('section'), list = el('div', undefined, 'advanced-equity-cards');
      section.append(el('h4', group.value === 'category' ? t(bucket.key) : bucket.key));
      for (const row of bucket.rows) {
        const button = el('button', `${row.cards.join(' → ')} · ${row.equity === null ? '—' : `${(row.equity * 100).toFixed(1)}% (${row.deltaEstimated ? '≈' : ''}${(row.equityDelta * 100).toFixed(1)} ${t('deltaUnit')})`}`, 'ui-button');
        button.type = 'button'; button.dir = 'ltr';
        listen(button, 'focus', () => inspect(row), cardLife.signal); listen(button, 'mouseenter', () => inspect(row), cardLife.signal); listen(button, 'click', () => inspect(row), cardLife.signal); list.append(button);
      }
      section.append(list); cardsOutput.append(section);
    }
  }
  async function calculate(runouts = false, every = false) {
    invalidate(); const token = generation;
    try {
      const input = request(); draftRequest = input;
      run.disabled = all.disabled = selected.disabled = true; status.textContent = t('running');
      const sequences = every ? null : paths.value.split(';').map(path => path.trim().split(/\s+/)).filter(path => path[0]);
      const result = await controller.calculate(runouts ? { schemaVersion: 'runout-request/v1', request: input,
        options: { sequences, samples: 500 } } : input, { onProgress(progress) {
        if (token === generation) status.textContent = `${t('running')} ${progress.completed} / ${progress.total}`;
      } });
      if (token !== generation || lifecycle.signal.aborted) return;
      status.textContent = '';
      if (runouts && result.rows) { showResult(result.baseline); rows = result.rows; renderCards(); }
      else showResult(result);
    } catch { if (token === generation) status.textContent = t('error'); }
    finally { if (token === generation) { run.disabled = false; all.disabled = selected.disabled = !runoutAvailable; } }
  }
  listen(panel, 'toggle', () => { if (panel.open) refresh(); else invalidate(); });
  listen(run, 'click', () => calculate()); listen(all, 'click', () => calculate(true, true));
  listen(selected, 'click', () => calculate(true)); listen(cancel, 'click', invalidate);
  listen(partial, 'change', invalidate); listen(seed, 'input', invalidate); listen(paths, 'input', invalidate);
  listen(group, 'change', renderCards);
  const dispose = () => { invalidate(); lifecycle.abort(); inputLife.abort(); cardLife.abort(); controller.dispose(); root.replaceChildren(); };
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose(); else refresh();
  return { invalidate, refresh, dispose };
}

export function installAdvancedEquityWorkspace(browserWindow) {
  const root = browserWindow.document.getElementById('advancedEquityWorkspace');
  if (!root) return null;
  let source = browserWindow.equityRequestFromCurrentInputs?.() ?? null;
  const language = () => browserWindow.document.documentElement.lang.split('-')[0] || 'en';
  let workspace = mountAdvancedEquity({ root, getRequest: () => source, language });
  const bridge = { setSource(request) { source = structuredClone(request); workspace.refresh(); }, invalidate() { workspace.invalidate(); } };
  browserWindow.addEventListener('riverline:languagechange', () => { workspace.dispose(); workspace = mountAdvancedEquity({ root, getRequest: () => source, language }); });
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
