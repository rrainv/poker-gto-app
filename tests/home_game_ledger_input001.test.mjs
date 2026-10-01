import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createHomeGameApplication } from '../app/src/application/home-game-service.mjs';
import {
  HOME_GAME_INPUT_MESSAGES,
  createHomeGameDraftStore,
  readHomeGameAmount,
  readHomeGameChipCount,
} from '../app/src/application/home-game-amount-input.mjs';
import { installHomeGameBridge, installHomeGameWorkspace } from '../app/src/application/home-game-bootstrap.mjs';
import { createMemoryHomeGameDatabase } from '../app/src/home-game/index.mjs';

const T0 = '2026-10-01T19:00:00.000Z';

function idFactory() {
  let counter = 0;
  return (prefix) => `${prefix}-${++counter}`;
}

function field(value, { badInput = false } = {}) {
  return { value, validity: { badInput } };
}

// ---------------------------------------------------------------------------
// Pure field reading: nothing defaults to zero.

test('amount reader rejects empty, blank, and non-numeric fields instead of substituting zero', () => {
  for (const options of [{ minimumMinor: 1 }, { minimumMinor: 0 }]) {
    assert.deepEqual({ ...readHomeGameAmount(field(''), options) }, { ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.REQUIRED });
    assert.deepEqual({ ...readHomeGameAmount(field('   '), options) }, { ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.REQUIRED });
    // Firefox reports typed letters in a number field as value '' plus badInput.
    assert.deepEqual({ ...readHomeGameAmount(field('', { badInput: true }), options) }, { ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.INVALID });
    for (const text of ['abc', '1e3', '1,5', '1.234', '-1', '--1', '0x10', '.5.']) {
      assert.equal(readHomeGameAmount(field(text), options).ok, false, text);
    }
  }
  assert.deepEqual({ ...readHomeGameAmount(field('0')) }, { ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.POSITIVE });
});

test('amount reader keeps exact minor units and only allows zero where explicitly permitted', () => {
  assert.equal(readHomeGameAmount(field('0.10')).amountMinor, 10);
  assert.equal(readHomeGameAmount(field(' 12.5 ')).amountMinor, 1_250);
  assert.equal(readHomeGameAmount(field('7'), { minorUnit: 0 }).amountMinor, 7);
  assert.equal(readHomeGameAmount(field('0.01'), { minimumMinor: 1 }).amountMinor, 1);
  assert.deepEqual({ ...readHomeGameAmount(field('0'), { minimumMinor: 0 }) }, { ok: true, amountMinor: 0 });
  assert.deepEqual({ ...readHomeGameAmount(field('0.00'), { minimumMinor: 0 }) }, { ok: true, amountMinor: 0 });
  assert.deepEqual({ ...readHomeGameAmount(field(''), { required: false }) }, { ok: true, amountMinor: null });
  assert.equal(readHomeGameAmount(field('', { badInput: true }), { required: false }).ok, false);
  assert.equal(readHomeGameAmount(field('0'), {
    required: false, minimumMinor: 1, belowMinimumMessage: HOME_GAME_INPUT_MESSAGES.REPLACEMENT_POSITIVE,
  }).messageKey, HOME_GAME_INPUT_MESSAGES.REPLACEMENT_POSITIVE);
});

test('chip reader requires a typed whole count', () => {
  assert.deepEqual({ ...readHomeGameChipCount(field('0')) }, { ok: true, chipCount: 0 });
  assert.deepEqual({ ...readHomeGameChipCount(field('1500')) }, { ok: true, chipCount: 1_500 });
  for (const text of ['', ' ', '1.5', '-1', 'abc', '1e3', '99999999999999999999']) {
    assert.deepEqual({ ...readHomeGameChipCount(field(text)) }, { ok: false, messageKey: HOME_GAME_INPUT_MESSAGES.CHIPS }, text);
  }
  assert.equal(readHomeGameChipCount(field('', { badInput: true })).ok, false);
});

test('draft store is per session, seat and field, and clears on submit, session end and owner change', () => {
  const drafts = createHomeGameDraftStore();
  drafts.setOwnerScope('guest_memory:');
  drafts.set('s1', 'ann', 'money_in', { value: '40' });
  drafts.set('s1', 'ann', 'cash_out', { value: '', error: HOME_GAME_INPUT_MESSAGES.REQUIRED });
  drafts.set('s1', 'ben', 'money_in', { value: '25' });
  drafts.set('s2', 'ann', 'money_in', { value: '9' });
  assert.equal(drafts.get('s1', 'ann', 'money_in').value, '40');
  assert.equal(drafts.get('s1', 'ann', 'cash_out').error, HOME_GAME_INPUT_MESSAGES.REQUIRED);
  assert.equal(drafts.get('s1', 'ann', 'add_on'), null);
  drafts.clear('s1', 'ann', 'money_in');
  assert.equal(drafts.get('s1', 'ann', 'money_in'), null);
  drafts.set('s1', 'ben', 'money_in', { value: '' });
  assert.equal(drafts.get('s1', 'ben', 'money_in'), null, 'an emptied field without an error leaves no draft');
  drafts.set('s1', 'ben', 'money_in', { value: '25' });
  drafts.retain('s1', ['ann']);
  assert.equal(drafts.get('s1', 'ben', 'money_in'), null);
  assert.equal(drafts.get('s1', 'ann', 'cash_out').error, HOME_GAME_INPUT_MESSAGES.REQUIRED);
  assert.equal(drafts.get('s2', 'ann', 'money_in').value, '9', 'other sessions are untouched by retain');
  drafts.clearSession('s1');
  assert.equal(drafts.get('s1', 'ann', 'cash_out'), null);
  assert.equal(drafts.setOwnerScope('guest_memory:'), false);
  assert.equal(drafts.size, 1);
  assert.equal(drafts.setOwnerScope('account_local:identity-a'), true);
  assert.equal(drafts.size, 0);
});

// ---------------------------------------------------------------------------
// Application commands keep rejecting malformed amounts; explicit zero stays a
// final participant state.

test('service rejects missing and malformed amounts for every money action without changing the ledger', async () => {
  const app = createHomeGameApplication({
    authQueries: { getState: () => ({ status: 'guest' }) },
    identityQueries: { getActiveIdentityId: async () => null },
    clock: () => T0,
    idFactory: idFactory(),
  });
  const state = await app.createSession({ playerNames: ['Ann', 'Ben'], buyInMinor: 10_000 });
  const { sessionId } = state.current.session;
  const [ann] = state.current.session.participants;
  const before = state.current;
  const badAmounts = [undefined, null, Number.NaN, '100', 1.5, -1, Number.MAX_SAFE_INTEGER + 1];
  for (const type of ['buy_in', 'rebuy', 'add_on']) {
    for (const amountMinor of [...badAmounts, 0]) {
      await assert.rejects(app.addTransaction({ sessionId, playerId: ann.playerId, type, amountMinor }), RangeError, `${type} ${amountMinor}`);
    }
  }
  for (const amountMinor of badAmounts) {
    await assert.rejects(app.cashOut({ sessionId, playerId: ann.playerId, amountMinor }), RangeError, `cash_out ${amountMinor}`);
  }
  const buyIn = before.transactions[0];
  for (const replacementAmountMinor of [0, -1, 1.5, '100', Number.NaN]) {
    await assert.rejects(app.correctTransaction({ sessionId, transactionId: buyIn.transactionId, replacementAmountMinor }), RangeError);
  }
  const after = (await app.load()).current;
  assert.deepEqual(after.transactions, before.transactions);
  assert.deepEqual(after.accounting, before.accounting);
  assert.equal(after.session.revision, before.session.revision);
  assert.deepEqual(after.session.participants.map((entry) => entry.status), ['active', 'active']);
});

test('explicit zero cash-out records a final state with no ledger entry and leaves balances exact', async () => {
  const app = createHomeGameApplication({
    authQueries: { getState: () => ({ status: 'guest' }) },
    identityQueries: { getActiveIdentityId: async () => null },
    clock: () => T0,
    idFactory: idFactory(),
  });
  let state = await app.createSession({ playerNames: ['Busted', 'Winner'], buyInMinor: 5_000 });
  const { sessionId } = state.current.session;
  const [busted, winner] = state.current.session.participants;
  state = await app.cashOut({ sessionId, playerId: busted.playerId, amountMinor: 0 });
  assert.equal(state.current.session.participants[0].status, 'cashed_out');
  assert.equal(state.current.transactions.filter((entry) => entry.type === 'cash_out').length, 0);
  // Current v1 truth: the zero fact has no ledger row, so Correct entries cannot list it.
  assert.equal(state.current.ledgerHistory.items.some((item) => item.original.playerId === busted.playerId && item.original.type === 'cash_out'), false);
  state = await app.cashOut({ sessionId, playerId: winner.playerId, amountMinor: 10_000 });
  assert.equal(state.current.accounting.balanceMinor, 0);
  assert.deepEqual(state.current.accounting.participantResults.map((entry) => entry.netMinor), [-5_000, 5_000]);
  state = await app.completeSession(sessionId);
  assert.deepEqual(state.current.settlement.transfers, [{ fromPlayerId: busted.playerId, toPlayerId: winner.playerId, amountMinor: 5_000 }]);
});

// ---------------------------------------------------------------------------
// Mounted controller over a minimal DOM.

function matches(node, selector) {
  return selector.split(',').map((part) => part.trim()).some((part) => {
    const attribute = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(part);
    if (attribute) {
      const value = node.getAttribute(attribute[1]);
      return value !== null && (attribute[2] === undefined || value === attribute[2]);
    }
    if (part.startsWith('.')) return node.className.split(/\s+/).includes(part.slice(1));
    return node.tagName === part;
  });
}

function dataAttribute(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

class FakeElement {
  constructor(document, tagName) {
    this.ownerDocument = document;
    this.tagName = tagName;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.validity = { badInput: false };
    this.scrollTop = 0;
    this.ownText = '';
    this.open = false;
    this.returnValue = '';
  }
  get id() { return this.attributes.get('id') ?? ''; }
  set id(value) { this.attributes.set('id', String(value)); }
  append(...nodes) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children = node.parentElement.children.filter((child) => child !== node);
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
    this.ownText = '';
    this.append(...nodes);
  }
  set textContent(text) { this.replaceChildren(); this.ownText = String(text); }
  get textContent() { return [this.ownText, ...this.children.map((child) => child.textContent)].filter(Boolean).join(' '); }
  setAttribute(name, value) {
    if (name.startsWith('data-')) this.dataset[dataAttribute(name)] = String(value);
    else this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    if (name.startsWith('data-')) return this.dataset[dataAttribute(name)] ?? null;
    if (name === 'id') return this.id || null;
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name) {
    if (name.startsWith('data-')) delete this.dataset[dataAttribute(name)];
    else this.attributes.delete(name);
  }
  addEventListener(type, callback, options = {}) {
    const list = this.listeners.get(type) || [];
    list.push({ callback, once: Boolean(options?.once) });
    this.listeners.set(type, list);
  }
  dispatch(type, properties = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((entry) => !entry.once));
    list.forEach((entry) => entry.callback(event));
    return event;
  }
  get descendants() { return this.children.flatMap((child) => [child, ...child.descendants]); }
  querySelectorAll(selector) { return this.descendants.filter((node) => matches(node, selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (matches(node, selector)) return node;
    return null;
  }
  contains(node) { return node === this || this.descendants.includes(node); }
  get isConnected() { return this.ownerDocument.documentElement.contains(this); }
  focus() { this.ownerDocument.activeElement = this; }
  scrollIntoView() {}
  get options() { return this.children.filter((child) => child.tagName === 'option'); }
  get selectedOptions() { return this.options.filter((option) => option.value === this.value); }
  showModal() { this.open = true; }
  close(returnValue = '') {
    this.open = false;
    this.returnValue = returnValue;
    this.dispatch('close');
  }
}

function mountWorkspace({ authStatus = 'guest' } = {}) {
  const document = { activeElement: null, readyState: 'complete' };
  const create = (tag, id = null, parent = null) => {
    const node = new FakeElement(document, tag);
    if (id) node.id = id;
    parent?.append(node);
    return node;
  };
  document.createElement = (tag) => create(tag);
  document.documentElement = create('html');
  document.documentElement.setAttribute('lang', 'en');
  document.documentElement.lang = 'en';
  document.body = create('body', null, document.documentElement);
  document.scrollingElement = document.documentElement;
  const root = create('div', 'homeGameWorkspace', document.body);
  for (const id of ['homeGamePersistence', 'homeGamePersistenceNotice', 'homeGameError', 'homeGameActionStatus']) create('p', id, root);
  const form = create('form', 'homeGameNewSessionForm', root);
  create('button', 'homeGameCreateButton', form).disabled = true;
  create('input', 'homeGameSessionTitle', form);
  const currency = create('select', 'homeGameCurrency', form);
  const ils = create('option', null, currency);
  ils.value = 'ILS';
  ils.dataset.label = '₪';
  currency.value = 'ILS';
  const accountRoster = create('div', 'homeGameAccountRoster', form);
  create('select', 'homeGameRosterGroup', accountRoster);
  create('select', 'homeGameRosterPlayer', accountRoster);
  create('button', 'homeGameRosterAddSaved', accountRoster);
  create('input', 'homeGameRosterNewName', accountRoster);
  create('button', 'homeGameRosterAddNew', accountRoster);
  create('div', 'homeGameRoster', accountRoster);
  const guestRoster = create('label', 'homeGameGuestRoster', form);
  create('textarea', 'homeGamePlayerNames', guestRoster);
  for (const id of ['homeGameSmallBlind', 'homeGameBigBlind', 'homeGameAnte', 'homeGameInitialBuyIn']) {
    create('input', id, create('label', null, form));
  }
  create('input', 'homeGameSaveGroup', create('label', null, form)).type = 'checkbox';
  create('input', 'homeGameGroupName', create('label', null, form));
  const groupsPanel = create('section', null, root);
  create('input', 'homeGameShowArchivedGroups', create('label', null, groupsPanel));
  create('button', 'homeGameNewGroup', groupsPanel);
  create('div', 'homeGameGroups', groupsPanel);
  const recentPanel = create('section', null, root);
  create('input', 'homeGameShowArchivedSessions', create('label', null, recentPanel));
  create('div', 'homeGameRecent', recentPanel);
  const library = create('details', null, root);
  create('input', 'homeGamePlayerSearch', library);
  create('input', 'homeGameShowArchivedPlayers', library);
  create('button', 'homeGameNewPlayer', library);
  create('div', 'homeGamePlayers', library);
  create('div', 'homeGameSession', root);
  const editorDialog = create('dialog', 'homeGameEditorDialog', root);
  const editorForm = create('form', 'homeGameEditorForm', editorDialog);
  create('h2', 'homeGameEditorTitle', editorForm);
  create('div', 'homeGameEditorBody', editorForm);
  create('button', 'homeGameEditorSubmit', editorForm);
  const confirmDialog = create('dialog', 'homeGameConfirmDialog', root);
  create('h2', 'homeGameConfirmTitle', confirmDialog);
  create('p', 'homeGameConfirmMessage', confirmDialog);
  create('button', 'homeGameConfirmSubmit', confirmDialog);
  document.getElementById = (id) => document.documentElement.descendants.find((node) => node.id === id) || null;

  const auth = { status: authStatus };
  const windowListeners = new Map();
  const browserWindow = {
    document,
    t: (key, parameters = {}) => key.replace(/\{(\w+)\}/g, (_, name) => String(parameters[name] ?? '')),
    addEventListener(type, callback) { windowListeners.set(type, [...(windowListeners.get(type) || []), callback]); },
    emit(type) { (windowListeners.get(type) || []).forEach((callback) => callback({ type })); },
  };
  const application = createHomeGameApplication({
    authQueries: { getState: () => ({ status: auth.status }) },
    identityQueries: { getActiveIdentityId: async () => 'identity-a' },
    accountDatabase: createMemoryHomeGameDatabase(),
    clock: () => T0,
    idFactory: idFactory(),
  });
  const bridge = installHomeGameBridge(browserWindow, { application });
  const workspace = installHomeGameWorkspace(browserWindow, bridge);
  const get = (id) => document.getElementById(id);
  const control = (key) => root.querySelectorAll('[data-home-game-control]').find((node) => node.dataset.homeGameControl === key) || null;
  return { document, root, auth, browserWindow, bridge, workspace, get, control };
}

async function settle() {
  for (let index = 0; index < 20; index += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function startGuestSession(mounted) {
  await settle();
  mounted.get('homeGamePlayerNames').value = 'Ann\nBen\nCy';
  mounted.get('homeGameInitialBuyIn').value = '100';
  mounted.get('homeGameNewSessionForm').dispatch('submit');
  await settle();
  const bundle = mounted.workspace.getState().current;
  const [ann, ben, cy] = bundle.session.participants.map((entry) => entry.playerId);
  return { sessionId: bundle.session.sessionId, ann, ben, cy };
}

function type(input, value) {
  input.validity = { badInput: false };
  input.value = value;
  input.dispatch('input');
}

function inlineError(input) {
  const id = input.getAttribute('aria-describedby');
  const node = id ? input.ownerDocument.getElementById(id) : null;
  return node && !node.hidden ? node.textContent : null;
}

test('empty or invalid seat amounts show an inline error and record nothing', async () => {
  const mounted = mountWorkspace();
  const { ann, cy } = await startGuestSession(mounted);
  const before = mounted.workspace.getState().current;
  assert.equal(before.transactions.length, 3);

  mounted.control(`cash_out:${ann}:submit`).dispatch('click');
  await settle();
  let state = mounted.workspace.getState().current;
  assert.deepEqual(state.transactions, before.transactions);
  assert.equal(state.session.participants[0].status, 'active', 'an empty Cash out never finalizes the seat');
  assert.equal(inlineError(mounted.control(`cash_out:${ann}:input`)), 'Enter an amount.');
  assert.equal(mounted.control(`cash_out:${ann}:input`).getAttribute('aria-invalid'), 'true');
  assert.equal(mounted.get('homeGameError').hidden, true, 'validation stays on the field, not the page banner');

  for (const field of ['money_in', 'add_on']) {
    mounted.control(`${field}:${ann}:submit`).dispatch('click');
    const input = mounted.control(`${field}:${ann}:input`);
    input.value = '';
    input.validity = { badInput: true };
    mounted.control(`${field}:${ann}:submit`).dispatch('click');
    assert.equal(inlineError(input), 'Enter a valid amount.');
    type(input, '0');
    mounted.control(`${field}:${ann}:submit`).dispatch('click');
    assert.equal(inlineError(input), 'Enter an amount greater than zero.');
  }
  mounted.control(`chips:${cy}:submit`).dispatch('click');
  assert.equal(inlineError(mounted.control(`chips:${cy}:input`)), 'Enter a whole chip count.');
  await settle();
  state = mounted.workspace.getState().current;
  assert.deepEqual(state.transactions, before.transactions);
  assert.deepEqual(state.snapshots, []);
  assert.equal(state.session.revision, before.session.revision);

  // Editing clears the inline message; a typed amount then submits normally.
  const cashOut = mounted.control(`cash_out:${ann}:input`);
  type(cashOut, '180');
  assert.equal(inlineError(cashOut), null);
  assert.equal(cashOut.getAttribute('aria-invalid'), null);
  mounted.control(`cash_out:${ann}:submit`).dispatch('click');
  await settle();
  state = mounted.workspace.getState().current;
  assert.equal(state.transactions.at(-1).type, 'cash_out');
  assert.equal(state.transactions.at(-1).amountMinor, 18_000);
});

test('typed amounts in other seats survive any action re-render; Enter submits the field and keeps focus', async () => {
  const mounted = mountWorkspace();
  const { ann, ben, cy } = await startGuestSession(mounted);
  type(mounted.control(`money_in:${ben}:input`), '40');
  type(mounted.control(`add_on:${cy}:input`), '15.5');
  type(mounted.control(`cash_out:${cy}:input`), '');
  const annRebuy = mounted.control(`money_in:${ann}:input`);
  type(annRebuy, '50');
  annRebuy.focus();
  mounted.document.documentElement.scrollTop = 640;
  const enter = annRebuy.dispatch('keydown', { key: 'Enter', isComposing: false });
  assert.equal(enter.defaultPrevented, true);
  await settle();

  const state = mounted.workspace.getState().current;
  assert.equal(state.transactions.at(-1).type, 'rebuy');
  assert.equal(state.transactions.at(-1).playerId, ann);
  assert.equal(state.transactions.at(-1).amountMinor, 5_000);
  assert.notEqual(mounted.control(`money_in:${ann}:input`), annRebuy, 'the seat cards were re-rendered');
  assert.equal(mounted.control(`money_in:${ann}:input`).value, '', 'the submitted field clears');
  assert.equal(mounted.control(`money_in:${ben}:input`).value, '40');
  assert.equal(mounted.control(`add_on:${cy}:input`).value, '15.5');
  assert.equal(mounted.document.activeElement, mounted.control(`money_in:${ann}:input`));
  assert.equal(mounted.document.documentElement.scrollTop, 640);

  // Other keys never submit; IME composition never submits.
  mounted.control(`money_in:${ben}:input`).dispatch('keydown', { key: 'a', isComposing: false });
  mounted.control(`money_in:${ben}:input`).dispatch('keydown', { key: 'Enter', isComposing: true });
  await settle();
  assert.equal(mounted.workspace.getState().current.transactions.length, state.transactions.length);

  // Enter applies the same validation as the button.
  mounted.control(`cash_out:${cy}:input`).dispatch('keydown', { key: 'Enter', isComposing: false });
  await settle();
  assert.equal(inlineError(mounted.control(`cash_out:${cy}:input`)), 'Enter an amount.');
  assert.equal(mounted.workspace.getState().current.session.participants[2].status, 'active');
  // ...and a pending inline error survives another seat's action too.
  type(mounted.control(`add_on:${ben}:input`), '5');
  mounted.control(`add_on:${ben}:submit`).dispatch('click');
  await settle();
  assert.equal(inlineError(mounted.control(`cash_out:${cy}:input`)), 'Enter an amount.');
  assert.equal(mounted.control(`money_in:${ben}:input`).value, '40');
  assert.equal(mounted.control(`add_on:${ben}:input`).value, '');
});

test('explicit zero cash-out finalizes the seat; drafts end with the seat and on owner change', async () => {
  const mounted = mountWorkspace();
  const { ben, cy } = await startGuestSession(mounted);
  type(mounted.control(`money_in:${cy}:input`), '30');
  type(mounted.control(`money_in:${ben}:input`), '20');
  type(mounted.control(`cash_out:${cy}:input`), '0');
  mounted.control(`cash_out:${cy}:submit`).dispatch('click');
  await settle();
  let state = mounted.workspace.getState().current;
  assert.equal(state.session.participants[2].status, 'cashed_out');
  assert.equal(state.transactions.length, 3, 'a zero cash-out adds no ledger row');
  assert.equal(mounted.control(`money_in:${cy}:input`), null);
  assert.equal(mounted.control(`money_in:${ben}:input`).value, '20');

  mounted.auth.status = 'signed_in';
  mounted.browserWindow.emit('riverline:authchange');
  await settle();
  assert.equal(mounted.workspace.getState().persistence, 'account_local');
  mounted.auth.status = 'guest';
  mounted.browserWindow.emit('riverline:authchange');
  await settle();
  state = mounted.workspace.getState().current;
  assert.equal(state.session.participants[1].playerId, ben);
  assert.equal(mounted.control(`money_in:${ben}:input`).value, '', 'owner change discarded every draft');
});

test('correction replacement amounts validate inline; empty remains reversal only', async () => {
  const mounted = mountWorkspace();
  const { ann } = await startGuestSession(mounted);
  const before = mounted.workspace.getState().current;
  const chooser = mounted.get('homeGameSession').querySelectorAll('button').find((node) => node.textContent === 'Correct entries');
  chooser.dispatch('click');
  assert.equal(mounted.get('homeGameEditorSubmit').hidden, true, 'the chooser exposes no inert Save action');
  mounted.get('homeGameEditorBody').querySelector('button').dispatch('click');
  const replacement = mounted.document.getElementById('homeGameCorrectionReplacement');
  assert.equal(replacement.value, '100.00');

  type(replacement, '0');
  mounted.get('homeGameEditorForm').dispatch('submit');
  assert.equal(mounted.get('homeGameEditorDialog').open, true);
  assert.equal(inlineError(replacement), HOME_GAME_INPUT_MESSAGES.REPLACEMENT_POSITIVE);
  replacement.value = '';
  replacement.validity = { badInput: true };
  mounted.get('homeGameEditorForm').dispatch('submit');
  assert.equal(inlineError(replacement), 'Enter a valid amount.');
  assert.equal(mounted.get('homeGameConfirmDialog').open, false);
  await settle();
  assert.deepEqual(mounted.workspace.getState().current.transactions, before.transactions);

  replacement.validity = { badInput: false };
  type(replacement, '');
  mounted.get('homeGameEditorForm').dispatch('submit');
  assert.equal(mounted.get('homeGameEditorDialog').open, false);
  await settle();
  assert.equal(mounted.get('homeGameConfirmDialog').open, true);
  mounted.get('homeGameConfirmDialog').close('confirm');
  await settle();
  const after = mounted.workspace.getState().current;
  assert.equal(after.transactions.length, before.transactions.length + 1);
  assert.equal(after.transactions.at(-1).type, 'correction');
  assert.equal(after.transactions.at(-1).correctionOfTransactionId, before.transactions[0].transactionId);
  assert.equal(after.accounting.participantResults.find((entry) => entry.playerId === ann).totalInMinor, 0);
});

test('New Session optional amounts reject invalid text inline and never start a session', async () => {
  const mounted = mountWorkspace();
  await settle();
  mounted.get('homeGamePlayerNames').value = 'Ann\nBen';
  mounted.get('homeGameInitialBuyIn').value = '100';
  const smallBlind = mounted.get('homeGameSmallBlind');
  smallBlind.validity = { badInput: true };
  mounted.get('homeGameNewSessionForm').dispatch('submit');
  await settle();
  assert.equal(mounted.workspace.getState().current, null);
  assert.equal(inlineError(smallBlind), 'Enter a valid amount.');
  assert.equal(mounted.document.activeElement, smallBlind);
  mounted.get('homeGameInitialBuyIn').value = '1.234';
  smallBlind.validity = { badInput: false };
  type(smallBlind, '');
  assert.equal(inlineError(smallBlind), null);
  mounted.get('homeGameNewSessionForm').dispatch('submit');
  await settle();
  assert.equal(mounted.workspace.getState().current, null);
  assert.equal(inlineError(mounted.get('homeGameInitialBuyIn')), 'Enter a valid amount.');
  mounted.get('homeGameInitialBuyIn').value = '';
  mounted.get('homeGameNewSessionForm').dispatch('submit');
  await settle();
  const current = mounted.workspace.getState().current;
  assert.equal(current.session.status, 'active');
  assert.equal(current.transactions.length, 0, 'an empty optional initial buy-in means no buy-in, never an invented amount');
});

test('Guest hides account-only controls and states that sessions are not kept after reload', async () => {
  const mounted = mountWorkspace();
  await settle();
  const { get } = mounted;
  assert.equal(get('homeGamePersistenceNotice').textContent, 'Guest sessions are not kept after reload. Sign in before starting a game you want to keep.');
  for (const id of ['homeGameSaveGroup', 'homeGameGroupName', 'homeGameShowArchivedGroups', 'homeGameShowArchivedSessions']) {
    assert.equal(get(id).closest('label').hidden, true, id);
  }
  assert.equal(get('homeGameAccountRoster').hidden, true);
  assert.equal(get('homeGameNewGroup').hidden, true);
  assert.equal(get('homeGameNewPlayer').closest('details').hidden, true);
  assert.equal(get('homeGameGuestRoster').hidden, false);
  assert.equal(get('homeGameGroups').textContent, 'Guest games have no durable player or group library.');

  mounted.auth.status = 'signed_in';
  mounted.browserWindow.emit('riverline:authchange');
  await settle();
  assert.equal(get('homeGamePersistenceNotice').textContent, 'Home Game data is private and stored locally for this account. Cloud sync is not enabled yet.');
  for (const id of ['homeGameSaveGroup', 'homeGameGroupName', 'homeGameShowArchivedGroups', 'homeGameShowArchivedSessions']) {
    assert.equal(get(id).closest('label').hidden, false, id);
  }
  assert.equal(get('homeGameAccountRoster').hidden, false);
  assert.equal(get('homeGameGuestRoster').hidden, true);
});

test('hidden Home Game controls cannot be resurrected by component display rules; Guest copy is localized', async () => {
  const [css, html, authBootstrap, homeGameTranslations, accountTranslations] = await Promise.all([
    readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/application/authentication-bootstrap.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/home-game-translations.js', import.meta.url), 'utf8'),
    readFile(new URL('../app/src/locales/account-translations.js', import.meta.url), 'utf8'),
  ]);
  assert.match(css, /\.home-game-workspace \[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\.home-game-field-error \{[^}]*grid-column: 1 \/ -1/);
  const settingsGuest = 'Your learning workspace is saved on this device. Guest Home Game sessions are not kept after reload.';
  assert.ok(html.includes(`id="settingsAccountDescription" class="panel-note" data-i18n="${settingsGuest}"`));
  assert.ok(authBootstrap.includes(`: '${settingsGuest}'`));
  assert.equal(accountTranslations.split(`'${settingsGuest}':`).length - 1, 3, 'EN/RU/HE');
  for (const key of [
    'Guest sessions are not kept after reload. Sign in before starting a game you want to keep.',
    'Enter an amount.',
    'Enter an amount greater than zero.',
    'Enter an amount greater than zero, or leave it empty to only reverse the entry.',
    'Enter a valid amount.',
    'Enter a whole chip count.',
  ]) {
    assert.equal(homeGameTranslations.split(`'${key}':`).length - 1, 2, `RU/HE ${key}`);
  }
  assert.doesNotMatch(homeGameTranslations, /Guest sessions stay only in this browser session/);
});
