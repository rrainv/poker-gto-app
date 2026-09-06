import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPersonalStrategyHandWorkspace, parsePersonalHandPercent, personalHandCopy } from '../app/src/application/personal-strategy-hand-workspace.mjs';
import { createRangeCalibrationApplication, createContextFromSelection } from '../app/src/application/range-calibration-service.mjs';
import { createMemoryPersonalStrategyDatabase } from '../app/src/personal-strategy/indexeddb-storage.mjs';
import { continuationCopy } from '../app/src/application/personal-hand-continuation-language.mjs';

class Element {
  constructor(tag, ownerDocument) { this.tagName = tag.toUpperCase(); this.ownerDocument = ownerDocument; this.children = []; this.listeners = []; this.dataset = {}; this._value = null; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(' '); }
  set value(value) { this._value = String(value); }
  get value() { return this._value ?? (this.tagName === 'SELECT' ? this.children[0]?.value ?? '' : ''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = []; this._text = ''; this.append(...nodes); }
  addEventListener(event, handler, { signal } = {}) { this.listeners.push({ event, handler, signal }); }
  async fire(event) { for (const listener of this.listeners) if (listener.event === event && !listener.signal?.aborted) await listener.handler({ preventDefault() {}, target: this }); }
  focus() { this.ownerDocument.activeElement = this; }
  querySelector() { return descendants(this).find(node => node.tagName === 'BUTTON' && node.type === 'submit'); }
}
function descendants(root) { return root.children.flatMap(child => [child, ...descendants(child)]); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function fixture({ get, language = 'en', app = null, initialScope = null, actionSizeHints } = {}) {
  const doc = { createElement: tag => new Element(tag, doc) }, root = new Element('div', doc);
  let scope = initialScope ?? { profileId: 'p', modeId: 'm' }, reads = 0;
  const saves = [], records = [], calls = [];
  const action = (type, amount = null) => ({ action: { type, amountToMilliBb: amount }, amountMilliBb: amount });
  const preflopAction = action('raise', 2500), preflopFoldAction = action('fold'), actions = [action('check'), action('bet', 1815)];
  const value = () => ({ available: true, approachSnapshot: { profileId: 'p', modeId: 'm', setupVersion: 1, approachVersion: 1 },
    preflopNode: { fingerprint: 'preflop', board: [] }, flopNode: { fingerprint: 'flop', board: ['Qs', '8c', '4h'] },
    preflopCandidates: [{ handClass: 'AA', legacyRaiseFrequency: 0.5 }], preflopAction, preflopFoldAction, actions, actionSizeHints,
    exactNodeIntents: [...records], study: { questions: [{ comboId: 'AsAh', cards: ['As', 'Ah'], handClass: 'AA' }] } });
  const application = {
    getPersonalHandStudy: async () => { reads += 1; return get ? get(value()) : value(); },
    savePersonalHandIntent: async (selected, input) => { saves.push({ selected, input }); records.push({ id: `e${records.length}`, ...input }); },
  };
  const mounted = mountPersonalStrategyHandWorkspace({ root, application: app ?? application, getScope: () => scope, language: () => language,
    onTeach: payload => calls.push(payload) });
  const find = predicate => descendants(root).find(predicate);
  const field = name => find(node => node.dataset.handField === name);
  const forms = () => descendants(root).filter(node => node.tagName === 'FORM' && node.className !== 'exploit-teacher-controls');
  return { root, doc, mounted, saves, calls, field, forms, find, get reads() { return reads; },
    start: () => find(node => node.dataset.handAction === 'start').fire('click'),
    setScope: value => { scope = value; } };
}

test('hand study is explicit, exact opening frequency never inherits a family answer, and corrections keep heads', async () => {
  const f = fixture(); assert.equal(f.reads, 0); assert.equal(f.saves.length, 0);
  await f.start(); assert.equal(f.reads, 1); assert.equal(f.field('open-frequency').value, '');
  assert.match(f.root.textContent, /50%/);
  await f.forms()[0].fire('submit'); assert.equal(f.saves.length, 0);
  f.field('open-frequency').value = '60'; await f.forms()[0].fire('submit');
  assert.equal(f.saves[0].input.distribution[0].probability, 0.6);
  assert.equal(f.saves[0].input.distribution[1].probability, 0.4);
  assert.equal(f.saves[0].input.approachSnapshot.approachVersion, 1);
  assert.deepEqual(f.saves[0].input.supersedesEvidenceIds, []);
  assert.match(f.root.textContent, /Saved intention here/);
  f.field('open-frequency').value = '40'; await f.forms()[0].fire('submit');
  assert.deepEqual(f.saves[1].input.supersedesEvidenceIds, ['e0']);
  assert.equal(f.saves[1].input.subject.handClass, 'AA');
});

test('preferred flop action stays qualitative and exact percentages must sum to 100', async () => {
  const f = fixture(); await f.start();
  f.field('preferred').value = '0'; await f.forms()[1].fire('submit');
  assert.equal(f.saves[0].input.precision, 'dominant'); assert.equal(f.saves[0].input.distribution, null);
  assert.equal(f.saves[0].input.preferredAction.action.type, 'check');
  const precision = f.field('precision'); precision.value = 'exact'; await precision.fire('change');
  const inputs = descendants(f.root).filter(node => node.dataset.handField === 'mix-frequency');
  inputs[0].value = '50'; inputs[1].value = '25'; await f.forms()[1].fire('submit'); assert.equal(f.saves.length, 1);
  inputs[1].value = '50'; await f.forms()[1].fire('submit');
  assert.equal(f.saves.length, 2); assert.deepEqual(f.saves[1].input.subject, { kind: 'combo', comboId: 'AsAh' });
  assert.equal(f.saves[1].input.preferredAction, null); assert.deepEqual(f.saves[1].input.supersedesEvidenceIds, ['e0']);
});

test('pot sizing hints are localized presentation and never enter persisted actions', async () => {
  for (const [language, pot] of [['en', 'pot'], ['ru', 'банка'], ['he', 'קופה']]) {
    const f = fixture({ language, actionSizeHints: [{ potFraction: null }, { potFraction: 0.33 }] });
    await f.start(); assert.ok(f.field('preferred').textContent.includes(`≈33% ${pot}`));
    f.field('preferred').value = '1'; await f.forms()[1].fire('submit');
    assert.equal(f.saves[0].input.preferredAction.action.amountToMilliBb, 1815);
    assert.equal(Object.hasOwn(f.saves[0].input.preferredAction, 'potFraction'), false);
    assert.equal(Object.hasOwn(f.saves[0].input.preferredAction, 'actionSizeHints'), false);
  }
});

test('scope changes fence old forms, invalidation clears evidence, and pending load cannot repopulate', async () => {
  const f = fixture(); await f.start();
  f.field('open-frequency').value = '70'; f.setScope({ profileId: 'different', modeId: 'm' });
  await f.forms()[0].fire('submit'); assert.equal(f.saves.length, 0);
  f.mounted.invalidate(); assert.equal(f.reads, 1); assert.doesNotMatch(f.root.textContent, /Earlier action-family answer/);
  const d = deferred(), pending = fixture({ get: async value => { await d.promise; return value; } });
  const load = pending.start(); pending.mounted.invalidate(); d.resolve(); await load;
  assert.equal(pending.forms().length, 0); assert.equal(pending.saves.length, 0);
  pending.mounted.dispose(); assert.equal(pending.root.textContent, '');
});

test('EN/RU/HE copy and RTL rendering remain bounded', async () => {
  for (const language of ['en', 'ru', 'he']) {
    assert.notEqual(personalHandCopy('assumption', language), 'assumption');
    const f = fixture({ language }); await f.start(); assert.equal(f.root.dir, language === 'he' ? 'rtl' : 'ltr');
    assert.equal(f.field('open-frequency').value, ''); f.mounted.dispose();
  }
  for (const value of ['', ' ', 'NaN', '-1', '101']) assert.throws(() => parsePersonalHandPercent(value));
  assert.equal(parsePersonalHandPercent('0'), 0);
});

test('real application saves exact size then reached combo intent and reloads the same node', async () => {
  const values = new Map(); let next = 0;
  const app = createRangeCalibrationApplication({
    storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) },
    database: createMemoryPersonalStrategyDatabase(), idFactory: prefix => `${prefix}-hand-ui-${++next}`,
    clock: () => new Date('2026-09-05T12:00:00Z'),
  });
  const selection = { environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
    decisionFamily: 'preflop_rfi', actionAware: true, collectionBb: 0, anteType: 'none', anteBb: 0 };
  const profile = await app.createProfile({ displayName: 'Hand UI', modeNames: ['Intention'], setupAssumptions: selection });
  const scope = { profileId: profile.profile.id, modeId: profile.modes[0].id, context: createContextFromSelection(selection) };
  const f = fixture({ app, initialScope: scope }); await f.start();
  assert.equal(f.forms().length, 1, f.root.textContent);
  const hand = f.field('class'); hand.value = 'AA'; await hand.fire('change');
  f.field('open-frequency').value = '60'; await f.forms()[0].fire('submit');
  assert.equal(f.forms().length, 2, f.root.textContent);
  f.field('preferred').value = '0'; const selected = f.field('combo').value;
  await f.forms()[1].fire('submit');
  const study = await app.getPersonalHandStudy(scope);
  assert.equal(study.exactNodeIntents.length, 2);
  assert.equal(study.exactNodeIntents.find(record => record.node.street === 'flop').subject.comboId, selected);
  assert.equal(study.study.facts.dominantCombos, 1);
  assert.match(f.root.textContent, /Saved intention here/);
  f.mounted.invalidate(); await f.start(); assert.equal(f.forms().length, 2);
});

test('mounted EN/RU/HE hand flow reaches turn and river, routes lessons, compares policy/Approach and reloads', async () => {
  for (const language of ['en','ru','he']) {
    const values = new Map(); let n = 0;
    const options = { database: createMemoryPersonalStrategyDatabase(), idFactory: kind => `${kind}-${++n}`,
      storage: { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value) } };
    const app = createRangeCalibrationApplication(options);
    const bundle = await app.createProfile({ displayName: 'Streets', modeNames: ['Usual','Other'] });
    const context = createContextFromSelection({ environment: 'custom', tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100,
      decisionFamily: 'preflop_rfi', actionAware: true, anteType: 'none', anteBb: 0, collectionBb: 0 });
    const scope = { profileId: bundle.profile.id, modeId: bundle.modes[0].id, context };
    const f = fixture({ app, initialScope: scope, language }); await f.start();
    f.field('class').value = 'AA'; await f.field('class').fire('change');
    f.field('open-frequency').value = '100'; await f.forms()[0].fire('submit');
    const saveCheck = async () => {
      f.field('precision').value = 'exact'; await f.field('precision').fire('change');
      descendants(f.root).filter(node => node.dataset.handField === 'mix-frequency').forEach((input,index) => { input.value = index === 0 ? '100' : '0'; });
      await f.forms()[1].fire('submit');
    };
    await saveCheck();
    f.field('next-card').value = '2d';
    await f.find(node => node.dataset.handAction === 'advance').fire('click');
    assert.ok(f.root.textContent.includes(continuationCopy('turn', language)));
    assert.equal(f.field('combo').children.length, 1);
    f.field('custom-size').value = '4.001'; await f.find(node => node.dataset.handAction === 'add-size').fire('click');
    assert.ok(f.field('preferred').children.some(option => /4[.,]001/.test(option.textContent)));
    await saveCheck();
    f.field('next-card').value = '3c'; f.field('opponent-bet').value = '2.5';
    await f.find(node => node.dataset.handAction === 'advance').fire('click');
    assert.ok(f.root.textContent.includes(continuationCopy('call_boundary', language)));
    f.field('context-note').value = 'Explicit river assumption';
    f.field('preferred').value = '1'; await f.forms()[1].fire('submit');
    const saved = await app.repository.loadSnapshot();
    assert.equal(saved.exactNodeIntents.length, 4);
    assert.equal(saved.exactNodeIntents.at(-1).node.street, 'river');
    assert.equal(saved.exactNodeIntents.at(-1).preferredAction.action.type, 'call');
    assert.ok(f.root.textContent.includes('Explicit river assumption'));
    await f.find(node => node.dataset.handConcept === 'bluff_catch').fire('click');
    assert.equal(f.doc.activeElement.dataset.exploitConcept, 'bluff_catcher');
    const policy = f.find(node => node.dataset.exploitField === 'policy');
    policy.value = 'aggressive'; await policy.fire('change');
    const studyPolicy = f.find(node => node.dataset.opponentStudy === 'policy');
    studyPolicy.value = 'tight-passive'; await studyPolicy.fire('change');
    const teachRegion = f.find(node => node.dataset.opponentStudy === 'teach');
    assert.ok(teachRegion, 'preferred-only river intent offers the existing region editor');
    await teachRegion.fire('click');
    assert.equal(f.doc.activeElement, f.field('combo'));
    await f.find(node => node.dataset.handAction === 'compare').fire('click');
    assert.deepEqual((await app.repository.loadSnapshot()).exactNodeIntents, saved.exactNodeIntents);
    f.mounted.invalidate(); await f.start();
    const activeElement = f.doc.activeElement;
    await teachRegion.fire('click');
    assert.equal(f.doc.activeElement, activeElement, 'stale region controls cannot refocus a replaced Approach');
    assert.ok(f.root.textContent.includes(continuationCopy('river', language)));
    assert.equal(f.root.dir, language === 'he' ? 'rtl' : 'ltr');
    assert.ok(!f.root.textContent.includes('undefined'));
    f.mounted.dispose();
  }
});
