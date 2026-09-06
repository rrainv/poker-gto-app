import test from 'node:test';
import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import { mountAdvancedEquity } from '../app/src/application/advanced-equity-workspace.mjs';
import { advancedEquityCopy as copy } from '../app/src/application/advanced-equity-language.mjs';
import { calculateEquityRequest } from '../app/src/application/advanced-equity-dispatch.mjs';
setMaxListeners(0);
class Element {
  constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.listeners = []; this._text = ''; this._value = null; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(' '); }
  set value(value) { this._value = String(value); }
  get value() { return this._value ?? (this.tagName === 'select' ? this.children[0]?.value ?? '' : ''); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes; }
  addEventListener(event, callback, { signal } = {}) { this.listeners.push({ event, callback, signal }); }
  async fire(event) { for (const listener of this.listeners) if (listener.event === event && !listener.signal?.aborted) await listener.callback({ target: this }); }
}
const descendants = node => [node, ...node.children.flatMap(descendants)];
const source = () => ({ schemaVersion: 'equity-request/v1', players: [{ id: 'hero', cards: ['As', 'Ad'] }, { id: 'villain', cards: ['Jh', 'Th'] }],
  board: ['Kh', 'Qh', '3c', '2h'], deadCards: [], method: 'auto', seed: 3, samples: 10 });
function fixture(lang = 'en', calculate = calculateEquityRequest, extra = {}) {
  const doc = { createElement: tag => new Element(tag, doc) }, root = doc.createElement('div');
  let input = source(), calls = 0, cancellations = 0, reads = 0;
  const controller = { async calculate(request) { calls++; return calculate(request); }, cancel() { cancellations++; }, dispose() {} };
  const view = mountAdvancedEquity({ root, language: () => lang, getRequest: () => { reads++; return input; }, controller, ...extra });
  const find = (tag, text) => descendants(root).find(node => node.tagName === tag && (text === undefined || node.textContent === text));
  return { root, view, find, setSource(value) { input = value; view.refresh(); }, get reads() { return reads; }, get calls() { return calls; }, get cancellations() { return cancellations; },
    async open() { root.children[0].open = true; await root.children[0].fire('toggle'); } };
}
test('mounted EN/RU/HE is lazy, explicitly partial, input-invalidated and disposable', async () => {
  for (const lang of ['en', 'ru', 'he']) {
    const f = fixture(lang); assert.equal(f.reads, 0); assert.equal(f.calls, 0);
    assert.equal(f.root.dir, lang === 'he' ? 'rtl' : 'ltr'); await f.open();
    const modes = descendants(f.root).filter(node => node.tagName === 'select' && node.children.some(option => option.value === 'current'));
    modes[1].value = 'range'; await modes[1].fire('change');
    const text = descendants(f.root).filter(node => node.tagName === 'textarea')[1]; text.value = 'JcJd:1';
    await text.fire('input'); await f.find('button', copy('calculate', lang)).fire('click');
    assert.ok(f.root.textContent.includes(copy('error', lang))); // unknown default cannot become full range
    const partial = descendants(f.root).find(node => node.type === 'checkbox'); partial.checked = true; await partial.fire('change');
    await f.find('button', copy('calculate', lang)).fire('click');
    assert.ok(f.root.textContent.includes(copy('partial', lang)));
    assert.ok(f.root.textContent.includes('Equity'));
    text.value = 'QsQd:1'; await text.fire('input'); assert.ok(!f.root.textContent.includes(copy('partial', lang)));
    const detached = f.find('button', copy('calculate', lang)), calls = f.calls; f.view.dispose(); await detached.fire('click');
    assert.equal(f.calls, calls); assert.equal(f.root.children.length, 0);
  }
});
test('late results cannot return after source changes or cancel', async () => {
  let resolve;
  const f = fixture('en', () => new Promise(done => { resolve = done; })); await f.open();
  const pending = f.find('button', copy('calculate')).fire('click');
  f.setSource({ ...source(), board: ['Kh', 'Qh', '3c'] });
  resolve({ players: [{ id: 'old-player', equity: 1 }], coverage: [], method: 'exact' }); await pending;
  assert.ok(!f.root.textContent.includes('old-player'));
  assert.ok(f.cancellations >= 1); f.view.dispose();
});
test('card focus and click show best five; category improvement can lose all Equity', async () => {
  const f = fixture(); await f.open();
  const path = descendants(f.root).find(node => node.tagName === 'input' && !node.type); path.value = 'Ah';
  await f.find('button', copy('selected')).fire('click');
  const card = descendants(f.root).find(node => node.tagName === 'button' && node.textContent.startsWith('Ah ·'));
  assert.ok(card); assert.match(card.textContent, /0\.0%/); await card.fire('focus');
  assert.ok(f.root.textContent.includes(copy('three_of_a_kind')));
  assert.ok(f.root.textContent.includes(copy('behind')));
  const tokens = descendants(f.root).filter(node => node.className?.includes('advanced-mini-card'));
  assert.equal(tokens.length, 7); assert.equal(tokens.filter(node => node.tagName === 'strong').length, 5);
  await card.fire('click'); assert.ok(f.root.textContent.includes(copy('hypothetical'))); f.view.dispose();
});
test('Exploit range input cannot silently use the uniform unknown hand', async () => {
  let captured;
  const f = fixture('en', async request => { captured = request; return calculateEquityRequest(request); },
    { forcedRangeIds: ['villain'], rangeSourceRole: 'explicit_opponent_model', rangeSourceId: 'calling:model-v1:action-5bb' });
  await f.open();
  const selects = descendants(f.root).filter(node => node.tagName === 'select' && node.children.some(option => option.value === 'current')); assert.equal(selects[1].disabled, true);
  await f.find('button', copy('calculate')).fire('click');
  assert.equal(captured.players[1].kind, 'range'); assert.equal(captured.players[1].sourceRole, 'explicit_opponent_model');
  assert.ok(f.root.textContent.includes(copy('error'))); f.view.dispose();
});
