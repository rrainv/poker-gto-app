import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / logic.js assertions are behavioural (parsed
// markup and the running page's globals and strategy results). File-system,
// manifest and Equity worker checks are outside this ticket.
const appUrl = new URL('../app/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'));
const markup = indexDocument();
const scriptSources = markup.querySelectorAll('script[src]').map((script) => script.getAttribute('src'));
const app = await bootApp();
const pageDefines = (name) => app.evaluate(`typeof ${name}`) !== 'undefined';

test('browser bootstrap contains no legacy ORT or model engine', () => {
  for (const src of scriptSources) {
    assert.doesNotMatch(src, /(?:^|\/)ort(?:\.min)?\.(?:js|mjs)|src\/ml\/engine\.js|frozen_models|solver-model/i, src);
  }
  assert.deepEqual(
    fs.readdirSync(appUrl).filter((name) => /^ort(?:[.-]|$)/i.test(name)),
    [],
  );
  for (const relativePath of [
    '../app/src/ml/engine.js',
    '../app/frozen_models',
    '../app/solver-model',
    '../app/equity.worker.js',
  ]) assert.equal(fs.existsSync(new URL(relativePath, import.meta.url)), false, relativePath);
});

test('browser package and build contain no web inference dependency or asset inclusion', () => {
  assert.equal(manifest.dependencies?.['onnxruntime-web'], undefined);
  assert.equal(manifest.dependencies?.['onnxruntime-node'], undefined);
  assert.doesNotMatch(JSON.stringify(manifest.build), /frozen_models|solver-model|equity\.worker\.js|ort(?:\.|-)/i);
});

test('Playbook resolves DecisionContext through the deterministic StrategyProvider fallback', async () => {
  // Protects: Playbook strategy comes from the StrategyProvider bridge's
  // deterministic heuristic fallback; resolving makes no network call and no
  // ONNX/solver/API path exists in the page.
  const provider = app.evaluate('strategyProvider');
  assert.equal(typeof provider.resolve, 'function');
  let fetches = 0;
  const originalFetch = app.window.fetch;
  app.window.fetch = async () => { fetches += 1; throw new Error('network disabled'); };
  try {
    await app.navigate('analyze');
    await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  } finally {
    app.window.fetch = originalFetch;
  }
  assert.equal(fetches, 0);
  const result = provider.resolve(app.window.app.decisionContext);
  assert.equal(result.source, provider.sources.HEURISTIC ?? result.source);
  assert.match(String(result.source), /heuristic/i);
  assert.deepEqual(provider.resolve(app.window.app.decisionContext), result, 'deterministic for the same context');
  assert.deepEqual(app.window.app.strategyResult, result, 'the Playbook shows the provider result');
  for (const name of ['InferenceSession', 'useOnnx', 'onnxSession', 'connectApi', 'loadOnnx', 'generateStrategyWithOnnx']) {
    assert.equal(pageDefines(name), false, name);
  }
  assert.equal(app.window.app.solver, undefined);
});

test('strategy source provenance is static, truthful, and noninteractive', async () => {
  // SHELL-001: the header badge is the Badge component (source variant).
  const status = markup.getElementById('strategySourceStatus');
  assert.equal(status.localName, 'div');
  assert.ok(status.classList.contains('strategy-source-status') && status.classList.contains('ui-badge'));
  assert.equal(status.dataset.variant, 'source');
  assert.equal(text(status.querySelector('strong')), 'Heuristic fallback');
  assert.equal(status.querySelector('button, a, input, select'), null, 'noninteractive');
  for (const id of ['connectApiBtn', 'apiStatusText', 'toggleOnnx']) assert.equal(markup.getElementById(id), null, id);
  assert.doesNotMatch(text(markup.body), /Loading model|Model unavailable/i);
  for (const name of ['connectApiBtn', 'setStrategySourceStatus', 'toggleOnnx', 'trainingProgress']) {
    assert.equal(pageDefines(name), false, name);
  }
  for (const destination of ['hand', 'analyze', 'training', 'equity', 'home']) {
    await app.navigate(destination);
    assert.equal(app.byId('connectApiBtn'), null);
    assert.doesNotMatch(text(app.document.body), /Loading model|Model unavailable/i, destination);
  }
});

test('canonical Equity remains on the shared module worker path', () => {
  const worker = fs.readFileSync(new URL('../app/src/application/equity-worker.mjs', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../app/src/application/equity-worker-runtime.mjs', import.meta.url), 'utf8');
  assert.match(worker, /equity-worker-runtime\.mjs/);
  assert.match(runtime, /shared\/poker-domain\/index\.js/);
  const domainIndex = fs.readFileSync(new URL('../shared/poker-domain/index.js', import.meta.url), 'utf8');
  assert.match(domainIndex, /export \* from '\.\/equity\.js'/);
  assert.doesNotMatch(`${worker}\n${runtime}`, /equity\.worker\.js|getEquityWithWorker|onnx/i);
});

test('current browser sources contain no live ONNX strategy entrypoint', () => {
  for (const name of ['InferenceSession', 'loadOnnxModel', 'generateStrategyWithOnnx', 'getEquityWithWorker', 'toggleOnnxModel', 'runONNXInference']) {
    assert.equal(pageDefines(name), false, name);
  }
  assert.equal(app.window.ort, undefined);
  assert.equal(scriptSources.some((src) => /onnx|(?:^|\/)ort\b/i.test(src)), false);
});
