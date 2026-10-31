import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp } from './helpers/app-under-test.mjs';
import { parseHTML } from './helpers/mini-dom.mjs';
import * as components from '../app/src/ui/drill-components.mjs';
import {
  projectQuickDrillAnswer,
  projectQuickDrillFacts,
  quickDrillActionForKey,
  quickDrillSeatSlots,
  summarizeQuickDrillSession,
} from '../app/src/application/training-quick-drill.mjs';

// TRAINING-QUICK-001: the shared drill components, the quick refresher view
// model and the drill flow in the running app (select + confirm, one click,
// keyboard, feedback swap, panels and plan lock, session end).

const doc = parseHTML('<!doctype html><html><body></body></html>');

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), map };
}

test('answer mode store: select + confirm by default, one prompt after two confirms, stored', () => {
  const storage = memoryStorage();
  const store = components.createAnswerModeStore({ storage });
  assert.equal(store.mode(), 'select');
  assert.equal(store.shouldPrompt(), false);
  store.recordConfirm();
  assert.equal(store.shouldPrompt(), false);
  store.recordConfirm();
  assert.equal(store.shouldPrompt(), true, 'offered after two confirmed answers');
  store.dismissPrompt();
  assert.equal(store.shouldPrompt(), false, 'Keep confirming dismisses for good');
  store.recordConfirm();
  assert.equal(store.shouldPrompt(), false, 'never repeats');
  const reloaded = components.createAnswerModeStore({ storage });
  assert.equal(reloaded.shouldPrompt(), false);
  reloaded.setMode('one_click');
  assert.equal(components.createAnswerModeStore({ storage }).mode(), 'one_click', 'the choice persists');
  const broken = components.createAnswerModeStore({ storage: memoryStorage({ [components.ANSWER_MODE_STORAGE_KEY]: '{oops' }) });
  assert.equal(broken.mode(), 'select', 'unreadable storage keeps the default');
});

test('action card + Confirm: one selection, others step back, Confirm carries the label', () => {
  const group = doc.createElement('div');
  ['fold', 'call'].forEach((type) => group.append(components.createActionCard(doc, {
    type, kind: type === 'fold' ? 'fold' : 'passive', name: type, amountText: type === 'call' ? '2.5 bb' : '', keyLabel: type[0].toUpperCase(),
  })));
  components.selectActionCard(group, 'call');
  assert.equal(group.dataset.hasSelection, 'true');
  assert.deepEqual([...group.children].map((card) => card.getAttribute('aria-pressed')), ['false', 'true']);
  assert.equal(group.querySelector('[data-action="call"]').getAttribute('aria-keyshortcuts'), 'C');
  assert.equal(group.querySelector('[data-action="call"] bdi').getAttribute('dir'), 'ltr', 'amounts are LTR islands');
  const confirm = components.createConfirmButton(doc, { label: 'Choose an action' });
  assert.equal(confirm.disabled, true);
  components.updateConfirmButton(confirm, { label: 'Confirm call 2.5 bb', disabled: false });
  assert.equal(confirm.querySelector('.rl-confirm__label').textContent, 'Confirm call 2.5 bb');
  assert.equal(confirm.disabled, false);
  const sizes = components.createSizesRow(doc, { label: 'Raise to', sizes: ['7.5 bb', '9 bb'], selectedIndex: 1 });
  assert.deepEqual([...sizes.querySelectorAll('.rl-size')].map((b) => [b.getAttribute('aria-keyshortcuts'), b.getAttribute('aria-pressed')]), [['1', 'false'], ['2', 'true']]);
});

test('fact tile: derivation is described for focus, locked tiles never show the value', () => {
  const tile = components.createFactTile(doc, { value: '38.5%', label: 'Equity needed', derivation: '2.5 ÷ 6.5' });
  const derivation = tile.querySelector('.rl-fact-tile__derivation');
  assert.equal(tile.getAttribute('tabindex'), '0', 'keyboard-focus equivalent of hover');
  assert.equal(tile.getAttribute('aria-describedby'), derivation.id);
  const locked = components.createFactTile(doc, { value: '38.5%', label: 'Equity needed', locked: true, lockedText: 'After you answer' });
  assert.doesNotMatch(locked.textContent, /38\.5/);
  assert.equal(locked.dataset.locked, 'true');
});

test('mix bar: LTR island, labels only where they fit, "you" tick below the bar', () => {
  const bar = components.createMixBar(doc, {
    segments: [{ kind: 'aggressive', value: 45, label: '3-Bet 45%' }, { kind: 'passive', value: 40, label: 'Call 40%' }, { kind: 'fold', value: 10, label: 'Fold 10%' }],
    youAtPercent: 65,
    youLabel: 'you',
  });
  assert.equal(bar.getAttribute('dir'), 'ltr');
  const segments = bar.querySelectorAll('.rl-mix__segment');
  assert.deepEqual([...segments].map((s) => s.textContent), ['3-Bet 45%', 'Call 40%', '']);
  assert.equal(bar.querySelector('.rl-mix__you').style.getPropertyValue('--rl-you-at'), '65%');
  assert.equal(components.createMixBar(doc, { segments: [] }).querySelector('.rl-mix__you'), null);
});

test('session dots and finish ring cope with any session length', () => {
  const dots = components.createSessionDots(doc, { total: 5, results: [true, false] });
  assert.deepEqual([...dots.children].map((dot) => dot.dataset.state), ['inside', 'outside', 'current', 'pending', 'pending']);
  assert.equal(dots.children[1].dataset.latest, 'true');
  const open = components.createSessionDots(doc, { total: null, results: [true], countText: '1 answered' });
  assert.equal(open.dataset.variant, 'count');
  assert.equal(components.createSessionDots(doc, { total: 50, results: [], countText: '0 answered' }).dataset.variant, 'count');
  const ring = components.createFinishRing(doc, { inside: 7, total: 10, label: '7 of 10' });
  assert.equal(ring.style.getPropertyValue('--rl-ring-share'), '70');
  assert.equal(ring.style.getPropertyValue('--rl-ring-inside'), '7');
});

test('panel card: one toggle with truthful aria-expanded', () => {
  const card = components.createPanelCard(doc, { id: 'p-plan', title: 'Your plan', open: false, locked: true });
  const toggle = card.querySelector('.rl-panel-card__toggle');
  const region = card.querySelector('.rl-panel-card__body');
  assert.equal(toggle.getAttribute('aria-controls'), region.id);
  assert.equal(region.hidden, true);
  components.setPanelCardOpen(card, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(region.hidden, false);
  assert.equal(card.dataset.locked, 'true');
});

test('view model: keys, seat geometry, answer projection and unknown values', () => {
  assert.equal(quickDrillActionForKey('f', ['fold', 'call', 'raise']), 'fold');
  assert.equal(quickDrillActionForKey('c', ['check', 'bet']), 'check');
  assert.equal(quickDrillActionForKey('b', ['fold', 'raise']), 'raise', 'B/R both choose the aggressive action');
  assert.equal(quickDrillActionForKey('r', ['check', 'bet']), 'bet');
  assert.equal(quickDrillActionForKey('a', ['fold', 'call']), null);
  const slots = quickDrillSeatSlots(6);
  assert.deepEqual(slots[0], { x: 50, y: 90 }, 'hero sits at the bottom centre');
  assert.ok(slots[1].x < 50 && slots[3].y < 50, 'the rest go clockwise around the oval');
  assert.equal(quickDrillSeatSlots(10).length, 10);

  const mix = [
    { action: { type: 'raise' }, name: '3-Bet', value: 45, kind: 'aggressive' },
    { action: { type: 'call' }, name: 'Call', value: 40, kind: 'passive' },
    { action: { type: 'fold' }, name: 'Fold', value: 15, kind: 'fold' },
  ];
  const inside = projectQuickDrillAnswer({ chosenType: 'call', mix, verdict: { kind: 'close', primary: { label: '3-Bet' }, secondary: { label: 'Call' } } });
  assert.equal(inside.inside, true);
  assert.equal(inside.youAtPercent, 65);
  assert.deepEqual(inside.verdict, { kind: 'close', primary: '3-Bet', secondary: 'Call' });
  const outside = projectQuickDrillAnswer({ chosenType: 'all_in', mix, verdict: { kind: 'dominant', primary: { label: '3-Bet' } } });
  assert.equal(outside.inside, false);
  assert.equal(outside.youAtPercent, null);
  assert.equal(outside.verdict.kind, 'dominant');
  // Under 5%: not drawn, so no marker (never placed by any other logic).
  const thin = projectQuickDrillAnswer({ chosenType: 'call', mix: [{ action: { type: 'fold' }, name: 'Fold', value: 96, kind: 'fold' }, { action: { type: 'call' }, name: 'Call', value: 4, kind: 'passive' }] });
  assert.equal(thin.inside, false);
  assert.equal(thin.youAtPercent, null);
  assert.deepEqual(thin.segments.map((segment) => segment.type), ['fold']);
  const first = projectQuickDrillAnswer({ chosenType: 'raise', mix });
  assert.equal(first.youAtPercent, 22.5, 'centre of the first segment');

  const facts = projectQuickDrillFacts({ currentPotBb: 4, callAmountBb: null, requiredRawEquity: null });
  assert.equal(facts.toCallBb, null, 'unknown stays unknown, never zero');
  assert.equal(facts.equityNeededPercent, null);
  const priced = projectQuickDrillFacts({ currentPotBb: 4, callAmountBb: 2.5, actorContestablePotAfterCallBb: 6.5, requiredRawEquity: 2.5 / 6.5 });
  assert.equal(priced.facingPrice, true);
  assert.equal(Math.round(priced.equityNeededPercent * 10) / 10, 38.5, 'the domain ratio, only scaled to a percent');
  assert.deepEqual(summarizeQuickDrillSession([{ spotType: 'a', inside: true }, { spotType: 'a', inside: false }, { spotType: 'b', inside: true }]).groups,
    [{ spotType: 'a', answered: 2, inside: 1 }, { spotType: 'b', answered: 1, inside: 1 }]);
});

const app = await bootApp();
const $ = (selector) => app.$(selector);
const cards = () => app.$$('#trainingGuessButtons .rl-action-card');
async function startVaried() {
  await app.training.start('varied');
  await app.waitFor(() => app.window.app.training.lifecycle === 'ready', 'a ready exercise');
}

test('drill layout: felt with hero at the bottom, facts, action cards, the five panels, one source label', async () => {
  app.window.localStorage.removeItem(components.ANSWER_MODE_STORAGE_KEY);
  await startVaried();
  assert.equal($('#trainingWorkspace').dataset.trainingQuick, 'true');
  assert.ok(app.isShown($('#trainingQuickDrill')));
  const hero = $('#quickDrillFelt .quick-drill-seat[data-hero="true"]');
  assert.ok(hero, 'hero seat');
  assert.equal(hero.style.getPropertyValue('--seat-y'), '90%');
  assert.equal(app.$$('#quickDrillFelt .quick-drill-hole-card').length, 2);
  assert.equal(app.$$('#quickDrillFacts .rl-fact-tile').length, 3);
  assert.ok(cards().length >= 2);
  assert.deepEqual(app.$$('#quickDrillPanels .rl-panel-card').map((card) => card.dataset.panel),
    ['quick-drill-glance', 'quick-drill-range', 'quick-drill-session', 'quick-drill-plan', 'quick-drill-similar']);
  assert.equal(app.$$('#trainingQuickDrill .rl-source-tier').length, 1);
  assert.match($('#quickDrillSource').textContent, /^Baseline · Estimated$/);
  assert.doesNotMatch(app.visibleText(app.byId('trainingMode')), /heuristic/i, 'Training says Baseline, never heuristic');
  assert.doesNotMatch(app.visibleText($('#trainingQuickDrill')), /\bGTO\b|solver|optimal|mistake|correct\b/i);
});

test('Hard assistance keeps the price locked until the answer; the plan panel stays locked too', async () => {
  const exercise = app.window.app.training.currentExercise;
  const equity = $('#quickDrillFacts [data-fact="equity"]');
  if (exercise.decisionContext.callAmountBb > 0) {
    assert.equal(equity.dataset.locked, 'true');
  }
  const plan = $('[data-panel="quick-drill-plan"]');
  assert.equal(plan.dataset.locked, 'true');
  assert.match(plan.textContent, /Shown after you answer/);
});

test('select + confirm: a click selects, Confirm answers and the feedback swaps in place', async () => {
  const spy = app.spy(['handleTrainingGuess']);
  const first = cards()[0];
  await app.click(first);
  assert.equal(first.getAttribute('aria-pressed'), 'true');
  assert.equal(app.window.app.training.lifecycle, 'ready', 'selecting never answers');
  assert.equal(spy.calls.handleTrainingGuess.length, 0);
  const confirm = $('#quickDrillConfirm');
  assert.equal(confirm.disabled, false);
  assert.match(confirm.textContent, /^Confirm /);
  await app.click(confirm);
  await app.waitFor(() => app.window.app.training.lifecycle === 'feedback', 'feedback');
  assert.deepEqual(spy.calls.handleTrainingGuess.map(([type]) => type), [first.dataset.action]);
  assert.equal($('#quickDrillZone').dataset.zoneState, 'feedback');
  assert.equal($('#quickDrillActionLayer').hasAttribute('inert'), true, 'the hidden layer cannot be reached');
  const verdict = $('#quickDrillFeedbackLayer .rl-verdict');
  assert.ok(['dominant', 'close'].includes(verdict.dataset.verdict), 'two verdict states only');
  assert.match($('.quick-drill-answer-pill').textContent, /(inside|outside) the baseline's mix/);
  for (const segment of app.$$('#quickDrillFeedbackLayer .rl-mix__segment')) {
    const share = Number(segment.style.getPropertyValue('--rl-mix-share').replace('%', ''));
    assert.equal(share % 5, 0, 'estimated mixes in 5% steps');
    assert.ok(share >= 5, 'under 5% is hidden');
  }
  const plan = $('[data-panel="quick-drill-plan"]');
  assert.equal(plan.dataset.locked, 'false', 'plan unlocks after the answer');
  assert.equal($('#quickDrillFacts [data-fact="equity"]').dataset.locked, undefined, 'price shown after the answer');
  assert.equal(app.window.document.activeElement, $('#trainingNextHandBtn'), 'focus lands on the one Next control');
  assert.ok($('#trainingNextHandBtn').closest('#quickDrillFeedbackLayer'), 'Next sits in the feedback row');
});

test('Explain opens the deeper details; Next moves on and resets the zone', async () => {
  assert.equal(app.isShown($('#trainingFeedback')), false, 'details stay one click away');
  await app.click('#quickDrillExplain');
  assert.equal($('#trainingWorkspace').dataset.quickDetails, 'open');
  assert.equal($('#quickDrillExplain').getAttribute('aria-expanded'), 'true');
  await app.training.next();
  await app.waitFor(() => app.window.app.training.lifecycle === 'ready', 'next exercise');
  assert.equal($('#quickDrillZone').dataset.zoneState, 'actions');
  assert.equal($('#trainingWorkspace').dataset.quickDetails, undefined);
  assert.equal(app.$$('.rl-session-dot[data-state="inside"], .rl-session-dot[data-state="outside"]').length, 1);
});

test('keyboard: letters select, Enter confirms, then Enter moves on; digits do nothing here', async () => {
  const types = cards().map((card) => card.dataset.action);
  const letter = types.includes('fold') ? 'f' : types.includes('check') ? 'c' : 'a';
  await app.key(app.window.document.body, '1');
  assert.equal(app.window.app.training.lifecycle, 'ready', 'no size presets in the quick drill');
  await app.key(app.window.document.body, letter);
  assert.ok($('#trainingGuessButtons .rl-action-card[aria-pressed="true"]'));
  assert.equal(app.window.document.documentElement.dataset.motionInput, 'key', 'keyboard input is instant');
  await app.key(app.window.document.body, 'Enter');
  await app.waitFor(() => app.window.app.training.lifecycle === 'feedback', 'keyboard answer');
  await app.key(app.window.document.body, 'Enter', { target: app.window.document.body });
  // Focus sits on Next; Enter there is a native button press, so press it directly.
  if (app.window.app.training.lifecycle === 'feedback') await app.click('#trainingNextHandBtn');
  await app.waitFor(() => app.window.app.training.lifecycle === 'ready', 'next exercise after Enter');
});

test('one-time prompt after two confirms; one click then answers on the first click', async () => {
  assert.ok($('#quickDrillAnswerPrompt .rl-answer-prompt'), 'prompt after two confirmed answers');
  await app.click('[data-answer-prompt="one_click"]');
  assert.equal($('#quickDrillAnswerPrompt').childElementCount, 0);
  assert.equal($('#quickDrillConfirm').hidden, true);
  assert.equal($('[data-answer-mode-option="one_click"]').getAttribute('aria-pressed'), 'true', 'Feel and Settings follow');
  await app.click(cards()[0]);
  await app.waitFor(() => app.window.app.training.lifecycle === 'feedback', 'one-click answer');
  await app.click('#quickDrillFeelButton');
  await app.click('#quickDrillFeel [data-answer-mode-option="select"]');
  assert.equal(JSON.parse(app.window.localStorage.getItem(components.ANSWER_MODE_STORAGE_KEY)).mode, 'select');
  await app.training.next();
});

test('panels open and close and keep their state across spots', async () => {
  await app.waitFor(() => app.window.app.training.lifecycle === 'ready', 'ready');
  const toggle = $('[data-panel="quick-drill-session"] .rl-panel-card__toggle');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  await app.click(toggle);
  assert.equal($('[data-panel="quick-drill-session"] .rl-panel-card__toggle').getAttribute('aria-expanded'), 'true');
  assert.match($('[data-panel="quick-drill-session"]').textContent, /Inside the mix/);
  await app.training.answer();
  assert.equal($('[data-panel="quick-drill-session"] .rl-panel-card__toggle').getAttribute('aria-expanded'), 'true');
  assert.doesNotMatch($('#quickDrillPanels').textContent, /\[object|undefined|NaN/, 'panel rows render text, not objects');
});

test('session end: Finish session shows the finish ring in the decision zone', async () => {
  for (let guard = 0; guard < 30 && !app.window.app.training.quick.finishPending; guard += 1) {
    if (app.window.app.training.lifecycle === 'feedback') await app.training.next();
    await app.waitFor(() => ['ready', 'feedback', 'complete'].includes(app.window.app.training.lifecycle), 'a decision');
    if (app.window.app.training.lifecycle === 'ready') await app.training.answer();
  }
  assert.equal($('#trainingNextHandBtn .quick-drill-next-label').textContent, 'Finish session');
  await app.click('#trainingNextHandBtn');
  assert.equal($('#trainingNextHandBtn').hidden, true, 'Next leaves once the ring shows');
  assert.equal($('#quickDrillZone').dataset.zoneState, 'finish');
  const ring = $('#quickDrillFinishRing .rl-finish-ring');
  assert.ok(ring);
  assert.match(ring.getAttribute('aria-label'), /^\d+ of 10 inside the baseline's mix$/);
  assert.equal(app.$$('.rl-session-dot').filter((dot) => ['inside', 'outside'].includes(dot.dataset.state)).length, 10);
  await app.click('#trainingRestartSession');
  await app.waitFor(() => app.window.app.training.lifecycle === 'ready', 'a new session');
  assert.equal($('#quickDrillZone').dataset.zoneState, 'actions');
  assert.equal(app.$$('.rl-session-dot[data-state="inside"], .rl-session-dot[data-state="outside"]').length, 0);
});

test('Full Hand keeps its own table and action controls', async () => {
  await app.training.start('full_hand');
  assert.equal($('#trainingWorkspace').dataset.trainingQuick, 'false');
  assert.equal(app.isShown($('#trainingQuickDrill')), false);
  assert.equal($('#trainingSetupPanel').closest('#quickDrillSetupMount'), null, 'setup goes back to the rail');
});

test('motion: drill moments are tagged, keyboard and Reduced rules apply, no transition: all', () => {
  assert.equal($('#trainingQuickDrill').dataset.motion, 'drill');
  assert.equal($('#quickDrillPanels').dataset.motion, 'panel');
  const sheet = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  const start = sheet.indexOf('/* TRAINING-QUICK-001');
  const section = sheet.slice(start, sheet.indexOf('/* MOTION-FOUNDATION-001 ----', start));
  assert.ok(start > 0 && section.length > 1000, 'the quick drill section exists');
  assert.doesNotMatch(section, /transition:\s*all/);
  assert.doesNotMatch(section, /scale\(0\)/);
  assert.doesNotMatch(section, /animation:[^;]*[\s(]ease-in[\s;,)]/, 'never ease-in for entrances');
  assert.doesNotMatch(section, /#[0-9a-f]{3,8}\b/i, 'roles only, no raw hex');
  for (const line of section.split('\n').filter((entry) => entry.includes(':hover'))) {
    assert.match(line, /@media \(hover: hover\) and \(pointer: fine\)/, `hover stays under fine pointers: ${line.slice(0, 80)}`);
  }
  assert.match(section, /@media \(hover: hover\) and \(pointer: fine\)/);
});
