import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const strategyConsumers = [
  '../app/src/application/strategy-provider.mjs',
  '../app/src/application/strategy-provider-bootstrap.mjs',
  '../app/src/application/training-generator.mjs',
  '../app/src/application/training-session-controller.mjs',
].map((path) => [path, fs.readFileSync(new URL(path, import.meta.url), 'utf8')]);

test('Personal Strategy remains absent from StrategyProvider and Training imports', () => {
  for (const [path, source] of strategyConsumers) {
    assert.doesNotMatch(source, /personal-strategy|personalStrategy/i, path);
  }
});

test('Personal Strategy foundation contains no DOM, localization, network, solver, or model authority', () => {
  const domain = fs.readFileSync(
    new URL('../app/src/personal-strategy/domain.mjs', import.meta.url),
    'utf8',
  );
  const repository = fs.readFileSync(
    new URL('../app/src/personal-strategy/repository.mjs', import.meta.url),
    'utf8',
  );
  const database = fs.readFileSync(
    new URL('../app/src/personal-strategy/indexeddb-storage.mjs', import.meta.url),
    'utf8',
  );
  const combined = `${domain}\n${repository}\n${database}`;

  assert.doesNotMatch(combined, /\bdocument\b|querySelector|innerHTML|textContent/);
  assert.doesNotMatch(combined, /\bt\(|localiz|translated|displayLabel/);
  assert.doesNotMatch(combined, /\bfetch\b|XMLHttpRequest|WebSocket|https?:\/\//);
  assert.doesNotMatch(combined, /StrategyProvider|StrategyResult|solver|inference|confidence|modelVersion/i);
  assert.match(database, /globalThis\.indexedDB/);
});

test('repository owns legacy migration reads while the backend owns IndexedDB access', () => {
  const domain = fs.readFileSync(
    new URL('../app/src/personal-strategy/domain.mjs', import.meta.url),
    'utf8',
  );
  const repository = fs.readFileSync(
    new URL('../app/src/personal-strategy/repository.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(domain, /getItem|setItem|localStorage|sessionStorage/);
  assert.match(repository, /riverline\.personalStrategy\.v1/);
  assert.match(repository, /storage\.getItem\(storageKey\)/);
  assert.doesNotMatch(repository, /storage\.setItem\(storageKey/);
  assert.doesNotMatch(repository, /\blocalStorage\b|\bsessionStorage\b/);
});
