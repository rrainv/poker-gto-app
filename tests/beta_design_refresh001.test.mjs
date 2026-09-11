import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createTableCast, mountTableEnvironment, OPPONENT_IDENTITIES, tableEnvironmentCopy, opponentPortrait, opponentSubtitle } from '../app/src/ui/table-environment.mjs';
import { bindDisclosureDismissal } from '../app/src/ui/study-disclosure.mjs';
import { createOpponentPracticeWorkspace } from '../app/src/application/opponent-practice-workspace.mjs';
import { mountAdvancedEquity } from '../app/src/application/advanced-equity-workspace.mjs';
import { advancedEquityCopy } from '../app/src/application/advanced-equity-language.mjs';
import { installTrainingLineupPreview } from '../app/src/ui/training-lineup-preview.mjs';
import { renderPersonalStrategyMap } from '../app/src/application/personal-strategy-understanding-workspace.mjs';

// Mounted presentation harness. Native select/summary mechanics and geometry
// still require the separately recorded real-browser/human acceptance.
class Element {
  constructor(tag, doc) {
    this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {};
    this.listeners = []; this._text = ''; this._value = undefined; this.open = false; this.style = {};
  }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(' '); }
  set value(value) { this._value = String(value); }
  get value() { return this._value ?? (this.tagName === 'select' ? this.children[0]?.value ?? '' : ''); }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; this._text = ''; this.append(...nodes); }
  setAttribute(key, value) { this[key] = String(value); }
  getAttribute(key) { return this[key] ?? null; }
  removeAttribute(key) { delete this[key]; }
  toggleAttribute(key, force) { if (force) this.setAttribute(key, ''); else this.removeAttribute(key); }
  addEventListener(type, handler, { signal } = {}) { this.listeners.push({ type, handler, signal }); }
  matches(selector) {
    if (selector === 'details[open]') return this.tagName === 'details' && this.open;
    if (selector === '[data-opponent-copy]') return !!this.dataset.opponentCopy;
    if (selector === '[data-display-player]') return !!this.dataset.displayPlayer;
    const data = selector.match(/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/);
    if (data) { const key = data[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return Object.hasOwn(this.dataset, key) && (data[2] === undefined || this.dataset[key] === data[2]); }
    return selector.startsWith('.') ? this.className?.split(' ').includes(selector.slice(1))
      : selector.startsWith('#') ? this.id === selector.slice(1) : this.tagName === selector;
  }
  querySelectorAll(selector) { return descendants(this).slice(1).filter(node => node.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
  contains(node) { return descendants(this).includes(node); }
  focus() { this.ownerDocument.activeElement = this; }
  async fire(type, extra = {}) {
    const event = { target: this, defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...extra };
    for (let node = this; node; node = node.parentElement) {
      for (const listener of node.listeners) if (listener.type === type && !listener.signal?.aborted) await listener.handler(event);
      if (event.propagationStopped) break;
    }
    return event;
  }
}
test('idle Full Hand preview reacts to setup, hides outside Full Hand, and retains portrait/policy separation in every language', () => {
  for (const language of ['en', 'ru', 'he']) {
    const f = documentFixture(language), root = f.root('trainingLineupPreview');
    f.root('trainingSetupPanel');
    f.root('opponentStudyQuestion').textContent = 'Focus: price';
    f.root('opponentPolicyDescription').textContent = 'Calling-heavy assumption';
    const view = installTrainingLineupPreview(f.win);
    const config = { mode: 'full_hand', playerCount: 8, heroPosition: 'BTN', stack: 40, assistance: 'Guided' };
    view.update(config);
    assert.equal(root.hidden, false); assert.equal(root.querySelectorAll('li').length, 8);
    assert.equal(root.querySelector('ul').querySelectorAll('img').length, 7);
    assert.equal(root.querySelectorAll('img').length, 8, 'Selected opponent also has a preview portrait');
    assert.match(root.textContent, /Hero BTN · 40 bb/);
    assert.equal(root.querySelector('ul').querySelectorAll('button').length, 7);
    const roster = root.querySelector('ul'); view.update(config); assert.equal(root.querySelector('ul'), roster);
    view.update({ ...config, playerCount: 2, stack: 100 });
    assert.equal(root.querySelectorAll('li').length, 2); assert.match(root.textContent, /100 bb/);
    view.update({ ...config, mode: 'focused' }); assert.equal(root.hidden, true);
    assert.equal(root.querySelectorAll('.riverline-card').length, 0);
  }
});

test('lineup seat controls retain independent policy, character and current Custom values without rebuilding the roster', async () => {
  const f = documentFixture(), root = f.root('trainingLineupPreview'); f.root('trainingSetupPanel');
  const view = installTrainingLineupPreview(f.win);
  view.update({ mode: 'full_hand', playerCount: 6, heroPosition: 'BTN', stack: 100, assistance: 'Guided' });
  const roster = root.querySelector('ul');
  await roster.querySelectorAll('button')[1].fire('click');
  const selected = view.selectedRequest(42).target, before = view.requests(42);
  const character = root.querySelector('[data-lineup-character]'); character.value = 'cleo'; await character.fire('change');
  assert.deepEqual(view.requests(42), before);
  const policy = root.querySelector('[data-lineup-policy]'); policy.value = 'aggressive'; await policy.fire('change');
  policy.value = 'custom'; await policy.fire('change');
  assert.equal(view.selectedRequest(42).configuration.parameters.freeAggressionPercent, 65);
  assert.equal(view.requests(42).find(entry => entry.request.target !== selected).request.configuration.parameters.freeAggressionPercent, 15);
  assert.equal(root.querySelector('ul'), roster);
});

test('read-only Personal coverage map counts evidence states without assigning unknown frequencies', () => {
  const f = documentFixture(), root = f.root(); const previous = globalThis.document; globalThis.document = f.doc;
  try {
    renderPersonalStrategyMap(root, [{ status: 'directly_known' }, { status: 'unknown' }, { status: 'unknown' }, { status: 'conflicting' }], key => key);
    assert.match(root.textContent, /Specified · 1/); assert.match(root.textContent, /Unknown · 2/);
    assert.match(root.textContent, /Conflicts · 1/); assert.equal(root.querySelectorAll('button').length, 0);
    assert.equal(root.querySelector('.personal-map-bar')['aria-hidden'], 'true');
    assert.equal(root.querySelectorAll('[data-display-player]').length, 0);
    renderPersonalStrategyMap(root, [
      { status: 'directly_known', action: { precision: 'pure_explicit' } },
      { status: 'directly_known', action: { precision: 'exact_mix' } },
      { status: 'directly_known', action: { precision: 'tied_exact_mix' } },
      { status: 'directly_known', action: { precision: 'dominant_only' } },
      { status: 'inferred_high', action: { precision: 'exact_mix' } },
      { status: 'unknown' },
    ], key => key);
    assert.equal(root.querySelector('.personal-map-precision').textContent, 'Exact-frequency evidence · 3');
    renderPersonalStrategyMap(root, [], key => key); assert.equal(root.hidden, true); assert.equal(root.children.length, 0);
  } finally { globalThis.document = previous; }
});

test('Advanced Equity names remain human-facing and rename without invalidating or calculating', async () => {
  const f = documentFixture(), root = f.root(); let name = 'Ada', calls = 0;
  const source = { schemaVersion: 'equity-request/v1', players: [{ id: 'equity-player-0', cards: ['As', 'Ad'] }, { id: 'equity-player-1', cards: ['Ks', 'Kd'] }], board: [], deadCards: [], seed: 1 };
  const view = mountAdvancedEquity({ root, getRequest: () => source, getPlayerLabel: (_id, index) => index === 1 ? name : null,
    controller: { calculate() { calls++; }, cancel() {}, dispose() {} } });
  const panel = root.querySelector('details'); panel.open = true; await panel.fire('toggle');
  assert.match(root.textContent, /Hero/); assert.match(root.textContent, /Ada/); assert.doesNotMatch(root.textContent, /equity-player-/);
  name = 'Lea'; view.refreshLabels(); assert.match(root.textContent, /Lea/); assert.doesNotMatch(root.textContent, /Ada/);
  assert.equal(calls, 0); view.dispose();
});

const descendants = root => [root, ...root.children.flatMap(descendants)];
function documentFixture(language = 'en') {
  const roots = [], events = new Map();
  const doc = { documentElement: { lang: language, dataset: {} }, activeElement: null,
    createElement: tag => new Element(tag, doc),
    getElementById: id => roots.flatMap(descendants).find(node => node.id === id),
    addEventListener() {} };
  const win = { document: doc, appLang: language, addEventListener(type, callback, { signal } = {}) {
    if (!events.has(type)) events.set(type, []); events.get(type).push({ callback, signal });
  } };
  doc.defaultView = win;
  const root = (id = '') => { const node = doc.createElement('div'); node.id = id; roots.push(node); return node; };
  return { doc, win, root, events, async emit(type) {
    for (const { callback, signal } of events.get(type) ?? []) if (!signal?.aborted) await callback();
  } };
}
function seats(count = 6) {
  return Array.from({ length: count }, (_, seat) => ({ seat, visualSeatIndex: (seat + 1) % count, playerId: `p${seat}`,
    isHero: seat === (count > 2 ? 2 : 0), position: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'][seat] ?? '—',
    isCurrentActor: seat === 1, isButton: seat === count - 1, suppliedName: null,
    currentStackMilliBb: 100000, streetContributionMilliBb: 0, cardVisibility: 'hidden',
    get cards() { throw new Error('Appearance must never inspect private cards'); } }));
}

test('cast assignment follows canonical seats across visual changes, excludes Hero, and resets out of synthetic play', () => {
  for (const count of [2, 4, 6, 10]) {
    const roster = seats(count), cast = createTableCast(); cast.sync(roster, true);
    const opponents = roster.filter(player => !player.isHero);
    const target = opponents[0].seat;
    assert.equal(new Set(opponents.map(player => cast.identity(player.seat))).size, opponents.length);
    assert.ok(cast.select(target, 'sol')); assert.equal(cast.select(target, 'nonexistent'), false);
    assert.equal(cast.select(99, 'mika'), false);
    assert.equal(cast.select(roster.find(player => player.isHero).seat, 'mika'), false);
    cast.sync(roster.toReversed(), true); assert.equal(cast.identity(target), 'sol');
    cast.sync(roster, false); assert.equal(cast.identity(target), null);
    cast.sync(roster, true); assert.equal(cast.identity(target), 'mika');
  }
});

test('mounted EN/RU/HE cast changes names independently, retains focused controls on action updates, and leaves policy requests exact', async () => {
  for (const language of ['en', 'ru', 'he']) {
    const f = documentFixture(language); f.root('trainingOpponentSetup'); f.root('trainingOpponentReview');
    const policies = createOpponentPracticeWorkspace(f.win); policies.renderSetup(true);
    f.doc.getElementById('trainingOpponentTarget').value = 'BB';
    const before = policies.readTrainingIntent({ tableSize: 6 });
    const root = f.root(), roster = seats(); let repaint = 0;
    const cast = mountTableEnvironment({ root, language: () => f.doc.documentElement.lang, onChange: () => repaint++ });
    cast.update({ seats: roster }, { synthetic: true });
    assert.equal(root.dir, language === 'he' ? 'rtl' : 'ltr');
    const selects = root.querySelectorAll('select'); assert.equal(selects.length, 5);
    selects[0].focus(); selects[0].value = 'sol'; await selects[0].fire('change');
    selects[1].value = 'nova'; await selects[1].fire('change');
    assert.equal(cast.identity(roster[0]), 'sol'); assert.equal(cast.identity(roster[1]), 'nova');
    assert.equal(repaint, 2); assert.deepEqual(policies.readTrainingIntent({ tableSize: 6 }), before);
    cast.update({ seats: roster }, { synthetic: true });
    assert.equal(root.querySelectorAll('select')[0], selects[0]); assert.equal(f.doc.activeElement, selects[0]);
    assert.ok(root.textContent.includes(tableEnvironmentCopy('appearance', language)));
    f.doc.documentElement.lang = language === 'he' ? 'en' : 'he'; cast.update({ seats: roster }, { synthetic: true });
    assert.equal(root.querySelectorAll('select')[0].value, 'sol');
    const current = root.querySelectorAll('select')[0]; cast.dispose(); await current.fire('change');
    assert.equal(repaint, 2); assert.equal(root.children.length, 0);
  }
});

test('dealer and actor facts use only projected flags, and ordinary Hands receive no fictional identity', () => {
  const f = documentFixture(), root = f.root(), cast = mountTableEnvironment({ root });
  const roster = seats(); cast.update({ seats: roster }, { synthetic: false });
  assert.equal(root.querySelector('details').hidden, true); assert.equal(cast.identity(roster[0]), null);
  const facts = root.querySelector('.table-environment-facts'); assert.match(facts.textContent, /BB/); assert.match(facts.textContent, /BTN/);
  roster.forEach(player => { player.isButton = false; player.isCurrentActor = false; });
  cast.update({ seats: roster }); assert.equal(facts.children.length, 0);
  cast.update({ seats: [] }); assert.equal(root.hidden, true);
});

test('cast repaint changes shared table names and accessibility without rendering cards or recomputing state', () => {
  const f = documentFixture(), sandbox = { window: {}, document: f.doc };
  vm.runInNewContext(fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8'), sandbox);
  const renderer = Object.create(sandbox.window.TableRenderer.prototype), container = f.root(), roster = seats();
  renderer.container = container; renderer.lastState = { seats: roster, street: 'flop', potMilliBb: 4000 };
  for (const player of roster) { const group = f.doc.createElement('g'); group.id = `seat-${player.visualSeatIndex}`;
    const name = f.doc.createElement('text'); name.className = 'table-seat-name'; group.append(name); container.append(group); }
  const description = f.doc.createElement('desc'); description.id = 'poker-table-description'; container.append(description);
  const cast = createTableCast(); cast.sync(roster, true); cast.select(0, 'sol');
  renderer.environment = { identity: player => cast.identity(player.seat), name: () => 'Sol' };
  renderer.refreshSeatIdentities();
  assert.equal(container.querySelector('#seat-1').querySelector('text').textContent, 'Sol');
  assert.match(container.querySelector('#seat-1')['aria-label'], /Sol/);
  assert.match(description.textContent, /Pot 4 bb/); assert.equal(renderer.lastState.seats, roster);
});

test('Escape closes the innermost disclosure and restores focus without changing a draft', async () => {
  const f = documentFixture(), outer = f.root(), summary = f.doc.createElement('summary'); outer.tagName = 'details'; outer.open = true;
  const inner = f.doc.createElement('details'), innerSummary = f.doc.createElement('summary'), input = f.doc.createElement('input');
  inner.open = true; input.value = 'keep draft'; inner.append(innerSummary, input); outer.append(summary, inner);
  bindDisclosureDismissal(outer); input.focus();
  const event = await input.fire('keydown', { key: 'Escape' });
  assert.equal(event.defaultPrevented, true); assert.equal(inner.open, false); assert.equal(outer.open, true);
  assert.equal(f.doc.activeElement, innerSummary); assert.equal(input.value, 'keep draft');
  await innerSummary.fire('keydown', { key: 'Escape' }); assert.equal(outer.open, false); assert.equal(f.doc.activeElement, summary);
});

test('wide Equity composer remains lazy; Escape/cancel fences late results and preserves range drafts', async () => {
  const f = documentFixture(), root = f.root(); let reads = 0, calls = 0, complete;
  const source = { schemaVersion: 'equity-request/v1', players: [{ id: 'hero', cards: ['As', 'Ad'] }, { id: 'opponent', cards: null }], board: ['Kh', 'Qh', '3c'], deadCards: [], seed: 1, method: 'auto', samples: 10 };
  const workspace = mountAdvancedEquity({ root, getRequest() { reads++; return source; },
    controller: { calculate() { calls++; return new Promise(resolve => { complete = resolve; }); }, cancel() {}, dispose() {} } });
  assert.equal(reads, 0); assert.equal(calls, 0);
  assert.equal(root.querySelector('.advanced-equity-explorer').open, true);
  const panel = root.querySelector('details'); panel.open = true; await panel.fire('toggle');
  const textarea = root.querySelector('textarea'); textarea.value = 'AA:1'; await textarea.fire('input');
  const run = root.querySelectorAll('button').find(node => node.textContent === advancedEquityCopy('calculate'));
  const cancel = root.querySelectorAll('button').find(node => node.textContent === advancedEquityCopy('cancel'));
  assert.equal(cancel.hidden, true); const pending = run.fire('click'); assert.equal(cancel.hidden, false);
  await run.fire('keydown', { key: 'Escape' }); await panel.fire('toggle');
  assert.equal(panel.open, false); assert.equal(f.doc.activeElement, panel.querySelector('summary'));
  complete({ players: [{ id: 'stale', equity: 1 }], coverage: [], method: 'exact' }); await pending;
  assert.ok(!root.textContent.includes('stale')); assert.equal(cancel.hidden, true);
  panel.open = true; await panel.fire('toggle'); assert.equal(root.querySelector('textarea').value, 'AA:1');
  assert.equal(calls, 1);
  const second = run.fire('click'); cancel.focus(); await cancel.fire('click');
  assert.equal(f.doc.activeElement, run); assert.equal(cancel.hidden, true);
  complete({ players: [{ id: 'cancelled', equity: 1 }], coverage: [], method: 'exact' }); await second;
  assert.ok(!root.textContent.includes('cancelled')); workspace.dispose();
});

test('every fictional identity has a short localized name and descriptor', () => {
  for (const language of ['en', 'ru', 'he']) for (const id of OPPONENT_IDENTITIES) {
    const [name, descriptor] = tableEnvironmentCopy(id, language).split(' · ');
    assert.ok(name.length <= 6); assert.ok(descriptor.length > 3);
  }
});

test('every cast identity resolves to original packaged portrait art and a localized subtitle', () => {
  const portraits = OPPONENT_IDENTITIES.map(opponentPortrait);
  assert.equal(new Set(portraits).size, 10);
  for (const url of portraits) {
    const webp = fs.readFileSync(new URL(url));
    assert.equal(webp.subarray(8, 12).toString(), 'WEBP');
  }
  for (const language of ['en', 'ru', 'he']) {
    const f = documentFixture(language), root = f.root();
    const cast = mountTableEnvironment({ root, language: () => language });
    const roster = seats(); cast.update({ seats: roster }, { synthetic: true });
    const player = roster.find(player => !player.isHero);
    assert.equal(root.querySelector('img').src, cast.portrait(player));
    assert.equal(cast.subtitle(player), opponentSubtitle(cast.identity(player), language));
    assert.ok(cast.subtitle(player));
    cast.update({ seats: roster }, { synthetic: false });
    assert.equal(cast.portrait(player), ''); assert.equal(cast.subtitle(player), '');
    cast.dispose();
  }
  assert.equal(opponentPortrait('../../outside'), '');
});

test('seat portrait repaint follows only its assigned seat and removes fictional art outside practice', () => {
  const f = documentFixture(), sandbox = { window: {}, document: f.doc };
  vm.runInNewContext(fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8'), sandbox);
  const renderer = Object.create(sandbox.window.TableRenderer.prototype), group = f.root();
  for (const [tag, cls] of [['image', 'table-seat-portrait'], ['text', 'table-seat-subtitle'], ['text', 'table-seat-name'], ['text', 'table-seat-position']]) {
    const child = f.doc.createElement(tag); child.className = cls;
    child.dataset = { maxWidth: '56', normalY: '-4', portraitX: '-30', portraitY: '25' }; group.append(child);
  }
  let selected = 'fern';
  renderer.environment = { portrait: () => opponentPortrait(selected), subtitle: () => opponentSubtitle(selected, 'he') };
  renderer.paintSeatPortrait(group, { seat: 7 });
  assert.equal(group.querySelector('image').href, opponentPortrait('fern'));
  assert.equal(group.querySelector('.table-seat-position').x, '-30');
  selected = 'sol'; renderer.paintSeatPortrait(group, { seat: 7 });
  assert.equal(group.querySelector('image').href, opponentPortrait('sol'));
  assert.equal(group.querySelector('.table-seat-subtitle').textContent, opponentSubtitle('sol', 'he'));
  selected = null; renderer.paintSeatPortrait(group, { seat: 7 });
  assert.equal(group.querySelector('image').getAttribute('href'), null);
  assert.equal(group.querySelector('image').getAttribute('hidden'), '');
  assert.equal(group.querySelector('.table-seat-position').x, '0');
  assert.equal(group.querySelector('.table-seat-position').y, '-4');
});

test('shared exact card faces follow T/10 preferences without calculation and stop listening on disposal', async () => {
  const f = documentFixture(), root = f.root(); let calculations = 0;
  const source = { schemaVersion: 'equity-request/v1', players: [{ id: 'hero', cards: ['Th', 'Ts'] }, { id: 'opponent', cards: null }],
    board: [], deadCards: [], seed: 1, method: 'auto', samples: 10 };
  const view = mountAdvancedEquity({ root, getRequest: () => source,
    controller: { calculate() { calculations++; }, cancel() {}, dispose() {} } });
  const panel = root.querySelector('details'); panel.open = true; await panel.fire('toggle');
  const token = root.querySelector('.advanced-mini-card');
  assert.equal(token.role, 'img'); assert.equal(token['aria-label'], 'Th');
  assert.match(token.textContent, /T ♥/);
  f.doc.documentElement.dataset.cardRankStyle = 'full-ten'; await f.emit('riverline:cardpresentationchange');
  assert.match(token.textContent, /10 ♥/); assert.equal(token['aria-label'], 'Th'); assert.equal(calculations, 0);
  view.dispose(); f.doc.documentElement.dataset.cardRankStyle = 'poker'; await f.emit('riverline:cardpresentationchange');
  assert.match(token.textContent, /10 ♥/); assert.equal(calculations, 0);
});

test('Personal map routes evidence inspection and unknown teaching through existing callbacks and retains keyboard orientation', async () => {
  const f = documentFixture(), root = f.root(), previous = globalThis.document; globalThis.document = f.doc;
  const cells = [{ handClass: 'AA', status: 'directly_known', action: { precision: 'dominant_only' } },
    { handClass: 'AKs', status: 'unknown' }, { handClass: 'AQs', status: 'inferred_high' }];
  const before = structuredClone(cells), calls = [];
  const actions = { onInspect: hand => calls.push(['inspect', hand]), onTeach: request => calls.push(['teach', request]) };
  try {
    renderPersonalStrategyMap(root, cells, key => key, actions);
    const grid = root.querySelector('.personal-hand-map');
    assert.equal(grid.children.filter(button => button.tabIndex === 0).length, 1);
    grid.children[0].focus();
    await grid.fire('keydown', { key: 'ArrowRight', target: grid.children[0] });
    assert.equal(f.doc.activeElement.dataset.mapHand, 'AKs');
    await f.doc.activeElement.fire('click');
    assert.deepEqual(calls.pop(), ['teach', { handClass: 'AKs', intent: 'mapping' }]);
    renderPersonalStrategyMap(root, cells, key => key, actions);
    assert.equal(f.doc.activeElement.dataset.mapHand, 'AKs');
    const buttons = root.querySelector('.personal-hand-map').children;
    await buttons[0].fire('click'); await buttons[2].fire('click');
    assert.deepEqual(calls, [['inspect', 'AA'], ['inspect', 'AQs']]);
    assert.deepEqual(cells, before);
    assert.ok(buttons[1].getAttribute('aria-label').includes('Unknown'));
    assert.ok(!buttons[0].textContent.includes('100%'));
  } finally { globalThis.document = previous; }
});

test('Personal tiles expose current hand and truthful non-color evidence markers without promoting preferred actions to exact mixes', () => {
  const f = documentFixture(), root = f.root(), previous = globalThis.document; globalThis.document = f.doc;
  const cells = [
    { handClass: 'AA', status: 'directly_known', action: { precision: 'dominant_only' } },
    { handClass: 'AKs', status: 'directly_known', action: { precision: 'exact_mix' } },
    ...['unknown', 'inferred_high', 'inferred_medium', 'uncertain', 'transferred', 'conflicting']
      .map((status, index) => ({ handClass: ['AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s'][index], status })),
  ];
  const before = structuredClone(cells), actions = { onInspect() {}, onTeach() {} };
  try {
    renderPersonalStrategyMap(root, cells, key => key, { ...actions, currentHand: 'AQs' });
    let buttons = root.querySelector('.personal-hand-map').children;
    assert.deepEqual(buttons.map(button => button.querySelector('.personal-hand-status').textContent), ['D', 'D%', '·', 'H', 'M', '?', 'T', '!']);
    assert.equal(buttons[0].dataset.exactEvidence, 'false');
    assert.equal(buttons[1].dataset.exactEvidence, 'true');
    assert.match(buttons[1].getAttribute('aria-label'), /Exact-frequency evidence/);
    assert.doesNotMatch(buttons[0].getAttribute('aria-label'), /Exact-frequency evidence|100%/);
    assert.deepEqual(buttons.filter(button => button.getAttribute('aria-current') === 'true').map(button => button.dataset.mapHand), ['AQs']);
    buttons[4].focus();
    renderPersonalStrategyMap(root, cells, key => key, { ...actions, currentHand: 'AKs' });
    buttons = root.querySelector('.personal-hand-map').children;
    assert.equal(f.doc.activeElement.dataset.mapHand, 'ATs', 'current question never steals keyboard focus');
    assert.deepEqual(buttons.filter(button => button.getAttribute('aria-current') === 'true').map(button => button.dataset.mapHand), ['AKs']);
    renderPersonalStrategyMap(root, cells, key => key, actions);
    assert.ok(root.querySelector('.personal-hand-map').children.every(button => !button.getAttribute('aria-current')));
    assert.deepEqual(cells, before);
  } finally { globalThis.document = previous; }
});
