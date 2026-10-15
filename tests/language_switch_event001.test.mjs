// LANGUAGE-SWITCH-EVENT-001: a language switch is a presentation event only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  authenticationOwnerKey,
  createAuthenticationOwnerChangeGuard,
} from '../app/src/application/authentication-owner-change.mjs';

import { bootApp, indexDocument, strategyProviderProbe, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: logic.js / index.html assertions run in the booted app
// (real authchange events, real language switches, spied page functions)
// instead of vm-evaluating slices of logic.js. Bootstrap sources are outside
// this ticket.
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });
// Imported after boot: the bootstrap module graph self-installs page bridges.
const { bindAuthenticationUi } = await import('../app/src/application/authentication-bootstrap.mjs');

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

test('logic.js clears Saved/Training owner state only when the owner actually changed', async () => {
  const spy = app.spy(['scheduleHomeRefresh', 'clearTrainingMemoryOwnerPresentation', 'refreshSavedStudySource']);
  const dispatch = async (detail) => {
    app.window.dispatchEvent(new app.window.CustomEvent('riverline:authchange', { detail }));
    await app.settle(50);
  };
  const ownerChanged = () => spy.calls.scheduleHomeRefresh.filter(([options]) => options?.clearPrivateState).length;
  try {
    await dispatch({ status: 'guest', signedIn: false, ownerKey: 'guest-language-1' });
    assert.equal(ownerChanged(), 1);
    assert.equal(spy.count('clearTrainingMemoryOwnerPresentation'), 1);
    const savedSource = spy.count('refreshSavedStudySource');
    await dispatch({ status: 'guest', signedIn: false, ownerKey: 'guest-language-1' });
    assert.equal(ownerChanged(), 1, 'same owner repeated: Saved ownerChanged must not run');
    assert.equal(spy.count('clearTrainingMemoryOwnerPresentation'), 1);
    assert.equal(spy.count('refreshSavedStudySource'), savedSource);
    await dispatch({ status: 'signed_in', signedIn: true, ownerKey: 'account-a' });
    assert.equal(ownerChanged(), 2, 'real sign-in clears private state');
    assert.equal(spy.calls.scheduleHomeRefresh.at(-1)[0].clearPrivateState, true);
    assert.equal(spy.count('clearTrainingMemoryOwnerPresentation'), 2);
    await dispatch({ status: 'guest', signedIn: false });
    await dispatch({ status: 'guest', signedIn: false });
    assert.equal(ownerChanged(), 4, 'events without ownerKey keep clearing exactly as before');
  } finally {
    spy.restore();
  }
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
const SOURCE_IDS = ['trainingStrategySource', 'trainingReferenceSummaryValue', 'trainingReferenceSummaryNote'];
// An element is safe across a language switch when it is either unkeyed or
// its text is exactly the translation of its key (so re-translation cannot
// replace a written claim with a placeholder).
function assertSourceElementsKeyedOrUnkeyed(label) {
  for (const id of SOURCE_IDS) {
    const element = app.byId(id);
    if (element.dataset.i18n) assert.equal(element.textContent, app.call('t', element.dataset.i18n), `${label}: ${id} keyed`);
  }
}

test('Training source badge and baseline panel keep the same claim across EN → RU → HE → EN', async () => {
  await app.training.start('focused');
  const badge = app.byId('trainingStrategySource');
  const value = app.byId('trainingReferenceSummaryValue');
  const claim = text(badge);
  assert.ok(claim);
  assert.notEqual(claim, 'Source unavailable');
  const key = Object.keys(DICTIONARY.en).find((candidate) => DICTIONARY.en[candidate] === claim) || claim;
  for (const language of ['ru', 'he', 'en']) {
    app.window.setLanguage(language);
    await app.settle(50);
    assert.equal(text(badge), app.call('t', key), `${language} badge`);
    assert.equal(text(value), app.call('t', key), `${language} baseline value`);
    assert.notEqual(text(badge), app.call('t', 'Source unavailable'));
  }
});

test('every Training source writer keys or unkeys the element instead of raw textContent', async () => {
  // The placeholder markup is the hazard this guards.
  assert.equal(indexDocument().getElementById('trainingStrategySource').dataset.i18n, 'Source unavailable');
  await app.training.start('focused');
  assertSourceElementsKeyedOrUnkeyed('exercise');
  await app.training.answer();
  assertSourceElementsKeyedOrUnkeyed('feedback');
  await app.training.next();
  assertSourceElementsKeyedOrUnkeyed('next exercise');
  for (const language of ['ru', 'he', 'en']) {
    app.window.setLanguage(language);
    await app.settle(50);
    assertSourceElementsKeyedOrUnkeyed(language);
  }
});

test('language refresh re-renders an open Training review from its existing model only', async () => {
  await app.training.playFullHand();
  await app.click('#trainingReviewHand');
  await app.settle(300);
  assert.equal(app.window.app.handReview.source, 'training_full_hand');
  const model = app.window.app.handReview.model;
  const spy = app.spy([
    'refreshLocalizedTrainingRuntime', 'renderFullHandTrainingSnapshot', 'renderActiveHandReview', 'refreshActiveHandReviewModel', 'schedulePlaybookUpdate',
    'scheduleHomeRefresh', 'clearSavedOwnerPresentation', 'clearTrainingMemoryOwnerPresentation',
  ].filter((name) => app.evaluate(`typeof ${name}`) === 'function'));
  try {
    const resolves = await probe.count(async () => {
      for (const language of ['ru', 'he', 'en']) {
        app.window.setLanguage(language);
        await app.settle(50);
      }
    });
    assert.equal(resolves.length, 0, 'no strategy is resolved on a language switch');
    assert.equal(spy.count('refreshLocalizedTrainingRuntime'), 3, 'every switch completes the localized refresh');
    assert.equal(spy.count('renderActiveHandReview'), 3, 'the open review re-renders');
    for (const name of ['refreshActiveHandReviewModel', 'schedulePlaybookUpdate', 'scheduleHomeRefresh', 'clearSavedOwnerPresentation', 'clearTrainingMemoryOwnerPresentation']) {
      if (spy.calls[name]) assert.equal(spy.count(name), 0, name);
    }
  } finally {
    spy.restore();
  }
  assert.equal(app.window.app.handReview.source, 'training_full_hand');
  assert.equal(app.window.app.handReview.model, model, 'the review keeps its existing model');
});
