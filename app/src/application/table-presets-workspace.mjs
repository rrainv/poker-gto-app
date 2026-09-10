import { createTablePresetRepository, tablePresetConfiguration } from './table-presets.mjs';

export function mountTablePresets({ readDraft, loadDraft, isLocked, window: win = globalThis.window }) {
  const doc = win?.document, root = doc?.querySelector('#handTablePresets');
  if (!root) return;
  const t = (key, values) => win.t?.(key, values) ?? key;
  const select = root.querySelector('select'), name = root.querySelector('input'), status = root.querySelector('[role="status"]');
  let repository = null, activeId = null, owner = null;
  function render() {
    const state = win.RiverlineAccountIdentity?.getLifecycleState();
    const nextOwner = ['guest_active', 'account_active'].includes(state?.status) ? state.identityId : null;
    if (nextOwner !== owner) { owner = nextOwner; activeId = null; name.value = ''; status.textContent = ''; repository = null; repository = owner ? createTablePresetRepository({ storage: win.localStorage, ownerId: owner }) : null; }
    const items = repository?.list() ?? [];
    const active = items.find(item => item.id === activeId);
    let modified = false;
    try { modified = !!active && JSON.stringify(tablePresetConfiguration(readDraft())) !== JSON.stringify(active.configuration); } catch { modified = !!active; }
    select.replaceChildren(new Option(t('Unsaved setup'), ''));
    for (const item of items) { const option = new Option(`${item.name}${item.id === activeId && modified ? ` (${t('Modified')})` : ''}`, item.id); option.disabled = !item.available; select.append(option); }
    select.value = activeId ?? '';
    for (const control of root.querySelectorAll('input, select, button')) control.disabled = !repository || isLocked();
    for (const control of root.querySelectorAll('[data-preset-existing]')) control.disabled ||= !active;
  }
  function safely(work) { try { work(); render(); } catch { status.textContent = t('Could not save or load this preset. Check the name and setup.'); } }
  select.addEventListener('change', () => safely(() => {
    if (isLocked()) return;
    activeId = select.value || null;
    const item = repository.list().find(item => item.id === activeId);
    if (item?.available) { loadDraft(item.configuration); name.value = item.name; }
    status.textContent = '';
  }));
  root.addEventListener('click', event => {
    const action = event.target.closest('[data-preset-action]')?.dataset.presetAction;
    if (!action || isLocked()) return;
    safely(() => {
      const active = repository.list().find(item => item.id === activeId);
      if (action === 'delete') { repository.remove(activeId); activeId = null; }
      else {
        const item = repository.save({ id: ['update', 'rename'].includes(action) ? activeId : null,
          name: action === 'duplicate' ? `${active.name.slice(0, 50)} (${t('Copy')})` : name.value,
          configuration: ['rename', 'duplicate'].includes(action) ? active.configuration : readDraft() });
        activeId = item.id; name.value = item.name;
      }
      status.textContent = t(action === 'delete' ? 'Preset deleted. Current setup kept.' : 'Table preset saved on this device.');
      select.focus();
    });
  });
  doc.querySelector('#handSetupSection')?.addEventListener('input', event => { if (!root.contains(event.target)) safely(() => {}); });
  win.addEventListener('riverline:playbook-state-change', () => safely(() => {}));
  win.addEventListener('riverline:languagechange', () => safely(() => {}));
  win.RiverlineAccountIdentity?.subscribe(() => safely(() => {}));
  win.RiverlineAccountIdentity?.initialize().then(() => safely(() => {}));
  safely(() => {});
}
