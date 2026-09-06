import { importHandHistory } from './hand-history-import.mjs';
import { importDiagnosticLanguage } from './hand-import-language.mjs';
import { RIVERLINE_OWNED_DOMAINS } from '../account-identity/index.mjs';

// The generation covers typing, file reads, hashing, cancellation and owner changes.
export function createHandImportController({ captureScope, parse = importHandHistory, adopt } = {}) {
  let generation = 0, preview = null, scope = null;
  const reset = () => { generation++; preview = null; scope = null; };
  return Object.freeze({ reset,
    async preview(readText) {
      reset(); const current = generation;
      const captured = await captureScope();
      const assert = () => { captured?.assertCurrent(); if (current !== generation) throw new Error('stale_import'); };
      assert(); const text = await readText(); assert();
      const result = await parse(text); assert(); preview = result; scope = captured; return result;
    },
    open() {
      scope?.assertCurrent();
      if (!preview || preview.status !== 'complete') throw new Error('Import is not complete');
      return adopt(preview);
    },
    save(saveWithinScope) {
      scope?.assertCurrent();
      if (!preview || preview.status !== 'complete' || !scope) throw new Error('Import is not complete');
      adopt(preview);
      return saveWithinScope(scope);
    },
  });
}

export function installHandHistoryImport(browserWindow) {
  const document = browserWindow.document, trigger = document.getElementById('handImportButton');
  if (!trigger) return null;
  const t = key => browserWindow.t?.(key) ?? key;
  const dialog = document.createElement('dialog'); dialog.className = 'hand-import-dialog'; dialog.setAttribute('aria-labelledby', 'handImportTitle');
  const make = (tag, key, parent = dialog) => { const el = document.createElement(tag); if (key) { el.dataset.i18n = key; el.textContent = t(key); } parent.append(el); return el; };
  make('h2', 'Import hand history').id = 'handImportTitle';
  make('p', 'Paste one PokerStars English NLHE cash hand. Parsing stays on this device.');
  const label = make('label', 'Hand history'); label.htmlFor = 'handImportText';
  const input = make('textarea'); input.id = 'handImportText'; input.dir = 'ltr'; input.maxLength = 250000; input.rows = 12; input.spellcheck = false;
  const fileLabel = make('label', 'Import file'); fileLabel.htmlFor = 'handImportFile';
  const file = make('input'); file.id = 'handImportFile'; file.type = 'file'; file.accept = '.txt,text/plain';
  const status = make('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const preview = make('section'); preview.className = 'hand-import-preview';
  const actions = make('div'); actions.className = 'hand-import-actions';
  const button = (key, primary = false) => { const el = make('button', key, actions); el.type = 'button'; el.className = `ui-button ui-button--${primary ? 'primary' : 'secondary'}`; return el; };
  const inspect = button('Preview reconstruction'); const open = button('Open in Review', true); const save = button('Save hand'); const cancel = button('Cancel');
  open.disabled = save.disabled = true;
  let result = null;
  const controller = createHandImportController({
    captureScope: () => browserWindow.RiverlineAccountIdentity.captureLifecycleScope(RIVERLINE_OWNED_DOMAINS.SAVED_STUDY_OBJECTS),
    adopt(value) {
      const projection = browserWindow.RiverlinePlaybookState.openImportedHand({ pokerState: value.pokerState,
        heroPlayerId: value.heroPlayerId, replaySource: value.replaySource, importProvenance: value.importProvenance, title: t('Imported hand') });
      browserWindow.dispatchEvent(new browserWindow.CustomEvent('riverline:imported-hand-opened'));
      return projection;
    },
  });
  function clear() { controller.reset(); result = null; input.value = ''; file.value = ''; preview.replaceChildren(); status.textContent = ''; open.disabled = save.disabled = true; }
  function render() {
    preview.replaceChildren(); if (!result) return;
    make('strong', result.status === 'complete' ? 'Hand reconstructed' : 'Reconstruction unavailable', preview);
    if (result.parsed.table) {
      const game = make('p', null, preview); game.textContent = `NLHE · ${result.parsed.currency} · ${result.parsed.blinds?.small}/${result.parsed.blinds?.big} · ${result.parsed.players.length} ${t('Players')}`;
      const roster = make('ul', null, preview);
      for (const player of result.parsed.players) { const row = make('li', null, roster); row.textContent = `${t('Seat')} ${player.seat} · ${player.name} · ${player.stack}`; row.dir = 'auto'; }
    }
    for (const diagnostic of result.diagnostics) {
      const facts = importDiagnosticLanguage(diagnostic), p = make('p', null, preview);
      p.textContent = `${facts.line ? `${t('Line')} ${facts.line}: ` : ''}${t(facts.messageKey)}`;
    }
    if (result.status === 'complete') {
      const settlement = result.pokerState.recordedSettlement;
      const p = make('p', null, preview); p.textContent = `${t('Gross pot')}: ${settlement.grossPotMilliBb / 1000} bb · ${t('Recorded rake')}: ${settlement.rakeMilliBb / 1000} bb · ${t('Awarded')}: ${settlement.netAwardedMilliBb / 1000} bb`;
    }
    const details = make('details', null, preview); make('summary', 'Inspect import details', details);
    make('p', 'Raises are interpreted as the total committed on this street, as defined by this format.', details);
    make('p', 'Raw hand-history text is not stored with Saved Hands.', details);
    const body = make('pre', null, details); body.dir = 'ltr'; body.textContent = JSON.stringify(result.importProvenance, null, 2);
  }
  async function run(read) {
    open.disabled = save.disabled = true; status.textContent = t('Reconstructing hand…');
    try { result = await controller.preview(read); render(); status.textContent = ''; open.disabled = save.disabled = result.status !== 'complete'; }
    catch (error) { if (error.message !== 'stale_import' && dialog.open) status.textContent = t(error.message === 'input_size' ? 'Paste one hand history of at most 250,000 characters.' : 'The import was cancelled or is unavailable. Try again.'); }
  }
  trigger.addEventListener('click', () => { clear(); dialog.showModal(); input.focus(); });
  input.addEventListener('input', () => { controller.reset(); result = null; preview.replaceChildren(); open.disabled = save.disabled = true; });
  inspect.addEventListener('click', () => { const text = input.value; void run(() => text); });
  file.addEventListener('change', () => {
    const selected = file.files?.[0]; if (!selected) return;
    void run(async () => { if (selected.size > 250000) throw new Error('input_size'); const text = await selected.text(); return text; });
  });
  open.addEventListener('click', () => { try { controller.open(); dialog.close(); } catch { status.textContent = t('The import was cancelled or is unavailable. Try again.'); } });
  save.addEventListener('click', async () => {
    save.disabled = open.disabled = true;
    try {
      await controller.save(scope => browserWindow.RiverlineSavedStudyObjects.saveCurrentForScope({ mode: 'hand' }, scope));
      dialog.close();
    } catch {
      if (dialog.open) { status.textContent = t('The import was cancelled or is unavailable. Try again.'); save.disabled = open.disabled = result?.status !== 'complete'; }
    }
  });
  cancel.addEventListener('click', () => dialog.close()); dialog.addEventListener('close', clear);
  browserWindow.addEventListener('riverline:identitychange', () => { clear(); if (dialog.open) dialog.close(); });
  new browserWindow.MutationObserver(() => { for (const el of dialog.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  document.body.append(dialog); return controller;
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installHandHistoryImport(window), { once: true });
  else installHandHistoryImport(window);
}
