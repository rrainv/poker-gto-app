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
    playerNames: document.getElementById('homeGamePlayerNames'),
    buyIn: document.getElementById('homeGameInitialBuyIn'),
    saveGroup: document.getElementById('homeGameSaveGroup'),
    groupName: document.getElementById('homeGameGroupName'),
    groups: document.getElementById('homeGameGroups'),
    recent: document.getElementById('homeGameRecent'),
    session: document.getElementById('homeGameSession'),
  };
  let state = null;
  let busy = false;

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

  function money(amountMinor, currency = state.current?.session.currency) {
    return `${formatMinorUnits(amountMinor, currency)} ${currency.label}`;
  }

  function resultText(amountMinor, currency) {
    if (amountMinor > 0) return translate(browserWindow, 'Receives {amount}', { amount: money(amountMinor, currency) });
    if (amountMinor < 0) return translate(browserWindow, 'Owes {amount}', { amount: money(-amountMinor, currency) });
    return translate(browserWindow, 'Even');
  }

  function renderGroups() {
    refs.groups.replaceChildren();
    if (state.persistence === 'guest_memory') {
      refs.groups.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'Sign in to save reusable player groups.')));
      return;
    }
    if (!state.groups.length) {
      refs.groups.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'No saved groups yet.')));
      return;
    }
    for (const group of state.groups) {
      const card = element(document, 'article', 'home-game-list-card');
      const copy = element(document, 'div');
      copy.append(element(document, 'strong', null, group.name));
      copy.append(element(document, 'small', null, translate(browserWindow, '{count} players', { count: group.playerIds.length })));
      const action = element(document, 'button', 'ui-button ui-button--quiet', translate(browserWindow, 'Start session'));
      action.type = 'button';
      action.addEventListener('click', () => perform(() => bridge.createSessionFromGroup({ groupId: group.groupId, title: group.name })));
      card.append(copy, action);
      refs.groups.append(card);
    }
  }

  function renderRecent() {
    refs.recent.replaceChildren();
    if (!state.recentSessions.length) {
      refs.recent.append(element(document, 'p', 'home-game-empty', translate(browserWindow, 'No sessions yet.')));
      return;
    }
    for (const session of state.recentSessions) {
      const action = element(document, 'button', 'home-game-recent-button');
      action.type = 'button';
      const copy = element(document, 'span');
      copy.append(element(document, 'strong', null, session.title));
      copy.append(element(document, 'small', null, translate(browserWindow, session.status === 'completed' ? 'Session complete' : session.status === 'active' ? 'Active session' : 'Draft session')));
      action.append(copy, element(document, 'span', 'status-badge', session.currency.code));
      action.addEventListener('click', () => perform(() => bridge.openSession(session.sessionId)));
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
    heading.append(element(document, 'span', 'home-game-eyebrow', translate(browserWindow, bundle.session.status === 'completed' ? 'Session complete' : 'Active session')));
    heading.append(element(document, 'h2', null, bundle.session.title));
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
    } else {
      const reopen = element(document, 'button', 'ui-button ui-button--secondary', translate(browserWindow, 'Reopen'));
      reopen.type = 'button';
      reopen.addEventListener('click', () => perform(() => bridge.reopenSession(bundle.session.sessionId)));
      footer.append(reopen);
    }
    panel.append(footer);
    renderSettlement(bundle, panel);
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
    renderGroups();
    renderRecent();
    renderSession();
  }

  refs.saveGroup.addEventListener('change', () => { refs.groupName.disabled = !refs.saveGroup.checked || state?.persistence === 'guest_memory'; });
  refs.form.addEventListener('submit', (event) => {
    event.preventDefault();
    let buyInMinor;
    try { buyInMinor = parseMoneyToMinorUnits(refs.buyIn.value || '0', 2); }
    catch (error) { setError(error); refs.buyIn.focus(); return; }
    perform(() => bridge.createSession({
      title: refs.title.value,
      currencyCode: refs.currency.value,
      currencyLabel: refs.currency.selectedOptions[0]?.dataset.label || refs.currency.value,
      minorUnit: 2,
      playerNames: refs.playerNames.value.split(/\r?\n|,/),
      buyInMinor,
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
