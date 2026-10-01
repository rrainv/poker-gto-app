// LANGUAGE-SWITCH-EVENT-001: a language switch is a presentation event only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { bindAuthenticationUi } from '../app/src/application/authentication-bootstrap.mjs';
import {
  authenticationOwnerKey,
  createAuthenticationOwnerChangeGuard,
} from '../app/src/application/authentication-owner-change.mjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const LOGIC = read('../app/src/core/logic.js');
const INDEX = read('../app/index.html');

function runtimeFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing runtime function ${name}`);
  const open = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated runtime function ${name}`);
}

const DICTIONARY = {
  en: {},
  ru: { 'Heuristic fallback': 'Эвристический резерв', 'Source unavailable': 'Источник недоступен', 'Guest Mode': 'Гостевой режим', 'Hidden until review': 'Скрыто до разбора' },
  he: { 'Heuristic fallback': 'גיבוי היוריסטי', 'Source unavailable': 'המקור אינו זמין', 'Guest Mode': 'מצב אורח', 'Hidden until review': 'מוסתר עד הסקירה' },
};

function fakeElement(document, dataset = {}) {
  const element = new EventTarget();
  return Object.assign(element, {
    hidden: true, inert: false, disabled: false, value: '', textContent: '', dataset: { ...dataset }, className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {}, removeAttribute() {}, getAttribute: () => null, hasAttribute: () => false,
    focus() {}, reportValidity: () => true, contains: () => false, getClientRects: () => [],
    querySelector: (selector) => document.querySelector(selector),
    querySelectorAll: () => [],
    append() {},
  });
}

function authenticationHarness() {
  const elements = new Map();
  const document = new EventTarget();
  Object.assign(document, {
    readyState: 'complete', activeElement: null,
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, fakeElement(document));
      return elements.get(selector);
    },
  });
  document.body = fakeElement(document);
  const browserWindow = new EventTarget();
  let lifecycle = { status: 'guest_active', identityId: 'guest-1', lifecycleGeneration: 1 };
  browserWindow.document = document;
  browserWindow.requestAnimationFrame = () => 0;
  browserWindow.RiverlineAccountIdentity = { getLifecycleState: () => lifecycle };
  let state = { status: 'guest', profile: null, noticeCode: null };
  const listeners = new Set();
  const service = {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    initialize: async () => state,
    emit(next, nextLifecycle = lifecycle) { state = next; lifecycle = nextLifecycle; for (const listener of listeners) listener(state); },
  };
  const gate = { subscribe() {}, cancelPendingIntent() {} };
  const published = [];
  browserWindow.addEventListener('riverline:authchange', (event) => published.push(event.detail));
  return { browserWindow, document, service, gate, published };
}

async function withLanguage(run) {
  const previous = globalThis.t;
  let language = 'en';
  globalThis.t = (key) => DICTIONARY[language][key] ?? key;
  try {
    return await run({ setLanguage(value) { language = value; } });
  } finally {
    globalThis.t = previous;
  }
}

test('a language switch re-renders account copy but dispatches no identity/auth event', async () => {
  await withLanguage(async ({ setLanguage }) => {
    const h = authenticationHarness();
    let identityEvents = 0;
    h.browserWindow.addEventListener('riverline:identitychange', () => { identityEvents += 1; });
    bindAuthenticationUi(h.browserWindow, h.service, h.gate);
    await Promise.resolve(); await Promise.resolve();
    const baseline = h.published.length;
    assert.ok(baseline >= 1, 'initial authentication state is still published');

    for (const language of ['ru', 'he', 'en', 'he']) {
      setLanguage(language);
      h.browserWindow.dispatchEvent(new CustomEvent('riverline:languagechange', { detail: { language } }));
      assert.equal(h.document.querySelector('#accountMenuDisplayName').textContent, DICTIONARY[language]['Guest Mode'] ?? 'Guest Mode');
    }
    assert.equal(h.published.length, baseline, 'language switch published riverline:authchange');
    assert.equal(identityEvents, 0);
  });
});

test('a real authentication change still publishes with a distinct owner key', async () => {
  await withLanguage(async () => {
    const h = authenticationHarness();
    bindAuthenticationUi(h.browserWindow, h.service, h.gate);
    await Promise.resolve(); await Promise.resolve();
    const guestKey = h.published.at(-1).ownerKey;
    h.service.emit(
      { status: 'signed_in', profile: { displayName: 'A', username: 'a' }, noticeCode: null },
      { status: 'account_active', identityId: 'account-a', lifecycleGeneration: 2 },
    );
    const signedIn = h.published.at(-1);
    assert.equal(signedIn.status, 'signed_in');
    assert.equal(signedIn.signedIn, true);
    assert.notEqual(signedIn.ownerKey, guestKey);
    h.service.emit({ status: 'guest', profile: null, noticeCode: null },
      { status: 'guest_active', identityId: 'guest-1', lifecycleGeneration: 3 });
    assert.equal(h.published.at(-1).status, 'guest');
    assert.notEqual(h.published.at(-1).ownerKey, signedIn.ownerKey);
  });
});

test('owner key changes with status, sign-in, identity and generation only', () => {
  const guest = { status: 'guest', profile: null, noticeCode: null };
  const lifecycle = { status: 'guest_active', identityId: 'g', lifecycleGeneration: 1 };
  const key = authenticationOwnerKey(guest, lifecycle);
  assert.equal(authenticationOwnerKey({ ...guest, noticeCode: 'display_name_saved' }, { ...lifecycle }), key);
  assert.notEqual(authenticationOwnerKey({ ...guest, status: 'authenticating' }, lifecycle), key);
  assert.notEqual(authenticationOwnerKey(guest, { ...lifecycle, identityId: 'h' }), key);
  assert.notEqual(authenticationOwnerKey(guest, { ...lifecycle, lifecycleGeneration: 2 }), key);
  assert.notEqual(authenticationOwnerKey({ status: 'signed_in', profile: { username: 'a' } }, lifecycle), key);
});

test('owner-change guard ignores a repeated owner but never a real or legacy change', () => {
  const changed = createAuthenticationOwnerChangeGuard();
  const event = (ownerKey) => ({ detail: ownerKey === undefined ? undefined : { ownerKey } });
  assert.equal(changed(event('a')), true);
  assert.equal(changed(event('a')), false);
  assert.equal(changed(event('b')), true);
  assert.equal(changed(event('a')), true, 'switching back is an owner change');
  assert.equal(changed(event(undefined)), true, 'legacy events without ownerKey always clear');
  assert.equal(changed(event(undefined)), true);
  assert.equal(changed(event('a')), true);
});

function logicAuthListener() {
  const marker = "window.addEventListener('riverline:authchange', ";
  const start = LOGIC.indexOf(marker);
  assert.notEqual(start, -1);
  const body = LOGIC.slice(start + marker.length, LOGIC.indexOf("window.addEventListener('riverline:trainingmemoryready'", start));
  return body.trim().replace(/\);$/, '');
}

function logicAuthHarness() {
  const calls = { homeRefresh: [], trainingCleared: 0, savedSource: 0, ownerChanged: 0 };
  const context = {
    calls, $: () => null,
    scheduleHomeRefresh(options) { calls.homeRefresh.push(options); if (options?.clearPrivateState) calls.ownerChanged += 1; },
    clearTrainingMemoryOwnerPresentation() { calls.trainingCleared += 1; },
    refreshTrainingMemoryPanel() {},
    refreshSavedStudySource() { calls.savedSource += 1; },
    activeWorkspaceMode: () => 'gto',
  };
  vm.createContext(context);
  vm.runInContext(`${runtimeFunction(LOGIC, 'authenticationOwnerChanged')}
    ${LOGIC.match(/let lastAuthenticationOwnerKey[^;]*;/)[0]}
    this.listener = ${logicAuthListener()};`, context);
  return { calls, dispatch: (detail) => context.listener({ detail }) };
}

test('logic.js clears Saved/Training owner state only when the owner actually changed', () => {
  const h = logicAuthHarness();
  h.dispatch({ status: 'guest', signedIn: false, ownerKey: 'guest-1' });
  assert.equal(h.calls.ownerChanged, 1);
  assert.equal(h.calls.trainingCleared, 1);
  h.dispatch({ status: 'guest', signedIn: false, ownerKey: 'guest-1' });
  assert.equal(h.calls.ownerChanged, 1, 'same owner repeated: Saved ownerChanged must not run');
  assert.equal(h.calls.trainingCleared, 1);
  assert.equal(h.calls.savedSource, 1);
  h.dispatch({ status: 'signed_in', signedIn: true, ownerKey: 'account-a' });
  assert.equal(h.calls.ownerChanged, 2, 'real sign-in clears private state');
  assert.equal(h.calls.homeRefresh.at(-1).clearPrivateState, true);
  assert.equal(h.calls.trainingCleared, 2);
  h.dispatch({ status: 'guest', signedIn: false });
  h.dispatch({ status: 'guest', signedIn: false });
  assert.equal(h.calls.ownerChanged, 4, 'events without ownerKey keep clearing exactly as before');
});

test('Home Game and Study inbox route authchange through the owner-change guard', () => {
  const homeGame = read('../app/src/application/home-game-bootstrap.mjs');
  const study = read('../app/src/application/study-workspace-bootstrap.mjs');
  for (const source of [homeGame, study]) {
    assert.match(source, /createAuthenticationOwnerChangeGuard/);
    assert.match(source, /addEventListener\('riverline:authchange', \(event\) => \{ if \(authenticationOwnerChanged\(event\)\)/);
    assert.match(source, /addEventListener\('riverline:identitychange', (refresh|clear)\)/, 'identity changes stay unguarded');
  }
});

// Training source claim: static data-i18n placeholders must never overwrite a written claim.
function fakeSourceElement(key) {
  return { textContent: key || '', title: '', className: '', hidden: false, dataset: key ? { i18n: key } : {} };
}

function trainingSourceHarness() {
  const elements = new Map([
    ['#trainingStrategySource', fakeSourceElement('Source unavailable')],
    ['#trainingReferenceSummaryTitle', fakeSourceElement('Strategy source')],
    ['#trainingReferenceSummaryValue', fakeSourceElement('Source unavailable')],
    ['#trainingReferenceSummaryNote', fakeSourceElement('A source summary appears with each exercise.')],
    ['#trainingSourceLimitation', fakeSourceElement(null)],
  ]);
  let language = 'en';
  const t = (key, values = {}) => String(DICTIONARY[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  const descriptor = { id: 'heuristic_fallback', displayNameKey: 'Heuristic fallback', family: 'heuristic' };
  const context = {
    t, app: { training: { memoryRedrillNote: '' } },
    $: (selector) => elements.get(selector) || null,
    requireStrategyProviderBridge: () => ({ sourceDescriptorFor: () => descriptor }),
    trainingTruth: () => ({ claimPolicy: { source: descriptor, primaryLimitation: null } }),
    truthPresentation: () => ({ sourceLabel: 'Strategy source' }),
    trainingSameSpotIsActive: () => false,
    sameSpotSourceRole: () => 'Strategy source',
    localizedStrategyLimitation: () => '',
    strategyPolicySummary: () => t('Heuristic fallback'),
  };
  vm.createContext(context);
  vm.runInContext(['strategySourceDisplayKey', 'strategySourceDisplayLabel', 'setSourceClaimText', 'renderTrainingSource']
    .map((name) => runtimeFunction(LOGIC, name)).join('\n'), context);
  return {
    elements,
    render: (exercise) => context.renderTrainingSource(exercise),
    // The i18n runtime re-translates every [data-i18n] element on setLanguage().
    switchLanguage(value) {
      language = value;
      for (const element of elements.values()) if (element.dataset.i18n) element.textContent = t(element.dataset.i18n);
    },
    t,
  };
}

test('Training source badge and baseline panel keep the same claim across EN → RU → HE → EN', () => {
  const h = trainingSourceHarness();
  h.render({ seed: 7, strategyResult: { source: 'heuristic_fallback', sourceVersion: '1' } });
  const badge = h.elements.get('#trainingStrategySource');
  const value = h.elements.get('#trainingReferenceSummaryValue');
  assert.equal(badge.textContent, 'Heuristic fallback');
  for (const language of ['ru', 'he', 'en']) {
    h.switchLanguage(language);
    assert.equal(badge.textContent, h.t('Heuristic fallback'), `${language} badge`);
    assert.equal(value.textContent, h.t('Heuristic fallback'), `${language} baseline value`);
    assert.notEqual(badge.textContent, h.t('Source unavailable'));
  }
});

test('every Training source writer keys or unkeys the element instead of raw textContent', () => {
  assert.match(INDEX, /id="trainingStrategySource"[^>]*data-i18n="Source unavailable"/, 'placeholder markup is the hazard this guards');
  for (const id of ['trainingStrategySource', 'trainingReferenceSummaryValue', 'trainingReferenceSummaryNote']) {
    assert.doesNotMatch(LOGIC, new RegExp(`\\$\\('#${id}'\\)\\.textContent\\s*=`), `${id} raw write`);
    assert.doesNotMatch(LOGIC, new RegExp(`(sourceElement|referenceValue|referenceNote)\\.textContent\\s*=`), 'aliased raw write');
  }
});

test('language refresh re-renders an open Training review from its existing model only', () => {
  const body = runtimeFunction(LOGIC, 'refreshLocalizedTrainingRuntime');
  assert.match(body, /app\.handReview\.source === 'training_full_hand' && app\.handReview\.model/);
  assert.doesNotMatch(body, /refreshActiveHandReviewModel|strategyProvider\.resolve|schedulePlaybookUpdate|equity/i);
  const runtime = runtimeFunction(LOGIC, 'refreshLocalizedRuntime');
  assert.doesNotMatch(runtime, /authchange|scheduleHomeRefresh|clearSavedOwnerPresentation|clearTrainingMemoryOwnerPresentation/);
});
