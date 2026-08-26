import {
  HOME_GAME_SESSION_STATUS,
  HOME_GAME_TRANSACTION_TYPES,
  formatMinorUnits,
  parseMoneyToMinorUnits,
} from '../home-game/index.mjs';
import './authentication-bootstrap.mjs';
import { createHomeGameApplication } from './home-game-service.mjs';

function translate(browserWindow, key, parameters = {}) {
  return typeof browserWindow.t === 'function' ? browserWindow.t(key, parameters) : key;
}

function element(document, tag, className = null, text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

function playerName(state, playerId) {
  return state.players.find((entry) => entry.playerId === playerId)?.displayName || playerId;
}

function latestChipCount(bundle, playerId) {
  const snapshots = bundle.snapshots.filter((entry) => entry.playerId === playerId);
  return snapshots.at(-1)?.chipCount ?? null;
}

export function installHomeGameBridge(browserWindow = window, { application = null } = {}) {
  const app = application || createHomeGameApplication({
    authQueries: browserWindow.RiverlineAuthentication,
    identityQueries: browserWindow.RiverlineAccountIdentity,
  });
  const bridge = Object.freeze({
    load: () => app.load(),
    createSession: (values) => app.createSession(values),
    createSessionFromGroup: (values) => app.createSessionFromGroup(values),
    openSession: (sessionId) => app.openSession(sessionId),
    addTransaction: (values) => app.addTransaction(values),
    cashOut: (values) => app.cashOut(values),
    correctTransaction: (values) => app.correctTransaction(values),
    recordChipCount: (values) => app.recordChipCount(values),
    completeSession: (sessionId) => app.completeSession(sessionId),
    reopenSession: (sessionId) => app.reopenSession(sessionId),
    createPlayer: (values) => app.createPlayer(values),
    updatePlayer: (playerId, values) => app.updatePlayer(playerId, values),
    setPlayerArchived: (playerId, archived) => app.setPlayerArchived(playerId, archived),
    createGroup: (values) => app.createGroup(values),
    updateGroup: (groupId, values) => app.updateGroup(groupId, values),
    setGroupArchived: (groupId, archived) => app.setGroupArchived(groupId, archived),
    setSessionArchived: (sessionId, archived) => app.setSessionArchived(sessionId, archived),
    exportSession: (sessionId) => app.exportSession(sessionId),
  });
  Object.defineProperty(browserWindow, 'RiverlineHomeGame', {
    configurable: true,
    enumerable: false,
    value: bridge,
    writable: false,
  });
  return bridge;
}

export function installHomeGameWorkspace(browserWindow = window, bridge = browserWindow.RiverlineHomeGame) {
  const document = browserWindow.document;
  const root = document?.getElementById('homeGameWorkspace');
  if (!root || !bridge) return null;
  const refs = {
    root,
    persistence: document.getElementById('homeGamePersistence'),
    notice: document.getElementById('homeGamePersistenceNotice'),
    error: document.getElementById('homeGameError'),
    form: document.getElementById('homeGameNewSessionForm'),
    createButton: document.getElementById('homeGameCreateButton'),
    title: document.getElementById('homeGameSessionTitle'),
    currency: document.getElementById('homeGameCurrency'),
    accountRoster: document.getElementById('homeGameAccountRoster'),
    guestRoster: document.getElementById('homeGameGuestRoster'),
    rosterGroup: document.getElementById('homeGameRosterGroup'),
    rosterPlayer: document.getElementById('homeGameRosterPlayer'),
    rosterAddSaved: document.getElementById('homeGameRosterAddSaved'),
    rosterNewName: document.getElementById('homeGameRosterNewName'),
    rosterAddNew: document.getElementById('homeGameRosterAddNew'),
    roster: document.getElementById('homeGameRoster'),
    playerNames: document.getElementById('homeGamePlayerNames'),
    smallBlind: document.getElementById('homeGameSmallBlind'),
    bigBlind: document.getElementById('homeGameBigBlind'),
    ante: document.getElementById('homeGameAnte'),
    buyIn: document.getElementById('homeGameInitialBuyIn'),
    saveGroup: document.getElementById('homeGameSaveGroup'),
    groupName: document.getElementById('homeGameGroupName'),
    groups: document.getElementById('homeGameGroups'),
    showArchivedGroups: document.getElementById('homeGameShowArchivedGroups'),
    newGroup: document.getElementById('homeGameNewGroup'),
    recent: document.getElementById('homeGameRecent'),
    showArchivedSessions: document.getElementById('homeGameShowArchivedSessions'),
    players: document.getElementById('homeGamePlayers'),
    playerSearch: document.getElementById('homeGamePlayerSearch'),
    showArchivedPlayers: document.getElementById('homeGameShowArchivedPlayers'),
    newPlayer: document.getElementById('homeGameNewPlayer'),
    session: document.getElementById('homeGameSession'),
    editorDialog: document.getElementById('homeGameEditorDialog'),
    editorForm: document.getElementById('homeGameEditorForm'),
    editorTitle: document.getElementById('homeGameEditorTitle'),
    editorBody: document.getElementById('homeGameEditorBody'),
    editorSubmit: document.getElementById('homeGameEditorSubmit'),
    confirmDialog: document.getElementById('homeGameConfirmDialog'),
    confirmTitle: document.getElementById('homeGameConfirmTitle'),
    confirmMessage: document.getElementById('homeGameConfirmMessage'),
    confirmSubmit: document.getElementById('homeGameConfirmSubmit'),
  };
  let state = null;
  let busy = false;
  let draftRoster = [];
  let draftSourceGroupId = null;
  let editorOperation = null;

  function setError(error = null) {
    refs.error.hidden = !error;
    if (!error) refs.error.textContent = '';
    else if (error.code === 'unbalanced_session' && state?.current) {
      refs.error.textContent = translate(browserWindow, 'Session is off by {amount}', {
        amount: money(Math.abs(error.balanceMinor), state.current.session.currency),
      });
    } else refs.error.textContent = error.message || translate(browserWindow, 'Home Game action failed.');
  }

  function setBusy(value) {
    busy = value;
    refs.root.setAttribute('aria-busy', String(value));
    refs.root.querySelectorAll('button, input, select, textarea').forEach((control) => {
      if (value) control.setAttribute('data-home-game-was-disabled', String(control.disabled));
      if (value) control.disabled = true;
      else if (control.getAttribute('data-home-game-was-disabled') === 'false') control.disabled = false;
      if (!value) control.removeAttribute('data-home-game-was-disabled');
    });
  }

  async function perform(operation) {
    if (busy) return;
    setError();
    setBusy(true);
    try {
      state = await operation();
      render();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
      if (state) render();
    }
  }

  function translatedLabel(key, forId, value = '') {
    const label = element(document, 'label', 'ui-field');
    label.htmlFor = forId;
    label.append(element(document, 'span', null, translate(browserWindow, key)));
    const input = element(document, 'input', 'control-input');
    input.id = forId;
    input.name = forId;
    input.type = 'text';
    input.value = value || '';
    label.append(input);
    return { label, input };
  }

  function openEditor(title, body, operation, submitLabel = 'Save') {
    refs.editorTitle.textContent = translate(browserWindow, title);
    refs.editorBody.replaceChildren(body);
    refs.editorSubmit.textContent = translate(browserWindow, submitLabel);
    editorOperation = operation;
    refs.editorDialog.showModal();
    refs.editorBody.querySelector('input, textarea, select, button')?.focus();
  }

  function confirmAction({ title, message, confirmLabel = 'Confirm' }) {
    refs.confirmTitle.textContent = translate(browserWindow, title);
    refs.confirmMessage.textContent = message;
    refs.confirmSubmit.textContent = translate(browserWindow, confirmLabel);
    refs.confirmDialog.showModal();
    return new Promise((resolve) => {
      refs.confirmDialog.addEventListener('close', () => resolve(refs.confirmDialog.returnValue === 'confirm'), { once: true });
    });
  }

  function timestamp(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(browserWindow.document.documentElement.lang || 'en', {
      dateStyle: 'medium', timeStyle: 'short',
    }).format(new Date(value));
  }

  function transactionType(type) {
    return translate(browserWindow, ({ buy_in: 'Buy-in', rebuy: 'Rebuy', add_on: 'Add-on', cash_out: 'Cash out', correction: 'Correction' })[type] || type);
  }

  function parseOptionalMoney(input, minorUnit = 2) {
    const value = input.value.trim();
    return value === '' ? 0 : parseMoneyToMinorUnits(value, minorUnit);
  }

  function money(amountMinor, currency = state.current?.session.currency) {
    return `${formatMinorUnits(amountMinor, currency)} ${currency.label}`;
  }

  function resultText(amountMinor, currency) {
    if (amountMinor > 0) return translate(browserWindow, 'Receives {amount}', { amount: money(amountMinor, currency) });
    if (amountMinor < 0) return translate(browserWindow, 'Owes {amount}', { amount: money(-amountMinor, currency) });
    return translate(browserWindow, 'Even');
  }

  function renderRoster() {
    refs.roster.replaceChildren();
    if (!draftRoster.length) refs.roster.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'Add at least two players.')));
    draftRoster.forEach((player, index) => {
      const row = element(document, 'div', 'home-game-roster-row');
      row.setAttribute('role', 'listitem');
      const copy = element(document, 'span');
      copy.append(element(document, 'strong', null, player.displayName));
      copy.append(element(document, 'small', null, translate(browserWindow, 'Seat {seat}', { seat: index + 1 })));
      const actions = element(document, 'span', 'home-game-row-actions');
      for (const [label, delta] of [['Move up', -1], ['Move down', 1]]) {
        const button = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, label));
        button.type = 'button';
        button.disabled = index + delta < 0 || index + delta >= draftRoster.length;
        button.addEventListener('click', () => {
          const next = [...draftRoster];
          [next[index], next[index + delta]] = [next[index + delta], next[index]];
          draftRoster = next;
          renderRoster();
          renderRosterChoices();
        });
        actions.append(button);
      }
      const remove = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Remove'));
      remove.type = 'button';
      remove.addEventListener('click', () => { draftRoster = draftRoster.filter((entry) => entry.key !== player.key); renderRoster(); renderRosterChoices(); });
      actions.append(remove);
      row.append(copy, actions);
      refs.roster.append(row);
    });
  }

  function renderRosterChoices() {
    refs.rosterGroup.replaceChildren();
    const blankGroup = element(document, 'option', null, translate(browserWindow, 'Choose a group'));
    blankGroup.value = '';
    refs.rosterGroup.append(blankGroup);
    state.groups.forEach((group) => {
      const option = element(document, 'option', null, group.name);
      option.value = group.groupId;
      refs.rosterGroup.append(option);
    });
    refs.rosterPlayer.replaceChildren();
    const selectedIds = new Set(draftRoster.map((entry) => entry.playerId).filter(Boolean));
    state.availablePlayers.filter((player) => !selectedIds.has(player.playerId)).forEach((player) => {
      const option = element(document, 'option', null, player.nickname ? `${player.displayName} (${player.nickname})` : player.displayName);
      option.value = player.playerId;
      refs.rosterPlayer.append(option);
    });
    refs.rosterAddSaved.disabled = !refs.rosterPlayer.options.length;
  }

  function useGroupRoster(group) {
    draftSourceGroupId = group.groupId;
    draftRoster = group.playerIds.map((playerId) => {
      const player = state.players.find((entry) => entry.playerId === playerId);
      return { key: playerId, playerId, displayName: player?.displayName || playerId, archived: player?.archived || false };
    });
    refs.title.value = group.name;
    renderRoster();
    renderRosterChoices();
    refs.form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    refs.title.focus();
  }

  function openPlayerEditor(player = null) {
    const body = element(document, 'div', 'home-game-editor-fields');
    const name = translatedLabel('Display name', 'homeGameEditPlayerName', player?.displayName);
    name.input.required = true;
    name.input.maxLength = 80;
    const nickname = translatedLabel('Nickname', 'homeGameEditPlayerNickname', player?.nickname);
    nickname.input.maxLength = 80;
    const notes = element(document, 'label', 'ui-field');
    notes.htmlFor = 'homeGameEditPlayerNotes';
    notes.append(element(document, 'span', null, translate(browserWindow, 'Notes')));
    const textarea = element(document, 'textarea', 'control-input');
    textarea.id = 'homeGameEditPlayerNotes';
    textarea.maxLength = 500;
    textarea.rows = 4;
    textarea.value = player?.notes || '';
    notes.append(textarea);
    body.append(name.label, nickname.label, notes);
    openEditor(player ? 'Edit player' : 'New player', body, () => (
      player
        ? bridge.updatePlayer(player.playerId, { displayName: name.input.value, nickname: nickname.input.value, notes: textarea.value })
        : bridge.createPlayer({ displayName: name.input.value, nickname: nickname.input.value, notes: textarea.value })
    ));
  }

  function openGroupEditor(group = null) {
    const body = element(document, 'div', 'home-game-editor-fields');
    const name = translatedLabel('Group name', 'homeGameEditGroupName', group?.name);
    name.input.required = true;
    name.input.maxLength = 100;
    const roster = [...(group?.playerIds || [])];
    const list = element(document, 'div', 'home-game-roster');
    const addRow = element(document, 'div', 'home-game-inline-field');
    const select = element(document, 'select', 'control-select');
    select.setAttribute('aria-label', translate(browserWindow, 'Add saved player'));
    const add = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Add'));
    add.type = 'button';
    function paint() {
      list.replaceChildren();
      roster.forEach((playerId, index) => {
        const player = state.players.find((entry) => entry.playerId === playerId);
        const row = element(document, 'div', 'home-game-roster-row');
        row.append(element(document, 'span', null, `${index + 1}. ${player?.displayName || playerId}${player?.archived ? ` · ${translate(browserWindow, 'Archived')}` : ''}`));
        const actions = element(document, 'span', 'home-game-row-actions');
        for (const [label, delta] of [['Move up', -1], ['Move down', 1]]) {
          const button = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, label));
          button.type = 'button';
          button.disabled = index + delta < 0 || index + delta >= roster.length;
          button.addEventListener('click', () => { [roster[index], roster[index + delta]] = [roster[index + delta], roster[index]]; paint(); });
          actions.append(button);
        }
        const remove = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Remove'));
        remove.type = 'button';
        remove.addEventListener('click', () => { roster.splice(index, 1); paint(); });
        actions.append(remove);
        row.append(actions);
        list.append(row);
      });
      select.replaceChildren();
      state.availablePlayers.filter((entry) => !roster.includes(entry.playerId)).forEach((entry) => {
        const option = element(document, 'option', null, entry.displayName);
        option.value = entry.playerId;
        select.append(option);
      });
      add.disabled = !select.options.length;
    }
    add.addEventListener('click', () => { if (select.value) roster.push(select.value); paint(); });
    addRow.append(select, add);
    body.append(name.label, addRow, list);
    paint();
    openEditor(group ? 'Edit group' : 'New group', body, () => {
      if (roster.length < 2) throw new RangeError(translate(browserWindow, 'Add at least two players.'));
      return group ? bridge.updateGroup(group.groupId, { name: name.input.value, playerIds: roster }) : bridge.createGroup({ name: name.input.value, playerIds: roster });
    });
  }

  function renderPlayers() {
    refs.players.replaceChildren();
    if (state.persistence === 'guest_memory') return;
    const query = refs.playerSearch.value.trim().toLocaleLowerCase();
    const players = state.players.filter((player) => (refs.showArchivedPlayers.checked || !player.archived)
      && (!query || `${player.displayName} ${player.nickname || ''} ${player.notes || ''}`.toLocaleLowerCase().includes(query)));
    if (!players.length) refs.players.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'No matching players.')));
    players.forEach((player) => {
      const card = element(document, 'article', 'home-game-list-card');
      const copy = element(document, 'div');
      copy.append(element(document, 'strong', null, player.displayName));
      copy.append(element(document, 'small', null, player.archived ? translate(browserWindow, 'Archived') : (player.nickname || translate(browserWindow, 'Available'))));
      const actions = element(document, 'span', 'home-game-row-actions');
      const edit = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Edit'));
      edit.type = 'button';
      edit.addEventListener('click', () => openPlayerEditor(player));
      const archive = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, player.archived ? 'Restore' : 'Archive'));
      archive.type = 'button';
      archive.addEventListener('click', async () => {
        if (!player.archived && !await confirmAction({ title: 'Archive player?', message: translate(browserWindow, 'Archive {name}? Existing sessions and groups keep this player reference.', { name: player.displayName }), confirmLabel: 'Archive' })) return;
        perform(() => bridge.setPlayerArchived(player.playerId, !player.archived));
      });
      actions.append(edit, archive);
      card.append(copy, actions);
      refs.players.append(card);
    });
  }

  function renderGroups() {
    refs.groups.replaceChildren();
    if (state.persistence === 'guest_memory') {
      refs.groups.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'Guest games have no durable player or group library.')));
      return;
    }
    const groups = refs.showArchivedGroups.checked ? [...state.groups, ...state.archivedGroups] : state.groups;
    if (!groups.length) refs.groups.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'No saved groups yet.')));
    for (const group of groups) {
      const card = element(document, 'article', 'home-game-list-card');
      const copy = element(document, 'div');
      copy.append(element(document, 'strong', null, group.name));
      copy.append(element(document, 'small', null, group.archived ? translate(browserWindow, 'Archived') : translate(browserWindow, '{count} players', { count: group.playerIds.length })));
      const actions = element(document, 'span', 'home-game-row-actions');
      if (!group.archived) {
        const use = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Use roster'));
        use.type = 'button';
        use.addEventListener('click', () => useGroupRoster(group));
        const edit = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Edit'));
        edit.type = 'button';
        edit.addEventListener('click', () => openGroupEditor(group));
        actions.append(use, edit);
      }
      const archive = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, group.archived ? 'Restore' : 'Archive'));
      archive.type = 'button';
      archive.addEventListener('click', async () => {
        if (!group.archived && !await confirmAction({ title: 'Archive group?', message: translate(browserWindow, 'Archive {name}? Existing sessions keep their source reference.', { name: group.name }), confirmLabel: 'Archive' })) return;
        perform(() => bridge.setGroupArchived(group.groupId, !group.archived));
      });
      actions.append(archive);
      card.append(copy, actions);
      refs.groups.append(card);
    }
  }

  function renderRecent() {
    refs.recent.replaceChildren();
    const sessions = refs.showArchivedSessions.checked
      ? [...state.recentSessions, ...state.archivedSessions]
      : state.recentSessions;
    if (!sessions.length) {
      refs.recent.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'No sessions yet.')));
      return;
    }
    for (const session of sessions) {
      const action = element(document, 'article', 'home-game-recent-button');
      const copy = element(document, 'span');
      copy.append(element(document, 'strong', null, session.title));
      copy.append(element(document, 'small', null, translate(browserWindow, session.archived ? 'Archived session' : session.status === 'completed' ? 'Session complete' : session.status === 'active' ? 'Active session' : 'Draft session')));
      const controls = element(document, 'span', 'home-game-row-actions');
      const open = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Open'));
      open.type = 'button';
      open.addEventListener('click', () => perform(() => bridge.openSession(session.sessionId)));
      controls.append(element(document, 'span', 'status-badge', session.currency.code), open);
      if (session.archived) {
        const restore = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Restore'));
        restore.type = 'button';
        restore.addEventListener('click', () => perform(() => bridge.setSessionArchived(session.sessionId, false)));
        controls.append(restore);
      }
      action.append(copy, controls);
      refs.recent.append(action);
    }
  }

  function addAmountAction(container, { label, type, participant, session, allowZero = false, handler }) {
    const field = element(document, 'label', 'home-game-amount-field');
    field.append(element(document, 'span', null, translate(browserWindow, label)));
    const input = element(document, 'input', 'control-input');
    input.type = 'number';
    input.min = '0';
    input.step = session.currency.minorUnit === 0 ? '1' : `0.${'0'.repeat(session.currency.minorUnit - 1)}1`;
    input.inputMode = 'decimal';
    input.setAttribute('aria-label', `${translate(browserWindow, label)} — ${playerName(state, participant.playerId)}`);
    const button = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, label));
    button.type = 'button';
    button.addEventListener('click', () => {
      let amountMinor;
      try {
        amountMinor = parseMoneyToMinorUnits(input.value || '0', session.currency.minorUnit);
        if (amountMinor < (allowZero ? 0 : 1)) throw new RangeError(translate(browserWindow, 'Enter a valid amount.'));
      } catch (error) {
        setError(error);
        input.focus();
        return;
      }
      perform(() => handler({ sessionId: session.sessionId, playerId: participant.playerId, type, amountMinor }));
    });
    field.append(input, button);
    container.append(field);
  }

  function renderParticipant(participant, bundle) {
    const result = bundle.accounting.participantResults.find((entry) => entry.playerId === participant.playerId);
    const card = element(document, 'article', 'home-game-player-card');
    card.dataset.result = result.netMinor > 0 ? 'positive' : result.netMinor < 0 ? 'negative' : 'even';
    const heading = element(document, 'header');
    const title = element(document, 'div');
    title.append(element(document, 'span', 'home-game-seat', translate(browserWindow, 'Seat {seat}', { seat: participant.seatNumber || '—' })));
    title.append(element(document, 'h3', null, playerName(state, participant.playerId)));
    const outcome = element(document, 'strong', 'home-game-result', resultText(result.netMinor, bundle.session.currency));
    heading.append(title, outcome);
    const totals = element(document, 'dl', 'home-game-totals');
    for (const [key, value] of [
      ['Total in', result.totalInMinor],
      ['Cash out', result.totalOutMinor],
      ['Chips', latestChipCount(bundle, participant.playerId)],
    ]) {
      totals.append(element(document, 'dt', null, translate(browserWindow, key)));
      totals.append(element(document, 'dd', null, value === null ? '—' : key === 'Chips' ? String(value) : money(value, bundle.session.currency)));
    }
    card.append(heading, totals);
    if (bundle.session.status === HOME_GAME_SESSION_STATUS.ACTIVE && participant.status !== 'cashed_out') {
      const actions = element(document, 'div', 'home-game-player-actions');
      addAmountAction(actions, {
        label: result.totalInMinor === 0 ? 'Buy-in' : 'Rebuy',
        type: result.totalInMinor === 0 ? HOME_GAME_TRANSACTION_TYPES.BUY_IN : HOME_GAME_TRANSACTION_TYPES.REBUY,
        participant,
        session: bundle.session,
        handler: (values) => bridge.addTransaction(values),
      });
      addAmountAction(actions, {
        label: 'Add-on',
        type: HOME_GAME_TRANSACTION_TYPES.ADD_ON,
        participant,
        session: bundle.session,
        handler: (values) => bridge.addTransaction(values),
      });
      addAmountAction(actions, {
        label: 'Cash out',
        participant,
        session: bundle.session,
        allowZero: true,
        handler: (values) => bridge.cashOut(values),
      });
      const chipField = element(document, 'label', 'home-game-amount-field');
      chipField.append(element(document, 'span', null, translate(browserWindow, 'Chips')));
      const chipInput = element(document, 'input', 'control-input');
      chipInput.type = 'number';
      chipInput.min = '0';
      chipInput.step = '1';
      chipInput.inputMode = 'numeric';
      chipInput.setAttribute('aria-label', `${translate(browserWindow, 'Chips')} — ${playerName(state, participant.playerId)}`);
      const chipButton = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Record chips'));
      chipButton.type = 'button';
      chipButton.addEventListener('click', () => {
        const chipCount = Number(chipInput.value);
        if (!Number.isSafeInteger(chipCount) || chipCount < 0) { setError(new RangeError(translate(browserWindow, 'Enter a whole chip count.'))); chipInput.focus(); return; }
        perform(() => bridge.recordChipCount({ sessionId: bundle.session.sessionId, playerId: participant.playerId, chipCount }));
      });
      chipField.append(chipInput, chipButton);
      actions.append(chipField);
      card.append(actions);
    } else if (participant.status === 'cashed_out') {
      card.append(element(document, 'p', 'home-game-final-state', translate(browserWindow, 'Final cash-out recorded')));
    }
    return card;
  }

  function renderSettlement(bundle, container) {
    if (bundle.session.status !== HOME_GAME_SESSION_STATUS.COMPLETED || !bundle.settlement) return;
    const section = element(document, 'section', 'home-game-settlement');
    section.append(element(document, 'h3', null, translate(browserWindow, 'Settlement')));
    if (!bundle.settlement.transfers.length) {
      section.append(element(document, 'p', null, translate(browserWindow, 'No transfers are needed.')));
    }
    for (const transfer of bundle.settlement.transfers) {
      section.append(element(document, 'p', 'home-game-transfer', translate(browserWindow, '{payer} owes {recipient} {amount}', {
        payer: playerName(state, transfer.fromPlayerId),
        recipient: playerName(state, transfer.toPlayerId),
        amount: money(transfer.amountMinor, bundle.session.currency),
      })));
    }
    container.append(section);
  }

  function openCorrectionEditor(item, bundle) {
    const body = element(document, 'div', 'home-game-editor-fields');
    const summary = element(document, 'p', 'home-game-correction-summary', translate(browserWindow, 'Reverse {type} of {amount} for {name}. The original entry remains visible.', {
      type: transactionType(item.original.type),
      amount: money(item.original.amountMinor, bundle.session.currency),
      name: playerName(state, item.original.playerId),
    }));
    const replacement = translatedLabel('Replacement amount (optional)', 'homeGameCorrectionReplacement', formatMinorUnits(item.original.amountMinor, bundle.session.currency));
    replacement.input.type = 'number';
    replacement.input.min = '0';
    replacement.input.step = bundle.session.currency.minorUnit === 0 ? '1' : `0.${'0'.repeat(bundle.session.currency.minorUnit - 1)}1`;
    const reason = translatedLabel('Reason', 'homeGameCorrectionReason');
    reason.input.required = true;
    reason.input.maxLength = 500;
    body.append(summary, replacement.label, reason.label);
    openEditor('Correct ledger entry', body, async () => {
      const accepted = await confirmAction({
        title: 'Confirm correction?',
        message: translate(browserWindow, 'This appends an immutable reversal. It does not edit or delete the original entry.'),
        confirmLabel: 'Correct entry',
      });
      if (!accepted) return state;
      const replacementAmountMinor = replacement.input.value.trim() === ''
        ? null
        : parseMoneyToMinorUnits(replacement.input.value, bundle.session.currency.minorUnit);
      return bridge.correctTransaction({
        sessionId: bundle.session.sessionId,
        transactionId: item.original.transactionId,
        replacementAmountMinor,
        note: reason.input.value,
      });
    }, 'Correct entry');
  }

  function renderLedgerHistory(bundle, container) {
    const details = element(document, 'details', 'home-game-history');
    const summary = element(document, 'summary');
    summary.append(element(document, 'span', null, translate(browserWindow, 'Ledger history')),
      element(document, 'small', null, translate(browserWindow, '{count} entries', { count: bundle.transactions.length })));
    details.append(summary);
    const list = element(document, 'ol', 'home-game-history-list');
    for (const item of bundle.ledgerHistory.items) {
      const row = element(document, 'li', 'home-game-history-item');
      if (item.corrected) row.dataset.corrected = 'true';
      const header = element(document, 'div', 'home-game-history-line');
      const copy = element(document, 'span');
      copy.append(element(document, 'strong', null, `${transactionType(item.original.type)} · ${playerName(state, item.original.playerId)}`));
      copy.append(element(document, 'small', null, `${timestamp(item.original.createdAt)} · #${item.order}`));
      const amount = element(document, 'span', 'home-game-money', money(item.original.amountMinor, bundle.session.currency));
      amount.dir = 'ltr';
      header.append(copy, amount);
      row.append(header);
      if (item.original.note) row.append(element(document, 'p', 'home-game-history-note', item.original.note));
      if (item.corrected) {
        row.append(element(document, 'p', 'home-game-history-status', translate(browserWindow, 'Corrected · reversed by {amount} at {time}', {
          amount: money(item.correction.amountMinor, bundle.session.currency), time: timestamp(item.correction.createdAt),
        })));
        if (item.correction.note) row.append(element(document, 'p', 'home-game-history-note', item.correction.note));
        if (item.replacement) row.append(element(document, 'p', 'home-game-history-replacement', translate(browserWindow, 'Replacement {type}: {amount} at {time}', {
          type: transactionType(item.replacement.type), amount: money(item.replacement.amountMinor, bundle.session.currency), time: timestamp(item.replacement.createdAt),
        })));
      } else if (bundle.session.status === HOME_GAME_SESSION_STATUS.ACTIVE) {
        const correct = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Correct entry'));
        correct.type = 'button';
        correct.addEventListener('click', () => openCorrectionEditor(item, bundle));
        row.append(correct);
      }
      list.append(row);
    }
    if (!bundle.ledgerHistory.items.length) list.append(element(document, 'li', 'home-game-empty', translate(browserWindow, 'No money entries yet.')));
    details.append(list);
    container.append(details);
  }

  function renderLifecycleHistory(bundle, container) {
    const details = element(document, 'details', 'home-game-history');
    const summary = element(document, 'summary');
    summary.append(element(document, 'span', null, translate(browserWindow, 'Session lifecycle')),
      element(document, 'small', null, translate(browserWindow, 'Revision {revision}', { revision: bundle.session.revision })));
    details.append(summary);
    const list = element(document, 'ol', 'home-game-lifecycle-list');
    bundle.session.lifecycleEvents.forEach((event) => {
      const label = ({ created: 'Created', started: 'Started', completed: 'Completed', reopened: 'Reopened', archived: 'Archived', restored: 'Restored' })[event.type] || event.type;
      const item = element(document, 'li');
      item.append(element(document, 'strong', null, translate(browserWindow, label)), element(document, 'span', null, timestamp(event.at)), element(document, 'small', null, translate(browserWindow, 'Revision {revision}', { revision: event.revision })));
      list.append(item);
    });
    details.append(list);
    container.append(details);
  }

  async function downloadSessionExport(bundle) {
    if (busy) return;
    setError();
    setBusy(true);
    try {
      const envelope = await bridge.exportSession(bundle.session.sessionId);
      const blob = new Blob([`${JSON.stringify(envelope, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = element(document, 'a');
      anchor.href = url;
      anchor.download = `${bundle.session.title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'home-game'}-${bundle.session.sessionId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setError(error); }
    finally { setBusy(false); if (state) render(); }
  }

  function renderSession() {
    refs.session.replaceChildren();
    const bundle = state.current;
    if (!bundle) {
      refs.session.append(element(document, 'div', 'home-game-empty home-game-empty--large', translate(browserWindow, 'Create a session or open a recent game.')));
      return;
    }
    const panel = element(document, 'section', 'panel home-game-active-session');
    const header = element(document, 'header', 'home-game-session-header');
    const heading = element(document, 'div');
    heading.append(element(document, 'span', 'home-game-eyebrow', translate(browserWindow, bundle.session.archived ? 'Archived session' : bundle.session.status === 'completed' ? 'Session complete' : 'Active session')));
    heading.append(element(document, 'h2', null, bundle.session.title));
    if (bundle.session.status === HOME_GAME_SESSION_STATUS.COMPLETED) heading.append(element(document, 'p', 'home-game-readonly-note', translate(browserWindow, 'Completed sessions are read-only. Reopen deliberately to add or correct entries.')));
    const balance = element(document, 'div', 'home-game-balance');
    balance.setAttribute('role', 'status');
    balance.dataset.balanced = String(bundle.accounting.balanced);
    balance.append(element(document, 'span', null, translate(browserWindow, 'Session balance')));
    balance.append(element(document, 'strong', null, bundle.accounting.balanced
      ? translate(browserWindow, 'Balanced')
      : translate(browserWindow, 'Unbalanced by {amount}', { amount: money(Math.abs(bundle.accounting.balanceMinor), bundle.session.currency) })));
    header.append(heading, balance);
    panel.append(header);
    const grid = element(document, 'div', 'home-game-player-grid');
    bundle.session.participants.forEach((participant) => grid.append(renderParticipant(participant, bundle)));
    panel.append(grid);
    const footer = element(document, 'footer', 'home-game-session-actions');
    if (bundle.session.status === HOME_GAME_SESSION_STATUS.ACTIVE) {
      const complete = element(document, 'button', 'ui-button ui-button--primary', translate(browserWindow, 'Complete session'));
      complete.type = 'button';
      complete.addEventListener('click', () => perform(() => bridge.completeSession(bundle.session.sessionId)));
      footer.append(complete);
    } else if (!bundle.session.archived) {
      const reopen = element(document, 'button', 'ui-button ui-button--secondary', translate(browserWindow, 'Reopen'));
      reopen.type = 'button';
      reopen.addEventListener('click', async () => {
        const accepted = await confirmAction({
          title: 'Reopen session?',
          message: translate(browserWindow, 'Reopen {name}? Ledger and lifecycle history stay intact; no transactions are duplicated.', { name: bundle.session.title }),
          confirmLabel: 'Reopen',
        });
        if (accepted) perform(() => bridge.reopenSession(bundle.session.sessionId));
      });
      footer.append(reopen);
    } else {
      const restore = element(document, 'button', 'ui-button ui-button--secondary', translate(browserWindow, 'Restore'));
      restore.type = 'button';
      restore.addEventListener('click', () => perform(() => bridge.setSessionArchived(bundle.session.sessionId, false)));
      footer.append(restore);
    }
    if (state.persistence === 'account_local') {
      const exportButton = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Export JSON'));
      exportButton.type = 'button';
      exportButton.addEventListener('click', () => downloadSessionExport(bundle));
      footer.append(exportButton);
      if (bundle.session.status === HOME_GAME_SESSION_STATUS.COMPLETED && !bundle.session.archived) {
        const archive = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Archive session'));
        archive.type = 'button';
        archive.addEventListener('click', async () => {
          const accepted = await confirmAction({ title: 'Archive session?', message: translate(browserWindow, 'Archive {name}? Its ledger, settlement, and history remain intact.', { name: bundle.session.title }), confirmLabel: 'Archive' });
          if (accepted) perform(() => bridge.setSessionArchived(bundle.session.sessionId, true));
        });
        footer.append(archive);
      }
    }
    panel.append(footer);
    renderSettlement(bundle, panel);
    renderLedgerHistory(bundle, panel);
    renderLifecycleHistory(bundle, panel);
    refs.session.append(panel);
  }

  function render() {
    if (!state) return;
    const guest = state.persistence === 'guest_memory';
    refs.persistence.textContent = translate(browserWindow, guest ? 'Guest · in-memory only' : 'Account · saved on this device');
    refs.persistence.className = `status-badge ${guest ? 'status-badge--warning' : 'status-badge--available'}`;
    refs.notice.hidden = false;
    refs.notice.textContent = translate(browserWindow, guest
      ? 'Guest sessions stay only in this browser session. Sign in before starting a game you want to keep.'
      : 'Home Game data is private and stored locally for this account. Cloud sync is not enabled yet.');
    refs.saveGroup.disabled = guest;
    refs.groupName.disabled = guest || !refs.saveGroup.checked;
    refs.accountRoster.hidden = guest;
    refs.guestRoster.hidden = !guest;
    refs.newGroup.hidden = guest;
    refs.newPlayer.closest('details').hidden = guest;
    if (!guest) {
      renderRosterChoices();
      renderRoster();
    }
    renderGroups();
    renderRecent();
    renderPlayers();
    renderSession();
  }

  refs.saveGroup.addEventListener('change', () => { refs.groupName.disabled = !refs.saveGroup.checked || state?.persistence === 'guest_memory'; });
  refs.rosterGroup.addEventListener('change', () => {
    const group = state?.groups.find((entry) => entry.groupId === refs.rosterGroup.value);
    if (group) useGroupRoster(group);
  });
  refs.rosterAddSaved.addEventListener('click', () => {
    const player = state?.availablePlayers.find((entry) => entry.playerId === refs.rosterPlayer.value);
    if (!player) return;
    draftRoster.push({ key: player.playerId, playerId: player.playerId, displayName: player.displayName });
    renderRoster();
    renderRosterChoices();
  });
  refs.rosterAddNew.addEventListener('click', () => {
    const displayName = refs.rosterNewName.value.trim();
    if (!displayName) { refs.rosterNewName.focus(); return; }
    draftRoster.push({ key: `new-${Date.now()}-${draftRoster.length}`, displayName });
    refs.rosterNewName.value = '';
    renderRoster();
    renderRosterChoices();
  });
  refs.newPlayer.addEventListener('click', () => openPlayerEditor());
  refs.newGroup.addEventListener('click', () => openGroupEditor());
  refs.playerSearch.addEventListener('input', renderPlayers);
  refs.showArchivedPlayers.addEventListener('change', renderPlayers);
  refs.showArchivedGroups.addEventListener('change', renderGroups);
  refs.showArchivedSessions.addEventListener('change', renderRecent);
  refs.editorForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const operation = editorOperation;
    editorOperation = null;
    refs.editorDialog.close();
    if (operation) perform(operation);
  });
  refs.editorDialog.querySelectorAll('[data-home-game-close]').forEach((button) => button.addEventListener('click', () => refs.editorDialog.close('cancel')));
  refs.form.addEventListener('submit', (event) => {
    event.preventDefault();
    let buyInMinor;
    let blinds;
    try {
      buyInMinor = parseMoneyToMinorUnits(refs.buyIn.value || '0', 2);
      const smallBlindMinor = parseOptionalMoney(refs.smallBlind);
      const bigBlindMinor = parseOptionalMoney(refs.bigBlind);
      const anteMinor = parseOptionalMoney(refs.ante);
      blinds = smallBlindMinor || bigBlindMinor || anteMinor ? { smallBlindMinor, bigBlindMinor, anteMinor } : null;
      if (state.persistence === 'account_local' && draftRoster.length < 2) throw new RangeError(translate(browserWindow, 'Add at least two players.'));
    } catch (error) { setError(error); refs.buyIn.focus(); return; }
    perform(() => bridge.createSession({
      title: refs.title.value,
      currencyCode: refs.currency.value,
      currencyLabel: refs.currency.selectedOptions[0]?.dataset.label || refs.currency.value,
      minorUnit: 2,
      ...(state.persistence === 'guest_memory'
        ? { playerNames: refs.playerNames.value.split(/\r?\n|,/) }
        : { roster: draftRoster.map((entry) => entry.playerId ? { playerId: entry.playerId } : { displayName: entry.displayName }) }),
      sourceGroupId: state.persistence === 'account_local' ? draftSourceGroupId : null,
      buyInMinor,
      blinds,
      saveGroupName: refs.saveGroup.checked ? refs.groupName.value : null,
    }));
  });

  // The primary submit starts disabled in markup so an early click cannot
  // perform a native form navigation before this organizer handler exists.
  if (refs.createButton) refs.createButton.disabled = false;

  const refresh = () => perform(() => bridge.load());
  browserWindow.addEventListener('riverline:languagechange', () => render());
  browserWindow.addEventListener('riverline:authchange', refresh);
  browserWindow.addEventListener('riverline:identitychange', refresh);
  void refresh();
  return Object.freeze({ refresh, render: () => render(), getState: () => state });
}

if (typeof window !== 'undefined') {
  const start = async () => {
    try {
      await window.RiverlineAuthentication?.ready?.();
      const bridge = installHomeGameBridge(window);
      installHomeGameWorkspace(window, bridge);
    } catch (error) {
      const status = document.getElementById('homeGameError');
      if (status) { status.hidden = false; status.textContent = error.message || 'Home Game could not start.'; }
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void start(); }, { once: true });
  else void start();
}
