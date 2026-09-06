import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpponentPracticeWorkspace } from '../app/src/application/opponent-practice-workspace.mjs';
import { createSyntheticOpponentPolicy } from '../app/src/application/synthetic-opponent-policy.mjs';
import { installTrainingModeBridge } from '../app/src/application/training-mode-bootstrap.mjs';
import { createFullHandTrainingSessionController } from '../app/src/application/full-hand-training-session-controller.mjs';
import { createGameRulesSnapshotFromLegacyGameConfiguration } from '../shared/poker-domain/index.js';
import { createStrategyProvider } from '../app/src/application/strategy-provider.mjs';

class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.events = {}; this._text = ''; this._value = null; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._text = ''; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(' '); }
  get value() { return this._value ?? (this.tagName === 'select' ? this.children[0]?.value : '') ?? ''; }
  set value(value) { this._value = String(value); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(event, callback) { this.events[event] = callback; }
  fire(event) { this.events[event]?.(); }
  querySelectorAll() { return descendants(this).filter(element => element.dataset.opponentCopy); }
}
function descendants(root) { return root.children.flatMap(child => [child, ...descendants(child)]); }
function mounted() {
  const roots = ['trainingOpponentSetup', 'trainingOpponentReview'].map(id => { const element = new Element('section'); element.id = id; return element; });
  const events = {};
  const win = { appLang: 'en', document: { createElement: tag => new Element(tag),
    getElementById: id => roots.flatMap(root => [root, ...descendants(root)]).find(element => element.id === id) },
    addEventListener: (name, callback) => { events[name] = callback; } };
  const workspace = createOpponentPracticeWorkspace(win); workspace.renderSetup(true);
  return { win, workspace, events, roots, get: id => win.document.getElementById(id) };
}

test('mounted preset/custom controls produce immutable requests and preserve values on EN/RU/HE switching', () => {
  const { win, workspace, events, roots, get } = mounted();
  assert.equal(roots[0].hidden, false);
  assert.equal(workspace.readRequest({ tableSize: 2 }).configuration.parameters.smallPriceCallPercent, 90);
  get('trainingOpponentPreset').value = 'aggressive'; get('trainingOpponentPreset').fire('change');
  assert.equal(workspace.readRequest({ tableSize: 6 }).configuration.parameters.freeAggressionPercent, 65);
  get('opponent-smallPriceCallPercent').value = '73'; get('opponent-smallPriceCallPercent').fire('input');
  get('trainingOpponentSeed').value = '123'; get('trainingOpponentTarget').value = 'BB';
  assert.equal(get('trainingOpponentPreset').value, 'custom');
  const request = workspace.readRequest({ tableSize: 6 });
  assert.equal(Object.isFrozen(request.configuration.parameters), true);
  for (const locale of ['ru', 'he', 'en']) {
    win.appLang = locale; events['riverline:languagechange']();
    assert.deepEqual(workspace.readRequest({ tableSize: 6 }), request);
    assert.ok(get('opponentPolicyDescription').textContent.includes('73'));
  }
  get('opponent-smallPriceCallPercent').value = '';
  assert.throws(() => workspace.readRequest({ tableSize: 6 }), /percentages/);
  get('opponent-smallPriceCallPercent').value = '0'; get('trainingOpponentSeed').value = '';
  assert.throws(() => workspace.readRequest({ tableSize: 6 }), /seed/);
  workspace.renderSetup(false); assert.equal(roots[0].hidden, true);
});

test('Review preparation restores the recorded policy without starting Training or changing theme authority', () => {
  const { workspace, get } = mounted();
  get('trainingOpponentPreset').value = 'aggressive'; get('trainingOpponentPreset').fire('change');
  get('trainingOpponentSeed').value = '91';
  const recorded = workspace.readRequest({ tableSize: 6 });
  get('trainingOpponentPreset').value = 'calling-heavy'; get('trainingOpponentPreset').fire('change');
  assert.equal(workspace.prepareRequest(recorded), true);
  assert.deepEqual(workspace.readRequest({ tableSize: 6 }), recorded);
  assert.equal(workspace.readTrainingIntent({ tableSize: 6 }).theme, 'play_policy');
  assert.throws(() => workspace.prepareRequest({ ...recorded, policySeed: -1 }), /seed/);
  assert.deepEqual(workspace.readRequest({ tableSize: 6 }), recorded);
});

test('compact setup exposes three choices and keeps policy internals under collapsed Advanced in EN/RU/HE', () => {
  const { win, workspace, events, roots, get } = mounted();
  const advanced = get('trainingOpponentAdvanced');
  const descendantsOfAdvanced = descendants(advanced);
  assert.equal(Boolean(advanced.open), false);
  for (const id of ['trainingOpponentSeed', 'trainingOpponentCompare', 'opponentPolicyComparison',
    'opponentPolicyExactDescription', 'opponentStudyQuestion', 'opponent-smallPriceCallPercent']) {
    assert.ok(descendantsOfAdvanced.includes(get(id)), `${id} belongs to Advanced`);
  }
  const primaryLabels = roots[0].children.filter(node => node.tagName === 'label');
  assert.deepEqual(primaryLabels.map(label => label.children[1].id),
    ['trainingOpponentPreset', 'trainingOpponentTheme', 'trainingOpponentTarget']);
  const request = workspace.readTrainingIntent({ tableSize: 2 });
  for (const locale of ['en', 'ru', 'he']) {
    win.appLang = locale; events['riverline:languagechange']();
    assert.equal(Boolean(advanced.open), false);
    assert.equal(roots[0].dir, locale === 'he' ? 'rtl' : 'ltr');
    assert.ok(get('opponentPolicyDescription').textContent.length < 90);
    assert.ok(get('opponentPolicyExactDescription').textContent.includes('90'));
    assert.ok(descendantsOfAdvanced.some(node => node.dataset.opponentCopy === 'scope'));
    advanced.open = true;
    assert.deepEqual(workspace.readTrainingIntent({ tableSize: 2 }), request);
    advanced.open = false;
  }
  get('trainingOpponentPreset').value = 'custom'; get('trainingOpponentPreset').fire('change');
  advanced.open = true;
  get('opponent-smallPriceCallPercent').value = '73'; get('opponent-smallPriceCallPercent').fire('input');
  advanced.open = false;
  assert.ok(get('opponentPolicyDescription').textContent.includes('73'));
  assert.equal(workspace.readRequest({ tableSize: 2 }).configuration.parameters.smallPriceCallPercent, 73);
});

test('review uses frozen completed assignments, clears on reset and cannot revive on a locale event', () => {
  const { win, workspace, events, roots } = mounted();
  const request = workspace.readRequest({ tableSize: 2 });
  const policy = createSyntheticOpponentPolicy(request.configuration);
  const snapshot = { status: 'terminal', opponentPractice: request,
    opponentAssignments: [{ policyId: policy.policyId, policyVersion: policy.policyVersion, seat: 1, baseSeed: 112, config: policy.configuration }],
    botDecisionJournal: { decisions: [] } };
  workspace.renderReview(snapshot); assert.equal(roots[1].hidden, false);
  assert.ok(roots[1].textContent.includes(policy.policyVersion));
  win.appLang = 'he'; events['riverline:languagechange']();
  assert.ok(roots[1].textContent.includes('הנחות'));
  workspace.renderReview({ ...snapshot, status: 'awaiting_hero' }); assert.equal(roots[1].hidden, true);
  workspace.renderReview(snapshot);
  const bridge = installTrainingModeBridge(win);
  bridge.renderOpponentReview(snapshot); bridge.reset();
  assert.equal(roots[1].hidden, true);
  events['riverline:languagechange'](); assert.equal(roots[1].hidden, true);
  assert.equal(bridge.getFullHandSnapshot().opponentPractice, null);
});

test('mounted themes remain questions, comparison follows custom inputs, and completed actor review is localized and embargoed', async () => {
  const { win, workspace, events, roots, get } = mounted();
  get('trainingOpponentPreset').value = 'aggressive'; get('trainingOpponentPreset').fire('change');
  get('trainingOpponentTheme').value = 'bluff_catching_questions'; get('trainingOpponentTheme').fire('change');
  const intent = workspace.readTrainingIntent({ tableSize: 2 });
  assert.equal(intent.semanticTarget, 'not_guaranteed');
  assert.equal(intent.opponentPractice.configuration.parameters.freeAggressionPercent, 65);
  assert.match(roots[0].textContent, /Policy seed/);
  assert.match(get('opponentStudyQuestion').textContent, /Aggression alone/);
  get('trainingOpponentCompare').value = 'tight-passive'; get('trainingOpponentCompare').fire('change');
  assert.match(get('opponentPolicyComparison').textContent, /65% \/ 10%/);
  const controller = createFullHandTrainingSessionController();
  let result = controller.start({ handSeed: 17, heroPosition: 'BTN', opponentPractice: intent.opponentPractice,
    policyTrainingIntent: intent, handConfiguration: { handId: 'review-inputs', buttonSeat: 0,
      rulesSnapshot: createGameRulesSnapshotFromLegacyGameConfiguration({ mode: 'home', smallBlindMilliBb: 500,
        bigBlindMilliBb: 1000, chipUnitMilliBb: 100, ante: { type: 'none', amountMilliBb: 0 } }, 2),
      players: [0, 1].map(seat => ({ playerId: `P${seat}`, seat, startingStackMilliBb: 10000 })) } }, {
    strategyProvider: createStrategyProvider({ fallbackResolver: () => ({ source: 'heuristic_preflop', modelVersion: 'test/v1',
      actions: [{ action: { type: 'call' }, label: 'Call', probability: 1 }] }) }) });
  workspace.renderReview(result.snapshot); assert.equal(roots[1].hidden, true);
  for (let index = 0; result.snapshot.status === 'awaiting_hero' && index < 128; index++) {
    const decision = result.snapshot.currentDecision;
    result = await controller.answer(decision.decisionId, { type: decision.legalActions.check.available ? 'check' : 'call' });
  }
  assert.equal(result.snapshot.status, 'terminal');
  get('trainingOpponentPreset').value = 'tight-passive'; get('trainingOpponentPreset').fire('change');
  for (const locale of ['en', 'ru', 'he']) {
    win.appLang = locale; events['riverline:languagechange'](); workspace.renderReview(result.snapshot);
    assert.equal(roots[1].hidden, false);
    assert.equal(roots[1].dir, locale === 'he' ? 'rtl' : 'ltr');
    assert.ok(roots[1].textContent.includes('65'));
    assert.ok(roots[1].textContent.includes(result.snapshot.botDecisionJournal.decisions[0].actorInformation.ownCards.join(' ')));
    assert.ok(roots[1].textContent.includes(String(result.snapshot.botDecisionJournal.decisions[0].decisionSeed)));
    if (locale === 'en') {
      assert.match(roots[1].textContent, /Recorded policy decisions/);
      assert.match(roots[1].textContent, /Public actions before this decision/);
      assert.match(roots[1].textContent, /Decision seed/);
    }
    assert.ok(descendants(roots[1]).some(node => node.tagName === 'bdi'));
  }
  workspace.renderReview(null); events['riverline:languagechange'](); assert.equal(roots[1].hidden, true);
});
