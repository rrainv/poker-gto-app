import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const protectedSources = [
  '../app/index.html',
  '../app/src/core/logic.js',
  '../app/src/application/strategy-provider.mjs',
  '../app/src/application/strategy-provider-bootstrap.mjs',
  '../app/src/application/training-generator.mjs',
  '../app/src/application/training-session-controller.mjs',
].map((path) => [path, fs.readFileSync(new URL(path, import.meta.url), 'utf8')]);

test('Personal Strategy is dormant and absent from startup, StrategyProvider, and Training imports', () => {
  for (const [path, source] of protectedSources) {
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
  const combined = `${domain}\n${repository}`;

  assert.doesNotMatch(combined, /\bdocument\b|querySelector|innerHTML|textContent/);
  assert.doesNotMatch(combined, /\bt\(|localiz|translated|displayLabel/);
  assert.doesNotMatch(combined, /\bfetch\b|XMLHttpRequest|WebSocket|https?:\/\//);
  assert.doesNotMatch(combined, /StrategyProvider|StrategyResult|solver|inference|confidence|modelVersion/i);
  assert.doesNotMatch(combined, /indexedDB/);
});

test('repository owns the only Personal Strategy Storage calls and uses one namespaced key', () => {
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
  assert.match(repository, /storage\.setItem\(storageKey, serialized\)/);
  assert.doesNotMatch(repository, /\blocalStorage\b|\bsessionStorage\b/);
});
