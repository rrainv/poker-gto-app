import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appUrl = new URL('../app/', import.meta.url);
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'));

function sourceBetween(start, end) {
  const from = logic.indexOf(start);
  const to = logic.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing start marker: ${start}`);
  assert.ok(to > from, `missing end marker: ${end}`);
  return logic.slice(from, to);
}

test('browser bootstrap contains no legacy ORT or model engine', () => {
  assert.doesNotMatch(html, /ort(?:\.min)?\.(?:js|mjs)|src\/ml\/engine\.js|frozen_models|solver-model/i);
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

test('Playbook resolves DecisionContext through the deterministic StrategyProvider fallback', () => {
  const providerSeam = sourceBetween('function decisionContextStrategySeed(', 'function setFrequency(index, action)');
  const updateContext = sourceBetween(
    "async function updateContext(reason = 'Context updated')",
    '// Legacy fast evaluator retained for Playbook heuristics',
  );

  assert.match(providerSeam, /fallbackResolver: resolveHeuristicFallback/);
  assert.match(updateContext, /const strategyResult = strategyProvider\.resolve\(decisionContext\)/);
  assert.doesNotMatch(`${providerSeam}\n${updateContext}`, /fetch\(|InferenceSession|useOnnx|onnxSession|app\.solver|connectApi|loadOnnx|generateStrategyWithOnnx/i);
});

test('strategy source provenance is static, truthful, and noninteractive', () => {
  assert.match(html, /<div id="strategySourceStatus" class="strategy-source-status"[^>]*>/);
  assert.match(html, /<strong>Heuristic fallback<\/strong>/);
  assert.doesNotMatch(html, /connectApiBtn|apiStatusText|toggleOnnx|Loading model|Model unavailable/i);
  assert.doesNotMatch(logic, /connectApiBtn|setStrategySourceStatus|toggleOnnx|trainingProgress/i);
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
  const source = `${html}\n${logic}`;
  assert.doesNotMatch(source, /\b(?:InferenceSession|loadOnnxModel|generateStrategyWithOnnx|getEquityWithWorker|toggleOnnxModel|runONNXInference)\b/);
  assert.doesNotMatch(source, /\b(?:globalThis|window)\.ort\b|\bort\.Tensor\b/);
});
