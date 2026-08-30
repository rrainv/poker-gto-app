import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

test('the compact player header resets global semantic-header padding', () => {
  assert.match(css, /header\s*\{[^}]*padding:\s*var\(--space-5\) var\(--space-6\)/s);
  const playerHeaderBlocks = [...css.matchAll(/\.equity-player-head\s*\{([^}]*)\}/g)];
  const finalPlayerHeader = playerHeaderBlocks.at(-1)?.[1] || '';
  assert.match(finalPlayerHeader, /min-block-size:\s*28px/);
  assert.match(finalPlayerHeader, /align-items:\s*center/);
  assert.match(finalPlayerHeader, /margin:\s*0/);
  assert.match(finalPlayerHeader, /padding:\s*0/);
});
